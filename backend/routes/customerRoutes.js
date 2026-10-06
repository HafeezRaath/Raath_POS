// ============================================================
//  server/routes/customerRoutes.js
// ============================================================

const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');

router.get('/', customerController.getCustomers);
router.get('/:id', customerController.getCustomerById);
router.get('/:id/ledger', customerController.getCustomerLedger);
router.post('/', customerController.createCustomer);
router.post('/:id/payment', customerController.addCustomerPayment);
router.put('/:id', customerController.updateCustomer);
router.delete('/:id', customerController.deleteCustomer);

module.exports = router;

