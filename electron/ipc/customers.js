const { ipcMain } = require('electron');
const { getDb } = require('../database/connection');
const { logAudit } = require('../utils/audit');
const { sanitizeObject, sanitizeInput, validatePositiveNumber, validateDate, safeJsonParse } = require('../utils/validators');
const { getCustomerBalance } = require('../utils/calculations');
const { createHandler } = require('./helpers');

function registerCustomerHandlers() {
  ipcMain.handle('db:getCustomers', createHandler(async () => {
    const db = getDb();
    return db.prepare(`SELECT * FROM customers WHERE is_deleted = 0 ORDER BY name`).all() || [];
  }));

  ipcMain.handle('db:getCustomerById', createHandler(async (event, id) => {
    const db = getDb();
    return db.prepare("SELECT * FROM customers WHERE id = ? AND is_deleted = 0").get(id);
  }));

  ipcMain.handle('db:getCustomerByPhone', createHandler(async (event, phone) => {
    const db = getDb();
    if (!phone) return null;
    return db.prepare("SELECT * FROM customers WHERE phone = ? AND is_deleted = 0 LIMIT 1").get(phone) || null;
  }));

  ipcMain.handle('db:addCustomer', createHandler(async (event, customerData) => {
    const db = getDb();
    const sanitized = sanitizeObject(customerData, ['name', 'phone', 'email', 'cnic', 'address', 'district', 'province', 'shop_name', 'customer_type', 'opening_balance', 'credit_limit', 'payment_terms', 'status', 'notes', 'reference_name', 'reference_phone']);

    const openingBalance = validatePositiveNumber(sanitized.opening_balance, 0);

    const result = db.prepare(`
      INSERT INTO customers (
        name, phone, email, cnic, address, district, province, shop_name,
        customer_type, opening_balance, current_balance, credit_limit,
        payment_terms, status, notes, reference_name, reference_phone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sanitized.name,
      sanitized.phone || '',
      sanitized.email || '',
      sanitized.cnic || '',
      sanitized.address || '',
      sanitized.district || '',
      sanitized.province || '',
      sanitized.shop_name || '',
      sanitized.customer_type || 'retail',
      openingBalance,
      openingBalance,
      validatePositiveNumber(sanitized.credit_limit, 0),
      sanitized.payment_terms || 'cash',
      sanitized.status || 'active',
      sanitized.notes || '',
      sanitized.reference_name || '',
      sanitized.reference_phone || ''
    );

    const customerId = result.lastInsertRowid;

    if (openingBalance > 0) {
      db.prepare(`
        INSERT INTO customer_ledger (
          customer_id, type, amount, previous_balance, balance_after,
          description, payment_mode, reference_no, date
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        customerId,
        'opening_balance',
        openingBalance,
        0,
        openingBalance,
        'Opening Balance',
        'opening',
        `OB-${customerId}`,
        customerData.created_at || new Date().toISOString()
      );
    }

    logAudit(customerData.created_by || 1, 'create', 'customers', customerId);
    return { id: customerId };
  }));

  ipcMain.handle('db:updateCustomer', createHandler(async (event, id, customerData) => {
    const db = getDb();
    const sanitized = sanitizeObject(customerData, ['name', 'phone', 'email', 'cnic', 'address', 'district', 'province', 'shop_name', 'customer_type', 'credit_limit', 'payment_terms', 'status', 'notes', 'reference_name', 'reference_phone']);

    const fields = [];
    const values = [];
    const allowedFields = ['name', 'phone', 'email', 'cnic', 'address', 'district', 'province',
      'shop_name', 'customer_type', 'credit_limit', 'payment_terms', 'status', 'notes',
      'reference_name', 'reference_phone'];

    Object.keys(sanitized).forEach(key => {
      if (allowedFields.includes(key) && sanitized[key] !== undefined) {
        fields.push(`${key} = ?`);
        if (key === 'credit_limit') {
          values.push(validatePositiveNumber(sanitized[key], 0));
        } else {
          values.push(sanitized[key]);
        }
      }
    });

    if (fields.length === 0) return { changes: 0 };

    values.push(id);
    const result = db.prepare(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    logAudit(customerData.updated_by || 1, 'update', 'customers', id);
    return { changes: result.changes };
  }));

  ipcMain.handle('db:deleteCustomer', createHandler(async (event, id) => {
    const db = getDb();
    const customer = db.prepare("SELECT current_balance FROM customers WHERE id = ?").get(id);
    const balance = parseFloat(customer?.current_balance) || 0;
    
    if (Math.abs(balance) > 0.01) {
      throw new Error('Cannot delete customer with non-zero balance');
    }

    const hasSales = db.prepare("SELECT COUNT(*) as count FROM sales WHERE customer_id = ? AND is_deleted = 0").get(id).count;
    const hasSalesmanSales = db.prepare("SELECT COUNT(*) as count FROM salesman_sales WHERE customer_id = ? AND is_deleted = 0").get(id).count;
    if (hasSales > 0 || hasSalesmanSales > 0) {
      throw new Error('Cannot delete customer with sales history');
    }

    const result = db.prepare(`UPDATE customers SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?`).run(id);
    logAudit(event.sender?.userId || 1, 'delete', 'customers', id);
    return { changes: result.changes };
  }));

  // Customer Ledger
  // File top pe add karo:
  // const { safeJsonParse } = require('../utils/validators');

  ipcMain.handle('db:getCustomerLedger', createHandler(async (event, customerId, filters = {}) => {
    const db = getDb();
    let sql = `
      SELECT 
        cl.*,
        s.invoice_no,
        s.grand_total as sale_grand_total,
        s.paid_amount as sale_paid_amount,
        s.due_amount as sale_due_amount
      FROM customer_ledger cl
      LEFT JOIN sales s ON cl.sale_id = s.id
      WHERE cl.customer_id = ?
    `;
    const params = [customerId];

    if (filters.type) { sql += " AND cl.type = ?"; params.push(filters.type); }
    if (filters.fromDate) { sql += " AND DATE(cl.date) >= DATE(?)"; params.push(filters.fromDate); }
    if (filters.toDate) { sql += " AND DATE(cl.date) <= DATE(?)"; params.push(filters.toDate); }

    sql += " ORDER BY cl.date DESC, cl.id DESC";

    const entries = db.prepare(sql).all(...params);

    return entries.map(entry => ({
      ...entry,
      items: safeJsonParse(entry.items_json, []),
      previous_balance: entry.previous_balance || 0,
      balance_after: entry.balance_after || 0,
      amount: entry.amount || 0
    }));
  }));

  ipcMain.handle('db:addCustomerPayment', createHandler(async (event, data) => {
    const db = getDb();
    const customerId = data.customer_id;
    const amount = validatePositiveNumber(data.amount, 0);
    
    if (amount <= 0) throw new Error('Payment amount must be greater than 0');

    const customer = db.prepare("SELECT current_balance FROM customers WHERE id = ? AND is_deleted = 0").get(customerId);
    if (!customer) throw new Error('Customer not found');

    const previousBalance = parseFloat(customer.current_balance) || 0;
    
    // Allow advance payments (negative balance = advance)
    const newBalance = previousBalance - amount;

    const transaction = db.transaction(() => {
      db.prepare("UPDATE customers SET current_balance = ? WHERE id = ?").run(newBalance, customerId);

      const paymentResult = db.prepare(`
        INSERT INTO payments (customer_id, amount, type, payment_mode, note, date)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        customerId,
        amount,
        'customer_payment',
        sanitizeInput(data.payment_mode || 'cash'),
        sanitizeInput(data.note || `Payment received`),
        data.date || new Date().toISOString()
      );

      db.prepare(`
        INSERT INTO customer_ledger (
          customer_id, type, amount, previous_balance, balance_after,
          description, payment_mode, reference_no, date
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        customerId,
        'payment',
        -amount,
        previousBalance,
        newBalance,
        data.note || `Payment received`,
        sanitizeInput(data.payment_mode || 'cash'),
        data.reference_no || `PAY-${paymentResult.lastInsertRowid}`,
        data.date || new Date().toISOString()
      );

      logAudit(data.created_by || 1, 'payment', 'customers', customerId);
      return { success: true, previousBalance, newBalance, paymentId: paymentResult.lastInsertRowid };
    });

    return transaction();
  }));

ipcMain.handle('db:adjustCustomerBalance', createHandler(async (event, data) => {
    const db = getDb();
    const customerId = data.customer_id;
    const adjustmentAmount = parseFloat(data.amount) || 0;
    if (adjustmentAmount === 0) throw new Error('Adjustment amount cannot be zero');

    const customer = db.prepare("SELECT current_balance FROM customers WHERE id = ? AND is_deleted = 0").get(customerId);
    if (!customer) throw new Error('Customer not found');

    const previousBalance = parseFloat(customer.current_balance) || 0;
    const newBalance = previousBalance + adjustmentAmount;

    const transaction = db.transaction(() => {
      db.prepare("UPDATE customers SET current_balance = ? WHERE id = ?").run(newBalance, customerId);

      db.prepare(`
        INSERT INTO customer_ledger (
          customer_id, type, amount, previous_balance, balance_after,
          description, payment_mode, reference_no, date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        customerId,
        'adjustment',
        adjustmentAmount,
        previousBalance,
        newBalance,
        sanitizeInput(data.description || 'Balance Adjustment'),
        sanitizeInput(data.payment_mode || 'adjustment'),
        sanitizeInput(data.reference_no || `ADJ-${Date.now()}`),
        data.date || new Date().toISOString()
      );

      logAudit(data.created_by || 1, 'adjustment', 'customers', customerId);
    });

    transaction();
    return { success: true, previousBalance, newBalance };
  }));
ipcMain.handle('db:updateCustomerBalance', createHandler(async (event, customerId, dueAmount, meta = {}) => {
    const db = getDb();
    
    const customer = db.prepare("SELECT current_balance FROM customers WHERE id = ? AND is_deleted = 0").get(customerId);
    if (!customer) throw new Error('Customer not found');
    
    const previousBalance = parseFloat(customer.current_balance) || 0;
    const newBalance = previousBalance + dueAmount;
    
    db.prepare("UPDATE customers SET current_balance = ? WHERE id = ?").run(newBalance, customerId);
    
    if (meta.items && meta.items.length > 0) {
      db.prepare(`
        INSERT INTO customer_ledger (
          customer_id, type, amount, previous_balance, balance_after,
          description, payment_mode, reference_no, sale_id, date, items_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
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
      );
    }
    
    logAudit(meta.created_by || 1, 'sale', 'customers', customerId);
    return { success: true, new_balance: newBalance, previous_balance: previousBalance };
  })); 
ipcMain.handle('db:getAllCustomersWithBalance', createHandler(async () => {
    const db = getDb();
    return db.prepare(`
      SELECT 
        c.*,
        (SELECT MAX(date) FROM customer_ledger WHERE customer_id = c.id) as last_transaction_date,
        (SELECT COUNT(*) FROM customer_ledger WHERE customer_id = c.id) as total_transactions
      FROM customers c
      WHERE c.is_deleted = 0
      ORDER BY c.name
    `).all() || [];
  }));
}

module.exports = { registerCustomerHandlers };
