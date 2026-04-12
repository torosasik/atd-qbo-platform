'use strict';

const express = require('express');
const { getFirestore } = require('firebase-admin/firestore');
const { getSettings } = require('../core/settings');
const { ensureValidToken, getQboBaseUrl } = require('../core/qbo-auth');
const { QBO_TOKENS_DOC } = require('../core/google-auth');
const { getSheetsClient } = require('../core/sheets-connector');

const router = express.Router();

// GET / (mounted at /health in index.js via apiRouter.use('/health', healthRoutes))
router.get('/', async (req, res) => {
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
          let timer;
          try {
            const accessToken = await ensureValidToken();
            const baseUrl = await getQboBaseUrl();
            const realmId = data.realmId;

            const controller = new AbortController();
            timer = setTimeout(() => controller.abort(), 5000);
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
          } finally {
            if (timer) {
              clearTimeout(timer);
            }
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

  const aiMode = settings.ai?.mode || 'cloud';
  const ollamaUrl = settings.ai?.ollama_url || 'http://localhost:11434';
  const ollamaModel = settings.ai?.ollama_model || 'llama3';
  const claudeModel = settings.ai?.claude_model || 'claude-sonnet-4-20250514';

  // ---- 3. AI provider checks (mode-aware) ----
  if (aiMode === 'off') {
    services.ollama = {
      status: 'not_configured',
      message: 'AI mode is off',
      url: ollamaUrl,
      models: [],
    };
    services.claude_api = {
      status: 'not_configured',
      provider: 'claude',
      message: 'AI mode is off',
      model: claudeModel,
    };
  }

  if (aiMode === 'ollama') {
    let ollamaTimer;
    try {
      const controller = new AbortController();
      ollamaTimer = setTimeout(() => controller.abort(), 3000);
      const ollamaRes = await fetch(`${ollamaUrl}/api/tags`, { signal: controller.signal });
      clearTimeout(ollamaTimer);

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
      if (ollamaTimer) clearTimeout(ollamaTimer);
      services.ollama = {
        status: 'unavailable',
        message: 'Ollama is not reachable',
        url: ollamaUrl,
        models: [],
      };
      errors.push('Ollama is not running. Start it with: ollama serve');
    }

    services.claude_api = {
      status: 'not_configured',
      provider: 'claude',
      message: 'Inactive because AI mode is Local Ollama',
      model: claudeModel,
    };
  }

  // ---- 4. Claude API (lightweight key check — no real API call) ----
  if (aiMode === 'cloud') {
  const claudeKey = process.env.CLAUDE_API_KEY;
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

    services.ollama = {
      status: 'not_configured',
      message: 'Inactive because AI mode is Cloud/API AI',
      url: ollamaUrl,
      models: [],
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
  const aiModeOk = aiMode === 'off'
    ? true
    : aiMode === 'ollama'
      ? services.ollama?.status === 'connected'
      : services.claude_api?.status === 'configured';

  let overallStatus;
  if (!firestoreOk || !qboOk) {
    overallStatus = 'unhealthy';
  } else if (!aiModeOk) {
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

module.exports = router;
