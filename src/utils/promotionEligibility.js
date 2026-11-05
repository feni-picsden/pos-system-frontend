// Who gets a promotion and when: the parts of a promotion's header the sell
// screen used to ignore (reference: Available to = Customer Groups; Recurring
// Promotion with an ISO 8601 schedule from the Edit Schedule dialog).

import { parseIsoDuration, addDuration, parseAnchor, isScheduleOn } from './promotionSchedule.js';

export { parseIsoDuration, addDuration };

/**
 * Is a recurring schedule "on" at `now`? (utils/promotionSchedule.js rules,
 * measured on the live reference 05/11/2026.)
 *   anchorDate      first occurrence, ISO or "DD/MM/YYYY HH:mm:ss", in the STORE zone
 *   repeatingPeriod ISO 8601 duration between occurrences (P1W = weekly)
 *   timeToStart     optional ISO duration (PT2H) or "HH:mm" after the anchor
 *   enabledDuration ISO 8601 duration each occurrence stays on
 * A schedule with no anchor or no period is treated as always on (nothing to
 * repeat); an unreadable duration falls back to "whole period".
 * @param {string} [timeZone] Setup > General timezone (browser zone when omitted)
 */
export function isScheduleActiveAt(schedule, now = new Date(), timeZone) {
  if (!schedule || typeof schedule !== 'object') return true;
  const anchor = parseAnchor(schedule.anchorDate, timeZone);
  const period = parseIsoDuration(schedule.repeatingPeriod);
  if (!anchor || !period) return true;
  const draft = {
    ...schedule,
    enabledDuration: parseIsoDuration(schedule.enabledDuration) ? schedule.enabledDuration : schedule.repeatingPeriod,
  };
  return isScheduleOn(draft, timeZone, now);
}

/**
 * "Available to": every customer, or only members of the listed customer groups.
 * A group-restricted promotion needs an attached customer in one of those groups.
 */
export function promotionAllowedForCustomer(promotion, customer) {
  if (!promotion) return false;
  const mode = String(promotion.availableTo || 'All Customers').toLowerCase();
  const ids = Array.isArray(promotion.customerGroupIds)
    ? promotion.customerGroupIds
    : Array.isArray(promotion.customerGroups)
      ? promotion.customerGroups.map((g) => g.customerGroupId ?? g.customerGroup?.id ?? g.id)
      : [];
  const groupIds = ids.map((g) => parseInt(g, 10)).filter(Number.isFinite);
  if (!mode.includes('group') || groupIds.length === 0) return true;
  if (!customer) return false;
  const cid = parseInt(customer.customerGroupId ?? customer.customerGroup?.id, 10);
  return Number.isFinite(cid) && groupIds.includes(cid);
}
