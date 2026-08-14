// ponytail: one self-check for the only non-trivial logic here — tier choice.
// Run: node src/utils/baseTier.test.mjs
import assert from 'node:assert/strict';
import { getBaseTier } from './baseTier.js';

// The original defect: product 16 stores the case tier first, so prices[0] gave
// cost 1400 / price 15400 instead of the unit tier's 14 / 14.
const caseFirst = [
  { id: 250, quantity: 100, cost: 1400, price: 15400, outletId: null },
  { id: 251, quantity: 1, cost: 14, price: 14, outletId: null },
];
assert.equal(getBaseTier(caseFirst).cost, 14);
assert.equal(getBaseTier(caseFirst).price, 14);

// Unit tier already first — unchanged behaviour.
const unitFirst = [
  { id: 159, quantity: 1, cost: 20, price: 20, outletId: null },
  { id: 160, quantity: 10, cost: 200, price: 250, outletId: null },
];
assert.equal(getBaseTier(unitFirst).cost, 20);

// No quantity-1 row: fall back to the smallest quantity, not the first row.
assert.equal(
  getBaseTier([{ quantity: 24, cost: 240 }, { quantity: 6, cost: 66 }]).cost,
  66,
);

// Outlet scoping — product 16's real shape: an outlet-3 override plus globals.
const mixed = [
  { id: 298, quantity: 1, price: 9.99, outletId: 3 },
  { id: 279, quantity: 1, price: 14, outletId: null },
  { id: 280, quantity: 100, price: 15400, outletId: null },
];
// A promotion for outlet 3 must see that outlet's own price...
assert.equal(getBaseTier(mixed, 3).price, 9.99);
// ...an outlet with no override falls back to the global row, NOT outlet 3's...
assert.equal(getBaseTier(mixed, 2).price, 14);
// ...and with no outlet context, the global row wins over the outlet-specific one.
assert.equal(getBaseTier(mixed, null).price, 14);

// Outlet ids may arrive as strings from route params.
assert.equal(getBaseTier(mixed, '3').price, 9.99);

// Only outlet-specific rows exist: use them rather than returning nothing.
assert.equal(getBaseTier([{ quantity: 1, price: 5, outletId: 7 }], 2).price, 5);

// Degenerate inputs must not throw.
assert.equal(getBaseTier([]), null);
assert.equal(getBaseTier(undefined), null);
assert.equal(getBaseTier(null), null);

console.log('getBaseTier ok');
