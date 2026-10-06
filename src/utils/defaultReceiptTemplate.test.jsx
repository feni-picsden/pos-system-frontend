// Check: the server's default receipt layout (backend lib/defaultReceiptTemplates.js,
// mirroring the measured reference "Receipt") renders every section through the real
// reference renderer.
// Bundle + run (from pos-system-frontend):
//   npx esbuild src/utils/defaultReceiptTemplate.test.jsx --bundle --format=esm
//     --platform=node --packages=external --outfile=node_modules/.cache/t.mjs
//   node node_modules/.cache/t.mjs
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { buildReceiptEmailHtml } from './receiptEmailHtml.jsx';

const nodeRequire = createRequire(import.meta.url);
const defaults = nodeRequire('../../../pos-system-backend/lib/defaultReceiptTemplates.js');

const receiptData = {
  transactionId: '#00000215',
  invoiceNo: '00000215',
  completedAt: '2026-10-06T09:22:26.000Z', // 20:22:26 Sydney (AEDT)
  timeZone: 'Australia/Sydney',
  user: { name: 'Super Admin3' },
  register: { name: 'Register 1' },
  note: 'Leave at door',
  items: [
    { name: 'QA AUDIT 20261005 Water', quantity: 1, unitPrice: 3, price: 3, taxName: 'GST', taxAmount: 0.27, caseQty: 12 },
  ],
  outlet: { name: 'Main Outlet', address: '1 Sample St', phone: '02 0000 0000', email: '' },
  customer: { firstName: 'Vipul', lastName: 'Test', invoiceMessage: 'See you again' },
  payments: [{ method: 'Cash', amount: '3.00', description: 'Cash' }],
  total: 3, change: 0, discount: 0, savings: 0,
};

const plain = (html) => (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

for (const [type, config] of Object.entries(defaults)) {
  const template = { name: type, type, config };
  const text = plain(buildReceiptEmailHtml({ receiptData, template, title: type }));
  assert.ok(text, `${type}: must render`);

  for (const expected of [
    'Main Outlet', '1 Sample St', 'ph: 02 0000 0000',
    'Tax Invoice',
    'Inv No #00000215',
    '6th Oct 2026 8:22:26 pm',
    'Register: Register 1',
    'QA AUDIT 20261005 Water',
    'GST', '$0.27',
    'Total', '$3.00',
    'Tendered Cash',
    'Indicates items with GST',
    'Sales Person: Super Admin3',
    'Leave at door',
    'See you again',
    'Thank you for shopping with us Vipul Test',
  ]) {
    assert.ok(text.includes(expected), `${type}: missing "${expected}" in: ${text}`);
  }

  // Optional lines print nothing when the value is missing.
  const bare = plain(buildReceiptEmailHtml({
    receiptData: { ...receiptData, customer: null, note: '', register: null, outlet: { name: 'Main Outlet' } },
    template, title: type,
  }));
  assert.ok(!/ph:|Register:/.test(bare), `${type}: optional line leaked: ${bare}`);
  assert.ok(bare.includes('Thank you for shopping with us'), `${type}: footer missing`);
}

console.log('defaultReceiptTemplate: OK');
