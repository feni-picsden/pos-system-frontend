import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Alert,
  Snackbar,
  InputAdornment,
  ClickAwayListener,
} from '@mui/material';
import {
  Add as AddIcon,
  ArrowDropDown,
  Close as CloseIcon,
  ImageOutlined,
} from '@mui/icons-material';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import productService from '../../services/productService';
import classificationService from '../../services/classificationService';
import productComboService from '../../services/productComboService';

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    height: 42,
    borderRadius: '8px',
    backgroundColor: '#fff',
    '& fieldset': { borderColor: '#404040', borderWidth: '1px' },
    '&:hover fieldset': { borderColor: '#404040' },
    '&.Mui-focused fieldset': { borderColor: '#000', borderWidth: '2px' },
  },
  '& .MuiOutlinedInput-input::placeholder': { color: '#808080', opacity: 1 },
};

const BulkPriceEdit = () => {
  const [products, setProducts] = useState([]);
  const [classifications, setClassifications] = useState([]);
  const [combos, setCombos] = useState([]);
  const [loading, setLoading] = useState(false);

  // search combobox
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [selection, setSelection] = useState(null); // { type: 'product'|'classification', id, name }

  const [onlyStock, setOnlyStock] = useState(false);
  const [extraQuantities, setExtraQuantities] = useState([]);
  const [newQuantity, setNewQuantity] = useState('');
  const [productPrices, setProductPrices] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const searchRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await productService.getProducts({ page: 1, limit: 1000, status: 'Active' });
        setProducts(response.products || []);
      } catch (error) {
        console.error('Error loading products:', error);
        setSnackbar({ open: true, message: 'Error loading products', severity: 'error' });
      } finally {
        setLoading(false);
      }
      try {
        const response = await classificationService.getClassifications({ type: 'CATEGORY' });
        setClassifications(response.classifications || []);
      } catch (error) {
        console.error('Error loading classifications:', error);
      }
      try {
        const response = await productComboService.getProductCombos({ isActive: true });
        setCombos(response?.combos || response?.productCombos || []);
      } catch (error) {
        console.error('Error loading combos:', error);
      }
    };
    load();
  }, []);

  // ---- scope (selection) drives which rows AND which quantity columns show ----
  const scopedProducts = useMemo(() => {
    let rows = products;
    if (selection?.type === 'product') {
      rows = rows.filter((p) => p.id === selection.id);
    } else if (selection?.type === 'classification') {
      rows = rows.filter((p) => p.categoryId === selection.id);
    } else if (selection?.type === 'combo') {
      const memberIds = new Set((selection.items || []).map((it) => it.productId));
      rows = rows.filter((p) => memberIds.has(p.id));
    }
    if (onlyStock && selection?.type !== 'product') {
      rows = rows.filter((p) => p.currentStockItems > 0);
    }
    return rows;
  }, [products, selection, onlyStock]);

  const quantities = useMemo(() => {
    const set = new Set();
    // With a selection, columns collapse to the scoped rows' real breaks; with no
    // selection, columns are the union of every product's real price-break quantities.
    (selection ? scopedProducts : products).forEach((p) =>
      (p.prices || []).forEach((pr) => set.add(pr.quantity))
    );
    extraQuantities.forEach((q) => set.add(q));
    const list = [...set].sort((a, b) => a - b);
    return list.length ? list : [1];
  }, [selection, scopedProducts, products, extraQuantities]);

  // ---- combobox options ----
  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2 || selection) return [];
    const productOpts = products
      .filter((p) => p.name?.toLowerCase().includes(q))
      .slice(0, 50)
      .map((p) => ({ type: 'product', id: p.id, name: p.name, imageUrl: p.imageUrl }));
    const classOpts = classifications
      .filter((c) => c.name?.toLowerCase().includes(q))
      .slice(0, 50)
      .map((c) => ({ type: 'classification', id: c.id, name: c.name }));
    // Combos are a local-only feature: they must appear alongside products.
    const comboOpts = combos
      .filter((c) => c.name?.toLowerCase().includes(q))
      .slice(0, 50)
      .map((c) => ({ type: 'combo', id: c.id, name: c.name, imageUrl: c.imageUrl, items: c.items }));
    return [...classOpts, ...productOpts, ...comboOpts];
  }, [query, products, classifications, combos, selection]);

  const showKeepTyping = open && !selection && query.trim().length === 1;
  const showPanel = open && !selection && (showKeepTyping || options.length > 0);

  const selectOption = (opt) => {
    setSelection(opt);
    setQuery(opt.name);
    setOpen(false);
    setHighlight(-1);
  };

  const clearSelection = () => {
    setSelection(null);
    setQuery('');
    searchRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (!showPanel || !options.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? options.length - 1 : h - 1));
    } else if (e.key === 'Enter' && highlight >= 0) {
      e.preventDefault();
      selectOption(options[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // ---- price editing ----
  const addQuantity = () => {
    const quantity = parseInt(newQuantity, 10);
    if (quantity > 0 && !quantities.includes(quantity)) {
      setExtraQuantities((prev) => [...prev, quantity]);
    }
    setNewQuantity('');
  };

  const getProductPrice = (productId, quantity) => {
    if (productPrices[productId]?.[quantity] !== undefined) {
      return productPrices[productId][quantity];
    }
    const product = products.find((p) => p.id === productId);
    const existing = product?.prices?.find((p) => p.quantity === quantity);
    return existing ? existing.price : null;
  };

  const handlePriceChange = (productId, quantity, value) => {
    setProductPrices((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], [quantity]: value ? parseFloat(value) : null },
    }));
  };

  // Reference has no Save button: a price cell commits on blur.
  const commitPrice = async (productId, quantity) => {
    const price = productPrices[productId]?.[quantity];
    if (price === undefined || price === null || !(price > 0)) return;
    const product = products.find((p) => p.id === productId);
    if (product?.prices?.find((p) => p.quantity === quantity)?.price === price) return;

    const cost = (product?.itemCost || 0) * quantity;
    const percentage = cost > 0 ? Math.round(((price - cost) / price) * 10000) / 100 : 0;
    try {
      await productService.bulkUpdatePrices([
        { productId, prices: [{ quantity, price, cost, percentage }] },
      ]);
      setProducts((prev) =>
        prev.map((p) => {
          if (p.id !== productId) return p;
          const prices = [...(p.prices || [])];
          const idx = prices.findIndex((x) => x.quantity === quantity);
          if (idx >= 0) prices[idx] = { ...prices[idx], price, cost, percentage };
          else prices.push({ quantity, price, cost, percentage });
          return { ...p, prices };
        })
      );
      setSnackbar({ open: true, message: 'Price updated', severity: 'success' });
    } catch (error) {
      console.error('Error saving price:', error);
      setSnackbar({ open: true, message: 'Error saving price', severity: 'error' });
    }
  };

  const addEnabled = !!newQuantity && parseInt(newQuantity, 10) > 0;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: '#000' }}>
          Bulk Price Edit
        </Typography>
        <Typography sx={{ fontSize: 16, color: '#000' }}>
          {scopedProducts.length} Products
        </Typography>
      </Box>

      {/* Search combobox */}
      <ClickAwayListener onClickAway={() => setOpen(false)}>
        <Box sx={{ position: 'relative', mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            inputRef={searchRef}
            placeholder="Search for Product or Classification..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (selection) setSelection(null);
              setHighlight(-1);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            sx={fieldSx}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  {selection && (
                    <CloseIcon
                      onClick={clearSelection}
                      sx={{ cursor: 'pointer', fontSize: 20, color: '#404040' }}
                    />
                  )}
                  <ArrowDropDown sx={{ color: '#404040' }} />
                </InputAdornment>
              ),
            }}
          />

          {showPanel && (
            <Paper
              sx={{
                position: 'absolute',
                top: 46,
                left: 0,
                right: 0,
                zIndex: 20,
                backgroundColor: '#fff',
                borderRadius: '8px',
                border: '1px solid #000',
                boxShadow: 'none',
                maxHeight: 288,
                overflowY: 'auto',
                transition: 'none',
              }}
            >
              {showKeepTyping ? (
                <Box sx={{ p: '16px', fontSize: 16 }}>Keep Typing to Search...</Box>
              ) : (
                [
                  { type: 'classification', label: 'Categories' },
                  { type: 'product', label: 'Products' },
                  { type: 'combo', label: 'Combos' },
                ].map(({ type: group, label }) => {
                  const items = options.filter((o) => o.type === group);
                  if (!items.length) return null;
                  return (
                    <Box key={group}>
                      <Box sx={{ p: '16px', fontSize: 16, fontWeight: 700 }}>
                        {label}
                      </Box>
                      {items.map((opt) => {
                        const idx = options.indexOf(opt);
                        const active = idx === highlight;
                        return (
                          <Box
                            key={`${opt.type}-${opt.id}`}
                            onMouseEnter={() => setHighlight(idx)}
                            onClick={() => selectOption(opt)}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              height: 56,
                              px: '16px',
                              fontSize: 16,
                              fontWeight: 400,
                              cursor: 'pointer',
                              backgroundColor: active ? '#5ebbeb' : 'transparent',
                              color: active ? '#f8f8f8' : '#000',
                            }}
                          >
                            {opt.imageUrl ? (
                              <Box
                                component="img"
                                src={opt.imageUrl}
                                alt=""
                                sx={{ width: 24, height: 24, objectFit: 'cover' }}
                              />
                            ) : (
                              <ImageOutlined sx={{ fontSize: 24, color: '#676b72' }} />
                            )}
                            {opt.name}
                          </Box>
                        );
                      })}
                    </Box>
                  );
                })
              )}
            </Paper>
          )}
        </Box>
      </ClickAwayListener>

      {/* Toggle + New Quantity + Add (one row) */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          mb: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ShopfrontSwitch
            checked={onlyStock}
            onChange={(e) => setOnlyStock(e.target.checked)}
          />
          <Typography sx={{ fontSize: 16, color: '#000' }}>
            Only display products that have stock (when editing a classification or all products)
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            type="number"
            size="small"
            placeholder="New Quantity"
            value={newQuantity}
            onChange={(e) => setNewQuantity(e.target.value)}
            sx={{ ...fieldSx, width: 216 }}
          />
          <Button
            variant="contained"
            disableElevation
            startIcon={<AddIcon />}
            onClick={addQuantity}
            disabled={!addEnabled}
            sx={{
              width: 113,
              height: 42,
              borderRadius: '12px',
              fontSize: 16,
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: 'none',
              backgroundColor: '#5ebbeb',
              color: '#fff',
              transition: 'none',
              '&:hover': { backgroundColor: '#4aa9dd', boxShadow: 'none' },
              '&.Mui-disabled': {
                backgroundColor: '#e5e5e5',
                color: '#737373',
                border: '1px solid #737373',
                cursor: 'not-allowed',
                pointerEvents: 'auto',
              },
            }}
          >
            Add
          </Button>
        </Box>
      </Box>

      {/* Products grid */}
      <TableContainer sx={{ backgroundColor: '#fff', borderRadius: 0, boxShadow: 'none' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow
              sx={{
                '& th': {
                  backgroundColor: '#5ebbeb',
                  color: '#f8f8f8',
                  fontWeight: 700,
                  fontSize: 16,
                  padding: '8px',
                  borderBottom: 'none',
                  whiteSpace: 'nowrap',
                },
              }}
            >
              <TableCell>Product</TableCell>
              <TableCell>Case Qty</TableCell>
              <TableCell>Price Set</TableCell>
              {quantities.map((quantity) => (
                <TableCell key={quantity} align="center">
                  {quantity}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {scopedProducts.map((product, index) => (
              <TableRow
                key={product.id}
                sx={{
                  backgroundColor: index % 2 === 0 ? '#fff' : '#f8f8f8',
                  '& td': {
                    fontSize: 16,
                    color: '#000',
                    padding: '8px 8px 8px 10px',
                    borderBottom: 'none',
                  },
                }}
              >
                <TableCell>{product.name}</TableCell>
                <TableCell>{product.caseQuantity}</TableCell>
                <TableCell>Default</TableCell>
                {quantities.map((quantity) => (
                  <TableCell key={quantity} align="center">
                    <TextField
                      type="number"
                      size="small"
                      value={getProductPrice(product.id, quantity) ?? ''}
                      onChange={(e) => handlePriceChange(product.id, quantity, e.target.value)}
                      onBlur={() => commitPrice(product.id, quantity)}
                      sx={{ ...fieldSx, width: 150 }}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                      }}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {loading && <Typography sx={{ mt: 1, color: '#676b72' }}>Loading products...</Typography>}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default BulkPriceEdit;
