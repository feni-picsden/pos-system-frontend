// Pure helpers for the customer PAYMENT receipt (Balance & Payments > Make Payment
// auto-print, and the payment panel's Print). Kept React/MUI-free so the money
// guard, flag resolution and the layout stay unit-testable.
// Runnable self-check: `node paymentReceipt.js`
//
// Layout = the reference "Payment Receipt" (Acacia $700 / Heywood $1,070 reprints,
// 27/10/2026): outlet header (logo, name, address, Ph, ABN), a "Payment" heading
// between two rules, the payment date, customer code + name, a Processed /
// Inv. No # / Total table (the invoice's FULL total), Total Paid, Invoices Paid,
// "Unallocated Payment Amount" only when some of the money is unallocated, the
// method line, then "Account balance: $x as at <print time>".

// Money guard: coerce to a finite, non-negative amount. Never NaN, never negative.
export const safeAmount = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// AUTO PRINT PAYMENT RECEIPT is a group-only flag (applies to every member of the group).
// Undefined/false => false => caller no-ops (behaviour identical to today).
export const shouldAutoPrintPaymentReceipt = (group) => Boolean(group && group.autoPrintPaymentReceipt);

// The group's Payment Receipt template id (a for='Payment' ReceiptTemplate), else null.
// The statement template is a different id space and must never stand in for it.
export const paymentReceiptTemplateOf = (group) => (group && group.paymentReceiptTemplate) || null;

const esc = (s) =>
  String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));

const money = (n) => {
  const v = Number(n);
  return Number.isFinite(v) ? `${v < 0 ? "-" : ""}$${Math.abs(v).toFixed(2)}` : "$0.00";
};

// Reference-shape payment receipt HTML.
//   business:   { name, address (may hold <br/>), phone, abn, logo }
//   dateText:   "21st Oct 2026 9:46:12 am" (payment moment)
//   customer:   { code, name }
//   invoices:   [{ processed: "07/11/2018 14:02:26", number: "7048277", total: 1068 }]
//   totalPaid, methodName, unallocated (0 = line hidden), accountBalance, asAtText
export const buildPaymentReceiptHtml = (
  { business, dateText, customer, invoices = [], totalPaid, methodName, unallocated = 0, accountBalance, asAtText },
  currency
) => {
  const fmt = typeof currency === "function" ? currency : money;
  const b = business || {};
  const paid = fmt(safeAmount(totalPaid));
  const balance = Number.isFinite(Number(accountBalance)) ? Number(accountBalance) : 0;
  const invoicesPaid = new Set(invoices.map((i) => i.number || i.saleId)).size;
  const row = (label, value, strong = false) =>
    `<tr><td style="padding:2px 8px 2px 0;text-align:right;${strong ? "font-weight:bold;" : ""}">${label}</td>` +
    `<td style="padding:2px 0;text-align:right;white-space:nowrap;width:26%;${strong ? "font-weight:bold;" : ""}">${value}</td></tr>`;
  return `
    <div style="max-width:420px;margin:0 auto;font-family:Arial,sans-serif;font-size:12px;color:#000;padding:16px;">
      <div style="text-align:center;">
        ${b.logo ? `<img src="${esc(b.logo)}" alt="" style="max-width:220px;max-height:160px;" />` : ""}
        ${b.name ? `<div style="font-size:15px;font-weight:bold;">${esc(b.name)}</div>` : ""}
        ${b.address ? `<div>${String(b.address).split(/<br\s*\/?>/i).map(esc).join("<br/>")}</div>` : ""}
        ${b.phone ? `<div>Ph: ${esc(b.phone)}</div>` : ""}
        ${b.abn ? `<div>ABN: ${esc(b.abn)}</div>` : ""}
      </div>
      <div style="border-top:1px solid #000;border-bottom:1px solid #000;margin:8px 0;padding:2px 0;text-align:center;font-weight:bold;">Payment</div>
      <div>${esc(dateText)}</div>
      ${customer?.code ? `<div>${esc(customer.code)}</div>` : ""}
      ${customer?.name ? `<div>${esc(customer.name)}</div>` : ""}
      <table style="width:100%;border-collapse:collapse;margin-top:8px;">
        <thead><tr>
          <th style="text-align:left;padding:2px 0;">Processed</th>
          <th style="text-align:left;padding:2px 0;">Inv. No #</th>
          <th style="text-align:right;padding:2px 0;width:26%;">Total</th>
        </tr></thead>
        <tbody>
          ${invoices.map((i) => `<tr>
            <td style="padding:2px 0;">${esc(i.processed)}</td>
            <td style="padding:2px 0;">${esc(i.number)}</td>
            <td style="padding:2px 0;text-align:right;white-space:nowrap;">${fmt(Number(i.total) || 0)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
      <table style="width:100%;border-collapse:collapse;margin-top:8px;">
        <tbody>
          ${row("Total Paid", paid, true)}
          ${row("Invoices Paid", String(invoicesPaid))}
          ${safeAmount(unallocated) > 0 ? row("Unallocated Payment Amount", fmt(safeAmount(unallocated))) : ""}
          ${methodName ? row(esc(methodName), paid) : ""}
        </tbody>
      </table>
      <div style="margin-top:12px;">Account balance: ${fmt(balance)} as at ${esc(asAtText)}</div>
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
  assert(paymentReceiptTemplateOf({ statementTemplate: "S" }) === null, "statement template is NOT a fallback");
  assert(paymentReceiptTemplateOf({ paymentReceiptTemplate: "P", statementTemplate: "S" }) === "P", "payment template");
  const html = buildPaymentReceiptHtml({
    business: { name: "PREMIX KING - Portland", address: "121 Percy Street,<br/>Portland VIC 3305", phone: "03 5523", abn: "86 653 852 861", logo: "" },
    dateText: "19th Nov 2018 4:42:00 pm",
    customer: { code: "", name: "Julie Barber <b>" },
    invoices: [{ processed: "07/11/2018 14:02:26", number: "7048277", total: 1068 }],
    totalPaid: 1070, methodName: "Cash", unallocated: 2, accountBalance: -2, asAtText: "27th Oct 2026 11:46:39 pm",
  }, null);
  assert(!html.includes("NaN"), "no NaN in html");
  assert(html.includes(">Payment<") && html.includes("Ph: 03 5523") && html.includes("ABN: 86 653 852 861"), "header + heading");
  assert(html.includes("Julie Barber &lt;b&gt;"), "html-escaped customer name");
  assert(html.includes("7048277") && html.includes("$1,068.00".replace(",", "")) , "invoice row with full total");
  assert(html.includes("Total Paid") && html.includes("Invoices Paid</td>") && html.includes(">1</td>"), "totals");
  assert(html.includes("Unallocated Payment Amount") && html.includes("$2.00"), "unallocated line when > 0");
  assert(html.includes("Account balance: -$2.00 as at 27th Oct 2026 11:46:39 pm"), "balance as at print time");
  const none = buildPaymentReceiptHtml({ business: null, dateText: "", customer: null, invoices: [], totalPaid: 5, methodName: "Cash", unallocated: 0, accountBalance: 0, asAtText: "" }, null);
  assert(!none.includes("Unallocated"), "no unallocated line at 0");
  assert(none.includes("Invoices Paid</td>") && none.includes(">0</td>"), "zero invoices");
  console.log("paymentReceipt self-check passed");
};

if (globalThis.process?.argv?.[1]?.replace(/\\/g, "/").endsWith("paymentReceipt.js")) demo();
