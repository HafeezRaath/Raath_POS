// ============================================================
//  storage.js - Universal Storage for POSIT POS (WITH FULL EMI & ACCOUNTING MATRIX)
//  Electron: SQLite via IPC | Web Demo: IndexedDB
// ============================================================

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

// --- DEMO SEED DATA ---
const DEMO_BRANDS = [
  { id: 1, name: 'Samsung', status: 'active', is_deleted: 0 },
  { id: 2, name: 'Apple', status: 'active', is_deleted: 0 }
];

const DEMO_CATEGORIES = [
  { id: 1, name: 'Smartphones', slug: 'smartphones', parent_id: null, status: 'active', is_deleted: 0 },
  { id: 2, name: 'Grocery', slug: 'grocery', parent_id: null, status: 'active', is_deleted: 0 }
];

// ==================== INDEXEDDB SETUP (Browser Mode) ====================
const DB_NAME = 'RAATH_POS_DEMO';
const DB_VERSION = 2; // BUMPED VERSION for users store

const STORES = [
  'brands', 'categories', 'products', 'product_variants', 'product_serialized_items',
  'suppliers', 'purchases', 'purchase_items', 'customers', 'sales', 'sale_items',
  'sale_returns', 'sale_return_items', 'expense_categories', 'expenses',
  'customer_ledger', 'supplier_ledger', 'payments', 'general_ledger', 'emis', 'emi_payments',
  'users'
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
          db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
          console.log(`[IndexedDB] Created store: ${storeName}`);
        }
      });
    };
  });
  return idbPromise;
}

// Force recreate DB if stores are missing (handles corrupted DB)
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
    const r = store.get(Number(id));
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => reject(r.error);
  });
}

async function idbAdd(storeName, data) {
  await ensureIndexedDB();
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const cleanData = { ...data };
    if (!cleanData.id) delete cleanData.id;
    const r = store.add(cleanData);
    r.onsuccess = () => resolve({ lastInsertRowid: r.result, changes: 1 });
    r.onerror = () => reject(r.error);
  });
}

async function idbPut(storeName, data) {
  await ensureIndexedDB();
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const r = store.put(data);
    r.onsuccess = () => resolve({ lastInsertRowid: data.id, changes: 1 });
    r.onerror = () => reject(r.error);
  });
}

class Storage {
  constructor() {
    this.mode = this.detectMode();
    this._dbMutex = Promise.resolve();
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
    return (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.isElectron) ? 'electron' : 'browser';
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

  // ==================== BRANDS FULL CRUD ====================
  async getBrands() { if (this.mode === 'electron') return this.electronQuery("SELECT * FROM brands WHERE is_deleted = 0 ORDER BY name"); return idbGetAll('brands').then(r => r.filter(x => !x.is_deleted)); }
  async getBrandById(id) { if (this.mode === 'electron') { const r = await this.electronQuery("SELECT * FROM brands WHERE id = ?", [id]); return r[0] || null; } return idbGetById('brands', id); }
  async createBrand(data) { if (this.mode === 'electron') return this.electronQuery("INSERT INTO brands (name, status) VALUES (?, ?)", [data.name, data.status || 'active']); return idbAdd('brands', { ...data, is_deleted: 0 }); }
  async updateBrand(id, data) { if (this.mode === 'electron') return this.electronQuery("UPDATE brands SET name = ?, status = ? WHERE id = ?", [data.name, data.status, id]); const e = await idbGetById('brands', id); return idbPut('brands', { ...e, ...data }); }
  async deleteBrand(id) { if (this.mode === 'electron') return this.electronQuery("UPDATE brands SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?", [id]); const e = await idbGetById('brands', id); return idbPut('brands', { ...e, is_deleted: 1 }); }
  async addBrand(data) { return this.createBrand(data); }

  // ==================== CATEGORIES FULL CRUD ====================
  async getCategories() {
    if (this.mode === 'electron') {
      return this.electronQuery(`
        SELECT c1.*, c2.name as parent_name
        FROM categories c1
        LEFT JOIN categories c2 ON c1.parent_id = c2.id
        WHERE c1.is_deleted = 0 ORDER BY c1.name
      `);
    }
    const cats = await idbGetAll('categories');
    return cats.filter(x => !x.is_deleted).map(c => ({ ...c, parent_name: cats.find(p => p.id === c.parent_id)?.name || '' }));
  }
  async getCategoryById(id) { if (this.mode === 'electron') { const r = await this.electronQuery("SELECT * FROM categories WHERE id = ?", [id]); return r[0] || null; } return idbGetById('categories', id); }
  async createCategory(data) { if (this.mode === 'electron') return this.electronQuery("INSERT INTO categories (name, slug, parent_id, status) VALUES (?, ?, ?, ?)", [data.name, data.slug, data.parent_id || null, data.status || 'active']); return idbAdd('categories', { ...data, is_deleted: 0 }); }
  async updateCategory(id, data) { if (this.mode === 'electron') return this.electronQuery("UPDATE categories SET name = ?, slug = ?, parent_id = ?, status = ? WHERE id = ?", [data.name, data.slug, data.parent_id, data.status, id]); const e = await idbGetById('categories', id); return idbPut('categories', { ...e, ...data }); }
  async deleteCategory(id) { if (this.mode === 'electron') return this.electronQuery("UPDATE categories SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?", [id]); const e = await idbGetById('categories', id); return idbPut('categories', { ...e, is_deleted: 1 }); }
  async addCategory(data) { return this.createCategory(data); }

  // ==================== PRODUCTS & VARIANTS FULL CRUD ====================
  async getProducts() {
    if (this.mode === 'electron') return this.electronQuery(`SELECT p.*, b.name as brand_name, c.name as category_name FROM products p LEFT JOIN brands b ON p.brand_id = b.id LEFT JOIN categories c ON p.category_id = c.id WHERE p.is_deleted = 0 ORDER BY p.id DESC`);
    const [p, b, c] = await Promise.all([idbGetAll('products'), idbGetAll('brands'), idbGetAll('categories')]);
    return p.filter(x => !x.is_deleted).map(item => ({ ...item, brand_name: b.find(x => x.id === item.brand_id)?.name || '', category_name: c.find(x => x.id === item.category_id)?.name || '' }));
  }
  async getAllVariants() {
    if (this.mode === 'electron') return this.electronQuery(`SELECT pv.*, p.name as product_name, p.type as product_type, p.category_id, c.name as category_name FROM product_variants pv JOIN products p ON pv.product_id = p.id LEFT JOIN categories c ON p.category_id = c.id WHERE pv.is_deleted = 0 AND p.is_deleted = 0 ORDER BY p.id DESC`);
    const [v, p, c] = await Promise.all([idbGetAll('product_variants'), idbGetAll('products'), idbGetAll('categories')]);
    return v.filter(x => !x.is_deleted).map(item => { const parent = p.find(x => x.id === item.product_id); return { ...item, product_name: parent?.name || '', product_type: parent?.type || 'standard', category_id: parent?.category_id || null, category_name: c.find(x => x.id === parent?.category_id)?.name || '' }; });
  }
  async getProductVariants(productId = null) {
    if (this.mode === 'electron') { let sql = `SELECT pv.*, p.name as product_name, p.type as product_type, p.category_id FROM product_variants pv JOIN products p ON pv.product_id = p.id WHERE pv.is_deleted = 0`; return productId ? this.electronQuery(sql + " AND pv.product_id = ?", [productId]) : this.electronQuery(sql); }
    const [v, p] = await Promise.all([idbGetAll('product_variants'), idbGetAll('products')]);
    let res = v.filter(x => !x.is_deleted); if (productId) res = res.filter(x => x.product_id === Number(productId));
    return res.map(item => ({ ...item, product_name: p.find(x => x.id === item.product_id)?.name || '' }));
  }
  async getProductById(id) { if (this.mode === 'electron') { const r = await this.electronQuery("SELECT * FROM products WHERE id = ?", [id]); return r[0] || null; } return idbGetById('products', id); }
  async getVariantBySKU(sku) { const cleanSku = String(sku || '').trim(); if (!cleanSku) return null; if (this.mode === 'electron') { const rows = await this.electronQuery("SELECT * FROM product_variants WHERE LOWER(sku) = LOWER(?) AND is_deleted = 0 LIMIT 1", [cleanSku]); return rows[0] || null; } return idbGetAll('product_variants').then(res => res.find(v => v.sku?.toLowerCase() === cleanSku.toLowerCase() && !v.is_deleted) || null); }
  async addProduct(data) { if (this.mode === 'electron') return this.electronQuery(`INSERT INTO products (name, brand_id, category_id, type, unit, tax_type, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [data.name, data.brand_id, data.category_id, data.type, data.unit, data.tax_type, data.description, data.status]); return idbAdd('products', { ...data, is_deleted: 0 }); }
  async createVariant(data) {
    const cleanSku = String(data.sku || '').trim(); if (!cleanSku) throw new Error('SKU required');
    if (this.mode === 'electron') {
      const existing = await this.electronQuery("SELECT id FROM product_variants WHERE LOWER(sku) = LOWER(?) AND is_deleted = 0", [cleanSku]);
      if (existing.length > 0) { await this.electronQuery("UPDATE product_variants SET current_stock = current_stock + ? WHERE id = ?", [Number(data.current_stock || 0), existing[0].id]); return { lastInsertRowid: existing[0].id, changes: 1, merged: true }; }
      return this.electronQuery(`INSERT INTO product_variants (product_id, sku, barcode, variant_name, purchase_price, retail_price, wholesale_price, minimum_retail_price, stock_alert_quantity, current_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [data.product_id, cleanSku, data.barcode, data.variant_name || 'Default', data.purchase_price || 0, data.retail_price || 0, data.wholesale_price || 0, data.minimum_retail_price || 0, data.stock_alert_quantity || 5, data.current_stock || 0]);
    }
    return idbAdd('product_variants', { ...data, sku: cleanSku, is_deleted: 0 });
  }
  async addVariant(data) { return this.createVariant(data); }
  async updateProduct(id, data) { if (this.mode === 'electron') return this.electronQuery(`UPDATE products SET name = ?, category_id = ?, type = ?, unit = ?, status = ? WHERE id = ?`, [data.name, data.category_id, data.type, data.unit, data.status, id]); const e = await idbGetById('products', id); return idbPut('products', { ...e, ...data }); }
  async updateVariant(id, data) { if (this.mode === 'electron') return this.electronQuery(`UPDATE product_variants SET sku = ?, barcode = ?, variant_name = ?, purchase_price = ?, retail_price = ?, wholesale_price = ?, stock_alert_quantity = ?, current_stock = ? WHERE id = ?`, [data.sku, data.barcode, data.variant_name, data.purchase_price, data.retail_price, data.wholesale_price, data.stock_alert_quantity, data.current_stock, id]); const e = await idbGetById('product_variants', id); return idbPut('product_variants', { ...e, ...data }); }
  async updateVariantStock(id, qty) { if (this.mode === 'electron') return this.electronQuery("UPDATE product_variants SET current_stock = current_stock + ? WHERE id = ?", [qty, id]); const v = await idbGetById('product_variants', id); if (v) { v.current_stock = this.safeAdd(v.current_stock, qty); await idbPut('product_variants', v); } return { success: true }; }
  async deleteVariant(id) { if (this.mode === 'electron') return this.electronQuery("UPDATE product_variants SET is_deleted = 1 WHERE id = ?", [id]); const v = await idbGetById('product_variants', id); if (v) { v.is_deleted = 1; await idbPut('product_variants', v); } }
  async deleteProduct(id) { if (this.mode === 'electron') return this.electronQuery("UPDATE products SET is_deleted = 1 WHERE id = ?", [id]); const p = await idbGetById('products', id); if (p) { p.is_deleted = 1; await idbPut('products', p); } }

  // ==================== CUSTOMERS FULL CRUD ====================
  async getCustomers() { if (this.mode === 'electron') return this.electronQuery("SELECT * FROM customers WHERE is_deleted = 0 ORDER BY name"); return idbGetAll('customers').then(r => r.filter(x => !x.is_deleted)); }
  async getCustomerById(id) { if (this.mode === 'electron') { const r = await this.electronQuery("SELECT * FROM customers WHERE id = ?", [id]); return r[0] || null; } return idbGetById('customers', id); }
  async createCustomer(data) { if (this.mode === 'electron') return this.electronQuery(`INSERT INTO customers (name, phone, email, cnic, shop_name, customer_type, opening_balance, current_balance, credit_limit, payment_terms, status, district, province, notes, reference_name, reference_phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [data.name, data.phone, data.email, data.cnic, data.shop_name, data.customer_type || 'retail', data.opening_balance || 0, data.opening_balance || 0, data.credit_limit || 0, data.payment_terms || 'cash', data.status || 'active', data.district, data.province, data.notes, data.reference_name, data.reference_phone]); return idbAdd('customers', { ...data, is_deleted: 0 }); }
  async updateCustomer(id, data) { if (this.mode === 'electron') return this.electronQuery(`UPDATE customers SET name = ?, phone = ?, email = ?, cnic = ?, shop_name = ?, customer_type = ?, credit_limit = ?, payment_terms = ?, status = ?, district = ?, province = ?, notes = ?, reference_name = ?, reference_phone = ?, current_balance = ? WHERE id = ?`, [data.name, data.phone, data.email, data.cnic, data.shop_name, data.customer_type, data.credit_limit, data.payment_terms, data.status, data.district, data.province, data.notes, data.reference_name, data.reference_phone, data.current_balance, id]); const e = await idbGetById('customers', id); return idbPut('customers', { ...e, ...data }); }
  async deleteCustomer(id) { if (this.mode === 'electron') return this.electronQuery("UPDATE customers SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?", [id]); const e = await idbGetById('customers', id); return idbPut('customers', { ...e, is_deleted: 1 }); }
  async getCustomerLedger(customerId) { if (this.mode === 'electron') return this.electronQuery("SELECT * FROM customer_ledger WHERE customer_id = ? ORDER BY id DESC", [customerId]); return idbGetAll('customer_ledger').then(r => r.filter(x => x.customer_id === Number(customerId))); }
  async addCustomerLedgerEntry(data) { if (this.mode === 'electron') return this.electronQuery(`INSERT INTO customer_ledger (customer_id, type, amount, description, payment_mode, date) VALUES (?, ?, ?, ?, ?, datetime('now'))`, [data.customer_id, data.type, data.amount, data.description, data.payment_mode]); return idbAdd('customer_ledger', data); }

  // ==================== SUPPLIERS FULL CRUD ====================
  async getSuppliers() { if (this.mode === 'electron') return this.electronQuery("SELECT * FROM suppliers WHERE is_deleted = 0 ORDER BY name"); return idbGetAll('suppliers').then(r => r.filter(x => !x.is_deleted)); }
  async getSupplierById(id) { if (this.mode === 'electron') { const r = await this.electronQuery("SELECT * FROM suppliers WHERE id = ?", [id]); return r[0] || null; } return idbGetById('suppliers', id); }
  async createSupplier(data) { if (this.mode === 'electron') return this.electronQuery(`INSERT INTO suppliers (name, company_name, phone, email, vat_ntn_number, address, opening_balance, current_balance, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [data.name, data.company_name, data.phone, data.email, data.vat_ntn_number, data.address, data.opening_balance, data.current_balance, data.status]); return idbAdd('suppliers', { ...data, is_deleted: 0 }); }
  async updateSupplier(id, data) { if (this.mode === 'electron') return this.electronQuery(`UPDATE suppliers SET name = ?, company_name = ?, phone = ?, email = ?, vat_ntn_number = ?, address = ?, status = ? WHERE id = ?`, [data.name, data.company_name, data.phone, data.email, data.vat_ntn_number, data.address, data.status, id]); const e = await idbGetById('suppliers', id); return idbPut('suppliers', { ...e, ...data }); }
  async deleteSupplier(id) { if (this.mode === 'electron') return this.electronQuery("UPDATE suppliers SET is_deleted = 1 WHERE id = ?", [id]); const e = await idbGetById('suppliers', id); return idbPut('suppliers', { ...e, is_deleted: 1 }); }
  async updateSupplierBalance(id, amt) { if (this.mode === 'electron') return this.electronQuery("UPDATE suppliers SET current_balance = current_balance + ? WHERE id = ?", [amt, id]); }

  // ==================== PURCHASES FRAMEWORK FULL CRUD ====================
  async getPurchases() { if (this.mode === 'electron') return this.electronQuery(`SELECT p.*, s.name as supplier_name, s.company_name as supplier_company FROM purchases p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.is_deleted = 0 ORDER BY p.id DESC`); return idbGetAll('purchases').then(r => r.filter(x => !x.is_deleted)); }
  async getPurchaseById(id) { if (this.mode === 'electron') { const r = await this.electronQuery("SELECT p.*, s.name as supplier_name FROM purchases p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.id = ?", [id]); return r[0] || null; } return idbGetById('purchases', id); }
  async getPurchaseItems(purchaseId) { if (this.mode === 'electron') return this.electronQuery(`SELECT pi.*, pv.sku, pv.variant_name, p.name as product_name FROM purchase_items pi JOIN product_variants pv ON pi.product_variant_id = pv.id JOIN products p ON pv.product_id = p.id WHERE pi.purchase_id = ?`, [purchaseId]); const [items, variants, prods] = await Promise.all([idbGetAll('purchase_items'), idbGetAll('product_variants'), idbGetAll('products')]); return items.filter(x => x.purchase_id === Number(purchaseId)).map(i => { const v = variants.find(x => x.id === i.product_variant_id); return { ...i, sku: v?.sku || '', variant_name: v?.variant_name || '', product_name: prods.find(x => x.id === v?.product_id)?.name || '' }; }); }
  async addPurchase(data) { if (this.mode === 'electron') return this.electronQuery(`INSERT INTO purchases (supplier_id, purchase_no, supplier_invoice_no, purchase_date, due_date, status, total_amount, discount_amount, tax_amount, shipping_charges, grand_total, paid_amount, payment_status, notes, payment_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [data.supplier_id, data.purchase_no, data.supplier_invoice_no, data.purchase_date, data.due_date, data.status, data.total_amount, data.discount_amount, data.tax_amount, data.shipping_charges, data.grand_total, data.paid_amount, data.payment_status, data.notes, data.payment_mode]); return idbAdd('purchases', data); }
  async updatePurchase(id, data) { if (this.mode === 'electron') return this.electronQuery(`UPDATE purchases SET supplier_id = ?, purchase_no = ?, supplier_invoice_no = ?, purchase_date = ?, due_date = ?, status = ?, total_amount = ?, discount_amount = ?, tax_amount = ?, shipping_charges = ?, grand_total = ?, paid_amount = ?, payment_status = ?, notes = ?, payment_mode = ? WHERE id = ?`, [data.supplier_id, data.purchase_no, data.supplier_invoice_no, data.purchase_date, data.due_date, data.status, data.total_amount, data.discount_amount, data.tax_amount, data.shipping_charges, data.grand_total, data.paid_amount, data.payment_status, data.notes, data.payment_mode, id]); }
  async deletePurchase(id) { if (this.mode === 'electron') return this.electronQuery("UPDATE purchases SET is_deleted = 1 WHERE id = ?", [id]); }
  async addPurchaseItem(data) { if (this.mode === 'electron') return this.electronQuery(`INSERT INTO purchase_items (purchase_id, product_variant_id, quantity, purchase_price, tax_percentage, sub_total, expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?)`, [data.purchase_id, data.product_variant_id, data.quantity, data.purchase_price, data.tax_percentage, data.sub_total, data.expiry_date]); return idbAdd('purchase_items', data); }
  async getPriceHistory(variantId, limit = 3) { if (this.mode === 'electron') return this.electronQuery(`SELECT pi.purchase_price, p.purchase_date, s.name as supplier_name FROM purchase_items pi JOIN purchases p ON pi.purchase_id = p.id LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE pi.product_variant_id = ? ORDER BY p.id DESC LIMIT ?`, [variantId, limit]); return []; }

  // ==================== SUPPLIER PAYMENTS & LEDGERS FULL CRUD ====================
  async getPayments() { if (this.mode === 'electron') return this.electronQuery("SELECT * FROM payments ORDER BY id DESC"); return idbGetAll('payments'); }
  async addPayment(data) { if (this.mode === 'electron') return this.electronQuery(`INSERT INTO payments (supplier_id, amount, note, date, type) VALUES (?, ?, ?, ?, ?)`, [data.supplier_id, data.amount, data.note, data.date, data.type]); return idbAdd('payments', data); }
  async getLedger() { if (this.mode === 'electron') return this.electronQuery("SELECT * FROM ledger ORDER BY id DESC"); return idbGetAll('ledger'); }
  async addLedgerEntry(data) { if (this.mode === 'electron') return this.electronQuery(`INSERT INTO ledger (supplier_id, type, amount, description, date) VALUES (?, ?, ?, ?, ?)`, [data.supplier_id, data.type, data.amount, data.description, data.date]); return idbAdd('ledger', data); }

  // ==================== SALE ITEMS (For COGS Calculation) ====================
  async getAllSaleItems() {
    if (this.mode === 'electron') return this.electronQuery(`SELECT si.*, p.name as product_name, pv.sku, pv.purchase_price as unit_cost FROM sale_items si JOIN products p ON si.product_id = p.id JOIN product_variants pv ON si.product_variant_id = pv.id ORDER BY si.id DESC`);
    const [items, variants, prods] = await Promise.all([idbGetAll('sale_items'), idbGetAll('product_variants'), idbGetAll('products')]);
    return items.map(i => {
      const v = variants.find(x => x.id === i.product_variant_id);
      return { ...i, sku: v?.sku || '', unit_cost: v?.purchase_price || 0, product_name: prods.find(x => x.id === v?.product_id)?.name || '' };
    });
  }

  // ==================== EXPENSE CATEGORIES FULL CRUD ====================
  async getExpenseCategories() { if (this.mode === 'electron') return this.electronQuery("SELECT * FROM expense_categories WHERE is_deleted = 0 ORDER BY name"); return idbGetAll('expense_categories').then(r => r.filter(x => !x.is_deleted)); }
  async getExpenseCategoryById(id) { if (this.mode === 'electron') { const r = await this.electronQuery("SELECT * FROM expense_categories WHERE id = ?", [id]); return r[0] || null; } return idbGetById('expense_categories', id); }
  async createExpenseCategory(data) { if (this.mode === 'electron') return this.electronQuery("INSERT INTO expense_categories (name, description) VALUES (?, ?)", [data.name, data.description]); return idbAdd('expense_categories', { ...data, is_deleted: 0 }); }
  async updateExpenseCategory(id, data) { if (this.mode === 'electron') return this.electronQuery("UPDATE expense_categories SET name = ?, description = ? WHERE id = ?", [data.name, data.description, id]); const e = await idbGetById('expense_categories', id); return idbPut('expense_categories', { ...e, ...data }); }
  async deleteExpenseCategory(id) { if (this.mode === 'electron') return this.electronQuery("UPDATE expense_categories SET is_deleted = 1 WHERE id = ?", [id]); const e = await idbGetById('expense_categories', id); return idbPut('expense_categories', { ...e, is_deleted: 1 }); }

  // ==================== EXPENSES FULL CRUD (WITH AUTO LEDGER POSTING) ====================
  async getExpenses() { if (this.mode === 'electron') return this.electronQuery("SELECT e.*, ec.name as category_name FROM expenses e LEFT JOIN expense_categories ec ON e.category_id = ec.id WHERE e.is_deleted = 0 ORDER BY e.id DESC"); return idbGetAll('expenses').then(r => r.filter(x => !x.is_deleted)); }
  async getExpenseById(id) { if (this.mode === 'electron') { const r = await this.electronQuery("SELECT e.*, ec.name as category_name FROM expenses e LEFT JOIN expense_categories ec ON e.category_id = ec.id WHERE e.id = ?", [id]); return r[0] || null; } return idbGetById('expenses', id); }
  async createExpense(data) {
    if (this.mode === 'electron') {
      const result = await this.electronQuery(`INSERT INTO expenses (category_id, amount, description, date, payment_mode, reference_no) VALUES (?, ?, ?, ?, ?, ?)`, [data.category_id, data.amount, data.description, data.date, data.payment_mode, data.reference_no]);
      await this.logToGeneralLedger('expense', result.lastInsertRowid, data.amount, 0, `Expense: ${data.description}`);
      await this.logToGeneralLedger('cash', result.lastInsertRowid, 0, data.amount, `Cash/Bank out for expense: ${data.description}`);
      return result;
    }
    return idbAdd('expenses', { ...data, is_deleted: 0 });
  }
  async updateExpense(id, data) { if (this.mode === 'electron') return this.electronQuery(`UPDATE expenses SET category_id = ?, amount = ?, description = ?, date = ?, payment_mode = ?, reference_no = ? WHERE id = ?`, [data.category_id, data.amount, data.description, data.date, data.payment_mode, data.reference_no, id]); const e = await idbGetById('expenses', id); return idbPut('expenses', { ...e, ...data }); }
  async deleteExpense(id) { if (this.mode === 'electron') return this.electronQuery("UPDATE expenses SET is_deleted = 1 WHERE id = ?", [id]); const e = await idbGetById('expenses', id); return idbPut('expenses', { ...e, is_deleted: 1 }); }

  // ==================== DASHBOARD & SERIALIZED CORE SYSTEM ====================
  async getTopSellingProducts(dateFrom, dateTo, limit = 5) { if (this.mode === 'electron') return this.electronQuery(`SELECT si.product_id, p.name as product_name, pv.sku, SUM(si.quantity) as total_sold, SUM(si.total) as total_revenue FROM sale_items si JOIN sales s ON si.sale_id = s.id JOIN products p ON si.product_id = p.id JOIN product_variants pv ON si.product_variant_id = pv.id WHERE s.is_deleted = 0 AND date(s.date) BETWEEN date(?) AND date(?) GROUP BY si.product_variant_id ORDER BY total_sold DESC LIMIT ?`, [dateFrom, dateTo, limit]); return []; }
  async trackProductByIMEI(imei) { if (this.mode === 'electron') return this.electronQuery(`SELECT psi.*, p.name as product_name, pv.sku, pv.retail_price, s.invoice_no as sale_invoice, s.date as sold_on, c.name as sold_to FROM product_serialized_items psi LEFT JOIN product_variants pv ON psi.product_variant_id = pv.id LEFT JOIN products p ON pv.product_id = p.id LEFT JOIN sales s ON psi.sale_id = s.id LEFT JOIN customers c ON s.customer_id = c.id WHERE psi.serial_number_or_imei = ? OR psi.id = ?`, [imei, imei]); return []; }
  async addMultipleSerializedItems(variantId, imeiList) {
    if (!Array.isArray(imeiList) || imeiList.length === 0) return { success: false };
    const uniqueImeis = [...new Set(imeiList.map(i => String(i).trim()).filter(Boolean))];
    if (this.mode === 'electron') {
      const placeholders = uniqueImeis.map(() => '(?, ?, ?, ? )').join(', '); const flatParams = [];
      uniqueImeis.forEach(imei => flatParams.push(variantId, imei, 'available', null));
      return this.electronQuery(`INSERT OR IGNORE INTO product_serialized_items (product_variant_id, serial_number_or_imei, status, sale_id) VALUES ${placeholders}`, flatParams);
    }
    return { success: true };
  }

  // ==================== ACCOUNTING ENGINES ====================
  async getSalesHistory() { if (this.mode === 'electron') return this.electronQuery("SELECT * FROM sales WHERE is_deleted = 0 ORDER BY id DESC"); return idbGetAll('sales').then(r => r.filter(x => !x.is_deleted)); }

  async getGeneralLedger() { if (this.mode === 'electron') return this.electronQuery("SELECT * FROM general_ledger ORDER BY date DESC, id DESC"); return idbGetAll('general_ledger'); }
  async getGeneralLedgerByAccountType(accountType) { if (this.mode === 'electron') return this.electronQuery("SELECT * FROM general_ledger WHERE account_type = ? ORDER BY date DESC", [accountType]); return idbGetAll('general_ledger').then(r => r.filter(x => x.account_type === accountType)); }

  async logToGeneralLedger(accountType, referenceId, debit, credit, description) { if (this.mode === 'electron') return this.electronQuery(`INSERT INTO general_ledger (account_type, reference_id, debit, credit, description, date) VALUES (?, ?, ?, ?, ?, datetime('now'))`, [accountType, referenceId, debit, credit, description]); return []; }

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
      const c = await this.electronQuery("SELECT (COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0)) as val FROM general_ledger");
      const r = await this.electronQuery("SELECT COALESCE(SUM(current_balance), 0) as val FROM customers WHERE is_deleted = 0");
      const p = await this.electronQuery("SELECT COALESCE(SUM(current_balance), 0) as val FROM suppliers WHERE is_deleted = 0");
      const cashVal = c[0].val >= 0 ? c[0].val : 0;
      const totalAssets = this.safeAdd(this.safeAdd(s[0].val, cashVal), r[0].val);
      const totalLiabilities = p[0].val;
      const equity = this.safeSub(totalAssets, totalLiabilities);
      return {
        assets: { inventory_valuation: s[0].val, cash_and_bank: cashVal, accounts_receivable: r[0].val },
        liabilities: { accounts_payable: p[0].val },
        equity: { total: equity, retained_earnings: equity, owner_capital: 0 },
        totalAssets,
        totalLiabilities,
        totalEquity: equity
      };
    }
    return {};
  }

  async getTrialBalance() {
    if (this.mode === 'electron') {
      const rows = await this.electronQuery(`
        SELECT account_type, COALESCE(SUM(debit), 0) as total_debit, COALESCE(SUM(credit), 0) as total_credit
        FROM general_ledger GROUP BY account_type
      `);
      return rows;
    }
    return [];
  }
  // ==================== SALE ITEMS FULL CRUD ====================
async getSaleItems(saleId) {
  if (this.mode === 'electron') {
    return this.electronQuery(`
      SELECT si.*, p.name as product_name, pv.sku, pv.variant_name, pv.purchase_price as unit_cost
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN product_variants pv ON si.product_variant_id = pv.id
      WHERE si.sale_id = ?
      ORDER BY si.id
    `, [saleId]);
  }
  const [items, variants, prods] = await Promise.all([
    idbGetAll('sale_items'),
    idbGetAll('product_variants'),
    idbGetAll('products')
  ]);
  return items
    .filter(x => x.sale_id === Number(saleId))
    .map(i => {
      const v = variants.find(x => x.id === i.product_variant_id);
      const p = prods.find(x => x.id === i.product_id);
      return {
        ...i,
        product_name: p?.name || '',
        sku: v?.sku || '',
        variant_name: v?.variant_name || '',
        unit_cost: v?.purchase_price || 0
      };
    });
}

async getAllSaleItems() {
  if (this.mode === 'electron') {
    return this.electronQuery(`
      SELECT si.*, p.name as product_name, pv.sku, pv.variant_name, pv.purchase_price as unit_cost
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN product_variants pv ON si.product_variant_id = pv.id
      ORDER BY si.id DESC
    `);
  }
  const [items, variants, prods] = await Promise.all([
    idbGetAll('sale_items'),
    idbGetAll('product_variants'),
    idbGetAll('products')
  ]);
  return items.map(i => {
    const v = variants.find(x => x.id === i.product_variant_id);
    const p = prods.find(x => x.id === i.product_id);
    return {
      ...i,
      product_name: p?.name || '',
      sku: v?.sku || '',
      variant_name: v?.variant_name || '',
      unit_cost: v?.purchase_price || 0
    };
  });
}

  // ==================== ATOMIC SALE INSERT ENGINE ====================
  async createSale(data) {
    if (this.mode === 'electron') {
      const { sale, items } = data;
      const parentSql = `
        INSERT INTO sales (
          invoice_no, customer_id, customer_name, subtotal, item_discount,
          discount, tax, grand_total, paid_amount, due_amount,
          change_amount, payment_mode, payment_status, sale_type, date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const parentParams = [
        sale.invoice_no, sale.customer_id, sale.customer_name, sale.subtotal, sale.item_discount,
        sale.discount, sale.tax, sale.grand_total, sale.paid_amount, sale.due_amount,
        sale.change_amount, sale.payment_mode, sale.payment_status, sale.sale_type, sale.date
      ];
      const parentResult = await this.electronQuery(parentSql, parentParams);
      const insertedSaleId = parentResult.lastInsertRowid;

      const childSql = `
        INSERT INTO sale_items (
          sale_id, product_variant_id, product_id, quantity, price, discount, total
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      for (const item of items) {
        await this.electronQuery(childSql, [
          insertedSaleId, item.product_variant_id, item.product_id,
          item.quantity, item.price, item.discount, item.total
        ]);
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

  // ==================== FULL EMI ENGINE OPERATIONAL MATRIX ====================
  async getEMIs() { if (this.mode === 'electron') return this.electronQuery("SELECT * FROM emis ORDER BY id DESC"); return idbGetAll('emis'); }
  async createEMI(emi) {
    if (this.mode === 'electron') {
      return this.electronQuery(`INSERT INTO emis (customer_id, product_name, total_amount, down_payment, emi_amount, interest_rate, total_months, paid_months, start_date, next_due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [emi.customer_id, emi.product_name, emi.total_amount, emi.down_payment, emi.emi_amount, emi.interest_rate, emi.total_months, 0, emi.start_date, emi.next_due_date, 'active']);
    }
    return idbAdd('emis', emi);
  }
  async addEMIPayment(payment) {
    if (this.mode === 'electron') {
      return this.electronQuery(`INSERT INTO emi_payments (emi_id, amount, payment_date, payment_mode, notes) VALUES (?, ?, ?, ?, ?)`, [payment.emi_id, payment.amount, payment.payment_date, payment.payment_mode, payment.notes]);
    }
    return idbAdd('emi_payments', payment);
  }
  async getEMIPayments(emiId) { if (this.mode === 'electron') return this.electronQuery("SELECT * FROM emi_payments WHERE emi_id = ? ORDER BY id DESC", [emiId]); return idbGetAll('emi_payments').then(res => res.filter(p => p.emi_id === emiId)); }

  async getDashboardStats() { if (this.mode === 'electron') { const p = await this.electronQuery("SELECT COUNT(*) as count FROM products WHERE is_deleted = 0"); const c = await this.electronQuery("SELECT COUNT(*) as count FROM customers WHERE is_deleted = 0"); const s = await this.electronQuery("SELECT COALESCE(SUM(grand_total), 0) as total FROM sales WHERE DATE(date) = DATE('now') AND is_deleted = 0"); return { total_products: p[0].count, total_customers: c[0].count, today_sales: s[0].total }; } return { total_products: 0, total_customers: 0, today_sales: 0 }; }
  async getNextInvoiceNumber() { if (this.mode === 'electron') { const rows = await this.electronQuery("SELECT invoice_no FROM sales WHERE invoice_no LIKE 'INV-%' ORDER BY id DESC LIMIT 1"); if (rows.length === 0) return 'INV-0001'; return `INV-${String(parseInt(rows[0].invoice_no.split('-')[1]) + 1).padStart(4, '0')}`; } return 'INV-0001'; }

  // ==================== USERS / AUTHENTICATION FULL CRUD ====================
  async getUsers() {
    if (this.mode === 'electron') return this.electronQuery("SELECT id, name, email, phone, role, shop_name, shop_address, business_type, currency, status, created_at FROM users WHERE is_deleted = 0 ORDER BY name");
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
      return this.electronQuery(
        `INSERT INTO users (name, email, phone, password, password_hash, role, shop_name, shop_address, business_type, currency, status, is_deleted, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [data.name, data.email, data.phone, data.password, data.password_hash || data.password, data.role || 'admin', data.shop_name, data.shop_address, data.business_type || 'retail', data.currency || 'PKR', data.status || 'active', 0]
      );
    }
    return idbAdd('users', { ...data, is_deleted: 0, created_at: new Date().toISOString() });
  }

  async updateUser(id, data) {
    if (this.mode === 'electron') {
      const { password, password_hash, ...safeData } = data;
      return this.electronQuery(
        `UPDATE users SET name = ?, email = ?, phone = ?, role = ?, shop_name = ?, shop_address = ?, business_type = ?, currency = ?, status = ?, updated_at = datetime('now') WHERE id = ?`,
        [safeData.name, safeData.email, safeData.phone, safeData.role, safeData.shop_name, safeData.shop_address, safeData.business_type, safeData.currency, safeData.status, id]
      );
    }
    const e = await idbGetById('users', id);
    return idbPut('users', { ...e, ...data, updated_at: new Date().toISOString() });
  }

  async deleteUser(id) {
    if (this.mode === 'electron') return this.electronQuery("UPDATE users SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?", [id]);
    const e = await idbGetById('users', id);
    return idbPut('users', { ...e, is_deleted: 1 });
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
}

const db = new Storage();
export default db;