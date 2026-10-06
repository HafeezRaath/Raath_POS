// ============================================================
//  backend/controllers/offerController.js - Multi-Tenant Scoped
// ============================================================

const { query, transaction } = require('../config/db');

// --- Offers & Deals ---
exports.getOffers = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const rows = await query(`SELECT * FROM offers WHERE tenant_id = ? AND is_deleted = 0 ORDER BY id DESC`, [tenantId]);
    for (const r of rows) {
      r.items = await query(`SELECT * FROM offer_items WHERE tenant_id = ? AND offer_id = ?`, [tenantId, r.id]);
    }
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.createOffer = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { name, description = '', discount_type = 'percentage', discount_value = 0, start_date = null, end_date = null, original_total = 0, final_total = 0, items = [] } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Offer name is required' });

    const offId = await transaction(async (conn) => {
      const [ins] = await conn.query(
        `INSERT INTO offers (tenant_id, name, description, discount_type, discount_value, start_date, end_date, original_total, final_total, items_count, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [tenantId, name, description, discount_type, discount_value, start_date, end_date, original_total, final_total, items.length]
      );

      for (const item of items) {
        await conn.query(
          `INSERT INTO offer_items (tenant_id, offer_id, product_id, variant_id, product_name, variant_name, sku, original_price, offer_price, category_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [tenantId, ins.insertId, item.product_id || null, item.variant_id || null, item.product_name || '', item.variant_name || '', item.sku || '', item.original_price || 0, item.offer_price || 0, item.category_id || null]
        );
      }
      return ins.insertId;
    });

    res.status(201).json({ success: true, message: 'Offer created', data: { id: offId } });
  } catch (error) {
    next(error);
  }
};

exports.deleteOffer = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    await query(`UPDATE offers SET is_deleted = 1, deleted_at = NOW() WHERE tenant_id = ? AND id = ?`, [tenantId, id]);
    res.json({ success: true, message: 'Offer deleted' });
  } catch (error) {
    next(error);
  }
};

// Deals
exports.getDeals = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const rows = await query(`SELECT * FROM deals WHERE tenant_id = ? AND is_deleted = 0 ORDER BY id DESC`, [tenantId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.createDeal = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { title, description = '', discount_type = 'percentage', discount_value = 0, start_date = null, end_date = null, min_purchase_amount = 0, applicable_to = 'all' } = req.body;
    if (!title) return res.status(400).json({ success: false, error: 'Deal title is required' });

    const result = await query(
      `INSERT INTO deals (tenant_id, title, description, discount_type, discount_value, start_date, end_date, min_purchase_amount, applicable_to, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [tenantId, title, description, discount_type, discount_value, start_date, end_date, min_purchase_amount, applicable_to]
    );

    res.status(201).json({ success: true, message: 'Deal created', data: { id: result.insertId } });
  } catch (error) {
    next(error);
  }
};
