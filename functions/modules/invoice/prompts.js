'use strict';

// ---------------------------------------------------------------------------
// buildValidationPrompt
// ---------------------------------------------------------------------------

/**
 * Builds a structured prompt for AI validation of an invoice.
 *
 * @param {object} data - The invoice input data from the app.
 * @param {object[]} customers - Cached customer list from QBO.
 * @param {object[]} items - Cached item list from QBO.
 * @returns {string} Prompt string to send to the AI router.
 */
function buildValidationPrompt(data, customers, items) {
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

  const customerNames = customers
    .slice(0, 20)
    .map((c) => c.DisplayName || c.CompanyName || '(unnamed)')
    .join(', ');

  const itemNames = items
    .slice(0, 20)
    .map((item) => item.Name || '(unnamed)')
    .join(', ');

  const memoSection = data.memo ? `Memo: "${data.memo}"` : 'Memo: (none)';

  return `You are a financial review assistant for American Tile Depot (ATD), a tile and natural stone retailer in Anaheim, California.

Review the following invoice and evaluate it for accuracy, reasonableness, and potential issues.

INVOICE DETAILS:
Customer: ${data.customerName || '(unknown)'}
Date: ${data.txnDate || '(today)'}
${memoSection}
Total: $${total.toFixed(2)}

Line Items:
${linesSummary || '  (no lines provided)'}

AVAILABLE CUSTOMERS IN QUICKBOOKS (first 20):
${customerNames || '(none)'}

AVAILABLE ITEMS IN QUICKBOOKS (first 20):
${itemNames || '(none)'}

REVIEW TASKS:
1. Does the pricing seem reasonable for tile, stone, or building materials? Flag any unit prices that appear unusually high or low for this industry.
2. Are there any unusually high quantities for a single invoice (e.g., hundreds of units for a high-value item)?
3. Based on the line item descriptions, does this look like a legitimate sale for a tile and stone retailer?
4. Does this look like it could be a duplicate submission (same customer, similar amount)? If so, flag it.
5. Is the customer name consistent with a legitimate buyer (contractor, builder, homeowner, business)?

Respond ONLY with a valid JSON object in this exact format, with no additional text before or after:
{
  "flagged": <true if any issue warrants human review before approval, false otherwise>,
  "suggestions": [<array of strings, one per finding or recommendation>],
  "confidence": <number between 0 and 1 representing your confidence in this review>,
  "incomeAccount": "<recommended income account category string>"
}`;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { buildValidationPrompt };
