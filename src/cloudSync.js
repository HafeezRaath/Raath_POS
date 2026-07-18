// src/cloudSync.js — Background Cloud Sync Engine
import { db } from './firebase';
import {
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  getDocs,
  collection
} from 'firebase/firestore';

// ==================== DETECT ELECTRON MODE ====================
const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
const SYNC_ENABLED = !isElectron; // ✅ Electron mein sync OFF

console.log(`[CloudSync] Mode: ${isElectron ? 'ELECTRON' : 'BROWSER'}`);
console.log(`[CloudSync] Sync: ${SYNC_ENABLED ? 'ENABLED ✅' : 'DISABLED ❌'}`);

class CloudSync {
  constructor() {
    this.queue = [];
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this.syncEnabled = SYNC_ENABLED; // ✅ Electron mein false
    this.isFlushing = false;
    this.currentShopId = 'shop_default';

    // Load saved shop id
    try {
      const saved = localStorage.getItem('raath_shop_id');
      if (saved) this.currentShopId = saved;
    } catch (e) {}

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        console.log('[CloudSync] Back online — flushing queue...');
        this.flush();
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
        console.log('[CloudSync] Offline — queueing changes locally.');
      });

      // Restore pending queue
      try {
        const saved = localStorage.getItem('raath_cloud_queue');
        if (saved) {
          this.queue = JSON.parse(saved);
          if (this.queue.length > 0) {
            console.log(`[CloudSync] Restored ${this.queue.length} queued items.`);
          }
        }
      } catch (e) {
        this.queue = [];
      }
    }

    console.log(`[CloudSync] Initialized - Sync: ${this.syncEnabled ? 'ON ✅' : 'OFF ❌'}`);
  }

  setShopId(shopId) {
    if (shopId) {
      this.currentShopId = shopId;
      console.log(`[CloudSync] Shop ID set: ${shopId}`);
    }
  }

  getShopId() {
    return this.currentShopId;
  }

  saveQueue() {
    try {
      localStorage.setItem('raath_cloud_queue', JSON.stringify(this.queue));
    } catch (e) {
      console.warn('[CloudSync] Failed to save queue:', e);
    }
  }

  // ==================== PUSH (WITH CONDITIONAL SYNC) ====================
  async push(collectionName, data) {
    // ✅ Electron mein sync completely skip
    if (!this.syncEnabled) {
      console.log(`[CloudSync] ⏭️ Skipping push (Electron mode): ${collectionName}/${data?.id}`);
      return;
    }

    if (!data || !data.id) {
      console.warn('[CloudSync] push() skipped — missing data.id');
      return;
    }

    const payload = {
      ...data,
      _shopId: this.currentShopId,
      _syncedAt: serverTimestamp(),
      _localUpdatedAt: new Date().toISOString()
    };

    delete payload.password;
    delete payload.password_hash;

    if (this.isOnline) {
      try {
        const ref = doc(db, 'shops', this.currentShopId, collectionName, String(data.id));
        await setDoc(ref, payload);
        console.log(`☁️ Synced: ${collectionName}/${data.id}`);
      } catch (err) {
        console.warn(`[CloudSync] push() failed:`, err.message);
        this.queue.push({ type: 'set', collectionName, data: payload });
        this.saveQueue();
      }
    } else {
      this.queue.push({ type: 'set', collectionName, data: payload });
      this.saveQueue();
    }
  }

  // ==================== REMOVE (WITH CONDITIONAL SYNC) ====================
  async remove(collectionName, id) {
    // ✅ Electron mein sync completely skip
    if (!this.syncEnabled) {
      console.log(`[CloudSync] ⏭️ Skipping remove (Electron mode): ${collectionName}/${id}`);
      return;
    }

    if (id === undefined || id === null) return;
    const strId = String(id);

    if (this.isOnline) {
      try {
        await deleteDoc(doc(db, 'shops', this.currentShopId, collectionName, strId));
        console.log(`🗑️ Deleted from cloud: ${collectionName}/${strId}`);
      } catch (err) {
        this.queue.push({ type: 'delete', collectionName, id: strId });
        this.saveQueue();
      }
    } else {
      this.queue.push({ type: 'delete', collectionName, id: strId });
      this.saveQueue();
    }
  }

  // ==================== FLUSH (WITH CONDITIONAL SYNC) ====================
  async flush() {
    // ✅ Electron mein flush skip
    if (!this.syncEnabled) {
      console.log('[CloudSync] ⏭️ Skipping flush (Electron mode)');
      return;
    }

    if (!this.isOnline || this.queue.length === 0 || this.isFlushing) return;
    this.isFlushing = true;
    const batch = writeBatch(db);
    const toRemove = [];

    for (const item of this.queue) {
      try {
        const docId = item.id || item.data?.id;
        if (!docId) continue;
        const ref = doc(db, 'shops', this.currentShopId, item.collectionName, String(docId));
        if (item.type === 'set') batch.set(ref, item.data);
        else if (item.type === 'delete') batch.delete(ref);
        toRemove.push(item);
      } catch (e) {
        console.error('[CloudSync] Queue item failed:', e);
      }
    }

    try {
      await batch.commit();
      this.queue = this.queue.filter(q => !toRemove.includes(q));
      this.saveQueue();
      console.log(`✅ Flushed ${toRemove.length} items to cloud`);
    } catch (e) {
      console.error('[CloudSync] Flush failed:', e);
    } finally {
      this.isFlushing = false;
    }
  }

  // ==================== PULL (WITH CONDITIONAL SYNC) ====================
  async pull(collectionName) {
    // ✅ Electron mein pull skip
    if (!this.syncEnabled) {
      console.log(`[CloudSync] ⏭️ Skipping pull (Electron mode): ${collectionName}`);
      return [];
    }

    if (!this.isOnline) {
      console.warn('[CloudSync] pull() skipped — offline');
      return [];
    }
    try {
      const snap = await getDocs(collection(db, 'shops', this.currentShopId, collectionName));
      const docs = snap.docs.map(d => {
        const data = d.data();
        delete data._shopId;
        delete data._syncedAt;
        delete data._localUpdatedAt;
        return { id: d.id, ...data };
      });
      console.log(`☁️ Pulled ${docs.length} docs from ${collectionName}`);
      return docs;
    } catch (e) {
      console.error(`[CloudSync] pull() failed for ${collectionName}:`, e);
      return [];
    }
  }

  // ==================== SYNC ALL FROM CLOUD (WITH CONDITIONAL SYNC) ====================
  async syncAllFromCloud() {
    // ✅ Electron mein syncAllFromCloud skip
    if (!this.syncEnabled) {
      console.log('[CloudSync] ⏭️ Skipping syncAllFromCloud (Electron mode)');
      return {};
    }

    const collections = [
      'brands', 'categories', 'products', 'product_variants',
      'customers', 'suppliers', 'purchases', 'purchase_items',
      'sales', 'sale_items', 'sale_returns', 'sale_return_items',
      'expense_categories', 'expenses', 'payments',
      'users', 'roles', 'warehouses', 'offers', 'offer_items',
      'services', 'staff', 'work_orders', 'emis', 'emi_payments'
    ];

    const result = {};
    for (const col of collections) {
      try {
        result[col] = await this.pull(col);
      } catch (e) {
        result[col] = [];
      }
    }
    return result;
  }

  // ==================== TOGGLE SYNC (MANUAL CONTROL) ====================
  toggleSync(enabled) {
    // ✅ Electron mein toggle allow nahi (always off)
    if (isElectron) {
      console.log('[CloudSync] ⏭️ Cannot toggle sync in Electron mode');
      return;
    }
    this.syncEnabled = enabled;
    console.log(`[CloudSync] Sync ${enabled ? 'enabled ✅' : 'disabled ❌'}`);
    if (enabled) this.flush();
  }

  // ==================== MANUAL SYNC (FOR BROWSER) ====================
  async manualSync() {
    if (isElectron) {
      console.log('[CloudSync] ⏭️ Manual sync not available in Electron mode');
      return { success: false, message: 'Electron uses local database only' };
    }

    console.log('[CloudSync] Starting manual sync...');
    try {
      await this.flush();
      const data = await this.syncAllFromCloud();
      console.log('[CloudSync] Manual sync completed');
      return { success: true, data };
    } catch (e) {
      console.error('[CloudSync] Manual sync failed:', e);
      return { success: false, error: e.message };
    }
  }

  // ==================== GET STATUS ====================
  getStatus() {
    return {
      online: this.isOnline,
      enabled: this.syncEnabled,
      queued: this.queue.length,
      shopId: this.currentShopId,
      mode: isElectron ? 'electron' : 'browser',
      isElectron: isElectron
    };
  }

  // ==================== CLEAR QUEUE (FOR TESTING) ====================
  clearQueue() {
    this.queue = [];
    this.saveQueue();
    console.log('[CloudSync] Queue cleared');
  }
}

export const cloudSync = new CloudSync();