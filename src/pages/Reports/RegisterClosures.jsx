import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Typography, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import {
  VisibilityOutlined as ViewIcon,
  Remove as RemoveIcon,
  CalendarTodayOutlined,
  AccessTimeOutlined,
  ChevronLeft,
  ChevronRight
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
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
  isSameMonth
} from 'date-fns';
import apiClient from '../../services/apiClient';

// Shopfront reference has no transitions and no ripple anywhere.
const INSTANT = 'all 0s ease';

const FMT = 'dd/MM/yyyy HH:mm:ss';
const MASK = 'DD/MM/YYYY HH:mm:ss';
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MODES = [
  { key: 'date', Icon: CalendarTodayOutlined },
  { key: 'time', Icon: AccessTimeOutlined }
];

const fmtDate = (d) => (d ? format(d, FMT) : '');
const fmtDateTime = (v) => (v ? format(new Date(v), FMT) : '');
const parseMask = (text) => {
  const d = parse(text, FMT, new Date());
  return isValid(d) ? d : null;
};

// 6 weeks x 7 days, Monday-first, starting on the Monday on/before the 1st.
const monthGrid = (month) => {
  const first = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
};

const MonthCalendar = ({ month, start, end, onPick }) => {
  const today = new Date();
  return (
    <Box sx={{ width: 266 }}>
      <Typography
        sx={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#000', mb: 1, height: 24, lineHeight: '24px' }}
      >
        {format(month, 'MMMM yyyy')}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 38px)' }}>
        {WEEKDAYS.map((d, i) => (
          <Typography
            key={`${d}-${i}`}
            sx={{ width: 38, textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#737373', lineHeight: '24px' }}
          >
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
                border: isSameDay(day, today) ? '1px solid #33a3e0' : '1px solid transparent',
                borderRadius: '12px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 16,
                fontWeight: 700,
                transition: INSTANT,
                color: selected ? '#f8f8f8' : outside ? '#c4c4c4' : '#33a3e0',
                bgcolor: selected ? '#5ebbeb' : inRange ? '#e4f2fb' : 'transparent',
                '&:hover': { bgcolor: selected ? '#5ebbeb' : '#e4f2fb' }
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

// App-rendered range popover (the reference does not use a native picker).
const RangePopover = ({ start, end, onChange, onClose }) => {
  const [month, setMonth] = useState(startOfMonth(start || new Date()));
  const [mode, setMode] = useState('date');
  const [text, setText] = useState({ start: fmtDate(start), end: fmtDate(end) });
  const ref = useRef(null);

  useEffect(() => {
    setText({ start: fmtDate(start), end: fmtDate(end) });
  }, [start, end]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  // First click sets the start (clearing any end), the next click closes the range.
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
    width: 227,
    height: 36,
    bgcolor: '#fff',
    border: '1px solid #e5e5e5',
    borderRadius: '8px',
    px: 1,
    fontFamily: '"Roboto Mono", monospace',
    fontSize: 12,
    color: '#000',
    outline: 'none',
    transition: INSTANT
  };

  const chevronSx = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    border: 0,
    bgcolor: 'transparent',
    color: '#000',
    cursor: 'pointer',
    p: 0,
    transition: INSTANT
  };

  return (
    <Box
      ref={ref}
      sx={{
        position: 'absolute',
        top: '100%',
        left: 0,
        zIndex: 20,
        width: 622,
        bgcolor: '#f7f7f7',
        border: '1px solid #e5e5e5',
        borderRadius: '12px',
        p: 2,
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
        transition: INSTANT
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
        <Box
          component="input"
          value={text.start}
          placeholder={MASK}
          onChange={(e) => {
            setText((t) => ({ ...t, start: e.target.value }));
            const d = parseMask(e.target.value);
            if (d) onChange({ start: d, end });
          }}
          sx={monoSx}
        />
        <Typography sx={{ fontSize: 12, color: '#737373' }}>&mdash;</Typography>
        <Box
          component="input"
          value={text.end}
          placeholder={MASK}
          onChange={(e) => {
            setText((t) => ({ ...t, end: e.target.value }));
            const d = parseMask(e.target.value);
            if (d) onChange({ start, end: d });
          }}
          sx={monoSx}
        />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2, mb: 1 }}>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {MODES.map((m) => (
            <Box
              key={m.key}
              component="button"
              type="button"
              onClick={() => setMode(m.key)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                border: '1px solid #e5e5e5',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: INSTANT,
                bgcolor: mode === m.key ? '#5ebbeb' : '#fff',
                color: mode === m.key ? '#f8f8f8' : '#737373'
              }}
            >
              <m.Icon sx={{ fontSize: 16 }} />
            </Box>
          ))}
        </Box>
        <Box
          component="button"
          type="button"
          onClick={() => {
            const now = new Date();
            onChange({ start: startOfDay(now), end: endOfDay(now) });
          }}
          sx={{
            border: '1px solid #e5e5e5',
            borderRadius: '8px',
            bgcolor: '#fff',
            color: '#000',
            fontFamily: 'inherit',
            fontSize: 12,
            fontWeight: 700,
            height: 32,
            px: 1.5,
            cursor: 'pointer',
            transition: INSTANT,
            '&:hover': { bgcolor: '#e4f2fb' }
          }}
        >
          Current Day
        </Box>
      </Box>

      {mode === 'date' ? (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box component="button" type="button" onClick={() => setMonth(addMonths(month, -1))} sx={{ ...chevronSx, mt: 3 }}>
            <ChevronLeft sx={{ fontSize: 20 }} />
          </Box>
          <MonthCalendar month={month} start={start} end={end} onPick={pick} />
          <MonthCalendar month={addMonths(month, 1)} start={start} end={end} onPick={pick} />
          <Box component="button" type="button" onClick={() => setMonth(addMonths(month, 1))} sx={{ ...chevronSx, mt: 3 }}>
            <ChevronRight sx={{ fontSize: 20 }} />
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, height: 296 }}>
          {['start', 'end'].map((key) => {
            const d = key === 'start' ? start : end;
            return (
              <Box
                key={key}
                component="input"
                type="time"
                step="1"
                value={d ? format(d, 'HH:mm:ss') : ''}
                onChange={(e) => setTime(key, e.target.value)}
                sx={monoSx}
              />
            );
          })}
        </Box>
      )}
    </Box>
  );
};

// Full-width bordered field: two trigger buttons joined by a light minus, one shared popover.
const DateRangeFilter = ({ start, end, onChange }) => {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const fieldSx = {
    flex: 1,
    minWidth: 0,
    height: 41,
    border: 0,
    outline: 'none',
    bgcolor: 'transparent',
    fontFamily: 'inherit',
    fontSize: 16,
    color: '#000',
    textAlign: 'left',
    p: '8px 16px',
    cursor: 'default',
    transition: INSTANT
  };

  return (
    <Box sx={{ position: 'relative' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          width: '100%',
          height: 43,
          border: '1px solid #404040',
          borderRadius: '8px',
          bgcolor: '#fff',
          p: 0
        }}
      >
        <Box component="button" type="button" onClick={() => setOpen(true)} sx={fieldSx}>
          {fmtDate(start) || MASK}
        </Box>
        <RemoveIcon sx={{ color: '#737373', fontSize: 16, width: 12, flexShrink: 0 }} />
        <Box component="button" type="button" onClick={() => setOpen(true)} sx={fieldSx}>
          {fmtDate(end) || MASK}
        </Box>
      </Box>
      {open && <RangePopover start={start} end={end} onChange={onChange} onClose={close} />}
    </Box>
  );
};

const RegisterClosures = () => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [, setLoading] = useState(false);
  // Single source of truth for both ends so neither handler can ship a stale sibling value.
  const [range, setRange] = useState({ start: null, end: null });
  const reqId = useRef(0);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    const id = ++reqId.current;
    try {
      setLoading(true);
      // Same endpoint the service uses; called directly so the grand total survives.
      const query = new URLSearchParams({
        ...(range.start ? { from: range.start.toISOString() } : {}),
        ...(range.end ? { to: range.end.toISOString() } : {})
      }).toString();
      const res = await apiClient.get(`/register-closures${query ? `?${query}` : ''}`);
      if (id !== reqId.current) return; // a newer request already answered
      const closures = res.data?.closures || [];
      setRows(closures);
      setTotal(res.data?.total ?? closures.length);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const cellSx = { p: '8px', fontSize: 16, color: '#000', border: '1px solid #000' };
  const headerCellSx = { ...cellSx, fontWeight: 700, textTransform: 'none', bgcolor: 'transparent' };

  return (
    <Box sx={{ p: 1 }}>
      <Typography
        variant="h4"
        component="h1"
        sx={{ fontSize: 32, fontWeight: 700, color: '#000', m: '21.44px 0' }}
      >
        Register Closures
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 400, fontSize: 16, color: '#000' }}>
          Date Range
        </Typography>
        <DateRangeFilter
          start={range.start}
          end={range.end}
          onChange={(next) => setRange((prev) => ({ ...prev, ...next }))}
        />
      </Box>

      <Typography sx={{ textAlign: 'right', fontSize: '12.8px', color: '#676b72', mb: 1 }}>
        Showing {rows.length} of {total} Register Closures
      </Typography>

      <Table sx={{ borderCollapse: 'collapse' }}>
        <TableHead>
          <TableRow>
            <TableCell sx={headerCellSx}>Register</TableCell>
            <TableCell sx={headerCellSx}>Open Time</TableCell>
            <TableCell sx={headerCellSx}>Close Time</TableCell>
            <TableCell sx={headerCellSx}>Expected</TableCell>
            <TableCell sx={headerCellSx}>Received</TableCell>
            <TableCell sx={headerCellSx}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((rc) => (
            <TableRow key={rc.id}>
              <TableCell sx={cellSx}>{rc.register?.name || rc.registerId}</TableCell>
              <TableCell sx={cellSx}>{fmtDateTime(rc.openedAt)}</TableCell>
              <TableCell sx={cellSx}>{fmtDateTime(rc.closedAt)}</TableCell>
              <TableCell sx={cellSx}>${(rc.expectedAmount ?? 0).toFixed(2)}</TableCell>
              <TableCell sx={cellSx}>${(rc.receivedAmount ?? 0).toFixed(2)}</TableCell>
              <TableCell sx={cellSx}>
                <Box
                  component="a"
                  href={`/reports/register-closures/${rc.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(`/reports/register-closures/${rc.id}`);
                  }}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    color: '#1c86f2',
                    textDecoration: 'none',
                    fontSize: 16,
                    cursor: 'pointer',
                    transition: INSTANT,
                    '&:hover': { color: '#73b4f7' }
                  }}
                >
                  <ViewIcon sx={{ fontSize: 18 }} />
                  View
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
};

export default RegisterClosures;
