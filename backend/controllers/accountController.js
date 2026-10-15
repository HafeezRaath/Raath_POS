// ============================================================
//  server/controllers/accountController.js - Multi-Tenant Scoped
// ============================================================

const { query, transaction } = require('../config/db');

exports.getAccounts = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const rows = await query('SELECT * FROM accounts WHERE tenant_id = ? AND is_deleted = 0 ORDER BY id ASC', [tenantId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.getAccountById = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const rows = await query('SELECT * FROM accounts WHERE tenant_id = ? AND id = ? AND is_deleted = 0', [tenantId, id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.createAccount = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { name, type = 'cash', account_number = '', bank_name = '', opening_balance = 0, status = 'active' } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Account name is required' });
    }
    const opBal = parseFloat(opening_balance) || 0;
    const result = await query(
      `INSERT INTO accounts (tenant_id, name, type, account_number, bank_name, opening_balance, current_balance, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, name.trim(), type, account_number, bank_name, opBal, opBal, status]
    );
    const [created] = await query('SELECT * FROM accounts WHERE tenant_id = ? AND id = ?', [tenantId, result.insertId]);
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
};

exports.updateAccount = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const { name, type, account_number, bank_name, status } = req.body;
    await query(
      `UPDATE accounts SET
        name = COALESCE(?, name),
        type = COALESCE(?, type),
        account_number = COALESCE(?, account_number),
        bank_name = COALESCE(?, bank_name),
        status = COALESCE(?, status)
       WHERE tenant_id = ? AND id = ? AND is_deleted = 0`,
      [name, type, account_number, bank_name, status, tenantId, id]
    );
    const [updated] = await query('SELECT * FROM accounts WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

exports.deleteAccount = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    await query('UPDATE accounts SET is_deleted = 1, deleted_at = NOW() WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    res.json({ success: true, message: 'Account deleted' });
  } catch (error) {
    next(error);
  }
};

exports.getTransactions = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const accountId = req.params.id || req.query.accountId;
    const { startDate, endDate, limit = 100 } = req.query;
    let sql = `
      SELECT t.*, t.type AS transaction_type, a.name AS account_name
      FROM account_transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE t.tenant_id = ?
    `;
    const params = [tenantId];
    if (accountId) {
      sql += ' AND t.account_id = ?';
      params.push(accountId);
    }
    if (startDate) {
      sql += ' AND t.date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND t.date <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY t.id DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.transferFunds = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { from_account_id, to_account_id, amount, description = 'Fund Transfer' } = req.body;
    const transferAmount = parseFloat(amount) || 0;

    if (!from_account_id || !to_account_id || from_account_id === to_account_id || transferAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid source, destination, and amount required' });
    }

    // M1 FIX: Check source has sufficient balance (prevent negative)
    const [srcAccts] = await query('SELECT current_balance, name FROM accounts WHERE tenant_id = ? AND id = ?', [tenantId, from_account_id]);
    if (srcAccts.length === 0) {
      return res.status(404).json({ success: false, error: 'Source account not found' });
    }
    const srcBalance = parseFloat(srcAccts[0].current_balance) || 0;
    // Round to 2 decimals for comparison (paisa precision)
    const roundedBalance = Math.round(srcBalance * 100) / 100;
    const roundedAmount = Math.round(transferAmount * 100) / 100;
    if (roundedAmount > roundedBalance) {
      return res.status(400).json({ 
        success: false, 
        error: `Insufficient balance in ${srcAccts[0].name}. Available: Rs.${roundedBalance.toFixed(2)}, Requested: Rs.${roundedAmount.toFixed(2)}` 
      });
    }

    await transaction(async (conn) => {
      // 1. Deduct from source
      await conn.query('UPDATE accounts SET current_balance = current_balance - ? WHERE tenant_id = ? AND id = ?', [transferAmount, tenantId, from_account_id]);
      await conn.query(
        `INSERT INTO account_transactions (tenant_id, account_id, type, amount, balance_after, description, reference_type, reference_id, date)
         VALUES (?, ?, 'debit', ?, (SELECT current_balance FROM accounts WHERE tenant_id = ? AND id = ?), ?, 'transfer_out', ?, CURDATE())`,
        [tenantId, from_account_id, transferAmount, tenantId, from_account_id, description, to_account_id]
      );

      // 2. Add to destination
      await conn.query('UPDATE accounts SET current_balance = current_balance + ? WHERE tenant_id = ? AND id = ?', [transferAmount, tenantId, to_account_id]);
      await conn.query(
        `INSERT INTO account_transactions (tenant_id, account_id, type, amount, balance_after, description, reference_type, reference_id, date)
         VALUES (?, ?, 'credit', ?, (SELECT current_balance FROM accounts WHERE tenant_id = ? AND id = ?), ?, 'transfer_in', ?, CURDATE())`,
        [tenantId, to_account_id, transferAmount, tenantId, to_account_id, description, from_account_id]
      );
    });

    res.json({ success: true, message: 'Transfer completed successfully' });
  } catch (error) {
    next(error);
  }
};

exports.createTransaction = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const {
      account_id,
      type,
      transaction_type,
      amount,
      description = 'Manual Entry',
      payment_mode = 'cash',
      reference_no = '',
      reference_type = 'manual_entry',
      date
    } = req.body;

    const accId = account_id;
    const txType = (transaction_type || type || 'credit').toLowerCase();
    const txAmount = parseFloat(amount) || 0;
    const txDate = date ? new Date(date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

    if (!accId || txAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Account ID and valid amount required' });
    }

    const txId = await transaction(async (conn) => {
      if (txType === 'credit') {
        await conn.query('UPDATE accounts SET current_balance = current_balance + ? WHERE tenant_id = ? AND id = ?', [txAmount, tenantId, accId]);
      } else {
        await conn.query('UPDATE accounts SET current_balance = current_balance - ? WHERE tenant_id = ? AND id = ?', [txAmount, tenantId, accId]);
      }

      const [insertRes] = await conn.query(
        `INSERT INTO account_transactions (tenant_id, account_id, type, amount, balance_after, description, reference_type, reference_id, date)
         VALUES (?, ?, ?, ?, (SELECT current_balance FROM accounts WHERE tenant_id = ? AND id = ?), ?, ?, ?, ?)`,
        [tenantId, accId, txType, txAmount, tenantId, accId, description, reference_type, reference_no || null, txDate]
      );

      return insertRes.insertId;
    });

    const [created] = await query('SELECT * FROM account_transactions WHERE tenant_id = ? AND id = ?', [tenantId, txId]);
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
};

exports.adjustBalance = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { account_id, new_balance, reason, date } = req.body;
    if (!account_id) return res.status(400).json({ success: false, error: 'account_id required' });
    const target = Number(new_balance);
    if (!Number.isFinite(target)) return res.status(400).json({ success: false, error: 'Valid new_balance required' });

    // Try with tenant first, then without (for robustness)
    let rows = await query('SELECT current_balance FROM accounts WHERE tenant_id = ? AND id = ? AND is_deleted = 0', [tenantId, account_id]);
    if (!rows.length) {
      rows = await query('SELECT current_balance, tenant_id FROM accounts WHERE id = ? AND is_deleted = 0', [account_id]);
    }
    if (!rows.length) return res.status(404).json({ success: false, error: 'Account not found' });
    const actualTenant = rows[0].tenant_id || tenantId;
    const current = Number(rows[0].current_balance) || 0;
    const delta = target - current;
    if (delta === 0) return res.json({ success: true, message: 'No change needed', data: { delta: 0 } });

    const txType = delta > 0 ? 'credit' : 'debit';
    const txAmount = Math.abs(delta);
    const txDate = date || new Date().toISOString().slice(0, 10);

    await transaction(async (conn) => {
      await conn.query('UPDATE accounts SET current_balance = ? WHERE id = ?', [target, account_id]);
      await conn.query(
        `INSERT INTO account_transactions (tenant_id, account_id, type, amount, balance_after, description, reference_type, date)
         VALUES (?, ?, ?, ?, ?, ?, 'adjustment', ?)`,
        [actualTenant, account_id, txType, txAmount, target, reason || 'Manual balance adjustment', txDate]
      );
    });

    res.json({ success: true, message: 'Balance adjusted!', data: { delta } });
  } catch (error) {
    next(error);
  }
};
