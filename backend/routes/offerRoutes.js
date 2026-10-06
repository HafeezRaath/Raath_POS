// ============================================================
//  backend/routes/offerRoutes.js
// ============================================================

const express = require('express');
const router = express.Router();
const offerController = require('../controllers/offerController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

router.get('/', offerController.getOffers);
router.post('/', offerController.createOffer);
router.delete('/:id', offerController.deleteOffer);

router.get('/deals/list', offerController.getDeals);
router.post('/deals', offerController.createDeal);

module.exports = router;
