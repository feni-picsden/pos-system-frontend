// Old-shape (editor) receipt templates convert to the reference shape the mail
// renderer needs. Run: node src/utils/emailTemplateNormalize.test.mjs
import assert from 'node:assert/strict';
import { toReferenceComponents } from './receiptTemplateShape.js';

// Shape of the stock "Email Receipt" / "A4 Receipt" rows (lib/defaultReceiptTemplates.js).
const oldShape = [
  { id: 'outlet_logo-3', type: 'outlet_logo', visible: true, properties: { width: '200px', border: { enabled: false } } },
  { id: 'header-3', type: 'header', visible: true, properties: { completedSale: 'Tax Invoice', parkedSale: 'Parked Sale', textAlign: 'center', fontSize: 14 } },
  { id: 'products-3', type: 'products', visible: true, properties: { fontSize: 11 } },
  { id: 'totals-3', type: 'totals', visible: true, properties: {} },
  { id: 'hidden-3', type: 'text', visible: false, properties: { richTextContent: 'x' } },
];
const isReferenceShape = (components) => Array.isArray(components)
  && components.some((c) => c && ('style' in c || 'value' in c) && !c.properties);

const converted = toReferenceComponents(oldShape.filter((c) => c.visible !== false));
assert.equal(isReferenceShape(converted), true, 'converted components are reference shape');
assert.ok(converted.every((c) => !c.properties), 'no editor properties survive');
assert.deepEqual(converted.map((c) => c.type), ['img', 'heading', 'product', 'total']);
assert.equal(converted[1].value?.completed, 'Tax Invoice', 'heading text carried over');
console.log('emailTemplateNormalize: all assertions passed');
