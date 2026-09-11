import { formatWithTokens } from './dateFormat.js';

// Some sale keys exist only to tell the operator something - the time, the
// latest birth date that is old enough to buy alcohol, a line of text. The
// reference (pmk.onshopfront.com) prints that value on the key itself and the
// key does nothing when pressed; opening a dialog just to read it costs a tap
// and hides the sale.

export const DEFAULT_TIME_FORMAT = 'HH:mm:ss';
export const DEFAULT_PREVIOUS_DATE_FORMAT = 'Do MMM YYYY';

// Actions whose value changes while the key is on screen.
export const CLOCK_ACTIONS = new Set(['view-current-time', 'view-previous-date']);

// A key that only shows something, so pressing it does nothing. A Special Action
// key with no message stays pressable: its click is what tells the operator the
// key was never configured.
export const isDisplayOnlyKey = (saleKey) =>
  CLOCK_ACTIONS.has(saleKey?.action)
  || saleKey?.action === 'info'
  || (saleKey?.action === 'special' && Boolean(saleKey.specialText));

// Moves a date back by whole months, keeping the day but clamping it to the
// target month's length: 29 Feb minus a year is 28 Feb, not 1 Mar. That is what
// the reference (moment's subtract) does, and a legal-age key must never roll a
// birthday forward into the next month.
const subtractMonths = (date, months) => {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() - months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
};

// Subtract an ISO 8601 period (P18Y, P21Y, P1Y6M, P2W, PT30M) from a date.
// Anything that is not a period leaves the date untouched.
export const subtractIsoPeriod = (date, iso) => {
  const m = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i
    .exec(String(iso || '').trim());
  if (!m) return new Date(date.getTime());
  const n = (i) => (m[i] ? parseInt(m[i], 10) : 0);
  const d = subtractMonths(date, n(1) * 12 + n(2));
  d.setDate(d.getDate() - (n(3) * 7 + n(4)));
  d.setHours(d.getHours() - n(5), d.getMinutes() - n(6), d.getSeconds() - n(7));
  return d;
};

// The text a key shows under its name in place of an action, or null for a key
// that acts when pressed.
export const getSaleKeyLiveText = (saleKey, now = new Date()) => {
  switch (saleKey?.action) {
    case 'view-current-time':
      return formatWithTokens(now, saleKey.dateFormat || DEFAULT_TIME_FORMAT);
    case 'view-previous-date':
      return formatWithTokens(
        subtractIsoPeriod(now, saleKey.durationAgo || 'P0D'),
        saleKey.dateFormat || DEFAULT_PREVIOUS_DATE_FORMAT,
      );
    case 'info':
      return saleKey.infoText || '';
    case 'special':
      return saleKey.specialText || '';
    default:
      return null;
  }
};
