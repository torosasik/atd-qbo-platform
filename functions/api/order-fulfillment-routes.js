'use strict';

/**
 * Order Fulfillment Routes
 *
 * Manages per-row fulfillment/procurement tracking stored in Firestore
 * collection "order_fulfillment". Each document key is
 * "{orderNumber}_{lineItem}" (or just "{orderNumber}" if no lineItem).
 */

const express = require('express');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { sendSuccess } = require('./middleware');

const router = express.Router();

const COLLECTION = 'order_fulfillment';

const VALID_SOURCES = ['in_stock', 'vendor_purchase', ''];
const VALID_SHIPPING = ['pickup', 'drop_ship', 'vendor_dropoff', 'ups', 'fedex', 'other', ''];

function buildDocId(orderNumber, lineItem) {
  const base = String(orderNumber || '').trim();
  const line = String(lineItem || '').trim();
  return line ? `${base}_${line}` : base;
}

// GET /order-fulfillment
// Returns all fulfillment documents as { [docId]: { ...fields } }
router.get('/', async (req, res, next) => {
  try {
    const db = getFirestore();
    const snapshot = await db.collection(COLLECTION).get();
    const fulfillment = {};
    snapshot.docs.forEach((doc) => {
      fulfillment[doc.id] = doc.data();
    });
    sendSuccess(res, { fulfillment });
  } catch (err) {
    next(err);
  }
});

// PUT /order-fulfillment/:orderNumber/:lineItem?
// Upsert fulfillment data for a specific order row.
router.put('/:orderNumber/:lineItem?', async (req, res, next) => {
  try {
    const { orderNumber, lineItem } = req.params;

    if (!orderNumber) {
      const error = new Error('orderNumber is required');
      error.status = 400;
      return next(error);
    }

    const {
      source,
      vendorName,
      orderDate,
      cost,
      shippingMethod,
      trackingNumber,
      received,
      receivedDate,
      poNumber,
      vendorInvoiceNumber,
      paid,
      paidDate,
      notes,
    } = req.body;

    // Build update object — only include fields that are provided
    const update = {
      orderNumber: String(orderNumber).trim(),
      lineItem: String(lineItem || '').trim(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (source !== undefined) update.source = String(source);
    if (vendorName !== undefined) update.vendorName = String(vendorName);
    if (orderDate !== undefined) update.orderDate = orderDate;
    if (cost !== undefined) update.cost = Number(cost) || 0;
    if (shippingMethod !== undefined) update.shippingMethod = String(shippingMethod);
    if (trackingNumber !== undefined) update.trackingNumber = String(trackingNumber);
    if (received !== undefined) update.received = Boolean(received);
    if (receivedDate !== undefined) update.receivedDate = receivedDate;
    if (poNumber !== undefined) update.poNumber = String(poNumber);
    if (vendorInvoiceNumber !== undefined) update.vendorInvoiceNumber = String(vendorInvoiceNumber);
    if (paid !== undefined) update.paid = Boolean(paid);
    if (paidDate !== undefined) update.paidDate = paidDate;
    if (notes !== undefined) update.notes = String(notes);

    const docId = buildDocId(orderNumber, lineItem);
    const db = getFirestore();
    await db.collection(COLLECTION).doc(docId).set(update, { merge: true });

    sendSuccess(res, { docId, ...update });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
