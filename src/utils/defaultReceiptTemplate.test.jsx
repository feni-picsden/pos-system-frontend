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
  outlet: { name: 'Main Outlet', address: '1 Sample St', phone: '02 0000 0000', email: '', abn: '86 653 852 861' },
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
    'Main Outlet', '1 Sample St', 'Ph: 02 0000 0000', 'ABN: 86 653 852 861',
    'Tax Invoice',
    'Inv No: #00000215',
    '6 Oct 26 20:22',
    'QA AUDIT 20261005 Water',
    'GST', '$0.27',
    'Total', '$3.00',
    'Tendered Cash',
    'Indicates items with GST',
    'Sales person: Super Admin3',
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
  assert.ok(!/Ph:|ABN:|Register:/.test(bare), `${type}: optional line leaked: ${bare}`);
  assert.ok(!/Register 1/.test(text), `${type}: register line must not print`);
  assert.ok(!/Start balance|Current Balance|Current Points/.test(text), `${type}: no account / loyalty rows`);
  assert.ok(bare.includes('Thank you for shopping with us'), `${type}: footer missing`);
}

console.log('defaultReceiptTemplate: OK');

// F5: a template with NO External Receipt block still prints the bank slip at the
// bottom (left, dashed rules); one that has the block prints it once only.
{
  const type = 'Normal Receipt';
  const withSlip = { ...receiptData, payments: [{ method: 'Eftpos', amount: '3.00', eftposReceipt: 'CUSTOMER COPY\nAPPROVED 00' }] };
  const noBlock = { name: type, type, config: { ...defaults[type], components: defaults[type].components.filter((c) => c.type !== 'eftpos') } };
  const html = buildReceiptEmailHtml({ receiptData: withSlip, template: noBlock, title: type });
  assert.ok(html.includes('CUSTOMER COPY'), 'slip appended without an eftpos block');
  assert.equal((html.match(/CUSTOMER COPY/g) || []).length, 1, 'slip printed once');
  assert.ok(/white-space:pre[;"]/.test(html) && /text-align:left/.test(html), 'slip is pre / left');
  const withBlock = buildReceiptEmailHtml({ receiptData: withSlip, template: { name: type, type, config: defaults[type] }, title: type });
  assert.equal((withBlock.match(/CUSTOMER COPY/g) || []).length, 1, 'template block prints the slip once, no duplicate');
  console.log('eftpos fallback: OK');
}
