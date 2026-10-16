// ============================================================
//  backend/routes/api.js - Master API Route Aggregator
// ============================================================

const express = require('express');
const router = express.Router();

const { optionalAuth } = require('../middleware/auth');
const { resolveTenant } = require('../middleware/tenant');
const { rewriteQueryForTenant } = require('../utils/sqlTenantRewriter');
const { query } = require('../config/db');

const authRoutes = require('./authRoutes');
const productRoutes = require('./productRoutes');
const categoryRoutes = require('./categoryRoutes');
const brandRoutes = require('./brandRoutes');
const salesRoutes = require('./salesRoutes');
const purchaseRoutes = require('./purchaseRoutes');
const customerRoutes = require('./customerRoutes');
const supplierRoutes = require('./supplierRoutes');
const accountRoutes = require('./accountRoutes');
const expenseRoutes = require('./expenseRoutes');
const emiRoutes = require('./emiRoutes');
const salesmanRoutes = require('./salesmanRoutes');
const distributorRoutes = require('./distributorRoutes');
const serviceRoutes = require('./serviceRoutes');
const returnRoutes = require('./returnRoutes');
const reportRoutes = require('./reportRoutes');
const settingRoutes = require('./settingRoutes');
const offerRoutes = require('./offerRoutes');
const bundleRoutes = require('./bundleRoutes');
const warehouseRoutes = require('./warehouseRoutes');
const fbrRoutes = require('./fbrRoutes');
const userRoutes = require('./userRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const auditRoutes = require('./auditRoutes');
const imeiRoutes = require('./imeiRoutes');
const repairRoutes = require('./repairRoutes');
const payrollRoutes = require('./payrollRoutes');
const creditNoteRoutes = require('./creditNoteRoutes');

// API Health Check
router.get('/health', async (req, res) => {
  const out = {
    status: 'online',
    system: 'RAATH POS Backend',
    database: 'MySQL',
    timestamp: new Date().toISOString()
  };
  // v60 temporary diagnostics: IMEI tenant visibility (no auth needed)
  try {
    const byTenant = await query(`SELECT tenant_id, status, COUNT(*) AS c FROM device_imei GROUP BY tenant_id, status`);
    const probes = await query(`SELECT id, imei1, status, tenant_id FROM device_imei WHERE imei1 IN ('356938035643809','356938035643805')`);
    // v61: simulate the EXACT lookup + picker queries with tenant_default
    let simLookup = null, simLookupErr = null;
    try {
      const r = await query(`SELECT id FROM device_imei WHERE tenant_id = ? AND (imei1 = ? OR imei2 = ?) AND is_deleted = 0 LIMIT 1`, ['tenant_default', '356938035643809', '356938035643809']);
      simLookup = { found: r.length, ids: r.map(x => x.id) };
    } catch (e) { simLookupErr = e.message; }
    let simPicker = null, simPickerErr = null;
    try {
      const r = await query(`SELECT id, imei1 FROM device_imei WHERE tenant_id = ? AND status = 'IN_STOCK' AND is_deleted = 0 ORDER BY id DESC LIMIT 100`, ['tenant_default']);
      simPicker = { found: r.length, imeis: r.map(x => x.imei1) };
    } catch (e) { simPickerErr = e.message; }
    out.debug_imei = { by_tenant: byTenant, probes, sim_lookup: simLookup, sim_lookup_err: simLookupErr, sim_picker: simPicker, sim_picker_err: simPickerErr, build: 'v61' };
  } catch (e) {
    out.debug_imei = { error: e.message, build: 'v61' };
  }
  res.json(out);
});

// Global Tenant & Auth resolution for all API endpoints
router.use(optionalAuth);
router.use(resolveTenant);

// Dynamic SQL Query Bridge (used by Dashboard, StockTracking, reports)
router.post('/query', async (req, res, next) => {
  try {
    const { sql, params = [] } = req.body;
    if (!sql || typeof sql !== 'string') {
      return res.status(400).json({ success: false, error: 'SQL query required' });
    }

    const tenantId = req.tenant_id || 'tenant_default';
    const { sql: finalSql, params: finalParams } = rewriteQueryForTenant(sql, params, tenantId);

    const rows = await query(finalSql, finalParams);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('[API Query Error]:', error.message);
    res.status(500).json({ success: false, error: error.message, data: [] });
  }
});

// Database maintenance: OPTIMIZE TABLE on all tables (safe defragmentation)
router.post('/database/optimize', async (req, res) => {
  try {
    const tables = await query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`);
    let optimized = 0;
    for (const t of tables) {
      const name = t.TABLE_NAME || t.table_name;
      if (name) {
        await query(`OPTIMIZE TABLE \`${name}\``);
        optimized++;
      }
    }
    res.json({ success: true, message: `Database optimized! ${optimized} tables processed.`, tables: optimized });
  } catch (error) {
    console.error('[DB Optimize Error]:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Database maintenance: purge soft-deleted records older than 90 days
router.post('/database/purge', async (req, res) => {
  try {
    const tenantId = req.tenant_id || 'tenant_default';
    // Only purge records explicitly marked deleted AND old (safety: 90+ days)
    const tables = ['sales', 'purchases', 'expenses', 'customers', 'suppliers', 'products'];
    let purged = 0;
    for (const tbl of tables) {
      try {
        // Check if table has is_deleted column
        const cols = await query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'is_deleted'`, [tbl]);
        if (cols.length > 0) {
          const result = await query(`DELETE FROM \`${tbl}\` WHERE is_deleted = 1 AND (deleted_at < DATE_SUB(NOW(), INTERVAL 90 DAY) OR updated_at < DATE_SUB(NOW(), INTERVAL 90 DAY))`);
          purged += result.affectedRows || 0;
        }
      } catch (e) { /* table may not exist, skip */ }
    }
    res.json({ success: true, message: `Purged ${purged} old deleted records.`, purged });
  } catch (error) {
    console.error('[DB Purge Error]:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mounted Endpoints
router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/brands', brandRoutes);
router.use('/sales', salesRoutes);
router.use('/purchases', purchaseRoutes);
router.use('/customers', customerRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/accounts', accountRoutes);
router.use('/expenses', expenseRoutes);
router.use('/emi', emiRoutes);
router.use('/salesmen', salesmanRoutes);
router.use('/distributors', distributorRoutes);
router.use('/services', serviceRoutes);
router.use('/returns', returnRoutes);
router.use('/reports', reportRoutes);
router.use('/settings', settingRoutes);
router.use('/offers', offerRoutes);
router.use('/bundles', bundleRoutes);
router.use('/warehouses', warehouseRoutes);
router.use('/fbr', fbrRoutes);
router.use('/users', userRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/imei', imeiRoutes);
router.use('/repairs', repairRoutes);
router.use('/payroll', payrollRoutes);
router.use('/credit-notes', creditNoteRoutes);

// Temporary diagnostics (v59): tenant + IMEI visibility debugging
const { verifyToken } = require('../middleware/auth');
router.get('/debug/whoami', verifyToken, (req, res) => {
  res.json({ success: true, data: {
    tenant_id: req.tenant_id || 'tenant_default',
    user_id: req.user?.id || null,
    username: req.user?.username || null,
  }});
});
router.get('/debug/imei-tenants', verifyToken, async (req, res, next) => {
  try {
    const rows = await query(`SELECT tenant_id, status, COUNT(*) AS c FROM device_imei GROUP BY tenant_id, status`);
    const mine = await query(`SELECT id, imei1, status, tenant_id FROM device_imei WHERE imei1 IN ('356938035643809','356938035643805')`);
    res.json({ success: true, data: { by_tenant: rows, probes: mine, my_tenant: req.tenant_id || 'tenant_default' } });
  } catch (e) { next(e); }
});

module.exports = router;
