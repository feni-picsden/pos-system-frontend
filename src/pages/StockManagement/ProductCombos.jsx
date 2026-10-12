import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  DeleteOutline as DeleteIcon,
  EditOutlined as EditIcon,
  Remove as RemoveIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import productService from '../../services/productService';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';

// Product Combos: several products sold together under one name.
//
// A combo IS an ordinary product (type 'Combo Product') whose contents live in
// comboContents — the same shape the reference gives Basket Products. Being a
// product is what makes it reachable from promotions, orders, classifications,
// the sell-screen search and a barcode without any combo-specific plumbing.
//
// This page is a shortcut, not a second source of truth: everything here goes
// through the normal product endpoints, and the full Product Edit screen stays
// the way to reach the fields this dialog leaves out (classifications,
// suppliers, tax rates, images, …).
const COMBO_TYPE = 'Combo Product';

// The combo's own sell price is its single-unit price row.
const comboSellPrice = (product) => {
  const rows = (product?.prices || []).filter((r) => r?.priceSetId == null);
  const single = rows.find((r) => Number(r.quantity) === 1) || rows[0];
  if (!single) return 0;
  return (Number(single.price) || 0) / (Number(single.quantity) || 1);
};

// Products carry barcodes as a JSON array of { code, quantity }; a combo only
// ever needs the one code that rings it up.
const firstBarcode = (product) => {
  const list = Array.isArray(product?.barcodes) ? product.barcodes : [];
  const first = list.find((b) => (typeof b === 'string' ? b : b?.code));
  if (!first) return '';
  return typeof first === 'string' ? first : String(first.code || '');
};
const money = (value) => `$${(Number(value) || 0).toFixed(2)}`;

// A row's effective unit price: the override when set, otherwise the product's
// quantity-1 price (falling back to its first tier).
const unitPriceOf = (row) => {
  const override = Number(row.price) || 0;
  if (override > 0) return override;
  const tiers = row.product?.prices || [];
  const single = tiers.find((p) => Number(p.quantity) === 1) || tiers[0];
  return Number(single?.price) || 0;
};

const rowSubtotal = (row) => unitPriceOf(row) * (Number(row.quantity) || 0);

// A member's quantity can be a fraction — .29 of a keg for a pot, .57 for a
// pint — and the reference holds sell quantities to two decimal places, so a
// third decimal is rounded away here the same way the server does it.
const roundQty = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.round(n * 100) / 100;
};

const SKY = '#5ebbeb';
const SKY_HOVER = '#4aa9dd';

const headerCellSx = {
  bgcolor: SKY,
  color: '#fff',
  fontWeight: 700,
  fontSize: 16,
  border: 0,
  height: 51,
  py: 0,
};

const EMPTY_FORM = {
  id: null,
  name: '',
  description: '',
  isActive: true,
  barcode: '',
  comboPrice: '',
  items: [],
};

const ProductCombos = () => {
  const { confirm } = useAppDialogs();

  const [combos, setCombos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [productOptions, setProductOptions] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await productService.getProducts({ type: COMBO_TYPE, limit: 500 });
      setCombos(response?.products || []);
    } catch (err) {
      console.error('Error loading product combos:', err);
      setError('Failed to load product combos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await productService.getProducts({ limit: 500, status: 'Active' });
        // A combo inside a combo would spend stock it does not own.
        if (!cancelled) setProductOptions((response?.products || []).filter((p) => p.type !== COMBO_TYPE));
      } catch {
        // The picker stays empty; the list itself still works.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return combos;
    return combos.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(term) ||
        (c.description || '').toLowerCase().includes(term)
    );
  }, [combos, search]);

  const visible = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setDialogOpen(true);
  };

  const openEdit = async (combo) => {
    setFormError('');
    setDialogOpen(true);
    // The list response carries no contents — only GET /products/:id does — so
    // the dialog opens on the row it has and fills the items in after.
    setForm({
      id: combo.id,
      name: combo.name || '',
      description: combo.description || '',
      isActive: (combo.status || 'Active') === 'Active',
      barcode: firstBarcode(combo),
      comboPrice: comboSellPrice(combo) ? String(comboSellPrice(combo)) : '',
      items: [],
    });
    try {
      const { product } = await productService.getProduct(combo.id);
      const rows = (product?.comboContents || []).map((row) => ({
        productId: row.productId,
        quantity: row.quantity ?? 1,
        price: 0,
        product: row.product,
      }));
      setForm((prev) => (prev.id === combo.id ? { ...prev, items: rows } : prev));
    } catch (err) {
      console.error('Error loading combo contents:', err);
      setFormError('Could not load this combo’s contents.');
    }
  };

  const addProduct = (product) => {
    if (!product) return;
    setForm((prev) => {
      if (prev.items.some((row) => row.productId === product.id)) return prev;
      return {
        ...prev,
        items: [...prev.items, { productId: product.id, quantity: 1, price: 0, product }],
      };
    });
  };

  const setItemField = (productId, field, value) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((row) =>
        row.productId === productId ? { ...row, [field]: value } : row
      ),
    }));
  };

  const removeItem = (productId) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((row) => row.productId !== productId),
    }));
  };

  const itemsTotal = form.items.reduce((sum, row) => sum + rowSubtotal(row), 0);
  const canSave = form.name.trim().length > 0 && form.items.length > 0;

  const save = async () => {
    if (!canSave) return;
    const code = form.barcode.trim();
    // Blank price means "charge the items total", so the items total is written
    // as the combo's own single-unit price rather than left at zero.
    const sellPrice = form.comboPrice === '' ? itemsTotal : Number(form.comboPrice) || 0;
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      type: COMBO_TYPE,
      status: form.isActive ? 'Active' : 'Inactive',
      // The reference recommends leaving inventory to the contents: tracking the
      // combo as well double-counts the same stock and corrupts a stocktake.
      trackInventory: false,
      barcodes: code ? [{ code, quantity: 1 }] : [],
      prices: [{ quantity: 1, price: sellPrice }],
      comboContents: form.items.map((row) => ({
        productId: row.productId,
        quantity: roundQty(row.quantity),
      })),
    };

    setSaving(true);
    setFormError('');
    try {
      if (form.id) {
        await productService.updateProduct(form.id, payload);
      } else {
        await productService.createProduct(payload);
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      console.error('Error saving product combo:', err);
      setFormError(err.response?.data?.error || 'Failed to save the product combo.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (combo) => {
    const ok = await confirm(
      `Delete the combo "${combo.name}"? The products inside it are not affected.`,
      { title: 'Delete product combo', confirmText: 'Delete' }
    );
    if (!ok) return;
    try {
      await productService.deleteProduct(combo.id);
      await load();
    } catch (err) {
      console.error('Error deleting product combo:', err);
      setError(err.response?.data?.error || 'Failed to delete that combo.');
    }
  };

  return (
    <Box sx={{ p: 2, bgcolor: '#f5f5f5', minHeight: '100%' }}>
      <Paper sx={{ p: 2.5, mb: 2, borderRadius: '8px', boxShadow: 'none', border: '1px solid #e0e0e0' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, mb: 2 }}>
          <Typography sx={{ fontSize: 32, fontWeight: 700, color: '#000' }}>
            Product Combos
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreate}
            sx={{
              bgcolor: SKY,
              '&:hover': { bgcolor: SKY_HOVER, boxShadow: 'none' },
              borderRadius: '24px',
              textTransform: 'none',
              boxShadow: 'none',
              fontWeight: 700,
              fontSize: 17,
              px: 3,
              height: 46,
            }}
          >
            Add Combo
          </Button>
        </Box>

        <TextField
          size="small"
          label="Search combos..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#808080' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            width: 340,
            '& .MuiOutlinedInput-root': { borderRadius: '12px', height: 56 },
          }}
        />
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Paper sx={{ borderRadius: '8px', boxShadow: 'none', border: '1px solid #e0e0e0', overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ '& th': headerCellSx }}>
                <TableCell sx={{ pl: '20px' }}>Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Items</TableCell>
                <TableCell>Total Price</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" sx={{ pr: '20px' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody sx={{ '& td': { border: 0, fontSize: 16, color: '#000', py: 2 } }}>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={22} sx={{ color: '#737373' }} />
                  </TableCell>
                </TableRow>
              ) : visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6, color: '#737373' }}>
                    No product combos found
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((combo) => (
                  <TableRow key={combo.id}>
                    <TableCell sx={{ pl: '20px' }}>{combo.name}</TableCell>
                    <TableCell>{combo.description || '-'}</TableCell>
                    <TableCell>{combo._count?.comboContents ?? 0} product(s)</TableCell>
                    <TableCell>{money(comboSellPrice(combo))}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={(combo.status || 'Active') === 'Active' ? 'Active' : 'Inactive'}
                        sx={{
                          bgcolor: (combo.status || 'Active') === 'Active' ? '#1b7a34' : '#9e9e9e',
                          color: '#fff',
                          fontWeight: 700,
                          borderRadius: '4px',
                        }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ pr: '20px', whiteSpace: 'nowrap' }}>
                      <Button
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => openEdit(combo)}
                        sx={{ color: '#2e7d32', textTransform: 'none', fontSize: 16 }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="small"
                        startIcon={<DeleteIcon />}
                        onClick={() => remove(combo)}
                        sx={{ color: '#d32f2f', textTransform: 'none', fontSize: 16, ml: 2 }}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={filtered.length}
          page={page}
          onPageChange={(e, next) => setPage(next)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Paper>

      <Dialog
        open={dialogOpen}
        onClose={() => !saving && setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '4px' } }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 24,
            fontWeight: 700,
            pb: 1,
          }}
        >
          {form.id ? 'Edit Product Combo' : 'Add Product Combo'}
          <IconButton onClick={() => setDialogOpen(false)} disabled={saving} aria-label="Close">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}

          <TextField
            fullWidth
            required
            label="Combo Name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            sx={{ mt: 1, mb: 2.5, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
          />
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Description"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
          />

          <TextField
            fullWidth
            label="Barcode"
            value={form.barcode}
            onChange={(e) => setForm((prev) => ({ ...prev, barcode: e.target.value }))}
            helperText="Optional. Scanning this code on the sell screen rings up the whole combo."
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <ShopfrontSwitch
              checked={form.isActive}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
            />
            <Typography sx={{ fontSize: 17 }}>Active</Typography>
          </Box>

          <Typography sx={{ fontSize: 22, fontWeight: 700, mb: 1.5 }}>Products</Typography>

          <Autocomplete
            options={productOptions}
            getOptionLabel={(option) => option?.name || ''}
            value={null}
            blurOnSelect
            onChange={(e, option) => addProduct(option)}
            renderInput={(params) => (
              <TextField {...params} placeholder="Search and add product" />
            )}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
          />

          {form.items.length > 0 && (
            <TableContainer sx={{ mb: 2, borderRadius: '8px', overflow: 'hidden' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { ...headerCellSx, height: 48, fontSize: 15 } }}>
                    <TableCell>Product</TableCell>
                    <TableCell>Quantity</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell align="right">Subtotal</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody
                  sx={{
                    '& tr:nth-of-type(even)': { bgcolor: '#f5f5f5' },
                    '& td': { border: 0, fontSize: 15, py: 1 },
                  }}
                >
                  {form.items.map((row) => (
                    <TableRow key={row.productId}>
                      <TableCell>{row.product?.name || `#${row.productId}`}</TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={row.quantity}
                          onChange={(e) => setItemField(row.productId, 'quantity', e.target.value)}
                          onBlur={(e) => setItemField(row.productId, 'quantity', roundQty(e.target.value))}
                          inputProps={{ min: '0', step: '0.01' }}
                          sx={{ width: 88, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                        />
                      </TableCell>
                      {/* The component's own sell price, shown so the combo can be
                          priced against what is in it. Not editable here: a combo
                          stores only what it SPENDS, and a price typed here would
                          vanish on the next load. */}
                      <TableCell align="right">{money(unitPriceOf(row))}</TableCell>
                      <TableCell align="right">{money(rowSubtotal(row))}</TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => removeItem(row.productId)}
                          aria-label={`remove ${row.product?.name || 'product'}`}
                          sx={{ color: '#e53935' }}
                        >
                          <RemoveIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              bgcolor: '#3fa9f5',
              color: '#fff',
              fontWeight: 700,
              fontSize: 20,
              px: 2.5,
              py: 2,
              borderRadius: '8px',
              mb: 2.5,
            }}
          >
            <span>Items Total:</span>
            <span>{money(itemsTotal)}</span>
          </Box>

          <TextField
            fullWidth
            type="number"
            label="Combo Price"
            value={form.comboPrice}
            onChange={(e) => setForm((prev) => ({ ...prev, comboPrice: e.target.value }))}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            helperText="Price charged when the full combo is sold. Leave blank to charge the items total."
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setDialogOpen(false)}
            disabled={saving}
            sx={{ textTransform: 'none', color: '#1976d2', fontSize: 16 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={save}
            disabled={saving || !canSave}
            sx={{
              bgcolor: SKY,
              '&:hover': { bgcolor: SKY_HOVER, boxShadow: 'none' },
              textTransform: 'none',
              boxShadow: 'none',
              fontWeight: 700,
              fontSize: 16,
              borderRadius: '4px',
              px: 4,
            }}
          >
            {saving ? 'Saving...' : form.id ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProductCombos;
