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

function classifySheetsError(err) {
  const status = err?.status || err?.code || err?.response?.status;
  const message = String(err?.message || '').toLowerCase();
  const reason = String(err?.response?.data?.error?.message || '').toLowerCase();
  const combined = `${message} ${reason}`;

  if (status === 404 || combined.includes('requested entity was not found')) {
    return {
      status: 404,
      error: 'The configured Google Sheet was not found.',
      code: 'SHEET_NOT_FOUND',
      fix: 'Check that the Sheet ID in Settings is correct and the sheet has not been deleted.',
    };
  }

  if (status === 403 || combined.includes('permission') || combined.includes('forbidden')) {
    return {
      status: 403,
      error: 'Permission denied. The service account cannot access this sheet.',
      code: 'PERMISSION_DENIED',
      fix: 'Share the Google Sheet with the service account email, or check that the sheet is not restricted.',
    };
  }

  if (combined.includes('unable to parse range') || (combined.includes('range') && combined.includes('not found'))) {
    return {
      status: 404,
      error: 'The sheet tab was not found.',
      code: 'TAB_NOT_FOUND',
      fix: 'Check that the tab name in Settings matches an actual tab in your Google Sheet.',
    };
  }

  if (
    combined.includes('timeout')
    || combined.includes('network')
    || combined.includes('econnreset')
    || combined.includes('enotfound')
    || combined.includes('etimedout')
    || combined.includes('eai_again')
    || status === 'ECONNRESET'
    || status === 'ENOTFOUND'
    || status === 'ETIMEDOUT'
  ) {
    return {
      status: 502,
      error: 'Could not reach Google Sheets.',
      code: 'FETCH_FAILED',
      fix: 'Check your internet connection and try again. If the problem persists, Google Sheets may be temporarily unavailable.',
    };
  }

  return {
    status: 500,
    error: err?.message || 'Failed to read Google Sheets data.',
    code: 'SHEETS_ERROR',
    fix: 'Try again. If this keeps happening, check your Google Sheets settings and service account access.',
  };
}

function sendClassifiedSheetsError(res, err) {
  const classified = classifySheetsError(err);
  res.status(classified.status).json({
    success: false,
    error: classified.error,
    code: classified.code,
    fix: classified.fix,
  });
}

function summarizeInvalidReasons(mappedRows = []) {
  const counts = new Map();

  for (const row of mappedRows) {
    if (!String(row.orderNumber || '').trim()) {
      counts.set('Missing order number', (counts.get('Missing order number') || 0) + 1);
    }

    if (!String(row.vendorName || '').trim()) {
      counts.set('Missing vendor name', (counts.get('Missing vendor name') || 0) + 1);
    }

    const quantity = parseFloat(row.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      counts.set('No line items with valid quantity', (counts.get('No line items with valid quantity') || 0) + 1);
    }
  }

  return Array.from(counts.entries()).map(([reason, count]) => ({ reason, count }));
}

function summarizeSkippedGroups(mappedRows = [], pos = []) {
  const skippedCounts = new Map();
  const rowsMissingOrderNumber = mappedRows.filter((row) => !String(row.orderNumber || '').trim()).length;
  if (rowsMissingOrderNumber > 0) {
    skippedCounts.set('Missing order number', rowsMissingOrderNumber);
  }

  const groupsWithoutValidQuantity = pos.filter((po) => {
    const validLineCount = (po.lines || []).filter((line) => Number.isFinite(line.quantity) && line.quantity > 0).length;
    return validLineCount === 0;
  }).length;

  if (groupsWithoutValidQuantity > 0) {
    skippedCounts.set('No line items with valid quantity', groupsWithoutValidQuantity);
  }

  return Array.from(skippedCounts.entries()).map(([reason, count]) => ({ reason, count }));
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
      res.status(400).json({
        success: false,
        error: 'No Google Sheet is connected.',
        code: 'NO_SHEET_CONFIGURED',
        fix: 'Go to Settings > Google Sheets and enter your Sheet ID.',
      });
      return;
    }

    try {
      const { headers, rows } = await readSheetData(sheetId, tabName, headerRow, dataStartRow);
      const mappedRows = mapRowsForPoGrouping(rows);
      const pos = groupByPO(mappedRows, 'orderNumber');
      const validRows = mappedRows.filter((row) => String(row.orderNumber || '').trim()).length;
      const invalidRows = Math.max(0, rows.length - validRows);

      const code = rows.length === 0 ? 'SHEET_EMPTY' : validRows === 0 ? 'NO_VALID_ROWS' : 'READY';

      sendSuccess(res, {
        headers,
        rows,
        pos,
        diagnostics: {
          sheetId,
          tabName,
          totalRows: rows.length,
          validRows,
          invalidRows,
          poGroups: pos.length,
          invalidReasons: summarizeInvalidReasons(mappedRows),
          checkedAt: new Date().toISOString(),
          code,
        },
      });
    } catch (err) {
      sendClassifiedSheetsError(res, err);
    }
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
        sendSuccess(res, {
          headers: cache.headers || [],
          rows: cache.rows || [],
          source: 'fresh-cache',
          lastSyncedAt: cache.lastSuccessfulSyncAt || cache.updatedAt || null,
          cachedAtMs,
        });
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

    try {
      const raw = await readSheetData(sheetId, tabName, headerRow, dataStartRow);
      const { headers, rows } = transposeSheetData(raw.headers, raw.rows);

      await cacheRef.set(
        {
          headers,
          rows,
          cachedAtMs: now,
          updatedAt: FieldValue.serverTimestamp(),
          lastSuccessfulSyncAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      sendSuccess(res, {
        headers,
        rows,
        source: 'live',
        lastSyncedAt: new Date(now).toISOString(),
        cachedAtMs: now,
      });
    } catch (liveErr) {
      if (cacheSnap.exists) {
        const cache = cacheSnap.data() || {};
        sendSuccess(res, {
          headers: cache.headers || [],
          rows: cache.rows || [],
          source: 'stale-cache',
          lastSyncedAt: cache.lastSuccessfulSyncAt || cache.updatedAt || null,
          cachedAtMs: cache.cachedAtMs || 0,
          warning: `Live sheet pull failed. Showing last successful sync. ${liveErr.message}`,
        });
        return;
      }
      throw liveErr;
    }
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
      res.status(400).json({
        success: false,
        error: 'No Google Sheet is connected.',
        code: 'NO_SHEET_CONFIGURED',
        fix: 'Go to Settings > Google Sheets and enter your Sheet ID.',
      });
      return;
    }

    try {
      const { rows } = await readSheetData(sheetId, tabName, headerRow, dataStartRow);
      const mappedRows = mapRowsForPoGrouping(rows);
      const pos = groupByPO(mappedRows, 'orderNumber');

      const validPos = pos.filter((po) => {
        const validLineCount = (po.lines || []).filter((line) => Number.isFinite(line.quantity) && line.quantity > 0).length;
        return validLineCount > 0;
      });

      const skippedReasons = summarizeSkippedGroups(mappedRows, pos);
      const skippedGroups = pos.length - validPos.length;
      const skippedRows = mappedRows.filter((row) => !String(row.orderNumber || '').trim()).length;
      const skipped = skippedGroups + skippedRows;

      if (validPos.length === 0) {
        sendSuccess(res, {
          imported: 0,
          skipped,
          skippedGroups,
          skippedRows,
          draftIds: [],
          skippedReasons,
        }, 'No importable purchase orders were found in the sheet.');
        return;
      }

      const db = getFirestore();
      const batch = db.batch();
      const draftIds = [];

      for (const po of validPos) {
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

      sendSuccess(res, {
        imported: validPos.length,
        skipped,
        skippedGroups,
        skippedRows,
        draftIds,
        skippedReasons,
      });
    } catch (err) {
      sendClassifiedSheetsError(res, err);
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
