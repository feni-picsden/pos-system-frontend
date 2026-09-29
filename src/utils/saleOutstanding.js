// "How much is still owed on this sale" - mirrors the backend helper
// (pos-system-backend/lib/saleOutstanding.js) so every Sales History screen shows
// the same figure as the customer's Outstanding Sales table.
//
// Reference: a completed sale that still owes money (taken On Account, not yet
// paid off) is drawn with a purple hollow circle and reads "Incomplete"; once it
// is paid it gets the black tick again.

const cents = (n) => Math.round(n * 100) / 100;

export const isOnAccountPayment = (p) =>
  String((p && p.paymentMethod) || '').trim().toLowerCase() === 'on account';

const sum = (rows) => rows.reduce((t, p) => t + (parseFloat(p && p.amount) || 0), 0);

export const saleOutstanding = (sale) => {
  if (!sale) return 0;
  // Only a finished sale can "owe": a parked sale also carries balance = total.
  if (sale.status && String(sale.status).toUpperCase() !== 'COMPLETED') return 0;
  // Server already worked it out (customer sales / product sales history).
  if (sale.outstandingAmount != null) return Math.max(0, cents(parseFloat(sale.outstandingAmount) || 0));
  const balance = parseFloat(sale.balance) || 0;
  if (balance > 0) return cents(balance);
  const payments = sale.payments || [];
  const charged = sum(payments.filter(isOnAccountPayment));
  // Nothing put on account -> nothing owed (a cash refund of -5 is not "5 owed").
  if (charged <= 0) return 0;
  const paid = sum(payments.filter((p) => !isOnAccountPayment(p)));
  return Math.max(0, cents(charged - paid));
};

// Reference colour of the "Incomplete" hollow circle / label.
export const INCOMPLETE_PURPLE = '#9561e2';

export default saleOutstanding;
