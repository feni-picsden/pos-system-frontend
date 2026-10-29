import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  Radio,
  Alert,
} from '@mui/material';
import {
  CheckCircleOutline as FoundIcon,
  HelpOutline as HelpIcon,
  Cancel as ClearIcon,
  ContentCopyOutlined as DuplicateIcon,
} from '@mui/icons-material';
import PageLoader from '../../components/Common/PageLoader';
import stocktakeService from '../../services/stocktakeService';
import productService from '../../services/productService';

// Reference "Product Matching" screen (External Stocktake > View):
//   header strip  Outlet · "Other stock will be zeroed / ignored" · "Override / Add Stock Levels" · Total Cost
//   search        live filter on name or barcode
//   table         Status (Found) · Name · Barcode Quantity · Barcode (orange DUPLICATE) · Quantity · Unit Cost · Total Cost
//   footer        Cancel (left) · Export · Complete (right)
// Unmatched rows are highlighted green; clicking one associates it with an
// existing product or creates a new one. A DUPLICATE row picks which product.

const money = (n) => {
  const v = Number(n) || 0;
  const [whole, cents] = Math.abs(v).toFixed(2).split('.');
  return { sign: v < 0 ? '-' : '', whole: Number(whole).toLocaleString('en-AU'), cents };
};
const Money = ({ value, bigCents = false }) => {
  const m = money(value);
  return bigCents ? (
    <>{m.sign}${m.whole}.{m.cents}</>
  ) : (
    <>{m.sign}${m.whole}<Box component="span" sx={{ fontSize: '0.7em' }}>.{m.cents}</Box></>
  );
};

const footerBtn = {
  height: 50,
  px: 1.5,
  borderRadius: 0,
  fontSize: 28,
  fontWeight: 400,
  lineHeight: 1,
  textTransform: 'none',
  boxShadow: 'none',
};
const cancelBtnSx = { ...footerBtn, bgcolor: '#f8f8f8', color: '#676b72', border: '1px solid #676b72', '&:hover': { bgcolor: '#e8e8e8', boxShadow: 'none' } };
const blueBtnSx = { ...footerBtn, bgcolor: '#5ebbeb', color: '#fff', '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' }, '&.Mui-disabled': { bgcolor: '#bfe3f5', color: '#fff' } };

const dlgBtn = { height: 42, borderRadius: '12px', fontSize: 16, fontWeight: 700, textTransform: 'none', boxShadow: 'none', px: 2.5 };
const dlgCancel = { ...dlgBtn, bgcolor: '#dddddd', color: '#000', '&:hover': { bgcolor: '#d0d0d0' } };
const dlgPrimary = { ...dlgBtn, bgcolor: '#5ebbeb', color: '#fff', '&:hover': { bgcolor: '#4aa9dd' }, '&.Mui-disabled': { bgcolor: '#ebebeb', color: '#8e8e8e' } };
const dlgHeader = { bgcolor: '#c9e8f8', color: '#1a5f86', fontSize: 18, fontWeight: 600, p: 2, display: 'flex', alignItems: 'center', gap: 1 };

const headCell = { fontSize: 16, fontWeight: 700, color: '#000', border: 'none', py: 1.5, px: 1, bgcolor: '#fff', whiteSpace: 'nowrap' };
const bodyCell = { fontSize: 16, color: '#000', border: 'none', py: 0, px: 1, height: 52 };

const productLabel = (p) => p?.name || '';

// Associate / create dialog for a green (unmatched) row
function UnmatchedDialog({ row, onClose, onAssociate, onCreate, busy }) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [searching, setSearching] = useState(false);
  const [name, setName] = useState(row?.providedName || '');

  useEffect(() => { setName(row?.providedName || ''); setSelected(null); setQuery(''); }, [row]);

  useEffect(() => {
    if (!row || query.trim().length < 2) { setOptions([]); return undefined; }
    let alive = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await productService.getProducts({ search: query.trim(), limit: 20 });
        const list = res?.products || res?.data || (Array.isArray(res) ? res : []);
        if (alive) setOptions(list);
      } catch (e) {
        if (alive) setOptions([]);
      } finally {
        if (alive) setSearching(false);
      }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [query, row]);

  return (
    <Dialog open={Boolean(row)} onClose={busy ? undefined : onClose} PaperProps={{ sx: { width: 520, maxWidth: '100%', borderRadius: '8px', boxShadow: 'none' } }}>
      <DialogTitle sx={dlgHeader}><HelpIcon sx={{ fontSize: 20 }} />Unmatched Product</DialogTitle>
      <DialogContent sx={{ p: 2 }}>
        <Typography sx={{ fontSize: 14, color: '#676b72', mt: 1 }}>
          Barcode <b>{row?.barcode}</b> was not found on any product. Associate it with an existing product or create a new product.
        </Typography>
        <Typography sx={{ fontSize: 14, color: '#676b72', mt: 2, mb: 1 }}>Associate with existing product</Typography>
        <Autocomplete
          options={options}
          loading={searching}
          value={selected}
          onChange={(_e, v) => setSelected(v)}
          inputValue={query}
          onInputChange={(_e, v) => setQuery(v)}
          getOptionLabel={productLabel}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          filterOptions={(x) => x}
          noOptionsText={query.trim().length < 2 ? 'Type to search for a product' : 'No products found'}
          renderInput={(params) => <TextField {...params} placeholder="Search for product name or barcode..." size="small" />}
        />
        <Typography sx={{ fontSize: 14, color: '#676b72', mt: 2.5, mb: 1 }}>Or create a new product</Typography>
        <TextField fullWidth size="small" placeholder="New product name" value={name} onChange={(e) => setName(e.target.value)} />
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={busy} sx={dlgCancel}>Cancel</Button>
        <Button onClick={() => onCreate(name)} disabled={busy || !name.trim()} sx={dlgPrimary}>Create Product</Button>
        <Button onClick={() => onAssociate(selected)} disabled={busy || !selected} sx={dlgPrimary}>Associate</Button>
      </DialogActions>
    </Dialog>
  );
}

// Which product to use for a DUPLICATE barcode
function DuplicateDialog({ row, onClose, onPick, busy }) {
  // Index into candidates: the same product can carry one barcode twice with
  // different quantities, so productId alone cannot tell the options apart.
  const [choice, setChoice] = useState(null);
  useEffect(() => {
    const i = (row?.candidates || []).findIndex((c) => c.productId === row?.productId && c.barcodeQuantity === row?.barcodeQuantity);
    setChoice(i >= 0 ? i : null);
  }, [row]);
  return (
    <Dialog open={Boolean(row)} onClose={busy ? undefined : onClose} PaperProps={{ sx: { width: 520, maxWidth: '100%', borderRadius: '8px', boxShadow: 'none' } }}>
      <DialogTitle sx={dlgHeader}><HelpIcon sx={{ fontSize: 20 }} />Duplicate Barcode</DialogTitle>
      <DialogContent sx={{ p: 2 }}>
        <Typography sx={{ fontSize: 14, color: '#676b72', mt: 1, mb: 1 }}>
          Barcode <b>{row?.barcode}</b> is on more than one product. Select which product to use.
        </Typography>
        {(row?.candidates || []).map((c, i) => (
          <Box key={`${c.productId}-${c.barcodeQuantity}-${i}`} onClick={() => setChoice(i)} sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', py: 0.5 }}>
            <Radio size="small" checked={choice === i} sx={{ p: 0.5, color: '#5ebbeb', '&.Mui-checked': { color: '#5ebbeb' } }} />
            <Typography sx={{ fontSize: 16 }}>{c.name}</Typography>
            <Typography sx={{ fontSize: 14, color: '#676b72', ml: 'auto' }}>barcode qty {c.barcodeQuantity}</Typography>
          </Box>
        ))}
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={busy} sx={dlgCancel}>Cancel</Button>
        <Button onClick={() => onPick((row?.candidates || [])[choice])} disabled={busy || choice == null} sx={dlgPrimary}>Select</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function ExternalStocktakeMatch() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [head, setHead] = useState(null);
  const [rows, setRows] = useState([]);
  const [totalCost, setTotalCost] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filtering, setFiltering] = useState(false);
  const [debounced, setDebounced] = useState('');
  const [unmatched, setUnmatched] = useState(null);
  const [dup, setDup] = useState(null);
  const [busy, setBusy] = useState(false);
  const [completing, setCompleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await stocktakeService.getExternalStocktake(id);
      setHead(res.externalStocktake);
      setRows(res.rows || []);
      setTotalCost(res.totalCost || 0);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load external stocktake');
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // A completed external stocktake lives on the Apply screen.
  useEffect(() => {
    if (head?.status === 'Completed' && head.stocktakeId) navigate(`/stock-management/stocktakes/${head.stocktakeId}`, { replace: true });
  }, [head, navigate]);

  useEffect(() => {
    setFiltering(true);
    const t = setTimeout(() => { setDebounced(search.trim().toLowerCase()); setFiltering(false); }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const visible = useMemo(() => {
    if (!debounced) return rows;
    return rows.filter((r) =>
      (r.productName || '').toLowerCase().includes(debounced)
      || (r.providedName || '').toLowerCase().includes(debounced)
      || String(r.barcode).toLowerCase().includes(debounced));
  }, [rows, debounced]);

  const applyUpdate = async (rowId, body) => {
    setBusy(true);
    try {
      const res = await stocktakeService.updateExternalStocktakeRow(id, rowId, body);
      setRows(res.rows || []);
      setTotalCost(res.totalCost || 0);
      setUnmatched(null);
      setDup(null);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to update row');
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await stocktakeService.downloadExternalStocktake(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `external_stocktake_${id}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError('Failed to export');
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const res = await stocktakeService.completeExternalStocktake(id);
      // Reference lands on the Apply screen with the "Apply Stocktake" popup open.
      navigate(`/stock-management/stocktakes/${res.stocktakeId}?apply=1&applyToAll=${head.zeroStockNotCounted ? 1 : 0}`);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to complete');
      setCompleting(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!head) return <Box sx={{ p: 3 }}><Alert severity="error">{error || 'Not found'}</Alert></Box>;

  const editable = head.status === 'Imported';

  return (
    <Box sx={{ p: 1, minHeight: '100%', bgcolor: '#f0f0f0' }}>
      {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError('')}>{error}</Alert>}

      {/* header strip */}
      <Box sx={{ bgcolor: '#f8f8f8', border: '1px solid #d0d0d0', px: 1, pt: 1.5, pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-around', alignItems: 'baseline', fontSize: 16, mb: 1.5 }}>
          <Box><b>Outlet</b>&nbsp;&nbsp;{head.outlet?.name}</Box>
          <Box><b>{head.zeroStockNotCounted ? 'Other stock will be zeroed' : 'Other stock will be ignored'}</b></Box>
          <Box><b>{head.inventoryMethod === 'add' ? 'Add Stock Levels' : 'Override Stock Levels'}</b></Box>
          <Box><b>Total Cost</b>&nbsp;&nbsp;<Money value={totalCost} /></Box>
        </Box>
        <TextField
          fullWidth
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search for product name or barcode..."
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                {filtering && <CircularProgress size={16} sx={{ color: '#9a9a9a', mr: 1 }} />}
                {search && (
                  <IconButton size="small" onClick={() => setSearch('')}><ClearIcon sx={{ color: '#404040' }} /></IconButton>
                )}
              </InputAdornment>
            ),
          }}
          sx={{
            bgcolor: '#fff',
            '& .MuiOutlinedInput-root': { height: 52, fontSize: 16, borderRadius: '4px', '& fieldset': { borderColor: '#000', borderWidth: 2 }, '&:hover fieldset': { borderColor: '#000' }, '&.Mui-focused fieldset': { borderColor: '#000', borderWidth: 2 } },
          }}
        />
      </Box>

      {/* table */}
      <Box sx={{ bgcolor: '#fff', mt: 1 }}>
        <Table sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow sx={{ '& th': { borderBottom: '2px solid #e0e0e0' } }}>
              <TableCell sx={{ ...headCell, width: 130 }}>Status</TableCell>
              <TableCell sx={headCell}>Name</TableCell>
              <TableCell sx={{ ...headCell, width: 170 }} align="center">Barcode Quantity</TableCell>
              <TableCell sx={{ ...headCell, width: '26%' }}>Barcode</TableCell>
              <TableCell sx={{ ...headCell, width: 110 }} align="right">Quantity</TableCell>
              <TableCell sx={{ ...headCell, width: 110 }} align="right">Unit Cost</TableCell>
              <TableCell sx={{ ...headCell, width: 120 }} align="right">Total Cost</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow><TableCell colSpan={7} sx={{ ...bodyCell, textAlign: 'center', color: '#676b72', py: 3 }}>No products match your search</TableCell></TableRow>
            ) : visible.map((r, i) => {
              const clickable = editable && (!r.matched || r.duplicate);
              return (
                <TableRow
                  key={r.id}
                  onClick={() => { if (!clickable) return; if (!r.matched) setUnmatched(r); else setDup(r); }}
                  sx={{
                    bgcolor: !r.matched ? '#d9f2d9' : i % 2 === 1 ? '#e5e5e5' : '#fff',
                    cursor: clickable ? 'pointer' : 'default',
                    '&:hover': clickable ? { filter: 'brightness(0.97)' } : {},
                  }}
                >
                  <TableCell sx={{ ...bodyCell, whiteSpace: 'nowrap' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      {r.matched ? <FoundIcon sx={{ fontSize: 18 }} /> : <HelpIcon sx={{ fontSize: 18, color: '#2e7d32' }} />}
                      {r.matched ? 'Found' : 'Not Found'}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.productName || r.providedName || <i style={{ color: '#676b72' }}>Unknown product</i>}
                  </TableCell>
                  <TableCell sx={bodyCell} align="center">{r.barcodeQuantity}</TableCell>
                  <TableCell sx={{ ...bodyCell, whiteSpace: 'nowrap' }}>
                    {r.barcode}
                    {r.duplicate && (
                      <Box component="span" sx={{ ml: 2, color: '#f28c28', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 0.5, verticalAlign: 'middle' }}>
                        <DuplicateIcon sx={{ fontSize: 16 }} /> - DUPLICATE
                      </Box>
                    )}
                  </TableCell>
                  <TableCell sx={bodyCell} align="right">{r.quantity}</TableCell>
                  <TableCell sx={bodyCell} align="right"><Money value={r.unitCost} bigCents /></TableCell>
                  <TableCell sx={bodyCell} align="right"><Money value={r.totalCost} bigCents /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>

      {/* footer */}
      <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
        <Button onClick={() => navigate('/stock-management/external-stocktake')} sx={cancelBtnSx}>Cancel</Button>
        <Button onClick={handleExport} sx={{ ...blueBtnSx, ml: 'auto', mr: editable ? 'auto' : 0 }}>Export</Button>
        {editable && (
          <Button onClick={handleComplete} disabled={completing || busy} sx={blueBtnSx}>
            {completing ? 'Completing…' : 'Complete'}
          </Button>
        )}
      </Box>

      <UnmatchedDialog
        row={unmatched}
        busy={busy}
        onClose={() => setUnmatched(null)}
        onAssociate={(p) => p && applyUpdate(unmatched.id, { productId: p.id })}
        onCreate={(name) => applyUpdate(unmatched.id, { createProduct: true, name })}
      />
      <DuplicateDialog
        row={dup}
        busy={busy}
        onClose={() => setDup(null)}
        onPick={(c) => c && applyUpdate(dup.id, { productId: c.productId, barcodeQuantity: c.barcodeQuantity, addBarcode: false })}
      />
    </Box>
  );
}
