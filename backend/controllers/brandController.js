// ============================================================
//  server/controllers/brandController.js - Multi-Tenant Scoped
// ============================================================

const { query } = require('../config/db');

exports.getBrands = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const rows = await query('SELECT * FROM brands WHERE tenant_id = ? AND is_deleted = 0 ORDER BY name ASC', [tenantId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.createBrand = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { name, status = 'active' } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Brand name is required' });
    }
    const result = await query(
      'INSERT INTO brands (tenant_id, name, status) VALUES (?, ?, ?)',
      [tenantId, name.trim(), status]
    );
    const created = await query('SELECT * FROM brands WHERE tenant_id = ? AND id = ?', [tenantId, result.insertId]);
    res.status(201).json({ success: true, data: created[0] });
  } catch (error) {
    next(error);
  }
};

exports.updateBrand = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const { name, status } = req.body;
    await query('UPDATE brands SET name = COALESCE(?, name), status = COALESCE(?, status) WHERE tenant_id = ? AND id = ?', [name, status, tenantId, id]);
    const updated = await query('SELECT * FROM brands WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    next(error);
  }
};

exports.deleteBrand = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    await query('UPDATE brands SET is_deleted = 1, deleted_at = NOW() WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    res.json({ success: true, message: 'Brand deleted' });
  } catch (error) {
    next(error);
  }
};
