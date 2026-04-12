'use strict';

const express = require('express');
const Joi = require('joi');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { validateRequest, sendSuccess } = require('./middleware');
const { ACTIVITY_TYPES } = require('./activity-logger');

const router = express.Router();

const activityLogSchema = Joi.object({
  type: Joi.string().valid(...ACTIVITY_TYPES).required(),
  action: Joi.string().trim().min(1).required(),
  details: Joi.string().trim().allow('').optional(),
  user: Joi.string().trim().optional(),
  metadata: Joi.object().optional(),
});

/**
 * POST /api/activity-log
 * Save a new activity log entry to Firestore.
 */
router.post('/', validateRequest(activityLogSchema), async (req, res, next) => {
  try {
    const { type, action, details = '', user = 'system', metadata = {} } = req.body;
    const db = getFirestore();
    const docRef = await db.collection('activity_logs').add({
      type,
      action,
      details,
      user,
      metadata,
      timestamp: FieldValue.serverTimestamp(),
    });
    sendSuccess(res, { id: docRef.id }, 'Activity log entry created.');
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/activity-log
 * List activity log entries with optional filters.
 * Query params: type, startDate, endDate, search, limit (default 50), offset (default 0)
 */
router.get('/', async (req, res, next) => {
  try {
    const {
      type,
      startDate,
      endDate,
      search,
      limit: limitParam = '50',
      offset: offsetParam = '0',
    } = req.query;

    const limit = Math.min(parseInt(limitParam, 10) || 50, 200);
    const offset = parseInt(offsetParam, 10) || 0;

    const db = getFirestore();
    let query = db.collection('activity_logs').orderBy('timestamp', 'desc');

    if (type && ACTIVITY_TYPES.includes(type)) {
      query = query.where('type', '==', type);
    }

    if (startDate) {
      query = query.where('timestamp', '>=', new Date(startDate));
    }

    if (endDate) {
      query = query.where('timestamp', '<=', new Date(endDate));
    }

    // Fetch enough docs to support offset-based pagination
    const snapshot = await query.limit(offset + limit).get();

    let entries = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        type: data.type,
        action: data.action,
        details: data.details || '',
        user: data.user || 'system',
        metadata: data.metadata || {},
        timestamp: data.timestamp
          ? (data.timestamp.toDate ? data.timestamp.toDate().toISOString() : new Date(data.timestamp._seconds * 1000).toISOString())
          : null,
      };
    });

    // Apply offset slice
    entries = entries.slice(offset);

    // Client-side search filter (Firestore doesn't support full-text search)
    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      entries = entries.filter(
        (e) =>
          (e.action && e.action.toLowerCase().includes(term)) ||
          (e.details && e.details.toLowerCase().includes(term)) ||
          (e.type && e.type.toLowerCase().includes(term)) ||
          (e.user && e.user.toLowerCase().includes(term))
      );
    }

    sendSuccess(res, {
      entries,
      total: entries.length,
      limit,
      offset,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
