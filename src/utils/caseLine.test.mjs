// Run: node src/utils/caseLine.test.mjs
import assert from 'node:assert/strict';
import {
  isCaseLine, lineStep, displayQuantity, displayName, toggleCase, countCartLines, formatCountLine,
} from './caseLine.js';

const caseOf6 = { name: 'ZZ Case Test', isCase: true, caseQuantity: 6, quantity: 6, price: 30 };
const unit = { name: 'Beer', isCase: false, caseQuantity: 6, quantity: 2 };
const caseOf1 = { name: 'Single', isCase: true, caseQuantity: 1, quantity: 1 };

assert.equal(isCaseLine(caseOf6), true);
assert.equal(isCaseLine(unit), false);
assert.equal(isCaseLine(caseOf1), false, 'a case of 1 is not a case');
assert.equal(isCaseLine(null), false);

assert.equal(lineStep(caseOf6), 6);
assert.equal(lineStep(unit), 1);

assert.equal(displayQuantity(caseOf6), 1);
assert.equal(displayQuantity({ ...caseOf6, quantity: 12 }), 2);
assert.equal(displayQuantity({ ...caseOf6, quantity: -6 }), -1, 'returned case shows -1');
assert.equal(displayQuantity({ ...caseOf6, quantity: 7 }), 1.17, 'broken case shows 2dp');
assert.equal(displayQuantity(unit), 2);

assert.equal(displayName(caseOf6), 'ZZ Case Test (Case)');
assert.equal(displayName(caseOf6, 'Carton'), 'ZZ Case Test (Carton)');
assert.equal(displayName(unit), 'Beer');

assert.deepEqual(toggleCase(caseOf6), { isCase: false, quantity: 1 }, '1 case -> 1 unit');
assert.deepEqual(toggleCase(unit), { isCase: true, quantity: 12 }, '2 units -> 2 cases');
assert.deepEqual(toggleCase(caseOf1), { isCase: false, quantity: 1 });

assert.deepEqual(countCartLines([caseOf6, { ...caseOf6, quantity: 6 }, unit, { quantity: 1 }]), { cases: 2, items: 3 });
assert.equal(formatCountLine({ cases: 2, items: 3 }), '2 Cases and 3 Items');
assert.equal(formatCountLine({ cases: 1, items: 0 }), '1 Case');
assert.equal(formatCountLine({ cases: 0, items: 1 }), '1 Item');
assert.equal(formatCountLine({ cases: -1, items: 0 }), '-1 Case');
assert.equal(formatCountLine({ cases: 0, items: 0 }), '');

console.log('caseLine: all assertions passed');
