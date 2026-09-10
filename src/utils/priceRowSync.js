// Price points of one product are the SAME item sold in different pack sizes, so
// they share one per-unit price: a case of 6 priced at $30 makes the single $5.
// Editing any row therefore re-prices its siblings instead of leaving the table
// internally inconsistent (Shopfront behaviour).
//
// Siblings are the rows of the SAME price set only — a different price set is a
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
 * Re-price every sibling of `rows[index]` from that row's per-unit price.
 *
 * Returns a NEW array (never mutates). The edited row is left exactly as typed —
 * only its `cost`/`percentage` are refreshed — so the cashier's own number is
 * never rounded out from under them mid-keystroke.
 *
 * No-ops (returns rows unchanged) when the edited row can't define a per-unit
 * price: quantity 0/blank/NaN, or a price of 0 or blank. Clearing the field to
 * retype it must not wipe the other rows.
 *
 * @param {Array} rows      formData.prices
 * @param {number} index    row the user just edited
 * @param {number} itemCost per-unit cost, for the cost/% columns
 */
export function syncPriceRowsFromUnitPrice(rows, index, itemCost = 0) {
  if (!Array.isArray(rows) || !rows[index]) return rows;

  const edited = rows[index];
  const qty = rowQuantity(edited);
  const price = toNumber(edited.price);
  if (qty <= 0 || price <= 0) return rows;

  const unitPrice = price / qty;
  const unitCost = toNumber(itemCost);

  return rows.map((row, i) => {
    const rowCost = round2(unitCost * (rowQuantity(row) || 1));

    if (i === index) {
      return { ...row, cost: rowCost, percentage: percentageFor(rowCost, price) };
    }
    if (!samePriceSet(row, edited)) return row;

    const siblingQty = rowQuantity(row);
    if (siblingQty <= 0) return row;

    const newPrice = round2(unitPrice * siblingQty);
    return { ...row, price: newPrice, cost: rowCost, percentage: percentageFor(rowCost, newPrice) };
  });
}

export default syncPriceRowsFromUnitPrice;
