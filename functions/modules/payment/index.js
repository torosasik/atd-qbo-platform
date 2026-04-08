'use strict';

const fetch = require('node-fetch');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { logAction } = require('../../core/logger');
const { getValidAccessToken, getRealmId, getQboBaseUrl, ensureValidToken } = require('../../core/qbo-auth');
const { getCachedCustomers, fetchOpenInvoices } = require('../../core/cache');
const { askAI } = require('../../core/ai-router');
const { buildValidationPrompt } = require('./prompts');

// ---------------------------------------------------------------------------
// validate
// ---------------------------------------------------------------------------

async function validate(data, realmId) {
  // Work on a deep copy to avoid mutating the caller's object
  const d = JSON.parse(JSON.stringify(data));
  const errors = [];
  const warnings = [];

  // Normalize date field: accept both d.date (new) and d.txnDate (legacy)
  if (d.date && !d.txnDate) {
    d.txnDate = d.date;
  }

  // Required: customer
  if (!d.customerId && (!d.customerName || typeof d.customerName !== 'string' || d.customerName.trim() === '')) {
    errors.push('customerId or customerName is required');
  }

  // Required: totalAmount must be a positive number
  if (typeof d.totalAmount !== 'number' || d.totalAmount <= 0) {
    errors.push('totalAmount must be a positive number');
  }

  // Lines (invoice applications) — at least one required
  if (!Array.isArray(d.lines) || d.lines.length === 0) {
    errors.push('lines must be an array with at least one invoice application');
  } else {
    d.lines.forEach((line, i) => {
      if (!line.invoiceId) {
        errors.push(`lines[${i}].invoiceId is required (QBO Invoice ID)`);
      }
      if (typeof line.amount !== 'number' || line.amount <= 0) {
        errors.push(`lines[${i}].amount must be a positive number`);
      }
    });

    // Validate sum of line amounts equals totalAmount (within rounding tolerance)
    const lineSum = d.lines.reduce((sum, line) => {
      return sum + (typeof line.amount === 'number' ? line.amount : 0);
    }, 0);
    const roundedLineSum = Math.round(lineSum * 100) / 100;
    const roundedTotal = Math.round((d.totalAmount || 0) * 100) / 100;

    if (Math.abs(roundedLineSum - roundedTotal) > 0.01) {
      // Allow unapplied amount (line sum < total) but warn
      if (roundedLineSum < roundedTotal) {
        warnings.push(
          `Sum of applied amounts ($${roundedLineSum.toFixed(2)}) is less than totalAmount ($${roundedTotal.toFixed(2)}). Unapplied amount: $${(roundedTotal - roundedLineSum).toFixed(2)}`
        );
      } else {
        errors.push(
          `Sum of applied amounts ($${roundedLineSum.toFixed(2)}) exceeds totalAmount ($${roundedTotal.toFixed(2)})`
        );
      }
    }
  }

  // Customer matching: prefer customerId (direct QBO ID) over name lookup
  const customers = await getCachedCustomers(realmId);
  if (d.customerId) {
    const matchedCustomer = customers.find((c) => String(c.Id) === String(d.customerId));
    if (!matchedCustomer) {
      errors.push(`Customer ID '${d.customerId}' not found in QuickBooks. Try syncing your customer list.`);
    } else {
      d._matchedCustomer = matchedCustomer;
    }
  } else if (d.customerName && d.customerName.trim() !== '') {
    const normalizedInput = d.customerName.trim().toLowerCase();
    const matchedCustomer = customers.find((c) => {
      const displayName = (c.DisplayName || '').trim().toLowerCase();
      const companyName = (c.CompanyName || '').trim().toLowerCase();
      return displayName === normalizedInput || companyName === normalizedInput;
    });

    if (!matchedCustomer) {
      errors.push(`Customer '${d.customerName}' not found in QuickBooks`);
    } else {
      d._matchedCustomer = matchedCustomer;
    }
  }

  // Validate linked invoices exist and are open
  if (d._matchedCustomer && Array.isArray(d.lines) && d.lines.length > 0) {
    try {
      const openInvoices = await fetchOpenInvoices(realmId, String(d._matchedCustomer.Id));
      const openInvoiceIds = new Set(openInvoices.map((inv) => String(inv.Id)));

      d.lines.forEach((line, i) => {
        if (line.invoiceId && !openInvoiceIds.has(String(line.invoiceId))) {
          errors.push(`lines[${i}].invoiceId '${line.invoiceId}' is not an open invoice for this customer`);
        }
        // Check if applied amount exceeds invoice balance
        if (line.invoiceId) {
          const invoice = openInvoices.find((inv) => String(inv.Id) === String(line.invoiceId));
          if (invoice && typeof line.amount === 'number' && line.amount > invoice.Balance) {
            warnings.push(
              `lines[${i}]: Applied amount ($${line.amount.toFixed(2)}) exceeds invoice balance ($${invoice.Balance.toFixed(2)})`
            );
          }
        }
      });

      d._openInvoices = openInvoices;
    } catch (err) {
      warnings.push(`Could not validate open invoices: ${err.message}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings, data: d };
}

// ---------------------------------------------------------------------------
// aiReview
// ---------------------------------------------------------------------------

async function aiReview(data, realmId) {
  const customers = await getCachedCustomers(realmId);
  let openInvoices = [];
  if (data._matchedCustomer) {
    try {
      openInvoices = await fetchOpenInvoices(realmId, String(data._matchedCustomer.Id));
    } catch (_err) {
      // Non-fatal: AI review can proceed without invoice list
    }
  }

  const prompt = buildValidationPrompt(data, customers, openInvoices);
  const aiResult = await askAI(prompt, { module: 'payment' });

  if (!aiResult || aiResult.source === 'none') {
    return { aiResult: null, flagged: false, suggestions: [] };
  }

  let flagged = false;
  let suggestions = [];
  let parsed = null;

  try {
    // Extract first JSON object from the answer string
    const jsonMatch = (aiResult.answer || '').match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
      flagged = Boolean(parsed.flagged);
      suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    } else {
      suggestions = [aiResult.answer];
    }
  } catch (_err) {
    suggestions = [aiResult.answer || 'AI returned an unreadable response.'];
  }

  await logAction('payment', 'ai-review', flagged ? 'flagged' : 'clean', {
    customerName: data.customerName,
    totalAmount: data.totalAmount,
    flagged,
    suggestions,
    confidence: parsed ? parsed.confidence : null,
    aiSource: aiResult.source,
  });

  return { aiResult: parsed || aiResult, flagged, suggestions };
}

// ---------------------------------------------------------------------------
// stripInternalFields
// ---------------------------------------------------------------------------

function stripInternalFields(data) {
  const clean = { ...data };
  delete clean._matchedCustomer;
  delete clean._openInvoices;
  return clean;
}

// ---------------------------------------------------------------------------
// buildPayload
// ---------------------------------------------------------------------------

function buildPayload(data, matchedCustomer) {
  const today = new Date().toISOString().split('T')[0];
  const txnDate = data.txnDate || data.date || today;

  const lines = data.lines.map((line) => ({
    Amount: Math.round((line.amount || 0) * 100) / 100,
    LinkedTxn: [
      {
        TxnId: String(line.invoiceId),
        TxnType: 'Invoice',
      },
    ],
  }));

  const payload = {
    CustomerRef: {
      value: String(matchedCustomer.Id),
      name: matchedCustomer.DisplayName,
    },
    TotalAmt: Math.round((data.totalAmount || 0) * 100) / 100,
    TxnDate: txnDate,
    PrivateNote: data.memo || '',
    Line: lines,
  };

  // PaymentMethodRef — optional
  if (data.paymentMethod && typeof data.paymentMethod === 'string' && data.paymentMethod.trim() !== '') {
    payload.PaymentMethodRef = { value: data.paymentMethod.trim() };
  }

  // PaymentRefNum — reference number (check number, etc.)
  if (data.referenceNumber && typeof data.referenceNumber === 'string' && data.referenceNumber.trim() !== '') {
    payload.PaymentRefNum = data.referenceNumber.trim();
  }

  return payload;
}

// ---------------------------------------------------------------------------
// pushToQBO
// ---------------------------------------------------------------------------

async function pushToQBO(payload, realmId) {
  let intuitTid = null;

  try {
    const accessToken = await getValidAccessToken();
    const baseUrl = await getQboBaseUrl();
    const url = `${baseUrl}/v3/company/${realmId}/payment?minorversion=65`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    intuitTid = response.headers.get('intuit_tid');

    if (!response.ok) {
      let errorBody = {};
      try {
        errorBody = await response.json();
      } catch (_e) {
        errorBody = { raw: await response.text() };
      }

      const errorMessage = errorBody?.Fault?.Error?.[0]?.Detail || errorBody?.Fault?.Error?.[0]?.Message || `HTTP ${response.status}`;

      await logAction('payment', 'push-to-qbo', 'error', {
        intuitTid,
        httpStatus: response.status,
        errorMessage,
        customerRef: payload.CustomerRef,
      });

      return { success: false, error: errorMessage, intuitTid };
    }

    const responseBody = await response.json();
    const entityId = responseBody?.Payment?.Id;

    const qboTotal = responseBody?.Payment?.TotalAmt;
    await logAction('payment', 'push-to-qbo', 'success', {
      intuitTid,
      entityId,
      customerName: payload.CustomerRef?.name || null,
      total: qboTotal != null ? qboTotal : null,
    });

    return { success: true, data: responseBody.Payment, intuitTid };
  } catch (err) {
    await logAction('payment', 'push-to-qbo', 'error', {
      intuitTid,
      errorMessage: err.message,
      customerName: payload.CustomerRef?.name || null,
    });

    return { success: false, error: err.message, intuitTid };
  }
}

// ---------------------------------------------------------------------------
// handleCreate
// ---------------------------------------------------------------------------

async function handleCreate(req, res) {
  try {
    const realmId = await getRealmId();
    const data = req.body;

    // Normalize frontend payload: accept both new and legacy field names
    if (data.date && !data.txnDate) {
      data.txnDate = data.date;
    }

    // Step 1: Validate
    const { valid, errors, warnings, data: validatedData } = await validate(data, realmId);
    if (!valid) {
      return res.status(400).json({ success: false, errors, warnings });
    }
    const resolvedData = validatedData;

    // Step 2: AI Review (opt-out via aiEnabled: false)
    let aiReviewResult = { aiResult: null, flagged: false, suggestions: [] };
    if (resolvedData.aiEnabled !== false) {
      aiReviewResult = await aiReview(resolvedData, realmId);
    }

    // Step 3: Auto-approve path
    if (resolvedData.autoApprove === true) {
      const payload = buildPayload(resolvedData, resolvedData._matchedCustomer);
      const result = await pushToQBO(payload, realmId);

      return res.status(result.success ? 200 : 502).json({
        ...result,
        warnings,
        aiReview: aiReviewResult,
      });
    }

    // Step 4: Draft path — strip internal cache references before persisting
    const draftPayload = stripInternalFields(resolvedData);
    const db = getFirestore();
    const docRef = await db.collection('payment_drafts').add({
      ...draftPayload,
      aiReview: aiReviewResult,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      success: true,
      draftId: docRef.id,
      aiReview: aiReviewResult,
      warnings,
      message: 'Draft saved. Awaiting approval.',
    });
  } catch (err) {
    await logAction('payment', 'handle-create', 'error', { errorMessage: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ---------------------------------------------------------------------------
// handleApproveDraft
// ---------------------------------------------------------------------------

async function handleApproveDraft(req, res) {
  try {
    const { draftId } = req.params;
    const db = getFirestore();
    const draftRef = db.collection('payment_drafts').doc(draftId);
    const draftSnap = await draftRef.get();

    if (!draftSnap.exists) {
      return res.status(404).json({ success: false, error: `Draft '${draftId}' not found` });
    }

    const draft = draftSnap.data();

    if (draft.status !== 'pending') {
      return res.status(409).json({ success: false, error: 'Draft already processed' });
    }

    const data = draft;
    const realmId = await getRealmId();

    // Re-validate customer reference in case cache changed
    if (!data._matchedCustomer) {
      const customers = await getCachedCustomers(realmId);
      if (data.customerId) {
        data._matchedCustomer = customers.find((c) => String(c.Id) === String(data.customerId));
      } else {
        const normalizedInput = (data.customerName || '').trim().toLowerCase();
        data._matchedCustomer = customers.find((c) => {
          const displayName = (c.DisplayName || '').trim().toLowerCase();
          const companyName = (c.CompanyName || '').trim().toLowerCase();
          return displayName === normalizedInput || companyName === normalizedInput;
        });
      }

      if (!data._matchedCustomer) {
        return res.status(400).json({
          success: false,
          error: `Customer '${data.customerName || data.customerId}' not found in QuickBooks. Re-submit the draft after syncing the customer list.`,
        });
      }
    }

    const payload = buildPayload(data, data._matchedCustomer);
    const result = await pushToQBO(payload, realmId);

    if (result.success) {
      await draftRef.update({
        status: 'completed',
        qboEntityId: result.data.Id,
        approvedAt: FieldValue.serverTimestamp(),
      });
    }

    return res.status(result.success ? 200 : 502).json(result);
  } catch (err) {
    await logAction('payment', 'handle-approve-draft', 'error', { errorMessage: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { validate, aiReview, buildPayload, pushToQBO, handleCreate, handleApproveDraft };
