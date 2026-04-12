// INTUIT DEVELOPER PORTAL: Update redirect URI at https://developer.intuit.com
// Current redirect URI: https://us-central1-atd-qbo-platform.cloudfunctions.net/api/auth/callback
'use strict';

const fetch = require('node-fetch');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getSettings } = require('./settings');
const { saveTokens } = require('./qbo-auth');
const { logAction } = require('./logger');

const INTUIT_AUTH_BASE = 'https://appcenter.intuit.com/connect/oauth2';
const INTUIT_TOKEN_ENDPOINT = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const QBO_SCOPE = 'com.intuit.quickbooks.accounting';
const QBO_TOKENS_DOC = 'settings/qbo_tokens';

/**
 * Build the Intuit OAuth 2.0 authorization URL and persist a CSRF state token.
 * The caller should redirect the user to the returned URL.
 *
 * @returns {Promise<string>} The full authorization URL.
 */
async function getOAuthUrl() {
  const clientId = process.env.QBO_CLIENT_ID;
  if (!clientId) throw new Error('QBO_CLIENT_ID must be set in functions/.env');

  const settings = await getSettings();
  const redirectUri = settings.oauth.redirect_uri;

  const csrfToken = Math.random().toString(36).slice(2);
  const db = getFirestore();
  await db.doc(QBO_TOKENS_DOC).set({ oauthState: csrfToken }, { merge: true });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: QBO_SCOPE,
    state: csrfToken,
  });

  return `${INTUIT_AUTH_BASE}?${params.toString()}`;
}

/**
 * Exchange an authorization code for tokens and persist them.
 * Verifies the CSRF state token before proceeding.
 *
 * @param {string} code - Authorization code from Intuit callback.
 * @param {string} realmId - QBO company ID from Intuit callback query param.
 * @param {string} state - State value from Intuit callback, verified against stored CSRF token.
 * @returns {Promise<void>}
 * @throws {Error} If state is invalid or token exchange fails.
 */
async function handleCallback(code, realmId, state) {
  const db = getFirestore();
  const tokenDoc = await db.doc(QBO_TOKENS_DOC).get();
  const savedState = tokenDoc.exists ? tokenDoc.data().oauthState : null;

  if (!state || state !== savedState) {
    await logAction('qbo-auth', 'oauth-callback', 'error', { error: 'State mismatch. Possible CSRF.' });
    throw new Error('state_mismatch');
  }

  const clientId = process.env.QBO_CLIENT_ID;
  const clientSecret = process.env.QBO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('QBO_CLIENT_ID and QBO_CLIENT_SECRET must be set in functions/.env');
  }

  const settings = await getSettings();
  const redirectUri = settings.oauth.redirect_uri;

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const tokenResponse = await fetch(INTUIT_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  const tokenBody = await tokenResponse.json();
  if (!tokenResponse.ok) {
    const errMsg = tokenBody.error_description || tokenBody.error || `HTTP ${tokenResponse.status}`;
    await logAction('qbo-auth', 'oauth-callback', 'error', { error: errMsg });
    throw new Error(errMsg);
  }

  await saveTokens({ ...tokenBody, realmId });
  await db.doc(QBO_TOKENS_DOC).update({ oauthState: FieldValue.delete() });
  await logAction('qbo-auth', 'oauth-callback', 'success', { realmId });
}

module.exports = { getOAuthUrl, handleCallback, QBO_TOKENS_DOC };
