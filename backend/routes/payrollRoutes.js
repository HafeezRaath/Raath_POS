// backend/routes/payrollRoutes.js — Staff payroll endpoints
const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payrollController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

router.get('/labor-summary', payrollController.laborSummary);
router.post('/generate', payrollController.generatePayroll);
router.get('/', payrollController.listPayroll);
router.put('/:id/pay', payrollController.paySlip);

module.exports = router;
