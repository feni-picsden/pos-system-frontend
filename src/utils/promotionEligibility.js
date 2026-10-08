// Who gets a promotion and when: the parts of a promotion's header the sell
// screen used to ignore (reference: Available to = Customer Groups; Recurring
// Promotion with an ISO 8601 schedule from the Edit Schedule dialog).

// "P1W", "P1D", "P2M", "PT2H30M", "P1DT12H" -> parts. Null when unreadable.
export function parseIsoDuration(value) {
  const s = String(value || '').trim().toUpperCase();
  const m = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(s);
  if (!m || s === 'P' || s === 'PT') return null;
  const n = (v) => parseInt(v || '0', 10);
  const d = { years: n(m[1]), months: n(m[2]), weeks: n(m[3]), days: n(m[4]), hours: n(m[5]), minutes: n(m[6]), seconds: n(m[7]) };
  const any = Object.values(d).some((v) => v > 0);
  return any ? d : null;
}

export function addDuration(date, d) {
  const out = new Date(date.getTime());
  if (d.years) out.setFullYear(out.getFullYear() + d.years);
  if (d.months) out.setMonth(out.getMonth() + d.months);
  const days = (d.weeks || 0) * 7 + (d.days || 0);
  if (days) out.setDate(out.getDate() + days);
  const ms = ((d.hours || 0) * 3600 + (d.minutes || 0) * 60 + (d.seconds || 0)) * 1000;
  return ms ? new Date(out.getTime() + ms) : out;
}

// Local midnight of an anchor date ("2026-10-05" or a full ISO string), plus the
// optional "HH:mm" time to start.
function windowStartOf(anchorDate, timeToStart) {
  const raw = String(anchorDate || '').trim();
  if (!raw) return null;
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  const base = ymd ? new Date(+ymd[1], +ymd[2] - 1, +ymd[3]) : new Date(raw);
  if (Number.isNaN(base.getTime())) return null;
  const t = /^(\d{1,2}):(\d{2})/.exec(String(timeToStart || '').trim());
  if (t) base.setHours(+t[1], +t[2], 0, 0);
  else if (ymd) base.setHours(0, 0, 0, 0);
  return base;
}

/**
 * Is a recurring schedule "on" at `now`?
 *   anchorDate      first occurrence (date)
 *   repeatingPeriod ISO 8601 duration between occurrences (P1W = weekly)
 *   timeToStart     optional HH:mm within the day
 *   enabledDuration ISO 8601 duration each occurrence stays on (P1D = the whole day)
 * A schedule with no anchor or no period is treated as always on (nothing to
 * repeat); an unreadable duration falls back to "whole period".
 */
export function isScheduleActiveAt(schedule, now = new Date()) {
  if (!schedule || typeof schedule !== 'object') return true;
  const start = windowStartOf(schedule.anchorDate, schedule.timeToStart);
  const period = parseIsoDuration(schedule.repeatingPeriod);
  if (!start || !period) return true;
  const enabled = parseIsoDuration(schedule.enabledDuration);
  if (now < start) return false;
  // Walk occurrences forward to the last one that started on or before `now`
  // (calendar months/years make a straight division unsafe). Bounded.
  let occ = start;
  for (let i = 0; i < 20000; i += 1) {
    const next = addDuration(occ, period);
    if (next.getTime() <= occ.getTime()) return true; // zero-length period: always on
    if (next > now) break;
    occ = next;
  }
  const end = enabled ? addDuration(occ, enabled) : addDuration(occ, period);
  return now >= occ && now < end;
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
