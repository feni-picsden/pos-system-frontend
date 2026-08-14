import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Add as AddIcon,
  EditOutlined as EditIcon,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material';
import RegisterDeviceModal from '../components/RegisterDeviceModal';
import ConfirmDeleteDialog from '../components/Common/ConfirmDeleteDialog';
import ShopfrontSwitch from '../components/Common/ShopfrontSwitch';
import apiClient from '../services/apiClient';
import { pushApi } from '../services/pushService';

// Reference has no transitions on row actions.
const INSTANT = 'all 0s ease';

const PRIMARY_BUTTON_SX = {
  bgcolor: '#5ebbeb',
  color: '#fff',
  textTransform: 'none',
  boxShadow: 'none',
  borderRadius: '12px',
  fontWeight: 700,
  fontSize: 16,
  height: 42,
  px: 3,
  transition: INSTANT,
  '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' },
};

const rowActionSx = (color) => ({
  color,
  textTransform: 'none',
  fontWeight: 700,
  fontSize: 16,
  height: 42,
  borderRadius: '12px',
  minWidth: 0,
  px: 1.5,
  transition: INSTANT,
  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
});

const FIELD_LABEL_SX = { fontWeight: 700, fontSize: 16, color: '#000' };
const HELPER_SX = { fontSize: 14, color: '#676b72', mt: 0.25 };

const TEXT_INPUT_SX = {
  width: '100%',
  maxWidth: 420,
  height: 42,
  border: '1px solid #595959',
  borderRadius: '8px',
  px: 1.5,
  fontFamily: 'inherit',
  fontSize: 16,
  color: '#000',
  bgcolor: '#fff',
  outline: 'none',
  '&:focus': { border: '2px solid #000' },
};

// Toggle groups matching the reference edit page: bold label, gray helper,
// pill toggle + dynamic state sentence.
const TOGGLE_FIELDS = [
  {
    field: 'registerClosureEnabled',
    label: 'Register Closure Summary',
    helper: 'Notify when a register is closed with the closure totals',
    onText: 'Register closures will be sent to this device',
    offText: 'No register closures will be sent to this device',
  },
  {
    field: 'allLoginEventsEnabled',
    label: 'All Login Events',
    helper: 'Notify about every login event',
    onText: 'All login events will be sent to this device',
    offText: 'No login events will be sent to this device',
  },
  {
    field: 'mainLoginEnabled',
    label: 'Main Login',
    helper: 'Notify about the main login, typically the first login of the day',
    onText: 'Main logins will be sent to this device',
    offText: 'No main logins will be sent to this device',
  },
  {
    field: 'promotionDownloadEnabled',
    label: 'New Promotions Downloaded',
    helper: 'Notify when new external promotions are downloaded',
    onText: 'New promotions will be sent to this device',
    offText: 'No new promotions will be sent to this device',
  },
];

const CurrentDeviceTag = () => (
  <Box component="span" sx={{ fontSize: 14, fontWeight: 400, color: '#0ea5e9' }}>
    {' '}- Current Device
  </Box>
);

export default function PushNotifications() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const [currentEndpoint, setCurrentEndpoint] = useState(null);
  const [editingDevice, setEditingDevice] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadDevices = async () => {
    setLoading(true);
    try {
      const { data } = await pushApi.getDevices();
      setDevices(data.devices || []);
    } catch (err) {
      setSnack({ open: true, message: err?.response?.data?.error || 'Failed to load devices', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  // Detect which listed device is this browser (matching push subscription endpoint).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!('serviceWorker' in navigator)) return;
        const registration = await navigator.serviceWorker.getRegistration('/');
        const subscription = await registration?.pushManager?.getSubscription();
        if (!cancelled && subscription) setCurrentEndpoint(subscription.endpoint);
      } catch {
        // no subscription in this browser
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Escape closes the edit view (reference is a separate page; back = Escape here).
  useEffect(() => {
    if (!editingDevice) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setEditingDevice(null);
        setEditForm(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editingDevice]);

  const isCurrentDevice = (d) => !!currentEndpoint && d.endpoint === currentEndpoint;

  const handleRegisterSuccess = () => {
    loadDevices();
    setSnack({ open: true, message: 'Device registered successfully', severity: 'success' });
  };

  const openEdit = (d) => {
    setEditingDevice(d);
    setEditForm({
      deviceName: d.deviceName || '',
      largeSalesAmount: d.settings?.largeSalesAmount ?? 500,
      registerClosureEnabled: d.settings?.registerClosureEnabled ?? true,
      allLoginEventsEnabled: d.settings?.allLoginEventsEnabled ?? false,
      mainLoginEnabled: d.settings?.mainLoginEnabled ?? true,
      promotionDownloadEnabled: d.settings?.promotionDownloadEnabled ?? true,
    });
  };

  const handleSave = async () => {
    if (!editingDevice || !editForm) return;
    setSaving(true);
    try {
      await pushApi.updateSettings(editingDevice.id, editForm);
      setSnack({ open: true, message: 'Settings saved', severity: 'success' });
      setEditingDevice(null);
      setEditForm(null);
      loadDevices();
    } catch (err) {
      setSnack({ open: true, message: err?.response?.data?.error || 'Failed to save', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/push/devices/${deleteTarget.id}`);
      setSnack({ open: true, message: 'Device deleted', severity: 'success' });
      setDeleteTarget(null);
      loadDevices();
    } catch (err) {
      setSnack({ open: true, message: err?.response?.data?.error || 'Failed to delete device', severity: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  // ---- Edit view (reference: dedicated /settings/push/:id page) ----
  if (editingDevice && editForm) {
    return (
      <Box sx={{ p: 3, pb: 12 }}>
        <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: '#000', mb: 3 }}>
          Editing {editingDevice.deviceName}
          {isCurrentDevice(editingDevice) && <CurrentDeviceTag />}
        </Typography>

        <Box sx={{ mb: 3 }}>
          <Typography sx={{ ...FIELD_LABEL_SX, mb: 0.5 }}>Name</Typography>
          <Box
            component="input"
            type="text"
            value={editForm.deviceName}
            onChange={(e) => setEditForm((f) => ({ ...f, deviceName: e.target.value }))}
            sx={TEXT_INPUT_SX}
          />
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography sx={FIELD_LABEL_SX}>Large Sales</Typography>
          <Typography sx={{ ...HELPER_SX, mb: 0.75 }}>
            Notify about sales which are greater than the provided value
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              maxWidth: 420,
              height: 42,
              border: '1px solid #595959',
              borderRadius: '8px',
              bgcolor: '#fff',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                px: 1.5,
                height: '100%',
                fontSize: 16,
                color: '#000',
                borderRight: '1px solid #595959',
                bgcolor: '#f5f5f5',
              }}
            >
              $
            </Box>
            <Box
              component="input"
              type="number"
              min="0"
              value={editForm.largeSalesAmount}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, largeSalesAmount: parseFloat(e.target.value) || 0 }))
              }
              sx={{
                flex: 1,
                height: '100%',
                border: 0,
                outline: 'none',
                px: 1.5,
                fontFamily: 'inherit',
                fontSize: 16,
                color: '#000',
              }}
            />
          </Box>
        </Box>

        {TOGGLE_FIELDS.map((t) => (
          <Box key={t.field} sx={{ mb: 3 }}>
            <Typography sx={FIELD_LABEL_SX}>{t.label}</Typography>
            <Typography sx={{ ...HELPER_SX, mb: 0.75 }}>{t.helper}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <ShopfrontSwitch
                checked={!!editForm[t.field]}
                onChange={(e) => setEditForm((f) => ({ ...f, [t.field]: e.target.checked }))}
                sx={{ mr: 1.5 }}
              />
              <Typography sx={{ fontSize: 14, color: '#404040' }}>
                {editForm[t.field] ? t.onText : t.offText}
              </Typography>
            </Box>
          </Box>
        ))}

        <Button
          variant="contained"
          disableRipple
          disableElevation
          disabled={saving}
          onClick={handleSave}
          sx={{ ...PRIMARY_BUTTON_SX, position: 'fixed', right: 24, bottom: 24, zIndex: 1200 }}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>
    );
  }

  // ---- List view ----
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: '#000' }}>
          Push Notifications
        </Typography>
        <Button
          variant="contained"
          disableRipple
          disableElevation
          startIcon={<AddIcon />}
          onClick={() => setModalOpen(true)}
          sx={PRIMARY_BUTTON_SX}
        >
          Add Current Device
        </Button>
      </Box>

      {/* Reference: single full-width blue pill header bar with 'Name' only */}
      <Box
        sx={{
          height: 51,
          bgcolor: '#5ebbeb',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          pl: '20px',
        }}
      >
        <Typography sx={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Name</Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, py: 6 }}>
          <CircularProgress size={22} sx={{ color: '#737373' }} />
          <Typography sx={{ fontSize: 16, color: '#737373' }}>Loading devices...</Typography>
        </Box>
      ) : devices.length === 0 ? (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 16, color: '#676b72' }}>No devices registered yet.</Typography>
          <Typography sx={{ fontSize: 14, color: '#676b72', mt: 1 }}>
            Click &quot;Add Current Device&quot; to register this browser for push notifications.
          </Typography>
        </Box>
      ) : (
        devices.map((d) => (
          <Box
            key={d.id}
            sx={{
              height: 74,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              bgcolor: '#fff',
              pl: '20px',
              pr: '12px',
            }}
          >
            <Typography sx={{ fontSize: 16, color: '#000' }}>
              {d.deviceName}
              {isCurrentDevice(d) && <CurrentDeviceTag />}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                disableRipple
                startIcon={<EditIcon />}
                onClick={() => openEdit(d)}
                sx={rowActionSx('#16a34a')}
              >
                Edit
              </Button>
              <Button
                disableRipple
                startIcon={<DeleteIcon />}
                onClick={() => setDeleteTarget(d)}
                sx={rowActionSx('#dc2626')}
              >
                Delete
              </Button>
            </Box>
          </Box>
        ))
      )}

      <RegisterDeviceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleRegisterSuccess}
      />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        title="Delete Push Device"
        message={`Are you sure you want to delete ${deleteTarget?.deviceName || ''}?`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}
