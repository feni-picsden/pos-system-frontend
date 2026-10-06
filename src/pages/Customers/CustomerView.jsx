import React, { useState, useEffect } from "react";
import PageLoader from '../../components/Common/PageLoader';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Grid,
  Card,
  CardContent,
  Divider,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  InputAdornment,
  TableFooter,
  Collapse,
} from "@mui/material";
import {
  ArrowDropDown as ArrowDropDownIcon,
  Edit as EditIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Business as BusinessIcon,
  AccountBalance as AccountBalanceIcon,
  Person as PersonIcon,
  ShoppingCart as ShoppingCartIcon,
  Home as HomeIcon,
  History as HistoryIcon,
  RestoreFromTrash as RevisionIcon,
  CheckCircleOutlined as CheckCircleOutlinedIcon,
} from "@mui/icons-material";
import { useParams, useNavigate, useSearchParams, Link as RouterLink } from "react-router-dom";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { enAU } from "date-fns/locale";
import customerService from "../../services/customerService";
import loyaltyService from "../../services/loyaltyService";
import paymentService from "../../services/paymentService";
import paymentMethodService from "../../services/paymentMethodService";
import registerService from "../../services/registerService";
import salesService from "../../services/salesService";
import { emailSaleReceipt } from '../../services/receiptEmailSender';
import ConfirmDeleteDialog from "../../components/Common/ConfirmDeleteDialog";
import PrintReceiptDialog from "../../components/PrintReceiptDialog";
import EmailReceiptModal from "../../components/SalesHistory/EmailReceiptModal";
import { saleBasePrice, saleLineTotal } from "../../utils/saleTotals";
import { formatRevisionValue } from "../../utils/revisionValue";
import { formatCurrency } from "../../utils/currency";

// Make Payment dialog styling - the same set the Balance page's dialog uses,
// so the two Make Payment dialogs look identical.
const primaryButtonSx = {
  bgcolor: "#5ebbeb",
  "&:hover": { bgcolor: "#4aa9dd", boxShadow: "none" },
  borderRadius: "12px",
  textTransform: "none",
  boxShadow: "none",
  fontWeight: 700,
  fontSize: 16,
  px: 4,
  height: 42,
};
const outlinedFieldSx = {
  borderRadius: "8px",
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#404040", borderWidth: "1px" },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#404040", borderWidth: "1px" },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#000", borderWidth: "2px" },
};
const textFieldSx = {
  "& .MuiOutlinedInput-root": { fontSize: 16, ...outlinedFieldSx },
};
const selectSx = {
  fontSize: 16,
  ...outlinedFieldSx,
  "& .MuiSelect-icon": { color: "#404040" },
};
const selectMenuProps = {
  PaperProps: {
    sx: {
      mt: 0.5,
      borderRadius: "8px",
      border: "1px solid #e0e0e0",
      boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
    },
  },
};
const menuItemSx = {
  fontSize: 16,
  color: "#000",
  "&:hover": { bgcolor: "#5ebbeb" },
  "&.Mui-selected": { bgcolor: "transparent" },
  "&.Mui-selected:hover": { bgcolor: "#5ebbeb" },
  "&.Mui-focusVisible": { bgcolor: "#5ebbeb" },
};
import { saleOutstanding, INCOMPLETE_PURPLE } from "../../utils/saleOutstanding";
import { useAppDialogs } from "../../components/Common/AppDialogProvider";

const CustomerView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { alert: appAlert, confirm: appConfirm, notify } = useAppDialogs();

  // Reference (Using Account Customers): Cancel voids a payment; Refund keeps
  // it visible and posts an opposing entry. Both re-open the owing balance.
  const reversePayment = async (payment, kind) => {
    const dollars = formatCurrency(payment.amount || 0);
    const ok = await appConfirm(
      kind === 'cancel'
        ? `Cancel this ${dollars} payment? It is removed from reports and statements, and the balance re-opens.`
        : `Refund this ${dollars} payment? The original stays visible and an opposing entry is posted; the balance re-opens.`,
      { title: kind === 'cancel' ? 'Cancel payment' : 'Refund payment', confirmText: kind === 'cancel' ? 'Cancel payment' : 'Refund payment', severity: 'warning' }
    );
    if (!ok) return;
    try {
      if (kind === 'cancel') await paymentService.cancelPayment(payment.id);
      else await paymentService.refundPayment(payment.id);
      notify(kind === 'cancel' ? 'Payment cancelled' : 'Payment refunded');
      await loadCustomerData();
      loadOutstandingSales();
      loadPayments();
    } catch (err) {
      appAlert(err?.response?.data?.error || `Failed to ${kind} the payment`, 'error');
    }
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [customer, setCustomer] = useState(null);
  const [loyaltyInfo, setLoyaltyInfo] = useState(null); // { enabled, points }
  const [sales, setSales] = useState([]);
  // Sales History tab shows every sale, not the Home tab's last-10 preview.
  const [historySales, setHistorySales] = useState([]);
  const [historySalesLoading, setHistorySalesLoading] = useState(false);
  const [outstandingSales, setOutstandingSales] = useState([]);
  const [outstandingSalesLoading, setOutstandingSalesLoading] = useState(false);
  const [payments, setPayments] = useState([]);
  // Keep the open section in the URL (ProductView pattern) so a reload or a
  // browser Back restores the section instead of resetting to Home.
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get("section");
  const activeTab = ["balance", "salesHistory", "revision"].includes(sectionParam)
    ? sectionParam
    : "home";
  const setActiveTab = (nextId) => {
    const next = new URLSearchParams(searchParams);
    if (nextId === "home") next.delete("section");
    else next.set("section", nextId);
    setSearchParams(next, { replace: true });
  };
  const [revisions, setRevisions] = useState([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  // Sales History tab: several sale cards may be open at once; a card closes
  // only from its own Close button.
  const [openSaleIds, setOpenSaleIds] = useState([]);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Make Payment dialog
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [registers, setRegisters] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedRegister, setSelectedRegister] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  // A Date (the picker's value), like the Balance page - the browser's own
  // datetime-local box rendered ", 06-10-2026 ..." with a stray leading comma.
  const [paymentDate, setPaymentDate] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [invoiceAllocations, setInvoiceAllocations] = useState({});
  const [processingPayment, setProcessingPayment] = useState(false);
  // true while the Make Payment dialog is fetching invoices / payment methods
  const [paymentLoading, setPaymentLoading] = useState(false);
  // Payment validation belongs inside the dialog, not on the page behind the backdrop.
  const [paymentError, setPaymentError] = useState("");

  useEffect(() => {
    if (id) {
      loadCustomerData();
      loadSalesData();
    }
  }, [id]);

  useEffect(() => {
    if (id && activeTab === "revision") {
      loadRevisionHistory();
    }
  }, [id, activeTab]);

  useEffect(() => {
    if (id && activeTab === "balance") {
      loadOutstandingSales();
      loadPayments();
    } else if (id && activeTab === "salesHistory") {
      loadSalesHistory();
    }
  }, [id, activeTab]);

  const loadCustomerData = async () => {
    try {
      setLoading(true);
      const response = await customerService.getCustomer(id);
      setCustomer(response.customer);
      // Reference Customer Management: "view current total loyalty points". The
      // strip shows them only while the store's loyalty program is on.
      loyaltyService.getCustomerLoyalty(id)
        .then((r) => setLoyaltyInfo({ enabled: Boolean(r?.program?.isEnabled), points: r?.customer?.loyaltyPoints ?? 0 }))
        .catch(() => setLoyaltyInfo(null));
    } catch (err) {
      setError("Failed to load customer");
      console.error("Error loading customer:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadSalesData = async () => {
    try {
      const response = await customerService.getCustomerSales(id, 10);
      setSales(response.sales || []);
    } catch (err) {
      console.error("Error loading customer sales:", err);
    }
  };

  const loadSalesHistory = async () => {
    try {
      setHistorySalesLoading(true);
      // ponytail: one uncapped-enough request; add paging if a customer ever passes 1000 sales.
      const response = await customerService.getCustomerSales(id, 1000);
      setHistorySales(response.sales || []);
    } catch (err) {
      console.error("Error loading sales history:", err);
      setHistorySales([]);
    } finally {
      setHistorySalesLoading(false);
    }
  };

  const loadOutstandingSales = async () => {
    try {
      setOutstandingSalesLoading(true);
      const response = await customerService.getCustomerOutstandingSales(id);
      setOutstandingSales(response.sales || []);
    } catch (err) {
      console.error("Error loading outstanding sales:", err);
      setOutstandingSales([]);
    } finally {
      setOutstandingSalesLoading(false);
    }
  };

  const loadPayments = async () => {
    try {
      const response = await customerService.getCustomerPayments(id);
      setPayments(response.payments || []);
    } catch (err) {
      console.error("Error loading customer payments:", err);
      setPayments([]);
    }
  };

  const loadRevisionHistory = async () => {
    try {
      setRevisionsLoading(true);
      const response = await customerService.getCustomerRevisions(id);
      setRevisions(response.revisions || []);
    } catch (err) {
      console.error("Error loading revision history:", err);
      setRevisions([]);
      // Don't show error to user if endpoint doesn't exist yet
      if (err.response?.status !== 404) {
        setError("Failed to load revision history");
      }
    } finally {
      setRevisionsLoading(false);
    }
  };

  const handleEdit = () => {
    navigate(`/customers/${id}`);
  };

  const handleBack = () => {
    navigate("/customers");
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await customerService.deleteCustomer(id);
      // The list page shows the "Customer successfully deleted" toast.
      navigate("/customers", { state: { deleted: true } });
    } catch (err) {
      setError("Failed to delete customer");
      console.error("Error deleting customer:", err);
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const openPaymentDialog = async () => {
    setPaymentDate(new Date());
    setPaymentAmount("");
    setPaymentReference("");
    setPaymentError("");
    setInvoiceAllocations({});
    // QA row 76: show a loading state until the invoices and payment methods
    // are in, instead of "$0.00 / No outstanding invoices" filling in later.
    setPaymentLoading(true);
    setPaymentDialogOpen(true);
    try {
      const [registersData, paymentMethodsData] = await Promise.all([
        registerService.list({ isActive: true }),
        paymentMethodService.getPaymentMethods({ isActive: true }),
        // Always re-read the outstanding sales so the dialog is current.
        loadOutstandingSales(),
      ]);
      setRegisters(registersData || []);
      const methods = paymentMethodsData.paymentMethods || [];
      setPaymentMethods(methods);
      if (registersData && registersData.length > 0) {
        const def = registersData.find((r) => r.isDefault) || registersData[0];
        setSelectedRegister(def.id.toString());
      }
      if (methods.length > 0) {
        const def =
          methods.find((m) => m.isDefault) ||
          methods.find((m) => m.name?.toLowerCase() === "cash") ||
          methods[0];
        setSelectedPaymentMethod(def.id.toString());
      }
    } catch (err) {
      console.error("Error loading payment data:", err);
      setPaymentError("Failed to load payment data");
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleAllocationChange = (invoiceId, value, maxAmount) => {
    setInvoiceAllocations((prev) => {
      const next = { ...prev };
      // An emptied box has no allocation — storing 0 makes the field unclearable.
      if (value === "") delete next[invoiceId];
      // Clamp to 0..outstanding: a negative was silently dropped, an over-allocation
      // only failed with a 400 from the API.
      else next[invoiceId] = Math.min(Math.max(parseFloat(value) || 0, 0), Number(maxAmount) || 0);
      return next;
    });
  };

  const handleAutofill = () => {
    let remaining = parseFloat(paymentAmount) || 0;
    const next = {};
    for (const sale of outstandingSales) {
      if (remaining <= 0) break;
      const owed = Number(sale.outstandingAmount) || 0;
      const alloc = Math.min(owed, remaining);
      if (alloc > 0) {
        next[sale.id] = Number(alloc.toFixed(2));
        remaining -= alloc;
      }
    }
    setInvoiceAllocations(next);
  };

  const paymentDateInvalid = !paymentDate || isNaN(new Date(paymentDate));

  // Reference payment page: live "$X Outstanding and $Y Unallocated" + a totals row.
  const allocatedTotal = Object.values(invoiceAllocations).reduce((s, a) => s + (Number(a) || 0), 0);
  const invoicesTotal = outstandingSales.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);
  const outstandingTotal = outstandingSales.reduce(
    (s, i) => s + (Number(i.outstandingAmount) || 0),
    0
  );
  const unallocatedTotal = (parseFloat(paymentAmount) || allocatedTotal) - allocatedTotal;

  const handleCompletePayment = async () => {
    const totalAllocated = Object.values(invoiceAllocations).reduce(
      (sum, a) => sum + a,
      0
    );
    const amount = parseFloat(paymentAmount) || totalAllocated;
    if (amount <= 0 && totalAllocated <= 0) {
      setPaymentError(
        "Please enter a payment amount or allocate amounts to invoices"
      );
      return;
    }
    if (paymentDateInvalid) {
      setPaymentError("Please enter a payment date");
      return;
    }
    if (!selectedRegister) {
      setPaymentError("Please select a register");
      return;
    }
    if (!selectedPaymentMethod) {
      setPaymentError("Please select a payment method");
      return;
    }
    try {
      setProcessingPayment(true);
      setPaymentError("");
      await paymentService.createPayment({
        customerId: id,
        paymentDate: new Date(paymentDate).toISOString(),
        registerId: parseInt(selectedRegister),
        paymentMethodId: parseInt(selectedPaymentMethod),
        amount,
        reference: paymentReference,
        allocations: Object.entries(invoiceAllocations)
          .filter(([, a]) => a > 0)
          .map(([invoiceId, a]) => ({ invoiceId: parseInt(invoiceId), amount: a })),
      });
      setPaymentDialogOpen(false);
      await loadCustomerData();
      loadOutstandingSales();
      loadPayments();
    } catch (err) {
      console.error("Error processing payment:", err);
      setPaymentError(err.response?.data?.error || "Failed to process payment");
    } finally {
      setProcessingPayment(false);
    }
  };

  // Sale total from the line totals — same math as the shared sell-side base price.
  const computeSaleTotal = saleLineTotal;

  const formatDateTime = (isoDate) => {
    try {
      return new Date(isoDate).toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch (_) {
      return "-";
    }
  };

  const handleReprintReceipt = (sale) => {
    setSelectedSale(sale);
    setShowPrintDialog(true);
  };

  // The reprint button only renders inside the expanded row, so keep `selectedSale`
  // (it is also the row-expansion state) when the dialog closes.
  const handleClosePrintDialog = () => {
    setShowPrintDialog(false);
  };

  const handleSendEmail = async (saleId, receiverEmails, senderEmail) => {
    const result = await emailSaleReceipt({ saleId, receiverEmails, senderEmail, sale: selectedSale });
    if (!result?.success) {
      throw new Error(result?.message || "Failed to send email");
    }
  };

  const handleReturnItems = (sale) => {
    // Recall this sale on the sell screen as a RETURN — same path as SalesHistory.
    navigate("/", { state: { returnSaleNumber: sale.saleNumber } });
  };

  if (loading) {
    return <PageLoader />;
  }

  if (!customer) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Customer not found</Alert>
      </Box>
    );
  }

  // A negative balance is a customer credit — keep the sign, and round once so the
  // dollars and cents halves can never disagree (200.995 => $201.00, not $200.00).
  const currentOwing = Number(customer.currentOwing) || 0;
  const [owingDollars, owingCents] = formatCurrency(currentOwing).split(".");

  // Reference strip: Email, Mobile, Customer Group, Price List (the list the
  // customer is sold at - their own under "override group", else the group's).
  const effectivePriceList =
    (customer.overrideCustomerGroup && customer.priceList) ||
    customer.customerGroup?.priceList ||
    customer.priceList ||
    null;
  const detailPairs = [
    ["Email", (customer.emails || []).filter(Boolean).join(", ")],
    ["Mobile", customer.mobile],
    ["Customer Group", customer.customerGroup?.name],
    ["Price List", effectivePriceList?.name],
    // Loyalty program on + this customer (or their group) earns -> show the balance
    // (as text, so 0 still shows).
    ["Loyalty Points",
      loyaltyInfo?.enabled && (customer.loyaltyEnabled || customer.customerGroup?.loyaltyEnabled)
        ? Number(loyaltyInfo.points || 0).toLocaleString()
        : null],
  ].filter(([, value]) => value);

  const navigationItems = [
    { id: "home", label: "Home", icon: <HomeIcon /> },
    {
      id: "balance",
      label: "Balance & Payments",
      icon: <AccountBalanceIcon />,
    },
    { id: "salesHistory", label: "Sales History", icon: <HistoryIcon /> },
    { id: "revision", label: "Revision History", icon: <RevisionIcon /> },
  ];

  return (
    <Box
      sx={{
        display: "flex",
        height: "calc(100vh - 50px)",
        bgcolor: "#464a4e",
        overflow: "hidden",
      }}
    >
      {/* Main Content */}
      <Box
        sx={{
          flex: 1,
          p: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        {/* Header */}
        <Box
          sx={{
            textAlign: "center",
            mb: 1,
            height: 62,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#fff",
            border: "1px solid #000",
            borderRadius: 0,
          }}
        >
          <Typography
            sx={{ fontWeight: 400, fontSize: "24px", color: "#000" }}
          >
            {customer.firstName} {customer.lastName}
          </Typography>
        </Box>

        {/* Main Panel - switches by activeTab */}
        <Paper
          sx={{
            p: 3,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            borderRadius: 0,
            border: "1px solid #000",
            overflowY: "auto",
          }}
        >
          {activeTab === "balance" ? (
            <>
              <Box sx={{ textAlign: "center", mb: 2 }}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    // cents sit on the dollars' baseline, not raised above them
                    alignItems: "baseline",
                    lineHeight: 1,
                  }}
                >
                  <Typography component="span" sx={{ fontSize: "48px", fontWeight: 700 }}>
                    {owingDollars}
                  </Typography>
                  <Typography
                    component="span"
                    sx={{ fontSize: "24px", fontWeight: 700 }}
                  >
                    .{owingCents}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {currentOwing < 0 ? "In Credit" : "Currently Owing"}
                </Typography>
                <Box
                  sx={{
                    mt: 2,
                    display: "flex",
                    justifyContent: "center",
                    gap: 2,
                  }}
                >
                  <Button
                    variant="contained"
                    onClick={openPaymentDialog}
                    disableElevation
                    sx={{
                      bgcolor: "#32b643",
                      color: "#f8f8f8",
                      fontSize: "16px",
                      fontWeight: 700,
                      textTransform: "none",
                      borderRadius: 0,
                      transition: "background-color 0.2s, color 0.2s",
                      "&:hover": { bgcolor: "#2a9c39" },
                      px: 3,
                    }}
                  >
                    Make Payment
                  </Button>
                  <Button
                    variant="contained"
                    disableElevation
                    // same shape as Make Payment beside it (reference: both square)
                    sx={{
                      bgcolor: "#1976d2",
                      color: "#f8f8f8",
                      fontSize: "16px",
                      fontWeight: 700,
                      textTransform: "none",
                      borderRadius: 0,
                      transition: "background-color 0.2s, color 0.2s",
                      "&:hover": { bgcolor: "#115293" },
                      px: 3,
                    }}
                    component={RouterLink} to={`/customers/balance?customerId=${id}&returnTo=customer`}
                  >
                    View Statement
                  </Button>
                </Box>
              </Box>

              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Outstanding Sales
              </Typography>
              {outstandingSalesLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : outstandingSales.length > 0 ? (
                // flexShrink 0: inside the panel's flex column this table (overflow auto,
                // so min-height 0) was squeezed to zero height whenever the Payment
                // History below was long, hiding the customer's outstanding invoices.
                // The panel scrolls instead, as the reference page does.
                <TableContainer sx={{ flexShrink: 0 }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: "#5ebbeb" }}>
                        <TableCell sx={{ color: "white", fontWeight: 600 }}>
                          Timestamp
                        </TableCell>
                        <TableCell sx={{ color: "white", fontWeight: 600 }}>
                          Invoice Number
                        </TableCell>
                        <TableCell sx={{ color: "white", fontWeight: 600 }}>
                          User
                        </TableCell>
                        <TableCell sx={{ color: "white", fontWeight: 600 }}>
                          Total
                        </TableCell>
                        <TableCell sx={{ color: "white", fontWeight: 600 }}>
                          Outstanding
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {outstandingSales.map((sale) => (
                        <TableRow key={`outstanding-${sale.id}`}>
                          <TableCell>
                            {new Date(sale.saleDate).toLocaleString("en-GB", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                              hour12: false,
                            })}
                          </TableCell>
                          <TableCell>{sale.saleNumber || "-"}</TableCell>
                          <TableCell>{sale.user?.name || "-"}</TableCell>
                          <TableCell>
                            {formatCurrency(sale.totalAmount || 0)}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(sale.outstandingAmount || 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 6,
                    textAlign: "center",
                    flex: 1,
                  }}
                >
                  <Typography
                    variant="h2"
                    sx={{
                      fontSize: "4rem",
                      mb: 2,
                      lineHeight: 1,
                    }}
                  >
                    😊
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{ fontWeight: 600, mb: 1, color: "text.primary" }}
                  >
                    No Outstanding Sales
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{ color: "text.secondary" }}
                  >
                    Looks like they're all up to date!
                  </Typography>
                </Box>
              )}

              <Typography variant="h6" sx={{ fontWeight: 600, mt: 3, mb: 1 }}>
                Payment History
              </Typography>
              {payments.length > 0 ? (
                <TableContainer sx={{ flexShrink: 0 }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: "#5ebbeb" }}>
                        {["Timestamp", "Invoice Number", "User", "Method", "Amount", "Actions"].map((h) => (
                          <TableCell key={h} sx={{ color: "white", fontWeight: 600 }}>
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={`payment-${payment.id}`}>
                          <TableCell>{formatDateTime(payment.createdAt)}</TableCell>
                          <TableCell>{payment.sale?.saleNumber || "-"}</TableCell>
                          <TableCell>{payment.sale?.user?.name || "-"}</TableCell>
                          <TableCell>{payment.paymentMethod || "-"}</TableCell>
                          <TableCell>{formatCurrency(payment.amount || 0)}</TableCell>
                          <TableCell>
                            {/* Reversal only makes sense on positive rows —
                                negative rows ARE reversals. */}
                            {Number(payment.amount) > 0 ? (
                              <Box sx={{ display: "flex", gap: 1 }}>
                                <Button size="small" disableRipple onClick={() => reversePayment(payment, 'cancel')}
                                  sx={{ color: "#e33430", textTransform: "none", fontWeight: 600, minWidth: 0 }}>
                                  Cancel
                                </Button>
                                <Button size="small" disableRipple onClick={() => reversePayment(payment, 'refund')}
                                  sx={{ color: "#0084d1", textTransform: "none", fontWeight: 600, minWidth: 0 }}>
                                  Refund
                                </Button>
                              </Box>
                            ) : (
                              <Typography component="span" sx={{ fontSize: 13, color: "#676b72" }}>Reversal</Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" sx={{ color: "text.secondary", py: 2 }}>
                  No payments recorded
                </Typography>
              )}
            </>
          ) : activeTab === "salesHistory" ? (
            <>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 1,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Sales History
                </Typography>
                <Typography variant="subtitle1" color="text.secondary">
                  {historySales.length} sale{historySales.length !== 1 ? "s" : ""}
                </Typography>
              </Box>
              <Divider sx={{ mb: 1 }} />

              <Box sx={{ flex: 1, overflowY: "auto" }}>
                {historySalesLoading ? (
                  <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : historySales.length > 0 ? (
                  historySales.map((sale) => (
                    <React.Fragment key={`sale-fr-${sale.id}`}>
                      {!openSaleIds.includes(sale.id) && (
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            py: 1,
                            borderBottom: "1px solid #e0e0e0",
                            cursor: "pointer",
                          }}
                          onClick={() => {
                            setSelectedSale(sale);
                            setOpenSaleIds((ids) => (ids.includes(sale.id) ? ids : [...ids, sale.id]));
                          }}
                        >
                          {/* Reference: purple hollow circle while the sale still
                              owes money (On Account, unpaid); black tick once paid. */}
                          <Box
                            sx={{
                              width: 32,
                              display: "flex",
                              justifyContent: "center",
                            }}
                          >
                            {saleOutstanding(sale) > 0 ? (
                              <Box
                                title="Incomplete"
                                sx={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: "50%",
                                  border: `2px solid ${INCOMPLETE_PURPLE}`,
                                }}
                              />
                            ) : (
                              <CheckCircleOutlinedIcon titleAccess="Complete" sx={{ fontSize: 28, color: "#000" }} />
                            )}
                          </Box>

                          {/* Date/time + invoice number */}
                          <Box sx={{ width: 220 }}>
                            <Typography
                              variant="subtitle2"
                              sx={{ lineHeight: 1.1 }}
                            >
                              {formatDateTime(sale.saleDate)}
                            </Typography>
                            <Typography variant="caption" color="primary">
                              {sale.saleNumber || "-"}
                            </Typography>
                          </Box>

                          {/* User */}
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2">
                              {sale.user?.name || "-"}
                            </Typography>
                          </Box>

                          {/* Amount right-aligned */}
                          <Box sx={{ width: 160, textAlign: "right" }}>
                            <Typography variant="h5" sx={{ fontWeight: 700 }}>
                              {formatCurrency(computeSaleTotal(sale))}
                            </Typography>
                            {/* Reference: the amount still owed, small, under the total */}
                            {saleOutstanding(sale) > 0 && (
                              <Typography variant="body2" display="block">
                                {formatCurrency(saleOutstanding(sale))}
                              </Typography>
                            )}
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                            >
                              {customer.company || "-"}
                            </Typography>
                          </Box>
                        </Box>
                      )}

                      {/* Slides open / closed like the Sales History page. The card
                          reads this row's own `sale`, so it is safe while sliding shut. */}
                      <Collapse in={openSaleIds.includes(sale.id)} timeout={400} easing="ease-in-out" unmountOnExit>
                        <Paper
                          sx={{
                            mb: 1,
                            p: 2,
                            border: "1px solid #bdbdbd",
                            borderRadius: 0,
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              pb: 1,
                              mb: 1,
                              borderBottom: "1px solid #e0e0e0",
                            }}
                          >
                            {/* Status: reference "○ Incomplete" (purple) while money is
                                owed, "✓ Complete" once paid. */}
                            <Box
                              sx={{
                                minWidth: 36,
                                mr: 2,
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                color: saleOutstanding(sale) > 0 ? INCOMPLETE_PURPLE : "#000",
                              }}
                            >
                              {saleOutstanding(sale) > 0 ? (
                                <Box sx={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${INCOMPLETE_PURPLE}` }} />
                              ) : (
                                <CheckCircleOutlinedIcon sx={{ fontSize: 18 }} />
                              )}
                              <Typography variant="body2" sx={{ color: "inherit" }}>
                                {saleOutstanding(sale) > 0 ? "Incomplete" : "Complete"}
                              </Typography>
                            </Box>
                            <Box
                              sx={{
                                display: "flex",
                                gap: 6,
                                alignItems: "center",
                              }}
                            >
                              <Box>
                                <Typography variant="subtitle2">
                                  {formatDateTime(sale.saleDate)}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {sale.saleNumber || "-"}
                                </Typography>
                              </Box>
                              <Typography variant="body2">
                                {sale.user?.name || "-"}
                              </Typography>
                            </Box>
                            <Box sx={{ ml: "auto", textAlign: "right" }}>
                              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                                {formatCurrency(computeSaleTotal(sale))}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {customer.company || "-"}
                              </Typography>
                            </Box>
                            {/* The only way to close the card (clicking elsewhere keeps it open) */}
                            <Button
                              size="small"
                              onClick={() => {
                                setOpenSaleIds((ids) => ids.filter((id) => id !== sale.id));
                                if (selectedSale?.id === sale.id) setSelectedSale(null);
                              }}
                              sx={{ ml: 2, minWidth: 0, color: "#000", textTransform: "none", fontWeight: 600 }}
                            >
                              ✕ Close
                            </Button>
                          </Box>

                          {/* Summary row with buttons on right */}
                          <Box sx={{ display: "flex", gap: 2 }}>
                            <Box
                              sx={{
                                flex: 1,
                                display: "grid",
                                gridTemplateColumns:
                                  "repeat(2, minmax(120px, 1fr))",
                                rowGap: 1,
                              }}
                            >
                              <Box
                                sx={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                }}
                              >
                                <Typography variant="body2">
                                  Base Price
                                </Typography>
                                <Typography variant="body2">
                                  {formatCurrency(saleBasePrice(sale))}
                                </Typography>
                              </Box>
                              <Box
                                sx={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                }}
                              >
                                <Typography variant="body2">Savings</Typography>
                                <Typography variant="body2">
                                  {formatCurrency(sale.savings)}
                                </Typography>
                              </Box>
                              <Box
                                sx={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                }}
                              >
                                <Typography variant="body2">
                                  Discount
                                </Typography>
                                <Typography variant="body2">
                                  {formatCurrency(sale.discount)}
                                </Typography>
                              </Box>
                              <Box
                                sx={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                }}
                              >
                                <Typography variant="body2">Tax</Typography>
                                <Typography variant="body2">
                                  {formatCurrency(sale.tax)}
                                </Typography>
                              </Box>
                            </Box>
                            <Box sx={{ width: 320 }}>
                              <Button
                                onClick={() => setSelectedSale(null)}
                                variant="contained"
                                fullWidth
                                sx={{
                                  mb: 1,
                                  bgcolor: "#1976d2",
                                  "&:hover": { bgcolor: "#115293" },
                                }}
                              >
                                ✕ Close
                              </Button>
                              <Button
                                variant="outlined"
                                fullWidth
                                sx={{ mb: 1 }}
                                onClick={() => handleReprintReceipt(sale)}
                              >
                                Reprint Receipt
                              </Button>
                              <Button
                                variant="outlined"
                                fullWidth
                                sx={{ mb: 1 }}
                                onClick={() => setShowEmailModal(true)}
                              >
                                Email Receipt
                              </Button>
                              <Button
                                variant="outlined"
                                fullWidth
                                onClick={() => handleReturnItems(sale)}
                              >
                                Return Items
                              </Button>
                            </Box>
                          </Box>

                          <Box
                            sx={{
                              borderTop: "1px solid #bdbdbd",
                              mt: 2,
                              pt: 1,
                            }}
                          >
                            {sale.items?.map((it, idx) => (
                              <Box
                                key={`sel-item-${sale.id}-${idx}`}
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  py: 0.5,
                                }}
                              >
                                <Box
                                  sx={{ width: 32, textAlign: "right", pr: 1 }}
                                >
                                  <Typography
                                    variant="body2"
                                    sx={{ fontWeight: 600 }}
                                  >
                                    {it.quantity}
                                  </Typography>
                                </Box>
                                <Box sx={{ width: 56 }}>
                                  <Typography variant="body2">Items</Typography>
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="body2">
                                    {it.productName}
                                  </Typography>
                                </Box>
                                <Box sx={{ width: 140, textAlign: "right" }}>
                                  <Typography variant="body2">
                                    {formatCurrency(
                                      it.totalPrice ??
                                        (Number(it.unitPrice) || 0) *
                                          (Number(it.quantity) || 0)
                                    )}
                                  </Typography>
                                </Box>
                              </Box>
                            ))}
                            <Box
                              sx={{
                                mt: 1,
                                borderTop: "1px solid #9e9e9e",
                                display: "flex",
                                justifyContent: "flex-end",
                                pt: 0.5,
                              }}
                            >
                              <Typography variant="subtitle1" sx={{ mr: 2 }}>
                                Balance
                              </Typography>
                              <Typography variant="subtitle1">
                                {formatCurrency(sale.outstandingAmount ?? 0)}
                              </Typography>
                            </Box>
                          </Box>
                        </Paper>
                      </Collapse>
                    </React.Fragment>
                  ))
                ) : (
                  <Box sx={{ py: 6, textAlign: "center" }}>
                    <Typography variant="body2" color="text.secondary">
                      No sales history found
                    </Typography>
                  </Box>
                )}
              </Box>
            </>
          ) : activeTab === "revision" ? (
            <>
              {revisionsLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1 }}>
                  <CircularProgress />
                </Box>
              ) : (
              <TableContainer sx={{ flex: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Field</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>From</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>To</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>User</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Timestamp</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={5} sx={{ bgcolor: "#eeeeee" }}>
                        <Typography variant="caption">
                          Please Note: Revisions may take up to five minutes to
                          appear
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {revisions && revisions.length > 0 ? (
                      revisions.map((rev, idx) => (
                        <TableRow key={`rev-${idx}`}>
                          <TableCell>{rev.field}</TableCell>
                          <TableCell>{formatRevisionValue(rev.from)}</TableCell>
                          <TableCell>{formatRevisionValue(rev.to)}</TableCell>
                          <TableCell>{rev.user || "-"}</TableCell>
                          <TableCell>{formatDateTime(rev.timestamp)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          No revisions found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              )}
            </>
          ) : (
            <>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${detailPairs.length || 1}, 1fr)`,
                  mb: 1,
                }}
              >
                {detailPairs.map(([label, value], index) => (
                  <Box
                    key={label}
                    sx={{
                      textAlign:
                        index === 0
                          ? "left"
                          : index === detailPairs.length - 1
                          ? "right"
                          : "center",
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 700, display: "block" }}>
                      {label}
                    </Typography>
                    <Typography variant="body2">{value}</Typography>
                  </Box>
                ))}
              </Box>

              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Last 10 Sales
              </Typography>
              <TableContainer
                sx={{
                  flex: 1,
                  border: "1px solid #000",
                  borderRadius: 0,
                }}
              >
                <Table
                  sx={{
                    "& td, & th": { border: "none" },
                    "& tbody tr:nth-of-type(odd)": { bgcolor: "#fff" },
                    "& tbody tr:nth-of-type(even)": { bgcolor: "#f8f8f8" },
                  }}
                >
                  <TableHead>
                    <TableRow>
                      {["Timestamp", "User", "Quantity", "Item", "Price"].map(
                        (h) => (
                          <TableCell
                            key={h}
                            sx={{
                              bgcolor: "#5ebbeb",
                              color: "#f8f8f8",
                              fontSize: "16px",
                              fontWeight: 700,
                              padding: "8px",
                              textAlign: "center",
                            }}
                          >
                            {h}
                          </TableCell>
                        )
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sales.length > 0 ? (
                      sales.map((sale) =>
                        sale.items.map((item, itemIndex) => (
                          <TableRow key={`${sale.id}-${itemIndex}`}>
                            {itemIndex === 0 ? (
                              <TableCell
                                rowSpan={sale.items.length}
                                sx={{ fontSize: "16px", color: "#000", padding: "8px 8px 8px 10px" }}
                              >
                                {new Date(sale.saleDate).toLocaleString(
                                  "en-GB",
                                  {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                    hour12: false,
                                  }
                                )}
                              </TableCell>
                            ) : null}
                            {itemIndex === 0 ? (
                              <TableCell
                                rowSpan={sale.items.length}
                                sx={{ fontSize: "16px", color: "#000", padding: "8px 8px 8px 10px" }}
                              >
                                {sale.user?.name || "-"}
                              </TableCell>
                            ) : null}
                            <TableCell sx={{ fontSize: "16px", color: "#000", padding: "8px 8px 8px 10px" }}>
                              {item.quantity}
                            </TableCell>
                            <TableCell sx={{ fontSize: "16px", color: "#000", padding: "8px 8px 8px 10px" }}>
                              {item.productName}
                            </TableCell>
                            <TableCell sx={{ fontSize: "16px", color: "#000", padding: "8px 8px 8px 10px" }}>
                              ${item.totalPrice?.toFixed(2) || "0.00"}
                            </TableCell>
                          </TableRow>
                        ))
                      )
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ fontSize: "16px", color: "#000" }}>
                          No sales found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </Paper>
      </Box>
      <Box
        sx={{
          position: "sticky",
          top: 0,
          height: "calc(100vh - 50px)",
          overflow: "hidden",
          justifyContent: "center",
          p: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box
          sx={{
            mb: 1,
            width: 292,
            height: 62,
            display: "flex",
            alignItems: "center",
            backgroundColor: "#f8f8f8",
            border: "1px solid #000",
            borderRadius: 0,
            boxShadow: "rgba(0,0,0,0.25) 0 0 30px 0",
          }}
        >
          <Button
            startIcon={<EditIcon />}
            onClick={handleEdit}
            disableRipple
            sx={{
              fontSize: "24px",
              fontWeight: 400,
              textTransform: "none",
              bgcolor: "transparent",
              borderRadius: 0,
              boxShadow: "unset",
              color: "#32b643",
              transition: "color 0.2s",
              "&:hover": { bgcolor: "transparent", color: "#16a34a" },
            }}
          >
            Edit
          </Button>
        </Box>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "space-between",
          }}
        >
          <Paper
            elevation={0}
            sx={{
              width: 292,
              p: 2,
              bgcolor: "#f8f8f8",
              borderRadius: 0,
              height: "fit-content",
              border: "1px solid #000",
              boxShadow: "rgba(0,0,0,0.25) 0 0 30px 0",
            }}
          >
            <List sx={{ py: 0 }}>
              {navigationItems.map((item) => {
                const active = activeTab === item.id;
                const color = active ? "#5ebbeb" : "#000";
                const hoverColor = active ? "#31a8e5" : "#5ebbeb";
                return (
                  <ListItem
                    key={item.id}
                    button
                    disableRipple
                    onClick={() => setActiveTab(item.id)}
                    sx={{
                      minHeight: 62,
                      borderRadius: 0,
                      backgroundColor: "transparent",
                      color,
                      transition: "color 0.2s",
                      "&:hover": { backgroundColor: "transparent", color: hoverColor },
                      "&:hover .MuiListItemIcon-root": { color: hoverColor },
                      "&:hover .MuiTypography-root": { color: hoverColor },
                    }}
                  >
                    <ListItemIcon sx={{ color, minWidth: 40, transition: "color 0.2s" }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      secondary={
                        item.id === "home"
                          ? "View customer details and recent items purchased"
                          : undefined
                      }
                      sx={{
                        "& .MuiTypography-root": {
                          fontWeight: 400,
                          fontSize: "24px",
                          lineHeight: 1.1,
                          color,
                          transition: "color 0.2s",
                        },
                        "& .MuiTypography-body2": {
                          fontSize: "12px",
                          color: active ? "#5ebbeb" : "#676b72",
                        },
                      }}
                    />
                  </ListItem>
                );
              })}
            </List>
          </Paper>
          <Box
            sx={{
              mb: 0,
              width: 292,
              height: 62,
              display: "flex",
              alignItems: "center",
              backgroundColor: "#f8f8f8",
              border: "1px solid #000",
              borderRadius: 0,
              boxShadow: "rgba(0,0,0,0.25) 0 0 30px 0",
            }}
          >
            <Button
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteDialogOpen(true)}
              disableRipple
              sx={{
                fontSize: "24px",
                fontWeight: 400,
                textTransform: "none",
                bgcolor: "transparent",
                borderRadius: 0,
                boxShadow: "unset",
                color: "#e33430",
                transition: "color 0.2s",
                "&:hover": { bgcolor: "transparent", color: "#dc2626" },
              }}
            >
              Delete
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Print Receipt Dialog */}
      <PrintReceiptDialog
        open={showPrintDialog}
        onClose={handleClosePrintDialog}
        sale={selectedSale}
      />

      <EmailReceiptModal
        open={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        onSend={handleSendEmail}
        saleId={selectedSale?.id}
        customer={customer}
        onUpdateCustomerEmail={async (c, email) => {
          await customerService.addEmail(c, email);
          await loadCustomerData();
        }}
      />

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        title="Delete Customer"
        message={`Are you sure you wish to delete ${`${customer.firstName} ${customer.lastName}`.trim()} ?`}
        loading={deleting}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
      />

      {/* Make Payment */}
      <Dialog
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        // Centre the dialog over the white content panel, not the whole window:
        // the right-hand navigation column (292px + 2 x 8px padding) is left
        // out of the centring by reserving its width as right margin.
        PaperProps={{ sx: { mr: { md: "308px" }, maxHeight: "90vh" } }}
      >
        {/* Same layout as the Balance page's Make Payment dialog */}
        <DialogTitle>
          <Typography variant="h5" sx={{ fontWeight: "bold" }}>
            Make Payment
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Please note: if the payment time falls outside a register closure, this payment will not appear in any register closure.
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ overflow: "auto" }}>
          {paymentError && (
            <Alert
              severity="error"
              sx={{ mt: 2 }}
              onClose={() => setPaymentError("")}
            >
              {paymentError}
            </Alert>
          )}
          {paymentLoading ? (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, py: 8 }}>
              <CircularProgress />
              <Typography color="text.secondary">Loading outstanding invoices…</Typography>
            </Box>
          ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3, mt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Customer"
                  value={`${customer.firstName} ${customer.lastName}${customer.company ? ` - ${customer.company}` : ""}`}
                  disabled
                  size="small"
                  sx={textFieldSx}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enAU}>
                  <DateTimePicker
                    label="Payment Date"
                    value={paymentDate}
                    onChange={(newValue) => setPaymentDate(newValue)}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        size: "small",
                        required: true,
                        error: !!paymentError && paymentDateInvalid,
                        helperText:
                          paymentError && paymentDateInvalid ? "Payment date is required" : "",
                        sx: textFieldSx,
                      },
                    }}
                  />
                </LocalizationProvider>
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Register</InputLabel>
                  <Select
                    value={selectedRegister}
                    onChange={(e) => setSelectedRegister(e.target.value)}
                    label="Register"
                    IconComponent={ArrowDropDownIcon}
                    MenuProps={selectMenuProps}
                    sx={selectSx}
                  >
                    {registers.map((r) => (
                      <MenuItem key={r.id} value={r.id.toString()} sx={menuItemSx}>
                        {r.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="$ Payment Amount (optional)"
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  size="small"
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                  sx={textFieldSx}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Payment Reference (optional)"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  size="small"
                  sx={textFieldSx}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Payment Method</InputLabel>
                  <Select
                    value={selectedPaymentMethod}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                    label="Payment Method"
                    IconComponent={ArrowDropDownIcon}
                    MenuProps={selectMenuProps}
                    sx={selectSx}
                  >
                    {paymentMethods.map((m) => (
                      <MenuItem key={m.id} value={m.id.toString()} sx={menuItemSx}>
                        {m.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                  Outstanding Invoices
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Typography variant="body2" sx={{ color: "#676b72" }}>
                    {formatCurrency(outstandingTotal - allocatedTotal)} Outstanding and{" "}
                    {formatCurrency(unallocatedTotal)} Unallocated
                  </Typography>
                  <Button onClick={handleAutofill} variant="outlined" size="small">
                    Autofill
                  </Button>
                </Box>
              </Box>
              <TableContainer>
                <Table size="small" sx={{ borderCollapse: "separate", borderSpacing: 0 }}>
                  <TableHead>
                    <TableRow
                      sx={{
                        "& th": { bgcolor: "#5ebbeb", color: "white", fontWeight: 700, fontSize: 16, border: 0, height: 51, py: 0 },
                        "& th:first-of-type": { borderTopLeftRadius: "12px", borderBottomLeftRadius: "12px" },
                        "& th:last-of-type": { borderTopRightRadius: "12px", borderBottomRightRadius: "12px" },
                      }}
                    >
                      <TableCell>Timestamp</TableCell>
                      <TableCell>Invoice</TableCell>
                      <TableCell>User</TableCell>
                      <TableCell>Total</TableCell>
                      <TableCell>Outstanding</TableCell>
                      <TableCell>Allocation</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody
                    sx={{
                      "& tr:nth-of-type(odd)": { bgcolor: "#ffffff" },
                      "& tr:nth-of-type(even)": { bgcolor: "#f5f5f5" },
                      "& td": { border: 0, fontSize: 16, color: "#000" },
                    }}
                  >
                    {outstandingSales.map((sale) => (
                      <TableRow key={`pay-${sale.id}`}>
                        <TableCell>{formatDateTime(sale.saleDate)}</TableCell>
                        <TableCell>{sale.saleNumber || "-"}</TableCell>
                        <TableCell>{sale.user?.name || "-"}</TableCell>
                        <TableCell>{formatCurrency(sale.totalAmount || 0)}</TableCell>
                        <TableCell>{formatCurrency(sale.outstandingAmount || 0)}</TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            value={invoiceAllocations[sale.id] ?? ""}
                            onChange={(e) =>
                              handleAllocationChange(sale.id, e.target.value, sale.outstandingAmount)
                            }
                            InputProps={{
                              startAdornment: <InputAdornment position="start">$</InputAdornment>,
                            }}
                            sx={{ width: 120, ...textFieldSx }}
                            inputProps={{ max: sale.outstandingAmount, min: 0, step: 0.01 }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {outstandingSales.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 2 }}>
                          <Typography color="text.secondary">No outstanding invoices</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  {outstandingSales.length > 0 && (
                    <TableFooter>
                      <TableRow sx={{ "& td": { border: 0, fontSize: 16, color: "#000", fontWeight: 700 } }}>
                        <TableCell colSpan={3}>TOTAL</TableCell>
                        <TableCell>{formatCurrency(invoicesTotal)}</TableCell>
                        <TableCell>{formatCurrency(outstandingTotal)}</TableCell>
                        <TableCell>{formatCurrency(allocatedTotal)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </TableContainer>
            </Box>
          </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: 1, borderColor: "divider" }}>
          <Button
            onClick={() => setPaymentDialogOpen(false)}
            sx={{ ...primaryButtonSx, color: "white" }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCompletePayment}
            variant="contained"
            disabled={processingPayment || paymentLoading}
            sx={primaryButtonSx}
          >
            {processingPayment ? "Processing..." : "Complete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CustomerView;
