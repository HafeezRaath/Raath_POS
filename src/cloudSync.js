// ============================================================
//  cloudSync.js - Bulletproof Cloud Sync Engine 
//  PERFORMANCE OPTIMIZED & FULLY INTEGRATED
//  COMPLETE: All collections synced with db.js
//  - Added all missing collections
//  - Fixed field mappings
//  - Added conflict resolution
//  - Added retry logic with exponential backoff
//  - Added batch processing with progress tracking
//  - Added offline queue with persistence
//  - Added shop isolation
//  - Added full CRUD operations
//  - Added all db.js collections
//  - Added staff commission fields
//  - Added work order fields
//  - Added purchase returns
//  - Added salesman module
//  - Added FBR integration
//  - BULLETPROOF ERROR HANDLING
//  - LAZY SYNC: Route-based selective sync
//  - BACKGROUND SYNC: Remaining collections sync silently
//  - CACHE-FIRST: Instant load from local, then update
// ============================================================

import { db } from './firebase';
import {
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  getDocs,
  collection,
  getDoc,
  query,
  limit,
  startAfter,
  orderBy,
  where,
  updateDoc,
  runTransaction,
  Timestamp
} from 'firebase/firestore';

import { getCollectionPriority } from './syncConfig';

// ==================== DETECT ELECTRON MODE ====================
const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
const SYNC_ENABLED = !isElectron;

console.log(`[CloudSync] Mode: ${isElectron ? 'ELECTRON' : 'BROWSER'}`);
console.log(`[CloudSync] Sync: ${SYNC_ENABLED ? 'ENABLED ✅' : 'DISABLED ❌'}`);

// ==================== CONSTANTS ====================
const BATCH_MAX_SIZE = 400;
const QUEUE_KEY = 'raath_cloud_queue_v2';
const SHOP_KEY = 'raath_shop_id';
const SYNC_STATE_KEY = 'raath_sync_state';
const LAZY_SYNC_STATE_KEY = 'raath_lazy_sync_state';
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000;
const MAX_RETRY_DELAY = 30000;

// ==================== COMPLETE COLLECTIONS LIST ====================
// MUST MATCH db.js STORES
const ALL_COLLECTIONS = [
  // Core
  'brands', 'categories', 'products', 'product_variants', 'product_serialized_items',
  'customers', 'suppliers', 'purchases', 'purchase_items',
  'purchase_returns', 'purchase_return_items',
  'sales', 'sale_items', 'sale_returns', 'sale_return_items',
  'expense_categories', 'expenses', 'payments',
  'customer_ledger', 'supplier_ledger', 'general_ledger', 'ledger',
  'users', 'roles', 'warehouses', 'warehouse_stocks',

  // Marketing
  'offers', 'offer_items',

  // Services & Staff
  'services', 'staff', 'work_orders',

  // Finance
  'emis', 'emi_payments',
'accounts', 'account_transactions',
  'account_daily_balances',

  // FBR
  'fbr_invoices',

  // Salesman Module
  'salesmen', 'salesman_sales', 'salesman_sale_items', 'customer_sales_history'
];

// ==================== FIELD MAPPINGS ====================
// Map db.js field names to cloud field names
const FIELD_MAPPINGS = {
  'customer_ledger': {
    'customer_id': 'customerId',
    'sale_id': 'saleId'
  },
  'supplier_ledger': {
    'supplier_id': 'supplierId'
  },
  'purchase_items': {
    'purchase_id': 'purchaseId',
    'product_variant_id': 'productVariantId'
  },
  'sale_items': {
    'sale_id': 'saleId',
    'product_variant_id': 'productVariantId',
    'serialized_item_id': 'serializedItemId'
  },
  'sale_return_items': {
    'sale_return_id': 'saleReturnId',
    'product_variant_id': 'productVariantId'
  },
  'purchase_return_items': {
    'purchase_return_id': 'purchaseReturnId',
    'purchase_item_id': 'purchaseItemId',
    'product_variant_id': 'productVariantId'
  },
  'product_serialized_items': {
    'product_variant_id': 'productVariantId',
    'sale_id': 'saleId'
  },
  'warehouse_stocks': {
    'warehouse_id': 'warehouseId',
    'product_variant_id': 'productVariantId'
  },
  'sales': {
    'customer_id': 'customerId',
    'fbr_reference': 'fbrReference',
    'dummy_fbr_reference': 'dummyFbrReference'
  },
  'purchases': {
    'supplier_id': 'supplierId'
  },
  'purchase_returns': {
    'purchase_id': 'purchaseId',
    'supplier_id': 'supplierId'
  },
  'work_orders': {
    'service_id': 'serviceId',
    'staff_id': 'staffId',
    'customer_id': 'customerId'
  },
  'salesman_sales': {
    'salesman_id': 'salesmanId',
    'customer_id': 'customerId'
  },
  'salesman_sale_items': {
    'sale_id': 'saleId',
    'product_variant_id': 'productVariantId',
    'product_id': 'productId'
  },
  'customer_sales_history': {
    'customer_id': 'customerId',
    'sale_id': 'saleId',
    'salesman_id': 'salesmanId'
  },
  'offer_items': {
    'offer_id': 'offerId',
    'product_id': 'productId',
    'variant_id': 'variantId',
    'category_id': 'categoryId'
  },
  'fbr_invoices': {
    'sale_id': 'saleId'
  },
  'emi_payments': {
    'emi_id': 'emiId'
  }
};

// ==================== EXCLUDED FIELDS ====================
const EXCLUDED_FIELDS = [
  'password',
  '_syncSource',
  '_lastSynced',
  '_shopId',
  '_localUpdatedAt',
  '_syncedAt'
];

// ==================== RETRY HELPER ====================
async function withRetry(fn, context = 'unknown', retries = MAX_RETRIES) {
  let lastError;
  let delay = INITIAL_RETRY_DELAY;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (error.code === 'permission-denied' || error.code === 'unauthenticated') {
        throw error;
      }

      if (attempt < retries) {
        const jitter = Math.random() * 200;
        const waitTime = Math.min(delay + jitter, MAX_RETRY_DELAY);
        console.warn(`[CloudSync] Retry ${attempt}/${retries} for ${context} after ${waitTime}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        delay *= 2;
      }
    }
  }

  throw lastError || new Error(`Failed after ${retries} retries`);
}

// ==================== CLOUD SYNC CLASS ====================
class CloudSync {
  constructor() {
    this.queue = [];
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this.syncEnabled = SYNC_ENABLED;
    this.isFlushing = false;
    this.currentShopId = 'shop_default';
    this.flushPromise = null;
    this.lastFlushTime = null;
    this.syncInProgress = false;
    this.lastSyncTime = null;
    this._pendingFlush = false;

    // LAZY SYNC STATE
    this.syncedCollections = new Set();
    this.syncingCollections = new Set();
    this.isFullSyncComplete = false;
    this.backgroundSyncActive = false;

    // Load shop ID
    try {
      const saved = localStorage.getItem(SHOP_KEY);
      if (saved) this.currentShopId = saved;
    } catch (e) {}

    // Load sync state
    try {
      const state = localStorage.getItem(SYNC_STATE_KEY);
      if (state) {
        const parsed = JSON.parse(state);
        this.lastSyncTime = parsed.lastSyncTime ? new Date(parsed.lastSyncTime) : null;
      }
    } catch (e) {}

    // Load lazy sync state (persist which collections are synced)
    try {
      const lazyState = localStorage.getItem(LAZY_SYNC_STATE_KEY);
      if (lazyState) {
        const parsed = JSON.parse(lazyState);
        this.syncedCollections = new Set(parsed.syncedCollections || []);
        this.isFullSyncComplete = parsed.isFullSyncComplete || false;
      }
    } catch (e) {}

    // Online/Offline listeners
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

      // Load queue
      try {
        const saved = localStorage.getItem(QUEUE_KEY);
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

    // Periodic flush every 30 seconds if online
    if (typeof setInterval !== 'undefined' && !isElectron) {
      setInterval(() => {
        if (this.isOnline && this.queue.length > 0 && !this.isFlushing) {
          this.flush();
        }
      }, 30000);
    }

    console.log(`[CloudSync] Initialized - Sync: ${this.syncEnabled ? 'ON ✅' : 'OFF ❌'}, Queue: ${this.queue.length}`);
    console.log(`[CloudSync] Lazy Sync: ${this.syncedCollections.size} collections already synced`);
  }

  // ==================== LAZY SYNC STATE PERSISTENCE ====================
  saveLazySyncState() {
    try {
      localStorage.setItem(LAZY_SYNC_STATE_KEY, JSON.stringify({
        syncedCollections: Array.from(this.syncedCollections),
        isFullSyncComplete: this.isFullSyncComplete,
        lastUpdated: new Date().toISOString()
      }));
    } catch (e) {
      console.warn('[CloudSync] Failed to save lazy sync state:', e);
    }
  }

  // ==================== SHOP ID MANAGEMENT ====================
  setShopId(shopId) {
    if (shopId) {
      this.currentShopId = shopId;
      try { localStorage.setItem(SHOP_KEY, shopId); } catch (e) {}
      console.log(`[CloudSync] Shop ID set: ${shopId}`);
    }
  }

  getShopId() {
    return this.currentShopId;
  }

  // ==================== QUEUE MANAGEMENT ====================
  saveQueue() {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch (e) {
      console.warn('[CloudSync] Failed to save queue:', e);
    }
  }

  saveSyncState() {
    try {
      localStorage.setItem(SYNC_STATE_KEY, JSON.stringify({
        lastSyncTime: this.lastSyncTime ? this.lastSyncTime.toISOString() : null
      }));
    } catch (e) {}
  }

  _dedupeQueue() {
    const seen = new Map();
    for (const item of this.queue) {
      const docId = item.id || item.data?.id;
      if (!docId) continue;
      const key = `${item.collectionName}::${docId}`;
      seen.set(key, item);
    }
    this.queue = Array.from(seen.values());
    this.saveQueue();
  }

  // ==================== PAYLOAD BUILDER ====================
  _buildPayload(data, collectionName = '') {
    if (!data) return {};

    const payload = {
      ...data,
      _shopId: this.currentShopId,
      _localUpdatedAt: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (collectionName && FIELD_MAPPINGS[collectionName]) {
      const mapping = FIELD_MAPPINGS[collectionName];
      for (const [localField, cloudField] of Object.entries(mapping)) {
        if (payload[localField] !== undefined && localField !== cloudField) {
          payload[cloudField] = payload[localField];
        }
      }
    }

    for (const field of EXCLUDED_FIELDS) {
      delete payload[field];
    }

    return Object.fromEntries(
      Object.entries(payload).filter(([_, v]) => v !== undefined && v !== null)
    );
  }

  // ==================== CONFLICT RESOLUTION ====================
  _resolveConflict(localData, cloudData) {
    if (!cloudData) return localData;
    if (!localData) return cloudData;

    const localTime = new Date(localData.updated_at || localData._localUpdatedAt || 0);
    const cloudTime = new Date(cloudData.updated_at || cloudData._localUpdatedAt || 0);

    if (cloudTime > localTime) {
      return { ...localData, ...cloudData, _syncSource: 'cloud' };
    }

    if (localTime > cloudTime) {
      return { ...cloudData, ...localData, _syncSource: 'local' };
    }

    return { ...cloudData, ...localData, _syncSource: 'merged' };
  }

  // ==================== PUSH ====================
  async push(collectionName, data) {
    if (!this.syncEnabled) {
      console.log(`[CloudSync] ⏭️ Skipping push (Electron): ${collectionName}/${data?.id}`);
      return;
    }

    if (!data || !data.id) {
      console.warn('[CloudSync] push() skipped — missing data.id');
      return;
    }

    const docId = String(data.id);

    const existingIndex = this.queue.findIndex(q => {
      const qId = q.id || q.data?.id;
      return q.collectionName === collectionName && String(qId) === docId;
    });

    if (existingIndex >= 0) {
      this.queue.splice(existingIndex, 1);
    }

    const payload = this._buildPayload(data, collectionName);

    if (collectionName === 'fbr_invoices') {
      if (!payload.fbr_status) payload.fbr_status = 'PENDING';
      if (!payload.retry_count) payload.retry_count = 0;
      if (!payload.max_retries) payload.max_retries = 10;
    }

    if (collectionName === 'staff') {
      if (payload.commission_rate === undefined) payload.commission_rate = 0;
      if (payload.base_salary === undefined) payload.base_salary = 0;
    }

    if (collectionName === 'work_orders') {
      if (payload.parts_used === undefined) payload.parts_used = [];
      if (payload.commission_amount === undefined) payload.commission_amount = 0;
    }

    if (this.isOnline) {
      try {
        await withRetry(async () => {
          const ref = doc(db, 'shops', this.currentShopId, collectionName, docId);

          const snap = await getDoc(ref);
          if (snap.exists()) {
            const existingData = snap.data();
            const merged = this._resolveConflict(payload, existingData);
            await setDoc(ref, merged, { merge: true });
          } else {
            await setDoc(ref, payload, { merge: true });
          }
        }, `push:${collectionName}/${docId}`);

        console.log(`☁️ Synced: ${collectionName}/${docId}`);
      } catch (err) {
        console.warn(`[CloudSync] push() failed, queueing:`, err.message);
        this.queue.push({ type: 'set', collectionName, id: docId, data: payload, timestamp: Date.now() });
        this.saveQueue();
      }
    } else {
      this.queue.push({ type: 'set', collectionName, id: docId, data: payload, timestamp: Date.now() });
      this.saveQueue();
    }
  }

  // ==================== REMOVE ====================
  async remove(collectionName, id) {
    if (!this.syncEnabled) {
      console.log(`[CloudSync] ⏭️ Skipping remove (Electron): ${collectionName}/${id}`);
      return;
    }

    if (id === undefined || id === null) return;
    const strId = String(id);

    const existingIndex = this.queue.findIndex(q => {
      const qId = q.id || q.data?.id;
      return q.collectionName === collectionName && String(qId) === strId;
    });
    if (existingIndex >= 0) {
      this.queue.splice(existingIndex, 1);
    }

    if (this.isOnline) {
      try {
        await withRetry(async () => {
          const ref = doc(db, 'shops', this.currentShopId, collectionName, strId);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            await deleteDoc(ref);
          }
        }, `remove:${collectionName}/${strId}`);

        console.log(`🗑️ Deleted from cloud: ${collectionName}/${strId}`);
      } catch (err) {
        console.warn(`[CloudSync] remove() failed, queueing:`, err.message);
        this.queue.push({ type: 'delete', collectionName, id: strId, timestamp: Date.now() });
        this.saveQueue();
      }
    } else {
      this.queue.push({ type: 'delete', collectionName, id: strId, timestamp: Date.now() });
      this.saveQueue();
    }
  }

  // ==================== FLUSH ====================
  async flush(progressCallback = null) {
    if (!this.syncEnabled) {
      console.log('[CloudSync] ⏭️ Skipping flush (Electron)');
      return;
    }

    if (!this.isOnline || this.queue.length === 0 || this.isFlushing) return;
    if (this.flushPromise) return this.flushPromise;

    this.flushPromise = this._doFlush(progressCallback);
    try {
      await this.flushPromise;
    } finally {
      this.flushPromise = null;
    }
  }

  async _doFlush(progressCallback) {
    if (this.queue.length === 0) {
      this.isFlushing = false;
      return;
    }

    this.isFlushing = true;
    this._dedupeQueue();

    let totalFlushed = 0;
    let attempts = 0;
    const maxAttempts = 3;
    const totalItems = this.queue.length;

    while (this.queue.length > 0 && attempts < maxAttempts) {
      attempts++;
      const chunk = this.queue.slice(0, BATCH_MAX_SIZE);
      const batch = writeBatch(db);
      const processedKeys = [];
      const failedItems = [];

      for (const item of chunk) {
        try {
          const docId = item.id || item.data?.id;
          if (!docId) continue;

          const ref = doc(db, 'shops', this.currentShopId, item.collectionName, String(docId));

          if (item.type === 'set') {
            const payload = this._buildPayload(item.data, item.collectionName);

            const snap = await getDoc(ref);
            if (snap.exists()) {
              const merged = this._resolveConflict(payload, snap.data());
              batch.set(ref, merged, { merge: true });
            } else {
              batch.set(ref, payload, { merge: true });
            }
          } else if (item.type === 'delete') {
            const snap = await getDoc(ref);
            if (snap.exists()) {
              batch.delete(ref);
            }
          }

          processedKeys.push(`${item.collectionName}::${docId}::${item.type}`);
        } catch (e) {
          console.error('[CloudSync] Queue item build failed:', e);
          failedItems.push(item);
        }
      }

      try {
        await withRetry(async () => {
          await batch.commit();
        }, `batch-commit-${attempts}`);

        this.queue = this.queue.filter((item, idx) => {
          if (idx >= chunk.length) return true;
          const docId = item.id || item.data?.id;
          const key = `${item.collectionName}::${docId}::${item.type}`;
          return !processedKeys.includes(key);
        });

        totalFlushed += processedKeys.length;
        console.log(`✅ Flushed ${processedKeys.length} items (attempt ${attempts})`);

        if (progressCallback) {
          const remaining = this.queue.length;
          const processed = totalItems - remaining;
          progressCallback(processed, totalItems);
        }

      } catch (e) {
        console.error(`[CloudSync] Batch commit failed (attempt ${attempts}):`, e.message);
        if (failedItems.length > 0) {
          this.queue = [...failedItems, ...this.queue];
        }
        await new Promise(r => setTimeout(r, 1000 * attempts));
      }
    }

    this.saveQueue();
    this.isFlushing = false;
    this.lastFlushTime = new Date();

    if (this.queue.length > 0) {
      console.warn(`[CloudSync] ${this.queue.length} items still queued after ${maxAttempts} attempts`);
    } else {
      console.log(`[CloudSync] Flush complete. Total flushed: ${totalFlushed}`);
    }
  }

  // ==================== PULL ====================
  async pull(collectionName, limitVal = 500, startAfterDoc = null, filters = null) {
    if (!this.syncEnabled) {
      console.log(`[CloudSync] ⏭️ Skipping pull (Electron): ${collectionName}`);
      return [];
    }

    if (!this.isOnline) {
      console.warn('[CloudSync] pull() skipped — offline');
      return [];
    }

    try {
      let collectionRef = collection(db, 'shops', this.currentShopId, collectionName);
      let queryRef = query(collectionRef, limit(limitVal));

      if (startAfterDoc) {
        queryRef = query(queryRef, startAfter(startAfterDoc));
      }

      if (filters) {
        for (const filter of filters) {
          queryRef = query(queryRef, where(filter.field, filter.operator, filter.value));
        }
      }

      let snap;
      try {
        snap = await withRetry(async () => {
          return await getDocs(queryRef);
        }, `pull:${collectionName}`);
      } catch (err) {
        if (err.message && err.message.toLowerCase().includes('index')) {
          console.warn(`[CloudSync] Index missing for ${collectionName}, using fallback query`);
          const fallbackQuery = query(collectionRef, limit(limitVal));
          snap = await getDocs(fallbackQuery);
        } else {
          throw err;
        }
      }

      const docs = snap.docs.map(d => {
        const data = d.data();

        if (collectionName && FIELD_MAPPINGS[collectionName]) {
          const mapping = FIELD_MAPPINGS[collectionName];
          for (const [localField, cloudField] of Object.entries(mapping)) {
            if (data[cloudField] !== undefined && localField !== cloudField) {
              data[localField] = data[cloudField];
            }
          }
        }

        const cloudUpdatedAt = data.updated_at || data._localUpdatedAt;
        if (cloudUpdatedAt) {
          data.updated_at = cloudUpdatedAt;
        }

        delete data._shopId;
        delete data._syncedAt;
        delete data._localUpdatedAt;

        return { id: d.id, ...data };
      });

      console.log(`☁️ Pulled ${docs.length} docs from ${collectionName}`);
      return docs;
    } catch (e) {
      console.error(`[CloudSync] pull() failed for ${collectionName}:`, e);
      throw new Error(`Failed to pull ${collectionName}: ${e.message}`);
    }
  }

  // ==================== PULL SINGLE DOC ====================
  async pullDoc(collectionName, docId) {
    if (!this.syncEnabled || !this.isOnline) return null;

    try {
      const ref = doc(db, 'shops', this.currentShopId, collectionName, String(docId));
      const snap = await withRetry(async () => {
        return await getDoc(ref);
      }, `pullDoc:${collectionName}/${docId}`);

      if (!snap.exists()) return null;

      const data = snap.data();
      const cloudUpdatedAt = data.updated_at || data._localUpdatedAt;
      if (cloudUpdatedAt) {
        data.updated_at = cloudUpdatedAt;
      }

      delete data._shopId;
      delete data._syncedAt;
      delete data._localUpdatedAt;

      return { id: snap.id, ...data };
    } catch (e) {
      console.error(`[CloudSync] pullDoc() failed:`, e);
      return null;
    }
  }

  // ============================================================
  //  LAZY SYNC METHODS — NEW!
  // ============================================================

  // ==================== SYNC SPECIFIC COLLECTIONS (LAZY) ====================
  // Sirf diye gaye collections sync karo — fast!
  async syncCollections(collectionNames, priority = 'high', progressCallback = null) {
    if (!this.syncEnabled) {
      console.log('[CloudSync] ⏭️ Skipping syncCollections (Electron)');
      return {};
    }

    if (!this.isOnline) {
      console.warn('[CloudSync] syncCollections() skipped — offline');
      return {};
    }

    // Filter out already synced or currently syncing
    const toSync = collectionNames.filter(
      name => !this.syncedCollections.has(name) && !this.syncingCollections.has(name)
    );

    if (toSync.length === 0) {
      console.log('[CloudSync] All requested collections already synced');
      return {};
    }

    console.log(`[CloudSync] 🚀 Lazy syncing ${toSync.length} collections: ${toSync.join(', ')}`);

    const result = {};
    let completed = 0;
    const total = toSync.length;

    // Priority ke hisaab se sort karo
    toSync.sort((a, b) => getCollectionPriority(a) - getCollectionPriority(b));

    for (const collectionName of toSync) {
      this.syncingCollections.add(collectionName);

      try {
        const docs = await withRetry(async () => {
          return await this.pull(collectionName);
        }, `lazySync:${collectionName}`);

        result[collectionName] = docs;
        this.syncedCollections.add(collectionName);
        completed++;

        if (progressCallback) {
          progressCallback(completed, total, collectionName, docs.length);
        }

        console.log(`[CloudSync] ✅ ${collectionName} synced (${docs.length} docs)`);

        // Event fire karo taake UI update ho sake
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('cloudsync_collection_synced', {
            detail: { collectionName, count: docs.length, priority }
          }));
        }

      } catch (error) {
        console.error(`[CloudSync] ❌ Failed to sync ${collectionName}:`, error.message);
        result[collectionName] = { error: error.message };
      } finally {
        this.syncingCollections.delete(collectionName);
      }
    }

    this.saveLazySyncState();
    console.log(`[CloudSync] Lazy sync complete. ${completed}/${total} collections synced.`);
    return result;
  }

  // ==================== BACKGROUND SYNC ====================
  // Baqi collections ko background mein silently sync karo
  async syncRemainingInBackground(allCollections = ALL_COLLECTIONS) {
    if (!this.syncEnabled || !this.isOnline || this.backgroundSyncActive || this.isFullSyncComplete) {
      return;
    }

    const remaining = allCollections.filter(
      name => !this.syncedCollections.has(name)
    );

    if (remaining.length === 0) {
      this.isFullSyncComplete = true;
      this.saveLazySyncState();
      console.log('[CloudSync] ✅ All collections synced. Full sync complete.');
      return;
    }

    this.backgroundSyncActive = true;
    console.log(`[CloudSync] 🌙 Background sync started for ${remaining.length} collections`);

    try {
      for (const collectionName of remaining) {
        if (!this.isOnline) break;

        try {
          await this.syncCollections([collectionName], 'low');
          // Har collection ke baad thandi saans lo — UI block nahi hoga
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) {
          console.warn(`[CloudSync] Background sync failed for ${collectionName}:`, e.message);
        }
      }

      this.isFullSyncComplete = true;
      this.saveLazySyncState();
      console.log('[CloudSync] 🌙 Background sync complete');

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cloudsync_full_sync_complete'));
      }
    } finally {
      this.backgroundSyncActive = false;
    }
  }

  // ==================== CHECK IF COLLECTION SYNCED ====================
  isCollectionSynced(collectionName) {
    return this.syncedCollections.has(collectionName);
  }

  // ==================== GET SYNCED COLLECTIONS ====================
  getSyncedCollections() {
    return Array.from(this.syncedCollections);
  }

  // ==================== RESET LAZY SYNC STATE ====================
  resetLazySync() {
    this.syncedCollections.clear();
    this.syncingCollections.clear();
    this.isFullSyncComplete = false;
    this.backgroundSyncActive = false;
    this.saveLazySyncState();
    console.log('[CloudSync] Lazy sync state reset');
  }

  // ==================== SYNC ALL FROM CLOUD (LEGACY) ====================
  async syncAllFromCloud(progressCallback = null, collections = ALL_COLLECTIONS) {
    if (!this.syncEnabled) {
      console.log('[CloudSync] ⏭️ Skipping syncAllFromCloud (Electron)');
      return {};
    }

    if (this.syncInProgress) {
      console.log('[CloudSync] Sync already in progress, returning existing promise');
      return this._syncPromise;
    }

    this.syncInProgress = true;
    this._syncPromise = this._doSyncAllFromCloud(progressCallback, collections);

    try {
      const result = await this._syncPromise;
      this.lastSyncTime = new Date();
      this.saveSyncState();
      return result;
    } finally {
      this.syncInProgress = false;
      this._syncPromise = null;
    }
  }

  async _doSyncAllFromCloud(progressCallback, collections) {
    const result = {};
    let completed = 0;
    const total = collections.length;

    for (const col of collections) {
      try {
        result[col] = await withRetry(async () => {
          return await this.pull(col);
        }, `syncAll:${col}`);

        completed++;
        if (progressCallback) {
          progressCallback(completed, total, col);
        }
        console.log(`[CloudSync] Sync progress: ${completed}/${total} (${col}) - ${result[col].length} items`);
      } catch (e) {
        console.error(`[CloudSync] Failed to pull ${col}:`, e);
        result[col] = [];
      }
    }

    console.log(`[CloudSync] Full sync complete. ${completed}/${total} collections synced.`);
    return result;
  }

  // ==================== PUSH ALL ====================
  async pushAll(localDataMap) {
    if (!this.syncEnabled) {
      console.log('[CloudSync] ⏭️ Skipping pushAll (Electron)');
      return { success: false, message: 'Electron mode' };
    }

    console.log('[CloudSync] Starting full push to cloud...');
    let total = 0;
    let failed = 0;
    const failedItems = [];

    for (const [collectionName, items] of Object.entries(localDataMap)) {
      if (!items || !Array.isArray(items) || items.length === 0) continue;

      for (const item of items) {
        if (!item.id) continue;
        try {
          await withRetry(async () => {
            const ref = doc(db, 'shops', this.currentShopId, collectionName, String(item.id));
            const payload = this._buildPayload(item, collectionName);

            const snap = await getDoc(ref);
            if (snap.exists()) {
              const merged = this._resolveConflict(payload, snap.data());
              await setDoc(ref, merged, { merge: true });
            } else {
              await setDoc(ref, payload, { merge: true });
            }
          }, `pushAll:${collectionName}/${item.id}`);

          total++;
        } catch (e) {
          failed++;
          failedItems.push({ collection: collectionName, id: item.id, error: e.message });
          console.warn(`[CloudSync] pushAll failed for ${collectionName}/${item.id}:`, e.message);
          this.queue.push({ type: 'set', collectionName, id: String(item.id), data: item, timestamp: Date.now() });
        }
      }
    }

    this.saveQueue();
    console.log(`[CloudSync] Full push complete. ${total} synced, ${failed} failed.`);
    return { success: true, count: total, failed, failedItems };
  }

  // ==================== SYNC SPECIFIC COLLECTION (LEGACY) ====================
  async syncCollection(collectionName, direction = 'pull') {
    if (!this.syncEnabled) {
      console.log(`[CloudSync] ⏭️ Skipping syncCollection (Electron): ${collectionName}`);
      return { success: false, message: 'Electron mode' };
    }

    if (!ALL_COLLECTIONS.includes(collectionName)) {
      return { success: false, message: `Collection ${collectionName} not in sync list` };
    }

    try {
      if (direction === 'pull') {
        const data = await this.pull(collectionName);
        return { success: true, data, collection: collectionName };
      } else if (direction === 'push') {
        return { success: false, message: 'Push requires data parameter' };
      }
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ==================== CONFLICT RESOLUTION UTILITY ====================
  async resolveConflicts(collectionName, localData, cloudData) {
    if (!localData) return cloudData;
    if (!cloudData) return localData;

    const localTime = new Date(localData.updated_at || localData._localUpdatedAt || 0);
    const cloudTime = new Date(cloudData.updated_at || cloudData._localUpdatedAt || 0);

    if (cloudTime > localTime) {
      return { ...localData, ...cloudData };
    }

    if (localTime > cloudTime) {
      return { ...cloudData, ...localData };
    }

    const merged = { ...cloudData, ...localData };

    if (collectionName === 'work_orders' && localData.parts_used && cloudData.parts_used) {
      const localParts = Array.isArray(localData.parts_used) ? localData.parts_used : [];
      const cloudParts = Array.isArray(cloudData.parts_used) ? cloudData.parts_used : [];
      merged.parts_used = [...localParts, ...cloudParts];
    }

    return merged;
  }

  // ==================== MANUAL SYNC ====================
  async manualSync(returnFullData = false, collections = ALL_COLLECTIONS) {
    if (isElectron) {
      return { success: false, message: 'Electron uses local database only' };
    }

    console.log('[CloudSync] Starting manual sync...');
    try {
      await this.flush();
      const data = await this.syncAllFromCloud(null, collections);

      console.log('[CloudSync] Manual sync completed');

      if (returnFullData) {
        return { success: true, data };
      }

      const summary = {};
      let totalDocs = 0;
      for (const [col, items] of Object.entries(data)) {
        summary[col] = items.length;
        totalDocs += items.length;
      }
      return { success: true, summary, totalDocs };
    } catch (e) {
      console.error('[CloudSync] Manual sync failed:', e);
      return { success: false, error: e.message };
    }
  }

  // ==================== STATUS ====================
  getStatus() {
    return {
      online: this.isOnline,
      enabled: this.syncEnabled,
      queued: this.queue.length,
      shopId: this.currentShopId,
      mode: isElectron ? 'electron' : 'browser',
      isElectron: isElectron,
      batchMax: BATCH_MAX_SIZE,
      lastFlush: this.lastFlushTime,
      lastSync: this.lastSyncTime,
      syncInProgress: this.syncInProgress,
      collections: ALL_COLLECTIONS.length,
      isFlushing: this.isFlushing,
      // Lazy sync status
      syncedCollections: Array.from(this.syncedCollections),
      syncingCollections: Array.from(this.syncingCollections),
      isFullSyncComplete: this.isFullSyncComplete,
      backgroundSyncActive: this.backgroundSyncActive,
      totalCollections: ALL_COLLECTIONS.length,
      syncedCount: this.syncedCollections.size,
      remainingCount: ALL_COLLECTIONS.length - this.syncedCollections.size
    };
  }

  // ==================== UTILITY METHODS ====================
  toggleSync(enabled) {
    if (isElectron) {
      console.log('[CloudSync] ⏭️ Cannot toggle sync in Electron mode');
      return;
    }
    this.syncEnabled = enabled;
    console.log(`[CloudSync] Sync ${enabled ? 'enabled ✅' : 'disabled ❌'}`);
    if (enabled) this.flush();
  }

  clearQueue() {
    this.queue = [];
    this.saveQueue();
    console.log('[CloudSync] Queue cleared');
  }

  getPendingCount() {
    return this.queue.length;
  }

  getQueue() {
    return [...this.queue];
  }

  // ==================== BULK OPERATIONS ====================
  async bulkPush(collectionName, items) {
    if (!this.syncEnabled || !items || !Array.isArray(items) || items.length === 0) {
      return { success: false, message: 'Invalid items' };
    }

    let success = 0;
    let failed = 0;
    const failedItems = [];

    for (const item of items) {
      try {
        await this.push(collectionName, item);
        success++;
      } catch (e) {
        failed++;
        failedItems.push({ item, error: e.message });
      }
    }

    return { success: true, successCount: success, failedCount: failed, failedItems };
  }

  async bulkDelete(collectionName, ids) {
    if (!this.syncEnabled || !ids || !Array.isArray(ids) || ids.length === 0) {
      return { success: false, message: 'Invalid ids' };
    }

    let success = 0;
    let failed = 0;

    for (const id of ids) {
      try {
        await this.remove(collectionName, id);
        success++;
      } catch (e) {
        failed++;
      }
    }

    return { success: true, successCount: success, failedCount: failed };
  }

  // ==================== EXPORT DATA ====================
  async exportAllData() {
    if (!this.syncEnabled) {
      return { success: false, message: 'Electron mode' };
    }

    const data = await this.syncAllFromCloud();
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      shopId: this.currentShopId,
      collections: Object.keys(data),
      totalItems: Object.values(data).reduce((sum, items) => sum + items.length, 0)
    };
  }

  // ==================== IMPORT DATA ====================
  async importData(dataMap) {
    if (!this.syncEnabled || !dataMap || typeof dataMap !== 'object') {
      return { success: false, message: 'Invalid data' };
    }

    let total = 0;
    let failed = 0;

    for (const [collectionName, items] of Object.entries(dataMap)) {
      if (!Array.isArray(items)) continue;

      for (const item of items) {
        try {
          await this.push(collectionName, item);
          total++;
        } catch (e) {
          failed++;
        }
      }
    }

    return { success: true, total, failed };
  }

  // ==================== HEALTH CHECK ====================
  async healthCheck() {
    if (!this.syncEnabled) {
      return { status: 'ok', mode: 'electron', syncEnabled: false };
    }

    try {
      const ref = doc(db, 'shops', this.currentShopId, '_health', 'check');
      await setDoc(ref, { timestamp: serverTimestamp(), status: 'ok' }, { merge: true });
      return { status: 'ok', mode: 'browser', syncEnabled: true, shopId: this.currentShopId };
    } catch (e) {
      return { status: 'error', mode: 'browser', syncEnabled: true, error: e.message };
    }
  }
}

// ==================== EXPORT ====================
export const cloudSync = new CloudSync();

// ==================== CONVENIENCE EXPORTS ====================
export const {
  push,
  remove,
  flush,
  pull,
  pullDoc,
  syncAllFromCloud,
  syncCollections,
  syncRemainingInBackground,
  isCollectionSynced,
  getSyncedCollections,
  resetLazySync,
  pushAll,
  manualSync,
  getStatus,
  toggleSync,
  clearQueue,
  getPendingCount,
  getQueue,
  setShopId,
  getShopId,
  bulkPush,
  bulkDelete,
  exportAllData,
  importData,
  healthCheck
} = cloudSync;
