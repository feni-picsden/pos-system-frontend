import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  IconButton,
  Popover,
} from '@mui/material';
import {
  DescriptionOutlined as SpreadsheetIcon,
  CalendarTodayOutlined as CalendarIcon,
  AccessTimeOutlined as ClockIcon,
  Remove as MinusIcon,
  Close as ClearIcon,
  ChevronLeft,
  ChevronRight,
  KeyboardArrowDown as ExpandIcon,
  KeyboardArrowRight as CollapseIcon,
} from '@mui/icons-material';
import {
  format,
  parse,
  isValid,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
} from 'date-fns';
import salesReportService from '../../services/salesReportService';
import outletService from '../../services/outletService';
import { useAuth } from '../../contexts/AuthContext';

// ponytail: reference chrome kept page-local (the sibling report pages own their own
// copies too) so parallel parity work never collides in components/Common.

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

// Parity input outline: #404040 1px, focused #000 2px, radius 8px, 43 tall.
const FIELD_SX = {
  '& .MuiOutlinedInput-root': { borderRadius: '8px', height: 43 },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' },
  '& input::placeholder': { color: '#808080', opacity: 1 },
};

// Popover inputs: white, radius 8, 38 tall.
const POPOVER_FIELD_SX = {
  bgcolor: '#fff',
  '& .MuiOutlinedInput-root': { borderRadius: '8px', height: 38, bgcolor: '#fff' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#d4d4d4', borderWidth: '1px' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#d4d4d4' },
  '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '1px' },
  '& input': { fontSize: 14, color: '#404040' },
  '& input::placeholder': { color: '#5f5f5f', opacity: 1 },
};

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DATE_TIME_MASK = 'DD/MM/YYYY HH:mm:ss';
const DISPLAY_FORMAT = 'dd/MM/yyyy HH:mm:ss';
const POPOVER_FORMAT = 'dd/MM/yyyy, HH:mm:ss';

const formatCurrency = (value) => {
  const num = Number(value) || 0;
  return `$${num.toFixed(2)}`;
};

const formatPercentage = (value) => {
  const num = Number(value) || 0;
  return `${num.toFixed(2)}%`;
};

const atStartOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Reference snaps the end of the range to the last second of the chosen day.
const atEndOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 0);
  return d;
};

// Popover inputs accept "dd/mm/yyyy, hh:mm:ss" and the bare date form.
const parseTypedDateTime = (raw) => {
  const text = (raw || '').trim();
  if (!text) return null;
  for (const pattern of [POPOVER_FORMAT, 'dd/MM/yyyy HH:mm:ss', 'dd/MM/yyyy']) {
    const parsed = parse(text, pattern, new Date());
    if (isValid(parsed)) return parsed;
  }
  return null;
};

// Reference calendar month: Monday-first, 38px square cells, 12px radius, sky text.
const MonthGrid = ({ month, rangeStart, rangeEnd, onPick, onPrev, onNext }) => {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  const today = new Date();

  return (
    <Box sx={{ flex: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '8px' }}>
        {onPrev ? (
          <IconButton size="small" onClick={onPrev} sx={{ color: '#0284c7', fontWeight: 700 }}>
            <ChevronLeft />
          </IconButton>
        ) : (
          <Box sx={{ width: 34 }} />
        )}
        <Box sx={{ fontSize: 18, fontWeight: 700, color: '#313439' }}>{format(month, 'MMMM yyyy')}</Box>
        {onNext ? (
          <IconButton size="small" onClick={onNext} sx={{ color: '#0284c7', fontWeight: 700 }}>
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
              fontSize: 12,
              fontWeight: 700,
              color: '#676b72',
            }}
          >
            {label}
          </Box>
        ))}
        {days.map((day) => {
          const outside = !isSameMonth(day, month);
          const isEdge =
            (rangeStart && isSameDay(day, rangeStart)) || (rangeEnd && isSameDay(day, rangeEnd));
          // Guard the ordering: isWithinInterval throws if end < start (mid-typing).
          const inRange =
            rangeStart &&
            rangeEnd &&
            rangeEnd >= rangeStart &&
            isWithinInterval(day, { start: atStartOfDay(rangeStart), end: atEndOfDay(rangeEnd) });
          const isToday = isSameDay(day, today);
          return (
            <Box
              key={day.toISOString()}
              onClick={() => onPick(day)}
              sx={{
                width: 38,
                height: 38,
                boxSizing: 'border-box',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
                opacity: outside ? 0.5 : 1,
                color: isEdge ? '#f8f8f8' : outside ? '#676b72' : '#0284c7',
                bgcolor: isEdge ? '#0284c7' : inRange ? '#e0f2fe' : 'transparent',
                border: isToday && !isEdge ? '1px solid #0284c7' : '1px solid transparent',
                transition: 'background 200ms ease, color 200ms ease',
                '&:hover': isEdge ? {} : { bgcolor: '#f0f0f0' },
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

const MetcashMscSales = () => {
  const { user, isSuperAdmin, getOutletId } = useAuth();
  const superAdmin = isSuperAdmin();

  // Reference starts with NO date chosen and blocks Run until an outlet + a date are set.
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [outletId, setOutletId] = useState(superAdmin ? '' : getOutletId() || '');
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [totals, setTotals] = useState(null);

  // Date picker popover
  const [calendarAnchorEl, setCalendarAnchorEl] = useState(null);
  const [activeEnd, setActiveEnd] = useState('start');
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(new Date()));
  const [pickerTab, setPickerTab] = useState('calendar');
  const [startText, setStartText] = useState('');
  const [endText, setEndText] = useState('');

  const addCategoryTotals = (data) => {
    return (data || []).map((category) => {
      const children = category.children || [];

      const categoryTotalsRow = {
        ...category,
        name: 'Totals',
        isCategoryTotal: true,
        children: undefined,
        productMsc: '',
        categoryMsc: '',
      };
      return {
        ...category,
        isCategoryTotal: false,
        children: [...children, categoryTotalsRow],
      };
    });
  };

  useEffect(() => {
    const loadOutlets = async () => {
      try {
        if (superAdmin) {
          const res = await outletService.getAllOutlets();
          const list = res?.outlets || res || [];
          setOutlets(Array.isArray(list) ? list : []);
        } else {
          setOutletId(getOutletId() || '');
        }
      } catch (error) {
        console.error('Error loading outlets:', error);
      }
    };

    loadOutlets();
  }, [user, superAdmin, getOutletId]);

  const canRun = Boolean(outletId && startDate && endDate);

  const handleRun = async () => {
    if (!canRun) return;
    setLoading(true);
    try {
      const filters = {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        outletId: outletId && outletId !== 'all' ? outletId : undefined,
      };

      const response = await salesReportService.getMetcashMscReport(filters);
      if (response.success) {
        const rawData = response.data || [];

        // Overall totals (using raw categories, without injected totals rows)
        const calculatedTotals = rawData.reduce((acc, category) => ({
          revenue: acc.revenue + (category.revenue || 0),
          revenueEx: acc.revenueEx + (category.revenueEx || 0),
          costOfGoods: acc.costOfGoods + (category.costOfGoods || 0),
          costOfGoodsEx: acc.costOfGoodsEx + (category.costOfGoodsEx || 0),
          transactionCount: acc.transactionCount + (category.transactionCount || 0),
          profit: acc.profit + (category.profit || 0),
          profitEx: acc.profitEx + (category.profitEx || 0),
        }), {
          revenue: 0,
          revenueEx: 0,
          costOfGoods: 0,
          costOfGoodsEx: 0,
          transactionCount: 0,
          profit: 0,
          profitEx: 0,
        });
        const profitPercentage = calculatedTotals.revenue > 0 ? (calculatedTotals.profit / calculatedTotals.revenue) * 100 : 0;
        setTotals({ ...calculatedTotals, profitPercentage });

        // Inject per-category totals rows for display
        const dataWithCategoryTotals = addCategoryTotals(rawData);
        setReportData(dataWithCategoryTotals);

        // Expand all category and category MSC rows by default
        const expandedKeys = new Set();
        dataWithCategoryTotals.forEach((category, categoryIndex) => {
          expandedKeys.add(`root-${categoryIndex}`);
          category.children?.forEach((categoryMsc, categoryMscIndex) => {
            expandedKeys.add(`root-${categoryIndex}-${categoryMscIndex}`);
          });
        });
        setExpandedRows(expandedKeys);
      } else {
        setReportData([]);
        setTotals(null);
      }
      setHasRun(true);
    } catch (error) {
      console.error('Error loading Metcash MSC Sales report:', error);
      setReportData([]);
      setTotals(null);
      setHasRun(true);
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (key) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedRows(newExpanded);
  };

  const openPicker = (event, which) => {
    setActiveEnd(which);
    setPickerTab('calendar');
    const anchorDate = (which === 'start' ? startDate : endDate) || startDate || new Date();
    setCalendarMonth(startOfMonth(anchorDate));
    setStartText(startDate ? format(startDate, POPOVER_FORMAT) : '');
    setEndText(endDate ? format(endDate, POPOVER_FORMAT) : '');
    setCalendarAnchorEl(event.currentTarget);
  };

  const applyRange = (nextStart, nextEnd) => {
    setStartDate(nextStart);
    setEndDate(nextEnd);
    setStartText(nextStart ? format(nextStart, POPOVER_FORMAT) : '');
    setEndText(nextEnd ? format(nextEnd, POPOVER_FORMAT) : '');
  };

  // Reference: picking a day commits that end and CLOSES the popover — the other
  // end is set by reopening from its own half of the field.
  const pickDate = (day) => {
    if (activeEnd === 'start') {
      const nextStart = atStartOfDay(day);
      applyRange(nextStart, endDate && endDate >= nextStart ? endDate : atEndOfDay(day));
    } else {
      const nextEnd = atEndOfDay(day);
      applyRange(startDate && startDate <= nextEnd ? startDate : atStartOfDay(day), nextEnd);
    }
    setCalendarAnchorEl(null);
  };

  const handleCurrentDay = () => {
    const today = new Date();
    applyRange(atStartOfDay(today), atEndOfDay(today));
    setCalendarAnchorEl(null);
  };

  const handleTypedDate = (which, raw) => {
    if (which === 'start') setStartText(raw);
    else setEndText(raw);
    const parsed = parseTypedDateTime(raw);
    if (!parsed) return;
    if (which === 'start') {
      setStartDate(parsed);
      if (!endDate || endDate < parsed) setEndDate(atEndOfDay(parsed));
    } else {
      setEndDate(parsed);
      if (!startDate || startDate > parsed) setStartDate(atStartOfDay(parsed));
    }
  };

  const clearEnd = (which) => {
    if (which === 'start') {
      setStartDate(null);
      setStartText('');
    } else {
      setEndDate(null);
      setEndText('');
    }
  };

  const handleTimeChange = (which, raw) => {
    if (!raw) return;
    const [h = 0, m = 0, s = 0] = raw.split(':').map(Number);
    const source = which === 'start' ? startDate : endDate;
    if (!source) return;
    const next = new Date(source);
    next.setHours(h, m, s, 0);
    if (which === 'start') applyRange(next, endDate);
    else applyRange(startDate, next);
  };

  const handleExportCSV = () => {
    // Reference exports the CURRENTLY DISPLAYED report and stays clickable regardless.
    if (!reportData.length) return;

    const rows = [];

    // Header
    rows.push([
      'NAME',
      'PRODUCT MSC',
      'CATEGORY MSC',
      'REVENUE',
      'REVENUE (EX)',
      'COST OF GOODS SOLD',
      'COST OF GOODS SOLD (EX)',
      'TRANSACTION COUNT',
      'PROFIT',
      'PROFIT (EX)',
      'PROFIT PERCENTAGE',
    ]);

    // Flatten hierarchical data
    const flattenData = (items, level = 0) => {
      items.forEach((item) => {
        rows.push([
          '  '.repeat(level) + item.name,
          item.productMsc || '',
          item.categoryMsc || '',
          formatCurrency(item.revenue),
          formatCurrency(item.revenueEx),
          formatCurrency(item.costOfGoods),
          formatCurrency(item.costOfGoodsEx),
          item.transactionCount,
          formatCurrency(item.profit),
          formatCurrency(item.profitEx),
          formatPercentage(item.profitPercentage),
        ]);

        if (item.children && item.children.length > 0) {
          flattenData(item.children, level + 1);
        }
      });
    };

    flattenData(reportData);

    // Convert to CSV
    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `metcash-msc-sales-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderRow = (item, level = 0, parentKey = '', index = 0, rowIndex = { count: 0 }) => {
    const key = `${parentKey}-${index}`;
    const isExpanded = expandedRows.has(key);
    const hasChildren = item.children && item.children.length > 0;
    const isCategory = level === 0;
    const isCategoryTotal = isCategory && item.isCategoryTotal;
    const zebra = rowIndex.count % 2 === 0 ? '#fff' : '#f8f8f8';
    rowIndex.count += 1;

    // Show numeric details for:
    // - all non-category rows
    // - the special "Totals" row under each category
    const showValues = !isCategory || isCategoryTotal;
    const isTotalsRow = item.isCategoryTotal || item.name === 'Totals';

    return (
      <React.Fragment key={key}>
        <TableRow
          sx={{
            bgcolor: isTotalsRow ? '#5ebbeb' : zebra,
            '& td': {
              color: isTotalsRow ? '#f8f8f8' : '#000',
              fontWeight: isTotalsRow || isCategory ? 700 : 400,
              fontSize: 16,
              padding: '8px 8px 8px 10px',
              borderBottom: 'none',
            },
          }}
        >
          <TableCell>
            <Box sx={{ display: 'flex', alignItems: 'center', pl: level * 2 }}>
              {hasChildren && (
                <IconButton
                  size="small"
                  onClick={() => toggleRow(key)}
                  sx={{ mr: 1, color: 'inherit' }}
                  disableRipple
                >
                  {isExpanded ? <ExpandIcon /> : <CollapseIcon />}
                </IconButton>
              )}
              {!hasChildren && <Box sx={{ width: 32 }} />}
              {item.name}
            </Box>
          </TableCell>
          <TableCell>{item.productMsc || ''}</TableCell>
          <TableCell>{item.categoryMsc || ''}</TableCell>
          <TableCell>
            {showValues && item.revenue !== undefined && item.revenue !== null
              ? formatCurrency(item.revenue)
              : ''}
          </TableCell>
          <TableCell>
            {showValues && item.revenueEx !== undefined && item.revenueEx !== null
              ? formatCurrency(item.revenueEx)
              : ''}
          </TableCell>
          <TableCell>
            {showValues && item.costOfGoods !== undefined && item.costOfGoods !== null
              ? formatCurrency(item.costOfGoods)
              : ''}
          </TableCell>
          <TableCell>
            {showValues && item.costOfGoodsEx !== undefined && item.costOfGoodsEx !== null
              ? formatCurrency(item.costOfGoodsEx)
              : ''}
          </TableCell>
          <TableCell>
            {showValues && item.transactionCount !== undefined && item.transactionCount !== null
              ? item.transactionCount
              : ''}
          </TableCell>
          <TableCell>
            {showValues && item.profit !== undefined && item.profit !== null
              ? formatCurrency(item.profit)
              : ''}
          </TableCell>
          <TableCell>
            {showValues && item.profitEx !== undefined && item.profitEx !== null
              ? formatCurrency(item.profitEx)
              : ''}
          </TableCell>
          <TableCell>
            {showValues && item.profitPercentage !== undefined && item.profitPercentage !== null
              ? formatPercentage(item.profitPercentage)
              : ''}
          </TableCell>
        </TableRow>
        {hasChildren && isExpanded && item.children.map((child, childIndex) =>
          renderRow(child, level + 1, key, childIndex, rowIndex)
        )}
      </React.Fragment>
    );
  };

  const rowCounter = { count: 0 };

  const renderTriggerHalf = (which) => {
    const value = which === 'start' ? startDate : endDate;
    return (
      <Box
        component="button"
        type="button"
        onClick={(e) => openPicker(e, which)}
        sx={{
          flex: 1,
          minWidth: 0,
          height: 41,
          px: '8px',
          border: 0,
          bgcolor: 'transparent',
          textAlign: 'left',
          cursor: 'pointer',
          fontFamily: 'monospace',
          fontSize: 16,
          color: value ? '#000' : '#8e8e8e',
        }}
      >
        {value ? format(value, DISPLAY_FORMAT) : DATE_TIME_MASK}
      </Box>
    );
  };

  return (
    <Box sx={{ p: '16px' }}>
      {/* Toolbar — reference has no page heading; the buttons are the first row */}
      <Box sx={{ display: 'flex', gap: '16px', flexWrap: 'wrap', mb: '16px' }}>
        <Button startIcon={<SpreadsheetIcon />} onClick={handleExportCSV} sx={{ ...TOOLBAR_BUTTON_SX, minWidth: 142 }}>
          Export CSV
        </Button>
      </Box>

      {/* Filters — flat on the page background, no card */}
      <Box sx={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <Box
          sx={{
            flex: '1 1 50%',
            minWidth: 320,
            maxWidth: 920,
            height: 43,
            display: 'flex',
            alignItems: 'center',
            bgcolor: '#fff',
            border: '1px solid #404040',
            borderRadius: '8px',
            boxSizing: 'border-box',
          }}
        >
          {!startDate && !endDate ? (
            <Box
              component="button"
              type="button"
              onClick={(e) => openPicker(e, 'start')}
              sx={{
                flex: 1,
                height: 41,
                px: '8px',
                border: 0,
                bgcolor: 'transparent',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: 16,
                color: '#8e8e8e',
              }}
            >
              Date (inclusive)
            </Box>
          ) : (
            <>
              {renderTriggerHalf('start')}
              <MinusIcon sx={{ color: '#737373', fontSize: 16 }} />
              {renderTriggerHalf('end')}
            </>
          )}
        </Box>

        {superAdmin && (
          <FormControl sx={{ ...FIELD_SX, minWidth: 220 }}>
            <InputLabel shrink>Outlet</InputLabel>
            <Select
              value={outletId}
              label="Outlet"
              notched
              displayEmpty
              onChange={(e) => setOutletId(e.target.value)}
              sx={{ height: 43 }}
            >
              <MenuItem value="all">All Outlets</MenuItem>
              {outlets.map((outlet) => (
                <MenuItem key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

      {/* Date picker popover — inputs first, then the tab row, then two months */}
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
              minHeight: 463,
              boxSizing: 'border-box',
              p: '16px',
              bgcolor: '#f7f7f7',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
            },
          },
        }}
      >
        {/* (1) masked datetime inputs */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px', mb: '12px' }}>
          {['start', 'end'].map((which) => {
            const text = which === 'start' ? startText : endText;
            return (
              <TextField
                key={which}
                value={text}
                onChange={(e) => handleTypedDate(which, e.target.value)}
                onFocus={() => setActiveEnd(which)}
                placeholder="dd/mm/yyyy, hh:mm:ss"
                sx={{ ...POPOVER_FIELD_SX, width: 229 }}
                InputProps={{
                  endAdornment: text ? (
                    <IconButton size="small" onClick={() => clearEnd(which)} sx={{ color: '#737373' }}>
                      <ClearIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  ) : null,
                }}
              />
            );
          })}
        </Box>

        {/* (2) calendar/clock tabs on the left, Current Day on the right */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: '12px' }}>
          <Box sx={{ display: 'flex', gap: '4px' }}>
            {[
              { key: 'calendar', icon: <CalendarIcon fontSize="small" /> },
              { key: 'clock', icon: <ClockIcon fontSize="small" /> },
            ].map(({ key, icon }) => (
              <IconButton
                key={key}
                onClick={() => setPickerTab(key)}
                disableRipple
                sx={{
                  width: 38,
                  height: 42,
                  borderRadius: '12px',
                  color: pickerTab === key ? '#0284c7' : '#707070',
                  transition: 'background 200ms ease, color 200ms ease',
                  '&:hover': { bgcolor: '#eeeeee' },
                }}
              >
                {icon}
              </IconButton>
            ))}
          </Box>
          <Box sx={{ flex: 1 }} />
          <Button
            onClick={handleCurrentDay}
            disableRipple
            sx={{
              height: 42,
              minWidth: 107,
              color: '#313439',
              fontSize: 16,
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: '12px',
              transition: 'background 200ms ease, color 200ms ease',
              '&:hover': { bgcolor: '#eeeeee' },
            }}
          >
            Current Day
          </Button>
        </Box>

        {/* (3) two-month grid, or the time panel when the clock tab is active */}
        {pickerTab === 'calendar' ? (
          <Box sx={{ display: 'flex', gap: '16px' }}>
            <MonthGrid
              month={calendarMonth}
              rangeStart={startDate}
              rangeEnd={endDate}
              onPick={pickDate}
              onPrev={() => setCalendarMonth(subMonths(calendarMonth, 1))}
            />
            <MonthGrid
              month={addMonths(calendarMonth, 1)}
              rangeStart={startDate}
              rangeEnd={endDate}
              onPick={pickDate}
              onNext={() => setCalendarMonth(addMonths(calendarMonth, 1))}
            />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: '12px' }}>
            {['start', 'end'].map((which) => {
              const value = which === 'start' ? startDate : endDate;
              return (
                <TextField
                  key={which}
                  type="time"
                  value={value ? format(value, 'HH:mm:ss') : ''}
                  onChange={(e) => handleTimeChange(which, e.target.value)}
                  inputProps={{ step: 1 }}
                  disabled={!value}
                  sx={{ ...POPOVER_FIELD_SX, width: 229 }}
                />
              );
            })}
          </Box>
        )}
      </Popover>

      {/* Run — own row below the filters */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: '32px', mb: '16px' }}>
        <Button
          onClick={handleRun}
          disabled={!canRun || loading}
          sx={{
            ...TOOLBAR_BUTTON_SX,
            minWidth: 62,
            '&.Mui-disabled': { bgcolor: '#404040', color: '#737373', border: '1px solid #404040' },
          }}
        >
          {loading ? <CircularProgress size={20} sx={{ color: 'inherit' }} /> : 'Run'}
        </Button>
      </Box>

      {/* Report Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : reportData.length > 0 ? (
        <TableContainer component={Paper} sx={{ boxShadow: 'none', borderRadius: 0 }}>
          <Table size="small">
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
                    height: 36,
                    borderBottom: 'none',
                    whiteSpace: 'nowrap',
                  },
                }}
              >
                <TableCell>Name</TableCell>
                <TableCell>Product MSC</TableCell>
                <TableCell>Category MSC</TableCell>
                <TableCell>Revenue</TableCell>
                <TableCell>Revenue (Ex)</TableCell>
                <TableCell>Cost of Goods Sold</TableCell>
                <TableCell>Cost of Goods Sold (Ex)</TableCell>
                <TableCell>Transaction Count</TableCell>
                <TableCell>Profit</TableCell>
                <TableCell>Profit (Ex)</TableCell>
                <TableCell>Profit Percentage</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reportData.map((item, index) => renderRow(item, 0, 'root', index, rowCounter))}
              {/* Totals Row */}
              {totals && (
                <TableRow
                  sx={{
                    bgcolor: '#5ebbeb',
                    '& td': {
                      color: '#f8f8f8',
                      fontWeight: 700,
                      fontSize: 16,
                      padding: '8px 8px 8px 10px',
                      borderBottom: 'none',
                    },
                  }}
                >
                  <TableCell>Totals</TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                  <TableCell>{formatCurrency(totals.revenue || 0)}</TableCell>
                  <TableCell>{formatCurrency(totals.revenueEx || 0)}</TableCell>
                  <TableCell>{formatCurrency(totals.costOfGoods || 0)}</TableCell>
                  <TableCell>{formatCurrency(totals.costOfGoodsEx || 0)}</TableCell>
                  <TableCell>{totals.transactionCount || 0}</TableCell>
                  <TableCell>{formatCurrency(totals.profit || 0)}</TableCell>
                  <TableCell>{formatCurrency(totals.profitEx || 0)}</TableCell>
                  <TableCell>{formatPercentage(totals.profitPercentage || 0)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography sx={{ fontSize: 16, color: '#676b72' }}>
          {hasRun
            ? 'No sales were found for the selected outlet and dates.'
            : 'Please select an Outlet, a date and then press run.'}
        </Typography>
      )}
    </Box>
  );
};

export default MetcashMscSales;
