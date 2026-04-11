'use strict';

const express = require('express');
const Joi = require('joi');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { handleCreate: handleBillCreate, handleApproveDraft: handleBillApproveDraft } = require('../modules/bill/index');
const { ensureValidToken } = require('../core/qbo-auth');
const { logAction } = require('../core/logger');
const { validateRequest, sendError, sendSuccess, retryOperation, schemas } = require('./middleware');

const router = express.Router();

// POST /bills
router.post('/', validateRequest(schemas.billCreate), async (req, res, next) => {
  try {
    await ensureValidToken();
    await retryOperation(() => handleBillCreate(req, res), 3, 1000);
  } catch (err) {
    next(err);
  }
});

// POST /bills/drafts/:draftId/approve
router.post('/drafts/:draftId/approve', async (req, res, next) => {
  try {
    await ensureValidToken();
    await retryOperation(() => handleBillApproveDraft(req, res), 3, 1000);
  } catch (err) {
    next(err);
  }
});

// GET /bills/drafts
router.get('/drafts', async (req, res, next) => {
  try {
    const db = getFirestore();
    const snapshot = await db
      .collection('bill_drafts')
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

// GET /bills
router.get('/', async (req, res, next) => {
  try {
    const db = getFirestore();
    const snapshot = await db
      .collection('logs')
      .where('module', '==', 'bill')
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
        qboEntityId: details.entityId || null,
        intuitTid: details.intuitTid || null,
        billNumber: details.billNumber || null,
        total: details.total || null,
        errorMessage: details.errorMessage || null,
      };
    });

    sendSuccess(res, { history });
  } catch (err) {
    next(err);
  }
});

// POST /bills/drafts/:draftId/reject
router.post('/drafts/:draftId/reject', async (req, res, next) => {
  try {
    const { draftId } = req.params;
    const db = getFirestore();
    const draftRef = db.collection('bill_drafts').doc(draftId);
    const draftSnap = await draftRef.get();

    if (!draftSnap.exists) {
      const error = new Error(`Draft '${draftId}' not found`);
      error.status = 404;
      return next(error);
    }

    const draft = draftSnap.data();
    if (draft.status !== 'pending') {
      const error = new Error('Draft has already been processed and cannot be rejected');
      error.status = 409;
      return next(error);
    }

    await draftRef.update({
      status: 'rejected',
      rejectedAt: FieldValue.serverTimestamp(),
    });

    await logAction('bill', 'reject-draft', 'success', { draftId });

    sendSuccess(res, null, 'Draft rejected.');
  } catch (err) {
    await logAction('bill', 'reject-draft', 'error', { errorMessage: err.message });
    next(err);
  }
});

// POST /bills/bulk-create (new bulk endpoint)
router.post('/bulk-create', validateRequest(schemas.bulkBills), async (req, res, next) => {
  try {
    await ensureValidToken();
    const { bills } = req.body;
    const results = [];
    const errors = [];

    for (let i = 0; i < bills.length; i++) {
      try {
        const billReq = {
          ...req,
          body: bills[i],
        };
        const result = await retryOperation(() => handleBillCreate(billReq, res), 3, 1000);
        results.push({ index: i, success: true, result });
      } catch (err) {
        errors.push({ index: i, error: err.message });
      }
    }

    sendSuccess(res, { results, errors, total: bills.length });
  } catch (err) {
    next(err);
  }
});

module.exports = router;