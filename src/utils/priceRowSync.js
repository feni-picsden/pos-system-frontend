// Price points of one product are the same item in different pack sizes.
// Each price point is INDEPENDENT, as in the reference product (checked on its
// product page: setting 12 for $20 left the single at $5, and re-pricing the
// single to $3 left the pack at $20). So "1 for $5, 12 for $20" can be typed in
// any order. Editing a row only refreshes that row's own cost / profit %.

// Extension is explicit: the .mjs unit tests run under plain Node, which does not
// do Vite's extensionless resolution.
import { profitPercent } from './productCost.js';

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

/**
 * Profit % for a row, so the table's column stays truthful after a re-price.
 * Follows Setup > General > "Profitability Display" — this used to be a hardcoded
 * gross profit margin, so a company on Markup saw the wrong number here.
 */
const percentageFor = (cost, price, display) =>
  (!price ? 0 : round2(profitPercent(price, cost, display)));

/**
 * After `rows[index]` was edited: refresh its cost / GP%. No other row is
 * ever changed.
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
 * @param {string} display  Setup > General > Profitability Display
 */
export function syncPriceRows(rows, index, itemCost = 0, display = 'Gross Profit Margin') {
  if (!Array.isArray(rows) || !rows[index]) return rows;

  const edited = rows[index];
  const qty = rowQuantity(edited);
  const price = toNumber(edited.price);
  if (qty <= 0 || price <= 0) return rows;

  const unitCost = toNumber(itemCost);

  return rows.map((row, i) => {
    if (i === index) {
      const cost = round2(unitCost * qty);
      return { ...row, cost, percentage: percentageFor(cost, price, display) };
    }
    return row;
  });
}

export default syncPriceRows;
