'use strict';

// ---------------------------------------------------------------------------
// buildValidationPrompt
// ---------------------------------------------------------------------------

/**
 * Builds a structured prompt for AI validation of a purchase order.
 *
 * @param {object} data - The PO input data from the app.
 * @param {object[]} vendors - Cached vendor list from QBO.
 * @param {object[]} items - Cached item list from QBO.
 * @returns {string} Prompt string to send to the AI router.
 */
function buildValidationPrompt(data, vendors, items) {
  const lines = Array.isArray(data.lines) ? data.lines : [];
  const total = lines.reduce((sum, line) => {
    const qty = typeof line.qty === 'number' ? line.qty : 0;
    const unitPrice = typeof line.unitPrice === 'number' ? line.unitPrice : 0;
    return sum + Math.round(qty * unitPrice * 100) / 100;
  }, 0);

  const linesSummary = lines
    .map(
      (line, i) =>
        `  Line ${i + 1}: "${line.description || '(no description)'}", qty: ${line.qty}, unitPrice: $${line.unitPrice}, subtotal: $${Math.round((line.qty || 0) * (line.unitPrice || 0) * 100) / 100}`
    )
    .join('\n');

  const vendorNames = vendors
    .slice(0, 20)
    .map((v) => v.DisplayName || v.CompanyName || '(unnamed)')
    .join(', ');

  const itemNames = items
    .slice(0, 20)
    .map((item) => item.Name || '(unnamed)')
    .join(', ');

  const memoSection = data.memo ? `Memo: "${data.memo}"` : 'Memo: (none)';

  return `You are a financial review assistant for American Tile Depot (ATD), a tile and natural stone retailer in Anaheim, California.

Review the following purchase order and evaluate it for accuracy, reasonableness, and potential issues.

PURCHASE ORDER DETAILS:
Vendor: ${data.vendorName || '(unknown)'}
Date: ${data.txnDate || '(today)'}
${memoSection}
Total: $${total.toFixed(2)}

Line Items:
${linesSummary || '  (no lines provided)'}

AVAILABLE VENDORS IN QUICKBOOKS (first 20):
${vendorNames || '(none)'}

AVAILABLE ITEMS IN QUICKBOOKS (first 20):
${itemNames || '(none)'}

REVIEW TASKS:
1. Does the pricing seem reasonable for tile, stone, or building materials? Flag any unit prices that appear unusually high or low for this industry.
2. Are there any unusually high quantities for a single PO (e.g., hundreds of units for a high-value item)?
3. Based on the line item descriptions, suggest the most appropriate expense account category (e.g., "Cost of Goods Sold", "Office Supplies", "Freight", "Repairs and Maintenance").
4. Does this look like it could be a duplicate submission (same vendor, similar amount to a typical recurring order)? If so, flag it.
5. Is the vendor name consistent with a legitimate tile/stone supplier or trade vendor?

Respond ONLY with a valid JSON object in this exact format, with no additional text before or after:
{
  "flagged": <true if any issue warrants human review before approval, false otherwise>,
  "suggestions": [<array of strings, one per finding or recommendation>],
  "confidence": <number between 0 and 1 representing your confidence in this review>,
  "expenseAccount": "<recommended expense account category string>"
}`;
}

// ---------------------------------------------------------------------------
// buildDuplicateCheckPrompt
// ---------------------------------------------------------------------------

/**
 * Builds a prompt to check if a new PO is a likely duplicate of recent ones.
 *
 * @param {object} data - The new PO input data.
 * @param {object[]} recentPOs - Array of recent PO records (last 10).
 * @returns {string} Prompt string to send to the AI router.
 */
function buildDuplicateCheckPrompt(data, recentPOs) {
  const lines = Array.isArray(data.lines) ? data.lines : [];
  const newTotal = lines.reduce((sum, line) => {
    const qty = typeof line.qty === 'number' ? line.qty : 0;
    const unitPrice = typeof line.unitPrice === 'number' ? line.unitPrice : 0;
    return sum + Math.round(qty * unitPrice * 100) / 100;
  }, 0);

  const newLinesSummary = lines
    .map(
      (line, i) =>
        `  Line ${i + 1}: "${line.description || '(no description)'}", qty: ${line.qty}, unitPrice: $${line.unitPrice}`
    )
    .join('\n');

  const recentList = Array.isArray(recentPOs) ? recentPOs.slice(0, 10) : [];
  const recentSummary = recentList.length === 0
    ? '  (no recent purchase orders found)'
    : recentList
        .map(
          (po, i) =>
            `  PO ${i + 1}: QBO ID ${po.qboId || '(unknown)'}, Vendor: "${po.vendorName || '(unknown)'}", Total: $${typeof po.total === 'number' ? po.total.toFixed(2) : po.total || '0.00'}, Date: ${po.txnDate || po.date || '(unknown)'}`
        )
        .join('\n');

  return `You are a duplicate detection assistant for American Tile Depot (ATD), a tile and natural stone retailer.

Determine whether the following new purchase order is likely a duplicate of one of the recent purchase orders listed below.

NEW PURCHASE ORDER:
Vendor: ${data.vendorName || '(unknown)'}
Date: ${data.txnDate || '(today)'}
Total: $${newTotal.toFixed(2)}
Line Items:
${newLinesSummary || '  (no lines provided)'}

RECENT PURCHASE ORDERS (last 10):
${recentSummary}

EVALUATION CRITERIA:
- A duplicate is likely if: same vendor, total amount is within 5% of a recent PO, and the submission date is within 7 days of the recent PO date.
- A duplicate is possible if: same vendor and very similar total, but submitted more than 7 days apart (could be a recurring order, flag with lower confidence).
- If the vendor differs entirely, it is not a duplicate.

Respond ONLY with a valid JSON object in this exact format, with no additional text before or after:
{
  "isDuplicate": <true if this is likely or possibly a duplicate, false otherwise>,
  "confidence": <number between 0 and 1>,
  "matchedPoId": <"QBO ID string of the matched PO, or null if no match">,
  "reason": "<brief explanation of your determination>"
}`;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { buildValidationPrompt, buildDuplicateCheckPrompt };
