import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Popover,
  Autocomplete,
  TextField,
  Checkbox,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
} from '@mui/material';
import {
  TableChartOutlined as ExportIcon,
  PrintOutlined as PrintIcon,
  SaveOutlined as SaveIcon,
  CalendarTodayOutlined as CalendarIcon,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  Close,
  ArrowDropDown,
  CheckBoxOutlineBlankOutlined as SquareIcon,
  CheckBoxOutlined as CheckSquareIcon,
} from '@mui/icons-material';
import {
  format,
  addMonths,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  isSameMonth,
  isWithinInterval,
} from 'date-fns';
import SaveReportDialog from '../../components/Reports/SaveReportDialog';
import productService from '../../services/productService';
import { userService } from '../../services/userService';
import { matchesProductSearch } from '../../utils/productSearch';
import { rankProducts } from '../../utils/searchRank';

// Reference Keys list (26/10 ss), alphabetical as shown there.
const PRODUCT_FIELD_OPTIONS = [
  'active',
  'additional',
  'alternateNames',
  'averageCost',
  'barcodes',
  'brandId',
  'caseQuantity',
  'categoryId',
  'components',
  'coreSupplierId',
  'costPercentage',
  'costTaxRateId',
  'costs',
  'createdAt',
  'deletedAt',
  'description',
  'familyId',
  'ignoreBarcodeHostChanges',
  'ignorePriceHostChanges',
  'image',
  'images',
  'invoiceNotes',
  'lastCost',
  'loyalty',
  'mergedFrom',
  'mergedInto',
  'metcashMsc',
  'name',
  'orderNotes',
  'preventManualDiscounts',
  'prices',
  'reorder',
  'requestPrice',
  'requestQuantity',
  'status',
  'suppliers',
  'tags',
  'taxRateId',
  'tempProduct',
  'trackInventory',
  'type',
  'usePriceLabel',
  'useScales',
];

// Reference type-to-search lists (Products, Users) show "Keep Typing to Search..."
// until this many characters are typed; picked rows stay listed above it.
const MIN_SEARCH = 2;
const HINT_ROW = { id: '__hint', name: 'Keep Typing to Search...', __hint: true };

// Reference toolbar buttons: square, flat, #5ebbeb, and they INVERT on hover.
const toolbarBtnSx = (minWidth) => ({
  height: 53,
  minWidth,
  padding: '16px',
  borderRadius: 0,
  border: '1px solid #5ebbeb',
  bgcolor: '#5ebbeb',
  color: '#f8f8f8',
  fontSize: 16,
  fontWeight: 400,
  textTransform: 'none',
  boxShadow: 'none',
  transition: 'background 0.2s ease, color 0.2s ease',
  '&:hover': { bgcolor: '#f8f8f8', color: '#5ebbeb', boxShadow: 'none' },
});

// Reference filter field: 42px tall, 8px radius, 1px #5e5e5e rail; the four
// fields share one row equally (flex: 1 in the row below).
const fieldSx = {
  width: '100%',
  bgcolor: '#fff',
  '& .MuiOutlinedInput-root': {
    minHeight: 42,
    borderRadius: '8px',
    fontSize: 16,
    py: '3px',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#5e5e5e', borderWidth: '1px' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#5e5e5e', borderWidth: '1px' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
  },
  '& .MuiInputLabel-root': { fontSize: 16, color: 'rgba(103,107,114,0.6)' },
  // Resting label sits vertically centred in the 44px box, 16px in — same spot
  // as the date field's placeholder text beside it.
  '& .MuiInputLabel-root:not(.MuiInputLabel-shrink)': { transform: 'translate(16px, 11px) scale(1)' },
  // Reference: once focused or filled the name moves ABOVE the box as small
  // dark text at its left edge (no notch cut into the border).
  '& .MuiInputLabel-root.MuiInputLabel-shrink': {
    color: '#313439',
    transform: 'translate(0px, -22px) scale(0.8)',
  },
  '& .MuiOutlinedInput-notchedOutline legend': { maxWidth: 0 },
  '& .MuiInputLabel-root.Mui-focused': { color: '#313439' },
  '& .MuiAutocomplete-popupIndicator': { color: '#313439' },
  '& .MuiAutocomplete-clearIndicator': { color: '#313439', visibility: 'visible' },
};

// Reference dropdown: anchored under the field, 288px scroll, 1px solid black,
// 8px radius, 56px rows with 16px padding, light-blue hover, sky-600 selected LABEL.
const panelSlotProps = {
  paper: {
    sx: {
      border: '1px solid #000',
      borderRadius: '8px',
      boxShadow: '0 20px 25px -5px rgba(0,0,0,0.10), 0 8px 10px -6px rgba(0,0,0,0.10)',
      mt: '4px',
      '& .MuiAutocomplete-listbox': { maxHeight: 288, py: 0 },
      '& .MuiAutocomplete-noOptions': { padding: '16px', fontSize: 16, color: '#262626' },
      // "&&" doubles the selector weight: MUI's own option rules (min-height auto
      // on desktop, its selected fill) otherwise win and squash the 56px rows.
      '&& .MuiAutocomplete-option': {
        minHeight: 56,
        padding: '16px',
        fontSize: 16,
        color: '#262626',
        '&:hover, &.Mui-focused': { backgroundColor: '#e0f2fe', color: '#000' },
        "&[aria-selected='true'], &[aria-selected='true'].Mui-focused": {
          backgroundColor: 'transparent',
          color: '#0284c7',
        },
        "&[aria-selected='true']:hover": { backgroundColor: '#e0f2fe' },
      },
    },
  },
};

// Reference filters are multi-selects showing grey chips in the field. Keys lists
// every option at once; Products / Users (typeToSearch) wait for typing.
const SearchMultiSelect = ({ label, options, value, onChange, getLabel = (o) => o, typeToSearch = false }) => (
  <Autocomplete
    autoHighlight
    multiple
    disableCloseOnSelect
    // Reference: a "x" clear-all sits beside the arrow whenever something is picked.
    clearIcon={<span style={{ fontSize: 18, lineHeight: 1 }}>×</span>}
    options={options}
    value={value}
    onChange={(e, newValue) => onChange(newValue.filter((o) => !o?.__hint))}
    getOptionLabel={(o) => (o?.__hint ? o.name : getLabel(o))}
    getOptionDisabled={(o) => !!o?.__hint}
    popupIcon={<ArrowDropDown />}
    // ponytail: cap the rendered list instead of pulling in a virtualiser
    filterOptions={(opts, state) => {
      // Sell-screen search rules (every typed word, any order, name /
      // description / barcode; best match first) for any option type.
      const input = state.inputValue.trim();
      if (typeToSearch && input.length < MIN_SEARCH) return [...value, HINT_ROW];
      if (!input) return opts.slice(0, 100);
      const wrapped = opts.map((o) => ({ o, name: getLabel(o), description: o?.description, barcodes: o?.barcodes }));
      return rankProducts(wrapped.filter((w) => matchesProductSearch(w, input)), input).map((w) => w.o).slice(0, 100);
    }}
    slotProps={panelSlotProps}
    sx={fieldSx}
    renderOption={(props, option, { selected }) => {
      const { key, ...optionProps } = props;
      if (option?.__hint) {
        return (
          <li key={key} {...optionProps} aria-selected={false} style={{ opacity: 1, color: '#262626', cursor: 'default' }}>
            {option.name}
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
            sx={{ p: 0, mr: '8px', color: 'inherit', '&.Mui-checked': { color: '#0284c7' } }}
          />
          {getLabel(option)}
        </li>
      );
    }}
    // Reference: the first two picks as grey chips (long names cut with "…"), then
    // one "N More..." chip; no per-chip x (the clear-all x removes everything).
    renderTags={(vals) => {
      const chipSx = { bgcolor: 'rgba(0,0,0,0.1)', borderRadius: '4px', color: '#000', fontSize: 16, maxWidth: 150, height: 26, mr: '6px', '& .MuiChip-label': { px: '8px' } };
      const shown = vals.slice(0, 2);
      return [
        ...shown.map((option, i) => <Chip key={i} label={getLabel(option)} size="small" sx={chipSx} />),
        ...(vals.length > 2 ? [<Chip key="more" label={`${vals.length - 2} More...`} size="small" sx={chipSx} />] : []),
      ];
    }}
    renderInput={(params) => <TextField {...params} label={label} />}
  />
);

const toInputValue = (d) => (d ? format(d, 'yyyy-MM-dd') : '');
const fromInputValue = (v) => (v ? new Date(`${v}T00:00:00`) : null);

// Reference date field: ONE bordered box holding two DD/MM/YYYY buttons split by an
// en-dash; the popover keeps its calendar open until an outside click.
const DateRangeField = ({ value, onChange, label }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [showCalendar, setShowCalendar] = useState(true);
  const [monthPicker, setMonthPicker] = useState(null);
  const [leftMonth, setLeftMonth] = useState(startOfMonth(value.startDate || new Date()));

  const { startDate, endDate } = value;
  const rightMonth = addMonths(leftMonth, 1);

  const setRange = (start, end, preset = 'custom') =>
    onChange({ startDate: start, endDate: end, preset });

  const handleDateClick = (day) => {
    if (!startDate || (startDate && endDate) || day < startDate) setRange(day, null);
    else setRange(startDate, day);
  };

  const inRange = (day) =>
    startDate && endDate && isWithinInterval(day, { start: startDate, end: endDate });
  const isEndpoint = (day) =>
    (startDate && format(day, 'yyyy-MM-dd') === format(startDate, 'yyyy-MM-dd')) ||
    (endDate && format(day, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd'));

  const dateInput = (which) => {
    const d = which === 'start' ? startDate : endDate;
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0 }}>
        <Box
          component="input"
          type="date"
          value={toInputValue(d)}
          onChange={(e) => {
            const parsed = fromInputValue(e.target.value);
            if (which === 'start') setRange(parsed, endDate);
            else setRange(startDate, parsed);
          }}
          sx={{
            flex: 1,
            minWidth: 0,
            height: 36,
            fontSize: 12,
            fontFamily: 'monospace',
            px: '8px',
            borderRadius: '8px',
            border: '1px solid #5e5e5e',
            bgcolor: '#fff',
          }}
        />
        {d && (
          <IconButton
            size="small"
            aria-label={`Clear ${which} date`}
            onClick={() => (which === 'start' ? setRange(null, endDate) : setRange(startDate, null))}
            sx={{ p: '2px', color: '#6f6f6f' }}
          >
            <Close sx={{ fontSize: 14 }} />
          </IconButton>
        )}
      </Box>
    );
  };

  const renderMonth = (month, isLeft) => {
    const monthStart = startOfMonth(month);
    const gridStart = new Date(monthStart);
    gridStart.setDate(gridStart.getDate() - ((gridStart.getDay() + 6) % 7));
    const gridEnd = endOfMonth(month);
    gridEnd.setDate(gridEnd.getDate() + ((7 - gridEnd.getDay()) % 7));

    const days = [];
    for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }

    return (
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {isLeft ? (
            <IconButton
              aria-label="Previous month"
              onClick={() => setLeftMonth(addMonths(leftMonth, -1))}
              sx={{ width: 30, height: 45, borderRadius: '12px', color: '#0284c7' }}
            >
              <KeyboardArrowLeft />
            </IconButton>
          ) : (
            <Box sx={{ width: 30 }} />
          )}
          <Box
            component="button"
            type="button"
            onClick={() => setMonthPicker(monthPicker === (isLeft ? 'left' : 'right') ? null : isLeft ? 'left' : 'right')}
            sx={{
              border: 0,
              bgcolor: 'transparent',
              cursor: 'pointer',
              fontSize: 18,
              fontWeight: 700,
              color: '#313439',
              borderRadius: '12px',
              px: '8px',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
            }}
          >
            {format(month, 'MMMM yyyy')}
          </Box>
          {isLeft ? (
            <Box sx={{ width: 30 }} />
          ) : (
            <IconButton
              aria-label="Next month"
              onClick={() => setLeftMonth(addMonths(leftMonth, 1))}
              sx={{ width: 30, height: 45, borderRadius: '12px', color: '#0284c7' }}
            >
              <KeyboardArrowRight />
            </IconButton>
          )}
        </Box>

        {monthPicker === (isLeft ? 'left' : 'right') ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', mt: 1 }}>
            {Array.from({ length: 12 }, (_, i) => new Date(month.getFullYear(), i, 1)).map((m) => (
              <Box
                component="button"
                type="button"
                key={m.getMonth()}
                onClick={() => {
                  setLeftMonth(isLeft ? m : addMonths(m, -1));
                  setMonthPicker(null);
                }}
                sx={{
                  height: 38,
                  border: 0,
                  cursor: 'pointer',
                  borderRadius: '12px',
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#0284c7',
                  bgcolor: 'transparent',
                  '&:hover': { bgcolor: '#e0f2fe' },
                }}
              >
                {format(m, 'MMM')}
              </Box>
            ))}
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', justifyItems: 'center' }}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <Typography key={i} sx={{ fontSize: 14, fontWeight: 700, color: '#6f6f6f', py: '4px' }}>
                  {d}
                </Typography>
              ))}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', justifyItems: 'center' }}>
              {days.map((day) => {
                const currentMonth = isSameMonth(day, month);
                const endpoint = isEndpoint(day);
                return (
                  <Box
                    component="button"
                    type="button"
                    key={day.toISOString()}
                    onClick={() => handleDateClick(day)}
                    sx={{
                      width: 38,
                      height: 38,
                      border: 0,
                      cursor: 'pointer',
                      borderRadius: '12px',
                      fontSize: 16,
                      fontWeight: 700,
                      transition: 'all 0s',
                      bgcolor: endpoint
                        ? 'oklch(0.685 0.169 237.323)'
                        : inRange(day)
                        ? '#e0f2fe'
                        : 'transparent',
                      color: endpoint ? '#fff' : currentMonth ? '#0284c7' : 'rgba(111,111,111,0.5)',
                      '&:hover': { bgcolor: endpoint ? 'oklch(0.685 0.169 237.323)' : '#e0f2fe' },
                    }}
                  >
                    {format(day, 'd')}
                  </Box>
                );
              })}
            </Box>
          </>
        )}
      </Box>
    );
  };

  // Reference: empty field shows the label INSIDE as a placeholder; once a date
  // is picked the label moves above the box (same as the combos' floating label).
  const hasValue = Boolean(startDate || endDate);

  return (
    <Box sx={{ width: '100%', position: 'relative' }}>
      {hasValue && (
        <Typography
          sx={{ position: 'absolute', top: -20, left: 0, fontSize: 12.8, color: '#6f6f6f', lineHeight: '18px' }}
        >
          {label}
        </Typography>
      )}
      <Box
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          height: 44, // same rendered height as the combos beside it
          bgcolor: '#fff',
          border: '1px solid #5e5e5e',
          borderRadius: '8px',
          cursor: 'pointer',
        }}
      >
        {!hasValue && (
          <Typography sx={{ px: '16px', fontSize: 16, color: 'rgba(103,107,114,0.6)' }}>{label}</Typography>
        )}
        {hasValue && ['start', 'end'].map((which, i) => {
          const d = which === 'start' ? startDate : endDate;
          return (
            <React.Fragment key={which}>
              {i > 0 && <Typography sx={{ color: '#6f6f6f' }}>–</Typography>}
              <Box
                component="button"
                type="button"
                sx={{
                  flex: 1,
                  minWidth: 0,
                  padding: '8px 16px',
                  border: 0,
                  bgcolor: 'transparent',
                  fontSize: 16,
                  fontWeight: 400,
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: d ? '#000' : '#808080',
                }}
              >
                {d ? format(d, 'dd/MM/yyyy') : 'DD/MM/YYYY'}
              </Box>
            </React.Fragment>
          );
        })}
      </Box>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{
          sx: {
            p: 2,
            width: 622,
            bgcolor: '#f7f7f7',
            border: '1px solid #e5e5e5',
            borderRadius: '12px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
          },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {dateInput('start')}
            {dateInput('end')}
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <IconButton
              aria-label="Toggle calendar"
              onClick={() => setShowCalendar((s) => !s)}
              sx={{
                width: 38,
                height: 42,
                borderRadius: '12px',
                color: '#0284c7',
                bgcolor: showCalendar ? 'rgba(0,0,0,0.05)' : 'transparent',
              }}
            >
              <CalendarIcon fontSize="small" />
            </IconButton>
            <Box
              component="button"
              type="button"
              onClick={() => {
                const today = new Date();
                setLeftMonth(startOfMonth(today));
                setRange(today, today, 'today');
              }}
              sx={{
                width: 107,
                height: 42,
                border: 0,
                cursor: 'pointer',
                bgcolor: 'transparent',
                borderRadius: '12px',
                fontSize: 16,
                fontWeight: 700,
                color: '#6f6f6f',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
              }}
            >
              Current Day
            </Box>
          </Box>

          {showCalendar && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              {renderMonth(leftMonth, true)}
              {renderMonth(rightMonth, false)}
            </Box>
          )}
        </Box>
      </Popover>
    </Box>
  );
};

// Pink = a row the change removed (From side), green = a row it added (To side).
const TONE_BG = { removed: '#f8d7da', added: '#d4edda' };
const MINI_CELL = { border: '1px solid #000', padding: '8px', fontSize: 16, color: '#000' };

// Reference nested table: black 1px grid, bold centred header, plain cells.
const MiniTable = ({ title, headers, rows }) => (
  <Box>
    {title && <Typography sx={{ fontWeight: 700, fontSize: 16, textAlign: 'center', mb: '4px' }}>{title}</Typography>}
    <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
      {headers && (
        <thead>
          <tr>
            {headers.map((h) => (
              <Box component="th" key={h} sx={{ ...MINI_CELL, fontWeight: 700, textAlign: 'center' }}>{h}</Box>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((r, i) => (
          <Box component="tr" key={i} sx={{ bgcolor: r.tone ? TONE_BG[r.tone] : 'transparent' }}>
            {r.span ? (
              <Box component="td" colSpan={headers?.length || 2} sx={{ ...MINI_CELL, textAlign: r.spanAlign || 'center' }}>{r.span}</Box>
            ) : (
              r.cells.map((c, j) => <Box component="td" key={j} sx={MINI_CELL}>{c}</Box>)
            )}
          </Box>
        ))}
      </tbody>
    </Box>
  </Box>
);


const ProductRevisionHistory = () => {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(),
    endDate: new Date(),
    preset: 'today',
  });
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [users, setUsers] = useState([]);
  const [reportData, setReportData] = useState([]);
  // Names for ids in the revision values (brand / category / family / tags,
  // suppliers, outlets), sent by the report API with each run.
  const [lookups, setLookups] = useState({ classifications: {}, suppliers: {}, outlets: [] });
  const [loading, setLoading] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  // Reference /reports/misc/revisions/<product id>: open with that product picked
  // (all dates) and the report already run.
  const [searchParams] = useSearchParams();
  const presetProductId = searchParams.get('productId');

  useEffect(() => {
    const loadProducts = async () => {
      try {
        // Without a limit the server answers its default 50, so only the first
        // 50 products could ever be picked in this filter.
        const result = await productService.getProducts({ includeAllStatuses: true, limit: 5000 });
        const list = Array.isArray(result?.products)
          ? result.products
          : Array.isArray(result)
          ? result
          : [];
        setProducts(list);
        if (presetProductId) {
          const preset = list.find((p) => String(p.id) === String(presetProductId));
          if (preset) {
            setSelectedProducts([preset]);
            setDateRange({ startDate: null, endDate: null, preset: 'custom' });
            setAutoRunFor(preset.id);
          }
        }
      } catch (error) {
        console.error('Error loading products for revision history:', error);
      }
    };

    loadProducts();

    // Reference "Users" filter: who made the change.
    const loadUsers = async () => {
      try {
        const result = await userService.getUsers();
        const list = Array.isArray(result?.users) ? result.users : Array.isArray(result) ? result : [];
        setUsers(list);
      } catch (error) {
        console.error('Error loading users for revision history:', error);
      }
    };

    loadUsers();
  }, []);

  const activeFilters = {
    // The range is inclusive by day, so widen it to cover the whole first/last day.
    startDate: dateRange.startDate ? startOfDay(dateRange.startDate).toISOString() : undefined,
    endDate: dateRange.endDate ? endOfDay(dateRange.endDate).toISOString() : undefined,
    fields: selectedKeys,
    productIds: selectedProducts.map((p) => p.id),
    userIds: selectedUsers.map((u) => u.id),
  };

  const handleRun = async (filters = activeFilters) => {
    setLoading(true);
    try {
      const response = await productService.getProductRevisionHistory(filters);
      if (response.success) {
        setReportData(response.data || []);
        setLookups({ classifications: {}, suppliers: {}, outlets: [], ...(response.lookups || {}) });
      } else {
        setReportData([]);
      }
    } catch (error) {
      console.error('Error loading product revision history:', error);
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-run once the preset product is in state (state is set asynchronously above).
  const [autoRunFor, setAutoRunFor] = useState(null);
  useEffect(() => {
    if (autoRunFor && selectedProducts.some((p) => p.id === autoRunFor)) {
      setAutoRunFor(null);
      handleRun({ fields: [], productIds: [autoRunFor], userIds: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunFor, selectedProducts]);

  const formatTimestamp = (date) => {
    if (!date) return '';
    try {
      return format(new Date(date), 'dd/MM/yyyy HH:mm:ss');
    } catch {
      return '';
    }
  };

  const tryParseJson = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return value;
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  };

  const handleExportCSV = () => {
    const header = ['Product', 'Field', 'From', 'To', 'User', 'Timestamp'];
    const rows = reportData.map((row) => [
      row.productName,
      row.field,
      row.from,
      row.to,
      row.user,
      formatTimestamp(row.timestamp),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'product-revision-history.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ---- Reference value cells (26/10 ss) -------------------------------------
  const money = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v ?? '');
    return `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`;
  };
  const asArray = (v) => {
    const parsed = Array.isArray(v) ? v : tryParseJson(v);
    return Array.isArray(parsed) ? parsed : null;
  };
  const outletName = (row) => {
    if (row?.outlet) return row.outlet;
    const o = (lookups.outlets || []).find((x) => x.id === Number(row?.outletId));
    return o ? o.name : 'Default';
  };
  // Rows on this side that the other side does not have (by their own key).
  const diffTone = (list, other, keyOf, isFrom) => {
    const otherKeys = new Set((other || []).map(keyOf));
    return (row) => (otherKeys.has(keyOf(row)) ? null : isFrom ? 'removed' : 'added');
  };

  const renderPrices = (value, otherValue, isFrom) => {
    const list = asArray(value);
    if (!list) return String(value ?? '');
    if (list.length === 0) return '';
    const keyOf = (p) => `${Number(p.quantity)}|${Number(p.price)}|${p.priceSet || 'Default'}`;
    const tone = diffTone(list, asArray(otherValue), keyOf, isFrom);
    return (
      <MiniTable
        headers={['Quantity', 'Price', 'Price Set']}
        rows={list.map((p) => ({ tone: tone(p), cells: [p.quantity, money(p.price), p.priceSet || 'Default'] }))}
      />
    );
  };

  const renderCosts = (value, otherValue, isFrom) => {
    const list = asArray(value);
    if (!list) return String(value ?? '');
    if (list.length === 0) return '';
    const keyOf = (c) => `${outletName(c)}|${Number(c.lastCost)}|${Number(c.averageCost)}`;
    const tone = diffTone(list, asArray(otherValue), keyOf, isFrom);
    return (
      <MiniTable
        headers={['Outlet', 'Last Cost', 'Average Cost']}
        rows={list.map((c) => ({ tone: tone(c), cells: [outletName(c), money(c.lastCost), money(c.averageCost)] }))}
      />
    );
  };

  // Reference barcodes: Quantity / Code in the saved order; a code the other side
  // lacks is pink (From) / green (To); an unreadable old value says so instead.
  const renderBarcodes = (value, otherValue, isFrom) => {
    const list = asArray(value);
    if (!list) {
      return value === null || value === undefined || value === ''
        ? ''
        : 'The barcodes changed, but we could not parse the changes';
    }
    if (list.length === 0) return '';
    const keyOf = (b) => `${Number(b.quantity)}|${b.code}`;
    const tone = diffTone(list, asArray(otherValue), keyOf, isFrom);
    return <MiniTable headers={['Quantity', 'Code']} rows={list.map((b) => ({ tone: tone(b), cells: [b.quantity, b.code] }))} />;
  };

  // Reference lastCost / averageCost: "$84" with the cents in small type.
  const renderSmallCents = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    const [whole, cents] = Math.abs(n).toFixed(2).split('.');
    return <span>{n < 0 ? '-' : ''}${whole}<Box component="span" sx={{ fontSize: '0.7em' }}>.{cents}</Box></span>;
  };

  // Reference reorder: per outlet, a heading row then the nine settings. A
  // snapshot with no outlet (global product) applies to every outlet.
  const REORDER_ROWS = [
    ['Single Reorder Level', 'reorderLevelItems'], ['Case Reorder Level', 'reorderLevelCases'],
    ['Single Reorder Amount', 'reorderAmountItems'], ['Case Reorder Amount', 'reorderAmountCases'],
    ['Single Reorder Limit', 'reorderLimitItems'], ['Case Reorder Limit', 'reorderLimitCases'],
    ['Single Max Quantity', 'maxOnHandItems'], ['Case Max Quantity', 'maxOnHandCases'],
    ['Reorder Rounding', 'reorderRounding'],
  ];
  const renderReorder = (value) => {
    const list = asArray(value);
    if (!list || list.length === 0) return '';
    const rows = [];
    list.forEach((entry) => {
      const outlets = entry.outletId == null
        ? (lookups.outlets || [])
        : [{ name: outletName(entry) }];
      outlets.forEach((o) => {
        rows.push({ span: o.name, spanAlign: 'left' });
        REORDER_ROWS.forEach(([label, key]) => {
          let v = entry[key];
          if (key === 'reorderRounding' && v === 'No Rounding') v = 'none';
          rows.push({ cells: [label, v === null || v === undefined ? '' : String(v)] });
        });
      });
    });
    return <MiniTable headers={['Field', 'Value']} rows={rows} />;
  };

  // Reference components: raw JSON, one entry per line, never wrapped.
  const renderComponents = (value) => {
    const list = asArray(value);
    if (!list || list.length === 0) return '';
    const lines = list.map((c, i) => `${i === 0 ? '[' : ''}${JSON.stringify(c)}${i === list.length - 1 ? ']' : ','}`);
    return <Box sx={{ whiteSpace: 'pre' }}>{lines.join('\n')}</Box>;
  };

  // Reference images: From only says they changed; To lists file names, each a
  // link to the image.
  const renderImages = (value, isFrom) => {
    if (isFrom) return 'The images changed, but we could not parse the changes';
    const list = asArray(value);
    if (!list || list.length === 0) return '';
    return (
      <Box component="ul" sx={{ m: 0, pl: '24px' }}>
        {list.map((url, i) => (
          <li key={i}>
            <a href={url} target="_blank" rel="noopener noreferrer">{String(url).split('/').pop()}</a>
          </li>
        ))}
      </Box>
    );
  };

  // Reference suppliers: one block per supplier (name heading), Field / Value
  // rows for Code and Minimum Order Quantity, then Replacement Costs per outlet.
  const renderSuppliers = (value, otherValue, isFrom) => {
    const list = asArray(value);
    if (!list) return String(value ?? '');
    if (list.length === 0) return '';
    const other = asArray(otherValue) || [];
    const changeTone = isFrom ? 'removed' : 'added';
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {list.map((s, i) => {
          const twin = other.find((o) => Number(o.supplierId) === Number(s.supplierId));
          const toneFor = (field) => (!twin || String(twin[field] ?? '') !== String(s[field] ?? '') ? changeTone : null);
          const replacement = s.replacementCost && s.replacementCost !== 'Inherit From Product' ? s.replacementCost : '';
          const name = lookups.suppliers?.[s.supplierId] || `Supplier #${s.supplierId}`;
          return (
            <MiniTable
              key={i}
              title={name}
              headers={['Field', 'Value']}
              rows={[
                { tone: toneFor('code'), cells: ['Code', s.code ?? ''] },
                { tone: toneFor('minimumOrderQuantity'), cells: ['Minimum Order Quantity', s.minimumOrderQuantity ?? ''] },
                { span: 'Replacement Costs' },
                ...(lookups.outlets || []).map((o) => ({
                  tone: twin && String(twin.replacementCost ?? '') !== String(s.replacementCost ?? '') ? changeTone : null,
                  cells: [o.name, replacement === '' ? '' : (Number.isFinite(Number(replacement)) ? money(replacement) : replacement)],
                })),
              ]}
            />
          );
        })}
      </Box>
    );
  };

  // Reference tags: a bullet list of tag names.
  const renderTags = (value) => {
    const list = asArray(value);
    if (!list) return String(value ?? '');
    if (list.length === 0) return '';
    return (
      <Box component="ul" sx={{ m: 0, pl: '24px' }}>
        {list.map((id, i) => <li key={i}>{lookups.classifications?.[id] || String(id)}</li>)}
      </Box>
    );
  };

  const CLASS_EMPTY = { brandId: 'No Brand', categoryId: 'No Category', familyId: 'No Family' };

  const renderValueCell = (row, isFrom) => {
    const field = row.field;
    const value = isFrom ? (row.fromRaw ?? row.from) : (row.toRaw ?? row.to);
    const otherValue = isFrom ? (row.toRaw ?? row.to) : (row.fromRaw ?? row.from);
    // Lifecycle rows (createdAt / deletedAt) carry a timestamp: show it the way
    // the Timestamp column does, not as a raw ISO string.
    // (deletedAt arrives already in the reference's raw UTC form.)
    if (field === 'createdAt') {
      return <span>{value ? formatTimestamp(value) : ''}</span>;
    }
    if (field === 'prices') return renderPrices(value, otherValue, isFrom);
    if (field === 'costs') return renderCosts(value, otherValue, isFrom);
    if (field === 'barcodes') return renderBarcodes(value, otherValue, isFrom);
    if (field === 'suppliers') return renderSuppliers(value, otherValue, isFrom);
    if (field === 'tags') return renderTags(value);
    if (field === 'lastCost' || field === 'averageCost') return renderSmallCents(value);
    if (field === 'reorder') return renderReorder(value);
    if (field === 'components') return renderComponents(value);
    if (field === 'images') return renderImages(value, isFrom);
    if (field === 'coreSupplierId') {
      if (value === null || value === undefined || value === '') return 'No Supplier';
      return lookups.suppliers?.[value] || String(value);
    }
    if (CLASS_EMPTY[field]) {
      if (value === null || value === undefined || value === '') return CLASS_EMPTY[field];
      return lookups.classifications?.[value] || String(value);
    }
    // Reference: the description text is never shown, only that it changed —
    // and nothing at all when there was no description before.
    if (field === 'description') {
      return isFrom && value ? 'The description changed, but we could not display the content.' : '';
    }
    // Reference shows true / false as 1 / 0.
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (value === 'true' || value === 'false') return value === 'true' ? '1' : '0';

    const parsed = tryParseJson(value);
    if (typeof parsed === 'object' && parsed !== null) {
      return (
        <pre style={{ margin: 0, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(parsed, null, 2)}
        </pre>
      );
    }

    return <span>{value === null || value === undefined ? '' : String(value)}</span>;
  };

  return (
    <Box sx={{ px: '16px', pt: '16px', pb: 4, bgcolor: '#fff', minHeight: 'calc(100vh - 50px)' }}>
      {/* Reference print sheet: the results region drops out of sticky/scroll flow. */}
      <style>{`@media print {
        .revision-noprint { display: none !important; }
        .revision-results { position: static !important; overflow: initial !important; max-height: none !important; }
        .revision-results th { position: static !important; box-shadow: none !important; background: inherit !important; }
      }`}</style>

      {/* Reference opens straight on the toolbar — it renders no page heading. */}
      <Box className="revision-noprint" sx={{ display: 'flex', gap: '16px', mb: '16px' }}>
        <Button onClick={handleExportCSV} startIcon={<ExportIcon />} disableElevation disableRipple sx={toolbarBtnSx(142)}>
          Export CSV
        </Button>
        <Button onClick={() => window.print()} startIcon={<PrintIcon />} disableElevation disableRipple sx={toolbarBtnSx(95)}>
          Print
        </Button>
        <Button onClick={() => setSaveDialogOpen(true)} startIcon={<SaveIcon />} disableElevation disableRipple sx={toolbarBtnSx(96)}>
          Save
        </Button>
      </Box>

      {/* Reference: the four filters share ONE row, equal widths (labels float
          above once a value is set, so leave room for them). */}
      <Box
        className="revision-noprint"
        sx={{
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-end',
          mt: '24px',
          '& > *': { flex: 1, minWidth: 0 },
          '@media (max-width: 1100px)': { flexWrap: 'wrap', '& > *': { flex: '1 1 45%' } },
        }}
      >
        <DateRangeField value={dateRange} onChange={setDateRange} label="Date Range (inclusive)" />
        {/* Blank Keys = all revision types; blank Products = all products. */}
        <SearchMultiSelect label="Keys" options={PRODUCT_FIELD_OPTIONS} value={selectedKeys} onChange={setSelectedKeys} />
        <SearchMultiSelect
          label="Products"
          options={products}
          value={selectedProducts}
          onChange={setSelectedProducts}
          getLabel={(o) => o?.name || ''}
          typeToSearch
        />
        <SearchMultiSelect
          label="Users"
          options={users}
          value={selectedUsers}
          onChange={setSelectedUsers}
          getLabel={(o) => o?.name || o?.username || ''}
          typeToSearch
        />
      </Box>

      {/* Reference: Run sits on its own row in the same square sky block as the
          toolbar; focus draws a 2px black rail. */}
      <Box className="revision-noprint" sx={{ mt: '32px', mb: '16px' }}>
        <Button
          onClick={() => handleRun()}
          disabled={loading}
          disableElevation
          disableRipple
          sx={{
            ...toolbarBtnSx(62),
            '&:focus-visible': { outline: '2px solid #000', outlineOffset: 0 },
            '&.Mui-disabled': { bgcolor: '#5ebbeb', color: '#f8f8f8', opacity: 0.6 },
          }}
        >
          {loading ? <CircularProgress size={20} sx={{ color: '#f8f8f8' }} /> : 'Run'}
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress sx={{ color: '#5ebbeb' }} />
        </Box>
      ) : reportData.length === 0 ? (
        // Reference: before Run, and when Run finds nothing, there is no table at
        // all — just this one line under the Run button, at the left edge.
        <Typography sx={{ fontSize: 16, color: '#000', textAlign: 'left', mt: '8px' }}>
          No revisions found, check the filters above and press run
        </Typography>
      ) : (
        // Reference table: black 1px grid everywhere, white header with bold black
        // centred titles that sticks (with a soft shadow) while scrolling, a grey
        // "Please Note" row, no stripes.
        <TableContainer
          className="revision-results"
          sx={{ borderRadius: 0, boxShadow: 'none', overflow: 'auto', maxHeight: 'calc(100vh - 260px)' }}
        >
          <Table
            size="small"
            stickyHeader
            // Separate borders (right + bottom per cell, left + top on the edges):
            // with collapsed borders a sticky header loses its lines once scrolled.
            sx={{
              borderCollapse: 'separate',
              borderSpacing: 0,
              borderLeft: '1px solid #000',
              '& th, & td': {
                borderRight: '1px solid #000',
                borderBottom: '1px solid #000',
                color: '#000',
                fontSize: 16,
                padding: '8px',
              },
              // Reference: Product / Field / User / Timestamp sit mid-height in tall rows.
              '& td': { verticalAlign: 'middle' },
            }}
          >
            <TableHead>
              <TableRow
                sx={{
                  '& th': {
                    bgcolor: '#fff',
                    fontWeight: 700,
                    textAlign: 'center',
                    borderTop: '1px solid #000',
                    // Reference: a soft grey shadow under the sticky header.
                    boxShadow: '0 6px 8px -4px rgba(0,0,0,0.25)',
                    zIndex: 2,
                  },
                }}
              >
                <TableCell>Product</TableCell>
                <TableCell>Field</TableCell>
                <TableCell>From</TableCell>
                <TableCell>To</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Timestamp</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {/* Reference prints this notice as the first body row of the report. */}
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ bgcolor: '#f0f0f0' }}>
                  Please Note: Revisions may take up to five minutes to appear
                </TableCell>
              </TableRow>
              {reportData.map((row, index) => (
                <TableRow key={index} sx={{ bgcolor: '#fff' }}>
                  <TableCell>{row.productName}</TableCell>
                  <TableCell>{row.field}</TableCell>
                  <TableCell>{renderValueCell(row, true)}</TableCell>
                  <TableCell>{renderValueCell(row, false)}</TableCell>
                  <TableCell>{row.user}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatTimestamp(row.timestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <SaveReportDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        reportType="product-revision-history"
        reportPath="/reports/product-revision-history"
        filters={activeFilters}
        defaultName="Product Revision History"
        alwaysDynamic
      />
    </Box>
  );
};

export default ProductRevisionHistory;
