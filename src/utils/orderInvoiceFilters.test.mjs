import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import { inOrderInvoiceDateRange } from './orderInvoiceDateRange.js';

const source = readFileSync(new URL('../pages/StockManagement/OrdersInvoices.jsx', import.meta.url), 'utf8');
const nodes = new Map();
let filterEffect;
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') nodes.set(node.id.name, node.init);
  if (node.type === 'CallExpression' && node.callee.name === 'useEffect') {
    const callback = node.arguments[0];
    if (source.slice(callback.start, callback.end).includes('const matchesStatus')) filterEffect = callback;
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') visit(value);
  }
}
visit(parse(source, { sourceType: 'module', plugins: ['jsx'] }));
const context = vm.createContext({ Date, inOrderInvoiceDateRange, appTimeZone: () => 'Australia/Sydney' });
for (const name of ['TYPE_OPTIONS', 'STATUS_MAP', 'TYPE_MAP', 'EMPTY_FILTERS', 'includesText', 'normaliseDocumentNumber', 'matchesDocumentNumber', 'inDateRange']) {
  const node = nodes.get(name);
  assert.ok(node, name);
  context[name] = vm.runInContext(`(${source.slice(node.start, node.end)})`, context);
}
const transfer = { id: 362, type: 'TRANSFER', status: 'OPEN', orderNumber: 'TRF0005', orderDate: '2026-09-24T04:00:00Z', outlet: { name: 'Main Outlet' }, toOutlet: { name: 'Second outlet' } };
const invoice = { id: 999, type: 'INVOICE', status: 'RECEIVED', orderNumber: 'AVG-ZERO-TEST-01', orderDate: '2026-10-12T04:00:00Z', dueDate: '2026-10-15T04:00:00Z', outlet: { name: 'Main Outlet' } };
let result;
context.ordersInvoices = [transfer, invoice];
context.setFilteredOrdersInvoices = (rows) => { result = rows; };
const filter = vm.runInContext(`(${source.slice(filterEffect.start, filterEffect.end)})`, context);
function filtered(fields) {
  context.appliedFilters = { ...context.EMPTY_FILTERS, ...fields };
  filter();
  return Array.from(result, (row) => row.id);
}

test('Open TRF0005 matches visible number, including pasted whitespace and formatting', () => {
  for (const invoiceNumber of ['TRF0005', 'trf0005', ' TRF0005 ', '\r\nTRF0005\t', '\u200BTRF0005\uFEFF', 'TRF 0005']) {
    assert.deepEqual(filtered({ status: 'Open', invoiceNumber }), [362]);
  }
});
test('partial document numbers work and nonexistent numbers return no rows', () => {
  assert.deepEqual(filtered({ status: 'Open', invoiceNumber: '0005' }), [362]);
  assert.deepEqual(filtered({ status: 'Open', invoiceNumber: 'TRF9999' }), []);
});
test('Invoice type is selectable and excludes transfers', () => {
  assert.ok(context.TYPE_OPTIONS.includes('Invoice'));
  assert.equal(context.TYPE_MAP.Invoice, 'INVOICE');
  assert.deepEqual(filtered({ status: 'All', type: 'Invoice' }), [999]);
});
test('explicit status and outlet filters continue to apply', () => {
  assert.deepEqual(filtered({ status: 'Received', invoiceNumber: 'TRF0005' }), []);
  assert.deepEqual(filtered({ status: 'Open', invoiceNumber: 'TRF0005', outlet: 'Second outlet' }), [362]);
  assert.deepEqual(filtered({ status: 'Open', invoiceNumber: 'TRF0005', outlet: 'Unknown' }), []);
});
test('whitespace-only document query behaves as an empty filter', () => {
  assert.deepEqual(filtered({ status: 'All', invoiceNumber: ' \t ' }), [362, 999]);
});

test('start-only order date excludes an earlier transfer, including with number/status filters', () => {
  assert.deepEqual(filtered({ status: 'All', orderDate: { startDate: '2026-09-25', endDate: null } }), [999]);
  assert.deepEqual(filtered({ status: 'Open', invoiceNumber: 'TRF0005', orderDate: { startDate: '2026-09-25', endDate: null } }), []);
});

test('order date and open-ended due date combine with invoice type and status', () => {
  assert.deepEqual(filtered({ status: 'Received', type: 'Invoice',
    orderDate: { startDate: '2026-10-12', endDate: '2026-10-12' },
    dueDate: { startDate: '2026-10-15', endDate: null },
  }), [999]);
  assert.deepEqual(filtered({ status: 'Received', type: 'Invoice',
    dueDate: { startDate: '2026-10-16', endDate: null },
  }), []);
});
