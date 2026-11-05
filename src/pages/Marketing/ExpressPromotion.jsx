import React, { useState, useEffect, useRef } from 'react';
import NumberField from '../../components/Common/NumberField';
import {
  Box,
  Button,
  TextField,
  Typography,
  FormControl,
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
  InputAdornment,
  Collapse
} from '@mui/material';
import {
  Search as SearchIcon,
  Delete as DeleteIcon,
  EditOutlined as EditOutlinedIcon,
  Cancel as CancelIcon,
  CropOriginal as ImageIcon,
  CakeOutlined as Inventory2OutlinedIcon,
  HomeOutlined as HomeOutlinedIcon,
  LocalOfferOutlined as LocalOfferOutlinedIcon,
  ArrowRight as ArrowRightIcon,
  ArrowDropDown as ArrowDropDownIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  HighlightOffOutlined as HighlightOffOutlinedIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import EditScheduleDialog from '../../components/Marketing/EditScheduleDialog';
import PromotionSimulatorPanel, { SIMULATOR_WIDTH, BOTTOM_BAR_HEIGHT } from '../../components/Marketing/PromotionSimulatorPanel';
import { useLocation, useNavigate, useParams, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import promotionService from '../../services/promotionService';
import promotionCategoryService from '../../services/promotionCategoryService';
import CreatableAutocomplete from '../../components/Common/CreatableAutocomplete';
import customerGroupService from '../../services/customerGroupService';
import productService from '../../services/productService';
import classificationService from '../../services/classificationService';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import DateTimeField from '../../components/Common/DateTimeField';
import useResultKeys, { ACTIVE_ROW_SX } from '../../components/Common/useResultKeys';
import { getBaseTier } from '../../utils/baseTier';

// Start / End Date are edited with the shared DateTimeField (Date | null, with the
// reference's DD/MM/YYYY HH:mm:ss mask and calendar / clock popover).

// Stored value (ISO, with or without timezone) -> local Date, or null.
const toDateOrNull = (raw) => {
  if (!raw) return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  const s = String(raw).trim();
  // No timezone: read the parts verbatim as local time (a "Z" string goes through
  // Date, which the view page also uses, so editor and view agree).
  const m = /(Z|[+-]\d{2}:?\d{2})$/.test(s) ? null : s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Date -> UTC ISO for the API. Reference stores "2025-06-18T14:00:00+00:00" and
// shows it on the browser clock in the editor; a zone-less local string was
// parsed on the SERVER's clock, so the saved time shifted whenever the two differed.
const toLocalIso = (d) => (d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : '');

// Money to whole cents. Every figure that reaches the Rebate box or the save
// payload goes through this, so a 10% discount on $6.50 is 0.65, never
// 0.6499999999999995.
const roundCents = (n) => Math.round((Number(n) || 0) * 100) / 100;
// Read-only figures: nothing (0) shows blank, not "$0.00" / "0.00%" (user 19/10/2026).
// Reference Express rows (live 04/11/2026): Cost "$0.00", % "100.00%" / "-100.00%"
// are always printed, never blank.
const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const pct = (n) => `${(Number(n) || 0).toFixed(2)}%`;

// Reference labels its fields above the box (same as the Advanced editor).
const LabeledField = ({ label, children }) => (
  <Box>
    <Typography sx={{ fontSize: 14, color: '#676b72', mb: 0.5 }}>{label}</Typography>
    {children}
  </Box>
);
const headerFieldSx = {
  '& .MuiOutlinedInput-root': { minHeight: 42, borderRadius: '8px', backgroundColor: '#fff' }
};
const toggleLabelSx = { ml: 0, '& .MuiFormControlLabel-label': { ml: '10px', fontSize: 16 } };

// Reference search dropdown: the typed text is highlighted sky inside each result.
const Highlight = ({ text, term }) => {
  const t = String(text || '');
  const q = String(term || '').trim();
  if (!q) return t;
  const idx = t.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return t;
  return (
    <>
      {t.slice(0, idx)}
      <Box component="span" sx={{ color: '#5ebbeb' }}>{t.slice(idx, idx + q.length)}</Box>
      {t.slice(idx + q.length)}
    </>
  );
};
// Group header order of the reference dropdown (categories first, products last).
const GROUP_ORDER = ['CATEGORY', 'BRAND', 'FAMILY', 'TAG', 'PRODUCT'];
const groupOf = (r) => (r.resultType === 'PRODUCT' ? 'PRODUCT' : String(r.type || 'CLASSIFICATION').toUpperCase());
const GROUP_LABEL = { CATEGORY: 'CATEGORIES', BRAND: 'BRANDS', FAMILY: 'FAMILIES', TAG: 'TAGS', PRODUCT: 'PRODUCTS' };
// Results in the order the dropdown draws them (grouped), so the keyboard index
// (ArrowUp/Down, Enter) points at the row the user sees highlighted.
const inDisplayOrder = (results) => GROUP_ORDER.flatMap((g) => results.filter((r) => groupOf(r) === g));

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
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    isRecurring: false,
    schedule: null,
    startDate: null,
    endDate: null,
    categoryId: '',
    availableTo: 'All Customers',
    customerGroupIds: [],
    // Reference "Available from": the outlet the promotion runs at (chip in the box).
    outletId: resolveOutletId(),
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
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [simSearch, setSimSearch] = useState('');
  const [simResults, setSimResults] = useState([]);
  const [simLoading, setSimLoading] = useState(false);
  const [basket, setBasket] = useState([]);
  // Request sequence per search box: a slow response for an earlier term must not
  // overwrite the list (or reopen the dropdown after the box was cleared).
  const searchSeq = useRef(0);
  const simSeq = useRef(0);

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
        startDate: toDateOrNull(draft.startDate),
        endDate: toDateOrNull(draft.endDate)
      }));
    }
  }, [id]);

  // (A type-change effect used to recompute Discount Percentage rows here. Its only
  // live path was the edit-mode load, where it overwrote the saved supplier Rebate
  // with normal - promo; handleInputChange already resets rows on a type switch.)

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
            discountPercentage: item.discountPercentage || 0,
            discountAmount: item.discountAmount || ''
          };
          
          console.log('Processed item:', processedItem);
          return processedItem;
        })
      );

      setFormData({
        name: promotion.name || '',
        isRecurring: promotion.isRecurring || false,
        schedule: promotion.schedule ?? null,
        outletId: promotion.outletId ?? null,
        startDate: toDateOrNull(promotion.startDate),
        endDate: toDateOrNull(promotion.endDate),
        categoryId: promotion.categoryId || '',
        availableTo: promotion.availableTo || 'All Customers',
        customerGroupIds: promotion.customerGroupIds || [],
        // Wizard names map onto the Express types so the Type select is not blank.
        promotionType: ({ 'Buy X for Y': 'Price Override', 'Buy X get Y% off': 'Discount Percentage' })[promotion.promotionType]
          || promotion.promotionType || 'Price Override',
        isActive: promotion.isActive !== false,
        items: [
          ...itemsWithCost,
          ...(promotion.conditions?.classificationItems || []).map((c) => classificationRow({
            classificationId: c.classificationId, classificationType: c.classificationType, productName: c.name, members: c.members,
            quantity: c.quantity, promoPrice: c.promoPrice || '', discountPercentage: c.discountPercentage || '', discountAmount: c.discountAmount || '', rebate: c.rebate || ''
          }, promotion.promotionType))
        ]
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
      productService.getProducts({ search: query, limit: 20, pick: 1 }).then((r) => r?.products || []).catch(() => []),
    ]);
    return [
      ...products.map((p) => ({ ...p, resultType: 'PRODUCT' })),
    ];
  };

  // Reference Express (help "Express Promotions", live 04/11/2026): Price Override
  // searches "a product or family"; Discount Percentage / Discount Amount search
  // "a product, category, brand, family or tag". A classification adds its products.
  const isPriceOverride = formData.promotionType === 'Price Override';
  const classificationAllowed = (c) => !isPriceOverride || String(c.type || '').toUpperCase() === 'FAMILY';
  const searchItems = async (term) => {
    const query = term.trim();
    if (!query) return [];
    const [products, classifications] = await Promise.all([
      productService.getProducts({ search: query, limit: 20, pick: 1 }).then((r) => r?.products || []).catch(() => []),
      classificationService.getClassifications({ search: query, lite: 1 }).then((r) => r?.classifications || []).catch(() => []),
    ]);
    return [
      ...products.map((p) => ({ ...p, resultType: 'PRODUCT' })),
      ...classifications.filter(classificationAllowed).map((c) => ({ ...c, resultType: 'CLASSIFICATION' })),
    ];
  };

  // Keystrokes are debounced: every character used to fire two API calls at once,
  // so a quick "stubbie" queued a dozen requests and the list (and the pick that
  // follows) waited on the slowest of them.
  const SEARCH_DEBOUNCE_MS = 250;
  const searchTimer = useRef(null);
  const simTimer = useRef(null);
  const debounced = (timerRef, fn) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(fn, SEARCH_DEBOUNCE_MS);
  };
  useEffect(() => () => { clearTimeout(searchTimer.current); clearTimeout(simTimer.current); }, []);

  const searchProducts = async (term) => {
    // Reference: one character shows "Start typing to search..." and searches nothing.
    const seq = ++searchSeq.current;
    clearTimeout(searchTimer.current);
    if (term.trim().length < 2) {
      setSearchResults([]);
      setSearchLoading(false); // an in-flight request's finally is now stale and skips this
      resultKeys.clearPending('items');
      return;
    }

    try {
      setSearchLoading(true);
      await new Promise((resolve) => debounced(searchTimer, resolve));
      if (seq !== searchSeq.current) return;
      const results = await searchItems(term);
      if (seq !== searchSeq.current) return; // a newer search (or a clear) superseded this one
      setSearchResults(results);
      // Enter was pressed while this search ran: add the top row of the fresh list.
      if (resultKeys.takePending('items') && results.length > 0) handleAddProduct(inDisplayOrder(results)[0]);
    } catch (error) {
      console.error('Error searching products:', error);
      if (seq === searchSeq.current) setSearchResults([]);
    } finally {
      if (seq === searchSeq.current) setSearchLoading(false);
    }
  };

  const searchSimulator = async (term) => {
    const seq = ++simSeq.current;
    clearTimeout(simTimer.current);
    if (!term.trim()) {
      setSimResults([]);
      setSimLoading(false);
      return;
    }
    try {
      setSimLoading(true);
      await new Promise((resolve) => debounced(simTimer, resolve));
      if (seq !== simSeq.current) return;
      const results = await searchCatalog(term);
      if (seq !== simSeq.current) return;
      setSimResults(results);
    } catch (error) {
      console.error('Error searching simulator products:', error);
      if (seq === simSeq.current) setSimResults([]);
    } finally {
      if (seq === simSeq.current) setSimLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      if (field !== 'promotionType' || value === prev.promotionType) return { ...prev, [field]: value };
      // Switching type resets the per-row pricing to that type's starting state
      // (Price Override: blank promo box; discount types: promo = normal, no discount).
      return {
        ...prev,
        promotionType: value,
        items: prev.items.map((it) => ({
          ...it,
          promoPrice: value === 'Price Override' ? '' : (Number(it.normalPrice) || 0),
          discountPercentage: '',
          discountAmount: ''
        }))
      };
    });
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
      // Reference: Price Override starts with a blank Promo Price box; the discount
      // types print the normal total until a discount is typed.
      promoPrice: formData.promotionType === 'Price Override' ? '' : unitNormal,
      rebate: '',
      rebatePercentage: 0,
      discountPercentage: '',
      discountAmount: ''
    };
  };

  const handleAddProduct = async (entry) => {
    if (entry.resultType === 'CLASSIFICATION') {
      // Reference (live 04/11/2026): a category/brand/family/tag is ONE row
      // ("Cigarettes / CATEGORY"); the sell screen matches products by their
      // classification. A FAMILY row carries its members for the "~" averages
      // and the expandable member list ("Jets23 / FAMILY" -> Winfield Jets ...).
      const type = String(entry.type || 'CLASSIFICATION').toUpperCase();
      // The row lands at once; a family's members (for the "~" averages) fill in
      // when their request returns, instead of holding the pick until then.
      setFormData(prev => ({
        ...prev,
        items: prev.items.some((i) => i.classificationId === entry.id) ? prev.items : [...prev.items, classificationRow({
          classificationId: entry.id, classificationType: type, productName: entry.name, members: [], membersLoading: type === 'FAMILY'
        }, prev.promotionType)]
      }));
      setSearchTerm('');
      setSearchResults([]);
      if (type === 'FAMILY') {
        const doneLoading = () => setFormData(prev => ({ ...prev, items: prev.items.map((i) => (i.classificationId === entry.id ? { ...i, membersLoading: false } : i)) }));
        try {
          const response = await classificationService.getClassificationProducts(entry.id, { assignedOnly: 1 });
          const members = (response?.assignedProducts || []).map((p) => {
            const tier = getBaseTier(p.prices);
            return { productId: p.id, name: p.name, unitCost: Number(p.cost || tier?.cost || 0), unitNormal: Number(tier?.price || 0) };
          });
          setFormData(prev => ({
            ...prev,
            items: prev.items.map((i) => (i.classificationId === entry.id && String(i.classificationType).toUpperCase() === 'FAMILY' && !(i.members || []).length
              // promoPrice seeded from an empty average is 0: let it re-seed from the members.
              ? classificationRow({ ...i, members, promoPrice: i.promoPrice === 0 ? undefined : i.promoPrice }, prev.promotionType)
              : i))
          }));
        } catch (error) {
          console.error('Error fetching family products:', error);
        } finally {
          doneLoading();
        }
      }
      return;
    }
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
            price: getBaseTier(product.prices)?.price || 0,
            // classification ids so a category / brand / family / tag row can price this line
            categoryId: product.categoryId ?? product.category?.id ?? null,
            brandId: product.brandId ?? product.brand?.id ?? null,
            familyId: product.familyId ?? product.family?.id ?? null,
            tagIds: Array.isArray(product.tags) ? product.tags.map((t) => t?.tagId ?? t?.tag?.id ?? t?.id ?? t) : (product.tagIds || [])
          });
        }
      });
      return next;
    });
    setSimSearch('');
    setSimResults([]);
  };

  // Reference Express simulator (live 04/11/2026, Price Override 2 for $3 on a
  // $2.00 product): 1 unit -> $2.00 "No Promotion Active"; 3 units -> $5.00
  // (one complete set at $3 + 1 leftover at $2.00), "Current Promotion Active".
  // Each basket line carries its own status. A line prices by its product row, or
  // by the classification row (category / brand / family / tag) it belongs to -
  // the same matching the sell screen does (SaleKeyPage.expressItemFor).
  const classificationRowFor = (row) => formData.items.find((i) => {
    if (!i.classificationId) return false;
    const type = String(i.classificationType || '').toUpperCase();
    const id = Number(i.classificationId);
    if ((i.members || []).some((m) => Number(m.productId) === Number(row.productId))) return true;
    if (type === 'CATEGORY') return row.categoryId != null && Number(row.categoryId) === id;
    if (type === 'BRAND') return row.brandId != null && Number(row.brandId) === id;
    if (type === 'FAMILY') return row.familyId != null && Number(row.familyId) === id;
    if (type === 'TAG') return (row.tagIds || []).some((t) => Number(t) === id);
    return false;
  });
  const simLine = (row) => {
    const normal = roundCents(row.price * row.quantity);
    const promoItem = formData.items.find((i) => !i.classificationId && i.productId === row.productId) || classificationRowFor(row);
    if (!promoItem) return { total: normal, active: false };
    const setQty = Math.max(1, parseInt(promoItem.quantity, 10) || 1);
    const sets = Math.floor(row.quantity / setQty);
    if (sets < 1) return { total: normal, active: false };
    const covered = sets * setQty;
    const leftover = (row.quantity - covered) * row.price;
    let coveredPrice = row.price * covered;
    if (formData.promotionType === 'Discount Percentage') {
      const p = Number(promoItem.discountPercentage) || 0;
      if (!(p > 0)) return { total: normal, active: false };
      coveredPrice = coveredPrice * (1 - p / 100);
    } else if (formData.promotionType === 'Discount Amount') {
      const off = Number(promoItem.discountAmount) || 0;
      if (!(off > 0)) return { total: normal, active: false };
      coveredPrice = Math.max(0, coveredPrice - off * sets);
    } else {
      if (!(promoItem.promoPrice > 0)) return { total: normal, active: false };
      coveredPrice = promoItem.promoPrice * sets;
    }
    const total = roundCents(coveredPrice + leftover);
    return { total, active: total < normal - 0.004 };
  };

  // One editor row for a classification; a family's averages seed cost / normal so
  // the usual discount maths and the "%" column work on the "~" figures.
  const classificationRow = (row, promotionType) => {
    const members = Array.isArray(row.members) ? row.members : [];
    const avg = (k) => (members.length ? members.reduce((s, m) => s + (Number(m[k]) || 0), 0) / members.length : 0);
    const unitCost = avg('unitCost');
    const unitNormal = avg('unitNormal');
    const qty = Math.max(1, parseInt(row.quantity, 10) || 1);
    return {
      classificationId: row.classificationId,
      classificationType: row.classificationType,
      productId: null,
      productName: row.productName,
      members,
      membersLoading: Boolean(row.membersLoading),
      expanded: false,
      quantity: qty,
      unitCost,
      unitNormal,
      cost: roundCents(unitCost * qty),
      normalPrice: roundCents(unitNormal * qty),
      promoPrice: row.promoPrice ?? (promotionType === 'Price Override' ? '' : roundCents(unitNormal * qty)),
      rebate: row.rebate ?? '',
      rebatePercentage: 0,
      discountPercentage: row.discountPercentage ?? '',
      discountAmount: row.discountAmount ?? ''
    };
  };
  const toggleExpanded = (index) => {
    setFormData(prev => ({ ...prev, items: prev.items.map((it, i) => (i === index ? { ...it, expanded: !it.expanded } : it)) }));
  };

  const handleRemoveItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const calculateProfit = (item) => {
    const promoPrice = parseFloat(item.promoPrice) || 0;
    // Help "Express Promotions": Rebate is an "amount provided to reduce the
    // product's cost", so it comes off the cost before the margin.
    const cost = Math.max(0, (parseFloat(item.cost) || 0) - (parseFloat(item.rebate) || 0));

    // Reference "%" column (live 04/11/2026): promo blank -> "-100.00%" in red,
    // cost $0 with promo $2 -> "100.00%", cost $0.80 promo $1 -> "20.00%".
    if (promoPrice === 0) return -100;

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

        // Reference (live 04/11/2026, qty 2 x $2.00, 10%): Promo $3.60, Rebate stays
        // $0 - the rebate is a separate supplier figure, never derived from the
        // discount, and the promo price is never derived from the rebate.
        if (formData.promotionType === 'Discount Percentage') {
          if (field === 'discountPercentage' || field === 'quantity') {
            const pctOff = Number(updated.discountPercentage) || 0;
            updated.promoPrice = pctOff > 0 ? round(normal * (1 - pctOff / 100)) : normal;
          }
        } else if (formData.promotionType === 'Discount Amount') {
          // "$ off": the line's promo total is its normal total less the amount.
          if (field === 'discountAmount' || field === 'quantity') {
            const off = Number(updated.discountAmount) || 0;
            updated.promoPrice = off > 0 ? round(Math.max(0, normal - off)) : normal;
          }
        }
        updated.rebatePercentage = (round(updated.rebate) / normal) * 100;
        return updated;
      })
    }));
  };

  const handleSave = async () => {
    // PUT silently ignores a blank name (POST 400s), so "updated successfully" showed
    // while the old name stayed. Check here for both paths.
    if (!formData.name.trim()) {
      showSnackbarMessage('Promotion name is required', 'error');
      return;
    }
    try {
      setLoading(true);
      const promotionData = {
        ...formData,
        outletId: formData.outletId ?? resolveOutletId(),
        schedule: formData.isRecurring ? formData.schedule : null,
        startDate: formData.isRecurring ? '' : toLocalIso(formData.startDate),
        endDate: formData.isRecurring ? '' : toLocalIso(formData.endDate),
        promotionType: formData.promotionType,
        items: formData.items.filter((item) => !item.classificationId).map(item => ({
          productId: item.productId,
          // Stored on the row (schema "for reference"); the revision log's
          // "<name> added with a rebate of..." row read blank without it.
          productName: item.productName,
          quantity: item.quantity || 1,
          promoPrice: roundCents(item.promoPrice),
          normalPrice: roundCents(item.normalPrice),
          rebate: roundCents(item.rebate),
          rebatePercentage: item.rebatePercentage || 0,
          discountPercentage: item.discountPercentage || 0,
          discountAmount: formData.promotionType === 'Discount Amount' ? roundCents(item.discountAmount) : roundCents(item.rebate)
        })),
        conditions: {
          // Classification rows (category / brand / family / tag) have no product id;
          // the sell screen matches a product by its classification.
          classificationItems: formData.items.filter((item) => item.classificationId).map((item) => ({
            classificationId: item.classificationId,
            classificationType: item.classificationType,
            name: item.productName,
            quantity: item.quantity || 1,
            promoPrice: roundCents(item.promoPrice),
            discountPercentage: Number(item.discountPercentage) || 0,
            discountAmount: formData.promotionType === 'Discount Amount' ? roundCents(item.discountAmount) : 0,
            rebate: roundCents(item.rebate),
            members: (item.members || []).map((m) => ({ productId: m.productId, name: m.name, unitCost: m.unitCost, unitNormal: m.unitNormal }))
          })),
          criteria: [{
            purchaseType: 'purchase',
            purchaseValue: 1,
            receiveType: formData.promotionType === 'Price Override' ? 'total_price' :
                        formData.promotionType === 'Discount Percentage' ? 'percentage_discount' :
                        'discount',
            receiveValue: 0,
            items: formData.items.filter((item) => !item.classificationId).map(item => ({
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

  const handleSnackbarClose = () => {
    setSnackbar({ open: false, message: '', severity: 'success' });
  };

  return (
    <Box sx={{ p: 3, pb: '85px', pr: showSimulator ? `${SIMULATOR_WIDTH + 24}px` : 3, transition: 'padding-right 300ms', backgroundColor: '#fff', minHeight: '100vh' }}>
      {/* Reference Express editor (live 04/11/2026): no page title, no card - a
          three-column header with labels above the boxes, a divider, then the
          search bar and the items table on the white page. */}
      <Box sx={{
        '& .MuiOutlinedInput-root': { borderRadius: '8px' },
        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' }
      }}>
        <Grid container spacing={2} alignItems="flex-end">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              sx={headerFieldSx}
            />
          </Grid>
          <Grid item xs={12} md={4} sx={{ display: 'flex', alignItems: 'center', minHeight: 42 }}>
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
            <Grid item xs={12} md={4}>
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
              <Grid item xs={12} md={4}>
                <DateTimeField value={formData.startDate} onChange={(v) => handleInputChange('startDate', v)} placeholder="Start Date" showLabel={false} />
              </Grid>
              <Grid item xs={12} md={4}>
                <DateTimeField value={formData.endDate} onChange={(v) => handleInputChange('endDate', v)} placeholder="End Date" showLabel={false} />
              </Grid>
            </>
          )}
          <Grid item xs={12} md={4}>
            <LabeledField label="Category">
              <CreatableAutocomplete
                size="small"
                options={categories}
                value={categories.find((c) => c.id === formData.categoryId) || null}
                onChange={(newValue) => handleInputChange('categoryId', newValue?.id || '')}
                onCreate={handleCreatePromotionCategory}
                onError={(err) => showSnackbarMessage(err?.response?.data?.error || 'Failed to create category', 'error')}
                placeholder="No Promotion Category"
                renderInput={(params) => (
                  <TextField {...params} placeholder="No Promotion Category" sx={headerFieldSx} />
                )}
              />
            </LabeledField>
          </Grid>
          <Grid item xs={12} md={4}>
            <LabeledField label="Available to">
              <FormControl fullWidth size="small" sx={headerFieldSx}>
                <Select
                  value={formData.availableTo}
                  onChange={(e) => handleInputChange('availableTo', e.target.value)}
                >
                  <MenuItem value="All Customers">All Customers</MenuItem>
                  <MenuItem value="Specific Customer Groups">Specific Customer Groups</MenuItem>
                </Select>
              </FormControl>
            </LabeledField>
          </Grid>
          {/* Reference also shows "Available from" (outlet chip); dropped here because the
              navbar outlet decides where a promotion lives (outlet-wise rule, user 04/11/2026). */}
          <Grid item xs={12} md={4}>
            <LabeledField label="Promotion type">
              <FormControl fullWidth size="small" sx={headerFieldSx}>
                <Select
                  value={formData.promotionType}
                  onChange={(e) => handleInputChange('promotionType', e.target.value)}
                >
                  <MenuItem value="Price Override">Price Override</MenuItem>
                  <MenuItem value="Discount Percentage">Discount Percentage</MenuItem>
                  <MenuItem value="Discount Amount">Discount Amount</MenuItem>
                </Select>
              </FormControl>
            </LabeledField>
          </Grid>
          <Grid item xs={12} md={4} sx={{ display: 'flex', alignItems: 'center', minHeight: 42 }}>
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
          {formData.availableTo === 'Specific Customer Groups' && (
            <Grid item xs={12} md={4}>
              <LabeledField label="Customer Groups">
                <Autocomplete
                  multiple
                  size="small"
                  options={customerGroups}
                  getOptionLabel={(option) => option.name}
                  value={customerGroups.filter(group => formData.customerGroupIds.includes(group.id))}
                  onChange={(event, newValue) => {
                    handleInputChange('customerGroupIds', newValue.map(group => group.id));
                  }}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip variant="outlined" label={option.name} {...getTagProps({ index })} />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField {...params} placeholder="Select customer groups" sx={headerFieldSx} />
                  )}
                />
              </LabeledField>
            </Grid>
          )}
        </Grid>

        <Box sx={{ borderBottom: '1px solid #d4d4d4', my: 3, mx: -2 }} />

        {/* Search: full width, clear button at the right once typed; the dropdown
            overlays the page with grouped results (CATEGORIES ... PRODUCTS). */}
        <Box sx={{ position: 'relative' }}>
          <TextField
            fullWidth
            placeholder={isPriceOverride ? 'Search for a product or family' : 'Search for a product, category, brand, family or tag'}
            // Browser form history popped up on ArrowDown over our own result list.
            autoComplete="off"
            inputProps={{ autoComplete: 'off', name: 'express-item-search' }}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              resultKeys.reset('items');
              searchProducts(e.target.value);
            }}
            onKeyDown={resultKeys.handleKeyDown('items', inDisplayOrder(searchResults), handleAddProduct, () => setSearchResults([]), { loading: searchLoading })}
            InputProps={{
              endAdornment: searchTerm ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => { setSearchTerm(''); setSearchResults([]); }} sx={{ color: '#404040', p: '2px', mr: '-4px' }}>
                    <CancelIcon sx={{ fontSize: 24 }} />
                  </IconButton>
                </InputAdornment>
              ) : null
            }}
            sx={{
              // Reference: 50px box, dark 1px border, 2px black once typing / focused.
              '& .MuiOutlinedInput-root': { minHeight: 50, borderRadius: '6px', fontSize: 16, bgcolor: '#fff', pr: '12px' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
              '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
              '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
              // Chrome autofill painted the box light blue.
              '& input:-webkit-autofill': { WebkitBoxShadow: '0 0 0 100px #fff inset' }
            }}
          />
          <Typography sx={{ fontSize: 16, color: '#000', mt: '2px' }}>Please note: All figures are inclusive of tax</Typography>

          {/* Reference dropdown: square panel with a 1px dark frame, drop shadow and a
              3px sky line along the bottom; it overlaps the "Please note" line. */}
          {/* Reference states: "Start typing to search..." (1 char), "Searching..." while the
              request is in flight, "No search results found." */}
          {searchTerm.trim().length > 0 && searchResults.length === 0 && (
            <Paper square elevation={0} sx={{ position: 'absolute', top: 58, left: 0, right: 0, zIndex: 20, border: '1px solid #404040', borderBottom: '3px solid #5ebbeb', boxShadow: '0 6px 12px rgba(0,0,0,0.25)', px: '18px', py: '12px' }}>
              <Typography sx={{ fontSize: 18, color: '#000', lineHeight: '24px' }}>
                {searchTerm.trim().length < 2 ? 'Start typing to search...' : searchLoading ? 'Searching...' : 'No search results found.'}
              </Typography>
            </Paper>
          )}
          {searchTerm.trim().length >= 2 && searchResults.length > 0 && (
            <Paper
              square
              elevation={0}
              sx={{ position: 'absolute', top: 58, left: 0, right: 0, zIndex: 20, maxHeight: 480, overflowY: 'scroll', border: '1px solid #404040', borderBottom: '3px solid #5ebbeb', boxShadow: '0 6px 12px rgba(0,0,0,0.25)', px: '14px', pt: '8px', pb: '6px' }}
            >
              {GROUP_ORDER.filter((g) => searchResults.some((r) => groupOf(r) === g)).map((g) => (
                <Box key={g}>
                  <Typography sx={{ fontSize: 16, color: '#9e9e9e', letterSpacing: 0.5, lineHeight: '20px', pt: '10px', pb: '4px' }}>{GROUP_LABEL[g]}</Typography>
                  {inDisplayOrder(searchResults).map((product, flatIndex) => (groupOf(product) === g ? (
                    <Box
                      key={`${product.resultType}-${product.id}`}
                      onClick={() => handleAddProduct(product)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        height: 41,
                        cursor: 'pointer',
                        mx: '-14px',
                        px: '14px',
                        '&:hover': { backgroundColor: '#f5f5f5' },
                        // Top result pre-highlighted; ArrowUp/Down move it, Enter adds it.
                        ...(resultKeys.isActive('items', flatIndex) ? ACTIVE_ROW_SX : {}),
                      }}
                    >
                      {/* Reference icons: product = picture, family = house, category = box, brand/tag = label */}
                      {(() => {
                        const g = groupOf(product);
                        const Glyph = g === 'PRODUCT' ? ImageIcon : g === 'FAMILY' ? HomeOutlinedIcon : g === 'CATEGORY' ? Inventory2OutlinedIcon : LocalOfferOutlinedIcon;
                        return <Glyph sx={{ fontSize: 22, color: '#404040' }} />;
                      })()}
                      <Typography sx={{ fontSize: 18, color: '#404040', lineHeight: '24px' }}>
                        <Highlight text={product.name} term={searchTerm} />
                      </Typography>
                    </Box>
                  ) : null))}
                </Box>
              ))}
            </Paper>
          )}
        </Box>

        {/* Reference table header: sky band, white bold uppercase letter-spaced labels. */}
        <TableContainer sx={{ mt: 2 }}>
          {/* Fixed column widths: a long product / member name wraps inside ITEM and
              never pushes the figure columns around (member rows line up under the header). */}
          <Table sx={{ tableLayout: 'fixed', '& td, & th': { border: 0 }, '& td': { textAlign: 'center' }, '& td:first-of-type': { textAlign: 'left' } }}>
            <colgroup>
              <col />
              <col style={{ width: 170 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 130 }} />
              {!isPriceOverride && <col style={{ width: 180 }} />}
              <col style={{ width: 180 }} />
              <col style={{ width: 180 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 48 }} />
            </colgroup>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#5ebbeb', '& th': { color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center', py: 1, whiteSpace: 'nowrap', px: 1 } }}>
                <TableCell sx={{ textAlign: 'left !important' }}>ITEM</TableCell>
                <TableCell>QUANTITY</TableCell>
                <TableCell>COST</TableCell>
                <TableCell>NORMAL PRICE</TableCell>
                {!isPriceOverride && <TableCell>DISCOUNT AMOUNT</TableCell>}
                <TableCell>PROMO PRICE</TableCell>
                <TableCell>REBATE</TableCell>
                <TableCell>%</TableCell>
                <TableCell sx={{ width: 48 }} />
              </TableRow>
            </TableHead>
            <TableBody sx={{ '& td': { fontSize: 16, color: '#000', py: 1.5, px: 1 } }}>
              {formData.items.map((item, index) => {
                // Reference (live 04/11/2026): a classification is ONE row. A FAMILY
                // row shows "~" averages over its members and expands (arrow) into
                // read-only member rows; a BRAND / CATEGORY row prints "-".
                const isClass = !!item.classificationId;
                const members = Array.isArray(item.members) ? item.members : [];
                const hasFigures = !isClass || members.length > 0;
                const approx = isClass && members.length > 0 ? '~' : '';
                // A family's members are still loading: "~ …" rather than "-".
                const dash = isClass && item.membersLoading ? '~ …' : '-';
                const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
                const memberPromo = (m) => {
                  const normal = roundCents((Number(m.unitNormal) || 0) * qty);
                  if (formData.promotionType === 'Discount Percentage') {
                    const p = Number(item.discountPercentage) || 0;
                    return p > 0 ? roundCents(normal * (1 - p / 100)) : normal;
                  }
                  if (formData.promotionType === 'Discount Amount') {
                    const off = Number(item.discountAmount) || 0;
                    return off > 0 ? roundCents(Math.max(0, normal - off)) : normal;
                  }
                  return Number(item.promoPrice) || 0;
                };
                return (
                  <React.Fragment key={item.classificationId ? `c-${item.classificationId}` : `p-${item.productId}-${index}`}>
                    <TableRow>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {isClass && members.length > 0 && (
                            <IconButton size="small" onClick={() => toggleExpanded(index)} sx={{ p: 0, color: '#404040' }}>
                              {item.expanded ? <ArrowDropDownIcon /> : <ArrowRightIcon />}
                            </IconButton>
                          )}
                          <Box>
                            <Typography sx={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>{item.productName}</Typography>
                            <Typography sx={{ fontSize: 10, letterSpacing: 1, color: '#404040' }}>{isClass ? item.classificationType : 'PRODUCT'}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <NumberField
                          int
                          fallback={1}
                          value={item.quantity || 1}
                          onCommit={(n) => handleUpdateItem(index, 'quantity', n)}
                          size="small"
                          fullWidth
                          sx={{ minWidth: 120, ...headerFieldSx }}
                        />
                      </TableCell>
                      {/* Cost / Normal Price / Promo Price are TOTALS for the line's quantity. */}
                      <TableCell>{hasFigures ? approx + money(item.cost) : dash}</TableCell>
                      <TableCell>{hasFigures ? approx + money(item.normalPrice) : dash}</TableCell>
                      {formData.promotionType === 'Discount Percentage' && (
                        <TableCell>
                          <NumberField
                            value={item.discountPercentage ?? ''}
                            fallback=""
                            onCommit={(n) => handleUpdateItem(index, 'discountPercentage', n)}
                            size="small"
                            fullWidth
                            InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                            sx={{ minWidth: 160, ...headerFieldSx }}
                          />
                        </TableCell>
                      )}
                      {formData.promotionType === 'Discount Amount' && (
                        <TableCell>
                          <NumberField
                            value={item.discountAmount === '' || item.discountAmount == null ? '' : roundCents(item.discountAmount).toFixed(2)}
                            fallback=""
                            onCommit={(n) => handleUpdateItem(index, 'discountAmount', n)}
                            size="small"
                            fullWidth
                            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                            sx={{ minWidth: 160, ...headerFieldSx }}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        {isPriceOverride ? (
                          <NumberField
                            value={item.promoPrice === '' || item.promoPrice == null ? '' : roundCents(item.promoPrice).toFixed(2)}
                            fallback=""
                            onCommit={(totalPromoPrice) => handleUpdateItem(index, 'promoPrice', totalPromoPrice)}
                            size="small"
                            fullWidth
                            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                            sx={{ minWidth: 160, ...headerFieldSx }}
                          />
                        ) : (hasFigures ? approx + money(item.promoPrice) : dash)}
                      </TableCell>
                      <TableCell>
                        <NumberField
                          value={item.rebate === '' || item.rebate == null ? '' : roundCents(item.rebate).toFixed(2)}
                          fallback={0}
                          onCommit={(n) => handleUpdateItem(index, 'rebate', n)}
                          size="small"
                          fullWidth
                          InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                          sx={{ minWidth: 160, ...headerFieldSx }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: hasFigures && calculateProfit(item) < 0 ? '#e33430 !important' : '#000', whiteSpace: 'nowrap' }}>
                        {hasFigures ? approx + pct(calculateProfit(item)) : dash}
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleRemoveItem(index)} sx={{ color: '#e33430' }}>
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                    {isClass && item.expanded && members.map((m) => {
                      const mCost = roundCents((Number(m.unitCost) || 0) * qty);
                      const mNormal = roundCents((Number(m.unitNormal) || 0) * qty);
                      const mPromo = memberPromo(m);
                      const mProfit = calculateProfit({ promoPrice: mPromo, cost: mCost, rebate: item.rebate });
                      return (
                        <TableRow key={`m-${item.classificationId}-${m.productId}`} sx={{ '& td': { py: 1 } }}>
                          <TableCell sx={{ pl: '40px !important' }}>
                            <Typography sx={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>{m.name}</Typography>
                            <Typography sx={{ fontSize: 10, letterSpacing: 1, color: '#404040' }}>PRODUCT</Typography>
                          </TableCell>
                          <TableCell />
                          <TableCell>{money(mCost)}</TableCell>
                          <TableCell>{money(mNormal)}</TableCell>
                          {!isPriceOverride && <TableCell />}
                          <TableCell>{mPromo > 0 ? money(mPromo) : ''}</TableCell>
                          <TableCell />
                          <TableCell sx={{ color: mProfit < 0 ? '#e33430 !important' : '#000', whiteSpace: 'nowrap' }}>{mPromo > 0 ? pct(mProfit) : ''}</TableCell>
                          <TableCell />
                        </TableRow>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        {formData.items.length === 0 && (
          <Typography sx={{ textAlign: 'center', py: 6, fontSize: 32, color: '#b5b5b5' }}>No items in promotion</Typography>
        )}
      </Box>

      {/* Promotion Simulator: the reference right-edge panel (shared component). */}
      <PromotionSimulatorPanel
        open={showSimulator}
        search={{
          value: simSearch,
          onChange: (v) => { setSimSearch(v); resultKeys.reset('sim'); searchSimulator(v); },
          onKeyDown: resultKeys.handleKeyDown('sim', simResults, handleSimulatorAdd, () => setSimResults([])),
          results: simResults,
          loading: simLoading,
          onPick: handleSimulatorAdd
        }}
        lines={basket.map((row) => { const s = simLine(row); return { key: row.productId, quantity: row.quantity, name: row.productName, total: s.total, active: s.active }; })}
        onQuantity={(key, n) => setBasket(prev => prev.map(b => (b.productId === key ? { ...b, quantity: n } : b)))}
        onRemove={(key) => setBasket(prev => prev.filter(b => b.productId !== key))}
      />

      {/* Bottom bar: same chrome as the Advanced editor - sky bar, red Cancel pill,
          Show Simulator toggle, white Save pill. */}
      <Box sx={{
        bgcolor: '#5ebbeb',
        px: 2,
        height: BOTTOM_BAR_HEIGHT, // fixed so the simulator panel ends exactly on the bar
        boxSizing: 'border-box',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000
      }}>
        {/* Cancel: same box shape as the Save button, red filled. */}
        <Button
          disableRipple
          disableElevation
          component={RouterLink} to={'/marketing/promotions'}
          sx={{
            // Same pill as Save (user 05/11/2026): 42px, 12px radius, bold - red filled.
            height: 42,
            px: '24px',
            borderRadius: '12px',
            fontSize: 16,
            fontWeight: 700,
            textTransform: 'none',
            bgcolor: '#fb2c36',
            color: '#fff',
            border: '1px solid #fb2c36',
            boxShadow: 'none',
            '&:hover': { bgcolor: '#ff6467', boxShadow: 'none' }
          }}
        >
          Cancel
        </Button>
        {/* Reference bar: Cancel at the left, the Show Simulator toggle sits beside Save at the right. */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto', mr: 2 }}>
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
        {/* Reference: while the promotion has no name / no items the Save button is an
            outlined (transparent, white border, no icon) 4px box; once it can be saved
            it becomes the white pill with the save icon. */}
        {(() => {
          // Save is always the white pill (user 05/11/2026: "same button all"); handleSave validates.
          return (
            <Button
              disableRipple
              disableElevation
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={loading}
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
                // While saving the button keeps its normal look (user 05/11/2026): no dimming, no label change.
                '&.Mui-disabled': { bgcolor: '#fff', color: '#00a6f4', opacity: 1 }
              }}
            >
              {loading ? 'Saving...' : 'Save'}
            </Button>
          );
        })()}
      </Box>

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

