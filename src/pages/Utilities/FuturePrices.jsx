import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Pagination,
  Checkbox,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  Select,
  MenuItem,
  InputAdornment,
  Autocomplete,
  Grid,
  FormControl,
} from '@mui/material';
import {
  DeleteOutline as DeleteIcon,
  CheckCircleOutline as CheckCircleIcon,
  SearchOutlined as SearchIcon,
  AddOutlined as AddIcon,
  BlockOutlined as BlockIcon,
  PriorityHighOutlined as PriorityHighIcon,
  QuestionMarkOutlined as QuestionMarkIcon,
  CheckBoxOutlineBlankOutlined as SquareIcon,
  CheckBoxOutlined as CheckSquareIcon,
  IndeterminateCheckBoxOutlined as IndeterminateSquareIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

// Same sort glyph as the report pages: hollow up+down triangles, the current
// direction's triangle filled.
const SortGlyph = ({ active }) => (
  <svg width="10" height="14" viewBox="0 0 10 14" style={{ marginLeft: 4, verticalAlign: 'middle', display: 'inline-block' }} aria-hidden="true">
    <path d="M1 5.5 L5 1.5 L9 5.5 Z" fill={active === 'asc' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active === 'asc' ? 1.6 : 1.1} strokeLinejoin="round" />
    <path d="M1 8.5 L5 12.5 L9 8.5 Z" fill={active === 'desc' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active === 'desc' ? 1.6 : 1.1} strokeLinejoin="round" />
  </svg>
);
import DateTimeField, { FloatLabel } from '../../components/Common/DateTimeField';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import productService from '../../services/productService';
import futurePriceService from '../../services/futurePriceService';
import classificationService from '../../services/classificationService';
import { priceSetService } from '../../services/priceSetService';

// Default Price Set as a pick in the Price Set filter / dialog (server id 0 = default).
const DEFAULT_SET = { id: 0, name: 'Default Price Set', outletId: null };

// Reference has no transitions anywhere on this page.
const INSTANT = 'all 0s ease';

// Measured on the reference: green-500 -> green-400 on hover (lightens).
const NEW_BUTTON_SX = {
  bgcolor: '#00c950',
  border: '1px solid #00c950',
  color: '#fff',
  textTransform: 'none',
  boxShadow: 'none',
  borderRadius: '12px',
  fontWeight: 700,
  fontSize: 16,
  height: 42,
  width: 119,
  padding: '8px 32px',
  transition: INSTANT,
  // Reference lightens the fill only; the border stays green-500.
  '&:hover': { bgcolor: '#05df72', borderColor: '#00c950', boxShadow: 'none' },
};

// Every reference bulk button is outlined (transparent fill), 42px tall, 12px radius, 16/700,
// and greys to these exact tones when disabled.
const BULK_BASE_SX = {
  textTransform: 'none',
  fontWeight: 700,
  fontSize: 16,
  height: 42,
  borderRadius: '12px',
  // 32px of side padding is what sizes these to the reference widths (237/192/232/186).
  px: '32px',
  bgcolor: 'transparent',
  transition: INSTANT,
  '&.Mui-disabled': {
    bgcolor: '#e5e5e5',
    color: '#737373',
    borderColor: '#a1a1a1',
    cursor: 'not-allowed',
    // MUI sets pointer-events:none on disabled buttons, which would swallow the cursor.
    pointerEvents: 'auto',
  },
};

// Reference hover on the outlined bulk actions is a neutral wash; the border never moves.
const BULK_DANGER_SX = {
  ...BULK_BASE_SX,
  color: '#e7000b',
  borderColor: '#fb2c36',
  '&:hover': { borderColor: '#fb2c36', bgcolor: 'rgba(0,0,0,0.05)' },
};

const BULK_PRIMARY_SX = {
  ...BULK_BASE_SX,
  color: '#5ebbeb',
  borderColor: '#5ebbeb',
  '&:hover': { borderColor: '#5ebbeb', bgcolor: 'rgba(0,0,0,0.05)' },
};

// Row actions are the same outlined pill, but 34px tall.
const rowActionSx = (color, borderColor) => ({
  ...BULK_BASE_SX,
  height: 34,
  px: 2,
  color,
  borderColor,
  '&:hover': { borderColor: color, bgcolor: 'transparent' },
});

// Reference confirm shell, shared by Delete and Apply: 120px medallion half-outside the top,
// centered title + prompt, the affected row in a #5ebbeb-headed table, and two equal 48px
// square footer buttons. Only the accent colour, icon and labels differ between the two.
const CONFIRM_FOOTER_SX = {
  flex: 1,
  height: 48,
  borderRadius: 0,
  fontSize: 32,
  fontWeight: 400,
  textTransform: 'none',
  boxShadow: 'none',
  transition: INSTANT,
  '&:hover': { boxShadow: 'none' },
};

const FuturePriceConfirmDialog = ({
  open,
  variant,
  row,
  count,
  loading,
  onCancel,
  onConfirm,
  formatCurrency,
  formatDate,
}) => {
  const isDelete = variant === 'delete';
  const medallionBg = isDelete ? '#e3342f' : '#1c86f2';
  const confirmBg = isDelete ? '#e3342f' : '#32b643';
  const confirmHoverBg = isDelete ? '#c92c28' : '#2a9c39';
  const verb = isDelete ? 'delete' : 'apply';

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: 981,
          maxWidth: '100%',
          borderRadius: 0,
          overflow: 'visible',
          boxShadow: '0 0 30px 0 rgba(0,0,0,0.25)',
          mt: '60px',
        },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: -60,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 120,
          height: 120,
          borderRadius: '100%',
          bgcolor: medallionBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isDelete ? (
          <PriorityHighIcon sx={{ fontSize: 64, color: '#fff' }} />
        ) : (
          <QuestionMarkIcon sx={{ fontSize: 56, color: '#fff' }} />
        )}
      </Box>

      <DialogContent sx={{ pt: '76px', px: 4, pb: 0 }}>
        <Typography
          component="h3"
          sx={{ fontSize: '18.72px', fontWeight: 700, color: '#000', textAlign: 'center', mb: 2 }}
        >
          {isDelete ? 'Delete Future Price' : 'Apply Future Price'}
        </Typography>
        <Typography sx={{ fontSize: 16, color: '#000', textAlign: 'center', mb: 3 }}>
          {row
            ? `Are you sure you want to ${verb} the future price?`
            : `Are you sure you want to ${verb} ${count} future price(s)?`}
        </Typography>

        {row && (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow
                  sx={{
                    '& th': {
                      bgcolor: '#5ebbeb',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 16,
                      textAlign: 'center',
                      border: 0,
                    },
                  }}
                >
                  <TableCell>Item</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Price Set</TableCell>
                  <TableCell>Created By</TableCell>
                  <TableCell>Quantity</TableCell>
                  <TableCell>Price</TableCell>
                  <TableCell>Effective At</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow sx={{ '& td': { fontSize: 16, textAlign: 'center', p: 2, border: 0 } }}>
                  <TableCell>{row.itemName}</TableCell>
                  <TableCell>{row.itemType}</TableCell>
                  <TableCell>{row.priceSet}</TableCell>
                  <TableCell>{row.createdBy}</TableCell>
                  <TableCell>{row.quantity}</TableCell>
                  <TableCell>{formatCurrency(row.price)}</TableCell>
                  <TableCell>{formatDate(row.effectiveAt)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 2 }}>
        <Button
          onClick={onCancel}
          sx={{
            ...CONFIRM_FOOTER_SX,
            bgcolor: '#f8f8f8',
            color: '#676b72',
            border: '1px solid #676b72',
            '&:hover': { bgcolor: '#f0f0f0', boxShadow: 'none' },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loading}
          sx={{
            ...CONFIRM_FOOTER_SX,
            bgcolor: confirmBg,
            color: '#f8f8f8',
            border: '1px solid #f8f8f8',
            '&:hover': { bgcolor: confirmHoverBg, boxShadow: 'none' },
            '&.Mui-disabled': { bgcolor: '#404040', color: '#737373' },
          }}
        >
          {loading ? (isDelete ? 'Deleting...' : 'Applying...') : isDelete ? 'Delete' : 'Apply'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const FIELD_SX = {
  height: 42,
  bgcolor: '#fff',
  borderRadius: '8px',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
  '& .MuiSelect-select, & .MuiInputBase-input': { fontSize: 16, py: 0, height: '42px !important', display: 'flex', alignItems: 'center' },
};

// Every open list on this page (same tokens as Product / Customer Utilities):
// 10px under the field, 1px dark border, 8px radius, 56px rows, picked row blue,
// hovered / keyboard row a faint grey wash.
// Reference Future Prices lists: attached right under the field, hovered /
// keyboard row filled sky-300, picked row text blue.
const activeRowSx = { bgcolor: '#7dd3fc' };
const LIST_PAPER_SX = {
  mt: '4px',
  border: '1px solid #000',
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  '& .MuiAutocomplete-listbox': { maxHeight: 289, py: '2px' },
  '& .MuiAutocomplete-listbox .MuiAutocomplete-option': { minHeight: 56, px: '14px', fontSize: 16, color: '#000' },
  '& .MuiAutocomplete-listbox .MuiAutocomplete-option[aria-selected="true"]': { bgcolor: 'transparent', color: '#00a6f4' },
  '& .MuiAutocomplete-listbox .MuiAutocomplete-option.Mui-focused, & .MuiAutocomplete-listbox .MuiAutocomplete-option.Mui-focused[aria-selected="true"]': activeRowSx,
  '& .MuiAutocomplete-noOptions': { fontSize: 16, color: '#000', px: '14px', py: '18px' },
};

const SELECT_MENU_PROPS = {
  anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
  transformOrigin: { vertical: 'top', horizontal: 'left' },
  PaperProps: {
    sx: {
      mt: '10px',
      maxHeight: 289,
      border: '1px solid #000',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      '& .MuiMenu-list': { py: '2px' },
      '& .MuiMenuItem-root': { minHeight: 56, px: '14px', fontSize: 16, color: '#000' },
      '& .MuiMenuItem-root.Mui-selected': { color: '#00a6f4', bgcolor: 'transparent' },
      '& .MuiMenuItem-root:hover, & .MuiMenuItem-root.Mui-focusVisible, & .MuiMenuItem-root.Mui-selected:hover, & .MuiMenuItem-root.Mui-selected.Mui-focusVisible': activeRowSx,
    },
  },
};

// Multi-select tag: flat grey 4px tag, black 16px text, no cross (field's × clears all).
const TAG_CHIP_SX = {
  height: 26,
  borderRadius: '4px',
  bgcolor: '#e5e5e5',
  color: '#000',
  fontSize: 16,
  '& .MuiChip-label': { px: 1 },
};

const CLEAR_ICON_SX = { fontSize: 18, color: '#000' };

// Grid checkboxes, as on the other Utilities lists: thin-outline square glyphs, 28x32 box.
const CHECKBOX_GLYPHS = {
  icon: <SquareIcon />,
  checkedIcon: <CheckSquareIcon />,
  indeterminateIcon: <IndeterminateSquareIcon />,
};
const CHECKBOX_SX = { p: '4px 2px', color: '#000', '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: '#000' } };

/**
 * Multi-select filter (Outlets / Created By / Price Set): shows the first two
 * picks then "N More...", rows with a square tick, picked rows blue; the list
 * keeps its own order. Same 42px field as the other filters on this row.
 */
const MultiFilter = ({ label, options, value, onChange, noOptionsText = 'No Options' }) => {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <Box sx={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <FloatLabel show={open || focused || value.length > 0}>{label}</FloatLabel>
      <Autocomplete
        multiple
        disableCloseOnSelect
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        sx={{
          '& .MuiAutocomplete-clearIndicator': { visibility: value.length ? 'visible' : 'hidden', p: '2px' },
          '& .MuiAutocomplete-clearIndicator .MuiSvgIcon-root': CLEAR_ICON_SX,
          '& .MuiAutocomplete-inputRoot': { pl: '14px', py: 0, flexWrap: 'nowrap', overflow: 'hidden' },
          '& .MuiAutocomplete-inputRoot .MuiAutocomplete-input': { pl: 0, minWidth: 30 },
          '& .MuiChip-root': { ml: 0, mr: '4px', flexShrink: 0 },
        }}
        options={options}
        getOptionLabel={(o) => o?.name || ''}
        isOptionEqualToValue={(o, v) => o.id === v.id}
        value={value}
        onChange={(_e, v) => onChange(v)}
        noOptionsText={noOptionsText}
        slotProps={{ paper: { sx: LIST_PAPER_SX } }}
        renderOption={(props, option, { selected }) => {
          const { key: _key, ...optionProps } = props;
          return (
            <li key={option.id} {...optionProps} style={{ ...optionProps.style, color: selected ? '#00a6f4' : undefined }}>
              <Checkbox
                checked={selected}
                icon={<SquareIcon />}
                checkedIcon={<CheckSquareIcon />}
                sx={{ p: 0, mr: '6px', color: '#000', '& .MuiSvgIcon-root': { fontSize: 18 }, '&.Mui-checked': { color: '#00a6f4' } }}
              />
              {option.name}
            </li>
          );
        }}
        // Reference: one pick = its name (clipped), more = "N Selected..."
        renderTags={(vals, getTagProps) => {
          // eslint-disable-next-line no-unused-vars
          const { key, onDelete, ...tagProps } = getTagProps({ index: 0 });
          return [
            <Chip
              key={key}
              size="small"
              label={vals.length === 1 ? vals[0].name : `${vals.length} Selected...`}
              sx={{ ...TAG_CHIP_SX, maxWidth: 150, '& .MuiChip-label': { px: 1, overflow: 'hidden', textOverflow: 'ellipsis' } }}
              {...tagProps}
            />,
          ];
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={value.length ? '' : label}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            sx={{ '& .MuiOutlinedInput-root': { ...FIELD_SX, py: '0 !important' }, '& input::placeholder': { color: '#808080', opacity: 1 } }}
          />
        )}
      />
    </Box>
  );
};

// Schedule-dialog inputs: 1px #404040 border, 8px radius, #d4d4d4 fill when disabled.
const DIALOG_INPUT_SX = {
  borderRadius: '8px',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
  '&.Mui-disabled': { bgcolor: '#d4d4d4' },
  '&.Mui-disabled .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
};
// Dialog text fields: 42px tall, placeholder in grey, 14px text inset.
const DIALOG_FIELD_SX = {
  '& .MuiOutlinedInput-root': { ...DIALOG_INPUT_SX, height: 42, pl: '14px' },
  '& .MuiOutlinedInput-input': { py: 0, pl: 0, fontSize: 16, height: '42px' },
  '& input::placeholder': { color: '#808080', opacity: 1 },
  '& .Mui-disabled input::placeholder': { color: '#737373' },
};
// Reference dialog field names: 12px black, a fixed 16px line above the field
// (kept as blank space while hidden so rows never jump).
const DialogLabel = ({ show, children }) => (
  <Typography sx={{ fontSize: 12, lineHeight: '16px', color: '#000', mb: '4px', visibility: show ? 'visible' : 'hidden' }}>
    {children}
  </Typography>
);


// Our rule: under All Outlets an Outlet column says which outlet each row belongs to.
const columnsFor = (showOutlet) => [
  { id: 'itemName', label: 'Item' },
  ...(showOutlet ? [{ id: 'outletName', label: 'Outlet' }] : []),
  { id: 'priceSet', label: 'Price Set' },
  { id: 'createdBy', label: 'Created By' },
  { id: 'quantity', label: 'Quantity', numeric: true },
  { id: 'currentPrice', label: 'Current Price', numeric: true },
  { id: 'price', label: 'Price', numeric: true },
  { id: 'effectiveAt', label: 'Effective At', date: true },
];

// The price this future price will replace: same quantity IN THE SAME PRICE SET
// (null = default), preferring an outlet-specific row over the global one.
// null when the product has no price at that quantity in that set yet.
const currentPriceFor = (fp) => {
  const rows = fp.product?.prices || [];
  const qty = fp.quantity || 1;
  const setId = fp.priceSetId ?? null;
  const atQty = rows.filter((p) => p.quantity === qty && (p.priceSetId ?? null) === setId);
  const hit =
    atQty.find((p) => fp.outletId != null && p.outletId === fp.outletId) ||
    atQty.find((p) => p.outletId == null) ||
    atQty[0];
  return hit ? hit.price : null;
};

const transformPrices = (list) =>
  list.map((fp) => ({
    id: fp.id,
    itemName: fp.productName || fp.product?.name || 'Unknown',
    itemType: fp.itemType || 'Product',
    priceSet: fp.priceSetRef?.name || (fp.priceSetId == null ? 'Default Price Set' : fp.priceSet),
    priceSetId: fp.priceSetId ?? null,
    createdBy: fp.createdBy?.name || 'Unknown',
    outletName: fp.outlet?.name || 'Global',
    outletId: fp.outletId ?? null,
    quantity: fp.quantity || 1,
    currentPrice: currentPriceFor(fp),
    price: fp.price || 0,
    effectiveAt: fp.effectiveAt,
    isApplied: fp.isApplied || false,
    status: fp.isApplied ? 'Applied' : 'Pending',
    appliedAt: fp.appliedAt,
    product: fp.product,
  }));

const FuturePrices = () => {
  const { getOutletId } = useAuth();
  // Outlet-wise: an outlet pick in the navbar already scopes every request
  // (apiClient adds ?outletId=). Under All Outlets the page's own Outlets filter
  // narrows the mixed list and the dropdown data to one or more outlets.
  const { isAllOutlets, outlets } = useSelectedOutlet();
  const [selectedOutlets, setSelectedOutlets] = useState([]);
  const filterOutletId = isAllOutlets && selectedOutlets.length ? selectedOutlets.map((o) => o.id).join(',') : '';
  const COLUMNS = useMemo(() => columnsFor(isAllOutlets), [isAllOutlets]);

  const [futurePrices, setFuturePrices] = useState([]);
  const [selectedPrices, setSelectedPrices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Reference filters: search (products and families), Category, Created By,
  // Price Set, Start / End date.
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryFocused, setCategoryFocused] = useState(false);
  const [selectedCreators, setSelectedCreators] = useState([]);
  const [selectedPriceSets, setSelectedPriceSets] = useState([]);
  const [filterOptions, setFilterOptions] = useState({ createdBy: [], priceSets: [DEFAULT_SET] });
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  // Reference has no Filter button: selections self-apply. Debounced below, and
  // parseDateTimeText refuses <4-digit years, so typing never fetches half-dates.
  const [appliedFilters, setAppliedFilters] = useState({ isApplied: false });
  const filtersActive = Object.keys(appliedFilters).some((k) => k !== 'isApplied');

  // { kind: 'apply' | 'delete', ids: number[], row?: object }
  const [confirm, setConfirm] = useState(null);

  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedProductDetails, setSelectedProductDetails] = useState(null);
  const [itemSearchResults, setItemSearchResults] = useState([]);
  const [itemSearchLoading, setItemSearchLoading] = useState(false);
  const [itemSearchText, setItemSearchText] = useState('');
  const [scheduledTime, setScheduledTime] = useState(null);
  // Dialog Price Set pick: 0 = Default Price Set, else a PriceSet id in reach of
  // the chosen product's outlet (its own outlet's sets + the global ones).
  const [priceSetId, setPriceSetId] = useState(0);
  const [allPriceSets, setAllPriceSets] = useState([]);
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [quantityFocused, setQuantityFocused] = useState(false);
  const [priceFocused, setPriceFocused] = useState(false);
  // Once the user types a price, quantity changes must never overwrite it.
  const [categories, setCategories] = useState([]);
  // Reference never shows a "Loading..." table: nothing until the first answer,
  // then the empty state or the rows (a refetch keeps the current view).
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [dateError, setDateError] = useState('');

  const [orderBy, setOrderBy] = useState('effectiveAt');
  const [order, setOrder] = useState('asc');
  const [page, setPage] = useState(0);
  // Same local paging as the other list pages: 10 rows a page, page picker under the grid.
  const rowsPerPage = 10;

  // The sets the dialog offers for the picked product: Default + the sets of the
  // product's outlet + global sets. A global product (no outlet) under All
  // Outlets may go into any set the admin can see.
  const productOutletId = selectedProductDetails?.outletId ?? selectedItem?.outletId ?? null;
  const priceSets = useMemo(
    () => [
      DEFAULT_SET,
      ...allPriceSets.filter((s) => s.outletId == null || productOutletId == null || s.outletId === productOutletId),
    ],
    [allPriceSets, productOutletId]
  );
  // A set that fell out of reach when the product changed goes back to Default.
  useEffect(() => {
    if (priceSetId !== 0 && !priceSets.some((s) => s.id === priceSetId)) setPriceSetId(0);
  }, [priceSets, priceSetId]);

  const fetchPrices = useCallback(async () => {
    try {
      const response = await futurePriceService.getFuturePrices(appliedFilters);
      if (response && response.futurePrices) {
        setFuturePrices(transformPrices(response.futurePrices));
      }
    } catch (err) {
      console.error('Error fetching future prices:', err);
      setError(err.response?.data?.error || 'Failed to fetch future prices');
    } finally {
      setLoadedOnce(true);
    }
  }, [appliedFilters]);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  // Filters self-apply on change (reference has no Filter button).
  useEffect(() => {
    const t = setTimeout(() => {
      // Reference article: the page "lists all future prices that have been
      // created but have not been applied yet" - applied rows drop off.
      const next = { isApplied: false };
      if (searchText.trim()) next.search = searchText.trim();
      if (selectedCategory) next.category = selectedCategory;
      if (selectedCreators.length) next.createdBy = selectedCreators.map((u) => u.id);
      if (selectedPriceSets.length) next.priceSetId = selectedPriceSets.map((s) => s.id);
      if (startDate) next.startDate = startDate.toISOString();
      if (endDate) next.endDate = endDate.toISOString();
      if (filterOutletId) next.outletId = filterOutletId;
      // Keep the old reference when nothing changed so no redundant refetch fires.
      setAppliedFilters((prev) =>
        JSON.stringify(prev) === JSON.stringify(next) ? prev : next
      );
    }, 400);
    return () => clearTimeout(t);
  }, [searchText, selectedCategory, selectedCreators, selectedPriceSets, startDate, endDate, filterOutletId]);

  // Dropdown data, outlet-wise: with an Outlets pick the categories, users and
  // price sets are those outlets' (+ global); picks that fall out of scope clear.
  useEffect(() => {
    let alive = true;
    const picked = filterOutletId || undefined;
    (async () => {
      try {
        const [cats, opts, sets] = await Promise.all([
          classificationService.getClassifications({ type: 'Category', ...(picked ? { outletId: picked } : {}) }),
          futurePriceService.getFilterOptions(picked),
          priceSetService.getPriceSets(),
        ]);
        if (!alive) return;
        setCategories(cats?.classifications || []);
        setFilterOptions({ createdBy: opts?.createdBy || [], priceSets: opts?.priceSets || [DEFAULT_SET] });
        setAllPriceSets(sets?.priceSets || []);
      } catch (err) {
        console.error('Error fetching future price filter data:', err);
      }
    })();
    setSelectedCategory('');
    setSelectedCreators([]);
    setSelectedPriceSets([]);
    return () => { alive = false; };
  }, [filterOutletId]);

  const sortedPrices = useMemo(() => {
    const col = COLUMNS.find((c) => c.id === orderBy);
    const dir = order === 'asc' ? 1 : -1;
    return [...futurePrices].sort((a, b) => {
      const av = a[orderBy];
      const bv = b[orderBy];
      if (col?.numeric) return (Number(av) - Number(bv)) * dir;
      if (col?.date) return (new Date(av || 0) - new Date(bv || 0)) * dir;
      return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
    });
  }, [futurePrices, orderBy, order, COLUMNS]);

  // Keep the page in range when a filter/delete shrinks the list.
  const safePage = page * rowsPerPage >= sortedPrices.length ? 0 : page;
  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [safePage, page]);

  const pagedPrices = useMemo(
    () => sortedPrices.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage),
    [sortedPrices, safePage, rowsPerPage]
  );

  const handleSort = (id) => {
    setOrder(orderBy === id && order === 'asc' ? 'desc' : 'asc');
    setOrderBy(id);
  };

  const handleSelectAll = (event) => {
    setSelectedPrices(event.target.checked ? futurePrices.map((p) => p.id) : []);
  };

  const handleSelectPrice = (priceId) => {
    setSelectedPrices((prev) =>
      prev.includes(priceId) ? prev.filter((id) => id !== priceId) : [...prev, priceId]
    );
  };

  const flash = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const runDelete = async (ids) => {
    try {
      setLoading(true);
      setError('');
      if (ids.length === 1) {
        await futurePriceService.deleteFuturePrice(ids[0]);
      } else {
        await futurePriceService.deleteMultipleFuturePrices(ids);
      }
      setFuturePrices((prev) => prev.filter((p) => !ids.includes(p.id)));
      setSelectedPrices((prev) => prev.filter((id) => !ids.includes(id)));
      flash(`${ids.length} future price(s) deleted successfully!`);
      setConfirm(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete future price(s)');
    } finally {
      setLoading(false);
    }
  };

  const runApply = async (ids) => {
    try {
      setLoading(true);
      setError('');
      const response =
        ids.length === 1
          ? await futurePriceService.applyFuturePrice(ids[0])
          : await futurePriceService.applyMultipleFuturePrices(ids);
      await fetchPrices();
      setSelectedPrices((prev) => prev.filter((id) => !ids.includes(id)));
      flash(
        response?.message ||
          `${ids.length} future price(s) applied successfully and added to product prices!`
      );
      setConfirm(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to apply future price(s)');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);

  // Reference (checked 04/11/2026 with three sets picked in turn): Product Price
  // is ALWAYS the Default Price Set qty-1 price, whatever Price Set is picked.
  const getProductPrice = (product) => {
    if (!product) return 0;
    const rows = (Array.isArray(product.prices) ? product.prices : []).filter((p) => p.priceSetId == null);
    if (rows.length > 0) {
      const unit = rows.find((p) => p.quantity === 1) || rows[0];
      return unit.price || 0;
    }
    return product.retailPrice || product.caseCost || 0;
  };

  const getProductCost = (product) => {
    if (!product) return 0;
    return product.itemCost || product.caseCost || 0;
  };

  const resetScheduleForm = () => {
    setSelectedItem(null);
    setSelectedProductDetails(null);
    setItemSearchResults([]);
    setItemSearchText('');
    setScheduledTime(null);
    setPriceSetId(0);
    setQuantity('');
    setPrice('');
    setDateError('');
  };

  const handleAddFuturePrice = async () => {
    if (!selectedItem || !scheduledTime || !quantity || !price) {
      setError('Please fill in all required fields');
      return;
    }
    // User decision 04/11/2026: a past time is refused (the reference accepts it,
    // but it only auto-applies a minute later and the row vanishes unexplained;
    // "Apply" is the way to apply now).
    if (scheduledTime <= new Date()) {
      setDateError('Please select a time that is in the future');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setDateError('');

      const resolvedOutletId =
        getOutletId() ?? selectedProductDetails?.outletId ?? selectedItem?.outletId;
      await futurePriceService.createFuturePrice({
        productId: selectedItem.id,
        productName: selectedItem.name,
        itemType: 'Product',
        priceSetId: priceSetId || null,
        quantity: parseFloat(quantity),
        price: parseFloat(price),
        effectiveAt: scheduledTime.toISOString(),
        ...(resolvedOutletId != null ? { outletId: resolvedOutletId } : {}),
      });

      await fetchPrices();
      setScheduleDialogOpen(false);
      resetScheduleForm();
      flash('Future price scheduled successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to schedule future price');
    } finally {
      setLoading(false);
    }
  };

  const confirmRow = confirm?.row;

  return (
    /* Reference spacing: page top 27px, 3px between the h1 and New. */
    <Box sx={{ px: 1, pt: '27px', pb: 1, backgroundColor: '#fff', minHeight: 'calc(100vh - 50px)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '3px', mb: '20px' }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, fontSize: 32, color: '#000' }}>
          Future Prices
        </Typography>
        <Button
          variant="contained"
          disableElevation
          startIcon={<AddIcon />}
          onClick={() => setScheduleDialogOpen(true)}
          sx={NEW_BUTTON_SX}
        >
          New
        </Button>
      </Box>

      {/* Reference: a plain full-width search bar (no icon) above the filters. */}
      <TextField
        fullWidth
        placeholder="Search for products and families..."
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        sx={{
          mb: '34px',
          '& .MuiOutlinedInput-root': FIELD_SX,
          '& .MuiOutlinedInput-input': { px: '14px' },
          '& input::placeholder': { color: '#808080', opacity: 1 },
        }}
      />

      {/* Reference order: Category | Start Date | End Date | Created By | Price Set.
          Our addition under All Outlets: Outlets first. The 34px above leaves room
          for the floating labels. */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', '& > *': { flexBasis: 0, minWidth: 220 } }}>
        {isAllOutlets && (
          <MultiFilter label="Outlets" options={outlets} value={selectedOutlets} onChange={setSelectedOutlets} />
        )}

        {/* Reference Category is a SEARCHABLE autocomplete (text input + filter-as-you-type). */}
        <Box sx={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <FloatLabel show={categoryOpen || categoryFocused || !!selectedCategory}>Category</FloatLabel>
          <Autocomplete
            open={categoryOpen}
            onOpen={() => setCategoryOpen(true)}
            onClose={() => setCategoryOpen(false)}
            sx={{
              '& .MuiAutocomplete-clearIndicator': { visibility: selectedCategory ? 'visible' : 'hidden', p: '2px' },
              '& .MuiAutocomplete-clearIndicator .MuiSvgIcon-root': CLEAR_ICON_SX,
              '& .MuiAutocomplete-inputRoot': { pl: '14px' },
              '& .MuiAutocomplete-inputRoot .MuiAutocomplete-input': { pl: 0 },
            }}
            options={categories}
            getOptionLabel={(o) => o?.name || ''}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            value={categories.find((c) => c.id === selectedCategory) || null}
            onChange={(_e, v) => setSelectedCategory(v ? v.id : '')}
            noOptionsText="No Options"
            slotProps={{ paper: { sx: LIST_PAPER_SX } }}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Category"
                onFocus={() => setCategoryFocused(true)}
                onBlur={() => setCategoryFocused(false)}
                sx={{ '& .MuiOutlinedInput-root': { ...FIELD_SX, py: '0 !important' }, '& input::placeholder': { color: '#808080', opacity: 1 } }}
              />
            )}
          />
        </Box>

        <DateTimeField value={startDate} onChange={setStartDate} placeholder="Start Date" />
        <DateTimeField value={endDate} onChange={setEndDate} placeholder="End Date" />

        <MultiFilter label="Created By" options={filterOptions.createdBy} value={selectedCreators} onChange={setSelectedCreators} />
        <MultiFilter label="Price Set" options={filterOptions.priceSets} value={selectedPriceSets} onChange={setSelectedPriceSets} />
      </Box>

      {/* Reference keeps the count and all four bulk actions on ONE row, right-aligned.
          No Filter button exists — filters self-apply. */}
      <Box sx={{ display: 'flex', gap: 2, mt: '32px', mb: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
        <Box sx={{ flexGrow: 1 }} />
        {/* Reference drops the count and all bulk actions entirely when there are no rows. */}
        {futurePrices.length > 0 && (
          <>
        {/* Reference: inline-block, 19px line box, padding 0 8px 0 0 (no margin). */}
        <Typography
          component="span"
          sx={{ display: 'inline-block', fontSize: 16, lineHeight: '19px', color: '#000', padding: '0 8px 0 0' }}
        >
          {selectedPrices.length} Selected Prices
        </Typography>
        <Button
          variant="outlined"
          onClick={() => setConfirm({ kind: 'delete', ids: selectedPrices })}
          disabled={selectedPrices.length === 0}
          sx={BULK_DANGER_SX}
        >
          Delete Selected Prices
        </Button>
        <Button
          variant="outlined"
          onClick={() => setConfirm({ kind: 'delete', ids: futurePrices.map((p) => p.id) })}
          disabled={futurePrices.length === 0}
          sx={BULK_DANGER_SX}
        >
          Delete All Prices
        </Button>
        <Button
          variant="outlined"
          onClick={() => setConfirm({ kind: 'apply', ids: selectedPrices })}
          disabled={selectedPrices.length === 0}
          sx={BULK_PRIMARY_SX}
        >
          Apply Selected Prices
        </Button>
        <Button
          variant="outlined"
          onClick={() => setConfirm({ kind: 'apply', ids: futurePrices.map((p) => p.id) })}
          disabled={futurePrices.length === 0}
          sx={BULK_PRIMARY_SX}
        >
          Apply All Prices
        </Button>
          </>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* The empty-set block is for "nothing scheduled at all"; with a filter or
          search active the grid stays, with its columns and a no-results row. */}
      {!loadedOnce ? null : futurePrices.length === 0 && !filtersActive ? (
        /* Reference replaces the whole table with this block when there are no rows. */
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, py: 8 }}>
          {/* Reference: 200x160 black empty-set icon, 24px black H2, black subtitle. */}
          <BlockIcon sx={{ width: 200, height: 160, color: '#000' }} />
          <Box>
            <Typography variant="h2" component="h2" sx={{ fontWeight: 700, fontSize: 24, color: '#000', mb: 1 }}>
              No Future Prices
            </Typography>
            <Typography sx={{ color: '#000', fontSize: 16 }}>
              There are no prices set to be activated in the future.
            </Typography>
          </Box>
        </Box>
      ) : (
      /* Same grid as the other Utilities lists: 51px rounded sky header, 58px white rows, no rules. */
      <TableContainer sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
        {/* Fixed layout: the data columns share the width equally; checkbox and
            actions keep their own widths. */}
        <Table sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow
              sx={{
                '& th': { bgcolor: '#5ebbeb', color: '#fff', fontSize: 16, fontWeight: 700, border: 0, height: 51, py: 0, px: '8px' },
                '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
                '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' },
              }}
            >
              <TableCell padding="checkbox" sx={{ pl: '20px', width: 48, boxSizing: 'border-box' }}>
                <Checkbox
                  {...CHECKBOX_GLYPHS}
                  indeterminate={selectedPrices.length > 0 && selectedPrices.length < futurePrices.length}
                  checked={futurePrices.length > 0 && selectedPrices.length === futurePrices.length}
                  onChange={handleSelectAll}
                  sx={{ ...CHECKBOX_SX, color: '#fff', '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: '#fff' } }}
                />
              </TableCell>
              {COLUMNS.map((col) => {
                const active = orderBy === col.id;
                return (
                  <TableCell key={col.id} sx={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', '&&': { p: 0 } }} onClick={() => handleSort(col.id)}>
                    {/* Report-page sort glyph (up/down triangles, the current direction
                        filled), shown only on the sorted column. */}
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', height: 51, px: '8px' }}>
                      {col.label}
                      {active && <SortGlyph active={order} />}
                    </Box>
                  </TableCell>
                );
              })}
              {/* Reference leaves the row-action column header blank. */}
              <TableCell sx={{ width: 236 }} />
            </TableRow>
          </TableHead>
          <TableBody
            sx={{
              '& tr': { bgcolor: '#fff' },
              '& td': { border: 0, height: 58, py: 0, px: '8px', fontSize: 16, color: '#000' },
            }}
          >
            {pagedPrices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNS.length + 2} align="center" sx={{ py: 4, color: '#000', fontSize: 16 }}>
                  No results found. Change search filters and try again.
                </TableCell>
              </TableRow>
            ) : (
              pagedPrices.map((row) => (
                <TableRow key={row.id}>
                  <TableCell padding="checkbox" sx={{ pl: '20px' }}>
                    <Checkbox
                      {...CHECKBOX_GLYPHS}
                      checked={selectedPrices.includes(row.id)}
                      onChange={() => handleSelectPrice(row.id)}
                      sx={CHECKBOX_SX}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 12, color: '#404040', lineHeight: '16px' }}>{row.itemType}</Typography>
                    <Typography sx={{ fontSize: 16, color: '#000', lineHeight: '20px' }}>{row.itemName}</Typography>
                  </TableCell>
                  {isAllOutlets && <TableCell>{row.outletName}</TableCell>}
                  <TableCell>{row.priceSet}</TableCell>
                  <TableCell>{row.createdBy}</TableCell>
                  <TableCell>{row.quantity}</TableCell>
                  <TableCell>
                    {row.currentPrice == null ? '—' : formatCurrency(row.currentPrice)}
                  </TableCell>
                  <TableCell>{formatCurrency(row.price)}</TableCell>
                  <TableCell>{formatDate(row.effectiveAt)}</TableCell>
                  <TableCell>
                    {/* Reference row actions are outlined pills — unlike Future Costs, which
                        uses borderless text links for the same two actions. */}
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', pr: '8px' }}>
                      <Button
                        variant="outlined"
                        startIcon={<DeleteIcon />}
                        onClick={() => setConfirm({ kind: 'delete', ids: [row.id], row })}
                        sx={rowActionSx('#e7000b', '#fb2c36')}
                      >
                        Delete
                      </Button>
                      {!row.isApplied && (
                        <Button
                          variant="outlined"
                          startIcon={<CheckCircleIcon />}
                          onClick={() => setConfirm({ kind: 'apply', ids: [row.id], row })}
                          sx={rowActionSx('#00a63e', '#00c950')}
                        >
                          Apply
                        </Button>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {/* Same page picker as the Products list: only when there is more than one page. */}
        {sortedPrices.length > rowsPerPage && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, mb: 2 }}>
            <Pagination
              count={Math.ceil(sortedPrices.length / rowsPerPage)}
              page={safePage + 1}
              onChange={(_e, p) => setPage(p - 1)}
              color="primary"
              size="large"
              showFirstButton
              showLastButton
            />
          </Box>
        )}
      </TableContainer>
      )}

      <FuturePriceConfirmDialog
        open={confirm?.kind === 'delete'}
        variant="delete"
        row={confirmRow}
        count={confirm?.ids?.length || 0}
        loading={loading}
        onCancel={() => setConfirm(null)}
        onConfirm={() => runDelete(confirm.ids)}
        formatCurrency={formatCurrency}
        formatDate={formatDate}
      />

      <FuturePriceConfirmDialog
        open={confirm?.kind === 'apply'}
        variant="apply"
        row={confirmRow}
        count={confirm?.ids?.length || 0}
        loading={loading}
        onCancel={() => setConfirm(null)}
        onConfirm={() => runApply(confirm.ids)}
        formatCurrency={formatCurrency}
        formatDate={formatDate}
      />

      <Dialog
        open={scheduleDialogOpen}
        onClose={() => {
          setScheduleDialogOpen(false);
          resetScheduleForm();
        }}
        maxWidth={false}
        PaperProps={{ sx: { width: 448, maxWidth: '100%', borderRadius: '8px' } }}
      >
        {/* Reference: full-width sky-200 header band, '?' icon + 18px/400 sky-800 title. */}
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            backgroundColor: '#b8e6fe',
            px: 3,
            py: 2,
          }}
        >
          {/* Reference: a bold "?" glyph (no circle) and a bold sky-800 title. */}
          <Typography component="span" sx={{ fontSize: 22, fontWeight: 700, color: '#0369a1', lineHeight: 1 }}>
            ?
          </Typography>
          <Typography component="span" sx={{ fontSize: 18, fontWeight: 700, color: '#0369a1' }}>
            Schedule Price Change
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          {dateError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDateError('')}>
              {dateError}
            </Alert>
          )}
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12}>
              <Autocomplete
                autoHighlight
                options={itemSearchResults}
                filterOptions={(options) => options}
                getOptionLabel={(option) => (typeof option === 'string' ? option : option.name || '')}
                isOptionEqualToValue={(option, value) => !!option && !!value && option.id === value.id}
                value={selectedItem}
                loading={itemSearchLoading}
                // Reference groups results under a bold 'Products' header and hints
                // 'Keep Typing to Search...' while under the 2-char minimum.
                groupBy={() => 'Products'}
                noOptionsText={
                  itemSearchText.trim().length < 2 ? 'Keep Typing to Search...' : 'No Results Found'
                }
                slotProps={{
                  paper: {
                    sx: {
                      mt: '4px',
                      border: '1px solid #000',
                      borderRadius: '8px',
                      '& .MuiAutocomplete-groupLabel': { fontWeight: 700, fontSize: 16, color: '#000', lineHeight: '56px', px: '14px', borderBottom: '1px solid #e5e5e5' },
                      '& .MuiAutocomplete-listbox': { maxHeight: 289, py: 0 },
                      '& .MuiAutocomplete-option': { minHeight: 56, px: '14px', fontSize: 16, color: '#000' },
                      '& .MuiAutocomplete-option.Mui-focused': { bgcolor: '#7dd3fc !important' },
                    },
                  },
                }}
                // Reference rows: product name with its family (else brand) in small grey under it.
                renderOption={(props, option) => {
                  const { key: _key, ...optionProps } = props;
                  const sub = option.family?.name || option.brand?.name || '';
                  return (
                    <li key={option.id} {...optionProps} style={{ ...optionProps.style, display: 'block' }}>
                      <Box sx={{ lineHeight: '20px' }}>{option.name}</Box>
                      {sub && <Box sx={{ fontSize: 13, color: '#737373', lineHeight: '16px' }}>{sub}</Box>}
                    </li>
                  );
                }}
                onInputChange={async (event, newValue) => {
                  setItemSearchText(newValue || '');
                  if (newValue && newValue.trim().length >= 2) {
                    setItemSearchLoading(true);
                    try {
                      const response = await productService.getProducts({
                        search: newValue,
                        limit: 10,
                        status: 'Active',
                      });
                      setItemSearchResults(response.products || []);
                    } catch (err) {
                      console.error('Error searching products:', err);
                      setItemSearchResults([]);
                    } finally {
                      setItemSearchLoading(false);
                    }
                  } else {
                    setItemSearchResults([]);
                  }
                }}
                onChange={async (event, newValue) => {
                  setQuantity('');
                  setPrice('');
                  if (newValue && typeof newValue !== 'string') {
                    setSelectedItem(newValue);
                    try {
                      const productResponse = await productService.getProduct(newValue.id);
                      setSelectedProductDetails(productResponse?.product || null);
                    } catch (err) {
                      console.error('Error fetching product details:', err);
                      setSelectedProductDetails(null);
                    }
                  } else {
                    setSelectedItem(null);
                    setSelectedProductDetails(null);
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Search items..."
                    sx={{ '& .MuiOutlinedInput-root': DIALOG_INPUT_SX }}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {itemSearchLoading ? <SearchIcon /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </Grid>

            {/* Reference: a family product warns that its siblings take the price too. */}
            {selectedItem && (selectedProductDetails?.family?.name || selectedItem?.family?.name) && (
              <Grid item xs={12} sx={{ pt: '8px !important' }}>
                <Typography sx={{ fontSize: 16, color: '#404040', lineHeight: '20px' }}>
                  Will also apply price to family: {selectedProductDetails?.family?.name || selectedItem?.family?.name}
                </Typography>
              </Grid>
            )}

            {/* Reference: Product Price / Product Cost (for the typed quantity) appear
                under the item once one is chosen; cost sits right-aligned. */}
            {selectedItem && (
              <Grid item xs={12} sx={{ pt: '8px !important' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography sx={{ fontSize: 16, color: '#404040', lineHeight: '20px' }}>Product Price</Typography>
                    <Typography sx={{ fontSize: 16, color: '#000', lineHeight: '20px' }}>
                      {/* Reference: a dash until a quantity is typed, then price x quantity. */}
                      {selectedProductDetails && parseFloat(quantity) > 0 ? formatCurrency(getProductPrice(selectedProductDetails) * parseFloat(quantity)) : <Box component="span" sx={{ fontWeight: 700 }}>—</Box>}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontSize: 16, color: '#404040', lineHeight: '20px' }}>Product Cost</Typography>
                    <Typography sx={{ fontSize: 16, color: '#000', lineHeight: '20px' }}>
                      {selectedProductDetails && parseFloat(quantity) > 0 ? formatCurrency(getProductCost(selectedProductDetails) * parseFloat(quantity)) : <Box component="span" sx={{ fontWeight: 700 }}>—</Box>}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            )}

            <Grid item xs={6}>
              {/* Reference Scheduled Time: "Scheduled Time" placeholder with a '...' opener,
                  its name above once open / set; disabled (bg #d4d4d4) until an item is
                  chosen. Same popover as the page filters. Past days are inert
                  (user decision 04/11/2026) rather than refused afterwards. */}
              <DialogLabel show={!!scheduledTime}>Scheduled Time</DialogLabel>
              <DateTimeField
                value={scheduledTime}
                onChange={(d) => { setScheduledTime(d); setDateError(''); }}
                placeholder="Scheduled Time"
                showLabel={false}
                disabled={!selectedItem}
                disablePast
                error={!!dateError}
                suffix="..."
              />
              {dateError && (
                <Typography sx={{ color: '#e33430', fontSize: 12, mt: 0.5 }}>{dateError}</Typography>
              )}
            </Grid>

            <Grid item xs={6}>
              {/* Reference: "Optionally select a Price Set that should apply to" - the
                  price is applied INTO this set; Default + the sets the product's
                  outlet can reach. Its name always sits above; disabled until an item. */}
              <DialogLabel show>Price Set</DialogLabel>
              <FormControl fullWidth disabled={!selectedItem}>
                <Select
                  value={priceSetId}
                  onChange={(e) => setPriceSetId(Number(e.target.value) || 0)}
                  // A long set name clips with "..." before the arrow instead of running under it.
                  sx={{ ...DIALOG_INPUT_SX, height: 42, fontSize: 16, '& .MuiSelect-select': { py: 0, pl: '14px', pr: '36px !important', lineHeight: '42px', height: '42px !important', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }}
                  MenuProps={SELECT_MENU_PROPS}
                >
                  {priceSets.map((set) => (
                    <MenuItem key={set.id} value={set.id}>
                      {set.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={6}>
              <DialogLabel show={quantityFocused || quantity !== ''}>Quantity</DialogLabel>
              <TextField
                fullWidth
                placeholder={quantityFocused ? '' : 'Quantity'}
                type="number"
                value={quantity}
                // Reference disables Quantity/Price/Scheduled Time until an item is chosen.
                disabled={!selectedItem}
                sx={DIALOG_FIELD_SX}
                onFocus={(e) => { setQuantityFocused(true); e.target.select(); }}
                onBlur={() => setQuantityFocused(false)}
                // Reference: the quantity only drives the Product Price / Cost readout
                // above; the Price field stays whatever the user typed (no suggestion).
                onChange={(e) => setQuantity(e.target.value)}
                inputProps={{ min: 0 }}
              />
            </Grid>

            <Grid item xs={6}>
              <DialogLabel show={priceFocused || price !== ''}>Price</DialogLabel>
              <TextField
                fullWidth
                placeholder={priceFocused ? '' : 'Price'}
                type="number"
                value={price}
                disabled={!selectedItem}
                sx={DIALOG_FIELD_SX}
                // Suggested price is a starting point: focusing selects it so typing replaces.
                onFocus={(e) => { setPriceFocused(true); e.target.select(); }}
                onBlur={() => setPriceFocused(false)}
                onChange={(e) => setPrice(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start" sx={{ mr: '6px', '& p': { color: '#404040', fontSize: 16 } }}>$</InputAdornment> }}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => {
              setScheduleDialogOpen(false);
              resetScheduleForm();
            }}
            sx={{
              width: 118,
              height: 42,
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: 16,
              textTransform: 'none',
              color: '#000',
              backgroundColor: '#d4d4d4',
              transition: INSTANT,
              '&:hover': { backgroundColor: '#c4c4c4' },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddFuturePrice}
            variant="contained"
            disableElevation
            disabled={loading || !selectedItem || !scheduledTime || !quantity || !price || !!dateError}
            sx={{
              width: 118,
              height: 42,
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: 16,
              textTransform: 'none',
              // Reference: sky-500 when ready; light grey, grey text, thin grey border until then.
              bgcolor: '#00a6f4',
              color: '#fff',
              border: '1px solid #00a6f4',
              boxShadow: 'none',
              transition: INSTANT,
              '&:hover': { bgcolor: '#0084d1', borderColor: '#0084d1', boxShadow: 'none' },
              '&.Mui-disabled': { bgcolor: '#e5e5e5', color: '#737373', borderColor: '#a1a1a1' },
            }}
          >
            {loading ? 'Add...' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FuturePrices;
