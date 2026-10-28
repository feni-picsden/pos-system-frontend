// Builds the reference-shaped receipt data feed from our receiptData.
// Key names and value types are the ones measured on topdrops 2026-08-05
// (docs/parity/receipt-template.md §8): money is pre-formatted in products/tax/
// payments, raw numbers in `total`, and loyalty/account use `false` per column
// to mean "hide this row".
import { buildReceiptContext } from './receiptExpressions.js';
import { itemsPerCase } from './saleTotals.js';

export const money = (amount) => new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
}).format(Number(amount) || 0);

const lineTax = (item) => {
  const name = item.taxName || item.tax?.name || item.retailTaxRate || item.taxRateName || '';
  const stated = item.taxAmount ?? item.tax?.amount ?? (typeof item.tax === 'number' ? item.tax : null);
  // A line that BANKED tax still prints it even when the rate name is missing or now
  // reads "No Tax" — the money the sale took is the truth, the name is a label. A
  // combo line (blended rate, no name) lands here too.
  if (!name || name === 'No Tax') {
    const amount = parseFloat(stated) || 0;
    return Math.round(amount * 100) === 0 ? { name: '', amount: 0 } : { name: name || 'Tax', amount };
  }
  if (stated != null) return { name, amount: parseFloat(stated) || 0 };
  const percent = parseFloat(item.taxPercent) || 0;
  const total = parseFloat(item.price) || 0;
  return { name, amount: percent > 0 ? (total * percent) / (100 + percent) : 0 };
};

export const buildReferenceData = (receiptData = {}) => {
  const items = receiptData.items || [];
  // Setup > General's word for a case ("Case" unless the shop renamed it).
  const caseText = receiptData.caseText || 'Case';

  // One entry per tax rate that appears on the sale, keyed by its name (we have no
  // tax uuids locally — the name is the stable id).
  const taxTotals = new Map();
  items.forEach((item) => {
    const { name, amount } = lineTax(item);
    if (!name) return;
    taxTotals.set(name, (taxTotals.get(name) || 0) + amount);
  });

  // A rate that contributes no tax prints no tax row and flags no line (reference
  // behaviour, docs/parity/receipt-template.md §10).
  taxTotals.forEach((amount, name) => {
    if (Math.round(amount * 100) === 0) taxTotals.delete(name);
  });

  const products = items.map((item) => {
    const price = parseFloat(item.price) || 0;
    const qty = parseFloat(item.quantity) || 1;
    const discount = parseFloat(item.discount) || 0;
    const savings = parseFloat(item.savings) || 0;
    // Same resolver the renderer and the sell screen use — a line with no case
    // size is 1 per case, never 0 (that was the live-vs-reprint difference).
    const caseQty = Number(item.caseQty) || itemsPerCase(item.product || item);
    // Reference: a line sold as a case prints "Name (Case)", its qty in CASES
    // (total-items keeps the units) and always carries the case price.
    const asCase = item.isCase === true && caseQty > 1;
    return {
      product: `${item.name || item.productName || ''}${asCase ? ` (${caseText})` : ''}`,
      qty: asCase ? Math.floor(qty / caseQty) : qty,
      'case-qty': caseQty,
      'total-items': qty,
      'item-price': money(qty ? price / qty : price),
      'case-price': asCase || item.caseQty ? money((price / qty) * caseQty) : '',
      discount: money(discount),
      price: money(price),
      'normal-price': money(price + savings),
      savings: money(savings),
      'discount-reason': item.discountReason || '',
      note: item.note || item.productNote || '',
      tax: taxTotals.has(lineTax(item).name) ? lineTax(item).name : '',
      surcharge: item.surcharge ? money(item.surcharge) : '',
    };
  });

  const tax = [...taxTotals.entries()].map(([name, amount]) => ({
    id: name,
    tax: name,
    total: money(amount),
  }));

  const indicators = {};
  taxTotals.forEach((_, name) => { indicators[name] = true; });

  // Reference prints the tender line as "Tendered <method>" (measured: "Tendered Cash",
  // docs/parity/receipt-template.md §8; ARARAT reprint 28/10/2026), with:
  //  * the tenders of ONE method on one line (3 cash tenders -> "Tendered Cash $70.00"),
  //  * a refund as a negative tender ("Tendered Cash -$11.80"),
  //  * no "On Account" line (money owed, not taken), no change row (it prints as
  //    the Change total) and no Rounding row (it prints in the totals block).
  const paymentLabel = (payment) =>
    // The tender line names the METHOD ("Tendered Cash" / "Tendered EFTPOS"); the
    // description can be a Linkly txn ref, which printed as "Tendered tmsh4wfpvftk6".
    String(payment.method || payment.paymentMethod || payment.description || '').trim();
  const isRoundingRow = (payment) => /^rounding$/i.test(paymentLabel(payment));
  const isChangeRow = (payment) => /^change$|\(change\)$/i.test(paymentLabel(payment));
  const isAccountRow = (payment) => /^(on\s*)?account$/i.test(paymentLabel(payment));
  const paymentsByMethod = new Map();
  (receiptData.payments || []).forEach((payment) => {
    if (isRoundingRow(payment) || isChangeRow(payment) || isAccountRow(payment)) return;
    const label = paymentLabel(payment);
    paymentsByMethod.set(label, (paymentsByMethod.get(label) || 0) + (parseFloat(payment.amount) || 0));
  });
  const payments = [
    ...[...paymentsByMethod.entries()]
      .filter(([, amount]) => Math.round(amount * 100) !== 0)
      .map(([label, amount]) => ({
        payment: /^tendered/i.test(label) ? label : `Tendered ${label}`,
        amount: money(amount),
      })),
    // A caller that lists change as a payment row (older sell-screen feeds) keeps
    // it, under its own name; the banked "Cash (Change)" row prints as the Change
    // total instead.
    ...(receiptData.payments || [])
      .filter((payment) => /^change$/i.test(paymentLabel(payment)))
      .map((payment) => ({ payment: paymentLabel(payment), amount: money(payment.amount) })),
  ];
  const bankedRounding = (receiptData.payments || [])
    .filter(isRoundingRow)
    .reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);

  // Loyalty prints only when the sale moved points (a customer sale with the
  // program off, or 0 earned / 0 spent, printed five "0" rows on a reprint).
  const loyaltySource = receiptData.loyalty;
  const loyaltyMoved = loyaltySource
    && ((Number(loyaltySource.earned) || 0) !== 0 || (Number(loyaltySource.spent) || 0) !== 0);
  const loyalty = loyaltyMoved
    ? {
        'current-loyalty': loyaltySource.currentPoints ?? false,
        earned: loyaltySource.earned ?? false,
        spent: loyaltySource.spent ?? false,
        'before-sale': loyaltySource.beforeSale ?? false,
        'after-sale': loyaltySource.afterSale ?? false,
      }
    : { 'current-loyalty': false, earned: false, spent: false, 'before-sale': false, 'after-sale': false };

  // Account block only when this sale was put on the account (the reference's
  // own receipt prints no balance rows at all; a template that adds the block
  // gets it for on-account sales only, never "$0.00" rows on a cash sale).
  const account = receiptData.account && Math.round((Number(receiptData.account.balanceChanged) || 0) * 100) !== 0
    ? {
        'start-balance': receiptData.account.startBalance ?? false,
        'end-balance': receiptData.account.endBalance ?? false,
        'changed-balance': receiptData.account.balanceChanged ?? false,
        'current-balance': receiptData.account.currentBalance ?? false,
      }
    : { 'start-balance': false, 'end-balance': false, 'changed-balance': false, 'current-balance': false };

  return {
    status: receiptData.status || 'COMPLETED',
    invoiceNo: receiptData.invoiceNo
      || (receiptData.saleNumber ? String(receiptData.saleNumber).replace(/^#/, '') : '')
      || String(receiptData.transactionId || ''),
    products,
    tax,
    indicators,
    payments,
    loyalty,
    account,
    total: {
      sale: Number(receiptData.total) || 0,
      paid: (receiptData.payments || []).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0),
      remaining: 0,
      savings: Number(receiptData.savings) || 0,
      discount: Number(receiptData.discount) || 0,
      change: Number(receiptData.change) || 0,
      cashout: Number(receiptData.cashout) || 0,
      // The Rounding bookkeeping row banked with the tenders, or the caller's figure.
      rounding: Math.round(((Number(receiptData.rounding) || 0) + bankedRounding) * 100) / 100,
      surcharge: Number(receiptData.surchargeTotal) || 0,
    },
    text: buildReceiptContext(receiptData),
    surcharges: Object.entries(receiptData.surcharges || {}).map(([name, amount]) => ({
      surcharge: name,
      amount: money(amount),
    })),
    giftCards: (receiptData.giftCards || []).map((card) => ({
      id: card.id,
      original: money(card.original),
      used: money(card.amountUsed),
      current: money(card.current),
      expiry: card.expiry || '',
    })),
    // The slip is carried per payment (Linkly returns it with the tender), so the
    // external-receipt component reads the payments when no top-level slip is set —
    // otherwise an EFTPOS sale rendered that component empty on screen and on reprint.
    // Several slips (two card tenders) are separated the way the slip itself
    // separates its sections: a dashed rule.
    eftpos: receiptData.hideEftposSlip
      ? ''
      : (receiptData.eftposReceipt
        || (receiptData.payments || []).map((p) => p.eftposReceipt).filter(Boolean).join('\n' + '-'.repeat(24) + '\n')),
    logo: receiptData.outlet?.logo || receiptData.outlet?.receiptLogo || null,
  };
};

// The sale the template editor's canvas previews against. It exercises every block
// (two tax rates, two tenders, change, discount/savings, loyalty, account, a gift
// card, a surcharge) so a component the author enables shows a value instead of an
// empty table. Same builder the real receipt uses — canvas and print cannot drift.
export const sampleReferenceData = () => buildReferenceData({
  invoiceNo: '00000001',
  completedAt: new Date().toISOString(),
  status: 'COMPLETED',
  note: 'Sample sale note',
  user: { name: 'Sample User' },
  register: { name: 'Register 1' },
  outlet: { name: 'Sample Outlet', phone: '00 0000 0000', address: '1 Sample St' },
  customer: { name: 'Sample Customer', invoiceMessage: 'Thanks for your business' },
  items: [
    { name: 'Sample Product', quantity: 2, price: 22, caseQty: 6, taxName: 'GST', taxAmount: 2, discount: 1, savings: 1, note: 'Sample product note', discountReason: 'Sample discount reason' },
    { name: 'Sample Untaxed Product', quantity: 1, price: 10, taxName: 'No Tax', taxAmount: 0 },
  ],
  payments: [
    { method: 'Cash', amount: 20 },
    { method: 'EFTPOS', amount: 17 },
  ],
  total: 32,
  change: 5,
  discount: 1,
  savings: 1,
  rounding: 0.02,
  surcharges: { 'Card Surcharge': 0.5 },
  surchargeTotal: 0.5,
  loyalty: { currentPoints: 120, earned: 32, spent: 0, beforeSale: 88, afterSale: 120 },
  account: { startBalance: 80, endBalance: 100, balanceChanged: 20, currentBalance: 100 },
  giftCards: [{ id: 'GC-0001', original: 50, amountUsed: 10, current: 40, expiry: '31/12/2027' }],
  // The External Receipt block prints the EFT slip verbatim and renders nothing when
  // there is none — without a sample the editor canvas showed an empty block.
  eftposReceipt: 'SAMPLE EFTPOS\nAPPROVED 00\nTOTAL AUD $17.00',
});

export default buildReferenceData;
