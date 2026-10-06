// ============================================================
//  backend/routes/serviceRoutes.js
// ============================================================

const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

// Services
router.get('/', serviceController.getServices);
router.post('/', serviceController.createService);
router.put('/:id', serviceController.updateService);
router.delete('/:id', serviceController.deleteService);

// Staff
router.get('/staff/list', serviceController.getStaff);
router.post('/staff', serviceController.createStaff);
router.put('/staff/:id', serviceController.updateStaff);
router.delete('/staff/:id', serviceController.deleteStaff);

// Work Orders
router.get('/orders/list', serviceController.getWorkOrders);
router.post('/orders', serviceController.createWorkOrder);
router.put('/orders/:id', serviceController.updateWorkOrder);
router.delete('/orders/:id', serviceController.deleteWorkOrder);

module.exports = router;
