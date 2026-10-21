import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  FormControl,
  Select,
  MenuItem,
  OutlinedInput,
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  VisibilityOutlined as ViewIcon,
  Remove as RemoveIcon,
  CalendarTodayOutlined,
  AccessTimeOutlined,
  ChevronLeft,
  ChevronRight,
  ArrowDropDown,
  Close
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
import outletService from '../../services/outletService';
import registerService from '../../services/registerService';
import useHeaderScope from '../../hooks/useHeaderScope';

// Shopfront reference has no transitions and no ripple anywhere.
const INSTANT = 'all 0s ease';

const FMT = 'dd/MM/yyyy HH:mm:ss';
const MASK = 'DD/MM/YYYY HH:MM:SS';
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

const filterLabelSx = { mb: 0.5, fontWeight: 400, fontSize: 16, color: '#000' };

// Reference filter select: flat 42px box, "Select..." placeholder, clear (x)
// once something is picked. Options are plain {id, name} rows.
// Reference: Outlets / Registers are multi-select — each pick shows as a chip
// with its own x, plus a clear-all x on the right.
const ClosureSelect = ({ value, onChange, options, label }) => {
  const selected = Array.isArray(value) ? value : (value ? [value] : []);
  const nameOf = (id) => options.find((o) => String(o.id) === String(id))?.name || String(id);
  return (
    <FormControl fullWidth size="small">
      <Select
        multiple
        value={selected}
        onChange={(e) => onChange(Array.isArray(e.target.value) ? e.target.value : [])}
        displayEmpty
        input={<OutlinedInput inputProps={{ 'aria-label': label }} />}
        IconComponent={ArrowDropDown}
        renderValue={(sel) =>
          sel.length ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {sel.map((id) => (
                <Box
                  key={id}
                  data-chip={nameOf(id)}
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: '4px', bgcolor: '#e6e6e6', borderRadius: '2px', px: '6px', fontSize: 14, lineHeight: '24px' }}
                >
                  {nameOf(id)}
                  <Close
                    fontSize="inherit"
                    sx={{ cursor: 'pointer', fontSize: 14 }}
                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                    onClick={(e) => { e.stopPropagation(); onChange(sel.filter((x) => String(x) !== String(id))); }}
                  />
                </Box>
              ))}
            </Box>
          ) : (
            <span style={{ color: '#808080' }}>Select...</span>
          )
        }
        endAdornment={
          selected.length ? (
            <InputAdornment position="end" sx={{ mr: 2 }}>
              <IconButton
                size="small"
                aria-label={`Clear ${label}`}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => onChange([])}
              >
                <Close fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null
        }
        // Same box as the Date Range filter beside it (1px #404040, 8px radius, 43px).
        sx={{
          bgcolor: '#fff', borderRadius: '8px', minHeight: 43, fontSize: 16, transition: INSTANT,
          '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #404040' },
          '&:hover .MuiOutlinedInput-notchedOutline': { border: '1px solid #404040' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: '1px solid #404040' }
        }}
      >
        {options.map((o) => (
          <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

const PAGE = 50;
const fmtMoney = (n) => { const v = Number(n || 0); return `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; };

const RegisterClosures = () => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [, setLoading] = useState(false);
  // Single source of truth for both ends so neither handler can ship a stale sibling value.
  const [range, setRange] = useState({ start: null, end: null });
  // Reference filter row: Outlets / Registers / Date Range.
  const [outletIds, setOutletIds] = useState([]);
  const [registerIds, setRegisterIds] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [registers, setRegisters] = useState([]);
  const reqId = useRef(0);
  const sentinelRef = useRef(null);
  const navigate = useNavigate();
  // Header outlet/register rule: hide the matching in-page filter (display only).
  const scope = useHeaderScope();
  const showOutletFilter = scope.showOutletFilter;
  // All Outlets (global) mode: a register left selected in the header belongs to no
  // chosen outlet, so the Registers filter shows too and the list is not pinned to it.
  const showRegisterFilter = showOutletFilter || scope.showRegisterFilter;
  const headerRegisterId = showOutletFilter ? null : scope.headerRegisterId;
  useEffect(() => {
    if (!showOutletFilter && outletIds.length) { setOutletIds([]); setRegisterIds([]); }
    if (!showRegisterFilter && registerIds.length) setRegisterIds([]);
  }, [showOutletFilter, showRegisterFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [outletRes, registerList] = await Promise.all([
          outletService.getAllOutlets(),
          registerService.list()
        ]);
        if (cancelled) return;
        setOutlets(outletRes.outlets || []);
        setRegisters(registerList || []);
      } catch {
        // The filters just stay empty — the list itself still loads.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Reference list is an infinite scroll: a filter change reloads page 1, reaching
  // the bottom appends the next page until every closure is in.
  const load = useCallback(async (skip = 0) => {
    const id = ++reqId.current;
    try {
      setLoading(true);
      // Same endpoint the service uses; called directly so the grand total survives.
      const query = new URLSearchParams({
        ...(range.start ? { from: range.start.toISOString() } : {}),
        ...(range.end ? { to: range.end.toISOString() } : {}),
        ...(showOutletFilter && outletIds.length ? { outletIds: outletIds.join(',') } : {}),
        // hidden Register filter -> the header register
        ...(showRegisterFilter ? (registerIds.length ? { registerIds: registerIds.join(',') } : {}) : (headerRegisterId ? { registerIds: String(headerRegisterId) } : {})),
        skip: String(skip),
        take: String(PAGE)
      }).toString();
      const res = await apiClient.get(`/register-closures?${query}`);
      if (id !== reqId.current) return; // a newer request already answered
      const closures = res.data?.closures || [];
      setRows((prev) => (skip ? [...prev, ...closures] : closures));
      setTotal(res.data?.total ?? closures.length);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [range, outletIds, registerIds, showOutletFilter, showRegisterFilter, headerRegisterId]);

  useEffect(() => {
    load(0);
  }, [load]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || rows.length >= total) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) load(rows.length);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [rows.length, total, load]);

  // Registers are outlet-scoped, so picking outlets narrows the list rather
  // than offering pairs that can never match a closure.
  const visibleRegisters = registers.filter(
    (r) => !outletIds.length || outletIds.some((o) => String(r.outletId) === String(o))
  );
  const outletNameById = (id) =>
    outlets.find((o) => String(o.id) === String(id))?.name || '';

  // Same table design as the other report pages (Security Centre / Sales History):
  // sky-blue header with white caps, zebra rows, no cell borders.
  const cellSx = { p: '8px 8px 8px 10px', fontSize: 16, color: '#000', borderBottom: 'none' };
  const headerCellSx = { p: '8px', fontSize: 16, fontWeight: 700, textTransform: 'uppercase', color: '#f8f8f8', bgcolor: '#5ebbeb', borderBottom: 'none' };

  return (
    // Same page padding as Products (24px) so the Results block clears the edge.
    <Box sx={{ p: 3 }}>
      {/* Title row: heading left, count block top-right (like Products / Stocktakes) */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', m: '21.44px 0' }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{ fontSize: 32, fontWeight: 700, color: '#000', m: 0 }}
        >
          Register Closures
        </Typography>
        <Box data-total-count sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: '#000' }}>{total}</Typography>
          <Typography sx={{ fontSize: 13, color: '#676b72' }}>Results</Typography>
        </Box>
      </Box>

      <Box
        sx={{
          mb: 3,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 2,
          '@media (max-width:900px)': { gridTemplateColumns: '1fr' }
        }}
      >
        {/* Header rule: a filter already fixed by the header is hidden, not removed */}
        {showOutletFilter && (
        <Box>
          <Typography variant="body2" sx={filterLabelSx}>Outlets</Typography>
          <ClosureSelect
            label="Outlets"
            value={outletIds}
            onChange={(next) => {
              setOutletIds(next);
              // drop registers that no longer belong to a picked outlet
              setRegisterIds((prev) => prev.filter((rid) => {
                const r = registers.find((x) => String(x.id) === String(rid));
                return !next.length || (r && next.some((o) => String(o) === String(r.outletId)));
              }));
            }}
            options={outlets}
          />
        </Box>
        )}
        {showRegisterFilter && (
        <Box>
          <Typography variant="body2" sx={filterLabelSx}>Registers</Typography>
          <ClosureSelect
            label="Registers"
            value={registerIds}
            onChange={setRegisterIds}
            options={visibleRegisters}
          />
        </Box>
        )}
        <Box>
          <Typography variant="body2" sx={filterLabelSx}>Date Range</Typography>
          <DateRangeFilter
            start={range.start}
            end={range.end}
            onChange={(next) => setRange((prev) => ({ ...prev, ...next }))}
          />
        </Box>
      </Box>


      <Table sx={{ borderCollapse: 'collapse' }}>
        <TableHead>
          <TableRow>
            <TableCell sx={headerCellSx}>Register</TableCell>
            <TableCell sx={headerCellSx}>Outlet</TableCell>
            <TableCell sx={headerCellSx}>Open Time</TableCell>
            <TableCell sx={headerCellSx}>Close Time</TableCell>
            <TableCell sx={headerCellSx}>Expected</TableCell>
            <TableCell sx={headerCellSx}>Received</TableCell>
            <TableCell sx={headerCellSx}>View</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((rc, i) => (
            <TableRow key={rc.id} sx={{ bgcolor: i % 2 ? '#f8f8f8' : '#fff' }}>
              <TableCell sx={cellSx}>{rc.register?.name || rc.registerId}</TableCell>
              {/* RegisterClosure stores outletId with no outlet relation, so the
                  name comes from the register's outlet or the filter list. */}
              <TableCell sx={cellSx}>{rc.register?.outlet?.name || outletNameById(rc.outletId)}</TableCell>
              <TableCell sx={cellSx}>{fmtDateTime(rc.openedAt)}</TableCell>
              <TableCell sx={cellSx}>{fmtDateTime(rc.closedAt)}</TableCell>
              <TableCell sx={cellSx}>{fmtMoney(rc.expectedAmount)}</TableCell>
              <TableCell sx={cellSx}>{fmtMoney(rc.receivedAmount)}</TableCell>
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
      {rows.length < total && <Box ref={sentinelRef} data-sentinel sx={{ height: 1 }} />}
    </Box>
  );
};

export default RegisterClosures;
