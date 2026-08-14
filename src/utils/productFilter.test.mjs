// ponytail: one self-check for the predicate that replaced the server-side
// product query. Run: node src/utils/productFilter.test.mjs
import assert from 'node:assert/strict';
import { matchesProductFilters } from './productFilter.js';
import { stripHtml } from '../services/posLocalDb.js';

const product = {
  id: 1,
  name: 'Corona Mexican Beer 355ml',
  description: 'imported lager',
  status: 'Active',
  type: 'Normal',
  retailTaxRate: 'GST',
  purchaseTaxRate: 'Inherit',
  sellOnShopMyLocal: true,
  brand: { id: 7 },
  category: { id: 3 },
  family: { id: 11 },
  tags: [{ tag: { id: 21 } }],
  suppliers: [{ supplier: { id: 31 } }],
  barcodes: [{ code: '9310797256216' }, '21458575856582'],
};

// No filters at all = everything passes.
assert.equal(matchesProductFilters(product, {}), true);

// Search matches name and description, case-insensitively.
assert.equal(matchesProductFilters(product, { search: 'corona' }), true);
assert.equal(matchesProductFilters(product, { search: 'LAGER' }), true);
assert.equal(matchesProductFilters(product, { search: 'whisky' }), false);

// Search also matches a barcode, but only the FULL code — a prefix must not hit.
assert.equal(matchesProductFilters(product, { search: '9310797256216' }), true);
assert.equal(matchesProductFilters(product, { search: ' 21458575856582 ' }), true);
assert.equal(matchesProductFilters(product, { search: '93107972' }), false);
assert.equal(matchesProductFilters(product, { search: '9310797256216x' }), false);
// Both barcode shapes and the JSON-string form the API sometimes returns.
assert.equal(
  matchesProductFilters({ name: 'x', barcodes: '[{"code":"12458784578"}]' }, { search: '12458784578' }),
  true
);
assert.equal(matchesProductFilters({ name: 'x' }, { search: '12458784578' }), false);

// Status defaults to Active when the row does not carry one.
assert.equal(matchesProductFilters(product, { status: ['Active'] }), true);
assert.equal(matchesProductFilters(product, { status: ['Inactive'] }), false);
assert.equal(matchesProductFilters({ name: 'x' }, { status: ['Active'] }), true);

// Ids compare across string/number and across nested vs flat shapes.
assert.equal(matchesProductFilters(product, { brand: ['7'] }), true);
assert.equal(matchesProductFilters(product, { brand: [7] }), true);
assert.equal(matchesProductFilters({ ...product, brand: undefined, brandId: 7 }, { brand: ['7'] }), true);
assert.equal(matchesProductFilters(product, { brand: ['8'] }), false);

// Multi-select is an OR within a dimension — the API only honoured the first id.
assert.equal(matchesProductFilters(product, { category: ['99', '3'] }), true);
assert.equal(matchesProductFilters(product, { family: ['11'] }), true);
assert.equal(matchesProductFilters(product, { tags: ['21'] }), true);
assert.equal(matchesProductFilters(product, { tags: ['22'] }), false);
assert.equal(matchesProductFilters(product, { supplier: ['31'] }), true);
assert.equal(matchesProductFilters(product, { supplier: ['32'] }), false);

// Dimensions AND together.
assert.equal(matchesProductFilters(product, { brand: ['7'], tags: ['22'] }), false);

// sellOnShop is a tri-state: Ignore means "do not filter".
assert.equal(matchesProductFilters(product, { sellOnShop: ['Ignore'] }), true);
assert.equal(matchesProductFilters(product, { sellOnShop: ['enabled'] }), true);
assert.equal(matchesProductFilters(product, { sellOnShop: ['disabled'] }), false);
assert.equal(
  matchesProductFilters({ ...product, sellOnShopMyLocal: false }, { sellOnShop: ['disabled'] }),
  true
);
// A stray leftover 'Ignore' must not silently disable the filter (it used to).
assert.equal(matchesProductFilters(product, { sellOnShop: ['Ignore', 'disabled'] }), false);

// Tax rates match on name, not id.
assert.equal(matchesProductFilters(product, { retailTaxRate: ['GST'] }), true);
assert.equal(matchesProductFilters(product, { retailTaxRate: ['No Tax'] }), false);
assert.equal(matchesProductFilters(product, { purchaseTaxRate: ['Inherit'] }), true);
// Type compares the STORED string verbatim — the page now builds its options from
// the distinct product.type values instead of reference labels ("Normal"), which
// could never match a stored "Normal Product".
assert.equal(matchesProductFilters(product, { type: ['Normal'] }), true);
assert.equal(matchesProductFilters(product, { type: ['Basket'] }), false);
assert.equal(
  matchesProductFilters({ ...product, type: 'Normal Product' }, { type: ['Normal Product'] }),
  true
);
assert.equal(
  matchesProductFilters({ ...product, type: 'Normal Product' }, { type: ['Normal'] }),
  false
);

// Rich-text descriptions: search matches the TEXT, never the markup, and a
// markup-only description collapses to '' so callers can fall back to the type.
assert.equal(stripHtml('<ul><li><b><i>ZZ desc line1</i></b></li></ul>'), 'ZZ desc line1');
assert.equal(stripHtml('<p><br></p>'), '');
assert.equal(stripHtml('Tom &amp; Jerry&nbsp;5&quot;'), 'Tom & Jerry 5"');
assert.equal(stripHtml(null), '');
const richProduct = { name: 'ZZ Widget', description: '<ul><li>hand made</li></ul>' };
assert.equal(matchesProductFilters(richProduct, { search: 'hand made' }), true);
assert.equal(matchesProductFilters(richProduct, { search: 'li' }), false);

console.log('productFilter ok');
