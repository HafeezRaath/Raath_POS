// ============================================================
//  server/routes/productRoutes.js
// ============================================================

const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const batchController = require('../controllers/batchController');

// Batches: batch-wise pricing + expiry (Grocery / Pharmacy)
router.get('/batches/expiry-alerts', batchController.expiryAlerts);
router.get('/:id/batches', batchController.listBatches);
router.post('/:id/batches', batchController.addBatch);
router.put('/batches/:id', batchController.updateBatch);
router.post('/batches/:id/vendor-return', batchController.vendorReturn);

router.get('/variants', productController.getAllVariants);
router.post('/variants', productController.createVariant);
router.put('/variants/:id', productController.updateVariant);
router.delete('/variants/:id', productController.deleteVariant);
router.get('/low-stock', productController.getLowStock);
router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);
router.post('/', productController.createProduct);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

module.exports = router;

