// ============================================================
//  server/controllers/supplierController.js - Multi-Tenant Scoped
// ============================================================

const { query, transaction } = require('../config/db');

exports.getSuppliers = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const rows = await query('SELECT * FROM suppliers WHERE tenant_id = ? AND is_deleted = 0 ORDER BY id DESC', [tenantId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.getSupplierById = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const rows = await query('SELECT * FROM suppliers WHERE tenant_id = ? AND id = ? AND is_deleted = 0', [tenantId, id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.createSupplier = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const {
      name, company_name = '', phone = '', email = '',
      address = '', vat_ntn_number = '', opening_balance = 0, status = 'active'
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Supplier name is required' });
    }

    const opBal = parseFloat(opening_balance) || 0;
    const result = await query(
      `INSERT INTO suppliers (tenant_id, name, company_name, phone, email, address, vat_ntn_number, opening_balance, current_balance, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, name.trim(), company_name, phone, email, address, vat_ntn_number, opBal, opBal, status]
    );

    const created = await query('SELECT * FROM suppliers WHERE tenant_id = ? AND id = ?', [tenantId, result.insertId]);
    res.status(201).json({ success: true, data: created[0] });
  } catch (error) {
    next(error);
  }
};

exports.updateSupplier = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const { name, company_name, phone, email, address, vat_ntn_number, status } = req.body;

    await query(
      `UPDATE suppliers SET
        name = COALESCE(?, name),
        company_name = COALESCE(?, company_name),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        address = COALESCE(?, address),
        vat_ntn_number = COALESCE(?, vat_ntn_number),
        status = COALESCE(?, status)
       WHERE tenant_id = ? AND id = ? AND is_deleted = 0`,
      [name, company_name, phone, email, address, vat_ntn_number, status, tenantId, id]
    );

    const updated = await query('SELECT * FROM suppliers WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    next(error);
  }
};

exports.deleteSupplier = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    await query('UPDATE suppliers SET is_deleted = 1, deleted_at = NOW() WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    res.json({ success: true, message: 'Supplier deleted' });
  } catch (error) {
    next(error);
  }
};

exports.getSupplierLedger = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const rows = await query('SELECT * FROM supplier_ledger WHERE tenant_id = ? AND supplier_id = ? ORDER BY id DESC', [tenantId, id]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.addSupplierPayment = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const rawId = req.params.id;
    const supplierId = (rawId && rawId !== '[object Object]') ? rawId : req.body.supplier_id || req.body.id;
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
    const noteText = description || note || `Payment to Supplier #${supplierId}`;
    const paymentDate = date ? new Date(date) : new Date();

    if (!supplierId) {
      return res.status(400).json({ success: false, error: 'Supplier ID is required' });
    }

    if (paidAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid payment amount' });
    }

    await transaction(async (conn) => {
      // 1. Deduct supplier payable balance
      await conn.query('UPDATE suppliers SET current_balance = current_balance - ? WHERE tenant_id = ? AND id = ?', [paidAmount, tenantId, supplierId]);

      // 2. Add ledger entry
      await conn.query(
        `INSERT INTO supplier_ledger (tenant_id, supplier_id, description, debit, credit, balance, reference_type)
         VALUES (?, ?, ?, 0, ?, (SELECT current_balance FROM suppliers WHERE tenant_id = ? AND id = ?), 'payment')`,
        [tenantId, supplierId, noteText, paidAmount, tenantId, supplierId]
      );

      // 3. Deduct from account if specified
      if (account_id) {
        await conn.query('UPDATE accounts SET current_balance = current_balance - ? WHERE tenant_id = ? AND id = ?', [paidAmount, tenantId, account_id]);
        await conn.query(
          `INSERT INTO account_transactions (tenant_id, account_id, type, amount, balance_after, description, reference_type, date)
           VALUES (?, ?, 'debit', ?, (SELECT current_balance FROM accounts WHERE tenant_id = ? AND id = ?), ?, 'supplier_payment', CURDATE())`,
          [tenantId, account_id, paidAmount, tenantId, account_id, `Payment to Supplier #${supplierId}`]
        );
      }

      // 4. Record into payments table
      await conn.query(
        `INSERT INTO payments (tenant_id, supplier_id, amount, type, payment_mode, note, date)
         VALUES (?, ?, ?, 'supplier_payment', ?, ?, ?)`,
        [tenantId, supplierId, paidAmount, paymentMethod, noteText, paymentDate]
      );
    });

    const [updatedSup] = await query('SELECT * FROM suppliers WHERE tenant_id = ? AND id = ?', [tenantId, supplierId]);
    res.json({ success: true, data: updatedSup });
  } catch (error) {
    next(error);
  }
};
