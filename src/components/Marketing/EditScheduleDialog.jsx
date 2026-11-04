import React, { useEffect, useState } from 'react';
import { Box, Button, Dialog, DialogContent, IconButton, Typography } from '@mui/material';
import {
  CalendarMonthOutlined as CalendarMonthOutlinedIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon
} from '@mui/icons-material';

// Reference "Edit Schedule" modal (Recurring Promotion ON) - shared by the
// Advanced and Express promotion editors. A schedule is four raw ISO 8601
// strings (anchor = date/time, period + duration = ISO durations e.g. P1W / PT2H).
const emptySchedule = () => ({
  anchorDate: '',
  repeatingPeriod: '',
  timeToStart: '',
  enabledDuration: ''
});

const ordinal = (n) => {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
};

// Monday-first grid of the given month, padded with nulls
const monthGrid = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array(lead).fill(null);
  for (let d = 1; d <= days; d += 1) cells.push(new Date(year, month, d));
  return cells;
};

// Monday-first week containing the given date
const weekGrid = (date) => {
  const start = new Date(date);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
};

const isSameDay = (a, b) => !!a && !!b
  && a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

/**
 * @param open        boolean
 * @param value       the promotion's saved schedule (or null)
 * @param onClose     () => void
 * @param onContinue  (schedule) => void
 */
const EditScheduleDialog = ({ open, value, onClose, onContinue }) => {
  const [preview, setPreview] = useState('Month');
  const [draft, setDraft] = useState(emptySchedule());
  const [month, setMonth] = useState(() => new Date());

  // Re-seed from the saved schedule every time the modal opens.
  useEffect(() => {
    if (!open) return;
    setDraft({ ...emptySchedule(), ...(value || {}) });
    const anchor = value?.anchorDate ? new Date(value.anchorDate) : new Date();
    setMonth(Number.isNaN(anchor.getTime()) ? new Date() : anchor);
  }, [open, value]);

  const isMonth = preview === 'Month';
  const week = weekGrid(month);
  const fmtDay = (d) => `${ordinal(d.getDate())} ${d.toLocaleString('en-AU', { month: 'short' })} ${d.getFullYear()}`;
  const title = isMonth
    ? month.toLocaleString('en-AU', { month: 'short', year: 'numeric' })
    : `${fmtDay(week[0])} - ${fmtDay(week[6])}`;
  const step = (dir) =>
    setMonth((prev) =>
      isMonth
        ? new Date(prev.getFullYear(), prev.getMonth() + dir, 1)
        : new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7 * dir)
    );
  const today = new Date();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{ sx: { width: 820, maxWidth: '96vw', borderRadius: 0, overflow: 'visible', mt: 10 } }}
    >
      {/* Reference: a 120px blue "?" badge sits over the top edge of the modal. */}
      <Box
        sx={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          bgcolor: '#2f8fe0',
          color: '#f8f8f8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 72,
          fontWeight: 400,
          position: 'absolute',
          top: -60,
          left: 'calc(50% - 60px)'
        }}
      >
        ?
      </Box>
      <DialogContent sx={{ pt: 8, px: 2, pb: 2 }}>
        <Typography sx={{ fontSize: 20, fontWeight: 700, textAlign: 'center', mb: 2 }}>
          Edit Schedule
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'stretch' }}>
          {/* Left: preview switch, ISO note, the four schedule fields */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 14, color: '#313439', mb: 0.5 }}>Preview</Typography>
            {/* Segmented Month | Week control: grey track, sky active half with white text */}
            <Box sx={{ display: 'flex', bgcolor: '#e8e8e8', borderRadius: '4px', p: 0, mb: 2 }}>
              {['Month', 'Week'].map((mode) => {
                const on = preview === mode;
                return (
                  <Button
                    key={mode}
                    disableRipple
                    onClick={() => setPreview(mode)}
                    startIcon={<CalendarMonthOutlinedIcon sx={{ fontSize: '18px !important' }} />}
                    sx={{
                      flex: 1,
                      height: 50,
                      textTransform: 'none',
                      fontSize: 16,
                      fontWeight: 700,
                      borderRadius: '4px',
                      boxShadow: 'none',
                      bgcolor: on ? '#3fb0ea' : 'transparent',
                      color: on ? '#fff' : '#313439',
                      '&:hover': { bgcolor: on ? '#2ea3e0' : '#dedede', boxShadow: 'none' }
                    }}
                  >
                    {mode}
                  </Button>
                );
              })}
            </Box>
            <Typography sx={{ fontSize: 16, color: '#313439', mb: 2 }}>
              The values must be formatted as an{' '}
              <Box
                component="a"
                href="https://en.wikipedia.org/wiki/ISO_8601"
                target="_blank"
                rel="noreferrer"
                sx={{ color: '#2f6fe0', textDecoration: 'underline' }}
              >
                ISO 8601
              </Box>{' '}
              value
            </Typography>
            {[
              ['Anchor Date', 'anchorDate'],
              ['Repeating Period', 'repeatingPeriod'],
              ['Time to Start (optional)', 'timeToStart'],
              ['Enabled Duration', 'enabledDuration']
            ].map(([label, key]) => (
              // Reference field: placeholder inside; the caption appears above only
              // while focused or filled (focus-within keeps this stateless).
              <Box
                key={key}
                sx={{
                  mb: 2,
                  '& .sched-label': { display: draft[key] ? 'block' : 'none' },
                  '&:focus-within .sched-label': { display: 'block' },
                  '&:focus-within .sched-input': { borderColor: '#000', borderWidth: 2 }
                }}
              >
                <Typography className="sched-label" sx={{ fontSize: 14, color: '#313439', mb: '2px' }}>
                  {label}
                </Typography>
                <Box
                  component="input"
                  className="sched-input"
                  type="text"
                  placeholder={label}
                  value={draft[key]}
                  onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                  sx={{
                    width: '100%',
                    height: 42,
                    boxSizing: 'border-box',
                    px: '14px',
                    border: '1px solid #404040',
                    borderRadius: '8px',
                    outline: 'none',
                    fontFamily: 'inherit',
                    fontSize: 16,
                    color: '#000',
                    bgcolor: '#fff',
                    '&::placeholder': { color: '#808080', opacity: 1 }
                  }}
                />
              </Box>
            ))}
          </Box>

          <Box sx={{ width: '1px', bgcolor: '#d4d4d4', alignSelf: 'stretch' }} />

          {/* Right: calendar preview - month grid, or a week grid with hour lines */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 1.5 }}>
              <IconButton size="small" disableRipple onClick={() => step(-1)} sx={{ color: '#313439' }}>
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
              <Typography sx={{ fontSize: 16, color: '#313439' }}>{title}</Typography>
              <IconButton size="small" disableRipple onClick={() => step(1)} sx={{ color: '#313439' }}>
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            </Box>
            {isMonth ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', columnGap: '8px', rowGap: '8px' }}>
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
                  <Typography key={d} sx={{ fontSize: 16, textAlign: 'center', color: '#313439' }}>{d}</Typography>
                ))}
                {monthGrid(month).map((day, i) => (
                  <Box
                    key={day ? day.toISOString() : `pad-${i}`}
                    sx={{
                      height: 40,
                      pt: '4px',
                      textAlign: 'center',
                      fontSize: 12,
                      color: '#313439',
                      borderRadius: '2px',
                      bgcolor: day ? (isSameDay(day, today) ? '#cfe8f9' : '#e8e8e8') : 'transparent'
                    }}
                  >
                    {day ? ordinal(day.getDate()) : ''}
                  </Box>
                ))}
              </Box>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr) 44px', columnGap: '4px' }}>
                {week.map((d) => (
                  <Typography
                    key={d.toISOString()}
                    sx={{
                      fontSize: 16,
                      textAlign: 'center',
                      pb: '4px',
                      borderBottom: '1px solid #d4d4d4',
                      color: isSameDay(d, today) ? '#2f8fe0' : '#313439'
                    }}
                  >
                    {d.toLocaleString('en-AU', { weekday: 'short' })}
                  </Typography>
                ))}
                <Box />
                {/* 2-hour bands 00:00 .. 24:00; the label sits at each band's lower edge */}
                {Array.from({ length: 12 }, (_, row) => (
                  <React.Fragment key={row}>
                    {week.map((d) => (
                      <Box
                        key={`${row}-${d.toISOString()}`}
                        sx={{ height: 26, borderBottom: '1px solid #e5e5e5', borderLeft: '1px solid #f0f0f0' }}
                      />
                    ))}
                    <Typography sx={{ fontSize: 11, color: '#313439', textAlign: 'right', lineHeight: '26px', mt: '13px', height: 26 }}>
                      {`${String((row + 1) * 2).padStart(2, '0')}:00`}
                    </Typography>
                  </React.Fragment>
                ))}
              </Box>
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <Button
            disableRipple
            onClick={onClose}
            sx={{
              flex: 1,
              height: 50,
              borderRadius: '2px',
              textTransform: 'none',
              fontSize: 28,
              fontWeight: 400,
              bgcolor: '#f1f1f1',
              border: '1px solid #c9c9c9',
              color: '#555',
              '&:hover': { bgcolor: '#e4e4e4' }
            }}
          >
            Cancel
          </Button>
          <Button
            disableRipple
            onClick={() => onContinue({ ...draft })}
            sx={{
              flex: 1,
              height: 50,
              borderRadius: '2px',
              textTransform: 'none',
              fontSize: 28,
              fontWeight: 400,
              bgcolor: '#2f8fe0',
              color: '#fff',
              '&:hover': { bgcolor: '#2679bd' }
            }}
          >
            Continue
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default EditScheduleDialog;
