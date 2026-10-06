// ============================================================
//  backend/routes/warehouseRoutes.js
// ============================================================

const express = require('express');
const router = express.Router();
const warehouseController = require('../controllers/warehouseController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

router.get('/', warehouseController.getWarehouses);
router.post('/', warehouseController.createWarehouse);
router.put('/:id', warehouseController.updateWarehouse);
router.delete('/:id', warehouseController.deleteWarehouse);
router.get('/:id/stocks', warehouseController.getWarehouseStocks);

module.exports = router;
