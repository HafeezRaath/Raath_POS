// backend/routes/imeiRoutes.js — Mobile shop IMEI endpoints
const express = require('express');
const router = express.Router();
const imeiController = require('../controllers/imeiController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

router.post('/bulk', imeiController.bulkAddImei);
router.get('/picker', imeiController.inStockPicker);
router.get('/lookup/:imei', imeiController.lookupImei);
router.get('/', imeiController.listImei);
router.post('/:id/sell', imeiController.sellImei);
router.post('/:id/buyback', imeiController.buybackImei);
router.post('/:id/return', imeiController.returnImei);
router.put('/:id', imeiController.updateImei);

module.exports = router;
