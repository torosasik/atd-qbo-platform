'use strict';

const express = require('express');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { handleCreate, handleApproveDraft } = require('../modules/purchase-order/index');
const { handleCreate: handleInvoiceCreate, handleApproveDraft: handleInvoiceApproveDraft } = require('../modules/invoice/index');
const { handleCreate: handleBillCreate, handleApproveDraft: handleBillApproveDraft } = require('../modules/bill/index');
const { handleCreate: handlePaymentCreate, handleApproveDraft: handlePaymentApproveDraft } = require('../modules/payment/index');
const { handleFetchExpenses, handleCategorize, handleApproveDraft: handleExpenseApproveDraft, handleRejectDraft: handleExpenseRejectDraft } = require('../modules/expense/index');
const { handleChatMessage } = require('../modules/ai-chat/index');
const { getCachedVendors, getCachedItems, getCachedCustomers, getCachedAccounts, fetchOpenInvoices, fetchUncategorizedExpenses, refreshItems, refreshVendors, refreshCustomers } = require('../core/cache');
const { getRealmId, refreshAccessToken, getQboBaseUrl, getValidAccessToken, ensureValidToken } = require('../core/qbo-auth');
const { getSettings, updateSettings } = require('../core/settings');
const { logAction } = require('../core/logger');
const { readSheetData, groupByPO, testConnection, getSheetsClient } = require('../core/sheets-connector');
const { getOAuthUrl, handleCallback, QBO_TOKENS_DOC } = require('../core/google-auth');

const router = express.Router();

// ---------------------------------------------------------------------------
// POST /po/create
// Body: { vendorName, lines, txnDate?, memo?, autoApprove?, aiEnabled? }
// ---------------------------------------------------------------------------

router.post('/po/create', async (req, res) => {
  try {
    await ensureValidToken();
    await handleCreate(req, res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /po/approve/:draftId
// ---------------------------------------------------------------------------

router.post('/po/approve/:draftId', async (req, res) => {
  try {
    await ensureValidToken();
    await handleApproveDraft(req, res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /po/drafts
// Returns pending PO drafts ordered by createdAt desc, limit 50.
// ---------------------------------------------------------------------------

router.get('/po/drafts', async (req, res) => {
  try {
    const db = getFirestore();
    const snapshot = await db
      .collection('po_drafts')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const drafts = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json({ success: true, drafts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /po/history
// Returns push-to-qbo log entries for the purchase-order module, limit 100.
// ---------------------------------------------------------------------------

router.get('/po/history', async (req, res) => {
  try {
    const db = getFirestore();
    const snapshot = await db
      .collection('logs')
      .where('module', '==', 'purchase-order')
      .where('action', '==', 'push-to-qbo')
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();

    const history = snapshot.docs.map((doc) => {
      const data = doc.data();
      const details = data.details || {};
      // Convert Firestore Timestamp to ISO string for JSON-safe serialization
      const timestampIso = data.timestamp
        ? (data.timestamp.toDate ? data.timestamp.toDate().toISOString() : new Date(data.timestamp._seconds * 1000).toISOString())
        : null;
      return {
        id: doc.id,
        status: data.status,
        timestamp: timestampIso,
        // Flatten details for convenient frontend access
        vendorName: details.vendorName || null,
        qboEntityId: details.entityId || null,
        intuitTid: details.intuitTid || null,
        poNumber: details.poNumber || null,
        total: details.total || null,
        errorMessage: details.errorMessage || null,
      };
    });

    res.status(200).json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /po/drafts/:draftId
// Deletes (rejects) a pending PO draft.
// ---------------------------------------------------------------------------

router.delete('/po/drafts/:draftId', async (req, res) => {
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
      return res.status(409).json({ success: false, error: 'Draft has already been processed and cannot be deleted' });
    }

    await draftRef.update({
      status: 'rejected',
      rejectedAt: FieldValue.serverTimestamp(),
    });

    await logAction('purchase-order', 'reject-draft', 'success', { draftId });

    return res.status(200).json({ success: true, message: 'Draft rejected and deleted.' });
  } catch (err) {
    await logAction('purchase-order', 'reject-draft', 'error', { errorMessage: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /invoices
// Body: { customerName, lines, txnDate?, memo?, autoApprove?, aiEnabled? }
// ---------------------------------------------------------------------------

router.post('/invoices', async (req, res) => {
  try {
    await ensureValidToken();
    await handleInvoiceCreate(req, res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /invoices/drafts/:draftId/approve
// ---------------------------------------------------------------------------

router.post('/invoices/drafts/:draftId/approve', async (req, res) => {
  try {
    await ensureValidToken();
    await handleInvoiceApproveDraft(req, res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /invoices/drafts
// Returns pending invoice drafts ordered by createdAt desc, limit 50.
// ---------------------------------------------------------------------------

router.get('/invoices/drafts', async (req, res) => {
  try {
    const db = getFirestore();
    const snapshot = await db
      .collection('invoice_drafts')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const drafts = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json({ success: true, drafts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /invoices
// Returns push-to-qbo log entries for the invoice module, limit 100.
// ---------------------------------------------------------------------------

router.get('/invoices', async (req, res) => {
  try {
    const db = getFirestore();
    const snapshot = await db
      .collection('logs')
      .where('module', '==', 'invoice')
      .where('action', '==', 'push-to-qbo')
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();

    const history = snapshot.docs.map((doc) => {
      const data = doc.data();
      const details = data.details || {};
      // Convert Firestore Timestamp to ISO string for JSON-safe serialization
      const timestampIso = data.timestamp
        ? (data.timestamp.toDate ? data.timestamp.toDate().toISOString() : new Date(data.timestamp._seconds * 1000).toISOString())
        : null;
      return {
        id: doc.id,
        status: data.status,
        timestamp: timestampIso,
        // Flatten details for convenient frontend access
        customerName: details.customerName || null,
        qboEntityId: details.entityId || null,
        intuitTid: details.intuitTid || null,
        invoiceNumber: details.invoiceNumber || null,
        total: details.total || null,
        errorMessage: details.errorMessage || null,
      };
    });

    res.status(200).json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /invoices/drafts/:draftId/reject
// Rejects a pending invoice draft.
// ---------------------------------------------------------------------------

router.post('/invoices/drafts/:draftId/reject', async (req, res) => {
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
      return res.status(409).json({ success: false, error: 'Draft has already been processed and cannot be rejected' });
    }

    await draftRef.update({
      status: 'rejected',
      rejectedAt: FieldValue.serverTimestamp(),
    });

    await logAction('invoice', 'reject-draft', 'success', { draftId });

    return res.status(200).json({ success: true, message: 'Draft rejected.' });
  } catch (err) {
    await logAction('invoice', 'reject-draft', 'error', { errorMessage: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /bills
// Body: { vendorName, lines, txnDate?, memo?, autoApprove?, aiEnabled? }
// ---------------------------------------------------------------------------

router.post('/bills', async (req, res) => {
  try {
    await ensureValidToken();
    await handleBillCreate(req, res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /bills/drafts/:draftId/approve
// ---------------------------------------------------------------------------

router.post('/bills/drafts/:draftId/approve', async (req, res) => {
  try {
    await ensureValidToken();
    await handleBillApproveDraft(req, res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /bills/drafts
// Returns pending bill drafts ordered by createdAt desc, limit 50.
// ---------------------------------------------------------------------------

router.get('/bills/drafts', async (req, res) => {
  try {
    const db = getFirestore();
    const snapshot = await db
      .collection('bill_drafts')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const drafts = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json({ success: true, drafts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /bills
// Returns push-to-qbo log entries for the bill module, limit 100.
// ---------------------------------------------------------------------------

router.get('/bills', async (req, res) => {
  try {
    const db = getFirestore();
    const snapshot = await db
      .collection('logs')
      .where('module', '==', 'bill')
      .where('action', '==', 'push-to-qbo')
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();

    const history = snapshot.docs.map((doc) => {
      const data = doc.data();
      const details = data.details || {};
      // Convert Firestore Timestamp to ISO string for JSON-safe serialization
      const timestampIso = data.timestamp
        ? (data.timestamp.toDate ? data.timestamp.toDate().toISOString() : new Date(data.timestamp._seconds * 1000).toISOString())
        : null;
      return {
        id: doc.id,
        status: data.status,
        timestamp: timestampIso,
        // Flatten details for convenient frontend access
        vendorName: details.vendorName || null,
        qboEntityId: details.entityId || null,
        intuitTid: details.intuitTid || null,
        billNumber: details.billNumber || null,
        total: details.total || null,
        errorMessage: details.errorMessage || null,
      };
    });

    res.status(200).json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /bills/drafts/:draftId/reject
// Rejects a pending bill draft.
// ---------------------------------------------------------------------------

router.post('/bills/drafts/:draftId/reject', async (req, res) => {
  try {
    const { draftId } = req.params;
    const db = getFirestore();
    const draftRef = db.collection('bill_drafts').doc(draftId);
    const draftSnap = await draftRef.get();

    if (!draftSnap.exists) {
      return res.status(404).json({ success: false, error: `Draft '${draftId}' not found` });
    }

    const draft = draftSnap.data();
    if (draft.status !== 'pending') {
      return res.status(409).json({ success: false, error: 'Draft has already been processed and cannot be rejected' });
    }

    await draftRef.update({
      status: 'rejected',
      rejectedAt: FieldValue.serverTimestamp(),
    });

    await logAction('bill', 'reject-draft', 'success', { draftId });

    return res.status(200).json({ success: true, message: 'Draft rejected.' });
  } catch (err) {
    await logAction('bill', 'reject-draft', 'error', { errorMessage: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /payments
// Body: { customerId, customerName, totalAmount, lines, txnDate?, memo?,
//         paymentMethod?, referenceNumber?, autoApprove?, aiEnabled? }
// ---------------------------------------------------------------------------

router.post('/payments', async (req, res) => {
  try {
    await ensureValidToken();
    await handlePaymentCreate(req, res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /payments/drafts/:draftId/approve
// ---------------------------------------------------------------------------

router.post('/payments/drafts/:draftId/approve', async (req, res) => {
  try {
    await ensureValidToken();
    await handlePaymentApproveDraft(req, res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /payments/drafts
// Returns pending payment drafts ordered by createdAt desc, limit 50.
// ---------------------------------------------------------------------------

router.get('/payments/drafts', async (req, res) => {
  try {
    const db = getFirestore();
    const snapshot = await db
      .collection('payment_drafts')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const drafts = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json({ success: true, drafts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /payments
// Returns push-to-qbo log entries for the payment module, limit 100.
// ---------------------------------------------------------------------------

router.get('/payments', async (req, res) => {
  try {
    const db = getFirestore();
    const snapshot = await db
      .collection('logs')
      .where('module', '==', 'payment')
      .where('action', '==', 'push-to-qbo')
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();

    const history = snapshot.docs.map((doc) => {
      const data = doc.data();
      const details = data.details || {};
      // Convert Firestore Timestamp to ISO string for JSON-safe serialization
      const timestampIso = data.timestamp
        ? (data.timestamp.toDate ? data.timestamp.toDate().toISOString() : new Date(data.timestamp._seconds * 1000).toISOString())
        : null;
      return {
        id: doc.id,
        status: data.status,
        timestamp: timestampIso,
        // Flatten details for convenient frontend access
        customerName: details.customerName || null,
        qboEntityId: details.entityId || null,
        intuitTid: details.intuitTid || null,
        total: details.total || null,
        errorMessage: details.errorMessage || null,
      };
    });

    res.status(200).json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /payments/drafts/:draftId/reject
// Rejects a pending payment draft.
// ---------------------------------------------------------------------------

router.post('/payments/drafts/:draftId/reject', async (req, res) => {
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
      return res.status(409).json({ success: false, error: 'Draft has already been processed and cannot be rejected' });
    }

    await draftRef.update({
      status: 'rejected',
      rejectedAt: FieldValue.serverTimestamp(),
    });

    await logAction('payment', 'reject-draft', 'success', { draftId });

    return res.status(200).json({ success: true, message: 'Draft rejected.' });
  } catch (err) {
    await logAction('payment', 'reject-draft', 'error', { errorMessage: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /open-invoices/:customerId
// Returns open (unpaid) invoices for a specific customer from QBO.
// ---------------------------------------------------------------------------

router.get('/open-invoices/:customerId', async (req, res) => {
  try {
    await ensureValidToken();
    const realmId = await getRealmId();
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({ success: false, error: 'customerId is required' });
    }

    const invoices = await fetchOpenInvoices(realmId, customerId);
    res.status(200).json({ success: true, invoices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /customers
// Returns cached customer list for the current QBO realm.
// ---------------------------------------------------------------------------

router.get('/customers', async (req, res) => {
  try {
    await ensureValidToken();
    const realmId = await getRealmId();
    const customers = await getCachedCustomers(realmId);
    res.status(200).json({ success: true, customers });
  } catch (err) {
    if (err.code === 'QBO_AUTH_EXPIRED') {
      return res.status(200).json({
        success: false,
        error: 'QuickBooks connection is not available',
        fix: 'Go to QBO Connect page and click Connect to QuickBooks',
        code: 'QBO_TOKEN_EXPIRED',
      });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /vendors
// Returns cached vendor list for the current QBO realm.
// ---------------------------------------------------------------------------

router.get('/vendors', async (req, res) => {
  try {
    await ensureValidToken();
    const realmId = await getRealmId();
    const vendors = await getCachedVendors(realmId);
    res.status(200).json({ success: true, vendors });
  } catch (err) {
    if (err.code === 'QBO_AUTH_EXPIRED') {
      return res.status(200).json({
        success: false,
        error: 'QuickBooks connection is not available',
        fix: 'Go to QBO Connect page and click Connect to QuickBooks',
        code: 'QBO_TOKEN_EXPIRED',
      });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /items
// Returns cached item list for the current QBO realm.
// ---------------------------------------------------------------------------

router.get('/items', async (req, res) => {
  try {
    await ensureValidToken();
    const realmId = await getRealmId();
    const items = await getCachedItems(realmId);
    res.status(200).json({ success: true, items });
  } catch (err) {
    if (err.code === 'QBO_AUTH_EXPIRED') {
      return res.status(200).json({
        success: false,
        error: 'QuickBooks connection is not available',
        fix: 'Go to QBO Connect page and click Connect to QuickBooks',
        code: 'QBO_TOKEN_EXPIRED',
      });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /items/create
// Creates a new item in QBO and refreshes the items cache.
// Body: { name, type, description?, unitPrice? }
// ---------------------------------------------------------------------------

router.post('/items/create', async (req, res) => {
  try {
    await ensureValidToken();
    const realmId = await getRealmId();
    const { name, type, description, unitPrice } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Item name is required.' });
    }

    const accessToken = await getValidAccessToken();
    const qboBaseUrl = await getQboBaseUrl();

    // Build the item payload for QBO
    const itemPayload = {
      Name: name.trim(),
      Type: type || 'NonInventory',
      Description: description || '',
    };

    // Add UnitPrice if provided
    if (unitPrice !== undefined && unitPrice !== null && unitPrice !== '') {
      itemPayload.UnitPrice = parseFloat(unitPrice);
    }

    // QBO requires account refs depending on item type:
    //   NonInventory / Service → IncomeAccountRef + ExpenseAccountRef
    //   Inventory               → IncomeAccountRef + AssetAccountRef + COGSAccountRef
    if (type === 'Inventory') {
      itemPayload.IncomeAccountRef = { value: '80' }; // Default Sales of Product Income
      itemPayload.AssetAccountRef  = { value: '81' }; // Default Inventory Asset
      itemPayload.COGSAccountRef   = { value: '67' }; // Default Cost of Goods Sold
      itemPayload.QtyOnHand = 0;
    } else {
      // NonInventory / Service items require both IncomeAccountRef and ExpenseAccountRef
      itemPayload.IncomeAccountRef  = { value: '80' }; // Sales of Product Income
      itemPayload.ExpenseAccountRef = { value: '67' }; // Cost of Goods Sold
    }

    const createUrl = `${qboBaseUrl}/v3/company/${realmId}/item`;
    const createResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(itemPayload)
    });

    const createData = await createResponse.json();

    if (!createResponse.ok) {
      const intuitTid = createResponse.headers.get('intuit_tid');
      await logAction('items', 'create-item', 'error', {
        realmId,
        name,
        type,
        error: createData.Fault?.Error?.[0]?.Detail || createData.message,
        intuitTid
      });
      return res.status(400).json({
        success: false,
        error: createData.Fault?.Error?.[0]?.Detail || createData.message || 'Failed to create item in QuickBooks.'
      });
    }

    // Refresh the items cache to include the new item
    await refreshItems(realmId);

    const newItem = createData.Item;
    await logAction('items', 'create-item', 'success', {
      realmId,
      itemId: newItem.Id,
      itemName: newItem.Name,
      intuitTid: createResponse.headers.get('intuit_tid')
    });

    res.status(200).json({
      success: true,
      item: newItem,
      message: `Item "${newItem.Name}" created successfully.`
    });
  } catch (err) {
    await logAction('items', 'create-item', 'error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /settings
// Returns the current application settings.
// ---------------------------------------------------------------------------

router.get('/settings', async (req, res) => {
  try {
    const settings = await getSettings();
    res.status(200).json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// PUT /settings
// Deep-merges the request body into the current settings.
// Body: partial settings object (any depth).
// ---------------------------------------------------------------------------

router.put('/settings', async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ success: false, error: 'Request body must be a JSON object' });
    }
    const updated = await updateSettings(req.body);
    res.status(200).json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/sheets/test-connection
// Tests whether the sheet ID saved in settings is accessible.
// ---------------------------------------------------------------------------

router.get('/sheets/test-connection', async (req, res) => {
  try {
    const settings = await getSettings();
    const sheetId = settings.google_sheets.po_sheet_id;
    if (!sheetId) {
      return res.status(400).json({ success: false, error: 'po_sheet_id is not configured in settings' });
    }
    const result = await testConnection(sheetId);
    res.status(result.success ? 200 : 502).json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/sheets/preview
// Reads the configured sheet and returns parsed row objects.
// ---------------------------------------------------------------------------

router.get('/sheets/preview', async (req, res) => {
  try {
    const settings = await getSettings();
    const { po_sheet_id: sheetId, po_sheet_tab: tabName, po_column_mapping: columnMapping } = settings.google_sheets;

    if (!sheetId) {
      return res.status(400).json({ success: false, error: 'po_sheet_id is not configured in settings' });
    }

    const rows = await readSheetData(sheetId, tabName, columnMapping);
    const groupKey = Object.keys(columnMapping).find((k) => k === 'orderNumber') ? 'orderNumber' : null;
    const pos = groupKey ? groupByPO(rows, groupKey) : [];

    res.status(200).json({ success: true, rows, pos });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/sheets/import
// Reads the sheet, groups rows into POs, and saves drafts to po_drafts.
// ---------------------------------------------------------------------------

router.post('/sheets/import', async (req, res) => {
  try {
    const settings = await getSettings();
    const { po_sheet_id: sheetId, po_sheet_tab: tabName, po_column_mapping: columnMapping } = settings.google_sheets;

    if (!sheetId) {
      return res.status(400).json({ success: false, error: 'po_sheet_id is not configured in settings' });
    }

    const rows = await readSheetData(sheetId, tabName, columnMapping);
    const pos = groupByPO(rows, 'orderNumber');

    if (pos.length === 0) {
      return res.status(200).json({ success: true, imported: 0, message: 'No PO groups found in sheet' });
    }

    const db = getFirestore();
    const batch = db.batch();
    const draftIds = [];

    for (const po of pos) {
      const ref = db.collection('po_drafts').doc();
      draftIds.push(ref.id);
      batch.set(ref, {
        ...po,
        status: 'pending',
        source: 'google_sheets',
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    res.status(200).json({ success: true, imported: pos.length, draftIds });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /auth/connect
// Builds and redirects to the Intuit OAuth 2.0 authorization URL.
// ---------------------------------------------------------------------------

router.get('/auth/connect', async (req, res) => {
  try {
    const url = await getOAuthUrl();
    return res.redirect(url);
  } catch (err) {
    await logAction('qbo-auth', 'oauth-connect', 'error', { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /auth/callback
// Handles the Intuit redirect after user authorization.
// Exchanges the authorization code for tokens and saves them.
// ---------------------------------------------------------------------------

router.get('/auth/callback', async (req, res) => {
  try {
    const { code, state, realmId, error: oauthError } = req.query;

    if (oauthError) {
      await logAction('qbo-auth', 'oauth-callback', 'error', { oauthError });
      return res.redirect('/?auth=error&reason=' + encodeURIComponent(oauthError));
    }

    await handleCallback(code, realmId, state);
    return res.redirect('/settings?auth=connected');
  } catch (err) {
    await logAction('qbo-auth', 'oauth-callback', 'error', { error: err.message });
    return res.redirect('/?auth=error&reason=' + encodeURIComponent(err.message));
  }
});

// ---------------------------------------------------------------------------
// GET /auth/status
// Returns current connection status and token expiry info.
// ---------------------------------------------------------------------------

router.get('/auth/status', async (req, res) => {
  try {
    const db = getFirestore();
    const docSnap = await db.doc(QBO_TOKENS_DOC).get();

    if (!docSnap.exists) {
      return res.status(200).json({ success: true, connected: false });
    }

    const data = docSnap.data();
    const connected = Boolean(data.accessToken && data.refreshToken && data.realmId);

    return res.status(200).json({
      success: true,
      connected,
      realmId: data.realmId || null,
      tokenExpiry: data.accessTokenExpiry ? data.accessTokenExpiry.toDate().toISOString() : null,
      lastRefreshed: data.lastRefreshed ? data.lastRefreshed.toDate().toISOString() : null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /auth/disconnect
// Clears stored tokens from Firestore.
// ---------------------------------------------------------------------------

router.post('/auth/disconnect', async (req, res) => {
  try {
    const db = getFirestore();
    await db.doc(QBO_TOKENS_DOC).set({
      accessToken: FieldValue.delete(),
      refreshToken: FieldValue.delete(),
      accessTokenExpiry: FieldValue.delete(),
      refreshTokenExpiry: FieldValue.delete(),
      lastRefreshed: FieldValue.delete(),
    }, { merge: true });

    await logAction('qbo-auth', 'disconnect', 'success', {});
    return res.status(200).json({ success: true, message: 'Disconnected from QuickBooks.' });
  } catch (err) {
    await logAction('qbo-auth', 'disconnect', 'error', { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /auth/refresh
// Manually triggers an access token refresh using the stored refresh token.
// ---------------------------------------------------------------------------

router.post('/auth/refresh', async (req, res) => {
  try {
    const db = getFirestore();
    const docSnap = await db.doc(QBO_TOKENS_DOC).get();

    if (!docSnap.exists || !docSnap.data().refreshToken) {
      return res.status(400).json({ success: false, error: 'No refresh token stored. Connect to QuickBooks first.' });
    }

    const newAccessToken = await refreshAccessToken(docSnap.data().refreshToken);
    const updated = await db.doc(QBO_TOKENS_DOC).get();

    return res.status(200).json({
      success: true,
      message: 'Access token refreshed.',
      tokenExpiry: updated.data().accessTokenExpiry
        ? updated.data().accessTokenExpiry.toDate().toISOString()
        : null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/ai/chat
// Body: { message: string, context?: any }
// Returns: { success, reply, source, confidence }
// ---------------------------------------------------------------------------

router.post('/ai/chat', async (req, res) => {
  try {
    await handleChatMessage(req, res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Vendor Mappings
// ---------------------------------------------------------------------------

const VENDOR_MAPPINGS_DOC = 'settings/vendor_mappings';

// ---------------------------------------------------------------------------
// GET /vendor-mappings
// Returns vendor mappings from Firestore.
// ---------------------------------------------------------------------------

router.get('/vendor-mappings', async (req, res) => {
  try {
    const db = getFirestore();
    let docSnap = await db.doc(VENDOR_MAPPINGS_DOC).get();
    let data = docSnap.exists ? docSnap.data() : null;
    const vendors = data ? (data.vendors || []) : [];

    // Auto-sync from QBO if Firestore doc is empty/missing
    if (vendors.length === 0) {
      try {
        await ensureValidToken();
        const realmId = await getRealmId();
        const qboVendors = await refreshVendors(realmId);

        if (Array.isArray(qboVendors) && qboVendors.length > 0) {
          const merged = qboVendors.map((qv) => ({
            qbo_id: String(qv.Id),
            qbo_name: qv.DisplayName || qv.CompanyName || '',
            active: false,
            shopify_code: '',
          }));

          await db.doc(VENDOR_MAPPINGS_DOC).set({
            vendors: merged,
            last_synced: FieldValue.serverTimestamp(),
          });

          // Read back for timestamp
          docSnap = await db.doc(VENDOR_MAPPINGS_DOC).get();
          data = docSnap.data();

          await logAction('vendor-management', 'auto-sync', 'success', {
            total: merged.length,
            trigger: 'empty-vendor-mappings-get',
          });
        }
      } catch (syncErr) {
        // QBO not connected — return empty mappings gracefully
        await logAction('vendor-management', 'auto-sync', 'skipped', {
          reason: syncErr.message,
        });
      }
    }

    // Re-read data after potential auto-sync
    const finalVendors = data ? (data.vendors || []) : [];
    const lastSynced = data && data.last_synced
      ? (data.last_synced.toDate ? data.last_synced.toDate().toISOString() : data.last_synced)
      : null;

    return res.status(200).json({
      success: true,
      mappings: {
        vendors: finalVendors,
        last_synced: lastSynced,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// PUT /vendor-mappings
// Saves vendor mappings to Firestore.
// Body: { vendors: [{ qbo_id, qbo_name, active, shopify_code }, ...] }
// ---------------------------------------------------------------------------

router.put('/vendor-mappings', async (req, res) => {
  try {
    if (!req.body || !Array.isArray(req.body.vendors)) {
      return res.status(400).json({
        success: false,
        error: 'Request body must contain a "vendors" array',
      });
    }

    const vendors = req.body.vendors.map((v) => ({
      qbo_id: String(v.qbo_id || ''),
      qbo_name: String(v.qbo_name || ''),
      active: Boolean(v.active),
      shopify_code: String(v.shopify_code || ''),
    }));

    const db = getFirestore();
    await db.doc(VENDOR_MAPPINGS_DOC).set({
      vendors,
      last_synced: FieldValue.serverTimestamp(),
    });

    // Read back to get the server timestamp
    const saved = await db.doc(VENDOR_MAPPINGS_DOC).get();
    const savedData = saved.data();

    return res.status(200).json({
      success: true,
      mappings: {
        vendors: savedData.vendors,
        last_synced: savedData.last_synced
          ? savedData.last_synced.toDate().toISOString()
          : null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /vendor-mappings/sync
// Pulls vendor list from QBO, merges with existing mappings, saves to Firestore.
// ---------------------------------------------------------------------------

router.post('/vendor-mappings/sync', async (req, res) => {
  try {
    await ensureValidToken();
    // Force a fresh fetch from QBO (bypass cache TTL — this is an explicit sync)
    const realmId = await getRealmId();
    const qboVendors = await refreshVendors(realmId);

    if (!Array.isArray(qboVendors)) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch vendors from QuickBooks. Check the connection and try again.',
      });
    }

    // Read existing mappings
    const db = getFirestore();
    const docSnap = await db.doc(VENDOR_MAPPINGS_DOC).get();
    const existingVendors = docSnap.exists ? (docSnap.data().vendors || []) : [];

    // Build lookup of existing mappings by qbo_id
    const existingMap = {};
    for (const v of existingVendors) {
      existingMap[v.qbo_id] = v;
    }

    // Merge: keep existing settings for known vendors, add new ones as inactive
    const merged = qboVendors.map((qv) => {
      const id = String(qv.Id);
      const name = qv.DisplayName || qv.CompanyName || '';
      const existing = existingMap[id];
      if (existing) {
        return {
          qbo_id: id,
          qbo_name: name,
          active: existing.active,
          shopify_code: existing.shopify_code,
        };
      }
      return {
        qbo_id: id,
        qbo_name: name,
        active: false,
        shopify_code: '',
      };
    });

    // Save merged result
    await db.doc(VENDOR_MAPPINGS_DOC).set({
      vendors: merged,
      last_synced: FieldValue.serverTimestamp(),
    });

    // Read back for timestamp
    const saved = await db.doc(VENDOR_MAPPINGS_DOC).get();
    const savedData = saved.data();

    await logAction('vendor-management', 'sync', 'success', {
      total: merged.length,
      new: merged.length - existingVendors.length,
    });

    return res.status(200).json({
      success: true,
      mappings: {
        vendors: savedData.vendors,
        last_synced: savedData.last_synced
          ? savedData.last_synced.toDate().toISOString()
          : null,
      },
      summary: {
        total: merged.length,
        existing: Object.keys(existingMap).length,
        new_vendors: merged.length - Object.keys(existingMap).length,
      },
    });
  } catch (err) {
    await logAction('vendor-management', 'sync', 'error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===========================================================================
// EXPENSE CATEGORIZATION ROUTES
// ===========================================================================

// ---------------------------------------------------------------------------
// GET /expenses/uncategorized
// Fetches uncategorized expenses from QBO.
// ---------------------------------------------------------------------------

router.get('/expenses/uncategorized', async (req, res) => {
  try {
    await ensureValidToken();
    await handleFetchExpenses(req, res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /expenses/drafts
// Returns pending expense categorization drafts ordered by createdAt desc.
// ---------------------------------------------------------------------------

router.get('/expenses/drafts', async (req, res) => {
  try {
    const db = getFirestore();
    const snapshot = await db
      .collection('expense_drafts')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const drafts = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json({ success: true, drafts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /expenses/categorize
// AI categorize an expense (creates a draft).
// Body: { expenseId, suggestedAccountId? }
// ---------------------------------------------------------------------------

router.post('/expenses/categorize', async (req, res) => {
  try {
    await ensureValidToken();
    await handleCategorize(req, res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /expenses/drafts/:id/approve
// Apply the suggested category to the QBO expense.
// ---------------------------------------------------------------------------

router.post('/expenses/drafts/:id/approve', async (req, res) => {
  try {
    await ensureValidToken();
    await handleExpenseApproveDraft(req, res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /expenses/drafts/:id/reject
// Reject an expense categorization draft.
// ---------------------------------------------------------------------------

router.post('/expenses/drafts/:id/reject', async (req, res) => {
  try {
    await handleExpenseRejectDraft(req, res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /expenses
// Returns expense categorization history from logs, limit 100.
// ---------------------------------------------------------------------------

router.get('/expenses', async (req, res) => {
  try {
    const db = getFirestore();
    const snapshot = await db
      .collection('logs')
      .where('module', '==', 'expense')
      .where('action', '==', 'push-to-qbo')
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();

    const history = snapshot.docs.map((doc) => {
      const data = doc.data();
      const details = data.details || {};
      const timestampIso = data.timestamp
        ? (data.timestamp.toDate ? data.timestamp.toDate().toISOString() : new Date(data.timestamp._seconds * 1000).toISOString())
        : null;
      return {
        id: doc.id,
        status: data.status,
        timestamp: timestampIso,
        vendorName: details.vendorName || null,
        expenseId: details.expenseId || null,
        accountName: details.accountName || null,
        accountId: details.accountId || null,
        total: details.total || null,
        intuitTid: details.intuitTid || null,
        errorMessage: details.errorMessage || null,
      };
    });

    res.status(200).json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /accounts
// Returns cached QBO accounts list for dropdown selections.
// ---------------------------------------------------------------------------

router.get('/accounts', async (req, res) => {
  try {
    await ensureValidToken();
    const realmId = await getRealmId();
    const accounts = await getCachedAccounts(realmId);

    const expenseAccounts = accounts
      .filter((a) => {
        const type = (a.AccountType || '').toLowerCase();
        return type === 'expense' || type === 'cost of goods sold' || type === 'other expense';
      })
      .map((a) => ({
        id: a.Id,
        name: a.Name,
        type: a.AccountType,
        fullyQualifiedName: a.FullyQualifiedName || a.Name,
      }));

    res.status(200).json({ success: true, accounts: expenseAccounts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /health
// Returns detailed status of all services: Firestore, QBO, Ollama, Claude API,
// and Google Sheets. Used by the frontend Health Dashboard.
// ---------------------------------------------------------------------------

router.get('/health', async (req, res) => {
  const services = {};
  const errors = [];

  // ---- 1. Firestore ----
  const fsStart = Date.now();
  try {
    const db = getFirestore();
    await db.doc('settings/app_config').get();
    services.firestore = {
      status: 'connected',
      message: 'Firestore is accessible',
      latency_ms: Date.now() - fsStart,
    };
  } catch (err) {
    services.firestore = {
      status: 'error',
      message: err.message,
      latency_ms: Date.now() - fsStart,
    };
    errors.push('Firestore is not accessible. Check your Firebase project configuration.');
  }

  // ---- Load settings for subsequent checks (best-effort) ----
  let settings = {};
  try {
    settings = await getSettings();
  } catch (_err) { /* continue with empty settings */ }

  // ---- 2. QBO API (real connection test) ----
  const qboStart = Date.now();
  try {
    const db = getFirestore();
    const tokenDoc = await db.doc(QBO_TOKENS_DOC).get();

    if (!tokenDoc.exists) {
      services.qbo_api = {
        status: 'disconnected',
        message: 'OAuth tokens not found',
        realm_id: null,
        environment: settings.qbo?.environment || 'sandbox',
        token_expires_at: null,
        latency_ms: Date.now() - qboStart,
      };
      errors.push('QBO tokens not found. Go to QBO Connect page and click Connect to QuickBooks.');
    } else {
      const data = tokenDoc.data();
      const hasTokens = Boolean(data.accessToken && data.refreshToken && data.realmId);

      if (!hasTokens) {
        services.qbo_api = {
          status: 'disconnected',
          message: 'Tokens are incomplete',
          realm_id: data.realmId || null,
          environment: settings.qbo?.environment || 'sandbox',
          token_expires_at: null,
          latency_ms: Date.now() - qboStart,
        };
        errors.push('QBO tokens not found. Go to QBO Connect page and click Connect to QuickBooks.');
      } else {
        const expiryTs = data.accessTokenExpiry ? data.accessTokenExpiry.toDate() : null;
        const now = new Date();
        const isExpired = expiryTs && expiryTs <= now;

        // Check token expiry first, even before API call
        if (isExpired) {
          const diffMs = now - expiryTs;
          const diffMins = Math.round(diffMs / (1000 * 60));
          const diffHours = Math.round(diffMs / (1000 * 60 * 60));
          const agoText = diffMins < 60
            ? `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
            : `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
          services.qbo_api = {
            status: 'error',
            message: `Access token expired ${agoText}. Click Refresh Token on QBO Connect page.`,
            realm_id: data.realmId || null,
            environment: settings.qbo?.environment || 'sandbox',
            token_expires_at: expiryTs ? expiryTs.toISOString() : null,
            latency_ms: Date.now() - qboStart,
          };
          errors.push(`QBO access token expired ${agoText}. Click Refresh Token on the QBO Connect page.`);
        } else if (!isExpired) {
          try {
            const accessToken = await ensureValidToken();
            const baseUrl = await getQboBaseUrl();
            const realmId = data.realmId;

            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 5000);
            const qboRes = await fetch(
              `${baseUrl}/v3/company/${realmId}/companyinfo/${realmId}`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  Accept: 'application/json',
                },
                signal: controller.signal,
              },
            );
            clearTimeout(timer);

            if (qboRes.ok) {
              const qboJson = await qboRes.json();
              const companyName = qboJson.CompanyInfo?.CompanyName || 'Unknown';
              services.qbo_api = {
                status: 'connected',
                message: `Connected to "${companyName}"`,
                realm_id: realmId,
                company_name: companyName,
                environment: settings.qbo?.environment || 'production',
                token_expires_at: expiryTs ? expiryTs.toISOString() : null,
                latency_ms: Date.now() - qboStart,
              };
            } else {
              const errText = await qboRes.text().catch(() => '');
              services.qbo_api = {
                status: 'error',
                message: `QBO API returned HTTP ${qboRes.status}: ${errText.slice(0, 200)}`,
                realm_id: data.realmId,
                environment: settings.qbo?.environment || 'sandbox',
                token_expires_at: expiryTs ? expiryTs.toISOString() : null,
                latency_ms: Date.now() - qboStart,
              };
              errors.push(`QBO API connection failed with HTTP ${qboRes.status}.`);
            }
          } catch (apiErr) {
            // Tokens exist but API call failed, fall back to configured status
            services.qbo_api = {
              status: 'configured',
              message: `Tokens present but API call failed: ${apiErr.message}`,
              realm_id: data.realmId,
              environment: settings.qbo?.environment || 'sandbox',
              token_expires_at: expiryTs ? expiryTs.toISOString() : null,
              latency_ms: Date.now() - qboStart,
            };
            errors.push(`QBO API call failed: ${apiErr.message}`);
          }
        }
      }
    }
  } catch (err) {
    services.qbo_api = {
      status: 'error',
      message: `Failed to read QBO token status: ${err.message}`,
      realm_id: null,
      environment: settings.qbo?.environment || 'sandbox',
      token_expires_at: null,
      latency_ms: Date.now() - qboStart,
    };
    errors.push('Failed to read QBO token status. Check Firestore access.');
  }

  // ---- 3. Ollama ----
  const ollamaUrl = settings.ai?.ollama_url || 'http://localhost:11434';
  const ollamaModel = settings.ai?.ollama_model || 'llama3';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const ollamaRes = await fetch(`${ollamaUrl}/api/tags`, { signal: controller.signal });
    clearTimeout(timer);

    if (ollamaRes.ok) {
      const ollamaData = await ollamaRes.json();
      const models = (ollamaData.models || []).map((m) => (typeof m === 'string' ? m : m.name));
      services.ollama = {
        status: 'connected',
        message: `Ollama is running with ${ollamaModel} model`,
        url: ollamaUrl,
        models,
      };
    } else {
      throw new Error(`Ollama responded with HTTP ${ollamaRes.status}`);
    }
  } catch (_err) {
    services.ollama = {
      status: 'unavailable',
      message: 'Ollama is not reachable',
      url: ollamaUrl,
      models: [],
    };
    errors.push('Ollama is not running. Start it with: ollama serve');
  }

  // ---- 4. Claude API (lightweight key check — no real API call) ----
  const claudeKey = process.env.CLAUDE_API_KEY;
  const claudeModel = settings.ai?.claude_model || 'claude-sonnet-4-20250514';
  try {
    const apiKey = claudeKey || '';
    if (apiKey && apiKey.startsWith('sk-ant-')) {
      services.claude_api = {
        status: 'configured',
        provider: 'claude',
        message: 'API key configured',
        model: claudeModel,
      };
    } else if (apiKey) {
      services.claude_api = {
        status: 'configured',
        provider: 'unknown',
        message: 'API key configured',
        model: claudeModel,
      };
    } else {
      services.claude_api = {
        status: 'disconnected',
        provider: 'none',
        message: 'No API key configured',
        model: claudeModel,
      };
      errors.push('Claude API key not set. Add CLAUDE_API_KEY to functions/.env');
    }
  } catch (claudeErr) {
    services.claude_api = {
      status: 'error',
      message: claudeErr.message,
      model: claudeModel,
    };
  }

  // ---- 5. Google Sheets (real connection test) ----
  const sheetId = settings.google_sheets?.po_sheet_id || '';
  const sheetsStart = Date.now();
  if (sheetId) {
    try {
      const sheets = await getSheetsClient();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const spreadsheet = await Promise.race([
        sheets.spreadsheets.get({ spreadsheetId: sheetId, fields: 'properties.title' }),
        new Promise((_, reject) => {
          controller.signal.addEventListener('abort', () => reject(new Error('Timeout')));
        }),
      ]);
      clearTimeout(timer);

      const sheetTitle = spreadsheet.data?.properties?.title || 'Unknown';
      services.google_sheets = {
        status: 'connected',
        message: `Connected to "${sheetTitle}"`,
        sheet_id: sheetId.length > 8 ? `${sheetId.slice(0, 8)}...` : sheetId,
        sheet_name: sheetTitle,
        latency_ms: Date.now() - sheetsStart,
      };
    } catch (sheetsErr) {
      const errMsg = sheetsErr.message || 'Unknown error';
      services.google_sheets = {
        status: 'error',
        message: `Sheet ID set but connection failed: ${errMsg}`,
        sheet_id: sheetId.length > 8 ? `${sheetId.slice(0, 8)}...` : sheetId,
        latency_ms: Date.now() - sheetsStart,
      };
      errors.push(`Google Sheets connection failed: ${errMsg}`);
    }
  } else {
    services.google_sheets = {
      status: 'disconnected',
      message: 'Google Sheet ID is not configured',
      sheet_id: null,
      latency_ms: Date.now() - sheetsStart,
    };
    errors.push('Google Sheet ID not configured. Go to Settings and enter your Sheet ID.');
  }

  // ---- Overall status ----
  const firestoreOk = services.firestore?.status === 'connected';
  const qboOk = services.qbo_api?.status === 'connected';
  const ollamaOk = services.ollama?.status === 'connected';

  let overallStatus;
  if (!firestoreOk || !qboOk) {
    overallStatus = 'unhealthy';
  } else if (!ollamaOk) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'healthy';
  }

  res.status(200).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    services,
    errors,
  });
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

module.exports = router;
