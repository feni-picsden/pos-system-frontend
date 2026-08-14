import { format as formatWithDateFns } from 'date-fns';

// Setup > General stores date/time patterns in the reference's (moment-style)
// tokens - "DD/MM/YYYY", "h:mm:ssa". date-fns speaks a different dialect for a
// handful of them, so translate before formatting. Tokens the two libraries
// agree on (MM, HH, hh, h, mm, ss) are left alone.
const TOKEN_MAP = {
  YYYY: 'yyyy', YY: 'yy', DD: 'dd', D: 'd', dddd: 'EEEE', ddd: 'EEE', A: 'a', a: 'aaa'
};
const TOKEN_RE = /YYYY|YY|dddd|ddd|DD|D|A|a/g;

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
