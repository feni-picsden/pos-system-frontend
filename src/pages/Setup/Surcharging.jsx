import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  TextField,
  Autocomplete,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  InfoOutlined as InfoOutlinedIcon,
} from '@mui/icons-material';
import AddScheduleDialog from '../../components/Surcharges/AddScheduleDialog';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import { surchargeService } from '../../services/surchargeService';
import registerService from '../../services/registerService';
import outletService from '../../services/outletService';
import settingsService from '../../services/settingsService';
import { useAuth } from '../../contexts/AuthContext';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';

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
  const { alert } = useAppDialogs();
  const { user, getOutletId } = useAuth();
  const [schedules, setSchedules] = useState({}); // Store schedules by day
  const [registers, setRegisters] = useState([]);
  const [selectedRegister, setSelectedRegister] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [scheduleActive, setScheduleActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [editingSchedule, setEditingSchedule] = useState(null);

  const isSuperAdmin = user?.isSuperAdmin || (user?.hasAllPermission && !user?.outletId);

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

  const loadSchedules = useCallback(async () => {
    try {
      setLoading(true);

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

  const handleScheduleActiveChange = async (event) => {
    if (!selectedRegister?.id) return;
    const checked = event.target.checked;
    setScheduleActive(checked);
    try {
      await settingsService.updateSetting(
        scheduleActiveKey(selectedRegister.id),
        checked,
        'surcharges',
        'Surcharge schedule active state for register'
      );
    } catch (err) {
      console.error('Error saving schedule active state:', err);
      setScheduleActive(!checked);
    }
  };

  const handleAddSchedule = (day) => {
    setSelectedDay(day);
    setEditingSchedule(null);
    setOpenDialog(true);
  };

  const handleDeleteSchedule = async (schedule) => {
    if (!schedule?.id) return;
    try {
      setLoading(true);
      await surchargeService.deleteSchedule(schedule.id);
      await loadSchedules();
      } catch (err) {
        console.error('Error deleting schedule:', err);
      alert('Failed to delete schedule');
    } finally {
      setLoading(false);
      setOpenDialog(false);
      setSelectedDay(null);
      setEditingSchedule(null);
    }
  };

  const handleScheduleSaved = async (scheduleData) => {
    try {
      setLoading(true);

      // Outlet comes from the selected register (register selector is grouped by outlet)
      let outletId = selectedRegister?.outletId || null;
      if (!outletId && !isSuperAdmin) {
        outletId = await getOutletId();
      }
      if (!outletId) {
        alert('Please select a register before creating a surcharge.');
        setLoading(false);
        return;
      }

      let surchargeId =
        editingSchedule?.surchargeId ||
        editingSchedule?.surcharge?.id ||
        null;

      const appliesTo = scheduleData.appliesTo || 'All Products';

      if (!surchargeId) {
        const surchargePayload = {
          name: scheduleData.surchargeName,
          appliesTo,
          surchargeType: scheduleData.surchargeType || 'Percentage',
          surchargeAmount: scheduleData.surchargeAmount,
          taxRateId: scheduleData.taxRate || null,
          isActive: true,
          categoryIds: scheduleData.categoryIds || [],
          tagIds: scheduleData.tagIds || [],
          ...(outletId ? { outletId } : {}),
        };

        const surchargeResp = await surchargeService.createSurcharge(surchargePayload);
        surchargeId = surchargeResp?.surcharge?.id || surchargeResp?.id;
      } else {
        try {
          await surchargeService.updateSurcharge(
            surchargeId,
            {
              name: scheduleData.surchargeName,
              appliesTo,
              surchargeType: scheduleData.surchargeType || 'Percentage',
              surchargeAmount: scheduleData.surchargeAmount,
              taxRateId: scheduleData.taxRate || null,
              // Keep category/tag selections in sync when editing
              categoryIds: scheduleData.categoryIds || [],
              tagIds: scheduleData.tagIds || [],
              ...(outletId ? { outletId } : {}),
            },
          );
        } catch (updateErr) {
          console.error('Error updating surcharge (non-fatal):', updateErr);
        }
      }

      if (!surchargeId) {
        throw new Error('Failed to determine surchargeId for schedule');
      }

      const schedulePayload = {
        surchargeId,
        dayOfWeek: scheduleData.dayOfWeek,
        startTime: scheduleData.startTime,
        endTime: scheduleData.endTime,
        isActive: true,
      };

      if (editingSchedule?.id) {
        await surchargeService.updateSchedule(editingSchedule.id, schedulePayload);
    } else {
        await surchargeService.createSchedule(schedulePayload);
      }

      await loadSchedules();

      setOpenDialog(false);
      setSelectedDay(null);
      setEditingSchedule(null);
    } catch (err) {
      console.error('Error saving schedule:', err);
      alert(err?.response?.data?.error || 'Failed to save schedule');
    } finally {
      setLoading(false);
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
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f5f5f5' }}>
      {/* Header */}
      <Box sx={{
        p: 2,
        bgcolor: 'white',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Typography sx={{ fontSize: 32, fontWeight: 700, color: '#000000' }}>
            Surcharging
          </Typography>

          {/* Legend */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{ width: 24, height: 5, bgcolor: '#16a34a', borderRadius: '2px' }} />
              <Typography sx={{ fontSize: 16, color: '#000000' }}>All Products</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              {/* Dashed amber swatch (two dashes, like the reference) */}
              <Box sx={{ width: 24, height: 0, borderTop: '5px dashed #d97706' }} />
              <Typography sx={{ fontSize: 16, color: '#000000' }}>Limited</Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {/* Single searchable register selector grouped by outlet */}
          <Autocomplete
            options={registerOptions}
            groupBy={(option) => outletNameFor(option)}
            getOptionLabel={(option) => option?.name || ''}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            value={selectedRegister}
            onChange={(e, value) => setSelectedRegister(value)}
            size="small"
            sx={{ width: 232 }}
            renderGroup={(params) => (
              <li key={params.key}>
                <Box sx={{ px: 1.5, py: 0.5, fontWeight: 700, fontSize: 14, color: '#000000' }}>
                  {params.group}
                </Box>
                <ul style={{ padding: 0, margin: 0 }}>{params.children}</ul>
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Select..."
                sx={{
                  '& .MuiOutlinedInput-root': {
                    height: 42,
                    borderRadius: '8px',
                    '& fieldset': { borderColor: '#454545', borderWidth: 1 },
                    '&:hover fieldset': { borderColor: '#454545' },
                    '&.Mui-focused fieldset': { borderColor: '#000000', borderWidth: 2 },
                  },
                  '& input::placeholder': { color: '#808080', opacity: 1 },
                }}
              />
            )}
          />

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
              color: '#000000',
              gap: 1,
              ml: 0,
              '& .MuiSwitch-root:has(.Mui-disabled)': { cursor: 'not-allowed' },
            }}
          />
        </Box>
      </Box>

      {/* Select-a-register info banner */}
      {!selectedRegister && (
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: '#eff6ff',
          borderLeft: '4px solid #3b82f6',
          px: 2,
          py: 1.5,
        }}>
          <InfoOutlinedIcon sx={{ color: '#3b82f6', fontSize: 20 }} />
          <Typography sx={{ fontSize: 16, color: '#1e40af' }}>
            Please select a register above.
          </Typography>
        </Box>
      )}

      {/* Warning Banner */}
      {selectedRegister && !scheduleActive && (
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: '#fefce8',
          borderLeft: '4px solid #eab308',
          px: 2,
          py: 1.5,
        }}>
          <InfoOutlinedIcon sx={{ color: '#ca8a04', fontSize: 20 }} />
          <Typography sx={{ fontSize: 16, color: '#000000' }}>
            The schedule is not currently active, you&apos;ll need to enable it before any surcharge will take affect
          </Typography>
        </Box>
      )}

      {/* Main Schedule Grid (hidden until a register is chosen) */}
      <Box sx={{ flex: 1, overflow: 'auto', bgcolor: '#f5f5f5', p: 2 }}>
        {selectedRegister && (loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <CircularProgress />
        </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
            {DAYS_OF_WEEK.map((day) => (
              <Box
                key={day}
                sx={{
                  width: 256,
                  minWidth: 256,
                  border: '2px solid #000000',
                  borderRadius: '8px',
                  bgcolor: 'white',
                  overflow: 'hidden',
                }}
              >
                {/* Day Header */}
                <Box sx={{
                  p: 1.5,
                  bgcolor: 'white',
                  borderBottom: '1px solid #000000',
                  textAlign: 'center'
                }}>
                  <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#000000', mb: 1 }}>
                    {day}
                  </Typography>
                  <Button
                    startIcon={<AddIcon />}
                    onClick={() => handleAddSchedule(day)}
                    sx={{
                      bgcolor: 'transparent',
                      border: '1px solid #8a8a8a',
                      color: '#6e6e6e',
                      height: 42,
                      px: 2.5,
                      fontSize: 16,
                      fontWeight: 700,
                      borderRadius: '12px',
                      textTransform: 'none',
                      transition: 'none',
                      '&:hover': {
                        bgcolor: 'rgba(0,0,0,0.05)',
                        border: '1px solid #8a8a8a',
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
                  bgcolor: 'white'
                }}>
                  {/* Time rows */}
                  {TIME_SLOTS.map((timeSlot, index) => {
                    const isEven = index % 2 === 0;
                    return (
                      <Box
                        key={timeSlot}
                      sx={{
                        height: 25,
                          borderBottom: '1px solid #e0e0e0',
                        display: 'flex',
                        alignItems: 'center',
                        px: 1,
                          bgcolor: isEven ? '#fafafa' : 'white',
                        }}
                      >
                        <Typography
                          sx={{
                            color: '#64748b',
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
                  {getSchedulesForDay(day).map((schedule) => {
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

                    return (
                      <Box
                        key={schedule.id}
                        sx={{
                          position: 'absolute',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          top: `${topPercent}%`,
                          height: `${heightPercent}%`,
                          cursor: 'pointer',
                          // All Products = solid green line, Limited = dashed amber line
                          ...(isAllProducts
                            ? { width: 6, bgcolor: '#16a34a', borderRadius: '12px' }
                            : { width: 0, borderLeft: '6px dashed #d97706' }),
                          '&:hover': {
                            opacity: 0.8
                          }
                        }}
                        onClick={() => {
                          setEditingSchedule(schedule);
                          setSelectedDay(day);
                          setOpenDialog(true);
                        }}
                      />
                    );
                  })}
                </Box>
              </Box>
            ))}
          </Box>
        ))}
      </Box>

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
