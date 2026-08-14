// Pure helpers for the Balance page's AUTO PRINT PAYMENT RECEIPT (customer-group flag).
// Kept React/MUI-free so the money guard + flag resolution stay unit-testable.
// Runnable self-check: `node paymentReceipt.js`

// Money guard: coerce to a finite, non-negative amount. Never NaN, never negative.
export const safeAmount = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// AUTO PRINT PAYMENT RECEIPT is a group-only flag (applies to every member of the group).
// Undefined/false => false => caller no-ops (behaviour identical to today).
export const shouldAutoPrintPaymentReceipt = (group) => Boolean(group && group.autoPrintPaymentReceipt);

// The group's payment-receipt template, else its statement template, else null (store/outlet default).
export const paymentReceiptTemplateOf = (group) =>
  (group && (group.paymentReceiptTemplate || group.statementTemplate)) || null;

const esc = (s) =>
  String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));

// Minimal printable payment-receipt HTML. `currency` is injected so we reuse the page's formatter;
// the fallback formatter preserves negatives (a customer can be in credit) but never emits NaN.
export const buildPaymentReceiptHtml = (
  { customerName, dateText, methodName, reference, amount, newOwing, templateName },
  currency
) => {
  const money = (n) => {
    const v = Number(n);
    return Number.isFinite(v) ? `$${v.toFixed(2)}` : "$0.00";
  };
  const fmt = typeof currency === "function" ? currency : money;
  const paid = fmt(safeAmount(amount)); // amount is a payment: guarded >= 0
  const owing = Number.isFinite(Number(newOwing)) ? Number(newOwing) : 0; // balance may be negative (credit)
  const row = (label, value) =>
    `<div style="display:flex;justify-content:space-between;margin:4px 0;font-size:0.8rem;"><span>${label}</span><span>${value}</span></div>`;
  return `
    <div style="max-width:400px;margin:0 auto;font-family:'Courier New',monospace;padding:20px;">
      <div style="text-align:center;margin-bottom:16px;">
        <h3 style="margin:4px 0;font-size:0.95rem;font-weight:bold;">Payment Receipt</h3>
        ${templateName ? `<p style="margin:2px 0;font-size:0.65rem;color:#666;">${esc(templateName)}</p>` : ""}
      </div>
      <hr style="border:none;border-top:1px solid #ddd;margin:12px 0;" />
      ${row("Customer", esc(customerName))}
      ${row("Date", esc(dateText))}
      ${row("Method", esc(methodName))}
      ${reference ? row("Reference", esc(reference)) : ""}
      <hr style="border:none;border-top:1px solid #ddd;margin:12px 0;" />
      ${row("<strong>Amount Paid</strong>", `<strong>${paid}</strong>`)}
      ${row("Balance Owing", fmt(owing))}
      <hr style="border:none;border-top:1px solid #ddd;margin:12px 0;" />
      <p style="font-size:0.7rem;text-align:center;color:#666;margin-top:12px;">Thank you</p>
    </div>`;
};

// --- runnable self-check (node paymentReceipt.js); browser-safe: `process` is undefined there ---
export const demo = () => {
  const assert = (c, m) => {
    if (!c) throw new Error("self-check failed: " + m);
  };
  assert(safeAmount("12.5") === 12.5, "parse string");
  assert(safeAmount(-5) === 0, "negative -> 0");
  assert(safeAmount("abc") === 0, "NaN -> 0");
  assert(safeAmount(null) === 0, "null -> 0");
  assert(safeAmount(Infinity) === 0, "infinity -> 0");
  assert(shouldAutoPrintPaymentReceipt(null) === false, "null group off");
  assert(shouldAutoPrintPaymentReceipt({}) === false, "missing flag off (no-op default)");
  assert(shouldAutoPrintPaymentReceipt({ autoPrintPaymentReceipt: true }) === true, "flag on");
  assert(paymentReceiptTemplateOf({}) === null, "no template -> null");
  assert(paymentReceiptTemplateOf({ statementTemplate: "S" }) === "S", "statement fallback");
  assert(paymentReceiptTemplateOf({ paymentReceiptTemplate: "P", statementTemplate: "S" }) === "P", "payment preferred");
  const html = buildPaymentReceiptHtml({ customerName: "A <b>", amount: -3, newOwing: -50 }, null);
  assert(!html.includes("NaN"), "no NaN in html");
  assert(html.includes("$0.00"), "negative amount guarded to $0.00");
  assert(html.includes("$-50.00"), "credit balance preserved");
  assert(html.includes("A &lt;b&gt;"), "html-escaped customer name");
  console.log("paymentReceipt self-check passed");
};

if (globalThis.process?.argv?.[1]?.replace(/\\/g, "/").endsWith("paymentReceipt.js")) demo();
