// ============================================================
//  server/routes/salesRoutes.js
// ============================================================

const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { optionalAuth } = require('../middleware/auth');

router.get('/items', salesController.getAllSaleItems);
router.get('/', salesController.getSales);
router.get('/:id', salesController.getSaleById);
router.post('/', optionalAuth, salesController.createSale);
router.post('/return', salesController.returnSale);
router.put('/:id', salesController.updateSale);
router.delete('/:id', salesController.deleteSale);

module.exports = router;

