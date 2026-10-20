import React, { useState } from "react";
import { Box, MenuItem, Select } from "@mui/material";
import { CheckCircleOutlined, HighlightOffOutlined } from "@mui/icons-material";
import CustomerPaymentDialog from "./CustomerPaymentDialog";
import settingsService from "../../services/settingsService";
import { saleBasePrice, itemsPerCase } from "../../utils/saleTotals";
import { saleItemDisplay } from "../../utils/caseLine";
import posLocalDb from "../../services/posLocalDb";
import { formatCurrency } from "../../utils/currency";
import { saleOutstanding, isOnAccountPayment, INCOMPLETE_PURPLE } from "../../utils/saleOutstanding";

// One place builds a customer's display name — list rows, sale details and both
// customer pickers all route through it.
export const customerName = (c) =>
  c
    ? `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.company || `#${c.id}`
    : "";

// Reference prints the cents at 70% of the dollar size (.notranslate > .cents).
export const SplitPrice = ({ value, sx }) => {
  const [dollars, cents] = formatCurrency(value).split(/\.(?=\d{2}$)/);
  return (
    <Box component="span" sx={sx}>
      {dollars}
      {cents !== undefined && (
        <>
          .<Box component="span" sx={{ fontSize: "70%" }}>{cents}</Box>
        </>
      )}
    </Box>
  );
};

// The sale's own method (incl. pseudo-methods like "Parked") may not be one of the
// outlet's configured methods — keep it in the list so the select never renders
// empty and Save can't blank out the real payment method.
const methodOptions = (paymentMethods, current) => [
  ...new Set([...paymentMethods.map((m) => m.name || m), current].filter(Boolean)),
];

// The expanded sale card from the reference (.sale-line.expanded): a two-column
// grid — content on the left, the 371px action rail on the right — with the
// summary on row 1 and products / payments / balance on row 2. Modify Details
// renders the SAME card with `editing` on, which is where the date field and the
// payment-method selects come from.
const SaleDetailCard = ({
  sale,
  formatDate,
  formatTime,
  outletName,
  actions,
  actionsWidth = 371,
  editing = false,
  message,
  dateValue,
  onDateChange,
  paymentValues = [],
  onPaymentChange,
  paymentMethods = [],
}) => {
  const payments =
    sale.payments && sale.payments.length > 0
      ? sale.payments
      : [{ paymentMethod: sale.paymentMethod, amount: sale.totalAmount }];

  const cell = { fontSize: 16, lineHeight: "19px" };

  // Reference labels for a card cash-out (ref screenshot 14/10/2026: "EFTPOS
  // Cashout $190.00" then "Cash (Cash Out) -$170.00"). We store that sale as the
  // card tender for goods + cash and a negative "Cash (Change)" row for the cash
  // handed over, so the labels are derived: a non-cash tender alongside a change
  // row is a cash-out; an ordinary cash sale keeps "Cash (Change)".
  const isChangeRow = (p) => String(p?.paymentMethod || "").trim().toLowerCase() === "cash (change)";
  const isCashRow = (p) => String(p?.paymentMethod || "").trim().toLowerCase() === "cash";
  // Change can only come back on a cash tender, so a change row WITHOUT any cash
  // paid in is money handed out against a card: a cash-out. "Gift Voucher $50 +
  // Cash $20 + Cash (Change) -$2" (ref) stays an ordinary change.
  const cashOutSale =
    payments.some(isChangeRow) &&
    !payments.some((p) => isCashRow(p) && (parseFloat(p.amount) || 0) > 0) &&
    payments.some((p) => !isChangeRow(p) && !isCashRow(p) && !isOnAccountPayment(p) && (parseFloat(p.amount) || 0) > 0);
  // Reference prints the voucher / gift card number after the method:
  // "Gift Voucher (20040) $50.00".
  const giftCodes = (sale.giftCardTransactions || [])
    .filter((t) => /redemption/i.test(t.transactionType || ""))
    .map((t) => t.giftCard?.code)
    .filter(Boolean);
  // A customer payment taken after the sale (Customer Payment screen). New rows
  // carry the user who took them; older ones are recognised by landing well
  // after the sale itself on a customer's invoice.
  const isCustomerPaymentRow = (p) => {
    if (!p?.id || isChangeRow(p) || isOnAccountPayment(p)) return false;
    if (p.userId != null) return true;
    if (!sale.customerId && !sale.customer) return false;
    const paidAt = new Date(p.createdAt).getTime();
    const soldAt = new Date(sale.saleDate).getTime();
    return Number.isFinite(paidAt) && Number.isFinite(soldAt) && paidAt - soldAt > 60 * 1000;
  };
  const [openPaymentId, setOpenPaymentId] = useState(null);

  const paymentLabel = (p) => {
    let name = p.paymentMethod || "Payment";
    if (/gift (card|voucher)/i.test(name) && giftCodes.length) name = `${name} (${giftCodes.join(", ")})`;
    // Reference prints the cash-rounding bookkeeping row as "(Rounding)".
    if (/^rounding$/i.test(name.trim())) name = "(Rounding)";
    if (!cashOutSale) return name;
    if (isChangeRow(p)) return "Cash (Cash Out)";
    if (!isCashRow(p) && !isOnAccountPayment(p) && (parseFloat(p.amount) || 0) > 0) return `${name} Cashout`;
    return name;
  };

  // Reference: a sale that still owes money (On Account, unpaid) reads
  // "○ Incomplete" in purple, lists no "On Account" tender (it is money owed, not
  // money taken) and its Balance is what is still owed.
  const owed = saleOutstanding(sale);
  const cancelled = sale.status === "CANCELLED";
  const parked = sale.status === "PARKED";
  const incomplete = !cancelled && !parked && owed > 0;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: `1fr ${actionsWidth}px`,
        // The action rail is taller than the left column on a small sale. Give the
        // summary only the height it needs so the slack lands BELOW the products,
        // instead of being split between the rows and pushing the lines down.
        gridTemplateRows: message ? "min-content min-content 1fr" : "min-content 1fr",
        gap: "32px",
        p: "16px",
        color: "#000",
        boxShadow: editing
          ? "none"
          : "0 0 30px rgba(0,0,0,.35),0 15px 30px rgba(0,0,0,.27)",
      }}
    >
      {message && (
        <Box sx={{ gridColumn: "1", fontSize: 16, lineHeight: "19px" }}>
          {message}
        </Box>
      )}

      {/* .sale-line-summary — three equal centred columns */}
      <Box
        sx={{
          gridColumn: "1",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          columnGap: "8px",
          textAlign: "center",
          // Without this the totals table stretches to the row height and its
          // rows spread out — the reference keeps every column top-aligned.
          alignItems: "start",
        }}
      >
        {/* Date / total / invoice */}
        <Box>
          {editing ? (
            <Box
              component="input"
              type="datetime-local"
              step="1"
              value={dateValue}
              onChange={(e) => onDateChange(e.target.value)}
              sx={{
                width: "100%",
                maxWidth: 216,
                height: 40,
                boxSizing: "border-box",
                p: "8px",
                fontSize: 16,
                textAlign: "center",
                border: "1px solid #000",
                borderRadius: 0,
              }}
            />
          ) : (
            <Box sx={{ fontSize: "17.6px", lineHeight: "21px" }}>
              {formatDate(sale.saleDate)} {formatTime(sale.saleDate)}
            </Box>
          )}
          <Box sx={{ fontSize: "25.6px", lineHeight: "30px" }}>
            <SplitPrice value={sale.totalAmount} />
          </Box>
          <Box sx={cell}>
            #{settingsService.padInvoice(sale.invoiceNumber, sale.invoiceSuffix) || String(sale.saleNumber || "").replace(/^#/, "")}
          </Box>
          {/* Reference: the sale's customer sits under the invoice number
              (ref screenshots 14/10/2026: "Buangor Community Sports Centre"). */}
          {sale.customer && <Box sx={cell}>{customerName(sale.customer)}</Box>}
        </Box>

        {/* Status / outlet / register / user */}
        <Box>
          <Box
            sx={{
              fontSize: "17.6px",
              lineHeight: "21px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              color: cancelled ? "rgb(227,52,47)" : parked ? "#1e88e5" : incomplete ? INCOMPLETE_PURPLE : "inherit",
            }}
          >
            {/* Reference glyph + label per status (ref screenshots 14/10/2026):
                red circled X "Cancelled", blue circled P "Parked", purple hollow
                circle "Incomplete", black tick "Completed". */}
            {cancelled ? (
              <HighlightOffOutlined sx={{ fontSize: 18 }} />
            ) : parked ? (
              <Box sx={{ width: 16, height: 16, borderRadius: "50%", border: "1.5px solid #1e88e5", boxSizing: "border-box", fontSize: 10, fontWeight: 700, lineHeight: "13px", textAlign: "center" }}>P</Box>
            ) : incomplete ? (
              <Box sx={{ width: 16, height: 16, borderRadius: "50%", border: `1.5px solid ${INCOMPLETE_PURPLE}`, boxSizing: "border-box" }} />
            ) : (
              <CheckCircleOutlined sx={{ fontSize: 18 }} />
            )}
            {cancelled
              ? "Cancelled"
              : parked
                ? "Parked"
                : incomplete
                  ? "Incomplete"
                  : sale.status
                    ? sale.status.charAt(0) + sale.status.slice(1).toLowerCase()
                    : ""}
          </Box>
          <Box sx={cell}>{sale.outlet?.name || outletName || ""}</Box>
          <Box sx={cell}>
            {sale.register?.name || sale.registerId || "Register"}
          </Box>
          <Box sx={cell}>{sale.user?.name}</Box>
        </Box>

        {/* Totals table, right-aligned inside the column */}
        <Box
          component="table"
          sx={{
            ml: "auto",
            borderCollapse: "collapse",
            "& td": { p: "4.8px", ...cell },
            "& td:first-of-type": { textAlign: "right" },
            "& td:last-of-type": { textAlign: "left" },
          }}
        >
          <tbody>
            {[
              ["Base Price", formatCurrency(saleBasePrice(sale))],
              ["Savings", formatCurrency(sale.savings)],
              ["Discount", formatCurrency(sale.discount)],
              // Reference totals block stops at Tax (no Loyalty Value row).
              ["Tax", formatCurrency(sale.tax)],
            ].map(([label, value]) => (
              <tr key={label}>
                <td>{label}</td>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </Box>
      </Box>

      {/* .sale-line-actions — spans both grid rows */}
      <Box sx={{ gridColumn: "2", gridRow: "1 / -1" }}>
        {actions}
      </Box>

      {/* .sale-line-center — products, payments, balance */}
      <Box sx={{ gridColumn: "1", display: "flex", flexDirection: "column" }}>
        {/* Reference: the sale note sits above the lines as a small grey
            "SALE NOTE" label over the text (ref screenshots 14/10/2026). */}
        {/* Cancelled sale: reference "CANCELLATION REASON" block. Sales cancelled
            before the reason had its own field carried it in the note (the cancel
            overwrote the note), so that note reads as the reason. */}
        {[
          ["CANCELLATION REASON", cancelled ? sale.cancelReason || sale.notes : null],
          ["SALE NOTE", cancelled && !sale.cancelReason ? null : sale.notes],
        ].filter(([, text]) => text && String(text).trim()).map(([label, text]) => (
          <Box key={label} sx={{ mb: "16px" }}>
            <Box sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "#757575", lineHeight: "13px" }}>{label}</Box>
            <Box sx={{ ...cell, whiteSpace: "pre-wrap" }}>{text}</Box>
          </Box>
        ))}
        <Box>
          {sale.items?.map((item, index) => {
            // A line sold as a case reads "1 Case <name>" (reference); the case
            // size comes from the cached product, the words from Setup > General.
            const { caseText, singleText } = settingsService.getCachedGeneralSettings();
            const shown = saleItemDisplay(
              item,
              itemsPerCase(item.productId ? posLocalDb.getProductById(item.productId) : null),
              { caseText: caseText || "Case", singleText: singleText || "Item" }
            );
            const lineNote = String(item.note || "").trim();
            return (
              <React.Fragment key={index}>
                <Box
                  sx={{
                    display: "flex",
                    fontSize: "19.2px",
                    lineHeight: "23px",
                    mb: "16px",
                  }}
                >
                  <Box sx={{ mr: "16px" }}>{shown.qty}</Box>
                  <Box sx={{ mr: "16px" }}>{shown.word}</Box>
                  <Box sx={{ flex: 1, minWidth: 0, mr: "16px" }}>
                    {item.comboName || item.productName}
                  </Box>
                  <Box>{formatCurrency(item.totalPrice)}</Box>
                </Box>
                {/* Reference: a product (line) note is a grey band under its line,
                    italic (ref screenshots 14/10/2026: "CL" rows). */}
                {lineNote && (
                  <Box sx={{ bgcolor: "#e0e0e0", px: "24px", py: "16px", mb: "16px", fontSize: 14, fontStyle: "italic", whiteSpace: "pre-wrap" }}>
                    {lineNote}
                  </Box>
                )}
              </React.Fragment>
            );
          })}
        </Box>

        {/* Payments — the name becomes a method select while editing */}
        <Box sx={{ my: "8px" }}>
          {payments.map((p, idx) => (!editing && isOnAccountPayment(p)) ? null : (
            <Box
              key={idx}
              sx={{ display: "flex", alignItems: "center", ...cell, mb: editing ? "8px" : 0 }}
            >
              <Box sx={{ flex: 1, textAlign: "right", mr: "16px" }}>
                {editing ? (
                  <Select
                    size="small"
                    fullWidth
                    value={paymentValues[idx] ?? p.paymentMethod ?? ""}
                    onChange={(e) => onPaymentChange(idx, e.target.value)}
                    sx={{ borderRadius: "8px", fontSize: 16, bgcolor: "#fff" }}
                  >
                    {methodOptions(paymentMethods, p.paymentMethod).map((name) => (
                      <MenuItem key={name} value={name}>
                        {name}
                      </MenuItem>
                    ))}
                  </Select>
                ) : isCustomerPaymentRow(p) ? (
                  // Reference: a payment taken LATER (Customer Payment screen) is a
                  // blue link that opens the "Customer Payment" popup.
                  <Box
                    component="a"
                    href="#"
                    onClick={(e) => { e.preventDefault(); setOpenPaymentId(p.id); }}
                    sx={{ color: "#1a73e8", textDecoration: "underline", cursor: "pointer" }}
                  >
                    {paymentLabel(p)}
                  </Box>
                ) : cancelled ? (
                  // Reference: a cancelled sale lists its tenders as "Cancelled Cash",
                  // "Cancelled Cash (Change)".
                  `Cancelled ${paymentLabel(p)}`
                ) : (
                  paymentLabel(p)
                )}
              </Box>
              <Box sx={{ textAlign: "right" }}>{formatCurrency(p.amount || 0)}</Box>
            </Box>
          ))}
        </Box>

        {/* Gift card movements other than the redemption already shown as the
            "Gift Card (code)" tender line (e.g. a card loaded by this sale). */}
        {sale.giftCardTransactions?.filter((t) => !/redemption/i.test(t.transactionType || "")).length > 0 && (
          <Box sx={{ mb: "8px" }}>
            {sale.giftCardTransactions.filter((t) => !/redemption/i.test(t.transactionType || "")).map((t, idx) => (
              <Box key={idx} sx={{ display: "flex", ...cell }}>
                <Box sx={{ flex: 1, textAlign: "right", mr: "16px" }}>
                  {t.giftCard.code} ({t.transactionType})
                </Box>
                <Box>{formatCurrency(t.amount || 0)}</Box>
              </Box>
            ))}
          </Box>
        )}

        {/* Balance — 30% wide, pushed right, 3px rail on top */}
        <Box
          sx={{
            display: "flex",
            width: "30%",
            ml: "auto",
            pt: "8px",
            borderTop: "3px solid #000",
            fontSize: 24,
            lineHeight: "29px",
          }}
        >
          <Box sx={{ flex: 1, textAlign: "right", mr: "16px" }}>Balance</Box>
          <Box>
            {/* Reference: a cancelled sale's Balance is its total (nothing was
                kept), e.g. #001455 $12.00 with "Cancelled Cash $12.00". */}
            <SplitPrice value={incomplete ? owed : cancelled ? sale.totalAmount : sale.balance} />
          </Box>
        </Box>
      </Box>
      <CustomerPaymentDialog
        open={openPaymentId != null}
        salePaymentId={openPaymentId}
        onClose={() => setOpenPaymentId(null)}
        formatDate={formatDate}
        formatTime={formatTime}
      />
    </Box>
  );
};

export default SaleDetailCard;
