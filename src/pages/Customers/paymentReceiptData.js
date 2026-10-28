// Shapes a Payment History row (GET /customers/:id/payments) into the arguments
// buildPaymentReceiptHtml prints: reference dates ("21st Oct 2026 9:46:12 am"
// for the payment, "07/11/2018 14:02:26" per invoice, print time for "as at"),
// the customer's code + name, the invoice rows with their FULL totals.
import { format } from 'date-fns';
import settingsService from '../../services/settingsService';
import { toAppZonedDate } from '../../utils/appDateTime';
import { customerName } from '../../components/SalesHistory/SaleDetailCard';

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
