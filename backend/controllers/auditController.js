// ============================================================
//  backend/controllers/auditController.js - Multi-Tenant Scoped
// ============================================================

const { query } = require('../config/db');

exports.getAuditLogs = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { action, user, startDate, endDate, search, limit = 200 } = req.query;

    let sql = `
      SELECT al.*, 
             COALESCE(al.user_name, u.name, 'System') AS display_user,
             COALESCE(al.user_role, u.role, 'User') AS display_role
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.tenant_id = ?
    `;
    const params = [tenantId];

    if (action && action !== 'all') {
      sql += ' AND al.action LIKE ?';
      params.push(`%${action}%`);
    }

    if (user && user !== 'all') {
      sql += ' AND (al.user_name LIKE ? OR al.user_id = ?)';
      params.push(`%${user}%`, parseInt(user, 10) || 0);
    }

    if (startDate) {
      sql += ' AND al.created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      sql += ' AND al.created_at <= ?';
      params.push(endDate + ' 23:59:59');
    }

    if (search) {
      sql += ' AND (al.action LIKE ? OR al.table_name LIKE ? OR al.details LIKE ? OR al.user_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY al.id DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    const rows = await query(sql, params).catch(() => []);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.createAuditLog = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const user = req.user || {};
    const {
      user_id = user.id || null,
      user_name = user.username || user.name || req.body.user_name || 'Admin',
      user_role = user.role || req.body.user_role || 'admin',
      action,
      table_name = '',
      record_id = null,
      details = '',
      old_values = null,
      new_values = null
    } = req.body;

    if (!action) {
      return res.status(400).json({ success: false, error: 'Action is required' });
    }

    const ipAddress = req.ip || req.connection?.remoteAddress || '';

    const sql = `
      INSERT INTO audit_logs (
        tenant_id, user_id, user_name, user_role, action, table_name,
        record_id, details, old_values, new_values, ip_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const oldStr = old_values ? (typeof old_values === 'string' ? old_values : JSON.stringify(old_values)) : null;
    const newStr = new_values ? (typeof new_values === 'string' ? new_values : JSON.stringify(new_values)) : null;

    const result = await query(sql, [
      tenantId, user_id, user_name, user_role, action, table_name,
      record_id, details, oldStr, newStr, ipAddress
    ]);

    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    next(error);
  }
};
