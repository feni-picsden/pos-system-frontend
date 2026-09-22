// Run: node src/utils/promotionCriteria.test.mjs
import assert from 'node:assert/strict';
import { unitCostOf, receiveFromItem, criteriaFromItems, criteriaOfPromotion } from './promotionCriteria.js';

// Carlton as the API now returns it inside a promotion item (default price rows included).
const carlton = {
  id: 1, name: 'Carlton Draught Stubbie 375ml', itemCost: 2, averageItemCost: 2,
  prices: [
    { quantity: 24, price: 80, cost: 48, priceSetId: null },
    { quantity: 1, price: 5, cost: 2, priceSetId: null },
    { quantity: 6, price: 16, cost: 12, priceSetId: null },
  ],
};

// --- cost: never from the non-existent `product.cost`
assert.equal(unitCostOf(carlton), 2, 'quantity-1 row cost');
assert.equal(unitCostOf({ itemCost: 3.45, prices: [{ quantity: 1, price: 6.5, cost: 0 }] }), 3.45, 'row has no cost -> product unit cost');
assert.equal(unitCostOf({ itemCost: 1.4, prices: [] }), 1.4, 'no price rows -> product unit cost');
assert.equal(unitCostOf({ itemCost: 2, averageItemCost: 3, prices: [] }, 'Average Cost'), 3, 'follows Cost Calculation Method');
assert.equal(unitCostOf({ prices: [{ quantity: 6, price: 16, cost: 12 }] }), 2, 'smallest row is a 6-pack -> per unit');
assert.equal(unitCostOf({ name: 'no cost anywhere', prices: [{ quantity: 1, price: 5 }] }), 0, 'unknown cost stays 0 (shown as N/A)');
assert.equal(unitCostOf(null), 0);

// --- the audit case: Summer Beer Special = Carlton, buy 1, total price $3.50
const rows = [{ id: 11, productId: 1, productName: carlton.name, quantity: 1, normalPrice: 4, promoPrice: 3.5, discountAmount: 0.5, isRequired: false, product: carlton }];
const criteria = criteriaFromItems(rows);
assert.equal(criteria.length, 1);
assert.equal(criteria[0].purchaseValue, 1);
assert.deepEqual([criteria[0].receiveType, criteria[0].receiveValue], ['total_price', 3.5]);
assert.equal(criteria[0].isOptional, true, 'isRequired:false reads as Optional');
const item = criteria[0].items[0];
assert.equal(item.cost, 2, 'cost reaches the criterion item (was 0 -> PROFIT N/A)');
assert.equal(item.originalPrice, 4, "the row's own normal price wins");
assert.equal(item.productId, 1);
assert.equal(item.pricingTiers.length, 3);
// the margin the editor computes from it: (3.50 - 2.00) / 3.50
assert.equal((((3.5 - item.cost) / 3.5) * 100).toFixed(2), '42.86');

// --- grouping + reward mapping
assert.deepEqual(receiveFromItem({ discountPercentage: 10 }), { receiveType: 'percentage_discount', receiveValue: 10 });
assert.deepEqual(receiveFromItem({ discountAmount: 2 }), { receiveType: 'discount_each_item', receiveValue: 2 });
assert.deepEqual(receiveFromItem({}), { receiveType: 'quantity_only', receiveValue: 0 });
assert.equal(criteriaFromItems([rows[0], { ...rows[0], id: 12, productId: 2 }]).length, 1, 'same deal -> one criterion');
assert.equal(criteriaFromItems([rows[0], { ...rows[0], id: 13, promoPrice: 3 }]).length, 2, 'different reward -> two');
assert.equal(criteriaFromItems([{ productId: 9, productName: 'Deleted product', quantity: 1, promoPrice: 1 }])[0].items[0].productId, 9, 'deleted product keeps its id and name');

// --- stored criteria saved BEFORE the fix: snapshot says cost 0 / no price rows
const { hydrateCriteria } = await import('./promotionCriteria.js');
const staleCriteria = [{ id: 'c1', purchaseValue: 1, receiveType: 'total_price', receiveValue: 3.5, items: [
  { id: 7, productId: 1, name: 'Carlton Draught Stubbie 375ml', originalPrice: 5, pricingTiers: [], cost: 0, rebateAmount: 0.25, excluded: false },
  { id: 8, productId: 99, name: 'Not on the rows', originalPrice: 9, pricingTiers: [], cost: 0, excluded: true },
] }];
const fresh = hydrateCriteria(staleCriteria, rows);
assert.equal(fresh[0].items[0].cost, 2, 'stale cost 0 refreshed from the current product');
assert.equal(fresh[0].items[0].pricingTiers.length, 3, 'price rows refreshed');
assert.equal(fresh[0].items[0].rebateAmount, 0.25, 'the rest of the saved item is untouched');
assert.deepEqual(fresh[0].items[1], staleCriteria[0].items[1], 'a product not on the rows is left exactly as saved');
assert.equal(staleCriteria[0].items[0].cost, 0, 'the input is not mutated');
assert.deepEqual(hydrateCriteria(staleCriteria, []), staleCriteria, 'no rows -> unchanged');
// a real cost that later changed on the product wins over the old snapshot
assert.equal(hydrateCriteria([{ items: [{ productId: 1, cost: 1.5, pricingTiers: [] }] }], rows)[0].items[0].cost, 2);

// --- view: stored criteria win; otherwise rebuilt from rows (the view used to show nothing)
const stored = [{ id: 'x', items: [] }];
assert.deepEqual(criteriaOfPromotion({ conditions: { criteria: stored }, items: rows }), stored);
assert.equal(criteriaOfPromotion({ conditions: { criteria: staleCriteria }, items: rows })[0].items[0].cost, 2, 'stored criteria are refreshed on load');
assert.equal(criteriaOfPromotion({ conditions: null, items: rows }).length, 1);
assert.deepEqual(criteriaOfPromotion({ conditions: { criteria: [] }, items: [] }), []);

console.log('promotionCriteria: all assertions passed');
