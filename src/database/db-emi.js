// ============================================================
//  db-emi.js — EMI Records & Payments Module (Mixin)
// ============================================================

import { SYNC_ENABLED } from './core/config.js';
import { syncToCloud } from './core/sync.js';
import { idbGetAll, idbGetById, idbAdd, idbPut, idbDelete } from './core/idb-core.js';

export function attachEMIMethods(StorageClass) {

  // ==================== GET ALL EMI RECORDS ====================
  StorageClass.prototype.getEMIs = async function() { 
    if (this.mode === 'electron') {
      return this.electronQuery(
        `SELECT e.*, c.name as customer_name 
         FROM emi_records e 
         LEFT JOIN customers c ON e.customer_id = c.id 
         WHERE e.is_deleted = 0 
         ORDER BY e.id DESC`
      );
    }
    return idbGetAll('emis').then(r => r.filter(x => !x.is_deleted));
  };
  
  // ==================== CREATE EMI ====================
  StorageClass.prototype.createEMI = async function(emi) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        `INSERT INTO emi_records (
          customer_id, product_name, total_amount, down_payment, 
          emi_amount, interest_rate, total_months, paid_months, 
          start_date, next_due_date, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
        [
          emi.customer_id, emi.product_name, emi.total_amount, emi.down_payment, 
          emi.emi_amount, emi.interest_rate, emi.total_months, 0, 
          emi.start_date, emi.next_due_date, 'active'
        ]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('emis', { ...emi, id: _res.lastInsertRowid });
      }
      return _res;
    }
    return idbAdd('emis', { ...emi, is_deleted: 0 });
  };
  
  // ==================== UPDATE EMI ====================
  StorageClass.prototype.updateEMI = async function(id, data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        `UPDATE emi_records SET 
          customer_id = ?, product_name = ?, total_amount = ?, down_payment = ?, 
          emi_amount = ?, interest_rate = ?, total_months = ?, paid_months = ?, 
          start_date = ?, next_due_date = ?, status = ? 
         WHERE id = ?`, 
        [
          data.customer_id, data.product_name, data.total_amount, data.down_payment, 
          data.emi_amount, data.interest_rate, data.total_months, data.paid_months, 
          data.start_date, data.next_due_date, data.status, id
        ]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('emis', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('emis', id);
    if (!e) return { changes: 0 };
    return idbPut('emis', { ...e, ...data, id: e.id });
  };
  
  // ==================== DELETE EMI (Soft) ====================
  StorageClass.prototype.deleteEMI = async function(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        "UPDATE emi_records SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?", 
        [id]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('emis', { 
          id, 
          is_deleted: 1, 
          deleted_at: new Date().toISOString() 
        });
      }
      return _res;
    }
    const e = await idbGetById('emis', id);
    if (!e) return { changes: 0 };
    return idbPut('emis', { ...e, is_deleted: 1, id: e.id });
  };
  
  // ==================== ADD EMI PAYMENT ====================
  StorageClass.prototype.addEMIPayment = async function(payment) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        `INSERT INTO emi_payments (emi_id, amount, payment_date, payment_mode, notes) 
         VALUES (?, ?, ?, ?, ?)`, 
        [payment.emi_id, payment.amount, payment.payment_date, payment.payment_mode, payment.notes]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('emi_payments', { ...payment, id: _res.lastInsertRowid });
      }
      return _res;
    }
    return idbAdd('emi_payments', payment);
  };
  
  // ==================== GET EMI PAYMENTS ====================
  StorageClass.prototype.getEMIPayments = async function(emiId) { 
    if (this.mode === 'electron') {
      return this.electronQuery(
        "SELECT * FROM emi_payments WHERE emi_id = ? ORDER BY id DESC", 
        [emiId]
      );
    }
    return idbGetAll('emi_payments').then(res => 
      res.filter(p => p.emi_id === Number(emiId))
    );
  };
  
  // ==================== UPDATE EMI PAYMENT ====================
  StorageClass.prototype.updateEMIPayment = async function(id, data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        `UPDATE emi_payments SET 
          emi_id = ?, amount = ?, payment_date = ?, payment_mode = ?, notes = ? 
         WHERE id = ?`, 
        [data.emi_id, data.amount, data.payment_date, data.payment_mode, data.notes, id]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('emi_payments', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('emi_payments', id);
    if (!e) return { changes: 0 };
    return idbPut('emi_payments', { ...e, ...data, id: e.id });
  };
  
  // ==================== DELETE EMI PAYMENT (Hard) ====================
  StorageClass.prototype.deleteEMIPayment = async function(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        "DELETE FROM emi_payments WHERE id = ?", 
        [id]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('emi_payments', id, 'remove');
      }
      return _res;
    }
    return idbDelete('emi_payments', id);
  };

}