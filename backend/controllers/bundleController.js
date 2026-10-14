// ============================================================
//  backend/controllers/bundleController.js - Bookshop Class Bundles
//  Multi-Tenant Scoped. "Class Complete Set" one-click bundles.
//  Sale deduction: each bundle line deducts every component variant.
// ============================================================

const { query, transaction } = require('../config/db');

// --- List bundles with items + availability ---
exports.getBundles = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const onlyActive = req.query.active === '1';
    const rows = await query(
      `SELECT * FROM bundles WHERE tenant_id = ? ${onlyActive ? 'AND is_active = 1' : ''} ORDER BY id DESC`,
      [tenantId]
    );
    for (const b of rows) {
      const items = await query(
        `SELECT bi.*, pv.variant_name, pv.sku AS variant_sku, COALESCE(pv.stock, pv.current_stock, 0) AS stock_qty,
                p.name AS product_name, p.sale_price
         FROM bundle_items bi
         LEFT JOIN product_variants pv ON pv.id = bi.product_variant_id
         LEFT JOIN products p ON p.id = pv.product_id
         WHERE bi.bundle_id = ?`,
        [b.id]
      );
      b.items = items;
      b.can_fulfill = items.every(i => Number(i.stock_qty || 0) >= Number(i.qty || 1));
    }
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

// --- Create bundle ---
exports.createBundle = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { name, class_name = '', sku = '', barcode = '', bundle_price = 0, notes = '', items = [] } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Bundle name is required' });
    if (!items.length) return res.status(400).json({ success: false, error: 'Add at least one item' });

    const bundleId = await transaction(async (conn) => {
      const [ins] = await conn.query(
        `INSERT INTO bundles (tenant_id, name, class_name, sku, barcode, bundle_price, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [tenantId, name, class_name, sku, barcode || null, Number(bundle_price) || 0, notes]
      );
      for (const it of items) {
        await conn.query(
          `INSERT INTO bundle_items (bundle_id, product_variant_id, qty) VALUES (?, ?, ?)`,
          [ins.insertId, it.product_variant_id, Math.max(1, parseInt(it.qty) || 1)]
        );
      }
      return ins.insertId;
    });
    res.json({ success: true, data: { id: bundleId } });
  } catch (error) {
    next(error);
  }
};

// --- Update bundle (header + replace items) ---
exports.updateBundle = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { name, class_name = '', sku = '', barcode = '', bundle_price = 0, notes = '', is_active = 1, items = [] } = req.body;
    await transaction(async (conn) => {
      await conn.query(
        `UPDATE bundles SET name = ?, class_name = ?, sku = ?, barcode = ?, bundle_price = ?, notes = ?, is_active = ?
         WHERE id = ? AND tenant_id = ?`,
        [name, class_name, sku, barcode || null, Number(bundle_price) || 0, notes, is_active ? 1 : 0, req.params.id, tenantId]
      );
      await conn.query(`DELETE FROM bundle_items WHERE bundle_id = ?`, [req.params.id]);
      for (const it of items) {
        await conn.query(
          `INSERT INTO bundle_items (bundle_id, product_variant_id, qty) VALUES (?, ?, ?)`,
          [req.params.id, it.product_variant_id, Math.max(1, parseInt(it.qty) || 1)]
        );
      }
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// --- Delete bundle ---
exports.deleteBundle = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    await transaction(async (conn) => {
      await conn.query(`DELETE FROM bundle_items WHERE bundle_id = ?`, [req.params.id]);
      await conn.query(`DELETE FROM bundles WHERE id = ? AND tenant_id = ?`, [req.params.id, tenantId]);
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// --- Deduct bundle components after a POS sale ---
// POST /api/bundles/deduct  { bundle_id, qty }
exports.deductBundleStock = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { bundle_id, qty = 1 } = req.body;
    const items = await query(`SELECT * FROM bundle_items WHERE bundle_id = ?`, [bundle_id]);
    await transaction(async (conn) => {
      for (const it of items) {
        await conn.query(
          `UPDATE product_variants SET stock = GREATEST(0, stock - ?), current_stock = GREATEST(0, current_stock - ?) WHERE id = ?`,
          [Number(it.qty) * Number(qty), Number(it.qty) * Number(qty), it.product_variant_id]
        );
      }
    });
    res.json({ success: true, deducted: items.length });
  } catch (error) {
    next(error);
  }
};
