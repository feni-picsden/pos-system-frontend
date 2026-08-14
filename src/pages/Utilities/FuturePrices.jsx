import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  TablePagination,
  TableSortLabel,
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
  Popper,
  ClickAwayListener,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  DeleteOutline as DeleteIcon,
  CheckCircleOutline as CheckCircleIcon,
  SearchOutlined as SearchIcon,
  CalendarTodayOutlined as CalendarIcon,
  AccessTimeOutlined as ClockIcon,
  HelpOutline as HelpIcon,
  ChevronLeftOutlined as ChevronLeftIcon,
  ChevronRightOutlined as ChevronRightIcon,
  AddOutlined as AddIcon,
  BlockOutlined as BlockIcon,
  PriorityHighOutlined as PriorityHighIcon,
  QuestionMarkOutlined as QuestionMarkIcon,
} from '@mui/icons-material';
import {
  format,
  parse,
  isValid,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { useAuth } from '../../contexts/AuthContext';
import productService from '../../services/productService';
import futurePriceService from '../../services/futurePriceService';
import classificationService from '../../services/classificationService';

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

// Schedule-dialog inputs: 1px #404040 border, 8px radius, #d4d4d4 fill when disabled.
const DIALOG_INPUT_SX = {
  borderRadius: '8px',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
  '&.Mui-disabled': { bgcolor: '#d4d4d4' },
  '&.Mui-disabled .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
};

const DT_FORMAT = 'dd/MM/yyyy HH:mm:ss';
const DT_MASK = 'DD/MM/YYYY HH:mm:ss';
const ACCEPTED_FORMATS = [DT_FORMAT, 'dd/MM/yyyy HH:mm', 'dd/MM/yyyy'];

// Accepts a fully or partially timed DD/MM/YYYY string; null when unparseable.
const parseDateTimeText = (text) => {
  const t = (text || '').trim();
  if (!t) return null;
  for (const f of ACCEPTED_FORMATS) {
    const d = parse(t, f, new Date());
    // Reject part-typed years (01/01/2 -> year 2) so auto-applying filters never
    // fires a fetch against a half-entered date.
    if (isValid(d) && d.getFullYear() >= 1000) return d;
  }
  return null;
};

const WEEKDAYS = [
  { key: 'mon', label: 'M', weekend: false },
  { key: 'tue', label: 'T', weekend: false },
  { key: 'wed', label: 'W', weekend: false },
  { key: 'thu', label: 'T', weekend: false },
  { key: 'fri', label: 'F', weekend: false },
  { key: 'sat', label: 'S', weekend: true },
  { key: 'sun', label: 'S', weekend: true },
];

const MonthGrid = ({ month, selected, onPick, onTitleClick }) => {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
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
          borderRadius: '12px',
          transition: INSTANT,
          '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
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
              color: d.weekend ? '#737373' : '#262626',
            }}
          >
            {d.label}
          </Box>
        ))}
        {days.map((day) => {
          const outside = !isSameMonth(day, month);
          const isSelected = selected && isSameDay(day, selected);
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
                bgcolor: isSelected ? '#5ebbeb' : 'transparent',
                color: isSelected ? '#f8f8f8' : outside ? '#a1a1a1' : '#0084d1',
                '&:hover': { bgcolor: isSelected ? '#5ebbeb' : 'rgba(0,0,0,0.05)' },
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

const timeInputSx = {
  width: 64,
  height: 36,
  bgcolor: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: '8px',
  px: 1,
  fontFamily: 'inherit',
  fontSize: 14,
  color: '#404040',
  outline: 'none',
};

/**
 * Reference filter date field: a bare text input (placeholder swaps to the
 * DD/MM/YYYY HH:mm:ss mask on focus) that opens a dual-month calendar popover
 * with calendar/clock tabs and a Current Day shortcut. Typing commits directly.
 */
const DateTimeFilterField = ({ value, onChange, placeholder }) => {
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('calendar');
  const [viewMonth, setViewMonth] = useState(startOfMonth(value || new Date()));
  // ponytail: the popover's masked strip keeps its own text and commits on
  // blur/Enter only — committing per keystroke would round-trip through value
  // and clobber the entry mid-type (same trap the main input avoids below).
  const [stripText, setStripText] = useState('');
  const anchorRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setStripText(value ? format(value, DT_FORMAT) : '');
  }, [value]);

  const commitStrip = () => {
    if (stripText.trim() === '') {
      onChange(null);
      return;
    }
    const parsed = parseDateTimeText(stripText);
    if (parsed) {
      onChange(parsed);
      setViewMonth(startOfMonth(parsed));
    }
  };

  // ponytail: the text lives in the DOM, not in state. A controlled input here
  // is what broke typing — React restores the DOM value from props on every
  // input event that does not move the committed value, so partial entries
  // ("01/01/20…") were wiped keystroke by keystroke. Uncontrolled + imperative
  // re-sync keeps partial text alive and still lets the picker write the field.
  const writeText = useCallback((t) => {
    if (inputRef.current) inputRef.current.value = t;
    setInvalid(t.trim() !== '' && !parseDateTimeText(t));
  }, []);

  // Re-sync only when the committed value diverges from what is typed, so that
  // typing is never clobbered mid-entry.
  useEffect(() => {
    const current = inputRef.current ? inputRef.current.value : '';
    const parsed = parseDateTimeText(current);
    if (value && parsed && parsed.getTime() === value.getTime()) return;
    if (!value && !parsed) return;
    writeText(value ? format(value, DT_FORMAT) : '');
  }, [value, writeText]);

  const handleText = (e) => {
    const next = e.target.value;
    setInvalid(next.trim() !== '' && !parseDateTimeText(next));
    if (next.trim() === '') {
      onChange(null);
      return;
    }
    const parsed = parseDateTimeText(next);
    if (parsed) onChange(parsed);
  };

  const pick = (day) => {
    const base = value || new Date(new Date().setHours(0, 0, 0, 0));
    const next = new Date(day);
    next.setHours(base.getHours(), base.getMinutes(), base.getSeconds(), 0);
    onChange(next);
    setViewMonth(startOfMonth(next));
  };

  const setTimePart = (part, raw) => {
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    const next = new Date(value || new Date(new Date().setHours(0, 0, 0, 0)));
    if (part === 'h') next.setHours(Math.min(23, Math.max(0, n)));
    if (part === 'm') next.setMinutes(Math.min(59, Math.max(0, n)));
    if (part === 's') next.setSeconds(Math.min(59, Math.max(0, n)));
    onChange(next);
  };

  const currentDay = () => {
    const today = new Date();
    setViewMonth(startOfMonth(today));
    onChange(today);
  };

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box
          ref={anchorRef}
          sx={{
            display: 'flex',
            alignItems: 'center',
            height: 42,
            border: `1px solid ${invalid ? '#e33430' : '#404040'}`,
            borderRadius: '8px',
            bgcolor: '#fff',
            px: 1,
          }}
        >
          <Box
            component="input"
            ref={inputRef}
            defaultValue={value ? format(value, DT_FORMAT) : ''}
            onChange={handleText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onClick={() => setOpen(true)}
            placeholder={focused || open ? DT_MASK : placeholder}
            sx={{
              flex: 1,
              minWidth: 0,
              height: '100%',
              border: 0,
              outline: 'none',
              bgcolor: 'transparent',
              fontFamily: 'inherit',
              fontSize: 16,
              color: '#000',
              '&::placeholder': { color: '#808080', opacity: 1 },
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
              width: 622,
              bgcolor: '#f5f5f5',
              border: '1px solid #e5e5e5',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
              p: 2,
              transition: INSTANT,
            }}
          >
            {/* Reference shows a masked segment input strip at the top of the popover. */}
            <Box
              component="input"
              value={stripText}
              onChange={(e) => setStripText(e.target.value)}
              onBlur={commitStrip}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitStrip();
              }}
              placeholder="dd/mm/yyyy hh:mm:ss"
              aria-label="Date and time"
              sx={{
                width: '100%',
                height: 38,
                border: '1px solid #e5e5e5',
                borderRadius: '8px',
                px: 1.5,
                mb: 2,
                bgcolor: '#fff',
                fontFamily: 'inherit',
                fontSize: 16,
                color: '#404040',
                outline: 'none',
                '&::placeholder': { color: '#808080', opacity: 1 },
              }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              {[
                { key: 'calendar', icon: <CalendarIcon sx={{ fontSize: 18 }} />, label: 'Calendar' },
                { key: 'clock', icon: <ClockIcon sx={{ fontSize: 18 }} />, label: 'Time' },
              ].map(({ key, icon, label }) => (
                <Box
                  key={key}
                  component="button"
                  type="button"
                  aria-label={label}
                  aria-pressed={tab === key}
                  onClick={() => setTab(key)}
                  sx={{
                    width: 38,
                    height: 38,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 0,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: INSTANT,
                    bgcolor: tab === key ? '#5ebbeb' : 'transparent',
                    color: tab === key ? '#f8f8f8' : '#0084d1',
                    '&:hover': { bgcolor: tab === key ? '#5ebbeb' : 'rgba(0,0,0,0.05)' },
                  }}
                >
                  {icon}
                </Box>
              ))}
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
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
                }}
              >
                Current Day
              </Box>
            </Box>

            {tab === 'calendar' ? (
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
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
                  }}
                >
                  <ChevronLeftIcon />
                </Box>
                <MonthGrid
                  month={viewMonth}
                  selected={value}
                  onPick={pick}
                  onTitleClick={() => setViewMonth(startOfMonth(new Date()))}
                />
                <MonthGrid
                  month={addMonths(viewMonth, 1)}
                  selected={value}
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
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
                  }}
                >
                  <ChevronRightIcon />
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {[
                  { part: 'h', label: 'Hours', v: value ? value.getHours() : 0, max: 23 },
                  { part: 'm', label: 'Minutes', v: value ? value.getMinutes() : 0, max: 59 },
                  { part: 's', label: 'Seconds', v: value ? value.getSeconds() : 0, max: 59 },
                ].map(({ part, label, v, max }) => (
                  <Box key={part}>
                    <Typography sx={{ fontSize: 12, color: '#525252', mb: 0.5 }}>{label}</Typography>
                    <Box
                      component="input"
                      type="number"
                      min={0}
                      max={max}
                      aria-label={label}
                      value={String(v)}
                      onChange={(e) => setTimePart(part, e.target.value)}
                      sx={timeInputSx}
                    />
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};

const COLUMNS = [
  { id: 'itemName', label: 'Item' },
  { id: 'priceSet', label: 'Price Set' },
  { id: 'createdBy', label: 'Created By' },
  { id: 'quantity', label: 'Quantity', numeric: true },
  { id: 'currentPrice', label: 'Current Price', numeric: true },
  { id: 'price', label: 'Price', numeric: true },
  { id: 'effectiveAt', label: 'Effective At', date: true },
];

// The price this future price will replace: same quantity, preferring an outlet-specific row
// over the global one. null when the product has no price at that quantity yet.
const currentPriceFor = (fp) => {
  const rows = fp.product?.prices || [];
  const qty = fp.quantity || 1;
  const atQty = rows.filter((p) => p.quantity === qty);
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
    priceSet: fp.priceSet || 'Default Price Set',
    createdBy: fp.createdBy?.name || 'Unknown',
    quantity: fp.quantity || 1,
    currentPrice: currentPriceFor(fp),
    price: fp.price || 0,
    effectiveAt: fp.effectiveAt,
    isApplied: fp.isApplied || false,
    appliedAt: fp.appliedAt,
    product: fp.product,
  }));

const FuturePrices = () => {
  const { getOutletId } = useAuth();
  const [futurePrices, setFuturePrices] = useState([]);
  const [selectedPrices, setSelectedPrices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [selectedCategory, setSelectedCategory] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  // Reference has no Filter button: selections self-apply. Debounced below, and
  // parseDateTimeText refuses <4-digit years, so typing never fetches half-dates.
  const [appliedFilters, setAppliedFilters] = useState({});

  // { kind: 'apply' | 'delete', ids: number[], row?: object }
  const [confirm, setConfirm] = useState(null);

  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedProductDetails, setSelectedProductDetails] = useState(null);
  const [itemSearchResults, setItemSearchResults] = useState([]);
  const [itemSearchLoading, setItemSearchLoading] = useState(false);
  const [itemSearchText, setItemSearchText] = useState('');
  const [scheduledTime, setScheduledTime] = useState(null);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const schedAnchorRef = useRef(null);
  const [priceSet, setPriceSet] = useState('Default Price Set');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  // Once the user types a price, quantity changes must never overwrite it.
  const [priceTouched, setPriceTouched] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [dateError, setDateError] = useState('');

  const [orderBy, setOrderBy] = useState('effectiveAt');
  const [order, setOrder] = useState('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const priceSets = ['Default Price Set'];

  const fetchPrices = useCallback(async () => {
    try {
      setLoadingData(true);
      const response = await futurePriceService.getFuturePrices(appliedFilters);
      if (response && response.futurePrices) {
        setFuturePrices(transformPrices(response.futurePrices));
      }
    } catch (err) {
      console.error('Error fetching future prices:', err);
      setError(err.response?.data?.error || 'Failed to fetch future prices');
    } finally {
      setLoadingData(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  // Filters self-apply on change (reference has no Filter button).
  useEffect(() => {
    const t = setTimeout(() => {
      const next = {};
      if (selectedCategory) next.category = selectedCategory;
      if (startDate) next.startDate = startDate.toISOString();
      if (endDate) next.endDate = endDate.toISOString();
      // Keep the old reference when nothing changed so no redundant refetch fires.
      setAppliedFilters((prev) =>
        JSON.stringify(prev) === JSON.stringify(next) ? prev : next
      );
    }, 400);
    return () => clearTimeout(t);
  }, [selectedCategory, startDate, endDate]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await classificationService.getClassifications({ type: 'Category' });
        if (response && response.classifications) {
          setCategories(response.classifications);
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    };
    fetchCategories();
  }, []);

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
  }, [futurePrices, orderBy, order]);

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

  const getProductPrice = (product) => {
    if (!product) return 0;
    if (Array.isArray(product.prices) && product.prices.length > 0) {
      const defaultPrice = product.prices.find((p) => p.quantity === 1);
      if (defaultPrice) return defaultPrice.price || 0;
      return product.prices[0]?.price || 0;
    }
    return product.retailPrice || product.caseCost || 0;
  };

  const getProductCost = (product) => {
    if (!product) return 0;
    return product.itemCost || product.caseCost || 0;
  };

  const calculatePriceForQuantity = (product, qtyInput) => {
    if (!product || !qtyInput || qtyInput <= 0) return 0;
    const qty = Number(qtyInput);

    if (Array.isArray(product.prices) && product.prices.length > 0) {
      const sorted = [...product.prices].sort((a, b) => (a.quantity || 0) - (b.quantity || 0));
      let selectedTier = null;
      for (let i = sorted.length - 1; i >= 0; i--) {
        if ((Number(sorted[i].quantity) || 0) <= qty) {
          selectedTier = sorted[i];
          break;
        }
      }
      if (!selectedTier) selectedTier = sorted[0];
      if (selectedTier) {
        const pricePerUnit = (Number(selectedTier.price) || 0) / (Number(selectedTier.quantity) || 1);
        return pricePerUnit * qty;
      }
    }
    return getProductPrice(product) * qty;
  };

  const resetScheduleForm = () => {
    setSelectedItem(null);
    setSelectedProductDetails(null);
    setItemSearchResults([]);
    setItemSearchText('');
    setScheduledTime(null);
    setTimePickerOpen(false);
    setPriceSet('Default Price Set');
    setQuantity('');
    setPrice('');
    setPriceTouched(false);
    setDateError('');
  };

  const handleAddFuturePrice = async () => {
    if (!selectedItem || !scheduledTime || !quantity || !price) {
      setError('Please fill in all required fields');
      return;
    }
    if (scheduledTime <= new Date()) {
      setDateError('Please select a time that is in the future');
      setError('Please select a time that is in the future');
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
        priceSet,
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

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        {/* Reference Category is a SEARCHABLE autocomplete (text input + filter-as-you-type),
            not a plain Select. */}
        <Autocomplete
          sx={{ flex: 1, minWidth: 0 }}
          options={categories}
          getOptionLabel={(o) => o?.name || ''}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          value={categories.find((c) => c.id === selectedCategory) || null}
          onChange={(e, v) => setSelectedCategory(v ? v.id : '')}
          // Reference dropdown attaches flat: radius 0, white, full field width.
          slotProps={{ paper: { sx: { borderRadius: 0, bgcolor: '#fff' } }, listbox: { sx: { maxHeight: 320 } } }}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Select Category..."
              sx={{ '& .MuiOutlinedInput-root': { ...FIELD_SX, py: '0 !important' } }}
            />
          )}
        />

        <DateTimeFilterField value={startDate} onChange={setStartDate} placeholder="Select Start Date..." />
        <DateTimeFilterField value={endDate} onChange={setEndDate} placeholder="Select End Date..." />
      </Box>

      {/* Reference keeps the count and all four bulk actions on ONE row, right-aligned.
          No Filter button exists — filters self-apply. */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
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

      {!loadingData && futurePrices.length === 0 ? (
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
      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e5e5e5', borderRadius: '12px' }}>
        <Table>
          <TableHead>
            <TableRow
              sx={{
                backgroundColor: '#5ebbeb',
                '& th': { color: '#fff', fontSize: 16, fontWeight: 700, borderBottom: 'none' },
                '& .MuiTableSortLabel-root, & .MuiTableSortLabel-root:hover, & .MuiTableSortLabel-root.Mui-active':
                  { color: '#fff' },
                '& .MuiTableSortLabel-icon': { color: '#fff !important' },
              }}
            >
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selectedPrices.length > 0 && selectedPrices.length < futurePrices.length}
                  checked={futurePrices.length > 0 && selectedPrices.length === futurePrices.length}
                  onChange={handleSelectAll}
                  sx={{ color: '#fff', '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: '#fff' } }}
                />
              </TableCell>
              {COLUMNS.map((col) => (
                <TableCell key={col.id}>
                  <TableSortLabel
                    active={orderBy === col.id}
                    direction={orderBy === col.id ? order : 'asc'}
                    onClick={() => handleSort(col.id)}
                  >
                    {col.label}
                  </TableSortLabel>
                </TableCell>
              ))}
              {/* Reference leaves the row-action column header blank. */}
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {loadingData ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4, color: '#676b72' }}>
                  Loading...
                </TableCell>
              </TableRow>
            ) : pagedPrices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4, color: '#676b72' }}>
                  No future prices found
                </TableCell>
              </TableRow>
            ) : (
              pagedPrices.map((row) => (
                <TableRow key={row.id} hover sx={{ '&:nth-of-type(even)': { bgcolor: '#f8f8f8' } }}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedPrices.includes(row.id)}
                      onChange={() => handleSelectPrice(row.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {row.itemType}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {row.itemName}
                    </Typography>
                  </TableCell>
                  <TableCell>{row.priceSet}</TableCell>
                  <TableCell>{row.createdBy}</TableCell>
                  <TableCell>{row.quantity}</TableCell>
                  <TableCell>
                    {row.currentPrice == null ? '—' : formatCurrency(row.currentPrice)}
                  </TableCell>
                  <TableCell>{formatCurrency(row.price)}</TableCell>
                  <TableCell>
                    {formatDate(row.effectiveAt)}
                    {row.isApplied && <Chip label="Applied" size="small" color="success" sx={{ ml: 1 }} />}
                  </TableCell>
                  <TableCell>
                    {/* Reference row actions are outlined pills — unlike Future Costs, which
                        uses borderless text links for the same two actions. */}
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
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
        <TablePagination
          component="div"
          count={sortedPrices.length}
          page={safePage}
          onPageChange={(e, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
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
          <HelpIcon sx={{ fontSize: 22, color: '#075985' }} />
          <Typography component="span" sx={{ fontSize: 18, fontWeight: 400, color: '#075985' }}>
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
                options={itemSearchResults}
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
                    sx: { '& .MuiAutocomplete-groupLabel': { fontWeight: 700, color: '#000' } },
                  },
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
                  setPriceTouched(false);
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

            <Grid item xs={12}>
              {/* Reference Scheduled Time: masked DD/MM/YYYY HH:mm:ss button + '...' opener,
                  disabled (bg #d4d4d4) until an item is chosen. The MUI picker popover stays
                  as the opener target, its own field hidden. */}
              <Box ref={schedAnchorRef} sx={{ display: 'flex', gap: 1 }}>
                <Box
                  component="button"
                  type="button"
                  disabled={!selectedItem}
                  onClick={() => setTimePickerOpen(true)}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    height: 42,
                    border: `1px solid ${dateError ? '#e33430' : '#404040'}`,
                    borderRadius: '8px',
                    bgcolor: '#fff',
                    px: 1.5,
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    fontSize: 16,
                    color: scheduledTime ? '#000' : '#808080',
                    cursor: 'pointer',
                    '&:disabled': { bgcolor: '#d4d4d4', color: '#737373', cursor: 'not-allowed' },
                  }}
                >
                  {scheduledTime ? format(scheduledTime, DT_FORMAT) : DT_MASK}
                </Box>
                <Box
                  component="button"
                  type="button"
                  aria-label="Open date and time picker"
                  disabled={!selectedItem}
                  onClick={() => setTimePickerOpen(true)}
                  sx={{
                    width: 42,
                    height: 42,
                    flexShrink: 0,
                    border: '1px solid #404040',
                    borderRadius: '8px',
                    bgcolor: '#fff',
                    fontFamily: 'inherit',
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#000',
                    cursor: 'pointer',
                    '&:disabled': { bgcolor: '#d4d4d4', color: '#737373', cursor: 'not-allowed' },
                  }}
                >
                  ...
                </Box>
              </Box>
              {dateError && (
                <Typography sx={{ color: '#e33430', fontSize: 12, mt: 0.5 }}>{dateError}</Typography>
              )}
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DateTimePicker
                  open={timePickerOpen}
                  onOpen={() => setTimePickerOpen(true)}
                  onClose={() => setTimePickerOpen(false)}
                  value={scheduledTime}
                  format="dd/MM/yyyy HH:mm:ss"
                  ampm={false}
                  views={['year', 'month', 'day', 'hours', 'minutes', 'seconds']}
                  onChange={(newValue) => {
                    setScheduledTime(newValue);
                    setDateError(
                      newValue && newValue <= new Date() ? 'Please select a time that is in the future' : ''
                    );
                  }}
                  minDateTime={new Date()}
                  slotProps={{
                    // The picker's own field is hidden: the masked button row above is the field.
                    textField: {
                      tabIndex: -1,
                      sx: {
                        position: 'absolute',
                        width: 0,
                        height: 0,
                        overflow: 'hidden',
                        m: 0,
                        p: 0,
                        '& fieldset': { border: 0 },
                      },
                    },
                    actionBar: { actions: ['today', 'clear', 'accept'] },
                    // Escape inside the picker must dismiss ONLY the popover — letting it
                    // bubble reached the Dialog and threw away the whole part-filled form.
                    popper: {
                      anchorEl: () => schedAnchorRef.current,
                      onKeyDown: (e) => {
                        if (e.key === 'Escape') e.stopPropagation();
                      },
                    },
                  }}
                />
              </LocalizationProvider>
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Price Set</InputLabel>
                <Select
                  value={priceSet}
                  onChange={(e) => setPriceSet(e.target.value)}
                  label="Price Set"
                  sx={DIALOG_INPUT_SX}
                >
                  {priceSets.map((set) => (
                    <MenuItem key={set} value={set}>
                      {set}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {selectedProductDetails && (
              <>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    Product Price
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{ fontWeight: 500, borderBottom: '1px solid #ddd', pb: 0.5, minHeight: '24px' }}
                  >
                    {formatCurrency(getProductPrice(selectedProductDetails) * (parseFloat(quantity) || 1))}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    Product Cost
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{ fontWeight: 500, borderBottom: '1px solid #ddd', pb: 0.5, minHeight: '24px' }}
                  >
                    {formatCurrency(getProductCost(selectedProductDetails) * (parseFloat(quantity) || 1))}
                  </Typography>
                </Grid>
              </>
            )}

            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Quantity"
                type="number"
                value={quantity}
                // Reference disables Quantity/Price/Scheduled Time until an item is chosen.
                disabled={!selectedItem}
                sx={{ '& .MuiOutlinedInput-root': DIALOG_INPUT_SX }}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const qty = e.target.value;
                  setQuantity(qty);
                  // Only ever suggest a price the user has not typed over.
                  if (priceTouched) return;
                  if (selectedProductDetails && qty) {
                    const calculated = calculatePriceForQuantity(selectedProductDetails, parseFloat(qty) || 0);
                    setPrice(calculated > 0 ? calculated.toFixed(2) : '');
                  } else {
                    setPrice('');
                  }
                }}
                inputProps={{ min: 0 }}
              />
            </Grid>

            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Price"
                type="number"
                value={price}
                disabled={!selectedItem}
                sx={{ '& .MuiOutlinedInput-root': DIALOG_INPUT_SX }}
                // Suggested price is a starting point: focusing selects it so typing replaces.
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  setPrice(e.target.value);
                  setPriceTouched(e.target.value !== '');
                }}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
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
            disabled={!selectedItem || !scheduledTime || !quantity || !price || !!dateError}
            sx={{
              width: 118,
              height: 42,
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: 16,
              textTransform: 'none',
              bgcolor: '#5ebbeb',
              color: '#fff',
              boxShadow: 'none',
              transition: INSTANT,
              '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' },
              '&.Mui-disabled': { bgcolor: '#e5e5e5', color: '#737373' },
            }}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FuturePrices;
