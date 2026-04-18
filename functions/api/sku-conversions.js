'use strict';

const express = require('express');
const Joi = require('joi');
const { getFirestore } = require('firebase-admin/firestore');
const { sendSuccess } = require('./middleware');

const router = express.Router();
const COLLECTION = 'sku_conversions';

const recordSchema = Joi.object({
  sku: Joi.string().trim().min(1).required(),
  title: Joi.string().allow('', null).optional(),
  vendor: Joi.string().allow('', null).optional(),
  material: Joi.string().allow('', null).optional(),
  sold_by: Joi.string().allow('', null).optional(),
  box_area_sqft: Joi.number().min(0).default(0),
  tiles_per_box: Joi.number().min(0).default(0),
  tile_size: Joi.string().allow('', null).optional(),
  is_natural_stone: Joi.boolean().default(false),
});

const syncSchema = Joi.object({
  records: Joi.array().items(recordSchema).min(1).required(),
});

// POST /sku-conversions/sync - upsert records
router.post('/sync', async (req, res, next) => {
  try {
    const { error, value } = syncSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const validationError = new Error(`Validation error: ${error.details.map((d) => d.message).join(', ')}`);
      validationError.code = 'VALIDATION_ERROR';
      validationError.status = 400;
      throw validationError;
    }

    const db = getFirestore();
    const { records } = value;

    // Batch writes in groups of 500 (Firestore limit)
    const batchSize = 500;
    let synced = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const chunk = records.slice(i, i + batchSize);
      const batch = db.batch();

      for (const record of chunk) {
        const docId = record.sku.replace(/\//g, '__'); // sanitize for doc ID
        const ref = db.collection(COLLECTION).doc(docId);
        batch.set(ref, {
          sku: record.sku,
          title: record.title || '',
          vendor: record.vendor || '',
          material: record.material || '',
          sold_by: record.sold_by || '',
          box_area_sqft: record.box_area_sqft || 0,
          tiles_per_box: record.tiles_per_box || 0,
          tile_size: record.tile_size || '',
          is_natural_stone: record.is_natural_stone || false,
          updated_at: new Date().toISOString(),
        }, { merge: true });
      }

      await batch.commit();
      synced += chunk.length;
    }

    sendSuccess(res, { synced }, `${synced} SKU conversion records synced.`);
  } catch (err) {
    next(err);
  }
});

// GET /sku-conversions/count - count documents
router.get('/count', async (req, res, next) => {
  try {
    const db = getFirestore();
    const snapshot = await db.collection(COLLECTION).count().get();
    const count = snapshot.data().count || 0;
    sendSuccess(res, { count });
  } catch (err) {
    next(err);
  }
});

// GET /sku-conversions/:sku - get single SKU conversion data
router.get('/:sku', async (req, res, next) => {
  try {
    const { sku } = req.params;
    const docId = sku.replace(/\//g, '__');
    const db = getFirestore();
    const doc = await db.collection(COLLECTION).doc(docId).get();

    if (!doc.exists) {
      const notFound = new Error(`SKU '${sku}' not found`);
      notFound.status = 404;
      throw notFound;
    }

    sendSuccess(res, { conversion: doc.data() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
