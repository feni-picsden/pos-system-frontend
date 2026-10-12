import { zonedParts } from './dateFormat.js';

const dayKey = (year, month, day) => year * 10000 + month * 100 + day;

// Picker values represent calendar days in the browser, not UTC instants.
const selectedDay = (value) => {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return dayKey(year, month, day);
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? NaN
    : dayKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
};

export function inOrderInvoiceDateRange(range, value, timeZone) {
  const start = selectedDay(range?.startDate);
  const end = selectedDay(range?.endDate);
  if (start == null && end == null) return true;
  if (Number.isNaN(start) || Number.isNaN(end) || value == null || value === '') return false;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  // Use the same zoned calendar day as the date printed in the table.
  const parts = zonedParts(date, timeZone);
  const day = dayKey(parts.year, parts.month, parts.day);
  return (start == null || day >= start) && (end == null || day <= end);
}
