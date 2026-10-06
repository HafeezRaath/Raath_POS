// ============================================================
//  server/routes/productRoutes.js
// ============================================================

const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

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

