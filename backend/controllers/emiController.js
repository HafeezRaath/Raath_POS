// ============================================================
//  backend/controllers/emiController.js - Multi-Tenant Scoped
// ============================================================

const { query, transaction } = require('../config/db');

// --- List EMI Records ---
exports.getEMIs = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { status, customer_id, salesman_id, search } = req.query;
    let sql = `
      SELECT e.*, c.name AS customer_name, c.phone AS customer_phone, c.cnic AS customer_cnic,
             s.name AS salesman_name
      FROM emi_records e
      LEFT JOIN customers c ON e.customer_id = c.id
      LEFT JOIN salesmen s ON e.salesman_id = s.id
      WHERE e.tenant_id = ? AND e.is_deleted = 0
    `;
    const params = [tenantId];
    if (status) { sql += ` AND e.status = ?`; params.push(status); }
    if (customer_id) { sql += ` AND e.customer_id = ?`; params.push(customer_id); }
    if (salesman_id) { sql += ` AND e.salesman_id = ?`; params.push(salesman_id); }
    if (search) {
      sql += ` AND (e.application_no LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR e.product_name LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    sql += ` ORDER BY e.id DESC`;

    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

// --- Single EMI Details with Schedule, Guarantors, Payments ---
exports.getEMIById = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const rows = await query(
      `SELECT e.*, c.name AS customer_name, c.phone AS customer_phone, c.cnic AS customer_cnic,
              c.address AS customer_address, s.name AS salesman_name
       FROM emi_records e
       LEFT JOIN customers c ON e.customer_id = c.id
       LEFT JOIN salesmen s ON e.salesman_id = s.id
       WHERE e.tenant_id = ? AND e.id = ? AND e.is_deleted = 0`,
      [tenantId, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'EMI record not found' });
    }

    const emi = rows[0];
    emi.guarantors = await query(`SELECT * FROM emi_guarantors WHERE tenant_id = ? AND emi_id = ?`, [tenantId, id]);
    emi.schedule = await query(`SELECT * FROM emi_schedule WHERE tenant_id = ? AND emi_id = ? ORDER BY installment_no ASC`, [tenantId, id]);
    emi.payments = await query(`SELECT * FROM emi_payments WHERE tenant_id = ? AND emi_id = ? AND is_reversal = 0 ORDER BY payment_date DESC, id DESC`, [tenantId, id]);
    emi.documents = await query(`SELECT * FROM emi_documents WHERE tenant_id = ? AND emi_id = ?`, [tenantId, id]);
    emi.visits = await query(`SELECT * FROM emi_visit_log WHERE tenant_id = ? AND emi_id = ? ORDER BY visit_date DESC`, [tenantId, id]);

    res.json({ success: true, data: emi });
  } catch (error) {
    next(error);
  }
};

// --- Create EMI Record ---
exports.createEMI = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const {
      customer_id, customer_name, product_name = '', product_sku = '',
      product_variant_id = null, product_id = null, sale_id = null,
      total_amount, down_payment = 0, total_months = 1, interest_rate = 0,
      start_date = new Date().toISOString().slice(0, 10), salesman_id = null,
      shop_location = '', notes = '', guarantors = []
    } = req.body;

    const tAmount = parseFloat(total_amount) || 0;
    const dPayment = parseFloat(down_payment) || 0;
    const remaining = Math.max(0, tAmount - dPayment);
    const months = parseInt(total_months, 10) || 1;
    const emiAmount = Math.round(remaining / months);

    const appNo = 'EMI-' + Date.now();

    const startDateObj = new Date(start_date);
    const nextDueObj = new Date(startDateObj);
    nextDueObj.setMonth(nextDueObj.getMonth() + 1);
    const nextDueDate = nextDueObj.toISOString().slice(0, 10);

    const emiId = await transaction(async (conn) => {
      const [ins] = await conn.query(
        `INSERT INTO emi_records 
         (tenant_id, application_no, customer_id, customer_name, product_variant_id, product_id, sale_id, product_name, product_sku, total_amount, down_payment, remaining_amount, emi_amount, interest_rate, total_months, total_installments, start_date, next_due_date, salesman_id, shop_location, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [tenantId, appNo, customer_id, customer_name, product_variant_id, product_id, sale_id, product_name, product_sku, tAmount, dPayment, remaining, emiAmount, interest_rate, months, months, start_date, nextDueDate, salesman_id, shop_location, notes]
      );

      const id = ins.insertId;

      // Generate Installment Schedule
      for (let i = 1; i <= months; i++) {
        const dObj = new Date(startDateObj);
        dObj.setMonth(dObj.getMonth() + i);
        const dueDate = dObj.toISOString().slice(0, 10);

        await conn.query(
          `INSERT INTO emi_schedule (tenant_id, emi_id, installment_no, due_date, planned_amount, status)
           VALUES (?, ?, ?, ?, ?, 'pending')`,
          [tenantId, id, i, dueDate, emiAmount]
        );
      }

      // Add Guarantors
      if (Array.isArray(guarantors)) {
        for (const g of guarantors) {
          if (g.name && g.cnic) {
            await conn.query(
              `INSERT INTO emi_guarantors (tenant_id, emi_id, guarantor_type, name, phone, cnic, address, occupation, monthly_income, relation_to_customer)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [tenantId, id, g.guarantor_type || 1, g.name, g.phone || '', g.cnic, g.address || '', g.occupation || '', g.monthly_income || 0, g.relation_to_customer || '']
            );
          }
        }
      }

      return id;
    });

    res.status(201).json({
      success: true,
      message: 'EMI plan created successfully',
      data: { id: emiId, application_no: appNo }
    });
  } catch (error) {
    next(error);
  }
};

// --- Pay Installment ---
exports.payInstallment = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const {
      amount, penalty_amount = 0, discount_amount = 0,
      payment_mode = 'cash', account_id = null, notes = ''
    } = req.body;

    const payAmt = parseFloat(amount) || 0;
    const penAmt = parseFloat(penalty_amount) || 0;
    const discAmt = parseFloat(discount_amount) || 0;
    const receiptNo = 'EMIRCP-' + Date.now();

    await transaction(async (conn) => {
      // 1. Record EMI payment
      const [payRes] = await conn.query(
        `INSERT INTO emi_payments 
         (tenant_id, emi_id, amount, penalty_amount, discount_amount, total_received, payment_mode, payment_method, account_id, receipt_no, notes, status, payment_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', NOW())`,
        [tenantId, id, payAmt, penAmt, discAmt, payAmt + penAmt - discAmt, payment_mode, payment_mode, account_id, receiptNo, notes]
      );

      // 2. Update schedule: mark earliest pending installment as paid
      const [pendings] = await conn.query(
        `SELECT id FROM emi_schedule WHERE tenant_id = ? AND emi_id = ? AND status = 'pending' ORDER BY installment_no ASC LIMIT 1`,
        [tenantId, id]
      );
      if (pendings.length > 0) {
        await conn.query(
          `UPDATE emi_schedule SET status = 'paid', paid_amount = ?, paid_date = CURDATE() WHERE tenant_id = ? AND id = ?`,
          [payAmt, tenantId, pendings[0].id]
        );
      }

      // 3. Update emi_records remaining balance and paid months
      await conn.query(
        `UPDATE emi_records SET
           remaining_amount = GREATEST(0, remaining_amount - ?),
           paid_installments = paid_installments + 1,
           paid_months = paid_months + 1,
           last_payment_date = CURDATE(),
           status = CASE WHEN remaining_amount - ? <= 0 THEN 'closed' ELSE 'active' END
         WHERE tenant_id = ? AND id = ?`,
        [payAmt, payAmt, tenantId, id]
      );

      // 4. Update account balance if account_id given
      if (account_id) {
        await conn.query(`UPDATE accounts SET current_balance = current_balance + ? WHERE tenant_id = ? AND id = ?`, [payAmt, tenantId, account_id]);
        await conn.query(
          `INSERT INTO account_transactions (tenant_id, account_id, type, amount, description, reference_type, reference_id, reference_no, date)
           VALUES (?, ?, 'credit', ?, 'EMI Installment Received', 'emi_payment', ?, ?, CURDATE())`,
          [tenantId, account_id, payAmt, payRes.insertId, receiptNo]
        );
      }
    });

    res.json({ success: true, message: 'Installment payment recorded', data: { receipt_no: receiptNo } });
  } catch (error) {
    next(error);
  }
};

// --- Overdue EMIs ---
exports.getOverdueEMIs = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const rows = await query(`SELECT * FROM v_emi_overdue WHERE tenant_id = ? ORDER BY days_overdue DESC`, [tenantId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

// --- Delete EMI Plan ---
exports.deleteEMI = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    await query(`UPDATE emi_records SET is_deleted = 1, deleted_at = NOW() WHERE tenant_id = ? AND id = ?`, [tenantId, id]);
    res.json({ success: true, message: 'EMI record deleted' });
  } catch (error) {
    next(error);
  }
};
