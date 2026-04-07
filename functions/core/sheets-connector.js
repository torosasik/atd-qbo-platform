'use strict';

const { google } = require('googleapis');
const { logAction } = require('./logger');

// Column letter (A-Z) to zero-based index
function colLetterToIndex(letter) {
  return letter.toUpperCase().charCodeAt(0) - 65;
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

  const range = `${tabName}!A:Z`;
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
 * becomes one PO. The first row in each group sets vendorName, date, and memo.
 *
 * @param {Array<Object>} rows - Output of readSheetData.
 * @param {string} groupKeyColumn - The field name whose value groups rows into POs.
 * @returns {Array<Object>} Array of PO objects:
 *   { groupKey, vendorName, date, memo, lines: [{ description, quantity, unitPrice }] }
 */
function groupByPO(rows, groupKeyColumn) {
  const map = new Map();

  for (const row of rows) {
    const key = row[groupKeyColumn] || '';
    if (!key) continue; // skip rows with no group key

    if (!map.has(key)) {
      map.set(key, {
        groupKey: key,
        vendorName: row.vendorName || '',
        date: row.date || '',
        memo: row.memo || '',
        lines: [],
      });
    }

    const po = map.get(key);
    const quantity = parseFloat(row.quantity) || 0;
    const unitPrice = parseFloat(row.unitPrice) || 0;

    po.lines.push({
      description: row.itemDescription || '',
      quantity,
      unitPrice,
      amount: Math.round(quantity * unitPrice * 100) / 100,
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
