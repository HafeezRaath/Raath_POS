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
// Advanced EMI / BNPL engine
router.post('/advanced', emiController.createAdvancedEMI);
router.get('/collection-dashboard', emiController.collectionDashboard);
router.get('/guarantors', emiController.getGuarantors);
router.post('/guarantors', emiController.createGuarantor);
router.post('/:id/early-settlement', emiController.earlySettlement);
router.get('/:id', emiController.getEMIById);
router.delete('/:id', emiController.deleteEMI);
router.post('/:id/pay', emiController.payInstallment);

module.exports = router;
