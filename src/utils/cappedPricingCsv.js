// Capped Pricing file (help centre art. 360029656231): CSV with the columns
//   name, supplier code, quantity, price, start date, end date
// in that order; a header line is optional; dates in any sensible format,
// YYYY-MM-DD recommended. Pure parsing, no React.

/** RFC-4180-ish CSV: quoted fields may hold commas, newlines and "" escapes. */
export const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const src = String(text || '').replace(/^﻿/, ''); // eslint-disable-line no-irregular-whitespace
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else { quoted = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows
    .map((r) => r.map((v) => v.trim()))
    .filter((r) => r.some((v) => v !== ''));
};

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const iso = (y, m, d) => {
  const year = y < 100 ? 2000 + y : y;
  const date = new Date(Date.UTC(year, m - 1, d));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

/**
 * A date in the file -> 'YYYY-MM-DD', or null when it cannot be read.
 * Day comes before month in a numeric date (Australian files), so 01/08/2020
 * is 1 August; YYYY-MM-DD, DD-MM-YYYY, DD.MM.YYYY, "31 Jan 2021", "Jan 31, 2021"
 * and anything else Date.parse can read are accepted too.
 */
export const parseFlexibleDate = (value) => {
  const s = String(value ?? '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) return iso(+m[3], +m[2], +m[1]);
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([a-z]+)[\s-,]+(\d{2,4})$/i);
  if (m && MONTHS[m[2].toLowerCase().slice(0, 4)] !== undefined) return iso(+m[3], MONTHS[m[2].toLowerCase().slice(0, 4)] || MONTHS[m[2].toLowerCase().slice(0, 3)], +m[1]);
  m = s.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{2,4})$/i);
  if (m && MONTHS[m[1].toLowerCase().slice(0, 3)] !== undefined) return iso(+m[3], MONTHS[m[1].toLowerCase().slice(0, 4)] || MONTHS[m[1].toLowerCase().slice(0, 3)], +m[2]);
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
};

const looksLikeHeader = (cells) => {
  const joined = cells.join(' ').toLowerCase();
  return /name/.test(joined) && /(price|quantity|supplier|date)/.test(joined) && !/^\d/.test(cells[0] || '');
};

/**
 * File text -> { rows, skipped }. Rows carry the six columns, dates as
 * 'YYYY-MM-DD' (null when unreadable); `skipped` lists the lines that had no
 * usable name / quantity / price, with the reason.
 */
export const rowsFromCappedPricingCsv = (text) => {
  const lines = parseCsv(text);
  if (!lines.length) throw new Error('CSV file is empty');
  const start = looksLikeHeader(lines[0]) ? 1 : 0;
  const rows = [];
  const skipped = [];
  for (let i = start; i < lines.length; i++) {
    const [name = '', supplierCode = '', qty = '', price = '', startDate = '', endDate = ''] = lines[i];
    const quantity = qty === '' ? 1 : Number(qty);
    const cap = Number(String(price).replace(/^\$/, ''));
    if (!name && !supplierCode) { skipped.push({ line: i + 1, reason: 'no name or supplier code' }); continue; }
    if (!Number.isInteger(quantity) || quantity < 1) { skipped.push({ line: i + 1, reason: `quantity "${qty}" is not a whole number of 1 or more` }); continue; }
    if (!Number.isFinite(cap) || cap <= 0) { skipped.push({ line: i + 1, reason: `price "${price}" is not above 0` }); continue; }
    rows.push({
      name,
      supplierCode,
      quantity,
      price: Math.round(cap * 100) / 100,
      startDate: parseFlexibleDate(startDate),
      endDate: parseFlexibleDate(endDate),
    });
  }
  return { rows, skipped };
};

/** "WA CB ZONE 1 MSP AUG 2020.csv" -> "WA CB ZONE 1 MSP AUG 2020" */
export const programNameFromFile = (fileName) => String(fileName || '').replace(/\.[^.]+$/, '').trim();
