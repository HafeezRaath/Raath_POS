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
    try {
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    } catch (dbErr) {
      // Shared hosting DB users often lack CREATE DATABASE privilege.
      // The database already exists in production — continue with migrations.
      console.warn(`[InitDB] CREATE DATABASE skipped (${dbErr.message}); continuing with existing database.`);
    }
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

    // 4. Create all base tables first — statement by statement, so one bad
    //    statement can never abort the rest of the migration (shared hosting
    //    lesson: a single access-denied used to kill the entire batch).
    console.log('[InitDB] Executing base tables...');
    const isCommentOnly = (s) => s.split('\n').every(l => !l.trim() || l.trim().startsWith('--'));
    const tableStatements = tablesSql.split(';').map(s => s.trim()).filter(s => s && !isCommentOnly(s));
    let tableOk = 0, tableSkipped = 0;
    for (const stmt of tableStatements) {
      try {
        await connection.query(stmt);
        tableOk++;
      } catch (stmtErr) {
        tableSkipped++;
        console.warn(`[InitDB] Statement skipped (${stmtErr.message}): ${stmt.substring(0, 90).replace(/\n/g, ' ')}...`);
      }
    }
    console.log(`[InitDB] Base tables done: ${tableOk} executed, ${tableSkipped} skipped.`);

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
    await addColumnIfMissing(connection, 'sales', '`split_payments` TEXT NULL');
    await addColumnIfMissing(connection, 'sales', '`tax_type` VARCHAR(50) DEFAULT "inclusive"');
    await addColumnIfMissing(connection, 'sales', '`tax_rate` DECIMAL(5,2) DEFAULT 0');
    await addColumnIfMissing(connection, 'sales', '`sale_type` VARCHAR(50) DEFAULT "retail"');
    await addColumnIfMissing(connection, 'sales', '`customer_ntn` VARCHAR(100)');
    await addColumnIfMissing(connection, 'sales', '`item_discount` DECIMAL(15,2) DEFAULT 0');

    await addColumnIfMissing(connection, 'work_orders', '`machine_name` VARCHAR(150) NULL');
    await addColumnIfMissing(connection, 'account_transactions', '`reference_no` VARCHAR(100) NULL');
    await addColumnIfMissing(connection, 'emi_records', '`is_deleted` TINYINT(1) DEFAULT 0');
    await addColumnIfMissing(connection, 'work_orders', '`device_model` VARCHAR(150) NULL');
    await addColumnIfMissing(connection, 'work_orders', '`imei` VARCHAR(100) NULL');
    await addColumnIfMissing(connection, 'work_orders', '`problem_description` TEXT NULL');
    await addColumnIfMissing(connection, 'work_orders', '`parts_used` TEXT NULL');
    await addColumnIfMissing(connection, 'work_orders', '`notes` TEXT NULL');
    await addColumnIfMissing(connection, 'work_orders', '`total_cost` DECIMAL(15,2) DEFAULT 0');
    await addColumnIfMissing(connection, 'work_orders', '`total_amount` DECIMAL(15,2) DEFAULT 0');
    await addColumnIfMissing(connection, 'work_orders', '`paid_amount` DECIMAL(15,2) DEFAULT 0');
    await addColumnIfMissing(connection, 'work_orders', '`payment_status` VARCHAR(50) DEFAULT "unpaid"');
    await addColumnIfMissing(connection, 'work_orders', '`payment_mode` VARCHAR(50) DEFAULT "cash"');
    await addColumnIfMissing(connection, 'work_orders', '`commission_amount` DECIMAL(15,2) DEFAULT 0');
    await addColumnIfMissing(connection, 'work_orders', '`completed_at` DATETIME NULL');
    await addColumnIfMissing(connection, 'work_orders', '`deleted_at` DATETIME NULL');
    // Mobile shop: repair job card fields
    await addColumnIfMissing(connection, 'work_orders', '`photo_before_url` VARCHAR(500) NULL');
    await addColumnIfMissing(connection, 'work_orders', '`photo_after_url` VARCHAR(500) NULL');
    await addColumnIfMissing(connection, 'work_orders', '`condition_notes` TEXT NULL');
    await addColumnIfMissing(connection, 'work_orders', '`passcode_encrypted` TEXT NULL');
    await addColumnIfMissing(connection, 'work_orders', '`advance_amount` DECIMAL(15,2) DEFAULT 0');
    await addColumnIfMissing(connection, 'work_orders', '`labor_amount` DECIMAL(15,2) DEFAULT 0');
    await addColumnIfMissing(connection, 'work_orders', '`parts_amount` DECIMAL(15,2) DEFAULT 0');
    await addColumnIfMissing(connection, 'work_orders', '`commission_percent` DECIMAL(5,2) DEFAULT 0');
    // Staff table: tenant scoping (getStaff filters by tenant_id)
    await addColumnIfMissing(connection, 'staff', '`tenant_id` VARCHAR(100) DEFAULT \'tenant_default\'');
    // Advanced EMI columns
    await addColumnIfMissing(connection, 'emi_records', '`source_mode` VARCHAR(20) DEFAULT \'inventory\'');
    await addColumnIfMissing(connection, 'emi_records', '`device_imei_id` INT NULL');
    await addColumnIfMissing(connection, 'emi_records', '`cost_price` DECIMAL(15,2) DEFAULT 0');
    await addColumnIfMissing(connection, 'emi_records', '`interest_type` VARCHAR(20) DEFAULT \'percentage\'');
    await addColumnIfMissing(connection, 'emi_records', '`fixed_interest_per_month` DECIMAL(15,2) DEFAULT 0');
    await addColumnIfMissing(connection, 'emi_records', '`product_source` VARCHAR(20) DEFAULT \'inventory\'');
    await addColumnIfMissing(connection, 'emi_records', '`source_name` VARCHAR(255) DEFAULT \'\'');
    await addColumnIfMissing(connection, 'emi_records', '`source_purchase_price` DECIMAL(15,2) DEFAULT 0');
    await addColumnIfMissing(connection, 'emi_records', '`interest_amount` DECIMAL(15,2) DEFAULT 0');
    await addColumnIfMissing(connection, 'emi_records', '`total_payable` DECIMAL(15,2) DEFAULT 0');
    await addColumnIfMissing(connection, 'emi_records', '`monthly_target` DECIMAL(15,2) DEFAULT 0');
    await addColumnIfMissing(connection, 'emi_records', '`early_settlement_discount` DECIMAL(15,2) DEFAULT 0');
    await addColumnIfMissing(connection, 'emi_records', '`settled_at` DATETIME NULL');
    await addColumnIfMissing(connection, 'emi_records', '`cnic_only` TINYINT(1) DEFAULT 0');
    await addColumnIfMissing(connection, 'emi_guarantors', '`guarantor_id` INT NULL');
    await addColumnIfMissing(connection, 'emi_schedule', '`tenant_id` VARCHAR(100) DEFAULT \'tenant_default\'');

    try {
      await connection.query("ALTER TABLE `users` MODIFY COLUMN `email` VARCHAR(150) NULL");
    } catch (e) {
      // Ignore if already nullable
    }

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
    await addColumnIfMissing(connection, 'product_variants', '`description` LONGTEXT NULL');
    // Bookshop bundles: tenant_id must be VARCHAR like every other table
    // (early schema created it as INT; coerce existing 0 -> 'tenant_default')
    try {
      const [bcols] = await connection.query(`SHOW COLUMNS FROM \`bundles\` LIKE 'tenant_id'`);
      if (bcols.length > 0 && /int/i.test(bcols[0].Type || '')) {
        await connection.query(`ALTER TABLE \`bundles\` MODIFY COLUMN \`tenant_id\` VARCHAR(50) NOT NULL DEFAULT 'tenant_default'`);
        await connection.query(`UPDATE \`bundles\` SET \`tenant_id\` = 'tenant_default' WHERE \`tenant_id\` = '0' OR \`tenant_id\` = ''`);
        console.log('[InitDB] Fixed bundles.tenant_id -> VARCHAR(50)');
      }
    } catch (e) { /* bundles table may not exist yet */ }
    // Ensure products.id is AUTO_INCREMENT PRIMARY KEY (live DBs created from
    // older schemas may lack it, causing insertId=null and broken product saves).
    // v18 diagnostic proved the only duplicate-id rows are 3 TEST artifacts
    // (DEMO-Test Product, QATEST-API-Probe, QATEST-V15-Probe) with id=0.
    // v19: remove exactly those test rows (+ their orphan variants), then
    // add PRIMARY KEY and AUTO_INCREMENT. Real data is never touched:
    // deletion is restricted to id=0 AND (name/sku LIKE 'QATEST-%' OR 'DEMO-%').
    try {
      const [idCols] = await connection.query(
        `SELECT EXTRA, COLUMN_KEY FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'id'`
      );
      if (idCols.length > 0 && !String(idCols[0].EXTRA || '').toLowerCase().includes('auto_increment')) {
        const testFilter = `(p.name LIKE 'QATEST-%' OR p.name LIKE 'DEMO-%' OR p.sku LIKE 'QATEST-%' OR p.sku LIKE 'DEMO-%')`;
        const [doomed] = await connection.query(
          `SELECT id, name, sku FROM \`products\` p WHERE p.id = 0 AND ${testFilter}`
        );
        console.log('[InitDB] Test product rows to remove: ' + JSON.stringify(doomed));
        if (doomed.length > 0) {
          await connection.query(
            `DELETE pv FROM \`product_variants\` pv INNER JOIN \`products\` p ON pv.product_id = p.id WHERE p.id = 0 AND ${testFilter}`
          );
          const [delRes] = await connection.query(
            `DELETE FROM \`products\` WHERE id = 0 AND (name LIKE 'QATEST-%' OR name LIKE 'DEMO-%' OR sku LIKE 'QATEST-%' OR sku LIKE 'DEMO-%')`
          );
          console.log(`[InitDB] Removed ${delRes.affectedRows} test product rows (id=0).`);
        }
        // Only proceed if no duplicate ids remain
        const [dupes] = await connection.query(
          `SELECT id, COUNT(*) AS c FROM \`products\` GROUP BY id HAVING c > 1 LIMIT 5`
        );
        if (dupes.length === 0) {
          if (String(idCols[0].COLUMN_KEY || '').toUpperCase() !== 'PRI') {
            await connection.query(`ALTER TABLE \`products\` ADD PRIMARY KEY (\`id\`)`);
            console.log('[InitDB] Added PRIMARY KEY on products.id');
          }
          await connection.query(`ALTER TABLE \`products\` MODIFY COLUMN \`id\` INT NOT NULL AUTO_INCREMENT`);
          console.log('[InitDB] Fixed products.id -> AUTO_INCREMENT PRIMARY KEY');
        } else {
          console.warn('[InitDB] Duplicate ids still present, PK/AI skipped: ' + JSON.stringify(dupes));
        }
      } else {
        console.log('[InitDB] products.id already AUTO_INCREMENT — nothing to do.');
      }
    } catch (e) {
      console.warn('[InitDB] products.id fix skipped: ' + e.message);
    }

    // ---- Generic id repair for other tables (same bug class as products) ----
    // Customers table had the identical issue: id=0 rows -> edit mass-updated
    // all id=0 rows (editingId=0), payments silently no-oped (!id).
    // v21: column-agnostic — builds the test-row filter from columns that
    // actually exist in each table (v20 wrongly assumed name/sku everywhere).
    const repairTableId = async (table) => {
      try {
        const [cols] = await connection.query(
          `SELECT EXTRA, COLUMN_KEY FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'id'`,
          [table]
        );
        if (cols.length === 0) return; // no id column
        if (String(cols[0].EXTRA || '').toLowerCase().includes('auto_increment')) {
          console.log(`[InitDB] ${table}.id already AUTO_INCREMENT — nothing to do.`);
          return;
        }
        // Discover text columns that actually exist for the test-row filter
        const [allCols] = await connection.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
          [table]
        );
        const colNames = allCols.map(c => c.COLUMN_NAME);
        const candidates = ['name', 'sku', 'title', 'username', 'email', 'invoice_no', 'invoice_number', 'purchase_no', 'purchase_number', 'customer_name', 'supplier_name', 'company_name', 'description', 'notes'];
        const textCols = candidates.filter(c => colNames.includes(c));
        if (textCols.length === 0) {
          console.warn(`[InitDB] ${table}: no text columns for test filter — manual review needed, PK/AI skipped.`);
          return;
        }
        const testFilter = textCols.map(c => `(\`${c}\` LIKE 'QATEST-%' OR \`${c}\` LIKE 'QATEST %' OR \`${c}\` LIKE 'DEMO-%' OR \`${c}\` LIKE 'DEMO %')`).join(' OR ');
        const [doomed] = await connection.query(
          `SELECT id FROM \`${table}\` WHERE id = 0 AND (${testFilter})`
        );
        if (doomed.length > 0) {
          const [delRes] = await connection.query(
            `DELETE FROM \`${table}\` WHERE id = 0 AND (${testFilter})`
          );
          console.log(`[InitDB] Removed ${delRes.affectedRows} test rows (id=0) from ${table}.`);
        }
        const [dupes] = await connection.query(
          `SELECT id, COUNT(*) AS c FROM \`${table}\` GROUP BY id HAVING c > 1 LIMIT 3`
        );
        if (dupes.length > 0) {
          console.warn(`[InitDB] ${table}: duplicate ids remain, PK/AI skipped: ` + JSON.stringify(dupes));
          return;
        }
        if (String(cols[0].COLUMN_KEY || '').toUpperCase() !== 'PRI') {
          await connection.query(`ALTER TABLE \`${table}\` ADD PRIMARY KEY (\`id\`)`);
          console.log(`[InitDB] Added PRIMARY KEY on ${table}.id`);
        }
        await connection.query(`ALTER TABLE \`${table}\` MODIFY COLUMN \`id\` INT NOT NULL AUTO_INCREMENT`);
        console.log(`[InitDB] Fixed ${table}.id -> AUTO_INCREMENT PRIMARY KEY`);
      } catch (e) {
        console.warn(`[InitDB] ${table}.id repair skipped: ` + e.message);
      }
    };
    // Tables where the app INSERTs without id and expects insertId back
    for (const t of ['customers', 'suppliers', 'expenses', 'product_variants', 'sales', 'purchases', 'accounts', 'account_transactions', 'emi_records', 'emi_payments', 'emi_schedule', 'work_orders', 'repairs', 'users', 'roles']) {
      await repairTableId(t);
    }
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

    // Safe migrations for Audit Logs, Packaging, Expiry & Purchase Orders
    await addColumnIfMissing(connection, 'audit_logs', '`user_name` VARCHAR(150)');
    await addColumnIfMissing(connection, 'audit_logs', '`user_role` VARCHAR(50)');
    await addColumnIfMissing(connection, 'audit_logs', '`details` TEXT');
    await addColumnIfMissing(connection, 'audit_logs', '`ip_address` VARCHAR(50)');

    await addColumnIfMissing(connection, 'products', '`expiry_date` DATE NULL');
    // Vertical modules (Shoes/Garments/Pharmacy/Grocery): article number, season, rack location
    await addColumnIfMissing(connection, 'products', '`article_no` VARCHAR(100) NULL');
    await addColumnIfMissing(connection, 'products', '`season` VARCHAR(50) NULL');
    await addColumnIfMissing(connection, 'products', '`rack_location` VARCHAR(150) NULL');
    await addColumnIfMissing(connection, 'product_variants', '`article_no` VARCHAR(100) NULL');
    await addColumnIfMissing(connection, 'product_variants', '`color` VARCHAR(80) NULL');
    await addColumnIfMissing(connection, 'product_variants', '`size` VARCHAR(40) NULL');
    await addColumnIfMissing(connection, 'products', '`carton_qty` INT DEFAULT 0');
    await addColumnIfMissing(connection, 'products', '`boxes_per_carton` INT DEFAULT 0');
    await addColumnIfMissing(connection, 'products', '`pieces_per_box` INT DEFAULT 0');
    await addColumnIfMissing(connection, 'products', '`carton_price` DECIMAL(15,2) DEFAULT 0');
    await addColumnIfMissing(connection, 'products', '`box_price` DECIMAL(15,2) DEFAULT 0');

    await addColumnIfMissing(connection, 'product_variants', '`expiry_date` DATE NULL');
    await addColumnIfMissing(connection, 'purchase_items', '`expiry_date` DATE NULL');

    // Product batches: batch-wise pricing + expiry (Grocery / Pharmacy verticals)
    // Stock lots: har purchase pe nayi row; purani batches ki price overwrite nahi hoti.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`product_batches\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`tenant_id\` VARCHAR(50) NOT NULL DEFAULT 'tenant_default',
        \`product_id\` INT NOT NULL,
        \`variant_id\` INT NULL,
        \`batch_no\` VARCHAR(100) NULL,
        \`expiry_date\` DATE NULL,
        \`supplier_id\` INT NULL,
        \`qty_received\` DECIMAL(15,3) DEFAULT 0,
        \`qty_remaining\` DECIMAL(15,3) DEFAULT 0,
        \`cost_price\` DECIMAL(15,2) DEFAULT 0,
        \`sale_price\` DECIMAL(15,2) DEFAULT 0,
        \`is_active\` TINYINT(1) DEFAULT 1,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_pb_prod (\`product_id\`),
        INDEX idx_pb_variant (\`variant_id\`),
        INDEX idx_pb_expiry (\`expiry_date\`),
        INDEX idx_pb_tenant (\`tenant_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Bookshop: class bundles (idempotent)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`bundles\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`tenant_id\` VARCHAR(50) NOT NULL DEFAULT 'tenant_default',
        \`name\` VARCHAR(200) NOT NULL,
        \`class_name\` VARCHAR(100) NULL,
        \`sku\` VARCHAR(100) NULL,
        \`barcode\` VARCHAR(100) NULL,
        \`bundle_price\` DECIMAL(15,2) NOT NULL DEFAULT 0,
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`notes\` TEXT NULL,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_bundles_tenant (\`tenant_id\`),
        INDEX idx_bundles_barcode (\`tenant_id\`, \`barcode\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`bundle_items\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`bundle_id\` INT NOT NULL,
        \`product_variant_id\` INT NOT NULL,
        \`qty\` INT NOT NULL DEFAULT 1,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_bi_bundle (\`bundle_id\`),
        INDEX idx_bi_variant (\`product_variant_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Create Purchase Orders tables if not exist
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`purchase_orders\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`tenant_id\` VARCHAR(50) NOT NULL DEFAULT 'tenant_default',
        \`po_no\` VARCHAR(100) UNIQUE NOT NULL,
        \`supplier_id\` INT NULL,
        \`supplier_name\` VARCHAR(150),
        \`order_date\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`expected_delivery_date\` DATE NULL,
        \`status\` VARCHAR(50) DEFAULT 'draft',
        \`subtotal\` DECIMAL(15,2) DEFAULT 0,
        \`tax\` DECIMAL(15,2) DEFAULT 0,
        \`shipping_cost\` DECIMAL(15,2) DEFAULT 0,
        \`total_amount\` DECIMAL(15,2) DEFAULT 0,
        \`notes\` TEXT,
        \`created_by\` INT NULL,
        \`is_deleted\` TINYINT(1) DEFAULT 0,
        \`deleted_at\` DATETIME NULL,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_po_sup (\`supplier_id\`),
        INDEX idx_po_status (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`purchase_order_items\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`tenant_id\` VARCHAR(50) NOT NULL DEFAULT 'tenant_default',
        \`po_id\` INT NOT NULL,
        \`product_id\` INT NULL,
        \`product_variant_id\` INT NULL,
        \`product_name\` VARCHAR(200),
        \`quantity\` DECIMAL(15,2) NOT NULL DEFAULT 1,
        \`received_qty\` DECIMAL(15,2) DEFAULT 0,
        \`unit_cost\` DECIMAL(15,2) DEFAULT 0,
        \`total\` DECIMAL(15,2) DEFAULT 0,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_poi_po (\`po_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. Ensure tenant_id on all 65 tables
    for (const tbl of TENANT_TABLES) {
      await addColumnIfMissing(connection, tbl, '`tenant_id` VARCHAR(50) NOT NULL DEFAULT "tenant_default"');
    }

    // 7. Now execute views (guaranteed to find tenant_id and migration columns)
    if (viewsSql) {
      console.log('[InitDB] Executing views...');
      const viewStatements = viewsSql.split(';').map(s => s.trim()).filter(s => s && !isCommentOnly(s));
      for (const stmt of viewStatements) {
        try {
          await connection.query(stmt);
        } catch (stmtErr) {
          console.warn(`[InitDB] View statement skipped (${stmtErr.message}): ${stmt.substring(0, 90).replace(/\n/g, ' ')}...`);
        }
      }
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
