// ============================================================
//  db-accounts-handlers.js — Accounts & Cash Book Module
// ============================================================

const { ipcMain } = require('electron');
const { getDb } = require('../database/connection');
const { logAudit } = require('../utils/audit');
const { sanitizeObject, requiredId } = require('../utils/validators');
const { createHandler } = require('./helpers');

/* -----------------------------------------------------------
   HELPERS — Exported so Sales/Purchase/Expense can use them
   ----------------------------------------------------------- */

function finiteMoney(val, fieldName) {
  const n = Number(val);
  if (!Number.isFinite(n)) throw new Error(`${fieldName} must be a valid number`);
  return n;
}

/**
 * Record a single account transaction (credit = money IN, debit = money OUT).
 * Also writes to general_ledger automatically.
 * MUST be called inside a db.transaction() if atomicity with other ops is needed.
 */
function recordAccountTransaction(db, { accountId, type, amount, referenceType, referenceId, referenceNo, description, date, paymentMode }) {
  if (!accountId) throw new Error('Account ID is required');
  if (!['credit', 'debit'].includes(type)) throw new Error('Transaction type must be credit or debit');
  if (amount <= 0) throw new Error('Transaction amount must be greater than zero');

  const account = db.prepare('SELECT current_balance FROM accounts WHERE id = ? AND is_deleted = 0').get(accountId);
  if (!account) throw new Error('Account not found or inactive');

  const prevBalance = parseFloat(account.current_balance) || 0;
  const amt = parseFloat(amount);
  const newBalance = type === 'credit' ? prevBalance + amt : prevBalance - amt;

  // 1. Update account balance
  db.prepare('UPDATE accounts SET current_balance = ? WHERE id = ?').run(newBalance, accountId);

  // 2. Insert transaction history
  const txResult = db.prepare(`
    INSERT INTO account_transactions 
    (account_id, transaction_type, amount, previous_balance, balance_after, reference_type, reference_id, reference_no, description, date, payment_mode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    accountId,
    type,
    amt,
    prevBalance,
    newBalance,
    referenceType || null,
    referenceId || null,
    referenceNo || null,
    description || '',
    date || new Date().toISOString(),
    paymentMode || 'cash'
  );

  // 3. Mirror in general_ledger
  db.prepare(`
    INSERT INTO general_ledger (account_type, reference_id, debit, credit, description, date, payment_mode)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    'account',
    txResult.lastInsertRowid,
    type === 'debit' ? amt : 0,
    type === 'credit' ? amt : 0,
    description || `${referenceType || 'Transaction'} — ${referenceNo || ''}`,
    date || new Date().toISOString(),
    paymentMode || 'cash'
  );

  return {
    transactionId: txResult.lastInsertRowid,
    previousBalance: prevBalance,
    newBalance: newBalance
  };
}

/**
 * Transfer money between two accounts (atomic).
 */
function transferBetweenAccounts(db, { fromAccountId, toAccountId, amount, description, date, userId = 1 }) {
  if (fromAccountId === toAccountId) throw new Error('Source and destination accounts cannot be the same');

  const tx = db.transaction((data) => {
    const debitResult = recordAccountTransaction(db, {
      accountId: data.fromAccountId,
      type: 'debit',
      amount: data.amount,
      referenceType: 'transfer',
      referenceNo: `TO-ACC-${data.toAccountId}`,
      description: data.description || `Transfer to account #${data.toAccountId}`,
      date: data.date
    });

    const creditResult = recordAccountTransaction(db, {
      accountId: data.toAccountId,
      type: 'credit',
      amount: data.amount,
      referenceType: 'transfer',
      referenceNo: `FROM-ACC-${data.fromAccountId}`,
      description: data.description || `Transfer from account #${data.fromAccountId}`,
      date: data.date
    });

    return { debitResult, creditResult };
  });

  return tx({ fromAccountId, toAccountId, amount, description, date });
}

/* -----------------------------------------------------------
   IPC HANDLERS
   ----------------------------------------------------------- */

function registerAccountHandlers() {

  // ── GET ALL ACCOUNTS ──
  ipcMain.handle('getAccounts', createHandler(async (event, filters = {}) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    let sql = `SELECT * FROM accounts WHERE is_deleted = 0`;
    const params = [];
    if (filters.type) { sql += ` AND type = ?`; params.push(filters.type); }
    if (filters.status) { sql += ` AND status = ?`; params.push(filters.status); }
    sql += ` ORDER BY name`;

    return db.prepare(sql).all(...params);
  }));

  // ── GET ACCOUNT BY ID (with today's opening balance) ──
  ipcMain.handle('getAccountById', createHandler(async (event, id) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const accountId = requiredId(id, 'accountId');
    const account = db.prepare('SELECT * FROM accounts WHERE id = ? AND is_deleted = 0').get(accountId);
    if (!account) throw new Error('Account not found');

    const today = new Date().toISOString().split('T')[0];
    const daily = db.prepare('SELECT * FROM account_daily_balances WHERE account_id = ? AND date = ?').get(accountId, today);

    return { ...account, daily_balance: daily || null };
  }));

  // ── GET ACCOUNTS SUMMARY (for dashboard) ──
  ipcMain.handle('getAccountsSummary', createHandler(async (event, filters = {}) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const today = new Date().toISOString().split('T')[0];
    let sql = `
      SELECT a.*,
        COALESCE((SELECT opening_balance FROM account_daily_balances WHERE account_id = a.id AND date = ?), a.opening_balance) as today_opening,
        COALESCE((SELECT SUM(amount) FROM account_transactions WHERE account_id = a.id AND transaction_type = 'credit' AND DATE(date) = DATE(?)), 0) as today_credits,
        COALESCE((SELECT SUM(amount) FROM account_transactions WHERE account_id = a.id AND transaction_type = 'debit' AND DATE(date) = DATE(?)), 0) as today_debits
      FROM accounts a
      WHERE a.is_deleted = 0
    `;
    const params = [today, today, today];
    if (filters.type) { sql += ` AND a.type = ?`; params.push(filters.type); }
    sql += ` ORDER BY a.name`;

    return db.prepare(sql).all(...params);
  }));

  // ── ADD ACCOUNT ──
  ipcMain.handle('addAccount', createHandler(async (event, data = {}) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const sanitized = sanitizeObject(data, ['name', 'type', 'account_number', 'bank_name', 'opening_balance', 'status']);
    if (!sanitized.name || !sanitized.name.trim()) throw new Error('Account name is required');
    if (!sanitized.type || !sanitized.type.trim()) throw new Error('Account type is required');

    const openingBalance = sanitized.opening_balance !== undefined ? finiteMoney(sanitized.opening_balance, 'opening balance') : 0;

    const result = db.prepare(`
      INSERT INTO accounts (name, type, account_number, bank_name, opening_balance, current_balance, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sanitized.name.trim(),
      sanitized.type.trim(),
      sanitized.account_number || null,
      sanitized.bank_name || null,
      openingBalance,
      openingBalance,
      sanitized.status || 'active',
      new Date().toISOString()
    );

    logAudit(data.created_by || 1, 'create', 'accounts', result.lastInsertRowid);
    return { id: result.lastInsertRowid };
  }));

  // ── UPDATE ACCOUNT ──
  ipcMain.handle('updateAccount', createHandler(async (event, id, data = {}) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const accountId = requiredId(id, 'accountId');
    const allowed = ['name', 'type', 'account_number', 'bank_name', 'status'];
    const sanitized = sanitizeObject(data, allowed);
    const fields = [], values = [];

    for (const key of allowed) {
      if (sanitized[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(sanitized[key]);
      }
    }
    if (!fields.length) return { changes: 0 };

    values.push(accountId);
    const result = db.prepare(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ? AND is_deleted = 0`).run(...values);
    if (result.changes !== 1) throw new Error('Account not found or already deleted');

    logAudit(data.updated_by || 1, 'update', 'accounts', accountId);
    return { changes: result.changes };
  }));

  // ── DELETE ACCOUNT (soft) ──
  ipcMain.handle('deleteAccount', createHandler(async (event, id) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const accountId = requiredId(id, 'accountId');

    // Safety: don't delete if transactions exist
    const txCount = db.prepare('SELECT COUNT(*) as count FROM account_transactions WHERE account_id = ?').get(accountId);
    if (txCount.count > 0) throw new Error('Cannot delete account with transaction history. Deactivate it instead.');

    const result = db.prepare(`UPDATE accounts SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ? AND is_deleted = 0`).run(accountId);
    if (result.changes !== 1) throw new Error('Account not found or already deleted');

    logAudit(event.sender?.userId || 1, 'delete', 'accounts', accountId);
    return { changes: result.changes };
  }));

  // ── GET ACCOUNT TRANSACTIONS (history) ──
  ipcMain.handle('getAccountTransactions', createHandler(async (event, accountId, filters = {}) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const id = requiredId(accountId, 'accountId');
    let sql = `SELECT * FROM account_transactions WHERE account_id = ?`;
    const params = [id];

    if (filters.fromDate) { sql += ` AND DATE(date) >= DATE(?)`; params.push(filters.fromDate); }
    if (filters.toDate)   { sql += ` AND DATE(date) <= DATE(?)`; params.push(filters.toDate); }
    if (filters.type)     { sql += ` AND transaction_type = ?`; params.push(filters.type); }
    if (filters.referenceType) { sql += ` AND reference_type = ?`; params.push(filters.referenceType); }

    sql += ` ORDER BY date DESC, id DESC`;
    return db.prepare(sql).all(...params);
  }));

  // ── GET ACCOUNT STATEMENT (Opening Balance + All Tx) ──
  ipcMain.handle('getAccountStatement', createHandler(async (event, accountId, filters = {}) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const id = requiredId(accountId, 'accountId');
    const fromDate = filters.fromDate;
    const toDate = filters.toDate;

    const account = db.prepare('SELECT * FROM accounts WHERE id = ? AND is_deleted = 0').get(id);
    if (!account) throw new Error('Account not found');

    // Calculate opening balance for the fromDate
    let openingBalance = parseFloat(account.opening_balance) || 0;

    if (fromDate) {
      // 1. Try daily opening balance record
      const daily = db.prepare('SELECT opening_balance FROM account_daily_balances WHERE account_id = ? AND date = ?').get(id, fromDate);
      if (daily) {
        openingBalance = parseFloat(daily.opening_balance);
      } else {
        // 2. Otherwise use last transaction before fromDate
        const beforeTx = db.prepare(`
          SELECT balance_after FROM account_transactions
          WHERE account_id = ? AND DATE(date) < DATE(?)
          ORDER BY date DESC, id DESC LIMIT 1
        `).get(id, fromDate);
        if (beforeTx) openingBalance = parseFloat(beforeTx.balance_after);
      }
    }

    // Fetch transactions in range
    let txSql = `SELECT * FROM account_transactions WHERE account_id = ?`;
    const txParams = [id];
    if (fromDate) { txSql += ` AND DATE(date) >= DATE(?)`; txParams.push(fromDate); }
    if (toDate)   { txSql += ` AND DATE(date) <= DATE(?)`; txParams.push(toDate); }
    txSql += ` ORDER BY date ASC, id ASC`;

    const transactions = db.prepare(txSql).all(...txParams);

    let totalCredits = 0, totalDebits = 0;
    transactions.forEach(tx => {
      if (tx.transaction_type === 'credit') totalCredits += parseFloat(tx.amount);
      else totalDebits += parseFloat(tx.amount);
    });

    const closingBalance = openingBalance + totalCredits - totalDebits;

    return {
      account,
      opening_balance: openingBalance,
      closing_balance: closingBalance,
      total_credits: totalCredits,
      total_debits: totalDebits,
      transactions
    };
  }));

  // ── SET DAILY OPENING BALANCE ──
  ipcMain.handle('setDailyOpeningBalance', createHandler(async (event, data = {}) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const accountId = requiredId(data.account_id, 'accountId');
    const date = data.date || new Date().toISOString().split('T')[0];
    const openingBalance = finiteMoney(data.opening_balance, 'opening balance');

    const account = db.prepare('SELECT id FROM accounts WHERE id = ? AND is_deleted = 0').get(accountId);
    if (!account) throw new Error('Account not found');

    const existing = db.prepare('SELECT id FROM account_daily_balances WHERE account_id = ? AND date = ?').get(accountId, date);
    if (existing) {
      db.prepare('UPDATE account_daily_balances SET opening_balance = ?, notes = ? WHERE id = ?')
        .run(openingBalance, data.notes || null, existing.id);
      return { id: existing.id, updated: true };
    } else {
      const result = db.prepare(`
        INSERT INTO account_daily_balances (account_id, date, opening_balance, notes)
        VALUES (?, ?, ?, ?)
      `).run(accountId, date, openingBalance, data.notes || null);
      return { id: result.lastInsertRowid, created: true };
    }
  }));

  // ── TRANSFER BETWEEN ACCOUNTS ──
  ipcMain.handle('transferBetweenAccounts', createHandler(async (event, data = {}) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const fromAccountId = requiredId(data.from_account_id, 'fromAccountId');
    const toAccountId = requiredId(data.to_account_id, 'toAccountId');
    const amount = finiteMoney(data.amount, 'transfer amount');
    if (amount <= 0) throw new Error('Transfer amount must be greater than zero');

    const result = transferBetweenAccounts(db, {
      fromAccountId,
      toAccountId,
      amount,
      description: data.description,
      date: data.date || new Date().toISOString()
    });

    logAudit(data.created_by || 1, 'transfer', 'accounts', fromAccountId);
    return result;
  }));
  // ── GET GENERAL LEDGER ──
  ipcMain.handle('getGeneralLedger', createHandler(async (event, filters = {}) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    let sql = `SELECT * FROM general_ledger WHERE 1=1`;
    const params = [];

    if (filters.account_type) { sql += ` AND account_type = ?`; params.push(filters.account_type); }
    if (filters.fromDate) { sql += ` AND DATE(date) >= DATE(?)`; params.push(filters.fromDate); }
    if (filters.toDate) { sql += ` AND DATE(date) <= DATE(?)`; params.push(filters.toDate); }
    
    sql += ` ORDER BY date DESC, id DESC`;
    return db.prepare(sql).all(...params);
  }));
  // ── ADJUST / CORRECT ACCOUNT BALANCE ──
  ipcMain.handle('adjustAccountBalance', createHandler(async (event, data = {}) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const accountId = requiredId(data.account_id, 'accountId');
    const targetBalance = finiteMoney(data.new_balance, 'new balance');
    const reason = data.reason || 'Manual adjustment';

    const account = db.prepare('SELECT current_balance FROM accounts WHERE id = ? AND is_deleted = 0').get(accountId);
    if (!account) throw new Error('Account not found');

    const currentBalance = parseFloat(account.current_balance);
    const diff = targetBalance - currentBalance;
    if (diff === 0) return { message: 'No adjustment needed' };

    const type = diff > 0 ? 'credit' : 'debit';
    const amount = Math.abs(diff);

    const result = recordAccountTransaction(db, {
      accountId,
      type,
      amount,
      referenceType: 'adjustment',
      description: reason,
      date: data.date || new Date().toISOString()
    });

    logAudit(data.created_by || 1, 'adjust', 'accounts', accountId);
    return result;
  }));
}


  // ── CREATE MANUAL TRANSACTION (for General Ledger entries) ──
  ipcMain.handle('createTransaction', createHandler(async (event, data = {}) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');

    const accountId = requiredId(data.account_id, 'accountId');
    const type = data.transaction_type;
    const amount = finiteMoney(data.amount, 'amount');
    if (amount <= 0) throw new Error('Amount must be greater than zero');
    if (!['credit', 'debit'].includes(type)) throw new Error('Type must be credit or debit');

    const result = recordAccountTransaction(db, {
      accountId,
      type,
      amount,
      referenceType: data.reference_type || 'manual_entry',
      referenceNo: data.reference_no || '',
      description: data.description || '',
      date: data.date || new Date().toISOString(),
      paymentMode: data.payment_mode || 'cash'
    });

    logAudit(data.created_by || 1, 'create', 'account_transactions', result.transactionId);
    return result;
  }));


module.exports = {
  registerAccountHandlers,
  recordAccountTransaction,
  transferBetweenAccounts
};