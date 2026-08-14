import React from "react";
import { Box, MenuItem, Select } from "@mui/material";
import { CheckCircleOutlined } from "@mui/icons-material";
import settingsService from "../../services/settingsService";
import { saleBasePrice } from "../../utils/saleTotals";
import { formatCurrency } from "../../utils/currency";

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
            {settingsService.padInvoice(sale.invoiceNumber) || sale.saleNumber}
          </Box>
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
            }}
          >
            <CheckCircleOutlined sx={{ fontSize: 18 }} />
            {sale.status
              ? sale.status.charAt(0) + sale.status.slice(1).toLowerCase()
              : ""}
          </Box>
          <Box sx={cell}>{sale.outlet?.name || outletName || ""}</Box>
          <Box sx={cell}>
            {sale.register?.name || sale.registerId || "Register"}
          </Box>
          <Box sx={cell}>{sale.user?.name}</Box>
          {/* Local addition: without this the operator cannot see who Assign
              Customer attached to the sale. */}
          {sale.customer && <Box sx={cell}>{customerName(sale.customer)}</Box>}
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
              ["Tax", formatCurrency(sale.tax)],
              ["Loyalty Value", sale.loyaltyValue],
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
        <Box>
          {sale.items?.map((item, index) => (
            <Box
              key={index}
              sx={{
                display: "flex",
                fontSize: "19.2px",
                lineHeight: "23px",
                mb: "16px",
              }}
            >
              <Box sx={{ mr: "16px" }}>{item.quantity}</Box>
              {/* ponytail: sale items don't record case vs unit, so the type
                  word is just the pluralised Item. */}
              <Box sx={{ mr: "16px" }}>
                {Math.abs(item.quantity) === 1 ? "Item" : "Items"}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0, mr: "16px" }}>
                {item.comboName || item.productName}
              </Box>
              <Box>{formatCurrency(item.totalPrice)}</Box>
            </Box>
          ))}
        </Box>

        {/* Payments — the name becomes a method select while editing */}
        <Box sx={{ my: "8px" }}>
          {payments.map((p, idx) => (
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
                ) : (
                  p.paymentMethod || "Payment"
                )}
              </Box>
              <Box sx={{ textAlign: "right" }}>{formatCurrency(p.amount || 0)}</Box>
            </Box>
          ))}
        </Box>

        {sale.giftCardTransactions?.length > 0 && (
          <Box sx={{ mb: "8px" }}>
            {sale.giftCardTransactions.map((t, idx) => (
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
            <SplitPrice value={sale.balance} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default SaleDetailCard;
