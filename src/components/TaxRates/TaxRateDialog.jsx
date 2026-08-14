import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  Box,
  Typography,
  MenuItem,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CloseIcon from '@mui/icons-material/Close';
import { taxRateService } from '../../services/taxRateService';
import { outletService } from '../../services/outletService';
import { useAuth } from '../../contexts/AuthContext';

const TaxRateDialog = ({ open, onClose, onSave, taxRate = null, mode = 'create' }) => {
  const { user, isSuperAdmin } = useAuth();
  const isEditMode = mode === 'edit' && taxRate;

  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    masterDatabaseRef: '',
    isActive: true,
    isDefault: false,
    outletId: null,
  });

  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      loadOutlets();
      
      if (isEditMode && taxRate) {
        setFormData({
          name: taxRate.name || '',
          amount: taxRate.amount?.toString() || '',
          masterDatabaseRef: taxRate.masterDatabaseRef || '',
          isActive: taxRate.isActive ?? true,
          isDefault: taxRate.isDefault ?? false,
          outletId: taxRate.outletId || null,
        });
      } else {
        // Reset form for create mode
        setFormData({
          name: '',
          amount: '',
          masterDatabaseRef: '',
          isActive: true,
          isDefault: false,
          outletId: !isSuperAdmin() && user?.outletId ? user.outletId : null,
        });
      }
      setError('');
    }
  }, [open, isEditMode, taxRate, isSuperAdmin, user]);

  const loadOutlets = async () => {
    try {
      if (isSuperAdmin()) {
        const response = await outletService.getAllOutlets();
        setOutlets(response.outlets || []);
      }
    } catch (err) {
      console.error('Error loading outlets:', err);
      setOutlets([]);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError('');
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError('');

      // Validation
      if (!formData.name.trim()) {
        setError('Tax rate name is required');
        return;
      }

      if (!formData.amount || isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) < 0) {
        setError('Amount must be a valid number greater than or equal to 0');
        return;
      }

      const taxRateData = {
        name: formData.name.trim(),
        amount: parseFloat(formData.amount),
        masterDatabaseRef: formData.masterDatabaseRef.trim() || null,
        isActive: formData.isActive,
        isDefault: formData.isDefault,
        outletId: formData.outletId || null,
      };

      let response;
      if (isEditMode) {
        response = await taxRateService.updateTaxRate(taxRate.id, taxRateData);
      } else {
        response = await taxRateService.createTaxRate(taxRateData);
      }

      onSave(response.taxRate);
      handleClose();
    } catch (err) {
      console.error('Error saving tax rate:', err);
      setError(err.response?.data?.error || 'An error occurred while saving the tax rate');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      amount: '',
      masterDatabaseRef: '',
      isActive: true,
      isDefault: false,
      outletId: null,
    });
    setError('');
    onClose();
  };

  // ponytail: no master-DB tax-rate endpoint exists; static reference list matching the reference site,
  // plus the current value so edit mode never loses a stored ref.
  const masterRefOptions = React.useMemo(() => {
    const opts = ['GST'];
    if (formData.masterDatabaseRef && !opts.includes(formData.masterDatabaseRef)) {
      opts.push(formData.masterDatabaseRef);
    }
    return opts;
  }, [formData.masterDatabaseRef]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      PaperProps={{ sx: { width: 448, maxWidth: '92vw', borderRadius: '8px' } }}
    >
      <DialogTitle
        sx={{
          backgroundColor: 'oklch(90.1% .058 230.902)',
          color: 'oklch(44.3% .11 240.79)',
          fontSize: 16,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <HelpOutlineIcon sx={{ fontSize: 20 }} />
        {isEditMode ? 'Edit Tax Rate' : 'Create Tax Rate'}
      </DialogTitle>
      
      <DialogContent sx={{ mt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Name"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            fullWidth
            required
            placeholder="Enter tax rate name (e.g., GST, VAT)"
            sx={{
              marginTop: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: 1,
              },
            }}
          />

          <TextField
            label="Amount"
            value={formData.amount}
            onChange={(e) => handleInputChange('amount', e.target.value)}
            fullWidth
            required
            type="number"
            inputProps={{ min: 0, step: 0.01 }}
            placeholder="Enter tax percentage (e.g., 10.0 for 10%)"
            InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
          />

          <TextField
            select
            label="Master Database Reference"
            value={formData.masterDatabaseRef}
            onChange={(e) => handleInputChange('masterDatabaseRef', e.target.value)}
            fullWidth
            InputProps={{
              endAdornment: formData.masterDatabaseRef ? (
                <InputAdornment position="end" sx={{ mr: 2.5 }}>
                  <IconButton
                    size="small"
                    aria-label="Clear master database reference"
                    onClick={() => handleInputChange('masterDatabaseRef', '')}
                  >
                    <CloseIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          >
            {masterRefOptions.map((ref) => (
              <MenuItem key={ref} value={ref}>
                {ref}
              </MenuItem>
            ))}
          </TextField>

          {/* Outlet Selection - Only for Super Admin */}
          {isSuperAdmin() && (
            <TextField
              select
              label="Outlet"
              value={formData.outletId || ''}
              onChange={(e) => handleInputChange('outletId', e.target.value === '' ? null : parseInt(e.target.value))}
              fullWidth
            >
              <MenuItem value="">
                <em>Global (All Outlets)</em>
              </MenuItem>
              {outlets.map((outlet) => (
                <MenuItem key={outlet.id} value={outlet.id}>
                  {outlet.name} ({outlet.code})
                </MenuItem>
              ))}
            </TextField>
          )}

          {/* Current outlet info for non-super admin */}
          {!isSuperAdmin() && user?.outletId && (
            <Typography variant="body2" color="text.secondary">
              This tax rate will be created for your current outlet.
            </Typography>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isActive}
                  onChange={(e) => handleInputChange('isActive', e.target.checked)}
                />
              }
              label="Active"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.isDefault}
                  onChange={(e) => handleInputChange('isDefault', e.target.checked)}
                />
              }
              label="Set as Default"
            />
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={handleClose}
          disabled={loading}
          disableElevation
          sx={{
            bgcolor: '#d9d9d9',
            color: '#000',
            textTransform: 'none',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: 16,
            height: 42,
            px: 3,
            transition: 'all 0s ease',
            '&:hover': { bgcolor: '#cccccc', boxShadow: 'none' },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          disableElevation
          sx={{
            backgroundColor: '#0ea5e9',
            color: '#fff',
            textTransform: 'none',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: 16,
            height: 42,
            px: 3,
            transition: 'all 0s ease',
            '&:hover': { backgroundColor: '#38bdf8', boxShadow: 'none' },
          }}
        >
          {loading ? null : (isEditMode ? 'Update' : 'Create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TaxRateDialog;
