import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Alert,
  CircularProgress,
  Dialog,
  TextField,
} from '@mui/material';
import {
  Add as AddIcon,
  EditOutlined as EditIcon,
  DeleteOutline as DeleteIcon,
  ContentCopyOutlined as CloneIcon,
  RestoreOutlined as RestoreIcon,
  LockOutlined as LockIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { roleService } from '../../services/roleService';
import usePageCache from '../../hooks/usePageCache';
import trashedItemsService from '../../services/trashedItemsService';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import { useHasPermission } from '../../hooks/usePermissions';

// Shopfront reference has no transitions and no ripple anywhere.
const INSTANT = 'all 0s ease';

const PRIMARY_BUTTON_SX = {
  bgcolor: '#5ebbeb',
  color: '#fff',
  textTransform: 'none',
  boxShadow: 'none',
  borderRadius: '12px',
  fontWeight: 700,
  fontSize: 16,
  letterSpacing: '0.4px',
  height: 42,
  padding: '8px 32px',
  transition: INSTANT,
  '&:hover': { bgcolor: '#0ea5e9', boxShadow: 'none' },
};

const rowActionSx = (color) => ({
  color,
  textTransform: 'none',
  fontWeight: 700,
  fontSize: 16,
  height: 42,
  borderRadius: '12px',
  minWidth: 0,
  px: 1.5,
  transition: INSTANT,
  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
});

// Small centered name-prompt dialog matching the reference "Create New Role" prompt:
// light-blue title bar with '?' icon, question text, 42px input, Cancel/confirm buttons.
const NamePromptDialog = ({ open, title, prompt, value, confirmText, onChange, onCancel, onConfirm }) => (
  <Dialog
    open={open}
    onClose={onCancel}
    PaperProps={{ sx: { width: 300, maxWidth: '92vw', borderRadius: '8px', overflow: 'hidden' } }}
  >
    <Box sx={{ bgcolor: '#b9e0f7', px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography sx={{ color: '#0c4a6e', fontWeight: 700, fontSize: 18 }}>?</Typography>
      <Typography sx={{ color: '#0c4a6e', fontWeight: 700, fontSize: 18 }}>{title}</Typography>
    </Box>
    <Box
      component="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onConfirm();
      }}
      sx={{ px: 2, py: 2 }}
    >
      <Typography sx={{ color: '#313439', fontSize: 16, mb: 1.5 }}>{prompt}</Typography>
      <TextField
        autoFocus
        fullWidth
        value={value}
        onChange={(e) => onChange(e.target.value)}
        sx={{
          '& .MuiOutlinedInput-root': {
            height: 42,
            borderRadius: '8px',
            '& fieldset': { borderColor: '#595959', borderWidth: '1px' },
            '&:hover fieldset': { borderColor: '#595959' },
            '&.Mui-focused fieldset': { borderColor: '#000', borderWidth: '2px' },
          },
        }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.25, mt: 2.5 }}>
        <Button
          disableRipple
          onClick={onCancel}
          sx={{
            bgcolor: '#d4d4d4',
            color: '#313439',
            textTransform: 'none',
            fontWeight: 700,
            fontSize: 16,
            width: 118,
            height: 42,
            borderRadius: '12px',
            transition: INSTANT,
            '&:hover': { bgcolor: '#c2c2c2' },
          }}
        >
          Cancel
        </Button>
        <Button
          disableRipple
          type="submit"
          disabled={!value.trim()}
          sx={{
            bgcolor: '#0ea5e9',
            color: '#fff',
            textTransform: 'none',
            fontWeight: 700,
            fontSize: 16,
            width: 118,
            height: 42,
            borderRadius: '12px',
            transition: INSTANT,
            '&:hover': { bgcolor: '#0284c7' },
            '&.Mui-disabled': { bgcolor: '#d4d4d4', color: '#737373' },
          }}
        >
          {confirmText}
        </Button>
      </Box>
    </Box>
  </Dialog>
);

const RolesAndPermissions = () => {
  const navigate = useNavigate();
  // Roles render from IndexedDB first, then revalidate in the background.
  const {
    data: roles,
    loading,
    refresh: refreshRoles,
  } = usePageCache('roles', () => roleService.getRoles().then((r) => r.roles || []));
  const [deletedRoles, setDeletedRoles] = useState([]);
  const [error, setError] = useState('');
  const [cloneDialog, setCloneDialog] = useState({ open: false, role: null, name: '' });
  const [createDialog, setCreateDialog] = useState({ open: false, name: '' });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, role: null, loading: false });

  // Permission checks
  const canAddRoles = useHasPermission('roles.add');
  const canEditRoles = useHasPermission('roles.edit');
  const canDeleteRoles = useHasPermission('roles.delete');

  // usePageCache already loads the roles; only the trash needs fetching on mount.
  useEffect(() => {
    loadTrashedRoles();
  }, []);

  // Deleted roles stay listed as locked, restorable rows (reference behavior).
  // The trash is transactional, so it always comes from the server.
  const loadTrashedRoles = async () => {
    const trash = await trashedItemsService
      .getTrashedItems({ type: 'Role' })
      .catch(() => ({ items: [] }));
    setDeletedRoles(trash.items || []);
  };

  const loadRoles = async () => {
    await Promise.all([loadTrashedRoles(), refreshRoles()]);
  };

  const handleCreateConfirm = async () => {
    try {
      const response = await roleService.createRole({ name: createDialog.name.trim() });
      setCreateDialog({ open: false, name: '' });
      // Land on the permission editor for the new role (all permissions off by default).
      navigate(`/setup/roles/${response.role.id}/permissions`);
    } catch (err) {
      setCreateDialog({ open: false, name: '' });
      setError(err.response?.data?.error || 'Failed to create role');
      console.error('Error creating role:', err);
    }
  };

  const handleEditRole = (role) => {
    navigate(`/setup/roles/${role.id}/permissions`);
  };

  const handleDeleteConfirm = async () => {
    try {
      setDeleteDialog((d) => ({ ...d, loading: true }));
      await roleService.deleteRole(deleteDialog.role.id);
      setDeleteDialog({ open: false, role: null, loading: false });
      await loadRoles(); // Reload the list
    } catch (err) {
      setDeleteDialog({ open: false, role: null, loading: false });
      setError(err.response?.data?.error || 'Failed to delete role');
      console.error('Error deleting role:', err);
    }
  };

  const handleCloneRole = (role) => {
    setCloneDialog({
      open: true,
      role: role,
      name: `${role.name} Copy`
    });
  };

  const handleCloneConfirm = async () => {
    try {
      await roleService.cloneRole(cloneDialog.role.id, cloneDialog.name.trim());
      setCloneDialog({ open: false, role: null, name: '' });
      await loadRoles(); // Reload the list
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to clone role');
      console.error('Error cloning role:', err);
    }
  };

  const handleToggleStatus = async (roleId) => {
    try {
      await roleService.toggleRoleStatus(roleId);
      await loadRoles(); // Reload the list
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to toggle role status');
      console.error('Error toggling role status:', err);
    }
  };

  const handleRestoreDeleted = async (item) => {
    try {
      await trashedItemsService.restoreItem(item.id, 'Role');
      await loadRoles(); // Reload the list
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to restore role');
      console.error('Error restoring role:', err);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h4" component="h1" fontWeight="bold">
            Roles & Permissions
          </Typography>
          {canAddRoles && (
            <Button
              variant="contained"
              disableRipple
              disableElevation
              startIcon={<AddIcon />}
              onClick={() => setCreateDialog({ open: true, name: '' })}
              sx={PRIMARY_BUTTON_SX}
            >
              Add Role
            </Button>
          )}
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="h4" fontWeight="bold" lineHeight={1}>
            {loading ? 0 : roles.length + deletedRoles.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Results
          </Typography>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Loading */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        /* Roles Table */
        <TableContainer sx={{ mt: 1 }}>
          <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <TableHead>
              <TableRow
                sx={{
                  '& th': { bgcolor: '#5ebbeb', color: 'white', fontWeight: 700, fontSize: 16, border: 0, height: 51, py: 0 },
                  '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
                  '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' },
                }}
              >
                <TableCell sx={{ pl: '20px' }}>Name</TableCell>
                <TableCell>User Count</TableCell>
                <TableCell align="right" sx={{ pr: '20px' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody
              sx={{
                '& tr:nth-of-type(odd)': { bgcolor: '#ffffff' },
                '& tr:nth-of-type(even)': { bgcolor: '#f8f8f8' },
                '& td': { border: 0, fontSize: 16, color: '#000', height: 58, py: 0 },
              }}
            >
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell sx={{ pl: '20px' }}>{role.name}</TableCell>
                  <TableCell>{role.userCount}</TableCell>
                  <TableCell align="right" sx={{ pr: '20px' }}>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                      {(canEditRoles || canDeleteRoles) ? (
                        <>
                          {canEditRoles && (
                            <Button
                              disableRipple
                              startIcon={<EditIcon />}
                              onClick={() => handleEditRole(role)}
                              sx={rowActionSx('#16a34a')}
                            >
                              Edit
                            </Button>
                          )}
                          {canDeleteRoles && (
                            <Button
                              disableRipple
                              startIcon={<DeleteIcon />}
                              onClick={() => setDeleteDialog({ open: true, role, loading: false })}
                              sx={rowActionSx('#dc2626')}
                            >
                              Delete
                            </Button>
                          )}
                          {canEditRoles && (
                            <Button
                              disableRipple
                              startIcon={<CloneIcon />}
                              onClick={() => handleCloneRole(role)}
                              sx={rowActionSx('#d97706')}
                            >
                              Clone
                            </Button>
                          )}
                          {canEditRoles && !role.isActive && (
                            <Button
                              disableRipple
                              startIcon={<RestoreIcon />}
                              onClick={() => handleToggleStatus(role.id)}
                              sx={rowActionSx('#0284c7')}
                            >
                              Restore
                            </Button>
                          )}
                        </>
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          No actions available
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {/* Deleted (restorable) roles stay listed as locked gray rows */}
              {deletedRoles.map((item) => (
                <TableRow key={`deleted-${item.trashedItemId}`}>
                  <TableCell sx={{ pl: '20px' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LockIcon sx={{ fontSize: 18, color: '#9e9e9e' }} />
                      <Typography sx={{ fontSize: 16, color: '#9e9e9e' }}>{item.name}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell />
                  <TableCell align="right" sx={{ pr: '20px' }}>
                    {canAddRoles && (
                      <Button
                        disableRipple
                        startIcon={<RestoreIcon />}
                        onClick={() => handleRestoreDeleted(item)}
                        sx={rowActionSx('#0284c7')}
                      >
                        Restore
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {roles.length === 0 && deletedRoles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No roles found
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create New Role prompt */}
      <NamePromptDialog
        open={createDialog.open}
        title="Create New Role"
        prompt="What should the role be called?"
        value={createDialog.name}
        confirmText="Create"
        onChange={(name) => setCreateDialog({ ...createDialog, name })}
        onCancel={() => setCreateDialog({ open: false, name: '' })}
        onConfirm={handleCreateConfirm}
      />

      {/* Clone Role prompt */}
      <NamePromptDialog
        open={cloneDialog.open}
        title="Clone Role"
        prompt="What should the new role be called?"
        value={cloneDialog.name}
        confirmText="Clone"
        onChange={(name) => setCloneDialog({ ...cloneDialog, name })}
        onCancel={() => setCloneDialog({ open: false, role: null, name: '' })}
        onConfirm={handleCloneConfirm}
      />

      {/* Delete confirmation */}
      <ConfirmDeleteDialog
        open={deleteDialog.open}
        title="Delete Role"
        message={`Are you sure you want to delete the role "${deleteDialog.role?.name}"?`}
        loading={deleteDialog.loading}
        onCancel={() => setDeleteDialog({ open: false, role: null, loading: false })}
        onConfirm={handleDeleteConfirm}
      />
    </Box>
  );
};

export default RolesAndPermissions;
