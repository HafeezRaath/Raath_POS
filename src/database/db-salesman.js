// ============================================================
//  db-salesman.js — Salesmen, Salesman Sales & Stats Module (Mixin)
// ============================================================

import { SYNC_ENABLED } from './core/config.js';
import { syncToCloud } from './core/sync.js';
import { idbGetAll, idbGetById, idbAdd, idbPut, idbTransaction } from './core/idb-core.js';
import { generateId } from './core/utils.js';

export function attachSalesmanMethods(StorageClass) {

  StorageClass.prototype.getAllSalesmen = async function() {
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT * FROM salesmen WHERE is_deleted = 0 ORDER BY name");
    }
    return idbGetAll('salesmen').then(r => r.filter(x => !x.is_deleted));
  };

  StorageClass.prototype.getSalesmanById = async function(id) {
    if (this.mode === 'electron') {
      const r = await this.electronQuery("SELECT * FROM salesmen WHERE id = ? AND is_deleted = 0", [id]);
      return r[0] || null;
    }
    const result = await idbGetById('salesmen', id);
    return result && !result.is_deleted ? result : null;
  };

  StorageClass.prototype.addSalesman = async function(data) {
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        `INSERT INTO salesmen (name, phone, cnic, address, joining_date, target_amount, commission_percent, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.name,
          data.phone || '',
          data.cnic || '',
          data.address || '',
          data.joining_date || new Date().toISOString().split('T')[0],
          data.target_amount || 0,
          data.commission_percent || 0,
          data.status || 'active'
        ]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('salesmen', { ...data, id: _res.lastInsertRowid, is_deleted: 0 });
      }
      return _res;
    }
    return idbAdd('salesmen', { ...data, is_deleted: 0 });
  };

  StorageClass.prototype.updateSalesman = async function(id, data) {
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        `UPDATE salesmen SET 
          name = ?, phone = ?, cnic = ?, address = ?, 
          joining_date = ?, target_amount = ?, commission_percent = ?, 
          status = ?, updated_at = datetime('now')
         WHERE id = ? AND is_deleted = 0`,
        [
          data.name,
          data.phone || '',
          data.cnic || '',
          data.address || '',
          data.joining_date || new Date().toISOString().split('T')[0],
          data.target_amount || 0,
          data.commission_percent || 0,
          data.status || 'active',
          id
        ]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('salesmen', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('salesmen', id);
    if (!e) return { changes: 0 };
    return idbPut('salesmen', { ...e, ...data, updated_at: new Date().toISOString(), id: e.id });
  };

  StorageClass.prototype.deleteSalesman = async function(id) {
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(
        "UPDATE salesmen SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?",
        [id]
      );
      if (SYNC_ENABLED) {
        await syncToCloud('salesmen', { id, is_deleted: 1, deleted_at: new Date().toISOString() });
      }
      return _res;
    }
    const e = await idbGetById('salesmen', id);
    if (!e) return { changes: 0 };
    return idbPut('salesmen', { ...e, is_deleted: 1, deleted_at: new Date().toISOString(), id: e.id });
  };

  // ==================== SALESMAN SALES ====================
  StorageClass.prototype.addSalesmanSale = async function(data) {
    if (this.mode === 'electron') {
      return this.electronTransaction(async () => {
        const salesman = await this.electronQuery(
          "SELECT commission_percent FROM salesmen WHERE id = ? AND is_deleted = 0",
          [data.salesman_id]
        );
        
        const commissionRate = salesman[0]?.commission_percent || 0;
        const commissionAmount = (data.grand_total || 0) * (commissionRate / 100);
        
        const saleResult = await this.electronQuery(
          `INSERT INTO salesman_sales (
            salesman_id, customer_id, customer_name, location, sale_date, status,
            subtotal, discount, tax, shipping, grand_total,
            payment_mode, payment_term, payment_term_type,
            paid_amount, due_amount, note, commission_amount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            data.salesman_id,
            data.customer_id || null,
            data.customer_name || '',
            data.location || 'Main Branch',
            data.sale_date || new Date().toISOString().split('T')[0],
            data.status || 'Pending',
            data.subtotal || 0,
            data.discount || 0,
            data.tax || 0,
            data.shipping || 0,
            data.grand_total || 0,
            data.payment_mode || 'Cash',
            data.payment_term || 0,
            data.payment_term_type || 'Days',
            data.paid_amount || 0,
            data.due_amount || 0,
            data.note || '',
            commissionAmount
          ]
        );
        
        const saleId = saleResult.lastInsertRowid;
        
        if (data.items && Array.isArray(data.items)) {
          for (const item of data.items) {
            await this.electronQuery(
              `INSERT INTO salesman_sale_items (
                sale_id, product_variant_id, product_id, product_name, sku, quantity, price, total
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                saleId,
                item.product_variant_id || null,
                item.product_id || null,
                item.product_name || '',
                item.sku || '',
                item.quantity || 0,
                item.price || 0,
                item.total || 0
              ]
            );
          }
        }
        
        if (data.customer_id) {
          await this.electronQuery(
            `INSERT INTO customer_sales_history (
              customer_id, sale_id, salesman_id, total_amount, paid_amount, due_amount, sale_date, payment_mode
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              data.customer_id,
              saleId,
              data.salesman_id,
              data.grand_total || 0,
              data.paid_amount || 0,
              data.due_amount || 0,
              data.sale_date || new Date().toISOString().split('T')[0],
              data.payment_mode || 'Cash'
            ]
          );
        }
        
        if (SYNC_ENABLED) {
          await syncToCloud('salesman_sales', { ...data, id: saleId, commission_amount: commissionAmount });
        }
        
        return { id: saleId, commission: commissionAmount };
      });
    }
    
    return idbTransaction(['salesman_sales', 'salesman_sale_items', 'customer_sales_history'], async (tx) => {
      const saleStore = tx.objectStore('salesman_sales');
      const itemStore = tx.objectStore('salesman_sale_items');
      const historyStore = tx.objectStore('customer_sales_history');
      
      const salesmen = await idbGetAll('salesmen');
      const salesman = salesmen.find(s => String(s.id) === String(data.salesman_id) && !s.is_deleted);
      const commissionRate = salesman?.commission_percent || 0;
      const commissionAmount = (data.grand_total || 0) * (commissionRate / 100);
      
      const saleId = generateId();
      const saleData = {
        id: saleId,
        salesman_id: data.salesman_id,
        customer_id: data.customer_id || null,
        customer_name: data.customer_name || '',
        location: data.location || 'Main Branch',
        sale_date: data.sale_date || new Date().toISOString().split('T')[0],
        status: data.status || 'Pending',
        subtotal: data.subtotal || 0,
        discount: data.discount || 0,
        tax: data.tax || 0,
        shipping: data.shipping || 0,
        grand_total: data.grand_total || 0,
        payment_mode: data.payment_mode || 'Cash',
        payment_term: data.payment_term || 0,
        payment_term_type: data.payment_term_type || 'Days',
        paid_amount: data.paid_amount || 0,
        due_amount: data.due_amount || 0,
        note: data.note || '',
        commission_amount: commissionAmount,
        is_deleted: 0,
        created_at: new Date().toISOString()
      };
      
      await new Promise((resolve, reject) => {
        const r = saleStore.add(saleData);
        r.onsuccess = resolve;
        r.onerror = () => reject(r.error);
      });
      
      if (data.items && Array.isArray(data.items)) {
        for (const item of data.items) {
          const itemData = {
            sale_id: saleId,
            product_variant_id: item.product_variant_id || null,
            product_id: item.product_id || null,
            product_name: item.product_name || '',
            sku: item.sku || '',
            quantity: item.quantity || 0,
            price: item.price || 0,
            total: item.total || 0
          };
          await new Promise((resolve, reject) => {
            const r = itemStore.add(itemData);
            r.onsuccess = resolve;
            r.onerror = () => reject(r.error);
          });
        }
      }
      
      if (data.customer_id) {
        const historyData = {
          customer_id: data.customer_id,
          sale_id: saleId,
          salesman_id: data.salesman_id,
          total_amount: data.grand_total || 0,
          paid_amount: data.paid_amount || 0,
          due_amount: data.due_amount || 0,
          sale_date: data.sale_date || new Date().toISOString().split('T')[0],
          payment_mode: data.payment_mode || 'Cash'
        };
        await new Promise((resolve, reject) => {
          const r = historyStore.add(historyData);
          r.onsuccess = resolve;
          r.onerror = () => reject(r.error);
        });
      }
      
      if (SYNC_ENABLED) {
        await syncToCloud('salesman_sales', saleData);
      }
      
      return { id: saleId, commission: commissionAmount };
    });
  };

  StorageClass.prototype.getSalesmanSales = async function(filters = {}) {
    if (this.mode === 'electron') {
      let sql = `
        SELECT ss.*, s.name as salesman_name, s.commission_percent,
               c.name as customer_name_full
        FROM salesman_sales ss
        LEFT JOIN salesmen s ON ss.salesman_id = s.id
        LEFT JOIN customers c ON ss.customer_id = c.id
        WHERE ss.is_deleted = 0
      `;
      const params = [];
      
      if (filters.salesman_id) {
        sql += " AND ss.salesman_id = ?";
        params.push(filters.salesman_id);
      }
      if (filters.customer_id) {
        sql += " AND ss.customer_id = ?";
        params.push(filters.customer_id);
      }
      if (filters.start_date) {
        sql += " AND DATE(ss.sale_date) >= DATE(?)";
        params.push(filters.start_date);
      }
      if (filters.end_date) {
        sql += " AND DATE(ss.sale_date) <= DATE(?)";
        params.push(filters.end_date);
      }
      if (filters.status) {
        sql += " AND ss.status = ?";
        params.push(filters.status);
      }
      
      sql += " ORDER BY ss.id DESC";
      
      return this.electronQuery(sql, params);
    }
    
    let sales = await idbGetAll('salesman_sales');
    sales = sales.filter(x => !x.is_deleted);
    
    if (filters.salesman_id) {
      sales = sales.filter(x => String(x.salesman_id) === String(filters.salesman_id));
    }
    if (filters.customer_id) {
      sales = sales.filter(x => String(x.customer_id) === String(filters.customer_id));
    }
    if (filters.start_date) {
      const start = new Date(filters.start_date);
      sales = sales.filter(x => new Date(x.sale_date) >= start);
    }
    if (filters.end_date) {
      const end = new Date(filters.end_date);
      sales = sales.filter(x => new Date(x.sale_date) <= end);
    }
    if (filters.status) {
      sales = sales.filter(x => x.status === filters.status);
    }
    
    const [salesmen, customers] = await Promise.all([
      idbGetAll('salesmen'),
      idbGetAll('customers')
    ]);
    
    return sales.map(s => ({
      ...s,
      salesman_name: salesmen.find(m => String(m.id) === String(s.salesman_id))?.name || '',
      commission_percent: salesmen.find(m => String(m.id) === String(s.salesman_id))?.commission_percent || 0,
      customer_name_full: customers.find(c => String(c.id) === String(s.customer_id))?.name || ''
    }));
  };

  StorageClass.prototype.getSalesmanSaleItems = async function(saleId) {
    if (this.mode === 'electron') {
      return this.electronQuery(
        "SELECT * FROM salesman_sale_items WHERE sale_id = ?",
        [saleId]
      );
    }
    const items = await idbGetAll('salesman_sale_items');
    return items.filter(x => String(x.sale_id) === String(saleId));
  };

  StorageClass.prototype.getSalesmanStats = async function(salesmanId) {
    if (this.mode === 'electron') {
      const stats = await this.electronQuery(
        `SELECT 
          COUNT(*) as total_sales,
          COALESCE(SUM(grand_total), 0) as total_amount,
          COALESCE(AVG(grand_total), 0) as avg_amount,
          COALESCE(SUM(commission_amount), 0) as total_commission,
          COUNT(DISTINCT customer_id) as unique_customers,
          COALESCE(SUM(CASE WHEN status = 'Completed' THEN grand_total ELSE 0 END), 0) as completed_amount,
          COALESCE(SUM(CASE WHEN status = 'Pending' THEN grand_total ELSE 0 END), 0) as pending_amount
        FROM salesman_sales 
        WHERE salesman_id = ? AND is_deleted = 0`,
        [salesmanId]
      );
      
      const monthly = await this.electronQuery(
        `SELECT 
          strftime('%Y-%m', sale_date) as month,
          COUNT(*) as sales_count,
          COALESCE(SUM(grand_total), 0) as total
        FROM salesman_sales 
        WHERE salesman_id = ? AND is_deleted = 0
        GROUP BY strftime('%Y-%m', sale_date)
        ORDER BY month DESC
        LIMIT 12`,
        [salesmanId]
      );
      
      return {
        stats: stats[0] || { total_sales: 0, total_amount: 0, avg_amount: 0, total_commission: 0, unique_customers: 0 },
        monthly: monthly || []
      };
    }
    
    const sales = await idbGetAll('salesman_sales');
    const filtered = sales.filter(x => !x.is_deleted && String(x.salesman_id) === String(salesmanId));
    
    const stats = {
      total_sales: filtered.length,
      total_amount: filtered.reduce((sum, s) => sum + Number(s.grand_total || 0), 0),
      avg_amount: filtered.length > 0 ? filtered.reduce((sum, s) => sum + Number(s.grand_total || 0), 0) / filtered.length : 0,
      total_commission: filtered.reduce((sum, s) => sum + Number(s.commission_amount || 0), 0),
      unique_customers: new Set(filtered.map(s => s.customer_id).filter(Boolean)).size,
      completed_amount: filtered.filter(s => s.status === 'Completed').reduce((sum, s) => sum + Number(s.grand_total || 0), 0),
      pending_amount: filtered.filter(s => s.status === 'Pending').reduce((sum, s) => sum + Number(s.grand_total || 0), 0)
    };
    
    const monthlyMap = {};
    for (const sale of filtered) {
      const date = new Date(sale.sale_date);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap[month]) {
        monthlyMap[month] = { sales_count: 0, total: 0 };
      }
      monthlyMap[month].sales_count++;
      monthlyMap[month].total += Number(sale.grand_total || 0);
    }
    
    const monthly = Object.entries(monthlyMap)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 12);
    
    return { stats, monthly };
  };

  // ==================== CUSTOMER HISTORY ====================
  StorageClass.prototype.getCustomerSalesHistory = async function(customerId) {
    if (this.mode === 'electron') {
      return this.electronQuery(
        `SELECT csh.*, s.name as salesman_name, ss.invoice_no
        FROM customer_sales_history csh
        LEFT JOIN salesmen s ON csh.salesman_id = s.id
        LEFT JOIN salesman_sales ss ON csh.sale_id = ss.id
        WHERE csh.customer_id = ?
        ORDER BY csh.sale_date DESC`,
        [customerId]
      );
    }
    const history = await idbGetAll('customer_sales_history');
    const salesmen = await idbGetAll('salesmen');
    const sales = await idbGetAll('salesman_sales');
    
    return history
      .filter(x => String(x.customer_id) === String(customerId))
      .map(h => ({
        ...h,
        salesman_name: salesmen.find(s => String(s.id) === String(h.salesman_id))?.name || '',
        invoice_no: sales.find(s => String(s.id) === String(h.sale_id))?.invoice_no || ''
      }));
  };

  StorageClass.prototype.getCustomerTotalStats = async function(customerId) {
    if (this.mode === 'electron') {
      const stats = await this.electronQuery(
        `SELECT 
          COUNT(*) as total_purchases,
          COALESCE(SUM(total_amount), 0) as total_spent,
          COALESCE(SUM(paid_amount), 0) as total_paid,
          COALESCE(SUM(due_amount), 0) as total_due,
          COUNT(DISTINCT salesman_id) as salesmen_count
        FROM customer_sales_history
        WHERE customer_id = ?`,
        [customerId]
      );
      return stats[0] || { total_purchases: 0, total_spent: 0, total_paid: 0, total_due: 0, salesmen_count: 0 };
    }
    
    const history = await idbGetAll('customer_sales_history');
    const filtered = history.filter(x => String(x.customer_id) === String(customerId));
    
    return {
      total_purchases: filtered.length,
      total_spent: filtered.reduce((sum, h) => sum + Number(h.total_amount || 0), 0),
      total_paid: filtered.reduce((sum, h) => sum + Number(h.paid_amount || 0), 0),
      total_due: filtered.reduce((sum, h) => sum + Number(h.due_amount || 0), 0),
      salesmen_count: new Set(filtered.map(h => h.salesman_id).filter(Boolean)).size
    };
  };

}