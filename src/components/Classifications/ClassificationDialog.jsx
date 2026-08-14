import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  Select,
  MenuItem,
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Autocomplete,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  HelpOutline as HelpOutlineIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import masterDatabaseService from '../../services/masterDatabaseService';

// Shopfront-style field: dark-gray 1px outline, black 2px on focus, 8px radius, 42px tall
const fieldSx = {
  backgroundColor: 'white',
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    fontSize: 16,
    height: 42,
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' },
  },
};

const ClassificationDialog = ({ open, onClose, onSave, editingClassification, saveError }) => {
  const { isSuperAdmin, getOutletId } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    type: 'BRAND',
    masterDatabaseRef: '',
    mscMapping: '',
    outletId: null,
    color: '',
  });
  const [errors, setErrors] = useState({});
  // Master Database Reference: searchable async dropdown backed by master suppliers
  const [mdrOptions, setMdrOptions] = useState([]);
  const [mdrInput, setMdrInput] = useState('');
  const [mdrLoading, setMdrLoading] = useState(false);

  useEffect(() => {
    if (editingClassification) {
      setFormData({
        name: editingClassification.name || '',
        type: editingClassification.type || 'BRAND',
        masterDatabaseRef: editingClassification.masterDatabaseRef || '',
        mscMapping: editingClassification.mscMapping || '',
        outletId: editingClassification.outletId || null,
        color: editingClassification.color || '',
      });
      setMdrInput(editingClassification.masterDatabaseRef || '');
    } else {
      setFormData({
        name: '',
        type: 'BRAND',
        masterDatabaseRef: '',
        mscMapping: '',
        outletId: isSuperAdmin() ? null : getOutletId(),
        color: '',
      });
      setMdrInput('');
    }
    setErrors({});
  }, [editingClassification, open, isSuperAdmin, getOutletId]);

  // Debounced master-supplier lookup for the reference dropdown (only while open)
  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    const handle = setTimeout(async () => {
      try {
        setMdrLoading(true);
        const data = await masterDatabaseService.getSuppliers({ search: mdrInput });
        if (active) {
          setMdrOptions(
            (data.suppliers || [])
              .map((s) => s.name || s.reference)
              .filter(Boolean)
          );
        }
      } catch {
        if (active) setMdrOptions([]);
      } finally {
        if (active) setMdrLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [mdrInput, open]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.type) {
      newErrors.type = 'Type is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      return;
    }

    const cleanedData = {
      ...formData,
      name: formData.name.trim(),
      masterDatabaseRef: formData.masterDatabaseRef.trim() || null,
      mscMapping: formData.mscMapping || null,
      outletId: formData.outletId || null,
      color: formData.color || null,
    };

    onSave(cleanedData);
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          borderRadius: '8px',
          width: 404,
          maxWidth: 404,
        }
      }}
    >
      {/* Light-sky title band with inline '?' icon + sky-800 title */}
      <Box
        sx={{
          height: 60,
          minHeight: 60,
          bgcolor: '#bae6fd',
          borderRadius: '8px 8px 0 0',
          display: 'flex',
          alignItems: 'center',
          px: 2,
          gap: 1,
        }}
      >
        <HelpOutlineIcon sx={{ fontSize: 22, color: '#075985' }} />
        <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#075985' }}>
          {editingClassification ? 'Edit Classification' : 'Create New Classification'}
        </Typography>
      </Box>

      <DialogContent sx={{ p: 2, pb: 1 }}>
        {saveError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {saveError}
          </Alert>
        )}
        {/* Segmented type control on gray track, selected = solid sky */}
        <ToggleButtonGroup
          value={formData.type}
          exclusive
          onChange={(e, newType) => {
            if (newType !== null) {
              handleInputChange('type', newType);
            }
          }}
          sx={{
            width: '100%',
            bgcolor: 'rgba(0,0,0,0.1)',
            borderRadius: '8px',
            p: '4px',
            gap: '4px',
            mb: 2,
            '& .MuiToggleButton-root': {
              flex: 1,
              height: 48,
              border: 0,
              borderRadius: '4px !important',
              textTransform: 'none',
              fontSize: 16,
              fontWeight: 400,
              color: '#000',
              bgcolor: 'transparent',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
              '&.Mui-selected': {
                backgroundColor: '#5ebbeb',
                color: '#fff',
                '&:hover': { backgroundColor: '#5ebbeb' },
              },
            }
          }}
        >
          <ToggleButton value="BRAND">Brand</ToggleButton>
          <ToggleButton value="CATEGORY">Category</ToggleButton>
          <ToggleButton value="FAMILY">Family</ToggleButton>
          <ToggleButton value="TAG">Tag</ToggleButton>
        </ToggleButtonGroup>

        <Typography sx={{ fontSize: 16, color: '#000', mb: 0.5 }}>Name</Typography>
        <TextField
          fullWidth
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          error={!!errors.name}
          helperText={errors.name}
          sx={{ ...fieldSx, mb: 2 }}
        />

        <Typography sx={{ fontSize: 16, color: '#000', mb: 0.5 }}>Master Database Reference</Typography>
        {/* Parity: searchable async dropdown populated from the master-database supplier list */}
        <FormControl fullWidth sx={{ mb: 1 }}>
          <Autocomplete
            freeSolo
            options={mdrOptions}
            loading={mdrLoading}
            value={formData.masterDatabaseRef || null}
            onChange={(e, newVal) => handleInputChange('masterDatabaseRef', newVal || '')}
            inputValue={mdrInput}
            onInputChange={(e, newInput) => setMdrInput(newInput)}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Select..."
                sx={{
                  backgroundColor: 'white',
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    fontSize: 16,
                    minHeight: 42,
                    py: 0,
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' },
                  },
                  '& .MuiOutlinedInput-input::placeholder': { color: '#808080', opacity: 1 },
                }}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {mdrLoading ? <CircularProgress color="inherit" size={16} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        </FormControl>

        {/* Family colour: feeds the sell-screen cart-line colour strip (reference
            .product-family-colour). Family type only. */}
        {formData.type === 'FAMILY' && (
          <Box sx={{ mt: 1 }}>
            <Typography sx={{ fontSize: 16, color: '#000', mb: 0.5 }}>Colour</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <input
                type="color"
                value={formData.color || '#ffffff'}
                onChange={(e) => handleInputChange('color', e.target.value)}
                style={{ width: 60, height: 42, border: '1px solid #404040', borderRadius: 8, padding: 2, background: 'white', cursor: 'pointer' }}
              />
              {formData.color ? (
                <Button size="small" onClick={() => handleInputChange('color', '')} sx={{ textTransform: 'none', color: '#676b72' }}>
                  Clear
                </Button>
              ) : (
                <Typography sx={{ fontSize: 14, color: '#808080' }}>No colour</Typography>
              )}
            </Box>
          </Box>
        )}

        {/* MSC Mapping - shown for all non-Brand types (Category, Family, Tag) */}
        {formData.type !== 'BRAND' && (
          <Box sx={{ mt: 1 }}>
            <Typography sx={{ fontSize: 16, color: '#000', mb: 0.5 }}>MSC Mapping</Typography>
            <FormControl fullWidth>
              <Select
                value={formData.mscMapping || ''}
                onChange={(e) => handleInputChange('mscMapping', e.target.value)}
                displayEmpty
                sx={{
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  fontSize: 16,
                  height: 42,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
                }}
              >
                <MenuItem value="">
                  <em>Select...</em>
                </MenuItem>
                <MenuItem value="195010101">195010101</MenuItem>
                <MenuItem value="195010104">195010104</MenuItem>
                <MenuItem value="1629202">1629202</MenuItem>
              </Select>
            </FormControl>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
        <Button
          onClick={handleCancel}
          sx={{
            backgroundColor: '#d4d4d4',
            color: '#000',
            width: 118,
            height: 42,
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: 16,
            textTransform: 'none',
            boxShadow: 'none',
            '&:hover': { backgroundColor: '#c4c4c4', boxShadow: 'none' },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          sx={{
            backgroundColor: '#0ea5e9',
            color: '#fff',
            width: 118,
            height: 42,
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: 16,
            textTransform: 'none',
            boxShadow: 'none',
            '&:hover': { backgroundColor: '#0284c7', boxShadow: 'none' },
          }}
        >
          {editingClassification ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ClassificationDialog;
