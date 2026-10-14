// backend/routes/creditNoteRoutes.js — Supplier credit note endpoints
const express = require('express');
const router = express.Router();
const creditNoteController = require('../controllers/creditNoteController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

router.post('/', creditNoteController.createCreditNote);
router.get('/', creditNoteController.listCreditNotes);
router.put('/:id/void', creditNoteController.voidCreditNote);

module.exports = router;
