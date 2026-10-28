import React from "react";
import { Box } from "@mui/material";
import { CheckCircleOutlined, HighlightOffOutlined } from "@mui/icons-material";
import settingsService from "../../services/settingsService";
import { saleOutstanding, INCOMPLETE_PURPLE } from "../../utils/saleOutstanding";
import { SplitPrice, customerName } from "./SaleDetailCard";

// The collapsed sale row from the reference (.sale-line): status glyph, date /
// time / invoice number, Outlet / Register / User, the total (owed under it)
// and the customer. Sales History's own row and the customer / customer-group
// pages all print the same thing.
const SaleListRow = ({ sale, formatDate, formatTime, outletName, onClick, zebra = false }) => (
  <Box
    onClick={onClick}
    sx={{
      display: "flex",
      alignItems: "center",
      height: 89,
      p: "16px",
      color: "#000",
      bgcolor: zebra ? "#ebebeb" : "#f8f8f8",
      cursor: onClick ? "pointer" : "default",
      "&:hover": onClick ? { bgcolor: "#e3e3e3" } : undefined,
    }}
  >
    {/* .sale-line-status — 40px fixed-width 32px glyph */}
    <Box sx={{ width: 40, flexShrink: 0, textAlign: "center", lineHeight: 0 }}>
      {sale.status === "CANCELLED" ? (
        <HighlightOffOutlined titleAccess="Cancelled" sx={{ fontSize: 32, color: "rgb(227,52,47)" }} />
      ) : sale.status === "PARKED" ? (
        <Box
          title="Parked"
          sx={{ width: 28, height: 28, m: "2px auto", borderRadius: "50%", border: "2px solid #1e88e5", color: "#1e88e5", fontSize: 17, fontWeight: 700, lineHeight: "24px", textAlign: "center", boxSizing: "border-box" }}
        >
          P
        </Box>
      ) : saleOutstanding(sale) > 0 ? (
        <Box title="Incomplete" sx={{ width: 28, height: 28, m: "2px auto", borderRadius: "50%", border: `2px solid ${INCOMPLETE_PURPLE}` }} />
      ) : (
        <CheckCircleOutlined titleAccess="Completed" sx={{ fontSize: 32, color: "#000" }} />
      )}
    </Box>

    {/* date / time / invoice, centred */}
    <Box sx={{ width: 371, flexShrink: 0, ml: "16px", textAlign: "center" }}>
      <Box sx={{ fontSize: "19.2px", lineHeight: "23px" }}>{formatDate(sale.saleDate)}</Box>
      <Box sx={{ fontSize: "19.2px", lineHeight: "23px" }}>{formatTime(sale.saleDate)}</Box>
      <Box sx={{ fontSize: "13.44px", lineHeight: "16px" }}>
        #{settingsService.padInvoice(sale.invoiceNumber, sale.invoiceSuffix) || String(sale.saleNumber || "").replace(/^#/, "")}
      </Box>
    </Box>

    {/* Outlet / Register / User (+ sale note in the spare middle space) */}
    <Box sx={{ flex: 1, minWidth: 0, fontSize: "13.44px", lineHeight: "16px", px: 2, display: "flex" }}>
      <Box sx={{ flexShrink: 0, minWidth: 220 }}>
        <Box>{sale.outlet?.name || outletName || ""}</Box>
        <Box>{sale.register?.name || ""}</Box>
        <Box>{sale.user?.name || "Unknown User"}</Box>
      </Box>
      {sale.notes && String(sale.notes).trim() && !(sale.status === "CANCELLED" && !sale.cancelReason) && (
        <Box sx={{ flex: 1, minWidth: 0, pl: 4 }}>
          <Box sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "#757575", lineHeight: "13px" }}>SALE NOTE</Box>
          <Box sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sale.notes}</Box>
        </Box>
      )}
    </Box>

    {/* total (32px dollars, 22.4px cents), owed under it, then the customer */}
    <Box sx={{ width: 220, flexShrink: 0, textAlign: "center", fontSize: 32 }}>
      <SplitPrice value={sale.totalAmount} />
      {(saleOutstanding(sale) > 0 || (sale.status !== "COMPLETED" && (parseFloat(sale.balance) || 0) > 0)) && (
        <Box sx={{ fontSize: 16, lineHeight: "18px" }}>
          <SplitPrice value={saleOutstanding(sale) > 0 ? saleOutstanding(sale) : parseFloat(sale.balance) || 0} />
        </Box>
      )}
      {sale.customer && (
        <Box sx={{ fontSize: "13.44px", lineHeight: "16px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {customerName(sale.customer)}
        </Box>
      )}
    </Box>
  </Box>
);

export default SaleListRow;
