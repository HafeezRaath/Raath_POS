// ============================================================
//  server/routes/purchaseRoutes.js
// ============================================================

const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');

// Purchase Orders Routes (Must precede /:id)
router.get('/orders', purchaseController.getPurchaseOrders);
router.get('/orders/:id', purchaseController.getPurchaseOrderById);
router.post('/orders', purchaseController.createPurchaseOrder);
router.put('/orders/:id', purchaseController.updatePurchaseOrder);
router.delete('/orders/:id', purchaseController.deletePurchaseOrder);
router.post('/orders/:id/convert', purchaseController.convertPOToPurchase);

router.get('/items', purchaseController.getAllPurchaseItems);
router.get('/', purchaseController.getPurchases);
router.get('/:id', purchaseController.getPurchaseById);
router.post('/', purchaseController.createPurchase);
router.put('/:id', purchaseController.updatePurchase);
router.delete('/:id', purchaseController.deletePurchase);

module.exports = router;

