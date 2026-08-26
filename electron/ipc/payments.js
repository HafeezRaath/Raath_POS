const { ipcMain } = require('electron');
const { getDb } = require('../database/connection');
const { logAudit } = require('../utils/audit');
const { sanitizeObject, validateDate } = require('../utils/validators');
const { createHandler, requiredId, finiteMoney } = require('./helpers');

function registerPaymentHandlers() {
  ipcMain.handle('getPayments', createHandler(async (event, filters = {}) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');
    let sql = `SELECT py.*, c.name AS customer_name, s.name AS supplier_name FROM payments py LEFT JOIN customers c ON c.id = py.customer_id LEFT JOIN suppliers s ON s.id = py.supplier_id WHERE py.is_deleted = 0`;
    const params = [];
    if (filters.customerId) { sql += ` AND py.customer_id = ?`; params.push(requiredId(filters.customerId, 'customerId')); }
    if (filters.supplierId) { sql += ` AND py.supplier_id = ?`; params.push(requiredId(filters.supplierId, 'supplierId')); }
    if (filters.fromDate) { sql += ` AND DATE(py.date) >= DATE(?)`; params.push(filters.fromDate); }
    if (filters.toDate) { sql += ` AND DATE(py.date) <= DATE(?)`; params.push(filters.toDate); }
    sql += ` ORDER BY py.date DESC, py.id DESC`;
    return db.prepare(sql).all(...params);
  }));

  ipcMain.handle('addPayment', createHandler(async (event, data = {}) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');
    const sanitized = sanitizeObject(data, ['amount', 'customer_id', 'supplier_id', 'payment_mode', 'note', 'date']);
    const amount = finiteMoney(sanitized.amount, 'payment amount');
    if (amount <= 0) throw new Error('Payment amount must be greater than zero');
    const customerId = sanitized.customer_id ? requiredId(sanitized.customer_id, 'customerId') : null;
    const supplierId = sanitized.supplier_id ? requiredId(sanitized.supplier_id, 'supplierId') : null;
    if ((customerId ? 1 : 0) + (supplierId ? 1 : 0) !== 1) throw new Error('Payment must belong to exactly one customer or supplier');
    
    const transaction = db.transaction(() => {
      if (customerId) {
        const row = db.prepare(`SELECT current_balance FROM customers WHERE id = ? AND is_deleted = 0`).get(customerId);
        if (!row) throw new Error('Customer not found');
        if (amount > Number(row.current_balance || 0)) throw new Error('Payment exceeds customer balance');
        const after = Number(row.current_balance || 0) - amount;
        db.prepare(`UPDATE customers SET current_balance = ? WHERE id = ?`).run(after, customerId);
        const result = db.prepare(`INSERT INTO payments (customer_id,amount,type,payment_mode,note,date) VALUES (?,?,?,?,?,?)`).run(customerId, amount, 'customer_payment', sanitized.payment_mode || 'cash', sanitized.note || '', validateDate(sanitized.date) || new Date().toISOString());
        db.prepare(`INSERT INTO customer_ledger (customer_id,type,amount,previous_balance,balance_after,description,payment_mode,reference_no,date) VALUES (?,?,?,?,?,?,?,?,?)`).run(customerId, 'payment', -amount, Number(row.current_balance || 0), after, sanitized.note || 'Payment received', sanitized.payment_mode || 'cash', `PAY-${result.lastInsertRowid}`, validateDate(sanitized.date) || new Date().toISOString());
        logAudit(data.created_by || 1, 'payment', 'customers', customerId);
        return { id: result.lastInsertRowid, balance_after: after };
      }
      const row = db.prepare(`SELECT current_balance FROM suppliers WHERE id = ? AND is_deleted = 0`).get(supplierId);
      if (!row) throw new Error('Supplier not found');
      if (amount > Number(row.current_balance || 0)) throw new Error('Payment exceeds supplier balance');
      const after = Number(row.current_balance || 0) - amount;
      db.prepare(`UPDATE suppliers SET current_balance = ? WHERE id = ?`).run(after, supplierId);
      const result = db.prepare(`INSERT INTO payments (supplier_id,amount,type,payment_mode,note,date) VALUES (?,?,?,?,?,?)`).run(supplierId, amount, 'supplier_payment', sanitized.payment_mode || 'cash', sanitized.note || '', validateDate(sanitized.date) || new Date().toISOString());
      db.prepare(`INSERT INTO ledger (supplier_id,type,amount,description,date) VALUES (?,?,?,?,?)`).run(supplierId, 'payment', -amount, sanitized.note || 'Payment made', validateDate(sanitized.date) || new Date().toISOString());
      logAudit(data.created_by || 1, 'payment', 'suppliers', supplierId);
      return { id: result.lastInsertRowid, balance_after: after };
    });
    return transaction();
  }));
}

module.exports = { registerPaymentHandlers };