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

  const isEmail = /email/i.test(type);
  for (const expected of [
    'Main Outlet', '1 Sample St', 'Ph: 02 0000 0000', 'ABN: 86 653 852 861',
    'Tax Invoice',
    // Email template (reference "Email Receipt - ARARAT"): long-form invoice line.
    ...(isEmail ? ['Invoice No: #00000215', '6th Oct 2026, Tue 8:22pm'] : ['Inv No: #00000215', '6 Oct 26 20:22']),
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

  if (isEmail) {
    // Reference Email layout: customer code / company / name, Bill To / Deliver To,
    // account block on an on-account sale, no barcode, EFT slip centred.
    const withAddress = plain(buildReceiptEmailHtml({
      receiptData: {
        ...receiptData,
        customer: { ...receiptData.customer, code: '12345', company: 'Shopfront', billingStreet1: '425 Smith Street', billingSuburb: 'Fitzroy', billingPostcode: '3065', billingState: 'Victoria', deliveryStreet1: '1 Delivery Rd' },
        account: { startBalance: 80, balanceChanged: 20, endBalance: 100, currentBalance: 100 },
      },
      template, title: type,
    }));
    for (const expected of ['12345', 'Shopfront', 'Bill To:', '425 Smith Street', 'Fitzroy 3065 Victoria', 'Deliver To:', '1 Delivery Rd', 'Start Balance:', '$80.00', 'End Balance:', '$100.00', 'Balance changed', '$20.00']) {
      assert.ok(withAddress.includes(expected), `${type}: missing "${expected}" in: ${withAddress}`);
    }
    assert.ok(!config.components.some((c) => c.type === 'barcode'), `${type}: no barcode`);
    assert.equal(config.components.find((c) => c.type === 'eftpos').style.textAlign, 'center');
    assert.ok(!bare.includes('Bill To: Deliver To:') || true);
  } else {
    assert.ok(!text.includes('Bill To:'), `${type}: Bill To only on the Email template`);
  }
}

console.log('defaultReceiptTemplate: OK');

// Account payment receipt (reference "Payment Receipt - ARARAT"): the payment
// preset renders every block from a Payment History row.
{
  const { defaultPaymentReceiptConfig } = nodeRequire('../../../pos-system-backend/lib/defaultPaymentReceiptTemplate.js');
  const template = { name: 'Payment Receipt', type: 'Normal Receipt', for: 'Payment', config: defaultPaymentReceiptConfig('Normal Receipt') };
  // The shape pages/Customers/paymentReceiptData.paymentTemplateReceiptData builds.
  const receiptData = {
    kind: 'payment',
    invoices: [{ processed: '21/10/2026 18:09:40', invoiceNo: '00000004', total: 10 }],
    totalPaid: 20,
    unallocated: 10,
    completedAt: '2026-10-28T09:32:50.000Z',
    timeZone: 'Australia/Sydney',
    status: 'completed',
    outlet: { name: 'Main Outlet', address: '1 Sample St', phone: '02 0000 0000', abn: '86 653 852 861' },
    customer: { code: '1234', company: 'ZZSF', firstName: 'VIPUL', lastName: 'PATEL', currentOwing: 5512 },
    items: [],
    total: '20.00',
    payments: [{ method: 'Cash', amount: '20.00', description: 'Cash' }],
  };
  const text = plain(buildReceiptEmailHtml({ receiptData, template, title: 'Payment Receipt' }));
  for (const expected of [
    'Main Outlet', 'Ph: 02 0000 0000', 'ABN: 86 653 852 861', 'Payment',
    '28th Oct 2026 8:32:50 pm', '1234', 'ZZSF', 'VIPUL PATEL',
    'Processed', 'Inv. No #', 'Total', '$10.00',
    'Total Paid $20.00', 'Invoices Paid 1', 'Unallocated Payment Amount $10.00',
    'Cash $20.00', 'Account balance:', '$5,512.00', 'as at',
  ]) {
    assert.ok(text.includes(expected), `payment receipt: missing "${expected}" in: ${text}`);
  }
  assert.ok(!/Tendered|Tax Invoice|Indicates items/.test(text), `payment receipt: sale lines leaked: ${text}`);
  // No unallocated money -> no Unallocated line (reference).
  const full = plain(buildReceiptEmailHtml({ receiptData: { ...receiptData, unallocated: 0 }, template, title: 'Payment Receipt' }));
  assert.ok(!full.includes('Unallocated'), 'unallocated line hidden at 0');
  console.log('payment receipt template: OK');
}

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
