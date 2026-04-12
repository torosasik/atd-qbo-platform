'use strict';

/**
 * Order Status Routes
 *
 * Manages per-row order statuses stored in Firestore collection "order_statuses".
 * Each document key is "{orderNumber}_{lineItem}" (or just "{orderNumber}" if no lineItem).
 *
 * Statuses: Pending | Ordered | Received | Fulfilled
 */

const express = require('express');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { sendSuccess } = require('./middleware');

const router = express.Router();

const COLLECTION = 'order_statuses';
const VALID_STATUSES = ['Pending', 'Ordered', 'Received', 'Fulfilled'];

function buildDocId(orderNumber, lineItem) {
  const base = String(orderNumber || '').trim();
  const line = String(lineItem || '').trim();
  return line ? `${base}_${line}` : base;
}

// GET /order-statuses
// Returns all order status documents as { [docId]: status }
router.get('/', async (req, res, next) => {
  try {
    const db = getFirestore();
    const snapshot = await db.collection(COLLECTION).get();
    const statuses = {};
    snapshot.docs.forEach((doc) => {
      statuses[doc.id] = doc.data().status || 'Pending';
    });
    sendSuccess(res, { statuses });
  } catch (err) {
    next(err);
  }
});

// PUT /order-statuses/:orderNumber/:lineItem?
// Sets the status for a specific order row.
router.put('/:orderNumber/:lineItem?', async (req, res, next) => {
  try {
    const { orderNumber, lineItem } = req.params;
    const { status } = req.body;

    if (!orderNumber) {
      const error = new Error('orderNumber is required');
      error.status = 400;
      return next(error);
    }

    if (!status || !VALID_STATUSES.includes(status)) {
      const error = new Error(`status must be one of: ${VALID_STATUSES.join(', ')}`);
      error.status = 400;
      return next(error);
    }

    const docId = buildDocId(orderNumber, lineItem);
    const db = getFirestore();
    await db.collection(COLLECTION).doc(docId).set(
      {
        orderNumber: String(orderNumber).trim(),
        lineItem: String(lineItem || '').trim(),
        status,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    sendSuccess(res, { docId, status });
  } catch (err) {
    next(err);
  }
});

// PUT /order-statuses/bulk
// Bulk-set statuses: body = { updates: [{ orderNumber, lineItem, status }] }
router.put('/bulk', async (req, res, next) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      const error = new Error('updates array is required');
      error.status = 400;
      return next(error);
    }

    const db = getFirestore();
    const batch = db.batch();

    for (const { orderNumber, lineItem, status } of updates) {
      if (!orderNumber || !status || !VALID_STATUSES.includes(status)) continue;
      const docId = buildDocId(orderNumber, lineItem);
      const ref = db.collection(COLLECTION).doc(docId);
      batch.set(
        ref,
        {
          orderNumber: String(orderNumber).trim(),
          lineItem: String(lineItem || '').trim(),
          status,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    await batch.commit();
    sendSuccess(res, { updated: updates.length });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
