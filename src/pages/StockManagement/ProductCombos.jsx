import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Alert,
  Snackbar,
  CircularProgress,
  InputAdornment,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  TablePagination,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  EditOutlined as EditIcon,
  DeleteOutline as DeleteIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  Remove as RemoveIcon,
} from '@mui/icons-material';
import productComboService from '../../services/productComboService';
import posLocalDb from '../../services/posLocalDb';
import usePageCache from '../../hooks/usePageCache';
import productService from '../../services/productService';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';

// Shopfront parity: dark-gray outline, solid black on focus, 8px radius
const fieldOutlineSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    fontSize: 16,
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' }
  }
};

const ProductCombos = () => {
  const { getOutletId } = useAuth();
  const { selectedOutletId } = useSelectedOutlet();
  const [filteredCombos, setFilteredCombos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [comboToDelete, setComboToDelete] = useState(null);
  const [editingCombo, setEditingCombo] = useState(null);
  const [comboName, setComboName] = useState('');
  const [comboDescription, setComboDescription] = useState('');
  const [comboItems, setComboItems] = useState([]);
  const [isActive, setIsActive] = useState(true);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalPrice, setTotalPrice] = useState(0);
  // The price actually charged for the combo (may be discounted below the
  // item total). Kept as a string for free-form editing; blank = item total.
  const [comboPrice, setComboPrice] = useState('');

  const parseOutletId = useCallback((value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }, []);

  const resolveCurrentOutletId = useCallback(() => {
    const selectedId = parseOutletId(selectedOutletId);
    if (selectedId !== null) return selectedId;
    return parseOutletId(getOutletId());
  }, [selectedOutletId, parseOutletId, getOutletId]);

  const currentOutletId = resolveCurrentOutletId();

  // Renders from IndexedDB first, then revalidates in the background.
  const {
    data: combos,
    loading,
    refresh: loadCombos,
  } = usePageCache(
    'combos',
    () =>
      productComboService
        .getProductCombos({
          page: 1,
          limit: 1000,
          ...(currentOutletId !== null ? { outletId: currentOutletId } : {}),
        })
        .then((r) => r.combos || []),
    { deps: [currentOutletId] }
  );

  useEffect(() => {
    filterCombos();
  }, [combos, searchTerm]);

  useEffect(() => {
    calculateTotalPrice();
  }, [comboItems]);

  // The combo item picker reads the catalog already synced to IndexedDB; the
  // API is only a fallback for a cold cache.
  const loadProducts = useCallback(async () => {
    try {
      await posLocalDb.init();
      const cached = await posLocalDb.getStoreAll('products');
      if (cached.length > 0) {
        setProducts(cached);
        return;
      }
      const outletId = resolveCurrentOutletId();
      const response = await productService.getProducts({
        page: 1,
        limit: 1000,
        status: 'Active',
        ...(outletId !== null ? { outletId } : {})
      });
      setProducts(response.products || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  }, [resolveCurrentOutletId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const filterCombos = () => {
    let filtered = combos;

    if (searchTerm) {
      filtered = filtered.filter(combo =>
        combo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (combo.description && combo.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredCombos(filtered);
  };

  const calculateTotalPrice = () => {
    const total = comboItems.reduce((sum, item) => {
      // Use override price if set, otherwise get default price from product prices (quantity 1)
      let itemPrice = item.price > 0 ? item.price : 0;
      if (itemPrice === 0 && item.product?.prices && item.product.prices.length > 0) {
        // Get price for quantity 1 (default price)
        const defaultPrice = item.product.prices.find(p => p.quantity === 1);
        itemPrice = defaultPrice ? defaultPrice.price : (item.product.prices[0]?.price || 0);
      }
      return sum + (itemPrice * (item.quantity || 1));
    }, 0);
    setTotalPrice(total);
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ open: false, message: '', severity: 'success' });
  };

  const handleOpenDialog = (combo = null) => {
    if (combo) {
      setEditingCombo(combo);
      setComboName(combo.name);
      setComboDescription(combo.description || '');
      setComboItems(combo.items || []);
      setIsActive(combo.isActive);
      // Initialize from the persisted comboPrice — item rows carry no saved
      // price, so recomputing from products would silently reset a discounted
      // combo back to full retail on save.
      const persistedPrice = combo.comboPrice ?? combo.totalPrice;
      setComboPrice(
        persistedPrice !== null && persistedPrice !== undefined && Number(persistedPrice) > 0
          ? String(persistedPrice)
          : ''
      );
    } else {
      setEditingCombo(null);
      setComboName('');
      setComboDescription('');
      setComboItems([]);
      setIsActive(true);
      setComboPrice('');
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCombo(null);
    setComboName('');
    setComboDescription('');
    setComboItems([]);
    setIsActive(true);
    setComboPrice('');
  };

  const handleAddProduct = (product) => {
    if (!product) return;
    
    // Check if product already exists in combo
    const existingIndex = comboItems.findIndex(item => item.productId === product.id);
    
    if (existingIndex >= 0) {
      // Update quantity if product already exists
      const updatedItems = [...comboItems];
      updatedItems[existingIndex].quantity = (updatedItems[existingIndex].quantity || 1) + 1;
      setComboItems(updatedItems);
    } else {
      // Add new product - get default price from product prices (quantity 1)
      let defaultPrice = 0;
      if (product.prices && product.prices.length > 0) {
        const priceForQty1 = product.prices.find(p => p.quantity === 1);
        defaultPrice = priceForQty1 ? priceForQty1.price : (product.prices[0]?.price || 0);
      }
      
      setComboItems([
        ...comboItems,
        {
          productId: product.id,
          product: product,
          quantity: 1,
          price: defaultPrice
        }
      ]);
    }
    setProductSearch('');
  };

  const handleRemoveItem = (index) => {
    const updatedItems = comboItems.filter((_, i) => i !== index);
    setComboItems(updatedItems);
  };

  const handleItemQuantityChange = (index, quantity) => {
    const updatedItems = [...comboItems];
    updatedItems[index].quantity = Math.max(1, parseInt(quantity) || 1);
    setComboItems(updatedItems);
  };

  const handleItemPriceChange = (index, price) => {
    const updatedItems = [...comboItems];
    updatedItems[index].price = Math.max(0, parseFloat(price) || 0);
    setComboItems(updatedItems);
  };

  const handleSave = async () => {
    try {
      if (!comboName.trim()) {
        showSnackbar('Combo name is required', 'error');
        return;
      }

      if (comboItems.length === 0) {
        showSnackbar('At least one product is required in the combo', 'error');
        return;
      }

      // Send the explicit combo price (backend: explicit totalPrice > 0 wins
      // and becomes comboPrice). Blank/invalid falls back to the item total.
      const parsedComboPrice = parseFloat(comboPrice);
      const effectiveComboPrice =
        Number.isFinite(parsedComboPrice) && parsedComboPrice > 0 ? parsedComboPrice : totalPrice;

      const comboData = {
        name: comboName.trim(),
        description: comboDescription.trim() || null,
        totalPrice: effectiveComboPrice,
        items: comboItems.map(item => ({
          productId: item.productId || item.product?.id,
          quantity: item.quantity || 1,
          price: item.price || 0
        })),
        outletId: resolveCurrentOutletId(),
        isActive
      };

      if (editingCombo) {
        await productComboService.updateProductCombo(editingCombo.id, comboData);
        showSnackbar('Product combo updated successfully', 'success');
      } else {
        await productComboService.createProductCombo(comboData);
        showSnackbar('Product combo created successfully', 'success');
      }

      handleCloseDialog();
      loadCombos();
    } catch (error) {
      console.error('Error saving combo:', error);
      showSnackbar(error.response?.data?.error || 'Error saving product combo', 'error');
    }
  };

  const handleDelete = (combo) => {
    setComboToDelete(combo);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!comboToDelete) {
      setDeleteDialogOpen(false);
      return;
    }

    try {
      await productComboService.deleteProductCombo(comboToDelete.id);
      showSnackbar('Product combo deleted successfully', 'success');
      loadCombos();
    } catch (error) {
      console.error('Error deleting combo:', error);
      showSnackbar('Error deleting product combo', 'error');
    } finally {
      setDeleteDialogOpen(false);
      setComboToDelete(null);
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const paginatedCombos = filteredCombos.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Typography variant="h4" component="h1" fontWeight="bold">
            Product Combos
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            sx={{ bgcolor: '#5ebbeb', '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' }, borderRadius: '12px', textTransform: 'none', boxShadow: 'none', fontWeight: 700, fontSize: 16, px: 4, height: 42 }}
          >
            Add Combo
          </Button>
        </Box>

        <TextField
          label="Search combos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ mb: 3, minWidth: 300, ...fieldOutlineSx }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper>
          <TableContainer>
            <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <TableHead>
                <TableRow
                  sx={{
                    '& th': { bgcolor: '#5ebbeb', color: 'white', fontWeight: 700, fontSize: 16, border: 0, height: 51, py: 0 },
                    '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
                    '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' }
                  }}
                >
                  <TableCell>Name</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Items</TableCell>
                  <TableCell>Total Price</TableCell>
                  <TableCell>Status</TableCell>
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
                {paginatedCombos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                        No product combos found. Click "Add Combo" to create one.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedCombos.map((combo) => (
                    <TableRow key={combo.id}>
                      <TableCell>
                        <Typography fontWeight="medium" sx={{ fontSize: 16, color: '#000' }}>
                          {combo.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: 16, color: '#000' }}>
                          {combo.description || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: 16, color: '#000' }}>
                          {combo.items?.length || 0} product(s)
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight="medium" sx={{ fontSize: 16, color: '#000' }}>
                          ${Number(combo.comboPrice ?? combo.totalPrice ?? combo.calculatedTotalPrice ?? 0).toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={combo.isActive ? 'Active' : 'Inactive'}
                          color={combo.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 3 }}>
                          <Button
                            size="small"
                            startIcon={<EditIcon />}
                            onClick={() => handleOpenDialog(combo)}
                            sx={{ color: '#16a34a', textTransform: 'none', fontWeight: 700, fontSize: 16, minWidth: 0 }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            startIcon={<DeleteIcon />}
                            onClick={() => handleDelete(combo)}
                            sx={{ color: '#dc2626', textTransform: 'none', fontWeight: 700, fontSize: 16, minWidth: 0 }}
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
          <TablePagination
            component="div"
            count={filteredCombos.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </Paper>
      )}

      {/* Add/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              {editingCombo ? 'Edit Product Combo' : 'Add Product Combo'}
            </Typography>
            <IconButton onClick={handleCloseDialog} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
            <TextField
              label="Combo Name"
              value={comboName}
              onChange={(e) => setComboName(e.target.value)}
              fullWidth
              required
              sx={fieldOutlineSx}
            />

            <TextField
              label="Description"
              value={comboDescription}
              onChange={(e) => setComboDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
              sx={fieldOutlineSx}
            />

            <FormControlLabel
              control={
                <ShopfrontSwitch
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
              }
              label="Active"
              sx={{ ml: 0, gap: 1.5, '& .MuiFormControlLabel-label': { fontSize: 16, color: '#000' } }}
            />

            <Box>
              <Typography variant="h6" gutterBottom>
                Products
              </Typography>
              
              <Autocomplete
                options={filteredProducts}
                getOptionKey={(option) => option.id}
                getOptionLabel={(option) => option.name || ''}
                value={null}
                inputValue={productSearch}
                onInputChange={(event, newInputValue) => {
                  setProductSearch(newInputValue);
                }}
                onChange={(event, newValue) => {
                  if (newValue) {
                    handleAddProduct(newValue);
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search and add product"
                    placeholder="Type to search products..."
                    sx={fieldOutlineSx}
                  />
                )}
                sx={{ mb: 2 }}
              />

              {comboItems.length > 0 && (
                <TableContainer>
                  <Table size="small" sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                    <TableHead>
                      <TableRow
                        sx={{
                          '& th': { bgcolor: '#5ebbeb', color: 'white', fontWeight: 700, fontSize: 16, border: 0, height: 51, py: 0 },
                          '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
                          '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' }
                        }}
                      >
                        <TableCell>Product</TableCell>
                        <TableCell align="center">Quantity</TableCell>
                        <TableCell align="right">Price</TableCell>
                        <TableCell align="right">Subtotal</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody
                      sx={{
                        '& tr:nth-of-type(odd)': { bgcolor: '#ffffff' },
                        '& tr:nth-of-type(even)': { bgcolor: '#f5f5f5' },
                        '& td': { border: 0, fontSize: 16, color: '#000' }
                      }}
                    >
                      {comboItems.map((item, index) => {
                        // Use override price if set, otherwise get default price from product prices (quantity 1)
                        let itemPrice = item.price > 0 ? item.price : 0;
                        if (itemPrice === 0 && item.product?.prices && item.product.prices.length > 0) {
                          // Get price for quantity 1 (default price)
                          const defaultPrice = item.product.prices.find(p => p.quantity === 1);
                          itemPrice = defaultPrice ? defaultPrice.price : (item.product.prices[0]?.price || 0);
                        }
                        const subtotal = itemPrice * (item.quantity || 1);
                        return (
                          <TableRow key={index}>
                            <TableCell>
                              <Typography sx={{ fontSize: 16, color: '#000' }}>
                                {item.product?.name || 'Unknown Product'}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <TextField
                                type="number"
                                value={item.quantity || 1}
                                onChange={(e) => handleItemQuantityChange(index, e.target.value)}
                                inputProps={{ min: 1, style: { textAlign: 'center' } }}
                                size="small"
                                sx={{ width: 80, ...fieldOutlineSx }}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <TextField
                                type="number"
                                value={item.price || 0}
                                onChange={(e) => handleItemPriceChange(index, e.target.value)}
                                inputProps={{ min: 0, step: 0.01, style: { textAlign: 'right' } }}
                                size="small"
                                sx={{ width: 100, ...fieldOutlineSx }}
                                InputProps={{
                                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                }}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Typography fontWeight="medium" sx={{ fontSize: 16, color: '#000' }}>
                                ${subtotal.toFixed(2)}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                onClick={() => handleRemoveItem(index)}
                                sx={{ color: '#dc2626' }}
                              >
                                <RemoveIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              <Box sx={{ mt: 2, p: 2, bgcolor: 'primary.light', borderRadius: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6">Items Total:</Typography>
                  <Typography variant="h6" fontWeight="bold">
                    ${totalPrice.toFixed(2)}
                  </Typography>
                </Box>
              </Box>

              <TextField
                label="Combo Price"
                type="number"
                value={comboPrice}
                onChange={(e) => setComboPrice(e.target.value)}
                fullWidth
                helperText="Price charged when the full combo is sold. Leave blank to charge the items total."
                inputProps={{ min: 0, step: 0.01 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
                sx={{ mt: 2, ...fieldOutlineSx }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} sx={{ textTransform: 'none', fontWeight: 700, fontSize: 16 }}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!comboName.trim() || comboItems.length === 0}
            sx={{ bgcolor: '#5ebbeb', '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' }, borderRadius: '12px', textTransform: 'none', boxShadow: 'none', fontWeight: 700, fontSize: 16, px: 4, height: 42 }}
          >
            {editingCombo ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        title="Delete Product Combo"
        message={`Are you sure you want to delete "${comboToDelete?.name || ''}"?`}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setComboToDelete(null);
        }}
        onConfirm={confirmDelete}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ProductCombos;

