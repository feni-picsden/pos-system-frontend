import React, { useState, useEffect, useMemo, useRef } from 'react';
import PageLoader from '../../components/Common/PageLoader';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  HistoryOutlined as HistoryIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import useUnsavedChangesGuard from '../../hooks/useUnsavedChangesGuard';
import { roleService } from '../../services/roleService';
import { outletService } from '../../services/outletService';
import { useAuth } from '../../contexts/AuthContext';
import PageSaveBar from '../../components/Common/PageSaveBar';

// Shopfront reference has no transitions and no ripple anywhere.
const INSTANT = 'all 0s ease';

// Baseline of the editable state; toggle order must not count as an edit.
const snapshot = (name, permissions) =>
  JSON.stringify([name.trim(), [...permissions].sort()]);

// Reference rule: a permission is only grantable while every permission it
// requires is granted. Dropping a parent drops its dependants too (repeat
// until stable, so a chain like See Host Connections > See Host Changes >
// Manage Host Changes collapses in one go).
const pruneUnmet = (selected, requiresByName) => {
  let current = [...selected];
  for (;;) {
    const have = new Set(current);
    const next = current.filter((name) => (requiresByName[name] || []).every((req) => have.has(req)));
    if (next.length === current.length) return next;
    current = next;
  }
};

const RolePermissions = () => {
  const navigate = useNavigate();
  const { roleId } = useParams();
  const isEditMode = !!roleId;
  const { user: currentUser, isTrueSuperAdmin } = useAuth();

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

  // Leaving the route, or pressing browser Back, with unsaved edits prompts
  // "Confirm Leaving" - same gate the other Setup editors register.
  useUnsavedChangesGuard(isDirty, (proceed) => {
    pendingLeaveRef.current = proceed;
    setLeaveOpen(true);
  });

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
      } else if (isTrueSuperAdmin()) {
        requests.push(outletService.getEveryOutlet());
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
        if (isTrueSuperAdmin()) setOutlets(second?.outlets || []);
        if (!isTrueSuperAdmin() && currentUser?.outletId) setOutletId(currentUser.outletId);
      }
      setError('');
    } catch (err) {
      setError('Failed to load role data');
      console.error('Error loading role:', err);
    } finally {
      setLoading(false);
    }
  };

  // name -> required permission names / label, from the catalog
  const requiresByName = useMemo(
    () => Object.fromEntries(catalog.map((p) => [p.name, p.requires || []])),
    [catalog]
  );
  const labelByName = useMemo(
    () => Object.fromEntries(catalog.map((p) => [p.name, p.description || p.label || p.name])),
    [catalog]
  );

  const handlePermissionToggle = (permission) => {
    setSelectedPermissions((current) =>
      current.includes(permission)
        ? pruneUnmet(current.filter((p) => p !== permission), requiresByName)
        : [...current, permission]
    );
  };

  // Category switch (local addition, requested): one toggle beside the heading
  // turns the whole category on when any of it is off, else off. Only the
  // permissions whose requirements are met can come on.
  // A category counts as fully on when nothing more in it CAN come on (members locked
  // by a parent in another category are ignored), so the next click turns it off.
  const categoryWouldBe = (current, names) =>
    pruneUnmet([...current, ...names.filter((n) => !current.includes(n))], requiresByName);
  const categoryAllOn = (current, names) =>
    categoryWouldBe(current, names).filter((n) => names.includes(n)).every((n) => current.includes(n));
  const handleCategoryToggle = (permissions) => {
    const names = permissions.map((p) => p.name);
    setSelectedPermissions((current) => {
      if (categoryAllOn(current, names)) return pruneUnmet(current.filter((n) => !names.includes(n)), requiresByName);
      return categoryWouldBe(current, names);
    });
  };

  // Which permissions this role may currently switch on
  const selectedSet = useMemo(() => new Set(selectedPermissions), [selectedPermissions]);
  const missingFor = (name) => (requiresByName[name] || []).filter((req) => !selectedSet.has(req));

  const handleSave = async () => {
    if (!roleName.trim()) {
      setError('Role name is required');
      return;
    }

    try {
      setSaving(true);
      setError('');

      // Never send a grant whose requirements are off (the API refuses it, and a
      // role saved before this rule existed may still carry one).
      const grants = pruneUnmet(selectedPermissions, requiresByName);
      if (isEditMode) {
        if (roleName.trim() !== originalName) {
          await roleService.updateRole(roleId, { name: roleName.trim() });
        }
        await roleService.updateRolePermissions(roleId, grants);
      } else {
        const response = await roleService.createRole({
          name: roleName.trim(),
          description: '',
          isActive: true,
          isDefault: false,
          outletId: outletId,
        });
        if (response.role && response.role.id) {
          await roleService.updateRolePermissions(response.role.id, grants);
        }
      }

      savedSnapshot.current = snapshot(roleName, grants);
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
        <Box sx={{ flexGrow: 1 }} />
        {isEditMode && (
          // Reference: grey outlined "Revisions" at the top right
          <Button
            disableRipple
            onClick={handleRevisions}
            startIcon={<HistoryIcon />}
            sx={{
              color: '#313439',
              border: '1px solid #8a8f98',
              bgcolor: '#fff',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: 16,
              height: 42,
              px: 2.5,
              borderRadius: '12px',
              transition: INSTANT,
              '&:hover': { bgcolor: 'rgba(0,0,0,0.05)', border: '1px solid #8a8f98' },
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
      {!isEditMode && isTrueSuperAdmin() && (
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

      {/* Categories — reference order, 4 toggles per row; the heading carries an
          all-on/all-off switch for the category (local addition) */}
      {groups.map(({ category, permissions }) => (
        <Box key={category} sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 20, color: '#313439' }}>
              {category}
            </Typography>
            <ShopfrontSwitch
              checked={permissions.some((p) => selectedPermissions.includes(p.name)) && categoryAllOn(selectedPermissions, permissions.map((p) => p.name))}
              onChange={() => handleCategoryToggle(permissions)}
              inputProps={{ 'aria-label': `All ${category} permissions` }}
            />
            <Typography sx={{ fontSize: 13, color: '#676b72' }}>
              {permissions.filter((p) => selectedPermissions.includes(p.name)).length} / {permissions.length}
            </Typography>
          </Box>
          {/* Reference: 4 equal columns, items flow DOWN each column (alphabetical top-to-bottom), roomy rows */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              gridAutoFlow: 'column',
              gridTemplateRows: { xs: 'none', sm: `repeat(${Math.ceil(permissions.length / 2)}, auto)`, md: `repeat(${Math.ceil(permissions.length / 4)}, auto)` },
              columnGap: 3,
              rowGap: 0,
            }}
          >
            {permissions.map((permission) => {
              const missing = missingFor(permission.name);
              const locked = missing.length > 0;
              // A grant whose parent is off reads as off (it cannot be used anyway)
              const checked = !locked && selectedPermissions.includes(permission.name);
              const cell = (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <ShopfrontSwitch
                    checked={checked}
                    disabled={locked}
                    onChange={() => handlePermissionToggle(permission.name)}
                    inputProps={{ 'aria-label': permission.label }}
                  />
                  <Typography sx={{ fontSize: 15, color: locked ? '#8a8f98' : '#313439' }}>
                    {permission.label}
                  </Typography>
                </Box>
              );
              return (
                <Box
                  key={permission.name}
                  sx={{ display: 'flex', alignItems: 'center', py: 1.25, minWidth: 0 }}
                >
                  {locked ? (
                    // Reference: hovering a greyed toggle lists what must be on first
                    <Tooltip
                      arrow
                      placement="top"
                      componentsProps={{
                        tooltip: { sx: { bgcolor: '#f8f8f8', color: '#000', fontSize: 15, border: '1px solid #d9d9d9', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', px: 2, py: 1.5, maxWidth: 360 } },
                        arrow: { sx: { color: '#f8f8f8', '&::before': { border: '1px solid #d9d9d9' } } },
                      }}
                      title={
                        <Box>
                          <Typography sx={{ fontSize: 15, mb: 0.5 }}>The following permissions are required:</Typography>
                          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                            {missing.map((req) => (
                              <Typography key={req} component="li" sx={{ fontSize: 15 }}>{labelByName[req] || req}</Typography>
                            ))}
                          </Box>
                        </Box>
                      }
                    >
                      {cell}
                    </Tooltip>
                  ) : cell}
                </Box>
              );
            })}
          </Box>
        </Box>
      ))}

      {groups.length === 0 && (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          No permissions match "{searchTerm}"
        </Typography>
      )}

      {/* Save — bottom right, like the reference */}
      <PageSaveBar onSave={handleSave} saving={saving} disabled={!roleName.trim()} />

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
