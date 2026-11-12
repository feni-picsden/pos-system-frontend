import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Chip,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  VisibilityOutlined as VisibilityIcon,
} from '@mui/icons-material';
import transfereeService from '../../services/transfereeService';
import usePageCache from '../../hooks/usePageCache';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import { Glyph } from '../../components/Common/TemplateListActions';
import { useHasPermission } from '../../hooks/usePermissions';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';

// Shopfront reference has no transitions and no ripple anywhere.
const INSTANT = 'all 0s ease';

// Row action (View / Edit / Delete): coloured text with the reference's thin
// outline glyph, same as the Tax Rates list.
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
  '& .MuiButton-startIcon': { mr: '6px' },
  '& i.fal': { display: 'inline-flex', alignItems: 'center', '& svg': { width: 18, height: 18 } },
  '&.Mui-disabled': {
    bgcolor: 'rgba(0,0,0,0.1)',
    color: '#b5b5b5',
    pointerEvents: 'auto',
    cursor: 'not-allowed',
    '&:hover': { bgcolor: 'rgba(0,0,0,0.1)' },
  },
});

const TransferList = () => {
  const { isTrueSuperAdmin } = useAuth();
  const { selectedOutletId } = useSelectedOutlet();
  // Backend permission for New / Edit / Delete (routes/transferees.js).
  const canModify = useHasPermission('modify_transfer_list');
  // Outlet column only on "All Outlets": with a navbar outlet every row is
  // that outlet or Global, so the column adds nothing (TaxRates rule).
  const showOutletColumn = isTrueSuperAdmin() && selectedOutletId == null;

  // Renders from IndexedDB first, then revalidates in the background; a navbar
  // outlet switch reloads (the list is own outlet + global).
  const {
    data: transferees,
    loading,
    refresh: loadTransferees,
  } = usePageCache(
    'transferees',
    () => transfereeService.getTransferees().then((r) => r.transferees || []),
    // maxAge 0: always revalidate from the API in the background so rows
    // changed elsewhere (another device, admin tools) never linger for 5 min.
    { deps: [selectedOutletId], maxAge: 0 }
  );
  const [error, setError] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transfereeToDelete, setTransfereeToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = (transferee) => {
    setTransfereeToDelete(transferee);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!transfereeToDelete) return;
    try {
      setDeleting(true);
      await transfereeService.deleteTransferee(transfereeToDelete.id);
      setError('');
      await loadTransferees();
    } catch (err) {
      console.error('Error deleting transferee:', err);
      setError(err.response?.data?.error || 'Failed to delete transferee');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setTransfereeToDelete(null);
    }
  };

  const outletLabel = (row) => (row.outlet ? `${row.outlet.name}${row.outlet.code ? ` (${row.outlet.code})` : ''}` : 'Global');
  const transferCountText = (n) => `${n} transfer${n === 1 ? '' : 's'}`;

  if (loading && !transferees) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const rows = transferees || [];
  const colSpan = showOutletColumn ? 3 : 2;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography component="h1" sx={{ fontWeight: 700, fontSize: 32, color: '#000' }}>
          Transferees
        </Typography>
        {canModify && (
          <Button
            variant="outlined"
            disableRipple
            startIcon={<AddIcon />}
            component={RouterLink} to={'/settings/transfer-list/new'}
            sx={{
              color: '#5ebbeb',
              border: '1px solid #5ebbeb',
              bgcolor: 'transparent',
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: 16,
              px: 4,
              height: 42,
              transition: INSTANT,
              '&:hover': { bgcolor: 'rgba(0,0,0,0.05)', border: '1px solid #5ebbeb' }
            }}
          >
            New
          </Button>
        )}
        <Box sx={{ flexGrow: 1 }} />
        {/* Live results counter, like the Tax Rates / Products pages */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: '#000' }}>
            {rows.length}
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#676b72' }}>Results</Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <TableContainer>
        <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <TableHead>
            {/* One continuous rounded bar; 'Actions' label centred over the row buttons */}
            <TableRow
              sx={{
                '& th': {
                  bgcolor: '#5fb8ea',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: 16,
                  border: 0,
                  height: 51,
                  py: 0,
                  px: '16px',
                },
                '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px', pl: '20px' },
                '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px', pr: '20px' },
              }}
            >
              <TableCell>Name</TableCell>
              {showOutletColumn && <TableCell>Outlet</TableCell>}
              <TableCell align="center" sx={{ width: 420 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody
            sx={{
              '& tr': { bgcolor: '#ffffff', height: 74 },
              '& td': { borderBottom: '1px solid #e0e0e0', fontSize: 16, color: '#000', p: '16px' },
            }}
          >
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} align="center" sx={{ py: 4 }}>
                  No transferees found.{canModify && ' Click "New" to create your first transferee.'}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>{row.name}</span>
                      {/* Reference has no Status column; inactive rows are flagged inline so the feature stays visible. */}
                      {row.isActive === false && (
                        <Chip label="Inactive" size="small" sx={{ fontWeight: 500, cursor: 'default' }} />
                      )}
                    </Box>
                  </TableCell>
                  {showOutletColumn && (
                    <TableCell>
                      <Chip
                        label={outletLabel(row)}
                        size="small"
                        variant="outlined"
                        color={row.outlet ? 'primary' : 'default'}
                      />
                    </TableCell>
                  )}
                  <TableCell align="center">
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <Button
                        disableRipple
                        startIcon={<VisibilityIcon sx={{ fontSize: 18 }} />}
                        component={RouterLink} to={`/settings/transfer-list/${row.id}/view`}
                        sx={rowActionSx('#1c86f2')}
                      >
                        View
                      </Button>
                      {canModify && (
                        <Button
                          disableRipple
                          startIcon={<Glyph name="pencil" />}
                          component={RouterLink} to={`/settings/transfer-list/${row.id}/edit`}
                          sx={rowActionSx('#16a34a')}
                        >
                          Edit
                        </Button>
                      )}
                      {canModify && (
                        <Tooltip
                          title={row.transferCount > 0
                            ? `Used by ${transferCountText(row.transferCount)} - delete those transfers first, or mark the transferee inactive`
                            : ''}
                          placement="top"
                          arrow
                        >
                          <span>
                            <Button
                              disableRipple
                              startIcon={<Glyph name="trash" />}
                              onClick={() => handleDelete(row)}
                              disabled={row.transferCount > 0}
                              sx={rowActionSx('#dc2626')}
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

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        title="Delete Transferee"
        message={`Are you sure you want to delete ${transfereeToDelete?.name || ''}?`}
        loading={deleting}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setTransfereeToDelete(null);
        }}
        onConfirm={confirmDelete}
      />
    </Box>
  );
};

export default TransferList;
