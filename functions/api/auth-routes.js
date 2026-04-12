'use strict';

const express = require('express');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getOAuthUrl, handleCallback, QBO_TOKENS_DOC } = require('../core/google-auth');
const { refreshAccessToken } = require('../core/qbo-auth');
const { logAction } = require('../core/logger');
const { sendSuccess } = require('./middleware');

const router = express.Router();

// GET /auth/connect
router.get('/connect', async (req, res, next) => {
  try {
    const url = await getOAuthUrl();
    return res.redirect(url);
  } catch (err) {
    await logAction('qbo-auth', 'oauth-connect', 'error', { error: err.message });
    next(err);
  }
});

// GET /auth/callback
router.get('/callback', async (req, res, next) => {
  try {
    const { code, state, realmId, error: oauthError } = req.query;

    if (oauthError) {
      await logAction('qbo-auth', 'oauth-callback', 'error', { oauthError });
      return res.redirect('/?auth=error&reason=' + encodeURIComponent(oauthError));
    }

    await handleCallback(code, realmId, state);
    // Redirect to QBO Connect page after successful token storage in Firestore
    return res.redirect('https://atd-qbo-platform.web.app/qbo-connect?status=connected');
  } catch (err) {
    await logAction('qbo-auth', 'oauth-callback', 'error', { error: err.message });
    return res.redirect('/?auth=error&reason=' + encodeURIComponent(err.message));
  }
});

// GET /auth/status
router.get('/status', async (req, res, next) => {
  try {
    const db = getFirestore();
    const docSnap = await db.doc(QBO_TOKENS_DOC).get();

    if (!docSnap.exists) {
      return sendSuccess(res, { connected: false });
    }

    const data = docSnap.data();
    const connected = Boolean(data.accessToken && data.refreshToken && data.realmId);

    sendSuccess(res, {
      connected,
      realmId: data.realmId || null,
      tokenExpiry: data.accessTokenExpiry ? data.accessTokenExpiry.toDate().toISOString() : null,
      lastRefreshed: data.lastRefreshed ? data.lastRefreshed.toDate().toISOString() : null,
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/disconnect
router.post('/disconnect', async (req, res, next) => {
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
    sendSuccess(res, null, 'Disconnected from QuickBooks.');
  } catch (err) {
    await logAction('qbo-auth', 'disconnect', 'error', { error: err.message });
    next(err);
  }
});

// POST /auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const db = getFirestore();
    const docSnap = await db.doc(QBO_TOKENS_DOC).get();

    if (!docSnap.exists || !docSnap.data().refreshToken) {
      const error = new Error('No refresh token stored. Connect to QuickBooks first.');
      error.status = 400;
      return next(error);
    }

    const newAccessToken = await refreshAccessToken(docSnap.data().refreshToken);
    const updated = await db.doc(QBO_TOKENS_DOC).get();

    sendSuccess(res, {
      message: 'Access token refreshed.',
      tokenExpiry: updated.data().accessTokenExpiry
        ? updated.data().accessTokenExpiry.toDate().toISOString()
        : null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;