// node src/utils/referenceReceiptData.test.mjs
import assert from 'node:assert/strict';
import { buildReferenceData } from './referenceReceiptData.js';

const data = buildReferenceData({
  transactionId: '00034066',
  items: [
    { name: 'ICE 5KG', quantity: 1, price: 4, taxPercent: 10, retailTaxRate: 'GST', caseQty: 1 },
    { name: 'NO TAX ITEM', quantity: 2, price: 10, retailTaxRate: 'No Tax' },
  ],
  payments: [{ method: 'Cash', description: 'Tendered Cash', amount: 4 }],
  total: 14,
  change: 0,
});

// money is pre-formatted in products/tax/payments
assert.equal(data.products[0].price, '$4.00');
assert.equal(data.products[0].qty, 1);
assert.equal(data.payments[0].payment, 'Tendered Cash');
assert.equal(data.payments[0].amount, '$4.00');

// GST from the inclusive line price: 4 * 10 / 110
assert.equal(data.tax.length, 1);
assert.equal(data.tax[0].tax, 'GST');
assert.equal(data.tax[0].total, '$0.36');

// only taxed lines carry an indicator
assert.equal(data.indicators.GST, true);
assert.equal(data.products[1].tax, '');

// totals stay raw numbers
assert.equal(data.total.sale, 14);
assert.equal(data.total.change, 0);

// no loyalty/account data -> every column false, so the blocks stay hidden
assert.equal(data.loyalty.earned, false);
assert.equal(data.account['start-balance'], false);

// expression context comes along
assert.equal(data.text.invoiceNo, '00034066');

// a rate that contributes no tax prints no row and flags no line
const zeroTax = buildReferenceData({
  items: [{ name: 'ZERO RATED', quantity: 1, price: 10, taxPercent: 0, retailTaxRate: 'VAT' }],
  payments: [{ method: 'Cash', amount: 10 }],
  total: 10,
});
assert.equal(zeroTax.tax.length, 0);
assert.equal(zeroTax.indicators.VAT, undefined);
assert.equal(zeroTax.products[0].tax, '');

// tender lines are labelled "Tendered <method>" like the reference
assert.equal(zeroTax.payments[0].payment, 'Tendered Cash');
const change = buildReferenceData({ payments: [{ method: 'Change', amount: -2 }] });
assert.equal(change.payments[0].payment, 'Change');

// Banked tax survives a missing or "No Tax" rate name (product re-rated after the
// sale, or a combo line that carries no rate name at all).
const renamed = buildReferenceData({
  items: [{ name: 'WAS TAXED', quantity: 1, price: 33, taxName: 'No Tax', taxAmount: 3 }],
  total: 33,
});
assert.equal(renamed.tax.length, 1);
assert.equal(renamed.tax[0].total, '$3.00');
assert.equal(renamed.products[0].tax, 'No Tax');

const combo = buildReferenceData({
  items: [{ name: 'COMBO', quantity: 1, price: 22, taxAmount: 2 }],
  total: 22,
});
assert.equal(combo.tax[0].tax, 'Tax');
assert.equal(combo.tax[0].total, '$2.00');

// A "No Tax" line that banked nothing still prints no row and no indicator.
const untaxed = buildReferenceData({ items: [{ name: 'FREE', quantity: 1, price: 5, taxName: 'No Tax', taxAmount: 0 }] });
assert.equal(untaxed.tax.length, 0);
assert.equal(untaxed.products[0].tax, '');

console.log('referenceReceiptData: all assertions passed');
