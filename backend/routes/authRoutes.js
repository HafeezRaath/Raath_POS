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
router.post('/roles', authController.createRole);
router.put('/roles/:id', authController.updateRole);
router.delete('/roles/:id', authController.deleteRole);

module.exports = router;
