'use strict';

const express = require('express');
const { getSettings } = require('../core/settings');
const { readSheetData, groupByPO, testConnection } = require('../core/sheets-connector');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { sendSuccess } = require('./middleware');

const router = express.Router();

// GET /sheets/test-connection
router.get('/test-connection', async (req, res, next) => {
  try {
    const settings = await getSettings();
    const sheetId = settings.google_sheets.po_sheet_id;
    if (!sheetId) {
      const error = new Error('po_sheet_id is not configured in settings');
      error.status = 400;
      return next(error);
    }
    const result = await testConnection(sheetId);
    res.status(result.success ? 200 : 502).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /sheets/preview
router.get('/preview', async (req, res, next) => {
  try {
    const settings = await getSettings();
    const { po_sheet_id: sheetId, po_sheet_tab: tabName, po_column_mapping: columnMapping } = settings.google_sheets;

    if (!sheetId) {
      const error = new Error('po_sheet_id is not configured in settings');
      error.status = 400;
      return next(error);
    }

    const rows = await readSheetData(sheetId, tabName, columnMapping);
    const groupKey = Object.keys(columnMapping).find((k) => k === 'orderNumber') ? 'orderNumber' : null;
    const pos = groupKey ? groupByPO(rows, groupKey) : [];

    sendSuccess(res, { rows, pos });
  } catch (err) {
    next(err);
  }
});

// POST /sheets/import
router.post('/import', async (req, res, next) => {
  try {
    const settings = await getSettings();
    const { po_sheet_id: sheetId, po_sheet_tab: tabName, po_column_mapping: columnMapping } = settings.google_sheets;

    if (!sheetId) {
      const error = new Error('po_sheet_id is not configured in settings');
      error.status = 400;
      return next(error);
    }

    const rows = await readSheetData(sheetId, tabName, columnMapping);
    const pos = groupByPO(rows, 'orderNumber');

    if (pos.length === 0) {
      sendSuccess(res, { imported: 0 }, 'No PO groups found in sheet');
      return;
    }

    const db = getFirestore();
    const batch = db.batch();
    const draftIds = [];

    for (const po of pos) {
      const ref = db.collection('po_drafts').doc();
      draftIds.push(ref.id);
      batch.set(ref, {
        ...po,
        status: 'pending',
        source: 'google_sheets',
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    sendSuccess(res, { imported: pos.length, draftIds });
  } catch (err) {
    next(err);
  }
});

module.exports = router;