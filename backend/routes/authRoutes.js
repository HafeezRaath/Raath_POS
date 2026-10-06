// ============================================================
//  backend/routes/authRoutes.js
// ============================================================

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

router.post('/login', authController.login);
router.post('/register', authController.register);
router.get('/me', requireAuth, authController.getMe);
router.get('/roles', authController.getRoles);

module.exports = router;
