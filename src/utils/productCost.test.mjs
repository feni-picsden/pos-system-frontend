// Cost resolution: Setup > General > "Cost Calculation Method" and
// "Set Prices Based On", plus "Profitability Display".
//
// The same logic lives twice - here and in pos-system-backend/utils/productCost.js -
// because the till, the reports and the product editor all need it and the two
// projects share no code. The vectors below are duplicated VERBATIM in
// pos-system-backend/test/productCost.test.js with the same expected numbers, so
// either copy drifting fails its own suite.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  effectiveUnitCost,
  effectiveCaseCost,
  highestUnitCost,
  highestCaseCost,
  pricingUnitCost,
  profitPercent,
  priceFromPercent,
} from './productCost.js';

// Alkoomi Riesling, measured off the reference: one CASE cost of $125.15 over a
// case of 12, which does not divide evenly - 10.4291666..., not the $10.43 the
// reference's own field displays.
const RIESLING_UNIT = 125.15 / 12;

const PRODUCTS = {
  split: {
    caseQuantity: 12, caseCost: 125.15, itemCost: 10.43,
    averageCaseCost: 108, averageItemCost: 9, inventory: 120,
  },
  splitNoStock: {
    caseQuantity: 12, caseCost: 125.15, itemCost: 10.43,
    averageCaseCost: 108, averageItemCost: 9, inventory: 0,
  },
  unseeded: {
    caseQuantity: 24, caseCost: 48, itemCost: 2,
    averageCaseCost: 0, averageItemCost: 0, inventory: 240,
  },
  free: {
    caseQuantity: 6, caseCost: 0, itemCost: 0,
    averageCaseCost: 0, averageItemCost: 0, inventory: 10,
  },
  itemOnly: {
    caseQuantity: 10, caseCost: 0, itemCost: 3,
    averageCaseCost: 0, averageItemCost: 2.5, inventory: 5,
  },
  noCaseQty: {
    caseCost: 100, itemCost: 10,
    averageCaseCost: 80, averageItemCost: 8, inventory: 5,
  },
  averageHigher: {
    caseQuantity: 10, caseCost: 100, itemCost: 10,
    averageCaseCost: 130, averageItemCost: 13, inventory: 50,
  },
};

const near = (actual, expected, what) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${what}: got ${actual}, want ${expected}`);

const CCM = 'Cost Calculation Method';
const METHODS = ['Last Cost', 'Average Cost', 'Mixed Mode'];

// Identical table to the backend suite.
const CASES = [
  ['split (in stock)', PRODUCTS.split, { last: RIESLING_UNIT, average: 9, mixed: 9, highest: RIESLING_UNIT }],
  ['split (out of stock)', PRODUCTS.splitNoStock, { last: RIESLING_UNIT, average: 9, mixed: RIESLING_UNIT, highest: RIESLING_UNIT }],
  ['unseeded average', PRODUCTS.unseeded, { last: 2, average: 2, mixed: 2, highest: 2 }],
  ['free product', PRODUCTS.free, { last: 0, average: 0, mixed: 0, highest: 0 }],
  ['item priced only', PRODUCTS.itemOnly, { last: 3, average: 2.5, mixed: 2.5, highest: 3 }],
  ['no case quantity', PRODUCTS.noCaseQty, { last: 10, average: 8, mixed: 8, highest: 10 }],
  ['average above last', PRODUCTS.averageHigher, { last: 10, average: 13, mixed: 13, highest: 13 }],
];

for (const [label, product, want] of CASES) {
  test(`pricingUnitCost - ${label}`, () => {
    for (const method of METHODS) {
      near(pricingUnitCost(product, { setPricesBasedOn: 'Last Cost', costCalculationMethod: method }), want.last, `${label} Last/${method}`);
      near(pricingUnitCost(product, { setPricesBasedOn: 'Highest Cost', costCalculationMethod: method }), want.highest, `${label} Highest/${method}`);
    }
    near(pricingUnitCost(product, { setPricesBasedOn: CCM, costCalculationMethod: 'Last Cost' }), want.last, `${label} CCM/Last`);
    near(pricingUnitCost(product, { setPricesBasedOn: CCM, costCalculationMethod: 'Average Cost' }), want.average, `${label} CCM/Average`);
    near(pricingUnitCost(product, { setPricesBasedOn: CCM, costCalculationMethod: 'Mixed Mode' }), want.mixed, `${label} CCM/Mixed`);
    near(pricingUnitCost(product, {}), want.last, `${label} defaults`);
    near(pricingUnitCost(product), want.last, `${label} no settings`);
  });
}

test('a case cost that does not divide evenly stays exact across the case', () => {
  const unit = pricingUnitCost(PRODUCTS.split, { setPricesBasedOn: 'Last Cost' });
  assert.equal(Math.round(unit * 12 * 100) / 100, 125.15);
  assert.equal(Math.round(10.43 * 12 * 100) / 100, 125.16); // the old behaviour
});

test('pricingUnitCost returns 0 for a missing product', () => {
  assert.equal(pricingUnitCost(null, {}), 0);
  assert.equal(pricingUnitCost(undefined), 0);
});

test('effectiveUnitCost reads the stored pair, not the case cost', () => {
  assert.equal(effectiveUnitCost(PRODUCTS.split, 'Last Cost'), 10.43);
  assert.equal(effectiveUnitCost(PRODUCTS.split, 'Average Cost'), 9);
  assert.equal(effectiveUnitCost(PRODUCTS.split, 'Mixed Mode'), 9);
  assert.equal(effectiveUnitCost(PRODUCTS.splitNoStock, 'Mixed Mode'), 10.43);
});

test('effectiveUnitCost falls back when the average was never seeded', () => {
  assert.equal(effectiveUnitCost(PRODUCTS.unseeded, 'Average Cost'), 2);
  assert.equal(effectiveUnitCost(PRODUCTS.free, 'Average Cost'), 0);
});

test('effectiveCaseCost mirrors effectiveUnitCost on the case side', () => {
  assert.equal(effectiveCaseCost(PRODUCTS.split, 'Last Cost'), 125.15);
  assert.equal(effectiveCaseCost(PRODUCTS.split, 'Average Cost'), 108);
  assert.equal(effectiveCaseCost(PRODUCTS.unseeded, 'Average Cost'), 48);
});

test('highest cost takes the larger of last and average', () => {
  assert.equal(highestUnitCost(PRODUCTS.split), 10.43);
  assert.equal(highestUnitCost(PRODUCTS.averageHigher), 13);
  assert.equal(highestUnitCost(PRODUCTS.unseeded), 2);
  assert.equal(highestCaseCost(PRODUCTS.averageHigher), 130);
});

// ---- Profitability Display ---------------------------------------------------
// Reference formulas, verbatim:
//   Gross Profit Margin - (sell - cost) / sell * 100
//   Markup              - (sell - cost) / cost * 100

test('profitPercent follows the display setting', () => {
  near(profitPercent(5.15, 3.86, 'Gross Profit Margin'), 25.048543689, 'GPM');
  near(profitPercent(5.15, 3.86, 'Markup'), 33.419689119, 'Markup');
  near(profitPercent(166.87, 125.15, 'Gross Profit Margin'), 25.0014982, 'GPM case');
  near(profitPercent(166.87, 108, 'Gross Profit Margin'), 35.2789596692, 'GPM average');
  near(profitPercent(166.87, 108, 'Markup'), 54.50925926, 'Markup average');
});

test('profitPercent defaults to gross profit margin', () => {
  assert.equal(profitPercent(5.15, 3.86), profitPercent(5.15, 3.86, 'Gross Profit Margin'));
});

test('profitPercent never divides by zero', () => {
  assert.equal(profitPercent(0, 5, 'Gross Profit Margin'), 0);
  assert.equal(profitPercent(5, 0, 'Markup'), 0);
});

test('priceFromPercent inverts profitPercent in both modes', () => {
  for (const display of ['Gross Profit Margin', 'Markup']) {
    for (const cost of [3.86, 10.43, 125.15]) {
      for (const pct of [0, 12.5, 25, 60]) {
        const price = priceFromPercent(cost, pct, display);
        near(profitPercent(price, cost, display), pct, `${display} ${cost}@${pct}%`);
      }
    }
  }
});

test('priceFromPercent refuses an impossible 100% margin', () => {
  assert.equal(priceFromPercent(10, 100, 'Gross Profit Margin'), 0);
  assert.equal(priceFromPercent(10, 150, 'Gross Profit Margin'), 0);
  // Markup has no such ceiling: 150% markup on $10 is $25.
  assert.equal(priceFromPercent(10, 150, 'Markup'), 25);
});

test('priceFromPercent returns 0 without a cost', () => {
  assert.equal(priceFromPercent(0, 25, 'Gross Profit Margin'), 0);
  assert.equal(priceFromPercent(-5, 25, 'Markup'), 0);
});
