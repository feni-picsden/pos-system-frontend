import React, { useState, useEffect } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Autocomplete,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  Paper,
  Popover,
  IconButton,
  Typography,
  Alert,
  CircularProgress,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  Snackbar,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { addMonths, endOfMonth, format, isSameMonth, startOfMonth, subMonths } from "date-fns";
// enAU => day-first dd/MM/yyyy in every picker on this page (the adapter defaults to en-US).
import { enAU } from "date-fns/locale";
import {
  VisibilityOutlined as ViewIcon,
  DescriptionOutlined as StatementIcon,
  PaymentOutlined as PaymentIcon,
  CalendarTodayOutlined as CalendarIcon,
  KeyboardArrowLeftOutlined as KeyboardArrowLeft,
  KeyboardArrowRightOutlined as KeyboardArrowRight,
  Print as PrintIcon,
  Help as HelpIcon,
  Download as DownloadIcon,
  Email as EmailIcon,
  Close as CloseIcon,
  ArrowDropDownOutlined as ArrowDropDownIcon,
} from "@mui/icons-material";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import customerService from "../../services/customerService";
import customerGroupService from "../../services/customerGroupService";
import paymentService from "../../services/paymentService";
import paymentMethodService from "../../services/paymentMethodService";
import registerService from "../../services/registerService";
import outletService from "../../services/outletService";
import receiptTemplateService from "../../services/receiptTemplateService";
import { useSelectedOutlet } from "../../contexts/SelectedOutletContext";
import StatementRenderer from "../../components/Statement/StatementRenderer";
import ReceiptRenderer from "../../components/Receipt/ReceiptRenderer";
import { buildReceiptPrintHtml } from "../../utils/receiptPrintHtml";
import { groupActivitiesByAge } from "../../utils/statementDefaults";
import { formatCurrency } from "../../utils/currency";
import {
  shouldAutoPrintPaymentReceipt,
  paymentReceiptTemplateOf,
  buildPaymentReceiptHtml,
  safeAmount,
} from "./paymentReceipt";
import { useAppDialogs } from '../../components/Common/AppDialogProvider';

// Shopfront parity: shared style tokens (presentation only)
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

// Reference "action buttons" (View All Statements / Print Balances / Filter):
// square, 53px tall, regular weight, hover INVERTS to #f8f8f8 bg + #5ebbeb text.
const actionButtonSx = {
  bgcolor: "#5ebbeb",
  color: "#f8f8f8",
  border: "1px solid #5ebbeb",
  borderRadius: 0,
  height: 53,
  fontWeight: 400,
  fontSize: 16,
  textTransform: "none",
  boxShadow: "none",
  px: 2,
  transition: "background 0.2s ease, color 0.2s ease",
  "&:hover": { bgcolor: "#f8f8f8", color: "#5ebbeb", boxShadow: "none" },
};

// Outlined fields: dark-gray 1px border, solid black 2px on focus
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

// Reference search box: full-width square field, 1px black border, no leading icon.
const searchFieldSx = {
  "& .MuiOutlinedInput-root": {
    height: 53,
    fontSize: 16,
    borderRadius: 0,
    bgcolor: "#fff",
    "& .MuiOutlinedInput-notchedOutline": { borderColor: "#000", borderWidth: "1px" },
    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#000", borderWidth: "1px" },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#000", borderWidth: "2px" },
  },
};

const filterLabelSx = { mb: 0.5, fontWeight: 400, fontSize: 16, color: "#000" };

// Reference option panel: white, square, 1px black border, no shadow, 56px rows.
const referencePanelSx = {
  borderRadius: 0,
  border: "1px solid #000",
  boxShadow: "none",
  "& .MuiAutocomplete-option": {
    minHeight: 56,
    padding: "16px",
    fontSize: 16,
    color: "#000",
  },
};

// "Balances as of": empty by default (placeholder "Today"), dd/MM/yyyy, click anywhere in
// the field to open a two-month popover with a "Current Day" shortcut.
const calendarSx = {
  width: 300,
  m: 0,
  "& .MuiPickersCalendarHeader-switchViewButton": { display: "none" },
  "& .MuiPickersDay-today": { borderColor: "#0284c7" },
  "& .MuiPickersDay-root.Mui-selected": { bgcolor: "#5ebbeb" },
};

const BalancesAsOfField = ({ value, onChange }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [leftMonth, setLeftMonth] = useState(startOfMonth(new Date()));
  const [rightMonth, setRightMonth] = useState(startOfMonth(addMonths(new Date(), 1)));

  const handleOpen = (event) => {
    const base = value || new Date();
    setLeftMonth(startOfMonth(base));
    setRightMonth(startOfMonth(addMonths(base, 1)));
    setAnchorEl(event.currentTarget);
  };

  const pick = (date) => {
    onChange(date);
    setAnchorEl(null);
  };

  const text = value ? format(value, "dd/MM/yyyy") : "";

  return (
    <>
      <TextField
        fullWidth
        size="small"
        placeholder="Today"
        value={text}
        onClick={handleOpen}
        InputProps={{
          readOnly: true,
          endAdornment: value ? (
            <IconButton
              size="small"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          ) : null,
        }}
        sx={{ ...textFieldSx, "& .MuiOutlinedInput-input": { cursor: "pointer" } }}
      />
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        transitionDuration={0}
        slotProps={{
          paper: { sx: { p: 2, bgcolor: "#f8f8f8", borderRadius: 0, border: "1px solid #000", boxShadow: "none" } },
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, mb: 1 }}>
          <TextField
            size="small"
            value={text}
            placeholder="dd/mm/yyyy"
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <CalendarIcon fontSize="small" sx={{ color: "#676b72" }} />
                </InputAdornment>
              ),
            }}
            sx={{ width: 200, bgcolor: "#fff", ...textFieldSx }}
          />
          <Button
            size="small"
            onClick={() => pick(new Date())}
            sx={{ textTransform: "none", fontSize: 14, fontWeight: 400, color: "#0284c7" }}
          >
            Current Day
          </Button>
        </Box>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enAU}>
          <Box sx={{ display: "flex", gap: 2 }}>
            <DateCalendar
              value={value && isSameMonth(value, leftMonth) ? value : null}
              referenceDate={leftMonth}
              onMonthChange={setLeftMonth}
              onChange={pick}
              sx={calendarSx}
            />
            <DateCalendar
              value={value && isSameMonth(value, rightMonth) ? value : null}
              referenceDate={rightMonth}
              onMonthChange={setRightMonth}
              onChange={pick}
              sx={calendarSx}
            />
          </Box>
        </LocalizationProvider>
      </Popover>
    </>
  );
};

// Reference: statement range defaults to the previous month (end-of-month to end-of-month).
const previousMonthRange = () => [
  endOfMonth(subMonths(new Date(), 2)),
  endOfMonth(subMonths(new Date(), 1)),
];

// Same hidden-iframe print mechanism the app already uses for receipts (PrintReceiptDialog.printReceipt).
// fontFamily defaults to the receipt's monospace; statements print in the
// canvas font instead.
const printHtmlViaIframe = (bodyHtml, title, fontFamily = "'Courier New',monospace") => {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(
    `<html><head><title>${title}</title><style>body{font-family:${fontFamily};margin:0;padding:20px;background:#fff;}@media print{body{margin:0;padding:10px;}@page{margin:0.5cm;}}</style></head><body>${bodyHtml}</body></html>`
  );
  doc.close();
  iframe.onload = () => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 100);
  };
};

const Balance = () => {
  // In-app dialogs — these shadow window.alert/confirm/prompt on purpose.
  const { alert } = useAppDialogs();
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [customerGroups, setCustomerGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomerGroup, setSelectedCustomerGroup] = useState("");
  // Reference: empty by default, placeholder "Today"
  const [balanceDate, setBalanceDate] = useState(null);
  const [minBalance, setMinBalance] = useState("");
  const [maxBalance, setMaxBalance] = useState("");
  // Help docs: the balance range is not applied until Filter is pressed
  const [appliedMinBalance, setAppliedMinBalance] = useState("");
  const [appliedMaxBalance, setAppliedMaxBalance] = useState("");
  // ...and neither is the customer group (reference: nothing changes until Filter)
  const [appliedCustomerGroup, setAppliedCustomerGroup] = useState("");
  const [viewStatementDialogOpen, setViewStatementDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  // Statement run: one customer (row action) or every filtered customer (View All Statements)
  const [statementCustomers, setStatementCustomers] = useState([]);
  const [statementIndex, setStatementIndex] = useState(0);
  const [statementDateRange, setStatementDateRange] = useState([null, null]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [statementTemplates, setStatementTemplates] = useState([]);
  const [statementViewerOpen, setStatementViewerOpen] = useState(false);
  const [generatedStatement, setGeneratedStatement] = useState(null);
  const [makePaymentDialogOpen, setMakePaymentDialogOpen] = useState(false);
  // Payment validation belongs inside the dialog, not on the page behind the backdrop.
  const [paymentError, setPaymentError] = useState("");
  const [paymentCustomer, setPaymentCustomer] = useState(null);
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [selectedRegister, setSelectedRegister] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  const [outstandingInvoices, setOutstandingInvoices] = useState([]);
  const [invoiceAllocations, setInvoiceAllocations] = useState({});
  const [registers, setRegisters] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [profileOutlet, setProfileOutlet] = useState(null);
  const { selectedOutlet, outlets } = useSelectedOutlet();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    loadCustomers();
    loadCustomerGroups();
    loadStatementTemplates();
    loadProfileOutlet();
  }, []);

  // The signed-in user's own outlet (null for super admins).
  const loadProfileOutlet = async () => {
    try {
      const response = await outletService.getCurrentOutlet();
      setProfileOutlet(response?.user?.outlet || null);
    } catch (err) {
      console.error('Error loading outlet details:', err);
    }
  };

  const toBusiness = (outlet) => outlet ? {
    name: outlet.name || '',
    address: outlet.address || '',
    email: outlet.email || '',
    phone: outlet.phone || '',
    abn: '', // ponytail: no ABN column on Outlet — blank beats a fake one
  } : null;

  // Business block behind the statement's {businessName}/{businessAddress}/...
  // variables. A statement is issued BY the customer's own outlet, so that wins;
  // super admins on "All Outlets" have no profile/selected outlet to fall back on.
  const resolveBusiness = (customer) =>
    toBusiness(
      outlets.find((o) => o.id === customer?.outletId) || profileOutlet || selectedOutlet
    );

  const loadStatementTemplates = async () => {
    try {
      const stored = localStorage.getItem('statementTemplates');
      const templates = stored ? JSON.parse(stored) : [];
      if (templates.length === 0) {
        templates.push({ id: 1, name: 'Statement' });
      }
      const validTemplates = templates.filter(t => t && t.id != null);
      setStatementTemplates(validTemplates);
    } catch (err) {
      console.error('Error loading statement templates:', err);
      setStatementTemplates([{ id: 1, name: 'Statement' }]);
    }
  };

  useEffect(() => {
    filterCustomers();
  }, [customers, searchTerm, appliedCustomerGroup, appliedMinBalance, appliedMaxBalance]);

  // Deep link from the customer page ("View Statement" on Balance & Payments):
  // /customers/balance?customerId=31 opens that customer's statement dialog.
  useEffect(() => {
    const id = searchParams.get("customerId");
    if (!id || customers.length === 0) return;
    const customer = customers.find((c) => String(c.id) === id);
    if (customer) handleViewStatement(customer);
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers, searchParams]);

  // showLoader=false keeps the page (and its success banner) on screen while a
  // post-payment refresh runs — the whole page used to blank for ~2s.
  const loadCustomers = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const response = await customerService.getCustomers();
      setCustomers(response.customers || []);
      setError("");
    } catch (err) {
      setError("Failed to load customers");
      console.error("Error loading customers:", err);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const loadCustomerGroups = async () => {
    try {
      const response = await customerGroupService.getCustomerGroups();
      const activeCustomerGroups = (response.customerGroups || []).filter(group => group.isActive);
      setCustomerGroups(activeCustomerGroups);
    } catch (err) {
      console.error("Error loading customer groups:", err);
    }
  };

  const filterCustomers = () => {
    let filtered = customers.filter((customer) => {
      const matchesSearch =
        customer.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.company?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesGroup =
        !appliedCustomerGroup ||
        customer.customerGroupId?.toString() === appliedCustomerGroup;

      const currentBalance = parseFloat(customer.currentOwing || 0);
      // A non-numeric bound must be ignored, not silently empty the whole list.
      const min = Number.isFinite(parseFloat(appliedMinBalance)) ? parseFloat(appliedMinBalance) : -Infinity;
      const max = Number.isFinite(parseFloat(appliedMaxBalance)) ? parseFloat(appliedMaxBalance) : Infinity;
      const matchesBalance = currentBalance >= min && currentBalance <= max;

      return matchesSearch && matchesGroup && matchesBalance;
    });

    setFilteredCustomers(filtered);
  };

  // Help docs: "enter a minimum and a maximum customer balance and then press Filter"
  const handleApplyFilter = () => {
    setAppliedMinBalance(minBalance);
    setAppliedMaxBalance(maxBalance);
    setAppliedCustomerGroup(selectedCustomerGroup);
  };

  const totalBalance = filteredCustomers.reduce(
    (sum, customer) => sum + parseFloat(customer.currentOwing || 0),
    0
  );

  // Reference payment page: live "$X Outstanding and $Y Unallocated" + a totals row.
  const allocatedTotal = Object.values(invoiceAllocations).reduce((sum, a) => sum + (Number(a) || 0), 0);
  const invoicesTotal = outstandingInvoices.reduce((sum, i) => sum + (Number(i.totalAmount) || 0), 0);
  const outstandingTotal = outstandingInvoices.reduce((sum, i) => sum + (Number(i.balance) || 0), 0);
  const unallocatedTotal = (parseFloat(paymentAmount) || allocatedTotal) - allocatedTotal;

  const handleViewCustomer = (customer) => {
    navigate(`/customers/${customer.id}/view`);
  };

  const openStatementDialog = (customersForRun) => {
    if (customersForRun.length === 0) {
      setError("No customers to generate a statement for");
      return;
    }
    setStatementCustomers(customersForRun);
    setStatementIndex(0);
    setSelectedCustomer(customersForRun[0]);
    // Reference: the range defaults to the previous month
    setStatementDateRange(previousMonthRange());
    const firstTemplate = statementTemplates.length > 0 && statementTemplates[0]?.id != null
      ? statementTemplates[0].id.toString()
      : "";
    setSelectedTemplate(firstTemplate);
    setViewStatementDialogOpen(true);
  };

  const handleViewStatement = (customer) => openStatementDialog([customer]);

  // Reference: opens the same View Statement dialog, for every listed customer
  const handleViewAllStatements = () => openStatementDialog(filteredCustomers);

  const buildStatement = async (customer) => {
    // Fetch statement data from API
    const startDate = statementDateRange[0].toISOString().split('T')[0];
    const endDate = statementDateRange[1].toISOString().split('T')[0];
    const statementData = await customerService.getCustomerStatement(
      customer.id,
      startDate,
      endDate
    );
    const summary = statementData.summary || {};

    return {
      customer: { ...customer, ...(statementData.customer || {}) },
      business: resolveBusiness(customer),
      dateRange: statementDateRange,
      template: statementTemplates.find(t => t.id.toString() === selectedTemplate),
      data: {
        summary: {
          // ponytail: backend statement endpoint returns only {overdue,current,total},
          // no true 0-30/30+ aging buckets. Map current->"0 days", overdue->"30 days"
          // so both Overview boxes show real figures. Upgrade path: return real
          // per-age buckets from the statement endpoint and map 1:1 here.
          days0: { days: '0 days', amount: formatCurrency(summary.current || 0) },
          days30: { days: '30 days', amount: formatCurrency(summary.overdue || 0) },
          dateRange: `${statementDateRange[0].toLocaleDateString("en-AU")} - ${statementDateRange[1].toLocaleDateString("en-AU")}`,
          overdue: formatCurrency(summary.overdue || 0),
          current: formatCurrency(summary.current || 0),
          total: formatCurrency(summary.total || 0),
        },
        // Flat, as the hardcoded fallback table expects; the dynamic renderer
        // gets these grouped by aging category (see the viewer below).
        activities: statementData.activities || [],
      }
    };
  };

  const handleGenerateStatement = async () => {
    if (!statementDateRange[0] || !statementDateRange[1]) {
      setError("Please select a date range");
      return;
    }
    if (!selectedTemplate) {
      setError("Please select a statement template");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const customer = statementCustomers[0] || selectedCustomer;
      const statement = await buildStatement(customer);

      setStatementIndex(0);
      setSelectedCustomer(customer);
      setGeneratedStatement(statement);
      setViewStatementDialogOpen(false);
      setStatementViewerOpen(true);
    } catch (err) {
      console.error("Error generating statement:", err);
      // Surface what the server actually said. A bare "try again" hid a 404
      // ("Customer not found" — stale/out-of-scope customer id) behind a
      // message that suggested a transient failure.
      const serverMsg = err?.response?.data?.error || err?.response?.data?.message;
      setError(serverMsg
        ? `Failed to generate statement: ${serverMsg}`
        : "Failed to generate statement. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Help docs: an arrow beside the statement moves to the next customer's statement
  const handleStatementStep = async (delta) => {
    const nextIndex = statementIndex + delta;
    if (nextIndex < 0 || nextIndex >= statementCustomers.length) return;

    try {
      const customer = statementCustomers[nextIndex];
      const statement = await buildStatement(customer);
      setStatementIndex(nextIndex);
      setSelectedCustomer(customer);
      setGeneratedStatement(statement);
    } catch (err) {
      console.error("Error generating statement:", err);
      setError("Failed to generate statement. Please try again.");
    }
  };

  const handleDownloadStatement = async () => {
    try {
      const statementContent = document.querySelector('[data-statement-content]');
      if (!statementContent) {
        setError("Statement content not found");
        return;
      }

      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).jsPDF;

      const canvas = await html2canvas(statementContent, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 0;
      
      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      
      const fileName = `Statement_${selectedCustomer?.firstName}_${selectedCustomer?.lastName}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setError('Failed to generate PDF. Please try printing instead.');
    }
  };

  // Print only the rendered statement (template-driven or fallback), matching
  // what Download captures — window.print() emitted the whole Balance page.
  const handlePrintStatement = () => {
    const statementContent = document.querySelector('[data-statement-content]');
    if (!statementContent) {
      setError("Statement content not found");
      return;
    }
    printHtmlViaIframe(
      statementContent.innerHTML,
      "Statement",
      generatedStatement?.template?.config?.canvas?.fontFamily || "Arial,sans-serif"
    );
  };

  const handleEmailStatement = () => {
    alert(`Email statement to ${selectedCustomer?.email || 'customer email'}`);
  };

  const handleMakePayment = async (customer) => {
    setPaymentCustomer(customer);
    setPaymentDate(new Date());
    setPaymentAmount("");
    setPaymentReference("");
    setPaymentError("");
    setInvoiceAllocations({});
    setMakePaymentDialogOpen(true);

    try {
      await loadPaymentData();
      await loadOutstandingInvoices(customer.id);
    } catch (err) {
      console.error('Error loading payment data:', err);
      setPaymentError('Failed to load payment data');
    }
  };

  const loadPaymentData = async () => {
    try {
      const [registersData, paymentMethodsData] = await Promise.all([
        registerService.list({ isActive: true }),
        paymentMethodService.getPaymentMethods({ isActive: true })
      ]);
      
      setRegisters(registersData);
      setPaymentMethods(paymentMethodsData.paymentMethods || []);
      
      if (registersData.length > 0) {
        const defaultRegister = registersData.find(r => r.isDefault) || registersData[0];
        setSelectedRegister(defaultRegister.id.toString());
      }
      
      if (paymentMethodsData.paymentMethods && paymentMethodsData.paymentMethods.length > 0) {
        const defaultMethod = paymentMethodsData.paymentMethods.find(pm => pm.isDefault) || paymentMethodsData.paymentMethods.find(pm => pm.name.toLowerCase() === 'cash') || paymentMethodsData.paymentMethods[0];
        setSelectedPaymentMethod(defaultMethod.id.toString());
      }
    } catch (err) {
      console.error('Error loading payment data:', err);
    }
  };

  const loadOutstandingInvoices = async (customerId) => {
    try {
      const response = await paymentService.getCustomerOutstandingInvoices(customerId);
      setOutstandingInvoices(response.invoices || []);
    } catch (err) {
      console.error('Error loading outstanding invoices:', err);
      const mockInvoices = [
        {
          id: 1,
          saleNumber: '10104512',
          createdAt: new Date('2024-05-03T10:45:25'),
          user: { name: 'Chintan' },
          register: { name: 'Register' },
          totalAmount: 35230.82,
          balance: 35230.82
        },
        {
          id: 2,
          saleNumber: '10104631',
          createdAt: new Date('2024-05-05T07:24:39'),
          user: { name: 'Chintan' },
          register: { name: 'Register' },
          totalAmount: 1209.25,
          balance: 1209.25
        },
        {
          id: 3,
          saleNumber: '10105281',
          createdAt: new Date('2024-05-13T02:46:49'),
          user: { name: 'Chintan' },
          register: { name: 'Register' },
          totalAmount: 473.00,
          balance: 473.00
        },
        {
          id: 4,
          saleNumber: '10106371',
          createdAt: new Date('2024-05-24T22:44:11'),
          user: { name: 'Chintan' },
          register: { name: 'Register' },
          totalAmount: 1372.67,
          balance: 1372.67
        },
        {
          id: 5,
          saleNumber: '10106546',
          createdAt: new Date('2024-05-27T03:51:38'),
          user: { name: 'Chintan' },
          register: { name: 'Register' },
          totalAmount: 4355.20,
          balance: 4355.20
        },
        {
          id: 6,
          saleNumber: '10107163',
          createdAt: new Date('2024-06-03T05:53:36'),
          user: { name: 'Chintan' },
          register: { name: 'Register' },
          totalAmount: 17079.11,
          balance: 17079.11
        },
        {
          id: 7,
          saleNumber: '10107724',
          createdAt: new Date('2024-06-10T06:06:30'),
          user: { name: 'Danica' },
          register: { name: 'Register' },
          totalAmount: 592.58,
          balance: 592.58
        }
      ];
      setOutstandingInvoices(mockInvoices);
    }
  };

  // Clamp to 0..invoice balance: a negative allocation was silently dropped and an
  // over-allocation was only rejected by the API with a 400.
  const handleAllocationChange = (invoiceId, value, maxAmount) => {
    setInvoiceAllocations(prev => {
      const next = { ...prev };
      if (value === "") delete next[invoiceId];
      else next[invoiceId] = Math.min(Math.max(parseFloat(value) || 0, 0), Number(maxAmount) || 0);
      return next;
    });
  };

  // Reference: "enter a total payment amount and press Autofill to distribute it"
  // across the outstanding invoices, oldest first.
  const handleAutofill = () => {
    let remaining = parseFloat(paymentAmount) || 0;
    const next = {};
    for (const invoice of outstandingInvoices) {
      if (remaining <= 0) break;
      const owed = Number(invoice.balance) || 0;
      const alloc = Math.min(owed, remaining);
      if (alloc > 0) {
        next[invoice.id] = Number(alloc.toFixed(2));
        remaining -= alloc;
      }
    }
    setInvoiceAllocations(next);
  };

  const paymentDateInvalid = !paymentDate || isNaN(new Date(paymentDate));

  const handleCompletePayment = async () => {
    if (!paymentCustomer) return;

    const totalAllocated = Object.values(invoiceAllocations).reduce((sum, amount) => sum + amount, 0);
    const paymentAmt = parseFloat(paymentAmount) || totalAllocated;

    if (paymentAmt <= 0 && totalAllocated <= 0) {
      setPaymentError("Please enter a payment amount or allocate amounts to invoices");
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

      const paymentData = {
        customerId: paymentCustomer.id,
        paymentDate: paymentDate.toISOString(),
        registerId: parseInt(selectedRegister),
        paymentMethodId: parseInt(selectedPaymentMethod),
        amount: paymentAmt,
        reference: paymentReference,
        allocations: Object.entries(invoiceAllocations)
          .filter(([, amount]) => amount > 0)
          .map(([invoiceId, amount]) => ({
            invoiceId: parseInt(invoiceId),
            amount: amount
          }))
      };

      const result = await paymentService.createPayment(paymentData);

      // ponytail: AUTO PRINT PAYMENT RECEIPT (group-only flag). Group without the flag
      // (or no group) => shouldAutoPrint is false => nothing prints, identical to today.
      const group =
        customerGroups.find((g) => g.id === paymentCustomer.customerGroupId) ||
        paymentCustomer.customerGroup ||
        null;
      if (shouldAutoPrintPaymentReceipt(group)) {
        const method = paymentMethods.find((m) => m.id.toString() === selectedPaymentMethod);
        const customerName = `${paymentCustomer.firstName} ${paymentCustomer.lastName}`.trim();
        const dateText = paymentDate.toLocaleString("en-AU");
        const paidAmount = safeAmount(result?.payment?.amount ?? paymentAmt);

        // The group's Payment Receipt is a for='Payment' ReceiptTemplate id (from
        // receiptTemplateService.getTemplates) — load it from that same service and render
        // it dynamically through ReceiptRenderer, exactly as sale receipts print. The old
        // path emitted a hardcoded layout and looked the name up in the statement-editor
        // localStorage store (disjoint id space), so it never resolved.
        const templateId = paymentReceiptTemplateOf(group);
        let template = null;
        try {
          if (templateId) template = (await receiptTemplateService.getTemplate(templateId))?.template || null;
        } catch (err) {
          console.error("Error loading payment receipt template:", err);
        }

        if (template?.config?.components?.length) {
          const receiptData = {
            transactionId: paymentReference || (result?.payment?.id ? `#${result.payment.id}` : ""),
            date: dateText,
            formattedDate: dateText,
            status: "completed",
            outlet: resolveBusiness(paymentCustomer),
            customer: {
              firstName: paymentCustomer.firstName || "",
              lastName: paymentCustomer.lastName || "",
              company: paymentCustomer.company || "",
            },
            items: [],
            subtotal: paidAmount,
            total: paidAmount.toFixed(2),
            paymentAmount: paidAmount.toFixed(2),
            change: "0.00",
            balanceOwing: result?.customer?.currentOwing,
            payments: [
              {
                method: method?.name || "Payment",
                amount: paidAmount.toFixed(2),
                description: paymentReference || method?.name || "Payment",
                reference: paymentReference || null,
              },
            ],
          };
          const markup = renderToStaticMarkup(
            <ReceiptRenderer receiptData={receiptData} template={template} />
          );
          const headStyles = Array.from(document.querySelectorAll("style")).map((n) => n.outerHTML).join("\n");
          const iframe = document.createElement("iframe");
          iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
          document.body.appendChild(iframe);
          const doc = iframe.contentWindow.document;
          doc.open();
          doc.write(buildReceiptPrintHtml({ markup, headStyles, template, title: "Payment Receipt" }));
          doc.close();
          iframe.onload = () => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            setTimeout(() => document.body.removeChild(iframe), 100);
          };
        } else {
          // No Payment template assigned (or it failed to load): keep the minimal built-in
          // receipt, but caption it with the receipt-template name we resolved (never the
          // statement store).
          const html = buildPaymentReceiptHtml(
            {
              customerName,
              dateText,
              methodName: method?.name || "",
              reference: paymentReference,
              amount: paidAmount,
              newOwing: result?.customer?.currentOwing,
              templateName: template?.name || null,
            },
            formatCurrency
          );
          printHtmlViaIframe(html, "Payment Receipt");
        }
      }

      // No setTimeout re-filter here: it re-ran filterCustomers from the stale
      // pre-payment closure and overwrote the fresh rows. The [customers] effect
      // already re-filters once loadCustomers lands.
      await loadCustomers(false);

      setMakePaymentDialogOpen(false);
      setSuccess("Payment processed successfully");
    } catch (err) {
      console.error('Error processing payment:', err);
      setPaymentError(err.response?.data?.error || "Failed to process payment");
    } finally {
      setProcessingPayment(false);
    }
  };

  const handlePrintBalances = () => {
    window.print();
  };

  if (loading) {
    return null;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <Button
            variant="contained"
            onClick={handleViewAllStatements}
            sx={{ ...actionButtonSx, width: 205 }}
          >
            View All Statements
          </Button>
          <Button
            variant="contained"
            onClick={handlePrintBalances}
            sx={{ ...actionButtonSx, width: 165 }}
          >
            Print Balances
          </Button>
        </Box>
        <Box sx={{ textAlign: "right" }}>
          <Typography variant="h4" fontWeight="bold" lineHeight={1}>
            {filteredCustomers.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Results
          </Typography>
        </Box>
      </Box>

      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search for Customers"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            endAdornment: searchTerm ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchTerm("")} aria-label="clear search">
                  <CloseIcon fontSize="small" sx={{ color: "#000" }} />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={searchFieldSx}
        />
      </Box>
      <Paper sx={{ p: 3, mb: 3, borderRadius: 0 }}>
        <Grid container spacing={2} alignItems="flex-start">
          <Grid item xs={12} md={4}>
            <Typography variant="body2" sx={filterLabelSx}>
              Customer Group
            </Typography>
            <Autocomplete
              size="small"
              options={customerGroups}
              getOptionLabel={(option) => option.name || ""}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              value={
                customerGroups.find((group) => group.id.toString() === selectedCustomerGroup) || null
              }
              onChange={(event, group) => setSelectedCustomerGroup(group ? group.id.toString() : "")}
              popupIcon={<ArrowDropDownIcon />}
              slotProps={{ paper: { sx: referencePanelSx } }}
              renderInput={(params) => (
                <TextField {...params} placeholder="Select..." sx={textFieldSx} />
              )}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography variant="body2" sx={filterLabelSx}>
              Balances as of
            </Typography>
            <BalancesAsOfField value={balanceDate} onChange={setBalanceDate} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography variant="body2" sx={{ whiteSpace: "nowrap", ...filterLabelSx }}>
              Customer Balance Between
            </Typography>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <TextField
                placeholder="Min"
                type="number"
                value={minBalance}
                onChange={(e) => setMinBalance(e.target.value)}
                size="small"
                inputProps={{ step: "any" }}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
                sx={{ width: "50%", ...textFieldSx }}
              />
              <TextField
                placeholder="Max"
                type="number"
                value={maxBalance}
                onChange={(e) => setMaxBalance(e.target.value)}
                size="small"
                inputProps={{ step: "any" }}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
                sx={{ width: "50%", ...textFieldSx }}
              />
            </Box>
          </Grid>
          <Grid item xs={12} sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              variant="contained"
              onClick={handleApplyFilter}
              sx={{ ...actionButtonSx, width: 300 }}
            >
              Filter
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Snackbars (z-index 1400) sit ABOVE the dialogs (1300): an error raised from
          inside a modal used to render on the page behind the backdrop. */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError("")}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity="error" onClose={() => setError("")} sx={{ width: "100%" }}>
          {error}
        </Alert>
      </Snackbar>
      <Snackbar
        open={!!success}
        autoHideDuration={3000}
        onClose={() => setSuccess("")}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setSuccess("")} sx={{ width: "100%" }}>
          {success}
        </Alert>
      </Snackbar>

      <TableContainer sx={{ mt: 1 }}>
        <Table
          sx={{
            borderCollapse: "collapse",
            // Reference: fully bordered black table, square corners
            "& th, & td": { border: "1px solid #000", padding: "8px" },
          }}
        >
          <TableHead>
            <TableRow
              sx={{
                "& th": {
                  bgcolor: "#5ebbeb",
                  color: "#f8f8f8",
                  fontWeight: 700,
                  fontSize: 16,
                  height: 36,
                  borderRadius: 0,
                },
              }}
            >
              <TableCell sx={{ width: "40%" }}>Customer</TableCell>
              <TableCell sx={{ width: "20%" }}>Total Balance</TableCell>
              <TableCell sx={{ width: "40%" }} align="center">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody
            sx={{
              "& td": { fontSize: 16, color: "#000" },
            }}
          >
            {filteredCustomers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell>
                  <Box>
                    <Typography sx={{ fontSize: 16, color: "#000" }}>
                      {customer.firstName} {customer.lastName}
                    </Typography>
                    {customer.company && (
                      <Typography sx={{ fontSize: 16, color: "#000" }}>
                        {customer.company}
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>{formatCurrency(customer.currentOwing)}</TableCell>
                <TableCell align="center">
                  <Box
                    sx={{
                      display: "flex",
                      gap: 3,
                      justifyContent: "center",
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <Button
                      size="small"
                      startIcon={<ViewIcon />}
                      onClick={() => handleViewCustomer(customer)}
                      sx={{ color: "#0284c7", textTransform: "none", fontWeight: 700, fontSize: 16, minWidth: 0, whiteSpace: "nowrap" }}
                    >
                      View Customer
                    </Button>
                    <Button
                      size="small"
                      startIcon={<StatementIcon />}
                      onClick={() => handleViewStatement(customer)}
                      sx={{ color: "#dc2626", textTransform: "none", fontWeight: 700, fontSize: 16, minWidth: 0, whiteSpace: "nowrap" }}
                    >
                      View Statement
                    </Button>
                    <Button
                      size="small"
                      startIcon={<PaymentIcon />}
                      onClick={() => handleMakePayment(customer)}
                      sx={{ color: "#16a34a", textTransform: "none", fontWeight: 700, fontSize: 16, minWidth: 0, whiteSpace: "nowrap" }}
                    >
                      Make Payment
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
            {filteredCustomers.length === 0 && !loading && (
              <TableRow>
                <TableCell
                  colSpan={3}
                  align="center"
                  sx={{ py: 4 }}
                >
                  <Typography color="text.secondary">
                    {searchTerm ||
                    appliedCustomerGroup ||
                    appliedMinBalance ||
                    appliedMaxBalance
                      ? "No customers found matching your filters"
                      : "No customers found"}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          <TableFooter>
            <TableRow
              sx={{
                "& th": {
                  bgcolor: "#5ebbeb",
                  color: "#f8f8f8",
                  fontWeight: 700,
                  fontSize: 16,
                  textAlign: "center",
                },
              }}
            >
              <TableCell component="th">TOTAL</TableCell>
              <TableCell component="th">{formatCurrency(totalBalance)}</TableCell>
              <TableCell component="th" />
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>

      <Dialog 
        open={viewStatementDialogOpen} 
        onClose={() => setViewStatementDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
            <Avatar sx={{ bgcolor: '#1976d2', width: 56, height: 56, mb: 2 }}>
              <HelpIcon sx={{ fontSize: 32, color: 'white' }} />
            </Avatar>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              View Statement
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enAU}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <InputLabel>Date Range</InputLabel>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <DatePicker
                    label="Start Date"
                    value={statementDateRange[0]}
                    onChange={(newValue) => {
                      setStatementDateRange([newValue, statementDateRange[1]]);
                    }}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        size: "small",
                        sx: textFieldSx
                      }
                    }}
                  />
                  <DatePicker
                    label="End Date"
                    value={statementDateRange[1]}
                    onChange={(newValue) => {
                      setStatementDateRange([statementDateRange[0], newValue]);
                    }}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        size: "small",
                        sx: textFieldSx
                      }
                    }}
                  />
                </Box>
              </Box>
            </LocalizationProvider>

            <FormControl fullWidth>
              <InputLabel>Statement Template</InputLabel>
              <Select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                label="Statement Template"
                IconComponent={ArrowDropDownIcon}
                MenuProps={selectMenuProps}
                sx={selectSx}
              >
                {statementTemplates.map((template) => (
                  <MenuItem key={template?.id || template?.name} value={template?.id?.toString() || ''} sx={menuItemSx}>
                    {template?.name || 'Unnamed Template'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setViewStatementDialogOpen(false)}
            sx={{ textTransform: "none", fontWeight: 700, fontSize: 16 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerateStatement}
            variant="contained"
            sx={primaryButtonSx}
          >
            View
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog 
        open={statementViewerOpen} 
        onClose={() => setStatementViewerOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            height: '90vh',
            maxHeight: '90vh',
          }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6">
                Statement - {selectedCustomer?.firstName} {selectedCustomer?.lastName}
              </Typography>
              {/* Help docs: arrows step through each customer's statement */}
              {statementCustomers.length > 1 && (
                <>
                  <IconButton
                    size="small"
                    onClick={() => handleStatementStep(-1)}
                    disabled={statementIndex === 0}
                  >
                    <KeyboardArrowLeft />
                  </IconButton>
                  <Typography variant="body2" color="text.secondary">
                    {statementIndex + 1} of {statementCustomers.length}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => handleStatementStep(1)}
                    disabled={statementIndex === statementCustomers.length - 1}
                  >
                    <KeyboardArrowRight />
                  </IconButton>
                </>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                startIcon={<DownloadIcon />}
                onClick={handleDownloadStatement}
                variant="outlined"
                size="small"
              >
                Download
              </Button>
              <Button
                startIcon={<PrintIcon />}
                onClick={handlePrintStatement}
                variant="outlined"
                size="small"
              >
                Print
              </Button>
              <Button
                startIcon={<EmailIcon />}
                onClick={handleEmailStatement}
                variant="outlined"
                size="small"
              >
                Email
              </Button>
              <IconButton onClick={() => setStatementViewerOpen(false)} size="small">
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ overflow: 'auto', p: 3 }}>
          {generatedStatement && (
            <Box 
              data-statement-content
              sx={{ 
              bgcolor: 'white', 
              p: 4, 
              minHeight: '100%',
              '@media print': {
                p: 2,
              }
            }}>
              {generatedStatement.template?.config?.components?.length > 0 ? (
                <StatementRenderer
                  statementData={{
                    summary: generatedStatement.data.summary,
                    activities: groupActivitiesByAge(
                      generatedStatement.data.activities || [],
                      generatedStatement.dateRange[1]
                    ),
                    customer: generatedStatement.customer,
                    business: generatedStatement.business,
                  }}
                  template={generatedStatement.template}
                />
              ) : (
                <>
              <Box sx={{ mb: 4, textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Statement
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {generatedStatement.data.summary.dateRange}
                </Typography>
              </Box>

              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {selectedCustomer?.firstName} {selectedCustomer?.lastName}
                </Typography>
                {selectedCustomer?.company && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    {selectedCustomer.company}
                  </Typography>
                )}
                {selectedCustomer?.email && (
                  <Typography variant="body2" color="text.secondary">
                    {selectedCustomer.email}
                  </Typography>
                )}
              </Box>

              <Box sx={{ mb: 4, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>Summary</Typography>
                <Box sx={{ display: 'flex', gap: 4, mb: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">0 days</Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {generatedStatement.data.summary.days0.amount}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">30 days</Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {generatedStatement.data.summary.days30.amount}
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="caption" sx={{ mb: 2, display: 'block' }}>
                  {generatedStatement.data.summary.dateRange}
                </Typography>
                <Box sx={{ display: 'flex', gap: 4 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Overdue</Typography>
                    <Typography variant="body1">
                      {generatedStatement.data.summary.overdue}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Current</Typography>
                    <Typography variant="body1">
                      {generatedStatement.data.summary.current}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Total</Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {generatedStatement.data.summary.total}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                      <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Activity</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Reference</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Total</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Balance</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {generatedStatement.data.activities && generatedStatement.data.activities.length > 0 ? (
                      generatedStatement.data.activities.map((activity, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            {new Date(activity.date).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                          </TableCell>
                          <TableCell>{activity.activity}</TableCell>
                          <TableCell>{activity.reference || '-'}</TableCell>
                          <TableCell>
                            {formatCurrency(activity.total)}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(activity.balance)} {/* Running balance from the endpoint, payments included */}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          No transactions found for the selected date range
                        </TableCell>
                          </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ mt: 3, textAlign: 'right' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Total Due {generatedStatement.data.summary.total}
                </Typography>
              </Box>
                </>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={makePaymentDialogOpen}
        onClose={() => setMakePaymentDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            maxHeight: '90vh',
          }
        }}
      >
        <DialogTitle>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            Make Payment
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Please note: if the payment time falls outside a register closure, this payment will not appear in any register closure.
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ overflow: 'auto' }}>
          {paymentError && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setPaymentError("")}>
              {paymentError}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Customer"
                  value={paymentCustomer ? `${paymentCustomer.firstName} ${paymentCustomer.lastName}${paymentCustomer.company ? ` - ${paymentCustomer.company}` : ''}` : ''}
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
                          paymentError && paymentDateInvalid
                            ? "Payment date is required"
                            : "",
                        sx: textFieldSx
                      }
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
                    {registers.map((register) => (
                      <MenuItem key={register.id} value={register.id.toString()} sx={menuItemSx}>
                        {register.name}
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
                    {paymentMethods.map((method) => (
                      <MenuItem key={method.id} value={method.id.toString()} sx={menuItemSx}>
                        {method.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Outstanding Invoices
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="body2" sx={{ color: '#676b72' }}>
                    {formatCurrency(outstandingTotal - allocatedTotal)} Outstanding and{' '}
                    {formatCurrency(unallocatedTotal)} Unallocated
                  </Typography>
                  <Button onClick={handleAutofill} variant="outlined" size="small">
                    Autofill
                  </Button>
                </Box>
              </Box>
              <TableContainer>
                <Table size="small" sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                  <TableHead>
                    <TableRow
                      sx={{
                        '& th': { bgcolor: '#5ebbeb', color: 'white', fontWeight: 700, fontSize: 16, border: 0, height: 51, py: 0 },
                        '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
                        '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' },
                      }}
                    >
                      <TableCell>Timestamp</TableCell>
                      <TableCell>Invoice</TableCell>
                      <TableCell>User</TableCell>
                      <TableCell>Register</TableCell>
                      <TableCell>Total</TableCell>
                      <TableCell>Outstanding</TableCell>
                      <TableCell>Allocation</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody
                    sx={{
                      '& tr:nth-of-type(odd)': { bgcolor: '#ffffff' },
                      '& tr:nth-of-type(even)': { bgcolor: '#f5f5f5' },
                      '& td': { border: 0, fontSize: 16, color: '#000' },
                    }}
                  >
                    {outstandingInvoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          {new Date(invoice.createdAt).toLocaleString('en-AU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </TableCell>
                        <TableCell>{invoice.saleNumber}</TableCell>
                        <TableCell>{invoice.user?.name || 'N/A'}</TableCell>
                        <TableCell>{invoice.register?.name || 'Register'}</TableCell>
                        <TableCell>{formatCurrency(invoice.totalAmount)}</TableCell>
                        <TableCell>{formatCurrency(invoice.balance)}</TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            value={invoiceAllocations[invoice.id] || ''}
                            onChange={(e) => handleAllocationChange(invoice.id, e.target.value, invoice.balance)}
                            InputProps={{
                              startAdornment: <InputAdornment position="start">$</InputAdornment>,
                            }}
                            sx={{ width: 120, ...textFieldSx }}
                            inputProps={{
                              max: invoice.balance,
                              min: 0,
                              step: 0.01
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {outstandingInvoices.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 2 }}>
                          <Typography color="text.secondary">No outstanding invoices</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  {outstandingInvoices.length > 0 && (
                    <TableFooter>
                      <TableRow sx={{ '& td': { border: 0, fontSize: 16, color: '#000', fontWeight: 700 } }}>
                        <TableCell colSpan={4}>TOTAL</TableCell>
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
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button
            onClick={() => setMakePaymentDialogOpen(false)}
            sx={{ ...primaryButtonSx, color: 'white' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCompletePayment}
            disabled={processingPayment}
            variant="contained"
            sx={primaryButtonSx}
          >
            {processingPayment ? 'Processing...' : 'Complete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Balance;
