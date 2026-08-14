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
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Checkbox,
  IconButton,
  Popover,
  Chip,
  FormControlLabel,
} from '@mui/material';
import {
  FileDownload as ExportIcon,
  PrintOutlined as PrintIcon,
  SaveOutlined as SaveIcon,
  ViewColumn as ColumnsIcon,
  CalendarTodayOutlined as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  ArrowUpward,
  ArrowDownward,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import inventoryReportService from '../../services/inventoryReportService';
import outletService from '../../services/outletService';
import SaveReportDialog from '../../components/Reports/SaveReportDialog';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
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
  { key: 'lastCaseCostEx', label: 'Last Case Cost (Ex)', headerLabel: 'LAST CASE COST (EX)' },
  { key: 'lastCaseCost', label: 'Last Case Cost', headerLabel: 'LAST CASE COST' },
  { key: 'averageCaseCostEx', label: 'Average Case Cost (Ex)', headerLabel: 'AVERAGE CASE COST (EX)' },
  { key: 'averageCaseCost', label: 'Average Case Cost', headerLabel: 'AVERAGE CASE COST' },
  { key: 'stockValueEx', label: 'Stock Value (Ex) (Last)', headerLabel: 'STOCK VALUE (EX) (LAST)' },
  { key: 'stockValueInc', label: 'Stock Value (Inc) (Last)', headerLabel: 'STOCK VALUE (INC) (LAST)' },
  { key: 'stockValueExAvg', label: 'Stock Value (Ex) (Average)', headerLabel: 'STOCK VALUE (EX) (AVERAGE)' },
  { key: 'stockValueIncAvg', label: 'Stock Value (Inc) (Average)', headerLabel: 'STOCK VALUE (INC) (AVERAGE)' },
];

const DEFAULT_VISIBLE_COLUMNS = ALL_COLUMNS.reduce((acc, col) => ({ ...acc, [col.key]: true }), {});

const isCurrencyColumn = (key) => key.includes('Cost') || key.includes('Value');

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
  const { getOutletId, user } = useAuth();

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
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  // Column visibility — reference has every column enabled.
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_COLUMNS);

  // UI states
  const [calendarAnchorEl, setCalendarAnchorEl] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(new Date()));
  const [columnsAnchorEl, setColumnsAnchorEl] = useState(null);
  const [columnsChipsExpanded, setColumnsChipsExpanded] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  useEffect(() => {
    loadOutlets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOutlets = async () => {
    try {
      if (user?.isSuperAdmin) {
        const response = await outletService.getAllOutlets();
        const outletsList = response?.outlets || response || [];
        setOutlets(Array.isArray(outletsList) ? outletsList : []);
        if (outletsList && Array.isArray(outletsList) && outletsList.length > 0 && !outletId) {
          setOutletId(outletsList[0].id);
        }
      } else {
        const currentOutletId = getOutletId();
        if (currentOutletId) {
          setOutletId(currentOutletId);
        }
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
    if (savedGroupBy) setGroupBy(savedGroupBy);
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
    const parsed = parse(text, DATE_FORMAT, new Date());
    if (isValid(parsed) && !isAfter(startOfDay(parsed), startOfDay(new Date()))) {
      setSelectedDate(startOfDay(parsed));
      setCalendarMonth(startOfMonth(parsed));
    }
  };

  const handleRun = async () => {
    if (!selectedDate) {
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
      } else {
        console.error('Failed to load inventory at date report:', response);
        setReportData([]);
      }
    } catch (error) {
      console.error('Error loading inventory at date report:', error);
      console.error('Error details:', error.response?.data || error.message);
      setReportData([]);
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

  const sortedData = React.useMemo(() => {
    if (!sortConfig.key) return reportData;

    return [...reportData].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const aStr = String(aValue || '').toLowerCase();
      const bStr = String(bValue || '').toLowerCase();

      if (sortConfig.direction === 'asc') {
        return aStr.localeCompare(bStr);
      }
      return bStr.localeCompare(aStr);
    });
  }, [reportData, sortConfig]);

  // "Show Products" off leaves only the grouped totals (documented behaviour).
  const flattenReportData = React.useCallback(() => {
    const flattened = [];
    sortedData.forEach(row => {
      const hasChildren = Boolean(row.children && Array.isArray(row.children));
      flattened.push({ ...row, isParent: hasChildren });
      if (hasChildren && showProducts) {
        row.children.forEach(child => {
          flattened.push({ ...child, isChild: true });
        });
      }
    });
    return flattened;
  }, [sortedData, showProducts]);

  const formatCurrency = (value) => {
    return `$${Number(value || 0).toFixed(2)}`;
  };

  const activeColumns = ALL_COLUMNS.filter(col => visibleColumns[col.key]);

  const cellValue = (row, col) => {
    if (col.key === 'name') return `${row.isChild ? '  ' : ''}${row.name || ''}`;
    if (col.key === 'outlet') return row.outlet || '';
    const value = row[col.key];
    return isCurrencyColumn(col.key) ? formatCurrency(value) : (value || 0);
  };

  const filteredFlatData = React.useMemo(() => {
    const flatData = flattenReportData();
    if (!searchTerm) return flatData;
    const searchLower = searchTerm.toLowerCase();
    return flatData.filter(row =>
      row.name?.toLowerCase().includes(searchLower)
    );
  }, [flattenReportData, searchTerm]);

  // Calculate totals
  const totals = React.useMemo(() => {
    const totalsObj = {};
    ALL_COLUMNS.forEach(col => {
      if (col.key !== 'outlet' && col.key !== 'name') {
        totalsObj[col.key] = filteredFlatData.reduce((sum, row) => {
          return sum + (Number(row[col.key]) || 0);
        }, 0);
      }
    });
    return totalsObj;
  }, [filteredFlatData]);

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
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inventory-at-date-${selectedDate ? format(selectedDate, 'yyyy-MM-dd') : 'all'}.csv`;
    link.click();
  };

  const handlePrint = () => {
    const dateLabel = selectedDate ? format(selectedDate, DATE_FORMAT) : '-';
    const printContent = `
      <div id="print-content">
        <style>
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
            background: #f8f8f8;
          }
          #print-content table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          #print-content th, #print-content td {
            padding: 8px;
            text-align: left;
          }
          #print-content th {
            background-color: #5ebbeb;
            color: #f8f8f8;
            font-weight: bold;
            font-size: 11px;
          }
          #print-content td {
            font-size: 11px;
          }
          #print-content td:not(:first-child) {
            text-align: right;
          }
          #print-content tr:nth-child(even) {
            background-color: #f8f8f8;
          }
          #print-content .child-row td:first-child {
            padding-left: 24px;
          }
          #print-content .total-row {
            background-color: #5ebbeb !important;
          }
          #print-content .total-row td {
            color: #f8f8f8;
            font-weight: bold;
          }
        </style>
        <h1>Inventory at Date</h1>
        <div class="report-info">
          <p><strong>Date (inclusive):</strong> ${dateLabel}</p>
          <p><strong>Group By:</strong> ${groupBy}</p>
          <p><strong>Show Inventory With Zero Stock:</strong> ${showZeroInventory ? 'Yes' : 'No'}</p>
          <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        </div>
        <table>
          <thead>
            <tr>
              ${activeColumns.map(col => `<th>${col.headerLabel}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${filteredFlatData.map(row => `
              <tr${row.isChild ? ' class="child-row"' : ''}>
                ${activeColumns.map(col => `<td>${cellValue(row, col)}</td>`).join('')}
              </tr>
            `).join('')}
            ${filteredFlatData.length > 0 ? `
              <tr class="total-row">
                ${activeColumns.map(col => {
                  if (col.key === 'name') return '<td>Total</td>';
                  if (col.key === 'outlet') return '<td></td>';
                  return `<td>${isCurrencyColumn(col.key) ? formatCurrency(totals[col.key]) : (totals[col.key] || 0)}</td>`;
                }).join('')}
              </tr>
            ` : ''}
          </tbody>
        </table>
      </div>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Inventory at Date - ${dateLabel}</title>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
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
        <Button startIcon={<SaveIcon />} onClick={() => setSaveDialogOpen(true)} sx={{ ...TOOLBAR_BUTTON_SX, minWidth: 95 }}>
          Save
        </Button>
      </Box>

      {/* Filters — flat on the page background, no card */}
      <Box sx={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', mb: '24px' }}>
        <TextField
          label="Date (inclusive)"
          placeholder="DD/MM/YYYY"
          value={dateText}
          onChange={(e) => handleDateTextChange(e.target.value)}
          onClick={(e) => {
            setCalendarAnchorEl(e.currentTarget);
            setColumnsChipsExpanded(false);
          }}
          InputLabelProps={{ shrink: true }}
          sx={{ ...FIELD_SX, width: 452 }}
        />
        <FormControl sx={{ ...FIELD_SX, minWidth: 200 }}>
          <InputLabel shrink>Group By</InputLabel>
          <Select
            value={groupBy}
            label="Group By"
            notched
            onChange={(e) => {
              setGroupBy(e.target.value);
              if (e.target.value === 'none') setShowProducts(true);
            }}
            sx={{ height: 43 }}
          >
            <MenuItem value="none">None</MenuItem>
            <MenuItem value="brand">Brand</MenuItem>
            <MenuItem value="category">Category</MenuItem>
            <MenuItem value="family">Family</MenuItem>
            <MenuItem value="supplier">Supplier</MenuItem>
          </Select>
        </FormControl>
        {user?.isSuperAdmin && (
          <FormControl sx={{ ...FIELD_SX, minWidth: 200 }}>
            <InputLabel shrink>Outlet</InputLabel>
            <Select
              value={outletId || ''}
              label="Outlet"
              notched
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
        )}
        <FormControlLabel
          sx={{ m: 0 }}
          labelPlacement="start"
          control={
            <ShopfrontSwitch
              checked={showZeroInventory}
              onChange={(e) => setShowZeroInventory(e.target.checked)}
              sx={{ ml: 1 }}
            />
          }
          label={<Typography sx={{ fontSize: 16, color: '#313439' }}>Show Inventory With Zero Stock</Typography>}
        />
        <FormControlLabel
          sx={{ m: 0 }}
          labelPlacement="start"
          control={
            <ShopfrontSwitch
              checked={showProducts}
              disabled={groupBy === 'none'}
              onChange={(e) => setShowProducts(e.target.checked)}
              sx={{ ml: 1 }}
            />
          }
          label={
            <Typography sx={{ fontSize: 16, color: groupBy === 'none' ? '#737373' : '#313439' }}>
              Show Products
            </Typography>
          }
        />
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
          <MonthGrid
            month={calendarMonth}
            value={selectedDate}
            maxDate={new Date()}
            onPick={pickDate}
            onPrev={() => setCalendarMonth(subMonths(calendarMonth, 1))}
          />
          <MonthGrid
            month={addMonths(calendarMonth, 1)}
            value={selectedDate}
            maxDate={new Date()}
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
      {hasRun && (
        <TextField
          fullWidth
          placeholder="Search Products"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ ...FIELD_SX, mb: '16px' }}
        />
      )}

      {/* Columns popover — caret, chip summary, scrollable checkbox list */}
      <Popover
        anchorEl={columnsAnchorEl}
        open={Boolean(columnsAnchorEl)}
        onClose={() => setColumnsAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        transitionDuration={0}
        slotProps={{
          paper: {
            sx: {
              width: 320,
              mt: '10px',
              overflow: 'visible',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: -8,
                right: 24,
                width: 16,
                height: 16,
                bgcolor: '#fff',
                transform: 'rotate(45deg)',
                boxShadow: '-2px -2px 4px rgba(0,0,0,0.06)',
              },
            },
          },
        }}
      >
        <Box sx={{ p: '8px 12px', borderBottom: '1px solid #e0e0e0', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
          {shownChips.map(col => (
            <Chip
              key={col.key}
              label={col.label}
              size="small"
              onDelete={() => toggleColumn(col.key)}
              sx={{ bgcolor: '#f0f0f0', color: '#313439' }}
            />
          ))}
          {remainingChips > 0 && (
            <Chip
              label={`${remainingChips} More...`}
              size="small"
              onClick={() => setColumnsChipsExpanded(true)}
              sx={{ bgcolor: '#f0f0f0', color: '#313439', cursor: 'pointer' }}
            />
          )}
        </Box>
        <Box sx={{ maxHeight: 380, overflowY: 'auto' }}>
          {ALL_COLUMNS.map((column) => {
            const checked = Boolean(visibleColumns[column.key]);
            return (
              <Box
                key={column.key}
                onClick={() => toggleColumn(column.key)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  px: '8px',
                  cursor: 'pointer',
                  transition: 'background 200ms ease',
                  '&:hover': { bgcolor: '#f8f8f8' },
                }}
              >
                <Checkbox
                  checked={checked}
                  icon={<CheckBoxOutlineBlankIcon />}
                  checkedIcon={<CheckBoxIcon />}
                  sx={{ color: '#38a9e2', '&.Mui-checked': { color: '#38a9e2' } }}
                />
                <Typography sx={{ fontSize: 16, color: checked ? '#38a9e2' : '#313439' }}>
                  {column.label}
                </Typography>
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
        <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 0 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={TABLE_HEAD_SX}>
                {activeColumns.map((column) => (
                  <TableCell
                    key={column.key}
                    align={column.align || 'right'}
                    onClick={() => handleSort(column.key)}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: column.align === 'left' ? 'flex-start' : 'flex-end',
                        gap: 0.5,
                      }}
                    >
                      {column.headerLabel}
                      {sortConfig.key === column.key && (
                        sortConfig.direction === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />
                      )}
                    </Box>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredFlatData.map((row, index) => (
                <TableRow
                  key={index}
                  sx={{
                    ...TABLE_ROW_SX,
                    bgcolor: index % 2 === 0 ? '#fff' : '#f8f8f8',
                    '& td': { ...TABLE_ROW_SX['& td'], fontWeight: row.isParent ? 700 : 400 },
                  }}
                >
                  {activeColumns.map((column) => (
                    <TableCell
                      key={column.key}
                      align={column.align || 'right'}
                      sx={column.key === 'name' && row.isChild ? { pl: '34px' } : undefined}
                    >
                      {cellValue(row, column)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              <TableRow sx={TABLE_TOTAL_SX}>
                {activeColumns.map((column) => (
                  <TableCell key={column.key} align={column.align || 'right'}>
                    {column.key === 'name'
                      ? 'Total'
                      : column.key === 'outlet'
                        ? ''
                        : isCurrencyColumn(column.key)
                          ? formatCurrency(totals[column.key] || 0)
                          : totals[column.key] || 0}
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
