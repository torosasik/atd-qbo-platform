'use strict';

const admin = require('firebase-admin');
admin.initializeApp();

const functions = require('firebase-functions');
const express = require('express');

// Import individual route modules
const poRoutes = require('./api/po-routes');
const invoiceRoutes = require('./api/invoice-routes');
const billRoutes = require('./api/bill-routes');
const paymentRoutes = require('./api/payment-routes');
const expenseRoutes = require('./api/expense-routes');
const aiRoutes = require('./api/ai-routes');
const cacheRoutes = require('./api/cache-routes');
const settingsRoutes = require('./api/settings-routes');
const sheetsRoutes = require('./api/sheets-routes');
const authRoutes = require('./api/auth-routes');
const vendorRoutes = require('./api/vendor-routes');
const healthRoutes = require('./api/health-routes');
const activityLogRoutes = require('./api/activity-log');

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

// Create API router to ensure consistent /api prefix matching Vite proxy, frontend calls, and Firebase rewrite
const apiRouter = express.Router();

apiRouter.use('/po', poRoutes);
apiRouter.use('/invoices', invoiceRoutes);
apiRouter.use('/bills', billRoutes);
apiRouter.use('/payments', paymentRoutes);
apiRouter.use('/expenses', expenseRoutes);
apiRouter.use('/ai', aiRoutes);
apiRouter.use('/', cacheRoutes); // customers, vendors, items, accounts, open-invoices
apiRouter.use('/', settingsRoutes); // settings
apiRouter.use('/', sheetsRoutes); // sheets/test-connection, sheets/preview, sheets/import
apiRouter.use('/auth', authRoutes);
apiRouter.use('/vendor', vendorRoutes);
apiRouter.use('/', healthRoutes); // health
apiRouter.use('/activity-log', activityLogRoutes);

app.use('/api', apiRouter);

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
