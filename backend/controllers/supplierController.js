// ============================================================
//  server/controllers/supplierController.js - Multi-Tenant Scoped
// ============================================================

const { query, transaction } = require('../config/db');

// FIX E-1: balances/dates computed in JS and bound as plain params — the
// SQLite adapter (LOCAL_MODE) mangles parenthesised expressions inside
// INSERT ... VALUES for syncable tables. Balance is re-read on the same
// connection AFTER the balance UPDATE, identical to the old subquery value.
const pktToday = () => new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
async function readBalanceAfter(conn, sql, params) {
  const [rows] = await conn.query(sql, params);
  return (Array.isArray(rows) && rows.length > 0) ? parseFloat(rows[0].current_balance) || 0 : 0;
}

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
    const rows = await query(
      `SELECT sl.*,
              COALESCE(sl.type, sl.reference_type, 'transaction') AS type,
              COALESCE(sl.amount, GREATEST(sl.debit, sl.credit), 0) AS amount
       FROM supplier_ledger sl
       WHERE sl.tenant_id = ? AND sl.supplier_id = ?
       ORDER BY sl.id DESC`,
      [tenantId, id]
    );
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
      purchase_id,
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
      await conn.query('UPDATE suppliers SET current_balance = GREATEST(0, current_balance - ?) WHERE tenant_id = ? AND id = ?', [paidAmount, tenantId, supplierId]);

      // 2. Add ledger entry (Debit reduces liability, Credit is 0)
      const supPayBalAfter = await readBalanceAfter(conn, 'SELECT current_balance FROM suppliers WHERE tenant_id = ? AND id = ?', [tenantId, supplierId]);
      await conn.query(
        `INSERT INTO supplier_ledger (tenant_id, supplier_id, date, type, amount, description, debit, credit, balance, reference_type)
         VALUES (?, ?, ?, 'payment', ?, ?, ?, 0, ?, 'payment')`,
        [tenantId, supplierId, paymentDate, paidAmount, noteText, paidAmount, supPayBalAfter]
      );

      // 3. Deduct from account if specified
      if (account_id) {
        await conn.query('UPDATE accounts SET current_balance = current_balance - ? WHERE tenant_id = ? AND id = ?', [paidAmount, tenantId, account_id]);
        const supPayAccBalAfter = await readBalanceAfter(conn, 'SELECT current_balance FROM accounts WHERE tenant_id = ? AND id = ?', [tenantId, account_id]);
        await conn.query(
          `INSERT INTO account_transactions (tenant_id, account_id, type, amount, balance_after, description, reference_type, date)
           VALUES (?, ?, 'debit', ?, ?, ?, 'supplier_payment', ?)`,
          [tenantId, account_id, paidAmount, supPayAccBalAfter, `Payment to Supplier #${supplierId}`, pktToday()]
        );
      }

      // Determine purchase reference if available
      let refNo = null;
      if (purchase_id) {
        const [poRows] = await conn.query('SELECT purchase_no, purchase_number FROM purchases WHERE tenant_id = ? AND id = ?', [tenantId, purchase_id]);
        if (poRows.length > 0) {
          refNo = poRows[0].purchase_no || poRows[0].purchase_number;
        }
      }

      // 4. Record into payments table
      await conn.query(
        `INSERT INTO payments (tenant_id, supplier_id, amount, type, payment_mode, note, date, account_id, reference_no)
         VALUES (?, ?, ?, 'supplier_payment', ?, ?, ?, ?, ?)`,
        [tenantId, supplierId, paidAmount, paymentMethod, noteText, paymentDate, account_id || null, refNo]
      );

      // 5. UPDATE PURCHASES so purchase paid/due stays 100% synchronized with supplier balance!
      if (purchase_id) {
        const [pRows] = await conn.query('SELECT * FROM purchases WHERE tenant_id = ? AND id = ? AND is_deleted = 0', [tenantId, purchase_id]);
        if (pRows.length > 0) {
          const p = pRows[0];
          const newPaid = (parseFloat(p.paid_amount) || 0) + paidAmount;
          const newDue = Math.max(0, (parseFloat(p.grand_total) || 0) - newPaid);
          const newStatus = newDue <= 0 ? 'paid' : (newPaid > 0 ? 'partial' : 'due');
          await conn.query(
            'UPDATE purchases SET paid_amount = ?, due_amount = ?, payment_status = ? WHERE tenant_id = ? AND id = ?',
            [newPaid, newDue, newStatus, tenantId, purchase_id]
          );
        }
      } else {
        // General payment: Allocate to unpaid / partially paid purchases of this supplier (FIFO)
        let remainingToAllocate = paidAmount;
        const [unpaidPurchases] = await conn.query(
          'SELECT * FROM purchases WHERE tenant_id = ? AND supplier_id = ? AND is_deleted = 0 AND due_amount > 0 ORDER BY purchase_date ASC, id ASC',
          [tenantId, supplierId]
        );
        for (const p of unpaidPurchases) {
          if (remainingToAllocate <= 0) break;
          const pDue = parseFloat(p.due_amount) || 0;
          const alloc = Math.min(pDue, remainingToAllocate);
          const newPaid = (parseFloat(p.paid_amount) || 0) + alloc;
          const newDue = Math.max(0, (parseFloat(p.grand_total) || 0) - newPaid);
          const newStatus = newDue <= 0 ? 'paid' : (newPaid > 0 ? 'partial' : 'due');
          await conn.query(
            'UPDATE purchases SET paid_amount = ?, due_amount = ?, payment_status = ? WHERE tenant_id = ? AND id = ?',
            [newPaid, newDue, newStatus, tenantId, p.id]
          );
          remainingToAllocate -= alloc;
        }
      }
    });

    const [updatedSup] = await query('SELECT * FROM suppliers WHERE tenant_id = ? AND id = ?', [tenantId, supplierId]);
    res.json({ success: true, data: updatedSup });
  } catch (error) {
    next(error);
  }
};
