'use strict';

const fetch = require('node-fetch');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { logAction } = require('../../core/logger');
const { getValidAccessToken, getRealmId, getQboBaseUrl } = require('../../core/qbo-auth');
const { getCachedCustomers, getCachedItems } = require('../../core/cache');
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

  // Required top-level fields: accept customerId (from dropdown) or customerName (legacy)
  if (!d.customerId && (!d.customerName || typeof d.customerName !== 'string' || d.customerName.trim() === '')) {
    errors.push('customerId or customerName is required');
  }

  if (!Array.isArray(d.lines) || d.lines.length === 0) {
    errors.push('lines must be an array with at least one item');
  } else {
    d.lines.forEach((line, i) => {
      if (!line.description || typeof line.description !== 'string' || line.description.trim() === '') {
        errors.push(`lines[${i}].description is required and must be a non-empty string`);
      }
      const qty = line.quantity !== undefined ? line.quantity : line.qty;
      if (typeof qty !== 'number' || qty <= 0) {
        errors.push(`lines[${i}].quantity/qty must be a number greater than 0`);
      }
      if (typeof line.unitPrice !== 'number' || line.unitPrice < 0) {
        errors.push(`lines[${i}].unitPrice must be a number greater than or equal to 0`);
      }
    });
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

  // Item matching: prefer itemId (direct QBO ID) over name lookup
  if (Array.isArray(d.lines)) {
    const items = await getCachedItems(realmId);
    d.lines.forEach((line, i) => {
      if (line.itemId) {
        const matchedItem = items.find((item) => String(item.Id) === String(line.itemId));
        if (!matchedItem) {
          warnings.push(`lines[${i}].itemId '${line.itemId}' not found in QuickBooks items. A fallback ItemRef will be used.`);
        } else {
          line._matchedItem = matchedItem;
        }
      } else if (line.itemName) {
        const normalizedItemName = line.itemName.trim().toLowerCase();
        const matchedItem = items.find((item) => (item.Name || '').trim().toLowerCase() === normalizedItemName);
        if (!matchedItem) {
          warnings.push(`lines[${i}].itemName '${line.itemName}' not found in QuickBooks items. A fallback ItemRef will be used.`);
        } else {
          line._matchedItem = matchedItem;
        }
      }
    });
  }

  return { valid: errors.length === 0, errors, warnings, data: d };
}

// ---------------------------------------------------------------------------
// aiReview
// ---------------------------------------------------------------------------

async function aiReview(data, realmId) {
  const customers = await getCachedCustomers(realmId);
  const items = await getCachedItems(realmId);

  const prompt = buildValidationPrompt(data, customers, items);
  const aiResult = await askAI(prompt, { module: 'invoice' });

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

  await logAction('invoice', 'ai-review', flagged ? 'flagged' : 'clean', {
    customerName: data.customerName,
    flagged,
    suggestions,
    confidence: parsed ? parsed.confidence : null,
    aiSource: aiResult.source,
  });

  return { aiResult: parsed || aiResult, flagged, suggestions };
}

// ---------------------------------------------------------------------------
// stripInternalFields
// Remove internal cache reference fields (prefixed with _) before persisting
// to Firestore.
// ---------------------------------------------------------------------------

function stripInternalFields(data) {
  const clean = { ...data };
  delete clean._matchedCustomer;
  if (Array.isArray(clean.lines)) {
    clean.lines = clean.lines.map((line) => {
      const cleanLine = { ...line };
      delete cleanLine._matchedItem;
      return cleanLine;
    });
  }
  return clean;
}

// ---------------------------------------------------------------------------
// buildPayload
// ---------------------------------------------------------------------------

function buildPayload(data, matchedCustomer) {
  const today = new Date().toISOString().split('T')[0];
  const txnDate = data.txnDate || data.date || today;

  const lines = data.lines.map((line) => {
    const qty = line.quantity || line.qty;
    const amount = Math.round(qty * line.unitPrice * 100) / 100;
    const itemRef = line._matchedItem
      ? { value: String(line._matchedItem.Id), name: line._matchedItem.Name }
      : { value: '1', name: line.description };

    // Build description with optional SKU and unit info
    let description = line.description || '';
    const hasSku = line.sku && typeof line.sku === 'string' && line.sku.trim() !== '';
    const hasUnit = line.unit && typeof line.unit === 'string' && line.unit.trim() !== '';

    if (hasSku && hasUnit) {
      description = `${description} - ${line.sku} (${qty} ${line.unit})`;
    } else if (hasUnit) {
      description = `${description} (${qty} ${line.unit})`;
    } else if (hasSku) {
      description = `${description} - ${line.sku}`;
    }

    return {
      DetailType: 'SalesItemLineDetail',
      Amount: amount,
      Description: description,
      SalesItemLineDetail: {
        Qty: qty,
        UnitPrice: line.unitPrice,
        ItemRef: itemRef,
      },
    };
  });

  const payload = {
    CustomerRef: {
      value: String(matchedCustomer.Id),
      name: matchedCustomer.DisplayName,
    },
    TxnDate: txnDate,
    PrivateNote: data.memo || '', // Internal memo
    Line: lines,
  };

  // DocNumber (invoice number) — optional
  if (data.invoiceNumber && typeof data.invoiceNumber === 'string' && data.invoiceNumber.trim() !== '') {
    payload.DocNumber = data.invoiceNumber.trim();
  }

  // CustomerMemo — message printed on invoice for customer
  if (data.customerMessage && typeof data.customerMessage === 'string' && data.customerMessage.trim() !== '') {
    payload.CustomerMemo = { value: data.customerMessage.trim() };
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
    const url = `${baseUrl}/v3/company/${realmId}/invoice?minorversion=65`;

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

      await logAction('invoice', 'push-to-qbo', 'error', {
        intuitTid,
        httpStatus: response.status,
        errorMessage,
        customerRef: payload.CustomerRef,
      });

      return { success: false, error: errorMessage, intuitTid };
    }

    const responseBody = await response.json();
    const entityId = responseBody?.Invoice?.Id;

    const qboTotal = responseBody?.Invoice?.TotalAmt;
    await logAction('invoice', 'push-to-qbo', 'success', {
      intuitTid,
      entityId,
      customerName: payload.CustomerRef?.name || null,
      invoiceNumber: payload.DocNumber || null,
      total: qboTotal != null ? qboTotal : null,
    });

    return { success: true, data: responseBody.Invoice, intuitTid };
  } catch (err) {
    await logAction('invoice', 'push-to-qbo', 'error', {
      intuitTid,
      errorMessage: err.message,
      customerName: payload.CustomerRef?.name || null,
      invoiceNumber: payload.DocNumber || null,
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
    if (Array.isArray(data.lines)) {
      data.lines.forEach((line) => {
        if (line.quantity !== undefined && line.qty === undefined) {
          line.qty = line.quantity;
        }
      });
    }

    // Step 1: Validate
    const { valid, errors, warnings, data: validatedData } = await validate(data, realmId);
    if (!valid) {
      return res.status(400).json({ success: false, errors, warnings });
    }
    // Use the validated copy (which carries _matchedCustomer and _matchedItem references)
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
    const docRef = await db.collection('invoice_drafts').add({
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
    await logAction('invoice', 'handle-create', 'error', { errorMessage: err.message });
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
    const draftRef = db.collection('invoice_drafts').doc(draftId);
    const draftSnap = await draftRef.get();

    if (!draftSnap.exists) {
      return res.status(404).json({ success: false, error: `Draft '${draftId}' not found` });
    }

    const draft = draftSnap.data();

    if (draft.status !== 'pending') {
      return res.status(409).json({ success: false, error: 'Draft already processed' });
    }

    // Draft fields are spread at the document root (not nested under a 'data' key)
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
    await logAction('invoice', 'handle-approve-draft', 'error', { errorMessage: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { validate, aiReview, buildPayload, pushToQBO, handleCreate, handleApproveDraft };
