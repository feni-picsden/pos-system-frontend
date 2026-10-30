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
  CloseOutlined as ClearIcon,
  VisibilityOutlined as ViewIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import PriceListDialog from '../../components/PriceLists/PriceListDialog';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import priceListService from '../../services/priceListService';
import usePageCache from '../../hooks/usePageCache';
import GlobalOutletFilter, { useGlobalOutlet } from '../../components/Common/GlobalOutletFilter';

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
  // Reference: no hover effect at all (no underline, no bg tint).
  transition: 'all 0s ease',
  '&:hover': { bgcolor: 'transparent', textDecoration: 'none' }
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
  // Outlet rule: with a navbar outlet the list is already that outlet's (+ global)
  // and nothing extra shows; on All Outlets an Outlet filter + Outlet column appear.
  const { globalMode, outletNameOf } = useGlobalOutlet();
  const [outletFilter, setOutletFilter] = useState(null);
  useEffect(() => { if (!globalMode) setOutletFilter(null); }, [globalMode]);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    const filtered = priceLists.filter((list) => {
      const matchesSearch = list.name.toLowerCase().includes(term) ||
        (list.description && list.description.toLowerCase().includes(term));
      const matchesOutlet = !outletFilter || list.outletId === outletFilter.id;
      return matchesSearch && matchesOutlet;
    });
    setFilteredLists(filtered);
  }, [priceLists, searchTerm, outletFilter]);

  const handleAddList = () => {
    setOpenDialog(true);
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
      {/* Header (reference: "Price Lists" title + Add Price List on one row, N Results right) */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: '#000', m: 0, lineHeight: 1.2 }}>
            Price Lists
          </Typography>
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

      {/* Search (reference: "Search" label above the box); Outlet filter only on All Outlets */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'flex-end' }}>
        <Box sx={{ width: globalMode ? 420 : '100%' }}>
        <Typography component="label" htmlFor="price-list-search" sx={{ display: 'block', fontSize: 16, fontWeight: 700, color: '#000', mb: 0.5 }}>
          Search
        </Typography>
        <TextField
          fullWidth
          id="price-list-search"
          inputRef={searchInputRef}
          placeholder="Search Price Lists..."
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
        <GlobalOutletFilter value={outletFilter} onChange={setOutletFilter} sx={{ width: 260, flexShrink: 0 }} labelSx={{ fontWeight: 700 }} />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* reference: no rows = no table at all, just the centred message */}
      {filteredLists.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1.5, mt: 6, color: '#6b7280', fontSize: 20 }}>
          <SearchIcon sx={{ fontSize: 26 }} />
          {searchTerm ? 'No results found. Try changing the search filters' : 'No price lists found'}
        </Box>
      ) : (
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
              <TableCell sx={{ width: '20%' }}>Name</TableCell>
              {globalMode && <TableCell sx={{ width: '20%' }}>Outlet</TableCell>}
              <TableCell sx={{ width: globalMode ? '40%' : '60%' }}>Customer Count</TableCell>
              <TableCell align="center" sx={{ width: '20%', pl: '48px', pr: '20px' }}>Actions</TableCell>
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
                {globalMode && (
                  <TableCell>
                    <Typography sx={{ fontSize: 16, color: '#000' }}>{outletNameOf(list.outletId)}</Typography>
                  </TableCell>
                )}
                <TableCell>
                  <Typography sx={{ fontSize: 16, color: '#000' }}>
                    {Number(list.customerCount) || 0}
                  </Typography>
                </TableCell>
                <TableCell sx={{ pl: '48px', pr: '20px' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Button
                      disableRipple
                      startIcon={<ViewIcon />}
                      component={RouterLink} to={`/customers/price-lists/${list.id}`}
                      sx={rowActionSx('#1c86f2')}
                    >
                      View
                    </Button>
                    <Button
                      disableRipple
                      startIcon={<EditIcon />}
                      component={RouterLink} to={`/customers/price-lists/${list.id}/configuration`}
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
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      )}

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
