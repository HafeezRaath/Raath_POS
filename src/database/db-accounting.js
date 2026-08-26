// ============================================================
//  db-accounting.js — General Ledger & Financial Reports (Mixin)
//  FIXED: Removed getGeneralLedger (db-accounts.js handles it)
//  FIXED: logToGeneralLedger now includes account_id, date, payment_mode
//  FIXED: syncToCloud uses result.id (not lastInsertRowid) for IDB
// ============================================================

import { SYNC_ENABLED } from './core/config.js';
import { syncToCloud } from './core/sync.js';
import { idbGetAll, idbGetById, idbAdd, idbPut, idbDelete } from './core/idb-core.js';

export function attachAccountingMethods(StorageClass) {

  // ==================== GENERAL LEDGER ====================
  // ❌ REMOVED: getGeneralLedger — db-accounts.js ka version use hoga

  StorageClass.prototype.getGeneralLedgerByAccountType = async function(accountType) { 
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT * FROM general_ledger WHERE account_type = ? ORDER BY date DESC", [accountType]);
    }
    return idbGetAll('general_ledger').then(r => r.filter(x => x.account_type === accountType));
  };

  // ✅ FIXED: account_id + date + payment_mode added
  StorageClass.prototype.logToGeneralLedger = async function(accountType, referenceId, debit, credit, description, accountId = null, paymentMode = 'other') { 
    const date = new Date().toISOString();
    
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        `INSERT INTO general_ledger (account_type, account_id, reference_id, debit, credit, description, date, payment_mode) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
        [accountType, accountId, referenceId, debit, credit, description, date, paymentMode]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('general_ledger', { 
          account_type: accountType,
          account_id: accountId,
          reference_id: referenceId,
          debit, 
          credit, 
          description,
          date,
          payment_mode: paymentMode,
          id: _res.lastInsertRowid 
        });
      }
      return _res;
    }
    
    const result = await idbAdd('general_ledger', {
      account_type: accountType,
      account_id: accountId,
      reference_id: referenceId,
      debit: debit,
      credit: credit,
      description: description,
      date: date,
      payment_mode: paymentMode
    });
    
    if (SYNC_ENABLED) {
      await syncToCloud('general_ledger', { 
        account_type: accountType,
        account_id: accountId,
        reference_id: referenceId,
        debit, 
        credit, 
        description,
        date,
        payment_mode: paymentMode,
        id: result.id  // ← FIXED: result.id (not lastInsertRowid)
      });
    }
    return result;
  };

  StorageClass.prototype.updateGeneralLedgerEntry = async function(id, data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        "UPDATE general_ledger SET account_type = ?, account_id = ?, reference_id = ?, debit = ?, credit = ?, description = ?, payment_mode = ? WHERE id = ?", 
        [data.account_type, data.account_id, data.reference_id, data.debit, data.credit, data.description, data.payment_mode, id]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('general_ledger', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('general_ledger', id);
    if (!e) return { changes: 0 };
    return idbPut('general_ledger', { ...e, ...data, id: e.id });
  };

  StorageClass.prototype.deleteGeneralLedgerEntry = async function(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("DELETE FROM general_ledger WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        await syncToCloud('general_ledger', id, 'remove');
      }
      return _res;
    }
    return idbDelete('general_ledger', id);
  };

  // ==================== FINANCIAL REPORTS ====================
  StorageClass.prototype.getProfitLossReport = async function(dateFrom, dateTo) {
    if (this.mode === 'electron') {
      const s = await this.electronQuery(`SELECT COALESCE(SUM(si.total), 0) as rev, COALESCE(SUM(si.quantity * pv.purchase_price), 0) as cogs FROM sale_items si JOIN sales s ON si.sale_id = s.id JOIN product_variants pv ON si.product_variant_id = pv.id WHERE s.is_deleted = 0 AND DATE(s.date) BETWEEN DATE(?) AND DATE(?)`, [dateFrom, dateTo]);
      const e = await this.electronQuery(`SELECT COALESCE(SUM(amount), 0) as exp FROM expenses WHERE is_deleted = 0 AND DATE(date) BETWEEN DATE(?) AND DATE(?)`, [dateFrom, dateTo]);
      return { revenue: s[0].rev, cogs: s[0].cogs, grossProfit: this.safeSub(s[0].rev, s[0].cogs), expenses: e[0].exp, netProfit: this.safeSub(this.safeSub(s[0].rev, s[0].cogs), e[0].exp) };
    }
    const [items, sales, variants, expenses] = await Promise.all([
      idbGetAll('sale_items'),
      idbGetAll('sales'),
      idbGetAll('product_variants'),
      idbGetAll('expenses')
    ]);
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    
    const validSales = sales.filter(s => !s.is_deleted);
    const validSaleIds = new Set(validSales.map(s => String(s.id)));
    
    let revenue = 0, cogs = 0;
    for (const item of items) {
      if (!validSaleIds.has(String(item.sale_id))) continue;
      const sale = validSales.find(s => String(s.id) === String(item.sale_id));
      if (!sale) continue;
      const saleDate = new Date(sale.date);
      if (saleDate < from || saleDate > to) continue;
      revenue += Number(item.total || 0);
      const v = variants.find(x => x.id === item.product_variant_id);
      cogs += Number(item.quantity || 0) * Number(v?.purchase_price || 0);
    }
    
    const totalExpenses = expenses
      .filter(e => !e.is_deleted)
      .filter(e => {
        const d = new Date(e.date);
        return d >= from && d <= to;
      })
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
    
    return { 
      revenue, 
      cogs, 
      grossProfit: this.safeSub(revenue, cogs), 
      expenses: totalExpenses, 
      netProfit: this.safeSub(this.safeSub(revenue, cogs), totalExpenses) 
    };
  };

  StorageClass.prototype.getBalanceSheet = async function() {
    if (this.mode === 'electron') {
      const s = await this.electronQuery("SELECT COALESCE(SUM(current_stock * purchase_price), 0) as val FROM product_variants WHERE is_deleted = 0");
      const c = await this.electronQuery("SELECT (COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0)) as val FROM general_ledger WHERE account_type IN ('cash', 'bank')");
      const r = await this.electronQuery("SELECT COALESCE(SUM(current_balance), 0) as val FROM customers WHERE is_deleted = 0 AND current_balance > 0");
      const p = await this.electronQuery("SELECT COALESCE(SUM(current_balance), 0) as val FROM suppliers WHERE is_deleted = 0 AND current_balance > 0");
      const cashVal = c[0].val >= 0 ? c[0].val : 0;
      const totalAssets = this.safeAdd(this.safeAdd(s[0].val, cashVal), r[0].val);
      const totalLiabilities = p[0].val;
      const equity = this.safeSub(totalAssets, totalLiabilities);
      return { assets: { inventory_valuation: s[0].val, cash_and_bank: cashVal, accounts_receivable: r[0].val }, liabilities: { accounts_payable: p[0].val }, equity: { total: equity, retained_earnings: equity, owner_capital: 0 }, totalAssets, totalLiabilities, totalEquity: equity };
    }
    const [variants, ledger, customers, suppliers] = await Promise.all([
      idbGetAll('product_variants'),
      idbGetAll('general_ledger'),
      idbGetAll('customers'),
      idbGetAll('suppliers')
    ]);
    
    const inventoryVal = variants
      .filter(v => !v.is_deleted)
      .reduce((sum, v) => sum + (Number(v.current_stock || 0) * Number(v.purchase_price || 0)), 0);
    
    const cashLedger = ledger.filter(l => ['cash', 'bank'].includes(l.account_type));
    const cashVal = cashLedger.reduce((sum, l) => sum + (Number(l.debit || 0) - Number(l.credit || 0)), 0);
    const accountsReceivable = customers
      .filter(c => !c.is_deleted && Number(c.current_balance || 0) > 0)
      .reduce((sum, c) => sum + Number(c.current_balance || 0), 0);
    const accountsPayable = suppliers
      .filter(s => !s.is_deleted && Number(s.current_balance || 0) > 0)
      .reduce((sum, s) => sum + Number(s.current_balance || 0), 0);
    
    const totalAssets = this.safeAdd(this.safeAdd(inventoryVal, Math.max(0, cashVal)), accountsReceivable);
    const totalLiabilities = accountsPayable;
    const equity = this.safeSub(totalAssets, totalLiabilities);
    
    return {
      assets: { inventory_valuation: inventoryVal, cash_and_bank: Math.max(0, cashVal), accounts_receivable: accountsReceivable },
      liabilities: { accounts_payable: accountsPayable },
      equity: { total: equity, retained_earnings: equity, owner_capital: 0 },
      totalAssets,
      totalLiabilities,
      totalEquity: equity
    };
  };

  StorageClass.prototype.getTrialBalance = async function() {
    if (this.mode === 'electron') {
      const rows = await this.electronQuery(`SELECT account_type, COALESCE(SUM(debit), 0) as total_debit, COALESCE(SUM(credit), 0) as total_credit FROM general_ledger GROUP BY account_type`);
      return rows;
    }
    const ledger = await idbGetAll('general_ledger');
    const grouped = {};
    for (const entry of ledger) {
      const type = entry.account_type;
      if (!grouped[type]) {
        grouped[type] = { account_type: type, total_debit: 0, total_credit: 0 };
      }
      grouped[type].total_debit += Number(entry.debit || 0);
      grouped[type].total_credit += Number(entry.credit || 0);
    }
    return Object.values(grouped);
  };

}