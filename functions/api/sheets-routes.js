'use strict';

const express = require('express');
const { getSettings } = require('../core/settings');
const { readSheetData, groupByPO, testConnection } = require('../core/sheets-connector');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { sendSuccess } = require('./middleware');

const router = express.Router();

const ORDERS_CACHE_DOC = 'cache/sheets_orders';
const CACHE_TTL_MS = 5 * 60 * 1000;
/**
 * Detect and transpose column-oriented sheet data.
 * The master sheet has field names in column A and each subsequent column
 * represents an order (keyed by date in the header row).
 */
function transposeSheetData(headers, rows) {
  if (!headers.length || !rows.length) return { headers, rows };
  const labelColumn = headers[0];
  const fieldLabels = rows.map((r) => String(r[labelColumn] || '').trim()).filter(Boolean);
  const knownFields = ['Order #', 'SKU', 'Vendor', 'Item Name', 'Qty', 'Line Item #'];
  const matchCount = knownFields.filter((f) =>
    fieldLabels.some((label) => label.toLowerCase() === f.toLowerCase())
  ).length;
  if (matchCount < 3) return { headers, rows };
  const newHeaders = fieldLabels;
  const dataColumnHeaders = headers.slice(1).filter((h) => h.length <= 30);
  const newRows = dataColumnHeaders.map((colHeader) => {
    const obj = {};
    for (let i = 0; i < rows.length; i++) {
      const fieldName = String(rows[i][labelColumn] || '').trim();
      if (!fieldName) continue;
      obj[fieldName] = String(rows[i][colHeader] || '').trim();
    }
    return obj;
  });
  return { headers: newHeaders, rows: newRows };
}


function normalizeComparable(value) {
  return String(value || '').trim().toLowerCase();
}

function findColumnKey(row = {}, candidates = []) {
  const entries = Object.keys(row).map((key) => ({ key, comparable: normalizeComparable(row[key]) }));
  for (const candidate of candidates) {
    const target = normalizeComparable(candidate);
    const match = entries.find((entry) => entry.comparable === target);
    if (match) return match.key;
  }
  return null;
}

function mapRowsForPoGrouping(rows = []) {
  return rows.map((row) => {
    const orderKey = findColumnKey(row, ['Order #', 'Order Number']);
    const lineItemKey = findColumnKey(row, ['Line Item #', 'Line Item']);
    const customerNameKey = findColumnKey(row, ['Customer', 'Customer Name']);
    const customerEmailKey = findColumnKey(row, ['Email', 'Customer Email']);
    const vendorNameKey = findColumnKey(row, ['Vendor', 'Vendor Name']);
    const dateKey = findColumnKey(row, ['Date']);
    const statusKey = findColumnKey(row, ['Status']);
    const orderTotalKey = findColumnKey(row, ['Order Total']);
    const quantityKey = findColumnKey(row, ['Qty', 'Quantity']);
    const unitPriceKey = findColumnKey(row, ['Price', 'Unit Price']);
    const subtotalKey = findColumnKey(row, ['Subtotal']);
    const itemDescriptionKey = findColumnKey(row, ['Item Name', 'Item Description']);
    const requiredSizeKey = findColumnKey(row, ['Required Size']);
    const unitKey = findColumnKey(row, ['Unit']);
    const tilesPerBoxKey = findColumnKey(row, ['Tiles Per Box']);
    const tileSizeCoverageKey = findColumnKey(row, ['Tile Size / Coverage']);
    const boxAreaCoverageKey = findColumnKey(row, ['Box Area / Coverage']);

    return {
      ...row,
      orderNumber: orderKey ? row[orderKey] : '',
      lineItem: lineItemKey ? row[lineItemKey] : '',
      customerName: customerNameKey ? row[customerNameKey] : '',
      customerEmail: customerEmailKey ? row[customerEmailKey] : '',
      vendorName: vendorNameKey ? row[vendorNameKey] : '',
      date: dateKey ? row[dateKey] : '',
      status: statusKey ? row[statusKey] : '',
      orderTotal: orderTotalKey ? row[orderTotalKey] : '',
      quantity: quantityKey ? row[quantityKey] : '',
      unitPrice: unitPriceKey ? row[unitPriceKey] : '',
      subtotal: subtotalKey ? row[subtotalKey] : '',
      itemDescription: itemDescriptionKey ? row[itemDescriptionKey] : '',
      requiredSize: requiredSizeKey ? row[requiredSizeKey] : '',
      unit: unitKey ? row[unitKey] : '',
      tilesPerBox: tilesPerBoxKey ? row[tilesPerBoxKey] : '',
      tileSizeCoverage: tileSizeCoverageKey ? row[tileSizeCoverageKey] : '',
      boxAreaCoverage: boxAreaCoverageKey ? row[boxAreaCoverageKey] : '',
    };
  });
}

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
    const {
      po_sheet_id: sheetId,
      po_sheet_tab: tabName,
      header_row: headerRow,
      data_start_row: dataStartRow,
    } = settings.google_sheets;

    if (!sheetId) {
      const error = new Error('po_sheet_id is not configured in settings');
      error.status = 400;
      return next(error);
    }

    const { headers, rows } = await readSheetData(sheetId, tabName, headerRow, dataStartRow);
    const mappedRows = mapRowsForPoGrouping(rows);
    const pos = groupByPO(mappedRows, 'orderNumber');

    sendSuccess(res, { headers, rows, pos });
  } catch (err) {
    next(err);
  }
});

// GET /sheets/orders
router.get('/orders', async (req, res, next) => {
  try {
    const db = getFirestore();
    const cacheRef = db.doc(ORDERS_CACHE_DOC);
    const cacheSnap = await cacheRef.get();
    const now = Date.now();

    if (cacheSnap.exists) {
      const cache = cacheSnap.data() || {};
      const cachedAtMs = cache.cachedAtMs || 0;
      if (cachedAtMs > 0 && now - cachedAtMs < CACHE_TTL_MS) {
        sendSuccess(res, { headers: cache.headers || [], rows: cache.rows || [] });
        return;
      }
    }

    const settings = await getSettings();
    const {
      po_sheet_id: sheetId,
      po_sheet_tab: tabName,
      header_row: headerRow,
      data_start_row: dataStartRow,
    } = settings.google_sheets;

    if (!sheetId) {
      const error = new Error('po_sheet_id is not configured in settings');
      error.status = 400;
      return next(error);
    }

    const raw = await readSheetData(sheetId, tabName, headerRow, dataStartRow);
    const { headers, rows } = transposeSheetData(raw.headers, raw.rows);

    await cacheRef.set(
      {
        headers,
        rows,
        cachedAtMs: now,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    sendSuccess(res, { headers, rows });
  } catch (err) {
    next(err);
  }
});

// POST /sheets/import
router.post('/import', async (req, res, next) => {
  try {
    const settings = await getSettings();
    const {
      po_sheet_id: sheetId,
      po_sheet_tab: tabName,
      header_row: headerRow,
      data_start_row: dataStartRow,
    } = settings.google_sheets;

    if (!sheetId) {
      const error = new Error('po_sheet_id is not configured in settings');
      error.status = 400;
      return next(error);
    }

    const { rows } = await readSheetData(sheetId, tabName, headerRow, dataStartRow);
    const mappedRows = mapRowsForPoGrouping(rows);
    const pos = groupByPO(mappedRows, 'orderNumber');

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
