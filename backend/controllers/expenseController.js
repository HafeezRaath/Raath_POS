// ============================================================
//  server/controllers/expenseController.js - Multi-Tenant Scoped
// ============================================================

const { query, transaction } = require('../config/db');

exports.getExpenses = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { startDate, endDate, categoryId } = req.query;
    let sql = `
      SELECT e.*, c.name AS category_name, a.name AS account_name
      FROM expenses e
      LEFT JOIN expense_categories c ON e.category_id = c.id
      LEFT JOIN accounts a ON e.account_id = a.id
      WHERE e.tenant_id = ? AND e.is_deleted = 0
    `;
    const params = [tenantId];

    if (startDate) {
      sql += ' AND e.date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND e.date <= ?';
      params.push(endDate);
    }
    if (categoryId) {
      sql += ' AND e.category_id = ?';
      params.push(categoryId);
    }

    sql += ' ORDER BY e.date DESC, e.id DESC';
    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.createExpense = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const {
      title, amount, category_id = null, category_name = '',
      account_id = null, description = '', date = new Date().toISOString().slice(0, 10),
      payment_method = 'cash'
    } = req.body;

    const parsedAmount = parseFloat(amount) || 0;
    if (!title || parsedAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid title and amount required' });
    }

    const createdId = await transaction(async (conn) => {
      const [resIns] = await conn.query(
        `INSERT INTO expenses (tenant_id, title, amount, category_id, category_name, account_id, description, date, payment_method)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [tenantId, title.trim(), parsedAmount, category_id, category_name, account_id, description, date, payment_method]
      );
      const expenseId = resIns.insertId;

      // Deduct from account if specified
      if (account_id) {
        await conn.query('UPDATE accounts SET current_balance = current_balance - ? WHERE tenant_id = ? AND id = ?', [parsedAmount, tenantId, account_id]);
        await conn.query(
          `INSERT INTO account_transactions (tenant_id, account_id, type, amount, balance_after, description, reference_type, reference_id, date)
           VALUES (?, ?, 'debit', ?, (SELECT current_balance FROM accounts WHERE tenant_id = ? AND id = ?), ?, 'expense', ?, ?)`,
          [tenantId, account_id, parsedAmount, tenantId, account_id, `Expense: ${title}`, expenseId, date]
        );
      }

      return expenseId;
    });

    const [created] = await query('SELECT * FROM expenses WHERE tenant_id = ? AND id = ?', [tenantId, createdId]);
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
};

exports.deleteExpense = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    await query('UPDATE expenses SET is_deleted = 1 WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    res.json({ success: true, message: 'Expense deleted' });
  } catch (error) {
    next(error);
  }
};

exports.getCategories = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const rows = await query('SELECT * FROM expense_categories WHERE tenant_id = ? AND is_deleted = 0 ORDER BY name ASC', [tenantId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.createCategory = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { name, color = '#757575', description = '' } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Category name required' });
    const result = await query('INSERT INTO expense_categories (tenant_id, name, color, description) VALUES (?, ?, ?, ?)', [tenantId, name.trim(), color, description]);
    const [created] = await query('SELECT * FROM expense_categories WHERE tenant_id = ? AND id = ?', [tenantId, result.insertId]);
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
};
