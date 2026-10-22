// ============================================================
//  repairController.js — Mobile Shop: Repair Job Cards
//  Token intake, before/after photos, parts deduction from
//  inventory, labor-only staff commission.
// ============================================================
const fs = require('fs');
const path = require('path');
const { query, transaction } = require('../config/db');

// FIX E-1: dates computed in JS and bound as plain params — the SQLite
// adapter (LOCAL_MODE) mangles CURDATE()/NOW() inside INSERT ... VALUES
// for syncable tables such as account_transactions.
const pktToday = () => new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
const { encryptPasscode, decryptPasscode } = require('../utils/passcodeCrypto');

// --- Generate next job token: RJC-YYYYMM-0001 ---
async function nextToken(tenantId, conn) {
  const prefix = `RJC-${new Date().toISOString().slice(0, 7).replace('-', '')}-`;
  const q = conn ? conn.query.bind(conn) : query;
  const rows = await q(
    `SELECT order_number FROM work_orders WHERE tenant_id = ? AND order_number LIKE ? ORDER BY id DESC LIMIT 1`,
    [tenantId, `${prefix}%`]
  );
  let seq = 1;
  if (rows.length > 0) {
    const m = String(rows[0].order_number).match(/-(\d+)$/);
    if (m) seq = Number(m[1]) + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

// --- Create job card ---
exports.createJob = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const {
      service_id = null, staff_id = null,
      customer_id = null, customer_name = '', customer_phone = '',
      device_model = '', imei = '', problem_description = '',
      condition_notes = '', passcode = '',
      labor_amount = 0, advance_amount = 0,
      payment_mode = 'cash', notes = '',
      parts = [], // [{ product_variant_id, qty }]
    } = req.body;

    if (!customer_name) return res.status(400).json({ success: false, error: 'Customer name is required' });
    if (!problem_description) return res.status(400).json({ success: false, error: 'Reported fault is required' });

    const job = await transaction(async (conn) => {
      const token = await nextToken(tenantId, conn);

      // Parts: validate stock, deduct, record
      let partsAmount = 0;
      const partRows = [];
      for (const p of parts) {
        const vid = Number(p.product_variant_id);
        const pqty = Math.max(1, Number(p.qty) || 1);
        const [v] = await conn.query(
          `SELECT id, product_id, variant_name, current_stock, purchase_price, retail_price FROM product_variants WHERE tenant_id = ? AND id = ?`,
          [tenantId, vid]
        );
        if (!v) throw new Error(`Part variant #${vid} not found`);
        const avail = Number(v.current_stock || 0);
        if (avail < pqty) throw new Error(`Insufficient stock for part "${v.variant_name}" (have ${avail}, need ${pqty})`);
        const cost = Number(v.purchase_price || 0);
        partsAmount += cost * pqty;
        await conn.query(
          `UPDATE product_variants SET current_stock = GREATEST(0, COALESCE(current_stock,0) - ?), stock = GREATEST(0, COALESCE(stock,0) - ?) WHERE id = ?`,
          [pqty, pqty, vid]
        );
        if (v.product_id) {
          await conn.query(`UPDATE products SET stock = GREATEST(0, COALESCE(stock,0) - ?) WHERE id = ?`, [pqty, v.product_id]);
        }
        partRows.push({ variant_id: vid, part_name: v.variant_name, qty: pqty, cost_price: cost });
      }

      const labor = Number(labor_amount) || 0;
      const totalAmount = labor + partsAmount;

      // Commission strictly on LABOR only (staff.commission_rate)
      let commissionPercent = 0, commissionAmount = 0;
      if (staff_id) {
        const [st] = await conn.query(`SELECT commission_rate FROM staff WHERE id = ? AND tenant_id = ?`, [staff_id, tenantId]);
        commissionPercent = Number(st?.commission_rate) || 0;
        commissionAmount = +(labor * commissionPercent / 100).toFixed(2);
      }

      const [jr] = await conn.query(
        `INSERT INTO work_orders
           (tenant_id, order_number, service_id, staff_id, customer_id, customer_name, machine_name,
            device_model, imei, problem_description, condition_notes, passcode_encrypted,
            labor_amount, parts_amount, total_cost, total_amount, paid_amount, advance_amount,
            payment_status, payment_mode, commission_percent, commission_amount, notes, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [tenantId, token, service_id, staff_id, customer_id, customer_name,
         `${customer_phone}`.trim() ? `${device_model} (${customer_phone})` : device_model,
         device_model, imei, problem_description, condition_notes, encryptPasscode(passcode),
         labor, partsAmount, partsAmount, totalAmount, advance_amount, advance_amount,
         Number(advance_amount) >= totalAmount ? 'paid' : (Number(advance_amount) > 0 ? 'partial' : 'unpaid'),
         payment_mode, commissionPercent, commissionAmount, notes, req.user?.id || null] // QA-017: creator record
      );

      for (const pr of partRows) {
        await conn.query(
          `INSERT INTO repair_parts (tenant_id, job_id, product_variant_id, part_name, qty, cost_price)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [tenantId, jr.insertId, pr.variant_id, pr.part_name, pr.qty, pr.cost_price]
        );
      }

      // H5 FIX: Credit advance_amount to default cash account (was invisible in Finance)
      const advAmt = Number(advance_amount) || 0;
      if (advAmt > 0) {
        // Find default cash account
        const [cashAccts] = await conn.query(
          `SELECT id FROM accounts WHERE tenant_id = ? AND type = 'cash' AND is_deleted = 0 ORDER BY id ASC LIMIT 1`,
          [tenantId]
        );
        if (cashAccts.length > 0) {
          const cashId = cashAccts[0].id;
          await conn.query(`UPDATE accounts SET current_balance = current_balance + ? WHERE tenant_id = ? AND id = ?`, [advAmt, tenantId, cashId]);
          await conn.query(
            `INSERT INTO account_transactions (tenant_id, account_id, type, amount, description, reference_type, reference_id, date)
             VALUES (?, ?, 'credit', ?, 'Repair advance received', 'repair', ?, ?)`,
            [tenantId, cashId, advAmt, jr.insertId, pktToday()]
          );
        }
      }

      return { id: jr.insertId, order_number: token, total_amount: totalAmount, parts_amount: partsAmount, commission_amount: commissionAmount };
    });

    res.status(201).json({ success: true, message: `Job token ${job.order_number} created`, data: job });
  } catch (error) {
    if (error.message && error.message.startsWith('Insufficient stock')) {
      return res.status(409).json({ success: false, error: error.message });
    }
    next(error);
  }
};

// --- Upload before/after photo (base64) ---
exports.uploadPhoto = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { job_id, kind, image } = req.body; // kind: 'before' | 'after'
    if (!job_id || !['before', 'after'].includes(kind)) {
      return res.status(400).json({ success: false, error: 'job_id and kind (before/after) are required' });
    }
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ success: false, error: 'image (base64) is required' });
    }
    const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
    const b64 = match ? match[2] : image;
    const ext = match ? match[1].split('/')[1].replace('jpeg', 'jpg') : 'jpg';
    const buf = Buffer.from(b64, 'base64');
    if (buf.length > 8 * 1024 * 1024) {
      return res.status(413).json({ success: false, error: 'Image too large (max 8MB)' });
    }

    const dir = path.join(__dirname, '..', 'uploads', 'repair');
    fs.mkdirSync(dir, { recursive: true });
    const fname = `job-${job_id}-${kind}-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(dir, fname), buf);
    const url = `/uploads/repair/${fname}`;

    const col = kind === 'before' ? 'photo_before_url' : 'photo_after_url';
    await query(`UPDATE work_orders SET ${col} = ? WHERE tenant_id = ? AND id = ?`, [url, tenantId, job_id]);
    res.json({ success: true, url });
  } catch (error) {
    next(error);
  }
};

// --- List job cards ---
exports.listJobs = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { status = '', search = '', limit = 100 } = req.query;
    let sql = `SELECT wo.id, wo.order_number, wo.customer_name, wo.device_model, wo.imei, wo.problem_description, wo.status,
                      wo.labor_amount, wo.parts_amount, wo.total_amount, wo.paid_amount, wo.advance_amount, wo.payment_status,
                      wo.commission_amount, wo.staff_id, wo.photo_before_url, wo.photo_after_url, wo.created_at, wo.completed_at,
                      wo.created_by, wo.assigned_by,
                      u1.name AS created_by_name, u2.name AS assigned_by_name
               FROM work_orders wo
               LEFT JOIN users u1 ON u1.id = wo.created_by
               LEFT JOIN users u2 ON u2.id = wo.assigned_by
               WHERE wo.tenant_id = ? AND wo.is_deleted = 0`;
    const params = [tenantId];
    if (status) { sql += ` AND wo.status = ?`; params.push(status); }
    if (search) {
      sql += ` AND (wo.order_number LIKE ? OR wo.customer_name LIKE ? OR wo.imei LIKE ? OR wo.device_model LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    sql += ` ORDER BY wo.id DESC LIMIT ${Math.min(Number(limit) || 100, 500)}`;
    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

// --- Job detail (passcode only decrypted for staff/admin roles) ---
exports.getJob = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const rows = await query(`SELECT * FROM work_orders WHERE tenant_id = ? AND id = ? AND is_deleted = 0`, [tenantId, req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Job not found' });
    const job = rows[0];
    const parts = await query(`SELECT * FROM repair_parts WHERE tenant_id = ? AND job_id = ?`, [tenantId, job.id]);
    const role = req.user?.role || '';
    const canSeePasscode = ['admin', 'owner', 'manager', 'technician'].includes(role);
    job.passcode = canSeePasscode ? decryptPasscode(job.passcode_encrypted) : (job.passcode_encrypted ? '••••••' : null);
    delete job.passcode_encrypted;
    res.json({ success: true, data: { ...job, parts } });
  } catch (error) {
    next(error);
  }
};

// --- Update job: status flow, payments, after-photo already via uploadPhoto ---
exports.updateJob = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const { status, paid_amount, payment_status, notes, condition_notes, passcode } = req.body;
    const sets = [], params = [];
    if (status !== undefined) {
      sets.push('status = ?'); params.push(status);
      if (['completed', 'delivered'].includes(status)) { sets.push('completed_at = NOW()'); }
    }
    if (paid_amount !== undefined) { sets.push('paid_amount = ?'); params.push(paid_amount); }
    if (payment_status !== undefined) { sets.push('payment_status = ?'); params.push(payment_status); }
    if (notes !== undefined) { sets.push('notes = ?'); params.push(notes); }
    if (condition_notes !== undefined) { sets.push('condition_notes = ?'); params.push(condition_notes); }
    if (passcode !== undefined) { sets.push('passcode_encrypted = ?'); params.push(encryptPasscode(passcode)); }
    if (sets.length === 0) return res.status(400).json({ success: false, error: 'Nothing to update' });
    params.push(tenantId, id);
    await query(`UPDATE work_orders SET ${sets.join(', ')} WHERE tenant_id = ? AND id = ?`, params);
    res.json({ success: true, message: 'Job updated' });
  } catch (error) {
    next(error);
  }
};

// --- Printable job token ---
exports.getToken = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const rows = await query(
      `SELECT order_number, customer_name, device_model, imei, problem_description, condition_notes,
              labor_amount, parts_amount, total_amount, advance_amount, paid_amount, payment_status, created_at
       FROM work_orders WHERE tenant_id = ? AND id = ? AND is_deleted = 0`,
      [tenantId, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Job not found' });
    const parts = await query(`SELECT part_name, qty, cost_price FROM repair_parts WHERE tenant_id = ? AND job_id = ?`, [tenantId, req.params.id]);
    res.json({ success: true, data: { ...rows[0], parts, balance: Number(rows[0].total_amount) - Number(rows[0].paid_amount) } });
  } catch (error) {
    next(error);
  }
};
