'use strict';

const fetch = require('node-fetch');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { logAction } = require('../../core/logger');
const { getValidAccessToken, getRealmId, getQboBaseUrl } = require('../../core/qbo-auth');
const { getCachedVendors, getCachedItems, getCachedItemIdNameMap } = require('../../core/cache');
const { askAI } = require('../../core/ai-router');
const { buildValidationPrompt } = require('./prompts');
const { applyRules } = require('../../api/rules-engine');

// Base URL resolved dynamically from settings (production vs sandbox)

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

  // Required top-level fields: accept vendorId (from dropdown) or vendorName (legacy)
  if (!d.vendorId && (!d.vendorName || typeof d.vendorName !== 'string' || d.vendorName.trim() === '')) {
    errors.push('vendorId or vendorName is required');
  }

  // poNumber is required and must be a non-empty string
  if (!d.poNumber || typeof d.poNumber !== 'string' || d.poNumber.trim() === '') {
    errors.push('poNumber is required and must be a non-empty string');
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

  // Vendor matching: prefer vendorId (direct QBO ID) over name lookup
  const vendors = await getCachedVendors(realmId);
  if (d.vendorId) {
    const matchedVendor = vendors.find((v) => String(v.Id) === String(d.vendorId));
    if (!matchedVendor) {
      errors.push(`Vendor ID '${d.vendorId}' not found in QuickBooks. Try syncing your vendor list.`);
    } else {
      d._matchedVendor = matchedVendor;
    }
  } else if (d.vendorName && d.vendorName.trim() !== '') {
    const normalizedInput = d.vendorName.trim().toLowerCase();
    const matchedVendor = vendors.find((v) => {
      const displayName = (v.DisplayName || '').trim().toLowerCase();
      const companyName = (v.CompanyName || '').trim().toLowerCase();
      return displayName === normalizedInput || companyName === normalizedInput;
    });

    if (!matchedVendor) {
      errors.push(`Vendor '${d.vendorName}' not found in QuickBooks`);
    } else {
      d._matchedVendor = matchedVendor;
    }
  }

  // Item matching: use full item cache (1GB memory allows this)
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
  const vendors = await getCachedVendors(realmId);
  const items = await getCachedItems(realmId);

  const prompt = buildValidationPrompt(data, vendors, items);
  const aiResult = await askAI(prompt, { module: 'purchase-order' });

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

  await logAction('purchase-order', 'ai-review', flagged ? 'flagged' : 'clean', {
    vendorName: data.vendorName,
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
// to Firestore. These are runtime-only annotations added by validate() and
// should not be stored in documents.
// ---------------------------------------------------------------------------

function stripInternalFields(data) {
  const clean = { ...data };
  delete clean._matchedVendor;
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
// Builds a QBO PurchaseOrder-compliant payload from validated form data.
//
// IMPORTANT: AccountRef is intentionally NOT included on ItemBasedExpenseLineDetail.
// QBO Purchase Order API does not support AccountRef on line items (unlike Bill API).
// Adding it causes "Property Name: failed to parse json object" errors.
// For Inventory items, QBO resolves the expense account from the item automatically.
// For non-Inventory items, the item's ExpenseAccountRef in QBO is used automatically.
// ---------------------------------------------------------------------------

function buildPayload(data, matchedVendor) {
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

    // Append rule-generated notes to description (visible on PO in QBO)
    if (line.note && typeof line.note === 'string' && line.note.trim() !== '') {
      description = `${description} | ${line.note}`;
    }

    return {
      DetailType: 'ItemBasedExpenseLineDetail',
      Amount: amount,
      Description: description,
      ItemBasedExpenseLineDetail: {
        Qty: qty,
        UnitPrice: line.unitPrice,
        ItemRef: itemRef,
      },
    };
  });

  // Build payload
  // Note: APAccountRef is omitted — QBO uses the company's default AP account.
  // Hardcoding it by ID breaks companies that have different account numbering.
  const payload = {
    VendorRef: {
      value: String(matchedVendor.Id),
      name: matchedVendor.DisplayName,
    },
    TxnDate: txnDate,
    DocNumber: data.poNumber, // Custom PO number
    PrivateNote: data.memo || '', // Internal memo (not printed on PDF)
    Line: lines,
  };

  // Only include Memo (vendorMessage) if it's not empty - this gets printed on the PO PDF
  if (data.vendorMessage && typeof data.vendorMessage === 'string' && data.vendorMessage.trim() !== '') {
    payload.Memo = data.vendorMessage;
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
    const url = `${baseUrl}/v3/company/${realmId}/purchaseorder?minorversion=65`;

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

      await logAction('purchase-order', 'push-to-qbo', 'error', {
        intuitTid,
        httpStatus: response.status,
        errorMessage,
        vendorRef: payload.VendorRef,
      });

      return { success: false, error: errorMessage, intuitTid };
    }

    const responseBody = await response.json();
    const entityId = responseBody?.PurchaseOrder?.Id;

    const qboTotal = responseBody?.PurchaseOrder?.TotalAmt;
    await logAction('purchase-order', 'push-to-qbo', 'success', {
      intuitTid,
      entityId,
      vendorName: payload.VendorRef?.name || null,
      poNumber: payload.DocNumber || null,
      total: qboTotal != null ? qboTotal : null,
    });

    return { success: true, data: responseBody.PurchaseOrder, intuitTid };
  } catch (err) {
    await logAction('purchase-order', 'push-to-qbo', 'error', {
      intuitTid,
      errorMessage: err.message,
      vendorName: payload.VendorRef?.name || null,
      poNumber: payload.DocNumber || null,
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

    if (Array.isArray(data.lines) && data.vendorName) {
      data.lines = await applyRules(data.lines, data.vendorName);
    }

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
    // Use the validated copy (which carries _matchedVendor and _matchedItem references)
    const resolvedData = validatedData;

    // Step 2: AI Review (opt-out via aiEnabled: false)
    let aiReviewResult = { aiResult: null, flagged: false, suggestions: [] };
    if (resolvedData.aiEnabled !== false) {
      aiReviewResult = await aiReview(resolvedData, realmId);
    }

    // Step 3: Auto-approve path
    if (resolvedData.autoApprove === true) {
      const payload = buildPayload(resolvedData, resolvedData._matchedVendor);
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
    const docRef = await db.collection('po_drafts').add({
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
    await logAction('purchase-order', 'handle-create', 'error', { errorMessage: err.message });
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
    const draftRef = db.collection('po_drafts').doc(draftId);
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

    // Re-validate vendor reference in case cache changed
    if (!data._matchedVendor) {
      const vendors = await getCachedVendors(realmId);
      if (data.vendorId) {
        data._matchedVendor = vendors.find((v) => String(v.Id) === String(data.vendorId));
      } else {
        const normalizedInput = (data.vendorName || '').trim().toLowerCase();
        data._matchedVendor = vendors.find((v) => {
          const displayName = (v.DisplayName || '').trim().toLowerCase();
          const companyName = (v.CompanyName || '').trim().toLowerCase();
          return displayName === normalizedInput || companyName === normalizedInput;
        });
      }

      if (!data._matchedVendor) {
        return res.status(400).json({
          success: false,
          error: `Vendor '${data.vendorName || data.vendorId}' not found in QuickBooks. Re-submit the draft after syncing the vendor list.`,
        });
      }
    }

    const payload = buildPayload(data, data._matchedVendor);
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
    await logAction('purchase-order', 'handle-approve-draft', 'error', { errorMessage: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { validate, aiReview, buildPayload, pushToQBO, handleCreate, handleApproveDraft };
