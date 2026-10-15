import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import { matchesProductSearch, searchProducts } from './productSearch.js';
import { matchesProductFilters } from './productFilter.js';
import { rankProducts } from './searchRank.js';

const carlton = { id: 1, name: 'Carlton Draught Stubbie 375ml', description: '<p>Imported beer</p>', barcodes: [{ code: '9310000000017', quantity: 1 }] };
function actualCallback(file, name) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  let node;
  function visit(n) {
    if (!n || typeof n !== 'object') return;
    if (n.type === 'VariableDeclarator' && n.id.name === name) node = n.init;
    for (const v of Object.values(n)) {
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === 'object') visit(v);
    }
  }
  visit(parse(source, { sourceType: 'module', plugins: ['jsx'] }));
  assert.ok(node, name);
  if (node.type === 'CallExpression') node = node.arguments[0];
  return source.slice(node.start, node.end);
}

test('shared search accepts short fragments, reordered words, descriptions and barcodes', () => {
  for (const query of ['c', 'carl', '375 carlton', 'imported carlton', '9310000000017', '931000']) {
    assert.equal(matchesProductSearch(carlton, query), true, query);
    assert.equal(matchesProductFilters(carlton, { search: query }), true, query);
  }
  assert.equal(matchesProductSearch(carlton, 'carlton vodka'), false);
  assert.equal(matchesProductSearch(carlton, '<p>'), false);
});
test('best match wins over alphabetical order and input is not mutated', () => {
  const products = [{ id: 3, name: 'A Jim Bottle' }, { id: 2, name: 'Jim Beam' }];
  assert.deepEqual(searchProducts(products, 'jim').map((p) => p.id), [2, 3]);
  assert.deepEqual(products.map((p) => p.id), [3, 2]);
});
test('Products page keeps other filters and applies search ranking', () => {
  const callback = actualCallback('../pages/StockManagement/Products.jsx', 'filteredProducts');
  const context = { allProducts: [{ id: 3, name: 'A Jim Bottle' }, { id: 2, name: 'Jim Beam' }],
    matchesProductFilters, rankProducts, debouncedSearchTerm: 'jim', statusFilter: [], brandFilter: [], categoryFilter: [],
    familyFilter: [], tagFilter: [], supplierFilter: [], typeFilter: [], retailTaxRateFilter: [], purchaseTaxRateFilter: [], sellOnShopFilter: ['Ignore'] };
  assert.deepEqual(Array.from(vm.runInNewContext(`(${callback})()`, context), (p) => p.id), [2, 3]);
});
test('Bulk Price Edit actual options accept barcode, multiword and single-character queries', () => {
  const callback = actualCallback('../pages/StockManagement/BulkPriceEdit.jsx', 'options');
  for (const query of ['c', '375 carlton', '9310000000017']) {
    const options = vm.runInNewContext(`(${callback})()`, { query, selection: null, products: [carlton], classifications: [], searchProducts });
    assert.equal(options[0].id, 1);
  }
});
test('Price List actual search retains API barcode and multiword matches', async () => {
  const callback = actualCallback('../pages/PriceLists/PriceListConfiguration.jsx', 'searchEntities');
  const search = vm.runInNewContext(`(${callback})`, { searchProducts,
    productService: { getProducts: async () => ({ products: [carlton] }) }, RESULT_GROUPS: [] });
  for (const query of ['375 carlton', '9310000000017']) assert.equal((await search(query))[0].id, 1);
});
test('Supplier Assignment applies the same search in both panes', () => {
  for (const name of ['filteredAssigned', 'filteredAvailable']) {
    const callback = actualCallback('../pages/StockManagement/SupplierAssignment.jsx', name);
    for (const searchTerm of ['375 carlton', '9310000000017']) {
      const rows = vm.runInNewContext(`(${callback})()`, { searchTerm, assignedProducts: [carlton], availableProducts: [carlton], unassignedOnly: false, searchProducts });
      assert.equal(rows[0].id, 1);
    }
  }
});

test('Product Combos list uses reordered words and barcode search', () => {
  const callback = actualCallback('../pages/StockManagement/ProductCombos.jsx', 'filtered');
  for (const search of ['375 carlton', '9310000000017']) {
    const rows = vm.runInNewContext(`(${callback})()`, { search, combos: [carlton], searchProducts });
    assert.equal(rows[0].id, 1);
  }
});

test('Stocktake Details filters product fields without changing original stocktake rows', () => {
  const callback = actualCallback('../pages/StockManagement/StocktakeDetails.jsx', 'getFilteredItems');
  const item = { id: 100, product: carlton, actualQuantity: 5, notes: '' };
  for (const searchTerm of ['375 carlton', '9310000000017']) {
    const rows = vm.runInNewContext(`(${callback})()`, { stocktake: { items: [item] }, searchTerm, tab: 'all', sortBy: 'product', sortOrder: 'asc', searchProducts });
    assert.equal(rows[0].id, item.id);
    assert.equal(rows[0].actual, 5);
    assert.equal(item.actualQuantity, 5);
    assert.equal(item.notes, '');
  }
});
