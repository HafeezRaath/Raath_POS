// ============================================================
//  batchController — Product batches: batch-wise pricing + expiry
//  (Grocery / Pharmacy verticals)
//  - Har purchase pe nayi batch row; purani price overwrite nahi hoti
//  - sync_old_price: purani batches ka salePrice naye MRP pe update
//    (costPrice intact rehta hai taake profit accurate rahe)
// ============================================================
const { query, transaction } = require('../config/db');

const tenantOf = (req) => req.tenant_id || 'tenant_default';

// FEFO order: sab se pehle expire hone wali batch pehle
const FEFO_ORDER = `ORDER BY
  CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END,
  expiry_date ASC, id ASC`;

// ---- GET /api/products/:id/batches ----
exports.listBatches = async (req, res, next) => {
  try {
    const tenantId = tenantOf(req);
    const { id } = req.params;
    const rows = await query(
      `SELECT b.*, s.name AS supplier_name
       FROM product_batches b
       LEFT JOIN suppliers s ON s.id = b.supplier_id
       WHERE b.tenant_id = ? AND b.product_id = ? AND b.is_active = 1
       ${FEFO_ORDER}`,
      [tenantId, id]
    );
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
};

// ---- POST /api/products/:id/batches ----
exports.addBatch = async (req, res, next) => {
  try {
    const tenantId = tenantOf(req);
    const { id: productId } = req.params;
    const {
      variant_id = null, batch_no = null, expiry_date = null, supplier_id = null,
      qty = 0, cost_price = 0, sale_price = 0, sync_old_price = false,
    } = req.body;

    const q = Math.max(0, parseFloat(qty) || 0);
    if (q <= 0) return res.status(400).json({ success: false, error: 'Quantity zaroori hai' });

    const batchId = await transaction(async (conn) => {
      const [ins] = await conn.query(
        `INSERT INTO product_batches
           (tenant_id, product_id, variant_id, batch_no, expiry_date, supplier_id,
            qty_received, qty_remaining, cost_price, sale_price, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [tenantId, productId, variant_id || null, batch_no || null,
         expiry_date || null, supplier_id || null, q, q,
         parseFloat(cost_price) || 0, parseFloat(sale_price) || 0]
      );

      // Variant + product stock barhao (single source: variant totals)
      if (variant_id) {
        await conn.query(
          `UPDATE product_variants SET current_stock = COALESCE(current_stock,0) + ?
           WHERE tenant_id = ? AND id = ?`,
          [q, tenantId, variant_id]
        );
      }
      await conn.query(
        `UPDATE products SET stock = COALESCE(stock,0) + ?
         WHERE tenant_id = ? AND id = ?`,
        [q, tenantId, productId]
      );

      // Purani batches ka sale price sync (cost intact)
      if (sync_old_price && parseFloat(sale_price) > 0) {
        await conn.query(
          `UPDATE product_batches SET sale_price = ?
           WHERE tenant_id = ? AND product_id = ? AND id != ?
             AND is_active = 1
             ${variant_id ? 'AND COALESCE(variant_id,0) = ?' : 'AND variant_id IS NULL'}`,
          variant_id
            ? [parseFloat(sale_price), tenantId, productId, ins.insertId, variant_id]
            : [parseFloat(sale_price), tenantId, productId, ins.insertId]
        );
      }
      return ins.insertId;
    });

    const [row] = await query(`SELECT * FROM product_batches WHERE id = ?`, [batchId]);
    res.status(201).json({ success: true, data: row[0] || { id: batchId } });
  } catch (e) { next(e); }
};

// ---- PUT /api/batches/:id ----
exports.updateBatch = async (req, res, next) => {
  try {
    const tenantId = tenantOf(req);
    const { id } = req.params;
    const { batch_no, expiry_date, supplier_id, cost_price, sale_price, is_active } = req.body;
    await query(
      `UPDATE product_batches SET
         batch_no = COALESCE(?, batch_no),
         expiry_date = COALESCE(?, expiry_date),
         supplier_id = COALESCE(?, supplier_id),
         cost_price = COALESCE(?, cost_price),
         sale_price = COALESCE(?, sale_price),
         is_active = COALESCE(?, is_active)
       WHERE tenant_id = ? AND id = ?`,
      [batch_no ?? null, expiry_date ?? null, supplier_id ?? null,
       cost_price ?? null, sale_price ?? null,
       is_active === undefined ? null : (is_active ? 1 : 0),
       tenantId, id]
    );
    const [row] = await query(`SELECT * FROM product_batches WHERE tenant_id = ? AND id = ?`, [tenantId, id]);
    res.json({ success: true, data: row[0] || null });
  } catch (e) { next(e); }
};

// ---- POST /api/batches/:id/vendor-return ----
// Expired bakery wapis vendor ko: batch deactivate + bachi stock minus
exports.vendorReturn = async (req, res, next) => {
  try {
    const tenantId = tenantOf(req);
    const { id } = req.params;
    await transaction(async (conn) => {
      const [rows] = await conn.query(
        `SELECT * FROM product_batches WHERE tenant_id = ? AND id = ? AND is_active = 1`,
        [tenantId, id]
      );
      const b = rows[0];
      if (!b) throw new Error('Batch nahi mili');
      const rem = Math.max(0, parseFloat(b.qty_remaining) || 0);
      await conn.query(`UPDATE product_batches SET is_active = 0, qty_remaining = 0 WHERE id = ?`, [id]);
      if (b.variant_id && rem > 0) {
        await conn.query(
          `UPDATE product_variants SET current_stock = GREATEST(0, COALESCE(current_stock,0) - ?)
           WHERE tenant_id = ? AND id = ?`,
          [rem, tenantId, b.variant_id]
        );
      }
      if (rem > 0) {
        await conn.query(
          `UPDATE products SET stock = GREATEST(0, COALESCE(stock,0) - ?)
           WHERE tenant_id = ? AND id = ?`,
          [rem, tenantId, b.product_id]
        );
      }
    });
    res.json({ success: true });
  } catch (e) { next(e); }
};

// ---- GET /api/batches/expiry-alerts?days=7 ----
exports.expiryAlerts = async (req, res, next) => {
  try {
    const tenantId = tenantOf(req);
    const days = Math.max(1, parseInt(req.query.days) || 7);
    const rows = await query(
      `SELECT b.*, p.name AS product_name, pv.sku AS variant_sku,
              p.stock AS product_stock, p.brand_id AS brand_id,
              br.name AS company_name,
              DATEDIFF(b.expiry_date, CURDATE()) AS days_left
       FROM product_batches b
       JOIN products p ON p.id = b.product_id AND COALESCE(p.is_deleted,0) = 0
       LEFT JOIN brands br ON br.id = p.brand_id
       LEFT JOIN product_variants pv ON pv.id = b.variant_id
       WHERE b.tenant_id = ? AND b.is_active = 1 AND b.expiry_date IS NOT NULL
         AND b.qty_remaining > 0
         AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
       ORDER BY b.expiry_date ASC`,
      [tenantId, days]
    );
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
};

// ---- Internal: FEFO deduction (sale ke waqt batches se minus) ----
// Sale kabhi fail nahi honi chahiye batch issue ki waja se — errors swallow.
exports.deductBatchesFEFO = async (conn, tenantId, productId, variantId, qty) => {
  try {
    let remaining = Math.max(0, parseFloat(qty) || 0);
    if (remaining <= 0) return;
    const [batches] = await conn.query(
      `SELECT id, qty_remaining FROM product_batches
       WHERE tenant_id = ? AND product_id = ? AND is_active = 1 AND qty_remaining > 0
       ${variantId ? 'AND variant_id = ?' : 'AND variant_id IS NULL'}
       ${FEFO_ORDER}`,
      variantId ? [tenantId, productId, variantId] : [tenantId, productId]
    );
    for (const b of batches) {
      if (remaining <= 0) break;
      const take = Math.min(parseFloat(b.qty_remaining) || 0, remaining);
      if (take <= 0) continue;
      await conn.query(
        `UPDATE product_batches SET qty_remaining = qty_remaining - ?
         WHERE id = ?`,
        [take, b.id]
      );
      remaining -= take;
    }
  } catch (e) {
    console.error('[batches] FEFO deduct failed (sale continues):', e.message);
  }
};

// ---- Internal: Restore batch stock on return ----
exports.restoreBatches = async (conn, tenantId, productId, variantId, qty) => {
  try {
    let toRestore = Math.max(0, parseFloat(qty) || 0);
    if (toRestore <= 0) return;
    const [batches] = await conn.query(
      `SELECT id, qty_remaining FROM product_batches
       WHERE tenant_id = ? AND product_id = ? AND is_active = 1
       ${variantId ? 'AND variant_id = ?' : ''}
       ORDER BY id DESC LIMIT 1`,
      variantId ? [tenantId, productId, variantId] : [tenantId, productId]
    );
    if (batches && batches.length > 0) {
      await conn.query(
        `UPDATE product_batches SET qty_remaining = qty_remaining + ? WHERE id = ?`,
        [toRestore, batches[0].id]
      );
    }
  } catch (e) {
    console.error('[batches] Restore failed:', e.message);
  }
};
