// ============================================================
//  backend/controllers/salesmanController.js - Multi-Tenant Scoped
// ============================================================

const { query, transaction } = require('../config/db');

// --- Salesmen CRUD ---
exports.getSalesmen = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { status, search } = req.query;
    let sql = `SELECT * FROM salesmen WHERE tenant_id = ? AND is_deleted = 0`;
    const params = [tenantId];

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    if (search) {
      sql += ` AND (name LIKE ? OR phone LIKE ? OR cnic LIKE ?)`;
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

exports.getSalesmanById = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const rows = await query(`SELECT * FROM salesmen WHERE tenant_id = ? AND id = ? AND is_deleted = 0`, [tenantId, id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Salesman not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.createSalesman = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const {
      name, phone = '', cnic = '', address = '', joining_date = null,
      base_salary = 0, target_amount = 0, commission_percent = 0, status = 'active'
    } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Salesman name is required' });
    }

    const result = await query(
      `INSERT INTO salesmen (tenant_id, name, phone, cnic, address, joining_date, base_salary, target_amount, commission_percent, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, name, phone, cnic, address, joining_date, base_salary, target_amount, commission_percent, status]
    );

    res.status(201).json({
      success: true,
      message: 'Salesman created successfully',
      data: { id: result.insertId, ...req.body }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateSalesman = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const {
      name, phone, cnic, address, joining_date, base_salary,
      target_amount, commission_percent, status
    } = req.body;

    await query(
      `UPDATE salesmen SET
         name = COALESCE(?, name),
         phone = COALESCE(?, phone),
         cnic = COALESCE(?, cnic),
         address = COALESCE(?, address),
         joining_date = COALESCE(?, joining_date),
         base_salary = COALESCE(?, base_salary),
         target_amount = COALESCE(?, target_amount),
         commission_percent = COALESCE(?, commission_percent),
         status = COALESCE(?, status)
       WHERE tenant_id = ? AND id = ? AND is_deleted = 0`,
      [name, phone, cnic, address, joining_date, base_salary, target_amount, commission_percent, status, tenantId, id]
    );

    res.json({ success: true, message: 'Salesman updated successfully' });
  } catch (error) {
    next(error);
  }
};

exports.deleteSalesman = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    await query(`UPDATE salesmen SET is_deleted = 1, deleted_at = NOW() WHERE tenant_id = ? AND id = ?`, [tenantId, id]);
    res.json({ success: true, message: 'Salesman deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// --- Salesman Sales ---
exports.getSalesmanSales = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { salesman_id, customer_id, status } = req.query;
    let sql = `
      SELECT ss.*, s.name AS salesman_name, c.name AS customer_name
      FROM salesman_sales ss
      LEFT JOIN salesmen s ON ss.salesman_id = s.id
      LEFT JOIN customers c ON ss.customer_id = c.id
      WHERE ss.tenant_id = ? AND ss.is_deleted = 0
    `;
    const params = [tenantId];
    if (salesman_id) { sql += ` AND ss.salesman_id = ?`; params.push(salesman_id); }
    if (customer_id) { sql += ` AND ss.customer_id = ?`; params.push(customer_id); }
    if (status) { sql += ` AND ss.status = ?`; params.push(status); }
    sql += ` ORDER BY ss.id DESC`;

    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.createSalesmanSale = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const {
      salesman_id, customer_id, customer_name, location,
      subtotal = 0, discount = 0, tax = 0, shipping = 0, grand_total,
      payment_mode = 'Cash', paid_amount = 0, items = [], note = ''
    } = req.body;

    const gTotal = parseFloat(grand_total) || 0;
    const pAmount = parseFloat(paid_amount) || 0;
    const dueAmount = Math.max(0, gTotal - pAmount);
    const invoiceNo = 'SMS-' + Date.now();

    const result = await transaction(async (conn) => {
      const [smRows] = await conn.query('SELECT commission_percent FROM salesmen WHERE tenant_id = ? AND id = ?', [tenantId, salesman_id]);
      const commRate = smRows[0]?.commission_percent || 0;
      const commissionAmount = (gTotal * commRate) / 100;

      const [saleRes] = await conn.query(
        `INSERT INTO salesman_sales 
         (tenant_id, invoice_no, salesman_id, customer_id, customer_name, location, subtotal, discount, tax, shipping, grand_total, payment_mode, paid_amount, due_amount, commission_amount, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [tenantId, invoiceNo, salesman_id, customer_id || null, customer_name || '', location || '', subtotal, discount, tax, shipping, gTotal, payment_mode, pAmount, dueAmount, commissionAmount, note]
      );

      const saleId = saleRes.insertId;

      for (const item of items) {
        await conn.query(
          `INSERT INTO salesman_sale_items (tenant_id, sale_id, product_variant_id, product_id, product_name, sku, quantity, price, total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [tenantId, saleId, item.product_variant_id || null, item.product_id || null, item.product_name || '', item.sku || '', item.quantity || 1, item.price || 0, item.total || 0]
        );
      }

      await conn.query(`UPDATE salesmen SET current_sales = current_sales + ? WHERE tenant_id = ? AND id = ?`, [gTotal, tenantId, salesman_id]);

      if (commissionAmount > 0) {
        await conn.query(
          `INSERT INTO salesman_ledger (tenant_id, salesman_id, type, amount, description, reference_id, reference_type, date)
           VALUES (?, ?, 'commission', ?, ?, ?, 'salesman_sale', NOW())`,
          [tenantId, salesman_id, commissionAmount, `Commission for invoice #${invoiceNo}`, saleId]
        );
      }

      return { id: saleId, invoice_no: invoiceNo };
    });

    res.status(201).json({ success: true, message: 'Salesman sale created', data: result });
  } catch (error) {
    next(error);
  }
};

// --- Salary Payments ---
exports.getSalaryPayments = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { salesman_id } = req.query;
    let sql = `SELECT sp.*, s.name as salesman_name FROM salesman_salary_payments sp JOIN salesmen s ON sp.salesman_id = s.id WHERE sp.tenant_id = ?`;
    const params = [tenantId];
    if (salesman_id) { sql += ` AND sp.salesman_id = ?`; params.push(salesman_id); }
    sql += ` ORDER BY sp.id DESC`;

    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.createSalaryPayment = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { salesman_id, month_year, base_salary = 0, bonus = 0, deduction = 0, advance_deducted = 0, paid_amount = 0, payment_mode = 'cash', note = '' } = req.body;
    const netPayable = parseFloat(base_salary) + parseFloat(bonus) - parseFloat(deduction) - parseFloat(advance_deducted);

    const resId = await transaction(async (conn) => {
      const [ins] = await conn.query(
        `INSERT INTO salesman_salary_payments 
         (tenant_id, salesman_id, month_year, base_salary, bonus, deduction, advance_deducted, net_payable, paid_amount, payment_date, payment_mode, note, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), ?, ?, 'paid')`,
        [tenantId, salesman_id, month_year, base_salary, bonus, deduction, advance_deducted, netPayable, paid_amount, payment_mode, note]
      );

      await conn.query(
        `INSERT INTO salesman_ledger (tenant_id, salesman_id, type, amount, description, reference_id, reference_type, payment_mode, date)
         VALUES (?, ?, 'salary', ?, ?, ?, 'salary_payment', ?, NOW())`,
        [tenantId, salesman_id, paid_amount, `Salary paid for ${month_year}`, ins.insertId, payment_mode]
      );

      return ins.insertId;
    });

    res.status(201).json({ success: true, message: 'Salary payment recorded', data: { id: resId } });
  } catch (error) {
    next(error);
  }
};

// --- Advances & Loans ---
exports.getAdvances = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { salesman_id } = req.query;
    let sql = `SELECT a.*, s.name as salesman_name FROM salesman_advances a JOIN salesmen s ON a.salesman_id = s.id WHERE a.tenant_id = ?`;
    const params = [tenantId];
    if (salesman_id) { sql += ` AND a.salesman_id = ?`; params.push(salesman_id); }
    sql += ` ORDER BY a.id DESC`;

    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.createAdvance = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { salesman_id, amount, advance_type = 'salary', reason = '' } = req.body;
    const amt = parseFloat(amount) || 0;

    const resId = await transaction(async (conn) => {
      const [ins] = await conn.query(
        `INSERT INTO salesman_advances (tenant_id, salesman_id, amount, advance_type, reason, given_date, remaining_amount, status)
         VALUES (?, ?, ?, ?, ?, CURDATE(), ?, 'active')`,
        [tenantId, salesman_id, amt, advance_type, reason, amt]
      );

      await conn.query(
        `INSERT INTO salesman_ledger (tenant_id, salesman_id, type, amount, description, reference_id, reference_type, date)
         VALUES (?, ?, 'advance', ?, ?, ?, 'advance', NOW())`,
        [tenantId, salesman_id, amt, `Advance given: ${reason}`, ins.insertId]
      );

      return ins.insertId;
    });

    res.status(201).json({ success: true, message: 'Advance recorded', data: { id: resId } });
  } catch (error) {
    next(error);
  }
};

// --- Salesman Ledger ---
exports.getSalesmanLedger = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const rows = await query(
      `SELECT * FROM salesman_ledger WHERE tenant_id = ? AND salesman_id = ? ORDER BY date DESC, id DESC`,
      [tenantId, id]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

// --- Salesman Performance View ---
exports.getPerformance = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const rows = await query(`SELECT * FROM v_salesman_performance WHERE tenant_id = ? ORDER BY total_sale_amount DESC`, [tenantId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};
