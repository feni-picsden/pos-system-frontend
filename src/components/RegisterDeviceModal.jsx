import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import { registerCurrentDevice } from '../services/pushService';

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
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Register Push Device</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Register this device as a new push device?
        </Typography>
        <TextField
          autoFocus
          fullWidth
          label="Device Name"
          value={deviceName}
          onChange={(e) => setDeviceName(e.target.value)}
          placeholder="e.g. My Laptop"
          disabled={loading}
        />
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleCreate} disabled={loading}>
          {loading ? <CircularProgress size={24} /> : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
