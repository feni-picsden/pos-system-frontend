// "New Price Point" behaviour (reference): a blank row at the top, no default price,
// no margin; a blank row is dropped on save; clearing a price blanks its %.
// The handlers live in ProductEdit.jsx; this mirrors them step for step so the
// rules run under plain Node.
import assert from 'node:assert/strict';
import { syncPriceRows, rowQuantity } from './priceRowSync.js';

const itemCost = 1;
const display = 'Gross Profit Margin';
const round2 = (n) => Math.round(n * 100) / 100;
const calculateBaseCost = (cost, qty) => (!cost || cost <= 0 ? 0 : cost * qty);

// ProductEdit.addPriceRow
const addPriceRow = (prices) => [
  { quantity: '', price: '', cost: calculateBaseCost(itemCost, 1), percentage: '' },
  ...prices,
];
// ProductEdit.isBlankPriceRow
const isBlankPriceRow = (row) =>
  (row?.quantity === '' || row?.quantity == null) && (row?.price === '' || row?.price == null);
// ProductEdit price cell onChange
const typePrice = (prices, index, inputPrice) => {
  const next = [...prices];
  const hasPrice = parseFloat(inputPrice) > 0;
  next[index] = { ...next[index], price: inputPrice, ...(hasPrice ? {} : { percentage: '' }) };
  return syncPriceRows(next, index, itemCost, display);
};
// ProductEdit quantity cell onChange
const typeQuantity = (prices, index, value) => {
  const next = [...prices];
  const newQty = parseInt(value) || 1;
  const oldQty = rowQuantity(next[index]);
  const oldPrice = parseFloat(next[index].price) || 0;
  const scaled = oldQty > 0 && oldPrice > 0 ? round2((oldPrice / oldQty) * newQty) : next[index].price;
  next[index] = { ...next[index], quantity: newQty, price: scaled };
  return syncPriceRows(next, index, itemCost, display);
};
// ProductEdit save payload
const payloadPrices = (prices) =>
  prices.filter((p) => !isBlankPriceRow(p)).map((p) => ({
    ...p, quantity: parseInt(p.quantity, 10) || 1, price: round2(parseFloat(p.price) || 0),
  }));
// ProductEdit "no price" guard
const hasNoPrice = (prices) => prices.filter((p) => !isBlankPriceRow(p)).length === 0;
// ProductEdit recost effect
const recost = (prices) => prices.map((price) => {
  if (isBlankPriceRow(price)) return { ...price, cost: calculateBaseCost(itemCost, 1) };
  return { ...price, cost: calculateBaseCost(itemCost, price.quantity) };
});

const saved = [{ quantity: 1, price: 2.5, cost: 1, percentage: 60 }];

// 1. New Price Point: blank row at the TOP, cost = item cost, no price, no margin.
let rows = addPriceRow(saved);
assert.equal(rows.length, 2);
assert.deepEqual(rows[0], { quantity: '', price: '', cost: 1, percentage: '' }, 'blank row first');
assert.deepEqual(rows[1], saved[0], 'existing row untouched');

// 2. Cost column reads the blank row as one unit.
assert.equal(itemCost * (rowQuantity(rows[0]) || 1), 1);

// 3. Blank row does not disturb the single when a pack is typed elsewhere.
rows = typePrice(rows, 1, '3');
assert.equal(rows[0].price, '', 'blank row still blank');
assert.equal(rows[1].price, '3');

// 4. Typing into the blank row: 24 @ 120 -> its % is 80 and the single stays as typed.
rows = typeQuantity(rows, 0, '24');
assert.equal(rows[0].price, '', 'quantity alone gives no price');
rows = typePrice(rows, 0, '120');
assert.equal(rows[0].cost, 24);
assert.equal(rows[0].percentage, 80);
assert.equal(rows[1].price, '3', 'single independent of the pack (reference)');

// 5. Clearing a price blanks its %, and does not touch other rows.
rows = typePrice(rows, 0, '');
assert.equal(rows[0].price, '');
assert.equal(rows[0].percentage, '', 'cleared price -> blank %');
assert.equal(rows[1].price, '3');

// 6. Save drops an untouched blank row, keeps the filled ones.
let toSave = addPriceRow([{ quantity: 24, price: '120', cost: 24, percentage: 80 }, saved[0]]);
assert.deepEqual(payloadPrices(toSave).map((p) => [p.quantity, p.price]), [[24, 120], [1, 2.5]]);
assert.equal(hasNoPrice(toSave), false);

// 7. Only a blank row -> "no price" guard fires.
assert.equal(hasNoPrice(addPriceRow([])), true);

// 8. A row with quantity typed but no price is NOT blank: it is sent (qty 24, $0)
//    and the server-side "must have a price" rule / rate check apply as before.
const halfRow = [{ quantity: 24, price: '', cost: 24, percentage: '' }];
assert.equal(isBlankPriceRow(halfRow[0]), false);

// 9. Recost keeps a blank row blank (no $0.00 under the operator).
const recosted = recost(addPriceRow(saved));
assert.deepEqual(recosted[0], { quantity: '', price: '', cost: 1, percentage: '' });

console.log('newPricePoint: ok');
