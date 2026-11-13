import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Typography, Popper, ClickAwayListener } from '@mui/material';
import {
  CalendarTodayOutlined as CalendarIcon,
  AccessTimeOutlined as ClockIcon,
  ChevronLeftOutlined as ChevronLeftIcon,
  ChevronRightOutlined as ChevronRightIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { DT_FORMAT, DT_MASK, parseDateTimeText } from './dateTimeText';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';

// Shopfront date-time field, shared by Future Prices / Future Costs (filters and
// the Schedule dialogs): a bare input whose placeholder swaps to the
// DD/MM/YYYY HH:mm:ss mask on focus and opens a dual-month calendar popover with
// calendar / clock tabs, a masked strip and a Current Day shortcut. Typing commits.

// Reference has no transitions anywhere on these pages.
const INSTANT = 'all 0s ease';

// Reference: the field's name floats above it (12px, black) only while it is
// focused / open or holds a value; otherwise the name is the placeholder.
export const FloatLabel = ({ show, children }) =>
  show ? (
    <Typography
      component="span"
      sx={{ position: 'absolute', top: -18, left: 0, fontSize: 12, lineHeight: '16px', color: '#000', whiteSpace: 'nowrap' }}
    >
      {children}
    </Typography>
  ) : null;

const WEEKDAYS = [
  { key: 'mon', label: 'M', weekend: false },
  { key: 'tue', label: 'T', weekend: false },
  { key: 'wed', label: 'W', weekend: false },
  { key: 'thu', label: 'T', weekend: false },
  { key: 'fri', label: 'F', weekend: false },
  { key: 'sat', label: 'S', weekend: true },
  { key: 'sun', label: 'S', weekend: true },
];

const MonthGrid = ({ month, selected, onPick, onTitleClick, minDay }) => {
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
          // Past days are greyed and inert when the caller disables the past.
          const past = minDay ? day < minDay : false;
          return (
            <Box
              key={day.toISOString()}
              component="button"
              type="button"
              disabled={past}
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
                cursor: past ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 16,
                transition: INSTANT,
                // Reference: the picked day is a solid sky-500 square with white text.
                bgcolor: isSelected ? '#00a6f4' : 'transparent',
                color: isSelected ? '#fff' : outside || past ? '#a1a1a1' : '#0084d1',
                '&:hover': { bgcolor: isSelected ? '#00a6f4' : past ? 'transparent' : 'rgba(0,0,0,0.05)' },
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

const squareBtnSx = {
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
};

/**
 * @param value        Date | null
 * @param onChange     (Date | null) => void
 * @param placeholder  text while empty and unfocused
 * @param label        floating name (defaults to the placeholder); showLabel=false hides it
 * @param disabled     greys the field (#d4d4d4) and keeps the popover shut
 * @param disablePast  past days are inert in the calendar
 * @param error        red rail
 */
const DateTimeField = ({
  value,
  onChange,
  placeholder,
  label = placeholder,
  showLabel = true,
  disabled = false,
  disablePast = false,
  error = false,
  // e.g. "..." - a bold opener shown at the right while the field is empty
  suffix = null,
  // Date only (Additional Information default date): DD/MM/YYYY mask, no Time tab.
  dateOnly = false,
  sx,
}) => {
  const fmt = dateOnly ? 'dd/MM/yyyy' : DT_FORMAT;
  const mask = dateOnly ? 'DD/MM/YYYY' : DT_MASK;
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('calendar');
  const [viewMonth, setViewMonth] = useState(startOfMonth(value || new Date()));
  // The popover's masked strip keeps its own text and commits on blur/Enter only:
  // committing per keystroke would round-trip through value and clobber the entry.
  const [stripText, setStripText] = useState('');
  const anchorRef = useRef(null);
  const inputRef = useRef(null);
  const minDay = disablePast ? startOfDay(new Date()) : null;

  useEffect(() => {
    setStripText(value ? format(value, fmt) : '');
  }, [value, fmt]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

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

  // The text lives in the DOM, not in state: a controlled input restores the DOM
  // value from props on every input event that does not move the committed
  // value, wiping partial entries ("01/01/20…") keystroke by keystroke.
  const writeText = useCallback((t) => {
    if (inputRef.current) inputRef.current.value = t;
    setInvalid(t.trim() !== '' && !parseDateTimeText(t));
  }, []);

  useEffect(() => {
    const current = inputRef.current ? inputRef.current.value : '';
    const parsed = parseDateTimeText(current);
    if (value && parsed && parsed.getTime() === value.getTime()) return;
    if (!value && !parsed) return;
    writeText(value ? format(value, fmt) : '');
  }, [value, writeText, fmt]);

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

  const active = !disabled && (focused || open);

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box sx={{ position: 'relative', flex: 1, minWidth: 0, ...sx }}>
        {showLabel && <FloatLabel show={active || !!value}>{label}</FloatLabel>}
        <Box
          ref={anchorRef}
          sx={{
            display: 'flex',
            alignItems: 'center',
            height: 42,
            border: error || invalid ? '1px solid #e33430' : active ? '2px solid #000' : '1px solid #404040',
            borderRadius: '8px',
            bgcolor: disabled ? '#d4d4d4' : '#fff',
            px: active ? '13px' : '14px',
          }}
        >
          {/* Reference: only the mask reads in a monospace face; a chosen date is normal. */}
          <Box
            component="input"
            ref={inputRef}
            disabled={disabled}
            defaultValue={value ? format(value, fmt) : ''}
            onChange={handleText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onClick={() => { if (!disabled) setOpen(true); }}
            placeholder={active ? mask : placeholder}
            sx={{
              flex: 1,
              minWidth: 0,
              height: '100%',
              border: 0,
              outline: 'none',
              bgcolor: 'transparent',
              fontFamily: active && !value ? '"Roboto Mono", "Courier New", monospace' : 'inherit',
              fontSize: 16,
              color: '#000',
              cursor: disabled ? 'not-allowed' : 'text',
              '&::placeholder': { color: disabled ? '#737373' : '#808080', opacity: 1 },
            }}
          />
          {suffix && !value && (
            <Box
              component="span"
              onClick={() => { if (!disabled) setOpen(true); }}
              sx={{ fontWeight: 700, fontSize: 16, color: disabled ? '#737373' : '#000', ml: 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
            >
              {suffix}
            </Box>
          )}
        </Box>

        <Popper
          open={open}
          anchorEl={anchorRef.current}
          placement="bottom-start"
          modifiers={[{ name: 'offset', options: { offset: [0, 10] } }]}
          style={{ zIndex: 1400 }}
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
            {/* Reference: a masked strip at the top (monospace, 1px black border, x to clear). */}
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                width: 248,
                height: 38,
                border: '1px solid #000',
                borderRadius: '8px',
                px: 1.5,
                mb: 2,
                bgcolor: '#fff',
              }}
            >
              <Box
                component="input"
                value={stripText}
                onChange={(e) => setStripText(e.target.value)}
                onBlur={commitStrip}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitStrip();
                }}
                placeholder={dateOnly ? 'dd/mm/yyyy' : 'dd/mm/yyyy, hh:mm:ss'}
                aria-label="Date and time"
                sx={{
                  flex: 1,
                  minWidth: 0,
                  border: 0,
                  bgcolor: 'transparent',
                  fontFamily: '"Roboto Mono", "Courier New", monospace',
                  fontSize: 14,
                  color: '#000',
                  outline: 'none',
                  '&::placeholder': { color: '#404040', opacity: 1 },
                }}
              />
              {value && (
                <Box
                  component="button"
                  type="button"
                  aria-label="Clear date"
                  onClick={() => { onChange(null); setStripText(''); }}
                  sx={{ border: 0, bgcolor: 'transparent', p: 0, ml: 1, cursor: 'pointer', display: 'flex' }}
                >
                  <CloseIcon sx={{ fontSize: 16, color: '#000' }} />
                </Box>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              {[
                { key: 'calendar', icon: <CalendarIcon sx={{ fontSize: 18 }} />, name: 'Calendar' },
                { key: 'clock', icon: <ClockIcon sx={{ fontSize: 18 }} />, name: 'Time' },
              ].filter(({ key }) => !(dateOnly && key === 'clock')).map(({ key, icon, name }) => (
                <Box
                  key={key}
                  component="button"
                  type="button"
                  aria-label={name}
                  aria-pressed={tab === key}
                  onClick={() => setTab(key)}
                  sx={{
                    ...squareBtnSx,
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
                <Box component="button" type="button" aria-label="Previous month" onClick={() => setViewMonth((m) => subMonths(m, 1))} sx={squareBtnSx}>
                  <ChevronLeftIcon />
                </Box>
                <MonthGrid month={viewMonth} selected={value} onPick={pick} minDay={minDay} onTitleClick={() => setViewMonth(startOfMonth(new Date()))} />
                <MonthGrid month={addMonths(viewMonth, 1)} selected={value} onPick={pick} minDay={minDay} onTitleClick={() => setViewMonth(startOfMonth(new Date()))} />
                <Box component="button" type="button" aria-label="Next month" onClick={() => setViewMonth((m) => addMonths(m, 1))} sx={squareBtnSx}>
                  <ChevronRightIcon />
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {[
                  { part: 'h', name: 'Hours', v: value ? value.getHours() : 0, max: 23 },
                  { part: 'm', name: 'Minutes', v: value ? value.getMinutes() : 0, max: 59 },
                  { part: 's', name: 'Seconds', v: value ? value.getSeconds() : 0, max: 59 },
                ].map(({ part, name, v, max }) => (
                  <Box key={part}>
                    <Typography sx={{ fontSize: 12, color: '#525252', mb: 0.5 }}>{name}</Typography>
                    <Box
                      component="input"
                      type="number"
                      min={0}
                      max={max}
                      aria-label={name}
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

export default DateTimeField;
