// Advanced promotion editor: how a criterion is shown, matched to the reference
// (Shopfront TEST store, 09/10/2026). Display only - nothing here changes pricing.

const RECEIVE_LABELS = {
  quantity_only: '(quantity only)',
  each_item_for: 'each item for',
  total_price: 'a total price of',
  discount_each_item: 'a discount on each item worth',
  discount_total: 'a discount off the total worth',
  percentage_discount: 'a percentage discount of',
  same_sell_rate: 'the same sell rate as if the quantity was',
  discount: 'a discount of',
  free_item: 'Free Item'
};

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const isSpend = (criterion) => criterion?.purchaseType === 'spend';

// "to receive" options in reference order. Spend has "(amount only)" and no
// "a total price of"; an old spend criterion already saved with total price keeps
// that option so its dropdown is not blank.
export const receiveOptions = (criterion) => {
  if (isSpend(criterion)) {
    const opts = [
      { value: 'quantity_only', label: '(amount only)' },
      { value: 'each_item_for', label: RECEIVE_LABELS.each_item_for }
    ];
    if (criterion.receiveType === 'total_price') opts.push({ value: 'total_price', label: RECEIVE_LABELS.total_price });
    return [
      ...opts,
      { value: 'discount_each_item', label: RECEIVE_LABELS.discount_each_item },
      { value: 'discount_total', label: RECEIVE_LABELS.discount_total },
      { value: 'percentage_discount', label: RECEIVE_LABELS.percentage_discount },
      { value: 'same_sell_rate', label: RECEIVE_LABELS.same_sell_rate }
    ];
  }
  return ['quantity_only', 'each_item_for', 'total_price', 'discount_each_item', 'discount_total', 'percentage_discount', 'same_sell_rate']
    .map((value) => ({ value, label: RECEIVE_LABELS[value] }));
};

// Spend "or more" text: always. Purchase grey "exactly" chip: with 2+ criteria, or
// once a quantity is entered.
export const showMatchChip = (criterion, criteriaCount, valueBlank = false) =>
  isSpend(criterion) || criteriaCount >= 2 || (!valueBlank && num(criterion.purchaseValue) > 0);

// Reference: switching purchase -> spend while "a total price of" is chosen (spend has
// no such option) moves the criterion to "each item for".
export const receiveTypeForPurchaseType = (purchaseType, receiveType) =>
  purchaseType === 'spend' && receiveType === 'total_price' ? 'each_item_for' : receiveType;

// Grey "of any product" chip: shown once a quantity or amount is entered.
export const showAnyProductChip = (criterion, valueBlank = false) =>
  !valueBlank && num(criterion.purchaseValue) > 0;

// Reference PROFIT for a spend criterion is always "-" (no per-item cost basis).
export const profitHidden = (criterion) => isSpend(criterion);

// Collapsed "Criteria" summary. Reference: "Purchase 2 to receive each item for $1.00",
// "Spend $2.00 to receive each item for $1.00" - no "(Required)", no "or more".
// An optional criterion keeps "Optionally" so it can still be told apart.
export const criterionSummary = (criterion) => {
  const spend = isSpend(criterion);
  const pv = num(criterion.purchaseValue);
  const rv = num(criterion.receiveValue);
  const type = criterion.receiveType;

  if (pv === 0 && (rv === 0 || type === 'quantity_only')) {
    return 'Purchase 0 to receive a total price of $0.00';
  }

  const head = spend ? `Spend $${pv.toFixed(2)}` : `Purchase ${pv}`;
  const lead = criterion.isOptional ? `Optionally ${head.charAt(0).toLowerCase()}${head.slice(1)}` : head;

  // Reference: "Purchase 2 (quantity only)" / "Spend $2.00 (amount only)".
  if (type === 'quantity_only') return `${lead} ${spend ? '(amount only)' : '(quantity only)'}`;
  const label = RECEIVE_LABELS[type] || RECEIVE_LABELS.total_price;
  if (type === 'percentage_discount') return `${lead} to receive ${label} ${rv.toFixed(2)}%`;
  if (type === 'same_sell_rate') return `${lead} to receive ${label} ${rv}`;
  return `${lead} to receive ${label} $${rv.toFixed(2)}`;
};
