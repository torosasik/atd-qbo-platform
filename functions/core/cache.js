'use strict';

const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const fetch = require('node-fetch');
const { getValidAccessToken, getQboBaseUrl } = require('./qbo-auth');
const { logAction } = require('./logger');
const { getSettings, DEFAULT_SETTINGS } = require('./settings');
const CACHE_COLLECTION = 'cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function isCacheStale(fetchedAt) {
  if (!fetchedAt) return true;
  const fetchedAtMs = fetchedAt.toMillis();
  return Date.now() - fetchedAtMs > CACHE_TTL_MS;
}

async function saveToCache(docId, realmId, data) {
  const db = getFirestore();
  await db.collection(CACHE_COLLECTION).doc(docId).set({
    data,
    fetchedAt: FieldValue.serverTimestamp(),
    realmId
  });
}

function withCacheMeta(data, cacheData, stale = false) {
  return {
    data,
    meta: {
      lastSyncedAt: cacheData?.fetchedAt || null,
      stale,
    },
  };
}

async function fetchFromQbo(realmId, query) {
  const accessToken = await getValidAccessToken();
  const qboBaseUrl = await getQboBaseUrl();
  const encodedQuery = encodeURIComponent(query);
  const url = `${qboBaseUrl}/v3/company/${realmId}/query?query=${encodedQuery}&minorversion=65`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  const intuitTid = response.headers.get('intuit_tid');

  if (!response.ok) {
    const body = await response.text();
    throw Object.assign(
      new Error(`QBO query failed. Status: ${response.status}. Body: ${body}`),
      { intuitTid }
    );
  }

  const json = await response.json();
  return { queryResponse: json.QueryResponse, intuitTid };
}

/**
 * Fetch ALL records of a QBO entity type using paginated queries.
 * QBO returns at most 1000 records per page; we page through until exhausted.
 *
 * @param {string} realmId
 * @param {string} entity - QBO entity name, e.g. 'Item', 'Vendor', 'Account'
 * @returns {Promise<{ records: Array, intuitTid: string|null }>}
 */
async function fetchAllFromQbo(realmId, entity) {
  const PAGE_SIZE = 1000;
  const allRecords = [];
  let startPosition = 1;
  let lastIntuitTid = null;

  while (true) {
    const query = `SELECT * FROM ${entity} STARTPOSITION ${startPosition} MAXRESULTS ${PAGE_SIZE}`;
    const { queryResponse, intuitTid } = await fetchFromQbo(realmId, query);
    lastIntuitTid = intuitTid;
    const records = queryResponse?.[entity] || [];
    allRecords.push(...records);

    // Stop when fewer records than requested were returned (last page)
    if (records.length < PAGE_SIZE) break;
    startPosition += PAGE_SIZE;
  }

  return { records: allRecords, intuitTid: lastIntuitTid };
}

// ---------------------------------------------------------------------------
// Refresh functions
// ---------------------------------------------------------------------------

async function refreshVendors(realmId) {
  try {
    const { records: vendors, intuitTid } = await fetchAllFromQbo(realmId, 'Vendor');
    const docId = `vendors_${realmId}`;

    await saveToCache(docId, realmId, vendors);

    await logAction('cache', 'refresh-vendors', 'success', {
      realmId,
      count: vendors.length,
      intuitTid
    });

    return vendors;
  } catch (err) {
    await logAction('cache', 'refresh-vendors', 'error', {
      realmId,
      error: err.message,
      intuitTid: err.intuitTid || null
    });
    throw err;
  }
}

async function refreshItems(realmId) {
  try {
    const { records: items, intuitTid } = await fetchAllFromQbo(realmId, 'Item');
    const docId = `items_${realmId}`;

    await saveToCache(docId, realmId, items);

    await logAction('cache', 'refresh-items', 'success', {
      realmId,
      count: items.length,
      intuitTid
    });

    return items;
  } catch (err) {
    await logAction('cache', 'refresh-items', 'error', {
      realmId,
      error: err.message,
      intuitTid: err.intuitTid || null
    });
    throw err;
  }
}

async function refreshAccounts(realmId) {
  try {
    const { records: accounts, intuitTid } = await fetchAllFromQbo(realmId, 'Account');
    const docId = `accounts_${realmId}`;

    await saveToCache(docId, realmId, accounts);

    await logAction('cache', 'refresh-accounts', 'success', {
      realmId,
      count: accounts.length,
      intuitTid
    });

    return accounts;
  } catch (err) {
    await logAction('cache', 'refresh-accounts', 'error', {
      realmId,
      error: err.message,
      intuitTid: err.intuitTid || null
    });
    throw err;
  }
}

async function refreshCustomers(realmId) {
  try {
    const { records: customers, intuitTid } = await fetchAllFromQbo(realmId, 'Customer');
    const docId = `customers_${realmId}`;

    await saveToCache(docId, realmId, customers);

    await logAction('cache', 'refresh-customers', 'success', {
      realmId,
      count: customers.length,
      intuitTid
    });

    return customers;
  } catch (err) {
    await logAction('cache', 'refresh-customers', 'error', {
      realmId,
      error: err.message,
      intuitTid: err.intuitTid || null
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Public get functions (check cache first, refresh if stale)
// ---------------------------------------------------------------------------

async function getCachedVendors(realmId, options = {}) {
  const includeMeta = options.includeMeta === true;
  const db = getFirestore();
  const docId = `vendors_${realmId}`;

  try {
    const docSnap = await db.collection(CACHE_COLLECTION).doc(docId).get();
    const cacheData = docSnap.exists ? docSnap.data() : null;

    if (!cacheData || isCacheStale(cacheData.fetchedAt)) {
      const vendors = await refreshVendors(realmId);
      if (!includeMeta) return vendors;
      const refreshedDoc = await db.collection(CACHE_COLLECTION).doc(docId).get();
      const refreshedData = refreshedDoc.exists ? refreshedDoc.data() : null;
      return withCacheMeta(vendors, refreshedData, false);
    }

    if (includeMeta) return withCacheMeta(cacheData.data, cacheData, false);
    return cacheData.data;
  } catch (err) {
    await logAction('cache', 'get-cached-vendors', 'error', {
      realmId,
      error: err.message
    });

    // Attempt graceful degradation: return stale cache if available
    try {
      const docSnap = await db.collection(CACHE_COLLECTION).doc(docId).get();
      if (docSnap.exists) {
        await logAction('cache', 'get-cached-vendors', 'warn', {
          realmId,
          message: 'Returning stale vendor cache after refresh failure.'
        });
        const fallbackData = docSnap.data();
        if (includeMeta) return withCacheMeta(fallbackData.data, fallbackData, true);
        return fallbackData.data;
      }
    } catch (fallbackErr) {
      console.error('[getCachedVendors] Error fetching stale cache fallback:', fallbackErr.message);
    }

    throw err;
  }
}

async function getCachedItems(realmId) {
  const includeMeta = arguments[1]?.includeMeta === true;
  const db = getFirestore();
  const docId = `items_${realmId}`;

  try {
    const docSnap = await db.collection(CACHE_COLLECTION).doc(docId).get();
    const cacheData = docSnap.exists ? docSnap.data() : null;

    if (!cacheData || isCacheStale(cacheData.fetchedAt)) {
      const items = await refreshItems(realmId);
      if (!includeMeta) return items;
      const refreshedDoc = await db.collection(CACHE_COLLECTION).doc(docId).get();
      const refreshedData = refreshedDoc.exists ? refreshedDoc.data() : null;
      return withCacheMeta(items, refreshedData, false);
    }

    if (includeMeta) return withCacheMeta(cacheData.data, cacheData, false);
    return cacheData.data;
  } catch (err) {
    await logAction('cache', 'get-cached-items', 'error', {
      realmId,
      error: err.message
    });

    try {
      const docSnap = await db.collection(CACHE_COLLECTION).doc(docId).get();
      if (docSnap.exists) {
        await logAction('cache', 'get-cached-items', 'warn', {
          realmId,
          message: 'Returning stale item cache after refresh failure.'
        });
        const fallbackData = docSnap.data();
        if (includeMeta) return withCacheMeta(fallbackData.data, fallbackData, true);
        return fallbackData.data;
      }
    } catch (fallbackErr) {
      console.error('[getCachedItems] Error fetching stale cache fallback:', fallbackErr.message);
    }

    console.error('[getCachedItems] Error fetching items:', err.message);
    return [];
  }
}

async function getCachedCustomers(realmId) {
  const includeMeta = arguments[1]?.includeMeta === true;
  const db = getFirestore();
  const docId = `customers_${realmId}`;

  try {
    const docSnap = await db.collection(CACHE_COLLECTION).doc(docId).get();
    const cacheData = docSnap.exists ? docSnap.data() : null;

    if (!cacheData || isCacheStale(cacheData.fetchedAt)) {
      const customers = await refreshCustomers(realmId);
      if (!includeMeta) return customers;
      const refreshedDoc = await db.collection(CACHE_COLLECTION).doc(docId).get();
      const refreshedData = refreshedDoc.exists ? refreshedDoc.data() : null;
      return withCacheMeta(customers, refreshedData, false);
    }

    if (includeMeta) return withCacheMeta(cacheData.data, cacheData, false);
    return cacheData.data;
  } catch (err) {
    await logAction('cache', 'get-cached-customers', 'error', {
      realmId,
      error: err.message
    });

    try {
      const docSnap = await db.collection(CACHE_COLLECTION).doc(docId).get();
      if (docSnap.exists) {
        await logAction('cache', 'get-cached-customers', 'warn', {
          realmId,
          message: 'Returning stale customer cache after refresh failure.'
        });
        const fallbackData = docSnap.data();
        if (includeMeta) return withCacheMeta(fallbackData.data, fallbackData, true);
        return fallbackData.data;
      }
    } catch (fallbackErr) {
      console.error('[getCachedCustomers] Error fetching stale cache fallback:', fallbackErr.message);
    }

    console.error('[getCachedCustomers] Error fetching customers:', err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// fetchOpenInvoices
// Fetches open (unpaid) invoices for a specific customer from QBO.
// This is NOT cached long-term since invoice balances change frequently.
// ---------------------------------------------------------------------------

async function fetchOpenInvoices(realmId, customerId) {
  try {
    // Validate customerId is a non-empty string before using in query
    if (!customerId || typeof customerId !== 'string' || !/^\d+$/.test(customerId.trim())) {
      throw new Error(`Invalid customerId: '${customerId}'. Expected a numeric string.`);
    }
    const query = `SELECT * FROM Invoice WHERE CustomerRef = '${customerId}' AND Balance > '0' MAXRESULTS 200`;
    const { queryResponse, intuitTid } = await fetchFromQbo(realmId, query);
    const invoices = queryResponse?.Invoice || [];

    await logAction('cache', 'fetch-open-invoices', 'success', {
      realmId,
      customerId,
      count: invoices.length,
      intuitTid,
    });

    return invoices;
  } catch (err) {
    await logAction('cache', 'fetch-open-invoices', 'error', {
      realmId,
      customerId,
      error: err.message,
      intuitTid: err.intuitTid || null,
    });
    throw err;
  }
}

async function getCachedAccounts(realmId) {
  const includeMeta = arguments[1]?.includeMeta === true;
  const db = getFirestore();
  const docId = `accounts_${realmId}`;

  try {
    const docSnap = await db.collection(CACHE_COLLECTION).doc(docId).get();
    const cacheData = docSnap.exists ? docSnap.data() : null;

    if (!cacheData || isCacheStale(cacheData.fetchedAt)) {
      const accounts = await refreshAccounts(realmId);
      if (!includeMeta) return accounts;
      const refreshedDoc = await db.collection(CACHE_COLLECTION).doc(docId).get();
      const refreshedData = refreshedDoc.exists ? refreshedDoc.data() : null;
      return withCacheMeta(accounts, refreshedData, false);
    }

    if (includeMeta) return withCacheMeta(cacheData.data, cacheData, false);
    return cacheData.data;
  } catch (err) {
    await logAction('cache', 'get-cached-accounts', 'error', {
      realmId,
      error: err.message
    });

    try {
      const docSnap = await db.collection(CACHE_COLLECTION).doc(docId).get();
      if (docSnap.exists) {
        await logAction('cache', 'get-cached-accounts', 'warn', {
          realmId,
          message: 'Returning stale account cache after refresh failure.'
        });
        const fallbackData = docSnap.data();
        if (includeMeta) return withCacheMeta(fallbackData.data, fallbackData, true);
        return fallbackData.data;
      }
    } catch (fallbackErr) {
      console.error('[getCachedAccounts] Error fetching stale cache fallback:', fallbackErr.message);
    }

    console.error('[getCachedAccounts] Error fetching accounts:', err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// fetchUncategorizedExpenses
// Fetches Purchase transactions from QBO and filters for uncategorized ones.
// "Uncategorized" = lines with AccountRef pointing to "Uncategorized Expense"
// or lines missing an AccountRef entirely.
// ---------------------------------------------------------------------------

async function fetchUncategorizedExpenses(realmId) {
  try {
    // Fetch all Purchase (expense) transactions — QBO doesn't support filtering
    // by AccountRef in queries, so we fetch and filter client-side.
    const query = `SELECT * FROM Purchase MAXRESULTS 500`;
    const { queryResponse, intuitTid } = await fetchFromQbo(realmId, query);
    const purchases = queryResponse?.Purchase || [];

    // Filter for expenses that have at least one uncategorized line
    const uncategorized = purchases.filter((purchase) => {
      const lines = purchase.Line || [];
      return lines.some((line) => {
        if (line.DetailType === 'AccountBasedExpenseLineDetail') {
          const acctRef = line.AccountBasedExpenseLineDetail?.AccountRef;
          if (!acctRef || !acctRef.value) return true;
          // Check for "Uncategorized Expense" account name
          if ((acctRef.name || '').toLowerCase().includes('uncategorized')) return true;
        }
        return false;
      });
    });

    await logAction('cache', 'fetch-uncategorized-expenses', 'success', {
      realmId,
      totalPurchases: purchases.length,
      uncategorizedCount: uncategorized.length,
      intuitTid,
    });

    return uncategorized;
  } catch (err) {
    await logAction('cache', 'fetch-uncategorized-expenses', 'error', {
      realmId,
      error: err.message,
      intuitTid: err.intuitTid || null,
    });
    throw err;
  }
}

module.exports = {
  getCachedVendors,
  getCachedItems,
  getCachedAccounts,
  getCachedCustomers,
  fetchOpenInvoices,
  fetchUncategorizedExpenses,
  refreshVendors,
  refreshItems,
  refreshAccounts,
  refreshCustomers
};
