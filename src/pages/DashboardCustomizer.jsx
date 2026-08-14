import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Snackbar,
  Alert,
  Autocomplete,
  CircularProgress,
  TextField,
  FormControlLabel,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Avatar,
  Checkbox,
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import GridOnOutlinedIcon from '@mui/icons-material/GridOnOutlined';
import SaveIcon from '@mui/icons-material/SaveOutlined';
import CloseIcon from '@mui/icons-material/Close';
import SettingsIcon from '@mui/icons-material/SettingsOutlined';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import ShopfrontSwitch from '../components/Common/ShopfrontSwitch';
import EditDashboardItemDialog from '../components/Dashboard/EditDashboardItemDialog';
import favouriteReportService from '../services/favouriteReportService';
import dashboardLayoutService from '../services/dashboardLayoutService';
import { userService } from '../services/userService';
import posLocalDb from '../services/posLocalDb';
import { useAuth } from '../contexts/AuthContext';
import { useSelectedOutlet } from '../contexts/SelectedOutletContext';
import { useNavigate } from 'react-router-dom';
const GRID_COLS = 10;
const GRID_ROWS = 5;
const RESIZE_HANDLES = [
  { dir: 'n', cursor: 'ns-resize', sx: { top: 0, left: '50%', transform: 'translate(-50%, -50%)' } },
  { dir: 's', cursor: 'ns-resize', sx: { bottom: 0, left: '50%', transform: 'translate(-50%, 50%)' } },
  { dir: 'e', cursor: 'ew-resize', sx: { right: 0, top: '50%', transform: 'translate(50%, -50%)' } },
  { dir: 'w', cursor: 'ew-resize', sx: { left: 0, top: '50%', transform: 'translate(-50%, -50%)' } },
  { dir: 'ne', cursor: 'nesw-resize', sx: { right: 0, top: 0, transform: 'translate(50%, -50%)' } },
  { dir: 'nw', cursor: 'nwse-resize', sx: { left: 0, top: 0, transform: 'translate(-50%, -50%)' } },
  { dir: 'se', cursor: 'nwse-resize', sx: { right: 0, bottom: 0, transform: 'translate(50%, 50%)' } },
  { dir: 'sw', cursor: 'nesw-resize', sx: { left: 0, bottom: 0, transform: 'translate(-50%, 50%)' } },
];

function uid() {
  return `w_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function rectsOverlap(a, b) {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

function findFreeSlot(existing, w, h, gridRows = GRID_ROWS) {
  for (let y = 0; y <= gridRows - h; y++) {
    for (let x = 0; x <= GRID_COLS - w; x++) {
      const candidate = { x, y, w, h };
      const clash = existing.some((e) => rectsOverlap(candidate, e));
      if (!clash) return candidate;
    }
  }
  return { x: 0, y: 0, w, h };
}

const DashboardCustomizer = () => {
  const navigate = useNavigate();
  const { selectedOutletId } = useSelectedOutlet();
  const { user } = useAuth();
  const gridRef = useRef(null);
  const customizing = true;
  const [widgets, setWidgets] = useState([]);
  const [baseline, setBaseline] = useState([]);
  const [gridRows, setGridRows] = useState(GRID_ROWS);
  const [additionalUsers, setAdditionalUsers] = useState([]);
  const [configOpen, setConfigOpen] = useState(false);
  const [configUsersDraft, setConfigUsersDraft] = useState([]);
  const [configRowsDraft, setConfigRowsDraft] = useState(GRID_ROWS);
  const [userOptions, setUserOptions] = useState([]);
  const [loadingLayout, setLoadingLayout] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTargetId, setEditTargetId] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const [resizeState, setResizeState] = useState(null);
  const [favouriteList, setFavouriteList] = useState([]);

  useEffect(() => {
    const params = { allUsers: 1 };
    if (selectedOutletId != null) params.outletId = selectedOutletId;
    favouriteReportService
      .getAll(params)
      .then((res) => setFavouriteList(res?.data || []))
      .catch(() => setFavouriteList([]));
  }, [selectedOutletId]);

  // Reference labels other users' favourites as "Report Name(owner)"
  const reportLabel = (o) =>
    o ? `${o.name}${o.user && o.user.id !== user?.id ? `(${o.user.name})` : ''}` : '';

  useEffect(() => {
    let mounted = true;

    const loadLayout = async () => {
      setLoadingLayout(true);
      try {
        const params = {};
        if (selectedOutletId != null) params.outletId = selectedOutletId;
        const response = await dashboardLayoutService.getLayout(params);
        const loadedWidgets = Array.isArray(response?.data?.widgets) ? response.data.widgets : [];
        if (mounted) {
          setWidgets(loadedWidgets);
          setBaseline(JSON.parse(JSON.stringify(loadedWidgets)));
          setGridRows(response?.data?.rows || GRID_ROWS);
          setSelectedId(null);
        }
      } catch (e) {
        if (mounted) {
          setWidgets([]);
          setBaseline([]);
          setSnack({
            open: true,
            message: e?.response?.data?.error || e?.message || 'Failed to load dashboard layout',
            severity: 'error',
          });
        }
      } finally {
        if (mounted) setLoadingLayout(false);
      }
    };

    loadLayout();
    return () => {
      mounted = false;
    };
  }, [selectedOutletId]);

  const persist = useCallback(async () => {
    try {
      const payload = { widgets, rows: gridRows };
      if (additionalUsers.length > 0) payload.additionalUserIds = additionalUsers.map((u) => u.id);
      if (selectedOutletId != null) payload.outletId = selectedOutletId;
      await dashboardLayoutService.saveLayout(payload);
      // Update local cache so Dashboard shows the new layout instantly
      await posLocalDb.init();
      await posLocalDb.putStoreItem('dashboardLayouts', {
        key: `layout_${selectedOutletId ?? 'default'}`,
        widgets,
        rows: gridRows,
      });
      setBaseline(JSON.parse(JSON.stringify(widgets)));
      navigate('/dashboard');
    } catch (e) {
      setSnack({
        open: true,
        message: e?.response?.data?.error || e?.message || 'Failed to save dashboard layout',
        severity: 'error',
      });
    }
  }, [widgets, gridRows, additionalUsers, selectedOutletId, navigate]);

  const cancelEdit = useCallback(() => {
    setWidgets(JSON.parse(JSON.stringify(baseline)));
    navigate('/dashboard');
  }, [baseline, navigate]);

  const openConfigure = () => {
    setConfigUsersDraft(additionalUsers);
    setConfigRowsDraft(gridRows);
    setConfigOpen(true);
    if (userOptions.length === 0) {
      userService
        .getUsers()
        .then((res) => setUserOptions((res?.users || []).filter((u) => u.id !== user?.id)))
        .catch(() => setUserOptions([]));
    }
  };

  const applyConfigure = () => {
    const rows = Math.max(1, Math.min(20, parseInt(configRowsDraft, 10) || GRID_ROWS));
    setGridRows(rows);
    setAdditionalUsers(configUsersDraft);
    // Clamp widgets that no longer fit the new height
    setWidgets((prev) =>
      prev.map((w) => {
        const y = Math.min(w.y, rows - 1);
        const h = Math.min(w.h, rows - y);
        return y !== w.y || h !== w.h ? { ...w, y, h } : w;
      })
    );
    setConfigOpen(false);
  };

  const addWidget = () => {
    const pos = findFreeSlot(widgets, 2, 2, gridRows);
    const w = {
      id: uid(),
      ...pos,
      favouriteReportId: null,
      favouriteReport: null,
      filterByUser: false,
    };
    setWidgets((prev) => [...prev, w]);
    setSelectedId(w.id);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setWidgets((prev) => prev.filter((w) => w.id !== selectedId));
    setSelectedId(null);
  };

  const updateWidget = (id, patch) => {
    setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  };

  const handleEditSave = ({ favouriteReport, filterByUser }) => {
    if (!editTargetId) return;
    updateWidget(editTargetId, {
      favouriteReportId: favouriteReport.id,
      favouriteReport,
      filterByUser,
    });
    setEditDialogOpen(false);
    setEditTargetId(null);
  };

  const handleResizeStart = (e, widgetId, direction) => {
    e.preventDefault();
    e.stopPropagation();
    const w = widgets.find((x) => x.id === widgetId);
    if (!w || !gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const cellW = rect.width / GRID_COLS;
    const cellH = rect.height / gridRows;
    setResizeState({
      id: widgetId,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...w },
      cellW,
      cellH,
      direction,
    });
  };

  useEffect(() => {
    if (!resizeState) return;
    const { id, orig, cellW, cellH, startX, startY, direction } = resizeState;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    const onMove = (e) => {
      const deltaCols = Math.round((e.clientX - startX) / cellW);
      const deltaRows = Math.round((e.clientY - startY) / cellH);

      let left = orig.x;
      let right = orig.x + orig.w;
      let top = orig.y;
      let bottom = orig.y + orig.h;

      if (direction.includes('w')) {
        left = clamp(orig.x + deltaCols, 0, right - 1);
      }
      if (direction.includes('e')) {
        right = clamp(orig.x + orig.w + deltaCols, left + 1, GRID_COLS);
      }
      if (direction.includes('n')) {
        top = clamp(orig.y + deltaRows, 0, bottom - 1);
      }
      if (direction.includes('s')) {
        bottom = clamp(orig.y + orig.h + deltaRows, top + 1, gridRows);
      }

      const newW = right - left;
      const newH = bottom - top;
      setWidgets((prev) =>
        prev.map((w) => (w.id === id ? { ...w, x: left, y: top, w: newW, h: newH } : w))
      );
    };
    const onUp = () => setResizeState(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [resizeState, gridRows]);

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 50px)', minHeight: 480, p: 2, gap: 0 }}>
      {/* Grid canvas */}
      <Box
        sx={{
          flex: 1,
          position: 'relative',
          border: '1px solid #000',
          borderRadius: 0,
          overflow: 'hidden',
          bgcolor: '#fff',
          mr: '48px',
        }}
      >
        <Box
          ref={gridRef}
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
            gridTemplateRows: `repeat(${gridRows}, minmax(64px, 1fr))`,
          }}
        >
          {/* Dashed grid cell guide lines */}
          <Box
            aria-hidden
            sx={{
              gridColumn: '1 / -1',
              gridRow: '1 / -1',
              display: 'grid',
              gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
              gridTemplateRows: `repeat(${gridRows}, 1fr)`,
              pointerEvents: 'none',
            }}
          >
            {Array.from({ length: GRID_COLS * gridRows }).map((_, i) => (
              <Box
                key={i}
                sx={{
                  borderRight: (i + 1) % GRID_COLS === 0 ? 'none' : '1px dashed #d9d9d9',
                  borderBottom: i >= GRID_COLS * (gridRows - 1) ? 'none' : '1px dashed #d9d9d9',
                }}
              />
            ))}
          </Box>
          {loadingLayout && (
            <Box
              sx={{
                gridColumn: '1 / -1',
                gridRow: '1 / -1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CircularProgress size={36} />
            </Box>
          )}
          {!loadingLayout && widgets.map((w) => {
            const sel = w.id === selectedId;
            return (
              <Box
                key={w.id}
                onClick={() => setSelectedId(w.id)}
                sx={{
                  gridColumn: `${w.x + 1} / span ${w.w}`,
                  gridRow: `${w.y + 1} / span ${w.h}`,
                  border: '1px solid #000',
                  borderRadius: 0,
                  m: 0.25,
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  bgcolor: '#f7f7f7',
                  boxShadow: sel ? '0 0 0 3px #1976d2' : 'none',
                  position: 'relative',
                  zIndex: sel ? 2 : 1,
                }}
              >
                {/* Report picker (centered, width-constrained) */}
                <Box sx={{ width: '100%', maxWidth: 600 }}>
                  <Autocomplete
                    size="small"
                    options={favouriteList}
                    value={w.favouriteReport}
                    onChange={(_, v) => {
                      if (v) updateWidget(w.id, { favouriteReportId: v.id, favouriteReport: v });
                      else updateWidget(w.id, { favouriteReportId: null, favouriteReport: null });
                    }}
                    getOptionLabel={reportLabel}
                    isOptionEqualToValue={(a, b) => a?.id === b?.id}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Select favourite report"
                        size="small"
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <>
                              <InputAdornment position="start" sx={{ ml: 0.5, mr: 0 }}>
                                <GridOnOutlinedIcon sx={{ fontSize: 18, color: '#676b72' }} />
                              </InputAdornment>
                              {params.InputProps.startAdornment}
                            </>
                          ),
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            height: 42,
                            borderRadius: '8px',
                            backgroundColor: '#fff',
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
                          },
                          '& input::placeholder': { color: '#808080', opacity: 1 },
                        }}
                      />
                    )}
                  />
                </Box>

                {/* Filter-by-user toggle */}
                <FormControlLabel
                  sx={{ mt: 1, mx: 0, '& .MuiFormControlLabel-label': { fontSize: 16, color: '#000' } }}
                  control={
                    <ShopfrontSwitch
                      checked={w.filterByUser}
                      onChange={(e) => updateWidget(w.id, { filterByUser: e.target.checked })}
                    />
                  }
                  label="Filter report by current user"
                />

                {customizing && sel && RESIZE_HANDLES.map((handle) => (
                  <Box
                    key={`${w.id}-${handle.dir}`}
                    onMouseDown={(e) => handleResizeStart(e, w.id, handle.dir)}
                    sx={{
                      position: 'absolute',
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      bgcolor: '#2f7ae5',
                      border: '2px solid #fff',
                      cursor: handle.cursor,
                      zIndex: 5,
                      ...handle.sx,
                    }}
                  />
                ))}
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Right-edge slide-out rail (icon square peeks out, hover slides the label in) */}
      <Box
        sx={{
          position: 'fixed',
          top: 78,
          right: 0,
          zIndex: 1050,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          pointerEvents: 'none',
        }}
      >
        <Box
          component="button"
          onClick={persist}
          disabled={loadingLayout}
          aria-label="Save dashboard"
          sx={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            width: 144,
            height: 44,
            p: 0,
            border: 0,
            borderRadius: 0,
            cursor: 'pointer',
            color: '#fff',
            bgcolor: '#0284c7',
            transform: 'translateX(96px)',
            transition: 'transform 300ms',
            '&:hover': { transform: 'translateX(0)' },
          }}
        >
          <Box sx={{ width: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SaveIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box sx={{ width: 96, textAlign: 'left', fontSize: 18, fontFamily: 'inherit' }}>Save</Box>
        </Box>
        <Box
          component="button"
          onClick={cancelEdit}
          aria-label="Cancel changes"
          sx={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            width: 144,
            height: 44,
            p: 0,
            border: 0,
            borderRadius: 0,
            cursor: 'pointer',
            color: '#fff',
            bgcolor: '#dc2626',
            transform: 'translateX(96px)',
            transition: 'transform 300ms',
            '&:hover': { transform: 'translateX(0)' },
          }}
        >
          <Box sx={{ width: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CloseIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box sx={{ width: 96, textAlign: 'left', fontSize: 18, fontFamily: 'inherit' }}>Cancel</Box>
        </Box>
        <Box
          component="button"
          onClick={openConfigure}
          aria-label="Configure dashboard"
          sx={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            width: 144,
            height: 44,
            p: 0,
            border: 0,
            borderRadius: 0,
            cursor: 'pointer',
            color: '#fff',
            bgcolor: '#404040',
            transform: 'translateX(96px)',
            transition: 'transform 300ms',
            '&:hover': { transform: 'translateX(0)' },
          }}
        >
          <Box sx={{ width: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SettingsIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box sx={{ width: 96, textAlign: 'left', fontSize: 18, fontFamily: 'inherit' }}>Configure</Box>
        </Box>
        <Box
          component="button"
          onClick={addWidget}
          disabled={loadingLayout}
          aria-label="Add dashboard item"
          sx={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            width: 144,
            height: 44,
            p: 0,
            border: 0,
            borderRadius: 0,
            cursor: 'pointer',
            color: '#fff',
            bgcolor: '#16a34a',
            transform: 'translateX(96px)',
            transition: 'transform 300ms',
            '&:hover': { transform: 'translateX(0)' },
          }}
        >
          <Box sx={{ width: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AddIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box sx={{ width: 96, textAlign: 'left', fontSize: 18, fontFamily: 'inherit' }}>Add Item</Box>
        </Box>
        <Box
          component="button"
          onClick={deleteSelected}
          disabled={!selectedId || loadingLayout}
          aria-label="Delete selected item"
          sx={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            width: 144,
            height: 44,
            p: 0,
            border: 0,
            borderRadius: 0,
            cursor: 'pointer',
            color: '#fff',
            bgcolor: '#dc2626',
            transform: 'translateX(96px)',
            transition: 'transform 300ms',
            '&:hover': { transform: 'translateX(0)' },
            '&:disabled': { bgcolor: '#404040', color: '#737373', cursor: 'not-allowed' },
          }}
        >
          <Box sx={{ width: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DeleteIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box sx={{ width: 96, textAlign: 'left', fontSize: 18, fontFamily: 'inherit' }}>Delete</Box>
        </Box>
      </Box>

      <EditDashboardItemDialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setEditTargetId(null);
        }}
        onSave={handleEditSave}
        initialReport={editTargetId ? widgets.find((x) => x.id === editTargetId)?.favouriteReport : null}
        initialFilterByUser={editTargetId ? widgets.find((x) => x.id === editTargetId)?.filterByUser : false}
      />

      {/* Configure Dashboard dialog (matches reference: additional users + dashboard height) */}
      <Dialog open={configOpen} onClose={() => setConfigOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ textAlign: 'center', pt: 3 }}>
          <Avatar sx={{ width: 64, height: 64, mx: 'auto', mb: 1, bgcolor: '#1976d2' }}>
            <HelpOutlineIcon sx={{ fontSize: 36 }} />
          </Avatar>
          <Typography variant="h6" fontWeight={700}>
            Configure Dashboard
          </Typography>
          <Typography variant="body2" sx={{ color: '#000', mt: 0.5 }}>
            Select additional users to save this dashboard to
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Autocomplete
              multiple
              disableCloseOnSelect
              options={userOptions}
              value={configUsersDraft}
              onChange={(_, v) => setConfigUsersDraft(v)}
              getOptionLabel={(o) => o?.name || ''}
              isOptionEqualToValue={(a, b) => a?.id === b?.id}
              renderOption={(props, option, { selected }) => (
                <li {...props} key={option.id}>
                  <Checkbox size="small" checked={selected} sx={{ mr: 1, p: 0 }} />
                  {option.name}
                </li>
              )}
              renderInput={(params) => (
                <TextField {...params} placeholder={configUsersDraft.length === 0 ? 'Select Additional Users' : ''} size="small" />
              )}
            />
            <Box>
              <Typography variant="body2" sx={{ textAlign: 'center', mb: 0.5 }}>
                Dashboard Height (in rows)
              </Typography>
              <TextField
                fullWidth
                size="small"
                type="number"
                inputProps={{ min: 1, max: 20 }}
                value={configRowsDraft}
                onChange={(e) => setConfigRowsDraft(e.target.value)}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'center' }}>
          <Button variant="outlined" color="inherit" onClick={() => setConfigOpen(false)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={applyConfigure}>
            Continue
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
        <Alert severity={snack.severity}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default DashboardCustomizer;

