import React, { useState, useRef, useEffect } from 'react';
import {
  TextField,
  Popover,
  Box,
  Typography,
  Button,
  IconButton,
} from '@mui/material';
import {
  CalendarToday as CalendarIcon,
  AccessTime as ClockIcon,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  Close,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, addMonths, startOfMonth, endOfMonth, startOfDay, endOfDay, isSameMonth, isWithinInterval, parse, isValid } from 'date-fns';

// Reference popover accepts typed dates, with or without slashes (25/12/2025 or 25122025).
const parseTypedDate = (raw) => {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length !== 8) return null;
  const d = parse(digits, 'ddMMyyyy', new Date());
  return isValid(d) ? d : null;
};

const DateRangePicker = ({
  value,
  onChange,
  label = "Date and Time",
  size = "small",
  fullWidth = true,
  // ponytail: opt-in empty state + placeholder; existing pages keep today-default
  allowEmpty = false,
  placeholder = '',
  // ponytail: opt-in time-of-day narrowing + relative 'Today' label; off by default so other pages are unchanged
  enableTime = false,
  inputSx = {},
  // ponytail: opt-in trigger tweaks (em-dash separator, hidden calendar icon); defaults keep every other page identical
  separator = '-',
  hideIcon = false,
  // ponytail: opt-in single-date mode — same dual-month popover, one date committed on click.
  // Caller passes {startDate, endDate: startDate} and reads onChange().startDate.
  single = false,
  // ponytail: opt-in reference trigger — one bordered field holding two separately
  // clickable DD/MM/YYYY date buttons split by a dash (instead of one readonly input).
  splitTrigger = false,
}) => {
  const emptyDefault = allowEmpty ? null : new Date();
  const [anchorEl, setAnchorEl] = useState(null);
  const [startDate, setStartDate] = useState(value?.startDate || emptyDefault);
  const [endDate, setEndDate] = useState(value?.endDate || emptyDefault);
  const [tempStartDate, setTempStartDate] = useState(value?.startDate || emptyDefault);
  const [tempEndDate, setTempEndDate] = useState(value?.endDate || emptyDefault);
  const [selectedPreset, setSelectedPreset] = useState(value?.preset || 'custom');
  const [leftMonth, setLeftMonth] = useState(startOfMonth(startDate || new Date()));
  const [rightMonth, setRightMonth] = useState(startOfMonth(addMonths(startDate || new Date(), 1)));
  // Draft text for the typable dd/mm/yyyy inputs inside the popover.
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const anchorRef = useRef(null);
  // Single place that publishes a range upward. The ref mirrors the committed pair
  // synchronously, so an edit to one end always sees the other end's latest value
  // (state alone is a render behind and used to strand typed ranges locally).
  const committedRef = useRef({ start: value?.startDate || emptyDefault, end: value?.endDate || emptyDefault });
  const commit = (start, end, preset) => {
    committedRef.current = { start, end };
    setStartDate(start);
    setEndDate(end);
    setSelectedPreset(preset);
    onChange({ startDate: start, endDate: end, preset });
  };

  // Keep the typed drafts in sync whenever a date is committed by click/shortcut/typing.
  useEffect(() => {
    setStartInput(tempStartDate ? format(tempStartDate, 'dd/MM/yyyy') : '');
  }, [tempStartDate]);
  useEffect(() => {
    setEndInput(tempEndDate ? format(tempEndDate, 'dd/MM/yyyy') : '');
  }, [tempEndDate]);

  // Sync internal state with value prop when it changes
  useEffect(() => {
    if (value) {
      const newStartDate = value.startDate;
      const newEndDate = value.endDate;
      const newPreset = value.preset;
      
      if (newStartDate && (!startDate || newStartDate.getTime() !== startDate.getTime())) {
        setStartDate(newStartDate);
        setTempStartDate(newStartDate);
        committedRef.current.start = newStartDate;
        setLeftMonth(startOfMonth(newStartDate));
      }
      if (newEndDate && (!endDate || newEndDate.getTime() !== endDate.getTime())) {
        setEndDate(newEndDate);
        setTempEndDate(newEndDate);
        committedRef.current.end = newEndDate;
        if (newStartDate) {
          setRightMonth(startOfMonth(addMonths(newStartDate, 1)));
        } else {
          setRightMonth(startOfMonth(addMonths(newEndDate, 1)));
        }
      }
      if (newPreset && newPreset !== selectedPreset) {
        setSelectedPreset(newPreset);
      }
    }
    // Intentionally only re-sync when the incoming prop values change; adding the
    // internal state here would clobber in-progress user selections.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.startDate, value?.endDate, value?.preset]);

  const handleOpen = (event) => {
    setAnchorEl(event.currentTarget);
    setTempStartDate(startDate);
    setTempEndDate(endDate);
    setStartInput(startDate ? format(startDate, 'dd/MM/yyyy') : '');
    setEndInput(endDate ? format(endDate, 'dd/MM/yyyy') : '');
    setLeftMonth(startOfMonth(startDate || new Date()));
    setRightMonth(startOfMonth(addMonths(startDate || new Date(), 1)));
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  // Inline clear (x) — only for pages that allow an empty range
  const handleClear = (event) => {
    event.stopPropagation();
    setTempStartDate(null);
    setTempEndDate(null);
    commit(null, null, 'custom');
  };

  const handleDateClick = (date) => {
    if (single) {
      setTempStartDate(date);
      setTempEndDate(date);
      commit(date, date, 'custom');
      handleClose();
      return;
    }
    if (!tempStartDate || (tempStartDate && tempEndDate && date < tempStartDate)) {
      // Start new selection
      setTempStartDate(date);
      setTempEndDate(null);
    } else if (tempStartDate && !tempEndDate) {
      // Complete selection — applies immediately (reference has no Done button)
      if (date >= tempStartDate) {
        setTempEndDate(date);
        commit(tempStartDate, date, 'custom');
        handleClose();
      } else {
        setTempStartDate(date);
        setTempEndDate(null);
      }
    } else {
      // Reset selection
      setTempStartDate(date);
      setTempEndDate(null);
    }
  };

  const handleCurrentDay = () => {
    // Whole day, not "now": committing new Date() put the clock time on the range start,
    // so consumers dropped everything earlier today. Every other selection path is midnight-aligned.
    const start = startOfDay(new Date());
    const end = endOfDay(new Date());
    setTempStartDate(start);
    setTempEndDate(end);
    commit(start, end, 'today');
    handleClose();
  };

  // Typed date entry (reference masked input): commit as soon as a full valid date is typed,
  // keeping the popover open. Each end commits on its own — the old rule only published a
  // range once BOTH ends were valid in the same render, so a typed range could stay stuck
  // in this component and the page never filtered by it.
  const handleTypedDate = (which, raw) => {
    if (which === 'start') setStartInput(raw);
    else setEndInput(raw);
    const d = parseTypedDate(raw);
    if (!d) return;
    if (single) {
      setTempStartDate(d);
      setTempEndDate(d);
      setLeftMonth(startOfMonth(d));
      setRightMonth(startOfMonth(addMonths(d, 1)));
      commit(d, d, 'custom');
      return;
    }
    if (which === 'start') {
      setTempStartDate(d);
      setLeftMonth(startOfMonth(d));
      setRightMonth(startOfMonth(addMonths(d, 1)));
    } else {
      setTempEndDate(d);
    }
    const start = which === 'start' ? d : committedRef.current.start;
    const end = which === 'end' ? d : committedRef.current.end;
    // Inverted mid-typing (new start past the old end): hold until the other end catches up.
    if (start && end && end < start) return;
    commit(start, end, 'custom');
  };

  const formatDateRange = () => {
    if (single) return startDate ? format(startDate, enableTime ? 'dd/MM/yyyy HH:mm:ss' : 'dd/MM/yyyy') : '';
    if (!startDate || !endDate) return '';
    // Reference shows a relative label instead of an explicit same-day range
    if (enableTime && selectedPreset === 'today') return 'Today';
    const formatStr = enableTime ? 'dd/MM/yyyy HH:mm:ss' : 'dd/MM/yyyy';
    return `${format(startDate, formatStr)} ${separator} ${format(endDate, formatStr)}`;
  };

  // Apply a time-of-day (HH:mm:ss) onto the committed start/end date
  const handleTimeChange = (which, e) => {
    if (!e.target.value) return; // cleared input -> NaN hours -> Invalid Date crash
    const [h = 0, m = 0, s = 0] = e.target.value.split(':').map(Number);
    const src = which === 'start'
      ? (startDate || tempStartDate || new Date())
      : (endDate || tempEndDate || new Date());
    const d = new Date(src);
    d.setHours(h, m, s, 0);
    const newStart = single || which === 'start' ? d : (startDate || tempStartDate);
    const newEnd = single || which === 'end' ? d : (endDate || tempEndDate);
    setTempStartDate(newStart);
    setTempEndDate(newEnd);
    commit(newStart, newEnd, 'custom');
  };

  const isDateInRange = (date) => {
    if (!tempStartDate) return false;
    if (!tempEndDate) {
      return format(date, 'yyyy-MM-dd') === format(tempStartDate, 'yyyy-MM-dd');
    }
    return isWithinInterval(date, { start: tempStartDate, end: tempEndDate });
  };

  const isDateStart = (date) => {
    return tempStartDate && format(date, 'yyyy-MM-dd') === format(tempStartDate, 'yyyy-MM-dd');
  };

  const isDateEnd = (date) => {
    return tempEndDate && format(date, 'yyyy-MM-dd') === format(tempEndDate, 'yyyy-MM-dd');
  };

  const renderCalendar = (month, isLeft = true) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    // Reference weeks run Monday → Sunday (headers M T W T F S S).
    const startDate = new Date(monthStart);
    startDate.setDate(startDate.getDate() - ((startDate.getDay() + 6) % 7));
    const endDate = new Date(monthEnd);
    endDate.setDate(endDate.getDate() + ((7 - endDate.getDay()) % 7));

    const days = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      days.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return (
      // Both months share the fixed 622px popover width, so day cells (aspect-ratio 1)
      // grow to the reference size instead of shrinking to the digits' intrinsic width.
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Reference: ONE prev chevron far-left + ONE next far-right; both months shift together */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          {isLeft ? (
            <IconButton
              size="small"
              onClick={() => {
                setLeftMonth(addMonths(leftMonth, -1));
                setRightMonth(addMonths(rightMonth, -1));
              }}
            >
              <KeyboardArrowLeft />
            </IconButton>
          ) : (
            <Box sx={{ width: 34 }} />
          )}
          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
            {format(month, 'MMMM yyyy')}
          </Typography>
          {isLeft ? (
            <Box sx={{ width: 34 }} />
          ) : (
            <IconButton
              size="small"
              onClick={() => {
                setLeftMonth(addMonths(leftMonth, 1));
                setRightMonth(addMonths(rightMonth, 1));
              }}
            >
              <KeyboardArrowRight />
            </IconButton>
          )}
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5, mb: 1 }}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
            <Typography key={i} variant="caption" sx={{ textAlign: 'center', fontWeight: 'bold', py: 0.5 }}>
              {day}
            </Typography>
          ))}
        </Box>
        {weeks.map((week, weekIndex) => (
          <Box key={weekIndex} sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
            {week.map((day, dayIndex) => {
              const isInRange = isDateInRange(day);
              const isStart = isDateStart(day);
              const isEnd = isDateEnd(day);
              const isCurrentMonth = isSameMonth(day, month);
              const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

              return (
                <Box
                  key={dayIndex}
                  onClick={() => isCurrentMonth && handleDateClick(day)}
                  sx={{
                    aspectRatio: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: isCurrentMonth ? 'pointer' : 'default',
                    borderRadius: '50%',
                    // Reference: today is circled in blue
                    border: isToday && !(isStart || isEnd) ? '1px solid #0284c7' : '1px solid transparent',
                    bgcolor: isStart || isEnd ? '#2196f3' : isInRange ? '#e3f2fd' : 'transparent',
                    // Reference: day numbers render blue
                    color: isStart || isEnd ? 'white' : isCurrentMonth ? '#0284c7' : 'text.disabled',
                    fontWeight: isStart || isEnd ? 'bold' : 'normal',
                    '&:hover': isCurrentMonth ? {
                      bgcolor: isStart || isEnd ? '#1976d2' : '#bbdefb',
                    } : {},
                  }}
                >
                  <Typography variant="body2">
                    {format(day, 'd')}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    );
  };

  const open = Boolean(anchorEl);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box ref={anchorRef}>
        {splitTrigger ? (
          <Box
            onClick={handleOpen}
            sx={{
              display: 'flex',
              alignItems: 'center',
              // Reference date buttons are 219px inside a 460px field: only the dash
              // (~5px) plus 4px padding and two 6px gaps sit between them.
              gap: 0.75,
              height: 40,
              px: '2px',
              bgcolor: '#fff',
              border: '1px solid #404040',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            {(single ? ['start'] : ['start', 'end']).map((which, i) => {
              const d = which === 'start' ? startDate : endDate;
              return (
                <React.Fragment key={which}>
                  {i > 0 && <Typography sx={{ color: '#676b72' }}>{separator}</Typography>}
                  <Box
                    component="button"
                    type="button"
                    onClick={handleOpen}
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      p: 0,
                      border: 0,
                      bgcolor: 'transparent',
                      font: 'inherit',
                      fontSize: 16,
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: d ? '#000' : '#808080',
                    }}
                  >
                    {d ? format(d, 'dd/MM/yyyy') : 'DD/MM/YYYY'}
                  </Box>
                </React.Fragment>
              );
            })}
            {allowEmpty && (startDate || endDate) ? (
              <IconButton size="small" onMouseDown={(e) => e.stopPropagation()} onClick={handleClear}>
                <Close fontSize="small" />
              </IconButton>
            ) : null}
          </Box>
        ) : (
        <TextField
          fullWidth={fullWidth}
          size={size}
          label={label}
          value={formatDateRange()}
          onClick={handleOpen}
          placeholder={placeholder}
          sx={inputSx}
          InputProps={{
            readOnly: true,
            endAdornment: (
              <>
                {allowEmpty && (startDate || endDate) ? (
                  <IconButton size="small" onMouseDown={(e) => e.stopPropagation()} onClick={handleClear}>
                    <Close fontSize="small" />
                  </IconButton>
                ) : null}
                {hideIcon ? null : (
                  <IconButton size="small" onClick={handleOpen}>
                    <CalendarIcon fontSize="small" />
                  </IconButton>
                )}
              </>
            ),
          }}
        />
        )}
        <Popover
          open={open}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
          PaperProps={{
            sx: {
              // Reference popover: 622 wide, neutral-100 surface, 1px #e5e5e5 border, radius 12, shadow-xl
              p: 2,
              width: 622,
              // Reference popover is 622x463; our segment/calendar block is more compact,
              // so floor the height instead of padding every child to match.
              // ponytail: minHeight (not height) so a 6-week month still never clips.
              ...(enableTime || splitTrigger ? { minHeight: 463 } : {}),
              bgcolor: '#f7f7f7',
              border: '1px solid #e5e5e5',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
            },
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Shortcuts — reference pins 'Current Day' to the top-RIGHT of the popover. */}
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button
                size="small"
                onClick={handleCurrentDay}
                sx={{ textTransform: 'none', fontSize: 14, color: '#313439', p: '2px 8px', minWidth: 0 }}
              >
                Current Day
              </Button>
            </Box>

            {/* Date Input Fields */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {enableTime && <CalendarIcon fontSize="small" sx={{ color: '#676b72' }} />}
              <TextField
                size="small"
                value={startInput}
                onChange={(e) => handleTypedDate('start', e.target.value)}
                placeholder="dd/mm/yyyy"
                sx={{ flex: 1 }}
              />
              {!single && (
                <>
                  {/* Reference: dash between the side-by-side start/end inputs */}
                  <Typography sx={{ color: '#676b72' }}>—</Typography>
                  <TextField
                    size="small"
                    value={endInput}
                    onChange={(e) => handleTypedDate('end', e.target.value)}
                    placeholder="dd/mm/yyyy"
                    sx={{ flex: 1 }}
                  />
                </>
              )}
            </Box>

            {/* Time-of-day narrowing (opt-in) — native hh:mm:ss inputs with their own clock picker */}
            {enableTime && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <ClockIcon fontSize="small" sx={{ color: '#676b72' }} />
                <TextField
                  size="small"
                  type="time"
                  value={startDate ? format(startDate, 'HH:mm:ss') : ''}
                  onChange={(e) => handleTimeChange('start', e)}
                  inputProps={{ step: 1 }}
                  sx={{ flex: 1 }}
                />
                {!single && (
                  <TextField
                    size="small"
                    type="time"
                    value={endDate ? format(endDate, 'HH:mm:ss') : ''}
                    onChange={(e) => handleTimeChange('end', e)}
                    inputProps={{ step: 1 }}
                    sx={{ flex: 1 }}
                  />
                )}
              </Box>
            )}

            {/* Calendar View */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              {renderCalendar(leftMonth, true)}
              {renderCalendar(rightMonth, false)}
            </Box>
          </Box>
        </Popover>
      </Box>
    </LocalizationProvider>
  );
};

export default DateRangePicker;

