// ============================================================
//  backend/database/firebaseMigrate.js
//  Firebase Firestore → MySQL Migration Script
//  Multi-Tenant Support | Shop: shop_5PMP7Vvsa8NYiTWv7aG2kEsE0uB3
// ============================================================

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// CONFIG
const FIREBASE_SHOP_ID  = 'shop_5PMP7Vvsa8NYiTWv7aG2kEsE0uB3';
const TENANT_ID         = 'shop_5PMP7Vvsa8NYiTWv7aG2kEsE0uB3';
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../firebase-service-account.json');

const DB_CONFIG = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT, 10) || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'raath_pos_db',
  multipleStatements: true,
  charset: 'utf8mb4',
};

// HELPERS
const log   = (msg)      => console.log('\x1b[32m[MIGRATE]\x1b[0m ' + msg);
const warn  = (msg)      => console.log('\x1b[33m[WARN]\x1b[0m    ' + msg);
const error = (msg, err) => console.error('\x1b[31m[ERROR]\x1b[0m   ' + msg, (err && err.message) || '');

const toDecimal = (val) => {
  if (val === null || val === undefined) return 0;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
};

const toDatetime = (val) => {
  if (!val) return null;
  try {
    if (val && typeof val.toDate === 'function') return val.toDate().toISOString().slice(0, 19).replace('T', ' ');
    if (val && val.seconds) return new Date(val.seconds * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 19).replace('T', ' ');
  } catch(e) {}
  return null;
};

const str = (val, maxLen = 150) => {
  if (val === null || val === undefined) return null;
  return String(val).slice(0, maxLen);
};

// STATS
const stats = {
  tenants: 0, categories: 0, brands: 0, suppliers: 0, customers: 0,
  products: 0, variants: 0, purchases: 0, purchase_items: 0,
  sales: 0, sale_items: 0, expenses: 0, accounts: 0, account_txns: 0, errors: 0,
};

// CLEAN PREVIOUS RUNS (Idempotency - avoids 4x duplicate copies)
async function cleanTenantData(db) {
  log('Cleaning previous records for tenant ' + TENANT_ID + ' to avoid duplicates...');
  await db.query('SET FOREIGN_KEY_CHECKS = 0');
  const tables = [
    'sale_items', 'sales', 'purchase_items', 'purchases',
    'product_variants', 'products', 'customers', 'suppliers',
    'brands', 'categories', 'expenses', 'account_transactions', 'accounts'
  ];
  for (const table of tables) {
    await db.query('DELETE FROM ' + table + ' WHERE tenant_id = ?', [TENANT_ID]);
  }
  await db.query('SET FOREIGN_KEY_CHECKS = 1');
  log('Clean up complete. Fresh migration starting.');
}

// STEP 1: TENANT
async function migrateTenant(db, shopDoc) {
  log('Migrating shop as tenant...');
  const d = shopDoc.data() || {};
  await db.query(
    'INSERT INTO tenants (id, name, shop_name, shop_address, phone, email, status, created_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, "active", ?) ' +
    'ON DUPLICATE KEY UPDATE shop_name=VALUES(shop_name), shop_address=VALUES(shop_address), phone=VALUES(phone), email=VALUES(email)',
    [
      TENANT_ID,
      str(d.owner_email || d.email || 'Shop Owner', 150),
      str(d.shop_name || d.name || 'raath', 150),
      str(d.shop_address || d.address || 'anakar kali bazar', 500),
      str(d.phone || '3030300303', 50),
      str(d.email || d.owner_email || 'hafeezraath806@gmail.com', 100),
      toDatetime(d.created_at) || new Date().toISOString().slice(0, 19).replace('T', ' '),
    ]
  );
  stats.tenants++;
  log('Tenant saved: ' + TENANT_ID);
}

// STEP 2: CATEGORIES
async function migrateCategories(db, snapshot) {
  log('Migrating ' + snapshot.size + ' categories...');
  const idMap = {};
  for (const doc of snapshot.docs) {
    const d = doc.data();
    if (!d.name) continue;
    try {
      const slugBase = str(d.slug || d.name.toLowerCase().replace(/[^a-z0-9]/g, '-') || doc.id, 90);
      const slug = slugBase + '_' + doc.id.slice(0, 8);
      const [res] = await db.query(
        'INSERT INTO categories (tenant_id, name, slug, status, is_deleted, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [TENANT_ID, str(d.name, 150), slug, d.status || 'active', d.is_deleted ? 1 : 0, toDatetime(d.created_at)]
      );
      idMap[doc.id] = res.insertId;
      stats.categories++;
    } catch(e) { warn('Category skip [' + doc.id + ']: ' + e.message); stats.errors++; }
  }
  log('Categories: ' + stats.categories + ' saved');
  return idMap;
}

// STEP 3: BRANDS
async function migrateBrands(db, snapshot) {
  log('Migrating ' + snapshot.size + ' brands...');
  const idMap = {};
  for (const doc of snapshot.docs) {
    const d = doc.data();
    if (!d.name) continue;
    try {
      const [res] = await db.query(
        'INSERT INTO brands (tenant_id, name, status, is_deleted, created_at) VALUES (?, ?, ?, ?, ?)',
        [TENANT_ID, str(d.name, 150), d.status || 'active', d.is_deleted ? 1 : 0, toDatetime(d.created_at)]
      );
      idMap[doc.id] = res.insertId;
      stats.brands++;
    } catch(e) { warn('Brand skip [' + doc.id + ']: ' + e.message); stats.errors++; }
  }
  log('Brands: ' + stats.brands + ' saved');
  return idMap;
}

// STEP 4: SUPPLIERS
async function migrateSuppliers(db, snapshot) {
  log('Migrating ' + snapshot.size + ' suppliers...');
  const idMap = {};
  for (const doc of snapshot.docs) {
    const d = doc.data();
    if (!d.name) continue;
    try {
      const [res] = await db.query(
        'INSERT INTO suppliers (tenant_id, name, company_name, phone, email, vat_ntn_number, address, opening_balance, current_balance, status, is_deleted, created_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          TENANT_ID, str(d.name, 150), str(d.company_name || d.companyName || '', 150),
          str(d.phone || d.contact || '', 50), str(d.email || '', 150),
          str(d.vat_ntn_number || d.ntn || d.vat || '', 50), str(d.address || '', 500),
          toDecimal(d.opening_balance || d.openingBalance),
          toDecimal(d.current_balance || d.currentBalance || d.balance),
          d.status || 'active', d.is_deleted ? 1 : 0, toDatetime(d.created_at),
        ]
      );
      idMap[doc.id] = res.insertId;
      stats.suppliers++;
    } catch(e) { warn('Supplier skip [' + doc.id + ']: ' + e.message); stats.errors++; }
  }
  log('Suppliers: ' + stats.suppliers + ' saved');
  return idMap;
}

// STEP 5: CUSTOMERS
async function migrateCustomers(db, snapshot) {
  log('Migrating ' + snapshot.size + ' customers...');
  const idMap = {};
  for (const doc of snapshot.docs) {
    const d = doc.data();
    if (!d.name) continue;
    try {
      const [res] = await db.query(
        'INSERT INTO customers (tenant_id, name, phone, email, cnic, address, city, district, province, shop_name, customer_type, opening_balance, current_balance, credit_limit, payment_terms, status, notes, is_deleted, created_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          TENANT_ID, str(d.name, 150), str(d.phone || d.contact || '', 50),
          str(d.email || '', 150), str(d.cnic || '', 50), str(d.address || '', 500),
          str(d.city || '', 100), str(d.district || '', 100), str(d.province || '', 100),
          str(d.shop_name || d.shopName || '', 150), str(d.customer_type || d.type || 'retail', 50),
          toDecimal(d.opening_balance || d.openingBalance),
          toDecimal(d.current_balance || d.currentBalance || d.balance),
          toDecimal(d.credit_limit || d.creditLimit),
          str(d.payment_terms || 'cash', 50), d.status || 'active',
          str(d.notes || '', 500), d.is_deleted ? 1 : 0, toDatetime(d.created_at),
        ]
      );
      idMap[doc.id] = res.insertId;
      stats.customers++;
    } catch(e) { warn('Customer skip [' + doc.id + ']: ' + e.message); stats.errors++; }
  }
  log('Customers: ' + stats.customers + ' saved');
  return idMap;
}

// STEP 6: PRODUCTS + VARIANTS (With Price & Stock Sync from product_variants)
async function migrateProducts(db, productsSnapshot, variantsSnapshot, categoryIdMap, brandIdMap) {
  log('Migrating ' + productsSnapshot.size + ' products with ' + variantsSnapshot.size + ' variants...');
  
  // Group variants by product_id
  const variantsByProductId = {};
  for (const vDoc of variantsSnapshot.docs) {
    const vd = vDoc.data();
    const pid = vd.product_id || vd.productId;
    if (!pid) continue;
    if (!variantsByProductId[pid]) variantsByProductId[pid] = [];
    variantsByProductId[pid].push({ id: vDoc.id, ...vd });
  }

  const productIdMap = {};
  const variantIdMap = {};

  for (const doc of productsSnapshot.docs) {
    const d = doc.data();
    if (!d.name) continue;
    try {
      const catId   = categoryIdMap[d.category_id || d.categoryId] || null;
      const brandId = brandIdMap[d.brand_id || d.brandId] || null;
      const variants = variantsByProductId[doc.id] || [];

      // Determine prices & stock from variants or fallback to product doc
      let purchasePrice = 0;
      let retailPrice = 0;
      let wholesalePrice = 0;
      let minPrice = 0;
      let totalStock = 0;
      let sku = str(d.sku || '', 100);
      let barcode = str(d.barcode || '', 100);

      if (variants.length > 0) {
        const primary = variants[0];
        purchasePrice = toDecimal(primary.purchase_price || primary.cost_price || 0);
        retailPrice   = toDecimal(primary.retail_price || primary.sale_price || primary.price || 0);
        wholesalePrice = toDecimal(primary.wholesale_price || 0);
        minPrice      = toDecimal(primary.minimum_retail_price || primary.min_price || 0);
        sku           = str(primary.sku || sku || '', 100);
        barcode       = str(primary.barcode || barcode || '', 100);

        for (const v of variants) {
          totalStock += toDecimal(v.current_stock || v.stock || 0);
        }
      } else {
        purchasePrice = toDecimal(d.purchase_price || d.purchasePrice || d.cost_price || 0);
        retailPrice   = toDecimal(d.retail_price || d.retailPrice || d.sale_price || d.salePrice || d.price || 0);
        wholesalePrice = toDecimal(d.wholesale_price || d.wholesalePrice || 0);
        minPrice      = toDecimal(d.min_price || d.minPrice || 0);
        totalStock    = toDecimal(d.stock || d.quantity || d.current_stock || 0);
      }

      const salePrice = retailPrice;

      const [res] = await db.query(
        'INSERT INTO products (tenant_id, name, brand_id, category_id, type, unit, sku, barcode, purchase_price, sale_price, retail_price, wholesale_price, min_price, stock, min_stock, tax_type, tax_rate, is_serialized, description, status, image_url, is_deleted, created_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          TENANT_ID, str(d.name, 200), brandId, catId, str(d.type || 'single', 50), str(d.unit || 'Piece', 50),
          sku, barcode,
          purchasePrice, salePrice, retailPrice, wholesalePrice, minPrice,
          totalStock,
          toDecimal(d.min_stock || d.minStock || d.stock_alert || 5),
          str(d.tax_type || 'inclusive', 50), toDecimal(d.tax_rate || d.taxRate || 0),
          d.is_serialized ? 1 : 0, str(d.description || '', 1000), d.status || 'active',
          str(d.image_url || d.imageUrl || d.image || '', 2000),
          d.is_deleted ? 1 : 0, toDatetime(d.created_at || d.updated_at),
        ]
      );
      
      const newProductId = res.insertId;
      productIdMap[doc.id] = newProductId;
      stats.products++;

      // Insert Variants into product_variants table
      if (variants.length > 0) {
        for (const v of variants) {
          const vPurchase = toDecimal(v.purchase_price || v.cost_price || purchasePrice);
          const vRetail   = toDecimal(v.retail_price || v.sale_price || v.price || retailPrice);
          const vWholesale = toDecimal(v.wholesale_price || wholesalePrice);
          const vMinPrice = toDecimal(v.minimum_retail_price || minPrice);
          const vStock    = toDecimal(v.current_stock || v.stock || 0);
          const vName     = str(v.variant_name || v.name || 'Default', 150);

          const [vRes] = await db.query(
            'INSERT INTO product_variants (tenant_id, product_id, variant_name, name, sku, barcode, purchase_price, retail_price, sale_price, wholesale_price, minimum_retail_price, current_stock, stock, stock_alert_quantity, is_deleted, created_at) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              TENANT_ID, newProductId, vName, vName,
              str(v.sku || sku || '', 100), str(v.barcode || barcode || '', 100),
              vPurchase, vRetail, vRetail, vWholesale, vMinPrice,
              vStock, vStock, toDecimal(v.stock_alert_quantity || 5),
              v.is_deleted ? 1 : 0, toDatetime(v.created_at || v.updated_at)
            ]
          );
          variantIdMap[v.id] = vRes.insertId;
          stats.variants++;
        }
      } else {
        // Create 1 default variant for products without explicit variants
        const [vRes] = await db.query(
          'INSERT INTO product_variants (tenant_id, product_id, variant_name, name, sku, barcode, purchase_price, retail_price, sale_price, wholesale_price, minimum_retail_price, current_stock, stock, stock_alert_quantity, is_deleted, created_at) ' +
          'VALUES (?, ?, "Default", "Default", ?, ?, ?, ?, ?, ?, ?, ?, ?, 5, 0, ?)',
          [
            TENANT_ID, newProductId, sku, barcode,
            purchasePrice, retailPrice, salePrice, wholesalePrice, minPrice,
            totalStock, totalStock, toDatetime(d.created_at || d.updated_at)
          ]
        );
        variantIdMap[doc.id] = vRes.insertId;
        stats.variants++;
      }
    } catch(e) { warn('Product skip [' + doc.id + ']: ' + e.message); stats.errors++; }
  }

  log('Products: ' + stats.products + ' saved with prices/stock! Variants: ' + stats.variants);
  return { productIdMap, variantIdMap };
}

// STEP 7: PURCHASES + ITEMS
async function migratePurchases(db, snapshot, supplierIdMap, productIdMap) {
  log('Migrating ' + snapshot.size + ' purchases...');
  for (const doc of snapshot.docs) {
    const d = doc.data();
    try {
      const supplierId = supplierIdMap[d.supplier_id || d.supplierId] || null;
      const [res] = await db.query(
        'INSERT INTO purchases (tenant_id, purchase_no, supplier_id, supplier_name, purchase_date, subtotal, discount, discount_amount, tax_amount, shipping_cost, grand_total, paid_amount, due_amount, payment_method, payment_status, notes, status, is_deleted, created_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          TENANT_ID, str(d.purchase_no || d.purchaseNo || d.invoice_no || doc.id, 100),
          supplierId, str(d.supplier_name || d.supplierName || '', 150),
          toDatetime(d.purchase_date || d.created_at),
          toDecimal(d.subtotal), toDecimal(d.discount), toDecimal(d.discount_amount || d.discountAmount),
          toDecimal(d.tax_amount || d.taxAmount), toDecimal(d.shipping_cost || d.shippingCost),
          toDecimal(d.grand_total || d.grandTotal || d.total_amount || d.total),
          toDecimal(d.paid_amount || d.paidAmount), toDecimal(d.due_amount || d.dueAmount || 0),
          str(d.payment_method || d.paymentMethod || 'cash', 50),
          str(d.payment_status || d.paymentStatus || 'paid', 50),
          str(d.notes || '', 500), str(d.status || 'received', 50),
          d.is_deleted ? 1 : 0, toDatetime(d.created_at),
        ]
      );
      stats.purchases++;
      const purchaseId = res.insertId;
      const items = d.items || d.purchase_items || [];
      for (const item of items) {
        const prodId = productIdMap[item.product_id || item.productId] || null;
        try {
          await db.query(
            'INSERT INTO purchase_items (tenant_id, purchase_id, product_id, product_name, quantity, unit_cost, total, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
              TENANT_ID, purchaseId, prodId, str(item.product_name || item.name || '', 200),
              toDecimal(item.quantity || item.qty || 1),
              toDecimal(item.unit_cost || item.cost_price || item.purchase_price || 0),
              toDecimal(item.total_cost || item.sub_total || item.total || 0),
              toDatetime(d.created_at)
            ]
          );
          stats.purchase_items++;
        } catch(e) { warn('Purchase item skip: ' + e.message); }
      }
    } catch(e) { warn('Purchase skip [' + doc.id + ']: ' + e.message); stats.errors++; }
  }
  log('Purchases: ' + stats.purchases + ', Items: ' + stats.purchase_items);
}

// STEP 8: SALES + ITEMS
async function migrateSales(db, snapshot, customerIdMap, productIdMap) {
  log('Migrating ' + snapshot.size + ' sales...');
  for (const doc of snapshot.docs) {
    const d = doc.data();
    try {
      const custId = customerIdMap[d.customer_id || d.customerId] || null;
      const [res] = await db.query(
        'INSERT INTO sales (tenant_id, invoice_no, customer_id, customer_name, sale_date, subtotal, discount, tax, grand_total, paid_amount, due_amount, payment_mode, payment_status, fbr_status, notes, status, is_deleted, created_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
        'ON DUPLICATE KEY UPDATE grand_total=VALUES(grand_total), paid_amount=VALUES(paid_amount)',
        [
          TENANT_ID, str(d.invoice_no || d.invoiceNo || d.sale_no || doc.id, 100),
          custId, str(d.customer_name || d.customerName || 'Walk-in Customer', 150),
          toDatetime(d.sale_date || d.date || d.created_at),
          toDecimal(d.subtotal),
          toDecimal(d.discount || d.discount_amount || d.discountAmount),
          toDecimal(d.tax_amount || d.taxAmount || d.tax),
          toDecimal(d.grand_total || d.grandTotal || d.total_amount || d.total),
          toDecimal(d.paid_amount || d.paidAmount || d.grand_total || d.total),
          toDecimal(d.due_amount || d.dueAmount || 0),
          str(d.payment_mode || d.payment_method || 'cash', 50),
          str(d.payment_status || d.paymentStatus || 'paid', 50),
          str(d.fbr_status || 'PENDING', 50), str(d.notes || '', 500),
          str(d.status || 'completed', 50), d.is_deleted ? 1 : 0, toDatetime(d.created_at),
        ]
      );
      stats.sales++;
      const saleId = res.insertId;
      const items = d.items || d.sale_items || [];
      for (const item of items) {
        const prodId = productIdMap[item.product_id || item.productId] || null;
        try {
          await db.query(
            'INSERT INTO sale_items (tenant_id, sale_id, product_id, product_name, quantity, unit_price, discount, total, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              TENANT_ID, saleId, prodId, str(item.product_name || item.name || '', 200),
              toDecimal(item.quantity || item.qty || 1),
              toDecimal(item.unit_price || item.sale_price || item.price || 0),
              toDecimal(item.discount || 0),
              toDecimal(item.total_price || item.total || 0),
              toDatetime(d.created_at)
            ]
          );
          stats.sale_items++;
        } catch(e) { warn('Sale item skip: ' + e.message); }
      }
    } catch(e) { warn('Sale skip [' + doc.id + ']: ' + e.message); stats.errors++; }
  }
  log('Sales: ' + stats.sales + ', Items: ' + stats.sale_items);
}

// STEP 9: EXPENSES
async function migrateExpenses(db, snapshot) {
  log('Migrating ' + snapshot.size + ' expenses...');
  for (const doc of snapshot.docs) {
    const d = doc.data();
    try {
      await db.query(
        'INSERT INTO expenses (tenant_id, title, category_id, amount, date, payment_method, description, status, is_deleted, created_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          TENANT_ID,
          str(d.title || d.description || d.expense_name || 'General Expense', 150),
          null,
          toDecimal(d.amount),
          toDatetime(d.expense_date || d.date || d.created_at) || new Date().toISOString().slice(0, 10),
          str(d.payment_method || d.paymentMethod || 'cash', 50),
          str(d.description || d.note || '', 500),
          d.status || 'paid',
          d.is_deleted ? 1 : 0,
          toDatetime(d.created_at),
        ]
      );
      stats.expenses++;
    } catch(e) { warn('Expense skip [' + doc.id + ']: ' + e.message); stats.errors++; }
  }
  log('Expenses: ' + stats.expenses + ' saved');
}

// STEP 10: ACCOUNTS
async function migrateAccounts(db, snapshot) {
  log('Migrating ' + snapshot.size + ' accounts...');
  const idMap = {};
  for (const doc of snapshot.docs) {
    const d = doc.data();
    if (!d.name) continue;
    try {
      const [res] = await db.query(
        'INSERT INTO accounts (tenant_id, name, type, account_number, bank_name, opening_balance, current_balance, status, is_deleted, created_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          TENANT_ID, str(d.name, 150), str(d.type || d.account_type || 'cash', 50),
          str(d.account_number || d.accountNumber || '', 100), str(d.bank_name || d.bankName || '', 150),
          toDecimal(d.opening_balance || d.openingBalance),
          toDecimal(d.current_balance || d.currentBalance || d.balance),
          str(d.status || 'active', 20), d.is_deleted ? 1 : 0, toDatetime(d.created_at)
        ]
      );
      idMap[doc.id] = res.insertId;
      stats.accounts++;
    } catch(e) { warn('Account skip [' + doc.id + ']: ' + e.message); stats.errors++; }
  }
  log('Accounts: ' + stats.accounts + ' saved');
  return idMap;
}

// STEP 11: ACCOUNT TRANSACTIONS
async function migrateAccountTransactions(db, snapshot, accountIdMap) {
  log('Migrating ' + snapshot.size + ' account transactions...');
  for (const doc of snapshot.docs) {
    const d = doc.data();
    try {
      const accId = accountIdMap[d.account_id || d.accountId] || null;
      await db.query(
        'INSERT INTO account_transactions (tenant_id, account_id, type, amount, balance_after, reference_type, reference_id, description, date, created_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          TENANT_ID, accId, str(d.type || d.transaction_type || 'credit', 50),
          toDecimal(d.amount), toDecimal(d.balance_after || d.running_balance || d.balance),
          str(d.reference_type || d.refType || '', 50),
          parseInt(d.reference_id || d.refId || 0) || null,
          str(d.description || d.notes || '', 500),
          toDatetime(d.transaction_date || d.date || d.created_at), toDatetime(d.created_at)
        ]
      );
      stats.account_txns++;
    } catch(e) { warn('Account txn skip [' + doc.id + ']: ' + e.message); stats.errors++; }
  }
  log('Account Transactions: ' + stats.account_txns + ' saved');
}

// SAFE FETCH
async function safeGet(collRef) {
  try { return await collRef.get(); }
  catch(e) { warn('Collection fetch failed: ' + e.message); return { docs: [], size: 0 }; }
}

// MAIN
async function runMigration() {
  console.log('\n' + '='.repeat(60));
  console.log(' Firebase to MySQL Migration');
  console.log(' Shop: ' + FIREBASE_SHOP_ID);
  console.log(' Tenant ID: ' + TENANT_ID);
  console.log('='.repeat(60) + '\n');

  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('\x1b[31m[ERROR]\x1b[0m firebase-service-account.json nahi mili!');
    process.exit(1);
  }

  log('Connecting to Firebase...');
  const serviceAccount = require(SERVICE_ACCOUNT_PATH);
  if (!getApps().length) {
    initializeApp({ credential: cert(serviceAccount) });
  }
  const firestore = getFirestore();
  log('Firebase connected: ' + (serviceAccount.project_id || 'ok'));

  log('Connecting to MySQL...');
  const db = await mysql.createConnection(DB_CONFIG);
  await db.query('SET NAMES utf8mb4');
  log('MySQL connected: ' + DB_CONFIG.database);

  try {
    const shopRef = firestore.collection('shops').doc(FIREBASE_SHOP_ID);
    const shopDoc = await shopRef.get();
    if (!shopDoc.exists) {
      error('Shop nahi mila: shops/' + FIREBASE_SHOP_ID);
      process.exit(1);
    }
    log('Shop found: ' + (shopDoc.data().shop_name || FIREBASE_SHOP_ID));

    // 1. Clean previous data for this tenant to ensure NO DUPLICATES
    await cleanTenantData(db);

    // 2. Migrate Tenant Info
    await migrateTenant(db, shopDoc);

    log('\nFetching Firebase collections...');
    const categoriesSnap  = await safeGet(shopRef.collection('categories'));
    const brandsSnap      = await safeGet(shopRef.collection('brands'));
    const suppliersSnap   = await safeGet(shopRef.collection('suppliers'));
    const customersSnap   = await safeGet(shopRef.collection('customers'));
    const productsSnap    = await safeGet(shopRef.collection('products'));
    const variantsSnap    = await safeGet(shopRef.collection('product_variants'));
    const purchasesSnap   = await safeGet(shopRef.collection('purchases'));
    const salesSnap       = await safeGet(shopRef.collection('sales'));
    const expensesSnap    = await safeGet(shopRef.collection('expenses'));
    const accountsSnap    = await safeGet(shopRef.collection('accounts'));
    const accountTxnsSnap = await safeGet(shopRef.collection('account_transactions'));

    log('Categories=' + categoriesSnap.size + ', Brands=' + brandsSnap.size +
        ', Suppliers=' + suppliersSnap.size + ', Customers=' + customersSnap.size);
    log('Products=' + productsSnap.size + ', Variants=' + variantsSnap.size +
        ', Purchases=' + purchasesSnap.size + ', Sales=' + salesSnap.size);
    log('Expenses=' + expensesSnap.size + ', Accounts=' + accountsSnap.size +
        ', AccountTxns=' + accountTxnsSnap.size);
    console.log('');

    const categoryIdMap = await migrateCategories(db, categoriesSnap);
    const brandIdMap    = await migrateBrands(db, brandsSnap);
    const supplierIdMap = await migrateSuppliers(db, suppliersSnap);
    const customerIdMap = await migrateCustomers(db, customersSnap);
    
    // Migrate products with variants, stock, and prices
    const { productIdMap } = await migrateProducts(db, productsSnap, variantsSnap, categoryIdMap, brandIdMap);
    const accountIdMap  = await migrateAccounts(db, accountsSnap);

    await migratePurchases(db, purchasesSnap, supplierIdMap, productIdMap);
    await migrateSales(db, salesSnap, customerIdMap, productIdMap);
    await migrateExpenses(db, expensesSnap);
    await migrateAccountTransactions(db, accountTxnsSnap, accountIdMap);

    console.log('\n' + '='.repeat(60));
    console.log(' MIGRATION COMPLETE! (NO DUPLICATES, ACCURATE PRICES)');
    console.log('='.repeat(60));
    console.log('  Tenant        : 1');
    console.log('  Categories    : ' + stats.categories);
    console.log('  Brands        : ' + stats.brands);
    console.log('  Suppliers     : ' + stats.suppliers);
    console.log('  Customers     : ' + stats.customers);
    console.log('  Products      : ' + stats.products);
    console.log('  Variants      : ' + stats.variants);
    console.log('  Purchases     : ' + stats.purchases);
    console.log('  Purchase Items: ' + stats.purchase_items);
    console.log('  Sales         : ' + stats.sales);
    console.log('  Sale Items    : ' + stats.sale_items);
    console.log('  Expenses      : ' + stats.expenses);
    console.log('  Accounts      : ' + stats.accounts);
    console.log('  Account Txns  : ' + stats.account_txns);
    console.log('  Errors/Skips  : ' + stats.errors);
    console.log('='.repeat(60) + '\n');

  } catch(e) {
    error('Fatal Migration Error', e);
  } finally {
    await db.end();
    log('Database connection closed.');
  }
}

runMigration().catch(console.error);
