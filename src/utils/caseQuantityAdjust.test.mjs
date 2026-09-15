// Case Quantity adjustment rules. Run: node src/utils/caseQuantityAdjust.test.mjs
import assert from 'node:assert/strict';
import {
  INVENTORY_PAIRS,
  COST_PAIRS,
  inventoryPairOptions,
  costPairOptions,
  buildAdjustments,
  applyAdjustments,
} from './caseQuantityAdjust.js';

// The reference's own worked example (measured 2026-09-15): case quantity 24 -> 12
// on a product holding 5 cases + 6 items at $48 a case / $2 an item.
const product = (over = {}) => ({
  caseQuantity: 24,
  currentStockCases: 5,
  currentStockItems: 6,
  reorderLevelCases: 0,
  reorderLevelItems: 0,
  reorderAmountCases: 0,
  reorderAmountItems: 0,
  reorderLimitCases: '',
  reorderLimitItems: '',
  maxOnHandCases: '',
  maxOnHandItems: '',
  caseCost: 48,
  itemCost: 2,
  averageCaseCost: 48,
  averageItemCost: 2,
  ...over,
});

const quantityPair = INVENTORY_PAIRS[0];
const lastCostPair = COST_PAIRS[0];

// --- inventory: the two readings --------------------------------------------------

{
  const opt = inventoryPairOptions(product(), quantityPair, 24, 12);
  assert.deepEqual(opt.old, { cases: 5, items: 6 }, 'Old keeps the cases/items numbers');
  assert.deepEqual(opt.next, { cases: 10, items: 6 }, 'New keeps the 126 units on hand');
  assert.equal(opt.changed, true);
}

{
  // Going the other way: 126 units at 24 per case is 5 cases + 6 items again.
  const opt = inventoryPairOptions(product({ currentStockCases: 10, currentStockItems: 6 }), quantityPair, 12, 24);
  assert.deepEqual(opt.old, { cases: 10, items: 6 }, 'Old is still the typed numbers');
  assert.deepEqual(opt.next, { cases: 5, items: 6 }, 'New re-splits 126 units at 24');
}

{
  // Loose items that fill a case become a case, the same way the server splits.
  const opt = inventoryPairOptions(product({ currentStockCases: 0, currentStockItems: 23 }), quantityPair, 24, 5);
  assert.deepEqual(opt.next, { cases: 4, items: 3 }, '23 units at 5 per case is 4 cases + 3');
}

{
  // A case size the stock does not divide by evenly still keeps every unit.
  const opt = inventoryPairOptions(product(), quantityPair, 24, 5);
  const units = opt.next.cases * 5 + opt.next.items;
  assert.equal(units, 126, 'no unit is lost or invented when the split is uneven');
}

{
  const opt = inventoryPairOptions(product({ currentStockCases: 0, currentStockItems: 0 }), quantityPair, 24, 12);
  assert.equal(opt.changed, false, 'empty stock reads the same either way');
  assert.equal(opt.blank, false, 'a typed 0 is a value, not a blank');
}

{
  const blankPair = INVENTORY_PAIRS.find((p) => p.cases === 'maxOnHandCases');
  assert.equal(inventoryPairOptions(product(), blankPair, 24, 12).blank, true, 'never-set fields are blank');
}

// --- cost: the two readings -------------------------------------------------------

{
  const opt = costPairOptions(product(), lastCostPair, 12);
  assert.deepEqual(opt.old, { caseCost: 48, itemCost: 4 }, 'Old keeps the $48 case, so an item is $4');
  assert.deepEqual(opt.next, { caseCost: 24, itemCost: 2 }, 'New keeps the $2 item, so a case is $24');
  assert.equal(opt.changed, true);
}

{
  // Cents are rounded the same way every other cost path rounds them.
  const opt = costPairOptions(product({ caseCost: 10, itemCost: 0.42 }), lastCostPair, 24);
  assert.equal(opt.old.itemCost, 0.42, '10 / 24 rounds to 0.42');
  assert.equal(opt.next.caseCost, 10.08, '0.42 * 24 is 10.08');
}

{
  const opt = costPairOptions(product({ caseCost: 0, itemCost: 0, averageCaseCost: 0, averageItemCost: 0 }), lastCostPair, 12);
  assert.equal(opt.changed, false, 'a product with no cost reads the same either way');
}

// --- what the dialog is built from ------------------------------------------------

{
  const adj = buildAdjustments(product(), 24, 12);
  assert.ok(adj, 'a real change has adjustments to offer');
  assert.equal(adj.newCaseQty, 12);
  assert.deepEqual(
    adj.inventory.map((r) => r.pair.label),
    ['Quantity', 'Reorder Level', 'Reorder Amount'],
    'blank free-text rows are left out; the typed zeros stay (the "+2 more fields")'
  );
  assert.deepEqual(adj.costs.map((r) => r.pair.label), ['Last Cost', 'Average Cost']);
}

{
  assert.equal(buildAdjustments(product(), 24, 24), null, 'the same size changes nothing');
  const empty = product({
    currentStockCases: 0, currentStockItems: 0,
    reorderLevelCases: 0, reorderLevelItems: 0,
    reorderAmountCases: 0, reorderAmountItems: 0,
    caseCost: 0, itemCost: 0, averageCaseCost: 0, averageItemCost: 0,
  });
  assert.equal(buildAdjustments(empty, 24, 12), null, 'nothing to adjust means no dialog');
}

// --- applying the picks -----------------------------------------------------------

{
  const form = product();
  const adj = buildAdjustments(form, 24, 12);
  const out = applyAdjustments(form, adj, { inventory: 'new', cost: 'new' });
  assert.equal(out.caseQuantity, 12);
  assert.equal(out.currentStockCases, 10);
  assert.equal(out.currentStockItems, 6);
  assert.equal(out.caseCost, 24, 'Last Case Cost follows the item cost');
  assert.equal(out.itemCost, 2);
  assert.equal(out.averageCaseCost, 24, 'Average Case Cost follows the average item cost');
  assert.equal(out.averageItemCost, 2);
}

{
  const form = product();
  const adj = buildAdjustments(form, 24, 12);
  const out = applyAdjustments(form, adj, { inventory: 'old', cost: 'old' });
  assert.equal(out.currentStockCases, 5, 'Old keeps the numbers that were typed');
  assert.equal(out.currentStockItems, 6);
  assert.equal(out.caseCost, 48, 'Old keeps the case cost');
  assert.equal(out.itemCost, 4, 'so the item cost is re-derived');
}

{
  // The two columns are picked independently.
  const form = product();
  const adj = buildAdjustments(form, 24, 12);
  const out = applyAdjustments(form, adj, { inventory: 'new', cost: 'old' });
  assert.equal(out.currentStockCases, 10);
  assert.equal(out.caseCost, 48);
  assert.equal(out.itemCost, 4);
}

{
  const form = product();
  const adj = buildAdjustments(form, 24, 12);
  const out = applyAdjustments(form, adj, { inventory: 'new', cost: 'new' });
  assert.equal(out.maxOnHandCases, '', 'a blank field is not turned into a typed 0');
  assert.equal(out.reorderLimitItems, '');
}

{
  assert.equal(applyAdjustments(null, {}, {}), null, 'no form data is safe');
  const form = product();
  assert.equal(applyAdjustments(form, null, {}), form, 'no adjustments is a no-op');
}

console.log('caseQuantityAdjust: all assertions passed');
