import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Grid,
  Alert,
  Snackbar,
  CircularProgress,
  Popper,
  ClickAwayListener,
  Dialog,
  DialogContent,
  DialogActions,
  InputAdornment
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  VisibilityOutlined as ViewIcon,
  EditOutlined as EditIcon,
  DeleteOutline as DeleteIcon,
  ArrowDropDown as ArrowDropDownIcon,
  Close as CloseIcon,
  CheckBoxOutlineBlankOutlined as SquareIcon,
  CheckBoxOutlined as SquareCheckedIcon,
  CalendarTodayOutlined as CalendarIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday
} from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import promotionService from '../../services/promotionService';
import posLocalDb from '../../services/posLocalDb';
import usePageCache from '../../hooks/usePageCache';
import promotionCategoryService from '../../services/promotionCategoryService';
import customerGroupService from '../../services/customerGroupService';
import classificationService from '../../services/classificationService';
import productService from '../../services/productService';
import productComboService from '../../services/productComboService';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';

// Shopfront reference has no transitions and no ripple anywhere.
const INSTANT = 'all 0s ease';

const PRIMARY_BUTTON_SX = {
  bgcolor: '#5ebbeb',
  color: '#fff',
  textTransform: 'none',
  boxShadow: 'none',
  borderRadius: '12px',
  fontWeight: 700,
  fontSize: 16,
  letterSpacing: '0.4px',
  height: 42,
  // 35px sides puts the icon+label box at the reference's measured 207px.
  padding: '8px 35px',
  transition: INSTANT,
  // Measured on the reference (Tailwind `hover:bg-primary-hover`), overrides the #4aa9dd token.
  '&:hover': { bgcolor: '#0ea5e9', boxShadow: 'none' }
};

const rowActionSx = (color) => ({
  color,
  textTransform: 'none',
  fontWeight: 700,
  fontSize: 16,
  height: 42,
  borderRadius: '12px',
  minWidth: 0,
  px: 1.5,
  transition: INSTANT,
  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' }
});

const BULK_BUTTON_SX = {
  textTransform: 'none',
  fontWeight: 700,
  fontSize: 16,
  height: 42,
  borderRadius: '12px',
  px: 3,
  color: '#404040',
  borderColor: '#404040',
  transition: INSTANT,
  '&:hover': { borderColor: '#404040', bgcolor: 'rgba(0,0,0,0.05)' }
};

const FILTER_LABEL_SX = { mb: 0.5, fontWeight: 400, fontSize: 16, color: '#000' };

const EXPRESS_TYPES = ['Price Override', 'Discount Percentage', 'Discount Amount'];
const viewPath = (p) =>
  EXPRESS_TYPES.includes(p.promotionType)
    ? `/marketing/promotions/express/${p.id}/view`
    : `/marketing/promotions/${p.id}`;
const editPath = (p) =>
  EXPRESS_TYPES.includes(p.promotionType)
    ? `/marketing/promotions/express/${p.id}`
    : `/marketing/promotions/${p.id}/edit`;

// 'yyyy-MM-dd' -> local Date (avoids the UTC shift of new Date('2026-07-14'))
const parseYmd = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

// 28x32 square-glyph checkbox button (reference uses fa-square, not a native input)
const SquareCheckButton = ({ checked, onClick, light, label }) => (
  <Box
    component="button"
    type="button"
    aria-label={label}
    aria-pressed={checked}
    onClick={onClick}
    sx={{
      width: 28,
      height: 32,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      p: 0,
      border: 0,
      borderRadius: '4px',
      bgcolor: 'transparent',
      cursor: 'pointer',
      color: light ? '#fff' : '#000',
      transition: INSTANT,
      '&:hover': { bgcolor: 'rgba(0,0,0,0.1)' }
    }}
  >
    {checked ? <SquareCheckedIcon sx={{ fontSize: 20 }} /> : <SquareIcon sx={{ fontSize: 20 }} />}
  </Box>
);

const PANEL_MESSAGE_SX = {
  display: 'flex',
  alignItems: 'center',
  height: 56,
  p: 2,
  fontSize: 16,
  color: '#0a0a0a'
};

/**
 * Typeahead multi-select combobox matching the Shopfront reference:
 * type to filter, 'No Options' when nothing matches, selected options duplicated
 * and pinned above the full list behind a divider, instant open (no Grow),
 * sky-300 row hover, no panel shadow. `requireQuery` reproduces the reference's
 * async pickers, which list nothing until something is typed.
 */
const TypeaheadFilter = ({ value, onChange, options = [], requireQuery = false }) => {
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const anchorRef = useRef(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => (o.name || '').toLowerCase().includes(q)) : options;
  }, [options, query]);

  const selectedOptions = options.filter((o) => selected.includes(o.id));

  const toggle = (id) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    onChange({ target: { value: next } });
  };

  const optionRow = (o, key) => {
    const isSel = selected.includes(o.id);
    return (
      <Box
        key={key}
        component="button"
        type="button"
        onClick={() => toggle(o.id)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          width: '100%',
          height: 56,
          p: 2,
          border: 0,
          bgcolor: 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
          fontSize: 16,
          color: isSel ? '#0084d1' : '#0a0a0a',
          transition: INSTANT,
          '&:hover': { bgcolor: '#74d4ff' }
        }}
      >
        {isSel ? (
          <SquareCheckedIcon sx={{ fontSize: 20, color: '#0084d1' }} />
        ) : (
          <SquareIcon sx={{ fontSize: 20, color: '#0a0a0a' }} />
        )}
        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {o.name}
        </Box>
      </Box>
    );
  };

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box>
        <Box
          ref={anchorRef}
          onClick={() => setOpen(true)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            height: 42,
            border: '1px solid #404040',
            borderRadius: '8px',
            bgcolor: '#fff',
            pl: 1,
            pr: 0.5,
            cursor: 'text',
            overflow: 'hidden'
          }}
        >
          {/* Reference shows the value as plain text in the control, not as chips. */}
          {selectedOptions.length > 0 && (
            <Box
              component="span"
              sx={{
                flexShrink: 1,
                minWidth: 0,
                fontSize: 16,
                color: '#000',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {selectedOptions.map((o) => o.name).join(', ')}
            </Box>
          )}
          <Box
            component="input"
            type="text"
            value={query}
            placeholder={selected.length ? '' : 'Select...'}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            sx={{
              flex: 1,
              minWidth: 30,
              height: 40,
              border: 0,
              outline: 'none',
              bgcolor: 'transparent',
              fontFamily: 'inherit',
              fontSize: 16,
              color: '#000',
              '&::placeholder': { color: '#808080', opacity: 1 }
            }}
          />
          {selected.length > 0 && (
            <Box
              component="button"
              type="button"
              aria-label="Clear selection"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onChange({ target: { value: [] } });
              }}
              sx={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 25,
                height: 24,
                p: 0,
                border: 0,
                borderRadius: '8px',
                bgcolor: 'transparent',
                color: 'rgb(0,0,0)',
                cursor: 'pointer',
                transition: INSTANT,
                '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' }
              }}
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </Box>
          )}
          <ArrowDropDownIcon
            sx={{
              flexShrink: 0,
              color: '#404040',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 150ms cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          />
        </Box>

        <Popper
          open={open}
          anchorEl={anchorRef.current}
          placement="bottom-start"
          modifiers={[{ name: 'offset', options: { offset: [0, 10] } }]}
          style={{ zIndex: 1300 }}
        >
          <Box
            sx={{
              width: anchorRef.current ? anchorRef.current.offsetWidth : 'auto',
              bgcolor: '#fff',
              border: '1px solid #000000',
              borderRadius: '8px',
              maxHeight: 288,
              overflow: 'auto',
              transition: INSTANT
            }}
          >
            {requireQuery && !query.trim() ? (
              <Box sx={PANEL_MESSAGE_SX}>Keep Typing to Search...</Box>
            ) : filtered.length === 0 ? (
              <Box sx={PANEL_MESSAGE_SX}>No Options</Box>
            ) : (
              <>
                {selectedOptions.length > 0 && (
                  <>
                    {selectedOptions.map((o) => optionRow(o, `pinned-${o.id}`))}
                    <Box sx={{ height: '1px', bgcolor: '#e5e5e5' }} />
                  </>
                )}
                {filtered.map((o) => optionRow(o, o.id))}
              </>
            )}
          </Box>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};

const WEEKDAYS = [
  { key: 'mon', label: 'M', weekend: false },
  { key: 'tue', label: 'T', weekend: false },
  { key: 'wed', label: 'W', weekend: false },
  { key: 'thu', label: 'T', weekend: false },
  { key: 'fri', label: 'F', weekend: false },
  { key: 'sat', label: 'S', weekend: true },
  { key: 'sun', label: 'S', weekend: true }
];

const MonthGrid = ({ month, start, end, onPick, onTitleClick }) => {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
  });

  return (
    <Box sx={{ width: 286 }}>
      <Box
        component="button"
        type="button"
        onClick={onTitleClick}
        sx={{
          display: 'block',
          width: '100%',
          border: 0,
          bgcolor: 'transparent',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 18,
          fontWeight: 700,
          color: '#525252',
          mb: 1,
          transition: INSTANT,
          borderRadius: '12px',
          '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' }
        }}
      >
        {format(month, 'MMMM yyyy')}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 38px)', justifyContent: 'center' }}>
        {WEEKDAYS.map((d) => (
          <Box
            key={d.key}
            sx={{
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 400,
              color: d.weekend ? '#737373' : '#262626'
            }}
          >
            {d.label}
          </Box>
        ))}
        {days.map((day) => {
          const outside = !isSameMonth(day, month);
          const isStart = start && isSameDay(day, start);
          const isEnd = end && isSameDay(day, end);
          const inRange = start && end && day > start && day < end;
          const isEdge = isStart || isEnd;
          return (
            <Box
              key={day.toISOString()}
              component="button"
              type="button"
              onClick={() => onPick(day)}
              sx={{
                width: 38,
                height: 38,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 0,
                border: isToday(day) ? '1px solid #00a6f4' : '1px solid transparent',
                borderRadius: '12px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 16,
                transition: INSTANT,
                bgcolor: isEdge ? '#5ebbeb' : inRange ? 'rgba(94,187,235,0.2)' : 'transparent',
                color: isEdge ? '#f8f8f8' : outside ? '#a1a1a1' : '#0084d1',
                '&:hover': { bgcolor: isEdge ? '#5ebbeb' : 'rgba(0,0,0,0.05)' }
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

/**
 * Dual-month range picker. Trigger is one bordered box holding two borderless
 * DD/MM/YYYY buttons split by a minus icon; the panel opens instantly.
 */
const DateRangeFilter = ({ start, end, onChange }) => {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(startOfMonth(new Date()));
  const anchorRef = useRef(null);
  const startInputRef = useRef(null);

  const startDate = parseYmd(start);
  const endDate = parseYmd(end);

  const pick = (day) => {
    const ymd = format(day, 'yyyy-MM-dd');
    if (!start || (start && end)) {
      onChange(ymd, '');
    } else if (startDate && day < startDate) {
      onChange(ymd, '');
    } else {
      onChange(start, ymd);
    }
  };

  const currentDay = () => {
    const today = new Date();
    setViewMonth(startOfMonth(today));
    const ymd = format(today, 'yyyy-MM-dd');
    onChange(ymd, ymd);
  };

  // Native picker on the start field; the panel's own grid is the primary surface.
  const openNativePicker = () => {
    const el = startInputRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
        return;
      } catch {
        // Safari / cross-origin iframe: fall back to focus
      }
    }
    el.focus();
  };

  const dateInputSx = {
    width: 147,
    height: 36,
    bgcolor: '#fff',
    border: '1px solid #e5e5e5',
    borderRadius: '8px',
    px: 1,
    fontFamily: 'inherit',
    fontSize: 12,
    color: '#404040',
    outline: 'none'
  };

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box>
        <Box
          ref={anchorRef}
          aria-haspopup="dialog"
          sx={{
            display: 'flex',
            alignItems: 'center',
            height: 43,
            border: '1px solid #404040',
            borderRadius: '8px',
            bgcolor: '#fff',
            px: 1
          }}
        >
          <Box
            component="button"
            type="button"
            onClick={() => setOpen((o) => !o)}
            sx={{
              flex: 1,
              minWidth: 0,
              height: '100%',
              border: 0,
              bgcolor: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
              fontSize: 16,
              color: start ? '#000' : '#808080',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              transition: INSTANT
            }}
          >
            {startDate ? format(startDate, 'dd/MM/yyyy') : 'DD/MM/YYYY'}
          </Box>
          <RemoveIcon sx={{ color: '#737373', fontSize: 18, mx: 0.5, flexShrink: 0 }} />
          <Box
            component="button"
            type="button"
            onClick={() => setOpen((o) => !o)}
            sx={{
              flex: 1,
              minWidth: 0,
              height: '100%',
              border: 0,
              bgcolor: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
              fontSize: 16,
              color: end ? '#000' : '#808080',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              transition: INSTANT
            }}
          >
            {endDate ? format(endDate, 'dd/MM/yyyy') : 'DD/MM/YYYY'}
          </Box>
        </Box>

        <Popper
          open={open}
          anchorEl={anchorRef.current}
          placement="bottom-start"
          modifiers={[{ name: 'offset', options: { offset: [0, 10] } }]}
          style={{ zIndex: 1300 }}
        >
          <Box
            sx={{
              width: 622,
              bgcolor: '#f5f5f5',
              border: '1px solid #e5e5e5',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
              p: 2,
              transition: INSTANT
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Box
                component="input"
                type="date"
                ref={startInputRef}
                value={start || ''}
                onChange={(e) => onChange(e.target.value, end)}
                sx={dateInputSx}
              />
              <Typography sx={{ color: '#525252', fontSize: 14 }}>—</Typography>
              <Box
                component="input"
                type="date"
                value={end || ''}
                onChange={(e) => onChange(start, e.target.value)}
                sx={dateInputSx}
              />
              <Box
                component="button"
                type="button"
                aria-label="Open date picker"
                onClick={openNativePicker}
                sx={{
                  width: 38,
                  height: 42,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 0,
                  borderRadius: '12px',
                  bgcolor: 'transparent',
                  color: '#0084d1',
                  cursor: 'pointer',
                  transition: INSTANT,
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' }
                }}
              >
                <CalendarIcon sx={{ fontSize: 18 }} />
              </Box>
              <Box sx={{ flex: 1 }} />
              <Box
                component="button"
                type="button"
                onClick={currentDay}
                sx={{
                  width: 107,
                  height: 42,
                  border: 0,
                  borderRadius: '12px',
                  bgcolor: 'transparent',
                  color: '#525252',
                  fontFamily: 'inherit',
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: INSTANT,
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' }
                }}
              >
                Current Day
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Box
                component="button"
                type="button"
                aria-label="Previous month"
                onClick={() => setViewMonth((m) => subMonths(m, 1))}
                sx={{
                  width: 38,
                  height: 38,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 0,
                  borderRadius: '12px',
                  bgcolor: 'transparent',
                  color: '#0084d1',
                  cursor: 'pointer',
                  transition: INSTANT,
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' }
                }}
              >
                <ChevronLeftIcon />
              </Box>
              <MonthGrid
                month={viewMonth}
                start={startDate}
                end={endDate}
                onPick={pick}
                onTitleClick={() => setViewMonth(startOfMonth(new Date()))}
              />
              <MonthGrid
                month={addMonths(viewMonth, 1)}
                start={startDate}
                end={endDate}
                onPick={pick}
                onTitleClick={() => setViewMonth(startOfMonth(new Date()))}
              />
              <Box
                component="button"
                type="button"
                aria-label="Next month"
                onClick={() => setViewMonth((m) => addMonths(m, 1))}
                sx={{
                  width: 38,
                  height: 38,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 0,
                  borderRadius: '12px',
                  bgcolor: 'transparent',
                  color: '#0084d1',
                  cursor: 'pointer',
                  transition: INSTANT,
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' }
                }}
              >
                <ChevronRightIcon />
              </Box>
            </Box>
          </Box>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};

const Promotions = () => {
  const navigate = useNavigate();
  const { getOutletId } = useAuth();
  // Every list on this page renders from IndexedDB first and revalidates in the
  // background; search / active filtering happens locally in filteredPromotions.
  const {
    data: promotions,
    loading,
    refresh: fetchPromotions,
    mutate: mutatePromotions,
  } = usePageCache(
    'promotions',
    () =>
      promotionService
        .getPromotions({ page: 1, limit: 1000, outletId: getOutletId() })
        .then((r) => (Array.isArray(r.promotions) ? r.promotions : [])),
    { deps: [getOutletId()] }
  );
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState([]);
  const [customerGroupFilter, setCustomerGroupFilter] = useState([]);
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [productFilter, setProductFilter] = useState([]);
  const [brandFilter, setBrandFilter] = useState([]);
  const [categoryStockFilter, setCategoryStockFilter] = useState([]);
  const [familyFilter, setFamilyFilter] = useState([]);
  const [tagFilter, setTagFilter] = useState([]);
  // 'all' is the documented bypass for the apiClient outlet auto-filter. Without
  // it a super admin pinned to outlet A gets the categories of outlet A only —
  // global (outletId null) and other-outlet categories drop out and the filter
  // reads "No Options". Outlet users are unaffected: the API always scopes them
  // to their own outlet plus global ones regardless of this argument.
  const { data: categories } = usePageCache('promotionCategories', () =>
    promotionCategoryService
      .getPromotionCategories('all')
      .then((r) => (Array.isArray(r) ? r : r?.promotionCategories || []))
  );
  const { data: customerGroups } = usePageCache('customerGroups', () =>
    customerGroupService
      .getCustomerGroups(getOutletId())
      .then((r) => (Array.isArray(r) ? r : r?.customerGroups || []))
  );
  const { data: combos } = usePageCache('combos', () =>
    productComboService
      .getProductCombos({ limit: 1000 })
      .then((r) => (Array.isArray(r?.combos) ? r.combos : []))
  );
  const { data: classifications } = usePageCache('classifications', () =>
    classificationService.getClassifications().then((r) => r?.classifications || [])
  );
  const byType = (type) => classifications.filter((c) => c.type === type);
  const brands = byType('Brand');
  const categoriesStock = byType('Category');
  const families = byType('Family');
  const tags = byType('Tag');
  const [products, setProducts] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [promotionToDelete, setPromotionToDelete] = useState(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkInactiveOpen, setBulkInactiveOpen] = useState(false);
  const [bulkDatesOpen, setBulkDatesOpen] = useState(false);
  const [bulkStart, setBulkStart] = useState('');
  const [bulkEnd, setBulkEnd] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const showSnackbar = (message, severity) => setSnackbar({ open: true, message, severity });

  // Debounce the search box (reference does not refetch on every keystroke).
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // The product picker reads the catalog already synced to IndexedDB; the API is
  // only a fallback for a cold cache.
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        await posLocalDb.init();
        const cached = await posLocalDb.getStoreAll('products');
        if (cached.length > 0) {
          setProducts(cached);
          return;
        }
        const response = await productService.getProducts({ outletId: getOutletId(), limit: 1000 });
        setProducts(Array.isArray(response.products) ? response.products : []);
      } catch (error) {
        console.error('Error fetching products:', error);
        setProducts([]);
      }
    };

    fetchProducts();
  }, [getOutletId]);

  const productOptions = useMemo(
    () =>
      [...products, ...combos.map((c) => ({ id: `combo:${c.id}`, name: c.name }))].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '')
      ),
    [products, combos]
  );

  // A promotion item can only point at a product, so a selected combo matches any
  // promotion that contains one of the combo's member products.
  const comboProductIds = useMemo(() => {
    const map = new Map();
    combos.forEach((c) =>
      map.set(
        `combo:${c.id}`,
        (Array.isArray(c.items) ? c.items : []).map((i) => i.productId).filter((id) => id != null)
      )
    );
    return map;
  }, [combos]);

  // productId -> tag ids (tags are the one attribute the promotions payload does not embed)
  const productTags = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      map.set(
        p.id,
        (Array.isArray(p.tags) ? p.tags : []).map((t) => t.tagId ?? t.tag?.id).filter((id) => id != null)
      );
    });
    return map;
  }, [products]);

  const filteredPromotions = useMemo(() => {
    const active = (arr) => Array.isArray(arr) && arr.length > 0;
    const from = parseYmd(dateRangeStart);
    const to = parseYmd(dateRangeEnd);
    const fromMs = from ? from.setHours(0, 0, 0, 0) : null;
    const toMs = to ? to.setHours(23, 59, 59, 999) : null;

    const q = searchTerm.trim().toLowerCase();

    return promotions.filter((p) => {
      // Search + active state used to be server-side query params; they filter
      // locally now so no keystroke or toggle costs a round trip.
      if (!showInactive && p.isActive === false) return false;
      if (q && !(p.name || '').toLowerCase().includes(q)) return false;
      if (active(categoryFilter) && !categoryFilter.includes(p.categoryId)) return false;

      const items = Array.isArray(p.items) ? p.items : [];
      if (active(productFilter)) {
        const wanted = new Set();
        productFilter.forEach((id) => {
          const members = comboProductIds.get(id);
          if (members) members.forEach((m) => wanted.add(m));
          else wanted.add(id);
        });
        if (!items.some((i) => wanted.has(i.productId))) return false;
      }
      if (active(brandFilter) && !items.some((i) => brandFilter.includes(i.product?.brandId))) return false;
      if (active(categoryStockFilter) && !items.some((i) => categoryStockFilter.includes(i.product?.categoryId))) return false;
      if (active(familyFilter) && !items.some((i) => familyFilter.includes(i.product?.familyId))) return false;
      if (
        active(tagFilter) &&
        !items.some((i) => (productTags.get(i.productId) || []).some((t) => tagFilter.includes(t)))
      ) {
        return false;
      }

      if (active(customerGroupFilter)) {
        const groupIds = [
          ...(Array.isArray(p.customerGroups) ? p.customerGroups.map((g) => g.customerGroupId) : []),
          ...(Array.isArray(p.customerGroupIds) ? p.customerGroupIds : [])
        ];
        if (!groupIds.some((g) => customerGroupFilter.includes(g))) return false;
      }

      // Date range: keep promotions whose window overlaps the selected window
      // (a null promotion start/end is open-ended).
      if (fromMs || toMs) {
        const ps = p.startDate ? new Date(p.startDate).getTime() : null;
        const pe = p.endDate ? new Date(p.endDate).getTime() : null;
        if (toMs && ps && ps > toMs) return false;
        if (fromMs && pe && pe < fromMs) return false;
      }

      return true;
    });
  }, [
    promotions,
    searchTerm,
    showInactive,
    categoryFilter,
    productFilter,
    brandFilter,
    categoryStockFilter,
    familyFilter,
    tagFilter,
    customerGroupFilter,
    dateRangeStart,
    dateRangeEnd,
    productTags,
    comboProductIds
  ]);

  const allSelected = filteredPromotions.length > 0 && selectedIds.length === filteredPromotions.length;
  const toggleAll = () => setSelectedIds(allSelected ? [] : filteredPromotions.map((p) => p.id));
  const toggleOne = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const runBulk = async (action, successMessage, failureMessage) => {
    try {
      await Promise.all(selectedIds.map(action));
      showSnackbar(successMessage, 'success');
    } catch (error) {
      console.error(failureMessage, error);
      showSnackbar(failureMessage, 'error');
    } finally {
      // Always resync: a partial failure still changed some rows.
      await fetchPromotions();
    }
  };

  const confirmDelete = async () => {
    if (!promotionToDelete || !promotionToDelete.id) {
      showSnackbar('No promotion selected for deletion', 'error');
      setDeleteDialogOpen(false);
      setPromotionToDelete(null);
      return;
    }
    try {
      await promotionService.deletePromotion(promotionToDelete.id);
      showSnackbar('Promotion deleted successfully', 'success');
      // Drop the row from the cached list right away: the refetch alone left the
      // deleted row on screen until a reload.
      mutatePromotions((prev) => prev.filter((p) => p.id !== promotionToDelete.id));
      fetchPromotions();
    } catch (error) {
      console.error('Error deleting promotion:', error);
      showSnackbar('Failed to delete promotion', 'error');
    } finally {
      setDeleteDialogOpen(false);
      setPromotionToDelete(null);
    }
  };

  const confirmBulkDelete = async () => {
    setBulkDeleteOpen(false);
    const ids = selectedIds;
    mutatePromotions((prev) => prev.filter((p) => !ids.includes(p.id)));
    await runBulk(
      (id) => promotionService.deletePromotion(id),
      'Promotions deleted successfully',
      'Failed to delete promotions'
    );
  };

  const confirmBulkInactive = async () => {
    setBulkInactiveOpen(false);
    await runBulk(
      (id) => promotionService.togglePromotionStatus(id, false),
      'Promotions set to inactive',
      'Failed to update promotions'
    );
  };

  const confirmBulkDates = async () => {
    setBulkDatesOpen(false);
    // Only send the fields that were filled in — an empty box must not wipe an existing date.
    const payload = {};
    if (bulkStart) payload.startDate = bulkStart;
    if (bulkEnd) payload.endDate = bulkEnd;
    if (Object.keys(payload).length === 0) return;

    await runBulk(
      (id) => promotionService.updatePromotion(id, payload),
      'Promotion dates updated',
      'Failed to update promotion dates'
    );
    setBulkStart('');
    setBulkEnd('');
  };

  const formatDate = (dateString) => (dateString ? format(new Date(dateString), 'dd/MM/yyyy') : '');

  const bulkDateInputSx = {
    width: '100%',
    height: 42,
    border: '1px solid #404040',
    borderRadius: '8px',
    px: 1.5,
    fontFamily: 'inherit',
    fontSize: 16,
    color: '#000',
    bgcolor: '#fff',
    outline: 'none'
  };

  return (
    <Box sx={{ p: 3, pb: selectedIds.length > 0 ? 12 : 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h4" component="h1" fontWeight="bold">
            Promotions
          </Typography>
          <Button
            variant="contained"
            disableRipple
            disableElevation
            startIcon={<AddIcon />}
            onClick={() => navigate('/marketing/promotions/create')}
            sx={PRIMARY_BUTTON_SX}
          >
            Add Promotion
          </Button>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="h4" fontWeight="bold" lineHeight={1}>
            {loading ? 0 : filteredPromotions.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Results
          </Typography>
        </Box>
      </Box>

      {/* Filters sit flat on the page — the reference has no card around them */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" sx={FILTER_LABEL_SX}>
          Search
        </Typography>
        <TextField
          fullWidth
          autoFocus
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          InputProps={{
            endAdornment: loading ? (
              <InputAdornment position="end">
                <CircularProgress size={18} sx={{ color: '#737373' }} />
              </InputAdornment>
            ) : null
          }}
          sx={{
            mb: 2.5,
            backgroundColor: 'white',
            '& .MuiOutlinedInput-root': {
              height: 42,
              borderRadius: 2,
              fontSize: 16,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' }
            },
            '& .MuiOutlinedInput-input': { padding: '9px 16px' }
          }}
        />

        <Grid container spacing={2} alignItems="flex-start">
          <Grid item xs={12} md={2.4}>
            <Typography variant="body2" sx={FILTER_LABEL_SX}>
              Show Inactive
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', height: 42 }}>
              <ShopfrontSwitch
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                sx={{
                  mr: 1.5,
                  // The reference switch flips instantly and turns the cyan primary when on.
                  '& .MuiSwitch-switchBase': {
                    margin: '2.4px',
                    transitionDuration: '0s',
                    '&.Mui-focusVisible .MuiSwitch-thumb': { outline: '2px solid #38bdf8', outlineOffset: '2px' },
                    '&.Mui-checked + .MuiSwitch-track': { backgroundColor: '#5ebbeb' }
                  },
                  '& .MuiSwitch-thumb': { width: 19, height: 19, transition: INSTANT },
                  '& .MuiSwitch-track': { borderRadius: '24px', transition: INSTANT },
                  '&:hover .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#5ebbeb' }
                }}
              />
              <Typography sx={{ fontSize: 14, color: '#404040' }}>
                {showInactive ? 'Showing inactive promotions' : 'Inactive promotions are hidden'}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={2.4}>
            <Typography variant="body2" sx={FILTER_LABEL_SX}>
              Promotion Categories
            </Typography>
            <TypeaheadFilter value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} options={categories} />
          </Grid>
          <Grid item xs={12} md={2.4}>
            <Typography variant="body2" sx={FILTER_LABEL_SX}>
              Products
            </Typography>
            <TypeaheadFilter
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              options={productOptions}
              requireQuery
            />
          </Grid>
          <Grid item xs={12} md={2.4}>
            <Typography variant="body2" sx={FILTER_LABEL_SX}>
              Brands
            </Typography>
            <TypeaheadFilter value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} options={brands} />
          </Grid>
          <Grid item xs={12} md={2.4}>
            <Typography variant="body2" sx={FILTER_LABEL_SX}>
              Categories
            </Typography>
            <TypeaheadFilter
              value={categoryStockFilter}
              onChange={(e) => setCategoryStockFilter(e.target.value)}
              options={categoriesStock}
            />
          </Grid>
        </Grid>

        {showMoreFilters && (
          <Grid container spacing={2} alignItems="flex-start" sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={2.4}>
              <Typography variant="body2" sx={FILTER_LABEL_SX}>
                Families
              </Typography>
              <TypeaheadFilter value={familyFilter} onChange={(e) => setFamilyFilter(e.target.value)} options={families} />
            </Grid>
            <Grid item xs={12} md={2.4}>
              <Typography variant="body2" sx={FILTER_LABEL_SX}>
                Tags
              </Typography>
              <TypeaheadFilter value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} options={tags} />
            </Grid>
            <Grid item xs={12} md={2.4}>
              <Typography variant="body2" sx={FILTER_LABEL_SX}>
                Promotion Range
              </Typography>
              <DateRangeFilter
                start={dateRangeStart}
                end={dateRangeEnd}
                onChange={(s, e) => {
                  setDateRangeStart(s || '');
                  setDateRangeEnd(e || '');
                }}
              />
            </Grid>
            <Grid item xs={12} md={2.4}>
              <Typography variant="body2" sx={FILTER_LABEL_SX}>
                Customer Groups
              </Typography>
              <TypeaheadFilter
                value={customerGroupFilter}
                onChange={(e) => setCustomerGroupFilter(e.target.value)}
                options={customerGroups}
              />
            </Grid>
          </Grid>
        )}

        <Button
          variant="contained"
          disableRipple
          disableElevation
          startIcon={showMoreFilters ? <RemoveIcon /> : <AddIcon />}
          onClick={() => setShowMoreFilters((prev) => !prev)}
          sx={{ ...PRIMARY_BUTTON_SX, mt: 2.5, width: 256 }}
        >
          {showMoreFilters ? 'Less Filters' : 'More Filters'}
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, py: 10 }}>
          <CircularProgress size={22} sx={{ color: '#737373' }} />
          <Typography sx={{ fontSize: 16, color: '#737373' }}>Loading results...</Typography>
        </Box>
      ) : (
        <TableContainer sx={{ mt: 1 }}>
          <Table sx={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow
                sx={{
                  '& th': { bgcolor: '#5ebbeb', color: 'white', fontWeight: 700, fontSize: 16, border: 0, height: 51, py: 0 },
                  // rounded-t-xl: only the top corners are rounded, the bottom edge is
                  // square against the first row.
                  '& th:first-of-type': { borderTopLeftRadius: '12px' },
                  '& th:last-of-type': { borderTopRightRadius: '12px' }
                }}
              >
                <TableCell padding="checkbox" sx={{ pl: '20px', width: '3.2%' }}>
                  <SquareCheckButton checked={allSelected} onClick={toggleAll} light label="Select all promotions" />
                </TableCell>
                <TableCell sx={{ width: '20%' }}>Promotion</TableCell>
                <TableCell sx={{ width: '26.8%' }}>Start</TableCell>
                <TableCell sx={{ width: '26.8%' }}>End</TableCell>
                <TableCell sx={{ pr: '20px', width: '23.2%' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody
              sx={{
                '& tr:nth-of-type(odd)': { bgcolor: '#ffffff' },
                '& tr:nth-of-type(even)': { bgcolor: '#f5f5f5' },
                '& td': { border: 0, fontSize: 16, color: '#000', py: 1.5 }
              }}
            >
              {filteredPromotions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No promotions found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPromotions.map((promotion) => (
                  <TableRow key={promotion.id}>
                    <TableCell padding="checkbox" sx={{ pl: '20px' }}>
                      <SquareCheckButton
                        checked={selectedIds.includes(promotion.id)}
                        onClick={() => toggleOne(promotion.id)}
                        label={`Select ${promotion.name || 'promotion'}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Box
                        component="a"
                        href={viewPath(promotion)}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(viewPath(promotion));
                        }}
                        sx={{ display: 'block', fontSize: 16, color: '#000', textDecoration: 'none' }}
                      >
                        {/* Fallback for legacy rows saved before POST required a name —
                            an empty anchor is invisible and unclickable-looking. */}
                        {promotion.name || 'Untitled Promotion'}
                        {promotion.isActive === false && (
                          <Box component="span" sx={{ color: '#737373' }}>
                            {' - Inactive'}
                          </Box>
                        )}
                      </Box>
                      <Typography sx={{ fontSize: 16, color: '#000' }}>
                        {promotion.category?.name || 'No Category'}
                      </Typography>
                    </TableCell>
                    <TableCell>{formatDate(promotion.startDate)}</TableCell>
                    <TableCell>{formatDate(promotion.endDate)}</TableCell>
                    <TableCell align="right" sx={{ pr: '20px' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                        <Button
                          disableRipple
                          startIcon={<ViewIcon />}
                          onClick={() => navigate(viewPath(promotion))}
                          sx={rowActionSx('#0084d1')}
                        >
                          View
                        </Button>
                        <Button
                          disableRipple
                          startIcon={<EditIcon />}
                          onClick={() => navigate(editPath(promotion))}
                          sx={rowActionSx('#00a63e')}
                        >
                          Edit
                        </Button>
                        <Button
                          disableRipple
                          startIcon={<DeleteIcon />}
                          onClick={() => {
                            setPromotionToDelete(promotion);
                            setDeleteDialogOpen(true);
                          }}
                          sx={rowActionSx('#e7000b')}
                        >
                          Delete
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Bulk-action bar: ticking rows reveals the options at the bottom of the screen */}
      {selectedIds.length > 0 && (
        <Box
          sx={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            px: 3,
            py: 1.5,
            bgcolor: '#fff',
            borderTop: '1px solid #e5e5e5',
            boxShadow: '0 -2px 8px rgba(0,0,0,0.1)'
          }}
        >
          <Button disableRipple startIcon={<DeleteIcon />} onClick={() => setBulkDeleteOpen(true)} sx={rowActionSx('#e7000b')}>
            Delete
          </Button>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography sx={{ fontSize: 14, color: '#676b72' }}>{selectedIds.length} selected</Typography>
            <Button variant="outlined" disableRipple onClick={() => setBulkInactiveOpen(true)} sx={BULK_BUTTON_SX}>
              Make Inactive
            </Button>
            <Button variant="outlined" disableRipple onClick={() => setBulkDatesOpen(true)} sx={BULK_BUTTON_SX}>
              Change Dates
            </Button>
          </Box>
        </Box>
      )}

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        title="Delete Promotion"
        message={`Are you sure you want to delete ${promotionToDelete?.name || 'this promotion'}?`}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setPromotionToDelete(null);
        }}
        onConfirm={confirmDelete}
      />

      <ConfirmDeleteDialog
        open={bulkDeleteOpen}
        title="Delete Promotions"
        message={`Are you sure you want to delete ${selectedIds.length} promotion${selectedIds.length === 1 ? '' : 's'}?`}
        confirmText="Continue"
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={confirmBulkDelete}
      />

      <ConfirmDeleteDialog
        open={bulkInactiveOpen}
        title="Make Inactive"
        message={`Are you sure you want to make ${selectedIds.length} promotion${selectedIds.length === 1 ? '' : 's'} inactive?`}
        confirmText="Continue"
        onCancel={() => setBulkInactiveOpen(false)}
        onConfirm={confirmBulkInactive}
      />

      <Dialog
        open={bulkDatesOpen}
        onClose={() => setBulkDatesOpen(false)}
        PaperProps={{ sx: { borderRadius: '8px', width: 440, maxWidth: '92vw' } }}
      >
        <Box sx={{ px: 3, pt: 2.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 18, color: '#313439' }}>Bulk Change Date</Typography>
        </Box>
        <DialogContent sx={{ px: 3, py: 2.5 }}>
          <Typography variant="body2" sx={FILTER_LABEL_SX}>
            Start Date
          </Typography>
          <Box
            component="input"
            type="date"
            value={bulkStart}
            onChange={(e) => setBulkStart(e.target.value)}
            sx={{ ...bulkDateInputSx, mb: 2 }}
          />
          <Typography variant="body2" sx={FILTER_LABEL_SX}>
            End Date
          </Typography>
          <Box component="input" type="date" value={bulkEnd} onChange={(e) => setBulkEnd(e.target.value)} sx={bulkDateInputSx} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 0, gap: 1.25 }}>
          <Button
            disableRipple
            disableElevation
            onClick={() => setBulkDatesOpen(false)}
            sx={{
              bgcolor: '#8a8d91',
              color: '#fff',
              textTransform: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              px: 3,
              '&:hover': { bgcolor: '#76797d' }
            }}
          >
            Cancel
          </Button>
          <Button
            disableRipple
            disableElevation
            onClick={confirmBulkDates}
            sx={{
              bgcolor: '#5ebbeb',
              color: '#fff',
              textTransform: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              px: 3,
              '&:hover': { bgcolor: '#0ea5e9' }
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Promotions;
