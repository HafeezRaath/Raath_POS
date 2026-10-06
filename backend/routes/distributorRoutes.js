// ============================================================
//  backend/routes/distributorRoutes.js
// ============================================================

const express = require('express');
const router = express.Router();
const distributorController = require('../controllers/distributorController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

// CRUD
router.get('/', distributorController.getDistributors);
router.post('/', distributorController.createDistributor);
router.get('/summary', distributorController.getSummary);
router.get('/:id', distributorController.getDistributorById);
router.put('/:id', distributorController.updateDistributor);
router.delete('/:id', distributorController.deleteDistributor);

// Orders
router.get('/orders/list', distributorController.getOrders);
router.post('/orders/create', distributorController.createOrder);

// Payments
router.get('/payments/list', distributorController.getPayments);
router.post('/payments/create', distributorController.createPayment);

// Ledger
router.get('/:id/ledger', distributorController.getDistributorLedger);

module.exports = router;
