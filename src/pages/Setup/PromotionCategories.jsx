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
  IconButton,
  Typography,
  Chip,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  AddOutlined,
  EditOutlined,
  DeleteOutline,
  ToggleOffOutlined,
  ToggleOnOutlined,
  CheckCircleOutline,
  CancelOutlined,
} from '@mui/icons-material';
import PromotionCategoryDialog from '../../components/PromotionCategories/PromotionCategoryDialog';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import promotionCategoryService from '../../services/promotionCategoryService';
import usePageCache from '../../hooks/usePageCache';
import { useHasPermission } from '../../hooks/usePermissions';
import { useAuth } from '../../contexts/AuthContext';

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
  height: 42,
  px: 4,
  transition: INSTANT,
  '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' },
};

const rowActionSx = (color) => ({
  color,
  borderRadius: '12px',
  transition: INSTANT,
  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
});

const CELL_PADDING = '8px 8px 8px 10px';

const PromotionCategories = () => {
  const { isSuperAdmin } = useAuth();
  // Renders from IndexedDB first, then revalidates in the background.
  // 'all' bypasses the auto outlet filter so this management page lists every
  // category (global + per-outlet); includeInactive keeps deactivated rows visible.
  const {
    data: promotionCategories,
    loading,
    refresh: loadPromotionCategories,
  } = usePageCache('promotionCategories', () =>
    promotionCategoryService
      .getPromotionCategories('all', true)
      .then((r) => r.promotionCategories || [])
  );
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingPromotionCategory, setEditingPromotionCategory] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Permission checks
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
      await loadPromotionCategories(); // Reload the list
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete promotion category');
      console.error('Error deleting promotion category:', err);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleStatus = async (promotionCategoryId) => {
    try {
      await promotionCategoryService.togglePromotionCategoryStatus(promotionCategoryId);
      await loadPromotionCategories();
      setError('');
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to toggle promotion category status';
      setError(errorMessage);
      console.error('Error toggling promotion category status:', err);
    }
  };

  const handlePromotionCategorySaved = () => {
    setOpenDialog(false);
    setEditingPromotionCategory(null);
    loadPromotionCategories(); // Reload the list
  };

  const getOutletDisplay = (promotionCategory) => {
    if (promotionCategory.outlet) {
      return `${promotionCategory.outlet.name} (${promotionCategory.outlet.code})`;
    }
    return 'Global';
  };

  const getOutletIdsDisplay = (promotionCategory) => {
    if (!promotionCategory.outletIds) return 'None';

    const outletIds = typeof promotionCategory.outletIds === 'string'
      ? JSON.parse(promotionCategory.outletIds)
      : promotionCategory.outletIds;

    return outletIds.length > 0 ? `${outletIds.length} outlets` : 'None';
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'left', alignItems: 'center', mb: 3, gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#000' }}>
            Promotion Categories
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage promotion categories for your outlets
          </Typography>
        </Box>
        {canAddPromotionCategories && (
          <Button
            variant="contained"
            disableRipple
            disableElevation
            startIcon={<AddOutlined />}
            onClick={handleAddPromotionCategory}
            sx={PRIMARY_BUTTON_SX}
          >
            New
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
        /* Promotion Categories Table */
        <TableContainer sx={{ mt: 1 }}>
          <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <TableHead>
              <TableRow
                sx={{
                  '& th': {
                    bgcolor: '#5ebbeb',
                    color: '#f8f8f8',
                    fontWeight: 700,
                    fontSize: 16,
                    textTransform: 'uppercase',
                    border: 0,
                    padding: CELL_PADDING,
                    height: 51,
                  },
                  '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
                  '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' },
                }}
              >
                <TableCell>Name</TableCell>
                <TableCell>Promotion Source</TableCell>
                <TableCell>Show on Order</TableCell>
                <TableCell>Include in Integrations</TableCell>
                {isSuperAdmin() && <TableCell>Outlet</TableCell>}
                <TableCell>Promotions</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody
              sx={{
                '& tr:nth-of-type(odd)': { bgcolor: '#ffffff' },
                '& tr:nth-of-type(even)': { bgcolor: '#f8f8f8' },
                '& td': { border: 0, fontSize: 16, color: '#000', padding: CELL_PADDING },
              }}
            >
              {promotionCategories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isSuperAdmin() ? 8 : 7} align="center" sx={{ py: 4 }}>
                    <Typography variant="body1" color="text.secondary">
                      No promotion categories found. {canAddPromotionCategories && 'Click "New" to create your first promotion category.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                promotionCategories.map((promotionCategory) => (
                  <TableRow key={promotionCategory.id}>
                    <TableCell>{promotionCategory.name}</TableCell>
                    <TableCell sx={{ color: promotionCategory.promotionSource ? '#000' : '#676b72' }}>
                      {promotionCategory.promotionSource || 'Not set'}
                    </TableCell>
                    <TableCell>
                      {promotionCategory.showOnOrder ? (
                        <CheckCircleOutline sx={{ color: '#16a34a' }} />
                      ) : (
                        <CancelOutlined sx={{ color: '#737373' }} />
                      )}
                    </TableCell>
                    <TableCell>
                      {promotionCategory.includeInIntegrations ? (
                        <CheckCircleOutline sx={{ color: '#16a34a' }} />
                      ) : (
                        <CancelOutlined sx={{ color: '#737373' }} />
                      )}
                    </TableCell>
                    {isSuperAdmin() && (
                      <TableCell>
                        <Chip
                          label={getOutletDisplay(promotionCategory)}
                          size="small"
                          variant="outlined"
                          sx={{ borderColor: '#5ebbeb', color: '#0284c7', fontWeight: 500 }}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <Tooltip title={`Outlets receiving promotions: ${getOutletIdsDisplay(promotionCategory)}`}>
                        <Chip
                          label={getOutletIdsDisplay(promotionCategory)}
                          size="small"
                          variant="outlined"
                          sx={{ borderColor: '#5ebbeb', color: '#0284c7', fontWeight: 500 }}
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={promotionCategory.isActive ? 'Active' : 'Inactive'}
                        size="small"
                        sx={{
                          bgcolor: promotionCategory.isActive ? '#16a34a' : '#737373',
                          color: '#fff',
                          fontWeight: 500,
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                        {canEditPromotionCategories && (
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              disableRipple
                              onClick={() => handleEditPromotionCategory(promotionCategory)}
                              sx={rowActionSx('#00a63e')}
                            >
                              <EditOutlined />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canEditPromotionCategories && (
                          <Tooltip title={promotionCategory.isActive ? 'Deactivate' : 'Activate'}>
                            <IconButton
                              size="small"
                              disableRipple
                              onClick={() => handleToggleStatus(promotionCategory.id)}
                              sx={rowActionSx('#0084d1')}
                            >
                              {promotionCategory.isActive ? <ToggleOnOutlined /> : <ToggleOffOutlined />}
                            </IconButton>
                          </Tooltip>
                        )}
                        {canDeletePromotionCategories && (
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              disableRipple
                              onClick={() => setDeleteTarget(promotionCategory)}
                              sx={rowActionSx('#e7000b')}
                            >
                              <DeleteOutline />
                            </IconButton>
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

      {/* Delete confirmation */}
      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        title="Delete Promotion Category"
        message={`Are you sure you want to delete the promotion category "${deleteTarget?.name}"?`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Promotion Category Dialog */}
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
