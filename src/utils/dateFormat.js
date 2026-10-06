import { format as formatWithDateFns } from 'date-fns';

// Setup > General stores date/time patterns in the reference's (moment-style)
// tokens - "DD/MM/YYYY", "h:mm:ssa". date-fns speaks a different dialect for a
// handful of them, so translate before formatting. Tokens the two libraries
// agree on (MM, HH, hh, h, mm, ss) are left alone.
const TOKEN_MAP = {
  YYYY: 'yyyy', YY: 'yy', DD: 'dd', Do: 'do', D: 'd', dddd: 'EEEE', ddd: 'EEE', A: 'a', a: 'aaa'
};
// Do (ordinal day, "7th") must be tried before D.
const TOKEN_RE = /YYYY|YY|dddd|ddd|DD|Do|D|A|a/g;

export const toDateFnsPattern = (pattern) => String(pattern).replace(TOKEN_RE, (t) => TOKEN_MAP[t]);

// "Custom Format" lets users type anything, so an unformattable pattern must
// not blow up the page - show the pattern itself instead.
export const formatWithTokens = (date, pattern) => {
  if (!pattern) return '';
  try {
    return formatWithDateFns(date, toDateFnsPattern(pattern));
  } catch {
    return String(pattern);
  }
};

// Dates/times in the app come from a value the user typed or the API sent, so
// anything unparseable renders empty rather than "Invalid Date".
// ponytail: kept settings-free so the node self-check can import this module;
// callers pass the pattern from settingsService.getCachedGeneralSettings().
export const formatDateValue = (value, pattern) => {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : formatWithTokens(d, pattern);
};

// ---- Timezone helpers (settings-free; callers pass the IANA zone) ----------
//
// Timestamps are stored as UTC. Every page used to format them with the
// browser's own clock (or, for shelf tickets, the SERVER's clock), so the same
// moment showed different times on different machines. These helpers render a
// moment in ONE zone - the one Setup > General > Timezone names.

const toValidDate = (value) => {
  // new Date(null) is the epoch, not invalid - blank must render blank.
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Wall-clock parts of `date` in `timeZone` ({ year, month, day, hour, minute, second }).
// An unknown / blank zone falls back to the browser's zone rather than throwing.
export const zonedParts = (date, timeZone) => {
  let dtf;
  try {
    dtf = new Intl.DateTimeFormat('en-GB', {
      timeZone: timeZone || undefined,
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    dtf = new Intl.DateTimeFormat('en-GB', {
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }
  const parts = {};
  dtf.formatToParts(date).forEach((p) => {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  });
  // Some engines print midnight as 24 with hour12:false; h23 above avoids it,
  // but guard anyway.
  if (parts.hour === 24) parts.hour = 0;
  return parts;
};

// A Date whose LOCAL fields equal the wall clock in `timeZone`, so token-based
// formatters (date-fns, which only know the browser zone) print zone-correct
// output. Only ever use the result for display - it is not the real instant.
export const toZonedDate = (value, timeZone) => {
  const d = toValidDate(value);
  if (!d) return null;
  const p = zonedParts(d, timeZone);
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, d.getMilliseconds());
};

const pad2 = (n) => String(n).padStart(2, '0');

// "dd/mm/yyyy" in `timeZone` (what list screens show).
export const formatDateInZone = (value, timeZone) => {
  const d = toValidDate(value);
  if (!d) return '';
  const p = zonedParts(d, timeZone);
  return `${pad2(p.day)}/${pad2(p.month)}/${p.year}`;
};

// "dd/mm/yyyy HH:mm:ss" in `timeZone` - the reference's detail-screen format
// (no comma, 24-hour).
export const formatDateTimeInZone = (value, timeZone) => {
  const d = toValidDate(value);
  if (!d) return '';
  const p = zonedParts(d, timeZone);
  return `${pad2(p.day)}/${pad2(p.month)}/${p.year} ${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}`;
};

// Setup > General tokens ("DD/MM/YYYY", "h:mm:ssa") rendered in `timeZone`.
export const formatDateValueInZone = (value, pattern, timeZone) => {
  const zoned = toZonedDate(value, timeZone);
  return zoned ? formatWithTokens(zoned, pattern) : '';
};
