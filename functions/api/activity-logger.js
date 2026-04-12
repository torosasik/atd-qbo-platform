'use strict';

const { getFirestore, FieldValue } = require('firebase-admin/firestore');

/**
 * Valid activity log types for the platform.
 */
const ACTIVITY_TYPES = [
  'PO_CREATED',
  'PO_UPDATED',
  'STATUS_CHANGE',
  'RULE_CHANGE',
  'SETTINGS_CHANGE',
  'SYNC_EVENT',
  'ERROR',
  'AI_ACTION',
];

/**
 * Write an activity log entry to the Firestore 'activity_logs' collection.
 *
 * @param {string} type - One of ACTIVITY_TYPES
 * @param {string} action - Short description of the action taken
 * @param {string} details - Human-readable detail string
 * @param {Object} [metadata={}] - Additional structured metadata
 * @param {string} [user='system'] - User or service that triggered the action
 * @returns {Promise<void>}
 */
async function logActivity(type, action, details, metadata = {}, user = 'system') {
  try {
    const db = getFirestore();
    await db.collection('activity_logs').add({
      type,
      action,
      details,
      user,
      metadata,
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    // Logging must never throw and break a caller
    console.error('[activity-logger] Failed to write activity log:', err.message, {
      type,
      action,
    });
  }
}

module.exports = { logActivity, ACTIVITY_TYPES };
