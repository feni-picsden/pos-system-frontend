import assert from 'node:assert/strict';
import { formatWithTokens, toDateFnsPattern } from './dateFormat.js';

// 11 Aug 2026, 20:25:05 local time
const d = new Date(2026, 7, 11, 20, 25, 5);

// The four reference time formats and the three date formats.
assert.equal(formatWithTokens(d, 'DD/MM/YYYY'), '11/08/2026');
assert.equal(formatWithTokens(d, 'DD-MM-YYYY'), '11-08-2026');
assert.equal(formatWithTokens(d, 'YYYY-MM-DD'), '2026-08-11');
assert.equal(formatWithTokens(d, 'HH:mm:ss'), '20:25:05');
assert.equal(formatWithTokens(d, 'h:mm:ssa'), '8:25:05pm');
assert.equal(formatWithTokens(d, 'H:mm:ss'), '20:25:05');
assert.equal(formatWithTokens(d, 'hh:mm:ss a'), '08:25:05 pm');

// D (day of month) must not become date-fns' day-of-year.
assert.equal(toDateFnsPattern('D/M/YYYY'), 'd/M/yyyy');
assert.equal(formatWithTokens(d, 'D/M/YYYY'), '11/8/2026');

// Custom Format garbage falls back to the pattern instead of throwing.
assert.equal(formatWithTokens(d, 'not a pattern'), 'not a pattern');
assert.equal(formatWithTokens(d, ''), '');

console.log('dateFormat ok');
