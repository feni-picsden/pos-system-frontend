import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Autocomplete,
  List,
  Alert,
  FormControlLabel,
} from "@mui/material";
import { CheckCircleOutlined } from "@mui/icons-material";
import DateRangePicker from "../components/Common/DateRangePicker";
import ShopfrontSwitch from "../components/Common/ShopfrontSwitch";
import salesService from "../services/salesService";
import { emailSaleReceipt } from '../services/receiptEmailSender';
import { userService } from "../services/userService";
import customerService from "../services/customerService";
import productService from "../services/productService";
import paymentMethodService from "../services/paymentMethodService";
import settingsService from "../services/settingsService";
import { useAuth } from "../contexts/AuthContext";
import PrintReceiptDialog from "../components/PrintReceiptDialog";
import EditSaleDetailsDialog from "../components/SalesHistory/EditSaleDetailsDialog";
import EmailReceiptModal from "../components/SalesHistory/EmailReceiptModal";
import { formatDateValue } from "../utils/dateFormat";
import { useAppDialogs } from '../components/Common/AppDialogProvider';
import { useSelectedRegister } from '../contexts/SelectedRegisterContext';
import ShopfrontDialog, { DialogButton } from '../components/Common/ShopfrontDialog';
import SaleDetailCard, { SplitPrice, customerName } from '../components/SalesHistory/SaleDetailCard';
import { usePermissions } from '../hooks/usePermissions';

// Reference filter chrome: the field label lives INSIDE the 42px box and floats
// into the notch on focus/value; 1px #404040 rail that does NOT change on hover.
const labelSx = { fontSize: 12, color: "#676b72", mb: 0.5, lineHeight: 1.2 };

// .sales-history-filter — one grid cell, 1rem of padding.
const cellSx = { p: "16px", minWidth: 0 };

const fieldSx = {
  width: "100%",
  "& .MuiOutlinedInput-root": {
    borderRadius: "8px",
    minHeight: 42,
    fontSize: 16,
    bgcolor: "#fff",
    "& .MuiOutlinedInput-notchedOutline": { borderColor: "#404040", borderWidth: "1px" },
    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#404040", borderWidth: "1px" },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#000000", borderWidth: "2px" },
  },
  "& .MuiInputLabel-root": { color: "#808080", fontSize: 16 },
  "& .MuiInputLabel-root.MuiInputLabel-shrink": { fontSize: 14, color: "#676b72" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#000000" },
  "& input::placeholder": { color: "#808080", opacity: 1 },
};

// Reference combobox menu: radius 8, 1px black border, NO shadow, 288px scroll
// cap, 56px rows and a sky-300 highlight (no Material elevation / Grow).
const comboPaperSx = {
  borderRadius: "8px",
  border: "1px solid #000",
  boxShadow: "none",
  "& .MuiAutocomplete-noOptions": {
    // Reference row is exactly 53px: vertical padding is dropped so the 24px
    // line box doesn't push it to 56.
    height: 53,
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    p: "0 16px",
    fontSize: 16,
    color: "#0a0a0a",
  },
};

const comboListboxSx = {
  maxHeight: 288,
  p: 0,
  "& .MuiAutocomplete-option": { minHeight: 56, p: "16px", fontSize: 16 },
  '& .MuiAutocomplete-option[aria-selected="true"], & .MuiAutocomplete-option.Mui-focused, & .MuiAutocomplete-option[aria-selected="true"].Mui-focused':
    { bgcolor: "#7dd3fc !important", color: "#0a0a0a" },
};

// The two flush bars under the filter grid (left = advanced toggle, right = Filter).
const barButtonSx = (bg, fg, hoverBg = fg, hoverFg = bg) => ({
  flex: 1,
  height: 50,
  borderRadius: 0,
  bgcolor: bg,
  color: fg,
  fontSize: 16,
  fontWeight: 400,
  textTransform: "none",
  boxShadow: "none",
  transition: "background 0.2s ease, color 0.2s ease",
  "&:hover": { bgcolor: hoverBg, color: hoverFg, boxShadow: "none" },
});

// Expanded-card action buttons: 53px, square, 1px slate rail, inverted on hover.
const actionButtonSx = (primary) => ({
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
  "&:hover": {
    boxShadow: "none",
    bgcolor: primary ? "#0f6fd0" : "#313439",
    color: "#f8f8f8",
  },
});

const byLabel = (a, b) =>
  String(a.label).localeCompare(String(b.label), undefined, { sensitivity: "base" });

// Server-side option sources for the async selects (min 3 chars, like the reference).
const searchCustomers = (term) =>
  customerService
    .getCustomers({ search: term, limit: 20 })
    .then((r) =>
      (r?.customers || [])
        .map((c) => ({ value: c.id, label: customerName(c) }))
        .sort(byLabel)
    )
    .catch(() => []);

const searchProducts = (term) =>
  productService
    .getProducts({ search: term, limit: 20 })
    .then((r) =>
      (r?.products || [])
        .map((p) => ({ value: p.name, label: p.name }))
        .sort(byLabel)
    )
    .catch(() => []);

// Async search select: opens on "Keep Typing to Search..." and only queries the
// server once 3+ characters are typed.
const AsyncCombo = ({ label, value, onChange, fetcher }) => {
  const [input, setInput] = useState("");
  const [options, setOptions] = useState([]);
  const term = input.trim();

  useEffect(() => {
    if (term.length < 3) {
      setOptions([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      fetcher(term).then((opts) => {
        if (!cancelled) setOptions(opts);
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, fetcher]);

  return (
    <Autocomplete
      options={options}
      value={value}
      onChange={(e, opt) => onChange(opt)}
      onInputChange={(e, v) => setInput(v)}
      filterOptions={(o) => o}
      getOptionKey={(o) => o.value}
      getOptionLabel={(o) => o?.label ?? ""}
      isOptionEqualToValue={(o, v) => String(o.value) === String(v.value)}
      noOptionsText={term.length < 3 ? "Keep Typing to Search..." : "No Options"}
      ListboxProps={{ sx: comboListboxSx }}
      componentsProps={{ paper: { sx: comboPaperSx } }}
      sx={fieldSx}
      renderInput={(params) => <TextField {...params} label={label} size="small" />}
    />
  );
};

// Reference opens on a rolling one-month window ending now.
const defaultDateRange = () => {
  const endDate = new Date();
  endDate.setMilliseconds(0);
  const startDate = new Date(endDate);
  startDate.setMonth(startDate.getMonth() - 1);
  startDate.setSeconds(startDate.getSeconds() + 1);
  return { startDate, endDate, preset: "custom" };
};

// Alphabetical, exactly the reference set. Returned is NOT a status here — it is
// the separate Returned toggle further down the advanced grid.
const STATUS_OPTIONS = [
  { value: "CANCELLED", label: "Cancelled" },
  { value: "COMPLETED", label: "Completed" },
  { value: "INCOMPLETE", label: "Incomplete" },
  { value: "PARKED", label: "Parked" },
];

const SalesHistory = () => {
  // In-app dialogs — these shadow window.alert/confirm/prompt on purpose.
  const { alert, notify } = useAppDialogs();
  const { selectedRegister } = useSelectedRegister();
  const { user, getOutletName } = useAuth();
  // The action rail offers what the backend will actually allow: a cashier with
  // see_history could open Modify Details / Return Items / Cancel Sale and only
  // learn they were forbidden from the 403.
  const { hasPermission } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  
  // State for sales data
  const [sales, setSales] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [replyToEmail, setReplyToEmail] = useState('');

  // State for filters
  const [filters, setFilters] = useState({
    minAmount: "",
    maxAmount: "",
    paymentMethod: "",
    userId: "",
    status: "",
    invoiceNumber: "",
    orderReference: "",
    customerId: "",
    productName: "",
    giftCardCode: "",
    isReturned: false,
    isDiscounted: false,
  });

  // Reference keeps the date range in one control (dd/MM/yyyy HH:mm:ss both ends).
  const [dateRange, setDateRange] = useState(defaultDateRange);

  // State for advanced filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // The picked customer option (the async select has no preloaded list to
  // resolve filters.customerId back into a label).
  const [customerFilterOption, setCustomerFilterOption] = useState(null);

  // State for dropdown options
  const [users, setUsers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);

  // Assign Customer / Cancel Sale dialogs
  const [assignCustomerOpen, setAssignCustomerOpen] = useState(false);
  const [assignCustomerId, setAssignCustomerId] = useState("");
  const [cancelStep, setCancelStep] = useState(null); // 'confirm' | 'reason'
  const [cancelReason, setCancelReason] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Load initial data - using ref to prevent duplicate calls
  const initialLoadDone = React.useRef(false);
  
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      loadSales().then(openLinkedSale);
      loadDropdownData();
      loadReplyToEmail();
    }
  }, []);

  // Load Reply To email from general settings
  const loadReplyToEmail = async () => {
    try {
      const response = await settingsService.getGeneralSettings();
      if (response.settings?.globalStatementReplyToEmail) {
        setReplyToEmail(response.settings.globalStatementReplyToEmail);
      }
    } catch (error) {
      console.error('Error loading reply-to email:', error);
    }
  };

  // Deep link (product inventory log EVENT cell): /register/history?saleId=123
  // pins that sale to the top of the list and opens its details, whatever the
  // current date-range/page filter would have returned.
  const openLinkedSale = async () => {
    const saleId = new URLSearchParams(location.search).get("saleId");
    if (!saleId) return;
    try {
      const response = await salesService.getSaleById(saleId);
      const sale = response?.sale;
      if (!sale) return;
      setSales((prev) => [sale, ...prev.filter((s) => s.id !== sale.id)]);
      setSelectedSale(sale);
    } catch (err) {
      console.error("Error loading linked sale:", err);
    }
  };

  // Handle gift card filter from navigation
  const locationStateProcessed = useRef(false);
  
  useEffect(() => {
    if (!locationStateProcessed.current && location.state?.giftCardFilter) {
      console.log('Setting gift card filter:', location.state.giftCardFilter);
      locationStateProcessed.current = true;
      setFilters(prev => ({
        ...prev,
        giftCardCode: location.state.giftCardFilter
      }));
      setShowAdvancedFilters(true);
    }
  }, [location.state]);

  const loadSales = async () => {
    setLoading(true);
    setError(null);

    try {
      const filterParams = {
        page: pagination.page,
        limit: pagination.limit,
        ...filters,
      };

      // Returned/Discounted are opt-IN booleans: sending false told the API to
      // exclude every returned/discounted sale from the default list.
      if (!filters.isReturned) delete filterParams.isReturned;
      if (!filters.isDiscounted) delete filterParams.isDiscounted;

      // Date range is inclusive of both boundary datetimes (documented behaviour)
      if (dateRange?.startDate) {
        filterParams.startDate = dateRange.startDate.toISOString();
      }
      if (dateRange?.endDate) {
        filterParams.endDate = dateRange.endDate.toISOString();
      }

      const response = await salesService.getSales(filterParams);
      setSales(response.sales || []);
      setPagination(response.pagination || pagination);
    } catch (err) {
      setError("Failed to load sales data");
      console.error("Error loading sales:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadDropdownData = async () => {
    try {
      // Load users
      const usersResponse = await userService.getUsers();
      setUsers(usersResponse.users || []);

      // Load customers
      const customersResponse = await customerService.getCustomers();
      setCustomers(customersResponse.customers || []);

      // Load payment methods (tenant-configured — the option list is NOT hardcoded)
      const paymentMethodsResponse =
        await paymentMethodService.getPaymentMethods();
      setPaymentMethods(paymentMethodsResponse.paymentMethods || []);
    } catch (err) {
      console.error("Error loading dropdown data:", err);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleApplyFilters = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    loadSales();
  };

  const applySaleUpdate = (updated) => {
    if (!updated) return;
    setSales((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setSelectedSale(updated);
  };

  // Attach a customer to an already-completed sale. The server also credits the
  // sale's earned loyalty points to that customer's balance.
  const handleAssignCustomer = async () => {
    if (!selectedSale || !assignCustomerId) return;
    setActionBusy(true);
    try {
      const response = await salesService.updateSale(selectedSale.id, {
        customerId: assignCustomerId,
      });
      applySaleUpdate(response?.sale);
      setAssignCustomerOpen(false);
      setAssignCustomerId("");
    } catch (err) {
      console.error("Error assigning customer:", err);
      alert("Failed to assign customer. Please try again.");
    } finally {
      setActionBusy(false);
    }
  };

  // Cancel Sale: Continue -> free-text reason -> Confirm (reference flow).
  const handleConfirmCancelSale = async () => {
    if (!selectedSale) return;
    setActionBusy(true);
    try {
      const response = await salesService.cancelSale(selectedSale.id, {
        notes: cancelReason,
      });
      applySaleUpdate(response?.sale);
      setCancelStep(null);
      setCancelReason("");
    } catch (err) {
      console.error("Error cancelling sale:", err);
      alert("Failed to cancel sale. Please try again.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleSaleClick = (sale) => {
    setSelectedSale(sale);
  };

  const handleCloseSaleDetails = () => {
    setSelectedSale(null);
  };

  const handleReprintReceipt = (sale) => {
    if (sale) {
      setSelectedSale(sale);
      setShowPrintDialog(true);
    }
  };

  const handleClosePrintDialog = () => {
    setShowPrintDialog(false);
  };

  const handleModifyDetails = (sale) => {
    if (sale) {
      setSelectedSale(sale);
      setShowEditDialog(true);
    }
  };

  const handleCloseEditDialog = () => {
    setShowEditDialog(false);
  };

  const handleEmailReceipt = (sale) => {
    if (sale) {
      setSelectedSale(sale);
      setShowEmailModal(true);
    }
  };

  // Recall this sale on the sell screen as a RETURN (negative lines) — same path
  // as a receipt-barcode scan. The reference refuses without a register and says
  // so in a toast instead of opening anything.
  const handleReturnItems = (sale) => {
    if (!selectedRegister?.id) {
      notify("You must be in a register location to reload a sale", "warning");
      return;
    }
    navigate("/", { state: { returnSaleNumber: sale?.saleNumber } });
  };

  const handleCloseEmailModal = () => {
    setShowEmailModal(false);
  };

  const handleSendEmail = async (saleId, receiverEmails, senderEmail) => {
    try {
      const result = await emailSaleReceipt({ saleId, receiverEmails, senderEmail, sale: selectedSale });
      if (result.success) {
        alert(`Receipt sent successfully to ${receiverEmails.length} email address(es)!`);
      } else {
        throw new Error(result.message || 'Failed to send email');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  };

  const handleSaveEditedSale = async (update) => {
    if (!selectedSale) return;
    try {
      const response = await salesService.updateSale(selectedSale.id, update);
      const updated = response?.sale || null;
      if (updated) {
        setSales(prev =>
          prev.map(s => (s.id === updated.id ? updated : s))
        );
        setSelectedSale(updated);
      }
      setShowEditDialog(false);
    } catch (err) {
      console.error("Error updating sale:", err);
      alert("Failed to update sale. Please try again.");
    }
  };

  // Date / time / currency all follow Setup > General (Date & Time, Currency).
  const formatDate = (date) =>
    formatDateValue(date, settingsService.getCachedGeneralSettings().dateFormat || "DD/MM/YYYY");

  const formatTime = (date) =>
    formatDateValue(date, settingsService.getCachedGeneralSettings().timeFormat || "HH:mm:ss");


  // Option lists are alphabetical like the reference (case-insensitive).
  const paymentMethodOptions = paymentMethods
    .map((m) => ({ value: m.name, label: m.name }))
    .sort(byLabel);
  const userOptions = users
    .map((u) => ({ value: u.id, label: u.name }))
    .sort(byLabel);
  // The picker label carries the code so two same-named customers can be told
  // apart; the option itself is keyed by id (getOptionKey) — MUI keys options by
  // label by default, which collides for duplicate names.
  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: c.code ? `${customerName(c)} (${c.code})` : customerName(c),
  }));

  // Reference filter cell: a searchable single-select combobox whose label sits
  // inside the box and floats to the notch on focus/value. No pre-highlighted
  // option when the list opens.
  const renderCombo = (label, field, options) => {
    const selected =
      options.find((o) => String(o.value) === String(filters[field])) || null;
    return (
      <Box sx={cellSx}>
      <Autocomplete
        options={options}
        value={selected}
        onChange={(e, opt) => handleFilterChange(field, opt ? opt.value : "")}
        getOptionKey={(o) => o.value}
        getOptionLabel={(o) => o?.label ?? ""}
        isOptionEqualToValue={(o, v) => String(o.value) === String(v.value)}
        ListboxProps={{ sx: comboListboxSx }}
        componentsProps={{ paper: { sx: comboPaperSx } }}
        sx={fieldSx}
        renderInput={(params) => <TextField {...params} label={label} size="small" />}
      />
      </Box>
    );
  };

  const renderText = (label, field) => (
    <Box sx={cellSx}>
      <TextField
        size="small"
        label={label}
        value={filters[field] || ""}
        onChange={(e) => handleFilterChange(field, e.target.value)}
        sx={fieldSx}
      />
    </Box>
  );

  // Each toggle owns its own grid cell, label to the right of the switch.
  const renderToggle = (label, field) => (
    <Box sx={{ ...cellSx, display: "flex", alignItems: "center", minHeight: 74 }}>
      <FormControlLabel
        control={
          <ShopfrontSwitch
            checked={filters[field]}
            onChange={(e) => handleFilterChange(field, e.target.checked)}
          />
        }
        label={label}
      />
    </Box>
  );

  // 3 columns > 1200px, 2 columns <= 1200px, 1 column <= 700px; each cell 1rem.
  const gridSx = {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    "@media (max-width:1200px)": { gridTemplateColumns: "repeat(2, 1fr)" },
    "@media (max-width:700px)": { gridTemplateColumns: "1fr" },
  };

  return (
    <>
      {/* Reference pins the filter bar and scrolls only the sale list — its page
          never grows past the viewport. Match that: fixed-height flex column. */}
      <Box
        sx={{
          p: "0.5rem",
          height: "calc(100vh - 50px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Filters — reference .sales-history-filters-wrapper: #f8f8f8 panel,
            1px rail, 0.5rem padding, 3-column grid of 1rem cells */}
        <Box sx={{ mb: "0.5rem", flexShrink: 0 }}>
          <Box
            sx={{
              bgcolor: "#f8f8f8",
              border: "1px solid #e0e0e0",
              p: "0.5rem",
            }}
          >
          <Box sx={gridSx}>
            {/* Date — ONE range control, dd/MM/yyyy HH:mm:ss on both ends */}
            <Box sx={cellSx}>
              <Typography sx={labelSx}>Date</Typography>
              <DateRangePicker
                value={dateRange}
                onChange={(range) => setDateRange(range)}
                label=""
                enableTime
                allowEmpty
                hideIcon
                separator="—"
                inputSx={fieldSx}
              />
            </Box>

            {/* Amount — one caption over two '$' inputs */}
            <Box sx={cellSx}>
              <Typography sx={labelSx}>Amount</Typography>
              <Box sx={{ display: "flex", gap: "0.25rem" }}>
                <TextField
                  size="small"
                  type="number"
                  placeholder="$"
                  value={filters.minAmount}
                  onChange={(e) => handleFilterChange("minAmount", e.target.value)}
                  sx={fieldSx}
                />
                <TextField
                  size="small"
                  type="number"
                  placeholder="$"
                  value={filters.maxAmount}
                  onChange={(e) => handleFilterChange("maxAmount", e.target.value)}
                  sx={fieldSx}
                />
              </Box>
            </Box>

            {renderCombo("Payment Method", "paymentMethod", paymentMethodOptions)}
          </Box>

          {/* Advanced cells: wrapper animates height, cells fade in 200ms later */}
          <Box
            sx={{
              overflow: "hidden",
              // ponytail: fixed max-height cap instead of measuring the grid —
              // raise it if the advanced block ever grows past ~1200px.
              maxHeight: showAdvancedFilters ? 1200 : 0,
              transition: "max-height 0.2s ease-in-out",
            }}
          >
            <Box
              sx={{
                ...gridSx,
                "& > *": {
                  opacity: showAdvancedFilters ? 1 : 0,
                  transition: "opacity 0.2s ease-in-out 0.2s",
                },
              }}
            >
              {/* Filter set is deliberately limited to the reference's: the reference
                  advanced block has no Outlet or Register filter. Outlet scoping is still
                  available through the top-bar outlet selector. */}
              {renderCombo("User", "userId", userOptions)}
              {renderCombo("Status", "status", STATUS_OPTIONS)}
              {renderText("Invoice Number", "invoiceNumber")}
              {renderText("Order Reference", "orderReference")}
              {/* Customer / Product are server-searched: 3-char minimum */}
              <Box sx={cellSx}>
                <AsyncCombo
                  label="Customer"
                  value={customerFilterOption}
                  fetcher={searchCustomers}
                  onChange={(opt) => {
                    setCustomerFilterOption(opt);
                    handleFilterChange("customerId", opt ? opt.value : "");
                  }}
                />
              </Box>
              <Box sx={cellSx}>
                <AsyncCombo
                  label="Product"
                  value={
                    filters.productName
                      ? { value: filters.productName, label: filters.productName }
                      : null
                  }
                  fetcher={searchProducts}
                  onChange={(opt) =>
                    handleFilterChange("productName", opt ? opt.value : "")
                  }
                />
              </Box>
              {renderText("Gift Card Code", "giftCardCode")}
              {renderToggle("Returned", "isReturned")}
              {renderToggle("Discounted", "isDiscounted")}
            </Box>
          </Box>
          </Box>

          {/* Two flush half-width bars directly under the grid */}
          <Box sx={{ display: "flex" }}>
            <Button
              disableRipple
              disableElevation
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              // Expanded = the reference's `.hide` state (pressed tint); hover is
              // the same slate swap in both states.
              sx={barButtonSx(
                showAdvancedFilters ? "rgb(223,223,224)" : "#f8f8f8",
                showAdvancedFilters ? "rgb(74,77,81)" : "#313439",
                "#313439",
                "#f8f8f8"
              )}
            >
              {showAdvancedFilters
                ? "Hide Advanced Filters"
                : "Show Advanced Filters"}
            </Button>
            <Button
              disableRipple
              disableElevation
              onClick={handleApplyFilters}
              disabled={loading}
              sx={barButtonSx("#5ebbeb", "#f8f8f8")}
            >
              Filter
            </Button>
          </Box>
        </Box>

        {/* Main Content Area - Sales List with Inline Details.
            This is the only scroll area on the page, like the reference. */}
        <Card
          sx={{
            borderRadius: 0,
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <CardContent sx={{ p: 0, borderRadius: 0, flex: 1, minHeight: 0, overflowY: "auto" }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {loading ? null : (
              <List>
                {sales.map((sale, saleIndex) => (
                  <Box key={sale.id}>
                    {/* Sale List Item (hidden when expanded) */}
                    {selectedSale?.id !== sale.id && (
                      <Box
                        // .sale-line-wrapper: 89px tall, zebra #f8f8f8 / #ebebeb (odd).
                        sx={{
                          bgcolor: saleIndex % 2 ? "#ebebeb" : "#f8f8f8",
                          cursor: "pointer",
                        }}
                        onClick={() => handleSaleClick(sale)}
                      >
                        {/* .sale-line: flex, 16px padding, 89px tall */}
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            height: 89,
                            p: "16px",
                            color: "#000",
                          }}
                        >
                          {/* .sale-line-status — 40px fixed-width 32px glyph */}
                          <Box
                            sx={{
                              width: 40,
                              flexShrink: 0,
                              textAlign: "center",
                              lineHeight: 0,
                            }}
                          >
                            <CheckCircleOutlined sx={{ fontSize: 32, color: "#000" }} />
                          </Box>

                          {/* .sale-line-timestamp — date / time / invoice, centred.
                              Reference leaves a 16px gap after the status glyph. */}
                          <Box sx={{ width: 371, flexShrink: 0, ml: "16px", textAlign: "center" }}>
                            <Box sx={{ fontSize: "19.2px", lineHeight: "23px" }}>
                              {formatDate(sale.saleDate)}
                            </Box>
                            <Box sx={{ fontSize: "19.2px", lineHeight: "23px" }}>
                              {formatTime(sale.saleDate)}
                            </Box>
                            {/* Invoice number, zero-padded to the configured
                                length; falls back to the sale number. */}
                            <Box sx={{ fontSize: "13.44px", lineHeight: "16px" }}>
                              {settingsService.padInvoice(sale.invoiceNumber) || sale.saleNumber}
                            </Box>
                          </Box>

                          {/* .sale-line-location — user (and the sale's customer,
                              when one is attached), left aligned, fills the row */}
                          <Box sx={{ flex: 1, minWidth: 0, fontSize: 16, px: 2 }}>
                            {sale.user?.name || "Unknown User"}
                            {sale.customer && (
                              <Box sx={{ fontSize: "13.44px", lineHeight: "16px" }}>
                                {customerName(sale.customer)}
                              </Box>
                            )}
                          </Box>

                          {/* .sale-line-price — 32px dollars, 22.4px cents */}
                          <Box
                            sx={{
                              width: 220,
                              flexShrink: 0,
                              textAlign: "center",
                              fontSize: 32,
                            }}
                          >
                            <SplitPrice value={sale.totalAmount} />
                          </Box>
                        </Box>
                      </Box>
                    )}

                    {/* Expanded Sale Details — the shared reference card; Modify Details
                        renders the same one in editing mode. */}
                    {selectedSale?.id === sale.id && (
                      <Box sx={{ bgcolor: saleIndex % 2 ? "#ebebeb" : "#f8f8f8", p: "16px 0" }}>
                        <SaleDetailCard
                          sale={selectedSale}
                          formatDate={formatDate}
                          formatTime={formatTime}
                          outletName={
                            user?.isSuperAdmin ? "Global" : getOutletName() || ""
                          }
                          actions={
                            <>
                              <Button
                                disableElevation
                                onClick={handleCloseSaleDetails}
                                sx={{ ...actionButtonSx(true), mb: "32px" }}
                              >
                                ✕ Close
                              </Button>
                              {[
                                ["Reprint Receipt", () => handleReprintReceipt(selectedSale), true],
                                ["Email Receipt", () => handleEmailReceipt(selectedSale), hasPermission("reports.sales")],
                                ["Modify Details", () => handleModifyDetails(selectedSale), hasPermission("history_modify_sale")],
                                [
                                  "Assign Customer",
                                  () => {
                                    setAssignCustomerId(selectedSale.customerId || "");
                                    setAssignCustomerOpen(true);
                                  },
                                  hasPermission("history_modify_sale"),
                                ],
                                ["Return Items", () => handleReturnItems(selectedSale), hasPermission("refund")],
                                ...(selectedSale.status !== "CANCELLED"
                                  ? [
                                      [
                                        "Cancel Sale",
                                        () => {
                                          setCancelReason("");
                                          setCancelStep("confirm");
                                        },
                                        hasPermission("history_cancel_sale"),
                                      ],
                                    ]
                                  : []),
                              ].filter(([, , allowed]) => allowed).map(([label, onClick]) => (
                                <Button
                                  key={label}
                                  disableElevation
                                  onClick={onClick}
                                  sx={{ ...actionButtonSx(false), mb: "8px" }}
                                >
                                  {label}
                                </Button>
                              ))}
                            </>
                          }
                        />
                      </Box>
                    )}
                  </Box>
                ))}
              </List>
            )}

            {sales.length === 0 && !loading && (
              <Box sx={{ textAlign: "center", p: 4 }}>
                <Typography variant="h6" color="text.secondary">
                  No sales found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Try adjusting your filters to see more results
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>

      <PrintReceiptDialog
        open={showPrintDialog}
        onClose={handleClosePrintDialog}
        sale={selectedSale}
      />

      <EditSaleDetailsDialog
        open={showEditDialog}
        onClose={handleCloseEditDialog}
        sale={selectedSale}
        onSave={handleSaveEditedSale}
        paymentMethods={paymentMethods}
      />

      <EmailReceiptModal
        open={showEmailModal}
        onClose={handleCloseEmailModal}
        onSend={handleSendEmail}
        saleId={selectedSale?.id}
        senderEmail={replyToEmail}
      />

      {/* Assign Customer — attach a customer to an already-completed sale */}
      <ShopfrontDialog
        open={assignCustomerOpen}
        onClose={() => setAssignCustomerOpen(false)}
        title="Assign Customer"
        width={916}
        actions={
          <>
            <DialogButton tone="cancel" onClick={() => setAssignCustomerOpen(false)}>
              Cancel
            </DialogButton>
            <DialogButton
              tone="primary"
              onClick={handleAssignCustomer}
              disabled={!assignCustomerId || actionBusy}
            >
              Assign
            </DialogButton>
          </>
        }
      >
        <Typography sx={{ fontSize: 16, m: "16px 0" }}>
          Which customer would you like to assign to the sale (note, if loyalty is
          enabled, they will receive the loyalty points for the sale)
        </Typography>
        <Autocomplete
          options={customerOptions}
          value={
            customerOptions.find(
              (o) => String(o.value) === String(assignCustomerId)
            ) || null
          }
          onChange={(e, opt) => setAssignCustomerId(opt ? opt.value : "")}
          getOptionKey={(o) => o.value}
          getOptionLabel={(o) => o?.label ?? ""}
          isOptionEqualToValue={(o, v) => String(o.value) === String(v.value)}
          autoHighlight
          ListboxProps={{ sx: comboListboxSx }}
          componentsProps={{ paper: { sx: comboPaperSx } }}
          sx={fieldSx}
          renderInput={(params) => (
            <TextField {...params} size="small" placeholder="Search customers..." />
          )}
        />
      </ShopfrontDialog>

      {/* Cancel Sale — Continue, then a free-text reason, then Confirm */}
      <ShopfrontDialog
        open={Boolean(cancelStep)}
        onClose={() => setCancelStep(null)}
        variant="warning"
        title="Cancel Sale"
        // 360 rather than the reference's 303: "Continue" at 32px needs the extra
        // room in Roboto.
        width={cancelStep === "reason" ? 460 : 360}
        actions={
          <>
            <DialogButton tone="cancel" onClick={() => setCancelStep(null)}>
              Cancel
            </DialogButton>
            {cancelStep === "confirm" ? (
              <DialogButton tone="danger" onClick={() => setCancelStep("reason")}>
                Continue
              </DialogButton>
            ) : (
              <DialogButton
                tone="danger"
                onClick={handleConfirmCancelSale}
                disabled={!cancelReason.trim() || actionBusy}
              >
                Confirm
              </DialogButton>
            )}
          </>
        }
      >
        {cancelStep === "confirm" ? (
          <Typography sx={{ fontSize: 16, m: "16px 0" }}>
            Are you sure you wish to cancel sale{" "}
            {selectedSale
              ? settingsService.padInvoice(selectedSale.invoiceNumber) ||
                selectedSale.saleNumber
              : ""}
            ?
          </Typography>
        ) : (
          <>
            <Typography sx={{ fontSize: 16, m: "16px 0" }}>
              Why is this sale being cancelled?
            </Typography>
            <Box
              component="input"
              autoFocus
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              sx={{
                width: "100%",
                height: 53,
                boxSizing: "border-box",
                p: "16px",
                fontSize: 16,
                border: "1px solid #000",
                borderRadius: 0,
                outline: "none",
              }}
            />
          </>
        )}
      </ShopfrontDialog>
    </>
  );
};

export default SalesHistory;
