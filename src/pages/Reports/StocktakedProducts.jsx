import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Autocomplete,
  Checkbox,
  Chip,
  Popover,
  IconButton,
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
  ArrowDropDown,
  CalendarTodayOutlined as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CheckBoxOutlineBlankOutlined as SquareIcon,
  CheckBoxOutlined as CheckSquareIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import useHeaderScope from '../../hooks/useHeaderScope';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';
import apiClient from '../../services/apiClient';
import inventoryReportService from '../../services/inventoryReportService';
import productService from '../../services/productService';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
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
} from 'date-fns';

// ponytail: reference chrome is copied per page (the sibling Reports pages own their
// own copies) so parallel parity work can't collide in a shared component.

const DATE_FORMAT = 'dd/MM/yyyy';
const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Reference requires three characters before a classification filter searches.
const MIN_SEARCH = 3;

// Reference tokens: 42px fields, 8px radius, #404040 rail, retracting label
// (16px grey inside when empty -> 12.8px slate above when filled).
const fieldSx = {
  bgcolor: '#fff',
  '& .MuiOutlinedInput-root': {
    minHeight: 42,
    borderRadius: '8px',
    fontSize: 16,
    py: '3px',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
  },
  '& input::placeholder': { color: '#676b72', opacity: 1 },
  '& .MuiAutocomplete-popupIndicator': {
    color: '#313439',
    transition: 'background 200ms ease',
    '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
  },
  '& .MuiAutocomplete-clearIndicator': { color: '#313439', visibility: 'visible' },
};
// Reference (26/10 ss): the field name sits as small text ABOVE the box.
const LABEL_SX = { fontSize: 13, color: '#313439', mb: '4px', lineHeight: 1.2 };
const FIELD_BOX_SX = { flex: '1 1 0', minWidth: 220 };

// Reference header: ⇕ after every label; `active` = 'asc' | 'desc' fills the
// triangle of the current sort direction (same as InventoryReport.jsx).
const SortIcon = ({ active }) => (
  <svg width="10" height="14" viewBox="0 0 10 14" style={{ marginLeft: 4, verticalAlign: 'middle', display: 'inline-block' }} aria-hidden="true">
    <path d="M1 5.5 L5 1.5 L9 5.5 Z" fill={active === 'asc' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active === 'asc' ? 1.6 : 1.1} strokeLinejoin="round" />
    <path d="M1 8.5 L5 12.5 L9 8.5 Z" fill={active === 'desc' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active === 'desc' ? 1.6 : 1.1} strokeLinejoin="round" />
  </svg>
);

// Reference dropdown: white panel, 1px SOLID BLACK, 8px radius, 288px scroll,
// xl shadow, no open/close transition, 56px option rows with 16px padding.
const panelSx = (selectedSx, focusedSx = { backgroundColor: 'rgba(0,0,0,0.04)' }) => ({
  paper: {
    sx: {
      border: '1px solid #000',
      borderRadius: '8px',
      boxShadow: '0 20px 25px -5px rgba(0,0,0,0.10), 0 8px 10px -6px rgba(0,0,0,0.10)',
      mt: '4px',
      '& .MuiAutocomplete-listbox': { maxHeight: 288, py: 0 },
      '& .MuiAutocomplete-noOptions': { padding: '16px', fontSize: 16, color: '#262626' },
      '& .MuiAutocomplete-option': {
        minHeight: 56,
        padding: '16px',
        fontSize: 16,
        color: '#262626',
        '&.Mui-focused': focusedSx,
        "&[aria-selected='true']": selectedSx,
        "&[aria-selected='true'].Mui-focused": { ...selectedSx, ...focusedSx },
      },
    },
  },
});

// Reference (26/10 ss): picked rows show blue text on white; the hovered/focused
// row (picked or not) is sky. The single outlet panel just recolours the label.
const multiPanelSlotProps = panelSx({ backgroundColor: '#fff', color: '#38bdf8' }, { backgroundColor: '#7dd3fc' });
const singlePanelSlotProps = panelSx({ backgroundColor: '#fff', color: '#38bdf8' });
// Pseudo row shown under the picked items while the search is too short.
const HINT_ROW = { id: '__hint', name: 'Keep Typing to Search...' };

// Toolbar (Export CSV): flat filled sky, square, NO hover change on the reference.
const TOOLBAR_BUTTON_SX = {
  height: 53,
  minWidth: 142,
  padding: '16px',
  borderRadius: 0,
  border: '1px solid #5ebbeb',
  bgcolor: '#5ebbeb',
  color: '#f8f8f8',
  fontSize: 16,
  fontWeight: 400,
  textTransform: 'none',
  boxShadow: 'none',
  transition: 'background 200ms ease, color 200ms ease',
  '& .MuiButton-startIcon': { marginRight: '8px', marginLeft: 0 },
  '&:hover': { bgcolor: '#5ebbeb', color: '#f8f8f8', boxShadow: 'none' },
};

// Run: same chrome but INVERTS on hover over 200ms.
const RUN_BUTTON_SX = {
  ...TOOLBAR_BUTTON_SX,
  minWidth: 62,
  '&:hover': { bgcolor: '#f8f8f8', color: '#5ebbeb', boxShadow: 'none' },
  '&:focus-visible': { outline: '2px solid #000', outlineOffset: 0 },
  '&.Mui-disabled': { bgcolor: '#5ebbeb', color: '#f8f8f8', opacity: 0.6 },
};

const TABLE_HEAD_SX = {
  '& th': {
    backgroundColor: '#5ebbeb',
    color: '#f8f8f8',
    fontWeight: 700,
    fontSize: 16,
    textTransform: 'uppercase',
    padding: '8px',
    borderBottom: 'none',
  },
};

// Reference filter: type-to-search MULTI-select with square / check-square glyphs,
// 'Keep Typing to Search...' below the minimum and 'No Options' when nothing matches.
const SearchMultiSelect = ({ label, options, value, onChange }) => {
  const [inputValue, setInputValue] = useState('');
  const searching = inputValue.trim().length >= MIN_SEARCH;

  return (
    <Box sx={FIELD_BOX_SX}>
    <Typography sx={LABEL_SX}>{label}</Typography>
    <Autocomplete
      multiple
      disableCloseOnSelect
      // Reference: a "x" clear-all sits beside the arrow whenever something is picked.
      clearIcon={<span style={{ fontSize: 18, lineHeight: 1 }}>×</span>}
      options={options}
      value={value}
      onChange={(e, newValue) => onChange(newValue)}
      inputValue={inputValue}
      onInputChange={(e, newInput) => setInputValue(newInput)}
      getOptionLabel={(option) => option?.name || ''}
      isOptionEqualToValue={(o, v) => o.id === v.id}
      popupIcon={<ArrowDropDown />}
      filterOptions={(opts, state) => {
        const input = state.inputValue.trim().toLowerCase();
        // Too short to search: the picked rows (checked) + the hint row.
        if (input.length < MIN_SEARCH) return [...value, HINT_ROW];
        return opts.filter((o) => (o.name || '').toLowerCase().includes(input));
      }}
      getOptionDisabled={(o) => o.id === HINT_ROW.id}
      noOptionsText={searching ? 'No Options' : 'Keep Typing to Search...'}
      slotProps={multiPanelSlotProps}
      sx={fieldSx}
      renderOption={(props, option, { selected }) => {
        const { key, ...optionProps } = props;
        if (option.id === HINT_ROW.id) {
          return (
            <li key={key} {...optionProps} aria-selected={false} style={{ opacity: 1, color: '#262626', cursor: 'default' }}>
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
              sx={{ p: 0, mr: '8px', color: '#262626', '&.Mui-checked': { color: '#262626' } }}
            />
            {option.name}
          </li>
        );
      }}
      // Reference: one grey chip — the name for a single pick, "N Selected..." for
      // more; no per-chip x (the field's clear-all x removes everything).
      renderTags={(vals) => (
        <Chip
          label={vals.length === 1 ? vals[0].name : `${vals.length} Selected...`}
          size="small"
          sx={{ bgcolor: 'rgba(0,0,0,0.1)', borderRadius: '4px', color: '#262626', fontSize: 16, height: 26, ml: '4px' }}
        />
      )}
      renderInput={(params) => <TextField {...params} placeholder={value.length ? '' : label} />}
    />
    </Box>
  );
};

// Reference calendar month: Monday-first, 38px square cells, 12px radius.
const MonthGrid = ({ month, value, onPick, onPrev, onNext }) => {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  const today = new Date();

  return (
    <Box sx={{ flex: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '8px' }}>
        {onPrev ? (
          <IconButton size="small" onClick={onPrev} sx={{ color: '#2a9fd6' }}>
            <ChevronLeft />
          </IconButton>
        ) : (
          <Box sx={{ width: 34 }} />
        )}
        <Box sx={{ fontSize: 18, fontWeight: 700, color: '#313439' }}>{format(month, 'MMMM yyyy')}</Box>
        {onNext ? (
          <IconButton size="small" onClick={onNext} sx={{ color: '#2a9fd6' }}>
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
          const selected = value ? isSameDay(day, value) : false;
          const isToday = isSameDay(day, today);
          return (
            <Box
              key={day.toISOString()}
              onClick={() => onPick(day)}
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
                cursor: 'pointer',
                opacity: outside ? 0.5 : 1,
                color: selected ? '#f8f8f8' : outside ? '#676b72' : '#2a9fd6',
                bgcolor: selected ? '#5ebbeb' : 'transparent',
                border: isToday && !selected ? '1px solid #2a9fd6' : '1px solid transparent',
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

const StocktakedProducts = () => {
  const { getOutletId } = useAuth();
  const { notify } = useAppDialogs();

  // Filters — reference starts with an EMPTY date and nothing run; brands /
  // categories / families / tags are MULTI-select.
  const [outletId, setOutletId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dateText, setDateText] = useState('');
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedFamilies, setSelectedFamilies] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  // Documented default for this report: both toggles start OFF.
  const [showZeroInventory, setShowZeroInventory] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  // The STATUS column follows the toggle as it was when the report RAN.
  const [ranWithInactive, setRanWithInactive] = useState(false);

  const [outlets, setOutlets] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [families, setFamilies] = useState([]);
  const [tags, setTags] = useState([]);

  // Data
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  // UI
  const [calendarAnchorEl, setCalendarAnchorEl] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(new Date()));

  // Header rule (16/10/2026): in-page Outlet filter hidden when a header outlet is selected.
  const { showOutletFilter } = useHeaderScope();
  useEffect(() => {
    if (!showOutletFilter && outletId) setOutletId(null);
  }, [showOutletFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const load = async () => {
      const currentOutletId = getOutletId();
      try {
        // Reference: every outlet the account is assigned to is listed (Reporting
        // Access is not a filter here); picking one without it answers the red
        // toast on Run. Same source as Inventory at Date.
        const res = await apiClient.get('/auth/report-outlets');
        const outletsList = Array.isArray(res?.data?.assigned) && res.data.assigned.length
          ? res.data.assigned
          : (Array.isArray(res?.data?.outlets) ? res.data.outlets : []);
        setOutlets(outletsList);
        // Reference has no 'All Outlets' — the user's own outlet is pre-selected.
        setOutletId((prev) => prev ?? (outletsList.some((o) => o.id === currentOutletId) ? currentOutletId : outletsList[0]?.id ?? null));
      } catch (error) {
        console.error('Error loading outlets:', error);
      }

      try {
        const [brandsRes, categoriesRes, familiesRes, tagsRes] = await Promise.all([
          productService.getBrands(currentOutletId),
          productService.getCategories(currentOutletId),
          productService.getFamilies(currentOutletId),
          productService.getTags(currentOutletId),
        ]);

        setBrands(Array.isArray(brandsRes) ? brandsRes : []);
        setCategories(Array.isArray(categoriesRes) ? categoriesRes : []);
        setFamilies(Array.isArray(familiesRes) ? familiesRes : []);
        setTags(Array.isArray(tagsRes) ? tagsRes : []);
      } catch (error) {
        console.error('Error loading filter options:', error);
      }
    };
    load();
  }, [getOutletId]);

  const pickDate = (date) => {
    setSelectedDate(startOfDay(date));
    setDateText(format(date, DATE_FORMAT));
    setCalendarMonth(startOfMonth(date));
    setHasRun(false);
    setCalendarAnchorEl(null);
  };

  // Typed dd/mm/yyyy input — only commits once the text is a real date.
  const handleDateTextChange = (text) => {
    setDateText(text);
    setHasRun(false);
    if (!text) {
      setSelectedDate(null);
      return;
    }
    const parsed = parse(text, DATE_FORMAT, new Date());
    if (isValid(parsed)) {
      setSelectedDate(startOfDay(parsed));
      setCalendarMonth(startOfMonth(parsed));
    }
  };

  const ids = (list) => (list.length ? list.map((item) => item.id) : undefined);

  const handleRun = async () => {
    // Reference: Run with no date answers a red toast instead of a disabled button.
    if (!selectedDate) {
      notify?.('Please select a date', 'error', { position: 'top' });
      return;
    }

    setLoading(true);
    setHasRun(true);
    try {
      const filters = {
        date: format(selectedDate, 'yyyy-MM-dd'),
        outletId: outletId || undefined,
        brandId: ids(selectedBrands),
        categoryId: ids(selectedCategories),
        familyId: ids(selectedFamilies),
        tagIds: ids(selectedTags),
        showZeroInventory: showZeroInventory ? 'true' : 'false',
        includeInactive: includeInactive ? 'true' : 'false',
      };

      const response = await inventoryReportService.getStocktakedProducts(filters);
      if (response.success) {
        setReportData(response.data || []);
        setRanWithInactive(includeInactive);
      } else {
        console.error('Error fetching stocktaked products:', response.error);
        setReportData([]);
      }
    } catch (error) {
      console.error('Error fetching stocktaked products:', error);
      setReportData([]);
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
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedData = [...reportData].sort((a, b) => {
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];

    if (sortConfig.key === 'name' || sortConfig.key === 'category' || sortConfig.key === 'status') {
      aVal = (aVal || '').toLowerCase();
      bVal = (bVal || '').toLowerCase();
    } else if (sortConfig.key === 'date') {
      aVal = aVal ? new Date(aVal).getTime() : 0;
      bVal = bVal ? new Date(bVal).getTime() : 0;
    } else {
      aVal = Number(aVal) || 0;
      bVal = Number(bVal) || 0;
    }

    if (sortConfig.direction === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }
  });

  const formatDate = (date) => {
    if (!date) return 'Never';
    try {
      return format(new Date(date), DATE_FORMAT);
    } catch {
      return 'Never';
    }
  };

  // Reference Export CSV is always enabled — it exports whatever is on screen.
  const exportToCSV = () => {
    const headers = ['NAME', 'CATEGORY', 'DATE', 'INVENTORY', ...(ranWithInactive ? ['STATUS'] : [])];

    const csvContent = [
      headers.join(','),
      ...sortedData.map((row) =>
        [
          `"${row.name || ''}"`,
          `"${row.category || ''}"`,
          formatDate(row.date),
          row.inventory || 0,
          ...(ranWithInactive ? [row.status || ''] : []),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `stocktaked-products-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const SortableHeader = ({ columnKey, label, align = 'left' }) => (
    <TableCell
      align={align}
      sx={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
      onClick={() => handleSort(columnKey)}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
        }}
      >
        {label}<SortIcon active={sortConfig.key === columnKey ? sortConfig.direction : null} />
      </Box>
    </TableCell>
  );

  return (
    <Box sx={{ px: '16px', pt: '16px', pb: 4, bgcolor: '#fff', minHeight: 'calc(100vh - 50px)' }}>
      {/* Reference opens straight on the Export button, top-left above the filters. */}
      <Box sx={{ mb: '16px' }}>
        <Button onClick={exportToCSV} startIcon={<ExportIcon />} disableElevation disableRipple sx={TOOLBAR_BUTTON_SX}>
          Export CSV
        </Button>
      </Box>

      {/* Reference (26/10 ss): bare filter block, no card. Row 1: Outlet, Date,
          Brands, Categories, Families stretched edge to edge; row 2: Tags and the
          two switches, each with its name as small text above. */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        {/* Header rule (16/10/2026): hidden when a header outlet is selected, not removed */}
        {showOutletFilter && (
        <Box sx={FIELD_BOX_SX}>
          <Typography sx={LABEL_SX}>Outlet</Typography>
          <Autocomplete
            options={outlets}
            value={outlets.find((o) => o.id === outletId) || null}
            onChange={(e, newValue) => setOutletId(newValue?.id || null)}
            getOptionLabel={(option) => option?.name || ''}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            popupIcon={<ArrowDropDown />}
            disableClearable
            slotProps={singlePanelSlotProps}
            sx={fieldSx}
            renderInput={(params) => <TextField {...params} placeholder="Outlet" />}
          />
        </Box>
        )}

        <Box sx={FIELD_BOX_SX}>
          <Typography sx={LABEL_SX}>Date</Typography>
          <TextField
            placeholder="Date"
            value={dateText}
            onChange={(e) => handleDateTextChange(e.target.value)}
            onClick={(e) => setCalendarAnchorEl(e.currentTarget)}
            fullWidth
            // Same 42px box as the Autocomplete fields beside it.
            sx={{ ...fieldSx, '& .MuiOutlinedInput-root': { ...fieldSx['& .MuiOutlinedInput-root'], height: 42 }, '& .MuiOutlinedInput-input': { py: 0 } }}
          />
        </Box>

        <SearchMultiSelect label="Brands" options={brands} value={selectedBrands} onChange={setSelectedBrands} />
        <SearchMultiSelect label="Categories" options={categories} value={selectedCategories} onChange={setSelectedCategories} />
        <SearchMultiSelect label="Families" options={families} value={selectedFamilies} onChange={setSelectedFamilies} />
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '16px', mt: '16px' }}>
        <SearchMultiSelect label="Tags" options={tags} value={selectedTags} onChange={setSelectedTags} />
        <Box sx={FIELD_BOX_SX}>
          <Typography sx={LABEL_SX}>Show Inventory With Zero Stock</Typography>
          <ShopfrontSwitch checked={showZeroInventory} onChange={(e) => setShowZeroInventory(e.target.checked)} />
        </Box>
        <Box sx={FIELD_BOX_SX}>
          <Typography sx={LABEL_SX}>Include Inactive Products</Typography>
          <ShopfrontSwitch checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
        </Box>
        {/* Keep the switches on the Date / Brands columns like the reference. */}
        <Box sx={{ ...FIELD_BOX_SX, display: { xs: 'none', md: 'block' } }} />
        <Box sx={{ ...FIELD_BOX_SX, display: { xs: 'none', md: 'block' } }} />
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
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.10), 0 8px 10px -6px rgba(0,0,0,0.10)',
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px', mb: '16px' }}>
          <CalendarIcon sx={{ color: '#2a9fd6' }} />
          <TextField
            placeholder="dd/mm/yyyy"
            value={dateText}
            onChange={(e) => handleDateTextChange(e.target.value)}
            sx={{ ...fieldSx, flex: 1 }}
          />
          <Button
            onClick={() => pickDate(new Date())}
            disableRipple
            sx={{
              color: '#6f6f6f',
              fontSize: 16,
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: '12px',
              transition: 'background 200ms ease, color 200ms ease',
              '&:hover': { bgcolor: '#e5e5e5' },
            }}
          >
            Current Day
          </Button>
        </Box>
        <Box sx={{ display: 'flex', gap: '16px' }}>
          <MonthGrid
            month={calendarMonth}
            value={selectedDate}
            onPick={pickDate}
            onPrev={() => setCalendarMonth(subMonths(calendarMonth, 1))}
          />
          <MonthGrid
            month={addMonths(calendarMonth, 1)}
            value={selectedDate}
            onPick={pickDate}
            onNext={() => setCalendarMonth(addMonths(calendarMonth, 1))}
          />
        </Box>
      </Popover>

      {/* Reference puts Run on its own row, below the filters, at the left edge. */}
      <Box sx={{ mt: '32px', mb: '16px' }}>
        <Button
          onClick={handleRun}
          // Reference keeps Run enabled; a missing date answers a toast.
          disabled={loading}
          disableElevation
          disableRipple
          sx={RUN_BUTTON_SX}
        >
          {loading ? <CircularProgress size={20} sx={{ color: '#f8f8f8' }} /> : 'Run'}
        </Button>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress sx={{ color: '#5ebbeb' }} />
        </Box>
      )}

      {!loading && hasRun && (
        <TableContainer sx={{ borderRadius: 0, boxShadow: 'none', overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={TABLE_HEAD_SX}>
                <SortableHeader columnKey="name" label="NAME" />
                <SortableHeader columnKey="category" label="CATEGORY" align="center" />
                <SortableHeader columnKey="date" label="DATE" align="center" />
                <SortableHeader columnKey="inventory" label="INVENTORY" align="center" />
                {ranWithInactive && <SortableHeader columnKey="status" label="STATUS" align="center" />}
              </TableRow>
            </TableHead>
            <TableBody>
              {/* Reference: no "no results" row — an empty run shows just the header
                  and the sky footer bar below. */}
              {sortedData.map((row, index) => (
                  <TableRow
                    key={row.id || index}
                    sx={{
                      // Reference stripes: grey first row, white next.
                      bgcolor: index % 2 === 0 ? '#e8e8e8' : '#fff',
                      '& td': {
                        color: '#000',
                        fontSize: 16,
                        padding: '8px 8px 8px 10px',
                        borderBottom: 'none',
                      },
                    }}
                  >
                    <TableCell>{row.name || ''}</TableCell>
                    <TableCell align="center">{row.category || ''}</TableCell>
                    <TableCell align="center">{formatDate(row.date)}</TableCell>
                    <TableCell align="center">{row.inventory || 0}</TableCell>
                    {ranWithInactive && <TableCell align="center">{row.status || ''}</TableCell>}
                  </TableRow>
              ))}
              {/* Reference: a sky bar closes the table (taller when the run is empty). */}
              <TableRow>
                <TableCell colSpan={ranWithInactive ? 5 : 4} sx={{ bgcolor: '#5ebbeb', borderBottom: 'none', padding: 0, height: sortedData.length ? 36 : 56 }} />
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!loading && !hasRun && (
        <Typography sx={{ fontSize: 16, color: '#000' }}>
          Please select your parameters and press run.
        </Typography>
      )}
    </Box>
  );
};

export default StocktakedProducts;
