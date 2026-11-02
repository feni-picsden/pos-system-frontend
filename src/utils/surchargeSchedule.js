import { zonedParts } from './dateFormat';

// Surcharge schedules hold a weekday plus "HH:MM" / "HH:MM:SS" wall-clock times
// in the STORE's zone (Setup > General > Timezone) - the reference runs its live
// clock in that zone, so a till in another zone must not shift the surcharge.

const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const DAY_SECONDS = 24 * 60 * 60;
// Reference stores "Apply all day" as 00:00 - 23:59; that end means midnight.
const LAST_MINUTE = DAY_SECONDS - 60;

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

// Seconds since midnight, or null when the value is not a time.
export const timeToSeconds = (value) => {
  const m = TIME_RE.exec(String(value ?? '').trim());
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] || 0);
};

// End of a window: 23:59 / 23:59:xx runs to midnight (exclusive end otherwise).
export const endTimeToSeconds = (value) => {
  const s = timeToSeconds(value);
  return s != null && s >= LAST_MINUTE ? DAY_SECONDS : s;
};

// Stored form: "HH:MM" when the seconds are zero (keeps existing rows and the
// reference's "00:00 - 23:59" look), "HH:MM:SS" otherwise.
export const normaliseTime = (value) => {
  const s = timeToSeconds(value);
  if (s == null) return value;
  const p2 = (n) => String(n).padStart(2, '0');
  const hh = p2(Math.floor(s / 3600));
  const mm = p2(Math.floor((s % 3600) / 60));
  const ss = s % 60;
  return ss ? `${hh}:${mm}:${p2(ss)}` : `${hh}:${mm}`;
};

// A valid window starts before it ends on the same day (no overnight rows).
export const isValidWindow = (startTime, endTime) => {
  const start = timeToSeconds(startTime);
  const end = endTimeToSeconds(endTime);
  return start != null && end != null && start < end;
};

// { day: 'MONDAY', seconds } for `now` on the store's wall clock.
export const storeWallClock = (now, timeZone) => {
  const p = zonedParts(now, timeZone);
  return {
    day: DAY_NAMES[new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()],
    seconds: p.hour * 3600 + p.minute * 60 + p.second,
  };
};

// Is `schedule` running at `clock` (from storeWallClock)?
export const isSurchargeActiveAt = (schedule, clock) => {
  if (!schedule || !clock) return false;
  if (schedule.dayOfWeek && String(schedule.dayOfWeek).toUpperCase() !== clock.day) return false;
  const start = schedule.startTime ? timeToSeconds(schedule.startTime) : 0;
  const end = schedule.endTime ? endTimeToSeconds(schedule.endTime) : DAY_SECONDS;
  if (start == null || end == null || end <= start) return false;
  return clock.seconds >= start && clock.seconds < end;
};
