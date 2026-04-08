'use strict';

// ---------------------------------------------------------------------------
// buildCategorizationPrompt
// ---------------------------------------------------------------------------

/**
 * Builds a structured prompt for AI categorization of an uncategorized expense.
 *
 * @param {object} expense - The QBO Purchase/Expense object.
 * @param {object[]} accounts - Cached account list from QBO (expense-type accounts).
 * @returns {string} Prompt string to send to the AI router.
 */
function buildCategorizationPrompt(expense, accounts) {
  const vendorName = expense.EntityRef?.name || expense.EntityRef?.value || '(unknown vendor)';
  const totalAmount = expense.TotalAmt || 0;
  const txnDate = expense.TxnDate || '(unknown date)';
  const memo = expense.PrivateNote || '';

  // Summarize line items
  const lines = expense.Line || [];
  const linesSummary = lines
    .filter((line) => line.DetailType === 'AccountBasedExpenseLineDetail' || line.DetailType === 'ItemBasedExpenseLineDetail')
    .map((line, i) => {
      const desc = line.Description || '(no description)';
      const amount = line.Amount || 0;
      const acctName = line.AccountBasedExpenseLineDetail?.AccountRef?.name || '(uncategorized)';
      return `  Line ${i + 1}: "${desc}", amount: $${amount}, current account: ${acctName}`;
    })
    .join('\n');

  // Build account list for AI reference (expense-type accounts only)
  const expenseAccounts = accounts
    .filter((a) => {
      const type = (a.AccountType || '').toLowerCase();
      return type === 'expense' || type === 'cost of goods sold' || type === 'other expense';
    })
    .slice(0, 50)
    .map((a) => `  - "${a.Name}" (ID: ${a.Id}, Type: ${a.AccountType})`)
    .join('\n');

  return `You are a financial categorization assistant for American Tile Depot (ATD), a tile and natural stone retailer in Anaheim, California.

Analyze the following uncategorized expense and suggest the most appropriate expense account category.

EXPENSE DETAILS:
Vendor: ${vendorName}
Date: ${txnDate}
Total Amount: $${totalAmount.toFixed(2)}
Memo: ${memo || '(none)'}

LINE ITEMS:
${linesSummary || '  (no line details available)'}

AVAILABLE EXPENSE ACCOUNTS:
${expenseAccounts || '  (no accounts available)'}

INSTRUCTIONS:
1. Based on the vendor name, amount, description, and memo, suggest the best matching expense account.
2. Consider the business context (tile/stone retailer) when categorizing.
3. Common categories for this business: materials/supplies, shipping/freight, utilities, rent, insurance, office supplies, advertising, professional services, etc.
4. If multiple lines exist, suggest a category for the overall expense (the primary/dominant category).

Respond in EXACTLY this JSON format (no markdown, no extra text):
{
  "suggestedAccountId": "<QBO Account ID>",
  "suggestedAccountName": "<Account Name>",
  "confidence": <0.0 to 1.0>,
  "reasoning": "<brief explanation of why this category was chosen>"
}`;
}

module.exports = {
  buildCategorizationPrompt,
};
