import React, { useState, useEffect } from 'react';
import NumberField from '../../components/Common/NumberField';
import { criterionSummary, receiveOptions, showMatchChip, showAnyProductChip, profitHidden, receiveTypeForPurchaseType } from '../../utils/promotionCriterionDisplay';
import {
  Box,
  Button,
  TextField,
  Typography,
  Grid,
  Collapse,
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
  ChevronRight as ChevronRightIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  HighlightOffOutlined as HighlightOffOutlinedIcon
} from '@mui/icons-material';
import { useLocation, useNavigate, useParams, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import promotionService from '../../services/promotionService';
import promotionCategoryService from '../../services/promotionCategoryService';
import CreatableAutocomplete from '../../components/Common/CreatableAutocomplete';
import customerGroupService from '../../services/customerGroupService';
import productService from '../../services/productService';
import classificationService from '../../services/classificationService';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import useResultKeys, { ACTIVE_ROW_SX } from '../../components/Common/useResultKeys';
import { getBaseTier } from '../../utils/baseTier';
import { criteriaFromItems, hydrateCriteria, unitCostOf } from '../../utils/promotionCriteria';
import { allocateCriteriaSets, allocateSpendPromotion, mergeCriteriaGroups, RECEIVE_TYPES as SPEND_RECEIVE_TYPES } from '../../utils/criteriaPromotion';
import { bestRateTier } from '../../utils/familyOverride';
import settingsService from '../../services/settingsService';
import EditScheduleDialog from '../../components/Marketing/EditScheduleDialog';
import PromotionSimulatorPanel, { SIMULATOR_WIDTH } from '../../components/Marketing/PromotionSimulatorPanel';

// Recurring schedule editing lives in components/Marketing/EditScheduleDialog.

// Monday-first grid of the given month, padded with nulls (in-page date picker)
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
// UTC ISO (from the API) -> "yyyy-MM-ddTHH:mm:ss" in the browser's local time,
// the format DateTimeField edits and the API parses back as local time.
const toLocalIso = (raw) => {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

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
        placeholder="DD/MM/YYYY HH:MM:SS"
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
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
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

// criteriaFromItems / unitCostOf live in utils/promotionCriteria (shared with the
// promotion VIEW, with the cost lookup that used to leave PROFIT at "N/A").

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
  // Setup > General > Cost Calculation Method decides which unit cost a margin uses.
  const costMethod = settingsService.getCachedGeneralSettings().costCalculationMethod || 'Last Cost';

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
  // The simulator slides open below the criteria; once it has grown, the page
  // scrolls so the new section is in view instead of hiding under the bar.

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

  // Promotion simulator basket
  const [simBasket, setSimBasket] = useState([]);

  const [categories, setCategories] = useState([]);
  const [customerGroups, setCustomerGroups] = useState([]);

  const [criteria, setCriteria] = useState([]);
  const [searchTerms, setSearchTerms] = useState({});
  const [searchResults, setSearchResults] = useState({});
  // Reference: the top search result is highlighted; Up/Down move, Enter adds it.
  const resultKeys = useResultKeys();
  const [expandedCriteria, setExpandedCriteria] = useState({});
  const [expandedItems, setExpandedItems] = useState({});
  // Reference: a new criterion's quantity and value boxes start empty (the value
  // stays 0 underneath). { [criterionId]: { purchaseValue: true, receiveValue: true } }
  const [blankFields, setBlankFields] = useState({});

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
        // Reference keeps DD/MM/YYYY HH:mm:ss — hold on to the time part too.
        // The API returns UTC ISO strings; shown as-is they read 5:30 h early and
        // every save shifted the date back again. Convert to LOCAL wall time.
        startDate: toLocalIso(promotion.startDate),
        endDate: toLocalIso(promotion.endDate),
        categoryId: promotion.categoryId || '',
        availableTo: promotion.availableTo || 'All Customers',
        customerGroupIds: promotion.customerGroupIds || [],
        maxApplicationsPerSale: promotion.maxApplicationsPerSale ?? promotion.conditions?.maxApplicationsPerSale ?? '',
        mixCriteria: promotion.mixCriteria ?? promotion.conditions?.mixCriteria ?? false,
        isActive: promotion.isActive ?? true,
        schedule: promotion.schedule ?? null
      });
      
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
        // Saved item snapshots can carry a stale cost (0) — refresh from the current product.
        const savedCriteria = hydrateCriteria(promotion.conditions?.criteria || [], promotion.items, costMethod).map((c, i) => ({
          ...c,
          id: c.id ?? Date.now() + i,
          items: (c.items || []).map((item) => ({
            ...item,
            rebateAmount: parseFloat(item.rebateAmount) || 0,
            rebatePercentage: parseFloat(item.rebatePercentage) || 0,
          })),
        }));
        const loadedCriteria = savedCriteria.length === 0 && Array.isArray(promotion.items) && promotion.items.length > 0
          ? criteriaFromItems(promotion.items, costMethod)
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

  // Inline promotion-category creation from the combobox 'Create "<text>"...' row.
  // Uses the same outlet scope fetchCategories reads with, so the new record is
  // in the list the very next time it loads too.
  const handleCreatePromotionCategory = async (name) => {
    const response = await promotionCategoryService.createPromotionCategory({
      name,
      outletId: resolveOutletId(),
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

  // The criteria search matches products and classifications. A classification is
  // shorthand for its member products: picking one
  // expands into individual PRODUCT items (see handleAddItemToCriterion) so the
  // rebate/exclude/profit columns and the sell-screen matcher — which keys on
  // productId — keep working unchanged.
  const handleSearch = async (criterionId, searchValue) => {
    setSearchTerms(prev => ({ ...prev, [criterionId]: searchValue }));
    resultKeys.reset(criterionId);
    // Reference searches from the first character ("t" already lists products).
    if (searchValue.trim().length < 1) {
      setSearchResults(prev => ({ ...prev, [criterionId]: [] }));
      return;
    }
    const [products, classifications] = await Promise.all([
      productService.getProducts({ search: searchValue, limit: 20 })
        .then(r => r.products || [])
        .catch(() => []),
      classificationService.getClassifications({ search: searchValue })
        .then(r => r.classifications || [])
        .catch(() => []),
    ]);
    // A Combo Product is an ordinary product row, so it already arrives with the
    // products — no separate combo lookup is needed.
    setSearchResults(prev => ({
      ...prev,
      [criterionId]: [
        ...products.map(p => ({ ...p, resultType: 'PRODUCT' })),
        ...classifications.map(c => ({ ...c, resultType: 'CLASSIFICATION' })),
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
    setBlankFields(prev => ({ ...prev, [newCriterion.id]: { purchaseValue: true, receiveValue: true } }));
    setExpandedCriteria(prev => ({ ...prev, [newCriterion.id]: true }));
    setExpandedItems(prev => ({ ...prev, [newCriterion.id]: false }));
  };

  // Reference: exactly one of the two panels is open at any time. Clicking a
  // header opens that panel (and closes the other); clicking the open one
  // keeps it open - the pair never collapses to an empty box.
  const toggleCriteriaExpansion = (criterionId) => {
    setExpandedCriteria(prev => ({ ...prev, [criterionId]: true }));
    setExpandedItems(prev => ({ ...prev, [criterionId]: false }));
  };

  const toggleItemsExpansion = (criterionId) => {
    setExpandedItems(prev => ({ ...prev, [criterionId]: true }));
    setExpandedCriteria(prev => ({ ...prev, [criterionId]: false }));
  };

  // A purchase/receive box cleared by the operator shows blank again (held as 0),
  // instead of NumberField's blur fallback snapping it to "0".
  const commitCriterionValue = (criterionId, field, n) => {
    if (n !== '') return handleUpdateCriterion(criterionId, field, n);
    handleUpdateCriterion(criterionId, field, 0);
    setBlankFields(prev => ({ ...prev, [criterionId]: { ...prev[criterionId], [field]: true } }));
  };

  const handleUpdateCriterion = (criterionId, field, value) => {
    if (blankFields[criterionId]?.[field]) {
      setBlankFields(prev => ({ ...prev, [criterionId]: { ...prev[criterionId], [field]: false } }));
    }
    setCriteria(prev => prev.map(c => {
      if (c.id === criterionId) {
        const updated = { ...c, [field]: value };
        if (field === 'purchaseType') updated.receiveType = receiveTypeForPurchaseType(value, c.receiveType);
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
    // One cost rule everywhere (utils/promotionCriteria): the quantity-1 row's cost,
    // else the product's unit cost. `product.cost` is not a real column.
    const productCost = unitCostOf(product, costMethod);

    return {
      id: idSeed,
      productId: product.id,
      name: product.name,
      type: 'PRODUCT',
      sourceLabel: sourceLabel || null,
      originalPrice: baseTier?.price || 0,
      pricingTiers: product.prices || [],
      cost: productCost,
      // Starts blank, not "0" (user 19/10/2026); a blank rebate saves as 0.
      rebateAmount: '',
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

  // --- Promotion profit (margin on the promo sell price) ---------------------
  // Single source of truth: returns { sell, cost } TOTALS for one item under the
  // criterion, or null when a real cost is unknown (never fabricate a cost). A
  // supplier rebate lowers the effective cost of goods, so it raises margin.
  const calculateItemProfitBasis = (criterion, item) => {
    if (!item || item.excluded) return null;
    const qty = parseFloat(criterion.purchaseValue) || 0;
    if (qty === 0) return null;

    const tier = findPricingTier(item, criterion.purchaseValue);
    const pricePerUnit = tier.pricePerUnit || tier.price || parseFloat(item.originalPrice) || 0;
    const rawCostPerUnit = tier.costPerUnit || tier.cost || parseFloat(item.cost) || 0;
    if (!(rawCostPerUnit > 0)) return null; // no real cost -> cannot compute margin

    // Reference: the rebate is for the criterion's purchase quantity as a whole
    // ($1 on "purchase 6" takes 1/6 off each unit's cost).
    const rebatePerUnit = (parseFloat(item.rebateAmount) || 0) / qty;
    const costPerUnit = Math.max(0, rawCostPerUnit - rebatePerUnit);

    const rv = parseFloat(criterion.receiveValue) || 0;
    let sell = null;
    let cost = costPerUnit * qty;

    switch (criterion.receiveType) {
      case 'quantity_only':
        sell = pricePerUnit * qty;
        break;
      case 'total_price':
        sell = rv; // flat promo price for the whole quantity
        break;
      case 'each_item_for':
        sell = rv * qty;
        break;
      case 'discount_each_item':
        sell = (pricePerUnit - rv) * qty;
        break;
      case 'discount_total':
        sell = pricePerUnit * qty - rv;
        break;
      case 'percentage_discount':
        sell = pricePerUnit * qty * (1 - rv / 100);
        break;
      case 'discount':
        if (criterion.purchaseType === 'purchase') {
          sell = pricePerUnit * qty - rv;
        } else {
          // 'spend' has no per-item cost basis -> cannot compute margin honestly
          return null;
        }
        break;
      case 'same_sell_rate': {
        const bulk = findPricingTier(item, criterion.receiveValue);
        const bulkPricePerUnit = bulk.pricePerUnit || bulk.price || 0;
        const bulkRawCost = bulk.costPerUnit || bulk.cost || 0;
        if (!(bulkRawCost > 0)) return null;
        sell = bulkPricePerUnit * qty;
        cost = Math.max(0, bulkRawCost - rebatePerUnit) * qty;
        break;
      }
      default:
        return null;
    }

    if (sell == null || !isFinite(sell) || !isFinite(cost)) return null;
    return { sell, cost };
  };

  // Per-item margin %, or null when it cannot be computed (missing cost, or a
  // zero/negative promo sell price where a margin is undefined).
  const calculateItemProfit = (criterion, item) => {
    const basis = calculateItemProfitBasis(criterion, item);
    if (!basis || basis.sell <= 0) return null;
    const profit = ((basis.sell - basis.cost) / basis.sell) * 100;
    return isFinite(profit) ? profit : null;
  };

  // Criterion margin %: VALUE-WEIGHTED across items (sum(sell-cost)/sum(sell)),
  // not a plain mean of percentages, and it skips items whose cost is unknown.
  const calculateAverageItemProfit = (criterion) => {
    if (!criterion.items || criterion.items.length === 0) return null;
    let totalSell = 0;
    let totalCost = 0;
    let have = false;
    criterion.items.filter((i) => !i.excluded).forEach((item) => {
      const b = calculateItemProfitBasis(criterion, item);
      if (b && b.sell > 0) {
        totalSell += b.sell;
        totalCost += b.cost;
        have = true;
      }
    });
    if (!have || totalSell <= 0) return null;
    return ((totalSell - totalCost) / totalSell) * 100;
  };

  // The value persisted on the criterion == the value shown on screen.
  const calculateCriterionProfit = (criterion) => {
    const avg = calculateAverageItemProfit(criterion);
    return avg == null ? 0 : avg;
  };

  // Display helper: shows N/A instead of crashing on a null (uncomputable) %.
  const formatProfitPct = (v) => (v == null || isNaN(v) ? 'N/A' : `${v.toFixed(2)}%`);

  // Reference: PROFIT is red once the criterion has items and the margin is 0% or a loss;
  // an empty criterion's 0.00% stays dark.
  const criterionProfitColor = (criterion) => {
    if (criterion.items.length === 0 || profitHidden(criterion)) return '#313439';
    const avg = calculateAverageItemProfit(criterion);
    return avg != null && avg <= 0 ? '#e33430' : '#313439';
  };

  const getCriterionSummary = (criterion) => criterionSummary(criterion);

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
        // Same as the Express editor: show the confirmation, then back to the
        // list. Staying on the page after an update left the user wondering
        // whether the save had gone through.
        setTimeout(() => navigate('/marketing/promotions'), 1000);
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
            price: parseFloat(getBaseTier(p.prices)?.price) || 0,
            prices: Array.isArray(p.prices) ? p.prices : [],
          });
        }
      });
      return next;
    });
    setSearchTerms(prev => ({ ...prev, sim: '' }));
    setSearchResults(prev => ({ ...prev, sim: [] }));
  };

  // The simulator prices the basket with the SAME engine as the sell screen
  // (utils/criteriaPromotion): sets repeat per complete set, leftovers sell at
  // normal, a set applies only when every Required criterion is met, Mix Criteria
  // pools the criteria, Max Applications caps the sets, Spend & Get measures the
  // normal value. "Active" = at least one set / reward applied (reference blue).
  // Sell-screen ladder (calculateBasePriceForQuantity): the price point with the
  // lowest per-unit rate at or below the quantity, times the quantity.
  const simUnit = (i) => {
    const tier = bestRateTier(i.prices, i.quantity);
    if (tier) return (Number(tier.price) || 0) / (Number(tier.quantity) || 1);
    return parseFloat(i.price) || 0;
  };
  const simLineTotal = (i) => Math.round(simUnit(i) * (parseInt(i.quantity, 10) || 0) * 100) / 100;
  const evaluateSimulator = () => {
    const normalTotal = simBasket.reduce((s, i) => s + simLineTotal(i), 0);
    const live = criteria.filter((c) => c && (parseFloat(c.purchaseValue) || 0) > 0
      && (c.purchaseType === 'spend' || (c.items || []).some((i) => !i.excluded && i.productId != null)));
    const normalPrices = new Map(simBasket.map((i, index) => [index, simLineTotal(i)]));
    if (simBasket.length === 0 || live.length === 0) {
      return { active: false, normalTotal, expected: normalTotal, prices: normalPrices };
    }
    const linesFor = (c) => {
      const ids = new Set((c.items || []).filter((i) => !i.excluded && i.productId != null).map((i) => String(i.productId)));
      const any = c.purchaseType === 'spend' && ids.size === 0;
      return simBasket
        .map((i, index) => ({ i, index }))
        .filter(({ i }) => any || ids.has(String(i.productId)))
        .map(({ i, index }) => ({ index, q: parseInt(i.quantity, 10) || 0, unit: simUnit(i) }))
        .filter((l) => l.q > 0);
    };
    const total = (prices) => simBasket.reduce((s, i, index) => s + (prices.has(index) ? prices.get(index) : simLineTotal(i)), 0);

    const isSets = live.every((c) => !c.isOptional && (c.purchaseType || 'purchase') === 'purchase' && c.receiveType === 'total_price' && (parseFloat(c.receiveValue) || 0) > 0);
    if (isSets) {
      let groups = live.map((c) => ({ lines: linesFor(c), setQty: Math.floor(parseFloat(c.purchaseValue)), setPrice: parseFloat(c.receiveValue) }));
      if (formData.mixCriteria) groups = mergeCriteriaGroups(groups);
      const plan = allocateCriteriaSets(groups, { maxSets: parseInt(formData.maxApplicationsPerSale, 10) });
      return { active: plan.sets > 0, normalTotal, expected: total(plan.prices), prices: new Map([...normalPrices, ...plan.prices]) };
    }
    // Measured on the live reference (04/11/2026, "Purchase 2 to receive ...", Test
    // $2.00 x 3): each item for $1.50 -> $5.00; a discount off the total worth
    // $1.50 -> $4.50; a percentage discount of 1.5% -> $5.94. So every "to receive"
    // applies per COMPLETE set (2 of the 3 units) and the leftover sells at normal -
    // the same per-set engine the Spend & Get path uses.
    if (live.every((c) => SPEND_RECEIVE_TYPES.includes(c.receiveType || 'quantity_only'))) {
      const plan = allocateSpendPromotion(live.map((c) => ({
        kind: c.purchaseType === 'spend' ? 'spend' : 'purchase',
        threshold: parseFloat(c.purchaseValue) || 0,
        optional: Boolean(c.isOptional),
        receiveType: c.receiveType || 'quantity_only',
        receiveValue: parseFloat(c.receiveValue) || 0,
        lines: linesFor(c),
      })), { maxSets: parseInt(formData.maxApplicationsPerSale, 10) });
      return { active: plan.applied, normalTotal, expected: total(plan.prices), prices: new Map([...normalPrices, ...plan.prices]) };
    }

    // Other receive types (each item for, % off, same sell rate...): per-criterion
    // reading, as before.
    let discount = 0;
    let allRequiredMet = true;
    let anyMet = false;
    live.forEach((c) => {
      const ls = linesFor(c);
      const qty = ls.reduce((s, l) => s + l.q, 0);
      const subtotal = ls.reduce((s, l) => s + l.q * l.unit, 0);
      const measured = c.purchaseType === 'spend' ? subtotal : qty;
      const met = measured >= c.purchaseValue;
      if (!met) { if (!c.isOptional) allRequiredMet = false; return; }
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
    const active = anyMet && allRequiredMet && discount > 0;
    // Spread the saving over the lines by value so each line can show its price.
    const factor = active && normalTotal > 0 ? (normalTotal - discount) / normalTotal : 1;
    const prices = new Map([...normalPrices].map(([k, v]) => [k, Math.round(v * factor * 100) / 100]));
    return { active, normalTotal, expected: active ? normalTotal - discount : normalTotal, prices };
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
      {/* The simulator panel sits down the right edge (reference), so the page keeps clear of it. */}
      <Box sx={{ flex: 1, p: 3, pr: showSimulator ? `${SIMULATOR_WIDTH + 24}px` : 3, transition: 'padding-right 300ms' }}>
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
                  onClick={() => setScheduleOpen(true)}
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
                <CreatableAutocomplete
                  size="small"
                  options={categories}
                  value={categories.find((c) => c.id === formData.categoryId) || null}
                  onChange={(newValue) => handleInputChange('categoryId', newValue ? newValue.id : '')}
                  onCreate={handleCreatePromotionCategory}
                  onError={(err) => showSnackbar(err?.response?.data?.error || 'Failed to create category', 'error')}
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
                      // Width follows the field (no fixed 400px, which left it narrower).
                      sx: {
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
                    <TextField {...params} placeholder="Select..." sx={headerFieldSx} />
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
                  // Reference multi-select: ONE grey chip - the group name when a single
                  // group is picked, "N Selected..." for more - so the field stays 42px
                  // instead of growing a chip per group.
                  renderTags={(value) => (
                    <Box
                      component="span"
                      sx={{
                        display: 'inline-block',
                        maxWidth: '100%',
                        ml: '4px',
                        px: '8px',
                        py: '2px',
                        borderRadius: '4px',
                        bgcolor: '#e5e5e5',
                        fontSize: 16,
                        color: '#000',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {value.length === 1 ? value[0].name : `${value.length} Selected...`}
                    </Box>
                  )}
                  sx={{
                    '& .MuiAutocomplete-inputRoot': { flexWrap: 'nowrap', height: 42, py: '0 !important' },
                    '& .MuiAutocomplete-input': { minWidth: 0 }
                  }}
                  renderOption={(props, option, { selected }) => (
                    <Box component="li" {...props} key={option.id} sx={{ fontSize: 16, minHeight: '46px' }}>
                      <Checkbox size="small" checked={selected} sx={{ mr: 1, p: 0.5 }} />
                      {option.name}
                    </Box>
                  )}
                  slotProps={{
                    paper: {
                      // Width follows the field (no fixed 400px, which left it narrower).
                      sx: {
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
            {/* Reference shows Mix criteria only once there are 2+ criteria to mix;
                with fewer, Active moves left into its place. */}
            {criteria.length >= 2 && (
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
            )}
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
                    md={expandedItems[criterion.id] ? 5 : expandedCriteria[criterion.id] ? 2 : 6}
                    sx={{ borderRight: '1px solid #e0e0e0', transition: 'flex-basis 0.25s ease, max-width 0.25s ease' }}
                  >
                    <Box 
                      sx={{ 
                        bgcolor: expandedItems[criterion.id] ? '#5ebbeb' : '#676b72',
                        color: 'white', 
                        p: 1.5,
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        '&:hover': { bgcolor: expandedItems[criterion.id] ? '#4aa9dd' : '#565a60' }
                      }}
                      onClick={() => toggleItemsExpansion(criterion.id)}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                        {expandedItems[criterion.id] ? 'Items and Rebate' : 'Edit Items and Rebate'}
                      </Typography>
                    </Box>
                    {expandedItems[criterion.id] ? (
                      <Box sx={{ p: 2 }}>
                            <TextField
                          fullWidth
                          placeholder="Search for a product or classification..."
                          value={searchTerms[criterion.id] || ''}
                          onChange={(e) => handleSearch(criterion.id, e.target.value)}
                          onKeyDown={resultKeys.handleKeyDown(criterion.id, searchResults[criterion.id], (r) => handleAddItemToCriterion(criterion.id, r), () => setSearchResults((prev) => ({ ...prev, [criterion.id]: [] })))}
                              size="small"
                          sx={{ mb: 2 }}
                        />

                        {searchResults[criterion.id] && searchResults[criterion.id].length > 0 && (
                          <Paper sx={{ mb: 2, maxHeight: 200, overflow: 'auto' }}>
                            {searchResults[criterion.id].map((result, i) => (
                              <Box
                                key={`${result.resultType}-${result.id}`}
                                onClick={() => handleAddItemToCriterion(criterion.id, result)}
                                sx={{
                                  p: 1.5,
                                  cursor: 'pointer',
                                  borderBottom: '1px solid #f0f0f0',
                                  '&:hover': { bgcolor: '#f5f5f5' },
                                  ...(resultKeys.isActive(criterion.id, i) ? ACTIVE_ROW_SX : {})
                                }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                    {result.name}
                                  </Typography>
                                  {result.resultType !== 'PRODUCT' && (
                                    <Chip
                                      size="small"
                                      label="Classification"
                                      sx={{ height: 18, fontSize: '0.65rem' }}
                                    />
                                  )}
                                </Box>
                                <Typography variant="caption" color="text.secondary">
                                  {result.resultType === 'CLASSIFICATION'
                                    ? `${result.type || 'Classification'} · adds its products`
                                    : `$${result.prices?.[0]?.price || 0}`}
                                </Typography>
                              </Box>
                            ))}
                          </Paper>
                        )}

                        {/* Reference keeps the column header even when the criterion is empty. */}
                          <Box>
                            <Box sx={{
                              display: 'grid', 
                              gridTemplateColumns: '60px 1fr 120px 80px 40px',
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
                              <Box></Box>
                            </Box>

                            {criterion.items.length === 0 && (
                              <Box sx={{ textAlign: 'center', py: 2 }}>
                                <Typography variant="body2" color="text.secondary">
                                  No items in criteria
                                </Typography>
                              </Box>
                            )}

                            {criterion.items.map((item) => {
                              const itemProfit = calculateItemProfit(criterion, item);
                              return (
                                <Box 
                                  key={item.id} 
                                  sx={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: '60px 1fr 120px 80px 40px',
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
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                      {item.name || item.productName || 'Unknown Product'}
                                    </Typography>
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
                                  {/* Reference "%": the item's profit after the rebate. */}
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      // Reference: 0% or a loss is red, a profit dark; a spend
                                      // criterion has no per-item margin and shows a dark 0.00%.
                                      color: profitHidden(criterion) ? 'text.primary'
                                        : itemProfit != null && itemProfit <= 0 ? 'error.main'
                                        : itemProfit > 0 ? 'text.primary' : 'text.secondary',
                                      fontWeight: 500
                                    }}
                                  >
                                    {profitHidden(criterion) ? '0.00%' : formatProfitPct(itemProfit)}
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
                      </Box>
                    ) : (
                      <Box sx={{ p: 2, cursor: 'pointer' }} onClick={() => toggleItemsExpansion(criterion.id)}>
                        {criterion.items.length === 0 ? (
                          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
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
                    md={expandedCriteria[criterion.id] ? 10 : expandedItems[criterion.id] ? 7 : 6}
                    sx={{ transition: 'flex-basis 0.25s ease, max-width 0.25s ease' }}
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
                      <Box sx={{ p: 2, display: 'flex', alignItems: 'center' }}>
                        {/* The controls take the remaining width so the PROFIT column
                            sits at the same right edge on every criterion; before, a
                            wider control row pushed it left. */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
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
                              {/* Reference: "Purchase"/"Spend" on a Required criterion, lower case after "Optionally" */}
                              <MenuItem value="purchase">{criterion.isOptional ? 'purchase' : 'Purchase'}</MenuItem>
                              <MenuItem value="spend">{criterion.isOptional ? 'spend' : 'Spend'}</MenuItem>
                            </Select>
                          </FormControl>
                          
          <NumberField
                            size="small"
                            value={blankFields[criterion.id]?.purchaseValue ? '' : criterion.purchaseValue}
                            fallback=""
                            onCommit={(n) => commitCriterionValue(criterion.id, 'purchaseValue', n)}
                            sx={{ width: 80 }}
                            InputProps={{
                              startAdornment: criterion.purchaseType === 'spend' ? (
                                <Typography sx={{ mr: 0.5 }}>$</Typography>
                              ) : null
                            }}
                          />

                          {/* Reference (TEST store, 09/10): a purchase shows a grey "exactly" chip
                              and a spend plain "or more" text with 2+ criteria or once a value is
                              entered; "of any product" joins once a value is entered. */}
                          {showMatchChip(criterion, criteria.length, blankFields[criterion.id]?.purchaseValue) && (criterion.purchaseType === 'spend' ? (
                            <Typography>or more</Typography>
                          ) : (
                            <Button variant="outlined" size="small" disabled>
                              exactly
                            </Button>
                          ))}

                          {showAnyProductChip(criterion, blankFields[criterion.id]?.purchaseValue) && (
                            <Button variant="outlined" size="small" disabled>
                              of any product
                            </Button>
                          )}

                          {/* Reference: "(quantity only)" has nothing to receive, so the words go too. */}
                          {criterion.receiveType !== 'quantity_only' && <Typography>to receive</Typography>}
                          
                          <FormControl size="small" sx={{ minWidth: 250 }}>
                            <Select
                              value={criterion.receiveType}
                              onChange={(e) => handleUpdateCriterion(criterion.id, 'receiveType', e.target.value)}
                            >
                              {/* reference order; spend has its own list */}
                              {receiveOptions(criterion).map((o) => (
                                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          
                          {(criterion.receiveType !== 'quantity_only' && criterion.receiveType !== 'free_item') && (
                            <NumberField
                              size="small"
                              value={blankFields[criterion.id]?.receiveValue ? '' : criterion.receiveValue}
                              fallback=""
                              onCommit={(n) => commitCriterionValue(criterion.id, 'receiveValue', n)}
                              sx={{ width: 100 }}
            InputProps={{
                                // Reference: "$" before the amount, "%" after the percentage.
                                startAdornment: criterion.receiveType === 'percentage_discount' || criterion.receiveType === 'same_sell_rate' ? null : (
                                  <Typography sx={{ mr: 0.5 }}>$</Typography>
                                ),
                                endAdornment: criterion.receiveType === 'percentage_discount' ? (
                                  <Typography sx={{ ml: 0.5 }}>%</Typography>
                                ) : null
                              }}
                            />
                          )}

                          {criterion.receiveType === 'percentage_discount' && (
                            <Button variant="outlined" size="small" disabled>
                              off the base price
                            </Button>
                          )}
                        </Box>

                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', flexShrink: 0, ml: 2, minWidth: 170 }}>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                              PROFIT
                        </Typography>
                            <Typography 
                              variant="h4" 
                              sx={{ 
                                color: criterionProfitColor(criterion),
                                fontWeight: 'bold',
                                mb: 2
                              }}
                            >
                              {profitHidden(criterion) ? '-' : criterion.items.length === 0 ? '0.00%' : formatProfitPct(calculateAverageItemProfit(criterion))}
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
                      <Box sx={{ p: 2, display: 'flex', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary', flex: 1 }}>
                          {getCriterionSummary(criterion)}
                        </Typography>

                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', flexShrink: 0, ml: 2, minWidth: 170 }}>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                              PROFIT
                            </Typography>
                            <Typography 
                              variant="h4" 
                              sx={{ 
                                color: criterionProfitColor(criterion),
                                fontWeight: 'bold',
                                mb: 2
                              }}
                            >
                              {profitHidden(criterion) ? '-' : criterion.items.length === 0 ? '0.00%' : formatProfitPct(calculateAverageItemProfit(criterion))}
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

        <PromotionSimulatorPanel
          open={showSimulator}
          search={{
            value: searchTerms.sim || '',
            onChange: (v) => handleSearch('sim', v),
            onKeyDown: resultKeys.handleKeyDown('sim', (searchResults.sim || []).filter((r) => r.resultType === 'PRODUCT'), handleAddSimProduct, () => setSearchResults((prev) => ({ ...prev, sim: [] }))),
            results: (searchResults.sim || []).filter((r) => r.resultType === 'PRODUCT'),
            onPick: handleAddSimProduct
          }}
          lines={(() => {
            const sim = evaluateSimulator();
            return simBasket.map((item, index) => {
              const normal = simLineTotal(item);
              const price = sim.prices?.get(index) ?? normal;
              return { key: index, quantity: item.quantity, name: item.name, total: price, active: price < normal - 0.004 };
            });
          })()}
          onQuantity={(key, n) => setSimBasket(prev => prev.map((it, i) => (i === key ? { ...it, quantity: n } : it)))}
          onRemove={(key) => setSimBasket(prev => prev.filter((_, i) => i !== key))}
        />
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
        {/* Same bar chrome as the shelf-ticket pages: 42px pills, 12px radius, bold 16px. */}
        <Button
          disableRipple
          disableElevation
          startIcon={<CancelIcon />}
          component={RouterLink} to={'/marketing/promotions'}
          sx={{
            height: 42,
            px: '24px',
            borderRadius: '12px',
            fontSize: 16,
            fontWeight: 700,
            textTransform: 'none',
            bgcolor: '#fb2c36',
            color: '#fff',
            boxShadow: 'none',
            '&:hover': { bgcolor: '#ff6467', boxShadow: 'none' }
          }}
        >
          Cancel
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* The app's flat pill toggle; on the sky bar the ON track turns white with a sky thumb. */}
          <ShopfrontSwitch
            checked={showSimulator}
            onChange={(e) => setShowSimulator(e.target.checked)}
            sx={{
              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#fff' },
              '& .MuiSwitch-switchBase.Mui-checked .MuiSwitch-thumb': { backgroundColor: '#5ebbeb' },
              '&:hover .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#f1f5f9' }
            }}
          />
          <Typography sx={{ fontSize: 16, color: '#fff' }}>Show Simulator</Typography>
        </Box>
        <Button
          disableRipple
          disableElevation
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={saving}
          sx={{
            height: 42,
            px: '24px',
            borderRadius: '12px',
            fontSize: 16,
            fontWeight: 700,
            textTransform: 'none',
            bgcolor: '#fff',
            color: '#00a6f4',
            border: '1px solid #fff',
            boxShadow: 'none',
            '&:hover': { bgcolor: '#f0f9ff', boxShadow: 'none' },
            '&.Mui-disabled': { bgcolor: '#fff', color: '#00a6f4', opacity: 0.7 }
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>

      {/* Edit Schedule (shared with the Express editor) */}
      <EditScheduleDialog
        open={scheduleOpen}
        value={formData.schedule}
        onClose={() => setScheduleOpen(false)}
        onContinue={(schedule) => { handleInputChange('schedule', schedule); setScheduleOpen(false); }}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PromotionDetails;
