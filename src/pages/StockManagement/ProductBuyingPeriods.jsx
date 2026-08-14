import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  Typography,
  Button,
  Dialog,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  CircularProgress,
  Alert,
  Snackbar,
  Autocomplete,
  FormControlLabel,
} from '@mui/material';
import {
  DeleteOutline as DeleteIcon,
  EditOutlined as EditIcon,
  SentimentNeutralOutlined as NeutralIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import buyingPeriodService from '../../services/buyingPeriodService';
import supplierService from '../../services/supplierService';
import productService from '../../services/productService';
import classificationService from '../../services/classificationService';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import DateRangePicker from '../../components/Common/DateRangePicker';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';

// Parity system: primary button (#5ebbeb, radius 12, h42, fs16/700, no shadow, 200ms)
const primaryBtnSx = {
  bgcolor: '#5ebbeb',
  color: '#f8f8f8',
  borderRadius: '12px',
  height: 42,
  fontSize: 16,
  fontWeight: 700,
  textTransform: 'none',
  boxShadow: 'none',
  px: 4,
  transition: 'background 0.2s ease, color 0.2s ease',
  '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' },
};

// Parity system: outlined inputs
const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    fontSize: 16,
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
  },
  '& input::placeholder': { color: '#808080', opacity: 1 },
};

const emptyForm = {
  item: null,
  supplier: null,
  startDate: null,
  endDate: null,
  minQuantity: '1',
  costAmount: '',
  costIncludesTax: true,
};

export default function ProductBuyingPeriods() {
  const { selectedOutletId, isAllOutlets, isSuperAdmin } = useSelectedOutlet();
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [families, setFamilies] = useState([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [snack, setSnack] = useState({ open: false, severity: 'success', message: '' });

  const [form, setForm] = useState(emptyForm);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [periodRes, supRes, famRes] = await Promise.all([
        buyingPeriodService.list(),
        supplierService.getSuppliers(),
        classificationService.getClassifications({ type: 'family' }),
      ]);

      setPeriods(periodRes.periods || []);
      setSuppliers(supRes.suppliers || supRes || []);
      setFamilies(famRes.classifications || famRes || []);
    } catch (e) {
      setSnack({ open: true, severity: 'error', message: e?.response?.data?.error || 'Failed to load buying periods' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const searchProducts = async (search) => {
    try {
      // skipOutletScope: item search must return products from ALL outlets and
      // global products (matches reference), not just the selected outlet.
      const res = await productService.getProducts(
        { search, limit: 25, includeAllStatuses: true },
        { skipOutletScope: true }
      );
      // backend shape varies; attempt common patterns
      const list = res.products || res?.data?.products || res?.items || res || [];
      setProducts(Array.isArray(list) ? list : []);
    } catch {
      // non-fatal
    }
  };

  // Reference: ONE grouped combobox — "Families" first, "Products" once you type.
  const itemOptions = [
    ...(families || []).map((f) => ({ id: f.id, name: f.name, kind: 'family' })),
    ...(products || []).map((p) => ({ id: p.id, name: p.name, kind: 'product' })),
  ];

  const closeDialog = () => {
    setDialogOpen(false);
    setEditTarget(null);
    setForm(emptyForm);
  };

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (p) => {
    setEditTarget(p);
    setForm({
      item: p.product
        ? { id: p.product.id, name: p.product.name, kind: 'product' }
        : p.family
        ? { id: p.family.id, name: p.family.name, kind: 'family' }
        : null,
      supplier: p.supplier ? { id: p.supplier.id, name: p.supplier.name } : null,
      startDate: p.startDate ? new Date(p.startDate) : null,
      endDate: p.endDate ? new Date(p.endDate) : null,
      minQuantity: String(p.minQuantity ?? '1'),
      costAmount: String(p.costAmount ?? ''),
      costIncludesTax: p.costIncludesTax !== false,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.item) {
      setSnack({ open: true, severity: 'error', message: 'Select an item' });
      return;
    }
    if (!form.supplier) {
      setSnack({ open: true, severity: 'error', message: 'Supplier is required' });
      return;
    }
    if (!form.startDate || !form.endDate) {
      setSnack({ open: true, severity: 'error', message: 'Period is required' });
      return;
    }
    if (!form.minQuantity || Number(form.minQuantity) <= 0) {
      setSnack({ open: true, severity: 'error', message: 'Quantity must be greater than 0' });
      return;
    }
    if (!form.costAmount || Number(form.costAmount) <= 0) {
      setSnack({ open: true, severity: 'error', message: 'Cost must be greater than 0' });
      return;
    }

    setSaving(true);
    try {
      if (editTarget) {
        // Backend update writes supplier/dates/quantity/cost/tax only (not item).
        await buyingPeriodService.update(editTarget.id, {
          supplierId: Number(form.supplier.id),
          startDate: format(form.startDate, 'yyyy-MM-dd'),
          endDate: format(form.endDate, 'yyyy-MM-dd'),
          minQuantity: Number(form.minQuantity),
          costAmount: Number(form.costAmount),
          costIncludesTax: form.costIncludesTax,
        });
        setSnack({ open: true, severity: 'success', message: 'Buying period updated' });
      } else {
        await buyingPeriodService.create({
          supplierId: Number(form.supplier.id),
          productId: form.item.kind === 'product' ? Number(form.item.id) : null,
          familyId: form.item.kind === 'family' ? Number(form.item.id) : null,
          startDate: format(form.startDate, 'yyyy-MM-dd'),
          endDate: format(form.endDate, 'yyyy-MM-dd'),
          minQuantity: Number(form.minQuantity),
          costAmount: Number(form.costAmount),
          costIncludesTax: form.costIncludesTax,
          ...(isSuperAdmin && !isAllOutlets && selectedOutletId ? { outletId: selectedOutletId } : {}),
        });
        setSnack({ open: true, severity: 'success', message: 'Buying period created' });
      }
      closeDialog();
      await loadAll();
    } catch (e) {
      setSnack({ open: true, severity: 'error', message: e?.response?.data?.error || 'Failed to save buying period' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await buyingPeriodService.remove(deleteTarget.id);
      setSnack({ open: true, severity: 'success', message: 'Buying period deleted' });
      setDeleteTarget(null);
      await loadAll();
    } catch (e) {
      setSnack({ open: true, severity: 'error', message: e?.response?.data?.error || 'Failed to delete' });
    } finally {
      setDeleting(false);
    }
  };

  const displayName = (p) => p?.product?.name || p?.family?.name || '-';
  const fmt = (d) => (d ? format(new Date(d), 'dd/MM/yyyy') : '-');

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight={600}>
          Product Buying Periods
        </Typography>
        {periods.length > 0 && (
          <Button variant="contained" disableElevation onClick={openCreate} sx={primaryBtnSx}>
            Create Buying Period
          </Button>
        )}
      </Box>

      {loading ? (
        <Box sx={{ p: 6, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : periods.length === 0 ? (
        // Reference empty state: neutral face + message + centered Create button
        <Box sx={{ py: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <NeutralIcon sx={{ fontSize: 64, color: '#676b72' }} />
          <Typography sx={{ fontSize: 22, fontWeight: 700, color: '#313439' }}>No Buying Periods</Typography>
          <Typography sx={{ fontSize: 16, color: '#676b72' }}>
            There are currently no buying periods defined.
          </Typography>
          <Button variant="contained" disableElevation onClick={openCreate} sx={primaryBtnSx}>
            Create Buying Period
          </Button>
        </Box>
      ) : (
        <Card sx={{ borderRadius: 0, boxShadow: 'none' }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow
                  sx={{
                    '& th': { bgcolor: '#5ebbeb', color: '#f8f8f8', fontWeight: 700, fontSize: 16, border: 0, height: 51, py: 0 },
                    '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px', pl: '20px' },
                    '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px', pr: '20px' },
                  }}
                >
                  <TableCell>Item</TableCell>
                  <TableCell>Supplier</TableCell>
                  <TableCell>Period</TableCell>
                  <TableCell align="right">Quantity</TableCell>
                  <TableCell align="right">Cost (per quantity)</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody
                sx={{
                  '& tr:nth-of-type(odd)': { bgcolor: '#ffffff' },
                  '& tr:nth-of-type(even)': { bgcolor: '#f8f8f8' },
                  '& td': { border: 0, fontSize: 16, color: '#000', py: 1.5 },
                }}
              >
                {periods.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell sx={{ pl: '20px' }}>{displayName(p)}</TableCell>
                    <TableCell>{p.supplier?.name || '-'}</TableCell>
                    <TableCell>
                      {fmt(p.startDate)} - {fmt(p.endDate)}
                    </TableCell>
                    <TableCell align="right">{p.minQuantity}</TableCell>
                    <TableCell align="right">${Number(p.costAmount || 0).toFixed(2)}</TableCell>
                    <TableCell align="right" sx={{ pr: '20px' }}>
                      <IconButton onClick={() => openEdit(p)} sx={{ color: '#5ebbeb' }}>
                        <EditIcon />
                      </IconButton>
                      <IconButton onClick={() => setDeleteTarget(p)} sx={{ color: '#e33430' }}>
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        PaperProps={{
          sx: {
            width: 478,
            maxWidth: '94vw',
            borderRadius: 0,
            boxShadow: '0 0 30px rgba(0,0,0,0.25)',
            overflow: 'visible',
            mt: '32px',
          },
        }}
      >
        {/* Reference: dark circular avatar with a white pencil, overlapping the top edge */}
        <Box
          sx={{
            position: 'absolute',
            top: -32,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 64,
            height: 64,
            borderRadius: '50%',
            bgcolor: '#404040',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <EditIcon sx={{ color: '#f8f8f8', fontSize: 30 }} />
        </Box>

        <Typography sx={{ mt: '44px', textAlign: 'center', fontSize: 17, fontWeight: 700, color: '#313439' }}>
          {editTarget ? 'Edit Buying Period' : 'Create Buying Period'}
        </Typography>

        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'grid', gap: 2.5 }}>
            <Autocomplete
              options={itemOptions}
              groupBy={(o) => (o.kind === 'family' ? 'Families' : 'Products')}
              value={form.item}
              disabled={Boolean(editTarget)}
              onChange={(_, v) => setForm((f) => ({ ...f, item: v }))}
              onInputChange={(_, value) => {
                if ((value || '').length >= 2) searchProducts(value);
              }}
              getOptionLabel={(o) => o?.name || ''}
              isOptionEqualToValue={(o, v) => o.kind === v.kind && o.id === v.id}
              renderInput={(params) => <TextField {...params} label="Item" sx={inputSx} />}
              slotProps={{
                paper: {
                  sx: { '& .MuiAutocomplete-groupLabel': { fontWeight: 700, color: '#313439', fontSize: 15 } },
                },
              }}
            />

            <Autocomplete
              options={suppliers || []}
              value={form.supplier}
              onChange={(_, v) => setForm((f) => ({ ...f, supplier: v }))}
              getOptionLabel={(o) => o?.name || ''}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              renderInput={(params) => <TextField {...params} label="Supplier" sx={inputSx} />}
            />

            <DateRangePicker
              label="Period"
              size="medium"
              allowEmpty
              value={{ startDate: form.startDate, endDate: form.endDate }}
              onChange={({ startDate, endDate }) => setForm((f) => ({ ...f, startDate, endDate }))}
              inputSx={inputSx}
            />

            <TextField
              label="Quantity"
              type="number"
              value={form.minQuantity}
              onChange={(e) => setForm((f) => ({ ...f, minQuantity: e.target.value }))}
              sx={inputSx}
            />

            <TextField
              placeholder="Cost (per quantity)"
              type="number"
              value={form.costAmount}
              onChange={(e) => setForm((f) => ({ ...f, costAmount: e.target.value }))}
              InputProps={{ startAdornment: <span style={{ marginRight: 6 }}>$</span> }}
              sx={inputSx}
            />

            <FormControlLabel
              control={
                <ShopfrontSwitch
                  checked={form.costIncludesTax}
                  onChange={(e) => setForm((f) => ({ ...f, costIncludesTax: e.target.checked }))}
                />
              }
              label="Inclusive of Tax"
              sx={{ ml: 0, gap: 1.5, '& .MuiFormControlLabel-label': { fontSize: 16, color: '#313439' } }}
            />
          </Box>
        </DialogContent>

        {/* Reference: two large side-by-side buttons filling the dialog width */}
        <DialogActions sx={{ p: 0, gap: 0 }}>
          <Button
            onClick={closeDialog}
            disabled={saving}
            disableElevation
            sx={{
              flex: 1,
              m: 0,
              height: 48,
              borderRadius: 0,
              bgcolor: '#e5e7eb',
              color: '#000',
              fontSize: 16,
              textTransform: 'none',
              transition: 'background 0.2s ease, color 0.2s ease',
              '&:hover': { bgcolor: '#e5e7eb' },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            disableElevation
            sx={{
              flex: 1,
              m: 0,
              height: 48,
              borderRadius: 0,
              bgcolor: '#5ebbeb',
              color: '#f8f8f8',
              fontSize: 16,
              textTransform: 'none',
              boxShadow: 'none',
              transition: 'background 0.2s ease, color 0.2s ease',
              '&:hover': { bgcolor: '#5ebbeb', boxShadow: 'none' },
            }}
          >
            {saving ? (
              <CircularProgress size={22} sx={{ color: '#f8f8f8' }} />
            ) : editTarget ? (
              'Save Buying Period'
            ) : (
              'Create Buying Period'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        title="Delete Buying Period"
        message={`Delete the buying period for "${displayName(deleteTarget)}"?`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}
