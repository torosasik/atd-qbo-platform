'use strict';

const express = require('express');
const { handleChatMessage } = require('../modules/ai-chat/index');
const { validateRequest, sendError, sendSuccess, schemas } = require('./middleware');

const router = express.Router();

// POST /ai/chat
router.post('/chat', validateRequest(schemas.aiChat), async (req, res, next) => {
  try {
    await handleChatMessage(req, res);
  } catch (err) {
    next(err);
  }
});

module.exports = router;