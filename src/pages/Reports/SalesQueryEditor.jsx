import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useLocation, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  FileDownload as ExportIcon,
  PrintOutlined as PrintIcon,
  SaveOutlined as SaveIcon,
  PlayArrowOutlined as PlayArrowIcon,
  PictureAsPdf as PdfIcon,
  Description as CsvIcon,
  TableChart as XlsxIcon,
  Code as JsonIcon,
  KeyboardDoubleArrowUp as ChevronUpIcon,
  KeyboardDoubleArrowDown as ChevronDownIcon,
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon,
  PriorityHigh as ErrorMarkIcon,
  Close as CloseIcon,
  LayersOutlined as GroupsIcon,
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
const { jsPDF } = await import('jspdf');
import autoTable from 'jspdf-autotable';
import salesReportService from '../../services/salesReportService';
import favouriteReportService from '../../services/favouriteReportService';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';
import useHeaderScope from '../../hooks/useHeaderScope';

// ───────────────────────────────────────────── reference styles
const INSTANT = 'none';

const outlinedBtnSx = {
  height: 42,
  borderRadius: '12px',
  px: 3,
  fontSize: 16,
  fontWeight: 700,
  textTransform: 'none',
  transition: INSTANT,
  color: '#0284c7',
  borderColor: '#0ea5e9',
  bgcolor: '#fff',
  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)', borderColor: '#0ea5e9' },
  '&.Mui-disabled': { bgcolor: '#e5e5e5', color: '#737373', borderColor: '#a3a3a3', cursor: 'not-allowed' },
};

const neutralBtnSx = {
  ...outlinedBtnSx,
  color: '#313439',
  borderColor: '#404040',
  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)', borderColor: '#404040' },
};

const primaryBtnSx = {
  height: 42,
  borderRadius: '12px',
  px: 3,
  fontSize: 16,
  fontWeight: 700,
  textTransform: 'none',
  transition: INSTANT,
  boxShadow: 'none',
  bgcolor: '#0ea5e9',
  color: '#fff',
  '&:hover': { bgcolor: '#0284c7', boxShadow: 'none' },
  '&.Mui-disabled': { bgcolor: '#e5e5e5', color: '#737373', cursor: 'not-allowed' },
};

const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    bgcolor: '#fff',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: 1 },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: 2 },
  },
  '& input::placeholder, & textarea::placeholder': { color: '#808080', opacity: 1 },
};

// Data table chrome — same as SalesReport.jsx / ReportTable.jsx.
const TABLE_HEAD_SX = {
  '& th': {
    backgroundColor: '#5ebbeb',
    color: '#f8f8f8',
    fontWeight: 700,
    fontSize: 16,
    textTransform: 'uppercase',
    padding: '8px',
    height: 36,
    borderBottom: 'none',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    userSelect: 'none',
  },
};
const TABLE_ROW_SX = {
  '& td': { color: '#000', fontWeight: 400, fontSize: 16, padding: '8px 8px 8px 10px', borderBottom: 'none', whiteSpace: 'nowrap' },
};
const TABLE_TOTAL_SX = {
  bgcolor: '#5ebbeb',
  '& td': { color: '#f8f8f8', fontWeight: 700, fontSize: 16, padding: '8px 8px 8px 10px', borderBottom: 'none', position: 'sticky', bottom: 0, backgroundColor: '#5ebbeb', zIndex: 1 },
};

// ───────────────────────────────────────────── reference schema (view-only dictionary)
const SCHEMA = [
  { table: 'actions', columns: ['user', 'user_id', 'affecting', 'affecting_id', 'affecting_type', 'action', 'additional', 'timestamp'] },
  { table: 'cash_movements', columns: ['outlet', 'outlet_id', 'register', 'register_id', 'user', 'user_id', 'payment_method', 'payment_method_id', 'amount', 'reason', 'timestamp'] },
  { table: 'costs', columns: ['average_cost', 'last_cost', 'outlet', 'outlet_id'] },
  { table: 'customers', columns: ['group', 'group_id'] },
  { table: 'inventory', columns: ['status', 'single_level', 'case_level', 'quantity', 'single_reorder_level', 'case_reorder_level', 'reorder_level', 'single_reorder_amount', 'case_reorder_amount', 'reorder_amount', 'outlet', 'outlet_id'] },
  { table: 'inventory_log', columns: ['product', 'product_id', 'outlet', 'outlet_id', 'before', 'changed', 'after', 'case_quantity', 'change_type', 'change_id', 'user', 'user_id', 'timestamp'] },
  { table: 'orders', columns: ['order_id', 'type', 'sender', 'sender_id', 'receiver', 'receiver_id', 'supplier', 'supplier_id', 'outlet', 'outlet_id', 'vendor_connection', 'vendor_connection_id', 'order_date', 'due_date', 'order_number', 'reference', 'notes', 'internal_notes', 'sent_at', 'received_at', 'product_id', 'base_cost', 'cost', 'fees', 'freight', 'payment_fees', 'total_quantity', 'tax', 'ordered_quantity', 'ordered_items', 'ordered_cases', 'received_quantity', 'received_items', 'received_cases', 'case_quantity', 'supplier_code'] },
  { table: 'payment_customers', columns: ['group', 'group_id'] },
  { table: 'payments', columns: ['sale_id', 'revenue', 'discount', 'cost', 'transaction_count', 'outlet', 'outlet_id', 'timestamp', 'invoice_number', 'reference', 'user', 'user_id', 'customer', 'customer_id', 'note', 'internal_note', 'discount_reason', 'cashout', 'profit', 'register', 'register_id', 'method', 'method_id', 'amount', 'process_time', 'type', 'subtype'] },
  { table: 'products', columns: ['id', 'product_id', 'name', 'status', 'type', 'category', 'category_id', 'brand', 'brand_id', 'family', 'family_id', 'core_supplier', 'last_supplier', 'core_supplier_id', 'last_supplier_id', 'supplier', 'supplier_id', 'tax', 'tax_rate', 'tax_rate_id', 'cost_tax', 'cost_tax_rate', 'cost_tax_rate_id', 'last_cost', 'average_cost', 'case_quantity', 'tags', 'tag_id'] },
  { table: 'promotions', columns: ['promotion', 'promotion_id', 'category_id', 'category', 'promotion_quantity', 'rebate_amount', 'rebate_quantity'] },
  { table: 'revisions', columns: ['user', 'user_id', 'revised', 'revisionable_id', 'revisionable_type', 'key', 'old', 'new', 'timestamp'] },
  { table: 'sales', columns: ['sale_id', 'revenue', 'discount', 'cost', 'transaction_count', 'outlet', 'outlet_id', 'timestamp', 'invoice_number', 'reference', 'user', 'user_id', 'customer', 'customer_id', 'customer_count', 'note', 'internal_note', 'discount_reason', 'modify_reason', 'refund_reason', 'modified', 'cashout', 'profit', 'sale_total', 'register', 'register_id', 'product_id', 'supplier_id', 'cases', 'items', 'quantity', 'case_quantity', 'loyalty_value', 'savings', 'tax', 'tax_rate_id', 'tax_rate_name', 'tax_rate_percentage', 'product_note', 'product_discount_reason'] },
  { table: 'sales_payments', columns: ['sale_id', 'revenue', 'discount', 'cost', 'transaction_count', 'outlet', 'outlet_id', 'timestamp', 'invoice_number', 'reference', 'user', 'user_id', 'customer', 'customer_id', 'note', 'internal_note', 'discount_reason', 'cashout', 'profit', 'register', 'register_id', 'method', 'method_id', 'amount', 'process_time', 'type', 'subtype'] },
  { table: 'transfers', columns: ['transfer_id', 'sender', 'sender_id', 'receiver', 'receiver_id', 'outlet', 'outlet_id', 'transferee', 'transferee_id', 'vendor_connection', 'vendor_connection_id', 'order_date', 'due_date', 'order_number', 'reference', 'notes', 'internal_notes', 'sent_at', 'received_at', 'product_id', 'cost', 'fees', 'freight', 'payment_fees', 'total_quantity', 'tax', 'ordered_quantity', 'ordered_items', 'ordered_cases', 'received_quantity', 'received_items', 'received_cases', 'case_quantity', 'transferred_items', 'transferred_cases', 'transferred_quantity'] },
  { table: 'users', columns: ['role', 'role_id'] },
];

// Reference default query (Report Type Outlet).
const DEFAULT_QUERY = `SELECT
    BY_NAME AS "Name",
    revenue AS "Revenue",
    cost AS "Cost of Goods Sold",
    transaction_count AS "Transaction Count",
    FORMAT(revenue / transaction_count, '$') AS "Average Sale",
    profit AS "Profit",
    FORMAT((revenue - cost) / revenue * 100, '', '%', 2) AS "Profit Percentage",
    tax AS "Tax Amount",
    discount AS "Discount Amount",
    FORMAT(revenue, '', '%', 2) AS "Revenue Percentage" TOTAL(PERCENTAGE_FROM_TOTAL),
    FORMAT(transaction_count, '', '%', 2) AS "Transaction Percentage" TOTAL(PERCENTAGE_FROM_TOTAL)
FROM sales
BY outlet
ORDER "Name" asc
CONSOLIDATED`;

// Popular Queries (user decision 22/10/2026): the reference's own seven that run on
// our data (text as in Shopfront — sales, orders and revisions), and two outlet-wise
// templates in place of the two Shop MyLocal ones (no online channel here).
const POPULAR_QUERIES = [
  {
    name: 'Refunded Sales',
    description: 'The products on sales that have been refunded in the last month',
    query: `SELECT
    by_name as "Product",
    ABS(quantity) as "Refunded Quantity",
    FORMAT(ABS(revenue), "$") as "Refunded Amount",
    LINK(invoice_number, CONCAT('/sale/', sale_id)) AS "Invoice Number",
    user,
    timestamp AS "Date and Time"
FROM sales
BY product
WHERE quantity < 0
START "1 months ago"
UNCONSOLIDATED`,
  },
  {
    name: 'Sales with Inventory',
    description: 'The sales for 4 weeks ago with inventory on hand',
    query: `SELECT
    BY_NAME AS "Name",
    product.case_quantity AS "Case QTY",
    ROUND(inventory.case_level / transaction_count,0) AS "On Hand Cases",
    ROUND(inventory.single_level / transaction_count, 0) AS "On Hand Singles ",
    FLOOR(quantity / case_quantity) AS "Sold Cases" TOTAL(SUM),
    quantity % case_quantity AS "Sold Items" TOTAL(SUM),
    revenue AS "Revenue",
    FORMAT((revenue - cost) / revenue * 100, '', '%', 2) AS "Profit Percentage"
FROM sales
BY product
ON Category
START "4 weeks ago"
END "yesterday"
ORDER "Name" asc
CONSOLIDATED`,
  },
  {
    name: 'Sales by Price Point',
    description: 'The products on sales grouped by the price point they were sold by',
    query: `SELECT
    by_name AS "Product",
    quantity AS "Price Point" TOTAL(NONE),
    revenue,
    transaction_count AS "Transactions"
FROM sales
BY products
ON price_point
START "1 week ago"`,
  },
  {
    name: 'Sales by Outlet',
    description: 'Revenue, profit and average sale for each outlet this month',
    query: `SELECT
    BY_NAME AS "Name",
    revenue AS "Revenue",
    cost AS "Cost of Goods Sold",
    transaction_count AS "Transaction Count",
    FORMAT(revenue / transaction_count, '$') AS "Average Sale",
    profit AS "Profit",
    FORMAT((revenue - cost) / revenue * 100, '', '%', 2) AS "Profit Percentage",
    FORMAT(revenue, '', '%', 2) AS "Revenue Percentage" TOTAL(PERCENTAGE_FROM_TOTAL)
FROM sales
BY outlet
START "this month"
ORDER "Name" asc
CONSOLIDATED`,
  },
  {
    name: 'Orders & Returns Processed Since a Date',
    description: 'Orders & Returns Processed Since a Date',
    query: `SELECT
 BY_NAME AS "Name",
 type AS "Order Type",
 supplier AS "Supplier",
 order_date AS "Order Date",
 LINK(order_number, CONCAT('/order/', order_id)) AS "Order Number",
 sent_at as "Sent At",
 received_at AS "Received At",
 cost AS "Total Cost"
FROM orders
BY supplier
WHERE (type <> "return" AND received_at >=
    "1 months ago" // Processed since (a date like "2026-10-01" also works)
)
OR (type = "return" AND sent_at >=
    "1 months ago" // Process since (must be the same as the date above - processed since)
)
START ALL_OF_TIME
END "today" // Invoice date up to
ORDER "Name" asc
UNCONSOLIDATED`,
  },
  {
    name: 'Top Selling Products',
    description: 'Products sorted by revenue this month with quantities sold',
    query: `SELECT
    BY_NAME AS "Name",
    quantity AS "Quantity",
    cases AS "Cases Sold",
    items AS "Items Sold",
    revenue AS "Revenue",
    profit AS "Profit",
    FORMAT((revenue - cost) / revenue * 100, '', '%', 2) AS "Profit Percentage"
FROM sales
BY product
START "this month"
ORDER "Revenue" desc
CONSOLIDATED`,
  },
  {
    name: 'Hourly Transaction Count by Days of the Week',
    description: 'The total number of transactions for each weekday by each hour',
    query: `SELECT
    transaction_count AS "transaction count"
FROM sales
AGGREGATE hour
BY outlet
ON DATE_FORMAT(timestamp, "YYYY ddd")
START "last year"
END "today"
CONSOLIDATED`,
  },
  {
    name: 'Last costs recently changed',
    description: 'This will show the products that have had a cost change in the last 7 days',
    query: `SELECT
 BY_NAME AS "Name",
 user AS "User",
 key AS "Key",
 FORMAT(old, "$", "", 2) AS "Old Value",
 FORMAT(new, "$", "", 2) AS "New Value",
 FORMAT(100 - ((old / new) * 100), "", "%", 2) as "Change Percentage",
 timestamp AS "Timestamp"
FROM revisions
BY revisions
WHERE key = 'last_cost'
    AND ((100 - (old / new) * 100) > 1 OR (100 - (old / new) * 100) < -1)
START "7 days ago"
ORDER "Timestamp" desc, "Time Cancelled" desc
UNCONSOLIDATED`,
  },
  {
    name: 'Orders & Returns Received During a Period',
    description: 'Orders & Returns Received During a Period',
    query: `SELECT
 BY_NAME AS "Name",
 type AS "Order Type",
 supplier AS "Supplier",
 order_date AS "Order Date",
 LINK(order_number, CONCAT('/order/', order_id)) AS "Order Number",
 sent_at as "Sent At",
 received_at AS "Received At",
 cost AS "Total Cost"
FROM orders
BY supplier
WHERE (type <> "return" AND received_at >=
    "1 months ago" // Start Date (a date like "2026-10-01" also works)
    AND received_at <=
    "today" // End Date
)
OR (type = "return" AND sent_at >=
    "1 months ago" // Start Date (must be the same as the start date above)
    AND sent_at <=
    "today" // End Date (must be the same as the end date above)
)
START ALL_OF_TIME
END ALL_OF_TIME
ORDER "Name" asc
UNCONSOLIDATED`,
  },
];

// ───────────────────────────────────────────── syntax colouring (reference Prism theme)
const KEYWORDS = new Set([
  'SELECT', 'FROM', 'RANGE', 'AGGREGATE', 'BY', 'ON', 'WHERE', 'START', 'END', 'ORDER', 'CONSOLIDATED',
  'UNCONSOLIDATED', 'LIMIT', 'OFFSET', 'AS', 'AND', 'OR', 'IS', 'NOT', 'NULL', 'LIKE', 'ASC', 'DESC',
  'ASCENDING', 'DESCENDING', 'INCLUDE', 'EXCLUDE', 'ONLY', 'TODAY', 'ALL_OF_TIME', 'CURRENT_TIMESTAMP',
  'PERCENTAGE_FROM_TOTAL', 'SUM', 'AVERAGE', 'NONE',
]);
const FUNCTIONS = new Set(['FORMAT', 'TOTAL', 'ROUND', 'ABS', 'FLOOR', 'CEIL', 'LINK', 'CONCAT', 'DATE_FORMAT']);

const colourToken = (token) => {
  if (/^["']/.test(token)) return '#669900';
  if (/^\d/.test(token)) return '#990055';
  if (/^[A-Za-z_]/.test(token)) {
    const up = token.toUpperCase();
    if (FUNCTIONS.has(up)) return '#dd4a68';
    if (KEYWORDS.has(up)) return '#0077aa';
    return '#000000';
  }
  if (!/^\s+$/.test(token)) return '#999999';
  return undefined;
};

const highlightLine = (line) =>
  line
    .split(/("[^"]*"?|'[^']*'?|\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|[^\sA-Za-z0-9_"']+)/g)
    .filter(Boolean)
    .map((token, i) => {
      const color = colourToken(token);
      return <span key={i} style={color ? { color } : undefined}>{token}</span>;
    });

// ───────────────────────────────────────────── formatting
const fmtNumber = (value, decimals) =>
  Number(value || 0).toLocaleString('en-AU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

// Reference: timestamps as 22/10/2026 13:01:09, date fields (order_date) as 28/01/2020.
const fmtDate = (value, dateOnly = false) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const p = (n) => String(n).padStart(2, '0');
  const day = `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  return dateOnly ? day : `${day} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const formatCell = (value, col) => {
  if (value === '' || value === null || value === undefined) return '';
  if (value && typeof value === 'object' && value.__link) return String(value.text ?? '');
  if (col.text) {
    if ((col.date || /date|time/i.test(col.label)) && typeof value === 'string' && value.includes('T') && !Number.isNaN(new Date(value).getTime())) return fmtDate(value, !!col.dateOnly);
    return String(value);
  }
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  const decimals = Number.isInteger(col.decimals) ? col.decimals : 2;
  const body = fmtNumber(Math.abs(n), decimals);
  return `${n < 0 ? '-' : ''}${col.prefix || ''}${body}${col.suffix || ''}`;
};

// ───────────────────────────────────────────── component
const SalesQueryEditor = () => {
  const [searchParams] = useSearchParams();
  // Sales Report → Edit hands the query + date range over in router state (clean URL);
  // a saved report still arrives as ?query=&dateTime=… from the Reports list.
  const handover = useLocation().state || {};
  const dialogs = useAppDialogs();
  const headerScope = useHeaderScope();
  const headerRegisterId = !headerScope.showOutletFilter && !headerScope.showRegisterFilter ? headerScope.headerRegisterId : null;

  // Query editor states
  const [customQuery, setCustomQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('schema');
  const [schemaSearch, setSchemaSearch] = useState('');
  const [expanded, setExpanded] = useState({});
  const [editorVisible, setEditorVisible] = useState(true);
  const [cursorLine, setCursorLine] = useState(1);

  // Result states
  const [columns, setColumns] = useState([]);
  const [reportData, setReportData] = useState([]);
  const [totals, setTotals] = useState({});
  const [hasRun, setHasRun] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [sortConfig, setSortConfig] = useState(null);
  const [collapsed, setCollapsed] = useState({}); // group header name → hidden children
  const [toast, setToast] = useState(null);

  // Export / save states
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportType, setExportType] = useState('pdf');
  const [exportOrientation, setExportOrientation] = useState('portrait');
  const [isExporting, setIsExporting] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [queryName, setQueryName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Date range handed over by the Sales Report page (Edit) or a saved report.
  const dateParams = useMemo(() => ({
    dateTime: handover.dateTime || searchParams.get('dateTime') || 'today',
    startDate: handover.startDate || searchParams.get('startDate') || undefined,
    endDate: handover.endDate || searchParams.get('endDate') || undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [searchParams, handover.dateTime, handover.startDate, handover.endDate]);

  const textareaRef = useRef(null);
  const preRef = useRef(null);
  const gutterRef = useRef(null);

  const runQuery = useCallback(async (queryText) => {
    const q = (queryText ?? customQuery).trim();
    if (!q) { setToast({ severity: 'warning', message: 'Please enter a query' }); return; }
    setLoading(true);
    setLoadError('');
    try {
      const response = await salesReportService.runQuery({
        query: q,
        ...dateParams,
        ...(headerRegisterId != null ? { registerId: headerRegisterId } : {}),
      });
      if (response?.success) {
        setColumns(response.columns || []);
        setReportData(response.data || []);
        setTotals(response.totals || {});
        setSortConfig(null);
        setCollapsed({});
        setHasRun(true);
      } else {
        setColumns([]); setReportData([]); setTotals({}); setHasRun(true);
        setLoadError(response?.error || 'Failed to execute query. Please check your query syntax.');
      }
    } catch (error) {
      setColumns([]); setReportData([]); setTotals({}); setHasRun(true);
      const message = error.response?.data?.error || error.response?.data?.message || (error?.response ? 'Failed to execute query. Please check your query syntax.' : 'Unable to run the query — you appear to be offline.');
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [customQuery, dateParams, headerRegisterId]);

  // Initialise: ?query= from the report page / a saved report, else the reference default.
  // The handed-over query runs straight away (reference opens Edit with the data in place).
  useEffect(() => {
    const incoming = handover.query || searchParams.get('query');
    const initial = incoming || DEFAULT_QUERY;
    setCustomQuery(initial);
    runQuery(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Editor helpers ------------------------------------------------------------
  const lines = useMemo(() => customQuery.split('\n'), [customQuery]);
  const syncScroll = () => {
    if (!textareaRef.current) return;
    const { scrollTop, scrollLeft } = textareaRef.current;
    if (preRef.current) { preRef.current.scrollTop = scrollTop; preRef.current.scrollLeft = scrollLeft; }
    if (gutterRef.current) gutterRef.current.scrollTop = scrollTop;
  };
  const updateCursor = () => {
    const el = textareaRef.current;
    if (!el) return;
    setCursorLine(el.value.slice(0, el.selectionStart).split('\n').length);
  };
  const handleEditorKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.target;
      const { selectionStart, selectionEnd, value } = el;
      const next = `${value.slice(0, selectionStart)}    ${value.slice(selectionEnd)}`;
      setCustomQuery(next);
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = selectionStart + 4; });
    }
  };

  const applyPopularQuery = async (item) => {
    const ok = await dialogs.confirm('You will override your current query\n\nAre you sure you wish to continue?', { title: 'Override Query', confirmText: 'Continue' });
    if (!ok) return;
    setCustomQuery(item.query);
  };

  // Schema search matches table names and column names.
  const schemaFilter = schemaSearch.trim().toLowerCase();
  const visibleSchema = SCHEMA.map((t) => {
    if (!schemaFilter) return t;
    if (t.table.includes(schemaFilter)) return t;
    const cols = t.columns.filter((c) => c.includes(schemaFilter));
    return cols.length ? { ...t, columns: cols, forceOpen: true } : null;
  }).filter(Boolean);
  const visiblePopular = POPULAR_QUERIES.filter((q) => !schemaFilter || q.name.toLowerCase().includes(schemaFilter) || q.description.toLowerCase().includes(schemaFilter));

  // Results ------------------------------------------------------------------
  const handleSort = (key) => {
    setSortConfig((prev) => (prev && prev.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }));
  };
  // Rows arrive as groups (reference ON …): header `_group`, children `_child`,
  // then a `_groupTotal` row. Sorting orders groups by their Totals row and the
  // children inside each group; collapsed groups show the header only.
  const groupedRows = useMemo(() => {
    const groups = [];
    let current = null;
    for (const row of reportData) {
      if (row._group) { current = { header: row, children: [], total: null }; groups.push(current); continue; }
      if (row._child && current) { current.children.push(row); continue; }
      if (row._groupTotal && current) { current.total = row; current = null; continue; }
      current = null;
      groups.push({ header: null, children: [row], total: null });
    }
    return groups;
  }, [reportData]);
  const hasGroups = groupedRows.some((g) => g.header);
  const sortedData = useMemo(() => {
    const dir = sortConfig?.direction === 'asc' ? 1 : -1;
    const cmp = (a, b) => {
      const av = a[sortConfig.key]; const bv = b[sortConfig.key];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av ?? '').localeCompare(String(bv ?? ''), undefined, { sensitivity: 'base', numeric: true }) * dir;
    };
    const groups = sortConfig
      ? [...groupedRows].map((g) => ({ ...g, children: [...g.children].sort(cmp) })).sort((a, b) => cmp(a.header ? { ...a.total, [sortConfig.key]: sortConfig.key === 'name' ? a.header.name : a.total?.[sortConfig.key] } : a.children[0], b.header ? { ...b.total, [sortConfig.key]: sortConfig.key === 'name' ? b.header.name : b.total?.[sortConfig.key] } : b.children[0]))
      : groupedRows;
    const out = [];
    groups.forEach((g) => {
      if (!g.header) { out.push(...g.children); return; }
      out.push(g.header);
      if (!collapsed[g.header.name]) out.push(...g.children);
      if (g.total) out.push(g.total);
    });
    return out;
  }, [groupedRows, sortConfig, collapsed]);
  const toggleGroup = (name) => setCollapsed((prev) => ({ ...prev, [name]: !prev[name] }));
  // "Groups" button (reference): collapse every group, or expand them all again.
  const toggleAllGroups = () => {
    const allCollapsed = groupedRows.filter((g) => g.header).every((g) => collapsed[g.header.name]);
    setCollapsed(allCollapsed ? {} : Object.fromEntries(groupedRows.filter((g) => g.header).map((g) => [g.header.name, true])));
  };

  const showSortIcons = reportData.filter((r) => !r._group && !r._groupTotal).length > 1;
  // Same icon as the Sales Report page; the current sort direction is filled (bold).
  const SortIcon = ({ active }) => (
    <svg width="10" height="14" viewBox="0 0 10 14" style={{ marginLeft: 4, verticalAlign: 'middle', display: 'inline-block' }} aria-hidden="true">
      <path d="M1 5.5 L5 1.5 L9 5.5 Z" fill={active === 'asc' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active === 'asc' ? 1.6 : 1.1} strokeLinejoin="round" />
      <path d="M1 8.5 L5 12.5 L9 8.5 Z" fill={active === 'desc' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active === 'desc' ? 1.6 : 1.1} strokeLinejoin="round" />
    </svg>
  );

  const cellAlign = (col) => (col.text ? 'left' : 'center');
  const tableRows = () => sortedData.map((row) => columns.map((col, i) => (i === 0 ? (row._group ? row.name : row._groupTotal ? 'Totals' : formatCell(row[col.key], col)) : row._group ? '' : formatCell(row[col.key], col))));
  const totalRowCells = () => columns.map((col) => (col.text ? '' : formatCell(totals[col.key], col)));

  // Export -------------------------------------------------------------------
  const fileName = () => {
    const now = new Date();
    return `sales-query-report-${now.toISOString().split('T')[0]}_${now.toTimeString().split(' ')[0].replace(/:/g, '-')}`;
  };
  const handleExport = () => {
    if (reportData.length === 0) { setToast({ severity: 'warning', message: 'Please execute a query first to export results.' }); return; }
    setExportDialogOpen(true);
  };
  const handleConfirmExport = async () => {
    setIsExporting(true);
    try {
      const head = columns.map((c) => c.label);
      const body = tableRows();
      const totalRow = totalRowCells();
      if (exportType === 'pdf') {
        const doc = new jsPDF({ orientation: exportOrientation === 'portrait' ? 'p' : 'l', unit: 'mm', format: 'a4' });
        doc.setFontSize(16); doc.setFont(undefined, 'bold'); doc.text('Sales Query Report', 14, 15);
        doc.setFontSize(9); doc.setFont(undefined, 'normal'); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
        autoTable(doc, {
          startY: 27,
          head: [head],
          body: [...body, totalRow],
          theme: 'grid',
          styles: { fontSize: exportOrientation === 'portrait' ? 7 : 8, cellPadding: 2 },
          headStyles: { fillColor: [94, 187, 235], fontStyle: 'bold', halign: 'center' },
          didParseCell: (data) => { if (data.section === 'body' && data.row.index === body.length) { data.cell.styles.fillColor = [94, 187, 235]; data.cell.styles.textColor = [248, 248, 248]; data.cell.styles.fontStyle = 'bold'; } },
        });
        doc.save(`${fileName()}.pdf`);
      } else if (exportType === 'xlsx') {
        const ws = XLSX.utils.aoa_to_sheet([head, ...sortedData.map((row, r) => columns.map((c, i) => (row._group || i === 0 || c.text || row[c.key] === '' ? body[r][i] : Number(row[c.key] || 0)))), columns.map((c) => (c.text ? '' : Number(totals[c.key] || 0)))]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sales Query Report');
        XLSX.writeFile(wb, `${fileName()}.xlsx`);
      } else if (exportType === 'csv') {
        const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [head.map(esc).join(','), ...body.map((r) => r.map(esc).join(',')), totalRow.map(esc).join(',')].join('\n');
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${fileName()}.csv`);
      } else {
        const json = JSON.stringify({ query: customQuery, generated: new Date().toISOString(), columns: columns.map((c) => c.label), data: sortedData.filter((row) => !row._group).map((row) => ({ ...(row._groupTotal ? { group: 'Totals' } : {}), ...Object.fromEntries(columns.map((c) => [c.label, row[c.key]])) })), totals: Object.fromEntries(columns.map((c) => [c.label, totals[c.key]])) }, null, 2);
        downloadBlob(new Blob([json], { type: 'application/json;charset=utf-8;' }), `${fileName()}.json`);
      }
      setExportDialogOpen(false);
    } catch (error) {
      console.error('Error exporting report:', error);
      setToast({ severity: 'error', message: 'Error exporting report. Please try again.' });
    } finally {
      setIsExporting(false);
    }
  };
  const downloadBlob = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = name;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Print --------------------------------------------------------------------
  const handlePrint = () => {
    if (reportData.length === 0) { setToast({ severity: 'warning', message: 'Please execute a query first to print results.' }); return; }
    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const html = `
      <div id="print-content">
        <style>
          @media print { body * { visibility: hidden; } #print-content, #print-content * { visibility: visible; } #print-content { position: absolute; left: 0; top: 0; width: 100%; } }
          #print-content { font-family: Arial, sans-serif; padding: 16px; font-size: 12px; }
          #print-content table { width: 100%; border-collapse: collapse; }
          #print-content th { background: #5ebbeb; color: #f8f8f8; font-weight: 700; text-transform: uppercase; padding: 6px 8px; text-align: left; }
          #print-content td { padding: 6px 8px; border-bottom: 1px solid #eee; }
          #print-content tr:nth-child(even) td { background: #f8f8f8; }
          #print-content tr.total td { background: #5ebbeb; color: #f8f8f8; font-weight: 700; }
          #print-content td.num, #print-content th.num { text-align: center; }
        </style>
        <table>
          <thead><tr>${columns.map((c) => `<th class="${c.text ? '' : 'num'}">${esc(c.label)}</th>`).join('')}</tr></thead>
          <tbody>
            ${tableRows().map((r, ri) => `<tr${sortedData[ri]._group || sortedData[ri]._groupTotal ? ' style="background:#e8e8e8"' : ''}>${r.map((v, i) => `<td class="${columns[i].text ? '' : 'num'}"${i === 0 && sortedData[ri]._child ? ' style="padding-left:28px"' : ''}>${esc(v)}</td>`).join('')}</tr>`).join('')}
            <tr class="total">${totalRowCells().map((v, i) => `<td class="${columns[i].text ? '' : 'num'}">${esc(v)}</td>`).join('')}</tr>
          </tbody>
        </table>
      </div>`;
    document.getElementById('print-content')?.remove();
    const holder = document.createElement('div');
    holder.innerHTML = html;
    document.body.appendChild(holder);
    setTimeout(() => { window.print(); setTimeout(() => holder.remove(), 100); }, 100);
  };

  // Save ---------------------------------------------------------------------
  const handleConfirmSave = async () => {
    if (!queryName.trim()) return;
    setIsSaving(true);
    try {
      await favouriteReportService.create({
        name: queryName.trim(),
        reportType: 'sales',
        reportPath: '/reports/sales/query',
        filters: { query: customQuery, ...dateParams },
      });
      setToast({ severity: 'success', message: 'Query saved to Favourite Reports.' });
      setSaveDialogOpen(false);
      setQueryName('');
    } catch (error) {
      console.error('Error saving query:', error);
      setToast({ severity: 'error', message: error.response?.data?.error || 'Error saving query. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  // ───────────────────────────────────────────── render
  // Reference tab icons: a database cylinder (Schema) and a ">_" prompt (Popular).
  const SchemaGlyph = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" />
    </svg>
  );
  const PopularGlyph = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6l6 6-6 6" />
      <path d="M12 19h8" />
    </svg>
  );
  const tabButton = (id, label, Icon) => {
    const active = selectedTab === id;
    return (
      <Button
        key={id}
        startIcon={React.createElement(Icon)}
        onClick={() => setSelectedTab(id)}
        disableRipple
        sx={{
          flex: 1, height: 52, borderRadius: 0, textTransform: 'none', fontWeight: 700, fontSize: 14,
          bgcolor: active ? '#f3f3f3' : '#f3f3f3', color: active ? '#1e40af' : '#000',
          borderBottom: `4px solid ${active ? '#1e40af' : '#b3b3b3'}`, transition: INSTANT,
          '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
        }}
      >
        {label}
      </Button>
    );
  };

  return (
    <Box sx={{ p: '8px', bgcolor: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {editorVisible && (
        <Box sx={{ display: 'flex', gap: '16px', height: 500, mb: '16px' }}>
          {/* Schema / Popular */}
          <Box sx={{ width: 384, flexShrink: 0, border: '1px solid #404040', borderRadius: '8px', bgcolor: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ display: 'flex' }}>
              {tabButton('schema', 'Schema', SchemaGlyph)}
              {tabButton('popular', 'Popular', PopularGlyph)}
            </Box>
            {selectedTab === 'schema' && (
              <TextField
                placeholder="Search Schema..."
                size="small"
                value={schemaSearch}
                onChange={(e) => setSchemaSearch(e.target.value)}
                sx={{ m: '16px', mb: '8px', ...inputSx }}
              />
            )}
            <Box sx={{ flex: 1, overflow: 'auto', pl: selectedTab === 'popular' ? '32px' : '16px', pr: '16px', pb: '16px', pt: selectedTab === 'popular' ? '24px' : 0 }}>
              {selectedTab === 'schema' ? (
                visibleSchema.map((t) => {
                  const open = t.forceOpen || !!expanded[t.table];
                  return (
                    <Box key={t.table} sx={{ mb: '6px' }}>
                      <Box
                        onClick={() => setExpanded((prev) => ({ ...prev, [t.table]: !prev[t.table] }))}
                        sx={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', py: '6px', px: '4px', borderRadius: '4px', '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' } }}
                      >
                        {open ? <ExpandMoreIcon sx={{ fontSize: 16 }} /> : <ChevronRightIcon sx={{ fontSize: 16 }} />}
                        <Typography sx={{ fontFamily: "'Roboto Mono', monospace", fontWeight: 700, fontSize: 17, color: '#000' }}>{t.table}</Typography>
                      </Box>
                      {open && t.columns.map((c) => (
                        <Typography key={c} sx={{ fontFamily: "'Roboto Mono', monospace", fontSize: 15, color: '#000', pl: '24px', py: '3px', cursor: 'default' }}>{c}</Typography>
                      ))}
                    </Box>
                  );
                })
              ) : (
                <>
                  <Typography sx={{ fontWeight: 700, fontSize: 17, color: '#000', mb: '28px', lineHeight: 1.2 }}>Popular Queries</Typography>
                  {visiblePopular.map((q) => (
                    <Box key={q.name} onClick={() => applyPopularQuery(q)} sx={{ mb: '26px', pr: '8px', cursor: 'pointer', '&:hover': { opacity: 0.75 } }}>
                      <Typography sx={{ fontSize: 16, color: '#000', lineHeight: 1.3 }}>{q.name}</Typography>
                      <Typography sx={{ fontSize: 13, color: '#676b72', lineHeight: 1.35, mt: '6px' }}>{q.description}</Typography>
                    </Box>
                  ))}
                </>
              )}
            </Box>
          </Box>

          {/* Code editor: line gutter + coloured overlay + transparent textarea */}
          <Box sx={{ flex: 1, minWidth: 0, border: '1px solid #404040', borderRadius: '8px', bgcolor: '#fff', display: 'flex', overflow: 'hidden', position: 'relative', fontFamily: "'Roboto Mono', monospace", fontSize: 14, lineHeight: '20px' }}>
            <Box ref={gutterRef} sx={{ width: 36, flexShrink: 0, bgcolor: '#f3f3f3', color: '#777', textAlign: 'right', pr: '4px', pt: '8px', overflow: 'hidden', userSelect: 'none' }}>
              {lines.map((_, i) => (
                <Box key={i} sx={{ height: 20 }}>{i + 1}</Box>
              ))}
            </Box>
            <Box sx={{ flex: 1, position: 'relative', minWidth: 0 }}>
              <Box ref={preRef} component="pre" aria-hidden sx={{ m: 0, p: '8px 8px 8px 4px', position: 'absolute', inset: 0, overflow: 'hidden', whiteSpace: 'pre', fontFamily: 'inherit', fontSize: 'inherit', lineHeight: 'inherit', pointerEvents: 'none' }}>
                {lines.map((line, i) => (
                  <Box key={i} component="span" sx={{ display: 'block', height: 20, bgcolor: i + 1 === cursorLine ? 'rgba(94,187,235,0.14)' : 'transparent', px: '4px', mx: '-4px' }}>
                    {highlightLine(line)}{line === '' ? ' ' : ''}
                  </Box>
                ))}
              </Box>
              <Box
                component="textarea"
                ref={textareaRef}
                value={customQuery}
                spellCheck={false}
                onChange={(e) => { setCustomQuery(e.target.value); updateCursor(); }}
                onScroll={syncScroll}
                onClick={updateCursor}
                onKeyUp={updateCursor}
                onKeyDown={handleEditorKeyDown}
                sx={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%', m: 0, p: '8px 8px 8px 4px', boxSizing: 'border-box',
                  border: 'none', outline: 'none', resize: 'none', background: 'transparent', color: 'transparent', caretColor: '#000',
                  fontFamily: 'inherit', fontSize: 'inherit', lineHeight: 'inherit', whiteSpace: 'pre', overflow: 'auto',
                }}
              />
              {/* Reference: a failed Execute shows the reason inside the editor box (pink bar, ! and ×). */}
              {loadError && (
                <Box sx={{ position: 'absolute', left: 16, right: 16, bottom: 16, bgcolor: '#fde8e8', border: '1px solid #e4a0a0', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', px: '16px', py: '18px', fontFamily: 'Roboto, Helvetica, Arial, sans-serif', fontSize: 15, color: '#8b1a1a', zIndex: 2 }}>
                  <ErrorMarkIcon sx={{ fontSize: 20, color: '#c62828' }} />
                  <Box sx={{ flex: 1, whiteSpace: 'normal' }}>{loadError}</Box>
                  <CloseIcon onClick={() => setLoadError('')} sx={{ fontSize: 20, color: '#c62828', cursor: 'pointer' }} />
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      )}
      {!editorVisible && loadError && (
        <Box sx={{ bgcolor: '#fde8e8', border: '1px solid #e4a0a0', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', px: '16px', py: '18px', fontSize: 15, color: '#8b1a1a', mb: '16px' }}>
          <ErrorMarkIcon sx={{ fontSize: 20, color: '#c62828' }} />
          <Box sx={{ flex: 1 }}>{loadError}</Box>
          <CloseIcon onClick={() => setLoadError('')} sx={{ fontSize: 20, color: '#c62828', cursor: 'pointer' }} />
        </Box>
      )}

      {/* Toolbar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: '16px' }}>
        <Box sx={{ display: 'flex', gap: '12px' }}>
          <Button variant="outlined" startIcon={<ExportIcon />} onClick={handleExport} disabled={columns.length === 0} sx={outlinedBtnSx}>Export</Button>
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint} disabled={columns.length === 0} sx={outlinedBtnSx}>Print</Button>
          <Button variant="outlined" startIcon={<SaveIcon />} onClick={() => { if (!customQuery.trim()) { setToast({ severity: 'warning', message: 'Please enter a query to save.' }); return; } setSaveDialogOpen(true); }} sx={outlinedBtnSx}>Save</Button>
        </Box>
        <Box sx={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Button variant="outlined" startIcon={editorVisible ? <ChevronUpIcon /> : <ChevronDownIcon />} onClick={() => setEditorVisible((v) => !v)} sx={neutralBtnSx}>
            {editorVisible ? 'Hide Editor' : 'Show Editor'}
          </Button>
          <Button variant="contained" startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />} onClick={() => runQuery()} disabled={loading} sx={primaryBtnSx}>
            Execute
          </Button>
        </Box>
      </Box>
      {/* Reference: a grouped result (ON …) gets a Groups button under the toolbar — collapse / expand every group. */}
      {hasGroups && (
        <Box sx={{ mb: '16px' }}>
          <Button variant="outlined" startIcon={<GroupsIcon />} onClick={toggleAllGroups} sx={outlinedBtnSx}>Groups</Button>
        </Box>
      )}

      {/* Results (a failed Execute clears the table — reference) */}
      {hasRun && columns.length > 0 ? (
        <TableContainer sx={{ maxHeight: 'calc(100vh - 140px)', overflow: 'auto' }}>
          <Table size="small" stickyHeader sx={{ width: '100%', tableLayout: 'auto', '& .MuiTableCell-stickyHeader': { backgroundColor: '#5ebbeb' }, '& th, & td': { px: '14px' }, '& th': { fontSize: 15 } }}>
            <TableHead>
              <TableRow sx={TABLE_HEAD_SX}>
                {columns.map((col) => (
                  <TableCell key={col.key} align={cellAlign(col)} onClick={() => handleSort(col.key)}>
                    {col.label}{showSortIcons && <SortIcon active={sortConfig?.key === col.key ? sortConfig.direction : null} />}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {(() => { let stripe = 0; return sortedData.map((row, idx) => {
                // Reference: group header (▽ name) and "Totals" rows sit on grey;
                // data rows alternate white / grey, the stripe restarting per group.
                if (row._group) {
                  stripe = 0;
                  return (
                    <TableRow key={idx} sx={{ ...TABLE_ROW_SX, bgcolor: '#e8e8e8' }}>
                      <TableCell colSpan={columns.length} onClick={() => toggleGroup(row.name)} sx={{ cursor: 'pointer', userSelect: 'none', py: '10px !important' }}>
                        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {collapsed[row.name] ? <ChevronRightIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
                          {row.name}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                }
                if (row._groupTotal) {
                  return (
                    <TableRow key={idx} sx={{ ...TABLE_ROW_SX, bgcolor: '#e8e8e8' }}>
                      {columns.map((col, ci) => (
                        <TableCell key={col.key} align={cellAlign(col)} sx={ci === 0 ? { fontSize: '13px !important', pl: '10px !important' } : undefined}>{ci === 0 ? 'Totals' : formatCell(row[col.key], col)}</TableCell>
                      ))}
                    </TableRow>
                  );
                }
                const shade = stripe++ % 2 === 0 ? '#fff' : '#e8e8e8';
                return (
                  <TableRow key={idx} sx={{ ...TABLE_ROW_SX, bgcolor: shade }}>
                    {columns.map((col, ci) => {
                      const value = row[col.key];
                      const link = value && typeof value === 'object' && value.__link ? value : null;
                      const saleMatch = link && String(link.href || '').match(/^\/sale\/(\d+)/);
                      const orderMatch = link && String(link.href || '').match(/^\/order\/(\d+)/);
                      const content = link
                        ? (saleMatch
                          ? <RouterLink to={`/register/history?saleId=${saleMatch[1]}`} style={{ color: '#0284c7' }}>{link.text}</RouterLink>
                          : orderMatch
                            ? <RouterLink to={`/orders-invoices/${orderMatch[1]}`} style={{ color: '#0284c7' }}>{link.text}</RouterLink>
                            : <a href={link.href} style={{ color: '#0284c7' }}>{link.text}</a>)
                        : formatCell(value, col);
                      // Reference tree line: a child row's name hangs off a "├─" guide.
                      if (ci === 0 && row._child) {
                        return (
                          <TableCell key={col.key} align={cellAlign(col)} sx={{ pl: '14px !important' }}>
                            <Box sx={{ display: 'flex', alignItems: 'stretch', minHeight: 24 }}>
                              <Box sx={{ width: 14, flexShrink: 0, borderLeft: '2px solid #000', position: 'relative', '&::after': { content: '""', position: 'absolute', top: '50%', left: 0, width: 10, borderTop: '2px solid #000' } }} />
                              <Box sx={{ pl: '12px', display: 'flex', alignItems: 'center' }}>{content}</Box>
                            </Box>
                          </TableCell>
                        );
                      }
                      return <TableCell key={col.key} align={cellAlign(col)}>{content}</TableCell>;
                    })}
                  </TableRow>
                );
              }); })()}
              <TableRow sx={TABLE_TOTAL_SX}>
                {columns.map((col) => (
                  <TableCell key={col.key} align={cellAlign(col)}>{col.text ? '' : formatCell(totals[col.key], col)}</TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}

      {/* Export dialog */}
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '12px' } }}>
        <DialogTitle sx={{ py: 2, px: 3, fontSize: 20, fontWeight: 700, color: '#313439' }}>Export Report</DialogTitle>
        <DialogContent sx={{ px: 3, py: 3 }}>
          <Typography sx={{ mb: 1.5, color: '#676b72', fontSize: 16, fontWeight: 700 }}>Export Type</Typography>
          <FormControl fullWidth>
            <Select value={exportType} onChange={(e) => setExportType(e.target.value)} sx={{ bgcolor: 'white', borderRadius: '8px' }}>
              <MenuItem value="pdf"><Box sx={{ display: 'flex', alignItems: 'center' }}><PdfIcon sx={{ mr: 1.5, color: '#d32f2f' }} />PDF</Box></MenuItem>
              <MenuItem value="xlsx"><Box sx={{ display: 'flex', alignItems: 'center' }}><XlsxIcon sx={{ mr: 1.5, color: '#2e7d32' }} />XLSX</Box></MenuItem>
              <MenuItem value="csv"><Box sx={{ display: 'flex', alignItems: 'center' }}><CsvIcon sx={{ mr: 1.5, color: '#ed6c02' }} />CSV</Box></MenuItem>
              <MenuItem value="json"><Box sx={{ display: 'flex', alignItems: 'center' }}><JsonIcon sx={{ mr: 1.5, color: '#0288d1' }} />JSON</Box></MenuItem>
            </Select>
          </FormControl>
          {exportType === 'pdf' && (
            <Box sx={{ mt: 3 }}>
              <Typography sx={{ mb: 1.5, color: '#676b72', fontSize: 16, fontWeight: 700 }}>Orientation</Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                {['portrait', 'landscape'].map((o) => (
                  <Button key={o} fullWidth variant={exportOrientation === o ? 'contained' : 'outlined'} onClick={() => setExportOrientation(o)} sx={exportOrientation === o ? primaryBtnSx : neutralBtnSx}>
                    {o === 'portrait' ? 'Portrait' : 'Landscape'}
                  </Button>
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2.5 }}>
          <Button onClick={() => setExportDialogOpen(false)} variant="outlined" disabled={isExporting} sx={neutralBtnSx}>Cancel</Button>
          <Button onClick={handleConfirmExport} variant="contained" disabled={isExporting} sx={primaryBtnSx}>{isExporting ? 'Exporting...' : 'Export'}</Button>
        </DialogActions>
      </Dialog>

      {/* Save dialog */}
      <Dialog open={saveDialogOpen} onClose={() => { setSaveDialogOpen(false); setQueryName(''); }} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '12px' } }}>
        <DialogTitle sx={{ py: 2, px: 3, fontSize: 20, fontWeight: 700, color: '#313439' }}>Save Query</DialogTitle>
        <DialogContent sx={{ px: 3, py: 3 }}>
          <Typography sx={{ mb: 1.5, color: '#676b72', fontSize: 16, fontWeight: 700 }}>Report Name</Typography>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder="Enter a name for this report"
            value={queryName}
            onChange={(e) => setQueryName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && queryName.trim()) handleConfirmSave(); }}
            sx={inputSx}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2.5 }}>
          <Button onClick={() => { setSaveDialogOpen(false); setQueryName(''); }} variant="outlined" disabled={isSaving} sx={neutralBtnSx}>Cancel</Button>
          <Button onClick={handleConfirmSave} variant="contained" disabled={isSaving || !queryName.trim()} sx={primaryBtnSx}>{isSaving ? 'Saving...' : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(toast)} autoHideDuration={4000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={toast?.severity || 'info'} variant="filled" onClose={() => setToast(null)} sx={{ borderRadius: 0, fontSize: 15, fontWeight: 600 }}>
          {toast?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SalesQueryEditor;
