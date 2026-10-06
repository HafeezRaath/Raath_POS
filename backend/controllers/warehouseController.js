// ============================================================
//  backend/controllers/warehouseController.js - Multi-Tenant Scoped
// ============================================================

const { query } = require('../config/db');

exports.getWarehouses = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const rows = await query(`SELECT * FROM warehouses WHERE tenant_id = ? AND is_deleted = 0 ORDER BY id DESC`, [tenantId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.createWarehouse = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { name, location = '', manager_name = '', phone = '' } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Warehouse name is required' });

    const result = await query(
      `INSERT INTO warehouses (tenant_id, name, location, manager_name, phone) VALUES (?, ?, ?, ?, ?)`,
      [tenantId, name, location, manager_name, phone]
    );
    res.status(201).json({ success: true, message: 'Warehouse created', data: { id: result.insertId, ...req.body } });
  } catch (error) {
    next(error);
  }
};

exports.updateWarehouse = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const { name, location, manager_name, phone } = req.body;
    await query(
      `UPDATE warehouses SET
         name = COALESCE(?, name),
         location = COALESCE(?, location),
         manager_name = COALESCE(?, manager_name),
         phone = COALESCE(?, phone)
       WHERE tenant_id = ? AND id = ? AND is_deleted = 0`,
      [name, location, manager_name, phone, tenantId, id]
    );
    res.json({ success: true, message: 'Warehouse updated' });
  } catch (error) {
    next(error);
  }
};

exports.deleteWarehouse = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    await query(`UPDATE warehouses SET is_deleted = 1 WHERE tenant_id = ? AND id = ?`, [tenantId, id]);
    res.json({ success: true, message: 'Warehouse deleted' });
  } catch (error) {
    next(error);
  }
};

exports.getWarehouseStocks = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const { id } = req.params;
    const rows = await query(
      `SELECT ws.*, p.name AS product_name, p.sku, p.barcode
       FROM warehouse_stocks ws
       JOIN products p ON ws.product_id = p.id
       WHERE ws.tenant_id = ? AND ws.warehouse_id = ?`,
      [tenantId, id]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};
