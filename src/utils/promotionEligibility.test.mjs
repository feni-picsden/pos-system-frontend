// node src/utils/promotionEligibility.test.mjs
import assert from 'node:assert/strict';
import { parseIsoDuration, isScheduleActiveAt, promotionAllowedForCustomer } from './promotionEligibility.js';

// durations (the Edit Schedule dialog saves them with a trailing space)
assert.deepEqual(parseIsoDuration('P1W '), { years: 0, months: 0, weeks: 1, days: 0, hours: 0, minutes: 0, seconds: 0 });
assert.equal(parseIsoDuration('PT2H30M').minutes, 30);
assert.equal(parseIsoDuration('nonsense'), null);
assert.equal(parseIsoDuration(''), null);

// weekly, Mondays only, whole day (anchor Monday 2026-10-05)
const weekly = { anchorDate: '2026-10-05', repeatingPeriod: 'P1W ', timeToStart: '', enabledDuration: 'P1D ' };
assert.equal(isScheduleActiveAt(weekly, new Date(2026, 9, 5, 10, 0)), true, 'anchor Monday');
assert.equal(isScheduleActiveAt(weekly, new Date(2026, 9, 12, 23, 59)), true, 'next Monday late');
assert.equal(isScheduleActiveAt(weekly, new Date(2026, 9, 8, 18, 5)), false, 'Thursday is off');
assert.equal(isScheduleActiveAt(weekly, new Date(2026, 9, 13, 0, 0)), false, 'Tuesday midnight is off');
assert.equal(isScheduleActiveAt(weekly, new Date(2026, 9, 4, 12, 0)), false, 'before the anchor');

// daily happy hour 17:00 for 2 hours
const happy = { anchorDate: '2026-10-01', repeatingPeriod: 'P1D', timeToStart: '17:00', enabledDuration: 'PT2H' };
assert.equal(isScheduleActiveAt(happy, new Date(2026, 9, 8, 17, 30)), true);
assert.equal(isScheduleActiveAt(happy, new Date(2026, 9, 8, 19, 0)), false, 'ends at 19:00');
assert.equal(isScheduleActiveAt(happy, new Date(2026, 9, 8, 12, 0)), false);

// monthly on the 1st for 3 days
const monthly = { anchorDate: '2026-01-01', repeatingPeriod: 'P1M', enabledDuration: 'P3D' };
assert.equal(isScheduleActiveAt(monthly, new Date(2026, 9, 2)), true);
assert.equal(isScheduleActiveAt(monthly, new Date(2026, 9, 15)), false);

// no usable schedule = always on
assert.equal(isScheduleActiveAt(null), true);
assert.equal(isScheduleActiveAt({ anchorDate: '', repeatingPeriod: 'P1W' }), true);
assert.equal(isScheduleActiveAt({ anchorDate: '2026-10-05', repeatingPeriod: '' }), true);

// customer groups
const grp = { availableTo: 'Customer Groups', customerGroupIds: [7] };
assert.equal(promotionAllowedForCustomer(grp, null), false, 'no customer attached');
assert.equal(promotionAllowedForCustomer(grp, { customerGroupId: 3 }), false, 'other group');
assert.equal(promotionAllowedForCustomer(grp, { customerGroupId: 7 }), true);
assert.equal(promotionAllowedForCustomer(grp, { customerGroup: { id: 7 } }), true, 'nested group');
assert.equal(promotionAllowedForCustomer({ availableTo: 'All Customers', customerGroupIds: [7] }, null), true, 'all customers ignores the list');
assert.equal(promotionAllowedForCustomer({ availableTo: 'Customer Groups', customerGroupIds: [] }, null), true, 'no groups chosen = everyone');
assert.equal(promotionAllowedForCustomer({ availableTo: 'Customer Groups', customerGroups: [{ customerGroupId: 7 }] }, { customerGroupId: 7 }), true, 'link rows');

console.log('promotionEligibility: all assertions passed');
