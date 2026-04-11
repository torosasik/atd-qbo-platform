'use strict';

const express = require('express');
const { getFirestore } = require('firebase-admin/firestore');
const { handleFetchExpenses, handleCategorize, handleApproveDraft: handleExpenseApproveDraft, handleRejectDraft: handleExpenseRejectDraft } = require('../modules/expense/index');
const { getCachedAccounts, ensureValidToken } = require('../core/qbo-auth');
const { validateRequest, sendError, sendSuccess, retryOperation, schemas } = require('./middleware');

const router = express.Router();

// GET /expenses/uncategorized
router.get('/uncategorized', async (req, res, next) => {
  try {
    await ensureValidToken();
    await handleFetchExpenses(req, res);
  } catch (err) {
    next(err);
  }
});

// GET /expenses/drafts
router.get('/drafts', async (req, res, next) => {
  try {
    const db = getFirestore();
    const snapshot = await db
      .collection('expense_drafts')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const drafts = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    sendSuccess(res, { drafts });
  } catch (err) {
    next(err);
  }
});

// POST /expenses/categorize
router.post('/categorize', validateRequest(schemas.expenseCategorize), async (req, res, next) => {
  try {
    await ensureValidToken();
    await handleCategorize(req, res);
  } catch (err) {
    next(err);
  }
});

// POST /expenses/drafts/:id/approve
router.post('/drafts/:id/approve', async (req, res, next) => {
  try {
    await ensureValidToken();
    await handleExpenseApproveDraft(req, res);
  } catch (err) {
    next(err);
  }
});

// POST /expenses/drafts/:id/reject
router.post('/drafts/:id/reject', async (req, res, next) => {
  try {
    await handleExpenseRejectDraft(req, res);
  } catch (err) {
    next(err);
  }
});

// GET /expenses
router.get('/', async (req, res, next) => {
  try {
    const db = getFirestore();
    const snapshot = await db
      .collection('logs')
      .where('module', '==', 'expense')
      .where('action', '==', 'push-to-qbo')
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();

    const history = snapshot.docs.map((doc) => {
      const data = doc.data();
      const details = data.details || {};
      const timestampIso = data.timestamp
        ? (data.timestamp.toDate ? data.timestamp.toDate().toISOString() : new Date(data.timestamp._seconds * 1000).toISOString())
        : null;
      return {
        id: doc.id,
        status: data.status,
        timestamp: timestampIso,
        vendorName: details.vendorName || null,
        expenseId: details.expenseId || null,
        accountName: details.accountName || null,
        accountId: details.accountId || null,
        total: details.total || null,
        intuitTid: details.intuitTid || null,
        errorMessage: details.errorMessage || null,
      };
    });

    sendSuccess(res, { history });
  } catch (err) {
    next(err);
  }
});

module.exports = router;