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
  FormControlLabel,
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
  ArrowUpward,
  ArrowDownward,
  ArrowDropDown,
  CalendarTodayOutlined as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CheckBoxOutlineBlankOutlined as SquareIcon,
  CheckBoxOutlined as CheckSquareIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import inventoryReportService from '../../services/inventoryReportService';
import outletService from '../../services/outletService';
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
  '& input::placeholder': { color: '#808080', opacity: 1 },
  '& .MuiInputLabel-root': { fontSize: 16, color: 'rgba(103,107,114,0.6)' },
  '& .MuiInputLabel-root.MuiInputLabel-shrink': {
    color: '#000',
    transform: 'translate(14px, -9px) scale(0.8)',
  },
  '& .MuiInputLabel-root.Mui-focused': { color: '#000' },
  '& .MuiAutocomplete-popupIndicator': {
    color: '#313439',
    transition: 'background 200ms ease',
    '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
  },
};

// Reference dropdown: white panel, 1px SOLID BLACK, 8px radius, 288px scroll,
// xl shadow, no open/close transition, 56px option rows with 16px padding.
const panelSx = (selectedSx) => ({
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
        '&.Mui-focused': { backgroundColor: 'rgba(0,0,0,0.04)' },
        "&[aria-selected='true'], &[aria-selected='true'].Mui-focused": selectedSx,
      },
    },
  },
});

// Multi-select panels highlight the picked row (sky-200); the single outlet
// panel just recolours the picked label (sky-400 text on white).
const multiPanelSlotProps = panelSx({ backgroundColor: '#7dd3fc' });
const singlePanelSlotProps = panelSx({ backgroundColor: '#fff', color: '#38bdf8' });

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
  '&.Mui-disabled': { bgcolor: '#404040', color: '#737373', border: '1px solid #404040' },
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
    <Autocomplete
      multiple
      disableCloseOnSelect
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
        if (input.length < MIN_SEARCH) return [];
        return opts.filter((o) => (o.name || '').toLowerCase().includes(input));
      }}
      noOptionsText={searching ? 'No Options' : 'Keep Typing to Search...'}
      slotProps={multiPanelSlotProps}
      sx={{ width: 358, maxWidth: '100%', ...fieldSx }}
      renderOption={(props, option, { selected }) => {
        const { key, ...optionProps } = props;
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
      renderTags={(vals, getTagProps) =>
        vals.map((option, index) => {
          const { key, ...tagProps } = getTagProps({ index });
          return (
            <Chip
              key={key}
              label={option.name}
              size="small"
              {...tagProps}
              sx={{ bgcolor: 'rgba(0,0,0,0.1)', borderRadius: '4px', color: '#262626', fontSize: 14 }}
            />
          );
        })
      }
      renderInput={(params) => <TextField {...params} label={label} placeholder={value.length ? '' : label} />}
    />
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
  const { getOutletId, getOutletName, isSuperAdmin } = useAuth();

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
  const [searchTerm, setSearchTerm] = useState('');

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

  useEffect(() => {
    const load = async () => {
      const currentOutletId = getOutletId();
      try {
        if (isSuperAdmin()) {
          const response = await outletService.getAllOutlets();
          const outletsList = response?.outlets || response || [];
          setOutlets(Array.isArray(outletsList) ? outletsList : []);
        } else if (currentOutletId) {
          // Non-super-admins can only ever report on their own outlet.
          setOutlets([{ id: currentOutletId, name: getOutletName() || 'My Outlet' }]);
        }
        // Reference has no 'All Outlets' — the user's own outlet is pre-selected.
        setOutletId((prev) => prev ?? currentOutletId ?? null);
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
  }, [getOutletId, getOutletName, isSuperAdmin]);

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
    if (!selectedDate) return;

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
        searchTerm: searchTerm || undefined,
      };

      const response = await inventoryReportService.getStocktakedProducts(filters);
      if (response.success) {
        setReportData(response.data || []);
      } else {
        console.error('Error fetching stocktaked products:', response.error);
        setReportData([]);
      }
    } catch (error) {
      console.error('Error fetching stocktaked products:', error);
      setReportData([]);
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

    if (sortConfig.key === 'name' || sortConfig.key === 'category') {
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
    const headers = ['NAME', 'CATEGORY', 'DATE', 'INVENTORY'];

    const csvContent = [
      headers.join(','),
      ...sortedData.map((row) =>
        [
          `"${row.name || ''}"`,
          `"${row.category || ''}"`,
          formatDate(row.date),
          row.inventory || 0,
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
          justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        }}
      >
        {label}
        {sortConfig.key === columnKey &&
          (sortConfig.direction === 'asc' ? (
            <ArrowUpward fontSize="small" />
          ) : (
            <ArrowDownward fontSize="small" />
          ))}
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

      {/* Reference: bare filter block, no card. */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        <Autocomplete
          options={outlets}
          value={outlets.find((o) => o.id === outletId) || null}
          onChange={(e, newValue) => setOutletId(newValue?.id || null)}
          getOptionLabel={(option) => option?.name || ''}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          popupIcon={<ArrowDropDown />}
          slotProps={singlePanelSlotProps}
          sx={{ width: 358, maxWidth: '100%', ...fieldSx }}
          renderInput={(params) => <TextField {...params} label="Outlet" />}
        />

        <TextField
          label="Date"
          placeholder="DD/MM/YYYY"
          value={dateText}
          onChange={(e) => handleDateTextChange(e.target.value)}
          onClick={(e) => setCalendarAnchorEl(e.currentTarget)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 358, maxWidth: '100%', ...fieldSx }}
        />

        <SearchMultiSelect label="Brands" options={brands} value={selectedBrands} onChange={setSelectedBrands} />
        <SearchMultiSelect label="Categories" options={categories} value={selectedCategories} onChange={setSelectedCategories} />
        <SearchMultiSelect label="Families" options={families} value={selectedFamilies} onChange={setSelectedFamilies} />
        <SearchMultiSelect label="Tags" options={tags} value={selectedTags} onChange={setSelectedTags} />

        {/* Local-only product search — kept from the existing page. */}
        <TextField
          label="Search"
          placeholder="Search Products"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 358, maxWidth: '100%', ...fieldSx }}
        />
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '24px', mt: '16px' }}>
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
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              sx={{ ml: 1 }}
            />
          }
          label={<Typography sx={{ fontSize: 16, color: '#313439' }}>Include Inactive Products</Typography>}
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
          // The reference will not produce rows until a date has been chosen.
          disabled={loading || !selectedDate}
          disableElevation
          disableRipple
          sx={RUN_BUTTON_SX}
        >
          {loading ? <CircularProgress size={20} sx={{ color: '#737373' }} /> : 'Run'}
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
                <SortableHeader columnKey="category" label="CATEGORY" />
                <SortableHeader columnKey="date" label="DATE" />
                <SortableHeader columnKey="inventory" label="INVENTORY" align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedData.length === 0 ? (
                <TableRow sx={{ '& td': { borderBottom: 'none', fontSize: 16, color: '#000' } }}>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                    No products found matching the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map((row, index) => (
                  <TableRow
                    key={row.id || index}
                    sx={{
                      bgcolor: index % 2 === 0 ? '#fff' : '#f8f8f8',
                      '& td': {
                        color: '#000',
                        fontSize: 16,
                        padding: '8px 8px 8px 10px',
                        borderBottom: 'none',
                      },
                    }}
                  >
                    <TableCell>{row.name || ''}</TableCell>
                    <TableCell>{row.category || ''}</TableCell>
                    <TableCell>{formatDate(row.date)}</TableCell>
                    <TableCell align="right">{row.inventory || 0}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!loading && !hasRun && (
        <Typography sx={{ fontSize: 16, color: '#676b72' }}>
          Please select a date and press Run.
        </Typography>
      )}
    </Box>
  );
};

export default StocktakedProducts;
