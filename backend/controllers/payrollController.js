// ============================================================
//  payrollController.js — Staff monthly salary slips
//  Net = Base Salary + (Labor-only commission %) − deductions.
//  Commission applies to SERVICES labor, never inventory sales.
//  Source of truth: `staff` table (commission_rate, base_salary).
// ============================================================
const { query, transaction } = require('../config/db');

// --- Labor summary per staff for a month (from completed/delivered repair jobs) ---
exports.laborSummary = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const month = req.query.month || new Date().toISOString().slice(0, 7); // YYYY-MM
    const rows = await query(
      `SELECT s.id AS staff_id, s.name AS staff_name,
              COALESCE(s.base_salary, 0) AS base_salary,
              COALESCE(s.commission_rate, 0) AS commission_percent,
              COALESCE(SUM(CASE WHEN w.status IN ('completed','delivered') THEN w.labor_amount ELSE 0 END), 0) AS labor_total,
              COUNT(CASE WHEN w.status IN ('completed','delivered') THEN 1 END) AS jobs_done
       FROM staff s
       LEFT JOIN work_orders w ON w.staff_id = s.id AND w.tenant_id = ?
         AND DATE_FORMAT(w.completed_at, '%Y-%m') = ? AND w.is_deleted = 0
       WHERE s.tenant_id = ? AND s.is_deleted = 0 AND s.status = 'active'
       GROUP BY s.id, s.name, s.base_salary, s.commission_rate
       ORDER BY s.name`,
      [tenantId, month, tenantId]
    );
    const data = rows.map(r => {
      const labor = Number(r.labor_total) || 0;
      const pct = Number(r.commission_percent) || 0;
      const comm = +(labor * pct / 100).toFixed(2);
      return { ...r, commission_amount: comm, net_pay: +(Number(r.base_salary) + comm).toFixed(2) };
    });
    res.json({ success: true, month, data });
  } catch (error) {
    next(error);
  }
};

// --- Generate payroll slips for a month ---
exports.generatePayroll = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const month = req.body.month || new Date().toISOString().slice(0, 7);
    const { deductions = {} } = req.body; // { staff_id: { amount, note } }

    const staff = await query(
      `SELECT id, name, COALESCE(base_salary,0) AS base_salary, COALESCE(commission_rate,0) AS commission_percent
       FROM staff WHERE tenant_id = ? AND is_deleted = 0 AND status = 'active'`,
      [tenantId]
    );

    let created = 0, skipped = 0;
    await transaction(async (conn) => {
      for (const s of staff) {
        const [lr] = await conn.query(
          `SELECT COALESCE(SUM(labor_amount),0) AS labor_total
           FROM work_orders WHERE tenant_id = ? AND staff_id = ? AND status IN ('completed','delivered')
           AND DATE_FORMAT(completed_at, '%Y-%m') = ? AND is_deleted = 0`,
          [tenantId, s.id, month]
        );
        const labor = Number(lr?.labor_total) || 0;
        const pct = Number(s.commission_percent) || 0;
        const comm = +(labor * pct / 100).toFixed(2);
        const ded = Number(deductions[s.id]?.amount) || 0;
        const net = +(Number(s.base_salary) + comm - ded).toFixed(2);
        const [ex] = await conn.query(
          `SELECT id FROM staff_payroll WHERE tenant_id = ? AND staff_id = ? AND month = ?`,
          [tenantId, s.id, month]
        );
        if (ex) { skipped++; continue; }
        await conn.query(
          `INSERT INTO staff_payroll (tenant_id, staff_id, month, base_salary, labor_total, commission_percent, commission_amount, deductions, deduction_note, net_pay, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid')`,
          [tenantId, s.id, month, s.base_salary, labor, pct, comm, ded, deductions[s.id]?.note || null, net]
        );
        created++;
      }
    });

    res.json({ success: true, message: `Payroll generated for ${month}: ${created} slips`, created, skipped });
  } catch (error) {
    next(error);
  }
};

// --- List payroll slips ---
exports.listPayroll = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { month = '' } = req.query;
    let sql = `SELECT p.*, s.name AS staff_name, s.role
               FROM staff_payroll p JOIN staff s ON s.id = p.staff_id
               WHERE p.tenant_id = ?`;
    const params = [tenantId];
    if (month) { sql += ` AND p.month = ?`; params.push(month); }
    sql += ` ORDER BY p.month DESC, s.name`;
    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

// --- Mark slip paid ---
exports.paySlip = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    await query(
      `UPDATE staff_payroll SET status = 'paid', paid_at = NOW() WHERE tenant_id = ? AND id = ?`,
      [tenantId, req.params.id]
    );
    res.json({ success: true, message: 'Salary slip marked paid' });
  } catch (error) {
    next(error);
  }
};
