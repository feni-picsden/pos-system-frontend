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
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { roleService } from '../../services/roleService';
import { outletService } from '../../services/outletService';
import { useAuth } from '../../contexts/AuthContext';
import PermissionSelector from '../Permissions/PermissionSelector';

const RoleFormDialog = ({ open, onClose, role, onRoleSaved }) => {
  const { user: currentUser, isSuperAdmin } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true,
    isDefault: false,
    outletId: null,
  });
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [activeTab, setActiveTab] = useState(0);
  const [outlets, setOutlets] = useState([]);

  const isEditMode = !!role;

  // Load outlets when dialog opens (for super admin)
  useEffect(() => {
    if (open && isSuperAdmin()) {
      loadOutlets();
    }
  }, [open, isSuperAdmin]);

  // Reset form when dialog opens/closes or role changes
  useEffect(() => {
    if (open) {
      if (role) {
        // Edit mode - populate form with role data
        setFormData({
          name: role.name || '',
          description: role.description || '',
          isActive: role.isActive !== undefined ? role.isActive : true,
          isDefault: role.isDefault || false,
          outletId: role.outletId || null,
        });
        // Load role permissions
        loadRolePermissions(role.id);
      } else {
        // Add mode - reset form
        setFormData({
          name: '',
          description: '',
          isActive: true,
          isDefault: false,
          outletId: isSuperAdmin() ? null : currentUser?.outletId || null,
        });
        setSelectedPermissions([]);
      }
      setError('');
      setValidationErrors({});
      setActiveTab(0);
    }
  }, [open, role, currentUser, isSuperAdmin]);

  const loadRolePermissions = async (roleId) => {
    try {
      const response = await roleService.getRolePermissions(roleId);
      setSelectedPermissions(response.permissions || []);
    } catch (err) {
      console.error('Error loading role permissions:', err);
      setSelectedPermissions([]);
    }
  };

  const loadOutlets = async () => {
    try {
      const response = await outletService.getAllOutlets();
      setOutlets(response.outlets || []);
    } catch (err) {
      console.error('Error loading outlets:', err);
      setOutlets([]);
    }
  };

  const handleInputChange = (field, value) => {
    const newData = {
      ...formData,
      [field]: value
    };

    // For non-super admin users, ensure outletId is always their assigned outlet
    if (!isSuperAdmin()) {
      newData.outletId = currentUser?.outletId || null;
    }

    setFormData(newData);
    
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateForm = () => {
    const errors = {};

    // Name validation
    if (!formData.name.trim()) {
      errors.name = 'Role name is required';
    }

    // Outlet validation for super admin
    if (isSuperAdmin() && !formData.outletId) {
      errors.outletId = 'Please select an outlet or leave empty for global role';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const roleData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        isActive: formData.isActive,
        isDefault: formData.isDefault,
        outletId: formData.outletId,
        permissions: selectedPermissions,
      };

      let savedRole;
      if (isEditMode) {
        savedRole = await roleService.updateRole(role.id, roleData);
        // Update permissions separately
        await roleService.updateRolePermissions(role.id, selectedPermissions);
      } else {
        savedRole = await roleService.createRole(roleData);
        // Set permissions for new role
        if (savedRole.role && savedRole.role.id) {
          await roleService.updateRolePermissions(savedRole.role.id, selectedPermissions);
        }
      }

      onRoleSaved();
    } catch (err) {
      setError(err.response?.data?.error || `Failed to ${isEditMode ? 'update' : 'create'} role`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2, height: '90vh' }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
          {isEditMode ? 'Edit Role' : 'Add New Role'}
        </Typography>
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{ px: 3 }}
        >
          <Tab label="Basic Information" />
          <Tab label="Permissions" />
        </Tabs>
      </Box>

      <DialogContent dividers sx={{ height: '60vh', overflow: 'auto' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Tab Content */}
        {activeTab === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {/* Name Field */}
            <TextField
              label="Role Name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              error={!!validationErrors.name}
              helperText={validationErrors.name}
              fullWidth
              required
            />

            {/* Description Field */}
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              error={!!validationErrors.description}
              helperText={validationErrors.description}
              fullWidth
              multiline
              rows={3}
              placeholder="Brief description of this role and its permissions"
            />

            {/* Outlet Selection - Only show for true super admins */}
            {isSuperAdmin() && (
              <FormControl fullWidth>
                <InputLabel>Outlet</InputLabel>
                <Select
                  value={formData.outletId || ''}
                  label="Outlet"
                  onChange={(e) => handleInputChange('outletId', e.target.value)}
                  error={!!validationErrors.outletId}
                >
                  <MenuItem value="">
                    <em>Global Role (No Outlet)</em>
                  </MenuItem>
                  {outlets.map((outlet) => (
                    <MenuItem key={outlet.id} value={outlet.id}>
                      <Box>
                        <Typography variant="body2">
                          {outlet.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {outlet.address}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                  {outlets.length === 0 && (
                    <MenuItem disabled>No outlets available</MenuItem>
                  )}
                </Select>
                {validationErrors.outletId && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                    {validationErrors.outletId}
                  </Typography>
                )}
              </FormControl>
            )}

            {/* Outlet Information for Non-Super Admins */}
            {!isSuperAdmin() && currentUser?.outlet && (
              <Box sx={{ p: 2, backgroundColor: '#e3f2fd', borderRadius: 1, border: '1px solid #2196f3' }}>
                <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold' }}>
                  Creating role for outlet: {currentUser.outlet.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  You can only create roles in your assigned outlet
                </Typography>
              </Box>
            )}

            {/* Active Status Switch */}
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isActive}
                  onChange={(e) => handleInputChange('isActive', e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body2">
                    Active Role
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formData.isActive ? 'Role is available for assignment' : 'Role is hidden from assignment'}
                  </Typography>
                </Box>
              }
            />

            {/* Default Role Switch */}
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isDefault}
                  onChange={(e) => handleInputChange('isDefault', e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body2">
                    Default Role
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formData.isDefault ? 'New users will be assigned this role by default' : 'Users must be manually assigned this role'}
                  </Typography>
                </Box>
              }
            />

            {/* Role Summary */}
            <Box sx={{ p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Role Summary:
              </Typography>
              <Typography variant="body2">
                <strong>Name:</strong> {formData.name || 'Not specified'}
              </Typography>
              <Typography variant="body2">
                <strong>Outlet:</strong> {
                  formData.outletId 
                    ? (outlets.find(o => o.id === formData.outletId)?.name || `Outlet ${formData.outletId}`)
                    : 'Global Role'
                }
              </Typography>
              <Typography variant="body2">
                <strong>Status:</strong> {formData.isActive ? 'Active' : 'Inactive'}
              </Typography>
              <Typography variant="body2">
                <strong>Default:</strong> {formData.isDefault ? 'Yes' : 'No'}
              </Typography>
              <Typography variant="body2">
                <strong>Permissions:</strong> {selectedPermissions.length} selected
              </Typography>
            </Box>
          </Box>
        )}

        {/* Permissions Tab */}
        {activeTab === 1 && (
          <PermissionSelector
            selectedPermissions={selectedPermissions}
            onPermissionChange={setSelectedPermissions}
          />
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button 
          onClick={onClose} 
          disabled={loading}
          variant="outlined"
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          disabled={loading}
          variant="contained"
          sx={{
            backgroundColor: '#4fc3f7',
            '&:hover': {
              backgroundColor: '#29b6f6',
            },
          }}
        >
          {loading ? null : (
            isEditMode ? 'Update Role' : 'Create Role'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RoleFormDialog;
