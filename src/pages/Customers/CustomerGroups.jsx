import React, { useState, useEffect, useCallback } from 'react';
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
  Link,
  Alert,
  TextField,
} from '@mui/material';
import {
  EditOutlined as EditIcon,
  DeleteOutline as DeleteIcon,
  VisibilityOutlined as ViewIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import CustomerGroupDialog from '../../components/CustomerGroups/CustomerGroupDialog';
import customerGroupService from '../../services/customerGroupService';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import GlobalOutletFilter, { useGlobalOutlet } from '../../components/Common/GlobalOutletFilter';
import { useSelectedRegister } from '../../contexts/SelectedRegisterContext';

const ADD_GROUP_ACTION = 'customerGroups.add';

// Shopfront row actions: flat, fixed-width, instant grey hover, no ripple
const rowActionSx = (color, width) => ({
  color,
  width,
  height: 42,
  borderRadius: '12px',
  textTransform: 'none',
  fontWeight: 700,
  fontSize: 16,
  transition: 'none',
  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)', color },
});

const CustomerGroups = () => {
  // ponytail: one cache layer only — customerGroupService already serves this
  // list from IndexedDB. Wrapping it in usePageCache double-cached the same
  // store: the refresh path wrote the stale copy it had just been handed back
  // and re-stamped it as fresh, so the new counts never showed.
  const [customerGroups, setCustomerGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);
  // Outlet rule: navbar outlet set → API already scopes the list; All Outlets →
  // in-page Outlet filter + Outlet column.
  const { globalMode, outletNameOf } = useGlobalOutlet();
  const [outletFilter, setOutletFilter] = useState(null);
  useEffect(() => { if (!globalMode) setOutletFilter(null); }, [globalMode]);

  const loadCustomerGroups = useCallback(async () => {
    try {
      const response = await customerGroupService.getCustomerGroups();
      setCustomerGroups(response.customerGroups || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load customer groups');
      console.error('Error loading customer groups:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomerGroups();
  }, [loadCustomerGroups]);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    const filtered = customerGroups.filter(group => {
      const matchesSearch = group.name.toLowerCase().includes(term) ||
        (group.description && group.description.toLowerCase().includes(term));
      const matchesOutlet = !outletFilter || group.outletId === outletFilter.id;
      return matchesSearch && matchesOutlet;
    });
    setFilteredGroups(filtered);
  }, [customerGroups, searchTerm, outletFilter]);


  // No global customer groups: on All Outlets, Add first opens the Outlet
  // Selector; once the navbar switches to the picked outlet the create dialog
  // opens (the outlet switch re-mounts this page, hence the context hand-off).
  const { openOutletPicker, pendingOutletAction, clearPendingOutletAction } = useSelectedRegister();
  const handleAddGroup = () => {
    if (globalMode) openOutletPicker(ADD_GROUP_ACTION);
    else setOpenDialog(true);
  };
  useEffect(() => {
    if (pendingOutletAction === ADD_GROUP_ACTION && !globalMode) {
      clearPendingOutletAction();
      setOpenDialog(true);
    }
  }, [pendingOutletAction, globalMode, clearPendingOutletAction]);

  const handleDeleteGroup = (groupId) => {
    const group = customerGroups.find(g => g.id === groupId);
    setGroupToDelete(group || { id: groupId });
    setDeleteDialogOpen(true);
  };

  const confirmDeleteGroup = async () => {
    if (!groupToDelete || !groupToDelete.id) {
      setDeleteDialogOpen(false);
      setGroupToDelete(null);
      return;
    }
    try {
      await customerGroupService.deleteCustomerGroup(groupToDelete.id);
      await loadCustomerGroups(); // Reload the list
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete customer group');
      console.error('Error deleting customer group:', err);
    } finally {
      setDeleteDialogOpen(false);
      setGroupToDelete(null);
    }
  };

  const handleGroupSaved = () => {
    setOpenDialog(false);
    loadCustomerGroups(); // Reload the list
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h4" component="h1" fontWeight="bold">
            Customer Group
          </Typography>
          <Button
            variant="contained"
            onClick={handleAddGroup}
            sx={{ bgcolor: '#5ebbeb', '&:hover': { bgcolor: '#0ea5e9', boxShadow: 'none' }, transition: 'none', borderRadius: '12px', textTransform: 'none', boxShadow: 'none', fontWeight: 700, fontSize: 16, px: 4, height: 42 }}
          >
            Add Customer Group
          </Button>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="h4" fontWeight="bold" lineHeight={1}>
            {filteredGroups.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Results
          </Typography>
        </Box>
      </Box>

      {/* Search; Outlet filter only on All Outlets */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'flex-end' }}>
        {/* Full width: Search takes 2/3, Outlet 1/3 (All Outlets mode only). */}
        <Box sx={{ flex: 2, minWidth: 0 }}>
        <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 400, fontSize: 16, color: '#000' }}>Search</Typography>
        <TextField
          fullWidth
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{
            backgroundColor: 'white',
            '& .MuiOutlinedInput-root': {
              height: 40,
              borderRadius: 2,
              fontSize: 16,
              // Match Shopfront: dark-gray border, turns solid black on focus/click
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' }
            },
            '& .MuiOutlinedInput-input': { py: 0 },
          }}
        />
        </Box>
        <GlobalOutletFilter
          value={outletFilter}
          onChange={setOutletFilter}
          sx={{ flex: 1, minWidth: 0 }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

        {loading ? null: (
        <TableContainer sx={{ mt: 1 }}>
          <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <TableHead>
              <TableRow
                sx={{
                  '& th': { bgcolor: '#5ebbeb', color: 'white', fontWeight: 700, fontSize: 16, border: 0, height: 51, py: 0 },
                  '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
                  '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' }
                }}
              >
                <TableCell sx={{ pl: '20px' }}>Customer Group</TableCell>
                {globalMode && <TableCell>Outlet</TableCell>}
                <TableCell align="center">Number of Customers</TableCell>
                <TableCell align="center" sx={{ width: 480, pr: '20px' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody
              sx={{
                '& tr:nth-of-type(odd)': { bgcolor: '#ffffff' },
                '& tr:nth-of-type(even)': { bgcolor: '#f5f5f5' },
                '& td': { border: 0, fontSize: 16, color: '#000', py: 1.5 }
              }}
            >
              {filteredGroups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell sx={{ pl: '20px' }}>
                    <Link
                      component={RouterLink}
                      to={`/customers/groups/${group.id}/view`}
                      underline="none"
                      sx={{ fontSize: 16, fontWeight: 400, color: '#000', cursor: 'pointer' }}
                    >
                      {group.name}
                    </Link>
                    {group.description && (
                      <Typography variant="body2" color="text.secondary">
                        {group.description}
                      </Typography>
                    )}
                  </TableCell>
                  {globalMode && <TableCell>{outletNameOf(group.outletId)}</TableCell>}
                  <TableCell align="center">{group.customerCount}</TableCell>
                  <TableCell align="center" sx={{ width: 480, pr: '20px' }}>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', alignItems: 'center' }}>
                      <Button
                        disableRipple
                        startIcon={<ViewIcon />}
                        component={RouterLink} to={`/customers/groups/${group.id}/view`}
                        sx={rowActionSx('#0284c7', 129)}
                      >
                        View
                      </Button>
                      <Button
                        disableRipple
                        startIcon={<EditIcon />}
                        component={RouterLink} to={`/customers/groups/${group.id}`}
                        sx={rowActionSx('#16a34a', 120)}
                      >
                        Edit
                      </Button>
                      <Button
                        disableRipple
                        startIcon={<DeleteIcon />}
                        onClick={() => handleDeleteGroup(group.id)}
                        sx={rowActionSx('#dc2626', 137)}
                      >
                        Delete
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {filteredGroups.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={globalMode ? 4 : 3} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      {searchTerm ? 'No customer groups found matching your search' : 'No customer groups found'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Customer Group Form Dialog */}
      <CustomerGroupDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onGroupSaved={handleGroupSaved}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        title="Delete Customer Group"
        message={`Are you sure you want to delete the customer group "${groupToDelete?.name || ''}"?`}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setGroupToDelete(null);
        }}
        onConfirm={confirmDeleteGroup}
      />
    </Box>
  );
};

export default CustomerGroups;
