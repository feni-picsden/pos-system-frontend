import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  IconButton,
  Popover,
  InputAdornment,
} from '@mui/material';
import {
  FileDownload as ExportIcon,
  PrintOutlined as PrintIcon,
  ViewColumn as ColumnsIcon,
  CalendarTodayOutlined as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  ArrowDropDown,
  ArrowDropUp,
  Cancel as ClearIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import useHeaderScope from '../../hooks/useHeaderScope';
import { useGlobalOutlet } from '../../components/Common/GlobalOutletFilter';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';
import inventoryReportService from '../../services/inventoryReportService';
import apiClient from '../../services/apiClient';
import SaveReportDialog from '../../components/Reports/SaveReportDialog';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import { reportPrintTitle } from '../../utils/reportPrint';
import {
  format,
  parse,
  isValid,
  isAfter,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
} from 'date-fns';

// ponytail: reference chrome copied from the measured Shopfront page; the sibling
// pages/Reports/InventoryReport.jsx owns its own copies (parallel parity agents).

// Reference toolbar buttons: flat filled sky, square, invert on hover over 200ms ease.
const TOOLBAR_BUTTON_SX = {
  bgcolor: '#5ebbeb',
  color: '#f8f8f8',
  border: '1px solid #5ebbeb',
  borderRadius: 0,
  boxShadow: 'none',
  height: 53,
  p: '16px',
  fontSize: 16,
  fontWeight: 400,
  textTransform: 'none',
  whiteSpace: 'nowrap',
  transition: 'background 200ms ease, color 200ms ease',
  '&:hover': {
    bgcolor: '#f8f8f8',
    color: '#5ebbeb',
    border: '1px solid #5ebbeb',
    boxShadow: 'none',
  },
};

// Run / Columns row: same colours, 12px radius, 58 tall, bold.
const PILL_BUTTON_SX = {
  ...TOOLBAR_BUTTON_SX,
  borderRadius: '12px',
  height: 58,
  fontWeight: 700,
};

// Parity input outline: #404040 1px, focused #000 2px, radius 8px.
const FIELD_SX = {
  '& .MuiOutlinedInput-root': { borderRadius: '8px', height: 43 },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' },
  '& input::placeholder': { color: '#808080', opacity: 1 },
};

// Data table chrome — identical to components/Reports/ReportTable.jsx.
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

// Reference filter caption sits above its field in small dark text.
const LABEL_SX = { fontSize: 13, color: '#313439', mb: '4px', lineHeight: 1.2 };

// Reference odd-row stripe is a visible grey (same as InventoryReport.jsx).
const ROW_ALT_BG = '#e8e8e8';

// Reference header: ⇕ after every label; `active` = 'asc' | 'desc' fills the
// triangle of the current sort direction (same as InventoryReport.jsx).
const SortIcon = ({ active }) => (
  <svg width="10" height="14" viewBox="0 0 10 14" style={{ marginLeft: 4, verticalAlign: 'middle', display: 'inline-block' }} aria-hidden="true">
    <path d="M1 5.5 L5 1.5 L9 5.5 Z" fill={active === 'asc' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active === 'asc' ? 1.6 : 1.1} strokeLinejoin="round" />
    <path d="M1 8.5 L5 12.5 L9 8.5 Z" fill={active === 'desc' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active === 'desc' ? 1.6 : 1.1} strokeLinejoin="round" />
  </svg>
);

const DATE_FORMAT = 'dd/MM/yyyy';
const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Column picker: title case labels, uppercase table headers. All on by default (reference).
const ALL_COLUMNS = [
  { key: 'name', label: 'Name', headerLabel: 'NAME', align: 'left' },
  { key: 'outlet', label: 'Outlet', headerLabel: 'OUTLET', align: 'left' },
  { key: 'caseQuantity', label: 'Case Quantity', headerLabel: 'CASE QUANTITY' },
  { key: 'caseLevel', label: 'Case Level', headerLabel: 'CASE LEVEL' },
  { key: 'itemLevel', label: 'Item Level', headerLabel: 'ITEM LEVEL' },
  { key: 'totalItems', label: 'Total Items', headerLabel: 'TOTAL ITEMS' },
  // Reference order: both (Ex) costs first, then the inclusive pair.
  { key: 'lastCaseCostEx', label: 'Last Case Cost (Ex)', headerLabel: 'LAST CASE COST (EX)' },
  { key: 'averageCaseCostEx', label: 'Average Case Cost (Ex)', headerLabel: 'AVERAGE CASE COST (EX)' },
  { key: 'lastCaseCost', label: 'Last Case Cost', headerLabel: 'LAST CASE COST' },
  { key: 'averageCaseCost', label: 'Average Case Cost', headerLabel: 'AVERAGE CASE COST' },
  { key: 'stockValueEx', label: 'Stock Value (Ex) (Last)', headerLabel: 'STOCK VALUE (EX) (LAST)' },
  { key: 'stockValueInc', label: 'Stock Value (Inc) (Last)', headerLabel: 'STOCK VALUE (INC) (LAST)' },
  { key: 'stockValueExAvg', label: 'Stock Value (Ex) (Average)', headerLabel: 'STOCK VALUE (EX) (AVERAGE)' },
  { key: 'stockValueIncAvg', label: 'Stock Value (Inc) (Average)', headerLabel: 'STOCK VALUE (INC) (AVERAGE)' },
];

const DEFAULT_VISIBLE_COLUMNS = ALL_COLUMNS.reduce((acc, col) => ({ ...acc, [col.key]: true }), {});

const isCurrencyColumn = (key) => key.includes('Cost') || key.includes('Value');
// Reference: group "Totals" rows and the grand total only carry the four Stock Value
// columns; with Show Products off the table shrinks to Name + these four.
const STOCK_VALUE_KEYS = ['stockValueEx', 'stockValueInc', 'stockValueExAvg', 'stockValueIncAvg'];

// Reference Group By list (Tag, Core Supplier and Last Supplier included).
const GROUP_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'brand', label: 'Brand' },
  { value: 'category', label: 'Category' },
  { value: 'family', label: 'Family' },
  { value: 'tag', label: 'Tag' },
  { value: 'core_supplier', label: 'Core Supplier' },
  { value: 'last_supplier', label: 'Last Supplier' },
];

// Reference money: "-$1.36", never "$-1.36".
const formatCurrency = (value) => {
  const n = Number(value || 0);
  const abs = Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? '-' : ''}$${abs}`;
};

// Reference calendar month: Monday-first, 38px square cells, 12px radius.
const MonthGrid = ({ month, value, maxDate, onPick, onPrev, onNext }) => {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  const today = new Date();

  return (
    <Box sx={{ flex: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '8px' }}>
        {onPrev ? (
          <IconButton size="small" onClick={onPrev} sx={{ color: '#404040' }}>
            <ChevronLeft />
          </IconButton>
        ) : (
          <Box sx={{ width: 34 }} />
        )}
        <Box sx={{ fontSize: 18, fontWeight: 700, color: '#313439' }}>{format(month, 'MMMM yyyy')}</Box>
        {onNext ? (
          <IconButton size="small" onClick={onNext} sx={{ color: '#404040' }}>
            <ChevronRight />
          </IconButton>
        ) : (
          <Box sx={{ width: 34 }} />
        )}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 38px)', justifyContent: 'center' }}>
        {WEEKDAY_LABELS.map((label, index) => (
          <Box
            key={`${label}-${index}`}
            sx={{
              width: 38,
              height: 26,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              color: '#676b72',
            }}
          >
            {label}
          </Box>
        ))}
        {days.map((day) => {
          const outside = !isSameMonth(day, month);
          const disabled = maxDate ? isAfter(startOfDay(day), startOfDay(maxDate)) : false;
          const selected = value ? isSameDay(day, value) : false;
          const isToday = isSameDay(day, today);
          return (
            <Box
              key={day.toISOString()}
              onClick={() => !disabled && onPick(day)}
              sx={{
                width: 38,
                height: 38,
                boxSizing: 'border-box',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 700,
                cursor: disabled ? 'default' : 'pointer',
                opacity: outside || disabled ? 0.5 : 1,
                color: selected ? '#f8f8f8' : '#3898de',
                bgcolor: selected ? '#5ebbeb' : 'transparent',
                border: isToday && !selected ? '1px solid #3898de' : '1px solid transparent',
                transition: 'background 200ms ease, color 200ms ease',
                '&:hover': disabled || selected ? {} : { bgcolor: '#f8f8f8' },
              }}
            >
              {format(day, 'd')}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

const InventoryAtDate = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getOutletId } = useAuth();
  const { notify } = useAppDialogs();
  const { globalMode, outlets: headerOutlets } = useGlobalOutlet();
  const { headerOutletId, showOutletFilter } = useHeaderScope();

  // Filter states — reference starts with an EMPTY date and nothing run.
  const [selectedDate, setSelectedDate] = useState(null);
  const [dateText, setDateText] = useState('');
  const [groupBy, setGroupBy] = useState('none');
  const [outletId, setOutletId] = useState(null);
  const [showZeroInventory, setShowZeroInventory] = useState(true);
  const [showProducts, setShowProducts] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [outlets, setOutlets] = useState([]);

  // Data states
  const [reportData, setReportData] = useState([]);
  const [reportTotals, setReportTotals] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  // Column visibility — reference has every column enabled.
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_COLUMNS);

  // UI states
  const [calendarAnchorEl, setCalendarAnchorEl] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(new Date()));
  const [columnsAnchorEl, setColumnsAnchorEl] = useState(null);
  const [columnsChipsExpanded, setColumnsChipsExpanded] = useState(false);
  const [columnsSearch, setColumnsSearch] = useState('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Header rule (16/10/2026): in-page Outlet filter hidden when a header outlet is selected.
  useEffect(() => {
    if (!showOutletFilter && outletId) setOutletId(null);
  }, [showOutletFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadOutlets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reference: the Outlet list shows EVERY outlet the account is assigned to —
  // Reporting Access is not a filter here; picking an outlet without it answers the
  // red toast on Run (/auth/report-outlets `assigned`; a pure global admin with no
  // assignments gets every outlet).
  const loadOutlets = async () => {
    try {
      const res = await apiClient.get('/auth/report-outlets');
      const outletsList = Array.isArray(res?.data?.assigned) && res.data.assigned.length
        ? res.data.assigned
        : (Array.isArray(res?.data?.outlets) ? res.data.outlets : []);
      setOutlets(outletsList);
      if (outletsList.length > 0 && !outletId) {
        const current = getOutletId();
        setOutletId(outletsList.some((o) => o.id === current) ? current : outletsList[0].id);
      }
    } catch (error) {
      console.error('Error loading outlets:', error);
      setOutlets([]);
    }
  };

  // Favourite reports open this page with the saved filters in the query string.
  useEffect(() => {
    const savedDate = searchParams.get('date');
    if (!savedDate) return;
    const parsed = new Date(savedDate);
    if (!isValid(parsed)) return;
    setSelectedDate(startOfDay(parsed));
    setDateText(format(parsed, DATE_FORMAT));
    setCalendarMonth(startOfMonth(parsed));
    const savedGroupBy = searchParams.get('groupBy');
    // Favourites saved before the supplier split stored "supplier" (= core supplier).
    if (savedGroupBy) setGroupBy(savedGroupBy === 'supplier' ? 'core_supplier' : savedGroupBy);
    const savedZero = searchParams.get('showZeroInventory');
    if (savedZero !== null) setShowZeroInventory(savedZero !== 'false');
  }, [searchParams]);

  const pickDate = (date) => {
    setSelectedDate(startOfDay(date));
    setDateText(format(date, DATE_FORMAT));
    setCalendarMonth(startOfMonth(date));
    setHasRun(false);
    setCalendarAnchorEl(null);
  };

  // Typed dd/mm/yyyy input — only commits once the text is a real, non-future date.
  const handleDateTextChange = (text) => {
    setDateText(text);
    setHasRun(false);
    if (!text) {
      setSelectedDate(null);
      return;
    }
    // Reference accepts any date here; Run is what refuses today / the future.
    const parsed = parse(text, DATE_FORMAT, new Date());
    if (isValid(parsed)) {
      setSelectedDate(startOfDay(parsed));
      setCalendarMonth(startOfMonth(parsed));
    }
  };

  const handleRun = async () => {
    if (!selectedDate) {
      return;
    }
    // Reference: "Inventory reports must be run for a date prior to today" (red toast).
    if (!isAfter(startOfDay(new Date()), startOfDay(selectedDate))) {
      notify?.('Inventory reports must be run for a date prior to today', 'error', { position: 'top' });
      return;
    }

    setLoading(true);
    setHasRun(true);
    try {
      const filters = {
        date: format(selectedDate, 'yyyy-MM-dd'),
        groupBy,
        searchTerm,
        showZeroInventory: showZeroInventory.toString(),
        outletId: outletId || getOutletId(),
      };

      const response = await inventoryReportService.getInventoryAtDate(filters);

      if (response.success) {
        setReportData(response.data || []);
        setReportTotals(response.totals || null);
        setCollapsedGroups({});
      } else {
        console.error('Failed to load inventory at date report:', response);
        setReportData([]);
        setReportTotals(null);
      }
    } catch (error) {
      console.error('Error loading inventory at date report:', error);
      console.error('Error details:', error.response?.data || error.message);
      setReportData([]);
      setReportTotals(null);
      // Reference: an outlet without Reporting Access answers a red toast and the
      // page stays as it was before Run.
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to load the report';
      notify?.(message, 'error', { position: 'top' });
      setHasRun(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    setSortConfig(prevConfig => {
      if (prevConfig.key === key) {
        return {
          key,
          direction: prevConfig.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return { key, direction: 'asc' };
    });
  };

  const isGrouped = groupBy !== 'none';
  const searchLower = searchTerm.trim().toLowerCase();
  const matchesSearch = (row) => !searchLower || String(row.name || '').toLowerCase().includes(searchLower);

  const sortRows = React.useCallback((rows) => {
    if (!sortConfig.key) return rows;
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      if (typeof aValue === 'number' && typeof bValue === 'number') return (aValue - bValue) * dir;
      return String(aValue || '').localeCompare(String(bValue || ''), undefined, { sensitivity: 'base' }) * dir;
    });
  }, [sortConfig]);

  // Reference layout: group header (chevron, collapsible) → product rows (tree line)
  // → grey "Totals" row with the four Stock Value sums; Show Products off keeps
  // the header + Totals rows only. Search narrows the product rows live.
  const displayRows = React.useMemo(() => {
    if (!isGrouped) return sortRows(reportData.filter(matchesSearch)).map((r) => ({ ...r, kind: 'product' }));
    const rows = [];
    reportData.forEach((group) => {
      const children = sortRows((group.children || []).filter(matchesSearch));
      if (searchLower && children.length === 0) return;
      const collapsed = Boolean(collapsedGroups[group.name]);
      rows.push({ kind: 'group', name: group.name, collapsed });
      if (showProducts && !collapsed) children.forEach((c) => rows.push({ ...c, kind: 'product', isChild: true }));
      const totalsRow = { kind: 'groupTotal', name: 'Totals' };
      STOCK_VALUE_KEYS.forEach((k) => { totalsRow[k] = children.reduce((s, c) => s + (Number(c[k]) || 0), 0); });
      rows.push(totalsRow);
    });
    return rows;
  }, [reportData, isGrouped, sortRows, searchLower, collapsedGroups, showProducts]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleGroup = (name) => setCollapsedGroups((prev) => ({ ...prev, [name]: !prev[name] }));

  // Show Products off → Name + the four Stock Value columns only (reference).
  const activeColumns = ALL_COLUMNS.filter((col) => visibleColumns[col.key]
    && (showProducts || !isGrouped || col.key === 'name' || STOCK_VALUE_KEYS.includes(col.key)));

  const cellValue = (row, col) => {
    if (col.key === 'name') return row.name || '';
    if (row.kind === 'group') return '';
    if (row.kind === 'groupTotal') return STOCK_VALUE_KEYS.includes(col.key) ? formatCurrency(row[col.key]) : '';
    if (col.key === 'outlet') return row.outlet || '';
    const value = row[col.key];
    return isCurrencyColumn(col.key) ? formatCurrency(value) : (value || 0);
  };

  // Grand total: each product once (a multi-tag product sits in several groups);
  // with a search only the matching products count.
  const totals = React.useMemo(() => {
    if (!searchLower && reportTotals) return reportTotals;
    const seen = new Set();
    const out = Object.fromEntries(STOCK_VALUE_KEYS.map((k) => [k, 0]));
    const take = (p) => {
      if (!matchesSearch(p)) return;
      const id = p.productId ?? p.name;
      if (seen.has(id)) return;
      seen.add(id);
      STOCK_VALUE_KEYS.forEach((k) => { out[k] += Number(p[k]) || 0; });
    };
    reportData.forEach((row) => (row.children ? row.children.forEach(take) : take(row)));
    return out;
  }, [reportData, reportTotals, searchLower]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredFlatData = displayRows;

  const totalsCells = (col) => (STOCK_VALUE_KEYS.includes(col.key) ? formatCurrency(totals[col.key] || 0) : '');

  const exportToCSV = () => {
    const headers = activeColumns.map(col => col.headerLabel);
    const csvContent = [
      headers.join(','),
      ...filteredFlatData.map(row =>
        activeColumns.map(col => {
          const value = cellValue(row, col);
          return typeof value === 'string' ? `"${value}"` : value;
        }).join(',')
      ),
      activeColumns.map((col) => `"${totalsCells(col)}"`).join(','),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inventory-at-date-${selectedDate ? format(selectedDate, 'yyyy-MM-dd') : 'all'}.csv`;
    link.click();
  };

  // Reference Print: a NEW TAB holding the print page (store name / "Inventory At
  // Date" / date, ruled table, grey stripes, bold group names) which then opens the
  // browser's print dialog.
  const handlePrint = () => {
    const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const dateLabel = selectedDate ? format(selectedDate, DATE_FORMAT) : '';
    const outletList = headerOutlets?.length ? headerOutlets : outlets;
    const title = reportPrintTitle(outletList, globalMode && !outletId, outletId || headerOutletId);
    const alignOf = (col) => (col.align === 'left' ? 'left' : 'center');
    const head = activeColumns.map((col) => `<th style="text-align:${alignOf(col)}">${esc(col.label)}</th>`).join('');
    let stripe = 0;
    const body = filteredFlatData.map((row) => {
      if (row.kind === 'group') { stripe = 0; return `<tr class="grp"><td colspan="${activeColumns.length}">${esc(row.name)}</td></tr>`; }
      if (row.kind === 'groupTotal') return `<tr class="gt">${activeColumns.map((col) => `<td style="text-align:${alignOf(col)}">${esc(cellValue(row, col))}</td>`).join('')}</tr>`;
      const cls = stripe++ % 2 === 0 ? 'odd' : 'even';
      return `<tr class="${cls}">${activeColumns.map((col) => `<td style="text-align:${alignOf(col)}">${esc(cellValue(row, col))}</td>`).join('')}</tr>`;
    }).join('');
    const tot = filteredFlatData.length ? `<tr class="total">${activeColumns.map((col) => `<td style="text-align:${alignOf(col)}">${esc(totalsCells(col))}</td>`).join('')}</tr>` : '';
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Inventory At Date</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 16px 24px; }
        h1 { text-align: center; font-size: 22px; margin: 24px 0 12px; }
        h2 { text-align: center; font-size: 15px; margin: 0 0 8px; }
        .d { text-align: center; font-size: 12px; margin: 0 0 14px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        thead th { border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 6px 4px; font-weight: 700; }
        td { padding: 5px 4px; white-space: nowrap; }
        tr.odd td { background: #e8e8e8; }
        tr.grp td { font-weight: 700; font-size: 13px; padding: 8px 4px 4px; }
        tr.gt td { font-size: 11px; background: #f2f2f2; }
        tr.total td { border-top: 2px solid #000; border-bottom: 2px solid #000; font-weight: 700; }
        tr { page-break-inside: avoid; }
        @page { margin: 12mm; }
      </style></head><body>
      <h1>${esc(title)}</h1><h2>Inventory At Date</h2><div class="d">${esc(dateLabel)}</div>
      <table><thead><tr>${head}</tr></thead><tbody>${body}${tot}</tbody></table>
      <script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 150); });</script>
      </body></html>`;
    const win = window.open('', '_blank');
    if (!win) { notify?.('Please allow pop-ups to print this report', 'error', { position: 'top' }); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  const toggleColumn = (key) => {
    setVisibleColumns(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const selectedColumns = ALL_COLUMNS.filter(col => visibleColumns[col.key]);
  const shownChips = columnsChipsExpanded ? selectedColumns : selectedColumns.slice(0, 2);
  const remainingChips = selectedColumns.length - shownChips.length;
  const pickerColumns = ALL_COLUMNS.filter((c) => !columnsSearch.trim() || c.label.toLowerCase().includes(columnsSearch.trim().toLowerCase()));

  return (
    <Box sx={{ p: '16px' }}>
      {/* Toolbar — reference has no page heading; the buttons are the first row */}
      <Box sx={{ display: 'flex', gap: '16px', flexWrap: 'wrap', mb: '32px' }}>
        <Button startIcon={<ExportIcon />} onClick={exportToCSV} sx={{ ...TOOLBAR_BUTTON_SX, minWidth: 142 }}>
          Export CSV
        </Button>
        <Button startIcon={<PrintIcon />} onClick={handlePrint} sx={{ ...TOOLBAR_BUTTON_SX, minWidth: 95 }}>
          Print
        </Button>
        {/* Reference toolbar has no Save here (favourites come from the email flow) — hidden, not removed */}
      </Box>

      {/* Filters — flat on the page background, no card */}
      <Box sx={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap', mb: '24px' }}>
        <Box sx={{ flex: '1 1 300px' }}>
          <Typography sx={LABEL_SX}>Date (inclusive)</Typography>
          <TextField
            placeholder="DD/MM/YYYY"
            value={dateText}
            fullWidth
            onChange={(e) => handleDateTextChange(e.target.value)}
            onClick={(e) => {
              setCalendarAnchorEl(e.currentTarget);
              setColumnsChipsExpanded(false);
            }}
            sx={FIELD_SX}
          />
        </Box>
        <Box sx={{ flex: '1 1 300px' }}>
          <Typography sx={LABEL_SX}>Group By</Typography>
          <FormControl fullWidth sx={FIELD_SX}>
            <Select
              value={groupBy}
              onChange={(e) => {
                setGroupBy(e.target.value);
                if (e.target.value === 'none') setShowProducts(true);
              }}
              sx={{ height: 43 }}
            >
              {GROUP_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
        {/* Header rule (16/10/2026): hidden when a header outlet is selected, not removed */}
        {showOutletFilter && outlets.length > 0 && (
          <Box sx={{ flex: '1 1 300px' }}>
            <Typography sx={LABEL_SX}>Outlet</Typography>
            <FormControl fullWidth sx={FIELD_SX}>
              <Select
                value={outletId || ''}
                onChange={(e) => setOutletId(e.target.value)}
                sx={{ height: 43 }}
              >
                {outlets.map((outlet) => (
                  <MenuItem key={outlet.id} value={outlet.id}>
                    {outlet.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}
        <Box sx={{ flex: '1 1 160px' }}>
          <Typography sx={LABEL_SX}>Show Zero Inventory</Typography>
          <ShopfrontSwitch
            checked={showZeroInventory}
            onChange={(e) => setShowZeroInventory(e.target.checked)}
          />
        </Box>
        {/* Reference: the toggle only exists once a Group By is picked */}
        {groupBy !== 'none' && (
          <Box sx={{ flex: '1 1 160px' }}>
            <Typography sx={LABEL_SX}>Show Products</Typography>
            <ShopfrontSwitch
              checked={showProducts}
              onChange={(e) => setShowProducts(e.target.checked)}
            />
          </Box>
        )}
      </Box>

      {/* Date picker popover — two months, Monday first, manual entry + Current Day */}
      <Popover
        open={Boolean(calendarAnchorEl)}
        anchorEl={calendarAnchorEl}
        onClose={() => setCalendarAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transitionDuration={0}
        slotProps={{
          paper: {
            sx: {
              width: 622,
              boxSizing: 'border-box',
              p: '16px',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px', mb: '16px' }}>
          <CalendarIcon sx={{ color: '#404040' }} />
          <TextField
            placeholder="dd/mm/yyyy"
            value={dateText}
            onChange={(e) => handleDateTextChange(e.target.value)}
            sx={{ ...FIELD_SX, flex: 1 }}
          />
          <Button
            onClick={() => pickDate(new Date())}
            sx={{
              color: '#6f6f6f',
              fontSize: 16,
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: '12px',
              transition: 'background 200ms ease, color 200ms ease',
              '&:hover': { bgcolor: '#f8f8f8' },
            }}
          >
            Current Day
          </Button>
        </Box>
        <Box sx={{ display: 'flex', gap: '16px' }}>
          {/* Reference calendar lets any day be picked; Run answers the toast for today/future */}
          <MonthGrid
            month={calendarMonth}
            value={selectedDate}
            maxDate={null}
            onPick={pickDate}
            onPrev={() => setCalendarMonth(subMonths(calendarMonth, 1))}
          />
          <MonthGrid
            month={addMonths(calendarMonth, 1)}
            value={selectedDate}
            maxDate={null}
            onPick={pickDate}
            onNext={() => setCalendarMonth(addMonths(calendarMonth, 1))}
          />
        </Box>
      </Popover>

      {/* Run + Columns row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '16px', mb: '16px' }}>
        <Button
          onClick={handleRun}
          disabled={!selectedDate}
          sx={{
            ...PILL_BUTTON_SX,
            minWidth: 125,
            '&.Mui-disabled': { bgcolor: '#404040', color: '#737373', border: '1px solid #404040' },
          }}
        >
          Run
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          startIcon={<ColumnsIcon />}
          // Reference: the picker only opens once a report has been run.
          onClick={(e) => hasRun && setColumnsAnchorEl(e.currentTarget)}
          sx={{ ...PILL_BUTTON_SX, minWidth: 125 }}
        >
          Columns
        </Button>
      </Box>

      {!hasRun && (
        <Typography sx={{ fontSize: 16, color: '#676b72', mb: '16px' }}>
          Please select a previous date and press run.
        </Typography>
      )}

      {/* Search — reference only shows it after the report has been run */}
      {hasRun && reportData.some(row => row.costHistoryComplete === false
        || row.children?.some(child => child.costHistoryComplete === false)) && (
        <Typography sx={{ color: '#8a5700', mb: '16px' }}>
          Some historical average costs are estimated because opening stock or earlier stock adjustments are missing.
        </Typography>
      )}
      {hasRun && (
        <TextField
          fullWidth
          placeholder="Search Products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ ...FIELD_SX, mb: '16px' }}
          InputProps={{
            endAdornment: searchTerm ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchTerm('')} sx={{ color: '#404040' }}>
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
      )}

      {/* Columns popover — caret, chip summary, scrollable checkbox list */}
      {/* Columns picker — same as the Inventory Report: selected chips + "N More..." in an
          outlined box (click to expand, type to search), a bordered scrolling checkbox list. */}
      <Popover
        anchorEl={columnsAnchorEl}
        open={Boolean(columnsAnchorEl)}
        onClose={() => { setColumnsAnchorEl(null); setColumnsChipsExpanded(false); setColumnsSearch(''); }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 544, mt: '6px', p: '16px', borderRadius: '8px', border: '1px solid #404040', boxShadow: '0 6px 18px rgba(0,0,0,0.18)' } }}
      >
        <Box onClick={() => setColumnsChipsExpanded((v) => !v)} sx={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', border: '1px solid #404040', borderRadius: '8px', px: '12px', py: '8px', mb: '12px', cursor: 'pointer', minHeight: 44 }}>
          {shownChips.map((c) => (
            <Box key={c.key} sx={{ bgcolor: '#e8e8e8', borderRadius: '4px', px: '8px', py: '2px', fontSize: 16, color: '#313439' }}>{c.label}</Box>
          ))}
          {remainingChips > 0 && <Box sx={{ bgcolor: '#e8e8e8', borderRadius: '4px', px: '8px', py: '2px', fontSize: 16, color: '#313439' }}>{remainingChips} More...</Box>}
          <Box component="input" value={columnsSearch} onClick={(e) => e.stopPropagation()} onChange={(e) => setColumnsSearch(e.target.value)} placeholder="" sx={{ flex: 1, minWidth: 60, border: 'none', outline: 'none', bgcolor: 'transparent', fontSize: 16, color: '#313439', fontFamily: 'inherit' }} />
          <Box sx={{ ml: 'auto', display: 'inline-flex', color: '#313439' }}>{columnsChipsExpanded ? <ArrowDropDown /> : <ArrowDropUp />}</Box>
        </Box>
        <Box sx={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #404040', borderRadius: '8px' }}>
          {pickerColumns.length === 0 && (
            <Box sx={{ px: '16px', height: 56, display: 'flex', alignItems: 'center', fontSize: 16, color: '#757575' }}>No Options</Box>
          )}
          {pickerColumns.map((column) => {
            const checked = Boolean(visibleColumns[column.key]);
            return (
              <Box
                key={column.key}
                onClick={() => toggleColumn(column.key)}
                sx={{ display: 'flex', alignItems: 'center', gap: '10px', px: '16px', height: 56, cursor: 'pointer', fontSize: 16, color: checked ? '#0284c7' : '#313439', '&:hover': { bgcolor: '#5ebbeb', color: '#000' } }}
              >
                {checked ? <CheckBoxIcon sx={{ fontSize: 20 }} /> : <CheckBoxOutlineBlankIcon sx={{ fontSize: 20 }} />}
                {column.label}
              </Box>
            );
          })}
        </Box>
      </Popover>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : hasRun && filteredFlatData.length > 0 ? (
        // Same chrome as the Inventory Report: table scrolls inside the page, header and
        // NAME column pinned, total row pinned at the bottom.
        <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 0, maxHeight: 'calc(100vh - 300px)', overflow: 'auto' }}>
          <Table size="small" stickyHeader sx={{ width: '100%', '& .MuiTableCell-stickyHeader': { backgroundColor: '#5ebbeb' }, '& th': { cursor: 'pointer', userSelect: 'none' }, '& td:first-of-type': { position: 'sticky', left: 0, zIndex: 1, bgcolor: 'inherit' } }}>
            <TableHead>
              <TableRow sx={TABLE_HEAD_SX}>
                {activeColumns.map((column, i) => (
                  <TableCell
                    key={column.key}
                    align={column.align || 'center'}
                    onClick={() => handleSort(column.key)}
                    sx={i === 0 ? { position: 'sticky', left: 0, zIndex: 3 } : undefined}
                  >
                    {column.headerLabel}<SortIcon active={sortConfig.key === column.key ? sortConfig.direction : null} />
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {(() => { let stripe = 0; return filteredFlatData.map((row, index) => {
                if (row.kind === 'group') {
                  // Reference group: ▽ header (grey, click collapses), ├─ children, grey "Totals" row.
                  stripe = 0;
                  return (
                    <TableRow key={`g-${index}`} sx={{ ...TABLE_ROW_SX, bgcolor: ROW_ALT_BG }}>
                      <TableCell colSpan={activeColumns.length} onClick={() => toggleGroup(row.name)} sx={{ cursor: 'pointer', userSelect: 'none', py: '10px !important' }}>
                        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {row.collapsed ? <ChevronRightIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
                          {row.name}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                }
                if (row.kind === 'groupTotal') {
                  return (
                    <TableRow key={`t-${index}`} sx={{ ...TABLE_ROW_SX, bgcolor: ROW_ALT_BG }}>
                      {activeColumns.map((column) => (
                        <TableCell key={column.key} align={column.align || 'center'} sx={column.key === 'name' ? { fontSize: '13px !important' } : undefined}>{cellValue(row, column)}</TableCell>
                      ))}
                    </TableRow>
                  );
                }
                const shade = stripe++ % 2 === 0 ? '#fff' : ROW_ALT_BG;
                return (
                  <TableRow key={`p-${index}`} sx={{ ...TABLE_ROW_SX, bgcolor: shade }}>
                    {activeColumns.map((column) => (
                      column.key === 'name' && row.isChild ? (
                        <TableCell key={column.key} sx={{ pl: '14px !important' }}>
                          <Box sx={{ display: 'flex', alignItems: 'stretch', minHeight: 24 }}>
                            <Box sx={{ width: 14, flexShrink: 0, borderLeft: '2px solid #000', position: 'relative', '&::after': { content: '""', position: 'absolute', top: '50%', left: 0, width: 10, borderTop: '2px solid #000' } }} />
                            <Box sx={{ pl: '12px', display: 'flex', alignItems: 'center' }}>{row.name}</Box>
                          </Box>
                        </TableCell>
                      ) : (
                        <TableCell key={column.key} align={column.align || 'center'}>{cellValue(row, column)}</TableCell>
                      )
                    ))}
                  </TableRow>
                );
              }); })()}
              <TableRow sx={TABLE_TOTAL_SX}>
                {activeColumns.map((column) => (
                  <TableCell key={column.key} align={column.align || 'center'}>
                    {totalsCells(column)}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      ) : hasRun ? (
        <Typography sx={{ fontSize: 16, color: '#676b72', p: '16px' }}>
          No inventory data found for the selected date.
        </Typography>
      ) : null}

      <SaveReportDialog
        open={saveDialogOpen}
        onClose={(saved) => {
          setSaveDialogOpen(false);
          // Documented flow: saving redirects to Favourite Reports for the email settings.
          if (saved) navigate('/reports/favourite');
        }}
        reportType="inventory-at-date"
        reportPath="/reports/inventory-at-date"
        filters={{
          date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '',
          groupBy,
          showZeroInventory: showZeroInventory.toString(),
          outletId: outletId || getOutletId(),
        }}
      />
    </Box>
  );
};

export default InventoryAtDate;
