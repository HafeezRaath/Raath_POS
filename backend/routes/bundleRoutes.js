const express = require('express');
const router = express.Router();
const bundleController = require('../controllers/bundleController');

router.get('/', bundleController.getBundles);
router.post('/', bundleController.createBundle);
router.put('/:id', bundleController.updateBundle);
router.delete('/:id', bundleController.deleteBundle);
router.post('/deduct', bundleController.deductBundleStock);

module.exports = router;
