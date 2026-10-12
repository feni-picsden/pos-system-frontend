import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import { familyCategoryCheck } from '../../utils/familyOverride.js';

// Execute the actual page handler with controllable delayed network responses.
const source = readFileSync(new URL('../../pages/StockManagement/ProductEdit.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
let handler;
function find(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'VariableDeclarator' && node.id.name === 'requestFamilyPick') handler = node.init;
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(find);
    else if (value && typeof value === 'object') find(value);
  }
}
find(ast);
assert.ok(handler);
function harness() {
  const state = { pending: null, selected: null, dialog: null, offer: { sourceProduct: { id: 'old' } } };
  const requests = new Map();
  const pick = vm.runInNewContext(`(${source.slice(handler.start, handler.end)})`, {
    familyPickRequestRef: { current: 0 }, savedFamilyIdRef: { current: null },
    familyMembersCacheRef: { current: new Map() }, id: 'own', formData: { category: 'Beer' },
    familyCategoryCheck,
    setPendingFamily: (v) => { state.pending = v; },
    setFamilyPick: (v) => { state.dialog = v; },
    setFamilyOverrideOffer: (v) => { state.offer = v; },
    applyFamily: (v) => { state.selected = v; },
    productService: { getProducts: ({ family }) => new Promise((resolve, reject) => requests.set(family, { resolve, reject })) },
  });
  return { state, requests, pick };
}
test('first selection reports pending family until lookup completes', async () => {
  const { state, requests, pick } = harness();
  const family = { id: 1, name: 'Premix Cans' };
  const work = pick(family);
  assert.equal(state.pending, family);
  assert.equal(state.offer, null, 'previous family toast closes immediately');
  assert.equal(state.selected, null);
  requests.get(1).resolve({ products: [] });
  await work;
  assert.equal(state.pending, null);
  assert.equal(state.selected, family);
});
test('older response cannot select its family or stop latest loading', async () => {
  const { state, requests, pick } = harness();
  const first = pick({ id: 1, name: 'First' });
  const second = pick({ id: 2, name: 'Second' });
  requests.get(1).resolve({ products: [] });
  await first;
  assert.equal(state.pending.id, 2);
  assert.equal(state.selected, null);
  requests.get(2).resolve({ products: [] });
  await second;
  assert.equal(state.selected.id, 2);
  assert.equal(state.pending, null);
});
test('clearing selection invalidates an in-flight lookup', async () => {
  const { state, requests, pick } = harness();
  const work = pick({ id: 1, name: 'First' });
  await pick(null);
  assert.equal(state.offer, null, 'clearing family closes its offer');
  requests.get(1).resolve({ products: [] });
  await work;
  assert.equal(state.selected, null);
  assert.equal(state.pending, null);
});
test('category mismatch finishes loading and opens confirmation without applying', async () => {
  const { state, requests, pick } = harness();
  const work = pick({ id: 1, name: 'Soft Drinks' });
  requests.get(1).resolve({ products: [{ id: 9, category: 'Soft Drinks' }] });
  await work;
  assert.equal(state.pending, null);
  assert.equal(state.selected, null);
  assert.equal(state.dialog.family.id, 1);
});
test('network failure clears pending loading', async () => {
  const { state, requests, pick } = harness();
  const work = pick({ id: 1, name: 'First' });
  requests.get(1).reject(new Error('offline'));
  await work;
  assert.equal(state.pending, null);
});
