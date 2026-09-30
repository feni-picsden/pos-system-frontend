// node src/utils/searchKeys.test.mjs
import assert from 'node:assert/strict';
import { nextIndex, pickIndex } from './searchKeys.js';

// Top result is the default highlight
assert.equal(pickIndex(-1, 3), 0);
assert.equal(pickIndex(2, 3), 2);
assert.equal(pickIndex(5, 3), 0);   // stale index after results shrank -> top
assert.equal(pickIndex(0, 0), -1);  // nothing to pick

// Arrow keys move and wrap around
assert.equal(nextIndex('ArrowDown', -1, 3), 1);
assert.equal(nextIndex('ArrowDown', 1, 3), 2);
assert.equal(nextIndex('ArrowDown', 2, 3), 0);  // last -> first
assert.equal(nextIndex('ArrowUp', 2, 3), 1);
assert.equal(nextIndex('ArrowUp', 0, 3), 2);    // first -> last
// Escape closes, other keys keep the highlight
assert.equal(nextIndex('Escape', 1, 3), -1);
assert.equal(nextIndex('a', 1, 3), 1);
assert.equal(nextIndex('ArrowDown', 0, 0), -1);

console.log('searchKeys: all cases pass');
