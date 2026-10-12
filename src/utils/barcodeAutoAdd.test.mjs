import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from '@babel/parser';

const source = readFileSync(new URL('../pages/SaleKeyPage.jsx', import.meta.url), 'utf8');
let effect;
let scanHandler;
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'VariableDeclarator' && node.id.name === 'handleBarcodeScan') scanHandler = node.init;
  if (node.type === 'CallExpression' && node.callee.name === 'useEffect') {
    const callback = node.arguments[0];
    if (source.slice(callback.start, callback.end).includes('const scannable =')) effect = callback;
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') visit(value);
  }
}
visit(parse(source, { sourceType: 'module', plugins: ['jsx'] }));
assert.ok(effect);
function harness(term, { known = false, found = false, customer = false, associating = false, completed = false } = {}) {
  const queued = [];
  const searched = [];
  let callback;
  const context = vm.createContext({
    searchTerm: term, isCustomerSearchMode: customer, isTransactionComplete: completed,
    associatingBarcode: associating ? 'pending' : null,
    sanitizeScanInput: (s) => s.trim(), looksLikeBarcode: (s) => /^\d{4,}$/.test(s),
    isKnownBarcode: () => known,
    queueScan: (code, options) => queued.push({ code, options }),
    performSearch: async (s) => { searched.push(s); return found; },
    setTimeout: (fn) => { callback = fn; return 1; }, clearTimeout: () => {},
  });
  const cleanup = vm.runInContext(`(${source.slice(effect.start, effect.end)})()`, context);
  return { queued, searched, cleanup, run: () => callback() };
}

test('exact known barcode auto-adds without Enter, including pasted input', async () => {
  const h = harness('9310000000017', { known: true });
  await h.run();
  assert.equal(h.queued.length, 1);
  assert.equal(h.queued[0].code, '9310000000017');
  assert.equal(h.queued[0].options.productOnly, true);
  assert.equal(h.searched.length, 0);
});

test('known alphanumeric barcode also auto-adds', async () => {
  const h = harness('ABC123', { known: true });
  await h.run();
  assert.equal(h.queued[0].code, 'ABC123');
});

test('ordinary name and partial barcode matches stay in search results', async () => {
  for (const term of ['Carlton', '9310']) {
    const h = harness(term, { found: true });
    await h.run();
    assert.equal(h.queued.length, 0);
    assert.equal(h.searched[0], term);
  }
});

test('unknown code keeps search results and does not trigger automatic not-found popup', async () => {
  const h = harness('9999999999999');
  await h.run();
  assert.equal(h.searched.length, 1);
  assert.equal(h.queued[0].options.clearBox, false);
  assert.equal(h.queued[0].options.notifyMissing, false);
  assert.equal(h.queued[0].options.productOnly, true);
});

test('customer, completed-sale and barcode association searches cannot auto-add', async () => {
  for (const options of [{ customer: true }, { completed: true }, { associating: true }]) {
    const h = harness('9310000000017', { known: true, ...options });
    await h.run();
    assert.equal(h.queued.length, 0);
  }
});

test('changing input cancels a stale search before it queues a speculative scan', async () => {
  const h = harness('9999999999999');
  const work = h.run();
  h.cleanup();
  await work;
  assert.equal(h.queued.length, 0);
});

test('unknown long barcode auto lookup never recalls a sale, while explicit Enter preserves recall', async () => {
  let recalls = 0;
  const context = vm.createContext({
    sanitizeScanInput: (s) => s.trim(), isCustomerSearchMode: false, isTransactionComplete: false,
    posLocalDb: { getProductsByBarcode: () => [], getProductsByBarcodeAsync: async () => [] },
    localBarcodeIndex: {}, searchResults: { products: [] }, productMatchesBarcode: () => false,
    getEffectiveOutletId: () => 1, productService: { getProductByBarcode: async () => ({}) },
    recallSaleAsReturn: async () => { recalls++; return true; }, console,
  });
  const scan = vm.runInContext(`(${source.slice(scanHandler.start, scanHandler.end)})`, context);
  assert.equal(await scan('99999999999999', { productOnly: true }), false);
  assert.equal(recalls, 0);
  assert.equal(await scan('99999999999999'), true);
  assert.equal(recalls, 1);
});
