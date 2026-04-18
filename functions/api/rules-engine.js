'use strict';

const { getFirestore } = require('firebase-admin/firestore');

const RULE_TYPES = {
  SKU_MAPPING: 'SKU_MAPPING',
  PRICING: 'PRICING',
  NAMING: 'NAMING',
  UNIT_CONVERSION: 'UNIT_CONVERSION',
  NATURAL_STONE_CONVERSION: 'NATURAL_STONE_CONVERSION',
  QUANTITY_THRESHOLD_DISCOUNT: 'QUANTITY_THRESHOLD_DISCOUNT',
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

// Look up a SKU in the sku_conversions Firestore collection
async function lookupSkuConversion(sku) {
  if (!sku) return null;
  const db = getFirestore();
  const docId = String(sku).trim().replace(/\//g, '__');
  try {
    const doc = await db.collection('sku_conversions').doc(docId).get();
    return doc.exists ? doc.data() : null;
  } catch {
    return null;
  }
}

function applySingleRule(item, businessRule, skuConversion) {
  const next = { ...item };
  const payload = businessRule.rule || {};
  const notes = next._ruleNotes || [];

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
      // Enhanced: try SKU-level lookup first for non-natural-stone box conversions
      if (skuConversion && !skuConversion.is_natural_stone && skuConversion.box_area_sqft > 0 && (skuConversion.sold_by || '').toLowerCase() === 'box') {
        const quantity = toNumber(next.quantity ?? next.qty, 0);
        const convertedQty = quantity * skuConversion.box_area_sqft;
        next.quantity = convertedQty;
        next.qty = convertedQty;
        next.unit = 'Sq Ft';
        notes.push(`Converted from ${quantity} boxes (box area: ${skuConversion.box_area_sqft} sq ft/box)`);
      } else {
        // Fallback to manual conversion factor
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
      }
      break;
    }

    case RULE_TYPES.NATURAL_STONE_CONVERSION: {
      // Only applies if SKU is natural stone
      if (skuConversion && skuConversion.is_natural_stone) {
        const pieceSqft = toNumber(payload.piece_sqft, 0);
        if (pieceSqft > 0) {
          const quantity = toNumber(next.quantity ?? next.qty, 0);
          const convertedQty = quantity * pieceSqft;
          next.quantity = convertedQty;
          next.qty = convertedQty;
          next.unit = 'Sq Ft';
          notes.push(`Natural stone: converted ${quantity} pieces at ${pieceSqft} sq ft/piece`);
        }
      }
      break;
    }

    case RULE_TYPES.QUANTITY_THRESHOLD_DISCOUNT: {
      const minQty = toNumber(payload.min_quantity, 0);
      const discountPercent = toNumber(payload.discount_percent, 0);
      const ruleUnit = payload.unit ? String(payload.unit).trim().toLowerCase() : '';
      const currentUnit = String(next.unit || '').trim().toLowerCase();
      const quantity = toNumber(next.quantity ?? next.qty, 0);

      if (minQty > 0 && discountPercent > 0 && quantity >= minQty) {
        // If rule specifies a unit, only apply if unit matches
        if (!ruleUnit || currentUnit === ruleUnit) {
          const unitPrice = toNumber(next.unitPrice, 0);
          const discounted = unitPrice * (1 - discountPercent / 100);
          next.unitPrice = Math.round(discounted * 100) / 100;
          notes.push(`Quantity discount ${discountPercent}% applied (qty: ${quantity})`);
        }
      }
      break;
    }

    default:
      break;
  }

  next._ruleNotes = notes;
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

  // Check if any rules need SKU lookups
  const needsSkuLookup = rules.some((r) =>
    r.type === RULE_TYPES.UNIT_CONVERSION ||
    r.type === RULE_TYPES.NATURAL_STONE_CONVERSION
  );

  const results = [];
  for (const item of items) {
    let transformed = { ...item, _ruleNotes: [] };

    // Look up SKU conversion data if needed
    let skuConversion = null;
    if (needsSkuLookup) {
      const sku = item.sku || item.itemSku || '';
      skuConversion = await lookupSkuConversion(sku);
    }

    for (const businessRule of rules) {
      transformed = applySingleRule(transformed, businessRule, skuConversion);
    }

    // Flatten notes into a single note string
    if (transformed._ruleNotes && transformed._ruleNotes.length > 0) {
      transformed.note = transformed._ruleNotes.join('; ');
    }
    delete transformed._ruleNotes;

    results.push(transformed);
  }

  return results;
}

module.exports = {
  RULE_TYPES,
  applyRules,
  lookupSkuConversion,
};
