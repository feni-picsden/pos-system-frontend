import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  ArrowDropDown,
  ArrowDropUp,
  LayersOutlined as GroupsIcon,
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
  LocalShippingOutlined as LocalShippingOutlinedIcon,
  FolderOutlined as FolderOutlinedIcon,
} from '@mui/icons-material';
import { format as formatDate } from 'date-fns';
import { printReportTable, reportPrintTitle, reportPrintRange, optionLabel } from '../../utils/reportPrint';
import { chipsToParam, chipsFromParams } from '../../utils/reportChips';
import FavouriteRevisionsButton from '../../components/Reports/FavouriteRevisionsButton';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalOutlet } from '../../components/Common/GlobalOutletFilter';
import transferReportService from '../../services/transferReportService';
import SaveReportDialog from '../../components/Reports/SaveReportDialog';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import DateRangePicker from '../../components/Common/DateRangePicker';
const { jsPDF } = await import('jspdf');
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Transfers Report — same chrome as pages/Reports/SalesReport.jsx and
// InventoryReport.jsx (query bar, slate filter blocks, search + Included chips,
// sky buttons, Columns picker, sticky table, blue total row). Copied rather than
// shared: parallel parity agents own those files.

const INSTANT = 'all 0s ease';

// Sky-outlined toolbar buttons (Export / Print / Save / Groups / Columns).
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

// Parity input outline: #404040 1px, focused #000 2px, radius 8px.
const FIELD_SX = {
  '& .MuiOutlinedInput-root': { borderRadius: '8px' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' },
  '& input::placeholder, & textarea::placeholder': { color: '#808080', opacity: 1 },
};

// Data table chrome — identical to the Sales / Inventory report tables.
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

// Reference odd-row stripe is a visible grey.
const ROW_ALT_BG = '#e8e8e8';

// Reference filter block: flush slate box, 80px tall, square, 1px near-white border.
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

// Date and Time block styled like the other filter blocks (same as SalesReport.jsx).
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

// Search suggestion rows (same as the Sales Report): type label + icon; a deleted item shows a bin.
const SUGGEST_LABELS = { product: 'Product', category: 'Category', brand: 'Brand', family: 'Family', tag: 'Tag', outlet: 'Outlet', transferee: 'Transferee' };
const SuggestIcon = ({ type, deleted }) => {
  const sx = { fontSize: 34, color: '#111' };
  if (deleted) return <DeleteOutlineIcon sx={sx} />;
  switch (type) {
    case 'product': return <QrCodeIcon sx={sx} />;
    case 'outlet': return <StorefrontOutlinedIcon sx={sx} />;
    case 'transferee': return <LocalShippingOutlinedIcon sx={sx} />;
    default: return <FolderOutlinedIcon sx={sx} />;
  }
};

// Reference header: ⇕ after every label; `active` = 'asc' | 'desc' fills the
// triangle of the current sort direction.
const SortIcon = ({ active }) => (
  <svg width="10" height="14" viewBox="0 0 10 14" style={{ marginLeft: 4, verticalAlign: 'middle', display: 'inline-block' }} aria-hidden="true">
    <path d="M1 5.5 L5 1.5 L9 5.5 Z" fill={active === 'asc' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active === 'asc' ? 1.6 : 1.1} strokeLinejoin="round" />
    <path d="M1 8.5 L5 12.5 L9 8.5 Z" fill={active === 'desc' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active === 'desc' ? 1.6 : 1.1} strokeLinejoin="round" />
  </svg>
);

// Reference Columns picker (28 columns, reference order). `kind` drives the cell
// format and the totals row: numbers add up, text / date columns stay blank.
// Consolidate = Yes lists only the numeric columns (reference: 12).
const ALL_COLUMNS = [
  { key: 'sender', label: 'Sender', kind: 'text', sql: 'sender AS "Sender"' },
  { key: 'receiver', label: 'Receiver', kind: 'text', sql: 'receiver AS "Receiver"' },
  { key: 'outlet', label: 'Outlet', kind: 'text', sql: 'outlet AS "Outlet"' },
  { key: 'transferee', label: 'Transferee', kind: 'text', sql: 'transferee AS "Transferee"' },
  { key: 'orderDate', label: 'Order Date', kind: 'date', sql: 'order_date AS "Order Date"' },
  { key: 'dueDate', label: 'Due Date', kind: 'date', sql: 'due_date AS "Due Date"' },
  { key: 'orderNumber', label: 'Order Number', kind: 'link', sql: 'LINK(order_number, CONCAT(\'/order/\', transfer_id)) AS "Order Number"' },
  { key: 'reference', label: 'Reference', kind: 'text', sql: 'reference AS "Reference"' },
  { key: 'notes', label: 'Notes', kind: 'text', sql: 'notes AS "Notes"' },
  { key: 'internalNotes', label: 'Internal Notes', kind: 'text', sql: 'internal_notes AS "Internal Notes"' },
  { key: 'sentAt', label: 'Sent At', kind: 'datetime', sql: 'sent_at AS "Sent At"' },
  { key: 'receivedAt', label: 'Received At', kind: 'datetime', sql: 'received_at AS "Received At"' },
  { key: 'cost', label: 'Cost', kind: 'currency', sql: 'cost AS "Cost"' },
  { key: 'tax', label: 'Tax Amount', kind: 'currency', sql: 'tax AS "Tax Amount"' },
  { key: 'totalQuantity', label: 'Total Quantity', kind: 'int', sql: 'total_quantity AS "Total Quantity"' },
  { key: 'orderedQuantity', label: 'Total Ordered', kind: 'int', sql: 'ordered_quantity AS "Total Ordered"' },
  { key: 'orderedItems', label: 'Ordered Items', kind: 'int', sql: 'ordered_items AS "Ordered Items"' },
  { key: 'orderedCases', label: 'Ordered Cases', kind: 'int', sql: 'ordered_cases AS "Ordered Cases"' },
  { key: 'receivedQuantity', label: 'Received Quantity', kind: 'int', sql: 'received_quantity AS "Received Quantity"' },
  { key: 'receivedCases', label: 'Received Cases', kind: 'int', sql: 'received_cases AS "Received Cases"' },
  { key: 'receivedItems', label: 'Received Items', kind: 'int', sql: 'received_items AS "Received Items"' },
  { key: 'calculatedCasesReceived', label: 'Calculated Cases Received', kind: 'int', sql: 'calculated_cases_received AS "Calculated Cases Received"' },
  { key: 'calculatedItemsReceived', label: 'Calculated Items Received', kind: 'int', sql: 'calculated_items_received AS "Calculated Items Received"' },
  { key: 'transferredQuantity', label: 'Transferred Quantity', kind: 'int', sql: 'transferred_quantity AS "Transferred Quantity"' },
  { key: 'transferredCases', label: 'Transferred Cases', kind: 'int', sql: 'transferred_cases AS "Transferred Cases"' },
  { key: 'transferredItems', label: 'Transferred Items', kind: 'int', sql: 'transferred_items AS "Transferred Items"' },
  { key: 'calculatedCasesTransferred', label: 'Calculated Cases Transferred', kind: 'int', sql: 'calculated_cases_transferred AS "Calculated Cases Transferred"' },
  { key: 'calculatedItemsTransferred', label: 'Calculated Items Transferred', kind: 'int', sql: 'calculated_items_transferred AS "Calculated Items Transferred"' },
].map((c) => ({ ...c, id: c.label, headerLabel: c.label.toUpperCase(), numeric: ['currency', 'int'].includes(c.kind) }));

// Reference default picks: Consolidate Yes → Cost, Tax Amount; No → ten columns.
const DEFAULT_VISIBLE_CONSOLIDATED = ['Cost', 'Tax Amount'];
const DEFAULT_VISIBLE_UNCONSOLIDATED = ['Outlet', 'Order Date', 'Order Number', 'Received At', 'Cost', 'Tax Amount', 'Received Cases', 'Received Items', 'Transferred Cases', 'Transferred Items'];

const fmtNumber = (n, d) => Number(n || 0).toLocaleString('en-AU', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtDate = (v, withTime) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return formatDate(d, withTime ? 'dd/MM/yyyy HH:mm:ss' : 'dd/MM/yyyy');
};
// Reference cells: $23.62 · -5 · 22/10/2026 · 22/10/2026 16:55:38
const formatCell = (value, col) => {
  if (value === '' || value === null || value === undefined) return '';
  if (col.kind === 'text' || col.kind === 'link') return String(value);
  if (col.kind === 'date') return fmtDate(value, false);
  if (col.kind === 'datetime') return fmtDate(value, true);
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  const sign = n < 0 ? '-' : '';
  if (col.kind === 'currency') return `${sign}$${fmtNumber(Math.abs(n), 2)}`;
  return `${sign}${fmtNumber(Math.abs(n), Number.isInteger(n) ? 0 : 2)}`;
};

// Reporting Query Language keywords — highlighted like the reference query bar.
const SQL_KEYWORDS = new Set([
  'SELECT', 'FROM', 'RANGE', 'AGGREGATE', 'BY', 'ON', 'WHERE', 'START', 'END', 'ORDER',
  'CONSOLIDATED', 'UNCONSOLIDATED', 'LIMIT', 'OFFSET', 'AS', 'TOTAL', 'AND', 'OR', 'IS',
  'NOT', 'NULL', 'LIKE', 'ASC', 'DESC', 'ASCENDING', 'DESCENDING', 'INCLUDE', 'EXCLUDE',
  'ONLY', 'CANCELLED', 'DELETED', 'VOIDED', 'ABORTED', 'BY_NAME', 'TODAY', 'ALL_OF_TIME',
  'CURRENT_TIMESTAMP',
]);
const SQL_FUNCTIONS = new Set(['LINK', 'CONCAT', 'FORMAT', 'ROUND', 'ABS', 'FLOOR', 'CEIL', 'COALESCE', 'IF_EQUAL']);

// keywords #0077aa, functions #dd4a68, quoted strings #669900, punctuation #999999
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

// Reference filter: slate trigger block with an INLINE panel pushed below it
// (absolute, top 100%, full width, flat #f8f8f8, no shadow, no animation).
const ShopfrontFilter = ({ label, value, groups, onChange, renderValue, basis = '33.3333%', disabled = false }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
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
        <Box
          sx={{
            position: 'absolute',
            top: '100%',
            left: '1px',
            width: 'calc(100% - 2px)',
            zIndex: 8,
            boxSizing: 'border-box',
            bgcolor: '#f8f8f8',
            borderRadius: 0,
            boxShadow: 'none',
            p: '11px 16px',
          }}
        >
          {groups.map((group, gi) => (
            <Box key={group.label || `g${gi}`}>
              {group.label && (
                <Box sx={{ fontWeight: 700, fontSize: '19.2px', color: '#313439', mb: '8px' }}>
                  {group.label}
                </Box>
              )}
              <Box sx={{ pl: group.label ? '16px' : 0 }}>
                {group.items.map((option) => (
                  <Box
                    key={option.value}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    sx={{
                      fontSize: '19.2px',
                      lineHeight: '23px',
                      p: '3px 4px',
                      cursor: 'pointer',
                      bgcolor: option.value === value ? '#5ebbeb' : 'transparent',
                      color: option.value === value ? '#f8f8f8' : '#313439',
                      transition: 'background 0.1s, color 0.1s',
                      '&:hover': { bgcolor: '#313439', color: '#f8f8f8' },
                    }}
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

// Report Type / Group By focuses (reference: General + Classifications).
const REPORT_GROUPS = {
  general: [
    { value: 'outlet', label: 'Outlet' },
    { value: 'transferee', label: 'Transferee' },
    { value: 'product', label: 'Product' },
  ],
  classifications: [
    { value: 'brand', label: 'Brand' },
    { value: 'category', label: 'Category' },
    { value: 'family', label: 'Family' },
    { value: 'tag', label: 'Tag' },
  ],
};
const REPORT_TYPE_LABEL = Object.fromEntries([...REPORT_GROUPS.general, ...REPORT_GROUPS.classifications].map((o) => [o.value, o.label]));

const CONSOLIDATE_GROUPS = [
  { items: [{ value: 'consolidated', label: 'Consolidated' }, { value: 'unconsolidated', label: 'Unconsolidated' }] },
];

// Precision option lists (same values as the Sales Report).
const PRECISION_OPTIONS = {
  range: [
    { value: 'hour', label: 'Hour' },
    { value: 'date', label: 'Date' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'quarter', label: 'Quarter' },
    { value: 'year', label: 'Year' },
  ],
  aggregate: [
    { value: 'aggregate_hour', label: 'Hour' },
    { value: 'aggregate_date', label: 'Date' },
    { value: 'aggregate_day', label: 'Day' },
    { value: 'aggregate_week', label: 'Week' },
    { value: 'aggregate_month', label: 'Month' },
    { value: 'aggregate_monthDate', label: 'Month Date' },
    { value: 'aggregate_quarter', label: 'Quarter' },
  ],
};
const PRECISION_GROUPS = [
  { items: [{ value: 'none', label: 'None' }] },
  { label: 'Range', items: PRECISION_OPTIONS.range },
  { label: 'Aggregate', items: PRECISION_OPTIONS.aggregate },
];

const stamp = (d) => (d ? formatDate(new Date(d), 'yyyy-MM-dd HH:mm:ss') : '');

const TransferReports = () => {
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

  // Reference opens on Outlet · None · Today · Consolidate Yes · Precision None.
  const [reportType, setReportType] = useState(searchParams.get('reportType') || 'outlet');
  const [groupBy, setGroupBy] = useState(searchParams.get('groupBy') || 'none');
  const [dateRange, setDateRange] = useState(initialRange);
  const [consolidate, setConsolidate] = useState((searchParams.get('consolidate') || 'consolidated') === 'unconsolidated' ? 'unconsolidated' : 'consolidated');
  const [precision, setPrecision] = useState(searchParams.get('precision') || 'none');
  const [searchTerm, setSearchTerm] = useState(searchParams.get('searchTerm') || '');
  const [includeDeleted, setIncludeDeleted] = useState(searchParams.get('includeDeleted') === 'true');

  const [reportData, setReportData] = useState([]);
  const [apiTotals, setApiTotals] = useState({});
  // Precision mode: period columns from the API, one numeric metric per cell.
  const [periods, setPeriods] = useState([]);
  const [metric, setMetric] = useState('cost');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [collapsed, setCollapsed] = useState({});
  const [sortConfig, setSortConfig] = useState(null);

  // Column visibility — one set per Consolidate mode (reference defaults differ).
  const [visibleColumns, setVisibleColumns] = useState(() => ({
    consolidated: Object.fromEntries(ALL_COLUMNS.map((c) => [c.id, DEFAULT_VISIBLE_CONSOLIDATED.includes(c.id)])),
    unconsolidated: Object.fromEntries(ALL_COLUMNS.map((c) => [c.id, DEFAULT_VISIBLE_UNCONSOLIDATED.includes(c.id)])),
  }));
  const isPrecisionMode = precision && precision !== 'none';
  const visible = visibleColumns[consolidate];
  const metricColumn = ALL_COLUMNS.find((c) => c.key === metric) || ALL_COLUMNS.find((c) => c.key === 'cost');
  // Precision (reference): the picker lists the numeric columns and picks ONE metric.
  const pickerColumns = consolidate === 'consolidated' || isPrecisionMode ? ALL_COLUMNS.filter((c) => c.numeric) : ALL_COLUMNS;
  const shownColumns = isPrecisionMode
    ? periods.map((p) => ({ id: p.key, key: p.key, label: p.label, headerLabel: p.label.toUpperCase(), kind: metricColumn.kind, numeric: true, period: true }))
    : pickerColumns.filter((c) => visible[c.id]);
  const isPicked = (c) => (isPrecisionMode ? c.key === metric : !!visible[c.id]);
  const handleColumnToggle = (id) => {
    if (isPrecisionMode) { const col = ALL_COLUMNS.find((c) => c.id === id); if (col) setMetric(col.key); return; }
    setVisibleColumns((prev) => ({ ...prev, [consolidate]: { ...prev[consolidate], [id]: !prev[consolidate][id] } }));
  };

  const [columnsAnchorEl, setColumnsAnchorEl] = useState(null);
  const [columnsChipsExpanded, setColumnsChipsExpanded] = useState(false);
  // Reference: typing in the picker's chip bar filters the column list.
  const [columnsSearch, setColumnsSearch] = useState('');
  const matchesSearch = (c) => !columnsSearch.trim() || c.label.toLowerCase().includes(columnsSearch.trim().toLowerCase());
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportType, setExportType] = useState('pdf');
  const [exportOrientation, setExportOrientation] = useState('portrait');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [customQuery, setCustomQuery] = useState('');

  // Search-bar suggestions + Included chips (same as the Sales / Inventory reports).
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
        const rows = await transferReportService.getSearchSuggestions(term, includeDeleted);
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

  // Group By omits the option equal to the active Report Type.
  const reportTypeGroups = [
    { label: 'General', items: REPORT_GROUPS.general },
    { label: 'Classifications', items: REPORT_GROUPS.classifications },
  ];
  const groupByGroups = [
    { items: [{ value: 'none', label: 'None' }] },
    { label: 'General', items: REPORT_GROUPS.general.filter((o) => o.value !== reportType) },
    { label: 'Classifications', items: REPORT_GROUPS.classifications.filter((o) => o.value !== reportType) },
  ];
  useEffect(() => { if (groupBy === reportType) setGroupBy('none'); }, [reportType, groupBy]);

  const loadReportData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await transferReportService.getTransferReport({
        reportType,
        groupBy,
        consolidate,
        precision,
        metric,
        dateTime: dateRange.preset,
        startDate: dateRange.startDate ? dateRange.startDate.toISOString() : undefined,
        endDate: dateRange.endDate ? dateRange.endDate.toISOString() : undefined,
        searchTerm,
        includeDeleted,
        outletId: reportOutletId(),
        ...(chips.some((c) => c.mode !== 'off') ? { filters: JSON.stringify(chips.filter((c) => c.mode !== 'off').map(({ type, id, mode }) => ({ type, id, mode }))) } : {}),
      });
      if (response.success) {
        if (response.precision) {
          // Period columns: flatten {values} onto the row so cells / sort / totals read row[periodKey].
          const lift = (r) => ({ ...r, ...(r.values || {}), children: Array.isArray(r.children) ? r.children.map((c) => ({ ...c, ...(c.values || {}) })) : undefined });
          setPeriods(response.periods || []);
          setReportData((response.data || []).map(lift));
        } else {
          setPeriods([]);
          setReportData(response.data || []);
        }
        setApiTotals(response.totals || {});
        setCollapsed({});
      } else {
        setReportData([]);
        setLoadError('We encountered an error with that report type, check your filters and report type to make sure they aren\'t contradictory.');
      }
    } catch (error) {
      console.error('Error loading transfer report:', error);
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
  }, [reportType, groupBy, consolidate, precision, metric, dateRange, includeDeleted, outletFilterId, chips]);

  useEffect(() => {
    const timer = setTimeout(() => loadReportData(), 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // Reference query bar: the visible columns, BY <report type>, ON <group>,
  // START/END for a custom window, CONSOLIDATED | UNCONSOLIDATED.
  const generateSQLQuery = () => {
    if (isPrecisionMode) {
      const isAgg = precision.startsWith('aggregate_');
      const unit = (isAgg ? precision.slice('aggregate_'.length) : precision).replace(/([A-Z])/g, '_$1').toLowerCase();
      const on = groupBy && groupBy !== 'none' ? ` ON ${groupBy}` : '';
      return `SELECT ${metricColumn.sql} FROM transfers ${isAgg ? 'AGGREGATE' : 'RANGE'} ${unit} BY ${reportType}${on} START "${stamp(dateRange.startDate)}" END "${stamp(dateRange.endDate)}" CONSOLIDATED`;
    }
    const projections = ['BY_NAME AS "Name"', ...shownColumns.map((c) => c.sql)];
    let query = `SELECT\n${projections.map((p) => `  ${p}`).join(',\n')}\n`;
    query += 'FROM transfers\n';
    query += `BY ${reportType}\n`;
    if (groupBy && groupBy !== 'none') query += `ON ${groupBy}\n`;
    if (dateRange.preset !== 'today' && dateRange.startDate && dateRange.endDate) query += `START "${stamp(dateRange.startDate)}" END "${stamp(dateRange.endDate)}"\n`;
    if (searchTerm) query += `WHERE BY_NAME LIKE '%${searchTerm.replace(/'/g, "''")}%'\n`;
    query += 'ORDER "Name" asc\n';
    query += consolidate === 'consolidated' ? 'CONSOLIDATED' : 'UNCONSOLIDATED';
    return query;
  };
  useEffect(() => {
    setCustomQuery(generateSQLQuery());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, groupBy, consolidate, precision, metric, dateRange, searchTerm, visibleColumns]);

  const toggleGroup = (name) => setCollapsed((prev) => ({ ...prev, [name]: !prev[name] }));
  const toggleAllGroups = () => {
    const groups = reportData.filter((r) => Array.isArray(r.children));
    const allCollapsed = groups.length > 0 && groups.every((g) => collapsed[g.name]);
    setCollapsed(allCollapsed ? {} : Object.fromEntries(groups.map((g) => [g.name, true])));
  };

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
    return [...reportData].sort(cmp).map((row) => {
      if (!Array.isArray(row.children)) return row;
      const kids = row.children.filter((c) => !c.isTotalRow).sort(cmp);
      const total = row.children.find((c) => c.isTotalRow);
      return { ...row, children: total ? [...kids, total] : kids };
    });
  }, [reportData, sortConfig]);

  // Grand total (reference): numbers add up, text / date columns blank.
  // Precision cells: blank where the period has no transfer (reference).
  const totalText = (col) => (!col.numeric || (col.period && !Number(apiTotals[col.key])) ? '' : formatCell(apiTotals[col.key] ?? 0, col));
  const periodCell = (row, col) => (col.period && !Number(row[col.key]) ? '' : formatCell(row[col.key], col));
  const hasGroups = reportData.some((r) => Array.isArray(r.children));

  // Reference groups: header row (name), children, then the group's "Totals" row.
  const flattenReportData = () => {
    const flattened = [];
    sortedRows.forEach((row) => {
      if (row.children && Array.isArray(row.children)) {
        flattened.push({ ...row, isParent: true });
        row.children.forEach((child) => flattened.push({ ...child, isChild: !child.isTotalRow }));
      } else {
        flattened.push(row);
      }
    });
    return flattened;
  };
  const cellText = (row, col) => {
    if (row.isParent) return '';
    if (row.isTotalRow && !col.numeric) return '';
    return periodCell(row, col);
  };
  // Order Number opens the transfer (reference LINK → /order/<id>).
  const renderCell = (row, col) => {
    const text = periodCell(row, col);
    if (col.kind === 'link' && text && row.transferId) {
      return <Link component={RouterLink} to={`/orders-invoices/${row.transferId}`} sx={{ color: '#0284c7', fontWeight: 400 }}>{text}</Link>;
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
    const body = flattenReportData().map((row) => [row.isChild ? `  ${row.name}` : row.name, ...shownColumns.map((col) => cellText(row, col))]);
    body.push(['', ...shownColumns.map((col) => totalText(col))]);
    return body;
  };
  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: exportOrientation, unit: 'mm', format: 'a4' });
    doc.setFontSize(18);
    doc.text('Transfers Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Report Type: ${REPORT_TYPE_LABEL[reportType] || reportType}`, 14, 25);
    doc.text(`Group By: ${groupBy}`, 14, 30);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 35);
    const body = exportBody();
    autoTable(doc, {
      head: [exportHeaders()],
      body,
      startY: 40,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [94, 187, 235] },
      didParseCell: (data) => { if (data.section === 'body' && data.row.index === body.length - 1) { data.cell.styles.fillColor = [94, 187, 235]; data.cell.styles.textColor = [248, 248, 248]; data.cell.styles.fontStyle = 'bold'; } },
    });
    doc.save('transfers-report.pdf');
  };
  const exportToExcel = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([exportHeaders(), ...exportBody()]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transfers Report');
    XLSX.writeFile(workbook, 'transfers-report.xlsx');
  };
  const exportToCSV = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csvContent = [exportHeaders(), ...exportBody()].map((r) => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'transfers-report.csv';
    link.click();
  };
  const exportToJSON = () => {
    const blob = new Blob([JSON.stringify(flattenReportData(), null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'transfers-report.json';
    link.click();
  };

  // Reference print: store name, "<Report Type> by <Group By>", date range, black-rule table.
  const handlePrint = () => {
    const typeLabel = REPORT_TYPE_LABEL[reportType] || reportType;
    const byLabel = groupBy && groupBy !== 'none' ? optionLabel(groupByGroups, groupBy) : typeLabel;
    printReportTable({
      title: reportPrintTitle(allOutlets, globalMode, getOutletId()),
      subtitle: `${typeLabel} by ${byLabel}`,
      range: reportPrintRange(dateRange),
      headers: [{ label: 'Name', align: 'left' }, ...shownColumns.map((col) => ({ label: col.label || col.headerLabel, align: 'center' }))],
      rows: flattenReportData().map((row) => ({ cells: [row.name, ...shownColumns.map((col) => cellText(row, col))], indent: !!row.isChild, bold: !!(row.isParent || row.isTotalRow) })),
      totals: reportData.length > 0 ? ['', ...shownColumns.map((col) => totalText(col))] : null,
    });
  };

  const align = (col) => (col.numeric ? 'center' : 'left');

  return (
    <Box sx={{ p: '8px' }}>
      {/* Query bar — reference has no page heading; the query bar is the first element */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          height: 60,
          boxSizing: 'border-box',
          pl: '16px',
          mb: '8px',
          bgcolor: 'rgba(0,0,0,0)',
          border: '1px solid #404040',
          borderRadius: '8px',
          boxShadow: 'none',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', fontFamily: "'Roboto Mono', monospace", fontSize: 16, color: '#000000' }}>
          {highlightSQL(customQuery.replace(/\n/g, ' '))}
        </Box>
        <Button
          variant="text"
          startIcon={<EditIcon />}
          component={RouterLink} to="/reports/transfer-reports/query" state={{ query: customQuery }}
          sx={{
            ml: 2,
            minWidth: 88,
            color: '#00a63e',
            textTransform: 'none',
            whiteSpace: 'nowrap',
            fontWeight: 700,
            fontSize: 16,
            borderRadius: '12px',
            border: '1px solid transparent',
            bgcolor: 'transparent',
            transition: INSTANT,
            '&:hover': { bgcolor: 'rgba(0,0,0,0.05)', border: '1px solid transparent' },
          }}
        >
          Edit
        </Button>
      </Box>

      {/* Filters — flush 80px slate blocks: Report Type / Group By / Date and Time,
          then Consolidate By Report Type / Precision (reference two rows). */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', mb: '8px' }}>
        {globalMode && (
          <ShopfrontFilter label="Outlet" value={outletFilterId} groups={outletGroups} onChange={setOutletFilterId} basis="25%" />
        )}
        <ShopfrontFilter label="Report Type" value={reportType} groups={reportTypeGroups} onChange={setReportType} basis={globalMode ? '25%' : '33.3333%'} />
        <ShopfrontFilter label="Group By" value={groupBy} groups={groupByGroups} onChange={setGroupBy} basis={globalMode ? '25%' : '33.3333%'} />
        <Box sx={{ flex: `0 1 ${globalMode ? '25%' : '33.3333%'}`, minWidth: 240, position: 'relative' }}>
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
        <ShopfrontFilter
          label="Consolidate By Report Type"
          value={consolidate}
          groups={CONSOLIDATE_GROUPS}
          onChange={setConsolidate}
          basis="50%"
          renderValue={(value) => (value === 'consolidated' ? 'Yes' : 'No')}
          disabled={isPrecisionMode}
        />
        <ShopfrontFilter
          label="Precision"
          value={precision}
          groups={PRECISION_GROUPS}
          onChange={setPrecision}
          basis="50%"
          renderValue={(value) => {
            if (value === 'none') return 'None';
            const r = PRECISION_OPTIONS.range.find((o) => o.value === value);
            if (r) return `(Range) ${r.label}`;
            const a = PRECISION_OPTIONS.aggregate.find((o) => o.value === value);
            if (a) return `(Aggregate) ${a.label}`;
            return value;
          }}
        />
      </Box>

      {/* Search + Include Deleted, Included chips, Export / Print / Save left, Groups + Columns right */}
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
                        <Box sx={{ fontSize: 15, lineHeight: 1.2 }}>{SUGGEST_LABELS[s.type] || s.type}</Box>
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {hasGroups && (
              <Button variant="outlined" startIcon={<GroupsIcon />} onClick={toggleAllGroups} sx={SKY_BUTTON_SX}>Groups</Button>
            )}
            <Button variant="outlined" startIcon={<ColumnsIcon />} onClick={(e) => setColumnsAnchorEl(e.currentTarget)} sx={SKY_BUTTON_SX}>Columns</Button>
          </Box>
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
            // Precision mode (reference): a plain single-pick list, the current metric on sky.
            const rowOf = (column, keyPrefix) => {
              const checked = isPicked(column);
              return (
                <Box
                  key={`${keyPrefix}-${column.id}`}
                  onClick={() => { handleColumnToggle(column.id); if (isPrecisionMode) setColumnsAnchorEl(null); }}
                  sx={{ display: 'flex', alignItems: 'center', gap: '10px', px: '16px', height: 56, cursor: 'pointer', fontSize: 16, color: !isPrecisionMode && checked ? '#0284c7' : '#313439', bgcolor: isPrecisionMode && checked ? '#5ebbeb' : 'transparent', '&:hover': { bgcolor: '#5ebbeb', color: '#000' } }}
                >
                  {!isPrecisionMode && (checked ? <CheckBoxIcon sx={{ fontSize: 20 }} /> : <CheckBoxOutlineBlankIcon sx={{ fontSize: 20 }} />)}
                  {column.label}
                </Box>
              );
            };
            if (columnsSearch.trim()) return pickerColumns.filter(matchesSearch).map((c) => rowOf(c, 'find'));
            if (isPrecisionMode) return pickerColumns.map((c) => rowOf(c, 'metric'));
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

      {/* Data table — spinner while loading (same as the Sales / Inventory reports) */}
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
                {reportData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={shownColumns.length + 1} align="center" sx={{ py: 5 }}>
                      <Typography color="text.secondary">{loadError ? 'Report could not be loaded' : 'No data available'}</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  (() => { let stripe = 0; return sortedRows.map((row, index) => {
                    const hasChildren = Array.isArray(row.children);
                    if (!hasChildren) {
                      const shade = stripe++ % 2 === 0 ? '#fff' : ROW_ALT_BG;
                      return (
                        <TableRow key={index} sx={{ ...TABLE_ROW_SX, bgcolor: shade }}>
                          <TableCell>{row.name}</TableCell>
                          {shownColumns.map((column) => (
                            <TableCell key={column.id} align={align(column)}>{renderCell(row, column)}</TableCell>
                          ))}
                        </TableRow>
                      );
                    }
                    stripe = 0;
                    const open = !collapsed[row.name];
                    return (
                      <React.Fragment key={index}>
                        <TableRow sx={{ ...TABLE_ROW_SX, bgcolor: ROW_ALT_BG }}>
                          <TableCell colSpan={shownColumns.length + 1} onClick={() => toggleGroup(row.name)} sx={{ cursor: 'pointer', userSelect: 'none', py: '10px !important' }}>
                            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              {open ? <ExpandMoreIcon sx={{ fontSize: 16 }} /> : <ChevronRightIcon sx={{ fontSize: 16 }} />}
                              {row.name}
                            </Box>
                          </TableCell>
                        </TableRow>
                        {row.children.map((child, childIndex) => {
                          if (child.isTotalRow) {
                            return (
                              <TableRow key={`${index}-t`} sx={{ ...TABLE_ROW_SX, bgcolor: ROW_ALT_BG }}>
                                <TableCell sx={{ fontSize: '13px !important' }}>Totals</TableCell>
                                {shownColumns.map((column) => (
                                  <TableCell key={column.id} align={align(column)}>{cellText(child, column)}</TableCell>
                                ))}
                              </TableRow>
                            );
                          }
                          if (!open) return null;
                          const shade = stripe++ % 2 === 0 ? '#fff' : ROW_ALT_BG;
                          return (
                            <TableRow key={`${index}-child-${childIndex}`} sx={{ ...TABLE_ROW_SX, bgcolor: shade }}>
                              <TableCell sx={{ pl: '14px !important' }}>
                                <Box sx={{ display: 'flex', alignItems: 'stretch', minHeight: 24 }}>
                                  <Box sx={{ width: 14, flexShrink: 0, borderLeft: '2px solid #000', position: 'relative', '&::after': { content: '""', position: 'absolute', top: '50%', left: 0, width: 10, borderTop: '2px solid #000' } }} />
                                  <Box sx={{ pl: '12px', display: 'flex', alignItems: 'center' }}>{child.name}</Box>
                                </Box>
                              </TableCell>
                              {shownColumns.map((column) => (
                                <TableCell key={column.id} align={align(column)}>{renderCell(child, column)}</TableCell>
                              ))}
                            </TableRow>
                          );
                        })}
                      </React.Fragment>
                    );
                  }); })()
                )}
                {reportData.length > 0 && (
                  <TableRow sx={TABLE_TOTAL_SX}>
                    <TableCell></TableCell>
                    {shownColumns.map((column) => (
                      <TableCell key={column.id} align={align(column)}>{totalText(column)}</TableCell>
                    ))}
                  </TableRow>
                )}
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
        reportType="transfer"
        reportPath="/reports/transfer-reports"
        defaultName={`Transfers by ${REPORT_TYPE_LABEL[reportType] || reportType}${groupBy && groupBy !== 'none' ? ` grouped by ${optionLabel(groupByGroups, groupBy)}` : ''}`}
        filters={{
          reportType,
          groupBy,
          consolidate,
          precision,
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

export default TransferReports;
