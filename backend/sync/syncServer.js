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
  'work_orders'
];

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

            // Recalculate / adjust stock on server ONLY on first insert (idempotency guard)
            if (table === 'sale_items' && row.product_id && row.quantity) {
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
            } else if (table === 'purchase_items' && row.product_id && row.quantity) {
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

    const data = {};

    for (const table of SYNCABLE_TABLES) {
      try {
        const rows = await query(
          `SELECT * FROM \`${table}\` WHERE tenant_id = ? AND updated_at > ?`,
          [tenantId, since]
        );
        data[table] = rows || [];
      } catch (err) {
        console.warn(`[Sync Server Pull] Could not read ${table}: ${err.message}`);
        data[table] = [];
      }
    }

    res.json({
      success: true,
      server_time: getPktNow(),
      data
    });
  } catch (error) {
    console.error('[Sync Server Pull Error]:', error.message);
    next(error);
  }
};
