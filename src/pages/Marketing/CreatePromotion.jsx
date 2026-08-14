import React, { useState, useEffect } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  DeleteOutline as DeleteIcon,
  RadioButtonChecked,
  RadioButtonUnchecked
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { usePickerContext } from '@mui/x-date-pickers/hooks';
import { format as formatDate } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import promotionService from '../../services/promotionService';
import promotionCategoryService from '../../services/promotionCategoryService';
import productService from '../../services/productService';
import productComboService from '../../services/productComboService';
import classificationService from '../../services/classificationService';

const GRADIENT = 'linear-gradient(to bottom right,#5da2ba,#2193b0,#283c86,#4bc0c8,#283c86,#2193b0)';
const NEAR_WHITE = '#f8f8f8';
const INVALID = '#bdbdbd';

// The reference wizard is DYNAMIC: four base questions, then the chosen promotion
// type injects its own questions (5 dots -> 7). Shopfront's Page Rules spec calls the
// dot count "questionsLeft: an approximate number of questions left", which is why a
// single placeholder stands in for the not-yet-known type steps.
const BASE_STEPS = ['name', 'dates', 'category', 'type'];

// "Buy 'X' get 'Y'" needs two conditions, so it asks six questions (10 dots): what
// x is, how much of it, what y is, how much of y is given, how y is discounted and
// by how much. The three discount options are the documented Express types.
const TYPE_STEPS = {
  'Buy X for Y': ['item', 'quantity', 'price'],
  'Buy X get Y% off': ['item', 'quantity', 'percent'],
  'Buy X get Y': ['item', 'quantity', 'reward', 'rewardQuantity', 'rewardType', 'rewardValue'],
  'Spend X get Y': ['spend', 'reward'],
  'Combo Deal': ['combo']
};

const stepsFor = (type) => [...BASE_STEPS, ...(TYPE_STEPS[type] || ['pending'])];

const STEP_HEADERS = {
  name: "What is the promotion's name?",
  dates: 'When does the promotion run?',
  category: 'What is the Promotion Category?',
  type: 'What type of promotion do you wish to run?',
  item: "What is 'x'?",
  quantity: "How much of 'x' should be sold?",
  price: 'What is $y?',
  percent: 'What is y%?',
  reward: "What is 'y'?",
  rewardQuantity: "How much of 'y' should be given?",
  rewardType: "How should 'y' be discounted?",
  rewardValue: "What is the discount on 'y'?",
  spend: 'How much needs to be spent?',
  combo: 'What is in the combo?'
};

// Docs (Express promotions): the three ways a promotion line prices an item.
const REWARD_TYPES = [
  {
    value: 'Price Override',
    label: 'Price Override',
    description: 'Sell the item/s "Y" for a fixed promotional price'
  },
  {
    value: 'Discount Percentage',
    label: 'Discount Percentage',
    description: 'Take a percentage off the price of the item/s "Y"'
  },
  {
    value: 'Discount Amount',
    label: 'Discount Amount',
    description: 'Take a dollar amount off the price of the item/s "Y"'
  }
];

// The item search matches products, classifications AND product combos (same
// sources as the Advanced editor). Results are grouped under bold headers.
const ITEM_GROUP_LABELS = {
  CATEGORY: 'Category',
  BRAND: 'Brand',
  FAMILY: 'Family',
  TAG: 'Tag',
  PRODUCT: 'Product',
  COMBO: 'Product Combo'
};

const itemGroupOf = (option) =>
  option?.resultType === 'CLASSIFICATION'
    ? (ITEM_GROUP_LABELS[String(option.type || '').toUpperCase()] || 'Category')
    : (ITEM_GROUP_LABELS[option?.resultType] || 'Product');

// Docs: single-condition types are Express; anything needing two conditions is Advanced.
const EXPRESS_TYPES = ['Buy X for Y', 'Buy X get Y% off'];

const promotionTypes = [
  {
    value: 'Buy X for Y',
    label: "Buy 'X' for $Y",
    description: 'Buy the item/s "X" and get it for the price of "Y"'
  },
  {
    value: 'Buy X get Y% off',
    label: "Buy 'X' get Y% off",
    description: 'Buy the item/s "X" and get "Y" percent off of the price'
  },
  {
    value: 'Buy X get Y',
    label: "Buy 'X' get 'Y'",
    description: 'Buy the item/s "X" and get item/s "Y" on promotion'
  },
  {
    value: 'Spend X get Y',
    label: "Spend $X get 'Y'",
    description: 'Spend "X" dollars on item/s and get item/s "Y" on promotion'
  },
  {
    value: 'Other',
    label: 'Other',
    description: 'Every other type of promotion'
  }
  // ponytail: the reference chooser has exactly these five cards, so no 'Combo Deal'
  // card. The combo builder/service below stay wired but unreachable from the wizard;
  // Combo Deal promotions are still created/edited through PromotionDetails.
];

// Reference: name/quantity/price inputs are white, square, 1px solid #000, 53px tall.
const blockFieldSx = {
  '& .MuiOutlinedInput-root': { height: 53, borderRadius: 0, backgroundColor: '#fff' },
  '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #000' },
  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { border: '1px solid #000' },
  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { border: '1px solid #000' },
  '& input::placeholder': { color: '#808080', opacity: 1 }
};

// Reference: the async item select and the date pickers are 8px-rounded, 1px #404040.
const roundFieldSx = {
  '& .MuiOutlinedInput-root': { borderRadius: '8px', backgroundColor: '#fff', py: '2px' },
  '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #404040' },
  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { border: '1px solid #404040' },
  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { border: '1px solid #404040' },
  '& input::placeholder': { color: '#808080', opacity: 1 }
};

// Reference: the two date inputs are plain white squares (1px #000, no radius,
// ~37px tall) placeholdered "Start Date" / "End Date" — no calendar icon button.
const dateFieldSx = {
  ...blockFieldSx,
  '& .MuiOutlinedInput-root': {
    height: 37,
    borderRadius: 0,
    backgroundColor: '#fff',
    cursor: 'pointer'
  },
  '& .MuiOutlinedInput-input': { padding: '6px 12px', fontSize: 16, cursor: 'pointer' }
};

// Reference: the option menus are white, 1px #000, square and un-shadowed, with
// bold group headers separated by dividers and a light-blue fill on picked rows.
const menuPaperSx = {
  backgroundColor: '#fff',
  border: '1px solid #000',
  borderRadius: 0,
  boxShadow: 'none',
  '& .MuiAutocomplete-listbox': { padding: 0 },
  '& .MuiAutocomplete-option': { fontSize: 16, color: '#000', minHeight: 36 },
  '& .MuiAutocomplete-option[aria-selected="true"]': { backgroundColor: 'rgba(94,187,235,0.25)' },
  '& .MuiAutocomplete-option[aria-selected="true"].Mui-focused': {
    backgroundColor: 'rgba(94,187,235,0.35)'
  },
  '& .MuiAutocomplete-noOptions, & .MuiAutocomplete-loading': { fontSize: 16, color: '#000' }
};

// Reference: the picker popover — 12px radius, #f5f5f5, 1px #e5e5e5, shadow-xl.
const pickerPopoverSx = {
  borderRadius: '12px',
  backgroundColor: '#f5f5f5',
  border: '1px solid #e5e5e5',
  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)'
};

const SLIDE_KEYFRAMES = {
  '@keyframes cwSlideInRight': {
    '0%': { opacity: 0, transform: 'translateX(200%)' },
    '100%': { opacity: 1, transform: 'translateX(0)' }
  },
  '@keyframes cwSlideInLeft': {
    '0%': { opacity: 0, transform: 'translateX(-200%)' },
    '100%': { opacity: 1, transform: 'translateX(0)' }
  },
  '@keyframes cwSlideOutLeft': {
    '0%': { opacity: 1, transform: 'translateX(0)' },
    '100%': { opacity: 0, transform: 'translateX(-200%)' }
  },
  '@keyframes cwSlideOutRight': {
    '0%': { opacity: 1, transform: 'translateX(0)' },
    '100%': { opacity: 0, transform: 'translateX(200%)' }
  }
};

// Reference: .creation-wizard-opacity — top bar, page body and controls fade in.
const fadeInSx = {
  '@keyframes cwFade': { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
  animation: 'cwFade .2s ease'
};

// Custom picker field: a plain placeholdered input, no calendar icon button.
// Clicking the field still opens our date picker, so nothing is lost.
const WizardDateField = ({ placeholder }) => {
  const { value, setOpen, triggerRef } = usePickerContext();
  const text =
    value instanceof Date && !Number.isNaN(value.getTime())
      ? formatDate(value, 'dd/MM/yyyy HH:mm:ss')
      : '';
  return (
    <TextField
      fullWidth
      ref={triggerRef}
      value={text}
      placeholder={placeholder}
      onClick={() => setOpen(true)}
      InputProps={{ readOnly: true }}
      sx={dateFieldSx}
    />
  );
};

const CreatePromotion = () => {
  const navigate = useNavigate();
  const { getOutletId } = useAuth();

  // getOutletId() reads the logged-in user's own outlet and returns null for
  // super admins, who instead pick an outlet in the navbar
  // (SelectedOutletContext persists it to localStorage as 'selectedOutletId').
  // The apiClient interceptor only injects the selected outlet on GET requests,
  // so POST payloads must resolve it here or super-admin-created promotions
  // end up with outletId=null and never show in the outlet-scoped list.
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

  const [activeStep, setActiveStep] = useState(0);
  const [direction, setDirection] = useState('forward');
  const [outgoing, setOutgoing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    promotionType: '',
    categoryId: '',
    isRecurring: false,
    startDate: null,
    endDate: null,
    availableTo: 'All Customers',
    customerGroupIds: [],
    minimumSpend: '',
    maximumDiscount: '',
    discountType: '',
    discountValue: '',
    maxUses: '',
    priority: 0,
    conditions: {},
    schedule: {},
    items: []
  });

  const [categories, setCategories] = useState([]);

  // Answers to the type-specific questions. The item pickers are multi-select:
  // each entry is a product, a classification or a product combo.
  const [itemX, setItemX] = useState([]);
  const [itemY, setItemY] = useState([]);
  const [quantity, setQuantity] = useState('');
  const [orMore, setOrMore] = useState(false);
  const [typeValue, setTypeValue] = useState(''); // price / percentage / spend threshold
  const [rewardQuantity, setRewardQuantity] = useState('');
  const [rewardType, setRewardType] = useState('');
  const [rewardValue, setRewardValue] = useState('');

  // Async product select (reference: 3 chars minimum before searching)
  const [itemQuery, setItemQuery] = useState('');
  const [itemOptions, setItemOptions] = useState([]);
  const [itemSearching, setItemSearching] = useState(false);

  // SKIP -> Express or Advanced (documented Shopfront behaviour)
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);

  // Combo Deal state
  const [comboItems, setComboItems] = useState([]); // { productId, productName, quantity, unitPrice }
  const [comboPrice, setComboPrice] = useState('');
  const [selectedCombo, setSelectedCombo] = useState(null);
  const [availableCombos, setAvailableCombos] = useState([]);
  const [combosLoaded, setCombosLoaded] = useState(false);
  const [saveAsCombo, setSaveAsCombo] = useState(false);
  const [comboProductSearch, setComboProductSearch] = useState('');
  const [comboProductResults, setComboProductResults] = useState([]);

  const steps = stepsFor(formData.promotionType);
  const stepKey = steps[activeStep];
  const isLastStep = activeStep === steps.length - 1;

  // The category question must never be a dead dropdown. 'all' is the documented
  // bypass for the apiClient outlet auto-filter: without it a super admin viewing
  // outlet A sees "No options" whenever the tenant's categories were created under
  // outlet B (the reference lists every category of the tenant). Outlet users are
  // unaffected — the API always scopes them to their own outlet plus global ones.
  // Re-fetch on reaching the question too, so a call that fired before the session
  // was ready cannot leave the list empty forever.
  const fetchCategories = async () => {
    try {
      const response = await promotionCategoryService.getPromotionCategories('all');
      const list = Array.isArray(response)
        ? response
        : Array.isArray(response?.promotionCategories)
          ? response.promotionCategories
          : [];
      // Reference lists the tenant's categories in name order.
      setCategories([...list].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''))));
      return list.length;
    } catch (error) {
      console.error('Error fetching categories:', error);
      showSnackbar('Could not load promotion categories', 'error');
      return 0;
    }
  };

  useEffect(() => {
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (stepKey === 'category' && categories.length === 0) {
      fetchCategories();
    }
    // Lazily fetch existing Product Combos when the user reaches the combo question.
    if (stepKey === 'combo' && !combosLoaded) {
      fetchAvailableCombos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey]);

  const fetchAvailableCombos = async () => {
    try {
      setCombosLoaded(true);
      const response = await productComboService.getProductCombos({
        outletId: resolveOutletId(),
        status: 'Active'
      });
      setAvailableCombos(Array.isArray(response?.combos) ? response.combos : []);
    } catch (error) {
      console.error('Error fetching product combos:', error);
      setAvailableCombos([]);
    }
  };

  // Reference: 1-2 characters show "Keep Typing to Search...", 3+ actually search.
  // Products, classifications and product combos all match, grouped in the menu.
  const searchItems = async (term) => {
    const query = term.trim();
    if (query.length < 3) {
      setItemOptions([]);
      return;
    }
    setItemSearching(true);
    const [products, classifications, combos] = await Promise.all([
      productService.getProducts({ search: query, limit: 20 }).then((r) => r?.products || []).catch(() => []),
      classificationService.getClassifications({ search: query }).then((r) => r?.classifications || []).catch(() => []),
      productComboService
        .getProductCombos({ search: query, status: 'Active', limit: 20 })
        .then((r) => r?.combos || [])
        .catch(() => [])
    ]);
    // Concatenated in group order — MUI groups consecutive options only.
    setItemOptions([
      ...classifications.map((c) => ({ ...c, resultType: 'CLASSIFICATION' })),
      ...products.map((p) => ({ ...p, resultType: 'PRODUCT' })),
      ...combos.map((c) => ({ ...c, resultType: 'COMBO' }))
    ]);
    setItemSearching(false);
  };

  // A classification or a combo is shorthand for its member products: expand it so
  // the promotion rows always carry a productId (what the sell screen matches on).
  const expandSelections = async (selections) => {
    const rows = [];
    const seen = new Set();
    for (const selection of Array.isArray(selections) ? selections : []) {
      let products = [selection];
      if (selection?.resultType === 'CLASSIFICATION') {
        products = await classificationService
          .getClassificationProducts(selection.id)
          .then((r) => r?.assignedProducts || [])
          .catch(() => []);
      } else if (selection?.resultType === 'COMBO') {
        let combo = selection;
        if (!Array.isArray(combo.items) || combo.items.length === 0) {
          combo = await productComboService
            .getProductCombo(selection.id)
            .then((r) => r?.combo || r || selection)
            .catch(() => selection);
        }
        products = (combo.items || []).map((i) => i.product).filter(Boolean);
      }
      for (const product of products) {
        if (product?.id != null && !seen.has(product.id)) {
          seen.add(product.id);
          rows.push(product);
        }
      }
    }
    return rows;
  };

  const isStepValid = () => {
    switch (stepKey) {
      case 'name':
        return formData.name.trim() !== '';
      case 'type':
        return formData.promotionType !== '';
      case 'item':
        return itemX.length > 0;
      case 'reward':
        return itemY.length > 0;
      case 'quantity':
        return (parseFloat(quantity) || 0) > 0;
      case 'price':
      case 'percent':
      case 'spend':
        return (parseFloat(typeValue) || 0) > 0;
      case 'rewardQuantity':
        return (parseFloat(rewardQuantity) || 0) > 0;
      case 'rewardType':
        return rewardType !== '';
      case 'rewardValue':
        return (parseFloat(rewardValue) || 0) > 0;
      case 'combo':
        return comboItems.length > 0 && (parseFloat(comboPrice) || 0) > 0;
      // Dates and category are optional — the reference leaves NEXT enabled on both.
      default:
        return true;
    }
  };

  const goToStep = (target) => {
    if (target === activeStep || target < 0 || target >= steps.length) return;
    setDirection(target > activeStep ? 'forward' : 'backward');
    setOutgoing({ step: activeStep, dir: target > activeStep ? 'forward' : 'backward' });
    setActiveStep(target);
  };

  // The dots jump between questions, but the injected type questions do not exist
  // until a type has been chosen.
  const handleDotClick = (idx) => {
    if (idx >= BASE_STEPS.length && !TYPE_STEPS[formData.promotionType]) return;
    goToStep(idx);
  };

  const handleNext = () => {
    if (!isStepValid() || loading) return;
    if (isLastStep) {
      handleFinish();
    } else {
      goToStep(activeStep + 1);
    }
  };

  const handleBack = () => goToStep(activeStep - 1);

  const handleCancel = () => navigate('/marketing/promotions');

  // Every exit from the wizard needs a name: the API rejects a blank one and a nameless
  // row is an invisible, unclickable line in the list. NEXT already enforces it on the
  // name question, but SKIP and the dot rail can jump past it, so re-check at the exits.
  const nameValid = formData.name.trim() !== '';
  const requireName = () => {
    if (nameValid) return true;
    showSnackbar('Promotion name is required', 'error');
    goToStep(0);
    return false;
  };

  // SKIP takes you straight to an edit page (docs: "at any point in the wizard").
  // On the base steps the type is not yet chosen, so ask Express vs Advanced. Once a
  // type is selected (the injected 'item'/'quantity'/'price' steps) the editor is
  // already implied, so skip the redundant dialog and create straight through — the
  // reference shows no Promotion Type dialog on those steps.
  const handleSkip = () => {
    if (loading || !requireName()) return;
    if (TYPE_STEPS[formData.promotionType]) {
      handleFinish();
    } else {
      setSkipDialogOpen(true);
    }
  };

  // Clicking a type card immediately advances; "Other" drops out of the wizard into
  // the full promotion editor.
  const handleTypeSelect = (value) => {
    if (loading) return;
    if (value === 'Other') {
      openEditorWithDraft('advanced', 'Other');
      return;
    }
    setFormData((prev) => ({ ...prev, promotionType: value }));
    setDirection('forward');
    setOutgoing({ step: activeStep, dir: 'forward' });
    setActiveStep(BASE_STEPS.length);
  };

  // Same behaviour as the type chooser: picking a card answers and advances.
  const handleRewardTypeSelect = (value) => {
    if (loading) return;
    setRewardType(value);
    goToStep(activeStep + 1);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const showSnackbar = (message, severity) => setSnackbar({ open: true, message, severity });
  const handleSnackbarClose = () => setSnackbar({ open: false, message: '', severity: 'success' });

  const getDefaultUnitPrice = (product) => {
    if (product?.prices && product.prices.length > 0) {
      const priceForQty1 = product.prices.find((p) => p.quantity === 1);
      return parseFloat(priceForQty1 ? priceForQty1.price : (product.prices[0]?.price || 0)) || 0;
    }
    return 0;
  };

  // The wizard answers become PromotionItem rows — the same shape the express editor
  // hydrates from and the sell-screen matcher keys on (productId).
  const buildItems = async () => {
    const rows = [];
    const value = parseFloat(typeValue) || 0;
    const reward = parseFloat(rewardValue) || 0;

    for (const product of await expandSelections(itemX)) {
      rows.push({
        productId: product.id,
        productName: product.name,
        quantity: parseInt(quantity, 10) || 1,
        normalPrice: getDefaultUnitPrice(product),
        promoPrice: formData.promotionType === 'Buy X for Y' ? value : 0,
        discountAmount: 0,
        discountPercentage: formData.promotionType === 'Buy X get Y% off' ? value : 0,
        rebate: 0,
        isRequired: true
      });
    }

    for (const product of await expandSelections(itemY)) {
      rows.push({
        productId: product.id,
        productName: product.name,
        quantity: parseInt(rewardQuantity, 10) || 1,
        normalPrice: getDefaultUnitPrice(product),
        promoPrice: rewardType === 'Price Override' ? reward : 0,
        discountAmount: rewardType === 'Discount Amount' ? reward : 0,
        discountPercentage: rewardType === 'Discount Percentage' ? reward : 0,
        rebate: 0,
        isRequired: false
      });
    }

    return rows;
  };

  const buildPayload = async (type) => ({
    ...formData,
    promotionType: type,
    outletId: resolveOutletId(),
    minimumSpend: type === 'Spend X get Y' ? (parseFloat(typeValue) || null) : null,
    // "Or more" makes the quantity a minimum rather than an exact count (the Advanced
    // editor calls this Quantity Type). No column exists for it, so it rides in the
    // free-form conditions JSON the API already stores.
    conditions: quantity ? { quantityType: orMore ? 'more' : 'exactly' } : {},
    items: await buildItems()
  });

  // Leaving the wizard early (SKIP, or the "Other" type) hands the answers so far to the
  // editor WITHOUT writing anything: the editor POSTs on its first save, so backing out
  // of it leaves no orphan promotion in the list. The editors already branch on a missing
  // :id, so the sentinel 'new' segment drops them straight into their create path.
  const openEditorWithDraft = (mode, typeOverride) => {
    if (!requireName()) return;
    const type = typeOverride ?? formData.promotionType;
    const express = mode === 'express' || (mode === 'auto' && EXPRESS_TYPES.includes(type));
    const ymd = (d) => (d ? formatDate(new Date(d), 'yyyy-MM-dd') : '');
    const draft = {
      name: formData.name.trim(),
      categoryId: formData.categoryId,
      startDate: ymd(formData.startDate),
      endDate: ymd(formData.endDate),
      // promotionType is NOT NULL in the schema. The express editor has its own type
      // selector and default, so a blank must not clobber it; the advanced editor has no
      // type field at all, so stamp the wizard's choice — or 'Other', the type its own
      // "Other" card uses — otherwise its POST has no type and the API 500s.
      ...(express ? (type ? { promotionType: type } : {}) : { promotionType: type || 'Other' })
    };
    setSkipDialogOpen(false);
    navigate(express ? '/marketing/promotions/express/new' : '/marketing/promotions/new/edit', {
      state: { draft }
    });
  };

  // mode: 'express' | 'advanced' | 'auto' (auto = decided by the chosen promotion type).
  // typeOverride carries the type when the click that creates the promotion is the same
  // click that chooses it ("Other"), since setFormData has not committed yet.
  const createPromotion = async (mode, typeOverride) => {
    const type = typeOverride ?? formData.promotionType;
    try {
      setLoading(true);
      const response = await promotionService.createPromotion(await buildPayload(type));
      const newId = response?.promotion?.id ?? response?.id;
      showSnackbar('Promotion created successfully', 'success');

      if (!newId) {
        navigate('/marketing/promotions');
        return;
      }
      const express = mode === 'express' || (mode === 'auto' && EXPRESS_TYPES.includes(type));
      navigate(express ? `/marketing/promotions/express/${newId}` : `/marketing/promotions/${newId}/edit`);
    } catch (error) {
      console.error('Error creating promotion:', error);
      showSnackbar(error.response?.data?.error || 'Failed to create promotion', 'error');
    } finally {
      setLoading(false);
      setSkipDialogOpen(false);
    }
  };

  const handleFinish = () => {
    if (!requireName()) return;
    if (formData.promotionType === 'Combo Deal') {
      handleCreateComboPromotion();
      return;
    }
    createPromotion('auto');
  };

  // ---- Combo Deal helpers ----

  const searchComboProducts = async (term) => {
    if (!term || !term.trim()) {
      setComboProductResults([]);
      return;
    }
    try {
      const response = await productService.getProducts({ search: term, limit: 20 });
      setComboProductResults(Array.isArray(response?.products) ? response.products : []);
    } catch (error) {
      console.error('Error searching products:', error);
      setComboProductResults([]);
    }
  };

  const handleSelectExistingCombo = (combo) => {
    setSelectedCombo(combo || null);
    if (!combo) return;
    const items = (combo.items || [])
      .map((it) => ({
        productId: it.productId || it.product?.id,
        productName: it.product?.name || it.productName || 'Unknown Product',
        quantity: parseInt(it.quantity) || 1,
        unitPrice: parseFloat(it.price) > 0 ? parseFloat(it.price) : getDefaultUnitPrice(it.product)
      }))
      .filter((it) => it.productId);
    setComboItems(items);
    const rawPrice = parseFloat(combo.comboPrice) || parseFloat(combo.totalPrice) || parseFloat(combo.calculatedTotalPrice) || 0;
    setComboPrice(rawPrice > 0 ? String(rawPrice) : '');
    setSaveAsCombo(false);
  };

  const handleAddComboProduct = (product) => {
    if (!product) return;
    setComboItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.productId === product.id);
      if (existingIndex >= 0) {
        // Adding an already-present product increments its quantity
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
    setComboProductSearch('');
    setComboProductResults([]);
  };

  const handleComboItemQuantityChange = (index, value) => {
    const qty = Math.max(1, parseInt(value) || 1);
    setComboItems((prev) => prev.map((item, i) => (i === index ? { ...item, quantity: qty } : item)));
  };

  const handleRemoveComboItem = (index) => {
    setComboItems((prev) => prev.filter((_, i) => i !== index));
  };

  // DATA CONTRACT (consumed by the sell-screen combo engine):
  // - promotionType: 'Combo Deal'
  // - items: one PromotionItem per component product with promoPrice = the
  //   product's proportional unit share of the combo price
  // - conditions.combo: { comboId, comboPrice, totalQuantity, items: [{ productId,
  //   productName, quantity, unitPrice }] } — the canonical block the engine reads.
  //   Do NOT write conditions.criteria for combo deals.
  const buildComboPromotionPayload = (comboId) => {
    const price = parseFloat(comboPrice) || 0;
    const normalTotal = comboItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const totalQuantity = comboItems.reduce((sum, item) => sum + item.quantity, 0);

    const items = comboItems.map((item) => {
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
      promotionType: 'Combo Deal',
      outletId: resolveOutletId(),
      items,
      conditions: {
        combo: {
          comboId: comboId ?? null,
          comboPrice: price,
          totalQuantity,
          items: comboItems.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice
          }))
        }
      }
    };
  };

  const handleCreateComboPromotion = async () => {
    if (comboItems.length === 0) {
      showSnackbar('Add at least one product to the combo', 'error');
      return;
    }
    const price = parseFloat(comboPrice);
    if (!price || price <= 0) {
      showSnackbar('Enter a combo price greater than zero', 'error');
      return;
    }

    try {
      setLoading(true);
      let comboId = selectedCombo?.id ?? null;

      if (saveAsCombo && !selectedCombo) {
        try {
          const comboResponse = await productComboService.createProductCombo({
            name: formData.name || 'Combo Deal',
            description: formData.description,
            totalPrice: price,
            items: comboItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.unitPrice
            })),
            outletId: resolveOutletId(),
            isActive: true
          });
          comboId = comboResponse?.combo?.id ?? comboResponse?.id ?? null;
        } catch (comboError) {
          console.error('Error saving product combo:', comboError);
          comboId = null;
          showSnackbar('Could not save the Product Combo — the promotion will still be created', 'warning');
        }
      }

      const response = await promotionService.createPromotion(buildComboPromotionPayload(comboId));
      const newId = response?.promotion?.id ?? response?.id;
      showSnackbar('Combo deal promotion created successfully', 'success');
      if (newId) {
        navigate(`/marketing/promotions/${newId}/edit`);
      } else {
        navigate('/marketing/promotions');
      }
    } catch (error) {
      console.error('Error creating combo promotion:', error);
      const errorMessage = error.response?.data?.error || 'Failed to create promotion';
      showSnackbar(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ---- Question renderers ----

  // Reference: stacked 62px cards on a translucent black fill, 8px apart (70px
  // pitch), no hover state; clicking one answers the question and moves on.
  const renderChoiceCards = (choices, onPick) => (
    <Box>
      {choices.map((choice) => (
        <Box
          key={choice.value}
          onClick={() => onPick(choice.value)}
          sx={{
            mt: '0.5rem',
            height: 62,
            boxSizing: 'border-box',
            padding: '0.25rem 1rem',
            backgroundColor: 'rgba(0,0,0,0.4)',
            cursor: 'pointer'
          }}
        >
          <Typography component="h3" sx={{ fontSize: '1.17em', fontWeight: 700, color: '#fff' }}>
            {choice.label}
          </Typography>
          <Typography component="p" sx={{ fontSize: 16, color: '#fff' }}>
            {choice.description}
          </Typography>
        </Box>
      ))}
    </Box>
  );

  // Reference: an async MULTI-select — results grouped under bold headers with
  // dividers, a checkbox per row, a chip per pick and a clear-all button.
  const renderItemSelect = (value, onChange, placeholder = 'Select...') => (
    <Autocomplete
      multiple
      disableCloseOnSelect
      fullWidth
      options={itemOptions}
      value={value}
      loading={itemSearching}
      filterOptions={(options) => options}
      getOptionLabel={(option) => option?.name || ''}
      isOptionEqualToValue={(option, selected) =>
        option?.id === selected?.id && option?.resultType === selected?.resultType
      }
      groupBy={itemGroupOf}
      onChange={(event, newValue) => onChange(newValue)}
      onInputChange={(event, newValue, reason) => {
        if (reason === 'input') {
          setItemQuery(newValue);
          searchItems(newValue);
        } else if (reason === 'clear') {
          setItemQuery('');
          setItemOptions([]);
        }
      }}
      noOptionsText={itemQuery.trim().length < 3 ? 'Keep Typing to Search...' : 'No results found'}
      loadingText={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={16} />
          Searching...
        </Box>
      }
      slotProps={{ paper: { sx: menuPaperSx } }}
      renderGroup={(params) => (
        <li key={params.key}>
          <Box
            sx={{
              fontSize: 16,
              fontWeight: 700,
              color: '#000',
              padding: '6px 10px',
              borderBottom: '1px solid #000',
              backgroundColor: '#fff'
            }}
          >
            {params.group}
          </Box>
          <Box component="ul" sx={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {params.children}
          </Box>
        </li>
      )}
      renderOption={(props, option, { selected }) => (
        // Products and classifications can share an id, so key on both.
        <Box component="li" {...props} key={`${option.resultType}-${option.id}`}>
          <Checkbox checked={selected} size="small" sx={{ padding: 0, marginRight: '8px' }} />
          {option?.name || ''}
        </Box>
      )}
      renderInput={(params) => (
        <TextField {...params} placeholder={value.length > 0 ? '' : placeholder} sx={roundFieldSx} />
      )}
    />
  );

  const renderComboBuilder = () => {
    const normalTotal = comboItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const priceNum = parseFloat(comboPrice) || 0;
    const savings = normalTotal - priceNum;

    return (
      <Box>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6}>
            <Autocomplete
              options={Array.isArray(availableCombos) ? availableCombos : []}
              getOptionLabel={(option) => option?.name || ''}
              isOptionEqualToValue={(option, value) => option?.id === value?.id}
              value={selectedCombo}
              onChange={(event, newValue) => handleSelectExistingCombo(newValue)}
              renderInput={(params) => (
                <TextField {...params} placeholder="Start from an existing Product Combo" sx={roundFieldSx} />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Autocomplete
              options={comboProductResults}
              getOptionLabel={(option) => option?.name || ''}
              filterOptions={(options) => options}
              inputValue={comboProductSearch}
              value={null}
              blurOnSelect
              onInputChange={(event, newValue, reason) => {
                if (reason === 'input') {
                  setComboProductSearch(newValue);
                  searchComboProducts(newValue);
                } else if (reason === 'clear') {
                  setComboProductSearch('');
                  setComboProductResults([]);
                }
              }}
              onChange={(event, newValue) => handleAddComboProduct(newValue)}
              noOptionsText={comboProductSearch ? 'No products found' : 'Keep Typing to Search...'}
              renderInput={(params) => (
                <TextField {...params} placeholder="Search and add a product" sx={roundFieldSx} />
              )}
            />
          </Grid>
        </Grid>

        {comboItems.length === 0 ? (
          <Alert severity="info">
            No products in the combo yet. Search and add products, or start from an existing Product Combo.
          </Alert>
        ) : (
          <TableContainer component={Paper} sx={{ backgroundColor: 'white', borderRadius: 1 }}>
            <Table size="small">
              <TableBody>
                {comboItems.map((item, index) => (
                  <TableRow key={item.productId ?? index}>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell width={110}>
                      <TextField
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleComboItemQuantityChange(index, e.target.value)}
                        size="small"
                        inputProps={{ min: 1 }}
                        sx={{ width: 80 }}
                      />
                    </TableCell>
                    <TableCell width={110}>
                      ${((parseFloat(item.unitPrice) || 0) * (item.quantity || 1)).toFixed(2)}
                    </TableCell>
                    <TableCell align="right" width={60}>
                      <IconButton size="small" color="error" onClick={() => handleRemoveComboItem(index)}>
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Grid container spacing={2} sx={{ mt: 1 }} alignItems="center">
          <Grid item xs={12} sm={5}>
            <TextField
              fullWidth
              type="number"
              placeholder="Input combo price"
              value={comboPrice}
              onChange={(e) => setComboPrice(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                inputProps: { min: 0, step: 0.01 }
              }}
              sx={blockFieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={7}>
            <Typography sx={{ color: NEAR_WHITE }}>Normal total: ${normalTotal.toFixed(2)}</Typography>
            {priceNum > 0 && savings > 0 && (
              <Typography variant="body2" sx={{ color: '#7cfc98', fontWeight: 600 }}>
                Customer saves ${savings.toFixed(2)}
              </Typography>
            )}
            {priceNum > 0 && savings < 0 && (
              <Typography variant="body2" sx={{ color: '#ffcdd2' }}>
                Combo price is higher than the normal total.
              </Typography>
            )}
          </Grid>
        </Grid>

        {!selectedCombo && (
          <FormControlLabel
            sx={{ mt: 2, ml: 0, gap: 1 }}
            control={<ShopfrontSwitch checked={saveAsCombo} onChange={(e) => setSaveAsCombo(e.target.checked)} />}
            label={<Typography sx={{ color: NEAR_WHITE }}>Also save as a Product Combo in Stock Management</Typography>}
          />
        )}
      </Box>
    );
  };

  const renderQuestion = (key) => {
    switch (key) {
      case 'name':
        return (
          <TextField
            fullWidth
            autoFocus
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="Name (required)"
            sx={blockFieldSx}
          />
        );

      case 'dates':
        return (
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[
                { field: 'startDate', label: 'Start Date' },
                { field: 'endDate', label: 'End Date' }
              ].map(({ field, label }) => (
                <DateTimePicker
                  key={field}
                  value={formData[field]}
                  onChange={(value) => handleInputChange(field, value)}
                  format="dd/MM/yyyy HH:mm:ss"
                  views={['year', 'month', 'day', 'hours', 'minutes', 'seconds']}
                  localeText={{ todayButtonLabel: 'Current Day' }}
                  slots={{ field: WizardDateField }}
                  slotProps={{
                    field: { placeholder: label },
                    // 'today' is the reference's "Current Day" shortcut; 'accept' is the
                    // desktop date-time picker's commit button (closeOnSelect is false).
                    actionBar: { actions: ['clear', 'today', 'accept'] },
                    desktopPaper: { sx: pickerPopoverSx },
                    mobilePaper: { sx: pickerPopoverSx }
                  }}
                />
              ))}
              <Typography sx={{ color: NEAR_WHITE, textAlign: 'center' }}>
                To make the start or end date forever, leave the respective field empty.
              </Typography>
            </Box>
          </LocalizationProvider>
        );

      case 'category':
        return (
          <Autocomplete
            fullWidth
            options={Array.isArray(categories) ? categories : []}
            getOptionLabel={(option) => option?.name || ''}
            isOptionEqualToValue={(option, value) => option?.id === value?.id}
            value={(Array.isArray(categories) ? categories : []).find((c) => c.id === formData.categoryId) || null}
            onChange={(event, newValue) => handleInputChange('categoryId', newValue?.id ?? '')}
            slotProps={{ paper: { sx: menuPaperSx } }}
            renderInput={(params) => <TextField {...params} placeholder="Select..." sx={roundFieldSx} />}
          />
        );

      case 'type':
        return renderChoiceCards(promotionTypes, handleTypeSelect);

      case 'rewardType':
        return renderChoiceCards(REWARD_TYPES, handleRewardTypeSelect);

      case 'item':
        return renderItemSelect(itemX, setItemX);

      case 'reward':
        return renderItemSelect(itemY, setItemY);

      case 'quantity':
        return (
          <Box>
            <TextField
              fullWidth
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Input quantity"
              inputProps={{ min: 1 }}
              sx={blockFieldSx}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', mt: 2, color: NEAR_WHITE }}>
              <ShopfrontSwitch checked={orMore} onChange={(e) => setOrMore(e.target.checked)} />
              <Typography>Or more</Typography>
            </Box>
          </Box>
        );

      case 'rewardQuantity':
        return (
          <TextField
            fullWidth
            type="number"
            value={rewardQuantity}
            onChange={(e) => setRewardQuantity(e.target.value)}
            placeholder="Input quantity"
            inputProps={{ min: 1 }}
            sx={blockFieldSx}
          />
        );

      case 'rewardValue':
        return (
          <TextField
            fullWidth
            type="number"
            value={rewardValue}
            onChange={(e) => setRewardValue(e.target.value)}
            placeholder={rewardType === 'Discount Percentage' ? 'Input percentage' : 'Input amount'}
            InputProps={
              rewardType === 'Discount Percentage'
                ? {
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                    inputProps: { min: 0, max: 100, step: 0.01 }
                  }
                : {
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    inputProps: { min: 0, step: 0.01 }
                  }
            }
            sx={blockFieldSx}
          />
        );

      case 'price':
      case 'spend':
        return (
          <TextField
            fullWidth
            type="number"
            value={typeValue}
            onChange={(e) => setTypeValue(e.target.value)}
            placeholder={key === 'price' ? 'Input price' : 'Input amount'}
            InputProps={{
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
              inputProps: { min: 0, step: 0.01 }
            }}
            sx={blockFieldSx}
          />
        );

      case 'percent':
        return (
          <TextField
            fullWidth
            type="number"
            value={typeValue}
            onChange={(e) => setTypeValue(e.target.value)}
            placeholder="Input percentage"
            InputProps={{
              endAdornment: <InputAdornment position="end">%</InputAdornment>,
              inputProps: { min: 0, max: 100, step: 0.01 }
            }}
            sx={blockFieldSx}
          />
        );

      case 'combo':
        return renderComboBuilder();

      default:
        return null;
    }
  };

  const renderPage = (key) => (
    <Box>
      <Typography component="p" sx={{ fontSize: 32, fontWeight: 400, color: NEAR_WHITE, mb: '0.5rem' }}>
        {STEP_HEADERS[key]}
      </Typography>
      {renderQuestion(key)}
    </Box>
  );

  const valid = isStepValid() && !loading;

  // Reference: PREVIOUS / SKIP / NEXT are flat uppercase text on the gradient — no
  // background, no border, no radius, no hover state.
  const controlSx = (align, fontSize) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: align,
    gap: '0.5rem',
    fontSize,
    fontWeight: 400,
    color: NEAR_WHITE,
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'color .2s ease-in-out, opacity .2s ease-in-out'
  });

  const columnSx = { width: '100%', maxWidth: 900, mx: 'auto', padding: '1rem' };

  // The pages row is the grid's `1fr`, so it spans from under the title to the top of
  // the PREVIOUS/SKIP/NEXT footer (y=181..859 at a 919px viewport) and centres at 520.
  // The reference centres its question block at ~468, so reserve this much at the
  // bottom of the centring region — half of it is the resulting 52px upward shift.
  const PAGES_BOTTOM_RESERVE = 104;

  return (
    <Box
      sx={{
        // DashboardLayout's Main has no padding, so the wizard already spans the
        // full width below the app bar. A negative margin here would push 24px past
        // the viewport and spawn a horizontal scrollbar, so keep margins at zero:
        // fixed grid rows keep the footer pinned and stop the page from scrolling
        // (the reference never scrolls).
        height: 'calc(100vh - 50px)',
        display: 'grid',
        // Reference drops the dot rail to y=71 and the title to y=133.
        gridTemplateRows: '71px 60px 1fr 60px',
        overflow: 'hidden',
        color: NEAR_WHITE,
        background: `${GRADIENT} 0 0/1400% 1400%`,
        '@keyframes cwBgChange': {
          '0%': { backgroundPosition: '0 0' },
          '50%': { backgroundPosition: '100% 100%' },
          '100%': { backgroundPosition: '0 0' }
        },
        animation: 'cwBgChange 300s linear infinite'
      }}
    >
      {/* Top: progress dots + cancel */}
      <Box
        sx={{
          ...columnSx,
          ...fadeInSx,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end'
        }}
      >
        {/* Reference centres the dot rail on the page, not on the content column:
            each stage is a fixed 28px box holding a 1em dot that grows to 1.3em
            while it is the current step or hovered. */}
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            alignItems: 'center',
            fontSize: 16
          }}
        >
          {steps.map((_, idx) => {
            const Dot = idx === activeStep ? RadioButtonChecked : RadioButtonUnchecked;
            return (
              <Box
                key={idx}
                onClick={() => handleDotClick(idx)}
                sx={{
                  width: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  '&:hover .MuiSvgIcon-root': { fontSize: '1.3em' }
                }}
              >
                <Dot
                  sx={{
                    fontSize: idx === activeStep ? '1.3em' : '1em',
                    transition: 'font-size 0.2s ease'
                  }}
                />
              </Box>
            );
          })}
        </Box>

        <Box
          onClick={handleCancel}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: 19.2,
            fontWeight: 400,
            textTransform: 'uppercase',
            color: NEAR_WHITE,
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          <CloseIcon sx={{ fontSize: 19.2 }} />
          Cancel
        </Box>
      </Box>

      {/* Title */}
      <Box sx={{ ...fadeInSx, textAlign: 'center', padding: '0.5rem', paddingTop: '12px' }}>
        <Typography component="p" sx={{ fontSize: 20.8, fontWeight: 400, color: NEAR_WHITE }}>
          Create Promotion
        </Typography>
      </Box>

      {/* Pages — reference centres the question block in the available height.
          'safe center' degrades to top-aligned rather than clipping tall steps. */}
      <Box
        sx={{
          ...fadeInSx,
          position: 'relative',
          overflowX: 'hidden',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'safe center',
          pb: `${PAGES_BOTTOM_RESERVE}px`
        }}
      >
        {outgoing && steps[outgoing.step] && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'safe center',
              // inset:0 fills the parent's PADDING box, so the outgoing page needs the
              // same reserve or it would slide out from 52px lower than it came in.
              pb: `${PAGES_BOTTOM_RESERVE}px`,
              pointerEvents: 'none'
            }}
          >
            <Box
              onAnimationEnd={(e) => {
                if (e.target === e.currentTarget) setOutgoing(null);
              }}
              sx={{
                ...columnSx,
                ...SLIDE_KEYFRAMES,
                flexShrink: 0,
                animation: `${outgoing.dir === 'forward' ? 'cwSlideOutLeft' : 'cwSlideOutRight'} .3s cubic-bezier(.55,.085,.68,.53) both`
              }}
            >
              {renderPage(steps[outgoing.step])}
            </Box>
          </Box>
        )}

        <Box
          key={activeStep}
          sx={{
            ...columnSx,
            ...SLIDE_KEYFRAMES,
            flexShrink: 0,
            animation: `${direction === 'forward' ? 'cwSlideInRight' : 'cwSlideInLeft'} .3s cubic-bezier(.25,.46,.45,.94) both`
          }}
        >
          {renderPage(stepKey)}
        </Box>
      </Box>

      {/* Controls */}
      <Box
        sx={{
          ...columnSx,
          ...fadeInSx,
          display: 'grid',
          gridTemplateColumns: '1fr 60px 1fr',
          alignItems: 'center',
          textTransform: 'uppercase'
        }}
      >
        {activeStep > 0 ? (
          <Box onClick={handleBack} sx={controlSx('flex-start', 21.12)}>
            <ArrowBackIcon sx={{ fontSize: 21.12 }} />
            Previous
          </Box>
        ) : (
          <Box />
        )}

        <Box
          onClick={handleSkip}
          sx={{
            ...controlSx('center', 17.6),
            // SKIP exits to an editor, so it greys out until the name exists — the same
            // rule NEXT applies on the name question.
            color: nameValid ? NEAR_WHITE : INVALID,
            opacity: nameValid ? 1 : 0.9,
            cursor: nameValid ? 'pointer' : 'not-allowed'
          }}
        >
          Skip
        </Box>

        <Box
          onClick={handleNext}
          sx={{
            ...controlSx('flex-end', 21.12),
            color: valid ? NEAR_WHITE : INVALID,
            opacity: valid ? 1 : 0.9,
            cursor: valid ? 'pointer' : 'not-allowed'
          }}
        >
          {isLastStep ? 'Finish' : 'Next'}
          {isLastStep ? <CheckIcon sx={{ fontSize: 21.12 }} /> : <ArrowForwardIcon sx={{ fontSize: 21.12 }} />}
        </Box>
      </Box>

      {/* SKIP: choose Express or Advanced and go straight to that edit page */}
      <Dialog
        open={skipDialogOpen}
        onClose={() => setSkipDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, textAlign: 'center', py: 3 } }}
      >
        <DialogContent sx={{ pb: 2 }}>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              backgroundColor: '#5ebbeb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px auto',
              position: 'relative',
              top: -40
            }}
          >
            <Typography sx={{ color: NEAR_WHITE, fontWeight: 700, fontSize: '2.5rem' }}>?</Typography>
          </Box>

          <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2, color: '#313439' }}>
            Promotion Type
          </Typography>
          <Typography sx={{ color: '#676b72' }}>
            What type of promotion would you like to create?
          </Typography>
        </DialogContent>

        <DialogActions sx={{ justifyContent: 'center', gap: 2, px: 3, pb: 3 }}>
          <Button
            variant="outlined"
            onClick={() => setSkipDialogOpen(false)}
            sx={{
              minWidth: 100,
              height: 42,
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: 16,
              textTransform: 'none',
              borderColor: '#404040',
              color: '#313439'
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={() => openEditorWithDraft('express')}
            disabled={loading}
            sx={{
              minWidth: 100,
              height: 42,
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: 16,
              textTransform: 'none',
              backgroundColor: '#5ebbeb',
              '&:hover': { backgroundColor: '#4aa9dd' }
            }}
          >
            Express
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={() => openEditorWithDraft('advanced')}
            disabled={loading}
            sx={{
              minWidth: 100,
              height: 42,
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: 16,
              textTransform: 'none',
              backgroundColor: '#5ebbeb',
              '&:hover': { backgroundColor: '#4aa9dd' }
            }}
          >
            Advanced
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleSnackbarClose}>
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CreatePromotion;
