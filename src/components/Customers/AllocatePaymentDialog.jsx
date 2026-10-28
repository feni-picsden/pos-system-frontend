import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TableFooter, TextField, Typography, Alert,
} from "@mui/material";
import settingsService from "../../services/settingsService";
import { useAppDialogs } from "../Common/AppDialogProvider";
import { formatCurrency } from "../../utils/currency";
import { formatSettingsDate, formatSettingsTime } from "../../utils/appDateTime";

// Reference: an Incomplete payment ("There is an unallocated payment." ->
// Allocate) is spread over the customer's outstanding invoices here. Same
// table as Make Payment (Timestamp / Invoice / User / Total / Outstanding /
// Allocation) with Autofill; each box is capped at the invoice's outstanding
// figure and the sum at what is still unallocated. A partial allocation is
// allowed — the payment stays Incomplete with the rest.
const headSx = {
  "& th": { bgcolor: "#5ebbeb", color: "white", fontWeight: 700, fontSize: 16, border: 0, height: 51, py: 0 },
  "& th:first-of-type": { borderTopLeftRadius: "12px", borderBottomLeftRadius: "12px" },
  "& th:last-of-type": { borderTopRightRadius: "12px", borderBottomRightRadius: "12px" },
};
const fieldSx = {
  width: 130,
  "& .MuiOutlinedInput-root": {
    fontSize: 16, borderRadius: "8px",
    "& .MuiOutlinedInput-notchedOutline": { borderColor: "#404040" },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#000", borderWidth: "2px" },
  },
};
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
// Same buttons as the Make Payment dialog (sky-blue filled, rounded).
const primaryButtonSx = {
  bgcolor: "#5ebbeb", color: "white", "&:hover": { bgcolor: "#4aa9dd", boxShadow: "none" },
  "&.Mui-disabled": { bgcolor: "#5ebbeb", color: "white", opacity: 0.6 },
  borderRadius: "12px", textTransform: "none", boxShadow: "none", fontWeight: 700, fontSize: 16, px: 4, height: 42,
};

const AllocatePaymentDialog = ({ open, payment, invoices = [], loading = false, onClose, onAllocate }) => {
  const { confirm } = useAppDialogs();
  const [allocations, setAllocations] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const unallocated = round2(payment?.unallocated);
  // Credits (negative lines) are not invoices money can be allocated against.
  const rows = useMemo(() => invoices.filter((s) => !s.isCredit && Number(s.outstandingAmount) > 0), [invoices]);

  useEffect(() => { if (open) { setAllocations({}); setError(""); } }, [open, payment?.id]);

  const allocated = round2(Object.values(allocations).reduce((s, a) => s + (Number(a) || 0), 0));
  const remaining = round2(unallocated - allocated);

  const change = (sale, value) => {
    const n = Math.min(Math.max(0, Number(value) || 0), round2(sale.outstandingAmount));
    setAllocations((prev) => ({ ...prev, [sale.id]: value === "" ? "" : n }));
  };
  const autofill = () => {
    let left = unallocated;
    const next = {};
    for (const sale of rows) {
      const take = Math.min(round2(sale.outstandingAmount), left);
      if (take > 0) { next[sale.id] = round2(take); left = round2(left - take); }
      if (left <= 0) break;
    }
    setAllocations(next);
  };
  const submit = async () => {
    const list = Object.entries(allocations).filter(([, a]) => Number(a) > 0).map(([saleId, a]) => ({ saleId: parseInt(saleId), amount: round2(a) }));
    if (!list.length) return setError("Allocate an amount to at least one invoice");
    if (allocated > unallocated + 0.004) return setError(`The allocations (${formatCurrency(allocated)}) exceed the unallocated amount (${formatCurrency(unallocated)})`);
    // Reference (help centre "Using Account Customers" > Allocating a Credit):
    // Complete, then Yes on the confirmation.
    const ok = await confirm(
      `Allocate ${formatCurrency(allocated)} of this payment to ${list.length} invoice${list.length === 1 ? '' : 's'}?`,
      { title: 'Allocate Payment', confirmText: 'Yes', cancelText: 'No' },
    );
    if (!ok) return;
    try {
      setBusy(true);
      setError("");
      await onAllocate(payment, list);
    } catch (err) {
      setError(err?.response?.data?.error || "The payment could not be allocated");
    } finally {
      setBusy(false);
    }
  };

  return (
    // Same box as Make Payment: wide, centred over the content panel (right nav
    // column reserved), title + grey note, "Outstanding Invoices" + Autofill,
    // table with a TOTAL row, Cancel / Allocate as sky-blue buttons.
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { mr: { md: "308px" }, maxHeight: "90vh" }, "data-allocate-dialog": "" }}
    >
      <DialogTitle>
        <Typography variant="h5" component="div" sx={{ fontWeight: "bold" }}>Allocate Payment</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {payment ? `${formatCurrency(payment.total)} ${payment.paymentMethod} payment on ${formatSettingsDate(payment.paymentDate)} ${formatSettingsTime(payment.paymentDate)}` : ""}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ overflow: "auto" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 2, mt: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: "bold" }}>Outstanding Invoices</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Typography data-allocate-remaining variant="body2" sx={{ color: "#676b72" }}>
              {formatCurrency(rows.reduce((s, r) => s + (Number(r.outstandingAmount) || 0), 0) - allocated)} Outstanding and {formatCurrency(remaining)} Unallocated
            </Typography>
            <Button onClick={autofill} variant="outlined" size="small">Autofill</Button>
          </Box>
        </Box>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TableContainer>
          <Table size="small" sx={{ borderCollapse: "separate", borderSpacing: 0 }}>
            <TableHead>
              <TableRow sx={headSx}>
                <TableCell>Timestamp</TableCell>
                <TableCell>Invoice</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Total</TableCell>
                <TableCell>Outstanding</TableCell>
                <TableCell>Allocation</TableCell>
              </TableRow>
            </TableHead>
            <TableBody sx={{ "& tr:nth-of-type(odd)": { bgcolor: "#ffffff" }, "& tr:nth-of-type(even)": { bgcolor: "#f5f5f5" }, "& td": { border: 0, fontSize: 16, color: "#000" } }}>
              {rows.map((sale) => (
                <TableRow key={sale.id} data-allocate-row={sale.id}>
                  <TableCell>{formatSettingsDate(sale.saleDate)} {formatSettingsTime(sale.saleDate)}</TableCell>
                  <TableCell>{settingsService.padInvoice(sale.invoiceNumber, sale.invoiceSuffix) || sale.saleNumber}</TableCell>
                  <TableCell>{sale.user?.name || "-"}</TableCell>
                  <TableCell>{formatCurrency(sale.totalAmount || 0)}</TableCell>
                  <TableCell>{formatCurrency(sale.outstandingAmount || 0)}</TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      value={allocations[sale.id] ?? ""}
                      onChange={(e) => change(sale, e.target.value)}
                      InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                      inputProps={{ min: 0, max: sale.outstandingAmount, step: 0.01 }}
                      sx={{ ...fieldSx, width: 120 }}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3 }}>{loading ? "Loading outstanding invoices..." : "No outstanding invoices to allocate against"}</TableCell></TableRow>
              )}
            </TableBody>
            {rows.length > 0 && (
              <TableFooter>
                <TableRow sx={{ "& td": { border: 0, fontSize: 16, color: "#000", fontWeight: 700 } }}>
                  <TableCell colSpan={3}>TOTAL</TableCell>
                  <TableCell>{formatCurrency(rows.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0))}</TableCell>
                  <TableCell>{formatCurrency(rows.reduce((s, r) => s + (Number(r.outstandingAmount) || 0), 0))}</TableCell>
                  <TableCell>{formatCurrency(allocated)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: 1, borderColor: "divider" }}>
        <Button onClick={onClose} disabled={busy} sx={primaryButtonSx}>Cancel</Button>
        <Button
          onClick={submit}
          disabled={busy || allocated <= 0}
          variant="contained"
          sx={primaryButtonSx}
        >
          {busy ? "Processing..." : "Complete"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AllocatePaymentDialog;
