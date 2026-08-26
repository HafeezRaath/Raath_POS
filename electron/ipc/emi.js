const { ipcMain } = require('electron');
const { getDb } = require('../database/connection');
const { logAudit } = require('../utils/audit');
const { sanitizeObject, sanitizeInput, validatePositiveNumber, validateDate } = require('../utils/validators');
const { calculateEMI, calculateEMISchedule, generateApplicationNo, getCustomerBalance } = require('../utils/calculations');
const { validateStockAvailability } = require('../utils/validators');
const { createHandler } = require('./helpers');

function registerEmiHandlers() {
  ipcMain.handle('db:getEmiRecords', createHandler(async (event, filters = {}) => {
    const db = getDb();
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
    if (filters.from_date) { sql += " AND DATE(e.start_date) >= DATE(?)"; params.push(filters.from_date); }
    if (filters.to_date) { sql += " AND DATE(e.start_date) <= DATE(?)"; params.push(filters.to_date); }
    if (filters.search) { 
      sql += " AND (e.application_no LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR c.cnic LIKE ?)";
      const s = `%${filters.search}%`;
      params.push(s, s, s, s);
    }
    sql += " ORDER BY e.created_at DESC";
    return db.prepare(sql).all(...params) || [];
  }));

  ipcMain.handle('db:getEmiById', createHandler(async (event, id) => {
    const db = getDb();
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

    emi.guarantors = db.prepare(`SELECT * FROM emi_guarantors WHERE emi_id = ? ORDER BY guarantor_type`).all(id) || [];
    emi.payments = db.prepare(`SELECT * FROM emi_payments WHERE emi_id = ? ORDER BY month_number ASC, payment_date ASC`).all(id) || [];
    emi.visits = db.prepare(`
      SELECT v.*, s.name as staff_name 
      FROM emi_visit_log v 
      LEFT JOIN staff s ON v.staff_id = s.id 
      WHERE v.emi_id = ? ORDER BY v.visit_date DESC
    `).all(id) || [];
    emi.documents = db.prepare(`SELECT * FROM emi_documents WHERE emi_id = ? ORDER BY uploaded_at DESC`).all(id) || [];

    const principal = (emi.total_amount || 0) - (emi.down_payment || 0);
    const schedule = calculateEMISchedule(principal, emi.interest_rate || 0, emi.total_months || 0, emi.start_date, emi.due_day || 1);
    emi.schedule = schedule.schedule;
    emi.total_interest = schedule.interest;

    const stats = db.prepare(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_collected,
        COALESCE(SUM(late_fee), 0) as total_late_fees,
        COALESCE(SUM(discount), 0) as total_discounts,
        COUNT(DISTINCT month_number) as unique_months_paid,
        MAX(month_number) as last_month_paid,
        MAX(payment_date) as last_payment_date
      FROM emi_payments
      WHERE emi_id = ?
    `).get(id);
    emi.payment_stats = stats;

    return emi;
  }));

  ipcMain.handle('db:createEmi', createHandler(async (event, data) => {
    const db = getDb();
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
      
      const startDate = validateDate(emiData.start_date) || new Date().toISOString();
      const dueDay = parseInt(emiData.due_day) || 1;
      const firstDue = new Date(startDate);
      firstDue.setMonth(firstDue.getMonth() + 1);
      firstDue.setDate(Math.min(28, Math.max(1, dueDay)));

      const result = db.prepare(`
        INSERT INTO emi_records (
          application_no, customer_id, product_variant_id, product_name, product_sku,
          product_retail_price, product_cost_price, total_amount, down_payment, remaining_amount,
          emi_amount, interest_rate, total_months, paid_months, start_date, next_due_date, due_day,
          status, salesman_id, shop_location, notes, agreement_signed, agreement_date, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
        validateDate(emiData.agreement_date)
      );

      const emiId = result.lastInsertRowid;

      if (emiData.guarantors && Array.isArray(emiData.guarantors)) {
        const insertGuarantor = db.prepare(`
          INSERT INTO emi_guarantors (
            emi_id, guarantor_type, name, phone, cnic, address, occupation,
            monthly_income, relation_to_customer, passport_photo_path, blank_check_photo_path,
            cnic_front_photo_path, cnic_back_photo_path
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          INSERT INTO emi_visit_log (emi_id, visit_date, visit_type, notes, outcome, staff_id)
          VALUES (?, datetime('now'), 'enrollment', ?, 'Application submitted', ?)
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
          new Date().toISOString()
        );
      }

      logAudit(emiData.created_by || 1, 'create', 'emi_records', emiId);
      return { id: emiId, application_no: appNo, emi_amount: emiAmount, remaining_amount: remainingAmount };
    });

    return transaction(data);
  }));

  ipcMain.handle('db:updateEmi', createHandler(async (event, id, data) => {
    const db = getDb();
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
    logAudit(data.updated_by || 1, 'update', 'emi_records', id);
    return { changes: result.changes };
  }));

  ipcMain.handle('db:deleteEmi', createHandler(async (event, id) => {
    const db = getDb();
    const emi = db.prepare("SELECT customer_id, remaining_amount, product_variant_id FROM emi_records WHERE id = ? AND is_deleted = 0").get(id);
    if (!emi) throw new Error('EMI record not found');

    const payments = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM emi_payments WHERE emi_id = ?").get(id);
    if (payments.total > 0 && parseFloat(emi.remaining_amount) > 0) {
      throw new Error('Cannot delete EMI with pending balance and payments. Mark as defaulted instead.');
    }

    const transaction = db.transaction(() => {
      if (emi.product_variant_id) {
        db.prepare("UPDATE product_variants SET current_stock = current_stock + 1 WHERE id = ?").run(emi.product_variant_id);
      }
      db.prepare("UPDATE emi_records SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?").run(id);
      db.prepare("DELETE FROM emi_guarantors WHERE emi_id = ?").run(id);
      logAudit(event.sender?.userId || 1, 'delete', 'emi_records', id);
    });

    transaction();
    return { success: true };
  }));

  ipcMain.handle('db:getEmiPayments', createHandler(async (event, emiId) => {
    const db = getDb();
    return db.prepare(`SELECT * FROM emi_payments WHERE emi_id = ? ORDER BY month_number ASC, payment_date ASC`).all(emiId) || [];
  }));

  ipcMain.handle('db:addEmiPayment', createHandler(async (event, data) => {
    const db = getDb();
    const emiId = data.emi_id;
    const amount = validatePositiveNumber(data.amount, 0);
    if (amount <= 0) throw new Error('Payment amount must be greater than 0');

    const emi = db.prepare(`SELECT * FROM emi_records WHERE id = ? AND is_deleted = 0`).get(emiId);
    if (!emi) throw new Error('EMI record not found');
    if (emi.status === 'completed') throw new Error('EMI is already completed');
    if (emi.status === 'defaulted') throw new Error('EMI is defaulted. Re-activate first.');

    const transaction = db.transaction(() => {
      const monthNumber = parseInt(data.month_number) || (parseInt(emi.paid_months) + 1);
      const lateFee = validatePositiveNumber(data.late_fee, 0);
      const discount = validatePositiveNumber(data.discount, 0);
      const newRemaining = Math.max(0, (parseFloat(emi.remaining_amount) || 0) - amount);
      const newPaidMonths = parseInt(emi.paid_months) + 1;
      const nextDue = new Date(emi.next_due_date || new Date());
      nextDue.setMonth(nextDue.getMonth() + 1);
      const newStatus = newRemaining <= 0.01 ? 'completed' : 'active';

      db.prepare(`
        INSERT INTO emi_payments (
          emi_id, amount, month_number, payment_date, due_date, payment_mode,
          notes, late_fee, discount, received_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        emiId, amount, monthNumber,
        data.payment_date || new Date().toISOString(),
        data.due_date || emi.next_due_date,
        sanitizeInput(data.payment_mode || 'cash'),
        sanitizeInput(data.notes || ''),
        lateFee, discount,
        sanitizeInput(data.received_by || '')
      );

      db.prepare(`
        UPDATE emi_records SET 
          paid_months = ?, remaining_amount = ?, next_due_date = ?, status = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(newPaidMonths, newRemaining, nextDue.toISOString(), newStatus, emiId);

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
          `EMI Payment - ${emi.application_no} (Month ${monthNumber})`,
          data.payment_mode || 'cash',
          `${emi.application_no}-M${monthNumber}`,
          data.payment_date || new Date().toISOString()
        );
      }

      logAudit(data.created_by || 1, 'payment', 'emi_records', emiId);
      return { remaining: newRemaining, status: newStatus, month_number: monthNumber };
    });

    return transaction();
  }));

  ipcMain.handle('db:deleteEmiPayment', createHandler(async (event, paymentId) => {
    const db = getDb();
    const payment = db.prepare("SELECT * FROM emi_payments WHERE id = ?").get(paymentId);
    if (!payment) throw new Error('Payment not found');

    const emi = db.prepare("SELECT * FROM emi_records WHERE id = ?").get(payment.emi_id);

    const transaction = db.transaction(() => {
      const newRemaining = (parseFloat(emi.remaining_amount) || 0) + payment.amount;
      const newPaidMonths = Math.max(0, (parseInt(emi.paid_months) || 0) - 1);
      const nextDue = new Date(emi.next_due_date || new Date());
      nextDue.setMonth(nextDue.getMonth() - 1);

      db.prepare(`
        UPDATE emi_records SET 
          paid_months = ?, remaining_amount = ?, next_due_date = ?, status = 'active', updated_at = datetime('now')
        WHERE id = ?
      `).run(newPaidMonths, newRemaining, nextDue.toISOString(), payment.emi_id);

      db.prepare("DELETE FROM emi_payments WHERE id = ?").run(paymentId);

      if (emi.customer_id) {
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
          `REV-${paymentId}`,
          new Date().toISOString()
        );
      }

      logAudit(event.sender?.userId || 1, 'delete_payment', 'emi_records', payment.emi_id);
    });

    transaction();
    return { success: true };
  }));

  // Guarantors
  ipcMain.handle('db:getEmiGuarantors', createHandler(async (event, emiId) => {
    const db = getDb();
    return db.prepare("SELECT * FROM emi_guarantors WHERE emi_id = ? ORDER BY guarantor_type").all(emiId) || [];
  }));

  ipcMain.handle('db:addEmiGuarantor', createHandler(async (event, data) => {
    const db = getDb();
    const sanitized = sanitizeObject(data, ['emi_id', 'guarantor_type', 'name', 'phone', 'cnic', 'address', 'occupation', 'monthly_income', 'relation_to_customer', 'passport_photo_path', 'blank_check_photo_path', 'cnic_front_photo_path', 'cnic_back_photo_path']);
    const result = db.prepare(`
      INSERT INTO emi_guarantors (
        emi_id, guarantor_type, name, phone, cnic, address, occupation,
        monthly_income, relation_to_customer, passport_photo_path, blank_check_photo_path,
        cnic_front_photo_path, cnic_back_photo_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    const db = getDb();
    const allowedFields = ['name', 'phone', 'cnic', 'address', 'occupation', 'monthly_income', 'relation_to_customer', 'passport_photo_path', 'blank_check_photo_path', 'cnic_front_photo_path', 'cnic_back_photo_path', 'status'];
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
    values.push(id);
    const result = db.prepare(`UPDATE emi_guarantors SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return { changes: result.changes };
  }));

  ipcMain.handle('db:deleteEmiGuarantor', createHandler(async (event, id) => {
    const db = getDb();
    const result = db.prepare("DELETE FROM emi_guarantors WHERE id = ?").run(id);
    return { changes: result.changes };
  }));

  // Visit Log
  ipcMain.handle('db:getEmiVisitLog', createHandler(async (event, emiId) => {
    const db = getDb();
    return db.prepare(`
      SELECT v.*, s.name as staff_name 
      FROM emi_visit_log v 
      LEFT JOIN staff s ON v.staff_id = s.id 
      WHERE v.emi_id = ? ORDER BY v.visit_date DESC
    `).all(emiId) || [];
  }));

  ipcMain.handle('db:addEmiVisit', createHandler(async (event, data) => {
    const db = getDb();
    const sanitized = sanitizeObject(data, ['emi_id', 'visit_date', 'visit_type', 'staff_id', 'staff_name', 'notes', 'outcome', 'next_action', 'next_action_date', 'location', 'customer_met', 'amount_collected']);
    const result = db.prepare(`
      INSERT INTO emi_visit_log (
        emi_id, visit_date, visit_type, staff_id, staff_name, notes,
        outcome, next_action, next_action_date, location, customer_met, amount_collected
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sanitized.emi_id,
      sanitized.visit_date || new Date().toISOString(),
      sanitized.visit_type || 'visit',
      sanitized.staff_id || null,
      sanitized.staff_name || '',
      sanitized.notes || '',
      sanitized.outcome || '',
      sanitized.next_action || '',
      validateDate(sanitized.next_action_date),
      sanitized.location || '',
      sanitized.customer_met ? 1 : 0,
      validatePositiveNumber(sanitized.amount_collected, 0)
    );

    if (sanitized.amount_collected > 0 && data.record_as_payment) {
      const emi = db.prepare("SELECT * FROM emi_records WHERE id = ?").get(sanitized.emi_id);
      if (emi) {
        db.prepare(`
          INSERT INTO emi_payments (emi_id, amount, payment_date, payment_mode, notes, received_by)
          VALUES (?, ?, ?, 'collection_visit', ?, ?)
        `).run(
          sanitized.emi_id,
          validatePositiveNumber(sanitized.amount_collected, 0),
          sanitized.visit_date || new Date().toISOString(),
          `Collected during visit - ${sanitized.outcome || ''}`,
          sanitized.staff_name || ''
        );
        const newRemaining = Math.max(0, parseFloat(emi.remaining_amount) - sanitized.amount_collected);
        const newPaidMonths = parseInt(emi.paid_months) + 1;
        db.prepare(`UPDATE emi_records SET paid_months = ?, remaining_amount = ?, updated_at = datetime('now') WHERE id = ?`)
          .run(newPaidMonths, newRemaining, sanitized.emi_id);
      }
    }
    return { id: result.lastInsertRowid };
  }));

  ipcMain.handle('db:updateEmiVisit', createHandler(async (event, id, data) => {
    const db = getDb();
    const allowedFields = ['visit_date', 'visit_type', 'staff_id', 'notes', 'outcome', 'next_action', 'next_action_date', 'location', 'customer_met', 'amount_collected'];
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
    const db = getDb();
    const result = db.prepare("DELETE FROM emi_visit_log WHERE id = ?").run(id);
    return { changes: result.changes };
  }));
}

module.exports = { registerEmiHandlers };