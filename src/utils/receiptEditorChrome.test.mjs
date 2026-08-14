// node src/utils/receiptEditorChrome.test.mjs
//
// The receipt editor's chrome is measured pixel values, not logic — no unit can reach
// it, so this guards the numbers themselves against a silent revert. Ground truth:
// docs/parity/receipt-editor-measured-2026-08-07.md rows 5.1, 5.2, 5.4, 5.5, 5.6.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../pages/Setup/ReceiptEditor.jsx', import.meta.url)), 'utf8');
// assert.match dumps the whole 260KB file on failure — keep the message readable.
const has = (re, msg) => assert.ok(re.test(src), msg);

// 5.1 header: name input 200x37 / 16px / 1px solid black / radius 0; gear 41x40 on neutral-500.
has(/borderRadius: 0,\s*height: 37,\s*width: 200,/, '5.1 name input 200x37, radius 0');
has(/borderColor: '#000',\s*borderWidth: '1px',/, '5.1 name input 1px solid black');
has(/'& \.MuiInputBase-input': \{\s*color: '#000',[\s\S]{0,220}fontSize: 16,/, '5.1 name input 16px');
has(/bgcolor: '#737373',\s*color: 'white',[\s\S]{0,120}width: 41,\s*height: 40,/, '5.1 gear 41x40 white-on-neutral-500');

// 5.2 tabs: 200x64 (panel 400 / fullWidth), 18px, 4px blue-500 underline, neutral-200 active,
// neutral-500 inactive, no bottom border when inactive/disabled.
has(/width: 400, borderRadius: 0/, '5.2 right panel 400px');
has(/minHeight: 64,\s*py: 2,\s*fontSize: '1\.125rem'/, '5.2 tab 64 tall, py-4, 18px');
has(/'&\.Mui-selected': \{\s*color: '#000',\s*fontWeight: 400,\s*bgcolor: '#e5e5e5',/, '5.2 active = black on neutral-200');
has(/height: 4,[\s\S]{0,140}backgroundColor: '#3b82f6'/, '5.2 border-b-4 blue-500');
assert.doesNotMatch(src, /boxShadow: 'inset 0 -4px 0/, '5.2 inactive/disabled tab must have NO bottom border');
// ...and no rule on the strip CONTAINER either — that painted one under both tabs.
const strip = src.slice(src.indexOf('{/* Tab Header'), src.indexOf('<Tab label="Components"'));
assert.doesNotMatch(strip, /borderBottom/, '5.2 tab strip container must not draw a bottom rule');
// The one behavioural rule in 5.2: selection drives the tab, both ways.
has(/setActiveTab\(selectedComponent \? 1 : 0\)/, '5.2 select -> Settings, deselect -> Components');
has(/disabled=\{!selectedComponent\}/, '5.2 Settings is disabled with nothing selected');

// 5.4 canvas: neutral-700 surround, p-8, paper 1px solid black on white, width from the
// shared paperWidthMm() helper (never hardcoded).
has(/p: 4, overflow: 'auto', bgcolor: '#404040'/, '5.4 neutral-700 surround, p-8');
has(/border: '1px solid #000',\s*borderRadius: 0,\s*boxShadow: 'none',/, '5.4 paper = 1px solid black, flat');
has(/width: paperWidthMm\(template\)/, '5.4 paper width comes from the shared helper');
has(/Drop Component here/, '5.4 empty-canvas drop zone label');

// 5.5 footer: 32px tall, radius 0, 18px, Save white on rgb(28,134,242).
assert.equal((src.match(/minHeight: 32,\s*height: 32,/g) || []).length, 3, '5.5 three 32px footer buttons');
has(/bgcolor: '#1c86f2',\s*color: '#f8f8f8',/, '5.5 Save is white on rgb(28,134,242)');
// All three sit in ONE right-aligned group; space-between pinned Preview to the far left.
has(/justifyContent: 'flex-end',[\s\S]{0,200}borderTop: '1px solid #000'/, '5.5 footer is right-aligned');

// The header name field must show the template's own name — a literal fallback displayed
// a name that was never in state and that Save skips.
assert.doesNotMatch(src, /value=\{template\?\.name \|\| '/, '5.1 name input must not fake a name');
// Configure writes config.padding/receiptWidth/attachments, which the component snapshot
// cannot see; without this flag Confirm-then-Cancel discarded them with no prompt.
has(/configDirty\.current \|\|/, 'unsaved-changes check covers Configure edits');

// 5.6 selected-component toolbar: drag handle, name, gear, trash, X.
const toolbar = src.slice(src.indexOf("bgcolor: '#313439'"));
for (const icon of ['DragIcon', 'SettingsIcon', 'DeleteIcon', 'CloseIcon']) {
  assert.ok(toolbar.slice(0, 1600).includes(icon), `5.6 toolbar is missing ${icon}`);
}

// Configure: the list page's action and the editor's gear open the SAME dialog — they
// were two implementations and the editor's had no width and no attachments.
const list = readFileSync(fileURLToPath(new URL('../pages/Setup/ReceiptTemplates.jsx', import.meta.url)), 'utf8');
const dialog = readFileSync(fileURLToPath(new URL('../components/Receipt/ConfigureReceiptDialog.jsx', import.meta.url)), 'utf8');
for (const [name, code] of [['editor', src], ['list page', list]]) {
  assert.ok(/<ConfigureReceiptDialog/.test(code), `${name} must use the shared Configure dialog`);
  assert.ok(/applyReceiptConfig/.test(code), `${name} must use the shared Configure save rules`);
}
assert.ok(/Configure Receipt\s*\n?\s*<\/DialogTitle>/.test(dialog), 'dialog is titled Configure Receipt');
// The error toast lives INSIDE DialogContent — rendered on the page behind it, the
// backdrop hid it and Confirm read as doing nothing.
const content = dialog.slice(dialog.indexOf('<DialogContent>'), dialog.indexOf('</DialogContent>'));
assert.ok(/<Alert severity="error"/.test(content), 'validation errors render inside the dialog');

console.log('receipt editor chrome: all measured values present');
