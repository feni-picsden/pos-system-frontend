// Shared rule vocabulary for the price-list screens. The reference renders a
// collapsed rule row as its method label with the value folded into the symbol
// ("Last Cost + %" + 9 -> "Last Cost + 9.00%"), so keep labels and summary in
// one place — the view page and the edit page must read identically.

export const PRICING_METHODS = [
  { value: 'override', label: 'Override' },
  { value: 'discount_by_percent', label: 'Discount by %' },
  { value: 'discount_total_by_dollar', label: 'Discount total by $' },
  { value: 'discount_each_by_dollar', label: 'Discount each by $' },
  { value: 'cost_plus_percent', label: 'Cost + %' },
  { value: 'cost_plus_dollar', label: 'Cost + $' },
  { value: 'last_cost_plus_percent', label: 'Last Cost + %' },
  { value: 'last_cost_plus_dollar', label: 'Last Cost + $' },
  { value: 'cost', label: 'Cost' },
];

export const PRICING_METHODS_WITHOUT_OVERRIDE = PRICING_METHODS.filter(
  (m) => m.value !== 'override'
);

// Reference "Minimum Pricing Rule" list: No minimum, then every method
// including Override (an absolute floor price).
export const MINIMUM_PRICE_OPTIONS = [
  { value: 'no_minimum', label: 'No minimum' },
  ...PRICING_METHODS,
];

// Reference search/add order and the sale-time priority: the most specific
// rule wins when several match one product.
export const ENTITY_TYPE_LABELS = {
  product: 'Product',
  family: 'Family',
  category: 'Category',
  brand: 'Brand',
  tag: 'Tag',
};

export const entityTypeLabel = (entityType) =>
  ENTITY_TYPE_LABELS[(entityType || '').toLowerCase()] ||
  (entityType ? entityType.charAt(0).toUpperCase() + entityType.slice(1) : 'Product');

const labelOf = (method) =>
  PRICING_METHODS.find((m) => m.value === method)?.label || '';

export const money = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
};

// "Cost + $" + 1.5 -> "Cost + $1.50";  "Discount by %" + 9 -> "Discount by 9.00%".
const foldValueIntoLabel = (label, value) => {
  if (label.endsWith('%')) return `${label.slice(0, -1)}${money(value)}%`;
  if (label.endsWith('$')) return `${label}${money(value)}`;
  return label;
};

// Usable override tiers (a quantity and a price both present).
export const overrideTiers = (rule) =>
  (Array.isArray(rule?.quantityTiers) ? rule.quantityTiers : []).filter(
    (t) => t && t.quantity !== '' && t.quantity != null && t.price !== '' && t.price != null
  );

// The "Rule" column of the view page / the right half of an edit card, WITHOUT
// the minimum (the view page shows that in its own "Minimum Rule" column).
// Reference: "Override Prices" for an override rule; the edit card shows the
// single tier's price as "Override Price $64.00".
export const formatRuleLabel = (rule, { singleTierPrice = false, ignoreExclude = false } = {}) => {
  if (!rule) return '';
  if (rule.excludeFromPriceList && !ignoreExclude) return 'Excluded';
  const label = labelOf(rule.pricingMethod);
  if (!label) return '';
  if (rule.pricingMethod === 'cost') return 'Cost';
  if (rule.pricingMethod === 'override') {
    const tiers = overrideTiers(rule);
    if (singleTierPrice && tiers.length === 1) return `Override Price $${money(tiers[0].price)}`;
    return 'Override Prices';
  }
  return foldValueIntoLabel(label, rule.pricingValue ?? rule.value);
};

// The "Minimum Rule" column: "No Minimum" or the folded minimum method.
export const formatMinimumRule = (rule) => {
  const min = rule?.minimumPriceMethod;
  if (rule?.excludeFromPriceList) return 'N/A'; // reference: excluded rows read "N/A"
  if (!min || min === 'no_minimum' || rule?.pricingMethod === 'override') {
    return 'No Minimum';
  }
  if (min === 'cost') return 'Cost';
  if (min === 'override') return `Override $${money(rule.minimumPriceValue)}`;
  return foldValueIntoLabel(labelOf(min), rule.minimumPriceValue);
};

// Edit-page card: override with several tiers reads "Override Prices" /
// "$0.00 - $64.00" (reference).
export const overridePriceRange = (rule) => {
  const prices = overrideTiers(rule).map((t) => Number(t.price) || 0);
  if (!prices.length) return '';
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  return lo === hi ? `$${money(lo)}` : `$${money(lo)} - $${money(hi)}`;
};

// Rule + minimum on one line (edit page cards and the Add All Categories dialog).
export const formatRuleSummary = (rule) => {
  if (!rule) return '';
  const summary = formatRuleLabel(rule, { singleTierPrice: true });
  if (!summary || rule.excludeFromPriceList || rule.pricingMethod === 'override') return summary;
  const min = formatMinimumRule(rule);
  return min === 'No Minimum' ? summary : `${summary} (min ${min})`;
};
