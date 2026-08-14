// Default statement template layout — mirrors the Shopfront reference default
// so a freshly created statement opens with a full design instead of a blank
// canvas. Components carry a `zone` ('header' | 'body' | 'footer') that the
// editor uses to place them under the labelled Header/Footer regions; the live
// StatementRenderer just renders them in array order (zone is ignored there).

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
    customerCode: customer.code ?? customer.customerCode ?? (customer.id != null ? String(customer.id) : ''),
    customerName: customer.company || customer.name || join(customer.firstName, customer.lastName),
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
// so ordinary braces in a user's text survive.
export const applyStatementVariables = (html, customer, business) => {
  if (!html) return html;
  const map = buildVariableMap(customer || {}, business || {});
  return String(html).replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(map, key) ? map[key] : match
  );
};

// Reference: statement activities list under aging category headings. Split on
// the same 30-day boundary the backend summary uses for overdue vs current.
// ponytail: two buckets only — the statement endpoint exposes no finer aging.
export const groupActivitiesByAge = (activities = [], rangeEnd = new Date()) => {
  const cutoff = new Date(rangeEnd).getTime() - 30 * 24 * 60 * 60 * 1000;
  const older = activities.filter((a) => new Date(a.date).getTime() < cutoff);
  const current = activities.filter((a) => new Date(a.date).getTime() >= cutoff);
  return [
    ...(older.length ? [{ category: '30 days', transactions: older }] : []),
    ...(current.length ? [{ category: 'Current', transactions: current }] : []),
  ];
};

// Activities table columns, reference order/widths. `Running Total` ships OFF.
// Widths mirror the reference header x-offsets (Date 398 / Activity 550 /
// Reference 779 / Total 918 / Balance 1000).
export const buildDefaultActionColumns = () => [
  { key: 'date', label: 'Date', enabled: true },
  { key: 'activity', label: 'Activity', enabled: true },
  { key: 'reference', label: 'Reference', enabled: true },
  { key: 'total', label: 'Total', enabled: true },
  { key: 'balance', label: 'Balance', enabled: true },
  { key: 'runningTotal', label: 'Running Total', enabled: false },
];

export const ACTION_COLUMN_WIDTHS = {
  date: '23%', activity: '35%', reference: '21%', total: '13%', balance: '8%', runningTotal: '13%',
};

// Old templates were saved before the column config existed — fall back to the
// default order, and tolerate a partial/legacy list.
export const getActionColumns = (props = {}) =>
  Array.isArray(props.columns) && props.columns.length ? props.columns : buildDefaultActionColumns();

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
              fontSize: 12, fontWeight: 'normal', textAlign: 'right',
              content: '{businessName}',
              // Reference: blank line after the address block and before the ABN.
              richTextContent: '<div style="text-align:right"><strong>{businessName}</strong><br/>{businessAddress}<br/><br/>{businessEmail}<br/>{businessPhone}<br/><br/>{businessAbn}</div>',
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
              fontSize: 12, fontWeight: 'normal', textAlign: 'left',
              content: '{customerName}',
              richTextContent: '<div style="text-align:left">{customerCode}<br/>{customerName}<br/>{customerContact}<br/>{customerAddress}<br/>{customerCity}</div>',
            },
          }],
        },
        {
          id: uid('col'),
          components: [{
            id: uid('overview'), type: 'overview', visible: true,
            properties: { backgroundColor: '#ffffff', padding: { ...noPad }, border: { ...noBorder }, fontColor: '#000000', fontSize: 16, fontWeight: 'normal', showDays0: true, showDays30: true, showDateRange: true, showTotals: true },
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
      backgroundColor: '#ffffff', padding: { ...noPad }, border: { ...noBorder }, fontSize: 14,
      showTotalDue: true, totalDueLabel: 'Total Due',
      labelPayment: 'Payment', labelInvoice: 'Invoice', labelPaidInStore: 'Paid in Store',
      columns: buildDefaultActionColumns(),
    },
  },
  // ---------- FOOTER ----------
  {
    id: uid('text'), type: 'text', zone: 'footer', visible: true,
    properties: {
      backgroundColor: '#ffffff', padding: { top: 8, right: 8, bottom: 8, left: 8 }, border: { ...noBorder },
      fontSize: 14, fontWeight: 'bold', textAlign: 'center',
      content: 'Test Customer Invoice Message',
      richTextContent: '<div style="text-align:center"><strong>Test Customer Invoice Message</strong></div>',
    },
  },
];

export const buildDefaultStatementConfig = () => ({
  components: buildDefaultStatementComponents(),
  canvas: { width: 210, padding: 10, fontFamily: 'Arial', fontSize: 12, backgroundColor: '#ffffff' },
});
