'use strict';

const Joi = require('joi');
const express = require('express');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ensureValidToken, getRealmId } = require('../core/qbo-auth');
const { refreshItems } = require('../core/cache');
const { logAction } = require('../core/logger');
const { sendSuccess, validateRequest } = require('./middleware');

const router = express.Router();

const ITEMS_COLLECTION = 'item_catalog';
const ITEMS_META_DOC = 'settings/item_catalog_meta';

// GET /items/catalog — returns locally stored item catalog
router.get('/catalog', async (req, res, next) => {
  try {
    const db = getFirestore();
    const snapshot = await db.collection(ITEMS_COLLECTION).get();
    const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Get last synced time from meta doc
    const metaSnap = await db.doc(ITEMS_META_DOC).get();
    const meta = metaSnap.exists ? metaSnap.data() : {};
    const lastSynced = meta.last_synced
      ? (meta.last_synced.toDate ? meta.last_synced.toDate().toISOString() : meta.last_synced)
      : null;

    sendSuccess(res, {
      items,
      last_synced: lastSynced,
      count: items.length,
    });
  } catch (err) {
    next(err);
  }
});

// POST /items/catalog/sync — syncs items from QBO into local catalog
router.post('/catalog/sync', async (req, res, next) => {
  try {
    await ensureValidToken();
    const realmId = await getRealmId();

    // Fetch fresh items from QBO
    const qboItems = await refreshItems(realmId);

    if (!Array.isArray(qboItems)) {
      const error = new Error('Failed to fetch items from QuickBooks. Check the connection and try again.');
      error.status = 500;
      return next(error);
    }

    const db = getFirestore();

    // Clean up old oversized cache document if it exists
    try {
      const oldCacheRef = db.collection('cache').doc(`items_${realmId}`);
      const oldCacheSnap = await oldCacheRef.get();
      if (oldCacheSnap.exists) {
        await oldCacheRef.delete();
        await logAction('item-catalog', 'cleanup-old-cache', 'success', { realmId });
      }
    } catch (cleanupErr) {
      // Non-fatal — just log and continue
      console.warn('[items-routes] Failed to clean up old cache doc:', cleanupErr.message);
    }

    // Get existing items to preserve local overrides
    const existingSnap = await db.collection(ITEMS_COLLECTION).get();
    const existingMap = {};
    existingSnap.docs.forEach((doc) => {
      existingMap[doc.id] = doc.data();
    });

    // Build batch write to upsert items
    const batch = db.batch();
    let newCount = 0;

    for (const qi of qboItems) {
      const id = String(qi.Id);
      const existing = existingMap[id] || {};

      // Store only lightweight fields needed for PO dropdown
      const itemData = {
        qbo_id: id,
        qbo_name: qi.Name || '',
        qbo_sku: qi.Sku || '',
        qbo_type: qi.Type || '',
        qbo_unit_price: qi.UnitPrice != null ? qi.UnitPrice : null,
        qbo_purchase_cost: qi.PurchaseCost != null ? qi.PurchaseCost : null,
        qbo_active: qi.Active !== false,
        // Preserve local overrides
        custom_name: existing.custom_name || '',
        custom_sku: existing.custom_sku || '',
        custom_description: existing.custom_description || '',
        visible: existing.visible !== false,
        updated_at: FieldValue.serverTimestamp(),
      };

      const docRef = db.collection(ITEMS_COLLECTION).doc(id);
      batch.set(docRef, itemData, { merge: true });

      if (!existingMap[id]) newCount++;
    }

    // Delete items that no longer exist in QBO
    const qboIds = new Set(qboItems.map((qi) => String(qi.Id)));
    for (const doc of existingSnap.docs) {
      if (!qboIds.has(doc.id)) {
        batch.delete(doc.ref);
      }
    }

    await batch.commit();

    // Update meta doc with sync timestamp
    await db.doc(ITEMS_META_DOC).set({
      last_synced: FieldValue.serverTimestamp(),
      total_items: qboItems.length,
    }, { merge: true });

    await logAction('item-catalog', 'sync', 'success', {
      total: qboItems.length,
      new: newCount,
    });

    // Return the synced items
    const items = qboItems.map((qi) => {
      const id = String(qi.Id);
      const existing = existingMap[id] || {};
      return {
        qbo_id: id,
        qbo_name: qi.Name || '',
        qbo_sku: qi.Sku || '',
        qbo_type: qi.Type || '',
        qbo_unit_price: qi.UnitPrice != null ? qi.UnitPrice : null,
        qbo_purchase_cost: qi.PurchaseCost != null ? qi.PurchaseCost : null,
        qbo_active: qi.Active !== false,
        custom_name: existing.custom_name || '',
        custom_sku: existing.custom_sku || '',
        custom_description: existing.custom_description || '',
        visible: existing.visible !== false,
      };
    });

    sendSuccess(res, {
      items,
      last_synced: new Date().toISOString(),
      summary: {
        total: qboItems.length,
        existing: existingSnap.size - newCount,
        new_items: newCount,
      },
    });
  } catch (err) {
    await logAction('item-catalog', 'sync', 'error', { error: err.message });
    next(err);
  }
});

// PUT /items/catalog — update local item overrides
router.put('/catalog', validateRequest(Joi.object({
  items: Joi.array().items(
    Joi.object({
      qbo_id: Joi.string().trim().required(),
      custom_name: Joi.string().trim().allow('').optional(),
      custom_sku: Joi.string().trim().allow('').optional(),
      custom_description: Joi.string().trim().allow('').optional(),
      visible: Joi.boolean().optional(),
    }).options({ stripUnknown: true })
  ).required(),
})), async (req, res, next) => {
  try {
    const { items: updates } = req.body;
    const db = getFirestore();
    const batch = db.batch();

    for (const update of updates) {
      const docRef = db.collection(ITEMS_COLLECTION).doc(update.qbo_id);
      const updateData = {};
      if (update.custom_name !== undefined) updateData.custom_name = update.custom_name;
      if (update.custom_sku !== undefined) updateData.custom_sku = update.custom_sku;
      if (update.custom_description !== undefined) updateData.custom_description = update.custom_description;
      if (update.visible !== undefined) updateData.visible = update.visible;
      updateData.updated_at = FieldValue.serverTimestamp();
      batch.set(docRef, updateData, { merge: true });
    }

    await batch.commit();

    // Update meta timestamp
    await db.doc(ITEMS_META_DOC).set({
      last_synced: FieldValue.serverTimestamp(),
    }, { merge: true });

    // Return updated items
    const snapshot = await db.collection(ITEMS_COLLECTION).get();
    const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    sendSuccess(res, {
      items,
      last_synced: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// GET /items/catalog/active — returns only active & visible items (for PO dropdowns)
router.get('/catalog/active', async (req, res, next) => {
  try {
    const db = getFirestore();
    const snapshot = await db.collection(ITEMS_COLLECTION).get();
    const items = snapshot.docs
      .map((doc) => doc.data())
      .filter((item) => item.visible !== false && item.qbo_active !== false)
      .map((item) => ({
        Id: item.qbo_id,
        Name: item.custom_name || item.qbo_name,
        Sku: item.custom_sku || item.qbo_sku,
        Description: item.custom_description || '',
        Type: item.qbo_type,
        UnitPrice: item.qbo_unit_price,
        PurchaseCost: item.qbo_purchase_cost,
      }));

    sendSuccess(res, { items });
  } catch (err) {
    console.error('[items-routes] /catalog/active failed, returning empty list:', err.message);
    sendSuccess(res, { items: [], _warning: 'item_data_unavailable' });
  }
});

module.exports = router;
