import React, { useEffect, useState } from "react";
import { Button, Dialog } from "@mui/material";
import paymentService from "../../services/paymentService";
import CustomerPaymentPanel from "./CustomerPaymentPanel";

// Reference "Customer Payment" popup (Sales History card, 14/10/2026): clicking a
// payment-method link on an invoice that was paid off later opens the payment
// itself — the same panel the Balance & Payments list expands inline, with a
// blue Close.
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{ sx: { width: "min(1760px, calc(100vw - 64px))", m: 2, borderRadius: 0, bgcolor: "#f8f8f8", color: "#000" } }}
    >
      <CustomerPaymentPanel
        payment={payment}
        loading={!payment && !error}
        error={error}
        formatDate={formatDate}
        formatTime={formatTime}
        actions={
          <Button
            disableElevation
            onClick={onClose}
            sx={{ width: "100%", height: 40, bgcolor: "#1a73e8", color: "#fff", borderRadius: "3px", fontSize: 16, textTransform: "none", "&:hover": { bgcolor: "#1765cc" } }}
          >
            ✕ Close
          </Button>
        }
      />
    </Dialog>
  );
};

export default CustomerPaymentDialog;
