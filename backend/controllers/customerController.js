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
    const { name, phone, email, address, city, cnic, credit_limit, status } = req.body;

    await query(
      `UPDATE customers SET
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        address = COALESCE(?, address),
        city = COALESCE(?, city),
        cnic = COALESCE(?, cnic),
        credit_limit = COALESCE(?, credit_limit),
        status = COALESCE(?, status)
       WHERE tenant_id = ? AND id = ? AND is_deleted = 0`,
      [name, phone, email, address, city, cnic, credit_limit, status, tenantId, id]
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
    const rows = await query('SELECT * FROM customer_ledger WHERE tenant_id = ? AND customer_id = ? ORDER BY id DESC', [tenantId, id]);
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
      date 
    } = req.body;

    const paidAmount = parseFloat(amount) || 0;
    const paymentMethod = payment_method || payment_mode || 'cash';
    const noteText = description || note || `Payment from Customer #${customerId}`;
    const paymentDate = date ? new Date(date) : new Date();

    if (!customerId) {
      return res.status(400).json({ success: false, error: 'Customer ID is required' });
    }

    if (paidAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid payment amount' });
    }

    await transaction(async (conn) => {
      // 1. Deduct customer balance
      await conn.query('UPDATE customers SET current_balance = current_balance - ? WHERE tenant_id = ? AND id = ?', [paidAmount, tenantId, customerId]);

      // 2. Add ledger entry
      await conn.query(
        `INSERT INTO customer_ledger (tenant_id, customer_id, description, debit, credit, balance, reference_type)
         VALUES (?, ?, ?, 0, ?, (SELECT current_balance FROM customers WHERE tenant_id = ? AND id = ?), 'payment')`,
        [tenantId, customerId, noteText, paidAmount, tenantId, customerId]
      );

      // 3. Add to account if specified
      if (account_id) {
        await conn.query('UPDATE accounts SET current_balance = current_balance + ? WHERE tenant_id = ? AND id = ?', [paidAmount, tenantId, account_id]);
        await conn.query(
          `INSERT INTO account_transactions (tenant_id, account_id, type, amount, balance_after, description, reference_type, date)
           VALUES (?, ?, 'credit', ?, (SELECT current_balance FROM accounts WHERE tenant_id = ? AND id = ?), ?, 'customer_payment', CURDATE())`,
          [tenantId, account_id, paidAmount, tenantId, account_id, `Payment from Customer #${customerId}`]
        );
      }

      // 4. Record into payments table
      await conn.query(
        `INSERT INTO payments (tenant_id, customer_id, amount, type, payment_mode, note, date)
         VALUES (?, ?, ?, 'customer_payment', ?, ?, ?)`,
        [tenantId, customerId, paidAmount, paymentMethod, noteText, paymentDate]
      );
    });

    const [updatedCust] = await query('SELECT * FROM customers WHERE tenant_id = ? AND id = ?', [tenantId, customerId]);
    res.json({ success: true, data: updatedCust });
  } catch (error) {
    next(error);
  }
};
