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
const warehouseRoutes = require('./warehouseRoutes');
const fbrRoutes = require('./fbrRoutes');
const userRoutes = require('./userRoutes');
const dashboardRoutes = require('./dashboardRoutes');

// API Health Check
router.get('/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'RAATH POS Backend',
    database: 'MySQL',
    timestamp: new Date().toISOString()
  });
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
router.use('/warehouses', warehouseRoutes);
router.use('/fbr', fbrRoutes);
router.use('/users', userRoutes);
router.use('/dashboard', dashboardRoutes);

module.exports = router;
