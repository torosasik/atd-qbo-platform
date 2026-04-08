'use strict';

// ---------------------------------------------------------------------------
// buildValidationPrompt
// ---------------------------------------------------------------------------

/**
 * Builds a structured prompt for AI validation of a payment.
 *
 * @param {object} data - The payment input data from the app.
 * @param {object[]} customers - Cached customer list from QBO.
 * @param {object[]} openInvoices - Open invoices for the selected customer.
 * @returns {string} Prompt string to send to the AI router.
 */
function buildValidationPrompt(data, customers, openInvoices) {
  const lines = Array.isArray(data.lines) ? data.lines : [];
  const totalApplied = lines.reduce((sum, line) => {
    const amount = typeof line.amount === 'number' ? line.amount : 0;
    return sum + Math.round(amount * 100) / 100;
  }, 0);

  const linesSummary = lines
    .map(
      (line, i) =>
        `  Line ${i + 1}: Invoice #${line.invoiceId || '(unknown)'} — Applied: $${(line.amount || 0).toFixed(2)}`
    )
    .join('\n');

  const customerNames = customers
    .slice(0, 20)
    .map((c) => c.DisplayName || c.CompanyName || '(unnamed)')
    .join(', ');

  const openInvoiceSummary = openInvoices
    .slice(0, 20)
    .map(
      (inv) =>
        `  Invoice #${inv.DocNumber || inv.Id}: Balance $${(inv.Balance || 0).toFixed(2)}, Due ${inv.DueDate || '(unknown)'}`
    )
    .join('\n');

  const memoSection = data.memo ? `Memo: "${data.memo}"` : 'Memo: (none)';
  const refSection = data.referenceNumber ? `Reference #: "${data.referenceNumber}"` : 'Reference #: (none)';

  return `You are a financial review assistant for American Tile Depot (ATD), a tile and natural stone retailer in Anaheim, California.

Review the following payment and evaluate it for accuracy, reasonableness, and potential issues.

PAYMENT DETAILS:
Customer: ${data.customerName || '(unknown)'}
Payment Amount: $${(data.totalAmount || 0).toFixed(2)}
Payment Method: ${data.paymentMethod || '(not specified)'}
${refSection}
${memoSection}
Date: ${data.txnDate || '(today)'}
Total Applied to Invoices: $${totalApplied.toFixed(2)}
Unapplied Amount: $${((data.totalAmount || 0) - totalApplied).toFixed(2)}

Applied to Invoices:
${linesSummary || '  (no invoice lines provided)'}

CUSTOMER'S OPEN INVOICES IN QUICKBOOKS (first 20):
${openInvoiceSummary || '  (none)'}

AVAILABLE CUSTOMERS IN QUICKBOOKS (first 20):
${customerNames || '(none)'}

REVIEW TASKS:
1. Does the payment amount seem reasonable? Flag any unusually large payments.
2. Are the applied amounts consistent with the invoice balances? Flag overpayments on individual invoices.
3. Is there a large unapplied amount that might indicate a data entry error?
4. Does the payment method match the reference number pattern? (e.g., Check should have a check number)
5. Does this look like it could be a duplicate payment (same customer, similar amount)?
6. Is the customer name consistent with a legitimate buyer?

Respond ONLY with a valid JSON object in this exact format, with no additional text before or after:
{
  "flagged": <true if any issue warrants human review before approval, false otherwise>,
  "suggestions": [<array of strings, one per finding or recommendation>],
  "confidence": <number between 0 and 1 representing your confidence in this review>
}`;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { buildValidationPrompt };
