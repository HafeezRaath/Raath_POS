// ============================================================
//  db-core.js — Base Storage Class (Sirf Glue, Koi Logic Nahi)
//  Yeh existing core/ modules ko jorti hai.
// ============================================================

import { isElectron } from './core/config.js';
import { ElectronBridge } from './core/electron-bridge.js';
import { 
  idbGetAll, idbGetById, idbPut, 
  ensureIndexedDB, initIndexedDB 
} from './core/idb-core.js';
import { cloudSync } from './core/sync.js';
import { sleep, safeAdd, safeSub } from './core/utils.js';

export class Storage {
  constructor() {
    this.mode = isElectron ? 'electron' : 'browser';
    this.electron = new ElectronBridge();
    
    // Browser-side mutex (IDB ke liye — alag from ElectronBridge mutex)
    this._dbMutex = Promise.resolve();
    this._mutexCounter = 0;
    this._reentrantGuard = new Set();
  }

  // ==================== ELECTRON PROXY ====================
  async electronQuery(sql, params = []) {
    return this.electron.query(sql, params);
  }

  async electronTransaction(callback) {
    return this.electron.transaction(callback);
  }

  // ==================== BROWSER MUTEX ====================
  async _withMutex(fn, callerId = 'default') {
    if (this._reentrantGuard.has(callerId)) return fn();
    this._reentrantGuard.add(callerId);
    const oldMutex = this._dbMutex;
    let release;
    const newMutex = new Promise(r => { release = r; });
    this._dbMutex = oldMutex.then(() => newMutex).catch(() => newMutex);
    await oldMutex.catch(() => {});
    try { return await fn(); } 
    finally { this._reentrantGuard.delete(callerId); release(); }
  }

  _sleep(ms) { return sleep(ms); }

  // ==================== MATH HELPERS (thin wrappers) ====================
  // Taake mixins mein `this.safeAdd` ka pattern chalta rahe
  safeAdd(a, b) { return safeAdd(a, b); }
  safeSub(a, b) { return safeSub(a, b); }

  // ==================== HEALTH & CLEANUP ====================
  async healthCheck() {
    try {
      if (this.mode === 'electron') {
        await this.electronQuery('SELECT 1');
      } else {
        await idbGetAll('products');
      }
      return { status: 'ok', mode: this.mode };
    } catch (e) {
      return { status: 'error', mode: this.mode, error: e.message };
    }
  }

  async clearStore(storeName) {
    await ensureIndexedDB();
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const r = tx.objectStore(storeName).clear();
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  }

  async clearAllData() {
    const { STORES } = await import('./core/config.js');
    for (const store of STORES) {
      try { await this.clearStore(store); } catch (e) {}
    }
    localStorage.removeItem('raath_invoice_counter');
    localStorage.removeItem('invoice_counter');
    console.log('[Storage] All local data cleared');
  }

  // ==================== CLOUD SYNC PULL ====================
  async syncFromCloud() {
    console.log('[Storage] Starting cloud sync...');
    const syncedCounts = {};
    let totalSynced = 0;
    
    try {
      const cloudData = await cloudSync.syncAllFromCloud();
      if (!cloudData || typeof cloudData !== 'object') {
        return { success: true, total: 0, counts: {} };
      }

      for (const [storeName, items] of Object.entries(cloudData)) {
        if (!items || !Array.isArray(items) || items.length === 0) continue;
        let storeSynced = 0;
        
        try {
          for (const item of items) {
            if (!item || !item.id) continue;
            const localItem = await idbGetById(storeName, item.id);
            
            if (localItem && !localItem.is_deleted && item.is_deleted === 1) {
              await idbPut(storeName, { 
                ...localItem, 
                is_deleted: 1, 
                deleted_at: item.deleted_at || new Date().toISOString() 
              }, true);
              storeSynced++;
              continue;
            }
            
            const cloudTime = new Date(item.updated_at || item.created_at || 0).getTime();
            const localTime = localItem ? new Date(localItem.updated_at || localItem.created_at || 0).getTime() : 0;
            
            if (!localItem || cloudTime > localTime) {
              await idbPut(storeName, { 
                ...item,
                is_deleted: item.is_deleted === 1 ? 1 : 0,
                _lastSynced: new Date().toISOString(),
                _syncSource: 'cloud'
              }, true);
              storeSynced++;
            }
          }
          syncedCounts[storeName] = storeSynced;
          totalSynced += storeSynced;
        } catch (e) {
          console.error(`[Storage] Failed to sync ${storeName}:`, e);
        }
      }
      
      try {
        window.dispatchEvent(new CustomEvent('raath_sync_complete', { 
          detail: { total: totalSynced, counts: syncedCounts } 
        }));
      } catch (e) {}
      
      return { success: true, total: totalSynced, counts: syncedCounts };
    } catch (error) {
      console.error('[Storage] Cloud sync failed:', error);
      return { success: false, error: error.message, total: 0, counts: {} };
    }
  }
}