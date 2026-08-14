import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ClickAwayListener,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  Visibility as VisibilityIcon,
  ImageOutlined as ImageOutlinedIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import priceListService from '../../services/priceListService';
import classificationService from '../../services/classificationService';
import productService from '../../services/productService';
import {
  PRICING_METHODS,
  PRICING_METHODS_WITHOUT_OVERRIDE,
  MINIMUM_PRICE_OPTIONS,
  formatRuleSummary,
} from './ruleLabels';


// Search panel groups, in reference display order (also the keyboard-nav order).
const RESULT_GROUPS = [
  { key: 'product', label: 'Products' },
  { key: 'category', label: 'Categories', classification: 'Category' },
  { key: 'brand', label: 'Brands', classification: 'Brand' },
  { key: 'family', label: 'Families', classification: 'Family' },
  { key: 'tag', label: 'Tags', classification: 'Tag' },
];

const MIN_SEARCH_CHARS = 3;

// Reference button: flat blue, square, inverts to white-on-blue on hover.
const refButtonSx = {
  bgcolor: '#1c86f2',
  color: '#f8f8f8',
  border: '1px solid currentColor',
  borderRadius: 0,
  boxShadow: 'none',
  fontSize: 16,
  fontWeight: 400,
  lineHeight: 1.25,
  textTransform: 'none',
  p: '.5rem',
  transition: 'background 0.2s ease, color 0.2s ease',
  '&:hover': { bgcolor: '#f8f8f8', color: '#1c86f2', boxShadow: 'none' },
};

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
  (productsRes?.products || [])
    .filter((p) => p.name?.toLowerCase().includes(q))
    .slice(0, 50)
    .forEach((p) =>
      results.push({
        id: p.id,
        name: p.name,
        type: 'Product',
        entityType: 'product',
        cost: p.cost || p.replacementCost || 0,
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

const PriceListConfiguration = () => {
  const { id } = useParams();
  const navigate = useNavigate();
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

  // Dirty tracking for the reference's "Confirm Leaving" guard: compare a snapshot
  // of everything Save writes against what was last loaded/saved.
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [leaveOpen, setLeaveOpen] = useState(false);

  const snapshotOf = (name, higher, promos, ruleList, fallback) =>
    JSON.stringify({ name, higher, promos, ruleList, fallback });

  const currentSnapshot = snapshotOf(
    priceListName,
    allowHigherPrice,
    allowDiscountingPromotions,
    rules,
    fallbackRule
  );
  const isDirty = savedSnapshot !== '' && currentSnapshot !== savedSnapshot;

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
      setSavedSnapshot(
        snapshotOf(
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
    }

    const existingRule = rules.find(r => r.entityId === item.id && r.entityType === item.entityType);
    if (existingRule) {
      const updatedRule = { ...existingRule, cost: productCost };
      setRules(rules.map(r => r.id === existingRule.id ? updatedRule : r));
      setActiveRuleCard({ type: 'product', rule: updatedRule, item: productData });
    } else {
      const newRule = {
        id: Date.now(),
        entityType: item.entityType,
        entityId: item.id,
        entityName: item.name,
        excludeFromPriceList: false,
        pricingMethod: 'override',
        quantityTiers: [],
        cost: productCost,
      };
      setRules([...rules, newRule]);
      setActiveRuleCard({ type: 'product', rule: newRule, item: productData });
    }
    closeSearch();
  };

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

  const handleAddAllCategories = () => {
    setAddAllCategoriesDialogOpen(true);
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

  const handleCloseRuleCard = () => {
    setActiveRuleCard(null);
  };

  const handleRemoveRule = (ruleId) => {
    const isFallback = activeRuleCard?.type === 'fallback';
    setDeleteTarget({
      id: ruleId,
      isFallback,
      name: isFallback
        ? 'All Products (not included in another rule)'
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

  const handleAddQuantityTier = (ruleId) => {
    const updatedRules = rules.map(r => {
      if (r.id === ruleId) {
        const newTier = { quantity: '', price: '', cost: 0, percent: '' };
        return {
          ...r,
          quantityTiers: [...(r.quantityTiers || []), newTier]
        };
      }
      return r;
    });
    setRules(updatedRules);
    // Update active rule card
    if (activeRuleCard?.type === 'product' && activeRuleCard.rule.id === ruleId) {
      const updatedRule = updatedRules.find(r => r.id === ruleId);
      if (updatedRule) {
        setActiveRuleCard({ ...activeRuleCard, rule: updatedRule });
      }
    }
  };

  const handleRemoveQuantityTier = (ruleId, tierIndex) => {
    const updatedRules = rules.map(r => {
      if (r.id === ruleId) {
        const newTiers = [...(r.quantityTiers || [])];
        newTiers.splice(tierIndex, 1);
        return { ...r, quantityTiers: newTiers };
      }
      return r;
    });
    setRules(updatedRules);
    // Update active rule card
    if (activeRuleCard?.type === 'product' && activeRuleCard.rule.id === ruleId) {
      const updatedRule = updatedRules.find(r => r.id === ruleId);
      if (updatedRule) {
        setActiveRuleCard({ ...activeRuleCard, rule: updatedRule });
      }
    }
  };

  const handleUpdateQuantityTier = (ruleId, tierIndex, field, value) => {
    const updatedRules = rules.map(r => {
      if (r.id === ruleId) {
        const newTiers = [...(r.quantityTiers || [])];
        newTiers[tierIndex] = { ...newTiers[tierIndex], [field]: value };
        const rule = rules.find(r => r.id === ruleId);
        const unitCost = rule?.cost || activeRuleCard?.item?.cost || activeRuleCard?.item?.itemCost || 0;
        
        if (field === 'quantity' && value) {
          newTiers[tierIndex].cost = parseFloat(value) * unitCost;
        } else if (field === 'quantity' && !value) {
          newTiers[tierIndex].cost = 0;
        }
        
        const quantity = parseFloat(newTiers[tierIndex].quantity || 0);
        const price = parseFloat(newTiers[tierIndex].price || 0);
        const cost = quantity > 0 ? quantity * unitCost : 0;
        
        if (price > 0 && cost > 0) {
          const profitPercent = ((price - cost) / price) * 100;
          newTiers[tierIndex].percent = profitPercent.toFixed(2);
        } else if (field === 'price' && price > 0 && quantity > 0) {
          const calculatedCost = quantity * unitCost;
          if (calculatedCost > 0) {
            const profitPercent = ((price - calculatedCost) / price) * 100;
            newTiers[tierIndex].percent = profitPercent.toFixed(2);
            newTiers[tierIndex].cost = calculatedCost;
          }
        } else if (!price || !quantity) {
          newTiers[tierIndex].percent = '';
        }
        
        return { ...r, quantityTiers: newTiers };
      }
      return r;
    });
    setRules(updatedRules);
    // Update active rule card
    if (activeRuleCard?.type === 'product' && activeRuleCard.rule.id === ruleId) {
      const updatedRule = updatedRules.find(r => r.id === ruleId);
      if (updatedRule) {
        setActiveRuleCard({ ...activeRuleCard, rule: updatedRule });
      }
    }
  };

  const handleUpdateRule = (field, value) => {
    if (activeRuleCard?.type === 'fallback') {
      const updatedFallback = { ...fallbackRule, [field]: value };
      setFallbackRule(updatedFallback);
      setActiveRuleCard({ ...activeRuleCard, rule: updatedFallback });
    } else if (activeRuleCard?.type === 'product') {
      const updatedRules = rules.map(r =>
        r.id === activeRuleCard.rule.id ? { ...r, [field]: value } : r
      );
      setRules(updatedRules);
      setActiveRuleCard({
        ...activeRuleCard,
        rule: { ...activeRuleCard.rule, [field]: value }
      });
    } else if (activeRuleCard?.type === 'category') {
      const updatedRules = rules.map(r => {
        if (r.id === activeRuleCard.rule.id) {
          return { ...r, [field]: value };
        }
        return r;
      });
      setRules(updatedRules);
      const updatedRule = updatedRules.find(r => r.id === activeRuleCard.rule.id);
      if (updatedRule) {
        setActiveRuleCard({
          ...activeRuleCard,
          rule: updatedRule
        });
      }
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      
      if (priceListName !== priceList?.name) {
        await priceListService.updatePriceList(id, { name: priceListName });
      }

      await priceListService.savePriceListConfiguration(id, {
        allowHigherPrice,
        allowDiscountingPromotions,
        rules,
        fallbackRule,
      });
      setSavedSnapshot(currentSnapshot);
      setSuccess('Price list configuration saved successfully!');
      setTimeout(() => {
        navigate('/customers/price-lists');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save configuration');
      console.error('Error saving configuration:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      setLeaveOpen(true);
      return;
    }
    navigate('/customers/price-lists');
  };

  const getPricingMethodAdornment = (method) => {
    if (!method || method === 'override' || method === 'cost') return null;
    if (method.includes('dollar') || method.includes('$') || method === 'discount_total_by_dollar' || method === 'discount_each_by_dollar' || method === 'cost_plus_dollar' || method === 'last_cost_plus_dollar') {
      return <InputAdornment position="start">$</InputAdornment>;
    }
    if (method.includes('percent') || method.includes('%') || method === 'discount_by_percent' || method === 'cost_plus_percent' || method === 'last_cost_plus_percent') {
      return <InputAdornment position="end">%</InputAdornment>;
    }
    return <InputAdornment position="end">%</InputAdornment>;
  };

  const needsPricingValue = (method) => {
    return method && method !== 'override' && method !== 'cost';
  };

  const needsMinimumPriceValue = (method) => {
    return method && method !== 'no_minimum' && method !== 'cost';
  };

  const getMinimumPriceAdornment = (method) => {
    if (!method || method === 'no_minimum' || method === 'cost') return null;
    if (method.includes('dollar') || method.includes('$') || method === 'discount_total_by_dollar' || method === 'discount_each_by_dollar' || method === 'cost_plus_dollar' || method === 'last_cost_plus_dollar') {
      return <InputAdornment position="start">$</InputAdornment>;
    }
    if (method.includes('percent') || method.includes('%') || method === 'discount_by_percent' || method === 'cost_plus_percent' || method === 'last_cost_plus_percent') {
      return <InputAdornment position="end">%</InputAdornment>;
    }
    return null;
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

  return (
    <Box sx={{ backgroundColor: 'white' }}>
      {/* The page is its own scroll container — that is what lets the search bar stick. */}
      <Box
        sx={{
          height: 'calc(100vh - 50px)',
          overflow: 'auto',
          backgroundColor: 'white',
          padding: '0 1rem 1rem',
          pb: '96px',
        }}
      >
        <Box
          component="h1"
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            flexWrap: 'wrap',
            gap: '.5rem',
            m: 0,
            py: '1rem',
            fontSize: 32,
            fontWeight: 700,
            color: '#000',
          }}
        >
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleCancel}
            disableElevation
            sx={refButtonSx}
          >
            Back
          </Button>
          <Box component="span">Editing</Box>
          <Box
            component="input"
            type="text"
            aria-label="Price list name"
            value={priceListName}
            onChange={(e) => setPriceListName(e.target.value)}
            sx={{
              font: 'inherit',
              fontWeight: 400,
              height: 56,
              width: 'auto',
              p: '.5rem',
              border: '1px solid #000',
              borderRadius: 0,
              backgroundColor: '#fff',
              color: '#000',
              boxSizing: 'border-box',
              '&:focus': { outline: 'none' },
            }}
          />
        </Box>

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '.5rem',
            maxWidth: 800,
            margin: 'auto',
            mb: '.5rem',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <FormControlLabel
              control={
                <ShopfrontSwitch
                  checked={allowHigherPrice}
                  onChange={(e) => setAllowHigherPrice(e.target.checked)}
                  sx={switchSx}
                />
              }
              label="Allow Higher Price"
              sx={toggleLabelSx}
            />
            <FormControlLabel
              control={
                <ShopfrontSwitch
                  checked={allowDiscountingPromotions}
                  onChange={(e) => setAllowDiscountingPromotions(e.target.checked)}
                  sx={switchSx}
                />
              }
              label="Allow Discounting Promotions"
              sx={toggleLabelSx}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {/* Only one fallback rule is allowed — the button disappears once it exists. */}
            {!fallbackRule && (
              <Button onClick={handleAddFallbackRule} disableElevation sx={{ ...refButtonSx, ml: '.5rem' }}>
                Add Fallback Rule
              </Button>
            )}
            <Button onClick={handleAddAllCategories} disableElevation sx={{ ...refButtonSx, ml: '.5rem' }}>
              Add All Categories
            </Button>
          </Box>
        </Box>

        <ClickAwayListener onClickAway={() => setSearchOpen(false)}>
          <Box
            sx={{
              position: 'sticky',
              top: 0,
              zIndex: 3,
              maxWidth: 900,
              margin: 'auto',
              mb: '1rem',
              backgroundColor: '#fff',
              p: '.25rem',
            }}
          >
            <Box sx={{ position: 'relative' }}>
              <Box
                component="input"
                type="text"
                ref={searchInputRef}
                placeholder="Search for product, category, brand, family or tag"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={handleSearchKeyDown}
                sx={{
                  width: '100%',
                  height: 53,
                  boxSizing: 'border-box',
                  border: '1px solid #000',
                  borderRadius: 0,
                  backgroundColor: '#fff',
                  color: '#000',
                  fontSize: 16,
                  fontFamily: 'inherit',
                  padding: '0 3rem 0 1rem',
                  '&:focus': { outline: 'none' },
                  '&::placeholder': { color: '#808080', opacity: 1 },
                }}
              />
              {searchTerm && (
                <IconButton
                  aria-label="Clear search"
                  onClick={handleClearSearch}
                  sx={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 28,
                    height: 28,
                    p: 0,
                    borderRadius: '50%',
                    color: '#676b72',
                    backgroundColor: '#f8f8f8',
                    '&:hover': { backgroundColor: '#e6e6e6' },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 18 }} />
                </IconButton>
              )}

              {showSearchPanel && (
                <Paper
                  elevation={0}
                  sx={{
                    position: 'absolute',
                    top: 'calc(100% + .5rem)',
                    left: 0,
                    right: 0,
                    zIndex: 2,
                    backgroundColor: '#fff',
                    border: '1px solid #000',
                    borderRadius: 0,
                    boxShadow: 'none',
                    fontSize: '19.2px',
                    maxHeight: 582,
                    overflow: 'auto',
                    padding: '1rem 0',
                  }}
                >
                  {showTypeMore ? (
                    <Box sx={{ padding: '.5rem 1rem', color: '#676b72' }}>Start typing to search...</Box>
                  ) : (
                    RESULT_GROUPS.map((group) => {
                      const items = searchResults.filter((r) => r.entityType === group.key);
                      if (!items.length) return null;
                      return (
                        <Box key={group.key}>
                          <Box
                            sx={{
                              color: '#bdbdbd',
                              pl: '1rem',
                              fontSize: '.9em',
                              textTransform: 'uppercase',
                            }}
                          >
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
                                  gap: '.5rem',
                                  padding: '.5rem 1rem',
                                  cursor: 'pointer',
                                  color: active ? '#f8f8f8' : '#676b72',
                                  backgroundColor: active ? '#5ebbeb' : 'transparent',
                                  '& .matching-search': { color: active ? '#f8f8f8' : '#5ebbeb' },
                                  '&:hover': {
                                    backgroundColor: active ? '#5ebbeb' : '#8bcef1',
                                    color: '#f8f8f8',
                                    '& .matching-search': { color: '#f8f8f8' },
                                  },
                                }}
                              >
                                {item.imageUrl ? (
                                  <Box
                                    component="img"
                                    src={item.imageUrl}
                                    alt=""
                                    sx={{ width: 25, height: 25, objectFit: 'cover', flexShrink: 0 }}
                                  />
                                ) : (
                                  <ImageOutlinedIcon sx={{ width: 25, height: 25, flexShrink: 0 }} />
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

        <Box sx={{ maxWidth: 800, margin: 'auto' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}

        {rules.length === 0 && !fallbackRule && !activeRuleCard && (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            minHeight: '400px',
          }}>
            <Typography variant="h6" sx={{ color: '#9e9e9e', fontWeight: 400 }}>
              This price list is empty
            </Typography>
          </Box>
        )}

        {rules.length > 0 && (
          <Box sx={{ width: '100%' }}>
            {rules.map((rule) => {
              const isActive = activeRuleCard && activeRuleCard.rule.id === rule.id;
              const handleClickRule = async () => {
                if (isActive) {
                  setActiveRuleCard(null);
                } else {
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
                      type: rule.entityType.charAt(0).toUpperCase() + rule.entityType.slice(1),
                      entityType: rule.entityType,
                      cost: rule.cost || 0,
                    };
                  }
                  const ruleType = rule.entityType === 'product' ? 'product' : 'category';
                  if (ruleType === 'category' && rule.pricingMethod && 
                      !PRICING_METHODS_WITHOUT_OVERRIDE.some(m => m.value === rule.pricingMethod)) {
                    const updatedRule = { ...rule, pricingMethod: 'discount_by_percent' };
                    const updatedRules = rules.map(r => r.id === rule.id ? updatedRule : r);
                    setRules(updatedRules);
                    setActiveRuleCard({ type: ruleType, rule: updatedRule, item });
                  } else {
                    setActiveRuleCard({ type: ruleType, rule, item });
                  }
                }
              };

              return (
                <Box key={rule.id} sx={{ mb: 2, ...lineFadeSx }}>
                  {!isActive && (
                    <Paper
                      sx={{
                        p: 2,
                        cursor: 'pointer',
                        '&:hover': { boxShadow: 3 },
                      }}
                      onClick={handleClickRule}
                    >
                      {/* Reference collapses a rule to name + its computed summary
                          ("Last Cost + 9.00%"), so the row reads without expanding. */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                        <Box>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {rule.entityName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {rule.entityType.charAt(0).toUpperCase() + rule.entityType.slice(1)}
                          </Typography>
                        </Box>
                        <Typography
                          variant="body1"
                          sx={{ color: rule.excludeFromPriceList ? '#e33430' : '#000' }}
                        >
                          {formatRuleSummary(rule)}
                        </Typography>
                      </Box>
                    </Paper>
                  )}

                  {isActive && activeRuleCard && (
                    <Paper
                      sx={{
                        p: 3,
                        boxShadow: 3,
                        width: '100%',
                      }}
                    >
                      {activeRuleCard.type === 'product' && (
                        <>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                            <Box>
                              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                {activeRuleCard.item?.name || activeRuleCard.rule.entityName}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {activeRuleCard.item?.type || 'Product'}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                              {activeRuleCard.item?.cost && (
                                <Typography variant="body2" sx={{ mr: 2 }}>
                                  Cost ${activeRuleCard.item.cost.toFixed(2)}
                                </Typography>
                              )}
                              <Button
                                startIcon={<CloseIcon />}
                                onClick={handleCloseRuleCard}
                                sx={{
                                  backgroundColor: '#1976d2',
                                  color: 'white',
                                  '&:hover': { backgroundColor: '#1565c0' },
                                }}
                              >
                                Close
                              </Button>
                              <Button
                                startIcon={<VisibilityIcon />}
                                sx={{
                                  backgroundColor: 'white',
                                  color: '#1976d2',
                                  border: '1px solid #1976d2',
                                  '&:hover': { backgroundColor: '#f5f5f5' },
                                }}
                              >
                                See Prices
                              </Button>
                              <Button
                                startIcon={<DeleteIcon />}
                                onClick={() => handleRemoveRule(activeRuleCard.rule.id)}
                                sx={{
                                  backgroundColor: 'white',
                                  color: '#f44336',
                                  border: '1px solid #f44336',
                                  '&:hover': { backgroundColor: '#ffebee' },
                                }}
                              >
                                Remove
                              </Button>
                            </Box>
                          </Box>

                          <FormControlLabel
                            control={
                              <ShopfrontSwitch
                                checked={activeRuleCard.rule.excludeFromPriceList || false}
                                onChange={(e) => handleUpdateRule('excludeFromPriceList', e.target.checked)}
                                sx={switchSx}
                              />
                            }
                            label="Exclude from Price List"
                            sx={{ ...toggleLabelSx, mb: 2 }}
                          />

                          <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Override</InputLabel>
                            <Select
                              value={activeRuleCard.rule.pricingMethod || 'override'}
                              onChange={(e) => handleUpdateRule('pricingMethod', e.target.value)}
                              label="Override"
                            >
                              {PRICING_METHODS.map((method) => (
                                <MenuItem key={method.value} value={method.value}>
                                  {method.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>

                          {needsPricingValue(activeRuleCard.rule.pricingMethod) && activeRuleCard.rule.pricingMethod !== 'override' && (
                            <TextField
                              fullWidth
                              label={PRICING_METHODS.find(m => m.value === activeRuleCard.rule.pricingMethod)?.label || 'Value'}
                              value={activeRuleCard.rule.pricingValue || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                  handleUpdateRule('pricingValue', value);
                                }
                              }}
                              onBlur={(e) => {
                                const value = e.target.value.trim();
                                if (value && isNaN(parseFloat(value))) {
                                  handleUpdateRule('pricingValue', '');
                                }
                              }}
                              sx={{ mb: 2 }}
                              type="text"
                              inputProps={{
                                inputMode: 'decimal',
                                pattern: '[0-9]*\\.?[0-9]*',
                              }}
                              error={!!activeRuleCard.rule.pricingValue && isNaN(parseFloat(activeRuleCard.rule.pricingValue))}
                              helperText={activeRuleCard.rule.pricingValue && isNaN(parseFloat(activeRuleCard.rule.pricingValue)) ? 'Please enter a valid number' : ''}
                              InputProps={getPricingMethodAdornment(activeRuleCard.rule.pricingMethod)}
                            />
                          )}

                          {activeRuleCard.rule.pricingMethod === 'override' && (
                            <>
                              <Table sx={{ mb: 2 }}>
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Quantity</TableCell>
                                    <TableCell>Price</TableCell>
                                    <TableCell>Cost</TableCell>
                                    <TableCell>%</TableCell>
                                    <TableCell></TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {(activeRuleCard.rule.quantityTiers || []).map((tier, index) => (
                                    <TableRow key={index}>
                                      <TableCell>
                                        <TextField
                                          size="small"
                                          value={tier.quantity}
                                          onChange={(e) => handleUpdateQuantityTier(activeRuleCard.rule.id, index, 'quantity', e.target.value)}
                                          type="number"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <TextField
                                          size="small"
                                          value={tier.price}
                                          onChange={(e) => handleUpdateQuantityTier(activeRuleCard.rule.id, index, 'price', e.target.value)}
                                          InputProps={{
                                            startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                          }}
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <TextField
                                          size="small"
                                          value={(() => {
                                            const quantity = parseFloat(tier.quantity || 0);
                                            const unitCost = activeRuleCard.item?.cost || activeRuleCard.item?.itemCost || activeRuleCard.rule.cost || 0;
                                            const calculatedCost = quantity * unitCost;
                                            return calculatedCost > 0 ? calculatedCost.toFixed(2) : (tier.cost || 0);
                                          })()}
                                          disabled
                                          InputProps={{
                                            startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                          }}
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <TextField
                                          size="small"
                                          value={tier.percent || ''}
                                          disabled
                                          InputProps={{
                                            endAdornment: <InputAdornment position="end">%</InputAdornment>,
                                          }}
                                          placeholder="Auto"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <IconButton
                                          size="small"
                                          onClick={() => handleRemoveQuantityTier(activeRuleCard.rule.id, index)}
                                          sx={{ color: '#f44336' }}
                                        >
                                          <DeleteIcon />
                                        </IconButton>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  {(!activeRuleCard.rule.quantityTiers || activeRuleCard.rule.quantityTiers.length === 0) && (
                                    <TableRow>
                                      <TableCell colSpan={5} align="center" sx={{ py: 2, color: 'text.secondary' }}>
                                        No pricing tiers added
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </TableBody>
                              </Table>

                              <Button
                                startIcon={<AddIcon />}
                                onClick={() => handleAddQuantityTier(activeRuleCard.rule.id)}
                                sx={{
                                  backgroundColor: '#4caf50',
                                  color: 'white',
                                  '&:hover': { backgroundColor: '#45a049' },
                                  mb: 2,
                                }}
                              >
                                Add Price
                              </Button>
                            </>
                          )}

                          {activeRuleCard.rule.pricingMethod !== 'override' && (
                            <>
                              <FormControl fullWidth sx={{ mb: 2 }}>
                                <InputLabel>Minimum Price</InputLabel>
                                <Select
                                  value={activeRuleCard.rule.minimumPriceMethod || 'no_minimum'}
                                  onChange={(e) => handleUpdateRule('minimumPriceMethod', e.target.value)}
                                  label="Minimum Price"
                                >
                                  {MINIMUM_PRICE_OPTIONS.map((option) => (
                                    <MenuItem key={option.value} value={option.value}>
                                      {option.label}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>

                              {needsMinimumPriceValue(activeRuleCard.rule.minimumPriceMethod) && (
                                <TextField
                                  fullWidth
                                  label="Minimum Price Value"
                                  value={activeRuleCard.rule.minimumPriceValue || ''}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                      handleUpdateRule('minimumPriceValue', value);
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const value = e.target.value.trim();
                                    if (value && isNaN(parseFloat(value))) {
                                      handleUpdateRule('minimumPriceValue', '');
                                    }
                                  }}
                                  sx={{ mb: 2 }}
                                  type="text"
                                  inputProps={{
                                    inputMode: 'decimal',
                                    pattern: '[0-9]*\\.?[0-9]*',
                                  }}
                                  error={!!activeRuleCard.rule.minimumPriceValue && isNaN(parseFloat(activeRuleCard.rule.minimumPriceValue))}
                                  helperText={activeRuleCard.rule.minimumPriceValue && isNaN(parseFloat(activeRuleCard.rule.minimumPriceValue)) ? 'Please enter a valid number' : ''}
                                  InputProps={getMinimumPriceAdornment(activeRuleCard.rule.minimumPriceMethod)}
                                />
                              )}
                            </>
                          )}
                        </>
                      )}

                      {activeRuleCard.type === 'category' && (
                        <>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                            <Box>
                              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                {activeRuleCard.item?.name || activeRuleCard.rule.entityName}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {activeRuleCard.item?.type || activeRuleCard.rule.entityType.charAt(0).toUpperCase() + activeRuleCard.rule.entityType.slice(1)}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                              <Button
                                startIcon={<CloseIcon />}
                                onClick={handleCloseRuleCard}
                                sx={{
                                  backgroundColor: '#1976d2',
                                  color: 'white',
                                  '&:hover': { backgroundColor: '#1565c0' },
                                }}
                              >
                                Close
                              </Button>
                              <Button
                                startIcon={<DeleteIcon />}
                                onClick={() => handleRemoveRule(activeRuleCard.rule.id)}
                                sx={{
                                  backgroundColor: 'white',
                                  color: '#f44336',
                                  border: '1px solid #f44336',
                                  '&:hover': { backgroundColor: '#ffebee' },
                                }}
                              >
                                Remove
                              </Button>
                            </Box>
                          </Box>

                          {/* Categories can be excluded from the price list too, so the
                              fallback rule does not pick them up (fallback itself has no toggle). */}
                          <FormControlLabel
                            control={
                              <ShopfrontSwitch
                                checked={activeRuleCard.rule.excludeFromPriceList || false}
                                onChange={(e) => handleUpdateRule('excludeFromPriceList', e.target.checked)}
                                sx={switchSx}
                              />
                            }
                            label="Exclude from Price List"
                            sx={{ ...toggleLabelSx, mb: 2 }}
                          />

                          <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Discount by %</InputLabel>
                            <Select
                              value={(() => {
                                const currentMethod = activeRuleCard.rule.pricingMethod;
                                if (!currentMethod) return 'discount_by_percent';
                                const isValid = PRICING_METHODS_WITHOUT_OVERRIDE.some(m => m.value === currentMethod);
                                return isValid ? currentMethod : 'discount_by_percent';
                              })()}
                              onChange={(e) => {
                                const newMethod = e.target.value;
                                const updatedRule = { ...activeRuleCard.rule, pricingMethod: newMethod };
                                if (newMethod !== activeRuleCard.rule.pricingMethod) {
                                  updatedRule.value = '';
                                  updatedRule.pricingValue = '';
                                }
                                
                                const updatedRules = rules.map(r => {
                                  if (r.id === activeRuleCard.rule.id) {
                                    return updatedRule;
                                  }
                                  return r;
                                });
                                
                                setRules(updatedRules);
                                setActiveRuleCard({
                                  ...activeRuleCard,
                                  rule: updatedRule
                                });
                              }}
                              label="Discount by %"
                            >
                              {PRICING_METHODS_WITHOUT_OVERRIDE.map((method) => (
                                <MenuItem key={method.value} value={method.value}>
                                  {method.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>

                          {(() => {
                            const currentMethod = activeRuleCard.rule.pricingMethod;
                            const validMethod = currentMethod && PRICING_METHODS_WITHOUT_OVERRIDE.some(m => m.value === currentMethod)
                              ? currentMethod
                              : 'discount_by_percent';
                            return needsPricingValue(validMethod) && (
                              <TextField
                                fullWidth
                                label={PRICING_METHODS_WITHOUT_OVERRIDE.find(m => m.value === validMethod)?.label || 'Value'}
                                value={activeRuleCard.rule.pricingValue ?? activeRuleCard.rule.value ?? ''}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                    handleUpdateRule('pricingValue', value);
                                  }
                                }}
                                onBlur={(e) => {
                                  const value = e.target.value.trim();
                                  if (value && isNaN(parseFloat(value))) {
                                    handleUpdateRule('pricingValue', '');
                                  }
                                }}
                                sx={{ mb: 2 }}
                                type="text"
                                inputProps={{
                                  inputMode: 'decimal',
                                  pattern: '[0-9]*\\.?[0-9]*',
                                }}
                                error={!!activeRuleCard.rule.pricingValue && isNaN(parseFloat(activeRuleCard.rule.pricingValue))}
                                helperText={activeRuleCard.rule.pricingValue && isNaN(parseFloat(activeRuleCard.rule.pricingValue)) ? 'Please enter a valid number' : ''}
                                InputProps={getPricingMethodAdornment(validMethod)}
                              />
                            );
                          })()}

                          <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Minimum Price</InputLabel>
                            <Select
                              value={activeRuleCard.rule.minimumPriceMethod || 'no_minimum'}
                              onChange={(e) => handleUpdateRule('minimumPriceMethod', e.target.value)}
                              label="Minimum Price"
                            >
                              {MINIMUM_PRICE_OPTIONS.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                  {option.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>

                          {needsMinimumPriceValue(activeRuleCard.rule.minimumPriceMethod) && (
                            <TextField
                              fullWidth
                              label="Minimum Price Value"
                              value={activeRuleCard.rule.minimumPriceValue || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                  handleUpdateRule('minimumPriceValue', value);
                                }
                              }}
                              onBlur={(e) => {
                                const value = e.target.value.trim();
                                if (value && isNaN(parseFloat(value))) {
                                  handleUpdateRule('minimumPriceValue', '');
                                }
                              }}
                              type="text"
                              inputProps={{
                                inputMode: 'decimal',
                                pattern: '[0-9]*\\.?[0-9]*',
                              }}
                              error={!!activeRuleCard.rule.minimumPriceValue && isNaN(parseFloat(activeRuleCard.rule.minimumPriceValue))}
                              helperText={activeRuleCard.rule.minimumPriceValue && isNaN(parseFloat(activeRuleCard.rule.minimumPriceValue)) ? 'Please enter a valid number' : ''}
                              InputProps={getMinimumPriceAdornment(activeRuleCard.rule.minimumPriceMethod)}
                            />
                          )}
                        </>
                      )}
                    </Paper>
                  )}
                </Box>
              );
            })}
          </Box>
        )}

        {fallbackRule && (
          <Box sx={{ mb: 2, ...lineFadeSx }}>
            {(!activeRuleCard || activeRuleCard.type !== 'fallback') && (
              <Paper
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  '&:hover': { boxShadow: 3 },
                }}
                onClick={() => setActiveRuleCard({ type: 'fallback', rule: fallbackRule })}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      All Products (not included in another rule)
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Fallback
                    </Typography>
                  </Box>
                  <Typography variant="body1">{formatRuleSummary(fallbackRule)}</Typography>
                </Box>
              </Paper>
            )}
            {activeRuleCard && activeRuleCard.type === 'fallback' && (
              <Paper
                sx={{
                  p: 3,
                  boxShadow: 3,
                  width: '100%',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      All Products (not included in another rule)
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Fallback
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      startIcon={<CloseIcon />}
                      onClick={handleCloseRuleCard}
                      sx={{
                        backgroundColor: '#1976d2',
                        color: 'white',
                        '&:hover': { backgroundColor: '#1565c0' },
                      }}
                    >
                      Close
                    </Button>
                    <Button
                      startIcon={<DeleteIcon />}
                      onClick={() => handleRemoveRule(activeRuleCard.rule.id)}
                      sx={{
                        backgroundColor: 'white',
                        color: '#f44336',
                        border: '1px solid #f44336',
                        '&:hover': { backgroundColor: '#ffebee' },
                      }}
                    >
                      Remove
                    </Button>
                  </Box>
                </Box>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Discount by %</InputLabel>
                  <Select
                    value={activeRuleCard.rule.pricingMethod || 'discount_by_percent'}
                    onChange={(e) => handleUpdateRule('pricingMethod', e.target.value)}
                    label="Discount by %"
                  >
                    {PRICING_METHODS_WITHOUT_OVERRIDE.map((method) => (
                      <MenuItem key={method.value} value={method.value}>
                        {method.label}
                      </MenuItem>
                    ))}
                    </Select>
                  </FormControl>

                {needsPricingValue(activeRuleCard.rule.pricingMethod) && activeRuleCard.rule.pricingMethod !== 'override' && (
                  <TextField
                    fullWidth
                    label={PRICING_METHODS.find(m => m.value === activeRuleCard.rule.pricingMethod)?.label || 'Value'}
                    value={activeRuleCard.rule.pricingValue ?? activeRuleCard.rule.value ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        handleUpdateRule('pricingValue', value);
                      }
                    }}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value && isNaN(parseFloat(value))) {
                        handleUpdateRule('pricingValue', '');
                      }
                    }}
                    sx={{ mb: 2 }}
                    type="text"
                    inputProps={{
                      inputMode: 'decimal',
                      pattern: '[0-9]*\\.?[0-9]*',
                    }}
                    error={!!activeRuleCard.rule.pricingValue && isNaN(parseFloat(activeRuleCard.rule.pricingValue))}
                    helperText={activeRuleCard.rule.pricingValue && isNaN(parseFloat(activeRuleCard.rule.pricingValue)) ? 'Please enter a valid number' : ''}
                    InputProps={getPricingMethodAdornment(activeRuleCard.rule.pricingMethod)}
                  />
                )}

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Minimum Price</InputLabel>
                  <Select
                    value={activeRuleCard.rule.minimumPriceMethod || 'no_minimum'}
                    onChange={(e) => handleUpdateRule('minimumPriceMethod', e.target.value)}
                    label="Minimum Price"
                  >
                    {MINIMUM_PRICE_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                    </Select>
                  </FormControl>

                {needsMinimumPriceValue(activeRuleCard.rule.minimumPriceMethod) && (
                  <TextField
                    fullWidth
                    label="Minimum Price Value"
                    value={activeRuleCard.rule.minimumPriceValue || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        handleUpdateRule('minimumPriceValue', value);
                      }
                    }}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value && isNaN(parseFloat(value))) {
                        handleUpdateRule('minimumPriceValue', '');
                      }
                    }}
                    type="text"
                    inputProps={{
                      inputMode: 'decimal',
                      pattern: '[0-9]*\\.?[0-9]*',
                    }}
                    error={!!activeRuleCard.rule.minimumPriceValue && isNaN(parseFloat(activeRuleCard.rule.minimumPriceValue))}
                    helperText={activeRuleCard.rule.minimumPriceValue && isNaN(parseFloat(activeRuleCard.rule.minimumPriceValue)) ? 'Please enter a valid number' : ''}
                    InputProps={getMinimumPriceAdornment(activeRuleCard.rule.minimumPriceMethod)}
                  />
                )}
              </Paper>
            )}
          </Box>
        )}
        </Box>
      </Box>

      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#87ceeb',
          p: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 1000,
          boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
        }}
      >
        <Button
          onClick={handleCancel}
          sx={{
            backgroundColor: '#f44336',
            color: 'white',
            textTransform: 'none',
            '&:hover': { backgroundColor: '#d32f2f' },
            px: 3,
          }}
        >
          Cancel
        </Button>

        {/* Reference raises this before discarding edits (Cancel or Back). */}
        <Dialog open={leaveOpen} onClose={() => setLeaveOpen(false)}>
          <DialogTitle>Confirm Leaving</DialogTitle>
          <DialogContent>
            <Typography>You have unsaved changes, are you sure you wish to leave?</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setLeaveOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                setLeaveOpen(false);
                navigate('/customers/price-lists');
              }}
              sx={{ color: '#f44336' }}
            >
              Leave
            </Button>
          </DialogActions>
        </Dialog>
        <Button
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={saving}
          sx={{
            backgroundColor: '#1976d2',
            color: 'white',
            textTransform: 'none',
            '&:hover': { backgroundColor: '#1565c0' },
            '&.Mui-disabled': {
              backgroundColor: '#e0e0e0',
              color: '#9e9e9e',
            },
            px: 3,
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>

      <Dialog
        open={addAllCategoriesDialogOpen}
        onClose={handleCancelAddAllCategories}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
          }
        }}
      >
        <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                backgroundColor: '#1976d2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 1,
              }}
            >
              <Typography variant="h4" sx={{ color: 'white', fontWeight: 'bold' }}>
                ?
              </Typography>
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Categories Default
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 3 }}>
            Select the options that you want all the added categories to have.
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

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Discount by %</InputLabel>
            <Select
              value={categoryDefaults.pricingMethod}
              onChange={(e) => {
                setCategoryDefaults({ ...categoryDefaults, pricingMethod: e.target.value, value: '' });
              }}
              label="Discount by %"
            >
              {PRICING_METHODS_WITHOUT_OVERRIDE.map((method) => (
                <MenuItem key={method.value} value={method.value}>
                  {method.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {needsPricingValue(categoryDefaults.pricingMethod) && (
            <TextField
              fullWidth
              label={PRICING_METHODS_WITHOUT_OVERRIDE.find(m => m.value === categoryDefaults.pricingMethod)?.label || 'Value'}
              value={categoryDefaults.value}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setCategoryDefaults({ ...categoryDefaults, value });
                }
              }}
              onBlur={(e) => {
                const value = e.target.value.trim();
                if (value && isNaN(parseFloat(value))) {
                  setCategoryDefaults({ ...categoryDefaults, value: '' });
                }
              }}
              sx={{ mb: 2 }}
              type="text"
              inputProps={{
                inputMode: 'decimal',
                pattern: '[0-9]*\\.?[0-9]*',
              }}
              error={!!categoryDefaults.value && isNaN(parseFloat(categoryDefaults.value))}
              helperText={categoryDefaults.value && isNaN(parseFloat(categoryDefaults.value)) ? 'Please enter a valid number' : ''}
              InputProps={getPricingMethodAdornment(categoryDefaults.pricingMethod)}
            />
          )}

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Minimum Price</InputLabel>
            <Select
              value={categoryDefaults.minimumPriceMethod}
              onChange={(e) => {
                setCategoryDefaults({ ...categoryDefaults, minimumPriceMethod: e.target.value, minimumPriceValue: '' });
              }}
              label="Minimum Price"
            >
              {MINIMUM_PRICE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {needsMinimumPriceValue(categoryDefaults.minimumPriceMethod) && (
            <TextField
              fullWidth
              label="Minimum Price Value"
              value={categoryDefaults.minimumPriceValue}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setCategoryDefaults({ ...categoryDefaults, minimumPriceValue: value });
                }
              }}
              onBlur={(e) => {
                const value = e.target.value.trim();
                if (value && isNaN(parseFloat(value))) {
                  setCategoryDefaults({ ...categoryDefaults, minimumPriceValue: '' });
                }
              }}
              type="text"
              inputProps={{
                inputMode: 'decimal',
                pattern: '[0-9]*\\.?[0-9]*',
              }}
              error={!!categoryDefaults.minimumPriceValue && isNaN(parseFloat(categoryDefaults.minimumPriceValue))}
              helperText={categoryDefaults.minimumPriceValue && isNaN(parseFloat(categoryDefaults.minimumPriceValue)) ? 'Please enter a valid number' : ''}
              InputProps={getMinimumPriceAdornment(categoryDefaults.minimumPriceMethod)}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={handleCancelAddAllCategories}
            sx={{
              backgroundColor: 'white',
              color: 'black',
              border: '1px solid #e0e0e0',
              textTransform: 'none',
              '&:hover': { backgroundColor: '#f5f5f5' },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmAddAllCategories}
            variant="contained"
            sx={{
              backgroundColor: '#1976d2',
              color: 'white',
              textTransform: 'none',
              '&:hover': { backgroundColor: '#1565c0' },
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

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
