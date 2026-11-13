import React, { useState } from 'react';
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
} from '@mui/material';
import {
  Add as AddIcon,
  EditOutlined as EditIcon,
  DeleteOutline as DeleteIcon,
  Check as CheckIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import PromotionCategoryDialog from '../../components/PromotionCategories/PromotionCategoryDialog';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import promotionCategoryService from '../../services/promotionCategoryService';
import usePageCache from '../../hooks/usePageCache';
import { useHasPermission } from '../../hooks/usePermissions';
import { useGlobalOutlet } from '../../components/Common/GlobalOutletFilter';

// Reference (Setup > Promotion Categories): "Promotion Categories  [+ New]" (green),
// a plain bordered table — Name | Promotion Source | Show on Order | Include in
// Integrations | Promotions | Actions — with ✓ / ✕ marks, the promotion COUNT, and
// green "Edit" / red "Delete" text actions. Ours adds an Outlet column on All
// Outlets (outlet-wise rule) and greys out a deactivated category.

const INSTANT = 'all 0s ease';

const NEW_BUTTON_SX = {
  bgcolor: '#28a745',
  color: '#fff',
  textTransform: 'none',
  boxShadow: 'none',
  borderRadius: 0,
  fontWeight: 400,
  fontSize: 28,
  lineHeight: 1,
  height: 48,
  px: 1.5,
  ml: 1.5,
  transition: INSTANT,
  '& .MuiButton-startIcon': { mr: 1, '& svg': { fontSize: 30 } },
  '&:hover': { bgcolor: '#218838', boxShadow: 'none' },
};

const rowActionSx = (color) => ({
  color,
  textTransform: 'none',
  fontWeight: 400,
  fontSize: 16,
  minWidth: 0,
  px: 1,
  borderRadius: 0,
  transition: INSTANT,
  '& .MuiButton-startIcon': { mr: 0.75, '& svg': { fontSize: 20 } },
  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
});

const BORDER = '1px solid #9e9e9e';

const PromotionCategories = () => {
  const { globalMode, outletNameOf } = useGlobalOutlet();
  // Renders from IndexedDB first, then revalidates in the background.
  // All Outlets: 'all' bypasses the auto outlet filter so every category (global +
  // per-outlet) is listed with its Outlet. With an outlet picked, the list is that
  // outlet's (own + global + receiving). includeInactive keeps deactivated rows.
  // One IndexedDB store; switching scope reloads (deps) and stale responses are
  // dropped by the hook.
  const {
    data: promotionCategories,
    loading,
    refresh: loadPromotionCategories,
  } = usePageCache(
    'promotionCategories',
    () =>
      promotionCategoryService
        .getPromotionCategories(globalMode ? 'all' : null, true)
        .then((r) => r.promotionCategories || []),
    { deps: [globalMode], maxAge: 0 }
  );
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingPromotionCategory, setEditingPromotionCategory] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const canAddPromotionCategories = useHasPermission('promotion_categories.add');
  const canEditPromotionCategories = useHasPermission('promotion_categories.edit');
  const canDeletePromotionCategories = useHasPermission('promotion_categories.delete');

  const handleAddPromotionCategory = () => {
    setEditingPromotionCategory(null);
    setOpenDialog(true);
  };

  const handleEditPromotionCategory = (promotionCategory) => {
    setEditingPromotionCategory(promotionCategory);
    setOpenDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await promotionCategoryService.deletePromotionCategory(deleteTarget.id);
      setDeleteTarget(null);
      await loadPromotionCategories();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete promotion category');
      console.error('Error deleting promotion category:', err);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handlePromotionCategorySaved = () => {
    setOpenDialog(false);
    setEditingPromotionCategory(null);
    loadPromotionCategories();
  };

  const Mark = ({ on }) => (on
    ? <CheckIcon sx={{ fontSize: 20, color: '#000' }} aria-label="yes" />
    : <CloseIcon sx={{ fontSize: 20, color: '#000' }} aria-label="no" />);

  const colCount = 6 + (globalMode ? 1 : 0);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: '#000', lineHeight: 1.2 }}>
          Promotion Categories
        </Typography>
        {canAddPromotionCategories && (
          <Button disableRipple disableElevation startIcon={<AddIcon />} onClick={handleAddPromotionCategory} sx={NEW_BUTTON_SX}>
            New
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer>
          <Table sx={{ borderCollapse: 'collapse', border: BORDER }}>
            <TableHead>
              <TableRow sx={{ '& th': { border: BORDER, bgcolor: '#fff', color: '#000', fontWeight: 700, fontSize: 16, textAlign: 'center', py: 1, px: 1 } }}>
                <TableCell sx={{ width: '15%' }}>Name</TableCell>
                <TableCell sx={{ width: '20%' }}>Promotion Source</TableCell>
                <TableCell>Show on Order</TableCell>
                <TableCell>Include in Integrations</TableCell>
                {globalMode && <TableCell>Outlet</TableCell>}
                <TableCell>Promotions</TableCell>
                <TableCell sx={{ width: 200 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody sx={{ '& td': { border: BORDER, fontSize: 16, color: '#000', py: 1.5, px: 2 }, '& tr': { bgcolor: '#f8f8f8' }, '& tr:hover': { bgcolor: '#e5e5e5' } }}>
              {promotionCategories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colCount} align="center" sx={{ py: 4 }}>
                    <Typography sx={{ color: '#676b72' }}>
                      No promotion categories found. {canAddPromotionCategories && 'Click "New" to create your first promotion category.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                promotionCategories.map((promotionCategory) => (
                  <TableRow key={promotionCategory.id} data-testid={`promocat-row-${promotionCategory.id}`} sx={{ opacity: promotionCategory.isActive ? 1 : 0.55 }}>
                    <TableCell>
                      {promotionCategory.name}
                      {!promotionCategory.isActive && <Typography component="span" sx={{ fontSize: 13, color: '#676b72', ml: 1 }}>(Inactive)</Typography>}
                    </TableCell>
                    <TableCell>{promotionCategory.promotionSource || ''}</TableCell>
                    <TableCell><Mark on={!!promotionCategory.showOnOrder} /></TableCell>
                    <TableCell><Mark on={!!promotionCategory.includeInIntegrations} /></TableCell>
                    {globalMode && <TableCell>{outletNameOf(promotionCategory.outletId)}</TableCell>}
                    <TableCell>{promotionCategory.promotionCount ?? 0}</TableCell>
                    <TableCell sx={{ py: 0.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                        {canEditPromotionCategories && (
                          <Button disableRipple startIcon={<EditIcon />} onClick={() => handleEditPromotionCategory(promotionCategory)} sx={rowActionSx('#28a745')}>
                            Edit
                          </Button>
                        )}
                        {canDeletePromotionCategories && (
                          <Button disableRipple startIcon={<DeleteIcon />} onClick={() => setDeleteTarget(promotionCategory)} sx={rowActionSx('#dc3545')}>
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

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        title="Delete Promotion Category"
        message={`Are you sure you want to delete the promotion category "${deleteTarget?.name}"?${deleteTarget?.promotionCount ? ` ${deleteTarget.promotionCount} promotion(s) will be left without a category.` : ''}`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />

      <PromotionCategoryDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onSave={handlePromotionCategorySaved}
        promotionCategory={editingPromotionCategory}
        mode={editingPromotionCategory ? 'edit' : 'create'}
      />
    </Box>
  );
};

export default PromotionCategories;
