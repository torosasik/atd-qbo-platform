'use strict';

const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const fetch = require('node-fetch');
const { logAction } = require('./logger');

const TOKEN_ENDPOINT = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const SETTINGS_DOC = 'settings/qbo_tokens';
const EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes in milliseconds
const { QBO_CONFIG } = require('./config');

/**
 * Fetches the QBO token document from Firestore.
 * NOTE: No caching is applied here — each call reads fresh from Firestore.
 * Module-level caching was intentionally avoided because Cloud Functions reuse
 * module state across warm invocations, which would cause stale token reads
 * and break automatic token refresh.
 */
async function getTokenDoc() {
  const db = getFirestore();
  return await db.doc(SETTINGS_DOC).get();
}

function getCredentials() {
  const clientId = process.env.QBO_CLIENT_ID;
  const clientSecret = process.env.QBO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('QBO_CLIENT_ID and QBO_CLIENT_SECRET must be set in functions/.env');
  }
  return { clientId, clientSecret };
}

async function getValidAccessToken() {
  try {
    const docSnap = await getTokenDoc();

    if (!docSnap.exists) {
      throw new Error('QBO token document not found in Firestore. OAuth setup required.');
    }

    const tokenData = docSnap.data();
    const { accessToken, accessTokenExpiry, refreshToken } = tokenData;

    if (!accessToken || !accessTokenExpiry || !refreshToken) {
      throw new Error('QBO token document is missing required fields.');
    }

    const expiryMs = accessTokenExpiry.toMillis();
    const nowMs = Date.now();

    if (expiryMs - nowMs <= EXPIRY_BUFFER_MS) {
      await logAction('qbo-auth', 'token-check', 'info', {
        message: 'Access token near expiry, refreshing.',
        expiresAt: accessTokenExpiry.toDate().toISOString()
      });
      return await refreshAccessToken(refreshToken);
    }

    return accessToken;
  } catch (err) {
    await logAction('qbo-auth', 'get-valid-access-token', 'error', {
      error: err.message
    });
    throw err;
  }
}

async function refreshAccessToken(refreshToken) {
  try {
    const { clientId, clientSecret } = getCredentials();
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    const responseBody = await response.json();

    if (!response.ok) {
      throw new Error(
        `Token refresh failed. Status: ${response.status}. ` +
        `Error: ${responseBody.error || 'unknown'}. ` +
        `Description: ${responseBody.error_description || 'none'}.`
      );
    }

    await saveTokens(responseBody);

    await logAction('qbo-auth', 'refresh-access-token', 'success', {
      message: 'Access token refreshed successfully.'
    });

    return responseBody.access_token;
  } catch (err) {
    await logAction('qbo-auth', 'refresh-access-token', 'error', {
      error: err.message
    });
    throw err;
  }
}

async function saveTokens(tokens) {
  try {
    const db = getFirestore();
    const docRef = db.doc(SETTINGS_DOC);
    const now = Date.now();

    const expiresInMs = (tokens.expires_in || 3600) * 1000;
    const refreshExpiresInMs = (tokens.x_refresh_token_expires_in || 8726400) * 1000;

    const accessTokenExpiry = Timestamp.fromMillis(now + expiresInMs);
    const refreshTokenExpiry = Timestamp.fromMillis(now + refreshExpiresInMs);

    const updatePayload = {
      accessToken: tokens.access_token,
      accessTokenExpiry,
      refreshTokenExpiry,
      lastRefreshed: FieldValue.serverTimestamp()
    };

    if (tokens.refresh_token) {
      updatePayload.refreshToken = tokens.refresh_token;
    }

    if (tokens.realmId) {
      updatePayload.realmId = tokens.realmId;
    }

    await docRef.set(updatePayload, { merge: true });

    await logAction('qbo-auth', 'save-tokens', 'success', {
      message: 'Tokens saved to Firestore.',
      accessTokenExpiry: accessTokenExpiry.toDate().toISOString(),
      refreshTokenExpiry: refreshTokenExpiry.toDate().toISOString()
    });
  } catch (err) {
    await logAction('qbo-auth', 'save-tokens', 'error', {
      error: err.message
    });
    throw err;
  }
}

async function getRealmId() {
  try {
    const docSnap = await getTokenDoc();

    if (!docSnap.exists) {
      throw new Error('QBO token document not found. Cannot retrieve realmId.');
    }

    const { realmId } = docSnap.data();

    if (!realmId) {
      throw new Error('realmId not set in Firestore settings/qbo_tokens.');
    }

    return realmId;
  } catch (err) {
    await logAction('qbo-auth', 'get-realm-id', 'error', {
      error: err.message
    });
    throw err;
  }
}

/**
 * Returns the QBO API base URL based on the current environment setting.
 * Reads from Firestore settings; defaults to production.
 */
async function getQboBaseUrl() {
  try {
    const { getSettings, DEFAULT_SETTINGS } = require('./settings');
    const settings = await getSettings();
    const env = settings.qbo?.environment || 'production';
    return env === 'production'
      ? settings.qbo?.production_base_url || QBO_CONFIG.production_base_url
      : settings.qbo?.sandbox_base_url || QBO_CONFIG.sandbox_base_url;
  } catch (_err) {
    return QBO_CONFIG.production_base_url;
  }
}

/**
 * Ensures a valid access token is available before making a QBO API call.
 * Reads token from Firestore, checks if it expires within 5 minutes,
 * refreshes automatically if needed. Throws with code QBO_AUTH_EXPIRED on failure.
 */
async function ensureValidToken() {
  try {
    return await getValidAccessToken();
  } catch (err) {
    const authError = new Error(
      `QBO authentication failed: ${err.message}. Re-authorize on the QBO Connect page.`
    );
    authError.code = 'QBO_AUTH_EXPIRED';
    throw authError;
  }
}

module.exports = {
  getValidAccessToken,
  refreshAccessToken,
  saveTokens,
  getRealmId,
  getQboBaseUrl,
  ensureValidToken
};
