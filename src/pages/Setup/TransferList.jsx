import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  VisibilityOutlined as VisibilityIcon,
  EditOutlined as EditIcon,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material';
import transfereeService from '../../services/transfereeService';
import usePageCache from '../../hooks/usePageCache';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';

// Shopfront reference has no transitions and no ripple anywhere.
const INSTANT = 'all 0s ease';

const rowActionSx = (color) => ({
  color,
  textTransform: 'none',
  fontWeight: 700,
  fontSize: 16,
  width: 142,
  height: 42,
  borderRadius: '12px',
  transition: INSTANT,
  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' }
});

const TransferList = () => {
  const navigate = useNavigate();
  // Renders from IndexedDB first, then revalidates in the background.
  const {
    data: transferees,
    loading,
    refresh: loadTransferees,
  } = usePageCache('transferees', () =>
    transfereeService.getTransferees().then((r) => r.transferees || [])
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography component="h1" sx={{ fontWeight: 700, fontSize: 32, color: '#000' }}>
          Transferees
        </Typography>
        <Button
          variant="outlined"
          disableRipple
          startIcon={<AddIcon />}
          onClick={() => navigate('/setup/transfer-list/new')}
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
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer>
        <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <TableHead>
            {/* One continuous rounded bar — no 'Actions' label, no seam between cells */}
            <TableRow
              sx={{
                '& th': {
                  bgcolor: '#5ebbeb',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: 16,
                  border: 0,
                  height: 51,
                  py: 0,
                  px: '16px',
                  borderRadius: '12px'
                }
              }}
            >
              <TableCell colSpan={2}>Name</TableCell>
            </TableRow>
          </TableHead>
          <TableBody
            sx={{
              '& tr': { bgcolor: '#ffffff' },
              '& td': { border: 0, fontSize: 16, color: '#000', p: '16px' },
              '& td:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
              '& td:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' }
            }}
          >
            {transferees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} align="center">
                  No transferees found.
                </TableCell>
              </TableRow>
            ) : (
              transferees.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                      <Button
                        disableRipple
                        startIcon={<VisibilityIcon />}
                        onClick={() => navigate(`/setup/transfer-list/${row.id}/view`)}
                        sx={rowActionSx('#0284c7')}
                      >
                        View
                      </Button>
                      <Button
                        disableRipple
                        startIcon={<EditIcon />}
                        onClick={() => navigate(`/setup/transfer-list/${row.id}/edit`)}
                        sx={rowActionSx('#16a34a')}
                      >
                        Edit
                      </Button>
                      <Button
                        disableRipple
                        startIcon={<DeleteIcon />}
                        onClick={() => handleDelete(row)}
                        sx={rowActionSx('#dc2626')}
                      >
                        Delete
                      </Button>
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

