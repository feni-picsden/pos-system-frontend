// Run: node src/utils/priceRowSync.test.mjs
import assert from 'node:assert/strict';
import { syncPriceRows } from './priceRowSync.js';

// Reference behaviour: pricing a pack never touches the single.
// (Checked on the reference product page: 12 for $20 left the single at $5.)
{
  const r = [{ quantity: 1, price: 5 }, { quantity: 12, price: 20 }];
  const out = syncPriceRows(r, 1, 0);
  assert.equal(out[0].price, 5, 'single untouched');
  assert.equal(out[1].price, 20, 'the edited row keeps exactly what was typed');
}

// ...and pricing the single never touches the pack (single -> $3, pack stays $20).
{
  const r = [{ quantity: 1, price: 3 }, { quantity: 12, price: 20 }];
  assert.equal(syncPriceRows(r, 0, 0)[1].price, 20);
}

// No row other than the edited one changes at all.
{
  const r = [
    { quantity: 1, price: 0 },
    { quantity: 6, price: 30 },
    { quantity: 12, price: 50 },
    { quantity: 1, price: 9, priceSetId: 2 },
  ];
  const out = syncPriceRows(r, 1, 2);
  assert.deepEqual(out[0], r[0]);
  assert.deepEqual(out[2], r[2]);
  assert.deepEqual(out[3], r[3]);
}

// Cost and GP% are refreshed on the edited row only.
{
  const r = [{ quantity: 1, price: 8 }, { quantity: 6, price: 30 }];
  const out = syncPriceRows(r, 1, 2); // itemCost $2
  assert.equal(out[1].cost, 12);
  assert.equal(out[1].percentage, 60); // 1 - 12/30
  assert.equal(out[0].cost, undefined, 'other row not re-costed here');
  const single = syncPriceRows(r, 0, 2);
  assert.equal(single[0].cost, 2);
  assert.equal(single[0].percentage, 75); // 1 - 2/8
}

// Mid-typing states are a no-op.
for (const bad of ['', null, undefined, 0, NaN, 'abc']) {
  const r = [{ quantity: 1, price: 7 }, { quantity: 6, price: bad }];
  assert.equal(syncPriceRows(r, 1, 0), r, `price ${String(bad)}`);
}
for (const bad of ['', null, undefined, 0, NaN, 'abc', -3]) {
  const r = [{ quantity: 1, price: 7 }, { quantity: bad, price: 30 }];
  assert.equal(syncPriceRows(r, 1, 0), r, `quantity ${String(bad)}`);
}

// String inputs from the number fields behave like numbers.
{
  const r = [{ quantity: '1', price: '0' }, { quantity: '6', price: '30' }];
  const out = syncPriceRows(r, 1, 1);
  assert.equal(out[1].cost, 6);
  assert.equal(out[1].percentage, 80);
  assert.equal(out[0].price, '0');
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
