// ponytail: one self-check — two same-name, same-price products must not share a label.
// Run: node src/utils/productOptionLabel.test.mjs
import assert from 'node:assert/strict';
import { productOptionLabel, productOptionDetail } from './productOptionLabel.js';

const a = { id: 64, name: 'ZZTEST-products', retailPrice: 5.5 };
const b = { id: 66, name: 'ZZTEST-products', retailPrice: 5.5 };
assert.notEqual(productOptionLabel(a), productOptionLabel(b));
assert.equal(productOptionLabel(a), 'ZZTEST-products - $5.50 · #64');

// A barcode is preferred over the id, and both list shapes are accepted.
assert.equal(productOptionDetail({ ...a, barcodes: [{ code: '9312345' }] }), '$5.50 · 9312345');
assert.equal(productOptionDetail({ ...a, barcodes: ['9312345'] }), '$5.50 · 9312345');

// Combos price off calculatedTotalPrice/totalPrice; prices[] is the API fallback.
assert.equal(productOptionLabel({ id: 3, name: 'Combo', totalPrice: 12 }), 'Combo - $12.00 · #3');
assert.equal(productOptionDetail({ id: 4, prices: [{ price: '7.25' }] }), '$7.25 · #4');

assert.equal(productOptionLabel(null), '');

console.log('productOptionLabel: ok');
