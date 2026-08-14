import React, { useState, useEffect, useCallback } from 'react';
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
  Checkbox,
  TextField,
  Alert,
  Select,
  MenuItem,
  InputBase,
  Popover,
  IconButton,
  InputAdornment,
  SvgIcon,
} from '@mui/material';
import {
  RocketLaunch as PromotionIcon,
  FilterList as ProductIcon,
  AttachMoney as PriceListIcon,
  People as UserIcon,
  Person as RoleIcon,
  PersonOutline as CustomerIcon,
  Group as CustomerGroupIcon,
  LocalShipping as SupplierIcon,
  Category as ClassificationIcon,
  UnarchiveOutlined as RecoverIcon,
  CloseOutlined as ClearIcon,
  CalendarMonthOutlined as CalendarIcon,
  ChevronLeftOutlined as PrevIcon,
  ChevronRightOutlined as NextIcon,
  ReceiptOutlined as ReceiptIcon,
  PaymentOutlined as PaymentMethodIcon,
  PercentOutlined as TaxRateIcon,
  ShoppingCartOutlined as OrderIcon,
  SellOutlined as BrandIcon,
  AccountTreeOutlined as FamilyIcon,
  LocalOfferOutlined as TagIcon,
} from '@mui/icons-material';
import {
  formatDistanceToNow,
  parse,
  isValid,
  format,
  addMonths,
  startOfMonth,
  getDaysInMonth,
  getDay,
  isSameDay,
} from 'date-fns';
import trashedItemsService from '../../services/trashedItemsService';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';

const FILTER_LABEL_SX = { mb: 0.5, fontWeight: 400, fontSize: 16, color: '#000' };
const FIELD_WIDTH = 608;

// Reference checkbox is a 28x32 / radius-4 light square, not MUI's default 42x42 hit area.
const CHECKBOX_SX = {
  p: 0,
  width: 28,
  height: 32,
  borderRadius: '4px',
  '& .MuiSvgIcon-root': { fontSize: 20 },
};

// Reference draws the checkbox with FontAwesome glyphs (fal fa-square unchecked,
// fas fa-minus-square partial, fas fa-check-square checked). No FA dependency here, so the
// same geometry is redrawn inline on FA's 448x512 grid; the solid states knock the glyph out
// of the filled square exactly like FA does, so the row/header background shows through.
// ponytail: shared mask ids are fine - every instance renders identical mask content.
const FA_BOX = { x: 0, y: 32, width: 448, height: 448, rx: 48 };
const faSolid = (id, glyph) => (
  <>
    <mask id={id} maskUnits="userSpaceOnUse" x="0" y="32" width="448" height="448">
      <rect {...FA_BOX} fill="#fff" />
      {glyph}
    </mask>
    <rect {...FA_BOX} fill="currentColor" mask={`url(#${id})`} />
  </>
);
const CHECKBOX_ICON = (
  <SvgIcon viewBox="0 0 448 512">
    <rect x="16" y="48" width="416" height="416" rx="32" fill="none" stroke="currentColor" strokeWidth="32" />
  </SvgIcon>
);
const CHECKBOX_INDETERMINATE_ICON = (
  <SvgIcon viewBox="0 0 448 512">
    {faSolid('fa-minus-square', <rect x="96" y="232" width="256" height="48" rx="8" />)}
  </SvgIcon>
);
const CHECKBOX_CHECKED_ICON = (
  <SvgIcon viewBox="0 0 448 512">
    {faSolid(
      'fa-check-square',
      <path d="M112 268 L188 344 L340 176" fill="none" stroke="#000" strokeWidth="48" strokeLinecap="round" strokeLinejoin="round" />
    )}
  </SvgIcon>
);
const CHECKBOX_ICONS = {
  icon: CHECKBOX_ICON,
  indeterminateIcon: CHECKBOX_INDETERMINATE_ICON,
  checkedIcon: CHECKBOX_CHECKED_ICON,
};

const FIELD_SX = {
  backgroundColor: '#fff',
  width: '100%',
  '& .MuiOutlinedInput-root': {
    height: 42,
    borderRadius: '8px',
    fontSize: 16,
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' },
  },
  '& .MuiOutlinedInput-input': { padding: '9px 16px' },
  '& input::placeholder': { color: '#808080', opacity: 1 },
};

// Select's sx lands ON the OutlinedInput root, not a descendant of it, so FIELD_SX's
// `& .MuiOutlinedInput-root` rules never matched and it fell back to MUI defaults
// (radius 4px / rgba(0,0,0,0.23)). Same tokens, addressed from the root.
const SELECT_SX = {
  backgroundColor: '#fff',
  width: '100%',
  height: 42,
  borderRadius: '8px',
  fontSize: 16,
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' },
  '& .MuiSelect-select': { padding: '9px 16px' },
};

// Reference option list + order (UPPERCASE) — exactly these 16, no more.
// `Classification` rows still render, are still icon-mapped and still recover; the
// reference just doesn't offer it as a *filter* option, and the reference wins.
const ITEM_TYPES = [
  { value: 'Product', label: 'PRODUCT' },
  { value: 'Receipt', label: 'RECEIPT' },
  { value: 'Payment_method', label: 'PAYMENT METHOD' },
  { value: 'Tax_rate', label: 'TAX RATE' },
  { value: 'User', label: 'USER' },
  { value: 'Customer', label: 'CUSTOMER' },
  { value: 'Customer_group', label: 'CUSTOMER GROUP' },
  { value: 'Price_list', label: 'PRICE LIST' },
  { value: 'Supplier', label: 'SUPPLIER' },
  { value: 'Promotion', label: 'PROMOTION' },
  { value: 'Order', label: 'ORDER' },
  { value: 'Brand', label: 'BRAND' },
  { value: 'Role', label: 'ROLE' },
  { value: 'Category', label: 'CATEGORY' },
  { value: 'Family', label: 'FAMILY' },
  { value: 'Tag', label: 'TAG' },
];

// Typed dd/MM/yyyy stays the source of truth (the calendar popover writes into the
// same text state); parsing doubles as the validity guard that stops partial-year queries.
const parseDate = (text) => {
  const d = parse(text.trim(), 'dd/MM/yyyy', new Date());
  return isValid(d) ? d : null;
};

const TrashedItems = () => {
  const [trashedItems, setTrashedItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [confirm, setConfirm] = useState(null); // { item } | { bulk: true }

  // Filters
  const [selectedType, setSelectedType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [startText, setStartText] = useState('');
  const [endText, setEndText] = useState('');
  const [calAnchor, setCalAnchor] = useState(null);
  const [calMonth, setCalMonth] = useState(() => startOfMonth(new Date()));

  const fetchTrashedItems = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const filters = {};
      if (selectedType) filters.type = selectedType;
      if (searchTerm) filters.search = searchTerm;
      const start = parseDate(startText);
      const end = parseDate(endText);
      if (start) filters.startDate = start.toISOString();
      if (end) filters.endDate = end.toISOString();

      const response = await trashedItemsService.getTrashedItems(filters);

      if (response && response.items) {
        setTrashedItems(response.items);
        // Reference keeps 'Total Count' at the GLOBAL trash total even while search/type/date
        // filters are active — only an unfiltered fetch may (re)set it; restores decrement it.
        if (Object.keys(filters).length === 0) {
          setTotalCount(response.totalCount || response.items.length);
        }
      }
    } catch (err) {
      console.error('Error fetching trashed items:', err);
      setError(err.response?.data?.error || 'Failed to fetch trashed items');
    } finally {
      setLoading(false);
    }
  }, [selectedType, searchTerm, startText, endText]);

  // Debounced: a half-typed date/name must not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(fetchTrashedItems, 400);
    return () => clearTimeout(t);
  }, [fetchTrashedItems]);

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelectedItems(trashedItems.map((item) => ({ id: item.id, type: item.type })));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (itemId, itemType) => {
    setSelectedItems((prev) => {
      const exists = prev.find((item) => item.id === itemId && item.type === itemType);
      if (exists) {
        return prev.filter((item) => !(item.id === itemId && item.type === itemType));
      }
      return [...prev, { id: itemId, type: itemType }];
    });
  };

  const restoreOne = async (itemId, itemType) => {
    try {
      setLoading(true);
      setError('');

      await trashedItemsService.restoreItem(itemId, itemType);

      setTrashedItems((prev) => prev.filter((item) => !(item.id === itemId && item.type === itemType)));
      setSelectedItems((prev) => prev.filter((item) => !(item.id === itemId && item.type === itemType)));
      setTotalCount((prev) => prev - 1);
      setSuccess('Item restored successfully!');

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to restore item');
    } finally {
      setLoading(false);
    }
  };

  const restoreSelected = async () => {
    try {
      setLoading(true);
      setError('');

      // The backend destructures `{ itemId, itemType }` (routes/trashedItems.js:319) and
      // echoes that same object back in `details[].item` — post its key names, not ours.
      const res = await trashedItemsService.restoreMultipleItems(
        selectedItems.map(({ id, type }) => ({ itemId: id, itemType: type }))
      );
      // restore-multiple always answers 200; per-item failures only show up in
      // `details`. Trust that, never the optimistic assumption that all succeeded.
      const failed = new Set((res?.details || []).map((d) => `${d.item?.itemId}-${d.item?.itemType}`));
      const restored = selectedItems
        .map((item) => `${item.id}-${item.type}`)
        .filter((key) => !failed.has(key));
      const restoredKeys = new Set(restored);

      setTrashedItems((prev) => prev.filter((item) => !restoredKeys.has(`${item.id}-${item.type}`)));
      setTotalCount((prev) => prev - restoredKeys.size);
      setSelectedItems((prev) => prev.filter((item) => failed.has(`${item.id}-${item.type}`)));

      if (restoredKeys.size > 0) {
        setSuccess(`${restoredKeys.size} item(s) restored successfully!`);
        setTimeout(() => setSuccess(''), 3000);
      }
      if (failed.size > 0) {
        const first = res.details[0]?.error || 'Failed to restore item';
        setError(
          failed.size === 1
            ? first
            : `Failed to restore ${failed.size} item(s): ${first}`
        );
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to restore items');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    const pending = confirm;
    setConfirm(null);
    if (!pending) return;
    if (pending.bulk) {
      await restoreSelected();
    } else {
      await restoreOne(pending.item.id, pending.item.type);
    }
  };

  const getTypeIcon = (type) => {
    const sx = { fontSize: 18, mr: 0.5 };
    switch (type) {
      case 'Promotion':
        return <PromotionIcon sx={sx} />;
      case 'Product':
        return <ProductIcon sx={sx} />;
      case 'Price_list':
        return <PriceListIcon sx={sx} />;
      case 'User':
        return <UserIcon sx={sx} />;
      case 'Role':
        return <RoleIcon sx={sx} />;
      case 'Customer':
        return <CustomerIcon sx={sx} />;
      case 'Customer_group':
        return <CustomerGroupIcon sx={sx} />;
      case 'Supplier':
        return <SupplierIcon sx={sx} />;
      case 'Classification':
      case 'Category':
        return <ClassificationIcon sx={sx} />;
      case 'Receipt':
        return <ReceiptIcon sx={sx} />;
      case 'Payment_method':
        return <PaymentMethodIcon sx={sx} />;
      case 'Tax_rate':
        return <TaxRateIcon sx={sx} />;
      case 'Order':
        return <OrderIcon sx={sx} />;
      case 'Brand':
        return <BrandIcon sx={sx} />;
      case 'Family':
        return <FamilyIcon sx={sx} />;
      case 'Tag':
        return <TagIcon sx={sx} />;
      default:
        return null;
    }
  };

  const formatDeletedAt = (dateString) => {
    if (!dateString) return '';
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return dateString;
    }
  };

  const isItemSelected = (itemId, itemType) =>
    selectedItems.some((item) => item.id === itemId && item.type === itemType);

  const allSelected = trashedItems.length > 0 && selectedItems.length === trashedItems.length;
  const someSelected = selectedItems.length > 0 && selectedItems.length < trashedItems.length;

  const dateInputSx = {
    flex: 1,
    height: 41,
    fontSize: 16,
    px: 2,
    '& input::placeholder': { color: '#808080', opacity: 1 },
  };

  const today = new Date();
  const startDate = parseDate(startText);
  const endDate = parseDate(endText);

  const handleDayClick = (day) => {
    if (!startDate || endDate) {
      setStartText(format(day, 'dd/MM/yyyy'));
      setEndText('');
    } else if (day < startDate) {
      setStartText(format(day, 'dd/MM/yyyy'));
    } else {
      setEndText(format(day, 'dd/MM/yyyy'));
    }
  };

  const renderMonth = (monthDate) => {
    const blanks = getDay(startOfMonth(monthDate));
    const days = getDaysInMonth(monthDate);
    return (
      <Box key={format(monthDate, 'yyyy-MM')} sx={{ width: 252 }}>
        <Typography sx={{ textAlign: 'center', fontWeight: 700, fontSize: 14, color: '#313439', mb: 1 }}>
          {format(monthDate, 'MMMM yyyy')}
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 36px)' }}>
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
            <Typography key={d} sx={{ textAlign: 'center', fontSize: 12, color: '#676b72', lineHeight: '24px' }}>
              {d}
            </Typography>
          ))}
          {Array.from({ length: blanks }).map((_, i) => (
            <Box key={`blank-${i}`} />
          ))}
          {Array.from({ length: days }).map((_, i) => {
            const day = new Date(monthDate.getFullYear(), monthDate.getMonth(), i + 1);
            const selected = (startDate && isSameDay(day, startDate)) || (endDate && isSameDay(day, endDate));
            const inRange = startDate && endDate && day > startDate && day < endDate;
            return (
              <Box
                key={i}
                component="button"
                type="button"
                onClick={() => handleDayClick(day)}
                sx={{
                  width: 36,
                  height: 36,
                  p: 0,
                  fontSize: 14,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  bgcolor: selected ? '#5ebbeb' : inRange ? 'rgba(94,187,235,0.15)' : 'transparent',
                  color: selected ? '#fff' : '#313439',
                  // Current day circled blue, as on the reference.
                  border: isSameDay(day, today) && !selected ? '1px solid #5ebbeb' : 0,
                  borderRadius: '50%',
                  '&:hover': { bgcolor: selected ? '#4aa9dd' : 'rgba(0,0,0,0.05)' },
                }}
              >
                {i + 1}
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ p: 3, pb: 10, backgroundColor: '#f5f5f5', minHeight: 'calc(100vh - 50px)' }}>
      <Box sx={{ mb: 3 }}>
        <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: '#000', mb: 1 }}>
          Trashed Items
        </Typography>
        <Typography component="h2" sx={{ fontSize: 24, fontWeight: 700, color: '#000' }}>
          Total Count: {totalCount}
        </Typography>
        <Typography sx={{ fontSize: 14, color: '#374151', mt: 0.5 }}>
          Trashed items are limited to the last 100 days
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap', mb: 3 }}>
        <Box sx={{ width: FIELD_WIDTH, maxWidth: '100%' }}>
          <Typography sx={FILTER_LABEL_SX}>Type</Typography>
          <Select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            displayEmpty
            renderValue={(value) =>
              value ? (
                ITEM_TYPES.find((t) => t.value === value)?.label
              ) : (
                <Box component="span" sx={{ color: '#808080' }}>Select Type...</Box>
              )
            }
            sx={SELECT_SX}
            // Reference shows an 'x' beside the chevron once a value is picked — the only
            // way to reset the filter back to the 'Select Type...' placeholder.
            endAdornment={
              selectedType ? (
                <InputAdornment position="end" sx={{ mr: '28px' }}>
                  <IconButton
                    size="small"
                    aria-label="Clear type filter"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => setSelectedType('')}
                    sx={{ p: '2px' }}
                  >
                    <ClearIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </InputAdornment>
              ) : null
            }
            // Reference panel is attached under the input (no elevation shadow, no border),
            // ~230px visible and scrollable.
            MenuProps={{
              anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
              transformOrigin: { vertical: 'top', horizontal: 'left' },
              PaperProps: {
                sx: { maxHeight: 230, borderRadius: '8px', boxShadow: 'none', border: 0, bgcolor: '#fff' },
              },
              MenuListProps: { sx: { py: 0 } },
            }}
          >
            {/* Reference lists the 16 types only — 'Select Type...' is the placeholder, not a row. */}
            {ITEM_TYPES.map((type) => (
              <MenuItem key={type.value} value={type.value} sx={{ height: 56, p: '16px', fontSize: 16 }}>
                {type.label}
              </MenuItem>
            ))}
          </Select>
        </Box>

        <Box sx={{ width: FIELD_WIDTH, maxWidth: '100%' }}>
          <Typography sx={FILTER_LABEL_SX}>Search by item name</Typography>
          <TextField
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Name..."
            sx={FIELD_SX}
          />
        </Box>

        <Box sx={{ width: FIELD_WIDTH, maxWidth: '100%' }}>
          <Typography sx={FILTER_LABEL_SX}>Deleted At (Within last 100 days)</Typography>
          <Box
            onClick={(e) => {
              if (startDate) setCalMonth(startOfMonth(startDate));
              setCalAnchor(e.currentTarget);
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#fff',
              border: '1px solid #404040',
              borderRadius: '8px',
            }}
          >
            <InputBase
              value={startText}
              onChange={(e) => setStartText(e.target.value)}
              placeholder="DD/MM/YYYY"
              inputProps={{ 'aria-label': 'Deleted at from' }}
              sx={dateInputSx}
            />
            <Box component="span" sx={{ color: '#676b72', fontSize: 16 }}>—</Box>
            <InputBase
              value={endText}
              onChange={(e) => setEndText(e.target.value)}
              placeholder="DD/MM/YYYY"
              inputProps={{ 'aria-label': 'Deleted at to' }}
              sx={dateInputSx}
            />
          </Box>
          {/* Reference: clicking the date box opens a two-month calendar popover with
              prev/next chevrons, a 'Current Day' shortcut and dual dd/mm/yyyy inputs.
              Focus stays in the underlying inputs so typing keeps working while open. */}
          <Popover
            open={Boolean(calAnchor)}
            anchorEl={calAnchor}
            onClose={() => setCalAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            disableAutoFocus
            disableEnforceFocus
            disableRestoreFocus
            PaperProps={{ sx: { p: 2, borderRadius: '8px' } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <CalendarIcon sx={{ fontSize: 20, color: '#676b72' }} />
              <InputBase
                value={startText}
                onChange={(e) => setStartText(e.target.value)}
                placeholder="dd/mm/yyyy"
                inputProps={{ 'aria-label': 'Calendar from' }}
                sx={{ width: 118, height: 32, fontSize: 14, px: 1, border: '1px solid #404040', borderRadius: '8px' }}
              />
              <Box component="span" sx={{ color: '#676b72', fontSize: 16 }}>—</Box>
              <InputBase
                value={endText}
                onChange={(e) => setEndText(e.target.value)}
                placeholder="dd/mm/yyyy"
                inputProps={{ 'aria-label': 'Calendar to' }}
                sx={{ width: 118, height: 32, fontSize: 14, px: 1, border: '1px solid #404040', borderRadius: '8px' }}
              />
              <Box
                component="button"
                type="button"
                onClick={() => {
                  const t = format(today, 'dd/MM/yyyy');
                  setStartText(t);
                  setEndText(t);
                  setCalMonth(startOfMonth(today));
                }}
                sx={{
                  ml: 'auto',
                  p: 0,
                  border: 0,
                  bgcolor: 'transparent',
                  color: '#32b643',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Current Day
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <IconButton
                size="small"
                aria-label="Previous month"
                onClick={() => setCalMonth((m) => addMonths(m, -1))}
                sx={{ mt: '2px' }}
              >
                <PrevIcon />
              </IconButton>
              {renderMonth(calMonth)}
              {renderMonth(addMonths(calMonth, 1))}
              <IconButton
                size="small"
                aria-label="Next month"
                onClick={() => setCalMonth((m) => addMonths(m, 1))}
                sx={{ mt: '2px' }}
              >
                <NextIcon />
              </IconButton>
            </Box>
          </Popover>
        </Box>
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

      {loading && trashedItems.length === 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <Typography>Loading...</Typography>
        </Box>
      )}

      {/* Reference outdents the grid 16px past the 24px filter gutter (grid x=8, filters x=24).
          overflow must stay visible so the sticky header pins against the window scroll,
          not the TableContainer's own (default overflow-x:auto) box. */}
      <TableContainer sx={{ backgroundColor: 'transparent', boxShadow: 'none', ml: '-16px', width: 'calc(100% + 16px)', overflow: 'visible' }}>
        <Table>
          <TableHead>
            <TableRow
              sx={{
                '& th': {
                  bgcolor: '#5ebbeb',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 16,
                  border: 0,
                  height: 51,
                  py: 0,
                  // Reference header is sticky: pinned just below the 50px fixed topbar.
                  position: 'sticky',
                  top: 50,
                  zIndex: 10,
                },
                '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
                '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' },
              }}
            >
              <TableCell padding="checkbox" sx={{ pl: '20px' }}>
                <Checkbox
                  indeterminate={someSelected}
                  checked={allSelected}
                  onChange={handleSelectAll}
                  {...CHECKBOX_ICONS}
                  sx={{ ...CHECKBOX_SX, color: '#fff', '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: '#fff' } }}
                  inputProps={{ 'aria-label': 'Select all trashed items' }}
                />
              </TableCell>
              {/* Reference proportions: Type ~30% with Name starting ~34%; Actions flush right. */}
              <TableCell sx={{ width: '30%' }}>Type</TableCell>
              <TableCell sx={{ width: '30%' }}>Name</TableCell>
              <TableCell sx={{ width: '16%' }}>Deleted At</TableCell>
              <TableCell align="right" sx={{ pr: '16px' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody
            sx={{
              '& tr': { bgcolor: '#fff' },
              '& td': { border: 0, bgcolor: '#fff', height: 74, py: 0, fontSize: 16, color: '#313439' },
            }}
          >
            {trashedItems.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <Typography sx={{ color: '#000', fontSize: 16 }}>No trash found.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              trashedItems.map((item) => (
                <TableRow key={`${item.id}-${item.type}`}>
                  <TableCell padding="checkbox" sx={{ pl: '20px' }}>
                    <Checkbox
                      checked={isItemSelected(item.id, item.type)}
                      onChange={() => handleSelectItem(item.id, item.type)}
                      {...CHECKBOX_ICONS}
                      sx={CHECKBOX_SX}
                      inputProps={{ 'aria-label': `Select ${item.name}` }}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {getTypeIcon(item.type)}
                      {item.type}
                    </Box>
                  </TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{formatDeletedAt(item.deletedAt)}</TableCell>
                  <TableCell align="right" sx={{ pr: '16px' }}>
                    <Button
                      onClick={() => setConfirm({ item })}
                      disableRipple
                      startIcon={<RecoverIcon />}
                      sx={{
                        color: '#00a63e',
                        textTransform: 'none',
                        fontWeight: 700,
                        fontSize: 16,
                        height: 42,
                        width: 150,
                        borderRadius: '12px',
                        minWidth: 0,
                        transition: 'all 0s ease',
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.05)', color: '#00a63e' },
                      }}
                    >
                      Recover
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#404040',
          color: '#f8f8f8',
          // 8px vertical padding around the 42px button = the reference's 58px bar.
          p: '8px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 1000,
        }}
      >
        <Typography variant="body2" sx={{ ml: 2 }}>
          {selectedItems.length} selected
        </Typography>
        <Button
          variant="contained"
          onClick={() => setConfirm({ bulk: true })}
          disabled={selectedItems.length === 0}
          disableElevation
          sx={{
            backgroundColor: '#00c950',
            color: '#f8f8f8',
            textTransform: 'none',
            fontWeight: 700,
            fontSize: 16,
            height: 42,
            width: 163,
            borderRadius: '12px',
            mr: 2,
            '&:hover': { backgroundColor: '#00a63e' },
            // Reference is explicit here (light-grey pill + not-allowed), so it beats the
            // parity-system dark-rail disabled token.
            '&.Mui-disabled': {
              backgroundColor: '#e5e5e5',
              color: '#737373',
              border: '1px solid #737373',
              pointerEvents: 'auto',
              cursor: 'not-allowed',
            },
          }}
        >
          Restore Item
        </Button>
      </Box>

      <ConfirmDeleteDialog
        open={Boolean(confirm)}
        title="Recover"
        message={
          confirm?.bulk
            ? `Are you sure you want to restore ${selectedItems.length} selected item(s)?`
            : 'Are you sure you want to restore this item?'
        }
        confirmText="Recover"
        loadingText="Restoring..."
        loading={loading}
        onCancel={() => setConfirm(null)}
        onConfirm={handleConfirm}
      />
    </Box>
  );
};

export default TrashedItems;
