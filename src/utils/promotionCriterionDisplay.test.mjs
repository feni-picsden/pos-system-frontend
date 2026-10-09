import assert from 'node:assert/strict';
import { criterionSummary, receiveOptions, showMatchChip, showAnyProductChip, profitHidden, receiveTypeForPurchaseType } from './promotionCriterionDisplay.js';

const c = (over = {}) => ({ isOptional: false, purchaseType: 'purchase', purchaseValue: 0, receiveType: 'total_price', receiveValue: 0, ...over });

// a. summaries - the three reference screenshots word for word
assert.equal(criterionSummary(c({ purchaseValue: 2, receiveType: 'each_item_for', receiveValue: 1 })), 'Purchase 2 to receive each item for $1.00');
assert.equal(criterionSummary(c({ purchaseValue: 2, receiveType: 'discount_each_item', receiveValue: 1 })), 'Purchase 2 to receive a discount on each item worth $1.00');
assert.equal(criterionSummary(c({ purchaseType: 'spend', purchaseValue: 2, receiveType: 'each_item_for', receiveValue: 1 })), 'Spend $2.00 to receive each item for $1.00');
assert.equal(criterionSummary(c({ purchaseValue: 2, receiveType: 'quantity_only' })), 'Purchase 2 (quantity only)');
assert.equal(criterionSummary(c({ purchaseType: 'spend', purchaseValue: 2, receiveType: 'quantity_only' })), 'Spend $2.00 (amount only)');
assert.equal(criterionSummary(c()), 'Purchase 0 to receive a total price of $0.00', 'empty criterion');
assert.equal(criterionSummary(c({ purchaseValue: 3, receiveValue: 10 })), 'Purchase 3 to receive a total price of $10.00');
assert.equal(criterionSummary(c({ purchaseValue: 2, receiveType: 'percentage_discount', receiveValue: 10 })), 'Purchase 2 to receive a percentage discount of 10.00%');
assert.equal(criterionSummary(c({ purchaseValue: '2', receiveValue: '5' })), 'Purchase 2 to receive a total price of $5.00', 'string values from a saved promotion');
assert.ok(!criterionSummary(c({ purchaseValue: 2, receiveValue: 1 })).includes('(Required)'), 'no (Required)');
assert.ok(!criterionSummary(c({ purchaseType: 'spend', purchaseValue: 2, receiveType: 'each_item_for', receiveValue: 1 })).includes('or more'), 'no or more');
assert.equal(criterionSummary(c({ isOptional: true, purchaseValue: 1, receiveValue: 0.5 })), 'Optionally purchase 1 to receive a total price of $0.50');

// b. dropdowns
assert.deepEqual(receiveOptions(c()).map((o) => o.label), ['(quantity only)', 'each item for', 'a total price of', 'a discount on each item worth', 'a discount off the total worth', 'a percentage discount of', 'the same sell rate as if the quantity was']);
assert.deepEqual(receiveOptions(c({ purchaseType: 'spend', receiveType: 'each_item_for' })).map((o) => o.label), ['(amount only)', 'each item for', 'a discount on each item worth', 'a discount off the total worth', 'a percentage discount of', 'the same sell rate as if the quantity was']);
assert.ok(receiveOptions(c({ purchaseType: 'spend', receiveType: 'total_price' })).some((o) => o.value === 'total_price'), 'old saved spend + total price keeps its option');

// c. spend PROFIT
assert.equal(profitHidden(c({ purchaseType: 'spend' })), true);
assert.equal(profitHidden(c()), false);

// d. chips - every reference screenshot
assert.equal(showMatchChip(c(), 1), false, '1 criterion, empty: none');
assert.equal(showAnyProductChip(c()), false);
assert.equal(showMatchChip(c(), 2), true, '2 criteria, empty: exactly only');
assert.equal(showAnyProductChip(c()), false);
assert.equal(showMatchChip(c({ purchaseValue: 2 }), 2), true, '2 criteria, qty 2: both');
assert.equal(showAnyProductChip(c({ purchaseValue: 2 })), true);
assert.equal(showMatchChip(c({ purchaseType: 'spend', purchaseValue: 2 }), 1), true, '1 criterion, spend $2: both');
assert.equal(showAnyProductChip(c({ purchaseType: 'spend', purchaseValue: 2 })), true);
assert.equal(showMatchChip(c({ purchaseValue: 2 }), 1, true), false, 'blank box counts as empty');
assert.equal(showMatchChip(c({ purchaseType: 'spend' }), 1, true), true, '1 criterion, spend, empty amount: "or more" still shown');
assert.equal(showAnyProductChip(c({ purchaseType: 'spend' }), true), false, '...but no "of any product"');

// purchase -> spend switch
assert.equal(receiveTypeForPurchaseType('spend', 'total_price'), 'each_item_for');
assert.equal(receiveTypeForPurchaseType('spend', 'discount_total'), 'discount_total');
assert.equal(receiveTypeForPurchaseType('purchase', 'total_price'), 'total_price');

console.log('promotionCriterionDisplay: all tests passed');
