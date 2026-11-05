import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogContent, IconButton, Snackbar, Typography } from '@mui/material';
import {
  CalendarMonthOutlined as CalendarMonthOutlinedIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Anchor as AnchorIcon,
  WarningAmberOutlined as WarningIcon
} from '@mui/icons-material';
import DateTimeField from '../Common/DateTimeField';
import { toZonedDate, zonedInstant } from '../../utils/dateFormat';
import { validateSchedule, parseAnchor, formatAnchor, occurrencesBetween, FIELD_ORDER } from '../../utils/promotionSchedule';

// Reference "Edit Schedule" modal (Recurring Promotion ON) - shared by the
// Advanced and Express promotion editors. Rules measured on the live reference
// 05/11/2026 are documented in utils/promotionSchedule.js.
const emptySchedule = () => ({
  anchorDate: '',
  repeatingPeriod: '',
  timeToStart: '',
  enabledDuration: ''
});

const FIELDS = [
  ['Anchor Date', 'anchorDate'],
  ['Repeating Period', 'repeatingPeriod'],
  ['Time to Start (optional)', 'timeToStart'],
  ['Enabled Duration', 'enabledDuration']
];

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
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
};

const isSameDay = (a, b) => !!a && !!b
  && a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayEnd = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

const ROW_H = 26; // px per 2-hour band -> 13px per hour
const GRID_H = ROW_H * 12;
const pxOf = (date, day) => ((date.getTime() - dayStart(day).getTime()) / 3600000) * (ROW_H / 2);

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
  const [toast, setToast] = useState('');
  // Reference (05/11/2026): the anchor is read as UTC - "04/11/2026 00:00:00" sits at 05:30 on an IST browser.
  const timeZone = 'UTC';

  // Re-seed from the saved schedule every time the modal opens.
  useEffect(() => {
    if (!open) return;
    const seeded = { ...emptySchedule(), ...(value || {}) };
    setDraft(seeded);
    const anchor = parseAnchor(seeded.anchorDate, timeZone);
    setMonth(anchor || new Date());
    setToast('');
  }, [open, value, timeZone]);

  const v = validateSchedule(draft, timeZone);
  const invalidIndex = v.invalid ? FIELD_ORDER.indexOf(v.invalid) : -1;
  const hiddenAfterInvalid = (key) => invalidIndex >= 0 && FIELD_ORDER.indexOf(key) > invalidIndex;

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

  // Occurrences overlapping the visible range (browser local time).
  const visibleFrom = isMonth ? new Date(month.getFullYear(), month.getMonth(), 1) : dayStart(week[0]);
  const visibleTo = isMonth ? new Date(month.getFullYear(), month.getMonth() + 1, 1) : dayEnd(week[6]);
  const occurrences = occurrencesBetween(draft, timeZone, visibleFrom, visibleTo);
  const anchor = v.anchor;
  const dayHasOccurrence = (d) => occurrences.some((o) => o.start < dayEnd(d) && o.end > dayStart(d));
  // Per-day bar segments for the week grid, clipped to the day.
  const segmentsFor = (d) => occurrences
    .filter((o) => o.start < dayEnd(d) && o.end > dayStart(d))
    .map((o) => {
      const s = o.start > dayStart(d) ? o.start : dayStart(d);
      const e = o.end < dayEnd(d) ? o.end : dayEnd(d);
      return { top: pxOf(s, d), height: Math.max(2, pxOf(e, d) - pxOf(s, d)), joint: o.start < dayStart(d) };
    });

  const handleChange = (key, text) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: text };
      // Reference: a field that fails to parse blanks the fields after it.
      const check = validateSchedule(next, timeZone);
      if (check.invalid) {
        const at = FIELD_ORDER.indexOf(check.invalid);
        FIELD_ORDER.forEach((k, i) => { if (i > at) next[k] = ''; });
      }
      return next;
    });
  };
  // Anchor Date uses the app's DateTimeField (user 05/11/2026): the picker's
  // wall clock is read as STORE-zone time and stored as "DD/MM/YYYY HH:mm:ss".
  const anchorPickerValue = v.anchor ? toZonedDate(v.anchor, timeZone) : null;
  const handleAnchorPick = (d) => {
    if (!d || Number.isNaN(d.getTime())) { setDraft((prev) => ({ ...prev, anchorDate: '' })); return; }
    const instant = zonedInstant(timeZone, d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
    setDraft((prev) => ({ ...prev, anchorDate: formatAnchor(instant, timeZone) }));
    setMonth(instant);
  };
  const handleAnchorBlur = () => {
    const d = parseAnchor(draft.anchorDate, timeZone);
    if (d) {
      setDraft((prev) => ({ ...prev, anchorDate: formatAnchor(d, timeZone) }));
      setMonth(d);
    }
  };

  const handleContinue = () => {
    // Reference toast order with everything blank: Repeating Period first.
    const missing = [
      ['repeatingPeriod', 'Please enter a Repeating Period value'],
      ['anchorDate', 'Please enter an Anchor Date value'],
      ['enabledDuration', 'Please enter an Enabled Duration value']
    ].find(([k]) => !String(draft[k] || '').trim());
    if (missing) { setToast(missing[1]); return; }
    if (v.invalid) {
      const label = FIELDS.find(([, k]) => k === v.invalid)?.[0]?.replace(' (optional)', '');
      setToast(`Please enter a valid ${label} value`);
      return;
    }
    onContinue({ ...draft });
  };

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
          {/* Left: warning, preview switch, ISO note, the four schedule fields */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {v.warning && (
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '6px', color: '#b3261e', mb: 1 }}>
                <WarningIcon sx={{ fontSize: 20, mt: '1px' }} />
                <Typography sx={{ fontSize: 16, lineHeight: 1.2 }}>
                  Repeating Period must be longer than Time to Start and Enabled Duration combined
                </Typography>
              </Box>
            )}
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
            {FIELDS.map(([label, key]) => {
              const bad = v.invalid === key;
              const shown = hiddenAfterInvalid(key) ? '' : draft[key];
              if (key === 'anchorDate') {
                return (
                  <Box key={key} sx={{ mb: 2, position: 'relative', pt: anchorPickerValue ? '18px' : 0 }}>
                    <DateTimeField
                      value={anchorPickerValue}
                      onChange={handleAnchorPick}
                      placeholder="Anchor Date"
                      label="Anchor Date"
                      sx={{ '& input': { fontSize: 16 } }}
                    />
                  </Box>
                );
              }
              return (
                // Reference field: placeholder inside; the caption appears above only
                // while focused or filled; red once the value does not parse.
                <Box
                  key={key}
                  sx={{
                    mb: 2,
                    // The caption fades / slides in on focus or once filled (smooth, user 05/11/2026).
                    '& .sched-label': {
                      opacity: shown ? 1 : 0,
                      transform: shown ? 'translateY(0)' : 'translateY(10px)',
                      transition: 'opacity 160ms ease, transform 160ms ease'
                    },
                    '&:focus-within .sched-label': { opacity: 1, transform: 'translateY(0)' },
                    '&:focus-within .sched-input': { borderColor: '#000', borderWidth: 2 }
                  }}
                >
                  <Typography className="sched-label" sx={{ fontSize: 14, lineHeight: '18px', height: 18, color: bad ? '#e33430' : '#313439', mb: '2px', pointerEvents: 'none' }}>
                    {label}
                  </Typography>
                  <Box
                    component="input"
                    className="sched-input"
                    type="text"
                    placeholder={label}
                    value={shown}
                    onChange={(e) => handleChange(key, e.target.value)}
                    onBlur={key === 'anchorDate' ? handleAnchorBlur : undefined}
                    // Enter / Tab leave the box, which redisplays a valid anchor as "DD/MM/YYYY HH:mm:ss"
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
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
              );
            })}
          </Box>

          <Box sx={{ width: '1px', bgcolor: '#d4d4d4', alignSelf: 'stretch' }} />

          {/* Right: calendar preview - month grid, or a week grid with hour lines */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 1.5 }}>
              <IconButton size="small" disableRipple onClick={() => step(-1)} sx={{ color: '#313439', '&.Mui-focusVisible': { outline: 'none' } }}>
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
              <Typography sx={{ fontSize: 16, color: '#313439' }}>{title}</Typography>
              <IconButton size="small" disableRipple onClick={() => step(1)} sx={{ color: '#313439', '&.Mui-focusVisible': { outline: 'none' } }}>
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            </Box>
            {isMonth ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', columnGap: '8px', rowGap: '8px', overflow: 'hidden' }}>
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
                  <Typography key={d} sx={{ fontSize: 16, textAlign: 'center', color: '#313439' }}>{d}</Typography>
                ))}
                {monthGrid(month).map((day, i) => {
                  const on = day && dayHasOccurrence(day);
                  const prevOn = day && day.getDate() > 1 && dayHasOccurrence(new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1));
                  const nextOn = day && dayHasOccurrence(new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1));
                  return (
                    <Box
                      key={day ? day.toISOString() : `pad-${i}`}
                      sx={{
                        position: 'relative',
                        height: 40,
                        pt: '4px',
                        textAlign: 'center',
                        fontSize: 12,
                        color: '#313439',
                        borderRadius: '2px',
                        bgcolor: day ? (isSameDay(day, today) ? '#cfe8f9' : '#e8e8e8') : 'transparent'
                      }}
                    >
                      <Box component="span" sx={{ color: '#313439 !important' }}>{day ? ordinal(day.getDate()) : ''}</Box>
                      {/* Reference: green underline on every day an occurrence touches, run
                          edge to edge so consecutive days read as one bar. */}
                      {on && (
                        <Box sx={{
                          position: 'absolute',
                          top: 20,
                          height: 3,
                          bgcolor: '#2eb85c',
                          borderRadius: '2px',
                          left: prevOn && i % 7 !== 0 ? -8 : 4,
                          right: nextOn && i % 7 !== 6 ? -8 : 4
                        }} />
                      )}
                      {anchor && isSameDay(anchor, day) && (
                        <AnchorIcon sx={{ position: 'absolute', left: 'calc(50% - 8px)', top: 22, fontSize: 16, color: '#313439' }} />
                      )}
                    </Box>
                  );
                })}
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
                {/* 2-hour bands 00:00 .. 24:00 with the occurrence bars laid over each day */}
                {week.map((d) => (
                  <Box key={`col-${d.toISOString()}`} sx={{ position: 'relative', height: GRID_H, borderLeft: '1px solid #f0f0f0' }}>
                    {Array.from({ length: 12 }, (_, row) => (
                      <Box key={row} sx={{ height: ROW_H, borderBottom: '1px solid #e5e5e5' }} />
                    ))}
                    {segmentsFor(d).map((seg, i) => (
                      <Box
                        key={i}
                        sx={{
                          position: 'absolute',
                          left: 'calc(50% - 4px)',
                          width: 8,
                          top: seg.top,
                          height: seg.height,
                          bgcolor: '#2eb85c',
                          borderRadius: '4px'
                        }}
                      >
                        {/* joint dot where an occurrence continues into the next day */}
                        {!seg.joint && seg.top > 0 && null}
                      </Box>
                    ))}
                    {anchor && isSameDay(anchor, d) && (
                      <AnchorIcon sx={{ position: 'absolute', left: 'calc(50% + 4px)', top: pxOf(anchor, d) - 8, fontSize: 16, color: '#313439' }} />
                    )}
                  </Box>
                ))}
                <Box sx={{ position: 'relative', height: GRID_H }}>
                  {Array.from({ length: 12 }, (_, row) => (
                    <Typography key={row} sx={{ position: 'absolute', right: 0, top: (row + 1) * ROW_H - 8, fontSize: 11, color: '#313439' }}>
                      {`${String((row + 1) * 2).padStart(2, '0')}:00`}
                    </Typography>
                  ))}
                  <Typography sx={{ position: 'absolute', right: 0, top: -8, fontSize: 11, color: '#313439' }}>00:00</Typography>
                </Box>
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
            onClick={handleContinue}
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

      {/* The app's standard top-centre popup (same as the editors' save messages). */}
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setToast('')} severity="error" sx={{ width: '100%' }}>
          {toast}
        </Alert>
      </Snackbar>
    </Dialog>
  );
};

export default EditScheduleDialog;
