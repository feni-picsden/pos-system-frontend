import React, { useCallback, useEffect, useRef, useState } from 'react';
import { byMode } from '../../theme/sfPalette';
import { Box, Typography, IconButton } from '@mui/material';
import {
  Remove as RemoveIcon,
  CalendarTodayOutlined,
  AccessTimeOutlined,
  ChevronLeft,
  ChevronRight,
  Close,
} from '@mui/icons-material';
import {
  format,
  parse,
  isValid,
  startOfMonth,
  addMonths,
  startOfWeek,
  addDays,
  startOfDay,
  endOfDay,
  isSameDay,
  isSameMonth,
} from 'date-fns';

// Reference date-time range filter (same control as Reports > Register Closures):
// one 43px bordered box with two "DD/MM/YYYY HH:mm:ss" halves joined by a light
// minus; the popover has the two typed boxes on top, calendar / clock mode
// buttons + "Current Day", and two months paged together.
// value / onChange: { startDate, endDate } (either may be null).

const INSTANT = 'all 0s ease';
const FMT = 'dd/MM/yyyy HH:mm:ss';
const MASK = 'DD/MM/YYYY HH:mm:ss';
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MODES = [
  { key: 'date', Icon: CalendarTodayOutlined },
  { key: 'time', Icon: AccessTimeOutlined },
];

const fmtDate = (d) => (d ? format(d, FMT) : '');
const parseMask = (text) => {
  const d = parse(text, FMT, new Date());
  return isValid(d) ? d : null;
};
const monthGrid = (month) => {
  const first = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
};

const MonthCalendar = ({ month, start, end, onPick }) => {
  const today = new Date();
  return (
    <Box sx={{ width: 266 }}>
      <Typography sx={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'sf.calTitle', mb: 1, height: 24, lineHeight: '24px' }}>
        {format(month, 'MMMM yyyy')}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 38px)' }}>
        {WEEKDAYS.map((d, i) => (
          <Typography key={`${d}-${i}`} sx={{ width: 38, textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'sf.calWeekday', lineHeight: '24px' }}>
            {d}
          </Typography>
        ))}
        {monthGrid(month).map((day) => {
          const outside = !isSameMonth(day, month);
          const selected = (start && isSameDay(day, start)) || (end && isSameDay(day, end));
          const inRange = start && end && day > start && day < end;
          return (
            <Box
              key={day.toISOString()}
              component="button"
              type="button"
              onClick={() => onPick(day)}
              sx={{
                width: 38,
                height: 38,
                border: 1,
                borderColor: isSameDay(day, today) ? 'sf.calDay' : 'transparent',
                borderRadius: '12px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 16,
                fontWeight: 700,
                transition: INSTANT,
                // Reference dark: selected day = blue pill with dark text
                color: selected ? 'sf.onPrimaryButton' : outside ? 'sf.calOutside' : 'sf.calDay',
                bgcolor: selected ? '#5ebbeb' : inRange ? 'sf.rangeTint' : 'transparent',
                '&:hover': { bgcolor: selected ? '#5ebbeb' : 'sf.rangeTint' },
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

const RangePopover = ({ start, end, onChange, onClose, anchorRef }) => {
  const [month, setMonth] = useState(startOfMonth(start || new Date()));
  const [mode, setMode] = useState('date');
  const [text, setText] = useState({ start: fmtDate(start), end: fmtDate(end) });
  const ref = useRef(null);

  useEffect(() => { setText({ start: fmtDate(start), end: fmtDate(end) }); }, [start, end]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !(anchorRef.current && anchorRef.current.contains(e.target))) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose, anchorRef]);

  const pick = (day) => {
    if (!start || end) onChange({ start: startOfDay(day), end: null });
    else if (day < start) onChange({ start: startOfDay(day), end: null });
    else onChange({ start, end: endOfDay(day) });
  };

  const setTime = (key, value) => {
    const [h, m, s] = value.split(':').map(Number);
    const base = (key === 'start' ? start : end) || new Date();
    const next = new Date(base);
    next.setHours(h || 0, m || 0, s || 0, 0);
    onChange({ start, end, [key]: next });
  };

  const monoSx = {
    // Reference keeps these two boxes white in dark mode too.
    width: 227, height: 36, bgcolor: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px', px: 1,
    fontFamily: '"Roboto Mono", monospace', fontSize: 12, color: '#000', outline: 'none', transition: INSTANT,
    // ...except the one being typed in, which the reference turns dark (dark mode only).
    '&:focus': { bgcolor: byMode('#fff', '#121212'), color: byMode('#000', '#f8f8f8'), borderColor: byMode('#e5e5e5', '#f8f8f8') },
  };
  const chevronSx = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, border: 0,
    bgcolor: 'transparent', color: 'sf.calDay', cursor: 'pointer', p: 0, transition: INSTANT,
  };

  return (
    <Box
      ref={ref}
      data-testid="dt-range-popover"
      sx={{
        position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 20, width: 622, bgcolor: 'sf.pane',
        border: 1, borderColor: 'sf.chip', borderRadius: '12px', p: 2,
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', transition: INSTANT,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
        {['start', 'end'].map((key, i) => (
          <React.Fragment key={key}>
            {i > 0 && <Typography sx={{ fontSize: 12, color: 'sf.textSoft' }}>&mdash;</Typography>}
            <Box
              component="input"
              value={text[key]}
              placeholder={MASK}
              onChange={(e) => {
                const v = e.target.value;
                setText((t) => ({ ...t, [key]: v }));
                const d = parseMask(v);
                if (d) onChange({ start, end, [key]: d });
              }}
              sx={monoSx}
            />
          </React.Fragment>
        ))}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2, mb: 1 }}>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {MODES.map((m) => (
            <Box
              key={m.key}
              component="button"
              type="button"
              aria-label={m.key === 'date' ? 'Calendar' : 'Time'}
              onClick={() => setMode(m.key)}
              sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32,
                border: 1, borderColor: 'sf.chip', borderRadius: '8px', cursor: 'pointer', transition: INSTANT,
                bgcolor: mode === m.key ? '#5ebbeb' : 'sf.paper', color: mode === m.key ? '#f8f8f8' : 'sf.textSoft',
              }}
            >
              <m.Icon sx={{ fontSize: 16 }} />
            </Box>
          ))}
        </Box>
        <Box
          component="button"
          type="button"
          onClick={() => { const now = new Date(); onChange({ start: startOfDay(now), end: endOfDay(now) }); }}
          sx={{
            border: 1, borderColor: 'sf.chip', borderRadius: '8px', bgcolor: 'sf.paper', color: 'sf.text', fontFamily: 'inherit',
            fontSize: 12, fontWeight: 700, height: 32, px: 1.5, cursor: 'pointer', transition: INSTANT,
            '&:hover': { bgcolor: 'sf.rangeTint' },
          }}
        >
          Current Day
        </Box>
      </Box>

      {mode === 'date' ? (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box component="button" type="button" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))} sx={{ ...chevronSx, mt: 3 }}>
            <ChevronLeft sx={{ fontSize: 20 }} />
          </Box>
          <MonthCalendar month={month} start={start} end={end} onPick={pick} />
          <MonthCalendar month={addMonths(month, 1)} start={start} end={end} onPick={pick} />
          <Box component="button" type="button" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))} sx={{ ...chevronSx, mt: 3 }}>
            <ChevronRight sx={{ fontSize: 20 }} />
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, height: 296 }}>
          {['start', 'end'].map((key) => {
            const d = key === 'start' ? start : end;
            return (
              <Box key={key} component="input" type="time" step="1" value={d ? format(d, 'HH:mm:ss') : ''} onChange={(e) => setTime(key, e.target.value)} sx={monoSx} />
            );
          })}
        </Box>
      )}
    </Box>
  );
};

const DateTimeRangeFilter = ({ value, onChange, testId }) => {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const boxRef = useRef(null);
  const start = value?.startDate || null;
  const end = value?.endDate || null;
  const change = ({ start: s, end: e }) => onChange({ startDate: s || null, endDate: e || null });

  const halfSx = (d) => ({
    flex: 1, minWidth: 0, height: 41, border: 0, outline: 'none', bgcolor: 'transparent',
    fontFamily: d ? 'inherit' : '"Roboto Mono", monospace', fontSize: 16, color: d ? 'sf.text' : 'sf.textFaint',
    textAlign: 'left', p: '8px 16px', cursor: 'pointer', transition: INSTANT, whiteSpace: 'nowrap', overflow: 'hidden',
  });

  return (
    <Box sx={{ position: 'relative' }} data-testid={testId}>
      <Box
        ref={boxRef}
        sx={{
          display: 'flex', alignItems: 'center', gap: '4px', width: '100%', height: 43,
          border: open ? 2 : 1, borderColor: open ? 'sf.borderStrong' : 'sf.border', borderRadius: '8px', bgcolor: 'sf.input', p: 0,
          boxSizing: 'border-box',
        }}
      >
        <Box component="button" type="button" data-half="start" onClick={() => setOpen(true)} sx={halfSx(start)}>
          {fmtDate(start) || MASK}
        </Box>
        <RemoveIcon sx={{ color: 'sf.textSoft', fontSize: 16, width: 12, flexShrink: 0 }} />
        <Box component="button" type="button" data-half="end" onClick={() => setOpen(true)} sx={halfSx(end)}>
          {fmtDate(end) || MASK}
        </Box>
        {(start || end) && (
          <IconButton size="small" aria-label="Clear dates" onClick={() => onChange({ startDate: null, endDate: null })} sx={{ p: '2px', mr: 1 }}>
            <Close sx={{ fontSize: 18, color: 'sf.text' }} />
          </IconButton>
        )}
      </Box>
      {open && <RangePopover start={start} end={end} onChange={change} onClose={close} anchorRef={boxRef} />}
    </Box>
  );
};

export default DateTimeRangeFilter;
