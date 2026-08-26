const { ipcMain } = require('electron');
const { getDb } = require('../database/connection');
const { log, LOG_LEVELS } = require('../utils/logger');
const { logAudit } = require('../utils/audit');
const { 
  sanitizeObject, 
  sanitizeInput, 
  validatePositiveNumber, 
  validateDate, 
  requiredId, 
  validateStockAvailability 
} = require('../utils/validators');
const { calculateSaleTotals, getCustomerBalance } = require('../utils/calculations');
const { createHandler } = require('./helpers');

// Local helper (agar utils mein ho toh wahan se import kar laina)
const safeJsonParse = (str, defaultValue = []) => {
  try { return JSON.parse(str); } catch { return defaultValue; }
};

function registerSalesHandlers() {
  // ─── 1. CREATE SALE ───
  ipcMain.handle('create-sale', createHandler(async (event, { sale, items }) => {
    const db = getDb();
    const transaction = db.transaction((saleData, saleItems) => {
      let calculatedSubtotal = 0;
      let calculatedItemDiscount = 0;
      
      for (const item of saleItems) {
        const qty = Number(item.quantity || item.qty) || 0;
        const price = Number(item.price) || 0;
        const discount = Number(item.discount) || 0;
        const itemTotal = (price * qty) - discount;
        calculatedSubtotal += itemTotal;
        calculatedItemDiscount += discount;
        
        const clientItemTotal = Number(item.total) || 0;
        const tolerance = 0.01;
        if (Math.abs(itemTotal - clientItemTotal) > tolerance) {
          throw new Error(`Item total mismatch for variant ${item.product_variant_id || item.variantId}. Client: ${clientItemTotal}, Server: ${itemTotal}`);
        }
      }
      
      calculatedSubtotal = Math.round(calculatedSubtotal * 100) / 100;
      calculatedItemDiscount = Math.round(calculatedItemDiscount * 100) / 100;

      for (const item of saleItems) {
        const variantId = item.product_variant_id || item.variantId;
        const qty = Number(item.quantity || item.qty) || 0;
        const validation = validateStockAvailability(db, variantId, qty);
        if (!validation.available) throw new Error(validation.error);
      }

      const taxRate = parseFloat(saleData.fbr_tax_rate) || 0;
      const taxType = saleData.tax_type || 'inclusive';
      const discount = parseFloat(saleData.discount) || 0;
      const calculated = calculateSaleTotals(saleItems, discount, taxRate, taxType);

      const tolerance = 0.01;
      if (Math.abs(calculated.subtotal - (parseFloat(saleData.subtotal) || 0)) > tolerance) {
        throw new Error(`Subtotal mismatch. Client: ${saleData.subtotal}, Server: ${calculated.subtotal}`);
      }
      if (Math.abs(calculated.grandTotal - (parseFloat(saleData.grand_total) || 0)) > tolerance) {
        throw new Error(`Grand total mismatch. Client: ${saleData.grand_total}, Server: ${calculated.grandTotal}`);
      }
      if (Math.abs(calculated.tax - (parseFloat(saleData.tax) || 0)) > tolerance) {
        throw new Error(`Tax mismatch. Client: ${saleData.tax}, Server: ${calculated.tax}`);
      }

      const paidAmount = validatePositiveNumber(saleData.paid_amount, 0);
      const dueAmount = Math.max(0, calculated.grandTotal - paidAmount);
      const changeAmount = Math.max(0, paidAmount - calculated.grandTotal);

      let customerName = sanitizeInput(saleData.customer_name || 'Walk-in Customer');
      let customerNtn = sanitizeInput(saleData.customer_ntn || '');
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

      const parentSql = `INSERT INTO sales (
        invoice_no, customer_id, customer_name, customer_ntn,
        subtotal, item_discount, discount, tax, tax_type, tax_rate, grand_total,
        paid_amount, due_amount, change_amount, payment_mode,
        payment_status, sale_type, date, fbr_enabled, fbr_mode,
        fbr_tax_rate, fbr_tax_amount, fbr_business_type,
        dummy_fbr_reference, fbr_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const parentParams = [
        saleData.invoice_no,
        saleData.customer_id || null,
        customerName,
        customerNtn,
        calculated.subtotal,
        calculated.itemDiscount,
        calculated.discount,
        calculated.tax,
        taxType,
        taxRate,
        calculated.grandTotal,
        paidAmount,
        dueAmount,
        changeAmount,
        sanitizeInput(saleData.payment_mode || 'cash'),
        sanitizeInput(saleData.payment_status || 'paid'),
        sanitizeInput(saleData.sale_type || 'retail'),
        saleData.date || new Date().toISOString(),
        saleData.fbr_enabled ? 1 : 0,
        saleData.fbr_mode ? 1 : 0,
        taxRate,
        calculated.tax,
        sanitizeInput(saleData.fbr_business_type || 'retail'),
        saleData.dummy_fbr_reference || null,
        'PENDING'
      ];

      const saleResult = db.prepare(parentSql).run(...parentParams);
      const saleId = saleResult.lastInsertRowid;

      const itemSql = `INSERT INTO sale_items (sale_id, product_variant_id, product_id, quantity, price, discount, total) VALUES (?, ?, ?, ?, ?, ?, ?)`;
      const stockSql = `UPDATE product_variants SET current_stock = current_stock - ? WHERE id = ?`;
      const insertItem = db.prepare(itemSql);
      const updateStock = db.prepare(stockSql);

      for (const item of saleItems) {
        const qty = Number(item.quantity || item.qty) || 0;
        const variantId = item.product_variant_id || item.variantId;
        const price = Number(item.price) || 0;
        const disc = Number(item.discount) || 0;
        const itemTotal = (price * qty) - disc;

        insertItem.run(
          saleId,
          variantId,
          item.product_id || item.productId || null,
          qty,
          price,
          disc,
          Math.round(itemTotal * 100) / 100
        );
        updateStock.run(qty, variantId);
      }

      for (const item of saleItems) {
        const variantId = item.product_variant_id || item.variantId;
        const productInfo = db.prepare(`SELECT p.is_serialized FROM product_variants pv JOIN products p ON pv.product_id = p.id WHERE pv.id = ?`).get(variantId);
        
        if (productInfo?.is_serialized) {
          const serialNumbers = item.serial_numbers || [];
          const qty = Number(item.quantity || item.qty) || 0;
          
          if (serialNumbers.length !== qty) {
            throw new Error(`Serial numbers required for ${qty} items, but ${serialNumbers.length} provided`);
          }
          
          let processedCount = 0;
          for (const serial of serialNumbers) {
            const serialRecord = db.prepare(`SELECT id, status FROM product_serialized_items WHERE product_variant_id = ? AND serial_number_or_imei = ? AND is_deleted = 0`).get(variantId, serial);
            
            if (!serialRecord) {
              throw new Error(`Serial number ${serial} not found in inventory`);
            }
            if (serialRecord.status !== 'available') {
              throw new Error(`Serial number ${serial} is already ${serialRecord.status}`);
            }
            
            db.prepare(`UPDATE product_serialized_items SET status = 'sold', sale_id = ? WHERE id = ?`).run(saleId, serialRecord.id);
            processedCount++;
            
            if (processedCount > qty) break;
          }
        }
      }

      if (saleData.customer_id) {
        const previousBalance = getCustomerBalance(db, saleData.customer_id);
        if (dueAmount > 0) {
          db.prepare(`UPDATE customers SET current_balance = current_balance + ? WHERE id = ?`).run(dueAmount, saleData.customer_id);
        }
        const balanceAfter = getCustomerBalance(db, saleData.customer_id);
        
        const itemsForLedger = saleItems.map(item => ({
          product_variant_id: item.product_variant_id || item.variantId,
          product_id: item.product_id || item.productId,
          name: item.name || item.product_name || '',
          quantity: Number(item.quantity || item.qty) || 0,
          price: Number(item.price) || 0,
          discount: Number(item.discount) || 0,
          total: Math.round(((Number(item.price) || 0) * (Number(item.quantity || item.qty) || 0) - (Number(item.discount) || 0)) * 100) / 100
        }));
        
        db.prepare(`
          INSERT INTO customer_ledger (
            customer_id, type, amount, previous_balance, balance_after, 
            description, payment_mode, reference_no, sale_id, date, items_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          saleData.customer_id,
          dueAmount > 0 ? 'credit_sale' : 'cash_sale',
          dueAmount,
          previousBalance,
          balanceAfter,
          `Sale ${saleData.invoice_no} - ${saleItems.length} items`,
          saleData.payment_mode || (dueAmount > 0 ? 'credit' : 'cash'),
          saleData.invoice_no,
          saleId,
          saleData.date || new Date().toISOString(),
          JSON.stringify(itemsForLedger)
        );
      }

      db.prepare(`INSERT INTO general_ledger (account_type, reference_id, debit, credit, description, date) VALUES (?, ?, ?, ?, ?, ?)`)
        .run('Sales Revenue', saleId, 0, calculated.subtotal - calculated.discount, `Sale ${saleData.invoice_no}`, saleData.date || new Date().toISOString());

      if (calculated.tax > 0) {
        db.prepare(`INSERT INTO general_ledger (account_type, reference_id, debit, credit, description, date) VALUES (?, ?, ?, ?, ?, ?)`)
          .run('Tax Payable', saleId, 0, calculated.tax, `Tax for Sale ${saleData.invoice_no}`, saleData.date || new Date().toISOString());
      }

      if (paidAmount > 0) {
        db.prepare(`INSERT INTO general_ledger (account_type, reference_id, debit, credit, description, date) VALUES (?, ?, ?, ?, ?, ?)`)
          .run('Cash/Bank', saleId, paidAmount, 0, `Payment for Sale ${saleData.invoice_no}`, saleData.date || new Date().toISOString());
      }

      if (dueAmount > 0) {
        db.prepare(`INSERT INTO general_ledger (account_type, reference_id, debit, credit, description, date) VALUES (?, ?, ?, ?, ?, ?)`)
          .run('Accounts Receivable', saleId, dueAmount, 0, `Due for Sale ${saleData.invoice_no}`, saleData.date || new Date().toISOString());
      }

      const fbrSetting = db.prepare("SELECT value FROM system_settings WHERE key = 'fbr_enabled'").get();
      if (fbrSetting?.value === '1' && saleData.fbr_enabled) {
        const existingFbr = db.prepare("SELECT id FROM fbr_invoices WHERE sale_id = ?").get(saleId);
        if (!existingFbr) {
          db.prepare(`INSERT INTO fbr_invoices (sale_id, invoice_no, fbr_status, retry_count, max_retries, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`)
            .run(saleId, saleData.invoice_no, 'PENDING', 0, 10);
        }
      }

      logAudit(saleData.created_by || 1, 'create', 'sales', saleId);
      return { id: saleId };
    });

    try {
      return transaction(sale, items);
    } catch (err) {
      log(LOG_LEVELS.ERROR, 'Create Sale Transaction Failed:', err);
      throw new Error(err.message);
    }
  }));

  // ─── 2. GET SALES ───
  ipcMain.handle('getSales', createHandler(async (event, filters = {}) => {
    const db = getDb();
    let sql = `SELECT s.*, c.name AS customer_name_db FROM sales s LEFT JOIN customers c ON c.id = s.customer_id WHERE s.is_deleted = 0`;
    const params = [];
    if (filters.fromDate) { sql += ` AND DATE(s.date) >= DATE(?)`; params.push(filters.fromDate); }
    if (filters.toDate) { sql += ` AND DATE(s.date) <= DATE(?)`; params.push(filters.toDate); }
    if (filters.customerId) { sql += ` AND s.customer_id = ?`; params.push(requiredId(filters.customerId, 'customerId')); }
    if (filters.paymentStatus) { sql += ` AND s.payment_status = ?`; params.push(sanitizeInput(filters.paymentStatus)); }
    if (filters.search) { sql += ` AND (s.invoice_no LIKE ? OR s.customer_name LIKE ?)`; const q = `%${sanitizeInput(filters.search)}%`; params.push(q, q); }
    sql += ` ORDER BY s.date DESC, s.id DESC`;
    if (filters.limit !== undefined) { const limit = Math.min(1000, Math.max(1, Number(filters.limit) || 50)); sql += ` LIMIT ?`; params.push(limit); }
    return db.prepare(sql).all(...params);
  }));

  // ─── 3. GET SALE BY ID ───
  ipcMain.handle('getSaleById', createHandler(async (event, id) => {
    const db = getDb();
    const saleId = requiredId(id, 'saleId');
    const sale = db.prepare(`SELECT s.*, c.name AS customer_name_db FROM sales s LEFT JOIN customers c ON c.id = s.customer_id WHERE s.id = ? AND s.is_deleted = 0`).get(saleId);
    if (!sale) return null;
    sale.items = db.prepare(`SELECT si.*, pv.sku, pv.variant_name, p.name AS product_name FROM sale_items si LEFT JOIN product_variants pv ON pv.id = si.product_variant_id LEFT JOIN products p ON p.id = COALESCE(si.product_id, pv.product_id) WHERE si.sale_id = ? ORDER BY si.id`).all(saleId);
    return sale;
  }));

  // ─── 4. GET SALE ITEMS ───
  ipcMain.handle('getSaleItems', createHandler(async (event, saleId) => {
    const db = getDb();
    return db.prepare(`SELECT si.*, pv.sku, pv.variant_name, p.name AS product_name FROM sale_items si LEFT JOIN product_variants pv ON pv.id = si.product_variant_id LEFT JOIN products p ON p.id = COALESCE(si.product_id, pv.product_id) WHERE si.sale_id = ? ORDER BY si.id`).all(requiredId(saleId, 'saleId'));
  }));

  // ─── 5. UPDATE SALE ───
  ipcMain.handle('updateSale', createHandler(async (event, id, data = {}) => {
    const db = getDb();
    const saleId = requiredId(id, 'saleId');
    const allowed = ['customer_name', 'customer_ntn', 'payment_mode', 'sale_type', 'notes'];
    const sanitized = sanitizeObject(data, allowed);
    const fields = [], values = [];
    for (const key of allowed) if (sanitized[key] !== undefined) { fields.push(`${key} = ?`); values.push(sanitized[key]); }
    if (!fields.length) return { changes: 0 };
    values.push(saleId);
    const result = db.prepare(`UPDATE sales SET ${fields.join(', ')} WHERE id = ? AND is_deleted = 0`).run(...values);
    if (result.changes !== 1) throw new Error('Sale not found or already deleted');
    logAudit(data.updated_by || 1, 'update', 'sales', saleId);
    return { changes: result.changes };
  }));

  // ─── 6. DELETE SALE ───
  ipcMain.handle('deleteSale', createHandler(async (event, id) => {
    const db = getDb();
    const saleId = requiredId(id, 'saleId');
    const transaction = db.transaction(() => {
      const sale = db.prepare(`SELECT * FROM sales WHERE id = ? AND is_deleted = 0`).get(saleId);
      if (!sale) throw new Error('Sale not found or already deleted');
      const items = db.prepare(`SELECT product_variant_id, quantity, serialized_item_id FROM sale_items WHERE sale_id = ?`).all(saleId);
      for (const item of items) {
        if (item.product_variant_id) db.prepare(`UPDATE product_variants SET current_stock = current_stock + ? WHERE id = ?`).run(item.quantity, item.product_variant_id);
        if (item.serialized_item_id) db.prepare(`UPDATE product_serialized_items SET status = 'available', sale_id = NULL WHERE id = ? AND sale_id = ?`).run(item.serialized_item_id, saleId);
      }
      if (sale.customer_id && Number(sale.due_amount) > 0) {
        const previous = getCustomerBalance(db, sale.customer_id);
        db.prepare(`UPDATE customers SET current_balance = current_balance - ? WHERE id = ?`).run(sale.due_amount, sale.customer_id);
        const after = getCustomerBalance(db, sale.customer_id);
        db.prepare(`INSERT INTO customer_ledger (customer_id,type,amount,previous_balance,balance_after,description,payment_mode,reference_no,sale_id,date) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(sale.customer_id, 'sale_reversal', -Number(sale.due_amount), previous, after, `Sale deleted: ${sale.invoice_no}`, 'adjustment', `REV-SALE-${saleId}`, saleId, new Date().toISOString());
      }
      db.prepare(`UPDATE sales SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ? AND is_deleted = 0`).run(saleId);
      logAudit(event.sender?.userId || 1, 'delete', 'sales', saleId);
    });
    transaction();
    return { success: true };
  }));

  // NOTE: db:getCustomerLedger, db:addCustomerPayment, db:adjustCustomerBalance, 
  // db:getAllCustomersWithBalance are registered in registerCustomerHandlers.
  // DO NOT duplicate here to avoid Electron IPC channel conflicts.
}

module.exports = { registerSalesHandlers };