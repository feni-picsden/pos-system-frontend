import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  TextField,
  Autocomplete,
  FormControlLabel,
  Tooltip,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import AddScheduleDialog from '../../components/Surcharges/AddScheduleDialog';
import SelectRegistersDialog from '../../components/Surcharges/SelectRegistersDialog';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import { surchargeService } from '../../services/surchargeService';
import registerService from '../../services/registerService';
import outletService from '../../services/outletService';
import settingsService from '../../services/settingsService';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import { useSelectedRegister } from '../../contexts/SelectedRegisterContext';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';
import { byMode } from '../../theme/sfPalette';

// Dark-mode colours (light values = what the page used before).
const TXT = byMode('#000000', '#f8f8f8');
const PAGE = byMode('#f5f5f5', '#121212');
const PANE = byMode('white', '#232323');
const ROW_RULE = byMode('1px solid #e0e0e0', '1px solid #373737');

const DAYS_OF_WEEK = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY'
];

// Generate time slots from 00:00 to 23:00
const TIME_SLOTS = [];
for (let hour = 0; hour < 24; hour++) {
  TIME_SLOTS.push(`${hour.toString().padStart(2, '0')}:00`);
}

const scheduleActiveKey = (registerId) => `surcharge_schedule_active_${registerId}`;

const Surcharging = () => {
  // In-app dialogs — these shadow window.alert/confirm/prompt on purpose.
  const { alert, notify } = useAppDialogs();
  const { user, getOutletId } = useAuth();
  const { selectedOutletId } = useSelectedOutlet() || {};
  const { selectedRegister: navRegister } = useSelectedRegister();
  const [schedules, setSchedules] = useState({}); // Store schedules by day
  const [registers, setRegisters] = useState([]);
  const [selectedRegister, setSelectedRegister] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [scheduleActive, setScheduleActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [openSaveTo, setOpenSaveTo] = useState(false);
  const [savingTo, setSavingTo] = useState(false);
  // Draft state (reference: changes live on the page until "Save")
  const [dirty, setDirty] = useState(false);
  const [deletedIds, setDeletedIds] = useState([]);
  const [saving, setSaving] = useState(false);
  // "Save to..." targets: every register in every outlet, even when the navbar
  // scopes this page to one outlet (apiClient would otherwise filter the list).
  const [allRegisters, setAllRegisters] = useState([]);
  const openSaveToDialog = async () => {
    try {
      const res = await apiClient.get('/registers', { params: { isActive: true }, skipOutletScope: true });
      setAllRegisters(res.data?.registers || []);
    } catch (err) {
      console.error('Error loading registers for Save to:', err);
      setAllRegisters(registers);
    }
    setOpenSaveTo(true);
  };

  // Outlet scoping: the admin flag alone is not enough — an outlet-pinned admin
  // is scoped to their own outlet, same rule as the backend's canAccessAllOutlets.
  const isSuperAdmin =
    (user?.isSuperAdmin === true || user?.hasAllPermission === true) && !user?.outletId;
  // Outlet rule: navbar "All Outlets" = registers grouped by outlet; a navbar outlet
  // = only its registers (apiClient scopes the list), no outlet headers.
  const globalMode = isSuperAdmin && !selectedOutletId;
  // Register rule (same idea): a navbar outlet AND register pin this page to that
  // register — the selector is hidden and its calendar opens straight away.
  const pinnedRegisterId = !globalMode && navRegister?.id ? Number(navRegister.id) : null;

  useEffect(() => {
    (async () => {
      // Superadmin: load outlets so registers can be grouped under outlet headers
      if (isSuperAdmin) {
        try {
          const resp = await outletService.getAllOutlets();
          setOutlets(resp?.outlets || resp || []);
        } catch (err) {
          console.error('Error loading outlets for superadmin:', err);
          setOutlets([]);
        }
      }

      try {
        // Superadmin gets every register (grouped by outlet); others get their outlet's
        const registersList = await registerService.list({ isActive: true });
        // ponytail: DB can hold duplicate rows with the same register name in an
        // outlet - dedupe by name so the selector never shows duplicate labels
        const seen = new Set();
        const deduped = (registersList || []).filter((r) => {
          const key = `${r.outletId}:${(r.name || '').trim().toLowerCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setRegisters(deduped);
      } catch (err) {
        console.error('Error loading registers:', err);
        setRegisters([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pinned register (navbar outlet + register): select it as soon as the list has it;
  // leaving the pin clears the selection so the selector comes back.
  useEffect(() => {
    if (pinnedRegisterId) {
      const match = registers.find((r) => r.id === pinnedRegisterId);
      setSelectedRegister(match || null);
    } else if (selectedRegister && !registers.some((r) => r.id === selectedRegister.id)) {
      setSelectedRegister(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinnedRegisterId, registers]);

  // Reference "Save to...": copy this register's calendar to other registers.
  // Each target register's own schedules are replaced by copies of this
  // register's schedules (the surcharge record is reused in the same outlet, or
  // matched by name / created in another outlet) and its Schedule Active toggle
  // is switched off.
  const handleSaveTo = async (targetRegisterIds) => {
    if (!selectedRegister?.id || !targetRegisterIds.length) return;
    try {
      setSavingTo(true);
      const sourceOutletId = selectedRegister.outletId || null;
      const source = await surchargeService.getSchedulesForRegister(selectedRegister.id);
      const sourceSchedules = (source?.schedules || source || []).filter((sch) => sch.surcharge);
      const targets = allRegisters.filter((r) => targetRegisterIds.includes(r.id));
      // Surcharge record to use per (target outlet, source surcharge)
      const surchargeFor = async (outletId, surcharge) => {
        if (!outletId || outletId === sourceOutletId || surcharge.outletId == null) return surcharge.id;
        const existing = await surchargeService.getSurchargesByOutlet(outletId);
        const hit = (existing?.surcharges || []).find((s) => s.outletId === outletId && s.name === surcharge.name);
        if (hit) return hit.id;
        const created = await surchargeService.createSurcharge({
          name: surcharge.name,
          appliesTo: surcharge.appliesTo || 'All Products',
          surchargeType: surcharge.surchargeType || 'Percentage',
          surchargeAmount: surcharge.surchargeAmount,
          // Backend validates taxRateId as an optional int — null is rejected, so omit it.
          ...(surcharge.taxRateId ? { taxRateId: surcharge.taxRateId } : {}),
          isActive: true,
          categoryIds: surcharge.categoryIds || [],
          tagIds: surcharge.tagIds || [],
          outletId,
        });
        return created?.surcharge?.id || created?.id;
      };
      for (const target of targets) {
        // Override: drop the target register's own schedules (legacy outlet-wide rows stay).
        const current = await surchargeService.getSchedulesForRegister(target.id);
        for (const sch of current?.schedules || current || []) {
          if (sch.registerId === target.id) await surchargeService.deleteSchedule(sch.id);
        }
        const idCache = new Map();
        for (const sch of sourceSchedules) {
          // A legacy outlet-wide row already shows on a same-outlet target.
          if (sch.registerId == null && target.outletId === sourceOutletId) continue;
          if (!idCache.has(sch.surcharge.id)) idCache.set(sch.surcharge.id, await surchargeFor(target.outletId, sch.surcharge));
          await surchargeService.createSchedule({
            surchargeId: idCache.get(sch.surcharge.id),
            registerId: target.id,
            dayOfWeek: sch.dayOfWeek,
            startTime: sch.startTime,
            endTime: sch.endTime,
            isActive: true,
          });
        }
      }
      // Reference: the copy lands inactive on every selected register.
      for (const r of targets) {
        await settingsService.updateSetting(scheduleActiveKey(r.id), false, 'surcharges', 'Surcharge schedule active state for register');
      }
      setOpenSaveTo(false);
      notify?.(`Surcharge calendar saved to ${targets.length} register${targets.length === 1 ? '' : 's'}`, 'success');
    } catch (err) {
      console.error('Error saving calendar to registers:', err);
      alert(err?.response?.data?.error || 'Failed to save the calendar to the selected registers');
    } finally {
      setSavingTo(false);
    }
  };

  // Browser close / refresh with unsaved changes → native "leave page?" prompt.
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // silent = refresh after Save: keep the calendar on screen (no spinner flicker).
  const loadSchedules = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setDirty(false);
      setDeletedIds([]);

      // Initialize empty schedule structure
      const emptySchedules = {};
      DAYS_OF_WEEK.forEach(day => {
        emptySchedules[day] = [];
      });

      if (selectedRegister?.id) {
        // Load schedules from API based on selected register
        const response = await surchargeService.getSchedulesForRegister(selectedRegister.id);
        const apiSchedules = response?.schedules || response || [];

        apiSchedules.forEach(schedule => {
          const dayKey = (schedule.dayOfWeek || '').toUpperCase();
          if (DAYS_OF_WEEK.includes(dayKey)) {
            emptySchedules[dayKey].push(schedule);
          }
        });
      }

      setSchedules(emptySchedules);
    } catch (err) {
      console.error('Error loading schedules:', err);
      setSchedules({});
    } finally {
      setLoading(false);
    }
  }, [selectedRegister]);

  useEffect(() => {
    if (!selectedRegister?.id) {
      setScheduleActive(false);
      return;
    }
    loadSchedules();
    // Schedule Active is persisted server-side per register (general settings)
    (async () => {
      try {
        const resp = await settingsService.getSetting(scheduleActiveKey(selectedRegister.id));
        setScheduleActive(resp?.setting?.value === true);
      } catch {
        setScheduleActive(false);
      }
    })();
  }, [selectedRegister, loadSchedules]);

  // Reference: the calendar is a DRAFT — Add / Modify / Remove and the Schedule
  // Active toggle only change the page; "Save" (bottom right) writes everything to
  // the server. Leaving without Save drops the changes.
  const handleScheduleActiveChange = (event) => {
    if (!selectedRegister?.id) return;
    setScheduleActive(event.target.checked);
    setDirty(true);
  };

  const handleAddSchedule = (day) => {
    setSelectedDay(day);
    setEditingSchedule(null);
    setOpenDialog(true);
  };

  // Remove = drop from the draft; a saved row is deleted on Save.
  const handleDeleteSchedule = (schedule) => {
    if (!schedule) return;
    if (!String(schedule.id).startsWith('tmp-')) setDeletedIds((prev) => [...prev, schedule.id]);
    setSchedules((prev) => {
      const next = {};
      Object.entries(prev).forEach(([day, rows]) => { next[day] = rows.filter((r) => r.id !== schedule.id); });
      return next;
    });
    setDirty(true);
    setOpenDialog(false);
    setSelectedDay(null);
    setEditingSchedule(null);
  };

  // Add / Update = upsert into the draft (no API call until Save).
  const handleScheduleSaved = (scheduleData) => {
    if (!selectedRegister?.id) {
      alert('Please select a register before creating a surcharge.');
      return;
    }
    const dayKey = String(scheduleData.dayOfWeek || '').toUpperCase();
    const draft = {
      id: editingSchedule?.id || `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      registerId: selectedRegister.id,
      dayOfWeek: scheduleData.dayOfWeek,
      startTime: scheduleData.startTime,
      endTime: scheduleData.endTime,
      isActive: true,
      _dirty: true,
      surcharge: {
        id: editingSchedule?.surcharge?.id || editingSchedule?.surchargeId || null,
        name: scheduleData.surchargeName,
        appliesTo: scheduleData.appliesTo || 'All Products',
        surchargeType: scheduleData.surchargeType || 'Percentage',
        surchargeAmount: scheduleData.surchargeAmount,
        taxRateId: scheduleData.taxRate || null,
        categoryIds: scheduleData.categoryIds || [],
        tagIds: scheduleData.tagIds || [],
      },
    };
    setSchedules((prev) => {
      const next = {};
      DAYS_OF_WEEK.forEach((d) => { next[d] = (prev[d] || []).filter((r) => r.id !== draft.id); });
      next[dayKey] = [...(next[dayKey] || []), draft];
      return next;
    });
    setDirty(true);
    setOpenDialog(false);
    setSelectedDay(null);
    setEditingSchedule(null);
  };

  // "Save": write the draft — deleted rows, new/changed surcharges + schedules,
  // and the Schedule Active toggle — then reload from the server.
  const handleSaveAll = async () => {
    if (!selectedRegister?.id) return;
    try {
      setSaving(true);
      let outletId = selectedRegister?.outletId || null;
      if (!outletId && !isSuperAdmin) outletId = await getOutletId();
      for (const id of deletedIds) await surchargeService.deleteSchedule(id);
      // Surcharge records are per outlet and unique by name: reuse by name, else create.
      let outletSurcharges = null;
      const surchargeIdFor = async (sur) => {
        const payload = {
          name: sur.name,
          appliesTo: sur.appliesTo || 'All Products',
          surchargeType: sur.surchargeType || 'Percentage',
          surchargeAmount: sur.surchargeAmount,
          taxRateId: sur.taxRateId || null,
          categoryIds: sur.categoryIds || [],
          tagIds: sur.tagIds || [],
          ...(outletId ? { outletId } : {}),
        };
        if (sur.id) { await surchargeService.updateSurcharge(sur.id, payload); return sur.id; }
        if (!outletSurcharges) outletSurcharges = (await surchargeService.getSurchargesByOutlet(outletId))?.surcharges || [];
        const hit = outletSurcharges.find((s) => s.outletId === outletId && s.name === sur.name);
        if (hit) { await surchargeService.updateSurcharge(hit.id, payload); return hit.id; }
        // Backend validates taxRateId as an optional int — null is rejected, so omit it.
        const { taxRateId, ...rest } = payload;
        const created = await surchargeService.createSurcharge({ ...rest, ...(taxRateId ? { taxRateId } : {}), isActive: true });
        const newId = created?.surcharge?.id || created?.id;
        outletSurcharges.push({ id: newId, name: sur.name, outletId });
        return newId;
      };
      for (const rows of Object.values(schedules)) {
        for (const row of rows) {
          if (!row._dirty) continue;
          const surchargeId = await surchargeIdFor(row.surcharge || {});
          const payload = { surchargeId, registerId: selectedRegister.id, dayOfWeek: row.dayOfWeek, startTime: row.startTime, endTime: row.endTime, isActive: true };
          if (String(row.id).startsWith('tmp-')) await surchargeService.createSchedule(payload);
          else await surchargeService.updateSchedule(row.id, payload);
        }
      }
      await settingsService.updateSetting(scheduleActiveKey(selectedRegister.id), scheduleActive, 'surcharges', 'Surcharge schedule active state for register');
      setDeletedIds([]);
      setDirty(false);
      await loadSchedules(true);
      notify?.('Surcharge schedule saved', 'success', { position: 'top' });
    } catch (err) {
      console.error('Error saving surcharge schedule:', err);
      alert(err?.response?.data?.error || 'Failed to save the surcharge schedule');
    } finally {
      setSaving(false);
    }
  };

  const getSchedulesForDay = (day) => {
    return schedules[day] || [];
  };

  const outletNameFor = (register) =>
    outlets.find((o) => o.id === register?.outletId)?.name ||
    user?.outlet?.name ||
    'Registers';

  const registerOptions = [...registers].sort((a, b) => {
    const groupCompare = outletNameFor(a).localeCompare(outletNameFor(b));
    if (groupCompare !== 0) return groupCompare;
    return (a.name || '').localeCompare(b.name || '');
  });

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: PAGE }}>
      {/* Header */}
      <Box sx={{
        p: 2,
        bgcolor: PANE,
        borderBottom: ROW_RULE,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Typography sx={{ fontSize: 32, fontWeight: 700, color: TXT }}>
            Surcharging
          </Typography>

          {/* Legend */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{ width: 24, height: 5, bgcolor: '#16a34a', borderRadius: '2px' }} />
              <Typography sx={{ fontSize: 16, color: TXT }}>All Products</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              {/* Dashed amber swatch (two dashes, like the reference) */}
              <Box sx={{ width: 24, height: 0, borderTop: '5px dashed #d97706' }} />
              <Typography sx={{ fontSize: 16, color: TXT }}>Limited</Typography>
            </Box>
          </Box>
        </Box>

        {/* Reference: register selector with the Schedule Active toggle stacked under it */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
          {pinnedRegisterId ? (
            // Navbar outlet + register: this page is pinned to that register (no selector).
            <Typography sx={{ fontSize: 18, fontWeight: 600, color: TXT, height: 42, display: 'flex', alignItems: 'center' }}>
              {selectedRegister?.name || navRegister?.name}
            </Typography>
          ) : (
          <Autocomplete
            options={registerOptions}
            groupBy={globalMode ? (option) => outletNameFor(option) : undefined}
            getOptionLabel={(option) => option?.name || ''}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            value={selectedRegister}
            onChange={(e, value) => {
              // Reference: unsaved calendar changes are lost when leaving the register.
              if (dirty && !window.confirm('You have unsaved surcharge changes. Leave without saving?')) return;
              setSelectedRegister(value);
            }}
            size="small"
            disableClearable
            sx={{ width: 300 }}
            slotProps={{
              paper: {
                sx: {
                  mt: 0.5,
                  border: byMode('1px solid #000000', '1px solid #a1a1a1'),
                  borderRadius: '8px',
                  boxShadow: 'none',
                  bgcolor: byMode(undefined, '#232323'),
                  // Reference rows: tall, divided, light-blue hover/selected
                  '& .MuiAutocomplete-option': {
                    minHeight: 56,
                    fontSize: 16,
                    color: TXT,
                    borderBottom: ROW_RULE,
                    '&:last-of-type': { borderBottom: 'none' },
                    '&.Mui-focused, &[aria-selected="true"], &[aria-selected="true"].Mui-focused': { bgcolor: byMode('#7fd3f7', '#0084d1'), color: byMode(undefined, '#fafafa') },
                  },
                },
              },
            }}
            renderGroup={(params) => (
              <li key={params.key}>
                <Box sx={{ px: 2, py: 1.25, fontWeight: 700, fontSize: 16, color: TXT, borderBottom: ROW_RULE }}>
                  {params.group}
                </Box>
                <ul style={{ padding: 0, margin: 0 }}>{params.children}</ul>
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Select..."
                inputProps={{ ...params.inputProps, autoComplete: 'off' }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    height: 42,
                    borderRadius: '8px',
                    bgcolor: byMode(undefined, '#121212'),
                    '& fieldset': { borderColor: byMode('#454545', '#a1a1a1'), borderWidth: 1 },
                    '&:hover fieldset': { borderColor: byMode('#454545', '#a1a1a1') },
                    '&.Mui-focused fieldset': { borderColor: byMode('#000000', '#2b7fff'), borderWidth: 2 },
                  },
                  '& input::placeholder': { color: byMode('#808080', '#757575'), opacity: 1 },
                }}
              />
            )}
          />
          )}

          {/* Schedule Active Toggle (disabled until a register is selected) */}
          <FormControlLabel
            control={
              <ShopfrontSwitch
                checked={scheduleActive}
                onChange={handleScheduleActiveChange}
                disabled={!selectedRegister}
              />
            }
            label="Schedule Active"
            sx={{
              color: TXT,
              gap: 1,
              ml: 0,
              '& .MuiSwitch-root:has(.Mui-disabled)': { cursor: 'not-allowed' },
            }}
          />
        </Box>
      </Box>

      {/* Select-a-register info banner */}
      {!selectedRegister && (
        // Reference: rounded light-blue box with a blue border and an "i" icon
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          bgcolor: byMode('#e3f3fb', '#0c3a55'),
          border: byMode('1px solid #7cc3ea', '1px solid #1d6a94'),
          borderRadius: '8px',
          mx: 2,
          mt: 2,
          px: 2.5,
          py: 2,
        }}>
          <Typography sx={{ color: byMode('#1a73b8', '#74d4ff'), fontSize: 20, fontWeight: 700, fontFamily: 'Georgia, serif', lineHeight: 1 }}>i</Typography>
          <Typography sx={{ fontSize: 14, color: byMode('#1a4f7a', '#74d4ff') }}>
            Please select a register above.
          </Typography>
        </Box>
      )}

      {/* Warning Banner */}
      {selectedRegister && !scheduleActive && (
        // Reference: rounded pale-yellow box with a yellow border and a bold "!"
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          bgcolor: byMode('#fdf3c4', '#433a10'),
          border: byMode('1px solid #f0c419', '1px solid #a68a1c'),
          borderRadius: '8px',
          mx: 2,
          mt: 2,
          px: 2.5,
          py: 2,
        }}>
          <Typography sx={{ color: byMode('#d19a00', '#ffd230'), fontSize: 20, fontWeight: 700, lineHeight: 1 }}>!</Typography>
          <Typography sx={{ fontSize: 14, color: byMode('#7a5a00', '#fff085') }}>
            The schedule is not currently active, you&apos;ll need to enable it before any surcharge will take affect
          </Typography>
        </Box>
      )}

      {/* Main Schedule Grid (hidden until a register is chosen) */}
      <Box sx={{ flex: 1, overflow: 'auto', bgcolor: PAGE, p: 2 }}>
        {selectedRegister && (loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <CircularProgress />
        </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            {DAYS_OF_WEEK.map((day) => (
              <Box
                key={day}
                sx={{
                  // Reference: the 7 day columns share the page width evenly (no
                  // horizontal scroll at desktop widths).
                  flex: '1 1 0',
                  minWidth: 200,
                  border: byMode('2px solid #000000', '2px solid #a1a1a1'),
                  borderRadius: '8px',
                  bgcolor: PANE,
                  overflow: 'hidden',
                }}
              >
                {/* Day Header */}
                <Box sx={{
                  p: 1.5,
                  bgcolor: PANE,
                  borderBottom: byMode('1px solid #000000', '1px solid #a1a1a1'),
                  textAlign: 'center'
                }}>
                  <Typography sx={{ fontSize: 24, fontWeight: 700, color: TXT, mb: 1 }}>
                    {day}
                  </Typography>
                  <Button
                    startIcon={<AddIcon />}
                    onClick={() => handleAddSchedule(day)}
                    sx={{
                      bgcolor: 'transparent',
                      border: byMode('1px solid #8a8a8a', '1px solid #a1a1a1'),
                      color: byMode('#6e6e6e', '#d4d4d4'),
                      height: 42,
                      px: 2.5,
                      fontSize: 16,
                      fontWeight: 700,
                      borderRadius: '12px',
                      textTransform: 'none',
                      transition: 'none',
                      '&:hover': {
                        bgcolor: byMode('rgba(0,0,0,0.05)', 'rgba(255,255,255,0.08)'),
                        border: byMode('1px solid #8a8a8a', '1px solid #a1a1a1'),
                      },
                    }}
                  >
                    Add Schedule
                  </Button>
                </Box>

                {/* Time Slots */}
                <Box sx={{
                  minHeight: 600,
                  position: 'relative',
                  bgcolor: PANE
                }}>
                  {/* Time rows */}
                  {TIME_SLOTS.map((timeSlot, index) => {
                    const isEven = index % 2 === 0;
                    return (
                      <Box
                        key={timeSlot}
                      sx={{
                        height: 48, // reference: 48px per hour
                          borderBottom: ROW_RULE,
                        display: 'flex',
                        alignItems: 'center',
                        px: 1,
                          bgcolor: isEven ? byMode('#fafafa', '#2a2a2a') : PANE,
                        }}
                      >
                        <Typography
                          sx={{
                            color: byMode('#64748b', '#a0a4aa'),
                            fontSize: 16,
                            minWidth: 48
                          }}
                        >
                          {timeSlot}
                        </Typography>
                    </Box>
                    );
                  })}

                  {/* Continuous surcharge lines for this day */}
                  {getSchedulesForDay(day).map((schedule, lineIndex) => {
                    if (!schedule.startTime || !schedule.endTime ||
                        schedule.startTime === '--:--' || schedule.endTime === '--:--') {
                      return null;
                    }

                    const [startHour, startMin] = schedule.startTime.split(':').map(Number);
                    const [endHour, endMin] = schedule.endTime.split(':').map(Number);
                    const startMinutes = startHour * 60 + (startMin || 0);
                    const endMinutes = endHour * 60 + (endMin || 0);
                    const totalMinutes = 24 * 60;

                    if (endMinutes <= startMinutes) {
                      return null;
                    }

                    const topPercent = (startMinutes / totalMinutes) * 100;
                    const heightPercent = ((endMinutes - startMinutes) / totalMinutes) * 100;

                    // Determine color based on surcharge's appliesTo field
                    const surchargeAppliesTo = schedule.surcharge?.appliesTo || schedule.appliesTo || 'All Products';
                    const isAllProducts = surchargeAppliesTo === 'All Products';
                    // Reference hover card: "00:00 - 23:59 / <name> / 10.00% / Applies To / 1 Tag"
                    const sur = schedule.surcharge || schedule;
                    const amountText = (sur.surchargeType || 'Percentage') === 'Percentage'
                      ? `${Number(sur.surchargeAmount || 0).toFixed(2)}%`
                      : `$${Number(sur.surchargeAmount || 0).toFixed(2)}`;
                    const nCat = Array.isArray(sur.categoryIds) ? sur.categoryIds.length : 0;
                    const nTag = Array.isArray(sur.tagIds) ? sur.tagIds.length : 0;
                    const appliesText = isAllProducts
                      ? 'All Products'
                      : [nCat ? `${nCat} ${nCat === 1 ? 'Category' : 'Categories'}` : '', nTag ? `${nTag} ${nTag === 1 ? 'Tag' : 'Tags'}` : ''].filter(Boolean).join(', ') || 'Limited';

                    return (
                      <Tooltip
                        key={schedule.id}
                        placement="right-start"
                        componentsProps={{ tooltip: { sx: { bgcolor: byMode('white', '#232323'), color: byMode('#000', '#f8f8f8'), border: byMode('1px solid #ddd', '1px solid #a1a1a1'), boxShadow: byMode('0 2px 8px rgba(0,0,0,0.2)', '0 2px 8px rgba(0,0,0,0.6)'), borderRadius: '6px', px: 1.5, py: 1, fontSize: 13 } } }}
                        title={(
                          <Box>
                            <Typography sx={{ fontSize: 11, color: byMode('#000', '#f8f8f8') }}>{schedule.startTime} - {schedule.endTime}</Typography>
                            <Typography sx={{ fontSize: 15, color: byMode('#000', '#f8f8f8') }}>{sur.name || 'Surcharge'}</Typography>
                            <Typography sx={{ fontSize: 15, color: byMode('#000', '#f8f8f8'), mt: 0.5 }}>{amountText}</Typography>
                            <Typography sx={{ fontSize: 11, color: byMode('#000', '#f8f8f8'), mt: 0.5 }}>Applies To</Typography>
                            <Typography sx={{ fontSize: 14, color: byMode('#000', '#f8f8f8') }}>{appliesText}</Typography>
                          </Box>
                        )}
                      >
                        <Box
                          data-testid="surcharge-bar"
                          data-day={day}
                          data-applies={isAllProducts ? 'all' : 'limited'}
                          sx={{
                            position: 'absolute',
                            // Reference: lines sit at the left beside the time labels, one
                            // column per schedule so overlapping schedules show side by side.
                            left: 70 + lineIndex * 14,
                            top: `${topPercent}%`,
                            height: `${heightPercent}%`,
                            cursor: 'pointer',
                            // All Products = solid green line, Limited = dashed amber line
                            ...(isAllProducts
                              ? { width: 8, bgcolor: '#16a34a', borderRadius: '12px' }
                              : { width: 0, borderLeft: '8px dashed #d97706' }),
                            '&:hover': { opacity: 0.8 },
                          }}
                          onClick={() => {
                            setEditingSchedule(schedule);
                            setSelectedDay(day);
                            setOpenDialog(true);
                          }}
                        />
                      </Tooltip>
                    );
                  })}
                </Box>
              </Box>
            ))}
          </Box>
        ))}
      </Box>

      {/* Reference bottom bar: "Save to..." copies the calendar to other registers; "Save"
          confirms (every change on this page is already stored as it is made). */}
      {selectedRegister && (
        // Reference: light-blue full-width action bar
        <Box sx={{
          px: 2,
          py: 1.5,
          bgcolor: '#6cb7ec',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 1,
        }}>
          <Button
            onClick={openSaveToDialog}
            disabled={saving}
            sx={{ bgcolor: byMode('#d4d4d4', '#3a3a3a'), color: byMode('#000000', '#f8f8f8'), '&:hover': { bgcolor: byMode('#c4c4c4', '#4a4a4a') }, textTransform: 'none', minWidth: 118, height: 42, borderRadius: '12px', fontWeight: 700, fontSize: 16 }}
          >
            Save to...
          </Button>
          <Button
            onClick={handleSaveAll}
            disabled={saving || !dirty}
            sx={{ bgcolor: '#1e88e5', color: 'white', '&:hover': { bgcolor: '#1565c0' }, '&.Mui-disabled': { bgcolor: '#9ccdf3', color: 'white' }, textTransform: 'none', minWidth: 118, height: 42, borderRadius: '12px', fontWeight: 700, fontSize: 16 }}
          >
            {saving ? 'Save...' : 'Save'}
          </Button>
        </Box>
      )}

      <SelectRegistersDialog
        open={openSaveTo}
        onClose={() => setOpenSaveTo(false)}
        onSave={handleSaveTo}
        registers={allRegisters}
        outletNameFor={outletNameFor}
        currentRegisterId={selectedRegister?.id}
        saving={savingTo}
      />

      {/* Add Schedule Dialog */}
      <AddScheduleDialog
        open={openDialog}
        onClose={() => {
          setOpenDialog(false);
          setSelectedDay(null);
          setEditingSchedule(null);
        }}
        onSave={handleScheduleSaved}
        onDelete={handleDeleteSchedule}
        selectedDay={selectedDay}
        schedule={editingSchedule}
      />
    </Box>
  );
};

export default Surcharging;
