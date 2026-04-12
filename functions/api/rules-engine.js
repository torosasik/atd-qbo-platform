'use strict';

const { getFirestore } = require('firebase-admin/firestore');

const RULE_TYPES = {
  SKU_MAPPING: 'SKU_MAPPING',
  PRICING: 'PRICING',
  NAMING: 'NAMING',
  UNIT_CONVERSION: 'UNIT_CONVERSION',
};

function normalizeVendorName(vendorName) {
  return String(vendorName || '').trim().toLowerCase();
}

function isPricingRuleActive(rule) {
  const now = new Date();
  const start = rule.start_date ? new Date(rule.start_date) : null;
  const end = rule.end_date ? new Date(rule.end_date) : null;
  if (start && Number.isFinite(start.getTime()) && now < start) return false;
  if (end && Number.isFinite(end.getTime()) && now > end) return false;
  return true;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function applySingleRule(item, businessRule) {
  const next = { ...item };
  const payload = businessRule.rule || {};

  switch (businessRule.type) {
    case RULE_TYPES.SKU_MAPPING: {
      const atdSku = String(payload.atd_sku || '').trim();
      const vendorSku = String(payload.vendor_sku || '').trim();
      const itemSku = String(next.sku || '').trim();
      if (atdSku && vendorSku && itemSku && itemSku === atdSku) {
        next.sku = vendorSku;
      }
      break;
    }

    case RULE_TYPES.PRICING: {
      const discountPercent = toNumber(payload.discount_percent, 0);
      if (discountPercent > 0 && isPricingRuleActive(payload)) {
        const unitPrice = toNumber(next.unitPrice, 0);
        const discounted = unitPrice * (1 - discountPercent / 100);
        next.unitPrice = Math.round(discounted * 100) / 100;
      }
      break;
    }

    case RULE_TYPES.NAMING: {
      const atdName = String(payload.atd_name || '').trim().toLowerCase();
      const vendorName = String(payload.vendor_name || '').trim();
      const itemName = String(next.description || '').trim().toLowerCase();
      if (atdName && vendorName && itemName === atdName) {
        next.description = vendorName;
      }
      break;
    }

    case RULE_TYPES.UNIT_CONVERSION: {
      const atdUnit = String(payload.atd_unit || '').trim().toLowerCase();
      const vendorUnit = String(payload.vendor_unit || '').trim();
      const factor = toNumber(payload.conversion_factor, 0);
      const currentUnit = String(next.unit || '').trim().toLowerCase();
      if (atdUnit && vendorUnit && factor > 0 && currentUnit === atdUnit) {
        const quantity = toNumber(next.quantity ?? next.qty, 0);
        const convertedQty = quantity * factor;
        next.quantity = convertedQty;
        next.qty = convertedQty;
        next.unit = vendorUnit;
      }
      break;
    }

    default:
      break;
  }

  return next;
}

async function getActiveRulesForVendor(vendorName) {
  const db = getFirestore();
  const normalized = normalizeVendorName(vendorName);
  if (!normalized) return [];

  const snapshot = await db
    .collection('business_rules')
    .where('active', '==', true)
    .get();

  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((rule) => normalizeVendorName(rule.vendor) === normalized);
}

async function applyRules(orderItems, vendorName) {
  const rules = await getActiveRulesForVendor(vendorName);
  const items = Array.isArray(orderItems) ? orderItems : [];

  if (rules.length === 0 || items.length === 0) {
    return items;
  }

  return items.map((item) => {
    let transformed = { ...item };
    for (const businessRule of rules) {
      transformed = applySingleRule(transformed, businessRule);
    }
    return transformed;
  });
}

module.exports = {
  RULE_TYPES,
  applyRules,
};

