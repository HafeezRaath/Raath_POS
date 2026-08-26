// ============================================================
//  idb-core.js - IndexedDB Core Engine (FIXED)
// ============================================================

import { DB_NAME, DB_VERSION, STORES } from './config.js';
import { generateId, DUPLICATE_TRACKERS, resetDuplicateTrackers } from './utils.js';
import { syncToCloud } from './sync.js';

let idbPromise = null;

// ==================== INIT & UPGRADE ====================
export function initIndexedDB() {
  if (idbPromise) return idbPromise;
  idbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      STORES.forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: false });
          
          if (storeName === 'product_variants') {
            store.createIndex('sku', 'sku', { unique: true });
            store.createIndex('product_id', 'product_id', { unique: false });
          }
          if (storeName === 'sales') {
            store.createIndex('invoice_no', 'invoice_no', { unique: true });
            store.createIndex('customer_id', 'customer_id', { unique: false });
            store.createIndex('date', 'date', { unique: false });
          }
          if (storeName === 'fbr_invoices') {
            store.createIndex('sale_id', 'sale_id', { unique: false });
            store.createIndex('fbr_status', 'fbr_status', { unique: false });
          }
          if (storeName === 'salesmen') {
            store.createIndex('status', 'status', { unique: false });
            store.createIndex('name', 'name', { unique: false });
          }
          if (storeName === 'salesman_sales') {
            store.createIndex('salesman_id', 'salesman_id', { unique: false });
            store.createIndex('customer_id', 'customer_id', { unique: false });
            store.createIndex('sale_date', 'sale_date', { unique: false });
          }
          if (storeName === 'customer_sales_history') {
            store.createIndex('customer_id', 'customer_id', { unique: false });
            store.createIndex('sale_id', 'sale_id', { unique: false });
          }
          console.log(`[IndexedDB] Created store: ${storeName}`);
        }
      });
    };
  });
  return idbPromise;
}

export async function ensureIndexedDB() {
  try {
    const db = await initIndexedDB();
    const missingStores = STORES.filter(s => !db.objectStoreNames.contains(s));
    
    if (missingStores.length > 0) {
      console.warn('[IndexedDB] Missing stores:', missingStores);
      db.close();
      
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION + 1);
        req.onupgradeneeded = (event) => {
          const newDb = event.target.result;
          STORES.forEach(storeName => {
            if (!newDb.objectStoreNames.contains(storeName)) {
              const store = newDb.createObjectStore(storeName, { keyPath: 'id', autoIncrement: false });
              
              if (storeName === 'product_variants') {
                store.createIndex('sku', 'sku', { unique: true });
              }
              if (storeName === 'sales') {
                store.createIndex('invoice_no', 'invoice_no', { unique: true });
              }
              if (storeName === 'fbr_invoices') {
                store.createIndex('sale_id', 'sale_id', { unique: false });
                store.createIndex('fbr_status', 'fbr_status', { unique: false });
              }
              if (storeName === 'salesmen') {
                store.createIndex('status', 'status', { unique: false });
              }
              if (storeName === 'salesman_sales') {
                store.createIndex('salesman_id', 'salesman_id', { unique: false });
                store.createIndex('sale_date', 'sale_date', { unique: false });
              }
              console.log(`[IndexedDB] Created missing store: ${storeName}`);
            }
          });
        };
        req.onsuccess = () => {
          idbPromise = null;
          resolve(req.result);
        };
        req.onerror = () => reject(req.error);
      });
    }
    return db;
  } catch (e) {
    console.error('[IndexedDB] Failed to ensure DB:', e);
    throw e;
  }
}

// ==================== DUPLICATE PRELOAD ====================
export async function preloadExistingKeys(storeName) {
  try {
    const existing = await idbGetAll(storeName);
    existing.forEach(item => {
      if (storeName === 'product_variants' && item.sku) {
        DUPLICATE_TRACKERS.sku.add(String(item.sku).trim());
      }
      if (storeName === 'sales' && item.invoice_no) {
        DUPLICATE_TRACKERS.invoice_no.add(String(item.invoice_no).trim());
      }
    });
  } catch (e) {
    // Table empty ho toh koi masla nahi
  }
}

// ==================== CRUD HELPERS ====================
export async function idbGetAll(storeName, limit = null, retries = 3) {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      await ensureIndexedDB();
      const db = await initIndexedDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        let request;
        if (limit) {
          request = store.getAll(null, limit);
        } else {
          request = store.getAll();
        }
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      lastError = err;
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)));
      }
    }
  }
  throw lastError;
}

export async function idbGetById(storeName, id, retries = 3) {
  if (id === undefined || id === null || id === '') {
    return null;
  }
  
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      await ensureIndexedDB();
      const db = await initIndexedDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        
        const idsToTry = [id, String(id)];
        if (!isNaN(Number(id))) {
          idsToTry.push(Number(id));
        }
        
        let found = false;
        let tried = 0;
        
        const tryGet = () => {
          if (tried >= idsToTry.length || found) return;
          const currentId = idsToTry[tried++];
          const request = store.get(currentId);
          request.onsuccess = () => {
            if (request.result) {
              found = true;
              resolve(request.result);
            } else {
              tryGet();
            }
          };
          request.onerror = () => {
            if (!found) tryGet();
          };
        };
        
        tx.oncomplete = () => {
          if (!found) resolve(null);
        };
        tx.onerror = () => reject(tx.error);
        
        tryGet();
      });
    } catch (err) {
      lastError = err;
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)));
      }
    }
  }
  throw lastError;
}

export async function idbAdd(storeName, data, skipSync = false) {
  await ensureIndexedDB();
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    
    const cleanData = { ...data };
    if (cleanData.id === undefined || cleanData.id === null) {
      cleanData.id = generateId();
    }
    
    const r = store.add(cleanData);
    r.onsuccess = () => {
      if (!skipSync) {
        syncToCloud(storeName, cleanData, 'push');
      }
      resolve({ lastInsertRowid: cleanData.id, changes: 1 });
    };
    r.onerror = () => {
      console.error(`[idbAdd] Failed to add to ${storeName}:`, r.error);
      reject(r.error);
    };
  });
}

// ============================================================
//  🔥 FIXED idbPut - Handles ConstraintError gracefully
// ============================================================

export async function idbPut(storeName, data, skipSync = false) {
  await ensureIndexedDB();
  
  if (!data) {
    return Promise.reject(new Error(`Cannot put into ${storeName}: data is undefined`));
  }
  
  // Ensure ID exists
  if (data.id === undefined || data.id === null) {
    data = { ...data, id: generateId() };
  }
  
  const db = await initIndexedDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    
    // 🔥 Step 1: Try to get existing record first
    const getRequest = store.get(data.id);
    
    getRequest.onsuccess = () => {
      const existing = getRequest.result;
      
      // 🔥 Step 2: If exists, UPDATE it
      if (existing) {
        // Merge data (keep existing fields if not in new data)
        const mergedData = { ...existing, ...data };
        
        const putRequest = store.put(mergedData);
        putRequest.onsuccess = () => {
          if (!skipSync) {
            syncToCloud(storeName, mergedData, 'push');
          }
          console.log(`[idbPut] ✅ Updated ${storeName} ${data.id}`);
          resolve({ lastInsertRowid: mergedData.id, changes: 1 });
        };
        putRequest.onerror = (e) => {
          console.error(`[idbPut] ❌ Put error for ${storeName} ${data.id}:`, e.target.error);
          reject(e.target.error);
        };
        return;
      }
      
      // 🔥 Step 3: If doesn't exist, ADD it
      const addRequest = store.add(data);
      addRequest.onsuccess = () => {
        if (!skipSync) {
          syncToCloud(storeName, data, 'push');
        }
        console.log(`[idbPut] ✅ Added ${storeName} ${data.id}`);
        resolve({ lastInsertRowid: data.id, changes: 1 });
      };
      addRequest.onerror = (e) => {
        // 🔥 Step 4: If ConstraintError, try PUT as fallback
        if (e.target.error.name === 'ConstraintError') {
          console.warn(`[idbPut] ⚠️ ConstraintError for ${storeName} ${data.id}, using put fallback...`);
          
          // Handle duplicate SKU/Invoice
          let fixedData = { ...data };
          
          if (storeName === 'product_variants' && data.sku) {
            // Generate unique SKU
            fixedData.sku = `${data.sku}-${Date.now()}`;
            console.log(`[idbPut] 🔄 Modified SKU to: ${fixedData.sku}`);
          }
          if (storeName === 'sales' && data.invoice_no) {
            // Generate unique invoice
            fixedData.invoice_no = `INV-${Date.now()}`;
            console.log(`[idbPut] 🔄 Modified Invoice to: ${fixedData.invoice_no}`);
          }
          
          // Try with modified data
          const retryPut = store.put(fixedData);
          retryPut.onsuccess = () => {
            if (!skipSync) {
              syncToCloud(storeName, fixedData, 'push');
            }
            console.log(`[idbPut] ✅ Retry succeeded for ${storeName} ${fixedData.id}`);
            resolve({ lastInsertRowid: fixedData.id, changes: 1 });
          };
          retryPut.onerror = (err) => {
            console.error(`[idbPut] ❌ Retry failed for ${storeName} ${data.id}:`, err.target.error);
            reject(err.target.error);
          };
        } else {
          console.error(`[idbPut] ❌ Add error for ${storeName} ${data.id}:`, e.target.error);
          reject(e.target.error);
        }
      };
    };
    
    getRequest.onerror = (e) => {
      // If get fails, try direct put
      console.warn(`[idbPut] ⚠️ Get failed for ${storeName} ${data.id}, trying direct put...`);
      const putRequest = store.put(data);
      putRequest.onsuccess = () => {
        if (!skipSync) {
          syncToCloud(storeName, data, 'push');
        }
        resolve({ lastInsertRowid: data.id, changes: 1 });
      };
      putRequest.onerror = (err) => reject(err.target.error);
    };
    
    tx.onerror = (e) => {
      console.error(`[idbPut] ❌ Transaction error:`, e.target.error);
      reject(e.target.error);
    };
  });
}

export async function idbDelete(storeName, id, skipSync = false) {
  await ensureIndexedDB();
  const record = await idbGetById(storeName, id);
  if (!record) return { changes: 0 };

  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const r = store.delete(record.id);
    r.onsuccess = () => {
      if (!skipSync) {
        syncToCloud(storeName, { id: record.id }, 'remove');
      }
      resolve({ changes: 1 });
    };
    r.onerror = () => reject(r.error);
  });
}

// ==================== ATOMIC TRANSACTION ====================
export async function idbTransaction(stores, callback) {
  await ensureIndexedDB();
  const db = await initIndexedDB();
  const tx = db.transaction(stores, 'readwrite');
  let result;
  
  try {
    result = await callback(tx);
  } catch (error) {
    try { tx.abort(); } catch (e) {}
    throw error;
  }
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}