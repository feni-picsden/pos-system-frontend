// Price points of one product are the same item in different pack sizes.
// Pricing a pack sets the single's price from it (a case of 6 at $30 makes the
// single $5), but the link runs ONE way: re-pricing the single afterwards ($8)
// never touches the packs, so "1 for $8, 6 for $30" stays possible.
//
// Only rows of the SAME price set are linked — a different price set is a
// different customer group and must not be touched.

/** 2-decimal money rounding, matching the price table's own rounding. */
const round2 = (n) => Math.round(n * 100) / 100;

const toNumber = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/** A row's pack size; anything unusable counts as a single unit. */
export const rowQuantity = (row) => {
  const q = parseInt(row?.quantity, 10);
  return Number.isFinite(q) && q > 0 ? q : 0;
};

/** Same price set = same customer group. Missing/null/'' all mean "default". */
const samePriceSet = (a, b) => (a?.priceSetId ?? null) === (b?.priceSetId ?? null);

/** Margin % for a row, so the table's GP column stays truthful after a re-price. */
const percentageFor = (cost, price) => (!price ? 0 : round2((1 - cost / price) * 100));

/**
 * After `rows[index]` was edited: refresh its cost / GP%, and when it is a pack
 * (quantity > 1) re-price the single (quantity 1) rows of its price set from
 * the pack's per-unit price. Other packs are never changed.
 *
 * Returns a NEW array (never mutates). The edited row's price is left exactly
 * as typed, so the cashier's own number is never rounded mid-keystroke.
 *
 * No-op (returns rows unchanged) while the edited row can't be priced yet:
 * quantity 0/blank/NaN, or a price of 0 or blank.
 *
 * @param {Array} rows      formData.prices
 * @param {number} index    row the user just edited
 * @param {number} itemCost per-unit cost, for the cost/% columns
 */
export function syncPriceRows(rows, index, itemCost = 0) {
  if (!Array.isArray(rows) || !rows[index]) return rows;

  const edited = rows[index];
  const qty = rowQuantity(edited);
  const price = toNumber(edited.price);
  if (qty <= 0 || price <= 0) return rows;

  const unitCost = toNumber(itemCost);
  const unitPrice = price / qty;

  return rows.map((row, i) => {
    if (i === index) {
      const cost = round2(unitCost * qty);
      return { ...row, cost, percentage: percentageFor(cost, price) };
    }
    if (qty > 1 && rowQuantity(row) === 1 && samePriceSet(row, edited)) {
      const single = round2(unitPrice);
      const cost = round2(unitCost);
      return { ...row, price: single, cost, percentage: percentageFor(cost, single) };
    }
    return row;
  });
}

export default syncPriceRows;
