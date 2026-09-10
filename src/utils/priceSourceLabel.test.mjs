// Run: node src/utils/priceSourceLabel.test.mjs
import assert from 'node:assert/strict';
import { priceSourceLabel, isDefaultPriceRow } from './priceSourceLabel.js';

const sets = [{ id: 1, name: 'Wholesale' }, { id: 2, name: 'Staff' }];

// The base row keeps its own name. It must NOT borrow the name of the register's
// Default Price Set — that put "Wholesale" twice in one dropdown.
assert.equal(priceSourceLabel({ priceSetId: null }, sets), 'Default Price');
assert.equal(priceSourceLabel({}, []), 'Default Price');
assert.notEqual(
  priceSourceLabel({ priceSetId: null }, sets),
  priceSourceLabel({ priceSetId: 1 }, sets),
  'base row and a named set never share a label'
);
assert.equal(priceSourceLabel({ priceSetId: null, outletId: 4 }, []), 'Outlet Price');

// A row that carries a set is named after THAT set.
assert.equal(priceSourceLabel({ priceSetId: 2 }, sets), 'Staff');
assert.equal(priceSourceLabel({ priceSetId: '2' }, sets), 'Staff', 'string id from a select');

// Every option in one dropdown is distinct.
{
  const labels = [priceSourceLabel({ priceSetId: null }, sets), ...sets.map((s) => s.name)];
  assert.equal(new Set(labels).size, labels.length, 'no duplicate options');
}

// The view page has no set list: the API embeds the name.
assert.equal(priceSourceLabel({ priceSetId: 7, priceSet: { name: 'Trade' } }, []), 'Trade');
assert.equal(priceSourceLabel({ priceSetId: 7, priceSetName: 'Trade' }, []), 'Trade');

// A deleted set still identifies itself rather than showing a blank cell.
assert.equal(priceSourceLabel({ priceSetId: 7 }, sets), 'Price Set #7');

// Never blank, whatever it is handed.
for (const row of [null, undefined, {}, { priceSetId: undefined }]) {
  assert.ok(priceSourceLabel(row, null).length > 0, String(row));
}

// Default-row test used by the UI to decide plain text vs. a set selector.
assert.equal(isDefaultPriceRow({ priceSetId: null }), true);
assert.equal(isDefaultPriceRow({}), true);
assert.equal(isDefaultPriceRow(null), true);
assert.equal(isDefaultPriceRow({ priceSetId: 2 }), false);
assert.equal(isDefaultPriceRow({ priceSetId: 0 }), false, 'id 0 is still a set');

console.log('priceSourceLabel: ok');
