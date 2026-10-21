// ============================================================
//  server/routes/unitRoutes.js
// ============================================================

const express = require('express');
const router = express.Router();
const unitController = require('../controllers/unitController');

router.get('/', unitController.getUnits);
router.post('/', unitController.createUnit);
router.delete('/:id', unitController.deleteUnit);

module.exports = router;
