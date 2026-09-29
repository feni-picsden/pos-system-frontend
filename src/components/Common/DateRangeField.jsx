import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  TextField,
  Popover,
  IconButton,
  InputAdornment,
} from '@mui/material';
import {
  CalendarToday as CalendarIcon,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  Close as ClearDateIcon,
} from '@mui/icons-material';
import { format, addMonths, startOfMonth, endOfMonth, parse, isValid } from 'date-fns';

// Shared single-box date range (moved unchanged from Orders & Invoices so other
// screens can use the same reference control). value/onChange:
// { startDate, endDate, preset: 'custom' } or null when cleared.
const sameDay = (a, b) => a && b && format(a, 'yyyy-MM-dd') === format(b, 'yyyy-MM-dd');

// Reference date-range field: two DD/MM/YYYY segments in one box (empty by
// default, no trailing calendar icon); popup has a calendar icon top-left,
// 'Current Day' link top-right, two months paged together by ONE prev / ONE
// next chevron, single-letter Monday-start weekday header, and today drawn as
// a blue OUTLINED circle.
const DateRangeField = ({ value, onChange }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [tempStart, setTempStart] = useState(null);
  const [tempEnd, setTempEnd] = useState(null);
  const [baseMonth, setBaseMonth] = useState(startOfMonth(new Date()));
  // Reference: the two popover boxes are typeable (dd/mm/yyyy). Text is kept
  // separately while the operator types; it becomes a date on blur / Enter.
  const [startText, setStartText] = useState('');
  const [endText, setEndText] = useState('');

  const start = value?.startDate || null;
  const end = value?.endDate || null;
  const fmt = (d) => (d ? format(d, 'dd/MM/yyyy') : '');

  const handleOpen = (e) => {
    setTempStart(start);
    setTempEnd(end);
    setStartText(fmt(start));
    setEndText(fmt(end));
    setBaseMonth(startOfMonth(start || new Date()));
    setAnchorEl(e.currentTarget);
  };
  const handleClose = () => setAnchorEl(null);

  const apply = (s, e) => {
    onChange({ startDate: s, endDate: e, preset: 'custom' });
    handleClose();
  };

  const handleDateClick = (date) => {
    if (!tempStart || (tempStart && tempEnd) || date < tempStart) {
      setTempStart(date);
      setTempEnd(null);
      setStartText(fmt(date));
      setEndText('');
    } else {
      setTempEnd(date);
      setEndText(fmt(date));
      apply(tempStart, date);
    }
  };

  // Typed date: accepts dd/mm/yyyy or dd-mm-yyyy. Invalid text is reverted to
  // the last good value so a typo never filters on a bogus date.
  const parseTyped = (text) => {
    const t = String(text || '').trim().replace(/-/g, '/');
    if (!t) return null;
    const d = parse(t, 'dd/MM/yyyy', new Date());
    return isValid(d) && t.length === 10 ? d : undefined; // undefined = invalid
  };
  const commitStart = () => {
    const d = parseTyped(startText);
    if (d === undefined) { setStartText(fmt(tempStart)); return; }
    if (d && tempStart && sameDay(d, tempStart)) return; // unchanged: leave the picker open
    if (!d && !tempStart) return;
    if (!d) { clearStart(); return; }
    let e = tempEnd && tempEnd < d ? null : tempEnd;
    setTempStart(d); setTempEnd(e); setEndText(fmt(e));
    setBaseMonth(startOfMonth(d));
    if (e) apply(d, e); else onChange({ startDate: d, endDate: null, preset: 'custom' });
  };
  const commitEnd = () => {
    const d = parseTyped(endText);
    if (d === undefined) { setEndText(fmt(tempEnd)); return; }
    if (d && tempEnd && sameDay(d, tempEnd)) return; // unchanged: leave the picker open
    if (!d && !tempEnd) return;
    if (!d) { clearEnd(); return; }
    if (!tempStart || d < tempStart) { setEndText(fmt(tempEnd)); return; } // end before start: ignore
    setTempEnd(d);
    apply(tempStart, d);
  };
  const onEnter = (commit) => (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } };

  const handleCurrentDay = () => {
    const today = new Date();
    apply(today, today);
  };

  // Reference: each date box in the popover carries an X. Clearing the end
  // keeps the start (range becomes open-ended until a new end is picked);
  // clearing the start empties the whole range. The picker stays open and
  // Status/Type are untouched - "All" and the date filter are independent.
  const clearEnd = () => {
    setTempEnd(null);
    setEndText('');
    onChange(tempStart ? { startDate: tempStart, endDate: null, preset: 'custom' } : null);
  };
  const clearStart = () => {
    setTempStart(null);
    setTempEnd(null);
    setStartText('');
    setEndText('');
    onChange(null);
  };

  const inRange = (day) => {
    if (!tempStart) return false;
    if (!tempEnd) return sameDay(day, tempStart);
    return day >= tempStart && day <= tempEnd;
  };

  const renderMonth = (month) => {
    const first = startOfMonth(month);
    const last = endOfMonth(month);
    const lead = (first.getDay() + 6) % 7; // Monday start
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= last.getDate(); d++) {
      cells.push(new Date(month.getFullYear(), month.getMonth(), d));
    }
    const today = new Date();
    return (
      <Box key={format(month, 'yyyy-MM')} sx={{ width: 224 }}>
        <Typography sx={{ textAlign: 'center', fontWeight: 700, fontSize: 14, mb: 1 }}>
          {format(month, 'MMMM yyyy')}
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', mb: 0.5 }}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <Typography key={i} sx={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#676b72' }}>
              {d}
            </Typography>
          ))}
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
          {cells.map((day, i) => {
            if (!day) return <Box key={i} />;
            const isToday = sameDay(day, today);
            const selected = inRange(day);
            const isEdge = sameDay(day, tempStart) || sameDay(day, tempEnd);
            return (
              <Box
                key={i}
                onClick={() => handleDateClick(day)}
                sx={{
                  height: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  borderRadius: '50%',
                  // today = blue OUTLINED circle (never solid fill)
                  border: isToday || isEdge ? '1px solid #5ebbeb' : '1px solid transparent',
                  bgcolor: selected ? '#e3f2fd' : 'transparent',
                  color: '#0284c7',
                  fontSize: 14,
                  '&:hover': { bgcolor: '#e3f2fd' },
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

  const segSx = (has) => ({
    fontSize: 16,
    color: has ? '#000' : '#808080',
    px: 1,
    lineHeight: '40px',
  });

  return (
    <>
      <Box
        onClick={handleOpen}
        sx={{
          display: 'flex',
          alignItems: 'center',
          height: 42,
          border: '1px solid #404040',
          borderRadius: '8px',
          bgcolor: '#fff',
          px: 1,
          cursor: 'pointer',
        }}
      >
        {/* Reference: blank until a range is picked; the DD/MM/YYYY guide shows
            only while the picker is open (focused state). */}
        {(start || end || Boolean(anchorEl)) && (
          <>
            <Box component="span" sx={segSx(!!start)}>
              {start ? format(start, 'dd/MM/yyyy') : 'DD/MM/YYYY'}
            </Box>
            <Box component="span" sx={{ color: '#808080' }}>
              –
            </Box>
            <Box component="span" sx={segSx(!!end)}>
              {end ? format(end, 'dd/MM/yyyy') : 'DD/MM/YYYY'}
            </Box>
          </>
        )}
      </Box>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { p: 2, width: 540, bgcolor: '#fff', borderRadius: '8px' } }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <IconButton size="small">
            <CalendarIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <Button
            size="small"
            onClick={handleCurrentDay}
            sx={{ textTransform: 'none', fontSize: 14, color: '#5ebbeb', p: '2px 8px', minWidth: 0 }}
          >
            Current Day
          </Button>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <TextField
            size="small"
            value={startText}
            onChange={(e) => setStartText(e.target.value)}
            onBlur={commitStart}
            onKeyDown={onEnter(commitStart)}
            placeholder="dd/mm/yyyy"
            autoFocus
            inputProps={{ 'aria-label': 'Start date', maxLength: 10 }}
            InputProps={{
              endAdornment: tempStart ? (
                <InputAdornment position="end">
                  <IconButton size="small" aria-label="Clear start date" onMouseDown={(e) => e.preventDefault()} onClick={clearStart}>
                    <ClearDateIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
            sx={{ flex: 1 }}
          />
          <Typography sx={{ color: '#676b72' }}>-</Typography>
          <TextField
            size="small"
            value={endText}
            onChange={(e) => setEndText(e.target.value)}
            onBlur={commitEnd}
            onKeyDown={onEnter(commitEnd)}
            placeholder="dd/mm/yyyy"
            inputProps={{ 'aria-label': 'End date', maxLength: 10 }}
            InputProps={{
              endAdornment: tempEnd ? (
                <InputAdornment position="end">
                  <IconButton size="small" aria-label="Clear end date" onMouseDown={(e) => e.preventDefault()} onClick={clearEnd}>
                    <ClearDateIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
            sx={{ flex: 1 }}
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          {/* single shared prev/next chevrons page BOTH months together */}
          <IconButton size="small" onClick={() => setBaseMonth((m) => addMonths(m, -1))} sx={{ mt: 3 }}>
            <KeyboardArrowLeft />
          </IconButton>
          {renderMonth(baseMonth)}
          {renderMonth(addMonths(baseMonth, 1))}
          <IconButton size="small" onClick={() => setBaseMonth((m) => addMonths(m, 1))} sx={{ mt: 3 }}>
            <KeyboardArrowRight />
          </IconButton>
        </Box>
      </Popover>
    </>
  );
};

export default DateRangeField;
