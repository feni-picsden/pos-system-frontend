import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  TextField,
  Typography,
  Alert,
  Popper,
  ClickAwayListener,
  Tabs,
  Tab,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  EditOutlined as EditIcon,
  DeleteOutline as DeleteIcon,
  Person as PersonIcon,
  Close as CloseIcon,
  ArrowDropDown as ArrowDropDownIcon,
  CheckBoxOutlineBlankOutlined as SquareIcon,
  CheckBoxOutlined as SquareCheckedIcon,
  SaveOutlined as SaveIcon,
} from '@mui/icons-material';
import UserFormDialog from '../../components/Users/UserFormDialog';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import PageLoader from '../../components/Common/PageLoader';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import apiClient from '../../services/apiClient';
import { userService } from '../../services/userService';
import usePageCache from '../../hooks/usePageCache';
import { roleService } from '../../services/roleService';
import { outletService } from '../../services/outletService';
import { useHasPermission } from '../../hooks/usePermissions';
import { useAuth } from '../../contexts/AuthContext';

// Shopfront reference has no transitions and no ripple anywhere.
const INSTANT = 'all 0s ease';

// Labeled row-action pill matching the reference (142x42, radius 12, fw700).
const rowActionSx = (color) => ({
  color,
  textTransform: 'none',
  fontWeight: 700,
  fontSize: 16,
  width: 142,
  height: 42,
  borderRadius: '12px',
  transition: INSTANT,
  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
  // Reference disabled state: bg rgba(0,0,0,0.1), gray #b3b3b3 content, not-allowed cursor.
  '&.Mui-disabled': {
    color: '#b3b3b3',
    bgcolor: 'rgba(0,0,0,0.1)',
    pointerEvents: 'auto',
    cursor: 'not-allowed',
    '&:hover': { bgcolor: 'rgba(0,0,0,0.1)' },
  },
});

/**
 * Typeable multi-select combobox for the Roles filter, matching the reference:
 * checkbox option rows, checked options pinned on top in blue, gray chip +
 * clear "x" in the field, solid #5ebbeb row hover, menu stays open on select.
 */
const RolesFilter = ({ value, onChange, options }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const anchorRef = useRef(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const toggle = (name) =>
    onChange(value.includes(name) ? value.filter((x) => x !== name) : [...value, name]);

  const optionRow = (name, key) => {
    const isSel = value.includes(name);
    return (
      <Box
        key={key}
        component="button"
        type="button"
        onClick={() => toggle(name)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          width: '100%',
          height: 56,
          px: 2,
          border: 0,
          bgcolor: 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
          fontSize: 16,
          color: isSel ? '#5ebbeb' : '#0a0a0a',
          transition: INSTANT,
          '&:hover': { bgcolor: '#5ebbeb' },
        }}
      >
        {isSel ? (
          <SquareCheckedIcon sx={{ fontSize: 20, color: '#5ebbeb' }} />
        ) : (
          <SquareIcon sx={{ fontSize: 20, color: '#0a0a0a' }} />
        )}
        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </Box>
      </Box>
    );
  };

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box sx={{ width: '50%', position: 'relative' }}>
        {/* Floating field label while the combobox is open (reference behavior) */}
        {open && (
          <Box
            sx={{
              position: 'absolute',
              top: -9,
              left: 12,
              px: 0.5,
              bgcolor: '#fff',
              fontSize: 12,
              lineHeight: '18px',
              color: '#000',
              zIndex: 1,
            }}
          >
            Roles
          </Box>
        )}
        <Box
          ref={anchorRef}
          onClick={() => setOpen(true)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            height: 42,
            border: '1px solid #404040',
            borderRadius: '8px',
            bgcolor: '#fff',
            pl: 1,
            pr: 0.5,
            cursor: 'text',
            overflow: 'hidden',
          }}
        >
          {value.map((name) => (
            <Box
              key={name}
              sx={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                height: 19,
                maxWidth: 150,
                px: 1,
                borderRadius: '4px',
                bgcolor: 'rgba(0,0,0,0.1)',
                fontSize: 16,
                color: '#000',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {name}
            </Box>
          ))}
          <Box
            component="input"
            type="text"
            value={query}
            placeholder={value.length ? '' : 'Roles'}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
            }}
            sx={{
              flex: 1,
              minWidth: 30,
              height: 40,
              border: 0,
              outline: 'none',
              bgcolor: 'transparent',
              fontFamily: 'inherit',
              fontSize: 16,
              color: '#000',
              '&::placeholder': { color: '#808080', opacity: 1 },
            }}
          />
          {value.length > 0 && (
            <Box
              component="button"
              type="button"
              aria-label="Clear selection"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
              sx={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 25,
                height: 24,
                p: 0,
                border: 0,
                borderRadius: '8px',
                bgcolor: 'transparent',
                color: '#000',
                cursor: 'pointer',
                transition: INSTANT,
                '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
              }}
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </Box>
          )}
          <ArrowDropDownIcon
            sx={{
              flexShrink: 0,
              color: '#404040',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 150ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </Box>

        <Popper
          open={open}
          anchorEl={anchorRef.current}
          placement="bottom-start"
          modifiers={[{ name: 'offset', options: { offset: [0, 10] } }]}
          style={{ zIndex: 1300 }}
        >
          <Box
            sx={{
              width: anchorRef.current ? anchorRef.current.offsetWidth : 'auto',
              bgcolor: '#fff',
              border: '1px solid #000000',
              borderRadius: '8px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
              maxHeight: 288,
              overflow: 'auto',
              transition: INSTANT,
            }}
          >
            {value.length === 0 && filtered.length === 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', height: 56, px: 2, fontSize: 16, color: '#0a0a0a' }}>
                No Options
              </Box>
            ) : (
              <>
                {/* Checked options pinned on top; unchecked below (no duplicates) */}
                {value.map((name) => optionRow(name, `pinned-${name}`))}
                {filtered.filter((name) => !value.includes(name)).map((name) => optionRow(name, name))}
              </>
            )}
          </Box>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};

// Origin of the backend (avatar images are served from /uploads, not /api).
const API_ORIGIN = (apiClient.defaults?.baseURL || '').replace(/\/api\/?$/, '');

// Shared outlined-input styling per the parity system (#404040 1px, focus #000 2px).
const editInputSx = {
  backgroundColor: '#fff',
  '& .MuiOutlinedInput-root': {
    height: 42,
    borderRadius: '8px',
    fontSize: 16,
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' },
  },
  '& .MuiOutlinedInput-input': { padding: '9px 16px', '&::placeholder': { color: '#808080', opacity: 1 } },
};

const editSelectSx = {
  height: 42,
  borderRadius: '8px',
  fontSize: 16,
  backgroundColor: '#fff',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' },
};

const FieldRow = ({ label, children }) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: { xs: '1fr', sm: '180px 1fr' },
      alignItems: 'center',
      gap: { xs: 0.5, sm: 2 },
      mb: 2.5,
    }}
  >
    <Typography sx={{ fontSize: 16, color: '#676b72', fontWeight: 500 }}>{label}</Typography>
    {children}
  </Box>
);

/**
 * Dedicated edit-user page (reference navigates to /settings/users/{id}/edit).
 * Rendered in place of the list — tabs General | Contact | Reporting Access |
 * Quick Menu, with a floating blue Save. Saves via userService.updateUser.
 */
const OUTLET_REQUIRED_ERROR = 'At least one outlet is required.';

const UserEditPage = ({ user, roles, onBack, onSaved }) => {
  const { user: currentUser } = useAuth();
  const canPickAnyOutlet =
    (currentUser?.isSuperAdmin === true || currentUser?.hasAllPermission === true) &&
    (currentUser?.outletId === null || currentUser?.outletId === undefined);

  const activeUserOutlets = useMemo(
    () => (user.user_outlets || []).filter((uo) => uo.isActive),
    [user]
  );

  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [outlets, setOutlets] = useState([]);
  const [form, setForm] = useState(() => {
    const outletIds = activeUserOutlets.length
      ? activeUserOutlets.map((uo) => uo.outletId)
      : user.outletId
        ? [user.outletId]
        : [];
    return {
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      password: '',
      confirmPassword: '',
      role: user.hasAllPermission ? 'NO_ROLE_ALL_PERMISSIONS' : (user.role || ''),
      isActive: user.isActive !== false,
      requiresPasswordReset: user.requiresPasswordReset === true,
      outletIds,
    };
  });
  const [outletsTouched, setOutletsTouched] = useState(false);
  const [avatarDataUrl, setAvatarDataUrl] = useState(null);
  const [avatarCleared, setAvatarCleared] = useState(false);
  const fileInputRef = useRef(null);
  const [reporting, setReporting] = useState(() =>
    activeUserOutlets.map((uo) => ({
      outletId: uo.outletId,
      outletName: uo.outlets?.name || `Outlet ${uo.outletId}`,
      reportAccess: Boolean(uo.reportAccess),
    }))
  );
  const [quickMenu, setQuickMenu] = useState(() =>
    (user.quickMenuItems || []).map((i) => ({ name: i.name || '', url: i.url || '' }))
  );

  useEffect(() => {
    if (canPickAnyOutlet) {
      outletService
        .getAllOutlets()
        .then((r) => setOutlets(r.outlets || []))
        .catch(() => setOutlets([]));
    }
  }, [canPickAnyOutlet]);

  const setField = (field) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarDataUrl(reader.result);
      setAvatarCleared(false);
    };
    reader.readAsDataURL(file);
  };

  const savedAvatar = user.avatar ? `${API_ORIGIN}/${user.avatar}` : null;
  const avatarSrc = avatarCleared ? null : avatarDataUrl || savedAvatar;

  const handleSave = async () => {
    setError('');
    setSuccess('');
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    if (showPasswordFields && form.password) {
      if (form.password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (form.password !== form.confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }
    if (!form.role) {
      setError('Role is required.');
      return;
    }
    // Clearing every outlet is never a silent no-op: the backend rejects
    // outletIds:[] with a 400, so stop it here instead of dropping the field.
    if (canPickAnyOutlet && form.outletIds.length === 0) {
      setError(OUTLET_REQUIRED_ERROR);
      setTab(0);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email,
        phone: form.phone,
        isActive: form.isActive,
        hasAllPermission: form.role === 'NO_ROLE_ALL_PERMISSIONS',
        role: form.role === 'NO_ROLE_ALL_PERMISSIONS' ? 'No Role' : form.role,
        requiresPasswordReset: form.requiresPasswordReset,
      };
      if (showPasswordFields && form.password) payload.password = form.password;
      if (avatarDataUrl) payload.avatar = avatarDataUrl;
      else if (avatarCleared && user.avatar) payload.removeAvatar = true;
      // Only send quick-menu / reporting data when the list API supplied it,
      // so a stale backend can never wipe existing rows with empty defaults.
      if (user.quickMenuItems !== undefined) {
        payload.quickMenuItems = quickMenu.map((i, idx) => ({
          name: i.name,
          url: i.url,
          sortOrder: idx,
        }));
      }
      if (activeUserOutlets.some((uo) => uo.reportAccess !== undefined)) {
        payload.reportingAccess = reporting.map((r) => ({
          outletId: r.outletId,
          reportAccess: r.reportAccess,
        }));
      }
      // Outlet assignments are only sent when the user actually changed them —
      // saving a phone number must never re-write (or re-activate) outlet rows.
      if (canPickAnyOutlet && outletsTouched) {
        payload.assignMultipleOutlets = form.outletIds.length > 1;
        payload.outletIds = form.outletIds;
        payload.outletId = form.outletIds[0];
      }

      const passwordSaved = Boolean(showPasswordFields && form.password);
      await userService.updateUser(user.id, payload);
      setSuccess('User updated successfully.');
      setForm((prev) => ({
        ...prev,
        password: '',
        confirmPassword: '',
        // Saving a new password satisfies the pending reset server-side.
        requiresPasswordReset: passwordSaved ? false : prev.requiresPasswordReset,
      }));
      setShowPasswordFields(false);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update user.');
    } finally {
      setSaving(false);
    }
  };

  const tabPanelSx = { maxWidth: 680 };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header: back link + title */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <Button
          disableRipple
          onClick={onBack}
          sx={{
            color: '#5ebbeb',
            textTransform: 'none',
            fontWeight: 700,
            fontSize: 16,
            height: 42,
            borderRadius: '12px',
            transition: INSTANT,
            '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
          }}
        >
          &#8249; Users
        </Button>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          Editing {user.name}
        </Typography>
      </Box>

      {/* Tabs: General | Contact | Reporting Access | Quick Menu */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 3,
          borderBottom: '1px solid #d9d9d9',
          '& .MuiTabs-indicator': { backgroundColor: '#5ebbeb', height: 3 },
          '& .MuiTab-root': {
            textTransform: 'none',
            fontSize: 16,
            fontWeight: 500,
            color: '#676b72',
            transition: INSTANT,
          },
          '& .MuiTab-root.Mui-selected': { fontWeight: 700, color: '#313439' },
        }}
      >
        <Tab disableRipple label="General" />
        <Tab disableRipple label="Contact" />
        <Tab disableRipple label="Reporting Access" />
        <Tab disableRipple label="Quick Menu" />
      </Tabs>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* General */}
      {tab === 0 && (
        <Box sx={tabPanelSx}>
          <FieldRow label="Image">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar
                src={avatarSrc || undefined}
                onClick={() => fileInputRef.current?.click()}
                sx={{ width: 90, height: 90, bgcolor: '#e0e0e0', color: '#666', cursor: 'pointer' }}
              >
                {!avatarSrc && <PersonIcon sx={{ fontSize: 40 }} />}
              </Avatar>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleAvatarChange}
                />
                <Button
                  disableRipple
                  onClick={() => fileInputRef.current?.click()}
                  sx={{
                    border: '1px solid #5ebbeb',
                    color: '#5ebbeb',
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: 16,
                    height: 42,
                    px: 2,
                    borderRadius: '12px',
                    transition: INSTANT,
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.05)', border: '1px solid #5ebbeb' },
                  }}
                >
                  {avatarSrc ? 'Change Image' : 'Upload Image'}
                </Button>
                {avatarSrc && (
                  <Button
                    disableRipple
                    onClick={() => {
                      setAvatarDataUrl(null);
                      setAvatarCleared(true);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    sx={{
                      color: '#dc2626',
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: 16,
                      height: 42,
                      borderRadius: '12px',
                      transition: INSTANT,
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
                    }}
                  >
                    Remove Image
                  </Button>
                )}
              </Box>
            </Box>
          </FieldRow>

          <FieldRow label="Name">
            <TextField value={form.name} onChange={setField('name')} placeholder="Name" sx={editInputSx} fullWidth />
          </FieldRow>

          <FieldRow label="Username">
            <TextField
              value={form.name}
              disabled
              helperText="The username used to log in — it matches the display name above."
              sx={editInputSx}
              fullWidth
            />
          </FieldRow>

          <FieldRow label="Password">
            {!showPasswordFields ? (
              <Button
                disableRipple
                onClick={() => setShowPasswordFields(true)}
                sx={{
                  justifySelf: 'start',
                  border: '1px solid #16a34a',
                  color: '#16a34a',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: 16,
                  height: 42,
                  px: 2,
                  borderRadius: '12px',
                  transition: INSTANT,
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)', border: '1px solid #16a34a' },
                }}
              >
                Update Password
              </Button>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <TextField
                  type="password"
                  value={form.password}
                  onChange={setField('password')}
                  placeholder="New password"
                  sx={editInputSx}
                  fullWidth
                />
                <TextField
                  type="password"
                  value={form.confirmPassword}
                  onChange={setField('confirmPassword')}
                  placeholder="Confirm password"
                  sx={editInputSx}
                  fullWidth
                />
                <Button
                  disableRipple
                  onClick={() => {
                    setShowPasswordFields(false);
                    setForm((p) => ({ ...p, password: '', confirmPassword: '' }));
                  }}
                  sx={{
                    alignSelf: 'flex-start',
                    color: '#676b72',
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: 16,
                    transition: INSTANT,
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
                  }}
                >
                  Cancel
                </Button>
              </Box>
            )}
          </FieldRow>

          <FieldRow label="Role">
            <Select
              value={form.role}
              onChange={setField('role')}
              displayEmpty
              fullWidth
              sx={editSelectSx}
              IconComponent={ArrowDropDownIcon}
            >
              <MenuItem value="" disabled>
                <Box component="em" sx={{ color: '#808080' }}>Select a role</Box>
              </MenuItem>
              <MenuItem value="NO_ROLE_ALL_PERMISSIONS">No Role (All Permissions)</MenuItem>
              {roles
                .filter((r) => r.isActive !== false)
                .map((r) => (
                  <MenuItem key={r.id} value={r.name}>
                    {r.name}
                  </MenuItem>
                ))}
            </Select>
          </FieldRow>

          {canPickAnyOutlet && (
            <FieldRow label="Outlets">
              <Select
                multiple
                value={form.outletIds}
                onChange={(e) => {
                  setOutletsTouched(true);
                  if (error === OUTLET_REQUIRED_ERROR) setError('');
                  setField('outletIds')(e);
                }}
                error={error === OUTLET_REQUIRED_ERROR}
                fullWidth
                sx={editSelectSx}
                IconComponent={ArrowDropDownIcon}
                renderValue={(selected) =>
                  selected
                    .map((id) => outlets.find((o) => o.id === id)?.name || `Outlet ${id}`)
                    .join(', ')
                }
              >
                {outlets.map((o) => (
                  <MenuItem key={o.id} value={o.id}>
                    {o.name}
                  </MenuItem>
                ))}
                {outlets.length === 0 && <MenuItem disabled>No outlets available</MenuItem>}
              </Select>
            </FieldRow>
          )}

          <FieldRow label="Active">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <ShopfrontSwitch checked={form.isActive} onChange={(e) => setField('isActive')(e.target.checked)} />
              <Typography sx={{ fontSize: 16, color: '#676b72' }}>
                {form.isActive ? 'User can log in' : 'User cannot log in'}
              </Typography>
            </Box>
          </FieldRow>

          <FieldRow label="Requires Password Reset">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <ShopfrontSwitch
                checked={form.requiresPasswordReset}
                onChange={(e) => setField('requiresPasswordReset')(e.target.checked)}
              />
              <Typography sx={{ fontSize: 16, color: '#676b72' }}>
                {form.requiresPasswordReset
                  ? 'User cannot log in until a new password is saved'
                  : 'User is not required to reset their password'}
              </Typography>
            </Box>
          </FieldRow>
        </Box>
      )}

      {/* Contact */}
      {tab === 1 && (
        <Box sx={tabPanelSx}>
          <FieldRow label="Email">
            <TextField
              type="email"
              value={form.email}
              onChange={setField('email')}
              placeholder="user@example.com"
              sx={editInputSx}
              fullWidth
            />
          </FieldRow>
          <FieldRow label="Phone">
            <TextField
              value={form.phone}
              onChange={setField('phone')}
              placeholder="Phone number"
              sx={editInputSx}
              fullWidth
            />
          </FieldRow>
        </Box>
      )}

      {/* Reporting Access */}
      {tab === 2 && (
        <Box sx={tabPanelSx}>
          {reporting.length === 0 ? (
            <Typography sx={{ fontSize: 16, color: '#676b72' }}>
              No outlet assignments found for this user.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {reporting.map((r) => (
                <Box
                  key={r.outletId}
                  sx={{ border: '1px solid #404040', borderRadius: '8px', p: 2 }}
                >
                  <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#313439', mb: 1 }}>
                    {r.outletName}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <ShopfrontSwitch
                      checked={r.reportAccess}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setReporting((prev) =>
                          prev.map((x) =>
                            x.outletId === r.outletId ? { ...x, reportAccess: checked } : x
                          )
                        );
                      }}
                    />
                    <Typography sx={{ fontSize: 16, color: '#676b72' }}>
                      This user will have access to the report data for this outlet
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Quick Menu */}
      {tab === 3 && (
        <Box sx={tabPanelSx}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: 1.5, mb: 1 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#313439' }}>Name</Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#313439' }}>URL</Typography>
            <Box />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {quickMenu.map((item, idx) => (
              <Box
                key={idx}
                sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: 1.5, alignItems: 'center' }}
              >
                <TextField
                  value={item.name}
                  onChange={(e) => {
                    const v = e.target.value;
                    setQuickMenu((prev) => prev.map((x, i) => (i === idx ? { ...x, name: v } : x)));
                  }}
                  placeholder="Sell Screen"
                  sx={editInputSx}
                />
                <TextField
                  value={item.url}
                  onChange={(e) => {
                    const v = e.target.value;
                    setQuickMenu((prev) => prev.map((x, i) => (i === idx ? { ...x, url: v } : x)));
                  }}
                  placeholder="/sale-key"
                  sx={editInputSx}
                />
                <IconButton
                  disableRipple
                  onClick={() => setQuickMenu((prev) => prev.filter((_, i) => i !== idx))}
                  sx={{
                    color: '#dc2626',
                    borderRadius: '8px',
                    transition: INSTANT,
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
                  }}
                  title="Remove"
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}
            <Button
              disableRipple
              startIcon={<AddIcon />}
              onClick={() => setQuickMenu((prev) => [...prev, { name: '', url: '' }])}
              sx={{
                alignSelf: 'flex-start',
                mt: 1,
                border: '1px solid #5ebbeb',
                color: '#5ebbeb',
                textTransform: 'none',
                fontWeight: 700,
                fontSize: 16,
                height: 42,
                px: 2,
                borderRadius: '12px',
                transition: INSTANT,
                '&:hover': { bgcolor: 'rgba(0,0,0,0.05)', border: '1px solid #5ebbeb' },
              }}
            >
              Add Item
            </Button>
          </Box>
        </Box>
      )}

      {/* Floating blue Save */}
      <Button
        disableRipple
        startIcon={<SaveIcon />}
        onClick={handleSave}
        disabled={saving}
        sx={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          zIndex: 1200,
          bgcolor: '#5ebbeb',
          color: '#f8f8f8',
          height: 42,
          minWidth: 142,
          borderRadius: '12px',
          fontWeight: 700,
          fontSize: 16,
          textTransform: 'none',
          boxShadow: '0 8px 10px -6px rgba(0,0,0,0.3)',
          transition: INSTANT,
          '&:hover': { bgcolor: '#4aa9dd', boxShadow: '0 8px 10px -6px rgba(0,0,0,0.3)' },
          '&.Mui-disabled': { bgcolor: '#404040', color: '#737373' },
        }}
      >
        Save
      </Button>
    </Box>
  );
};

const Users = () => {
  const { user: currentUser } = useAuth();
  // Both lists render from IndexedDB first, then revalidate in the background.
  const {
    data: users,
    loading,
    refresh: loadUsers,
  } = usePageCache('users', () =>
    userService.getUsers({ noCache: true }).then((r) => r.users || [])
  );
  const { data: roles } = usePageCache('roles', () =>
    roleService.getRoles().then((r) => r.roles || [])
  );
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  // Deep-linkable edit view: ?edit={id} (route path stays /setup/users), so a
  // browser refresh returns to the edit page and it can be linked directly.
  const [searchParams, setSearchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const editingUser = editId ? users.find((u) => String(u.id) === editId) : null;
  const [userToDelete, setUserToDelete] = useState(null);
  const [nameFilter, setNameFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState([]);

  // Permission checks
  const canAddUsers = useHasPermission('users.add');
  const canEditUsers = useHasPermission('users.edit');
  const canDeleteUsers = useHasPermission('users.delete');

  const handleAddUser = () => {
    setOpenDialog(true);
  };

  // Reference navigates to a dedicated edit page (not a modal) — deep-link via ?edit={id}.
  const handleEditUser = (user) => {
    setSearchParams({ edit: String(user.id) });
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await userService.deleteUser(userToDelete.id);
      await loadUsers(); // Reload the list
    } catch (err) {
      setError('Failed to delete user');
      console.error('Error deleting user:', err);
    } finally {
      setUserToDelete(null);
    }
  };

  const handleUserSaved = () => {
    setOpenDialog(false);
    loadUsers(); // Reload the list
  };

  // Reference shows 'No Role' (muted) for users without a real role; real role names as-is.
  const roleName = (user) =>
    user.hasAllPermission || !user.role || user.role === 'No Role' ? 'No Role' : user.role;

  const roleOptions = useMemo(() => ['No Role', ...roles.map((r) => r.name)], [roles]);

  const filteredUsers = users.filter((user) => {
    // Reference lists the logged-in user too (with Delete disabled); other
    // outlet-less global admins stay hidden.
    if (user.outletId == null && user.id !== currentUser?.id) return false;
    const nameMatch = user.name.toLowerCase().includes(nameFilter.toLowerCase());
    const roleMatch = roleFilter.length === 0 || roleFilter.includes(roleName(user));
    return nameMatch && roleMatch;
  });

  const isLastSuperAdmin = (user) =>
    user.hasAllPermission && users.filter((u) => u.hasAllPermission && u.isActive).length <= 1;

  // The list is stale-while-revalidate, and the edit form saves back a full
  // snapshot of the row it was seeded with (outlets, reporting access). Refetch
  // before the form mounts so a stale read can never become a stale write.
  const [freshEditId, setFreshEditId] = useState(null);
  useEffect(() => {
    if (!editId) {
      setFreshEditId(null);
      return undefined;
    }
    if (freshEditId === editId) return undefined;
    let cancelled = false;
    loadUsers().then(() => {
      if (!cancelled) setFreshEditId(editId);
    });
    return () => { cancelled = true; };
  }, [editId, freshEditId, loadUsers]);

  // A stale ?edit id (e.g. the user was deleted) falls back to the list.
  useEffect(() => {
    if (editId && !loading && !editingUser) setSearchParams({}, { replace: true });
  }, [editId, loading, editingUser, setSearchParams]);

  if (editId && freshEditId !== editId) {
    return <PageLoader />;
  }

  // Dedicated edit page replaces the list while a user is being edited.
  // editingUser is derived from the freshly loaded list, so the "Editing {name}"
  // header updates immediately after a rename is saved (onSaved -> loadUsers).
  if (editingUser) {
    return (
      <UserEditPage
        user={editingUser}
        roles={roles}
        onBack={() => setSearchParams({})}
        onSaved={loadUsers}
      />
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 2 }}>
          Users
        {canAddUsers && (
          <Button
            variant="outlined"
            disableRipple
            startIcon={<AddIcon />}
            onClick={handleAddUser}
            sx={{
              border: '1px solid #5ebbeb',
              color: '#5ebbeb',
              bgcolor: 'transparent',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: 16,
              height: 42,
              width: 123,
              borderRadius: '12px',
              boxShadow: 'none',
              transition: INSTANT,
              '&:hover': {
                bgcolor: 'rgba(0,0,0,0.05)',
                border: '1px solid #5ebbeb',
                color: '#5ebbeb',
                boxShadow: 'none',
              },
            }}
          >
            New
          </Button>
        )}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {filteredUsers.length} Users
          </Typography>
        </Box>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          placeholder="Name"
          variant="outlined"
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          sx={{
            width: '50%',
            backgroundColor: 'white',
            '& .MuiOutlinedInput-root': {
              height: 42,
              borderRadius: 2,
              fontSize: 16,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' },
            },
            '& .MuiOutlinedInput-input': { padding: '9px 16px', '&::placeholder': { color: '#808080', opacity: 1 } },
          }}
        />
        <RolesFilter value={roleFilter} onChange={setRoleFilter} options={roleOptions} />
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Loading */}
      {loading ? null : (
        /* Users Table */
        <TableContainer>
          <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <TableHead>
              <TableRow
                sx={{
                  '& th': {
                    bgcolor: '#5ebbeb',
                    color: '#f8f8f8',
                    fontWeight: 700,
                    fontSize: 16,
                    textTransform: 'uppercase',
                    border: 0,
                    height: 51,
                    padding: '8px 8px 8px 10px',
                  },
                  '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
                  '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' },
                }}
              >
                <TableCell>User</TableCell>
                <TableCell>Role</TableCell>
                {/* Reference has no third header label */}
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody sx={{ '& td': { border: 0, fontSize: 16, color: '#000', height: 80, py: 0 } }}>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar
                        src={user.avatar ? `${API_ORIGIN}/${user.avatar}` : undefined}
                        sx={{
                          width: 40,
                          height: 40,
                          backgroundColor: '#e0e0e0',
                          color: '#666',
                        }}
                      >
                        {!user.avatar && <PersonIcon />}
                      </Avatar>
                      <Typography sx={{ fontSize: 16, color: '#000' }}>{user.name}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 16, color: roleName(user) === 'No Role' ? '#676b72' : '#000' }}>
                      {roleName(user)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
                      {canEditUsers && (
                        <Button
                          disableRipple
                          startIcon={<EditIcon />}
                          onClick={() => handleEditUser(user)}
                          sx={rowActionSx('#16a34a')}
                        >
                          Edit
                        </Button>
                      )}
                      {canDeleteUsers && (
                        <Button
                          disableRipple
                          startIcon={<DeleteIcon />}
                          onClick={() => setUserToDelete(user)}
                          disabled={user.id === currentUser?.id || isLastSuperAdmin(user)}
                          sx={rowActionSx('#dc2626')}
                        >
                          Delete
                        </Button>
                      )}
                      {!canEditUsers && !canDeleteUsers && (
                        <Typography variant="body2" color="text.secondary">
                          No actions available
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No users found
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Delete confirmation (reference uses a styled in-app dialog, not window.confirm) */}
      <ConfirmDeleteDialog
        open={!!userToDelete}
        title="Delete User"
        message={`Are you sure you want to delete ${userToDelete?.name || 'this user'}?`}
        onCancel={() => setUserToDelete(null)}
        onConfirm={confirmDeleteUser}
      />

      {/* Add-user dialog (editing uses the dedicated edit page above) */}
      <UserFormDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        user={null}
        onUserSaved={handleUserSaved}
      />
    </Box>
  );
};

export default Users;
