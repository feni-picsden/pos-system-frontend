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
  IconButton,
  Tooltip,
  Menu,
  FormControlLabel,
  Divider,
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
  EditOutlined as EditIcon,
  ArrowDropDown,
  ArrowDropUp,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import salesReportService from '../../services/salesReportService';
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

// Shopfront reference has no transitions/ripple.
const INSTANT = 'all 0s ease';

// Sky-outlined toolbar buttons (Export / Print / Save / Columns / Edit Query).
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
  },
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

// Reporting Query Language keywords/constants — highlighted like the reference query bar.
const SQL_KEYWORDS = new Set([
  'SELECT', 'FROM', 'RANGE', 'AGGREGATE', 'BY', 'ON', 'WHERE', 'START', 'END', 'ORDER',
  'CONSOLIDATED', 'UNCONSOLIDATED', 'LIMIT', 'OFFSET', 'AS', 'TOTAL', 'AND', 'OR', 'IS',
  'NOT', 'NULL', 'LIKE', 'ASC', 'DESC', 'ASCENDING', 'DESCENDING', 'INCLUDE', 'EXCLUDE',
  'ONLY', 'CANCELLED', 'DELETED', 'VOIDED', 'ABORTED', 'BY_NAME', 'TODAY', 'ALL_OF_TIME',
  'CURRENT_TIMESTAMP',
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
// (absolute, top 100%, full width, flat #f8f8f8, no shadow, no scroll cap).
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
            // panel sits inside the trigger block's 1px border (reference width 628 on a 630 block)
            left: '1px',
            width: 'calc(100% - 2px)',
            zIndex: 8,
            boxSizing: 'border-box',
            bgcolor: '#f8f8f8',
            borderRadius: 0,
            boxShadow: 'none',
            // 11px vertical padding + 29px option rows land the panel on the reference 823px height
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

const SalesReport = () => {
  // In-app dialogs — these shadow window.alert/confirm/prompt on purpose.
  const { alert } = useAppDialogs();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reportTypes = {
    general: [
      { value: 'outlet', label: 'Outlet' },
      { value: 'register', label: 'Register' },
      { value: 'product', label: 'Product' },
      { value: 'user', label: 'User' },
      { value: 'userRole', label: 'User Role' },
      { value: 'customer', label: 'Customer' },
      { value: 'customerGroup', label: 'Customer Group' },
    ],
    classifications: [
      { value: 'brand', label: 'Brand' },
      { value: 'category', label: 'Category' },
      { value: 'family', label: 'Family' },
      { value: 'tag', label: 'Tag' },
    ],
    stock: [
      { value: 'supplier', label: 'Supplier' },
    ],
    promotions: [
      { value: 'promotion', label: 'Promotion' },
      { value: 'promotionProduct', label: 'Product' },
      { value: 'rebate', label: 'Rebate' },
      { value: 'promotionCategory', label: 'Promotion Category' },
    ],
    payments: [
      { value: 'paymentMethod', label: 'Payment Method' },
      { value: 'paymentMethodType', label: 'Payment Method Type' },
      { value: 'paymentMethodSubtype', label: 'Payment Method Subtype' },
    ],
    misc: [
      { value: 'taxRate', label: 'Tax Rate' },
    ],
  };

  // Group By Options
  const groupByOptions = {
    general: [
      { value: 'outlet', label: 'Outlet' },
      { value: 'register', label: 'Register' },
      { value: 'product', label: 'Product' },
      { value: 'user', label: 'User' },
      { value: 'userRole', label: 'User Role' },
      { value: 'customer', label: 'Customer' },
      { value: 'customerGroup', label: 'Customer Group' },
    ],
    classifications: [
      { value: 'brand', label: 'Brand' },
      { value: 'category', label: 'Category' },
      { value: 'family', label: 'Family' },
      { value: 'tag', label: 'Tag' },
    ],
    stock: [
      { value: 'supplier', label: 'Supplier' },
    ],
    promotions: [
      { value: 'promotion', label: 'Promotion' },
    ],
    misc: [
      { value: 'taxRate', label: 'Tax Rate' },
    ],
  };

  // Precision Options
  const precisionOptions = {
    range: [
      { value: 'hour', label: 'Hour' },
      { value: 'date', label: 'Date' },
      { value: 'week', label: 'Week' },
      { value: 'month', label: 'Month' },
      { value: 'quarter', label: 'Quarter' },
      { value: 'year', label: 'Year' },
    ],
    aggregate: [
      { value: 'hour', label: 'Hour' },
      { value: 'date', label: 'Date' },
      { value: 'day', label: 'Day' },
      { value: 'week', label: 'Week' },
      { value: 'month', label: 'Month' },
      { value: 'monthDate', label: 'Month Date' },
      { value: 'quarter', label: 'Quarter' },
    ],
  };

  // Grouped option lists for the reference-style inline filter panels
  const reportTypeGroups = [
    { label: 'General', items: reportTypes.general },
    { label: 'Classifications', items: reportTypes.classifications },
    { label: 'Stock', items: reportTypes.stock },
    { label: 'Promotions', items: reportTypes.promotions },
    { label: 'Payments', items: reportTypes.payments },
    { label: 'Misc', items: reportTypes.misc },
  ];
  const groupByGroups = [
    { label: null, items: [{ value: 'none', label: 'None' }] },
    { label: 'General', items: groupByOptions.general },
    { label: 'Classifications', items: groupByOptions.classifications },
    { label: 'Stock', items: groupByOptions.stock },
    { label: 'Promotions', items: groupByOptions.promotions },
    { label: 'Misc', items: groupByOptions.misc },
  ];
  const consolidateGroups = [
    {
      label: null,
      items: [
        { value: 'consolidated', label: 'Consolidated' },
        { value: 'unconsolidated', label: 'Unconsolidated' },
      ],
    },
  ];
  const precisionGroups = [
    { label: null, items: [{ value: 'none', label: 'None' }] },
    { label: 'Range', items: precisionOptions.range },
    { label: 'Aggregate', items: precisionOptions.aggregate },
  ];

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
  const [columnsMenuAnchor, setColumnsMenuAnchor] = useState(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportType, setExportType] = useState('pdf');
  const [exportOrientation, setExportOrientation] = useState('portrait');
  const [isExporting, setIsExporting] = useState(false);
  const [customQuery, setCustomQuery] = useState('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  // Column header click sorts asc, clicking the same header again flips to desc.
  const [sort, setSort] = useState({ key: null, dir: 'asc' });
  
  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    revenue: true,
    costOfGoods: true,
    transactionCount: true,
    averageSale: true,
    profit: true,
    profitPercentage: true,
    markup: false,
    taxAmount: true,
    totalItems: false,
    casesSold: false,
    itemsSold: false,
    calculatedCasesSold: false,
    calculatedItemsSold: false,
    discountAmount: true,
    rebateQuantity: false,
    expectedRebate: false,
    promotionQuantity: false,
    promotionalSavings: false,
    earnedLoyaltyPoints: false,
    revenuePercentage: true,
    transactionPercentage: false,
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

      const response = await salesReportService.getSalesReport(filters);
      
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

  // Use refs to track initialization and prevent initial load with defaults
  const hasInitializedFromParams = useRef(false);
  const isInitialMount = useRef(true);

  // Mark as initialized (state is already initialized from URL params if they exist)
  useEffect(() => {
    hasInitializedFromParams.current = true;
    isInitialMount.current = false;
  }, []);

  useEffect(() => {
    if (isInitialMount.current && !hasInitializedFromParams.current) {
      return;
    }
    
    if (hasInitializedFromParams.current) {
      const hasParams = searchParams.toString().length > 0;
      const delay = hasParams ? 150 : 0;
      
      const timer = setTimeout(() => {
        loadReportData();
      }, delay);
      
      return () => clearTimeout(timer);
    }
  }, [reportType, groupBy, dateRange, consolidate, precision, includeDeleted]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadReportData();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const generateSQLQuery = () => {
    let query = 'SELECT\n';
    query += '  BY_NAME AS "Name",\n';
    query += '  revenue AS "Revenue",\n';
    query += '  cost AS "Cost of Goods Sold",\n';
    query += '  transaction_count AS "Transaction Count",\n';
    query += '  FORMAT(revenue / transaction_count, \'$\') AS "Average Sale",\n';
    query += '  profit AS "Profit",\n';
    query += '  FORMAT((revenue - cost) / revenue * 100, \'\', \'%\', 2) AS "Profit Percentage",\n';
    query += '  tax AS "Tax Amount",\n';
    query += '  discount AS "Discount Amount",\n';
    query += '  FORMAT(revenue, \'\', \'%\', 2) AS "Revenue Percentage" TOTAL(PERCENTAGE_FROM_TOTAL),\n';
    query += '  FORMAT(transaction_count, \'\', \'%\', 2) AS "Transaction Percentage" TOTAL(PERCENTAGE_FROM_TOTAL)\n';
    query += 'FROM sales\n';
    
    if (groupBy && groupBy !== 'none') {
      query += `BY ${groupBy}\n`;
    }
    
    if (searchTerm) {
      query += `WHERE BY_NAME LIKE "%${searchTerm}%"\n`;
    }
    
    query += 'ORDER "Name" asc\n';
    
    if (consolidate === 'consolidated') {
      query += 'CONSOLIDATED';
    }
    
    return query;
  };

  useEffect(() => {
    setCustomQuery(generateSQLQuery());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, groupBy, dateRange, consolidate, precision, searchTerm]);

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
    reportData.forEach(row => {
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
    return `sales-report-${dateStr}_${timeStr}`;
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
    doc.text('Sales Report', 14, 15);
    
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
      ['Sales Report'],
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
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Report');

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
      `# Sales Report`,
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
        <h1>Sales Report</h1>
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
                  } else if (col.key.includes('Amount') || col.key === 'revenue' || col.key === 'costOfGoods' || col.key === 'profit' || col.key === 'taxAmount' || col.key === 'discountAmount' || col.key === 'expectedRebate' || col.key === 'promotionalSavings') {
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

  const handleColumnsMenuOpen = (event) => {
    setColumnsMenuAnchor(event.currentTarget);
  };

  const handleColumnsMenuClose = () => {
    setColumnsMenuAnchor(null);
  };

  // Header click: first click sorts lowest-to-highest, second reverses it.
  const handleSort = (key) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  // ponytail: sorts on the raw row value; computed columns (average sale, markup)
  // have no raw field and sort as 0 — add derived values here if that matters.
  const sortRows = (rows) => {
    if (!sort.key) return rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === 'number' || typeof bv === 'number') return ((av || 0) - (bv || 0)) * dir;
      return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
    });
  };

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
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

  // Define all available columns with their render functions
  const allColumns = [
    { 
      key: 'revenue', 
      label: 'Revenue',
      headerLabel: 'REVENUE',
      render: (row) => formatCurrency(row.revenue || 0)
    },
    { 
      key: 'costOfGoods', 
      label: 'Cost of Goods Sold',
      headerLabel: 'COST OF GOODS SOLD',
      render: (row) => formatCurrency(row.costOfGoods || 0)
    },
    { 
      key: 'transactionCount', 
      label: 'Transaction Count',
      headerLabel: 'TRANSACTION COUNT',
      render: (row) => row.transactionCount || 0
    },
    { 
      key: 'averageSale', 
      label: 'Average Sale',
      headerLabel: 'AVERAGE SALE',
      render: (row) => formatCurrency((row.revenue || 0) / (row.transactionCount || 1))
    },
    { 
      key: 'profit', 
      label: 'Profit',
      headerLabel: 'PROFIT',
      render: (row) => formatCurrency(row.profit || 0)
    },
    { 
      key: 'profitPercentage', 
      label: 'Profit Percentage',
      headerLabel: 'PROFIT %',
      render: (row) => `${(row.profitPercentage || 0).toFixed(2)}%`
    },
    { 
      key: 'markup', 
      label: 'Markup',
      headerLabel: 'MARKUP',
      render: (row) => `${((row.profit / (row.costOfGoods || 1)) * 100 || 0).toFixed(2)}%`
    },
    { 
      key: 'taxAmount', 
      label: 'Tax Amount',
      headerLabel: 'TAX AMOUNT',
      render: (row) => formatCurrency(row.taxAmount || 0)
    },
    { 
      key: 'totalItems', 
      label: 'Total Items',
      headerLabel: 'TOTAL ITEMS',
      // Backend field, so the Total row (which reduces row[key]) matches the cells.
      render: (row) => row.totalItems ?? row.quantity ?? 0
    },
    { 
      key: 'casesSold', 
      label: 'Cases Sold',
      headerLabel: 'CASES SOLD',
      render: (row) => row.casesSold || 0
    },
    { 
      key: 'itemsSold', 
      label: 'Items Sold',
      headerLabel: 'ITEMS SOLD',
      render: (row) => row.itemsSold || 0
    },
    { 
      key: 'calculatedCasesSold', 
      label: 'Calculated Cases Sold',
      headerLabel: 'CALCULATED CASES SOLD',
      render: (row) => row.calculatedCasesSold || 0
    },
    { 
      key: 'calculatedItemsSold', 
      label: 'Calculated Items Sold',
      headerLabel: 'CALCULATED ITEMS SOLD',
      render: (row) => row.calculatedItemsSold || 0
    },
    { 
      key: 'discountAmount', 
      label: 'Discount Amount',
      headerLabel: 'DISCOUNT AMOUNT',
      render: (row) => formatCurrency(row.discountAmount || 0)
    },
    { 
      key: 'rebateQuantity', 
      label: 'Rebate Quantity',
      headerLabel: 'REBATE QUANTITY',
      render: (row) => row.rebateQuantity || 0
    },
    { 
      key: 'expectedRebate', 
      label: 'Expected Rebate',
      headerLabel: 'EXPECTED REBATE',
      render: (row) => formatCurrency(row.expectedRebate || 0)
    },
    { 
      key: 'promotionQuantity', 
      label: 'Promotion Quantity',
      headerLabel: 'PROMOTION QUANTITY',
      render: (row) => row.promotionQuantity || 0
    },
    { 
      key: 'promotionalSavings', 
      label: 'Promotional Savings',
      headerLabel: 'PROMOTIONAL SAVINGS',
      render: (row) => formatCurrency(row.promotionalSavings || 0)
    },
    { 
      key: 'earnedLoyaltyPoints', 
      label: 'Earned Loyalty Points',
      headerLabel: 'EARNED LOYALTY POINTS',
      render: (row) => row.earnedLoyaltyPoints || 0
    },
    { 
      key: 'revenuePercentage', 
      label: 'Revenue Percentage',
      headerLabel: 'REVENUE %',
      render: (row) => `${(row.revenuePercentage || 0).toFixed(2)}%`
    },
    { 
      key: 'transactionPercentage', 
      label: 'Transaction Percentage',
      headerLabel: 'TRANSACTION %',
      render: (row) => `${(row.transactionPercentage || 0).toFixed(2)}%`
    },
  ];

  useEffect(() => {
    if (reportData.length > 0) {
      const initialExpanded = {};
      reportData.forEach((_, index) => {
        initialExpanded[index] = true; 
      });
      setExpandedRows(initialExpanded);
    }
  }, [reportData]);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
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
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              fontFamily: "'Roboto Mono', monospace",
              fontSize: 16,
              color: '#000000',
            }}
          >
            {highlightSQL(customQuery.replace(/\n/g, ' '))}
          </Box>
          <Button
            variant="text"
            startIcon={<EditIcon />}
            onClick={() => navigate('/reports/sales/query')}
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

        {/* Filters — reference renders flush 80px slate blocks with borders touching.
            Reference gap between the query bar and this row is 16px, not 8px. */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', mt: '8px', mb: '8px' }}>
          <ShopfrontFilter
            label="Report Type"
            value={reportType}
            groups={reportTypeGroups}
            onChange={setReportType}
          />

          <ShopfrontFilter
            label="Group By"
            value={groupBy}
            groups={groupByGroups}
            onChange={setGroupBy}
          />

          <Box sx={{ flex: '0 1 33.333%', minWidth: 240 }}>
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
              label="Date and Time"
              size="small"
              fullWidth
              enableTime
              inputSx={FILTER_DATE_SX}
            />
          </Box>

          <ShopfrontFilter
            label="Consolidate By Report Type"
            value={consolidate}
            groups={consolidateGroups}
            onChange={setConsolidate}
            renderValue={(value) => (value === 'consolidated' ? 'Yes' : 'No')}
          />

          <ShopfrontFilter
            label="Precision"
            value={precision}
            groups={precisionGroups}
            onChange={setPrecision}
            renderValue={(value) => {
              if (value === 'none') return 'None';
              const rangeOption = precisionOptions.range.find((opt) => opt.value === value);
              if (rangeOption) return `(Range) ${rangeOption.label}`;
              const aggregateOption = precisionOptions.aggregate.find((opt) => opt.value === value);
              if (aggregateOption) return `(Aggregate) ${aggregateOption.label}`;
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
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleExport}
                sx={SKY_BUTTON_SX}
              >
                Export
              </Button>
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={handlePrint}
                sx={SKY_BUTTON_SX}
              >
                Print
              </Button>
              <Button
                variant="outlined"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                sx={SKY_BUTTON_SX}
              >
                Save
              </Button>
              {!isPrecisionMode && (
                <Button
                  variant="outlined"
                  startIcon={<ColumnsIcon />}
                  onClick={handleColumnsMenuOpen}
                  sx={SKY_BUTTON_SX}
                >
                  Columns
                </Button>
              )}
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

        {/* Columns Menu */}
        <Menu
          anchorEl={columnsMenuAnchor}
          open={Boolean(columnsMenuAnchor)}
          onClose={handleColumnsMenuClose}
          PaperProps={{
            sx: {
              maxHeight: 400,
              width: 300,
            }
          }}
        >
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#666' }}>
              Select Columns
            </Typography>
          </Box>
          <Divider />
          <Box sx={{ px: 1, py: 1 }}>
            {allColumns.map((column) => (
              <MenuItem
                key={column.key}
                onClick={() => toggleColumn(column.key)}
                sx={{ py: 0.5 }}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={visibleColumns[column.key]}
                      size="small"
                    />
                  }
                  label={column.label}
                  sx={{ m: 0, width: '100%' }}
                />
              </MenuItem>
            ))}
          </Box>
        </Menu>

        {/* Report Table */}
        <Paper elevation={0} sx={{ borderRadius: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={TABLE_HEAD_SX}>
                    <TableCell onClick={() => handleSort('name')}>NAME</TableCell>
                    {(isPrecisionMode
                      ? getTimePeriodColumns()
                      : allColumns.filter(col => visibleColumns[col.key])
                    ).map(column => (
                      <TableCell key={column.key} align="right" onClick={() => handleSort(column.key)}>
                        {column.headerLabel}
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
                    sortRows(reportData).map((row, index) => (
                      <React.Fragment key={index}>
                        <TableRow
                          sx={{
                            ...TABLE_ROW_SX,
                            bgcolor: row.children ? '#f8f8f8' : index % 2 === 0 ? '#fff' : '#f8f8f8',
                            cursor: row.children ? 'pointer' : 'default',
                            '& td': { ...TABLE_ROW_SX['& td'], fontWeight: row.children ? 700 : 400 },
                          }}
                          onClick={() => row.children && toggleRow(index)}
                        >
                          <TableCell>
                            {row.children && (
                              <span style={{ marginRight: '8px', display: 'inline-flex', verticalAlign: 'middle' }}>
                                {expandedRows[index] ? <ExpandIcon /> : <CollapseIcon />}
                              </span>
                            )}
                            {row.name}
                          </TableCell>
                          {(isPrecisionMode
                            ? getTimePeriodColumns()
                            : allColumns.filter(col => visibleColumns[col.key])
                          ).map(column => (
                            <TableCell key={column.key} align="right">
                              {column.render(row)}
                            </TableCell>
                          ))}
                        </TableRow>

                        {Array.isArray(row.children) && expandedRows[index] &&
                          row.children.map((child, childIndex) => (
                            <TableRow
                              key={`${index}-child-${childIndex}`}
                              sx={{
                                ...TABLE_ROW_SX,
                                bgcolor: child.isTotalRow ? '#5ebbeb' : childIndex % 2 === 0 ? '#fff' : '#f8f8f8',
                                '& td': {
                                  ...TABLE_ROW_SX['& td'],
                                  color: child.isTotalRow ? '#f8f8f8' : '#000',
                                  fontWeight: child.isTotalRow ? 700 : 400,
                                },
                                '& td:first-of-type': { paddingLeft: '34px' },
                              }}
                            >
                              <TableCell>{child.name}</TableCell>
                              {(isPrecisionMode
                                ? getTimePeriodColumns()
                                : allColumns.filter(col => visibleColumns[col.key])
                              ).map(column => (
                                <TableCell key={column.key} align="right">
                                  {column.render(child)}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                      </React.Fragment>
                    ))
                  )}
                  {reportData.length > 0 && !isPrecisionMode && (
                    <TableRow sx={TABLE_TOTAL_SX}>
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
                          ) : column.key.includes('Amount') || column.key.includes('rebate') || column.key.includes('savings') || column.key === 'revenue' || column.key === 'costOfGoods' || column.key === 'profit' || column.key === 'averageSale' ? (
                            formatCurrency(reportData.reduce((sum, row) => sum + (row[column.key] || 0), 0))
                          ) : (
                            reportData.reduce((sum, row) => sum + (row[column.key] || 0), 0)
                        )}
                      </TableCell>
                      ))}
                    </TableRow>
                  )}
                  {reportData.length > 0 && isPrecisionMode && (
                    <TableRow sx={TABLE_TOTAL_SX}>
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
            {/* component="span": DialogTitle already renders an h2, an h6 child is invalid DOM nesting */}
            <Typography variant="h6" component="span" sx={{ color: '#0288d1', fontWeight: 600, fontSize: '1.25rem' }}>
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
          reportType="sales"
          reportPath="/reports/sales"
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

export default SalesReport;

