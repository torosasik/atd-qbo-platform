'use strict';

const express = require('express');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ensureValidToken, getRealmId } = require('../core/qbo-auth');
const { refreshVendors, logAction } = require('../core/cache');
const { validateRequest, sendSuccess, schemas } = require('./middleware');

const router = express.Router();

const VENDOR_MAPPINGS_DOC = 'settings/vendor_mappings';

// GET /vendor-mappings
router.get('/mappings', async (req, res, next) => {
  try {
    const db = getFirestore();
    let docSnap = await db.doc(VENDOR_MAPPINGS_DOC).get();
    let data = docSnap.exists ? docSnap.data() : null;
    const vendors = data ? (data.vendors || []) : [];

    // Auto-sync from QBO if Firestore doc is empty/missing
    if (vendors.length === 0) {
      try {
        await ensureValidToken();
        const realmId = await getRealmId();
        const qboVendors = await refreshVendors(realmId);

        if (Array.isArray(qboVendors) && qboVendors.length > 0) {
          const merged = qboVendors.map((qv) => ({
            qbo_id: String(qv.Id),
            qbo_name: qv.DisplayName || qv.CompanyName || '',
            active: false,
            shopify_code: '',
            visible: true,
          }));

          await db.doc(VENDOR_MAPPINGS_DOC).set({
            vendors: merged,
            last_synced: FieldValue.serverTimestamp(),
          });

          // Read back for timestamp
          docSnap = await db.doc(VENDOR_MAPPINGS_DOC).get();
          data = docSnap.data();

          await logAction('vendor-management', 'auto-sync', 'success', {
            total: merged.length,
            trigger: 'empty-vendor-mappings-get',
          });
        }
      } catch (syncErr) {
        // QBO not connected — return empty mappings gracefully
        await logAction('vendor-management', 'auto-sync', 'skipped', {
          reason: syncErr.message,
        });
      }
    }

    // Re-read data after potential auto-sync
    const finalVendors = data ? (data.vendors || []) : [];
    const lastSynced = data && data.last_synced
      ? (data.last_synced.toDate ? data.last_synced.toDate().toISOString() : data.last_synced)
      : null;

    sendSuccess(res, {
      mappings: {
        vendors: finalVendors,
        last_synced: lastSynced,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /vendor-mappings
router.put('/mappings', validateRequest(schemas.vendorMappings), async (req, res, next) => {
  try {
    const { vendors } = req.body;

    const mappedVendors = vendors.map((v) => ({
      qbo_id: String(v.qbo_id || ''),
      qbo_name: String(v.qbo_name || ''),
      active: Boolean(v.active),
      shopify_code: String(v.shopify_code || ''),
      visible: v.visible !== false,
    }));

    const db = getFirestore();
    await db.doc(VENDOR_MAPPINGS_DOC).set({
      vendors: mappedVendors,
      last_synced: FieldValue.serverTimestamp(),
    });

    // Read back to get the server timestamp
    const saved = await db.doc(VENDOR_MAPPINGS_DOC).get();
    const savedData = saved.data();

    sendSuccess(res, {
      mappings: {
        vendors: savedData.vendors,
        last_synced: savedData.last_synced
          ? savedData.last_synced.toDate().toISOString()
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /vendor-mappings/sync
router.post('/mappings/sync', async (req, res, next) => {
  try {
    await ensureValidToken();
    // Force a fresh fetch from QBO (bypass cache TTL — this is an explicit sync)
    const realmId = await getRealmId();
    const qboVendors = await refreshVendors(realmId);

    if (!Array.isArray(qboVendors)) {
      const error = new Error('Failed to fetch vendors from QuickBooks. Check the connection and try again.');
      error.status = 500;
      return next(error);
    }

    // Read existing mappings
    const db = getFirestore();
    const docSnap = await db.doc(VENDOR_MAPPINGS_DOC).get();
    const existingVendors = docSnap.exists ? (docSnap.data().vendors || []) : [];

    // Build lookup of existing mappings by qbo_id
    const existingMap = {};
    for (const v of existingVendors) {
      existingMap[v.qbo_id] = v;
    }

    // Merge: keep existing settings for known vendors, add new ones as inactive
    const merged = qboVendors.map((qv) => {
      const id = String(qv.Id);
      const name = qv.DisplayName || qv.CompanyName || '';
      const existing = existingMap[id];
      if (existing) {
        return {
          qbo_id: id,
          qbo_name: name,
          active: existing.active,
          shopify_code: existing.shopify_code,
          visible: existing.visible !== false,
        };
      }
      return {
        qbo_id: id,
        qbo_name: name,
        active: false,
        shopify_code: '',
        visible: true,
      };
    });

    // Save merged result
    await db.doc(VENDOR_MAPPINGS_DOC).set({
      vendors: merged,
      last_synced: FieldValue.serverTimestamp(),
    });

    // Read back for timestamp
    const saved = await db.doc(VENDOR_MAPPINGS_DOC).get();
    const savedData = saved.data();

    await logAction('vendor-management', 'sync', 'success', {
      total: merged.length,
      new: merged.length - existingVendors.length,
    });

    sendSuccess(res, {
      mappings: {
        vendors: savedData.vendors,
        last_synced: savedData.last_synced
          ? savedData.last_synced.toDate().toISOString()
          : null,
      },
      summary: {
        total: merged.length,
        existing: Object.keys(existingMap).length,
        new_vendors: merged.length - Object.keys(existingMap).length,
      },
    });
  } catch (err) {
    await logAction('vendor-management', 'sync', 'error', { error: err.message });
    next(err);
  }
});

// GET /mappings/active — returns only active & visible vendors (for PO/Bill dropdowns)
router.get('/mappings/active', async (req, res, next) => {
  try {
    const db = getFirestore();
    const docSnap = await db.doc(VENDOR_MAPPINGS_DOC).get();
    const data = docSnap.exists ? docSnap.data() : null;
    const vendors = data ? (data.vendors || []) : [];

    const activeVendors = vendors
      .filter((v) => v.active && v.visible !== false)
      .map((v) => ({
        Id: v.qbo_id,
        DisplayName: v.qbo_name,
        shopify_code: v.shopify_code || '',
      }));

    sendSuccess(res, { vendors: activeVendors });
  } catch (err) {
    next(err);
  }
});

module.exports = router;