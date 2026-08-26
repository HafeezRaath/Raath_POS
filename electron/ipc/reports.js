const { ipcMain } = require('electron');
const { getDb } = require('../database/connection');
const { sanitizeInput, requiredId } = require('../utils/validators');
const { createHandler } = require('./helpers');

function registerReportHandlers() {
  // ─── 1. GET DASHBOARD STATS ───
  ipcMain.handle('getDashboardStats', createHandler(async (event, filters = {}) => {
    const db = getDb();
    const dateWhere = [];
    const params = [];
    if (filters.fromDate) { dateWhere.push(`DATE(date) >= DATE(?)`); params.push(filters.fromDate); }
    if (filters.toDate) { dateWhere.push(`DATE(date) <= DATE(?)`); params.push(filters.toDate); }
    const where = dateWhere.length ? `AND ${dateWhere.join(' AND ')}` : '';
    const sales = db.prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(grand_total),0) AS total, COALESCE(SUM(paid_amount),0) AS paid, COALESCE(SUM(due_amount),0) AS due FROM sales WHERE is_deleted = 0 ${where}`).get(...params);
    const inventory = db.prepare(`SELECT COUNT(*) AS variants, COALESCE(SUM(current_stock),0) AS units, COALESCE(SUM(current_stock * retail_price),0) AS retail_value FROM product_variants WHERE is_deleted = 0`).get();
    const customers = db.prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(current_balance),0) AS receivable FROM customers WHERE is_deleted = 0`).get();
    const expenses = db.prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(amount),0) AS total FROM expenses WHERE is_deleted = 0 ${where}`).get(...params);
    return { sales, inventory, customers, expenses };
  }));

  // ─── 2. GET REPORTS ───
  ipcMain.handle('getReports', createHandler(async (event, options = {}) => {
    const db = getDb();
    const report = sanitizeInput(options.type || 'sales_summary');
    const from = options.fromDate || '1970-01-01';
    const to = options.toDate || '9999-12-31';
    if (report === 'sales_summary') return db.prepare(`SELECT DATE(date) AS day, COUNT(*) AS invoices, COALESCE(SUM(subtotal),0) AS subtotal, COALESCE(SUM(discount + item_discount),0) AS discounts, COALESCE(SUM(tax),0) AS tax, COALESCE(SUM(grand_total),0) AS total, COALESCE(SUM(paid_amount),0) AS paid, COALESCE(SUM(due_amount),0) AS due FROM sales WHERE is_deleted = 0 AND DATE(date) BETWEEN DATE(?) AND DATE(?) GROUP BY DATE(date) ORDER BY day`).all(from, to);
    if (report === 'stock') return db.prepare(`SELECT pv.id AS variant_id, p.name AS product_name, pv.variant_name, pv.sku, pv.current_stock, pv.retail_price, pv.current_stock * pv.retail_price AS stock_value FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE pv.is_deleted = 0 AND p.is_deleted = 0 ORDER BY p.name, pv.variant_name`).all();
    if (report === 'expenses') return db.prepare(`SELECT DATE(date) AS day, COUNT(*) AS entries, COALESCE(SUM(amount),0) AS total FROM expenses WHERE is_deleted = 0 AND DATE(date) BETWEEN DATE(?) AND DATE(?) GROUP BY DATE(date) ORDER BY day`).all(from, to);
    if (report === 'customer_balances') return db.prepare(`SELECT id, name, phone, current_balance, credit_limit FROM customers WHERE is_deleted = 0 ORDER BY current_balance DESC`).all();
    throw new Error('Unknown report type');
  }));

  // ─── 3. GET AUDIT LOGS ───
  ipcMain.handle('getAuditLogs', createHandler(async (event, filters = {}) => {
    const db = getDb();
    let sql = `SELECT a.*, u.name AS user_name, u.email AS user_email FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id WHERE 1 = 1`;
    const params = [];
    if (filters.userId) { sql += ` AND a.user_id = ?`; params.push(requiredId(filters.userId, 'userId')); }
    if (filters.action) { sql += ` AND a.action = ?`; params.push(sanitizeInput(filters.action)); }
    if (filters.tableName) { sql += ` AND a.table_name = ?`; params.push(sanitizeInput(filters.tableName)); }
    if (filters.fromDate) { sql += ` AND DATE(a.created_at) >= DATE(?)`; params.push(filters.fromDate); }
    if (filters.toDate) { sql += ` AND DATE(a.created_at) <= DATE(?)`; params.push(filters.toDate); }
    sql += ` ORDER BY a.created_at DESC, a.id DESC LIMIT ?`;
    params.push(Math.min(1000, Math.max(1, Number(filters.limit) || 200)));
    return db.prepare(sql).all(...params);
  }));
}

module.exports = { registerReportHandlers };