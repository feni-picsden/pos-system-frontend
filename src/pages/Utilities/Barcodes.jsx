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
} from '@mui/material';
import {
  UnfoldMoreOutlined as SortIcon,
  ArrowDropUpOutlined as SortAscIcon,
  ArrowDropDownOutlined as SortDescIcon,
  CloseOutlined as ClearIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import barcodeService from '../../services/barcodeService';
import apiClient from '../../services/apiClient';
import DateRangePicker from '../../components/Common/DateRangePicker';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import { format } from 'date-fns';

const EMPTY_RANGE = { startDate: null, endDate: null };
const RANGE_PLACEHOLDER = 'DD/MM/YYYY HH:mm:ss';

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

const groupLabelSx ={ color: '#676b72', fontSize: 14, fontWeight: 500, mb: 0.5 };

const Field = ({ label, children }) => (
  <Box>
    <Typography sx={groupLabelSx}>{label}</Typography>
    {children}
  </Box>
);

// Reference: ONE bordered rounded-8 container showing start — end datetime segments;
// clicking it opens the shared dual-month RANGE popover (start+end masked inputs + em-dash).
const rangeSx = {
  ...fieldSx,
  '& input': { fontSize: 14, cursor: 'pointer' },
};

const DateRangeField = ({ value, onChange }) => (
  <DateRangePicker
    label=""
    allowEmpty
    enableTime
    hideIcon
    separator="—"
    placeholder={`${RANGE_PLACEHOLDER} — ${RANGE_PLACEHOLDER}`}
    inputSx={rangeSx}
    value={value}
    onChange={(v) => onChange({ startDate: v.startDate, endDate: v.endDate })}
  />
);

const Barcodes = () => {
  const [barcodes, setBarcodes] = useState([]);
  const [selectedBarcodes, setSelectedBarcodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  // Reference default list order: created ascending (oldest first)
  const [sortDirection, setSortDirection] = useState('asc');
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

  const loadBarcodes = useCallback(async () => {
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
        barcodeSearch: barcodeSearch || null,
        onlyDuplicates: onlyDuplicates ? 'true' : null,
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
  }, [productCreatedAt, lastStocktakedAt, lastSoldAt, inventoryLevel, barcodeSearch, onlyDuplicates]);

  useEffect(() => {
    document.title = 'Barcodes | Shopfront';
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
    if (sortField === field) {
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
      await barcodeService.deleteBarcode(barcodeToDelete.productId, barcodeToDelete.code);
      setSelectedBarcodes((prev) => prev.filter((id) => id !== barcodeToDelete.id));
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
      for (const row of rows) {
        await barcodeService.deleteBarcode(row.productId, row.code);
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

  const formatDateTime = (date) => {
    if (!date) return 'N/A';
    try {
      return format(new Date(date), 'dd/MM/yyyy HH:mm:ss');
    } catch {
      return 'N/A';
    }
  };

  const SortableHeader = ({ field, children }) => {
    const active = sortField === field;
    return (
      <TableCell
        sx={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', '&&': { p: 0 } }}
        onClick={() => handleSort(field)}
      >
        {/* Reference: instant 10% black hover overlay with radius 12 on sortable headers */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            height: 51,
            px: '8px',
            borderRadius: '12px',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.1)' },
          }}
        >
          {children}
          {/* Reference: stacked fa-sort at rest; solid up/down arrow on the sorted column */}
          {active ? (
            sortDirection === 'asc' ? <SortAscIcon fontSize="small" /> : <SortDescIcon fontSize="small" />
          ) : (
            <SortIcon fontSize="small" />
          )}
        </Box>
      </TableCell>
    );
  };

  return (
    <Box
      sx={{
        p: 3,
        pb: selectedBarcodes.length > 0 ? 11 : 3,
        // Reference: the list lives in an internal scroll container; the page itself never scrolls
        height: { xs: 'calc(100vh - 56px)', sm: 'calc(100vh - 64px)' },
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Typography variant="h1" sx={{ mb: 3, fontSize: 32, fontWeight: 700, color: '#000' }}>
        Barcodes
      </Typography>

      {/* Filters — bare grid, no card (reference) */}
      <Box
        sx={{
          pb: 2,
          flexShrink: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
          columnGap: 2,
          rowGap: 2,
        }}
      >
        <Field label="Product Created At">
          <DateRangeField value={productCreatedAt} onChange={setProductCreatedAt} />
        </Field>
        <Field label="Last Stocktaked At">
          <DateRangeField value={lastStocktakedAt} onChange={setLastStocktakedAt} />
        </Field>
        <Field label="Last Sold At">
          <DateRangeField value={lastSoldAt} onChange={setLastSoldAt} />
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
            MenuProps={{ PaperProps: { sx: { borderRadius: '8px' } } }}
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
              <MenuItem key={level.value} value={level.value} sx={{ height: 56, padding: '16px' }}>
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
            sx={fieldSx}
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
            onClick={loadBarcodes}
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

      {/* Table — internal scroll container, header sticks to its top (reference) */}
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
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading || error || sortedBarcodes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 3, color: error ? '#dc2626' : '#676b72' }}>
                  {loading ? 'Loading...' : error || 'No barcodes found'}
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
                  <TableCell>{formatDateTime(barcode.lastSoldAt)}</TableCell>
                  <TableCell>{formatDateTime(barcode.lastStocktakedAt)}</TableCell>
                  <TableCell>
                    <Button
                      onClick={() => setBarcodeToDelete(barcode)}
                      startIcon={<DeleteIcon />}
                      disableElevation
                      sx={{
                        height: 42,
                        px: 4,
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
          <Typography sx={{ color: '#000', fontWeight: 700, fontSize: 16 }}>
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
