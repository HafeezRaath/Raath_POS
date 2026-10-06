// ============================================================
//  server/controllers/salesController.js - Multi-Tenant Scoped
// ============================================================

const { query, transaction } = require('../config/db');

// Helper: Generate unique invoice number
function generateInvoiceNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `INV-${dateStr}-${randomNum}`;
}

exports.getSales = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { startDate, endDate, customerId, limit = 100 } = req.query;
    let sql = `
      SELECT s.*, 
             s.sale_date AS date,
             COALESCE(s.invoice_no, s.invoice_number) AS invoice_no,
             COALESCE(s.payment_mode, s.payment_method) AS payment_mode,
             c.name AS customer_name, c.phone AS customer_phone, u.name AS cashier_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.tenant_id = ? AND s.is_deleted = 0
    `;
    const params = [tenantId];

    if (startDate) {
      sql += ' AND s.sale_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND s.sale_date <= ?';
      params.push(endDate + ' 23:59:59');
    }
    if (customerId) {
      sql += ' AND s.customer_id = ?';
      params.push(customerId);
    }

    sql += ' ORDER BY s.id DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    const sales = await query(sql, params);
    const parsedSales = sales.map(s => {
      if (s.split_payments && typeof s.split_payments === 'string') {
        try { s.split_payments = JSON.parse(s.split_payments); } catch (e) {}
      }
      return s;
    });
    res.json({ success: true, data: parsedSales });
  } catch (error) {
    next(error);
  }
};

exports.getSaleById = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const sales = await query('SELECT * FROM sales WHERE tenant_id = ? AND id = ? AND is_deleted = 0', [tenantId, id]);
    if (sales.length === 0) {
      return res.status(404).json({ success: false, error: 'Sale not found' });
    }
    const sale = sales[0];
    if (sale.split_payments && typeof sale.split_payments === 'string') {
      try { sale.split_payments = JSON.parse(sale.split_payments); } catch (e) {}
    }
    const items = await query('SELECT * FROM sale_items WHERE tenant_id = ? AND sale_id = ?', [tenantId, id]);
    sale.items = items;
    res.json({ success: true, data: sale });
  } catch (error) {
    next(error);
  }
};

exports.createSale = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const payload = req.body.sale || req.body;
    const rawItems = req.body.items || payload.items || [];

    if (!rawItems || rawItems.length === 0) {
      return res.status(400).json({ success: false, error: 'Cannot create sale without items' });
    }

    const invNum = payload.invoice_no || payload.invoice_number || generateInvoiceNumber();
    const customerId = payload.customer_id || null;
    const customerName = payload.customer_name || 'Walk-in Customer';
    const userId = req.user?.id || payload.user_id || 1;
    const subtotal = parseFloat(payload.subtotal) || 0;
    const discount = parseFloat(payload.discount !== undefined ? payload.discount : (payload.billDiscount || 0)) || 0;
    const discountType = payload.discount_type || payload.billDiscountType || 'fixed';
    const tax = parseFloat(payload.tax) || 0;
    const shippingCost = parseFloat(payload.shipping_cost) || 0;
    const grandTotal = parseFloat(payload.grand_total !== undefined ? payload.grand_total : payload.grandTotal) || 0;
    let paidAmount = parseFloat(payload.paid_amount !== undefined ? payload.paid_amount : payload.paid) || 0;
    const changeAmount = parseFloat(payload.change_amount !== undefined ? payload.change_amount : payload.change) || 0;
    let dueAmount = parseFloat(payload.due_amount !== undefined ? payload.due_amount : payload.due) || 0;
    let paymentMethod = payload.payment_mode || payload.payment_method || 'cash';
    const accountId = payload.account_id || req.body.account_id || null;
    const notes = payload.notes || '';
    const saleDate = payload.date ? new Date(payload.date) : (payload.sale_date ? new Date(payload.sale_date) : new Date());

    // Multi-account split payments
    const rawSplit = payload.split_payments || payload.splitPayments || req.body.split_payments || null;
    let splitPaymentsList = null;
    if (Array.isArray(rawSplit) && rawSplit.length > 0) {
      splitPaymentsList = rawSplit.filter(sp => (parseFloat(sp.amount) || 0) > 0);
      if (splitPaymentsList.length > 0) {
        paymentMethod = 'split';
        const totalSplit = splitPaymentsList.reduce((sum, sp) => sum + (parseFloat(sp.amount) || 0), 0);
        paidAmount = totalSplit;
        dueAmount = Math.max(0, grandTotal - paidAmount);
      }
    }

    const status = payload.payment_status || (dueAmount > 0 ? (paidAmount > 0 ? 'partial' : 'due') : 'completed');
    const fbrStatus = payload.fbr_status || (payload.fbr_enabled ? 'SYNCED' : 'PENDING');
    const fbrReference = payload.dummy_fbr_reference || payload.fbr_reference || null;

    const createdSaleId = await transaction(async (conn) => {
      // 1. Insert into sales
      const insertSaleSql = `
        INSERT INTO sales (
          tenant_id, invoice_number, invoice_no, customer_id, customer_name, user_id,
          subtotal, discount, discount_type, tax, shipping_cost,
          grand_total, paid_amount, change_amount, due_amount,
          payment_method, payment_mode, account_id, notes, split_payments, sale_date,
          status, fbr_status, fbr_reference
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const [saleRes] = await conn.query(insertSaleSql, [
        tenantId, invNum, invNum, customerId, customerName, userId,
        subtotal, discount, discountType, tax, shippingCost,
        grandTotal, paidAmount, changeAmount, dueAmount,
        paymentMethod, paymentMethod, accountId, notes,
        splitPaymentsList ? JSON.stringify(splitPaymentsList) : null,
        saleDate, status, fbrStatus, fbrReference
      ]);

      const saleId = saleRes.insertId;

      // 2. Insert items & deduct inventory
      for (const item of rawItems) {
        const prodId = item.product_id || item.productId || item.id;
        const variantId = item.product_variant_id || item.variant_id || item.variantId || null;
        const qty = parseFloat(item.quantity !== undefined ? item.quantity : (item.qty || 1)) || 1;
        const price = parseFloat(item.price !== undefined ? item.price : (item.unit_price || item.sale_price || 0)) || 0;
        const pCost = parseFloat(item.purchase_price !== undefined ? item.purchase_price : (item.cost_price || item.costPrice || 0)) || 0;
        const disc = parseFloat(item.discount || 0);
        const total = parseFloat(item.total !== undefined ? item.total : (qty * price)) || (qty * price);
        const prodName = item.product_name || item.name || '';

        await conn.query(
          `INSERT INTO sale_items (tenant_id, sale_id, product_id, product_name, variant_id, quantity, unit_price, purchase_price, discount, total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [tenantId, saleId, prodId, prodName, variantId, qty, price, pCost, disc, total]
        );

        // Deduct inventory from variant if available
        if (variantId) {
          await conn.query(
            'UPDATE product_variants SET stock = stock - ? WHERE tenant_id = ? AND id = ?',
            [qty, tenantId, variantId]
          );
        }

        // Deduct inventory from parent product
        if (prodId) {
          await conn.query(
            'UPDATE products SET stock = stock - ? WHERE tenant_id = ? AND id = ?',
            [qty, tenantId, prodId]
          );
        }
      }

      // 3. Customer Ledger / Balance if due
      if (customerId && dueAmount > 0) {
        await conn.query(
          'UPDATE customers SET current_balance = current_balance + ? WHERE tenant_id = ? AND id = ?',
          [dueAmount, tenantId, customerId]
        );

        await conn.query(
          `INSERT INTO customer_ledger (tenant_id, customer_id, description, debit, credit, balance, reference_type, reference_id)
           VALUES (?, ?, ?, ?, 0, (SELECT current_balance FROM customers WHERE tenant_id = ? AND id = ?), 'sale', ?)`,
          [tenantId, customerId, `Invoice #${invNum}`, dueAmount, tenantId, customerId, saleId]
        );
      }

      // 4. Update Accounts & Transactions
      if (splitPaymentsList && splitPaymentsList.length > 0) {
        // Multi-method split payment: credit each designated account separately
        for (const sp of splitPaymentsList) {
          const spAmt = parseFloat(sp.amount) || 0;
          const spAccId = sp.account_id || sp.accountId;
          const spLabel = sp.account_name || sp.name || sp.method || 'Split';
          if (spAmt > 0 && spAccId) {
            await conn.query(
              'UPDATE accounts SET current_balance = current_balance + ? WHERE tenant_id = ? AND id = ?',
              [spAmt, tenantId, spAccId]
            );

            await conn.query(
              `INSERT INTO account_transactions (tenant_id, account_id, type, amount, balance_after, description, reference_type, reference_id, date)
               VALUES (?, ?, 'credit', ?, (SELECT current_balance FROM accounts WHERE tenant_id = ? AND id = ?), ?, 'sale', ?, CURDATE())`,
              [tenantId, spAccId, spAmt, tenantId, spAccId, `Sale: ${invNum} - (${spLabel}: Rs. ${spAmt})`, saleId]
            );
          }
        }
      } else if (accountId && paidAmount > 0) {
        // Single account payment
        const actualCredit = Math.max(0, paidAmount - changeAmount);
        if (actualCredit > 0) {
          await conn.query(
            'UPDATE accounts SET current_balance = current_balance + ? WHERE tenant_id = ? AND id = ?',
            [actualCredit, tenantId, accountId]
          );

          await conn.query(
            `INSERT INTO account_transactions (tenant_id, account_id, type, amount, balance_after, description, reference_type, reference_id, date)
             VALUES (?, ?, 'credit', ?, (SELECT current_balance FROM accounts WHERE tenant_id = ? AND id = ?), ?, 'sale', ?, CURDATE())`,
            [tenantId, accountId, actualCredit, tenantId, accountId, `Sale: ${invNum} - ${customerName}`, saleId]
          );
        }
      }

      return saleId;
    });

    const [finalSale] = await query('SELECT * FROM sales WHERE tenant_id = ? AND id = ?', [tenantId, createdSaleId]);
    const finalItems = await query('SELECT * FROM sale_items WHERE tenant_id = ? AND sale_id = ?', [tenantId, createdSaleId]);
    finalSale.items = finalItems;

    res.status(201).json({
      success: true,
      data: {
        ...finalSale,
        id: createdSaleId,
        lastInsertRowid: createdSaleId,
        date: finalSale.sale_date,
        invoice_no: finalSale.invoice_no || finalSale.invoice_number
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.returnSale = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { sale_id, items = [], total_refund = 0, reason = '', payment_method = 'cash', account_id = null } = req.body;
    const returnNumber = `RET-${Date.now().toString().slice(-6)}`;

    await transaction(async (conn) => {
      // 1. Insert return header
      const [retRes] = await conn.query(
        `INSERT INTO sale_returns (tenant_id, return_number, sale_id, total_refund, payment_method, account_id, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [tenantId, returnNumber, sale_id || null, total_refund, payment_method, account_id, reason]
      );
      const returnId = retRes.insertId;

      // 2. Insert items & restore inventory
      for (const it of items) {
        await conn.query(
          `INSERT INTO sale_return_items (tenant_id, sale_return_id, product_id, quantity, unit_price, total)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [tenantId, returnId, it.product_id, it.quantity, it.unit_price, it.total]
        );

        await conn.query(
          'UPDATE products SET stock = stock + ? WHERE tenant_id = ? AND id = ?',
          [it.quantity, tenantId, it.product_id]
        );
      }

      // 3. Deduct from account if refunded
      if (account_id && total_refund > 0) {
        await conn.query('UPDATE accounts SET current_balance = current_balance - ? WHERE tenant_id = ? AND id = ?', [total_refund, tenantId, account_id]);
      }
    });

    res.json({ success: true, message: 'Sale return processed successfully', returnNumber });
  } catch (error) {
    next(error);
  }
};

exports.getAllSaleItems = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { saleId } = req.query;
    let sql = `
      SELECT si.*, 
             si.variant_id AS product_variant_id,
             p.name AS product_name, 
             pv.sku
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.id
      LEFT JOIN product_variants pv ON si.variant_id = pv.id
      WHERE si.tenant_id = ?
    `;
    const params = [tenantId];
    if (saleId) {
      sql += ' AND si.sale_id = ?';
      params.push(saleId);
    }
    sql += ' ORDER BY si.id DESC';
    const items = await query(sql, params);
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
};

exports.deleteSale = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    await query('UPDATE sales SET is_deleted = 1 WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    res.json({ success: true, message: 'Sale deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.updateSale = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const {
      notes,
      status,
      payment_status,
      grand_total,
      subtotal,
      paid_amount,
      due_amount,
      change_amount
    } = req.body;

    const finalStatus = status || payment_status;

    await query(
      `UPDATE sales SET
        notes = COALESCE(?, notes),
        status = COALESCE(?, status),
        grand_total = COALESCE(?, grand_total),
        subtotal = COALESCE(?, subtotal),
        paid_amount = COALESCE(?, paid_amount),
        due_amount = COALESCE(?, due_amount),
        change_amount = COALESCE(?, change_amount)
       WHERE tenant_id = ? AND id = ?`,
      [
        notes !== undefined ? notes : null,
        finalStatus !== undefined ? finalStatus : null,
        grand_total !== undefined ? grand_total : null,
        subtotal !== undefined ? subtotal : null,
        paid_amount !== undefined ? paid_amount : null,
        due_amount !== undefined ? due_amount : null,
        change_amount !== undefined ? change_amount : null,
        tenantId,
        id
      ]
    );

    const [updated] = await query('SELECT * FROM sales WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    res.json({ success: true, message: 'Sale updated successfully', data: updated });
  } catch (error) {
    next(error);
  }
};
