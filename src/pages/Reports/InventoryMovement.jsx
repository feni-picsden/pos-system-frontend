import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Popover,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
} from '@mui/material';
import {
  FileDownload as ExportIcon,
  PrintOutlined as PrintIcon,
  SaveOutlined as SaveIcon,
  CalendarTodayOutlined as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ArrowDropDown,
  Close as CloseIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  CheckBox as CheckBoxIcon,
} from '@mui/icons-material';
import {
  format,
  parse,
  isValid,
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
  subDays,
} from 'date-fns';
import inventoryReportService from '../../services/inventoryReportService';
import outletService from '../../services/outletService';
import productService from '../../services/productService';
import classificationService from '../../services/classificationService';
import SaveReportDialog from '../../components/Reports/SaveReportDialog';
import { useAuth } from '../../contexts/AuthContext';

// ponytail: reference chrome is copied per page (parallel parity agents own one page each),
// same constants as pages/Reports/InventoryAtDate.jsx.

// Toolbar: flat filled sky, square, invert on hover over 200ms ease.
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

const FIELD_LABEL_SX = { fontSize: '12.8px', fontWeight: 400, color: '#000', mb: '4px' };

// Reference filter control: 358x42 outlined box, 1px #5e5e5e, radius 8px.
const FIELD_BOX_SX = {
  minHeight: 42,
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  px: '12px',
  bgcolor: '#fff',
  border: '1px solid #5e5e5e',
  borderRadius: '8px',
  fontSize: 16,
  cursor: 'pointer',
};

const panelSx = (width) => ({
  width,
  mt: '4px',
  maxHeight: 288,
  overflowY: 'auto',
  bgcolor: '#fff',
  border: '1px solid #000',
  borderRadius: '8px',
  boxShadow: 'none',
});

const optionSx = (selected) => ({
  height: 56,
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  p: '16px',
  fontSize: 16,
  fontWeight: 400,
  cursor: 'pointer',
  color: selected ? '#38bdf8' : '#252525',
  transition: 'background 200ms ease, color 200ms ease',
  '&:hover': { bgcolor: '#f8f8f8' },
});

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
  },
};

const TABLE_CELL_SX = {
  color: '#000',
  fontWeight: 400,
  fontSize: 16,
  padding: '8px 8px 8px 10px',
  borderBottom: 'none',
  whiteSpace: 'nowrap',
};

const TABLE_TOTAL_SX = {
  bgcolor: '#5ebbeb',
  '& td': { ...TABLE_CELL_SX, color: '#f8f8f8', fontWeight: 700 },
};

const DATE_FORMAT = 'dd/MM/yyyy';
const INPUT_DATE_FORMAT = 'dd-MMM-yyyy';
const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const GROUPING_OPTIONS = [
  { value: 'none', label: 'No Grouping' },
  { value: 'category', label: 'Category' },
  { value: 'brand', label: 'Brand' },
  { value: 'family', label: 'Family' },
];

const SHOW_PRODUCTS_OPTIONS = [
  { value: 'movements', label: 'Only Products With Movements' },
  { value: 'all', label: 'All Products' },
];

const COST_OPTIONS = [
  { value: 'average', label: 'Average' },
  { value: 'last', label: 'Last Cost' },
];

// Documented result columns for the Inventory Movement report.
const COLUMNS = [
  { key: 'productId', label: 'ID' },
  { key: 'outletName', label: 'Outlet' },
  { key: 'productName', label: 'Name' },
  { key: 'openingQuantity', label: 'Opening Quantity', numeric: true },
  { key: 'openingValue', label: 'Opening Value', numeric: true, currency: true },
  { key: 'purchaseQuantity', label: 'Purchase Quantity', numeric: true },
  { key: 'purchaseValue', label: 'Purchase Value', numeric: true, currency: true },
  { key: 'salesQuantity', label: 'Sales Quantity', numeric: true },
  { key: 'salesValue', label: 'Sales Value', numeric: true, currency: true },
  { key: 'transferQuantityIn', label: 'Transfer Quantity In', numeric: true },
  { key: 'transferValueIn', label: 'Transfer Value In', numeric: true, currency: true },
  { key: 'transferQuantityOut', label: 'Transfer Quantity Out', numeric: true },
  { key: 'transferValueOut', label: 'Transfer Value Out', numeric: true, currency: true },
  { key: 'stocktakeAdjustmentQuantity', label: 'Stocktake Adjustment Quantity', numeric: true },
  { key: 'stocktakeAdjustmentValue', label: 'Stocktake Adjustment Value', numeric: true, currency: true },
  { key: 'basketQuantity', label: 'Basket Quantity', numeric: true },
  { key: 'basketValue', label: 'Basket Value', numeric: true, currency: true },
  { key: 'manualAdjustmentQuantity', label: 'Manual Adjustment Quantity', numeric: true },
  { key: 'manualAdjustmentValue', label: 'Manual Adjustment Value', numeric: true, currency: true },
  { key: 'closingQuantity', label: 'Closing Quantity', numeric: true },
  { key: 'closingValue', label: 'Closing Value', numeric: true, currency: true },
  { key: 'closingCost', label: 'Closing Cost', numeric: true, currency: true },
];

// Value columns are derived from the chosen cost basis (Average / Last Cost).
const VALUE_PAIRS = [
  ['openingQuantity', 'openingValue'],
  ['purchaseQuantity', 'purchaseValue'],
  ['salesQuantity', 'salesValue'],
  ['transferQuantityIn', 'transferValueIn'],
  ['transferQuantityOut', 'transferValueOut'],
  ['stocktakeAdjustmentQuantity', 'stocktakeAdjustmentValue'],
  ['basketQuantity', 'basketValue'],
  ['manualAdjustmentQuantity', 'manualAdjustmentValue'],
  ['closingQuantity', 'closingValue'],
];

const CLASSIFICATION_GROUPS = [
  { type: 'CATEGORY', heading: 'Categories' },
  { type: 'BRAND', heading: 'Brands' },
  { type: 'FAMILY', heading: 'Families' },
  { type: 'SUPPLIER', heading: 'Suppliers' },
];

const num = (value) => Number(value || 0);
const money = (value) => `$${num(value).toFixed(2)}`;

// Reference calendar month: Monday-first, 38px square cells.
const MonthGrid = ({ month, startDate, endDate, onPick, onPrev, onNext }) => {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });

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
          const selected =
            (startDate && isSameDay(day, startDate)) || (endDate && isSameDay(day, endDate));
          const inRange =
            startDate && endDate && day > startOfDay(startDate) && day < startOfDay(endDate);
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
                color: selected ? '#f8f8f8' : '#1c9ee1',
                bgcolor: selected ? '#1c9ee1' : inRange ? '#e8f4fc' : 'transparent',
                transition: 'background 200ms ease, color 200ms ease',
                '&:hover': selected ? {} : { bgcolor: '#f8f8f8' },
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

// Single-select combobox styled like the reference: bordered field + bordered option panel.
const RefSelect = ({ label, value, options, onChange, width = 358 }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const current = options.find((option) => option.value === value);

  return (
    <Box sx={{ width }}>
      <Typography sx={FIELD_LABEL_SX}>{label}</Typography>
      <Box sx={FIELD_BOX_SX} onClick={(e) => setAnchorEl(e.currentTarget)}>
        <Box sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current ? current.label : ''}
        </Box>
        <ArrowDropDown sx={{ color: '#404040' }} />
      </Box>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transitionDuration={0}
        slotProps={{ paper: { sx: panelSx(width) } }}
      >
        {options.map((option) => (
          <Box
            key={option.value}
            sx={optionSx(option.value === value)}
            onClick={() => {
              onChange(option.value);
              setAnchorEl(null);
            }}
          >
            {option.label}
          </Box>
        ))}
      </Popover>
    </Box>
  );
};

// Type-ahead multi-select over products AND classifications (reference "Products and Classifications").
const ProductClassificationFilter = ({ selection, onChange, width = 358 }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [term, setTerm] = useState('');
  const [groups, setGroups] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const search = term.trim();
    if (!search) {
      setGroups([]);
      return undefined;
    }

    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const [productRes, classificationRes] = await Promise.all([
          productService.getProducts({ search, limit: 20 }),
          classificationService.getClassifications({ search }),
        ]);
        if (cancelled) return;

        const products = productRes?.products || productRes?.data || [];
        const classifications = classificationRes?.classifications || [];
        const next = [];
        if (products.length) {
          next.push({
            heading: 'Products',
            items: products.map((p) => ({ key: `product:${p.id}`, kind: 'product', id: p.id, name: p.name })),
          });
        }
        CLASSIFICATION_GROUPS.forEach(({ type, heading }) => {
          const items = classifications
            .filter((c) => String(c.type).toUpperCase() === type)
            .map((c) => ({ key: `${type}:${c.id}`, kind: type, id: c.id, name: c.name }));
          if (items.length) next.push({ heading, items });
        });
        setGroups(next);
      } catch (error) {
        console.error('Error searching products and classifications:', error);
        if (!cancelled) setGroups([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  const toggle = (item) => {
    const exists = selection.some((s) => s.key === item.key);
    onChange(exists ? selection.filter((s) => s.key !== item.key) : [...selection, item]);
  };

  return (
    <Box sx={{ width }}>
      <Typography sx={FIELD_LABEL_SX}>Products and Classifications</Typography>
      <Box
        sx={{ ...FIELD_BOX_SX, flexWrap: 'wrap', gap: '4px', py: '4px' }}
        onClick={(e) => setAnchorEl(e.currentTarget)}
      >
        {selection.map((item) => (
          <Box
            key={item.key}
            sx={{
              bgcolor: 'rgba(0,0,0,0.10)',
              borderRadius: '4px',
              px: '8px',
              fontSize: 16,
              maxWidth: 150,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.name}
          </Box>
        ))}
        <Box sx={{ flex: 1, minWidth: 60, color: selection.length ? 'transparent' : '#808080' }}>
          {selection.length ? '' : 'Products and Classifications'}
        </Box>
        {selection.length > 0 && (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
            sx={{ color: '#404040', p: '2px' }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transitionDuration={0}
        slotProps={{ paper: { sx: panelSx(width) } }}
      >
        <Box sx={{ p: '8px' }}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder="Keep Typing to Search..."
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': { borderRadius: '8px' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
              '& input::placeholder': { color: '#808080', opacity: 1 },
            }}
          />
        </Box>
        {!term.trim() && (
          <Box sx={{ p: '16px', fontSize: 16, color: '#676b72' }}>Keep Typing to Search...</Box>
        )}
        {term.trim() && searching && (
          <Box sx={{ p: '16px', fontSize: 16, color: '#676b72' }}>Searching...</Box>
        )}
        {term.trim() && !searching && groups.length === 0 && (
          <Box sx={{ p: '16px', fontSize: 16, color: '#676b72' }}>No matches found.</Box>
        )}
        {groups.map((group) => (
          <Box key={group.heading}>
            <Box sx={{ p: '16px', fontSize: 16, fontWeight: 700, color: '#000' }}>{group.heading}</Box>
            {group.items.map((item) => {
              const checked = selection.some((s) => s.key === item.key);
              return (
                <Box key={item.key} sx={optionSx(false)} onClick={() => toggle(item)}>
                  {checked ? (
                    <CheckBoxIcon sx={{ color: '#38a9e2' }} />
                  ) : (
                    <CheckBoxOutlineBlankIcon sx={{ color: '#404040' }} />
                  )}
                  <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </Box>
                </Box>
              );
            })}
          </Box>
        ))}
      </Popover>
    </Box>
  );
};

const InventoryMovement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Reference defaults the range to yesterday -> today.
  const [startDate, setStartDate] = useState(startOfDay(subDays(new Date(), 1)));
  const [endDate, setEndDate] = useState(startOfDay(new Date()));
  const [startText, setStartText] = useState(format(subDays(new Date(), 1), INPUT_DATE_FORMAT));
  const [endText, setEndText] = useState(format(new Date(), INPUT_DATE_FORMAT));
  const [dateAnchorEl, setDateAnchorEl] = useState(null);
  const [activeField, setActiveField] = useState('start');
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(new Date()));
  const [calendarVisible, setCalendarVisible] = useState(true);

  const [selection, setSelection] = useState([]);
  const [grouping, setGrouping] = useState('none');
  const [outlets, setOutlets] = useState([]);
  const [outletId, setOutletId] = useState('');
  const [showProducts, setShowProducts] = useState('movements');
  const [costBasis, setCostBasis] = useState('average');

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [hasRun, setHasRun] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  useEffect(() => {
    const loadOutlets = async () => {
      try {
        if (user?.isSuperAdmin) {
          const res = await outletService.getAllOutlets();
          const list = res?.outlets || res || [];
          setOutlets(Array.isArray(list) ? list : []);
        }
      } catch (error) {
        console.error('Error loading outlets for inventory movement:', error);
      }
    };

    loadOutlets();
  }, [user]);

  const setDate = useCallback(
    (field, date) => {
      const day = startOfDay(date);
      if (field === 'start') {
        setStartDate(day);
        setStartText(format(day, INPUT_DATE_FORMAT));
        if (endDate && day > endDate) {
          setEndDate(day);
          setEndText(format(day, INPUT_DATE_FORMAT));
        }
      } else {
        setEndDate(day);
        setEndText(format(day, INPUT_DATE_FORMAT));
        if (startDate && day < startDate) {
          setStartDate(day);
          setStartText(format(day, INPUT_DATE_FORMAT));
        }
      }
    },
    [startDate, endDate]
  );

  const handleTypedDate = (field, text) => {
    if (field === 'start') setStartText(text);
    else setEndText(text);

    if (!text) {
      if (field === 'start') setStartDate(null);
      else setEndDate(null);
      return;
    }

    const parsed = parse(text, INPUT_DATE_FORMAT, new Date());
    if (isValid(parsed)) {
      if (field === 'start') setStartDate(startOfDay(parsed));
      else setEndDate(startOfDay(parsed));
      setCalendarMonth(startOfMonth(parsed));
    }
  };

  const pickDay = (day) => {
    setDate(activeField, day);
    setActiveField(activeField === 'start' ? 'end' : 'start');
  };

  const isCurrentDay =
    startDate && endDate && isSameDay(startDate, new Date()) && isSameDay(endDate, new Date());

  const applyCurrentDay = () => {
    const today = startOfDay(new Date());
    setStartDate(today);
    setEndDate(today);
    setStartText(format(today, INPUT_DATE_FORMAT));
    setEndText(format(today, INPUT_DATE_FORMAT));
    setCalendarMonth(startOfMonth(today));
  };

  const handleRun = async () => {
    setLoading(true);
    setHasRun(true);
    try {
      const filters = {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        outletId: outletId || undefined,
        showProducts,
      };

      const response = await inventoryReportService.getInventoryMovement(filters);
      if (response.success) {
        setReportData(response.data || []);
      } else {
        setReportData([]);
      }
    } catch (error) {
      console.error('Error loading inventory movement report:', error);
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  // Selection filter + cost basis are applied client-side over the returned rows.
  const rows = useMemo(() => {
    const matches = (row) => {
      if (!selection.length) return true;
      return selection.some((item) => {
        if (item.kind === 'product') return row.productId === item.id;
        if (item.kind === 'CATEGORY') return row.categoryId === item.id;
        if (item.kind === 'BRAND') return row.brandId === item.id;
        if (item.kind === 'FAMILY') return row.familyId === item.id;
        return false;
      });
    };

    return reportData.filter(matches).map((row) => {
      const basis = costBasis === 'average' ? num(row.averageCost) : num(row.lastCost);
      if (!basis) return row;
      const recosted = { ...row };
      VALUE_PAIRS.forEach(([qtyKey, valueKey]) => {
        recosted[valueKey] = num(row[qtyKey]) * basis;
      });
      return recosted;
    });
  }, [reportData, selection, costBasis]);

  const sumRows = (list) => {
    const totals = {};
    COLUMNS.filter((c) => c.numeric).forEach((column) => {
      totals[column.key] = list.reduce((sum, row) => sum + num(row[column.key]), 0);
    });
    return totals;
  };

  // Grouping renders a bold subtotal row per classification, then its products.
  const displayRows = useMemo(() => {
    if (grouping === 'none') return rows.map((row) => ({ ...row, kind: 'row' }));

    const key = `${grouping}Name`;
    const buckets = new Map();
    rows.forEach((row) => {
      const name = row[key] || 'Unclassified';
      if (!buckets.has(name)) buckets.set(name, []);
      buckets.get(name).push(row);
    });

    const out = [];
    [...buckets.keys()].sort((a, b) => a.localeCompare(b)).forEach((name) => {
      const bucket = buckets.get(name);
      out.push({ kind: 'group', productName: name, ...sumRows(bucket) });
      bucket.forEach((row) => out.push({ ...row, kind: 'row' }));
    });
    return out;
  }, [rows, grouping]);

  const totals = useMemo(() => sumRows(rows), [rows]);

  const cellText = (row, column) => {
    if (row.kind === 'group' && (column.key === 'productId' || column.key === 'outletName')) return '';
    const value = row[column.key];
    if (column.currency) return money(value);
    if (column.numeric) return num(value);
    return value ?? '';
  };

  const handleExportCSV = () => {
    const lines = [
      COLUMNS.map((c) => c.label),
      ...displayRows.map((row) => COLUMNS.map((column) => cellText(row, column))),
    ];

    const csv = lines
      .map((line) => line.map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'inventory-movement.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const rangeLabel = (date) => (date ? format(date, DATE_FORMAT) : 'dd/mm/yyyy');

  return (
    <Box sx={{ p: '16px' }}>
      {/* Toolbar — reference order: Export CSV, Print, Save; always enabled */}
      <Box sx={{ display: 'flex', gap: '16px', flexWrap: 'wrap', mb: '32px' }}>
        <Button startIcon={<ExportIcon />} onClick={handleExportCSV} sx={{ ...TOOLBAR_BUTTON_SX, minWidth: 142 }}>
          Export CSV
        </Button>
        <Button startIcon={<PrintIcon />} onClick={handlePrint} sx={{ ...TOOLBAR_BUTTON_SX, minWidth: 95 }}>
          Print
        </Button>
        <Button startIcon={<SaveIcon />} onClick={() => setSaveDialogOpen(true)} sx={{ ...TOOLBAR_BUTTON_SX, minWidth: 96 }}>
          Save
        </Button>
      </Box>

      {/* Filters — flat on the page background, no card */}
      <Box sx={{ display: 'flex', gap: '16px', flexWrap: 'wrap', mb: '24px' }}>
        <Box sx={{ width: 358 }}>
          <Typography sx={FIELD_LABEL_SX}>Date Range (inclusive)</Typography>
          <Box sx={{ ...FIELD_BOX_SX, cursor: 'default', justifyContent: 'flex-start' }}>
            <Box
              component="span"
              onClick={(e) => {
                setActiveField('start');
                setDateAnchorEl(e.currentTarget.parentElement);
              }}
              sx={{ cursor: 'default', color: '#000' }}
            >
              {rangeLabel(startDate)}
            </Box>
            <Box component="span" sx={{ color: '#000' }}>
              —
            </Box>
            <Box
              component="span"
              onClick={(e) => {
                setActiveField('end');
                setDateAnchorEl(e.currentTarget.parentElement);
              }}
              sx={{ cursor: 'default', color: '#000' }}
            >
              {rangeLabel(endDate)}
            </Box>
          </Box>
        </Box>

        <ProductClassificationFilter selection={selection} onChange={setSelection} />

        <RefSelect label="Grouping" value={grouping} options={GROUPING_OPTIONS} onChange={setGrouping} />

        {user?.isSuperAdmin && (
          <RefSelect
            label="Outlets"
            value={outletId}
            options={[{ value: '', label: 'All Outlets' }, ...outlets.map((o) => ({ value: o.id, label: o.name }))]}
            onChange={setOutletId}
          />
        )}

        <RefSelect
          label="Show Products"
          value={showProducts}
          options={SHOW_PRODUCTS_OPTIONS}
          onChange={setShowProducts}
        />

        <RefSelect label="Cost to Use" value={costBasis} options={COST_OPTIONS} onChange={setCostBasis} />
      </Box>

      {/* Date range popover — masked inputs, Current Day preset, two months */}
      <Popover
        open={Boolean(dateAnchorEl)}
        anchorEl={dateAnchorEl}
        onClose={() => setDateAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transitionDuration={0}
        slotProps={{
          paper: {
            sx: {
              width: 622,
              boxSizing: 'border-box',
              p: '16px',
              bgcolor: '#f7f7f7',
              border: '1px solid #e5e5e5',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', mb: '16px' }}>
          <IconButton
            size="small"
            onClick={() => setCalendarVisible((visible) => !visible)}
            sx={{ color: calendarVisible ? '#1c9ee1' : '#404040' }}
          >
            <CalendarIcon fontSize="small" />
          </IconButton>
          {['start', 'end'].map((field) => (
            <TextField
              key={field}
              size="small"
              placeholder={INPUT_DATE_FORMAT.toLowerCase()}
              value={field === 'start' ? startText : endText}
              onFocus={() => setActiveField(field)}
              onChange={(e) => handleTypedDate(field, e.target.value)}
              InputProps={{
                endAdornment: (field === 'start' ? startText : endText) ? (
                  <IconButton size="small" onClick={() => handleTypedDate(field, '')} sx={{ color: '#404040' }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                ) : null,
              }}
              sx={{
                flex: 1,
                bgcolor: '#fff',
                '& .MuiOutlinedInput-root': { borderRadius: '8px' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
                '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
              }}
            />
          ))}
          <Button
            onClick={applyCurrentDay}
            sx={{
              bgcolor: isCurrentDay ? 'rgba(0,0,0,0.12)' : 'transparent',
              color: '#6f6f6f',
              fontSize: 16,
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: '12px',
              whiteSpace: 'nowrap',
              transition: 'background 200ms ease, color 200ms ease',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.16)' },
            }}
          >
            Current Day
          </Button>
        </Box>
        {calendarVisible && (
          <Box sx={{ display: 'flex', gap: '16px' }}>
            <MonthGrid
              month={calendarMonth}
              startDate={startDate}
              endDate={endDate}
              onPick={pickDay}
              onPrev={() => setCalendarMonth(subMonths(calendarMonth, 1))}
            />
            <MonthGrid
              month={addMonths(calendarMonth, 1)}
              startDate={startDate}
              endDate={endDate}
              onPick={pickDay}
              onNext={() => setCalendarMonth(addMonths(calendarMonth, 1))}
            />
          </Box>
        )}
      </Popover>

      {/* Run — own row below the filters, flush left */}
      <Box sx={{ mb: '16px' }}>
        <Button onClick={handleRun} sx={{ ...TOOLBAR_BUTTON_SX, minWidth: 62 }}>
          Run
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 0 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={TABLE_HEAD_SX}>
                {COLUMNS.map((column) => (
                  <TableCell key={column.key} align={column.numeric ? 'right' : 'left'}>
                    {column.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {displayRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length} align="center" sx={{ ...TABLE_CELL_SX, py: '24px' }}>
                    {hasRun
                      ? 'No inventory movement found for the selected criteria.'
                      : 'Select your filters and press Run.'}
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {displayRows.map((row, index) => (
                    <TableRow
                      key={`${row.id || row.productName}-${index}`}
                      sx={{
                        bgcolor: index % 2 === 0 ? '#fff' : '#f8f8f8',
                        '& td': { ...TABLE_CELL_SX, fontWeight: row.kind === 'group' ? 700 : 400 },
                      }}
                    >
                      {COLUMNS.map((column) => (
                        <TableCell key={column.key} align={column.numeric ? 'right' : 'left'}>
                          {cellText(row, column)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  <TableRow sx={TABLE_TOTAL_SX}>
                    {COLUMNS.map((column) => (
                      <TableCell key={column.key} align={column.numeric ? 'right' : 'left'}>
                        {column.key === 'productName'
                          ? 'Total'
                          : column.numeric
                            ? column.currency
                              ? money(totals[column.key])
                              : totals[column.key]
                            : ''}
                      </TableCell>
                    ))}
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <SaveReportDialog
        open={saveDialogOpen}
        onClose={(saved) => {
          setSaveDialogOpen(false);
          // Documented flow: saving redirects to Favourite Reports for the email settings.
          if (saved) navigate('/reports/favourite');
        }}
        reportType="inventory-movement"
        reportPath="/reports/inventory-movement"
        filters={{
          startDate: startDate ? format(startDate, 'yyyy-MM-dd') : '',
          endDate: endDate ? format(endDate, 'yyyy-MM-dd') : '',
          outletId: outletId || undefined,
          showProducts,
          grouping,
          costBasis,
        }}
      />
    </Box>
  );
};

export default InventoryMovement;
