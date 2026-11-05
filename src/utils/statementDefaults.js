// Default statement template layout — mirrors the Shopfront reference default
// so a freshly created statement opens with a full design instead of a blank
// canvas. Components carry a `zone` ('header' | 'body' | 'footer') that the
// editor uses to place them under the labelled Header/Footer regions; the live
// StatementRenderer just renders them in array order (zone is ignored there).

import { borderToCss, normalizeBorder, BORDER_SIDES } from './receiptTemplateShape.js';
import { renderExpressions } from './receiptExpressions.js';

// The three seeded Text blocks' original wording. A Text block that is cleared
// and saved gets its default back (user request 05/11/2026).
export const DEFAULT_STATEMENT_TEXTS = {
  business: '<div style="text-align:right"><span style="font-size:17px"><strong>{businessName}</strong></span><br/>{businessAddress}<br/><br/>Ph: {businessPhone}<br/>{businessEmail}<br/><br/>ABN: {businessAbn}</div>',
  customer: '<div style="text-align:left">{customerCode}<br/>{customerCompany}<br/>{customerName}<br/><span style="color:#808080">{customerAddress}<br/>{customerCity}</span></div>',
  terms: '<div style="text-align:left">TERMS: Strictly 15 days of Statement.<br/><br/>____________________________<br/><br/><strong>Payment Details:</strong><br/><br/><strong>{businessName}</strong><br/>BSB: 000 000<br/>ACC: 0000 0000<br/><span style="font-size:10px">Thank you........</span></div>',
};

// Which default a Text block started from: its stored defaultText, or (for
// templates saved before defaultText existed) a guess from its content.
export const defaultTextFor = (props = {}) => {
  if (props.defaultText) return props.defaultText;
  const html = String(props.richTextContent || props.content || '');
  if (/\{business(Address|Phone|Abn|Email)\}|ABN:/.test(html) && !/Payment Details/i.test(html)) return DEFAULT_STATEMENT_TEXTS.business;
  if (/\{customer\w*\}|customer\./.test(html)) return DEFAULT_STATEMENT_TEXTS.customer;
  if (/Payment Details|TERMS:/i.test(html)) return DEFAULT_STATEMENT_TEXTS.terms;
  return '';
};

// True when rich text has no visible content (only tags, &nbsp; or spaces).
export const isBlankRichText = (html) => !String(html || '')
  .replace(/<img\b[^>]*>/gi, 'x').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

let seq = 0;
const uid = (t) => `${t}-${Date.now()}-${seq++}`;

// width:0 is the editor's AND StatementRenderer's "no border" signal (both key
// off border.width, not border.enabled) — width:1 here painted a spurious solid
// black box around every seeded component.
const noBorder = { enabled: false, width: 0, color: '#000000', style: 'solid' };
const noPad = { top: 0, right: 0, bottom: 0, left: 0 };

// Template variables usable in any Text component. The seeded customer address
// block uses these so the live statement prints real customer details instead
// of literal placeholder text. Resolves both the live API customer shape
// (firstName/company/billingStreet1/...) and the editor mock shape
// (code/name/contact/address/city).
const buildVariableMap = (customer = {}, business = {}) => {
  const join = (...parts) => parts.filter(Boolean).join(' ');
  return {
    // Reference: a customer with no code prints no code line (never the id).
    customerCode: customer.code ?? customer.customerCode ?? '',
    customerCompany: customer.company ?? '',
    customerName: customer.name || join(customer.firstName, customer.lastName),
    customerContact: customer.contact || join(customer.firstName, customer.lastName),
    customerAddress: customer.address || join(customer.billingStreet1, customer.billingStreet2),
    customerCity: customer.city || join(customer.billingSuburb, customer.billingPostcode, customer.billingState),
    // Outlet (business) details — live values come from the current outlet.
    // ponytail: the outlet has no ABN column, so {businessAbn} resolves to ''
    // live until one exists; empty beats printing a fake ABN.
    businessName: business.name || '',
    businessAddress: business.address || '',
    businessEmail: business.email || '',
    businessPhone: business.phone || '',
    businessAbn: business.abn || '',
  };
};

// Replaces {customerName}/{businessName} etc. Unknown tokens are left untouched
// so ordinary braces in a user's text survive. Reference: an empty field keeps
// its (blank) line, except blank lines at the very top of the block — no code
// starts the block at the company/name, an empty company leaves a gap below the
// code.
// Reference-style expressions ({IF(customer, customer.code, "")},
// {coalesce(customer.billing.addressStreet1, "")} ...) are evaluated with the
// receipt expression engine against this context. Paths follow the reference's
// names; both the live API customer and the editor mock shape resolve.
const buildExpressionContext = (customer, business = {}) => {
  const c = customer || null;
  const address = (prefix) => (c ? {
    addressStreet1: c[`${prefix}Street1`] || (prefix === 'billing' ? c.address : '') || '',
    addressStreet2: c[`${prefix}Street2`] || '',
    addressSuburb: c[`${prefix}Suburb`] || (prefix === 'billing' ? c.city : '') || '',
    addressPostcode: c[`${prefix}Postcode`] || '',
    addressState: c[`${prefix}State`] || '',
    addressCountry: c[`${prefix}Country`] || '',
  } : null);
  const vars = buildVariableMap(c || {}, business || {});
  return {
    customer: c ? {
      ...c,
      code: vars.customerCode,
      company: vars.customerCompany,
      name: vars.customerName,
      billing: address('billing'),
      delivery: address('delivery'),
    } : null,
    outlet: { ...business, abn: business?.abn || '' },
  };
};

// Only braces that look like an expression (a call or a dotted path) are
// evaluated, so ordinary braces and unknown {words} in a user's text survive.
const EXPRESSION_RE = /\{([^{}]*[(.][^{}]*)\}/g;

export const applyStatementVariables = (html, customer, business) => {
  if (!html) return html;
  const map = buildVariableMap(customer || {}, business || {});
  const context = buildExpressionContext(customer, business || {});
  return String(html)
    .replace(/\{(\w+)\}/g, (match, key) =>
      Object.prototype.hasOwnProperty.call(map, key) ? map[key] : match
    )
    .replace(EXPRESSION_RE, (match) => renderExpressions(match, context))
    .replace(/^((?:\s*<(?!br\b)[^>]*>)*)(?:\s*<br\s*\/?>)+/i, '$1')
    // An outlet with no phone / ABN would print a bare "Ph:" / "ABN:" caption.
    .replace(/(?:Ph|ABN):\s*(?=<br\s*\/?>|<\/)/g, '');
};

// Customer group credit terms are ISO 8601 durations (P15D, P30D, P2W, P1M,
// and with time parts per the reference article: P1DT12H, PT36H).
// Returns days (fractional when time parts are used), or null when invalid.
export const isoDurationDays = (value) => {
  const m = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?=\d)(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i
    .exec(String(value || '').trim());
  if (!m || !m.slice(1).some(Boolean)) return null;
  const [y, mo, w, d, h, mi, s] = m.slice(1).map((n) => parseInt(n || 0, 10));
  return y * 365 + mo * 30 + w * 7 + d + h / 24 + mi / 1440 + s / 86400;
};

// Credit Terms box (reference: one cell per group credit term — "0 days",
// "30 days" — with the balance due in it). Everything still owed at the
// statement's end (invoice balances, unused credit as a minus) goes in the
// longest term its age has reached; younger than every term → the first.
// No terms on the group → no box.
export const buildCreditTermBuckets = (creditTerms, activities = [], rangeEnd) => {
  const terms = (Array.isArray(creditTerms) ? creditTerms : [])
    .map((t) => ({ label: String(t?.label || '').trim(), days: isoDurationDays(t?.duration) }))
    .filter((t) => t.days != null)
    .sort((a, b) => a.days - b.days)
    .map((t) => ({ label: t.label || `${t.days} days`, days: t.days, amount: 0 }));
  if (!terms.length) return [];
  const end = new Date(rangeEnd || Date.now()).getTime();
  for (const row of activities || []) {
    const balance = parseFloat(row?.balance) || 0;
    if (!balance) continue;
    // Exact age (not floored) so an hour-based term like P1DT12H compares correctly;
    // for whole-day terms the result is the same as before.
    const age = (end - new Date(row.date).getTime()) / 86400000;
    const term = [...terms].reverse().find((t) => age >= t.days) || terms[0];
    term.amount += balance;
  }
  return terms.map((t) => ({ ...t, amount: Math.round(t.amount * 100) / 100 }));
};

// Activities table columns, reference order/widths. `Running Total` ships OFF.
// Widths mirror the reference header x-offsets (Date 398 / Activity 550 /
// Reference 779 / Total 918 / Balance 1000).
export const buildDefaultActionColumns = () => [
  { key: 'date', label: 'Date', enabled: true },
  // Reference statement heads this column "Type" (Invoice / Payment).
  { key: 'activity', label: 'Type', enabled: true },
  { key: 'reference', label: 'Reference', enabled: true },
  { key: 'total', label: 'Total', enabled: true },
  { key: 'balance', label: 'Balance', enabled: true },
  { key: 'runningTotal', label: 'Running Total', enabled: false },
];

// `number` is the reference's header-less invoice-number column; it rides with
// Type (not a column of its own in the settings).
export const ACTION_COLUMN_WIDTHS = {
  date: '15%', activity: '11%', number: '20%', reference: '28%', total: '13%', balance: '13%', runningTotal: '13%',
};

// Old templates were saved before the column config existed — fall back to the
// default order, and tolerate a partial/legacy list.
export const getActionColumns = (props = {}) =>
  Array.isArray(props.columns) && props.columns.length ? props.columns : buildDefaultActionColumns();

// The live statement's columns: the enabled ones, with the invoice numbers
// right after Type (reference: "Invoice  #0105749").
export const getPrintedActionColumns = (props = {}) =>
  getActionColumns(props)
    .filter((c) => c.enabled !== false)
    .flatMap((c) => (c.key === 'activity' ? [c, { key: 'number', label: '' }] : [c]));

export const buildDefaultStatementComponents = () => [
  // ---------- HEADER ----------
  {
    id: uid('columns'), type: 'columns', zone: 'header', visible: true,
    properties: {
      backgroundColor: '#ffffff', padding: { top: 8, right: 8, bottom: 8, left: 8 }, border: { ...noBorder },
      columnCount: 2, columnWidths: [50, 50],
      columns: [
        {
          id: uid('col'),
          components: [{
            id: uid('outlet_logo'), type: 'outlet_logo', visible: true,
            properties: { backgroundColor: '#ffffff', padding: { ...noPad }, border: { ...noBorder }, width: 'auto', height: 'auto', horizontalAlignment: 'flex-start', imageUrl: null },
          }],
        },
        {
          id: uid('col'),
          components: [{
            id: uid('text'), type: 'text', visible: true,
            properties: {
              backgroundColor: '#ffffff', padding: { ...noPad }, border: { ...noBorder },
              fontSize: 13, fontWeight: 'normal', textAlign: 'right',
              content: '{businessName}',
              // Reference: name (larger, bold), address, blank line, "Ph:" phone then
              // email, blank line, "ABN:" number.
              richTextContent: DEFAULT_STATEMENT_TEXTS.business,
              defaultText: DEFAULT_STATEMENT_TEXTS.business,
            },
          }],
        },
      ],
    },
  },
  // ---------- BODY ----------
  // Row 1: customer address block (left) | Overview aging (right).
  {
    id: uid('columns'), type: 'columns', zone: 'body', visible: true,
    properties: {
      backgroundColor: '#ffffff', padding: { ...noPad }, border: { ...noBorder },
      columnCount: 2, columnWidths: [50, 50],
      columns: [
        {
          id: uid('col'),
          components: [{
            id: uid('text'), type: 'text', visible: true,
            properties: {
              backgroundColor: '#ffffff', padding: { ...noPad }, border: { ...noBorder },
              fontSize: 13, fontWeight: 'normal', textAlign: 'left',
              content: '{customerName}',
              // Reference: code, company, name, then the address in grey. Empty
              // fields drop their line.
              richTextContent: DEFAULT_STATEMENT_TEXTS.customer,
              defaultText: DEFAULT_STATEMENT_TEXTS.customer,
            },
          }],
        },
        {
          id: uid('col'),
          components: [{
            // Reference default: one Credit Terms component — the group's terms box
            // ("0 days" / "30 days", only when the group has terms) over the date
            // range and Overdue / Current / Total Due box.
            id: uid('credit_terms'), type: 'credit_terms', visible: true,
            properties: { backgroundColor: '#ffffff', padding: { ...noPad }, border: { ...noBorder }, fontColor: '#000000', fontSize: 13, fontWeight: 'normal' },
          }],
        },
      ],
    },
  },
  {
    id: uid('spacer'), type: 'spacer', zone: 'body', visible: true,
    properties: { backgroundColor: '#ffffff', padding: { ...noPad }, border: { ...noBorder }, height: 30 },
  },
  {
    id: uid('actions'), type: 'actions', zone: 'body', visible: true,
    properties: {
      // Reference statement table is small and compact (approx 11px rows).
      backgroundColor: '#ffffff', padding: { ...noPad }, border: { ...noBorder }, fontSize: 11,
      showTotalDue: true, totalDueLabel: 'Total Due',
      labelPayment: 'Payment', labelInvoice: 'Invoice', labelPaidInStore: 'Paid In Store',
      columns: buildDefaultActionColumns(),
    },
  },
  // ---------- FOOTER ----------
  // Reference: a pale-green terms / payment-details block, left aligned.
  {
    id: uid('text'), type: 'text', zone: 'footer', visible: true,
    properties: {
      backgroundColor: '#c9f3a1', padding: { top: 8, right: 8, bottom: 8, left: 8 }, border: { ...noBorder },
      fontSize: 13, fontWeight: 'normal', textAlign: 'left',
      content: 'TERMS: Strictly 15 days of Statement.',
      richTextContent: DEFAULT_STATEMENT_TEXTS.terms,
              defaultText: DEFAULT_STATEMENT_TEXTS.terms,
    },
  },
];

// Bumped whenever the seeded default above changes shape. getTemplates() re-seeds
// any template the user never edited (no lastModified) so the reference layout
// reaches existing installs; edited templates are left exactly as saved.
export const DEFAULT_STATEMENT_SEED_VERSION = 7;

export const buildDefaultStatementConfig = () => ({
  components: buildDefaultStatementComponents(),
  canvas: { width: 210, padding: 10, fontFamily: 'Arial', fontSize: 12, backgroundColor: '#ffffff' },
});

// ---- borders -------------------------------------------------------------------
// The Border Settings dialog (shared with the receipt editor) stores a border PER
// SIDE: { top, right, bottom, left: { width, style, color } }. Templates saved before
// it carry ONE flat border { enabled, width, style, color }, which the printed
// statement read two ways: a Text block drew it only when `enabled` was set (width
// defaulting to 1); every other block drew it whenever width > 0 and ignored
// `enabled` (their old panels toggled the width only). Map a flat border onto that
// rule first, so a saved statement prints exactly the border it printed before.
export const statementBorder = (border, { legacyUsesEnabled = false } = {}) => {
  if (!border || typeof border !== 'object') return border;
  if (BORDER_SIDES.some((k) => border[k] && typeof border[k] === 'object')) return border;
  if (legacyUsesEnabled) {
    return border.enabled
      ? { ...border, enabled: true, width: Number(border.width) || 1 }
      : { ...border, enabled: false };
  }
  return { ...border, enabled: Number(border.width) > 0 };
};

// CSS (borderTop/Right/Bottom/Left) for either border shape — the editor canvas,
// the Settings preview, the preview dialog and the printed statement all use this.
export const statementBorderCss = (border, options) =>
  borderToCss(normalizeBorder(statementBorder(border, options)));
