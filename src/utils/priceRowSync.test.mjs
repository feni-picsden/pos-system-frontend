// Run: node src/utils/priceRowSync.test.mjs
import assert from 'node:assert/strict';
import { syncPriceRows } from './priceRowSync.js';

// The reported case: $30 on the case of 6 makes the single $5.
{
  const r = [{ quantity: 1, price: 8 }, { quantity: 6, price: 30 }];
  const out = syncPriceRows(r, 1, 0);
  assert.equal(out[0].price, 5);
  assert.equal(out[1].price, 30, 'the edited row keeps exactly what was typed');
}

// One way only: re-pricing the single afterwards leaves the case alone,
// so "1 for $8, 6 for $30" can be set up.
{
  const r = [{ quantity: 1, price: 8 }, { quantity: 6, price: 30 }];
  assert.equal(syncPriceRows(r, 0, 0)[1].price, 30);
}

// A pack re-prices the single only — other packs are their own deals.
{
  const r = [
    { quantity: 1, price: 0 },
    { quantity: 6, price: 30 },
    { quantity: 12, price: 50 },
  ];
  assert.deepEqual(syncPriceRows(r, 1, 0).map((x) => x.price), [5, 30, 50]);
}

// Money is rounded to cents, never left at 4.285714...
{
  const r = [{ quantity: 1, price: 0 }, { quantity: 7, price: 30 }];
  assert.equal(syncPriceRows(r, 1, 0)[0].price, 4.29);
}

// Cost and GP% are refreshed on the edited row and the re-priced single.
{
  const r = [{ quantity: 1, price: 8 }, { quantity: 6, price: 30 }];
  const out = syncPriceRows(r, 1, 2); // itemCost $2
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
  const out = syncPriceRows(r, 2, 0);
  assert.equal(out[0].price, 9, 'other price set untouched');
  assert.equal(out[1].price, 5);
}

// Mid-typing states must not wipe the single.
for (const bad of ['', null, undefined, 0, NaN, 'abc']) {
  const r = [{ quantity: 1, price: 7 }, { quantity: 6, price: bad }];
  assert.equal(syncPriceRows(r, 1, 0)[0].price, 7, `price ${String(bad)}`);
}
for (const bad of ['', null, undefined, 0, NaN, 'abc', -3]) {
  const r = [{ quantity: 1, price: 7 }, { quantity: bad, price: 30 }];
  assert.equal(syncPriceRows(r, 1, 0)[0].price, 7, `quantity ${String(bad)}`);
}

// String inputs from the number fields behave like numbers.
{
  const r = [{ quantity: '1', price: '0' }, { quantity: '6', price: '30' }];
  assert.equal(syncPriceRows(r, 1, 0)[0].price, 5);
}

// Never mutates its input, and survives junk arguments.
{
  const r = [{ quantity: 1, price: 8 }, { quantity: 6, price: 30 }];
  const snapshot = JSON.stringify(r);
  syncPriceRows(r, 1, 0);
  assert.equal(JSON.stringify(r), snapshot);
  assert.equal(syncPriceRows(null, 0, 0), null);
  assert.deepEqual(syncPriceRows([], 0, 0), []);
  assert.deepEqual(syncPriceRows(r, 99, 0), r);
}

// A single-row table is a valid table.
{
  const out = syncPriceRows([{ quantity: 6, price: 30 }], 0, 1);
  assert.equal(out[0].price, 30);
  assert.equal(out[0].cost, 6);
}

console.log('priceRowSync: ok');
