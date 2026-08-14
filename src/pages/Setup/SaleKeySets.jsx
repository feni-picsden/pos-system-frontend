import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Add as AddIcon,
  EditOutlined as EditIcon,
  ContentCopy as CloneIcon,
  DeleteOutline as DeleteIcon,
  ArrowDropDown as ArrowDropDownIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import saleKeyService from '../../services/saleKeyService';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import { getSaleKeysOutletId } from '../../utils/saleKeysOutlet';
import posLocalDb from '../../services/posLocalDb';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';

const SaleKeySets = () => {
  const { getOutletId } = useAuth();
  const {
    outlets,
    selectedOutletId,
    isAllOutlets,
    isSuperAdmin,
  } = useSelectedOutlet();
  const [saleKeySets, setSaleKeySets] = useState([]);
  const [, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newSetData, setNewSetData] = useState({
    name: '',
    description: '',
    template: 'no-template',
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [setToDelete, setSetToDelete] = useState(null);
  const navigate = useNavigate();

  const resolveListOutletId = useCallback(
    () =>
      getSaleKeysOutletId({
        isSuperAdmin,
        getOutletId,
        selectedOutletId,
      }),
    [isSuperAdmin, getOutletId, selectedOutletId]
  );

  const loadSaleKeySets = useCallback(async () => {
    setError('');

    if (isSuperAdmin && isAllOutlets) {
      setSaleKeySets([]);
      setError('Select an outlet from the top navigation to view sale key sets.');
      setLoading(false);
      return;
    }

    const outletId = resolveListOutletId();
    if (outletId == null) {
      setSaleKeySets([]);
      setError('Select an outlet from the top navigation to view sale key sets.');
      setLoading(false);
      return;
    }

    // 1. Show cached data immediately (no spinner for the user)
    await posLocalDb.init();
    const cached = (await posLocalDb.getStoreAll('saleKeySets'))
      .filter((s) => s.outletId != null && Number(s.outletId) === Number(outletId));

    if (cached.length > 0) {
      setSaleKeySets(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    // 2. Always refresh from the real API (background when we have cache)
    try {
      const response = await saleKeyService.getSaleKeySets(outletId);
      const fresh = response.saleKeySets || [];
      await posLocalDb.putStoreAll('saleKeySets', fresh);
      setSaleKeySets(fresh);
    } catch (err) {
      console.error('Error loading sale key sets:', err);
      if (cached.length === 0) {
        setSaleKeySets([]);
        setError('Failed to load sale key sets for this outlet.');
      }
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, isAllOutlets, resolveListOutletId]);

  useEffect(() => {
    loadSaleKeySets();
  }, [loadSaleKeySets]);

  const getOutletLabel = (outletId) => {
    if (outletId == null) return '—';
    const outlet = outlets.find((o) => Number(o.id) === Number(outletId));
    return outlet ? `${outlet.name}${outlet.code ? ` (${outlet.code})` : ''}` : `Outlet #${outletId}`;
  };

  const handleCreateSet = async () => {
    try {
      if (!newSetData.name.trim()) {
        setSnackbar({ open: true, message: 'Please enter a name for the sale key set', severity: 'error' });
        return;
      }

      const targetOutletId = resolveListOutletId();
      if (!targetOutletId) {
        setSnackbar({
          open: true,
          message: 'Select an outlet from the top navigation',
          severity: 'error',
        });
        return;
      }

      const setData = {
        name: newSetData.name.trim(),
        description: newSetData.description.trim(),
        isActive: true,
        outletId: Number(targetOutletId),
      };

      if (newSetData.template !== 'no-template') {
        const templateConfig = saleKeyService.getDefaultConfig(newSetData.template);
        setData.config = templateConfig;
      }

      await saleKeyService.createSaleKeySet(setData);
      await posLocalDb.invalidateStore('saleKeySets');
      setSnackbar({ open: true, message: 'Sale key set created successfully', severity: 'success' });
      setCreateDialogOpen(false);
      setNewSetData({ name: '', description: '', template: 'no-template' });
      loadSaleKeySets();
    } catch (err) {
      console.error('Error creating sale key set:', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Failed to create sale key set',
        severity: 'error',
      });
    }
  };

  const handleEditSet = (setId) => {
    navigate(`/setup/sale-key/${setId}`);
  };

  const handleCloneSet = async (setId, setName) => {
    try {
      const newName = `${setName} (Copy)`;
      await saleKeyService.cloneSaleKeySet(setId, newName);
      await posLocalDb.invalidateStore('saleKeySets');
      setSnackbar({ open: true, message: 'Sale key set cloned successfully', severity: 'success' });
      loadSaleKeySets();
    } catch (err) {
      console.error('Error cloning sale key set:', err);
      setSnackbar({ open: true, message: 'Failed to clone sale key set', severity: 'error' });
    }
  };

  const handleDeleteSet = (setId, setName) => {
    setSetToDelete({ id: setId, name: setName });
    setDeleteDialogOpen(true);
  };

  const confirmDeleteSet = async () => {
    if (!setToDelete) {
      setDeleteDialogOpen(false);
      return;
    }
    try {
      await saleKeyService.deleteSaleKeySet(setToDelete.id);
      await posLocalDb.invalidateStore('saleKeySets');
      setSnackbar({ open: true, message: 'Sale key set deleted successfully', severity: 'success' });
      loadSaleKeySets();
    } catch (err) {
      console.error('Error deleting sale key set:', err);
      setSnackbar({ open: true, message: 'Failed to delete sale key set', severity: 'error' });
    } finally {
      setDeleteDialogOpen(false);
      setSetToDelete(null);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const createDisabled = isSuperAdmin && isAllOutlets;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Sales Keys
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          disabled={createDisabled}
          onClick={() => {
            setNewSetData({ name: '', description: '', template: 'no-template' });
            setCreateDialogOpen(true);
          }}
          sx={{ bgcolor: '#5ebbeb', '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' }, borderRadius: '12px', textTransform: 'none', boxShadow: 'none', fontWeight: 700, fontSize: 16, px: 4, height: 42 }}
        >
          New
        </Button>
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ width: '100%', overflow: 'hidden', boxShadow: 'none', bgcolor: 'transparent' }}>
        <TableContainer>
          <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <TableHead>
              <TableRow
                sx={{
                  '& th': { bgcolor: '#5ebbeb', color: 'white', fontWeight: 700, fontSize: 16, border: 0, height: 51, py: 0 },
                  '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
                  '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' }
                }}
              >
                <TableCell>Name</TableCell>
                {isSuperAdmin && (
                  <TableCell>Outlet</TableCell>
                )}
                <TableCell>Description</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody
              sx={{
                '& tr:nth-of-type(odd)': { bgcolor: '#ffffff' },
                '& tr:nth-of-type(even)': { bgcolor: '#f5f5f5' },
                '& td': { border: 0, fontSize: 16, color: '#000', py: 1.5 }
              }}
            >
              {saleKeySets.map((set) => (
                <TableRow key={set.id}>
                  <TableCell sx={{ fontWeight: 'medium' }}>{set.name}</TableCell>
                  {isSuperAdmin && (
                    <TableCell>{getOutletLabel(set.outletId)}</TableCell>
                  )}
                  <TableCell>{set.description}</TableCell>
                  <TableCell>
                    <Box
                      sx={{
                        display: 'inline-block',
                        px: 2,
                        py: 0.5,
                        borderRadius: 1,
                        bgcolor: set.isActive ? '#e8f5e8' : '#ffebee',
                        color: set.isActive ? '#2e7d32' : '#c62828',
                        fontSize: '0.875rem',
                        fontWeight: 'medium',
                      }}
                    >
                      {set.isActive ? 'Active' : 'Inactive'}
                    </Box>
                  </TableCell>
                  <TableCell>{formatDate(set.createdAt)}</TableCell>
                  <TableCell>{formatDate(set.updatedAt)}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 3 }}>
                      <Button
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => handleEditSet(set.id)}
                        sx={{ color: '#16a34a', textTransform: 'none', fontWeight: 700, fontSize: 16, minWidth: 0 }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="small"
                        startIcon={<CloneIcon />}
                        onClick={() => handleCloneSet(set.id, set.name)}
                        sx={{ color: '#ff9800', textTransform: 'none', fontWeight: 700, fontSize: 16, minWidth: 0 }}
                      >
                        Clone
                      </Button>
                      <Button
                        size="small"
                        startIcon={<DeleteIcon />}
                        onClick={() => handleDeleteSet(set.id, set.name)}
                        sx={{ color: '#dc2626', textTransform: 'none', fontWeight: 700, fontSize: 16, minWidth: 0 }}
                      >
                        Delete
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                bgcolor: '#1976d2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '2rem',
                fontWeight: 'bold',
              }}
            >
              ?
            </Box>
            <Typography variant="h6">Create New Sale Keys</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body1" sx={{ mb: 2, fontWeight: 'medium' }}>
              What should the sale keys be called?
            </Typography>
            <TextField
              fullWidth
              label="Name"
              value={newSetData.name}
              onChange={(e) => setNewSetData({ ...newSetData, name: e.target.value })}
              placeholder="Enter sale key set name"
              sx={{
                mb: 3,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' }
                }
              }}
            />

            <Typography variant="body1" sx={{ mb: 2, fontWeight: 'medium' }}>
              Should a template be used when creating sale keys?
            </Typography>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Template</InputLabel>
              <Select
                value={newSetData.template}
                onChange={(e) => setNewSetData({ ...newSetData, template: e.target.value })}
                label="Template"
                IconComponent={ArrowDropDownIcon}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      mt: 0.5,
                      borderRadius: '8px',
                      border: '1px solid #e0e0e0',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.12)'
                    }
                  }
                }}
                sx={{
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' }
                }}
              >
                <MenuItem value="no-template" sx={{ fontSize: 16, '&:hover': { bgcolor: '#5ebbeb' }, '&.Mui-selected': { bgcolor: 'transparent' }, '&.Mui-selected:hover': { bgcolor: '#5ebbeb' } }}>No template</MenuItem>
                <MenuItem value="home-keys" sx={{ fontSize: 16, '&:hover': { bgcolor: '#5ebbeb' }, '&.Mui-selected': { bgcolor: 'transparent' }, '&.Mui-selected:hover': { bgcolor: '#5ebbeb' } }}>Home Keys Template</MenuItem>
                <MenuItem value="more-functions" sx={{ fontSize: 16, '&:hover': { bgcolor: '#5ebbeb' }, '&.Mui-selected': { bgcolor: 'transparent' }, '&.Mui-selected:hover': { bgcolor: '#5ebbeb' } }}>More Functions Template</MenuItem>
                <MenuItem value="products" sx={{ fontSize: 16, '&:hover': { bgcolor: '#5ebbeb' }, '&.Mui-selected': { bgcolor: 'transparent' }, '&.Mui-selected:hover': { bgcolor: '#5ebbeb' } }}>Products Template</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Description (Optional)"
              value={newSetData.description}
              onChange={(e) => setNewSetData({ ...newSetData, description: e.target.value })}
              placeholder="Enter description"
              multiline
              rows={2}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' }
                }
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button
            onClick={() => {
              setCreateDialogOpen(false);
              setNewSetData({ name: '', description: '', template: 'no-template' });
            }}
            sx={{ color: '#666' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateSet}
            variant="contained"
            sx={{ bgcolor: '#5ebbeb', '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' }, borderRadius: '12px', textTransform: 'none', boxShadow: 'none', fontWeight: 700, fontSize: 16, px: 4, height: 42 }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        title="Delete Sale Key Set"
        message={`Are you sure you want to delete "${setToDelete?.name || ''}"? This action cannot be undone.`}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setSetToDelete(null);
        }}
        onConfirm={confirmDeleteSet}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SaleKeySets;
