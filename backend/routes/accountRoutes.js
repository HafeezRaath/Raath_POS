// ============================================================
//  server/routes/accountRoutes.js
// ============================================================

const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');

router.get('/', accountController.getAccounts);
router.get('/transactions', accountController.getTransactions);
router.post('/transactions', accountController.createTransaction);
router.post('/transfer', accountController.transferFunds);
router.get('/:id/transactions', accountController.getTransactions);
router.get('/:id', accountController.getAccountById);
router.post('/', accountController.createAccount);
router.put('/:id', accountController.updateAccount);
router.delete('/:id', accountController.deleteAccount);

module.exports = router;

