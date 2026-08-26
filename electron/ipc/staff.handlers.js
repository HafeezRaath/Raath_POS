const { ipcMain } = require('electron');
const { getDb } = require('../database/connection');
const { sanitizeObject, sanitizeInput, validatePositiveNumber } = require('../utils/validators');
const { calculateCommission } = require('../utils/calculations');
const { createHandler } = require('./helpers');

// Local helper
const safeJsonParse = (str, defaultValue = []) => {
  try { return JSON.parse(str); } catch { return defaultValue; }
};

function registerStaffHandlers() {
  // ═══════════════════════════════════════════════════
  // STAFF (5 Handlers)
  // ═══════════════════════════════════════════════════

  // ─── 1. GET ALL STAFF ───
  ipcMain.handle('db:getStaff', createHandler(async () => {
    const db = getDb();
    return db.prepare("SELECT * FROM staff WHERE is_deleted = 0 ORDER BY name").all() || [];
  }));

  // ─── 2. GET STAFF BY ID ───
  ipcMain.handle('db:getStaffById', createHandler(async (event, id) => {
    const db = getDb();
    return db.prepare("SELECT * FROM staff WHERE id = ? AND is_deleted = 0").get(id);
  }));

  // ─── 3. ADD STAFF ───
  ipcMain.handle('db:addStaff', createHandler(async (event, staff) => {
    const db = getDb();
    const sanitized = sanitizeObject(staff, ['name', 'phone', 'role', 'commission_rate', 'base_salary', 'active']);

    const result = db.prepare(`
      INSERT INTO staff (name, phone, role, commission_rate, base_salary, active) 
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      sanitized.name,
      sanitized.phone || '',
      sanitized.role || 'technician',
      validatePositiveNumber(sanitized.commission_rate, 0),
      validatePositiveNumber(sanitized.base_salary, 0),
      sanitized.active !== false ? 1 : 0
    );

    return { id: result.lastInsertRowid };
  }));

  // ─── 4. UPDATE STAFF ───
  ipcMain.handle('db:updateStaff', createHandler(async (event, id, staff) => {
    const db = getDb();
    const sanitized = sanitizeObject(staff, ['name', 'phone', 'role', 'commission_rate', 'base_salary', 'active']);

    const result = db.prepare(`
      UPDATE staff SET name = ?, phone = ?, role = ?, commission_rate = ?, base_salary = ?, active = ? WHERE id = ?
    `).run(
      sanitized.name,
      sanitized.phone || '',
      sanitized.role || 'technician',
      validatePositiveNumber(sanitized.commission_rate, 0),
      validatePositiveNumber(sanitized.base_salary, 0),
      sanitized.active !== false ? 1 : 0,
      id
    );

    return { changes: result.changes };
  }));

  // ─── 5. DELETE STAFF ───
  ipcMain.handle('db:deleteStaff', createHandler(async (event, id) => {
    const db = getDb();
    const result = db.prepare("UPDATE staff SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?").run(id);
    return { changes: result.changes };
  }));

  // ═══════════════════════════════════════════════════
  // WORK ORDERS (6 Handlers)
  // ═══════════════════════════════════════════════════

  // ─── 6. GET WORK ORDERS ───
  ipcMain.handle('db:getWorkOrders', createHandler(async (event, filters = {}) => {
    const db = getDb();
    let sql = `
      SELECT wo.*, s.name as service_name, st.name as staff_name, c.name as customer_name, st.commission_rate as staff_commission_rate
      FROM work_orders wo
      LEFT JOIN services s ON wo.service_id = s.id
      LEFT JOIN staff st ON wo.staff_id = st.id
      LEFT JOIN customers c ON wo.customer_id = c.id
      WHERE wo.is_deleted = 0
    `;
    const params = [];

    if (filters.status) { sql += " AND wo.status = ?"; params.push(filters.status); }
    if (filters.staffId) { sql += " AND wo.staff_id = ?"; params.push(filters.staffId); }
    if (filters.startDate) { sql += " AND DATE(wo.created_at) >= DATE(?)"; params.push(filters.startDate); }
    if (filters.endDate) { sql += " AND DATE(wo.created_at) <= DATE(?)"; params.push(filters.endDate); }

    sql += " ORDER BY wo.id DESC";

    const rows = db.prepare(sql).all(...params);
    return rows.map(r => ({ ...r, parts_used: safeJsonParse(r.parts_used, []) }));
  }));

  // ─── 7. GET WORK ORDER BY ID ───
  ipcMain.handle('db:getWorkOrderById', createHandler(async (event, id) => {
    const db = getDb();
    const row = db.prepare(`
      SELECT wo.*, s.name as service_name, st.name as staff_name, st.commission_rate as staff_commission_rate
      FROM work_orders wo
      LEFT JOIN services s ON wo.service_id = s.id
      LEFT JOIN staff st ON wo.staff_id = st.id
      WHERE wo.id = ? AND wo.is_deleted = 0
    `).get(id);

    if (row) {
      row.parts_used = safeJsonParse(row.parts_used, []);
    }
    return row;
  }));

  // ─── 8. ADD WORK ORDER ───
  ipcMain.handle('db:addWorkOrder', createHandler(async (event, wo) => {
    const db = getDb();
    const sanitized = sanitizeObject(wo, [
      'service_id', 'staff_id', 'customer_id', 'machine_name', 'device_model', 
      'imei', 'problem_description', 'status', 'parts_used', 'notes', 
      'total_cost', 'payment_status', 'payment_mode', 'commission_amount', 
      'created_at', 'completed_at'
    ]);

    let commissionAmount = validatePositiveNumber(sanitized.commission_amount, 0);
    if (sanitized.staff_id && !sanitized.commission_amount) {
      const staff = db.prepare("SELECT commission_rate FROM staff WHERE id = ?").get(sanitized.staff_id);
      if (staff) {
        commissionAmount = calculateCommission(sanitized.total_cost || 0, staff.commission_rate);
      }
    }

    const result = db.prepare(`
      INSERT INTO work_orders (
        service_id, staff_id, customer_id, machine_name, device_model, imei, 
        problem_description, status, parts_used, notes, total_cost, payment_status, 
        payment_mode, commission_amount, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sanitized.service_id || null,
      sanitized.staff_id || null,
      sanitized.customer_id || null,
      sanitized.machine_name || sanitized.device_model || '',
      sanitized.device_model || '',
      sanitized.imei || '',
      sanitized.problem_description || '',
      sanitized.status || 'pending',
      JSON.stringify(sanitized.parts_used || []),
      sanitized.notes || '',
      validatePositiveNumber(sanitized.total_cost, 0),
      sanitized.payment_status || 'unpaid',
      sanitized.payment_mode || 'pending',
      commissionAmount,
      sanitized.created_at || new Date().toISOString(),
      sanitized.completed_at || null
    );

    return { id: result.lastInsertRowid, commission: commissionAmount };
  }));

  // ─── 9. UPDATE WORK ORDER ───
  ipcMain.handle('db:updateWorkOrder', createHandler(async (event, id, wo) => {
    const db = getDb();
    const sanitized = sanitizeObject(wo, [
      'service_id', 'staff_id', 'customer_id', 'machine_name', 'device_model',
      'imei', 'problem_description', 'status', 'parts_used', 'notes',
      'total_cost', 'payment_status', 'payment_mode', 'commission_amount', 'completed_at'
    ]);

    const fields = [];
    const values = [];
    const allowedFields = [
      'service_id', 'staff_id', 'customer_id', 'machine_name', 'device_model',
      'imei', 'problem_description', 'status', 'parts_used', 'notes',
      'total_cost', 'payment_status', 'payment_mode', 'commission_amount', 'completed_at'
    ];

    if (sanitized.staff_id && !sanitized.commission_amount) {
      const staff = db.prepare("SELECT commission_rate FROM staff WHERE id = ?").get(sanitized.staff_id);
      if (staff) {
        const cost = sanitized.total_cost || db.prepare("SELECT total_cost FROM work_orders WHERE id = ?").get(id)?.total_cost || 0;
        sanitized.commission_amount = calculateCommission(cost, staff.commission_rate);
      }
    }

    Object.keys(sanitized).forEach(key => {
      if (allowedFields.includes(key) && sanitized[key] !== undefined) {
        fields.push(`${key} = ?`);
        if (key === 'parts_used') {
          values.push(JSON.stringify(sanitized[key] || []));
        } else {
          values.push(sanitized[key]);
        }
      }
    });

    if (fields.length === 0) return { changes: 0 };

    values.push(id);
    const result = db.prepare(`UPDATE work_orders SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return { changes: result.changes };
  }));

  // ─── 10. DELETE WORK ORDER ───
  ipcMain.handle('db:deleteWorkOrder', createHandler(async (event, id) => {
    const db = getDb();
    const result = db.prepare("UPDATE work_orders SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?").run(id);
    return { changes: result.changes };
  }));

  // ─── 11. COMPLETE WORK ORDER ───
  ipcMain.handle('db:completeWorkOrder', createHandler(async (event, id, data) => {
    const db = getDb();
    const sanitized = sanitizeObject(data, ['completed_at', 'notes', 'total_cost', 'commission_amount']);

    let commissionAmount = validatePositiveNumber(sanitized.commission_amount, 0);
    if (!sanitized.commission_amount) {
      const workOrder = db.prepare("SELECT staff_id, total_cost FROM work_orders WHERE id = ?").get(id);
      if (workOrder && workOrder.staff_id) {
        const staff = db.prepare("SELECT commission_rate FROM staff WHERE id = ?").get(workOrder.staff_id);
        if (staff) {
          commissionAmount = calculateCommission(workOrder.total_cost || 0, staff.commission_rate);
        }
      }
    }

    const result = db.prepare(`
      UPDATE work_orders 
      SET status = 'completed', completed_at = ?, notes = COALESCE(?, notes), total_cost = ?, commission_amount = ? 
      WHERE id = ?
    `).run(
      sanitized.completed_at || new Date().toISOString(),
      sanitized.notes || null,
      validatePositiveNumber(sanitized.total_cost, 0),
      commissionAmount,
      id
    );

    return { changes: result.changes, commission: commissionAmount };
  }));
}

module.exports = { registerStaffHandlers };