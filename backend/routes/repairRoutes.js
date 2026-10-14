// backend/routes/repairRoutes.js — Repair job card endpoints
const express = require('express');
const router = express.Router();
const repairController = require('../controllers/repairController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

router.post('/upload-photo', repairController.uploadPhoto);
router.post('/', repairController.createJob);
router.get('/', repairController.listJobs);
router.get('/:id', repairController.getJob);
router.get('/:id/token', repairController.getToken);
router.put('/:id', repairController.updateJob);

module.exports = router;
