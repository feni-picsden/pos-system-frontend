import { format as formatWithDateFns } from 'date-fns';

// Setup > General stores date/time patterns in the reference's (moment-style)
// tokens - "DD/MM/YYYY", "h:mm:ssa". date-fns speaks a different dialect for a
// handful of them, so translate before formatting. Tokens the two libraries
// agree on (MM, HH, hh, h, mm, ss) are left alone.
const TOKEN_MAP = {
  YYYY: 'yyyy', YY: 'yy', DD: 'dd', Do: 'do', D: 'd', dddd: 'EEEE', ddd: 'EEE', dd: 'dd', A: 'a', a: 'aaa'
};
// Longest first: DDD before DD/Do/D, dddd/ddd/dd before d, ZZ before Z.
const TOKEN_RE = /YYYY|YY|GGGG|gggg|dddd|ddd|DDD|DD|Do|D|dd|d|E|W|w|ZZ|Z|A|a/g;

const pad = (n, len = 2) => String(Math.abs(n)).padStart(len, '0');

// ISO week (Monday start, week 1 holds the year's first Thursday) and its year.
// Reference check (Melbourne, Sun 1 Nov 2026): "E W w gggg" = "7 44 44 2026",
// so w / gggg count Monday-start weeks too - the help article's "Sunday is 1" /
// "start Sunday" notes do not match what the reference prints.
const isoWeek = (date) => {
  const t = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const week = Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
  return { week, year: t.getUTCFullYear() };
};

// Reference tokens date-fns has no (matching) letter for, computed from the
// date's own fields.
const COMPUTED = {
  // The numeric day of the week (Sunday is 0)
  d: (date) => String(date.getDay()),
  // The day of the year without leading zeros
  DDD: (date) => String(
    Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 1)) / 864e5) + 1
  ),
  // The ISO numeric day of the week (Monday 1 ... Sunday 7)
  E: (date) => String(date.getDay() || 7),
  // Week of the year / its week year (ISO, Monday start)
  W: (date) => String(isoWeek(date).week),
  w: (date) => String(isoWeek(date).week),
  GGGG: (date) => String(isoWeek(date).year),
  gggg: (date) => String(isoWeek(date).year),
  // Timezone offset, without / with a colon (+1100 / +11:00)
  ZZ: (_date, offset) => `${offset < 0 ? '-' : '+'}${pad(Math.trunc(offset / 60))}${pad(offset % 60)}`,
  Z: (_date, offset) => `${offset < 0 ? '-' : '+'}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`,
};

// A pattern split once into date-fns pieces and computed tokens, so no quoting
// is needed (date-fns reads adjacent literals '1''2' as an escaped quote) and
// a report's 10,000 rows don't re-parse the same pattern.
const pieceCache = new Map();
const patternPieces = (pattern) => {
  let pieces = pieceCache.get(pattern);
  if (pieces) return pieces;
  pieces = [];
  let chunk = '';
  let last = 0;
  pattern.replace(TOKEN_RE, (t, at) => {
    chunk += pattern.slice(last, at);
    last = at + t.length;
    if (COMPUTED[t]) {
      if (chunk) pieces.push(chunk);
      pieces.push(COMPUTED[t]);
      chunk = '';
    } else chunk += TOKEN_MAP[t];
    return t;
  });
  chunk += pattern.slice(last);
  if (chunk) pieces.push(chunk);
  if (pieceCache.size > 200) pieceCache.clear(); // typed Custom Formats
  pieceCache.set(pattern, pieces);
  return pieces;
};

// Translation of the date-fns-supported tokens only (computed ones kept as is).
export const toDateFnsPattern = (pattern) =>
  String(pattern).replace(TOKEN_RE, (t) => TOKEN_MAP[t] || t);

// "Custom Format" lets users type anything, so an unformattable pattern must
// not blow up the page - show the pattern itself instead.
// `offsetMinutes`: the zone offset ZZ / Z print; defaults to the browser's,
// which is right only when `date` is a real (not zone-shifted) Date.
export const formatWithTokens = (date, pattern, offsetMinutes = -date.getTimezoneOffset()) => {
  if (!pattern) return '';
  try {
    let out = '';
    for (const piece of patternPieces(String(pattern))) {
      out += typeof piece === 'function' ? piece(date, offsetMinutes) : formatWithDateFns(date, piece);
    }
    return out;
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

// One formatter per zone, built once: constructing an Intl.DateTimeFormat is
// the slow part (10,000 report rows took ~1.4s building one per value).
// An unknown / blank zone falls back to the browser's zone rather than throwing.
const PART_OPTIONS = {
  hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
};
const formatterCache = new Map();
const zoneFormatter = (timeZone) => {
  const key = timeZone || '';
  let dtf = formatterCache.get(key);
  if (!dtf) {
    try {
      dtf = new Intl.DateTimeFormat('en-GB', { ...PART_OPTIONS, timeZone: timeZone || undefined });
    } catch {
      dtf = new Intl.DateTimeFormat('en-GB', PART_OPTIONS);
    }
    formatterCache.set(key, dtf);
  }
  return dtf;
};

// Wall-clock parts of `date` in `timeZone` ({ year, month, day, hour, minute, second }).
export const zonedParts = (date, timeZone) => {
  const dtf = zoneFormatter(timeZone);
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

// The real instant whose wall clock in `timeZone` reads these fields (month is
// 0-based; fields may overflow: day 0 = last day of the previous month).
// Inverse of zonedParts; same as the backend lib/storeTime.js zonedInstant.
export const zonedInstant = (timeZone, year, month, day, hour = 0, minute = 0, second = 0, ms = 0) => {
  const target = Date.UTC(year, month, day, hour, minute, second);
  let instant = target;
  for (let i = 0; i < 4; i += 1) {
    const p = zonedParts(new Date(instant), timeZone);
    const delta = target - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    instant += delta;
    if (!delta) break;
  }
  return new Date(instant + ms);
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

// Minutes `timeZone` is ahead of UTC at `value` (+660 for Sydney in summer).
export const zoneOffsetMinutes = (value, timeZone) => {
  const d = toValidDate(value);
  if (!d) return 0;
  const p = zonedParts(d, timeZone);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((wall - Math.floor(d.getTime() / 1000) * 1000) / 60000);
};

// Setup > General tokens ("DD/MM/YYYY", "h:mm:ssa") rendered in `timeZone`.
export const formatDateValueInZone = (value, pattern, timeZone) => {
  const zoned = toZonedDate(value, timeZone);
  if (!zoned) return '';
  // The offset costs a second zone lookup - only ZZ / Z need it.
  return formatWithTokens(zoned, pattern, /Z/.test(pattern || '') ? zoneOffsetMinutes(value, timeZone) : 0);
};
