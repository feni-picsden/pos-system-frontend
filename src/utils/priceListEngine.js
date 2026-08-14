// Price List engine — applies a customer/group price list to a line's everyday price.
// Pure + dependency-free so it can self-check and be reused by sell screen and finalize.
//
// Config shape (from PriceList.configuration JSON, saved by PriceListConfiguration.jsx):
//   { allowHigherPrice, allowDiscountingPromotions, rules: [rule], fallbackRule }
// Rule shape (as actually persisted by the configuration page):
//   { entityType, entityId, excludeFromPriceList, pricingMethod, pricingValue,
//     quantityTiers: [{ quantity, price }]   // 'override' only; price is the TOTAL for that qty
//     minimumPriceMethod, minimumPriceValue, cost }
//   Legacy/seeded rules may carry `value` instead of `pricingValue`.
// pricingMethod / minimumPriceMethod values:
//   override | discount_by_percent | discount_total_by_dollar | discount_each_by_dollar |
//   cost_plus_percent | cost_plus_dollar | last_cost_plus_percent | last_cost_plus_dollar |
//   cost | no_minimum
//
// Shopfront semantics honored (per help "Creating and Editing Price Lists"):
// - Minimum Price is a floor.
// - Allow Higher Price OFF => never charge more than the everyday price (pick the cheaper).
// - A rule with excludeFromPriceList keeps the everyday price.
// - Fallback rule applies to any product with no explicit rule.

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

// Compute a price from a single method against the everyday unit price + costs.
// Returns null when the method cannot be computed with the data available (caller falls back).
function priceFromMethod(method, value, ctx) {
  const { everyday, cost, lastCost, quantity } = ctx;
  const qty = quantity && quantity > 0 ? quantity : 1;
  const v = num(value);
  switch (method) {
    case 'override':
      return v; // absolute price
    case 'discount_by_percent': // each by %
      return v == null ? null : everyday * (1 - v / 100);
    case 'discount_each_by_dollar':
      return v == null ? null : everyday - v;
    case 'discount_total_by_dollar': // reduce the whole line by $v => per-unit share
      return v == null ? null : everyday - v / qty;
    case 'cost_plus_percent':
      return cost == null || v == null ? null : cost * (1 + v / 100);
    case 'cost_plus_dollar':
      return cost == null || v == null ? null : cost + v;
    case 'last_cost_plus_percent':
      return (lastCost ?? cost) == null || v == null ? null : (lastCost ?? cost) * (1 + v / 100);
    case 'last_cost_plus_dollar':
      return (lastCost ?? cost) == null || v == null ? null : (lastCost ?? cost) + v;
    case 'cost':
      return cost == null ? null : cost;
    case 'no_minimum':
    case undefined:
    case null:
    case '':
      return null;
    default:
      return null;
  }
}

// Resolve a rule's list price. The configuration page stores the amount as `pricingValue`
// (older rules may carry `value`), and for 'override' as quantityTiers[] where `price` is the
// TOTAL for `quantity` items — the applicable tier is the dearest quantity <= the line quantity.
function priceFromRule(rule, ctx) {
  if (!rule) return null;
  if (rule.pricingMethod === 'override' && Array.isArray(rule.quantityTiers)) {
    const qty = ctx.quantity && ctx.quantity > 0 ? ctx.quantity : 1;
    const tier = rule.quantityTiers
      .map((t) => ({ q: num(t?.quantity), p: num(t?.price) }))
      .filter((t) => t.q != null && t.q > 0 && t.p != null && t.q <= qty)
      .sort((a, b) => a.q - b.q)
      .pop();
    if (tier) return tier.p / tier.q;
  }
  return priceFromMethod(rule.pricingMethod, rule.pricingValue ?? rule.value, ctx);
}

// Match a rule to a line. Product rules match by entityId; classification/brand/tag rules
// match when the line carries a matching id in classificationIds (best-effort — only applied
// when that data is present on the cart line).
function ruleMatchesLine(rule, line) {
  if (!rule) return false;
  const et = (rule.entityType || '').toLowerCase();
  if (et === 'product' || et === '') {
    return rule.entityId != null && (rule.entityId === line.productId || rule.entityId === line.id);
  }
  // classification / brand / tag / family
  const ids = line.classificationIds;
  if (Array.isArray(ids) && ids.length) return ids.includes(rule.entityId);
  return false;
}

/**
 * Resolve the effective unit price for a line under a price list.
 * @param {object} line   { everyday, price?, productId, id?, cost?, lastCost?, classificationIds? }
 * @param {object} config PriceList.configuration ({ allowHigherPrice, rules, fallbackRule })
 * @returns {number} the effective unit price (never NaN/negative). Falls back to everyday.
 */
export function applyPriceListToLine(line, config) {
  const everyday = num(line?.everyday ?? line?.price);
  if (everyday == null) return num(line?.price) ?? 0;
  if (!config || (!Array.isArray(config.rules) && !config.fallbackRule)) return everyday;

  const ctx = { everyday, cost: num(line.cost), lastCost: num(line.lastCost), quantity: num(line.quantity) };

  const rule = (Array.isArray(config.rules) ? config.rules : []).find((r) => ruleMatchesLine(r, line));

  let listPrice = null;
  let minMethod = null;
  let minValue = null;

  if (rule) {
    if (rule.excludeFromPriceList) return everyday; // explicitly excluded
    listPrice = priceFromRule(rule, ctx);
    minMethod = rule.minimumPriceMethod;
    minValue = rule.minimumPriceValue;
  } else if (config.fallbackRule) {
    listPrice = priceFromRule(config.fallbackRule, ctx);
    minMethod = config.fallbackRule.minimumPriceMethod;
    minValue = config.fallbackRule.minimumPriceValue;
  } else {
    return everyday; // no rule, no fallback
  }

  if (listPrice == null) return everyday; // method not computable → everyday

  // Minimum price floor.
  const floor = priceFromMethod(minMethod, minValue, ctx);
  if (floor != null && listPrice < floor) listPrice = floor;

  // Allow Higher Price: OFF => never exceed everyday (cheaper wins).
  if (!config.allowHigherPrice && listPrice > everyday) listPrice = everyday;

  if (!Number.isFinite(listPrice) || listPrice < 0) return everyday; // guard
  return listPrice;
}

// --- self-check (runs once at import; silent unless a rule breaks) ---
(() => {
  const cfg = (over = {}) => ({ allowHigherPrice: false, rules: [], fallbackRule: null, ...over });
  const line = (over = {}) => ({ everyday: 10, cost: 4, productId: 1, ...over });

  // override via quantityTiers — the shape the configuration page persists (price = line total)
  const tierRule = (tiers) => ({ entityType: 'product', entityId: 1, pricingMethod: 'override', quantityTiers: tiers });
  console.assert(
    applyPriceListToLine(line({ quantity: 1 }), cfg({ rules: [tierRule([{ quantity: '1', price: '7.00' }])] })) === 7,
    'priceList: override reads the qty-1 tier price'
  );
  console.assert(
    applyPriceListToLine(line({ quantity: 6 }), cfg({ rules: [tierRule([{ quantity: '1', price: '7' }, { quantity: '6', price: '36' }])] })) === 6,
    'priceList: override picks the dearest tier <= qty and unit-prices it (36/6)'
  );
  console.assert(
    applyPriceListToLine(line({ quantity: 3 }), cfg({ rules: [tierRule([{ quantity: '6', price: '36' }])] })) === 10,
    'priceList: no tier at or below qty => everyday'
  );
  // discount by % with min floor (UI writes pricingValue)
  console.assert(
    applyPriceListToLine(line(), cfg({ rules: [{ entityType: 'product', entityId: 1, pricingMethod: 'discount_by_percent', pricingValue: '50', minimumPriceMethod: 'cost_plus_dollar', minimumPriceValue: 2 }] })) === 6,
    'priceList: min floor (cost 4 + $2 = 6) beats 50% off (5)'
  );
  // stale legacy `value` must not beat a cleared pricingValue
  console.assert(
    applyPriceListToLine(line(), cfg({ rules: [{ entityType: 'product', entityId: 1, pricingMethod: 'discount_by_percent', value: 50, pricingValue: '' }] })) === 10,
    'priceList: cleared pricingValue wins over a stale value'
  );
  // legacy rules that only carry `value` still work
  console.assert(
    applyPriceListToLine(line(), cfg({ rules: [{ entityType: 'product', entityId: 1, pricingMethod: 'discount_by_percent', value: 10 }] })) === 9,
    'priceList: legacy value key still honored'
  );
  // allow higher price OFF => everyday wins over a dearer list price
  console.assert(
    applyPriceListToLine(line({ quantity: 1 }), cfg({ allowHigherPrice: false, rules: [tierRule([{ quantity: '1', price: '15' }])] })) === 10,
    'priceList: allowHigherPrice off caps at everyday'
  );
  // allow higher price ON => list price may exceed everyday
  console.assert(
    applyPriceListToLine(line({ quantity: 1 }), cfg({ allowHigherPrice: true, rules: [tierRule([{ quantity: '1', price: '15' }])] })) === 15,
    'priceList: allowHigherPrice on permits higher'
  );
  // exclude => everyday
  console.assert(
    applyPriceListToLine(line(), cfg({ rules: [{ entityType: 'product', entityId: 1, excludeFromPriceList: true, pricingMethod: 'override', quantityTiers: [{ quantity: '1', price: '1' }] }] })) === 10,
    'priceList: excluded product keeps everyday'
  );
  // fallback applies when no explicit rule
  console.assert(
    applyPriceListToLine(line({ productId: 99 }), cfg({ fallbackRule: { pricingMethod: 'discount_by_percent', pricingValue: '10' } })) === 9,
    'priceList: fallback rule applies to unmatched product'
  );
  // no config => everyday untouched, never NaN
  console.assert(applyPriceListToLine(line(), null) === 10, 'priceList: null config is a no-op');
  // cost method with missing cost => everyday (not NaN)
  console.assert(
    applyPriceListToLine(line({ cost: undefined }), cfg({ rules: [{ entityType: 'product', entityId: 1, pricingMethod: 'cost' }] })) === 10,
    'priceList: uncomputable method falls back to everyday'
  );
})();
