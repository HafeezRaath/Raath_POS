const { ipcMain } = require('electron');
const { getDb } = require('../database/connection');
const { logAudit } = require('../utils/audit');
const { sanitizeObject, sanitizeInput, validatePositiveNumber } = require('../utils/validators');
const { createHandler } = require('./helpers');

// Yeh functions aapke utils/auth.js ya utils/crypto.js mein hone chahiye
const { hashPassword, verifyPassword } = require('../utils/auth');
const { checkLoginRate, recordLoginAttempt } = require('../utils/rateLimit');

function registerAuthHandlers() {
  // ==================== USER AUTH HANDLERS ====================
  ipcMain.handle('verify-user', createHandler(async (event, email, password) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const rateCheck = checkLoginRate(email);
    if (!rateCheck.allowed) {
      throw new Error(`Too many login attempts. Please wait ${rateCheck.waitTime} minutes`);
    }

    const user = db.prepare(`
      SELECT * FROM users WHERE email = ? AND is_deleted = 0 LIMIT 1
    `).get(email);

    if (!user) {
      recordLoginAttempt(email, false);
      throw new Error('Invalid credentials');
    }

    let isValid = false;
    let needsMigration = false;

    if (user.password_hash) {
      isValid = verifyPassword(password, user.password_hash);
    }

    if (!isValid && user.password_legacy) {
      isValid = user.password_legacy === password;
      if (isValid) needsMigration = true;
    }

    if (!isValid) {
      recordLoginAttempt(email, false);
      throw new Error('Invalid credentials');
    }

    recordLoginAttempt(email, true);

    if (needsMigration) {
      const newHash = hashPassword(password);
      db.prepare(`
        UPDATE users SET password_hash = ?, password_legacy = '[MIGRATED]' WHERE id = ?
      `).run(newHash, user.id);
    }

    const { password_hash, password_legacy, ...safeUser } = user;
    logAudit(safeUser.id, 'login', 'users', safeUser.id);

    return safeUser;
  }));

  ipcMain.handle('get-user-by-email', createHandler(async (event, email) => {
    const db = getDb();
    if (!db) return null;
    const user = db.prepare(`
      SELECT id, name, email, phone, role, shop_name, shop_address, business_type, currency, status, created_at 
      FROM users WHERE email = ? AND is_deleted = 0 LIMIT 1
    `).get(email);
    return user || null;
  }));

  ipcMain.handle('get-user-by-id', createHandler(async (event, id) => {
    const db = getDb();
    if (!db) return null;
    const user = db.prepare(`
      SELECT id, name, email, phone, role, shop_name, shop_address, business_type, currency, status, created_at 
      FROM users WHERE id = ? AND is_deleted = 0 LIMIT 1
    `).get(id);
    return user || null;
  }));

  ipcMain.handle('get-users', createHandler(async () => {
    const db = getDb();
    if (!db) return [];
    return db.prepare(`
      SELECT id, name, email, phone, role, shop_name, shop_address, business_type, currency, status, created_at
      FROM users WHERE is_deleted = 0 ORDER BY name
    `).all() || [];
  }));

  ipcMain.handle('create-user', createHandler(async (event, userData) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const sanitized = sanitizeObject(userData, ['name', 'email', 'phone', 'password', 'role', 'shop_name', 'shop_address', 'business_type', 'currency', 'status']);

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(sanitized.email);
    if (existing) throw new Error('Email already exists');

    const hashedPassword = hashPassword(sanitized.password || 'temp123');

    const result = db.prepare(`
      INSERT INTO users (name, email, phone, password_hash, role, shop_name, shop_address, business_type, currency, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sanitized.name || '',
      sanitized.email || '',
      sanitized.phone || '',
      hashedPassword,
      sanitized.role || 'cashier',
      sanitized.shop_name || '',
      sanitized.shop_address || '',
      sanitized.business_type || 'retail',
      sanitized.currency || 'PKR',
      sanitized.status || 'active'
    );

    logAudit(userData.created_by || 1, 'create', 'users', result.lastInsertRowid);
    return { id: result.lastInsertRowid };
  }));

  ipcMain.handle('update-user', createHandler(async (event, id, userData) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const sanitized = sanitizeObject(userData, ['name', 'email', 'phone', 'role', 'shop_name', 'shop_address', 'business_type', 'currency', 'status', 'password']);

    if (sanitized.email) {
      const existing = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(sanitized.email, id);
      if (existing) throw new Error('Email already exists');
    }

    const fields = [];
    const values = [];
    const allowedFields = ['name', 'email', 'phone', 'role', 'shop_name', 'shop_address', 'business_type', 'currency', 'status'];

    Object.keys(sanitized).forEach(key => {
      if (allowedFields.includes(key) && sanitized[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(sanitized[key]);
      }
    });

    if (sanitized.password && sanitized.password.length > 0) {
      const hashed = hashPassword(sanitized.password);
      fields.push('password_hash = ?');
      values.push(hashed);
    }

    if (fields.length === 0) return { changes: 0 };

    fields.push("updated_at = datetime('now')");
    values.push(id);

    const result = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    logAudit(userData.updated_by || 1, 'update', 'users', id);
    return { changes: result.changes };
  }));

  ipcMain.handle('delete-user', createHandler(async (event, id) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const result = db.prepare(`
      UPDATE users SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?
    `).run(id);

    logAudit(event.sender?.userId || 1, 'delete', 'users', id);
    return { changes: result.changes };
  }));

  // ===== ROLES HANDLERS =====
  ipcMain.handle('get-roles', createHandler(async () => {
    const db = getDb();
    if (!db) return [];
    const roles = db.prepare("SELECT * FROM roles WHERE is_deleted = 0 ORDER BY label").all();
    return roles.map(r => ({
      ...r,
      permissions: safeJsonParse(r.permissions, []),
      pages: safeJsonParse(r.pages, [])
    }));
  }));

  ipcMain.handle('create-role', createHandler(async (event, roleData) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const sanitized = sanitizeObject(roleData, ['id', 'label', 'color', 'permissions', 'pages']);

    const result = db.prepare(`
      INSERT INTO roles (id, label, color, permissions, pages) VALUES (?, ?, ?, ?, ?)
    `).run(
      sanitized.id,
      sanitized.label,
      sanitized.color || 'primary',
      JSON.stringify(sanitized.permissions || []),
      JSON.stringify(sanitized.pages || [])
    );

    return { id: result.lastInsertRowid };
  }));

  ipcMain.handle('update-role', createHandler(async (event, id, roleData) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const sanitized = sanitizeObject(roleData, ['label', 'color', 'permissions', 'pages']);

    const result = db.prepare(`
      UPDATE roles SET label = ?, color = ?, permissions = ?, pages = ? WHERE id = ? AND is_deleted = 0
    `).run(
      sanitized.label,
      sanitized.color,
      JSON.stringify(sanitized.permissions || []),
      JSON.stringify(sanitized.pages || []),
      id
    );

    return { changes: result.changes };
  }));

  ipcMain.handle('delete-role', createHandler(async (event, id) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const result = db.prepare(`
      UPDATE roles SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?
    `).run(id);

    return { changes: result.changes };
  }));

  ipcMain.handle('seed-default-roles', createHandler(async (event, roles) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const insert = db.prepare(
      "INSERT OR REPLACE INTO roles (id, label, color, permissions, pages, is_default) VALUES (?, ?, ?, ?, ?, ?)"
    );

    for (const role of roles) {
      const sanitized = sanitizeObject(role, ['id', 'label', 'color', 'permissions', 'pages', 'is_default']);
      insert.run(
        sanitized.id,
        sanitized.label,
        sanitized.color || 'primary',
        JSON.stringify(sanitized.permissions || []),
        JSON.stringify(sanitized.pages || []),
        sanitized.is_default || 0
      );
    }

    return { success: true };
  }));
}

function safeJsonParse(json, fallback) {
  try { return JSON.parse(json); } catch { return fallback; }
}

module.exports = { registerAuthHandlers };