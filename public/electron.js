// ============================================================
//  electron.js - Electron Main Process for RAATH POS
//  COMPLETE: All IPC handlers + Roles soft-delete support + Deals
// ============================================================

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// CRITICAL: Load native module with error handling
let Database;
try {
  Database = require('better-sqlite3');
} catch (err) {
  console.error('Failed to load better-sqlite3:', err);
  dialog.showErrorBox(
    'Database Module Error',
    `Failed to load native database module.\n${err.message}\n\nRun: npm run rebuild`
  );
  app.quit();
  process.exit(1);
}

const nodemailer = require('nodemailer');
const cron = require('node-cron');

const isDev = !app.isPackaged;
let db;
let autoBackupJob = null;

// ==================== PATHS ====================
function getDbPath() {
  return path.join(app.getPath('userData'), 'raath-pos.db');
}

function getBackupDir() {
  return path.join(app.getPath('userData'), 'backups');
}

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'backup-settings.json');
}

// ==================== DATABASE INIT ====================
function initDatabase() {
  const dbPath = getDbPath();
  const backupDir = getBackupDir();

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  db = new Database(dbPath);
  console.log('Database initialized at:', dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 15000');

  // All tables
  db.exec(`CREATE TABLE IF NOT EXISTS brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    parent_id INTEGER,
    status TEXT DEFAULT 'active',
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    FOREIGN KEY (parent_id) REFERENCES categories(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand_id INTEGER,
    category_id INTEGER,
    type TEXT DEFAULT 'single',
    unit TEXT DEFAULT 'pc',
    tax_type TEXT DEFAULT 'inclusive',
    description TEXT,
    status TEXT DEFAULT 'active',
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (brand_id) REFERENCES brands(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS product_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    barcode TEXT UNIQUE,
    variant_name TEXT DEFAULT 'Default',
    purchase_price DECIMAL(15,2) DEFAULT 0,
    retail_price DECIMAL(15,2) DEFAULT 0,
    wholesale_price DECIMAL(15,2) DEFAULT 0,
    minimum_retail_price DECIMAL(15,2) DEFAULT 0,
    stock_alert_quantity DECIMAL(12,3) DEFAULT 5,
    current_stock DECIMAL(12,3) DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    FOREIGN KEY (product_id) REFERENCES products(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS product_serialized_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_variant_id INTEGER NOT NULL,
    serial_number_or_imei TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'available',
    sale_id INTEGER,
    purchase_item_id INTEGER,
    is_deleted INTEGER DEFAULT 0,
    FOREIGN KEY (product_variant_id) REFERENCES product_variants(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    company_name TEXT,
    phone TEXT,
    email TEXT,
    vat_ntn_number TEXT,
    address TEXT,
    opening_balance DECIMAL(15,2) DEFAULT 0,
    current_balance DECIMAL(15,2) DEFAULT 0,
    status TEXT DEFAULT 'active',
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER,
    purchase_no TEXT UNIQUE NOT NULL,
    supplier_invoice_no TEXT,
    purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    due_date DATETIME,
    status TEXT DEFAULT 'received',
    total_amount DECIMAL(15,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    shipping_charges DECIMAL(15,2) DEFAULT 0,
    grand_total DECIMAL(15,2) DEFAULT 0,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    payment_status TEXT DEFAULT 'due',
    payment_mode TEXT DEFAULT 'cash',
    notes TEXT,
    created_by INTEGER,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL,
    product_variant_id INTEGER NOT NULL,
    quantity DECIMAL(12,3) DEFAULT 0,
    purchase_price DECIMAL(15,2) DEFAULT 0,
    tax_percentage DECIMAL(5,2) DEFAULT 0,
    sub_total DECIMAL(15,2) DEFAULT 0,
    expiry_date DATE,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id),
    FOREIGN KEY (product_variant_id) REFERENCES product_variants(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS warehouses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location TEXT,
    manager_name TEXT,
    phone TEXT,
    is_deleted INTEGER DEFAULT 0
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS warehouse_stocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    warehouse_id INTEGER NOT NULL,
    product_variant_id INTEGER NOT NULL,
    quantity DECIMAL(12,3) DEFAULT 0,
    UNIQUE(warehouse_id, product_variant_id),
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY (product_variant_id) REFERENCES product_variants(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    cnic TEXT,
    address TEXT,
    district TEXT,
    province TEXT,
    shop_name TEXT,
    customer_type TEXT DEFAULT 'retail',
    opening_balance DECIMAL(15,2) DEFAULT 0,
    current_balance DECIMAL(15,2) DEFAULT 0,
    credit_limit DECIMAL(15,2) DEFAULT 0,
    payment_terms TEXT DEFAULT 'cash',
    status TEXT DEFAULT 'active',
    notes TEXT,
    reference_name TEXT,
    reference_phone TEXT,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no TEXT UNIQUE,
    customer_id INTEGER,
    customer_name TEXT,
    subtotal DECIMAL(15,2) DEFAULT 0,
    item_discount DECIMAL(15,2) DEFAULT 0,
    discount DECIMAL(15,2) DEFAULT 0,
    tax DECIMAL(15,2) DEFAULT 0,
    grand_total DECIMAL(15,2) DEFAULT 0,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    due_amount DECIMAL(15,2) DEFAULT 0,
    change_amount DECIMAL(15,2) DEFAULT 0,
    payment_mode TEXT,
    payment_status TEXT DEFAULT 'paid',
    sale_type TEXT DEFAULT 'retail',
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    product_variant_id INTEGER,
    product_id INTEGER,
    serialized_item_id INTEGER,
    quantity DECIMAL(12,3) DEFAULT 0,
    price DECIMAL(15,2) DEFAULT 0,
    discount DECIMAL(15,2) DEFAULT 0,
    total DECIMAL(15,2) DEFAULT 0,
    FOREIGN KEY (sale_id) REFERENCES sales(id),
    FOREIGN KEY (product_variant_id) REFERENCES product_variants(id),
    FOREIGN KEY (serialized_item_id) REFERENCES product_serialized_items(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS general_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_type TEXT NOT NULL,
    reference_id INTEGER,
    debit DECIMAL(15,2) DEFAULT 0,
    credit DECIMAL(15,2) DEFAULT 0,
    description TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS emi_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    product_name TEXT,
    total_amount DECIMAL(15,2),
    down_payment DECIMAL(15,2),
    emi_amount DECIMAL(15,2),
    interest_rate DECIMAL(5,2),
    total_months INTEGER,
    paid_months INTEGER DEFAULT 0,
    start_date TEXT,
    next_due_date TEXT,
    status TEXT DEFAULT 'active'
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS emi_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emi_id INTEGER,
    amount DECIMAL(15,2),
    payment_date TEXT
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS customer_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    amount DECIMAL(15,2) DEFAULT 0,
    balance_after DECIMAL(15,2) DEFAULT 0,
    description TEXT,
    payment_mode TEXT,
    reference_no TEXT,
    sale_id INTEGER,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER,
    type TEXT,
    amount DECIMAL(15,2) DEFAULT 0,
    description TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS expense_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#757575',
    description TEXT,
    is_deleted INTEGER DEFAULT 0
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    category_id INTEGER,
    payment_mode TEXT DEFAULT 'cash',
    date TEXT,
    description TEXT,
    reference_no TEXT,
    receipt_no TEXT,
    status TEXT DEFAULT 'active',
    is_deleted INTEGER DEFAULT 0,
    created_at TEXT,
    deleted_at TEXT,
    FOREIGN KEY (category_id) REFERENCES expense_categories(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS sale_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NULL,
    invoice_no TEXT NOT NULL,
    return_no TEXT UNIQUE NOT NULL,
    customer_id INTEGER NULL,
    return_date TEXT NOT NULL,
    total_amount REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    refund_amount REAL DEFAULT 0,
    payment_mode TEXT DEFAULT 'cash',
    notes TEXT,
    is_deleted INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT,
    FOREIGN KEY(sale_id) REFERENCES sales(id),
    FOREIGN KEY(customer_id) REFERENCES customers(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS sale_return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_return_id INTEGER NOT NULL,
    product_variant_id INTEGER NOT NULL,
    quantity REAL DEFAULT 0,
    price REAL DEFAULT 0,
    sub_total REAL DEFAULT 0,
    reason TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sale_return_id) REFERENCES sale_returns(id),
    FOREIGN KEY(product_variant_id) REFERENCES product_variants(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NULL,
    customer_id INTEGER NULL,
    amount REAL DEFAULT 0,
    type TEXT,
    payment_mode TEXT DEFAULT 'cash',
    note TEXT,
    date TEXT DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY(customer_id) REFERENCES customers(id)
  )`);

  // ==================== USERS TABLE (ROLE-BASED) ====================
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password TEXT NOT NULL,
    password_hash TEXT,
    role TEXT DEFAULT 'cashier',
    shop_name TEXT,
    shop_address TEXT,
    business_type TEXT DEFAULT 'retail',
    currency TEXT DEFAULT 'PKR',
    status TEXT DEFAULT 'active',
    is_deleted INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    deleted_at TEXT
  )`);

  // ==================== ROLES TABLE (WITH SOFT DELETE) ====================
  db.exec(`CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    color TEXT DEFAULT 'primary',
    permissions TEXT,
    pages TEXT,
    is_default INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Migration: Add is_deleted if not exists (for old DBs)
  try {
    db.prepare("SELECT is_deleted FROM roles LIMIT 1").get();
  } catch (e) {
    db.exec(`ALTER TABLE roles ADD COLUMN is_deleted INTEGER DEFAULT 0`);
  }

  // Seed default roles if table is empty (only active roles)
  const roleCount = db.prepare("SELECT COUNT(*) as count FROM roles WHERE is_deleted = 0").get();
  if (roleCount.count === 0) {
    const defaultRoles = [
      { id: 'admin', label: 'Administrator', color: 'error', permissions: JSON.stringify(['All Access']), pages: JSON.stringify(['dashboard', 'pos', 'sales', 'inventory', 'products', 'customers', 'suppliers', 'purchases', 'expenses', 'reports', 'settings', 'emi', 'users', 'backup']), is_default: 1 },
      { id: 'manager', label: 'Manager', color: 'warning', permissions: JSON.stringify(['Sales', 'Inventory', 'Reports', 'Customers', 'Suppliers', 'Purchases', 'Expenses', 'EMI']), pages: JSON.stringify(['dashboard', 'pos', 'sales', 'inventory', 'products', 'customers', 'suppliers', 'purchases', 'expenses', 'reports', 'emi']), is_default: 1 },
      { id: 'cashier', label: 'Cashier / Seller', color: 'primary', permissions: JSON.stringify(['POS / Billing Only', 'View Products', 'Customers']), pages: JSON.stringify(['dashboard', 'pos', 'sales', 'customers']), is_default: 1 },
      { id: 'viewer', label: 'Viewer', color: 'default', permissions: JSON.stringify(['View Only']), pages: JSON.stringify(['dashboard', 'sales', 'reports']), is_default: 1 }
    ];

    const insertRole = db.prepare(
      'INSERT INTO roles (id, label, color, permissions, pages, is_default) VALUES (?, ?, ?, ?, ?, ?)'
    );
    defaultRoles.forEach((role) => {
      insertRole.run(role.id, role.label, role.color, role.permissions, role.pages, role.is_default);
    });
    console.log('[DB] Default roles seeded successfully');
  }

  // Default Expense Categories
  const defaultCategories = [
    { name: 'Rent', color: '#e53935', description: 'Shop rent' },
    { name: 'Utilities', color: '#1e88e5', description: 'Electricity/Gas/Water' },
    { name: 'Salaries', color: '#43a047', description: 'Staff salaries' },
    { name: 'Transport', color: '#fb8c00', description: 'Fuel & Delivery' }
  ];

  const insertCat = db.prepare(
    'INSERT OR IGNORE INTO expense_categories (name, color, description) VALUES (?, ?, ?)'
  );
  defaultCategories.forEach((cat) => insertCat.run(cat.name, cat.color, cat.description));

  // ==================== DEALS TABLE ====================
  db.exec(`CREATE TABLE IF NOT EXISTS deals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    discount_type TEXT DEFAULT 'percentage',
    discount_value DECIMAL(15,2) DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    min_purchase_amount DECIMAL(15,2) DEFAULT 0,
    applicable_to TEXT DEFAULT 'all',
    status TEXT DEFAULT 'active',
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);


  // ==================== OFFERS TABLE ====================
  db.exec(`CREATE TABLE IF NOT EXISTS offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    discount_type TEXT DEFAULT 'percentage',
    discount_value REAL DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    status TEXT DEFAULT 'active',
    original_total REAL DEFAULT 0,
    final_total REAL DEFAULT 0,
    items_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS offer_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    offer_id INTEGER,
    product_id INTEGER,
    variant_id INTEGER,
    product_name TEXT,
    variant_name TEXT,
    sku TEXT,
    original_price REAL,
    offer_price REAL,
    category_id INTEGER
  )`);

  // ==================== SERVICES TABLE ====================
  db.exec(`CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    base_price DECIMAL(15,2) DEFAULT 0,
    estimated_time TEXT,
    status TEXT DEFAULT 'active',
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT
  )`);

  // ==================== STAFF TABLE ====================
  db.exec(`CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT DEFAULT 'technician',
    active INTEGER DEFAULT 1,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT
  )`);

  // ==================== WORK ORDERS TABLE ====================
  db.exec(`CREATE TABLE IF NOT EXISTS work_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER,
    staff_id INTEGER,
    customer_id INTEGER,
    machine_name TEXT,
    status TEXT DEFAULT 'pending',
    parts_used TEXT,
    notes TEXT,
    total_cost DECIMAL(15,2) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    FOREIGN KEY (service_id) REFERENCES services(id),
    FOREIGN KEY (staff_id) REFERENCES staff(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);

  // Migration: Add role column if not exists (for old DBs)
  try {
    db.prepare("SELECT role FROM users LIMIT 1").get();
  } catch (e) {
    db.exec(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'cashier'`);
    db.exec(`ALTER TABLE users ADD COLUMN shop_name TEXT`);
    db.exec(`ALTER TABLE users ADD COLUMN shop_address TEXT`);
    db.exec(`ALTER TABLE users ADD COLUMN business_type TEXT DEFAULT 'retail'`);
    db.exec(`ALTER TABLE users ADD COLUMN currency TEXT DEFAULT 'PKR'`);
  }

  // Migration: Add payment_mode to purchases if not exists
  try {
    db.exec(`ALTER TABLE purchases ADD COLUMN payment_mode TEXT DEFAULT 'cash'`);
  } catch (err) {
    // Column already exists
  }

  // ==================== MIGRATIONS: Add is_deleted & deleted_at to old DBs ====================
  const tablesNeedIsDeleted = [
    'brands', 'categories', 'products', 'product_variants', 'product_serialized_items',
    'suppliers', 'purchases', 'customers', 'sales', 'expense_categories',
    'expenses', 'sale_returns', 'users', 'warehouses', 'deals', 'offers',
    'services', 'staff', 'work_orders'
  ];
  tablesNeedIsDeleted.forEach(table => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN is_deleted INTEGER DEFAULT 0`); } catch (e) {}
  });

  const tablesNeedDeletedAt = [
    'brands', 'categories', 'products', 'product_variants', 'suppliers',
    'purchases', 'customers', 'sales', 'expenses', 'sale_returns',
    'users', 'deals', 'offers', 'services', 'staff', 'work_orders'
  ];
  tablesNeedDeletedAt.forEach(table => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN deleted_at TEXT`); } catch (e) {}
  });
  console.log('All databases initialized successfully.');
}

// ==================== BACKUP SYSTEM ====================

async function safeDatabaseVacuumExport(targetPath) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Database not initialized'));

    try {
      const backup = db.backup(targetPath);
      backup.step(-1);
      backup.finish();
      resolve();
    } catch (err) {
      console.error('Backup failed, trying file copy fallback...');
      try {
        fs.copyFileSync(getDbPath(), targetPath);
        resolve();
      } catch (copyErr) {
        reject(copyErr);
      }
    }
  });
}

async function createLocalBackup() {
  const dbPath = getDbPath();
  const backupDir = getBackupDir();

  try {
    if (!fs.existsSync(dbPath)) {
      throw new Error('Database file not found at: ' + dbPath);
    }

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup-${timestamp}.db`);

    await safeDatabaseVacuumExport(backupPath);

    const desktopPath = path.join(
      app.getPath('desktop'),
      `POS-Backup-${Date.now()}.db`
    );
    fs.copyFileSync(backupPath, desktopPath);

    return {
      success: true,
      path: desktopPath,
      backupDirPath: backupPath,
      size: fs.statSync(backupPath).size,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error('Local backup failed:', err);
    throw new Error('Local backup failed: ' + err.message);
  }
}

async function sendBackupEmail(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Invalid config object provided');
  }
  
  const { email, appPassword, toEmail } = config;
  
  if (!email || !appPassword || !toEmail) {
    throw new Error('Email configuration incomplete. Required: email, appPassword, toEmail');
  }

  if (!db) {
    throw new Error('Database not initialized. Cannot create backup.');
  }

  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) {
    throw new Error('Database file not found');
  }

  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const tempBackup = path.join(backupDir, `email-backup-${Date.now()}.db`);

  try {
    await safeDatabaseVacuumExport(tempBackup);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: email, pass: appPassword },
    });

    const dateStr = new Date().toLocaleDateString('en-GB');
    const timeStr = new Date().toLocaleString('en-GB');

    const mailOptions = {
      from: `"RAATH POS Backup" <${email}>`,
      to: toEmail,
      subject: `POS Auto Backup - ${timeStr}`,
      text: `Your RAATH POS database backup is attached.\n\nBackup Date: ${timeStr}\nFile: raath-pos-backup-${dateStr}.db\n\nThis is an automated backup from RAATH POS.`,
      attachments: [
        {
          filename: `raath-pos-backup-${dateStr}.db`,
          path: tempBackup,
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);
    
    if (fs.existsSync(tempBackup)) {
      fs.unlinkSync(tempBackup);
    }

    return { 
      success: true, 
      messageId: info.messageId,
      timestamp: new Date().toISOString()
    };
    
  } catch (err) {
    if (fs.existsSync(tempBackup)) {
      fs.unlinkSync(tempBackup);
    }
    console.error('Email backup failed:', err);
    throw new Error('Email backup failed: ' + err.message);
  }
}

function loadBackupSettings() {
  try {
    const settingsPath = getSettingsPath();
    if (fs.existsSync(settingsPath))
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch (err) {
    console.error(err);
  }
  return {
    autoBackup: false,
    backupInterval: 'daily',
    backupDestination: 'local',
    gmail: { email: '', appPassword: '', toEmail: '', enabled: false },
  };
}

function saveBackupSettings(settings) {
  try {
    fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error(err);
  }
}

function setupAutoBackup(settings) {
  if (autoBackupJob) {
    autoBackupJob.stop();
    autoBackupJob = null;
  }
  if (!settings.autoBackup) return;

  let cronExpression = '0 2 * * *';
  if (settings.backupInterval === 'weekly') cronExpression = '0 2 * * 0';
  if (settings.backupInterval === 'monthly') cronExpression = '0 2 1 * *';

  autoBackupJob = cron.schedule(
    cronExpression,
    async () => {
      try {
        const dest = settings.backupDestination || 'local';
        if (
          (dest === 'gmail' || dest === 'both') &&
          settings.gmail?.enabled
        )
          await sendBackupEmail(settings.gmail);
        if (dest === 'local' || dest === 'both')
          await createLocalBackup();
      } catch (err) {
        console.error('Background Cron Engine Failure:', err);
      }
    },
    { scheduled: true, timezone: 'Asia/Karachi' }
  );
}

// ==================== IPC HANDLERS ====================

// FIXED: Safe db-query with better error handling
ipcMain.handle('db-query', async (event, sql, params = []) => {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Database pipeline detached'));

    try {
      const cleanSql = sql.trim();
      const isSelect = /^(SELECT|WITH|PRAGMA|EXPLAIN)\b/i.test(cleanSql);

      if (isSelect) {
        const rows = db.prepare(sql).all(...params);
        resolve(rows);
      } else {
        const result = db.prepare(sql).run(...params);
        resolve({
          lastInsertRowid: result.lastInsertRowid,
          changes: result.changes,
        });
      }
    } catch (err) {
      reject(err);
    }
  });
});

// NEW: User authentication handler
ipcMain.handle('verify-user', async (event, email, password) => {
  if (!db) return null;
  
  try {
    const user = db.prepare(
      "SELECT * FROM users WHERE email = ? AND is_deleted = 0 LIMIT 1"
    ).get(email);
    
    if (!user) return null;
    
    if (user.password === password || user.password_hash === password) {
      const { password: _, password_hash: __, ...safeUser } = user;
      return safeUser;
    }
    return null;
  } catch (err) {
    console.error('Verify user error:', err);
    return null;
  }
});

// NEW: Get user by email
ipcMain.handle('get-user-by-email', async (event, email) => {
  if (!db) return null;
  
  try {
    const user = db.prepare(
      "SELECT id, name, email, phone, role, shop_name, shop_address, business_type, currency, status, created_at FROM users WHERE email = ? AND is_deleted = 0 LIMIT 1"
    ).get(email);
    return user || null;
  } catch (err) {
    console.error('Get user by email error:', err);
    return null;
  }
});

// NEW: Get user by ID
ipcMain.handle('get-user-by-id', async (event, id) => {
  if (!db) return null;
  
  try {
    const user = db.prepare(
      "SELECT id, name, email, phone, role, shop_name, shop_address, business_type, currency, status, created_at FROM users WHERE id = ? AND is_deleted = 0 LIMIT 1"
    ).get(id);
    return user || null;
  } catch (err) {
    console.error('Get user by id error:', err);
    return null;
  }
});

// NEW: Get all users (safe - no passwords)
ipcMain.handle('get-users', async () => {
  if (!db) return [];
  
  try {
    const users = db.prepare(
      "SELECT id, name, email, phone, role, shop_name, shop_address, business_type, currency, status, created_at FROM users WHERE is_deleted = 0 ORDER BY name"
    ).all();
    return users || [];
  } catch (err) {
    console.error('Get users error:', err);
    return [];
  }
});

// NEW: Create user
ipcMain.handle('create-user', async (event, userData) => {
  if (!db) return null;
  
  try {
    const result = db.prepare(
      `INSERT INTO users (name, email, phone, password, password_hash, role, shop_name, shop_address, business_type, currency, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userData.name,
      userData.email,
      userData.phone || '',
      userData.password || '',
      userData.password_hash || userData.password || '',
      userData.role || 'cashier',
      userData.shop_name || '',
      userData.shop_address || '',
      userData.business_type || 'retail',
      userData.currency || 'PKR',
      userData.status || 'active'
    );
    return { lastInsertRowid: result.lastInsertRowid, changes: result.changes };
  } catch (err) {
    console.error('Create user error:', err);
    throw err;
  }
});

// NEW: Update user
ipcMain.handle('update-user', async (event, id, userData) => {
  if (!db) return null;
  
  try {
    const fields = [];
    const values = [];
    
    Object.keys(userData).forEach(key => {
      if (userData[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(userData[key]);
      }
    });
    
    if (fields.length === 0) return { changes: 0 };
    
    values.push(id);
    const result = db.prepare(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`
    ).run(...values);
    
    return { changes: result.changes };
  } catch (err) {
    console.error('Update user error:', err);
    throw err;
  }
});

// NEW: Delete user (soft delete)
ipcMain.handle('delete-user', async (event, id) => {
  if (!db) return null;
  
  try {
    const result = db.prepare(
      "UPDATE users SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?"
    ).run(id);
    return { changes: result.changes };
  } catch (err) {
    console.error('Delete user error:', err);
    throw err;
  }
});

// ==================== ROLES IPC HANDLERS (UPDATED WITH SOFT DELETE) ====================

// Get all roles (only active)
ipcMain.handle('get-roles', async () => {
  if (!db) return [];
  
  try {
    const roles = db.prepare("SELECT * FROM roles WHERE is_deleted = 0 ORDER BY label").all();
    return roles.map(r => ({
      ...r,
      permissions: r.permissions ? JSON.parse(r.permissions) : [],
      pages: r.pages ? JSON.parse(r.pages) : []
    }));
  } catch (err) {
    console.error('Get roles error:', err);
    return [];
  }
});

// Create role
ipcMain.handle('create-role', async (event, roleData) => {
  if (!db) return null;
  
  try {
    const result = db.prepare(
      "INSERT INTO roles (id, label, color, permissions, pages) VALUES (?, ?, ?, ?, ?)"
    ).run(
      roleData.id,
      roleData.label,
      roleData.color || 'primary',
      JSON.stringify(roleData.permissions || []),
      JSON.stringify(roleData.pages || [])
    );
    return { lastInsertRowid: result.lastInsertRowid, changes: result.changes };
  } catch (err) {
    console.error('Create role error:', err);
    throw err;
  }
});

// Update role
ipcMain.handle('update-role', async (event, id, roleData) => {
  if (!db) return null;
  
  try {
    const result = db.prepare(
      "UPDATE roles SET label = ?, color = ?, permissions = ?, pages = ? WHERE id = ? AND is_deleted = 0"
    ).run(
      roleData.label,
      roleData.color,
      JSON.stringify(roleData.permissions || []),
      JSON.stringify(roleData.pages || []),
      id
    );
    return { changes: result.changes };
  } catch (err) {
    console.error('Update role error:', err);
    throw err;
  }
});

// Delete role (soft delete)
ipcMain.handle('delete-role', async (event, id) => {
  if (!db) return null;
  
  try {
    const result = db.prepare(
      "UPDATE roles SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?"
    ).run(id);
    return { changes: result.changes };
  } catch (err) {
    console.error('Delete role error:', err);
    throw err;
  }
});

// Seed default roles
ipcMain.handle('seed-default-roles', async (event, roles) => {
  if (!db) return { success: false, error: 'DB not initialized' };
  
  try {
    const insert = db.prepare(
      "INSERT OR REPLACE INTO roles (id, label, color, permissions, pages, is_default) VALUES (?, ?, ?, ?, ?, ?)"
    );
    
    roles.forEach(role => {
      insert.run(
        role.id,
        role.label,
        role.color || 'primary',
        JSON.stringify(role.permissions || []),
        JSON.stringify(role.pages || []),
        role.is_default || 0
      );
    });
    
    return { success: true };
  } catch (err) {
    console.error('Seed roles error:', err);
    return { success: false, error: err.message };
  }
});

// ==================== DEALS IPC HANDLERS ====================
ipcMain.handle('db:getDeals', async () => {
  if (!db) return { success: false, error: 'Database not initialized', data: [] };
  try {
    const deals = db.prepare("SELECT * FROM deals WHERE is_deleted = 0 ORDER BY created_at DESC").all();
    return { success: true, data: deals || [] };
  } catch (error) {
    console.error('getDeals error:', error);
    return { success: false, error: error.message, data: [] };
  }
});

ipcMain.handle('db:getDealById', async (event, id) => {
  if (!db) return { success: false, error: 'Database not initialized' };
  try {
    const deal = db.prepare("SELECT * FROM deals WHERE id = ? AND is_deleted = 0").get(id);
    return { success: true, data: deal || null };
  } catch (error) {
    console.error('getDealById error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:addDeal', async (event, deal) => {
  if (!db) return { success: false, error: 'Database not initialized' };
  try {
    const result = db.prepare(
      `INSERT INTO deals (title, description, discount_type, discount_value, start_date, end_date, min_purchase_amount, applicable_to, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      deal.title,
      deal.description || '',
      deal.discount_type || 'percentage',
      deal.discount_value || 0,
      deal.start_date || null,
      deal.end_date || null,
      deal.min_purchase_amount || 0,
      deal.applicable_to || 'all',
      deal.status || 'active'
    );
    return { success: true, data: { id: result.lastInsertRowid, ...deal } };
  } catch (error) {
    console.error('addDeal error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:updateDeal', async (event, id, deal) => {
  if (!db) return { success: false, error: 'Database not initialized' };
  try {
    const result = db.prepare(
      `UPDATE deals SET title = ?, description = ?, discount_type = ?, discount_value = ?, start_date = ?, end_date = ?, min_purchase_amount = ?, applicable_to = ?, status = ? WHERE id = ?`
    ).run(
      deal.title,
      deal.description || '',
      deal.discount_type || 'percentage',
      deal.discount_value || 0,
      deal.start_date || null,
      deal.end_date || null,
      deal.min_purchase_amount || 0,
      deal.applicable_to || 'all',
      deal.status || 'active',
      id
    );
    return { success: true, data: { changes: result.changes } };
  } catch (error) {
    console.error('updateDeal error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:deleteDeal', async (event, id) => {
  if (!db) return { success: false, error: 'Database not initialized' };
  try {
    const result = db.prepare("UPDATE deals SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?").run(id);
    return { success: true, data: { changes: result.changes } };
  } catch (error) {
    console.error('deleteDeal error:', error);
    return { success: false, error: error.message };
  }
});


// ==================== OFFERS IPC HANDLERS ====================
ipcMain.handle('db:getOffers', async () => {
  if (!db) return { success: false, error: 'Database not initialized', data: [] };
  try {
    const offers = db.prepare("SELECT * FROM offers WHERE is_deleted = 0 OR is_deleted IS NULL ORDER BY created_at DESC").all();
    return { success: true, data: offers || [] };
  } catch (error) {
    console.error('getOffers error:', error);
    return { success: false, error: error.message, data: [] };
  }
});

ipcMain.handle('db:getOfferById', async (event, id) => {
  if (!db) return { success: false, error: 'Database not initialized' };
  try {
    const offer = db.prepare("SELECT * FROM offers WHERE id = ? AND (is_deleted = 0 OR is_deleted IS NULL)").get(id);
    return { success: true, data: offer || null };
  } catch (error) {
    console.error('getOfferById error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:addOffer', async (event, offer) => {
  if (!db) return { success: false, error: 'Database not initialized' };
  try {
    const result = db.prepare(
      `INSERT INTO offers (name, description, discount_type, discount_value, start_date, end_date, status, original_total, final_total, items_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      offer.name,
      offer.description || '',
      offer.discount_type || 'percentage',
      offer.discount_value || 0,
      offer.start_date || null,
      offer.end_date || null,
      offer.status || 'active',
      offer.original_total || 0,
      offer.final_total || 0,
      offer.items_count || 0
    );
    return { success: true, data: { id: result.lastInsertRowid, ...offer } };
  } catch (error) {
    console.error('addOffer error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:updateOffer', async (event, id, offer) => {
  if (!db) return { success: false, error: 'Database not initialized' };
  try {
    const result = db.prepare(
      `UPDATE offers SET name = ?, description = ?, discount_type = ?, discount_value = ?, start_date = ?, end_date = ?, status = ?, original_total = ?, final_total = ?, items_count = ? WHERE id = ?`
    ).run(
      offer.name,
      offer.description || '',
      offer.discount_type || 'percentage',
      offer.discount_value || 0,
      offer.start_date || null,
      offer.end_date || null,
      offer.status || 'active',
      offer.original_total || 0,
      offer.final_total || 0,
      offer.items_count || 0,
      id
    );
    return { success: true, data: { changes: result.changes } };
  } catch (error) {
    console.error('updateOffer error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:deleteOffer', async (event, id) => {
  if (!db) return { success: false, error: 'Database not initialized' };
  try {
    const result = db.prepare("UPDATE offers SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?").run(id);
    return { success: true, data: { changes: result.changes } };
  } catch (error) {
    console.error('deleteOffer error:', error);
    return { success: false, error: error.message };
  }
});

// Offer Items handlers
ipcMain.handle('db:getOfferItems', async (event, offerId) => {
  if (!db) return { success: false, error: 'Database not initialized', data: [] };
  try {
    const items = db.prepare("SELECT * FROM offer_items WHERE offer_id = ?").all(offerId);
    return { success: true, data: items || [] };
  } catch (error) {
    console.error('getOfferItems error:', error);
    return { success: false, error: error.message, data: [] };
  }
});

ipcMain.handle('db:addOfferItem', async (event, item) => {
  if (!db) return { success: false, error: 'Database not initialized' };
  try {
    const result = db.prepare(
      `INSERT INTO offer_items (offer_id, product_id, variant_id, product_name, variant_name, sku, original_price, offer_price, category_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      item.offer_id,
      item.product_id || null,
      item.variant_id || null,
      item.product_name || '',
      item.variant_name || '',
      item.sku || '',
      item.original_price || 0,
      item.offer_price || 0,
      item.category_id || null
    );
    return { success: true, data: { id: result.lastInsertRowid, ...item } };
  } catch (error) {
    console.error('addOfferItem error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:deleteOfferItems', async (event, offerId) => {
  if (!db) return { success: false, error: 'Database not initialized' };
  try {
    const result = db.prepare("DELETE FROM offer_items WHERE offer_id = ?").run(offerId);
    return { success: true, data: { changes: result.changes } };
  } catch (error) {
    console.error('deleteOfferItems error:', error);
    return { success: false, error: error.message };
  }
});

// ==================== SERVICES IPC HANDLERS ====================
ipcMain.handle('db:getServices', async () => {
  if (!db) return { success: false, error: 'Database not initialized', data: [] };
  try {
    const services = db.prepare("SELECT * FROM services WHERE is_deleted = 0 ORDER BY name").all();
    return { success: true, data: services || [] };
  } catch (error) {
    console.error('getServices error:', error);
    return { success: false, error: error.message, data: [] };
  }
});

ipcMain.handle('db:getServiceById', async (event, id) => {
  if (!db) return { success: false, error: 'Database not initialized' };
  try {
    const service = db.prepare("SELECT * FROM services WHERE id = ? AND is_deleted = 0").get(id);
    return { success: true, data: service || null };
  } catch (error) {
    console.error('getServiceById error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:addService', async (event, service) => {
  if (!db) return { success: false, error: 'Database not initialized' };
  try {
    const result = db.prepare(
      `INSERT INTO services (name, description, base_price, estimated_time, status) VALUES (?, ?, ?, ?, ?)`
    ).run(
      service.name,
      service.description || '',
      service.base_price || 0,
      service.estimated_time || '',
      service.status || 'active'
    );
    return { success: true, data: { id: result.lastInsertRowid, ...service } };
  } catch (error) {
    console.error('addService error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:updateService', async (event, id, service) => {
  if (!db) return { success: false, error: 'Database not initialized' };
  try {
    const result = db.prepare(
      `UPDATE services SET name = ?, description = ?, base_price = ?, estimated_time = ?, status = ? WHERE id = ?`
    ).run(
      service.name,
      service.description || '',
      service.base_price || 0,
      service.estimated_time || '',
      service.status || 'active',
      id
    );
    return { success: true, data: { changes: result.changes } };
  } catch (error) {
    console.error('updateService error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:deleteService', async (event, id) => {
  if (!db) return { success: false, error: 'Database not initialized' };
  try {
    const result = db.prepare("UPDATE services SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?").run(id);
    return { success: true, data: { changes: result.changes } };
  } catch (error) {
    console.error('deleteService error:', error);
    return { success: false, error: error.message };
  }
});

// ==================== STAFF IPC HANDLERS ====================
ipcMain.handle('db:getStaff', async () => {
  if (!db) return { success: false, error: 'Database not initialized', data: [] };
  try {
    const staff = db.prepare("SELECT * FROM staff WHERE is_deleted = 0 ORDER BY name").all();
    return { success: true, data: staff || [] };
  } catch (error) {
    console.error('getStaff error:', error);
    return { success: false, error: error.message, data: [] };
  }
});

ipcMain.handle('db:getStaffById', async (event, id) => {
  if (!db) return { success: false, error: 'Database not initialized' };
  try {
    const staff = db.prepare("SELECT * FROM staff WHERE id = ? AND is_deleted = 0").get(id);
    return { success: true, data: staff || null };
  } catch (error) {
    console.error('getStaffById error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:addStaff', async (event, staff) => {
  if (!db) return { success: false, error: 'Database not initialized' };
  try {
    const result = db.prepare(
      `INSERT INTO staff (name, phone, role, active) VALUES (?, ?, ?, ?)`
    ).run(
      staff.name,
      staff.phone || '',
      staff.role || 'technician',
      staff.active !== false ? 1 : 0
    );
    return { success: true, data: { id: result.lastInsertRowid, ...staff } };
  } catch (error) {
    console.error('addStaff error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:updateStaff', async (event, id, staff) => {
  if (!db) return { success: false, error: 'Database not initialized' };
  try {
    const result = db.prepare(
      `UPDATE staff SET name = ?, phone = ?, role = ?, active = ? WHERE id = ?`
    ).run(
      staff.name,
      staff.phone || '',
      staff.role || 'technician',
      staff.active !== false ? 1 : 0,
      id
    );
    return { success: true, data: { changes: result.changes } };
  } catch (error) {
    console.error('updateStaff error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:deleteStaff', async (event, id) => {
  if (!db) return { success: false, error: 'Database not initialized' };
  try {
    const result = db.prepare("UPDATE staff SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?").run(id);
    return { success: true, data: { changes: result.changes } };
  } catch (error) {
    console.error('deleteStaff error:', error);
    return { success: false, error: error.message };
  }
});

// ==================== WORK ORDERS IPC HANDLERS ====================
ipcMain.handle('db:getWorkOrders', async (event, filters = {}) => {
  if (!db) return { success: false, error: 'Database not initialized', data: [] };
  try {
    let sql = `SELECT wo.*, s.name as service_name, st.name as staff_name, c.name as customer_name 
      FROM work_orders wo 
      LEFT JOIN services s ON wo.service_id = s.id 
      LEFT JOIN staff st ON wo.staff_id = st.id 
      LEFT JOIN customers c ON wo.customer_id = c.id 
      WHERE wo.is_deleted = 0`;
    const params = [];
    if (filters.status) { sql += " AND wo.status = ?"; params.push(filters.status); }
    if (filters.staffId) { sql += " AND wo.staff_id = ?"; params.push(filters.staffId); }
    if (filters.startDate) { sql += " AND DATE(wo.created_at) >= DATE(?)"; params.push(filters.startDate); }
    const rows = db.prepare(sql).all(...params);
    return { success: true, data: rows || [] };
  } catch (error) {
    console.error('getWorkOrders error:', error);
    return { success: false, error: error.message, data: [] };
  }
});

ipcMain.handle('db:getWorkOrderById', async (event, id) => {
  if (!db) return { success: false, error: 'Database not initialized' };
  try {
    const row = db.prepare(`SELECT wo.*, s.name as service_name, st.name as staff_name 
      FROM work_orders wo 
      LEFT JOIN services s ON wo.service_id = s.id 
      LEFT JOIN staff st ON wo.staff_id = st.id 
      WHERE wo.id = ?`).get(id);
    return { success: true, data: row || null };
  } catch (error) {
    console.error('getWorkOrderById error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:addWorkOrder', async (event, wo) => {
  if (!db) return { success: false, error: 'Database not initialized' };
  try {
    const result = db.prepare(
      `INSERT INTO work_orders (service_id, staff_id, customer_id, machine_name, status, parts_used, notes, total_cost, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      wo.service_id || null,
      wo.staff_id || null,
      wo.customer_id || null,
      wo.machine_name || '',
      wo.status || 'pending',
      JSON.stringify(wo.parts_used || []),
      wo.notes || '',
      wo.total_cost || 0,
      wo.created_at || new Date().toISOString()
    );
    return { success: true, data: { id: result.lastInsertRowid, ...wo } };
  } catch (error) {
    console.error('addWorkOrder error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:updateWorkOrder', async (event, id, wo) => {
  if (!db) return { success: false, error: 'Database not initialized' };
  try {
    const fields = [];
    const values = [];
    if (wo.service_id !== undefined) { fields.push('service_id = ?'); values.push(wo.service_id); }
    if (wo.staff_id !== undefined) { fields.push('staff_id = ?'); values.push(wo.staff_id); }
    if (wo.customer_id !== undefined) { fields.push('customer_id = ?'); values.push(wo.customer_id); }
    if (wo.machine_name !== undefined) { fields.push('machine_name = ?'); values.push(wo.machine_name); }
    if (wo.status !== undefined) { fields.push('status = ?'); values.push(wo.status); }
    if (wo.parts_used !== undefined) { fields.push('parts_used = ?'); values.push(JSON.stringify(wo.parts_used)); }
    if (wo.notes !== undefined) { fields.push('notes = ?'); values.push(wo.notes); }
    if (wo.total_cost !== undefined) { fields.push('total_cost = ?'); values.push(wo.total_cost); }
    if (fields.length === 0) return { success: true, data: { changes: 0 } };
    values.push(id);
    const result = db.prepare(`UPDATE work_orders SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return { success: true, data: { changes: result.changes } };
  } catch (error) {
    console.error('updateWorkOrder error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:deleteWorkOrder', async (event, id) => {
  if (!db) return { success: false, error: 'Database not initialized' };
  try {
    const result = db.prepare("UPDATE work_orders SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?").run(id);
    return { success: true, data: { changes: result.changes } };
  } catch (error) {
    console.error('deleteWorkOrder error:', error);
    return { success: false, error: error.message };
  }
});

// ==================== OTHER IPC HANDLERS ====================

ipcMain.handle('get-db-info', async () => {
  try {
    const stats = fs.statSync(getDbPath());
    return {
      path: getDbPath(),
      size: stats.size,
      lastModified: stats.mtime.toISOString(),
    };
  } catch {
    return { path: getDbPath(), size: 0, lastModified: null };
  }
});

ipcMain.handle('create-local-backup', async () => {
  return await createLocalBackup();
});

ipcMain.handle('send-backup-email', async (event, config) => {
  return await sendBackupEmail(config);
});

ipcMain.handle('restore-backup', async (e, backupPath) => {
  const safetyBackup = path.join(
    getBackupDir(),
    `pre-restore-${Date.now()}.db`
  );
  fs.copyFileSync(getDbPath(), safetyBackup);
  fs.copyFileSync(backupPath, getDbPath());
  return { success: true, safetyPath: safetyBackup };
});

ipcMain.handle('update-backup-settings', async (e, s) => {
  saveBackupSettings(s);
  setupAutoBackup(s);
  return { success: true };
});

ipcMain.handle('load-backup-settings', async () => loadBackupSettings());

ipcMain.handle('select-backup-file', async () =>
  await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'SQLite', extensions: ['db'] }],
  })
);

// ==================== WINDOW ====================
function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (!isDev) {
    win.setMenuBarVisibility(false);
  }

  if (isDev) {
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools();
  } else {
    const indexPath = path.join(app.getAppPath(), 'build', 'index.html');
    console.log('Loading production build from:', indexPath);

    if (!fs.existsSync(indexPath)) {
      console.error('ERROR: build/index.html not found at', indexPath);
      dialog.showErrorBox(
        'Build Error',
        `Could not find build/index.html\nLooking at: ${indexPath}\n\nPlease run: npm run build`
      );
    }

    win.loadFile(indexPath);
  }

  win.once('ready-to-show', () => {
    win.show();
    if (isDev) win.webContents.openDevTools();
  });

  win.webContents.on(
    'did-fail-load',
    (event, errorCode, errorDescription, validatedURL) => {
      console.error('Failed to load:', errorCode, errorDescription);
      dialog.showErrorBox(
        'Load Error',
        `Failed to load: ${errorDescription}\nURL: ${validatedURL}`
      );
    }
  );
}

// ==================== APP LIFECYCLE ====================
app
  .whenReady()
  .then(() => {
    try {
      initDatabase();
    } catch (err) {
      console.error('Database initialization failed:', err);
      dialog.showErrorBox(
        'Database Error',
        'Failed to initialize database:\n' + err.message
      );
    }

    createWindow();

    const settings = loadBackupSettings();
    if (settings.autoBackup) setupAutoBackup(settings);
  })
  .catch((err) => {
    console.error('App startup failed:', err);
    dialog.showErrorBox('Startup Error', err.message);
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});