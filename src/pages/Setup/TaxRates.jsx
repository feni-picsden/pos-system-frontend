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
  IconButton,
  Typography,
  Chip,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Merge as MergeIcon,
  EditOutlined as EditOutlinedIcon,
  DeleteOutline as DeleteOutlineIcon,
  ContentCopyOutlined as ContentCopyOutlinedIcon,
  LockOutlined as LockOutlinedIcon,
} from '@mui/icons-material';
import TaxRateDialog from '../../components/TaxRates/TaxRateDialog';
import MergeTaxRateDialog from '../../components/TaxRates/MergeTaxRateDialog';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import PageLoader from '../../components/Common/PageLoader';
import { taxRateService } from '../../services/taxRateService';
import { useHasPermission } from '../../hooks/usePermissions';
import { useAuth } from '../../contexts/AuthContext';
import posLocalDb from '../../services/posLocalDb';

// Shopfront reference has no transitions anywhere.
const INSTANT = 'all 0s ease';

const PILL_BUTTON_SX = {
  color: '#fff',
  textTransform: 'none',
  boxShadow: 'none',
  borderRadius: '12px',
  fontWeight: 700,
  fontSize: 16,
  height: 42,
  px: 3,
  transition: INSTANT,
};

const TaxRates = () => {
  const { isSuperAdmin } = useAuth();
  const [taxRates, setTaxRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTaxRate, setEditingTaxRate] = useState(null);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Permission checks
  const canAddTaxRates = useHasPermission('taxes.add');
  const canEditTaxRates = useHasPermission('taxes.edit');
  const canDeleteTaxRates = useHasPermission('taxes.delete');

  // Load tax rates on component mount
  useEffect(() => {
    loadTaxRates();
  }, []);

  const loadTaxRates = async () => {
    await posLocalDb.init();
    const cached = await posLocalDb.getStoreAll('taxRates');
    if (cached.length > 0) {
      setTaxRates(cached);
      setLoading(false);
      const stale = await posLocalDb.isStoreStale('taxRates');
      if (stale) {
        taxRateService.getTaxRates()
          .then(async (r) => {
            const items = r.taxRates || [];
            await posLocalDb.putStoreAll('taxRates', items);
            setTaxRates(items);
          })
          .catch(() => {});
      }
      return;
    }
    try {
      setLoading(true);
      const response = await taxRateService.getTaxRates();
      const items = response.taxRates || [];
      await posLocalDb.putStoreAll('taxRates', items);
      setTaxRates(items);
      setError('');
    } catch (err) {
      setError('Failed to load tax rates');
      console.error('Error loading tax rates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTaxRate = () => {
    setEditingTaxRate(null);
    setOpenDialog(true);
  };

  const handleEditTaxRate = (taxRate) => {
    setEditingTaxRate(taxRate);
    setOpenDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await taxRateService.deleteTaxRate(deleteTarget.id);
      await posLocalDb.invalidateStore('taxRates');
      await loadTaxRates();
      setDeleteTarget(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete tax rate');
      console.error('Error deleting tax rate:', err);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleStatus = async (taxRateId) => {
    try {
      await taxRateService.toggleTaxRateStatus(taxRateId);
      await posLocalDb.invalidateStore('taxRates');
      await loadTaxRates();
      setError('');
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to toggle tax rate status';
      setError(errorMessage);
      console.error('Error toggling tax rate status:', err);
    }
  };

  const handleSetDefault = async (taxRateId) => {
    try {
      await taxRateService.setTaxRateAsDefault(taxRateId);
      await posLocalDb.invalidateStore('taxRates');
      await loadTaxRates();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to set tax rate as default');
      console.error('Error setting tax rate as default:', err);
    }
  };

  const handleCopyUuid = (taxRate) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(String(taxRate.id)).catch(() => {});
    }
  };

  const handleTaxRateSaved = async () => {
    setOpenDialog(false);
    setEditingTaxRate(null);
    await posLocalDb.invalidateStore('taxRates');
    loadTaxRates();
  };

  const formatAmount = (amount) => {
    return `${parseFloat(amount).toFixed(2)}%`;
  };

  const getOutletDisplay = (taxRate) => {
    if (taxRate.outlet) {
      return `${taxRate.outlet.name} (${taxRate.outlet.code})`;
    }
    return 'Global';
  };

  // Tax rates that have at least one other with the same amount (mergeable)
  const mergeableTaxRates = React.useMemo(() => {
    if (!taxRates.length) return [];
    const byAmount = {};
    taxRates.forEach((t) => {
      const key = String(parseFloat(t.amount));
      if (!byAmount[key]) byAmount[key] = [];
      byAmount[key].push(t);
    });
    const mergeable = [];
    Object.values(byAmount).forEach((group) => {
      if (group.length > 1) mergeable.push(...group);
    });
    return mergeable;
  }, [taxRates]);

  const handleOpenMergeDialog = () => {
    setMergeDialogOpen(true);
  };

  const handleMergeTaxRates = async (fromTaxRateId, toTaxRateId) => {
    try {
      await taxRateService.mergeTaxRates(fromTaxRateId, toTaxRateId);
      await posLocalDb.invalidateStore('taxRates');
      await loadTaxRates();
      setMergeDialogOpen(false);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to merge tax rates');
      console.error('Error merging tax rates:', err);
    }
  };

  if (loading && taxRates.length === 0) {
    return <PageLoader />;
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'left', alignItems: 'center', mb: 3, gap: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#000' }}>
          Tax Rates
        </Typography>
        {canAddTaxRates && (
          <Button
            variant="contained"
            disableElevation
            startIcon={<AddIcon />}
            onClick={handleAddTaxRate}
            sx={{
              ...PILL_BUTTON_SX,
              backgroundColor: '#22c55e',
              '&:hover': { backgroundColor: '#4ade80', boxShadow: 'none' },
            }}
          >
            New
          </Button>
        )}
        {canEditTaxRates && (
          <Button
            variant="contained"
            disableElevation
            startIcon={<MergeIcon />}
            onClick={handleOpenMergeDialog}
            sx={{
              ...PILL_BUTTON_SX,
              backgroundColor: '#0ea5e9',
              '&:hover': { backgroundColor: '#38bdf8', boxShadow: 'none' },
            }}
          >
            Merge
          </Button>
        )}
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Loading */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        /* Tax Rates Table */
        <TableContainer>
          <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <TableHead>
              <TableRow
                sx={{
                  '& th': { bgcolor: '#5ebbeb', color: '#fff', fontWeight: 700, fontSize: 16, border: 0, height: 51, py: 0 },
                  '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px', pl: '20px' },
                  '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px', pr: '20px' },
                }}
              >
                <TableCell>Name</TableCell>
                <TableCell>Amount</TableCell>
                {isSuperAdmin() && <TableCell>Outlet</TableCell>}
                <TableCell>Status</TableCell>
                <TableCell>Default</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {taxRates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isSuperAdmin() ? 6 : 5} align="center" sx={{ py: 4, border: 0 }}>
                    <Typography variant="body1" color="text.secondary">
                      No tax rates found. {canAddTaxRates && 'Click "New" to create your first tax rate.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                taxRates.map((taxRate) => (
                  <TableRow
                    key={taxRate.id}
                    sx={{ '& td': { borderBottom: '1px solid #e0e0e0' } }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {taxRate.isLocked && (
                          <LockOutlinedIcon sx={{ fontSize: 18, color: '#000' }} />
                        )}
                        {taxRate.masterDatabaseRef && (
                          <Tooltip title="Copy UUID">
                            <IconButton
                              size="small"
                              disableRipple
                              onClick={() => handleCopyUuid(taxRate)}
                              sx={{
                                p: 0.25,
                                borderRadius: '8px',
                                color: '#000',
                                transition: INSTANT,
                                '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
                              }}
                            >
                              <ContentCopyOutlinedIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {taxRate.name}
                        </Typography>
                        {taxRate.isDefault ? (
                          <Typography component="span" sx={{ color: '#3b82f6', fontSize: 16, ml: 0.5 }}>
                            Default
                          </Typography>
                        ) : (
                          canEditTaxRates && taxRate.isActive && (
                            <Box
                              component="button"
                              onClick={() => handleSetDefault(taxRate.id)}
                              sx={{
                                border: 0,
                                bgcolor: 'transparent',
                                color: '#000',
                                textDecoration: 'underline',
                                fontSize: 16,
                                fontFamily: 'inherit',
                                cursor: 'pointer',
                                px: 0.75,
                                py: 0.25,
                                borderRadius: '8px',
                                transition: INSTANT,
                                '&:hover': { bgcolor: 'rgba(0,0,0,0.1)' },
                              }}
                            >
                              Set as Default
                            </Box>
                          )
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {formatAmount(taxRate.amount)}
                      </Typography>
                    </TableCell>
                    {isSuperAdmin() && (
                      <TableCell>
                        <Chip
                          label={getOutletDisplay(taxRate)}
                          size="small"
                          variant="outlined"
                          color={taxRate.outlet ? 'primary' : 'default'}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <Tooltip title={canEditTaxRates ? (taxRate.isActive ? 'Click to deactivate' : 'Click to activate') : ''}>
                        <Chip
                          label={taxRate.isActive ? 'Active' : 'Inactive'}
                          color={taxRate.isActive ? 'success' : 'default'}
                          size="small"
                          onClick={canEditTaxRates ? () => handleToggleStatus(taxRate.id) : undefined}
                          sx={{ fontWeight: 500 }}
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      {taxRate.isDefault ? (
                        <Tooltip title="Default tax rate">
                          <StarIcon color="warning" />
                        </Tooltip>
                      ) : (
                        <StarBorderIcon sx={{ color: 'text.disabled' }} />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                        {canEditTaxRates && (
                          <Button
                            disableRipple
                            startIcon={<EditOutlinedIcon />}
                            onClick={() => handleEditTaxRate(taxRate)}
                            sx={{
                              color: '#16a34a',
                              textTransform: 'none',
                              fontWeight: 700,
                              fontSize: 16,
                              height: 42,
                              borderRadius: '12px',
                              minWidth: 0,
                              px: 1.5,
                              transition: INSTANT,
                              '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
                            }}
                          >
                            Edit
                          </Button>
                        )}
                        {canDeleteTaxRates && (
                          <Button
                            disableRipple
                            startIcon={<DeleteOutlineIcon />}
                            onClick={() => setDeleteTarget(taxRate)}
                            disabled={Boolean(taxRate.isDefault)}
                            sx={{
                              color: '#dc2626',
                              textTransform: 'none',
                              fontWeight: 700,
                              fontSize: 16,
                              height: 42,
                              borderRadius: '12px',
                              minWidth: 0,
                              px: 1.5,
                              transition: INSTANT,
                              '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
                              '&.Mui-disabled': {
                                bgcolor: 'rgba(0,0,0,0.1)',
                                color: '#b5b5b5',
                                pointerEvents: 'auto',
                                cursor: 'not-allowed',
                                '&:hover': { bgcolor: 'rgba(0,0,0,0.1)' },
                              },
                            }}
                          >
                            Delete
                          </Button>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Tax Rate Dialog */}
      <TaxRateDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onSave={handleTaxRateSaved}
        taxRate={editingTaxRate}
        mode={editingTaxRate ? 'edit' : 'create'}
      />

      {/* Merge Tax Rate Dialog */}
      <MergeTaxRateDialog
        open={mergeDialogOpen}
        onClose={() => setMergeDialogOpen(false)}
        onMerge={handleMergeTaxRates}
        mergeableTaxRates={mergeableTaxRates}
        taxRates={taxRates}
        formatAmount={formatAmount}
      />

      {/* Delete confirmation */}
      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        title="Delete Tax Rate"
        message={`Are you sure you want to delete the tax rate "${deleteTarget?.name}"?`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </Box>
  );
};

export default TaxRates;
