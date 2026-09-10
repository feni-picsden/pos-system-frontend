// Run: node src/utils/priceRowSync.test.mjs
import assert from 'node:assert/strict';
import { syncPriceRowsFromUnitPrice } from './priceRowSync.js';

const rows = () => [
  { quantity: 1, price: 0, cost: 0, percentage: 0 },
  { quantity: 6, price: 0, cost: 0, percentage: 0 },
];

// The reported case: $30 on the 6-pack makes the single $5.
{
  const r = rows();
  r[1].price = 30;
  const out = syncPriceRowsFromUnitPrice(r, 1, 0);
  assert.equal(out[0].price, 5);
  assert.equal(out[1].price, 30, 'the edited row keeps exactly what was typed');
}

// And the other direction: $5 on the single makes the 6-pack $30.
{
  const r = rows();
  r[0].price = 5;
  assert.equal(syncPriceRowsFromUnitPrice(r, 0, 0)[1].price, 30);
}

// Three pack sizes all follow the same per-unit price.
{
  const r = [
    { quantity: 1, price: 0 },
    { quantity: 6, price: 30 },
    { quantity: 12, price: 0 },
  ];
  const out = syncPriceRowsFromUnitPrice(r, 1, 0);
  assert.deepEqual(out.map((x) => x.price), [5, 30, 60]);
}

// Money is rounded to cents, never left at 4.285714...
{
  const r = [{ quantity: 1, price: 0 }, { quantity: 7, price: 30 }];
  assert.equal(syncPriceRowsFromUnitPrice(r, 1, 0)[0].price, 4.29);
}

// Cost and GP% are refreshed on every touched row, edited row included.
{
  const r = rows();
  r[1].price = 30;
  const out = syncPriceRowsFromUnitPrice(r, 1, 2); // itemCost $2
  assert.equal(out[0].cost, 2);
  assert.equal(out[1].cost, 12);
  assert.equal(out[0].percentage, 60); // 1 - 2/5
  assert.equal(out[1].percentage, 60); // 1 - 12/30
}

// A different price set is a different customer group — leave it alone.
{
  const r = [
    { quantity: 1, price: 9, priceSetId: 2 },
    { quantity: 1, price: 0, priceSetId: null },
    { quantity: 6, price: 30, priceSetId: null },
  ];
  const out = syncPriceRowsFromUnitPrice(r, 2, 0);
  assert.equal(out[0].price, 9, 'other price set untouched');
  assert.equal(out[1].price, 5);
}

// Mid-typing states must not wipe the sibling rows.
for (const bad of ['', null, undefined, 0, NaN, 'abc']) {
  const r = rows();
  r[0].price = 7;
  r[1].price = bad;
  assert.equal(syncPriceRowsFromUnitPrice(r, 1, 0)[0].price, 7, `price ${String(bad)}`);
}
for (const bad of ['', null, undefined, 0, NaN, 'abc', -3]) {
  const r = rows();
  r[0].price = 7;
  r[1] = { quantity: bad, price: 30 };
  assert.equal(syncPriceRowsFromUnitPrice(r, 1, 0)[0].price, 7, `quantity ${String(bad)}`);
}

// A sibling with no usable quantity is skipped, not priced to NaN.
{
  const r = [{ quantity: '', price: 4 }, { quantity: 6, price: 30 }];
  const out = syncPriceRowsFromUnitPrice(r, 1, 0);
  assert.equal(out[0].price, 4);
}

// String inputs from the number fields behave like numbers.
{
  const r = [{ quantity: '1', price: '0' }, { quantity: '6', price: '30' }];
  assert.equal(syncPriceRowsFromUnitPrice(r, 1, 0)[0].price, 5);
}

// Never mutates its input, and survives junk arguments.
{
  const r = rows();
  r[1].price = 30;
  const snapshot = JSON.stringify(r);
  syncPriceRowsFromUnitPrice(r, 1, 0);
  assert.equal(JSON.stringify(r), snapshot);
  assert.equal(syncPriceRowsFromUnitPrice(null, 0, 0), null);
  assert.deepEqual(syncPriceRowsFromUnitPrice([], 0, 0), []);
  assert.deepEqual(syncPriceRowsFromUnitPrice(r, 99, 0), r);
}

// A single-row table is a valid table.
{
  const out = syncPriceRowsFromUnitPrice([{ quantity: 6, price: 30 }], 0, 1);
  assert.equal(out[0].price, 30);
  assert.equal(out[0].cost, 6);
}

console.log('priceRowSync: ok');
