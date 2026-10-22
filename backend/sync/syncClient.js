// ============================================================
//  backend/sync/syncClient.js - Background Client Sync Engine
// ============================================================

// Lazy-load the SQLite client: this module is also loaded by the cloud
// (MySQL) server via syncRoutes, and the cloud must boot even when the
// better-sqlite3 native module is unavailable there. getSqliteDb() is only
// invoked from inside sync functions at runtime, in LOCAL_MODE.
let _sqliteClient = null;
function getSqliteDb(...args) {
  if (!_sqliteClient) _sqliteClient = require('../config/sqliteClient');
  return _sqliteClient.getSqliteDb(...args);
}
const http = require('http');
const https = require('https');

let syncTimer = null;
let isRunning = false;
let isSyncing = false;
let isOnline = false;
let lastSyncTime = null;
let lastError = null;

const SYNC_TABLE_ORDER = [
  // 1. Masters
  'accounts',
  'customers',
  'suppliers',
  'products',
  'product_variants',
  'product_serialized_items',
  // 2. Parent Transactions
  'purchases',
  'purchase_returns',
  'sales',
  'sale_returns',
  'expenses',
  'payments',
  'emi_records',
  'work_orders',
  'device_imei',
  'account_transactions',
  'customer_ledger',
  'supplier_ledger',
  'general_ledger',
  // 3. Child Transaction Items
  'purchase_items',
  'sale_items',
  'sale_return_items',
  'purchase_return_items',
  'emi_payments',
  'emi_schedule'
];

// Phase 2 (merge-offline-v89): FK columns of the newly added sync tables and
// the parent table each column must be remapped to (local id -> server_id),
// consistent with the child-table handling in performSyncCycle below.
// NOTE: general_ledger.reference_id is polymorphic (spans many tables), so it
// is intentionally NOT remapped.
const FK_PARENT_MAP = {
  purchase_returns: { purchase_id: 'purchases', supplier_id: 'suppliers' },
  sale_return_items: { sale_return_id: 'sale_returns', product_id: 'products' },
  purchase_return_items: { purchase_return_id: 'purchase_returns', purchase_item_id: 'purchase_items', product_id: 'products' },
  account_transactions: { account_id: 'accounts' },
  customer_ledger: { customer_id: 'customers' },
  supplier_ledger: { supplier_id: 'suppliers' },
  emi_schedule: { emi_id: 'emi_records' },
  device_imei: { product_id: 'products' }
};

function getCloudApiUrl() {
  return (process.env.CLOUD_API_URL || 'https://pos.raathdeveloper.com/api').replace(/\/+$/, '');
}

/**
 * Check connectivity to cloud server
 */
async function checkConnectivity() {
  const cloudUrl = getCloudApiUrl();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`${cloudUrl}/health`, {
      method: 'GET',
      signal: controller.signal
    }).catch(() => null);
    clearTimeout(timeoutId);

    const wasOnline = isOnline;
    isOnline = !!(res && res.ok);

    // If transitioned from offline to online, trigger sync immediately
    if (!wasOnline && isOnline) {
      console.log('[Sync Client] Internet connection restored! Triggering immediate sync...');
      triggerSyncNow().catch(() => {});
    }

    return isOnline;
  } catch (e) {
    isOnline = false;
    return false;
  }
}

/**
 * Get total pending records count across all syncable tables
 */
function getPendingRecordsCount() {
  try {
    const db = getSqliteDb();
    let total = 0;
    for (const table of SYNC_TABLE_ORDER) {
      try {
        const row = db.prepare(`SELECT COUNT(*) as c FROM \`${table}\` WHERE sync_status = 'pending'`).get();
        total += row ? row.c : 0;
      } catch (_) {}
    }
    return total;
  } catch (e) {
    return 0;
  }
}

/**
 * Execute a single PUSH + PULL sync cycle
 */
async function performSyncCycle() {
  if (isSyncing) return;
  isSyncing = true;
  lastError = null;

  try {
    const db = getSqliteDb();
    const cloudUrl = getCloudApiUrl();

    // Check connectivity first
    const online = await checkConnectivity();
    if (!online) {
      isSyncing = false;
      return;
    }

    // Get auth token from system_settings or environment if available.
    // Phase 2 (merge-offline-v89): tenant is resolved FIRST and the token is
    // read scoped to that tenant, so one shop can never sync with another
    // shop's credentials. Unscoped fallback only covers rows seeded before
    // tenant scoping existed (single-shop local DBs).
    let token = process.env.CLOUD_AUTH_TOKEN || null;
    let tenantId = 'tenant_default';
    try {
      const tenantRow = db.prepare("SELECT value FROM system_settings WHERE `key` = 'sync_tenant_id'").get();
      if (tenantRow && tenantRow.value) tenantId = tenantRow.value;
      const tokenRow = db.prepare("SELECT value FROM system_settings WHERE tenant_id = ? AND `key` = 'sync_auth_token'").get(tenantId)
        || db.prepare("SELECT value FROM system_settings WHERE `key` = 'sync_auth_token'").get();
      if (tokenRow && tokenRow.value) token = tokenRow.value;
    } catch (_) {}

    const headers = {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // ==================== 1. PUSH PENDING RECORDS ====================
    for (const table of SYNC_TABLE_ORDER) {
      let pendingRows = [];
      try {
        pendingRows = db.prepare(`SELECT * FROM \`${table}\` WHERE sync_status = 'pending'`).all();
      } catch (_) {}

      if (!pendingRows || pendingRows.length === 0) continue;

      // Foreign key resolution before sending child records
      const preparedRows = pendingRows.map(row => {
        const clean = { ...row };

        // For children tables, map local parent IDs to server IDs if available
        if (table === 'sale_items' && clean.sale_id) {
          try {
            const parent = db.prepare('SELECT server_id FROM sales WHERE id = ?').get(clean.sale_id);
            if (parent && parent.server_id) clean.sale_id = parent.server_id;
          } catch (_) {}
          if (clean.product_id) {
            try {
              const prod = db.prepare('SELECT server_id FROM products WHERE id = ?').get(clean.product_id);
              if (prod && prod.server_id) clean.product_id = prod.server_id;
            } catch (_) {}
          }
        } else if (table === 'purchase_items' && clean.purchase_id) {
          try {
            const parent = db.prepare('SELECT server_id FROM purchases WHERE id = ?').get(clean.purchase_id);
            if (parent && parent.server_id) clean.purchase_id = parent.server_id;
          } catch (_) {}
          if (clean.product_id) {
            try {
              const prod = db.prepare('SELECT server_id FROM products WHERE id = ?').get(clean.product_id);
              if (prod && prod.server_id) clean.product_id = prod.server_id;
            } catch (_) {}
          }
        } else if (table === 'product_variants' && clean.product_id) {
          try {
            const prod = db.prepare('SELECT server_id FROM products WHERE id = ?').get(clean.product_id);
            if (prod && prod.server_id) clean.product_id = prod.server_id;
          } catch (_) {}
        } else if (table === 'emi_payments' && clean.emi_id) {
          try {
            const emi = db.prepare('SELECT server_id FROM emi_records WHERE id = ?').get(clean.emi_id);
            if (emi && emi.server_id) clean.emi_id = emi.server_id;
          } catch (_) {}
        }

        // Phase 2 (merge-offline-v89): generic FK remap for the new sync tables
        const fkMap = FK_PARENT_MAP[table];
        if (fkMap) {
          for (const [col, parentTable] of Object.entries(fkMap)) {
            if (clean[col]) {
              try {
                const parent = db.prepare(`SELECT server_id FROM \`${parentTable}\` WHERE id = ?`).get(clean[col]);
                if (parent && parent.server_id) clean[col] = parent.server_id;
              } catch (_) {}
            }
          }
        }

        return clean;
      });

      // Send table batch to cloud
      console.log(`[Sync Client] Pushing ${preparedRows.length} rows for table: ${table}...`);
      const pushRes = await fetch(`${cloudUrl}/sync/push`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          batches: [{ table, rows: preparedRows }]
        })
      });

      if (!pushRes.ok) {
        const errText = await pushRes.text().catch(() => '');
        console.warn(`[Sync Client] Push failed for ${table} (${pushRes.status}): ${errText}`);
        continue;
      }

      const pushData = await pushRes.json();
      const mapping = pushData.mapping || {};

      // Mark local rows as synced and save server_id
      const markStmt = db.prepare(`UPDATE \`${table}\` SET sync_status = 'synced', server_id = ? WHERE sync_uuid = ?`);
      const updateInvStmt = table === 'sales'
        ? db.prepare(`UPDATE sales SET invoice_number = ?, invoice_no = ? WHERE sync_uuid = ?`)
        : null;

      db.transaction(() => {
        for (const [uuid, meta] of Object.entries(mapping)) {
          const sId = typeof meta === 'object' ? meta.id : meta;
          markStmt.run(sId || null, uuid);

          if (updateInvStmt && typeof meta === 'object' && meta.invoice_number) {
            updateInvStmt.run(meta.invoice_number, meta.invoice_number, uuid);
          }
        }
      })();

      console.log(`[Sync Client] Successfully synced ${Object.keys(mapping).length} rows for table: ${table}.`);
    }

    // ==================== 2. PULL CLOUD CHANGES ====================
    let lastPullAt = '1970-01-01 00:00:00';
    try {
      // Phase 2 (merge-offline-v89): pull cursor is per-tenant, never shared.
      const pullSetting = db.prepare("SELECT value FROM system_settings WHERE tenant_id = ? AND `key` = 'sync_last_pull_at'").get(tenantId)
        || db.prepare("SELECT value FROM system_settings WHERE `key` = 'sync_last_pull_at'").get();
      if (pullSetting && pullSetting.value) lastPullAt = pullSetting.value;
    } catch (_) {}

    const pullUrl = `${cloudUrl}/sync/pull?tenant_id=${encodeURIComponent(tenantId)}&since=${encodeURIComponent(lastPullAt)}`;
    const pullRes = await fetch(pullUrl, {
      method: 'GET',
      headers
    });

    if (pullRes.ok) {
      const pullData = await pullRes.json();
      const serverData = pullData.data || {};
      const serverTime = pullData.server_time || new Date().toISOString().replace('T', ' ').split('.')[0];

      db.transaction(() => {
        for (const [table, rows] of Object.entries(serverData)) {
          if (!Array.isArray(rows) || rows.length === 0) continue;

          // Schema-drift guard (pull side): cloud MySQL tables carry
          // columns the local SQLite schema does not have (pharmacy/box
          // columns are added on the cloud by initDb migrations, never in
          // schema.sql). Intersect pulled rows with the local table's
          // actual columns, and isolate failures per table so one drifted
          // table cannot roll back the whole pull cycle.
          let localCols = null;
          try {
            localCols = new Set(db.prepare(`PRAGMA table_info(\`${table}\`)`).all().map(c => c.name));
          } catch (_) {}
          if (!localCols || localCols.size === 0) continue;

          try {
          for (const rawRow of rows) {
            if (!rawRow || !rawRow.sync_uuid) continue;
            const row = { ...rawRow };
            for (const k of Object.keys(row)) {
              if (!localCols.has(k)) delete row[k];
            }
            const syncUuid = row.sync_uuid;

            // Check if exists locally
            const existing = db.prepare(`SELECT id, sync_status FROM \`${table}\` WHERE sync_uuid = ?`).get(syncUuid);

            if (existing) {
              // Master data: cloud version wins!
              // Don't overwrite locally pending transactions
              if (existing.sync_status !== 'pending' || ['products', 'product_variants', 'customers', 'suppliers', 'accounts'].includes(table)) {
                delete row.id;
                delete row.sync_status;
                const cols = Object.keys(row).filter(k => k !== 'sync_uuid');
                const assignments = cols.map(c => `\`${c}\` = ?`).join(', ');
                const vals = cols.map(c => row[c]);
                db.prepare(`UPDATE \`${table}\` SET ${assignments}, sync_status = 'synced' WHERE sync_uuid = ?`).run(...vals, syncUuid);
              }
            } else {
              // Insert new row pulled from cloud (with sync_status = 'synced')
              row.sync_status = 'synced';
              row.server_id = row.id;
              delete row.id; // local assigns own autoincrement PK

              const cols = Object.keys(row);
              const placeholders = cols.map(() => '?').join(', ');
              const vals = cols.map(c => row[c]);
              try {
                db.prepare(`INSERT INTO \`${table}\` (${cols.map(c => `\`${c}\``).join(', ')}) VALUES (${placeholders})`).run(...vals);
              } catch (insErr) {
                // Table might have slight variation, skip gracefully
              }
            }
          }
          } catch (tblErr) {
            console.warn(`[Sync Client] Pull apply failed for table ${table}: ${tblErr.message} — table skipped this cycle.`);
          }
        }

        // Save last_pull_at timestamp (per-tenant key — Phase 2, merge-offline-v89)
        const existingSetting = db.prepare('SELECT id FROM system_settings WHERE tenant_id = ? AND `key` = ?').get(tenantId, 'sync_last_pull_at');
        if (existingSetting) {
          db.prepare('UPDATE system_settings SET `value` = ? WHERE id = ?').run(serverTime, existingSetting.id);
        } else {
          db.prepare('INSERT INTO system_settings (tenant_id, `key`, `value`, description) VALUES (?, ?, ?, ?)').run(tenantId, 'sync_last_pull_at', serverTime, 'Last Cloud Pull Timestamp');
        }
      })();

      lastSyncTime = serverTime;
      console.log(`[Sync Client] Pull completed successfully at: ${serverTime}.`);
    }

  } catch (err) {
    lastError = err.message;
    console.error('[Sync Client Error]:', err.message);
  } finally {
    isSyncing = false;
  }
}

/**
 * Manually trigger sync now
 */
async function triggerSyncNow() {
  return performSyncCycle();
}

/**
 * Status reporter for UI
 */
function getSyncStatus() {
  const pendingCount = getPendingRecordsCount();
  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncTime,
    lastError,
    statusText: isSyncing
      ? 'Syncing…'
      : (!isOnline
        ? (pendingCount > 0 ? `Offline — ${pendingCount} pending` : 'Offline')
        : (pendingCount > 0 ? `Online — ${pendingCount} syncing` : 'Online'))
  };
}

/**
 * Start the background 30s sync loop
 */
function startSyncClient() {
  if (isRunning) return;
  isRunning = true;
  console.log('[Sync Client] Starting sync engine (30s polling cycle)...');

  // Initial connectivity check + initial sync
  checkConnectivity().then(online => {
    if (online) triggerSyncNow().catch(() => {});
  });

  // 30 seconds interval
  syncTimer = setInterval(async () => {
    try {
      await performSyncCycle();
    } catch (_) {}
  }, 30000);
}

function stopSyncClient() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  isRunning = false;
  console.log('[Sync Client] Stopped sync engine.');
}

module.exports = {
  startSyncClient,
  stopSyncClient,
  triggerSyncNow,
  getSyncStatus,
  checkConnectivity,
  performSyncCycle
};
