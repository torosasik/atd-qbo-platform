'use strict';

const express = require('express');
const Joi = require('joi');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { handleCreate, handleApproveDraft } = require('../modules/purchase-order/index');
const { ensureValidToken } = require('../core/qbo-auth');
const { logAction } = require('../core/logger');
const { logActivity } = require('./activity-logger');
const { validateRequest, sendError, sendSuccess, retryOperation, schemas } = require('./middleware');

const router = express.Router();

// POST /po/create
router.post('/create', validateRequest(schemas.poCreate), async (req, res, next) => {
  try {
    await ensureValidToken();
    await logActivity('PO_CREATED', 'po-create', `PO create requested for vendor: ${req.body.vendorName || 'unknown'}`, { vendorName: req.body.vendorName });
    await retryOperation(() => handleCreate(req, res), 3, 1000);
  } catch (err) {
    next(err);
  }
});

// POST /po/approve/:draftId
router.post('/approve/:draftId', async (req, res, next) => {
  try {
    await ensureValidToken();
    await logActivity('PO_UPDATED', 'po-approve', `PO draft approved: ${req.params.draftId}`, { draftId: req.params.draftId });
    await retryOperation(() => handleApproveDraft(req, res), 3, 1000);
  } catch (err) {
    next(err);
  }
});

// GET /po/drafts
router.get('/drafts', async (req, res, next) => {
  try {
    const db = getFirestore();
    const snapshot = await db
      .collection('po_drafts')
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

// GET /po/history
router.get('/history', async (req, res, next) => {
  try {
    const db = getFirestore();
    const snapshot = await db
      .collection('logs')
      .where('module', '==', 'purchase-order')
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
        poNumber: details.poNumber || null,
        total: details.total || null,
        errorMessage: details.errorMessage || null,
      };
    });

    sendSuccess(res, { history });
  } catch (err) {
    next(err);
  }
});

// POST /po/drafts/:draftId/reject
router.post('/drafts/:draftId/reject', async (req, res, next) => {
  try {
    const { draftId } = req.params;
    const db = getFirestore();
    const draftRef = db.collection('po_drafts').doc(draftId);
    const draftSnap = await draftRef.get();

    if (!draftSnap.exists) {
      const error = new Error(`Draft '${draftId}' not found`);
      error.status = 404;
      return next(error);
    }

    const draft = draftSnap.data();
    if (draft.status !== 'pending') {
      const error = new Error('Draft has already been processed and cannot be deleted');
      error.status = 409;
      return next(error);
    }

    await draftRef.update({
      status: 'rejected',
      rejectedAt: FieldValue.serverTimestamp(),
    });

    await logAction('purchase-order', 'reject-draft', 'success', { draftId });

    sendSuccess(res, null, 'Draft rejected and deleted.');
  } catch (err) {
    await logAction('purchase-order', 'reject-draft', 'error', { errorMessage: err.message });
    next(err);
  }
});

// POST /po/bulk-create (new bulk endpoint)
router.post('/bulk-create', validateRequest(Joi.object({
  pos: Joi.array().items(schemas.poCreate).min(1).max(50).required(),
})), async (req, res, next) => {
  try {
    await ensureValidToken();
    const { pos } = req.body;
    const results = [];
    const errors = [];

    for (let i = 0; i < pos.length; i++) {
      try {
        const poReq = {
          ...req,
          body: pos[i],
        };
        const result = await retryOperation(() => handleCreate(poReq, res), 3, 1000);
        results.push({ index: i, success: true, result });
      } catch (err) {
        errors.push({ index: i, error: err.message });
      }
    }

    sendSuccess(res, { results, errors, total: pos.length });
  } catch (err) {
    next(err);
  }
});

module.exports = router;