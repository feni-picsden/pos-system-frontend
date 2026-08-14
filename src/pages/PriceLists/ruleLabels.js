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

export const MINIMUM_PRICE_OPTIONS = [
  { value: 'no_minimum', label: 'No minimum' },
  ...PRICING_METHODS_WITHOUT_OVERRIDE,
];

const labelOf = (method) =>
  PRICING_METHODS.find((m) => m.value === method)?.label || '';

const money = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
};

// "Cost + $" + 1.5 -> "Cost + $1.50";  "Discount by %" + 9 -> "Discount by 9.00%".
const foldValueIntoLabel = (label, value) => {
  if (label.endsWith('%')) return `${label.slice(0, -1)}${money(value)}%`;
  if (label.endsWith('$')) return `${label}${money(value)}`;
  return label;
};

export const formatRuleSummary = (rule) => {
  if (!rule) return '';
  if (rule.excludeFromPriceList) return 'Excluded';

  const label = labelOf(rule.pricingMethod);
  if (!label) return '';
  // Rules store the amount as `pricingValue`; `value` is the older shape.
  const amount = rule.pricingValue ?? rule.value;
  if (rule.pricingMethod === 'cost') return 'Cost';
  if (rule.pricingMethod === 'override') return `Override $${money(amount)}`;

  const summary = foldValueIntoLabel(label, amount);
  const min = rule.minimumPriceMethod;
  if (!min || min === 'no_minimum') return summary;
  if (min === 'cost') return `${summary} (min Cost)`;
  return `${summary} (min ${foldValueIntoLabel(labelOf(min), rule.minimumPriceValue)})`;
};
