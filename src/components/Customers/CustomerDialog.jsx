import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Avatar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Person as PersonIcon } from '@mui/icons-material';
import customerService from '../../services/customerService';
import customerGroupService from '../../services/customerGroupService';
import priceListService from '../../services/priceListService';
import outletService from '../../services/outletService';
import { useAuth } from '../../contexts/AuthContext';

const CustomerDialog = ({ open, onClose, customer, onCustomerSaved }) => {
  const { isSuperAdmin, getOutletId } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    code: '',
    customerGroupId: '',
    priceListId: '',
    outletId: null,
  });
  const [customerGroups, setCustomerGroups] = useState([]);
  const [priceLists, setPriceLists] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  const isEditMode = !!customer;

  // Load outlets for super admin
  useEffect(() => {
    const loadOutlets = async () => {
      if (isSuperAdmin()) {
        try {
          const response = await outletService.getAllOutlets();
          setOutlets(response.outlets || []);
        } catch (error) {
          console.error('Error loading outlets:', error);
        }
      }
    };

    if (open) {
      loadOutlets();
    }
  }, [open, isSuperAdmin]);

  useEffect(() => {
    if (open) {
      loadCustomerGroups();
      loadPriceLists();
      if (customer) {
        setFormData({
          firstName: customer.firstName || '',
          lastName: customer.lastName || '',
          email: customer.email || '',
          phone: customer.phone || '',
          company: customer.company || '',
          code: customer.code || '',
          customerGroupId: customer.customerGroupId || '',
          priceListId: customer.priceListId || '',
          outletId: customer.outletId || null,
        });
      } else {
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          company: '',
          code: '',
          customerGroupId: '',
          priceListId: '',
          outletId: isSuperAdmin() ? null : getOutletId(),
        });
      }
      setError('');
      setValidationErrors({});
    }
  }, [open, customer, isSuperAdmin, getOutletId]);

  const loadCustomerGroups = async (selectedOutletId = null) => {
    try {
      const response = await customerGroupService.getCustomerGroups();
      if (response.customerGroups) {
        const outletIdToFilter = selectedOutletId || formData.outletId || getOutletId();
        let filtered = response.customerGroups;
        if (outletIdToFilter) {
          filtered = response.customerGroups.filter(
            (g) => (g.outletId === outletIdToFilter || g.outletId === null) && g.isActive
          );
        } else if (!isSuperAdmin()) {
          const userOutletId = getOutletId();
          filtered = response.customerGroups.filter(
            (g) => (g.outletId === userOutletId || g.outletId === null) && g.isActive
          );
        } else {
          // For super admin, filter by active status only
          filtered = response.customerGroups.filter(g => g.isActive);
        }
        setCustomerGroups(filtered);
      } else {
        setCustomerGroups([]);
      }
    } catch (err) {
      console.error('Error loading customer groups:', err);
      setCustomerGroups([]);
    }
  };

  const loadPriceLists = async (selectedOutletId = null) => {
    try {
      const response = await priceListService.getPriceLists();
      if (response.priceLists) {
        const outletIdToFilter = selectedOutletId || formData.outletId || getOutletId();
        let filtered = response.priceLists;
        if (outletIdToFilter) {
          filtered = response.priceLists.filter(
            (p) => (p.outletId === outletIdToFilter || p.outletId === null) && p.isActive
          );
        } else if (!isSuperAdmin()) {
          const userOutletId = getOutletId();
          filtered = response.priceLists.filter(
            (p) => (p.outletId === userOutletId || p.outletId === null) && p.isActive
          );
        } else {
          // For super admin, filter by active status only
          filtered = response.priceLists.filter(p => p.isActive);
        }
        setPriceLists(filtered);
      } else {
        setPriceLists([]);
      }
    } catch (err) {
      console.error('Error loading price lists:', err);
      setPriceLists([]);
    }
  };

  const handleInputChange = (field, value) => {
    if (field === 'outletId') {
      const newOutletId = value;
      setFormData(prev => ({ ...prev, outletId: newOutletId, customerGroupId: '', priceListId: '' }));
      // Reload dependent lists when outlet changes
      loadCustomerGroups(newOutletId);
      loadPriceLists(newOutletId);
      setValidationErrors(prev => ({ ...prev, outletId: '' }));
      return;
    }
    setFormData(prev => ({ ...prev, [field]: value }));
    setValidationErrors(prev => ({ ...prev, [field]: '' }));
  };

  // Reload lists when outletId is initialized later (e.g., after open)
  useEffect(() => {
    if (open) {
      loadCustomerGroups(formData.outletId);
      loadPriceLists(formData.outletId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.outletId]);

  const validateForm = () => {
    let errors = {};
    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required';
    }
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (isSuperAdmin() && !formData.outletId) {
      errors.outletId = 'Please select an outlet';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError('');

    try {
      // Prepare the data to send, ensuring outletId is properly handled
      const dataToSend = {
        ...formData,
        outletId: formData.outletId || null
      };

      console.log('Sending customer data:', dataToSend); // Debug log

      if (isEditMode) {
        await customerService.updateCustomer(customer.id, dataToSend);
      } else {
        await customerService.createCustomer(dataToSend);
      }
      onCustomerSaved();
    } catch (err) {
      setError(err.response?.data?.error || `Failed to ${isEditMode ? 'update' : 'create'} customer`);
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} customer:`, err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      fullWidth 
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: 2,
          minHeight: '400px',
        }
      }}
    >
      {/* Header with Icon and Title */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        flexDirection: 'column',
        pt: 3,
        pb: 2
      }}>
        <Avatar 
          sx={{ 
            bgcolor: '#2196f3', 
            width: 64, 
            height: 64, 
            mb: 2 
          }}
        >
          <PersonIcon sx={{ fontSize: 36, color: 'white' }} />
        </Avatar>
        <DialogTitle sx={{ p: 0, textAlign: 'center' }}>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold' }}>
            {isEditMode ? 'Edit Customer' : 'Create Customer'}
          </Typography>
        </DialogTitle>
        {!isEditMode && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
            Add a new customer to your system
          </Typography>
        )}
      </Box>

      <DialogContent dividers sx={{ px: 4, py: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="First Name"
              value={formData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              error={!!validationErrors.firstName}
              helperText={validationErrors.firstName}
              fullWidth
              required
              placeholder="Enter first name"
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1,
                },
              }}
            />
            <TextField
              label="Last Name"
              value={formData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              error={!!validationErrors.lastName}
              helperText={validationErrors.lastName}
              fullWidth
              placeholder="Enter last name"
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1,
                },
              }}
            />
          </Box>
          
          <TextField
            label="Email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            error={!!validationErrors.email}
            helperText={validationErrors.email}
            fullWidth
            placeholder="Enter email address"
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 1,
              },
            }}
          />
          
          <TextField
            label="Phone"
            value={formData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            fullWidth
            placeholder="Enter phone number"
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 1,
              },
            }}
          />
          
          <TextField
            label="Company"
            value={formData.company}
            onChange={(e) => handleInputChange('company', e.target.value)}
            fullWidth
            placeholder="Enter company name"
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 1,
              },
            }}
          />
          
          <TextField
            label="Customer Code"
            value={formData.code}
            onChange={(e) => handleInputChange('code', e.target.value)}
            fullWidth
            placeholder="Enter customer code"
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 1,
              },
            }}
          />
          
          <FormControl fullWidth>
            <InputLabel>Customer Group</InputLabel>
            <Select
              value={formData.customerGroupId}
              onChange={(e) => handleInputChange('customerGroupId', e.target.value)}
              label="Customer Group"
              sx={{
                borderRadius: 1,
              }}
            >
              <MenuItem value="">
                <em>Select a customer group</em>
              </MenuItem>
              {customerGroups.map((group) => (
                <MenuItem key={group.id} value={group.id}>
                  {group.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Outlet Selection for Super Admin */}
          {isSuperAdmin() && (
            <FormControl fullWidth error={!!validationErrors.outletId}>
              <InputLabel>Outlet</InputLabel>
                             <Select
                 value={formData.outletId || ''}
                 onChange={(e) => handleInputChange('outletId', e.target.value === '' ? null : e.target.value)}
                 label="Outlet"
                 sx={{
                   borderRadius: 1,
                 }}
               >
                <MenuItem value="">
                  <em>Select an outlet</em>
                </MenuItem>
                {outlets.map((outlet) => (
                  <MenuItem key={outlet.id} value={outlet.id}>
                    {outlet.name}
                  </MenuItem>
                ))}
              </Select>
              {validationErrors.outletId && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                  {validationErrors.outletId}
                </Typography>
              )}
            </FormControl>
          )}

          {/* Info for non-super admin users */}
          {!isSuperAdmin() && (
            <Box sx={{ 
              p: 2, 
              bgcolor: 'info.light', 
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'info.main'
            }}>
              <Typography variant="body2" color="info.contrastText">
                This customer will be created in your assigned outlet: <strong>{outlets.find(o => o.id === getOutletId())?.name || 'Your Outlet'}</strong>
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 2, justifyContent: 'center' }}>
        <Button 
          onClick={handleCancel} 
          variant="outlined"
          sx={{
            borderRadius: 1,
            px: 4,
            py: 1.5,
            fontSize: '1rem',
            textTransform: 'none',
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          sx={{
            borderRadius: 1,
            px: 4,
            py: 1.5,
            fontSize: '1rem',
            textTransform: 'none',
            bgcolor: '#2196f3',
            '&:hover': {
              bgcolor: '#1976d2',
            },
          }}
        >
          {isEditMode ? 'Save Changes' : 'Create Customer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CustomerDialog;
