import React, { useEffect, useState } from "react";
import { Box, Button, CircularProgress, Dialog } from "@mui/material";
import { CheckCircleOutlined } from "@mui/icons-material";
import paymentService from "../../services/paymentService";
import settingsService from "../../services/settingsService";
import { formatCurrency } from "../../utils/currency";
import { SplitPrice, customerName } from "./SaleDetailCard";

// Reference "Customer Payment" popup (Sales History card, 14/10/2026): clicking a
// payment-method link on an invoice that was paid off later opens the payment
// itself — when it was taken, by whom and where, its reference, and every invoice
// it was applied to (date / time, invoice number, amount), with a blue Close.
const cell = { fontSize: 16, lineHeight: "19px" };

const CustomerPaymentDialog = ({ salePaymentId, open, onClose, formatDate, formatTime }) => {
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !salePaymentId) return;
    let cancelled = false;
    setPayment(null);
    setError("");
    paymentService
      .getCustomerPayment(salePaymentId)
      .then((p) => { if (!cancelled) setPayment(p); })
      .catch((e) => { if (!cancelled) setError(e?.response?.data?.error || "Failed to load payment"); });
    return () => { cancelled = true; };
  }, [open, salePaymentId]);

  const when = (d) => `${formatDate(d)} ${formatTime(d)}`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{ sx: { width: "min(1760px, calc(100vw - 64px))", m: 2, borderRadius: 0, bgcolor: "#f8f8f8", color: "#000" } }}
    >
      <Box sx={{ p: "16px", display: "grid", gridTemplateColumns: "1fr 371px", gap: "32px" }}>
        {/* While loading / on error the left column keeps the finished layout's
            height so the dialog does not jump and Close stays top-right. */}
        {!payment && !error && (
          <Box sx={{ gridColumn: "1", minHeight: 96, display: "flex", alignItems: "center", justifyContent: "center" }}><CircularProgress size={28} /></Box>
        )}
        {error && <Box sx={{ gridColumn: "1", minHeight: 96, color: "rgb(227,52,47)", ...cell }}>{error}</Box>}
        {payment && (
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
              <Box sx={{ fontSize: "17.6px", lineHeight: "21px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                <CheckCircleOutlined sx={{ fontSize: 18 }} /> Completed
              </Box>
              {payment.outlet?.name && <Box sx={cell}>{payment.outlet.name}</Box>}
              {payment.register?.name && <Box sx={cell}>{payment.register.name}</Box>}
              {payment.user?.name && <Box sx={cell}>{payment.user.name}</Box>}
            </Box>
            {/* Total / method / invoices applied to */}
            <Box component="table" sx={{ ml: "auto", borderCollapse: "collapse", "& td": { ...cell, p: "0 0 2px 0" }, "& td:first-of-type": { textAlign: "right", pr: "8px" }, "& td:last-of-type": { textAlign: "left" } }}>
              <tbody>
                <tr><td>Total</td><td>{formatCurrency(payment.total)}</td></tr>
                <tr><td>Payment Method</td><td>{payment.paymentMethod}</td></tr>
                <tr><td>Invoices Applied To</td><td>{payment.invoices.length}</td></tr>
              </tbody>
            </Box>
          </Box>
        )}
        <Box>
          <Button
            disableElevation
            onClick={onClose}
            sx={{ width: "100%", height: 40, bgcolor: "#1a73e8", color: "#fff", borderRadius: "3px", fontSize: 16, textTransform: "none", "&:hover": { bgcolor: "#1765cc" } }}
          >
            ✕ Close
          </Button>
        </Box>
        {payment && (
          <Box sx={{ gridColumn: "1", mt: "8px" }}>
            {payment.invoices.map((inv) => (
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
    </Dialog>
  );
};

export default CustomerPaymentDialog;
