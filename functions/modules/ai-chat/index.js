'use strict';

const { getFirestore } = require('firebase-admin/firestore');
const { askAI } = require('../../core/ai-router');
const { logAction } = require('../../core/logger');
const { getCachedVendors, getCachedItems } = require('../../core/cache');
const { getRealmId } = require('../../core/qbo-auth');
const { buildChatSystemPrompt, detectDataNeeds, enrichWithData } = require('./system-prompts');

// ---------------------------------------------------------------------------
// fetchContextData
// Fetches Firestore and cache data based on what the message needs.
// Failures are swallowed so a missing data source never blocks the response.
// ---------------------------------------------------------------------------

async function fetchContextData(needs) {
  const data = {};
  const fetches = [];

  if (needs.includes('recent_pos')) {
    fetches.push(
      (async () => {
        try {
          const db = getFirestore();
          // Pending drafts
          const draftsSnap = await db
            .collection('po_drafts')
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();
          const drafts = draftsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

          // Recently pushed POs from logs
          const logsSnap = await db
            .collection('logs')
            .where('module', '==', 'purchase-order')
            .where('action', '==', 'push-to-qbo')
            .where('status', '==', 'success')
            .orderBy('timestamp', 'desc')
            .limit(5)
            .get();
          const pushed = logsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

          data.recent_pos = [...drafts, ...pushed];
        } catch (_err) {
          data.recent_pos = [];
        }
      })()
    );
  }

  if (needs.includes('vendors')) {
    fetches.push(
      (async () => {
        try {
          const realmId = await getRealmId();
          data.vendors = await getCachedVendors(realmId);
        } catch (_err) {
          data.vendors = [];
        }
      })()
    );
  }

  if (needs.includes('items')) {
    fetches.push(
      (async () => {
        try {
          const realmId = await getRealmId();
          data.items = await getCachedItems(realmId);
        } catch (_err) {
          data.items = [];
        }
      })()
    );
  }

  if (needs.includes('logs')) {
    fetches.push(
      (async () => {
        try {
          const db = getFirestore();
          const snap = await db
            .collection('logs')
            .orderBy('timestamp', 'desc')
            .limit(20)
            .get();
          data.logs = snap.docs.map((doc) => {
            const d = doc.data();
            return {
              ...d,
              timestamp: d.timestamp ? d.timestamp.toMillis() : null,
            };
          });
        } catch (_err) {
          data.logs = [];
        }
      })()
    );
  }

  await Promise.all(fetches);
  return data;
}

// ---------------------------------------------------------------------------
// handleChatMessage
// POST /api/ai/chat
// Body: { message: string, context?: any }
// Returns: { success, reply, source, confidence }
// ---------------------------------------------------------------------------

async function handleChatMessage(req, res) {
  const { message, context } = req.body || {};

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ success: false, error: 'message is required and must be a non-empty string' });
  }

  try {
    // Determine what live data the question needs
    const needs = detectDataNeeds(message.trim());

    // Fetch relevant data in parallel
    const contextData = await fetchContextData(needs);

    // Build the full prompt: system instructions + enriched message
    const systemPrompt = buildChatSystemPrompt();
    const enrichedMessage = enrichWithData(message.trim(), contextData);
    const fullPrompt = `${systemPrompt}\n\n${enrichedMessage}`;

    // Ask the AI
    const aiResult = await askAI(fullPrompt, { module: 'ai-chat' });

    // Log the interaction
    await logAction('ai-chat', 'chat-message', aiResult.source === 'none' ? 'skipped' : 'success', {
      messageLength: message.length,
      source: aiResult.source,
      confidence: aiResult.confidence,
      dataNeeds: needs,
    });

    if (aiResult.source === 'none') {
      return res.status(503).json({
        success: false,
        error: 'AI service is currently unavailable. Please try again later.',
      });
    }

    return res.status(200).json({
      success: true,
      reply: aiResult.answer,
      source: aiResult.source,
      confidence: aiResult.confidence,
    });
  } catch (err) {
    await logAction('ai-chat', 'chat-message', 'error', { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { handleChatMessage };
