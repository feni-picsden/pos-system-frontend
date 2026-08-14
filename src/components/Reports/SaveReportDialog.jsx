import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  Box,
  Typography,
} from '@mui/material';
import favouriteReportService from '../../services/favouriteReportService';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';

const SaveReportDialog = ({ open, onClose, reportType, reportPath, filters }) => {
  const { selectedOutletId } = useSelectedOutlet();
  const [name, setName] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Report name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await favouriteReportService.create({
        name: name.trim(),
        reportType,
        reportPath,
        filters: filters || {},
        emailEnabled,
        // Persist outlet from navbar (super admin outlet picker); backend also accepts this
        ...(selectedOutletId != null ? { outletId: selectedOutletId } : {}),
      });

      onClose(true);
      setName('');
      setEmailEnabled(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save report');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setEmailEnabled(false);
    setError('');
    onClose(false);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Save Report</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          <TextField
            fullWidth
            label="Report Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={!!error}
            helperText={error}
            sx={{ mb: 2 }}
            autoFocus
          />
          <FormControlLabel
            control={
              <Switch
                checked={emailEnabled}
                onChange={(e) => setEmailEnabled(e.target.checked)}
              />
            }
            label="Enable Email Notifications"
          />
          <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
            This will save the current report with all selected filters. You can access it later from Favourite Reports.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={loading}>
          {loading ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SaveReportDialog;

