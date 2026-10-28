import React from "react";
import { Box } from "@mui/material";
import { CheckCircleOutlined, HighlightOff } from "@mui/icons-material";
import { INCOMPLETE_PURPLE } from "../../utils/saleOutstanding";

// Reference payment status glyphs (same language as the sale rows): black tick
// "Completed", purple hollow circle "Incomplete" (money still unallocated),
// red ✕ "Cancelled".
export const paymentStatusOf = (payment) => {
  const s = String(payment?.status || "COMPLETED").toUpperCase();
  if (s === "CANCELLED") return { key: "CANCELLED", label: "Cancelled", color: "rgb(227,52,47)" };
  if (s === "INCOMPLETE") return { key: "INCOMPLETE", label: "Incomplete", color: INCOMPLETE_PURPLE };
  return { key: "COMPLETED", label: "Completed", color: "#000" };
};

export const PaymentStatusGlyph = ({ payment, size = 32 }) => {
  const status = paymentStatusOf(payment);
  if (status.key === "CANCELLED") return <HighlightOff titleAccess="Cancelled" sx={{ fontSize: size, color: status.color }} />;
  if (status.key === "INCOMPLETE") {
    const d = Math.round(size * 0.875);
    // inline-block, no auto margins: inside the panel's flex status line an auto
    // margin swallowed the free space and pushed "Incomplete" away from the circle.
    return <Box component="span" title="Incomplete" sx={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, width: d, height: d, my: "2px", borderRadius: "50%", border: `2px solid ${status.color}`, boxSizing: "border-box" }} />;
  }
  return <CheckCircleOutlined titleAccess="Completed" sx={{ fontSize: size, color: status.color }} />;
};

export default PaymentStatusGlyph;
