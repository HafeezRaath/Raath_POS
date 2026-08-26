// ============================================================
//  db-payments.js — Payments & Supplier Ledger Module (Mixin)
// ============================================================

import { SYNC_ENABLED } from './core/config.js';
import { syncToCloud } from './core/sync.js';
import { idbGetAll, idbGetById, idbAdd, idbPut } from './core/idb-core.js';


export function attachPaymentMethods(StorageClass) {

  // ==================== GET PAYMENTS (with supplier & customer names) ====================
  StorageClass.prototype.getPayments = async function() { 
    if (this.mode === 'electron') {
      return this.electronQuery(
        `SELECT p.*, s.name as supplier_name, c.name as customer_name 
         FROM payments p 
         LEFT JOIN suppliers s ON p.supplier_id = s.id 
         LEFT JOIN customers c ON p.customer_id = c.id 
         WHERE p.is_deleted = 0 OR p.is_deleted IS NULL 
         ORDER BY p.id DESC`
      );
    }
    const [payments, suppliers, customers] = await Promise.all([
      idbGetAll('payments'),
      idbGetAll('suppliers'),
      idbGetAll('customers')
    ]);
    return payments.filter(p => !p.is_deleted).map(p => ({
      ...p,
      supplier_name: suppliers.find(s => s.id === p.supplier_id)?.name || '',
      customer_name: customers.find(c => c.id === p.customer_id)?.name || ''
    }));
  };
  
  // ==================== ADD PAYMENT ====================
  StorageClass.prototype.addPayment = async function(data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        `INSERT INTO payments (supplier_id, customer_id, amount, type, payment_mode, note, date) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`, 
        [
          data.supplier_id, data.customer_id, data.amount, 
          data.type, data.payment_mode, data.note, data.date
        ]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('payments', { ...data, id: _res.lastInsertRowid });
      }
      return _res;
    }
    return idbAdd('payments', data);
  };
  
  // ==================== UPDATE PAYMENT ====================
  StorageClass.prototype.updatePayment = async function(id, data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        `UPDATE payments SET 
          supplier_id = ?, customer_id = ?, amount = ?, type = ?, 
          payment_mode = ?, note = ?, date = ? 
         WHERE id = ?`, 
        [
          data.supplier_id, data.customer_id, data.amount, data.type, 
          data.payment_mode, data.note, data.date, id
        ]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('payments', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('payments', id);
    if (!e) return { changes: 0 };
    return idbPut('payments', { ...e, ...data, id: e.id });
  };
  
  // ==================== DELETE PAYMENT (Soft) ====================
  StorageClass.prototype.deletePayment = async function(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        "UPDATE payments SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?", 
        [id]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('payments', { 
          id, 
          is_deleted: 1, 
          deleted_at: new Date().toISOString() 
        });
      }
      return _res;
    }
    const e = await idbGetById('payments', id);
    if (!e) return { changes: 0 };
    return idbPut('payments', { ...e, is_deleted: 1, id: e.id });
  };

  // ==================== GET SUPPLIER LEDGER ====================
  StorageClass.prototype.getLedger = async function() { 
    if (this.mode === 'electron') {
      return this.electronQuery(
        `SELECT l.*, s.name as supplier_name 
         FROM ledger l 
         LEFT JOIN suppliers s ON l.supplier_id = s.id 
         ORDER BY l.id DESC`
      );
    }
    const [ledger, suppliers] = await Promise.all([
      idbGetAll('ledger'),
      idbGetAll('suppliers')
    ]);
    return ledger.map(l => ({
      ...l,
      supplier_name: suppliers.find(s => s.id === l.supplier_id)?.name || ''
    }));
  };
  
  // ==================== ADD LEDGER ENTRY ====================
  StorageClass.prototype.addLedgerEntry = async function(data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        `INSERT INTO ledger (supplier_id, type, amount, description, date) 
         VALUES (?, ?, ?, ?, ?)`, 
        [data.supplier_id, data.type, data.amount, data.description, data.date]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('ledger', { ...data, id: _res.lastInsertRowid });
      }
      return _res;
    }
    return idbAdd('ledger', data);
  };

}