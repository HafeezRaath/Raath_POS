const { ipcMain } = require('electron');
const { getDb } = require('../database/connection');
const { logAudit } = require('../utils/audit');
const { sanitizeObject, validatePositiveNumber } = require('../utils/validators');
const { createHandler } = require('./helpers');

function registerSupplierHandlers() {
  ipcMain.handle('db:getSuppliers', createHandler(async () => {
    const db = getDb();
    return db.prepare(`SELECT * FROM suppliers WHERE is_deleted = 0 ORDER BY name`).all() || [];
  }));

  ipcMain.handle('db:getSupplierById', createHandler(async (event, id) => {
    const db = getDb();
    return db.prepare("SELECT * FROM suppliers WHERE id = ? AND is_deleted = 0").get(id);
  }));

  ipcMain.handle('db:addSupplier', createHandler(async (event, supplierData) => {
    const db = getDb();
    const sanitized = sanitizeObject(supplierData, ['name', 'company_name', 'phone', 'email', 'vat_ntn_number', 'address', 'opening_balance', 'status']);

    const result = db.prepare(`
      INSERT INTO suppliers (
        name, company_name, phone, email, vat_ntn_number, address,
        opening_balance, current_balance, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sanitized.name,
      sanitized.company_name || '',
      sanitized.phone || '',
      sanitized.email || '',
      sanitized.vat_ntn_number || '',
      sanitized.address || '',
      validatePositiveNumber(sanitized.opening_balance, 0),
      validatePositiveNumber(sanitized.opening_balance, 0),
      sanitized.status || 'active'
    );

    logAudit(supplierData.created_by || 1, 'create', 'suppliers', result.lastInsertRowid);
    return { id: result.lastInsertRowid };
  }));

  ipcMain.handle('db:updateSupplier', createHandler(async (event, id, supplierData) => {
    const db = getDb();
    const sanitized = sanitizeObject(supplierData, ['name', 'company_name', 'phone', 'email', 'vat_ntn_number', 'address', 'status']);

    const fields = [];
    const values = [];
    const allowedFields = ['name', 'company_name', 'phone', 'email', 'vat_ntn_number', 'address', 'status'];

    Object.keys(sanitized).forEach(key => {
      if (allowedFields.includes(key) && sanitized[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(sanitized[key]);
      }
    });

    if (fields.length === 0) return { changes: 0 };

    values.push(id);
    const result = db.prepare(`UPDATE suppliers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    logAudit(supplierData.updated_by || 1, 'update', 'suppliers', id);
    return { changes: result.changes };
  }));

  ipcMain.handle('db:deleteSupplier', createHandler(async (event, id) => {
    const db = getDb();
    const supplier = db.prepare("SELECT current_balance FROM suppliers WHERE id = ?").get(id);
    if (supplier && parseFloat(supplier.current_balance) !== 0) {
      throw new Error('Cannot delete supplier with non-zero balance');
    }

    const result = db.prepare(`
      UPDATE suppliers SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?
    `).run(id);

    logAudit(event.sender?.userId || 1, 'delete', 'suppliers', id);
    return { changes: result.changes };
  }));
}

module.exports = { registerSupplierHandlers };