// ponytail: one self-check for the only parsing here — the cache-bust prefix.
// Run: node src/utils/resourcePrefix.test.mjs
import assert from 'node:assert/strict';
import { resourcePrefix } from './resourcePrefix.js';

// A write must bust every cached read of the same resource, so the result has
// to stay a prefix of the GET urls the app actually calls.
assert.equal(resourcePrefix('/sale-keys/sets/7'), '/sale-keys');
assert.ok('/sale-keys/sets'.startsWith(resourcePrefix('/sale-keys/sets/7')));
assert.equal(resourcePrefix('/sales'), '/sales');
assert.ok('/sales/parked'.startsWith(resourcePrefix('/sales')));
assert.equal(resourcePrefix('/registers/5/take-control'), '/registers');
assert.equal(resourcePrefix('/settings?scope=company'), '/settings');
assert.equal(resourcePrefix(''), '');
assert.equal(resourcePrefix(undefined), '');

console.log('resourcePrefix ok');
