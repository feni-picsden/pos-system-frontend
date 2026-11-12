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
import { SHOW_MASTER_DATABASE_REF } from '../../utils/featureFlags';
import { outletService } from '../../services/outletService';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import { REF_MENU_PROPS } from '../Common/refMenuProps';

const NAME_MAX = 100;

const TaxRateDialog = ({ open, onClose, onSave, taxRate = null, mode = 'create' }) => {
  const { user, isTrueSuperAdmin } = useAuth();
  // Navbar outlet (super admin): a new tax rate defaults to it and the Outlet
  // field is hidden; on All Outlets the field is shown (Global / outlet).
  const { selectedOutletId: headerOutletId } = useSelectedOutlet();
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
          outletId: !isTrueSuperAdmin() && user?.outletId ? user.outletId : (headerOutletId ?? null),
        });
      }
      setError('');
    }
  }, [open, isEditMode, taxRate, isTrueSuperAdmin, user, headerOutletId]);

  const loadOutlets = async () => {
    try {
      if (isTrueSuperAdmin()) {
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
      if (formData.name.trim().length > NAME_MAX) {
        setError(`Tax rate name must be ${NAME_MAX} characters or fewer`);
        return;
      }

      const amount = parseFloat(formData.amount);
      if (String(formData.amount).trim() === '' || !Number.isFinite(amount) || amount < 0 || amount > 100) {
        setError('Amount must be a number between 0 and 100');
        return;
      }

      const taxRateData = {
        name: formData.name.trim(),
        amount,
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
            placeholder="Name"
            inputProps={{ maxLength: NAME_MAX }}
            sx={{
              marginTop: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px',
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
            inputProps={{ min: 0, max: 100, step: 0.01 }}
            placeholder="Amount"
            InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
          />

          {SHOW_MASTER_DATABASE_REF && (
          <TextField
            select
            label="Master Database Reference"
            value={formData.masterDatabaseRef}
            onChange={(e) => handleInputChange('masterDatabaseRef', e.target.value)}
            fullWidth
            SelectProps={{ MenuProps: REF_MENU_PROPS }}
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
          )}

          {/* Outlet Selection - super admin on All Outlets only; a navbar outlet
              fixes the outlet (header rule, 16/10/2026) */}
          {isTrueSuperAdmin() && headerOutletId != null && (
            <Typography variant="body2" color="text.secondary">
              This tax rate will be created for the selected outlet.
            </Typography>
          )}
          {isTrueSuperAdmin() && headerOutletId == null && (
            <TextField
              select
              label="Outlet"
              value={formData.outletId || ''}
              onChange={(e) => handleInputChange('outletId', e.target.value === '' ? null : parseInt(e.target.value))}
              fullWidth
              SelectProps={{ MenuProps: REF_MENU_PROPS }}
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
          {!isTrueSuperAdmin() && user?.outletId && (
            <Typography variant="body2" color="text.secondary">
              This tax rate will be created for your current outlet.
            </Typography>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* The current default can't be made inactive or un-defaulted here;
                pick another rate's "Set as Default" first (server rejects both). */}
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isActive}
                  disabled={Boolean(isEditMode && taxRate?.isDefault)}
                  onChange={(e) => handleInputChange('isActive', e.target.checked)}
                />
              }
              label="Active"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.isDefault}
                  disabled={Boolean(isEditMode && taxRate?.isDefault)}
                  onChange={(e) => handleInputChange('isDefault', e.target.checked)}
                />
              }
              label="Set as Default"
            />
            {isEditMode && taxRate?.isDefault && (
              <Typography variant="body2" color="text.secondary">
                This is the default tax rate. Set another rate as default first to change these.
              </Typography>
            )}
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
            minWidth: 96,
            transition: 'all 0s ease',
            '&:hover': { backgroundColor: '#38bdf8', boxShadow: 'none' },
            // Keep the blue while saving so the spinner stays visible.
            '&.Mui-disabled': { backgroundColor: '#0ea5e9', color: '#fff', opacity: 0.85 },
          }}
        >
          {loading ? (
            <CircularProgress size={20} thickness={5} sx={{ color: '#fff' }} />
          ) : (isEditMode ? 'Update' : 'Create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TaxRateDialog;
