import React, { useState, useEffect, useRef } from 'react';
import PageLoader from '../../components/Common/PageLoader';
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
  Alert,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  EditOutlined as EditIcon,
  DeleteOutline as DeleteIcon,
  ToggleOn as ToggleOnIcon,
  ToggleOff as ToggleOffIcon,
  CloseOutlined as ClearIcon,
  VisibilityOutlined as ViewIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import PriceListDialog from '../../components/PriceLists/PriceListDialog';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import priceListService from '../../services/priceListService';
import usePageCache from '../../hooks/usePageCache';

// Row-action link style — matches the proven Promotions.jsx list-page pattern
const rowActionSx = (color) => ({
  color,
  textTransform: 'none',
  fontWeight: 700,
  fontSize: 16,
  height: 42,
  borderRadius: '12px',
  minWidth: 0,
  px: 1.5,
  // Reference shows underline-on-hover (no bg tint, no transition — Shopfront has none).
  transition: 'all 0s ease',
  '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' }
});

const PriceLists = () => {
  // Renders from IndexedDB first, then revalidates in the background.
  const {
    data: priceLists,
    loading,
    refresh: loadPriceLists,
  } = usePageCache('priceLists', () =>
    priceListService.getPriceLists().then((r) => r.priceLists || [])
  );
  const [filteredLists, setFilteredLists] = useState([]);
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [listToDelete, setListToDelete] = useState(null);
  const searchInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const filtered = priceLists.filter(list =>
      list.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (list.description && list.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredLists(filtered);
  }, [priceLists, searchTerm]);

  const handleAddList = () => {
    setOpenDialog(true);
  };

  const handleEditList = (list) => {
    navigate(`/customers/price-lists/${list.id}/configuration`);
  };

  const handleViewList = (list) => {
    navigate(`/customers/price-lists/${list.id}`);
  };

  const handleDeleteList = (listId) => {
    const list = priceLists.find(l => l.id === listId);
    setListToDelete(list || { id: listId });
    setDeleteDialogOpen(true);
  };

  const confirmDeleteList = async () => {
    if (!listToDelete || !listToDelete.id) {
      setDeleteDialogOpen(false);
      setListToDelete(null);
      return;
    }
    try {
      await priceListService.deletePriceList(listToDelete.id);
      await loadPriceLists(); // Reload the list
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete price list');
      console.error('Error deleting price list:', err);
    } finally {
      setDeleteDialogOpen(false);
      setListToDelete(null);
    }
  };

  const handleToggleStatus = async (listId) => {
    try {
      await priceListService.togglePriceListStatus(listId);
      await loadPriceLists(); // Reload the list
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to toggle price list status');
      console.error('Error toggling price list status:', err);
    }
  };

  const handleListSaved = () => {
    setOpenDialog(false);
    loadPriceLists(); // Reload the list
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    searchInputRef.current?.focus();
  };

  if (loading) {
    return <PageLoader />;
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddList}
            sx={{
              bgcolor: '#5ebbeb',
              color: '#f8f8f8',
              border: '1px solid #5ebbeb',
              borderRadius: '12px',
              textTransform: 'none',
              boxShadow: 'none',
              fontWeight: 700,
              fontSize: 16,
              px: 4,
              height: 42,
              transition: 'background 0.2s ease, color 0.2s ease',
              '&:hover': { bgcolor: '#f8f8f8', color: '#5ebbeb', boxShadow: 'none' }
            }}
          >
            Add Price List
          </Button>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: '19.2px', fontWeight: 400 }} lineHeight={1.2}>
            {filteredLists.length}
          </Typography>
          <Typography sx={{ fontSize: 16, fontWeight: 400 }} color="text.secondary">
            Results
          </Typography>
        </Box>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          inputRef={searchInputRef}
          placeholder="Search for Price List"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            endAdornment: searchTerm ? (
              <InputAdornment position="end">
                <IconButton
                  aria-label="Clear search"
                  onClick={handleClearSearch}
                  sx={{ width: 25, height: 24, p: 0, borderRadius: 0, color: '#404040' }}
                >
                  <ClearIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{
            backgroundColor: 'white',
            '& .MuiOutlinedInput-root': {
              height: 40,
              pr: '8px',
              borderRadius: '8px',
              fontSize: 16,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' }
            },
            '& .MuiOutlinedInput-input': {
              p: '8px 16px',
              '&::placeholder': { color: '#757575', opacity: 1 }
            },
          }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <TableContainer sx={{ mt: 1 }}>
        <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <TableHead>
            <TableRow
              sx={{
                '& th': { bgcolor: '#5ebbeb', color: '#f8f8f8', fontWeight: 400, fontSize: 16, border: 0, height: 51, py: 0 },
                '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
                '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' }
              }}
            >
              <TableCell sx={{ width: '46%' }}>Name</TableCell>
              <TableCell sx={{ width: '48%' }}>Customer Count</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody
            sx={{
              '& tr:nth-of-type(odd)': { bgcolor: '#ffffff' },
              '& tr:nth-of-type(even)': { bgcolor: '#f5f5f5' },
              '& td': { border: 0, fontSize: 16, color: '#000', py: 1.5 }
            }}
          >
            {filteredLists.map((list) => (
              <TableRow key={list.id}>
                <TableCell>
                  <Typography sx={{ fontSize: 16, color: '#000' }}>
                    {list.name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography sx={{ fontSize: 16, color: '#000' }}>
                    {list.customerCount}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ pr: '20px' }}>
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
                    <Button
                      disableRipple
                      startIcon={<ViewIcon />}
                      onClick={() => handleViewList(list)}
                      sx={rowActionSx('#1c86f2')}
                    >
                      View
                    </Button>
                    <Button
                      disableRipple
                      startIcon={<EditIcon />}
                      onClick={() => handleEditList(list)}
                      sx={rowActionSx('#32b643')}
                    >
                      Edit
                    </Button>
                    <Button
                      disableRipple
                      startIcon={<DeleteIcon />}
                      onClick={() => handleDeleteList(list.id)}
                      sx={rowActionSx('#e33430')}
                    >
                      Delete
                    </Button>
                    <IconButton
                      onClick={() => handleToggleStatus(list.id)}
                      sx={{ color: list.isActive ? '#ff9800' : '#4caf50' }}
                      size="small"
                      title={list.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {list.isActive ? <ToggleOffIcon /> : <ToggleOnIcon />}
                    </IconButton>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
            {filteredLists.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    {searchTerm ? 'No price lists found matching your search' : 'No price lists found'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Price List Dialog */}
      <PriceListDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onSave={handleListSaved}
      />

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        title="Delete Price List"
        message={`Are you sure you want to delete the price list "${listToDelete?.name || ''}"?`}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setListToDelete(null);
        }}
        onConfirm={confirmDeleteList}
      />
    </Box>
  );
};

export default PriceLists;
