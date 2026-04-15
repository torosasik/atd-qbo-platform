'use strict';

const express = require('express');
const fetch = require('node-fetch');
const { getCachedVendors, getCachedItems, getCachedCustomers, getCachedAccounts, fetchOpenInvoices, refreshItems, refreshVendors, refreshCustomers } = require('../core/cache');
const { getRealmId, refreshAccessToken, getQboBaseUrl, getValidAccessToken, ensureValidToken } = require('../core/qbo-auth');
const { getSettings } = require('../core/settings');
const { logAction } = require('../core/logger');
const { validateRequest, sendError, sendSuccess, retryOperation, schemas } = require('./middleware');

const router = express.Router();

// GET /open-invoices/:customerId
router.get('/open-invoices/:customerId', async (req, res, next) => {
  try {
    await ensureValidToken();
    const realmId = await getRealmId();
    const { customerId } = req.params;

    if (!customerId) {
      const error = new Error('customerId is required');
      error.status = 400;
      return next(error);
    }

    const invoices = await fetchOpenInvoices(realmId, customerId);
    sendSuccess(res, { invoices });
  } catch (err) {
    next(err);
  }
});

// GET /customers
router.get('/customers', async (req, res, next) => {
  try {
    await ensureValidToken();
    const realmId = await getRealmId();
    const { data: customers, meta } = await getCachedCustomers(realmId, { includeMeta: true });
    sendSuccess(res, { customers, lastSyncedAt: meta.lastSyncedAt, stale: meta.stale });
  } catch (err) {
    if (err.code === 'QBO_AUTH_EXPIRED') {
      const error = new Error('QuickBooks connection is not available');
      error.code = err.code;
      error.status = 200;
      error.fix = 'Go to QBO Connect page and click Connect to QuickBooks';
      return next(error);
    }
    next(err);
  }
});

// GET /vendors
router.get('/vendors', async (req, res, next) => {
  try {
    await ensureValidToken();
    const realmId = await getRealmId();
    const { data: vendors, meta } = await getCachedVendors(realmId, { includeMeta: true });
    sendSuccess(res, { vendors, lastSyncedAt: meta.lastSyncedAt, stale: meta.stale });
  } catch (err) {
    if (err.code === 'QBO_AUTH_EXPIRED') {
      const error = new Error('QuickBooks connection is not available');
      error.code = err.code;
      error.status = 200;
      error.fix = 'Go to QBO Connect page and click Connect to QuickBooks';
      return next(error);
    }
    next(err);
  }
});

// GET /items
router.get('/items', async (req, res, next) => {
  try {
    await ensureValidToken();
    const realmId = await getRealmId();
    const { data: items, meta } = await getCachedItems(realmId, { includeMeta: true });
    sendSuccess(res, { items, lastSyncedAt: meta.lastSyncedAt, stale: meta.stale });
  } catch (err) {
    if (err.code === 'QBO_AUTH_EXPIRED') {
      const error = new Error('QuickBooks connection is not available');
      error.code = err.code;
      error.status = 200;
      error.fix = 'Go to QBO Connect page and click Connect to QuickBooks';
      return next(error);
    }
    next(err);
  }
});

// POST /items/create
router.post('/items/create', validateRequest(schemas.itemCreate), async (req, res, next) => {
  try {
    await ensureValidToken();
    const realmId = await getRealmId();
    const { name, type, description, unitPrice } = req.body;

    if (!name || !name.trim()) {
      const error = new Error('Item name is required.');
      error.status = 400;
      return next(error);
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
    // Look up account IDs dynamically from the user's QBO accounts instead of hardcoding.
    const settings = await getSettings();
    const accounts = await getCachedAccounts(realmId);

    // Helper: find first account matching a type (case-insensitive)
    function findAccountByType(accountType) {
      const normalized = accountType.toLowerCase();
      const match = accounts.find((a) => (a.AccountType || '').toLowerCase() === normalized);
      return match ? match.Id : null;
    }

    // Helper: find account by name pattern (fallback for common defaults)
    function findAccountByName(patterns) {
      for (const acct of accounts) {
        const name = (acct.Name || '').toLowerCase();
        if (patterns.some((p) => name.includes(p))) return acct.Id;
      }
      return null;
    }

    const incomeAcct  = settings.qbo.default_income_account  || findAccountByType('Income')  || findAccountByName(['sales', 'income', 'revenue']);
    const expenseAcct = settings.qbo.default_expense_account || findAccountByType('Expense') || findAccountByName(['expense', 'supplies', 'materials']);
    const assetAcct   = settings.qbo.default_asset_account   || findAccountByType('Other Current Asset') || findAccountByName(['inventory asset', 'asset']);
    const cogsAcct    = settings.qbo.default_cogs_account    || findAccountByType('Cost of Goods Sold')  || findAccountByName(['cost of goods', 'cogs']);

    if (type === 'Inventory') {
      if (incomeAcct)  itemPayload.IncomeAccountRef = { value: incomeAcct };
      if (assetAcct)   itemPayload.AssetAccountRef  = { value: assetAcct };
      if (cogsAcct)    itemPayload.COGSAccountRef   = { value: cogsAcct };
      itemPayload.QtyOnHand = 0;
    } else {
      // NonInventory / Service items require both IncomeAccountRef and ExpenseAccountRef
      if (incomeAcct)  itemPayload.IncomeAccountRef  = { value: incomeAcct };
      if (expenseAcct) itemPayload.ExpenseAccountRef = { value: expenseAcct };
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
      const error = new Error(createData.Fault?.Error?.[0]?.Detail || createData.message || 'Failed to create item in QuickBooks.');
      error.status = 400;
      return next(error);
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

    sendSuccess(res, { item: newItem }, `Item "${newItem.Name}" created successfully.`);
  } catch (err) {
    await logAction('items', 'create-item', 'error', { error: err.message });
    next(err);
  }
});

// GET /accounts
router.get('/accounts', async (req, res, next) => {
  try {
    await ensureValidToken();
    const realmId = await getRealmId();
    const { data: accounts, meta } = await getCachedAccounts(realmId, { includeMeta: true });

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

    sendSuccess(res, { accounts: expenseAccounts, lastSyncedAt: meta.lastSyncedAt, stale: meta.stale });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
