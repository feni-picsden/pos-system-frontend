// node src/utils/numberInput.test.mjs
import assert from 'node:assert/strict';
import { parseNumberInput, numberInputValue, finishNumber } from './numberInput.js';

// An emptied box stays empty while typing - it must NOT snap back to 0.
assert.equal(parseNumberInput(''), '');
assert.equal(parseNumberInput(null), '');
assert.equal(parseNumberInput('-'), '', 'a lone minus is mid-edit, not 0');
assert.equal(parseNumberInput('0'), 0, 'a typed 0 is a real 0');
assert.equal(parseNumberInput('5'), 5);
assert.equal(parseNumberInput('2.5'), 2.5);
assert.equal(parseNumberInput('2.5', { int: true }), 2);
assert.equal(parseNumberInput('abc'), '');

assert.equal(numberInputValue(''), '');
assert.equal(numberInputValue(null), '');
assert.equal(numberInputValue(0), 0, 'a real 0 is still shown');
assert.equal(numberInputValue(7), 7);

assert.equal(finishNumber(''), 0, 'blank settles to the default on blur');
assert.equal(finishNumber('', 1), 1);
assert.equal(finishNumber(0, 1), 0, 'an explicit 0 is kept');
assert.equal(finishNumber('4'), 4);
assert.equal(finishNumber('x', 3), 3);

console.log('numberInput: all assertions passed');
