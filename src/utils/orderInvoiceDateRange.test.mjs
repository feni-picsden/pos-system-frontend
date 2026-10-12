import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inOrderInvoiceDateRange } from './orderInvoiceDateRange.js';
import { formatDateInZone } from './dateFormat.js';

const zone = 'Australia/Sydney';
const matches = (range, value) => inOrderInvoiceDateRange(range, value, zone);

test('start-only range applies the lower inclusive bound', () => {
  const range = { startDate: '2026-09-25', endDate: null };
  assert.equal(matches(range, '2026-09-24T04:00:00Z'), false);
  assert.equal(matches(range, '2026-09-25T04:00:00Z'), true);
  assert.equal(matches(range, '2026-09-26T04:00:00Z'), true);
});
test('end-only range applies the upper inclusive bound', () => {
  const range = { startDate: null, endDate: '2026-09-25' };
  assert.equal(matches(range, '2026-09-24T04:00:00Z'), true);
  assert.equal(matches(range, '2026-09-25T04:00:00Z'), true);
  assert.equal(matches(range, '2026-09-26T04:00:00Z'), false);
});
test('same-day filter uses the date displayed by the app, across UTC midnight', () => {
  const value = '2026-09-24T14:00:00Z';
  assert.equal(formatDateInZone(value, zone), '25/09/2026');
  assert.equal(matches({ startDate: new Date(2026, 8, 25), endDate: new Date(2026, 8, 25) }, value), true);
  assert.equal(matches({ startDate: '2026-09-24', endDate: '2026-09-24' }, value), false);
});
test('range boundaries include the whole app calendar day', () => {
  const range = { startDate: '2026-09-25', endDate: '2026-09-25' };
  assert.equal(matches(range, '2026-09-24T13:59:59Z'), false);
  assert.equal(matches(range, '2026-09-24T14:00:00Z'), true);
  assert.equal(matches(range, '2026-09-25T13:59:59Z'), true);
  assert.equal(matches(range, '2026-09-25T14:00:00Z'), false);
});
test('daylight saving boundaries use the configured zone', () => {
  const range = { startDate: '2026-10-05', endDate: '2026-10-05' };
  assert.equal(matches(range, '2026-10-04T12:59:59Z'), false);
  assert.equal(matches(range, '2026-10-04T13:00:00Z'), true);
});
test('different configured zones filter the date each one displays', () => {
  const value = '2026-09-24T14:00:00Z';
  assert.equal(inOrderInvoiceDateRange({ startDate: '2026-09-24', endDate: '2026-09-24' }, value, 'Asia/Calcutta'), true);
  assert.equal(inOrderInvoiceDateRange({ startDate: '2026-09-25', endDate: '2026-09-25' }, value, 'Asia/Calcutta'), false);
});
test('cleared range allows all dates; invalid records cannot match an active range', () => {
  assert.equal(matches(null, null), true);
  assert.equal(matches({ startDate: null, endDate: null }, 'invalid'), true);
  assert.equal(matches({ startDate: '2026-09-25' }, null), false);
  assert.equal(matches({ startDate: '2026-09-25' }, 'invalid'), false);
  assert.equal(matches({ startDate: 'invalid' }, '2026-09-25'), false);
});
