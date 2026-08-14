import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Tabs,
  Tab,
  TextField,
  FormControl,
  Select,
  MenuItem,
  Button,
  Avatar,
  Alert,
  CircularProgress,
  Divider,
  Paper,
  Switch,
  FormControlLabel,
  InputAdornment,
} from '@mui/material';
import {
  Close as CloseIcon,
  PhotoCamera as CameraIcon,
  Lock as LockIcon,
  Save as SaveIcon,
  DeleteOutline as RemoveIcon,
  DragIndicator as DragIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { authService } from '../../services/authService';
import { roleService } from '../../services/roleService';

import { backendOrigin } from '../../services/apiClient';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const TabPanel = ({ children, value, index }) => (
  <Box
    role="tabpanel"
    hidden={value !== index}
    sx={{ flex: 1, overflow: 'auto', p: { xs: 2, sm: 3 } }}
  >
    {value === index && children}
  </Box>
);

const SectionHeading = ({ children }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
    <Box sx={{ width: 4, height: 20, bgcolor: '#1976d2', borderRadius: 1 }} />
    <Typography variant="subtitle1" fontWeight={600}>{children}</Typography>
  </Box>
);

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
    <Typography variant="body2" color="text.secondary" fontWeight={500}>{label}</Typography>
    {children}
  </Box>
);

const ModifyUserDialog = ({ open, onClose, user, onUserUpdated, asPage = false }) => {
  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [roles, setRoles] = useState([]);
  const [avatarFile, setAvatarFile] = useState(null);    
  const [avatarPreview, setAvatarPreview] = useState(null); 
  const [avatarCleared, setAvatarCleared] = useState(false); 
  const fileInputRef = useRef(null);
  const initializedRef = useRef(false);
  const [reportingAccess, setReportingAccess] = useState([]); 
  const [quickMenuItems, setQuickMenuItems] = useState([]);
  const [dragRow, setDragRow] = useState(null); // row index armed for dragging by its handle
  const dragFromRef = useRef(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: '',
  });

  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      return;
    }
    if (!user || initializedRef.current) return;
    initializedRef.current = true;

    setForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      password: '',
      confirmPassword: '',
      role: user.hasAllPermission ? 'NO_ROLE_ALL_PERMISSIONS' : (user.role || ''),
    });
    setReportingAccess(Array.isArray(user.reportingAccess) ? [...user.reportingAccess] : []);
    setQuickMenuItems(Array.isArray(user.quickMenuItems) ? [...user.quickMenuItems] : []);
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarCleared(false);
    setShowPasswordFields(false);
    setSuccess('');
    setError('');
    setTab(0);
  }, [open, user]);

  useEffect(() => {
    if (open) {
      roleService.getRoles()
        .then((data) => setRoles(data.roles || []))
        .catch(() => {});
    }
  }, [open]);

  const handleField = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleAvatarClick = () => fileInputRef.current?.click();

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
    setAvatarFile(file);
    setAvatarCleared(false);
    setAvatarPreview(URL.createObjectURL(file));
    return () => URL.revokeObjectURL(avatarPreview);
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarCleared(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const savedAvatarUrl = user?.avatar ? `${backendOrigin()}/${user.avatar}` : null;
  const displayAvatarSrc = avatarCleared ? null : (avatarPreview || savedAvatarUrl);

  const getUserInitials = () => {
    const name = form.name || user?.name || 'U';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');

    if (!form.name.trim()) { setError('Name cannot be empty.'); return; }

    if (showPasswordFields) {
      if (!form.password) { setError('Enter a new password or cancel the password change.'); return; }
      if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
      if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
      };
      if (showPasswordFields && form.password) payload.password = form.password;
      if (avatarFile) payload.avatarFile = avatarFile;
      else if (avatarCleared) payload.removeAvatar = true;

      const result = await authService.updateProfile(payload);

      const normalizedQuickMenu = (quickMenuItems || []).map((i, idx) => ({
        name: String(i?.name || '').trim(),
        url: String(i?.url || '').trim(),
        sortOrder: idx, // array position is the source of truth (drag-to-reorder)
      }));
      const normalizedReporting = (reportingAccess || []).map((r) => ({
        outletId: r.outletId,
        reportAccess: Boolean(r.reportAccess),
      }));
      await authService.updateProfilePreferences({
        quickMenuItems: normalizedQuickMenu,
        reportingAccess: normalizedReporting,
      });

      setSuccess('Profile updated successfully.');
      setShowPasswordFields(false);
      setAvatarFile(null);
      setAvatarCleared(false);
      setForm((prev) => ({ ...prev, password: '', confirmPassword: '' }));
      if (onUserUpdated) {
        // merge both profile + preferences into parent
        const merged = {
          ...result.user,
          quickMenuItems: normalizedQuickMenu,
          reportingAccess: reportingAccess,
        };
        onUserUpdated(merged);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  const content = (
    <>
      {/* ── App bar/header ─────────────────────────────────────────────────── */}
      <AppBar
        position="static"
        sx={{ bgcolor: '#e8eaf0', color: 'text.primary', boxShadow: 'none', borderBottom: '1px solid #ddd' }}
      >
        <Toolbar sx={{ minHeight: 56 }}>
          <Typography variant="h6" fontWeight={600} sx={{ flex: 1, fontSize: 18 }}>
            Editing {user?.name || 'User'}
          </Typography>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving}
            sx={{ mr: 1, textTransform: 'none', fontWeight: 600 }}
          >
            Save
          </Button>
          {!asPage && (
            <IconButton onClick={onClose} edge="end">
              <CloseIcon />
            </IconButton>
          )}
        </Toolbar>

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            px: 2,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 500, minHeight: 42 },
            '& .Mui-selected': { fontWeight: 700, color: '#1976d2' },
          }}
        >
          <Tab icon={<span style={{ fontSize: 16 }}>⚙</span>} iconPosition="start" label="General" />
          <Tab icon={<span style={{ fontSize: 16 }}>📞</span>} iconPosition="start" label="Contact" />
          <Tab icon={<span style={{ fontSize: 16 }}>📊</span>} iconPosition="start" label="Reporting Access" />
          <Tab icon={<span style={{ fontSize: 16 }}>⭐</span>} iconPosition="start" label="Quick Menu" />
        </Tabs>
      </AppBar>

      {/* Alerts */}
      {(success || error) && (
        <Box sx={{ px: 3, pt: 2 }}>
          {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}
          {error   && <Alert severity="error"   onClose={() => setError('')}>{error}</Alert>}
        </Box>
      )}

      {/* ── General tab ───────────────────────────────────────────────────── */}
      <TabPanel value={tab} index={0}>
        <Box sx={{ maxWidth: 680, mx: 'auto' }}>
          <SectionHeading>General</SectionHeading>

          {/* Avatar */}
          <FieldRow label="Image">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar
                src={displayAvatarSrc}
                sx={{
                  width: 90,
                  height: 90,
                  bgcolor: '#1976d2',
                  fontSize: 30,
                  cursor: 'pointer',
                  border: '2px solid #e0e0e0',
                }}
                onClick={handleAvatarClick}
              >
                {!displayAvatarSrc && getUserInitials()}
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
                  variant="outlined"
                  size="small"
                  startIcon={<CameraIcon />}
                  onClick={handleAvatarClick}
                  sx={{ textTransform: 'none' }}
                >
                  {displayAvatarSrc ? 'Change Image' : 'Upload Image'}
                </Button>
                {displayAvatarSrc && (
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    startIcon={<RemoveIcon />}
                    onClick={handleRemoveAvatar}
                    sx={{ textTransform: 'none' }}
                  >
                    Remove Image
                  </Button>
                )}
                {avatarFile && (
                  <Typography variant="caption" color="text.secondary">
                    {avatarFile.name} ({(avatarFile.size / 1024).toFixed(0)} KB) — not yet saved
                  </Typography>
                )}
              </Box>
            </Box>
          </FieldRow>

          <Divider sx={{ my: 2 }} />

          {/* Name */}
          <FieldRow label="Name">
            <TextField
              value={form.name}
              onChange={handleField('name')}
              size="small"
              fullWidth
              placeholder="Full name"
            />
          </FieldRow>

          {/* Username (read-only) */}
          <FieldRow label="Username">
            <TextField
              value={form.name}
              size="small"
              fullWidth
              disabled
              helperText="Username equals the display name used to log in."
              InputProps={{
                endAdornment: (
                  <Box sx={{ color: 'success.main', pl: 1, lineHeight: 1 }}>✓</Box>
                ),
              }}
            />
          </FieldRow>

          {/* Password */}
          <FieldRow label="Password">
            {!showPasswordFields ? (
              <Button
                variant="outlined"
                startIcon={<LockIcon />}
                onClick={() => setShowPasswordFields(true)}
                sx={{
                  textTransform: 'none',
                  borderColor: '#4caf50',
                  color: '#4caf50',
                  '&:hover': { borderColor: '#388e3c', color: '#388e3c', bgcolor: '#f1f8f1' },
                }}
              >
                Update Password
              </Button>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
                <TextField
                  type="password"
                  label="New password"
                  value={form.password}
                  onChange={handleField('password')}
                  size="small"
                  fullWidth
                />
                <TextField
                  type="password"
                  label="Confirm password"
                  value={form.confirmPassword}
                  onChange={handleField('confirmPassword')}
                  size="small"
                  fullWidth
                />
                <Button
                  size="small"
                  onClick={() => {
                    setShowPasswordFields(false);
                    setForm((p) => ({ ...p, password: '', confirmPassword: '' }));
                  }}
                  sx={{ textTransform: 'none', alignSelf: 'flex-start', color: 'text.secondary' }}
                >
                  Cancel
                </Button>
              </Box>
            )}
          </FieldRow>

          {/* Role – read-only for self-edit; admins manage roles on the Users page */}
          <FieldRow label="Role">
            <FormControl size="small" fullWidth>
              <Select value={form.role} disabled displayEmpty>
                <MenuItem value="NO_ROLE_ALL_PERMISSIONS">No Role (has all permissions)</MenuItem>
                {roles.map((r) => (
                  <MenuItem key={r.id} value={r.name}>{r.name}</MenuItem>
                ))}
                {!form.role && <MenuItem value="">—</MenuItem>}
              </Select>
            </FormControl>
          </FieldRow>
        </Box>
      </TabPanel>

      {/* ── Contact tab ───────────────────────────────────────────────────── */}
      <TabPanel value={tab} index={1}>
        <Box sx={{ maxWidth: 680, mx: 'auto' }}>
          <SectionHeading>Contact Information</SectionHeading>

          <FieldRow label="Email">
            <TextField
              type="email"
              value={form.email}
              onChange={handleField('email')}
              size="small"
              fullWidth
              placeholder="user@example.com"
            />
          </FieldRow>

          <FieldRow label="Phone">
            <TextField
              value={form.phone}
              onChange={handleField('phone')}
              size="small"
              fullWidth
              placeholder="+1 000 000 0000"
            />
          </FieldRow>
        </Box>
      </TabPanel>

      {/* ── Reporting Access tab ───────────────────────────────────────────── */}
      <TabPanel value={tab} index={2}>
        <Box sx={{ maxWidth: 680, mx: 'auto' }}>
          <SectionHeading>Reporting Access</SectionHeading>
          {(reportingAccess?.length || 0) === 0 ? (
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No outlet assignments found for this user.
              </Typography>
            </Paper>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {reportingAccess.map((r) => (
                <Paper key={r.outletId} variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                    {r.outletName}
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={Boolean(r.reportAccess)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setReportingAccess((prev) =>
                            prev.map((x) =>
                              x.outletId === r.outletId ? { ...x, reportAccess: checked } : x
                            )
                          );
                        }}
                      />
                    }
                    label={
                      <Typography variant="body2" color="text.secondary">
                        This user will have access to the report data for this outlet
                      </Typography>
                    }
                  />
                </Paper>
              ))}
            </Box>
          )}
        </Box>
      </TabPanel>

      {/* ── Quick Menu tab ─────────────────────────────────────────────────── */}
      <TabPanel value={tab} index={3}>
        <Box sx={{ maxWidth: 680, mx: 'auto' }}>
          <SectionHeading>Quick Menu</SectionHeading>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
              Quick Menu Items
            </Typography>

            {/* Header row */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '28px 1fr 1fr 40px',
                gap: 1.5,
                mb: 1,
                px: 0.5,
              }}
            >
              <Box />
              <Typography variant="caption" color="text.secondary" fontWeight={700}>Name</Typography>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>URL</Typography>
              <Box />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {(quickMenuItems || []).map((item, idx) => (
                <Box
                  key={item.id ?? idx}
                  draggable={dragRow === idx}
                  onDragStart={() => { dragFromRef.current = idx; }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = dragFromRef.current;
                    if (from === null || from === idx) return;
                    setQuickMenuItems((prev) => {
                      const next = [...prev];
                      const [moved] = next.splice(from, 1);
                      next.splice(idx, 0, moved);
                      return next;
                    });
                  }}
                  onDragEnd={() => { dragFromRef.current = null; setDragRow(null); }}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '28px 1fr 1fr 40px',
                    gap: 1.5,
                    alignItems: 'center',
                    opacity: dragRow === idx ? 0.6 : 1,
                  }}
                >
                  <Box
                    onMouseDown={() => setDragRow(idx)}
                    onMouseUp={() => setDragRow(null)}
                    title="Drag to reorder"
                    sx={{ color: 'text.secondary', display: 'flex', justifyContent: 'center', cursor: 'grab' }}
                  >
                    <DragIcon fontSize="small" />
                  </Box>

                  <TextField
                    size="small"
                    value={item.name || ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setQuickMenuItems((prev) => prev.map((x, i) => (i === idx ? { ...x, name: v } : x)));
                    }}
                    placeholder="Sell Screen"
                  />

                  <TextField
                    size="small"
                    value={item.url || ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setQuickMenuItems((prev) => prev.map((x, i) => (i === idx ? { ...x, url: v } : x)));
                    }}
                    placeholder="/"
                    InputProps={{
                      startAdornment: <InputAdornment position="start">/</InputAdornment>,
                    }}
                  />

                  <IconButton
                    type="button"
                    color="error"
                    onClick={() => setQuickMenuItems((prev) => prev.filter((_, i) => i !== idx))}
                    size="small"
                    title="Remove"
                  >
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}

              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setQuickMenuItems((prev) => ([...(prev || []), { name: '', url: '', sortOrder: (prev || []).length }]))}
                sx={{
                  mt: 1,
                  textTransform: 'none',
                  borderRadius: 2,
                }}
              >
                Add Item
              </Button>
            </Box>
          </Paper>
        </Box>
      </TabPanel>
    </>
  );

  if (asPage) {
    return (
      <Box sx={{ width: '100%' }}>
        {content}
      </Box>
    );
  }

  return (
    <Dialog fullScreen open={open} onClose={onClose}>
      {content}
    </Dialog>
  );
};

export default ModifyUserDialog;
