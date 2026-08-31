import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
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
  TextField,
  Link,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { priceSetService } from '../../services/priceSetService';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';
import { useHasPermission } from '../../hooks/usePermissions';

// Settings > Price Sets — named alternative price schedules (reference parity,
// Shopfront help art. 360000040771). Every product's normal prices are its
// "Default Price Set"; sets defined here hold the alternative price groups,
// assigned per price point on the product edit screen.

const INSTANT = 'all 0s ease';

const PILL_BUTTON_SX = {
  color: '#fff',
  textTransform: 'none',
  boxShadow: 'none',
  borderRadius: '12px',
  fontWeight: 700,
  fontSize: 16,
  height: 42,
  px: 3,
  transition: INSTANT,
  backgroundColor: '#22c55e',
  '&:hover': { backgroundColor: '#4ade80', boxShadow: 'none' },
};

const PriceSets = () => {
  const { alert, confirm, notify } = useAppDialogs();
  const canEdit = useHasPermission('settings.edit');
  const navigate = useNavigate();

  const [priceSets, setPriceSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  // Deletion-guard view: the products still holding prices in a set.
  const [productsView, setProductsView] = useState(null); // {priceSet, products}

  const loadPriceSets = async () => {
    try {
      setLoading(true);
      const { priceSets: list } = await priceSetService.getPriceSets();
      setPriceSets(list || []);
      setError('');
    } catch (e) {
      console.error('Error loading price sets:', e);
      setError('Failed to load price sets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPriceSets(); }, []);

  const openNew = () => { setEditing(null); setName(''); setDialogOpen(true); };
  const openEdit = (ps) => { setEditing(ps); setName(ps.name); setDialogOpen(true); };

  const handleSave = async () => {
    try {
      setSaving(true);
      if (editing) {
        await priceSetService.updatePriceSet(editing.id, { name });
        notify('Price set renamed');
      } else {
        await priceSetService.createPriceSet({ name });
        notify('Price set created');
      }
      setDialogOpen(false);
      await loadPriceSets();
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to save the price set', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openProducts = async (ps) => {
    try {
      const data = await priceSetService.getPriceSetProducts(ps.id);
      setProductsView(data);
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to load the products in this price set', 'error');
    }
  };

  const handleDelete = async (ps) => {
    if (ps.priceCount > 0) {
      // Reference guard: the set must be emptied first — show what still uses it.
      await openProducts(ps);
      return;
    }
    const ok = await confirm(`Delete the price set "${ps.name}"?`, {
      title: 'Delete price set',
      confirmText: 'Delete',
      severity: 'warning',
    });
    if (!ok) return;
    try {
      await priceSetService.deletePriceSet(ps.id);
      notify('Price set deleted');
      await loadPriceSets();
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to delete the price set', 'error');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: '#000' }}>
          Price Sets
        </Typography>
        {canEdit && (
          <Button variant="contained" disableElevation disableRipple startIcon={<AddIcon />} onClick={openNew} sx={PILL_BUTTON_SX}>
            New
          </Button>
        )}
      </Box>

      <Typography sx={{ color: '#676b72', fontSize: 14, mb: 2 }}>
        Alternative price schedules. Every product's normal prices are its Default Price Set;
        assign a set to individual price points on the product edit screen, and pick a default
        set per register under Settings &gt; General.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
      ) : (
        <TableContainer>
          <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <TableHead>
              <TableRow
                sx={{
                  '& th': { bgcolor: '#5ebbeb', color: '#fff', fontWeight: 700, fontSize: 16, border: 0, height: 51, py: 0 },
                  '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px', pl: '20px' },
                  '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px', pr: '20px' },
                }}
              >
                <TableCell>Name</TableCell>
                <TableCell>Prices</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody sx={{ '& td': { fontSize: 15, color: '#313439' } }}>
              {priceSets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={{ py: 4, border: 0 }}>
                    <Typography variant="body1" color="text.secondary">
                      No price sets yet. {canEdit && 'Click "New" to create your first one.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                priceSets.map((ps) => (
                  <TableRow key={ps.id} sx={{ '&:hover': { bgcolor: 'rgb(240,240,240)' }, transition: INSTANT }}>
                    <TableCell sx={{ fontWeight: 600 }}>{ps.name}</TableCell>
                    <TableCell>{ps.priceCount}</TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                        <Button disableRipple size="small" startIcon={<ViewIcon />} onClick={() => openProducts(ps)}
                          sx={{ color: '#0084d1', textTransform: 'none', fontWeight: 600 }}>
                          View
                        </Button>
                        {canEdit && (
                          <>
                            <Button disableRipple size="small" startIcon={<EditIcon />} onClick={() => openEdit(ps)}
                              sx={{ color: '#0084d1', textTransform: 'none', fontWeight: 600 }}>
                              Edit
                            </Button>
                            <Button disableRipple size="small" startIcon={<DeleteIcon />} onClick={() => handleDelete(ps)}
                              sx={{ color: '#e33430', textTransform: 'none', fontWeight: 600 }}>
                              Delete
                            </Button>
                          </>
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

      {/* Create / rename */}
      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{editing ? 'Rename Price Set' : 'New Price Set'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth margin="normal" label="Name" required
            value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) handleSave(); }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1.25 }}>
          <Button disableRipple onClick={() => setDialogOpen(false)} disabled={saving} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button variant="contained" disableElevation disableRipple onClick={handleSave}
            disabled={saving || !name.trim()} sx={PILL_BUTTON_SX}>
            {saving ? 'Saving…' : editing ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Products still in the set — the reference's pre-deletion view */}
      <Dialog open={Boolean(productsView)} onClose={() => setProductsView(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Products using "{productsView?.priceSet?.name}"
        </DialogTitle>
        <DialogContent>
          {(productsView?.products || []).length === 0 ? (
            <Typography sx={{ color: '#676b72' }}>
              No products carry prices in this set — it can be deleted.
            </Typography>
          ) : (
            <>
              <Typography sx={{ color: '#676b72', fontSize: 14, mb: 1.5 }}>
                A price set can only be deleted once no product prices reference it. Edit each
                product below and remove its price points from this set.
              </Typography>
              {(productsView.products || []).map((p) => (
                <Box key={p.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: '1px solid #eee' }}>
                  <Link component="button" underline="hover" sx={{ fontSize: 15, textAlign: 'left' }}
                    onClick={() => navigate(`/products/${p.id}/edit`)}>
                    {p.name}
                  </Link>
                  <Typography sx={{ fontSize: 13, color: '#676b72' }}>
                    {p.prices.map((pr) => `${pr.quantity} @ $${Number(pr.price).toFixed(2)}`).join(', ')}
                  </Typography>
                </Box>
              ))}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button disableRipple onClick={() => setProductsView(null)} sx={{ textTransform: 'none' }}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PriceSets;
