import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Box,
  Typography,
  Alert,
} from '@mui/material';
import { CheckOutlined as CheckIcon } from '@mui/icons-material';
import ShopfrontSwitch from '../Common/ShopfrontSwitch';
import { userService } from '../../services/userService';
import { roleService } from '../../services/roleService';
import { outletService } from '../../services/outletService';
import { useAuth } from '../../contexts/AuthContext';

// Parity input styling: #404040 1px outline, focused #000 2px, radius 8px.
const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    fontSize: 16,
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' },
  },
  '& .MuiOutlinedInput-input': { '&::placeholder': { color: '#808080', opacity: 1 } },
};

const selectSx = {
  borderRadius: '8px',
  fontSize: 16,
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' },
};

// Footer buttons per reference: 118x42, radius 12, fw700, no transition/shadow.
const footerButtonSx = (bg, fg, hoverBg) => ({
  width: 118,
  height: 42,
  borderRadius: '12px',
  fontWeight: 700,
  fontSize: 16,
  textTransform: 'none',
  bgcolor: bg,
  color: fg,
  boxShadow: 'none',
  transition: 'all 0s ease',
  '&:hover': { bgcolor: hoverBg, boxShadow: 'none' },
  '&.Mui-disabled': { bgcolor: 'rgba(0,0,0,0.1)', color: '#b3b3b3' },
});

const UserFormDialog = ({ open, onClose, user, onUserSaved }) => {
  const { user: currentUser, isSuperAdmin } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    password: '',
    confirmPassword: '',
    role: 'user',
    isActive: true,
    hasAllPermission: false,
    outletId: null,
    assignMultipleOutlets: false,
    outletIds: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [outlets, setOutlets] = useState([]);
  // Sequence number so an out-of-order roles response can't overwrite a newer outlet's list.
  const rolesReqRef = useRef(0);

  const isEditMode = !!user;

  // Only a TRUE global admin (super admin / all-permission NOT pinned to an outlet)
  // may choose an arbitrary outlet for a user. Outlet admins and regular users are
  // confined to their own outlet — the backend enforces this regardless of the UI.
  const canPickAnyOutlet =
    (currentUser?.isSuperAdmin === true || currentUser?.hasAllPermission === true) &&
    (currentUser?.outletId === null || currentUser?.outletId === undefined);

  // Load roles and outlets when dialog opens
  useEffect(() => {
    if (open) {
      if (canPickAnyOutlet) {
        // True superadmin loads outlets and roles
        loadOutlets();
        loadRoles();
      } else {
        if (currentUser?.outletId) {
          loadRoles(currentUser.outletId);
        }
      }
    }
  }, [open, currentUser, isSuperAdmin, canPickAnyOutlet]);

  // Reset form when dialog opens/closes or user changes
  useEffect(() => {
    if (open) {
      if (user) {
        // Edit mode - populate form with user data
        const userOutletIds =
          Array.isArray(user.user_outlets) && user.user_outlets.length > 0
            ? user.user_outlets
                .filter((uo) => uo.isActive)
                .map((uo) => uo.outletId)
            : user.outletId
              ? [user.outletId]
              : [];
        setFormData({
          name: user.name || '',
          password: '',
          confirmPassword: '',
          role: user.hasAllPermission ? 'NO_ROLE_ALL_PERMISSIONS' : (user.role || ''),
          isActive: user.isActive !== undefined ? user.isActive : true,
          hasAllPermission: user.hasAllPermission || false,
          outletId: userOutletIds[0] || null,
          assignMultipleOutlets: userOutletIds.length > 1,
          outletIds: userOutletIds,
        });
      } else {
        setFormData({
          name: '',
          password: '',
          confirmPassword: '',
          role: '',
          isActive: true,
          hasAllPermission: false,
          outletId: canPickAnyOutlet ? null : currentUser?.outletId || null,
          assignMultipleOutlets: false,
          outletIds: canPickAnyOutlet
            ? []
            : currentUser?.outletId
              ? [currentUser.outletId]
              : [],
        });
      }
      setError('');
      setValidationErrors({});
    }
  }, [open, user, currentUser, canPickAnyOutlet]);

  const loadRoles = async (outletId = null) => {
    const reqId = ++rolesReqRef.current;
    setRoles([]);
    setRolesLoading(true);
    try {
      let response;
      if (outletId) {
        // Load roles for specific outlet
        response = await roleService.getRolesByOutlet(outletId);
      } else {
        // Load all roles (for super admin)
        response = await roleService.getRoles();
      }
      if (reqId !== rolesReqRef.current) return; // stale response, a newer outlet was picked
      const activeRoles = response.roles?.filter(role => role.isActive) || [];
      setRoles(activeRoles);
    } catch (err) {
      console.error('Error loading roles:', err);
      if (reqId === rolesReqRef.current) setRoles([]);
    } finally {
      if (reqId === rolesReqRef.current) setRolesLoading(false);
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

    // Special handling for outlet selection (true superadmin only)
    if (field === 'outletId' && canPickAnyOutlet) {
      // When outlet changes, load roles for that outlet
      if (value) {
        loadRoles(value);
        // Ensure outletIds always includes the primary outlet
        const existingIds = Array.isArray(newData.outletIds) ? newData.outletIds : [];
        if (!existingIds.includes(value)) {
          newData.outletIds = [value, ...existingIds];
        }
      } else {
        rolesReqRef.current++; // cancel any in-flight roles fetch
        setRoles([]);
        setRolesLoading(false);
        newData.outletIds = [];
      }
      // Reset role selection when outlet changes
      newData.role = '';
      newData.hasAllPermission = false;
    }

    // When toggling "Assign Multiple Outlets" (superadmin only)
    if (field === 'assignMultipleOutlets' && canPickAnyOutlet) {
      const enabled = !!value;
      if (enabled) {
        // Moving from single → multi: ensure outletIds contains the current primary outlet
        const currentId = formData.outletId;
        const existingIds = Array.isArray(newData.outletIds) ? newData.outletIds : [];
        const merged = currentId
          ? Array.from(new Set([currentId, ...existingIds]))
          : existingIds;
        newData.outletIds = merged;
      } else {
        // Moving from multi → single: keep first selected as primary outlet
        const firstId = Array.isArray(formData.outletIds) && formData.outletIds.length > 0
          ? formData.outletIds[0]
          : formData.outletId || null;
        newData.outletId = firstId;
        newData.outletIds = firstId ? [firstId] : [];
      }
    }

    // When editing multi-outlet selection directly (superadmin + multi mode)
    if (field === 'outletIds' && canPickAnyOutlet && newData.assignMultipleOutlets) {
      const ids = Array.isArray(value) ? value : [];
      newData.outletIds = ids;
      // Keep primary outletId in sync with the first selected outlet
      newData.outletId = ids.length > 0 ? ids[0] : null;
    }

    // For regular users and outlet admins, ensure outletId is always their assigned outlet
    if (!canPickAnyOutlet) {
      newData.outletId = currentUser?.outletId || null;
      newData.outletIds = newData.outletId ? [newData.outletId] : [];
      newData.assignMultipleOutlets = false;
    }

    // Special handling for role selection
    if (field === 'role') {
      if (value === 'NO_ROLE_ALL_PERMISSIONS') {
        newData.hasAllPermission = true;
        // For "No Role (All Permissions)", user gets all permissions for the selected outlet only
        newData.outletId = formData.outletId;
      } else {
        newData.hasAllPermission = false;
      }
    }

    setFormData(newData);
    
    // Clear validation error when user starts typing
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
      errors.name = 'Name is required';
    }

    // Password validation (required for new users, optional for edit)
    if (!isEditMode && !formData.password) {
      errors.password = 'Password is required';
    }
    
    if (formData.password && formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    // Confirm password validation
    if (formData.password && formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    // Outlet validation
    if (canPickAnyOutlet) {
      // True superadmin must select at least one outlet
      if (formData.assignMultipleOutlets) {
        if (!formData.outletIds || formData.outletIds.length === 0) {
          errors.outletId = 'At least one outlet is required';
        }
      } else if (!formData.outletId) {
        errors.outletId = 'Outlet is required';
      }
    } else {
      if (!currentUser?.outletId) {
        errors.outletId = 'You must be assigned to an outlet to create users';
      }
    }

    // Role validation
    if (!formData.role) {
      errors.role = 'Role is required';
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
      const userData = {
        name: formData.name.trim(),
        isActive: formData.isActive,
        hasAllPermission: formData.hasAllPermission,
      };

      // Handle role assignment
      if (formData.role === 'NO_ROLE_ALL_PERMISSIONS') {
        // For "No Role" users, don't assign any specific role
        userData.role = 'No Role';
        userData.roleId = null;
      } else {
        // For regular roles, send the role name
        userData.role = formData.role;
      }

      // Only include password if it's provided
      if (formData.password) {
        userData.password = formData.password;
      }

      // Set outletId based on user type
      if (canPickAnyOutlet) {
        // True superadmin can set any outlet
        if (formData.outletId) {
          userData.outletId = formData.outletId;
        }
      if (formData.assignMultipleOutlets && Array.isArray(formData.outletIds)) {
        userData.assignMultipleOutlets = true;
        userData.outletIds = formData.outletIds;
      }
      } else {
        // Regular users and outlet admins can only create users in their own outlet
        userData.outletId = currentUser?.outletId;
      }

      if (isEditMode) {
        await userService.updateUser(user.id, userData);
      } else {
        await userService.createUser(userData);
      }

      onUserSaved();
    } catch (err) {
      setError(err.response?.data?.error || `Failed to ${isEditMode ? 'update' : 'create'} user`);
    } finally {
      setLoading(false);
    }
  };

  const getRoleDisplayText = () => {
    if (!formData.role) {
      return 'No role selected';
    }
    if (formData.role === 'NO_ROLE_ALL_PERMISSIONS') {
      return 'No Role (All Permissions)';
    }
    const selectedRole = roles.find(role => role.name === formData.role);
    return selectedRole?.name || formData.role;
  };

  const getRoleDescription = () => {
    if (!formData.role) {
      return 'Please select a role for this user';
    }
    if (formData.role === 'NO_ROLE_ALL_PERMISSIONS') {
      return 'Outlet admin access - all permissions for this specific outlet only';
    }
    const selectedRole = roles.find(role => role.name === formData.role);
    return selectedRole?.description || 'Role permissions will be applied according to system settings';
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      TransitionProps={{ timeout: 0 }}
      PaperProps={{
        sx: { width: 512, maxWidth: '95vw', borderRadius: '8px' }
      }}
    >
      {/* Green tinted header band per reference (h60, #bbf7d0, check icon, green title) */}
      <Box
        sx={{
          height: 60,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 3,
          bgcolor: '#bbf7d0',
          borderRadius: '8px 8px 0 0',
        }}
      >
        <CheckIcon sx={{ color: '#000' }} />
        <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#166534' }}>
          {isEditMode ? 'Edit User' : 'Create User'}
        </Typography>
      </Box>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {/* Name Field (labeled, per reference) */}
          <TextField
            label="Name"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            error={!!validationErrors.name}
            helperText={validationErrors.name}
            fullWidth
            required
            sx={inputSx}
          />

          {/* Username (login credential — this system logs in with the name) */}
          <TextField
            placeholder="Username"
            value={formData.name}
            InputProps={{ readOnly: true }}
            helperText="Used to log in — matches the name above."
            fullWidth
            sx={inputSx}
          />

          {/* Password Field */}
          <TextField
            placeholder={isEditMode ? 'New Password (leave blank to keep current)' : 'Password'}
            type="password"
            value={formData.password}
            onChange={(e) => handleInputChange('password', e.target.value)}
            error={!!validationErrors.password}
            helperText={validationErrors.password}
            fullWidth
            required={!isEditMode}
            sx={inputSx}
          />

          {/* Confirm Password Field */}
          <TextField
            placeholder="Confirm Password"
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
            error={!!validationErrors.confirmPassword}
            helperText={validationErrors.confirmPassword}
            fullWidth
            required={!!formData.password}
            sx={inputSx}
          />

                                 {/* Outlet Information for Regular Users and Outlet Admins */}
            {!canPickAnyOutlet && currentUser?.outlet && (
              <Box sx={{ p: 2, backgroundColor: '#e3f2fd', borderRadius: 1, border: '1px solid #2196f3' }}>
                <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold' }}>
                  Creating user for outlet: {currentUser.outlet.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  You can only create users in your assigned outlet
                </Typography>
              </Box>
            )}

          {/* Outlet Selection - Only show for true super admins */}
          {canPickAnyOutlet && (
            <>
              {/* Single-outlet selection when multi-outlet is OFF */}
              {!formData.assignMultipleOutlets && (
                <FormControl fullWidth>
                  <InputLabel>Outlet</InputLabel>
                  <Select
                    value={formData.outletId || ''}
                    label="Outlet"
                    onChange={(e) => handleInputChange('outletId', e.target.value)}
                    error={!!validationErrors.outletId}
                    sx={selectSx}
                  >
                    <MenuItem value="">
                      <em>Select an outlet</em>
                    </MenuItem>
                    {outlets.map((outlet) => (
                      <MenuItem key={outlet.id} value={outlet.id}>
                        <Box>
                          <Typography variant="body2">
                            {outlet.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {outlet.code} - {outlet.address}
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

              {/* Assign Multiple Outlets Toggle */}
              <Box sx={{ mt: 2 }}>
                <FormControlLabel
                  control={
                    <ShopfrontSwitch
                      checked={formData.assignMultipleOutlets}
                      onChange={(e) =>
                        handleInputChange('assignMultipleOutlets', e.target.checked)
                      }
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2">
                        Assign Multiple Outlets
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Allow this user to access more than one outlet
                      </Typography>
                    </Box>
                  }
                />
              </Box>

              {/* Multi-outlet selection when enabled */}
              {formData.assignMultipleOutlets && (
                <FormControl fullWidth sx={{ mt: 1 }}>
                  <InputLabel>Outlets</InputLabel>
                  <Select
                    multiple
                    value={formData.outletIds || []}
                    label="Outlets"
                    onChange={(e) => handleInputChange('outletIds', e.target.value)}
                    sx={selectSx}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => {
                          const outlet = outlets.find((o) => o.id === value);
                          return (
                            <Typography
                              key={value}
                              variant="caption"
                              sx={{ mr: 0.5 }}
                            >
                              {outlet?.name || `Outlet ${value}`}
                            </Typography>
                          );
                        })}
                      </Box>
                    )}
                  >
                    {outlets.map((outlet) => (
                      <MenuItem key={outlet.id} value={outlet.id}>
                        <Box>
                          <Typography variant="body2">
                            {outlet.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {outlet.code} - {outlet.address}
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
            </>
          )}

          {/* Role Selection */}
          <FormControl fullWidth>
            <InputLabel>Role</InputLabel>
            <Select
              value={formData.role || ''}
              label="Role"
              onChange={(e) => handleInputChange('role', e.target.value)}
              error={!!validationErrors.role}
              disabled={(canPickAnyOutlet && !formData.outletId) || rolesLoading}
              sx={selectSx}
            >
              <MenuItem value="">
                <em>Select a role</em>
              </MenuItem>
              
              {/* Special "No Role" option with all permissions */}
              <MenuItem value="NO_ROLE_ALL_PERMISSIONS">
                <Box>
                  <Typography variant="body2">
                    No Role (has all permissions)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    All permissions for selected outlet only
                  </Typography>
                </Box>
              </MenuItem>
              
              {roles.map((role) => (
                <MenuItem key={role.id} value={role.name}>
                  <Box>
                    <Typography variant="body2">
                      {role.name}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
                                                           {roles.length === 0 && (
                                   <MenuItem disabled>
                     {rolesLoading
                       ? 'Loading roles…'
                       : canPickAnyOutlet && !formData.outletId
                         ? 'Select an outlet first'
                         : 'No roles available'
                     }
                   </MenuItem>
                )}
            </Select>
            {validationErrors.role && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                {validationErrors.role}
              </Typography>
            )}
          </FormControl>

          {/* Status Switch */}
          <FormControlLabel
            control={
              <ShopfrontSwitch
                checked={formData.isActive}
                onChange={(e) => handleInputChange('isActive', e.target.checked)}
              />
            }
            label={
              <Box>
                <Typography variant="body2">
                  Active User
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formData.isActive ? 'User can log in' : 'User cannot log in'}
                </Typography>
              </Box>
            }
          />

                     {/* Role Summary */}
           <Box sx={{ p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
             <Typography variant="body2" color="text.secondary">
               Selected Role: <strong>{getRoleDisplayText()}</strong>
             </Typography>
             <Typography variant="caption" color="text.secondary">
               {getRoleDescription()}
             </Typography>
                                                                                                               {formData.outletId && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                       Outlet: <strong>
                       {canPickAnyOutlet 
                         ? (outlets.find(o => o.id === formData.outletId)?.name || 'Unknown')
                         : (currentUser?.outlet?.name || 'Your Outlet')
                       }
                     </strong>
                  </Typography>
                )}
           </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button
          disableRipple
          onClick={onClose}
          disabled={loading}
          sx={footerButtonSx('#dedede', '#000', '#d0d0d0')}
        >
          Cancel
        </Button>
        <Button
          disableRipple
          onClick={handleSubmit}
          disabled={loading}
          sx={footerButtonSx('#22c55e', '#fff', '#16a34a')}
        >
          {loading ? null : (
            isEditMode ? 'Update' : 'Create'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UserFormDialog;
