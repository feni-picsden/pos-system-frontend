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
  Autocomplete,
  Checkbox,
  Chip,
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
  CheckBoxOutlineBlankOutlined as SquareIcon,
  CheckBoxOutlined as CheckSquareIcon,
} from '@mui/icons-material';
import {
  format,
  parse,
  isValid,
  isSameDay,
  isSameMonth,
  startOfDay,
  endOfDay,
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
import apiClient from '../../services/apiClient';
import productService from '../../services/productService';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';
import classificationService from '../../services/classificationService';
import supplierService from '../../services/supplierService';
import SaveReportDialog from '../../components/Reports/SaveReportDialog';
import { useAuth } from '../../contexts/AuthContext';
import useHeaderScope from '../../hooks/useHeaderScope';
import { useGlobalOutlet } from '../../components/Common/GlobalOutletFilter';
import { reportPrintTitle, reportPrintRange } from '../../utils/reportPrint';

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

// Reference: these three are button toggles, not dropdowns.
const SHOW_PRODUCTS_OPTIONS = [
  { value: 'movements', label: 'Only With Movements' },
  { value: 'all', label: 'All' },
];

const COST_OPTIONS = [
  { value: 'last', label: 'Last Cost' },
  { value: 'average', label: 'Average Cost' },
];

const TAX_OPTIONS = [
  { value: 'inclusive', label: 'Tax Inclusive' },
  { value: 'exclusive', label: 'Tax Exclusive' },
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
// Reference: "-$19.70", "$1,640.50", and "-$0.00" for a negative quantity at $0.
const money = (value) => {
  // Not num(): `-0 || 0` is 0, which would drop the reference's "-$0.00".
  const raw = Number(value);
  const n = Number.isFinite(raw) ? raw : 0;
  const negative = n < 0 || Object.is(n, -0);
  const text = Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${negative ? '-' : ''}$${text}`;
};
const qty = (value) => Math.round(num(value) * 100) / 100;

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
// `clearValue`: reference shows an ✕ that resets to it once something else is picked.
const RefSelect = ({ label, value, options, onChange, width = 358, clearValue }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const current = options.find((option) => option.value === value);

  return (
    <Box sx={{ width }}>
      <Typography sx={FIELD_LABEL_SX}>{label}</Typography>
      <Box sx={FIELD_BOX_SX} onClick={(e) => setAnchorEl(e.currentTarget)}>
        <Box sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current ? current.label : ''}
        </Box>
        {clearValue !== undefined && value !== clearValue && (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onChange(clearValue);
            }}
            sx={{ color: '#404040', p: '2px' }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
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

// Reference button toggle: 16px label, then the buttons centred in a 358px slot;
// the picked one is blue, the others dark.
const RefToggle = ({ label, value, options, onChange, width = 358 }) => (
  <Box sx={{ width }}>
    <Typography sx={{ fontSize: 16, color: '#000', mb: '4px' }}>{label}</Typography>
    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Button
            key={option.value}
            onClick={() => onChange(option.value)}
            disableRipple
            sx={{
              height: 53,
              p: '16px',
              borderRadius: 0,
              border: '1px solid #343a40',
              bgcolor: active ? '#1c9ee1' : '#343a40',
              color: '#f8f8f8',
              fontSize: 16,
              fontWeight: 400,
              textTransform: 'none',
              whiteSpace: 'nowrap',
              '&:hover': { bgcolor: active ? '#1c9ee1' : '#23272b' },
            }}
          >
            {option.label}
          </Button>
        );
      })}
    </Box>
  </Box>
);

// Reference "Outlets": multi-select, blank = every outlet the user can report on.
const OutletMultiSelect = ({ outlets, value, onChange, width = 358 }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const picked = outlets.filter((o) => value.includes(o.id));
  const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <Box sx={{ width }}>
      <Typography sx={FIELD_LABEL_SX}>&nbsp;</Typography>
      <Box sx={{ ...FIELD_BOX_SX, flexWrap: 'wrap', gap: '4px', py: '4px' }} onClick={(e) => setAnchorEl(e.currentTarget)}>
        {picked.map((o) => (
          <Box key={o.id} sx={{ bgcolor: 'rgba(0,0,0,0.10)', borderRadius: '4px', px: '8px', fontSize: 16, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {o.name}
          </Box>
        ))}
        <Box sx={{ flex: 1, minWidth: 60, color: '#808080' }}>{picked.length ? '' : 'Outlets'}</Box>
        {picked.length > 0 && (
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
        {outlets.map((o) => (
          <Box key={o.id} sx={optionSx(false)} onClick={() => toggle(o.id)}>
            {value.includes(o.id) ? <CheckBoxIcon sx={{ color: '#38a9e2' }} /> : <CheckBoxOutlineBlankIcon sx={{ color: '#404040' }} />}
            <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</Box>
          </Box>
        ))}
      </Popover>
    </Box>
  );
};

// Reference "Products and Classifications": the same type-to-search multi-select as
// Slow Moving Stock / Stocktaked Products — typed in the field itself, searches from
// two characters, picked rows (checked) + 'Keep Typing to Search...' below that, one
// grey chip ("N Selected..." for more), "x" clear-all. Results are grouped
// Products / Categories / Brands / Families / Suppliers.
const MIN_SEARCH = 2;
const HINT_ROW = { key: '__hint', name: 'Keep Typing to Search...' };

const PCF_FIELD_SX = {
  bgcolor: '#fff',
  '& .MuiOutlinedInput-root': {
    minHeight: 42,
    borderRadius: '8px',
    fontSize: 16,
    py: '3px',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#5e5e5e', borderWidth: '1px' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#5e5e5e', borderWidth: '1px' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
    '& input::placeholder': { color: '#808080', opacity: 1 },
  },
  '& .MuiAutocomplete-popupIndicator': { color: '#404040' },
  '& .MuiAutocomplete-clearIndicator': { color: '#404040', visibility: 'visible' },
};

const PCF_PANEL_PROPS = {
  paper: {
    sx: {
      border: '1px solid #000',
      borderRadius: '8px',
      boxShadow: 'none',
      mt: '4px',
      '& .MuiAutocomplete-listbox': { maxHeight: 288, py: 0 },
      '& .MuiAutocomplete-noOptions': { padding: '16px', fontSize: 16, color: '#252525' },
      '& .MuiAutocomplete-loading': { padding: '16px', fontSize: 16, color: '#252525' },
      '& .MuiAutocomplete-option': {
        minHeight: 56,
        padding: '16px',
        fontSize: 16,
        color: '#252525',
        '&.Mui-focused': { backgroundColor: '#f8f8f8' },
        "&[aria-selected='true']": { backgroundColor: '#fff', color: '#38bdf8' },
        "&[aria-selected='true'].Mui-focused": { backgroundColor: '#f8f8f8', color: '#38bdf8' },
      },
    },
  },
};

const ProductClassificationFilter = ({ selection, onChange, suppliers = [], width = 358 }) => {
  const [inputValue, setInputValue] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const term = inputValue.trim();
  const searching = term.length >= MIN_SEARCH;

  useEffect(() => {
    if (!searching) {
      setResults([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const [productRes, classificationRes] = await Promise.all([
          productService.getProducts({ search: term, limit: 20 }),
          classificationService.getClassifications({ search: term }),
        ]);
        if (cancelled) return;

        const products = productRes?.products || productRes?.data || [];
        const classifications = classificationRes?.classifications || [];
        const lower = term.toLowerCase();
        // Kept in heading order: Autocomplete groups consecutive rows only.
        const next = products.map((p) => ({ key: `product:${p.id}`, kind: 'product', id: p.id, name: p.name, heading: 'Products' }));
        CLASSIFICATION_GROUPS.forEach(({ type, heading }) => {
          // Suppliers live in their own table, not in classifications.
          const source = type === 'SUPPLIER'
            ? suppliers.filter((s) => (s.name || '').toLowerCase().includes(lower))
            : classifications.filter((c) => String(c.type).toUpperCase() === type);
          source.forEach((c) => next.push({ key: `${type}:${c.id}`, kind: type, id: c.id, name: c.name, heading }));
        });
        setResults(next);
      } catch (error) {
        console.error('Error searching products and classifications:', error);
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, searching, suppliers]);

  // Picked rows stay among the options (checked) even when this search did not
  // return them; sorted by heading because Autocomplete groups consecutive rows.
  const options = useMemo(() => {
    if (!searching) return [...selection, HINT_ROW];
    const order = ['Products', ...CLASSIFICATION_GROUPS.map((g) => g.heading)];
    const keys = new Set(results.map((o) => o.key));
    return [...results, ...selection.filter((s) => !keys.has(s.key))]
      .map((o, i) => ({ o, i }))
      .sort((a, b) => order.indexOf(a.o.heading) - order.indexOf(b.o.heading) || a.i - b.i)
      .map(({ o }) => o);
  }, [searching, results, selection]);

  return (
    <Box sx={{ width }}>
      {/* Reference: no label above this field, only the placeholder. */}
      <Typography sx={FIELD_LABEL_SX}>&nbsp;</Typography>
      <Autocomplete
        multiple
        disableCloseOnSelect
        clearIcon={<span style={{ fontSize: 18, lineHeight: 1 }}>×</span>}
        popupIcon={<ArrowDropDown />}
        options={options}
        value={selection}
        onChange={(e, next) => onChange(next.filter((o) => o.key !== HINT_ROW.key))}
        inputValue={inputValue}
        onInputChange={(e, next) => setInputValue(next)}
        filterOptions={(opts) => opts}
        groupBy={searching ? (o) => o.heading : undefined}
        getOptionLabel={(o) => o?.name || ''}
        getOptionKey={(o) => o.key}
        isOptionEqualToValue={(o, v) => o.key === v.key}
        getOptionDisabled={(o) => o.key === HINT_ROW.key}
        loading={searching && loading}
        loadingText="Searching..."
        noOptionsText="No Options"
        slotProps={PCF_PANEL_PROPS}
        sx={PCF_FIELD_SX}
        renderGroup={(params) => (
          <li key={params.key}>
            <Box sx={{ p: '16px', fontSize: 16, fontWeight: 700, color: '#000' }}>{params.group}</Box>
            <Box component="ul" sx={{ p: 0 }}>{params.children}</Box>
          </li>
        )}
        renderOption={(props, option, { selected }) => {
          const { key, ...optionProps } = props;
          if (option.key === HINT_ROW.key) {
            return (
              <li key={key} {...optionProps} aria-selected={false} style={{ opacity: 1, color: '#252525', cursor: 'default' }}>
                {HINT_ROW.name}
              </li>
            );
          }
          return (
            <li key={key} {...optionProps}>
              <Checkbox
                icon={<SquareIcon />}
                checkedIcon={<CheckSquareIcon />}
                checked={selected}
                disableRipple
                sx={{ p: 0, mr: '8px', color: '#252525', '&.Mui-checked': { color: '#252525' } }}
              />
              {option.name}
            </li>
          );
        }}
        renderTags={(vals) => (
          <Chip
            label={vals.length === 1 ? vals[0].name : `${vals.length} Selected...`}
            size="small"
            sx={{ bgcolor: 'rgba(0,0,0,0.1)', borderRadius: '4px', color: '#252525', fontSize: 16, height: 26, ml: '4px', maxWidth: 220 }}
          />
        )}
        renderInput={(params) => (
          <TextField {...params} placeholder={selection.length ? '' : 'Products and Classifications'} />
        )}
      />
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
  const [outletIds, setOutletIds] = useState([]);
  const [showProducts, setShowProducts] = useState('movements');
  const [costBasis, setCostBasis] = useState('last');
  const [taxMode, setTaxMode] = useState('inclusive');
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const { notify } = useAppDialogs();

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  // Header rule (16/10/2026): in-page Outlet filter hidden when a header outlet is selected.
  const { showOutletFilter, headerOutletId } = useHeaderScope();
  const { globalMode, outlets: headerOutlets } = useGlobalOutlet();
  useEffect(() => {
    if (!showOutletFilter && outletIds.length) setOutletIds([]);
  }, [showOutletFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Same source as the other inventory reports: every outlet the account is
    // assigned to; one without Reporting Access answers a red toast on Run.
    const loadOutlets = async () => {
      try {
        const res = await apiClient.get('/auth/report-outlets');
        const list = Array.isArray(res?.data?.assigned) && res.data.assigned.length
          ? res.data.assigned
          : (Array.isArray(res?.data?.outlets) ? res.data.outlets : []);
        setOutlets(list);
      } catch (error) {
        console.error('Error loading outlets for inventory movement:', error);
      }
    };

    loadOutlets();
  }, [user]);

  // Suppliers for the "Products and Classifications" search (own table, loaded once).
  const [suppliers, setSuppliers] = useState([]);
  useEffect(() => {
    supplierService.getSuppliers()
      .then((res) => setSuppliers(res?.suppliers || (Array.isArray(res) ? res : [])))
      .catch((error) => console.error('Error loading suppliers for inventory movement:', error));
  }, []);

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
    try {
      const filters = {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        outletIds: outletIds.length ? outletIds.join(',') : undefined,
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
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to load the report';
      notify?.(message, 'error', { position: 'top' });
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
        if (item.kind === 'SUPPLIER') return (row.supplierIds || []).includes(item.id);
        return false;
      });
    };

    // Product costs are stored tax-inclusive; "Tax Exclusive" divides by the
    // product's current rate (the note under Run says so, as the reference does).
    return reportData.filter(matches).map((row) => {
      const basis = costBasis === 'average' ? num(row.averageCost) : num(row.lastCost);
      const unit = taxMode === 'exclusive' ? basis / (num(row.taxMultiplier) || 1) : basis;
      const recosted = { ...row, closingCost: unit * (num(row.caseQuantity) || 1) };
      VALUE_PAIRS.forEach(([qtyKey, valueKey]) => {
        recosted[valueKey] = num(row[qtyKey]) * unit;
      });
      return recosted;
    });
  }, [reportData, selection, costBasis, taxMode]);

  // Reference grouping: a collapsible "▽ name" row per classification (no totals),
  // "No Group" first, then the names in order; its products hang under it.
  const displayRows = useMemo(() => {
    if (grouping === 'none') return rows.map((row) => ({ ...row, kind: 'row' }));

    const key = `${grouping}Name`;
    const buckets = new Map();
    rows.forEach((row) => {
      const name = row[key] || '';
      if (!buckets.has(name)) buckets.set(name, []);
      buckets.get(name).push(row);
    });

    const out = [];
    [...buckets.keys()].sort((a, b) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b))).forEach((name) => {
      const label = name || 'No Group';
      out.push({ kind: 'group', productName: label });
      if (!collapsedGroups.has(label)) buckets.get(name).forEach((row) => out.push({ ...row, kind: 'row', grouped: true }));
    });
    return out;
  }, [rows, grouping, collapsedGroups]);

  const toggleGroup = (label) => setCollapsedGroups((prev) => {
    const next = new Set(prev);
    if (next.has(label)) next.delete(label); else next.add(label);
    return next;
  });

  const cellText = (row, column) => {
    const value = row[column.key];
    if (column.currency) return money(value);
    if (column.numeric) return qty(value);
    return value ?? '';
  };

  const handleExportCSV = () => {
    const lines = [
      COLUMNS.map((c) => c.label),
      ...displayRows.map((row) => (row.kind === 'group'
        ? [row.productName]
        : COLUMNS.map((column) => cellText(row, column)))),
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

  // Reference Print (same as Inventory At Date): a NEW TAB with the print page —
  // outlet name / "Inventory Movement" / date range, ruled table, grey stripes,
  // bold group names — which then opens the browser's print dialog. Prints the
  // table as shown (chosen cost basis and tax mode).
  const handlePrint = () => {
    const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const outletList = headerOutlets?.length ? headerOutlets : outlets;
    const picked = outletList.filter((o) => outletIds.includes(o.id)).map((o) => o.name);
    const title = picked.length ? picked.join(' & ') : reportPrintTitle(outletList, globalMode, headerOutletId);
    const range = startDate && endDate ? reportPrintRange({ startDate: startOfDay(startDate), endDate: endOfDay(endDate), preset: 'custom' }) : '';
    const alignOf = (col) => (col.key === 'productId' || col.key === 'productName' ? 'left' : 'center');
    const head = COLUMNS.map((col) => `<th style="text-align:${alignOf(col)}">${esc(col.label)}</th>`).join('');
    let stripe = 0;
    const body = displayRows.map((row) => {
      if (row.kind === 'group') { stripe = 0; return `<tr class="grp"><td colspan="${COLUMNS.length}">${esc(row.productName)}</td></tr>`; }
      const cls = stripe++ % 2 === 0 ? 'odd' : 'even';
      return `<tr class="${cls}">${COLUMNS.map((col) => `<td style="text-align:${alignOf(col)}">${esc(cellText(row, col))}</td>`).join('')}</tr>`;
    }).join('');
    const note = taxMode === 'exclusive'
      ? '<div class="n">Exclusive costs are shown using the product&apos;s current tax rate, not the tax rate at the time of the movement.</div>'
      : '';
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Inventory Movement</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 16px 24px; }
        h1 { text-align: center; font-size: 22px; margin: 24px 0 12px; }
        h2 { text-align: center; font-size: 15px; margin: 0 0 8px; }
        .d { text-align: center; font-size: 12px; font-weight: 700; margin: 0 0 14px; }
        .n { font-size: 11px; margin: 0 0 10px; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        thead th { border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 6px 4px; font-weight: 700; }
        td { padding: 5px 4px; white-space: nowrap; }
        tr.odd td { background: #e8e8e8; }
        tr.grp td { font-weight: 700; font-size: 12px; padding: 8px 4px 4px; }
        tbody tr:last-child td { border-bottom: 2px solid #000; }
        tr { page-break-inside: avoid; }
        @page { size: landscape; margin: 10mm; }
      </style></head><body>
      <h1>${esc(title)}</h1><h2>Inventory Movement</h2><div class="d">${esc(range)}</div>${note}
      <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
      <script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 150); });</script>
      </body></html>`;
    const win = window.open('', '_blank');
    if (!win) { notify?.('Please allow pop-ups to print this report', 'error', { position: 'top' }); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
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

        <ProductClassificationFilter selection={selection} onChange={setSelection} suppliers={suppliers} />

        {/* Header rule (16/10/2026): hidden when a header outlet is selected, not removed */}
        {showOutletFilter && (
          <OutletMultiSelect outlets={outlets} value={outletIds} onChange={setOutletIds} />
        )}

        <RefSelect label="Grouping" value={grouping} options={GROUPING_OPTIONS} onChange={setGrouping} clearValue="none" />

        <RefToggle label="Show Products" value={showProducts} options={SHOW_PRODUCTS_OPTIONS} onChange={setShowProducts} />
      </Box>

      {/* Reference second row: the two cost toggles */}
      <Box sx={{ display: 'flex', gap: '16px', flexWrap: 'wrap', mb: '24px' }}>
        <RefToggle label="Cost to Use" value={costBasis} options={COST_OPTIONS} onChange={setCostBasis} />
        <RefToggle label="Show Costs As" value={taxMode} options={TAX_OPTIONS} onChange={setTaxMode} />
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
      {taxMode === 'exclusive' && (
        <Typography sx={{ fontSize: 16, color: '#000', mb: '16px' }}>
          Exclusive costs are shown using the product&apos;s current tax rate, not the tax rate at the time of the movement.
        </Typography>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : displayRows.length === 0 ? (
        // Reference: before Run, and when Run finds nothing, there is no table —
        // just this line under the Run button, at the left edge.
        <Typography sx={{ fontSize: 16, color: '#000', textAlign: 'left' }}>
          No inventory movements found, check the filters above and press run
        </Typography>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 0 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={TABLE_HEAD_SX}>
                {COLUMNS.map((column) => (
                  <TableCell key={column.key} align={column.key === 'productId' ? 'left' : 'center'}>
                    {column.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {displayRows.map((row, index) => (row.kind === 'group' ? (
                <TableRow
                  key={`group-${row.productName}`}
                  onClick={() => toggleGroup(row.productName)}
                  sx={{ bgcolor: '#e4e4e4', cursor: 'pointer', '& td': TABLE_CELL_SX }}
                >
                  <TableCell colSpan={COLUMNS.length}>
                    <Box component="span" sx={{ display: 'inline-block', width: 16, mr: '8px', fontSize: 12 }}>
                      {collapsedGroups.has(row.productName) ? '▷' : '▽'}
                    </Box>
                    {row.productName}
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow
                  key={`${row.id}-${index}`}
                  sx={{ bgcolor: index % 2 === 0 ? '#e4e4e4' : '#f8f8f8', '& td': TABLE_CELL_SX }}
                >
                  {COLUMNS.map((column) => (
                    <TableCell
                      key={column.key}
                      align={column.key === 'productId' ? 'left' : 'center'}
                      // Reference tree line: a rail down the group with a stub to each ID.
                      sx={column.key === 'productId' && row.grouped ? {
                        position: 'relative',
                        pl: '42px !important',
                        '&::before': { content: '""', position: 'absolute', left: 16, top: 0, bottom: 0, borderLeft: '1px solid #000' },
                        '&::after': { content: '""', position: 'absolute', left: 16, width: 16, top: '50%', borderTop: '1px solid #000' },
                      } : undefined}
                    >
                      {cellText(row, column)}
                    </TableCell>
                  ))}
                </TableRow>
              )))}
              {/* Reference footer: a plain sky bar, no totals */}
              <TableRow sx={TABLE_TOTAL_SX}>
                <TableCell colSpan={COLUMNS.length} sx={{ height: 36 }} />
              </TableRow>
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
          outletIds: outletIds.length ? outletIds.join(',') : undefined,
          showProducts,
          grouping,
          costBasis,
          taxMode,
        }}
      />
    </Box>
  );
};

export default InventoryMovement;
