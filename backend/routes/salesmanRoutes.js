// ============================================================
//  backend/routes/salesmanRoutes.js
// ============================================================

const express = require('express');
const router = express.Router();
const salesmanController = require('../controllers/salesmanController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

// CRUD
router.get('/', salesmanController.getSalesmen);
router.post('/', salesmanController.createSalesman);
router.get('/performance', salesmanController.getPerformance);
router.get('/:id', salesmanController.getSalesmanById);
router.put('/:id', salesmanController.updateSalesman);
router.delete('/:id', salesmanController.deleteSalesman);

// Sales
router.get('/sales/list', salesmanController.getSalesmanSales);
router.post('/sales/create', salesmanController.createSalesmanSale);

// Salaries
router.get('/salaries/list', salesmanController.getSalaryPayments);
router.post('/salaries/pay', salesmanController.createSalaryPayment);

// Advances
router.get('/advances/list', salesmanController.getAdvances);
router.post('/advances/give', salesmanController.createAdvance);

// Ledger
router.get('/:id/ledger', salesmanController.getSalesmanLedger);

module.exports = router;
