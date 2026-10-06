// ============================================================
//  backend/controllers/settingController.js - Multi-Tenant Scoped
// ============================================================

const { query } = require('../config/db');

exports.getSettings = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const rows = await query('SELECT * FROM system_settings WHERE tenant_id = ?', [tenantId]);
    const settings = {};
    rows.forEach(r => {
      let val = r.value;
      if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
        try { val = JSON.parse(val); } catch (_) {}
      }
      settings[r.key] = val;
    });
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      const valStr = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
      await query(
        `INSERT INTO system_settings (tenant_id, \`key\`, \`value\`) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`,
        [tenantId, key, valStr]
      );
    }
    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    next(error);
  }
};

exports.exportBackup = async (req, res, next) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    const tables = [
      'users', 'roles', 'brands', 'categories', 'products', 'product_variants',
      'customers', 'suppliers', 'accounts', 'sales', 'sale_items',
      'purchases', 'purchase_items', 'expenses', 'expense_categories',
      'emi_records', 'emi_payments', 'salesmen', 'distributors', 'services'
    ];

    const backup = {
      version: '2.0.0',
      tenantId,
      exportedAt: new Date().toISOString(),
      data: {}
    };

    for (const table of tables) {
      try {
        let rows;
        if (table === 'roles') {
          rows = await query('SELECT * FROM `roles`');
        } else {
          rows = await query(`SELECT * FROM \`${table}\` WHERE tenant_id = ?`, [tenantId]);
        }
        backup.data[table] = rows;
      } catch (e) {
        backup.data[table] = [];
      }
    }

    res.json({ success: true, backup });
  } catch (error) {
    next(error);
  }
};
