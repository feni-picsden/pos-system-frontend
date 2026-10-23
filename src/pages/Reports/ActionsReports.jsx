import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Popover,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Link,
} from '@mui/material';
import {
  FileDownload as ExportIcon,
  PrintOutlined as PrintIcon,
  SaveOutlined as SaveIcon,
  ViewColumn as ColumnsIcon,
  EditOutlined as EditIcon,
  CheckBoxOutlined as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  ArrowDropDown,
  ArrowDropUp,
  Cancel as CancelIcon,
  HelpOutline as HelpIcon,
  PictureAsPdf as PdfIcon,
  Description as CsvIcon,
  TableChart as XlsxIcon,
  Code as JsonIcon,
  Block as BlockIcon,
  RadioButtonUnchecked as ExistsIcon,
  DeleteOutline as DeleteOutlineIcon,
  QrCode as QrCodeIcon,
  StorefrontOutlined as StorefrontOutlinedIcon,
  PointOfSaleOutlined as PointOfSaleOutlinedIcon,
  PersonOutline as PersonOutlineIcon,
  PeopleOutline as PeopleOutlineIcon,
  FolderOutlined as FolderOutlinedIcon,
} from '@mui/icons-material';
import { format as formatDate } from 'date-fns';
import { printReportTable, reportPrintTitle, reportPrintRange } from '../../utils/reportPrint';
import { chipsToParam, chipsFromParams } from '../../utils/reportChips';
import FavouriteRevisionsButton from '../../components/Reports/FavouriteRevisionsButton';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalOutlet } from '../../components/Common/GlobalOutletFilter';
import actionsReportService from '../../services/actionsReportService';
import SaveReportDialog from '../../components/Reports/SaveReportDialog';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import DateRangePicker from '../../components/Common/DateRangePicker';
const { jsPDF } = await import('jspdf');
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Actions Report (reference Reporting > "Misc": Actions / Revisions / Cash
// Movements / Inventory Log / Discounted Sales / Cancelled Sales / Modified
// Sales) — same chrome as pages/Reports/TransferReports.jsx (query bar, slate
// filter blocks, search + Included chips, sky buttons, Columns picker, sticky
// table, blue total row). Report Type + Date and Time only (no Group By /
// Consolidate / Precision — reference). Copied rather than shared: parallel
// parity agents own those files.

const INSTANT = 'all 0s ease';

const SKY_BUTTON_SX = {
  color: '#0284c7',
  borderColor: '#0284c7',
  textTransform: 'none',
  fontWeight: 700,
  fontSize: 16,
  height: 42,
  borderRadius: '12px',
  transition: INSTANT,
  '&:hover': { borderColor: '#0284c7', bgcolor: 'rgba(0,0,0,0.05)' },
};

const FIELD_SX = {
  '& .MuiOutlinedInput-root': { borderRadius: '8px' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' },
  '& input::placeholder, & textarea::placeholder': { color: '#808080', opacity: 1 },
};

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
  },
};

const TABLE_ROW_SX = {
  '& td': {
    color: '#000',
    fontWeight: 400,
    fontSize: 16,
    padding: '8px 8px 8px 10px',
    borderBottom: 'none',
    whiteSpace: 'nowrap',
  },
};

const TABLE_TOTAL_SX = {
  bgcolor: '#5ebbeb',
  '& td': {
    color: '#f8f8f8',
    fontWeight: 700,
    fontSize: 16,
    padding: '8px 8px 8px 10px',
    borderBottom: 'none',
    position: 'sticky',
    bottom: 0,
    backgroundColor: '#5ebbeb',
    zIndex: 1,
  },
  '& td:first-of-type': { zIndex: 3 },
};

const ROW_ALT_BG = '#e8e8e8';

const FILTER_BLOCK_SX = {
  height: 80,
  boxSizing: 'border-box',
  bgcolor: '#676b72',
  border: '1px solid #f8f8f8',
  borderRadius: 0,
  color: '#f8f8f8',
  fontSize: 16,
  p: '16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 1,
  cursor: 'pointer',
  transition: INSTANT,
};

const FILTER_DATE_SX = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: '#676b72',
    borderRadius: 0,
    height: 80,
    color: '#f8f8f8',
    fontSize: '22.4px',
    alignItems: 'flex-end',
    padding: '0 16px 14px 16px',
  },
  '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #f8f8f8' },
  '&:hover .MuiOutlinedInput-notchedOutline': { border: '1px solid #f8f8f8' },
  '& .Mui-focused .MuiOutlinedInput-notchedOutline': { border: '1px solid #f8f8f8' },
  '& .MuiOutlinedInput-notchedOutline legend': { display: 'none' },
  '& .MuiInputLabel-root, & .MuiInputLabel-root.MuiInputLabel-shrink': {
    color: '#f8f8f8',
    fontSize: 16,
    transform: 'translate(17px, 16px) scale(1)',
    maxWidth: 'none',
  },
  '& .MuiInputBase-input': { color: '#f8f8f8', padding: 0 },
  '& .MuiSvgIcon-root': { color: '#f8f8f8' },
};

// Search suggestion rows (reference): Register (with its outlet), Product
// (Active / Deleted), User, Customer, Outlet.
const SUGGEST_LABELS = { register: 'Register', product: 'Product', user: 'User', customer: 'Customer', outlet: 'Outlet' };
const SuggestIcon = ({ type, deleted }) => {
  const sx = { fontSize: 34, color: '#111' };
  if (deleted) return <DeleteOutlineIcon sx={sx} />;
  switch (type) {
    case 'product': return <QrCodeIcon sx={sx} />;
    case 'register': return <PointOfSaleOutlinedIcon sx={sx} />;
    case 'user': return <PersonOutlineIcon sx={sx} />;
    case 'customer': return <PeopleOutlineIcon sx={sx} />;
    case 'outlet': return <StorefrontOutlinedIcon sx={sx} />;
    default: return <FolderOutlinedIcon sx={sx} />;
  }
};

const SortIcon = ({ active }) => (
  <svg width="10" height="14" viewBox="0 0 10 14" style={{ marginLeft: 4, verticalAlign: 'middle', display: 'inline-block' }} aria-hidden="true">
    <path d="M1 5.5 L5 1.5 L9 5.5 Z" fill={active === 'asc' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active === 'asc' ? 1.6 : 1.1} strokeLinejoin="round" />
    <path d="M1 8.5 L5 12.5 L9 8.5 Z" fill={active === 'desc' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active === 'desc' ? 1.6 : 1.1} strokeLinejoin="round" />
  </svg>
);

// Report types (reference order) with their reference query (FROM / BY / WHERE).
const REPORT_TYPES = [
  { value: 'actions', label: 'Actions', from: 'actions', by: 'actions' },
  { value: 'revisions', label: 'Revisions', from: 'revisions', by: 'revisions' },
  { value: 'cash_movements', label: 'Cash Movements', from: 'cash_movements', by: 'registers' },
  { value: 'inventory_log', label: 'Inventory Log', from: 'inventory_log', by: 'products' },
  { value: 'discounted_sales', label: 'Discounted Sales', from: 'sales', by: 'product', where: 'discount <> 0' },
  { value: 'cancelled_sales', label: 'Cancelled Sales', from: 'actions, sales', by: 'action', where: 'actions.action = "cancelled-sale"' },
  { value: 'modified_sales', label: 'Modified Sales', from: 'actions, sales', by: 'action', where: 'actions.action = "edited-sale"' },
];
const REPORT_TYPE_LABEL = Object.fromEntries(REPORT_TYPES.map((o) => [o.value, o.label]));
const normalizeType = (v) => { const t = String(v || 'actions').toLowerCase().replace(/-/g, '_'); return REPORT_TYPE_LABEL[t] ? t : 'actions'; };

// Columns per report type — reference Columns picker order, `on` = default ✓,
// `sql` = the query-bar projection. kind: text | json | datetime | currency |
// number (2dp) | link. `total` marks the columns that add up in the blue total row.
const col = (key, label, kind, on, sql, extra = {}) => ({ key, label, kind, on, sql, id: label, headerLabel: label.toUpperCase(), numeric: ['currency', 'number'].includes(kind), ...extra });
const SALE_LINK = 'LINK(sales.invoice_number, CONCAT(\'/sale/\', sales.sale_id)) AS "Invoice Number"';
const COLUMNS = {
  actions: [
    col('user', 'User', 'text', true, 'user AS "User"'),
    col('affectingType', 'Affecting Type', 'text', true, 'affecting_type AS "Affecting Type"'),
    col('action', 'Action', 'text', true, 'action AS "Action"'),
    col('additional', 'Additional', 'json', true, 'additional AS "Additional"'),
    col('timestamp', 'Timestamp', 'datetime', true, 'timestamp AS "Timestamp"'),
  ],
  revisions: [
    col('user', 'User', 'text', true, 'user AS "User"'),
    col('revisionableType', 'Revisionable Type', 'text', true, 'revisionable_type AS "Revisionable Type"'),
    col('key', 'Key', 'text', true, 'key AS "Key"'),
    col('old', 'Old Value', 'json', true, 'old AS "Old Value"'),
    col('new', 'New Value', 'json', true, 'new AS "New Value"'),
    col('timestamp', 'Timestamp', 'datetime', true, 'timestamp AS "Timestamp"'),
  ],
  cash_movements: [
    col('user', 'User', 'text', true, 'user AS "User"'),
    col('amount', 'Amount', 'currency', true, 'amount AS "Amount"', { total: true }),
    col('reason', 'Reason', 'text', true, 'reason AS "Reason"'),
    col('register', 'Register', 'text', false, 'register AS "Register"'),
    col('outlet', 'Outlet', 'text', false, 'outlet AS "Outlet"'),
    col('timestamp', 'Timestamp', 'datetime', true, 'timestamp AS "Timestamp"'),
  ],
  inventory_log: [
    col('user', 'User', 'text', true, 'user AS "User"'),
    col('outlet', 'Outlet', 'text', false, 'outlet AS "Outlet"'),
    col('before', 'Before', 'number', true, 'before AS "Before"'),
    col('changed', 'Changed', 'number', true, 'changed AS "Changed"', { total: true }),
    col('after', 'After', 'number', true, 'after AS "After"'),
    col('caseQuantity', 'Case Quantity', 'number', true, 'FORMAT(case_quantity, \'\', \'\', 2, \',\', \'.\', TRUE) AS "Case Quantity"'),
    col('changeType', 'Change Type', 'text', true, 'change_type AS "Change Type"'),
    col('timestamp', 'Timestamp', 'datetime', true, 'timestamp AS "Timestamp"'),
  ],
  discounted_sales: [
    col('user', 'User', 'text', true, 'user AS "User"'),
    col('invoiceNumber', 'Invoice Number', 'link', true, SALE_LINK),
    col('reason', 'Reason', 'text', true, 'product_discount_reason AS "Reason"'),
    col('discount', 'Discount', 'currency', true, 'discount AS "Discount"', { total: true }),
    col('totalPrice', 'Total Price', 'currency', true, 'revenue AS "Total Price"', { total: true }),
    col('customer', 'Customer', 'text', true, 'customer AS "Customer"'),
    col('register', 'Register', 'text', true, 'register AS "Register"'),
    col('outlet', 'Outlet', 'text', false, 'outlet AS "Outlet"'),
    col('timestamp', 'Timestamp', 'datetime', true, 'timestamp AS "Timestamp"'),
  ],
  cancelled_sales: [
    col('invoiceNumber', 'Invoice Number', 'link', true, SALE_LINK),
    col('user', 'User', 'text', true, 'actions.user AS "User"'),
    col('saleUser', 'Sale User', 'text', true, 'sales.user AS "Sale User"'),
    col('register', 'Register', 'text', true, 'sales.register AS "Register"'),
    col('outlet', 'Outlet', 'text', false, 'sales.outlet AS "Outlet"'),
    col('customer', 'Customer', 'text', true, 'sales.customer AS "Customer"'),
    col('externalNote', 'External Note', 'text', false, 'sales.note AS "External Note"'),
    col('internalNote', 'Internal Note', 'text', false, 'sales.internal_note AS "Internal Note"'),
    col('reason', 'Cancellation Reason', 'text', true, 'sales.modify_reason AS "Cancellation Reason"'),
    col('totalPrice', 'Total Price', 'currency', true, 'sales.revenue AS "Total Price"', { total: true }),
    col('timeOfSale', 'Time of Sale', 'datetime', true, 'sales.timestamp AS "Time of Sale"'),
    col('timestamp', 'Time Cancelled', 'datetime', true, 'actions.timestamp AS "Time Cancelled"'),
  ],
};
COLUMNS.modified_sales = COLUMNS.cancelled_sales.map((c) => (
  c.key === 'reason' ? col('reason', 'Modification Reason', 'text', true, 'sales.modify_reason AS "Modification Reason"')
    : c.key === 'timestamp' ? col('timestamp', 'Time Modified', 'datetime', true, 'actions.timestamp AS "Time Modified"')
      : c));

const fmtNumber = (n, d, grouping = true) => Number(n || 0).toLocaleString('en-AU', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: grouping });
// Reference Inventory Log: Before / Changed / After print raw (3767.00, total -3726),
// only the FORMAT(...) Case Quantity column carries the thousands separator.
const grouped = (column) => column.kind === 'currency' || column.key === 'caseQuantity';
const fmtDate = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return formatDate(d, 'dd/MM/yyyy HH:mm:ss');
};
// Reference cells: $0.00 · 127.00 · 23/10/2026 14:47:35 · raw JSON text.
const formatCell = (value, column) => {
  if (value === '' || value === null || value === undefined) return '';
  if (column.kind === 'text' || column.kind === 'link' || column.kind === 'json') return typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (column.kind === 'datetime') return fmtDate(value);
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  const sign = n < 0 ? '-' : '';
  if (column.kind === 'currency') return `${sign}$${fmtNumber(Math.abs(n), 2)}`;
  return `${sign}${fmtNumber(Math.abs(n), 2, grouped(column))}`;
};
// Reference total row: money as $, the Inventory Log "Changed" total as a plain integer (-2332).
const formatTotal = (value, column) => {
  const n = Number(value) || 0;
  if (column.kind === 'currency') return `${n < 0 ? '-' : ''}$${fmtNumber(Math.abs(n), 2)}`;
  return `${n < 0 ? '-' : ''}${fmtNumber(Math.abs(n), Number.isInteger(n) ? 0 : 2, grouped(column))}`;
};

const SQL_KEYWORDS = new Set([
  'SELECT', 'FROM', 'RANGE', 'AGGREGATE', 'BY', 'ON', 'WHERE', 'START', 'END', 'ORDER',
  'CONSOLIDATED', 'UNCONSOLIDATED', 'LIMIT', 'OFFSET', 'AS', 'TOTAL', 'AND', 'OR', 'IS',
  'NOT', 'NULL', 'LIKE', 'ASC', 'DESC', 'ASCENDING', 'DESCENDING', 'INCLUDE', 'EXCLUDE',
  'ONLY', 'CANCELLED', 'DELETED', 'VOIDED', 'ABORTED', 'BY_NAME', 'TODAY', 'ALL_OF_TIME',
  'CURRENT_TIMESTAMP', 'TRUE', 'FALSE',
]);
const SQL_FUNCTIONS = new Set(['LINK', 'CONCAT', 'FORMAT', 'ROUND', 'ABS', 'FLOOR', 'CEIL', 'COALESCE', 'IF_EQUAL']);
const highlightSQL = (sql) =>
  sql
    .split(/("[^"]*"|'[^']*'|[A-Za-z_][A-Za-z0-9_]*|[^\sA-Za-z0-9_"']+)/g)
    .filter(Boolean)
    .map((token, i) => {
      let color;
      if (/^["']/.test(token)) color = '#669900';
      else if (/^[A-Za-z_]/.test(token)) color = SQL_KEYWORDS.has(token.toUpperCase()) ? '#0077aa' : SQL_FUNCTIONS.has(token.toUpperCase()) ? '#dd4a68' : '#000000';
      else if (!/^\s+$/.test(token)) color = '#999999';
      return (
        <span key={i} style={color ? { color } : undefined}>
          {token}
        </span>
      );
    });

// Reference filter: slate trigger block with an INLINE panel pushed below it.
const ShopfrontFilter = ({ label, value, groups, onChange, renderValue, basis = '50%', disabled = false }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = groups.flatMap((g) => g.items).find((o) => o.value === value);
  const display = renderValue ? renderValue(value) : selected?.label || '';

  return (
    <Box sx={{ position: 'relative', flex: `0 1 ${basis}`, minWidth: 240 }} ref={ref}>
      <Box onClick={() => !disabled && setOpen((o) => !o)} sx={{ ...FILTER_BLOCK_SX, ...(disabled ? { bgcolor: '#45484d', color: '#8a8d92', cursor: 'default' } : {}) }}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ fontSize: 16, fontWeight: 400, lineHeight: 1.25 }}>{label}</Box>
          <Box sx={{ fontSize: '1.4em', fontWeight: 400, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {display}
          </Box>
        </Box>
        {open ? <ArrowDropUp /> : <ArrowDropDown />}
      </Box>
      {open && (
        <Box sx={{ position: 'absolute', top: '100%', left: '1px', width: 'calc(100% - 2px)', zIndex: 8, boxSizing: 'border-box', bgcolor: '#f8f8f8', borderRadius: 0, boxShadow: 'none', p: '11px 16px' }}>
          {groups.map((group, gi) => (
            <Box key={group.label || `g${gi}`}>
              {group.label && <Box sx={{ fontWeight: 700, fontSize: '19.2px', color: '#313439', mb: '8px' }}>{group.label}</Box>}
              <Box sx={{ pl: group.label ? '16px' : 0 }}>
                {group.items.map((option) => (
                  <Box
                    key={option.value}
                    onClick={() => { onChange(option.value); setOpen(false); }}
                    sx={{ fontSize: '19.2px', lineHeight: '23px', p: '3px 4px', cursor: 'pointer', bgcolor: option.value === value ? '#5ebbeb' : 'transparent', color: option.value === value ? '#f8f8f8' : '#313439', transition: 'background 0.1s, color 0.1s', '&:hover': { bgcolor: '#313439', color: '#f8f8f8' } }}
                  >
                    {option.label}
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

const stamp = (d) => (d ? formatDate(new Date(d), 'yyyy-MM-dd HH:mm:ss') : '');

const ActionsReports = () => {
  const [searchParams] = useSearchParams();
  const { getOutletId } = useAuth();
  const { globalMode, outlets: allOutlets } = useGlobalOutlet();
  const [outletFilterId, setOutletFilterId] = useState('all');
  useEffect(() => { if (!globalMode) setOutletFilterId('all'); }, [globalMode]);
  const outletGroups = [{ items: [{ value: 'all', label: 'All Outlets' }, ...allOutlets.map((o) => ({ value: String(o.id), label: o.name }))] }];
  const reportOutletId = () => (globalMode && outletFilterId !== 'all' ? outletFilterId : getOutletId());

  const initialRange = (() => {
    const preset = searchParams.get('dateTime');
    const s = searchParams.get('startDate');
    const e = searchParams.get('endDate');
    if (preset || s || e) return { preset: preset || 'custom', startDate: s ? new Date(s) : new Date(), endDate: e ? new Date(e) : new Date() };
    return { preset: 'today', startDate: new Date(), endDate: new Date() };
  })();

  // Reference opens on Actions · Today.
  const [reportType, setReportType] = useState(normalizeType(searchParams.get('reportType') || searchParams.get('type')));
  const [dateRange, setDateRange] = useState(initialRange);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('searchTerm') || '');
  const [includeDeleted, setIncludeDeleted] = useState(searchParams.get('includeDeleted') === 'true');

  const [reportData, setReportData] = useState([]);
  const [apiTotals, setApiTotals] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [sortConfig, setSortConfig] = useState(null);

  // Column visibility — one set per report type (reference defaults differ).
  const [visibleColumns, setVisibleColumns] = useState(() => Object.fromEntries(Object.entries(COLUMNS).map(([type, cols]) => [type, Object.fromEntries(cols.map((c) => [c.id, c.on]))])));
  const pickerColumns = COLUMNS[reportType];
  const visible = visibleColumns[reportType];
  const shownColumns = pickerColumns.filter((c) => visible[c.id]);
  const isPicked = (c) => !!visible[c.id];
  const handleColumnToggle = (id) => setVisibleColumns((prev) => ({ ...prev, [reportType]: { ...prev[reportType], [id]: !prev[reportType][id] } }));

  const [columnsAnchorEl, setColumnsAnchorEl] = useState(null);
  const [columnsChipsExpanded, setColumnsChipsExpanded] = useState(false);
  const [columnsSearch, setColumnsSearch] = useState('');
  const matchesSearch = (c) => !columnsSearch.trim() || c.label.toLowerCase().includes(columnsSearch.trim().toLowerCase());
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportType, setExportType] = useState('pdf');
  const [exportOrientation, setExportOrientation] = useState('portrait');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [customQuery, setCustomQuery] = useState('');

  // Search-bar suggestions + Included chips (same as the Sales / Transfers reports).
  const [suggestions, setSuggestions] = useState([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [chips, setChips] = useState(() => chipsFromParams(searchParams));
  const suggestBoxRef = useRef(null);
  useEffect(() => {
    const term = searchTerm.trim();
    if (!term) { setSuggestions([]); return undefined; }
    let cancelled = false;
    setSuggestLoading(true);
    const timer = setTimeout(async () => {
      try {
        const rows = await actionsReportService.getSearchSuggestions(term, includeDeleted);
        if (!cancelled) setSuggestions(rows);
      } catch { if (!cancelled) setSuggestions([]); }
      finally { if (!cancelled) setSuggestLoading(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchTerm, includeDeleted]);
  useEffect(() => {
    if (!suggestOpen) return undefined;
    const onDown = (e) => { if (suggestBoxRef.current && !suggestBoxRef.current.contains(e.target)) setSuggestOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [suggestOpen]);
  const addChip = (s) => {
    setChips((prev) => (prev.some((c) => c.type === s.type && c.id === s.id) ? prev : [...prev, { type: s.type, id: s.id, name: s.name, deleted: !!s.deleted, mode: 'include' }]));
    setSearchTerm('');
    setSuggestions([]);
    setSuggestOpen(false);
  };
  const toggleChip = (chip) => setChips((prev) => prev.map((c) => (c.type === chip.type && c.id === chip.id ? { ...c, mode: c.mode === 'off' ? 'include' : 'off' } : c)));
  const removeChip = (chip) => setChips((prev) => prev.filter((c) => !(c.type === chip.type && c.id === chip.id)));

  const reportTypeGroups = [{ items: REPORT_TYPES.map(({ value, label }) => ({ value, label })) }];

  const loadReportData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await actionsReportService.getActionsReport({
        reportType,
        dateTime: dateRange.preset,
        startDate: dateRange.startDate ? dateRange.startDate.toISOString() : undefined,
        endDate: dateRange.endDate ? dateRange.endDate.toISOString() : undefined,
        searchTerm,
        includeDeleted,
        outletId: reportOutletId(),
        ...(chips.some((c) => c.mode !== 'off') ? { filters: JSON.stringify(chips.filter((c) => c.mode !== 'off').map(({ type, id, mode }) => ({ type, id, mode }))) } : {}),
      });
      if (response.success) {
        setReportData(response.data || []);
        setApiTotals(response.totals || {});
      } else {
        setReportData([]);
        setLoadError('We encountered an error with that report type, check your filters and report type to make sure they aren\'t contradictory.');
      }
    } catch (error) {
      console.error('Error loading actions report:', error);
      setReportData([]);
      setLoadError(!error?.response
        ? 'Unable to load the report — you appear to be offline. Check your connection and try again.'
        : 'We encountered an error with that report type, check your filters and report type to make sure they aren\'t contradictory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, dateRange, includeDeleted, outletFilterId, chips]);

  useEffect(() => {
    const timer = setTimeout(() => loadReportData(), 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // Reference query bar: the visible columns, FROM <source>, BY <x>, WHERE for
  // the sale-based types, START/END for a custom window, ORDER, UNCONSOLIDATED.
  const generateSQLQuery = () => {
    const def = REPORT_TYPES.find((t) => t.value === reportType) || REPORT_TYPES[0];
    const projections = ['BY_NAME AS "Name"', ...shownColumns.map((c) => c.sql)];
    let query = `SELECT\n${projections.map((p) => `  ${p}`).join(',\n')}\n`;
    query += `FROM ${def.from}\n`;
    query += `BY ${def.by}\n`;
    const where = [def.where, searchTerm ? `BY_NAME LIKE '%${searchTerm.replace(/'/g, "''")}%'` : null].filter(Boolean);
    if (where.length) query += `WHERE\n${where.map((w) => `  ${w}`).join('\n  AND ')}\n`;
    if (dateRange.preset !== 'today' && dateRange.startDate && dateRange.endDate) query += `START "${stamp(dateRange.startDate)}"\nEND "${stamp(dateRange.endDate)}"\n`;
    query += 'ORDER "Timestamp" desc, "Time Cancelled" desc\n';
    query += 'UNCONSOLIDATED';
    return query;
  };
  useEffect(() => {
    setCustomQuery(generateSQLQuery());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, dateRange, searchTerm, visibleColumns]);

  const handleSort = (key) => {
    setSortConfig((prev) => (prev && prev.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }));
  };
  const sortedRows = useMemo(() => {
    if (!sortConfig) return reportData;
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    const cmp = (a, b) => {
      const av = a[sortConfig.key]; const bv = b[sortConfig.key];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av ?? '').localeCompare(String(bv ?? ''), undefined, { sensitivity: 'base', numeric: true }) * dir;
    };
    return [...reportData].sort(cmp);
  }, [reportData, sortConfig]);

  // Grand total (reference): only the money / Changed columns add up, the rest blank.
  const totalText = (column) => (column.total ? formatTotal(apiTotals[column.key] ?? 0, column) : '');
  const cellText = (row, column) => formatCell(row[column.key], column);
  // Invoice Number opens the sale (reference LINK → /sale/<id>).
  const renderCell = (row, column) => {
    const text = cellText(row, column);
    if (column.kind === 'link' && text && row.saleId) {
      return <Link component={RouterLink} to={`/register/history?saleId=${row.saleId}`} sx={{ color: '#0284c7', fontWeight: 400 }}>{text}</Link>;
    }
    return text;
  };

  const handleExportDialogClose = () => setExportDialogOpen(false);
  const handleExport = () => setExportDialogOpen(true);
  const handleExportConfirm = () => {
    switch (exportType) {
      case 'pdf': exportToPDF(); break;
      case 'xlsx': exportToExcel(); break;
      case 'csv': exportToCSV(); break;
      case 'json': exportToJSON(); break;
      default: break;
    }
    handleExportDialogClose();
  };
  const exportHeaders = () => ['Name', ...shownColumns.map((c) => c.headerLabel)];
  const exportBody = () => {
    const body = sortedRows.map((row) => [row.name, ...shownColumns.map((column) => cellText(row, column))]);
    body.push(['', ...shownColumns.map((column) => totalText(column))]);
    return body;
  };
  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: exportOrientation, unit: 'mm', format: 'a4' });
    doc.setFontSize(18);
    doc.text('Actions Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Report Type: ${REPORT_TYPE_LABEL[reportType] || reportType}`, 14, 25);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
    const body = exportBody();
    autoTable(doc, {
      head: [exportHeaders()],
      body,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [94, 187, 235] },
      didParseCell: (data) => { if (data.section === 'body' && data.row.index === body.length - 1) { data.cell.styles.fillColor = [94, 187, 235]; data.cell.styles.textColor = [248, 248, 248]; data.cell.styles.fontStyle = 'bold'; } },
    });
    doc.save('actions-report.pdf');
  };
  const exportToExcel = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([exportHeaders(), ...exportBody()]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Actions Report');
    XLSX.writeFile(workbook, 'actions-report.xlsx');
  };
  const exportToCSV = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csvContent = [exportHeaders(), ...exportBody()].map((r) => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'actions-report.csv';
    link.click();
  };
  const exportToJSON = () => {
    const blob = new Blob([JSON.stringify(sortedRows, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'actions-report.json';
    link.click();
  };

  // Reference print: store name, "<Report Type> by <By>", date range, black-rule table.
  const handlePrint = () => {
    const typeLabel = REPORT_TYPE_LABEL[reportType] || reportType;
    const byLabel = { actions: 'Actions', revisions: 'Revisions', cash_movements: 'Registers', inventory_log: 'Products', discounted_sales: 'Product', cancelled_sales: 'Action', modified_sales: 'Action' }[reportType] || typeLabel;
    printReportTable({
      title: reportPrintTitle(allOutlets, globalMode, getOutletId()),
      subtitle: `${typeLabel} by ${byLabel}`,
      range: reportPrintRange(dateRange),
      headers: [{ label: 'Name', align: 'left' }, ...shownColumns.map((column) => ({ label: column.label, align: 'center' }))],
      rows: sortedRows.map((row) => ({ cells: [row.name, ...shownColumns.map((column) => cellText(row, column))] })),
      totals: ['', ...shownColumns.map((column) => totalText(column))],
    });
  };

  // Reference (and the Sales report) centre every column, JSON included.
  const align = () => 'center';
  // Raw JSON (Revisions Old/New Value, Actions Additional) shows in full on one
  // line; the table scrolls sideways (user choice 23/10: no clipping).
  const cellSx = () => undefined;

  return (
    <Box sx={{ p: '8px' }}>
      {/* Query bar — reference has no page heading; the query bar is the first element */}
      <Box sx={{ display: 'flex', alignItems: 'center', height: 60, boxSizing: 'border-box', pl: '16px', mb: '8px', bgcolor: 'rgba(0,0,0,0)', border: '1px solid #404040', borderRadius: '8px', boxShadow: 'none', overflow: 'hidden' }}>
        <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', fontFamily: "'Roboto Mono', monospace", fontSize: 16, color: '#000000' }}>
          {highlightSQL(customQuery.replace(/\n\s*/g, ' '))}
        </Box>
        <Button
          variant="text"
          startIcon={<EditIcon />}
          component={RouterLink} to="/reports/actions/query" state={{ query: customQuery }}
          sx={{ ml: 2, minWidth: 88, color: '#00a63e', textTransform: 'none', whiteSpace: 'nowrap', fontWeight: 700, fontSize: 16, borderRadius: '12px', border: '1px solid transparent', bgcolor: 'transparent', transition: INSTANT, '&:hover': { bgcolor: 'rgba(0,0,0,0.05)', border: '1px solid transparent' } }}
        >
          Edit
        </Button>
      </Box>

      {/* Filters — flush 80px slate blocks: Report Type / Date and Time (reference one row). */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', mb: '8px' }}>
        {globalMode && (
          <ShopfrontFilter label="Outlet" value={outletFilterId} groups={outletGroups} onChange={setOutletFilterId} basis="33.3333%" />
        )}
        <ShopfrontFilter label="Report Type" value={reportType} groups={reportTypeGroups} onChange={(v) => { setReportType(v); setSortConfig(null); }} basis={globalMode ? '33.3333%' : '50%'} />
        <Box sx={{ flex: `0 1 ${globalMode ? '33.3333%' : '50%'}`, minWidth: 240, position: 'relative' }}>
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            label="Date and Time"
            size="small"
            fullWidth
            enableTime
            hideIcon
            inputSx={FILTER_DATE_SX}
          />
          <ArrowDropDown sx={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: '#f8f8f8', pointerEvents: 'none' }} />
        </Box>
      </Box>

      {/* Search + Include Deleted, Included chips, Export / Print / Save left, Columns right */}
      <Paper elevation={0} sx={{ p: 2, mb: '8px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 2 }}>
          <Box sx={{ position: 'relative', flex: 1 }} ref={suggestBoxRef}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search for anything"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setSuggestOpen(true); }}
              onFocus={() => setSuggestOpen(true)}
              sx={FIELD_SX}
              InputProps={{
                endAdornment: searchTerm ? <CancelIcon onClick={() => { setSearchTerm(''); setSuggestions([]); }} sx={{ cursor: 'pointer', color: '#333', fontSize: 22 }} /> : null,
              }}
            />
            {suggestOpen && (
              <Paper elevation={4} sx={{ position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 20, maxHeight: 520, overflowY: 'auto', borderRadius: 0, bgcolor: '#f8f8f8' }}>
                {!searchTerm.trim() ? (
                  <Box sx={{ px: 2, py: 1.5, fontSize: 22 }}>Start typing to search...</Box>
                ) : suggestLoading ? (
                  <Box sx={{ px: 2, py: 1.5, fontSize: 18, color: '#666' }}>Searching...</Box>
                ) : suggestions.length === 0 ? (
                  <Box sx={{ px: 2, py: 1.5, fontSize: 22 }}>No search results found.</Box>
                ) : (
                  suggestions.map((s, i) => (
                    <Box
                      key={`${s.type}-${s.id}`}
                      onClick={() => addChip(s)}
                      sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 1.5, py: 1, cursor: 'pointer', bgcolor: i % 2 ? '#e8e8e8' : '#f8f8f8', '&:hover': { bgcolor: '#5ebbeb', color: '#fff' } }}
                    >
                      <SuggestIcon type={s.type} deleted={s.deleted} />
                      <Box sx={{ flex: 1 }}>
                        {/* Reference: "Register ○ Premix King - Ararat" — the type, then the register's outlet */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 15, lineHeight: 1.2 }}>
                          {SUGGEST_LABELS[s.type] || s.type}
                          {s.subtitle && <><ExistsIcon sx={{ fontSize: 12 }} /><span>{s.subtitle}</span></>}
                        </Box>
                        <Box sx={{ fontSize: 22, lineHeight: 1.2 }}>{s.name}</Box>
                      </Box>
                      {s.type === 'product' && <Box sx={{ fontSize: 16 }}>{s.deleted ? 'Deleted' : 'Active'}</Box>}
                    </Box>
                  ))
                )}
              </Paper>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            <Typography sx={{ fontSize: 16, whiteSpace: 'nowrap' }}>Include Deleted</Typography>
            <ShopfrontSwitch checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} />
          </Box>
        </Box>
        {chips.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
            {chips.map((c) => (
              <Box key={`${c.type}-${c.id}`} sx={{ display: 'flex', alignItems: 'stretch', border: '1px solid #404040', bgcolor: '#fff' }}>
                <Box onClick={() => removeChip(c)} sx={{ display: 'flex', alignItems: 'center', px: 1.5, borderRight: '1px solid #404040', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' } }}>
                  <DeleteOutlineIcon sx={{ fontSize: 34, color: '#111' }} />
                </Box>
                <Box sx={{ px: 1.5, py: 0.75 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 16, lineHeight: 1.2 }}>
                    {SUGGEST_LABELS[c.type] || c.type}
                    {c.deleted ? (
                      <Tooltip title="This item no longer exists in your store" arrow placement="top">
                        <BlockIcon sx={{ fontSize: 18, color: '#333' }} />
                      </Tooltip>
                    ) : (
                      <Tooltip title="This item exists in your store" arrow placement="top">
                        <ExistsIcon sx={{ fontSize: 18, color: '#333' }} />
                      </Tooltip>
                    )}
                  </Box>
                  <Box sx={{ fontSize: 20, lineHeight: 1.3, cursor: 'default' }} onDoubleClick={() => removeChip(c)}>{c.name}</Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <ShopfrontSwitch checked={c.mode !== 'off'} onChange={() => toggleChip(c)} />
                    <Box sx={{ fontSize: 16 }}>Included</Box>
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Button variant="outlined" startIcon={<ExportIcon />} onClick={handleExport} sx={SKY_BUTTON_SX}>Export</Button>
            <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint} sx={SKY_BUTTON_SX}>Print</Button>
            <Button variant="outlined" startIcon={<SaveIcon />} onClick={() => setSaveDialogOpen(true)} sx={SKY_BUTTON_SX}>Save</Button>
            <FavouriteRevisionsButton sx={SKY_BUTTON_SX} />
          </Box>
          <Button variant="outlined" startIcon={<ColumnsIcon />} onClick={(e) => setColumnsAnchorEl(e.currentTarget)} sx={SKY_BUTTON_SX}>Columns</Button>
        </Box>
      </Paper>

      {/* Columns picker (reference): selected chips + "N More..." on top, then the
          selected columns pinned (blue) over a divider, then the full list. */}
      <Popover
        anchorEl={columnsAnchorEl}
        open={Boolean(columnsAnchorEl)}
        onClose={() => { setColumnsAnchorEl(null); setColumnsChipsExpanded(false); setColumnsSearch(''); }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 544, mt: '6px', p: '16px', borderRadius: '8px', border: '1px solid #404040', boxShadow: '0 6px 18px rgba(0,0,0,0.18)' } }}
      >
        {(() => {
          const selected = pickerColumns.filter(isPicked);
          const shown = columnsChipsExpanded ? selected : selected.slice(0, 2);
          const remaining = selected.length - shown.length;
          return (
            <Box onClick={() => setColumnsChipsExpanded((v) => !v)} sx={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', border: '1px solid #404040', borderRadius: '8px', px: '12px', py: '8px', mb: '12px', cursor: 'pointer', minHeight: 44 }}>
              {shown.map((c) => (
                <Box key={c.id} sx={{ bgcolor: '#e8e8e8', borderRadius: '4px', px: '8px', py: '2px', fontSize: 16, color: '#313439' }}>{c.label}</Box>
              ))}
              {remaining > 0 && <Box sx={{ bgcolor: '#e8e8e8', borderRadius: '4px', px: '8px', py: '2px', fontSize: 16, color: '#313439' }}>{remaining} More...</Box>}
              <Box component="input" value={columnsSearch} onClick={(e) => e.stopPropagation()} onChange={(e) => setColumnsSearch(e.target.value)} placeholder="" sx={{ flex: 1, minWidth: 60, border: 'none', outline: 'none', bgcolor: 'transparent', fontSize: 16, color: '#313439', fontFamily: 'inherit' }} />
              <Box sx={{ ml: 'auto', display: 'inline-flex', color: '#313439' }}>{columnsChipsExpanded ? <ArrowDropDown /> : <ArrowDropUp />}</Box>
            </Box>
          );
        })()}
        <Box sx={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #404040', borderRadius: '8px' }}>
          {(() => {
            const rowOf = (column, keyPrefix) => {
              const checked = isPicked(column);
              return (
                <Box
                  key={`${keyPrefix}-${column.id}`}
                  onClick={() => handleColumnToggle(column.id)}
                  sx={{ display: 'flex', alignItems: 'center', gap: '10px', px: '16px', height: 56, cursor: 'pointer', fontSize: 16, color: checked ? '#0284c7' : '#313439', '&:hover': { bgcolor: '#5ebbeb', color: '#000' } }}
                >
                  {checked ? <CheckBoxIcon sx={{ fontSize: 20 }} /> : <CheckBoxOutlineBlankIcon sx={{ fontSize: 20 }} />}
                  {column.label}
                </Box>
              );
            };
            if (columnsSearch.trim()) return pickerColumns.filter(matchesSearch).map((c) => rowOf(c, 'find'));
            const selected = pickerColumns.filter(isPicked);
            return (
              <>
                {selected.map((c) => rowOf(c, 'sel'))}
                {selected.length > 0 && <Box sx={{ borderTop: '1px solid #404040' }} />}
                {pickerColumns.map((c) => rowOf(c, 'all'))}
              </>
            );
          })()}
        </Box>
      </Popover>

      {loadError && !loading && (
        <Box sx={{ bgcolor: 'rgb(227,52,47)', color: '#fff', px: 2, py: 1.5, fontSize: 15 }}>{loadError}</Box>
      )}

      {/* Data table — spinner while loading; an empty window shows only the blue total row (reference) */}
      <Paper elevation={0} sx={{ borderRadius: 0 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 'calc(100vh - 300px)', overflow: 'auto' }}>
            <Table size="small" stickyHeader sx={{ width: '100%', '& .MuiTableCell-stickyHeader': { backgroundColor: '#5ebbeb' }, '& th': { cursor: 'pointer', userSelect: 'none' }, '& td:first-of-type': { position: 'sticky', left: 0, zIndex: 1, bgcolor: 'inherit' } }}>
              <TableHead>
                <TableRow sx={TABLE_HEAD_SX}>
                  <TableCell onClick={() => handleSort('name')} sx={{ position: 'sticky', left: 0, zIndex: 3 }}>NAME<SortIcon active={sortConfig?.key === 'name' ? sortConfig.direction : null} /></TableCell>
                  {shownColumns.map((column) => (
                    <TableCell key={column.id} align={align(column)} onClick={() => handleSort(column.key)}>
                      {column.headerLabel}<SortIcon active={sortConfig?.key === column.key ? sortConfig.direction : null} />
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedRows.map((row, index) => (
                  <TableRow key={index} sx={{ ...TABLE_ROW_SX, bgcolor: index % 2 === 0 ? '#fff' : ROW_ALT_BG }}>
                    <TableCell>{row.name}</TableCell>
                    {shownColumns.map((column) => (
                      <TableCell key={column.id} align={align(column)} sx={cellSx(column)}>{renderCell(row, column)}</TableCell>
                    ))}
                  </TableRow>
                ))}
                <TableRow sx={TABLE_TOTAL_SX}>
                  {/* Types without totals (Actions / Revisions) render empty cells; the
                      nbsp keeps the row as tall as the Sales report total row. */}
                  <TableCell>{' '}</TableCell>
                  {shownColumns.map((column) => (
                    <TableCell key={column.id} align={align(column)}>{totalText(column) || ' '}</TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Export Dialog — same as the Sales Report page. */}
      <Dialog open={exportDialogOpen} onClose={handleExportDialogClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' } }}>
        <DialogTitle sx={{ bgcolor: '#b3e5fc', display: 'flex', alignItems: 'center', gap: 1.5, py: 2, px: 3, borderBottom: '1px solid #e0e0e0' }}>
          <HelpIcon sx={{ color: '#0288d1', fontSize: 28 }} />
          <Typography variant="h6" component="span" sx={{ color: '#0288d1', fontWeight: 600, fontSize: '1.25rem' }}>Export Report</Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, py: 3 }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5, color: '#666', fontSize: '0.9rem', fontWeight: 500 }}>Export Type</Typography>
            <FormControl fullWidth>
              <Select
                value={exportType}
                onChange={(e) => setExportType(e.target.value)}
                displayEmpty
                sx={{ bgcolor: 'white', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#ddd' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#bbb' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#0288d1' } }}
                renderValue={(value) => {
                  const icons = { pdf: <PdfIcon sx={{ mr: 1.5, color: '#d32f2f' }} />, xlsx: <XlsxIcon sx={{ mr: 1.5, color: '#2e7d32' }} />, csv: <CsvIcon sx={{ mr: 1.5, color: '#ed6c02' }} />, json: <JsonIcon sx={{ mr: 1.5, color: '#0288d1' }} /> };
                  const labels = { pdf: 'PDF', xlsx: 'XLSX', csv: 'CSV', json: 'JSON' };
                  return <Box sx={{ display: 'flex', alignItems: 'center' }}>{icons[value]}<span style={{ fontWeight: 500 }}>{labels[value]}</span></Box>;
                }}
              >
                <MenuItem value="pdf"><Box sx={{ display: 'flex', alignItems: 'center' }}><PdfIcon sx={{ mr: 1.5, color: '#d32f2f' }} /><span>PDF</span></Box></MenuItem>
                <MenuItem value="xlsx"><Box sx={{ display: 'flex', alignItems: 'center' }}><XlsxIcon sx={{ mr: 1.5, color: '#2e7d32' }} /><span>XLSX</span></Box></MenuItem>
                <MenuItem value="csv"><Box sx={{ display: 'flex', alignItems: 'center' }}><CsvIcon sx={{ mr: 1.5, color: '#ed6c02' }} /><span>CSV</span></Box></MenuItem>
                <MenuItem value="json"><Box sx={{ display: 'flex', alignItems: 'center' }}><JsonIcon sx={{ mr: 1.5, color: '#0288d1' }} /><span>JSON</span></Box></MenuItem>
              </Select>
            </FormControl>
          </Box>
          {exportType === 'pdf' && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.5, color: '#666', fontSize: '0.9rem', fontWeight: 500 }}>Orientation</Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                {['portrait', 'landscape'].map((o) => {
                  const on = exportOrientation === o;
                  return (
                    <Button
                      key={o}
                      fullWidth
                      variant={on ? 'contained' : 'outlined'}
                      onClick={() => setExportOrientation(o)}
                      sx={{
                        py: 1.5, textTransform: 'uppercase', fontWeight: 600, fontSize: '0.875rem', letterSpacing: '0.5px',
                        ...(on
                          ? (o === 'portrait'
                            ? { bgcolor: 'white', color: '#333', border: '2px solid #0288d1', boxShadow: '0 2px 8px rgba(2, 136, 209, 0.15)', '&:hover': { bgcolor: '#f5f5f5', border: '2px solid #0277bd', boxShadow: '0 2px 12px rgba(2, 136, 209, 0.25)' } }
                            : { bgcolor: '#e0e0e0', color: '#333', border: '2px solid #9e9e9e', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)', '&:hover': { bgcolor: '#d5d5d5', border: '2px solid #757575', boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)' } })
                          : { bgcolor: 'white', color: '#666', border: '1px solid #ddd', '&:hover': { bgcolor: '#fafafa', border: '1px solid #bbb' } }),
                      }}
                    >
                      {o === 'portrait' ? 'Portrait' : 'Landscape'}
                    </Button>
                  );
                })}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2.5, bgcolor: '#fafafa', borderTop: '1px solid #e0e0e0' }}>
          <Button onClick={handleExportDialogClose} variant="outlined" sx={{ minWidth: 100, py: 1, textTransform: 'none', fontSize: '0.95rem', fontWeight: 500, color: '#666', borderColor: '#ccc', '&:hover': { borderColor: '#999', bgcolor: '#f5f5f5' } }}>Cancel</Button>
          <Button onClick={handleExportConfirm} variant="contained" sx={{ minWidth: 100, py: 1, textTransform: 'none', fontSize: '0.95rem', fontWeight: 600, bgcolor: '#00bcd4', boxShadow: '0 2px 8px rgba(0, 188, 212, 0.3)', '&:hover': { bgcolor: '#00acc1', boxShadow: '0 4px 12px rgba(0, 188, 212, 0.4)' } }}>Export</Button>
        </DialogActions>
      </Dialog>

      <SaveReportDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        reportType="actions"
        reportPath="/reports/actions"
        defaultName={`Actions by ${REPORT_TYPE_LABEL[reportType] || reportType}`}
        filters={{
          reportType,
          dateTime: dateRange.preset,
          startDate: dateRange.startDate ? dateRange.startDate.toISOString() : null,
          endDate: dateRange.endDate ? dateRange.endDate.toISOString() : null,
          searchTerm,
          chips: chipsToParam(chips),
          includeDeleted,
          outletId: reportOutletId(),
        }}
      />
    </Box>
  );
};

export default ActionsReports;
