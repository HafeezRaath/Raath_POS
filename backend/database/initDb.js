// ============================================================
//  backend/database/initDb.js - Database Initializer & Seeder
//  Multi-Tenant Database Configuration
// ============================================================

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT, 10) || 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'raath_pos_db';

const DEFAULT_PAGES = [
  'dashboard', 'pos', 'sales', 'inventory', 'products', 'customers', 
  'suppliers', 'purchases', 'expenses', 'reports', 'settings', 'emi', 
  'users', 'backup', 'services', 'distribution'
];

const TENANT_TABLES = [
  'account_daily_balances', 'account_transactions', 'accounts', 'audit_logs',
  'brands', 'categories', 'customer_emi_summary', 'customer_ledger',
  'customer_sales_history', 'customers', 'deals', 'distributor_ledger',
  'distributor_order_items', 'distributor_orders', 'distributor_payments',
  'distributor_return_items', 'distributor_returns', 'distributors',
  'emi_documents', 'emi_guarantors', 'emi_payments', 'emi_penalty_rules',
  'emi_records', 'emi_reschedule_log', 'emi_schedule', 'emi_visit_log',
  'emis', 'expense_categories', 'expenses', 'fbr_invoices', 'general_ledger',
  'offer_items', 'offers', 'payments', 'product_serialized_items',
  'product_variants', 'products', 'purchase_items', 'purchase_return_items',
  'purchase_returns', 'purchases', 'sale_items', 'sale_return_items',
  'sale_returns', 'sales', 'salesman_advances', 'salesman_commission_payouts',
  'salesman_ledger', 'salesman_salary_payments', 'salesman_sale_items',
  'salesman_sale_return_items', 'salesman_sale_returns', 'salesman_sales',
  'salesmen', 'services', 'staff', 'supplier_ledger', 'suppliers',
  'system_settings', 'users', 'warehouse_stocks', 'warehouses', 'work_orders'
];

async function addColumnIfMissing(conn, table, columnDef) {
  const colName = columnDef.trim().split(' ')[0].replace(/[`]/g, '');
  try {
    const [cols] = await conn.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [colName]);
    if (cols.length === 0) {
      await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN ${columnDef}`);
      console.log(`[InitDB] Added column ${colName} to ${table}`);
    }
  } catch (e) {
    // table might not exist yet, that is fine
  }
}

async function initializeDatabase() {
  console.log(`[InitDB] Connecting to MySQL at ${DB_HOST}:${DB_PORT} as ${DB_USER}...`);
  
  let connection;
  try {
    // 1. Connect without database selected to create it if missing
    connection = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      multipleStatements: true
    });

    console.log(`[InitDB] Creating database '${DB_NAME}' if not exists...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`${DB_NAME}\`;`);

    // 2. Multi-tenant table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`tenants\` (
        \`id\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`name\` VARCHAR(150) NOT NULL,
        \`shop_name\` VARCHAR(150) NOT NULL,
        \`shop_address\` TEXT,
        \`phone\` VARCHAR(50),
        \`email\` VARCHAR(100),
        \`business_type\` VARCHAR(50) DEFAULT 'retail',
        \`currency\` VARCHAR(10) DEFAULT 'PKR',
        \`status\` VARCHAR(20) DEFAULT 'active',
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      INSERT INTO \`tenants\` (\`id\`, \`name\`, \`shop_name\`, \`status\`)
      VALUES ('tenant_default', 'RAATH POS Main Store', 'RAATH POS Store', 'active')
      ON DUPLICATE KEY UPDATE \`id\` = \`id\`;
    `);

    // 3. Read schema.sql and split base tables from views
    console.log('[InitDB] Reading schema.sql...');
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    const viewSplitIndex = schemaSql.indexOf('-- ==================== VIEWS ====================');
    const tablesSql = viewSplitIndex !== -1 ? schemaSql.substring(0, viewSplitIndex) : schemaSql;
    const viewsSql = viewSplitIndex !== -1 ? schemaSql.substring(viewSplitIndex) : '';

    // 4. Create all base tables first
    console.log('[InitDB] Executing base tables...');
    await connection.query(tablesSql);
    console.log('[InitDB] Base tables created.');

    // 5. Safe migrations for existing tables before running views
    await addColumnIfMissing(connection, 'emi_payments', '`penalty_amount` DECIMAL(15,2) DEFAULT 0');
    await addColumnIfMissing(connection, 'emi_payments', '`discount_amount` DECIMAL(15,2) DEFAULT 0');
    await addColumnIfMissing(connection, 'emi_payments', '`total_received` DECIMAL(15,2) DEFAULT 0');
    await addColumnIfMissing(connection, 'emi_payments', '`payment_mode` VARCHAR(50) DEFAULT "cash"');
    await addColumnIfMissing(connection, 'emi_payments', '`receipt_no` VARCHAR(100)');
    await addColumnIfMissing(connection, 'emi_payments', '`is_reversal` TINYINT(1) DEFAULT 0');

    await addColumnIfMissing(connection, 'sales', '`invoice_no` VARCHAR(100)');
    await addColumnIfMissing(connection, 'sales', '`payment_mode` VARCHAR(50) DEFAULT "cash"');
    await addColumnIfMissing(connection, 'sales', '`fbr_status` VARCHAR(50) DEFAULT "PENDING"');
    await addColumnIfMissing(connection, 'sales', '`fbr_reference` VARCHAR(150)');

    await addColumnIfMissing(connection, 'purchases', '`purchase_no` VARCHAR(100)');
    await addColumnIfMissing(connection, 'purchases', '`payment_mode` VARCHAR(50) DEFAULT "cash"');

    await addColumnIfMissing(connection, 'salesmen', '`commission_percent` DECIMAL(5,2) DEFAULT 0');
    await addColumnIfMissing(connection, 'salesmen', '`base_salary` DECIMAL(15,2) DEFAULT 0');
    await addColumnIfMissing(connection, 'salesmen', '`target_amount` DECIMAL(15,2) DEFAULT 0');
    await addColumnIfMissing(connection, 'salesmen', '`current_sales` DECIMAL(15,2) DEFAULT 0');

    await addColumnIfMissing(connection, 'distributors', '`company_name` VARCHAR(150)');
    await addColumnIfMissing(connection, 'distributors', '`cnic` VARCHAR(50)');
    await addColumnIfMissing(connection, 'distributors', '`district` VARCHAR(100)');
    await addColumnIfMissing(connection, 'distributors', '`province` VARCHAR(100)');
    await addColumnIfMissing(connection, 'distributors', '`territory` VARCHAR(150)');
    await addColumnIfMissing(connection, 'distributors', '`credit_limit` DECIMAL(15,2) DEFAULT 0');
    await addColumnIfMissing(connection, 'distributors', '`commission_percent` DECIMAL(5,2) DEFAULT 0');

    await addColumnIfMissing(connection, 'product_variants', '`variant_name` VARCHAR(150) DEFAULT "Default"');
    await addColumnIfMissing(connection, 'product_variants', '`name` VARCHAR(150) DEFAULT "Default"');
    await addColumnIfMissing(connection, 'product_variants', '`retail_price` DECIMAL(15,2) DEFAULT 0');
    await addColumnIfMissing(connection, 'product_variants', '`sale_price` DECIMAL(15,2) DEFAULT 0');
    await addColumnIfMissing(connection, 'product_variants', '`wholesale_price` DECIMAL(15,2) DEFAULT 0');
    await addColumnIfMissing(connection, 'product_variants', '`minimum_retail_price` DECIMAL(15,2) DEFAULT 0');
    await addColumnIfMissing(connection, 'product_variants', '`current_stock` DECIMAL(12,3) DEFAULT 0');
    await addColumnIfMissing(connection, 'product_variants', '`stock` DECIMAL(12,3) DEFAULT 0');
    await addColumnIfMissing(connection, 'product_variants', '`stock_alert_quantity` DECIMAL(12,3) DEFAULT 5');
    await addColumnIfMissing(connection, 'product_variants', '`image_url` LONGTEXT');
    await addColumnIfMissing(connection, 'product_variants', '`deleted_at` DATETIME NULL');

    await addColumnIfMissing(connection, 'product_serialized_items', '`product_variant_id` INT NULL');
    await addColumnIfMissing(connection, 'product_serialized_items', '`serial_number_or_imei` VARCHAR(100)');
    await addColumnIfMissing(connection, 'product_serialized_items', '`purchase_item_id` INT NULL');

    try {
      await connection.query("UPDATE `product_variants` SET `variant_name` = COALESCE(`name`, 'Default') WHERE `variant_name` IS NULL OR `variant_name` = ''");
      await connection.query("UPDATE `product_variants` SET `name` = COALESCE(`variant_name`, 'Default') WHERE `name` IS NULL OR `name` = ''");
      await connection.query("UPDATE `product_variants` SET `retail_price` = `sale_price` WHERE (`retail_price` IS NULL OR `retail_price` = 0) AND `sale_price` > 0");
      await connection.query("UPDATE `product_variants` SET `sale_price` = `retail_price` WHERE (`sale_price` IS NULL OR `sale_price` = 0) AND `retail_price` > 0");
      await connection.query("UPDATE `product_variants` SET `current_stock` = `stock` WHERE (`current_stock` IS NULL OR `current_stock` = 0) AND `stock` > 0");
      await connection.query("UPDATE `product_variants` SET `stock` = `current_stock` WHERE (`stock` IS NULL OR `stock` = 0) AND `current_stock` > 0");
    } catch (syncErr) {
      // Ignore if table was empty
    }

    // 6. Ensure tenant_id on all 63 tables
    for (const tbl of TENANT_TABLES) {
      await addColumnIfMissing(connection, tbl, '`tenant_id` VARCHAR(50) NOT NULL DEFAULT "tenant_default"');
    }

    // 7. Now execute views (guaranteed to find tenant_id and migration columns)
    if (viewsSql) {
      console.log('[InitDB] Executing views...');
      await connection.query(viewsSql);
    }
    console.log('[InitDB] All tables & views created successfully.');

    // 6. Seed Default Roles
    console.log('[InitDB] Checking/seeding default roles...');
    const defaultRoles = [
      {
        id: 'admin',
        label: 'Administrator',
        color: 'error',
        pages: JSON.stringify(DEFAULT_PAGES),
        is_default: 1
      },
      {
        id: 'manager',
        label: 'Manager',
        color: 'warning',
        pages: JSON.stringify(['dashboard', 'pos', 'sales', 'inventory', 'products', 'customers', 'suppliers', 'purchases', 'expenses', 'reports', 'emi', 'services', 'distribution']),
        is_default: 0
      },
      {
        id: 'cashier',
        label: 'Cashier / Seller',
        color: 'primary',
        pages: JSON.stringify(['dashboard', 'pos', 'sales', 'customers']),
        is_default: 0
      },
      {
        id: 'viewer',
        label: 'Viewer',
        color: 'default',
        pages: JSON.stringify(['dashboard', 'sales', 'reports']),
        is_default: 0
      }
    ];

    for (const r of defaultRoles) {
      await connection.query(
        `INSERT INTO roles (id, label, color, pages, is_default)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE label=VALUES(label), pages=VALUES(pages)`,
        [r.id, r.label, r.color, r.pages, r.is_default]
      );
    }

    // 7. Seed Default Admin User
    console.log('[InitDB] Checking/seeding default admin user...');
    const [existingUsers] = await connection.query('SELECT id FROM users WHERE email = ? OR username = ?', ['admin@raathpos.com', 'admin']);
    if (existingUsers.length === 0) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      await connection.query(
        `INSERT INTO users (tenant_id, name, username, email, password_hash, role, shop_name, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ['tenant_default', 'Admin User', 'admin', 'admin@raathpos.com', passwordHash, 'admin', 'RAATH POS Store', 'active']
      );
      console.log('[InitDB] Created default admin user (username: admin / password: admin123).');
    }

    // 8. Seed Default Accounts
    const [existingAccounts] = await connection.query('SELECT id FROM accounts WHERE is_deleted = 0 AND tenant_id = "tenant_default"');
    if (existingAccounts.length === 0) {
      await connection.query(
        `INSERT INTO accounts (tenant_id, name, type, opening_balance, current_balance, status) VALUES
         ('tenant_default', 'Cash in Hand', 'cash', 0.00, 0.00, 'active'),
         ('tenant_default', 'Main Bank Account', 'bank', 0.00, 0.00, 'active')`
      );
      console.log('[InitDB] Seeded default cash & bank accounts.');
    }

    // 9. Seed Default Category & Brand
    const [existingCats] = await connection.query('SELECT id FROM categories WHERE is_deleted = 0 AND tenant_id = "tenant_default"');
    if (existingCats.length === 0) {
      await connection.query(`INSERT INTO categories (tenant_id, name, slug, status) VALUES ('tenant_default', 'General', 'general', 'active')`);
      await connection.query(`INSERT INTO brands (tenant_id, name, status) VALUES ('tenant_default', 'General', 'active')`);
      console.log('[InitDB] Seeded default Category and Brand.');
    }

    // 10. Seed Default Expense Categories
    const [existingExpCats] = await connection.query('SELECT id FROM expense_categories WHERE is_deleted = 0 AND tenant_id = "tenant_default"');
    if (existingExpCats.length === 0) {
      await connection.query(`INSERT INTO expense_categories (tenant_id, name, color, description) VALUES 
        ('tenant_default', 'Rent', '#f44336', 'Shop & Warehouse Rent'),
        ('tenant_default', 'Utilities', '#ff9800', 'Electricity, Water, Internet'),
        ('tenant_default', 'Salaries', '#4caf50', 'Staff & Employee Salaries'),
        ('tenant_default', 'Stationery', '#2196f3', 'Office & Printing supplies'),
        ('tenant_default', 'Maintenance', '#9c27b0', 'Repairs & Maintenance'),
        ('tenant_default', 'Other', '#757575', 'Miscellaneous Expenses')`);
      console.log('[InitDB] Seeded default Expense Categories.');
    }

    // 11. Seed Default System Settings
    const defaultSettings = [
      { key: 'shop_name', value: 'RAATH POS Store', description: 'Business Store Name' },
      { key: 'currency', value: 'PKR', description: 'Default System Currency' },
      { key: 'tax_rate', value: '0', description: 'Default Sales Tax %' },
      { key: 'fbr_enabled', value: '0', description: 'Enable FBR Integration (1/0)' },
      { key: 'invoice_prefix', value: 'INV-', description: 'Invoice Prefix' }
    ];
    for (const s of defaultSettings) {
      await connection.query(
        `INSERT INTO system_settings (tenant_id, \`key\`, \`value\`, description) VALUES ('tenant_default', ?, ?, ?)
         ON DUPLICATE KEY UPDATE description=VALUES(description)`,
        [s.key, s.value, s.description]
      );
    }

    console.log('[InitDB] Database initialization completed successfully!');
    return true;
  } catch (error) {
    console.error('[InitDB] Error initializing database:', error.message);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
}

if (require.main === module) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { initializeDatabase };
