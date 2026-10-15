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
      interest_type = 'percentage', fixed_interest_per_month = 0,
      product_source = 'inventory', source_name = '', source_purchase_price = 0,
      start_date = new Date().toISOString().slice(0, 10), salesman_id = null,
      shop_location = '', notes = '', guarantors = []
    } = req.body;

    const tAmount = parseFloat(total_amount) || 0;
    const dPayment = parseFloat(down_payment) || 0;
    const remaining = Math.max(0, tAmount - dPayment);
    const months = parseInt(total_months, 10) || 1;
    // Match frontend: Math.ceil for consistent EMI display (EMI.jsx)
    // Last installment absorbs remainder: last = remaining - (months-1) * emiAmount
    const emiAmount = months > 0 ? Math.ceil(remaining / months) : 0;

    const appNo = 'EMI-' + Date.now();

    const startDateObj = new Date(start_date);
    const nextDueObj = new Date(startDateObj);
    nextDueObj.setMonth(nextDueObj.getMonth() + 1);
    const nextDueDate = nextDueObj.toISOString().slice(0, 10);

    const emiId = await transaction(async (conn) => {
      const [ins] = await conn.query(
        `INSERT INTO emi_records 
         (tenant_id, application_no, customer_id, customer_name, product_variant_id, product_id, sale_id, product_name, product_sku, total_amount, down_payment, remaining_amount, emi_amount, interest_rate, interest_type, fixed_interest_per_month, total_months, total_installments, start_date, next_due_date, salesman_id, shop_location, notes, product_source, source_name, source_purchase_price, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [tenantId, appNo, customer_id, customer_name, product_variant_id, product_id, sale_id, product_name, product_sku, tAmount, dPayment, remaining, emiAmount, interest_rate, interest_type, fixed_interest_per_month, months, months, start_date, nextDueDate, salesman_id, shop_location, notes, product_source, source_name, source_purchase_price]
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

      // 2. Update schedule: handle partial vs full payment
      const [pendings] = await conn.query(
        `SELECT id, planned_amount, paid_amount FROM emi_schedule WHERE tenant_id = ? AND emi_id = ? AND status IN ('pending', 'partial') ORDER BY installment_no ASC LIMIT 1`,
        [tenantId, id]
      );
      if (pendings.length > 0) {
        const inst = pendings[0];
        const dueAmount = parseFloat(inst.planned_amount) || 0;
        const alreadyPaid = parseFloat(inst.paid_amount) || 0;
        const totalPaidForInst = alreadyPaid + payAmt;
        // Total applied to this installment (including penalty/discount effect)
        const netPayment = payAmt + penAmt - discAmt;
        if (totalPaidForInst >= dueAmount) {
          // Fully paid (or overpaid — cap at due amount)
          await conn.query(
            `UPDATE emi_schedule SET status = 'paid', paid_amount = ?, paid_date = CURDATE() WHERE tenant_id = ? AND id = ?`,
            [dueAmount, tenantId, inst.id]
          );
        } else {
          // Partial payment — mark as partial, keep installment open
          await conn.query(
            `UPDATE emi_schedule SET status = 'partial', paid_amount = ? WHERE tenant_id = ? AND id = ?`,
            [totalPaidForInst, tenantId, inst.id]
          );
        }
      }

      // 3. Update emi_records remaining balance and paid months
      // Net reduction: payment amount + discount (reduces owed) ; penalty increases owed but is collected now
      // remaining reduces by (payAmt + discAmt), penalty is extra collected on top
      const balanceReduction = payAmt + discAmt;
      const [emiRows] = await conn.query(`SELECT remaining_amount, paid_installments, paid_months FROM emi_records WHERE tenant_id = ? AND id = ?`, [tenantId, id]);
      const currentRemaining = emiRows.length > 0 ? parseFloat(emiRows[0].remaining_amount) || 0 : 0;
      const newRemaining = Math.max(0, currentRemaining - balanceReduction);
      const isFullyPaid = pendings.length > 0 && (parseFloat(pendings[0].paid_amount) || 0) + payAmt >= (parseFloat(pendings[0].planned_amount) || 0);
      await conn.query(
        `UPDATE emi_records SET
           remaining_amount = ?,
           paid_installments = paid_installments + ?,
           paid_months = paid_months + ?,
           last_payment_date = CURDATE(),
           status = CASE WHEN ? <= 0 THEN 'closed' ELSE 'active' END
         WHERE tenant_id = ? AND id = ?`,
        [newRemaining, isFullyPaid ? 1 : 0, isFullyPaid ? 1 : 0, newRemaining, tenantId, id]
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

// ============================================================
//  ADVANCED EMI / BNPL ENGINE
//  - inventory vs external product sourcing
//  - flat interest (default 35%), custom monthly target -> tenure
//  - reusable guarantor master / CNIC-only
//  - mobile-shop IMEI linking
//  - early settlement with discount/interest waiver
// ============================================================

// --- Guarantor master: list ---
exports.getGuarantors = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { search = '' } = req.query;
    let sql = `SELECT g.*,
                 (SELECT COUNT(*) FROM emi_guarantors eg WHERE eg.guarantor_id = g.id) AS agreements_count
               FROM guarantors g WHERE g.tenant_id = ? AND g.is_deleted = 0`;
    const params = [tenantId];
    if (search) { sql += ` AND (g.name LIKE ? OR g.cnic LIKE ? OR g.phone LIKE ?)`; const s = `%${search}%`; params.push(s, s, s); }
    sql += ` ORDER BY g.name LIMIT 200`;
    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
};

// --- Guarantor master: create (CNIC unique per tenant) ---
exports.createGuarantor = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { name, phone = '', cnic = '', address = '', occupation = '', monthly_income = 0, relation_to_customer = '', notes = '' } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Guarantor name is required' });
    if (cnic) {
      const dup = await query(`SELECT id FROM guarantors WHERE tenant_id = ? AND cnic = ? AND is_deleted = 0`, [tenantId, cnic]);
      if (dup.length > 0) return res.status(409).json({ success: false, error: 'Guarantor with this CNIC already exists', data: dup[0] });
    }
    const r = await query(
      `INSERT INTO guarantors (tenant_id, name, phone, cnic, address, occupation, monthly_income, relation_to_customer, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, name, phone, cnic || null, address, occupation, monthly_income, relation_to_customer, notes]
    );
    res.status(201).json({ success: true, data: { id: r.insertId } });
  } catch (error) { next(error); }
};

// --- Advanced EMI creation wizard ---
exports.createAdvancedEMI = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const {
      customer_id, customer_name = '',
      source_mode = 'inventory',           // 'inventory' | 'external'
      product_variant_id = null, product_id = null,
      product_name = '', product_sku = '',
      cost_price = 0,                      // external mode / inventory cost snapshot
      sale_price = 0,                      // total sale price
      device_imei_id = null,               // mobile shop: serialized phone
      down_payment = 0,
      interest_rate = 35,
      tenure_mode = 'fixed_months',        // 'fixed_months' | 'monthly_target'
      total_months = 12,
      monthly_target = 0,
      start_date = new Date().toISOString().slice(0, 10),
      salesman_id = null, shop_location = '', notes = '',
      guarantor_mode = 'none',             // 'existing' | 'new' | 'none'
      guarantor_id = null,
      new_guarantor = null,
    } = req.body;

    if (!customer_id && !customer_name) return res.status(400).json({ success: false, error: 'Customer is required' });
    const total = Number(sale_price) || 0;
    if (!(total > 0)) return res.status(400).json({ success: false, error: 'Sale price must be greater than 0' });
    const down = Math.min(Number(down_payment) || 0, total);
    const rate = Number(interest_rate) || 0;
    const remaining = +(total - down).toFixed(2);
    const interestAmount = +(remaining * rate / 100).toFixed(2);
    const totalPayable = +(remaining + interestAmount).toFixed(2);

    let months = parseInt(total_months, 10) || 12;
    if (tenure_mode === 'monthly_target') {
      const tgt = Number(monthly_target) || 0;
      if (!(tgt > 0)) return res.status(400).json({ success: false, error: 'Monthly target must be greater than 0' });
      months = Math.max(1, Math.ceil(totalPayable / tgt));
    }

    // Monthly schedule: equal parts, rounding remainder on final month
    const perMonthBase = Math.floor(totalPayable / months);
    const lastMonthAmt = +(totalPayable - perMonthBase * (months - 1)).toFixed(2);
    const perPrincipal = Math.floor(remaining / months);
    const lastPrincipal = +(remaining - perPrincipal * (months - 1)).toFixed(2);
    const perInterest = +((totalPayable - remaining) / months).toFixed(2);

    const emiId = await transaction(async (conn) => {
      let pvid = product_variant_id, pid = product_id, pName = product_name, pCost = Number(cost_price) || 0;

      // Mode A: existing inventory -> fetch prices, deduct -1 on approval
      if (source_mode === 'inventory') {
        if (!pvid) throw new Error('Select an inventory item for inventory mode');
        const [v] = await conn.query(
          `SELECT pv.*, p.name AS pname, p.sku AS psku FROM product_variants pv
           LEFT JOIN products p ON p.id = pv.product_id
           WHERE pv.tenant_id = ? AND pv.id = ?`, [tenantId, pvid]
        );
        if (!v) throw new Error('Inventory item not found');
        const avail = Number(v.current_stock ?? v.stock ?? 0);
        if (avail < 1) throw new Error(`"${v.variant_name || v.pname}" out of stock`);
        pid = v.product_id;
        pName = pName || v.variant_name || v.pname;
        pCost = pCost || Number(v.purchase_price) || 0;
        await conn.query(
          `UPDATE product_variants SET current_stock = GREATEST(0, COALESCE(current_stock,0) - 1), stock = GREATEST(0, COALESCE(stock,0) - 1) WHERE id = ?`, [pvid]
        );
        if (pid) await conn.query(`UPDATE products SET stock = GREATEST(0, COALESCE(stock,0) - 1) WHERE id = ?`, [pid]);
      }

      // Mobile shop: link serialized IMEI -> mark SOLD against this EMI
      let imeiLabel = null;
      if (device_imei_id) {
        const [d] = await conn.query(`SELECT * FROM device_imei WHERE tenant_id = ? AND id = ? AND is_deleted = 0`, [tenantId, device_imei_id]);
        if (!d) throw new Error('IMEI device not found');
        if (d.status !== 'IN_STOCK') throw new Error(`IMEI ${d.imei1} is ${d.status} — cannot finance`);
        imeiLabel = d.imei1;
      }

      const [cnt] = await conn.query(
        `SELECT COUNT(*) AS c FROM emi_records WHERE tenant_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')`, [tenantId]
      );
      const appNo = `EMI-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(Number(cnt.c) + 1).padStart(4, '0')}`;

      const startObj = new Date(start_date);
      const endObj = new Date(startObj); endObj.setMonth(endObj.getMonth() + months);
      const nextDue = new Date(startObj); nextDue.setMonth(nextDue.getMonth() + 1);

      const [ins] = await conn.query(
        `INSERT INTO emi_records
           (tenant_id, application_no, customer_id, customer_name, product_variant_id, product_id,
            product_name, product_sku, product_cost_price, total_amount, down_payment, remaining_amount,
            emi_amount, installment_amount, interest_rate, interest_amount, total_payable, monthly_target,
            total_months, total_installments, start_date, end_date, next_due_date,
            source_mode, device_imei_id, cost_price, cnic_only,
            salesman_id, shop_location, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [tenantId, appNo, customer_id, customer_name, pvid, pid,
         pName, product_sku, pCost, total, down, totalPayable,
         lastMonthAmt, perMonthBase, rate, interestAmount, totalPayable, tenure_mode === 'monthly_target' ? Number(monthly_target) : 0,
         months, months, start_date, endObj.toISOString().slice(0, 10), nextDue.toISOString().slice(0, 10),
         source_mode, device_imei_id, pCost, guarantor_mode === 'none' ? 1 : 0,
         salesman_id, shop_location, notes]
      );
      const id = ins.insertId;

      // Schedule with principal/interest split + remainder on last month
      for (let i = 1; i <= months; i++) {
        const dObj = new Date(startObj); dObj.setMonth(dObj.getMonth() + i);
        const isLast = i === months;
        const amt = isLast ? lastMonthAmt : perMonthBase;
        const princ = isLast ? lastPrincipal : perPrincipal;
        await conn.query(
          `INSERT INTO emi_schedule (tenant_id, emi_id, installment_no, due_date, planned_amount, principal_portion, interest_portion, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
          [tenantId, id, i, dObj.toISOString().slice(0, 10), amt, princ, +(amt - princ).toFixed(2)]
        );
      }

      // Guarantor: existing master / new master / none (CNIC-only)
      if (guarantor_mode === 'existing' && guarantor_id) {
        const [g] = await conn.query(`SELECT * FROM guarantors WHERE tenant_id = ? AND id = ? AND is_deleted = 0`, [tenantId, guarantor_id]);
        if (!g) throw new Error('Guarantor not found');
        await conn.query(
          `INSERT INTO emi_guarantors (tenant_id, emi_id, guarantor_id, guarantor_type, name, phone, cnic, address, occupation, monthly_income, relation_to_customer)
           VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
          [tenantId, id, g.id, g.name, g.phone, g.cnic, g.address, g.occupation, g.monthly_income, g.relation_to_customer]
        );
      } else if (guarantor_mode === 'new' && new_guarantor?.name) {
        const ng = new_guarantor;
        const [gr] = await conn.query(
          `INSERT INTO guarantors (tenant_id, name, phone, cnic, address, occupation, monthly_income, relation_to_customer, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [tenantId, ng.name, ng.phone || '', ng.cnic || null, ng.address || '', ng.occupation || '', ng.monthly_income || 0, ng.relation_to_customer || '', ng.notes || '']
        );
        await conn.query(
          `INSERT INTO emi_guarantors (tenant_id, emi_id, guarantor_id, guarantor_type, name, phone, cnic, address, occupation, monthly_income, relation_to_customer)
           VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
          [tenantId, id, gr.insertId, ng.name, ng.phone || '', ng.cnic || '', ng.address || '', ng.occupation || '', ng.monthly_income || 0, ng.relation_to_customer || '']
        );
      }

      // IMEI lifecycle: IN_STOCK -> SOLD against this EMI agreement
      if (device_imei_id) {
        await conn.query(`UPDATE device_imei SET status = 'SOLD', customer_id = ?, customer_name = ? WHERE id = ?`,
          [customer_id, customer_name, device_imei_id]);
        await conn.query(
          `INSERT INTO device_imei_history (tenant_id, device_imei_id, action, from_status, to_status, ref_type, ref_id, customer_id, customer_name, amount, notes)
           VALUES (?, ?, 'SOLD', 'IN_STOCK', 'SOLD', 'emi', ?, ?, ?, ?, ?)`,
          [tenantId, device_imei_id, id, customer_id, customer_name, totalPayable, `EMI ${appNo}`]
        );
      }

      // Down payment receipt (ledger completeness)
      if (down > 0) {
        const rcp = `EMIRCP-${Date.now()}`;
        await conn.query(
          `INSERT INTO emi_payments (tenant_id, emi_id, amount, total_received, payment_mode, payment_method, receipt_no, notes, status, payment_date)
           VALUES (?, ?, ?, ?, 'cash', 'cash', ?, 'Down payment', 'paid', NOW())`,
          [tenantId, id, down, down, rcp]
        );
      }

      return { id, application_no: appNo, months, totalPayable, interestAmount, imei: imeiLabel };
    });

    res.status(201).json({ success: true, message: `EMI ${emiId.application_no} created — ${emiId.months} months`, data: emiId });
  } catch (error) {
    if (error.message && /out of stock|not found|cannot finance|required|greater than 0/i.test(error.message)) {
      return res.status(400).json({ success: false, error: error.message });
    }
    next(error);
  }
};

// --- Early settlement: close account with discount / interest waiver ---
exports.earlySettlement = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const { discount_amount = 0, payment_mode = 'cash', account_id = null, notes = '' } = req.body;

    const rows = await query(`SELECT * FROM emi_records WHERE tenant_id = ? AND id = ? AND is_deleted = 0`, [tenantId, id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'EMI not found' });
    const emi = rows[0];
    if (['completed', 'closed'].includes(emi.status)) return res.status(409).json({ success: false, error: 'Already settled' });

    const paid = await query(
      `SELECT COALESCE(SUM(total_received),0) AS paid FROM emi_payments WHERE tenant_id = ? AND emi_id = ? AND is_reversal = 0 AND notes != 'Down payment'`,
      [tenantId, id]
    );
    const downPaid = await query(
      `SELECT COALESCE(SUM(total_received),0) AS d FROM emi_payments WHERE tenant_id = ? AND emi_id = ? AND is_reversal = 0 AND notes = 'Down payment'`,
      [tenantId, id]
    );
    const totalPaid = Number(paid[0]?.paid) || 0;
    const base = Number(emi.total_payable) || Number(emi.remaining_amount) || 0;
    const downAlready = Number(downPaid[0]?.d) || Number(emi.down_payment) || 0;
    const outstanding = Math.max(0, +(base - downAlready - totalPaid).toFixed(2));
    const discount = Math.min(Number(discount_amount) || 0, outstanding);
    const finalAmount = +(outstanding - discount).toFixed(2);

    await transaction(async (conn) => {
      const rcp = `EMIRCP-${Date.now()}`;
      if (finalAmount > 0) {
        await conn.query(
          `INSERT INTO emi_payments (tenant_id, emi_id, amount, discount_amount, total_received, payment_mode, payment_method, receipt_no, notes, status, payment_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Early settlement', 'paid', NOW())`,
          [tenantId, id, finalAmount, discount, finalAmount, payment_mode, payment_mode, rcp]
        );
      } else if (discount > 0) {
        await conn.query(
          `INSERT INTO emi_payments (tenant_id, emi_id, amount, discount_amount, total_received, payment_mode, payment_method, receipt_no, notes, status, payment_date)
           VALUES (?, ?, 0, ?, 0, ?, ?, ?, 'Early settlement (full waiver)', 'paid', NOW())`,
          [tenantId, id, discount, payment_mode, payment_mode, rcp]
        );
      }
      await conn.query(`UPDATE emi_schedule SET status = 'paid', paid_amount = planned_amount, paid_date = CURDATE() WHERE tenant_id = ? AND emi_id = ? AND status = 'pending'`, [tenantId, id]);
      await conn.query(
        `UPDATE emi_records SET remaining_amount = 0, early_settlement_discount = ?, settled_at = NOW(),
           paid_installments = total_installments, paid_months = total_months,
           last_payment_date = CURDATE(), status = 'completed'
         WHERE tenant_id = ? AND id = ?`,
        [discount, tenantId, id]
      );
      if (account_id && finalAmount > 0) {
        await conn.query(`UPDATE accounts SET current_balance = current_balance + ? WHERE tenant_id = ? AND id = ?`, [finalAmount, tenantId, account_id]);
        await conn.query(
          `INSERT INTO account_transactions (tenant_id, account_id, type, amount, description, reference_type, reference_no, date)
           VALUES (?, ?, 'credit', ?, 'EMI Early Settlement', 'emi_payment', ?, CURDATE())`,
          [tenantId, account_id, finalAmount, rcp]
        );
      }
    });

    res.json({ success: true, message: `Account settled — received Rs. ${finalAmount.toLocaleString()}, discount Rs. ${discount.toLocaleString()}`, data: { outstanding, discount, finalAmount } });
  } catch (error) { next(error); }
};

// --- Collection dashboard: due today / overdue / pending ---
exports.collectionDashboard = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const today = new Date().toISOString().slice(0, 10);

    const [dueToday] = await query(
      `SELECT COUNT(*) AS n, COALESCE(SUM(s.planned_amount - COALESCE(s.paid_amount,0)),0) AS amt
       FROM emi_schedule s JOIN emi_records e ON e.id = s.emi_id
       WHERE e.tenant_id = ? AND s.due_date = ? AND s.status = 'pending' AND e.is_deleted = 0 AND e.status = 'active'`,
      [tenantId, today]
    );
    const [overdue] = await query(
      `SELECT COUNT(*) AS n, COALESCE(SUM(s.planned_amount - COALESCE(s.paid_amount,0)),0) AS amt,
              COUNT(DISTINCT s.emi_id) AS agreements
       FROM emi_schedule s JOIN emi_records e ON e.id = s.emi_id
       WHERE e.tenant_id = ? AND s.due_date < ? AND s.status = 'pending' AND e.is_deleted = 0 AND e.status = 'active'`,
      [tenantId, today]
    );
    const [pending] = await query(
      `SELECT COUNT(*) AS n, COALESCE(SUM(s.planned_amount - COALESCE(s.paid_amount,0)),0) AS amt
       FROM emi_schedule s JOIN emi_records e ON e.id = s.emi_id
       WHERE e.tenant_id = ? AND s.status = 'pending' AND e.is_deleted = 0 AND e.status = 'active'`,
      [tenantId]
    );
    const overdueList = await query(
      `SELECT e.id AS emi_id, e.application_no, e.customer_name, MIN(s.due_date) AS oldest_due,
              SUM(s.planned_amount - COALESCE(s.paid_amount,0)) AS overdue_amt,
              DATEDIFF(CURDATE(), MIN(s.due_date)) AS days_overdue
       FROM emi_schedule s JOIN emi_records e ON e.id = s.emi_id
       WHERE e.tenant_id = ? AND s.due_date < ? AND s.status = 'pending' AND e.is_deleted = 0 AND e.status = 'active'
       GROUP BY e.id, e.application_no, e.customer_name
       ORDER BY days_overdue DESC LIMIT 50`,
      [tenantId, today]
    );
    const dueTodayList = await query(
      `SELECT e.id AS emi_id, e.application_no, e.customer_name, s.installment_no, s.planned_amount
       FROM emi_schedule s JOIN emi_records e ON e.id = s.emi_id
       WHERE e.tenant_id = ? AND s.due_date = ? AND s.status = 'pending' AND e.is_deleted = 0 AND e.status = 'active'
       ORDER BY e.customer_name LIMIT 50`,
      [tenantId, today]
    );

    res.json({ success: true, data: {
      today,
      dueToday: { count: dueToday.n, amount: Number(dueToday.amt) },
      overdue: { count: overdue.n, amount: Number(overdue.amt), agreements: overdue.agreements },
      pending: { count: pending.n, amount: Number(pending.amt) },
      overdueList, dueTodayList,
    }});
  } catch (error) { next(error); }
};
