// node src/utils/crossPromotion.test.mjs
// Every ON case is a cart rung up on the reference TEST store (08/10/2026,
// Cross promotion count ON); the OFF case is the support article's example.
import assert from 'node:assert/strict';
import { allocateCrossPromotions } from './crossPromotion.js';

const A = 'a'; const B = 'b';
const promo1 = { key: 'p1', productIds: new Set([A]), setQty: 2, receiveType: 'total_price', receiveValue: 20 };
const promo2 = { key: 'p2', productIds: new Set([A, B]), setQty: 6, receiveType: 'percentage_discount', receiveValue: 10 };
const cart = (qa, qb) => [
  ...(qa ? [{ index: 'A', productId: A, q: qa, unit: 15 }] : []),
  ...(qb ? [{ index: 'B', productId: B, q: qb, unit: 10 }] : []),
];
const run = (qa, qb, crossCount) => {
  const r = allocateCrossPromotions(cart(qa, qb), [promo1, promo2], { crossCount });
  return { A: r.prices.get('A'), B: r.prices.get('B'), p1: r.applied.get('p1'), p2: r.applied.get('p2') };
};

// ---- ON (measured) ----
assert.deepEqual(run(4, 2, true), { A: 40, B: 18, p1: true, p2: true }, 'ON 4A+2B: docs example, A $40 B $18');
assert.deepEqual(run(6, 0, true), { A: 60, B: undefined, p1: true, p2: true }, 'ON 6A: 3 x $20, promo 2 counts but $10 beats $13.50');
assert.deepEqual(run(3, 3, true), { A: 33.5, B: 27, p1: true, p2: true }, 'ON 3A+3B: 2 at $10 + 1 at $13.50; B 3 x $9');
assert.deepEqual(run(2, 4, true), { A: 20, B: 36, p1: true, p2: true }, 'ON 2A+4B');
assert.deepEqual(run(1, 5, true), { A: 13.5, B: 45, p1: false, p2: true }, 'ON 1A+5B: promo 1 needs 2 A');
assert.deepEqual(run(4, 1, true), { A: 40, B: 10, p1: true, p2: false }, 'ON 4A+1B: 5 units < 6');
assert.deepEqual(run(0, 6, true), { A: undefined, B: 54, p1: false, p2: true }, '6B alone = $54');

// ---- OFF (support article) ----
assert.deepEqual(run(4, 2, false), { A: 40, B: 20, p1: true, p2: false }, 'OFF 4A+2B: A $40, B at normal $20 - promo 1 wins, its units do not count for promo 2');
assert.deepEqual(run(0, 6, false), { A: undefined, B: 54, p1: false, p2: true }, 'OFF 6B: only promo 2 is in play');
// OFF picks the cheaper basket: 6A -> promo 1 on all six ($60) beats 10% off ($81)
assert.deepEqual(run(6, 0, false), { A: 60, B: undefined, p1: true, p2: false }, 'OFF 6A: cheapest option');

// ---- single total_price promo keeps the measured reference behaviour ----
const wt = { key: 'wt', productIds: new Set(['x', 'y']), setQty: 6, receiveType: 'total_price', receiveValue: 37 };
let r = allocateCrossPromotions([{ index: 'x', productId: 'x', q: 3, unit: 8.5 }, { index: 'y', productId: 'y', q: 3, unit: 8.5 }], [wt]);
assert.deepEqual([r.prices.get('x'), r.prices.get('y')], [18.5, 18.5], '3 + 3 on "6 for $37" = $18.50 each');
r = allocateCrossPromotions([{ index: 'x', productId: 'x', q: 7, unit: 8.5 }], [wt]);
assert.equal(r.prices.get('x'), 45.5, '7 on "6 for $37": one set + one leftover at normal');
r = allocateCrossPromotions([{ index: 'x', productId: 'x', q: 1, unit: 8.5 }], [wt]);
assert.equal(r.prices.get('x'), 8.5, 'below a set: normal');
assert.equal(r.applied.get('wt'), false);
// "3 for $10" over three products: total exact under Redistribute, $9.99 under Round
const three = [{ index: 'a', productId: 'a', q: 1, unit: 6.5 }, { index: 'b', productId: 'b', q: 1, unit: 6.5 }, { index: 'c', productId: 'c', q: 1, unit: 6.5 }];
const ten = { key: 't', productIds: new Set(['a', 'b', 'c']), setQty: 3, receiveType: 'total_price', receiveValue: 10 };
r = allocateCrossPromotions(three, [ten], { rounding: 'Redistribute' });
assert.deepEqual([r.prices.get('a'), r.prices.get('b'), r.prices.get('c')], [3.34, 3.33, 3.33], 'redistribute: first line carries the cent');
r = allocateCrossPromotions(three, [ten], { rounding: 'Round' });
assert.deepEqual([r.prices.get('a'), r.prices.get('b'), r.prices.get('c')], [3.33, 3.33, 3.33], 'round: $9.99');
// Max Applications Per Sale
r = allocateCrossPromotions([{ index: 'x', productId: 'x', q: 12, unit: 8.5 }], [{ ...wt, maxSets: 1 }]);
assert.equal(r.prices.get('x'), 37 + 6 * 8.5, 'max 1 set');

console.log('crossPromotion: all assertions passed');
