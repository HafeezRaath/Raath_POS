// ============================================================
//  backend/database/initSqlite.js - SQLite Schema & Initializer
// ============================================================

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const SYNCABLE_TABLES = new Set([
  'products', 'product_variants', 'product_serialized_items',
  'customers', 'suppliers', 'sales', 'sale_items', 'sale_returns',
  'purchases', 'purchase_items', 'expenses', 'payments',
  'emi_records', 'emi_payments', 'accounts', 'work_orders'
]);

const TENANT_TABLES = new Set([
  'account_daily_balances', 'account_transactions', 'accounts', 'audit_logs',
  'brands', 'categories', 'customer_emi_summary', 'customer_ledger',
  'customer_sales_history', 'customers', 'deals', 'distributor_ledger',
  'distributor_order_items', 'distributor_orders', 'distributor_payments',
  'distributor_return_items', 'distributor_returns', 'distributors',
  'emi_documents', 'emi_guarantors', 'emi_payments', 'emi_penalty_rules',
  'emi_records', 'emi_reschedule_log', 'emi_schedule', 'emi_visit_log',
  'emis', 'expense_categories', 'expenses', 'fbr_invoices', 'general_ledger',
  'offer_items', 'offers', 'payments', 'product_batches', 'bundle_items', 'bundles', 'product_serialized_items',
  'product_variants', 'products', 'purchase_items', 'purchase_order_items',
  'purchase_orders', 'purchase_return_items',
  'purchase_returns', 'purchases', 'sale_items', 'sale_return_items',
  'sale_returns', 'sales', 'salesman_advances', 'salesman_commission_payouts',
  'salesman_ledger', 'salesman_salary_payments', 'salesman_sale_items',
  'salesman_sale_return_items', 'salesman_sale_returns', 'salesman_sales',
  'salesmen', 'services', 'staff', 'supplier_ledger', 'suppliers',
  'device_imei', 'device_imei_history', 'repair_parts', 'staff_payroll',
  'supplier_credit_notes', 'guarantors',
  'system_settings', 'users', 'warehouse_stocks', 'warehouses', 'work_orders'
]);

const DEFAULT_PAGES = [
  'dashboard', 'pos', 'sales', 'inventory', 'products', 'customers',
  'suppliers', 'purchases', 'expenses', 'reports', 'settings', 'emi',
  'users', 'backup', 'services', 'distribution'
];

function translateSchema(sql) {
  const stmts = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.split('\n').every(l => !l.trim() || l.trim().startsWith('--')));

  const outTables = [];
  const outIndexes = [];
  const outViews = [];

  for (const rawStmt of stmts) {
    if (/^\s*SET\s+/i.test(rawStmt)) continue;

    if (/^\s*(?:CREATE|DROP)\s+VIEW\b/i.test(rawStmt)) {
      outViews.push(rawStmt);
      continue;
    }

    const tableMatch = rawStmt.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([a-zA-Z0-9_]+)`?\s*\(([\s\S]+)\)[^)]*$/i);
    if (!tableMatch) continue;

    const tableName = tableMatch[1];
    let body = tableMatch[2];

    const lines = body.split('\n');
    const cleanedLines = [];

    for (let line of lines) {
      const trimmed = line.trim();

      if (/^FULLTEXT\s+INDEX/i.test(trimmed)) {
        continue;
      }

      const uqMatch = trimmed.match(/^UNIQUE\s+KEY\s+(?:`?([a-zA-Z0-9_]+)`?\s+)?\(([^)]+)\),?$/i);
      if (uqMatch) {
        const uqName = uqMatch[1] || `uq_${tableName}_${Math.random().toString(36).substring(2, 6)}`;
        outIndexes.push(`CREATE UNIQUE INDEX IF NOT EXISTS \`${uqName}\` ON \`${tableName}\` (${uqMatch[2]});`);
        continue;
      }

      const idxMatch = trimmed.match(/^(?:INDEX|KEY)\s+(?:`?([a-zA-Z0-9_]+)`?\s+)?\(([^)]+)\),?$/i);
      if (idxMatch) {
        const idxName = idxMatch[1] || `idx_${tableName}_${Math.random().toString(36).substring(2, 6)}`;
        outIndexes.push(`CREATE INDEX IF NOT EXISTS \`${idxName}\` ON \`${tableName}\` (${idxMatch[2]});`);
        continue;
      }

      cleanedLines.push(line);
    }

    const translatedLines = [];
    for (let l of cleanedLines) {
      const colMatch = l.match(/^(\s*`?[a-zA-Z0-9_]+`?\s+)([\s\S]+)$/);
      if (!colMatch) {
        translatedLines.push(l);
        continue;
      }
      const colPrefix = colMatch[1];
      let colDef = colMatch[2];

      colDef = colDef
        .replace(/ON\s+UPDATE\s+CURRENT_TIMESTAMP/gi, '')
        .replace(/INT\s+(?:UNSIGNED\s+)?AUTO_INCREMENT\s+PRIMARY\s+KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
        .replace(/INT\s+AUTO_INCREMENT/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
        .replace(/BIGINT\s+(?:UNSIGNED\s+)?AUTO_INCREMENT\s+PRIMARY\s+KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
        .replace(/\bTINYINT\s*\(\s*\d+\s*\)/gi, 'INTEGER')
        .replace(/\bSMALLINT\s*(?:\(\s*\d+\s*\))?/gi, 'INTEGER')
        .replace(/\bMEDIUMINT\s*(?:\(\s*\d+\s*\))?/gi, 'INTEGER')
        .replace(/\bBIGINT\s*(?:\(\s*\d+\s*\))?/gi, 'INTEGER')
        .replace(/\bINT\s*\(\s*\d+\s*\)/gi, 'INTEGER')
        .replace(/\bINT\b/gi, 'INTEGER')
        .replace(/\bDECIMAL\s*\(\s*\d+\s*,\s*\d+\s*\)/gi, 'NUMERIC')
        .replace(/\bFLOAT\b|\bDOUBLE\b/gi, 'NUMERIC')
        .replace(/\bDATETIME\b/gi, 'TEXT')
        .replace(/\bDATE\b/gi, 'TEXT')
        .replace(/\bTIME\b/gi, 'TEXT')
        .replace(/\bVARCHAR\s*\(\s*\d+\s*\)/gi, 'TEXT')
        .replace(/\bLONGTEXT\b|\bMEDIUMTEXT\b|\bTINYTEXT\b/gi, 'TEXT')
        .replace(/CHARACTER\s+SET\s+[a-zA-Z0-9_]+/gi, '')
        .replace(/COLLATE\s+[a-zA-Z0-9_]+/gi, '');

      translatedLines.push(colPrefix + colDef);
    }
    body = translatedLines.join('\n');
    body = body.trim().replace(/,\s*$/, '');

    const hasTenant = /\btenant_id\b/i.test(body);
    const extraCols = [];
    if (TENANT_TABLES.has(tableName) && !hasTenant) {
      extraCols.push('  `tenant_id` TEXT NOT NULL DEFAULT \'tenant_default\'');
    }

    if (SYNCABLE_TABLES.has(tableName)) {
      if (!/\bsync_uuid\b/i.test(body)) {
        extraCols.push('  `sync_uuid` TEXT UNIQUE');
      }
      if (!/\bsync_status\b/i.test(body)) {
        extraCols.push('  `sync_status` TEXT DEFAULT \'pending\'');
      }
      if (!/\bserver_id\b/i.test(body)) {
        extraCols.push('  `server_id` INTEGER NULL');
      }
      if (!/\bdeleted_at\b/i.test(body)) {
        extraCols.push('  `deleted_at` TEXT NULL');
      }
      if (!/\bupdated_at\b/i.test(body)) {
        extraCols.push('  `updated_at` TEXT DEFAULT CURRENT_TIMESTAMP');
      }
    }

    if (extraCols.length > 0) {
      body += ',\n' + extraCols.join(',\n');
    }

    outTables.push(`CREATE TABLE IF NOT EXISTS \`${tableName}\` (\n${body}\n);`);
  }

  return { tables: outTables, indexes: outIndexes, views: outViews };
}

function addSqliteColumnIfMissing(db, table, colName, colDef) {
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(\`${table}\`)`).all();
    const exists = tableInfo.some(c => c.name.toLowerCase() === colName.toLowerCase());
    if (!exists) {
      db.exec(`ALTER TABLE \`${table}\` ADD COLUMN \`${colName}\` ${colDef}`);
    }
  } catch (e) {
    // Table may not exist yet
  }
}

async function initializeSqliteDatabase(db) {
  console.log('[SQLite] Initializing SQLite embedded database...');

  db.pragma('foreign_keys = OFF');
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  // Tenants table
  db.exec(`
    CREATE TABLE IF NOT EXISTS \`tenants\` (
      \`id\` TEXT NOT NULL PRIMARY KEY,
      \`name\` TEXT NOT NULL,
      \`shop_name\` TEXT NOT NULL,
      \`shop_address\` TEXT,
      \`phone\` TEXT,
      \`email\` TEXT,
      \`business_type\` TEXT DEFAULT 'retail',
      \`currency\` TEXT DEFAULT 'PKR',
      \`status\` TEXT DEFAULT 'active',
      \`created_at\` TEXT DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Read and translate schema.sql
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const { tables, indexes, views } = translateSchema(schemaSql);

  // Execute base tables
  for (const t of tables) {
    try {
      db.exec(t);
    } catch (err) {
      console.warn(`[SQLite] Table statement skipped (${err.message}):`, t.substring(0, 80));
    }
  }

  // Execute indexes
  for (const idx of indexes) {
    try {
      db.exec(idx);
    } catch (err) {
      // Index might already exist
    }
  }

  try {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS uq_sys_tenant_key ON system_settings (tenant_id, `key`);');
  } catch (_) {}

  // Execute views
  for (const v of views) {
    try {
      db.exec(v);
    } catch (err) {
      // Views might need tables created or already exist
    }
  }

  // Safe migration columns for feature parity with initDb.js
  addSqliteColumnIfMissing(db, 'sales', 'invoice_no', 'TEXT');
  addSqliteColumnIfMissing(db, 'sales', 'payment_mode', "TEXT DEFAULT 'cash'");
  addSqliteColumnIfMissing(db, 'sales', 'fbr_status', "TEXT DEFAULT 'PENDING'");
  addSqliteColumnIfMissing(db, 'sales', 'fbr_reference', 'TEXT');
  addSqliteColumnIfMissing(db, 'sales', 'split_payments', 'TEXT NULL');
  addSqliteColumnIfMissing(db, 'sales', 'tax_type', "TEXT DEFAULT 'inclusive'");
  addSqliteColumnIfMissing(db, 'sales', 'tax_rate', 'NUMERIC DEFAULT 0');
  addSqliteColumnIfMissing(db, 'sales', 'sale_type', "TEXT DEFAULT 'retail'");
  addSqliteColumnIfMissing(db, 'sales', 'customer_ntn', 'TEXT');
  addSqliteColumnIfMissing(db, 'sales', 'item_discount', 'NUMERIC DEFAULT 0');

  addSqliteColumnIfMissing(db, 'purchases', 'purchase_no', 'TEXT');
  addSqliteColumnIfMissing(db, 'purchases', 'payment_mode', "TEXT DEFAULT 'cash'");

  addSqliteColumnIfMissing(db, 'customers', 'district', 'TEXT NULL');
  addSqliteColumnIfMissing(db, 'customers', 'province', 'TEXT NULL');
  addSqliteColumnIfMissing(db, 'customers', 'shop_name', 'TEXT NULL');
  addSqliteColumnIfMissing(db, 'customers', 'customer_type', "TEXT DEFAULT 'retail'");
  addSqliteColumnIfMissing(db, 'customers', 'payment_terms', "TEXT DEFAULT 'cash'");
  addSqliteColumnIfMissing(db, 'customers', 'notes', 'TEXT NULL');
  addSqliteColumnIfMissing(db, 'customers', 'reference_name', 'TEXT NULL');
  addSqliteColumnIfMissing(db, 'customers', 'reference_phone', 'TEXT NULL');
  addSqliteColumnIfMissing(db, 'customers', 'updated_at', 'TEXT NULL');

  addSqliteColumnIfMissing(db, 'work_orders', 'machine_name', 'TEXT NULL');
  addSqliteColumnIfMissing(db, 'work_orders', 'device_model', 'TEXT NULL');
  addSqliteColumnIfMissing(db, 'work_orders', 'imei', 'TEXT NULL');
  addSqliteColumnIfMissing(db, 'work_orders', 'problem_description', 'TEXT NULL');
  addSqliteColumnIfMissing(db, 'work_orders', 'parts_used', 'TEXT NULL');
  addSqliteColumnIfMissing(db, 'work_orders', 'notes', 'TEXT NULL');
  addSqliteColumnIfMissing(db, 'work_orders', 'total_cost', 'NUMERIC DEFAULT 0');
  addSqliteColumnIfMissing(db, 'work_orders', 'total_amount', 'NUMERIC DEFAULT 0');
  addSqliteColumnIfMissing(db, 'work_orders', 'paid_amount', 'NUMERIC DEFAULT 0');
  addSqliteColumnIfMissing(db, 'work_orders', 'payment_status', "TEXT DEFAULT 'unpaid'");
  addSqliteColumnIfMissing(db, 'work_orders', 'payment_mode', "TEXT DEFAULT 'cash'");
  addSqliteColumnIfMissing(db, 'work_orders', 'created_by', 'INTEGER NULL');
  addSqliteColumnIfMissing(db, 'work_orders', 'assigned_by', 'INTEGER NULL');
  addSqliteColumnIfMissing(db, 'work_orders', 'commission_amount', 'NUMERIC DEFAULT 0');
  addSqliteColumnIfMissing(db, 'work_orders', 'completed_at', 'TEXT NULL');
  addSqliteColumnIfMissing(db, 'work_orders', 'deleted_at', 'TEXT NULL');
  addSqliteColumnIfMissing(db, 'work_orders', 'advance_amount', 'NUMERIC DEFAULT 0');
  addSqliteColumnIfMissing(db, 'work_orders', 'labor_amount', 'NUMERIC DEFAULT 0');
  addSqliteColumnIfMissing(db, 'work_orders', 'parts_amount', 'NUMERIC DEFAULT 0');

  // Product variants legacy & sync aliases
  addSqliteColumnIfMissing(db, 'product_variants', 'name', 'TEXT NULL');
  addSqliteColumnIfMissing(db, 'product_variants', 'sale_price', 'NUMERIC DEFAULT 0');
  addSqliteColumnIfMissing(db, 'product_variants', 'stock', 'NUMERIC DEFAULT 0');
  addSqliteColumnIfMissing(db, 'product_variants', 'expiry_date', 'TEXT NULL');

  // Ensure sync fields on all syncable tables
  for (const tbl of SYNCABLE_TABLES) {
    addSqliteColumnIfMissing(db, tbl, 'sync_uuid', 'TEXT UNIQUE');
    addSqliteColumnIfMissing(db, tbl, 'sync_status', "TEXT DEFAULT 'pending'");
    addSqliteColumnIfMissing(db, tbl, 'server_id', 'INTEGER NULL');
    addSqliteColumnIfMissing(db, tbl, 'updated_at', 'TEXT DEFAULT CURRENT_TIMESTAMP');
    addSqliteColumnIfMissing(db, tbl, 'deleted_at', 'TEXT NULL');
  }

  // Ensure tenant_id on all tenant tables
  for (const tbl of TENANT_TABLES) {
    addSqliteColumnIfMissing(db, tbl, 'tenant_id', "TEXT NOT NULL DEFAULT 'tenant_default'");
  }

  // Seed default tenant if not exists
  const existingTenant = db.prepare('SELECT id FROM tenants WHERE id = ?').get('tenant_default');
  if (!existingTenant) {
    db.prepare(`
      INSERT INTO tenants (id, name, shop_name, status)
      VALUES ('tenant_default', 'RAATH POS Main Store', 'RAATH POS Store', 'active')
    `).run();
  }

  // Seed default roles
  const defaultRoles = [
    { id: 'admin', label: 'Administrator', color: 'error', pages: JSON.stringify(DEFAULT_PAGES), is_default: 1 },
    { id: 'manager', label: 'Manager', color: 'warning', pages: JSON.stringify(['dashboard', 'pos', 'sales', 'inventory', 'products', 'customers', 'suppliers', 'purchases', 'expenses', 'reports', 'emi', 'services', 'distribution']), is_default: 0 },
    { id: 'cashier', label: 'Cashier / Seller', color: 'primary', pages: JSON.stringify(['dashboard', 'pos', 'sales', 'customers']), is_default: 0 },
    { id: 'viewer', label: 'Viewer', color: 'default', pages: JSON.stringify(['dashboard', 'sales', 'reports']), is_default: 0 }
  ];

  for (const r of defaultRoles) {
    const existing = db.prepare('SELECT id FROM roles WHERE id = ?').get(r.id);
    if (!existing) {
      db.prepare(`INSERT INTO roles (id, label, color, pages, is_default) VALUES (?, ?, ?, ?, ?)`).run(r.id, r.label, r.color, r.pages, r.is_default);
    }
  }

  // Seed default admin user
  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get('admin@raathpos.com', 'admin');
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('admin123', 10);
    db.prepare(`
      INSERT INTO users (tenant_id, name, username, email, password_hash, role, shop_name, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('tenant_default', 'Admin User', 'admin', 'admin@raathpos.com', passwordHash, 'admin', 'RAATH POS Store', 'active');
    console.log('[SQLite] Seeded default admin user (admin / admin123).');
  }

  // Seed default accounts
  const existingAccounts = db.prepare('SELECT id FROM accounts WHERE is_deleted = 0 AND tenant_id = ?').all('tenant_default');
  if (existingAccounts.length === 0) {
    db.prepare(`
      INSERT INTO accounts (tenant_id, name, type, opening_balance, current_balance, status, sync_status, sync_uuid)
      VALUES ('tenant_default', 'Cash in Hand', 'cash', 0.00, 0.00, 'active', 'synced', 'acc-seed-cash-001'),
             ('tenant_default', 'Main Bank Account', 'bank', 0.00, 0.00, 'active', 'synced', 'acc-seed-bank-001')
    `).run();
    console.log('[SQLite] Seeded default cash & bank accounts.');
  }

  // Seed default categories & brands
  const existingCats = db.prepare('SELECT id FROM categories WHERE is_deleted = 0 AND tenant_id = ?').all('tenant_default');
  if (existingCats.length === 0) {
    db.prepare(`INSERT INTO categories (tenant_id, name, slug, status) VALUES ('tenant_default', 'General', 'general', 'active')`).run();
    db.prepare(`INSERT INTO brands (tenant_id, name, status) VALUES ('tenant_default', 'General', 'active')`).run();
    console.log('[SQLite] Seeded default Category and Brand.');
  }

  // Seed default expense categories
  const existingExp = db.prepare('SELECT id FROM expense_categories WHERE is_deleted = 0 AND tenant_id = ?').all('tenant_default');
  if (existingExp.length === 0) {
    const expStmt = db.prepare(`INSERT INTO expense_categories (tenant_id, name, color, description) VALUES (?, ?, ?, ?)`);
    expStmt.run('tenant_default', 'Rent', '#f44336', 'Shop & Warehouse Rent');
    expStmt.run('tenant_default', 'Utilities', '#ff9800', 'Electricity, Water, Internet');
    expStmt.run('tenant_default', 'Salaries', '#4caf50', 'Staff & Employee Salaries');
    expStmt.run('tenant_default', 'Stationery', '#2196f3', 'Office & Printing supplies');
    expStmt.run('tenant_default', 'Maintenance', '#9c27b0', 'Repairs & Maintenance');
    expStmt.run('tenant_default', 'Other', '#757575', 'Miscellaneous Expenses');
    console.log('[SQLite] Seeded default Expense Categories.');
  }

  // Seed default system settings
  const defaultSettings = [
    { key: 'shop_name', value: 'RAATH POS Store', description: 'Business Store Name' },
    { key: 'currency', value: 'PKR', description: 'Default System Currency' },
    { key: 'tax_rate', value: '0', description: 'Default Sales Tax %' },
    { key: 'fbr_enabled', value: '0', description: 'Enable FBR Integration (1/0)' },
    { key: 'invoice_prefix', value: 'INV-', description: 'Invoice Prefix' }
  ];
  for (const s of defaultSettings) {
    const existing = db.prepare('SELECT id FROM system_settings WHERE tenant_id = ? AND `key` = ?').get('tenant_default', s.key);
    if (!existing) {
      db.prepare(`INSERT INTO system_settings (tenant_id, \`key\`, \`value\`, description) VALUES ('tenant_default', ?, ?, ?)`).run(s.key, s.value, s.description);
    }
  }

  console.log('[SQLite] Database initialized successfully!');
  return true;
}

module.exports = {
  initializeSqliteDatabase,
  SYNCABLE_TABLES,
  TENANT_TABLES
};
