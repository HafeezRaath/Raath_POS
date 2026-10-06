// ============================================================
//  backend/routes/fbrRoutes.js
// ============================================================

const express = require('express');
const router = express.Router();
const fbrController = require('../controllers/fbrController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

router.get('/invoices', fbrController.getInvoices);
router.post('/submit/:sale_id', fbrController.submitToFBR);

module.exports = router;
