import React, { useState, useEffect, useMemo, useRef } from 'react';
import PageLoader from '../../components/Common/PageLoader';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  HistoryOutlined as HistoryIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { setLeaveGuard, clearLeaveGuard } from '../../utils/leaveGuard';
import { roleService } from '../../services/roleService';
import { outletService } from '../../services/outletService';
import { useAuth } from '../../contexts/AuthContext';

// Shopfront reference has no transitions and no ripple anywhere.
const INSTANT = 'all 0s ease';

// Baseline of the editable state; toggle order must not count as an edit.
const snapshot = (name, permissions) =>
  JSON.stringify([name.trim(), [...permissions].sort()]);

const RolePermissions = () => {
  const navigate = useNavigate();
  const { roleId } = useParams();
  const isEditMode = !!roleId;
  const { user: currentUser, isSuperAdmin } = useAuth();

  const [roleName, setRoleName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [catalog, setCatalog] = useState([]);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [outletId, setOutletId] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const savedSnapshot = useRef(snapshot('', []));
  const pendingLeaveRef = useRef(null);

  const isDirty = savedSnapshot.current !== snapshot(roleName, selectedPermissions);

  // Leaving the route (or the browser page) with unsaved edits prompts
  // "Confirm Leaving" - same gate the other Setup editors register.
  useEffect(() => {
    if (!isDirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    const guard = (proceed) => {
      pendingLeaveRef.current = proceed;
      setLeaveOpen(true);
    };
    window.addEventListener('beforeunload', warn);
    setLeaveGuard(guard);
    return () => {
      window.removeEventListener('beforeunload', warn);
      clearLeaveGuard(guard);
    };
  }, [isDirty]);

  const leaveEditor = () => navigate('/setup/roles');

  const handleBack = () => {
    if (!isDirty) {
      leaveEditor();
      return;
    }
    pendingLeaveRef.current = leaveEditor;
    setLeaveOpen(true);
  };

  // Reference edit page links to the role's revision history (same unsaved-changes gate).
  const handleRevisions = () => {
    const openRevisions = () => navigate(`/setup/roles/${roleId}/revisions`);
    if (!isDirty) {
      openRevisions();
      return;
    }
    pendingLeaveRef.current = openRevisions;
    setLeaveOpen(true);
  };

  useEffect(() => {
    loadEverything();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleId]);

  const loadEverything = async () => {
    try {
      setLoading(true);
      const requests = [roleService.getAllPermissions()];
      if (isEditMode) {
        requests.push(roleService.getRole(roleId), roleService.getRolePermissions(roleId));
      } else if (isSuperAdmin()) {
        requests.push(outletService.getAllOutlets());
      }

      const [catalogResponse, second, third] = await Promise.all(requests);
      setCatalog(catalogResponse.permissions || []);

      if (isEditMode) {
        setRoleName(second.role.name);
        setOriginalName(second.role.name);
        setOutletId(second.role.outletId);
        setSelectedPermissions(third.permissions || []);
        savedSnapshot.current = snapshot(second.role.name, third.permissions || []);
      } else {
        if (isSuperAdmin()) setOutlets(second?.outlets || []);
        if (!isSuperAdmin() && currentUser?.outletId) setOutletId(currentUser.outletId);
      }
      setError('');
    } catch (err) {
      setError('Failed to load role data');
      console.error('Error loading role:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionToggle = (permission) => {
    setSelectedPermissions((current) =>
      current.includes(permission)
        ? current.filter((p) => p !== permission)
        : [...current, permission]
    );
  };

  const handleSave = async () => {
    if (!roleName.trim()) {
      setError('Role name is required');
      return;
    }

    try {
      setSaving(true);
      setError('');

      if (isEditMode) {
        if (roleName.trim() !== originalName) {
          await roleService.updateRole(roleId, { name: roleName.trim() });
        }
        await roleService.updateRolePermissions(roleId, selectedPermissions);
      } else {
        const response = await roleService.createRole({
          name: roleName.trim(),
          description: '',
          isActive: true,
          isDefault: false,
          outletId: outletId,
        });
        if (response.role && response.role.id) {
          await roleService.updateRolePermissions(response.role.id, selectedPermissions);
        }
      }

      savedSnapshot.current = snapshot(roleName, selectedPermissions);
      leaveEditor();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save role');
      console.error('Error saving role:', err);
    } finally {
      setSaving(false);
    }
  };

  // The API returns the catalog already in reference order; group it while preserving that order.
  const groups = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const ordered = [];
    const byCategory = new Map();
    for (const permission of catalog) {
      const label = permission.description || permission.name;
      if (search && !label.toLowerCase().includes(search)) continue;
      if (!byCategory.has(permission.category)) {
        byCategory.set(permission.category, []);
        ordered.push(permission.category);
      }
      byCategory.get(permission.category).push({ ...permission, label });
    }
    return ordered.map((category) => ({ category, permissions: byCategory.get(category) }));
  }, [catalog, searchTerm]);

  if (loading) {
    return <PageLoader />;
  }

  return (
    <Box sx={{ p: 3, pb: 12 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          disableRipple
          disableElevation
          variant="contained"
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          sx={{
            bgcolor: '#5ebbeb',
            color: '#fff',
            textTransform: 'none',
            fontWeight: 700,
            fontSize: 16,
            height: 42,
            borderRadius: '12px',
            px: 2.5,
            boxShadow: 'none',
            transition: INSTANT,
            '&:hover': { bgcolor: '#0ea5e9', boxShadow: 'none' },
          }}
        >
          Back
        </Button>
        <Typography variant="h4" component="h1" fontWeight="bold">
          {isEditMode ? 'Modify Role' : 'Create New Role'}
        </Typography>
        {isEditMode && (
          <Button
            disableRipple
            onClick={handleRevisions}
            startIcon={<HistoryIcon />}
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
            Revisions
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Name */}
      <Typography sx={{ fontSize: 13, color: '#595959', mb: 0.5 }}>Name</Typography>
      <TextField
        fullWidth
        value={roleName}
        onChange={(e) => setRoleName(e.target.value)}
        sx={{
          mb: 2,
          '& .MuiOutlinedInput-root': {
            height: 42,
            borderRadius: '8px',
            '& fieldset': { borderColor: '#595959' },
            '&:hover fieldset': { borderColor: '#595959' },
            '&.Mui-focused fieldset': { borderColor: '#000', borderWidth: '2px' },
          },
        }}
      />

      {/* Outlet — local-only concept, shown when creating a role */}
      {!isEditMode && isSuperAdmin() && (
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Outlet</InputLabel>
          <Select
            value={outletId || ''}
            label="Outlet"
            onChange={(e) => setOutletId(e.target.value)}
          >
            <MenuItem value="">
              <em>Global Role (No Outlet)</em>
            </MenuItem>
            {outlets.map((outlet) => (
              <MenuItem key={outlet.id} value={outlet.id}>
                {outlet.name}
              </MenuItem>
            ))}
            {outlets.length === 0 && <MenuItem disabled>No outlets available</MenuItem>}
          </Select>
        </FormControl>
      )}

      {/* Search */}
      <Typography sx={{ fontSize: 13, color: '#595959', mb: 0.5 }}>Search</Typography>
      <TextField
        fullWidth
        placeholder="Search Permissions..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{
          mb: 3,
          '& .MuiOutlinedInput-root': {
            height: 42,
            borderRadius: '8px',
            '& fieldset': { borderColor: '#595959' },
            '&:hover fieldset': { borderColor: '#595959' },
            '&.Mui-focused fieldset': { borderColor: '#000', borderWidth: '2px' },
          },
        }}
      />

      {/* Categories — reference order, 4 toggles per row, no select-all control */}
      {groups.map(({ category, permissions }) => (
        <Box key={category} sx={{ mb: 3 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 20, color: '#313439', mb: 1 }}>
            {category}
          </Typography>
          <Grid container>
            {permissions.map((permission) => {
              const checked = selectedPermissions.includes(permission.name);
              return (
                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={3}
                  key={permission.name}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75 }}
                >
                  <ShopfrontSwitch
                    checked={checked}
                    onChange={() => handlePermissionToggle(permission.name)}
                  />
                  <Typography sx={{ fontSize: 15, color: '#313439' }}>
                    {permission.label}
                  </Typography>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      ))}

      {groups.length === 0 && (
        <Typography color="text.secondary" sx={{ py: 4 }}>
          No permissions match "{searchTerm}"
        </Typography>
      )}

      {/* Save — bottom right, like the reference */}
      <Button
        disableRipple
        disableElevation
        variant="contained"
        startIcon={<SaveIcon />}
        onClick={handleSave}
        disabled={saving || !roleName.trim()}
        sx={{
          position: 'fixed',
          right: 32,
          bottom: 24,
          bgcolor: '#5ebbeb',
          color: '#fff',
          textTransform: 'none',
          fontWeight: 700,
          fontSize: 16,
          height: 42,
          px: 3,
          borderRadius: '12px',
          boxShadow: 'none',
          transition: INSTANT,
          '&:hover': { bgcolor: '#0ea5e9', boxShadow: 'none' },
          '&.Mui-disabled': { bgcolor: '#d4d4d4', color: '#737373' },
        }}
      >
        {saving ? 'Saving...' : 'Save'}
      </Button>

      {/* Confirm Leaving - raised when navigating away with unsaved changes */}
      <Dialog open={leaveOpen} onClose={() => setLeaveOpen(false)}>
        <DialogTitle sx={{ backgroundColor: '#fdecea', color: '#d32f2f', fontWeight: 700 }}>
          Confirm Leaving
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Typography>You have unsaved changes, are you sure you wish to leave?</Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setLeaveOpen(false)}
            sx={{
              backgroundColor: '#dedede', color: '#000', fontWeight: 700,
              textTransform: 'none', '&:hover': { backgroundColor: '#cfcfcf' }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              setLeaveOpen(false);
              savedSnapshot.current = snapshot(roleName, selectedPermissions);
              pendingLeaveRef.current?.();
              pendingLeaveRef.current = null;
            }}
            sx={{
              backgroundColor: '#e5484d', color: '#fff', fontWeight: 700,
              textTransform: 'none', '&:hover': { backgroundColor: '#d32f2f' }
            }}
          >
            Leave
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RolePermissions;
