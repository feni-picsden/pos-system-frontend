// ponytail: one self-check for the falsy-but-meaningful cases the old `value || "-"` broke.
// Run: node src/utils/revisionValue.test.mjs
import assert from 'node:assert/strict';
import { formatRevisionValue } from './revisionValue.js';

// The original defect: requireOrderReference false rendered as "-", true as a raw boolean.
assert.equal(formatRevisionValue(false), 'No');
assert.equal(formatRevisionValue(true), 'Yes');

// currentOwing dropping to 0 must read 0, not "-".
assert.equal(formatRevisionValue(0), '0');

// Genuinely empty stays a dash.
assert.equal(formatRevisionValue(null), '-');
assert.equal(formatRevisionValue(undefined), '-');
assert.equal(formatRevisionValue(''), '-');

// Objects/arrays are never valid React children.
assert.equal(formatRevisionValue({ a: 1 }), '{"a":1}');
assert.equal(formatRevisionValue(['x']), '["x"]');

assert.equal(formatRevisionValue('Acme'), 'Acme');

console.log('revisionValue: ok');
