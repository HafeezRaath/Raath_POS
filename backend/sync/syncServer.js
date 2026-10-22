// ============================================================
//  backend/sync/syncServer.js - Cloud Sync Push & Pull Endpoints
// ============================================================

const { query, transaction } = require('../config/db');

const SYNCABLE_TABLES = [
  'accounts',
  'customers',
  'suppliers',
  'products',
  'product_variants',
  'product_serialized_items',
  'purchases',
  'purchase_items',
  'sales',
  'sale_items',
  'sale_returns',
  'expenses',
  'payments',
  'emi_records',
  'emi_payments',
  'work_orders',
  // Phase 2 (merge-offline-v89): returns items, ledgers, EMI schedule, IMEI registry
  'purchase_returns',
  'sale_return_items',
  'purchase_return_items',
  'account_transactions',
  'customer_ledger',
  'supplier_ledger',
  'general_ledger',
  'emi_schedule',
  'device_imei'
];

// Cache of cloud table columns for the schema-drift guard in push()
const _cloudColCache = {};

// tenant:productServerId -> timestamp of the product's last push upsert.
// Used by the stock double-count guard (items pushed in the same cycle).
const _recentProductSync = new Map();

function getPktNow() {
  const now = new Date();
  const pkt = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  return pkt.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
}

/**
 * POST /api/sync/push
 * Upserts client batches by sync_uuid, returns mapping of { sync_uuid: { id, invoice_number } }
 */
exports.push = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || req.user?.tenant_id || 'tenant_default';
    const body = req.body || {};

    // Support both { batches: [ { table, rows } ] } and { tables: { [table]: rows } }
    let batches = [];
    if (Array.isArray(body.batches)) {
      batches = body.batches;
    } else if (body.tables && typeof body.tables === 'object') {
      batches = Object.entries(body.tables).map(([table, rows]) => ({ table, rows }));
    }

    const mapping = {};

    for (const batch of batches) {
      const { table, rows } = batch;
      if (!table || !Array.isArray(rows) || rows.length === 0) continue;
      if (!SYNCABLE_TABLES.includes(table)) {
        console.warn(`[Sync Server] Table not in syncable list: ${table}`);
        continue;
      }

      await transaction(async (conn) => {
        for (const rawRow of rows) {
          if (!rawRow || !rawRow.sync_uuid) continue;

          const row = { ...rawRow };
          row.tenant_id = tenantId;

          // Remove local-only columns
          delete row.sync_status;
          delete row.server_id;

          // For sales, renumber local offline invoices (OFF-*) to official server numbers (INV-*)
          let serverInvoiceNumber = null;
          if (table === 'sales') {
            const currentInv = row.invoice_number || row.invoice_no || '';
            if (currentInv.startsWith('OFF-') || !currentInv) {
              // Check if sale was already assigned an invoice number on the server
              const [existingSales] = await conn.query(
                'SELECT id, invoice_number FROM sales WHERE tenant_id = ? AND sync_uuid = ?',
                [tenantId, row.sync_uuid]
              );
              if (existingSales && existingSales.length > 0 && existingSales[0].invoice_number && !existingSales[0].invoice_number.startsWith('OFF-')) {
                serverInvoiceNumber = existingSales[0].invoice_number;
              } else {
                const dateStr = (row.sale_date ? new Date(row.sale_date) : new Date()).toISOString().slice(0, 10).replace(/-/g, '');
                const randomNum = Math.floor(1000 + Math.random() * 9000);
                serverInvoiceNumber = `INV-${dateStr}-${randomNum}`;
              }
              row.invoice_number = serverInvoiceNumber;
              row.invoice_no = serverInvoiceNumber;
            } else {
              serverInvoiceNumber = currentInv;
            }
          }

          // Do NOT send client-local auto-increment ID to server on insert, let server assign its own PK
          // But match on sync_uuid
          const [existingRow] = await conn.query(
            `SELECT id FROM \`${table}\` WHERE tenant_id = ? AND sync_uuid = ? LIMIT 1`,
            [tenantId, row.sync_uuid]
          );

          delete row.id;

          // Schema-drift guard: intersect the client's row keys with the
          // cloud table's actual columns before INSERT/UPDATE. Local SQLite
          // and cloud MySQL schemas have drifted (e.g. sale_items.
          // product_variant_id and sale_returns.return_no exist only
          // locally) and a blind insert fails with "Unknown column".
          if (_cloudColCache[table] === undefined) {
            try {
              const [colRows] = await conn.query(
                'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
                [table]
              );
              _cloudColCache[table] = new Set(colRows.map(r => r.COLUMN_NAME));
            } catch (_) {
              // Non-MySQL cloud backend (e.g. the SQLite mock cloud in the
              // phase tests) has no INFORMATION_SCHEMA — its schema is
              // identical to the client's, so the guard is skipped there.
              _cloudColCache[table] = null;
            }
          }
          const cloudCols = _cloudColCache[table];
          if (cloudCols) {
            for (const k of Object.keys(row)) {
              if (!cloudCols.has(k)) delete row[k];
            }
          }

          const keys = Object.keys(row);
          const values = Object.values(row);

          let serverId;

          if (existingRow && existingRow.length > 0) {
            // Update existing
            serverId = existingRow[0].id;
            const updateAssignments = keys
              .filter(k => k !== 'sync_uuid' && k !== 'tenant_id')
              .map(k => `\`${k}\` = ?`)
              .join(', ');
            const updateValues = keys
              .filter(k => k !== 'sync_uuid' && k !== 'tenant_id')
              .map(k => row[k]);

            if (updateAssignments.length > 0) {
              await conn.query(
                `UPDATE \`${table}\` SET ${updateAssignments}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
                [...updateValues, serverId, tenantId]
              );
            }
          } else {
            // Insert new
            const placeholders = keys.map(() => '?').join(', ');
            const insertSql = `
              INSERT INTO \`${table}\` (${keys.map(k => `\`${k}\``).join(', ')})
              VALUES (${placeholders})
            `;
            const [insertRes] = await conn.query(insertSql, values);
            serverId = insertRes.insertId;

            // Recalculate / adjust stock on server ONLY on first insert (idempotency guard).
            // Double-count guard: the sync client pushes masters before
            // child items within one cycle, and a product whose stock was
            // changed by the transaction arrives WITH its post-transaction
            // stock (e.g. created offline at 20, sold down to 18, pushed:
            // cloud stock must end at 18, not 18 - 2 = 16). If this product
            // was upserted by a push moments ago (same cycle), its stock is
            // already correct — skip the item adjustment. If the product
            // was NOT part of this cycle's pushes, the item adjustment is
            // the only stock path and must still apply.
            let productJustSynced = false;
            if ((table === 'sale_items' || table === 'purchase_items') && row.product_id) {
              const ts = _recentProductSync.get(`${tenantId}:${row.product_id}`);
              if (ts && (Date.now() - ts) < 120000) productJustSynced = true;
            }
            if (!productJustSynced && table === 'sale_items' && row.product_id && row.quantity) {
              const qty = parseFloat(row.quantity) || 0;
              if (qty > 0) {
                await conn.query(
                  'UPDATE products SET stock = stock - ? WHERE id = ? AND tenant_id = ?',
                  [qty, row.product_id, tenantId]
                ).catch(() => {});

                if (row.product_variant_id) {
                  await conn.query(
                    'UPDATE product_variants SET stock = stock - ?, current_stock = current_stock - ? WHERE id = ? AND tenant_id = ?',
                    [qty, qty, row.product_variant_id, tenantId]
                  ).catch(() => {});
                }
              }
            } else if (!productJustSynced && table === 'purchase_items' && row.product_id && row.quantity) {
              const qty = parseFloat(row.quantity) || 0;
              if (qty > 0) {
                await conn.query(
                  'UPDATE products SET stock = stock + ? WHERE id = ? AND tenant_id = ?',
                  [qty, row.product_id, tenantId]
                ).catch(() => {});

                if (row.product_variant_id) {
                  await conn.query(
                    'UPDATE product_variants SET stock = stock + ?, current_stock = current_stock + ? WHERE id = ? AND tenant_id = ?',
                    [qty, qty, row.product_variant_id, tenantId]
                  ).catch(() => {});
                }
              }
            }
          }

          // Remember product upserts so the item stock adjustment in the
          // same sync cycle can tell "stock already arrived with the
          // product row" apart from "item-only push" (see guard above).
          if (table === 'products' && serverId) {
            _recentProductSync.set(`${tenantId}:${serverId}`, Date.now());
            if (_recentProductSync.size > 10000) _recentProductSync.clear();
          }

          mapping[row.sync_uuid] = {
            id: serverId,
            ...(serverInvoiceNumber ? { invoice_number: serverInvoiceNumber } : {})
          };
        }
      });
    }

    res.json({
      success: true,
      message: 'Batch pushed successfully',
      server_time: getPktNow(),
      mapping
    });
  } catch (error) {
    console.error('[Sync Server Push Error]:', error.message);
    next(error);
  }
};

/**
 * GET /api/sync/pull?tenant_id=&since=<timestamp>
 * Returns all rows updated since timestamp (including soft-deleted)
 */
exports.pull = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || req.query.tenant_id || req.user?.tenant_id || 'tenant_default';
    const since = req.query.since || '1970-01-01 00:00:00';

    // Pull-cursor clock fix: the cursor is compared against updated_at,
    // which the database stamps with NOW(). server_time must therefore be
    // the DATABASE clock, not getPktNow() (UTC+5 wall clock). The old PKT
    // cursor sat ~5h ahead of every updated_at, so `updated_at > since`
    // filtered out ALL genuine cloud updates and pull never delivered
    // them (e.g. cloud price changes never reached shops).
    let dbNow = since;
    try {
      const t = await query('SELECT NOW() AS db_now');
      const d = t && t[0] ? t[0].db_now : null;
      if (d) {
        const dt = d instanceof Date ? d : new Date(String(d).replace(' ', 'T'));
        const p = n => String(n).padStart(2, '0');
        dbNow = `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())} ${p(dt.getHours())}:${p(dt.getMinutes())}:${p(dt.getSeconds())}`;
      }
    } catch (_) {}

    // A cursor left over from the old PKT-based build is in the future
    // relative to the DB clock; clamp it back to a 15-minute overlap
    // window so missed updates are re-fetched (sync_uuid upserts make
    // re-delivery harmless) instead of being suppressed forever.
    let effectiveSince = since;
    if (since > dbNow) {
      const base = new Date(dbNow.replace(' ', 'T'));
      base.setMinutes(base.getMinutes() - 15);
      const p = n => String(n).padStart(2, '0');
      effectiveSince = `${base.getFullYear()}-${p(base.getMonth() + 1)}-${p(base.getDate())} ${p(base.getHours())}:${p(base.getMinutes())}:${p(base.getSeconds())}`;
    }

    const data = {};

    for (const table of SYNCABLE_TABLES) {
      try {
        const rows = await query(
          `SELECT * FROM \`${table}\` WHERE tenant_id = ? AND updated_at > ?`,
          [tenantId, effectiveSince]
        );
        data[table] = rows || [];
      } catch (err) {
        console.warn(`[Sync Server Pull] Could not read ${table}: ${err.message}`);
        data[table] = [];
      }
    }

    res.json({
      success: true,
      server_time: dbNow,
      data
    });
  } catch (error) {
    console.error('[Sync Server Pull Error]:', error.message);
    next(error);
  }
};
