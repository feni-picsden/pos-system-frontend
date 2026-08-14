import assert from 'node:assert/strict';
import { totalProfitPercentage } from './reportTotals.js';

// Same sales, grouped two different ways -> same Total Profit %.
const byOutlet = [
  { revenue: 200.00, costOfGoods: 150.00 },
  { revenue: 155.45, costOfGoods: 149.74 },
];
const byCustomer = [
  { revenue: 10.00, costOfGoods: 10.33 },
  { revenue: 145.45, costOfGoods: 67.15 },
  { revenue: 0, costOfGoods: 0 },
  { revenue: 200.00, costOfGoods: 222.26 },
];

const expected = ((355.45 - 299.74) / 355.45) * 100;
assert.ok(Math.abs(totalProfitPercentage(byOutlet) - expected) < 1e-9);
assert.ok(Math.abs(totalProfitPercentage(byCustomer) - expected) < 1e-9);
assert.equal(totalProfitPercentage(byOutlet).toFixed(2), '15.67');

// Zero-revenue and empty guards.
assert.equal(totalProfitPercentage([{ revenue: 0, costOfGoods: 5 }]), 0);
assert.equal(totalProfitPercentage([]), 0);
assert.equal(totalProfitPercentage(), 0);

console.log('reportTotals ok');
