import React, { useState, useEffect, useCallback, useRef } from 'react';
import { searchProducts } from '../../utils/productSearch.js';
import {
  Box,
  Button,
  TextField,
  FormControlLabel,
  Paper,
  Typography,
  InputAdornment,
  Alert,
  CircularProgress,
  FormControl,
  Select,
  MenuItem,
  IconButton,
  Dialog,
  DialogContent,
  DialogActions,
  ClickAwayListener,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  DeleteOutline as DeleteIcon,
  Close as CloseIcon,
  VisibilityOutlined as EyeIcon,
  ImageOutlined as ImageOutlinedIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import ProductPricesDialog from '../../components/PriceLists/ProductPricesDialog';
import useUnsavedChangesGuard from '../../hooks/useUnsavedChangesGuard';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import priceListService from '../../services/priceListService';
import classificationService from '../../services/classificationService';
import productService from '../../services/productService';
import priceSetService from '../../services/priceSetService';
import outletService from '../../services/outletService';
import {
  PRICING_METHODS,
  PRICING_METHODS_WITHOUT_OVERRIDE,
  MINIMUM_PRICE_OPTIONS,
  entityTypeLabel,
  overrideTiers,
  overridePriceRange,
  money,
} from './ruleLabels';

// Shopfront's price list EDIT page (reference, 29/10/2026 screenshots):
//   grey band   - "Editing [name]", the two toggles, Add Fallback Rule / Add All Categories
//   left pane   - search box, then one card per rule (green "+", "Product - Cost $x",
//                 name, and the rule summary on the right)
//   right pane  - "Select an item to start editing" until a card is clicked, then
//                 that rule's editor
//   bottom bar  - dark: red Cancel | "N Unsaved Changes" + blue Save
// Leaving with unsaved edits (Cancel, Back, sidebar, browser back) asks first.

// Search panel groups, in reference display order (also the keyboard-nav order).
const RESULT_GROUPS = [
  { key: 'product', label: 'Products' },
  { key: 'category', label: 'Categories', classification: 'Category' },
  { key: 'brand', label: 'Brands', classification: 'Brand' },
  { key: 'family', label: 'Families', classification: 'Family' },
  { key: 'tag', label: 'Tags', classification: 'Tag' },
];

const MIN_SEARCH_CHARS = 3;

const BOTTOM_BAR_HEIGHT = 64;

// Reference action button: rounded, bold, flat.
const actionButtonSx = (bg, hover = bg) => ({
  bgcolor: bg,
  color: '#fff',
  border: `1px solid ${bg}`,
  borderRadius: '12px',
  fontSize: 16,
  fontWeight: 700,
  textTransform: 'none',
  boxShadow: 'none',
  height: 42,
  px: 3,
  transition: 'background 0.2s ease, color 0.2s ease',
  '&:hover': { bgcolor: hover, borderColor: hover, boxShadow: 'none' },
  '&.Mui-disabled': { bgcolor: '#9ca3af', borderColor: '#9ca3af', color: '#f3f4f6' },
});

// Keyboard focus ring on the toggles (sky-400, 2px offset) — reference spec.
const switchSx = {
  '& .MuiSwitch-switchBase.Mui-focusVisible + .MuiSwitch-track': {
    outline: '2px solid #38bdf8',
    outlineOffset: '2px',
  },
};

const toggleLabelSx = {
  m: 0,
  gap: '.5rem',
  '& .MuiFormControlLabel-label': { fontSize: 16, color: '#313439' },
};

// Every price-list line fades in, matching `animation: priceListLineFade 1s ease`.
const lineFadeSx = {
  animation: 'priceListLineFade 1s ease',
  '@keyframes priceListLineFade': { from: { opacity: 0 }, to: { opacity: 1 } },
};

// Wraps the matched substring so it can be tinted like the reference.
const highlightMatch = (name = '', term = '') => {
  const i = term ? name.toLowerCase().indexOf(term.toLowerCase()) : -1;
  if (i === -1) return name;
  return (
    <>
      {name.slice(0, i)}
      <span className="matching-search">{name.slice(i, i + term.length)}</span>
      {name.slice(i + term.length)}
    </>
  );
};

// Products + every classification type, filtered by the typed term (the products
// endpoint alone does not narrow the list, so filter client-side as well).
const searchEntities = async (term) => {
  const q = term.trim().toLowerCase();
  const results = [];

  const productsRes = await productService.getProducts({ search: term.trim() }).catch(() => null);
  searchProducts(productsRes?.products || [], q)
    .slice(0, 50)
    .forEach((p) =>
      results.push({
        id: p.id,
        name: p.name,
        type: 'Product',
        entityType: 'product',
        cost: p.itemCost || p.cost || p.replacementCost || 0,
        imageUrl: p.imageUrl,
      })
    );

  const classificationGroups = RESULT_GROUPS.filter((g) => g.classification);
  const responses = await Promise.all(
    classificationGroups.map((g) =>
      classificationService
        .getClassifications({ type: g.classification, isActive: true })
        .catch(() => null)
    )
  );
  classificationGroups.forEach((g, i) => {
    (responses[i]?.classifications || [])
      .filter((c) => c.name?.toLowerCase().includes(q))
      .slice(0, 50)
      .forEach((c) =>
        results.push({
          id: c.id,
          name: c.name,
          type: g.classification,
          entityType: g.key,
          imageUrl: c.imageUrl,
        })
      );
  });

  return results;
};

// Card summary, split over two lines the way the reference prints it:
// "Override Price" / "$64.00", "Last Cost +" / "15.00%".
const splitSummary = (rule) => {
  if (!rule) return ['', ''];
  if (rule.excludeFromPriceList) return ['Excluded', ''];
  const method = rule.pricingMethod;
  if (method === 'cost') return ['Cost', ''];
  if (method === 'override') {
    const tiers = overrideTiers(rule);
    if (tiers.length === 1) return ['Override Price', `$${money(tiers[0].price)}`];
    // several tiers read as a range, an empty tier counting as $0.00 (reference)
    const range = overridePriceRange({ quantityTiers: (rule.quantityTiers || []).map((t) => ({ quantity: t?.quantity || 1, price: t?.price || 0 })) });
    return ['Override Prices', range];
  }
  const label = PRICING_METHODS.find((m) => m.value === method)?.label || '';
  if (!label) return ['', ''];
  const amount = rule.pricingValue ?? rule.value;
  // reference: a rule whose amount is still empty reads "Invalid" (red) on the card
  if (amount === '' || amount === null || amount === undefined || isNaN(parseFloat(amount))) return ['Invalid', ''];
  if (label.endsWith('%')) return [label.slice(0, -1).trim(), `${money(amount)}%`];
  if (label.endsWith('$')) return [label.slice(0, -1).trim(), `$${money(amount)}`];
  return [label, ''];
};

const isDollarMethod = (m) => ['discount_total_by_dollar', 'discount_each_by_dollar', 'cost_plus_dollar', 'last_cost_plus_dollar'].includes(m);
const isPercentMethod = (m) => ['discount_by_percent', 'cost_plus_percent', 'last_cost_plus_percent'].includes(m);
const needsPricingValue = (method) => method && method !== 'override' && method !== 'cost';
const needsMinimumPriceValue = (method) => method && method !== 'no_minimum' && method !== 'cost';

const adornmentFor = (method) => {
  if (isDollarMethod(method) || method === 'override') return { startAdornment: <InputAdornment position="start">$</InputAdornment> };
  if (isPercentMethod(method)) return { endAdornment: <InputAdornment position="end">%</InputAdornment> };
  return undefined;
};

// Reference inputs: label above, rounded box, black border on focus.
const fieldLabelSx = { fontSize: 13, color: '#000', mb: 0.5, display: 'block' };
const inputSx = {
  '& .MuiOutlinedInput-root': { height: 46, borderRadius: '8px', fontSize: 16, bgcolor: '#fff' },
  '& .MuiOutlinedInput-input': { p: '8px 16px' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
};
// Reference dropdown: selected option in blue text, hovered row light blue.
const selectMenuProps = {
  PaperProps: {
    sx: {
      mt: 0.5,
      borderRadius: '8px',
      border: '1px solid #404040',
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      maxHeight: 300,
      '& .MuiMenuItem-root': { fontSize: 16, py: 1.75, px: 2, color: '#000' },
      '& .MuiMenuItem-root.Mui-selected': { bgcolor: 'transparent', color: '#1c9cf0' },
      '& .MuiMenuItem-root:hover, & .MuiMenuItem-root.Mui-focusVisible, & .MuiMenuItem-root.Mui-selected:hover': { bgcolor: '#7dd3fc', color: '#000' },
    },
  },
};

const LabelledSelect = ({ label, value, onChange, options, sx }) => (
  <Box sx={{ mb: 2, ...sx }}>
    <Typography component="label" sx={fieldLabelSx}>{label}</Typography>
    <FormControl fullWidth sx={inputSx}>
      <Select value={value} onChange={onChange} MenuProps={selectMenuProps} inputProps={{ 'aria-label': label }}>
        {options.map((m) => (
          <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
        ))}
      </Select>
    </FormControl>
  </Box>
);

// Decimal-only text field shared by every amount input on the page.
const AmountField = ({ label, value, onChange, method, sx }) => (
  <Box sx={{ mb: 2, ...sx }}>
    <Typography component="label" sx={fieldLabelSx}>{label}</Typography>
    <TextField
      fullWidth
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value;
        if (v === '' || /^\d*\.?\d*$/.test(v)) onChange(v);
      }}
      onBlur={(e) => {
        const v = e.target.value.trim();
        if (v && isNaN(parseFloat(v))) onChange('');
      }}
      sx={inputSx}
      type="text"
      inputProps={{ inputMode: 'decimal', pattern: '[0-9]*\\.?[0-9]*', 'aria-label': label }}
      error={!!value && isNaN(parseFloat(value))}
      helperText={value && isNaN(parseFloat(value)) ? 'Please enter a valid number' : ''}
      InputProps={adornmentFor(method)}
    />
  </Box>
);

// Compare rules by meaning, not by raw JSON: a saved rule may lack a key that
// the editor later sets to its default (e.g. exclude toggled on then off again),
// numbers may be stored as strings, and key order may differ. Without this the
// orange "changed" dot and the Unsaved count stay on after an undo.
const normalizeRule = (rule) => {
  if (rule == null || typeof rule !== 'object') return rule ?? null;
  if (Array.isArray(rule)) return rule.map(normalizeRule);
  const out = {};
  Object.keys(rule).sort().forEach((k) => {
    let v = rule[k];
    if (v === undefined || v === null || v === '' || v === false) return; // default / unset
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) v = Number(v);
    if (typeof v === 'number') v = Number(v.toFixed(6));
    if (typeof v === 'object') v = normalizeRule(v);
    out[k] = v;
  });
  return out;
};
const sameRule = (a, b) => JSON.stringify(normalizeRule(a)) === JSON.stringify(normalizeRule(b));

const PriceListConfiguration = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedOutletId } = useSelectedOutlet();

  // "See Prices" dialog (reference "Product Prices" / "Family Prices").
  const [pricesDialog, setPricesDialog] = useState({ open: false, title: 'Product Prices', product: null, loading: false });
  const [priceSets, setPriceSets] = useState(null);
  const [outlets, setOutlets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [addAllCategoriesDialogOpen, setAddAllCategoriesDialogOpen] = useState(false);
  const [categoryDefaults, setCategoryDefaults] = useState({
    excludeFromPriceList: false,
    pricingMethod: 'discount_by_percent',
    value: '',
    minimumPriceMethod: 'no_minimum',
    minimumPriceValue: '',
  });

  const [priceList, setPriceList] = useState(null);
  const [priceListName, setPriceListName] = useState('');

  const [allowHigherPrice, setAllowHigherPrice] = useState(false);
  const [allowDiscountingPromotions, setAllowDiscountingPromotions] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const searchInputRef = useRef(null);
  const activeResultRef = useRef(null);

  const [rules, setRules] = useState([]);
  const [fallbackRule, setFallbackRule] = useState(null);

  const [activeRuleCard, setActiveRuleCard] = useState(null);

  // What was last loaded / saved - every difference from it is an "Unsaved Change"
  // and gates the Confirm Leaving dialog.
  const [savedState, setSavedState] = useState(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const leaveProceedRef = useRef(null);

  const stateOf = (name, higher, promos, ruleList, fallback) => ({ name, higher, promos, ruleList, fallback });

  const countChanges = () => {
    if (!savedState) return 0;
    let n = 0;
    if (priceListName !== savedState.name) n += 1;
    if (allowHigherPrice !== savedState.higher) n += 1;
    if (allowDiscountingPromotions !== savedState.promos) n += 1;
    const savedById = new Map((savedState.ruleList || []).map((r) => [r.id, r]));
    const currentIds = new Set(rules.map((r) => r.id));
    rules.forEach((r) => {
      const was = savedById.get(r.id);
      if (!was || !sameRule(was, r)) n += 1;
    });
    (savedState.ruleList || []).forEach((r) => { if (!currentIds.has(r.id)) n += 1; });
    if (!sameRule(fallbackRule, savedState.fallback)) n += 1;
    return n;
  };
  const changeCount = countChanges();
  const isDirty = changeCount > 0;

  // Sidebar links, browser Back and tab close all come through here.
  useUnsavedChangesGuard(isDirty, (proceed) => {
    leaveProceedRef.current = proceed;
    setLeaveOpen(true);
  });

  const loadPriceList = useCallback(async () => {
    try {
      setLoading(true);
      const [listResponse, configResponse] = await Promise.all([
        priceListService.getPriceList(id),
        priceListService.getPriceListConfiguration(id).catch(() => null)
      ]);

      const list = listResponse.priceList;
      setPriceList(list);
      setPriceListName(list.name || '');

      const config = configResponse?.configuration || {};
      setAllowHigherPrice(config.allowHigherPrice || false);
      setAllowDiscountingPromotions(config.allowDiscountingPromotions || false);
      setRules(config.rules || []);
      setFallbackRule(config.fallbackRule || null);
      setSavedState(
        stateOf(
          list.name || '',
          config.allowHigherPrice || false,
          config.allowDiscountingPromotions || false,
          config.rules || [],
          config.fallbackRule || null
        )
      );
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load price list');
      console.error('Error loading price list:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPriceList();
  }, [loadPriceList]);

  // Search only once the term is long enough; debounced so typing does not hammer the API.
  useEffect(() => {
    const term = searchTerm.trim();
    if (term.length < MIN_SEARCH_CHARS) {
      setSearchResults([]);
      setHighlightIndex(-1);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const results = await searchEntities(term);
        if (!cancelled) {
          setSearchResults(results);
          setHighlightIndex(-1);
        }
      } catch (err) {
        console.error('Error performing search:', err);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchTerm]);

  useEffect(() => {
    activeResultRef.current?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex]);

  const closeSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    setSearchOpen(false);
    setHighlightIndex(-1);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    setHighlightIndex(-1);
    searchInputRef.current?.focus();
  };

  const familyCost = async (familyId) => {
    try {
      const res = await classificationService.getClassificationProducts(familyId);
      const first = (res?.assignedProducts || [])[0];
      return first ? (first.itemCost || first.cost || 0) : 0;
    } catch (err) {
      console.error('Error loading family products:', err);
      return 0;
    }
  };

  const handleAddProductRule = async (item) => {
    let productCost = item.cost || 0;
    let productData = item;

    if (item.entityType === 'product') {
      try {
        const productRes = await productService.getProduct(item.id);
        const product = productRes.product;
        productCost = product.itemCost || product.cost || product.replacementCost || 0;
        productData = {
          ...item,
          cost: productCost,
          itemCost: product.itemCost,
          replacementCost: product.replacementCost,
        };
      } catch (err) {
        console.error('Error fetching product details:', err);
      }
    } else if (item.entityType === 'family') {
      // A family's cost / prices are its first product's (reference card: "Family – Cost $x").
      productCost = await familyCost(item.id);
      productData = { ...item, cost: productCost };
    }

    const cardType = item.entityType === 'product' ? 'product' : 'category';
    const existingRule = rules.find(r => r.entityId === item.id && r.entityType === item.entityType);
    if (existingRule) {
      const updatedRule = { ...existingRule, cost: productCost };
      setRules(rules.map(r => r.id === existingRule.id ? updatedRule : r));
      setActiveRuleCard({ type: cardType, rule: updatedRule, item: productData });
    } else {
      // Products default to Override; everything else to Discount by % (the
      // reference only offers override prices on products).
      const newRule = item.entityType === 'product'
        ? {
          id: Date.now(),
          entityType: item.entityType,
          entityId: item.id,
          entityName: item.name,
          excludeFromPriceList: false,
          pricingMethod: 'override',
          quantityTiers: [],
          cost: productCost,
        }
        : {
          id: Date.now(),
          entityType: item.entityType,
          entityId: item.id,
          entityName: item.name,
          excludeFromPriceList: false,
          pricingMethod: 'discount_by_percent',
          pricingValue: '',
          minimumPriceMethod: 'no_minimum',
          minimumPriceValue: '',
        };
      setRules([...rules, newRule]);
      setActiveRuleCard({ type: cardType, rule: newRule, item: productData });
    }
    closeSearch();
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') {
      setSearchOpen(false);
      return;
    }
    if (!searchResults.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSearchOpen(true);
      setHighlightIndex((h) => (h + 1) % searchResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSearchOpen(true);
      setHighlightIndex((h) => (h <= 0 ? searchResults.length - 1 : h - 1));
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      handleAddProductRule(searchResults[highlightIndex]);
    }
  };

  const handleAddFallbackRule = () => {
    if (fallbackRule) {
      setActiveRuleCard({ type: 'fallback', rule: fallbackRule });
    } else {
      const newFallbackRule = {
        id: Date.now(),
        pricingMethod: 'discount_by_percent',
        pricingValue: '',
        minimumPriceMethod: 'no_minimum',
        minimumPriceValue: '',
      };
      setFallbackRule(newFallbackRule);
      setActiveRuleCard({ type: 'fallback', rule: newFallbackRule });
    }
  };

  const handleConfirmAddAllCategories = async () => {
    try {
      const categoriesRes = await classificationService.getClassifications({ type: 'Category', isActive: true });
      const categories = categoriesRes.classifications || [];
      const newRules = categories
        .filter(cat => !rules.find(r => r.entityId === cat.id && r.entityType === 'category'))
        .map((cat, index) => ({
          id: Date.now() + cat.id + index,
          entityType: 'category',
          entityId: cat.id,
          entityName: cat.name,
          excludeFromPriceList: categoryDefaults.excludeFromPriceList,
          pricingMethod: categoryDefaults.pricingMethod,
          pricingValue: categoryDefaults.value,
          minimumPriceMethod: categoryDefaults.minimumPriceMethod,
          minimumPriceValue: categoryDefaults.minimumPriceValue,
        }));
      setRules([...rules, ...newRules]);
      setAddAllCategoriesDialogOpen(false);
      setSuccess(`${newRules.length} category rule(s) added successfully!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error loading categories:', err);
      setError('Failed to add categories');
    }
  };

  const handleCancelAddAllCategories = () => {
    setAddAllCategoriesDialogOpen(false);
    setCategoryDefaults({
      excludeFromPriceList: false,
      pricingMethod: 'discount_by_percent',
      value: '',
      minimumPriceMethod: 'no_minimum',
      minimumPriceValue: '',
    });
  };

  const handleRemoveRule = (ruleId) => {
    const isFallback = activeRuleCard?.type === 'fallback';
    setDeleteTarget({
      id: ruleId,
      isFallback,
      name: isFallback
        ? 'All Other Products'
        : activeRuleCard?.rule?.entityName || 'this rule',
    });
  };

  const confirmRemoveRule = () => {
    if (!deleteTarget) return;
    if (deleteTarget.isFallback) {
      setFallbackRule(null);
    } else {
      setRules((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    }
    setActiveRuleCard(null);
    setDeleteTarget(null);
  };

  const unitCostOf = (rule) =>
    rule?.cost || activeRuleCard?.item?.cost || activeRuleCard?.item?.itemCost || 0;

  const updateRuleById = (ruleId, mutate) => {
    const updatedRules = rules.map((r) => (r.id === ruleId ? mutate(r) : r));
    setRules(updatedRules);
    if (activeRuleCard && activeRuleCard.rule.id === ruleId) {
      const updatedRule = updatedRules.find((r) => r.id === ruleId);
      if (updatedRule) setActiveRuleCard({ ...activeRuleCard, rule: updatedRule });
    }
  };

  const handleAddQuantityTier = (ruleId) => {
    updateRuleById(ruleId, (r) => ({
      ...r,
      quantityTiers: [...(r.quantityTiers || []), { quantity: '', price: '', cost: 0, percent: '' }],
    }));
  };

  const handleRemoveQuantityTier = (ruleId, tierIndex) => {
    updateRuleById(ruleId, (r) => {
      const newTiers = [...(r.quantityTiers || [])];
      newTiers.splice(tierIndex, 1);
      return { ...r, quantityTiers: newTiers };
    });
  };

  const handleUpdateQuantityTier = (ruleId, tierIndex, field, value) => {
    updateRuleById(ruleId, (r) => {
      const newTiers = [...(r.quantityTiers || [])];
      newTiers[tierIndex] = { ...newTiers[tierIndex], [field]: value };
      const unitCost = unitCostOf(r);
      const quantity = parseFloat(newTiers[tierIndex].quantity || 0);
      const price = parseFloat(newTiers[tierIndex].price || 0);
      const cost = quantity > 0 ? quantity * unitCost : 0;
      newTiers[tierIndex].cost = cost;
      newTiers[tierIndex].percent = price > 0 && quantity > 0 ? (((price - cost) / price) * 100).toFixed(2) : '';
      return { ...r, quantityTiers: newTiers };
    });
  };

  const handleUpdateRule = (field, value) => {
    if (!activeRuleCard) return;
    if (activeRuleCard.type === 'fallback') {
      const updatedFallback = { ...fallbackRule, [field]: value };
      setFallbackRule(updatedFallback);
      setActiveRuleCard({ ...activeRuleCard, rule: updatedFallback });
      return;
    }
    updateRuleById(activeRuleCard.rule.id, (r) => ({ ...r, [field]: value }));
  };

  const handleChangeMethod = (newMethod) => {
    if (!activeRuleCard) return;
    const current = activeRuleCard.rule;
    const patch = { pricingMethod: newMethod };
    if (newMethod !== current.pricingMethod) {
      patch.value = '';
      patch.pricingValue = '';
      if (newMethod === 'override' && !Array.isArray(current.quantityTiers)) patch.quantityTiers = [];
    }
    if (activeRuleCard.type === 'fallback') {
      const updatedFallback = { ...fallbackRule, ...patch };
      setFallbackRule(updatedFallback);
      setActiveRuleCard({ ...activeRuleCard, rule: updatedFallback });
      return;
    }
    updateRuleById(current.id, (r) => ({ ...r, ...patch }));
  };

  // See Prices: a product's own price rows, or (family) the rows of the family's
  // first product - the one the family's prices come from.
  const handleSeePrices = async (rule) => {
    const isFamily = rule.entityType === 'family';
    setPricesDialog({ open: true, title: isFamily ? 'Family Prices' : 'Product Prices', product: null, loading: true });
    if (priceSets === null) priceSetService.getPriceSets().then((r) => setPriceSets(r?.priceSets || r || [])).catch(() => setPriceSets([]));
    if (outlets === null) outletService.getAllOutlets().then((r) => setOutlets(r?.outlets || r || [])).catch(() => setOutlets([]));
    try {
      let product = null;
      if (isFamily) {
        const res = await classificationService.getClassificationProducts(rule.entityId);
        product = (res?.assignedProducts || [])[0] || { prices: [] };
      } else {
        const res = await productService.getProduct(rule.entityId);
        product = res?.product || { prices: [] };
      }
      setPricesDialog((d) => ({ ...d, product, loading: false }));
    } catch (err) {
      console.error('Error loading prices:', err);
      setPricesDialog((d) => ({ ...d, product: { prices: [] }, loading: false }));
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      if (priceListName !== priceList?.name) {
        await priceListService.updatePriceList(id, { name: priceListName });
        setPriceList((p) => ({ ...p, name: priceListName }));
      }

      await priceListService.savePriceListConfiguration(id, {
        allowHigherPrice,
        allowDiscountingPromotions,
        rules,
        fallbackRule,
      });
      // Reference: Save keeps you on the edit page; the only feedback is the
      // bottom bar dropping to "0 Unsaved Changes" (no banner, no redirect).
      setSavedState(stateOf(priceListName, allowHigherPrice, allowDiscountingPromotions, rules, fallbackRule));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save configuration');
      console.error('Error saving configuration:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      leaveProceedRef.current = () => navigate('/customers/price-lists');
      setLeaveOpen(true);
      return;
    }
    navigate('/customers/price-lists');
  };

  const handleLeave = () => {
    setLeaveOpen(false);
    const proceed = leaveProceedRef.current;
    leaveProceedRef.current = null;
    if (proceed) proceed(); else navigate('/customers/price-lists');
  };

  const openRuleCard = async (rule) => {
    if (activeRuleCard && activeRuleCard.rule.id === rule.id) return;
    let item = searchResults.find(r => r.id === rule.entityId && r.entityType === rule.entityType);
    if (!item && rule.entityType === 'product') {
      try {
        const productRes = await productService.getProduct(rule.entityId);
        const product = productRes.product;
        item = {
          id: product.id,
          name: product.name,
          type: 'Product',
          entityType: 'product',
          cost: product.itemCost || product.cost || product.replacementCost || 0,
          itemCost: product.itemCost,
          replacementCost: product.replacementCost,
        };
      } catch (err) {
        console.error('Error loading product:', err);
      }
    }
    if (!item) {
      item = {
        id: rule.entityId,
        name: rule.entityName,
        type: entityTypeLabel(rule.entityType),
        entityType: rule.entityType,
        cost: rule.cost || (rule.entityType === 'family' ? await familyCost(rule.entityId) : 0),
      };
    }
    const ruleType = rule.entityType === 'product' ? 'product' : 'category';
    if (ruleType === 'category' && rule.pricingMethod &&
        !PRICING_METHODS_WITHOUT_OVERRIDE.some(m => m.value === rule.pricingMethod)) {
      // Override prices are a product-only option: an old non-product rule
      // carrying it is reset to Discount by %.
      const updatedRule = { ...rule, pricingMethod: 'discount_by_percent' };
      setRules(rules.map(r => r.id === rule.id ? updatedRule : r));
      setActiveRuleCard({ type: ruleType, rule: updatedRule, item });
    } else {
      setActiveRuleCard({ type: ruleType, rule, item });
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const trimmedSearch = searchTerm.trim();
  const showTypeMore = trimmedSearch.length > 0 && trimmedSearch.length < MIN_SEARCH_CHARS;
  const showSearchPanel = searchOpen && (showTypeMore || searchResults.length > 0);

  // A card is "changed" (orange dot, reference) when it differs from what was
  // last loaded / saved - added, edited, or (fallback) created.
  const savedRuleById = new Map((savedState?.ruleList || []).map((r) => [r.id, r]));
  const isRuleChanged = (rule, isFallback = false) =>
    Boolean(savedState) && (isFallback ? !sameRule(rule, savedState.fallback) : !sameRule(rule, savedRuleById.get(rule.id)));

  // ---- rule card (left pane) ----
  const renderCard = ({ key, rule, active, typeText, costText, name, onClick, changed = false }) => {
    const [top, bottom] = splitSummary(rule);
    const excluded = Boolean(rule.excludeFromPriceList);
    return (
      <Box
        key={key}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
        sx={{
          ...lineFadeSx,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          mb: 1.5,
          px: 2,
          py: 1.5,
          minHeight: 74,
          boxSizing: 'border-box',
          position: 'relative',
          bgcolor: active ? '#fff' : '#e2e8f0',
          border: `1px solid ${active ? '#000' : '#cbd5e1'}`,
          borderRadius: '8px',
          cursor: 'pointer',
          boxShadow: active ? '0 2px 8px rgba(0,0,0,0.18)' : 'none',
          transition: 'background 0.15s ease, border-color 0.15s ease',
          '&:hover': { bgcolor: '#fff' },
          '&:focus-visible': { outline: '2px solid #5ebbeb', outlineOffset: '-2px' },
        }}
      >
        {/* reference: green "+" (in the list), red "−" when excluded */}
        {excluded
          ? <RemoveIcon sx={{ color: '#e33430', fontSize: 22, flexShrink: 0 }} />
          : <AddIcon sx={{ color: '#32b643', fontSize: 22, flexShrink: 0 }} />}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 12, color: '#6b7280', lineHeight: 1.3 }}>
            {typeText}{costText ? ` – Cost $${money(costText)}` : ''}
          </Typography>
          <Typography sx={{ fontSize: 16, color: '#000', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </Typography>
        </Box>
        <Box sx={{ width: 150, textAlign: 'center', flexShrink: 0, color: '#000' }}>
          <Typography sx={{ fontSize: 16, lineHeight: 1.3, color: top === 'Invalid' ? '#e33430' : 'inherit' }}>{top}</Typography>
          {bottom && <Typography sx={{ fontSize: 16, lineHeight: 1.3 }}>{bottom}</Typography>}
        </Box>
        {/* reference: orange dot top-right on an unsaved card */}
        {changed && (
          <Box aria-label="Unsaved" sx={{ position: 'absolute', top: 10, right: 12, width: 8, height: 8, borderRadius: '50%', bgcolor: '#f6993f' }} />
        )}
      </Box>
    );
  };

  // ---- rule editor (right pane) ----
  const renderEditor = () => {
    if (!activeRuleCard) return null;
    const { type, rule, item } = activeRuleCard;
    const isProduct = type === 'product';
    const isFallback = type === 'fallback';
    const methods = isProduct ? PRICING_METHODS : PRICING_METHODS_WITHOUT_OVERRIDE;
    const method = methods.some((m) => m.value === rule.pricingMethod)
      ? rule.pricingMethod
      : (isProduct ? 'override' : 'discount_by_percent');
    const title = isFallback ? 'All Other Products' : (item?.name || rule.entityName);
    const subtitle = isFallback ? 'Fallback Rule' : (item?.type || entityTypeLabel(rule.entityType));
    const hasPrices = isProduct || rule.entityType === 'family';
    const unitCost = hasPrices ? unitCostOf(rule) : 0;
    const tierInputSx = { ...inputSx, '& .MuiOutlinedInput-root': { ...inputSx['& .MuiOutlinedInput-root'], height: 42 } };
    const outlineButtonSx = (color) => ({
      ...actionButtonSx('#fff'),
      color,
      borderColor: color,
      borderRadius: '8px',
      '&:hover': { bgcolor: color, color: '#fff', borderColor: color },
    });

    return (
      <Box sx={lineFadeSx}>
        {/* Header (reference): "Product – Cost $x" over the name; See Prices / Remove Item */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 2 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 12, color: '#6b7280' }}>
              {subtitle}{hasPrices && unitCost ? ` – Cost $${money(unitCost)}` : ''}
            </Typography>
            <Typography sx={{ fontSize: 20, color: '#000' }}>{title}</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexShrink: 0 }}>
            {hasPrices && (
              <Button startIcon={<EyeIcon />} onClick={() => handleSeePrices(rule)} disableElevation sx={outlineButtonSx('#1c9cf0')}>
                See Prices
              </Button>
            )}
            <Button startIcon={<DeleteIcon />} onClick={() => handleRemoveRule(rule.id)} disableElevation sx={outlineButtonSx('#e33430')}>
              Remove Item
            </Button>
          </Box>
        </Box>

        {!isFallback && (
          <FormControlLabel
            control={
              <ShopfrontSwitch
                checked={rule.excludeFromPriceList || false}
                onChange={(e) => handleUpdateRule('excludeFromPriceList', e.target.checked)}
                sx={switchSx}
              />
            }
            label="Exclude from Price List"
            sx={{ ...toggleLabelSx, mb: 2, display: 'flex' }}
          />
        )}

        {!rule.excludeFromPriceList && (
          <>
            <LabelledSelect label="Pricing Rule" value={method} onChange={(e) => handleChangeMethod(e.target.value)} options={methods} />

            {needsPricingValue(method) && (
              <AmountField
                label="Amount"
                value={rule.pricingValue ?? rule.value ?? ''}
                onChange={(v) => handleUpdateRule('pricingValue', v)}
                method={method}
              />
            )}

            {method === 'override' && (
              <>
                {/* reference: green full-width "+ Add Price Point" ABOVE the table */}
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => handleAddQuantityTier(rule.id)}
                  disableElevation
                  sx={{ ...actionButtonSx('#00c853', '#00b047'), width: '100%', borderRadius: '8px', mb: 2 }}
                >
                  Add Price Point
                </Button>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr 1fr 56px',
                    columnGap: 2,
                    alignItems: 'center',
                    bgcolor: '#5ebbeb',
                    color: '#f8f8f8',
                    fontWeight: 700,
                    fontSize: 16,
                    textAlign: 'center',
                    borderRadius: '12px',
                    height: 51,
                    px: 2,
                    mb: 1.5,
                  }}
                >
                  <Box>Quantity</Box><Box>Price</Box><Box>Cost</Box><Box>%</Box><Box />
                </Box>

                {(rule.quantityTiers || []).map((tier, index) => {
                  const qty = parseFloat(tier.quantity || 0);
                  const cost = qty > 0 ? qty * unitCost : 0;
                  return (
                    <Box key={index} sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 56px', columnGap: 2, alignItems: 'center', px: 2, mb: 1.5 }}>
                      <TextField
                        value={tier.quantity}
                        onChange={(e) => handleUpdateQuantityTier(rule.id, index, 'quantity', e.target.value)}
                        type="number"
                        inputProps={{ min: 1, 'aria-label': 'Quantity' }}
                        sx={tierInputSx}
                      />
                      <TextField
                        value={tier.price}
                        onChange={(e) => handleUpdateQuantityTier(rule.id, index, 'price', e.target.value)}
                        inputProps={{ 'aria-label': 'Price' }}
                        InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                        sx={tierInputSx}
                      />
                      <TextField
                        value={cost > 0 ? cost.toFixed(2) : ''}
                        disabled
                        inputProps={{ 'aria-label': 'Cost' }}
                        InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                        sx={{ ...tierInputSx, '& .MuiOutlinedInput-root.Mui-disabled': { bgcolor: '#d9d9d9' }, '& .Mui-disabled': { WebkitTextFillColor: '#000' } }}
                      />
                      <TextField
                        value={tier.percent || ''}
                        inputProps={{ readOnly: true, 'aria-label': 'Profit %' }}
                        InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                        sx={tierInputSx}
                      />
                      <IconButton
                        aria-label="Remove price"
                        onClick={() => handleRemoveQuantityTier(rule.id, index)}
                        sx={{ width: 42, height: 42, border: '1px solid #e33430', borderRadius: '8px', color: '#e33430', '&:hover': { bgcolor: '#fde8e8' } }}
                      >
                        <DeleteIcon sx={{ fontSize: 20 }} />
                      </IconButton>
                    </Box>
                  );
                })}
              </>
            )}

            {method !== 'override' && (
              <>
                <LabelledSelect
                  label="Minimum Pricing Rule"
                  value={rule.minimumPriceMethod || 'no_minimum'}
                  onChange={(e) => handleUpdateRule('minimumPriceMethod', e.target.value)}
                  options={MINIMUM_PRICE_OPTIONS}
                />

                {needsMinimumPriceValue(rule.minimumPriceMethod) && (
                  <AmountField
                    label="Minimum Amount"
                    value={rule.minimumPriceValue || ''}
                    onChange={(v) => handleUpdateRule('minimumPriceValue', v)}
                    method={rule.minimumPriceMethod}
                  />
                )}
              </>
            )}
          </>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ bgcolor: '#fff' }}>
      <Box sx={{ height: 'calc(100vh - 50px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Grey header band: name, toggles, add buttons */}
        <Box sx={{ bgcolor: '#e2e8f0', px: 2, pt: 2, pb: 1.5, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Typography component="h1" sx={{ fontSize: 20, fontWeight: 700, color: '#000', m: 0 }}>Editing</Typography>
            <Box
              component="input"
              type="text"
              aria-label="Price list name"
              value={priceListName}
              onChange={(e) => setPriceListName(e.target.value)}
              sx={{
                font: 'inherit',
                fontSize: 16,
                height: 46,
                width: 450,
                maxWidth: '100%',
                p: '0 16px',
                border: '1px solid #404040',
                borderRadius: '8px',
                backgroundColor: '#fff',
                color: '#000',
                boxSizing: 'border-box',
                '&:focus': { outline: 'none', borderColor: '#000', borderWidth: 2 },
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <FormControlLabel
                control={<ShopfrontSwitch checked={allowHigherPrice} onChange={(e) => setAllowHigherPrice(e.target.checked)} sx={switchSx} />}
                label="Allow Higher Price"
                sx={toggleLabelSx}
              />
              <FormControlLabel
                control={<ShopfrontSwitch checked={allowDiscountingPromotions} onChange={(e) => setAllowDiscountingPromotions(e.target.checked)} sx={switchSx} />}
                label="Allow Discounting Promotions"
                sx={toggleLabelSx}
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {/* Only one fallback rule is allowed - the button greys out once it exists (reference). */}
              <Button onClick={handleAddFallbackRule} disabled={Boolean(fallbackRule)} disableElevation sx={actionButtonSx('#1c9cf0', '#1686d1')}>
                Add Fallback Rule
              </Button>
              <Button onClick={() => setAddAllCategoriesDialogOpen(true)} disableElevation sx={actionButtonSx('#1c9cf0', '#1686d1')}>
                Add All Categories
              </Button>
            </Box>
          </Box>
        </Box>

        {(error || success) && (
          <Box sx={{ px: 2, pt: 1 }}>
            {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError('')}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 1 }} onClose={() => setSuccess('')}>{success}</Alert>}
          </Box>
        )}

        {/* Two panes */}
        <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Left: search + cards */}
          <Box sx={{ width: '48.5%', flexShrink: 0, bgcolor: '#eef2f7', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <ClickAwayListener onClickAway={() => setSearchOpen(false)}>
              <Box sx={{ p: 1, flexShrink: 0, position: 'relative', zIndex: 3 }}>
                <Box sx={{ position: 'relative' }}>
                  <Box
                    component="input"
                    type="text"
                    ref={searchInputRef}
                    placeholder="Search for product, category, brand or tag"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setSearchOpen(true);
                    }}
                    onFocus={() => setSearchOpen(true)}
                    onKeyDown={handleSearchKeyDown}
                    sx={{
                      width: '100%',
                      height: 42,
                      boxSizing: 'border-box',
                      border: '1px solid #404040',
                      borderRadius: '8px',
                      backgroundColor: '#fff',
                      color: '#000',
                      fontSize: 16,
                      fontFamily: 'inherit',
                      padding: '0 3rem 0 1rem',
                      '&:focus': { outline: 'none', borderColor: '#000' },
                      '&::placeholder': { color: '#808080', opacity: 1 },
                    }}
                  />
                  {searchTerm && (
                    <IconButton
                      aria-label="Clear search"
                      onClick={handleClearSearch}
                      sx={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 26, height: 26, p: 0, color: '#404040' }}
                    >
                      <CloseIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  )}

                  {showSearchPanel && (
                    <Paper
                      elevation={0}
                      sx={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        right: 0,
                        zIndex: 2,
                        backgroundColor: '#fff',
                        border: '1px solid #404040',
                        borderRadius: '8px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                        fontSize: 16,
                        maxHeight: 420,
                        overflow: 'auto',
                        py: 1,
                      }}
                    >
                      {showTypeMore ? (
                        <Box sx={{ px: 2, py: 1, color: '#000' }}>Keep Typing to Search...</Box>
                      ) : (
                        RESULT_GROUPS.map((group) => {
                          const items = searchResults.filter((r) => r.entityType === group.key);
                          if (!items.length) return null;
                          return (
                            <Box key={group.key}>
                              <Box sx={{ px: 2, py: 1, fontWeight: 700, color: '#000', borderBottom: '1px solid #e5e7eb' }}>
                                {group.label}
                              </Box>
                              {items.map((item) => {
                                const index = searchResults.indexOf(item);
                                const active = index === highlightIndex;
                                return (
                                  <Box
                                    key={`${item.entityType}-${item.id}`}
                                    ref={active ? activeResultRef : null}
                                    onClick={() => handleAddProductRule(item)}
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 1,
                                      px: 2,
                                      py: 1.5,
                                      cursor: 'pointer',
                                      color: '#000',
                                      backgroundColor: active ? '#7dd3fc' : 'transparent',
                                      '& .matching-search': { fontWeight: 700 },
                                      '&:hover': { backgroundColor: '#7dd3fc' },
                                    }}
                                  >
                                    {item.imageUrl ? (
                                      <Box component="img" src={item.imageUrl} alt="" sx={{ width: 22, height: 22, objectFit: 'cover', flexShrink: 0 }} />
                                    ) : (
                                      <ImageOutlinedIcon sx={{ width: 22, height: 22, flexShrink: 0, color: '#9ca3af' }} />
                                    )}
                                    <Box component="span">{highlightMatch(item.name, trimmedSearch)}</Box>
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
              </Box>
            </ClickAwayListener>

            <Box sx={{ flex: 1, overflow: 'auto', px: 1, pb: `${BOTTOM_BAR_HEIGHT + 16}px` }}>
              {rules.length === 0 && !fallbackRule && (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }}>
                  <Typography sx={{ fontSize: 16, color: '#6b7280' }}>This price list is empty</Typography>
                </Box>
              )}
              {rules.map((rule) =>
                renderCard({
                  key: rule.id,
                  rule,
                  active: Boolean(activeRuleCard && activeRuleCard.rule.id === rule.id),
                  typeText: entityTypeLabel(rule.entityType),
                  costText: ['product', 'family'].includes(rule.entityType) && rule.cost ? rule.cost : null,
                  name: rule.entityName,
                  onClick: () => openRuleCard(rule),
                  changed: isRuleChanged(rule),
                })
              )}
              {fallbackRule &&
                renderCard({
                  key: 'fallback',
                  rule: fallbackRule,
                  active: Boolean(activeRuleCard && activeRuleCard.type === 'fallback'),
                  typeText: 'Fallback Rule',
                  costText: null,
                  name: 'All Other Products',
                  onClick: () => setActiveRuleCard({ type: 'fallback', rule: fallbackRule }),
                  changed: isRuleChanged(fallbackRule, true),
                })}
            </Box>
          </Box>

          {/* Right: editor */}
          <Box sx={{ flex: 1, minWidth: 0, p: 3, pb: `${BOTTOM_BAR_HEIGHT + 16}px`, overflow: 'auto', bgcolor: '#fff' }}>
            {activeRuleCard ? (
              renderEditor()
            ) : (
              <Box
                sx={{
                  height: '100%',
                  minHeight: 320,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px dashed #cbd5e1',
                  borderRadius: '8px',
                  color: '#6b7280',
                  fontSize: 16,
                }}
              >
                Select an item to start editing
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* Dark bottom bar (reference): red Cancel | "N Unsaved Changes" + blue Save */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: BOTTOM_BAR_HEIGHT,
          bgcolor: '#313439',
          px: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 1200,
        }}
      >
        <Button onClick={handleCancel} disableElevation sx={actionButtonSx('#e33430', '#cc2f2a')}>
          Cancel
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography sx={{ color: '#fff', fontSize: 16 }}>
            {changeCount} Unsaved Changes
          </Typography>
          <Button
            onClick={handleSave}
            disabled={saving}
            disableElevation
            startIcon={saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : null}
            sx={{ ...actionButtonSx('#1c9cf0', '#1686d1'), minWidth: 110 }}
          >
            {saving ? 'Saving' : 'Save'}
          </Button>
        </Box>
      </Box>

      {/* Reference raises this before discarding edits (Cancel, Back, sidebar, browser). */}
      <ConfirmDeleteDialog
        open={leaveOpen}
        title="Confirm Leaving"
        message="You have unsaved changes, are you sure you wish to leave?"
        confirmText="Leave"
        onCancel={() => { setLeaveOpen(false); leaveProceedRef.current = null; }}
        onConfirm={handleLeave}
      />

      <Dialog
        open={addAllCategoriesDialogOpen}
        onClose={handleCancelAddAllCategories}
        transitionDuration={200}
        BackdropProps={{ sx: { backgroundColor: 'rgba(0, 0, 0, 0.7)' } }}
        PaperProps={{
          elevation: 0,
          sx: {
            width: 400,
            maxWidth: '92vw',
            overflow: 'hidden',
            bgcolor: '#fff',
            borderRadius: '12px',
            boxShadow: '0 0 30px 0 rgba(0,0,0,.25), 0 15px 30px 0 rgba(0,0,0,.19)',
          },
        }}
      >
        {/* reference: light-blue "? Add All Categories" title bar, same as Create dialog */}
        <Box sx={{ bgcolor: '#bfe6fb', px: 2, py: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography component="span" aria-hidden sx={{ color: '#1c6fa8', fontWeight: 700, fontSize: 22, lineHeight: 1 }}>?</Typography>
          <Typography component="h3" sx={{ color: '#1c6fa8', fontWeight: 700, fontSize: 18, m: 0 }}>
            Add All Categories
          </Typography>
        </Box>
        <DialogContent sx={{ px: 2, pt: 3, pb: 1 }}>
          <Typography component="p" sx={{ m: '0 0 12px', fontSize: 16, color: '#000' }}>
            What options should all the added categories have?
          </Typography>

          <FormControlLabel
            control={
              <ShopfrontSwitch
                checked={categoryDefaults.excludeFromPriceList}
                onChange={(e) => setCategoryDefaults({ ...categoryDefaults, excludeFromPriceList: e.target.checked })}
                sx={switchSx}
              />
            }
            label="Exclude from Price List"
            sx={{ ...toggleLabelSx, mb: 2, display: 'flex' }}
          />

          {/* reference: excluded categories need no rule, so the fields disappear */}
          {!categoryDefaults.excludeFromPriceList && (
            <>
              <LabelledSelect
                label="Pricing Rule"
                value={categoryDefaults.pricingMethod}
                onChange={(e) => setCategoryDefaults({ ...categoryDefaults, pricingMethod: e.target.value, value: '' })}
                options={PRICING_METHODS_WITHOUT_OVERRIDE}
              />

              {needsPricingValue(categoryDefaults.pricingMethod) && (
                <AmountField
                  label="Amount"
                  value={categoryDefaults.value}
                  onChange={(v) => setCategoryDefaults({ ...categoryDefaults, value: v })}
                  method={categoryDefaults.pricingMethod}
                />
              )}

              <LabelledSelect
                label="Minimum Pricing Rule"
                value={categoryDefaults.minimumPriceMethod}
                onChange={(e) => setCategoryDefaults({ ...categoryDefaults, minimumPriceMethod: e.target.value, minimumPriceValue: '' })}
                options={MINIMUM_PRICE_OPTIONS}
              />

              {needsMinimumPriceValue(categoryDefaults.minimumPriceMethod) && (
                <AmountField
                  label="Minimum Amount"
                  value={categoryDefaults.minimumPriceValue}
                  onChange={(v) => setCategoryDefaults({ ...categoryDefaults, minimumPriceValue: v })}
                  method={categoryDefaults.minimumPriceMethod}
                />
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, pt: 1.5, gap: 1.5, justifyContent: 'space-between' }}>
          <Button
            onClick={handleCancelAddAllCategories}
            disableElevation
            sx={{ flex: 1, height: 40, textTransform: 'none', fontWeight: 700, fontSize: 16, borderRadius: '8px', bgcolor: '#d5d5d5', color: '#000', boxShadow: 'none', '&:hover': { bgcolor: '#c4c4c4' } }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmAddAllCategories}
            disableElevation
            sx={{ flex: 1, height: 40, textTransform: 'none', fontWeight: 700, fontSize: 16, borderRadius: '8px', bgcolor: '#1c9cf0', color: '#fff', boxShadow: 'none', '&:hover': { bgcolor: '#1686d1' } }}
          >
            Continue
          </Button>
        </DialogActions>
      </Dialog>

      <ProductPricesDialog
        open={pricesDialog.open}
        onClose={() => setPricesDialog((d) => ({ ...d, open: false }))}
        title={pricesDialog.title}
        product={pricesDialog.product}
        priceSets={priceSets || []}
        outlets={outlets || []}
        selectedOutletId={selectedOutletId}
        loading={pricesDialog.loading}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        title="Remove Rule"
        message={`Are you sure you want to remove the rule for "${deleteTarget?.name || ''}"?`}
        confirmText="Remove"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmRemoveRule}
      />
    </Box>
  );
};

export default PriceListConfiguration;
