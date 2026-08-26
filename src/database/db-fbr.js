// ============================================================
//  db-fbr.js — FBR Integration Module (Mixin)
// ============================================================

import { SYNC_ENABLED } from './core/config.js';
import { syncToCloud } from './core/sync.js';
import { idbGetAll, idbGetById, idbAdd, idbPut } from './core/idb-core.js';

export function attachFBRMethods(StorageClass) {

  StorageClass.prototype.getFBRStatus = async function(saleId) {
    if (this.mode === 'electron') {
      const r = await this.electronQuery(
        "SELECT * FROM fbr_invoices WHERE sale_id = ? ORDER BY id DESC LIMIT 1",
        [saleId]
      );
      return r[0] || { fbr_status: 'PENDING' };
    }
    const all = await idbGetAll('fbr_invoices');
    return all.filter(x => String(x.sale_id) === String(saleId))
      .sort((a, b) => (b.id || 0) - (a.id || 0))[0] 
      || { fbr_status: 'PENDING' };
  };

  StorageClass.prototype.getPendingFBRInvoices = async function() {
    if (this.mode === 'electron') {
      return this.electronQuery(
        `SELECT fi.*, s.invoice_no, s.grand_total, s.customer_name, s.date 
         FROM fbr_invoices fi 
         JOIN sales s ON fi.sale_id = s.id 
         WHERE fi.fbr_status = 'PENDING' 
         ORDER BY fi.created_at ASC`
      );
    }
    const [fbrRecords, sales] = await Promise.all([
      idbGetAll('fbr_invoices'),
      idbGetAll('sales')
    ]);
    return fbrRecords
      .filter(x => x.fbr_status === 'PENDING')
      .map(r => {
        const sale = sales.find(s => String(s.id) === String(r.sale_id));
        return { ...r, ...sale };
      })
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  };

  StorageClass.prototype.getFBRInvoiceHistory = async function(limit = 50) {
    if (this.mode === 'electron') {
      return this.electronQuery(
        `SELECT fi.*, s.invoice_no, s.grand_total, s.customer_name 
         FROM fbr_invoices fi 
         JOIN sales s ON fi.sale_id = s.id 
         ORDER BY fi.created_at DESC 
         LIMIT ?`,
        [limit]
      );
    }
    const [fbrRecords, sales] = await Promise.all([
      idbGetAll('fbr_invoices'),
      idbGetAll('sales')
    ]);
    return fbrRecords
      .map(r => {
        const sale = sales.find(s => String(s.id) === String(r.sale_id));
        return { ...r, ...sale };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);
  };

  StorageClass.prototype.getFbrInvoiceBySaleId = async function(saleId) {
    if (this.mode === 'electron') {
      const r = await this.electronQuery(
        "SELECT * FROM fbr_invoices WHERE sale_id = ? ORDER BY id DESC LIMIT 1",
        [saleId]
      );
      return r[0] || null;
    }
    const all = await idbGetAll('fbr_invoices');
    return all.filter(x => String(x.sale_id) === String(saleId))
      .sort((a, b) => (b.id || 0) - (a.id || 0))[0] || null;
  };

  StorageClass.prototype.getFbrInvoiceById = async function(id) {
    if (this.mode === 'electron') {
      const r = await this.electronQuery(
        "SELECT * FROM fbr_invoices WHERE id = ?",
        [id]
      );
      return r[0] || null;
    }
    return idbGetById('fbr_invoices', id);
  };

  StorageClass.prototype.getFbrInvoices = async function(filters = {}) {
    if (this.mode === 'electron') {
      let sql = `
        SELECT fi.*, s.customer_name, s.grand_total, s.date 
        FROM fbr_invoices fi
        LEFT JOIN sales s ON fi.sale_id = s.id
      `;
      const params = [];
      const whereClauses = [];
      
      if (filters.status) {
        whereClauses.push("fi.fbr_status = ?");
        params.push(filters.status);
      }
      if (filters.fromDate) {
        whereClauses.push("fi.created_at >= ?");
        params.push(filters.fromDate);
      }
      if (filters.toDate) {
        whereClauses.push("fi.created_at <= ?");
        params.push(filters.toDate);
      }
      if (filters.invoiceNo) {
        whereClauses.push("fi.invoice_no LIKE ?");
        params.push('%' + filters.invoiceNo + '%');
      }
      
      if (whereClauses.length > 0) {
        sql += " WHERE " + whereClauses.join(" AND ");
      }
      
      sql += " ORDER BY fi.created_at DESC";
      
      return this.electronQuery(sql, params);
    }
    
    const [fbrRecords, sales] = await Promise.all([
      idbGetAll('fbr_invoices'),
      idbGetAll('sales')
    ]);
    
    let results = fbrRecords.map(r => {
      const sale = sales.find(s => String(s.id) === String(r.sale_id));
      return { ...r, ...sale };
    });
    
    if (filters.status) {
      results = results.filter(r => r.fbr_status === filters.status);
    }
    if (filters.fromDate) {
      const from = new Date(filters.fromDate);
      results = results.filter(r => new Date(r.created_at) >= from);
    }
    if (filters.toDate) {
      const to = new Date(filters.toDate);
      results = results.filter(r => new Date(r.created_at) <= to);
    }
    if (filters.invoiceNo) {
      const search = filters.invoiceNo.toLowerCase();
      results = results.filter(r => r.invoice_no?.toLowerCase().includes(search));
    }
    
    return results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  };

  StorageClass.prototype.updateFbrInvoice = async function(id, data) {
    if (this.mode === 'electron') {
      const fields = [];
      const values = [];
      
      const allowedFields = [
        'fbr_status', 'fbr_reference', 'fbr_qr_code', 'error_message',
        'fbr_response', 'retry_count', 'synced_at', 'last_retry_at',
        'fbr_tax_rate', 'fbr_tax_amount'
      ];
      
      Object.keys(data).forEach(key => {
        if (allowedFields.includes(key) && data[key] !== undefined) {
          fields.push(key + ' = ?');
          values.push(data[key]);
        }
      });
      
      if (fields.length === 0) return { changes: 0 };
      
      values.push(id);
      const result = await this.electronQuery(
        `UPDATE fbr_invoices SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
      
      if (data.fbr_status || data.fbr_reference) {
        const fbr = await this.electronQuery(
          "SELECT sale_id FROM fbr_invoices WHERE id = ?",
          [id]
        );
        if (fbr && fbr.length > 0) {
          const updates = [];
          const updateValues = [];
          if (data.fbr_status) {
            updates.push('fbr_status = ?');
            updateValues.push(data.fbr_status);
          }
          if (data.fbr_reference) {
            updates.push('fbr_reference = ?');
            updateValues.push(data.fbr_reference);
          }
          if (data.fbr_status === 'SYNCED' || data.synced_at) {
            updates.push('fbr_synced_at = ?');
            updateValues.push(data.synced_at || new Date().toISOString());
          }
          if (data.fbr_tax_rate !== undefined) {
            updates.push('fbr_tax_rate = ?');
            updateValues.push(data.fbr_tax_rate);
          }
          if (data.fbr_tax_amount !== undefined) {
            updates.push('fbr_tax_amount = ?');
            updateValues.push(data.fbr_tax_amount);
          }
          
          if (updates.length > 0) {
            updateValues.push(fbr[0].sale_id);
            await this.electronQuery(
              `UPDATE sales SET ${updates.join(', ')} WHERE id = ?`,
              updateValues
            );
          }
        }
      }
      
      return result;
    }
    
    const existing = await idbGetById('fbr_invoices', id);
    if (!existing) return { changes: 0 };
    
    const updated = { ...existing, ...data };
    await idbPut('fbr_invoices', updated);
    
    if (data.fbr_status || data.fbr_reference) {
      const sale = await idbGetById('sales', existing.sale_id);
      if (sale) {
        if (data.fbr_status) sale.fbr_status = data.fbr_status;
        if (data.fbr_reference) sale.fbr_reference = data.fbr_reference;
        if (data.fbr_status === 'SYNCED' || data.synced_at) {
          sale.fbr_synced_at = data.synced_at || new Date().toISOString();
        }
        if (data.fbr_tax_rate !== undefined) sale.fbr_tax_rate = data.fbr_tax_rate;
        if (data.fbr_tax_amount !== undefined) sale.fbr_tax_amount = data.fbr_tax_amount;
        await idbPut('sales', sale);
      }
    }
    
    return { changes: 1 };
  };

  StorageClass.prototype.getFbrStats = async function() {
    if (this.mode === 'electron') {
      const stats = await this.electronQuery(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN fbr_status = 'PENDING' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN fbr_status = 'SYNCED' THEN 1 ELSE 0 END) as synced,
          SUM(CASE WHEN fbr_status = 'FAILED' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN fbr_status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled,
          SUM(CASE WHEN fbr_status = 'MANUAL' THEN 1 ELSE 0 END) as manual,
          SUM(CASE WHEN DATE(synced_at) = DATE('now') THEN 1 ELSE 0 END) as todaySynced
         FROM fbr_invoices`
      );
      return stats[0] || { total: 0, pending: 0, synced: 0, failed: 0, cancelled: 0, manual: 0, todaySynced: 0 };
    }
    
    const all = await idbGetAll('fbr_invoices');
    const today = new Date().toISOString().split('T')[0];
    
    return {
      total: all.length,
      pending: all.filter(x => x.fbr_status === 'PENDING').length,
      synced: all.filter(x => x.fbr_status === 'SYNCED').length,
      failed: all.filter(x => x.fbr_status === 'FAILED').length,
      cancelled: all.filter(x => x.fbr_status === 'CANCELLED').length,
      manual: all.filter(x => x.fbr_status === 'MANUAL').length,
      todaySynced: all.filter(x => 
        x.fbr_status === 'SYNCED' && 
        x.synced_at?.startsWith(today)
      ).length
    };
  };

  StorageClass.prototype.queueFBRInvoice = async function(saleId, invoiceNo) {
    if (this.mode === 'electron') {
      return this.electronQuery(
        `INSERT INTO fbr_invoices (sale_id, invoice_no, fbr_status, retry_count, max_retries, created_at) 
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [saleId, invoiceNo, 'PENDING', 0, 10]
      );
    }
    return idbAdd('fbr_invoices', {
      sale_id: saleId,
      invoice_no: invoiceNo,
      fbr_status: 'PENDING',
      retry_count: 0,
      max_retries: 10,
      created_at: new Date().toISOString(),
    });
  };

  StorageClass.prototype.cancelFBRInvoice = async function(saleId) {
    if (this.mode === 'electron') {
      await this.electronQuery(
        `UPDATE fbr_invoices 
         SET fbr_status = 'CANCELLED', error_message = 'Sale deleted by user' 
         WHERE sale_id = ? AND fbr_status = 'PENDING'`,
        [saleId]
      );
      await this.electronQuery(
        `UPDATE sales SET fbr_status = 'CANCELLED' WHERE id = ?`,
        [saleId]
      );
      return { success: true };
    }
    const all = await idbGetAll('fbr_invoices');
    const record = all.find(x => String(x.sale_id) === String(saleId) && x.fbr_status === 'PENDING');
    if (record) {
      record.fbr_status = 'CANCELLED';
      record.error_message = 'Sale deleted by user';
      await idbPut('fbr_invoices', record);
      
      const sale = await idbGetById('sales', saleId);
      if (sale) {
        sale.fbr_status = 'CANCELLED';
        await idbPut('sales', sale);
      }
    }
    return { success: true };
  };

}