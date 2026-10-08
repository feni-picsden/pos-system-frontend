import React, { useState, useEffect } from 'react';
import NumberField from '../../components/Common/NumberField';
import {
  Box,
  Button,
  TextField,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Snackbar,
  Alert,
  Autocomplete,
  Chip,
  InputAdornment
} from '@mui/material';
import {
  Search as SearchIcon,
  Delete as DeleteIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useLocation, useNavigate, useParams, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import promotionService from '../../services/promotionService';
import promotionCategoryService from '../../services/promotionCategoryService';
import CreatableAutocomplete from '../../components/Common/CreatableAutocomplete';
import customerGroupService from '../../services/customerGroupService';
import productService from '../../services/productService';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import useResultKeys, { ACTIVE_ROW_SX } from '../../components/Common/useResultKeys';
import { getBaseTier } from '../../utils/baseTier';

// The reference shows the date as plain text "26/07/2026 19:30:00" with only its own
// clear button — a native datetime-local can neither render that mask nor drop the
// browser's calendar icon, so these are text fields holding the display string.
const pad = (n) => String(n).padStart(2, '0');

const formatDateForInput = (dateString) => {
  if (!dateString) return '';
  const raw = String(dateString).trim();
  // Only read the ISO parts verbatim when the string carries NO timezone. A stored
  // "2026-08-11T18:30:00.000Z" is local 12/08/2026 00:00 — taking its UTC parts
  // shifted the start date a day back on every first edit-load. The view page uses
  // new Date(...) (local), so the Date branch below keeps editor and view in sync.
  const iso = /(Z|[+-]\d{2}:?\d{2})$/.test(raw)
    ? null
    : raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]} ${iso[4] || '00'}:${iso[5] || '00'}:${iso[6] || '00'}`;
  const date = new Date(raw);
  if (isNaN(date.getTime())) return '';
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

// "DD/MM/YYYY HH:mm:ss" -> the "YYYY-MM-DDTHH:mm:ss" the API has always been sent.
const parseDisplayDate = (value) => {
  if (!value) return '';
  const m = String(value).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return String(value).trim();
  return `${m[3]}-${pad(m[2])}-${pad(m[1])}T${pad(m[4] || 0)}:${m[5] || '00'}:${m[6] || '00'}`;
};

// Money to whole cents. Every figure that reaches the Rebate box or the save
// payload goes through this, so a 10% discount on $6.50 is 0.65, never
// 0.6499999999999995.
const roundCents = (n) => Math.round((Number(n) || 0) * 100) / 100;

const ExpressPromotion = () => {
  const navigate = useNavigate();
  const { id: idParam } = useParams();
  // The create wizard hands its answers over in router state WITHOUT writing a record,
  // using ':id' === 'new'. Blanking the id here drops every branch below into the
  // create path, so nothing exists in the list until this editor is saved.
  const draft = useLocation().state?.draft;
  const id = idParam === 'new' ? '' : idParam;
  const { getOutletId } = useAuth();
  // A super admin has user.outletId === null, so getOutletId() alone saved the
  // promotion with outletId null and the list (which filters by the SELECTED outlet)
  // never showed it. Same resolution order the create wizard uses.
  const { selectedOutletId } = useSelectedOutlet();
  const resolveOutletId = () => {
    const fromUser = getOutletId();
    if (fromUser != null && fromUser !== '') return Number(fromUser);
    return selectedOutletId != null ? Number(selectedOutletId) : null;
  };
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const [formData, setFormData] = useState({
    name: '',
    isRecurring: false,
    startDate: '',
    endDate: '',
    categoryId: '',
    availableTo: 'All Customers',
    customerGroupIds: [],
    promotionType: 'Price Override',
    isActive: true,
    items: []
  });

  const [categories, setCategories] = useState([]);
  const [customerGroups, setCustomerGroups] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  // Reference: the top search result is highlighted; Up/Down move, Enter adds it.
  const resultKeys = useResultKeys();
  const [, setSearchLoading] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [simSearch, setSimSearch] = useState('');
  const [simResults, setSimResults] = useState([]);
  const [basket, setBasket] = useState([]);

  const showSnackbarMessage = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  useEffect(() => {
    fetchCategories();
    fetchCustomerGroups();
    if (id) {
      fetchPromotion();
    } else if (draft) {
      setFormData(prev => ({
        ...prev,
        ...draft,
        startDate: formatDateForInput(draft.startDate),
        endDate: formatDateForInput(draft.endDate)
      }));
    }
  }, [id]);

  useEffect(() => {
    if (formData.items.length > 0) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.map(item => {
          if (prev.promotionType === 'Discount Percentage' && item.discountPercentage > 0 && item.normalPrice > 0) {
            // Money is rounded to cents here too: unrounded floats (0.6499999999999995)
            // were shown in the Rebate box and saved to the database as-is.
            const discountDecimal = item.discountPercentage / 100;
            const promoPrice = roundCents(item.normalPrice * (1 - discountDecimal));
            const rebate = roundCents(item.normalPrice - promoPrice);
            const rebatePercentage = (rebate / item.normalPrice) * 100;
            return {
              ...item,
              promoPrice,
              rebate,
              rebatePercentage
            };
          }
          return item;
        })
      }));
    }
  }, [formData.promotionType]);

  const fetchPromotion = async () => {
    try {
      setLoading(true);
      const response = await promotionService.getPromotion(id);
      const promotion = response.promotion || response;
      
      console.log('Fetched promotion:', promotion);
      console.log('Promotion items:', promotion.items);
      
      const itemsWithCost = await Promise.all(
        (promotion.items || []).map(async (item) => {
          let cost = 0;
          let unitNormal = 0;

          console.log('Processing item:', item);

          if (item.product) {
            const product = item.product;
            console.log('Item has product data:', product);
            cost = product.itemCost || product.cost || getBaseTier(product.prices)?.cost || 0;
            unitNormal = getBaseTier(product.prices)?.price || 0;
            console.log('Cost from product data:', cost);
          } else if (item.productId) {
            try {
              const productResponse = await productService.getProduct(item.productId);
              const product = productResponse.product || productResponse;
              console.log('Fetched product:', product);
              cost = product.itemCost || product.cost || getBaseTier(product.prices)?.cost || 0;
              unitNormal = getBaseTier(product.prices)?.price || 0;
              console.log('Cost from fetched product:', cost);
            } catch (error) {
              console.error(`Error fetching product ${item.productId} for cost:`, error);
            }
          }

          // Reference Express: Cost and Normal Price are totals for the line's
          // Quantity (Promo Price is stored as that set's total).
          const qty = item.quantity || 1;
          const processedItem = {
            ...item,
            productId: item.productId,
            productName: item.productName || item.product?.name,
            quantity: qty,
            unitCost: cost,
            unitNormal: unitNormal || ((item.normalPrice || 0) / qty),
            cost: cost * qty,
            normalPrice: unitNormal ? unitNormal * qty : (item.normalPrice || 0),
            promoPrice: item.promoPrice || 0,
            rebate: item.rebate || 0,
            rebatePercentage: item.rebatePercentage || 0,
            discountPercentage: item.discountPercentage || 0
          };
          
          console.log('Processed item:', processedItem);
          return processedItem;
        })
      );

      setFormData({
        name: promotion.name || '',
        isRecurring: promotion.isRecurring || false,
        startDate: formatDateForInput(promotion.startDate),
        endDate: formatDateForInput(promotion.endDate),
        categoryId: promotion.categoryId || '',
        availableTo: promotion.availableTo || 'All Customers',
        customerGroupIds: promotion.customerGroupIds || [],
        // Wizard names map onto the Express types so the Type select is not blank.
        promotionType: ({ 'Buy X for Y': 'Price Override', 'Buy X get Y% off': 'Discount Percentage' })[promotion.promotionType]
          || promotion.promotionType || 'Price Override',
        isActive: promotion.isActive !== false,
        items: itemsWithCost
      });
    } catch (error) {
      console.error('Error fetching promotion:', error);
      showSnackbarMessage('Failed to load promotion', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Inline promotion-category creation from the combobox 'Create "<text>"...' row.
  const handleCreatePromotionCategory = async (name) => {
    const response = await promotionCategoryService.createPromotionCategory({
      name,
      outletId: selectedOutletId != null ? Number(selectedOutletId) : null,
    });
    const created = response?.promotionCategory || response;
    if (!created?.id) return null;
    setCategories((prev) => [...prev, created]);
    return created;
  };

  const fetchCategories = async () => {
    try {
      const outletId = getOutletId();
      const response = await promotionCategoryService.getPromotionCategories(outletId);
      const list = Array.isArray(response)
        ? response
        : Array.isArray(response?.promotionCategories)
          ? response.promotionCategories
          : [];
      setCategories(list);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    }
  };

  const fetchCustomerGroups = async () => {
    try {
      const outletId = getOutletId();
      const response = await customerGroupService.getCustomerGroups(outletId);
      const list = Array.isArray(response)
        ? response
        : Array.isArray(response?.customerGroups)
          ? response.customerGroups
          : [];
      setCustomerGroups(list);
    } catch (error) {
      console.error('Error fetching customer groups:', error);
      setCustomerGroups([]);
    }
  };

  // A Combo Product is an ordinary product row, so every product search here lists
  // them alongside normal products (same grouping the create wizard uses).
  const searchCatalog = async (term) => {
    const query = term.trim();
    if (!query) return [];
    const [products] = await Promise.all([
      productService.getProducts({ search: query, limit: 20 }).then((r) => r?.products || []).catch(() => []),
    ]);
    return [
      ...products.map((p) => ({ ...p, resultType: 'PRODUCT' })),
    ];
  };

  const searchProducts = async (term) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      setSearchResults(await searchCatalog(term));
    } catch (error) {
      console.error('Error searching products:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const searchSimulator = async (term) => {
    if (!term.trim()) {
      setSimResults([]);
      return;
    }
    try {
      setSimResults(await searchCatalog(term));
    } catch (error) {
      console.error('Error searching simulator products:', error);
      setSimResults([]);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const toPromotionItem = (product) => {
    // prices[0] is the oldest price row, which can be a bulk/case tier - read the
    // base (single-unit) tier. Reference Express: Cost, Normal Price and Promo
    // Price are TOTALS for the line's Quantity (48 Corona -> Promo $110), so the
    // per-unit figures are kept to rescale them when the quantity changes.
    const baseTier = getBaseTier(product.prices);
    const unitCost = product.cost || baseTier?.cost || 0;
    const unitNormal = baseTier?.price || 0;
    return {
      productId: product.id,
      productName: product.name,
      quantity: 1,
      unitCost,
      unitNormal,
      cost: unitCost,
      normalPrice: unitNormal,
      promoPrice: 0,
      rebate: 0,
      rebatePercentage: 0,
      discountPercentage: 0
    };
  };

  const handleAddProduct = async (entry) => {
    const products = [entry];

    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        ...products
          .filter(p => !prev.items.some(i => i.productId === p.id))
          .map(toPromotionItem)
      ]
    }));

    setSearchTerm('');
    setSearchResults([]);
  };

  const handleSimulatorAdd = async (entry) => {
    const products = [entry];
    setBasket(prev => {
      const next = [...prev];
      products.forEach((product) => {
        const existing = next.findIndex(row => row.productId === product.id);
        if (existing >= 0) {
          next[existing] = { ...next[existing], quantity: next[existing].quantity + 1 };
        } else {
          next.push({
            productId: product.id,
            productName: product.name,
            quantity: 1,
            price: getBaseTier(product.prices)?.price || 0
          });
        }
      });
      return next;
    });
    setSimSearch('');
    setSimResults([]);
  };

  // The promotion only triggers when EVERY promotion line has its required
  // quantity in the basket (help docs: all criteria must be met).
  const promotionActive = formData.items.length > 0 && formData.items.every((item) => {
    const row = basket.find(b => b.productId === item.productId);
    return row && row.quantity >= (item.quantity || 1);
  });

  // Reference Express (live: 48 Corona = $110, 96 = $220): every COMPLETE set of
  // the line's Quantity sells at its Promo Price (a set total), extra units at
  // the normal price.
  const simulatedTotal = basket.reduce((sum, row) => {
    const promoItem = promotionActive ? formData.items.find(i => i.productId === row.productId) : null;
    if (!promoItem || !(promoItem.promoPrice > 0)) return sum + row.price * row.quantity;
    const setQty = Math.max(1, parseInt(promoItem.quantity, 10) || 1);
    const sets = Math.floor(row.quantity / setQty);
    return sum + sets * promoItem.promoPrice + (row.quantity - sets * setQty) * row.price;
  }, 0);

  const handleRemoveItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const calculateProfit = (item) => {
    const promoPrice = parseFloat(item.promoPrice) || 0;
    const cost = parseFloat(item.cost) || 0;
    
    if (promoPrice === 0) return 0;
    if (cost <= 0) return -100;
    
    const profit = ((promoPrice - cost) / promoPrice) * 100;
    
    if (isNaN(profit) || !isFinite(profit)) return 0;
    
    return profit;
  };

  // Reference Express: Cost, Normal Price, Promo Price and Rebate are all TOTALS
  // for the line's Quantity (14th Day of Xmas: 10 x -196 Grape, Cost $40.49,
  // Normal $51.99, Promo $39.99 -> -1.25%). A quantity change rescales Cost and
  // Normal from the per-unit figures and keeps the discount the same share.
  const handleUpdateItem = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        const qty = Math.max(1, parseInt(updated.quantity, 10) || 1);
        if (field === 'quantity') {
          const unitNormal = Number(item.unitNormal) || ((Number(item.normalPrice) || 0) / Math.max(1, parseInt(item.quantity, 10) || 1));
          const unitCost = Number(item.unitCost) || ((Number(item.cost) || 0) / Math.max(1, parseInt(item.quantity, 10) || 1));
          updated.unitNormal = unitNormal;
          updated.unitCost = unitCost;
          updated.normalPrice = Math.round(unitNormal * qty * 100) / 100;
          updated.cost = Math.round(unitCost * qty * 10000) / 10000;
        }
        const normal = Number(updated.normalPrice) || 0;
        if (!(normal > 0)) return updated;
        const round = roundCents;

        if (formData.promotionType === 'Discount Percentage') {
          if (field === 'discountPercentage' || (field === 'quantity' && updated.discountPercentage > 0)) {
            updated.promoPrice = round(normal * (1 - (Number(updated.discountPercentage) || 0) / 100));
            updated.rebate = round(normal - updated.promoPrice);
            updated.rebatePercentage = (updated.rebate / normal) * 100;
          }
          return updated;
        }
        if (field === 'promoPrice') {
          updated.rebate = round(normal - (Number(value) || 0));
          updated.rebatePercentage = (updated.rebate / normal) * 100;
        } else if (field === 'rebate') {
          updated.promoPrice = round(normal - (Number(value) || 0));
          updated.rebatePercentage = ((Number(value) || 0) / normal) * 100;
        } else if (field === 'rebatePercentage') {
          updated.rebate = round((normal * (Number(value) || 0)) / 100);
          updated.promoPrice = round(normal - updated.rebate);
        } else if (field === 'quantity' && updated.promoPrice > 0) {
          updated.rebate = round(normal - updated.promoPrice);
          updated.rebatePercentage = (updated.rebate / normal) * 100;
        }
        return updated;
      })
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const promotionData = {
        ...formData,
        outletId: resolveOutletId(),
        startDate: parseDisplayDate(formData.startDate),
        endDate: parseDisplayDate(formData.endDate),
        promotionType: formData.promotionType,
        items: formData.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity || 1,
          promoPrice: roundCents(item.promoPrice),
          normalPrice: roundCents(item.normalPrice),
          rebate: roundCents(item.rebate),
          rebatePercentage: item.rebatePercentage || 0,
          discountPercentage: item.discountPercentage || 0,
          discountAmount: roundCents(item.rebate)
        })),
        conditions: {
          criteria: [{
            purchaseType: 'purchase',
            purchaseValue: 1,
            receiveType: formData.promotionType === 'Price Override' ? 'total_price' :
                        formData.promotionType === 'Discount Percentage' ? 'percentage_discount' :
                        'discount',
            receiveValue: 0,
            items: formData.items.map(item => ({
              productId: item.productId,
              rebate: roundCents(item.rebate),
              rebatePercentage: item.rebatePercentage
            }))
          }]
        }
      };

      if (id) {
        await promotionService.updatePromotion(id, promotionData);
        showSnackbarMessage('Promotion updated successfully', 'success');
      } else {
        await promotionService.createPromotion(promotionData);
        showSnackbarMessage('Promotion created successfully', 'success');
      }
      
      setTimeout(() => {
        navigate('/marketing/promotions');
      }, 1000);
    } catch (error) {
      console.error('Error saving promotion:', error);
      const errorMessage = error.response?.data?.error || 'Failed to save promotion';
      showSnackbarMessage(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Reference exposes a 25x24 radius-8 clear button once a value is set.
  const clearAdornment = (value, onClear) => (value ? (
    <InputAdornment position="end">
      <IconButton
        onClick={onClear}
        sx={{ width: 25, height: 24, borderRadius: '8px', p: 0, color: '#676b72' }}
      >
        <CloseIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </InputAdornment>
  ) : null);

  const handleSnackbarClose = () => {
    setSnackbar({ open: false, message: '', severity: 'success' });
  };

  return (
    <Box sx={{ p: 3, pb: '85px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Reference editor renders no page title and no back arrow — the footer
          Cancel button is the only exit. */}
      <Paper sx={{ p: 3, mb: 3,
        '& .MuiOutlinedInput-root': { borderRadius: '8px' },
        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' }
      }}>
        <Typography variant="h6" sx={{ mb: 3 }}>Promotion Details</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControlLabel
              sx={{ ml: 0, gap: 1 }}
              control={
                <ShopfrontSwitch
                  checked={formData.isRecurring}
                  onChange={(e) => handleInputChange('isRecurring', e.target.checked)}
                />
              }
              label="Recurring Promotion"
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Start Date"
              placeholder="DD/MM/YYYY HH:MM:SS"
              value={formData.startDate || ''}
              onChange={(e) => handleInputChange('startDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
              InputProps={{ endAdornment: clearAdornment(formData.startDate, () => handleInputChange('startDate', '')) }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              label="End Date"
              placeholder="DD/MM/YYYY HH:MM:SS"
              value={formData.endDate || ''}
              onChange={(e) => handleInputChange('endDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
              InputProps={{ endAdornment: clearAdornment(formData.endDate, () => handleInputChange('endDate', '')) }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            {/* Reference Category is a searchable, clearable combobox. */}
            <CreatableAutocomplete
              size="small"
              options={categories}
              value={categories.find((c) => c.id === formData.categoryId) || null}
              onChange={(newValue) => handleInputChange('categoryId', newValue?.id || '')}
              onCreate={handleCreatePromotionCategory}
              onError={(err) => showSnackbarMessage(err?.response?.data?.error || 'Failed to create category', 'error')}
              placeholder="Select..."
              textFieldProps={{ label: 'Category' }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Available to</InputLabel>
              <Select
                value={formData.availableTo}
                onChange={(e) => handleInputChange('availableTo', e.target.value)}
                label="Available to"
              >
                <MenuItem value="All Customers">All Customers</MenuItem>
                <MenuItem value="Specific Customer Groups">Specific Customer Groups</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Promotion type</InputLabel>
              <Select
                value={formData.promotionType}
                onChange={(e) => handleInputChange('promotionType', e.target.value)}
                label="Promotion type"
              >
                <MenuItem value="Price Override">Price Override</MenuItem>
                <MenuItem value="Discount Percentage">Discount Percentage</MenuItem>
                <MenuItem value="Discount Amount">Discount Amount</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControlLabel
              sx={{ ml: 0, gap: 1 }}
              control={
                <ShopfrontSwitch
                  checked={formData.isActive}
                  onChange={(e) => handleInputChange('isActive', e.target.checked)}
                />
              }
              label="Active"
            />
          </Grid>
          
          {formData.availableTo === 'Specific Customer Groups' && (
            <Grid item xs={12}>
              <Autocomplete
                multiple
                size="small"
                options={customerGroups}
                getOptionLabel={(option) => option.name}
                value={customerGroups.filter(group => 
                  formData.customerGroupIds.includes(group.id)
                )}
                onChange={(event, newValue) => {
                  handleInputChange('customerGroupIds', newValue.map(group => group.id));
                }}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      variant="outlined"
                      label={option.name}
                      {...getTagProps({ index })}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Customer Groups"
                    placeholder="Select customer groups"
                  />
                )}
              />
            </Grid>
          )}
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Items in Promotion</Typography>
        
        <TextField
          fullWidth
          placeholder="Search for a product or family"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            resultKeys.reset('items');
            searchProducts(e.target.value);
          }}
          onKeyDown={resultKeys.handleKeyDown('items', searchResults, handleAddProduct, () => setSearchResults([]))}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
          }}
          sx={{ mb: 2 }}
        />

        {searchResults.length > 0 && (
          <Paper sx={{ mb: 2, maxHeight: 200, overflow: 'auto' }}>
            {searchResults.map((product, i) => (
              <Box
                key={`${product.resultType}-${product.id}`}
                onClick={() => handleAddProduct(product)}
                sx={{
                  p: 1.5,
                  borderBottom: '1px solid #e0e0e0',
                  cursor: 'pointer',
                  '&:hover': { backgroundColor: '#f5f5f5' },
                  ...(resultKeys.isActive('items', i) ? ACTIVE_ROW_SX : {})
                }}
              >
                <Typography variant="subtitle2">{product.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {`$${(getBaseTier(product.prices)?.price || 0).toFixed(2)}`}
                </Typography>
              </Box>
            ))}
          </Paper>
        )}

        {formData.items.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
            <Typography>No items in promotion</Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#5ebbeb' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>ITEM</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>QUANTITY</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>COST</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>NORMAL PRICE</TableCell>
                  {formData.promotionType === 'Discount Percentage' && (
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>DISCOUNT AMOUNT</TableCell>
                  )}
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>PROMO PRICE</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>REBATE</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>%</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>PROFIT</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {formData.items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Typography variant="subtitle2">{item.productName}</Typography>
                      <Typography variant="caption" color="text.secondary">PRODUCT</Typography>
                    </TableCell>
                    <TableCell>
                      <NumberField
                        int
                        fallback={1}
                        value={item.quantity || 1}
                        onCommit={(n) => handleUpdateItem(index, 'quantity', n)}
                        size="small"
                        sx={{ width: 80 }}
                      />
                    </TableCell>
                    {/* Cost / Normal Price / Promo Price are already TOTALS for the line's
                        quantity (see fetchPromotion + handleUpdateItem); multiplying by the
                        quantity again showed $45 for 3 x $5. */}
                    <TableCell>
                      <Typography variant="body2">${(item.cost || 0).toFixed(2)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">${(item.normalPrice || 0).toFixed(2)}</Typography>
                    </TableCell>
                    {formData.promotionType === 'Discount Percentage' && (
                      <TableCell>
                        <NumberField
                          value={item.discountPercentage || 0}
                          onCommit={(n) => handleUpdateItem(index, 'discountPercentage', n)}
                          size="small"
                          InputProps={{
                            endAdornment: <InputAdornment position="end">%</InputAdornment>
                          }}
                          sx={{ width: 120 }}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      {formData.promotionType === 'Discount Percentage' ? (
                        <Typography variant="body2">${(item.promoPrice || 0).toFixed(2)}</Typography>
                      ) : (
                        <NumberField
                          value={roundCents(item.promoPrice)}
                          onCommit={(totalPromoPrice) => handleUpdateItem(index, 'promoPrice', totalPromoPrice)}
                          size="small"
                          InputProps={{
                            startAdornment: <InputAdornment position="start">$</InputAdornment>
                          }}
                          sx={{ width: 120 }}
                          helperText={item.quantity > 1 ? `Per unit: $${((item.promoPrice || 0) / (item.quantity || 1)).toFixed(2)}` : ''}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <NumberField
                        value={roundCents(item.rebate)}
                        onCommit={(n) => handleUpdateItem(index, 'rebate', n)}
                        size="small"
                        InputProps={{
                          startAdornment: <InputAdornment position="start">$</InputAdornment>
                        }}
                        sx={{ width: 120 }}
                        helperText={item.quantity > 1 ? `Per unit: $${((item.rebate || 0) / (item.quantity || 1)).toFixed(2)}` : ''}
                        label={item.quantity > 1 ? 'Total Rebate' : 'Rebate'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: (item.rebatePercentage || 0) < 0 ? 'error.main' : 'text.primary',
                          fontWeight: 'bold'
                        }}
                      >
                        {(item.rebatePercentage || 0).toFixed(2)}%
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: calculateProfit(item) >= 0 ? 'success.main' : 'error.main',
                          fontWeight: 'bold'
                        }}
                      >
                        {calculateProfit(item).toFixed(2)}%
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveItem(index)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Please note: All figures are inclusive of tax.
        </Typography>
      </Paper>

      {showSimulator && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Promotion Simulator</Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="Search for a product to add to the simulated sale"
            value={simSearch}
            onChange={(e) => {
              setSimSearch(e.target.value);
              resultKeys.reset('sim');
              searchSimulator(e.target.value);
            }}
            onKeyDown={resultKeys.handleKeyDown('sim', simResults, handleSimulatorAdd, () => setSimResults([]))}
            InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
            sx={{ mb: 2 }}
          />

          {simResults.length > 0 && (
            <Paper sx={{ mb: 2, maxHeight: 200, overflow: 'auto' }}>
              {simResults.map((entry, i) => (
                <Box
                  key={`${entry.resultType}-${entry.id}`}
                  onClick={() => handleSimulatorAdd(entry)}
                  sx={{ p: 1.5, borderBottom: '1px solid #e0e0e0', cursor: 'pointer', '&:hover': { backgroundColor: '#f5f5f5' }, ...(resultKeys.isActive('sim', i) ? ACTIVE_ROW_SX : {}) }}
                >
                  <Typography variant="subtitle2">{entry.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {`$${(getBaseTier(entry.prices)?.price || 0).toFixed(2)}`}
                  </Typography>
                </Box>
              ))}
            </Paper>
          )}

          {basket.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Search for a product to build a simulated sale.
            </Typography>
          ) : (
            <>
              {basket.map((row) => {
                const promoItem = promotionActive
                  ? formData.items.find(i => i.productId === row.productId)
                  : null;
                const unit = promoItem && promoItem.promoPrice > 0 ? promoItem.promoPrice : row.price;
                return (
                  <Box key={row.productId} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1, borderBottom: '1px solid #e0e0e0' }}>
                    <TextField
                      type="number"
                      size="small"
                      value={row.quantity}
                      onChange={(e) => {
                        const quantity = parseInt(e.target.value, 10) || 1;
                        setBasket(prev => prev.map(b => (b.productId === row.productId ? { ...b, quantity } : b)));
                      }}
                      sx={{ width: 80 }}
                    />
                    <Typography sx={{ flexGrow: 1 }}>{row.productName}</Typography>
                    <Typography sx={{ fontWeight: 700 }}>${(unit * row.quantity).toFixed(2)}</Typography>
                    <IconButton
                      size="small"
                      onClick={() => setBasket(prev => prev.filter(b => b.productId !== row.productId))}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                );
              })}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                <Typography
                  sx={{ fontWeight: 700, color: promotionActive ? '#16a34a' : '#dc2626' }}
                >
                  {promotionActive ? 'Current Promotion Active' : 'No Promotion Active'}
                </Typography>
                <Typography sx={{ fontWeight: 700 }}>Total: ${simulatedTotal.toFixed(2)}</Typography>
              </Box>
            </>
          )}
        </Paper>
      )}

      <Box sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#5ebbeb',
        px: '16px',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 2,
        zIndex: 1000
      }}>
        <Button
          component={RouterLink} to={'/marketing/promotions'}
          sx={{
            backgroundColor: '#e33430',
            color: '#f8f8f8',
            minWidth: 83,
            height: 53,
            borderRadius: 0,
            fontSize: 16,
            fontWeight: 400,
            textTransform: 'none',
            boxShadow: 'none',
            marginRight: 'auto',
            transition: 'background-color 200ms, color 200ms',
            '&:hover': { backgroundColor: '#e33430', boxShadow: 'none' }
          }}
        >
          Cancel
        </Button>
        <FormControlLabel
          sx={{ mr: 0 }}
          control={
            <ShopfrontSwitch
              checked={showSimulator}
              onChange={(e) => setShowSimulator(e.target.checked)}
            />
          }
          label={<Typography sx={{ color: '#f8f8f8', fontSize: 16 }}>Show Simulator</Typography>}
        />
        <Button
          onClick={handleSave}
          disabled={loading}
          sx={{
            backgroundColor: '#5ebbeb',
            color: '#f8f8f8',
            border: '1px solid #f8f8f8',
            minWidth: 68,
            height: 53,
            borderRadius: 0,
            fontSize: 16,
            fontWeight: 400,
            textTransform: 'none',
            boxShadow: 'none',
            transition: 'background-color 200ms, color 200ms',
            '&:hover': { backgroundColor: '#5ebbeb', boxShadow: 'none' }
          }}
        >
          Save
        </Button>
      </Box>


      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ExpressPromotion;

