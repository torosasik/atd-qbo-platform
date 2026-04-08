'use strict';

const fetch = require('node-fetch');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { logAction } = require('../../core/logger');
const { getValidAccessToken, getRealmId, getQboBaseUrl, ensureValidToken } = require('../../core/qbo-auth');
const { getCachedAccounts, fetchUncategorizedExpenses } = require('../../core/cache');
const { askAI } = require('../../core/ai-router');
const { buildCategorizationPrompt } = require('./prompts');

// ---------------------------------------------------------------------------
// fetchUncategorized — handler for GET /expenses/uncategorized
// ---------------------------------------------------------------------------

async function handleFetchExpenses(req, res) {
  try {
    const realmId = await getRealmId();
    const expenses = await fetchUncategorizedExpenses(realmId);

    // Normalize expenses for the frontend
    const normalized = expenses.map((exp) => ({
      id: exp.Id,
      syncToken: exp.SyncToken,
      txnDate: exp.TxnDate || null,
      vendorName: exp.EntityRef?.name || exp.EntityRef?.value || '(unknown)',
      vendorId: exp.EntityRef?.value || null,
      totalAmount: exp.TotalAmt || 0,
      memo: exp.PrivateNote || '',
      lines: (exp.Line || [])
        .filter((l) => l.DetailType === 'AccountBasedExpenseLineDetail' || l.DetailType === 'ItemBasedExpenseLineDetail')
        .map((l) => ({
          description: l.Description || '',
          amount: l.Amount || 0,
          accountId: l.AccountBasedExpenseLineDetail?.AccountRef?.value || null,
          accountName: l.AccountBasedExpenseLineDetail?.AccountRef?.name || '(uncategorized)',
        })),
      _raw: exp, // Keep raw for categorization
    }));

    await logAction('expense', 'fetch-uncategorized', 'success', {
      realmId,
      count: normalized.length,
    });

    return res.status(200).json({ success: true, expenses: normalized });
  } catch (err) {
    await logAction('expense', 'fetch-uncategorized', 'error', {
      error: err.message,
    });
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ---------------------------------------------------------------------------
// aiCategorize — AI suggests account category for an expense
// ---------------------------------------------------------------------------

async function aiCategorize(expense, accounts) {
  const prompt = buildCategorizationPrompt(expense, accounts);

  const aiResponse = await askAI(prompt, {
    module: 'expense',
    action: 'categorize',
  });

  // Parse JSON from AI response
  try {
    const responseText = typeof aiResponse === 'string' ? aiResponse : aiResponse.reply || aiResponse.text || JSON.stringify(aiResponse);
    // Extract JSON from potential markdown code blocks
    const jsonMatch = responseText.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      throw new Error('No JSON object found in AI response');
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      suggestedAccountId: parsed.suggestedAccountId || null,
      suggestedAccountName: parsed.suggestedAccountName || null,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      reasoning: parsed.reasoning || '',
    };
  } catch (parseErr) {
    console.error('[aiCategorize] Failed to parse AI response:', parseErr.message);
    return {
      suggestedAccountId: null,
      suggestedAccountName: null,
      confidence: 0,
      reasoning: 'AI response could not be parsed. Please categorize manually.',
    };
  }
}

// ---------------------------------------------------------------------------
// handleCategorize — POST /expenses/categorize
// Body: { expenseId, suggestedAccountId? }
// If suggestedAccountId is provided, use manual categorization.
// Otherwise, use AI to suggest a category.
// ---------------------------------------------------------------------------

async function handleCategorize(req, res) {
  try {
    const { expenseId, suggestedAccountId } = req.body;

    if (!expenseId) {
      return res.status(400).json({ success: false, error: 'expenseId is required' });
    }

    const realmId = await getRealmId();
    const accounts = await getCachedAccounts(realmId);

    // Fetch the specific expense from QBO
    const accessToken = await getValidAccessToken();
    const qboBaseUrl = await getQboBaseUrl();
    const expenseUrl = `${qboBaseUrl}/v3/company/${realmId}/purchase/${expenseId}?minorversion=65`;

    const expenseRes = await fetch(expenseUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!expenseRes.ok) {
      const errBody = await expenseRes.text();
      throw new Error(`Failed to fetch expense ${expenseId}: ${expenseRes.status} - ${errBody}`);
    }

    const expenseData = await expenseRes.json();
    const expense = expenseData.Purchase;

    if (!expense) {
      return res.status(404).json({ success: false, error: `Expense ${expenseId} not found in QBO` });
    }

    let categorization;

    if (suggestedAccountId) {
      // Manual categorization — validate account exists
      const matchedAccount = accounts.find((a) => String(a.Id) === String(suggestedAccountId));
      if (!matchedAccount) {
        return res.status(400).json({ success: false, error: `Account ID '${suggestedAccountId}' not found in QBO` });
      }
      categorization = {
        suggestedAccountId: String(matchedAccount.Id),
        suggestedAccountName: matchedAccount.Name,
        confidence: 1.0,
        reasoning: 'Manually selected by user',
        source: 'manual',
      };
    } else {
      // AI categorization
      categorization = await aiCategorize(expense, accounts);
      categorization.source = 'ai';

      // Validate AI-suggested account exists
      if (categorization.suggestedAccountId) {
        const matchedAccount = accounts.find((a) => String(a.Id) === String(categorization.suggestedAccountId));
        if (!matchedAccount) {
          categorization.suggestedAccountId = null;
          categorization.suggestedAccountName = null;
          categorization.confidence = 0;
          categorization.reasoning += ' (AI suggested account not found in QBO accounts list)';
        }
      }
    }

    // Create draft in Firestore
    const db = getFirestore();
    const draftData = {
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      realmId,
      expenseId: String(expense.Id),
      syncToken: expense.SyncToken,
      vendorName: expense.EntityRef?.name || expense.EntityRef?.value || '(unknown)',
      vendorId: expense.EntityRef?.value || null,
      totalAmount: expense.TotalAmt || 0,
      txnDate: expense.TxnDate || null,
      memo: expense.PrivateNote || '',
      suggestedAccountId: categorization.suggestedAccountId,
      suggestedAccountName: categorization.suggestedAccountName,
      confidence: categorization.confidence,
      reasoning: categorization.reasoning,
      source: categorization.source,
    };

    const draftRef = await db.collection('expense_drafts').add(draftData);

    await logAction('expense', 'categorize', 'success', {
      realmId,
      expenseId,
      draftId: draftRef.id,
      source: categorization.source,
      suggestedAccountName: categorization.suggestedAccountName,
      confidence: categorization.confidence,
    });

    return res.status(200).json({
      success: true,
      draft: {
        id: draftRef.id,
        ...draftData,
        createdAt: new Date().toISOString(), // Approximate since server timestamp is pending
      },
    });
  } catch (err) {
    await logAction('expense', 'categorize', 'error', { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ---------------------------------------------------------------------------
// handleApproveDraft — POST /expenses/drafts/:id/approve
// Updates the expense in QBO with the suggested account category.
// ---------------------------------------------------------------------------

async function handleApproveDraft(req, res) {
  try {
    const { id } = req.params;
    const db = getFirestore();
    const draftRef = db.collection('expense_drafts').doc(id);
    const draftSnap = await draftRef.get();

    if (!draftSnap.exists) {
      return res.status(404).json({ success: false, error: `Draft '${id}' not found` });
    }

    const draft = draftSnap.data();

    if (draft.status !== 'pending') {
      return res.status(409).json({ success: false, error: 'Draft has already been processed' });
    }

    if (!draft.suggestedAccountId) {
      return res.status(400).json({ success: false, error: 'No account suggestion to apply. Categorize first.' });
    }

    const realmId = draft.realmId || (await getRealmId());
    const accessToken = await getValidAccessToken();
    const qboBaseUrl = await getQboBaseUrl();

    // Fetch current expense from QBO to get latest SyncToken
    const getUrl = `${qboBaseUrl}/v3/company/${realmId}/purchase/${draft.expenseId}?minorversion=65`;
    const getRes = await fetch(getUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!getRes.ok) {
      const errBody = await getRes.text();
      throw new Error(`Failed to fetch expense for update: ${getRes.status} - ${errBody}`);
    }

    const currentData = await getRes.json();
    const currentExpense = currentData.Purchase;

    if (!currentExpense) {
      throw new Error(`Expense ${draft.expenseId} not found in QBO`);
    }

    // Update the AccountRef on each line that is uncategorized
    const updatedLines = (currentExpense.Line || []).map((line) => {
      if (line.DetailType === 'AccountBasedExpenseLineDetail') {
        const acctRef = line.AccountBasedExpenseLineDetail?.AccountRef;
        // Update lines that have no account or have "Uncategorized Expense" type account
        if (!acctRef || !acctRef.value || acctRef.name === 'Uncategorized Expense') {
          return {
            ...line,
            AccountBasedExpenseLineDetail: {
              ...line.AccountBasedExpenseLineDetail,
              AccountRef: {
                value: draft.suggestedAccountId,
                name: draft.suggestedAccountName,
              },
            },
          };
        }
      }
      return line;
    });

    // Build update payload — sparse update with required fields
    const updatePayload = {
      Id: currentExpense.Id,
      SyncToken: currentExpense.SyncToken,
      Line: updatedLines,
      PaymentType: currentExpense.PaymentType,
      AccountRef: currentExpense.AccountRef,
      EntityRef: currentExpense.EntityRef,
    };

    // POST update to QBO
    const updateUrl = `${qboBaseUrl}/v3/company/${realmId}/purchase?minorversion=65`;
    const updateRes = await fetch(updateUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    });

    const intuitTid = updateRes.headers.get('intuit_tid');

    if (!updateRes.ok) {
      const errBody = await updateRes.text();
      await draftRef.update({
        status: 'error',
        errorMessage: `QBO update failed: ${updateRes.status} - ${errBody}`,
        errorAt: FieldValue.serverTimestamp(),
      });

      await logAction('expense', 'push-to-qbo', 'error', {
        draftId: id,
        expenseId: draft.expenseId,
        error: errBody,
        intuitTid,
      });

      throw new Error(`QBO update failed: ${updateRes.status} - ${errBody}`);
    }

    const updatedExpense = await updateRes.json();

    // Mark draft as approved
    await draftRef.update({
      status: 'approved',
      approvedAt: FieldValue.serverTimestamp(),
      qboSyncToken: updatedExpense.Purchase?.SyncToken || null,
      intuitTid,
    });

    await logAction('expense', 'push-to-qbo', 'success', {
      draftId: id,
      expenseId: draft.expenseId,
      accountId: draft.suggestedAccountId,
      accountName: draft.suggestedAccountName,
      vendorName: draft.vendorName,
      total: draft.totalAmount,
      intuitTid,
    });

    return res.status(200).json({
      success: true,
      message: `Expense categorized as "${draft.suggestedAccountName}" in QuickBooks`,
      entityId: draft.expenseId,
      intuitTid,
    });
  } catch (err) {
    await logAction('expense', 'approve-draft', 'error', { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ---------------------------------------------------------------------------
// handleRejectDraft — POST /expenses/drafts/:id/reject
// ---------------------------------------------------------------------------

async function handleRejectDraft(req, res) {
  try {
    const { id } = req.params;
    const db = getFirestore();
    const draftRef = db.collection('expense_drafts').doc(id);
    const draftSnap = await draftRef.get();

    if (!draftSnap.exists) {
      return res.status(404).json({ success: false, error: `Draft '${id}' not found` });
    }

    const draft = draftSnap.data();
    if (draft.status !== 'pending') {
      return res.status(409).json({ success: false, error: 'Draft has already been processed' });
    }

    await draftRef.update({
      status: 'rejected',
      rejectedAt: FieldValue.serverTimestamp(),
    });

    await logAction('expense', 'reject-draft', 'success', { draftId: id });

    return res.status(200).json({ success: true, message: 'Draft rejected.' });
  } catch (err) {
    await logAction('expense', 'reject-draft', 'error', { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  handleFetchExpenses,
  handleCategorize,
  handleApproveDraft,
  handleRejectDraft,
};
