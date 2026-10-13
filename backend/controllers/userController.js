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
    if (!name || !name.trim() || !password || !password.trim()) {
      return res.status(400).json({ success: false, error: 'Name and password required' });
    }

    const cleanName = name.trim();
    const cleanEmail = email && typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
    const cleanUsername = (username && typeof username === 'string' && username.trim())
      ? username.trim().toLowerCase()
      : (cleanEmail ? cleanEmail.split('@')[0] : `user_${Date.now()}`);

    if (cleanEmail) {
      const existing = await query('SELECT id FROM users WHERE email = ? AND is_deleted = 0', [cleanEmail]);
      if (existing.length > 0) {
        return res.status(400).json({ success: false, error: 'Email already registered' });
      }
    }

    if (cleanUsername) {
      const existingUser = await query('SELECT id FROM users WHERE username = ? AND is_deleted = 0', [cleanUsername]);
      if (existingUser.length > 0) {
        return res.status(400).json({ success: false, error: 'Username already registered' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (tenant_id, name, username, email, phone, password_hash, role, shop_name, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [tenantId, cleanName, cleanUsername, cleanEmail, phone || '', passwordHash, role, shop_name]
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

    const cleanEmail = email && typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : (email === '' ? null : undefined);
    const cleanUsername = username && typeof username === 'string' && username.trim() ? username.trim().toLowerCase() : undefined;

    if (cleanEmail) {
      const existingEmail = await query('SELECT id FROM users WHERE email = ? AND id != ? AND is_deleted = 0', [cleanEmail, id]);
      if (existingEmail.length > 0) {
        return res.status(400).json({ success: false, error: 'Email already registered by another user' });
      }
    }

    if (cleanUsername) {
      const existingUser = await query('SELECT id FROM users WHERE username = ? AND id != ? AND is_deleted = 0', [cleanUsername, id]);
      if (existingUser.length > 0) {
        return res.status(400).json({ success: false, error: 'Username already registered by another user' });
      }
    }

    let passUpdateSql = '';
    const params = [name, cleanUsername !== undefined ? cleanUsername : null, cleanEmail !== undefined ? cleanEmail : null, phone, role, shop_name, status];

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
        email = CASE WHEN ? IS NOT NULL THEN ? ELSE email END,
        phone = COALESCE(?, phone),
        role = COALESCE(?, role),
        shop_name = COALESCE(?, shop_name),
        status = COALESCE(?, status)
        ${passUpdateSql}
       WHERE tenant_id = ? AND id = ? AND is_deleted = 0`,
      [name, cleanUsername !== undefined ? cleanUsername : null, cleanEmail, cleanEmail, phone, role, shop_name, status, ...(password && password.trim() ? [params[7]] : []), tenantId, id]
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
