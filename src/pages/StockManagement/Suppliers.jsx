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
  TextField,
  Snackbar,
} from '@mui/material';
import { NoResults } from '../../components/Common/EmptyResults';
import {
  Add as AddIcon,
  EditOutlined as EditIcon,
  DeleteOutline as DeleteIcon,
  VisibilityOutlined as ViewIcon,
  Link as AssignIcon,
  AccountTreeOutlined as MergeIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams, useLocation, Link as RouterLink } from 'react-router-dom';
import supplierService from '../../services/supplierService';
import usePageCache from '../../hooks/usePageCache';
import PerformanceGraph from '../../components/Classifications/PerformanceGraph';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import GlobalOutletFilter, { useGlobalOutlet } from '../../components/Common/GlobalOutletFilter';
import { useSelectedRegister } from '../../contexts/SelectedRegisterContext';
import { byMode } from '../../theme/sfPalette';
import { MERGE_SUPPLIERS_ACTION } from './SupplierMerge';

const ADD_SUPPLIER_ACTION = 'suppliers.add';

// Dark mode (no reference dark screenshots for Suppliers): values copied from the
// sibling pages matched to the reference - Products list (table, inputs, row
// actions), Classifications list (Assign) and Product Merge (merge mode).
const TEXT = byMode('#000', '#f8f8f8');
const HOVER_TINT = byMode('rgba(0,0,0,0.05)', 'rgba(255,255,255,0.08)');

// Header buttons: same as Products / Customer Groups (12px radius, 42px, bold 16).
const headerButtonSx = {
  borderRadius: '12px',
  textTransform: 'none',
  boxShadow: 'none',
  fontWeight: 700,
  fontSize: 16,
  px: 4,
  height: 42,
  transition: 'none',
};

// Row actions: flat, fixed-width, instant grey hover, no ripple (Customer Groups list).
const rowActionSx = (color, width) => ({
  color,
  width,
  height: 42,
  borderRadius: '12px',
  textTransform: 'none',
  fontWeight: 700,
  fontSize: 16,
  transition: 'none',
  '&:hover': { bgcolor: HOVER_TINT, color },
});

// Reference search field: 42px wrapper around a 40px input, 1px #404040 outline, 8px radius
const searchFieldSx = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: byMode('#fff', '#121212'),
    borderRadius: '8px',
    fontSize: 16,
    height: 42,
    '& .MuiOutlinedInput-notchedOutline': { border: byMode('1px solid #404040', '1px solid #a1a1a1') },
    '&:hover .MuiOutlinedInput-notchedOutline': { border: byMode('1px solid #404040', '1px solid #a1a1a1') },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: byMode('2px solid #000', '2px solid #2b7fff') },
  },
  '& .MuiOutlinedInput-input': { padding: '8px 16px', color: byMode(undefined, '#f8f8f8') },
  '& .MuiOutlinedInput-input::placeholder': { color: byMode('#808080', '#757575'), opacity: 1 },
};

const Suppliers = () => {
  // Renders from IndexedDB first, then revalidates in the background.
  const {
    data: suppliers,
    loading,
    refresh: loadSuppliers,
  } = usePageCache('suppliers', () =>
    supplierService.getSuppliers().then((r) => r.suppliers || [])
  );
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // The merge used to be a mode of this page (/suppliers?merge=1): old links
  // land on the Supplier Merge page.
  useEffect(() => {
    if (searchParams.get('merge') === '1') navigate('/suppliers/merge', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Supplier Merge lands here with the merged name: say so (Customers delete toast pattern).
  const [mergedToast, setMergedToast] = useState('');
  useEffect(() => {
    if (location.state?.merged) {
      setMergedToast(location.state.merged);
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // All Outlets (no header outlet / register): Outlet filter + Outlet column.
  const { globalMode, outletNameOf } = useGlobalOutlet();
  const [outletFilter, setOutletFilter] = useState(null);
  useEffect(() => { if (!globalMode) setOutletFilter(null); }, [globalMode]);

  useEffect(() => {
    const filtered = suppliers.filter(supplier =>
      supplier.name?.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (!outletFilter || supplier.outletId === outletFilter.id)
    );
    setFilteredSuppliers(filtered);
  }, [suppliers, searchTerm, outletFilter]);

  // No global suppliers from All Outlets (user 30/10/2026): Add first opens the
  // Outlet Selector (outlet rows only); once the navbar has switched, the
  // re-mounted page picks the pending action up and opens the create form.
  const { openOutletPicker, pendingOutletAction, clearPendingOutletAction } = useSelectedRegister();
  const handleAddSupplier = () => {
    if (globalMode) openOutletPicker(ADD_SUPPLIER_ACTION);
    else navigate('/suppliers/new');
  };
  // Merge never runs in All Outlets mode: same outlet-first prompt.
  const handleMergeSuppliers = () => {
    if (globalMode) openOutletPicker(MERGE_SUPPLIERS_ACTION);
    else navigate('/suppliers/merge');
  };
  useEffect(() => {
    if (globalMode) return;
    if (pendingOutletAction === ADD_SUPPLIER_ACTION) {
      clearPendingOutletAction();
      navigate('/suppliers/new');
    } else if (pendingOutletAction === MERGE_SUPPLIERS_ACTION) {
      clearPendingOutletAction();
      navigate('/suppliers/merge');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOutletAction, globalMode]);

  const handleDeleteSupplier = (supplierId) => {
    setSupplierToDelete(supplierId);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteSupplier = async () => {
    if (!supplierToDelete) {
      setDeleteDialogOpen(false);
      return;
    }
    try {
      await supplierService.deleteSupplier(supplierToDelete);
      await loadSuppliers();
    } catch (err) {
      setError('Failed to delete supplier');
      console.error('Error deleting supplier:', err);
    } finally {
      setDeleteDialogOpen(false);
      setSupplierToDelete(null);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Header (user design 30/10/2026): bold title, blue Add, outlined Merge, Results right */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h4" component="h1" fontWeight="bold">
            Suppliers
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddSupplier}
            sx={{ ...headerButtonSx, bgcolor: '#5ebbeb', color: byMode(undefined, '#232323'), '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' } }}
          >
            Add Supplier
          </Button>
          <Button
            variant="outlined"
            startIcon={<MergeIcon />}
            onClick={handleMergeSuppliers}
            sx={{ ...headerButtonSx, bgcolor: 'transparent', color: byMode('#707072', '#d4d4d4'), borderColor: byMode('#8e8e8e', '#a1a1a1'), '&:hover': { bgcolor: HOVER_TINT, borderColor: byMode('#8e8e8e', '#a1a1a1'), boxShadow: 'none' } }}
          >
            Merge Suppliers
          </Button>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="h4" lineHeight={1} sx={{ color: byMode(undefined, '#f8f8f8') }}>
            {filteredSuppliers.length}
          </Typography>
          <Typography variant="body2" sx={{ color: TEXT }}>
            Results
          </Typography>
        </Box>
      </Box>

      {/* Search (full width) + Outlet filter beside it on All Outlets (2/3 + 1/3) */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', mb: 3 }}>
        <Box sx={{ flex: 2, minWidth: 0 }}>
          <Typography sx={{ mb: 0.5, fontWeight: 400, fontSize: 16, color: TEXT }}>Search</Typography>
          <TextField
            spellCheck={false}
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ width: '100%', ...searchFieldSx }}
          />
        </Box>
        <GlobalOutletFilter value={outletFilter} onChange={setOutletFilter} sx={{ flex: 1, minWidth: 0 }} />
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Loading - use global loader only */}
      {loading ? null : filteredSuppliers.length === 0 ? <NoResults /> : (
        /* Suppliers Table - reference: nothing matched = no table, just the message */
        <TableContainer sx={{ bgcolor: byMode(undefined, '#232323'), borderRadius: byMode(undefined, '12px') }}>
          <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <TableHead>
              <TableRow
                sx={{
                  '& th': {
                    bgcolor: byMode('#5ebbeb', '#333333'),
                    color: byMode('#fff', '#5ebbeb'),
                    fontWeight: 700,
                    fontSize: 16,
                    border: 0,
                    height: 51,
                    py: 0,
                    whiteSpace: 'nowrap',
                  },
                  '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
                  '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' },
                }}
              >
                {globalMode && <TableCell sx={{ width: 180 }}>Outlet</TableCell>}
                <TableCell>Name</TableCell>
                <TableCell align="center" sx={{ width: 160 }}>Product Count</TableCell>
                <TableCell align="center" sx={{ width: 240 }}>Performance</TableCell>
                <TableCell align="center" sx={{ width: 560 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody
              sx={{
                '& tr:nth-of-type(odd)': { bgcolor: byMode('#ffffff', '#232323') },
                '& tr:nth-of-type(even)': { bgcolor: byMode('#f5f5f5', '#232323') },
                '& td': { border: 0, fontSize: 16, color: TEXT, py: 1.5 }
              }}
            >
              {filteredSuppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  {globalMode && (
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography sx={{ fontSize: 16, color: TEXT }}>{outletNameOf(supplier.outletId)}</Typography>
                    </TableCell>
                  )}
                  <TableCell>
                    <Typography sx={{ fontSize: 16, color: TEXT }}>
                      {supplier.name}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Typography sx={{ fontSize: 16, color: TEXT }}>
                      {supplier.productCount || 0}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ '& > *': { mx: 'auto' } }}>
                    <PerformanceGraph
                      supplierId={supplier.id}
                      productCount={supplier.productCount || 0}
                      type="supplier"
                      width={200}
                      height={80}
                    />
                  </TableCell>
                  <TableCell align="center">
                    {/* One row, like the other lists: View / Edit / Assign / Delete */}
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', alignItems: 'center' }}>
                      <Button disableRipple startIcon={<ViewIcon />} component={RouterLink} to={`/suppliers/${supplier.id}/view`} sx={rowActionSx(byMode('#0284c7', '#74d4ff'), 120)}>
                        View
                      </Button>
                      <Button disableRipple startIcon={<EditIcon />} component={RouterLink} to={`/suppliers/${supplier.id}/edit`} sx={rowActionSx(byMode('#16a34a', '#7bf1a8'), 110)}>
                        Edit
                      </Button>
                      <Button disableRipple startIcon={<AssignIcon />} component={RouterLink} to={`/suppliers/${supplier.id}/assign`} sx={rowActionSx(byMode('#ea7317', '#ffd230'), 130)}>
                        Assign
                      </Button>
                      <Button disableRipple startIcon={<DeleteIcon />} onClick={() => handleDeleteSupplier(supplier.id)} sx={rowActionSx(byMode('#dc2626', '#ffa2a2'), 130)}>
                        Delete
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        title="Delete Supplier"
        message="Are you sure you want to delete this supplier?"
        onCancel={() => {
          setDeleteDialogOpen(false);
          setSupplierToDelete(null);
        }}
        onConfirm={confirmDeleteSupplier}
      />

      <Snackbar
        open={Boolean(mergedToast)}
        autoHideDuration={4000}
        onClose={() => setMergedToast('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        message={`Suppliers successfully merged into "${mergedToast}"`}
      />
    </Box>
  );
};

export default Suppliers;
