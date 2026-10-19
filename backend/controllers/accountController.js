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
    const rawAccountId = req.params.id || req.query.accountId;
    const accountId = (rawAccountId && rawAccountId !== 'undefined' && rawAccountId !== 'all' && rawAccountId !== '') ? rawAccountId : null;
    const { startDate, endDate, type, search, limit = 500 } = req.query;
    let sql = `
      SELECT t.*, COALESCE(t.type, 'debit') AS transaction_type, COALESCE(a.name, CONCAT('Account #', t.account_id)) AS account_name
      FROM account_transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.tenant_id = ?
    `;
    const params = [tenantId];
    if (accountId) {
      sql += ' AND t.account_id = ?';
      params.push(accountId);
    }
    if (type && type !== 'all') {
      sql += ' AND t.type = ?';
      params.push(type);
    }
    if (startDate) {
      sql += ' AND t.date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND t.date <= ?';
      params.push(endDate);
    }
    if (search && search.trim()) {
      sql += ' AND (t.description LIKE ? OR t.reference_no LIKE ? OR a.name LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }

    sql += ' ORDER BY t.date DESC, t.id DESC LIMIT ?';
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
    const srcAccts = await query('SELECT current_balance, name FROM accounts WHERE tenant_id = ? AND id = ?', [tenantId, from_account_id]);
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

// GET /accounts/daily-summary?date=YYYY-MM-DD
exports.getDailySummary = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const targetDate = req.query.date || new Date().toISOString().slice(0, 10);

    const accounts = await query(
      'SELECT id, name, type, account_number, bank_name, opening_balance, current_balance FROM accounts WHERE tenant_id = ? AND is_deleted = 0 ORDER BY id ASC',
      [tenantId]
    );

    const summary = [];
    let totalOpening = 0;
    let totalCredits = 0;
    let totalDebits = 0;
    let totalClosing = 0;

    for (const acc of accounts) {
      const initialOp = parseFloat(acc.opening_balance) || 0;

      // 1. Check if daily opening balance was explicitly set for this date
      const dailyRows = await query(
        'SELECT opening_balance FROM account_daily_balances WHERE tenant_id = ? AND account_id = ? AND date = ?',
        [tenantId, acc.id, targetDate]
      ).catch(() => []);

      let openingBal = initialOp;

      if (dailyRows && dailyRows.length > 0 && dailyRows[0].opening_balance !== null && dailyRows[0].opening_balance !== undefined) {
        openingBal = parseFloat(dailyRows[0].opening_balance) || 0;
      } else {
        // Compute dynamically from all transactions prior to targetDate
        const priorRows = await query(
          `SELECT 
            COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) AS prior_credits,
            COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) AS prior_debits
           FROM account_transactions 
           WHERE tenant_id = ? AND account_id = ? AND date < ?`,
          [tenantId, acc.id, targetDate]
        );
        const priorCredits = parseFloat(priorRows?.[0]?.prior_credits) || 0;
        const priorDebits = parseFloat(priorRows?.[0]?.prior_debits) || 0;
        openingBal = initialOp + priorCredits - priorDebits;
      }

      // 2. Compute transactions on targetDate
      const todayRows = await query(
        `SELECT 
          COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) AS today_credits,
          COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) AS today_debits,
          COUNT(*) AS tx_count
         FROM account_transactions 
         WHERE tenant_id = ? AND account_id = ? AND date = ?`,
        [tenantId, acc.id, targetDate]
      );

      const credits = parseFloat(todayRows?.[0]?.today_credits) || 0;
      const debits = parseFloat(todayRows?.[0]?.today_debits) || 0;
      const txCount = parseInt(todayRows?.[0]?.tx_count, 10) || 0;
      const closingBal = openingBal + credits - debits;

      totalOpening += openingBal;
      totalCredits += credits;
      totalDebits += debits;
      totalClosing += closingBal;

      summary.push({
        id: acc.id,
        name: acc.name,
        type: acc.type,
        account_number: acc.account_number,
        bank_name: acc.bank_name,
        opening_balance: Number(openingBal.toFixed(2)),
        today_credits: Number(credits.toFixed(2)),
        today_debits: Number(debits.toFixed(2)),
        closing_balance: Number(closingBal.toFixed(2)),
        current_balance: Number(parseFloat(acc.current_balance || 0).toFixed(2)),
        net_change: Number((credits - debits).toFixed(2)),
        tx_count: txCount
      });
    }

    res.json({
      success: true,
      data: {
        date: targetDate,
        accounts: summary,
        totals: {
          total_opening: Number(totalOpening.toFixed(2)),
          total_credits: Number(totalCredits.toFixed(2)),
          total_debits: Number(totalDebits.toFixed(2)),
          total_closing: Number(totalClosing.toFixed(2)),
          net_change: Number((totalCredits - totalDebits).toFixed(2))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /accounts/:id/statement?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
exports.getAccountStatement = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const accountId = req.params.id;
    const { startDate, endDate } = req.query;

    const fromDate = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const toDate = endDate || new Date().toISOString().slice(0, 10);

    const rows = await query(
      'SELECT * FROM accounts WHERE tenant_id = ? AND id = ? AND is_deleted = 0',
      [tenantId, accountId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }
    const account = rows[0];

    // 1. Calculate opening balance at start of fromDate
    const initialOp = parseFloat(account.opening_balance) || 0;

    const dailyRows = await query(
      'SELECT opening_balance FROM account_daily_balances WHERE tenant_id = ? AND account_id = ? AND date = ?',
      [tenantId, accountId, fromDate]
    ).catch(() => []);

    let openingBalance = initialOp;
    // QA-053: kaunsa opening use hua — UI me wazeh ho taa ke list vs statement mismatch samajh aaye
    let openingSource = 'computed';
    if (dailyRows && dailyRows.length > 0 && dailyRows[0].opening_balance !== null && dailyRows[0].opening_balance !== undefined) {
      openingBalance = parseFloat(dailyRows[0].opening_balance) || 0;
      openingSource = 'daily';
    } else {
      const priorRows = await query(
        `SELECT 
          COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) AS prior_credits,
          COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) AS prior_debits
         FROM account_transactions 
         WHERE tenant_id = ? AND account_id = ? AND date < ?`,
        [tenantId, accountId, fromDate]
      );
      const priorCredits = parseFloat(priorRows?.[0]?.prior_credits) || 0;
      const priorDebits = parseFloat(priorRows?.[0]?.prior_debits) || 0;
      openingBalance = initialOp + priorCredits - priorDebits;
    }
    // QA-053: list me account ka master opening_balance dikhta hai — reference ke liye bhejo
    const masterOpening = Number(initialOp.toFixed(2));

    // 2. Fetch all transactions between fromDate and toDate in chronological order
    const txRows = await query(
      `SELECT t.*, 
        t.type AS raw_type,
        CASE WHEN t.type = 'credit' THEN 'credit' ELSE 'debit' END AS tx_type,
        a.name AS account_name
       FROM account_transactions t
       JOIN accounts a ON t.account_id = a.id
       WHERE t.tenant_id = ? AND t.account_id = ? AND t.date >= ? AND t.date <= ?
       ORDER BY t.date ASC, t.id ASC`,
      [tenantId, accountId, fromDate, toDate]
    );

    // 3. Compute progressive running balance
    let running = openingBalance;
    let totalCredits = 0;
    let totalDebits = 0;

    const items = txRows.map((tx, idx) => {
      const isCredit = tx.tx_type === 'credit';
      const amt = parseFloat(tx.amount) || 0;
      if (isCredit) {
        totalCredits += amt;
        running += amt;
      } else {
        totalDebits += amt;
        running -= amt;
      }
      return {
        ...tx,
        index: idx + 1,
        id: tx.id,
        amount: amt,
        transaction_type: isCredit ? 'credit' : 'debit',
        running_balance: Number(running.toFixed(2)),
        balance_after: Number(running.toFixed(2))
      };
    });

    const closingBalance = Number(running.toFixed(2));

    res.json({
      success: true,
      data: {
        account,
        startDate: fromDate,
        endDate: toDate,
        opening_balance: Number(openingBalance.toFixed(2)),
        opening_source: openingSource,
        master_opening_balance: masterOpening,
        closing_balance: closingBalance,
        total_credits: Number(totalCredits.toFixed(2)),
        total_debits: Number(totalDebits.toFixed(2)),
        net_change: Number((closingBalance - openingBalance).toFixed(2)),
        transactions: items
      }
    });
  } catch (error) {
    next(error);
  }
};

// POST /accounts/daily-opening
exports.setDailyOpeningBalance = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { account_id, opening_balance, date, notes = '' } = req.body;
    if (!account_id) return res.status(400).json({ success: false, error: 'account_id is required' });
    const opBal = parseFloat(opening_balance);
    if (!Number.isFinite(opBal)) return res.status(400).json({ success: false, error: 'Valid opening balance required' });
    const targetDate = date || new Date().toISOString().slice(0, 10);

    const [existing] = await query(
      'SELECT id FROM account_daily_balances WHERE tenant_id = ? AND account_id = ? AND date = ?',
      [tenantId, account_id, targetDate]
    );

    if (existing) {
      await query(
        'UPDATE account_daily_balances SET opening_balance = ?, notes = ? WHERE id = ?',
        [opBal, notes, existing.id]
      );
    } else {
      await query(
        'INSERT INTO account_daily_balances (tenant_id, account_id, date, opening_balance, notes) VALUES (?, ?, ?, ?, ?)',
        [tenantId, account_id, targetDate, opBal, notes]
      );
    }

    res.json({ success: true, message: 'Daily opening balance saved!' });
  } catch (error) {
    next(error);
  }
};

