import assert from 'node:assert/strict';
import {
  formatDateInZone,
  formatDateTimeInZone,
  formatDateValueInZone,
  toZonedDate,
} from './dateFormat.js';

// 2026-09-15T08:51:13Z (PO-101 receivedAt) is 18:51:13 AEST on 15 Sep 2026
// (Sydney is UTC+10 before DST starts on 4 Oct 2026).
const utc = '2026-09-15T08:51:13.000Z';

assert.equal(formatDateTimeInZone(utc, 'Australia/Sydney'), '15/09/2026 18:51:13');
assert.equal(formatDateInZone(utc, 'Australia/Sydney'), '15/09/2026');
assert.equal(formatDateTimeInZone(utc, 'UTC'), '15/09/2026 08:51:13');
assert.equal(formatDateTimeInZone(utc, 'Asia/Kolkata'), '15/09/2026 14:21:13');

// After DST (AEDT, UTC+11): 2026-10-06T13:30:00Z -> 00:30:00 on 7 Oct.
assert.equal(formatDateTimeInZone('2026-10-06T13:30:00Z', 'Australia/Sydney'), '07/10/2026 00:30:00');
assert.equal(formatDateInZone('2026-10-06T13:30:00Z', 'Australia/Sydney'), '07/10/2026');

// Setup > General tokens follow the zone too.
assert.equal(formatDateValueInZone(utc, 'DD/MM/YYYY', 'Australia/Sydney'), '15/09/2026');
assert.equal(formatDateValueInZone(utc, 'h:mm:ssa', 'Australia/Sydney'), '6:51:13pm');

// The zoned Date carries the zone's wall clock in its local fields.
const zoned = toZonedDate(utc, 'Australia/Sydney');
assert.equal(zoned.getHours(), 18);
assert.equal(zoned.getDate(), 15);

// Garbage never throws and never prints "Invalid Date".
assert.equal(formatDateTimeInZone('not a date', 'Australia/Sydney'), '');
assert.equal(formatDateTimeInZone(null, 'Australia/Sydney'), '');
assert.equal(toZonedDate(undefined, 'Australia/Sydney'), null);
// Unknown zone falls back to the browser zone instead of throwing.
assert.equal(typeof formatDateTimeInZone(utc, 'Not/AZone'), 'string');
assert.equal(formatDateTimeInZone(utc, 'Not/AZone').length, 19);

console.log('dateZone ok');
