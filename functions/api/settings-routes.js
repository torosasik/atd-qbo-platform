'use strict';

const express = require('express');
const { getSettings, updateSettings } = require('../core/settings');
const { validateRequest, sendError, sendSuccess, schemas } = require('./middleware');
const { logActivity } = require('./activity-logger');

const router = express.Router();

// GET /settings
router.get('/', async (req, res, next) => {
  try {
    const settings = await getSettings();
    sendSuccess(res, { settings });
  } catch (err) {
    next(err);
  }
});

// PUT /settings
router.put('/', validateRequest(schemas.settingsUpdate), async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      const error = new Error('Request body must be a JSON object');
      error.status = 400;
      return next(error);
    }
    const updated = await updateSettings(req.body);
    await logActivity('SETTINGS_CHANGE', 'settings-update', 'Settings updated', { keys: Object.keys(req.body) });
    sendSuccess(res, { settings: updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;