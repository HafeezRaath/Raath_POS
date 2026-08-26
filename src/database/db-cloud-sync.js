// ============================================================
//  db-cloud-sync.js — Cloud Sync, Cleanup & Health Check (Mixin)
//  LAZY SYNC ADDED — Original syncFromCloud PRESERVED
// ============================================================

import { cloudSync } from '../cloudSync.js';
import { idbGetAll, idbGetById, idbPut, initIndexedDB, ensureIndexedDB } from './core/idb-core.js';
import { resetDuplicateTrackers, ensureUnique } from './core/utils.js';

export function attachCloudSyncMethods(StorageClass) {

  // ==================== SYNC FROM CLOUD (FULL — ORIGINAL, UNCHANGED) ====================
  StorageClass.prototype.syncFromCloud = async function() {
    console.log('[Storage] Starting cloud sync...');
    const syncedCounts = {};
    let totalSynced = 0;

    try {
      const cloudData = await cloudSync.syncAllFromCloud();

      if (!cloudData || typeof cloudData !== 'object') {
        console.warn('[Storage] Cloud sync returned no data');
        return { success: true, total: 0, counts: {} };
      }

      for (const [storeName, items] of Object.entries(cloudData)) {
        if (!items || !Array.isArray(items) || items.length === 0) continue;

        // Reset trackers for each collection
        if (storeName === 'product_variants' || storeName === 'sales') {
          resetDuplicateTrackers();
        }

        let storeSynced = 0;
        let storeSkipped = 0;

        try {
          for (const item of items) {
            if (!item || !item.id) continue;

            try {
              const localItem = await idbGetById(storeName, item.id);

              // Handle cloud deletions
              if (localItem && !localItem.is_deleted && item.is_deleted === 1) {
                console.log(`[Storage] Cloud delete for ${storeName} ${item.id} - applying`);
                await idbPut(storeName, { 
                  ...localItem, 
                  is_deleted: 1, 
                  deleted_at: item.deleted_at || new Date().toISOString() 
                }, true);
                storeSynced++;
                continue;
              }

              // Compare timestamps
              const cloudTime = new Date(item.updated_at || item.created_at || item._localUpdatedAt || 0).getTime();
              const localTime = localItem ? new Date(localItem.updated_at || localItem.created_at || 0).getTime() : 0;

              // If cloud is newer or local doesn't exist, save it
              if (!localItem || cloudTime > localTime) {
                const syncedItem = { 
                  ...item,
                  is_deleted: item.is_deleted === 1 ? 1 : 0,
                  _lastSynced: new Date().toISOString(),
                  _syncSource: 'cloud'
                };

                // ========== DUPLICATE SANITIZATION ==========
                if (storeName === 'product_variants' && syncedItem.sku) {
                  syncedItem.sku = ensureUnique(syncedItem.sku, 'sku');
                }
                if (storeName === 'sales' && syncedItem.invoice_no) {
                  syncedItem.invoice_no = ensureUnique(syncedItem.invoice_no, 'invoice_no');
                }

                try {
                  await idbPut(storeName, syncedItem, true);
                  storeSynced++;
                } catch (saveError) {
                  if (saveError.name === 'ConstraintError' || saveError.message?.includes('ConstraintError')) {
                    console.warn(`⚠️ ConstraintError for ${storeName} ${item.id}, retrying with modified key...`);

                    // Emergency fallback
                    if (storeName === 'product_variants' && syncedItem.sku) {
                      syncedItem.sku = `${syncedItem.sku}-FIX-${Date.now()}`;
                    } else if (storeName === 'sales' && syncedItem.invoice_no) {
                      syncedItem.invoice_no = `INV-FIX-${Date.now()}`;
                    }

                    try {
                      await idbPut(storeName, syncedItem, true);
                      storeSynced++;
                    } catch (retryErr) {
                      console.error(`❌ Retry failed for ${storeName} ${item.id}:`, retryErr);
                      storeSkipped++;
                    }
                  } else {
                    console.error(`❌ Save error for ${storeName} ${item.id}:`, saveError);
                    storeSkipped++;
                  }
                }
              }
            } catch (itemError) {
              console.error(`❌ Error processing item ${item.id} in ${storeName}:`, itemError);
              storeSkipped++;
            }
          }

          syncedCounts[storeName] = storeSynced;
          totalSynced += storeSynced;
          console.log(`[Storage] Synced ${storeSynced}/${items.length} items to ${storeName} (${storeSkipped} skipped)`);
        } catch (e) {
          console.error(`[Storage] Failed to sync ${storeName}:`, e);
          syncedCounts[storeName] = 0;
        }
      }

      console.log('[Storage] Cloud sync complete. Total synced:', totalSynced);

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
  };

  // ==================== SYNC COLLECTIONS FROM CLOUD (LAZY — NEW) ====================
  // Sirf specific collections sync karo — FAST!
  StorageClass.prototype.syncCollectionsFromCloud = async function(collectionNames, progressCallback = null) {
    console.log(`[Storage] Lazy sync starting for: ${collectionNames.join(', ')}`);
    const syncedCounts = {};
    let totalSynced = 0;

    try {
      // Ensure cloudSync has correct shop ID
      const currentShopId = localStorage.getItem('raath_shop_id');
      if (currentShopId && cloudSync.getShopId() !== currentShopId) {
        cloudSync.setShopId(currentShopId);
      }

      // 🔥 Call cloudSync.syncCollections() — returns data directly
      const cloudData = await cloudSync.syncCollections(collectionNames, 'high', progressCallback);

      if (!cloudData || typeof cloudData !== 'object') {
        console.warn('[Storage] Lazy sync returned no data');
        return { success: true, total: 0, counts: {} };
      }

      // Process each collection's data
      for (const [storeName, items] of Object.entries(cloudData)) {
        // Skip error entries
        if (!items || !Array.isArray(items)) {
          if (items && items.error) {
            console.warn(`[Storage] Sync error for ${storeName}:`, items.error);
          }
          continue;
        }

        if (items.length === 0) continue;

        // Reset trackers for duplicate-prone collections
        if (storeName === 'product_variants' || storeName === 'sales') {
          resetDuplicateTrackers();
        }

        let storeSynced = 0;
        let storeSkipped = 0;

        try {
          for (const item of items) {
            if (!item || !item.id) continue;

            try {
              const localItem = await idbGetById(storeName, item.id);

              // Handle cloud deletions
              if (localItem && !localItem.is_deleted && item.is_deleted === 1) {
                console.log(`[Storage] Cloud delete for ${storeName} ${item.id} - applying`);
                await idbPut(storeName, { 
                  ...localItem, 
                  is_deleted: 1, 
                  deleted_at: item.deleted_at || new Date().toISOString() 
                }, true);
                storeSynced++;
                continue;
              }

              // Compare timestamps
              const cloudTime = new Date(item.updated_at || item.created_at || item._localUpdatedAt || 0).getTime();
              const localTime = localItem ? new Date(localItem.updated_at || localItem.created_at || 0).getTime() : 0;

              // If cloud is newer or local doesn't exist, save it
              if (!localItem || cloudTime > localTime) {
                const syncedItem = { 
                  ...item,
                  is_deleted: item.is_deleted === 1 ? 1 : 0,
                  _lastSynced: new Date().toISOString(),
                  _syncSource: 'cloud'
                };

                // Duplicate sanitization
                if (storeName === 'product_variants' && syncedItem.sku) {
                  syncedItem.sku = ensureUnique(syncedItem.sku, 'sku');
                }
                if (storeName === 'sales' && syncedItem.invoice_no) {
                  syncedItem.invoice_no = ensureUnique(syncedItem.invoice_no, 'invoice_no');
                }

                try {
                  await idbPut(storeName, syncedItem, true);
                  storeSynced++;
                } catch (saveError) {
                  if (saveError.name === 'ConstraintError' || saveError.message?.includes('ConstraintError')) {
                    console.warn(`⚠️ ConstraintError for ${storeName} ${item.id}, retrying...`);

                    if (storeName === 'product_variants' && syncedItem.sku) {
                      syncedItem.sku = `${syncedItem.sku}-FIX-${Date.now()}`;
                    } else if (storeName === 'sales' && syncedItem.invoice_no) {
                      syncedItem.invoice_no = `INV-FIX-${Date.now()}`;
                    }

                    try {
                      await idbPut(storeName, syncedItem, true);
                      storeSynced++;
                    } catch (retryErr) {
                      console.error(`❌ Retry failed for ${storeName} ${item.id}:`, retryErr);
                      storeSkipped++;
                    }
                  } else {
                    console.error(`❌ Save error for ${storeName} ${item.id}:`, saveError);
                    storeSkipped++;
                  }
                }
              }
            } catch (itemError) {
              console.error(`❌ Error processing item ${item.id} in ${storeName}:`, itemError);
              storeSkipped++;
            }
          }

          syncedCounts[storeName] = storeSynced;
          totalSynced += storeSynced;
          console.log(`[Storage] Synced ${storeSynced}/${items.length} items to ${storeName} (${storeSkipped} skipped)`);
        } catch (e) {
          console.error(`[Storage] Failed to sync ${storeName}:`, e);
          syncedCounts[storeName] = 0;
        }
      }

      console.log('[Storage] Lazy sync complete. Total synced:', totalSynced);

      try {
        window.dispatchEvent(new CustomEvent('raath_sync_complete', { 
          detail: { total: totalSynced, counts: syncedCounts, mode: 'lazy' } 
        }));
      } catch (e) {}

      return { success: true, total: totalSynced, counts: syncedCounts };
    } catch (error) {
      console.error('[Storage] Lazy sync failed:', error);
      return { success: false, error: error.message, total: 0, counts: {} };
    }
  };

  // ==================== BACKGROUND SYNC ====================
  StorageClass.prototype.startBackgroundSync = async function() {
    console.log('[Storage] Starting background sync...');
    try {
      const currentShopId = localStorage.getItem('raath_shop_id');
      if (currentShopId && cloudSync.getShopId() !== currentShopId) {
        cloudSync.setShopId(currentShopId);
      }

      await cloudSync.syncRemainingInBackground();
      console.log('[Storage] Background sync initiated');
    } catch (e) {
      console.error('[Storage] Background sync failed:', e);
    }
  };

  // ==================== CLEAR SINGLE STORE ====================
  StorageClass.prototype.clearStore = async function(storeName) {
    await ensureIndexedDB();
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const r = store.clear();
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  };

  // ==================== CLEAR ALL DATA ====================
  StorageClass.prototype.clearAllData = async function() {
    const stores = [
      'brands', 'categories', 'products', 'product_variants', 'product_serialized_items',
      'customers', 'suppliers', 'purchases', 'purchase_items', 'purchase_returns', 'purchase_return_items',
      'sales', 'sale_items', 'sale_returns', 'sale_return_items',
      'expense_categories', 'expenses', 'payments',
      'users', 'roles', 'warehouses', 'warehouse_stocks', 'offers', 'offer_items',
      'services', 'staff', 'work_orders', 'emis', 'emi_payments',
      'customer_ledger', 'supplier_ledger', 'general_ledger', 'ledger', 'fbr_invoices',
      'salesmen', 'salesman_sales', 'salesman_sale_items', 'customer_sales_history'
    ];
    for (const store of stores) {
      try { await this.clearStore(store); } catch (e) {}
    }
    localStorage.removeItem('raath_invoice_counter');
    localStorage.removeItem('invoice_counter');
    // Reset lazy sync state
    if (cloudSync && typeof cloudSync.resetLazySync === 'function') {
      cloudSync.resetLazySync();
    }
    console.log('[Storage] All local data cleared');
  };

  // ==================== HEALTH CHECK ====================
  StorageClass.prototype.healthCheck = async function() {
    try {
      if (this.mode === 'electron') {
        await this.electronQuery('SELECT 1');
      } else {
        await idbGetAll('products', 1);
      }
      return { status: 'ok', mode: this.mode };
    } catch (e) {
      return { status: 'error', mode: this.mode, error: e.message };
    }
  };

}