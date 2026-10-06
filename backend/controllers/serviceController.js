// ============================================================
//  backend/controllers/serviceController.js - Multi-Tenant Scoped
// ============================================================

const { query } = require('../config/db');

// --- Services ---
exports.getServices = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const rows = await query(`SELECT * FROM services WHERE tenant_id = ? AND is_deleted = 0 ORDER BY id DESC`, [tenantId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.createService = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { name, description = '', base_price = 0, estimated_time = '', status = 'active' } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Service name is required' });

    const result = await query(
      `INSERT INTO services (tenant_id, name, description, base_price, estimated_time, status) VALUES (?, ?, ?, ?, ?, ?)`,
      [tenantId, name, description, base_price, estimated_time, status]
    );
    res.status(201).json({ success: true, message: 'Service created', data: { id: result.insertId, ...req.body } });
  } catch (error) {
    next(error);
  }
};

exports.updateService = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const { name, description, base_price, estimated_time, status } = req.body;
    await query(
      `UPDATE services SET
         name = COALESCE(?, name),
         description = COALESCE(?, description),
         base_price = COALESCE(?, base_price),
         estimated_time = COALESCE(?, estimated_time),
         status = COALESCE(?, status)
       WHERE tenant_id = ? AND id = ? AND is_deleted = 0`,
      [name, description, base_price, estimated_time, status, tenantId, id]
    );
    res.json({ success: true, message: 'Service updated' });
  } catch (error) {
    next(error);
  }
};

exports.deleteService = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    await query(`UPDATE services SET is_deleted = 1, deleted_at = NOW() WHERE tenant_id = ? AND id = ?`, [tenantId, id]);
    res.json({ success: true, message: 'Service deleted' });
  } catch (error) {
    next(error);
  }
};

// --- Staff ---
exports.getStaff = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const rows = await query(`SELECT * FROM staff WHERE tenant_id = ? AND is_deleted = 0 ORDER BY id DESC`, [tenantId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.createStaff = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { name, phone = '', role = 'technician', commission_rate = 0, base_salary = 0, status = 'active' } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Staff name is required' });

    const result = await query(
      `INSERT INTO staff (tenant_id, name, phone, role, commission_rate, base_salary, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, name, phone, role, commission_rate, base_salary, status]
    );
    res.status(201).json({ success: true, message: 'Staff member added', data: { id: result.insertId, ...req.body } });
  } catch (error) {
    next(error);
  }
};

exports.updateStaff = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const { name, phone, role, commission_rate, base_salary, status } = req.body;
    await query(
      `UPDATE staff SET
         name = COALESCE(?, name),
         phone = COALESCE(?, phone),
         role = COALESCE(?, role),
         commission_rate = COALESCE(?, commission_rate),
         base_salary = COALESCE(?, base_salary),
         status = COALESCE(?, status)
       WHERE tenant_id = ? AND id = ? AND is_deleted = 0`,
      [name, phone, role, commission_rate, base_salary, status, tenantId, id]
    );
    res.json({ success: true, message: 'Staff updated' });
  } catch (error) {
    next(error);
  }
};

exports.deleteStaff = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    await query(`UPDATE staff SET is_deleted = 1, deleted_at = NOW() WHERE tenant_id = ? AND id = ?`, [tenantId, id]);
    res.json({ success: true, message: 'Staff member deleted' });
  } catch (error) {
    next(error);
  }
};

// --- Work Orders ---
exports.getWorkOrders = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { status, staff_id, customer_id } = req.query;
    let sql = `
      SELECT wo.*, s.name AS service_name, st.name AS staff_name, c.name AS cust_name, c.phone AS cust_phone
      FROM work_orders wo
      LEFT JOIN services s ON wo.service_id = s.id
      LEFT JOIN staff st ON wo.staff_id = st.id
      LEFT JOIN customers c ON wo.customer_id = c.id
      WHERE wo.tenant_id = ? AND wo.is_deleted = 0
    `;
    const params = [tenantId];
    if (status) { sql += ` AND wo.status = ?`; params.push(status); }
    if (staff_id) { sql += ` AND wo.staff_id = ?`; params.push(staff_id); }
    if (customer_id) { sql += ` AND wo.customer_id = ?`; params.push(customer_id); }
    sql += ` ORDER BY wo.id DESC`;

    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.createWorkOrder = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const {
      service_id, staff_id, customer_id, customer_name = '', machine_name = '',
      device_model = '', imei = '', problem_description = '', notes = '',
      total_cost = 0, paid_amount = 0, payment_status = 'unpaid', payment_mode = 'cash',
      commission_amount = 0
    } = req.body;

    const orderNumber = 'WO-' + Date.now();

    const result = await query(
      `INSERT INTO work_orders 
       (tenant_id, order_number, service_id, staff_id, customer_id, customer_name, machine_name, device_model, imei, problem_description, notes, total_cost, total_amount, paid_amount, payment_status, payment_mode, commission_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [tenantId, orderNumber, service_id || null, staff_id || null, customer_id || null, customer_name, machine_name, device_model, imei, problem_description, notes, total_cost, total_cost, paid_amount, payment_status, payment_mode, commission_amount]
    );

    res.status(201).json({ success: true, message: 'Work order created', data: { id: result.insertId, order_number: orderNumber } });
  } catch (error) {
    next(error);
  }
};

exports.updateWorkOrder = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const { status, paid_amount, payment_status, notes, parts_used, completed_at } = req.body;
    await query(
      `UPDATE work_orders SET
         status = COALESCE(?, status),
         paid_amount = COALESCE(?, paid_amount),
         payment_status = COALESCE(?, payment_status),
         notes = COALESCE(?, notes),
         parts_used = COALESCE(?, parts_used),
         completed_at = COALESCE(?, completed_at)
       WHERE tenant_id = ? AND id = ? AND is_deleted = 0`,
      [status, paid_amount, payment_status, notes, parts_used, completed_at, tenantId, id]
    );
    res.json({ success: true, message: 'Work order updated' });
  } catch (error) {
    next(error);
  }
};

exports.deleteWorkOrder = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    await query(`UPDATE work_orders SET is_deleted = 1, deleted_at = NOW() WHERE tenant_id = ? AND id = ?`, [tenantId, id]);
    res.json({ success: true, message: 'Work order deleted' });
  } catch (error) {
    next(error);
  }
};
