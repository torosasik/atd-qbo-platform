'use strict';

/**
 * AI Router for the ATD QBO Automation Platform.
 *
 * Selects the best available AI provider for each request:
 *   1. Ollama (local, free) - primary
 *   2. Claude API (cloud, paid) - fallback or escalation when confidence < 90
 *   3. None - when both are unavailable
 *
 * Primary export:
 *   askAI(prompt, options) -> Promise<{ answer, confidence, source }>
 */

const fetch = require('node-fetch');
const { logAction } = require('./logger');
const { getSettings, DEFAULT_SETTINGS } = require('./settings');

function getClaudeApiKey() {
  return process.env.CLAUDE_API_KEY || null;
}

const CLAUDE_MESSAGES_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const OLLAMA_AVAILABILITY_TIMEOUT_MS = 3000;

// ---------------------------------------------------------------------------
// Internal: Ollama helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if Ollama is reachable within the timeout window.
 *
 * @returns {Promise<boolean>}
 */
async function loadAiSettings() {
  try {
    const settings = await getSettings();
    return {
      ollamaUrl: settings.ai.ollama_url || DEFAULT_SETTINGS.ai.ollama_url,
      claudeModel: settings.ai.claude_model || DEFAULT_SETTINGS.ai.claude_model,
      confidenceThreshold: typeof settings.ai.min_confidence === 'number'
        ? settings.ai.min_confidence
        : DEFAULT_SETTINGS.ai.min_confidence,
    };
  } catch (_err) {
    return {
      ollamaUrl: DEFAULT_SETTINGS.ai.ollama_url,
      claudeModel: DEFAULT_SETTINGS.ai.claude_model,
      confidenceThreshold: DEFAULT_SETTINGS.ai.min_confidence,
    };
  }
}

async function isOllamaAvailable(ollamaUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OLLAMA_AVAILABILITY_TIMEOUT_MS);
  try {
    const res = await fetch(`${ollamaUrl}/api/tags`, { signal: controller.signal });
    return res.ok;
  } catch (_err) {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse a confidence value out of an Ollama response string.
 * Looks for the first JSON object containing a numeric "confidence" key,
 * e.g. {"confidence": 87}. Returns 80 if none is found.
 *
 * @param {string} content
 * @returns {number}
 */
function parseOllamaConfidence(content) {
  try {
    const match = content.match(/\{[^{}]*"confidence"\s*:\s*(\d+(?:\.\d+)?)[^{}]*\}/);
    if (match) {
      const value = parseFloat(match[1]);
      if (!isNaN(value)) return Math.min(100, Math.max(0, value));
    }
  } catch (_err) {
    // Fall through to default.
  }
  return 80;
}

/**
 * Send a prompt to Ollama and return the raw response content.
 *
 * @param {string} prompt
 * @param {string} model
 * @returns {Promise<string>} Response text from the model.
 * @throws If the HTTP request fails or returns a non-OK status.
 */
async function callOllama(prompt, model, ollamaUrl) {
  const res = await fetch(`${ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama responded with HTTP ${res.status}`);
  }

  const data = await res.json();
  // Ollama chat endpoint returns { message: { role, content }, ... }
  return data.message.content;
}

// ---------------------------------------------------------------------------
// Internal: Claude helper
// ---------------------------------------------------------------------------

/**
 * Send a prompt to the Claude API and return the response text.
 *
 * @param {string} prompt
 * @returns {Promise<string>} Response text from Claude.
 * @throws If the HTTP request fails, returns a non-OK status, or the API key is missing.
 */
async function callClaude(prompt, claudeModel) {
  const apiKey = getClaudeApiKey();
  if (!apiKey) {
    throw new Error('CLAUDE_API_KEY must be set in functions/.env');
  }

  const res = await fetch(CLAUDE_MESSAGES_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: claudeModel,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Claude API responded with HTTP ${res.status}: ${body}`);
  }

  const data = await res.json();
  // Claude Messages API returns { content: [{ type: 'text', text: '...' }, ...] }
  return data.content[0].text;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Route an AI prompt to the best available provider.
 *
 * Decision order:
 *   1. If Ollama is reachable, call it.
 *      a. If confidence >= 90, return the Ollama result.
 *      b. If confidence < 90, escalate to Claude API.
 *   2. If Ollama is unreachable or throws, fall back to Claude API.
 *   3. If Claude also fails, return { answer: '', confidence: 0, source: 'none' }.
 *
 * @param {string} prompt - The prompt to send to the AI.
 * @param {Object} [options={}]
 * @param {string} [options.module='unknown'] - Module name used for audit logging.
 * @param {string} [options.ollamaModel='llama3'] - Ollama model to use.
 * @returns {Promise<{ answer: string, confidence: number, source: 'ollama' | 'claude' | 'none' }>}
 */
async function askAI(prompt, options = {}) {
  const module = options.module || 'unknown';

  const { ollamaUrl, claudeModel, confidenceThreshold } = await loadAiSettings();
  const ollamaModel = options.ollamaModel || DEFAULT_SETTINGS.ai.ollama_model;

  // -------------------------------------------------------------------------
  // Attempt 1: Ollama (local, free)
  // -------------------------------------------------------------------------
  const ollamaReachable = await isOllamaAvailable(ollamaUrl);

  if (ollamaReachable) {
    try {
      const content = await callOllama(prompt, ollamaModel, ollamaUrl);
      const confidence = parseOllamaConfidence(content);

      if (confidence >= confidenceThreshold) {
        await logAction(module, 'ai-review', 'success', {
          source: 'ollama',
          model: ollamaModel,
          confidence,
          promptLength: prompt.length,
        });
        return { answer: content, confidence, source: 'ollama' };
      }

      // Low confidence from Ollama: escalate to Claude.
      // The Claude call happens in the block below; fall through intentionally.
    } catch (ollamaErr) {
      await logAction(module, 'ai-review', 'error', {
        source: 'ollama',
        model: ollamaModel,
        confidence: 0,
        promptLength: prompt.length,
        error: ollamaErr.message,
      });
      // Fall through to Claude.
    }
  }

  // -------------------------------------------------------------------------
  // Attempt 2: Claude API (cloud, paid)
  // -------------------------------------------------------------------------
  try {
    const content = await callClaude(prompt, claudeModel);
    const confidence = 95;

    await logAction(module, 'ai-review', 'success', {
      source: 'claude',
      model: claudeModel,
      confidence,
      promptLength: prompt.length,
    });

    return { answer: content, confidence, source: 'claude' };
  } catch (claudeErr) {
    await logAction(module, 'ai-review', 'error', {
      source: 'claude',
      model: claudeModel,
      confidence: 0,
      promptLength: prompt.length,
      error: claudeErr.message,
    });
  }

  // -------------------------------------------------------------------------
  // Attempt 3: Both unavailable. Skip AI review and flag for human decision.
  // -------------------------------------------------------------------------
  await logAction(module, 'ai-review', 'skipped', {
    source: 'none',
    model: null,
    confidence: 0,
    promptLength: prompt.length,
    reason: 'Both Ollama and Claude API are unavailable',
  });

  return { answer: '', confidence: 0, source: 'none' };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { askAI };
