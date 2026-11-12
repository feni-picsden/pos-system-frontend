import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Select,
  MenuItem,
  Box,
  Typography,
  Alert,
  InputAdornment,
} from '@mui/material';
import {
  CheckOutlined as CheckIcon,
  Check as ValidIcon,
  Close as InvalidIcon,
  ArrowDropDown as ArrowDropDownIcon,
} from '@mui/icons-material';
import ShopfrontSwitch from '../Common/ShopfrontSwitch';
import { userService } from '../../services/userService';
import { roleService } from '../../services/roleService';
import { outletService } from '../../services/outletService';
import settingsService from '../../services/settingsService';
import { REF_MENU_PROPS } from '../Common/refMenuProps';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';

// Parity input styling: #404040 1px outline, focused #000 2px, radius 8px, 42px tall.
const inputSx = {
  '& .MuiOutlinedInput-root': {
    height: 42,
    borderRadius: '8px',
    fontSize: 16,
    bgcolor: '#fff',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' },
    '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: '#dc2626' },
  },
  '& .MuiOutlinedInput-input': { padding: '9px 16px', '&::placeholder': { color: '#808080', opacity: 1 } },
};

const selectSx = {
  height: 42,
  borderRadius: '8px',
  fontSize: 16,
  bgcolor: '#fff',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' },
  '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: '#dc2626' },
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

// Reference: a small label sits ABOVE each field (Username / Password / Role).
const FieldLabel = ({ children, invalid = false }) => (
  <Typography sx={{ fontSize: 13, color: invalid ? '#dc2626' : '#313439', mb: 0.5, lineHeight: '18px' }}>
    {children}
  </Typography>
);

const ErrorText = ({ children }) =>
  children ? (
    <Typography sx={{ fontSize: 12, color: '#dc2626', mt: 0.5 }}>{children}</Typography>
  ) : null;

const UserFormDialog = ({ open, onClose, user, onUserSaved }) => {
  const { user: currentUser, isTrueSuperAdmin, getOutletName } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    // The credential typed at the sign-in screen, separate from the display
    // name and required: login matches the username and nothing else.
    username: '',
    password: '',
    role: '',
    isActive: true,
    hasAllPermission: false,
    outletId: null,
    assignMultipleOutlets: false,
    outletIds: [],
    // Reference Create dialog: "Enable Reporting for All Outlets"  -  every outlet
    // this user is assigned to starts with its Reporting Access switch on.
    reportAccessAllOutlets: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [outlets, setOutlets] = useState([]);
  // Existing usernames, so the field can show the reference's red cross for a
  // username that is already taken before Create is pressed.
  const [takenUsernames, setTakenUsernames] = useState([]);
  // Sequence number so an out-of-order roles response can't overwrite a newer outlet's list.
  const rolesReqRef = useRef(0);

  const isEditMode = !!user;

  // Only a TRUE global admin (super admin / all-permission NOT pinned to an outlet)
  // may choose an arbitrary outlet for a user. Outlet admins and regular users are
  // confined to their own outlet  -  the backend enforces this regardless of the UI.
  // Header-outlet rule (user, 21/10/2026): the Outlet picker shows only in All
  // Outlets mode; with an outlet selected in the navbar the new user is created
  // for that outlet and the field is hidden.
  const { selectedOutletId: headerOutletId, selectedOutlet: headerOutlet } = useSelectedOutlet();
  const canPickAnyOutlet =
    (currentUser?.isSuperAdmin === true || currentUser?.hasAllPermission === true) &&
    (currentUser?.outletId === null || currentUser?.outletId === undefined) &&
    headerOutletId == null;
  // The outlet a non-picking form writes to: the session outlet, else the navbar one.
  const fixedOutletId = currentUser?.outletId || headerOutletId || null;
  const fixedOutletName = currentUser?.outlet?.name || headerOutlet?.name || getOutletName?.(fixedOutletId) || '';

  // Load roles and outlets when dialog opens
  useEffect(() => {
    if (open) {
      if (canPickAnyOutlet) {
        // True superadmin loads outlets and roles
        loadOutlets();
        loadRoles();
      } else {
        if (fixedOutletId) {
          loadRoles(fixedOutletId);
        }
      }
      userService
        .getUsers()
        // Exact match, the same rule the backend's usernameTaken() applies.
        .then((r) => setTakenUsernames((r.users || []).flatMap((u) => [String(u.username || '').trim(), String(u.name || '').trim()]).filter(Boolean)))
        .catch(() => setTakenUsernames([]));
    }
  }, [open, currentUser, isTrueSuperAdmin, canPickAnyOutlet]);

  // Reset form when dialog opens/closes or user changes
  useEffect(() => {
    if (open) {
      const reportingDefault =
        settingsService.getCachedGeneralSettings()?.defaultNewUsersReportingAccessAllOutlets !== false;
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
          username: user.username || '',
          password: '',
          role: user.hasAllPermission ? 'NO_ROLE_ALL_PERMISSIONS' : (user.role || ''),
          isActive: user.isActive !== undefined ? user.isActive : true,
          hasAllPermission: user.hasAllPermission || false,
          outletId: userOutletIds[0] || null,
          assignMultipleOutlets: userOutletIds.length > 1,
          outletIds: userOutletIds,
          reportAccessAllOutlets: reportingDefault,
        });
      } else {
        setFormData({
          name: '',
          username: '',
          password: '',
          role: '',
          isActive: true,
          hasAllPermission: false,
          outletId: canPickAnyOutlet ? null : fixedOutletId,
          assignMultipleOutlets: false,
          outletIds: canPickAnyOutlet
            ? []
            : fixedOutletId
              ? [fixedOutletId]
              : [],
          reportAccessAllOutlets: reportingDefault,
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
      const response = await outletService.getEveryOutlet();
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
        // Moving from single â†’ multi: ensure outletIds contains the current primary outlet
        const currentId = formData.outletId;
        const existingIds = Array.isArray(newData.outletIds) ? newData.outletIds : [];
        const merged = currentId
          ? Array.from(new Set([currentId, ...existingIds]))
          : existingIds;
        newData.outletIds = merged;
      } else {
        // Moving from multi â†’ single: keep first selected as primary outlet
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
      newData.outletId = fixedOutletId;
      newData.outletIds = newData.outletId ? [newData.outletId] : [];
      newData.assignMultipleOutlets = false;
    }

    // Special handling for role selection
    if (field === 'role') {
      if (value === 'NO_ROLE_ALL_PERMISSIONS') {
        newData.hasAllPermission = true;
        // For "No Role (has all permissions)", user gets all permissions for the selected outlet only
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

  const usernameTrimmed = formData.username.trim();
  const usernameTaken =
    Boolean(usernameTrimmed) &&
    takenUsernames.includes(usernameTrimmed) &&
    usernameTrimmed !== String(user?.username || '').trim();

  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }
    if (!usernameTrimmed) {
      errors.username = 'Username is required';
    } else if (usernameTaken) {
      errors.username = 'That username is already in use';
    }

    // Password validation (required for new users, optional for edit)
    if (!isEditMode && !formData.password) {
      errors.password = 'Password is required';
    }
    if (formData.password && formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
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
    } else if (!isEditMode && !fixedOutletId) {
      errors.outletId = 'You must be assigned to an outlet to create users';
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
        username: usernameTrimmed,
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
      } else if (!isEditMode) {
        // Regular users / outlet admins create in their own outlet; a global admin
        // standing in a navbar outlet creates for that outlet. Editing without the
        // picker leaves the user's assignments untouched.
        userData.outletId = fixedOutletId;
      }

      if (!isEditMode) {
        userData.reportAccessAllOutlets = Boolean(formData.reportAccessAllOutlets);
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

  const usernameInvalid = Boolean(validationErrors.username) || usernameTaken;
  const outletName = (id) => outlets.find((o) => o.id === id)?.name || `Outlet ${id}`;

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

      <DialogContent sx={{ pt: 3, pb: 1 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* autoComplete="off" on the form: Chrome was filling the signed-in
            admin's own username + password into a NEW user's fields. */}
        <Box component="form" autoComplete="off" onSubmit={(e) => e.preventDefault()} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Name: reference shows it as a bare placeholder field */}
          <Box>
            <TextField
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Name"
              error={!!validationErrors.name}
              fullWidth
              sx={inputSx}
              inputProps={{ autoComplete: 'off', name: 'new-user-display-name' }}
            />
            <ErrorText>{validationErrors.name}</ErrorText>
          </Box>

          {/* Username  -  the login credential. Required and unique: a red cross
              while it is empty or already taken, a green tick once it is fine. */}
          <Box>
            <FieldLabel invalid={usernameInvalid}>Username</FieldLabel>
            <TextField
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              error={usernameInvalid}
              fullWidth
              sx={inputSx}
              inputProps={{ autoComplete: 'off', name: 'new-user-login-name' }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    {/* Reference: tick once it is fine, cross only when it is wrong
                        (taken, or still empty after Create was pressed) */}
                    {usernameTrimmed && !usernameTaken ? (
                      <ValidIcon sx={{ fontSize: 20, color: '#16a34a' }} />
                    ) : usernameInvalid ? (
                      <InvalidIcon sx={{ fontSize: 20, color: '#dc2626' }} />
                    ) : null}
                  </InputAdornment>
                ),
              }}
            />
            <ErrorText>{validationErrors.username || (usernameTaken ? 'That username is already in use' : '')}</ErrorText>
          </Box>

          {/* Password */}
          <Box>
            <FieldLabel invalid={!!validationErrors.password}>Password</FieldLabel>
            <TextField
              type="password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              placeholder={isEditMode ? 'Leave blank to keep the current password' : ''}
              error={!!validationErrors.password}
              fullWidth
              sx={inputSx}
              inputProps={{ autoComplete: 'new-password', name: 'new-user-password' }}
            />
            <ErrorText>{validationErrors.password}</ErrorText>
          </Box>

          {/* Outlet (our outlet-wise rule, not in the reference): only in All
              Outlets mode. With a navbar outlet the user is created for it. */}
          {!canPickAnyOutlet && fixedOutletId && !isEditMode && (
            <Typography sx={{ fontSize: 13, color: '#676b72' }}>
              Creating user for outlet: <strong>{fixedOutletName || `Outlet ${fixedOutletId}`}</strong>
            </Typography>
          )}

          {canPickAnyOutlet && (
            <>
              {!formData.assignMultipleOutlets && (
                <Box>
                  <FieldLabel invalid={!!validationErrors.outletId}>Outlet</FieldLabel>
                  <Select
                    value={formData.outletId || ''}
                    displayEmpty
                    onChange={(e) => handleInputChange('outletId', e.target.value)}
                    error={!!validationErrors.outletId}
                    fullWidth
                    sx={selectSx}
                    IconComponent={ArrowDropDownIcon}
                    MenuProps={REF_MENU_PROPS}
                    renderValue={(v) => (v ? outletName(v) : <Box component="span" sx={{ color: '#808080' }}>Select an outlet</Box>)}
                  >
                    {outlets.map((outlet) => (
                      <MenuItem key={outlet.id} value={outlet.id}>{outlet.name}</MenuItem>
                    ))}
                    {outlets.length === 0 && <MenuItem disabled>No outlets available</MenuItem>}
                  </Select>
                  <ErrorText>{validationErrors.outletId}</ErrorText>
                </Box>
              )}

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <ShopfrontSwitch
                  checked={formData.assignMultipleOutlets}
                  onChange={(e) => handleInputChange('assignMultipleOutlets', e.target.checked)}
                />
                <Typography sx={{ fontSize: 16, color: '#313439' }}>Assign Multiple Outlets</Typography>
              </Box>

              {formData.assignMultipleOutlets && (
                <Box>
                  <FieldLabel invalid={!!validationErrors.outletId}>Outlets</FieldLabel>
                  <Select
                    multiple
                    value={formData.outletIds || []}
                    displayEmpty
                    onChange={(e) => handleInputChange('outletIds', e.target.value)}
                    error={!!validationErrors.outletId}
                    fullWidth
                    sx={selectSx}
                    IconComponent={ArrowDropDownIcon}
                    MenuProps={REF_MENU_PROPS}
                    renderValue={(selected) =>
                      selected.length
                        ? selected.map(outletName).join(', ')
                        : <Box component="span" sx={{ color: '#808080' }}>Select outlets</Box>
                    }
                  >
                    {outlets.map((outlet) => (
                      <MenuItem key={outlet.id} value={outlet.id}>{outlet.name}</MenuItem>
                    ))}
                    {outlets.length === 0 && <MenuItem disabled>No outlets available</MenuItem>}
                  </Select>
                  <ErrorText>{validationErrors.outletId}</ErrorText>
                </Box>
              )}
            </>
          )}

          {/* Role */}
          <Box>
            <FieldLabel invalid={!!validationErrors.role}>Role</FieldLabel>
            <Select
              value={formData.role || ''}
              displayEmpty
              onChange={(e) => handleInputChange('role', e.target.value)}
              error={!!validationErrors.role}
              disabled={(canPickAnyOutlet && !formData.outletId) || rolesLoading}
              fullWidth
              sx={selectSx}
              IconComponent={ArrowDropDownIcon}
              MenuProps={REF_MENU_PROPS}
              renderValue={(v) => {
                if (!v) {
                  return (
                    <Box component="span" sx={{ color: '#808080' }}>
                      {rolesLoading ? 'Loading roles...' : canPickAnyOutlet && !formData.outletId ? 'Select an outlet first' : 'Select a role'}
                    </Box>
                  );
                }
                return v === 'NO_ROLE_ALL_PERMISSIONS' ? 'No Role (has all permissions)' : v;
              }}
            >
              {/* Reference: the owner-style option sits first */}
              <MenuItem value="NO_ROLE_ALL_PERMISSIONS">No Role (has all permissions)</MenuItem>
              {roles.map((role) => (
                <MenuItem key={role.id} value={role.name}>{role.name}</MenuItem>
              ))}
            </Select>
            <ErrorText>{validationErrors.role}</ErrorText>
          </Box>

          {/* Reference: "Enable Reporting for All Outlets"  -  starts every assigned
              outlet's Reporting Access switch on (default from Setup > General). */}
          {!isEditMode && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <ShopfrontSwitch
                checked={formData.reportAccessAllOutlets}
                onChange={(e) => handleInputChange('reportAccessAllOutlets', e.target.checked)}
              />
              <Typography sx={{ fontSize: 16, color: '#313439' }}>Enable Reporting for All Outlets</Typography>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 2, gap: 1 }}>
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
