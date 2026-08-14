// Receipt template expression language.
//
// The reference (Shopfront) evaluates single-brace expressions inside a text
// component's rich HTML, e.g.
//   Inv No #{invoiceNo}
//   {format(completedAt, "Do MMM YYYY h:mm:ss a")}
//   {IF(note, CONCAT(note, ""), "")}
//   {coalesce(customer.invoiceMessage, "")}
//   {IF(sale.metaData.iba:loyalty:customer.MemberID, COALESCE("Thank you", x), "")}
// Paths are dotted, may contain ':' inside a key, and an unresolved path is an
// empty string (never printed literally). Function names are case-insensitive.
// Measured on topdrops 2026-08-05 — see docs/parity/receipt-template.md §7.
import { format as formatDate, parseISO, isValid } from 'date-fns';

// moment tokens (what templates are authored in) -> date-fns tokens.
const MOMENT_TO_DATE_FNS = [
  ['YYYY', 'yyyy'], ['YY', 'yy'],
  ['DDDD', 'DDD'], ['DDD', 'DDD'], ['DD', 'dd'], ['Do', 'do'], ['D', 'd'],
  ['dddd', 'EEEE'], ['ddd', 'EEE'],
  ['A', 'aa'], ['a', 'aaa'],
  ['ZZ', 'xx'], ['Z', 'xxx'],
  ['X', 't'],
];

const translateDateFormat = (pattern) => {
  let out = '';
  let i = 0;
  while (i < pattern.length) {
    if (pattern[i] === '[') { // moment escapes literals in [brackets]
      const end = pattern.indexOf(']', i);
      const literal = end === -1 ? pattern.slice(i + 1) : pattern.slice(i + 1, end);
      out += `'${literal.replace(/'/g, "''")}'`;
      i = end === -1 ? pattern.length : end + 1;
      continue;
    }
    const hit = MOMENT_TO_DATE_FNS.find(([m]) => pattern.startsWith(m, i));
    if (hit) { out += hit[1]; i += hit[0].length; continue; }
    // Tokens identical in both (M, MM, MMM, MMMM, H, HH, h, hh, m, mm, s, ss)
    // pass through; anything else is a separator and must be quoted so date-fns
    // does not read a stray letter as a token.
    if (/[A-Za-z]/.test(pattern[i]) && !/[MHhms]/.test(pattern[i])) {
      out += `'${pattern[i]}'`;
    } else {
      out += pattern[i];
    }
    i += 1;
  }
  return out;
};

const toDate = (value) => {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string' && value) {
    const parsed = parseISO(value);
    return isValid(parsed) ? parsed : new Date(value);
  }
  return null;
};

// Split "a, b, c" on top-level commas only (respects quotes and nested parens).
const splitArgs = (input) => {
  const args = [];
  let depth = 0;
  let quote = null;
  let current = '';
  for (const ch of input) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; current += ch; continue; }
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) { args.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  if (current.trim()) args.push(current.trim());
  return args;
};

// A path key may itself contain dots we must not split on? The reference uses
// plain dots as separators and ':' inside a key (iba:loyalty:customer), so a
// simple dot split is correct.
const resolvePath = (path, context) => path.split('.').reduce(
  (value, key) => (value == null ? undefined : value[key]),
  context,
);

const isTruthy = (value) => {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'number') return value !== 0;
  return Boolean(value);
};

const stringify = (value) => {
  if (value == null || value === false) return '';
  if (value instanceof Date) return formatDate(value, 'dd/MM/yyyy');
  if (typeof value === 'object') return '';
  return String(value);
};

const FUNCTIONS = {
  format: (args) => {
    const date = toDate(args[0]);
    if (!date || !isValid(date)) return '';
    const pattern = args.length > 1 ? stringify(args[1]) : 'dd/MM/yyyy';
    try {
      return formatDate(date, translateDateFormat(pattern));
    } catch {
      return '';
    }
  },
  if: (args) => (isTruthy(args[0]) ? args[1] : args[2]),
  coalesce: (args) => args.find((value) => isTruthy(value)) ?? '',
  concat: (args) => args.map(stringify).join(''),
  upper: (args) => stringify(args[0]).toUpperCase(),
  lower: (args) => stringify(args[0]).toLowerCase(),
};

// Evaluate one expression body (no braces) and return its raw value.
export const evaluateExpression = (source, context) => {
  const expression = String(source).trim();
  if (!expression) return '';

  const quoted = expression.match(/^"([\s\S]*)"$/) || expression.match(/^'([\s\S]*)'$/);
  if (quoted) return quoted[1];

  if (/^-?\d+(\.\d+)?$/.test(expression)) return Number(expression);

  const call = expression.match(/^([A-Za-z_][\w]*)\s*\(([\s\S]*)\)$/);
  if (call) {
    const fn = FUNCTIONS[call[1].toLowerCase()];
    if (!fn) return '';
    const args = splitArgs(call[2]).map((arg) => evaluateExpression(arg, context));
    return fn(args);
  }

  const value = resolvePath(expression, context);
  return value === undefined ? '' : value;
};

// Replace every {expression} in a template string. HTML tags that a rich-text
// editor sprinkled *inside* an expression are stripped before parsing — the
// reference templates contain expressions split across <span> boundaries.
export const renderExpressions = (source, context = {}) => {
  if (!source) return '';
  let out = '';
  let i = 0;
  while (i < source.length) {
    if (source[i] !== '{') { out += source[i]; i += 1; continue; }
    // Legacy {{name}} placeholders are handled by the caller — copy them verbatim.
    if (source[i + 1] === '{') {
      const close = source.indexOf('}}', i);
      if (close === -1) { out += source.slice(i); break; }
      out += source.slice(i, close + 2);
      i = close + 2;
      continue;
    }
    let depth = 0;
    let end = -1;
    for (let j = i; j < source.length; j += 1) {
      if (source[j] === '{') depth += 1;
      else if (source[j] === '}') {
        depth -= 1;
        if (depth === 0) { end = j; break; }
      }
    }
    if (end === -1) { out += source.slice(i); break; }
    const body = source.slice(i + 1, end).replace(/<[^>]*>/g, '');
    out += stringify(evaluateExpression(body, context));
    i = end + 1;
  }
  return out;
};

// The context a text component is evaluated against, built from our receiptData.
// Key names follow the reference's `data.text` object so templates authored on
// either system resolve the same paths (docs/parity/receipt-template.md §7.5).
export const buildReceiptContext = (receiptData = {}) => {
  const customer = receiptData.customer || null;
  const outlet = receiptData.outlet || null;
  const invoiceNo = receiptData.invoiceNo
    || (receiptData.saleNumber ? String(receiptData.saleNumber).replace(/^#/, '') : '')
    || (receiptData.transactionId != null ? String(receiptData.transactionId) : '');

  return {
    invoiceNo,
    orderReference: receiptData.orderReference || '',
    completedAt: receiptData.completedAt || receiptData.date || null,
    currentTimestamp: new Date(),
    note: receiptData.note || '',
    inTrainingMode: receiptData.inTrainingMode ?? false,
    user: receiptData.user || (receiptData.salesPerson ? { name: receiptData.salesPerson } : { name: '' }),
    register: receiptData.register || null,
    outlet: outlet && {
      ...outlet,
      contact: outlet.contact || {
        phone: outlet.phone || '',
        email: outlet.email || '',
        website: outlet.website || '',
        addressStreet1: outlet.address || outlet.addressStreet1 || '',
        addressSuburb: outlet.suburb || outlet.addressSuburb || '',
        addressState: outlet.state || outlet.addressState || '',
        addressPostcode: outlet.postcode || outlet.addressPostcode || '',
      },
    },
    customer: customer && {
      ...customer,
      name: customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
    },
    sale: {
      ...receiptData,
      products: receiptData.items || [],
      metaData: receiptData.metaData || {},
    },
  };
};

// Sample sale used by the template editor's canvas, so authored expressions preview
// as resolved values ("Sales Person: Sample User") the way the reference's editor does
// instead of printing the raw {expression}.
export const sampleReceiptContext = () => buildReceiptContext({
  invoiceNo: '00000001',
  completedAt: new Date().toISOString(),
  note: 'Sample sale note',
  user: { name: 'Sample User' },
  register: { name: 'Register 1' },
  outlet: { name: 'Sample Outlet', phone: '00 0000 0000', address: '1 Sample St' },
  customer: { name: 'Sample Customer', invoiceMessage: 'Thanks for your business' },
  items: [{ name: 'Sample Product', quantity: 1, price: 10 }],
  total: 10,
});

export default renderExpressions;
