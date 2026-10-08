// node src/services/posLocalDb.search.test.mjs
// Setup > General > Search levels, per the reference More Info text.
import assert from 'node:assert/strict';
import { matchesSearchLevel } from './posLocalDb.js';

const jb = 'jim beam & cola can 375ml';

// Full: anywhere within the string, any order
assert.equal(matchesSearchLevel(jb, 'jim beam', 'full'), true);
assert.equal(matchesSearchLevel(jb, 'beam jim', 'full'), true, 'any order');
assert.equal(matchesSearchLevel(jb, 'eam', 'full'), true, 'from anywhere within the string');
assert.equal(matchesSearchLevel(jb, 'cola 375', 'full'), true);
assert.equal(matchesSearchLevel(jb, 'jim vodka', 'full'), false, 'every word must be found');
assert.equal(matchesSearchLevel('señor café', 'señ', 'full'), true, 'works with any language');

// English Tokenized: like Full, non-English characters cannot be searched for
assert.equal(matchesSearchLevel(jb, 'beam jim', 'english'), true);
assert.equal(matchesSearchLevel(jb, 'eam', 'english'), true);
assert.equal(matchesSearchLevel('señor café', 'señor', 'english'), true, 'the English letters still match');
assert.equal(matchesSearchLevel('señor café', 'ñ', 'english'), false, 'a non-English-only query finds nothing');

// Strict: only from the beginning of words
assert.equal(matchesSearchLevel(jb, 'beam', 'strict'), true);
assert.equal(matchesSearchLevel(jb, 'beam jim', 'strict'), true, 'any order, each at a word start');
assert.equal(matchesSearchLevel(jb, 'eam', 'strict'), false, 'not from inside a word');
assert.equal(matchesSearchLevel(jb, '375', 'strict'), true, 'word start after a space');
assert.equal(matchesSearchLevel(jb, 'cola', 'strict'), true, 'word start after "& "');
assert.equal(matchesSearchLevel('señor café', 'señ', 'strict'), true, 'works with any language');

// Offload: local fallback behaves as Strict ("Can only search from the beginning of words")
assert.equal(matchesSearchLevel(jb, 'eam', 'offload'), false);
assert.equal(matchesSearchLevel(jb, 'beam', 'offload'), true);

// Edge cases
assert.equal(matchesSearchLevel(jb, '', 'full'), true, 'empty query matches');
assert.equal(matchesSearchLevel(jb, '& cola', 'full'), true, 'regex characters are literal');
assert.equal(matchesSearchLevel(jb, 'c&', 'full'), false, 'no such substring');
assert.equal(matchesSearchLevel(jb, '&', 'strict'), true, '& at a word start');

console.log('posLocalDb search levels: all assertions passed');
