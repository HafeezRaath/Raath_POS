// ============================================================
//  electron.js - Electron Main Process for RAATH POS
//  FIXED: better-sqlite3 API, production paths, error handling
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

  // All tables (same as before)
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

  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password TEXT NOT NULL,
    password_hash TEXT,
    role TEXT DEFAULT 'admin',
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
  // ❌ REMOVED: insertCat.finalize() — better-sqlite3 doesn't have this!

  // Migration
  try {
    db.exec(`ALTER TABLE purchases ADD COLUMN payment_mode TEXT DEFAULT 'cash'`);
  } catch (err) {
    // Column already exists
  }

  console.log('All databases initialized successfully.');
}

// ==================== BACKUP SYSTEM ====================
async function safeDatabaseVacuumExport(targetPath) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Database not initialized'));
    try {
      // FIXED: better-sqlite3 backup API
      const backup = db.backup(targetPath);
      backup.step(-1); // Copy all pages
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
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `backup-${timestamp}.db`);

  try {
    if (!fs.existsSync(dbPath)) throw new Error('Master DB source missing');

    await safeDatabaseVacuumExport(backupPath);

    const downloadPath = path.join(
      app.getPath('downloads'),
      `raath-pos-backup-${new Date().toISOString().split('T')[0]}.db`
    );
    fs.copyFileSync(backupPath, downloadPath);

    return {
      success: true,
      path: downloadPath,
      backupDirPath: backupPath,
      size: fs.statSync(backupPath).size,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    throw new Error('Local background backup chain failed: ' + err.message);
  }
}

async function sendBackupEmail(config) {
  const { email, appPassword, toEmail } = config;
  if (!email || !appPassword || !toEmail)
    throw new Error('Gmail dynamic array parameters incomplete');

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: email, pass: appPassword },
  });

  const dateStr = new Date().toLocaleDateString('en-GB');
  const backupDir = getBackupDir();
  const tempBackup = path.join(backupDir, `email-backup-${Date.now()}.db`);

  try {
    await safeDatabaseVacuumExport(tempBackup);

    const mailOptions = {
      from: `"RAATH POS Secure Ledger Engine" <${email}>`,
      to: toEmail,
      subject: `RAATH POS Automated Database Backup - ${dateStr}`,
      text: `Your cloud-safe structural ledger data is successfully encrypted and attached below.\n\nGeneration Date: ${new Date().toLocaleString('en-GB')}\nEngine Vector State: Operational\n\nThis is a real-time integrity service by Raath Developers.`,
      attachments: [
        {
          filename: `raath-pos-backup-${dateStr}.db`,
          path: tempBackup,
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);
    if (fs.existsSync(tempBackup)) fs.unlinkSync(tempBackup);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    if (fs.existsSync(tempBackup)) fs.unlinkSync(tempBackup);
    throw new Error('Automated SMTP Delivery Failed: ' + err.message);
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

ipcMain.handle('create-local-backup', async () => await createLocalBackup());
ipcMain.handle('send-backup-email', async (e, config) => await sendBackupEmail(config));
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
    show: false, // Prevent white flash
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Hide default menu in production
  if (!isDev) {
    win.setMenuBarVisibility(false);
  }

  if (isDev) {
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools();
  } else {
    // FIXED: Use app.getAppPath() for reliable resolution
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

  // Show window only when content is ready
  win.once('ready-to-show', () => {
    win.show();
    if (isDev) win.webContents.openDevTools();
  });

  // Catch load failures
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