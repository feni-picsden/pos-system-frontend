import React, { useState } from "react";
import { Box, Button, CircularProgress, Collapse, Typography } from "@mui/material";
import SaleDetailCard from "../SalesHistory/SaleDetailCard";
import SaleListRow from "../SalesHistory/SaleListRow";
import { paymentActionSx } from "../SalesHistory/CustomerPaymentPanel";
import { formatSettingsDate, formatSettingsTime } from "../../utils/appDateTime";

// Sales History on the customer and customer-group pages: the SAME rows and
// expanded card as the Sales History page (reference), with the action rail
// trimmed to what those pages offer. Several cards may be open at once; a card
// closes only from its own Close button.
const CustomerSalesHistory = ({
  sales,
  loading,
  outletName = "",
  onReprint,
  onEmail,
  onReturnItems,
  onReloadSale,
  onContinueSale,
  emptyText = "No sales history found",
}) => {
  const [openSaleIds, setOpenSaleIds] = useState([]);
  const open = (id) => setOpenSaleIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
  const close = (id) => setOpenSaleIds((ids) => ids.filter((x) => x !== id));

  // Reference (checked 19-20/10/2026): a cancelled sale offers only Reload Sale;
  // a parked one Reprint / Email / Continue Sale; otherwise Reprint / Email /
  // Return Items.
  const actionsFor = (sale) =>
    (sale.status === "CANCELLED"
      ? [["Reload Sale", onReloadSale]]
      : sale.status === "PARKED"
        ? [["Reprint Receipt", onReprint], ["Email Receipt", onEmail], ["Continue Sale", onContinueSale]]
        : [["Reprint Receipt", onReprint], ["Email Receipt", onEmail], ["Return Items", onReturnItems]]
    ).filter(([, handler]) => typeof handler === "function");

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!sales.length) {
    return (
      <Box sx={{ py: 6, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">{emptyText}</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {sales.map((sale, index) => (
        <Box key={`sale-${sale.id}`} data-sale-row={sale.id}>
          {!openSaleIds.includes(sale.id) && (
            <SaleListRow
              sale={sale}
              formatDate={formatSettingsDate}
              formatTime={formatSettingsTime}
              outletName={outletName}
              zebra={index % 2 === 1}
              onClick={() => open(sale.id)}
            />
          )}
          <Collapse in={openSaleIds.includes(sale.id)} timeout={400} easing="ease-in-out" unmountOnExit>
            <Box sx={{ bgcolor: index % 2 ? "#ebebeb" : "#f8f8f8", p: "16px 0" }}>
              <SaleDetailCard
                sale={sale}
                formatDate={formatSettingsDate}
                formatTime={formatSettingsTime}
                outletName={outletName}
                actions={
                  <>
                    <Button disableElevation onClick={() => close(sale.id)} sx={{ ...paymentActionSx(true), mb: "32px" }}>
                      ✕ Close
                    </Button>
                    {actionsFor(sale).map(([label, handler]) => (
                      <Button key={label} disableElevation onClick={() => handler(sale)} sx={{ ...paymentActionSx(false), mb: "8px" }}>
                        {label}
                      </Button>
                    ))}
                  </>
                }
              />
            </Box>
          </Collapse>
        </Box>
      ))}
    </Box>
  );
};

export default CustomerSalesHistory;
