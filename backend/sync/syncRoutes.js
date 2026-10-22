// ============================================================
//  backend/sync/syncRoutes.js - Sync API Routes
// ============================================================

const express = require('express');
const router = express.Router();
const syncServer = require('./syncServer');
const { getSyncStatus, triggerSyncNow } = require('./syncClient');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { resolveTenant } = require('../middleware/tenant');

// Status endpoint is public/lightweight for navbar badge to poll
router.get('/status', optionalAuth, resolveTenant, (req, res) => {
  res.json(getSyncStatus());
});

// Trigger manual sync
router.post('/trigger', optionalAuth, resolveTenant, async (req, res) => {
  triggerSyncNow().catch(() => {});
  res.json({ success: true, message: 'Sync cycle initiated' });
});

// Sync push and pull require authentication + tenant resolution
router.post('/push', requireAuth, resolveTenant, syncServer.push);
router.get('/pull', requireAuth, resolveTenant, syncServer.pull);

module.exports = router;
