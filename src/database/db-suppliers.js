// ============================================================
//  db-suppliers.js — Suppliers Module (Mixin)
//  FIXED: Payment linkage to purchases, account deduction on payment
// ============================================================

import { SYNC_ENABLED } from './core/config.js';
import { syncToCloud } from './core/sync.js';
import { idbGetAll, idbGetById, idbAdd, idbPut } from './core/idb-core.js';

export function attachSupplierMethods(StorageClass) {

  StorageClass.prototype.getSuppliers = async function() { 
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT * FROM suppliers WHERE is_deleted = 0 ORDER BY name");
    }
    return idbGetAll('suppliers').then(r => r.filter(x => !x.is_deleted));
  };

  StorageClass.prototype.getSupplierById = async function(id) { 
    if (this.mode === 'electron') { 
      const r = await this.electronQuery("SELECT * FROM suppliers WHERE id = ? AND is_deleted = 0", [id]);
      return r[0] || null;
    }
    const result = await idbGetById('suppliers', id);
    return result && !result.is_deleted ? result : null;
  };

  StorageClass.prototype.createSupplier = async function(data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`INSERT INTO suppliers (name, company_name, phone, email, vat_ntn_number, address, opening_balance, current_balance, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [data.name, data.company_name, data.phone, data.email, data.vat_ntn_number, data.address, data.opening_balance || 0, data.current_balance || 0, data.status || 'active']);
      if (SYNC_ENABLED) {
        await syncToCloud('suppliers', { ...data, id: _res.lastInsertRowid, is_deleted: 0 });
      }
      return _res;
    }
    return idbAdd('suppliers', { ...data, is_deleted: 0 });
  };

  StorageClass.prototype.updateSupplier = async function(id, data) { 
    if (this.mode === 'electron') {
      const fields = [];
      const values = [];

      if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
      if (data.company_name !== undefined) { fields.push('company_name = ?'); values.push(data.company_name); }
      if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone); }
      if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email); }
      if (data.vat_ntn_number !== undefined) { fields.push('vat_ntn_number = ?'); values.push(data.vat_ntn_number); }
      if (data.address !== undefined) { fields.push('address = ?'); values.push(data.address); }
      if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
      if (data.opening_balance !== undefined) { fields.push('opening_balance = ?'); values.push(data.opening_balance); }
      if (data.current_balance !== undefined) { fields.push('current_balance = ?'); values.push(data.current_balance); }

      if (fields.length === 0) return { changes: 0 };
      values.push(id);

      const _res = await this.electronQuery(`UPDATE suppliers SET ${fields.join(', ')} WHERE id = ?`, values);
      if (SYNC_ENABLED) {
        await syncToCloud('suppliers', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('suppliers', id);
    if (!e) return { changes: 0 };
    return idbPut('suppliers', { ...e, ...data, id: e.id });
  };

  StorageClass.prototype.deleteSupplier = async function(id) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE suppliers SET is_deleted = 1 WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        await syncToCloud('suppliers', { id, is_deleted: 1 });
      }
      return _res;
    }
    const e = await idbGetById('suppliers', id);
    if (!e) return { changes: 0 };
    return idbPut('suppliers', { ...e, is_deleted: 1, id: e.id });
  };

  StorageClass.prototype.updateSupplierBalance = async function(id, amt) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery("UPDATE suppliers SET current_balance = current_balance + ? WHERE id = ?", [amt, id]);
      if (SYNC_ENABLED) {
        await syncToCloud('suppliers', { id, balance_delta: amt });
      }
      return _res;
    }
    const supplier = await idbGetById('suppliers', id);
    if (!supplier) return { changes: 0 };
    supplier.current_balance = this.safeAdd(supplier.current_balance, amt);
    await idbPut('suppliers', { ...supplier, id: supplier.id });
    return { changes: 1 };
  };

  // ==================== FIXED: SUPPLIER PAYMENT ====================
  StorageClass.prototype.addSupplierPayment = async function(data) {
    const { supplier_id, amount, payment_mode = 'cash', note, date, purchase_id } = data;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) throw new Error('Invalid amount');

    // 1. Payment record save
    const payRes = await this.addPayment({
      supplier_id,
      purchase_id: purchase_id || null,
      amount: amt,
      type: 'payment',
      payment_mode,
      note,
      date: date || new Date().toISOString()
    });

    // 2. Supplier balance kam karo
    await this.updateSupplierBalance(supplier_id, -amt);

    // 3. Supplier ledger mein entry
    await this.addLedgerEntry({
      supplier_id,
      type: 'payment',
      amount: amt,
      description: note || `Payment via ${payment_mode}`,
      date: date || new Date().toISOString()
    });

    // 4. Account se paisa kato (bank/jazzcash/etc)
    if (this.deductFromAccount) {
      try {
        await this.deductFromAccount(
          payment_mode,
          amt,
          `Supplier Payment: ${supplier_id} — ${note || payment_mode}`,
          'supplier_payment',
          payRes.id || payRes.lastInsertRowid || null
        );
      } catch (accErr) {
        console.error('[Accounts] Deduction failed:', accErr);
        // Payment already saved, so we log warning but don't throw
      }
    }

    // 5. FIXED: Update purchase paid_amount & payment_status if linked
    if (purchase_id) {
      try {
        const purchase = await this.getPurchaseById(purchase_id);
        if (purchase) {
          const newPaid = this.safeAdd(Number(purchase.paid_amount || 0), amt);
          const grandTotal = Number(purchase.grand_total || 0);
          const newStatus = newPaid >= grandTotal ? 'paid' : newPaid > 0 ? 'partial' : 'due';
          await this.updatePurchase(purchase_id, {
            paid_amount: newPaid,
            payment_status: newStatus
          });
        }
      } catch (e) {
        console.warn('[addSupplierPayment] Failed to update purchase payment status:', e);
      }
    }

    return payRes;
  };

  // ==================== NEW: GET SUPPLIER PAYMENTS ====================
  StorageClass.prototype.getSupplierPayments = async function(supplierId, filters = {}) {
    if (this.mode === 'electron') {
      let sql = `SELECT * FROM supplier_payments WHERE supplier_id = ?`;
      const params = [supplierId];
      if (filters.purchase_id) {
        sql += ` AND purchase_id = ?`;
        params.push(filters.purchase_id);
      }
      if (filters.fromDate) {
        sql += ` AND DATE(date) >= DATE(?)`;
        params.push(filters.fromDate);
      }
      if (filters.toDate) {
        sql += ` AND DATE(date) <= DATE(?)`;
        params.push(filters.toDate);
      }
      sql += ` ORDER BY date DESC, id DESC`;
      return this.electronQuery(sql, params);
    }
    const all = await idbGetAll('supplier_payments');
    return all.filter(x => {
      if (x.supplier_id !== supplierId) return false;
      if (filters.purchase_id && x.purchase_id !== filters.purchase_id) return false;
      if (filters.fromDate && new Date(x.date) < new Date(filters.fromDate)) return false;
      if (filters.toDate && new Date(x.date) > new Date(filters.toDate)) return false;
      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  };

}