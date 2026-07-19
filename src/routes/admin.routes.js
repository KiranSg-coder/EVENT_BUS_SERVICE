// routes/admin.routes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
// const authMiddleware = require('../middleware/auth.middleware');

// GET /admin/dead-letter-queue
router.get('/dead-letter-queue',  adminController.getDeadLetterQueue);

// POST /admin/dead-letter-queue/:deadLetterId/retry
router.post('/dead-letter-queue/:deadLetterId/retry',  adminController.retryDeadLetter);

// POST /admin/dead-letter-queue/:deadLetterId/resolve
router.post('/dead-letter-queue/:deadLetterId/resolve',  adminController.resolveDeadLetter);

// POST /admin/event-replay
router.post('/event-replay',  adminController.replayEvents);

// DELETE /admin/events/cleanup
router.delete('/events/cleanup',  adminController.cleanupOldEvents);

module.exports = router;