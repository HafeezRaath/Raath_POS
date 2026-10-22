// Test translation of schema.sql to SQLite
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

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

    // Check if CREATE TABLE
    const tableMatch = rawStmt.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([a-zA-Z0-9_]+)`?\s*\(([\s\S]+)\)[^)]*$/i);
    if (!tableMatch) continue;

    const tableName = tableMatch[1];
    let body = tableMatch[2];

    // Extract inline INDEX / KEY definitions
    const lines = body.split('\n');
    const cleanedLines = [];

    for (let line of lines) {
      const trimmed = line.trim();

      // Check for FULLTEXT INDEX
      if (/^FULLTEXT\s+INDEX/i.test(trimmed)) {
        continue; // skip fulltext in sqlite
      }

      // Check for UNIQUE KEY `name` (cols)
      const uqMatch = trimmed.match(/^UNIQUE\s+KEY\s+(?:`?([a-zA-Z0-9_]+)`?\s+)?\(([^)]+)\),?$/i);
      if (uqMatch) {
        const uqName = uqMatch[1] || `uq_${tableName}_${Math.random().toString(36).substring(2, 6)}`;
        outIndexes.push(`CREATE UNIQUE INDEX IF NOT EXISTS \`${uqName}\` ON \`${tableName}\` (${uqMatch[2]});`);
        continue;
      }

      // Check for INDEX `name` (cols) or KEY `name` (cols)
      const idxMatch = trimmed.match(/^(?:INDEX|KEY)\s+(?:`?([a-zA-Z0-9_]+)`?\s+)?\(([^)]+)\),?$/i);
      if (idxMatch) {
        const idxName = idxMatch[1] || `idx_${tableName}_${Math.random().toString(36).substring(2, 6)}`;
        outIndexes.push(`CREATE INDEX IF NOT EXISTS \`${idxName}\` ON \`${tableName}\` (${idxMatch[2]});`);
        continue;
      }

      cleanedLines.push(line);
    }

    // Translate column definitions line by line preserving column name
    const translatedLines = [];
    for (let l of cleanedLines) {
      // Don't modify lines without column definition
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

    // Clean trailing comma
    body = body.trim().replace(/,\s*$/, '');

    // Check if tenant_id exists
    const hasTenant = /\btenant_id\b/i.test(body);
    const extraCols = [];
    if (TENANT_TABLES.has(tableName) && !hasTenant) {
      extraCols.push('  `tenant_id` TEXT NOT NULL DEFAULT \'tenant_default\'');
    }

    // Check sync fields
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

const db = new Database(':memory:');
db.pragma('foreign_keys = OFF');
db.function('CURDATE', () => '2026-10-21');
db.function('NOW', () => '2026-10-21 17:00:00');
db.function('DATEDIFF', (d1, d2) => Math.round((new Date(d1) - new Date(d2)) / 86400000));
db.function('DATE_FORMAT', (d, fmt) => String(d));

// Create tenants table
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

const { tables, indexes, views } = translateSchema(schemaSql);
console.log(`Parsed ${tables.length} tables, ${indexes.length} indexes, ${views.length} views.`);

let tOk = 0, tErr = 0;
for (const t of tables) {
  try {
    db.exec(t);
    tOk++;
  } catch (err) {
    tErr++;
    console.error(`Error on table:\n${t.substring(0, 120)}\n--> ${err.message}\n`);
  }
}

let iOk = 0, iErr = 0;
for (const idx of indexes) {
  try {
    db.exec(idx);
    iOk++;
  } catch (err) {
    iErr++;
    console.error(`Error on index ${idx}: ${err.message}`);
  }
}

let vOk = 0, vErr = 0;
for (const v of views) {
  try {
    db.exec(v);
    vOk++;
  } catch (err) {
    vErr++;
    console.error(`Error on view: ${err.message}`);
  }
}

console.log(`Summary: Tables: ${tOk} OK / ${tErr} ERR. Indexes: ${iOk} OK / ${iErr} ERR. Views: ${vOk} OK / ${vErr} ERR.`);

