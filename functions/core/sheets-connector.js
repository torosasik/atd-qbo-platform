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

// Column letter (A, B, ..., Z, AA, AB, ..., AI) to zero-based index
function colLetterToIndex(letters) {
  const s = letters.toUpperCase();
  let index = 0;
  for (let i = 0; i < s.length; i++) {
    index = index * 26 + (s.charCodeAt(i) - 64);
  }
  return index - 1; // zero-based
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
 * Read data from a Google Sheet and return an array of row objects.
 *
 * @param {string} sheetId - The Google Sheets spreadsheet ID.
 * @param {string} tabName - The sheet tab name (e.g. 'Sheet1').
 * @param {Object} columnMapping - Maps field names to column letters,
 *   e.g. { vendorName: 'A', itemDescription: 'B', quantity: 'C', ... }
 * @returns {Promise<Array<Object>>} Parsed row objects. Row 1 (header) is skipped.
 */
async function readSheetData(sheetId, tabName, columnMapping) {
  const sheets = await getSheetsClient();

  const range = `${tabName}!A:AI`;
  let response;
  try {
    response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range,
    });
  } catch (err) {
    await logAction('sheets-connector', 'read-sheet', 'error', {
      sheetId,
      tabName,
      error: err.message,
    });
    throw err;
  }

  const rawRows = response.data.values || [];
  // Skip header row (index 0), parse remaining rows
  const dataRows = rawRows.slice(1);

  const rows = dataRows
    .filter((row) => row.some((cell) => (cell || '').trim() !== ''))
    .map((row, rowIndex) => {
      const obj = { _rowIndex: rowIndex + 2 }; // 1-based sheet row (header = 1)
      for (const [field, colLetter] of Object.entries(columnMapping)) {
        const idx = colLetterToIndex(colLetter);
        obj[field] = (row[idx] || '').trim();
      }
      return obj;
    });

  await logAction('sheets-connector', 'read-sheet', 'success', {
    sheetId,
    tabName,
    rowCount: rows.length,
  });

  return rows;
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
