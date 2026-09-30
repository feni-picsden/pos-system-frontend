// node src/utils/priceChangeTicket.test.mjs
import assert from 'node:assert/strict';
import { sellPricesChanged, queueEverydayTicket } from './priceChangeTicket.js';

const rows = (...pairs) => pairs.map(([quantity, price, cost = 2]) => ({ quantity, price, cost, percentage: 0 }));

// Same rows -> no ticket
assert.equal(sellPricesChanged(rows([1, 5]), rows([1, 5])), false);
// Strings from the editor vs numbers from the API are the same price
assert.equal(sellPricesChanged(rows([1, 5]), [{ quantity: '1', price: '5.00' }]), false);
// Qty-1 price changed (Beer $5 -> $5.50)
assert.equal(sellPricesChanged(rows([1, 5]), rows([1, 5.5])), true);
// A higher tier changed (Alkoomi 12-pack $166.87 -> $125.15) - ticket too
assert.equal(sellPricesChanged(rows([1, 15], [12, 166.87]), rows([1, 15], [12, 125.15])), true);
// Tier added / removed
assert.equal(sellPricesChanged(rows([1, 5]), rows([1, 5], [6, 27])), true);
assert.equal(sellPricesChanged(rows([1, 5], [6, 27]), rows([1, 5])), true);
// Only cost / percentage changed -> the ticket price is unchanged, no ticket
assert.equal(sellPricesChanged(rows([1, 5, 2]), rows([1, 5, 2.5])), false);
// A blank "New Price Point" row is not a price point
assert.equal(sellPricesChanged(rows([1, 5]), [...rows([1, 5]), { quantity: '', price: '' }]), false);
// Rounding noise is not a change
assert.equal(sellPricesChanged(rows([1, 5.1]), rows([1, 5.100000001])), false);

// queueEverydayTicket: calls the service once, swallows "already exists" and network errors
let calls = [];
const ok = { addShelfTicket: async (d) => { calls.push(d); return {}; } };
assert.equal(await queueEverydayTicket(ok, '343'), true);
assert.deepEqual(calls, [{ productId: 343, ticketType: 'Everyday', productGrouping: null }]);
const dup = { addShelfTicket: async () => { const e = new Error('dup'); e.response = { status: 400 }; throw e; } };
assert.equal(await queueEverydayTicket(dup, 343), false);
const down = { addShelfTicket: async () => { throw new Error('network'); } };
const origError = console.error; console.error = () => {};
assert.equal(await queueEverydayTicket(down, 343), false);
console.error = origError;
assert.equal(await queueEverydayTicket(ok, 'abc'), false);
assert.equal(calls.length, 1);

console.log('priceChangeTicket: all cases pass');
