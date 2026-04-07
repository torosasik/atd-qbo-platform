'use strict';

const admin = require('firebase-admin');
admin.initializeApp();

const functions = require('firebase-functions');
const express = require('express');
const router = require('./api/routes');
const { logAction } = require('./core/logger');

// ---------------------------------------------------------------------------
// Error codes and human-readable fix suggestions.
// Routes can throw errors with err.code = 'QBO_AUTH_EXPIRED' etc. and the
// global handler will attach the matching fix suggestion to the response.
// ---------------------------------------------------------------------------
const ERROR_CODES = {
  QBO_AUTH_EXPIRED:      'Your QuickBooks token has expired. Go to QBO Connect and click Refresh Token.',
  QBO_NOT_CONNECTED:     'QuickBooks is not connected. Go to QBO Connect and click Connect to QuickBooks.',
  QBO_API_ERROR:         'QuickBooks API returned an error. Check the error details and try again.',
  SHEETS_NOT_CONFIGURED: 'Google Sheet ID is not set. Go to Settings and enter your Sheet ID.',
  SHEETS_ACCESS_DENIED:  'Cannot access the Google Sheet. Make sure the sheet is shared with the Firebase service account.',
  AI_UNAVAILABLE:        'Both Ollama and Claude API are unavailable. Check that Ollama is running or the Claude API key is set.',
  FIRESTORE_ERROR:       'Database error. Check your Firebase project configuration.',
  VALIDATION_ERROR:      'Invalid input data. Check the required fields and try again.',
  UNKNOWN_ERROR:         'An unexpected error occurred. Check the system logs for details.',
};

const app = express();
app.use(express.json());
app.use('/api', router);

// ---------------------------------------------------------------------------
// Global error handler
// Catches any unhandled error thrown (or passed via next(err)) in a route,
// logs it to Firestore, and returns a consistent JSON error shape.
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use(async (err, req, res, next) => {
  const code = err.code && ERROR_CODES[err.code] ? err.code : 'UNKNOWN_ERROR';
  const fix = ERROR_CODES[code];
  const message = err.message || 'An unexpected error occurred.';

  try {
    await logAction('system', 'unhandled-error', 'error', {
      code,
      message,
      path: req.path,
      method: req.method,
    });
  } catch (_logErr) {
    // Never let a logging failure suppress the real error response.
  }

  res.status(err.status || 500).json({
    success: false,
    error: message,
    code,
    fix,
  });
});

exports.api = functions.https.onRequest(app);
