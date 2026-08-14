import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  FormControl,
  Select,
  MenuItem,
  TextField,
  FormControlLabel,
  Checkbox,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Menu,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  FileDownload as DownloadIcon,
  PrintOutlined as PrintIcon,
  SaveOutlined as SaveIcon,
  ViewColumn as ColumnsIcon,
  EditOutlined as EditIcon,
  HelpOutline as HelpIcon,
  PictureAsPdf as PdfIcon,
  Description as CsvIcon,
  TableChart as XlsxIcon,
  Code as JsonIcon,
  ArrowDropDown,
  ArrowDropUp,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format as formatDate } from 'date-fns';
import DateRangePicker from '../../components/Common/DateRangePicker';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import SaveReportDialog from '../../components/Reports/SaveReportDialog';
import transferReportService from '../../services/transferReportService';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import * as XLSX from 'xlsx';
const { jsPDF } = await import('jspdf');
import autoTable from 'jspdf-autotable';

// Shopfront reference has no transitions/ripple.
const INSTANT = 'all 0s ease';

// Sky-outlined toolbar buttons (Export / Print / Save / Columns).
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

// Parity input/select outline: #404040 1px, focused #000 2px, radius 8px.
const FIELD_SX = {
  '& .MuiOutlinedInput-root': { borderRadius: '8px' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' },
  '& input::placeholder, & textarea::placeholder': { color: '#808080', opacity: 1 },
};

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

// Date and Time uses the same flush slate block (DateRangePicker's outlined TextField).
const FILTER_DATE_SX = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: '#676b72',
    borderRadius: 0,
    height: 80,
    color: '#f8f8f8',
    fontSize: '22.4px',
    alignItems: 'flex-end',
    padding: '0 40px 14px 16px',
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

// Reporting Query Language keywords/constants — highlighted like the reference query bar.
const SQL_KEYWORDS = new Set([
  'SELECT', 'FROM', 'RANGE', 'AGGREGATE', 'BY', 'GROUP', 'ON', 'WHERE', 'START', 'END', 'ORDER',
  'CONSOLIDATED', 'UNCONSOLIDATED', 'LIMIT', 'OFFSET', 'AS', 'TOTAL', 'AND', 'OR', 'IS',
  'NOT', 'NULL', 'LIKE', 'ASC', 'DESC', 'ASCENDING', 'DESCENDING', 'INCLUDE', 'EXCLUDE',
  'ONLY', 'DELETED', 'BY_NAME', 'TODAY', 'ALL_OF_TIME', 'CURRENT_TIMESTAMP',
]);

// keywords #0077aa, quoted strings #669900, punctuation #999999, identifiers #000000
const highlightSQL = (sql) =>
  sql
    .split(/("[^"]*"|'[^']*'|[A-Za-z_][A-Za-z0-9_]*|[^\sA-Za-z0-9_"']+)/g)
    .filter(Boolean)
    .map((token, i) => {
      let color;
      if (/^["']/.test(token)) color = '#669900';
      else if (/^[A-Za-z_]/.test(token)) color = SQL_KEYWORDS.has(token.toUpperCase()) ? '#0077aa' : '#000000';
      else if (!/^\s+$/.test(token)) color = '#999999';
      return (
        <span key={i} style={color ? { color } : undefined}>
          {token}
        </span>
      );
    });

// Reference filter: slate trigger block with an INLINE panel pushed below it
// (absolute, top 100%, full width, flat #f8f8f8, no shadow, instant).
const ShopfrontFilter = ({ label, value, groups, onChange, renderValue }) => {
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
    <Box sx={{ position: 'relative', flex: '0 1 33.333%', minWidth: 240 }} ref={ref}>
      <Box onClick={() => setOpen((o) => !o)} sx={FILTER_BLOCK_SX}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ fontSize: 16, fontWeight: 400, lineHeight: 1.25 }}>{label}</Box>
          <Box
            sx={{
              fontSize: '1.4em',
              fontWeight: 400,
              lineHeight: 1.25,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
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
            left: 0,
            width: '100%',
            zIndex: 8,
            boxSizing: 'border-box',
            bgcolor: '#f8f8f8',
            borderRadius: 0,
            boxShadow: 'none',
            borderBottom: '1px solid #313439',
            p: '8px 8px 8px 0',
          }}
        >
          {groups.map((group, gi) => (
            <Box key={group.label || `g${gi}`}>
              {group.label && (
                <Box sx={{ fontWeight: 700, fontSize: '19.2px', lineHeight: '23px', color: '#313439', pl: '16px' }}>
                  {group.label}
                </Box>
              )}
              <Box sx={{ pl: '16px' }}>
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
                      p: '4px',
                      cursor: 'pointer',
                      bgcolor: option.value === value ? '#5ebbeb' : 'transparent',
                      color: option.value === value ? '#f8f8f8' : '#313439',
                      transition: 'background 0.1s ease, color 0.1s ease',
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

const getLastCompletedMonthRange = (amountMonths = 1) => {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() - amountMonths, 1);
  const start = new Date(target.getFullYear(), target.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(target.getFullYear(), target.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
};

const toNumber = (value) => {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
};

const formatMoney = (value) => `$${toNumber(value).toFixed(2)}`;
const formatQty = (value) => toNumber(value).toLocaleString();

// General / Classification report focuses (shared by Report Type + Group By).
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

// All selectable data columns (Name is always shown). Column-chooser toggles these.
// `expr` is the Reporting Query Language expression shown in the query bar.
const ALL_COLUMNS = [
  { key: 'cost', label: 'Cost', header: 'COST', expr: 'cost', money: true, render: (r) => formatMoney(r.cost) },
  { key: 'taxAmount', label: 'Tax Amount', header: 'TAX AMOUNT', expr: 'tax', money: true, render: (r) => formatMoney(r.taxAmount) },
  { key: 'totalQuantity', label: 'Total Quantity', header: 'TOTAL QUANTITY', expr: 'quantity', render: (r) => formatQty(r.totalQuantity) },
  { key: 'receivedCases', label: 'Calculated Cases Received', header: 'CALCULATED CASES RECEIVED', expr: 'received_cases', render: (r) => formatQty(r.receivedCases) },
  { key: 'receivedItems', label: 'Calculated Items Received', header: 'CALCULATED ITEMS RECEIVED', expr: 'received_items', render: (r) => formatQty(r.receivedItems) },
  { key: 'transferredCases', label: 'Calculated Cases Transferred', header: 'CALCULATED CASES TRANSFERRED', expr: 'transferred_cases', render: (r) => formatQty(r.transferredCases) },
  { key: 'transferredItems', label: 'Calculated Items Transferred', header: 'CALCULATED ITEMS TRANSFERRED', expr: 'transferred_items', render: (r) => formatQty(r.transferredItems) },
];

// Precision option lists (shared by the filter panel and its collapsed value).
const PRECISION_RANGE = [
  { value: 'range-date', label: 'Date' },
  { value: 'range-week', label: 'Week' },
  { value: 'range-month', label: 'Month' },
  { value: 'range-quarter', label: 'Quarter' },
  { value: 'range-year', label: 'Year' },
];
const PRECISION_AGGREGATE = [
  { value: 'aggregate-date', label: 'Date' },
  { value: 'aggregate-day', label: 'Day' },
  { value: 'aggregate-week', label: 'Week' },
  { value: 'aggregate-month', label: 'Month' },
  { value: 'aggregate-month-date', label: 'Month Date' },
  { value: 'aggregate-quarter', label: 'Quarter' },
];

const aggregateTransferRows = (rows, reportType) => {
  const map = new Map();

  const addToBucket = (name, row) => {
    const key = (name || 'Unspecified').trim() || 'Unspecified';
    if (!map.has(key)) {
      map.set(key, {
        name: key,
        cost: 0,
        taxAmount: 0,
        totalQuantity: 0,
        receivedCases: 0,
        receivedItems: 0,
        transferredCases: 0,
        transferredItems: 0,
      });
    }
    const bucket = map.get(key);
    const cases = toNumber(row.cases);
    const items = toNumber(row.items);
    const quantity = toNumber(row.quantity);
    const caseQty = toNumber(row.caseQuantity) || 1;
    const calculatedCases = cases > 0 ? cases : Math.floor(quantity / caseQty);
    const calculatedItems = items > 0 ? items : (quantity % caseQty);

    bucket.cost += toNumber(row.total);
    bucket.taxAmount += toNumber(row.taxAmount);
    bucket.totalQuantity += quantity;
    bucket.receivedCases += calculatedCases;
    bucket.receivedItems += calculatedItems;
    bucket.transferredCases += calculatedCases;
    bucket.transferredItems += calculatedItems;
  };

  rows.forEach((row) => {
    if (reportType === 'transferee') return addToBucket(row.transferee, row);
    if (reportType === 'outlet') return addToBucket(row.fromOutlet, row);
    if (reportType === 'product') return addToBucket(row.product, row);
    if (reportType === 'brand') return addToBucket(row.brand, row);
    if (reportType === 'category') return addToBucket(row.category, row);
    if (reportType === 'family') return addToBucket(row.family, row);
    if (reportType === 'tag') {
      const tags = Array.isArray(row.tags) && row.tags.length ? row.tags : ['Unspecified'];
      tags.forEach((tag) => addToBucket(tag, row));
      return;
    }
    addToBucket(row.transferee || row.product || row.fromOutlet || 'Unspecified', row);
  });

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
};

const TransferReports = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedOutletId, isAllOutlets } = useSelectedOutlet();

  const initialRange = useMemo(() => {
    const start = searchParams.get('startDate');
    const end = searchParams.get('endDate');
    if (start || end) {
      const fallback = getLastCompletedMonthRange(1);
      return {
        preset: searchParams.get('dateTime') || 'custom',
        startDate: start ? new Date(start) : fallback.start,
        endDate: end ? new Date(end) : fallback.end,
      };
    }
    return { preset: 'today', startDate: new Date(), endDate: new Date() };
  }, [searchParams]);

  const [dateRange, setDateRange] = useState(initialRange);
  const [transferReportType, setTransferReportType] = useState(
    searchParams.get('reportType') || 'outlet'
  );
  const [groupBy, setGroupBy] = useState(searchParams.get('groupBy') || 'none');
  const [consolidateByReportType, setConsolidateByReportType] = useState(
    (searchParams.get('consolidate') || 'consolidated').toLowerCase()
  );
  const [precision, setPrecision] = useState(searchParams.get('precision') || 'none');
  const [searchTerm, setSearchTerm] = useState(searchParams.get('searchTerm') || '');
  const [includeDeleted, setIncludeDeleted] = useState(searchParams.get('includeDeleted') === 'true');

  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [columnsMenuAnchor, setColumnsMenuAnchor] = useState(null);
  const [customQuery, setCustomQuery] = useState('');
  const [queryEditing, setQueryEditing] = useState(false);
  const [queryManuallyEdited, setQueryManuallyEdited] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportType, setExportType] = useState('pdf');
  const [exportOrientation, setExportOrientation] = useState('portrait');
  const [isExporting, setIsExporting] = useState(false);

  // Default visible columns match reference chips ('Cost', 'Tax Amount').
  const [visibleColumns, setVisibleColumns] = useState({
    cost: true,
    taxAmount: true,
    totalQuantity: false,
    receivedCases: false,
    receivedItems: false,
    transferredCases: false,
    transferredItems: false,
  });

  const outletIdForSave = !isAllOutlets && selectedOutletId ? selectedOutletId : null;

  const loadReport = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await transferReportService.getTransferReport({
        startDate: dateRange.startDate ? dateRange.startDate.toISOString() : undefined,
        endDate: dateRange.endDate ? dateRange.endDate.toISOString() : undefined,
        dateTime: dateRange.preset,
        reportType: transferReportType,
        groupBy,
        consolidate: consolidateByReportType,
        precision,
        searchTerm,
        includeDeleted,
      });
      setReportData(response.data || []);
    } catch (err) {
      setLoadError(err.response?.data?.error || 'Failed to load transfer report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, transferReportType, groupBy, consolidateByReportType, precision, includeDeleted]);

  // Search filters with a small debounce (matches SalesReport behaviour).
  useEffect(() => {
    const timer = setTimeout(() => loadReport(), 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // Group By omits the option equal to the active Report Type.
  const groupByGeneral = REPORT_GROUPS.general.filter((o) => o.value !== transferReportType);
  const groupByClassifications = REPORT_GROUPS.classifications.filter((o) => o.value !== transferReportType);

  // Keep Group By valid when it collides with a newly-chosen Report Type.
  useEffect(() => {
    if (groupBy === transferReportType) setGroupBy('none');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transferReportType]);

  // Filter panels (reference groups + order).
  const reportTypeGroups = [
    { label: 'General', items: REPORT_GROUPS.general },
    { label: 'Classifications', items: REPORT_GROUPS.classifications },
  ];
  const groupByGroups = [
    { items: [{ value: 'none', label: 'None' }] },
    ...(groupByGeneral.length ? [{ label: 'General', items: groupByGeneral }] : []),
    ...(groupByClassifications.length ? [{ label: 'Classifications', items: groupByClassifications }] : []),
  ];
  const consolidateGroups = [
    {
      items: [
        { value: 'consolidated', label: 'Consolidated' },
        { value: 'unconsolidated', label: 'Unconsolidated' },
      ],
    },
  ];
  const precisionGroups = [
    { items: [{ value: 'none', label: 'None' }] },
    { label: 'Range', items: PRECISION_RANGE },
    { label: 'Aggregate', items: PRECISION_AGGREGATE },
  ];

  const generateSQLQuery = () => {
    const selected = ALL_COLUMNS.filter((c) => visibleColumns[c.key]);
    const selectList = [
      'BY_NAME AS "Name"',
      ...selected.map((c) => `${c.expr} AS "${c.label}"`),
    ];
    let query = `SELECT\n${selectList.map((s) => `  ${s}`).join(',\n')}\n`;
    query += 'FROM transfers\n';
    if (transferReportType && transferReportType !== 'none') query += `BY ${transferReportType}\n`;
    if (groupBy && groupBy !== 'none') query += `GROUP BY ${groupBy}\n`;
    // An explicit range narrows the query; the default 'Today' needs no START/END.
    if (dateRange.preset !== 'today' && dateRange.startDate && dateRange.endDate) {
      const stamp = (d) => formatDate(d, 'yyyy-MM-dd HH:mm:ss');
      query += `START "${stamp(dateRange.startDate)}" END "${stamp(dateRange.endDate)}"\n`;
    }
    if (searchTerm) query += `WHERE BY_NAME LIKE "%${searchTerm}%"\n`;
    query += 'ORDER "Name" asc\n';
    if (consolidateByReportType === 'consolidated') query += 'CONSOLIDATED';
    return query;
  };

  useEffect(() => {
    if (!queryManuallyEdited) setCustomQuery(generateSQLQuery());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transferReportType, groupBy, consolidateByReportType, precision, searchTerm, dateRange, visibleColumns, queryManuallyEdited]);

  const tableRows = useMemo(
    () => aggregateTransferRows(reportData || [], transferReportType),
    [reportData, transferReportType]
  );
  const activeColumns = ALL_COLUMNS.filter((c) => visibleColumns[c.key]);
  const totals = useMemo(() => {
    return tableRows.reduce(
      (acc, row) => {
        acc.cost += toNumber(row.cost);
        acc.taxAmount += toNumber(row.taxAmount);
        acc.totalQuantity += toNumber(row.totalQuantity);
        acc.receivedCases += toNumber(row.receivedCases);
        acc.receivedItems += toNumber(row.receivedItems);
        acc.transferredCases += toNumber(row.transferredCases);
        acc.transferredItems += toNumber(row.transferredItems);
        return acc;
      },
      { cost: 0, taxAmount: 0, totalQuantity: 0, receivedCases: 0, receivedItems: 0, transferredCases: 0, transferredItems: 0 }
    );
  }, [tableRows]);

  const totalCell = (col) =>
    col.money ? formatMoney(totals[col.key]) : formatQty(totals[col.key]);

  const toggleColumn = (key) => setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));

  const getFileName = () => {
    const now = new Date();
    return `transfer-report-${now.toISOString().split('T')[0]}_${now.toTimeString().split(' ')[0].replace(/:/g, '-')}`;
  };

  const exportRows = () =>
    tableRows.map((row) => [row.name, ...activeColumns.map((c) => c.render(row))]);
  const exportHeaders = ['Name', ...activeColumns.map((c) => c.label)];

  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: exportOrientation === 'portrait' ? 'p' : 'l', unit: 'mm', format: 'a4' });
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Transfer Report', 14, 15);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Report Type: ${transferReportType}`, 14, 25);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
    autoTable(doc, {
      startY: 38,
      head: [exportHeaders],
      body: [...exportRows(), ['Total', ...activeColumns.map((c) => totalCell(c))]],
      theme: 'grid',
      styles: { fontSize: exportOrientation === 'portrait' ? 7 : 8, cellPadding: 2 },
      headStyles: { fillColor: [94, 187, 235], fontStyle: 'bold', halign: 'center' },
    });
    doc.save(`${getFileName()}.pdf`);
  };

  const exportToXLSX = () => {
    const data = [exportHeaders, ...exportRows(), ['Total', ...activeColumns.map((c) => totalCell(c))]];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transfer Report');
    XLSX.writeFile(wb, `${getFileName()}.xlsx`);
  };

  const exportToCSV = () => {
    const rows = [exportHeaders, ...exportRows(), ['Total', ...activeColumns.map((c) => totalCell(c))]];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${getFileName()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportToJSON = () => {
    const payload = {
      metadata: { reportType: transferReportType, groupBy, consolidate: consolidateByReportType, precision, generated: new Date().toISOString() },
      columns: activeColumns.map((c) => c.label),
      data: tableRows,
      totals,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${getFileName()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleConfirmExport = async () => {
    setIsExporting(true);
    try {
      if (exportType === 'pdf') exportToPDF();
      else if (exportType === 'xlsx') exportToXLSX();
      else if (exportType === 'csv') exportToCSV();
      else if (exportType === 'json') exportToJSON();
      setExportDialogOpen(false);
    } catch {
      setLoadError('Error exporting report. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    const headerCells = exportHeaders.map((h) => `<th>${h}</th>`).join('');
    const bodyRows = tableRows
      .map((row) => `<tr><td>${row.name}</td>${activeColumns.map((c) => `<td>${c.render(row)}</td>`).join('')}</tr>`)
      .join('');
    const totalRow = `<tr class="total-row"><td>Total</td>${activeColumns.map((c) => `<td>${totalCell(c)}</td>`).join('')}</tr>`;
    const printContent = `
      <div id="print-content">
        <style>
          @media print { body * { visibility: hidden; } #print-content, #print-content * { visibility: visible; } #print-content { position: absolute; left: 0; top: 0; width: 100%; } }
          #print-content { font-family: Arial, sans-serif; padding: 20px; }
          #print-content h1 { font-size: 22px; margin-bottom: 12px; }
          #print-content table { width: 100%; border-collapse: collapse; }
          #print-content th, #print-content td { padding: 8px; border: 1px solid #ddd; font-size: 11px; text-align: right; }
          #print-content th { background: #5ebbeb; color: #fff; text-align: center; }
          #print-content td:first-child, #print-content th:first-child { text-align: left; }
          #print-content .total-row td { background: #e3f2fd; font-weight: bold; }
        </style>
        <h1>Transfer Report</h1>
        <table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}${totalRow}</tbody></table>
      </div>`;
    const existing = document.getElementById('print-content');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.innerHTML = printContent;
    document.body.appendChild(div);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        const el = document.getElementById('print-content');
        if (el) el.remove();
      }, 100);
    }, 100);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: '8px' }}>
        {/* Query bar — reference has no page heading; the query bar is the first element */}
        <Box
          sx={{
            display: 'flex',
            alignItems: queryEditing ? 'flex-start' : 'center',
            minHeight: 60,
            boxSizing: 'border-box',
            pl: '16px',
            mb: '8px',
            bgcolor: 'rgba(0,0,0,0)',
            border: '1px solid #525252',
            borderRadius: '8px',
            boxShadow: 'none',
            overflow: 'hidden',
          }}
        >
          {queryEditing ? (
            <TextField
              fullWidth
              multiline
              minRows={3}
              value={customQuery}
              onChange={(e) => {
                setCustomQuery(e.target.value);
                setQueryManuallyEdited(true);
              }}
              sx={{
                ...FIELD_SX,
                my: '8px',
                '& textarea': { fontFamily: "'Roboto Mono', monospace", fontSize: 16 },
              }}
            />
          ) : (
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                fontFamily: "'Roboto Mono', monospace",
                fontSize: 16,
                color: '#000000',
              }}
            >
              {highlightSQL(customQuery.replace(/\n/g, ' '))}
            </Box>
          )}
          <Button
            variant="text"
            startIcon={<EditIcon />}
            onClick={() => setQueryEditing((v) => !v)}
            sx={{
              ml: 2,
              my: queryEditing ? '8px' : 0,
              minWidth: 88,
              px: '16px',
              py: '8px',
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
            {queryEditing ? 'Done' : 'Edit'}
          </Button>
        </Box>

        {/* Filters — reference renders flush 80px slate blocks with borders touching */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', mb: '8px' }}>
          <ShopfrontFilter
            label="Report Type"
            value={transferReportType}
            groups={reportTypeGroups}
            onChange={setTransferReportType}
          />

          <ShopfrontFilter
            label="Group By"
            value={groupBy}
            groups={groupByGroups}
            onChange={setGroupBy}
          />

          {/* Reference has no icon button here — the whole card opens the picker and the
              affordance is the same caret as the other filter cards. */}
          <Box sx={{ flex: '0 1 33.333%', minWidth: 240, position: 'relative' }}>
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
            <ArrowDropDown
              sx={{
                position: 'absolute',
                right: 16,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#f8f8f8',
                pointerEvents: 'none',
              }}
            />
          </Box>

          <ShopfrontFilter
            label="Consolidate By Report Type"
            value={consolidateByReportType}
            groups={consolidateGroups}
            onChange={setConsolidateByReportType}
            renderValue={(value) => (value === 'consolidated' ? 'Yes' : 'No')}
          />

          <ShopfrontFilter
            label="Precision"
            value={precision}
            groups={precisionGroups}
            onChange={setPrecision}
            renderValue={(value) => {
              if (value === 'none') return 'None';
              const range = PRECISION_RANGE.find((o) => o.value === value);
              if (range) return `(Range) ${range.label}`;
              const aggregate = PRECISION_AGGREGATE.find((o) => o.value === value);
              if (aggregate) return `(Aggregate) ${aggregate.label}`;
              return value;
            }}
          />
        </Box>

        {/* Search + Action Buttons */}
        <Paper elevation={0} sx={{ p: 2, mb: '8px' }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Search for anything"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ ...FIELD_SX, mb: 2 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => setExportDialogOpen(true)} sx={SKY_BUTTON_SX}>
                Export
              </Button>
              <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint} sx={SKY_BUTTON_SX}>
                Print
              </Button>
              <Button variant="outlined" startIcon={<SaveIcon />} onClick={() => setSaveDialogOpen(true)} sx={SKY_BUTTON_SX} disabled={loading}>
                Save
              </Button>
              <Button variant="outlined" startIcon={<ColumnsIcon />} onClick={(e) => setColumnsMenuAnchor(e.currentTarget)} sx={SKY_BUTTON_SX}>
                Columns
              </Button>
            </Box>
            <FormControlLabel
              sx={{ m: 0 }}
              labelPlacement="start"
              control={
                <ShopfrontSwitch
                  checked={includeDeleted}
                  onChange={(e) => setIncludeDeleted(e.target.checked)}
                  sx={{ ml: 1 }}
                />
              }
              label={<Typography variant="body2">Include Deleted</Typography>}
            />
          </Box>
        </Paper>

        {/* Columns chooser */}
        <Menu
          anchorEl={columnsMenuAnchor}
          open={Boolean(columnsMenuAnchor)}
          onClose={() => setColumnsMenuAnchor(null)}
          PaperProps={{ sx: { maxHeight: 400, width: 320 } }}
        >
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#676b72' }}>Select Columns</Typography>
          </Box>
          <Divider />
          <Box sx={{ px: 1, py: 1 }}>
            {ALL_COLUMNS.map((col) => (
              <MenuItem key={col.key} onClick={() => toggleColumn(col.key)} sx={{ py: 0.5 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={!!visibleColumns[col.key]}
                      size="small"
                      sx={{ color: '#5ebbeb', '&.Mui-checked': { color: '#5ebbeb' } }}
                    />
                  }
                  label={<span style={{ color: visibleColumns[col.key] ? '#5ebbeb' : '#000' }}>{col.label}</span>}
                  sx={{ m: 0, width: '100%' }}
                />
              </MenuItem>
            ))}
          </Box>
        </Menu>

        {loadError && <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert>}

        {/* Report Table */}
        <Paper sx={{ p: 2 }}>
          {['brand', 'category', 'family', 'tag'].includes(transferReportType) && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              This report could contain duplicate data.
            </Typography>
          )}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#5ebbeb' }}>
                    <TableCell sx={{ color: '#f8f8f8', fontWeight: 'bold', fontSize: 16, textTransform: 'uppercase' }}>
                      NAME
                    </TableCell>
                    {activeColumns.map((col) => (
                      <TableCell key={col.key} align="right" sx={{ color: '#f8f8f8', fontWeight: 'bold', fontSize: 16, textTransform: 'uppercase' }}>
                        {col.header}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tableRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={activeColumns.length + 1} align="center">
                        No transfers found for selected range.
                      </TableCell>
                    </TableRow>
                  ) : (
                    tableRows.map((row, idx) => (
                      <TableRow key={`${row.name}-${idx}`} sx={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8f8f8' }}>
                        <TableCell sx={{ fontSize: 16, color: '#000' }}>{row.name}</TableCell>
                        {activeColumns.map((col) => (
                          <TableCell key={col.key} align="right" sx={{ fontSize: 16, color: '#000' }}>
                            {col.render(row)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                  {tableRows.length > 0 && (
                    <TableRow sx={{ backgroundColor: '#e3f2fd' }}>
                      <TableCell sx={{ fontWeight: 700, fontSize: 16 }}>Total</TableCell>
                      {activeColumns.map((col) => (
                        <TableCell key={col.key} align="right" sx={{ fontWeight: 700, fontSize: 16 }}>
                          {totalCell(col)}
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>

        {/* Export Dialog */}
        <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ bgcolor: '#b3e5fc', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <HelpIcon sx={{ color: '#0288d1' }} />
            <Typography variant="h6" sx={{ color: '#0288d1', fontWeight: 600 }}>Export Report</Typography>
          </DialogTitle>
          <DialogContent sx={{ py: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5, color: '#676b72' }}>Export Type</Typography>
            <FormControl fullWidth>
              <Select
                value={exportType}
                onChange={(e) => setExportType(e.target.value)}
                renderValue={(value) => {
                  const icons = {
                    pdf: <PdfIcon sx={{ mr: 1.5, color: '#d32f2f' }} />,
                    xlsx: <XlsxIcon sx={{ mr: 1.5, color: '#2e7d32' }} />,
                    csv: <CsvIcon sx={{ mr: 1.5, color: '#ed6c02' }} />,
                    json: <JsonIcon sx={{ mr: 1.5, color: '#0288d1' }} />,
                  };
                  return (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {icons[value]}
                      <span>{value.toUpperCase()}</span>
                    </Box>
                  );
                }}
              >
                <MenuItem value="pdf"><PdfIcon sx={{ mr: 1.5, color: '#d32f2f' }} />PDF</MenuItem>
                <MenuItem value="xlsx"><XlsxIcon sx={{ mr: 1.5, color: '#2e7d32' }} />XLSX</MenuItem>
                <MenuItem value="csv"><CsvIcon sx={{ mr: 1.5, color: '#ed6c02' }} />CSV</MenuItem>
                <MenuItem value="json"><JsonIcon sx={{ mr: 1.5, color: '#0288d1' }} />JSON</MenuItem>
              </Select>
            </FormControl>
            {exportType === 'pdf' && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5, color: '#676b72' }}>Orientation</Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button fullWidth variant={exportOrientation === 'portrait' ? 'contained' : 'outlined'} onClick={() => setExportOrientation('portrait')}>Portrait</Button>
                  <Button fullWidth variant={exportOrientation === 'landscape' ? 'contained' : 'outlined'} onClick={() => setExportOrientation('landscape')}>Landscape</Button>
                </Box>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setExportDialogOpen(false)} disabled={isExporting}>Cancel</Button>
            <Button
              onClick={handleConfirmExport}
              variant="contained"
              disabled={isExporting}
              startIcon={isExporting ? <CircularProgress size={20} color="inherit" /> : null}
            >
              {isExporting ? 'Exporting...' : 'Export'}
            </Button>
          </DialogActions>
        </Dialog>

        <SaveReportDialog
          open={saveDialogOpen}
          onClose={(saved) => {
            setSaveDialogOpen(false);
            if (saved) {
              navigate('/reports/favourite');
            }
          }}
          reportType="transfer"
          reportPath="/reports/transfer-reports"
          filters={{
            reportType: transferReportType,
            groupBy,
            consolidate: consolidateByReportType,
            precision,
            searchTerm,
            includeDeleted,
            dateTime: dateRange.preset,
            startDate: dateRange.startDate ? dateRange.startDate.toISOString() : null,
            endDate: dateRange.endDate ? dateRange.endDate.toISOString() : null,
            outletId: outletIdForSave,
          }}
        />
      </Box>
    </LocalizationProvider>
  );
};

export default TransferReports;
