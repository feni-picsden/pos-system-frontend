import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
} from '@mui/material';
import { HelpOutline as HelpOutlineIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import customerGroupService from '../../services/customerGroupService';
import { useAuth } from '../../contexts/AuthContext';

const dialogButtonSx = (bgcolor, color, hoverBg) => ({
  bgcolor,
  color,
  height: 42,
  borderRadius: '12px',
  textTransform: 'none',
  fontWeight: 700,
  fontSize: 16,
  px: 3,
  '&:hover': { bgcolor: hoverBg, boxShadow: 'none' },
});

const CustomerGroupDialog = ({ open, onClose, customerGroup, onGroupSaved }) => {
  const navigate = useNavigate();
  const { isSuperAdmin, getOutletId } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    outletId: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  const isEditMode = !!customerGroup;

  useEffect(() => {
    if (open) {
      setFormData({
        name: customerGroup?.name || '',
        // ponytail: the reference dialog only asks for a name — a super admin without an
        // assigned outlet picks one on the group page, which already has that select.
        outletId: customerGroup?.outletId || (isSuperAdmin() ? null : getOutletId()),
      });
      setError('');
      setValidationErrors({});
    }
  }, [open, customerGroup, isSuperAdmin, getOutletId]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setValidationErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) {
      errors.name = 'Customer group name is required';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    if (isEditMode) {
      // For edit mode, save the changes
      setLoading(true);
      setError('');

      try {
        // Prepare the data to send, ensuring outletId is properly handled
        const dataToSend = {
          ...formData,
          outletId: formData.outletId || null
        };

        await customerGroupService.updateCustomerGroup(customerGroup.id, dataToSend);
        onGroupSaved();
        onClose();
      } catch (err) {
        const errorMessage = err.response?.data?.error || 'Failed to save customer group';
        setError(errorMessage);
        if (err.response?.data?.details) {
          const apiErrors = {};
          err.response.data.details.forEach(detail => {
            apiErrors[detail.path] = detail.msg;
          });
          setValidationErrors(apiErrors);
        }
        console.error('Error saving customer group:', err);
      } finally {
        setLoading(false);
      }
    } else {
      // For create mode, navigate to details page with the name and outletId
      const queryParams = new URLSearchParams({
        name: formData.name,
        outletId: formData.outletId || ''
      });
      onClose();
      navigate(`/customers/groups/new?${queryParams.toString()}`);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      transitionDuration={150}
      PaperProps={{
        sx: {
          width: 347,
          maxWidth: '92vw',
          borderRadius: '8px',
          boxShadow: 'none',
          overflow: 'hidden',
        }
      }}
    >
      {/* Header band: light-blue with a "?" and the title */}
      <Box sx={{ bgcolor: '#bae6fd', px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <HelpOutlineIcon sx={{ color: '#0369a1', fontSize: 22 }} />
        <Typography sx={{ color: '#0369a1', fontWeight: 400, fontSize: 18 }}>
          {isEditMode ? 'Edit Customer Group' : 'Create Customer Group'}
        </Typography>
      </Box>

      <DialogContent sx={{ px: 2, py: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {!isEditMode && (
          <Typography sx={{ color: '#313439', fontSize: 16, mb: 1 }}>
            What should this Customer Group be called?
          </Typography>
        )}

        <TextField
          fullWidth
          autoFocus
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          error={!!validationErrors.name}
          helperText={validationErrors.name}
          sx={{
            '& .MuiOutlinedInput-root': {
              height: 42,
              borderRadius: '8px',
              fontSize: 16,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' }
            },
            '& .MuiOutlinedInput-input': { py: 0 },
          }}
        />
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2, pt: 0, gap: 1 }}>
        <Button
          onClick={handleCancel}
          disableElevation
          sx={dialogButtonSx('#d4d4d4', '#000', '#c4c4c4')}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading}
          disableElevation
          sx={dialogButtonSx('#38bdf8', '#fff', '#0ea5e9')}
        >
          {isEditMode ? 'Save Changes' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CustomerGroupDialog;
