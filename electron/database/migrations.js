// ============================================================
//  migrations.js - Updates, Seeding & Indexing
// ============================================================
const { log, LOG_LEVELS } = require('../logger');
const { hashPassword } = require('../security');
const CONFIG = require('../config');

function runMigrations(db) {
  const tablesNeedIsDeleted = [
    'brands', 'categories', 'products', 'product_variants', 'product_serialized_items',
    'suppliers', 'purchases', 'customers', 'sales', 'expense_categories',
    'expenses', 'sale_returns', 'users', 'warehouses', 'deals', 'offers',
    'services', 'staff', 'work_orders', 'payments', 'emi_records', 'purchase_returns',
    'salesmen', 'salesman_sales', 'customer_sales_history'
  ];
  tablesNeedIsDeleted.forEach(table => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN is_deleted INTEGER DEFAULT 0`); } catch (e) {}
  });

  const tablesNeedDeletedAt = [
    'brands', 'categories', 'products', 'product_variants', 'suppliers',
    'purchases', 'customers', 'sales', 'expenses', 'sale_returns',
    'users', 'deals', 'offers', 'services', 'staff', 'work_orders',
    'payments', 'emi_records', 'roles', 'purchase_returns',
    'salesmen', 'salesman_sales', 'customer_sales_history'
  ];
  tablesNeedDeletedAt.forEach(table => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN deleted_at TEXT`); } catch (e) {}
  });

  try { db.exec(`ALTER TABLE products ADD COLUMN image_url TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE product_variants ADD COLUMN image_url TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE products ADD COLUMN is_serialized INTEGER DEFAULT 0`); } catch (e) {}

  try {
    const columns = db.prepare("PRAGMA table_info(users)").all();
    const hasPassword = columns.some(c => c.name === 'password');
    const hasPasswordHash = columns.some(c => c.name === 'password_hash');
    
    if (hasPassword && !hasPasswordHash) {
      db.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT`);
      db.exec(`ALTER TABLE users ADD COLUMN password_legacy TEXT`);
      
      const users = db.prepare("SELECT id, password FROM users WHERE password IS NOT NULL").all();
      for (const user of users) {
        if (user.password) {
          const hashed = hashPassword(user.password);
          db.prepare("UPDATE users SET password_hash = ?, password_legacy = ? WHERE id = ?")
            .run(hashed, user.password, user.id);
        }
      }
      log(LOG_LEVELS.INFO, 'Password migration completed');
    }
  } catch (e) {
    log(LOG_LEVELS.WARN, 'Password migration error:', e);
  }

  try { db.exec(`ALTER TABLE purchases ADD COLUMN payment_mode TEXT DEFAULT 'cash'`); } catch (e) {}
  try { db.exec(`ALTER TABLE emi_payments ADD COLUMN payment_mode TEXT DEFAULT 'cash'`); } catch (e) {}
  try { db.exec(`ALTER TABLE emi_payments ADD COLUMN notes TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE emi_payments ADD COLUMN month_number INTEGER DEFAULT 0`); } catch (e) {}
  try { db.exec(`ALTER TABLE emi_payments ADD COLUMN late_fee DECIMAL(15,2) DEFAULT 0`); } catch (e) {}
  try { db.exec(`ALTER TABLE emi_payments ADD COLUMN discount DECIMAL(15,2) DEFAULT 0`); } catch (e) {}
  try { db.exec(`ALTER TABLE emi_payments ADD COLUMN received_by TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE emi_payments ADD COLUMN due_date TEXT`); } catch (e) {}
  
  try { db.exec(`ALTER TABLE emi_records ADD COLUMN application_no TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE emi_records ADD COLUMN product_variant_id INTEGER`); } catch (e) {}
  try { db.exec(`ALTER TABLE emi_records ADD COLUMN product_sku TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE emi_records ADD COLUMN product_retail_price DECIMAL(15,2) DEFAULT 0`); } catch (e) {}
  try { db.exec(`ALTER TABLE emi_records ADD COLUMN product_cost_price DECIMAL(15,2) DEFAULT 0`); } catch (e) {}
  try { db.exec(`ALTER TABLE emi_records ADD COLUMN remaining_amount DECIMAL(15,2) DEFAULT 0`); } catch (e) {}
  try { db.exec(`ALTER TABLE emi_records ADD COLUMN due_day INTEGER DEFAULT 1`); } catch (e) {}
  try { db.exec(`ALTER TABLE emi_records ADD COLUMN salesman_id INTEGER`); } catch (e) {}
  try { db.exec(`ALTER TABLE emi_records ADD COLUMN shop_location TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE emi_records ADD COLUMN agreement_signed INTEGER DEFAULT 0`); } catch (e) {}
  try { db.exec(`ALTER TABLE emi_records ADD COLUMN agreement_date TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE emi_records ADD COLUMN updated_at DATETIME`); } catch (e) {}
  
  try { db.exec(`ALTER TABLE customer_ledger ADD COLUMN previous_balance DECIMAL(15,2) DEFAULT 0`); } catch (e) {}
  try { db.exec(`ALTER TABLE customer_ledger ADD COLUMN items_json TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE purchase_returns ADD COLUMN created_by INTEGER`); } catch (e) {}

  const fbrColumns = [
    { name: 'customer_ntn', type: 'TEXT' },
    { name: 'fbr_status', type: 'TEXT DEFAULT "PENDING"' },
    { name: 'fbr_reference', type: 'TEXT' },
    { name: 'fbr_synced_at', type: 'DATETIME' },
    { name: 'fbr_tax_rate', type: 'DECIMAL(5,2) DEFAULT 0' },
    { name: 'fbr_tax_amount', type: 'DECIMAL(15,2) DEFAULT 0' },
    { name: 'fbr_enabled', type: 'INTEGER DEFAULT 0' },
    { name: 'fbr_business_type', type: 'TEXT DEFAULT "retail"' }
  ];
  for (const col of fbrColumns) {
    try {
      db.prepare(`SELECT ${col.name} FROM sales LIMIT 1`).get();
    } catch (e) {
      try { db.exec(`ALTER TABLE sales ADD COLUMN ${col.name} ${col.type}`); } catch (err) {}
    }
  }

  try { db.exec(`ALTER TABLE sales ADD COLUMN fbr_mode INTEGER DEFAULT 0`); } catch (e) {}
  try { db.exec(`ALTER TABLE sales ADD COLUMN dummy_fbr_reference TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE sales ADD COLUMN tax_type TEXT DEFAULT 'inclusive'`); } catch (e) {}
  try { db.exec(`ALTER TABLE sales ADD COLUMN tax_rate DECIMAL(5,2) DEFAULT 0`); } catch (e) {}

  try { db.exec(`ALTER TABLE staff ADD COLUMN commission_rate DECIMAL(5,2) DEFAULT 0`); } catch (e) {}
  try { db.exec(`ALTER TABLE staff ADD COLUMN base_salary DECIMAL(15,2) DEFAULT 0`); } catch (e) {}
  try { db.exec(`ALTER TABLE work_orders ADD COLUMN device_model TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE work_orders ADD COLUMN imei TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE work_orders ADD COLUMN problem_description TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE work_orders ADD COLUMN payment_status TEXT DEFAULT 'unpaid'`); } catch (e) {}
  try { db.exec(`ALTER TABLE work_orders ADD COLUMN payment_mode TEXT DEFAULT 'pending'`); } catch (e) {}
  try { db.exec(`ALTER TABLE work_orders ADD COLUMN commission_amount DECIMAL(15,2) DEFAULT 0`); } catch (e) {}
  try { db.exec(`ALTER TABLE work_orders ADD COLUMN completed_at DATETIME`); } catch (e) {}

  try { db.exec(`ALTER TABLE salesmen ADD COLUMN updated_at DATETIME`); } catch (e) {}
  try { db.exec(`ALTER TABLE salesman_sales ADD COLUMN payment_term INTEGER DEFAULT 0`); } catch (e) {}
  try { db.exec(`ALTER TABLE salesman_sales ADD COLUMN payment_term_type TEXT DEFAULT 'Days'`); } catch (e) {}
  try { db.exec(`ALTER TABLE salesman_sales ADD COLUMN commission_amount DECIMAL(15,2) DEFAULT 0`); } catch (e) {}
  try { db.exec(`ALTER TABLE salesman_sales ADD COLUMN paid_amount DECIMAL(15,2) DEFAULT 0`); } catch (e) {}
  try { db.exec(`ALTER TABLE salesman_sales ADD COLUMN due_amount DECIMAL(15,2) DEFAULT 0`); } catch (e) {}
  try { db.exec(`ALTER TABLE salesman_sales ADD COLUMN customer_name TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE salesman_sale_items ADD COLUMN product_name TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE salesman_sale_items ADD COLUMN sku TEXT`); } catch (e) {}
}

function createIndexes(db) {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date)',
    'CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id)',
    'CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_no)',
    'CREATE INDEX IF NOT EXISTS idx_sales_deleted ON sales(is_deleted)',
    'CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id)',
    'CREATE INDEX IF NOT EXISTS idx_sale_items_variant ON sale_items(product_variant_id)',
    'CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)',
    'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)',
    'CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id)',
    'CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id)',
    'CREATE INDEX IF NOT EXISTS idx_variants_sku ON product_variants(sku)',
    'CREATE INDEX IF NOT EXISTS idx_variants_stock ON product_variants(current_stock)',
    'CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone)',
    'CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name)',
    'CREATE INDEX IF NOT EXISTS idx_ledger_account ON general_ledger(account_type)',
    'CREATE INDEX IF NOT EXISTS idx_ledger_reference ON general_ledger(reference_id)',
    'CREATE INDEX IF NOT EXISTS idx_ledger_date ON general_ledger(date)',
    'CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id)',
    'CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date)',
    'CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id)',
    'CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)',
    'CREATE INDEX IF NOT EXISTS idx_emi_customer ON emi_records(customer_id)',
    'CREATE INDEX IF NOT EXISTS idx_emi_status ON emi_records(status)',
    'CREATE INDEX IF NOT EXISTS idx_emi_application ON emi_records(application_no)',
    'CREATE INDEX IF NOT EXISTS idx_emi_guarantor_emi ON emi_guarantors(emi_id)',
    'CREATE INDEX IF NOT EXISTS idx_emi_guarantor_cnic ON emi_guarantors(cnic)',
    'CREATE INDEX IF NOT EXISTS idx_emi_visit_emi ON emi_visit_log(emi_id)',
    'CREATE INDEX IF NOT EXISTS idx_emi_visit_date ON emi_visit_log(visit_date)',
    'CREATE INDEX IF NOT EXISTS idx_emi_doc_emi ON emi_documents(emi_id)',
    'CREATE INDEX IF NOT EXISTS idx_emi_payment_month ON emi_payments(month_number)',
    'CREATE INDEX IF NOT EXISTS idx_emi_payment_date ON emi_payments(payment_date)',
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
    'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
    'CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status)',
    'CREATE INDEX IF NOT EXISTS idx_work_orders_staff ON work_orders(staff_id)',
    'CREATE INDEX IF NOT EXISTS idx_offer_status ON offers(status)',
    'CREATE INDEX IF NOT EXISTS idx_deal_status ON deals(status)',
    'CREATE INDEX IF NOT EXISTS idx_variants_barcode ON product_variants(barcode)',
    'CREATE INDEX IF NOT EXISTS idx_serialized_status ON product_serialized_items(status)',
    'CREATE INDEX IF NOT EXISTS idx_sale_items_serial ON sale_items(serialized_item_id)',
    'CREATE INDEX IF NOT EXISTS idx_fbr_status ON fbr_invoices(fbr_status)',
    'CREATE INDEX IF NOT EXISTS idx_fbr_sale ON fbr_invoices(sale_id)',
    'CREATE INDEX IF NOT EXISTS idx_fbr_created ON fbr_invoices(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_fbr_reference ON fbr_invoices(fbr_reference)',
    'CREATE INDEX IF NOT EXISTS idx_fbr_sale_status ON sales(fbr_status)',
    'CREATE INDEX IF NOT EXISTS idx_purchase_returns_purchase ON purchase_returns(purchase_id)',
    'CREATE INDEX IF NOT EXISTS idx_purchase_returns_supplier ON purchase_returns(supplier_id)',
    'CREATE INDEX IF NOT EXISTS idx_purchase_returns_date ON purchase_returns(return_date)',
    'CREATE INDEX IF NOT EXISTS idx_purchase_return_items_return ON purchase_return_items(purchase_return_id)',
    'CREATE INDEX IF NOT EXISTS idx_purchase_return_items_variant ON purchase_return_items(product_variant_id)',
    'CREATE INDEX IF NOT EXISTS idx_salesmen_status ON salesmen(status)',
    'CREATE INDEX IF NOT EXISTS idx_salesman_sales_salesman ON salesman_sales(salesman_id)',
    'CREATE INDEX IF NOT EXISTS idx_salesman_sales_customer ON salesman_sales(customer_id)',
    'CREATE INDEX IF NOT EXISTS idx_salesman_sales_date ON salesman_sales(sale_date)',
    'CREATE INDEX IF NOT EXISTS idx_salesman_sales_status ON salesman_sales(status)',
    'CREATE INDEX IF NOT EXISTS idx_salesman_sale_items_sale ON salesman_sale_items(sale_id)',
    'CREATE INDEX IF NOT EXISTS idx_customer_sales_history_customer ON customer_sales_history(customer_id)',
    'CREATE INDEX IF NOT EXISTS idx_customer_sales_history_sale ON customer_sales_history(sale_id)',
    'CREATE INDEX IF NOT EXISTS idx_sales_date_status ON sales(date, status)',
    'CREATE INDEX IF NOT EXISTS idx_fbr_invoices_status_created ON fbr_invoices(fbr_status, created_at)',
    'CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON sales(payment_status, date)',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at)'
  ];
  
  for (const sql of indexes) {
    try { db.exec(sql); } catch (err) {
      log(LOG_LEVELS.WARN, 'Index creation failed:', err.message);
    }
  }
  log(LOG_LEVELS.INFO, 'All indexes created successfully');
}

function seedDefaultData(db) {
  const settings = [
    ['fbr_enabled', '0', 'Enable FBR integration'],
    ['backup_timezone', CONFIG.timezone, 'Backup timezone'],
    ['backup_retention_days', String(CONFIG.backupRetention), 'Days to keep backups'],
    ['currency', 'PKR', 'Default currency'],
    ['tax_rate', '0', 'Default tax rate'],
    ['default_printer', '', 'Default printer name']
  ];
  
  for (const [key, value, description] of settings) {
    try {
      db.prepare(`
        INSERT OR IGNORE INTO system_settings (key, value, description) 
        VALUES (?, ?, ?)
      `).run(key, value, description);
    } catch (e) {}
  }

  const roleCount = db.prepare("SELECT COUNT(*) as count FROM roles WHERE is_deleted = 0").get();
  if (roleCount.count === 0) {
    const defaultRoles = [
      { id: 'admin', label: 'Administrator', color: 'error',
        permissions: JSON.stringify(['All Access']),
        pages: JSON.stringify(['dashboard', 'pos', 'sales', 'inventory', 'products', 'customers', 'suppliers', 'purchases', 'expenses', 'reports', 'settings', 'emi', 'users', 'backup', 'salesman']),
        is_default: 1 },
      { id: 'manager', label: 'Manager', color: 'warning',
        permissions: JSON.stringify(['Sales', 'Inventory', 'Reports', 'Customers', 'Suppliers', 'Purchases', 'Expenses', 'EMI']),
        pages: JSON.stringify(['dashboard', 'pos', 'sales', 'inventory', 'products', 'customers', 'suppliers', 'purchases', 'expenses', 'reports', 'emi']),
        is_default: 1 },
      { id: 'cashier', label: 'Cashier / Seller', color: 'primary',
        permissions: JSON.stringify(['POS / Billing Only', 'View Products', 'Customers']),
        pages: JSON.stringify(['dashboard', 'pos', 'sales', 'customers']),
        is_default: 1 },
      { id: 'viewer', label: 'Viewer', color: 'default',
        permissions: JSON.stringify(['View Only']),
        pages: JSON.stringify(['dashboard', 'sales', 'reports']),
        is_default: 1 }
    ];

    const insertRole = db.prepare(
      'INSERT INTO roles (id, label, color, permissions, pages, is_default) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const role of defaultRoles) {
      insertRole.run(role.id, role.label, role.color, role.permissions, role.pages, role.is_default);
    }
    log(LOG_LEVELS.INFO, 'Default roles seeded');
  }

  const userCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE is_deleted = 0").get();
  if (userCount.count === 0) {
    const hashedPassword = hashPassword('admin123');
    db.prepare(`
      INSERT INTO users (name, email, phone, password_hash, role, shop_name, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Admin',
      'admin@raathpos.com',
      '0300-0000000',
      hashedPassword,
      'admin',
      'RAATH POS',
      'active'
    );
    log(LOG_LEVELS.INFO, 'Default admin user created');
  }

  const defaultCategories = [
    { name: 'Rent', color: '#e53935', description: 'Shop rent' },
    { name: 'Utilities', color: '#1e88e5', description: 'Electricity/Gas/Water' },
    { name: 'Salaries', color: '#43a047', description: 'Staff salaries' },
    { name: 'Transport', color: '#fb8c00', description: 'Fuel & Delivery' },
    { name: 'Marketing', color: '#8e24aa', description: 'Advertising & Marketing' },
    { name: 'Maintenance', color: '#00897b', description: 'Shop maintenance' }
  ];

  const catCount = db.prepare("SELECT COUNT(*) as count FROM expense_categories WHERE is_deleted = 0").get();
  if (catCount.count === 0) {
    const insertCat = db.prepare(
      'INSERT INTO expense_categories (name, color, description) VALUES (?, ?, ?)'
    );
    for (const cat of defaultCategories) {
      insertCat.run(cat.name, cat.color, cat.description);
    }
    log(LOG_LEVELS.INFO, 'Default expense categories seeded');
  }
}

module.exports = { runMigrations, createIndexes, seedDefaultData };