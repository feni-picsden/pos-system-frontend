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
  ContentCopyOutlined as ContentCopyOutlinedIcon,
  LockOutlined as LockOutlinedIcon,
} from '@mui/icons-material';
import TaxRateDialog from '../../components/TaxRates/TaxRateDialog';
import MergeTaxRateDialog from '../../components/TaxRates/MergeTaxRateDialog';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import { Glyph } from '../../components/Common/TemplateListActions';
import PageLoader from '../../components/Common/PageLoader';
import { taxRateService } from '../../services/taxRateService';
import { useHasPermission } from '../../hooks/usePermissions';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
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

// Row action (Edit / Delete): coloured text with the reference's thin outline
// glyph (same glyph set as the Statements / Receipts lists).
const ROW_ACTION_SX = {
  textTransform: 'none',
  fontWeight: 700,
  fontSize: 16,
  height: 42,
  borderRadius: '12px',
  minWidth: 0,
  px: 1.5,
  transition: INSTANT,
  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
  '& .MuiButton-startIcon': { mr: '6px' },
  '& i.fal': { display: 'inline-flex', alignItems: 'center', '& svg': { width: 18, height: 18 } },
};

// Reference: "used by" explains the greyed Delete.
const usageText = (usage) => {
  if (!usage) return '';
  const parts = [];
  if (usage.products) parts.push(`${usage.products} product${usage.products === 1 ? '' : 's'}`);
  if (usage.saleItems) parts.push(`${usage.saleItems} sale line${usage.saleItems === 1 ? '' : 's'}`);
  if (usage.surcharges) parts.push(`${usage.surcharges} surcharge${usage.surcharges === 1 ? '' : 's'}`);
  return parts.join(', ');
};

const TaxRates = () => {
  const { isTrueSuperAdmin: isTrueSuperAdmin } = useAuth();
  const [taxRates, setTaxRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTaxRate, setEditingTaxRate] = useState(null);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  // Merge is irreversible (reference note), so Continue asks once more.
  const [pendingMerge, setPendingMerge] = useState(null);
  const [merging, setMerging] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Permission checks
  const canAddTaxRates = useHasPermission('taxes.add');
  const canEditTaxRates = useHasPermission('taxes.edit');
  const canDeleteTaxRates = useHasPermission('taxes.delete');

  // Load tax rates on component mount
  // Refetch on outlet switch (see Registers.jsx).
  const { selectedOutletId } = useSelectedOutlet();
  // Outlet column only on "All Outlets": with a navbar outlet every row is
  // that outlet or Global, so the column adds nothing.
  const showOutletColumn = isTrueSuperAdmin() && selectedOutletId == null;
  useEffect(() => {
    loadTaxRates();
  }, [selectedOutletId]);

  const loadTaxRates = async () => {
    // Setup list shows inactive rates too (so they can be re-activated), so it
    // reads straight from the server; the sell-screen cache keeps active-only.
    await posLocalDb.init();
    try {
      setLoading(true);
      const response = await taxRateService.getAllTaxRatesForSetup();
      const items = response.taxRates || [];
      await posLocalDb.putStoreAll('taxRates', items.filter((t) => t.isActive));
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

  // Reference: the global "No Tax" rate is a system rate - lock icon, no
  // Edit/Delete. The backend treats this name as special everywhere.
  const isLockedRate = (t) =>
    Boolean(t.isLocked) || (t.name === 'No Tax' && t.outletId == null);

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

  const handleMergeTaxRates = (fromTaxRateId, toTaxRateId) => {
    const from = taxRates.find((t) => t.id === fromTaxRateId);
    const to = taxRates.find((t) => t.id === toTaxRateId);
    if (!from || !to) return;
    setMergeDialogOpen(false);
    setPendingMerge({ from, to });
  };

  const handleConfirmMerge = async () => {
    if (!pendingMerge) return;
    try {
      setMerging(true);
      await taxRateService.mergeTaxRates(pendingMerge.from.id, pendingMerge.to.id);
      await posLocalDb.invalidateStore('taxRates');
      await loadTaxRates();
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to merge tax rates');
      console.error('Error merging tax rates:', err);
    } finally {
      setMerging(false);
      setPendingMerge(null);
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
        <Box sx={{ flexGrow: 1 }} />
        {/* Live results counter, like the Products / Stocktakes pages */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: '#000' }}>
            {taxRates.length}
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#676b72' }}>Results</Typography>
        </Box>
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
                  '& th': { bgcolor: '#5fb8ea', color: '#fff', fontWeight: 700, fontSize: 16, border: 0, height: 51, py: 0 },
                  '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px', pl: '20px' },
                  '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px', pr: '20px' },
                }}
              >
                <TableCell>Name</TableCell>
                <TableCell>Amount</TableCell>
                {showOutletColumn && <TableCell>Outlet</TableCell>}
                <TableCell>Status</TableCell>
                <TableCell>Default</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {taxRates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showOutletColumn ? 6 : 5} align="center" sx={{ py: 4, border: 0 }}>
                    <Typography variant="body1" color="text.secondary">
                      No tax rates found. {canAddTaxRates && 'Click "New" to create your first tax rate.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                taxRates.map((taxRate) => (
                  <TableRow
                    key={taxRate.id}
                    sx={{ height: 70, '& td': { borderBottom: '1px solid #e0e0e0' } }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {/* Reference row glyph: padlock for the system rate, copy icon otherwise. */}
                        {isLockedRate(taxRate) ? (
                          <Tooltip title="This is defined by the system and cannot be modified." placement="top-start">
                            <LockOutlinedIcon sx={{ fontSize: 18, color: '#000', cursor: 'default' }} />
                          </Tooltip>
                        ) : (
                          <Tooltip title="Copy ID">
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
                        {/* Reference: " - Default" in blue, or " - Set as Default" link */}
                        {taxRate.isDefault ? (
                          <Typography component="span" sx={{ color: '#3b82f6', fontSize: 16 }}>
                            {' - Default'}
                          </Typography>
                        ) : (
                          canEditTaxRates && taxRate.isActive && (
                            <Typography component="span" sx={{ fontSize: 16, color: '#000' }}>
                              {' - '}
                              <Box
                                component="button"
                                type="button"
                                onClick={() => handleSetDefault(taxRate.id)}
                                sx={{
                                  border: 0,
                                  bgcolor: 'transparent',
                                  color: '#000',
                                  textDecoration: 'underline',
                                  fontSize: 16,
                                  fontFamily: 'inherit',
                                  cursor: 'pointer',
                                  px: 0.5,
                                  py: 0.25,
                                  borderRadius: '8px',
                                  transition: INSTANT,
                                  '&:hover': { bgcolor: 'rgba(0,0,0,0.1)' },
                                }}
                              >
                                Set as Default
                              </Box>
                            </Typography>
                          )
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {formatAmount(taxRate.amount)}
                      </Typography>
                    </TableCell>
                    {showOutletColumn && (
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
                      {/* Read-only badge; Active is changed from the Edit dialog. */}
                      <Chip
                        label={taxRate.isActive ? 'Active' : 'Inactive'}
                        color={taxRate.isActive ? 'success' : 'default'}
                        size="small"
                        sx={{ fontWeight: 500, cursor: 'default' }}
                      />
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
                        {canEditTaxRates && !isLockedRate(taxRate) && (
                          <Button
                            disableRipple
                            startIcon={<Glyph name="pencil" />}
                            onClick={() => handleEditTaxRate(taxRate)}
                            sx={{ ...ROW_ACTION_SX, color: '#16a34a' }}
                          >
                            Edit
                          </Button>
                        )}
                        {canDeleteTaxRates && !isLockedRate(taxRate) && (
                          <Tooltip
                            title={
                              taxRate.isDefault
                                ? 'Cannot delete the default Tax Rate'
                                : taxRate.inUse
                                  ? `Used by ${usageText(taxRate.usage)} - merge it into another tax rate instead`
                                  : ''
                            }
                            placement="top"
                            arrow
                          >
                          <span>
                          <Button
                            disableRipple
                            startIcon={<Glyph name="trash" />}
                            onClick={() => setDeleteTarget(taxRate)}
                            disabled={Boolean(taxRate.isDefault) || Boolean(taxRate.inUse)}
                            sx={{
                              ...ROW_ACTION_SX,
                              color: '#dc2626',
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
                          </span>
                          </Tooltip>
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

      {/* Merge confirmation - there is no way to reverse a merge */}
      <ConfirmDeleteDialog
        open={Boolean(pendingMerge)}
        title="Merge Tax Rate"
        message={`Merge "${pendingMerge?.from?.name}" into "${pendingMerge?.to?.name}"? All product and sale data will be moved to "${pendingMerge?.to?.name}" and "${pendingMerge?.from?.name}" will be deleted. This cannot be undone.`}
        confirmText="Merge"
        loadingText="Merging..."
        loading={merging}
        onCancel={() => setPendingMerge(null)}
        onConfirm={handleConfirmMerge}
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
