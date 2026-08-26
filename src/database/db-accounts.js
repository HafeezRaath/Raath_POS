// ============================================================
//  db-accounts.js — Accounts Module (Mixin)
//  FIXED: getGeneralLedger with account_name, debit/credit normalize
//  FIXED: createTransaction stores account_id in general_ledger
//  FIXED: transferBetweenAccounts stores account_id in general_ledger
// ============================================================

import { SYNC_ENABLED } from './core/config.js';
import { syncToCloud } from './core/sync.js';
import { cloudSync } from '../cloudSync.js';
import { idbGetAll, idbGetById, idbAdd, idbPut } from './core/idb-core.js';

export function attachAccountMethods(StorageClass) {

  // ── GET ALL ACCOUNTS ──
  StorageClass.prototype.getAccounts = async function(filters = {}, options = {}) {
    let accounts = [];
    if (this.mode === 'electron') {
      let sql = `SELECT * FROM accounts WHERE is_deleted = 0`;
      const params = [];
      if (filters.type)   { sql += ` AND type = ?`;   params.push(filters.type); }
      if (filters.status) { sql += ` AND status = ?`; params.push(filters.status); }
      sql += ` ORDER BY name`;
      accounts = await this.electronQuery(sql, params);
    } else {
      const all = await idbGetAll('accounts');
      accounts = all.filter(x => {
        if (x.is_deleted) return false;
        if (filters.type && x.type !== filters.type) return false;
        if (filters.status && x.status !== filters.status) return false;
        return true;
      });
    }

    if (options.syncFromCloud !== false && cloudSync.syncEnabled && cloudSync.isOnline) {
      try {
        const cloudAccounts = await cloudSync.pull('accounts');
        if (cloudAccounts && cloudAccounts.length > 0) {
          const localMap = new Map(accounts.map(a => [String(a.id), a]));
          let changed = false;
          for (const acc of cloudAccounts) {
            const id = String(acc.id);
            if (acc.is_deleted === 1 || acc.is_deleted === true) continue;
            const local = localMap.get(id);
            const cloudTime = new Date(acc.updated_at || acc._localUpdatedAt || 0).getTime();
            const localTime = local ? new Date(local.updated_at || local.created_at || 0).getTime() : 0;
            if (!local || cloudTime > localTime) {
              if (this.mode === 'electron') {
                const exists = await this.electronQuery("SELECT id FROM accounts WHERE id = ?", [id]);
                if (exists && exists.length > 0) {
                  await this.electronQuery(`UPDATE accounts SET name=?, type=?, account_number=?, bank_name=?, opening_balance=?, current_balance=?, status=?, updated_at=? WHERE id=?`, [acc.name, acc.type, acc.account_number || null, acc.bank_name || null, acc.opening_balance || 0, acc.current_balance || 0, acc.status || 'active', acc.updated_at || new Date().toISOString(), id]);
                } else {
                  await this.electronQuery(`INSERT INTO accounts (id, name, type, account_number, bank_name, opening_balance, current_balance, status, created_at, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`, [id, acc.name, acc.type, acc.account_number || null, acc.bank_name || null, acc.opening_balance || 0, acc.current_balance || 0, acc.status || 'active', acc.created_at || acc.updated_at || new Date().toISOString()]);
                }
              } else {
                const existing = await idbGetById('accounts', id);
                if (existing) {
                  await idbPut('accounts', { ...existing, ...acc, id, is_deleted: 0 });
                } else {
                  await idbAdd('accounts', { ...acc, is_deleted: 0 });
                }
              }
              changed = true;
            }
          }
          if (changed) {
            if (this.mode === 'electron') {
              let sql = `SELECT * FROM accounts WHERE is_deleted = 0`;
              const params = [];
              if (filters.type)   { sql += ` AND type = ?`;   params.push(filters.type); }
              if (filters.status) { sql += ` AND status = ?`; params.push(filters.status); }
              sql += ` ORDER BY name`;
              accounts = await this.electronQuery(sql, params);
            } else {
              const all = await idbGetAll('accounts');
              accounts = all.filter(x => {
                if (x.is_deleted) return false;
                if (filters.type && x.type !== filters.type) return false;
                if (filters.status && x.status !== filters.status) return false;
                return true;
              });
            }
          }
        }
      } catch (err) {
        console.warn('[Accounts] Cloud fetch failed, using local:', err.message);
      }
    }
    return accounts;
  };

  // ── GET ACCOUNT BY ID ──
  StorageClass.prototype.getAccountById = async function(id, options = {}) {
    let account = null;
    if (this.mode === 'electron') {
      const r = await this.electronQuery("SELECT * FROM accounts WHERE id = ? AND is_deleted = 0", [id]);
      account = r[0] || null;
    } else {
      const result = await idbGetById('accounts', id);
      account = result && !result.is_deleted ? result : null;
    }
    if (!account && options.syncFromCloud !== false && cloudSync.syncEnabled && cloudSync.isOnline) {
      try {
        const cloudAcc = await cloudSync.pullDoc('accounts', id);
        if (cloudAcc && !cloudAcc.is_deleted) {
          if (this.mode === 'electron') {
            await this.electronQuery(`INSERT INTO accounts (id, name, type, account_number, bank_name, opening_balance, current_balance, status, created_at, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`, [id, cloudAcc.name, cloudAcc.type, cloudAcc.account_number || null, cloudAcc.bank_name || null, cloudAcc.opening_balance || 0, cloudAcc.current_balance || 0, cloudAcc.status || 'active', cloudAcc.created_at || new Date().toISOString()]);
          } else {
            await idbAdd('accounts', { ...cloudAcc, is_deleted: 0 });
          }
          account = cloudAcc;
        }
      } catch (err) {
        console.warn('[Accounts] Cloud fetch by ID failed:', err.message);
      }
    }
    return account;
  };

  // ── CREATE ACCOUNT ──
  StorageClass.prototype.createAccount = async function(data) {
    if (this.mode === 'electron') {
      const openingBalance = data.opening_balance !== undefined ? parseFloat(data.opening_balance) : 0;
      const _res = await this.electronQuery(`INSERT INTO accounts (name, type, account_number, bank_name, opening_balance, current_balance, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [data.name, data.type || 'cash', data.account_number || null, data.bank_name || null, openingBalance, openingBalance, data.status || 'active', new Date().toISOString()]);
      if (SYNC_ENABLED) {
        await syncToCloud('accounts', { ...data, id: _res.lastInsertRowid, is_deleted: 0, current_balance: openingBalance });
      }
      return _res;
    }
    const result = await idbAdd('accounts', { ...data, is_deleted: 0, current_balance: data.opening_balance || 0, created_at: new Date().toISOString() });
    if (SYNC_ENABLED && cloudSync.syncEnabled) {
      await cloudSync.push('accounts', { ...data, id: result.id, is_deleted: 0, current_balance: data.opening_balance || 0, created_at: new Date().toISOString() });
    }
    return result;
  };

  // ── UPDATE ACCOUNT ──
  StorageClass.prototype.updateAccount = async function(id, data) {
    if (this.mode === 'electron') {
      const allowed = ['name', 'type', 'account_number', 'bank_name', 'status'];
      const fields = [], values = [];
      for (const key of allowed) {
        if (data[key] !== undefined) {
          fields.push(`${key} = ?`);
          values.push(data[key]);
        }
      }
      if (!fields.length) return { changes: 0 };
      values.push(id);
      const _res = await this.electronQuery(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`, values);
      if (SYNC_ENABLED) {
        await syncToCloud('accounts', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('accounts', id);
    if (!e) return { changes: 0 };
    const updated = { ...e, ...data, id: e.id };
    const result = await idbPut('accounts', updated);
    if (SYNC_ENABLED && cloudSync.syncEnabled) {
      await cloudSync.push('accounts', updated);
    }
    return result;
  };

  // ── DELETE ACCOUNT (soft) ──
  StorageClass.prototype.deleteAccount = async function(id) {
    if (this.mode === 'electron') {
      const tx = await this.electronQuery("SELECT COUNT(*) as count FROM account_transactions WHERE account_id = ?", [id]);
      if (tx[0]?.count > 0) throw new Error('Account has transactions. Deactivate instead.');
      const _res = await this.electronQuery("UPDATE accounts SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        await syncToCloud('accounts', { id, is_deleted: 1, deleted_at: new Date().toISOString() });
      }
      return _res;
    }
    const e = await idbGetById('accounts', id);
    if (!e) return { changes: 0 };
    const deleted = { ...e, is_deleted: 1, id: e.id };
    const result = await idbPut('accounts', deleted);
    if (SYNC_ENABLED && cloudSync.syncEnabled) {
      await cloudSync.push('accounts', deleted);
    }
    return result;
  };

  // ── GET ACCOUNT TRANSACTIONS ──
  StorageClass.prototype.getAccountTransactions = async function(accountId, filters = {}) {
    if (this.mode === 'electron') {
      let sql = `SELECT t.*, a.name as account_name, a.type as account_type FROM account_transactions t LEFT JOIN accounts a ON a.id = t.account_id WHERE t.account_id = ?`;
      const params = [accountId];
      if (filters.fromDate) { sql += ` AND DATE(t.date) >= DATE(?)`; params.push(filters.fromDate); }
      if (filters.toDate)   { sql += ` AND DATE(t.date) <= DATE(?)`; params.push(filters.toDate); }
      if (filters.type)     { sql += ` AND t.transaction_type = ?`;   params.push(filters.type); }
      sql += ` ORDER BY t.date DESC, t.id DESC`;
      return this.electronQuery(sql, params);
    }

    if (cloudSync.syncEnabled && cloudSync.isOnline) {
      try {
        const cloudTxs = await cloudSync.pull('account_transactions');
        if (cloudTxs && cloudTxs.length > 0) {
          for (const tx of cloudTxs) {
            const id = String(tx.id);
            if (!id || id === 'undefined') continue;
            const existing = await idbGetById('account_transactions', id);
            if (!existing) {
              await idbAdd('account_transactions', tx);
            }
          }
        }
      } catch (err) {
        console.warn('[Accounts] Cloud tx fetch failed:', err.message);
      }
    }

    const allAccounts = await this.getAccounts();
    const accountMap = new Map(allAccounts.map(a => [String(a.id), a]));

    const all = await idbGetAll('account_transactions');
    return all.filter(x => {
      if (String(x.account_id) !== String(accountId)) return false;
      if (filters.fromDate && new Date(x.date) < new Date(filters.fromDate)) return false;
      if (filters.toDate && new Date(x.date) > new Date(filters.toDate)) return false;
      if (filters.type && x.transaction_type !== filters.type) return false;
      return true;
    }).map(tx => {
      const acc = accountMap.get(String(tx.account_id));
      return {
        ...tx,
        account_name: tx.account_name || acc?.name || `Account #${tx.account_id}`,
        account_type: tx.account_type || acc?.type || 'other'
      };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  // ── GET ACCOUNT STATEMENT ──
  StorageClass.prototype.getAccountStatement = async function(accountId, fromDate, toDate) {
    if (this.mode === 'electron') {
      const account = await this.electronQuery("SELECT * FROM accounts WHERE id = ? AND is_deleted = 0", [accountId]);
      if (!account[0]) return null;
      let openingBalance = parseFloat(account[0].opening_balance) || 0;
      if (fromDate) {
        const daily = await this.electronQuery("SELECT opening_balance FROM account_daily_balances WHERE account_id = ? AND date = ?", [accountId, fromDate]);
        if (daily[0]) {
          openingBalance = parseFloat(daily[0].opening_balance);
        } else {
          const beforeTx = await this.electronQuery(`SELECT balance_after FROM account_transactions WHERE account_id = ? AND DATE(date) < DATE(?) ORDER BY date DESC, id DESC LIMIT 1`, [accountId, fromDate]);
          if (beforeTx[0]) openingBalance = parseFloat(beforeTx[0].balance_after);
        }
      }
      let txSql = `SELECT * FROM account_transactions WHERE account_id = ?`;
      const txParams = [accountId];
      if (fromDate) { txSql += ` AND DATE(date) >= DATE(?)`; txParams.push(fromDate); }
      if (toDate)   { txSql += ` AND DATE(date) <= DATE(?)`; txParams.push(toDate); }
      txSql += ` ORDER BY date ASC, id ASC`;
      const transactions = await this.electronQuery(txSql, txParams);
      let totalCredits = 0, totalDebits = 0;
      transactions.forEach(tx => {
        if (tx.transaction_type === 'credit') totalCredits += parseFloat(tx.amount || 0);
        else totalDebits += parseFloat(tx.amount || 0);
      });
      return {
        account: account[0],
        opening_balance: openingBalance,
        closing_balance: openingBalance + totalCredits - totalDebits,
        total_credits: totalCredits,
        total_debits: totalDebits,
        transactions
      };
    }

    if (cloudSync.syncEnabled && cloudSync.isOnline) {
      try {
        const cloudTxs = await cloudSync.pull('account_transactions');
        if (cloudTxs && cloudTxs.length > 0) {
          for (const tx of cloudTxs) {
            const id = String(tx.id);
            if (!id || id === 'undefined') continue;
            const existing = await idbGetById('account_transactions', id);
            if (!existing) {
              await idbAdd('account_transactions', tx);
            }
          }
        }
      } catch (err) {
        console.warn('[Accounts] Cloud statement tx fetch failed:', err.message);
      }
    }

    const allTx = await idbGetAll('account_transactions');
    const account = await idbGetById('accounts', accountId);
    if (!account || account.is_deleted) return null;

    const sortedAll = allTx
      .filter(x => String(x.account_id) === String(accountId))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    let openingBalance = parseFloat(account.opening_balance) || 0;
    const preRangeTx = fromDate ? sortedAll.filter(x => new Date(x.date) < new Date(fromDate)) : [];
    preRangeTx.forEach(tx => {
      if (tx.transaction_type === 'credit') openingBalance += parseFloat(tx.amount || 0);
      else openingBalance -= parseFloat(tx.amount || 0);
    });

    const filtered = fromDate || toDate
      ? sortedAll.filter(x => {
          if (fromDate && new Date(x.date) < new Date(fromDate)) return false;
          if (toDate && new Date(x.date) > new Date(toDate)) return false;
          return true;
        })
      : [...sortedAll];

    let totalCredits = 0, totalDebits = 0, runningBalance = openingBalance;
    const enriched = filtered.map(tx => {
      const amt = parseFloat(tx.amount || 0);
      if (tx.transaction_type === 'credit') {
        totalCredits += amt;
        runningBalance += amt;
      } else {
        totalDebits += amt;
        runningBalance -= amt;
      }
      return { ...tx, balance_after: runningBalance };
    });

    return {
      account,
      opening_balance: openingBalance,
      closing_balance: openingBalance + totalCredits - totalDebits,
      total_credits: totalCredits,
      total_debits: totalDebits,
      transactions: enriched
    };
  };

  // ── TRANSFER BETWEEN ACCOUNTS ──
  StorageClass.prototype.transferBetweenAccounts = async function(data) {
    if (this.mode === 'electron') {
      const amount = parseFloat(data.amount);
      if (!amount || amount <= 0) throw new Error('Invalid transfer amount');
      const fromAcc = await this.electronQuery("SELECT current_balance FROM accounts WHERE id = ? AND is_deleted = 0", [data.from_account_id]);
      if (!fromAcc[0]) throw new Error('Source account not found');
      const fromBalance = parseFloat(fromAcc[0].current_balance);
      if (fromBalance < amount) throw new Error('Insufficient balance in source account');
      const toAcc = await this.electronQuery("SELECT current_balance FROM accounts WHERE id = ? AND is_deleted = 0", [data.to_account_id]);
      if (!toAcc[0]) throw new Error('Destination account not found');
      const toBalance = parseFloat(toAcc[0].current_balance);
      const date = data.date || new Date().toISOString();
      const newFrom = fromBalance - amount;
      const newTo = toBalance + amount;
      await this.electronQuery("UPDATE accounts SET current_balance = ? WHERE id = ?", [newFrom, data.from_account_id]);
      await this.electronQuery("UPDATE accounts SET current_balance = ? WHERE id = ?", [newTo, data.to_account_id]);
      const debitTx = await this.electronQuery(`INSERT INTO account_transactions (account_id, transaction_type, amount, previous_balance, balance_after, reference_type, reference_no, description, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [data.from_account_id, 'debit', amount, fromBalance, newFrom, 'transfer', `TO-ACC-${data.to_account_id}`, data.description || `Transfer to account #${data.to_account_id}`, date]);
      const creditTx = await this.electronQuery(`INSERT INTO account_transactions (account_id, transaction_type, amount, previous_balance, balance_after, reference_type, reference_no, description, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [data.to_account_id, 'credit', amount, toBalance, newTo, 'transfer', `FROM-ACC-${data.from_account_id}`, data.description || `Transfer from account #${data.from_account_id}`, date]);
      await this.electronQuery(`INSERT INTO general_ledger (account_type, account_id, reference_id, debit, credit, description, date, payment_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, ['account', data.from_account_id, debitTx.lastInsertRowid, amount, 0, data.description || `Transfer to ${data.to_account_id}`, date, 'bank']);
      await this.electronQuery(`INSERT INTO general_ledger (account_type, account_id, reference_id, debit, credit, description, date, payment_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, ['account', data.to_account_id, creditTx.lastInsertRowid, 0, amount, data.description || `Transfer from ${data.from_account_id}`, date, 'bank']);
      return { debitTx, creditTx };
    }

    const fromAccount = await idbGetById('accounts', data.from_account_id);
    const toAccount = await idbGetById('accounts', data.to_account_id);
    if (!fromAccount || !toAccount) throw new Error('Account not found');
    const amount = parseFloat(data.amount);
    if (!amount || amount <= 0) throw new Error('Invalid transfer amount');
    const date = data.date || new Date().toISOString();
    const fromPrev = parseFloat(fromAccount.current_balance) || 0;
    const toPrev = parseFloat(toAccount.current_balance) || 0;
    if (fromPrev < amount) throw new Error('Insufficient balance in source account');
    fromAccount.current_balance = fromPrev - amount;
    toAccount.current_balance = toPrev + amount;
    await idbPut('accounts', fromAccount);
    await idbPut('accounts', toAccount);

    const debitTx = await idbAdd('account_transactions', {
      account_id: data.from_account_id,
      transaction_type: 'debit',
      amount: amount,
      previous_balance: fromPrev,
      balance_after: fromPrev - amount,
      reference_type: 'transfer',
      reference_no: `TO-ACC-${data.to_account_id}`,
      description: data.description || `Transfer to account #${data.to_account_id}`,
      date,
      payment_mode: 'bank',
      created_at: new Date().toISOString()
    });

    const creditTx = await idbAdd('account_transactions', {
      account_id: data.to_account_id,
      transaction_type: 'credit',
      amount: amount,
      previous_balance: toPrev,
      balance_after: toPrev + amount,
      reference_type: 'transfer',
      reference_no: `FROM-ACC-${data.from_account_id}`,
      description: data.description || `Transfer from account #${data.from_account_id}`,
      date,
      payment_mode: 'bank',
      created_at: new Date().toISOString()
    });

    await idbAdd('general_ledger', {
      account_id: data.from_account_id,
      account_type: 'account',
      reference_id: debitTx.id,
      debit: amount,
      credit: 0,
      description: data.description || `Transfer to account #${data.to_account_id}`,
      date,
      payment_mode: 'bank'
    });

    await idbAdd('general_ledger', {
      account_id: data.to_account_id,
      account_type: 'account',
      reference_id: creditTx.id,
      debit: 0,
      credit: amount,
      description: data.description || `Transfer from account #${data.from_account_id}`,
      date,
      payment_mode: 'bank'
    });

    if (SYNC_ENABLED && cloudSync.syncEnabled) {
      await cloudSync.push('account_transactions', { ...debitTx, id: debitTx.id });
      await cloudSync.push('account_transactions', { ...creditTx, id: creditTx.id });
      await cloudSync.push('general_ledger', { account_id: data.from_account_id, account_type: 'account', reference_id: debitTx.id, debit: amount, credit: 0, description: data.description || `Transfer to account #${data.to_account_id}`, date, payment_mode: 'bank', id: `${debitTx.id}_ledger` });
      await cloudSync.push('general_ledger', { account_id: data.to_account_id, account_type: 'account', reference_id: creditTx.id, debit: 0, credit: amount, description: data.description || `Transfer from account #${data.from_account_id}`, date, payment_mode: 'bank', id: `${creditTx.id}_ledger` });
    }

    return { debitTx, creditTx };
  };

  // ── ADJUST ACCOUNT BALANCE ──
  StorageClass.prototype.adjustAccountBalance = async function(data) {
    if (this.mode === 'electron') {
      const account = await this.electronQuery("SELECT current_balance FROM accounts WHERE id = ? AND is_deleted = 0", [data.account_id]);
      if (!account[0]) throw new Error('Account not found');
      const currentBalance = parseFloat(account[0].current_balance);
      const targetBalance = parseFloat(data.new_balance);
      const diff = targetBalance - currentBalance;
      if (diff === 0) return { message: 'No adjustment needed' };
      const type = diff > 0 ? 'credit' : 'debit';
      const amount = Math.abs(diff);
      const date = data.date || new Date().toISOString();
      await this.electronQuery("UPDATE accounts SET current_balance = ? WHERE id = ?", [targetBalance, data.account_id]);
      const tx = await this.electronQuery(`INSERT INTO account_transactions (account_id, transaction_type, amount, previous_balance, balance_after, reference_type, description, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [data.account_id, type, amount, currentBalance, targetBalance, 'adjustment', data.reason || 'Manual adjustment', date]);
      await this.electronQuery(`INSERT INTO general_ledger (account_type, account_id, reference_id, debit, credit, description, date, payment_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, ['account', data.account_id, tx.lastInsertRowid, type === 'debit' ? amount : 0, type === 'credit' ? amount : 0, data.reason || 'Manual adjustment', date, 'other']);
      return { transactionId: tx.lastInsertRowid, previousBalance: currentBalance, newBalance: targetBalance };
    }

    const account = await idbGetById('accounts', data.account_id);
    if (!account || account.is_deleted) throw new Error('Account not found');
    const currentBalance = parseFloat(account.current_balance) || 0;
    const targetBalance = parseFloat(data.new_balance);
    const diff = targetBalance - currentBalance;
    if (diff === 0) return { message: 'No adjustment needed' };
    const type = diff > 0 ? 'credit' : 'debit';
    const amount = Math.abs(diff);
    const date = data.date || new Date().toISOString();
    account.current_balance = targetBalance;
    await idbPut('accounts', account);

    const tx = await idbAdd('account_transactions', {
      account_id: data.account_id,
      transaction_type: type,
      amount: amount,
      previous_balance: currentBalance,
      balance_after: targetBalance,
      reference_type: 'adjustment',
      description: data.reason || 'Manual adjustment',
      date,
      payment_mode: 'other',
      created_at: new Date().toISOString()
    });

    await idbAdd('general_ledger', {
      account_id: data.account_id,
      account_type: 'account',
      reference_id: tx.id,
      debit: type === 'debit' ? amount : 0,
      credit: type === 'credit' ? amount : 0,
      description: data.reason || 'Manual adjustment',
      date,
      payment_mode: 'other'
    });

    return { transactionId: tx.id, previousBalance: currentBalance, newBalance: targetBalance };
  };

  // ── CREATE MANUAL TRANSACTION ──
  StorageClass.prototype.createTransaction = async function(data) {
    const amt = parseFloat(data.amount);
    const type = data.transaction_type;
    const date = data.date || new Date().toISOString();
    const paymentMode = data.payment_mode || 'cash';

    if (this.mode === 'electron') {
      const account = await this.electronQuery("SELECT current_balance FROM accounts WHERE id = ? AND is_deleted = 0", [data.account_id]);
      if (!account[0]) throw new Error('Account not found');
      const prevBal = parseFloat(account[0].current_balance) || 0;
      const newBalance = type === 'credit' ? prevBal + amt : prevBal - amt;
      await this.electronQuery("UPDATE accounts SET current_balance = ? WHERE id = ?", [newBalance, data.account_id]);
      const tx = await this.electronQuery(`INSERT INTO account_transactions (account_id, transaction_type, amount, previous_balance, balance_after, reference_type, reference_no, description, date, payment_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [data.account_id, type, amt, prevBal, newBalance, data.reference_type || 'manual_entry', data.reference_no || '', data.description || '', date, paymentMode]);
      await this.electronQuery(`INSERT INTO general_ledger (account_type, account_id, reference_id, debit, credit, description, date, payment_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, ['account', data.account_id, tx.lastInsertRowid, type === 'debit' ? amt : 0, type === 'credit' ? amt : 0, data.description || '', date, paymentMode]);
      return { transactionId: tx.lastInsertRowid, previousBalance: prevBal, newBalance };
    }

    const account = await idbGetById('accounts', data.account_id);
    if (!account || account.is_deleted) throw new Error('Account not found');
    const prevBal = parseFloat(account.current_balance) || 0;
    const newBalance = type === 'credit' ? prevBal + amt : prevBal - amt;
    account.current_balance = newBalance;
    await idbPut('accounts', account);

    const tx = await idbAdd('account_transactions', {
      account_id: data.account_id,
      transaction_type: type,
      amount: amt,
      previous_balance: prevBal,
      balance_after: newBalance,
      reference_type: data.reference_type || 'manual_entry',
      reference_no: data.reference_no || '',
      description: data.description || '',
      date,
      payment_mode: paymentMode,
      created_at: new Date().toISOString()
    });

    const ledgerEntry = {
      account_id: data.account_id,
      account_type: 'account',
      reference_id: tx.id,
      debit: type === 'debit' ? amt : 0,
      credit: type === 'credit' ? amt : 0,
      description: data.description || '',
      date,
      payment_mode: paymentMode
    };
    await idbAdd('general_ledger', ledgerEntry);

    if (SYNC_ENABLED && cloudSync.syncEnabled) {
      await cloudSync.push('account_transactions', { ...tx, id: tx.id });
      await cloudSync.push('general_ledger', { ...ledgerEntry, id: `${tx.id}_ledger` });
    }

    return { transactionId: tx.id, previousBalance: prevBal, newBalance };
  };

  // ── GET GENERAL LEDGER ──
  StorageClass.prototype.getGeneralLedger = async function(filters = {}) {
    if (this.mode === 'electron') {
      let sql = `SELECT g.*, a.name as account_name, a.type as account_type FROM general_ledger g LEFT JOIN accounts a ON a.id = g.account_id WHERE 1=1`;
      const params = [];
      if (filters.payment_mode) { sql += ` AND g.payment_mode = ?`; params.push(filters.payment_mode); }
      if (filters.fromDate) { sql += ` AND DATE(g.date) >= DATE(?)`; params.push(filters.fromDate); }
      if (filters.toDate) { sql += ` AND DATE(g.date) <= DATE(?)`; params.push(filters.toDate); }
      sql += ` ORDER BY g.date DESC, g.id DESC`;
      return this.electronQuery(sql, params);
    }

    if (cloudSync.syncEnabled && cloudSync.isOnline) {
      try {
        const cloudEntries = await cloudSync.pull('general_ledger');
        if (cloudEntries && cloudEntries.length > 0) {
          for (const entry of cloudEntries) {
            const id = String(entry.id);
            if (!id || id === 'undefined') continue;
            const existing = await idbGetById('general_ledger', id);
            if (!existing) {
              await idbAdd('general_ledger', entry);
            }
          }
        }
      } catch (err) {
        console.warn('[Accounts] Cloud ledger fetch failed:', err.message);
      }
    }

    const allAccounts = await this.getAccounts();
    const accountMap = new Map(allAccounts.map(a => [String(a.id), a]));
    const allTxs = await idbGetAll('account_transactions');
    const txMap = new Map(allTxs.map(t => [String(t.id), t]));

    const all = await idbGetAll('general_ledger');
    return all.filter(x => {
      if (filters.payment_mode && x.payment_mode !== filters.payment_mode) return false;
      if (filters.fromDate && new Date(x.date) < new Date(filters.fromDate)) return false;
      if (filters.toDate && new Date(x.date) > new Date(filters.toDate)) return false;
      return true;
    }).map(entry => {
      const tx = txMap.get(String(entry.reference_id));
      const accId = entry.account_id || tx?.account_id;
      const acc = accId ? accountMap.get(String(accId)) : null;

      const debit = entry.debit || (entry.transaction_type === 'debit' ? entry.amount : 0);
      const credit = entry.credit || (entry.transaction_type === 'credit' ? entry.amount : 0);

      return {
        ...entry,
        account_id: accId || entry.account_id || entry.reference_id,
        account_name: entry.account_name || acc?.name || tx?.account_name || 'Unknown Account',
        account_type: entry.account_type || acc?.type || tx?.account_type || 'other',
        debit: Number(debit) || 0,
        credit: Number(credit) || 0,
      };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  // ── SET DAILY OPENING BALANCE ──
  StorageClass.prototype.setDailyOpeningBalance = async function(data) {
    if (this.mode === 'electron') {
      const existing = await this.electronQuery("SELECT id FROM account_daily_balances WHERE account_id = ? AND date = ?", [data.account_id, data.date]);
      if (existing[0]) {
        await this.electronQuery("UPDATE account_daily_balances SET opening_balance = ?, notes = ? WHERE id = ?", [data.opening_balance, data.notes || null, existing[0].id]);
        return { id: existing[0].id, updated: true };
      } else {
        const result = await this.electronQuery(`INSERT INTO account_daily_balances (account_id, date, opening_balance, notes) VALUES (?, ?, ?, ?)`, [data.account_id, data.date, data.opening_balance, data.notes || null]);
        return { id: result.lastInsertRowid, created: true };
      }
    }
    const all = await idbGetAll('account_daily_balances');
    const found = all.find(x => x.account_id === data.account_id && x.date === data.date);
    if (found) {
      found.opening_balance = data.opening_balance;
      found.notes = data.notes || null;
      found.updated_at = new Date().toISOString();
      await idbPut('account_daily_balances', found);
      return { id: found.id, updated: true };
    } else {
      const newId = `adb_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const result = await idbAdd('account_daily_balances', {
        id: newId,
        account_id: data.account_id,
        date: data.date,
        opening_balance: data.opening_balance,
        notes: data.notes || null,
        created_at: new Date().toISOString()
      });
      return { id: result.id || newId, created: true };
    }
  };

  // ── DEDUCT FROM ACCOUNT BY PAYMENT MODE ──
  StorageClass.prototype.deductFromAccount = async function(paymentMode, amount, description, referenceType, referenceId) {
    const accounts = await this.getAccounts({ status: 'active' });
    const account = accounts.find(a => a.type === paymentMode);
    if (!account) {
      throw new Error(`No active "${paymentMode}" account found. Please create one in Accounts page.`);
    }
    const currentBal = parseFloat(account.current_balance) || 0;
    const amt = parseFloat(amount);
    if (currentBal < amt) {
      throw new Error(`Insufficient balance in ${account.name}. Available: ${currentBal}, Required: ${amt}`);
    }
    return this.createTransaction({
      account_id: account.id,
      transaction_type: 'debit',
      amount: amt,
      description: description || `${paymentMode} payment`,
      payment_mode: paymentMode,
      reference_type: referenceType || 'payment',
      reference_id: referenceId || null,
      date: new Date().toISOString()
    });
  };

  // ── CREDIT TO ACCOUNT BY PAYMENT MODE ──
  StorageClass.prototype.creditToAccount = async function(paymentMode, amount, description, referenceType, referenceId) {
    const accounts = await this.getAccounts({ status: 'active' });
    const account = accounts.find(a => a.type === paymentMode);
    if (!account) {
      throw new Error(`No active "${paymentMode}" account found.`);
    }
    return this.createTransaction({
      account_id: account.id,
      transaction_type: 'credit',
      amount: parseFloat(amount),
      description: description || `${paymentMode} receipt`,
      payment_mode: paymentMode,
      reference_type: referenceType || 'receipt',
      reference_id: referenceId || null,
      date: new Date().toISOString()
    });
  };

  // ── MANUAL SYNC ACCOUNTS FROM CLOUD ──
  StorageClass.prototype.syncAccountsFromCloud = async function(progressCallback = null) {
    if (!cloudSync.syncEnabled || !cloudSync.isOnline) {
      throw new Error('Cloud sync is offline or disabled');
    }
    console.log('[Accounts] Starting manual cloud sync...');
    let totalAccounts = 0;
    let totalTransactions = 0;
    try {
      const accounts = await cloudSync.pull('accounts');
      if (accounts && accounts.length > 0) {
        for (const acc of accounts) {
          const id = String(acc.id);
          if (acc.is_deleted === 1 || acc.is_deleted === true) continue;
          if (this.mode === 'electron') {
            const exists = await this.electronQuery("SELECT id FROM accounts WHERE id = ?", [id]);
            if (exists && exists.length > 0) {
              await this.electronQuery(`UPDATE accounts SET name=?, type=?, account_number=?, bank_name=?, opening_balance=?, current_balance=?, status=?, updated_at=? WHERE id=?`, [acc.name, acc.type, acc.account_number || null, acc.bank_name || null, acc.opening_balance || 0, acc.current_balance || 0, acc.status || 'active', acc.updated_at || new Date().toISOString(), id]);
            } else {
              await this.electronQuery(`INSERT INTO accounts (id, name, type, account_number, bank_name, opening_balance, current_balance, status, created_at, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`, [id, acc.name, acc.type, acc.account_number || null, acc.bank_name || null, acc.opening_balance || 0, acc.current_balance || 0, acc.status || 'active', acc.created_at || acc.updated_at || new Date().toISOString()]);
            }
          } else {
            const existing = await idbGetById('accounts', id);
            if (existing) {
              await idbPut('accounts', { ...existing, ...acc, id, is_deleted: 0 });
            } else {
              await idbAdd('accounts', { ...acc, is_deleted: 0 });
            }
          }
          totalAccounts++;
        }
        if (progressCallback) progressCallback('accounts', totalAccounts);
      }

      const transactions = await cloudSync.pull('account_transactions');
      if (transactions && transactions.length > 0) {
        for (const tx of transactions) {
          const id = String(tx.id);
          if (this.mode === 'electron') {
            const exists = await this.electronQuery("SELECT id FROM account_transactions WHERE id = ?", [id]);
            if (!exists || exists.length === 0) {
              await this.electronQuery(`INSERT INTO account_transactions (id, account_id, transaction_type, amount, previous_balance, balance_after, reference_type, reference_no, description, date, payment_mode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, tx.account_id, tx.transaction_type, tx.amount, tx.previous_balance, tx.balance_after, tx.reference_type || 'manual_entry', tx.reference_no || '', tx.description || '', tx.date, tx.payment_mode || 'cash', tx.created_at || new Date().toISOString()]);
            }
          } else {
            const existing = await idbGetById('account_transactions', id);
            if (!existing) {
              await idbAdd('account_transactions', tx);
            }
          }
          totalTransactions++;
        }
        if (progressCallback) progressCallback('account_transactions', totalTransactions);
      }

      const ledgerEntries = await cloudSync.pull('general_ledger');
      if (ledgerEntries && ledgerEntries.length > 0) {
        let totalLedger = 0;
        for (const entry of ledgerEntries) {
          const id = String(entry.id);
          if (this.mode === 'electron') {
            const exists = await this.electronQuery("SELECT id FROM general_ledger WHERE id = ?", [id]);
            if (!exists || exists.length === 0) {
              await this.electronQuery(`INSERT INTO general_ledger (id, account_type, account_id, reference_id, debit, credit, description, date, payment_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, entry.account_type || 'account', entry.account_id || null, entry.reference_id, entry.debit || 0, entry.credit || 0, entry.description || '', entry.date, entry.payment_mode || 'cash']);
            }
          } else {
            const existing = await idbGetById('general_ledger', id);
            if (!existing) {
              await idbAdd('general_ledger', entry);
            }
          }
          totalLedger++;
        }
        if (progressCallback) progressCallback('general_ledger', totalLedger);
      }

      console.log(`[Accounts] Sync complete. ${totalAccounts} accounts, ${totalTransactions} transactions fetched.`);
      return { success: true, accountsCount: totalAccounts, transactionsCount: totalTransactions };
    } catch (err) {
      console.error('[Accounts] Manual sync failed:', err);
      throw err;
    }
  };

}