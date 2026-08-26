// ============================================================
//  db-customers.js — Customers Module (Mixin)
// ============================================================

import { SYNC_ENABLED } from './core/config.js';
import { syncToCloud } from './core/sync.js';
import { idbGetAll, idbGetById, idbAdd, idbPut, idbTransaction } from './core/idb-core.js';
import { generateId } from './core/utils.js'; // agar yeh idb-core mein ho toh wahan se import kar lena

export function attachCustomerMethods(StorageClass) {

  StorageClass.prototype.getCustomers = async function() { 
    if (this.mode === 'electron') {
      return this.electronQuery("SELECT * FROM customers WHERE is_deleted = 0 ORDER BY name");
    }
    return idbGetAll('customers').then(r => r.filter(x => !x.is_deleted));
  };

  StorageClass.prototype.getCustomerById = async function(id) { 
    if (this.mode === 'electron') { 
      const r = await this.electronQuery("SELECT * FROM customers WHERE id = ? AND is_deleted = 0", [id]);
      return r[0] || null;
    }
    const result = await idbGetById('customers', id);
    return result && !result.is_deleted ? result : null;
  };

  StorageClass.prototype.createCustomer = async function(data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`INSERT INTO customers (name, phone, email, cnic, shop_name, customer_type, opening_balance, current_balance, credit_limit, payment_terms, status, district, province, notes, reference_name, reference_phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [data.name, data.phone, data.email, data.cnic, data.shop_name, data.customer_type || 'retail', data.opening_balance || 0, data.opening_balance || 0, data.credit_limit || 0, data.payment_terms || 'cash', data.status || 'active', data.district, data.province, data.notes, data.reference_name, data.reference_phone]);
      const customerId = _res.lastInsertRowid;
      if ((data.opening_balance || 0) > 0) {
        await this.electronQuery(
          `INSERT INTO customer_ledger (customer_id, type, amount, previous_balance, balance_after, description, payment_mode, reference_no, sale_id, date, items_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`,
          [customerId, 'opening_balance', data.opening_balance || 0, 0, data.opening_balance || 0, 'Opening Balance', 'opening', `OB-${customerId}`, null, '[]']
        );
      }
      if (SYNC_ENABLED) {
        await syncToCloud('customers', { ...data, id: customerId, is_deleted: 0 });
      }
      return _res;
    }
    const openingBalance = Number(data.opening_balance) || 0;
    const customerId = generateId();
    const customerData = { ...data, id: customerId, current_balance: openingBalance, is_deleted: 0 };
    
    return idbTransaction(['customers', 'customer_ledger'], async (tx) => {
      const customerStore = tx.objectStore('customers');
      const ledgerStore = tx.objectStore('customer_ledger');
      
      await new Promise((resolve, reject) => {
        const r = customerStore.add(customerData);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      
      if (openingBalance > 0) {
        await new Promise((resolve, reject) => {
          const r = ledgerStore.add({
            id: generateId(),
            customer_id: customerId,
            type: 'opening_balance',
            amount: openingBalance,
            previous_balance: 0,
            balance_after: openingBalance,
            description: 'Opening Balance',
            payment_mode: 'opening',
            reference_no: `OB-${customerId}`,
            sale_id: null,
            date: data.created_at || new Date().toISOString(),
            items_json: '[]'
          });
          r.onsuccess = resolve;
          r.onerror = () => reject(r.error);
        });
      }
      
      if (SYNC_ENABLED) {
        await syncToCloud('customers', { ...data, id: customerId, current_balance: openingBalance, is_deleted: 0 });
      }
      
      return { id: customerId };
    });
  };

  StorageClass.prototype.updateCustomer = async function(id, data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`UPDATE customers SET name = ?, phone = ?, email = ?, cnic = ?, shop_name = ?, customer_type = ?, credit_limit = ?, payment_terms = ?, status = ?, district = ?, province = ?, notes = ?, reference_name = ?, reference_phone = ? WHERE id = ?`, [data.name, data.phone, data.email, data.cnic, data.shop_name, data.customer_type, data.credit_limit, data.payment_terms, data.status, data.district, data.province, data.notes, data.reference_name, data.reference_phone, id]);
      if (SYNC_ENABLED) {
        await syncToCloud('customers', { ...data, id });
      }
      return _res;
    }
    const e = await idbGetById('customers', id);
    if (!e) return { changes: 0 };
    const safeData = { ...data };
    delete safeData.current_balance;
    delete safeData.opening_balance;
    const updated = { ...e, ...safeData, id: e.id };
    const result = await idbPut('customers', updated);
    if (SYNC_ENABLED) {
      await syncToCloud('customers', updated);
    }
    return result;
  };

  StorageClass.prototype.deleteCustomer = async function(id) { 
    if (this.mode === 'electron') {
      const customer = await this.electronQuery("SELECT current_balance FROM customers WHERE id = ? AND is_deleted = 0", [id]);
      const balance = parseFloat(customer?.[0]?.current_balance) || 0;
      if (Math.abs(balance) > 0.01) {
        throw new Error('Cannot delete customer with non-zero balance');
      }
      const hasSales = await this.electronQuery("SELECT COUNT(*) as count FROM sales WHERE customer_id = ? AND is_deleted = 0", [id]);
      const hasSalesmanSales = await this.electronQuery("SELECT COUNT(*) as count FROM salesman_sales WHERE customer_id = ? AND is_deleted = 0", [id]);
      if ((hasSales?.[0]?.count || 0) > 0 || (hasSalesmanSales?.[0]?.count || 0) > 0) {
        throw new Error('Cannot delete customer with sales history');
      }
      
      const _res = await this.electronQuery("UPDATE customers SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?", [id]);
      if (SYNC_ENABLED) {
        await syncToCloud('customers', { id, is_deleted: 1, deleted_at: new Date().toISOString() });
      }
      return _res;
    }
    const e = await idbGetById('customers', id);
    if (!e) return { changes: 0 };
    if (Math.abs(Number(e.current_balance) || 0) > 0.01) {
      throw new Error('Cannot delete customer with non-zero balance');
    }
    if (SYNC_ENABLED) {
      await syncToCloud('customers', { id, is_deleted: 1, deleted_at: new Date().toISOString() });
    }
    return idbPut('customers', { ...e, is_deleted: 1, id: e.id });
  };

  StorageClass.prototype.getCustomerLedger = async function(customerId) { 
    if (this.mode === 'electron') {
      const entries = await this.electronQuery("SELECT * FROM customer_ledger WHERE customer_id = ? ORDER BY date DESC, id DESC", [customerId]);
      return entries.map(entry => {
        let items = [];
        try {
          items = JSON.parse(entry.items_json || '[]');
        } catch (e) { items = []; }
        return {
          ...entry,
          items,
          previous_balance: entry.previous_balance || 0,
          balance_after: entry.balance_after || 0,
          amount: entry.amount || 0
        };
      });
    }
    const entries = await idbGetAll('customer_ledger');
    return entries
      .filter(x => String(x.customer_id) === String(customerId))
      .map(entry => {
        let items = [];
        try {
          items = JSON.parse(entry.items_json || '[]');
        } catch (e) { items = []; }
        return {
          ...entry,
          items,
          previous_balance: entry.previous_balance || 0,
          balance_after: entry.balance_after || 0,
          amount: entry.amount || 0
        };
      })
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  };

  StorageClass.prototype.addCustomerLedgerEntry = async function(data) { 
    if (this.mode === 'electron') {
      const _res = await this.electronQuery(`INSERT INTO customer_ledger (customer_id, type, amount, previous_balance, balance_after, description, payment_mode, reference_no, sale_id, date, items_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [data.customer_id, data.type, data.amount, data.previous_balance || 0, data.balance_after || 0, data.description, data.payment_mode, data.reference_no, data.sale_id, data.date || new Date().toISOString(), data.items_json || '[]']);
      if (SYNC_ENABLED) {
        await syncToCloud('customer_ledger', { ...data, id: _res.lastInsertRowid });
      }
      return _res;
    }
    return idbAdd('customer_ledger', {
      id: generateId(),
      ...data,
      previous_balance: data.previous_balance || 0,
      balance_after: data.balance_after || 0,
      items_json: data.items_json || '[]',
      date: data.date || new Date().toISOString()
    });
  };

  StorageClass.prototype.addCustomerPayment = async function(data) {
    const { customer_id, amount, payment_mode, note, reference_no, date } = data;
    const paymentAmount = Number(amount) || 0;
    if (!customer_id || paymentAmount <= 0) {
      throw new Error('Invalid payment data');
    }
    
    if (this.mode === 'electron') {
      return this.electronTransaction(async () => {
        const customer = await this.electronQuery(
          "SELECT current_balance FROM customers WHERE id = ? AND is_deleted = 0",
          [customer_id]
        );
        if (!customer || customer.length === 0) {
          throw new Error('Customer not found');
        }
        
        const previousBalance = Number(customer[0].current_balance) || 0;
        // Allow advance payments (negative balance = advance)
        const newBalance = previousBalance - paymentAmount;
        
        await this.electronQuery(
          "UPDATE customers SET current_balance = ? WHERE id = ?",
          [newBalance, customer_id]
        );
        
        const paymentResult = await this.electronQuery(
          `INSERT INTO payments (customer_id, amount, type, payment_mode, note, date) VALUES (?, ?, ?, ?, ?, ?)`,
          [customer_id, paymentAmount, 'customer_payment', payment_mode || 'cash', note || '', date || new Date().toISOString()]
        );
        
        await this.electronQuery(
          `INSERT INTO customer_ledger (customer_id, type, amount, previous_balance, balance_after, description, payment_mode, reference_no, date, items_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            customer_id,
            'payment',
            -paymentAmount,
            previousBalance,
            newBalance,
            note || `Payment received`,
            payment_mode || 'cash',
            reference_no || `PAY-${paymentResult.lastInsertRowid}`,
            date || new Date().toISOString(),
            '[]'
          ]
        );
        
        return { success: true, payment_id: paymentResult.lastInsertRowid, new_balance: newBalance };
      });
    }
    
    // Browser mode
    return idbTransaction(['customers', 'payments', 'customer_ledger'], async (tx) => {
      const customerStore = tx.objectStore('customers');
      const paymentStore = tx.objectStore('payments');
      const ledgerStore = tx.objectStore('customer_ledger');
      
      const customerRequest = customerStore.get(customer_id);
      await new Promise((resolve, reject) => {
        customerRequest.onsuccess = () => resolve(customerRequest.result);
        customerRequest.onerror = () => reject(customerRequest.error);
      });
      
      const customer = customerRequest.result;
      if (!customer || customer.is_deleted) {
        throw new Error('Customer not found');
      }
      
      const previousBalance = Number(customer.current_balance) || 0;
      // Allow advance payments (negative balance = advance)
      const newBalance = previousBalance - paymentAmount;
      customer.current_balance = newBalance;
      customer.updated_at = new Date().toISOString();
      
      await new Promise((resolve, reject) => {
        const r = customerStore.put(customer);
        r.onsuccess = resolve;
        r.onerror = () => reject(r.error);
      });
      
      const paymentId = generateId();
      const paymentData = {
        id: paymentId,
        customer_id,
        amount: paymentAmount,
        type: 'customer_payment',
        payment_mode: payment_mode || 'cash',
        note: note || '',
        date: date || new Date().toISOString(),
        is_deleted: 0
      };
      
      await new Promise((resolve, reject) => {
        const r = paymentStore.add(paymentData);
        r.onsuccess = resolve;
        r.onerror = () => reject(r.error);
      });
      
      const ledgerId = generateId();
      const ledgerData = {
        id: ledgerId,
        customer_id,
        type: 'payment',
        amount: -paymentAmount,
        previous_balance: previousBalance,
        balance_after: newBalance,
        description: note || `Payment received`,
        payment_mode: payment_mode || 'cash',
        reference_no: reference_no || `PAY-${paymentId}`,
        sale_id: null,
        date: date || new Date().toISOString(),
        items_json: '[]'
      };
      
      await new Promise((resolve, reject) => {
        const r = ledgerStore.add(ledgerData);
        r.onsuccess = resolve;
        r.onerror = () => reject(r.error);
      });
      
      return { success: true, payment_id: paymentId, new_balance: newBalance };
    });
  };
    StorageClass.prototype.updateCustomerBalance = async function(customerId, dueAmount, meta = {}) {
    if (this.mode === 'electron') {
      return this.electronTransaction(async () => {
        const customer = await this.electronQuery(
          "SELECT current_balance FROM customers WHERE id = ? AND is_deleted = 0",
          [customerId]
        );
        if (!customer || customer.length === 0) throw new Error('Customer not found');
        
        const previousBalance = Number(customer[0].current_balance) || 0;
        const newBalance = previousBalance + dueAmount;
        
        await this.electronQuery(
          "UPDATE customers SET current_balance = ? WHERE id = ?",
          [newBalance, customerId]
        );
        
        if (meta.items && meta.items.length > 0) {
          await this.electronQuery(
            `INSERT INTO customer_ledger (customer_id, type, amount, previous_balance, balance_after, description, payment_mode, reference_no, sale_id, date, items_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              customerId,
              dueAmount > 0 ? 'credit_sale' : 'cash_sale',
              dueAmount,
              previousBalance,
              newBalance,
              meta.description || `Sale ${meta.invoice_no || ''} - ${meta.items.length} items`,
              meta.payment_mode || 'cash',
              meta.invoice_no || '',
              meta.sale_id || null,
              meta.date || new Date().toISOString(),
              JSON.stringify(meta.items.map(item => ({
                name: item.name,
                quantity: item.qty || item.quantity,
                price: item.price,
                discount: item.discount || 0,
                total: item.total
              })))
            ]
          );
        }
        
        return { success: true, new_balance: newBalance };
      });
    }
    
    // Browser mode
    return idbTransaction(['customers', 'customer_ledger'], async (tx) => {
      const customerStore = tx.objectStore('customers');
      const ledgerStore = tx.objectStore('customer_ledger');
      
      const customerRequest = customerStore.get(customerId);
      await new Promise((resolve, reject) => {
        customerRequest.onsuccess = () => resolve(customerRequest.result);
        customerRequest.onerror = () => reject(customerRequest.error);
      });
      
      const customer = customerRequest.result;
      if (!customer || customer.is_deleted) throw new Error('Customer not found');
      
      const previousBalance = Number(customer.current_balance) || 0;
      const newBalance = previousBalance + dueAmount;
      customer.current_balance = newBalance;
      customer.updated_at = new Date().toISOString();
      
      await new Promise((resolve, reject) => {
        const r = customerStore.put(customer);
        r.onsuccess = resolve;
        r.onerror = () => reject(r.error);
      });
      
      if (meta.items && meta.items.length > 0) {
        const ledgerId = generateId();
        const ledgerData = {
          id: ledgerId,
          customer_id: customerId,
          type: dueAmount > 0 ? 'credit_sale' : 'cash_sale',
          amount: dueAmount,
          previous_balance: previousBalance,
          balance_after: newBalance,
          description: meta.description || `Sale ${meta.invoice_no || ''} - ${meta.items.length} items`,
          payment_mode: meta.payment_mode || 'cash',
          reference_no: meta.invoice_no || '',
          sale_id: meta.sale_id || null,
          date: meta.date || new Date().toISOString(),
          items_json: JSON.stringify(meta.items.map(item => ({
            name: item.name,
            quantity: item.qty || item.quantity,
            price: item.price,
            discount: item.discount || 0,
            total: item.total
          })))
        };
        
        await new Promise((resolve, reject) => {
          const r = ledgerStore.add(ledgerData);
          r.onsuccess = resolve;
          r.onerror = () => reject(r.error);
        });
      }
      
      return { success: true, new_balance: newBalance };
    });
  };

  StorageClass.prototype.getAllCustomersWithBalance = async function() {
    if (this.mode === 'electron') {
      return this.electronQuery(`
        SELECT 
          c.*,
          MAX(cl.date) as last_transaction_date,
          COUNT(cl.id) as total_transactions
        FROM customers c
        LEFT JOIN customer_ledger cl ON c.id = cl.customer_id
        WHERE c.is_deleted = 0
        GROUP BY c.id
        ORDER BY c.name
      `);
    }
    
    const [customers, ledger] = await Promise.all([
      idbGetAll('customers'),
      idbGetAll('customer_ledger')
    ]);
    
    return customers
      .filter(c => !c.is_deleted)
      .map(c => {
        const customerLedger = ledger.filter(l => String(l.customer_id) === String(c.id));
        const lastTx = customerLedger.sort((a, b) => 
          new Date(b.date || 0) - new Date(a.date || 0)
        )[0];
        
        return {
          ...c,
          last_transaction_date: lastTx?.date || null,
          total_transactions: customerLedger.length
        };
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  };

}