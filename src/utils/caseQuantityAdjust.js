// Case Quantity change: the Old/New adjustments the reference offers.
//
// Changing how many items come in a case leaves two readings of every stock and
// cost figure the product already carries, and the reference asks which one is
// meant (the "Case Quantity Adjustments" dialog, measured 2026-09-15):
//
//   INVENTORY   Old  keep the cases/items NUMBERS  — 5 cases 6 items stays
//                    5 cases 6 items, so the units on hand change with the case
//                    size (24 -> 12 turns 126 units into 66).
//               New  keep the UNITS on hand — 126 units re-split at the new case
//                    size, 5 cases 6 items -> 10 cases 6 items.
//
//   COST        Old  keep the CASE cost — a case still costs $48, so at 12 per
//                    case an item now costs $4.
//               New  keep the ITEM cost — an item still costs $2, so a case of
//                    12 now costs $24.
//
// New is what the reference preselects, in both columns.
//
// Price points are deliberately untouched: a "24 for $80" price point keeps its
// quantity and price (the reference leaves it alone and the dialog's warning
// asks for prices and promotions to be double-checked by hand).
//
// Pure and dependency-free so the rules can be tested without the editor.

/** The cases/items field pairs a case-quantity change re-reads, in dialog order. */
export const INVENTORY_PAIRS = [
  { label: 'Quantity', cases: 'currentStockCases', items: 'currentStockItems' },
  { label: 'Reorder Level', cases: 'reorderLevelCases', items: 'reorderLevelItems' },
  { label: 'Reorder Amount', cases: 'reorderAmountCases', items: 'reorderAmountItems' },
  { label: 'Reorder Limit', cases: 'reorderLimitCases', items: 'reorderLimitItems' },
  { label: 'Max On Hand', cases: 'maxOnHandCases', items: 'maxOnHandItems' },
];

/** The two cost pairs, each { case field, item field }. */
export const COST_PAIRS = [
  { label: 'Last Cost', caseField: 'caseCost', itemField: 'itemCost' },
  { label: 'Average Cost', caseField: 'averageCaseCost', itemField: 'averageItemCost' },
];

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

/** Reorder Limit and Max On Hand are free-text and may be left blank — blank stays blank. */
const isBlank = (v) => v === '' || v === null || v === undefined;

const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Both readings of one cases/items pair.
 * @returns {{ old: {cases, items}, next: {cases, items}, blank: boolean, changed: boolean }}
 *          `blank` when neither side carries a value (the dialog hides those rows).
 */
export function inventoryPairOptions(formData, pair, oldCaseQty, newCaseQty) {
  const rawCases = formData?.[pair.cases];
  const rawItems = formData?.[pair.items];
  const blank = isBlank(rawCases) && isBlank(rawItems);

  const cases = num(rawCases) ?? 0;
  const items = num(rawItems) ?? 0;
  // Old: the typed numbers are kept exactly as they are.
  const old = { cases, items };

  // New: the same physical units, re-split at the new case size. Math.floor keeps
  // items in [0, caseQuantity) the same way the server's splitStock does, so the
  // dialog shows what Save will store.
  const size = Math.max(1, num(newCaseQty) ?? 1);
  const units = cases * Math.max(1, num(oldCaseQty) ?? 1) + items;
  const newCases = Math.floor(units / size);
  const next = { cases: newCases, items: units - newCases * size };

  return {
    old,
    next,
    blank,
    changed: old.cases !== next.cases || old.items !== next.items,
  };
}

/**
 * Both readings of one cost pair at the new case size.
 * @returns {{ old: {caseCost, itemCost}, next: {caseCost, itemCost}, changed: boolean }}
 */
export function costPairOptions(formData, pair, newCaseQty) {
  const size = Math.max(1, num(newCaseQty) ?? 1);
  const caseCost = money(formData?.[pair.caseField]);
  const itemCost = money(formData?.[pair.itemField]);

  // Old keeps the case cost, so the item cost is re-derived from it.
  const old = { caseCost, itemCost: money(caseCost / size) };
  // New keeps the item cost, so the case cost is re-derived from it.
  const next = { caseCost: money(itemCost * size), itemCost };

  return {
    old,
    next,
    changed: old.caseCost !== next.caseCost || old.itemCost !== next.itemCost,
  };
}

/**
 * Everything the dialog renders for a case-quantity change, or null when the
 * change moves nothing (same size, or a product with no stock and no cost).
 *
 * @returns {{ inventory: Array, costs: Array, oldCaseQty: number, newCaseQty: number }|null}
 */
export function buildAdjustments(formData, oldCaseQty, newCaseQty) {
  const from = Math.max(1, num(oldCaseQty) ?? 1);
  const to = Math.max(1, num(newCaseQty) ?? 1);
  if (from === to) return null;

  const inventory = INVENTORY_PAIRS
    .map((pair) => ({ pair, ...inventoryPairOptions(formData, pair, from, to) }))
    .filter((row) => !row.blank);

  const costs = COST_PAIRS.map((pair) => ({ pair, ...costPairOptions(formData, pair, to) }));

  if (!inventory.some((r) => r.changed) && !costs.some((r) => r.changed)) return null;
  return { inventory, costs, oldCaseQty: from, newCaseQty: to };
}

/**
 * The form data after the change, with the picks applied.
 *
 * @param {object} formData
 * @param {object} adjustments  from buildAdjustments
 * @param {{ inventory: 'old'|'new', cost: 'old'|'new' }} picks
 */
export function applyAdjustments(formData, adjustments, picks) {
  if (!formData || !adjustments) return formData;
  const useNewInventory = picks?.inventory !== 'old';
  const useNewCost = picks?.cost !== 'old';
  const next = { ...formData, caseQuantity: adjustments.newCaseQty };

  // Only the rows the dialog offered are written, so a Reorder Limit or Max On
  // Hand that was left blank stays blank rather than becoming a typed 0.
  for (const row of adjustments.inventory) {
    const chosen = useNewInventory ? row.next : row.old;
    next[row.pair.cases] = chosen.cases;
    next[row.pair.items] = chosen.items;
  }

  for (const row of adjustments.costs) {
    const chosen = useNewCost ? row.next : row.old;
    next[row.pair.caseField] = chosen.caseCost;
    next[row.pair.itemField] = chosen.itemCost;
  }

  return next;
}
