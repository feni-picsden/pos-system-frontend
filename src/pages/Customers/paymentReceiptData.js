// Shapes a Payment History row (GET /customers/:id/payments) into the arguments
// buildPaymentReceiptHtml prints: reference dates ("21st Oct 2026 9:46:12 am"
// for the payment, "07/11/2018 14:02:26" per invoice, print time for "as at"),
// the customer's code + name, the invoice rows with their FULL totals.
import { format } from 'date-fns';
import settingsService from '../../services/settingsService';
import { toAppZonedDate, appTimeZone, formatDateTime as formatAppDateTime } from '../../utils/appDateTime';
import { customerName } from '../../components/SalesHistory/SaleDetailCard';
import { safeAmount } from './paymentReceipt';

// receiptData for a Setup > Receipts "Payment" template (ReceiptRenderer), the
// same shape the Make Payment auto-print builds, so the reprint dialog's
// template dropdown renders a Payment History row through any payment template.
export const paymentTemplateReceiptData = ({ payment, customer, business, accountBalance }) => {
  const person = payment?.customer || customer || {};
  const paid = safeAmount(payment?.total);
  const when = payment?.paymentDate ? new Date(payment.paymentDate) : new Date();
  const dateText = formatAppDateTime(when);
  // Same invoice rows the built-in reference layout prints (one per invoice, FULL total).
  const { invoices } = paymentReceiptArgs({ payment, customer, business, accountBalance });
  const balance = Number(accountBalance);
  return {
    // Account payment receipt (reference Payment Receipt template blocks).
    kind: 'payment',
    invoices: invoices.map((inv) => ({ processed: inv.processed, invoiceNo: inv.number, total: Number(inv.total) || 0 })),
    totalPaid: paid,
    unallocated: safeAmount(payment?.unallocated),
    transactionId: payment?.reference || (payment?.id ? `#${payment.id}` : ''),
    date: dateText,
    formattedDate: dateText,
    completedAt: when.toISOString(),
    timeZone: appTimeZone(),
    status: 'completed',
    outlet: business || null,
    customer: {
      firstName: person.firstName || '',
      lastName: person.lastName || '',
      company: person.company || customer?.company || '',
      code: person.code || customer?.code || '',
      // Reference {customer.currentOwing}: the account balance printed in the
      // "Account balance:" block.
      currentOwing: Number.isFinite(balance) ? balance : 0,
    },
    items: [],
    subtotal: paid,
    total: paid.toFixed(2),
    paymentAmount: paid.toFixed(2),
    change: '0.00',
    balanceOwing: accountBalance,
    payments: [{
      method: payment?.paymentMethod || 'Payment',
      amount: paid.toFixed(2),
      description: payment?.reference || payment?.paymentMethod || 'Payment',
      reference: payment?.reference || null,
    }],
  };
};

export const receiptMoment = (value) => {
  const d = toAppZonedDate(value || new Date());
  return format(d, 'do MMM yyyy h:mm:ss aaa');
};

export const invoiceMoment = (value) => format(toAppZonedDate(value), 'dd/MM/yyyy HH:mm:ss');

export const paymentReceiptArgs = ({ payment, customer, business, accountBalance, printedAt = new Date() }) => {
  const person = payment?.customer || customer || null;
  // One row per invoice: the unallocated remainder sits on the latest sale as a
  // second row, which must not list that invoice twice.
  const seen = new Set();
  const invoices = (payment?.invoices || [])
    .filter((inv) => { const key = inv.saleId ?? inv.saleNumber; if (seen.has(key)) return false; seen.add(key); return true; })
    .map((inv) => ({
      processed: invoiceMoment(inv.saleDate),
      number: settingsService.padInvoice(inv.invoiceNumber, inv.invoiceSuffix) || String(inv.saleNumber || '').replace(/^#/, ''),
      total: inv.total ?? inv.amount,
      saleId: inv.saleId,
    }));
  return {
    business,
    dateText: receiptMoment(payment?.paymentDate),
    customer: person ? { code: customer?.code || person.code || '', name: customerName(person) } : null,
    invoices,
    totalPaid: payment?.total,
    methodName: payment?.paymentMethod || '',
    unallocated: payment?.unallocated || 0,
    accountBalance,
    asAtText: receiptMoment(printedAt),
  };
};
