// ============================================================
//  server/routes/purchaseRoutes.js
// ============================================================

const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');

router.get('/items', purchaseController.getAllPurchaseItems);
router.get('/', purchaseController.getPurchases);
router.get('/:id', purchaseController.getPurchaseById);
router.post('/', purchaseController.createPurchase);
router.put('/:id', purchaseController.updatePurchase);
router.delete('/:id', purchaseController.deletePurchase);

module.exports = router;

