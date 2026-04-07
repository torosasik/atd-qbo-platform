'use strict';

const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const fetch = require('node-fetch');
const { getValidAccessToken } = require('./qbo-auth');
const { logAction } = require('./logger');
const { getSettings, DEFAULT_SETTINGS } = require('./settings');

async function getQboBaseUrl() {
  try {
    const settings = await getSettings();
    const env = settings.qbo.environment;
    return env === 'production'
      ? settings.qbo.production_base_url
      : settings.qbo.sandbox_base_url;
  } catch (_err) {
    return DEFAULT_SETTINGS.qbo.sandbox_base_url;
  }
}
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

// ---------------------------------------------------------------------------
// Public get functions (check cache first, refresh if stale)
// ---------------------------------------------------------------------------

async function getCachedVendors(realmId) {
  const db = getFirestore();
  const docId = `vendors_${realmId}`;

  try {
    const docSnap = await db.collection(CACHE_COLLECTION).doc(docId).get();
    const cacheData = docSnap.exists ? docSnap.data() : null;

    if (!cacheData || isCacheStale(cacheData.fetchedAt)) {
      return await refreshVendors(realmId);
    }

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
        return docSnap.data().data;
      }
    } catch (fallbackErr) {
      console.error('[getCachedVendors] Error fetching stale cache fallback:', fallbackErr.message);
    }

    throw err;
  }
}

async function getCachedItems(realmId) {
  const db = getFirestore();
  const docId = `items_${realmId}`;

  try {
    const docSnap = await db.collection(CACHE_COLLECTION).doc(docId).get();
    const cacheData = docSnap.exists ? docSnap.data() : null;

    if (!cacheData || isCacheStale(cacheData.fetchedAt)) {
      return await refreshItems(realmId);
    }

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
        return docSnap.data().data;
      }
    } catch (fallbackErr) {
      console.error('[getCachedItems] Error fetching stale cache fallback:', fallbackErr.message);
    }

    console.error('[getCachedItems] Error fetching items:', err.message);
    return [];
  }
}

async function getCachedAccounts(realmId) {
  const db = getFirestore();
  const docId = `accounts_${realmId}`;

  try {
    const docSnap = await db.collection(CACHE_COLLECTION).doc(docId).get();
    const cacheData = docSnap.exists ? docSnap.data() : null;

    if (!cacheData || isCacheStale(cacheData.fetchedAt)) {
      return await refreshAccounts(realmId);
    }

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
        return docSnap.data().data;
      }
    } catch (fallbackErr) {
      console.error('[getCachedAccounts] Error fetching stale cache fallback:', fallbackErr.message);
    }

    console.error('[getCachedAccounts] Error fetching accounts:', err.message);
    return [];
  }
}

module.exports = {
  getCachedVendors,
  getCachedItems,
  getCachedAccounts,
  refreshVendors,
  refreshItems,
  refreshAccounts
};
