// ============================================================
//  unitController — Stock units master data (Pharmacy)
//  e.g. Tablet (tab), Capsule (cap), Syrup (ml), Injection (inj)
// ============================================================

const { query } = require('../config/db');

exports.getUnits = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const rows = await query('SELECT * FROM units WHERE tenant_id = ? AND is_deleted = 0 ORDER BY name ASC', [tenantId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.createUnit = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { name, symbol = null } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Unit name is required' });
    }
    const result = await query(
      'INSERT INTO units (tenant_id, name, symbol) VALUES (?, ?, ?)',
      [tenantId, name.trim(), symbol]
    );
    const created = await query('SELECT * FROM units WHERE tenant_id = ? AND id = ?', [tenantId, result.insertId]);
    res.status(201).json({ success: true, data: created[0] });
  } catch (error) {
    next(error);
  }
};

exports.deleteUnit = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    await query('UPDATE units SET is_deleted = 1, deleted_at = NOW() WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    res.json({ success: true, message: 'Unit deleted' });
  } catch (error) {
    next(error);
  }
};
