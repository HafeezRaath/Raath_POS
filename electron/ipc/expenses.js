const { ipcMain } = require('electron');
const { getDb } = require('../database/connection');
const { logAudit } = require('../utils/audit');
const { sanitizeObject, sanitizeInput, validatePositiveNumber, validateDate } = require('../utils/validators');
const { createHandler } = require('./helpers');
const { requiredId } = require('./helpers');

function registerExpenseHandlers() {
  ipcMain.handle('getExpenses', createHandler(async (event, filters = {}) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');
    let sql = `SELECT e.*, ec.name AS category_name FROM expenses e LEFT JOIN expense_categories ec ON ec.id = e.category_id AND ec.is_deleted = 0 WHERE e.is_deleted = 0`;
    const params = [];
    if (filters.categoryId) { sql += ` AND e.category_id = ?`; params.push(requiredId(filters.categoryId, 'categoryId')); }
    if (filters.fromDate) { sql += ` AND DATE(e.date) >= DATE(?)`; params.push(filters.fromDate); }
    if (filters.toDate) { sql += ` AND DATE(e.date) <= DATE(?)`; params.push(filters.toDate); }
    sql += ` ORDER BY e.date DESC, e.id DESC`;
    return db.prepare(sql).all(...params);
  }));

  ipcMain.handle('addExpense', createHandler(async (event, data = {}) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');
    const sanitized = sanitizeObject(data, ['title', 'amount', 'category_id', 'payment_mode', 'date', 'description', 'reference_no', 'receipt_no']);
    const amount = finiteMoney(sanitized.amount, 'expense amount');
    if (amount <= 0) throw new Error('Expense amount must be greater than zero');
    const result = db.prepare(`INSERT INTO expenses (title,amount,category_id,payment_mode,date,description,reference_no,receipt_no,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(sanitized.title, amount, sanitized.category_id ? requiredId(sanitized.category_id, 'categoryId') : null, sanitized.payment_mode || 'cash', validateDate(sanitized.date) || new Date().toISOString(), sanitized.description || '', sanitized.reference_no || null, sanitized.receipt_no || null, 'active', new Date().toISOString());
    logAudit(data.created_by || 1, 'create', 'expenses', result.lastInsertRowid);
    return { id: result.lastInsertRowid };
  }));

  ipcMain.handle('updateExpense', createHandler(async (event, id, data = {}) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');
    const expenseId = requiredId(id, 'expenseId');
    const allowed = ['title','amount','category_id','payment_mode','date','description','reference_no','receipt_no','status'];
    const sanitized = sanitizeObject(data, allowed);
    const fields = [], values = [];
    for (const key of allowed) if (sanitized[key] !== undefined) { fields.push(`${key} = ?`); values.push(key === 'amount' ? finiteMoney(sanitized[key], 'expense amount') : key === 'category_id' ? (sanitized[key] ? requiredId(sanitized[key], 'categoryId') : null) : key === 'date' ? (validateDate(sanitized[key]) || new Date().toISOString()) : sanitized[key]); }
    if (!fields.length) return { changes: 0 };
    values.push(expenseId);
    const result = db.prepare(`UPDATE expenses SET ${fields.join(', ')} WHERE id = ? AND is_deleted = 0`).run(...values);
    if (result.changes !== 1) throw new Error('Expense not found or already deleted');
    logAudit(data.updated_by || 1, 'update', 'expenses', expenseId);
    return { changes: result.changes };
  }));

  ipcMain.handle('deleteExpense', createHandler(async (event, id) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');
    const expenseId = requiredId(id, 'expenseId');
    const result = db.prepare(`UPDATE expenses SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ? AND is_deleted = 0`).run(expenseId);
    if (result.changes !== 1) throw new Error('Expense not found or already deleted');
    logAudit(event.sender?.userId || 1, 'delete', 'expenses', expenseId);
    return { changes: result.changes };
  }));
}

function finiteMoney(val, fieldName) {
  const n = Number(val);
  if (!Number.isFinite(n)) throw new Error(`${fieldName} must be a valid number`);
  return n;
}

module.exports = { registerExpenseHandlers };