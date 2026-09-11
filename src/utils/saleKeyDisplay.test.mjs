import assert from 'node:assert/strict';
import { getSaleKeyLiveText, isDisplayOnlyKey, subtractIsoPeriod } from './saleKeyDisplay.js';

// 11 Sep 2026, 20:25:05 local time
const now = new Date(2026, 8, 11, 20, 25, 5);

// Legal age: the reference prints "7th Aug 2007"-style dates on the key.
assert.equal(getSaleKeyLiveText({ action: 'view-previous-date', durationAgo: 'P18Y' }, now), '11th Sep 2008');
assert.equal(
  getSaleKeyLiveText({ action: 'view-previous-date', durationAgo: 'P18Y', dateFormat: 'DD/MM/YYYY' }, now),
  '11/09/2008',
);
assert.equal(getSaleKeyLiveText({ action: 'view-current-time' }, now), '20:25:05');
assert.equal(getSaleKeyLiveText({ action: 'view-current-time', dateFormat: 'h:mm a' }, now), '8:25 pm');

// 29 Feb clamps to 28 Feb instead of rolling into March.
const leap = subtractIsoPeriod(new Date(2028, 1, 29), 'P18Y');
assert.deepEqual([leap.getFullYear(), leap.getMonth(), leap.getDate()], [2010, 1, 28]);
// 31 Mar minus a month is 29 Feb in a leap year.
const endOfMonth = subtractIsoPeriod(new Date(2028, 2, 31), 'P1M');
assert.deepEqual([endOfMonth.getMonth(), endOfMonth.getDate()], [1, 29]);
// Weeks, days and time parts.
assert.equal(subtractIsoPeriod(now, 'P1W2D').getDate(), 2);
assert.equal(subtractIsoPeriod(now, 'PT30M').getMinutes(), 55);
// Garbage leaves the date alone.
assert.equal(subtractIsoPeriod(now, 'eighteen').getTime(), now.getTime());

// Text keys show their text; action keys show nothing extra.
assert.equal(getSaleKeyLiveText({ action: 'info', infoText: 'ID required' }, now), 'ID required');
assert.equal(getSaleKeyLiveText({ action: 'add-product' }, now), null);

assert.equal(isDisplayOnlyKey({ action: 'view-previous-date' }), true);
assert.equal(isDisplayOnlyKey({ action: 'info' }), true);
assert.equal(isDisplayOnlyKey({ action: 'special', specialText: 'Ask for ID' }), true);
assert.equal(isDisplayOnlyKey({ action: 'special' }), false);
assert.equal(isDisplayOnlyKey({ action: 'payment' }), false);

console.log('saleKeyDisplay ok');
