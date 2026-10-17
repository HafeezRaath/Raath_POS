// ============================================================
//  server/controllers/customerController.js - Multi-Tenant Scoped
// ============================================================

const { query, transaction } = require('../config/db');

exports.getCustomers = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const rows = await query('SELECT * FROM customers WHERE tenant_id = ? AND is_deleted = 0 ORDER BY id DESC', [tenantId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.getCustomerById = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const rows = await query('SELECT * FROM customers WHERE tenant_id = ? AND id = ? AND is_deleted = 0', [tenantId, id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.createCustomer = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const {
      name, phone = '', email = '', address = '', city = '',
      cnic = '', credit_limit = 0, opening_balance = 0, status = 'active'
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Customer name is required' });
    }

    const opBal = parseFloat(opening_balance) || 0;
    const result = await query(
      `INSERT INTO customers (tenant_id, name, phone, email, address, city, cnic, credit_limit, opening_balance, current_balance, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, name.trim(), phone, email, address, city, cnic, credit_limit, opBal, opBal, status]
    );

    if (opBal !== 0) {
      await query(
        `INSERT INTO customer_ledger 
         (tenant_id, customer_id, date, type, amount, previous_balance, balance_after, debit, credit, balance, description, reference_type)
         VALUES (?, ?, NOW(), 'opening_balance', ?, 0, ?, ?, ?, ?, 'Opening Balance', 'opening_balance')`,
        [tenantId, result.insertId, opBal, opBal, opBal > 0 ? opBal : 0, opBal < 0 ? Math.abs(opBal) : 0, opBal]
      ).catch(() => {});
    }

    const created = await query('SELECT * FROM customers WHERE tenant_id = ? AND id = ?', [tenantId, result.insertId]);
    res.status(201).json({ success: true, data: created[0] });
  } catch (error) {
    next(error);
  }
};

exports.updateCustomer = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const { name, phone, email, address, city, district, province, shop_name, customer_type, cnic, credit_limit, payment_terms, status, notes } = req.body;

    await query(
      `UPDATE customers SET
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        address = COALESCE(?, address),
        city = COALESCE(?, city),
        district = COALESCE(?, district),
        province = COALESCE(?, province),
        shop_name = COALESCE(?, shop_name),
        customer_type = COALESCE(?, customer_type),
        cnic = COALESCE(?, cnic),
        credit_limit = COALESCE(?, credit_limit),
        payment_terms = COALESCE(?, payment_terms),
        status = COALESCE(?, status),
        notes = COALESCE(?, notes)
       WHERE tenant_id = ? AND id = ? AND is_deleted = 0`,
      [name, phone, email, address, city, district, province, shop_name, customer_type, cnic, credit_limit, payment_terms, status, notes, tenantId, id]
    );

    const updated = await query('SELECT * FROM customers WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    next(error);
  }
};

exports.deleteCustomer = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    await query('UPDATE customers SET is_deleted = 1, deleted_at = NOW() WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    res.json({ success: true, message: 'Customer deleted' });
  } catch (error) {
    next(error);
  }
};

exports.getCustomerLedger = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;

    // 1. Backfill any sales for this customer missing from customer_ledger
    try {
      const missingSales = await query(
        `SELECT s.* FROM sales s
         WHERE s.tenant_id = ? AND s.customer_id = ? AND s.is_deleted = 0
           AND s.id NOT IN (
             SELECT reference_id FROM customer_ledger 
             WHERE tenant_id = ? AND customer_id = ? AND reference_type = 'sale' AND reference_id IS NOT NULL
           )`,
        [tenantId, id, tenantId, id]
      );

      if (Array.isArray(missingSales) && missingSales.length > 0) {
        for (const ms of missingSales) {
          const sItems = await query('SELECT * FROM sale_items WHERE tenant_id = ? AND sale_id = ?', [tenantId, ms.id]);
          const due = parseFloat(ms.due_amount) || 0;
          const paid = parseFloat(ms.paid_amount) || 0;
          const grand = parseFloat(ms.grand_total) || 0;
          const lType = due > 0 ? (paid > 0 ? 'partial_sale' : 'credit_sale') : 'cash_sale';
          const inv = ms.invoice_no || ms.invoice_number || `INV-${ms.id}`;
          const itemsJson = JSON.stringify((sItems || []).map(i => ({
            name: i.product_name || i.name || 'Item',
            quantity: parseFloat(i.quantity) || 1,
            price: parseFloat(i.unit_price || i.price) || 0,
            discount: parseFloat(i.discount) || 0,
            total: parseFloat(i.total) || 0
          })));
          const itemSumm = (sItems || []).map(i => `${i.product_name || 'Item'} (${parseFloat(i.quantity) || 1}x)`).slice(0, 3).join(', ');

          await query(
            `INSERT INTO customer_ledger
             (tenant_id, customer_id, date, type, amount, previous_balance, balance_after, debit, credit, balance, description, payment_mode, reference_type, reference_no, reference_id, sale_id, items_json)
             VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 'sale', ?, ?, ?, ?)`,
            [
              tenantId, id, ms.sale_date || ms.created_at || new Date(), lType, grand,
              due, grand, paid, due, `Invoice #${inv}${itemSumm ? ': ' + itemSumm : ''}`,
              ms.payment_mode || ms.payment_method || 'cash', inv, ms.id, ms.id, itemsJson
            ]
          ).catch(() => {});
        }
      }
    } catch (bfErr) {
      console.warn('[customerLedger] backfill warning:', bfErr.message);
    }

    // 2. Query all customer_ledger rows
    const rows = await query('SELECT * FROM customer_ledger WHERE tenant_id = ? AND customer_id = ? ORDER BY date DESC, id DESC', [tenantId, id]);

    // 3. Normalize items, invoice_no, and numbers
    for (const r of rows) {
      if (r.sale_id && (!r.items_json || r.items_json === '[]')) {
        const sItems = await query('SELECT * FROM sale_items WHERE tenant_id = ? AND sale_id = ?', [tenantId, r.sale_id]);
        r.items = (sItems || []).map(i => ({
          name: i.product_name || 'Item',
          quantity: parseFloat(i.quantity) || 1,
          price: parseFloat(i.unit_price || i.price) || 0,
          discount: parseFloat(i.discount) || 0,
          total: parseFloat(i.total) || 0
        }));
      } else if (r.items_json) {
        try {
          r.items = typeof r.items_json === 'string' ? JSON.parse(r.items_json) : r.items_json;
        } catch (e) {
          r.items = [];
        }
      } else {
        r.items = [];
      }
      r.amount = parseFloat(r.amount) || 0;
      r.previous_balance = parseFloat(r.previous_balance) || 0;
      r.balance_after = parseFloat(r.balance_after) || 0;
      r.invoice_no = r.reference_no || (r.sale_id ? `INV-${r.sale_id}` : '');
    }

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.addCustomerPayment = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const rawId = req.params.id;
    const customerId = (rawId && rawId !== '[object Object]') ? rawId : req.body.customer_id || req.body.id;
    const { 
      amount, 
      payment_method, 
      payment_mode, 
      account_id = null, 
      description, 
      note,
      reference_no,
      date 
    } = req.body;

    const paidAmount = parseFloat(amount) || 0;
    const paymentMethod = payment_method || payment_mode || 'cash';
    const paymentDate = date ? new Date(date) : new Date();
    const refNo = reference_no || `PAY-${Date.now().toString().slice(-6)}`;

    if (!customerId) {
      return res.status(400).json({ success: false, error: 'Customer ID is required' });
    }

    if (paidAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid payment amount' });
    }

    await transaction(async (conn) => {
      // Fetch customer balance & name
      const [custRows] = await conn.query('SELECT current_balance, name FROM customers WHERE tenant_id = ? AND id = ?', [tenantId, customerId]);
      const cust = (Array.isArray(custRows) && custRows.length > 0) ? custRows[0] : null;
      const prevBal = cust ? (parseFloat(cust.current_balance) || 0) : 0;
      const newBal = prevBal - paidAmount;
      const noteText = description || note || `Payment from ${cust?.name || ('Customer #' + customerId)}`;

      // 1. Deduct customer balance
      await conn.query('UPDATE customers SET current_balance = current_balance - ? WHERE tenant_id = ? AND id = ?', [paidAmount, tenantId, customerId]);

      // 2. Add complete ledger entry with all details
      await conn.query(
        `INSERT INTO customer_ledger 
         (tenant_id, customer_id, date, type, amount, previous_balance, balance_after, debit, credit, balance, description, payment_mode, reference_type, reference_no)
         VALUES (?, ?, ?, 'payment', ?, ?, ?, 0, ?, ?, ?, ?, 'payment', ?)`,
        [tenantId, customerId, paymentDate, -paidAmount, prevBal, newBal, paidAmount, newBal, noteText, paymentMethod, refNo]
      );

      // 3. Add to account if specified
      if (account_id) {
        await conn.query('UPDATE accounts SET current_balance = current_balance + ? WHERE tenant_id = ? AND id = ?', [paidAmount, tenantId, account_id]);
        await conn.query(
          `INSERT INTO account_transactions (tenant_id, account_id, type, amount, balance_after, description, reference_type, reference_no, date)
           VALUES (?, ?, 'credit', ?, (SELECT current_balance FROM accounts WHERE tenant_id = ? AND id = ?), ?, 'customer_payment', ?, CURDATE())`,
          [tenantId, account_id, paidAmount, tenantId, account_id, `Payment from ${cust?.name || ('Customer #' + customerId)}: ${noteText}`, refNo]
        );
      }

      // 4. Record into payments table
      await conn.query(
        `INSERT INTO payments (tenant_id, customer_id, account_id, amount, type, payment_mode, note, date, reference_no)
         VALUES (?, ?, ?, ?, 'customer_payment', ?, ?, ?, ?)`,
        [tenantId, customerId, account_id || null, paidAmount, paymentMethod, noteText, paymentDate, refNo]
      );
    });

    const [updatedCust] = await query('SELECT * FROM customers WHERE tenant_id = ? AND id = ?', [tenantId, customerId]);
    res.json({ success: true, data: updatedCust });
  } catch (error) {
    next(error);
  }
};
