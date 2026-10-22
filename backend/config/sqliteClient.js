// ============================================================
//  backend/config/sqliteClient.js - SQLite Adapter for Local Mode
// ============================================================

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const { SYNCABLE_TABLES } = require('../database/initSqlite');

let dbInstance = null;
let txDepth = 0;

function getPktNow() {
  const now = new Date();
  const pkt = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  return pkt.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
}

function getPktDate() {
  const now = new Date();
  const pkt = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  return pkt.toISOString().split('T')[0];
}

function formatMySQLDate(dateVal, formatStr) {
  if (!dateVal) return null;
  const s = String(dateVal);
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/);
  if (match) {
    const [, y, m, day, h = '00', min = '00', sec = '00'] = match;
    return (formatStr || '')
      .replace(/%Y/g, y)
      .replace(/%m/g, m)
      .replace(/%d/g, day)
      .replace(/%H/g, h)
      .replace(/%i/g, min)
      .replace(/%s/g, sec);
  }
  return String(dateVal);
}

function getSqliteDb() {
  if (dbInstance) return dbInstance;

  const defaultPath = path.join(__dirname, '../data/local_pos.sqlite3');
  const dbPath = process.env.LOCAL_DB_PATH || defaultPath;
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  dbInstance = new Database(dbPath);
  dbInstance.pragma('foreign_keys = OFF');
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('synchronous = NORMAL');

  // Register MySQL-compatible UDFs
  dbInstance.function('NOW', () => getPktNow());
  dbInstance.function('CURDATE', () => getPktDate());
  dbInstance.function('DATE_FORMAT', (d, fmt) => formatMySQLDate(d, fmt));
  dbInstance.function('DATEDIFF', (d1, d2) => {
    if (!d1 || !d2) return 0;
    const diff = (new Date(d1) - new Date(d2)) / 86400000;
    return Math.round(diff);
  });
  // Phase 2 (merge-offline-v89): MONTH()/YEAR() are used by report/dashboard
  // queries (e.g. dashboardController) and do not exist in SQLite.
  dbInstance.function('MONTH', (d) => {
    if (d == null) return null;
    const s = String(d);
    const m = s.match(/^\d{4}-(\d{2})-\d{2}/);
    if (m) return parseInt(m[1], 10);
    const dt = new Date(s);
    return isNaN(dt.getTime()) ? null : dt.getMonth() + 1;
  });
  dbInstance.function('YEAR', (d) => {
    if (d == null) return null;
    const s = String(d);
    const m = s.match(/^(\d{4})-\d{2}-\d{2}/);
    if (m) return parseInt(m[1], 10);
    const dt = new Date(s);
    return isNaN(dt.getTime()) ? null : dt.getFullYear();
  });
  dbInstance.function('CONCAT', (...args) => args.filter(a => a != null).join(''));
  dbInstance.function('IF', (condition, trueVal, falseVal) => (condition ? trueVal : falseVal));
  dbInstance.function('UUID', () => uuidv4());

  console.log(`[SQLite] Connected successfully to local database at: ${dbPath}`);
  return dbInstance;
}

/**
 * Preprocesses MySQL SQL into valid SQLite SQL
 */
function preprocessSql(sql, params = []) {
  let cleanSql = String(sql || '').trim();
  let cleanParams = Array.isArray(params) ? [...params] : (params != null ? [params] : []);

  // Convert types that better-sqlite3 cannot bind directly (Date, boolean, undefined)
  cleanParams = cleanParams.map(p => {
    if (p === undefined) return null;
    if (p instanceof Date) {
      return p.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
    }
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p;
  });

  // 1. Translate DATE_ADD(d, INTERVAL ? DAY) / DATE_ADD(d, INTERVAL x DAY)
  cleanSql = cleanSql.replace(
    /DATE_ADD\s*\(\s*([^,]+)\s*,\s*INTERVAL\s+(\?|[0-9]+)\s+DAY\s*\)/gi,
    (match, dateExpr, numExpr) => {
      if (numExpr === '?') {
        return `date(${dateExpr}, '+' || ? || ' day')`;
      }
      return `date(${dateExpr}, '+${numExpr} day')`;
    }
  );

  // 2. Translate DATE_SUB(d, INTERVAL ? DAY) / DATE_SUB(d, INTERVAL x DAY)
  cleanSql = cleanSql.replace(
    /DATE_SUB\s*\(\s*([^,]+)\s*,\s*INTERVAL\s+(\?|[0-9]+)\s+DAY\s*\)/gi,
    (match, dateExpr, numExpr) => {
      if (numExpr === '?') {
        return `date(${dateExpr}, '-' || ? || ' day')`;
      }
      return `date(${dateExpr}, '-${numExpr} day')`;
    }
  );

  // 3. Translate ON DUPLICATE KEY UPDATE -> ON CONFLICT (...) DO UPDATE SET
  if (/ON\s+DUPLICATE\s+KEY\s+UPDATE/i.test(cleanSql)) {
    const matchTable = cleanSql.match(/INSERT\s+INTO\s+`?([a-zA-Z0-9_]+)`?/i);
    const tableName = matchTable ? matchTable[1].toLowerCase() : '';

    let conflictTarget = '`id`';
    if (tableName === 'system_settings') {
      conflictTarget = '`tenant_id`, `key`';
    } else if (tableName === 'roles' || tableName === 'tenants') {
      conflictTarget = '`id`';
    } else if (tableName === 'fbr_invoices') {
      conflictTarget = '`sale_id`';
    } else if (tableName === 'bundles') {
      conflictTarget = '`tenant_id`, `barcode`';
    } else if (tableName === 'guarantors') {
      conflictTarget = '`tenant_id`, `cnic`';
    } else if (tableName === 'staff_payroll') {
      conflictTarget = '`tenant_id`, `staff_id`, `month`';
    } else if (tableName === 'account_daily_balances') {
      conflictTarget = '`account_id`, `date`';
    } else if (SYNCABLE_TABLES.has(tableName)) {
      conflictTarget = '`sync_uuid`';
    }

    cleanSql = cleanSql.replace(/VALUES\s*\(\s*`?([a-zA-Z0-9_]+)`?\s*\)/gi, 'excluded.`$1`');
    cleanSql = cleanSql.replace(/ON\s+DUPLICATE\s+KEY\s+UPDATE/gi, `ON CONFLICT (${conflictTarget}) DO UPDATE SET`);
  }

  // 4. In LOCAL mode, auto-inject sync fields for syncable tables
  // INSERT INTO <table> (<cols>) VALUES (<placeholders>)
  const insertMatch = cleanSql.match(/^INSERT\s+INTO\s+`?([a-zA-Z0-9_]+)`?\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)([\s\S]*)$/i);
  if (insertMatch) {
    const tableName = insertMatch[1].toLowerCase();
    if (SYNCABLE_TABLES.has(tableName)) {
      let cols = insertMatch[2];
      let placeholders = insertMatch[3];
      const suffix = insertMatch[4] || '';

      const colList = cols.split(',').map(c => c.trim().replace(/[`]/g, '').toLowerCase());

      let newCols = cols;
      let newPlaceholders = placeholders;

      // sync_uuid
      if (!colList.includes('sync_uuid')) {
        const newUuid = uuidv4();
        newCols += ', `sync_uuid`';
        newPlaceholders += ', ?';
        cleanParams.push(newUuid);
      }

      // sync_status
      if (!colList.includes('sync_status')) {
        newCols += ', `sync_status`';
        newPlaceholders += ', ?';
        cleanParams.push('pending');
      }

      // updated_at
      if (!colList.includes('updated_at')) {
        newCols += ', `updated_at`';
        newPlaceholders += ', ?';
        cleanParams.push(getPktNow());
      }

      cleanSql = `INSERT INTO \`${tableName}\` (${newCols}) VALUES (${newPlaceholders})${suffix}`;
    }
  } else {
    // UPDATE <table> SET <assignments> [WHERE ...]
    const updateMatch = cleanSql.match(/^UPDATE\s+`?([a-zA-Z0-9_]+)`?\s+SET\s+([\s\S]+)$/i);
    if (updateMatch) {
      const tableName = updateMatch[1].toLowerCase();
      if (SYNCABLE_TABLES.has(tableName)) {
        // If query does not explicitly set sync_status (e.g. from sync engine)
        if (!/\bsync_status\b/i.test(cleanSql)) {
          const whereIdx = cleanSql.search(/\bWHERE\b/i);
          const autoSets = `\`sync_status\` = 'pending', \`updated_at\` = '${getPktNow()}'`;
          if (whereIdx !== -1) {
            cleanSql = `${cleanSql.substring(0, whereIdx)}, ${autoSets} ${cleanSql.substring(whereIdx)}`;
          } else {
            cleanSql = `${cleanSql}, ${autoSets}`;
          }
        }
      }
    }
  }

  return { sql: cleanSql, params: cleanParams };
}

/**
 * Execute query in SQLite
 */
async function sqliteQuery(rawSql, rawParams = []) {
  const db = getSqliteDb();
  const { sql, params } = preprocessSql(rawSql, rawParams);

  try {
    const isSelect = /^\s*(?:SELECT|PRAGMA|EXPLAIN)\b/i.test(sql);
    const stmt = db.prepare(sql);

    if (isSelect) {
      const rows = stmt.all(...params);
      return rows;
    } else {
      const info = stmt.run(...params);
      return {
        insertId: Number(info.lastInsertRowid),
        affectedRows: info.changes,
        changedRows: info.changes
      };
    }
  } catch (err) {
    console.error('[SQLite Query Error]:', err.message, '\nOriginal SQL:', rawSql, '\nTranslated SQL:', sql, '\nParams:', params);
    throw err;
  }
}

/**
 * Transaction runner matching MySQL connection transaction
 */
async function sqliteTransaction(callback) {
  const db = getSqliteDb();
  const savepoint = `sp_${++txDepth}`;

  if (txDepth === 1) {
    db.exec('BEGIN IMMEDIATE');
  } else {
    db.exec(`SAVEPOINT ${savepoint}`);
  }

  // Create a connection object that matches mysql2 conn.query signature
  const conn = {
    query: async (rawSql, rawParams = []) => {
      const { sql, params } = preprocessSql(rawSql, rawParams);
      try {
        const isSelect = /^\s*(?:SELECT|PRAGMA|EXPLAIN)\b/i.test(sql);
        const stmt = db.prepare(sql);

        if (isSelect) {
          const rows = stmt.all(...params);
          return [rows, []];
        } else {
          const info = stmt.run(...params);
          const okPacket = {
            insertId: Number(info.lastInsertRowid),
            affectedRows: info.changes,
            changedRows: info.changes
          };
          return [okPacket, []];
        }
      } catch (err) {
        console.error('[SQLite Tx Query Error]:', err.message, '\nSQL:', rawSql, '\nParams:', params);
        throw err;
      }
    }
  };

  try {
    const result = await callback(conn);
    if (txDepth === 1) {
      db.exec('COMMIT');
    } else {
      db.exec(`RELEASE SAVEPOINT ${savepoint}`);
    }
    return result;
  } catch (error) {
    if (txDepth === 1) {
      try { db.exec('ROLLBACK'); } catch (_) {}
    } else {
      try { db.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`); } catch (_) {}
    }
    console.error('[SQLite Transaction Error]:', error.message);
    throw error;
  } finally {
    txDepth--;
  }
}

function testSqliteConnection() {
  try {
    const db = getSqliteDb();
    const row = db.prepare('SELECT 1 as connected').get();
    console.log('[SQLite] Connected successfully to local database.');
    return !!row;
  } catch (error) {
    console.error('[SQLite] Connection failed:', error.message);
    return false;
  }
}

module.exports = {
  getSqliteDb,
  sqliteQuery,
  sqliteTransaction,
  testSqliteConnection,
  preprocessSql
};
