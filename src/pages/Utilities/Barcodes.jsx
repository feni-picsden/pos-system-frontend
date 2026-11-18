import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  TextField,
  Select,
  MenuItem,
  IconButton,
  SvgIcon,
  Autocomplete,
  Chip,
} from '@mui/material';
import {
  CloseOutlined as ClearIcon,
  CheckBoxOutlineBlankOutlined as SquareIcon,
  CheckBoxOutlined as CheckSquareIcon,
} from '@mui/icons-material';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import { Link as RouterLink } from 'react-router-dom';
import barcodeService from '../../services/barcodeService';
import apiClient from '../../services/apiClient';
import DateTimeRangeFilter from '../../components/Common/DateTimeRangeFilter';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import { NoResults } from '../../components/Common/EmptyResults';
import { format } from 'date-fns';
import { formatDateTime as formatAppDateTime } from '../../utils/appDateTime';

const EMPTY_RANGE = { startDate: null, endDate: null };

// Reference option labels -> values the backend switch actually accepts (routes/barcodes.js)
const INVENTORY_LEVELS = [
  { label: 'Has Stock', value: 'Positive Stock' },
  { label: 'Has Zero Stock', value: 'Zero Stock' },
  { label: 'Has Negative Stock', value: 'Negative Stock' },
];

const fieldSx = {
  bgcolor: '#fff',
  '& .MuiOutlinedInput-root': {
    height: 42,
    borderRadius: '8px',
    bgcolor: '#fff',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
  },
  '& input::placeholder': { color: '#808080', opacity: 1 },
};

// Reference uses the FontAwesome fa-trash-alt glyph (no FA dependency here — inline path).
const DeleteIcon = (props) => (
  <SvgIcon {...props} viewBox="0 0 448 512">
    <path d="M268 416h24a12 12 0 0 0 12-12V188a12 12 0 0 0-12-12h-24a12 12 0 0 0-12 12v216a12 12 0 0 0 12 12zM432 80h-82.4l-34-56.7A48 48 0 0 0 274.4 0H173.6a48 48 0 0 0-41.2 23.3L98.4 80H16A16 16 0 0 0 0 96v16a16 16 0 0 0 16 16h16v336a48 48 0 0 0 48 48h288a48 48 0 0 0 48-48V128h16a16 16 0 0 0 16-16V96a16 16 0 0 0-16-16zM171.8 50.1a6 6 0 0 1 5.2-2.9h94a6 6 0 0 1 5.2 2.9L293.6 80H154.4zM368 464H80V128h288zm-212-48h24a12 12 0 0 0 12-12V188a12 12 0 0 0-12-12h-24a12 12 0 0 0-12 12v216a12 12 0 0 0 12 12z" />
  </SvgIcon>
);

// Reference filter labels: black 16px regular (user 18/11/2026).
const groupLabelSx = { color: '#000', fontSize: 16, fontWeight: 400, mb: 0.5 };

// Reference sort glyph: hollow up + down triangles, the active direction filled.
const SortGlyph = ({ dir }) => (
  <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true" style={{ marginLeft: 4 }}>
    <path d="M5 1 L9 5.5 H1 Z" fill={dir === 'asc' ? '#fff' : 'none'} stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M5 13 L9 8.5 H1 Z" fill={dir === 'desc' ? '#fff' : 'none'} stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

// Reference dropdown list: detached 8px under the field, 1px dark frame, 56px rows.
const LIST_MENU_PROPS = {
  transitionDuration: 0,
  marginThreshold: 0,
  anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
  transformOrigin: { vertical: 'top', horizontal: 'left' },
  PaperProps: {
    elevation: 0,
    sx: {
      mt: '8px',
      borderRadius: '8px',
      border: '1px solid #404040',
      boxShadow: 'none',
      '&& .MuiMenuItem-root': { minHeight: 56, height: 56, px: 2, fontSize: 16, color: '#000', borderBottom: 0 },
      '&& .MuiMenuItem-root.Mui-selected': { bgcolor: 'transparent', color: '#38bdf8' },
      '&& .MuiMenuItem-root:hover, && .MuiMenuItem-root.Mui-focusVisible, && .MuiMenuItem-root.Mui-selected:hover': { bgcolor: '#5ebbeb', color: '#f8f8f8' },
      '&&:hover .MuiMenuItem-root.Mui-focusVisible:not(:hover)': { bgcolor: 'transparent', color: '#000' },
    },
  },
  MenuListProps: { sx: { py: 0 } },
};

// A deleted barcode must stop scanning on the sell screen straight away: re-pull just
// those products into the local catalog (IndexedDB) and drop the cached Products list.
const refreshProducts = (productIds) => {
  const ids = [...new Set(productIds.map((id) => parseInt(id, 10)).filter(Number.isFinite))];
  if (!ids.length) return;
  apiClient.bustCache('/products');
  const outletId = localStorage.getItem('selectedOutletId') || undefined;
  import('../../services/posCatalogSync').then((m) => m.refreshProductsInCache(ids, outletId)).catch(() => {});
};

const Field = ({ label, children }) => (
  <Box>
    <Typography sx={groupLabelSx}>{label}</Typography>
    {children}
  </Box>
);

// Reference: two "DD/MM/YYYY HH:mm:ss" halves in one box, shared ref range popover.
const DateRangeField = ({ value, onChange, testId }) => (
  <DateTimeRangeFilter value={value} onChange={onChange} testId={testId} />
);

const Barcodes = () => {
  const [barcodes, setBarcodes] = useState([]);
  const [selectedBarcodes, setSelectedBarcodes] = useState([]);
  // true from the start: the first paint must not flash "No results" before the list loads
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  // Reference default list order: created ascending (oldest first)
  const [sortDirection, setSortDirection] = useState('asc');
  // Reference: no header shows an active arrow until the user sorts.
  const [sortTouched, setSortTouched] = useState(false);
  const [barcodeToDelete, setBarcodeToDelete] = useState(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Filters
  const [productCreatedAt, setProductCreatedAt] = useState(EMPTY_RANGE);
  const [lastStocktakedAt, setLastStocktakedAt] = useState(EMPTY_RANGE);
  const [lastSoldAt, setLastSoldAt] = useState(EMPTY_RANGE);
  const [inventoryLevel, setInventoryLevel] = useState('');
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [onlyDuplicates, setOnlyDuplicates] = useState(false);

  // Our addition (same as Product / Customer Utilities): under "All Outlets" the list
  // mixes every outlet, so an Outlets filter narrows it to one or more (?outletId=1,2).
  // Hidden once the navbar pins an outlet - the server scopes the list then anyway.
  const { isAllOutlets, outlets } = useSelectedOutlet();
  const [selectedOutlets, setSelectedOutlets] = useState([]);
  const filterOutletId = isAllOutlets && selectedOutlets.length ? selectedOutlets.map((o) => o.id).join(',') : '';

  // `overrides` lets a caller search with a value React has not committed to state yet
  // (the clear button clears the box and re-runs in the same tick).
  const loadBarcodes = useCallback(async (overrides = {}) => {
    const search = overrides.barcodeSearch ?? barcodeSearch;
    const iso = (d) => (d ? format(d, "yyyy-MM-dd'T'HH:mm:ss") : null);
    try {
      setLoading(true);
      setError('');

      // apiClient caches GETs for 2min and dedupes by URL — without this a reload
      // after a delete/filter re-apply is served from cache and never hits the API.
      apiClient.bustCache('/barcodes');

      const response = await barcodeService.getBarcodes({
        productCreatedAtStart: iso(productCreatedAt.startDate),
        productCreatedAtEnd: iso(productCreatedAt.endDate),
        lastStocktakedAtStart: iso(lastStocktakedAt.startDate),
        lastStocktakedAtEnd: iso(lastStocktakedAt.endDate),
        lastSoldAtStart: iso(lastSoldAt.startDate),
        lastSoldAtEnd: iso(lastSoldAt.endDate),
        inventoryLevel: inventoryLevel || null,
        barcodeSearch: search || null,
        onlyDuplicates: onlyDuplicates ? 'true' : null,
        outletId: filterOutletId || null,
      });

      if (response.success) {
        let rows = response.data || [];
        // ponytail: the API takes onlyDuplicates but a stale/older backend silently ignores it,
        // so narrow to codes used more than once here too — same result either way.
        if (onlyDuplicates) {
          const counts = rows.reduce((acc, r) => ({ ...acc, [r.code]: (acc[r.code] || 0) + 1 }), {});
          rows = rows.filter((r) => counts[r.code] > 1);
        }
        setBarcodes(rows);
        // A ticked row the new filter hides must not stay counted in "N Selected"
        // (Delete Selected would say N but only delete what is still listed).
        const ids = new Set(rows.map((r) => r.id));
        setSelectedBarcodes((prev) => prev.filter((id) => ids.has(id)));
      } else {
        setError('Failed to load barcodes');
        setBarcodes([]);
      }
    } catch (err) {
      console.error('Error loading barcodes:', err);
      setError('Failed to load barcodes');
      setBarcodes([]);
    } finally {
      setLoading(false);
    }
  }, [productCreatedAt, lastStocktakedAt, lastSoldAt, inventoryLevel, barcodeSearch, onlyDuplicates, filterOutletId]);

  useEffect(() => {
    document.title = 'Barcodes | Crinit\'s Shop';
    loadBarcodes();
    // Only on mount — filters are applied via the Apply Filters button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ponytail: derived, not state — the old copy-into-state made the list go stale after a delete
  const sortedBarcodes = useMemo(() => {
    const isDate = ['createdAt', 'lastSoldAt', 'lastStocktakedAt'].includes(sortField);
    return [...barcodes].sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      if (isDate) {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = (bValue || '').toLowerCase();
      }
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [barcodes, sortField, sortDirection]);

  const handleSort = (field) => {
    setSortTouched(true);
    if (sortField === field && sortTouched) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = (event) => {
    setSelectedBarcodes(event.target.checked ? sortedBarcodes.map((b) => b.id) : []);
  };

  const handleSelectBarcode = (barcodeId) => {
    setSelectedBarcodes((prev) =>
      prev.includes(barcodeId) ? prev.filter((id) => id !== barcodeId) : [...prev, barcodeId]
    );
  };

  const handleDeleteConfirm = async () => {
    if (!barcodeToDelete) return;
    setDeleting(true);
    try {
      await barcodeService.deleteBarcode(barcodeToDelete.productId, barcodeToDelete.code, barcodeToDelete.quantity);
      setSelectedBarcodes((prev) => prev.filter((id) => id !== barcodeToDelete.id));
      refreshProducts([barcodeToDelete.productId]);
      setBarcodeToDelete(null);
      await loadBarcodes();
    } catch (err) {
      console.error('Error deleting barcode:', err);
      setError('Failed to delete barcode');
    } finally {
      setDeleting(false);
    }
  };

  // No bulk endpoint exists — reuse the single-barcode service per selected row.
  const handleBulkDeleteConfirm = async () => {
    setDeleting(true);
    try {
      const rows = barcodes.filter((b) => selectedBarcodes.includes(b.id));
      try {
        for (const row of rows) {
          await barcodeService.deleteBarcode(row.productId, row.code, row.quantity);
        }
      } finally {
        refreshProducts(rows.map((r) => r.productId));
      }
      setSelectedBarcodes([]);
      setBulkDeleteOpen(false);
      await loadBarcodes();
    } catch (err) {
      console.error('Error deleting barcodes:', err);
      setError('Failed to delete the selected barcodes');
    } finally {
      setDeleting(false);
    }
  };

  // Created / last sold / last stocktaked on the store's clock (Setup > General > Timezone).
  const formatDateTime = (date) => {
    if (!date) return 'N/A';
    try {
      return formatAppDateTime(date) || 'N/A';
    } catch {
      return 'N/A';
    }
  };

  // A date, or "N/A" centred in a box exactly one date wide (an invisible sample date
  // sets the width), so it lines up with the middle of the dates above and below it.
  const dateOrNA = (date) => {
    const text = formatDateTime(date);
    if (date && text !== 'N/A') return text;
    return (
      <Box component="span" data-na="1" sx={{ position: 'relative', display: 'inline-block' }}>
        <Box component="span" aria-hidden="true" sx={{ visibility: 'hidden' }}>00/00/0000 00:00:00</Box>
        <Box component="span" sx={{ position: 'absolute', inset: 0, textAlign: 'center' }}>N/A</Box>
      </Box>
    );
  };

  const SortableHeader = ({ field, children }) => {
    const active = sortTouched && sortField === field;
    return (
      <TableCell
        sx={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', '&&': { p: 0 } }}
        onClick={() => handleSort(field)}
      >
        {/* No hover box on sortable headers (user 18/11/2026: "not show hover") */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            height: 51,
            px: '8px',
          }}
        >
          {children}
          {/* Reference: stacked fa-sort at rest; solid up/down arrow on the sorted column */}
          <SortGlyph dir={active ? sortDirection : null} />
        </Box>
      </TableCell>
    );
  };

  return (
    <Box
      sx={{
        // Reference: page content starts 8px from the left edge.
        px: '8px',
        pt: 3,
        // The list runs to the very bottom of the window (no grey strip under it);
        // with rows ticked the fixed 64px bar sits there, so the list stops above it.
        pb: selectedBarcodes.length > 0 ? '64px' : 0,
        // Reference: the list lives in an internal scroll container; the page itself never scrolls.
        // 50px = the app bar height (the old 64px left a 14px gap at the bottom).
        height: 'calc(100vh - 50px)',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Title left, row count top right - same "N Results" block as the Products page */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Typography variant="h1" sx={{ fontSize: 32, fontWeight: 700, color: '#000' }}>
          Barcodes
        </Typography>
        {/* 24px off the right edge like the Products page (8px page gutter + 16px) */}
        <Box sx={{ textAlign: 'right', pr: 2 }} data-testid="barcodes-count">
          <Typography variant="h4" fontWeight="bold" lineHeight={1}>
            {barcodes.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Results
          </Typography>
        </Box>
      </Box>

      {/* Filters — bare grid, no card (reference) */}
      <Box
        sx={{
          // 32px between the filters and the list header (16px looked merged - user 18/11/2026)
          pb: 4,
          flexShrink: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
          columnGap: 2,
          rowGap: 2,
        }}
      >
        {/* Our addition (All Outlets only), same control as Product / Customer Utilities */}
        {isAllOutlets && (
          <Field label="Outlets">
            <Autocomplete
              multiple
              disableCloseOnSelect
              data-testid="outlets-filter"
              options={outlets}
              getOptionLabel={(o) => o.name || ''}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              value={selectedOutlets}
              onChange={(_e, value) => setSelectedOutlets(value)}
              size="small"
              sx={{
                ...fieldSx,
                '& .MuiOutlinedInput-root': { ...fieldSx['& .MuiOutlinedInput-root'], height: 'auto', minHeight: 42 },
                '& .MuiAutocomplete-clearIndicator': { visibility: selectedOutlets.length ? 'visible' : 'hidden', p: '2px' },
                '& .MuiAutocomplete-clearIndicator .MuiSvgIcon-root': { fontSize: 18, color: '#000' },
              }}
              slotProps={{
                paper: {
                  sx: {
                    mt: '10px',
                    border: '1px solid #000',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    '& .MuiAutocomplete-listbox': { maxHeight: 289, py: '2px' },
                    '& .MuiAutocomplete-listbox .MuiAutocomplete-option': { minHeight: 56, px: '14px', fontSize: 16, color: '#000' },
                    '& .MuiAutocomplete-listbox .MuiAutocomplete-option[aria-selected="true"]': { bgcolor: 'transparent' },
                    '& .MuiAutocomplete-listbox .MuiAutocomplete-option.Mui-focused, & .MuiAutocomplete-listbox .MuiAutocomplete-option.Mui-focused[aria-selected="true"]': { bgcolor: 'rgba(0, 0, 0, 0.04)' },
                  },
                },
              }}
              renderOption={(props, option, { selected }) => {
                const { key: _key, ...optionProps } = props;
                return (
                  <li key={option.id} {...optionProps} style={{ ...optionProps.style, color: selected ? '#00a6f4' : undefined }}>
                    <Checkbox
                      icon={<SquareIcon />}
                      checkedIcon={<CheckSquareIcon />}
                      checked={selected}
                      sx={{ p: 0, mr: '6px', color: '#000', '& .MuiSvgIcon-root': { fontSize: 18 }, '&.Mui-checked': { color: '#00a6f4' } }}
                    />
                    {option.name}
                  </li>
                );
              }}
              renderInput={(params) => <TextField {...params} placeholder={selectedOutlets.length ? '' : 'Select Outlets...'} />}
              renderTags={(vals, getTagProps) => {
                const chipSx = { height: 26, borderRadius: '4px', bgcolor: '#e5e5e5', color: '#000', fontSize: 16, '& .MuiChip-label': { px: 1 } };
                const shown = vals.slice(0, 2).map((option, index) => {
                  // eslint-disable-next-line no-unused-vars
                  const { key, onDelete, ...tagProps } = getTagProps({ index });
                  return <Chip key={key} label={option.name} size="small" sx={chipSx} {...tagProps} />;
                });
                if (vals.length > 2) shown.push(<Chip key="more" label={`${vals.length - 2} More...`} size="small" sx={chipSx} />);
                return shown;
              }}
            />
          </Field>
        )}

        <Field label="Product Created At">
          <DateRangeField value={productCreatedAt} onChange={setProductCreatedAt} testId="range-created" />
        </Field>
        <Field label="Last Stocktaked At">
          <DateRangeField value={lastStocktakedAt} onChange={setLastStocktakedAt} testId="range-stocktaked" />
        </Field>
        <Field label="Last Sold At">
          <DateRangeField value={lastSoldAt} onChange={setLastSoldAt} testId="range-sold" />
        </Field>

        <Field label="Inventory Level">
          <Select
            fullWidth
            displayEmpty
            value={inventoryLevel}
            onChange={(e) => setInventoryLevel(e.target.value)}
            sx={{
              height: 42,
              borderRadius: '8px',
              bgcolor: '#fff',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
            }}
            MenuProps={LIST_MENU_PROPS}
            // Working clear control — without it the staged filter can never be unset
            endAdornment={
              inventoryLevel ? (
                <IconButton
                  size="small"
                  aria-label="Clear Inventory Level filter"
                  sx={{ mr: 2 }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setInventoryLevel('');
                  }}
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              ) : null
            }
            renderValue={(value) =>
              value ? (
                INVENTORY_LEVELS.find((l) => l.value === value)?.label
              ) : (
                <Box component="span" sx={{ color: '#808080' }}>
                  Select Inventory Level filter...
                </Box>
              )
            }
          >
            {INVENTORY_LEVELS.map((level) => (
              // Reference option rows: 56px tall, 16px padding
              <MenuItem key={level.value} value={level.value} disableRipple>
                {level.label}
              </MenuItem>
            ))}
          </Select>
        </Field>

        <Field label="Barcode">
          <TextField
            fullWidth
            placeholder="Search for barcode..."
            value={barcodeSearch}
            onChange={(e) => setBarcodeSearch(e.target.value)}
            // Enter searches straight away — a handheld scanner ends its scan with Enter,
            // so a scan now applies the filter without a trip to the Apply Filters button.
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                loadBarcodes();
              }
            }}
            sx={fieldSx}
            InputProps={{
              endAdornment: barcodeSearch ? (
                <IconButton
                  size="small"
                  aria-label="Clear barcode search"
                  onClick={() => {
                    setBarcodeSearch('');
                    loadBarcodes({ barcodeSearch: '' });
                  }}
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              ) : null,
            }}
          />
        </Field>

        <Field label="Only Duplicate Barcodes">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, height: 42 }}>
            <ShopfrontSwitch
              checked={onlyDuplicates}
              onChange={(e) => setOnlyDuplicates(e.target.checked)}
            />
            <Typography sx={{ color: '#313439', fontSize: 14 }}>
              {onlyDuplicates
                ? 'Only showing barcodes that are being used multiple times'
                : 'Showing all barcodes, not just duplicates'}
            </Typography>
          </Box>
        </Field>

        {/* Reference: full-width button in the last grid column */}
        <Box sx={{ gridColumn: '-2 / -1', alignSelf: 'end' }}>
          <Button
            fullWidth
            variant="contained"
            disableElevation
            onClick={() => loadBarcodes()}
            sx={{
              height: 42,
              bgcolor: '#5ebbeb',
              border: '1px solid #5ebbeb',
              borderRadius: '12px',
              color: '#fff',
              fontWeight: 700,
              fontSize: 16,
              textTransform: 'none',
              boxShadow: 'none',
              // Reference: hover #0ea5e9, no transition
              transition: 'none',
              '&:hover': { bgcolor: '#0ea5e9', borderColor: '#0ea5e9', boxShadow: 'none' },
            }}
          >
            Apply Filters
          </Button>
        </Box>
      </Box>

      {/* Nothing matched: ref "no results" line instead of an empty table (same as every list page) */}
      {!loading && !error && sortedBarcodes.length === 0 ? (
        <NoResults />
      ) : (
      /* Table — internal scroll container, header sticks to its top (reference) */
      <TableContainer
        component={Paper}
        sx={{ boxShadow: 'none', borderRadius: 0, flex: 1, minHeight: 0, overflow: 'auto' }}
      >
        <Table size="small" sx={{ tableLayout: 'fixed', minWidth: 900 }}>
          {/* Reference column proportions at 1920: 49/343/304/262/154/304/318/155 */}
          <colgroup>
            {['2.6%', '18.2%', '16.1%', '13.9%', '8.1%', '16.1%', '16.8%', '8.2%'].map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <TableHead>
            <TableRow
              sx={{
                '& th': {
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                  backgroundColor: '#5ebbeb',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 16,
                  textTransform: 'none',
                  letterSpacing: 'normal',
                  padding: '0 8px',
                  height: 51,
                  borderBottom: 'none',
                },
                '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
                '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' },
              }}
            >
              <TableCell padding="checkbox">
                {/* Reference: no select-all affordance until at least one row is selected */}
                {selectedBarcodes.length > 0 && (
                  <Checkbox
                    sx={{ color: '#fff', '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: '#fff' } }}
                    indeterminate={selectedBarcodes.length < sortedBarcodes.length}
                    checked={selectedBarcodes.length === sortedBarcodes.length}
                    onChange={handleSelectAll}
                  />
                )}
              </TableCell>
              <TableCell>Product</TableCell>
              <SortableHeader field="createdAt">Created At</SortableHeader>
              <SortableHeader field="code">Code</SortableHeader>
              <TableCell>Quantity</TableCell>
              <SortableHeader field="lastSoldAt">Last Sold At</SortableHeader>
              <SortableHeader field="lastStocktakedAt">Last Stocktaked At</SortableHeader>
              {/* Centred over the centred Delete button (user 18/11/2026: "action label align") */}
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading || error ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 3, color: error ? '#dc2626' : '#676b72' }}>
                  {loading ? 'Loading...' : error}
                </TableCell>
              </TableRow>
            ) : (
              sortedBarcodes.map((barcode) => (
                <TableRow
                  key={barcode.id}
                  sx={{
                    bgcolor: '#fff',
                    height: 58,
                    '& td': { fontSize: 16, height: 58, padding: '8px 8px 8px 10px', borderBottom: 'none' },
                  }}
                >
                  <TableCell padding="checkbox" align="center">
                    {/* Reference: small plain native checkbox (~13px) */}
                    <input
                      type="checkbox"
                      checked={selectedBarcodes.includes(barcode.id)}
                      onChange={() => handleSelectBarcode(barcode.id)}
                      style={{ width: 13, height: 13, cursor: 'pointer' }}
                    />
                  </TableCell>
                  <TableCell>
                    {/* Reference: a real anchor — middle-clickable, copyable, link-blue + underlined */}
                    <Box
                      component={RouterLink}
                      to={`/products/${barcode.productId}/view`}
                      sx={{
                        fontSize: 16,
                        color: '#0000ee',
                        textDecoration: 'underline',
                        '&:visited': { color: '#551a8b' },
                      }}
                    >
                      {barcode.productName}
                    </Box>
                  </TableCell>
                  <TableCell>{formatDateTime(barcode.createdAt)}</TableCell>
                  <TableCell>{barcode.code}</TableCell>
                  <TableCell>{barcode.quantity}</TableCell>
                  {/* "N/A" (never sold / stocktaked) sits centred under the dates of its column (user 18/11/2026) */}
                  <TableCell data-testid="last-sold">{dateOrNA(barcode.lastSoldAt)}</TableCell>
                  <TableCell data-testid="last-stocktaked">{dateOrNA(barcode.lastStocktakedAt)}</TableCell>
                  {/* No side padding + a 12px-padded button: it fits the narrow column on small
                      screens too, so the centred Delete stays under the centred "Actions". */}
                  <TableCell align="center" sx={{ '&&&': { paddingLeft: 0, paddingRight: 0 } }}>
                    <Button
                      onClick={() => setBarcodeToDelete(barcode)}
                      startIcon={<DeleteIcon />}
                      disableElevation
                      sx={{
                        height: 42,
                        px: 1.5,
                        minWidth: 0,
                        py: 1,
                        color: '#dc2626',
                        bgcolor: 'transparent',
                        border: '1px solid transparent',
                        borderRadius: '12px',
                        fontWeight: 700,
                        fontSize: 16,
                        textTransform: 'none',
                        whiteSpace: 'nowrap',
                        boxShadow: 'none',
                        // Reference: hover is instant
                        transition: 'none',
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.05)', boxShadow: 'none' },
                      }}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      )}

      {/* Bulk action bar (reference: appears on first selection) */}
      {selectedBarcodes.length > 0 && (
        <Box
          sx={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            height: 64,
            bgcolor: '#5ebbeb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 2,
            px: 2,
            zIndex: (theme) => theme.zIndex.appBar,
          }}
        >
          {/* Reference renders dark text on the blue bar */}
          <Typography sx={{ color: '#000', fontWeight: 400, fontSize: 16 }}>
            {selectedBarcodes.length} Selected
          </Typography>
          <Button
            variant="contained"
            disableElevation
            onClick={() => setBulkDeleteOpen(true)}
            sx={{
              height: 42,
              width: 185,
              px: 4,
              bgcolor: '#fb2c36',
              border: '1px solid #fb2c36',
              borderRadius: '12px',
              color: '#fff',
              fontWeight: 700,
              fontSize: 16,
              textTransform: 'none',
              whiteSpace: 'nowrap',
              boxShadow: 'none',
              '&:hover': { bgcolor: '#ff6467', borderColor: '#ff6467', boxShadow: 'none' },
            }}
          >
            Delete Selected
          </Button>
        </Box>
      )}

      <ConfirmDeleteDialog
        open={Boolean(barcodeToDelete)}
        title="Delete Barcode"
        message={`Are you sure you want to delete barcode "${barcodeToDelete?.code}" from product "${barcodeToDelete?.productName}"?`}
        loading={deleting}
        onCancel={() => setBarcodeToDelete(null)}
        onConfirm={handleDeleteConfirm}
      />

      <ConfirmDeleteDialog
        open={bulkDeleteOpen}
        title="Delete Barcodes"
        message={`Are you sure you want to delete ${selectedBarcodes.length} selected barcode${
          selectedBarcodes.length === 1 ? '' : 's'
        }?`}
        confirmText="Delete Selected"
        loading={deleting}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
      />
    </Box>
  );
};

export default Barcodes;
