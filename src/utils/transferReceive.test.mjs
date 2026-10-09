import assert from 'node:assert/strict';
import { canReceiveTransfer } from './transferReceive.js';

const t = (over = {}) => ({ type: 'TRANSFER', status: 'SENT', to: '2', from: '1', ...over });

assert.equal(canReceiveTransfer(t(), { outletId: 2 }, false), true, 'destination outlet user');
assert.equal(canReceiveTransfer(t(), { outletId: 1 }, false), false, 'source outlet user cannot receive');
assert.equal(canReceiveTransfer(t(), { outletId: null }, true), true, 'global admin');
assert.equal(canReceiveTransfer(t({ status: 'PENDING' }), { outletId: 2 }, false), false, 'not sent yet');
assert.equal(canReceiveTransfer(t({ status: 'RECEIVED' }), { outletId: 2 }, false), false, 'already received');
assert.equal(canReceiveTransfer(t({ to: 'transferee:5' }), null, true), false, 'transferee target');
assert.equal(canReceiveTransfer(t({ to: 'vendor:3' }), null, true), false, 'vendor target');
assert.equal(canReceiveTransfer(t({ type: 'ORDER' }), { outletId: 2 }, true), false, 'orders use their own receive');
assert.equal(canReceiveTransfer(null, null, true), false, 'no document');
assert.equal(canReceiveTransfer(t({ type: 'transfer', status: 'sent' }), { outletId: 2 }, false), true, 'case-insensitive');
console.log('transferReceive: all tests passed');
