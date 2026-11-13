import React, { useState } from 'react';
import { Dialog, Box, Button, Typography, CircularProgress } from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';
import { registerCurrentDevice } from '../services/pushService';

// Reference "Register Push Device" dialog: pale-green header with a check icon and
// dark-green title, question line, "Name" label + black-bordered input, grey Cancel
// and green Create pills.
const INPUT_SX = {
  width: '100%',
  height: 42,
  border: '1px solid #000',
  borderRadius: '8px',
  px: 1.5,
  fontFamily: 'inherit',
  fontSize: 16,
  color: '#000',
  bgcolor: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
  '&:focus': { border: '2px solid #000' },
};

const PILL_SX = {
  height: 42,
  minWidth: 116,
  px: 3,
  borderRadius: '12px',
  fontWeight: 700,
  fontSize: 16,
  textTransform: 'none',
  boxShadow: 'none',
  transition: 'none',
};

export default function RegisterDeviceModal({ open, onClose, onSuccess }) {
  const [deviceName, setDeviceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    const trimmed = (deviceName || '').trim();
    if (!trimmed) {
      setError('Device name is required');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await registerCurrentDevice(trimmed);
      if (result.success) {
        onSuccess?.(result.device);
        handleClose();
      } else {
        setError(result.error || 'Failed to register device');
      }
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to register device');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setDeviceName('');
    setError('');
    setLoading(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : handleClose}
      maxWidth={false}
      PaperProps={{ sx: { width: 334, borderRadius: '8px', overflow: 'hidden' } }}
    >
      <Box sx={{ bgcolor: '#b9f8cf', px: 2, py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <CheckIcon sx={{ color: '#016630', fontSize: 20 }} />
        <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#016630' }}>Register Push Device</Typography>
      </Box>
      <Box sx={{ px: 2, pt: 2.5, pb: 2 }}>
        <Typography sx={{ fontSize: 16, color: '#000', mb: 2 }}>
          Register this device as a new push device?
        </Typography>
        <Typography component="label" htmlFor="push-device-name" sx={{ display: 'block', fontSize: 13, color: '#404040', mb: 0.5 }}>
          Name
        </Typography>
        <Box
          component="input"
          id="push-device-name"
          type="text"
          autoFocus
          value={deviceName}
          disabled={loading}
          onChange={(e) => setDeviceName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleCreate();
            }
          }}
          sx={INPUT_SX}
        />
        {error && (
          <Typography sx={{ mt: 1, fontSize: 14, color: '#dc2626' }}>{error}</Typography>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 3 }}>
          <Button
            disableRipple
            onClick={handleClose}
            disabled={loading}
            sx={{ ...PILL_SX, bgcolor: '#d4d4d4', color: '#000', '&:hover': { bgcolor: '#c4c4c4' } }}
          >
            Cancel
          </Button>
          <Button
            disableRipple
            onClick={handleCreate}
            disabled={loading}
            sx={{ ...PILL_SX, bgcolor: '#00c951', color: '#fff', '&:hover': { bgcolor: '#00b548' }, '&.Mui-disabled': { bgcolor: '#86efac', color: '#fff' } }}
          >
            {loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Create'}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}
