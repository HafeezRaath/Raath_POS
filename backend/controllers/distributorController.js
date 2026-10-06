// ============================================================
//  backend/controllers/distributorController.js - Multi-Tenant Scoped
// ============================================================

const { query, transaction } = require('../config/db');

// --- Distributors CRUD ---
exports.getDistributors = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { status, search } = req.query;
    let sql = `SELECT * FROM distributors WHERE tenant_id = ? AND is_deleted = 0`;
    const params = [tenantId];

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    if (search) {
      sql += ` AND (name LIKE ? OR company_name LIKE ? OR phone LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    sql += ` ORDER BY id DESC`;

    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.getDistributorById = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const rows = await query(`SELECT * FROM distributors WHERE tenant_id = ? AND id = ? AND is_deleted = 0`, [tenantId, id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Distributor not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.createDistributor = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const {
      name, company_name = '', phone = '', email = '', cnic = '',
      address = '', city = '', district = '', province = '', territory = '',
      opening_balance = 0, credit_limit = 0, payment_terms = 'cash',
      commission_percent = 0, notes = ''
    } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Distributor name is required' });
    }

    const opBal = parseFloat(opening_balance) || 0;

    const result = await transaction(async (conn) => {
      const [ins] = await conn.query(
        `INSERT INTO distributors 
         (tenant_id, name, company_name, phone, email, cnic, address, city, district, province, territory, opening_balance, current_balance, credit_limit, payment_terms, commission_percent, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [tenantId, name, company_name, phone, email, cnic, address, city, district, province, territory, opBal, opBal, credit_limit, payment_terms, commission_percent, notes]
      );

      if (opBal !== 0) {
        await conn.query(
          `INSERT INTO distributor_ledger (tenant_id, distributor_id, type, amount, previous_balance, balance_after, description, date)
           VALUES (?, ?, 'opening_balance', ?, 0, ?, 'Opening Balance', NOW())`,
          [tenantId, ins.insertId, opBal, opBal]
        );
      }

      return ins.insertId;
    });

    res.status(201).json({ success: true, message: 'Distributor created', data: { id: result, ...req.body } });
  } catch (error) {
    next(error);
  }
};

exports.updateDistributor = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const {
      name, company_name, phone, email, cnic, address, city,
      district, province, territory, credit_limit, payment_terms,
      commission_percent, status, notes
    } = req.body;

    await query(
      `UPDATE distributors SET
         name = COALESCE(?, name),
         company_name = COALESCE(?, company_name),
         phone = COALESCE(?, phone),
         email = COALESCE(?, email),
         cnic = COALESCE(?, cnic),
         address = COALESCE(?, address),
         city = COALESCE(?, city),
         district = COALESCE(?, district),
         province = COALESCE(?, province),
         territory = COALESCE(?, territory),
         credit_limit = COALESCE(?, credit_limit),
         payment_terms = COALESCE(?, payment_terms),
         commission_percent = COALESCE(?, commission_percent),
         status = COALESCE(?, status),
         notes = COALESCE(?, notes)
       WHERE tenant_id = ? AND id = ? AND is_deleted = 0`,
      [name, company_name, phone, email, cnic, address, city, district, province, territory, credit_limit, payment_terms, commission_percent, status, notes, tenantId, id]
    );

    res.json({ success: true, message: 'Distributor updated successfully' });
  } catch (error) {
    next(error);
  }
};

exports.deleteDistributor = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    await query(`UPDATE distributors SET is_deleted = 1, deleted_at = NOW() WHERE tenant_id = ? AND id = ?`, [tenantId, id]);
    res.json({ success: true, message: 'Distributor deleted' });
  } catch (error) {
    next(error);
  }
};

// --- Distributor Orders ---
exports.getOrders = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { distributor_id, status } = req.query;
    let sql = `
      SELECT do.*, d.name AS distributor_name, d.company_name
      FROM distributor_orders do
      JOIN distributors d ON do.distributor_id = d.id
      WHERE do.tenant_id = ? AND do.is_deleted = 0
    `;
    const params = [tenantId];
    if (distributor_id) { sql += ` AND do.distributor_id = ?`; params.push(distributor_id); }
    if (status) { sql += ` AND do.status = ?`; params.push(status); }
    sql += ` ORDER BY do.id DESC`;

    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.createOrder = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const {
      distributor_id, due_date = null, subtotal = 0, discount_amount = 0,
      tax_amount = 0, shipping_charges = 0, grand_total,
      paid_amount = 0, payment_mode = 'cash', notes = '', items = []
    } = req.body;

    const gTotal = parseFloat(grand_total) || 0;
    const pAmount = parseFloat(paid_amount) || 0;
    const dueAmount = Math.max(0, gTotal - pAmount);
    const orderNo = 'DO-' + Date.now();

    const orderId = await transaction(async (conn) => {
      const [ordRes] = await conn.query(
        `INSERT INTO distributor_orders 
         (tenant_id, distributor_id, order_no, due_date, total_amount, discount_amount, tax_amount, shipping_charges, grand_total, paid_amount, due_amount, payment_mode, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
        [tenantId, distributor_id, orderNo, due_date, subtotal, discount_amount, tax_amount, shipping_charges, gTotal, pAmount, dueAmount, payment_mode, notes]
      );

      const id = ordRes.insertId;

      for (const item of items) {
        await conn.query(
          `INSERT INTO distributor_order_items (tenant_id, order_id, product_variant_id, product_name, sku, quantity, price, discount, total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [tenantId, id, item.product_variant_id || null, item.product_name || '', item.sku || '', item.quantity || 1, item.price || 0, item.discount || 0, item.total || 0]
        );
      }

      // Update distributor balance
      const [dRows] = await conn.query('SELECT current_balance FROM distributors WHERE tenant_id = ? AND id = ?', [tenantId, distributor_id]);
      const prevBal = parseFloat(dRows[0]?.current_balance || 0);
      const newBal = prevBal + dueAmount;

      await conn.query('UPDATE distributors SET current_balance = ? WHERE tenant_id = ? AND id = ?', [newBal, tenantId, distributor_id]);

      // Record in ledger
      await conn.query(
        `INSERT INTO distributor_ledger (tenant_id, distributor_id, type, amount, previous_balance, balance_after, description, reference_id, reference_type, date)
         VALUES (?, ?, 'order', ?, ?, ?, ?, ?, 'distributor_order', NOW())`,
        [tenantId, distributor_id, gTotal, prevBal, newBal, `Order #${orderNo}`, id]
      );

      return id;
    });

    res.status(201).json({ success: true, message: 'Distributor order created', data: { id: orderId, order_no: orderNo } });
  } catch (error) {
    next(error);
  }
};

// --- Distributor Payments ---
exports.getPayments = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { distributor_id } = req.query;
    let sql = `SELECT dp.*, d.name AS distributor_name FROM distributor_payments dp JOIN distributors d ON dp.distributor_id = d.id WHERE dp.tenant_id = ?`;
    const params = [tenantId];
    if (distributor_id) { sql += ` AND dp.distributor_id = ?`; params.push(distributor_id); }
    sql += ` ORDER BY dp.id DESC`;

    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.createPayment = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const {
      distributor_id, order_id = null, amount, payment_mode = 'cash',
      cheque_no = '', cheque_date = null, bank_name = '', note = ''
    } = req.body;

    const amt = parseFloat(amount) || 0;
    const receiptNo = 'DRCP-' + Date.now();

    const paymentId = await transaction(async (conn) => {
      const [pRes] = await conn.query(
        `INSERT INTO distributor_payments 
         (tenant_id, distributor_id, order_id, amount, payment_date, payment_mode, cheque_no, cheque_date, bank_name, note, receipt_no)
         VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?)`,
        [tenantId, distributor_id, order_id, amt, payment_mode, cheque_no, cheque_date, bank_name, note, receiptNo]
      );

      // Update distributor balance
      const [dRows] = await conn.query('SELECT current_balance FROM distributors WHERE tenant_id = ? AND id = ?', [tenantId, distributor_id]);
      const prevBal = parseFloat(dRows[0]?.current_balance || 0);
      const newBal = prevBal - amt;

      await conn.query('UPDATE distributors SET current_balance = ? WHERE tenant_id = ? AND id = ?', [newBal, tenantId, distributor_id]);

      // Record in ledger
      await conn.query(
        `INSERT INTO distributor_ledger (tenant_id, distributor_id, type, amount, previous_balance, balance_after, description, reference_id, reference_type, payment_mode, date)
         VALUES (?, ?, 'payment', ?, ?, ?, ?, ?, 'distributor_payment', ?, NOW())`,
        [tenantId, distributor_id, amt, prevBal, newBal, `Payment received (${payment_mode})`, pRes.insertId, payment_mode]
      );

      return pRes.insertId;
    });

    res.status(201).json({ success: true, message: 'Payment recorded', data: { id: paymentId, receipt_no: receiptNo } });
  } catch (error) {
    next(error);
  }
};

// --- Distributor Ledger ---
exports.getDistributorLedger = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const rows = await query(`SELECT * FROM distributor_ledger WHERE tenant_id = ? AND distributor_id = ? ORDER BY date DESC, id DESC`, [tenantId, id]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

// --- Distributor Summary View ---
exports.getSummary = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const rows = await query(`SELECT * FROM v_distributor_summary WHERE tenant_id = ? ORDER BY total_order_value DESC`, [tenantId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};
