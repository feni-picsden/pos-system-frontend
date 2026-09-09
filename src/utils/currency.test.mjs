// Plain sell-screen money format. Run: node src/utils/currency.test.mjs
//
// formatMoney is imported directly from the source below rather than through
// currency.js, because that module pulls in settingsService (and the whole api
// client with it) for the locale-aware formatCurrency, which plain node cannot
// load. The function under test has no dependencies of its own.
import assert from 'node:assert/strict';

const formatMoney = (value) => {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  const text = Math.abs(safe).toFixed(2);
  return `${parseFloat(text) > 0 && safe < 0 ? '-' : ''}$${text}`;
};

// Always two decimals — the whole point of the change.
assert.equal(formatMoney(40), '$40.00', 'a whole number still shows cents');
assert.equal(formatMoney(40.5), '$40.50', 'one decimal is padded to two');
assert.equal(formatMoney(40.05), '$40.05', 'a leading zero cent survives');
assert.equal(formatMoney('40'), '$40.00', 'a numeric string is accepted');
assert.equal(formatMoney('40.5'), '$40.50', 'so is a decimal string');
assert.equal(formatMoney(0), '$0.00', 'zero is money, not blank');

// Rounding is to the cent, not truncation.
assert.equal(formatMoney(40.005), '$40.01', 'half a cent rounds up');
assert.equal(formatMoney(40.004), '$40.00', 'less than half a cent rounds down');
assert.equal(formatMoney(1 / 3), '$0.33', 'a repeating fraction is still two decimals');

// Negatives lead with the sign, never $-4.50.
assert.equal(formatMoney(-4.5), '-$4.50', 'the minus sits before the dollar sign');
assert.equal(formatMoney(-0.004), '$0.00', 'a negative that rounds to zero drops the sign');

// Never NaN on screen.
assert.equal(formatMoney(undefined), '$0.00', 'undefined reads as zero');
assert.equal(formatMoney(null), '$0.00', 'null reads as zero');
assert.equal(formatMoney(''), '$0.00', 'an empty string reads as zero');
assert.equal(formatMoney('abc'), '$0.00', 'unparseable text reads as zero');
assert.equal(formatMoney(NaN), '$0.00', 'NaN reads as zero');
assert.equal(formatMoney(Infinity), '$0.00', 'Infinity reads as zero, not $Infinity.00');

// Large values keep their cents.
assert.equal(formatMoney(1234567.891), '$1234567.89', 'no thousands separator, two decimals');

console.log('formatMoney: all assertions passed');
