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
const orderStatusRoutes = require('./api/order-status-routes');
const rulesRoutes = require('./api/rules');
const orderFulfillmentRoutes = require('./api/order-fulfillment-routes');
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

const middleware = require('./api/middleware');

// CORS must be applied at the top level for direct Cloud Function calls (the /api/auth/connect from QBOConnect.jsx)
app.use((req, res, next) => middleware.cors(req, res, next)); // explicit wrapper to ensure middleware function (historical fix for TypeError)

// Create API router to ensure consistent /api prefix matching Vite proxy, frontend calls, and Firebase rewrite
const apiRouter = express.Router();

// Specific routes first (order matters - /auth must precede catch-all '/' routes)
apiRouter.use('/auth', authRoutes);
apiRouter.use('/qbo', authRoutes); // /qbo/company-info for test connection button
apiRouter.use('/po', poRoutes);
apiRouter.use('/invoices', invoiceRoutes);
apiRouter.use('/bills', billRoutes);
apiRouter.use('/payments', paymentRoutes);
apiRouter.use('/expenses', expenseRoutes);
apiRouter.use('/ai', aiRoutes);
apiRouter.use('/vendor', vendorRoutes); // /vendor/mappings, /vendor/mappings/sync // /vendor-mappings
apiRouter.use('/health', healthRoutes); // health
apiRouter.use('/activity-log', activityLogRoutes);
apiRouter.use('/order-statuses', orderStatusRoutes);
apiRouter.use('/rules', rulesRoutes);
apiRouter.use('/order-fulfillment', orderFulfillmentRoutes);
// Catch-all routes last (these were intercepting /auth/* before)
apiRouter.use('/', cacheRoutes); // customers, vendors, items, accounts, open-invoices, /items/create
apiRouter.use('/settings', settingsRoutes); // settings
apiRouter.use('/sheets', sheetsRoutes); // sheets/test-connection, sheets/preview, sheets/import

// DEBUG: Add catch-all for /test to prevent 404 on simple test probes (common in debug/health checks)
apiRouter.use('/test', (req, res) => {
  console.log('[DEBUG-INDEX] /test endpoint hit - returning success for probe');
  res.json({ success: true, message: 'Test endpoint OK', timestamp: new Date().toISOString() });
});

// Mount apiRouter twice:
// 1) For Firebase Hosting domain requests (path preserved as /api/...)
app.use('/api', apiRouter);
// 2) For direct Cloud Function URL requests (function name stripped, path is /auth/... etc.)
app.use(apiRouter);

// 404 handler - must come before global error handler to return JSON instead of HTML
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    path: req.path,
    fix: 'Check the API route or contact support.'
  });
});

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
// force redeploy 1775970374
// redeploy trigger - oauth redirect_uri and health route fixed 1775970916
// redeploy trigger - fixed health route mounting 1775971611
// redeploy trigger - health route now uses /health in router 1775971719
// redeploy trigger - fixed /auth route order before catch-all '/' (404 on /auth/connect) 1775972608
// redeploy trigger - reordered routes so /auth comes BEFORE all catch-all '/' middleware (fixes 404 on /auth/connect) 1775972741
// redeploy trigger - added top-level CORS middleware for direct CF calls to /api/auth/connect from QBOConnect.jsx 1775972841
// redeploy trigger - fixed require for middleware.cors (was causing deployment error) 1775972863
// redeploy trigger - fixed middleware destructuring for cors (TypeError on app.use) 1775972889
// redeploy trigger - fixed middleware require to use full object (cors is not default export) 1775972915
// redeploy trigger - wrapped middleware.cors in arrow function to satisfy app.use() expectation 1775972938
// redeploy trigger - reverted to direct middleware.cors (previous wrapper caused 500) 1775973045
// redeploy trigger - switched to destructuring { cors } from middleware (final fix for app.use) 1775973072
// redeploy trigger - reverted to full middleware require (destructuring caused persistent TypeError) 1775973094
// redeploy trigger - wrapped cors in explicit middleware function to fix app.use TypeError 1775973117
// redeploy trigger - final middleware.cors fix (reverted wrapper) 1775973690
// redeploy trigger - exported cors from middleware to fix TypeError on /api/auth/connect
// redeploy trigger - dual mount apiRouter for direct CF URL + hosting domain (fixes 404 on direct CF /auth/connect) 1775930824
