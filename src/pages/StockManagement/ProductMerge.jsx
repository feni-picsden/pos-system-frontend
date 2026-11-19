import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  InputBase,
  Select,
  MenuItem,
  Autocomplete,
  TextField,
  Checkbox,
  Chip,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  DeleteOutline as DeleteOutlineIcon,
  CheckCircleOutline as TickIcon,
  Close as CloseIcon,
  Add as AddIcon,
  CheckBoxOutlineBlank as UncheckedIcon,
  CheckBox as CheckedIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import productService from '../../services/productService';
import { taxRateService } from '../../services/taxRateService';
import { stripHtml } from '../../services/posLocalDb';
import { useAuth } from '../../contexts/AuthContext';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import { byMode } from '../../theme/sfPalette';
import { useTheme } from '@mui/material/styles';

// Reference (Stock Management > Products > Functions > Merge Products, help-centre
// article 16344728041869, screenshots 16/11/2026): "Product Merge" page. A grey
// "Results" column on the left holds the new product, one grey column per added
// product beside it, then a dashed "+ Click to add a new product to merge" card.
// Every column is split into the same sections; a product section's "Select
// Section" copies that section into Results (the chosen section turns blue with
// a dark button and ticks on its fields; Results' own section goes white). Results
// fields can also be typed; "Clear" empties a picked value. "Complete Merge" at
// the bottom asks to confirm, then the sources go to Trashed Items and their
// sales / purchase history moves to the new product (backend POST /products/merge).

const BLUE = '#b3e5fc';
const GREY = '#d9d9d9';
const DARK = '#313439';
const NO_VALUE = 'No Value';
// Dark-mode counterparts (reference dark screenshots): blue section #0b4f80, columns /
// white cards #232323 (cards outlined #373737 via a shadow so nothing moves), inputs #121212.
const BLUE_D = '#0b4f80';
const CARD_D = '#232323';
const TEXT = byMode('#000', '#f8f8f8');
const DARK_ONLY = 'html[data-theme="dark"] &';

const EMPTY = {
  name: '', type: 'Normal Product', status: 'Active', description: '', caseQuantity: 1,
  categoryId: null, categoryName: '', brandId: null, brandName: '', familyId: null, familyName: '', tags: [],
  retailTaxRate: '', costPercentage: false, averageCaseCost: '', caseCost: '',
  requestPrice: false, requestQuantity: false, preventManualDiscounts: false, prices: [],
  trackInventory: true, currentStockCases: '', currentStockItems: '',
  barcodes: [], orderNotes: '', images: [], loyaltyRows: [],
};

const money = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? '' : `$${Number(v).toFixed(2)}`);
const tagNames = (tags) => (Array.isArray(tags) ? tags.map((t) => t?.tag?.name || t?.name).filter(Boolean) : []);
const priceText = (prices) => (Array.isArray(prices) && prices.length ? prices.map((p) => `${p.quantity || 1} for $${Number(p.price || 0).toFixed(2)}`).join(', ') : '');
const barcodeText = (bcs) => (Array.isArray(bcs) && bcs.length ? bcs.filter((b) => b?.code).map((b) => `${b.quantity || 1} x ${b.code}`).join(', ') : '');
const loyaltyText = (rows) => (Array.isArray(rows) && rows.length ? rows.map((r) => `${r.quantity} = ${r.earnRate} pts`).join(', ') : '');
const stockText = (p) => (p ? `${Number(p.currentStockCases || 0)} cases, ${Number(p.currentStockItems || 0)} items` : '');

// Section -> the Results fields it owns (what "Select Section" copies).
const pickSection = (section, p) => {
  switch (section) {
    case 'general':
      return { name: p.name || '', type: p.type || 'Normal Product', status: p.status || 'Active', description: stripHtml(p.description || ''), caseQuantity: p.caseQuantity || 1 };
    case 'classifications':
      return { categoryId: p.categoryId ?? null, categoryName: p.category?.name || '', brandId: p.brandId ?? null, brandName: p.brand?.name || '', familyId: p.familyId ?? null, familyName: p.family?.name || '', tags: tagNames(p.tags) };
    case 'sellCost':
      return {
        retailTaxRate: p.retailTaxRate || '', costPercentage: !!p.costPercentage,
        averageCaseCost: p.averageCaseCost ?? '', caseCost: p.caseCost ?? '',
        requestPrice: !!p.requestPrice, requestQuantity: !!p.requestQuantity, preventManualDiscounts: !!p.preventManualDiscounts,
        prices: (p.prices || []).map((x) => ({ quantity: x.quantity || 1, price: Number(x.price) || 0, cost: Number(x.cost) || 0 })),
      };
    case 'inventory':
      return { trackInventory: p.trackInventory !== false, currentStockCases: p.currentStockCases ?? 0, currentStockItems: p.currentStockItems ?? 0 };
    case 'barcodes':
      return { barcodes: (p.barcodes || []).filter((b) => b?.code).map((b) => ({ code: b.code, quantity: b.quantity || 1, ...(b.templateId ? { templateId: b.templateId } : {}) })) };
    case 'suppliers':
      return { orderNotes: p.orderNotes || '' };
    case 'images':
      return { images: (p.images || []).map((i) => ({ imageUrl: i.imageUrl, isMain: !!i.isMain, altText: i.altText || '', sortOrder: i.sortOrder ?? 0 })) };
    case 'loyalty':
      return { loyaltyRows: (p.loyaltyRows || []).map((r) => ({ quantity: r.quantity, earnRate: r.earnRate, redeemRate: r.redeemRate })) };
    default:
      return {};
  }
};

// ---------- small building blocks ----------
const FieldLabel = ({ label, tick, required, action }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 36, mb: 0.5 }}>
    <Typography sx={{ fontSize: 16, color: TEXT }}>{label}{required ? '*' : ''}</Typography>
    {tick && <TickIcon data-testid="field-tick" sx={{ fontSize: 16, color: byMode('#1c86f2', '#74d4ff'), ml: 0.75 }} />}
    <Box sx={{ flex: 1 }} />
    {action}
  </Box>
);
const ValueText = ({ value }) => (
  <Typography sx={{ fontSize: 16, color: value ? TEXT : byMode('#8a8d91', '#d4d4d4'), px: 1, py: 0.5, mb: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
    {value || NO_VALUE}
  </Typography>
);
const inputSx = { width: '100%', border: 1, borderStyle: 'solid', borderColor: byMode('#000', '#a1a1a1'), borderRadius: '4px', bgcolor: byMode('#fff', '#121212'), px: 1.5, fontSize: 16, minHeight: 50, mb: 1.5, fontFamily: 'inherit', '& input::placeholder': { color: byMode('#9e9e9e', '#757575') }, [DARK_ONLY]: { color: '#f8f8f8' } };
const selectSx = { width: '100%', mb: 1.5, bgcolor: byMode('#fff', '#121212'), borderRadius: '8px', fontSize: 16, minHeight: 42, '& .MuiSelect-select': { py: 1 }, '& .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#000', '#a1a1a1') }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#000', '#a1a1a1') }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#000', '#2b7fff'), borderWidth: 1 }, [DARK_ONLY]: { color: '#f8f8f8' }, [`${DARK_ONLY} .MuiSelect-icon`]: { color: '#f8f8f8' } };
const ClearBtn = ({ onClick, testid }) => (
  <Button data-testid={testid} onClick={onClick} startIcon={<CloseIcon sx={{ fontSize: 16 }} />} sx={{ color: byMode(DARK, '#d4d4d4'), border: 1, borderStyle: 'solid', borderColor: byMode('#313439', '#a1a1a1'), borderRadius: '2px', bgcolor: byMode('#f8f8f8', 'transparent'), fontSize: 15, textTransform: 'none', px: 1.25, py: 0.25, minWidth: 0, '&:hover': { bgcolor: byMode('#eee', '#333333') } }}>
    Clear
  </Button>
);
const SectionCard = ({ title, selected, dark, onSelect, children, testid }) => (
  <Box data-testid={testid} data-selected={selected ? '1' : '0'} sx={{ bgcolor: selected ? byMode(BLUE, BLUE_D) : byMode('#fff', CARD_D), p: 2, mb: 2, borderRadius: 0, ...(selected ? {} : { [DARK_ONLY]: { boxShadow: '0 0 0 1px #373737' } }) }}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
      <Typography sx={{ fontSize: 20, color: TEXT }}>{title}</Typography>
      <Button
        onClick={onSelect}
        sx={{ fontSize: 18, textTransform: 'none', borderRadius: '2px', px: 1.25, py: 0.5, border: 1, borderStyle: 'solid', borderColor: dark ? byMode(DARK, '#f8f8f8') : byMode('#9e9e9e', '#a1a1a1'), bgcolor: dark ? byMode(DARK, '#3a3a3a') : byMode('#f3f3f3', 'transparent'), color: dark ? byMode('#fff', '#f8f8f8') : byMode('#555', '#d4d4d4'), fontWeight: 400, '&:hover': { bgcolor: dark ? byMode(DARK, '#4a4a4a') : byMode('#e6e6e6', '#333333') } }}
      >
        Select Section
      </Button>
    </Box>
    {children}
  </Box>
);
const BadgeDialog = ({ open, onClose, title, subtitle, children, actions, testid }) => (
  <Dialog open={open} onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: 480, maxWidth: 'calc(100vw - 32px)', overflow: 'visible', borderRadius: 0, mt: 8 }, 'data-testid': testid }}>
    <Box aria-hidden sx={{ position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)', width: 118, height: 118, borderRadius: '50%', bgcolor: byMode('#2d8ff5', '#1c86f2'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 72, fontWeight: 700, lineHeight: 1 }}>?</Box>
    <Box sx={{ pt: 8.5, px: 2, pb: 2, textAlign: 'center' }}>
      <Typography sx={{ fontSize: 18, fontWeight: 700, color: TEXT, mb: 1 }}>{title}</Typography>
      {subtitle && <Typography sx={{ fontSize: 16, color: TEXT, mb: 2 }}>{subtitle}</Typography>}
      {children}
      <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>{actions}</Box>
    </Box>
  </Dialog>
);
const dlgBtn = (primary) => ({ flex: 1, height: 48, fontSize: 24, fontWeight: 400, textTransform: 'none', borderRadius: '4px', boxShadow: 'none', bgcolor: primary ? byMode('#32b643', '#7bf1a8') : byMode('#f3f4f6', '#3a3a3a'), color: primary ? byMode('#fff', '#232323') : byMode('#676b72', '#f8f8f8'), border: 1, borderStyle: 'solid', borderColor: primary ? byMode('#32b643', '#7bf1a8') : byMode('#d4d4d4', '#5a5a5a'), '&:hover': { bgcolor: primary ? byMode('#2a9c39', '#8ff5b8') : byMode('#e5e7eb', '#4a4a4a'), boxShadow: 'none' }, '&.Mui-disabled': { bgcolor: primary ? byMode('#a5d9ad', '#7bf1a8') : byMode('#f3f4f6', '#3a3a3a'), color: primary ? byMode('#fff', '#232323') : byMode('#bbb', '#757575') } });

// ---------- page ----------
const ProductMerge = () => {
  const navigate = useNavigate();
  const isDark = useTheme().palette.mode === 'dark';
  // Inline style colours (outside sx): placeholders / option text per mode.
  const phColor = isDark ? '#757575' : '#9e9e9e';
  const optText = isDark ? '#f8f8f8' : '#000';
  const optSel = isDark ? '#00a6f4' : '#1c86f2';
  const { getOutletName } = useAuth();
  const outletName = (typeof getOutletName === 'function' && getOutletName()) || 'Outlet';

  const [products, setProducts] = useState([]); // full detail records
  const [sources, setSources] = useState({}); // sectionId -> productId | null (null = Results / manual)
  const [merged, setMerged] = useState(EMPTY);
  const [taxRates, setTaxRates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [families, setFamilies] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addInput, setAddInput] = useState('');
  const [addOptions, setAddOptions] = useState([]);
  const [addPicked, setAddPicked] = useState([]);
  const [addSearching, setAddSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const searchTimer = useRef(null);

  // confirm + result
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [c, b, f, t] = await Promise.all([
          productService.getCategories(), productService.getBrands(), productService.getFamilies(),
          taxRateService.getTaxRates().catch(() => ({ taxRates: [] })),
        ]);
        setCategories(Array.isArray(c) ? c : []); setBrands(Array.isArray(b) ? b : []); setFamilies(Array.isArray(f) ? f : []);
        setTaxRates(Array.isArray(t?.taxRates) ? t.taxRates : []);
      } catch (e) { console.error('merge options', e); }
    })();
  }, []);

  // ---- search (server side, debounced) ----
  useEffect(() => {
    if (!addOpen) return undefined;
    const q = addInput.trim();
    if (!q) { setAddOptions([]); return undefined; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        setAddSearching(true);
        const r = await productService.getProducts({ search: q, limit: 50 });
        const list = (r?.products || []).filter((p) => !products.some((x) => x.id === p.id));
        setAddOptions(list);
      } catch { setAddOptions([]); }
      finally { setAddSearching(false); }
    }, 250);
    return () => clearTimeout(searchTimer.current);
  }, [addInput, addOpen, products]);

  const openAdd = () => { setAddPicked([]); setAddInput(''); setAddOptions([]); setAddOpen(true); };

  const confirmAdd = async () => {
    if (!addPicked.length) return;
    try {
      setAdding(true);
      const details = await Promise.all(addPicked.map(async (p) => {
        try { const d = await productService.getProduct(p.id); return d?.product || d || p; } catch { return p; }
      }));
      setProducts((prev) => {
        const next = [...prev, ...details.filter((d) => !prev.some((x) => x.id === d.id))];
        return next;
      });
      setAddOpen(false);
    } finally { setAdding(false); }
  };

  const removeProduct = (id) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setSources((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => { if (next[k] === id) next[k] = null; });
      return next;
    });
  };

  // ---- selection ----
  const selectFromProduct = (section, product) => {
    setSources((prev) => ({ ...prev, [section]: product.id }));
    setMerged((prev) => ({ ...prev, ...pickSection(section, product) }));
  };
  const selectResults = (section) => setSources((prev) => ({ ...prev, [section]: null })); // keep typed values
  const edit = (patch) => setMerged((prev) => ({ ...prev, ...patch }));
  const sectionOf = (section) => sources[section] ?? null;
  const isResults = (section) => sectionOf(section) === null;
  const isFrom = (section, id) => sectionOf(section) === id;
  // ticks: on Results fields while the section is manual, on the chosen product's fields otherwise
  const tickR = (section) => isResults(section);

  const canMerge = products.length >= 2 && String(merged.name || '').trim() !== '' && !loading;

  const doMerge = async () => {
    setConfirmOpen(false);
    try {
      setLoading(true); setError('');
      const payload = {
        name: merged.name.trim(), type: merged.type, status: merged.status, description: merged.description || '',
        caseQuantity: Number(merged.caseQuantity) > 0 ? Number(merged.caseQuantity) : 1,
        categoryId: merged.categoryId ?? null, brandId: merged.brandId ?? null, familyId: merged.familyId ?? null,
        retailTaxRate: merged.retailTaxRate || undefined, costPercentage: !!merged.costPercentage,
        requestPrice: !!merged.requestPrice, requestQuantity: !!merged.requestQuantity, preventManualDiscounts: !!merged.preventManualDiscounts,
        trackInventory: !!merged.trackInventory,
        orderNotes: merged.orderNotes || '',
      };
      if (merged.caseCost !== '' && merged.caseCost !== null && merged.caseCost !== undefined) {
        payload.caseCost = Number(merged.caseCost) || 0;
        payload.itemCost = Math.round(((Number(merged.caseCost) || 0) / payload.caseQuantity) * 100) / 100;
      }
      if (merged.currentStockCases !== '' && merged.currentStockCases !== null) payload.currentStockCases = Number(merged.currentStockCases) || 0;
      if (merged.currentStockItems !== '' && merged.currentStockItems !== null) payload.currentStockItems = Number(merged.currentStockItems) || 0;
      if (Array.isArray(merged.prices) && merged.prices.length) payload.prices = merged.prices.map((p) => ({ quantity: Number(p.quantity) || 1, price: Number(p.price) || 0, cost: Number(p.cost) || 0 }));
      if (!isResults('barcodes') || merged.barcodes.length) payload.barcodes = merged.barcodes;
      if (!isResults('images')) payload.images = merged.images;
      if (!isResults('loyalty')) payload.loyaltyRows = merged.loyaltyRows;
      const r = await productService.mergeProducts({ productsToMerge: products.map((p) => p.id), mergedProduct: payload });
      setResult(r);
      setProducts([]); setSources({}); setMerged(EMPTY);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to merge products');
    } finally { setLoading(false); }
  };

  // ---------- renderers ----------
  const colSx = { width: 400, flexShrink: 0, bgcolor: byMode(GREY, CARD_D), p: 2, pt: 1.5, alignSelf: 'flex-start' };
  const rowInput = (field, { type = 'text', placeholder = '', testid } = {}) => (
    <InputBase value={merged[field] ?? ''} type={type} placeholder={placeholder} onChange={(e) => edit({ [field]: e.target.value })} inputProps={{ 'aria-label': field, 'data-testid': testid }} sx={inputSx} />
  );
  const optList = (items) => [{ id: '', name: 'No Value' }, ...items.map((x) => ({ id: x.id, name: x.name }))];
  const classSelect = (idField, nameField, items, label) => (
    <>
      <FieldLabel label={label} tick={tickR('classifications')} action={<ClearBtn testid={`clear-${idField}`} onClick={() => edit({ [idField]: null, [nameField]: '' })} />} />
      {merged[idField] ? (
        <ValueText value={merged[nameField] || items.find((x) => x.id === merged[idField])?.name || ''} />
      ) : (
        <Select displayEmpty value="" onChange={(e) => { const it = items.find((x) => x.id === e.target.value); edit({ [idField]: it?.id ?? null, [nameField]: it?.name || '' }); }} inputProps={{ 'aria-label': label }} sx={selectSx} renderValue={() => <span style={{ color: phColor }}>{NO_VALUE}</span>}>
          {optList(items).map((o) => <MenuItem key={o.id || 'none'} value={o.id} sx={{ fontSize: 16 }}>{o.name}</MenuItem>)}
        </Select>
      )}
    </>
  );

  const renderResults = () => (
    <Box data-testid="merge-results-column" sx={colSx}>
      <Typography sx={{ fontSize: 20, color: TEXT, mb: 1.5, px: 0 }}>Results</Typography>

      <SectionCard testid="results-general" title="General" selected={isResults('general')} onSelect={() => selectResults('general')}>
        <FieldLabel label="Name" required tick={tickR('general')} />
        {rowInput('name', { testid: 'merged-name' })}
        <FieldLabel label="Type" required tick={tickR('general')} />
        <ValueText value={merged.type} />
        <FieldLabel label="Status" required tick={tickR('general')} />
        <Select value={merged.status || ''} displayEmpty onChange={(e) => edit({ status: e.target.value })} inputProps={{ 'aria-label': 'Status' }} sx={selectSx} renderValue={(v) => v || <span style={{ color: phColor }}>Select...</span>}>
          {['Active', 'Not Selling', 'Discontinued'].map((s) => <MenuItem key={s} value={s} sx={{ fontSize: 16 }}>{s}</MenuItem>)}
        </Select>
        <FieldLabel label="Description" tick={tickR('general')} />
        {rowInput('description')}
        <FieldLabel label="Case Quantity" required tick={tickR('general')} />
        {rowInput('caseQuantity', { type: 'number', testid: 'merged-case-qty' })}
      </SectionCard>

      <SectionCard testid="results-classifications" title="Classifications" selected={isResults('classifications')} onSelect={() => selectResults('classifications')}>
        {classSelect('categoryId', 'categoryName', categories, 'Category')}
        {classSelect('brandId', 'brandName', brands, 'Brand')}
        {classSelect('familyId', 'familyName', families, 'Family')}
        <FieldLabel label="Tags" tick={tickR('classifications')} action={<ClearBtn testid="clear-tags" onClick={() => edit({ tags: [] })} />} />
        <ValueText value={(merged.tags || []).join(', ')} />
      </SectionCard>

      <SectionCard testid="results-sellCost" title="Sell & Cost Prices" selected={isResults('sellCost')} onSelect={() => selectResults('sellCost')}>
        <FieldLabel label="Tax Rate" tick={tickR('sellCost')} action={<ClearBtn testid="clear-tax" onClick={() => edit({ retailTaxRate: '' })} />} />
        <Select value={merged.retailTaxRate || ''} displayEmpty onChange={(e) => edit({ retailTaxRate: e.target.value })} inputProps={{ 'aria-label': 'Tax Rate' }} sx={selectSx} renderValue={(v) => v || <span style={{ color: phColor }}>Select...</span>}>
          {taxRates.map((t) => <MenuItem key={t.id} value={t.name} sx={{ fontSize: 16 }}>{t.name}</MenuItem>)}
        </Select>
        <FieldLabel label="Cost is a percentage of sell price" tick={tickR('sellCost')} />
        <Box sx={{ mb: 1.5 }}><ShopfrontSwitch checked={!!merged.costPercentage} onChange={(e) => edit({ costPercentage: e.target.checked })} inputProps={{ 'aria-label': 'Cost is a percentage of sell price' }} /></Box>
        <FieldLabel label="Global Average Cost" tick={tickR('sellCost')} />
        <InputBase value={merged.averageCaseCost ?? ''} onChange={(e) => edit({ averageCaseCost: e.target.value })} startAdornment={<span style={{ color: phColor, marginRight: 6 }}>$</span>} inputProps={{ 'aria-label': 'Global Average Cost' }} sx={inputSx} />
        <FieldLabel label="Global Last Cost" tick={tickR('sellCost')} />
        <InputBase value={merged.caseCost ?? ''} onChange={(e) => edit({ caseCost: e.target.value })} startAdornment={<span style={{ color: phColor, marginRight: 6 }}>$</span>} inputProps={{ 'aria-label': 'Global Last Cost', 'data-testid': 'merged-last-cost' }} sx={inputSx} />
        {[['requestPrice', 'Request Price'], ['requestQuantity', 'Request Quantity'], ['preventManualDiscounts', 'Prevent Manual Discounts']].map(([k, l]) => (
          <React.Fragment key={k}>
            <FieldLabel label={l} tick={tickR('sellCost')} />
            <Box sx={{ mb: 1.5 }}><ShopfrontSwitch checked={!!merged[k]} onChange={(e) => edit({ [k]: e.target.checked })} inputProps={{ 'aria-label': l }} /></Box>
          </React.Fragment>
        ))}
        <FieldLabel label="Prices" tick={tickR('sellCost')} action={<ClearBtn testid="clear-prices" onClick={() => edit({ prices: [] })} />} />
        {(merged.prices || []).length ? (
          <Box sx={{ mb: 1 }}>
            {merged.prices.map((p, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                <InputBase type="number" value={p.quantity} onChange={(e) => { const n = [...merged.prices]; n[i] = { ...n[i], quantity: Math.max(1, parseInt(e.target.value || 1, 10)) }; edit({ prices: n }); }} inputProps={{ 'aria-label': `Price ${i + 1} quantity`, min: 1 }} sx={{ ...inputSx, width: 90, mb: 0 }} />
                <Typography sx={{ fontSize: 16, [DARK_ONLY]: { color: '#f8f8f8' } }}>for $</Typography>
                <InputBase type="number" value={p.price} onChange={(e) => { const n = [...merged.prices]; n[i] = { ...n[i], price: parseFloat(e.target.value || 0) }; edit({ prices: n }); }} inputProps={{ 'aria-label': `Price ${i + 1} amount`, step: 0.01 }} sx={{ ...inputSx, flex: 1, mb: 0 }} />
                <IconButton size="small" aria-label={`Remove price ${i + 1}`} onClick={() => edit({ prices: merged.prices.filter((_, j) => j !== i) })} sx={{ color: byMode('#e3342f', '#ffa2a2') }}><DeleteOutlineIcon /></IconButton>
              </Box>
            ))}
          </Box>
        ) : <ValueText value="" />}
        <Button startIcon={<AddIcon />} onClick={() => edit({ prices: [...(merged.prices || []), { quantity: 1, price: 0, cost: 0 }] })} sx={{ textTransform: 'none', color: byMode(DARK, '#d4d4d4'), fontSize: 15, mb: 0.5 }}>Add Price</Button>
      </SectionCard>

      <SectionCard testid="results-inventory" title="Inventory" selected={isResults('inventory')} onSelect={() => selectResults('inventory')}>
        <FieldLabel label="Track Inventory" tick={tickR('inventory')} />
        <Box sx={{ mb: 1.5 }}><ShopfrontSwitch checked={!!merged.trackInventory} onChange={(e) => edit({ trackInventory: e.target.checked })} inputProps={{ 'aria-label': 'Track Inventory' }} /></Box>
        <FieldLabel label={outletName} tick={tickR('inventory')} />
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
          <InputBase type="number" placeholder="Cases" value={merged.currentStockCases ?? ''} onChange={(e) => edit({ currentStockCases: e.target.value })} inputProps={{ 'aria-label': 'Stock cases', 'data-testid': 'merged-stock-cases' }} sx={{ ...inputSx, mb: 0 }} />
          <InputBase type="number" placeholder="Items" value={merged.currentStockItems ?? ''} onChange={(e) => edit({ currentStockItems: e.target.value })} inputProps={{ 'aria-label': 'Stock items', 'data-testid': 'merged-stock-items' }} sx={{ ...inputSx, mb: 0 }} />
        </Box>
        <Typography sx={{ fontSize: 13, color: byMode('#555', '#a0a4aa'), mb: 0.5 }}>Leave blank to add the stock of all merged products together.</Typography>
      </SectionCard>

      <SectionCard testid="results-barcodes" title="Barcodes" selected={isResults('barcodes')} onSelect={() => selectResults('barcodes')}>
        <FieldLabel label="Barcodes" tick={tickR('barcodes')} action={<ClearBtn testid="clear-barcodes" onClick={() => edit({ barcodes: [] })} />} />
        <ValueText value={barcodeText(merged.barcodes)} />
      </SectionCard>

      <SectionCard testid="results-suppliers" title="Suppliers" selected={isResults('suppliers')} onSelect={() => selectResults('suppliers')}>
        <FieldLabel label="Order Notes" tick={tickR('suppliers')} />
        {rowInput('orderNotes')}
      </SectionCard>

      <SectionCard testid="results-images" title="Images" selected={isResults('images')} onSelect={() => selectResults('images')}>
        <FieldLabel label="Main Image" tick={tickR('images')} action={<ClearBtn testid="clear-images" onClick={() => edit({ images: [] })} />} />
        {merged.images.find((i) => i.isMain) ? <Box component="img" src={merged.images.find((i) => i.isMain).imageUrl} alt="" sx={{ maxHeight: 80, mb: 1 }} /> : <ValueText value="" />}
        <FieldLabel label="Alternate Images" tick={tickR('images')} />
        <ValueText value={merged.images.filter((i) => !i.isMain).length ? `${merged.images.filter((i) => !i.isMain).length} image(s)` : ''} />
      </SectionCard>

      <SectionCard testid="results-loyalty" title="Loyalty" selected={isResults('loyalty')} onSelect={() => selectResults('loyalty')}>
        <FieldLabel label={`${outletName} Loyalty`} tick={tickR('loyalty')} action={<ClearBtn testid="clear-loyalty" onClick={() => edit({ loyaltyRows: [] })} />} />
        <ValueText value={loyaltyText(merged.loyaltyRows)} />
      </SectionCard>
    </Box>
  );

  const renderProduct = (p) => {
    const sec = (id, title, rows) => (
      <SectionCard key={id} testid={`product-${p.id}-${id}`} title={title} selected={isFrom(id, p.id)} dark={isFrom(id, p.id)} onSelect={() => selectFromProduct(id, p)}>
        {rows.map(([label, value]) => (
          <React.Fragment key={label}>
            <FieldLabel label={label} tick={isFrom(id, p.id)} />
            <ValueText value={value} />
          </React.Fragment>
        ))}
      </SectionCard>
    );
    const mainImg = (p.images || []).find((i) => i.isMain);
    return (
      <Box key={p.id} data-testid={`merge-product-column`} data-product-id={p.id} sx={colSx}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography sx={{ fontSize: 20, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</Typography>
          <IconButton aria-label={`Remove ${p.name}`} onClick={() => removeProduct(p.id)} sx={{ color: byMode('#e3342f', '#ffa2a2') }}><DeleteOutlineIcon /></IconButton>
        </Box>
        {sec('general', 'General', [['Name', p.name], ['Type', p.type], ['Status', p.status], ['Description', stripHtml(p.description || '')], ['Case Quantity', String(p.caseQuantity ?? 1)]])}
        {sec('classifications', 'Classifications', [['Category', p.category?.name], ['Brand', p.brand?.name], ['Family', p.family?.name], ['Tags', tagNames(p.tags).join(', ')]])}
        {sec('sellCost', 'Sell & Cost Prices', [['Tax Rate', p.retailTaxRate], ['Cost is a percentage of sell price', p.costPercentage ? 'Yes' : 'No'], ['Global Average Cost', money(p.averageCaseCost)], ['Global Last Cost', money(p.caseCost)], ['Request Price', p.requestPrice ? 'Yes' : 'No'], ['Request Quantity', p.requestQuantity ? 'Yes' : 'No'], ['Prevent Manual Discounts', p.preventManualDiscounts ? 'Yes' : 'No'], ['Prices', priceText(p.prices)]])}
        {sec('inventory', 'Inventory', [['Track Inventory', p.trackInventory === false ? 'No' : 'Yes'], [p.outlet?.name || outletName, stockText(p)]])}
        {sec('barcodes', 'Barcodes', [['Barcodes', barcodeText(p.barcodes)]])}
        {sec('suppliers', 'Suppliers', [['Order Notes', p.orderNotes]])}
        {sec('images', 'Images', [['Main Image', mainImg ? mainImg.imageUrl : ''], ['Alternate Images', (p.images || []).filter((i) => !i.isMain).length ? `${(p.images || []).filter((i) => !i.isMain).length} image(s)` : '']])}
        {sec('loyalty', 'Loyalty', [[`${p.outlet?.name || outletName} Loyalty`, loyaltyText(p.loyaltyRows)]])}
      </Box>
    );
  };

  const pickedLabel = useMemo(() => (addPicked.length ? `${addPicked.length} Selected...` : ''), [addPicked]);

  return (
    <Box sx={{ minHeight: 'calc(100vh - 50px)', bgcolor: byMode('#f5f5f5', '#121212'), px: '8px', pb: '8px' }}>
      <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: TEXT, m: '20px 0 24px' }}>Product Merge</Typography>
      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: '16px', alignItems: 'flex-start', overflowX: 'auto', pb: 2 }}>
        <Box sx={{ flexShrink: 0 }}>
          {renderResults()}
          <Button
            data-testid="complete-merge"
            disabled={!canMerge}
            onClick={() => setConfirmOpen(true)}
            sx={{ width: 400, height: 42, mt: 1, bgcolor: byMode('#e0e0e0', '#3a3a3a'), color: byMode('#555', '#f8f8f8'), fontSize: 16, fontWeight: 700, textTransform: 'none', borderRadius: '8px', boxShadow: 'none', '&:hover': { bgcolor: byMode('#cfcfcf', '#4a4a4a') }, '&.Mui-disabled': { bgcolor: byMode('#e0e0e0', '#3a3a3a'), color: byMode('#9e9e9e', '#757575') } }}
          >
            {loading ? <CircularProgress size={22} sx={{ color: byMode('#555', '#f8f8f8') }} /> : 'Complete Merge'}
          </Button>
        </Box>
        <Box sx={{ width: '1px', alignSelf: 'stretch', bgcolor: byMode('#e0e0e0', '#333333'), flexShrink: 0 }} />
        {products.map(renderProduct)}
        <Box
          data-testid="add-product-card"
          role="button"
          tabIndex={0}
          onClick={openAdd}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAdd(); } }}
          sx={{ width: 400, minHeight: 760, flexShrink: 0, border: 1, borderStyle: 'dashed', borderColor: byMode('#bdbdbd', '#a1a1a1'), m: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: TEXT, fontSize: 16, '&:hover': { bgcolor: byMode('#fafafa', '#1a1a1a') } }}
        >
          <AddIcon sx={{ fontSize: 20, mr: 0.5 }} /> Click to add a new product to merge
        </Box>
      </Box>

      {/* Add Product */}
      <BadgeDialog
        open={addOpen}
        onClose={adding ? undefined : () => setAddOpen(false)}
        title="Add Product"
        subtitle="Select product to add to the merge"
        testid="add-product-dialog"
        actions={<>
          <Button onClick={() => setAddOpen(false)} disabled={adding} sx={dlgBtn(false)}>Cancel</Button>
          <Button onClick={confirmAdd} disabled={adding || !addPicked.length} data-testid="add-product-confirm" sx={dlgBtn(true)}>{adding ? 'Adding...' : 'Add'}</Button>
        </>}
      >
        <Autocomplete
          multiple
          disableCloseOnSelect
          options={addOptions}
          value={addPicked}
          loading={addSearching}
          inputValue={addInput}
          onInputChange={(_, v, reason) => { if (reason !== 'reset') setAddInput(v); }}
          onChange={(_, v) => setAddPicked(v)}
          getOptionLabel={(o) => o.name || ''}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          filterOptions={(x) => x}
          noOptionsText={addInput.trim() ? (addSearching ? 'Searching...' : 'No products found') : 'Keep Typing to Search...'}
          renderTags={(value) => (value.length ? <Chip label={`${value.length} Selected...`} size="small" sx={{ borderRadius: '4px', bgcolor: byMode('#e0e0e0', '#3a3a3a'), fontSize: 15, mr: 1 }} /> : null)}
          renderOption={(props, option, { selected }) => (
            <li {...props} key={option.id} style={{ fontSize: 16, padding: '12px 16px', color: selected ? optSel : optText }}>
              <Checkbox icon={<UncheckedIcon fontSize="small" />} checkedIcon={<CheckedIcon fontSize="small" />} checked={selected} sx={{ p: 0, mr: 1.5, color: selected ? optSel : optText }} />
              {option.name}
            </li>
          )}
          renderInput={(params) => (
            <TextField {...params} placeholder={addPicked.length ? '' : 'Search for products...'} inputProps={{ ...params.inputProps, 'aria-label': 'Search for products', 'data-testid': 'add-product-search' }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', bgcolor: byMode('#fff', '#121212'), minHeight: 44, py: 0, '& fieldset': { borderColor: byMode('#000', '#a1a1a1') }, '&:hover fieldset': { borderColor: byMode('#000', '#a1a1a1') }, '&.Mui-focused fieldset': { borderColor: byMode('#000', '#2b7fff'), borderWidth: 1 }, [DARK_ONLY]: { color: '#f8f8f8' }, [`${DARK_ONLY} input::placeholder`]: { color: '#757575', opacity: 1 } } }} />
          )}
          ListboxProps={{ 'data-testid': 'add-product-options', style: { maxHeight: 300 } }}
          componentsProps={{ paper: { sx: { borderRadius: '8px', border: 1, borderStyle: 'solid', borderColor: byMode('#000', '#a1a1a1'), boxShadow: '0 4px 12px rgba(0,0,0,0.15)', mt: 0.5, '& .MuiAutocomplete-option[aria-selected="true"]': { bgcolor: 'transparent', color: byMode('#1c86f2', '#00a6f4') }, '& .MuiAutocomplete-option.Mui-focused': { bgcolor: byMode('#6fcbf9', '#0084d1') }, [`${DARK_ONLY} .MuiAutocomplete-option.Mui-focused`]: { bgcolor: '#0084d1', color: '#fafafa' }, [`${DARK_ONLY} .MuiAutocomplete-noOptions, ${DARK_ONLY} .MuiAutocomplete-loading`]: { color: '#f8f8f8' } } } }}
          sx={{ textAlign: 'left' }}
        />
        {pickedLabel && <Typography sx={{ display: 'none' }}>{pickedLabel}</Typography>}
      </BadgeDialog>

      {/* Confirm */}
      <BadgeDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Complete Merge?"
        subtitle={`The ${products.length} selected products will be merged into "${merged.name}". Their sales and purchase history move to the new product and the originals are sent to Trashed Items. This cannot be reversed.`}
        testid="confirm-merge-dialog"
        actions={<>
          <Button onClick={() => setConfirmOpen(false)} sx={dlgBtn(false)}>Cancel</Button>
          <Button onClick={doMerge} data-testid="confirm-merge-continue" sx={dlgBtn(true)}>Continue</Button>
        </>}
      />

      {/* Result */}
      <Dialog open={Boolean(result)} onClose={() => setResult(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '12px' }, 'data-testid': 'merge-result-dialog' }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Merge Complete</DialogTitle>
        <DialogContent>
          {result && (
            <Box>
              <Typography sx={{ mb: 1.5 }}>{result.message}</Typography>
              <Table size="small">
                <TableHead><TableRow><TableCell sx={{ fontWeight: 700 }}>Item</TableCell><TableCell sx={{ fontWeight: 700 }} align="right">Value</TableCell></TableRow></TableHead>
                <TableBody>
                  <TableRow><TableCell>New product</TableCell><TableCell align="right">{result.mergedProduct?.name} (#{result.mergedProduct?.id})</TableCell></TableRow>
                  <TableRow><TableCell>Products merged</TableCell><TableCell align="right">{result.originalProductsCount ?? ''}</TableCell></TableRow>
                  <TableRow><TableCell>Sales history moved</TableCell><TableCell align="right">{result.salesHistoryCount ?? ''}</TableCell></TableRow>
                  <TableRow><TableCell>Purchase history moved</TableCell><TableCell align="right">{result.purchaseHistoryCount ?? ''}</TableCell></TableRow>
                  <TableRow><TableCell>Stock on new product</TableCell><TableCell align="right">{stockText(result.mergedProduct)}</TableCell></TableRow>
                </TableBody>
              </Table>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setResult(null)} disableElevation sx={{ bgcolor: byMode('#dddddd', '#3a3a3a'), color: TEXT, height: 42, borderRadius: '12px', px: 3, fontSize: 16, fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: byMode('#cccccc', '#4a4a4a') } }}>Close</Button>
          <Button onClick={() => navigate('/products')} variant="contained" disableElevation sx={{ bgcolor: '#5ebbeb', color: byMode('#fff', '#232323'), height: 42, borderRadius: '12px', px: 3, fontSize: 16, fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#4aa9dd' } }}>View Products</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProductMerge;
