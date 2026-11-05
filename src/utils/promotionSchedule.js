// Recurring promotion schedule (Edit Schedule dialog), measured on the live
// reference 05/11/2026:
//   * Anchor Date is typed as ISO ("2026-11-04" / "2026-11-04T10:00:00") and read as UTC (not the
//     store zone - measured 05/11/2026) and redisplays as "04/11/2026 10:00:00"; the week / month
//     previews are drawn in the BROWSER's local time (an AU 00:00 anchor sits at
//     05:30 on an IST browser).
//   * Repeating Period / Time to Start / Enabled Duration are ISO 8601 durations.
//   * An unreadable value turns its label red and blanks the fields after it.
//   * Occurrences run from the anchor forward only: start = anchor + k*period +
//     timeToStart, end = start + enabledDuration.
//   * Period <= timeToStart + enabledDuration shows the warning "Repeating Period
//     must be longer than Time to Start and Enabled Duration combined" (the
//     preview still draws).
import { zonedInstant, zonedParts } from './dateFormat.js';

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

const pad = (n) => String(n).padStart(2, '0');

/** "04/11/2026 10:00:00" for an instant, in the store zone. */
export const formatAnchor = (instant, timeZone) => {
  const p = zonedParts(instant, timeZone);
  return `${pad(p.day)}/${pad(p.month)}/${p.year} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
};

/**
 * Anchor text -> instant (Date) in the store zone, or null. Accepts ISO
 * "YYYY-MM-DD", "YYYY-MM-DDTHH:mm", "YYYY-MM-DDTHH:mm:ss" (a trailing zone is
 * honoured) and the redisplayed "DD/MM/YYYY HH:mm:ss".
 */
export const parseAnchor = (raw, timeZone) => {
  const s = String(raw || '').trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
  if (m) {
    const d = zonedInstant(timeZone, +m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  m = /^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
  if (m) {
    const d = zonedInstant(timeZone, +m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const durationMs = (d) => (((d.weeks || 0) * 7 + (d.days || 0)) * 86400 + (d.hours || 0) * 3600 + (d.minutes || 0) * 60 + (d.seconds || 0)) * 1000
  + (d.months || 0) * 30 * 86400000 + (d.years || 0) * 365 * 86400000;

export const FIELD_ORDER = ['anchorDate', 'repeatingPeriod', 'timeToStart', 'enabledDuration'];

/**
 * @returns {{anchor:Date|null, period:object|null, start:object|null, duration:object|null,
 *   invalid:string|null, warning:boolean, complete:boolean}}
 *   invalid = the first field that does not parse (Time to Start may be blank).
 */
export const validateSchedule = (draft, timeZone) => {
  const d = draft || {};
  const anchor = parseAnchor(d.anchorDate, timeZone);
  const period = parseIsoDuration(d.repeatingPeriod);
  const startRaw = String(d.timeToStart || '').trim();
  // Time to Start: an ISO duration ("PT2H"), "PT0H", or the older "HH:mm".
  const hm = /^(\d{1,2}):(\d{2})$/.exec(startRaw);
  const start = !startRaw ? { hours: 0 }
    : hm ? { hours: +hm[1], minutes: +hm[2] }
      : parseIsoDuration(startRaw) || (/^PT0+[HMS]$/i.test(startRaw) ? { hours: 0 } : null);
  const duration = parseIsoDuration(d.enabledDuration);
  let invalid = null;
  if (String(d.anchorDate || '').trim() && !anchor) invalid = 'anchorDate';
  else if (String(d.repeatingPeriod || '').trim() && !period) invalid = 'repeatingPeriod';
  else if (startRaw && !start) invalid = 'timeToStart';
  else if (String(d.enabledDuration || '').trim() && !duration) invalid = 'enabledDuration';
  const complete = Boolean(anchor && period && start && duration) && !invalid;
  const warning = complete && durationMs(period) <= durationMs(start) + durationMs(duration);
  return { anchor, period, start, duration, invalid, warning, complete };
};

/**
 * Occurrence windows overlapping [from, to) as instants, anchor forward only.
 * Bounded so a tiny period over a long range cannot spin.
 */
export const occurrencesBetween = (draft, timeZone, from, to, limit = 2000) => {
  const v = validateSchedule(draft, timeZone);
  if (!v.complete) return [];
  const out = [];
  let occ = v.anchor;
  for (let i = 0; i < limit; i += 1) {
    const s = addDuration(occ, v.start);
    const e = addDuration(s, v.duration);
    if (s >= to) break;
    if (e > from) out.push({ start: s, end: e });
    const next = addDuration(occ, v.period);
    if (next.getTime() <= occ.getTime()) break;
    occ = next;
  }
  return out;
};

/** Is the schedule on at `now`? (sell screen / simulator helper) */
export const isScheduleOn = (draft, timeZone, now = new Date()) =>
  occurrencesBetween(draft, timeZone, new Date(now.getTime() - 1), new Date(now.getTime() + 1), 5000)
    .some((o) => now >= o.start && now < o.end);
