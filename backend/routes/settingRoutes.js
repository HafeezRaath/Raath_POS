// ============================================================
//  backend/routes/settingRoutes.js
// ============================================================

const express = require('express');
const router = express.Router();
const settingController = require('../controllers/settingController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

router.get('/', settingController.getSettings);
router.post('/', settingController.updateSettings);
router.get('/backup/export', settingController.exportBackup);

module.exports = router;
