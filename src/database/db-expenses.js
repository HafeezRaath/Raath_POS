// ============================================================
//  db-expenses.js — Expense Categories & Expenses Module (Mixin)
// ============================================================

import { SYNC_ENABLED } from './core/config.js';
import { syncToCloud } from './core/sync.js';
import { idbGetAll, idbGetById, idbAdd, idbPut } from './core/idb-core.js';

export function attachExpenseMethods(StorageClass) {

  // ==================== EXPENSE CATEGORIES ====================
  StorageClass.prototype.getExpenseCategories = async function() { 
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT * FROM expense_categories WHERE is_deleted = 0 ORDER BY name");
    }
    return idbGetAll('expense_categories').then(r => r.filter(x => !x.is_deleted));
  };

  StorageClass.prototype.getExpenseCategoryById = async function(id) { 
    if (this.mode === 'electron') { 
      const r = await this.electronQuery("SELECT * FROM expense_categories WHERE id = ? AND is_deleted = 0", [id]);
      return r[0] || null;
    }
    const result = await idbGetById('expense_categories', id);
    return result && !result.is_deleted ? result : null;
  };

  StorageClass.prototype.createExpenseCategory = async function(data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("INSERT INTO expense_categories (name, color, description) VALUES (?, ?, ?)", [data.name, data.color || '#757575', data.description]);
      if (SYNC_ENABLED) {
        await syncToCloud('expense_categories', { ...data, id: _res.lastInsertRowid, is_deleted: 0 });
      }
      return _res;
    }
    return idbAdd('expense_categories', { ...data, is_deleted: 0 });
  };

  StorageClass.prototype.updateExpenseCategory = async function(id, data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE expense_categories SET name = ?, color = ?, description = ? WHERE id = ?", [data.name, data.color, data.description, id]);
      if (SYNC_ENABLED) {
        await syncToCloud('expense_categories', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('expense_categories', id);
    if (!e) return { changes: 0 };
    return idbPut('expense_categories', { ...e, ...data, id: e.id });
  };

  StorageClass.prototype.deleteExpenseCategory = async function(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE expense_categories SET is_deleted = 1 WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        await syncToCloud('expense_categories', { id, is_deleted: 1 });
      }
      return _res;
    }
    const e = await idbGetById('expense_categories', id);
    if (!e) return { changes: 0 };
    return idbPut('expense_categories', { ...e, is_deleted: 1, id: e.id });
  };

  // ==================== EXPENSES ====================
  StorageClass.prototype.getExpenses = async function() { 
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT e.*, ec.name as category_name, ec.color as category_color FROM expenses e LEFT JOIN expense_categories ec ON e.category_id = ec.id WHERE e.is_deleted = 0 ORDER BY e.id DESC");
    }
    const [expenses, categories] = await Promise.all([
      idbGetAll('expenses'),
      idbGetAll('expense_categories')
    ]);
    return expenses.filter(x => !x.is_deleted).map(e => ({
      ...e,
      category_name: categories.find(c => c.id === e.category_id)?.name || '',
      category_color: categories.find(c => c.id === e.category_id)?.color || ''
    }));
  };

  StorageClass.prototype.getExpenseById = async function(id) { 
    if (this.mode === 'electron') { 
      const r = await this.electronQuery("SELECT e.*, ec.name as category_name FROM expenses e LEFT JOIN expense_categories ec ON e.category_id = ec.id WHERE e.id = ? AND e.is_deleted = 0", [id]);
      return r[0] || null;
    }
    const e = await idbGetById('expenses', id);
    if (!e || e.is_deleted) return null;
    const categories = await idbGetAll('expense_categories');
    return { ...e, category_name: categories.find(c => c.id === e.category_id)?.name || '' };
  };

  StorageClass.prototype.createExpense = async function(data) {
    if (this.mode === 'electron') {
      const result = await this.electronQuery(
        `INSERT INTO expenses (title, category_id, amount, description, date, payment_mode, reference_no, receipt_no, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.title, data.category_id, data.amount, data.description, data.date, data.payment_mode, data.reference_no, data.receipt_no, data.status || 'active']
      );
      
      try {
        await this.logToGeneralLedger('expense', result.lastInsertRowid, data.amount, 0, `Expense: ${data.title}`);
        await this.logToGeneralLedger('cash', result.lastInsertRowid, 0, data.amount, `Cash out: ${data.title}`);
      } catch (e) {
        console.error('[createExpense] Ledger error (non-critical):', e);
      }
      
      if (SYNC_ENABLED) {
        await syncToCloud('expenses', { ...data, id: result.lastInsertRowid, is_deleted: 0 });
      }
      return result;
    }
    
    const result = await idbAdd('expenses', { ...data, is_deleted: 0 });
    
    try {
      await this.logToGeneralLedger('expense', result.lastInsertRowid, data.amount, 0, `Expense: ${data.title}`);
      await this.logToGeneralLedger('cash', result.lastInsertRowid, 0, data.amount, `Cash out: ${data.title}`);
    } catch (e) {
      console.error('[createExpense] Ledger error (non-critical):', e);
    }
    
    if (SYNC_ENABLED) {
      await syncToCloud('expenses', { ...data, id: result.lastInsertRowid, is_deleted: 0 });
    }
    return result;
  };

  StorageClass.prototype.updateExpense = async function(id, data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`UPDATE expenses SET title = ?, category_id = ?, amount = ?, description = ?, date = ?, payment_mode = ?, reference_no = ?, receipt_no = ?, status = ? WHERE id = ?`, [data.title, data.category_id, data.amount, data.description, data.date, data.payment_mode, data.reference_no, data.receipt_no, data.status, id]);
      if (SYNC_ENABLED) {
        await syncToCloud('expenses', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('expenses', id);
    if (!e) return { changes: 0 };
    return idbPut('expenses', { ...e, ...data, id: e.id });
  };

  StorageClass.prototype.deleteExpense = async function(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE expenses SET is_deleted = 1 WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        await syncToCloud('expenses', { id, is_deleted: 1 });
      }
      return _res;
    }
    const e = await idbGetById('expenses', id);
    if (!e) return { changes: 0 };
    return idbPut('expenses', { ...e, is_deleted: 1, id: e.id });
  };

  // ==================== BACKWARD COMPATIBILITY ALIASES ====================
  StorageClass.prototype.addExpenseCategory = async function(data) { return this.createExpenseCategory(data); };
  StorageClass.prototype.addExpense = async function(data) { return this.createExpense(data); };

}