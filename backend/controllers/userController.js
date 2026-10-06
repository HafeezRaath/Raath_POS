// ============================================================
//  server/controllers/userController.js - Multi-Tenant Scoped
// ============================================================

const bcrypt = require('bcryptjs');
const { query } = require('../config/db');

exports.getUsers = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const users = await query(
      'SELECT id, tenant_id, name, username, email, phone, role, shop_name, status, created_at FROM users WHERE tenant_id = ? AND is_deleted = 0 ORDER BY id DESC',
      [tenantId]
    );
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};

exports.createUser = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { name, username, email, password, role = 'cashier', phone = '', shop_name = 'RAATH POS Store' } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password required' });
    }

    const existing = await query('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (tenant_id, name, username, email, phone, password_hash, role, shop_name, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [tenantId, name.trim(), username || email.split('@')[0], email.trim().toLowerCase(), phone, passwordHash, role, shop_name]
    );

    const [created] = await query('SELECT id, tenant_id, name, username, email, phone, role, shop_name, status FROM users WHERE tenant_id = ? AND id = ?', [tenantId, result.insertId]);
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const { name, username, email, phone, role, shop_name, status, password } = req.body;

    let passUpdateSql = '';
    const params = [name, username, email, phone, role, shop_name, status];

    if (password && password.trim()) {
      const hash = await bcrypt.hash(password, 10);
      passUpdateSql = ', password_hash = ?';
      params.push(hash);
    }
    params.push(tenantId, id);

    await query(
      `UPDATE users SET
        name = COALESCE(?, name),
        username = COALESCE(?, username),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        role = COALESCE(?, role),
        shop_name = COALESCE(?, shop_name),
        status = COALESCE(?, status)
        ${passUpdateSql}
       WHERE tenant_id = ? AND id = ? AND is_deleted = 0`,
      params
    );

    const [updated] = await query('SELECT id, tenant_id, name, username, email, phone, role, shop_name, status FROM users WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    if (parseInt(id, 10) === 1 && tenantId === 'tenant_default') {
      return res.status(400).json({ success: false, error: 'Cannot delete primary admin user' });
    }
    await query('UPDATE users SET is_deleted = 1, deleted_at = NOW() WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    next(error);
  }
};

exports.updateRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { label, color, pages, permissions } = req.body;

    await query(
      `UPDATE roles SET
        label = COALESCE(?, label),
        color = COALESCE(?, color),
        pages = COALESCE(?, pages),
        permissions = COALESCE(?, permissions)
       WHERE id = ?`,
      [
        label,
        color,
        pages ? JSON.stringify(pages) : null,
        permissions ? JSON.stringify(permissions) : null,
        id
      ]
    );

    res.json({ success: true, message: 'Role updated successfully' });
  } catch (error) {
    next(error);
  }
};
