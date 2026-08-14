// Converts receipt-template components between the reference's storage shape
// ({type, style, value}) and the editor's working shape ({type, properties}).
//
// Storage is ALWAYS the reference shape — that is what ReceiptRenderer renders and
// what the sale receipt is generated from. The editor keeps its own vocabulary, so
// it converts on load and converts back on save. Anything the editor cannot express
// (per-side borders, custom column labels the panels don't surface) survives a
// round trip because the untouched original is carried along in `properties.__ref`.
//
// Reference vocabulary measured on topdrops 2026-08-05 —
// docs/parity/receipt-template.md §3, §6.

const TYPE_TO_REFERENCE = {
  header: 'heading',
  outlet_logo: 'img',
  logo: 'img',
  products: 'product',
  items: 'product',
  totals: 'total',
  payments: 'payment',
  indicator: 'tax_indicator',
  columns: 'column',
  external_receipt: 'eftpos',
  tax: 'tax',
  loyalty: 'loyalty',
  account: 'account',
  surcharge: 'surcharge',
  // The reference registry key is `giftCards` (measured 2026-08-07). Writing
  // `gift_cards` rewrote a reference-authored block to a key the registry does not
  // contain; both spellings are read back (TYPE_TO_EDITOR) and rendered.
  gift_cards: 'giftCards',
  text: 'text',
  image: 'image',
  spacer: 'spacer',
  barcode: 'barcode',
};

const TYPE_TO_EDITOR = {
  heading: 'header',
  img: 'outlet_logo',
  product: 'products',
  total: 'totals',
  payment: 'payments',
  tax_indicator: 'indicator',
  column: 'columns',
  eftpos: 'external_receipt',
  // The reference registry key is `giftCards` (measured 2026-08-07); we store
  // `gift_cards`. Without this alias a reference-authored gift-card block kept its
  // camelCase type, so no Settings panel matched it and no renderer drew it.
  giftCards: 'gift_cards',
};

// Column key <-> editor field label, per component type.
// Exported so the editor's shared fields table can seed a block that has no columns
// yet with exactly the reference's column set for that type.
export const COLUMN_LABELS = {
  product: {
    qty: 'Qty',
    product: 'Product',
    'case-qty': 'Case Qty',
    'item-price': 'Item Price',
    discount: 'Discount',
    price: 'Price',
    'case-price': 'Case Price',
    'total-items': 'Total Items',
    'normal-price': 'Normal Price',
    savings: 'Savings',
  },
  total: { rounding: 'Rounding', savings: 'Savings', discount: 'Discount', sale: 'Total', change: 'Change' },
  tax: { tax: 'Tax', total: 'Total' },
  payment: { payment: 'Payments', amount: 'Amount' },
  account: {
    'start-balance': 'Start balance',
    'end-balance': 'End balance',
    'changed-balance': 'Balance changed',
    'current-balance': 'Current Balance',
  },
  loyalty: {
    'current-loyalty': 'Current Points',
    earned: 'Earned',
    spent: 'Spent',
    'before-sale': 'Before sale',
    'after-sale': 'After sale',
  },
  gift_cards: { original: 'Original', used: 'Amount Used', current: 'Current', expiry: 'Expiry' },
};
// Both spellings of the gift-card key must resolve: storage/reference uses `giftCards`
// (measured 2026-08-07), the editor panel reads `COLUMN_LABELS.gift_cards`. Without
// this a reference-authored block lost its label fallbacks and showed raw column keys.
COLUMN_LABELS.giftCards = COLUMN_LABELS.gift_cards;

// Measured 2026-08-07: every component type offers an exact style whitelist. This
// adapter used to write color/background/fontSize/fontWeight for EVERY type, so a
// component whose panel has no such control (eftpos, spacer, barcode, columns, text)
// still baked the editor's defaults into storage and the renderer painted them — the
// EFT slip printed in a grey 10px box no control could turn off. Only keys we would
// ADD are gated; anything already stored on the component survives untouched.
const FONT_STYLE_TYPES = new Set([
  'heading', 'product', 'tax', 'tax_indicator', 'payment', 'surcharge',
  'loyalty', 'account', 'total', 'giftCards', 'gift_cards', 'invoice',
]);
// background: the font-style types plus text / logo / image. `column` is measured as
// padding+border only, but our Columns panel's background control works and merchants
// may rely on it — flagged in the panel audit rather than removed.
const BACKGROUND_STYLE_TYPES = new Set([...FONT_STYLE_TYPES, 'text', 'img', 'logo', 'image', 'column']);
const TEXT_ALIGN_TYPES = new Set(['heading', 'eftpos']);

// Is this template a WIDE (non-thermal) page — A4 or Email — rather than a thermal
// receipt roll? Single source of truth for the renderer, the print page setup and the
// editor canvas, which each carried their own literal list.
// ponytail: substring match, not an exact list — the stored type strings differ by
// source ('A4 Receipt', 'A4', 'Email Receipt', 'Email'), and the old
// `type === 'email'` test missed the 'Email Receipt' the type dropdown actually saves.
export const isWideTemplate = (template) =>
  /a4|email/.test(String(template?.type || '').toLowerCase());

// Is this a Generic / Text Only (reference `receipt-text`) template? That is the only
// type whose Configure dialog offers Receipt Width instead of paper padding.
export const isTextOnlyTemplate = (template) =>
  /text/.test(String(template?.type || '').toLowerCase());

// Is this an Email template? Only type whose Configure dialog carries attachments.
export const isEmailTemplate = (template) =>
  /email/.test(String(template?.type || '').toLowerCase());

// Measured: a new attachment row starts with this name and an empty template.
export const DEFAULT_ATTACHMENT_NAME = '{outlet.name} Invoice #{invoiceNo}';

// Configure-dialog save rules, measured from the reference bundle 2026-08-07:
//  - receiptWidth is parseFloat'd; NaN -> abort with a toast (never saved as NaN)
//  - an empty width stores 40 (the reference persists `receiptWidth ?? 40`)
//  - a blank attachment name -> abort with a toast
//  - attachments persist for EMAIL templates only, null for every other type
// Pure so both callers (list page Configure, editor gear) share ONE rule set and the
// .mjs test can reach it. Returns { error } or { config }.
// ponytail: the width rule only runs for text-only templates — that is the only type
// whose dialog HAS the input, so running it elsewhere would turn an unset width into
// 40mm paper for every normal receipt.
export const applyReceiptConfig = (config, { template, padding, receiptWidth, attachments }) => {
  const next = { ...(config || {}) };

  if (isTextOnlyTemplate(template)) {
    const raw = receiptWidth == null ? '' : String(receiptWidth).trim();
    if (raw === '') {
      next.receiptWidth = 40;
    } else {
      const width = parseFloat(raw);
      if (Number.isNaN(width)) return { error: 'Please specify a valid receipt width' };
      next.receiptWidth = width;
    }
  } else {
    const p = padding || {};
    next.padding = {
      top: Number(p.top) || 0,
      left: Number(p.left) || 0,
      right: Number(p.right) || 0,
      bottom: Number(p.bottom) || 0,
    };
  }

  if (isEmailTemplate(template)) {
    const cleaned = (attachments || []).map((a) => ({
      name: (a.name || '').trim(),
      receiptTemplateId: a.receiptTemplateId || '',
    }));
    if (cleaned.some((a) => !a.name)) return { error: 'Please specify a valid attachment name' };
    // Measured lines 50-53 enumerate the save aborts exhaustively: invalid width and
    // blank attachment name, nothing else. Two extra guards used to live here ("select
    // an A4 receipt for every attachment", "not the same one twice") — both invented,
    // and the first made Add Attachment → Confirm impossible for a tenant with no A4
    // template at all, since a new row is measured to start with an EMPTY template.
    next.attachments = cleaned;
  } else {
    next.attachments = null;
  }

  return { config: next };
};

// Paper metrics for the reference-shape render path.
// The reference keeps `receiptWidth` / `padding` on the template RECORD; our records
// nest them under `config` — that is where the Configure dialog writes them. Reading
// only the top level meant every width and padding a merchant set was ignored.
// `receiptWidth` 0 means "unset" in the reference (its four stock templates hold 0).
// The merchant's explicit paper width in mm, or 0 when unset. Single source of truth:
// the renderer (both shapes), the print page setup and the editor canvas all size off
// this, so a width set in Configure can no longer be honoured by one path and ignored
// by the next.
// Measured 2026-08-07: the `test` template holds `receiptWidth: 40` and the reference
// renders its paper at 304px = 80mm + the 1px border each side — i.e. the DEFAULT paper,
// not 40mm (151px). 40 is what the reference stores for an empty width (`receiptWidth ?? 40`,
// measured L51), so it means "unset". Anything else is UNMEASURED; we keep reading it as mm.
export const REFERENCE_UNSET_RECEIPT_WIDTH = 40;

export const paperWidthMm = (template) => {
  const width = Number(template?.receiptWidth ?? template?.config?.receiptWidth);
  return width > 0 && width !== REFERENCE_UNSET_RECEIPT_WIDTH ? width : 0;
};

export const paperSettings = (template) => {
  const config = template?.config || {};
  const width = paperWidthMm(template);
  return {
    width: width
      ? `${width}mm`
      // Same wide/thermal test as the print page setup and the editor canvas — a
      // literal 'a4' check here made an 'Email Receipt' print a 270px strip on an
      // A4 page (@page size comes from isWideTemplate).
      : isWideTemplate(template) ? '210mm' : '270px',
    padding: template?.padding || config.padding || {},
  };
};

const WHITE = '#FFFFFF';
const noSide = { borderColor: WHITE, borderStyle: 'none', borderWidth: 0 };

const referenceBorderToEditor = (border = {}) => {
  const side = [border.top, border.bottom, border.left, border.right]
    .find((s) => s && s.borderStyle && s.borderStyle !== 'none' && Number(s.borderWidth));
  return side
    ? { enabled: true, color: side.borderColor, style: side.borderStyle, width: Number(side.borderWidth) }
    : { enabled: false, color: '#000000', style: 'solid', width: 1 };
};

const editorBorderToReference = (border = {}, previous) => {
  // `enabled: false` means no border even though the panel still carries a width —
  // without this every unbordered block came back from the editor fully boxed.
  if (border.enabled === false) {
    return previous && Object.values(previous).some((s) => s?.borderStyle && s.borderStyle !== 'none')
      ? previous
      : { top: noSide, left: noSide, right: noSide, bottom: noSide };
  }
  if (!border.enabled && !(border.width > 0)) return previous || { top: noSide, left: noSide, right: noSide, bottom: noSide };
  // The editor only exposes one border for the whole box; keep the reference's
  // per-side arrangement when it already had one, otherwise box the component.
  if (previous && Object.values(previous).some((s) => s?.borderStyle && s.borderStyle !== 'none')) return previous;
  const side = { borderColor: border.color || '#000000ff', borderStyle: border.style || 'solid', borderWidth: String(border.width || 1) };
  return { top: side, left: side, right: side, bottom: side };
};

const emptyPadding = { top: '', left: '', right: '', bottom: '' };
const paddingToEditor = (padding = {}) => ({
  top: Number(padding.top) || 0,
  left: Number(padding.left) || 0,
  right: Number(padding.right) || 0,
  bottom: Number(padding.bottom) || 0,
});
const paddingToReference = (padding = {}) => ({
  top: padding.top ? String(padding.top) : '',
  left: padding.left ? String(padding.left) : '',
  right: padding.right ? String(padding.right) : '',
  bottom: padding.bottom ? String(padding.bottom) : '',
});

// ---------------------------------------------------------------- to editor

export const toEditorComponent = (component, index = 0) => {
  if (!component) return component;
  if (component.properties) return component; // already the editor shape
  const { type, style = {}, value } = component;
  const editorType = TYPE_TO_EDITOR[type] || type;
  const labels = COLUMN_LABELS[type] || {};

  const properties = {
    __ref: component,
    fontColor: style.color || '#000000',
    backgroundColor: style.background || WHITE,
    fontSize: style.fontSize ? Number(style.fontSize) : 11,
    fontWeight: style.fontWeight || 'normal',
    textAlign: style.textAlign || 'left',
    padding: paddingToEditor(style.padding),
    margin: { top: 0, left: 0, right: 0, bottom: 0 },
    border: referenceBorderToEditor(style.border),
  };

  if (Array.isArray(value?.columns)) {
    properties.fields = value.columns.map((column, order) => ({
      key: column.column,
      name: column.name || labels[column.column] || column.column,
      enabled: column.enabled === true,
      order: order + 1,
    }));
  }

  switch (type) {
    case 'heading':
      properties.completedSale = value?.completed || '';
      properties.parkedSale = value?.parked || '';
      break;
    case 'text':
      properties.richTextContent = typeof value === 'string' ? value : '';
      break;
    case 'spacer':
      // Measured default is 100 (2026-08-07). `Number(value) || 3` turned a stored 0
      // into 3 and an unset spacer into 3 — neither is a value the reference produces.
      properties.height = Number.isFinite(Number(value)) && String(value).trim() !== '' ? Number(value) : 100;
      break;
    case 'img':
    case 'image':
      properties.imageUrl = style.image || '';
      properties.width = style.width || 'auto';
      properties.height = style.height || 'auto';
      properties.horizontalAlignment = style.horizAlign || 'center';
      break;
    case 'tax_indicator':
      properties.indicator = value?.indicator || '*';
      properties.text = value?.text || 'Indicates items with';
      properties.tax = value?.tax || '';
      break;
    case 'product':
      properties.showProductNote = value?.showProductNote === true;
      properties.showDiscountReason = value?.showDiscountReason === true;
      break;
    case 'column':
      properties.columns = (value || []).map((cell, cellIndex) => ({
        id: `col-${index}-${cellIndex}`,
        width: cell.width,
        components: (cell.components || []).map((child, childIndex) => toEditorComponent(child, childIndex)),
      }));
      // The Column Widths panel edits percentages; seed it from the stored fractions
      // so a saved template opens with its real widths instead of a blank panel.
      properties.columnWidths = (value || []).map((cell) => Math.round((Number(cell.width) || 0) * 100));
      break;
    case 'barcode':
      properties.barcodeValue = typeof value === 'string' ? value : '';
      break;
    default:
      break;
  }

  return { id: component.id || `component-${index}-${editorType}`, type: editorType, visible: true, properties };
};

export const toEditorComponents = (components = []) => components.map(toEditorComponent);

// ------------------------------------------------------------- to reference

export const toReferenceComponent = (component) => {
  if (!component) return component;
  if (!component.properties) return component; // already the reference shape
  const props = component.properties || {};
  const previous = props.__ref || {};
  const type = TYPE_TO_REFERENCE[component.type] || previous.type || component.type;
  const labels = COLUMN_LABELS[type] || {};
  const previousStyle = previous.style || {};

  const style = {
    ...previousStyle,
    padding: props.padding ? paddingToReference(props.padding) : (previousStyle.padding || emptyPadding),
    border: editorBorderToReference(props.border, previousStyle.border),
  };
  if (FONT_STYLE_TYPES.has(type)) {
    style.color = props.fontColor || previousStyle.color || '#000000';
    style.fontSize = props.fontSize != null ? String(props.fontSize) : previousStyle.fontSize;
    style.fontWeight = props.fontWeight || previousStyle.fontWeight || 'normal';
  }
  if (BACKGROUND_STYLE_TYPES.has(type)) {
    style.background = props.backgroundColor || previousStyle.background || WHITE;
  }
  if (props.textAlign && TEXT_ALIGN_TYPES.has(type)) style.textAlign = props.textAlign;

  let value = previous.value;

  // A component dropped from the palette has no `__ref` and no `fields` yet (its
  // defaults use type-specific keys like `taxItems`), so it used to save as
  // `value: ''` — a Tax/Totals/Payments block that rendered nothing at all. Seed the
  // reference's own column set, all enabled, so a freshly added block prints.
  if (!previous.value && !Array.isArray(props.fields) && labels && Object.keys(labels).length) {
    value = { columns: Object.entries(labels).map(([column, name]) => ({ column, name, enabled: true })) };
  }

  if (Array.isArray(props.fields) && labels && Object.keys(labels).length) {
    // The editor's fields list IS the column list: its ORDER, names and enabled flags
    // all persist. It used to be replayed onto the stored order, which made the
    // panel's reorder arrows do nothing on save.
    const previousColumns = previous.value?.columns
      || Object.entries(labels).map(([column, name]) => ({ column, name, enabled: false }));
    const byColumn = new Map(previousColumns.map((column) => [column.column, column]));
    const byLabel = new Map(previousColumns.map((column) => [column.name, column]));
    const columns = props.fields.map((field) => {
      const key = field.key || field.column;
      const stored = byColumn.get(key) || byLabel.get(field.name) || {};
      return {
        ...stored,
        column: stored.column || key,
        name: field.name || stored.name || labels[key] || key,
        enabled: field.enabled === true,
      };
    }).filter((column) => column.column);
    // Any stored column the editor never surfaced stays, so an unknown column is not
    // silently dropped by a round trip.
    const seen = new Set(columns.map((column) => column.column));
    previousColumns.forEach((column) => { if (!seen.has(column.column)) columns.push(column); });
    value = { ...(previous.value || {}), columns };
  }

  switch (type) {
    case 'heading':
      value = { completed: props.completedSale ?? previous.value?.completed ?? '', parked: props.parkedSale ?? previous.value?.parked ?? '' };
      break;
    case 'text':
      value = props.richTextContent ?? props.content ?? previous.value ?? '';
      break;
    case 'spacer':
      value = String(props.height ?? previous.value ?? 100);
      break;
    case 'img':
    case 'image':
      style.image = props.imageUrl ?? previousStyle.image ?? '';
      style.width = props.width || previousStyle.width || 'auto';
      style.height = props.height || previousStyle.height || 'auto';
      style.horizAlign = props.horizontalAlignment || previousStyle.horizAlign || 'center';
      value = previous.value ?? '';
      break;
    case 'tax_indicator':
      value = {
        indicator: props.indicator ?? previous.value?.indicator ?? '*',
        text: props.text ?? previous.value?.text ?? 'Indicates items with',
        tax: props.tax ?? previous.value?.tax ?? '',
      };
      break;
    case 'product':
      value = {
        ...(value || {}),
        showProductNote: props.showProductNote === true,
        showDiscountReason: props.showDiscountReason === true,
      };
      break;
    case 'column': {
      // Reference stores each cell width as a FRACTION (renderColumn multiplies by
      // 100); the editor works in percentages via `columnWidths`. Without the
      // conversion a fresh Columns component saved width undefined -> 0% wide, so
      // everything inside it vanished from the printed receipt.
      const cells = props.columns || [];
      const equalShare = cells.length ? 100 / cells.length : 100;
      value = cells.map((cell, cellIndex) => {
        const percent = props.columnWidths?.[cellIndex]
          ?? (cell.width > 1 ? cell.width : cell.width != null ? cell.width * 100 : equalShare);
        return {
          width: (Number(percent) || equalShare) / 100,
          components: (cell.components || []).map((child, childIndex) => toReferenceComponent(child, childIndex)),
        };
      });
      break;
    }
    case 'barcode':
      value = props.barcodeValue ?? previous.value ?? '';
      break;
    case 'eftpos':
      // Measured default is `value: null` (2026-08-07); the generic branch below
      // stored '' for a freshly dragged External Receipt.
      value = previous.value ?? null;
      break;
    default:
      if (value === undefined) value = '';
      break;
  }

  return { type, style, value };
};

export const toReferenceComponents = (components = []) => components.map(toReferenceComponent);

export default { toEditorComponents, toReferenceComponents };
