const { ipcMain } = require('electron');
const { getDb } = require('../database/connection');
const { logAudit } = require('../utils/audit');
const { sanitizeObject, sanitizeInput, validatePositiveNumber, validateDate, requiredId, validateStockAvailability } = require('../utils/validators');
const { getCustomerBalance, calculateCommission } = require('../utils/calculations');
const { createHandler } = require('./helpers');

function registerSalesmanHandlers() {
  // Salesmen CRUD
  ipcMain.handle('db:getAllSalesmen', createHandler(async () => {
    const db = getDb();
    return db.prepare("SELECT * FROM salesmen WHERE is_deleted = 0 ORDER BY name").all() || [];
  }));

  ipcMain.handle('db:getSalesmanById', createHandler(async (event, id) => {
    const db = getDb();
    return db.prepare("SELECT * FROM salesmen WHERE id = ? AND is_deleted = 0").get(id);
  }));

  ipcMain.handle('db:addSalesman', createHandler(async (event, data) => {
    const db = getDb();
    const sanitized = sanitizeObject(data, ['name', 'phone', 'cnic', 'address', 'joining_date', 'target_amount', 'commission_percent', 'status']);

    const result = db.prepare(`
      INSERT INTO salesmen (name, phone, cnic, address, joining_date, target_amount, commission_percent, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sanitized.name,
      sanitized.phone || '',
      sanitized.cnic || '',
      sanitized.address || '',
      validateDate(sanitized.joining_date) || new Date().toISOString().split('T')[0],
      validatePositiveNumber(sanitized.target_amount, 0),
      validatePositiveNumber(sanitized.commission_percent, 0),
      sanitized.status || 'active'
    );

    return { id: result.lastInsertRowid };
  }));

  ipcMain.handle('db:updateSalesman', createHandler(async (event, id, data) => {
    const db = getDb();
    const sanitized = sanitizeObject(data, ['name', 'phone', 'cnic', 'address', 'joining_date', 'target_amount', 'commission_percent', 'status']);

    const result = db.prepare(`
      UPDATE salesmen SET
        name = ?, phone = ?, cnic = ?, address = ?,
        joining_date = ?, target_amount = ?, commission_percent = ?,
        status = ?, updated_at = datetime('now')
      WHERE id = ? AND is_deleted = 0
    `).run(
      sanitized.name,
      sanitized.phone || '',
      sanitized.cnic || '',
      sanitized.address || '',
      validateDate(sanitized.joining_date) || new Date().toISOString().split('T')[0],
      validatePositiveNumber(sanitized.target_amount, 0),
      validatePositiveNumber(sanitized.commission_percent, 0),
      sanitized.status || 'active',
      id
    );

    return { changes: result.changes };
  }));

  ipcMain.handle('db:deleteSalesman', createHandler(async (event, id) => {
    const db = getDb();
    const result = db.prepare("UPDATE salesmen SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?").run(id);
    return { changes: result.changes };
  }));

  // Salesman Sales
  ipcMain.handle('db:addSalesmanSale', createHandler(async (event, data) => {
    const db = getDb();
    const transaction = db.transaction((saleData) => {
      if (saleData.items && Array.isArray(saleData.items)) {
        for (const item of saleData.items) {
          const validation = validateStockAvailability(db, item.product_variant_id, item.quantity);
          if (!validation.available) {
            throw new Error(`Stock insufficient for item: ${item.product_name || item.sku}. ${validation.error}`);
          }
        }
      }

      let subtotal = 0;
      if (saleData.items && Array.isArray(saleData.items)) {
        for (const item of saleData.items) subtotal += (item.price || 0) * (item.quantity || 0);
      }
      subtotal = Math.round(subtotal * 100) / 100;
      
      const discount = validatePositiveNumber(saleData.discount, 0);
      const tax = validatePositiveNumber(saleData.tax, 0);
      const shipping = validatePositiveNumber(saleData.shipping, 0);
      const grandTotal = subtotal - discount + tax + shipping;

      const tolerance = 0.01;
      if (Math.abs(grandTotal - validatePositiveNumber(saleData.grand_total, 0)) > tolerance) {
        throw new Error(`Grand total mismatch. Client: ${saleData.grand_total}, Server: ${grandTotal}`);
      }

      const paidAmount = validatePositiveNumber(saleData.paid_amount, 0);
      const dueAmount = Math.max(0, grandTotal - paidAmount);

      let customerName = sanitizeInput(saleData.customer_name || '');
      if (saleData.customer_id) {
        const customer = db.prepare("SELECT name, credit_limit, current_balance FROM customers WHERE id = ? AND is_deleted = 0").get(saleData.customer_id);
        if (customer) {
          customerName = customer.name;
          if (dueAmount > 0 && parseFloat(customer.credit_limit) > 0) {
            const projectedBalance = (parseFloat(customer.current_balance) || 0) + dueAmount;
            if (projectedBalance > parseFloat(customer.credit_limit)) {
              throw new Error(`Credit limit exceeded for customer ${customer.name}. Limit: ${customer.credit_limit}, Current: ${customer.current_balance}, Projected: ${projectedBalance.toFixed(2)}`);
            }
          }
        }
      }

      const salesman = db.prepare("SELECT commission_percent FROM salesmen WHERE id = ? AND is_deleted = 0").get(saleData.salesman_id);
      const commissionAmount = calculateCommission(grandTotal, salesman?.commission_percent || 0);

      const saleResult = db.prepare(`
        INSERT INTO salesman_sales (
          salesman_id, customer_id, customer_name, location, sale_date, status,
          subtotal, discount, tax, shipping, grand_total,
          payment_mode, payment_term, payment_term_type,
          paid_amount, due_amount, note, commission_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        saleData.salesman_id,
        saleData.customer_id || null,
        customerName,
        sanitizeInput(saleData.location || 'Main Branch'),
        validateDate(saleData.sale_date) || new Date().toISOString().split('T')[0],
        sanitizeInput(saleData.status || 'Pending'),
        subtotal,
        discount,
        tax,
        shipping,
        grandTotal,
        sanitizeInput(saleData.payment_mode || 'Cash'),
        validatePositiveNumber(saleData.payment_term, 0),
        sanitizeInput(saleData.payment_term_type || 'Days'),
        paidAmount,
        dueAmount,
        sanitizeInput(saleData.note || ''),
        commissionAmount
      );

      const saleId = saleResult.lastInsertRowid;

      if (saleData.items && Array.isArray(saleData.items)) {
        const itemStmt = db.prepare(`
          INSERT INTO salesman_sale_items (sale_id, product_variant_id, product_id, product_name, sku, quantity, price, total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const updateStock = db.prepare(`UPDATE product_variants SET current_stock = current_stock - ? WHERE id = ?`);

        for (const item of saleData.items) {
          const itemTotal = (item.price || 0) * (item.quantity || 0);
          itemStmt.run(
            saleId,
            item.product_variant_id || null,
            item.product_id || null,
            sanitizeInput(item.product_name || ''),
            sanitizeInput(item.sku || ''),
            validatePositiveNumber(item.quantity, 0),
            validatePositiveNumber(item.price, 0),
            Math.round(itemTotal * 100) / 100
          );
          if (item.product_variant_id) {
            updateStock.run(validatePositiveNumber(item.quantity, 0), item.product_variant_id);
          }
        }
      }

      if (saleData.customer_id) {
        db.prepare(`
          INSERT INTO customer_sales_history (customer_id, sale_id, salesman_id, total_amount, paid_amount, due_amount, sale_date, payment_mode)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          saleData.customer_id,
          saleId,
          saleData.salesman_id,
          grandTotal,
          paidAmount,
          dueAmount,
          validateDate(saleData.sale_date) || new Date().toISOString().split('T')[0],
          sanitizeInput(saleData.payment_mode || 'Cash')
        );
      }

      if (saleData.customer_id && dueAmount > 0) {
        const previousBalance = getCustomerBalance(db, saleData.customer_id);
        db.prepare(`UPDATE customers SET current_balance = current_balance + ? WHERE id = ?`).run(dueAmount, saleData.customer_id);

        const balanceAfter = getCustomerBalance(db, saleData.customer_id);
        
        const itemsForLedger = (saleData.items || []).map(item => ({
          product_variant_id: item.product_variant_id,
          product_id: item.product_id,
          name: item.product_name || '',
          quantity: Number(item.quantity) || 0,
          price: Number(item.price) || 0,
          total: Math.round((Number(item.price || 0) * Number(item.quantity || 0)) * 100) / 100
        }));
        
        db.prepare(`
          INSERT INTO customer_ledger (
            customer_id, type, amount, previous_balance, balance_after,
            description, payment_mode, reference_no, sale_id, date, items_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          saleData.customer_id,
          'salesman_sale',
          dueAmount,
          previousBalance,
          balanceAfter,
          `Salesman Sale ${saleData.sale_date}`,
          saleData.payment_mode || 'credit',
          `SS-${saleId}`,
          saleId,
          validateDate(saleData.sale_date) || new Date().toISOString().split('T')[0],
          JSON.stringify(itemsForLedger)
        );
      }

      logAudit(saleData.created_by || 1, 'create', 'salesman_sales', saleId);
      return { id: saleId, commission: commissionAmount, paid: paidAmount, due: dueAmount, grandTotal: grandTotal };
    });

    return transaction(data);
  }));

  ipcMain.handle('db:deleteSalesmanSale', createHandler(async (event, id) => {
    const db = getDb();
    const transaction = db.transaction(() => {
      const sale = db.prepare(`
        SELECT customer_id, due_amount FROM salesman_sales WHERE id = ? AND is_deleted = 0
      `).get(id);
      
      if (!sale) throw new Error('Salesman sale not found');

      const items = db.prepare("SELECT product_variant_id, quantity FROM salesman_sale_items WHERE sale_id = ?").all(id);
      
      for (const item of items) {
        if (item.product_variant_id) {
          db.prepare(`UPDATE product_variants SET current_stock = current_stock + ? WHERE id = ?`)
            .run(item.quantity, item.product_variant_id);
        }
      }

      if (sale.customer_id && sale.due_amount > 0) {
        const prevBalance = getCustomerBalance(db, sale.customer_id);
        db.prepare(`UPDATE customers SET current_balance = current_balance - ? WHERE id = ?`)
          .run(sale.due_amount, sale.customer_id);
        
        const newBalance = getCustomerBalance(db, sale.customer_id);
        db.prepare(`
          INSERT INTO customer_ledger (
            customer_id, type, amount, previous_balance, balance_after,
            description, payment_mode, reference_no, sale_id, date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          sale.customer_id,
          'salesman_sale_reversal',
          -sale.due_amount,
          prevBalance,
          newBalance,
          `Salesman Sale Deleted - Reversal`,
          'adjustment',
          `SSR-${id}`,
          id,
          new Date().toISOString()
        );
      }

      db.prepare("DELETE FROM customer_sales_history WHERE sale_id = ?").run(id);
      db.prepare(`UPDATE salesman_sales SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?`).run(id);

      logAudit(event.sender?.userId || 1, 'delete', 'salesman_sales', id);
    });

    transaction();
    return { success: true };
  }));

  ipcMain.handle('db:getSalesmanSales', createHandler(async (event, filters = {}) => {
    const db = getDb();
    let sql = `
      SELECT ss.*, s.name as salesman_name, s.commission_percent, c.name as customer_name_full
      FROM salesman_sales ss
      LEFT JOIN salesmen s ON ss.salesman_id = s.id
      LEFT JOIN customers c ON ss.customer_id = c.id
      WHERE ss.is_deleted = 0
    `;
    const params = [];

    if (filters.salesman_id) { sql += " AND ss.salesman_id = ?"; params.push(filters.salesman_id); }
    if (filters.customer_id) { sql += " AND ss.customer_id = ?"; params.push(filters.customer_id); }
    if (filters.start_date) { sql += " AND DATE(ss.sale_date) >= DATE(?)"; params.push(filters.start_date); }
    if (filters.end_date) { sql += " AND DATE(ss.sale_date) <= DATE(?)"; params.push(filters.end_date); }
    if (filters.status) { sql += " AND ss.status = ?"; params.push(filters.status); }

    sql += " ORDER BY ss.id DESC";

    return db.prepare(sql).all(...params) || [];
  }));

  ipcMain.handle('db:getSalesmanSaleItems', createHandler(async (event, saleId) => {
    const db = getDb();
    return db.prepare("SELECT * FROM salesman_sale_items WHERE sale_id = ?").all(saleId) || [];
  }));

  ipcMain.handle('db:getSalesmanStats', createHandler(async (event, salesmanId) => {
    const db = getDb();
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_sales,
        COALESCE(SUM(grand_total), 0) as total_amount,
        COALESCE(AVG(grand_total), 0) as avg_amount,
        COALESCE(SUM(commission_amount), 0) as total_commission,
        COUNT(DISTINCT customer_id) as unique_customers,
        COALESCE(SUM(CASE WHEN status = 'Completed' THEN grand_total ELSE 0 END), 0) as completed_amount,
        COALESCE(SUM(CASE WHEN status = 'Pending' THEN grand_total ELSE 0 END), 0) as pending_amount
      FROM salesman_sales
      WHERE salesman_id = ? AND is_deleted = 0
    `).get(salesmanId);

    const monthly = db.prepare(`
      SELECT
        strftime('%Y-%m', sale_date) as month,
        COUNT(*) as sales_count,
        COALESCE(SUM(grand_total), 0) as total
      FROM salesman_sales
      WHERE salesman_id = ? AND is_deleted = 0
      GROUP BY strftime('%Y-%m', sale_date)
      ORDER BY month DESC
      LIMIT 12
    `).all(salesmanId);

    return {
      stats: stats || { total_sales: 0, total_amount: 0, avg_amount: 0, total_commission: 0, unique_customers: 0 },
      monthly: monthly || []
    };
  }));

  // Customer Sales History
  ipcMain.handle('db:getCustomerSalesHistory', createHandler(async (event, customerId) => {
    const db = getDb();
    return db.prepare(`
      SELECT csh.*, s.name as salesman_name, ss.invoice_no
      FROM customer_sales_history csh
      LEFT JOIN salesmen s ON csh.salesman_id = s.id
      LEFT JOIN salesman_sales ss ON csh.sale_id = ss.id
      WHERE csh.customer_id = ?
      ORDER BY csh.sale_date DESC
    `).all(customerId) || [];
  }));

  ipcMain.handle('db:getCustomerTotalStats', createHandler(async (event, customerId) => {
    const db = getDb();
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_purchases,
        COALESCE(SUM(total_amount), 0) as total_spent,
        COALESCE(SUM(paid_amount), 0) as total_paid,
        COALESCE(SUM(due_amount), 0) as total_due,
        COUNT(DISTINCT salesman_id) as salesmen_count
      FROM customer_sales_history
      WHERE customer_id = ?
    `).get(customerId);

    return stats || { total_purchases: 0, total_spent: 0, total_paid: 0, total_due: 0, salesmen_count: 0 };
  }));
}

module.exports = { registerSalesmanHandlers };