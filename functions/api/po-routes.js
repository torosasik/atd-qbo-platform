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

// POST /purchase-orders/auto-create
// Accepts selected order rows from the Orders page, groups by order number + vendor,
// and creates PO drafts in Firestore for each group.
router.post('/auto-create', async (req, res, next) => {
  try {
    const { rows, headers: reqHeaders } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'No rows provided.' });
    }

    // Helper: find a header key by candidate names (case-insensitive)
    const hdrs = Array.isArray(reqHeaders) ? reqHeaders : [];
    const rowKeys = rows.length > 0 ? Object.keys(rows[0]) : [];
    const allKeys = [...new Set([...hdrs, ...rowKeys])];

    function findKey(candidates) {
      const lower = allKeys.map((k) => ({ o: k, l: k.toLowerCase().trim() }));
      for (const c of candidates) {
        const m = lower.find((h) => h.l === c.toLowerCase().trim());
        if (m) return m.o;
      }
      return null;
    }

    const orderKey = findKey(['Order #', 'Order Number']);
    const vendorKey = findKey(['Vendor', 'Vendor Name', 'Supplier']);
    const nameKey = findKey(['Item Name', 'Item Description', 'Description']);
    const qtyKey = findKey(['Qty', 'Quantity']);
    const priceKey = findKey(['Unit Price', 'Price', 'Cost']);
    const skuKey = findKey(['SKU', 'Sku']);

    // Group rows by (orderNumber, vendorName)
    const groups = new Map();
    for (const row of rows) {
      const orderNum = orderKey ? String(row[orderKey] || '').trim() : '';
      const vendorName = vendorKey ? String(row[vendorKey] || '').trim() : 'Unknown';
      const groupKey = `${orderNum}__${vendorName}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, { orderNumber: orderNum, vendorName, lines: [] });
      }

      const group = groups.get(groupKey);
      group.lines.push({
        description: nameKey ? String(row[nameKey] || '') : '',
        sku: skuKey ? String(row[skuKey] || '') : '',
        quantity: qtyKey ? (parseFloat(row[qtyKey]) || 1) : 1,
        unitPrice: priceKey ? (parseFloat(row[priceKey]) || 0) : 0,
        unit: 'Sq Ft',
      });
    }

    const db = getFirestore();
    const batch = db.batch();
    const draftIds = [];

    for (const [, group] of groups) {
      const ref = db.collection('po_drafts').doc();
      draftIds.push(ref.id);
      batch.set(ref, {
        orderNumber: group.orderNumber,
        vendorName: group.vendorName,
        lines: group.lines,
        status: 'pending',
        source: 'auto_create',
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    await logAction('purchase-order', 'auto-create', 'success', {
      groupCount: groups.size,
      rowCount: rows.length,
      draftIds,
    });

    sendSuccess(res, { created: groups.size, draftIds, rowCount: rows.length });
  } catch (err) {
    await logAction('purchase-order', 'auto-create', 'error', { errorMessage: err.message });
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

// GET /po/stats
router.get('/stats', async (req, res, next) => {
  try {
    const db = getFirestore();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get all drafts (without status filter to count different statuses)
    const allDraftsSnap = await db.collection('po_drafts').get();
    const allDrafts = allDraftsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    const drafts = allDrafts.filter((d) => d.status === 'pending').length;
    const pendingSync = allDrafts.filter((d) => d.status === 'queued' || d.status === 'pending').length;
    const failed = allDrafts.filter((d) => d.status === 'error' || d.status === 'failed').length;
    const todayCreated = allDrafts.filter((d) => {
      if (!d.createdAt) return false;
      const created = d.createdAt.toDate ? d.createdAt.toDate() : new Date(d.createdAt._seconds * 1000);
      return created >= todayStart;
    }).length;

    sendSuccess(res, { todayCreated, drafts, pendingSync, failed });
  } catch (err) {
    next(err);
  }
});

module.exports = router;