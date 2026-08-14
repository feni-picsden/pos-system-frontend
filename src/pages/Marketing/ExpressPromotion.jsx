import React, { useState, useEffect } from 'react';
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
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import promotionService from '../../services/promotionService';
import promotionCategoryService from '../../services/promotionCategoryService';
import customerGroupService from '../../services/customerGroupService';
import productService from '../../services/productService';
import productComboService from '../../services/productComboService';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
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
            const discountDecimal = item.discountPercentage / 100;
            const promoPrice = item.normalPrice * (1 - discountDecimal);
            const rebate = item.normalPrice - promoPrice;
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
          
          console.log('Processing item:', item);
          
          if (item.product) {
            const product = item.product;
            console.log('Item has product data:', product);
            cost = product.itemCost || product.cost || getBaseTier(product.prices)?.cost || 0;
            console.log('Cost from product data:', cost);
          } else if (item.productId) {
            try {
              const productResponse = await productService.getProduct(item.productId);
              const product = productResponse.product || productResponse;
              console.log('Fetched product:', product);
              cost = product.itemCost || product.cost || getBaseTier(product.prices)?.cost || 0;
              console.log('Cost from fetched product:', cost);
            } catch (error) {
              console.error(`Error fetching product ${item.productId} for cost:`, error);
            }
          }
          
          const processedItem = {
            ...item,
            productId: item.productId,
            productName: item.productName || item.product?.name,
            quantity: item.quantity || 1,
            cost: cost,
            normalPrice: item.normalPrice || 0,
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
        promotionType: promotion.promotionType || 'Price Override',
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

  // Product combos are a feature of this app, so every product search here lists
  // them alongside normal products (same grouping the create wizard uses).
  const searchCatalog = async (term) => {
    const query = term.trim();
    if (!query) return [];
    const [products, combos] = await Promise.all([
      productService.getProducts({ search: query, limit: 20 }).then((r) => r?.products || []).catch(() => []),
      productComboService
        .getProductCombos({ search: query, status: 'Active', limit: 20 })
        .then((r) => r?.combos || [])
        .catch(() => [])
    ]);
    return [
      ...products.map((p) => ({ ...p, resultType: 'PRODUCT' })),
      ...combos.map((c) => ({ ...c, resultType: 'COMBO' }))
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
    // prices[0] is the oldest price row, which can be a bulk/case tier — an
    // express promotion is priced per unit, so read the base tier.
    const baseTier = getBaseTier(product.prices);
    return {
      productId: product.id,
      productName: product.name,
      quantity: 1,
      cost: product.cost || baseTier?.cost || 0,
      normalPrice: baseTier?.price || 0,
      promoPrice: 0,
      rebate: 0,
      rebatePercentage: 0,
      discountPercentage: 0
    };
  };

  // A combo is shorthand for its member products: expand it so every promotion
  // row still carries a real productId (what the sell screen matches on).
  const expandCombo = async (selection) => {
    let combo = selection;
    if (!Array.isArray(combo.items) || combo.items.length === 0) {
      combo = await productComboService
        .getProductCombo(selection.id)
        .then((r) => r?.combo || r || selection)
        .catch(() => selection);
    }
    return (combo.items || []).map((i) => i.product).filter(Boolean);
  };

  const handleAddProduct = async (entry) => {
    const products = entry.resultType === 'COMBO' ? await expandCombo(entry) : [entry];

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
    const products = entry.resultType === 'COMBO' ? await expandCombo(entry) : [entry];
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

  const simulatedTotal = basket.reduce((sum, row) => {
    const promoItem = promotionActive ? formData.items.find(i => i.productId === row.productId) : null;
    const unit = promoItem && promoItem.promoPrice > 0 ? promoItem.promoPrice : row.price;
    return sum + unit * row.quantity;
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

  const handleUpdateItem = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i === index) {
          const updated = { ...item, [field]: value };
          
          if (formData.promotionType === 'Discount Percentage') {
            if (field === 'discountPercentage' && updated.normalPrice > 0) {
              const discountDecimal = (value || 0) / 100;
              updated.promoPrice = updated.normalPrice * (1 - discountDecimal);
              const totalNormalPrice = updated.normalPrice * (updated.quantity || 1);
              const totalPromoPrice = updated.promoPrice * (updated.quantity || 1);
              updated.rebate = totalNormalPrice - totalPromoPrice;
              updated.rebatePercentage = (updated.rebate / totalNormalPrice) * 100;
            } else if (field === 'quantity' && updated.normalPrice > 0 && updated.discountPercentage > 0) {
              const discountDecimal = (updated.discountPercentage || 0) / 100;
              updated.promoPrice = updated.normalPrice * (1 - discountDecimal);
              const totalNormalPrice = updated.normalPrice * (updated.quantity || 1);
              const totalPromoPrice = updated.promoPrice * (updated.quantity || 1);
              updated.rebate = totalNormalPrice - totalPromoPrice;
              updated.rebatePercentage = (updated.rebate / totalNormalPrice) * 100;
            }
          } else {
            if (field === 'promoPrice' && updated.normalPrice > 0) {
              const totalNormalPrice = updated.normalPrice * (updated.quantity || 1);
              const totalPromoPrice = value * (updated.quantity || 1);
              const discount = totalNormalPrice - totalPromoPrice;
              updated.rebate = discount;
              updated.rebatePercentage = (discount / totalNormalPrice) * 100;
            } else if (field === 'rebate' && updated.normalPrice > 0) {
              const totalNormalPrice = updated.normalPrice * (updated.quantity || 1);
              const totalPromoPrice = totalNormalPrice - value;
              updated.promoPrice = (updated.quantity || 1) > 0 ? totalPromoPrice / (updated.quantity || 1) : totalPromoPrice;
              updated.rebatePercentage = (value / totalNormalPrice) * 100;
            } else if (field === 'rebatePercentage' && updated.normalPrice > 0) {
              const totalNormalPrice = updated.normalPrice * (updated.quantity || 1);
              const discount = (totalNormalPrice * value) / 100;
              updated.rebate = discount;
              const totalPromoPrice = totalNormalPrice - discount;
              updated.promoPrice = (updated.quantity || 1) > 0 ? totalPromoPrice / (updated.quantity || 1) : totalPromoPrice;
            } else if (field === 'quantity' && updated.normalPrice > 0 && updated.promoPrice > 0) {
              const totalNormalPrice = updated.normalPrice * (updated.quantity || 1);
              const totalPromoPrice = updated.promoPrice * (updated.quantity || 1);
              updated.rebate = totalNormalPrice - totalPromoPrice;
              updated.rebatePercentage = (updated.rebate / totalNormalPrice) * 100;
            }
          }
          return updated;
        }
        return item;
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
          promoPrice: item.promoPrice || 0,
          normalPrice: item.normalPrice || 0,
          rebate: item.rebate || 0,
          rebatePercentage: item.rebatePercentage || 0,
          discountPercentage: item.discountPercentage || 0,
          discountAmount: item.rebate || 0
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
              rebate: item.rebate,
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
          
          <Grid item xs={12} sm={6} md={3}>
            <FormControlLabel
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
            <Autocomplete
              size="small"
              options={categories}
              getOptionLabel={(option) => option?.name || ''}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              value={categories.find((c) => c.id === formData.categoryId) || null}
              onChange={(event, newValue) => handleInputChange('categoryId', newValue?.id || '')}
              renderInput={(params) => (
                <TextField {...params} label="Category" placeholder="Select..." />
              )}
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
          
          <Grid item xs={12} sm={6} md={3}>
            <FormControlLabel
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
            searchProducts(e.target.value);
          }}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
          }}
          sx={{ mb: 2 }}
        />

        {searchResults.length > 0 && (
          <Paper sx={{ mb: 2, maxHeight: 200, overflow: 'auto' }}>
            {searchResults.map((product) => (
              <Box
                key={`${product.resultType}-${product.id}`}
                onClick={() => handleAddProduct(product)}
                sx={{
                  p: 1.5,
                  borderBottom: '1px solid #e0e0e0',
                  cursor: 'pointer',
                  '&:hover': { backgroundColor: '#f5f5f5' }
                }}
              >
                <Typography variant="subtitle2">{product.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {product.resultType === 'COMBO'
                    ? `COMBO · $${(product.totalPrice || 0).toFixed(2)}`
                    : `$${(getBaseTier(product.prices)?.price || 0).toFixed(2)}`}
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
                      <TextField
                        type="number"
                        value={item.quantity || 1}
                        onChange={(e) => handleUpdateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        size="small"
                        sx={{ width: 80 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">${((item.cost || 0) * (item.quantity || 1)).toFixed(2)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">${((item.normalPrice || 0) * (item.quantity || 1)).toFixed(2)}</Typography>
                    </TableCell>
                    {formData.promotionType === 'Discount Percentage' && (
                      <TableCell>
                        <TextField
                          type="number"
                          value={item.discountPercentage || 0}
                          onChange={(e) => handleUpdateItem(index, 'discountPercentage', parseFloat(e.target.value) || 0)}
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
                        <Typography variant="body2">${((item.promoPrice || 0) * (item.quantity || 1)).toFixed(2)}</Typography>
                      ) : (
                        <TextField
                          type="number"
                          value={(item.promoPrice || 0) * (item.quantity || 1)}
                          onChange={(e) => {
                            const totalPromoPrice = parseFloat(e.target.value) || 0;
                            const promoPricePerUnit = (item.quantity || 1) > 0 ? totalPromoPrice / (item.quantity || 1) : totalPromoPrice;
                            handleUpdateItem(index, 'promoPrice', promoPricePerUnit);
                          }}
                          size="small"
                          InputProps={{
                            startAdornment: <InputAdornment position="start">$</InputAdornment>
                          }}
                          sx={{ width: 120 }}
                          helperText={item.quantity > 1 ? `Per unit: $${(item.promoPrice || 0).toFixed(2)}` : ''}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        value={item.rebate || 0}
                        onChange={(e) => handleUpdateItem(index, 'rebate', parseFloat(e.target.value) || 0)}
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
              searchSimulator(e.target.value);
            }}
            InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
            sx={{ mb: 2 }}
          />

          {simResults.length > 0 && (
            <Paper sx={{ mb: 2, maxHeight: 200, overflow: 'auto' }}>
              {simResults.map((entry) => (
                <Box
                  key={`${entry.resultType}-${entry.id}`}
                  onClick={() => handleSimulatorAdd(entry)}
                  sx={{ p: 1.5, borderBottom: '1px solid #e0e0e0', cursor: 'pointer', '&:hover': { backgroundColor: '#f5f5f5' } }}
                >
                  <Typography variant="subtitle2">{entry.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {entry.resultType === 'COMBO'
                      ? `COMBO · $${(entry.totalPrice || 0).toFixed(2)}`
                      : `$${(getBaseTier(entry.prices)?.price || 0).toFixed(2)}`}
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
          onClick={() => navigate('/marketing/promotions')}
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

