// node src/utils/criteriaPromotion.test.mjs
// Every case is a sale rung up on the live reference POS (screenshots 389-405).
import assert from 'node:assert/strict';
import { allocateTotalPriceSets, allocateCriteriaSets, allocateSpendPromotion, mergeCriteriaGroups, splitCents } from './criteriaPromotion.js';

// --- Price Rounding Mode (Setup > General) - reference More Info tables -----------
{
  // "3 for $10" over A, B, C: Redistribute $3.34 / $3.33 / $3.33 (first line gets
  // the cent), Round $3.33 x 3 = $9.99.
  assert.deepEqual(splitCents(1000, [1, 1, 1], 'Redistribute'), [334, 333, 333], 'redistribute: first line carries the cent');
  // 166.67 rounds UP to 167 on five lines, so the first (absorbing) line is 165 and the total is still $10.00
  assert.deepEqual(splitCents(1000, [1, 1, 1, 1, 1, 1], 'Redistribute'), [165, 167, 167, 167, 167, 167], 'six equal lines: the first takes the whole gap');
  assert.deepEqual(splitCents(1000, [1, 1, 1], 'Round'), [333, 333, 333], 'round: every line rounded, $9.99');
  // Fuel $1.419 x 35 = $49.665 split 17 + 18: Redistribute $24.12 / $25.55 (= $49.67),
  // Round $24.12 / $25.54 (= $49.66). The sale total is rounded first ($49.67).
  // exact sale total 4966.5 cents ($49.665): lines round from their exact values
  assert.deepEqual(splitCents(4966.5, [17, 18], 'Redistribute'), [2412, 2555], 'redistribute: $49.67 total, the larger (18) line takes the gap');
  assert.deepEqual(splitCents(4966.5, [17, 18], 'Round'), [2412, 2554], 'round: 17 x 1.419 = 24.123, 18 x 1.419 = 25.542');
  assert.deepEqual(splitCents(4966.5, [35], 'Round'), [4967], 'one line of 35: $49.67 either way');
  assert.deepEqual(splitCents(4966.5, [35], 'Redistribute'), [4967], 'one line of 35: $49.67 either way');
  // Through the promotion allocator: three products, one each, "Purchase 3 -> $10"
  const three = [{ index: 'a', q: 1, unit: 6.5 }, { index: 'b', q: 1, unit: 6.5 }, { index: 'c', q: 1, unit: 6.5 }];
  let rr = allocateTotalPriceSets(three, { setQty: 3, setPrice: 10, rounding: 'Redistribute' });
  assert.deepEqual([rr.prices.get('a'), rr.prices.get('b'), rr.prices.get('c')], [3.34, 3.33, 3.33], 'promo redistribute');
  rr = allocateTotalPriceSets(three, { setQty: 3, setPrice: 10, rounding: 'Round' });
  assert.deepEqual([rr.prices.get('a'), rr.prices.get('b'), rr.prices.get('c')], [3.33, 3.33, 3.33], 'promo round = $9.99');
  rr = allocateTotalPriceSets(three, { setQty: 3, setPrice: 10 });
  assert.deepEqual([rr.prices.get('a'), rr.prices.get('b'), rr.prices.get('c')], [3.34, 3.33, 3.33], 'default is Redistribute');
}

const run = (lines, rule) => {
  const r = allocateTotalPriceSets(lines, rule);
  const total = [...r.prices.values()].reduce((s, v) => s + v, 0);
  return { ...r, total: Math.round(total * 100) / 100 };
};

// "Purchase 6 -> $37" over Wild Turkey 101 3x10pk ($8.50) and 12PK ($8.50)
const WT = { setQty: 6, setPrice: 37 };
let r = run([{ index: 'a', q: 1, unit: 8.5 }], WT);                               // SS 401
assert.equal(r.total, 8.5); assert.equal(r.allCovered, false);
r = run([{ index: 'a', q: 3, unit: 8.5 }], WT);                                   // SS 402
assert.equal(r.total, 25.5); assert.equal(r.allCovered, false);
r = run([{ index: 'a', q: 3, unit: 8.5 }, { index: 'b', q: 1, unit: 8.5 }], WT);  // SS 403
assert.equal(r.total, 34); assert.equal(r.allCovered, false);
r = run([{ index: 'a', q: 3, unit: 8.5 }, { index: 'b', q: 3, unit: 8.5 }], WT);  // SS 404
assert.equal(r.total, 37); assert.equal(r.prices.get('a'), 18.5); assert.equal(r.prices.get('b'), 18.5);
assert.equal(r.allCovered, true);
r = run([{ index: 'a', q: 6, unit: 8.5 }], WT);                                   // SS 405
assert.equal(r.total, 37); assert.equal(r.allCovered, true);
r = run([{ index: 'a', q: 12, unit: 8.5 }], WT);                                  // repeats per set
assert.equal(r.total, 74); assert.equal(r.sets, 2);
r = run([{ index: 'a', q: 7, unit: 8.5 }], WT);                                   // leftover at normal
assert.equal(r.total, 45.5); assert.equal(r.allCovered, false);
r = run([{ index: 'a', q: 12, unit: 8.5 }], { ...WT, maxSets: 1 });               // Max Applications Per Sale
assert.equal(r.total, 37 + 6 * 8.5);

// "Purchase 1 -> $67.99" over Absolut 1L ($69.99), Smirn 1L ($54.99)
const AB = { setQty: 1, setPrice: 67.99 };
r = run([{ index: 'abs', q: 1, unit: 69.99 }, { index: 'smi', q: 1, unit: 54.99 }], AB); // SS 395
assert.equal(r.prices.get('abs'), 67.99); assert.equal(r.prices.get('smi'), 54.99);
assert.equal(r.total, 122.98); assert.equal(r.allCovered, false);
r = run([{ index: 'abs', q: 2, unit: 69.99 }], AB);                               // SS 396
assert.equal(r.total, 135.98); assert.equal(r.allCovered, true);

// "Purchase 24 -> $44.99" Strongbow Classic Stubs ($4.00 each)
const SB = { setQty: 24, setPrice: 44.99 };
r = run([{ index: 's', q: 1, unit: 4 }], SB);                                     // SS 389
assert.equal(r.total, 4); assert.equal(r.allCovered, false);
// SS 390 (the live Savings $10 comes from the product's 24-unit price break; the
// app feeds normal prices WITH breaks, here a flat $4 is enough for the set maths)
r = run([{ index: 's', q: 24, unit: 4 }], SB);
assert.equal(r.total, 44.99); assert.equal(r.allCovered, true);

// TWO Required criteria: "Purchase 1 -> $15" De Bort Prosecco ($16.99; 2 bottles
// $28.00) AND "Purchase 1 -> $17" De Bortoli Muscat ($22.99)   (SS 407-411)
const PRO = (q, unit) => ({ lines: [{ index: 'pro', q, unit }], setQty: 1, setPrice: 15 });
const MUS = (q) => ({ lines: q ? [{ index: 'mus', q, unit: 22.99 }] : [], setQty: 1, setPrice: 17 });
const multi = (groups) => {
  const res = allocateCriteriaSets(groups);
  return { ...res, total: Math.round([...res.prices.values()].reduce((s, v) => s + v, 0) * 100) / 100 };
};
r = multi([PRO(1, 16.99), MUS(0)]);                                               // SS 408 Prosecco alone
assert.equal(r.total, 16.99); assert.equal(r.allCovered, false);
r = multi([{ lines: [], setQty: 1, setPrice: 15 }, MUS(1)]);                      // SS 409 Muscat alone
assert.equal(r.total, 22.99); assert.equal(r.allCovered, false);
r = multi([PRO(1, 16.99), MUS(1)]);                                               // SS 410 both
assert.equal(r.prices.get('pro'), 15); assert.equal(r.prices.get('mus'), 17);
assert.equal(r.total, 32); assert.equal(r.allCovered, true);
r = multi([PRO(2, 14), MUS(1)]);                                                  // SS 411 2 Prosecco + 1 Muscat
assert.equal(r.prices.get('pro'), 28); assert.equal(r.prices.get('mus'), 17);
assert.equal(r.total, 45); assert.equal(r.allCovered, false);

// SPEND & GET (help article: spend at least $X, then the discount applies).
// Required "spend $50" on Beer ($10 each) + Optionally "purchase 1 -> a total
// price of $1" on Coke ($3).
const spend = (beerQty, cokeQty) => allocateSpendPromotion([
  { kind: 'spend', threshold: 50, receiveType: 'quantity_only', receiveValue: 0, lines: beerQty ? [{ index: 'beer', q: beerQty, unit: 10 }] : [] },
  { kind: 'purchase', threshold: 1, optional: true, receiveType: 'total_price', receiveValue: 1, lines: cokeQty ? [{ index: 'coke', q: cokeQty, unit: 3 }] : [] },
]);
const sum = (m) => Math.round([...m.values()].reduce((s, v) => s + v, 0) * 100) / 100;
let s = spend(3, 1);                          // spent $30 < $50: nothing
assert.equal(sum(s.prices), 33); assert.equal(s.applied, false);
s = spend(5, 1);                              // spent exactly $50: Coke $1
assert.equal(s.prices.get('coke'), 1); assert.equal(sum(s.prices), 51); assert.equal(s.applied, true);
s = spend(6, 2);                              // one reward: 1 Coke $1, 1 Coke $3
assert.equal(s.prices.get('coke'), 4); assert.equal(s.prices.get('beer'), 60);
s = spend(6, 0);                              // no reward item in the cart: nothing to apply
assert.equal(sum(s.prices), 60); assert.equal(s.applied, false);
s = spend(0, 1);                              // Coke alone never gets the reward
assert.equal(sum(s.prices), 3); assert.equal(s.applied, false);
// Single "spend $100 on Wine to receive a discount of $10": 2 x $60 -> $110
s = allocateSpendPromotion([{ kind: 'spend', threshold: 100, receiveType: 'discount', receiveValue: 10, lines: [{ index: 'w', q: 2, unit: 60 }] }]);
assert.equal(sum(s.prices), 110); assert.equal(s.applied, true);
// "spend $50 to receive a percentage discount of 10%": $60 -> $54, $40 -> $40
s = allocateSpendPromotion([{ kind: 'spend', threshold: 50, receiveType: 'percentage_discount', receiveValue: 10, lines: [{ index: 'w', q: 3, unit: 20 }] }]);
assert.equal(sum(s.prices), 54);
s = allocateSpendPromotion([{ kind: 'spend', threshold: 50, receiveType: 'percentage_discount', receiveValue: 10, lines: [{ index: 'w', q: 2, unit: 20 }] }]);
assert.equal(sum(s.prices), 40); assert.equal(s.applied, false);

// "Spend $100 or more of any product -> $10 off the total" (seed promotion, reference
// SS 533). Reference (Promotion Stacker + Cross Promotion Count articles): standard
// promotions never stack - each is worked out from the EVERYDAY price and the
// customer gets whichever single promotion is cheaper. 20 Jim Beam at $5.50 = $110.
s = allocateSpendPromotion([{ kind: 'spend', threshold: 100, receiveType: 'discount_total', receiveValue: 10, lines: [{ index: 'jb', q: 20, unit: 5.5 }] }]);
assert.equal(sum(s.prices), 100); assert.equal(s.applied, true);
s = allocateSpendPromotion([{ kind: 'spend', threshold: 100, receiveType: 'discount_total', receiveValue: 10, lines: [{ index: 'jb', q: 16, unit: 5.5 }] }]);
assert.equal(sum(s.prices), 88); assert.equal(s.applied, false);   // $88: not met

// Measured on the LIVE reference (ZZTEST Spend & Get, 01/10/2026): A $60, B $50,
// "Spend $100 (amount only)" on A + B, plus a purchase criterion on the SAME A + B.
{
  const A = (q) => ({ index: 'A', q, unit: 60 });
  const B = (q) => ({ index: 'B', q, unit: 50 });
  const live = (purchase, cart, opts) => allocateSpendPromotion([
    { kind: 'spend', threshold: 100, receiveType: 'quantity_only', receiveValue: 0, lines: cart },
    { kind: 'purchase', ...purchase, lines: cart },
  ], opts);
  // Required "purchase 1 -> a discount on each item worth $10": every unit $10 off
  let l = live({ threshold: 1, receiveType: 'discount_each_item', receiveValue: 10 }, [A(1), B(2)]);   // SS 729
  assert.equal(l.prices.get('A'), 50); assert.equal(l.prices.get('B'), 80); assert.equal(sum(l.prices), 130);
  l = live({ threshold: 1, receiveType: 'discount_each_item', receiveValue: 10 }, [A(1), B(1)]);       // SS 730
  assert.equal(sum(l.prices), 90);
  l = live({ threshold: 1, receiveType: 'discount_each_item', receiveValue: 10 }, [B(1)]);             // SS 731: $50 < $100
  assert.equal(sum(l.prices), 50); assert.equal(l.applied, false);
  // Required "purchase 1 -> a discount off the total worth $10": one set per unit -> same money
  l = live({ threshold: 1, receiveType: 'discount_total', receiveValue: 10 }, [A(1), B(1)]);           // SS 732
  assert.equal(l.prices.get('A'), 50); assert.equal(l.prices.get('B'), 40);
  l = live({ threshold: 1, receiveType: 'discount_total', receiveValue: 10 }, [A(1), B(2)]);           // SS 733
  assert.equal(sum(l.prices), 130);
  // Required "purchase 2 -> $10 off the total": $5 off EACH unit of the set, not by value
  l = live({ threshold: 2, receiveType: 'discount_total', receiveValue: 10 }, [A(1), B(1)]);           // SS 735
  assert.equal(l.prices.get('A'), 55); assert.equal(l.prices.get('B'), 45);
  l = live({ threshold: 2, receiveType: 'discount_total', receiveValue: 10 }, [A(2), B(2)]);           // SS 736: 2 sets
  assert.equal(l.prices.get('A'), 110); assert.equal(l.prices.get('B'), 90); assert.equal(sum(l.prices), 200);
  l = live({ threshold: 2, receiveType: 'discount_total', receiveValue: 10 }, [A(2), B(2)], { maxSets: 1 });
  assert.equal(sum(l.prices), 210, 'Max Applications Per Sale caps the sets');
  // OPTIONAL purchase criterion on the same products as the spend: never rewarded (SS 738, 740, 742, 743)
  l = live({ threshold: 2, optional: true, receiveType: 'discount_total', receiveValue: 10 }, [A(1), B(1)]);
  assert.equal(sum(l.prices), 110); assert.equal(l.applied, false);
  l = live({ threshold: 1, optional: true, receiveType: 'discount_total', receiveValue: 10 }, [A(1), B(2)]);
  assert.equal(sum(l.prices), 160); assert.equal(l.applied, false);
}

// Two criteria where one criterion's promo total is ABOVE its own normal value
// (found by the random-cart pass): the set still applies because the other
// criterion saves more, but no line is ever charged more than its normal price.
r = multi([
  { lines: [{ index: 'cheap', q: 6, unit: 3.86 }], setQty: 6, setPrice: 46.87 },   // normal $23.16
  { lines: [{ index: 'dear', q: 1, unit: 80 }], setQty: 1, setPrice: 20 },          // saves $60
]);
assert.equal(r.sets, 1);
assert.equal(r.prices.get('cheap'), 23.16);   // clamped at its own normal
assert.equal(r.prices.get('dear'), 20);

// Rounding: $37 over 2 + 4 units splits exactly
r = run([{ index: 'a', q: 2, unit: 8.5 }, { index: 'b', q: 4, unit: 8.5 }], WT);
assert.equal(r.total, 37);

// MIX CRITERIA ON (help article: "mix together as if they were a single criteria",
// no live example): Prosecco "Purchase 1 -> $15" + Muscat "Purchase 1 -> $17"
// become one pool "Purchase 2 -> $32".
const mix = (groups) => multi(mergeCriteriaGroups(groups));
r = mix([PRO(2, 16.99), MUS(0)]);                                                 // 2 Prosecco alone now qualifies
assert.equal(r.total, 32); assert.equal(r.allCovered, true);
r = mix([PRO(1, 16.99), MUS(1)]);                                                 // 1 + 1 still $32
assert.equal(r.total, 32); assert.equal(r.allCovered, true);
r = mix([PRO(1, 16.99), MUS(0)]);                                                 // 1 alone: nothing
assert.equal(r.total, 16.99); assert.equal(r.allCovered, false);
r = mix([PRO(3, 16.99), MUS(1)]);                                                 // 4 units = 2 sets
assert.equal(r.total, 64); assert.equal(r.sets, 2); assert.equal(r.allCovered, true);
r = mix([PRO(2, 16.99), MUS(1)]);                                                 // 3 units: 1 set + 1 leftover
assert.equal(r.sets, 1); assert.equal(r.allCovered, false);
assert.equal(mergeCriteriaGroups([]).length, 0);

// ---- Buy X get Y (Required X "(quantity only)" + Optional Y for $0) ----
{
  const X = { index: 'x', q: 2, unit: 5 };
  const Y = { index: 'y', q: 1, unit: 3 };
  // X twice + Y: Y is free, X stays at its own price
  let r = allocateCriteriaSets([
    { lines: [X], setQty: 2, setPrice: 0, noChange: true },
    { lines: [Y], setQty: 1, setPrice: 0, optional: true },
  ]);
  assert.equal(r.sets, 1);
  assert.equal(r.prices.get('x'), 10, 'X unchanged');
  assert.equal(r.prices.get('y'), 0, 'Y free');
  // Y alone: the Required X is missing -> nothing
  r = allocateCriteriaSets([
    { lines: [], setQty: 2, setPrice: 0, noChange: true },
    { lines: [Y], setQty: 1, setPrice: 0, optional: true },
  ]);
  assert.equal(r.sets, 0, 'no X, no free Y');
  // X twice, no Y in the cart: the optional criterion does not block; nothing to pay out
  r = allocateCriteriaSets([
    { lines: [X], setQty: 2, setPrice: 0, noChange: true },
    { lines: [], setQty: 1, setPrice: 0, optional: true },
  ]);
  assert.equal(r.sets, 0, 'no saving without Y');
  assert.equal(r.prices.get('x'), 10);
  // 4 X + 2 Y: two sets, both Y free
  r = allocateCriteriaSets([
    { lines: [{ index: 'x', q: 4, unit: 5 }], setQty: 2, setPrice: 0, noChange: true },
    { lines: [{ index: 'y', q: 2, unit: 3 }], setQty: 1, setPrice: 0, optional: true },
  ]);
  assert.equal(r.sets, 2);
  assert.equal(r.prices.get('y'), 0);
  // only quantity_only criteria (nothing to receive) -> no change anywhere
  r = allocateCriteriaSets([{ lines: [X], setQty: 2, setPrice: 0, noChange: true }]);
  assert.equal(r.sets, 0);
  assert.equal(r.prices.get('x'), 10);
}

console.log('criteriaPromotion: all reference cases pass');
