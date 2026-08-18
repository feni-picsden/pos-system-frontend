// Check: an emailed receipt must contain the sale, not just a <title>.
// Bundle + run:  npx esbuild src/utils/receiptEmailHtml.test.jsx --bundle --format=esm
//                --platform=node --outfile=<tmp>.mjs && node <tmp>.mjs
import assert from 'node:assert';
import { buildReceiptEmailHtml } from './receiptEmailHtml.jsx';

// A reference-shape template: components are {type, style, value}, shaped like the
// ones Setup > Receipts actually stores (heading carries completed/parked captions,
// product carries its column list).
const template = {
  name: 'Email Receipt',
  type: 'Email Receipt',
  config: {
    canvas: { width: 210 },
    components: [
      { type: 'heading', style: {}, value: { completed: 'Tax Invoice', parked: 'Parked Sale' } },
      {
        type: 'product',
        style: {},
        value: {
          columns: [
            { name: 'Qty', column: 'qty', enabled: true },
            { name: 'Product', column: 'product', enabled: true },
            { name: 'Price', column: 'price', enabled: true },
          ],
        },
      },
      { type: 'text', style: {}, value: 'Thank you for shopping with us' },
    ],
  },
};

const receiptData = {
  transactionId: '#TEST-1',
  invoiceNo: '00000011',
  completedAt: '2026-08-17T00:00:33.000Z',
  items: [
    { name: '4 Pines Pacific Ale 330ml', quantity: 1, unitPrice: 11.29, price: 11.29, taxName: 'GST', taxAmount: 1.47 },
  ],
  outlet: { name: 'Top Drops Rossmore' },
  payments: [{ method: 'Cash', amount: '11.29', description: 'Cash' }],
  total: '11.29',
  basePrice: '11.29',
  gst: '1.47',
  discount: '0.00',
  savings: '0.00',
  change: '0.00',
  paymentAmount: '11.29',
  salesPerson: 'ZZTEST-Cashier',
};

const html = buildReceiptEmailHtml({ receiptData, template, title: 'Receipt - #TEST-1' });
assert.ok(html, 'reference-shape template must produce HTML');

const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/) || [])[1] || '';
const text = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// The bug: body rendered empty, so the mail client showed only the <title>.
assert.ok(text.length > 0, 'email body must not be empty');
assert.ok(text.includes('4 Pines Pacific Ale 330ml'), `product line missing from: ${text}`);
assert.ok(text.includes('11.29'), `total missing from: ${text}`);
assert.ok(text.includes('Thank you for shopping with us'), 'footer text missing');

// A legacy (non-reference) template returns null so the caller falls back to the server.
assert.equal(
  buildReceiptEmailHtml({ receiptData, template: { config: { components: [{ id: 'x', type: 'header', settings: {} }] } } }),
  null
);

console.log('receiptEmailHtml: OK —', text.slice(0, 80));
