// ============================================================
//  backend/routes/emiRoutes.js
// ============================================================

const express = require('express');
const router = express.Router();
const emiController = require('../controllers/emiController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

router.get('/', emiController.getEMIs);
router.post('/', emiController.createEMI);
router.get('/overdue', emiController.getOverdueEMIs);
router.get('/:id', emiController.getEMIById);
router.delete('/:id', emiController.deleteEMI);
router.post('/:id/pay', emiController.payInstallment);

module.exports = router;
