import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Grid,
  Switch,
  FormControlLabel,
  FormControl,
  Select,
  MenuItem,
  Paper,
  IconButton,
  Snackbar,
  Alert,
  Autocomplete,
  Chip,
  Checkbox,
  Dialog,
  DialogContent,
  Popover
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  ContentCopy as CloneIcon,
  CheckCircle as CheckCircleIcon,
  EditOutlined as EditOutlinedIcon,
  CalendarMonthOutlined as CalendarMonthOutlinedIcon,
  AccessTimeOutlined as AccessTimeOutlinedIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon
} from '@mui/icons-material';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import promotionService from '../../services/promotionService';
import promotionCategoryService from '../../services/promotionCategoryService';
import customerGroupService from '../../services/customerGroupService';
import productService from '../../services/productService';
import classificationService from '../../services/classificationService';
import productComboService from '../../services/productComboService';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import { getBaseTier } from '../../utils/baseTier';

// --- Recurring schedule helpers -------------------------------------------
// The reference stores every schedule part as a raw ISO 8601 string
// (anchor = date/time, period + duration = ISO durations e.g. P1W / PT2H).
const emptySchedule = () => ({
  anchorDate: '',
  repeatingPeriod: '',
  timeToStart: '',
  enabledDuration: ''
});

const ordinal = (n) => {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
};

// Monday-first grid of the given month, padded with nulls
const monthGrid = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array(lead).fill(null);
  for (let d = 1; d <= days; d += 1) cells.push(new Date(year, month, d));
  return cells;
};

// Monday-first week containing the given date
const weekGrid = (date) => {
  const start = new Date(date);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
};

const isSameDay = (a, b) => !!a && !!b
  && a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

// --- Date/time field helpers ----------------------------------------------
// Values stay in the 'YYYY-MM-DDTHH:mm:ss' shape the API already stores; only
// the on-screen text is the reference's DD/MM/YYYY HH:mm:ss mask.
const pad2 = (n) => String(n).padStart(2, '0');

const toDisplay = (iso) => {
  if (!iso) return '';
  const [datePart, timePart = ''] = String(iso).split('T');
  const [y, m, d] = datePart.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y} ${(timePart.slice(0, 8) || '00:00:00')}`;
};

const fromDisplay = (text) => {
  const m = String(text).trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}T${pad2(m[4] || 0)}:${pad2(m[5] || 0)}:${pad2(m[6] || 0)}`;
};

const toIso = (date, time) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${time}`;

// Reference's in-page date picker: masked editor input, calendar/clock tabs, a
// right-aligned "Current Day" shortcut and two months side by side.
const DateTimeField = ({ value, onChange }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [tab, setTab] = useState('calendar');
  const [text, setText] = useState(toDisplay(value));
  const [month, setMonth] = useState(() => {
    const d = value ? new Date(value) : new Date();
    return isNaN(d.getTime()) ? new Date() : d;
  });

  useEffect(() => { setText(toDisplay(value)); }, [value]);

  const selected = value ? new Date(value) : null;
  const time = (value && String(value).slice(11, 19)) || '00:00:00';
  const [hh, mm, ss] = time.split(':');

  const commitText = () => {
    const iso = fromDisplay(text);
    if (iso) onChange(iso);
    else setText(toDisplay(value));
  };

  const setTimePart = (index, raw) => {
    const parts = time.split(':');
    const max = index === 0 ? 23 : 59;
    parts[index] = pad2(Math.max(0, Math.min(max, parseInt(raw, 10) || 0)));
    const base = selected && !isNaN(selected.getTime()) ? selected : new Date();
    onChange(toIso(base, parts.join(':')));
  };

  const monthLabel = (offset) => {
    const d = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    return { date: d, label: d.toLocaleString('en-AU', { month: 'short', year: 'numeric' }) };
  };

  return (
    <>
      <TextField
        fullWidth
        size="small"
        value={text}
        placeholder="DD/MM/YYYY HH:mm:ss"
        onChange={(e) => setText(e.target.value)}
        onBlur={commitText}
        onKeyDown={(e) => { if (e.key === 'Enter') commitText(); }}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        InputProps={{
          endAdornment: (
            <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
              <CalendarMonthOutlinedIcon fontSize="small" />
            </IconButton>
          )
        }}
        sx={headerFieldSx}
      />
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { borderRadius: 0, boxShadow: 'none', border: '1px solid #d9d9d9', p: 2 } } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex' }}>
            {[['calendar', <CalendarMonthOutlinedIcon key="c" fontSize="small" />],
              ['clock', <AccessTimeOutlinedIcon key="t" fontSize="small" />]].map(([key, icon]) => (
              <Button
                key={key}
                onClick={() => setTab(key)}
                sx={{
                  minWidth: 44,
                  borderRadius: 0,
                  boxShadow: 'none',
                  bgcolor: tab === key ? '#5ebbeb' : '#ececec',
                  color: tab === key ? '#f8f8f8' : '#313439',
                  '&:hover': { bgcolor: tab === key ? '#4aa9dd' : '#e0e0e0', boxShadow: 'none' }
                }}
              >
                {icon}
              </Button>
            ))}
          </Box>
          <Button
            onClick={() => { const now = new Date(); onChange(toIso(now, `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`)); setMonth(now); }}
            sx={{ textTransform: 'none', color: '#5ebbeb', fontWeight: 600 }}
          >
            Current Day
          </Button>
        </Box>

        {tab === 'calendar' ? (
          <Box sx={{ display: 'flex', gap: 3 }}>
            {[0, 1].map((offset) => {
              const { date, label } = monthLabel(offset);
              return (
                <Box key={offset} sx={{ width: 240 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <IconButton
                      size="small"
                      sx={{ visibility: offset === 0 ? 'visible' : 'hidden' }}
                      onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                    >
                      <ChevronLeftIcon fontSize="small" />
                    </IconButton>
                    <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{label}</Typography>
                    <IconButton
                      size="small"
                      sx={{ visibility: offset === 1 ? 'visible' : 'hidden' }}
                      onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                    >
                      <ChevronRightIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                    {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
                      <Typography key={d} sx={{ fontSize: 11, textAlign: 'center', color: '#676b72' }}>{d}</Typography>
                    ))}
                    {monthGrid(date).map((day, i) => {
                      const isSelected = isSameDay(day, selected);
                      return (
                        <Box
                          key={day ? day.toISOString() : `pad-${offset}-${i}`}
                          onClick={day ? () => onChange(toIso(day, time)) : undefined}
                          sx={{
                            minHeight: 30,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            cursor: day ? 'pointer' : 'default',
                            color: isSelected ? '#f8f8f8' : '#313439',
                            bgcolor: day
                              ? (isSelected ? '#5ebbeb' : (isSameDay(day, new Date()) ? '#d6ecfa' : '#ececec'))
                              : 'transparent',
                            transition: 'background 0.2s',
                            '&:hover': day ? { bgcolor: isSelected ? '#4aa9dd' : '#d6ecfa' } : {}
                          }}
                        >
                          {day ? day.getDate() : ''}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              );
            })}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', py: 1 }}>
            {[['Hours', hh, 0], ['Minutes', mm, 1], ['Seconds', ss, 2]].map(([label, val, index]) => (
              <TextField
                key={label}
                size="small"
                type="number"
                label={label}
                value={val}
                onChange={(e) => setTimePart(index, e.target.value)}
                sx={{ width: 100 }}
              />
            ))}
          </Box>
        )}
      </Popover>
    </>
  );
};

// Promotions built by the create wizard / express editor store their contents as
// PromotionItem rows only (conditions.criteria is empty). Fold those rows into the
// criteria this editor edits, so the promotion's contents are visible and re-saveable
// instead of reading "No criteria in promotion".
const receiveFromItem = (item) => {
  const promoPrice = parseFloat(item.promoPrice) || 0;
  const percentage = parseFloat(item.discountPercentage) || 0;
  const amount = parseFloat(item.discountAmount) || 0;
  if (promoPrice > 0) return { receiveType: 'total_price', receiveValue: promoPrice };
  if (percentage > 0) return { receiveType: 'percentage_discount', receiveValue: percentage };
  if (amount > 0) return { receiveType: 'discount_each_item', receiveValue: amount };
  return { receiveType: 'quantity_only', receiveValue: 0 };
};

const criteriaFromItems = (items) => {
  const groups = new Map();
  items.forEach((item, index) => {
    const { receiveType, receiveValue } = receiveFromItem(item);
    const quantity = parseInt(item.quantity, 10) || 1;
    // Wizard "get" rows are isRequired:false — that is the Optional criteria flag
    const isOptional = item.isRequired === false;
    const key = `${quantity}|${receiveType}|${receiveValue}|${isOptional}`;
    if (!groups.has(key)) {
      groups.set(key, {
        id: Date.now() + groups.size,
        isOptional,
        purchaseType: 'purchase',
        purchaseValue: quantity,
        receiveType,
        receiveValue,
        items: [],
        profit: 0
      });
    }
    const price = parseFloat(item.normalPrice)
      || parseFloat(getBaseTier(item.product?.prices)?.price)
      || 0;
    const rebate = parseFloat(item.rebate) || 0;
    groups.get(key).items.push({
      id: item.id ?? Date.now() + 1000 + index,
      productId: item.productId,
      name: item.productName || item.product?.name || 'Unknown Product',
      type: 'PRODUCT',
      sourceLabel: null,
      originalPrice: price,
      pricingTiers: item.product?.prices || [],
      cost: parseFloat(item.product?.cost) || 0,
      rebateAmount: rebate,
      rebatePercentage: price > 0 ? (rebate / price) * 100 : 0,
      excluded: false
    });
  });
  return Array.from(groups.values());
};

// Reference labels its fields above the box (no notched legend, no placeholder)
const LabeledField = ({ label, children }) => (
  <Box>
    <Typography sx={{ fontSize: 14, color: '#676b72', mb: 0.5 }}>{label}</Typography>
    {children}
  </Box>
);

const headerFieldSx = {
  '& .MuiOutlinedInput-root': { minHeight: 42, borderRadius: '8px', backgroundColor: '#fff' }
};

// reference leaves ~10px between the switch and its label
const toggleLabelSx = {
  ml: 0,
  '& .MuiFormControlLabel-label': { ml: '10px', fontSize: 16 }
};

const PromotionDetails = () => {
  const navigate = useNavigate();
  const { id: idParam } = useParams();
  // The create wizard hands its answers over in router state WITHOUT writing a record,
  // using ':id' === 'new'. Blanking the id here drops every branch below into the
  // create path, so nothing exists in the list until this editor is saved.
  const draft = useLocation().state?.draft;
  const id = idParam === 'new' ? '' : idParam;
  const { getOutletId } = useAuth();

  // getOutletId() reads the logged-in user's own outlet and returns null for
  // super admins, who instead pick an outlet in the navbar
  // (SelectedOutletContext persists it to localStorage as 'selectedOutletId').
  // Fall back to that so saves made by super admins stay outlet-scoped.
  const resolveOutletId = () => {
    const fromUser = getOutletId();
    if (fromUser != null && fromUser !== '') return Number(fromUser);
    const saved = localStorage.getItem('selectedOutletId');
    if (saved != null && saved !== '') {
      const parsed = Number.parseInt(saved, 10);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return null;
  };

  const [, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [showSimulator, setShowSimulator] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    isRecurring: false,
    startDate: '',
    endDate: '',
    categoryId: '',
    availableTo: 'All Customers',
    customerGroupIds: [],
    maxApplicationsPerSale: '',
    mixCriteria: false,
    isActive: true,
    // Recurring schedule (ISO 8601 strings), persisted to Promotion.schedule
    schedule: null
  });

  // Edit Schedule modal (shown instead of Start/End Date when Recurring is on)
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedulePreview, setSchedulePreview] = useState('Month');
  const [scheduleDraft, setScheduleDraft] = useState(emptySchedule());
  const [scheduleMonth, setScheduleMonth] = useState(() => new Date());

  // Promotion simulator basket
  const [simBasket, setSimBasket] = useState([]);

  const [categories, setCategories] = useState([]);
  const [customerGroups, setCustomerGroups] = useState([]);

  const [criteria, setCriteria] = useState([]);
  const [searchTerms, setSearchTerms] = useState({});
  const [searchResults, setSearchResults] = useState({});
  const [expandedCriteria, setExpandedCriteria] = useState({});
  const [expandedItems, setExpandedItems] = useState({});

  // Combo Deal state (promotionType === 'Combo Deal')
  const [isComboDeal, setIsComboDeal] = useState(false);
  const [comboItems, setComboItems] = useState([]); // { productId, productName, quantity, unitPrice }
  const [comboPrice, setComboPrice] = useState('');
  const [comboId, setComboId] = useState(null);

  useEffect(() => {
    fetchCategories();
    fetchCustomerGroups();
    if (id) {
      fetchPromotion();
    } else if (draft) {
      setFormData(prev => ({ ...prev, ...draft }));
    }
  }, [id]);

  const fetchPromotion = async () => {
    try {
      setLoading(true);
      const response = await promotionService.getPromotion(id);
      const promotion = response.promotion || response;
      
      const expressTypes = ['Price Override', 'Discount Percentage', 'Discount Amount'];
      if (expressTypes.includes(promotion.promotionType)) {
        navigate(`/marketing/promotions/express/${id}/view`);
        return;
      }
      
      setFormData({
        name: promotion.name || '',
        isRecurring: promotion.isRecurring ?? false,
        // Reference keeps DD/MM/YYYY HH:mm:ss — hold on to the time part too
        startDate: promotion.startDate ? String(promotion.startDate).slice(0, 19) : '',
        endDate: promotion.endDate ? String(promotion.endDate).slice(0, 19) : '',
        categoryId: promotion.categoryId || '',
        availableTo: promotion.availableTo || 'All Customers',
        customerGroupIds: promotion.customerGroupIds || [],
        maxApplicationsPerSale: promotion.maxApplicationsPerSale ?? promotion.conditions?.maxApplicationsPerSale ?? '',
        mixCriteria: promotion.mixCriteria ?? promotion.conditions?.mixCriteria ?? false,
        isActive: promotion.isActive ?? true,
        schedule: promotion.schedule ?? null
      });
      if (promotion.schedule) setScheduleDraft({ ...emptySchedule(), ...promotion.schedule });
      
      const isCombo = promotion.promotionType === 'Combo Deal';
      setIsComboDeal(isCombo);

      if (isCombo) {
        // Hydrate from the canonical conditions.combo block; fall back to the
        // PromotionItem rows if it is missing (normalPrice = unit price,
        // combo price = sum of promoPrice * quantity).
        const comboBlock = promotion.conditions?.combo || null;
        if (comboBlock && Array.isArray(comboBlock.items) && comboBlock.items.length > 0) {
          setComboItems(comboBlock.items.map((it) => ({
            productId: it.productId,
            productName: it.productName || 'Unknown Product',
            quantity: parseInt(it.quantity) || 1,
            unitPrice: parseFloat(it.unitPrice) || 0
          })));
          setComboPrice(comboBlock.comboPrice != null ? String(comboBlock.comboPrice) : '');
          setComboId(comboBlock.comboId ?? null);
        } else {
          const promoItems = Array.isArray(promotion.items) ? promotion.items : [];
          setComboItems(promoItems.map((it) => ({
            productId: it.productId,
            productName: it.productName || it.product?.name || 'Unknown Product',
            quantity: parseInt(it.quantity) || 1,
            unitPrice: parseFloat(it.normalPrice) || 0
          })));
          const derivedPrice = promoItems.reduce(
            (sum, it) => sum + (parseFloat(it.promoPrice) || 0) * (parseInt(it.quantity) || 1),
            0
          );
          setComboPrice(derivedPrice > 0 ? String(Math.round(derivedPrice * 100) / 100) : '');
          setComboId(null);
        }
        setCriteria([]);
      } else {
        // Criteria saved by older builds (and the express editor) can omit the
        // rebate fields, so coerce them here — the rows render them unguarded.
        const savedCriteria = (promotion.conditions?.criteria || []).map((c, i) => ({
          ...c,
          id: c.id ?? Date.now() + i,
          items: (c.items || []).map((item) => ({
            ...item,
            rebateAmount: parseFloat(item.rebateAmount) || 0,
            rebatePercentage: parseFloat(item.rebatePercentage) || 0,
          })),
        }));
        const loadedCriteria = savedCriteria.length === 0 && Array.isArray(promotion.items) && promotion.items.length > 0
          ? criteriaFromItems(promotion.items)
          : savedCriteria;
        setCriteria(loadedCriteria);
        // Match reference: the "Criteria" panel is active (blue) and expanded by default
        const expandedInit = {};
        loadedCriteria.forEach((c) => { expandedInit[c.id] = true; });
        setExpandedCriteria(expandedInit);
      }
    } catch (error) {
      console.error('Error fetching promotion:', error);
      showSnackbar('Failed to load promotion', 'error');
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
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Reference has ONE "Available to" control: a checkbox multi-select of customer
  // groups. availableTo stays derived so the existing API contract is untouched.
  const handleAvailableToChange = (groupIds) => {
    setFormData(prev => ({
      ...prev,
      customerGroupIds: groupIds,
      availableTo: groupIds.length > 0 ? 'Specific Customer Groups' : 'All Customers'
    }));
  };

  const openScheduleDialog = () => {
    setScheduleDraft({ ...emptySchedule(), ...(formData.schedule || {}) });
    const anchor = formData.schedule?.anchorDate ? new Date(formData.schedule.anchorDate) : new Date();
    setScheduleMonth(isNaN(anchor.getTime()) ? new Date() : anchor);
    setScheduleOpen(true);
  };

  const handleScheduleContinue = () => {
    handleInputChange('schedule', { ...scheduleDraft });
    setScheduleOpen(false);
  };

  // The criteria search matches products, classifications AND product combos.
  // A classification or a combo is shorthand for its member products: picking one
  // expands into individual PRODUCT items (see handleAddItemToCriterion) so the
  // rebate/exclude/profit columns and the sell-screen matcher — which keys on
  // productId — keep working unchanged.
  const handleSearch = async (criterionId, searchValue) => {
    setSearchTerms(prev => ({ ...prev, [criterionId]: searchValue }));
    if (searchValue.length <= 2) {
      setSearchResults(prev => ({ ...prev, [criterionId]: [] }));
      return;
    }
    const [products, classifications, combos] = await Promise.all([
      productService.getProducts({ search: searchValue, limit: 20 })
        .then(r => r.products || [])
        .catch(() => []),
      classificationService.getClassifications({ search: searchValue })
        .then(r => r.classifications || [])
        .catch(() => []),
      productComboService.getProductCombos({ search: searchValue, status: 'Active', limit: 20 })
        .then(r => r.combos || [])
        .catch(() => []),
    ]);
    setSearchResults(prev => ({
      ...prev,
      [criterionId]: [
        ...products.map(p => ({ ...p, resultType: 'PRODUCT' })),
        ...classifications.map(c => ({ ...c, resultType: 'CLASSIFICATION' })),
        ...combos.map(c => ({ ...c, resultType: 'COMBO' })),
      ],
    }));
  };

  // ---- Combo Deal handlers ----

  const getDefaultUnitPrice = (product) => {
    if (product?.prices && product.prices.length > 0) {
      const priceForQty1 = product.prices.find(p => p.quantity === 1);
      return parseFloat(priceForQty1 ? priceForQty1.price : (product.prices[0]?.price || 0)) || 0;
    }
    return 0;
  };

  const handleAddComboProduct = (product) => {
    if (!product) return;
    setComboItems(prev => {
      const existingIndex = prev.findIndex(item => item.productId === product.id);
      if (existingIndex >= 0) {
        return prev.map((item, i) =>
          i === existingIndex ? { ...item, quantity: (item.quantity || 1) + 1 } : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: getDefaultUnitPrice(product)
        }
      ];
    });
    setSearchTerms(prev => ({ ...prev, combo: '' }));
    setSearchResults(prev => ({ ...prev, combo: [] }));
  };

  const handleComboItemQuantityChange = (index, value) => {
    const quantity = Math.max(1, parseInt(value) || 1);
    setComboItems(prev => prev.map((item, i) => (i === index ? { ...item, quantity } : item)));
  };

  const handleRemoveComboItem = (index) => {
    setComboItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddCriterion = () => {
    const newCriterion = {
      id: Date.now(),
      isOptional: true,
      purchaseType: 'purchase',
      purchaseValue: 0,
      receiveType: 'total_price',
      receiveValue: 0,
      items: [],
      profit: 0
    };
    setCriteria(prev => [...prev, newCriterion]);
    setExpandedCriteria(prev => ({ ...prev, [newCriterion.id]: true }));
    setExpandedItems(prev => ({ ...prev, [newCriterion.id]: false }));
  };

  const toggleCriteriaExpansion = (criterionId) => {
    setExpandedCriteria(prev => ({
      ...prev,
      [criterionId]: !prev[criterionId]
    }));
    setExpandedItems(prev => ({
      ...prev,
      [criterionId]: false
    }));
  };

  const toggleItemsExpansion = (criterionId) => {
    setExpandedItems(prev => ({
      ...prev,
      [criterionId]: !prev[criterionId]
    }));
    setExpandedCriteria(prev => ({
      ...prev,
      [criterionId]: false
    }));
  };

  const handleUpdateCriterion = (criterionId, field, value) => {
    setCriteria(prev => prev.map(c => {
      if (c.id === criterionId) {
        const updated = { ...c, [field]: value };
        updated.profit = calculateCriterionProfit(updated);
        return updated;
      }
      return c;
    }));
  };

  const buildCriterionItem = (product, sourceLabel, idSeed) => {
    // Criterion maths is per unit, so snapshot the base tier — prices[0] can be
    // a bulk/case tier and would inflate cost and price by the case size.
    const baseTier = getBaseTier(product?.prices);
    let productCost = 0;
    if (product.cost !== undefined && product.cost !== null) {
      productCost = parseFloat(product.cost) || 0;
    } else if (baseTier?.cost !== undefined && baseTier.cost !== null) {
      productCost = parseFloat(baseTier.cost) || 0;
    }

    return {
      id: idSeed,
      productId: product.id,
      name: product.name,
      type: 'PRODUCT',
      sourceLabel: sourceLabel || null,
      originalPrice: baseTier?.price || 0,
      pricingTiers: product.prices || [],
      cost: productCost,
      rebateAmount: 0,
      rebatePercentage: 0,
      excluded: false
    };
  };

  // `result` is a product, a classification or a combo (tagged by handleSearch).
  // Classifications and combos are added as their member products, so a combo in
  // a promotion means "these products", never a phantom item with no productId.
  const resolveResultProducts = async (result) => {
    let products = [];
    let sourceLabel = null;

    if (result.resultType === 'CLASSIFICATION') {
      sourceLabel = `Classification: ${result.name}`;
      try {
        const response = await classificationService.getClassificationProducts(result.id);
        products = response.assignedProducts || [];
      } catch (error) {
        console.error('Error fetching classification products:', error);
      }
      if (products.length === 0) {
        showSnackbar(`"${result.name}" has no products assigned`, 'warning');
        return null;
      }
    } else if (result.resultType === 'COMBO') {
      sourceLabel = `Combo: ${result.name}`;
      let combo = result;
      if (!Array.isArray(combo.items) || combo.items.length === 0) {
        try {
          const response = await productComboService.getProductCombo(result.id);
          combo = response.combo || response;
        } catch (error) {
          console.error('Error fetching combo:', error);
        }
      }
      products = (combo.items || []).map(i => i.product).filter(Boolean);
      if (products.length === 0) {
        showSnackbar(`"${result.name}" has no products in it`, 'warning');
        return null;
      }
    } else {
      let fullProduct = result;
      try {
        const productDetails = await productService.getProduct(result.id);
        fullProduct = productDetails.product || productDetails;
      } catch (error) {
        console.error('Error fetching product details:', error);
      }
      products = [fullProduct];
    }

    return { products, sourceLabel };
  };

  const handleAddItemToCriterion = async (criterionId, result) => {
    const resolved = await resolveResultProducts(result);
    if (!resolved) return;
    const { products, sourceLabel } = resolved;

    setCriteria(prev => prev.map(c => {
      if (c.id !== criterionId) return c;
      const existingIds = new Set(c.items.map(i => String(i.productId)));
      const newItems = products
        .filter(p => p && p.id != null && !existingIds.has(String(p.id)))
        .map((p, idx) => buildCriterionItem(p, sourceLabel, Date.now() + idx));
      if (newItems.length === 0) return c;
      const updated = { ...c, items: [...c.items, ...newItems] };
      updated.profit = calculateCriterionProfit(updated);
      return updated;
    }));

    setSearchTerms(prev => ({ ...prev, [criterionId]: '' }));
    setSearchResults(prev => ({ ...prev, [criterionId]: [] }));
  };

  const handleUpdateItem = (criterionId, itemId, field, value) => {
    setCriteria(prev => prev.map(c => {
      if (c.id === criterionId) {
        const updatedItems = c.items.map(item => {
          if (item.id === itemId) {
            const updated = { ...item, [field]: value };
            if (field === 'rebateAmount') {
              const rebateAmount = parseFloat(value) || 0;
              const originalPrice = item.originalPrice;
              updated.rebatePercentage = originalPrice > 0 ? (rebateAmount / originalPrice) * 100 : 0;
            }
            return updated;
          }
          return item;
        });
        const updated = { ...c, items: updatedItems };
        updated.profit = calculateCriterionProfit(updated);
        return updated;
      }
      return c;
    }));
  };

  const handleRemoveItem = (criterionId, itemId) => {
    setCriteria(prev => prev.map(c => {
      if (c.id === criterionId) {
        const updated = { ...c, items: c.items.filter(item => item.id !== itemId) };
        updated.profit = calculateCriterionProfit(updated);
        return updated;
      }
      return c;
    }));
  };

  const handleRemoveCriterion = (criterionId) => {
    setCriteria(prev => prev.filter(c => c.id !== criterionId));
  };

  const handleCloneCriterion = (criterion) => {
    const cloned = {
      ...criterion,
      id: Date.now(),
      items: criterion.items.map(item => ({ ...item, id: Date.now() + Math.random() }))
    };
    setCriteria(prev => [...prev, cloned]);
  };

  const findPricingTier = (item, quantity) => {
    const basePrice = parseFloat(item.originalPrice) || 0;
    const baseCost = parseFloat(item.cost) || 0;
    
    if (!item.pricingTiers || item.pricingTiers.length === 0) {
      return { 
        price: basePrice, 
        cost: baseCost, 
        quantity: 1,
        pricePerUnit: basePrice,
        costPerUnit: baseCost
      };
    }
    
    const sortedTiers = [...item.pricingTiers].sort((a, b) => (a.quantity || 0) - (b.quantity || 0));
    
    let matchingTier = sortedTiers[0];
    for (let i = sortedTiers.length - 1; i >= 0; i--) {
      if ((sortedTiers[i].quantity || 0) <= quantity) {
        matchingTier = sortedTiers[i];
        break;
      }
    }
    
    const tierQuantity = parseFloat(matchingTier.quantity) || 1;
    const tierPrice = parseFloat(matchingTier.price) || basePrice || 0;
    let tierCost = parseFloat(matchingTier.cost);
    if (isNaN(tierCost) || tierCost === 0) {
      tierCost = baseCost || 0;
    }
    
    const pricePerUnit = tierQuantity > 0 ? tierPrice / tierQuantity : tierPrice;
    const costPerUnit = tierQuantity > 0 ? tierCost / tierQuantity : tierCost;
    
    return {
      price: tierPrice,
      cost: tierCost,
      quantity: tierQuantity,
      pricePerUnit: pricePerUnit,
      costPerUnit: costPerUnit
    };
  };

  const calculateCriterionProfit = (criterion) => {
    if (!criterion.items || criterion.items.length === 0) return 0;
    if (criterion.purchaseValue === 0) return 0;

    const nonExcludedItems = criterion.items.filter(item => !item.excluded);
    if (nonExcludedItems.length === 0) return 0;

    let totalCostForQuantity = 0;
    let totalNormalPriceForQuantity = 0;
    
    nonExcludedItems.forEach(item => {
      const tier = findPricingTier(item, criterion.purchaseValue);
      const pricePerUnit = tier.pricePerUnit || tier.price || item.originalPrice || 0;
      const costPerUnit = tier.costPerUnit || tier.cost || item.cost || 0;
      
      const itemTotalPrice = pricePerUnit * criterion.purchaseValue;
      const itemTotalCost = costPerUnit * criterion.purchaseValue;
      
      totalNormalPriceForQuantity += itemTotalPrice;
      totalCostForQuantity += itemTotalCost;
    });
    
    if (nonExcludedItems.length > 1) {
      totalNormalPriceForQuantity = totalNormalPriceForQuantity / nonExcludedItems.length;
      totalCostForQuantity = totalCostForQuantity / nonExcludedItems.length;
    }
    
    const avgNormalPrice = nonExcludedItems.length > 0 ? totalNormalPriceForQuantity / criterion.purchaseValue : 0;
    const avgCost = nonExcludedItems.length > 0 ? totalCostForQuantity / criterion.purchaseValue : 0;

    if (criterion.receiveType === 'quantity_only') {
      if (totalNormalPriceForQuantity === 0) return 0;
      if (totalCostForQuantity <= 0) return -100;
      const profit = ((totalNormalPriceForQuantity - totalCostForQuantity) / totalNormalPriceForQuantity) * 100;
      if (isNaN(profit) || !isFinite(profit)) return 0;
      return profit;
    }

    if (criterion.receiveType === 'total_price') {
      const promoPrice = parseFloat(criterion.receiveValue) || 0;
      const cost = parseFloat(totalCostForQuantity) || 0;
      
      if (promoPrice === 0) return 0;
      if (cost <= 0) return -100; 
      
      const profit = ((promoPrice - cost) / promoPrice) * 100;
      
      if (isNaN(profit) || !isFinite(profit)) {
        console.error('Invalid profit calculation:', { promoPrice, cost, profit });
        return 0;
      }
      
      return profit;
    }

    if (criterion.receiveType === 'each_item_for') {
      if (criterion.receiveValue === 0 || avgCost === 0) return 0;
      const promoPricePerItem = criterion.receiveValue;
      return ((promoPricePerItem - avgCost) / promoPricePerItem) * 100;
    }

    if (criterion.receiveType === 'discount_each_item') {
      if (criterion.receiveValue === 0 || avgNormalPrice === 0) return 0;
      const promoPricePerItem = avgNormalPrice - criterion.receiveValue;
      if (promoPricePerItem <= 0) return -100;
      return ((promoPricePerItem - avgCost) / promoPricePerItem) * 100;
    }

    if (criterion.receiveType === 'discount_total') {
      if (criterion.receiveValue === 0 || totalNormalPriceForQuantity === 0) return 0;
      const promoPrice = totalNormalPriceForQuantity - criterion.receiveValue;
      if (promoPrice <= 0) return -100;
      return ((promoPrice - totalCostForQuantity) / promoPrice) * 100;
    }

    if (criterion.receiveType === 'percentage_discount') {
      if (criterion.receiveValue === 0 || totalNormalPriceForQuantity === 0) return 0;
      const discountDecimal = criterion.receiveValue / 100;
      const promoPrice = totalNormalPriceForQuantity * (1 - discountDecimal);
      if (promoPrice <= 0) return -100;
      return ((promoPrice - totalCostForQuantity) / promoPrice) * 100;
    }

    if (criterion.receiveType === 'same_sell_rate') {
      if (criterion.receiveValue === 0 || criterion.purchaseValue === 0) return 0;
      const firstItem = nonExcludedItems[0];
      const bulkTier = findPricingTier(firstItem, criterion.receiveValue);
      const bulkPricePerUnit = bulkTier.price;
      const bulkCostPerUnit = bulkTier.cost;
      
      const promoPrice = bulkPricePerUnit * criterion.purchaseValue;
      const totalCost = bulkCostPerUnit * criterion.purchaseValue;
      
      if (promoPrice <= 0) return -100;
      return ((promoPrice - totalCost) / promoPrice) * 100;
    }

    if (criterion.receiveType === 'discount') {
      if (criterion.purchaseType === 'purchase') {
        if (totalNormalPriceForQuantity === 0) return 0;
        const promoPrice = totalNormalPriceForQuantity - criterion.receiveValue;
        if (promoPrice <= 0) return -100;
        return ((promoPrice - totalCostForQuantity) / promoPrice) * 100;
      } else if (criterion.purchaseType === 'spend') {
        if (criterion.purchaseValue === 0) return 0;
        const promoPrice = criterion.purchaseValue - criterion.receiveValue;
        if (promoPrice <= 0) return -100;
        const estimatedCost = promoPrice * 0.7;
        return ((promoPrice - estimatedCost) / promoPrice) * 100;
      }
    }

    return 0;
  };

  const calculateItemProfit = (criterion, item) => {
    if (!item || item.excluded) return 0;
    if (criterion.purchaseValue === 0) return 0;

    const tier = findPricingTier(item, criterion.purchaseValue);
    const pricePerUnit = tier.pricePerUnit || tier.price || item.originalPrice || 0;
    const costPerUnit = tier.costPerUnit || tier.cost || item.cost || 0;
    
    const itemTotalPrice = pricePerUnit * criterion.purchaseValue;
    const itemTotalCost = costPerUnit * criterion.purchaseValue;

    if (criterion.receiveType === 'quantity_only') {
      if (itemTotalPrice === 0) return 0;
      if (itemTotalCost <= 0) return -100;
      const profit = ((itemTotalPrice - itemTotalCost) / itemTotalPrice) * 100;
      if (isNaN(profit) || !isFinite(profit)) return 0;
      return profit;
    }

    if (criterion.receiveType === 'total_price') {
      const promoPrice = parseFloat(criterion.receiveValue) || 0;
      
      if (promoPrice === 0) return 0;
      
      const purchaseQty = parseFloat(criterion.purchaseValue) || 0;
      if (purchaseQty === 0) return 0;
      
      let totalCost = 0;
      
      if (item.pricingTiers && item.pricingTiers.length > 0) {
        const sortedTiers = [...item.pricingTiers].sort((a, b) => {
          const qtyA = parseFloat(a.quantity) || 0;
          const qtyB = parseFloat(b.quantity) || 0;
          return qtyA - qtyB;
        });
        
        const exactTier = sortedTiers.find(t => {
          const tierQty = parseFloat(t.quantity) || 0;
          return tierQty === purchaseQty;
        });
        
        if (exactTier) {
          const tierCost = parseFloat(exactTier.cost);
          if (!isNaN(tierCost) && tierCost > 0) {
            totalCost = tierCost;
          } else {
            const tierPrice = parseFloat(exactTier.price) || 0;
            if (tierPrice > 0) {
              const baseCost = parseFloat(item.cost) || 0;
              const costPerUnit = baseCost > 0 ? baseCost : (tierPrice * 0.7);
              totalCost = costPerUnit * purchaseQty;
            } else {
              const baseCost = parseFloat(item.cost) || 0;
              totalCost = baseCost * purchaseQty;
            }
          }
        } else {
          let bestMatchingTier = sortedTiers[0];
          let bestMatchQty = 0;
          
          for (let i = sortedTiers.length - 1; i >= 0; i--) {
            const tierQty = parseFloat(sortedTiers[i].quantity) || 0;
            if (tierQty <= purchaseQty && tierQty > bestMatchQty) {
              bestMatchingTier = sortedTiers[i];
              bestMatchQty = tierQty;
            }
          }
          
          const tierQuantity = parseFloat(bestMatchingTier.quantity) || 1;
          let tierCost = parseFloat(bestMatchingTier.cost);
          
          if (isNaN(tierCost) || tierCost <= 0) {
            tierCost = parseFloat(item.cost) || 0;
            if (tierCost <= 0) {
              const tierPrice = parseFloat(bestMatchingTier.price) || 0;
              if (tierPrice > 0) {
                tierCost = tierPrice * 0.7;
              }
            }
          }
          
          if (tierQuantity > 0 && tierCost > 0) {
            const costPerUnit = tierCost / tierQuantity;
            totalCost = costPerUnit * purchaseQty;
          } else if (tierCost > 0) {
            totalCost = tierCost * purchaseQty;
          } else {
            const baseCost = parseFloat(item.cost) || 0;
            totalCost = baseCost * purchaseQty;
          }
        }
      } else {
        const baseCost = parseFloat(item.cost) || 0;
        totalCost = baseCost * purchaseQty;
      }
      
      if (totalCost <= 0) return -100;
      
      const profit = ((promoPrice - totalCost) / promoPrice) * 100;
      
      if (isNaN(profit) || !isFinite(profit)) return 0;
      
      return profit;
    }

    if (criterion.receiveType === 'each_item_for') {
      if (criterion.receiveValue === 0 || costPerUnit === 0) return 0;
      const promoPricePerItem = criterion.receiveValue;
      return ((promoPricePerItem - costPerUnit) / promoPricePerItem) * 100;
    }

    if (criterion.receiveType === 'discount_each_item') {
      if (criterion.receiveValue === 0 || pricePerUnit === 0) return 0;
      const promoPricePerItem = pricePerUnit - criterion.receiveValue;
      if (promoPricePerItem <= 0) return -100;
      return ((promoPricePerItem - costPerUnit) / promoPricePerItem) * 100;
    }

    if (criterion.receiveType === 'discount_total') {
      if (criterion.receiveValue === 0 || itemTotalPrice === 0) return 0;
      const promoPrice = itemTotalPrice - criterion.receiveValue;
      if (promoPrice <= 0) return -100;
      return ((promoPrice - itemTotalCost) / promoPrice) * 100;
    }

    if (criterion.receiveType === 'percentage_discount') {
      const purchaseQty = parseFloat(criterion.purchaseValue) || 0;
      if (criterion.receiveValue === 0 || purchaseQty === 0) return 0;
      
      let totalPrice = 0;
      let totalCost = 0;
      
      if (item.pricingTiers && item.pricingTiers.length > 0) {
        const sortedTiers = [...item.pricingTiers].sort((a, b) => {
          const qtyA = parseFloat(a.quantity) || 0;
          const qtyB = parseFloat(b.quantity) || 0;
          return qtyA - qtyB;
        });
        
        const exactTier = sortedTiers.find(t => {
          const tierQty = parseFloat(t.quantity) || 0;
          return tierQty === purchaseQty;
        });
        
        if (exactTier) {
          const tierPrice = parseFloat(exactTier.price) || 0;
          let tierCost = parseFloat(exactTier.cost);
          
          if (tierPrice > 0) {
            totalPrice = tierPrice;
          } else {
            const pricePerUnit = exactTier.pricePerUnit || item.originalPrice || 0;
            totalPrice = pricePerUnit * purchaseQty;
          }
          
          if (!isNaN(tierCost) && tierCost > 0) {
            totalCost = tierCost;
          } else {
            const baseCost = parseFloat(item.cost) || 0;
            if (baseCost > 0) {
              totalCost = baseCost * purchaseQty;
            } else if (tierPrice > 0) {
              totalCost = tierPrice * 0.7;
            } else {
              totalCost = 0;
            }
          }
        } else {
          let bestMatchingTier = sortedTiers[0];
          let bestMatchQty = 0;
          
          for (let i = sortedTiers.length - 1; i >= 0; i--) {
            const tierQty = parseFloat(sortedTiers[i].quantity) || 0;
            if (tierQty <= purchaseQty && tierQty > bestMatchQty) {
              bestMatchingTier = sortedTiers[i];
              bestMatchQty = tierQty;
            }
          }
          
          const tierQuantity = parseFloat(bestMatchingTier.quantity) || 1;
          const tierPrice = parseFloat(bestMatchingTier.price) || 0;
          let tierCost = parseFloat(bestMatchingTier.cost);
          
          if (tierPrice > 0) {
            const pricePerUnit = tierPrice / tierQuantity;
            totalPrice = pricePerUnit * purchaseQty;
          } else {
            const pricePerUnit = bestMatchingTier.pricePerUnit || item.originalPrice || 0;
            totalPrice = pricePerUnit * purchaseQty;
          }
          
          if (isNaN(tierCost) || tierCost <= 0) {
            tierCost = parseFloat(item.cost) || 0;
            if (tierCost <= 0 && tierPrice > 0) {
              tierCost = (tierPrice / tierQuantity) * 0.7;
            }
          }
          
          if (tierQuantity > 0 && tierCost > 0) {
            const costPerUnit = tierCost / tierQuantity;
            totalCost = costPerUnit * purchaseQty;
          } else if (tierCost > 0) {
            totalCost = tierCost * purchaseQty;
          } else {
            const baseCost = parseFloat(item.cost) || 0;
            totalCost = baseCost * purchaseQty;
          }
        }
      } else {
        const basePrice = parseFloat(item.originalPrice) || 0;
        const baseCost = parseFloat(item.cost) || 0;
        totalPrice = basePrice * purchaseQty;
        totalCost = baseCost * purchaseQty;
      }
      
      if (totalPrice === 0) return 0;
      
      const discountDecimal = criterion.receiveValue / 100;
      const promoPrice = totalPrice * (1 - discountDecimal);
      
      if (promoPrice <= 0) return -100;
      if (totalCost <= 0) return -100;
      
      const profit = ((promoPrice - totalCost) / promoPrice) * 100;
      
      if (isNaN(profit) || !isFinite(profit)) return 0;
      
      return profit;
    }

    if (criterion.receiveType === 'discount') {
      if (criterion.purchaseType === 'purchase') {
        if (itemTotalPrice === 0) return 0;
        const promoPrice = itemTotalPrice - criterion.receiveValue;
        if (promoPrice <= 0) return -100;
        if (itemTotalCost <= 0) return -100;
        const profit = ((promoPrice - itemTotalCost) / promoPrice) * 100;
        if (isNaN(profit) || !isFinite(profit)) return 0;
        return profit;
      } else if (criterion.purchaseType === 'spend') {
        if (criterion.purchaseValue === 0) return 0;
        const promoPrice = criterion.purchaseValue - criterion.receiveValue;
        if (promoPrice <= 0) return -100;
        const estimatedCost = promoPrice * 0.7;
        const profit = ((promoPrice - estimatedCost) / promoPrice) * 100;
        if (isNaN(profit) || !isFinite(profit)) return 0;
        return profit;
      }
    }

    if (criterion.receiveType === 'same_sell_rate') {
      if (criterion.receiveValue === 0 || criterion.purchaseValue === 0) return 0;
      const bulkTier = findPricingTier(item, criterion.receiveValue);
      const bulkPricePerUnit = bulkTier.pricePerUnit || bulkTier.price || 0;
      const bulkCostPerUnit = bulkTier.costPerUnit || bulkTier.cost || 0;
      
      const promoPrice = bulkPricePerUnit * criterion.purchaseValue;
      const totalCost = bulkCostPerUnit * criterion.purchaseValue;
      
      if (promoPrice <= 0) return -100;
      return ((promoPrice - totalCost) / promoPrice) * 100;
    }

    return 0;
  };

  const calculateAverageItemProfit = (criterion) => {
    if (!criterion.items || criterion.items.length === 0) return 0;
    
    const nonExcludedItems = criterion.items.filter(item => !item.excluded);
    if (nonExcludedItems.length === 0) return 0;
    let totalProfit = 0;
    let validProfitCount = 0;
    
    nonExcludedItems.forEach(item => {
      const itemProfit = calculateItemProfit(criterion, item);
      if (!isNaN(itemProfit) && isFinite(itemProfit)) {
        totalProfit += itemProfit;
        validProfitCount++;
      }
    });
    
    if (validProfitCount === 0) return 0;
    
    return totalProfit / validProfitCount;
  };

  const getCriterionSummary = (criterion) => {
    const optionalText = criterion.isOptional ? 'Optionally' : '(Required)';
    const purchaseText = criterion.purchaseType === 'purchase' ? 'purchase' : 'spend';
    
    const receiveTextMap = {
      'quantity_only': '(quantity only)',
      'each_item_for': 'each item for',
      'total_price': 'a total price of',
      'discount_each_item': 'a discount on each item worth',
      'discount_total': 'a discount off the total worth',
      'percentage_discount': 'a percentage discount of',
      'same_sell_rate': 'the same sell rate as if the quantity was',
      'discount': 'a discount of',
      'free_item': 'Free Item'
    };
    
    const receiveText = receiveTextMap[criterion.receiveType] || 'a total price of';
    
    if (criterion.purchaseValue === 0 && (criterion.receiveValue === 0 || criterion.receiveType === 'quantity_only')) {
      return `Purchase 0 to receive a total price of $0.00`;
    }
    
    if (criterion.receiveType === 'quantity_only') {
      return `${optionalText} ${purchaseText} ${criterion.purchaseValue} to receive ${receiveText}`;
    }
    
    if (criterion.receiveType === 'percentage_discount') {
      return `${optionalText} ${purchaseText} ${criterion.purchaseValue} to receive ${receiveText} ${criterion.receiveValue.toFixed(2)}%`;
    }
    
    return `${optionalText} ${purchaseText} ${criterion.purchaseValue} to receive ${receiveText} $${criterion.receiveValue.toFixed(2)}`;
  };

  // Rebuild the Combo Deal payload per the data contract: PromotionItem rows
  // with proportional unit shares of the combo price, plus the canonical
  // conditions.combo block consumed by the sell-screen combo engine.
  const buildComboPromotionPayload = () => {
    const price = parseFloat(comboPrice) || 0;
    const normalTotal = comboItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const totalQuantity = comboItems.reduce((sum, item) => sum + item.quantity, 0);

    const items = comboItems.map(item => {
      const lineNormal = item.unitPrice * item.quantity;
      const lineShare = normalTotal > 0
        ? price * (lineNormal / normalTotal)
        : (comboItems.length > 0 ? price / comboItems.length : 0);
      const promoUnit = item.quantity > 0 ? lineShare / item.quantity : lineShare;
      return {
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        normalPrice: item.unitPrice,
        promoPrice: Math.round(promoUnit * 100) / 100,
        discountAmount: 0,
        discountPercentage: 0,
        rebate: 0,
        isRequired: true
      };
    });

    return {
      ...formData,
      outletId: resolveOutletId(),
      promotionType: 'Combo Deal',
      items,
      conditions: {
        combo: {
          comboId: comboId ?? null,
          comboPrice: price,
          totalQuantity,
          items: comboItems.map(item => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice
          }))
        }
      }
    };
  };

  const handleSave = async () => {
    if (isComboDeal) {
      if (comboItems.length === 0) {
        showSnackbar('Add at least one product to the combo', 'error');
        return;
      }
      const price = parseFloat(comboPrice);
      if (!price || price <= 0) {
        showSnackbar('Enter a combo price greater than zero', 'error');
        return;
      }
    }
    try {
      setSaving(true);
      const promotionData = isComboDeal ? buildComboPromotionPayload() : {
        ...formData,
        schedule: formData.isRecurring ? formData.schedule : null,
        outletId: resolveOutletId(),
        conditions: {
          criteria,
          maxApplicationsPerSale: formData.maxApplicationsPerSale,
          mixCriteria: formData.mixCriteria
        }
      };

      if (id) {
        await promotionService.updatePromotion(id, promotionData);
        showSnackbar('Promotion updated successfully', 'success');
      } else {
        await promotionService.createPromotion(promotionData);
        showSnackbar('Promotion created successfully', 'success');
        navigate('/marketing/promotions');
      }
    } catch (error) {
      console.error('Error saving promotion:', error);
      const errorMessage = error.response?.data?.error || 'Failed to save promotion';
      showSnackbar(errorMessage, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ---- Promotion Simulator (Show Simulator toggle) ----
  const handleAddSimProduct = async (result) => {
    const resolved = await resolveResultProducts(result);
    if (!resolved) return;
    setSimBasket(prev => {
      const next = [...prev];
      resolved.products.forEach((p) => {
        const idx = next.findIndex(i => i.productId === p.id);
        if (idx >= 0) {
          next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        } else {
          next.push({
            productId: p.id,
            name: p.name,
            quantity: 1,
            price: parseFloat(getBaseTier(p.prices)?.price) || 0
          });
        }
      });
      return next;
    });
    setSearchTerms(prev => ({ ...prev, sim: '' }));
    setSearchResults(prev => ({ ...prev, sim: [] }));
  };

  // ponytail: models the criteria quantity/spend thresholds and the price
  // modification only — max applications per sale and mix criteria are not
  // simulated; add them here if the simulator has to match the sell screen exactly.
  const evaluateSimulator = () => {
    const normalTotal = simBasket.reduce((s, i) => s + i.price * i.quantity, 0);
    if (simBasket.length === 0 || criteria.length === 0) {
      return { active: false, normalTotal, expected: normalTotal };
    }
    let discount = 0;
    let allRequiredMet = true;
    let anyMet = false;

    criteria.forEach((c) => {
      const ids = new Set((c.items || []).filter(i => !i.excluded).map(i => String(i.productId)));
      const matched = simBasket.filter(i => ids.has(String(i.productId)));
      const qty = matched.reduce((s, i) => s + i.quantity, 0);
      const subtotal = matched.reduce((s, i) => s + i.price * i.quantity, 0);
      const measured = c.purchaseType === 'spend' ? subtotal : qty;
      const met = c.purchaseValue > 0 && measured >= c.purchaseValue;
      if (!met) {
        if (!c.isOptional) allRequiredMet = false;
        return;
      }
      anyMet = true;
      const v = parseFloat(c.receiveValue) || 0;
      let d = 0;
      if (c.receiveType === 'total_price') d = subtotal - v;
      else if (c.receiveType === 'each_item_for') d = subtotal - v * qty;
      else if (c.receiveType === 'discount_each_item') d = v * qty;
      else if (c.receiveType === 'discount_total' || c.receiveType === 'discount') d = v;
      else if (c.receiveType === 'percentage_discount') d = subtotal * (v / 100);
      discount += Math.max(0, Math.min(d, subtotal));
    });

    const active = anyMet && allRequiredMet;
    return { active, normalTotal, expected: active ? normalTotal - discount : normalTotal };
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSnackbarClose = () => {
    setSnackbar({ open: false, message: '', severity: 'success' });
  };

  const comboNormalTotal = comboItems.reduce((sum, item) => sum + ((parseFloat(item.unitPrice) || 0) * (item.quantity || 1)), 0);
  const comboPriceNum = parseFloat(comboPrice) || 0;
  const comboSavings = comboNormalTotal - comboPriceNum;

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      backgroundColor: '#f5f5f5',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Box sx={{ flex: 1, p: 3 }}>
        <Paper sx={{ p: 3, mb: 2, backgroundColor: 'white',
          '& .MuiOutlinedInput-root': { borderRadius: '8px' },
          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
          '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
          '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' }
        }}>
          <Grid container spacing={3} alignItems="flex-end">
            <Grid item xs={12} md={3}>
              <LabeledField label="Name">
                <TextField
                  fullWidth
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  size="small"
                  sx={headerFieldSx}
                />
              </LabeledField>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControlLabel
                sx={toggleLabelSx}
                control={
                  <ShopfrontSwitch
                    checked={formData.isRecurring}
                    onChange={(e) => handleInputChange('isRecurring', e.target.checked)}
                  />
                }
                label="Recurring Promotion"
              />
            </Grid>
            {formData.isRecurring ? (
              <Grid item xs={12} md={3}>
                <Button
                  fullWidth
                  startIcon={<EditOutlinedIcon />}
                  onClick={openScheduleDialog}
                  sx={{
                    bgcolor: 'rgb(56,161,105)',
                    color: '#f8f8f8',
                    height: 42,
                    borderRadius: '8px',
                    textTransform: 'none',
                    fontSize: 16,
                    fontWeight: 700,
                    boxShadow: 'none',
                    transition: 'background 0.2s, color 0.2s',
                    '&:hover': { bgcolor: 'rgb(45,135,88)', boxShadow: 'none' }
                  }}
                >
                  Edit Schedule
                </Button>
              </Grid>
            ) : (
              <>
                <Grid item xs={12} md={3}>
                  <LabeledField label="Start Date">
                    <DateTimeField
                      value={formData.startDate}
                      onChange={(v) => handleInputChange('startDate', v)}
                    />
                  </LabeledField>
                </Grid>
                <Grid item xs={12} md={3}>
                  <LabeledField label="End Date">
                    <DateTimeField
                      value={formData.endDate}
                      onChange={(v) => handleInputChange('endDate', v)}
                    />
                  </LabeledField>
                </Grid>
              </>
            )}
            <Grid item xs={12} md={3}>
              <LabeledField label="Category">
                <Autocomplete
                  size="small"
                  options={categories}
                  getOptionLabel={(option) => option?.name || ''}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  value={categories.find((c) => c.id === formData.categoryId) || null}
                  onChange={(event, newValue) => handleInputChange('categoryId', newValue ? newValue.id : '')}
                  renderOption={(props, option, { selected }) => (
                    <Box
                      component="li"
                      {...props}
                      key={option.id}
                      sx={{ fontSize: 16, color: selected ? '#5ebbeb' : '#111', minHeight: '46px' }}
                    >
                      {option.name}
                    </Box>
                  )}
                  slotProps={{
                    paper: {
                      sx: {
                        width: 400,
                        borderRadius: 0,
                        boxShadow: 'none',
                        border: '1px solid #d9d9d9'
                      }
                    },
                    // ponytail: descendant selector needed to beat MUI's own .MuiAutocomplete-option rule
                    listbox: {
                      sx: { '& .MuiAutocomplete-option': { minHeight: '46px' } }
                    }
                  }}
                  renderInput={(params) => (
                    <TextField {...params} sx={headerFieldSx} />
                  )}
                />
              </LabeledField>
            </Grid>
            <Grid item xs={12} md={3}>
              <LabeledField label="Available to">
                <Autocomplete
                  multiple
                  disableCloseOnSelect
                  size="small"
                  options={customerGroups}
                  getOptionLabel={(option) => option?.name || ''}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  value={customerGroups.filter((group) => formData.customerGroupIds.includes(group.id))}
                  onChange={(event, newValue) => handleAvailableToChange(newValue.map((g) => g.id))}
                  renderOption={(props, option, { selected }) => (
                    <Box component="li" {...props} key={option.id} sx={{ fontSize: 16, minHeight: '46px' }}>
                      <Checkbox size="small" checked={selected} sx={{ mr: 1, p: 0.5 }} />
                      {option.name}
                    </Box>
                  )}
                  slotProps={{
                    paper: {
                      sx: {
                        width: 400,
                        borderRadius: 0,
                        boxShadow: 'none',
                        border: '1px solid #d9d9d9'
                      }
                    },
                    listbox: {
                      sx: { '& .MuiAutocomplete-option': { minHeight: '46px' } }
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder={formData.customerGroupIds.length === 0 ? 'All Customers' : ''}
                      sx={headerFieldSx}
                    />
                  )}
                />
              </LabeledField>
            </Grid>
            <Grid item xs={12} md={3}>
              <LabeledField label="Max Applications Per Sale">
                <TextField
                  fullWidth
                  type="number"
                  size="small"
                  value={formData.maxApplicationsPerSale}
                  onChange={(e) => handleInputChange('maxApplicationsPerSale', e.target.value)}
                  sx={headerFieldSx}
                />
              </LabeledField>
            </Grid>
            {/* reference row 3 starts at column 2 — keep the spacers so Mix criteria
                and Active sit side by side under Available to / Max Applications */}
            <Grid item xs={false} md={3} sx={{ display: { xs: 'none', md: 'block' } }} />
            <Grid item xs={false} md={3} sx={{ display: { xs: 'none', md: 'block' } }} />
            <Grid item xs={12} md={3}>
              <FormControlLabel
                sx={toggleLabelSx}
                control={
                  <ShopfrontSwitch
                    checked={formData.mixCriteria}
                    onChange={(e) => handleInputChange('mixCriteria', e.target.checked)}
                  />
                }
                label="Mix criteria"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControlLabel
                sx={toggleLabelSx}
                control={
                  <ShopfrontSwitch
                    checked={formData.isActive}
                    onChange={(e) => handleInputChange('isActive', e.target.checked)}
                  />
                }
                label="Active"
              />
            </Grid>
            </Grid>
        </Paper>

        <Box sx={{ my: 2 }} />

        {isComboDeal ? (
          <Paper sx={{ p: 3, backgroundColor: 'white', borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Combo Deal
            </Typography>

            <TextField
              fullWidth
              placeholder="Search for a product to add to the combo..."
              value={searchTerms.combo || ''}
              onChange={(e) => handleSearch('combo', e.target.value)}
              size="small"
              sx={{ mb: 2, maxWidth: 480 }}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />

            {searchResults.combo && searchResults.combo.length > 0 && (
              <Paper sx={{ mb: 2, maxHeight: 200, overflow: 'auto', maxWidth: 480 }}>
                {searchResults.combo.map((product) => (
                  <Box
                    key={product.id}
                    onClick={() => handleAddComboProduct(product)}
                    sx={{
                      p: 1.5,
                      cursor: 'pointer',
                      borderBottom: '1px solid #f0f0f0',
                      '&:hover': { bgcolor: '#f5f5f5' }
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {product.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ${product.prices?.[0]?.price || 0}
                    </Typography>
                  </Box>
                ))}
              </Paper>
            )}

            {comboItems.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  No products in the combo. Search above to add products.
                </Typography>
              </Box>
            ) : (
              <Box>
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 100px 120px 120px 48px',
                  gap: 2,
                  p: 1.5,
                  bgcolor: '#e3f2fd',
                  borderRadius: 1,
                  mb: 1,
                  fontWeight: 'bold',
                  fontSize: '0.875rem'
                }}>
                  <Box>Product</Box>
                  <Box>Quantity</Box>
                  <Box>Unit Price</Box>
                  <Box>Line Total</Box>
                  <Box></Box>
                </Box>

                {comboItems.map((item, index) => (
                  <Box
                    key={item.productId ?? index}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 100px 120px 120px 48px',
                      gap: 2,
                      p: 1.5,
                      borderBottom: '1px solid #f0f0f0',
                      alignItems: 'center'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckCircleIcon sx={{ color: '#4caf50', fontSize: 18 }} />
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {item.productName || 'Unknown Product'}
                      </Typography>
                    </Box>
                    <TextField
                      size="small"
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleComboItemQuantityChange(index, e.target.value)}
                      inputProps={{ min: 1 }}
                    />
                    <Typography variant="body2">
                      ${(parseFloat(item.unitPrice) || 0).toFixed(2)}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      ${((parseFloat(item.unitPrice) || 0) * (item.quantity || 1)).toFixed(2)}
                    </Typography>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleRemoveComboItem(index)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mt: 3, flexWrap: 'wrap' }}>
              <TextField
                label="Combo Price"
                size="small"
                type="number"
                value={comboPrice}
                onChange={(e) => setComboPrice(e.target.value)}
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 0.5 }}>$</Typography>,
                  inputProps: { min: 0, step: 0.01 }
                }}
                sx={{ width: 180 }}
              />
              <Box>
                <Typography variant="body2">
                  Normal total: ${comboNormalTotal.toFixed(2)}
                </Typography>
                {comboPriceNum > 0 && comboSavings > 0 && (
                  <Typography variant="body2" sx={{ color: '#32b643', fontWeight: 600 }}>
                    Customer saves ${comboSavings.toFixed(2)}
                  </Typography>
                )}
                {comboPriceNum > 0 && comboSavings < 0 && (
                  <Typography variant="body2" sx={{ color: '#e33430' }}>
                    Combo price is higher than the normal total.
                  </Typography>
                )}
              </Box>
            </Box>
          </Paper>
        ) : (
        <>
        <Box sx={{ mb: 2 }}>
                <Button
            variant="text"
                  startIcon={<AddIcon />}
            onClick={handleAddCriterion}
            sx={{
              color: '#32b643',
              textTransform: 'none',
              fontSize: 16,
              fontWeight: 600,
              '&:hover': { backgroundColor: 'transparent', color: '#2ba33c' }
            }}
          >
             Add Criteria
                </Button>
              </Box>

        {criteria.length === 0 ? (
          <Paper sx={{ p: 3, minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white' }}>
            <Typography variant="h6" color="text.secondary">
              No criteria in promotion
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ width: '100%' }}>
            {criteria.map((criterion) => (
              <Paper 
                key={criterion.id} 
                sx={{ 
                  mb: 2, 
                  backgroundColor: 'white',
                  borderRadius: 2,
                  overflow: 'hidden',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                <Grid container>
                  <Grid 
                    item 
                    xs={12} 
                    md={expandedItems[criterion.id] ? 6 : expandedCriteria[criterion.id] ? 4 : 6} 
                    sx={{ borderRight: '1px solid #e0e0e0' }}
                  >
                    <Box 
                      sx={{ 
                        bgcolor: expandedItems[criterion.id] ? '#5ebbeb' : (criterion.items.length > 0 ? '#676b72' : '#5ebbeb'),
                        color: 'white', 
                        p: 1.5,
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        '&:hover': { bgcolor: expandedItems[criterion.id] ? '#4aa9dd' : (criterion.items.length > 0 ? '#565a60' : '#4aa9dd') }
                      }}
                      onClick={() => toggleItemsExpansion(criterion.id)}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                        {criterion.items.length > 0 ? 'Edit Items and Rebate' : 'Items and Rebate'}
                      </Typography>
                    </Box>
                    {expandedItems[criterion.id] ? (
                      <Box sx={{ p: 2 }}>
                            <TextField
                          fullWidth
                          placeholder="Search for a product, classification or combo..."
                          value={searchTerms[criterion.id] || ''}
                          onChange={(e) => handleSearch(criterion.id, e.target.value)}
                              size="small"
                          sx={{ mb: 2 }}
                          InputProps={{
                            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                          }}
                        />

                        {searchResults[criterion.id] && searchResults[criterion.id].length > 0 && (
                          <Paper sx={{ mb: 2, maxHeight: 200, overflow: 'auto' }}>
                            {searchResults[criterion.id].map((result) => (
                              <Box
                                key={`${result.resultType}-${result.id}`}
                                onClick={() => handleAddItemToCriterion(criterion.id, result)}
                                sx={{
                                  p: 1.5,
                                  cursor: 'pointer',
                                  borderBottom: '1px solid #f0f0f0',
                                  '&:hover': { bgcolor: '#f5f5f5' }
                                }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                    {result.name}
                                  </Typography>
                                  {result.resultType !== 'PRODUCT' && (
                                    <Chip
                                      size="small"
                                      label={result.resultType === 'COMBO' ? 'Combo' : 'Classification'}
                                      sx={{ height: 18, fontSize: '0.65rem' }}
                                    />
                                  )}
                                </Box>
                                <Typography variant="caption" color="text.secondary">
                                  {result.resultType === 'COMBO'
                                    ? `$${parseFloat(result.comboPrice ?? result.totalPrice ?? result.calculatedTotalPrice ?? 0).toFixed(2)} · ${(result.items || []).length} products`
                                    : result.resultType === 'CLASSIFICATION'
                                      ? `${result.type || 'Classification'} · adds its products`
                                      : `$${result.prices?.[0]?.price || 0}`}
                                </Typography>
                              </Box>
                            ))}
                          </Paper>
                        )}

                        {criterion.items.length === 0 ? (
                          <Box sx={{ textAlign: 'center', py: 4 }}>
                            <Typography variant="body2" color="text.secondary">
                              No items in criteria
                            </Typography>
                          </Box>
                        ) : (
                          <Box>
                            <Box sx={{ 
                              display: 'grid', 
                              gridTemplateColumns: '60px 1fr 120px 80px 100px 40px',
                              gap: 2,
                              p: 1.5,
                              bgcolor: '#e3f2fd',
                              borderRadius: 1,
                              mb: 1,
                              fontWeight: 'bold',
                              fontSize: '0.875rem'
                            }}>
                              <Box>Exclude</Box>
                              <Box>Item</Box>
                              <Box>Rebate</Box>
                              <Box>%</Box>
                              <Box>Profit</Box>
                              <Box></Box>
                            </Box>

                            {criterion.items.map((item) => {
                              const itemProfit = calculateItemProfit(criterion, item);
                              return (
                                <Box 
                                  key={item.id} 
                                  sx={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: '60px 1fr 120px 80px 100px 40px',
                                    gap: 2,
                                    p: 1.5,
                                    borderBottom: '1px solid #f0f0f0',
                                    alignItems: 'center'
                                  }}
                                >
                                  <ShopfrontSwitch
                                    checked={item.excluded}
                                    onChange={(e) => handleUpdateItem(criterion.id, item.id, 'excluded', e.target.checked)}
                                  />
                                  <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <CheckCircleIcon sx={{ color: '#4caf50', fontSize: 18 }} />
                                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                        {item.name && item.name.length > 25 ? `${item.name.substring(0, 25)}...` : (item.name || item.productName || 'Unknown Product')}
                                      </Typography>
                                    </Box>
                                    <Typography variant="caption" color="text.secondary">
                                      {item.sourceLabel || item.type}
                                    </Typography>
                                  </Box>
                            <TextField
                              size="small"
                                    value={item.rebateAmount}
                                    onChange={(e) => handleUpdateItem(criterion.id, item.id, 'rebateAmount', e.target.value)}
                                    placeholder="$ 0"
                                    InputProps={{
                                      startAdornment: <Typography sx={{ mr: 0.5 }}>$</Typography>
                                    }}
                                  />
                                  <Typography 
                                    variant="body2" 
                                    sx={{ 
                                      color: item.rebatePercentage < 0 ? 'error.main' : 'success.main',
                                      fontWeight: 500
                                    }}
                                  >
                                    {item.rebatePercentage.toFixed(2)}%
                                  </Typography>
                                  <Typography 
                                    variant="body2" 
                                    sx={{ 
                                      color: itemProfit < 0 ? 'error.main' : itemProfit > 0 ? 'success.main' : 'text.secondary',
                                      fontWeight: 600,
                                      fontSize: '0.9rem'
                                    }}
                                  >
                                    {itemProfit.toFixed(2)}%
                                  </Typography>
                            <IconButton
                              size="small"
                                    onClick={() => handleRemoveItem(criterion.id, item.id)}
                              color="error"
                            >
                                    <DeleteIcon fontSize="small" />
                            </IconButton>
                                </Box>
                              );
                            })}
            </Box>
          )}
                      </Box>
                    ) : (
                      <Box sx={{ p: 2, cursor: 'pointer' }} onClick={() => toggleItemsExpansion(criterion.id)}>
                        {criterion.items.length === 0 ? (
                          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            Click here to add Products or Classifications to the criteria
                          </Typography>
                        ) : (
            <Box>
                            {criterion.items.map((item) => (
                              <Box key={item.id || item.productId} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <CheckCircleIcon sx={{ color: '#4caf50', fontSize: 20 }} />
                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                    {item.name && item.name.length > 30 ? `${item.name.substring(0, 30)}...` : (item.name || item.productName || 'Unknown Product')}
              </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {item.sourceLabel || item.type || 'PRODUCT'}
                                  </Typography>
                                </Box>
                              </Box>
                            ))}
            </Box>
          )}
                      </Box>
                    )}
                  </Grid>

                  <Grid 
                    item 
                    xs={12} 
                    md={expandedCriteria[criterion.id] ? 8 : expandedItems[criterion.id] ? 6 : 6}
                  >
                    <Box 
                      sx={{ 
                        bgcolor: expandedCriteria[criterion.id] ? '#5ebbeb' : '#676b72',
                        color: 'white', 
                        p: 1.5,
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        '&:hover': { bgcolor: expandedCriteria[criterion.id] ? '#4aa9dd' : '#565a60' }
                      }}
                      onClick={() => toggleCriteriaExpansion(criterion.id)}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                        Criteria
              </Typography>
            </Box>
                    {expandedCriteria[criterion.id] ? (
                      <Box sx={{ p: 2 ,display: 'flex'}}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                          <Button
                            variant={criterion.isOptional ? 'contained' : 'outlined'}
                            size="small"
                            onClick={() => handleUpdateCriterion(criterion.id, 'isOptional', true)}
                            sx={{ minWidth: 100 }}
                          >
                            Optionally
                          </Button>
                          <Button
                            variant={!criterion.isOptional ? 'contained' : 'outlined'}
                            size="small"
                            onClick={() => handleUpdateCriterion(criterion.id, 'isOptional', false)}
                            sx={{ minWidth: 100 }}
                          >
                            (Required)
                          </Button>
                          
                          <FormControl size="small" sx={{ minWidth: 100 }}>
                            <Select
                              value={criterion.purchaseType}
                              onChange={(e) => handleUpdateCriterion(criterion.id, 'purchaseType', e.target.value)}
                            >
                              <MenuItem value="purchase">purchase</MenuItem>
                              <MenuItem value="spend">spend</MenuItem>
                            </Select>
                          </FormControl>
                          
          <TextField
                            size="small"
                            type="number"
                            value={criterion.purchaseValue}
                            onChange={(e) => handleUpdateCriterion(criterion.id, 'purchaseValue', parseFloat(e.target.value) || 0)}
                            sx={{ width: 80 }}
                          />
                          
                          <Button variant="outlined" size="small" disabled>
                            exactly
                          </Button>
                          
                          <Button variant="outlined" size="small" disabled>
                            of any product
                          </Button>
                          
                          <Typography>to receive</Typography>
                          
                          <FormControl size="small" sx={{ minWidth: 250 }}>
                            <Select
                              value={criterion.receiveType}
                              onChange={(e) => handleUpdateCriterion(criterion.id, 'receiveType', e.target.value)}
                            >
                              <MenuItem value="total_price">a total price of</MenuItem>
                              <MenuItem value="each_item_for">each item for</MenuItem>
                              <MenuItem value="discount_each_item">a discount on each item worth</MenuItem>
                              <MenuItem value="discount_total">a discount off the total worth</MenuItem>
                              <MenuItem value="percentage_discount">a percentage discount of</MenuItem>
                              <MenuItem value="same_sell_rate">the same sell rate as if the quantity was</MenuItem>
                              <MenuItem value="quantity_only">(quantity only)</MenuItem>
                            </Select>
                          </FormControl>
                          
                          {(criterion.receiveType !== 'quantity_only' && criterion.receiveType !== 'free_item') && (
                            <TextField
                              size="small"
                              type="number"
                              value={criterion.receiveValue}
                              onChange={(e) => handleUpdateCriterion(criterion.id, 'receiveValue', parseFloat(e.target.value) || 0)}
                              sx={{ width: 100 }}
            InputProps={{
                                startAdornment: criterion.receiveType === 'percentage_discount' ? (
                                  <Typography sx={{ mr: 0.5 }}>%</Typography>
                                ) : criterion.receiveType === 'same_sell_rate' ? null : (
                                  <Typography sx={{ mr: 0.5 }}>$</Typography>
                                )
                              }}
                            />
                          )}
                        </Box>

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box sx={{ flex: 1 }} />
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                              PROFIT
                        </Typography>
                            <Typography 
                              variant="h4" 
                              sx={{ 
                                color: calculateAverageItemProfit(criterion) < 0 ? '#e33430' : '#313439',
                                fontWeight: 'bold',
                                mb: 2
                              }}
                            >
                              {calculateAverageItemProfit(criterion).toFixed(2)}%
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-end' }}>
                        <Button
                          size="small"
                                startIcon={<CloneIcon />}
                                onClick={() => handleCloneCriterion(criterion)}
                                sx={{ color: '#32b643', justifyContent: 'flex-start' }}
                        >
                                Clone Criteria
                        </Button>
                              <Button
                                size="small"
                                startIcon={<DeleteIcon />}
                                onClick={() => handleRemoveCriterion(criterion.id)}
                                sx={{ color: '#e33430', justifyContent: 'flex-start' }}
                              >
                                Delete Criteria
                              </Button>
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    ) : (
                      <Box sx={{ p: 2 ,display: 'flex'}}>
                        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary', flex: 1 }}>
                          {getCriterionSummary(criterion)}
                        </Typography>

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box sx={{ flex: 1 }} />
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                              PROFIT
                            </Typography>
                            <Typography 
                              variant="h4" 
                              sx={{ 
                                color: calculateAverageItemProfit(criterion) < 0 ? '#e33430' : '#313439',
                                fontWeight: 'bold',
                                mb: 2
                              }}
                            >
                              {calculateAverageItemProfit(criterion).toFixed(2)}%
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-end' }}>
                              <Button
                                size="small"
                                startIcon={<CloneIcon />}
                                onClick={() => handleCloneCriterion(criterion)}
                                sx={{ color: '#32b643', justifyContent: 'flex-start' }}
                              >
                                Clone Criteria
                              </Button>
                              <Button
                                size="small"
                                startIcon={<DeleteIcon />}
                                onClick={() => handleRemoveCriterion(criterion.id)}
                                sx={{ color: '#e33430', justifyContent: 'flex-start' }}
                              >
                                Delete Criteria
                              </Button>
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    )}
                  </Grid>
                </Grid>
              </Paper>
            ))}
          </Box>
        )}
        </>
        )}

        {showSimulator && (() => {
          const sim = evaluateSimulator();
          return (
            <Paper sx={{ p: 3, mt: 2, backgroundColor: 'white' }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Promotion Simulator
              </Typography>

              <TextField
                fullWidth
                placeholder="Search for a product, classification or combo to add to the basket..."
                value={searchTerms.sim || ''}
                onChange={(e) => handleSearch('sim', e.target.value)}
                size="small"
                sx={{ mb: 2, maxWidth: 480 }}
                InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
              />

              {searchResults.sim && searchResults.sim.length > 0 && (
                <Paper sx={{ mb: 2, maxHeight: 200, overflow: 'auto', maxWidth: 480 }}>
                  {searchResults.sim.map((result) => (
                    <Box
                      key={`${result.resultType}-${result.id}`}
                      onClick={() => handleAddSimProduct(result)}
                      sx={{
                        p: 1.5,
                        cursor: 'pointer',
                        borderBottom: '1px solid #f0f0f0',
                        '&:hover': { bgcolor: '#f5f5f5' }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{result.name}</Typography>
                        {result.resultType !== 'PRODUCT' && (
                          <Chip
                            size="small"
                            label={result.resultType === 'COMBO' ? 'Combo' : 'Classification'}
                            sx={{ height: 18, fontSize: '0.65rem' }}
                          />
                        )}
                      </Box>
                    </Box>
                  ))}
                </Paper>
              )}

              {simBasket.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Search above to add products to the simulated sale.
                </Typography>
              ) : (
                <Box>
                  {simBasket.map((item, index) => (
                    <Box
                      key={item.productId}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: '90px 1fr 120px 40px',
                        gap: 2,
                        p: 1,
                        alignItems: 'center',
                        borderBottom: '1px solid #f0f0f0'
                      }}
                    >
                      <TextField
                        size="small"
                        type="number"
                        value={item.quantity}
                        inputProps={{ min: 1 }}
                        onChange={(e) => {
                          const quantity = Math.max(1, parseInt(e.target.value) || 1);
                          setSimBasket(prev => prev.map((it, i) => (i === index ? { ...it, quantity } : it)));
                        }}
                      />
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{item.name}</Typography>
                      <Typography variant="body2">${(item.price * item.quantity).toFixed(2)}</Typography>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setSimBasket(prev => prev.filter((_, i) => i !== index))}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mt: 2, flexWrap: 'wrap' }}>
                    <Typography variant="body2">Normal price: ${sim.normalTotal.toFixed(2)}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      Expected price: ${sim.expected.toFixed(2)}
                    </Typography>
                    <Typography
                      sx={{
                        fontWeight: 700,
                        color: sim.active ? '#16a34a' : '#f8f8f8',
                        bgcolor: sim.active ? 'transparent' : '#dc2626',
                        px: sim.active ? 0 : 1.5,
                        py: sim.active ? 0 : 0.5
                      }}
                    >
                      {sim.active ? 'Current Promotion Active' : 'No Promotion Active'}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Paper>
          );
        })()}
      </Box>

      <Box sx={{
        bgcolor: '#5ebbeb',
        p: 2,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        bottom: 0
      }}>
        <Button
          variant="contained"
          startIcon={<CancelIcon />}
          onClick={() => navigate('/marketing/promotions')}
          sx={{
            bgcolor: '#e33430',
            borderRadius: 0,
            boxShadow: 'none',
            '&:hover': { bgcolor: '#cc2f2a', boxShadow: 'none' }
          }}
        >
            Cancel
          </Button>
        <FormControlLabel
          control={
            <Switch
              checked={showSimulator}
              onChange={(e) => setShowSimulator(e.target.checked)}
              sx={{ 
                '& .MuiSwitch-switchBase.Mui-checked': {
                  color: 'white'
                },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                  backgroundColor: 'rgba(255,255,255,0.3)'
                }
              }}
            />
          }
          label={
            <Typography sx={{ color: 'white', fontWeight: 500 }}>
              Show Simulator
            </Typography>
          }
        />
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={saving}
          sx={{
            bgcolor: 'white',
            color: '#5ebbeb',
            borderRadius: 0,
            boxShadow: 'none',
            '&:hover': {
              bgcolor: 'rgba(255,255,255,0.9)',
              boxShadow: 'none'
            }
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>

      {/* Edit Schedule — recurring promotions describe their schedule as ISO 8601
          values (anchor date + repeating period + optional start time + duration) */}
      <Dialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        maxWidth={false}
        PaperProps={{ sx: { width: 620, borderRadius: 0, overflow: 'visible', mt: 8 } }}
      >
        <Box
          sx={{
            width: 100,
            height: 100,
            borderRadius: '50%',
            bgcolor: '#5ebbeb',
            color: '#f8f8f8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 48,
            fontWeight: 700,
            position: 'absolute',
            top: -50,
            left: 'calc(50% - 50px)'
          }}
        >
          ?
        </Box>
        <DialogContent sx={{ pt: 7 }}>
          <Typography sx={{ fontSize: 20, fontWeight: 700, textAlign: 'center', mb: 2 }}>
            Edit Schedule
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography sx={{ fontSize: 14, color: '#676b72', mb: 0.5 }}>Preview</Typography>
              <Box sx={{ display: 'flex', mb: 1 }}>
                {['Month', 'Week'].map((mode) => (
                  <Button
                    key={mode}
                    onClick={() => setSchedulePreview(mode)}
                    startIcon={mode === 'Month' ? <CalendarMonthOutlinedIcon /> : null}
                    sx={{
                      textTransform: 'none',
                      borderRadius: 0,
                      boxShadow: 'none',
                      bgcolor: schedulePreview === mode ? '#7ec8ee' : '#ececec',
                      color: '#313439',
                      px: 2,
                      '&:hover': { bgcolor: schedulePreview === mode ? '#7ec8ee' : '#e0e0e0', boxShadow: 'none' }
                    }}
                  >
                    {mode}
                  </Button>
                ))}
              </Box>
              <Typography sx={{ fontSize: 12, color: '#676b72', mb: 1.5 }}>
                The values must be formatted as an{' '}
                <Box
                  component="a"
                  href="https://en.wikipedia.org/wiki/ISO_8601"
                  target="_blank"
                  rel="noreferrer"
                  sx={{ color: '#676b72', textDecoration: 'underline' }}
                >
                  ISO 8601
                </Box>{' '}
                value
              </Typography>
              {[
                ['Anchor Date', 'anchorDate'],
                ['Repeating Period', 'repeatingPeriod'],
                ['Time to Start (optional)', 'timeToStart'],
                ['Enabled Duration', 'enabledDuration']
              ].map(([label, key]) => (
                <TextField
                  key={key}
                  fullWidth
                  size="small"
                  label={label}
                  value={scheduleDraft[key]}
                  onChange={(e) => setScheduleDraft(prev => ({ ...prev, [key]: e.target.value }))}
                  sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: '4px', height: 38 } }}
                />
              ))}
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <IconButton
                  size="small"
                  onClick={() => setScheduleMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                >
                  <ChevronLeftIcon />
                </IconButton>
                <Typography sx={{ fontWeight: 700 }}>
                  {scheduleMonth.toLocaleString('en-AU', { month: 'short', year: 'numeric' })}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => setScheduleMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                >
                  <ChevronRightIcon />
                </IconButton>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
                  <Typography key={d} sx={{ fontSize: 11, textAlign: 'center', color: '#676b72' }}>{d}</Typography>
                ))}
                {(schedulePreview === 'Month' ? monthGrid(scheduleMonth) : weekGrid(scheduleMonth)).map((day, i) => (
                  <Box
                    key={day ? day.toISOString() : `pad-${i}`}
                    sx={{
                      minHeight: 30,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      bgcolor: day ? (isSameDay(day, new Date()) ? '#d6ecfa' : '#ececec') : 'transparent'
                    }}
                  >
                    {day ? ordinal(day.getDate()) : ''}
                  </Box>
                ))}
              </Box>
            </Grid>
          </Grid>
          <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
            <Button
              onClick={() => setScheduleOpen(false)}
              sx={{
                flex: 1,
                height: 40,
                borderRadius: '4px',
                textTransform: 'none',
                bgcolor: '#f1f1f1',
                color: '#313439',
                '&:hover': { bgcolor: '#e4e4e4' }
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleScheduleContinue}
              sx={{
                flex: 1,
                height: 40,
                borderRadius: '4px',
                textTransform: 'none',
                bgcolor: '#2f8fe0',
                color: '#f8f8f8',
                '&:hover': { bgcolor: '#2679bd' }
              }}
            >
              Continue
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PromotionDetails;
