import { auth } from '../firebase';
import { api } from './api';

/**
 * Log an activity to the Activity Log backend.
 * @param {string} action - Activity type (e.g. 'PO_CREATED', 'RULE_DELETED')
 * @param {string} detail - Human-readable detail string
 */
export async function logActivity(action, detail) {
  try {
    const user = auth.currentUser;
    const entry = {
      action,
      detail,
      user: user?.email || 'unknown@atd.com',
      timestamp: new Date().toISOString(),
    };
    await api.postActivityLog(entry);
  } catch (err) {
    // Silently fail — activity logging should never break user workflows
    console.warn('[ActivityLog] Failed to write log entry:', err?.message);
  }
}
