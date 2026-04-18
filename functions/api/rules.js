'use strict';

const express = require('express');
const Joi = require('joi');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { validateRequest, sendSuccess } = require('./middleware');
const { logActivity } = require('./activity-logger');

const router = express.Router();

const RULE_TYPES = ['SKU_MAPPING', 'PRICING', 'NAMING', 'UNIT_CONVERSION', 'NATURAL_STONE_CONVERSION', 'QUANTITY_THRESHOLD_DISCOUNT'];

const skuMappingSchema = Joi.object({
  atd_sku: Joi.string().trim().min(1).required(),
  vendor_sku: Joi.string().trim().min(1).required(),
});

const pricingSchema = Joi.object({
  discount_percent: Joi.number().min(0).max(100).required(),
  start_date: Joi.string().isoDate().allow('', null).optional(),
  end_date: Joi.string().isoDate().allow('', null).optional(),
});

const namingSchema = Joi.object({
  atd_name: Joi.string().trim().min(1).required(),
  vendor_name: Joi.string().trim().min(1).required(),
});

const unitConversionSchema = Joi.object({
  atd_unit: Joi.string().trim().min(1).required(),
  vendor_unit: Joi.string().trim().min(1).required(),
  conversion_factor: Joi.number().positive().required(),
});

const naturalStoneConversionSchema = Joi.object({
  piece_sqft: Joi.number().positive().required(),
});

const quantityThresholdDiscountSchema = Joi.object({
  min_quantity: Joi.number().positive().required(),
  discount_percent: Joi.number().min(0).max(100).required(),
  unit: Joi.string().trim().allow('', null).optional(),
});

const ruleCreateSchema = Joi.object({
  type: Joi.string().valid(...RULE_TYPES).required(),
  vendor: Joi.string().trim().min(1).required(),
  active: Joi.boolean().default(true),
  rule: Joi.alternatives().conditional('type', {
    switch: [
      { is: 'SKU_MAPPING', then: skuMappingSchema.required() },
      { is: 'PRICING', then: pricingSchema.required() },
      { is: 'NAMING', then: namingSchema.required() },
      { is: 'UNIT_CONVERSION', then: unitConversionSchema.required() },
      { is: 'NATURAL_STONE_CONVERSION', then: naturalStoneConversionSchema.required() },
      { is: 'QUANTITY_THRESHOLD_DISCOUNT', then: quantityThresholdDiscountSchema.required() },
    ],
  }),
});

const ruleUpdateSchema = Joi.object({
  type: Joi.string().valid(...RULE_TYPES).optional(),
  vendor: Joi.string().trim().min(1).optional(),
  active: Joi.boolean().optional(),
  rule: Joi.object().optional(),
}).min(1);

const COLLECTION = 'business_rules';

function normalizeRuleDoc(id, data) {
  return {
    id,
    type: data.type,
    vendor: data.vendor,
    active: data.active !== false,
    rule: data.rule || {},
    created_at: data.created_at
      ? (data.created_at.toDate ? data.created_at.toDate().toISOString() : data.created_at)
      : null,
    updated_at: data.updated_at
      ? (data.updated_at.toDate ? data.updated_at.toDate().toISOString() : data.updated_at)
      : null,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const { vendor, type, active } = req.query;
    const db = getFirestore();
    let query = db.collection(COLLECTION);

    if (vendor) query = query.where('vendor', '==', String(vendor));
    if (type) query = query.where('type', '==', String(type));
    if (active === 'true' || active === 'false') {
      query = query.where('active', '==', active === 'true');
    }

    // When multiple filters are applied, Firestore may need a composite index.
    // Sort in JavaScript to avoid FAILED_PRECONDITION errors from missing indexes.
    const whereCount = [vendor, type, active === 'true' || active === 'false'].filter(Boolean).length;
    const snapshot = await query.get();
    let rules = snapshot.docs.map((doc) => normalizeRuleDoc(doc.id, doc.data()));

    // Sort by updated_at desc in JavaScript
    rules.sort((a, b) => {
      const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return bTime - aTime;
    });

    sendSuccess(res, { rules });
  } catch (err) {
    next(err);
  }
});

router.post('/', validateRequest(ruleCreateSchema), async (req, res, next) => {
  try {
    const db = getFirestore();
    const payload = {
      type: req.body.type,
      vendor: req.body.vendor,
      active: req.body.active !== false,
      rule: req.body.rule,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    };

    const ref = await db.collection(COLLECTION).add(payload);
    await logActivity(
      'RULE_CHANGE',
      'rule-create',
      `Rule created (${payload.type}) for vendor ${payload.vendor}`,
      { ruleId: ref.id, vendor: payload.vendor, type: payload.type }
    );

    const saved = await ref.get();
    sendSuccess(res, { rule: normalizeRuleDoc(ref.id, saved.data()) }, 'Rule created.');
  } catch (err) {
    next(err);
  }
});

router.put('/:id', validateRequest(ruleUpdateSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getFirestore();
    const ref = db.collection(COLLECTION).doc(id);
    const existing = await ref.get();

    if (!existing.exists) {
      const error = new Error(`Rule '${id}' not found`);
      error.status = 404;
      throw error;
    }

    const current = existing.data();
    const merged = {
      ...current,
      ...req.body,
    };
    const { error } = ruleCreateSchema.validate(merged, { abortEarly: false });
    if (error) {
      const validationError = new Error(`Validation error: ${error.details.map((d) => d.message).join(', ')}`);
      validationError.code = 'VALIDATION_ERROR';
      validationError.status = 400;
      throw validationError;
    }

    await ref.update({
      ...req.body,
      updated_at: FieldValue.serverTimestamp(),
    });

    await logActivity(
      'RULE_CHANGE',
      'rule-update',
      `Rule updated (${id})`,
      { ruleId: id, updates: Object.keys(req.body) }
    );

    const updated = await ref.get();
    sendSuccess(res, { rule: normalizeRuleDoc(id, updated.data()) }, 'Rule updated.');
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getFirestore();
    const ref = db.collection(COLLECTION).doc(id);
    const existing = await ref.get();

    if (!existing.exists) {
      const error = new Error(`Rule '${id}' not found`);
      error.status = 404;
      throw error;
    }

    await ref.update({
      active: false,
      updated_at: FieldValue.serverTimestamp(),
    });

    await logActivity('RULE_CHANGE', 'rule-delete', `Rule soft-deleted (${id})`, { ruleId: id });
    sendSuccess(res, null, 'Rule deactivated.');
  } catch (err) {
    next(err);
  }
});

module.exports = router;

