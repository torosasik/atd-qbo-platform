'use strict';

const express = require('express');
const Joi = require('joi');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { handleCreate: handleInvoiceCreate, handleApproveDraft: handleInvoiceApproveDraft } = require('../modules/invoice/index');
const { ensureValidToken } = require('../core/qbo-auth');
const { logAction } = require('../core/logger');
const { validateRequest, sendError, sendSuccess, retryOperation, schemas } = require('./middleware');

const router = express.Router();

// POST /invoices
router.post('/', validateRequest(schemas.invoiceCreate), async (req, res, next) => {
  try {
    await ensureValidToken();
    await retryOperation(() => handleInvoiceCreate(req, res), 3, 1000);
  } catch (err) {
    next(err);
  }
});

// POST /invoices/drafts/:draftId/approve
router.post('/drafts/:draftId/approve', async (req, res, next) => {
  try {
    await ensureValidToken();
    await retryOperation(() => handleInvoiceApproveDraft(req, res), 3, 1000);
  } catch (err) {
    next(err);
  }
});

// GET /invoices/drafts
router.get('/drafts', async (req, res, next) => {
  try {
    const db = getFirestore();
    const snapshot = await db
      .collection('invoice_drafts')
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

// GET /invoices
router.get('/', async (req, res, next) => {
  try {
    const db = getFirestore();
    const snapshot = await db
      .collection('logs')
      .where('module', '==', 'invoice')
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
        customerName: details.customerName || null,
        qboEntityId: details.entityId || null,
        intuitTid: details.intuitTid || null,
        invoiceNumber: details.invoiceNumber || null,
        total: details.total || null,
        errorMessage: details.errorMessage || null,
      };
    });

    sendSuccess(res, { history });
  } catch (err) {
    next(err);
  }
});

// POST /invoices/drafts/:draftId/reject
router.post('/drafts/:draftId/reject', async (req, res, next) => {
  try {
    const { draftId } = req.params;
    const db = getFirestore();
    const draftRef = db.collection('invoice_drafts').doc(draftId);
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

    await logAction('invoice', 'reject-draft', 'success', { draftId });

    sendSuccess(res, null, 'Draft rejected.');
  } catch (err) {
    await logAction('invoice', 'reject-draft', 'error', { errorMessage: err.message });
    next(err);
  }
});

// POST /invoices/bulk-create (new bulk endpoint)
router.post('/bulk-create', validateRequest(schemas.bulkInvoices), async (req, res, next) => {
  try {
    await ensureValidToken();
    const { invoices } = req.body;
    const results = [];
    const errors = [];

    for (let i = 0; i < invoices.length; i++) {
      try {
        const invoiceReq = {
          ...req,
          body: invoices[i],
        };
        const result = await retryOperation(() => handleInvoiceCreate(invoiceReq, res), 3, 1000);
        results.push({ index: i, success: true, result });
      } catch (err) {
        errors.push({ index: i, error: err.message });
      }
    }

    sendSuccess(res, { results, errors, total: invoices.length });
  } catch (err) {
    next(err);
  }
});

module.exports = router;