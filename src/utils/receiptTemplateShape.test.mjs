// node src/utils/receiptTemplateShape.test.mjs
import assert from 'node:assert/strict';
import { toEditorComponents, toReferenceComponents, toReferenceComponent, isWideTemplate, isTextOnlyTemplate, paperSettings, paperWidthMm, applyReceiptConfig, isEmailTemplate, DEFAULT_ATTACHMENT_NAME } from './receiptTemplateShape.js';
import { buildReceiptPrintHtml } from './receiptPrintHtml.js';

const solid = { borderColor: '#000000ff', borderStyle: 'solid', borderWidth: '1' };
const none = { borderColor: '#FFFFFF', borderStyle: 'none', borderWidth: 0 };

const reference = [
  {
    type: 'heading',
    style: { color: '#000000', background: '#FFFFFF', fontSize: '11', fontWeight: 'bold', textAlign: 'center', padding: { top: '', left: '', right: '', bottom: '' }, border: { top: solid, left: none, right: none, bottom: solid } },
    value: { completed: 'Tax Invoice', parked: 'Parked Sale' },
  },
  {
    type: 'product',
    style: { color: '#000000', background: '#FFFFFF', fontSize: '11', fontWeight: 'normal', padding: { top: '', left: '', right: '', bottom: '' }, border: { top: none, left: none, right: none, bottom: none } },
    value: {
      showProductNote: true,
      showDiscountReason: true,
      columns: [
        { column: 'qty', name: 'Qty', enabled: true },
        { column: 'product', name: 'Product', enabled: true },
        { column: 'price', name: 'Total', enabled: true },
        { column: 'savings', name: 'Savings', enabled: false },
      ],
    },
  },
  { type: 'spacer', style: {}, value: '3' },
  { type: 'text', style: { background: '#FFFFFF' }, value: '<p>Inv No #{invoiceNo}</p>' },
];

// round trip is lossless for everything the editor doesn't touch
const roundTripped = toReferenceComponents(toEditorComponents(reference));
assert.deepEqual(roundTripped[0].value, reference[0].value);
assert.deepEqual(roundTripped[0].style.border, reference[0].style.border, 'per-side borders survive');
assert.deepEqual(roundTripped[1].value.columns, reference[1].value.columns, 'column keys, custom names and flags survive');
assert.equal(roundTripped[2].value, '3');
assert.equal(roundTripped[3].value, '<p>Inv No #{invoiceNo}</p>');

// the editor sees its own vocabulary
const editor = toEditorComponents(reference);
assert.equal(editor[0].type, 'header');
assert.equal(editor[0].properties.completedSale, 'Tax Invoice');
assert.equal(editor[0].properties.border.enabled, true);
assert.equal(editor[1].type, 'products');
assert.equal(editor[1].properties.fields.find((f) => f.key === 'price').name, 'Total');
assert.equal(editor[1].properties.fields.find((f) => f.key === 'savings').enabled, false);

// an edit in the editor lands back in the reference shape
editor[1].properties.fields.find((f) => f.key === 'savings').enabled = true;
editor[0].properties.completedSale = 'Receipt';
const saved = toReferenceComponents(editor);
assert.equal(saved[1].value.columns.find((c) => c.column === 'savings').enabled, true);
assert.equal(saved[0].value.completed, 'Receipt');

// a component freshly dragged from the palette (no __ref) still converts
const fresh = toReferenceComponents([
  { id: 'x', type: 'payments', properties: { fontSize: 11, fontColor: '#000000', fields: [{ name: 'Payments', enabled: true }, { name: 'Amount', enabled: true }] } },
]);
assert.equal(fresh[0].type, 'payment');
assert.equal(fresh[0].value.columns.find((c) => c.column === 'payment').enabled, true);

// A component dropped fresh from the palette (no __ref, no fields) must save with the
// reference's column set enabled — it used to save value:'' and print nothing.
const freshTax = toReferenceComponent({ type: 'tax', properties: { title: 'Tax', taxItems: [] } });
assert.deepEqual(freshTax.value.columns.map((c) => c.column), ['tax', 'total']);
assert.ok(freshTax.value.columns.every((c) => c.enabled));

const freshTotals = toReferenceComponent({ type: 'totals', properties: {} });
assert.ok(freshTotals.value.columns.length > 0);
assert.ok(freshTotals.value.columns.every((c) => c.enabled));

console.log('receiptTemplateShape: all assertions passed');

// Wide (non-thermal) detection drives "Receipt preview unsupported" in the on-screen
// preview panes and the A4 page setup at print time. 'Email Receipt' is what the type
// dropdown saves — the old `type === 'email'` test missed it and the template got
// shrunk into the thermal preview box instead.
assert.equal(isWideTemplate({ type: 'A4 Receipt' }), true);
assert.equal(isWideTemplate({ type: 'A4' }), true);
assert.equal(isWideTemplate({ type: 'Email Receipt' }), true);
assert.equal(isWideTemplate({ type: 'Email' }), true);
assert.equal(isWideTemplate({ type: 'Normal Receipt' }), false);
assert.equal(isWideTemplate({ type: 'Generic / Text Only Receipt' }), false);
assert.equal(isWideTemplate({}), false);
assert.equal(isWideTemplate(null), false);

// Only the Generic / Text Only type swaps paper padding for a Receipt Width input.
assert.equal(isTextOnlyTemplate({ type: 'Generic / Text Only Receipt' }), true);
assert.equal(isTextOnlyTemplate({ type: 'receipt-text' }), true);
assert.equal(isTextOnlyTemplate({ type: 'Normal Receipt' }), false);
assert.equal(isTextOnlyTemplate({ type: 'A4 Receipt' }), false);

// Paper metrics: the Configure dialog writes receiptWidth/padding into `config`, so
// reading only the top level (what ReceiptRenderer used to do) ignored both.
// 40 is the reference's stored value for an EMPTY width, and the reference renders the
// template that holds it (`test`) at 304px = the default 80mm paper, not 40mm.
assert.equal(paperSettings({ type: 'Generic / Text Only Receipt', config: { receiptWidth: 40 } }).width, '270px');
assert.equal(paperSettings({ type: 'Normal Receipt', receiptWidth: 58 }).width, '58mm');
// The reference's four stock templates hold receiptWidth 0 — that means "unset".
assert.equal(paperSettings({ type: 'Normal Receipt', config: { receiptWidth: 0 } }).width, '270px');
assert.equal(paperSettings({ type: 'A4 Receipt', config: {} }).width, '210mm');
// Every wide type gets the wide paper: print emits @page A4 off isWideTemplate, so an
// 'Email Receipt' rendering at 270px printed a thermal strip on an A4 sheet.
assert.equal(paperSettings({ type: 'Email Receipt', config: {} }).width, '210mm');
assert.equal(paperSettings({}).width, '270px');
assert.deepEqual(paperSettings({ config: { padding: { top: 5, left: 6, right: 7, bottom: 8 } } }).padding, { top: 5, left: 6, right: 7, bottom: 8 });
assert.deepEqual(paperSettings({ padding: { top: 1 }, config: { padding: { top: 9 } } }).padding, { top: 1 }, 'record-level padding still wins');
assert.deepEqual(paperSettings(null).padding, {});

// paperWidthMm is the shared paper width every path sizes off (renderer for BOTH
// component shapes, print page setup, editor canvas). 0 = unset.
// 40 = the reference's "empty width" value; measured to render at the default paper.
assert.equal(paperWidthMm({ config: { receiptWidth: 40 } }), 0);
assert.equal(paperWidthMm({ receiptWidth: 58 }), 58);
assert.equal(paperWidthMm({ config: { receiptWidth: 0 } }), 0);
assert.equal(paperWidthMm({}), 0);
assert.equal(paperWidthMm(null), 0);

// The PRINT page must be the same paper as the rendered box: an explicit width used to
// print a narrow strip centred on an 80mm (or A4) page.
const printed = buildReceiptPrintHtml({ markup: '', template: { type: 'Generic / Text Only Receipt', config: { receiptWidth: 57.5, canvas: { width: 80 } } } });
assert.match(printed, /@page \{ size: 57\.5mm auto;/);
assert.match(printed, /body \{ width: 57\.5mm; \}/);
// ...and 40 (the reference's empty-width value) falls back to the canvas paper.
assert.match(buildReceiptPrintHtml({ markup: '', template: { type: 'Generic / Text Only Receipt', config: { receiptWidth: 40, canvas: { width: 80 } } } }), /@page \{ size: 80mm auto;/);
// Unset width keeps the old behaviour: canvas width for thermal, A4 for wide.
assert.match(buildReceiptPrintHtml({ markup: '', template: { type: 'Normal Receipt', config: { canvas: { width: 58 } } } }), /@page \{ size: 58mm auto;/);
assert.match(buildReceiptPrintHtml({ markup: '', template: { type: 'Email Receipt', config: {} } }), /@page \{ size: A4;/);

// --- Configure dialog save rules, measured 2026-08-07 -----------------------------
// Both entry points (list Configure, editor gear) run through applyReceiptConfig.
const TEXT = { type: 'Generic / Text Only Receipt' };
const EMAIL = { type: 'Email Receipt' };
const NORMAL = { type: 'Normal Receipt' };

// Empty width stores 40 (the reference persists `receiptWidth ?? 40`).
assert.equal(applyReceiptConfig({}, { template: TEXT, receiptWidth: '' }).config.receiptWidth, 40);
assert.equal(applyReceiptConfig({}, { template: TEXT, receiptWidth: null }).config.receiptWidth, 40);
// Parsed as a float, not an int.
assert.equal(applyReceiptConfig({}, { template: TEXT, receiptWidth: '57.5' }).config.receiptWidth, 57.5);
assert.equal(applyReceiptConfig({}, { template: TEXT, receiptWidth: '0' }).config.receiptWidth, 0);
// Invalid width ABORTS the save — nothing is written, not even a NaN.
const badWidth = applyReceiptConfig({ receiptWidth: 40 }, { template: TEXT, receiptWidth: 'abc' });
assert.equal(badWidth.error, 'Please specify a valid receipt width');
assert.equal(badWidth.config, undefined, 'aborted save returns no config');
// Text-only has no padding block, so it must never write padding...
assert.equal(applyReceiptConfig({}, { template: TEXT, receiptWidth: '40' }).config.padding, undefined);
// ...and every other type writes padding and leaves the width alone (an unset width
// must not become 40mm paper for a normal receipt).
const padded = applyReceiptConfig({}, { template: NORMAL, padding: { top: 1, left: '2', right: 3, bottom: '' } }).config;
assert.deepEqual(padded.padding, { top: 1, left: 2, right: 3, bottom: 0 });
assert.equal(padded.receiptWidth, undefined);

// A blank attachment name ABORTS the save.
const blankName = applyReceiptConfig({}, { template: EMAIL, attachments: [{ name: '  ', receiptTemplateId: 'a4' }] });
assert.equal(blankName.error, 'Please specify a valid attachment name');
assert.equal(blankName.config, undefined);
// Attachments persist for EMAIL only, null for every other type.
assert.deepEqual(
  applyReceiptConfig({}, { template: EMAIL, attachments: [{ name: ' Inv ', receiptTemplateId: 'a4' }] }).config.attachments,
  [{ name: 'Inv', receiptTemplateId: 'a4' }]
);
assert.equal(applyReceiptConfig({ attachments: [{ name: 'x' }] }, { template: NORMAL, attachments: [{ name: 'x' }] }).config.attachments, null);
assert.equal(applyReceiptConfig({}, { template: TEXT, receiptWidth: '40', attachments: [{ name: 'x' }] }).config.attachments, null);
// Measured: a new row defaults to the standard name and an EMPTY template, and the save
// rules list exactly two aborts — so an empty (or repeated) template id must still save.
assert.deepEqual(
  applyReceiptConfig({}, { template: EMAIL, attachments: [{ name: DEFAULT_ATTACHMENT_NAME }] }).config.attachments,
  [{ name: DEFAULT_ATTACHMENT_NAME, receiptTemplateId: '' }]
);
assert.equal(
  applyReceiptConfig({}, { template: EMAIL, attachments: [{ name: 'x', receiptTemplateId: 'a' }, { name: 'y', receiptTemplateId: 'a' }] }).error,
  undefined
);
// Keys the dialog does not own survive the save (Confirm rewrites the whole config).
assert.deepEqual(applyReceiptConfig({ components: [1] }, { template: NORMAL, padding: {} }).config.components, [1]);

assert.equal(isEmailTemplate({ type: 'Email Receipt' }), true);
assert.equal(isEmailTemplate({ type: 'email' }), true);
assert.equal(isEmailTemplate({ type: 'A4 Receipt' }), false);
assert.equal(DEFAULT_ATTACHMENT_NAME, '{outlet.name} Invoice #{invoiceNo}');

// --- panel audit, 2026-08-07 (docs/parity/receipt-editor-measured-2026-08-07.md) ---
// The registry gives `eftpos` textAlign + padding + border and NO settings fields, and
// its stored value is null. The editor panel must not invent one: a null value has to
// survive the round trip untouched (it used to be coerced to '' by the default branch).
const eftpos = { type: 'eftpos', style: { textAlign: 'center' }, value: null };
const eftposBack = toReferenceComponents(toEditorComponents([eftpos]))[0];
assert.equal(eftposBack.type, 'eftpos');
assert.equal(eftposBack.value, null, 'eftpos value stays null');
assert.equal(eftposBack.style.textAlign, 'center');

// A FRESH External Receipt (dragged from the palette, so no __ref) is the case the
// palette actually produces: it must also store null, not ''.
const freshEftpos = toReferenceComponent({
  type: 'external_receipt',
  properties: { textAlign: 'left', padding: { top: 5, right: 5, bottom: 5, left: 5 }, border: { enabled: false } },
});
assert.equal(freshEftpos.value, null, 'a fresh eftpos stores value null, not ""');
// ...and the adapter must not bake in style keys eftpos has no control for — that is
// what printed the EFT slip in an unremovable grey 10px box.
['color', 'background', 'fontSize', 'fontWeight'].forEach((key) =>
  assert.ok(!(key in freshEftpos.style), `eftpos style must not carry ${key}`));
assert.equal(freshEftpos.style.textAlign, 'left');
// Same rule per measured whitelist: text = background/padding/border only.
const freshText = toReferenceComponent({ type: 'text', properties: { fontSize: 16, fontColor: '#000000', backgroundColor: '#ffffff', richTextContent: 'hi' } });
assert.ok(!('fontSize' in freshText.style) && !('color' in freshText.style), 'text carries no fontSize/color');
assert.equal(freshText.style.background, '#ffffff');
// ...while a component that DOES have the controls still gets them.
assert.equal(toReferenceComponent({ type: 'products', properties: { fontSize: 11 } }).style.fontSize, '11');

// Spacer stores its height as the component value; the reference seeds a new one at 100.
assert.equal(toReferenceComponents(toEditorComponents([{ type: 'spacer', style: {}, value: '100' }]))[0].value, '100');
assert.equal(toEditorComponents([{ type: 'spacer', style: {}, value: '100' }])[0].properties.height, 100);
// A stored 0 is a real height, not "missing" — `Number(value) || 3` used to open it as 3.
assert.equal(toEditorComponents([{ type: 'spacer', style: {}, value: '0' }])[0].properties.height, 0);
assert.equal(toReferenceComponents(toEditorComponents([{ type: 'spacer', style: {}, value: '0' }]))[0].value, '0');
// A spacer with no value at all falls back to the measured default, 100 (never 3).
assert.equal(toEditorComponents([{ type: 'spacer', style: {} }])[0].properties.height, 100);
assert.equal(toReferenceComponent({ type: 'spacer', properties: {} }).value, '100');

// The reference registry keys gift cards `giftCards`; older local templates hold
// `gift_cards`. Both must load into the editor's panel type...
assert.equal(toEditorComponents([{ type: 'giftCards', style: {}, value: { columns: [] } }])[0].type, 'gift_cards');
assert.equal(toEditorComponents([{ type: 'gift_cards', style: {}, value: { columns: [] } }])[0].type, 'gift_cards');
// ...and SAVE back as the registry's own key, so opening a reference template no
// longer rewrites it to a key the registry does not contain.
const giftRound = toReferenceComponents(toEditorComponents([
  { type: 'giftCards', style: {}, value: { columns: [{ column: 'original', enabled: true }] } },
]))[0];
assert.equal(giftRound.type, 'giftCards');
// The label fallback must apply to the camelCase key too — it used to show 'original'.
assert.equal(giftRound.value.columns.find((c) => c.column === 'original').name, 'Original');

// Keys no panel may edit, because the adapter has nowhere to put them: a control bound
// to one of these moves the canvas and silently reverts on save.
const dropped = toReferenceComponent({
  type: 'surcharge',
  properties: { showTitle: false, showTotal: false, taxItems: [{ name: 'GST', enabled: false }] },
});
assert.ok(!('showTitle' in dropped.style) && !('showTitle' in Object(dropped.value)), 'showTitle is dropped');
assert.ok(!('taxItems' in dropped.style) && !('taxItems' in Object(dropped.value)), 'taxItems is dropped');
