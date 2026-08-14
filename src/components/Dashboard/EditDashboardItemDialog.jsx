import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Autocomplete,
  TextField,
  FormControlLabel,
  Switch,
  Avatar,
  CircularProgress,
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import favouriteReportService from '../../services/favouriteReportService';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import { useAuth } from '../../contexts/AuthContext';

const EditDashboardItemDialog = ({ open, onClose, onSave, initialReport, initialFilterByUser }) => {
  const { selectedOutletId } = useSelectedOutlet();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState([]);
  const [value, setValue] = useState(null);
  const [filterByUser, setFilterByUser] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFilterByUser(Boolean(initialFilterByUser));
    setValue(initialReport || null);
    setLoading(true);
    const params = { allUsers: 1 };
    if (selectedOutletId != null) params.outletId = selectedOutletId;
    favouriteReportService
      .getAll(params)
      .then((res) => {
        setOptions(res?.data || []);
      })
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [open, initialReport, initialFilterByUser, selectedOutletId]);

  const handleSave = () => {
    if (!value) return;
    onSave({ favouriteReport: value, filterByUser });
    onClose();
  };

  // Reference labels other users' favourites as "Report Name(owner)"
  const reportLabel = (o) =>
    o ? `${o.name}${o.user && o.user.id !== user?.id ? `(${o.user.name})` : ''}` : '';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ textAlign: 'center', pt: 3 }}>
        <Avatar sx={{ width: 64, height: 64, mx: 'auto', mb: 1, bgcolor: '#1976d2' }}>
          <HelpOutlineIcon sx={{ fontSize: 36 }} />
        </Avatar>
        <Typography variant="h6" fontWeight={700}>
          Edit Dashboard Item
        </Typography>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Autocomplete
              options={options}
              value={value}
              onChange={(_, v) => setValue(v)}
              getOptionLabel={reportLabel}
              isOptionEqualToValue={(a, b) => a?.id === b?.id}
              renderInput={(params) => (
                <TextField {...params} label="Favourite report" placeholder="Search..." size="small" />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2">▦</Typography>
                    <Typography>{reportLabel(option)}</Typography>
                  </Box>
                </li>
              )}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={filterByUser}
                  onChange={(e) => setFilterByUser(e.target.checked)}
                  color="primary"
                />
              }
              label="Filter report by current user"
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={!value}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditDashboardItemDialog;
