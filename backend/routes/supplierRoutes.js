// ============================================================
//  server/routes/supplierRoutes.js
// ============================================================

const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');

router.get('/', supplierController.getSuppliers);
router.get('/:id', supplierController.getSupplierById);
router.get('/:id/ledger', supplierController.getSupplierLedger);
router.post('/', supplierController.createSupplier);
router.post('/:id/payment', supplierController.addSupplierPayment);
router.put('/:id', supplierController.updateSupplier);
router.delete('/:id', supplierController.deleteSupplier);

module.exports = router;

