'use strict';

/**
 * Google Sheets Connector — READ-ONLY
 *
 * IMPORTANT: This module must NEVER write to any Google Sheet.
 * The master sheet (configured via po_sheet_id) is a shared data source.
 * The OAuth scope is intentionally restricted to `spreadsheets.readonly`
 * to enforce this at the API level. Do NOT change the scope or add
 * any update/append/batchUpdate calls.
 */

const { google } = require('googleapis');
const { logAction } = require('./logger');

// Unreachable from normalizeHeader (trims whitespace only, doesn't strip control chars).
const SYNTHETIC_HEADER_PREFIX = '\x00__col_';

function normalizeHeader(value) {
  return String(value || '').trim();
}

/**
 * Build an authenticated Google Sheets API client using Application Default
 * Credentials (ADC). On Cloud Functions this resolves to the service account
 * attached to the function. Locally it resolves via GOOGLE_APPLICATION_CREDENTIALS.
 */
async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient });
}

/**
 * Read data from a Google Sheet and return headers + row objects.
 *
 * @param {string} sheetId - The Google Sheets spreadsheet ID.
 * @param {string} tabName - The sheet tab name (e.g. 'Sheet1').
 * @param {number} [headerRow=1] - Header row number (1-based).
 * @param {number} [dataStartRow=2] - Data start row number (1-based).
 * @returns {Promise<{headers: string[], rows: Object[]}>}
 */
function columnIndexToLetter(index) {
  let n = index;
  let s = '';
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

const ROW_CHUNK_SIZE = 2000;
const MIN_CHUNK_SIZE = 100;
// Google Sheets API enforces 60 read requests/min/user. With ~70k-row
// sheets and chunk-halving on payload-too-big, we'd blow that quota in one
// pull. Cap the read at MAX_DATA_ROWS so we make ~10 requests per pull.
// Active orders are at the top of the master sheet; rows past this are
// historical and not surfaced on the Orders page anyway.
const MAX_DATA_ROWS = 8000;
const RATE_LIMIT_BACKOFF_MS = [1000, 3000, 8000];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(err) {
  const msg = String(err?.message || '').toLowerCase();
  return (
    err?.code === 429 ||
    err?.status === 429 ||
    msg.includes('quota exceeded') ||
    msg.includes('rate limit') ||
    msg.includes('rate_limit') ||
    msg.includes('ratelimitexceeded')
  );
}

async function readSheetData(sheetId, tabName, headerRow = 1, dataStartRow = 2) {
  const sheets = await getSheetsClient();

  // Probe metadata so we can build a column-bounded range. Reading the full
  // A:ZZ range on a wide sheet (36 cols × ~70k rows) blows the 11MB API
  // payload limit and fails with INVALID_ARGUMENT. By scoping to the
  // sheet's actual column count and reading in row chunks, we stay under
  // the limit and only fetch what exists.
  let columnCount = 26;
  let rowCount = 1000;
  let metaError = null;
  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      fields: 'sheets(properties(title,gridProperties))',
    });
    const target = (meta.data.sheets || []).find(
      (s) => s.properties?.title === tabName
    );
    if (target) {
      columnCount = target.properties.gridProperties?.columnCount || columnCount;
      rowCount = target.properties.gridProperties?.rowCount || rowCount;
    }
  } catch (e) {
    metaError = e.message;
  }

  const lastCol = columnIndexToLetter(Math.max(0, columnCount - 1));
  const effectiveRowCount = Math.min(rowCount, MAX_DATA_ROWS);

  async function readChunk(startRow, size) {
    const endRow = Math.min(startRow + size - 1, effectiveRowCount);
    const range = `${tabName}!A${startRow}:${lastCol}${endRow}`;
    let attempt = 0;
    while (true) {
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range,
        });
        return { rows: response.data.values || [], requested: endRow - startRow + 1 };
      } catch (err) {
        const msg = String(err.message || '');
        if (size > MIN_CHUNK_SIZE && /payload size exceeds/i.test(msg)) {
          const half = Math.max(MIN_CHUNK_SIZE, Math.floor(size / 2));
          const left = await readChunk(startRow, half);
          const rightStart = startRow + half;
          if (rightStart > Math.min(startRow + size - 1, effectiveRowCount)) return left;
          const right = await readChunk(rightStart, half);
          return {
            rows: [...left.rows, ...right.rows],
            requested: left.requested + right.requested,
          };
        }
        if (isRateLimitError(err) && attempt < RATE_LIMIT_BACKOFF_MS.length) {
          await sleep(RATE_LIMIT_BACKOFF_MS[attempt]);
          attempt++;
          continue;
        }
        throw err;
      }
    }
  }

  const rawRows = [];
  try {
    let chunkSize = ROW_CHUNK_SIZE;
    for (let startRow = 1; startRow <= effectiveRowCount; startRow += chunkSize) {
      const { rows: chunk, requested } = await readChunk(startRow, chunkSize);
      if (chunk.length === 0 && rawRows.length > 0) break;
      const targetIndex = startRow - 1;
      while (rawRows.length < targetIndex) rawRows.push([]);
      for (let i = 0; i < chunk.length; i++) {
        rawRows[targetIndex + i] = chunk[i];
      }
      if (chunk.length < requested) break;
    }
  } catch (err) {
    await logAction('sheets-connector', 'read-sheet', 'error', {
      sheetId,
      tabName,
      error: err.message,
      metaError,
      columnCount,
      rowCount,
      lastCol,
    });
    const wrapped = new Error(
      `[v2] ${err && err.message ? err.message : String(err)} [probe: cols=${columnCount}, rows=${rowCount}, lastCol=${lastCol}, metaErr=${metaError || 'none'}, raw=${JSON.stringify(err && err.errors ? err.errors : null)}]`
    );
    wrapped.code = err.code;
    wrapped.status = err.status;
    throw wrapped;
  }
  const headerIndex = Math.max(1, Number(headerRow) || 1) - 1;
  const dataStartIndex = Math.max(1, Number(dataStartRow) || 2) - 1;
  const headerCells = rawRows[headerIndex] || [];

  // Google Sheets trims trailing empty cells per row, so the header row may
  // be shorter than data rows. For column-oriented master sheets (each order
  // is a column, with field labels in column A) the header row often only
  // covers the first few orders, which silently caps the order count. Size
  // the column array by the *widest* row in the sheet, then pad missing
  // header cells with synthetic placeholders.
  const maxColumnCount = rawRows.reduce(
    (max, row) => Math.max(max, row.length),
    headerCells.length
  );

  // Preserve original column alignment. Empty/missing header cells are given
  // synthetic names (SYNTHETIC_HEADER_PREFIX + <n>) so data-row indexing
  // stays aligned with the sheet's real columns.
  const rawHeaderNames = [];
  for (let index = 0; index < maxColumnCount; index++) {
    const normalized = normalizeHeader(headerCells[index]);
    rawHeaderNames.push(
      normalized.length > 0 ? normalized : `${SYNTHETIC_HEADER_PREFIX}${index + 1}`
    );
  }

  const uniqueRawHeaders = rawHeaderNames.map((header, index, arr) => {
    const firstIndex = arr.indexOf(header);
    return firstIndex === index ? header : `${header}_${index + 1}`;
  });

  // Visible (caller-facing) headers drop the synthetic placeholders so the
  // Orders page doesn't render ghost columns for blank cells.
  const headers = uniqueRawHeaders.filter((h) => !h.startsWith(SYNTHETIC_HEADER_PREFIX));

  const rows = rawRows
    .slice(dataStartIndex)
    .filter((row) => row.some((cell) => (cell || '').trim() !== ''))
    .map((row, rowIndex) => {
      const obj = { _rowIndex: dataStartIndex + rowIndex + 1 };
      for (let i = 0; i < uniqueRawHeaders.length; i++) {
        obj[uniqueRawHeaders[i]] = (row[i] || '').trim();
      }
      return obj;
    });

  await logAction('sheets-connector', 'read-sheet', 'success', {
    sheetId,
    tabName,
    rowCount: rows.length,
  });

  return { headers, rows };
}

/**
 * Group parsed rows into PO objects. Each unique value of groupKeyColumn
 * becomes one PO. The first row in each group sets vendorName, customerName,
 * date, and status.
 *
 * @param {Array<Object>} rows - Output of readSheetData.
 * @param {string} groupKeyColumn - The field name whose value groups rows
 *   (typically 'orderNumber' from the master sheet).
 * @returns {Array<Object>} Array of PO objects with lines.
 */
function groupByPO(rows, groupKeyColumn) {
  const map = new Map();

  for (const row of rows) {
    const key = row[groupKeyColumn] || '';
    if (!key) continue; // skip rows with no group key

    if (!map.has(key)) {
      map.set(key, {
        groupKey: key,
        orderNumber: row.orderNumber || key,
        vendorName: row.vendorName || '',
        customerName: row.customerName || '',
        customerEmail: row.customerEmail || '',
        date: row.date || '',
        status: row.status || '',
        fulfillmentStatus: row.fulfillmentStatus || '',
        orderTotal: parseFloat(row.orderTotal) || 0,
        lines: [],
      });
    }

    const po = map.get(key);
    const quantity = parseFloat(row.quantity) || 0;
    const unitPrice = parseFloat(row.unitPrice) || 0;

    po.lines.push({
      description: row.itemDescription || '',
      lineItem: row.lineItem || '',
      requiredSize: row.requiredSize || '',
      quantity,
      unit: row.unit || '',
      unitPrice,
      subtotal: parseFloat(row.subtotal) || Math.round(quantity * unitPrice * 100) / 100,
      tilesPerBox: row.tilesPerBox || '',
      tileSizeCoverage: row.tileSizeCoverage || '',
      boxAreaCoverage: row.boxAreaCoverage || '',
    });
  }

  return Array.from(map.values());
}

/**
 * Test whether the configured sheet is accessible by reading the first row.
 *
 * @param {string} sheetId - The Google Sheets spreadsheet ID.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function testConnection(sheetId) {
  try {
    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A1:Z1',
    });
    await logAction('sheets-connector', 'test-connection', 'success', { sheetId });
    return { success: true };
  } catch (err) {
    await logAction('sheets-connector', 'test-connection', 'error', {
      sheetId,
      error: err.message,
    });
    return { success: false, error: err.message };
  }
}

module.exports = { readSheetData, groupByPO, testConnection, getSheetsClient };
