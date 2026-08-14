// ponytail: one self-check for the only non-trivial logic here — the sell-side total.
// Run: node src/utils/saleTotals.test.mjs
import assert from 'node:assert/strict';
import { saleBasePrice, saleLineTotal, lineSavings, itemsPerCase, groupSaleItemsForReceipt } from './saleTotals.js';

// The original defect: sale 376 stored basePrice 6 (cost 2.00 x 3) against a
// $16.50 sale. The sell-side base price is the sum of the line totals.
assert.equal(
  saleBasePrice({ items: [{ totalPrice: 11 }, { totalPrice: 5.5 }] }),
  16.5
);

// Decimal columns arrive as strings over JSON.
assert.equal(saleBasePrice({ items: [{ totalPrice: '5.50' }] }), 5.5);

// No line total: fall back to unit price x quantity.
assert.equal(
  saleBasePrice({ items: [{ unitPrice: 2.75, quantity: 2 }] }),
  5.5
);

// Missing / unloaded items are $0.00, never NaN.
assert.equal(saleBasePrice(undefined), 0);
assert.equal(saleBasePrice({ items: [{ totalPrice: 'abc' }] }), 0);

// Sale 413: totalPrice is persisted POST-discount, so Base Price must add the
// line discount back — Base Price ($5.50) - Discount ($0.55) = line total.
const discounted = { items: [{ totalPrice: '4.95', discount: '0.55' }] };
assert.equal(saleBasePrice(discounted), 5.5);
// ...while the sale TOTAL (CustomerView / CustomerGroupView) stays net.
assert.equal(saleLineTotal(discounted), 4.95);

// A junk / negative discount never inflates the base price.
assert.equal(saleBasePrice({ items: [{ totalPrice: 5, discount: 'x' }] }), 5);
assert.equal(saleBasePrice({ items: [{ totalPrice: 5, discount: -2 }] }), 5);

// Savings: a $12.00 line sold at the $10.00 promotion price saves $2.00.
assert.equal(lineSavings({ price: 10, normalPrice: 12 }), 2);
// No promotion / no markers = no savings (and never negative on a price rise).
assert.equal(lineSavings({ price: 10 }), 0);
assert.equal(lineSavings({ price: 12, normalPrice: 10 }), 0);
// Combo lines keep working off comboDeal.
assert.equal(lineSavings({ price: 18, comboDeal: { basePrice: 20 } }), 2);
// A MANUAL price change is a discount, never a saving — it shows in Discount only.
assert.equal(lineSavings({ price: 9 }, 1), 0);
// Promotion + manual on one line: only the promotion part is a saving
// ($12 normal, $10 after promotion, operator took $2 more off by hand).
assert.equal(lineSavings({ price: 8, normalPrice: 12, comboDeal: { basePrice: 10 } }, 2), 2);
// Product-combo line: no normalPrice, only comboNormalTotal (PER SET) while price is
// scaled by the set count. Live must report what the reprint sums off the members.
assert.equal(lineSavings({ price: 9, comboNormalTotal: 11, quantity: 1 }), 2);
assert.equal(lineSavings({ price: 18, comboNormalTotal: 11, quantity: 2 }), 4);
// A manual discount already inside `price` is added back before comparing, so the
// saving stays the combo part ($11 normal, $9 combo) and the $1 stays a discount.
assert.equal(lineSavings({ price: 8, comboNormalTotal: 11, quantity: 1 }, 1), 2);

// Case Qty: the live receipt printed 1 for a product with no case size while the
// reprint printed 0. One resolver, one answer — and never 0.
assert.equal(itemsPerCase({ caseQuantity: 6 }), 6);
assert.equal(itemsPerCase({ itemsPerCase: 24 }), 24); // legacy cached alias
assert.equal(itemsPerCase({ caseQuantity: 0 }), 1);
assert.equal(itemsPerCase(null), 1);

// Combo: three member rows banked against one combo line print as ONE line again —
// the combo name, the SET count (not the member quantities), and the member shares
// summed back to the price the live receipt printed.
const grouped = groupSaleItemsForReceipt([
  { productName: 'Chips', totalPrice: 3.3, quantity: 2, tax: 0.3, taxName: 'GST', savings: 0.7, normalPrice: 4, comboName: 'Snack Pack', comboSets: 2 },
  { productName: 'Dip', totalPrice: 6.7, quantity: 4, tax: 0.6, taxName: 'GST', savings: 1.3, normalPrice: 8, comboName: 'Snack Pack', comboSets: 2 },
  { productName: 'Milk', totalPrice: 5, quantity: 1 },
]);
assert.equal(grouped.length, 2);
assert.equal(grouped[0].productName, 'Snack Pack');
assert.equal(grouped[0].quantity, 2);
assert.equal(grouped[0].totalPrice, 10);
assert.equal(grouped[0].unitPrice, 5);
assert.equal(grouped[0].savings, 2);
assert.equal(grouped[0].normalPrice, 12);
assert.equal(Math.round(grouped[0].tax * 100) / 100, 0.9);
assert.equal(grouped[0].productId, null); // a combo line is not one product
assert.equal(grouped[0].taxName, 'GST'); // one rate across the members keeps its name
// Mixed rates: the merged line is unnamed, like the live combo line — not member 1's rate.
assert.equal(groupSaleItemsForReceipt([
  { productName: 'A', totalPrice: 5, taxName: 'GST', comboName: 'Mix', comboSets: 1 },
  { productName: 'B', totalPrice: 5, taxName: 'No Tax', comboName: 'Mix', comboSets: 1 },
])[0].taxName, null);
assert.equal(grouped[1].productName, 'Milk'); // ordinary lines pass through untouched
assert.equal(grouped[1].quantity, 1);
// Two different combos on one sale stay two lines; no combos = the list unchanged.
assert.equal(groupSaleItemsForReceipt([
  { productName: 'A', totalPrice: 1, comboName: 'X', comboSets: 1 },
  { productName: 'B', totalPrice: 2, comboName: 'Y', comboSets: 1 },
]).length, 2);
assert.equal(groupSaleItemsForReceipt([{ productName: 'A' }])[0].productName, 'A');
assert.deepEqual(groupSaleItemsForReceipt(), []);

console.log('saleTotals: ok');
