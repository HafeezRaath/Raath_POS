// ============================================================
//  emi-handlers.js — Part 1 of 3
//  Sections: Setup + Helpers, EMI Records, EMI Guarantors
//  Combine with Part 2 and Part 3 to form complete file
// ============================================================

const { ipcMain } = require('electron');
const { getDb } = require('../database/connection');
const { logAudit } = require('../utils/audit');
const { sanitizeObject, sanitizeInput, validatePositiveNumber, validateDate } = require('../utils/validators');
const { calculateEMI, calculateEMISchedule, generateApplicationNo, getCustomerBalance } = require('../utils/calculations');
const { validateStockAvailability } = require('../utils/validators');
const { createHandler } = require('./helpers');

function registerEmiHandlers() {
  const db = getDb();

  // ==================== HELPERS ====================
  const nowISO = () => new Date().toISOString();
  const todayStr = () => new Date().toISOString().split('T')[0];

  /**
   * Sync EMI record after any payment mutation.
   * Recalculates remaining_amount, paid_months, last_payment_date, next_due_date, status.
   */
  function _syncEmiAfterPayment(db, emiId) {
    const payments = db.prepare(
      `SELECT amount, payment_date FROM emi_payments WHERE emi_id = ? AND is_reversal = 0 ORDER BY payment_date DESC`
    ).all(emiId);

    const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const lastPayment = payments[0] || null;

    const emiRow = db.prepare(
      `SELECT total_amount, down_payment, emi_amount, total_months FROM emi_records WHERE id = ?`
    ).get(emiId);

    if (!emiRow) return;

    const principal = Number(emiRow.total_amount || 0) - Number(emiRow.down_payment || 0);
    const remaining = Math.max(0, principal - totalPaid);
    const monthsPaid = emiRow.emi_amount > 0
      ? Math.min(Number(emiRow.total_months || 0), Math.floor(totalPaid / emiRow.emi_amount))
      : payments.length;

    const isCompleted = remaining <= 0 || monthsPaid >= Number(emiRow.total_months || 0);

    let nextDueStr = null;
    if (!isCompleted && lastPayment) {
      const nextDue = new Date(lastPayment.payment_date);
      const originalDay = nextDue.getDate();
      nextDue.setMonth(nextDue.getMonth() + 1);
      if (nextDue.getDate() !== originalDay) nextDue.setDate(0);
      nextDueStr = nextDue.toISOString();
    }

    db.prepare(
      `UPDATE emi_records SET 
        remaining_amount = ?, 
        paid_months = ?, 
        last_payment_date = ?, 
        next_due_date = ?, 
        status = CASE WHEN ? THEN 'completed' ELSE status END, 
        updated_at = datetime('now') 
       WHERE id = ?`
    ).run(
      remaining,
      monthsPaid,
      lastPayment ? lastPayment.payment_date : null,
      nextDueStr,
      isCompleted ? 1 : 0,
      emiId
    );
  }

  // ============================================================
  // 1. EMI RECORDS
  // ============================================================

  ipcMain.handle('db:getEmiRecords', createHandler(async (event, filters = {}) => {
    let sql = `
      SELECT 
        e.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.cnic as customer_cnic,
        c.address as customer_address,
        c.district as customer_district,
        c.province as customer_province,
        c.shop_name as customer_shop,
        c.current_balance as customer_balance,
        sm.name as salesman_name,
        pv.sku as product_sku_real,
        p.name as product_name_real
      FROM emi_records e
      LEFT JOIN customers c ON e.customer_id = c.id
      LEFT JOIN salesmen sm ON e.salesman_id = sm.id
      LEFT JOIN product_variants pv ON e.product_variant_id = pv.id
      LEFT JOIN products p ON pv.product_id = p.id
      WHERE e.is_deleted = 0
    `;
    const params = [];

    if (filters.status) { sql += " AND e.status = ?"; params.push(filters.status); }
    if (filters.customer_id) { sql += " AND e.customer_id = ?"; params.push(filters.customer_id); }
    if (filters.salesman_id) { sql += " AND e.salesman_id = ?"; params.push(filters.salesman_id); }
    if (filters.shop_location) { sql += " AND e.shop_location = ?"; params.push(filters.shop_location); }
    if (filters.from_date) { sql += " AND DATE(e.start_date) >= DATE(?)"; params.push(filters.from_date); }
    if (filters.to_date) { sql += " AND DATE(e.start_date) <= DATE(?)"; params.push(filters.to_date); }
    if (filters.search) {
      sql += " AND (e.application_no LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR c.cnic LIKE ? OR e.product_name LIKE ?)";
      const s = `%${filters.search}%`;
      params.push(s, s, s, s, s);
    }

    sql += " ORDER BY e.created_at DESC";
    return db.prepare(sql).all(...params) || [];
  }));

  ipcMain.handle('db:getEmiById', createHandler(async (event, id) => {
    const emi = db.prepare(`
      SELECT 
        e.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.cnic as customer_cnic,
        c.address as customer_address,
        c.district as customer_district,
        c.province as customer_province,
        c.shop_name as customer_shop,
        c.reference_name,
        c.reference_phone,
        sm.name as salesman_name,
        sm.commission_percent as salesman_commission,
        pv.sku as product_sku_real,
        p.name as product_name_real,
        pv.retail_price as current_retail_price
      FROM emi_records e
      LEFT JOIN customers c ON e.customer_id = c.id
      LEFT JOIN salesmen sm ON e.salesman_id = sm.id
      LEFT JOIN product_variants pv ON e.product_variant_id = pv.id
      LEFT JOIN products p ON pv.product_id = p.id
      WHERE e.id = ? AND e.is_deleted = 0
    `).get(id);

    if (!emi) return null;

    emi.guarantors = db.prepare(
      `SELECT * FROM emi_guarantors WHERE emi_id = ? ORDER BY guarantor_type`
    ).all(id) || [];

    emi.payments = db.prepare(
      `SELECT * FROM emi_payments WHERE emi_id = ? ORDER BY payment_date DESC, id DESC`
    ).all(id) || [];

    emi.visits = db.prepare(`
      SELECT v.*, s.name as staff_name 
      FROM emi_visit_log v 
      LEFT JOIN staff s ON v.staff_id = s.id 
      WHERE v.emi_id = ? ORDER BY v.visit_date DESC
    `).all(id) || [];

    emi.documents = db.prepare(
      `SELECT * FROM emi_documents WHERE emi_id = ? ORDER BY uploaded_at DESC`
    ).all(id) || [];

    const principal = (emi.total_amount || 0) - (emi.down_payment || 0);
    const scheduleCalc = calculateEMISchedule(principal, emi.interest_rate || 0, emi.total_months || 0, emi.start_date, emi.due_day || 1);
    emi.schedule = scheduleCalc.schedule;
    emi.total_interest = scheduleCalc.interest;

    emi.payment_stats = db.prepare(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_collected,
        COALESCE(SUM(penalty_amount), 0) as total_penalty,
        COALESCE(SUM(discount_amount), 0) as total_discounts,
        COUNT(DISTINCT CASE WHEN amount > 0 THEN date(payment_date) END) as unique_payment_days,
        MAX(payment_date) as last_payment_date
      FROM emi_payments
      WHERE emi_id = ? AND is_reversal = 0
    `).get(id);

    return emi;
  }));

  ipcMain.handle('db:getEmiByApplicationNo', createHandler(async (event, appNo) => {
    const row = db.prepare(
      `SELECT * FROM emi_records WHERE application_no = ? AND is_deleted = 0`
    ).get(appNo);
    return row || null;
  }));

  ipcMain.handle('db:createEmi', createHandler(async (event, data) => {
    const transaction = db.transaction((emiData) => {
      const customer = db.prepare("SELECT id FROM customers WHERE id = ? AND is_deleted = 0").get(emiData.customer_id);
      if (!customer) throw new Error('Customer not found');

      if (emiData.product_variant_id) {
        const stock = validateStockAvailability(db, emiData.product_variant_id, 1);
        if (!stock.available) throw new Error(`Product out of stock: ${stock.error}`);
      }

      const appNo = emiData.application_no || generateApplicationNo();
      const existing = db.prepare("SELECT id FROM emi_records WHERE application_no = ?").get(appNo);
      if (existing) throw new Error('Application number already exists');

      const totalAmount = validatePositiveNumber(emiData.total_amount, 0);
      const downPayment = validatePositiveNumber(emiData.down_payment, 0);
      const principal = totalAmount - downPayment;
      const interestRate = validatePositiveNumber(emiData.interest_rate, 0);
      const totalMonths = parseInt(emiData.total_months) || 0;

      if (principal <= 0) throw new Error('Principal amount must be greater than 0 after down payment');
      if (totalMonths <= 0) throw new Error('Total months must be greater than 0');

      const emiCalc = calculateEMI(principal, interestRate, totalMonths);
      const emiAmount = emiCalc.emi;
      const remainingAmount = emiCalc.total;

      const startDate = validateDate(emiData.start_date) || nowISO();
      const dueDay = parseInt(emiData.due_day) || 1;
      const firstDue = new Date(startDate);
      firstDue.setMonth(firstDue.getMonth() + 1);
      firstDue.setDate(Math.min(28, Math.max(1, dueDay)));

      const result = db.prepare(`
        INSERT INTO emi_records (
          application_no, customer_id, product_variant_id, product_name, product_sku,
          product_retail_price, product_cost_price, total_amount, down_payment, remaining_amount,
          emi_amount, interest_rate, total_months, paid_months, start_date, next_due_date, due_day,
          status, salesman_id, shop_location, notes, agreement_signed, agreement_date, created_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
      `).run(
        appNo,
        emiData.customer_id,
        emiData.product_variant_id || null,
        sanitizeInput(emiData.product_name || ''),
        sanitizeInput(emiData.product_sku || ''),
        validatePositiveNumber(emiData.product_retail_price, 0),
        validatePositiveNumber(emiData.product_cost_price, 0),
        totalAmount,
        downPayment,
        remainingAmount,
        emiAmount,
        interestRate,
        totalMonths,
        0,
        startDate,
        firstDue.toISOString(),
        dueDay,
        sanitizeInput(emiData.status || 'active'),
        emiData.salesman_id || null,
        sanitizeInput(emiData.shop_location || 'Main Branch'),
        sanitizeInput(emiData.notes || ''),
        emiData.agreement_signed ? 1 : 0,
        validateDate(emiData.agreement_date),
        emiData.created_by || event.sender?.userId || 1
      );

      const emiId = result.lastInsertRowid;

      if (emiData.guarantors && Array.isArray(emiData.guarantors)) {
        const insertGuarantor = db.prepare(`
          INSERT INTO emi_guarantors (
            emi_id, guarantor_type, name, phone, cnic, address, occupation,
            monthly_income, relation_to_customer, passport_photo_path, blank_check_photo_path,
            cnic_front_photo_path, cnic_back_photo_path, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))
        `);

        for (const g of emiData.guarantors) {
          if (!g.name || !g.cnic) continue;
          insertGuarantor.run(
            emiId,
            parseInt(g.guarantor_type) || 1,
            sanitizeInput(g.name),
            sanitizeInput(g.phone || ''),
            sanitizeInput(g.cnic),
            sanitizeInput(g.address || ''),
            sanitizeInput(g.occupation || ''),
            validatePositiveNumber(g.monthly_income, 0),
            sanitizeInput(g.relation_to_customer || ''),
            sanitizeInput(g.passport_photo_path || ''),
            sanitizeInput(g.blank_check_photo_path || ''),
            sanitizeInput(g.cnic_front_photo_path || ''),
            sanitizeInput(g.cnic_back_photo_path || '')
          );
        }
      }

      if (emiData.initial_visit_notes) {
        db.prepare(`
          INSERT INTO emi_visit_log (emi_id, visit_date, visit_type, notes, outcome, staff_id, created_at)
          VALUES (?, datetime('now'), 'enrollment', ?, 'Application submitted', ?, datetime('now'))
        `).run(emiId, sanitizeInput(emiData.initial_visit_notes), emiData.salesman_id || null);
      }

      if (emiData.product_variant_id) {
        db.prepare(`UPDATE product_variants SET current_stock = current_stock - 1 WHERE id = ?`).run(emiData.product_variant_id);
      }

      if (downPayment > 0) {
        const prevBalance = getCustomerBalance(db, emiData.customer_id);
        db.prepare(`
          INSERT INTO customer_ledger (
            customer_id, type, amount, previous_balance, balance_after,
            description, payment_mode, reference_no, date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          emiData.customer_id,
          'emi_downpayment',
          downPayment,
          prevBalance,
          prevBalance + downPayment,
          `EMI Down Payment - ${appNo}`,
          emiData.payment_mode || 'cash',
          appNo,
          nowISO()
        );
      }

      logAudit(emiData.created_by || event.sender?.userId || 1, 'create', 'emi_records', emiId);
      return { id: emiId, application_no: appNo, emi_amount: emiAmount, remaining_amount: remainingAmount };
    });

    return transaction(data);
  }));

  ipcMain.handle('db:updateEmi', createHandler(async (event, id, data) => {
    const allowedFields = [
      'product_name', 'product_sku', 'product_retail_price', 'product_cost_price',
      'status', 'salesman_id', 'shop_location', 'notes', 'agreement_signed',
      'agreement_date', 'next_due_date', 'due_day'
    ];

    const sanitized = sanitizeObject(data, allowedFields);
    const fields = [];
    const values = [];

    Object.keys(sanitized).forEach(key => {
      if (allowedFields.includes(key) && sanitized[key] !== undefined) {
        fields.push(`${key} = ?`);
        if (key.includes('price') || key.includes('amount')) {
          values.push(validatePositiveNumber(sanitized[key], 0));
        } else if (key === 'agreement_signed') {
          values.push(sanitized[key] ? 1 : 0);
        } else {
          values.push(sanitized[key]);
        }
      }
    });

    if (fields.length === 0) return { changes: 0 };

    fields.push("updated_at = datetime('now')");
    values.push(id);

    const result = db.prepare(`UPDATE emi_records SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    logAudit(data.updated_by || event.sender?.userId || 1, 'update', 'emi_records', id);
    return { changes: result.changes };
  }));

  ipcMain.handle('db:deleteEmi', createHandler(async (event, id) => {
    const emi = db.prepare("SELECT customer_id, remaining_amount, product_variant_id FROM emi_records WHERE id = ? AND is_deleted = 0").get(id);
    if (!emi) throw new Error('EMI record not found');

    const payments = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM emi_payments WHERE emi_id = ? AND is_reversal = 0").get(id);
    if (payments.total > 0 && parseFloat(emi.remaining_amount) > 0) {
      throw new Error('Cannot delete EMI with pending balance and payments. Mark as defaulted instead.');
    }

    const transaction = db.transaction(() => {
      if (emi.product_variant_id) {
        db.prepare("UPDATE product_variants SET current_stock = current_stock + 1 WHERE id = ?").run(emi.product_variant_id);
      }
      db.prepare("UPDATE emi_records SET is_deleted = 1, deleted_at = datetime('now'), status = 'closed' WHERE id = ?").run(id);
      db.prepare("DELETE FROM emi_guarantors WHERE emi_id = ?").run(id);
      db.prepare("DELETE FROM emi_schedule WHERE emi_id = ?").run(id);
      logAudit(event.sender?.userId || 1, 'delete', 'emi_records', id);
    });

    transaction();
    return { success: true };
  }));

  // ============================================================
  // 2. EMI GUARANTORS
  // ============================================================

  ipcMain.handle('db:getEmiGuarantors', createHandler(async (event, emiId) => {
    return db.prepare(`
      SELECT g.*, c.name as customer_name, r.application_no
      FROM emi_guarantors g
      JOIN emi_records r ON g.emi_id = r.id
      JOIN customers c ON r.customer_id = c.id
      WHERE g.emi_id = ? AND g.status = 'active'
      ORDER BY g.guarantor_type
    `).all(emiId) || [];
  }));

  ipcMain.handle('db:getEmiGuarantorById', createHandler(async (event, id) => {
    const row = db.prepare("SELECT * FROM emi_guarantors WHERE id = ?").get(id);
    return row || null;
  }));

  ipcMain.handle('db:addEmiGuarantor', createHandler(async (event, data) => {
    const sanitized = sanitizeObject(data, [
      'emi_id', 'guarantor_type', 'name', 'phone', 'cnic', 'address', 
      'occupation', 'monthly_income', 'relation_to_customer',
      'passport_photo_path', 'blank_check_photo_path', 'cnic_front_photo_path', 'cnic_back_photo_path'
    ]);

    const result = db.prepare(`
      INSERT INTO emi_guarantors (
        emi_id, guarantor_type, name, phone, cnic, address, occupation,
        monthly_income, relation_to_customer, passport_photo_path, blank_check_photo_path,
        cnic_front_photo_path, cnic_back_photo_path, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))
    `).run(
      sanitized.emi_id,
      parseInt(sanitized.guarantor_type) || 1,
      sanitized.name,
      sanitized.phone || '',
      sanitized.cnic,
      sanitized.address || '',
      sanitized.occupation || '',
      validatePositiveNumber(sanitized.monthly_income, 0),
      sanitized.relation_to_customer || '',
      sanitized.passport_photo_path || '',
      sanitized.blank_check_photo_path || '',
      sanitized.cnic_front_photo_path || '',
      sanitized.cnic_back_photo_path || ''
    );
    return { id: result.lastInsertRowid };
  }));

  ipcMain.handle('db:updateEmiGuarantor', createHandler(async (event, id, data) => {
    const allowedFields = [
      'name', 'phone', 'cnic', 'address', 'occupation', 'monthly_income',
      'relation_to_customer', 'passport_photo_path', 'blank_check_photo_path',
      'cnic_front_photo_path', 'cnic_back_photo_path', 'status'
    ];
    const sanitized = sanitizeObject(data, allowedFields);
    const fields = [];
    const values = [];

    Object.keys(sanitized).forEach(key => {
      if (allowedFields.includes(key) && sanitized[key] !== undefined) {
        fields.push(`${key} = ?`);
        if (key === 'monthly_income') values.push(validatePositiveNumber(sanitized[key], 0));
        else values.push(sanitized[key]);
      }
    });

    if (fields.length === 0) return { changes: 0 };
    fields.push("updated_at = datetime('now')");
    values.push(id);

    const result = db.prepare(`UPDATE emi_guarantors SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return { changes: result.changes };
  }));

  ipcMain.handle('db:deleteEmiGuarantor', createHandler(async (event, id) => {
    const result = db.prepare("DELETE FROM emi_guarantors WHERE id = ?").run(id);
    return { changes: result.changes };
  }));

  // ==================== END OF PART 1 ====================
  // Paste Part 2 below this line in the same file
// ============================================================
  // 3. EMI SCHEDULE / INSTALLMENTS
  // ============================================================

  ipcMain.handle('db:getEmiSchedule', createHandler(async (event, emiId) => {
    return db.prepare(
      `SELECT * FROM emi_schedule WHERE emi_id = ? ORDER BY installment_no`
    ).all(emiId) || [];
  }));

  ipcMain.handle('db:getEmiScheduleById', createHandler(async (event, id) => {
    const row = db.prepare("SELECT * FROM emi_schedule WHERE id = ?").get(id);
    return row || null;
  }));

  ipcMain.handle('db:generateEmiSchedule', createHandler(async (event, emiId, params) => {
    const { totalMonths, emiAmount, interestRate, startDate, principalPortion = 0, interestPortion = 0 } = params;

    db.prepare("DELETE FROM emi_schedule WHERE emi_id = ?").run(emiId);

    const schedule = [];
    let currentDate = new Date(startDate);

    for (let i = 1; i <= totalMonths; i++) {
      schedule.push({
        emi_id: emiId,
        installment_no: i,
        due_date: currentDate.toISOString().split('T')[0],
        planned_amount: emiAmount,
        principal_portion: principalPortion,
        interest_portion: interestPortion,
        paid_amount: 0,
        paid_date: null,
        status: 'pending'
      });

      const next = new Date(currentDate);
      next.setMonth(next.getMonth() + 1);
      if (next.getDate() !== currentDate.getDate()) {
        next.setDate(0);
      }
      currentDate = next;
    }

    const insert = db.prepare(`
      INSERT INTO emi_schedule (
        emi_id, installment_no, due_date, planned_amount, principal_portion,
        interest_portion, paid_amount, paid_date, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const transaction = db.transaction(() => {
      for (const item of schedule) {
        insert.run(
          item.emi_id, item.installment_no, item.due_date, item.planned_amount,
          item.principal_portion, item.interest_portion, item.paid_amount,
          item.paid_date, item.status
        );
      }
    });

    transaction();
    return schedule;
  }));

  ipcMain.handle('db:updateEmiScheduleItem', createHandler(async (event, id, data) => {
    const allowedFields = [
      'planned_amount', 'principal_portion', 'interest_portion',
      'paid_amount', 'paid_date', 'status'
    ];
    const sanitized = sanitizeObject(data, allowedFields);
    const fields = [];
    const values = [];

    Object.keys(sanitized).forEach(key => {
      if (allowedFields.includes(key) && sanitized[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(sanitized[key]);
      }
    });

    if (fields.length === 0) return { changes: 0 };
    fields.push("updated_at = datetime('now')");
    values.push(id);

    const result = db.prepare(`UPDATE emi_schedule SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return { changes: result.changes };
  }));

  ipcMain.handle('db:markEmiInstallmentPaid', createHandler(async (event, id, paidAmount, paidDate) => {
    const item = db.prepare("SELECT * FROM emi_schedule WHERE id = ?").get(id);
    if (!item) throw new Error('Schedule item not found');

    const status = paidAmount >= item.planned_amount ? 'paid' : 'partial';
    const result = db.prepare(`
      UPDATE emi_schedule SET 
        paid_amount = ?, paid_date = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(paidAmount, paidDate || todayStr(), status, id);

    return { changes: result.changes, status };
  }));

  ipcMain.handle('db:deleteEmiScheduleItem', createHandler(async (event, id) => {
    const result = db.prepare("DELETE FROM emi_schedule WHERE id = ?").run(id);
    return { changes: result.changes };
  }));

  // ============================================================
  // 4. EMI VISIT LOG
  // ============================================================

  ipcMain.handle('db:getEmiVisitLog', createHandler(async (event, emiId) => {
    return db.prepare(`
      SELECT v.*, s.name as staff_name 
      FROM emi_visit_log v 
      LEFT JOIN staff s ON v.staff_id = s.id 
      WHERE v.emi_id = ? ORDER BY v.visit_date DESC
    `).all(emiId) || [];
  }));

  ipcMain.handle('db:getEmiVisitById', createHandler(async (event, id) => {
    const row = db.prepare("SELECT * FROM emi_visit_log WHERE id = ?").get(id);
    return row || null;
  }));

  ipcMain.handle('db:addEmiVisit', createHandler(async (event, data) => {
    const sanitized = sanitizeObject(data, [
      'emi_id', 'visit_date', 'visit_type', 'staff_id', 'staff_name',
      'notes', 'outcome', 'next_action', 'next_action_date', 'location',
      'customer_met', 'amount_collected', 'photo_path', 'signature_path'
    ]);

    const result = db.prepare(`
      INSERT INTO emi_visit_log (
        emi_id, visit_date, visit_type, staff_id, staff_name, notes,
        outcome, next_action, next_action_date, location, customer_met,
        amount_collected, photo_path, signature_path, created_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
    `).run(
      sanitized.emi_id,
      sanitized.visit_date || nowISO(),
      sanitized.visit_type || 'visit',
      sanitized.staff_id || null,
      sanitized.staff_name || '',
      sanitized.notes || '',
      sanitized.outcome || '',
      sanitized.next_action || '',
      validateDate(sanitized.next_action_date) || null,
      sanitized.location || '',
      sanitized.customer_met ? 1 : 0,
      validatePositiveNumber(sanitized.amount_collected, 0),
      sanitized.photo_path || null,
      sanitized.signature_path || null,
      event.sender?.userId || 1
    );

    if (sanitized.amount_collected > 0 && data.record_as_payment) {
      const emi = db.prepare("SELECT * FROM emi_records WHERE id = ? AND is_deleted = 0").get(sanitized.emi_id);
      if (emi) {
        db.prepare(`
          INSERT INTO emi_payments (
            emi_id, amount, payment_date, payment_mode, notes, created_by, created_at
          ) VALUES (?, ?, ?, 'collection_visit', ?, ?, datetime('now'))
        `).run(
          sanitized.emi_id,
          validatePositiveNumber(sanitized.amount_collected, 0),
          sanitized.visit_date || nowISO(),
          `Collected during visit - ${sanitized.outcome || ''}`,
          event.sender?.userId || 1
        );
        _syncEmiAfterPayment(db, sanitized.emi_id);
      }
    }

    return { id: result.lastInsertRowid };
  }));

  ipcMain.handle('db:updateEmiVisit', createHandler(async (event, id, data) => {
    const allowedFields = [
      'visit_date', 'visit_type', 'staff_id', 'staff_name', 'notes',
      'outcome', 'next_action', 'next_action_date', 'location',
      'customer_met', 'amount_collected', 'photo_path', 'signature_path'
    ];
    const sanitized = sanitizeObject(data, allowedFields);
    const fields = [];
    const values = [];

    Object.keys(sanitized).forEach(key => {
      if (allowedFields.includes(key) && sanitized[key] !== undefined) {
        fields.push(`${key} = ?`);
        if (key === 'amount_collected') values.push(validatePositiveNumber(sanitized[key], 0));
        else if (key === 'customer_met') values.push(sanitized[key] ? 1 : 0);
        else values.push(sanitized[key]);
      }
    });

    if (fields.length === 0) return { changes: 0 };
    values.push(id);

    const result = db.prepare(`UPDATE emi_visit_log SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return { changes: result.changes };
  }));

  ipcMain.handle('db:deleteEmiVisit', createHandler(async (event, id) => {
    const result = db.prepare("DELETE FROM emi_visit_log WHERE id = ?").run(id);
    return { changes: result.changes };
  }));

  // ============================================================
  // 5. EMI DOCUMENTS
  // ============================================================

  ipcMain.handle('db:getEmiDocuments', createHandler(async (event, emiId) => {
    return db.prepare(`
      SELECT d.*, u.name as uploaded_by_name
      FROM emi_documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      WHERE d.emi_id = ? ORDER BY d.uploaded_at DESC
    `).all(emiId) || [];
  }));

  ipcMain.handle('db:getEmiDocumentById', createHandler(async (event, id) => {
    const row = db.prepare("SELECT * FROM emi_documents WHERE id = ?").get(id);
    return row || null;
  }));

  ipcMain.handle('db:addEmiDocument', createHandler(async (event, data) => {
    const sanitized = sanitizeObject(data, [
      'emi_id', 'document_type', 'file_path', 'file_hash', 'description', 'uploaded_by'
    ]);

    const result = db.prepare(`
      INSERT INTO emi_documents (
        emi_id, document_type, file_path, file_hash, description, uploaded_by, uploaded_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      sanitized.emi_id,
      sanitized.document_type,
      sanitized.file_path,
      sanitized.file_hash || null,
      sanitized.description || '',
      sanitized.uploaded_by || event.sender?.userId || null
    );

    return { id: result.lastInsertRowid };
  }));

  ipcMain.handle('db:updateEmiDocument', createHandler(async (event, id, data) => {
    const allowedFields = ['document_type', 'file_path', 'file_hash', 'description'];
    const sanitized = sanitizeObject(data, allowedFields);
    const fields = [];
    const values = [];

    Object.keys(sanitized).forEach(key => {
      if (allowedFields.includes(key) && sanitized[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(sanitized[key]);
      }
    });

    if (fields.length === 0) return { changes: 0 };
    values.push(id);

    const result = db.prepare(`UPDATE emi_documents SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return { changes: result.changes };
  }));

  ipcMain.handle('db:deleteEmiDocument', createHandler(async (event, id) => {
    const result = db.prepare("DELETE FROM emi_documents WHERE id = ?").run(id);
    return { changes: result.changes };
  }));

  // ============================================================
  // 6. EMI RESCHEDULE LOG
  // ============================================================

  ipcMain.handle('db:getEmiRescheduleLogs', createHandler(async (event, emiId) => {
    return db.prepare(`
      SELECT r.*, u.name as approved_by_name
      FROM emi_reschedule_log r
      LEFT JOIN users u ON r.approved_by = u.id
      WHERE r.emi_id = ? ORDER BY r.created_at DESC
    `).all(emiId) || [];
  }));

  ipcMain.handle('db:addEmiRescheduleLog', createHandler(async (event, data) => {
    const sanitized = sanitizeObject(data, [
      'emi_id', 'old_emi_amount', 'new_emi_amount', 'old_total_months', 'new_total_months',
      'old_next_due_date', 'new_next_due_date', 'old_interest_rate', 'new_interest_rate',
      'reason', 'approved_by'
    ]);

    const result = db.prepare(`
      INSERT INTO emi_reschedule_log (
        emi_id, old_emi_amount, new_emi_amount, old_total_months, new_total_months,
        old_next_due_date, new_next_due_date, old_interest_rate, new_interest_rate,
        reason, approved_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      sanitized.emi_id,
      validatePositiveNumber(sanitized.old_emi_amount, 0),
      validatePositiveNumber(sanitized.new_emi_amount, 0),
      parseInt(sanitized.old_total_months) || 0,
      parseInt(sanitized.new_total_months) || 0,
      validateDate(sanitized.old_next_due_date) || null,
      validateDate(sanitized.new_next_due_date) || null,
      validatePositiveNumber(sanitized.old_interest_rate, 0),
      validatePositiveNumber(sanitized.new_interest_rate, 0),
      sanitizeInput(sanitized.reason || ''),
      sanitized.approved_by || null
    );

    return { id: result.lastInsertRowid };
  }));

  // ==================== END OF PART 2 ====================
  // Paste Part 3 below this line in the same file
// ============================================================
  // 7. EMI PENALTY RULES
  // ============================================================

  ipcMain.handle('db:getPenaltyRules', createHandler(async (event) => {
    return db.prepare(`SELECT * FROM emi_penalty_rules ORDER BY id DESC`).all() || [];
  }));

  ipcMain.handle('db:getActivePenaltyRules', createHandler(async (event) => {
    return db.prepare(`SELECT * FROM emi_penalty_rules WHERE is_active = 1 ORDER BY days_after_due`).all() || [];
  }));

  ipcMain.handle('db:getPenaltyRuleById', createHandler(async (event, id) => {
    const row = db.prepare("SELECT * FROM emi_penalty_rules WHERE id = ?").get(id);
    return row || null;
  }));

  ipcMain.handle('db:createPenaltyRule', createHandler(async (event, data) => {
    const sanitized = sanitizeObject(data, [
      'rule_name', 'days_after_due', 'penalty_type', 'penalty_value', 'max_penalty_cap', 'is_active'
    ]);

    const result = db.prepare(`
      INSERT INTO emi_penalty_rules (
        rule_name, days_after_due, penalty_type, penalty_value, max_penalty_cap, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      sanitizeInput(sanitized.rule_name || ''),
      parseInt(sanitized.days_after_due) || 1,
      sanitized.penalty_type || 'fixed',
      validatePositiveNumber(sanitized.penalty_value, 0),
      validatePositiveNumber(sanitized.max_penalty_cap, 0),
      sanitized.is_active !== undefined ? (sanitized.is_active ? 1 : 0) : 1
    );

    return { id: result.lastInsertRowid };
  }));

  ipcMain.handle('db:updatePenaltyRule', createHandler(async (event, id, data) => {
    const allowedFields = ['rule_name', 'days_after_due', 'penalty_type', 'penalty_value', 'max_penalty_cap', 'is_active'];
    const sanitized = sanitizeObject(data, allowedFields);
    const fields = [];
    const values = [];

    Object.keys(sanitized).forEach(key => {
      if (allowedFields.includes(key) && sanitized[key] !== undefined) {
        fields.push(`${key} = ?`);
        if (['days_after_due', 'is_active'].includes(key)) values.push(parseInt(sanitized[key]) || 0);
        else if (['penalty_value', 'max_penalty_cap'].includes(key)) values.push(validatePositiveNumber(sanitized[key], 0));
        else values.push(sanitized[key]);
      }
    });

    if (fields.length === 0) return { changes: 0 };
    fields.push("updated_at = datetime('now')");
    values.push(id);

    const result = db.prepare(`UPDATE emi_penalty_rules SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return { changes: result.changes };
  }));

  ipcMain.handle('db:deletePenaltyRule', createHandler(async (event, id) => {
    const result = db.prepare("DELETE FROM emi_penalty_rules WHERE id = ?").run(id);
    return { changes: result.changes };
  }));

  // ============================================================
  // 8. CUSTOMER EMI SUMMARY
  // ============================================================

  ipcMain.handle('db:getCustomerEmiSummary', createHandler(async (event, customerId) => {
    const row = db.prepare(`
      SELECT ces.*, c.name, c.phone, c.cnic
      FROM customer_emi_summary ces
      JOIN customers c ON ces.customer_id = c.id
      WHERE ces.customer_id = ?
    `).get(customerId);
    return row || null;
  }));

  ipcMain.handle('db:getAllCustomerSummaries', createHandler(async (event, filters = {}) => {
    let sql = `
      SELECT ces.*, c.name, c.phone, c.cnic, c.address, c.district
      FROM customer_emi_summary ces
      JOIN customers c ON ces.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.risk_level) { sql += " AND ces.risk_level = ?"; params.push(filters.risk_level); }
    if (filters.search) {
      sql += " AND (c.name LIKE ? OR c.phone LIKE ? OR c.cnic LIKE ?)";
      const s = `%${filters.search}%`;
      params.push(s, s, s);
    }
    sql += " ORDER BY ces.total_outstanding DESC";

    return db.prepare(sql).all(...params) || [];
  }));

  ipcMain.handle('db:recalculateCustomerSummary', createHandler(async (event, customerId) => {
    db.prepare(`
      INSERT INTO customer_emi_summary (
        customer_id, total_emis, active_emis, closed_emis, defaulted_emis,
        total_principal, total_down_paid, total_paid, total_penalty_paid, total_discount_given,
        total_outstanding, total_overdue_amount, last_payment_date, next_due_date, risk_level, updated_at
      )
      SELECT
        r.customer_id,
        COUNT(DISTINCT r.id) as total_emis,
        COUNT(DISTINCT CASE WHEN r.status = 'active' THEN r.id END) as active_emis,
        COUNT(DISTINCT CASE WHEN r.status = 'closed' THEN r.id END) as closed_emis,
        COUNT(DISTINCT CASE WHEN r.status = 'defaulted' THEN r.id END) as defaulted_emis,
        COALESCE(SUM(r.total_amount - r.down_payment), 0) as total_principal,
        COALESCE(SUM(r.down_payment), 0) as total_down_paid,
        COALESCE(SUM(p.amount), 0) as total_paid,
        COALESCE(SUM(p.penalty_amount), 0) as total_penalty_paid,
        COALESCE(SUM(p.discount_amount), 0) as total_discount_given,
        COALESCE(SUM(r.remaining_amount), 0) as total_outstanding,
        COALESCE(SUM(CASE WHEN r.next_due_date < date('now') AND r.status = 'active' THEN r.remaining_amount ELSE 0 END), 0) as total_overdue_amount,
        MAX(p.payment_date) as last_payment_date,
        MIN(CASE WHEN r.status = 'active' THEN r.next_due_date END) as next_due_date,
        CASE
          WHEN COUNT(DISTINCT CASE WHEN r.status = 'defaulted' THEN r.id END) > 0 THEN 'high'
          WHEN COUNT(DISTINCT CASE WHEN r.status = 'overdue' THEN r.id END) > 0 THEN 'medium'
          ELSE 'low'
        END as risk_level,
        datetime('now') as updated_at
      FROM emi_records r
      LEFT JOIN emi_payments p ON r.id = p.emi_id AND p.is_reversal = 0
      WHERE r.customer_id = ? AND r.is_deleted = 0
      GROUP BY r.customer_id
      ON CONFLICT(customer_id) DO UPDATE SET
        total_emis = excluded.total_emis,
        active_emis = excluded.active_emis,
        closed_emis = excluded.closed_emis,
        defaulted_emis = excluded.defaulted_emis,
        total_principal = excluded.total_principal,
        total_down_paid = excluded.total_down_paid,
        total_paid = excluded.total_paid,
        total_penalty_paid = excluded.total_penalty_paid,
        total_discount_given = excluded.total_discount_given,
        total_outstanding = excluded.total_outstanding,
        total_overdue_amount = excluded.total_overdue_amount,
        last_payment_date = excluded.last_payment_date,
        next_due_date = excluded.next_due_date,
        risk_level = excluded.risk_level,
        updated_at = excluded.updated_at
    `).run(customerId);

    const summary = db.prepare(`
      SELECT ces.*, c.name, c.phone, c.cnic
      FROM customer_emi_summary ces
      JOIN customers c ON ces.customer_id = c.id
      WHERE ces.customer_id = ?
    `).get(customerId);

    return summary || null;
  }));

  // ============================================================
  // 9. EMI PAYMENTS
  // ============================================================

  ipcMain.handle('db:getEmiPayments', createHandler(async (event, emiId) => {
    return db.prepare(`
      SELECT p.*, u.name as created_by_name
      FROM emi_payments p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.emi_id = ? ORDER BY p.payment_date DESC, p.id DESC
    `).all(emiId) || [];
  }));

  ipcMain.handle('db:getEmiPaymentById', createHandler(async (event, id) => {
    const row = db.prepare("SELECT * FROM emi_payments WHERE id = ?").get(id);
    return row || null;
  }));

  ipcMain.handle('db:getPaymentByReceiptNo', createHandler(async (event, receiptNo) => {
    const row = db.prepare("SELECT * FROM emi_payments WHERE receipt_no = ?").get(receiptNo);
    return row || null;
  }));

  ipcMain.handle('db:addEmiPayment', createHandler(async (event, data) => {
    const emiId = data.emi_id;
    const amount = validatePositiveNumber(data.amount, 0);
    if (amount <= 0) throw new Error('Payment amount must be greater than 0');

    const emi = db.prepare(`SELECT * FROM emi_records WHERE id = ? AND is_deleted = 0`).get(emiId);
    if (!emi) throw new Error('EMI record not found');
    if (emi.status === 'completed') throw new Error('EMI is already completed');
    if (emi.status === 'defaulted') throw new Error('EMI is defaulted. Re-activate first.');

    const transaction = db.transaction(() => {
      const penaltyAmount = validatePositiveNumber(data.penalty_amount, 0);
      const discountAmount = validatePositiveNumber(data.discount_amount, 0);
      const totalReceived = amount + penaltyAmount - discountAmount;

      const paymentDate = data.payment_date || todayStr();
      const paymentMode = sanitizeInput(data.payment_mode || 'cash');

      const result = db.prepare(`
        INSERT INTO emi_payments (
          emi_id, amount, penalty_amount, discount_amount, total_received,
          payment_date, payment_mode, bank_name, cheque_no, cheque_date,
          cheque_clearance_date, cheque_status, receipt_no, notes,
          is_reversal, reversed_payment_id, created_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
      `).run(
        emiId, amount, penaltyAmount, discountAmount, totalReceived,
        paymentDate, paymentMode,
        data.bank_name || null,
        data.cheque_no || null,
        validateDate(data.cheque_date) || null,
        validateDate(data.cheque_clearance_date) || null,
        data.cheque_status || 'pending',
        data.receipt_no || null,
        sanitizeInput(data.notes || ''),
        0, null,
        data.created_by || event.sender?.userId || 1
      );

      _syncEmiAfterPayment(db, emiId);

      if (emi.customer_id) {
        const prevBalance = getCustomerBalance(db, emi.customer_id);
        db.prepare(`
          INSERT INTO customer_ledger (
            customer_id, type, amount, previous_balance, balance_after,
            description, payment_mode, reference_no, date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          emi.customer_id,
          'emi_payment',
          amount,
          prevBalance,
          prevBalance + amount,
          `EMI Payment - ${emi.application_no}`,
          paymentMode,
          data.receipt_no || `${emi.application_no}-PAY`,
          paymentDate
        );
      }

      logAudit(data.created_by || event.sender?.userId || 1, 'payment', 'emi_records', emiId);
      return { 
        id: result.lastInsertRowid, 
        remaining: db.prepare("SELECT remaining_amount FROM emi_records WHERE id = ?").get(emiId).remaining_amount 
      };
    });

    return transaction();
  }));

  ipcMain.handle('db:updateEmiPayment', createHandler(async (event, id, data) => {
    const allowedFields = [
      'amount', 'penalty_amount', 'discount_amount', 'total_received',
      'payment_date', 'payment_mode', 'bank_name', 'cheque_no',
      'cheque_date', 'cheque_clearance_date', 'cheque_status', 'receipt_no',
      'notes', 'is_reversal', 'reversed_payment_id'
    ];
    const sanitized = sanitizeObject(data, allowedFields);
    const fields = [];
    const values = [];

    Object.keys(sanitized).forEach(key => {
      if (allowedFields.includes(key) && sanitized[key] !== undefined) {
        fields.push(`${key} = ?`);
        if (['amount', 'penalty_amount', 'discount_amount', 'total_received'].includes(key)) {
          values.push(validatePositiveNumber(sanitized[key], 0));
        } else {
          values.push(sanitized[key]);
        }
      }
    });

    if (fields.length === 0) return { changes: 0 };
    values.push(id);

    const result = db.prepare(`UPDATE emi_payments SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const paymentRow = db.prepare("SELECT emi_id FROM emi_payments WHERE id = ?").get(id);
    if (paymentRow) _syncEmiAfterPayment(db, paymentRow.emi_id);

    return { changes: result.changes };
  }));

  ipcMain.handle('db:deleteEmiPayment', createHandler(async (event, id) => {
    const payment = db.prepare("SELECT emi_id, amount FROM emi_payments WHERE id = ?").get(id);
    if (!payment) throw new Error('Payment not found');

    const emi = db.prepare("SELECT * FROM emi_records WHERE id = ?").get(payment.emi_id);

    const transaction = db.transaction(() => {
      db.prepare("DELETE FROM emi_payments WHERE id = ?").run(id);
      _syncEmiAfterPayment(db, payment.emi_id);

      if (emi && emi.customer_id) {
        const prevBalance = getCustomerBalance(db, emi.customer_id);
        db.prepare(`
          INSERT INTO customer_ledger (
            customer_id, type, amount, previous_balance, balance_after,
            description, payment_mode, reference_no, date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          emi.customer_id,
          'emi_payment_reversal',
          -payment.amount,
          prevBalance,
          prevBalance - payment.amount,
          `EMI Payment Reversed - ${emi.application_no}`,
          'adjustment',
          `REV-${id}`,
          nowISO()
        );
      }

      logAudit(event.sender?.userId || 1, 'delete_payment', 'emi_records', payment.emi_id);
    });

    transaction();
    return { success: true };
  }));

  ipcMain.handle('db:reverseEmiPayment', createHandler(async (event, id, reason = '') => {
    const original = db.prepare("SELECT * FROM emi_payments WHERE id = ?").get(id);
    if (!original) throw new Error('Payment not found');
    if (original.is_reversal) throw new Error('Already a reversal');

    const transaction = db.transaction(() => {
      const reversal = {
        emi_id: original.emi_id,
        amount: -(original.amount || 0),
        penalty_amount: -(original.penalty_amount || 0),
        discount_amount: -(original.discount_amount || 0),
        total_received: -(original.total_received || 0),
        payment_date: todayStr(),
        payment_mode: original.payment_mode,
        notes: `REVERSAL: ${reason}`,
        is_reversal: 1,
        reversed_payment_id: id,
        created_by: original.created_by || event.sender?.userId || 1
      };

      const result = db.prepare(`
        INSERT INTO emi_payments (
          emi_id, amount, penalty_amount, discount_amount, total_received,
          payment_date, payment_mode, notes, is_reversal, reversed_payment_id, created_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
      `).run(
        reversal.emi_id, reversal.amount, reversal.penalty_amount,
        reversal.discount_amount, reversal.total_received,
        reversal.payment_date, reversal.payment_mode, reversal.notes,
        1, id, reversal.created_by
      );

      db.prepare(`UPDATE emi_payments SET notes = ? WHERE id = ?`).run(
        `${original.notes || ''} [REVERSED]`.trim(), id
      );

      _syncEmiAfterPayment(db, original.emi_id);

      return { id: result.lastInsertRowid };
    });

    return transaction();
  }));

  ipcMain.handle('db:clearEmiCheque', createHandler(async (event, id, clearanceDate) => {
    const result = db.prepare(`
      UPDATE emi_payments SET 
        cheque_status = 'cleared', 
        cheque_clearance_date = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(clearanceDate || todayStr(), id);
    return { changes: result.changes };
  }));

  ipcMain.handle('db:bounceEmiCheque', createHandler(async (event, id) => {
    const result = db.prepare(`
      UPDATE emi_payments SET 
        cheque_status = 'bounced',
        updated_at = datetime('now')
      WHERE id = ?
    `).run(id);
    return { changes: result.changes };
  }));

  // ============================================================
  // 10. REPORTING / VIEWS
  // ============================================================

  ipcMain.handle('db:getEmiLedger', createHandler(async (event, filters = {}) => {
    let sql = `
      SELECT
        e.id as emi_id,
        e.application_no,
        e.customer_id,
        c.name as customer_name,
        c.phone as customer_phone,
        c.cnic as customer_cnic,
        e.product_name,
        e.product_sku,
        e.total_amount,
        e.down_payment,
        e.remaining_amount,
        e.emi_amount,
        e.interest_rate,
        e.total_months,
        e.paid_months,
        e.start_date,
        e.next_due_date,
        e.status,
        CASE WHEN e.next_due_date < date('now') AND e.status = 'active' THEN 'overdue' ELSE e.status END as computed_status,
        CASE WHEN e.next_due_date < date('now') AND e.status = 'active' 
             THEN CAST(julianday('now') - julianday(e.next_due_date) AS INTEGER)
             ELSE 0 END as days_overdue,
        COALESCE(p.total_paid, 0) as total_paid,
        COALESCE(p.total_penalty, 0) as total_penalty,
        COALESCE(p.payment_count, 0) as payment_count,
        p.last_payment_date,
        (e.total_amount - e.down_payment - COALESCE(p.total_paid, 0)) as balance_due
      FROM emi_records e
      LEFT JOIN customers c ON e.customer_id = c.id
      LEFT JOIN (
        SELECT emi_id, SUM(amount) as total_paid, SUM(penalty_amount) as total_penalty,
               COUNT(*) as payment_count, MAX(payment_date) as last_payment_date
        FROM emi_payments WHERE is_reversal = 0 GROUP BY emi_id
      ) p ON e.id = p.emi_id
      WHERE e.is_deleted = 0
    `;
    const params = [];

    if (filters.status) { 
      sql += " AND (CASE WHEN e.next_due_date < date('now') AND e.status = 'active' THEN 'overdue' ELSE e.status END) = ?"; 
      params.push(filters.status); 
    }
    if (filters.customer_id) { sql += " AND e.customer_id = ?"; params.push(filters.customer_id); }
    if (filters.salesman_id) { sql += " AND e.salesman_id = ?"; params.push(filters.salesman_id); }
    if (filters.search) {
      sql += " AND (e.application_no LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR c.cnic LIKE ?)";
      const s = `%${filters.search}%`;
      params.push(s, s, s, s);
    }
    sql += " ORDER BY days_overdue DESC, e.id DESC";

    return db.prepare(sql).all(...params) || [];
  }));

  ipcMain.handle('db:getOverdueEmis', createHandler(async (event) => {
    return db.prepare(`
      SELECT
        e.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.cnic as customer_cnic,
        CAST(julianday('now') - julianday(e.next_due_date) AS INTEGER) as days_overdue
      FROM emi_records e
      LEFT JOIN customers c ON e.customer_id = c.id
      WHERE e.is_deleted = 0 AND e.status = 'active' AND e.next_due_date < date('now')
      ORDER BY days_overdue DESC
    `).all() || [];
  }));

  ipcMain.handle('db:getStaffCollectionReport', createHandler(async (event) => {
    return db.prepare(`
      SELECT
        sm.id as salesman_id,
        sm.name as salesman_name,
        COUNT(DISTINCT e.id) as total_emis_sold,
        COALESCE(SUM(e.total_amount), 0) as total_value_sold,
        COALESCE(SUM(p.amount), 0) as total_collected,
        COALESCE(SUM(p.penalty_amount), 0) as total_penalty_collected,
        COUNT(DISTINCT CASE WHEN e.status = 'active' THEN e.id END) as active_emis,
        COUNT(DISTINCT CASE WHEN e.status = 'defaulted' THEN e.id END) as defaulted_emis
      FROM salesmen sm
      LEFT JOIN emi_records e ON sm.id = e.salesman_id AND e.is_deleted = 0
      LEFT JOIN emi_payments p ON e.id = p.emi_id AND p.is_reversal = 0
      GROUP BY sm.id, sm.name
      ORDER BY total_collected DESC
    `).all() || [];
  }));

  ipcMain.handle('db:getCustomerRiskReport', createHandler(async (event) => {
    const rows = db.prepare(`
      SELECT
        ces.customer_id,
        c.name,
        c.phone,
        c.cnic,
        ces.total_emis,
        ces.active_emis,
        ces.defaulted_emis,
        ces.total_outstanding,
        ces.total_overdue_amount,
        ces.last_payment_date,
        ces.risk_level,
        CASE
          WHEN ces.total_outstanding > 500000 THEN 'high_value'
          WHEN ces.total_outstanding > 100000 THEN 'medium_value'
          ELSE 'low_value'
        END as customer_tier,
        CASE 
          WHEN ces.last_payment_date IS NOT NULL 
          THEN CAST(julianday('now') - julianday(ces.last_payment_date) AS INTEGER)
          ELSE NULL 
        END as days_since_last_payment
      FROM customer_emi_summary ces
      JOIN customers c ON ces.customer_id = c.id
      ORDER BY ces.total_outstanding DESC
    `).all() || [];
    return rows;
  }));

  // ============================================================
  // 11. DASHBOARD / STATS
  // ============================================================

  ipcMain.handle('db:getEmiDashboardStats', createHandler(async (event) => {
    const emiStats = db.prepare(`
      SELECT
        COUNT(*) as total_emis,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_emis,
        COUNT(CASE WHEN status = 'active' AND next_due_date < date('now') THEN 1 END) as overdue_emis,
        COUNT(CASE WHEN status = 'defaulted' THEN 1 END) as defaulted_emis,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_emis,
        COALESCE(SUM(total_amount), 0) as total_portfolio,
        COALESCE(SUM(remaining_amount), 0) as total_outstanding,
        COALESCE(SUM(down_payment), 0) as total_down_payments
      FROM emi_records WHERE is_deleted = 0
    `).get();

    const payStats = db.prepare(`
      SELECT
        COALESCE(SUM(amount), 0) as total_collected,
        COALESCE(SUM(penalty_amount), 0) as total_penalty_collected,
        COALESCE(SUM(discount_amount), 0) as total_discount_given
      FROM emi_payments WHERE is_reversal = 0
    `).get();

    return { ...emiStats, ...payStats };
  }));

  // ============================================================
  // 12. PENALTY CALCULATOR
  // ============================================================

  ipcMain.handle('db:calculateEmiPenalty', createHandler(async (event, emiId, ruleId = null) => {
    const emi = db.prepare(`
      SELECT * FROM emi_records WHERE id = ? AND is_deleted = 0
    `).get(emiId);
    if (!emi) throw new Error('EMI not found');
    if (!emi.next_due_date) return { daysOverdue: 0, penalty: 0, rule: null };

    const daysOverdue = Math.floor((new Date() - new Date(emi.next_due_date)) / (1000 * 60 * 60 * 24));
    if (daysOverdue <= 0) return { daysOverdue: 0, penalty: 0, rule: null };

    let rules;
    if (ruleId) {
      const rule = db.prepare("SELECT * FROM emi_penalty_rules WHERE id = ?").get(ruleId);
      rules = rule ? [rule] : [];
    } else {
      rules = db.prepare("SELECT * FROM emi_penalty_rules WHERE is_active = 1 ORDER BY days_after_due").all();
    }

    const applicable = [...rules].reverse().find(r => daysOverdue >= r.days_after_due);
    if (!applicable) return { daysOverdue, penalty: 0, rule: null };

    let penalty = 0;
    if (applicable.penalty_type === 'fixed') {
      penalty = applicable.penalty_value;
    } else if (applicable.penalty_type === 'percentage_daily') {
      penalty = (emi.emi_amount * applicable.penalty_value / 100) * daysOverdue;
    } else if (applicable.penalty_type === 'percentage_monthly') {
      penalty = (emi.emi_amount * applicable.penalty_value / 100) * Math.ceil(daysOverdue / 30);
    }

    if (applicable.max_penalty_cap > 0 && penalty > applicable.max_penalty_cap) {
      penalty = applicable.max_penalty_cap;
    }

    return { daysOverdue, penalty: Math.round(penalty * 100) / 100, rule: applicable };
  }));

  // ============================================================
  // 13. EMI CLOSURE / SETTLEMENT
  // ============================================================

  ipcMain.handle('db:closeEmi', createHandler(async (event, id, reason = '') => {
    const emi = db.prepare("SELECT * FROM emi_records WHERE id = ? AND is_deleted = 0").get(id);
    if (!emi) throw new Error('EMI not found');

    const newNotes = `${emi.notes || ''}\nCLOSED: ${reason}`.trim();
    const result = db.prepare(`
      UPDATE emi_records SET 
        status = 'closed', 
        remaining_amount = 0, 
        notes = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(newNotes, id);

    logAudit(event.sender?.userId || 1, 'close', 'emi_records', id);
    return { changes: result.changes };
  }));

  ipcMain.handle('db:settleEmi', createHandler(async (event, id, settlementAmount, reason = '') => {
    const emi = db.prepare("SELECT * FROM emi_records WHERE id = ? AND is_deleted = 0").get(id);
    if (!emi) throw new Error('EMI not found');

    const transaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO emi_payments (
          emi_id, amount, payment_mode, notes, created_at, created_by
        ) VALUES (?, ?, 'cash', ?, datetime('now'), ?)
      `).run(
        id,
        validatePositiveNumber(settlementAmount, 0),
        `SETTLEMENT: ${reason}`,
        event.sender?.userId || 1
      );

      const newNotes = `${emi.notes || ''}\nSETTLED: ${reason}`.trim();
      db.prepare(`
        UPDATE emi_records SET 
          status = 'settled', 
          notes = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(newNotes, id);

      _syncEmiAfterPayment(db, id);
      logAudit(event.sender?.userId || 1, 'settle', 'emi_records', id);
    });

    transaction();
    return { success: true };
  }));

} // end registerEmiHandlers

module.exports = { registerEmiHandlers };