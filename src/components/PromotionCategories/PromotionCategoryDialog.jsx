import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControlLabel,
  Box,
  Typography,
  MenuItem,
  Alert,
  CircularProgress,
  Chip,
  FormControl,
  InputLabel,
  Select,
  OutlinedInput,
} from '@mui/material';
import promotionCategoryService from '../../services/promotionCategoryService';
import ShopfrontSwitch from '../Common/ShopfrontSwitch';
import { useAuth } from '../../contexts/AuthContext';

// System input styling: #404040 1px outline, radius 8px, focused #000 2px
const INPUT_SX = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    '& fieldset': { borderColor: '#404040', borderWidth: '1px' },
    '&:hover fieldset': { borderColor: '#404040' },
    '&.Mui-focused fieldset': { borderColor: '#000', borderWidth: '2px' },
  },
  '& input::placeholder': { color: '#808080', opacity: 1 },
};

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

const PromotionCategoryDialog = ({ open, onClose, onSave, promotionCategory = null, mode = 'create' }) => {
  const { user, isSuperAdmin } = useAuth();
  const isEditMode = mode === 'edit' && promotionCategory;

  const [formData, setFormData] = useState({
    name: '',
    promotionSource: '',
    showOnOrder: false,
    includeInIntegrations: false,
    outletIds: [],
    isActive: true,
    outletId: null,
  });

  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      loadOutlets();
      
      if (isEditMode && promotionCategory) {
        const existingOutletIds = promotionCategory.outletIds 
          ? (typeof promotionCategory.outletIds === 'string' 
             ? JSON.parse(promotionCategory.outletIds) 
             : promotionCategory.outletIds)
          : [];

        setFormData({
          name: promotionCategory.name || '',
          promotionSource: promotionCategory.promotionSource || '',
          showOnOrder: promotionCategory.showOnOrder ?? false,
          includeInIntegrations: promotionCategory.includeInIntegrations ?? false,
          outletIds: existingOutletIds,
          isActive: promotionCategory.isActive ?? true,
          outletId: promotionCategory.outletId || null,
        });
      } else {
        // Reset form for create mode
        setFormData({
          name: '',
          promotionSource: '',
          showOnOrder: false,
          includeInIntegrations: false,
          outletIds: [],
          isActive: true,
          outletId: !isSuperAdmin() && user?.outletId ? user.outletId : null,
        });
      }
      setError('');
    }
  }, [open, isEditMode, promotionCategory, isSuperAdmin, user]);

  const loadOutlets = async () => {
    try {
      const response = await promotionCategoryService.getAvailableOutlets();
      setOutlets(response.outlets || []);
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

  const handleOutletIdsChange = (event) => {
    const value = event.target.value;
    setFormData(prev => ({
      ...prev,
      outletIds: typeof value === 'string' ? value.split(',') : value
    }));
    setError('');
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError('');

      // Validation
      if (!formData.name.trim()) {
        setError('Promotion category name is required');
        return;
      }

      const promotionCategoryData = {
        name: formData.name.trim(),
        promotionSource: formData.promotionSource.trim() || null,
        showOnOrder: formData.showOnOrder,
        includeInIntegrations: formData.includeInIntegrations,
        outletIds: formData.outletIds.length > 0 ? formData.outletIds.map(id => parseInt(id)) : null,
        isActive: formData.isActive,
        outletId: formData.outletId || null,
      };

      let response;
      if (isEditMode) {
        response = await promotionCategoryService.updatePromotionCategory(promotionCategory.id, promotionCategoryData);
      } else {
        response = await promotionCategoryService.createPromotionCategory(promotionCategoryData);
      }

      onSave(response.promotionCategory);
      handleClose();
    } catch (err) {
      console.error('Error saving promotion category:', err);
      const data = err.response?.data;
      const detailMsg = Array.isArray(data?.details) && data.details.length > 0
        ? data.details.map((d) => d.msg).join('; ')
        : null;
      setError(detailMsg || data?.error || 'An error occurred while saving the promotion category');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      promotionSource: '',
      showOnOrder: false,
      includeInIntegrations: false,
      outletIds: [],
      isActive: true,
      outletId: null,
    });
    setError('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: '12px' } }}
    >
      <DialogTitle sx={{ backgroundColor: 'oklch(90.1% .058 230.902)', color: 'oklch(44.3% .11 240.79)', fontSize: 16 }}>
        {isEditMode ? 'Edit Promotion Category' : 'Create Promotion Category'}
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
            placeholder="Enter promotion category name"
            sx={{ marginTop: 2, ...INPUT_SX }}
          />

          <TextField
            select
            label="Connected Promotion Source"
            value={formData.promotionSource}
            onChange={(e) => handleInputChange('promotionSource', e.target.value)}
            fullWidth
            SelectProps={{
              MenuProps: {
                PaperProps: {
                  style: {
                    maxHeight: 300,
                    minHeight: 200,
                  },
                },
              },
            }}
            sx={{
              ...INPUT_SX,
              '& .MuiOutlinedInput-root': {
                ...INPUT_SX['& .MuiOutlinedInput-root'],
                minHeight: '56px',
              },
            }}
          >
            <MenuItem value="">
              <em>Select...</em>
            </MenuItem>
            <MenuItem disabled sx={{ fontWeight: 'bold', color: 'text.primary' }}>
              Master Database
            </MenuItem>
            <MenuItem value="Banner Group Promotion">Banner Group Promotion</MenuItem>
            <MenuItem value="Cellar Savers">Cellar Savers</MenuItem>
            <MenuItem value="Cellar Select">Cellar Select</MenuItem>
            <MenuItem value="IBA Platinum">IBA Platinum</MenuItem>
            <MenuItem value="Manager's Special">Manager's Special</MenuItem>
            <MenuItem value="My Bottle-O Rewards">My Bottle-O Rewards</MenuItem>
            <MenuItem value="Porters Instore">Porters Instore</MenuItem>
            <MenuItem value="Porters Rewards">Porters Rewards</MenuItem>
            <MenuItem value="Super Good Value">Super Good Value</MenuItem>
            <MenuItem value="Super Store">Super Store</MenuItem>
            <MenuItem value="Top 100">Top 100</MenuItem>
            <MenuItem value="Top Drop Rewards">Top Drop Rewards</MenuItem>
            <MenuItem value="Top Shelf">Top Shelf</MenuItem>
          </TextField>

          {/* Outlet Selection - Only for Super Admin */}
          {isSuperAdmin() && (
            <TextField
              select
              label="Outlet"
              value={formData.outletId || ''}
              onChange={(e) => handleInputChange('outletId', e.target.value === '' ? null : parseInt(e.target.value))}
              fullWidth
              sx={INPUT_SX}
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
              This promotion category will be created for your current outlet.
            </Typography>
          )}

          {/* Outlets to receive promotions */}
          <FormControl fullWidth sx={INPUT_SX}>
            <InputLabel>Outlets to receive promotions</InputLabel>
            <Select
              multiple
              value={formData.outletIds}
              onChange={handleOutletIdsChange}
              input={<OutlinedInput label="Outlets to receive promotions" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => {
                    const outlet = outlets.find(o => o.id === parseInt(value));
                    return (
                      <Chip 
                        key={value} 
                        label={outlet ? `${outlet.name} (${outlet.code})` : value}
                        size="small" 
                      />
                    );
                  })}
                </Box>
              )}
              MenuProps={MenuProps}
            >
              {outlets.map((outlet) => (
                <MenuItem key={outlet.id} value={outlet.id}>
                  {outlet.name} ({outlet.code})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <FormControlLabel
              sx={{ ml: 0, gap: 1.5 }}
              control={
                <ShopfrontSwitch
                  checked={formData.showOnOrder}
                  onChange={(e) => handleInputChange('showOnOrder', e.target.checked)}
                />
              }
              label="Show a promotional icon for products when creating an order"
            />

            <FormControlLabel
              sx={{ ml: 0, gap: 1.5 }}
              control={
                <ShopfrontSwitch
                  checked={formData.includeInIntegrations}
                  onChange={(e) => handleInputChange('includeInIntegrations', e.target.checked)}
                />
              }
              label="Send promotions within this category to integrations"
            />

            <FormControlLabel
              sx={{ ml: 0, gap: 1.5 }}
              control={
                <ShopfrontSwitch
                  checked={formData.isActive}
                  onChange={(e) => handleInputChange('isActive', e.target.checked)}
                />
              }
              label="Active"
            />
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1.25 }}>
        <Button
          onClick={handleClose}
          disabled={loading}
          disableRipple
          disableElevation
          sx={{
            bgcolor: '#8a8d91',
            color: '#fff',
            textTransform: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            px: 3,
            '&:hover': { bgcolor: '#76797d' },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          disableRipple
          disableElevation
          sx={{
            bgcolor: '#5ebbeb',
            color: '#fff',
            textTransform: 'none',
            boxShadow: 'none',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: 16,
            height: 42,
            px: 4,
            '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' },
          }}
        >
          {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update' : 'Create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PromotionCategoryDialog;
