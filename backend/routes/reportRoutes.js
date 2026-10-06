// ============================================================
//  backend/routes/reportRoutes.js
// ============================================================

const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

router.get('/dashboard', reportController.getDashboardStats);
router.get('/sales', reportController.getSalesReport);
router.get('/profit-loss', reportController.getProfitLoss);
router.get('/stock', reportController.getStockReport);
router.get('/customer-dues', reportController.getCustomerDues);
router.get('/supplier-dues', reportController.getSupplierDues);

module.exports = router;
