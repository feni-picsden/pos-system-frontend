// Which cost a product is judged against — the "Cost Calculation Method" company
// setting (Setup > General > Company), documented by the reference as:
//   Last Cost    - the cost the most recent invoice landed at
//   Average Cost - running weighted average of received stock
//   Mixed Mode   - Average while inventory is positive, Last once it goes negative
// The setting existed here but nothing read it; every profit figure silently used
// the last cost.
/**
 * The stored average, or null when there is no usable one.
 *
 * A zero average against a POSITIVE last cost is an unseeded row, not a free
 * product: products created before the average pair was seeded on create banked 0
 * there, and reading that as a real cost valued them at $0.00 with a 100% margin.
 * A genuinely free product has a zero last cost too, and still resolves to 0.
 */
const usableAverage = (average, last) => {
  if (average == null) return null;
  const n = Number(average) || 0;
  return n === 0 && last > 0 ? null : n;
};

export const effectiveUnitCost = (product, method = 'Last Cost') => {
  if (!product) return 0;
  const last = Number(product.itemCost) || 0;
  const average = usableAverage(product.averageItemCost, last);
  if (average == null) return last;
  if (method === 'Average Cost') return average;
  if (method === 'Mixed Mode') return (Number(product.inventory) || 0) > 0 ? average : last;
  return last;
};

export const effectiveCaseCost = (product, method = 'Last Cost') => {
  if (!product) return 0;
  const last = Number(product.caseCost) || 0;
  const average = usableAverage(product.averageCaseCost, last);
  if (average == null) return last;
  if (method === 'Average Cost') return average;
  if (method === 'Mixed Mode') return (Number(product.inventory) || 0) > 0 ? average : last;
  return last;
};

// "Highest Cost" is an option of "Set Prices Based On" only — never of the Cost
// Calculation Method — so it lives apart from effectiveUnitCost's three modes.
// Reference: "the Highest Cost between Last Cost and Average".
export const highestUnitCost = (product) => {
  if (!product) return 0;
  const last = Number(product.itemCost) || 0;
  return Math.max(last, usableAverage(product.averageItemCost, last) ?? last);
};

export const highestCaseCost = (product) => {
  if (!product) return 0;
  const last = Number(product.caseCost) || 0;
  return Math.max(last, usableAverage(product.averageCaseCost, last) ?? last);
};

/**
 * A per-unit cost at full precision.
 *
 * The reference stores ONE cost per product — the CASE cost — alongside the case
 * quantity, and derives what an item costs whenever it needs it (its API carries
 * `lastCost: 125.15` and `caseQuantity: 12`, with no item-cost field at all). We
 * store both halves and round the item half to the cent, so a case cost that does
 * not divide evenly loses precision: 125.15 / 12 is 10.4291666…, stored as 10.43,
 * and 10.43 x 12 is 125.16 — a cent above the case cost the operator typed.
 *
 * Deriving from the case cost recovers the exact figure and never makes one worse:
 * where the item cost was the number entered, the case cost is itemCost x caseQty
 * and dividing it back is lossless.
 */
const unitFromCase = (caseCost, caseQuantity, storedUnit) => {
  const total = Number(caseCost) || 0;
  const qty = Number(caseQuantity) || 0;
  if (total > 0 && qty > 0) return total / qty;
  return Number(storedUnit) || 0;
};

/**
 * The cost the PRICE EDITOR should show — "Set Prices Based On" (Setup > General).
 * Distinct from effectiveUnitCost, which is the cost a completed SALE is judged
 * against: the reference is explicit that this choice "does not affect how
 * Shopfront calculates the cost for sales". Its own worked example, last $20 /
 * average $18 with Average Cost selected:
 *   Cost Calculation Method -> $18   Last Cost -> $20   Highest Cost -> $20
 */
export const pricingUnitCost = (product, settings = {}) => {
  if (!product) return 0;
  const basedOn = settings.setPricesBasedOn || 'Cost Calculation Method';
  const qty = product.caseQuantity;

  const lastUnit = unitFromCase(product.caseCost, qty, product.itemCost);
  if (basedOn === 'Last Cost') return lastUnit;

  // usableAverage first, so an unseeded zero average falls back to the last cost
  // rather than deriving a precise zero from a zero average case cost.
  const avg = usableAverage(product.averageItemCost, Number(product.itemCost) || 0);
  const averageUnit = avg == null ? lastUnit : unitFromCase(product.averageCaseCost, qty, avg);

  if (basedOn === 'Highest Cost') return Math.max(lastUnit, averageUnit);

  const method = settings.costCalculationMethod || 'Last Cost';
  if (method === 'Average Cost') return averageUnit;
  if (method === 'Mixed Mode') return (Number(product.inventory) || 0) > 0 ? averageUnit : lastUnit;
  return lastUnit;
};

/**
 * Profit as a percentage, per "Profitability Display" (Setup > General). The
 * reference gives both formulas verbatim:
 *   Gross Profit Margin - (sell - cost) / sell * 100   (liquor)
 *   Markup              - (sell - cost) / cost * 100   (fashion)
 */
export const profitPercent = (sell, cost, display = 'Gross Profit Margin') => {
  const s = Number(sell) || 0;
  const c = Number(cost) || 0;
  const divisor = display === 'Markup' ? c : s;
  if (!divisor) return 0;
  return ((s - c) / divisor) * 100;
};

/** The inverse of profitPercent: the sell price that yields `percent` on `cost`. */
export const priceFromPercent = (cost, percent, display = 'Gross Profit Margin') => {
  const c = Number(cost) || 0;
  const p = Number(percent) || 0;
  if (c <= 0) return 0;
  if (display === 'Markup') return c * (1 + p / 100);
  // Gross profit margin cannot reach 100%: the price would be infinite.
  if (p / 100 >= 1) return 0;
  return c / (1 - p / 100);
};
