// ============================================================
//  storage.js - Universal Storage for RAATH POS (FINAL FIX)
//  Electron: SQLite via IPC | Web Demo: IndexedDB
// ============================================================
import { cloudSync } from '../cloudSync';

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

// ==================== SYNC CONTROLLER ====================
// ✅ Electron mein sync OFF, Browser mein sync ON
const SYNC_ENABLED = !isElectron;

console.log(`[Storage] Mode: ${isElectron ? 'ELECTRON' : 'BROWSER'}`);
console.log(`[Storage] Cloud Sync: ${SYNC_ENABLED ? 'ENABLED ✅' : 'DISABLED ❌'}`);

// ==================== SMART SYNC WRAPPER ====================
async function syncToCloud(collection, data, operation = 'push') {
  if (!SYNC_ENABLED) {
    // Electron mode - skip sync completely
    return;
  }

  if (!data || !data.id) {
    console.warn(`[Storage] Sync skipped - no id in data`);
    return;
  }

  try {
    if (operation === 'push') {
      await cloudSync.push(collection, data);
    } else if (operation === 'remove') {
      await cloudSync.remove(collection, data.id || data);
    }
  } catch (e) {
    console.error(`[Storage] Cloud sync failed for ${collection}:`, e);
  }
}

// ==================== INDEXEDDB SETUP (Browser Mode) ====================
const DB_NAME = 'RAATH_POS_DEMO';
const DB_VERSION = 8;

const STORES = [
  'brands', 'categories', 'products', 'product_variants', 'product_serialized_items',
  'suppliers', 'purchases', 'purchase_items', 'customers', 'sales', 'sale_items',
  'sale_returns', 'sale_return_items', 'expense_categories', 'expenses',
  'customer_ledger', 'supplier_ledger', 'payments', 'general_ledger', 'emis', 'emi_payments',
  'users', 'roles', 'warehouses', 'warehouse_stocks', 'offers', 'offer_items',
  'services', 'staff', 'work_orders'
];

let idbPromise = null;

function initIndexedDB() {
  if (idbPromise) return idbPromise;
  idbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      STORES.forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: false });
          console.log(`[IndexedDB] Created store: ${storeName}`);
        }
      });
    };
  });
  return idbPromise;
}

async function ensureIndexedDB() {
  try {
    const db = await initIndexedDB();
    const missingStores = STORES.filter(s => !db.objectStoreNames.contains(s));
    if (missingStores.length > 0) {
      console.warn('[IndexedDB] Missing stores:', missingStores);
      db.close();
      await new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = resolve;
        req.onerror = reject;
      });
      idbPromise = null;
      await initIndexedDB();
      console.log('[IndexedDB] Database recreated with all stores');
    }
    return db;
  } catch (e) {
    console.error('[IndexedDB] Failed to ensure DB:', e);
    throw e;
  }
}

async function idbGetAll(storeName) {
  await ensureIndexedDB();
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const r = store.getAll();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  });
}

async function idbGetById(storeName, id) {
  await ensureIndexedDB();
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);

    let found = false;
    const check = (result) => {
      if (!found && result !== undefined) {
        found = true;
        resolve(result);
      }
    };

    const r1 = store.get(id);
    r1.onsuccess = () => check(r1.result);

    const r2 = store.get(String(id));
    r2.onsuccess = () => check(r2.result);

    const numId = Number(id);
    if (!isNaN(numId)) {
      const r3 = store.get(numId);
      r3.onsuccess = () => check(r3.result);
    }

    tx.oncomplete = () => {
      if (!found) resolve(null);
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function idbAdd(storeName, data) {
  await ensureIndexedDB();
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const cleanData = { ...data };
    if (cleanData.id === undefined || cleanData.id === null) {
      cleanData.id = String(Date.now() + Math.floor(Math.random() * 10000));
    } else {
      cleanData.id = String(cleanData.id);
    }
    const r = store.add(cleanData);
    r.onsuccess = () => {
      syncToCloud(storeName, cleanData, 'push');
      resolve({ lastInsertRowid: cleanData.id, changes: 1 });
    };
    r.onerror = () => reject(r.error);
  });
}

async function idbPut(storeName, data) {
  await ensureIndexedDB();
  if (!data || data.id === undefined || data.id === null) {
    return Promise.reject(new Error(`Cannot put into ${storeName}: object is missing 'id' property.`));
  }
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const r = store.put(data);
    r.onsuccess = () => {
      syncToCloud(storeName, data, 'push');
      resolve({ lastInsertRowid: data.id, changes: 1 });
    };
    r.onerror = () => reject(r.error);
  });
}

async function idbDelete(storeName, id) {
  await ensureIndexedDB();
  const record = await idbGetById(storeName, id);
  if (!record) return { changes: 0 };

  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const r = store.delete(record.id);
    r.onsuccess = () => {
      syncToCloud(storeName, record.id, 'remove');
      resolve({ changes: 1 });
    };
    r.onerror = () => reject(r.error);
  });
}

// ==================== STORAGE CLASS ====================
class Storage {
  constructor() {
    this.mode = this.detectMode();
    this.syncEnabled = SYNC_ENABLED;
    this._dbMutex = Promise.resolve();
    
    console.log(`[Storage] Initialized - Mode: ${this.mode}, Sync: ${this.syncEnabled ? 'ON ✅' : 'OFF ❌'}`);
  }

  safeAdd(a, b) { return parseFloat((parseFloat(a || 0) + parseFloat(b || 0)).toFixed(4)); }
  safeSub(a, b) { return parseFloat((parseFloat(a || 0) - parseFloat(b || 0)).toFixed(4)); }
  safeMul(a, b) { return parseFloat((parseFloat(a || 0) * parseFloat(b || 0)).toFixed(4)); }
  _sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  async _withMutex(fn) {
    const oldMutex = this._dbMutex;
    let release;
    const newMutex = new Promise(resolve => { release = resolve; });
    this._dbMutex = oldMutex.then(() => newMutex).catch(() => newMutex);
    await oldMutex.catch(() => {});
    try { return await fn(); } finally { release(); }
  }

  detectMode() {
    if (typeof window !== 'undefined' && window.electronAPI) {
      console.log('[Storage] ✅ Electron API found - Local SQLite mode');
      return 'electron';
    }
    console.log('[Storage] 🌐 Browser mode - IndexedDB + Cloud Sync');
    return 'browser';
  }

  async query(sql, params = []) { return this.electronQuery(sql, params); }

  async electronQuery(sql, params = [], retries = 5) {
    return this._withMutex(async () => {
      let lastError;
      for (let i = 0; i < retries; i++) {
        try {
          if (!window.electronAPI || !window.electronAPI.dbQuery) {
            throw new Error('Electron API not available');
          }
          return await window.electronAPI.dbQuery(sql, params);
        } catch (error) {
          lastError = error;
          if (error.message && error.message.includes('SQLITE_BUSY')) {
            await this._sleep(50 * Math.pow(2, i) + Math.random() * 50);
            continue;
          }
          throw error;
        }
      }
      throw lastError;
    });
  }

  // ==================== BRANDS ====================
  async getBrands() { 
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT * FROM brands WHERE is_deleted = 0 ORDER BY name");
    }
    return idbGetAll('brands').then(r => r.filter(x => !x.is_deleted));
  }
  
  async getBrandById(id) { 
    if (this.mode === 'electron') { 
      const r = await this.electronQuery("SELECT * FROM brands WHERE id = ?", [id]);
      return r[0] || null;
    }
    return idbGetById('brands', id);
  }
  
  async createBrand(data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("INSERT INTO brands (name, status) VALUES (?, ?)", [data.name, data.status || 'active']);
      if (SYNC_ENABLED) {
        syncToCloud('brands', { ...data, id: _res.lastInsertRowid, is_deleted: 0 });
      }
      return _res;
    }
    return idbAdd('brands', { ...data, is_deleted: 0 });
  }
  
  async updateBrand(id, data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE brands SET name = ?, status = ? WHERE id = ?", [data.name, data.status, id]);
      if (SYNC_ENABLED) {
        syncToCloud('brands', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('brands', id);
    if (!e) return { changes: 0 };
    return idbPut('brands', { ...e, ...data, id: e.id });
  }
  
  async deleteBrand(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE brands SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        syncToCloud('brands', { id, is_deleted: 1, deleted_at: new Date().toISOString() });
      }
      return _res;
    }
    const e = await idbGetById('brands', id);
    if (!e) return { changes: 0 };
    return idbPut('brands', { ...e, is_deleted: 1, id: e.id });
  }

  // ==================== CATEGORIES ====================
  async getCategories() {
    if (this.mode === 'electron') {
      return this.electronQuery(`SELECT c1.*, c2.name as parent_name FROM categories c1 LEFT JOIN categories c2 ON c1.parent_id = c2.id WHERE c1.is_deleted = 0 ORDER BY c1.name`);
    }
    const cats = await idbGetAll('categories');
    return cats.filter(x => !x.is_deleted).map(c => ({ ...c, parent_name: cats.find(p => p.id === c.parent_id)?.name || '' }));
  }
  
  async getCategoryById(id) { 
    if (this.mode === 'electron') { 
      const r = await this.electronQuery("SELECT * FROM categories WHERE id = ?", [id]);
      return r[0] || null;
    }
    return idbGetById('categories', id);
  }
  
  async createCategory(data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("INSERT INTO categories (name, slug, parent_id, status) VALUES (?, ?, ?, ?)", [data.name, data.slug, data.parent_id || null, data.status || 'active']);
      if (SYNC_ENABLED) {
        syncToCloud('categories', { ...data, id: _res.lastInsertRowid, is_deleted: 0 });
      }
      return _res;
    }
    return idbAdd('categories', { ...data, is_deleted: 0 });
  }
  
  async updateCategory(id, data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE categories SET name = ?, slug = ?, parent_id = ?, status = ? WHERE id = ?", [data.name, data.slug, data.parent_id, data.status, id]);
      if (SYNC_ENABLED) {
        syncToCloud('categories', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('categories', id);
    if (!e) return { changes: 0 };
    return idbPut('categories', { ...e, ...data, id: e.id });
  }
  
  async deleteCategory(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE categories SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        syncToCloud('categories', { id, is_deleted: 1, deleted_at: new Date().toISOString() });
      }
      return _res;
    }
    const e = await idbGetById('categories', id);
    if (!e) return { changes: 0 };
    return idbPut('categories', { ...e, is_deleted: 1, id: e.id });
  }

  // ==================== PRODUCTS & VARIANTS ====================
  async getProducts() {
    if (this.mode === 'electron') {
      return this.electronQuery(`SELECT p.*, b.name as brand_name, c.name as category_name FROM products p LEFT JOIN brands b ON p.brand_id = b.id LEFT JOIN categories c ON p.category_id = c.id WHERE p.is_deleted = 0 ORDER BY p.id DESC`);
    }
    const [p, b, c] = await Promise.all([idbGetAll('products'), idbGetAll('brands'), idbGetAll('categories')]);
    return p.filter(x => !x.is_deleted).map(item => ({ ...item, brand_name: b.find(x => x.id === item.brand_id)?.name || '', category_name: c.find(x => x.id === item.category_id)?.name || '' }));
  }
  
  async getAllVariants() {
    if (this.mode === 'electron') {
      return this.electronQuery(`SELECT pv.*, p.name as product_name, p.type as product_type, p.category_id, c.name as category_name FROM product_variants pv JOIN products p ON pv.product_id = p.id LEFT JOIN categories c ON p.category_id = c.id WHERE pv.is_deleted = 0 AND p.is_deleted = 0 ORDER BY p.id DESC`);
    }
    const [v, p, c] = await Promise.all([idbGetAll('product_variants'), idbGetAll('products'), idbGetAll('categories')]);
    return v.filter(x => !x.is_deleted).map(item => { const parent = p.find(x => x.id === item.product_id); return { ...item, product_name: parent?.name || '', product_type: parent?.type || 'single', category_id: parent?.category_id || null, category_name: c.find(x => x.id === parent?.category_id)?.name || '' }; });
  }
  
  async getProductVariants(productId = null) {
    if (this.mode === 'electron') {
      let sql = `SELECT pv.*, p.name as product_name, p.type as product_type, p.category_id FROM product_variants pv JOIN products p ON pv.product_id = p.id WHERE pv.is_deleted = 0`;
      return productId ? this.electronQuery(sql + " AND pv.product_id = ?", [productId]) : this.electronQuery(sql);
    }
    const [v, p] = await Promise.all([idbGetAll('product_variants'), idbGetAll('products')]);
    let res = v.filter(x => !x.is_deleted);
    if (productId) res = res.filter(x => x.product_id === Number(productId));
    return res.map(item => { const parent = p.find(x => x.id === item.product_id); return { ...item, product_name: parent?.name || '', product_type: parent?.type || 'single', category_id: parent?.category_id || null }; });
  }
  
  async getProductById(id) { 
    if (this.mode === 'electron') { 
      const r = await this.electronQuery("SELECT * FROM products WHERE id = ?", [id]);
      return r[0] || null;
    }
    return idbGetById('products', id);
  }
  
  async getVariantBySKU(sku) {
    const cleanSku = String(sku || '').trim();
    if (!cleanSku) return null;
    if (this.mode === 'electron') {
      const rows = await this.electronQuery("SELECT * FROM product_variants WHERE LOWER(sku) = LOWER(?) AND is_deleted = 0 LIMIT 1", [cleanSku]);
      return rows[0] || null;
    }
    return idbGetAll('product_variants').then(res => res.find(v => v.sku?.toLowerCase() === cleanSku.toLowerCase() && !v.is_deleted) || null);
  }
  
  async addProduct(data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`INSERT INTO products (name, brand_id, category_id, type, unit, tax_type, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [data.name, data.brand_id, data.category_id, data.type, data.unit, data.tax_type, data.description, data.status]);
      if (SYNC_ENABLED) {
        syncToCloud('products', { ...data, id: _res.lastInsertRowid, is_deleted: 0 });
      }
      return _res;
    }
    return idbAdd('products', { ...data, is_deleted: 0 });
  }
  
  async createVariant(data) {
    const cleanSku = String(data.sku || '').trim();
    if (!cleanSku) throw new Error('SKU required');
    if (this.mode === 'electron') {
      const existing = await this.electronQuery("SELECT id FROM product_variants WHERE LOWER(sku) = LOWER(?) AND is_deleted = 0", [cleanSku]);
      if (existing.length > 0) {
        await this.electronQuery("UPDATE product_variants SET current_stock = current_stock + ? WHERE id = ?", [Number(data.current_stock || 0), existing[0].id]);
        if (SYNC_ENABLED) {
          syncToCloud('product_variants', { id: existing[0].id, current_stock: Number(data.current_stock || 0), merged: true });
        }
        return { lastInsertRowid: existing[0].id, changes: 1, merged: true };
      }
      const _res = await this.electronQuery(`INSERT INTO product_variants (product_id, sku, barcode, variant_name, purchase_price, retail_price, wholesale_price, minimum_retail_price, stock_alert_quantity, current_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [data.product_id, cleanSku, data.barcode, data.variant_name || 'Default', data.purchase_price || 0, data.retail_price || 0, data.wholesale_price || 0, data.minimum_retail_price || 0, data.stock_alert_quantity || 5, data.current_stock || 0]);
      if (SYNC_ENABLED) {
        syncToCloud('product_variants', { ...data, sku: cleanSku, id: _res.lastInsertRowid, is_deleted: 0 });
      }
      return _res;
    }
    return idbAdd('product_variants', { ...data, sku: cleanSku, is_deleted: 0 });
  }

  async addVariant(data) { return this.createVariant(data); }
  
  async updateProduct(id, data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`UPDATE products SET name = ?, brand_id = ?, category_id = ?, type = ?, unit = ?, tax_type = ?, description = ?, status = ? WHERE id = ?`, [data.name, data.brand_id, data.category_id, data.type, data.unit, data.tax_type, data.description, data.status, id]);
      if (SYNC_ENABLED) {
        syncToCloud('products', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('products', id);
    if (!e) return { changes: 0 };
    return idbPut('products', { ...e, ...data, id: e.id });
  }
  
  async updateVariant(id, data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`UPDATE product_variants SET sku = ?, barcode = ?, variant_name = ?, purchase_price = ?, retail_price = ?, wholesale_price = ?, minimum_retail_price = ?, stock_alert_quantity = ?, current_stock = ? WHERE id = ?`, [data.sku, data.barcode, data.variant_name, data.purchase_price, data.retail_price, data.wholesale_price, data.minimum_retail_price, data.stock_alert_quantity, data.current_stock, id]);
      if (SYNC_ENABLED) {
        syncToCloud('product_variants', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('product_variants', id);
    if (!e) return { changes: 0 };
    return idbPut('product_variants', { ...e, ...data, id: e.id });
  }
  
  async updateVariantStock(id, qty) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE product_variants SET current_stock = current_stock + ? WHERE id = ?", [qty, id]);
      if (SYNC_ENABLED) {
        syncToCloud('product_variants', { id, current_stock: qty });
      }
      return _res;
    }
    const v = await idbGetById('product_variants', id);
    if (!v) return { success: false };
    v.current_stock = this.safeAdd(v.current_stock, qty);
    await idbPut('product_variants', { ...v, id: v.id });
    return { success: true };
  }
  
  async deleteVariant(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE product_variants SET is_deleted = 1 WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        syncToCloud('product_variants', { id, is_deleted: 1 });
      }
      return _res;
    }
    const v = await idbGetById('product_variants', id);
    if (!v) return { changes: 0 };
    v.is_deleted = 1;
    await idbPut('product_variants', { ...v, id: v.id });
  }
  
  async deleteProduct(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE products SET is_deleted = 1 WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        syncToCloud('products', { id, is_deleted: 1 });
      }
      return _res;
    }
    const p = await idbGetById('products', id);
    if (!p) return { changes: 0 };
    p.is_deleted = 1;
    await idbPut('products', { ...p, id: p.id });
  }

  // ==================== CUSTOMERS ====================
  async getCustomers() { 
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT * FROM customers WHERE is_deleted = 0 ORDER BY name");
    }
    return idbGetAll('customers').then(r => r.filter(x => !x.is_deleted));
  }
  
  async getCustomerById(id) { 
    if (this.mode === 'electron') { 
      const r = await this.electronQuery("SELECT * FROM customers WHERE id = ?", [id]);
      return r[0] || null;
    }
    return idbGetById('customers', id);
  }
  
  async createCustomer(data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`INSERT INTO customers (name, phone, email, cnic, shop_name, customer_type, opening_balance, current_balance, credit_limit, payment_terms, status, district, province, notes, reference_name, reference_phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [data.name, data.phone, data.email, data.cnic, data.shop_name, data.customer_type || 'retail', data.opening_balance || 0, data.opening_balance || 0, data.credit_limit || 0, data.payment_terms || 'cash', data.status || 'active', data.district, data.province, data.notes, data.reference_name, data.reference_phone]);
      if (SYNC_ENABLED) {
        syncToCloud('customers', { ...data, id: _res.lastInsertRowid, is_deleted: 0 });
      }
      return _res;
    }
    return idbAdd('customers', { ...data, is_deleted: 0 });
  }
  
  async updateCustomer(id, data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`UPDATE customers SET name = ?, phone = ?, email = ?, cnic = ?, shop_name = ?, customer_type = ?, credit_limit = ?, payment_terms = ?, status = ?, district = ?, province = ?, notes = ?, reference_name = ?, reference_phone = ?, current_balance = ? WHERE id = ?`, [data.name, data.phone, data.email, data.cnic, data.shop_name, data.customer_type, data.credit_limit, data.payment_terms, data.status, data.district, data.province, data.notes, data.reference_name, data.reference_phone, data.current_balance, id]);
      if (SYNC_ENABLED) {
        syncToCloud('customers', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('customers', id);
    if (!e) return { changes: 0 };
    return idbPut('customers', { ...e, ...data, id: e.id });
  }
  
  async deleteCustomer(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE customers SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        syncToCloud('customers', { id, is_deleted: 1, deleted_at: new Date().toISOString() });
      }
      return _res;
    }
    const e = await idbGetById('customers', id);
    if (!e) return { changes: 0 };
    return idbPut('customers', { ...e, is_deleted: 1, id: e.id });
  }
  
  async getCustomerLedger(customerId) { 
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT * FROM customer_ledger WHERE customer_id = ? ORDER BY id DESC", [customerId]);
    }
    return idbGetAll('customer_ledger').then(r => r.filter(x => x.customer_id === Number(customerId)));
  }
  
  async addCustomerLedgerEntry(data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`INSERT INTO customer_ledger (customer_id, type, amount, balance_after, description, payment_mode, reference_no, sale_id, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`, [data.customer_id, data.type, data.amount, data.balance_after || 0, data.description, data.payment_mode, data.reference_no, data.sale_id]);
      if (SYNC_ENABLED) {
        syncToCloud('customer_ledger', { ...data, id: _res.lastInsertRowid });
      }
      return _res;
    }
    return idbAdd('customer_ledger', data);
  }

  // ==================== SUPPLIERS ====================
  async getSuppliers() { 
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT * FROM suppliers WHERE is_deleted = 0 ORDER BY name");
    }
    return idbGetAll('suppliers').then(r => r.filter(x => !x.is_deleted));
  }
  
  async getSupplierById(id) { 
    if (this.mode === 'electron') { 
      const r = await this.electronQuery("SELECT * FROM suppliers WHERE id = ?", [id]);
      return r[0] || null;
    }
    return idbGetById('suppliers', id);
  }
  
  async createSupplier(data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`INSERT INTO suppliers (name, company_name, phone, email, vat_ntn_number, address, opening_balance, current_balance, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [data.name, data.company_name, data.phone, data.email, data.vat_ntn_number, data.address, data.opening_balance, data.current_balance, data.status]);
      if (SYNC_ENABLED) {
        syncToCloud('suppliers', { ...data, id: _res.lastInsertRowid, is_deleted: 0 });
      }
      return _res;
    }
    return idbAdd('suppliers', { ...data, is_deleted: 0 });
  }
  
  async updateSupplier(id, data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`UPDATE suppliers SET name = ?, company_name = ?, phone = ?, email = ?, vat_ntn_number = ?, address = ?, status = ? WHERE id = ?`, [data.name, data.company_name, data.phone, data.email, data.vat_ntn_number, data.address, data.status, id]);
      if (SYNC_ENABLED) {
        syncToCloud('suppliers', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('suppliers', id);
    if (!e) return { changes: 0 };
    return idbPut('suppliers', { ...e, ...data, id: e.id });
  }
  
  async deleteSupplier(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE suppliers SET is_deleted = 1 WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        syncToCloud('suppliers', { id, is_deleted: 1 });
      }
      return _res;
    }
    const e = await idbGetById('suppliers', id);
    if (!e) return { changes: 0 };
    return idbPut('suppliers', { ...e, is_deleted: 1, id: e.id });
  }
  
  async updateSupplierBalance(id, amt) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE suppliers SET current_balance = current_balance + ? WHERE id = ?", [amt, id]);
      if (SYNC_ENABLED) {
        syncToCloud('suppliers', { id, balance_delta: amt });
      }
      return _res;
    }
  }

  // ==================== PURCHASES ====================
  async getPurchases() { 
    if (this.mode === 'electron') {
      return this.electronQuery(`SELECT p.*, s.name as supplier_name, s.company_name as supplier_company FROM purchases p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.is_deleted = 0 ORDER BY p.id DESC`);
    }
    return idbGetAll('purchases').then(r => r.filter(x => !x.is_deleted));
  }
  
  async getPurchaseById(id) { 
    if (this.mode === 'electron') { 
      const r = await this.electronQuery("SELECT p.*, s.name as supplier_name FROM purchases p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.id = ?", [id]);
      return r[0] || null;
    }
    return idbGetById('purchases', id);
  }
  
  async getPurchaseItems(purchaseId) { 
    if (this.mode === 'electron') {
      return this.electronQuery(`SELECT pi.*, pv.sku, pv.variant_name, p.name as product_name FROM purchase_items pi JOIN product_variants pv ON pi.product_variant_id = pv.id JOIN products p ON pv.product_id = p.id WHERE pi.purchase_id = ?`, [purchaseId]);
    }
    const [items, variants, prods] = await Promise.all([idbGetAll('purchase_items'), idbGetAll('product_variants'), idbGetAll('products')]);
    return items.filter(x => x.purchase_id === Number(purchaseId)).map(i => { const v = variants.find(x => x.id === i.product_variant_id); return { ...i, sku: v?.sku || '', variant_name: v?.variant_name || '', product_name: prods.find(x => x.id === v?.product_id)?.name || '' }; });
  }
  
  async addPurchase(data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`INSERT INTO purchases (supplier_id, purchase_no, supplier_invoice_no, purchase_date, due_date, status, total_amount, discount_amount, tax_amount, shipping_charges, grand_total, paid_amount, payment_status, notes, payment_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [data.supplier_id, data.purchase_no, data.supplier_invoice_no, data.purchase_date, data.due_date, data.status, data.total_amount, data.discount_amount, data.tax_amount, data.shipping_charges, data.grand_total, data.paid_amount, data.payment_status, data.notes, data.payment_mode]);
      if (SYNC_ENABLED) {
        syncToCloud('purchases', { ...data, id: _res.lastInsertRowid });
      }
      return _res;
    }
    return idbAdd('purchases', data);
  }
  
  async updatePurchase(id, data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`UPDATE purchases SET supplier_id = ?, purchase_no = ?, supplier_invoice_no = ?, purchase_date = ?, due_date = ?, status = ?, total_amount = ?, discount_amount = ?, tax_amount = ?, shipping_charges = ?, grand_total = ?, paid_amount = ?, payment_status = ?, notes = ?, payment_mode = ? WHERE id = ?`, [data.supplier_id, data.purchase_no, data.supplier_invoice_no, data.purchase_date, data.due_date, data.status, data.total_amount, data.discount_amount, data.tax_amount, data.shipping_charges, data.grand_total, data.paid_amount, data.payment_status, data.notes, data.payment_mode, id]);
      if (SYNC_ENABLED) {
        syncToCloud('purchases', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('purchases', id);
    if (!e) return { changes: 0 };
    return idbPut('purchases', { ...e, ...data, id: e.id });
  }
  
  async deletePurchase(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE purchases SET is_deleted = 1 WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        syncToCloud('purchases', { id, is_deleted: 1 });
      }
      return _res;
    }
    const e = await idbGetById('purchases', id);
    if (!e) return { changes: 0 };
    return idbPut('purchases', { ...e, is_deleted: 1, id: e.id });
  }
  
  async addPurchaseItem(data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`INSERT INTO purchase_items (purchase_id, product_variant_id, quantity, purchase_price, tax_percentage, sub_total, expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?)`, [data.purchase_id, data.product_variant_id, data.quantity, data.purchase_price, data.tax_percentage, data.sub_total, data.expiry_date]);
      if (SYNC_ENABLED) {
        syncToCloud('purchase_items', { ...data, id: _res.lastInsertRowid });
      }
      return _res;
    }
    return idbAdd('purchase_items', data);
  }
  
  async getPriceHistory(variantId, limit = 3) { 
    if (this.mode === 'electron') {
      return this.electronQuery(`SELECT pi.purchase_price, p.purchase_date, s.name as supplier_name FROM purchase_items pi JOIN purchases p ON pi.purchase_id = p.id LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE pi.product_variant_id = ? ORDER BY p.id DESC LIMIT ?`, [variantId, limit]);
    }
    return [];
  }

  // ==================== PAYMENTS & LEDGER ====================
  async getPayments() { 
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT p.*, s.name as supplier_name, c.name as customer_name FROM payments p LEFT JOIN suppliers s ON p.supplier_id = s.id LEFT JOIN customers c ON p.customer_id = c.id ORDER BY p.id DESC");
    }
    return idbGetAll('payments');
  }
  
  async addPayment(data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`INSERT INTO payments (supplier_id, customer_id, amount, type, payment_mode, note, date) VALUES (?, ?, ?, ?, ?, ?, ?)`, [data.supplier_id, data.customer_id, data.amount, data.type, data.payment_mode, data.note, data.date]);
      if (SYNC_ENABLED) {
        syncToCloud('payments', { ...data, id: _res.lastInsertRowid });
      }
      return _res;
    }
    return idbAdd('payments', data);
  }
  
  async updatePayment(id, data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE payments SET supplier_id = ?, customer_id = ?, amount = ?, type = ?, payment_mode = ?, note = ?, date = ? WHERE id = ?", [data.supplier_id, data.customer_id, data.amount, data.type, data.payment_mode, data.note, data.date, id]);
      if (SYNC_ENABLED) {
        syncToCloud('payments', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('payments', id);
    if (!e) return { changes: 0 };
    return idbPut('payments', { ...e, ...data, id: e.id });
  }
  
  async deletePayment(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("DELETE FROM payments WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        syncToCloud('payments', id, 'remove');
      }
      return _res;
    }
    return idbDelete('payments', id);
  }
  
  async getLedger() { 
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT l.*, s.name as supplier_name FROM ledger l LEFT JOIN suppliers s ON l.supplier_id = s.id ORDER BY l.id DESC");
    }
    return idbGetAll('ledger');
  }
  
  async addLedgerEntry(data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`INSERT INTO ledger (supplier_id, type, amount, description, date) VALUES (?, ?, ?, ?, ?)`, [data.supplier_id, data.type, data.amount, data.description, data.date]);
      if (SYNC_ENABLED) {
        syncToCloud('ledger', { ...data, id: _res.lastInsertRowid });
      }
      return _res;
    }
    return idbAdd('ledger', data);
  }

  // ==================== SALE ITEMS ====================
  async getSaleItems(saleId) {
    if (this.mode === 'electron') {
      return this.electronQuery(`SELECT si.*, p.name as product_name, pv.sku, pv.variant_name, pv.purchase_price as unit_cost FROM sale_items si JOIN products p ON si.product_id = p.id JOIN product_variants pv ON si.product_variant_id = pv.id WHERE si.sale_id = ? ORDER BY si.id`, [saleId]);
    }
    const [items, variants, prods] = await Promise.all([idbGetAll('sale_items'), idbGetAll('product_variants'), idbGetAll('products')]);
    return items.filter(x => x.sale_id === Number(saleId)).map(i => {
      const v = variants.find(x => x.id === i.product_variant_id);
      const p = prods.find(x => x.id === i.product_id);
      return { ...i, product_name: p?.name || '', sku: v?.sku || '', variant_name: v?.variant_name || '', unit_cost: v?.purchase_price || 0 };
    });
  }

  async getAllSaleItems() {
    if (this.mode === 'electron') {
      return this.electronQuery(`SELECT si.*, p.name as product_name, pv.sku, pv.variant_name, pv.purchase_price as unit_cost FROM sale_items si JOIN products p ON si.product_id = p.id JOIN product_variants pv ON si.product_variant_id = pv.id ORDER BY si.id DESC`);
    }
    const [items, variants, prods] = await Promise.all([idbGetAll('sale_items'), idbGetAll('product_variants'), idbGetAll('products')]);
    return items.map(i => {
      const v = variants.find(x => x.id === i.product_variant_id);
      const p = prods.find(x => x.id === i.product_id);
      return { ...i, product_name: p?.name || '', sku: v?.sku || '', variant_name: v?.variant_name || '', unit_cost: v?.purchase_price || 0 };
    });
  }

  // ==================== SALES ====================
  async getSalesHistory() { 
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT s.*, c.name as customer_name, c.phone as customer_phone FROM sales s LEFT JOIN customers c ON s.customer_id = c.id WHERE s.is_deleted = 0 ORDER BY s.id DESC");
    }
    return idbGetAll('sales').then(r => r.filter(x => !x.is_deleted));
  }
  
  async getSaleById(id) { 
    if (this.mode === 'electron') { 
      const r = await this.electronQuery("SELECT s.*, c.name as customer_name, c.phone as customer_phone FROM sales s LEFT JOIN customers c ON s.customer_id = c.id WHERE s.id = ? AND s.is_deleted = 0", [id]);
      return r[0] || null;
    }
    return idbGetById('sales', id);
  }
  
  async updateSale(id, data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`UPDATE sales SET customer_id = ?, customer_name = ?, subtotal = ?, item_discount = ?, discount = ?, tax = ?, grand_total = ?, paid_amount = ?, due_amount = ?, change_amount = ?, payment_mode = ?, payment_status = ?, sale_type = ? WHERE id = ?`, [data.customer_id, data.customer_name, data.subtotal, data.item_discount, data.discount, data.tax, data.grand_total, data.paid_amount, data.due_amount, data.change_amount, data.payment_mode, data.payment_status, data.sale_type, id]);
      if (SYNC_ENABLED) {
        syncToCloud('sales', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('sales', id);
    if (!e) return { changes: 0 };
    return idbPut('sales', { ...e, ...data, id: e.id });
  }
  
  async deleteSale(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE sales SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        syncToCloud('sales', { id, is_deleted: 1, deleted_at: new Date().toISOString() });
      }
      return _res;
    }
    const e = await idbGetById('sales', id);
    if (!e) return { changes: 0 };
    return idbPut('sales', { ...e, is_deleted: 1, id: e.id });
  }

  // ==================== ATOMIC SALE INSERT ====================
  async createSale(data) {
    if (this.mode === 'electron') {
      const { sale, items } = data;
      const parentSql = `INSERT INTO sales (invoice_no, customer_id, customer_name, subtotal, item_discount, discount, tax, grand_total, paid_amount, due_amount, change_amount, payment_mode, payment_status, sale_type, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const parentParams = [sale.invoice_no, sale.customer_id, sale.customer_name, sale.subtotal, sale.item_discount, sale.discount, sale.tax, sale.grand_total, sale.paid_amount, sale.due_amount, sale.change_amount, sale.payment_mode, sale.payment_status, sale.sale_type, sale.date];
      const parentResult = await this.electronQuery(parentSql, parentParams);
      const insertedSaleId = parentResult.lastInsertRowid;
      
      if (SYNC_ENABLED) {
        syncToCloud('sales', { ...sale, id: insertedSaleId });
      }
      
      const childSql = `INSERT INTO sale_items (sale_id, product_variant_id, product_id, quantity, price, discount, total) VALUES (?, ?, ?, ?, ?, ?, ?)`;
      for (const item of items) {
        const itemRes = await this.electronQuery(childSql, [insertedSaleId, item.product_variant_id, item.product_id, item.quantity, item.price, item.discount, item.total]);
        if (SYNC_ENABLED) {
          syncToCloud('sale_items', { ...item, sale_id: insertedSaleId, id: itemRes.lastInsertRowid });
        }
      }
      
      await this.logToGeneralLedger('revenue', insertedSaleId, 0, sale.grand_total, `Sale ${sale.invoice_no}`);
      if (Number(sale.paid_amount) > 0) {
        const cashAccount = (sale.payment_mode === 'cash' || sale.payment_mode === 'cod') ? 'cash' : 'bank';
        await this.logToGeneralLedger(cashAccount, insertedSaleId, sale.paid_amount, 0, `Cash/Bank received for ${sale.invoice_no}`);
      }
      if (Number(sale.due_amount) > 0) {
        await this.logToGeneralLedger('receivable', insertedSaleId, sale.due_amount, 0, `Receivable for ${sale.invoice_no}`);
      }
      return { id: insertedSaleId, success: true };
    } else {
      const sResult = await idbAdd('sales', data.sale);
      for (const item of data.items) {
        await idbAdd('sale_items', { ...item, sale_id: sResult.lastInsertRowid });
      }
      return { id: sResult.lastInsertRowid, success: true };
    }
  }

  // ==================== SALE RETURNS ====================
  async getSaleReturns() {
    if (this.mode === 'electron') {
      return this.electronQuery(`SELECT sr.*, c.name as customer_name, s.invoice_no as original_invoice FROM sale_returns sr LEFT JOIN customers c ON sr.customer_id = c.id LEFT JOIN sales s ON sr.sale_id = s.id WHERE sr.is_deleted = 0 ORDER BY sr.id DESC`);
    }
    return idbGetAll('sale_returns').then(r => r.filter(x => !x.is_deleted));
  }
  
  async getSaleReturnById(id) { 
    if (this.mode === 'electron') { 
      const r = await this.electronQuery("SELECT sr.*, c.name as customer_name FROM sale_returns sr LEFT JOIN customers c ON sr.customer_id = c.id WHERE sr.id = ?", [id]);
      return r[0] || null;
    }
    return idbGetById('sale_returns', id);
  }
  
  async getSaleReturnItems(saleReturnId) { 
    if (this.mode === 'electron') {
      return this.electronQuery(`SELECT sri.*, pv.sku, p.name as product_name FROM sale_return_items sri JOIN product_variants pv ON sri.product_variant_id = pv.id JOIN products p ON pv.product_id = p.id WHERE sri.sale_return_id = ?`, [saleReturnId]);
    }
    const [items, variants, prods] = await Promise.all([idbGetAll('sale_return_items'), idbGetAll('product_variants'), idbGetAll('products')]);
    return items.filter(x => x.sale_return_id === Number(saleReturnId)).map(i => { const v = variants.find(x => x.id === i.product_variant_id); return { ...i, sku: v?.sku || '', product_name: prods.find(x => x.id === v?.product_id)?.name || '' }; });
  }
  
  async createSaleReturn(data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`INSERT INTO sale_returns (sale_id, invoice_no, return_no, customer_id, return_date, total_amount, discount_amount, tax_amount, refund_amount, payment_mode, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [data.sale_id, data.invoice_no, data.return_no, data.customer_id, data.return_date, data.total_amount, data.discount_amount, data.tax_amount, data.refund_amount, data.payment_mode, data.notes]);
      if (SYNC_ENABLED) {
        syncToCloud('sale_returns', { ...data, id: _res.lastInsertRowid });
      }
      return _res;
    }
    return idbAdd('sale_returns', { ...data, is_deleted: 0 });
  }
  
  async createSaleReturnItem(data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`INSERT INTO sale_return_items (sale_return_id, product_variant_id, quantity, price, sub_total, reason) VALUES (?, ?, ?, ?, ?, ?)`, [data.sale_return_id, data.product_variant_id, data.quantity, data.price, data.sub_total, data.reason]);
      if (SYNC_ENABLED) {
        syncToCloud('sale_return_items', { ...data, id: _res.lastInsertRowid });
      }
      return _res;
    }
    return idbAdd('sale_return_items', data);
  }
  
  async updateSaleReturn(id, data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`UPDATE sale_returns SET sale_id = ?, invoice_no = ?, return_no = ?, customer_id = ?, return_date = ?, total_amount = ?, discount_amount = ?, tax_amount = ?, refund_amount = ?, payment_mode = ?, notes = ? WHERE id = ?`, [data.sale_id, data.invoice_no, data.return_no, data.customer_id, data.return_date, data.total_amount, data.discount_amount, data.tax_amount, data.refund_amount, data.payment_mode, data.notes, id]);
      if (SYNC_ENABLED) {
        syncToCloud('sale_returns', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('sale_returns', id);
    if (!e) return { changes: 0 };
    return idbPut('sale_returns', { ...e, ...data, id: e.id });
  }
  
  async deleteSaleReturn(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE sale_returns SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        syncToCloud('sale_returns', { id, is_deleted: 1, deleted_at: new Date().toISOString() });
      }
      return _res;
    }
    const e = await idbGetById('sale_returns', id);
    if (!e) return { changes: 0 };
    return idbPut('sale_returns', { ...e, is_deleted: 1, id: e.id });
  }

  // ==================== WAREHOUSES ====================
  async getWarehouses() { 
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT * FROM warehouses WHERE is_deleted = 0 ORDER BY name");
    }
    return idbGetAll('warehouses').then(r => r.filter(x => !x.is_deleted));
  }
  
  async getWarehouseById(id) { 
    if (this.mode === 'electron') { 
      const r = await this.electronQuery("SELECT * FROM warehouses WHERE id = ?", [id]);
      return r[0] || null;
    }
    return idbGetById('warehouses', id);
  }
  
  async createWarehouse(data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("INSERT INTO warehouses (name, location, manager_name, phone) VALUES (?, ?, ?, ?)", [data.name, data.location, data.manager_name, data.phone]);
      if (SYNC_ENABLED) {
        syncToCloud('warehouses', { ...data, id: _res.lastInsertRowid, is_deleted: 0 });
      }
      return _res;
    }
    return idbAdd('warehouses', { ...data, is_deleted: 0 });
  }
  
  async updateWarehouse(id, data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE warehouses SET name = ?, location = ?, manager_name = ?, phone = ? WHERE id = ?", [data.name, data.location, data.manager_name, data.phone, id]);
      if (SYNC_ENABLED) {
        syncToCloud('warehouses', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('warehouses', id);
    if (!e) return { changes: 0 };
    return idbPut('warehouses', { ...e, ...data, id: e.id });
  }
  
  async deleteWarehouse(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE warehouses SET is_deleted = 1 WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        syncToCloud('warehouses', { id, is_deleted: 1 });
      }
      return _res;
    }
    const e = await idbGetById('warehouses', id);
    if (!e) return { changes: 0 };
    return idbPut('warehouses', { ...e, is_deleted: 1, id: e.id });
  }
  
  async getWarehouseStocks(warehouseId = null) {
    if (this.mode === 'electron') {
      let sql = `SELECT ws.*, w.name as warehouse_name, pv.sku, p.name as product_name FROM warehouse_stocks ws JOIN warehouses w ON ws.warehouse_id = w.id JOIN product_variants pv ON ws.product_variant_id = pv.id JOIN products p ON pv.product_id = p.id`;
      if (warehouseId) sql += ` WHERE ws.warehouse_id = ?`;
      return this.electronQuery(sql, warehouseId ? [warehouseId] : []);
    }
    return idbGetAll('warehouse_stocks');
  }
  
  async updateWarehouseStock(data) {
    if (this.mode === 'electron') {
      const existing = await this.electronQuery("SELECT id FROM warehouse_stocks WHERE warehouse_id = ? AND product_variant_id = ?", [data.warehouse_id, data.product_variant_id]);
      if (existing.length > 0) {
        const _res = await this.electronQuery("UPDATE warehouse_stocks SET quantity = quantity + ? WHERE id = ?", [data.quantity, existing[0].id]);
        if (SYNC_ENABLED) {
          syncToCloud('warehouse_stocks', { id: existing[0].id, quantity_delta: data.quantity });
        }
        return _res;
      }
      const _res = await this.electronQuery("INSERT INTO warehouse_stocks (warehouse_id, product_variant_id, quantity) VALUES (?, ?, ?)", [data.warehouse_id, data.product_variant_id, data.quantity]);
      if (SYNC_ENABLED) {
        syncToCloud('warehouse_stocks', { ...data, id: _res.lastInsertRowid });
      }
      return _res;
    }
    return idbAdd('warehouse_stocks', data);
  }

  // ==================== SERIALIZED ITEMS ====================
  async getSerializedItems(variantId = null) {
    if (this.mode === 'electron') {
      let sql = `SELECT psi.*, p.name as product_name, pv.sku, pv.variant_name FROM product_serialized_items psi JOIN product_variants pv ON psi.product_variant_id = pv.id JOIN products p ON pv.product_id = p.id`;
      if (variantId) sql += ` WHERE psi.product_variant_id = ?`;
      return this.electronQuery(sql, variantId ? [variantId] : []);
    }
    return idbGetAll('product_serialized_items');
  }
  
  async getSerializedItemById(id) { 
    if (this.mode === 'electron') { 
      const r = await this.electronQuery("SELECT * FROM product_serialized_items WHERE id = ?", [id]);
      return r[0] || null;
    }
    return idbGetById('product_serialized_items', id);
  }
  
  async addMultipleSerializedItems(variantId, imeiList) {
    if (!Array.isArray(imeiList) || imeiList.length === 0) return { success: false };
    const uniqueImeis = [...new Set(imeiList.map(i => String(i).trim()).filter(Boolean))];
    if (this.mode === 'electron') {
      const placeholders = uniqueImeis.map(() => '(?, ?, ?, ?)').join(', ');
      const flatParams = [];
      uniqueImeis.forEach(imei => flatParams.push(variantId, imei, 'available', null));
      const _res = await this.electronQuery(`INSERT OR IGNORE INTO product_serialized_items (product_variant_id, serial_number_or_imei, status, sale_id) VALUES ${placeholders}`, flatParams);
      if (SYNC_ENABLED) {
        uniqueImeis.forEach(imei => syncToCloud('product_serialized_items', { product_variant_id: variantId, serial_number_or_imei: imei, status: 'available', id: imei }));
      }
      return _res;
    }
    return { success: true };
  }
  
  async updateSerializedItem(id, data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE product_serialized_items SET serial_number_or_imei = ?, status = ?, sale_id = ? WHERE id = ?", [data.serial_number_or_imei, data.status, data.sale_id, id]);
      if (SYNC_ENABLED) {
        syncToCloud('product_serialized_items', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('product_serialized_items', id);
    if (!e) return { changes: 0 };
    return idbPut('product_serialized_items', { ...e, ...data, id: e.id });
  }
  
  async deleteSerializedItem(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("DELETE FROM product_serialized_items WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        syncToCloud('product_serialized_items', id, 'remove');
      }
      return _res;
    }
    return idbDelete('product_serialized_items', id);
  }
  
  async trackProductByIMEI(imei) { 
    if (this.mode === 'electron') {
      return this.electronQuery(`SELECT psi.*, p.name as product_name, pv.sku, pv.retail_price, s.invoice_no as sale_invoice, s.date as sold_on, c.name as sold_to FROM product_serialized_items psi LEFT JOIN product_variants pv ON psi.product_variant_id = pv.id LEFT JOIN products p ON pv.product_id = p.id LEFT JOIN sales s ON psi.sale_id = s.id LEFT JOIN customers c ON s.customer_id = c.id WHERE psi.serial_number_or_imei = ? OR psi.id = ?`, [imei, imei]);
    }
    return [];
  }

  // ==================== EXPENSE CATEGORIES ====================
  async getExpenseCategories() { 
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT * FROM expense_categories WHERE is_deleted = 0 ORDER BY name");
    }
    return idbGetAll('expense_categories').then(r => r.filter(x => !x.is_deleted));
  }
  
  async getExpenseCategoryById(id) { 
    if (this.mode === 'electron') { 
      const r = await this.electronQuery("SELECT * FROM expense_categories WHERE id = ?", [id]);
      return r[0] || null;
    }
    return idbGetById('expense_categories', id);
  }
  
  async createExpenseCategory(data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("INSERT INTO expense_categories (name, color, description) VALUES (?, ?, ?)", [data.name, data.color || '#757575', data.description]);
      if (SYNC_ENABLED) {
        syncToCloud('expense_categories', { ...data, id: _res.lastInsertRowid, is_deleted: 0 });
      }
      return _res;
    }
    return idbAdd('expense_categories', { ...data, is_deleted: 0 });
  }
  
  async updateExpenseCategory(id, data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE expense_categories SET name = ?, color = ?, description = ? WHERE id = ?", [data.name, data.color, data.description, id]);
      if (SYNC_ENABLED) {
        syncToCloud('expense_categories', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('expense_categories', id);
    if (!e) return { changes: 0 };
    return idbPut('expense_categories', { ...e, ...data, id: e.id });
  }
  
  async deleteExpenseCategory(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE expense_categories SET is_deleted = 1 WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        syncToCloud('expense_categories', { id, is_deleted: 1 });
      }
      return _res;
    }
    const e = await idbGetById('expense_categories', id);
    if (!e) return { changes: 0 };
    return idbPut('expense_categories', { ...e, is_deleted: 1, id: e.id });
  }

  // ==================== EXPENSES ====================
  async getExpenses() { 
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT e.*, ec.name as category_name, ec.color as category_color FROM expenses e LEFT JOIN expense_categories ec ON e.category_id = ec.id WHERE e.is_deleted = 0 ORDER BY e.id DESC");
    }
    return idbGetAll('expenses').then(r => r.filter(x => !x.is_deleted));
  }
  
  async getExpenseById(id) { 
    if (this.mode === 'electron') { 
      const r = await this.electronQuery("SELECT e.*, ec.name as category_name FROM expenses e LEFT JOIN expense_categories ec ON e.category_id = ec.id WHERE e.id = ?", [id]);
      return r[0] || null;
    }
    return idbGetById('expenses', id);
  }
  
  async createExpense(data) {
    if (this.mode === 'electron') {
      const result = await this.electronQuery(`INSERT INTO expenses (title, category_id, amount, description, date, payment_mode, reference_no, receipt_no, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [data.title, data.category_id, data.amount, data.description, data.date, data.payment_mode, data.reference_no, data.receipt_no, data.status || 'active']);
      await this.logToGeneralLedger('expense', result.lastInsertRowid, data.amount, 0, `Expense: ${data.title}`);
      await this.logToGeneralLedger('cash', result.lastInsertRowid, 0, data.amount, `Cash/Bank out for expense: ${data.title}`);
      if (SYNC_ENABLED) {
        syncToCloud('expenses', { ...data, id: result.lastInsertRowid, is_deleted: 0 });
      }
      return result;
    }
    return idbAdd('expenses', { ...data, is_deleted: 0 });
  }
  
  async updateExpense(id, data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`UPDATE expenses SET title = ?, category_id = ?, amount = ?, description = ?, date = ?, payment_mode = ?, reference_no = ?, receipt_no = ?, status = ? WHERE id = ?`, [data.title, data.category_id, data.amount, data.description, data.date, data.payment_mode, data.reference_no, data.receipt_no, data.status, id]);
      if (SYNC_ENABLED) {
        syncToCloud('expenses', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('expenses', id);
    if (!e) return { changes: 0 };
    return idbPut('expenses', { ...e, ...data, id: e.id });
  }
  
  async deleteExpense(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE expenses SET is_deleted = 1 WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        syncToCloud('expenses', { id, is_deleted: 1 });
      }
      return _res;
    }
    const e = await idbGetById('expenses', id);
    if (!e) return { changes: 0 };
    return idbPut('expenses', { ...e, is_deleted: 1, id: e.id });
  }

  // ==================== ACCOUNTING ====================
  async getGeneralLedger() { 
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT * FROM general_ledger ORDER BY date DESC, id DESC");
    }
    return idbGetAll('general_ledger');
  }
  
  async getGeneralLedgerByAccountType(accountType) { 
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT * FROM general_ledger WHERE account_type = ? ORDER BY date DESC", [accountType]);
    }
    return idbGetAll('general_ledger').then(r => r.filter(x => x.account_type === accountType));
  }
  
  async logToGeneralLedger(accountType, referenceId, debit, credit, description) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`INSERT INTO general_ledger (account_type, reference_id, debit, credit, description, date) VALUES (?, ?, ?, ?, ?, datetime('now'))`, [accountType, referenceId, debit, credit, description]);
      if (SYNC_ENABLED) {
        syncToCloud('general_ledger', { accountType, referenceId, debit, credit, description, id: _res.lastInsertRowid });
      }
      return _res;
    }
    return [];
  }
  
  async updateGeneralLedgerEntry(id, data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE general_ledger SET account_type = ?, reference_id = ?, debit = ?, credit = ?, description = ? WHERE id = ?", [data.account_type, data.reference_id, data.debit, data.credit, data.description, id]);
      if (SYNC_ENABLED) {
        syncToCloud('general_ledger', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('general_ledger', id);
    if (!e) return { changes: 0 };
    return idbPut('general_ledger', { ...e, ...data, id: e.id });
  }
  
  async deleteGeneralLedgerEntry(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("DELETE FROM general_ledger WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        syncToCloud('general_ledger', id, 'remove');
      }
      return _res;
    }
    return idbDelete('general_ledger', id);
  }

  async getProfitLossReport(dateFrom, dateTo) {
    if (this.mode === 'electron') {
      const s = await this.electronQuery(`SELECT COALESCE(SUM(si.total), 0) as rev, COALESCE(SUM(si.quantity * pv.purchase_price), 0) as cogs FROM sale_items si JOIN sales s ON si.sale_id = s.id JOIN product_variants pv ON si.product_variant_id = pv.id WHERE s.is_deleted = 0 AND DATE(s.date) BETWEEN DATE(?) AND DATE(?)`, [dateFrom, dateTo]);
      const e = await this.electronQuery(`SELECT COALESCE(SUM(amount), 0) as exp FROM expenses WHERE is_deleted = 0 AND DATE(date) BETWEEN DATE(?) AND DATE(?)`, [dateFrom, dateTo]);
      return { revenue: s[0].rev, cogs: s[0].cogs, grossProfit: this.safeSub(s[0].rev, s[0].cogs), expenses: e[0].exp, netProfit: this.safeSub(this.safeSub(s[0].rev, s[0].cogs), e[0].exp) };
    }
    return { revenue: 0, cogs: 0, grossProfit: 0, expenses: 0, netProfit: 0 };
  }

  async getBalanceSheet() {
    if (this.mode === 'electron') {
      const s = await this.electronQuery("SELECT COALESCE(SUM(current_stock * purchase_price), 0) as val FROM product_variants WHERE is_deleted = 0");
      const c = await this.electronQuery("SELECT (COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0)) as val FROM general_ledger WHERE account_type IN ('cash', 'bank')");
      const r = await this.electronQuery("SELECT COALESCE(SUM(current_balance), 0) as val FROM customers WHERE is_deleted = 0 AND current_balance > 0");
      const p = await this.electronQuery("SELECT COALESCE(SUM(current_balance), 0) as val FROM suppliers WHERE is_deleted = 0 AND current_balance > 0");
      const cashVal = c[0].val >= 0 ? c[0].val : 0;
      const totalAssets = this.safeAdd(this.safeAdd(s[0].val, cashVal), r[0].val);
      const totalLiabilities = p[0].val;
      const equity = this.safeSub(totalAssets, totalLiabilities);
      return { assets: { inventory_valuation: s[0].val, cash_and_bank: cashVal, accounts_receivable: r[0].val }, liabilities: { accounts_payable: p[0].val }, equity: { total: equity, retained_earnings: equity, owner_capital: 0 }, totalAssets, totalLiabilities, totalEquity: equity };
    }
    return {};
  }

  async getTrialBalance() {
    if (this.mode === 'electron') {
      const rows = await this.electronQuery(`SELECT account_type, COALESCE(SUM(debit), 0) as total_debit, COALESCE(SUM(credit), 0) as total_credit FROM general_ledger GROUP BY account_type`);
      return rows;
    }
    return [];
  }

  // ==================== DASHBOARD & ANALYTICS ====================
  async getTopSellingProducts(dateFrom, dateTo, limit = 5) {
    if (this.mode === 'electron') {
      return this.electronQuery(`SELECT si.product_id, p.name as product_name, pv.sku, SUM(si.quantity) as total_sold, SUM(si.total) as total_revenue FROM sale_items si JOIN sales s ON si.sale_id = s.id JOIN products p ON si.product_id = p.id JOIN product_variants pv ON si.product_variant_id = pv.id WHERE s.is_deleted = 0 AND date(s.date) BETWEEN date(?) AND date(?) GROUP BY si.product_variant_id ORDER BY total_sold DESC LIMIT ?`, [dateFrom, dateTo, limit]);
    }
    return [];
  }

  async getDashboardStats() {
    if (this.mode === 'electron') {
      const p = await this.electronQuery("SELECT COUNT(*) as count FROM products WHERE is_deleted = 0");
      const c = await this.electronQuery("SELECT COUNT(*) as count FROM customers WHERE is_deleted = 0");
      const s = await this.electronQuery("SELECT COALESCE(SUM(grand_total), 0) as total FROM sales WHERE DATE(date) = DATE('now') AND is_deleted = 0");
      return { total_products: p[0].count, total_customers: c[0].count, today_sales: s[0].total };
    }
    return { total_products: 0, total_customers: 0, today_sales: 0 };
  }

  async getNextInvoiceNumber() {
    if (this.mode === 'electron') {
      const rows = await this.electronQuery("SELECT invoice_no FROM sales WHERE invoice_no LIKE 'INV-%' ORDER BY id DESC LIMIT 1");
      if (rows.length === 0) return 'INV-0001';
      return `INV-${String(parseInt(rows[0].invoice_no.split('-')[1]) + 1).padStart(4, '0')}`;
    }
    return 'INV-0001';
  }

  // ==================== EMI ====================
  async getEMIs() { 
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT e.*, c.name as customer_name FROM emi_records e LEFT JOIN customers c ON e.customer_id = c.id ORDER BY e.id DESC");
    }
    return idbGetAll('emis');
  }
  
  async createEMI(emi) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`INSERT INTO emi_records (customer_id, product_name, total_amount, down_payment, emi_amount, interest_rate, total_months, paid_months, start_date, next_due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [emi.customer_id, emi.product_name, emi.total_amount, emi.down_payment, emi.emi_amount, emi.interest_rate, emi.total_months, 0, emi.start_date, emi.next_due_date, 'active']);
      if (SYNC_ENABLED) {
        syncToCloud('emis', { ...emi, id: _res.lastInsertRowid });
      }
      return _res;
    }
    return idbAdd('emis', emi);
  }
  
  async updateEMI(id, data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE emi_records SET customer_id = ?, product_name = ?, total_amount = ?, down_payment = ?, emi_amount = ?, interest_rate = ?, total_months = ?, paid_months = ?, start_date = ?, next_due_date = ?, status = ? WHERE id = ?", [data.customer_id, data.product_name, data.total_amount, data.down_payment, data.emi_amount, data.interest_rate, data.total_months, data.paid_months, data.start_date, data.next_due_date, data.status, id]);
      if (SYNC_ENABLED) {
        syncToCloud('emis', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('emis', id);
    if (!e) return { changes: 0 };
    return idbPut('emis', { ...e, ...data, id: e.id });
  }
  
  async deleteEMI(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("DELETE FROM emi_records WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        syncToCloud('emis', id, 'remove');
      }
      return _res;
    }
    return idbDelete('emis', id);
  }
  
  async addEMIPayment(payment) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`INSERT INTO emi_payments (emi_id, amount, payment_date, payment_mode, notes) VALUES (?, ?, ?, ?, ?)`, [payment.emi_id, payment.amount, payment.payment_date, payment.payment_mode, payment.notes]);
      if (SYNC_ENABLED) {
        syncToCloud('emi_payments', { ...payment, id: _res.lastInsertRowid });
      }
      return _res;
    }
    return idbAdd('emi_payments', payment);
  }
  
  async getEMIPayments(emiId) { 
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT * FROM emi_payments WHERE emi_id = ? ORDER BY id DESC", [emiId]);
    }
    return idbGetAll('emi_payments').then(res => res.filter(p => p.emi_id === emiId));
  }
  
  async updateEMIPayment(id, data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE emi_payments SET emi_id = ?, amount = ?, payment_date = ?, payment_mode = ?, notes = ? WHERE id = ?", [data.emi_id, data.amount, data.payment_date, data.payment_mode, data.notes, id]);
      if (SYNC_ENABLED) {
        syncToCloud('emi_payments', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('emi_payments', id);
    if (!e) return { changes: 0 };
    return idbPut('emi_payments', { ...e, ...data, id: e.id });
  }
  
  async deleteEMIPayment(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("DELETE FROM emi_payments WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        syncToCloud('emi_payments', id, 'remove');
      }
      return _res;
    }
    return idbDelete('emi_payments', id);
  }

  // ==================== USERS / AUTH ====================
  async getUsers() { 
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT id, name, email, phone, role, shop_name, shop_address, business_type, currency, status, created_at FROM users WHERE is_deleted = 0 ORDER BY name");
    }
    return idbGetAll('users').then(r => r.filter(x => !x.is_deleted).map(u => { const { password, password_hash, ...safe } = u; return safe; }));
  }
  
  async getUserById(id) { 
    if (this.mode === 'electron') { 
      const r = await this.electronQuery("SELECT id, name, email, phone, role, shop_name, shop_address, business_type, currency, status, created_at FROM users WHERE id = ? AND is_deleted = 0", [id]);
      return r[0] || null;
    }
    const u = await idbGetById('users', id);
    if (u) { delete u.password; delete u.password_hash; }
    return u;
  }
  
  async getUserByEmail(email) { 
    if (this.mode === 'electron') { 
      const r = await this.electronQuery("SELECT * FROM users WHERE email = ? AND is_deleted = 0 LIMIT 1", [email]);
      return r[0] || null;
    }
    const all = await idbGetAll('users');
    return all.find(u => u.email?.toLowerCase() === email?.toLowerCase() && !u.is_deleted) || null;
  }
  
  async createUser(data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`INSERT INTO users (name, email, phone, password, password_hash, role, shop_name, shop_address, business_type, currency, status, is_deleted, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`, [data.name, data.email, data.phone, data.password, data.password_hash || data.password, data.role || 'cashier', data.shop_name || '', data.shop_address || '', data.business_type || 'retail', data.currency || 'PKR', data.status || 'active', 0]);
      const safe = { ...data, id: _res.lastInsertRowid, is_deleted: 0 };
      delete safe.password;
      delete safe.password_hash;
      if (SYNC_ENABLED) {
        syncToCloud('users', safe);
      }
      return _res;
    }
    return idbAdd('users', { ...data, is_deleted: 0, created_at: new Date().toISOString() });
  }
  
  async updateUser(id, data) {
    if (this.mode === 'electron') {
      const fields = [];
      const values = [];
      if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
      if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email); }
      if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone); }
      if (data.role !== undefined) { fields.push('role = ?'); values.push(data.role); }
      if (data.shop_name !== undefined) { fields.push('shop_name = ?'); values.push(data.shop_name); }
      if (data.shop_address !== undefined) { fields.push('shop_address = ?'); values.push(data.shop_address); }
      if (data.business_type !== undefined) { fields.push('business_type = ?'); values.push(data.business_type); }
      if (data.currency !== undefined) { fields.push('currency = ?'); values.push(data.currency); }
      if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
      if (data.password) { fields.push('password = ?'); values.push(data.password); fields.push('password_hash = ?'); values.push(data.password_hash || data.password); }
      if (fields.length === 0) throw new Error('No fields provided for update');
      fields.push("updated_at = datetime('now')");
      values.push(id);
      const _res = await this.electronQuery(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
      const safe = { ...data, id };
      delete safe.password;
      delete safe.password_hash;
      if (SYNC_ENABLED) {
        syncToCloud('users', safe);
      }
      return _res;
    }
    const e = await idbGetById('users', id);
    if (!e) return { changes: 0 };
    return idbPut('users', { ...e, ...data, id: e.id, updated_at: new Date().toISOString() });
  }
  
  async deleteUser(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE users SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        syncToCloud('users', { id, is_deleted: 1, deleted_at: new Date().toISOString() });
      }
      return _res;
    }
    const e = await idbGetById('users', id);
    if (!e) return { changes: 0 };
    return idbPut('users', { ...e, is_deleted: 1, id: e.id });
  }
  
  async verifyUser(email, password) {
    const user = await this.getUserByEmail(email);
    if (!user) return null;
    if (user.password === password || user.password_hash === password) {
      const { password: _, password_hash: __, ...safeUser } = user;
      return safeUser;
    }
    return null;
  }

  // ==================== ROLES / PERMISSIONS ====================
  async getRoles() { 
    if (this.mode === 'electron') {
      const rows = await this.electronQuery("SELECT * FROM roles WHERE is_deleted = 0 ORDER BY label");
      return rows.map(r => ({ ...r, pages: typeof r.pages === 'string' ? JSON.parse(r.pages || '[]') : r.pages, permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions || '[]') : r.permissions }));
    }
    const rows = await idbGetAll('roles');
    return rows.filter(x => !x.is_deleted).map(r => ({ ...r, pages: Array.isArray(r.pages) ? r.pages : [], permissions: Array.isArray(r.permissions) ? r.permissions : [] }));
  }
  
  async getRoleById(id) { 
    if (this.mode === 'electron') {
      const r = await this.electronQuery("SELECT * FROM roles WHERE id = ? AND is_deleted = 0", [id]);
      if (!r[0]) return null;
      return { ...r[0], pages: typeof r[0].pages === 'string' ? JSON.parse(r[0].pages || '[]') : r[0].pages, permissions: typeof r[0].permissions === 'string' ? JSON.parse(r[0].permissions || '[]') : r[0].permissions };
    }
    const r = await idbGetById('roles', id);
    if (!r || r.is_deleted) return null;
    return { ...r, pages: Array.isArray(r.pages) ? r.pages : [], permissions: Array.isArray(r.permissions) ? r.permissions : [] };
  }
  
  async createRole(data) {
    const payload = { id: data.id, label: data.label, color: data.color || 'primary', pages: Array.isArray(data.pages) ? data.pages : [], permissions: Array.isArray(data.permissions) ? data.permissions : [] };
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`INSERT INTO roles (id, label, color, pages, permissions, is_deleted) VALUES (?, ?, ?, ?, ?, 0)`, [payload.id, payload.label, payload.color, JSON.stringify(payload.pages), JSON.stringify(payload.permissions)]);
      if (SYNC_ENABLED) {
        syncToCloud('roles', { ...payload, is_deleted: 0 });
      }
      return _res;
    }
    return idbAdd('roles', { ...payload, is_deleted: 0 });
  }
  
  async updateRole(id, data) {
    const existing = await this.getRoleById(id);
    if (!existing) return { changes: 0 };
    const updated = { ...existing, ...data };
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`UPDATE roles SET label = ?, color = ?, pages = ?, permissions = ? WHERE id = ?`, [updated.label, updated.color, JSON.stringify(updated.pages), JSON.stringify(updated.permissions), id]);
      if (SYNC_ENABLED) {
        syncToCloud('roles', { ...updated, id });
      }
      return _res;
    }
    return idbPut('roles', { ...updated, is_deleted: 0, id: existing.id });
  }
  
  async deleteRole(id) {
    if (id === 'admin') throw new Error('Cannot delete admin role');
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE roles SET is_deleted = 1 WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        syncToCloud('roles', { id, is_deleted: 1 });
      }
      return _res;
    }
    const e = await idbGetById('roles', id);
    if (!e) return { changes: 0 };
    return idbPut('roles', { ...e, is_deleted: 1, id: e.id });
  }
  
  async seedDefaultRoles(defaultRoles) {
    const existing = await this.getRoles();
    if (existing.length > 0) return;
    for (const role of defaultRoles) {
      try {
        await this.createRole(role);
      } catch (e) {
        console.warn('Seed role error:', e);
      }
    }
  }

  // ==================== OFFERS ====================
  async getOffers() {
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT * FROM offers WHERE is_deleted = 0 OR is_deleted IS NULL ORDER BY created_at DESC");
    }
    return idbGetAll('offers').then(r => r.filter(x => !x.is_deleted));
  }

  async getOfferById(id) {
    if (this.mode === 'electron') {
      const r = await this.electronQuery("SELECT * FROM offers WHERE id = ? AND (is_deleted = 0 OR is_deleted IS NULL)", [id]);
      return r[0] || null;
    }
    return idbGetById('offers', id);
  }

  async addOffer(data) {
    const clean = {
      name: data.name || '',
      description: data.description || '',
      discount_type: data.discount_type || 'percentage',
      discount_value: Number(data.discount_value) || 0,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      status: data.status || 'active',
      original_total: Number(data.original_total) || 0,
      final_total: Number(data.final_total) || 0,
      items_count: Number(data.items_count) || 0
    };
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        `INSERT INTO offers (name, description, discount_type, discount_value, start_date, end_date, status, original_total, final_total, items_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [clean.name, clean.description, clean.discount_type, clean.discount_value, clean.start_date, clean.end_date, clean.status, clean.original_total, clean.final_total, clean.items_count]
      );
      if (SYNC_ENABLED) {
        syncToCloud('offers', { ...clean, id: _res.lastInsertRowid, is_deleted: 0 });
      }
      return _res;
    }
    const browserRes = await idbAdd('offers', { ...clean, is_deleted: 0, created_at: new Date().toISOString() });
    if (SYNC_ENABLED) {
      syncToCloud('offers', { ...clean, id: browserRes.lastInsertRowid, is_deleted: 0 });
    }
    return browserRes;
  }

  async updateOffer(id, data) {
    const fields = [];
    const values = [];

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.discount_type !== undefined) { fields.push('discount_type = ?'); values.push(data.discount_type); }
    if (data.discount_value !== undefined) { fields.push('discount_value = ?'); values.push(Number(data.discount_value) || 0); }
    if (data.start_date !== undefined) { fields.push('start_date = ?'); values.push(data.start_date); }
    if (data.end_date !== undefined) { fields.push('end_date = ?'); values.push(data.end_date); }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    if (data.original_total !== undefined) { fields.push('original_total = ?'); values.push(Number(data.original_total) || 0); }
    if (data.final_total !== undefined) { fields.push('final_total = ?'); values.push(Number(data.final_total) || 0); }
    if (data.items_count !== undefined) { fields.push('items_count = ?'); values.push(Number(data.items_count) || 0); }

    if (fields.length === 0) return { changes: 0 };

    values.push(id);

    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`UPDATE offers SET ${fields.join(', ')} WHERE id = ?`, values);
      if (SYNC_ENABLED) {
        syncToCloud('offers', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('offers', id);
    if (!e) return { changes: 0 };
    return idbPut('offers', { ...e, ...data, id: e.id });
  }

  async deleteOffer(id) {
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE offers SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        syncToCloud('offers', { id, is_deleted: 1, deleted_at: new Date().toISOString() });
      }
      return _res;
    }
    const e = await idbGetById('offers', id);
    if (!e) return { changes: 0 };
    return idbPut('offers', { ...e, is_deleted: 1, id: e.id });
  }

  // ==================== OFFER ITEMS ====================
  async getOfferItems(offerId) {
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT * FROM offer_items WHERE offer_id = ?", [offerId]);
    }
    return idbGetAll('offer_items').then(r => r.filter(x => x.offer_id === Number(offerId)));
  }

  async addOfferItem(data) {
    const clean = {
      offer_id: data.offer_id,
      product_id: data.product_id || null,
      variant_id: data.variant_id || null,
      product_name: data.product_name || '',
      variant_name: data.variant_name || '',
      sku: data.sku || '',
      original_price: Number(data.original_price) || 0,
      offer_price: Number(data.offer_price) || 0,
      category_id: data.category_id || null
    };
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        `INSERT INTO offer_items (offer_id, product_id, variant_id, product_name, variant_name, sku, original_price, offer_price, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [clean.offer_id, clean.product_id, clean.variant_id, clean.product_name, clean.variant_name, clean.sku, clean.original_price, clean.offer_price, clean.category_id]
      );
      if (SYNC_ENABLED) {
        syncToCloud('offer_items', { ...clean, id: _res.lastInsertRowid });
      }
      return _res;
    }
    const browserRes = await idbAdd('offer_items', clean);
    if (SYNC_ENABLED) {
      syncToCloud('offer_items', { ...clean, id: browserRes.lastInsertRowid });
    }
    return browserRes;
  }

  async deleteOfferItems(offerId) {
    if (this.mode === 'electron') {
      return this.electronQuery("DELETE FROM offer_items WHERE offer_id = ?", [offerId]);
    }
    const all = await idbGetAll('offer_items');
    for (const item of all.filter(x => x.offer_id === Number(offerId))) {
      await idbDelete('offer_items', item.id);
    }
    return { changes: 1 };
  }

  // ==================== ALL ITEMS HELPERS (Browser Mode) ====================
  async getAllPurchaseItems() {
    if (this.mode === 'electron') {
      return this.electronQuery(`SELECT pi.*, pv.sku, pv.variant_name, p.name as product_name 
        FROM purchase_items pi 
        JOIN product_variants pv ON pi.product_variant_id = pv.id 
        JOIN products p ON pv.product_id = p.id`);
    }
    const [items, variants, prods] = await Promise.all([
      idbGetAll('purchase_items'),
      idbGetAll('product_variants'),
      idbGetAll('products')
    ]);
    return items.map(i => {
      const v = variants.find(x => x.id === i.product_variant_id);
      return {
        ...i,
        sku: v?.sku || '',
        variant_name: v?.variant_name || '',
        product_name: prods.find(x => x.id === v?.product_id)?.name || ''
      };
    });
  }

  async getAllSaleReturnItems() {
    if (this.mode === 'electron') {
      return this.electronQuery(`SELECT sri.*, pv.sku, p.name as product_name 
        FROM sale_return_items sri 
        JOIN product_variants pv ON sri.product_variant_id = pv.id 
        JOIN products p ON pv.product_id = p.id`);
    }
    const [items, variants, prods] = await Promise.all([
      idbGetAll('sale_return_items'),
      idbGetAll('product_variants'),
      idbGetAll('products')
    ]);
    return items.map(i => {
      const v = variants.find(x => x.id === i.product_variant_id);
      return {
        ...i,
        sku: v?.sku || '',
        product_name: prods.find(x => x.id === v?.product_id)?.name || ''
      };
    });
  }

  // ==================== SERVICES ====================
  async getServices() {
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT * FROM services WHERE is_deleted = 0 ORDER BY name");
    }
    return idbGetAll('services').then(r => r.filter(x => !x.is_deleted));
  }

  async getServiceById(id) {
    if (this.mode === 'electron') {
      const r = await this.electronQuery("SELECT * FROM services WHERE id = ?", [id]);
      return r[0] || null;
    }
    return idbGetById('services', id);
  }

  async createService(data) {
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("INSERT INTO services (name, description, base_price, estimated_time, status) VALUES (?, ?, ?, ?, ?)", [data.name, data.description || '', data.base_price || 0, data.estimated_time || '', data.status || 'active']);
      if (SYNC_ENABLED) {
        syncToCloud('services', { ...data, id: _res.lastInsertRowid, is_deleted: 0 });
      }
      return _res;
    }
    return idbAdd('services', { ...data, is_deleted: 0 });
  }

  async updateService(id, data) {
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE services SET name = ?, description = ?, base_price = ?, estimated_time = ?, status = ? WHERE id = ?", [data.name, data.description, data.base_price, data.estimated_time, data.status, id]);
      if (SYNC_ENABLED) {
        syncToCloud('services', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('services', id);
    if (!e) return { changes: 0 };
    return idbPut('services', { ...e, ...data, id: e.id });
  }

  async deleteService(id) {
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE services SET is_deleted = 1 WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        syncToCloud('services', { id, is_deleted: 1 });
      }
      return _res;
    }
    const e = await idbGetById('services', id);
    if (!e) return { changes: 0 };
    return idbPut('services', { ...e, is_deleted: 1, id: e.id });
  }

  // ==================== STAFF ====================
  async getStaff() {
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT * FROM staff WHERE is_deleted = 0 ORDER BY name");
    }
    return idbGetAll('staff').then(r => r.filter(x => !x.is_deleted));
  }

  async getStaffById(id) {
    if (this.mode === 'electron') {
      const r = await this.electronQuery("SELECT * FROM staff WHERE id = ?", [id]);
      return r[0] || null;
    }
    return idbGetById('staff', id);
  }

  async createStaff(data) {
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("INSERT INTO staff (name, phone, role, active) VALUES (?, ?, ?, ?)", [data.name, data.phone || '', data.role || 'technician', data.active !== false ? 1 : 0]);
      if (SYNC_ENABLED) {
        syncToCloud('staff', { ...data, id: _res.lastInsertRowid, active: data.active !== false, is_deleted: 0 });
      }
      return _res;
    }
    return idbAdd('staff', { ...data, active: data.active !== false, is_deleted: 0 });
  }

  async updateStaff(id, data) {
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE staff SET name = ?, phone = ?, role = ?, active = ? WHERE id = ?", [data.name, data.phone, data.role, data.active !== false ? 1 : 0, id]);
      if (SYNC_ENABLED) {
        syncToCloud('staff', { ...data, id, active: data.active !== false });
      }
      return _res;
    }
    const e = await idbGetById('staff', id);
    if (!e) return { changes: 0 };
    return idbPut('staff', { ...e, ...data, active: data.active !== false, id: e.id });
  }

  async deleteStaff(id) {
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE staff SET is_deleted = 1 WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        syncToCloud('staff', { id, is_deleted: 1 });
      }
      return _res;
    }
    const e = await idbGetById('staff', id);
    if (!e) return { changes: 0 };
    return idbPut('staff', { ...e, is_deleted: 1, id: e.id });
  }

  // ==================== SYNC FROM CLOUD ====================
  async syncFromCloud() {
    console.log('[Storage] Starting cloud sync...');
    const cloudData = await cloudSync.syncAllFromCloud();

    for (const [storeName, items] of Object.entries(cloudData)) {
      if (!items || items.length === 0) continue;
      try {
        await this.clearStore(storeName);
        for (const item of items) {
          if (item.id) {
            await idbPut(storeName, item);
          }
        }
        console.log(`[Storage] Synced ${items.length} items to ${storeName}`);
      } catch (e) {
        console.error(`[Storage] Failed to sync ${storeName}:`, e);
      }
    }
    console.log('[Storage] Cloud sync complete');
  }

  async clearStore(storeName) {
    await ensureIndexedDB();
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const r = store.clear();
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  }

  async clearAllData() {
    const stores = [
      'brands', 'categories', 'products', 'product_variants',
      'customers', 'suppliers', 'purchases', 'purchase_items',
      'sales', 'sale_items', 'sale_returns', 'sale_return_items',
      'expense_categories', 'expenses', 'payments',
      'users', 'roles', 'warehouses', 'offers', 'offer_items',
      'services', 'staff', 'work_orders', 'emis', 'emi_payments'
    ];
    for (const store of stores) {
      try { await this.clearStore(store); } catch (e) {}
    }
    console.log('[Storage] All local data cleared');
  }

  // ==================== WORK ORDERS ====================
  async getWorkOrders(filters = {}) {
    if (this.mode === 'electron') {
      let sql = `SELECT wo.*, s.name as service_name, st.name as staff_name, c.name as customer_name 
        FROM work_orders wo 
        LEFT JOIN services s ON wo.service_id = s.id 
        LEFT JOIN staff st ON wo.staff_id = st.id 
        LEFT JOIN customers c ON wo.customer_id = c.id 
        WHERE wo.is_deleted = 0`;
      const params = [];
      if (filters.status) { sql += " AND wo.status = ?"; params.push(filters.status); }
      if (filters.staffId) { sql += " AND wo.staff_id = ?"; params.push(filters.staffId); }
      if (filters.startDate) { sql += " AND DATE(wo.created_at) >= DATE(?))"; params.push(filters.startDate); }
      sql += " ORDER BY wo.id DESC";
      return this.electronQuery(sql, params);
    }
    const [wo, services, staff, customers] = await Promise.all([
      idbGetAll('work_orders'), idbGetAll('services'), idbGetAll('staff'), idbGetAll('customers')
    ]);
    let result = wo.filter(x => !x.is_deleted);
    if (filters.status) result = result.filter(x => x.status === filters.status);
    if (filters.staffId) result = result.filter(x => String(x.staff_id) === String(filters.staffId));
    return result.map(item => ({
      ...item,
      service_name: services.find(s => String(s.id) === String(item.service_id))?.name || '',
      staff_name: staff.find(s => String(s.id) === String(item.staff_id))?.name || '',
      customer_name: customers.find(c => String(c.id) === String(item.customer_id))?.name || ''
    }));
  }

  async getWorkOrderById(id) {
    if (this.mode === 'electron') {
      const r = await this.electronQuery(`SELECT wo.*, s.name as service_name, st.name as staff_name 
        FROM work_orders wo 
        LEFT JOIN services s ON wo.service_id = s.id 
        LEFT JOIN staff st ON wo.staff_id = st.id 
        WHERE wo.id = ?`, [id]);
      return r[0] || null;
    }
    return idbGetById('work_orders', id);
  }

  async createWorkOrder(data) {
    const payload = {
      ...data,
      status: data.status || 'pending',
      parts_used: data.parts_used || [],
      total_cost: data.total_cost || 0,
      created_at: new Date().toISOString(),
      is_deleted: 0
    };
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        `INSERT INTO work_orders (service_id, staff_id, customer_id, machine_name, status, parts_used, notes, total_cost, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [payload.service_id, payload.staff_id, payload.customer_id || null, payload.machine_name, payload.status, JSON.stringify(payload.parts_used), payload.notes || '', payload.total_cost, payload.created_at]
      );
      if (SYNC_ENABLED) {
        syncToCloud('work_orders', { ...payload, id: _res.lastInsertRowid });
      }
      return _res;
    }
    return idbAdd('work_orders', payload);
  }

  async updateWorkOrder(id, data) {
    if (this.mode === 'electron') {
      const fields = [];
      const values = [];
      if (data.service_id !== undefined) { fields.push('service_id = ?'); values.push(data.service_id); }
      if (data.staff_id !== undefined) { fields.push('staff_id = ?'); values.push(data.staff_id); }
      if (data.customer_id !== undefined) { fields.push('customer_id = ?'); values.push(data.customer_id); }
      if (data.machine_name !== undefined) { fields.push('machine_name = ?'); values.push(data.machine_name); }
      if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
      if (data.parts_used !== undefined) { fields.push('parts_used = ?'); values.push(JSON.stringify(data.parts_used)); }
      if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }
      if (data.total_cost !== undefined) { fields.push('total_cost = ?'); values.push(data.total_cost); }
      if (fields.length === 0) return { changes: 0 };
      values.push(id);
      const _res = await this.electronQuery(`UPDATE work_orders SET ${fields.join(', ')} WHERE id = ?`, values);
      if (SYNC_ENABLED) {
        syncToCloud('work_orders', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('work_orders', id);
    if (!e) return { changes: 0 };
    return idbPut('work_orders', { ...e, ...data, id: e.id });
  }

  async deleteWorkOrder(id) {
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE work_orders SET is_deleted = 1 WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        syncToCloud('work_orders', { id, is_deleted: 1 });
      }
      return _res;
    }
    const e = await idbGetById('work_orders', id);
    if (!e) return { changes: 0 };
    return idbPut('work_orders', { ...e, is_deleted: 1, id: e.id });
  }

  async deductWorkOrderParts(partsUsed) {
    if (!Array.isArray(partsUsed) || partsUsed.length === 0) return;
    for (const part of partsUsed) {
      if (!part.part_id || !part.quantity) continue;
      const variant = await this.getVariantBySKU(part.part_id);
      if (variant && variant.id) {
        await this.updateVariantStock(variant.id, -Number(part.quantity));
      }
    }
  }

  // ==================== BACKWARD COMPATIBILITY ALIASES ====================
  async addCategory(data) { return this.createCategory(data); }
  async addBrand(data) { return this.createBrand(data); }
  async addCustomer(data) { return this.createCustomer(data); }
  async addSupplier(data) { return this.createSupplier(data); }
  async addWarehouse(data) { return this.createWarehouse(data); }
  async addExpenseCategory(data) { return this.createExpenseCategory(data); }
  async addExpense(data) { return this.createExpense(data); }
  async addService(data) { return this.createService(data); }
  async addStaff(data) { return this.createStaff(data); }
  async addWorkOrder(data) { return this.createWorkOrder(data); }
  async addEMI(data) { return this.createEMI(data); }
  async addRole(data) { return this.createRole(data); }
  async addSale(data) { return this.createSale(data); }
  async addSaleReturn(data) { return this.createSaleReturn(data); }
  async addSaleReturnItem(data) { return this.createSaleReturnItem(data); }
  async addPurchase(data) { return this.addPurchase(data); }
  async addPurchaseItem(data) { return this.addPurchaseItem(data); }
}

const db = new Storage();
export default db;