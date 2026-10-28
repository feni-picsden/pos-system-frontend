import React, { useState } from "react";
import { Box, Button, Collapse } from "@mui/material";
import { CheckCircleOutlined } from "@mui/icons-material";
import CustomerPaymentPanel, { paymentActionSx } from "../SalesHistory/CustomerPaymentPanel";
import { SplitPrice, customerName } from "../SalesHistory/SaleDetailCard";

// Reference Balance & Payments > Payment History: one row per payment (tick,
// date / time, Outlet / Register / User, the amount with the customer under it
// and a faint "payment" watermark). Clicking a row swaps it for the payment
// panel in place — Close / Print / Refund / Cancel on the right — and clicking
// Close puts the row back. Several panels may be open at once.
const PaymentHistoryList = ({ payments, customer, formatDate, formatTime, onPrint, onRefund, onCancel }) => {
  const [openIds, setOpenIds] = useState([]);
  const isOpen = (p) => openIds.includes(p.id);
  const toggle = (p) => setOpenIds((ids) => (ids.includes(p.id) ? ids.filter((x) => x !== p.id) : [...ids, p.id]));

  return (
    <Box>
      {payments.map((payment, index) => {
        const name = customerName(payment.customer || customer);
        return (
          <Box key={payment.id} sx={{ bgcolor: index % 2 ? "#ebebeb" : "#f8f8f8" }}>
            {!isOpen(payment) && (
              <Box
                onClick={() => toggle(payment)}
                data-payment-row={payment.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  height: 108,
                  p: "16px",
                  color: "#000",
                  cursor: "pointer",
                  position: "relative",
                  overflow: "hidden",
                  "&:hover": { bgcolor: "#e3e3e3" },
                }}
              >
                <Box sx={{ width: 40, flexShrink: 0, textAlign: "center", lineHeight: 0 }}>
                  <CheckCircleOutlined titleAccess="Completed" sx={{ fontSize: 32, color: "#000" }} />
                </Box>
                <Box sx={{ width: 371, flexShrink: 0, ml: "16px", textAlign: "center" }}>
                  <Box sx={{ fontSize: "19.2px", lineHeight: "23px" }}>{formatDate(payment.paymentDate)}</Box>
                  <Box sx={{ fontSize: "19.2px", lineHeight: "23px" }}>{formatTime(payment.paymentDate)}</Box>
                </Box>
                <Box sx={{ flex: 1, minWidth: 0, fontSize: "13.44px", lineHeight: "16px", px: 2 }}>
                  <Box>{payment.outlet?.name || ""}</Box>
                  <Box>{payment.register?.name || ""}</Box>
                  <Box>{payment.user?.name || ""}</Box>
                </Box>
                <Box sx={{ width: 300, flexShrink: 0, textAlign: "right", fontSize: 32, position: "relative", zIndex: 1 }}>
                  <SplitPrice value={payment.total} />
                  <Box sx={{ fontSize: "13.44px", lineHeight: "16px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {name}
                  </Box>
                </Box>
                {/* faint "payment" watermark under the amount (reference) */}
                <Box
                  aria-hidden
                  sx={{ position: "absolute", right: 24, bottom: 4, fontSize: 44, fontWeight: 700, color: "rgba(0,0,0,0.07)", lineHeight: 1, pointerEvents: "none", userSelect: "none" }}
                >
                  payment
                </Box>
              </Box>
            )}
            <Collapse in={isOpen(payment)} timeout={400} easing="ease-in-out" unmountOnExit>
              <Box data-payment-panel={payment.id} sx={{ p: "16px 0", boxShadow: "0 0 30px rgba(0,0,0,.35), 0 15px 30px rgba(0,0,0,.27)", bgcolor: "#f8f8f8", mb: "32px" }}>
                <CustomerPaymentPanel
                  payment={{ ...payment, customer: payment.customer || customer }}
                  formatDate={formatDate}
                  formatTime={formatTime}
                  actions={
                    <>
                      <Button disableElevation onClick={() => toggle(payment)} sx={{ ...paymentActionSx(true), mb: "32px" }}>
                        ✕ Close
                      </Button>
                      {[
                        ["Print", () => onPrint(payment), Boolean(onPrint)],
                        // A reversal row is itself the refund — it cannot be refunded or cancelled again.
                        ["Refund", () => onRefund(payment), Boolean(onRefund) && !payment.isReversal],
                        ["Cancel", () => onCancel(payment), Boolean(onCancel) && !payment.isReversal],
                      ].filter(([, , allowed]) => allowed).map(([label, onClick]) => (
                        <Button key={label} disableElevation onClick={onClick} sx={{ ...paymentActionSx(false), mb: "8px" }}>
                          {label}
                        </Button>
                      ))}
                    </>
                  }
                />
              </Box>
            </Collapse>
          </Box>
        );
      })}
    </Box>
  );
};

export default PaymentHistoryList;
