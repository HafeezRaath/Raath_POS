// ============================================================
//  backend/routes/returnRoutes.js
// ============================================================

const express = require('express');
const router = express.Router();
const returnController = require('../controllers/returnController');
const { optionalAuth } = require('../middleware/auth');

router.use(optionalAuth);

// Sale Returns
router.get('/sales', returnController.getSaleReturns);
router.post('/sales', returnController.createSaleReturn);
router.get('/sales/:id', returnController.getSaleReturnById);

// Purchase Returns
router.get('/purchases', returnController.getPurchaseReturns);
router.post('/purchases', returnController.createPurchaseReturn);

module.exports = router;
