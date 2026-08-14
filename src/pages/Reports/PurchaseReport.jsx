import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  FormControl,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Checkbox,
  Chip,
  ListItemText,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  FileDownload as DownloadIcon,
  PrintOutlined as PrintIcon,
  SaveOutlined as SaveIcon,
  ViewColumn as ColumnsIcon,
  KeyboardArrowDown as ExpandIcon,
  KeyboardArrowRight as CollapseIcon,
  PictureAsPdf as PdfIcon,
  Description as CsvIcon,
  TableChart as XlsxIcon,
  Code as JsonIcon,
  HelpOutline as HelpIcon,
  EditOutlined as PencilIcon,
  ArrowDropDown,
  ArrowDropUp,
} from '@mui/icons-material';
import { format as formatDate } from 'date-fns';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import purchaseReportService from '../../services/purchaseReportService';
import { totalProfitPercentage } from '../../utils/reportTotals';
import DateRangePicker from '../../components/Common/DateRangePicker';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import SaveReportDialog from '../../components/Reports/SaveReportDialog';
import * as XLSX from 'xlsx';
const { jsPDF } = await import('jspdf');
import autoTable from 'jspdf-autotable';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';

const formatCurrency = (value) => {
  const num = Number(value) || 0;
  return `$${num.toFixed(2)}`;
};

// Report columns (module scope: no component state involved)
const allColumns = [
  { key: 'cost', label: 'Total Cost', headerLabel: 'TOTAL COST', render: (row) => formatCurrency(row.cost || 0) },
  { key: 'fees', label: 'Fees', headerLabel: 'FEES', render: (row) => formatCurrency(row.fees || 0) },
  { key: 'freight', label: 'Freight', headerLabel: 'FREIGHT', render: (row) => formatCurrency(row.freight || 0) },
  { key: 'paymentFees', label: 'Payment Fees', headerLabel: 'PAYMENT FEES', render: (row) => formatCurrency(row.paymentFees || 0) },
  { key: 'tax', label: 'Tax Amount', headerLabel: 'TAX AMOUNT', render: (row) => formatCurrency(row.tax || 0) },
];

// Shopfront trading day starts at 04:30 and ends 04:29:59 the following morning.
const TRADING_DAY_START = [4, 30, 0];
const isMidnight = (d) => d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0;

// Query preview highlighting — keywords blue, quoted strings green, commas grey.
const QUERY_KEYWORDS = new Set([
  'SELECT', 'AS', 'FROM', 'BY', 'ORDER', 'START', 'END', 'WHERE', 'LIKE',
  'RANGE', 'AGGREGATE', 'CONSOLIDATED', 'UNCONSOLIDATED',
]);
const queryTokenColor = (token) => {
  if (token === ',') return 'rgb(153,153,153)';
  if (token.startsWith('"')) return 'rgb(102,153,0)';
  if (QUERY_KEYWORDS.has(token)) return 'rgb(0,119,170)';
  return 'rgb(0,0,0)';
};
const tokenizeQuery = (query) => query.match(/"[^"]*"|,|\s+|[^\s,"]+/g) || [];

// Reference filter tile: 80px #676b72 block with an INLINE panel (no popover, no animation).
const FilterTile = ({ label, value, groups, selected, open, onToggle, onSelect }) => (
  <Box sx={{ position: 'relative', flex: '1 1 30%', minWidth: 260 }}>
    <Box
      onClick={onToggle}
      sx={{
        height: 80,
        boxSizing: 'border-box',
        bgcolor: '#676b72',
        border: '1px solid #f8f8f8',
        borderRadius: 0,
        color: '#f8f8f8',
        p: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 400, lineHeight: 1.3 }}>{label}</Typography>
        <Typography
          sx={{
            fontSize: 22.4,
            fontWeight: 400,
            lineHeight: 1.3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {value}
        </Typography>
      </Box>
      {open ? <ArrowDropUp sx={{ fontSize: 20 }} /> : <ArrowDropDown sx={{ fontSize: 20 }} />}
    </Box>
    {open && (
      <Box
        sx={{
          position: 'absolute',
          top: '100%',
          left: 0,
          width: '100%',
          zIndex: 8,
          bgcolor: '#f8f8f8',
          borderRadius: 0,
          boxShadow: 'none',
          p: '8px 8px 8px 0',
        }}
      >
        {groups.map((group, groupIndex) => (
          <Box key={group.header || `g${groupIndex}`}>
            {group.header && (
              <Typography sx={{ fontSize: 19.2, fontWeight: 700, mb: '8px', pl: '4px' }}>
                {group.header}
              </Typography>
            )}
            {group.options.map((option) => {
              const isSelected = selected === option.value;
              return (
                <Box
                  key={`${group.header || ''}-${option.value}`}
                  onClick={() => onSelect(option.value)}
                  sx={{
                    fontSize: 19.2,
                    fontWeight: 400,
                    height: 31,
                    boxSizing: 'border-box',
                    p: '4px',
                    pl: group.header ? '20px' : '4px',
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'background 0.1s ease, color 0.1s ease',
                    ...(isSelected
                      ? {
                          bgcolor: '#5ebbeb',
                          color: '#f8f8f8',
                          '&:hover': { bgcolor: '#5ebbeb', color: '#5ebbeb' },
                        }
                      : { color: '#000', '&:hover': { bgcolor: '#313439', color: '#f8f8f8' } }),
                  }}
                >
                  {option.label}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    )}
  </Box>
);

const PurchaseReport = () => {
  // In-app dialogs — these shadow window.alert/confirm/prompt on purpose.
  const { alert } = useAppDialogs();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Report Type Options
  const reportTypes = {
    general: [
      { value: 'outlet', label: 'Outlet' },
      { value: 'supplier', label: 'Supplier' },
      { value: 'product', label: 'Product' },
    ],
    classifications: [
      { value: 'brand', label: 'Brand' },
      { value: 'category', label: 'Category' },
      { value: 'family', label: 'Family' },
      { value: 'tag', label: 'Tag' },
    ],
  };

  // Group By Options
  const groupByOptions = {
    general: [
      { value: 'outlet', label: 'Outlet' },
      { value: 'supplier', label: 'Supplier' },
      { value: 'product', label: 'Product' },
    ],
    classifications: [
      { value: 'brand', label: 'Brand' },
      { value: 'category', label: 'Category' },
      { value: 'family', label: 'Family' },
      { value: 'tag', label: 'Tag' },
    ],
  };

  // Precision Options
  const precisionOptions = {
    range: [
      { value: 'date', label: 'Date' },
      { value: 'week', label: 'Week' },
      { value: 'month', label: 'Month' },
      { value: 'quarter', label: 'Quarter' },
      { value: 'year', label: 'Year' },
    ],
    aggregate: [
      { value: 'date', label: 'Date' },
      { value: 'day', label: 'Day' },
      { value: 'week', label: 'Week' },
      { value: 'month', label: 'Month' },
      { value: 'monthDate', label: 'Month Date' },
      { value: 'quarter', label: 'Quarter' },
    ],
  };

  // Initialize state from URL params if available, otherwise use defaults
  const getInitialState = () => {
    const savedReportType = searchParams.get('reportType');
    const savedGroupBy = searchParams.get('groupBy');
    const savedConsolidate = searchParams.get('consolidate');
    const savedPrecision = searchParams.get('precision');
    const savedSearchTerm = searchParams.get('searchTerm');
    const savedIncludeDeleted = searchParams.get('includeDeleted');
    const savedDateTime = searchParams.get('dateTime');
    const savedStartDate = searchParams.get('startDate');
    const savedEndDate = searchParams.get('endDate');

    let parsedStartDate = new Date();
    let parsedEndDate = new Date();
    
    if (savedStartDate) {
      parsedStartDate = new Date(savedStartDate);
      if (isNaN(parsedStartDate.getTime())) {
        parsedStartDate = new Date();
      }
    }
    
    if (savedEndDate) {
      parsedEndDate = new Date(savedEndDate);
      if (isNaN(parsedEndDate.getTime())) {
        parsedEndDate = new Date();
      }
    }

    return {
      reportType: savedReportType || 'outlet',
      groupBy: savedGroupBy || 'none',
      dateRange: (savedDateTime || savedStartDate || savedEndDate) ? {
        preset: savedDateTime || 'custom',
        startDate: parsedStartDate,
        endDate: parsedEndDate,
      } : {
        startDate: new Date(),
        endDate: new Date(),
        preset: 'today'
      },
      consolidate: savedConsolidate || 'consolidated',
      precision: savedPrecision || 'none',
      searchTerm: savedSearchTerm !== null ? savedSearchTerm : '',
      includeDeleted: savedIncludeDeleted === 'true' || false,
    };
  };

  const initialState = getInitialState();

  // State
  const [reportType, setReportType] = useState(initialState.reportType);
  const [groupBy, setGroupBy] = useState(initialState.groupBy);
  const [dateRange, setDateRange] = useState(initialState.dateRange);
  const [consolidate, setConsolidate] = useState(initialState.consolidate);
  const [precision, setPrecision] = useState(initialState.precision);
  const [searchTerm, setSearchTerm] = useState(initialState.searchTerm);
  const [includeDeleted, setIncludeDeleted] = useState(initialState.includeDeleted);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportType, setExportType] = useState('pdf');
  const [exportOrientation, setExportOrientation] = useState('portrait');
  const [isExporting, setIsExporting] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  // Which filter tile has its inline panel open (reference allows only one)
  const [openFilter, setOpenFilter] = useState(null);
  // Column sorting — reference defaults to ORDER "Name" asc
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const filtersRef = useRef(null);
  
  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    cost: true,
    fees: true,
    freight: true,
    paymentFees: true,
    tax: true,
  });

  // Load report data
  const loadReportData = async () => {
    setLoading(true);
    try {
      const filters = {
        reportType,
        groupBy,
        dateTime: dateRange.preset,
        consolidate,
        precision,
        searchTerm,
        includeDeleted,
        startDate: dateRange.startDate?.toISOString(),
        endDate: dateRange.endDate?.toISOString(),
      };

      const response = await purchaseReportService.getPurchaseReport(filters);
      
      if (response.success) {
        setReportData(response.data || []);
      } else {
        console.error('Failed to load report data');
        setReportData([]);
      }
    } catch (error) {
      console.error('Error loading report:', error);
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  // Load report data when filters change
  useEffect(() => {
    // Ensure we load data on mount, especially when URL params are present
    loadReportData();
  }, [reportType, groupBy, dateRange, consolidate, precision, includeDeleted]);
  
  // Also trigger load when URL params change
  useEffect(() => {
    const hasParams = searchParams.toString().length > 0;
    if (hasParams) {
      // Small delay to ensure state is fully initialized from URL params
      const timer = setTimeout(() => {
        loadReportData();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  // Reload when search term changes (with debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      loadReportData();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Close the open filter panel on outside click / Escape
  useEffect(() => {
    if (!openFilter) return undefined;
    const onPointerDown = (e) => {
      if (!filtersRef.current?.contains(e.target)) setOpenFilter(null);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpenFilter(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openFilter]);

  // Effective START/END for the query preview: the selected dates snapped to the
  // 04:30 trading-day boundary, end inclusive of the final day (04:29:59 next morning).
  const effectiveRange = () => {
    const start = dateRange.startDate ? new Date(dateRange.startDate) : null;
    const end = dateRange.endDate ? new Date(dateRange.endDate) : null;
    if (!start || !end) return { start: null, end: null };
    const relativePreset = dateRange.preset && dateRange.preset !== 'custom';
    if (relativePreset || isMidnight(start)) start.setHours(...TRADING_DAY_START, 0);
    if (relativePreset || isMidnight(end)) {
      end.setDate(end.getDate() + 1);
      end.setHours(4, 29, 59, 0);
    }
    return { start, end };
  };

  const sortLabel = sort.key === 'name'
    ? 'Name'
    : allColumns.find((c) => c.key === sort.key)?.label || sort.key;

  // Live query preview — reflects every filter, the applied range and the sort order
  const generateSQLQuery = () => {
    const parts = [
      'SELECT BY_NAME AS "Name", cost AS "Total Cost", fees AS "Fees", freight AS "Freight", payment_fees AS "Payment Fees", tax AS "Tax Amount"',
      'FROM orders',
    ];
    if (groupBy && groupBy !== 'none') parts.push(`BY ${groupBy}`);
    parts.push(`BY ${reportType}`);
    if (searchTerm) parts.push(`WHERE BY_NAME LIKE "%${searchTerm}%"`);
    const { start, end } = effectiveRange();
    if (start && end) {
      parts.push(`START "${formatDate(start, 'yyyy-MM-dd HH:mm:ss')}" END "${formatDate(end, 'yyyy-MM-dd HH:mm:ss')}"`);
    }
    if (precision && precision !== 'none') {
      const isRange = precisionOptions.range.some((o) => o.value === precision);
      parts.push(`${isRange ? 'RANGE' : 'AGGREGATE'} "${precision}"`);
    }
    parts.push(`ORDER "${sortLabel}" ${sort.dir}`);
    parts.push(consolidate === 'consolidated' ? 'CONSOLIDATED' : 'UNCONSOLIDATED');
    return parts.join(' ');
  };

  const customQuery = generateSQLQuery();

  // Column-header sorting (reference: click a heading to sort asc/desc)
  const sortRows = (rows) => {
    if (!Array.isArray(rows)) return rows;
    const key = sort.key;
    return [...rows].sort((a, b) => {
      const av = a?.[key];
      const bv = b?.[key];
      const numeric = typeof av === 'number' || typeof bv === 'number';
      const cmp = numeric
        ? (Number(av) || 0) - (Number(bv) || 0)
        : String(av ?? '').localeCompare(String(bv ?? ''));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  };
  const sortedData = sortRows(reportData).map((row) =>
    Array.isArray(row.children) ? { ...row, children: sortRows(row.children) } : row
  );
  const toggleSort = (key) =>
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const sortIndicator = (key) =>
    sort.key === key
      ? (sort.dir === 'asc'
          ? <ArrowDropUp sx={{ fontSize: 20, verticalAlign: 'middle' }} />
          : <ArrowDropDown sx={{ fontSize: 20, verticalAlign: 'middle' }} />)
      : null;

  const handleExport = () => {
    setExportDialogOpen(true);
  };

  const handleExportDialogClose = () => {
    setExportDialogOpen(false);
  };

  const handleConfirmExport = async () => {
    setIsExporting(true);
    try {
      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 100));
      
      switch (exportType) {
        case 'pdf':
          await exportToPDF();
          break;
        case 'xlsx':
          await exportToXLSX();
          break;
        case 'csv':
          await exportToCSV();
          break;
        case 'json':
          await exportToJSON();
          break;
        default:
          console.error('Unknown export type:', exportType);
      }
      
      setExportDialogOpen(false);
    } catch (error) {
      console.error('Error exporting report:', error);
      alert('Error exporting report. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const flattenReportData = () => {
    const flattened = [];
    sortedData.forEach(row => {
      flattened.push(row);
      if (Array.isArray(row.children)) {
        row.children.forEach(child => {
          flattened.push({ ...child, name: `  ${child.name}`, isChild: true });
        });
      }
    });
    return flattened;
  };

  const getFormattedFileName = () => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    return `purchase-report-${dateStr}_${timeStr}`;
  };

  const exportToPDF = async () => {
    const doc = new jsPDF({
      orientation: exportOrientation === 'portrait' ? 'p' : 'l',
      unit: 'mm',
      format: 'a4'
    });

    // Add title
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Purchase Report', 14, 15);
    
    // Add report details
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Report Type: ${reportType}`, 14, 25);
    doc.text(`Group By: ${groupBy}`, 14, 30);
    const dateRangeText = dateRange.preset === 'custom' 
      ? `${dateRange.startDate?.toLocaleDateString()} - ${dateRange.endDate?.toLocaleDateString()}` 
      : dateRange.preset.charAt(0).toUpperCase() + dateRange.preset.slice(1);
    doc.text(`Date Range: ${dateRangeText}`, 14, 35);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 40);

    // Prepare table data
    const allColumns = [
      { key: 'cost', label: 'Total Cost' },
      { key: 'fees', label: 'Fees' },
      { key: 'freight', label: 'Freight' },
      { key: 'paymentFees', label: 'Payment Fees' },
      { key: 'tax', label: 'Tax Amount' },
      { key: 'totalAmount', label: 'Total Amount' },
      { key: 'transactionCount', label: 'Transaction Count' },
    ];

    const visibleCols = allColumns.filter(col => visibleColumns[col.key]);
    const flatData = flattenReportData();
    
    const headers = [['Name', ...visibleCols.map(col => col.label)]];
    const body = flatData.map(row => [
      row.name,
      ...visibleCols.map(col => {
        const value = row[col.key];
        if (col.key.includes('Percentage') || col.key === 'markup') {
          return `${(value || 0).toFixed(2)}%`;
        } else if (col.key.includes('Amount') || col.key === 'revenue' || col.key === 'costOfGoods' || col.key === 'profit' || col.key === 'averageSale' || col.key === 'taxAmount' || col.key === 'discountAmount') {
          return `$${(value || 0).toFixed(2)}`;
        }
        return value || 0;
      })
    ]);

    autoTable(doc, {
      startY: 45,
      head: headers,
      body: body,
      theme: 'grid',
      styles: { 
        fontSize: exportOrientation === 'portrait' ? 7 : 8,
        cellPadding: 2
      },
      headStyles: { 
        fillColor: [33, 150, 243],
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: exportOrientation === 'portrait' ? 40 : 60 }
      },
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 0) {
          const rowData = flatData[data.row.index];
          if (rowData?.isChild) {
            data.cell.styles.fontStyle = 'italic';
            data.cell.styles.textColor = [100, 100, 100];
          }
        }
      }
    });

    doc.save(`${getFormattedFileName()}.pdf`);
  };

  const exportToXLSX = async () => {
    // Prepare columns
    const allColumns = [
      { key: 'revenue', label: 'Revenue' },
      { key: 'costOfGoods', label: 'Cost of Goods Sold' },
      { key: 'transactionCount', label: 'Transaction Count' },
      { key: 'averageSale', label: 'Average Sale' },
      { key: 'profit', label: 'Profit' },
      { key: 'profitPercentage', label: 'Profit %' },
      { key: 'markup', label: 'Markup' },
      { key: 'taxAmount', label: 'Tax Amount' },
      { key: 'totalItems', label: 'Total Items' },
      { key: 'casesSold', label: 'Cases Sold' },
      { key: 'itemsSold', label: 'Items Sold' },
      { key: 'calculatedCasesSold', label: 'Calculated Cases Sold' },
      { key: 'calculatedItemsSold', label: 'Calculated Items Sold' },
      { key: 'discountAmount', label: 'Discount Amount' },
      { key: 'rebateQuantity', label: 'Rebate Quantity' },
      { key: 'expectedRebate', label: 'Expected Rebate' },
      { key: 'promotionQuantity', label: 'Promotion Quantity' },
      { key: 'promotionalSavings', label: 'Promotional Savings' },
      { key: 'earnedLoyaltyPoints', label: 'Earned Loyalty Points' },
      { key: 'revenuePercentage', label: 'Revenue %' },
      { key: 'transactionPercentage', label: 'Transaction %' },
    ];

    const visibleCols = allColumns.filter(col => visibleColumns[col.key]);
    const flatData = flattenReportData();
    
    // Create worksheet data with report metadata
    const metadata = [
      ['Purchase Report'],
      [`Report Type: ${reportType}`],
      [`Group By: ${groupBy}`],
      [`Date Range: ${dateRange.preset === 'custom' ? `${dateRange.startDate?.toLocaleDateString()} - ${dateRange.endDate?.toLocaleDateString()}` : dateRange.preset}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [], // Empty row
    ];
    
    const worksheetData = [
      ...metadata,
      ['Name', ...visibleCols.map(col => col.label)],
      ...flatData.map(row => [
        row.name,
        ...visibleCols.map(col => {
          const value = row[col.key];
          if (col.key.includes('Percentage') || col.key === 'markup') {
            return Number((value || 0).toFixed(2));
          }
          return value || 0;
        })
      ])
    ];

    // Create workbook
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Purchase Report');

    const range = XLSX.utils.decode_range(ws['!ref']);
    
    // Auto-size columns
    const colWidths = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      let maxWidth = 10;
      for (let R = range.s.r; R <= range.e.r; ++R) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellAddress]) continue;
        const cellValue = String(ws[cellAddress].v || '');
        maxWidth = Math.max(maxWidth, cellValue.length);
      }
      colWidths.push({ wch: Math.min(maxWidth + 2, 50) });
    }
    ws['!cols'] = colWidths;

    // Save file
    XLSX.writeFile(wb, `${getFormattedFileName()}.xlsx`);
  };

  const exportToCSV = async () => {
    // Prepare columns
    const allColumns = [
      { key: 'revenue', label: 'Revenue' },
      { key: 'costOfGoods', label: 'Cost of Goods Sold' },
      { key: 'transactionCount', label: 'Transaction Count' },
      { key: 'averageSale', label: 'Average Sale' },
      { key: 'profit', label: 'Profit' },
      { key: 'profitPercentage', label: 'Profit %' },
      { key: 'markup', label: 'Markup' },
      { key: 'taxAmount', label: 'Tax Amount' },
      { key: 'totalItems', label: 'Total Items' },
      { key: 'casesSold', label: 'Cases Sold' },
      { key: 'itemsSold', label: 'Items Sold' },
      { key: 'calculatedCasesSold', label: 'Calculated Cases Sold' },
      { key: 'calculatedItemsSold', label: 'Calculated Items Sold' },
      { key: 'discountAmount', label: 'Discount Amount' },
      { key: 'rebateQuantity', label: 'Rebate Quantity' },
      { key: 'expectedRebate', label: 'Expected Rebate' },
      { key: 'promotionQuantity', label: 'Promotion Quantity' },
      { key: 'promotionalSavings', label: 'Promotional Savings' },
      { key: 'earnedLoyaltyPoints', label: 'Earned Loyalty Points' },
      { key: 'revenuePercentage', label: 'Revenue %' },
      { key: 'transactionPercentage', label: 'Transaction %' },
    ];

    const visibleCols = allColumns.filter(col => visibleColumns[col.key]);
    const flatData = flattenReportData();
    
    // Add metadata as comments
    const metadata = [
      `# Purchase Report`,
      `# Report Type: ${reportType}`,
      `# Group By: ${groupBy}`,
      `# Date Range: ${dateRange.preset === 'custom' ? `${dateRange.startDate?.toLocaleDateString()} - ${dateRange.endDate?.toLocaleDateString()}` : dateRange.preset}`,
      `# Generated: ${new Date().toLocaleString()}`,
      ''
    ];
    
    // Create CSV header
    const csvHeaders = ['Name', ...visibleCols.map(col => col.label)].join(',');
    
    // Create CSV rows
    const csvRows = flatData.map(row => {
      const values = [
        `"${(row.name || '').replace(/"/g, '""')}"`, // Escape quotes properly
        ...visibleCols.map(col => {
          const value = row[col.key];
          if (col.key.includes('Percentage') || col.key === 'markup') {
            return (value || 0).toFixed(2);
          }
          return value || 0;
        })
      ];
      return values.join(',');
    });

    // Combine metadata, header, and rows
    const csvContent = [...metadata, csvHeaders, ...csvRows].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${getFormattedFileName()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportToJSON = async () => {
    // Prepare export data with metadata
    const exportData = {
      metadata: {
        reportType,
        groupBy,
        dateTime: dateRange.preset,
        dateRange: dateRange.preset === 'custom' 
          ? { start: dateRange.startDate?.toISOString(), end: dateRange.endDate?.toISOString() }
          : dateRange.preset,
        generated: new Date().toISOString(),
        consolidate,
        precision
      },
      visibleColumns: Object.keys(visibleColumns).filter(key => visibleColumns[key]),
      data: flattenReportData(),
      summary: {
        totalRevenue: reportData.reduce((sum, row) => sum + (row.revenue || 0), 0),
        totalProfit: reportData.reduce((sum, row) => sum + (row.profit || 0), 0),
        totalTransactions: reportData.reduce((sum, row) => sum + (row.transactionCount || 0), 0),
        recordCount: reportData.length
      }
    };
    
    const jsonData = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${getFormattedFileName()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    // Check if we're in precision mode
    const isPrecisionMode = precision && precision !== 'none';
    
    // Get columns based on mode
    let columnsToShow;
    if (isPrecisionMode) {
      // Get time period columns for precision mode
      if (reportData.length > 0) {
        const firstRow = reportData[0];
        const standardKeys = ['name', 'revenue', 'costOfGoods', 'transactionCount', 'averageSale', 
          'profit', 'profitPercentage', 'markup', 'taxAmount', 'totalItems', 'casesSold', 
          'itemsSold', 'calculatedCasesSold', 'calculatedItemsSold', 'discountAmount',
          'rebateQuantity', 'expectedRebate', 'promotionQuantity', 'promotionalSavings',
          'earnedLoyaltyPoints', 'revenuePercentage', 'transactionPercentage', 'children'];
        
        const timePeriodKeys = Object.keys(firstRow).filter(key => 
          !standardKeys.includes(key) && firstRow[key] !== undefined
        );
        
        columnsToShow = timePeriodKeys.map(key => ({
          key: key,
          label: formatTimePeriodLabel(key)
        }));
      } else {
        columnsToShow = [];
      }
    } else {
      // Use regular columns
      const allColumns = [
        { key: 'revenue', label: 'Revenue' },
        { key: 'costOfGoods', label: 'Cost of Goods Sold' },
        { key: 'transactionCount', label: 'Transaction Count' },
        { key: 'averageSale', label: 'Average Sale' },
        { key: 'profit', label: 'Profit' },
        { key: 'profitPercentage', label: 'Profit %' },
        { key: 'markup', label: 'Markup' },
        { key: 'taxAmount', label: 'Tax Amount' },
        { key: 'totalItems', label: 'Total Items' },
        { key: 'casesSold', label: 'Cases Sold' },
        { key: 'itemsSold', label: 'Items Sold' },
        { key: 'calculatedCasesSold', label: 'Calculated Cases Sold' },
        { key: 'calculatedItemsSold', label: 'Calculated Items Sold' },
        { key: 'discountAmount', label: 'Discount Amount' },
        { key: 'rebateQuantity', label: 'Rebate Quantity' },
        { key: 'expectedRebate', label: 'Expected Rebate' },
        { key: 'promotionQuantity', label: 'Promotion Quantity' },
        { key: 'promotionalSavings', label: 'Promotional Savings' },
        { key: 'earnedLoyaltyPoints', label: 'Earned Loyalty Points' },
        { key: 'revenuePercentage', label: 'Revenue %' },
        { key: 'transactionPercentage', label: 'Transaction %' },
      ];
      columnsToShow = allColumns.filter(col => visibleColumns[col.key]);
    }

    const flatData = isPrecisionMode ? reportData : flattenReportData();

    // Build HTML for print
    const printContent = `
      <div id="print-content" style="display: none;">
        <style>
          @media print {
            body * {
              visibility: hidden;
            }
            #print-content, #print-content * {
              visibility: visible;
            }
            #print-content {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              display: block !important;
            }
          }
          #print-content {
            font-family: Arial, sans-serif;
            padding: 20px;
            font-size: 12px;
          }
          #print-content h1 {
            font-size: 24px;
            margin-bottom: 20px;
            color: #333;
          }
          #print-content .report-info {
            margin-bottom: 20px;
            padding: 10px;
            background: #f5f5f5;
            border-radius: 4px;
          }
          #print-content .report-info p {
            margin: 5px 0;
            font-size: 13px;
            color: #666;
          }
          #print-content table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          #print-content th, #print-content td {
            padding: 8px;
            text-align: left;
            border: 1px solid #ddd;
          }
          #print-content th {
            background-color: #2196f3;
            color: white;
            font-weight: bold;
            font-size: 11px;
            text-align: center;
          }
          #print-content td {
            font-size: 11px;
          }
          #print-content td:first-child {
            font-weight: 500;
          }
          #print-content td:not(:first-child) {
            text-align: right;
          }
          #print-content tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          #print-content .child-row td:first-child {
            padding-left: 24px;
            font-style: italic;
            color: #666;
            font-weight: normal;
          }
          #print-content .total-row {
            background-color: #e3f2fd !important;
            font-weight: bold;
          }
          #print-content .total-row td {
            font-weight: bold;
            color: #000;
          }
          @media print {
            #print-content {
              padding: 10px;
            }
            #print-content table {
              page-break-inside: auto;
            }
            #print-content tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
          }
        </style>
        <h1>Purchase Report</h1>
        <div class="report-info">
          <p><strong>Report Type:</strong> ${reportType}</p>
          <p><strong>Group By:</strong> ${groupBy}</p>
          ${isPrecisionMode ? `<p><strong>Precision:</strong> ${precision}</p>` : ''}
          <p><strong>Date Range:</strong> ${dateRange.preset === 'custom' ? `${dateRange.startDate?.toLocaleDateString()} - ${dateRange.endDate?.toLocaleDateString()}` : dateRange.preset}</p>
          <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              ${columnsToShow.map(col => `<th>${col.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${flatData.map(row => `
              <tr${row.isChild ? ' class="child-row"' : ''}>
                <td>${row.name}</td>
                ${columnsToShow.map(col => {
                  const value = row[col.key];
                  let formattedValue;
                  if (isPrecisionMode) {
                    // For precision mode, all values are revenue amounts
                    formattedValue = value ? `$${(value || 0).toFixed(2)}` : '$0.00';
                  } else if (col.key.includes('Percentage') || col.key === 'markup') {
                    formattedValue = `${(value || 0).toFixed(2)}%`;
                  } else if (col.key.includes('Amount') || col.key === 'revenue' || col.key === 'costOfGoods' || col.key === 'profit' || col.key === 'averageSale' || col.key === 'taxAmount' || col.key === 'discountAmount' || col.key === 'expectedRebate' || col.key === 'promotionalSavings') {
                    formattedValue = `$${(value || 0).toFixed(2)}`;
                  } else {
                    formattedValue = value || 0;
                  }
                  return `<td>${formattedValue}</td>`;
                }).join('')}
              </tr>
            `).join('')}
            ${reportData.length > 0 && !isPrecisionMode ? `
              <tr class="total-row">
                <td>Total</td>
                ${columnsToShow.map(col => {
                  let totalValue;
                  if (col.key === 'averageSale') {
                    totalValue = formatCurrency(
                      reportData.reduce((sum, row) => sum + (row.revenue || 0), 0) /
                      reportData.reduce((sum, row) => sum + (row.transactionCount || 0), 0) || 0
                    );
                  } else if (col.key === 'profitPercentage') {
                    totalValue = `${totalProfitPercentage(reportData).toFixed(2)}%`;
                  } else if (col.key === 'revenuePercentage' || col.key === 'transactionPercentage') {
                    totalValue = `${reportData.reduce((sum, row) => sum + (row[col.key] || 0), 0).toFixed(2)}%`;
                  } else if (col.key === 'markup') {
                    totalValue = `${((reportData.reduce((sum, row) => sum + (row.profit || 0), 0) / reportData.reduce((sum, row) => sum + (row.costOfGoods || 1), 0)) * 100 || 0).toFixed(2)}%`;
                  } else if (col.key.includes('Amount') || col.key === 'revenue' || col.key === 'costOfGoods' || col.key === 'profit' || col.key === 'taxAmount' || col.key === 'tax' || col.key === 'discountAmount' || col.key === 'expectedRebate' || col.key === 'promotionalSavings' || col.key === 'cost' || col.key === 'fees' || col.key === 'freight' || col.key === 'paymentFees' || col.key === 'totalAmount') {
                    totalValue = formatCurrency(reportData.reduce((sum, row) => sum + (row[col.key] || 0), 0));
                  } else {
                    totalValue = reportData.reduce((sum, row) => sum + (row[col.key] || 0), 0);
                  }
                  return `<td>${totalValue}</td>`;
                }).join('')}
              </tr>
            ` : ''}
            ${isPrecisionMode && reportData.length > 0 ? `
              <tr class="total-row">
                <td>Total</td>
                ${columnsToShow.map(col => {
                  const totalValue = reportData.reduce((sum, row) => sum + (row[col.key] || 0), 0);
                  return `<td>$${totalValue.toFixed(2)}</td>`;
                }).join('')}
              </tr>
            ` : ''}
          </tbody>
        </table>
      </div>
    `;

    // Remove any existing print content
    const existingPrintContent = document.getElementById('print-content');
    if (existingPrintContent) {
      existingPrintContent.remove();
    }

    // Add print content to document
    const printDiv = document.createElement('div');
    printDiv.innerHTML = printContent;
    document.body.appendChild(printDiv);
    
    // Trigger print
    setTimeout(() => {
    window.print();
      // Clean up after print (or cancel)
      setTimeout(() => {
        const printElement = document.getElementById('print-content');
        if (printElement) {
          printElement.remove();
        }
      }, 100);
    }, 100);
  };

  const handleSave = () => {
    setSaveDialogOpen(true);
  };

  const toggleRow = (index) => {
    setExpandedRows(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Check if we're in precision mode (time-based columns)
  const isPrecisionMode = precision && precision !== 'none';
  
  // Get time period columns from report data if in precision mode
  const getTimePeriodColumns = () => {
    if (!isPrecisionMode || reportData.length === 0) return [];
    
    // Get the first row's keys to find time period columns
    const firstRow = reportData[0];
    if (!firstRow) return [];
    
    // Time period keys are the ones that look like dates/times (not standard metrics)
    const timePeriodKeys = Object.keys(firstRow).filter(key => {
      // Exclude standard metric keys and metadata keys
      const standardKeys = ['name', 'revenue', 'costOfGoods', 'transactionCount', 'averageSale', 
        'profit', 'profitPercentage', 'markup', 'taxAmount', 'totalItems', 'casesSold', 
        'itemsSold', 'calculatedCasesSold', 'calculatedItemsSold', 'discountAmount',
        'rebateQuantity', 'expectedRebate', 'promotionQuantity', 'promotionalSavings',
        'earnedLoyaltyPoints', 'revenuePercentage', 'transactionPercentage', 'children'];
      
      return !standardKeys.includes(key) && firstRow[key] !== undefined;
    });
    
    return timePeriodKeys.map(key => ({
      key: key,
      label: formatTimePeriodLabel(key),
      headerLabel: formatTimePeriodLabel(key),
      render: (row) => row[key] ? formatCurrency(row[key]) : ''
    }));
  };

  // Format time period labels based on precision type
  const formatTimePeriodLabel = (key) => {
    if (precision === 'hour') {
      // Format: "2025-12-04 00:00" from key like "2025-12-04T00:00:00.000Z"
      const date = new Date(key);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}`;
      }
    } else if (precision === 'date') {
      // Key is already in format "2025-12-01", just return it
      return key;
    } else if (precision === 'month') {
      // Format "2025-12" -> "2025-12"
      return key;
    } else if (precision === 'quarter') {
      // Format "2025-Q1" -> "2025-Q1"
      return key;
    } else if (precision === 'year') {
      // Format "2025" -> "2025"
      return key;
    }
    // Return the key as is for other formats
    return key;
  };

  useEffect(() => {
    if (reportData.length > 0) {
      const initialExpanded = {};
      reportData.forEach((_, index) => {
        initialExpanded[index] = true; 
      });
      setExpandedRows(initialExpanded);
    }
  }, [reportData]);

  // Filter tile option groups (texts/order match the reference dropdowns)
  const reportTypeGroups = [
    { header: 'General', options: reportTypes.general },
    { header: 'Classifications', options: reportTypes.classifications },
  ];
  const groupByGroups = [
    { options: [{ value: 'none', label: 'None' }] },
    { header: 'General', options: groupByOptions.general },
    { header: 'Classifications', options: groupByOptions.classifications },
  ];
  const consolidateGroups = [
    {
      options: [
        { value: 'consolidated', label: 'Consolidated' },
        { value: 'unconsolidated', label: 'Unconsolidated' },
      ],
    },
  ];
  const precisionGroups = [
    { options: [{ value: 'none', label: 'None' }] },
    { header: 'Range', options: precisionOptions.range },
    { header: 'Aggregate', options: precisionOptions.aggregate },
  ];
  const labelOf = (groups, value) => {
    for (const group of groups) {
      const hit = group.options.find((o) => o.value === value);
      if (hit) return hit.label;
    }
    return value;
  };
  const precisionLabel = () => {
    if (!precision || precision === 'none') return 'None';
    const rangeOption = precisionOptions.range.find((o) => o.value === precision);
    if (rangeOption) return `(Range) ${rangeOption.label}`;
    const aggregateOption = precisionOptions.aggregate.find((o) => o.value === precision);
    if (aggregateOption) return `(Aggregate) ${aggregateOption.label}`;
    return precision;
  };
  const selectFilter = (setter) => (value) => {
    setter(value);
    setOpenFilter(null);
  };

  // Date and Time trigger dressed as the same 80px reference tile
  const dateTileSx = {
    '& .MuiInputLabel-root': {
      position: 'absolute',
      top: '16px',
      left: '16px',
      transform: 'none',
      maxWidth: 'none',
      fontSize: 16,
      fontWeight: 400,
      color: '#f8f8f8',
    },
    '& .MuiInputLabel-root.Mui-focused': { color: '#f8f8f8' },
    '& .MuiOutlinedInput-root': {
      bgcolor: '#676b72',
      border: '1px solid #f8f8f8',
      borderRadius: 0,
      height: 80,
      boxSizing: 'border-box',
      alignItems: 'flex-end',
      p: '16px',
      color: '#f8f8f8',
      fontSize: 22.4,
      fontWeight: 400,
      cursor: 'pointer',
    },
    '& .MuiOutlinedInput-input': { p: 0, cursor: 'pointer' },
    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
  };
  // Sky-outlined action button matching the reference (radius 12, h42, 16px/700, instant hover)
  const skyBtnSx = {
    color: '#0284c7',
    borderColor: '#38bdf8',
    borderRadius: '12px',
    height: 42,
    fontSize: 16,
    fontWeight: 700,
    textTransform: 'none',
    boxShadow: 'none',
    transition: 'none',
    '&:hover': { bgcolor: 'rgba(0,0,0,0.05)', borderColor: '#38bdf8', boxShadow: 'none' },
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        {/* Query Preview — single clipped line in a bordered box, syntax highlighted */}
        <Box
          sx={{
            mb: 3,
            height: 60,
            boxSizing: 'border-box',
            border: '1px solid #404040',
            borderRadius: '8px',
            p: 0,
            bgcolor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            overflow: 'hidden',
          }}
        >
          <Typography
            component="div"
            sx={{
              fontFamily: 'monospace',
              flex: 1,
              minWidth: 0,
              m: 0,
              pl: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {tokenizeQuery(customQuery).map((token, index) => (
              <span key={index} style={{ color: queryTokenColor(token) }}>
                {token}
              </span>
            ))}
          </Typography>
          <Button
            disableRipple
            startIcon={<PencilIcon sx={{ fontSize: 20 }} />}
            onClick={() => navigate(`/reports/purchases/query?query=${encodeURIComponent(customQuery)}`)}
            sx={{
              color: '#16a34a',
              fontSize: 16,
              fontWeight: 700,
              height: 42,
              minWidth: 88,
              px: '16px',
              py: '8px',
              mr: 1,
              border: '1px solid transparent',
              borderRadius: '12px',
              textTransform: 'none',
              whiteSpace: 'nowrap',
              transition: 'none',
              '& .MuiButton-startIcon': { mr: '8px' },
              '&:hover': { bgcolor: 'transparent', color: '#32b643' },
            }}
          >
            Edit
          </Button>
        </Box>

        {/* Filters Section — reference tiles: 80px #676b72 blocks with inline dropdown panels */}
        <Box
          ref={filtersRef}
          sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', mb: 3 }}
        >
          <FilterTile
            label="Report Type"
            value={labelOf(reportTypeGroups, reportType)}
            groups={reportTypeGroups}
            selected={reportType}
            open={openFilter === 'reportType'}
            onToggle={() => setOpenFilter(openFilter === 'reportType' ? null : 'reportType')}
            onSelect={selectFilter(setReportType)}
          />

          <FilterTile
            label="Group By"
            value={labelOf(groupByGroups, groupBy)}
            groups={groupByGroups}
            selected={groupBy}
            open={openFilter === 'groupBy'}
            onToggle={() => setOpenFilter(openFilter === 'groupBy' ? null : 'groupBy')}
            onSelect={selectFilter(setGroupBy)}
          />

          {/* Date and Time — same tile chrome, existing popover */}
          <Box sx={{ position: 'relative', flex: '1 1 30%', minWidth: 260 }}>
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
              label="Date and Time"
              size="medium"
              fullWidth
              enableTime
              hideIcon
              inputSx={dateTileSx}
            />
            <ArrowDropDown
              sx={{ position: 'absolute', right: 16, top: 30, fontSize: 20, color: '#f8f8f8', pointerEvents: 'none' }}
            />
          </Box>

          <FilterTile
            label="Consolidate By Report Type"
            value={consolidate === 'consolidated' ? 'Yes' : 'No'}
            groups={consolidateGroups}
            selected={consolidate}
            open={openFilter === 'consolidate'}
            onToggle={() => setOpenFilter(openFilter === 'consolidate' ? null : 'consolidate')}
            onSelect={selectFilter(setConsolidate)}
          />

          <FilterTile
            label="Precision"
            value={precisionLabel()}
            groups={precisionGroups}
            selected={precision}
            open={openFilter === 'precision'}
            onToggle={() => setOpenFilter(openFilter === 'precision' ? null : 'precision')}
            onSelect={selectFilter(setPrecision)}
          />
        </Box>

        {/* Action Buttons (left-aligned, sky-outlined) */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
          <Button
            variant="outlined"
            disableRipple
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            sx={skyBtnSx}
          >
            Export
          </Button>
          <Button
            variant="outlined"
            disableRipple
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            sx={skyBtnSx}
          >
            Print
          </Button>
          <Button
            variant="outlined"
            disableRipple
            startIcon={<SaveIcon />}
            onClick={handleSave}
            sx={skyBtnSx}
          >
            Save
          </Button>
        </Box>

        {/* Search row: full-width search + Include Deleted toggle + Columns */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <TextField
            size="small"
            placeholder="Search for anything"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{
              flex: 1,
              '& .MuiOutlinedInput-root': { borderRadius: '8px' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
              '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
              '& input::placeholder': { color: '#808080', opacity: 1 },
            }}
          />
          <FormControlLabel
            control={
              <ShopfrontSwitch
                checked={includeDeleted}
                onChange={(e) => setIncludeDeleted(e.target.checked)}
              />
            }
            label="Include Deleted"
            labelPlacement="start"
            sx={{ m: 0, whiteSpace: 'nowrap', '& .MuiFormControlLabel-label': { mr: 1 } }}
          />
          {!isPrecisionMode && (
            <FormControl size="small" sx={{ minWidth: 240 }}>
              <Select
                multiple
                displayEmpty
                startAdornment={<ColumnsIcon sx={{ color: '#0284c7', mr: 1 }} />}
                value={allColumns.filter((c) => visibleColumns[c.key]).map((c) => c.key)}
                onChange={(e) => {
                  const selected = e.target.value;
                  setVisibleColumns(
                    Object.fromEntries(allColumns.map((c) => [c.key, selected.includes(c.key)]))
                  );
                }}
                renderValue={(selected) => {
                  if (!selected.length) return <span style={{ color: '#808080' }}>Columns</span>;
                  const labelFor = (key) => allColumns.find((c) => c.key === key)?.label;
                  return (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'nowrap', overflow: 'hidden' }}>
                      {selected.slice(0, 2).map((key) => (
                        <Chip key={key} size="small" label={labelFor(key)} />
                      ))}
                      {selected.length > 2 && (
                        <Chip size="small" label={`${selected.length - 2} More...`} />
                      )}
                    </Box>
                  );
                }}
              >
                {allColumns.map((column) => (
                  <MenuItem key={column.key} value={column.key}>
                    <Checkbox checked={visibleColumns[column.key]} size="small" />
                    <ListItemText primary={column.label} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>

        {/* Report Table */}
        <Paper elevation={0} sx={{ borderRadius: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table size="small" sx={{ '& .MuiTableCell-root': { borderBottom: 'none' } }}>
                <TableHead>
                  <TableRow
                    sx={{
                      '& th': {
                        backgroundColor: '#5ebbeb',
                        color: '#f8f8f8',
                        fontWeight: 700,
                        fontSize: 16,
                        textTransform: 'uppercase',
                        padding: '8px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      },
                    }}
                  >
                    <TableCell onClick={() => toggleSort('name')}>
                      NAME{sortIndicator('name')}
                    </TableCell>
                    {(isPrecisionMode
                      ? getTimePeriodColumns()
                      : allColumns.filter(col => visibleColumns[col.key])
                    ).map(column => (
                      <TableCell key={column.key} align="right" onClick={() => toggleSort(column.key)}>
                        {column.headerLabel}{sortIndicator(column.key)}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reportData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={(isPrecisionMode ? getTimePeriodColumns().length : allColumns.filter(col => visibleColumns[col.key]).length) + 1} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          No data available for the selected filters
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedData.map((row, index) => (
                      <React.Fragment key={index}>
                        <TableRow
                          sx={{
                            bgcolor: index % 2 === 0 ? '#fff' : '#f8f8f8',
                            ...(row.children ? { cursor: 'pointer' } : {}),
                            '& td': {
                              color: '#000',
                              fontSize: 16,
                              padding: '8px 8px 8px 10px',
                            },
                          }}
                          onClick={() => row.children && toggleRow(index)}
                        >
                          <TableCell sx={row.children ? { fontWeight: 700 } : undefined}>
                            {row.children && (
                              <span style={{ marginRight: '8px', display: 'inline-flex', verticalAlign: 'middle' }}>
                                {expandedRows[index] ? <ExpandIcon /> : <CollapseIcon />}
                              </span>
                            )}
                            {row.name}
                          </TableCell>
                          {isPrecisionMode ? (
                            // Time period columns
                            getTimePeriodColumns().map(column => (
                              <TableCell 
                                key={column.key}
                                align="right" 
                                sx={row.children ? { fontWeight: 'bold' } : undefined}
                              >
                                {column.render(row)}
                          </TableCell>
                            ))
                          ) : (
                            // Regular metric columns
                            allColumns.filter(col => visibleColumns[col.key]).map(column => (
                              <TableCell 
                                key={column.key}
                                align="right" 
                                sx={row.children ? { fontWeight: 'bold' } : undefined}
                              >
                                {column.render(row)}
                          </TableCell>
                            ))
                          )}
                        </TableRow>

                        {Array.isArray(row.children) && expandedRows[index] &&
                          row.children.map((child, childIndex) => (
                            <TableRow
                              key={`${index}-child-${childIndex}`}
                              sx={{
                                bgcolor: child.isTotalRow ? '#5ebbeb' : childIndex % 2 === 0 ? '#fff' : '#f8f8f8',
                                '& td': {
                                  color: child.isTotalRow ? '#f8f8f8' : '#000',
                                  fontWeight: child.isTotalRow ? 700 : 400,
                                  fontSize: 16,
                                  padding: '8px 8px 8px 10px',
                                },
                              }}
                            >
                              <TableCell sx={{ pl: '32px' }}>
                                {child.name}
                              </TableCell>
                              {isPrecisionMode ? (
                                // Time period columns for child rows
                                getTimePeriodColumns().map(column => (
                                  <TableCell 
                                    key={column.key}
                                    align="right"
                                  >
                                    {column.render(child)}
                              </TableCell>
                                ))
                              ) : (
                                // Regular metric columns for child rows
                                allColumns.filter(col => visibleColumns[col.key]).map(column => (
                                  <TableCell 
                                    key={column.key}
                                    align="right"
                                  >
                                    {column.render(child)}
                              </TableCell>
                                ))
                                )}
                            </TableRow>
                          ))}
                      </React.Fragment>
                    ))
                  )}
                  {reportData.length > 0 && !isPrecisionMode && (
                    <TableRow
                      sx={{
                        bgcolor: '#5ebbeb',
                        '& td': { color: '#f8f8f8', fontWeight: 700, fontSize: 16, padding: '8px 8px 8px 10px' },
                      }}
                    >
                      <TableCell>Total</TableCell>
                      {allColumns.filter(col => visibleColumns[col.key]).map(column => (
                        <TableCell
                          key={column.key}
                          align="right"
                        >
                          {column.key === 'averageSale' ? (
                            formatCurrency(
                          reportData.reduce((sum, row) => sum + (row.revenue || 0), 0) /
                          reportData.reduce((sum, row) => sum + (row.transactionCount || 0), 0) || 0
                            )
                          ) : column.key === 'profitPercentage' ? (
                            `${totalProfitPercentage(reportData).toFixed(2)}%`
                          ) : column.key === 'revenuePercentage' ? (
                            `${reportData.reduce((sum, row) => sum + (row.revenuePercentage || 0), 0).toFixed(2)}%`
                          ) : column.key === 'transactionPercentage' ? (
                            `${reportData.reduce((sum, row) => sum + (row.transactionPercentage || 0), 0).toFixed(2)}%`
                          ) : column.key === 'markup' ? (
                            `${((reportData.reduce((sum, row) => sum + (row.profit || 0), 0) / reportData.reduce((sum, row) => sum + (row.costOfGoods || 1), 0)) * 100 || 0).toFixed(2)}%`
                          ) : column.key.includes('Percentage') || column.key.includes('percentage') ? (
                            `${(reportData.reduce((sum, row) => sum + (row[column.key] || 0), 0)).toFixed(2)}%`
                          ) : column.key.includes('Amount') || column.key.includes('rebate') || column.key.includes('savings') || column.key === 'tax' || column.key === 'cost' || column.key === 'fees' || column.key === 'freight' || column.key === 'paymentFees' || column.key === 'totalAmount' ? (
                            formatCurrency(reportData.reduce((sum, row) => sum + (row[column.key] || 0), 0))
                          ) : (
                            reportData.reduce((sum, row) => sum + (row[column.key] || 0), 0)
                        )}
                      </TableCell>
                      ))}
                    </TableRow>
                  )}
                  {reportData.length > 0 && isPrecisionMode && (
                    <TableRow
                      sx={{
                        bgcolor: '#5ebbeb',
                        '& td': { color: '#f8f8f8', fontWeight: 700, fontSize: 16, padding: '8px 8px 8px 10px' },
                      }}
                    >
                      <TableCell>Total</TableCell>
                      {getTimePeriodColumns().map(column => (
                        <TableCell
                          key={column.key}
                          align="right"
                        >
                          {formatCurrency(reportData.reduce((sum, row) => sum + (row[column.key] || 0), 0))}
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
        <Dialog 
          open={exportDialogOpen} 
          onClose={handleExportDialogClose}
          maxWidth="xs"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 2,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
            }
          }}
        >
          {/* Header */}
          <DialogTitle sx={{ 
            bgcolor: '#b3e5fc', 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1.5,
            py: 2,
            px: 3,
            borderBottom: '1px solid #e0e0e0'
          }}>
            <HelpIcon sx={{ color: '#0288d1', fontSize: 28 }} />
            <Typography variant="h6" sx={{ color: '#0288d1', fontWeight: 600, fontSize: '1.25rem' }}>
              Export Report
            </Typography>
          </DialogTitle>

          {/* Content */}
          <DialogContent sx={{ px: 3, py: 3 }}>
            {/* Export Type Selection */}
            <Box sx={{ mb: 3 }}>
              <Typography 
                variant="subtitle2" 
                sx={{ 
                  mb: 1.5, 
                  color: '#666',
                  fontSize: '0.9rem',
                  fontWeight: 500
                }}
              >
                Export Type
              </Typography>
              <FormControl fullWidth>
                <Select
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value)}
                  displayEmpty
                  sx={{
                    bgcolor: 'white',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#ddd'
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#bbb'
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#0288d1'
                    }
                  }}
                  renderValue={(value) => {
                    const icons = {
                      pdf: <PdfIcon sx={{ mr: 1.5, color: '#d32f2f' }} />,
                      xlsx: <XlsxIcon sx={{ mr: 1.5, color: '#2e7d32' }} />,
                      csv: <CsvIcon sx={{ mr: 1.5, color: '#ed6c02' }} />,
                      json: <JsonIcon sx={{ mr: 1.5, color: '#0288d1' }} />
                    };
                    const labels = {
                      pdf: 'PDF',
                      xlsx: 'XLSX',
                      csv: 'CSV',
                      json: 'JSON'
                    };
                    return (
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {icons[value]}
                        <span style={{ fontWeight: 500 }}>{labels[value]}</span>
                      </Box>
                    );
                  }}
                >
                  <MenuItem value="pdf">
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <PdfIcon sx={{ mr: 1.5, color: '#d32f2f' }} />
                      <span>PDF</span>
                    </Box>
                  </MenuItem>
                  <MenuItem value="xlsx">
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <XlsxIcon sx={{ mr: 1.5, color: '#2e7d32' }} />
                      <span>XLSX</span>
                    </Box>
                  </MenuItem>
                  <MenuItem value="csv">
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <CsvIcon sx={{ mr: 1.5, color: '#ed6c02' }} />
                      <span>CSV</span>
                    </Box>
                  </MenuItem>
                  <MenuItem value="json">
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <JsonIcon sx={{ mr: 1.5, color: '#0288d1' }} />
                      <span>JSON</span>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* Orientation Selection (only for PDF) */}
            {exportType === 'pdf' && (
              <Box>
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    mb: 1.5, 
                    color: '#666',
                    fontSize: '0.9rem',
                    fontWeight: 500
                  }}
                >
                  Orientation
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    fullWidth
                    variant={exportOrientation === 'portrait' ? 'contained' : 'outlined'}
                    onClick={() => setExportOrientation('portrait')}
                    sx={{
                      py: 1.5,
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      letterSpacing: '0.5px',
                      ...(exportOrientation === 'portrait' ? {
                        bgcolor: 'white',
                        color: '#333',
                        border: '2px solid #0288d1',
                        boxShadow: '0 2px 8px rgba(2, 136, 209, 0.15)',
                        '&:hover': {
                          bgcolor: '#f5f5f5',
                          border: '2px solid #0277bd',
                          boxShadow: '0 2px 12px rgba(2, 136, 209, 0.25)',
                        }
                      } : {
                        bgcolor: 'white',
                        color: '#666',
                        border: '1px solid #ddd',
                        '&:hover': {
                          bgcolor: '#fafafa',
                          border: '1px solid #bbb'
                        }
                      })
                    }}
                  >
                    Portrait
                  </Button>
                  <Button
                    fullWidth
                    variant={exportOrientation === 'landscape' ? 'contained' : 'outlined'}
                    onClick={() => setExportOrientation('landscape')}
                    sx={{
                      py: 1.5,
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      letterSpacing: '0.5px',
                      ...(exportOrientation === 'landscape' ? {
                        bgcolor: '#e0e0e0',
                        color: '#333',
                        border: '2px solid #9e9e9e',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                        '&:hover': {
                          bgcolor: '#d5d5d5',
                          border: '2px solid #757575',
                          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)',
                        }
                      } : {
                        bgcolor: 'white',
                        color: '#666',
                        border: '1px solid #ddd',
                        '&:hover': {
                          bgcolor: '#fafafa',
                          border: '1px solid #bbb'
                        }
                      })
                    }}
                  >
                    Landscape
                  </Button>
                </Box>
              </Box>
            )}
          </DialogContent>

          {/* Actions */}
          <DialogActions sx={{ px: 3, py: 2.5, bgcolor: '#fafafa', borderTop: '1px solid #e0e0e0' }}>
            <Button 
              onClick={handleExportDialogClose}
              variant="outlined"
              disabled={isExporting}
              sx={{ 
                minWidth: 100,
                py: 1,
                textTransform: 'none',
                fontSize: '0.95rem',
                fontWeight: 500,
                color: '#666',
                borderColor: '#ccc',
                '&:hover': {
                  borderColor: '#999',
                  bgcolor: '#f5f5f5'
                }
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmExport}
              variant="contained"
              disabled={isExporting}
              startIcon={isExporting ? <CircularProgress size={20} color="inherit" /> : null}
              sx={{ 
                minWidth: 100,
                py: 1,
                textTransform: 'none',
                fontSize: '0.95rem',
                fontWeight: 600,
                bgcolor: '#00bcd4',
                boxShadow: '0 2px 8px rgba(0, 188, 212, 0.3)',
                '&:hover': {
                  bgcolor: '#00acc1',
                  boxShadow: '0 4px 12px rgba(0, 188, 212, 0.4)',
                },
                '&:disabled': {
                  bgcolor: '#b2ebf2',
                  color: 'white'
                }
              }}
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
              // Optionally show a success message
            }
          }}
          reportType="purchase"
          reportPath="/reports/purchases"
          filters={{
            reportType,
            groupBy,
            dateTime: dateRange.preset,
            consolidate,
            precision,
            searchTerm,
            includeDeleted,
            startDate: dateRange.startDate?.toISOString(),
            endDate: dateRange.endDate?.toISOString(),
          }}
        />
      </Box>
    </LocalizationProvider>
  );
};

export default PurchaseReport;

