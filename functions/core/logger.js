const { getFirestore, FieldValue } = require('firebase-admin/firestore');

/**
 * Log an action to the Firestore 'logs' collection.
 *
 * @param {string} module - Module name (e.g. 'purchase-order', 'qbo-auth')
 * @param {string} action - Action taken (e.g. 'create', 'refresh-token', 'ai-review')
 * @param {string} status - Result status: 'success', 'error', 'rejected', 'skipped'
 * @param {Object} details - Any extra context (entityId, intuitTid, error message, etc.)
 * @returns {Promise<void>}
 */
async function logAction(module, action, status, details = {}) {
  try {
    const db = getFirestore();
    await db.collection('logs').add({
      module,
      action,
      status,
      details,
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    // Logging must never throw and break a caller - write to stderr only
    console.error('[logger] Failed to write log entry:', err.message, {
      module,
      action,
      status,
    });
  }
}

module.exports = { logAction };
