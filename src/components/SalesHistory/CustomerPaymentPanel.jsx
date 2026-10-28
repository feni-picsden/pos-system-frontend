import React from "react";
import { Box, CircularProgress } from "@mui/material";
import settingsService from "../../services/settingsService";
import { PaymentStatusGlyph, paymentStatusOf } from "../Customers/PaymentStatus";
import { formatCurrency } from "../../utils/currency";
import { SplitPrice, customerName } from "./SaleDetailCard";

// Reference "Customer Payment" panel (Balance & Payments row click, and the
// popup behind a payment-method link on a Sales History card): when the payment
// was taken, by whom and where, its reference, every invoice it was applied to
// (date / time, invoice number, amount) and an action rail on the right.
const cell = { fontSize: 16, lineHeight: "19px" };

export const paymentActionSx = (primary) => ({
  width: "100%",
  height: 53,
  borderRadius: 0,
  fontSize: 16,
  fontWeight: 400,
  textTransform: "none",
  boxShadow: "none",
  bgcolor: primary ? "#1c86f2" : "#f8f8f8",
  color: primary ? "#f8f8f8" : "#313439",
  border: `1px solid ${primary ? "#f8f8f8" : "#313439"}`,
  "&:hover": { boxShadow: "none", bgcolor: primary ? "#1573d4" : "#ebebeb" },
});

const CustomerPaymentPanel = ({ payment, loading, error, actions, formatDate, formatTime, actionsWidth = 371 }) => {
  const when = (d) => `${formatDate(d)} ${formatTime(d)}`;

  return (
    <Box sx={{ p: "16px", display: "grid", gridTemplateColumns: `1fr ${actionsWidth}px`, gap: "32px", color: "#000" }}>
      {/* While loading / on error the left column keeps the finished layout's
          height so the panel does not jump and Close stays top-right. */}
      {loading && (
        <Box sx={{ gridColumn: "1", minHeight: 96, display: "flex", alignItems: "center", justifyContent: "center" }}><CircularProgress size={28} /></Box>
      )}
      {error && <Box sx={{ gridColumn: "1", minHeight: 96, color: "rgb(227,52,47)", ...cell }}>{error}</Box>}
      {payment && !loading && !error && (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", columnGap: "8px", textAlign: "center", alignItems: "start" }}>
          {/* Date / amount / reference / customer */}
          <Box>
            <Box sx={{ fontSize: "17.6px", lineHeight: "21px" }}>{when(payment.paymentDate)}</Box>
            <Box sx={{ fontSize: "25.6px", lineHeight: "30px" }}><SplitPrice value={payment.total} /></Box>
            {payment.reference && <Box sx={cell}>{payment.reference}</Box>}
            {payment.customer && <Box sx={cell}>{customerName(payment.customer)}</Box>}
          </Box>
          {/* Status / outlet / register / user */}
          <Box>
            <Box data-payment-status sx={{ fontSize: "17.6px", lineHeight: "21px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", color: paymentStatusOf(payment).color }}>
              <PaymentStatusGlyph payment={payment} size={18} /> {paymentStatusOf(payment).label}
            </Box>
            {payment.cancelledAt && <Box sx={cell}>{when(payment.cancelledAt)}</Box>}
            {payment.outlet?.name && <Box sx={cell}>{payment.outlet.name}</Box>}
            {payment.register?.name && <Box sx={cell}>{payment.register.name}</Box>}
            {payment.user?.name && <Box sx={cell}>{payment.user.name}</Box>}
          </Box>
          {/* Total / method / invoices applied to */}
          <Box component="table" sx={{ ml: "auto", borderCollapse: "collapse", "& td": { ...cell, p: "0 0 2px 0" }, "& td:first-of-type": { textAlign: "right", pr: "8px" }, "& td:last-of-type": { textAlign: "left" } }}>
            <tbody>
              <tr><td>Total</td><td>{formatCurrency(payment.total)}</td></tr>
              {/* Reference: the unallocated remainder is a separate line, shown only while there is one. */}
              {payment.unallocated > 0 && <tr data-panel-unallocated><td>Unallocated</td><td>{formatCurrency(payment.unallocated)}</td></tr>}
              <tr><td>Payment Method</td><td>{payment.paymentMethod}</td></tr>
              <tr><td>Invoices Applied To</td><td>{(payment.invoices || []).length}</td></tr>
            </tbody>
          </Box>
        </Box>
      )}
      <Box sx={{ gridColumn: "2", gridRow: "1 / -1" }}>{actions}</Box>
      {payment && !loading && !error && (
        <Box sx={{ gridColumn: "1", mt: "8px" }}>
          {(payment.invoices || []).map((inv) => (
            <Box key={inv.salePaymentId} sx={{ display: "flex", alignItems: "center", ...cell, height: 30 }}>
              <Box sx={{ width: 150, flexShrink: 0 }}>{when(inv.saleDate)}</Box>
              <Box sx={{ flex: 1, pl: "16px" }}>
                {settingsService.padInvoice(inv.invoiceNumber, inv.invoiceSuffix) || inv.saleNumber}
              </Box>
              <Box sx={{ textAlign: "right" }}>{formatCurrency(inv.amount)}</Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default CustomerPaymentPanel;
