import React, { useState, useEffect } from 'react';
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

const PRODUCT_FIELD_OPTIONS = [
  'active',
  'additional',
  'averageCost',
  'barcodes',
  'basketItems',
  'brandId',
  'caseQuantity',
  'categoryId',
  'components',
  'coreSupplierId',
  'costPercentage',
  'costTaxRateId',
  'costs',
  'createdAt',
  'description',
  'familyId',
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
  'price',
  'prices',
  'sellOnShopMyLocal',
  'status',
  'trackInventory',
  'type',
];

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

// Reference filter field: 452x42, 8px radius, 1px #5e5e5e rail.
const fieldSx = {
  width: 452,
  maxWidth: '100%',
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
  '& .MuiInputLabel-root.MuiInputLabel-shrink': {
    color: '#313439',
    transform: 'translate(14px, -9px) scale(0.8)',
  },
  '& .MuiInputLabel-root.Mui-focused': { color: '#313439' },
  '& .MuiAutocomplete-popupIndicator': { color: '#313439' },
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
      '& .MuiAutocomplete-option': {
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

// Reference filters are type-to-search multi-selects showing grey chips in the field.
const SearchMultiSelect = ({ label, options, value, onChange, getLabel = (o) => o }) => (
  <Autocomplete
    multiple
    disableCloseOnSelect
    options={options}
    value={value}
    onChange={(e, newValue) => onChange(newValue)}
    getOptionLabel={getLabel}
    popupIcon={<ArrowDropDown />}
    // ponytail: cap the rendered list instead of pulling in a virtualiser
    filterOptions={(opts, state) => {
      const input = state.inputValue.trim().toLowerCase();
      const matched = input ? opts.filter((o) => getLabel(o).toLowerCase().includes(input)) : opts;
      return matched.slice(0, 100);
    }}
    slotProps={panelSlotProps}
    sx={fieldSx}
    renderOption={(props, option, { selected }) => {
      const { key, ...optionProps } = props;
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
    renderTags={(vals, getTagProps) =>
      vals.map((option, index) => {
        const { key, ...tagProps } = getTagProps({ index });
        return (
          <Chip
            key={key}
            label={getLabel(option)}
            size="small"
            {...tagProps}
            sx={{
              bgcolor: 'rgba(0,0,0,0.1)',
              borderRadius: '4px',
              color: '#000',
              fontSize: 16,
              maxWidth: 150,
              px: '8px',
            }}
          />
        );
      })
    }
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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
            width: 147,
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

  return (
    <Box sx={{ width: 452, maxWidth: '100%' }}>
      <Typography sx={{ fontSize: 12.8, color: '#6f6f6f', mb: '2px' }}>{label}</Typography>
      <Box
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          height: 42,
          bgcolor: '#fff',
          border: '1px solid #5e5e5e',
          borderRadius: '8px',
          cursor: 'pointer',
        }}
      >
        {['start', 'end'].map((which, i) => {
          const d = which === 'start' ? startDate : endDate;
          return (
            <React.Fragment key={which}>
              {i > 0 && <Typography sx={{ color: '#6f6f6f' }}>–</Typography>}
              <Box
                component="button"
                type="button"
                sx={{
                  width: 215,
                  maxWidth: '100%',
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

const ProductRevisionHistory = () => {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(),
    endDate: new Date(),
    preset: 'today',
  });
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [products, setProducts] = useState([]);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const result = await productService.getProducts({ includeAllStatuses: true });
        const list = Array.isArray(result?.products)
          ? result.products
          : Array.isArray(result)
          ? result
          : [];
        setProducts(list);
      } catch (error) {
        console.error('Error loading products for revision history:', error);
      }
    };

    loadProducts();
  }, []);

  const activeFilters = {
    // The range is inclusive by day, so widen it to cover the whole first/last day.
    startDate: dateRange.startDate ? startOfDay(dateRange.startDate).toISOString() : undefined,
    endDate: dateRange.endDate ? endOfDay(dateRange.endDate).toISOString() : undefined,
    fields: selectedKeys,
    productIds: selectedProducts.map((p) => p.id),
    searchTerm,
  };

  const handleRun = async () => {
    setLoading(true);
    try {
      const response = await productService.getProductRevisionHistory(activeFilters);
      if (response.success) {
        setReportData(response.data || []);
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

  const renderPriceTable = (prices, otherPrices, isFrom) => {
    const parsedPrices = Array.isArray(prices) ? prices : tryParseJson(prices);
    const parsedOther = Array.isArray(otherPrices) ? otherPrices : tryParseJson(otherPrices);
    if (!Array.isArray(parsedPrices) || parsedPrices.length === 0) return String(prices ?? '');

    const hasChanged = (idx) => {
      if (!Array.isArray(parsedOther) || !parsedOther[idx]) return true;
      const a = parsedPrices[idx];
      const b = parsedOther[idx];
      return (
        a.quantity !== b.quantity ||
        a.price !== b.price ||
        (a.priceSet || 'Default') !== (b.priceSet || 'Default')
      );
    };

    return (
      <Table size="small" sx={{ bgcolor: 'transparent', border: '1px solid #e0e0e0' }}>
        <TableHead>
          <TableRow sx={{ bgcolor: '#f9f9f9' }}>
            <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', py: 0.5, px: 1 }}>Quantity</TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', py: 0.5, px: 1 }}>Price</TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', py: 0.5, px: 1 }}>Price Set</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {parsedPrices.map((p, idx) => {
            const changed = hasChanged(idx);
            const bg = changed ? (isFrom ? '#fff9f0' : '#f1f8f4') : 'transparent';
            return (
              <TableRow key={idx} sx={{ bgcolor: bg }}>
                <TableCell sx={{ py: 0.5, px: 1 }}>{p.quantity}</TableCell>
                <TableCell sx={{ py: 0.5, px: 1 }}>{p.price}</TableCell>
                <TableCell sx={{ py: 0.5, px: 1 }}>{p.priceSet || 'Default'}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  const renderBarcodeTable = (barcodes, otherBarcodes, isFrom) => {
    const parsed = Array.isArray(barcodes) ? barcodes : tryParseJson(barcodes);
    const parsedOther = Array.isArray(otherBarcodes) ? otherBarcodes : tryParseJson(otherBarcodes);
    if (!Array.isArray(parsed) || parsed.length === 0) return String(barcodes ?? '');

    const hasChanged = (idx) => {
      if (!Array.isArray(parsedOther) || !parsedOther[idx]) return true;
      const a = parsed[idx];
      const b = parsedOther[idx];
      return a.code !== b.code || a.quantity !== b.quantity;
    };

    return (
      <Table size="small" sx={{ bgcolor: 'transparent', border: '1px solid #e0e0e0' }}>
        <TableHead>
          <TableRow sx={{ bgcolor: '#f9f9f9' }}>
            <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', py: 0.5, px: 1 }}>Quantity</TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', py: 0.5, px: 1 }}>Code</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {parsed.map((b, idx) => {
            const changed = hasChanged(idx);
            const bg = changed ? (isFrom ? '#fff9f0' : '#f1f8f4') : 'transparent';
            return (
              <TableRow key={idx} sx={{ bgcolor: bg }}>
                <TableCell sx={{ py: 0.5, px: 1 }}>{b.quantity}</TableCell>
                <TableCell sx={{ py: 0.5, px: 1 }}>{b.code}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  const renderValueCell = (field, value, otherValue, isFrom) => {
    if (field === 'prices' || field === 'costs') {
      return renderPriceTable(value, otherValue, isFrom);
    }
    if (field === 'barcodes') {
      return renderBarcodeTable(value, otherValue, isFrom);
    }

    const parsed = tryParseJson(value);
    if (typeof parsed === 'object' && parsed !== null) {
      return (
        <pre style={{ margin: 0, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(parsed, null, 2)}
        </pre>
      );
    }

    return <span>{String(value ?? '')}</span>;
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

      <Box className="revision-noprint" sx={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
        <DateRangeField value={dateRange} onChange={setDateRange} label="Date Range (inclusive)" />
        {/* Blank Keys = all revision types; blank Products = all products. */}
        <SearchMultiSelect label="Keys" options={PRODUCT_FIELD_OPTIONS} value={selectedKeys} onChange={setSelectedKeys} />
        <SearchMultiSelect
          label="Products"
          options={products}
          value={selectedProducts}
          onChange={setSelectedProducts}
          getLabel={(o) => o?.name || ''}
        />
        <TextField
          label="Search by product or field"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={fieldSx}
        />
      </Box>

      <Box className="revision-noprint" sx={{ mt: '32px', mb: '16px' }}>
        <Button
          onClick={handleRun}
          disabled={loading}
          disableElevation
          disableRipple
          sx={{
            height: 42,
            minWidth: 120,
            borderRadius: '12px',
            bgcolor: '#5ebbeb',
            color: '#f8f8f8',
            fontSize: 16,
            fontWeight: 700,
            textTransform: 'none',
            boxShadow: 'none',
            transition: 'background 0.2s ease',
            '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' },
            '&.Mui-disabled': { bgcolor: '#404040', color: '#737373' },
          }}
        >
          {loading ? <CircularProgress size={20} sx={{ color: '#737373' }} /> : 'Run'}
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress sx={{ color: '#5ebbeb' }} />
        </Box>
      ) : (
        <TableContainer className="revision-results" sx={{ borderRadius: 0, boxShadow: 'none', overflowX: 'auto' }}>
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
                    borderBottom: 'none',
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
              {reportData.length === 0 ? (
                <TableRow sx={{ '& td': { borderBottom: 'none', fontSize: 16, color: '#000' } }}>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    No revisions found for the selected criteria.
                  </TableCell>
                </TableRow>
              ) : (
                reportData.map((row, index) => (
                  <TableRow
                    key={index}
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
                    <TableCell>{row.productName}</TableCell>
                    <TableCell>{row.field}</TableCell>
                    <TableCell sx={{ maxWidth: 360 }}>
                      {renderValueCell(row.field, row.from, row.to, true)}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 360 }}>
                      {renderValueCell(row.field, row.to, row.from, false)}
                    </TableCell>
                    <TableCell>{row.user}</TableCell>
                    <TableCell>{formatTimestamp(row.timestamp)}</TableCell>
                  </TableRow>
                ))
              )}
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
      />
    </Box>
  );
};

export default ProductRevisionHistory;
