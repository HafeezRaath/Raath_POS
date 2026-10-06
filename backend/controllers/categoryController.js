// ============================================================
//  server/controllers/categoryController.js - Multi-Tenant Scoped
// ============================================================

const { query } = require('../config/db');

exports.getCategories = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const rows = await query('SELECT * FROM categories WHERE tenant_id = ? AND is_deleted = 0 ORDER BY name ASC', [tenantId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.createCategory = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { name, slug, parent_id = null, status = 'active' } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Category name is required' });
    }
    const catSlug = slug || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const result = await query(
      'INSERT INTO categories (tenant_id, name, slug, parent_id, status) VALUES (?, ?, ?, ?, ?)',
      [tenantId, name.trim(), catSlug, parent_id, status]
    );
    const created = await query('SELECT * FROM categories WHERE tenant_id = ? AND id = ?', [tenantId, result.insertId]);
    res.status(201).json({ success: true, data: created[0] });
  } catch (error) {
    next(error);
  }
};

exports.updateCategory = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const { name, slug, parent_id, status } = req.body;
    await query(
      'UPDATE categories SET name = COALESCE(?, name), slug = COALESCE(?, slug), parent_id = COALESCE(?, parent_id), status = COALESCE(?, status) WHERE tenant_id = ? AND id = ?',
      [name, slug, parent_id, status, tenantId, id]
    );
    const updated = await query('SELECT * FROM categories WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    next(error);
  }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    await query('UPDATE categories SET is_deleted = 1, deleted_at = NOW() WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    next(error);
  }
};
