import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  FormControl,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Chip,
  Popover,
  TextField,
  IconButton,
} from '@mui/material';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import {
  InfoOutlined,
  CalendarTodayOutlined,
  AccessTimeOutlined,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  Close,
} from '@mui/icons-material';
import { format, parse, isValid, addMonths, startOfMonth, endOfMonth, isSameMonth, isSameDay } from 'date-fns';
import securityReportService from '../../services/securityReportService';

// Reference chart uses the Chart.js default palette, assigned by slice order
const CHART_PALETTE = [
  'rgb(54,162,235)',
  'rgb(255,99,132)',
  'rgb(255,159,64)',
  'rgb(255,205,86)',
  'rgb(75,192,192)',
  'rgb(153,102,255)',
  'rgb(201,203,207)',
];

// Reference date-range popover tokens
const SKY = '#0284c7';            // oklch(0.588 0.158 241.966) — in-month day numbers
const SKY_SELECTED = '#0ea5e9';   // oklch(0.685 0.169 237.323) — selected day chip
const NEUTRAL = '#6b6b6b';        // oklch(0.439 0 0) — month titles / preset button
const DT_FORMAT = 'dd-MMM-yyyy hh:mm:ss a';   // 30-Jul-2026 12:00:00 AM
const TRIGGER_FORMAT = 'dd/MM/yyyy HH:mm:ss'; // trigger always shows the literal pair
const DAY_HEADS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const iconToggleSx = (active) => ({
  width: 25,
  height: 24,
  p: 0,
  borderRadius: '8px',
  color: active ? SKY : NEUTRAL,
  bgcolor: active ? 'rgba(2,132,199,0.12)' : 'transparent',
  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
});

const dtInputSx = {
  width: 254,
  '& .MuiOutlinedInput-root': {
    height: 36,
    borderRadius: '8px',
    bgcolor: '#fff',
    fontFamily: '"Roboto Mono", ui-monospace, monospace',
    fontSize: 12,
    pr: '4px',
  },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
  '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
};

const dayCellSx = (inMonth, selected, inRange) => ({
  width: 38,
  height: 38,
  mx: 'auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 0,
  p: 0,
  font: 'inherit',
  fontSize: 16,
  fontWeight: 700,
  borderRadius: '12px',
  cursor: inMonth ? 'pointer' : 'default',
  bgcolor: selected ? SKY_SELECTED : inRange ? 'rgba(14,165,233,0.12)' : 'transparent',
  color: selected ? '#fff' : inMonth ? SKY : 'rgba(107,107,107,0.5)',
  '&:hover': inMonth ? { bgcolor: selected ? SKY_SELECTED : 'rgba(0,0,0,0.05)' } : {},
});

// Reference date-range control: a bordered pill holding two independent datetime buttons,
// opening a 622px popover whose calendar/clock icons SWAP the panel between date and time.
// ponytail: page-local (not the shared DateRangePicker) so the other report pages keep their trigger.
const SecurityDateRange = ({ value, onChange }) => {
  const pillRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [focusEnd, setFocusEnd] = useState('start');
  const [mode, setMode] = useState('date');
  const [month, setMonth] = useState(startOfMonth(value.startDate || new Date()));
  const [monthPicker, setMonthPicker] = useState(null);
  const [pickerYear, setPickerYear] = useState((value.startDate || new Date()).getFullYear());
  const [draft, setDraft] = useState({ start: null, end: null });

  const endValue = (which) => (which === 'start' ? value.startDate : value.endDate);
  const commit = (start, end) => {
    setDraft({ start: null, end: null });
    onChange({ startDate: start, endDate: end, preset: 'custom' });
  };

  const openPicker = (which) => {
    setFocusEnd(which);
    setMode('date');
    setMonthPicker(null);
    setMonth(startOfMonth(endValue(which) || new Date()));
    setDraft({ start: null, end: null });
    setOpen(true);
  };

  const handleTyped = (which, raw) => {
    setDraft((d) => ({ ...d, [which]: raw }));
    const parsed = parse(raw, DT_FORMAT, new Date());
    if (!isValid(parsed)) return;
    commit(which === 'start' ? parsed : value.startDate, which === 'end' ? parsed : value.endDate);
  };

  const clearEnd = (which) => {
    setDraft((d) => ({ ...d, [which]: null }));
    onChange({
      startDate: which === 'start' ? null : value.startDate,
      endDate: which === 'end' ? null : value.endDate,
      preset: 'custom',
    });
  };

  const handleTime = (which, raw) => {
    if (!raw) return; // cleared input -> NaN hours -> Invalid Date
    const [h = 0, m = 0, s = 0] = raw.split(':').map(Number);
    const d = new Date(endValue(which) || new Date());
    d.setHours(h, m, s, 0);
    commit(which === 'start' ? d : value.startDate, which === 'end' ? d : value.endDate);
  };

  const handleCurrentDay = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    commit(start, end);
    setOpen(false);
  };

  const pickDay = (day) => {
    const base = endValue(focusEnd);
    const d = new Date(day);
    if (base) d.setHours(base.getHours(), base.getMinutes(), base.getSeconds(), 0);
    else d.setHours(focusEnd === 'start' ? 0 : 23, focusEnd === 'start' ? 0 : 59, focusEnd === 'start' ? 0 : 59, 0);
    if (focusEnd === 'start') {
      commit(d, value.endDate && value.endDate < d ? d : value.endDate);
      setFocusEnd('end');
    } else {
      commit(value.startDate && d < value.startDate ? d : value.startDate, d);
      setOpen(false);
    }
  };

  const inputValue = (which) => {
    if (draft[which] !== null) return draft[which];
    const d = endValue(which);
    return d ? format(d, DT_FORMAT) : '';
  };

  const renderDays = (m) => {
    const first = startOfMonth(m);
    const gridStart = new Date(first);
    gridStart.setDate(gridStart.getDate() - ((gridStart.getDay() + 6) % 7)); // Monday-first
    const gridEnd = new Date(endOfMonth(m));
    gridEnd.setDate(gridEnd.getDate() + ((7 - gridEnd.getDay()) % 7));

    const days = [];
    for (const cur = new Date(gridStart); cur <= gridEnd; cur.setDate(cur.getDate() + 1)) {
      days.push(new Date(cur));
    }

    return (
      <>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', justifyItems: 'center', mb: 0.5 }}>
          {DAY_HEADS.map((d, i) => (
            <Typography key={i} sx={{ fontSize: 12, fontWeight: 700, color: NEUTRAL }}>{d}</Typography>
          ))}
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', justifyItems: 'center', rowGap: 0.25 }}>
          {days.map((day, i) => {
            const inMonth = isSameMonth(day, m);
            const selected =
              (value.startDate && isSameDay(day, value.startDate)) ||
              (value.endDate && isSameDay(day, value.endDate));
            const inRange =
              !selected &&
              value.startDate &&
              value.endDate &&
              day > value.startDate &&
              day < value.endDate;
            return (
              <Box
                component="button"
                type="button"
                key={i}
                onClick={() => inMonth && pickDay(day)}
                sx={dayCellSx(inMonth, Boolean(inMonth && selected), Boolean(inMonth && inRange))}
              >
                {format(day, 'd')}
              </Box>
            );
          })}
        </Box>
      </>
    );
  };

  const renderMonthPicker = (side) => (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <IconButton size="small" sx={{ color: SKY }} onClick={() => setPickerYear((y) => y - 1)}>
          <KeyboardArrowLeft />
        </IconButton>
        <Typography sx={{ fontSize: 18, fontWeight: 700, color: NEUTRAL }}>{pickerYear}</Typography>
        <IconButton size="small" sx={{ color: SKY }} onClick={() => setPickerYear((y) => y + 1)}>
          <KeyboardArrowRight />
        </IconButton>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5 }}>
        {MONTH_NAMES.map((name, idx) => (
          <Box
            component="button"
            type="button"
            key={name}
            onClick={() => {
              setMonth(startOfMonth(new Date(pickerYear, side === 0 ? idx : idx - 1, 1)));
              setMonthPicker(null);
            }}
            sx={{
              height: 38,
              border: 0,
              bgcolor: 'transparent',
              font: 'inherit',
              fontSize: 16,
              fontWeight: 700,
              color: SKY,
              borderRadius: '12px',
              cursor: 'pointer',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
            }}
          >
            {name.slice(0, 3)}
          </Box>
        ))}
      </Box>
    </Box>
  );

  const renderMonth = (m, side) => (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        {side === 0 ? (
          <IconButton size="small" sx={{ color: SKY }} onClick={() => setMonth(addMonths(month, -1))}>
            <KeyboardArrowLeft />
          </IconButton>
        ) : (
          <Box sx={{ width: 34 }} />
        )}
        <Box
          component="button"
          type="button"
          onClick={() => {
            setPickerYear(m.getFullYear());
            setMonthPicker(monthPicker === side ? null : side);
          }}
          sx={{
            border: 0,
            bgcolor: 'transparent',
            font: 'inherit',
            fontSize: 18,
            fontWeight: 700,
            color: NEUTRAL,
            borderRadius: '8px',
            px: 1,
            cursor: 'pointer',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
          }}
        >
          {format(m, 'MMMM yyyy')}
        </Box>
        {side === 1 ? (
          <IconButton size="small" sx={{ color: SKY }} onClick={() => setMonth(addMonths(month, 1))}>
            <KeyboardArrowRight />
          </IconButton>
        ) : (
          <Box sx={{ width: 34 }} />
        )}
      </Box>
      {monthPicker === side ? renderMonthPicker(side) : renderDays(m)}
    </Box>
  );

  return (
    <>
      <Box
        ref={pillRef}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.5,
          width: 388,
          height: 42,
          bgcolor: '#fff',
          border: '1px solid #404040',
          borderRadius: '8px',
        }}
      >
        {['start', 'end'].map((which, i) => (
          <React.Fragment key={which}>
            {i > 0 && <Typography sx={{ color: '#000', fontSize: 16 }}>&ndash;</Typography>}
            <Box
              component="button"
              type="button"
              onClick={() => openPicker(which)}
              sx={{
                width: 183,
                height: 40,
                border: 0,
                bgcolor: 'transparent',
                p: '8px 16px',
                font: 'inherit',
                fontSize: 16,
                fontWeight: 400,
                color: '#000',
                textAlign: 'left',
                cursor: 'default',
              }}
            >
              {endValue(which) ? format(endValue(which), TRIGGER_FORMAT) : TRIGGER_FORMAT}
            </Box>
          </React.Fragment>
        ))}
      </Box>
      <Popover
        open={open}
        anchorEl={pillRef.current}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        transitionDuration={0}
        elevation={0}
        PaperProps={{
          sx: {
            width: 622,
            minHeight: 463,
            p: 2,
            bgcolor: '#fff',
            border: '1px solid #e5e5e5',
            borderRadius: '12px',
            boxShadow: 'none',
          },
        }}
      >
        {/* Row 1: two combined datetime inputs, each with its own clear (x) */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
          {['start', 'end'].map((which, i) => (
            <React.Fragment key={which}>
              {i > 0 && <Typography sx={{ color: NEUTRAL }}>&ndash;</Typography>}
              <TextField
                size="small"
                value={inputValue(which)}
                placeholder={DT_FORMAT}
                onFocus={() => setFocusEnd(which)}
                onChange={(e) => handleTyped(which, e.target.value)}
                sx={dtInputSx}
                InputProps={{
                  endAdornment: (
                    <IconButton size="small" sx={{ color: NEUTRAL }} onClick={() => clearEnd(which)}>
                      <Close sx={{ fontSize: 14 }} />
                    </IconButton>
                  ),
                }}
              />
            </React.Fragment>
          ))}
        </Box>

        {/* Row 2: calendar/clock panel toggle + Current Day preset */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <IconButton sx={iconToggleSx(mode === 'date')} onClick={() => setMode('date')}>
            <CalendarTodayOutlined sx={{ fontSize: 16 }} />
          </IconButton>
          <IconButton sx={iconToggleSx(mode === 'time')} onClick={() => setMode('time')}>
            <AccessTimeOutlined sx={{ fontSize: 16 }} />
          </IconButton>
          <Box sx={{ flex: 1 }} />
          <Button
            onClick={handleCurrentDay}
            sx={{
              width: 107,
              height: 42,
              borderRadius: '12px',
              fontSize: 16,
              fontWeight: 700,
              textTransform: 'none',
              color: NEUTRAL,
              '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
            }}
          >
            Current Day
          </Button>
        </Box>

        {mode === 'time' ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, py: 6 }}>
            {['start', 'end'].map((which) => (
              <TextField
                key={which}
                size="small"
                type="time"
                inputProps={{ step: 1 }}
                value={endValue(which) ? format(endValue(which), 'HH:mm:ss') : ''}
                onChange={(e) => handleTime(which, e.target.value)}
                sx={dtInputSx}
              />
            ))}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 2 }}>
            {renderMonth(month, 0)}
            {renderMonth(addMonths(month, 1), 1)}
          </Box>
        )}
      </Popover>
    </>
  );
};

// Reference filter options: multi-select, grouped by category (empty selection = all events)
const EVENT_TYPE_OPTIONS = [
  'Login',
  'Location Change',
  'Open Drawer',
  'Clear Data',
  'Integrated Application',
  'Revoked Integration',
  'User Created',
  'User Modified',
  'User Deleted',
  'Training Mode',
  'Removed Product',
  'Cancelled Sale',
  'Customer Loyalty Modified',
  'Billing Plan Updated',
  'Billing Payment Updated',
  'Trial Data Modified',
];

// ReportTable-style headers (blue #5ebbeb / near-white / 16px bold uppercase)
const tableHeadSx = {
  '& th': {
    backgroundColor: '#5ebbeb',
    color: '#f8f8f8',
    fontWeight: 700,
    fontSize: 16,
    textTransform: 'uppercase',
    padding: '8px',
    borderBottom: 'none',
  },
};
const bodyRowSx = (index) => ({
  bgcolor: index % 2 === 0 ? '#fff' : '#f8f8f8',
  '& td': {
    color: '#000',
    fontSize: 16,
    padding: '8px 8px 8px 10px',
    borderBottom: 'none',
  },
});
// Reference "More" action: gray 16px bold radius-12 h42 button, hover = 5% black tint (no underline)
const moreButtonSx = {
  color: '#6b6b6b',
  fontSize: 16,
  fontWeight: 700,
  borderRadius: '12px',
  height: 42,
  minWidth: 0,
  px: 2,
  textTransform: 'none',
  '&:hover': { backgroundColor: 'rgba(0,0,0,0.05)' },
};
// Reference dialog header: light-blue bar + info icon, blue 18px title
const dialogTitleSx = {
  backgroundColor: '#cbe9f7',
  color: '#0284c7',
  fontSize: 18,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  gap: 1,
};
// Reference footer "Done": gray bg, black text, radius12, fw700, h42
const doneButtonSx = {
  backgroundColor: '#d6d6d6',
  color: '#000',
  borderRadius: '12px',
  fontWeight: 700,
  height: 42,
  textTransform: 'none',
  boxShadow: 'none',
  '&:hover': { backgroundColor: '#c4c4c4', boxShadow: 'none' },
};

// Chart.js default tooltip: dark translucent rounded box, bold title, swatch + "Name: 84" body
const ChartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const slice = payload[0].payload;
  return (
    <Box sx={{ bgcolor: 'rgba(0,0,0,0.8)', borderRadius: '6px', px: 1, py: 0.75, color: '#fff' }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.5 }}>{slice.name}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box sx={{ width: 12, height: 12, bgcolor: slice.color, border: '1px solid #fff' }} />
        <Typography sx={{ fontSize: 12 }}>{`${slice.name}: ${slice.value}`}</Typography>
      </Box>
    </Box>
  );
};

const SecurityCentre = () => {
  const [searchParams] = useSearchParams();

  // Initialize state from URL params if available, otherwise use defaults
  const getInitialState = () => {
    const savedSelectedEventType = searchParams.get('selectedEventType');
    const savedStartDate = searchParams.get('startDate');
    const savedEndDate = searchParams.get('endDate');

    const today = new Date();
    let parsedStartDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    let parsedEndDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    if (savedStartDate) {
      parsedStartDate = new Date(savedStartDate);
      if (isNaN(parsedStartDate.getTime())) {
        parsedStartDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
      }
    }

    if (savedEndDate) {
      parsedEndDate = new Date(savedEndDate);
      if (isNaN(parsedEndDate.getTime())) {
        parsedEndDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
      }
    }

    return {
      // Empty array = all events (reference behaviour); round-trip comma-joined saved filter
      selectedEventTypes:
        savedSelectedEventType && savedSelectedEventType !== 'all'
          ? savedSelectedEventType.split(',').filter(Boolean)
          : [],
      dateRange: (savedStartDate || savedEndDate) ? {
        preset: 'custom',
        startDate: parsedStartDate,
        endDate: parsedEndDate,
      } : {
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        // 'custom' (not 'today') so the datetime trigger renders the full range with seconds
        // instead of collapsing to the relative "Today" label — matches the reference.
        preset: 'custom',
      },
    };
  };

  const initialState = getInitialState();

  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState({
    rawEventsCount: 0,
    patternsCount: 0,
    eventTypeDistribution: [],
  });
  const [events, setEvents] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [selectedEventTypes, setSelectedEventTypes] = useState(initialState.selectedEventTypes);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedPattern, setSelectedPattern] = useState(null);
  const [hiddenSeries, setHiddenSeries] = useState([]);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [patternDialogOpen, setPatternDialogOpen] = useState(false);

  const [dateRange, setDateRange] = useState(initialState.dateRange);

  const loadData = async () => {
    // A cleared end of the range means "not a range yet" — wait for it to be filled in again.
    if (!dateRange.startDate || !dateRange.endDate) return;
    try {
      setLoading(true);
      const startDate = dateRange.startDate.toISOString();
      const endDate = dateRange.endDate.toISOString();

      // Load statistics
      const stats = await securityReportService.getStatistics(startDate, endDate);
      setStatistics(stats);

      // Fetch all events; the multi-select filters client-side (reference: empty = all)
      const eventsData = await securityReportService.getEvents(startDate, endDate, 'all');
      setEvents(eventsData?.data || []);

      // Load patterns
      const patternsData = await securityReportService.getPatterns(startDate, endDate);
      setPatterns(patternsData?.data || []);
    } catch (error) {
      console.error('Error loading security data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Ensure we load data on mount, especially when URL params are present
    loadData();
  }, [dateRange]);

  // Also trigger load when URL params change
  useEffect(() => {
    const hasParams = searchParams.toString().length > 0;
    if (hasParams) {
      // Small delay to ensure state is fully initialized from URL params
      const timer = setTimeout(() => {
        loadData();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  const filteredEvents =
    selectedEventTypes.length === 0
      ? events
      : events.filter((e) => selectedEventTypes.includes(e.eventType));

  const handleEventClick = async (eventId) => {
    try {
      const eventDetails = await securityReportService.getEventDetails(eventId);
      setSelectedEvent(eventDetails);
      setEventDialogOpen(true);
    } catch (error) {
      console.error('Error loading event details:', error);
    }
  };

  const handlePatternClick = async (patternId) => {
    try {
      const patternDetails = await securityReportService.getPatternDetails(patternId);
      setSelectedPattern(patternDetails);
      setPatternDialogOpen(true);
    } catch (error) {
      console.error('Error loading pattern details:', error);
    }
  };

  const formatDateTime = (dateTime) => {
    if (!dateTime) return 'N/A';
    return format(new Date(dateTime), 'dd/MM/yyyy HH:mm:ss');
  };

  const formatDateRange = (start, end) => {
    if (!start || !end) return 'N/A';
    return `${formatDateTime(start)} - ${formatDateTime(end)}`;
  };

  const pieChartData = statistics.eventTypeDistribution.map((item, index) => ({
    name: item.eventType,
    value: item.count,
    color: CHART_PALETTE[index % CHART_PALETTE.length],
  }));
  const visibleSlices = pieChartData.filter((d) => !hiddenSeries.includes(d.name));

  const toggleSeries = (name) =>
    setHiddenSeries((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );

  return (
      <Box sx={{ p: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 81, mb: 2 }}>
          <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: '#000' }}>
            Security Centre
          </Typography>
          <SecurityDateRange value={dateRange} onChange={(newRange) => setDateRange(newRange)} />
        </Box>

        {/* Summary panel: legend + pie + counts centred as one group (reference layout) */}
        <Paper
          elevation={0}
          sx={{
            bgcolor: '#f7f7f7',
            borderRadius: '12px',
            p: 4,
            mb: 2,
            minHeight: 364,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          {pieChartData.length > 0 ? (
            <>
              {/* Custom legend: black labels, 12x12 swatches, click toggles the slice */}
              <Box component="ul" sx={{ listStyle: 'none', pl: 2, m: 0 }}>
                {pieChartData.map((entry) => {
                  const hidden = hiddenSeries.includes(entry.name);
                  return (
                    <Box
                      component="li"
                      key={entry.name}
                      onClick={() => toggleSeries(entry.name)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        height: 19,
                        cursor: 'pointer',
                      }}
                    >
                      <Box sx={{ width: 12, height: 12, bgcolor: entry.color, flexShrink: 0 }} />
                      <Typography
                        sx={{
                          fontSize: 16,
                          color: '#000',
                          textDecoration: hidden ? 'line-through' : 'none',
                        }}
                      >
                        {entry.name}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
              <PieChart width={300} height={300}>
                <Pie
                  data={visibleSlices}
                  cx={150}
                  cy={150}
                  labelLine={false}
                  outerRadius={125}
                  dataKey="value"
                  stroke="none"
                >
                  {visibleSlices.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </>
          ) : (
            <Typography variant="body2" color="textSecondary">
              No events in selected date range
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 6 }}>
            <Box>
              <Typography sx={{ color: '#676b72', fontSize: 16 }}>Raw Events</Typography>
              <Typography sx={{ fontWeight: 'bold', fontSize: 40 }}>
                {statistics.rawEventsCount}
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ color: '#676b72', fontSize: 16 }}>Patterns Detected</Typography>
              <Typography sx={{ fontWeight: 'bold', fontSize: 40 }}>
                {statistics.patternsCount}
              </Typography>
            </Box>
          </Box>
        </Paper>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Patterns Section */}
        <Paper sx={{ mb: 3 }}>
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
              Patterns
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={tableHeadSx}>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Pattern</TableCell>
                    <TableCell>Users</TableCell>
                    <TableCell>Device</TableCell>
                    <TableCell align="right">More</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {patterns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        No patterns found for the selected date range
                      </TableCell>
                    </TableRow>
                  ) : (
                    patterns.map((pattern, index) => (
                      <TableRow key={pattern.id} sx={bodyRowSx(index)}>
                        <TableCell>
                          {formatDateRange(pattern.startTimestamp, pattern.endTimestamp)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={pattern.patternType}
                            color={pattern.severity === 'high' ? 'error' : pattern.severity === 'medium' ? 'warning' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{pattern.user?.name || 'N/A'}</TableCell>
                        <TableCell>{pattern.deviceName || 'N/A'}</TableCell>
                        <TableCell align="right">
                          <Button onClick={() => handlePatternClick(pattern.id)} sx={moreButtonSx}>
                            More
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Paper>

        {/* Events Section */}
        <Paper>
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                Events
              </Typography>
              <FormControl
                size="small"
                sx={{
                  minWidth: 220,
                  '& .MuiOutlinedInput-root': { borderRadius: '8px', bgcolor: '#fff' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
                  '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
                }}
              >
                <Select
                  multiple
                  displayEmpty
                  value={selectedEventTypes}
                  onChange={(e) =>
                    setSelectedEventTypes(
                      typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value
                    )
                  }
                  renderValue={(selected) =>
                    selected.length === 0 ? (
                      <span style={{ color: '#808080' }}>Filters</span>
                    ) : (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((val) => (
                          <Chip key={val} label={val} size="small" />
                        ))}
                      </Box>
                    )
                  }
                >
                  {EVENT_TYPE_OPTIONS.map((type) => (
                    <MenuItem key={type} value={type}>
                      <Checkbox checked={selectedEventTypes.indexOf(type) > -1} />
                      <ListItemText primary={type} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={tableHeadSx}>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Event</TableCell>
                    <TableCell>User</TableCell>
                    <TableCell>Outlet</TableCell>
                    <TableCell>Register</TableCell>
                    <TableCell>Device</TableCell>
                    <TableCell align="right">More</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredEvents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        No events found for the selected date range
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEvents.map((event, index) => (
                      <TableRow key={event.id} sx={bodyRowSx(index)}>
                        <TableCell>{formatDateTime(event.timestamp)}</TableCell>
                        <TableCell>
                          {event.eventSubType
                            ? `${event.eventType} (${event.eventSubType})`
                            : event.eventType}
                        </TableCell>
                        <TableCell>{event.user?.name || 'N/A'}</TableCell>
                        <TableCell>{event.outlet?.name || 'N/A'}</TableCell>
                        <TableCell>{event.register?.name || 'N/A'}</TableCell>
                        <TableCell>{event.deviceName || 'N/A'}</TableCell>
                        <TableCell align="right">
                          <Button onClick={() => handleEventClick(event.id)} sx={moreButtonSx}>
                            More
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Paper>

        {/* Event Details Dialog */}
        <Dialog open={eventDialogOpen} onClose={() => setEventDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle sx={dialogTitleSx}>
            <InfoOutlined sx={{ color: '#0284c7' }} />
            Security Event Details
          </DialogTitle>
          <DialogContent>
            {selectedEvent && (
              <Box sx={{ mt: 1 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">Event Type</Typography>
                    <Typography variant="body1">{selectedEvent.eventType}</Typography>
                  </Grid>
                  {selectedEvent.eventSubType && (
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="textSecondary">Event Sub Type</Typography>
                      <Typography variant="body1">{selectedEvent.eventSubType}</Typography>
                    </Grid>
                  )}
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">Timestamp</Typography>
                    <Typography variant="body1">{formatDateTime(selectedEvent.timestamp)}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">User</Typography>
                    <Typography variant="body1">{selectedEvent.user?.name || 'N/A'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">Outlet</Typography>
                    <Typography variant="body1">{selectedEvent.outlet?.name || 'N/A'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">Register</Typography>
                    <Typography variant="body1">{selectedEvent.register?.name || 'N/A'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">Device</Typography>
                    <Typography variant="body1">{selectedEvent.deviceName || 'N/A'}</Typography>
                  </Grid>
                  {selectedEvent.deviceIp && (
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="textSecondary">Device IP</Typography>
                      <Typography variant="body1">{selectedEvent.deviceIp}</Typography>
                    </Grid>
                  )}
                  {selectedEvent.metadata && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="textSecondary">Metadata</Typography>
                      <Typography variant="body1" component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                        {JSON.stringify(selectedEvent.metadata, null, 2)}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button variant="contained" onClick={() => setEventDialogOpen(false)} sx={doneButtonSx}>
              Done
            </Button>
          </DialogActions>
        </Dialog>

        {/* Pattern Details Dialog */}
        <Dialog open={patternDialogOpen} onClose={() => setPatternDialogOpen(false)} maxWidth="lg" fullWidth>
          <DialogTitle sx={dialogTitleSx}>
            <InfoOutlined sx={{ color: '#0284c7' }} />
            Security Pattern Details
          </DialogTitle>
          <DialogContent>
            {selectedPattern && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                  Pattern Details
                </Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">Pattern Type</Typography>
                    <Typography variant="body1">
                      <Chip
                        label={selectedPattern.patternType}
                        color={selectedPattern.severity === 'high' ? 'error' : selectedPattern.severity === 'medium' ? 'warning' : 'default'}
                        size="small"
                        sx={{ mr: 1 }}
                      />
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">Device</Typography>
                    <Typography variant="body1">{selectedPattern.deviceName || 'N/A'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">First Event Time</Typography>
                    <Typography variant="body1">{formatDateTime(selectedPattern.startTimestamp)}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">First Event User</Typography>
                    <Typography variant="body1">{selectedPattern.user?.name || 'N/A'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">Last Event Time</Typography>
                    <Typography variant="body1">{formatDateTime(selectedPattern.endTimestamp)}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">Last Event User</Typography>
                    <Typography variant="body1">{selectedPattern.user?.name || 'N/A'}</Typography>
                  </Grid>
                  {selectedPattern.description && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="textSecondary">Description</Typography>
                      <Typography variant="body1">{selectedPattern.description}</Typography>
                    </Grid>
                  )}
                </Grid>

                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, mt: 3 }}>
                  Pattern Events
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={tableHeadSx}>
                        <TableCell>Timestamp</TableCell>
                        <TableCell>Event</TableCell>
                        <TableCell>User</TableCell>
                        <TableCell>Outlet</TableCell>
                        <TableCell>Register</TableCell>
                        <TableCell>Device</TableCell>
                        <TableCell align="right">More</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedPattern.events?.map((patternEvent, index) => {
                        const event = patternEvent.event;
                        return (
                          <TableRow key={event.id} sx={bodyRowSx(index)}>
                            <TableCell>{formatDateTime(event.timestamp)}</TableCell>
                            <TableCell>
                              {event.eventSubType
                                ? `${event.eventType} (${event.eventSubType})`
                                : event.eventType}
                            </TableCell>
                            <TableCell>{event.user?.name || 'N/A'}</TableCell>
                            <TableCell>{event.outlet?.name || 'N/A'}</TableCell>
                            <TableCell>{event.register?.name || 'N/A'}</TableCell>
                            <TableCell>{event.deviceName || 'N/A'}</TableCell>
                            <TableCell align="right">
                              <Button onClick={() => handleEventClick(event.id)} sx={moreButtonSx}>
                                More
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button variant="contained" onClick={() => setPatternDialogOpen(false)} sx={doneButtonSx}>
              Done
            </Button>
          </DialogActions>
        </Dialog>

      </Box>
  );
};

export default SecurityCentre;
