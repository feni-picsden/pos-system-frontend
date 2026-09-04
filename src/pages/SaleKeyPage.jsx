import React, { useState, useEffect, useRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PageLoader from '../components/Common/PageLoader';
import {
  Box,
  Grid,
  Typography,
  TextField,
  Button,
  IconButton,
  Card,
  CardContent,
  Divider,
  InputAdornment,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  ClickAwayListener,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Autocomplete,
  Drawer,
  Collapse,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Snackbar,
  GlobalStyles,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Person as PersonIcon,
  PersonAddAlt1Outlined as PersonAddIcon, // reference "Add Customer" glyph
  Keyboard as KeyboardIcon,
  Folder as FolderIcon,
  ShoppingCart as CartIcon,
  Cancel as CancelIcon,
  CreditCard as CreditCardIcon,
  Phone as PhoneIcon,
  AttachMoney as MoneyIcon,
  ArrowUpward as ArrowUpIcon,
  EmojiEvents as PartyIcon,
  LocalDrink as DrinkIcon,
  LocalBar as BarIcon,
  LocalOffer as OfferIcon,
  Print as PrintIcon,
  Email as EmailIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  FormatBold,
  FormatItalic,
  FormatUnderlined,
  ColorLens,
  Image as ImageIcon,
  ArrowBack as ArrowBackIcon,
  TvOutlined as TvOutlinedIcon,
  VisibilityOutlined as VisibilityOutlinedIcon,
  Dashboard as DashboardIcon,
  PointOfSale as PointOfSaleIcon,
  KeyboardOutlined as KeyboardOutlinedIcon,
  LocalParkingOutlined as LocalParkingOutlinedIcon,
  DirectionsCarOutlined as DirectionsCarOutlinedIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import saleKeyService from '../services/saleKeyService';
import productService from '../services/productService';
import { taxRateService } from '../services/taxRateService';
import customerService from '../services/customerService';
import receiptTemplateService from '../services/receiptTemplateService';
import settingsService from '../services/settingsService';
import salesService from '../services/salesService';
import { emailSaleReceipt } from '../services/receiptEmailSender';
import registerService from '../services/registerService';
import ShopfrontDialog from '../components/Common/ShopfrontDialog';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { claimTakeoverUI } from '../services/registerControl';
import giftCardService from '../services/giftCardService';
import priceListService from '../services/priceListService';
import { priceSetService } from '../services/priceSetService';
import { applyPriceListToLine } from '../utils/priceListEngine';
import { lineSavings, itemsPerCase } from '../utils/saleTotals';
import { effectiveUnitCost } from '../utils/productCost';
import { surchargeService } from '../services/surchargeService';
import securityReportService from '../services/securityReportService';
import outletService from '../services/outletService';
import { useAuth } from '../contexts/AuthContext';
import { useAppDialogs } from '../components/Common/AppDialogProvider';
import { useSelectedOutlet } from '../contexts/SelectedOutletContext';
import { useSelectedRegister } from '../contexts/SelectedRegisterContext';
import RegisterSelectButton from '../components/Common/RegisterSelectButton';
import { usePermissions } from '../hooks/usePermissions';
import CreateCustomerWizardModal from '../components/Customers/CreateCustomerWizardModal';
import CustomerDetailsModal from '../components/Customers/CustomerDetailsModal';
import CustomerDialog from '../components/Customers/CustomerDialog';
import RequestValueDialog from '../components/SaleKey/RequestValueDialog';
import RequestReasonDialog from '../components/SaleKey/RequestReasonDialog';
import LoyaltyDisplay from '../components/Loyalty/LoyaltyDisplay';
import FinalizeSaleDialog from '../components/FinalizeSale/FinalizeSaleDialog';
import PayByCardDialog from '../components/Payment/PayByCardDialog';
import CashOutDialog from '../components/Payment/CashOutDialog';
import { isEftposMethod } from '../services/linklyService';
import paymentMethodService, { allowsCashOut, getPaymentMethodSettings } from '../services/paymentMethodService';
import loyaltyService from '../services/loyaltyService';
import cashManagementService from '../services/cashManagementService';
import productComboService from '../services/productComboService';
import classificationService from '../services/classificationService';
import PromotionProductsView from '../components/SaleKey/PromotionProductsView';
import SaleKeysGrid from '../components/SaleKey/SaleKeysGrid';
import CartSidebar, { KeypadPopover } from '../components/SaleKey/CartSidebar';
import AddSaleKeyDialog from '../components/SaleKey/AddSaleKeyDialog';
import BarcodeSelectDialog, { getBarcodeQuantity } from '../components/SaleKey/BarcodeSelectDialog';
import ReceiptRenderer from '../components/Receipt/ReceiptRenderer';
import ScaleToFit from '../components/Receipt/ScaleToFit';
import { buildReceiptPrintHtml } from '../utils/receiptPrintHtml';
import GeofenceValidator from '../components/Geofencing/GeofenceValidator';
import {
  openCustomerDisplayWindow,
  publishCustomerDisplayState,
  isCustomerDisplayWindowOpen,
} from '../utils/customerDisplayWindow';
import customerDisplayService from '../services/customerDisplayService';
import posLocalDb, { stripHtml } from '../services/posLocalDb';
import { syncAppDataInBackground, warmAppCache } from '../services/appDataSync';

// Single source of truth for customer-vs-group precedence (Shopfront spec).
// overrideCustomerGroup ON => the customer's OWN priceList/disablePromotions/
// requireOrderReference win; otherwise inherit the group's value. loyaltyEnabled
// is an OR: a member earns if either the customer OR their group has it on.
const getEffectiveCustomerSettings = (customer) => {
  const group = customer?.customerGroup || {};
  const override = Boolean(customer?.overrideCustomerGroup);
  // own value wins only under override AND only when actually set (undefined/''/null => inherit)
  const pick = (own, grp) => (override && own != null && own !== '' ? own : grp);
  return {
    disablePromotions: Boolean(pick(customer?.disablePromotions, group.disablePromotions)),
    requireOrderReference: Boolean(pick(customer?.requireOrderReference, group.requireOrderReference)),
    loyaltyEnabled: Boolean(customer?.loyaltyEnabled || group.loyaltyEnabled),
    // effective price list: customer's own under override, else the group's
    priceListId: pick(customer?.priceListId, group.priceListId) || null,
  };
};


// Search-results overlay + customer picker anatomy (reference: 75px gray band
// headers, 75px zebra rows with 1px black bottom borders, 8/32 padding).
const searchBandSx = {
  minHeight: 75,
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  p: '8px 32px 8px 24px',
  bgcolor: 'rgb(121,121,121)',
  color: '#f8f8f8',
  fontSize: '27.2px',
  fontWeight: 700,
  letterSpacing: 'normal',
  borderBottom: '1px solid #000',
};

const searchRowSx = (idx) => ({
  minHeight: 75,
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  p: '8px 32px',
  bgcolor: idx % 2 === 0 ? '#f8f8f8' : '#dfdfdf',
  borderBottom: '1px solid #000',
  cursor: 'pointer',
});

// self-check (silent unless a precedence rule breaks): runs once at module load.
console.assert(
  getEffectiveCustomerSettings({ customerGroup: { disablePromotions: true } }).disablePromotions === true,
  'ponytail: member inherits group disablePromotions'
);
console.assert(
  getEffectiveCustomerSettings({ overrideCustomerGroup: true, disablePromotions: false, customerGroup: { disablePromotions: true } }).disablePromotions === false,
  'ponytail: override with explicit false beats group true'
);
console.assert(
  getEffectiveCustomerSettings({ loyaltyEnabled: false, customerGroup: { loyaltyEnabled: true } }).loyaltyEnabled === true,
  'ponytail: loyalty is customer OR group'
);
console.assert(
  getEffectiveCustomerSettings(null).requireOrderReference === false,
  'ponytail: null/absent customer is a safe no-op'
);

// A tendered payment that went through the PIN pad (Linkly/EFTPOS/card) — clearing or
// cancelling a sale holding one would discard a real charge without a refund.
const hasIntegratedPayment = (payments) =>
  payments.some(p => {
    // Payments recorded via PayByCardDialog approval carry an explicit flag.
    if (p.integrated === true) return true;
    const m = p.method || p.paymentMethod || p.description || '';
    // 'Gift Card' tenders match \bcard\b but are not pinpad charges.
    return !/gift card/i.test(m) && isEftposMethod(m);
  });

// The open sale is stored under ONE key: the cart alone is not a sale, and
// restoring the goods without the money tendered for them is a cash-drawer
// discrepancy (F5, and the remount an outlet switch causes).
const ACTIVE_SALE_KEY = 'posActiveCart';
const readActiveSale = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(ACTIVE_SALE_KEY) || 'null');
    if (Array.isArray(saved)) return { cart: saved }; // legacy: cart-only value
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
};

const SaleKeyPage = () => {

  // In-app dialogs — these shadow window.alert/confirm/prompt on purpose.
  const { alert, confirm, prompt, notify } = useAppDialogs();
  const [searchTerm, setSearchTerm] = useState('');
  const [restoredSale] = useState(readActiveSale);
  const [cart, setCart] = useState(() => (Array.isArray(restoredSale.cart) ? restoredSale.cart : []));
  const [taxRates, setTaxRates] = useState([]);
  const [payments, setPayments] = useState(() =>
    Array.isArray(restoredSale.payments) ? restoredSale.payments : []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user, getOutletId } = useAuth();
  const { hasPermission } = usePermissions();
  const canViewLiveProfit = hasPermission('register.view_live_profit');
  // Shopfront's per-register-user "Discount" permission gates manual price edits
  // (backend alias register.discount -> catalog 'discount').
  const canDiscount = hasPermission('register.discount');
  // Request Quantity / Request Price ask through an in-app keypad dialog, never
  // window.prompt. askValue() resolves with the number, or null when cancelled.
  const [valueRequest, setValueRequest] = useState(null);
  const askValue = (options) =>
    new Promise((resolve) => setValueRequest({ ...options, resolve }));
  // Same pattern for the Setup > General "require a reason/note" gates.
  const [reasonRequest, setReasonRequest] = useState(null);
  const askReason = (options) =>
    new Promise((resolve) => setReasonRequest({ ...options, resolve }));
  // "Refunds Require Reason": every path that turns a cart line negative asks
  // first. Returns '' when the setting is off, null when the user cancelled.
  const askRefundReason = async () => {
    if (!generalSettings.refundsRequireReason) return '';
    // Reference has no predefined refund list — free text only.
    return askReason({ title: 'Reason for Refund', label: 'Refund reason' });
  };
  const [saleKeyConfig, setSaleKeyConfig] = useState(null);
  const [currentFolderName, setCurrentFolderName] = useState('Home Keys');
  const [currentFolder, setCurrentFolder] = useState(null); 
  const [mainSaleKeyConfig, setMainSaleKeyConfig] = useState(null);
  const [searchResults, setSearchResults] = useState({ products: [], customers: [] });
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [, setLocalProductIndex] = useState([]);
  const [localSearchReady, setLocalSearchReady] = useState(false);
  const [localBarcodeIndex, setLocalBarcodeIndex] = useState({});
  const [, setPosCacheSyncing] = useState(false);
  const [isCustomerSearchMode, setIsCustomerSearchMode] = useState(false);
  const [scanNotFound, setScanNotFound] = useState(null); // barcode string that failed lookup
  const [saleWarning, setSaleWarning] = useState(null); // warning toast text (reference-style guards)
  const [barcodeChoices, setBarcodeChoices] = useState(null); // { code, products } when a scan matches 2+ products
  const searchRef = useRef(null);
  const lastRegisterControlCheckRef = useRef(0);
  // Barcode scanning: serialize rapid scans, dedupe CR+LF double-Enters and
  // invalidate stale in-flight name searches (scanner input outruns renders).
  const scanQueueRef = useRef(Promise.resolve());
  const lastScanRef = useRef({ code: '', at: 0 });
  const searchSeqRef = useRef(0);
  // Bumped whenever the sale is cleared/parked/reset so scans still queued
  // from the previous sale are dropped instead of re-materializing the cart.
  const saleEpochRef = useRef(0);
  // Epoch whose completion already ran. completeTransaction is scheduled from inside
  // setPayments updaters (which React may invoke more than once) where the
  // isTransactionComplete guard reads a stale closure — this ref makes completion
  // idempotent per sale epoch so a sale can never POST twice.
  const completedEpochRef = useRef(-1);

  const [selectedCustomer, setSelectedCustomer] = useState(restoredSale.customer ?? null);
  // Order reference captured when a customer with effective requireOrderReference joins the sale.
  const [orderReference, setOrderReference] = useState(restoredSale.orderReference || '');
  // Effective price-list configuration for the attached customer (null when none / no customer).
  const [priceListConfig, setPriceListConfig] = useState(null);
  const [isTransactionComplete, setIsTransactionComplete] = useState(false);

  const [showReceipt, setShowReceipt] = useState(false);
  const [transactionId, setTransactionId] = useState(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  // Same object as `receiptData`, readable synchronously right after generateReceipt.
  const lastReceiptRef = useRef(null);
  // Persisted sale id of the just-completed sale (null until its save resolves) so the
  // manual "Email" button can send the real receipt via salesService.emailReceipt.
  const [lastSaleId, setLastSaleId] = useState(null);
  
  const [loyaltyRedemption, setLoyaltyRedemption] = useState(restoredSale.loyaltyRedemption ?? null);
  const [loyaltyCalculation, setLoyaltyCalculation] = useState(null);
  
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  // Pending Linkly PIN pad charge triggered by a card/EFTPOS sale key: { amountCents, methodName, description }
  const [saleKeyCardCharge, setSaleKeyCardCharge] = useState(null);
  // EFTPOS Refund Item loads owed after a completed sale (banner-group gift
  // cards, ref art. 360021214372): the card's value is loaded by running a
  // REFUND on the EFTPOS terminal. { name, amountCents, queue: [...rest] }
  const [eftposLoadCharge, setEftposLoadCharge] = useState(null);
  const [saleKeyCashOutPrompt, setSaleKeyCashOutPrompt] = useState(null); // { goodsCents, methodName, description }
  // Component picker opened by display-components-add/remove keys: { mode: 'add' | 'remove' }
  const [componentPicker, setComponentPicker] = useState(null);
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState([]);
  const [customerLoyaltyInfo, setCustomerLoyaltyInfo] = useState(null);
  const [registerPayments, setRegisterPayments] = useState(null);
  // Setup > General (company blob): cash-out gate, reason/note prompts and the
  // sale-keys position all read from the one cached copy.
  const allowCashOutNoSaleRef = useRef(true);
  const [generalSettings, setGeneralSettings] = useState(() =>
    settingsService.getCachedGeneralSettings()
  );
  useEffect(() => {
    settingsService
      .loadCachedGeneralSettings()
      .then((s) => {
        setGeneralSettings(s);
        if (s?.allowCashOutWithoutSale !== undefined) {
          allowCashOutNoSaleRef.current = s.allowCashOutWithoutSale !== false;
        }
      })
      .catch(() => {});
  }, []);

  // Setup > General > Users > "Sale Keys Position" overrides the company default.
  const [userSaleKeysPosition, setUserSaleKeysPosition] = useState('Default');
  useEffect(() => {
    if (!user?.id) return;
    settingsService
      .getUserSettings(user.id)
      .then((r) => setUserSaleKeysPosition(r?.settings?.saleKeysPosition || 'Default'))
      .catch(() => {});
  }, [user?.id]);
  const saleKeysPosition = userSaleKeysPosition && userSaleKeysPosition !== 'Default'
    ? userSaleKeysPosition.toLowerCase()
    : generalSettings.saleKeysPosition;

  const [receiptTemplates, setReceiptTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  // Register-scoped settings (Settings > Registers): drives the default receipt
  // template used on this screen and the print-on-refund auto-print decision.
  const [registerSettings, setRegisterSettings] = useState(null);

  const [showGiftCardPopup, setShowGiftCardPopup] = useState(false);
  const [giftCardCode, setGiftCardCode] = useState('');
  const [giftCardLoading, setGiftCardLoading] = useState(false);
  const [giftCardError, setGiftCardError] = useState('');
  // 'sell' = add-gift-card action loads a card as a positive line; 'pay' = redeem a card as a tender.
  const [giftCardMode, setGiftCardMode] = useState('sell');
  // Cards tendered this sale, decremented ONCE at completion (never in sales.js — avoids double-redeem).
  // A ref, not state: completion fires via a deferred timer and reads this synchronously; a state
  // closure could be stale and miss a just-added redemption.
  const pendingGiftCardRef = useRef([]);

  const [showProductSidebar, setShowProductSidebar] = useState(false);
  const [productDetails, setProductDetails] = useState(null);
  const [selectedCartItem, setSelectedCartItem] = useState(null);
  const [productDetailsLoading, setProductDetailsLoading] = useState(false);

  const [showAddSaleKeyDialog, setShowAddSaleKeyDialog] = useState(false);
  
  const navigate = useNavigate();
  const routerLocation = useLocation();
  // Sales History "Return Items" lands here with the sale number to recall.
  const returnRecallDoneRef = useRef(false);
  useEffect(() => {
    const num = routerLocation.state?.returnSaleNumber;
    if (!num || returnRecallDoneRef.current) return;
    returnRecallDoneRef.current = true;
    // Clear the state so a refresh doesn't re-trigger the recall prompt.
    navigate(routerLocation.pathname, { replace: true, state: {} });
    recallSaleAsReturn(String(num));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routerLocation.state]);

  // Every page reads the active outlet from SelectedOutletContext. Keeping a
  // second copy here is what made the location selector look like a no-op: it
  // only moved this component's state and wrote localStorage directly, so
  // nothing else in the app ever switched outlet.
  const { selectedOutletId: selectedOutlet } = useSelectedOutlet();
  // The register selection + its two-step Location Selector are app-wide now
  // (provider in App.jsx, dialog mounted in DashboardLayout). This page only
  // consumes them; the sale-specific promotion reload stays here.
  const {
    selectedRegister,
    setSelectedRegister,
    availableRegisters,
    openLocationSelector,
    persistRegister,
    clearSelectedRegister,
    getOutletName,
    openRegister: handleOpenRegister,
    openingRegister,
  } = useSelectedRegister();
  const [outlets, setOutlets] = useState([]);
  const [showControlTakenDialog, setShowControlTakenDialog] = useState(false);
  const [controlTakenByName, setControlTakenByName] = useState('');
  const [customerDisplaySettings, setCustomerDisplaySettings] = useState(null);
  const [isCustomerDisplayOpen, setIsCustomerDisplayOpen] = useState(false);
  const customerDisplayWindowRef = useRef(null);
  const lastCustomerDisplayPayloadRef = useRef('');
  const customerDisplayApiTimerRef = useRef(null);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [useCaseQuantityMode, setUseCaseQuantityMode] = useState(false);
  const [newSaleKey, setNewSaleKey] = useState({
    name: '',
    action: '',
    amount: '',
    backgroundColor: '#4CAF50',
    textColor: '#FFFFFF',
    borderColor: '#000000',
    fontSize: 16,
    textStyle: {
      bold: false,
      italic: false,
      underline: false
    },
    image: null,
    imageFile: null,
    selectedProduct: null,
    paymentMethod: 'cash',
    requestQuantity: false,
    quantity: '',
    requestCaseQuantity: false,
    caseQuantity: '',
    comboId: null,
    selectedPaymentMethod: null,
    promotionType: 'Current', 
    position: { x: 0, y: 0, w: 1, h: 1 }
  });
  const [keysLoading, setKeysLoading] = useState(false); // loading for folder navigation only

  // Parked sales state
  const [parkedSales, setParkedSales] = useState([]);
  const [parkedSalesLoading, setParkedSalesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('sales-keys'); // 'sales-keys' or 'parked-sales'
  const [currentParkedSaleId, setCurrentParkedSaleId] = useState(restoredSale.parkedSaleId ?? null); // Track if current cart is from a resumed parked sale

  // Persist the WHOLE open sale on every change — cart plus the payments,
  // customer and loyalty attached to it. A completed transaction stores an empty
  // sale: what is on screen then is a receipt, not an open sale, and restoring
  // it after a refresh would risk charging the customer twice.
  useEffect(() => {
    try {
      localStorage.setItem(
        ACTIVE_SALE_KEY,
        JSON.stringify(
          isTransactionComplete
            ? {}
            : {
                cart,
                payments,
                customer: selectedCustomer,
                orderReference,
                loyaltyRedemption,
                parkedSaleId: currentParkedSaleId,
              }
        )
      );
    } catch {
      // localStorage unavailable (private mode) — sale is session-only
    }
  }, [
    cart,
    payments,
    selectedCustomer,
    orderReference,
    loyaltyRedemption,
    currentParkedSaleId,
    isTransactionComplete,
  ]);
  const [activePromotions, setActivePromotions] = useState([]);
  // F5: Product Combos (Stock Management > Product Combos) that reprice the
  // cart alongside Combo Deal promotions. See hydrateActiveCombos().
  const [activeCombos, setActiveCombos] = useState([]);
  // Guards hydrateActiveCombos against stale async responses (rapid outlet switches)
  const comboFetchSeqRef = useRef(0);
  // True once combos were confirmed by the API — stops the local-cache
  // fallback from resurrecting combos the server says no longer exist.
  const combosConfirmedRef = useRef(false);
  const [showCreateCustomerModal, setShowCreateCustomerModal] = useState(false);
  const [showCustomerDetailsModal, setShowCustomerDetailsModal] = useState(false);
  const [customerWizardData, setCustomerWizardData] = useState(null);
  // Attached-customer dialog (clicking the name in the sidebar band)
  const [showAttachedCustomerDialog, setShowAttachedCustomerDialog] = useState(false);
  const [showQuantityKeypad, setShowQuantityKeypad] = useState(false);
  const [quantityKeypadItem, setQuantityKeypadItem] = useState(null);
  const [keypadValue, setKeypadValue] = useState('');
  const [keypadAnchorEl, setKeypadAnchorEl] = useState(null);
  const [showProductDetail, setShowProductDetail] = useState(false);
  const [selectedProductDetail, setSelectedProductDetail] = useState(null);
  const [productDetailCartItem, setProductDetailCartItem] = useState(null);
  const [showDetailCosts, setShowDetailCosts] = useState(false);
  // Reference: all four detail accordions start collapsed
  const [productDetailExpanded, setProductDetailExpanded] = useState({
    prices: false,
    additionalFields: false,
    purchases: false,
    inventory: false
  });
  // Live profit toggle is remembered between sales (Shopfront behavior)
  const [showLiveProfit, setShowLiveProfit] = useState(() => {
    try {
      return localStorage.getItem('posShowLiveProfit') === '1';
    } catch {
      return false;
    }
  });
  const [showPromotionProducts, setShowPromotionProducts] = useState(false);
  const [showPromotionView, setShowPromotionView] = useState(false); // Full screen promotion view
  const [promotionTypeFilter, setPromotionTypeFilter] = useState('Current'); // Current, Future, All
  const [promotionProducts, setPromotionProducts] = useState([]);
  const [loadingPromotionProducts, setLoadingPromotionProducts] = useState(false);
  const [promotionSearchTerm, setPromotionSearchTerm] = useState('');
  const [selectedPromotionProduct, setSelectedPromotionProduct] = useState(null);
  const [showClassificationView, setShowClassificationView] = useState(false);
  const [classificationProducts, setClassificationProducts] = useState([]);
  const [loadingClassificationProducts, setLoadingClassificationProducts] = useState(false);
  const [classificationSearchTerm, setClassificationSearchTerm] = useState('');
  const [selectedClassificationProduct, setSelectedClassificationProduct] = useState(null);
  const [currentClassification, setCurrentClassification] = useState(null);
  const [useCaseQuantity, setUseCaseQuantity] = useState(false);
  const [surchargeSchedules, setSurchargeSchedules] = useState([]);
  
  // Geofencing state
  const [geofenceValidated, setGeofenceValidated] = useState(false);
  const [previousOutletId, setPreviousOutletId] = useState(null);

  // Reset geofencing validation when outlet changes
  useEffect(() => {
    const currentOutletId = user?.outletId;
    
    // If outlet changed, reset geofencing validation
    if (previousOutletId !== null && currentOutletId !== previousOutletId) {
      console.log('Outlet changed, resetting geofencing validation:', {
        previousOutletId,
        newOutletId: currentOutletId
      });
      setGeofenceValidated(false);
    }
    
    setPreviousOutletId(currentOutletId);
  }, [user?.outletId]);

  useEffect(() => {
    // Reload sale key config when the effective outlet changes (user switch or outlet selection)
    loadSaleKeyConfig();
    loadReceiptTemplates();
    loadParkedSales();
    loadPaymentMethods();
    loadSurchargeSchedules();
    
    // Load outlets for superadmin
    if (user?.isSuperAdmin) {
      loadOutlets();
      // Saved outlet selection is hydrated by SelectedOutletContext.
    }
    
    // SelectedRegisterContext hydrates the stored register. What stays here is
    // the sell-screen-only boot fallback: with nothing stored, adopt a register
    // already assigned to this user, otherwise pop the Location Selector. Keeping
    // it here is what keeps the auto-open sell-screen-only.
    const savedRegisterId = localStorage.getItem('selectedRegisterId');
    const savedRegisterName = localStorage.getItem('selectedRegisterName');
    if (!savedRegisterId || !savedRegisterName) {
      setTimeout(async () => {
        try {
          const registers = await registerService.list({ isActive: true });
          const userRegister = registers.find(reg =>
            reg.currentUser &&
            reg.currentUser.id &&
            user &&
            reg.currentUser.id === user.id
          );

          if (userRegister) {
            const fullRegister = {
              ...userRegister,
              outletId: userRegister.outletId || userRegister.outlet?.id || null
            };
            persistRegister(fullRegister);
          } else {
            // No register assigned to user, show location selector
            openLocationSelector();
          }
        } catch (error) {
          console.error('Error checking for user register:', error);
          openLocationSelector();
        }
      }, 1000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.outletId, selectedOutlet]);

  // Setup > General > Registers > Edit > Payment Methods writes
  // register_profile_<id>.payments — a map of paymentMethodId -> enabled.
  useEffect(() => {
    const loadRegisterPayments = async () => {
      if (!selectedRegister?.id) {
        setRegisterPayments(null);
        return;
      }
      try {
        const res = await settingsService.getSetting(`register_profile_${selectedRegister.id}`);
        setRegisterPayments(res?.setting?.value?.payments || null);
      } catch {
        setRegisterPayments(null); // no profile saved yet — every method stays available
      }
    };
    loadRegisterPayments();
  }, [selectedRegister?.id]);

  // Active Price Set (Settings > Price Sets). null = the products' Default Price
  // Set. Initialised from the register's "Default Price Set" setting; a
  // change-price-set sale key switches it for the whole sale. The ref mirrors the
  // state synchronously so a switch can reprice the cart in the same tick.
  const [activePriceSetId, setActivePriceSetId] = useState(null);
  const activePriceSetRef = useRef(null);
  const applyActivePriceSet = (id) => {
    activePriceSetRef.current = id ? Number(id) : null;
    setActivePriceSetId(activePriceSetRef.current);
  };
  useEffect(() => {
    const loadRegisterDefaultPriceSet = async () => {
      if (!selectedRegister?.id) { applyActivePriceSet(null); return; }
      try {
        const res = await settingsService.getRegisterSettings(selectedRegister.id);
        applyActivePriceSet(res?.settings?.defaultPriceSetId || null);
      } catch {
        applyActivePriceSet(null); // no register settings saved yet — default prices
      }
    };
    loadRegisterDefaultPriceSet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRegister?.id]);

  // Reference rule: if the product has ANY price rows in the active set, that set
  // replaces the entire default group; otherwise the default (null-set) rows apply.
  const effectivePrices = (product) => {
    const rows = Array.isArray(product?.prices) ? product.prices : [];
    const setId = activePriceSetRef.current;
    if (setId) {
      const inSet = rows.filter((r) => Number(r.priceSetId) === Number(setId));
      if (inSet.length > 0) return inSet;
    }
    return rows.filter((r) => r.priceSetId == null);
  };

  useEffect(() => {
    const loadRegisterCustomerDisplaySettings = async () => {
      if (!selectedRegister?.id) return;
      try {
        const config = await customerDisplayService.getRegisterConfig(selectedRegister.id);
        setCustomerDisplaySettings(config || null);
      } catch (error) {
        console.error('Failed to load register customer display settings:', error);
      }
    };

    loadRegisterCustomerDisplaySettings();
  }, [selectedRegister?.id]);

  // Promotions are a sale-screen concern, so they stay out of the shared register
  // context: one effect keyed on the chosen register replaces the four copies of
  // this 500ms reload that used to sit inside the register handlers.
  useEffect(() => {
    if (!selectedRegister?.id) return;
    const t = setTimeout(() => {
      if (getOutletIdForPromotions()) {
        loadActivePromotions();
      } else {
        loadActivePromotionsWithoutOutlet();
      }
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRegister?.id]);

  const handleOpenCustomerDisplayWindow = async () => {
    const fromStorage = localStorage.getItem('selectedRegisterId');
    const parsed = fromStorage ? parseInt(fromStorage, 10) : NaN;
    const registerId = selectedRegister?.id ?? (Number.isNaN(parsed) ? null : parsed);
    const popup = await openCustomerDisplayWindow(registerId ?? undefined);
    if (!popup) {
      alert('Popup was blocked. Please allow popups and manage windows on all displays.');
      return;
    }

    customerDisplayWindowRef.current = popup;
    setIsCustomerDisplayOpen(true);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      if (customerDisplayWindowRef.current && customerDisplayWindowRef.current.closed) {
        customerDisplayWindowRef.current = null;
        setIsCustomerDisplayOpen(false);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!customerDisplaySettings?.openWhenRegisterOpens) return;
    if (!selectedRegister) return;
    if (customerDisplayWindowRef.current && !customerDisplayWindowRef.current.closed) return;
    handleOpenCustomerDisplayWindow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRegister, customerDisplaySettings?.openWhenRegisterOpens]);

  useEffect(() => {
    if (!selectedRegister?.id) return;

    const subtotal = (cart || []).reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
    const displayPayload = {
      mode: cart.length ? 'sale' : 'idle',
      cartItems: cart.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity || 1,
        unitPrice: (parseFloat(item.price) || 0) / Math.max(parseFloat(item.quantity) || 1, 1),
        totalPrice: parseFloat(item.price) || 0,
        isPromotion: Boolean(item.isPromotionItem),
      })),
      totals: {
        subtotal,
        total: subtotal,
        savings: getCartDiscountTotals(cart).savings,
        itemCount: cart.reduce((sum, item) => sum + (parseFloat(item.quantity) || 1), 0),
      },
      customer: selectedCustomer
        ? {
            id: selectedCustomer.id,
            name: `${selectedCustomer.firstName || ''} ${selectedCustomer.lastName || ''}`.trim(),
          }
        : null,
    };

    const payloadKey = JSON.stringify(displayPayload);
    if (payloadKey === lastCustomerDisplayPayloadRef.current) {
      return;
    }
    lastCustomerDisplayPayloadRef.current = payloadKey;

    // Instant local update for customer display popup (no network).
    publishCustomerDisplayState(
      selectedRegister.id,
      displayPayload.mode,
      { ...displayPayload, updatedAt: Date.now() }
    );

    // Remote / server-backed display: debounced API, not on every click.
    if (customerDisplayApiTimerRef.current) {
      clearTimeout(customerDisplayApiTimerRef.current);
    }
    customerDisplayApiTimerRef.current = setTimeout(() => {
      if (isCustomerDisplayWindowOpen()) {
        return;
      }
      customerDisplayService
        .updateRegisterState(selectedRegister.id, displayPayload.mode, {
          ...displayPayload,
          updatedAt: Date.now(),
        })
        .catch((error) => {
          console.error('Failed to sync customer display state:', error);
        });
    }, 2000);

    return () => {
      if (customerDisplayApiTimerRef.current) {
        clearTimeout(customerDisplayApiTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, selectedCustomer, selectedRegister?.id]);

  useEffect(() => {
    if (selectedRegister?.id) {
      loadSurchargeSchedules();
    }
  }, [selectedRegister?.id]);

  useEffect(() => {
    const checkAndLoadPromotions = () => {
      const outletId = getOutletIdForPromotions();
      console.log('useEffect: Checking outlet ID:', outletId, 'selectedRegister:', selectedRegister, 'user:', user);
      
      if (outletId) {
        console.log('useEffect: Loading promotions for outlet:', outletId);
        loadActivePromotions();
        return true;
      }
      return false;
    };

    if (!checkAndLoadPromotions()) {
      const timer1 = setTimeout(() => {
        if (!checkAndLoadPromotions()) {
          const timer2 = setTimeout(() => {
            checkAndLoadPromotions();
          }, 2000);
          return () => clearTimeout(timer2);
        }
      }, 1000);
      return () => clearTimeout(timer1);
    }
  }, [selectedRegister, user]);

  useEffect(() => {
    if (selectedCustomer?.id) {
      loadCustomerLoyaltyInfo();
    } else {
      setCustomerLoyaltyInfo(null);
    }
  }, [selectedCustomer?.id]);

  // ponytail: enforces effective requireOrderReference. Keyed on customer id so it
  // prompts exactly once when a customer that needs a reference joins the sale, and
  // drops the reference whenever the customer leaves — one choke covering every
  // add path (search select / create / parked restore) and every reset path.
  useEffect(() => {
    if (!selectedCustomer?.id) {
      setOrderReference('');
      return;
    }
    // A restored sale already has its reference — don't re-prompt on remount
    // (refresh / outlet switch).
    if (orderReference) return;
    if (getEffectiveCustomerSettings(selectedCustomer).requireOrderReference) {
      prompt('Enter order reference number for this sale:', '', { title: 'Order reference' })
        .then((ref) => setOrderReference(ref ? ref.trim() : ''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer?.id]);

  // ponytail: effective price list — fetch the customer/group price-list configuration once
  // when a customer joins so calculatePriceForQuantity can apply it. Cleared when none.
  // Ceiling: applies to items priced AFTER the config loads (the normal flow: attach the
  // customer, then scan). Items scanned before a late customer-attach are not retro-repriced
  // here to avoid a reprice loop with the combo effect; add a guarded cart remap if that flow matters.
  useEffect(() => {
    const plId = getEffectiveCustomerSettings(selectedCustomer).priceListId;
    if (!plId) {
      setPriceListConfig(null);
      return;
    }
    let cancelled = false;
    priceListService.getPriceListConfiguration(plId)
      .then((res) => { if (!cancelled) setPriceListConfig(res?.configuration || res || null); })
      .catch(() => { if (!cancelled) setPriceListConfig(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer?.id]);

  // Auto-complete when paid in full on the sales screen (same as $100 / pay-exact sale keys)
  useEffect(() => {
    if (isTransactionComplete || showFinalizeDialog || cart.length === 0 || payments.length === 0) {
      return;
    }
    if (!isSaleFullyPaid(payments, calculateTotal())) {
      return;
    }
    const timer = setTimeout(() => {
      tryCompleteSaleIfFullyPaid(payments);
    }, 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, cart, isTransactionComplete, showFinalizeDialog]);

  useEffect(() => {
    if (cart.length > 0 && activePromotions.length === 0) {
      hydrateActivePromotionsFromLocal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.length, activePromotions.length]);

  // F5: same fallback for Product Combos — if the cart has items but no combos
  // were hydrated yet (e.g. the promotions load path never fired), pick them up
  // from the in-memory cache. Local read only, so this cannot spam the API.
  useEffect(() => {
    if (cart.length === 0 || activeCombos.length > 0 || combosConfirmedRef.current) return;
    const local = normalizeActiveCombos(posLocalDb.getCombos(), getOutletIdForPromotions());
    if (local.length) setActiveCombos(local);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.length, activeCombos.length]);

  // F4/F5: reprice the cart whenever it (or the promotion/combo set) changes
  // so that complete Combo Deal / Product Combo sets are charged at the combo
  // price. The engine is idempotent (returns null when nothing changed), so
  // this cannot loop.
  useEffect(() => {
    if (!cart.length) return;
    // Functional update: rapid scans can enqueue functional adds between this
    // effect's commit and its flush — dispatching a repriced copy of the
    // closed-over `cart` snapshot would clobber those adds (silently dropping
    // scanned items). Repricing `prev` keeps every concurrent add.
    // ponytail: enforces effective disablePromotions on the combo path too. Passing
    // empty defs makes applyComboDealsToCart restore any combo line back to its base
    // price, so a "no promotions" member is never charged a combo deal.
    const noPromos = getEffectiveCustomerSettings(selectedCustomer).disablePromotions;
    setCart((prev) => applyComboDealsToCart(prev, noPromos ? [] : activePromotions, noPromos ? [] : activeCombos) ?? prev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, activePromotions, activeCombos, selectedCustomer?.id]);

  // This page owns the takeover dialog while it's mounted, so the global
  // RegisterTakeoverWatcher stays quiet and they don't stack.
  useEffect(() => claimTakeoverUI(), []);

  // `force` skips the throttle: anything that writes a sale must see the
  // register's real state, not a cached "we still hold it".
  const ensureRegisterControl = async ({ force = false } = {}) => {
    try {
      const savedRegisterId = localStorage.getItem('selectedRegisterId');
      if (!savedRegisterId) {
        // Must go through openLocationSelector: it resets the step to 'register'
        // (the dialog's step now lives in the provider and survives navigation)
        // and refetches the register list this dialog is about to show.
        openLocationSelector({ force: true });
        return false;
      }
      // Throttle only. There used to be a `selectedRegister.id === saved` early
      // return here, which is true for every call once a register is picked —
      // it made the takeover check below dead code.
      const now = Date.now();
      if (!force && now - lastRegisterControlCheckRef.current < 60000) {
        return true;
      }
      const regs = await registerService.list({ isActive: true });
      const current = regs.find(r => r.id === parseInt(savedRegisterId));
      if (!current) {
        openLocationSelector({ force: true });
        return false;
      }
      if (current.currentUser && current.currentUser.id && user && current.currentUser.id !== user.id) {
        // Keep the selection: the reference's dialog offers to take the
        // register back, which needs its id. Choosing a location clears it.
        setControlTakenByName(current.currentUser.name || 'Another user');
        setShowControlTakenDialog(true);
        return false;
      }
      lastRegisterControlCheckRef.current = now;
      return true;
    } catch (e) {
      return false;
    }
  };

  const loadSaleKeyConfig = async () => {
    try {
      setLoading(true);
      setError('');
      
      const defaultConfig = saleKeyService.getDefaultConfig('home-keys');
      setSaleKeyConfig(defaultConfig);
      setMainSaleKeyConfig(defaultConfig);
      
      try {
        const outletId = getEffectiveOutletId();
        const defaultSaleKeyInfo = await settingsService.getDefaultSaleKeySet();

        const allSets = await saleKeyService.getSaleKeySets(outletId);
        const sets = allSets?.saleKeySets || [];

        // 0) The user's own set wins - Setup > General > Users says it
        // "overrides all other sale key settings".
        const userSaleKeys = user?.id
          ? (await settingsService.getUserSettings(user.id).catch(() => null))?.settings?.saleKeys
          : null;
        let targetSet = userSaleKeys && userSaleKeys !== 'Default'
          ? sets.find(set => set.name === userSaleKeys)
          : null;

        // 1) Prefer outlet-wise default (isDefault flag per outlet)
        if (!targetSet) targetSet = sets.find(set => set.isDefault);

        // 2) Fallback to global/company default from general settings
        if (!targetSet && defaultSaleKeyInfo.id) {
          targetSet = sets.find(set => set.id === defaultSaleKeyInfo.id);
        }
        
        if (!targetSet && defaultSaleKeyInfo.name) {
          targetSet = sets.find(set => 
            set.name.toLowerCase() === defaultSaleKeyInfo.name.toLowerCase() ||
            set.name.toLowerCase().replace(/\s+/g, '-') === defaultSaleKeyInfo.name.toLowerCase().replace(/\s+/g, '-')
          );
        }
        
        // 3) Then well-known "Home Keys" names
        if (!targetSet) {
          targetSet = sets.find(set =>
            set.name.toLowerCase() === 'home keys' ||
            set.name.toLowerCase() === 'home-keys' ||
            set.name.toLowerCase() === 'homekeys'
          );
        }

        // 4) Any set this outlet owns beats an empty sell screen. Without this,
        // an outlet with sets but no isDefault (and no name match) rendered the
        // blank placeholder grid.
        if (!targetSet) {
          targetSet = sets.find(set => set.isActive) || sets[0];
        }

        if (targetSet) {
          const setData = await saleKeyService.getSaleKeySet(targetSet.id);
          if (setData && setData.config) {
            const config = {
              ...setData.config,
              gridSize: typeof setData.config.gridSize === 'string' 
                ? JSON.parse(setData.config.gridSize) 
                : setData.config.gridSize,
              saleKeys: typeof setData.config.saleKeys === 'string' 
                ? JSON.parse(setData.config.saleKeys) 
                : setData.config.saleKeys || []
            };
            setSaleKeyConfig(config);
            setMainSaleKeyConfig(config);
            setCurrentFolderName(targetSet.name);
          }
        }
      } catch (apiError) {
        console.warn('API not available, using default config:', apiError);
        // Keep the default config that was already set
      }
    } catch (err) {
      console.error('Error loading sale key config:', err);
      setError('Failed to load sale key configuration');
      // Use default config as fallback
      setSaleKeyConfig(saleKeyService.getDefaultConfig('home-keys'));
      setMainSaleKeyConfig(saleKeyService.getDefaultConfig('home-keys'));
    } finally {
      setLoading(false);
    }
  };

  // Load a specific folder's sale keys
  const loadFolder = async (folderId, folderName) => {
    try {
      setKeysLoading(true);
      
      let folderData = null;
      
      // First try to load by ID if we have one
      if (folderId && folderId !== folderName) {
        try {
          folderData = await saleKeyService.getSaleKeySet(folderId);
        } catch (error) {
        }
      }
      
      // If ID lookup failed or we only have a name, try to find by name
      if (!folderData) {
        try {
          const outletId = getEffectiveOutletId();
          const allSets = await saleKeyService.getSaleKeySets(outletId ?? undefined);
          const matchingSet = allSets.saleKeySets?.find(set => set.name === folderName);
          if (matchingSet) {
            folderData = await saleKeyService.getSaleKeySet(matchingSet.id);
          }
        } catch (error) {
        }
      }
      
      if (folderData && folderData.config) {
        // Parse JSON strings if needed
        const config = {
          ...folderData.config,
          gridSize: typeof folderData.config.gridSize === 'string' 
            ? JSON.parse(folderData.config.gridSize) 
            : folderData.config.gridSize,
          saleKeys: typeof folderData.config.saleKeys === 'string' 
            ? JSON.parse(folderData.config.saleKeys) 
            : folderData.config.saleKeys || []
        };
        setSaleKeyConfig(config);
        setCurrentFolder({ id: folderData.id || folderId, name: folderName });
        setCurrentFolderName(folderName);
      } else {
        console.warn('No config found for folder:', folderName);
        setError(`No configuration found for folder "${folderName}"`);
      }
    } catch (error) {
      console.error('Error loading folder:', error);
      setError(`Failed to load folder "${folderName}"`);
    } finally {
      setKeysLoading(false);
    }
  };

  const goBackToMain = () => {
    setCurrentFolder(null);
    setSaleKeyConfig(mainSaleKeyConfig);
    setCurrentFolderName('Home Keys');
    setError('');
  };

  const loadReceiptTemplates = async () => {
    try {
      setTemplatesLoading(true);
      // Load templates and the register settings together — the register's
      // "Default receipt template" (stored by NAME) is the top selection tier.
      const [response, regResponse] = await Promise.all([
        receiptTemplateService.getTemplates({ for: 'Sale' }),
        settingsService.getRegisterSettings().catch(() => null),
      ]);
      const regSettings = regResponse?.settings || null;
      if (regSettings) setRegisterSettings(regSettings);
      setReceiptTemplates(response.templates || []);

      // Template selection, same tiers as the reference (measured 2026-08-05,
      // docs/parity/receipt-template.md §2): the "Default Receipt Template" setting
      // (Setup > General > Registers) wins, then a template belonging to this outlet,
      // then the first. There is no per-register template and no per-template
      // "default" flag — the reference has neither.
      const templates = response.templates || [];
      const settingTemplateId = regSettings?.defaultReceiptTemplateId;
      const legacySettingName = regSettings?.defaultReceiptTemplate; // pre-id saves
      const outletId = getEffectiveOutletId();
      const defaultTemplate =
        (settingTemplateId && templates.find(t => t.id === settingTemplateId)) ||
        (legacySettingName && templates.find(t => t.name === legacySettingName)) ||
        (outletId && templates.find(t => t.outletId === outletId)) ||
        templates[0];
      if (defaultTemplate) {
        setSelectedTemplate(defaultTemplate);
      }
    } catch (error) {
      console.error('Error loading receipt templates:', error);
      // // Set fallback templates with component configurations
      // setReceiptTemplates([
      //   { 
      //     id: 1, 
      //     name: 'Receipt', 
      //     type: 'Normal', 
      //     config: { 
      //       layout: 'normal',
      //       components: [
      //         {
      //           type: 'header',
      //           visible: true,
      //           showPhone: true,
      //           showABN: true,
      //           showInvoiceTitle: true,
      //           showDate: true,
      //           showInvoiceNumber: true
      //         },
      //         {
      //           type: 'products',
      //           visible: true,
      //           showHeader: true
      //         },
      //         {
      //           type: 'tax',
      //           visible: true,
      //           showRounding: true,
      //           showGST: true
      //         },
      //         {
      //           type: 'payments',
      //           visible: true,
      //           showInvalidNote: true
      //         },
      //         {
      //           type: 'totals',
      //           visible: true,
      //           showTotal: true,
      //           showChange: true
      //         },
      //         {
      //           type: 'text',
      //           visible: true,
      //           text: 'Thank you for shopping with us',
      //           align: 'center'
      //         }
      //       ]
      //     } 
      //   },
      //   { 
      //     id: 2, 
      //     name: 'A4 Invoice', 
      //     type: 'A4', 
      //     config: { 
      //       layout: 'a4',
      //       components: [
      //         {
      //           type: 'header',
      //           visible: true,
      //           showBusinessName: true,
      //           showAddress: true,
      //           showPhone: true,
      //           showABN: true,
      //           showInvoiceTitle: true,
      //           showDate: true,
      //           showInvoiceNumber: true
      //         },
      //         {
      //           type: 'products',
      //           visible: true,
      //           showHeader: true
      //         },
      //         {
      //           type: 'totals',
      //           visible: true,
      //           showTotal: true,
      //           showChange: true
      //         }
      //       ]
      //     } 
      //   },
      //   { 
      //     id: 3, 
      //     name: 'Text Only Receipt', 
      //     type: 'Text', 
      //     config: { 
      //       layout: 'text',
      //       components: [
      //         {
      //           type: 'header',
      //           visible: true,
      //           showBusinessName: true,
      //           showAddress: true,
      //           showPhone: true,
      //           showABN: true,
      //           showInvoiceTitle: true,
      //           showDate: true,
      //           showInvoiceNumber: true
      //         },
      //         {
      //           type: 'products',
      //           visible: true,
      //           showHeader: false
      //         },
      //         {
      //           type: 'totals',
      //           visible: true,
      //           showTotal: true,
      //           showChange: true
      //         }
      //       ]
      //     } 
      //   },
      //   {
      //     id: 4,
      //     name: 'Receipt with Barcode',
      //     type: 'Normal',
      //     config: {
      //       layout: 'normal',
      //       components: [
      //         {
      //           type: 'barcode',
      //           visible: true,
      //           label: 'Receipt Barcode',
      //           barcodeValue: 'AUTO',
      //           properties: {
      //             backgroundColor: '#ffffff',
      //             padding: 5,
      //             type: 'barcode',
      //             visible: true
      //           }
      //         },
      //         {
      //           type: 'outlet_logo',
      //           visible: true,
      //           imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      //           width: 'auto',
      //           height: 'auto',
      //           horizontalAlignment: 'center',
      //           properties: {
      //             width: 'auto',
      //             height: 'auto',
      //             horizontalAlignment: 'center',
      //             imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      //             visible: true
      //           }
      //         },
      //         {
      //           type: 'products',
      //           visible: true,
      //           showHeader: true,
      //           title: 'Products',
      //           fields: [
      //             { name: 'Product', enabled: true },
      //             { name: 'Case Qty', enabled: true },
      //             { name: 'Qty', enabled: true },
      //             { name: 'Item Price', enabled: false },
      //             { name: 'Discount', enabled: true },
      //             { name: 'Price', enabled: false },
      //             { name: 'Case Price', enabled: false },
      //             { name: 'Normal Price', enabled: false },
      //             { name: 'Total Items', enabled: false },
      //             { name: 'Savings', enabled: true }
      //           ],
      //           properties: {
      //             title: 'Products',
      //             backgroundColor: '#ffffff',
      //             border: { color: '#000000', style: 'solid' },
      //             fields: [
      //               { name: 'Product', enabled: true },
      //               { name: 'Case Qty', enabled: true },
      //               { name: 'Qty', enabled: true },
      //               { name: 'Item Price', enabled: false },
      //               { name: 'Discount', enabled: true },
      //               { name: 'Price', enabled: false },
      //               { name: 'Case Price', enabled: false },
      //               { name: 'Normal Price', enabled: false },
      //               { name: 'Total Items', enabled: false },
      //               { name: 'Savings', enabled: true }
      //             ],
      //             fontColor: '#000000',
      //             fontSize: 14
      //           }
      //         },
      //         {
      //           type: 'totals',
      //           visible: true,
      //           showTotal: true,
      //           showChange: true
      //         }
      //       ]
      //     }
      //   }
      // ]);
      // setSelectedTemplate({ 
      //   id: 1, 
      //   name: 'Receipt', 
      //   type: 'Normal', 
      //   config: { 
      //     layout: 'normal',
      //     components: [
      //       {
      //         type: 'header',
      //         visible: true,
      //         showPhone: true,
      //         showABN: true,
      //         showInvoiceTitle: true,
      //         showDate: true,
      //         showInvoiceNumber: true
      //       },
      //       {
      //         type: 'products',
      //         visible: true,
      //         showHeader: true
      //       },
      //       {
      //         type: 'tax',
      //         visible: true,
      //         showRounding: true,
      //         showGST: true
      //       },
      //       {
      //         type: 'payments',
      //         visible: true,
      //         showInvalidNote: true
      //       },
      //       {
      //         type: 'totals',
      //         visible: true,
      //         showTotal: true,
      //         showChange: true
      //       },
      //       {
      //         type: 'text',
      //         visible: true,
      //         text: 'Thank you for shopping with us',
      //         align: 'center'
      //       }
      //     ]
      //   } 
      // });
    } finally {
      setTemplatesLoading(false);
    }
  };

  const resolveProductLocal = (ref, nameFallback) =>
    posLocalDb.resolveProduct(ref, nameFallback);

  const syncLocalPosCatalogState = () => {
    setLocalProductIndex(posLocalDb.getProducts());
    setLocalBarcodeIndex(posLocalDb.getBarcodeMap());
    setLocalSearchReady(posLocalDb.isReady());
    if (posLocalDb.getPaymentMethods().length) {
      setAvailablePaymentMethods(posLocalDb.getPaymentMethods());
    }
    if (posLocalDb.getTaxRates().length) {
      setTaxRates(posLocalDb.getTaxRates());
    }
  };

  const refreshPosLocalCatalog = async () => {
    const outletId = getEffectiveOutletId();
    await posLocalDb.init();
    await warmAppCache(outletId);
    syncLocalPosCatalogState();
    hydrateActivePromotionsFromLocal();
    setLocalSearchReady(posLocalDb.isReady());

    setPosCacheSyncing(true);
    try {
      await syncAppDataInBackground(outletId);
      syncLocalPosCatalogState();
      hydrateActivePromotionsFromLocal();
      setLocalSearchReady(true);
    } catch (error) {
      console.error('[POS IndexedDB] sync failed:', error);
    } finally {
      setPosCacheSyncing(false);
    }
  };

  useEffect(() => {
    if (!selectedRegister?.id) return;
    refreshPosLocalCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRegister?.id, selectedOutlet]);

  // Search functionality
  const performSearch = async (term) => {
    // Sequence guard: a newer search (or a barcode scan clearing the box)
    // invalidates any still-in-flight older lookups so their late responses
    // can't overwrite fresher results or re-open the dropdown.
    const seq = ++searchSeqRef.current;

    if (!term.trim()) {
      if (!isCustomerSearchMode) {
      setSearchResults({ products: [], customers: [] });
      setShowSearchResults(false);
      } else {
        // Customer picker with an empty box lists the full roster again.
        const customers = await posLocalDb.searchCustomersAsync('', 50, getEffectiveOutletId());
        if (seq !== searchSeqRef.current) return;
        setSearchResults({ products: [], customers });
        setShowSearchResults(true);
      }
      return;
    }

    const outletId = getEffectiveOutletId();

    // Always prefer IndexedDB / in-memory catalog — no API on keystrokes.
    if (isCustomerSearchMode) {
      let customers = await posLocalDb.searchCustomersAsync(term, 50, outletId);
      if (seq !== searchSeqRef.current) return;
      if (!customers.length) {
        // Local cache miss (just-created customer, cleared store): ask the
        // server directly, unscoped, so every customer stays findable.
        try {
          const res = await customerService.getCustomers(
            { search: term, limit: 50 },
            { skipOutletScope: true, silent: true }
          );
          customers = res.customers || [];
        } catch { customers = []; }
        if (seq !== searchSeqRef.current) return;
      }
      setSearchResults({ products: [], customers });
      setShowSearchResults(true);
      return;
    }

    // Normal search: match BOTH products and customers from the IndexedDB cache.
    const [products, customers] = await Promise.all([
      posLocalDb.searchProductsAsync(term, 10, outletId),
      posLocalDb.searchCustomersAsync(term, 10, outletId),
    ]);
    if (seq !== searchSeqRef.current) return;
    if (products.length > 0 || customers.length > 0) {
      setSearchResults({ products, customers });
      setShowSearchResults(true);
      return;
    }

    // Local cache had no match (stale/partial outlet cache, or first visit):
    // fall back to the API so products missing from the IndexedDB cache are
    // still findable by name.
    try {
      const productsResponse = await productService.getProducts({
        search: term,
        limit: 10,
      });
      if (seq !== searchSeqRef.current) return;
      setSearchResults({
        products: productsResponse.products || [],
        customers: [],
      });
      setShowSearchResults(true);
    } catch {
      if (seq === searchSeqRef.current) {
        setSearchResults({ products: [], customers: [] });
      }
    }
  };

  // Debounced search effect. Barcode-shaped input auto-adds to the sale
  // (scanners that don't send an Enter suffix) instead of opening the
  // search-results dropdown; the Enter-key path still wins the race for
  // scanners that do (queueScan dedupes the repeat).
  useEffect(() => {
    const timer = setTimeout(() => {
      const term = String(searchTerm || '').trim();
      if (term && looksLikeBarcode(term) && !isCustomerSearchMode && !isTransactionComplete) {
        queueScan(term);
        return;
      }
      performSearch(searchTerm);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // Tax rates: IndexedDB first, API only if cache empty
  useEffect(() => {
    const local = posLocalDb.getTaxRates();
    if (local.length) {
      setTaxRates(local);
      return;
    }
    (async () => {
      try {
        const resp = await taxRateService.getTaxRates();
        setTaxRates(resp?.taxRates || []);
      } catch (e) {
        setTaxRates([]);
      }
    })();
  }, [localSearchReady]);

  const getTaxRatePercent = (taxRateName) => {
    if (!taxRateName || taxRateName === 'No Tax') return 0;
    const rate = taxRates.find(r => r.name === taxRateName);
    return rate ? Number(rate.amount) || 0 : 0;
  };

  // Per-unit cost for live-profit display. Products with costPercentage=true
  // store itemCost as a percentage of the sell price, not dollars.
  const getUnitCost = (product, unitPrice = 0) => {
    // Which stored cost counts is the company's Cost Calculation Method.
    const method = settingsService.getCachedGeneralSettings().costCalculationMethod || 'Last Cost';
    const raw = product?.itemCost != null || product?.averageItemCost != null
      ? effectiveUnitCost(product, method)
      : Number(product?.unitCost ?? 0);
    if (product?.costPercentage) return ((Number(unitPrice) || 0) * raw) / 100;
    return raw;
  };

  const loadSurchargeSchedules = async () => {
    try {
      if (!selectedRegister?.id) {
        setSurchargeSchedules([]);
        return;
      }

      const response = await surchargeService.getSchedulesForRegister(selectedRegister.id);
      const apiSchedules = response?.schedules || response || [];
      setSurchargeSchedules(Array.isArray(apiSchedules) ? apiSchedules : []);
    } catch (error) {
      console.error('Error loading surcharge schedules:', error);
      setSurchargeSchedules([]);
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Barcode-SHAPED input. Only used where there is no Enter to confirm the scan
  // (the auto-scan debounce, the global keydown buffer), so it stays deliberately
  // narrow: widening it there would hijack typed product-name searches.
  const looksLikeBarcode = (term) => /^\d{4,}$/.test(term);

  const productMatchesBarcode = (product, code) => {
    const target = String(code || '').trim();
    if (!target || !product?.barcodes) return false;
    let barcodes = product.barcodes;
    if (typeof barcodes === 'string') {
      try {
        barcodes = JSON.parse(barcodes);
      } catch {
        return false;
      }
    }
    if (!Array.isArray(barcodes)) return false;
    return barcodes.some((b) => {
      const barcodeCode = typeof b === 'string' ? b : b?.code;
      return barcodeCode && String(barcodeCode).trim() === target;
    });
  };

  // A term the CATALOG says is a barcode. Barcodes are arbitrary alphanumeric
  // strings (Code 39), so shape alone can never gate a scan — an exact hit in the
  // local barcode map (or among the products currently listed, which covers codes
  // resolved from the API) is what makes Enter a scan instead of a no-op.
  const isKnownBarcode = (term) => {
    const code = String(term || '').trim();
    if (!code) return false;
    if (Object.prototype.hasOwnProperty.call(localBarcodeIndex, code)) return true;
    if (posLocalDb.getProductsByBarcode(code).length > 0) return true;
    return searchResults.products.some((p) => productMatchesBarcode(p, code));
  };

  // Returns true when a line was added/incremented, 'blocked' when register
  // control stopped the add (a dialog is shown), false for an unusable product.
  // `addQuantity` lets barcode pack sizes (e.g. a "12 x Milk" carton code) add
  // more than 1 unit; ignored for promotion items which carry their own quantity.
  const handleAddProductFromSearch = async (productOrPromotionItem, addQuantity = 1) => {
    const ok = await ensureRegisterControl();
    if (!ok) return 'blocked';

    const hasProductWrapper = productOrPromotionItem && productOrPromotionItem.product != null;
    const rawProduct = hasProductWrapper ? productOrPromotionItem.product : productOrPromotionItem;
    const product =
      resolveProductLocal(rawProduct, rawProduct?.name) || rawProduct;
    // Never commit an unresolved/partial object to the cart (prevents ghost
    // lines with no name and $0 price when a lookup returns a bare mapping).
    if (!product || product.id == null || !product.name) {
      console.warn('Skipped adding unresolved product to sale:', productOrPromotionItem);
      return false;
    }
    const isPromotionItem = hasProductWrapper && productOrPromotionItem.price !== undefined;
    const promotionPrice = isPromotionItem ? productOrPromotionItem.price : null;
    // ponytail: enforces effective disablePromotions for explicit promo-view adds —
    // when off for this member, we ignore the promo price and use base pricing.
    const promoActive = isPromotionItem && !getEffectiveCustomerSettings(selectedCustomer).disablePromotions;
    let promotionQuantity = isPromotionItem
      ? (productOrPromotionItem.quantity ?? 1)
      : Math.max(1, parseInt(addQuantity, 10) || 1);

    // "Use Case Quantity" modifier (one-shot): a plain single-unit add (search
    // click / add-to-sale) becomes a case. Callers that pass an explicit quantity
    // (barcode packs, the classification view's Add Case) are left alone.
    if (useCaseQuantity && !isPromotionItem && promotionQuantity === 1 && getItemsPerCase(product) > 1) {
      promotionQuantity = getItemsPerCase(product);
      setUseCaseQuantity(false);
    }

    // Product-level Request Quantity / Request Price (Stock > product > Sell &
    // Cost). Every add path funnels through here, so the ask lives here once.
    // Cancelling the dialog cancels the add.
    if (product.requestQuantity && !isPromotionItem) {
      const asked = await askValue({
        title: `Quantity — ${product.name}`,
        mode: 'qty',
        initial: String(promotionQuantity),
      });
      if (asked == null || asked <= 0) return false;
      promotionQuantity = asked;
    }
    let priceOverride = null;
    if (product.requestPrice) {
      const asked = await askValue({ title: `Price — ${product.name}`, mode: 'price', initial: '' });
      if (asked == null || asked < 0) return false;
      priceOverride = asked;
    }

    if (activePromotions.length === 0) {
      hydrateActivePromotionsFromLocal();
    }

    setCart(prev => {
      // A requested price is per ADD, so it never merges into an existing line.
      const existingItemIndex = priceOverride != null ? -1 : prev.findIndex(item =>
        item.id === product.id || item.productId === product.id
      );
      
      if (existingItemIndex !== -1) {
        const updatedCart = [...prev];
        const existingItem = updatedCart[existingItemIndex];
        const newQuantity = (existingItem.quantity || 1) + promotionQuantity;
        
        // If this is from a promotion, use the promotion price calculation
        // Otherwise, calculate normally
        let newPrice;
        if (promoActive && promotionPrice) {
          // For promotion items, calculate price based on total quantity
          // The promotion price is per unit for the promotion quantity
          const unitPrice = promotionPrice / promotionQuantity;
          newPrice = calculatePriceForQuantity(product, newQuantity);
          // If promotion price is better, use it
          const promoTotalPrice = unitPrice * newQuantity;
          if (promoTotalPrice > 0 && (newPrice === 0 || promoTotalPrice < newPrice)) {
            newPrice = promoTotalPrice;
          }
        } else {
          newPrice = calculatePriceForQuantity(product, newQuantity);
        }
        
        const unitCost = getUnitCost(product, newQuantity > 0 ? newPrice / newQuantity : 0);
        updatedCart[existingItemIndex] = {
          ...existingItem,
          productId: existingItem.productId || product.id,
          quantity: newQuantity,
          price: newPrice,
          normalPrice: calculateNormalPriceForQuantity(product, newQuantity),
          unitCost: existingItem.unitCost != null && existingItem.unitCost > 0 ? existingItem.unitCost : unitCost,
          retailTaxRate: existingItem.retailTaxRate || product.retailTaxRate
        };
        return updatedCart;
      } else {
        // Product doesn't exist, add new item
        let newPrice;
        if (priceOverride != null) {
          // Requested price is per unit; the cart line holds the LINE TOTAL.
          newPrice = priceOverride * promotionQuantity;
        } else if (promoActive && promotionPrice && promotionPrice > 0) {
          // The promotion price is the total price for the promotion quantity
          // Use it directly
          newPrice = promotionPrice;
          console.log(`Using promotion price: ${newPrice} for product ${product.name} (quantity: ${promotionQuantity})`);
        } else {
          // Calculate price normally using promotion calculation
          newPrice = calculatePriceForQuantity(product, promotionQuantity);
          console.log(`Calculated price: ${newPrice} for product ${product.name} (quantity: ${promotionQuantity})`);
        }
        
        // If price is still 0 or invalid, try to get from product directly
        // (a requested price of $0.00 is a real answer — never replace it).
        if (priceOverride == null && (newPrice === 0 || isNaN(newPrice) || newPrice < 0)) {
          const basePrice = product.retailPrice || product.prices?.[0]?.price || 0;
          newPrice = basePrice * promotionQuantity;
          console.log(`Using product retail price: ${basePrice} x ${promotionQuantity} = ${newPrice} for product ${product.name}`);
        }
        
        // Final fallback - ensure we have a valid price
        if (priceOverride == null && (newPrice === 0 || isNaN(newPrice) || newPrice < 0)) {
          console.error(`Could not determine price for product ${product.name}, using 0`);
          newPrice = 0;
        }
        
        const unitCost = getUnitCost(product, promotionQuantity > 0 ? newPrice / promotionQuantity : 0);
        return [...prev, {
          id: product.id,
          productId: product.id,
          name: product.name,
          price: newPrice,
          // Pre-promotion total: what the footer Savings line and the receipt
          // subtract the charged price from.
          normalPrice: calculateNormalPriceForQuantity(product, promotionQuantity),
          unitCost: unitCost,
          retailTaxRate: product.retailTaxRate,
          taxPercent: getTaxRatePercent(product.retailTaxRate),
          // Case Price Override divides the entered case price by this.
          caseQuantity: getItemsPerCase(product),
          // Reference .product-family-colour: 10px strip on the cart line in
          // the product's family colour (only when the family has one).
          familyColor: product.family?.color || null,
          quantity: promotionQuantity,
          timestamp: Date.now(),
          action: 'add-product'
        }];
      }
    });

    // Clear search after adding
    setSearchTerm('');
    setShowSearchResults(false);
    setIsCustomerSearchMode(false);
    return true;
  };

  const focusSearchInput = () => {
    if (searchRef.current) {
      const inputElement = searchRef.current.querySelector('input');
      if (inputElement) inputElement.focus();
    }
  };

  // Recall a completed sale into the cart as a RETURN (negative lines).
  // Shared by the sale-search key (typed invoice) and receipt-barcode scans.
  const recallSaleAsReturn = async (term) => {
    try {
      const resp = await salesService.getSales({ invoiceNumber: term.replace(/^#/, ''), limit: 5 });
      let sale = (resp.sales || []).find(s => s.status !== 'PARKED');
      if (!sale) { alert(`No sale found matching "${term}".`); return false; }
      // The list response's items omit productId — fetch the full sale when possible.
      try {
        const detail = await salesService.getSaleById(sale.id);
        if (detail?.sale) sale = detail.sale;
      } catch {
        // detail fetch blocked (permissions) — the summary still recalls by name/price
      }
      const items = sale.items || [];
      if (items.length === 0) { alert(`Sale ${sale.saleNumber} has no items to recall.`); return false; }
      const lines = items
        .map(it => `• ${it.productName} x${it.quantity} $${(parseFloat(it.totalPrice) || 0).toFixed(2)}`)
        .join('\n');
      const load = await confirm(
        `Sale ${sale.saleNumber} — total $${(parseFloat(sale.totalAmount) || 0).toFixed(2)}\n${lines}\n\n` +
        'Load these items into the register as a return (negative quantities)?',
        { title: `Recall sale ${sale.saleNumber}`, confirmText: 'Load as return' }
      );
      if (!load) return false; // view-only
      const refundReason = await askRefundReason();
      if (refundReason === null) return false; // reason required, none given
      const ts = Date.now();
      setCart(prev => [...prev, ...items.map((it, i) => {
        const qty = Math.abs(parseFloat(it.quantity) || 1);
        const lineTotal = Math.abs(parseFloat(it.totalPrice) || 0);
        const product = it.productId ? resolveProductLocal(it.productId, it.productName) : null;
        return {
          id: `recall-${sale.id}-${it.id ?? i}-${ts}`,
          productId: it.productId || null,
          name: it.productName,
          price: -lineTotal,
          quantity: -qty,
          retailTaxRate: product?.retailTaxRate || null,
          taxPercent: getTaxRatePercent(product?.retailTaxRate),
          unitCost: getUnitCost(product, qty > 0 ? lineTotal / qty : 0),
          timestamp: ts + i,
          action: 'return-item',
          _recalledFrom: sale.saleNumber,
          ...(refundReason ? { refundReason } : {}),
        };
      })]);
      setSelectedCartItem(null);
      return true;
    } catch (error) {
      console.error('Error recalling sale:', error);
      alert('Failed to look up that sale. Please try again.');
      return false;
    }
  };

  const handleBarcodeScan = async (rawCode) => {
    const code = String(rawCode || '').trim();
    if (!code || isCustomerSearchMode || isTransactionComplete) {
      return false;
    }

    // Receipt barcode (sale number): 14+ digits, far longer than EAN-13 product
    // barcodes — reload that sale as a RETURN instead of a product lookup.
    if (/^#?\d{14,}$/.test(code)) {
      return recallSaleAsReturn(code);
    }

    // Duplicate barcodes are allowed across products: collect EVERY matching
    // product (deduped by id) so a multi-match scan opens a selection dialog
    // instead of silently adding whichever product happened to win the lookup.
    const seen = new Map();
    const collect = (arr) => {
      (arr || []).forEach((p) => {
        if (p && p.id != null && !seen.has(p.id)) seen.set(p.id, p);
      });
    };

    collect(posLocalDb.getProductsByBarcode(code));
    if (Object.prototype.hasOwnProperty.call(localBarcodeIndex, code)) {
      const indexed = localBarcodeIndex[code];
      collect(Array.isArray(indexed) ? indexed : [indexed]);
    }
    collect(searchResults.products.filter((p) => productMatchesBarcode(p, code)));

    // >=2 matches → cashier picks from the dialog (handled: no "not found"
    // snackbar). Exactly 1 → add directly; 'blocked' means a register-control
    // dialog is up: treat as handled so the caller doesn't also show a
    // misleading "not found" message.
    const resolveMatches = async (matches) => {
      if (matches.length >= 2) {
        setBarcodeChoices({ code, products: matches });
        return true;
      }
      if (matches.length === 1) {
        // Apply the barcode's pack quantity (e.g. a carton code adds 12 units).
        const result = await handleAddProductFromSearch(
          matches[0],
          getBarcodeQuantity(matches[0], code)
        );
        if (result) return true;
      }
      return false;
    };

    if (seen.size) {
      const handled = await resolveMatches(Array.from(seen.values()));
      if (handled) return true;
    }

    const outletId = getEffectiveOutletId();
    const fromCache = await posLocalDb.getProductsByBarcodeAsync(code, outletId);
    collect(fromCache);
    if (seen.size) {
      const handled = await resolveMatches(Array.from(seen.values()));
      if (handled) return true;
    }

    // Always fall back to the API so a barcode missing from a stale local
    // cache still resolves against the backend.
    try {
      const resp = await productService.getProductByBarcode(code, outletId);
      // Newer backends return every match in `products`; the currently
      // deployed one only returns the first match in `product` — support
      // both, never depending on `products` being present.
      const apiMatches = Array.isArray(resp?.products) && resp.products.length
        ? resp.products
        : resp?.product
          ? [resp.product]
          : [];
      collect(apiMatches);
      if (seen.size) {
        const handled = await resolveMatches(Array.from(seen.values()));
        if (handled) return true;
      }
    } catch (err) {
      if (err?.response?.status !== 404) {
        console.error('Barcode lookup failed:', err);
      }
    }

    return false;
  };

  // Shared by the Enter-key scan path and the auto-scan debounce: dedupes
  // repeated codes, clears the box and queues the scan for serialized adds.
  const queueScan = (code) => {
    if (isCustomerSearchMode || isTransactionComplete) return;
    // Some scanners send CR+LF, i.e. two Enter keydowns for one scan — and
    // the auto-scan debounce can race the Enter path. Ignore an identical
    // code repeated within the same instant.
    const now = Date.now();
    if (lastScanRef.current.code === code && now - lastScanRef.current.at < 250) {
      return;
    }
    lastScanRef.current = { code, at: now };

    // Clear the box synchronously so the next rapid scan types into an empty
    // field (never concatenates onto leftover digits), and invalidate any
    // in-flight debounced search so it can't re-open the dropdown.
    searchSeqRef.current++;
    setSearchTerm('');
    setSearchResults({ products: [], customers: [] });
    setShowSearchResults(false);

    // Serialize scan processing so rapid consecutive scans resolve and add
    // to the cart strictly in order, one at a time.
    const scanEpoch = saleEpochRef.current;
    scanQueueRef.current = scanQueueRef.current
      .then(async () => {
        // Sale was cleared/parked/reset after this scan was queued — drop it.
        if (scanEpoch !== saleEpochRef.current) return;
        const added = await handleBarcodeScan(code);
        if (!added) {
          setScanNotFound(code);
        }
      })
      .catch((err) => {
        console.error('Barcode scan processing failed:', err);
      })
      .finally(() => {
        // Keep focus in the search box so the register is ready for the
        // next scan without re-clicking.
        focusSearchInput();
      });
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape' && isCustomerSearchMode) {
      exitCustomerSearchMode();
      return;
    }
    if (e.key !== 'Enter') return;
    if (isCustomerSearchMode || isTransactionComplete) return;
    // Read the live DOM value, not searchTerm state: barcode scanners type
    // faster than React re-renders, so the state closure can lag a scan
    // behind (which caused duplicate adds and dropped scans).
    const code = String(e.target.value || '').trim();
    // Scanners emit the code then Enter. Treat Enter as a scan for barcode-shaped
    // input AND for anything the catalog knows as a barcode (alphanumeric codes
    // included); typed product names keep the normal dropdown behavior.
    if (!code || !(looksLikeBarcode(code) || isKnownBarcode(code))) return;
    e.preventDefault();
    queueScan(code);
  };

  // Global scan capture: a scanner "types" its digits as keydowns wherever
  // focus happens to be. When focus is NOT in an editable field (cashier
  // clicked elsewhere, results dropdown open, etc.) buffer rapid digit keys
  // and queue barcode-shaped codes so scans still add to the sale.
  // Ref keeps the listener mounted once while always calling the fresh
  // queueScan closure (avoids stale state in handleBarcodeScan).
  const queueScanRef = useRef(null);
  queueScanRef.current = queueScan;
  useEffect(() => {
    let buf = '';
    let timer = null;
    const reset = () => {
      buf = '';
      if (timer) clearTimeout(timer);
      timer = null;
    };
    const flush = () => {
      if (looksLikeBarcode(buf)) queueScanRef.current(buf);
      reset();
    };
    const onKeyDown = (e) => {
      const el = document.activeElement;
      const editable =
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.isContentEditable);
      // Editable fields keep their own behavior (search box has its path).
      if (editable) {
        reset();
        return;
      }
      if (e.key === 'Enter') {
        if (looksLikeBarcode(buf)) e.preventDefault();
        flush();
        return;
      }
      if (/^\d$/.test(e.key)) {
        buf += e.key;
        if (timer) clearTimeout(timer);
        // Scanners fire keys within milliseconds; a settle timeout catches
        // scanners with no Enter suffix.
        timer = setTimeout(flush, 300);
      } else if (e.key.length === 1) {
        // Any other printable key means human typing, not a scan.
        reset();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      reset();
    };
  }, []);

  const handleSelectCustomer = async (customer) => {
    const ok = await ensureRegisterControl();
    if (!ok) return;

    const cached = posLocalDb.getCustomerById(customer.id);
    if (cached) {
      setSelectedCustomer(cached);
    } else {
      try {
        const fullCustomerData = await customerService.getCustomer(customer.id);
        setSelectedCustomer(fullCustomerData.customer || fullCustomerData);
      } catch (error) {
        console.error('Error fetching full customer data:', error);
        setSelectedCustomer(customer);
      }
    }
    
    setSearchTerm('');
    setSearchResults({ products: [], customers: [] });
    setShowSearchResults(false);
    setIsCustomerSearchMode(false);
  };

  // Refresh customer data to get updated balance
  const refreshCustomerData = async (customerId) => {
    if (!customerId) return;
    
    try {
      console.log('[Customer] Refreshing customer data for ID:', customerId);
      const response = await customerService.getCustomer(customerId);
      const updatedCustomer = response.customer || response;
      console.log('[Customer] Updated customer data:', updatedCustomer);
      console.log('[Customer] Updated currentOwing:', updatedCustomer.currentOwing);
      
      // Update selectedCustomer with fresh data
      setSelectedCustomer(prev => {
        if (prev?.id === customerId) {
          return {
            ...prev,
            ...updatedCustomer,
            // Preserve customerGroup if it exists in the updated customer
            customerGroup: updatedCustomer.customerGroup || prev.customerGroup
          };
        }
        return prev;
      });
      
      // Also reload loyalty info if customer has loyalty enabled.
      // ponytail: enforces effective loyaltyEnabled (customer OR group) — group-loyalty
      // members reload their points too, not just customers with the flag set directly.
      if (getEffectiveCustomerSettings({ ...updatedCustomer, customerGroup: updatedCustomer.customerGroup || selectedCustomer?.customerGroup }).loyaltyEnabled) {
        await loadCustomerLoyaltyInfo();
      }
    } catch (error) {
      console.error('[Customer] Error refreshing customer data:', error);
    }
  };

  // Reference: Add Customer switches the LEFT panel to the customer picker
  // (search box placeholder flips to "Search for Customers...", Back / Create
  // New toolbar, full zebra customer list).
  const handleAddCustomerClick = async () => {
    setIsCustomerSearchMode(true);
    setSearchTerm('');
    focusSearchInput();

    let customers = await posLocalDb.searchCustomersAsync('', 50, getEffectiveOutletId());
    if (!customers.length) {
      try {
        // Unscoped on purpose: every customer must be findable from the sell
        // screen regardless of the register's outlet (reference parity).
        const customersResponse = await customerService.getCustomers(
          { limit: 50 },
          { skipOutletScope: true }
        );
        customers = customersResponse.customers || [];
      } catch (error) {
        console.error('Error loading customers:', error);
        customers = [];
      }
    }
    setSearchResults({ products: [], customers });
    setShowSearchResults(true);
  };

  const exitCustomerSearchMode = () => {
    setIsCustomerSearchMode(false);
    setSearchTerm('');
    setSearchResults({ products: [], customers: [] });
    setShowSearchResults(false);
  };

  const openProductDetails = async (item) => {
    setShowProductSidebar(true);
    setProductDetailsLoading(false);
    const productData = resolveProductLocal(
      item.productId || item.selectedProduct || item,
      item.name
    );
    if (productData) {
      setProductDetails(productData);
      return;
    }
    setProductDetails({
      name: item.name,
      prices: item.price ? [{ quantity: 1, price: item.price }] : [],
      barcodes: [],
      caseQuantity: item.caseQuantity || undefined,
    });
  };

  const closeProductDetails = () => {
    setShowProductSidebar(false);
    setProductDetails(null);
  };

  const handleClickAway = () => {
    setShowSearchResults(false);
    // Customer picker mode is a left-panel view (reference): it stays open
    // until Back is pressed or a customer is selected, not on click-away.
  };

  // Compute a discounted cart line from a predefined discount config, matching
  // the DiscountDialog output shape so it flows through save unchanged.
  const computeConfiguredDiscount = (item, type, value) => {
    const quantity = parseFloat(item.quantity) || 1;
    const currentTotal = parseFloat(item.price) || 0;
    const currentUnit = currentTotal / quantity;
    const amount = parseFloat(value) || 0;
    let finalPrice = currentTotal;
    let discountInfo = null;
    switch (type) {
      case 'total_price_override':
        finalPrice = amount;
        discountInfo = { type, originalPrice: currentTotal, newPrice: amount, discountAmount: currentTotal - amount };
        break;
      case 'item_price_override':
        finalPrice = amount * quantity;
        discountInfo = { type, originalPrice: currentUnit, newPrice: amount, discountAmount: (currentUnit - amount) * quantity };
        break;
      case 'discount_percentage': {
        const d = Math.min(Math.max(amount, 0), 100) / 100;
        finalPrice = currentTotal * (1 - d);
        discountInfo = { type, originalPrice: currentTotal, discountPercentage: amount, discountAmount: currentTotal * d };
        break;
      }
      case 'discount_total_amount':
        finalPrice = Math.max(0, currentTotal - amount);
        discountInfo = { type, originalPrice: currentTotal, discountAmount: amount };
        break;
      case 'discount_item_amount':
        finalPrice = Math.max(0, currentTotal - amount * quantity);
        discountInfo = { type, originalPrice: currentUnit, discountPerItem: amount, discountAmount: amount * quantity };
        break;
      default:
        alert('This discount key is not configured. Edit it and choose a discount type.');
        return null;
    }
    if (finalPrice < 0) finalPrice = 0;
    return { ...item, price: Number(finalPrice).toFixed(2), discountInfo };
  };

  // Add (+1) or remove (-1) a component product on the sale. When the selected cart
  // line is a combo/package the component is nested into its comboItems (line price,
  // normal total and cost stay consistent with expandCartForSale's allocation);
  // otherwise it falls back to Shopfront's documented behavior: add as a separate
  // product line (negative quantity for a removal).
  const applyComponentToSale = (componentProduct, sign) => {
    const unitPrice = calculatePriceForQuantity(componentProduct, 1);
    const selIdx = selectedCartItem
      ? cart.findIndex(i => i.id === selectedCartItem.id && i.timestamp === selectedCartItem.timestamp)
      : -1;
    const pkg = selIdx !== -1 ? cart[selIdx] : null;

    if (pkg?.isCombo && Array.isArray(pkg.comboItems)) {
      const sets = parseFloat(pkg.quantity) || 1;
      const items = pkg.comboItems.map(ci => ({ ...ci }));
      const idx = items.findIndex(ci => ci.productId === componentProduct.id);

      let delta; // per-set price change on the combo line
      if (sign < 0) {
        if (idx === -1) {
          alert(`${componentProduct.name} is not a component of ${pkg.name}.`);
          return;
        }
        const perUnit = (parseFloat(items[idx].normalPrice) || 0) / (items[idx].quantity || 1);
        if ((items[idx].quantity || 1) > 1) {
          items[idx] = {
            ...items[idx],
            quantity: (items[idx].quantity || 1) - 1,
            normalPrice: (parseFloat(items[idx].normalPrice) || 0) - perUnit,
          };
        } else {
          items.splice(idx, 1);
        }
        delta = -perUnit;
      } else {
        if (idx !== -1) {
          items[idx] = {
            ...items[idx],
            quantity: (items[idx].quantity || 1) + 1,
            normalPrice: (parseFloat(items[idx].normalPrice) || 0) + unitPrice,
          };
        } else {
          items.push({
            productId: componentProduct.id,
            name: componentProduct.name,
            quantity: 1,
            normalPrice: unitPrice,
            retailTaxRate: componentProduct.retailTaxRate,
            taxPercent: getTaxRatePercent(componentProduct.retailTaxRate),
            unitCost: getUnitCost(componentProduct, unitPrice),
          });
        }
        delta = unitPrice;
      }

      const updated = {
        ...pkg,
        comboItems: items,
        price: Math.max(0, (parseFloat(pkg.price) || 0) + delta * sets),
        comboNormalTotal: Math.max(0, (parseFloat(pkg.comboNormalTotal) || 0) + delta),
      };
      setCart(prev => prev.map((it, i) => (i === selIdx ? updated : it)));
      setSelectedCartItem(updated);
      return;
    }

    // No package/combo line selected — separate line, per Shopfront's fallback.
    setCart(prev => [...prev, {
      id: `component-${componentProduct.id}-${Date.now()}`,
      productId: componentProduct.id,
      name: componentProduct.name,
      price: unitPrice * sign,
      retailTaxRate: componentProduct.retailTaxRate || null,
      taxPercent: getTaxRatePercent(componentProduct.retailTaxRate),
      unitCost: getUnitCost(componentProduct, unitPrice),
      quantity: sign,
      timestamp: Date.now(),
      action: sign > 0 ? 'add-component-to-current' : 'remove-component-from-current',
    }]);
  };

  // Apply Shopfront keyboard tokens ([Backspace], [Delete], [Clear]) plus literal
  // text to the current product-search value.
  const applySearchTokens = (current, raw) => {
    let result = current || '';
    const tokenRe = /\[(Backspace|Delete|Clear)\]/gi;
    let lastIndex = 0;
    let m;
    while ((m = tokenRe.exec(raw)) !== null) {
      result += raw.slice(lastIndex, m.index);
      const tok = m[1].toLowerCase();
      // ponytail: no cursor concept on the search box — [Delete] behaves like [Backspace].
      result = tok === 'clear' ? '' : result.slice(0, -1);
      lastIndex = tokenRe.lastIndex;
    }
    return result + raw.slice(lastIndex);
  };

  // Subtract an ISO 8601 period (e.g. P18Y, P21Y, P1Y6M) from a date.
  const subtractIsoPeriod = (date, iso) => {
    const d = new Date(date.getTime());
    const m = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(iso || '').trim());
    if (!m) return d;
    const n = (i) => (m[i] ? parseInt(m[i], 10) : 0);
    if (n(1)) d.setFullYear(d.getFullYear() - n(1));
    if (n(2)) d.setMonth(d.getMonth() - n(2));
    if (n(3) || n(4)) d.setDate(d.getDate() - (n(3) * 7 + n(4)));
    if (n(5)) d.setHours(d.getHours() - n(5));
    if (n(6)) d.setMinutes(d.getMinutes() - n(6));
    if (n(7)) d.setSeconds(d.getSeconds() - n(7));
    return d;
  };

  // Format a date with common tokens (YYYY MM DD HH mm ss).
  const formatDynamicDate = (date, fmt) => {
    const pad = (x) => String(x).padStart(2, '0');
    const map = {
      YYYY: date.getFullYear(),
      MM: pad(date.getMonth() + 1),
      DD: pad(date.getDate()),
      HH: pad(date.getHours()),
      mm: pad(date.getMinutes()),
      ss: pad(date.getSeconds()),
    };
    return String(fmt || 'YYYY-MM-DD').replace(/YYYY|MM|DD|HH|mm|ss/g, (t) => map[t]);
  };

  const handleSaleKeyClick = async (saleKey) => {
    const ok = await ensureRegisterControl();
    if (!ok) return;

    if (activePromotions.length === 0) {
      hydrateActivePromotionsFromLocal();
    }
    if (saleKey.behavior?.disableKey) {
      return; // Key is disabled
    }

    // Prevent any actions if transaction is complete
    if (isTransactionComplete && saleKey.action !== 'clear-sale') {
      return;
    }

    // Disable payment actions if no products in cart
    if ((saleKey.action === 'payment' || saleKey.action === 'pay-amount' || 
         (saleKey.name.toLowerCase().includes('cash') && saleKey.amount)) && 
        cart.length === 0) {
      return; // Disable payment keys when cart is empty
    }
    
    switch (saleKey.action) {
      case 'no-action':
        // Explicitly do nothing
        return;
      case 'open-sale-key-folder':
        // Handle folder navigation within the same page
        // Accept if we have folderName (folderId can be empty string)
        if (saleKey.folderName) {
          // Use folderId if available, otherwise use folderName for lookup
          loadFolder(saleKey.folderId || saleKey.folderName, saleKey.folderName);
        } else {
          alert('This folder key is not properly configured. Please edit it and select a folder.');
        }
        return;
      case 'add-product':
        // Prevent adding products if payment is complete
        if (isTransactionComplete) return;
        (async () => {
          const resolvedProductId = saleKey.productId || saleKey.selectedProduct?.id || null;
          const latestProduct =
            resolveProductLocal(
              resolvedProductId || saleKey.selectedProduct,
              saleKey.name
            ) || null;

          // Orphan guard: a key whose product was deleted must not add a $0.00 line.
          if (!latestProduct) {
            setSaleWarning(`"${saleKey.name}" is linked to a product that no longer exists`);
            return;
          }

          const resolvedName = latestProduct?.name || saleKey.selectedProduct?.name || saleKey.name;
          // Determine quantity to add: use configured quantity unless requestQuantity is true (prompt user)
          let resolvedQuantity = 1;
          if (saleKey && saleKey.requestQuantity) {
            const asked = await askValue({
              title: `Quantity — ${resolvedName}`,
              mode: 'qty',
              initial: String(saleKey.quantity || 1),
            });
            if (asked == null || asked <= 0) return;
            resolvedQuantity = asked;
          } else if (saleKey && saleKey.quantity) {
            const parsed = parseFloat(saleKey.quantity);
            resolvedQuantity = isNaN(parsed) || parsed <= 0 ? 1 : parsed;
          }

          // "Use Case Quantity" modifier (one-shot): the next product added uses
          // its case quantity instead.
          if (useCaseQuantity) {
            resolvedQuantity *= getItemsPerCase(latestProduct);
            setUseCaseQuantity(false);
          }

          // Product-level Request Quantity / Request Price also apply when the
          // product is reached through a sale key (the key's own requestQuantity
          // already asked, so don't ask twice).
          if (latestProduct?.requestQuantity && !saleKey?.requestQuantity) {
            const asked = await askValue({
              title: `Quantity — ${resolvedName}`,
              mode: 'qty',
              initial: String(resolvedQuantity),
            });
            if (asked == null || asked <= 0) return;
            resolvedQuantity = asked;
          }
          let requestedPrice = null;
          if (latestProduct?.requestPrice) {
            const asked = await askValue({ title: `Price — ${resolvedName}`, mode: 'price', initial: '' });
            if (asked == null || asked < 0) return;
            requestedPrice = asked;
          }

          const resolvedPrice = requestedPrice != null
            ? requestedPrice * resolvedQuantity
            : calculatePriceForQuantity(latestProduct, resolvedQuantity);

          setCart(prev => {
            // A requested price is per ADD, so it never merges into an existing line.
            const existingItemIndex = requestedPrice != null ? -1 : prev.findIndex(item =>
              item.productId === (latestProduct?.id || resolvedProductId) ||
              (item.name === resolvedName && item.price === resolvedPrice)
            );
            if (existingItemIndex !== -1) {
              const updatedCart = [...prev];
              const existingItem = updatedCart[existingItemIndex];
              const newQuantity = (existingItem.quantity || 1) + resolvedQuantity;
              
              // Recalculate price based on new total quantity
              const newPrice = calculatePriceForQuantity(latestProduct, newQuantity);

              updatedCart[existingItemIndex] = {
                ...existingItem,
                productId: existingItem.productId || latestProduct?.id || resolvedProductId, // Preserve productId
                quantity: newQuantity,
                price: newPrice,
                normalPrice: calculateNormalPriceForQuantity(latestProduct, newQuantity)
              };
              setSelectedCartItem(updatedCart[existingItemIndex]);
              return updatedCart;
            }
            const newItem = {
              id: saleKey.id,
              productId: latestProduct?.id || resolvedProductId || null,
              name: resolvedName,
              price: resolvedPrice,
              normalPrice: calculateNormalPriceForQuantity(latestProduct, resolvedQuantity),
              retailTaxRate: latestProduct?.retailTaxRate || null,
              taxPercent: getTaxRatePercent(latestProduct?.retailTaxRate),
              unitCost: getUnitCost(latestProduct, resolvedQuantity > 0 ? resolvedPrice / resolvedQuantity : 0),
              caseQuantity: getItemsPerCase(latestProduct),
              familyColor: latestProduct?.family?.color || null,
              quantity: resolvedQuantity,
              timestamp: Date.now(),
              action: 'add-product'
            };
            setSelectedCartItem(newItem);
            return [...prev, newItem];
          });
        })();
        break;
      case 'add-product-case':
        // Prevent adding products if payment is complete
        if (isTransactionComplete) return;
        (async () => {
          const resolvedProductId = saleKey.productId || saleKey.selectedProduct?.id || null;
          const latestProduct =
            resolveProductLocal(
              resolvedProductId || saleKey.selectedProduct,
              saleKey.name
            ) || null;

          const resolvedName = latestProduct?.name || saleKey.selectedProduct?.name || saleKey.name;
          
          // For case quantity, always prompt user for number of cases
          let resolvedCaseQuantity = 1;
          if (saleKey && saleKey.requestCaseQuantity) {
            const asked = await askValue({
              title: `Cases — ${resolvedName}`,
              mode: 'qty',
              initial: String(saleKey.caseQuantity || 1),
            });
            if (asked == null || asked <= 0) return;
            resolvedCaseQuantity = asked;
          } else if (saleKey && saleKey.caseQuantity) {
            const parsed = parseFloat(saleKey.caseQuantity);
            resolvedCaseQuantity = isNaN(parsed) || parsed <= 0 ? 1 : parsed;
          }

          // Calculate total quantity (cases * items per case)
          const itemsPerCase = getItemsPerCase(latestProduct);
          const resolvedQuantity = resolvedCaseQuantity * itemsPerCase;

          // Calculate case price using case pricing logic
          const resolvedPrice = calculateCasePriceForQuantity(latestProduct, resolvedCaseQuantity);

          setCart(prev => {
            const existingItemIndex = prev.findIndex(item => 
              item.productId === (latestProduct?.id || resolvedProductId) ||
              (item.name === resolvedName && item.price === resolvedPrice)
            );
            if (existingItemIndex !== -1) {
              const updatedCart = [...prev];
              const existingItem = updatedCart[existingItemIndex];
              const newQuantity = (existingItem.quantity || 1) + resolvedQuantity;
              
              // Price the merged line from the SAME unit count as its quantity —
              // rounding up to whole cases here billed 7 units as 12. Still case
              // priced when the total lands on a case boundary (the case helper is
              // only a cases->units wrapper over this one).
              const newPrice = calculatePriceForQuantity(latestProduct, newQuantity);

              updatedCart[existingItemIndex] = {
                ...existingItem,
                productId: existingItem.productId || latestProduct?.id || resolvedProductId, // Preserve productId
                quantity: newQuantity,
                price: newPrice,
                normalPrice: calculateNormalPriceForQuantity(latestProduct, newQuantity)
              };
              setSelectedCartItem(updatedCart[existingItemIndex]);
              return updatedCart;
            }
            const newItem = {
              id: saleKey.id,
              productId: latestProduct?.id || resolvedProductId || null,
              name: resolvedName,
              price: resolvedPrice,
              normalPrice: calculateNormalPriceForQuantity(latestProduct, resolvedQuantity),
              retailTaxRate: latestProduct?.retailTaxRate || null,
              taxPercent: getTaxRatePercent(latestProduct?.retailTaxRate),
              unitCost: getUnitCost(latestProduct, resolvedQuantity > 0 ? resolvedPrice / resolvedQuantity : 0),
              caseQuantity: getItemsPerCase(latestProduct),
              familyColor: latestProduct?.family?.color || null,
              quantity: resolvedQuantity,
              timestamp: Date.now(),
              action: 'add-product-case'
            };
            setSelectedCartItem(newItem);
            return [...prev, newItem];
          });
        })();
        break;
      case 'add-product-combo':
        // Add the combo as ONE cart line (combo name @ combo price). Its member
        // products live on the line as comboItems and are only split back out at
        // save time (expandCartForSale). Keeping them off the cart as loose lines
        // is what lets a product bought on top of a combo stay a separate,
        // normally-priced line instead of being swallowed by the combo.
        if (isTransactionComplete) return;
        (async () => {
          const resolvedComboId = saleKey.comboId || saleKey.selectedCombo?.id || null;
          if (!resolvedComboId) {
            alert('This combo key is not properly configured. Please edit it and select a combo.');
            return;
          }
          try {
            let combo = posLocalDb.getComboById(resolvedComboId);
            if (!combo) {
              const { combo: apiCombo } = await productComboService.getProductCombo(resolvedComboId);
              combo = apiCombo;
            }
            if (!combo || !Array.isArray(combo.items) || combo.items.length === 0) {
              alert('The selected combo has no items configured.');
              return;
            }
            // Member products at their normal prices — used to allocate the combo
            // price back across them at save time and to blend cost/tax for the line.
            const comboItems = [];
            combo.items.forEach(comboItem => {
              const product = resolveProductLocal(comboItem.product || comboItem.productId);
              if (!product) return;
              const qty = comboItem.quantity || 1;
              const normalPrice = calculatePriceForQuantity(product, qty);
              comboItems.push({
                productId: product.id,
                name: product.name,
                quantity: qty,
                normalPrice,
                retailTaxRate: product.retailTaxRate,
                taxPercent: getTaxRatePercent(product.retailTaxRate),
                unitCost: getUnitCost(product, qty > 0 ? normalPrice / qty : 0)
              });
            });
            if (comboItems.length === 0) {
              alert('The products in this combo could not be found.');
              return;
            }

            const normalTotal = comboItems.reduce((sum, ci) => sum + (parseFloat(ci.normalPrice) || 0), 0);
            const comboPrice = parseFloat(combo.comboPrice ?? combo.totalPrice) || 0;
            const setPrice = comboPrice > 0 ? comboPrice : normalTotal;
            // Line-level tax/cost are the blend of the members, so live profit and
            // the tax-exclusive subtotal stay correct for a mixed-tax combo.
            const setTaxPercent = normalTotal > 0
              ? comboItems.reduce((sum, ci) => sum + (ci.taxPercent || 0) * ((parseFloat(ci.normalPrice) || 0) / normalTotal), 0)
              : 0;
            const setCost = comboItems.reduce((sum, ci) => sum + (parseFloat(ci.unitCost) || 0) * (ci.quantity || 1), 0);
            // All members on ONE rate -> the line carries that rate NAME, so the tax
            // summary labels the combo the same live as on a reprint (which reads the
            // name banked on the members). Mixed rates stay unnamed on both paths.
            const setTaxRate = comboItems.every(ci => ci.retailTaxRate === comboItems[0].retailTaxRate)
              ? comboItems[0].retailTaxRate || null
              : null;

            setCart(prevCart => {
              const existingIndex = prevCart.findIndex(item => item.isCombo && item.comboId === combo.id);
              if (existingIndex !== -1) {
                const updatedCart = [...prevCart];
                const existing = updatedCart[existingIndex];
                const newQuantity = (existing.quantity || 1) + 1;
                const updated = { ...existing, quantity: newQuantity, price: setPrice * newQuantity };
                updatedCart[existingIndex] = updated;
                setSelectedCartItem(updated);
                return updatedCart;
              }
              const newItem = {
                id: `combo-${combo.id}-${Date.now()}`,
                productId: null,
                comboId: combo.id,
                isCombo: true,
                name: combo.name || 'Combo',
                price: setPrice,
                quantity: 1,
                unitCost: setCost,
                retailTaxRate: setTaxRate,
                taxPercent: setTaxPercent,
                comboItems,
                comboNormalTotal: normalTotal,
                timestamp: Date.now(),
                action: 'add-product-combo'
              };
              setSelectedCartItem(newItem);
              return [...prevCart, newItem];
            });
          } catch (error) {
            console.error('Error adding product combo from sale key:', error);
            alert('Failed to add product combo. Please try again.');
          }
        })();
        break;
      case 'display-product-details':
        // Open the same product detail view as clicking the product name
        if (!selectedCartItem) {
          alert('Please select a product from the cart first');
          return;
        }
        await handleOpenProductDetail(selectedCartItem, { stopPropagation: () => {} });
        break;
      case 'subtract-quantity':
        // Subtract quantity from selected product or last added product
        if (cart.length === 0) {
          alert('No products in cart to subtract quantity from');
          return;
        }
        
        if (!selectedCartItem) {
          alert('Please select a product from the cart first');
          return;
        }
        
        (async () => {
          const itemIndex = cart.findIndex(item => 
            item.id === selectedCartItem.id && item.timestamp === selectedCartItem.timestamp
          );
          
          if (itemIndex !== -1) {
            const item = cart[itemIndex];
            if (item.quantity > 1) {
              const newQuantity = item.quantity - 1;
              
              // Recalculate price based on new quantity
              const productData = item.productId
                ? resolveProductLocal(item.productId, item.name)
                : null;
              // Product not resolvable: the helper rescales the line totals
              // proportionally instead of freezing the old ones.
              const updatedItem = {
                ...item,
                quantity: newQuantity,
                ...priceLineForQuantity(productData, newQuantity, item),
              };

              setCart(prev => {
                const updatedCart = [...prev];
                updatedCart[itemIndex] = updatedItem;
                return updatedCart;
              });
              setSelectedCartItem(updatedItem);
            } else {
              setCart(prev => {
                const updatedCart = [...prev];
                updatedCart.splice(itemIndex, 1);
                return updatedCart;
              });
              setSelectedCartItem(null); 
            }
          }
        })();
        break;
      case 'add-quantity':
        // Add quantity to selected product or last added product
        if (cart.length === 0) {
          alert('No products in cart to add quantity to');
          return;
        }
        
        if (!selectedCartItem) {
          alert('Please select a product from the cart first');
          return;
        }
        
        (async () => {
          const itemIndex = cart.findIndex(item => 
            item.id === selectedCartItem.id && item.timestamp === selectedCartItem.timestamp
          );
          
          if (itemIndex !== -1) {
            const item = cart[itemIndex];
            const newQuantity = (item.quantity || 1) + 1;
            
            const productData = item.productId
              ? resolveProductLocal(item.productId, item.name)
              : null;
            // Product not resolvable: the helper rescales the line totals
            // proportionally instead of freezing the old ones.
            const updatedItem = {
              ...item,
              quantity: newQuantity,
              ...priceLineForQuantity(productData, newQuantity, item),
            };
            
            setCart(prev => {
              const updatedCart = [...prev];
              updatedCart[itemIndex] = updatedItem;
              return updatedCart;
            });
            setSelectedCartItem(updatedItem);
          }
        })();
        break;
      case 'payment':
      case 'pay-amount':
        // Prevent additional payments if transaction is already complete
        if (isTransactionComplete) return;
        
        // Handle payment - extract amount from key name or amount field
        const paymentAmount = parseFloat(saleKey.amount) || parseFloat(saleKey.name.match(/\$(\d+(?:\.\d{2})?)/)?.[1]) || 0;
        // Card/EFTPOS methods must charge the PIN pad first; the payment is only
        // recorded in onApproved of the page-level PayByCardDialog. Resolve the
        // method record first so routing keys off its integration TYPE.
        const payMethodRecord = availablePaymentMethods.find(x => x.name === saleKey.paymentMethod);
        if (isEftposMethod(payMethodRecord || saleKey.paymentMethod)) {
          const chargeAmount = Math.min(paymentAmount, calculateRemainingBalance());
          const methodRecord = payMethodRecord;
          // Cash-out-enabled method: prompt for the cash amount before charging.
          if (allowsCashOut(methodRecord)) {
            const goodsCents = Math.max(0, Math.round(chargeAmount * 100));
            if (goodsCents === 0 && !allowCashOutNoSaleRef.current) {
              alert('Cash out without a sale is disabled in General Settings.');
              break;
            }
            setSaleKeyCashOutPrompt({
              goodsCents,
              methodName: saleKey.paymentMethod,
              description: saleKey.name,
            });
            break;
          }
          if (chargeAmount > 0) {
            setSaleKeyCardCharge({
              amountCents: Math.round(chargeAmount * 100),
              methodName: saleKey.paymentMethod,
              description: saleKey.name
            });
          }
          break;
        }
        if (paymentAmount > 0) {
          setPayments(prev => {
            const newPayments = [...prev, {
            id: `payment-${crypto.randomUUID()}`,
            amount: paymentAmount,
            method: saleKey.paymentMethod || 'cash',
            timestamp: Date.now(),
            description: saleKey.name
            }];
            
            // Check if this payment completes the transaction
            const totalPayments = newPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
            const cartTotal = calculateTotal();
            if (totalPayments >= cartTotal && cartTotal > 0) {
              // Transaction is complete, generate receipt
              setTimeout(async () => {
                await completeTransaction(newPayments, cartTotal);
              }, 100);
            }
            
            return newPayments;
          });
        }
        break;
      case 'pay-exact-amount':
        // Prevent additional payments if transaction is already complete
        if (isTransactionComplete) return;
        
        // Calculate the exact remaining balance needed to complete the transaction
        const remainingBalance = calculateRemainingBalance();
        // Card/EFTPOS methods must charge the PIN pad first; the payment is only
        // recorded in onApproved of the page-level PayByCardDialog. Resolve the
        // method record first so routing keys off its integration TYPE.
        const exactName = saleKey.selectedPaymentMethod?.name || saleKey.paymentMethod;
        const exactRecord =
          saleKey.selectedPaymentMethod?.masterDatabaseRef !== undefined
            ? saleKey.selectedPaymentMethod
            : availablePaymentMethods.find(x => x.name === exactName);
        if (isEftposMethod(exactRecord || saleKey.selectedPaymentMethod || saleKey.paymentMethod)) {
          const name = exactName;
          const methodRecord = exactRecord;
          // Cash-out-enabled method: prompt for cash even with no goods (cash-out
          // without a sale uses Pay Exact with Prevent Disabled — balance is 0).
          if (allowsCashOut(methodRecord)) {
            const goodsCents = Math.max(0, Math.round(remainingBalance * 100));
            if (goodsCents === 0 && !allowCashOutNoSaleRef.current) {
              alert('Cash out without a sale is disabled in General Settings.');
              break;
            }
            setSaleKeyCashOutPrompt({
              goodsCents,
              methodName: name || 'EFTPOS',
              description: saleKey.name || 'Pay Exact Amount',
            });
            break;
          }
          if (remainingBalance > 0) {
            setSaleKeyCardCharge({
              amountCents: Math.round(remainingBalance * 100),
              methodName: saleKey.selectedPaymentMethod?.name || saleKey.paymentMethod || 'EFTPOS',
              description: saleKey.name || 'Pay Exact Amount'
            });
          }
          break;
        }
        if (remainingBalance > 0) {
          setPayments(prev => {
            const newPayments = [...prev, {
              id: `payment-${crypto.randomUUID()}`,
              amount: remainingBalance,
              method: saleKey.selectedPaymentMethod?.name || saleKey.paymentMethod || 'cash',
              timestamp: Date.now(),
              description: saleKey.name || 'Pay Exact Amount'
            }];
            
            // This payment should complete the transaction exactly
            const cartTotal = calculateTotal();
            if (cartTotal > 0) {
              // Transaction is complete, generate receipt
              setTimeout(async () => {
                await completeTransaction(newPayments, cartTotal);
              }, 100);
            }
            
            return newPayments;
          });
        }
        break;
      case 'clear-sale':
        // Block clearing an in-progress sale that holds an approved PIN pad payment —
        // the customer has been charged; refund it first. After completion the sale is
        // already saved, so clearing just resets for the next sale.
        if (!isTransactionComplete && hasIntegratedPayment(payments)) {
          alert(
            'Sales that contain integrated payments (such as EFTPOS/card) cannot be cleared without first refunding and removing the payment methods.'
          );
          return;
        }
        saleEpochRef.current++;
        setCart([]);
        setPayments([]);
        pendingGiftCardRef.current = [];
        setSelectedCustomer(null);
        setSelectedCartItem(null);
        setIsTransactionComplete(false);
        setLoyaltyRedemption(null);
        setLoyaltyCalculation(null);
        setShowReceipt(false);
        setTransactionId(null);
        setShowPrintDialog(false);
        setReceiptData(null);
        break;
      case 'cancel-current-sale':
        // Cancel: remove all products and mark sale as cancelled. Block if integrated payments present.
        if (hasIntegratedPayment(payments)) {
          alert(
            'Sales that contain integrated payments (such as EFTPOS/card) cannot be cancelled without first refunding and removing the payment methods.'
          );
          return;
        }
        saleEpochRef.current++;
        setCart([]);
        setPayments([]);
        pendingGiftCardRef.current = [];
        setSelectedCustomer(null);
        setSelectedCartItem(null);
        setIsTransactionComplete(false);
        setLoyaltyRedemption(null);
        setLoyaltyCalculation(null);
        setShowReceipt(false);
        setTransactionId(null);
        setShowPrintDialog(false);
        setReceiptData(null);
        break;
      case 'add-gift-card':
        // Prevent adding gift cards if payment is complete
        if (isTransactionComplete) return;
        setGiftCardMode('sell');
        setGiftCardCode('');
        setGiftCardError('');
        setShowGiftCardPopup(true);
        break;
      case 'open-drawer': {
        // Open the cash drawer via cash management service. The endpoint requires
        // the register the drawer belongs to (400 without it).
        const drawerRegisterId = localStorage.getItem('selectedRegisterId');
        if (!drawerRegisterId) {
          alert('Please select a register before opening the cash drawer.');
          break;
        }
        // Setup > General: "Require reason when opening the cash drawer".
        let drawerReason = 'Sale key';
        if (generalSettings.requireReasonForCashDrawer) {
          const picked = await askReason({
            title: 'Reason for Opening the Cash Drawer',
            label: 'Reason',
            options: generalSettings.predefinedCashDrawerReasons || [],
          });
          if (!picked) break;
          drawerReason = picked;
        }
        try {
          await cashManagementService.openDrawer({
            registerId: parseInt(drawerRegisterId),
            reason: drawerReason,
          });
        } catch (error) {
          console.error('Error opening cash drawer from sale key:', error);
          alert(error?.error || 'Failed to open cash drawer');
        }
        break;
      }
      case 'view-live-profit':
        // Toggle live profit visibility. Without the permission the key
        // silently does nothing (matches Shopfront behavior).
        if (!canViewLiveProfit) break;
        setShowLiveProfit(prev => {
          const next = !prev;
          try {
            localStorage.setItem('posShowLiveProfit', next ? '1' : '0');
          } catch {
            // localStorage unavailable (private mode) – toggle is session-only
          }
          return next;
        });
        break;
      case 'view-promotions':
        // Show promotion products view (replaces sell screen)
        const type = saleKey.promotionType || 'Current';
        setPromotionTypeFilter(type);
        loadPromotionProducts(type);
        setShowPromotionView(true);
        setActiveTab('sales-keys'); // Ensure we're on sales-keys tab
        break;
      case 'navigation':
        // Navigation key: open its configured folder, else return to Home Keys.
        if (saleKey.folderName || saleKey.folderId) {
          loadFolder(saleKey.folderId || saleKey.folderName, saleKey.folderName || saleKey.folderId);
        } else if (currentFolder) {
          goBackToMain();
        } else {
          alert('This navigation key is not configured. Edit it and select a folder.');
        }
        break;
      case 'special':
        // ponytail: no special-action engine exists — show the key's configured
        // message so the key is never a silent dead click.
        alert(saleKey.specialText || `${saleKey.name}: no special action is configured for this key.`);
        break;
      case 'info':
        // Informational key: show its configured info text.
        alert(saleKey.infoText || saleKey.name);
        break;
      case 'create-customer':
        // Open the create customer modal (same as clicking "Create Customer" button)
        setShowCreateCustomerModal(true);
        break;
      case 'display-classification-products':
      case 'display-classification-products-case':
        // Display products in classification
        if (!saleKey.classificationId && !saleKey.classificationName) {
          alert('Please configure the classification for this sale key.');
          return;
        }
        setUseCaseQuantity(saleKey.action === 'display-classification-products-case');
        loadClassificationProducts(saleKey.classificationId || saleKey.classificationName, saleKey.classificationType);
        setShowClassificationView(true);
        setActiveTab('sales-keys');
        break;

      // ---- Additional Shopfront sale-key actions ----
      case 'add-order-reference': {
        const ref = await prompt('Enter an order reference for this sale:', orderReference || '', { title: 'Order reference' });
        if (ref !== null) setOrderReference(ref.trim());
        break;
      }
      case 'add-note': {
        const scope = saleKey.noteScope || 'Sale';
        if (cart.length === 0) { alert('Add items to the sale before adding a note.'); return; }
        if (scope === 'Product') {
          if (!selectedCartItem) { alert('Select a product in the cart to add a note to.'); return; }
          const note = await prompt('Product note:', selectedCartItem.note || '', { title: 'Add note' });
          if (note === null) break;
          setCart(prev => prev.map(i =>
            (i.id === selectedCartItem.id && i.timestamp === selectedCartItem.timestamp ? { ...i, note } : i)));
          setSelectedCartItem(prev => (prev ? { ...prev, note } : prev));
        } else {
          const existing = cart.find(i => i && i._saleNote)?._saleNote || '';
          const note = await prompt(`${scope} note:`, existing, { title: 'Add note' });
          if (note === null) break;
          // Stamped on the cart so it clears automatically when the sale resets.
          setCart(prev => prev.map(i => ({ ...i, _saleNote: note })));
        }
        break;
      }
      case 'add-customer': {
        const cust = saleKey.customerData
          || (saleKey.customerId ? { id: saleKey.customerId, name: saleKey.customerName } : null);
        if (!cust?.id) { alert('This customer key is not configured. Edit it and choose a customer.'); return; }
        await handleSelectCustomer(cust);
        break;
      }
      case 'customer-list':
        await handleAddCustomerClick();
        break;
      case 'apply-discount': {
        if (!selectedCartItem) { alert('Select a product in the cart to discount.'); return; }
        const updated = computeConfiguredDiscount(selectedCartItem, saleKey.discountType, saleKey.discountValue);
        if (updated) handleDiscountConfirm(updated);
        break;
      }
      case 'pay-loyalty': {
        if (isTransactionComplete) return;
        if (cart.length === 0) { alert('Add products before paying with loyalty.'); return; }
        if (!selectedCustomer?.id) { alert('Add a customer with loyalty points to the sale first.'); return; }
        const remaining = calculateRemainingBalance();
        if (remaining <= 0) return;
        // Reuses the finalize-dialog loyalty payment path (points calc + auto-complete).
        await handleAddPaymentFromDialog({ method: 'loyalty', amount: remaining, description: saleKey.name || 'Loyalty' });
        break;
      }
      case 'make-customer-payment': {
        // On-account payment from the sell screen: tenders the remaining balance to the
        // customer's account. Only usable when an account-enabled customer is on the sale.
        if (isTransactionComplete) return;
        if (cart.length === 0) { alert('Add products before taking a customer payment.'); return; }
        if (!selectedCustomer?.id) { alert('Add a customer to the sale first.'); return; }
        if (!selectedCustomer?.customerGroup?.allowAccountSales) {
          alert("This customer's group does not allow account sales.");
          return;
        }
        const remaining = calculateRemainingBalance();
        if (remaining <= 0) return;
        // Reuses the finalize-dialog payment path (auto-completes when fully paid);
        // completeTransaction refreshes the customer balance for 'On Account' payments.
        await handleAddPaymentFromDialog({ method: 'On Account', amount: remaining, description: saleKey.name || 'On Account' });
        break;
      }
      case 'add-iba-loyalty-customer':
      case 'remove-iba-loyalty-customer':
        // ponytail: IBA Loyalty Rewards is a third-party integration with no local backend.
        // Selectable for reference parity; inform the operator instead of a silent dead key.
        alert('IBA Loyalty Rewards integration is not available on this system.');
        break;
      case 'flip-sale': {
        if (cart.length === 0) { alert('No products to flip.'); return; }
        // Flip every line's sign (bulk return); pressing again reverts. Lines
        // only turn negative when they're currently positive.
        const flipReason = cart.some(i => (parseFloat(i.quantity) || 1) > 0) ? await askRefundReason() : '';
        if (flipReason === null) break;
        setCart(prev => prev.map(i => ({
          ...i,
          quantity: -(parseFloat(i.quantity) || 1),
          price: -(parseFloat(i.price) || 0),
          ...(flipReason ? { refundReason: flipReason } : {}),
        })));
        setSelectedCartItem(null);
        break;
      }
      case 'return-item': {
        if (!selectedCartItem) { alert('Select a product in the cart to return.'); return; }
        const returnReason = (parseFloat(selectedCartItem.quantity) || 1) > 0 ? await askRefundReason() : '';
        if (returnReason === null) break;
        const flip = (i) => ({
          ...i,
          quantity: -(parseFloat(i.quantity) || 1),
          price: -(parseFloat(i.price) || 0),
          ...(returnReason ? { refundReason: returnReason } : {}),
        });
        setCart(prev => prev.map(i =>
          (i.id === selectedCartItem.id && i.timestamp === selectedCartItem.timestamp ? flip(i) : i)));
        setSelectedCartItem(prev => (prev ? flip(prev) : prev));
        break;
      }
      case 'add-quantity-barcode':
      case 'subtract-quantity-barcode': {
        if (isTransactionComplete) return;
        if (cart.length === 0) { alert('No products in cart.'); return; }
        if (!selectedCartItem) { alert('Please select a product from the cart first'); return; }
        const sign = saleKey.action === 'add-quantity-barcode' ? 1 : -1;
        // ponytail: the originally-scanned barcode multipack qty isn't tracked locally;
        // fall back to the line's barcodeQuantity, else 1.
        const step = (parseFloat(selectedCartItem.barcodeQuantity) || 1) * sign;
        const idx = cart.findIndex(i => i.id === selectedCartItem.id && i.timestamp === selectedCartItem.timestamp);
        if (idx === -1) break;
        const item = cart[idx];
        const newQty = (parseFloat(item.quantity) || 1) + step;
        if (newQty <= 0) {
          setCart(prev => prev.filter((_, i) => i !== idx));
          setSelectedCartItem(null);
          break;
        }
        const product = item.productId ? resolveProductLocal(item.productId, item.name) : null;
        const updatedItem = { ...item, quantity: newQty, ...priceLineForQuantity(product, newQty, item) };
        setCart(prev => prev.map((it, i) => (i === idx ? updatedItem : it)));
        setSelectedCartItem(updatedItem);
        break;
      }
      case 'use-case-quantity':
        // Modifier: toggle case-quantity mode for the next add / selected line.
        setUseCaseQuantity(prev => !prev);
        break;
      case 'add-component-to-current':
      case 'remove-component-from-current': {
        if (isTransactionComplete) return;
        const compId = saleKey.componentProductId || saleKey.componentProduct?.id || null;
        const product = compId
          ? resolveProductLocal(compId, saleKey.componentProductName || saleKey.componentProduct?.name)
          : null;
        if (!product) { alert('This component key is not configured. Edit it and choose a component.'); return; }
        applyComponentToSale(product, saleKey.action === 'add-component-to-current' ? 1 : -1);
        break;
      }
      case 'display-components-add':
      case 'display-components-remove': {
        // Interactive picker over the selected combo/package line's components.
        const pkg = selectedCartItem;
        const comps = pkg?.comboItems || [];
        if (!pkg?.isCombo || comps.length === 0) { alert('Select a package/combo line to view its components.'); return; }
        setComponentPicker({ mode: saleKey.action === 'display-components-add' ? 'add' : 'remove' });
        break;
      }
      case 'show-backorders': {
        if (!selectedCartItem?.productId) { alert('Select a product in the cart to view backorders.'); return; }
        const product = resolveProductLocal(selectedCartItem.productId, selectedCartItem.name);
        const onOrder = product?.onOrder ?? product?.backorderQuantity ?? product?.backorders ?? 0;
        alert(`${selectedCartItem.name}\nBackorder / on order: ${onOrder}`);
        break;
      }
      case 'reweigh': {
        if (!selectedCartItem) { alert('Select a weighed product line to reweigh.'); return; }
        if (selectedCartItem.isCombo || selectedCartItem.giftCardId || !selectedCartItem.productId) {
          alert('This line is not a weighable product.');
          return;
        }
        // ponytail: products carry no isWeighed flag (schema frozen) — any product line
        // can be reweighed; add an isWeighed column to enforce weighed-only.
        // ponytail: no integrated-scale driver locally — capture the weight manually.
        const weight = await askValue({
          title: `Weight — ${selectedCartItem.name}`,
          mode: 'qty',
          initial: String(selectedCartItem.quantity || 1),
        });
        if (!weight || weight <= 0) break;
        const product = selectedCartItem.productId ? resolveProductLocal(selectedCartItem.productId, selectedCartItem.name) : null;
        const repriced = { quantity: weight, ...priceLineForQuantity(product, weight, selectedCartItem) };
        setCart(prev => prev.map(i =>
          (i.id === selectedCartItem.id && i.timestamp === selectedCartItem.timestamp ? { ...i, ...repriced } : i)));
        setSelectedCartItem(prev => (prev ? { ...prev, ...repriced } : prev));
        break;
      }
      case 'product-search-input':
        // Inject the configured text into the product search box (search runs via effect).
        setSearchTerm(prev => applySearchTokens(prev, saleKey.keyboardText || ''));
        break;
      case 'previous-folder':
        // ponytail: single-level nesting — returns to Home keys (no-op if already there).
        if (currentFolder) goBackToMain();
        break;
      case 'search-additional': {
        // Search products by their additional-information fields (description,
        // order/invoice notes, supplier code, barcodes) and surface the matches in
        // the product-list view with Add buttons.
        const term = await prompt('Search products by additional information:', '', { title: 'Search products', confirmText: 'Search' });
        if (!term || !term.trim()) break;
        (async () => {
          try {
            const q = term.trim().toLowerCase();
            let products = posLocalDb.isReady() ? posLocalDb.getProducts() : [];
            if (!products.length) {
              const resp = await productService.getProducts({ limit: 1000, status: 'Active' });
              products = resp.products || [];
            }
            const inField = (v) => typeof v === 'string' && v.toLowerCase().includes(q);
            const matches = products.filter(p =>
              inField(p.description) || inField(p.orderNotes) || inField(p.invoiceNotes) ||
              inField(p.metcashMsc) ||
              (Array.isArray(p.barcodes) && p.barcodes.some(b => inField(typeof b === 'string' ? b : b?.barcode)))
            );
            if (matches.length === 0) {
              alert(`No products matched "${term.trim()}" in additional information.`);
              return;
            }
            // Reuse the classification product-list view to show matches with Add buttons.
            setCurrentClassification({ name: `Additional info: "${term.trim()}"` });
            setClassificationProducts(matches);
            setClassificationSearchTerm('');
            setShowClassificationView(true);
            setActiveTab('sales-keys');
          } catch (error) {
            console.error('Additional information search failed:', error);
            alert('Search failed. Please try again.');
          }
        })();
        break;
      }
      case 'sale-search': {
        // Recall a previous sale by invoice/sale number for viewing or return.
        if (isTransactionComplete) return;
        const inv = await prompt('Enter invoice/sale number to recall:', '', { title: 'Recall sale', confirmText: 'Recall' });
        if (!inv || !inv.trim()) break;
        recallSaleAsReturn(inv.trim());
        break;
      }
      case 'change-price-set': {
        // Switch the whole sale to the configured Price Set (Settings > Price Sets)
        // and reprice existing product lines. Reference: the entire sale changes —
        // price sets cannot be mixed within one sale. Keys saved before true price
        // sets existed pointed at a customer Price List; those keep the old
        // load-the-list-config behaviour as a fallback.
        const psId = saleKey.priceSetId;
        const psName = saleKey.priceSetName;
        if (!psId && !psName) { alert('This price-set key is not configured. Edit it and choose a price set.'); return; }
        (async () => {
          try {
            // Keys saved with priceSetKind 'set' point at a true Price Set; keys
            // without it predate price sets and point at a customer Price List
            // (ids overlap between the two tables, so the kind decides the path).
            if (saleKey.priceSetKind === 'set') {
              const { priceSets: sets } = await priceSetService.getPriceSets();
              const match = (sets || []).find(ps => ps.id === Number(psId))
                || (sets || []).find(ps => ps.name === psName);
              if (!match) { alert(`Price set "${psName || psId}" was not found.`); return; }
              applyActivePriceSet(match.id);
              // Combos, gift cards and return (negative) lines keep their prices.
              // ponytail: reprice = base price through the new set (+ the sale's
              // current price-list layer); the promotion best-of re-check is
              // skipped here (next add applies it as usual).
              setCart(prev => prev.map(item => {
                if (item.isCombo || item.giftCardId || !item.productId) return item;
                const qty = parseFloat(item.quantity) || 0;
                if (qty <= 0) return item;
                const product = resolveProductLocal(item.productId, item.name);
                if (!product) return item;
                const base = calculateBasePriceForQuantity(product, qty);
                return { ...item, price: computePriceListTotal(product, qty, base) };
              }));
              setSelectedCartItem(null);
              notify(`Price set: ${match.name}`);
              return;
            }
            // Legacy keys configured against a customer Price List.
            let listId = psId;
            if (!listId) {
              const all = await priceListService.getPriceLists();
              listId = (all.priceLists || []).find(pl => pl.name === psName)?.id;
            }
            if (!listId) { alert(`Price set "${psName || psId}" was not found.`); return; }
            const res = await priceListService.getPriceListConfiguration(listId);
            const config = res?.configuration || res || null;
            setPriceListConfig(config);
            setCart(prev => prev.map(item => {
              if (item.isCombo || item.giftCardId || !item.productId) return item;
              const qty = parseFloat(item.quantity) || 0;
              if (qty <= 0) return item;
              const product = resolveProductLocal(item.productId, item.name);
              if (!product) return item;
              const base = calculateBasePriceForQuantity(product, qty);
              return { ...item, price: computePriceListTotal(product, qty, base, config) };
            }));
            setSelectedCartItem(null);
          } catch (error) {
            console.error('Error changing price set:', error);
            alert('Failed to load that price set.');
          }
        })();
        break;
      }
      case 'view-current-time':
        alert(formatDynamicDate(new Date(), saleKey.dateFormat || 'HH:mm:ss'));
        break;
      case 'view-previous-date':
        alert(formatDynamicDate(subtractIsoPeriod(new Date(), saleKey.durationAgo || 'P0D'), saleKey.dateFormat || 'YYYY-MM-DD'));
        break;
      default:
        // Check if it's a cash payment by name pattern or if it has an amount (likely a payment key)
        if ((saleKey.name.toLowerCase().includes('cash') || saleKey.amount) && saleKey.amount) {
          // Prevent additional payments if transaction is already complete
          if (isTransactionComplete) return;
          
          setPayments(prev => {
            const newPayments = [...prev, {
              id: `payment-${crypto.randomUUID()}`,
              amount: parseFloat(saleKey.amount) || 0,
              method: 'cash',
              timestamp: Date.now(),
              description: saleKey.name
            }];
            
            // Check if this payment completes the transaction
            const totalPayments = newPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
            const cartTotal = calculateTotal();
            if (totalPayments >= cartTotal && cartTotal > 0) {
              // Transaction is complete, generate receipt
              setTimeout(async () => {
                await completeTransaction(newPayments, cartTotal);
              }, 100);
            }
            
            return newPayments;
          });
        } else {
        }
    }
  };

  const resolveTaxRatesForSale = async () => {
    if (taxRates?.length) return taxRates;
    const cached = posLocalDb.getTaxRates();
    if (cached?.length) {
      setTaxRates(cached);
      return cached;
    }
    try {
      const resp = await taxRateService.getTaxRates();
      const rates = resp?.taxRates || [];
      if (rates.length) setTaxRates(rates);
      return rates;
    } catch {
      return [];
    }
  };

  // What a line actually gave away. The price editor records it once, on the line,
  // as discountInfo.discountAmount (a price INCREASE never counts); older/loyalty
  // lines carry it as a plain number. Every discount consumer reads it from here.
  const getItemDiscount = (item) => {
    const fromEditor = Math.max(0, parseFloat(item?.discountInfo?.discountAmount) || 0);
    return fromEditor || parseFloat(item?.discount || item?.redemptionDiscount || 0) || 0;
  };

  // Sale-level counters, computed from the un-expanded cart so combo lines
  // (which expandCartForSale replaces with their members) still count.
  const getCartDiscountTotals = (cartItems) => {
    const discount = (cartItems || []).reduce((sum, item) => sum + getItemDiscount(item), 0);
    // Savings covers everything a line gave away — promotion (normalPrice),
    // combo (comboDeal) and the manual discount — counted once per line.
    const savings = (cartItems || []).reduce(
      (sum, item) => sum + lineSavings(item, getItemDiscount(item)),
      0
    );
    return { discount, savings };
  };

  // Build the full sale payload from the LIVE cart + tendered payments. Shared
  // by the regular save (POST /sales) and resumed-parked completion
  // (PUT /sales/:id), so a resumed sale banks what was actually sold - not the
  // items and total that were parked.
  const buildSaleBody = async (finalPayments, cartTotal, changeValue = 0) => {
      const { savings, discount } = getCartDiscountTotals(cart);
      const loyaltyValue = 0;
      const balance = 0;

      const localTaxRates = await resolveTaxRatesForSale();

      const getPercent = (name) => {
        if (!name || name === 'No Tax') return 0;
        const rate = (localTaxRates || []).find(r => r.name === name);
        return rate ? Number(rate.amount) || 0 : 0;
      };

      let totalIncludedTax = 0;
      let totalCost = 0;

      const saleItems = expandCartForSale(cart).map(item => {
        const taxPercent = getPercent(item.retailTaxRate || item.taxRateName);
        const totalPrice = parseFloat(item.price || 0); // item.price now contains total price
        const quantity = parseInt(item.quantity) || 1;
        const unitPrice = totalPrice / quantity; // Calculate unit price for storage
        // Retail prices are tax-inclusive: tax component = inc * rate / (100 + rate)
        const itemTaxIncluded = taxPercent > 0 ? (totalPrice * taxPercent / (100 + taxPercent)) : 0;
        totalIncludedTax += itemTaxIncluded;
        totalCost += (parseFloat(item.unitCost) || 0) * (quantity || 1);

        // Calculate surcharge breakdown for this item
        let surchargeBreakdown = {};
        if (item.productId && item.surchargeBreakdown) {
          surchargeBreakdown = item.surchargeBreakdown;
        } else if (item.productId) {
          const product = item.product || { id: item.productId, name: item.name };
          const { byName } = calculateSurchargeBreakdown(product, quantity, totalPrice);
          surchargeBreakdown = byName;
        }
        
        // Store surcharge breakdown in description as JSON (if not empty)
        let description = item.description || '';
        if (Object.keys(surchargeBreakdown).length > 0) {
          const surchargeData = JSON.stringify({ surchargeBreakdown });
          description = description ? `${description}\n__SURCHARGE__:${surchargeData}` : `__SURCHARGE__:${surchargeData}`;
        }
        
        return {
          productName: item.name || item.productName || 'Unknown Product',
          description: description,
          quantity: quantity,
          unitPrice: unitPrice,
          totalPrice: totalPrice,
          discount: getItemDiscount(item),
          tax: itemTaxIncluded,
          // Bank the rate NAME with the line so a reprint prints the sale-time rate
          // even after the product is renamed, re-rated or deleted.
          taxName: item.retailTaxRate || item.taxRateName || null,
          // Receipt columns that stop being derivable the moment a promotion or
          // combo changes: bank the sale-time normal price and savings with the line.
          // Combo members arrive with theirs already allocated (expandCartForSale).
          normalPrice: item.normalPrice != null ? parseFloat(item.normalPrice) : null,
          savings: item.savings != null ? parseFloat(item.savings) : lineSavings(item, getItemDiscount(item)),
          comboName: item.comboName || null,
          comboSets: item.comboSets || null,
          // Line note prints on the live receipt; bank it so reprints keep it.
          // ponytail: the Setup > General discount/refund reasons ride in the same
          // column (no schema change, and a reason belongs with the line it explains).
          note: [
            item.note,
            item.discountInfo?.reason ? `Discount reason: ${item.discountInfo.reason}` : null,
            item.refundReason ? `Refund reason: ${item.refundReason}` : null,
          ].filter(Boolean).join(' | ') || null,
          productId: item.productId || item.id || null, // CRITICAL: Include productId for loyalty calculation
          surchargeBreakdown: surchargeBreakdown // Also pass directly for backend processing
        };
      });

      if (!finalPayments || finalPayments.length === 0) {
        throw new Error('No payments provided for sale');
      }

      const salePayments = finalPayments.map(payment => {
        const method = payment.method || 'Cash';
        return {
          paymentMethod: method,
          amount: parseFloat(payment.amount) || 0,
          reference: payment.reference !== undefined ? payment.reference : ((method || '').toLowerCase() === 'cash' ? 'CASH_GIVEN' : ''),
          // Persisted so the emailed receipt and a reprint from Sales History carry
          // the same EFTPOS slip the till printed.
          eftposReceipt: payment.eftposReceipt || null,
        };
      });

      if (changeValue && changeValue > 0) {
        salePayments.push({
          paymentMethod: 'Cash (Change)',
          amount: -Math.abs(parseFloat(changeValue)),
          reference: 'CASH_CHANGE'
        });
      }

      const saleData = {
        totalAmount: parseFloat(cartTotal),
        // basePrice is the COGS column: a cart with no item costs is zero cost,
        // not the ex-tax sell total (that reported a ~100% gross margin as ~0%).
        basePrice: parseFloat(totalCost) || 0,
        savings: parseFloat(savings),
        discount: parseFloat(discount),
        tax: parseFloat(totalIncludedTax),
        loyaltyValue: loyaltyRedemption?.pointsRedeemed || parseInt(loyaltyValue) || 0,
        loyaltyPointsRedeemed: loyaltyRedemption?.pointsRedeemed || 0,
        paymentMethod: finalPayments[0]?.method || 'Cash',
        balance: parseFloat(balance),
        status: 'COMPLETED',
        isReturned: false,
        // Recalled return lines carry the sale they came from; sending it lets the
        // backend flag that original as returned, which is what Sales History's
        // "Returned" filter reads (reference behaviour).
        returnedFromSaleNumber:
          (Array.isArray(cart) && cart.find((i) => i && i._recalledFrom)?._recalledFrom) || undefined,
        isDiscounted: parseFloat(discount) > 0,
        customerId: selectedCustomer?.id || null,
        outletId: getEffectiveOutletId(),
        registerId: (localStorage.getItem('selectedRegisterId') ? parseInt(localStorage.getItem('selectedRegisterId')) : null),
        notes: (Array.isArray(cart) && cart.find(i => i && i._saleNote)?._saleNote) || '',
        items: saleItems,
        payments: salePayments
      };

      return saleData;
  };

  const saveSaleToHistory = async (finalPayments, cartTotal, transactionId, changeValue = 0, invoiceNumber = null) => {
    try {
      const saleData = await buildSaleBody(finalPayments, cartTotal, changeValue);
      // Same digits as the printed receipt barcode, so scanning a receipt
      // finds this sale (backend regenerates on the rare duplicate).
      saleData.saleNumber = transactionId ? '#' + String(transactionId).replace(/\D/g, '') : undefined;
      // The number already printed on the receipt; the server stores it and advances
      // the register's counter past it.
      saleData.invoiceNumber = invoiceNumber || undefined;

      const created = await salesService.createSale(saleData);
      // Return the created sale id so the caller can auto-email the receipt (group flag).
      return created?.sale?.id ?? created?.id ?? null;
    } catch (error) {
      console.error('Error saving sale to history:', error);
      throw error;
    }
  };

  const normalizeCashForChange = (paymentsArray, cartTotal) => {
    const paymentsCopy = Array.isArray(paymentsArray) ? paymentsArray.map(p => ({ ...p })) : [];
    const totalPaid = paymentsCopy.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const total = parseFloat(cartTotal) || 0;
    const change = Math.max(0, totalPaid - total);
    if (change > 0) {
      const cashIndex = [...paymentsCopy].reverse().findIndex(p => (p.method || '').toLowerCase() === 'cash');
      if (cashIndex !== -1) {
        const idx = paymentsCopy.length - 1 - cashIndex;
        const current = parseFloat(paymentsCopy[idx].amount) || 0;
        paymentsCopy[idx].amount = Math.max(0, current - change);
      }
    }
    return { payments: paymentsCopy, change };
  };

  const PAYMENT_TOLERANCE = 0.01;

  // A return sale has a negative total and negative (refund) payments — settled means
  // the refund covers it, not that the tendered sum is larger. Sign-blind here left
  // every return stuck as unpaid.
  const isSaleFullyPaid = (paymentList, cartTotal) => {
    if (!paymentList?.length || Math.abs(cartTotal) <= PAYMENT_TOLERANCE) return false;
    const totalPaid = paymentList.reduce(
      (sum, p) => sum + (parseFloat(p.amount) || 0),
      0
    );
    return cartTotal < 0
      ? totalPaid <= cartTotal + PAYMENT_TOLERANCE
      : totalPaid >= cartTotal - PAYMENT_TOLERANCE;
  };

  // ── EFTPOS Refund Item (banner-group EFTPOS gift cards) ────────────────────
  // Reference art. 360021214372: the card's value is loaded by running a REFUND
  // on the EFTPOS terminal after the sale is paid. Integrated = a Linkly refund
  // straight to the pinpad (operator follows the pad: swipe card, Savings,
  // PIN 0000). Non-integrated = run it on the standalone terminal and confirm.
  const startEftposGiftCardLoads = (cartSnapshot) => {
    const lines = (cartSnapshot || [])
      .filter((item) => {
        if (!item.productId || item.isCombo || item.giftCardId) return false;
        const product = resolveProductLocal(item.productId, item.name);
        return product?.type === 'EFTPOS Refund Item' && (parseFloat(item.price) || 0) > 0;
      })
      .map((item) => ({
        name: item.name,
        amountCents: Math.round((parseFloat(item.price) || 0) * 100),
      }));
    if (lines.length > 0) processEftposGiftCardLoad(lines);
  };

  const processEftposGiftCardLoad = async (queue) => {
    const [line, ...rest] = queue || [];
    if (!line) return;
    const dollars = (line.amountCents / 100).toFixed(2);
    const usePinpad = await confirm(
      `Load $${dollars} onto the customer's EFTPOS gift card ("${line.name}") now?\n\n` +
        'The value is loaded by a REFUND on the EFTPOS terminal.',
      {
        title: 'EFTPOS gift card',
        confirmText: 'Send refund to pinpad',
        cancelText: 'Manual terminal',
        severity: 'question',
      }
    );
    if (usePinpad) {
      setEftposLoadCharge({ ...line, queue: rest });
      return; // continues from the refund dialog's onApproved/onClose
    }
    const loaded = await confirm(
      `Run a refund of $${dollars} on the standalone EFTPOS terminal now ` +
        '(swipe the gift card, select Savings, PIN 0000).\n\n' +
        'Check that the card has loaded successfully.',
      {
        title: 'EFTPOS gift card',
        confirmText: 'Card loaded',
        cancelText: 'Not loaded',
        severity: 'question',
      }
    );
    if (!loaded) {
      alert(
        `"${line.name}" was NOT confirmed as loaded — run the $${dollars} refund on the terminal before the customer leaves.`,
        'warning'
      );
    }
    processEftposGiftCardLoad(rest);
  };

  const completeTransaction = async (finalPayments, cartTotal) => {
    // Idempotency guard: duplicate scheduled completions (state updaters run more
    // than once) land here with a stale isTransactionComplete — bail on the ref.
    if (completedEpochRef.current === saleEpochRef.current) {
      console.log('[Transaction] Completion already ran for this sale, skipping duplicate call');
      return;
    }
    if (isTransactionComplete) {
      console.log('[Transaction] Already complete, skipping duplicate call');
      return;
    }

    console.log('[Transaction] Completing transaction with payments:', finalPayments);
    console.log('[Transaction] Payments array length:', finalPayments?.length || 0);
    console.log('[Transaction] Cart total:', cartTotal);
    
    // Validate that we have payments
    if (!finalPayments || finalPayments.length === 0) {
      console.error('[Transaction] ERROR: No payments provided to completeTransaction');
      alert('Error: No payments found. Please add a payment method.');
      return;
    }

    // Claim this epoch synchronously (before any await) so a queued duplicate
    // completion can never reach the save. Released again on failure paths.
    completedEpochRef.current = saleEpochRef.current;

    // Forced: never bank a sale on a register someone else has taken.
    const ok = await ensureRegisterControl({ force: true });
    if (!ok) {
      console.log('[Transaction] Register control check failed');
      completedEpochRef.current = -1;
      return;
    }
    
    // If this is a resumed parked sale, use the special completion function
    if (currentParkedSaleId) {
      try {
        // Complete with the LIVE cart + tendered payments. Completing with only
        // {status} banked the ORIGINAL parked items, the parked total and zero
        // payment rows - the receipt and the database disagreed forever.
        const { change: resumedChange } = normalizeCashForChange(finalPayments, cartTotal);
        const resumedBody = await buildSaleBody(finalPayments, cartTotal, resumedChange);
        const resumed = await salesService.resumeParkedSale(currentParkedSaleId, {
          items: resumedBody.items,
          payments: resumedBody.payments,
          totalAmount: resumedBody.totalAmount,
          basePrice: resumedBody.basePrice,
          savings: resumedBody.savings,
          discount: resumedBody.discount,
          tax: resumedBody.tax,
        });
        
        // Generate transaction ID
        const newTransactionId = `TXN-${Date.now()}`;
        setTransactionId(newTransactionId);
        setIsTransactionComplete(true);
        
        const { change } = normalizeCashForChange(finalPayments, cartTotal);

        console.log('[Transaction] Generating receipt for parked sale:', { newTransactionId, finalPayments, change });
        
        // Check if there were "On Account" payments and refresh customer data
        const hasOnAccountPayment = finalPayments.some(p => 
          (p.method || '').toLowerCase().includes('account')
        );
        
        if (hasOnAccountPayment && selectedCustomer?.id) {
          console.log('[Transaction] On Account payment detected in parked sale, refreshing customer balance...');
          // Refresh customer data after a short delay to ensure backend has updated
          setTimeout(async () => {
            await refreshCustomerData(selectedCustomer.id);
          }, 500);
        }
        
        // Generate receipt from the gross tendered payments (see the regular path).
        // The parked sale keeps whatever invoice number it was issued; the resume call
        // above assigns one server-side when it had none.
        generateReceipt(
          newTransactionId, finalPayments, cartTotal, change,
          resumed?.sale?.invoiceNumber || null,
        );

        // EFTPOS Refund Item lines: load the gift card(s) via a terminal refund.
        startEftposGiftCardLoads(cart);

        // Decrement any gift cards tendered on this (resumed) sale — exactly once.
        await redeemPendingGiftCards(currentParkedSaleId);

        // Clear parked sale tracking and reload parked sales
        setCurrentParkedSaleId(null);
        await loadParkedSales();
      } catch (error) {
        console.error('Error completing resumed parked sale:', error);
        completedEpochRef.current = -1; // allow a retry
        alert('Failed to complete sale. Please try again.');
      }
      return;
    }
    
    // Regular sale completion — show receipt immediately, save in background
    const newTransactionId = `TXN-${Date.now()}`;
    setTransactionId(newTransactionId);
    setIsTransactionComplete(true);

    // Change is still computed here (saveSaleToHistory banks it as a Cash (Change)
    // row), but the receipt is built from the GROSS tendered payments so a $50 cash
    // tender on a $22 sale prints "CASH $50.00 / Change $28.00" instead of a bare net
    // "CASH $22.00" with no change — and the on-screen receipt then matches a later
    // reprint from Sales History (which also renders gross tender + a change line).
    const { change } = normalizeCashForChange(finalPayments, cartTotal);
    const invoiceNumber = takeInvoiceNumber();
    generateReceipt(newTransactionId, finalPayments, cartTotal, change, invoiceNumber);

    // EFTPOS Refund Item lines: load the gift card(s) via a terminal refund.
    startEftposGiftCardLoads(cart);

    const hasOnAccountPayment = finalPayments.some(p =>
      (p.method || '').toLowerCase().includes('account')
    );

    setLastSaleId(null); // stays null until this sale's save resolves, so Email can't send a stale id
    saveSaleToHistory(finalPayments, cartTotal, newTransactionId, change, invoiceNumber)
      .then(async (saleId) => {
        setLastSaleId(saleId); // real id for the manual Email button
        if (hasOnAccountPayment && selectedCustomer?.id) {
          await refreshCustomerData(selectedCustomer.id);
        }
        // ponytail: autoEmailReceipt (group flag) — auto-send the receipt to the customer's
        // email once the sale exists (needs the real saleId). No-op without flag/email/id.
        maybeAutoEmailReceipt(saleId);
        // Decrement any gift cards tendered on this sale — exactly once, here.
        await redeemPendingGiftCards(saleId);
      })
      .catch((error) => {
        console.error('Error saving sale to history:', error);
        alert('Receipt shown, but the sale failed to save. Please contact support or retry from sales history.');
      });
  };

  // Decrement each gift card tendered on this sale, exactly once, after the sale is saved.
  // Backend sales.js never touches gift-card balances, so this is the single decrement path.
  const redeemPendingGiftCards = async (saleId) => {
    const pending = pendingGiftCardRef.current;
    if (!pending.length) return;
    pendingGiftCardRef.current = []; // clear first so a retry cannot double-redeem
    for (const r of pending) {
      try {
        await giftCardService.redeemGiftCard(r.code, r.amount, { saleId });
      } catch (e) {
        console.warn('[GiftCard] Redeem failed for', r.code, e?.message || e);
      }
    }
  };

  // Auto-email the receipt when the attached customer's group has autoEmailReceipt on.
  const maybeAutoEmailReceipt = (saleId) => {
    try {
      const group = selectedCustomer?.customerGroup;
      if (!group?.autoEmailReceipt || !saleId) return;
      const email = (Array.isArray(selectedCustomer?.emails) ? selectedCustomer.emails.find(Boolean) : null)
        || selectedCustomer?.email;
      if (!email) return;
      const senderEmail = selectedRegister?.outlet?.email || undefined;
      emailSaleReceipt({ saleId, receiverEmails: [email], senderEmail, receiptData: lastReceiptRef.current })
        .then(() => console.log('[Receipt] Auto-emailed to', email))
        .catch((e) => console.warn('[Receipt] Auto-email failed:', e?.message || e));
    } catch (e) {
      console.warn('[Receipt] Auto-email skipped:', e?.message || e);
    }
  };

  const loadParkedSales = async () => {
    try {
      setParkedSalesLoading(true);
      const response = await salesService.getParkedSales();
      setParkedSales(response.sales || []);
    } catch (error) {
      console.error('Error loading parked sales:', error);
    } finally {
      setParkedSalesLoading(false);
    }
  };

  const parkCurrentSale = async () => {
    const ok = await ensureRegisterControl({ force: true });
    if (!ok) return;
    if (cart.length === 0) {
      alert('Cannot park an empty sale. Please add items to the cart first.');
      return;
    }

    // Setup > General: "Require Note on Parked Sale".
    let parkNote = (Array.isArray(cart) && cart.find(i => i && i._saleNote)?._saleNote) || '';
    if (generalSettings.requireNoteOnParkedSale && !parkNote) {
      const note = await askReason({ title: 'Note for the Parked Sale', label: 'Note' });
      if (!note) return; // no note, no park
      parkNote = note;
    }

    try {
      const cartTotal = calculateTotal();
      const { savings, discount } = getCartDiscountTotals(cart);

      const localTaxRates = await resolveTaxRatesForSale();

      const getPercent = (name) => {
        if (!name || name === 'No Tax') return 0;
        const rate = (localTaxRates || []).find(r => r.name === name);
        return rate ? Number(rate.amount) || 0 : 0;
      };

      let totalIncludedTax = 0;
      let totalCost = 0;
      const saleItems = expandCartForSale(cart).map(item => {
        const taxPercent = getPercent(item.retailTaxRate || item.taxRateName);
        const totalPrice = parseFloat(item.price || 0);
        const quantity = parseInt(item.quantity) || 1;
        const unitPrice = totalPrice / quantity;
        // Retail prices are tax-inclusive: tax component = inc * rate / (100 + rate)
        const itemTaxIncluded = taxPercent > 0 ? (totalPrice * taxPercent / (100 + taxPercent)) : 0;
        totalIncludedTax += itemTaxIncluded;
        totalCost += (parseFloat(item.unitCost) || 0) * (quantity || 1);
        return {
          productName: item.name || item.productName || 'Unknown Product',
          description: item.description || '',
          quantity: quantity,
          unitPrice: unitPrice,
          totalPrice: totalPrice,
          discount: getItemDiscount(item),
          tax: itemTaxIncluded,
          productId: item.productId || item.id || null
        };
      });

      const saleData = {
        totalAmount: parseFloat(cartTotal),
        // basePrice is the COGS column: a cart with no item costs is zero cost,
        // not the ex-tax sell total (that reported a ~100% gross margin as ~0%).
        basePrice: parseFloat(totalCost) || 0,
        savings: parseFloat(savings),
        discount: parseFloat(discount),
        tax: parseFloat(totalIncludedTax),
        loyaltyValue: loyaltyRedemption?.pointsRedeemed || 0,
        loyaltyPointsRedeemed: loyaltyRedemption?.pointsRedeemed || 0,
        paymentMethod: 'Parked',
        balance: parseFloat(cartTotal),
        status: 'PARKED',
        isReturned: false,
        isDiscounted: parseFloat(discount) > 0,
        customerId: selectedCustomer?.id || null,
        outletId: getEffectiveOutletId(), // Send outletId for loyalty calculation
        registerId: (localStorage.getItem('selectedRegisterId') ? parseInt(localStorage.getItem('selectedRegisterId')) : null),
        notes: parkNote,
        items: saleItems,
        payments: []
      };

      await salesService.parkSale(saleData);

      saleEpochRef.current++;
      setCart([]);
      setPayments([]);
      setSelectedCustomer(null);
      setCurrentParkedSaleId(null);
      setLoyaltyRedemption(null);
      setLoyaltyCalculation(null);
      await loadParkedSales();
      
      alert('Sale parked successfully!');
    } catch (error) {
      console.error('Error parking sale:', error);
      alert('Failed to park sale. Please try again.');
    }
  };

  // Resume a parked sale
  // Merge Sale (reference: Parking / Holding Sales) — combine the CURRENT cart
  // into an existing parked sale. The sale stays parked; items and totals are
  // replaced with the combined cart; the register cart is then cleared.
  const mergeIntoParkedSale = async (parkedSale) => {
    if (cart.length === 0) { alert('Add items to the current sale before merging.'); return; }
    const ok = await confirm(
      `Merge the current ${cart.length} item${cart.length === 1 ? '' : 's'} into parked sale ${parkedSale.saleNumber}?`,
      { title: 'Merge Sale', confirmText: 'Merge Sale' }
    );
    if (!ok) return;
    try {
      const parkedLines = (parkedSale.items || []).map((it) => ({
        productName: it.productName,
        description: it.description || null,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice,
        discount: it.discount || 0,
        tax: it.tax || 0,
        taxName: it.taxName || null,
        normalPrice: it.normalPrice ?? null,
        savings: it.savings ?? null,
        comboName: it.comboName || null,
        comboSets: it.comboSets || null,
        productId: it.productId || null,
      }));
      const cartLines = expandCartForSale(cart).map((item) => {
        const qty = parseFloat(item.quantity) || 1;
        const total = parseFloat(item.price) || 0;
        return {
          productName: item.name,
          quantity: qty,
          unitPrice: item.unitPrice != null ? parseFloat(item.unitPrice) : total / qty,
          totalPrice: total,
          discount: getItemDiscount(item) || 0,
          tax: 0, // banked at completion from the live cart totals
          comboName: item.comboName || null,
          comboSets: item.comboSets || null,
          productId: item.productId || null,
        };
      });
      const combined = [...parkedLines, ...cartLines];
      const combinedTotal = combined.reduce((s, l) => s + (Number(l.totalPrice) || 0), 0);
      await salesService.updateSale(parkedSale.id, {
        status: 'PARKED',
        items: combined,
        totalAmount: combinedTotal,
      });
      setCart([]);
      setSelectedCartItem(null);
      await loadParkedSales();
      notify(`Merged into ${parkedSale.saleNumber} — new total $${combinedTotal.toFixed(2)}`);
    } catch (error) {
      console.error('Error merging into parked sale:', error);
      alert('Failed to merge into the parked sale.');
    }
  };

  // Remove Parked Sale (reference: confirm, then the held sale is discarded).
  const removeParkedSale = async (parkedSale) => {
    const ok = await confirm(
      `Remove parked sale ${parkedSale.saleNumber} ($${Number(parkedSale.totalAmount || 0).toFixed(2)})?`,
      { title: 'Remove Parked Sale', confirmText: 'Remove', severity: 'warning' }
    );
    if (!ok) return;
    try {
      await salesService.updateSale(parkedSale.id, { status: 'CANCELLED' });
      await loadParkedSales();
      notify(`Parked sale ${parkedSale.saleNumber} removed`);
    } catch (error) {
      console.error('Error removing parked sale:', error);
      alert('Failed to remove the parked sale.');
    }
  };

  const resumeParkedSale = async (parkedSale) => {
    const ok = await ensureRegisterControl({ force: true });
    if (!ok) return;

    if (cart.length > 0) {
      const confirmResume = await confirm(
        'You have items in your current cart. Resuming this parked sale will replace them.',
        { title: 'Replace current sale', confirmText: 'Resume parked sale' }
      );
      if (!confirmResume) return;
    }

    try {
      const resumedItems = parkedSale.items.map(item => {
        // Resolve the product from the local catalog to restore COGS — the
        // parked line stores the sale-time tax NAME but not the unit cost.
        const localProduct = item.productId
          ? resolveProductLocal(item.productId, item.productName)
          : null;
        const qty = parseFloat(item.quantity) || 1;
        return {
          id: `resumed-${item.id}`,
          // Keep the real productId - the completion PUT posts these lines back
          // and stock matching by name alone hits wrong-outlet duplicates.
          productId: item.productId || null,
          name: item.productName,
          price: item.totalPrice,
          quantity: item.quantity,
          timestamp: Date.now(),
          action: 'resume-parked-sale',
          unitPrice: item.unitPrice,
          description: item.description,
          // Restore what buildSaleBody needs so the resumed completion banks
          // REAL figures — without these a resumed sale completed with tax=$0
          // (GST under-banked, closure tax breakdown showed "No Tax") and
          // basePrice/COGS=0 (profit reports showed 100% margin).
          retailTaxRate: item.taxName || localProduct?.retailTaxRate || null,
          discount: item.discount || 0,
          unitCost: localProduct
            ? getUnitCost(localProduct, qty > 0 ? (parseFloat(item.totalPrice) || 0) / qty : 0)
            : 0,
          // Receipt columns survive the resume round-trip:
          normalPrice: item.normalPrice ?? null,
          comboName: item.comboName || null,
          comboSets: item.comboSets || null,
          note: item.note || null
        };
      });

      setCart(resumedItems);
      
      // Set customer if available
      if (parkedSale.customer) {
        setSelectedCustomer(parkedSale.customer);
      }

      // Track the parked sale ID for completion
      setCurrentParkedSaleId(parkedSale.id);

      // Log security event: Unparked Sale (items added from parked sale to cart)
      try {
        const registerId = localStorage.getItem('selectedRegisterId')
          ? parseInt(localStorage.getItem('selectedRegisterId'))
          : null;

        await securityReportService.logEvent(
          'Unparked Sale',
          null,
          {
            saleId: parkedSale.id,
            saleNumber: parkedSale.saleNumber,
            itemsCount: resumedItems.length,
          },
          registerId
        );
      } catch (error) {
        console.error('Failed to log Unparked Sale security event:', error);
      }
      setActiveTab('sales-keys');
      alert('Parked sale resumed! You can now continue with the sale.');
    } catch (error) {
      console.error('Error resuming parked sale:', error);
      alert('Failed to resume parked sale. Please try again.');
    }
  };


  // Invoice numbers come off the register's own sequence (Setup > Registers > Invoice
  // Number), printed zero-padded to 8 digits like the reference ("00034066"). The till
  // takes the number, prints it, and posts it with the sale; the server stores it and
  // pushes the register's counter past it.
  const takeInvoiceNumber = () => {
    const next = parseInt(selectedRegister?.invoiceNumber);
    if (!(next > 0)) return null;
    setSelectedRegister((prev) => (prev ? { ...prev, invoiceNumber: next + 1 } : prev));
    return next;
  };
  // Zero-padded to the "Invoice number length" setting (Setup > General).
  const formatInvoiceNo = (n) => settingsService.padInvoice(n);

  const generateReceipt = (txnId, finalPayments, cartTotal, precomputedChange, invoiceNumber = null) => {
    // Ensure all payments are included, including "On Account" payments
    const receiptPayments = finalPayments.map(payment => ({
      ...payment,
      method: payment.method || payment.paymentMethod || 'Cash',
      amount: parseFloat(payment.amount) || 0,
      description: payment.description || payment.method || payment.paymentMethod || 'Cash'
    }));
    
    console.log('[Receipt] Generating receipt with payments:', receiptPayments);
    console.log('[Receipt] Payment methods:', receiptPayments.map(p => p.method));
    
    // Calculate surcharge totals from cart items
    const surchargeSummary = {};
    let totalSurcharge = 0;
    
    expandCartForSale(cart).forEach((item) => {
      const price = parseFloat(item.price) || 0;
      const qty = parseFloat(item.quantity) || 1;

      if (item.productId) {
        const product = item.product || { id: item.productId, name: item.name };
        const { totalExtra, byName } = calculateSurchargeBreakdown(product, qty, price);
        
        totalSurcharge += totalExtra;
        
        // Aggregate surcharges by name
        Object.entries(byName).forEach(([name, amount]) => {
          surchargeSummary[name] = (surchargeSummary[name] || 0) + amount;
        });
      }
    });
    
    // Calculate change (should be 0 for "On Account" payments)
    const calculatedChange = typeof precomputedChange === 'number' ? precomputedChange : calculateChange(finalPayments, cartTotal);
    
    // Calculate base subtotal (without surcharges)
    const baseSubtotal = cart.reduce((sum, item) => {
      return sum + (parseFloat(item.price) || 0);
    }, 0);
    
    // Outlet for the receipt header (store name / address / phone / email / ABN).
    // selectedRegister carries its outlet during a live session, but a page reload
    // restores the register from localStorage as {id,name,status} with NO outlet —
    // which is why the header used to print bare. Fall back to the outlets cache
    // (matched by effective outlet id), any loaded register's outlet, then the
    // signed-in user's outlet. Null only when no source has it (renderer omits it).
    const eoid = getEffectiveOutletId();
    const outlet =
      (selectedRegister?.outlet?.name && selectedRegister.outlet) ||
      outlets.find((o) => Number(o.id) === Number(eoid)) ||
      availableRegisters.find((r) => r.outlet?.name)?.outlet ||
      user?.outlet ||
      selectedRegister?.outlet ||
      null;

    // Loyalty summary for the loyalty receipt component (null-safe: omitted when no data).
    const earned = loyaltyCalculation?.totalPointsEarned ?? 0;
    const spent = loyaltyRedemption?.pointsRedeemed ?? 0;
    const beforeSale = selectedCustomer?.loyaltyPoints;
    let loyalty = null;
    if (selectedCustomer && (earned || spent || beforeSale != null)) {
      const before = beforeSale != null ? beforeSale : null;
      const after = before != null ? before + earned - spent : null;
      loyalty = {
        currentPoints: after,
        earned,
        spent,
        beforeSale: before,
        afterSale: after,
      };
    }

    // Account block for the receipt: the customer's on-account balance. The real
    // field is currentOwing (accountBalance never existed on the customer object,
    // which is why this rendered blank). Supply every key the editor's account
    // component exposes (start/end/changed/current); an "On Account" tender on this
    // sale increases what the customer owes. Null when no balance is known so the
    // block stays hidden rather than printing fabricated zeros.
    const acctStart = selectedCustomer && (selectedCustomer.currentOwing ?? selectedCustomer.accountBalance) != null
      ? parseFloat(selectedCustomer.currentOwing ?? selectedCustomer.accountBalance) || 0
      : null;
    const onAccountCharged = receiptPayments
      .filter((p) => (p.method || p.paymentMethod || '').toLowerCase().includes('account'))
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const account = acctStart != null
      ? {
          startBalance: acctStart,
          balanceChanged: onAccountCharged,
          endBalance: acctStart + onAccountCharged,
          currentBalance: acctStart + onAccountCharged,
        }
      : null;

    // Gift cards tendered on this sale, for the gift_cards receipt component. Sourced
    // from the pending-redemption ref (still populated — redeemPendingGiftCards runs
    // after generateReceipt). Empty array -> the component stays hidden.
    const giftCards = pendingGiftCardRef.current.map((g) => ({
      id: g.code,
      original: g.original,
      amountUsed: g.amount,
      current: g.current,
      expiry: g.expiry,
    }));

    const { savings: saleSavings, discount: saleDiscount } = getCartDiscountTotals(cart);

    const newReceiptData = {
      transactionId: txnId,
      saleNumber: txnId ? '#' + String(txnId).replace(/\D/g, '') : undefined,
      date: new Date().toLocaleString(),
      // The renderer has no product data: resolve the receipt-only fields (case
      // quantity, line discount) here, where the catalog is reachable.
      items: cart.map((item) => {
        // Re-resolve the line's tax against the currently-loaded rates so the
        // receipt's GST equals what the sale banks (saveSaleToHistory resolves the
        // same way). A taxPercent frozen at 0 — an item added before the rates
        // finished loading — no longer silently zeroes the tax out. Falls back to
        // the frozen percent if the rate name can't be resolved right now.
        const lineTotal = parseFloat(item.price) || 0;
        const pct = getTaxRatePercent(item.retailTaxRate || item.taxRateName) || parseFloat(item.taxPercent) || 0;
        return {
          ...item,
          caseQty: item.caseQty ?? getItemsPerCase(resolveProductLocal(item.productId || item.id, item.name) || item),
          discount: getItemDiscount(item),
          savings: lineSavings(item, getItemDiscount(item)),
          taxAmount: pct > 0 ? (lineTotal * pct) / (100 + pct) : 0,
        };
      }),
      payments: receiptPayments,
      discount: saleDiscount,
      savings: saleSavings,
      customer: selectedCustomer,
      outlet: outlet, // Include outlet information for template use
      subtotal: baseSubtotal,
      surcharges: surchargeSummary, // Map of surcharge name -> amount
      surchargeTotal: totalSurcharge, // Total surcharge amount
      total: cartTotal, // Includes surcharges
      change: calculatedChange,
      loyalty, // Loyalty points summary (null when unavailable)
      account, // Customer account summary (null when unavailable)
      giftCards, // Gift cards tendered on this sale (empty array -> component hidden)
      // Fields the template expression language resolves ({invoiceNo}, {user.name},
      // {register.name}, {format(completedAt, ...)}) — see utils/receiptExpressions.js.
      invoiceNo: formatInvoiceNo(invoiceNumber) || (txnId ? String(txnId).replace(/^#/, '') : ''),
      completedAt: new Date().toISOString(),
      user: user ? { name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || user.name || '' } : null,
      register: selectedRegister ? { name: selectedRegister.name } : null,
      template: selectedTemplate || { type: 'Normal', config: { layout: 'normal' } }
    };
    
    console.log('[Receipt] Receipt data created:', {
      transactionId: txnId,
      paymentsCount: receiptPayments.length,
      total: cartTotal,
      change: calculatedChange,
      hasOnAccount: receiptPayments.some(p => (p.method || '').toLowerCase().includes('account'))
    });
    
    // Set receipt data and show dialogs. The ref carries the SAME object to callers that
    // run before React commits the state (auto-email fires from the save promise, where
    // `receiptData` is still the previous sale's).
    lastReceiptRef.current = newReceiptData;
    setReceiptData(newReceiptData);

    // ponytail: autoPrintReceipt (group flag) — print automatically for members of a group
    // that opts in, instead of waiting for the manual Print click. The on-screen receipt must
    // be mounted first (printReceipt reuses its emotion styles), so print a tick after showing it.
    // Also honour the payment-method "Always Print Receipt" flag (Setup > Payment Methods).
    const methodAutoPrint = receiptPayments.some((p) => {
      const rec = availablePaymentMethods.find((m) => m.name === (p.method || p.paymentMethod));
      return getPaymentMethodSettings(rec).alwaysPrintReceipt === true;
    });

    // "Always Open Cash Drawer" (Setup > Payment Methods): whether the drawer should
    // always open when this method is used during a sale. Was stored but never read.
    const methodOpensDrawer = receiptPayments.some((p) => {
      const rec = availablePaymentMethods.find((m) => m.name === (p.method || p.paymentMethod));
      return getPaymentMethodSettings(rec).alwaysOpenCashDrawer === true;
    });
    if (methodOpensDrawer) {
      const registerId = parseInt(localStorage.getItem('selectedRegisterId'), 10);
      if (registerId) {
        cashManagementService
          .openDrawer({ registerId, reason: 'Payment method setting' })
          .catch((e) => console.warn('[CashDrawer] auto-open failed:', e?.message || e));
      }
    }
    // A refund/return sale (negative total) auto-prints per the register's
    // "Print receipt on refund" setting (Settings > Registers, default on); toggling
    // it off suppresses the automatic print. Non-refund sales use the group/method flags.
    const isRefund = cartTotal < 0;
    const printOnRefund = registerSettings?.printReceiptOnRefund !== false;
    const autoPrint = isRefund
      ? printOnRefund
      : Boolean(selectedCustomer?.customerGroup?.autoPrintReceipt) || methodAutoPrint;

    // Use setTimeout to ensure state updates are processed
    setTimeout(() => {
      setShowReceipt(true);
      setShowPrintDialog(true);
      console.log('[Receipt] Receipt dialog should now be visible');
      if (autoPrint) {
        setTimeout(() => {
          try { printReceipt(newReceiptData); } catch (e) { console.warn('[Receipt] Auto-print failed:', e?.message || e); }
        }, 150);
      }
    }, 50);
  };

  // Receipt rendering is now handled by ReceiptRenderer component
  // All render functions removed - using ReceiptRenderer component instead
  // Print functions are kept below for printing functionality

  const printReceipt = (receiptData) => {
    const template = selectedTemplate || { type: 'Normal', config: { layout: 'normal' } };
    // Single source of truth: print the exact same component the screen renders.
    // Emotion CSS for these classes is already in document.head (the on-screen receipt is mounted).
    const markup = renderToStaticMarkup(
      <ReceiptRenderer receiptData={receiptData} template={template} />
    );
    const headStyles = Array.from(document.querySelectorAll('style'))
      .map((n) => n.outerHTML)
      .join('\n');
    const html = buildReceiptPrintHtml({
      markup,
      headStyles,
      template,
      title: `Receipt - ${receiptData.transactionId}`,
    });
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      return;
    }
    // Auto-print (Always Print Receipt / customer-group flag) fires from a timeout, so the
    // popup blocker kills window.open. Fall back to a hidden iframe — same output, no popup.
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(frame);
    frame.contentDocument.write(html);
    frame.contentDocument.close();
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 1000);
  };

  const calculateChange = (finalPayments, cartTotal) => {
    const totalPaid = finalPayments.reduce((sum, payment) => {
      const paymentAmount = parseFloat(payment.amount) || 0;
      return sum + paymentAmount;
    }, 0);
    const total = parseFloat(cartTotal) || 0;
    const difference = totalPaid - total;
    return Math.max(0, difference);
  };

  const handlePrintReceipt = () => {
    if (receiptData) {
      printReceipt(receiptData);
      setShowPrintDialog(false);
    }
  };

  const handleEmailReceipt = async () => {
    if (!receiptData) return;
    if (!lastSaleId) {
      // The sale hasn't finished persisting (or its save failed) — no id to email against.
      alert('This sale is still saving. Please try again in a moment.');
      return;
    }
    // Recipient: the attached customer's email, else ask. ponytail: the single-field
    // prompt keeps this honest without duplicating PrintReceiptDialog's chip-capture UI
    // here — swap in that dialog if multi-recipient entry is ever needed on this screen.
    const customerEmail = (Array.isArray(selectedCustomer?.emails) ? selectedCustomer.emails.find(Boolean) : null)
      || selectedCustomer?.email || '';
    const entered = await prompt('Email receipt to:', customerEmail, { title: 'Email receipt', confirmText: 'Send' });
    if (entered == null) return; // cancelled
    const email = entered.trim();
    if (!email) return;

    try {
      // The receipt on screen IS the email body — same components, rendered to HTML here.
      await emailSaleReceipt({
        saleId: lastSaleId,
        receiverEmails: [email],
        senderEmail: selectedRegister?.outlet?.email || undefined,
        receiptData,
      });
    } catch (e) {
      console.error('[Receipt] Email failed:', e);
      alert('Failed to email the receipt. The sale is still open — please try again.');
      return; // keep the receipt on screen so the cashier can retry
    }

    alert(`Receipt emailed to ${email}`);
    setShowPrintDialog(false);
    // Reset the sale only after a successful send.
    setTimeout(() => {
      // New epoch, or completeTransaction's idempotency guard still holds this
      // epoch and silently skips the NEXT sale's completion.
      saleEpochRef.current++;
      setCart([]);
      setPayments([]);
      setSelectedCustomer(null);
      setIsTransactionComplete(false);
      setShowReceipt(false);
      setTransactionId(null);
      setReceiptData(null);
      setLoyaltyRedemption(null);
      setLoyaltyCalculation(null);
      setCurrentParkedSaleId(null);
      setLastSaleId(null);
      console.log('[Transaction] Sale reset after emailing receipt');
    }, 500);
  };

  const handleClosePrintDialog = () => {
    setShowPrintDialog(false);
  };

  const calculateTotal = () => {
    if (!cart || !Array.isArray(cart)) return 0;
    let baseTotal = 0;
    let surchargeTotal = 0;

    // Expanded so a combo line's member products still carry their surcharges.
    // Member prices sum back to the combo line total, so baseTotal is unchanged.
    expandCartForSale(cart).forEach((item) => {
      const price = parseFloat(item.price) || 0;
      const qty = parseFloat(item.quantity) || 1;
      baseTotal += price;

      // Recompute surcharge for this line based on current product + quantity
      if (item.productId) {
        const product = item.product || { id: item.productId, name: item.name };
        const { totalExtra, byName } = calculateSurchargeBreakdown(
          product,
          qty,
          price,
        );

        surchargeTotal += totalExtra;

        item.surchargeBreakdown = byName;
      }
    });

    const grandTotal = baseTotal + surchargeTotal;
    return isNaN(grandTotal) ? 0 : grandTotal;
  };

  const calculateTotalPayments = () => {
    if (!payments || !Array.isArray(payments)) return 0;
    const total = payments.reduce((total, payment) => {
      const amount = parseFloat(payment.amount) || 0;
      return total + amount;
    }, 0);
    return isNaN(total) ? 0 : total;
  };

  const calculateRemainingBalance = () => {
    const total = calculateTotal();
    const totalPayments = calculateTotalPayments();
    const balance = total - totalPayments;
    return isNaN(balance) ? 0 : balance;
  };

  const handleRemoveItem = async (itemToRemove) => {
    // Reference guard: with payments on the sale, deleting the LAST product is
    // blocked with a warning toast (measured wording).
    if (payments.length > 0 && cart.length === 1) {
      setSaleWarning('Remove all payments before you remove the last product');
      return;
    }
    const ok = await ensureRegisterControl();
    if (!ok) return;

    const productName = itemToRemove?.name || itemToRemove?.productName || 'Unknown Product';
    const quantity = itemToRemove?.quantity ?? 1;

    setCart(prev => {
      const updatedCart = prev.filter(item => 
        !(item.id === itemToRemove.id && item.timestamp === itemToRemove.timestamp)
      );
      return updatedCart;
    });
    
    if (selectedCartItem && 
        selectedCartItem.id === itemToRemove.id && 
        selectedCartItem.timestamp === itemToRemove.timestamp) {
      setSelectedCartItem(null);
    }

    try {
      const registerId = localStorage.getItem('selectedRegisterId')
        ? parseInt(localStorage.getItem('selectedRegisterId'))
        : null;

      await securityReportService.logEvent(
        'Removed Product',
        null,
        {
          productName,
          quantity,
        },
        registerId
      );
    } catch (error) {
      console.error('Failed to log Removed Product security event:', error);
    }
  };

  const handleOpenQuantityKeypad = (item, e) => {
    e.stopPropagation();
    setQuantityKeypadItem(item);
    setKeypadValue(String(item.quantity || 1));
    setKeypadAnchorEl(e.currentTarget);
    setShowQuantityKeypad(true);
  };

  const handleOpenProductDetail = async (item, e) => {
    e.stopPropagation();
    if (!item.productId) return;
    const productData = resolveProductLocal(item.productId, item.name);
    if (productData) {
      setSelectedProductDetail(productData);
      setProductDetailCartItem(item);
      setShowDetailCosts(false);
      setProductDetailExpanded({ prices: false, additionalFields: false, purchases: false, inventory: false });
      setShowProductDetail(true);
    }
  };

  // Product flag "Prevent Manual Discounts". Read from the local catalog rather than
  // the cart line so a cart restored from localStorage (or added by any of the add
  // paths) is covered by the same rule.
  const isManualDiscountBlocked = (item) =>
    !!(item?.productId && resolveProductLocal(item.productId, item.name)?.preventManualDiscounts);

  const handleDiscountConfirm = async (updatedItem) => {
    // ponytail: the flag blocks the whole manual price editor (overrides included),
    // which is what "no manual discounts" means on the sell screen.
    if (isManualDiscountBlocked(updatedItem)) {
      alert(`Manual discounts are not allowed for ${updatedItem.name}.`);
      return;
    }

    // Setup > General: "Discounts Require Reason". One gate here covers the line
    // editor AND the configured apply-discount sale key (both land in this call).
    const discountAmount = Number(updatedItem?.discountInfo?.discountAmount) || 0;
    if (generalSettings.discountsRequireReason && discountAmount > 0 && !updatedItem?.discountInfo?.reason) {
      const reason = await askReason({
        title: 'Reason for Discount',
        label: 'Discount reason',
        options: generalSettings.predefinedDiscountReasons || [],
      });
      if (!reason) return; // no reason, no discount
      updatedItem = { ...updatedItem, discountInfo: { ...updatedItem.discountInfo, reason } };
    }

    const itemIndex = cart.findIndex(
      item => item.id === updatedItem.id && item.timestamp === updatedItem.timestamp
    );

    if (itemIndex !== -1) {
      const updatedCart = [...cart];
      updatedCart[itemIndex] = {
        ...updatedCart[itemIndex],
        productId: updatedCart[itemIndex].productId || updatedItem.productId, // Preserve productId
        price: updatedItem.price,
        discountInfo: updatedItem.discountInfo,
      };
      setCart(updatedCart);

      // Update selected cart item if it's the same item
      if (selectedCartItem && 
          selectedCartItem.id === updatedItem.id && 
          selectedCartItem.timestamp === updatedItem.timestamp) {
        setSelectedCartItem(updatedCart[itemIndex]);
      }
    }
  };

  const handleUpdateQuantityFromKeypad = async () => {
    const newQuantity = parseFloat(keypadValue);
    
    if (!newQuantity || newQuantity <= 0 || !quantityKeypadItem) {
      setShowQuantityKeypad(false);
      return;
    }

    const ok = await ensureRegisterControl();
    if (!ok) {
      setShowQuantityKeypad(false);
      return;
    }

    const itemIndex = cart.findIndex(item => 
      item.id === quantityKeypadItem.id && item.timestamp === quantityKeypadItem.timestamp
    );

    if (itemIndex !== -1) {
      const item = cart[itemIndex];
      
      console.log('=== Updating Quantity ===');
      console.log('Item:', item.name, 'Product ID:', item.productId);
      console.log('Old quantity:', item.quantity, 'New quantity:', newQuantity);
      console.log('Old price:', item.price);

      const productData = item.productId ? resolveProductLocal(item.productId, item.name) : null;
      const priced = priceLineForQuantity(productData, newQuantity, item);
      // Keep the totals numeric (every other path stores a number; a string here
      // broke strict-equality dedupe checks on re-add).
      const toMoney = (value) =>
        !isNaN(value) && isFinite(value) ? Math.round(Number(value) * 100) / 100 : 0;
      const newPrice = toMoney(priced.price);
      console.log('Final new price:', newPrice);
      console.log('=== End Update ===');

      const updatedItem = {
        ...item,
        quantity: newQuantity,
        ...priced,
        price: newPrice,
        normalPrice: priced.normalPrice != null ? toMoney(priced.normalPrice) : undefined
      };

      const updatedCart = [...cart];
      updatedCart[itemIndex] = updatedItem;
      setCart(updatedCart);
      
      if (selectedCartItem && 
          selectedCartItem.id === item.id && 
          selectedCartItem.timestamp === item.timestamp) {
        setSelectedCartItem(updatedItem);
      }
    }

    setShowQuantityKeypad(false);
    setQuantityKeypadItem(null);
    setKeypadValue('');
    setKeypadAnchorEl(null);
  };

  const isPromotionActive = (promotion) => {
    if (!promotion) return false;
    
    if (promotion.isActive === false || promotion.isActive === 0) {
      console.log(`Promotion ${promotion.name || promotion.id}: isActive flag is false`);
      return false;
    }
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    console.log('promotion',promotion)
    if (promotion.startDate) {
      const startDateStr = promotion.startDate;
      const startDate = new Date(startDateStr);
      const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      
      if (today < startDateOnly) {
        console.log(`Promotion ${promotion.name || promotion.id}: Not started yet. Start date: ${startDateOnly.toDateString()}, Today: ${today.toDateString()}`);
        return false;
      }
    }
    
    if (promotion.endDate) {
      const endDateStr = promotion.endDate;
      const endDate = new Date(endDateStr);
      const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      
      if (today > endDateOnly) {
        console.log(`Promotion ${promotion.name || promotion.id}: Already expired. End date: ${endDateOnly.toDateString()}, Today: ${today.toDateString()}`);
        return false;
      }
    }
    
    console.log(`Promotion ${promotion.name || promotion.id}: Is active (passed date checks)`);
    return true;
  };

  /** Read promotions from IndexedDB memory — never calls the API. */
  // COMBO DEAL DATA CONTRACT (Marketing > Promotions, promotionType 'Combo Deal'):
  // Active combo promotions arrive here via posLocalDb.getPromotions() like any
  // other promotion (posCatalogSync already syncs promotions and combos — no
  // extra sync needed). A combo promotion carries its canonical definition in
  // promotion.conditions.combo:
  //   { comboId, comboPrice, totalQuantity,
  //     items: [{ productId, productName, quantity, unitPrice }] }
  // The sell-screen combo engine (applyComboDealsToCart below) filters
  // p.promotionType === 'Combo Deal' && isPromotionActive(p), computes
  // sets = min over combo.items of floor(cartQty[productId] / item.quantity),
  // prices each complete set at combo.comboPrice and the remainder at normal
  // price. Do NOT run these through the per-product calculatePromotionPrice()
  // path — combo deals intentionally have no conditions.criteria.
  //
  // F5 SECOND INPUT SOURCE — PRODUCT COMBOS (Stock Management > Product Combos):
  // The engine also consumes activeCombos (hydrated by hydrateActiveCombos from
  // posLocalDb.getCombos() + a silent API refresh). API shape:
  //   { id, name, comboPrice, isActive, outletId,
  //     items: [{ productId, quantity, product }] }
  // Both sources are normalized to { comboId, comboPrice, items } definitions.
  // A Combo Deal promotion that references a Product Combo (conditions.combo
  // .comboId) SUPERSEDES that combo so the same set is never discounted twice.
  const hydrateActivePromotionsFromLocal = () => {
    const outletId = getOutletIdForPromotions();
    let promos = posLocalDb.getPromotions();
    if (outletId != null) {
      const oid = Number(outletId);
      promos = promos.filter(
        (p) => p.outletId == null || Number(p.outletId) === oid
      );
    }
    const active = promos.filter((p) => isPromotionActive(p));
    if (active.length) {
      setActivePromotions(active);
    }
    return active;
  };

  // F5: hydrate Product Combos for the sell-screen pricing engine.
  // Reads the IndexedDB cache first (instant, offline-safe), then silently
  // refreshes from the API because posCatalogSync only re-syncs when the
  // catalog is >5 min stale — without this a freshly created combo would be
  // invisible on the sell screen until the next full sync.
  // Keep only combos that are active, priced, have items, and belong to the
  // current outlet (or are outlet-agnostic).
  const normalizeActiveCombos = (list, outletId) =>
    (list || []).filter(
      (c) =>
        c &&
        c.isActive !== false &&
        Array.isArray(c.items) &&
        c.items.length > 0 &&
        (c.outletId == null || outletId == null || Number(c.outletId) === Number(outletId)) &&
        (parseFloat(c.comboPrice ?? c.totalPrice) || 0) > 0
    );

  const hydrateActiveCombos = async (outletOverride) => {
    const outletId = outletOverride ?? getOutletIdForPromotions();
    setActiveCombos(normalizeActiveCombos(posLocalDb.getCombos(), outletId));
    const seq = ++comboFetchSeqRef.current;
    try {
      // status/limit are the params the API actually consumes (isActive is
      // ignored server-side; default limit is 50). A successful response is
      // authoritative — it also clears combos deleted since the last catalog
      // sync so they stop repricing the cart.
      const res = await productComboService.getProductCombos({
        outletId,
        status: 'Active',
        limit: 500,
      });
      if (seq !== comboFetchSeqRef.current) return; // a newer hydrate superseded this one
      combosConfirmedRef.current = true;
      setActiveCombos(normalizeActiveCombos(res?.combos || [], outletId));
    } catch {
      // Offline / API error — keep whatever the local cache provided.
    }
  };

  // F4/F5 sell-screen combo engine (see COMBO DEAL DATA CONTRACT above).
  // Reprices cart lines so every complete set of an active Combo Deal
  // promotion OR Product Combo is charged at its combo price, with remainder
  // units at normal price (e.g. a 7-item combo + an 8th item = combo price +
  // 1 normal single; 2 full sets = 2x combo price).
  // Pure in its inputs (promos + combos are passed in, not closed over) and
  // idempotent: returns the repriced cart array, or null when nothing changed.
  const applyComboDealsToCart = (cartItems, promos, combos) => {
    // Source 1: Marketing > Promotions, promotionType 'Combo Deal'.
    const promoDefs = (promos || [])
      .filter(
        (p) =>
          p.promotionType === 'Combo Deal' &&
          isPromotionActive(p) &&
          p.conditions?.combo &&
          Array.isArray(p.conditions.combo.items) &&
          p.conditions.combo.items.length > 0
      )
      .map((p) => ({
        comboId: p.conditions.combo.comboId ?? null,
        comboPrice: parseFloat(p.conditions.combo.comboPrice) || 0,
        items: p.conditions.combo.items,
      }));

    // Source 2: Product Combos. A promotion referencing the same combo wins,
    // so the same set is never discounted twice.
    const promoComboIds = new Set(
      promoDefs.map((d) => d.comboId).filter((id) => id != null).map(String)
    );
    const comboDefs = (combos || [])
      .filter(
        (c) =>
          c &&
          c.isActive !== false &&
          !promoComboIds.has(String(c.id)) &&
          Array.isArray(c.items) &&
          c.items.length > 0 &&
          (parseFloat(c.comboPrice ?? c.totalPrice) || 0) > 0
      )
      .map((c) => ({
        comboId: c.id,
        comboPrice: parseFloat(c.comboPrice ?? c.totalPrice) || 0,
        items: c.items.map((i) => ({
          productId: i.productId ?? i.product?.id,
          quantity: i.quantity,
        })),
      }));

    const allDefs = [...promoDefs, ...comboDefs];

    // Recover each line's pre-combo (normal) price. If the line still carries
    // the exact price this engine last set, restore the stored base; any other
    // price means it was recomputed elsewhere (quantity change, manual edit)
    // and IS the new base.
    const lines = cartItems.map((item) => {
      const price = parseFloat(item.price) || 0;
      const base =
        item.comboDeal && item.comboDeal.appliedPrice === item.price
          ? item.comboDeal.basePrice
          : price;
      return { item, base, discount: 0 };
    });

    if (allDefs.length) {
      // Quantity available per product; combos consume from this pool so
      // overlapping combos never discount the same units twice.
      const remainingQty = {};
      lines.forEach(({ item }) => {
        if (item.productId == null) return;
        const pid = String(item.productId);
        remainingQty[pid] = (remainingQty[pid] || 0) + (parseFloat(item.quantity) || 1);
      });

      // Actual per-unit normal price of a product as it sits in the cart.
      const unitPriceOf = (pid) => {
        let qty = 0;
        let total = 0;
        lines.forEach((l) => {
          if (l.item.productId == null || String(l.item.productId) !== String(pid)) return;
          qty += parseFloat(l.item.quantity) || 1;
          total += l.base;
        });
        return qty > 0 ? total / qty : 0;
      };

      allDefs.forEach((combo) => {
        const comboPrice = combo.comboPrice;

        // sets = min over combo items of floor(cartQty / item.quantity)
        let sets = Infinity;
        combo.items.forEach((ci) => {
          const need = Math.max(1, parseFloat(ci.quantity) || 1);
          const have = remainingQty[String(ci.productId)] || 0;
          sets = Math.min(sets, Math.floor(have / need));
        });
        if (!isFinite(sets) || sets <= 0) return;

        let normalSetPrice = 0;
        combo.items.forEach((ci) => {
          const need = Math.max(1, parseFloat(ci.quantity) || 1);
          normalSetPrice += need * unitPriceOf(ci.productId);
        });

        const totalDiscount = Math.max(0, (normalSetPrice - comboPrice) * sets);
        if (normalSetPrice <= 0 || totalDiscount <= 0) return;

        // Allocate the discount across combo products proportionally to their
        // normal-price share of the set (last product absorbs rounding), then
        // across that product's cart lines without pushing a line negative.
        let allocated = 0;
        combo.items.forEach((ci, idx) => {
          const need = Math.max(1, parseFloat(ci.quantity) || 1);
          const share =
            idx === combo.items.length - 1
              ? totalDiscount - allocated
              : Math.round(((need * unitPriceOf(ci.productId)) / normalSetPrice) * totalDiscount * 100) / 100;
          allocated += share;
          let left = share;
          lines.forEach((l) => {
            if (left <= 0) return;
            if (l.item.productId == null || String(l.item.productId) !== String(ci.productId)) return;
            const capacity = Math.max(0, l.base - l.discount);
            const take = Math.min(left, capacity);
            l.discount += take;
            left -= take;
          });
          remainingQty[String(ci.productId)] =
            (remainingQty[String(ci.productId)] || 0) - need * sets;
        });
      });
    }

    let changed = false;
    const next = lines.map(({ item, base, discount }) => {
      if (discount > 0) {
        const newPrice = Math.round((base - discount) * 100) / 100;
        const prev = item.comboDeal;
        if (!prev || prev.basePrice !== base || (parseFloat(item.price) || 0) !== newPrice) {
          changed = true;
        }
        return { ...item, price: newPrice, comboDeal: { basePrice: base, appliedPrice: newPrice } };
      }
      if (item.comboDeal) {
        // Combo no longer applies — restore the normal price.
        changed = true;
        const restored = { ...item, price: base };
        delete restored.comboDeal;
        return restored;
      }
      return item;
    });
    return changed ? next : null;
  };

  // A combo cart line is one line on screen (combo name @ combo price) but must
  // reach the backend as its member products — stock, loyalty and reports all key
  // off productId. The combo price is allocated across members by their share of
  // the normal price; the last member absorbs the rounding so the parts always
  // sum back to the line total.
  const expandCartForSale = (cartItems) =>
    (cartItems || []).flatMap((item) => {
      if (!item.isCombo || !Array.isArray(item.comboItems) || item.comboItems.length === 0) {
        return [item];
      }
      const sets = parseFloat(item.quantity) || 1;
      const lineTotal = parseFloat(item.price) || 0;
      const normalTotal = item.comboItems.reduce((sum, ci) => sum + (parseFloat(ci.normalPrice) || 0), 0);
      // A combo line can be manually discounted (the price editor writes discountInfo
      // on it). The discount is allocated with the price, otherwise it reached no
      // sale_item at all and the reprint showed $0.00 against a discounted total.
      const lineDiscount = getItemDiscount(item);
      let allocated = 0;
      let allocatedDiscount = 0;
      return item.comboItems.map((ci, idx) => {
        const normal = parseFloat(ci.normalPrice) || 0;
        const last = idx === item.comboItems.length - 1;
        // Proportional to the member's share of the normal price; the last member
        // absorbs the rounding so the parts always sum back to the line figure.
        const split = (amount, done) =>
          last
            ? Math.round((amount - done) * 100) / 100
            : Math.round(
                (normalTotal > 0 ? (normal / normalTotal) * amount : amount / item.comboItems.length) * 100
              ) / 100;
        const share = split(lineTotal, allocated);
        allocated += share;
        const discountShare = lineDiscount ? split(lineDiscount, allocatedDiscount) : 0;
        allocatedDiscount += discountShare;
        return {
          id: ci.productId,
          productId: ci.productId,
          name: ci.name,
          description: `Combo: ${item.name}`,
          price: share, // line total for this member across all sets
          quantity: (ci.quantity || 1) * sets,
          unitCost: ci.unitCost,
          retailTaxRate: ci.retailTaxRate,
          taxPercent: ci.taxPercent,
          // Banked with the member so a reprint regroups these back into the ONE
          // combo line the live receipt printed, at the same price and set count.
          comboName: item.name,
          comboSets: sets,
          discount: discountShare,
          normalPrice: normal * sets,
          savings: Math.max(0, normal * sets - share)
        };
      });
    });

  const loadActivePromotionsWithoutOutlet = async () => {
    hydrateActivePromotionsFromLocal();
    hydrateActiveCombos();
  };

  const loadActivePromotions = async () => {
    hydrateActivePromotionsFromLocal();
    hydrateActiveCombos();
  };

  // Get effective outlet ID - prioritizes superadmin selection, then context, then user, then register
  const getEffectiveOutletId = () => {
    // For superadmin, use selected outlet if available
    if (user?.isSuperAdmin && selectedOutlet) {
      return selectedOutlet;
    }
    
    let outletId = getOutletId();
    
    if (!outletId && user?.outletId) {
      outletId = user.outletId;
    }
    
    if (!outletId && selectedRegister?.outletId) {
      outletId = selectedRegister.outletId;
    }
    
    if (!outletId && selectedRegister?.outlet?.id) {
      outletId = selectedRegister.outlet.id;
    }
    
    return outletId;
  };

  const getOutletIdForPromotions = () => {
    return getEffectiveOutletId();
  };

  // Load outlets for superadmin
  const loadOutlets = async () => {
    try {
      const response = await outletService.getAllOutlets();
      setOutlets(response.outlets || []);
    } catch (error) {
      console.error('Error loading outlets:', error);
      setOutlets([]);
    }
  };

  // Load payment methods
  const loadPaymentMethods = async () => {
    const local = posLocalDb.getPaymentMethods();
    if (local.length) {
      setAvailablePaymentMethods(local);
      return;
    }
    try {
      const response = await paymentMethodService.getPaymentMethods({ isActive: true });
      setAvailablePaymentMethods(response.paymentMethods || []);
    } catch (error) {
      console.error('Error loading payment methods:', error);
      setAvailablePaymentMethods([]);
    }
  };

  // Load customer loyalty info
  const loadCustomerLoyaltyInfo = async () => {
    if (!selectedCustomer?.id) return;
    
    try {
      const response = await loyaltyService.getCustomerLoyalty(selectedCustomer.id);
      setCustomerLoyaltyInfo(response.customer);
    } catch (error) {
      console.error('Error loading customer loyalty info:', error);
      setCustomerLoyaltyInfo(null);
    }
  };

  const getFilteredPaymentMethods = () => {
    // A method the register's editor switched off is not offered here (absent
    // from the map = on, so a register with no saved profile keeps them all).
    let methods = availablePaymentMethods.filter(
      (m) => !registerPayments || registerPayments[m.id] !== false
    );

    // Check if customer's group has account sales enabled
    const hasAccountSales = selectedCustomer?.customerGroup?.allowAccountSales || false;
    const hasOnAccountMethod = methods.some(method => 
      method.name?.toLowerCase() === 'on account' || method.type?.toLowerCase() === 'on account'
    );
    
    // Add "On Account" payment method if customer's group allows account sales
    if (hasAccountSales && !hasOnAccountMethod) {
      methods.push({
        id: 'on-account-payment',
        name: 'On Account',
        type: 'On Account',
        isActive: true
      });
    }
    
    // Remove "On Account" if customer doesn't have account sales enabled
    if (!hasAccountSales) {
      methods = methods.filter(method => 
        method.name?.toLowerCase() !== 'on account' && 
        method.type?.toLowerCase() !== 'on account'
      );
    }
    
    const hasLoyaltyMethod = methods.some(method => 
      method.name?.toLowerCase() === 'loyalty' || method.type?.toLowerCase() === 'loyalty'
    );
    
    // If customer has loyalty points, ensure Loyalty method is available
    if (selectedCustomer && customerLoyaltyInfo && customerLoyaltyInfo.loyaltyPoints > 0) {
      if (!hasLoyaltyMethod) {
        // Add Loyalty payment method if it doesn't exist
        methods.push({
          id: 'loyalty-payment',
          name: 'Loyalty',
          type: 'Loyalty',
          isActive: true
        });
      }
    } else {
      // No customer or no loyalty points - exclude Loyalty
      methods = methods.filter(method => 
        method.name?.toLowerCase() !== 'loyalty' && 
        method.type?.toLowerCase() !== 'loyalty'
      );
    }
    
    return methods;
  };

  const tryCompleteSaleIfFullyPaid = (paymentList, { closeFinalizeDialog = false } = {}) => {
    const cartTotal = calculateTotal();
    if (isTransactionComplete || !isSaleFullyPaid(paymentList, cartTotal)) {
      return false;
    }
    if (closeFinalizeDialog) {
      setShowFinalizeDialog(false);
    }
    completeTransaction(paymentList, cartTotal);
    return true;
  };

  // Handle opening finalize dialog
  const handleOpenFinalizeDialog = async () => {
    if (cart.length === 0) {
      alert('Please add items to cart before finalizing sale');
      return;
    }
    // Reload customer loyalty info if customer is selected
    if (selectedCustomer?.id) {
      await loadCustomerLoyaltyInfo();
    }

    // Already paid in full on the sales screen — complete immediately (same as $100 sale key)
    if (tryCompleteSaleIfFullyPaid(payments)) {
      return;
    }

    setShowFinalizeDialog(true);
  };

  // Handle adding payment from finalize dialog
  const handleAddPaymentFromDialog = async (payment) => {
    const newPayment = {
      id: `payment-${crypto.randomUUID()}`,
      amount: parseFloat(payment.amount) || 0,
      method: payment.method,
      timestamp: Date.now(),
      description: payment.description || payment.method,
      reference: payment.reference, // Linkly txnRef (card) / order ref (on account) — persisted to SalePayment.reference
      integrated: payment.integrated === true, // PIN pad charge — blocks clear/cancel until refunded
      eftposReceipt: payment.eftposReceipt || null, // Linkly customer receipt text; printed on the sale receipt
      pointsRedeemed: payment.pointsRedeemed || null // Store points redeemed for loyalty payments
    };

    const cartTotal = calculateTotal();
    const updatedPayments = [...payments, newPayment];
    const shouldCompleteSale = isSaleFullyPaid(updatedPayments, cartTotal);
    
    setPayments(prev => {
      const updatedPayments = [...prev, newPayment];
      
      // If this is a loyalty payment, calculate total loyalty redemption
      if (payment.method?.toLowerCase() === 'loyalty' && selectedCustomer?.id) {
        // If pointsRedeemed is provided directly, use it
        if (payment.pointsRedeemed) {
          // Calculate total loyalty amount and points from all loyalty payments
          const totalLoyaltyAmount = updatedPayments
            .filter(p => p.method?.toLowerCase() === 'loyalty')
            .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
          
          const totalPointsRedeemed = updatedPayments
            .filter(p => p.method?.toLowerCase() === 'loyalty')
            .reduce((sum, p) => sum + (p.pointsRedeemed || 0), 0);
          
          setLoyaltyRedemption({
            pointsRedeemed: totalPointsRedeemed,
            redeemableAmount: totalLoyaltyAmount,
            applied: true
          });
          console.log('[Loyalty Payment] Points set directly:', totalPointsRedeemed, 'for total amount:', totalLoyaltyAmount);
        } else {
          // Fallback: Calculate points from amount
          const totalLoyaltyAmount = updatedPayments
            .filter(p => p.method?.toLowerCase() === 'loyalty')
            .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
          
          if (totalLoyaltyAmount > 0) {
            const outletId = getEffectiveOutletId();
            loyaltyService.calculatePointsForRedemption(totalLoyaltyAmount, outletId)
              .then(pointsResult => {
                if (pointsResult.pointsRequired > 0) {
                  setLoyaltyRedemption({
                    pointsRedeemed: pointsResult.pointsRequired,
                    redeemableAmount: totalLoyaltyAmount,
                    applied: true
                  });
                  console.log('[Loyalty Payment] Total points calculated:', pointsResult.pointsRequired, 'for total amount:', totalLoyaltyAmount);
                }
              })
              .catch(error => {
                console.error('[Loyalty Payment] Error calculating points:', error);
                // Don't block the payment, just log the error
              });
          }
        }
      }
      
      return updatedPayments;
    });

    if (shouldCompleteSale) {
      setShowFinalizeDialog(false);
      setTimeout(() => {
        tryCompleteSaleIfFullyPaid(updatedPayments);
      }, 150);
    }
  };

  // Reverse a payment from the sidebar payment view (reference: the original row
  // greys out and a matching negative row is appended, so the audit trail stays).
  const handleReversePayment = (payment) => {
    if (!payment) return;
    if (payment.integrated) {
      alert('Integrated payments (such as EFTPOS/card) must be refunded on the PIN pad before they can be reversed.');
      return;
    }
    setPayments(prev => {
      const target = prev.find(p => p.id === payment.id);
      if (!target || target.reversed) return prev;
      return [
        ...prev.map(p => (p.id === payment.id ? { ...p, reversed: true } : p)),
        {
          ...target,
          id: `payment-${crypto.randomUUID()}`,
          amount: -(parseFloat(target.amount) || 0),
          timestamp: Date.now(),
          reversalOf: target.id,
          reversed: true,
        },
      ];
    });
    // ponytail: loyalty point bookkeeping is only recalculated on the finalize
    // dialog's remove path; wire it here too if loyalty ever gets a $ sale key.
  };

  // Handle removing payment from finalize dialog
  const handleRemovePaymentFromDialog = (paymentId) => {
    setPayments(prev => {
      const paymentToRemove = prev.find(p => p.id === paymentId);
      const updatedPayments = prev.filter(p => p.id !== paymentId);
      
      // If removing a loyalty payment, clear loyalty redemption
      if (paymentToRemove?.method?.toLowerCase() === 'loyalty') {
        // Check if there are any other loyalty payments
        const hasOtherLoyaltyPayments = updatedPayments.some(p => p.method?.toLowerCase() === 'loyalty');
        if (!hasOtherLoyaltyPayments) {
          setLoyaltyRedemption(null);
          console.log('[Loyalty Payment] Loyalty redemption cleared');
        } else {
          // Recalculate total loyalty redemption if multiple loyalty payments exist
          const totalLoyaltyAmount = updatedPayments
            .filter(p => p.method?.toLowerCase() === 'loyalty')
            .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
          
          if (totalLoyaltyAmount > 0 && selectedCustomer?.id) {
            loyaltyService.calculatePointsForRedemption(totalLoyaltyAmount, getEffectiveOutletId())
              .then(pointsResult => {
                if (pointsResult.pointsRequired > 0) {
                  setLoyaltyRedemption({
                    pointsRedeemed: pointsResult.pointsRequired,
                    redeemableAmount: totalLoyaltyAmount,
                    applied: true
                  });
                }
              })
              .catch(error => {
                console.error('[Loyalty Payment] Error recalculating points:', error);
              });
          }
        }
      }
      
      return updatedPayments;
    });
  };

  // Handle selecting payment method (for special cases like Gift Card)
  const handleSelectPaymentMethodFromDialog = (method) => {
    // Handle special payment methods like Gift Card
    if (method.type === 'Gift Card' || method.name === 'Vii Gift Card') {
      setGiftCardMode('pay'); // redeem a card as a tender, not sell one
      setGiftCardCode('');
      setGiftCardError('');
      setShowGiftCardPopup(true);
      setShowFinalizeDialog(false);
    }
  };

  // Load promotion products based on type (Current, Future, All)
  const loadPromotionProducts = async (type = 'Current') => {
    setLoadingPromotionProducts(true);
    try {
      const outletId = getEffectiveOutletId();
      let promotions = posLocalDb.getPromotions();
      if (outletId != null) {
        const oid = Number(outletId);
        promotions = promotions.filter(
          (p) => p.outletId == null || Number(p.outletId) === oid
        );
      }
      if (!promotions.length) {
        setPromotionProducts([]);
        return;
      }
      
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      let filteredPromotions = [];
      if (type === 'Current') {
        // Show only active promotions (started and not ended)
        filteredPromotions = promotions.filter(p => {
          if (p.isActive === false || p.isActive === 0) return false;
          const startDate = p.startDate ? new Date(p.startDate.split('T')[0]) : null;
          const endDate = p.endDate ? new Date(p.endDate.split('T')[0]) : null;
          if (startDate && startDate > now) return false;
          if (endDate && endDate < now) return false;
          return true;
        });
      } else if (type === 'Future') {
        // Show only future promotions (not started yet)
        filteredPromotions = promotions.filter(p => {
          if (p.isActive === false || p.isActive === 0) return false;
          const startDate = p.startDate ? new Date(p.startDate.split('T')[0]) : null;
          return startDate && startDate > now;
        });
      } else {
        // Show all active promotions
        filteredPromotions = promotions.filter(p => p.isActive !== false && p.isActive !== 0);
      }
      
      // First, collect all productIds that need to be fetched
      const productIdsToFetch = new Set();
      filteredPromotions.forEach(promotion => {
        if (promotion.items && Array.isArray(promotion.items)) {
          promotion.items.forEach(item => {
            if (!item.product && item.productId) {
              productIdsToFetch.add(item.productId);
            }
          });
        }
        if (promotion.conditions && promotion.conditions.criteria) {
          promotion.conditions.criteria.forEach(criterion => {
            if (criterion.items && Array.isArray(criterion.items)) {
              criterion.items.forEach(item => {
                if (!item.product && item.productId && !item.excluded) {
                  productIdsToFetch.add(item.productId);
                }
              });
            }
          });
        }
      });
      
      const fetchedProducts = new Map();
      productIdsToFetch.forEach((productId) => {
        const product = posLocalDb.getProductById(productId);
        if (product) fetchedProducts.set(productId, product);
      });
      
      // Extract products from promotions
      const productMap = new Map();
      
      console.log('Filtered promotions for product list:', filteredPromotions.length, filteredPromotions);
      
      filteredPromotions.forEach(promotion => {
        console.log(`Processing promotion: ${promotion.name} (type: ${promotion.promotionType})`);
        console.log('Promotion items:', promotion.items);
        console.log('Promotion conditions:', promotion.conditions);

        // Combo Deal components must never be sellable individually at their
        // proportional combo-share price — the sell-screen combo engine
        // (applyComboDealsToCart) prices complete sets in the cart instead.
        if (promotion.promotionType === 'Combo Deal') {
          console.log(`Skipping Combo Deal promotion ${promotion.name} in promotion products view`);
          return;
        }

        const expressTypes = [
          'express_buy_x_get_y', 
          'express_discount', 
          'express_total_price',
          'Price Override',
          'Discount Percentage', 
          'Discount Amount'
        ];
        const isExpress = expressTypes.includes(promotion.promotionType);
        
        // Handle express promotions and regular promotions with items
        if (promotion.items && Array.isArray(promotion.items) && promotion.items.length > 0) {
          promotion.items.forEach(item => {
            console.log('Processing promotion item:', item);
            
            // Try to get product from item.product or from fetched products
            let product = item.product || (item.productId ? fetchedProducts.get(item.productId) : null);
            
            if (!product && item.productId) {
              console.log(`Item has productId ${item.productId} but no product object available.`);
              return;
            }
            
            if (product) {
              // Calculate promotion price - this should be the total price for the promotion quantity
              const promotionQty = item.quantity || 1;
              let promoPrice = 0;
              
              // Get base price per unit
              const basePricePerUnit = product.retailPrice || product.prices?.[0]?.price || 0;
              const basePriceTotal = basePricePerUnit * promotionQty;
              
              if (item.promoPrice && item.promoPrice > 0) {
                // promoPrice might be per unit or total - check if it's reasonable
                if (item.promoPrice < basePricePerUnit * 10) {
                  // Likely per unit, multiply by quantity
                  promoPrice = item.promoPrice * promotionQty;
                } else {
                  // Likely total price
                  promoPrice = item.promoPrice;
                }
              } else if (item.discountPercentage && item.discountPercentage > 0) {
                // Percentage discount
                promoPrice = basePriceTotal * (1 - item.discountPercentage / 100);
              } else if (item.discountAmount && item.discountAmount > 0) {
                // Fixed discount amount (per unit or total)
                if (item.discountAmount < basePricePerUnit) {
                  // Likely per unit discount
                  promoPrice = Math.max(0, (basePricePerUnit - item.discountAmount) * promotionQty);
                } else {
                  // Likely total discount
                  promoPrice = Math.max(0, basePriceTotal - item.discountAmount);
                }
              } else if (item.normalPrice && item.normalPrice > 0) {
                // Use normal price (might be per unit or total)
                if (item.normalPrice < basePricePerUnit * 10) {
                  promoPrice = item.normalPrice * promotionQty;
                } else {
                  promoPrice = item.normalPrice;
                }
              } else {
                // Fallback to base price
                promoPrice = basePriceTotal;
              }
              
              // Ensure we have a valid price
              if (promoPrice === 0 || isNaN(promoPrice)) {
                promoPrice = basePriceTotal;
                console.warn(`Promotion price is 0 or invalid for ${product.name}, using base price: ${promoPrice}`);
              }
              
              const key = `${product.id}-${promotionQty}`;
              if (!productMap.has(key)) {
                productMap.set(key, {
                  product: product,
                  quantity: promotionQty,
                  price: promoPrice, // Total price for the promotion quantity
                  promotionName: promotion.name,
                  startDate: promotion.startDate,
                  endDate: promotion.endDate
                });
                console.log(`Added product ${product.name} to promotion products list with price ${promoPrice} for quantity ${promotionQty}`);
              }
            }
          });
        }
        
        // Handle regular promotions with conditions/criteria
        if (promotion.conditions && promotion.conditions.criteria && Array.isArray(promotion.conditions.criteria)) {
          promotion.conditions.criteria.forEach(criterion => {
            if (criterion.items && Array.isArray(criterion.items)) {
              criterion.items.forEach(item => {
                console.log('Processing criterion item:', item);
                
                // Skip excluded items
                if (item.excluded) {
                  return;
                }
                
                // Try to get product from item.product or from fetched products
                let product = item.product || (item.productId ? fetchedProducts.get(item.productId) : null);
                
                if (!product && item.productId) {
                  console.log(`Criterion item has productId ${item.productId} but no product object available.`);
                  return;
                }
                
                if (product) {
                  // For criterion items, use the product's retail price or calculate from promotion
                  const basePrice = product.retailPrice || product.prices?.[0]?.price || 0;
                  const key = `${product.id}-${criterion.purchaseValue || 1}`;
                  
                  if (!productMap.has(key)) {
                    productMap.set(key, {
                      product: product,
                      quantity: criterion.purchaseValue || 1,
                      price: basePrice, // Will be calculated when added to cart
                      promotionName: promotion.name,
                      startDate: promotion.startDate,
                      endDate: promotion.endDate
                    });
                    console.log(`Added product ${product.name} from criteria to promotion products list`);
                  }
                }
              });
            }
          });
        }
      });
      
      console.log('Total promotion products extracted:', productMap.size);
      
      setPromotionProducts(Array.from(productMap.values()));
    } catch (error) {
      console.error('Error loading promotion products:', error);
      setPromotionProducts([]);
    } finally {
      setLoadingPromotionProducts(false);
    }
  };

  // Load products for a classification
  const loadClassificationProducts = async (classificationIdOrName, classificationType) => {
    setLoadingClassificationProducts(true);
    try {
      let classificationId = classificationIdOrName;
      
      // If it's a name, find the classification by name and type
      if (isNaN(classificationIdOrName)) {
        const classifications = await classificationService.getClassifications({ 
          type: classificationType 
        });
        const found = classifications.classifications?.find(
          c => c.name === classificationIdOrName && c.type === classificationType
        );
        if (found) {
          classificationId = found.id;
          setCurrentClassification(found);
        } else {
          throw new Error(`Classification "${classificationIdOrName}" not found`);
        }
      } else {
        // Fetch classification details
        const classification = await classificationService.getClassification(classificationId);
        setCurrentClassification(classification.classification || classification);
      }
      
      // Get products for this classification
      const response = await classificationService.getClassificationProducts(classificationId);
      const products = response.assignedProducts || [];
      
      setClassificationProducts(products);
    } catch (error) {
      console.error('Error loading classification products:', error);
      alert(error.message || 'Failed to load classification products');
      setClassificationProducts([]);
    } finally {
      setLoadingClassificationProducts(false);
    }
  };

  // Function to find applicable promotions for a product
  const findApplicablePromotions = (product) => {
    if (!product) {
      console.log('findApplicablePromotions: No product provided');
      return [];
    }
    
    const productId = product.id || product.productId;
    if (!productId) {
      console.log('findApplicablePromotions: No product ID found', product);
      return [];
    }
    
    const productIdNum = Number(productId);
    console.log(`findApplicablePromotions: Looking for product ID ${productId} (${productIdNum}) in ${activePromotions.length} promotions`);
    
    // Support both old and new promotion type names
    const expressTypes = [
      'Price Override', 'Discount Percentage', 'Discount Amount', // Old names
      'express_buy_x_get_y', 'express_discount', 'express_total_price' // New names
    ];
    
    return activePromotions.filter(promotion => {
      if (!isPromotionActive(promotion)) {
        console.log(`Promotion ${promotion.name || promotion.id}: Not active (date check failed)`);
        return false;
      }
      
      const isExpress = expressTypes.includes(promotion.promotionType);
      
      if (isExpress) {
        if (!promotion.items || !Array.isArray(promotion.items)) {
          console.log(`Express promotion ${promotion.name || promotion.id}: No items`);
          return false;
        }
        
        const hasProduct = promotion.items.some(item => {
          const itemProductId = item.productId;
          const itemProductIdNum = itemProductId ? Number(itemProductId) : null;
          const match = itemProductIdNum === productIdNum || String(itemProductId) === String(productId);
          if (match) {
            console.log(`Found matching item in express promotion ${promotion.name || promotion.id}:`, item);
          }
          return match;
        });
        
        if (hasProduct) {
          console.log(`Express promotion ${promotion.name || promotion.id} is applicable`);
        }
        return hasProduct;
      } else {
        if (!promotion.conditions || !promotion.conditions.criteria) {
          console.log(`Promotion ${promotion.name || promotion.id}: No conditions or criteria`);
          return false;
        }
        
        const matches = promotion.conditions.criteria.some(criterion => {
          if (!criterion.items || !Array.isArray(criterion.items)) return false;
          return criterion.items.some(item => {
            if (item.excluded) return false;
            const itemProductId = item.productId || item.id;
            const itemProductIdNum = itemProductId ? Number(itemProductId) : null;
            const match = itemProductIdNum === productIdNum || String(itemProductId) === String(productId);
            if (match) {
              console.log(`Found matching item in promotion ${promotion.name || promotion.id}:`, item);
            }
            return match;
          });
        });
        
        if (matches) {
          console.log(`Promotion ${promotion.name || promotion.id} is applicable`);
        }
        return matches;
      }
    });
  };
  const calculatePromotionPrice = (product, quantity, promotion) => {
    if (!promotion) {
      console.log('calculatePromotionPrice: No promotion provided');
      return null;
    }
    if (!isPromotionActive(promotion)) {
      console.log(`calculatePromotionPrice: Promotion ${promotion.name || promotion.id} is not active (date check failed)`);
      return null;
    }
    const productId = product.id || product.productId;
    if (!productId) {
      console.log('calculatePromotionPrice: No product ID');
      return null;
    }
    const productIdNum = Number(productId);
    // Support both old and new promotion type names
    const expressTypes = [
      'Price Override', 'Discount Percentage', 'Discount Amount', // Old names
      'express_buy_x_get_y', 'express_discount', 'express_total_price' // New names
    ];
    const isExpress = expressTypes.includes(promotion.promotionType);
    if (isExpress) {
      if (!promotion.items || !Array.isArray(promotion.items)) {
        console.log('calculatePromotionPrice: Express promotion has no items');
        return null;
      }
      const promotionItem = promotion.items.find(item => {
        const itemProductId = item.productId;
        const itemProductIdNum = itemProductId ? Number(itemProductId) : null;
        return itemProductIdNum === productIdNum || String(itemProductId) === String(productId);
      });
      if (!promotionItem) {
        console.log('calculatePromotionPrice: Product not found in express promotion items');
        return null;
      }
      const requiredQty = promotionItem.quantity || 1;
      if (quantity < requiredQty) {
        console.log(`calculatePromotionPrice: Quantity ${quantity} is less than required ${requiredQty}`);
        return null;
      }
      const basePrice = calculateBasePriceForQuantity(product, quantity);
      if (basePrice === 0) {
        console.log('calculatePromotionPrice: Base price is 0');
        return null;
      }
      const promoPrice = parseFloat(promotionItem.promoPrice) || 0;
      const discountPercentage = parseFloat(promotionItem.discountPercentage) || 0;
      const normalPrice = parseFloat(promotionItem.normalPrice) || basePrice;
      console.log(`calculatePromotionPrice: Express promotion ${promotion.promotionType}, promoPrice=${promoPrice}, discountPercentage=${discountPercentage}, normalPrice=${normalPrice}, quantity=${quantity}, requiredQty=${requiredQty}`);
      
      // Handle both old and new promotion type names
      const isPriceOverride = promotion.promotionType === 'Price Override' || promotion.promotionType === 'express_total_price';
      const isDiscountPercentage = promotion.promotionType === 'Discount Percentage' || promotion.promotionType === 'express_discount';
      const isDiscountAmount = promotion.promotionType === 'Discount Amount';
      const isBuyXGetY = promotion.promotionType === 'express_buy_x_get_y';
      
      if (isPriceOverride || isBuyXGetY) {
        if (promoPrice > 0) {
          const totalPrice = promoPrice * quantity;
          console.log(`Price Override/Buy X Get Y: promoPrice=${promoPrice} (per unit), requiredQty=${requiredQty}, quantity=${quantity}, totalPrice=${totalPrice}`);
          return totalPrice;
        }
        return null;
      } else if (isDiscountPercentage) {
        if (discountPercentage > 0) {
          const discountDecimal = discountPercentage / 100;
          const discountedPrice = basePrice * (1 - discountDecimal);
          return discountedPrice > 0 ? discountedPrice : null;
        }
        return null;
      } else if (isDiscountAmount) {
        const discountAmount = parseFloat(promotionItem.discountAmount) || parseFloat(promotionItem.rebate) || 0;
        if (discountAmount > 0) {
          const discountPerUnit = discountAmount / requiredQty;
          const totalDiscount = discountPerUnit * quantity;
          const discountedPrice = basePrice - totalDiscount;
          return discountedPrice > 0 ? discountedPrice : null;
        }
        return null;
      }

      return null;
    }

    const applicableCriterion = promotion.conditions.criteria.find(criterion => {
      if (!criterion.items || !Array.isArray(criterion.items)) return false;
      const hasProduct = criterion.items.some(item => {
        if (item.excluded) return false;
        const itemProductId = item.productId || item.id;
        const itemProductIdNum = itemProductId ? Number(itemProductId) : null;
        return itemProductIdNum === productIdNum || String(itemProductId) === String(productId);
      });
      
      if (!hasProduct) return false;
      
      const purchaseQty = parseFloat(criterion.purchaseValue) || 0;
      console.log(`Checking quantity: ${quantity} >= ${purchaseQty}?`, quantity >= purchaseQty);
      if (criterion.purchaseType === 'purchase') {
        return quantity >= purchaseQty;
      }
      return quantity >= purchaseQty;
    });

    if (!applicableCriterion) {
      console.log('calculatePromotionPrice: No applicable criterion found');
      return null;
    }

    const purchaseQty = parseFloat(applicableCriterion.purchaseValue) || 0;
    if (quantity < purchaseQty) {
      console.log(`calculatePromotionPrice: Quantity ${quantity} < required ${purchaseQty}`);
      return null;
    }

    const basePrice = calculateBasePriceForQuantity(product, quantity);
    if (basePrice === 0) {
      console.log('calculatePromotionPrice: Base price is 0');
      return null;
    }

    const receiveType = applicableCriterion.receiveType;
    const receiveValue = parseFloat(applicableCriterion.receiveValue) || 0;
    
    console.log(`calculatePromotionPrice: Applying ${receiveType} with value ${receiveValue}, basePrice=${basePrice}, quantity=${quantity}`);

    switch (receiveType) {
      case 'total_price':
        return receiveValue;
      
      case 'each_item_for':
        return receiveValue * quantity;
      
      case 'discount_each_item':
        const pricePerUnit = basePrice / quantity;
        const discountedPerUnit = pricePerUnit - receiveValue;
        return discountedPerUnit > 0 ? discountedPerUnit * quantity : null;
      
      case 'discount_total':
        return basePrice - receiveValue > 0 ? basePrice - receiveValue : null;
      
      case 'percentage_discount':
        const discountDecimal = receiveValue / 100;
        const discountedPrice = basePrice * (1 - discountDecimal);
        return discountedPrice > 0 ? discountedPrice : null;
      
      case 'discount':
        if (applicableCriterion.purchaseType === 'purchase') {
          return basePrice - receiveValue > 0 ? basePrice - receiveValue : null;
        }
        return null;
      
      case 'same_sell_rate':
        const sellRateQty = receiveValue;
        const sellRatePrice = calculateBasePriceForQuantity(product, sellRateQty);
        if (sellRatePrice === 0) return null;
        const sellRatePerUnit = sellRatePrice / sellRateQty;
        return sellRatePerUnit * quantity;
      
      case 'quantity_only':
        return basePrice;
      
      default:
        return null;
    }
  };

  const calculateBasePriceForQuantity = (product, quantity) => {
    if (!product) return 0;

    const qty = Number(quantity);
    if (qty <= 0) return 0;

    // Price tier matching against the ACTIVE price set's rows (falls back to the
    // default group when the product has no rows in the set).
    const priceRows = effectivePrices(product);
    if (Array.isArray(priceRows) && priceRows.length > 0) {
      const sorted = [...priceRows].sort((a, b) => (a.quantity || 0) - (b.quantity || 0));
      console.log(`Tier pricing - Sorted tiers:`, sorted.map(t => ({ qty: t.quantity, price: t.price })));
      
      let selectedTier = null;
      
      if (qty >= 10) {
        console.log(`Quantity ${qty} >= 10, looking for highest tier <= ${qty}`);
        for (let i = sorted.length - 1; i >= 0; i -= 1) {
          const tierQty = Number(sorted[i].quantity);
          console.log(`  Checking tier ${i}: qty=${tierQty}, price=${sorted[i].price}`);
          if (!Number.isNaN(tierQty) && tierQty <= qty) {
            selectedTier = sorted[i];
            console.log(`  -> Selected tier:`, selectedTier);
            break;
          }
        }
      } else {
        console.log(`Quantity ${qty} < 10, looking for exact match first`);
        selectedTier = sorted.find(t => Number(t.quantity) === qty) || null;
        if (!selectedTier) {
          console.log(`No exact match, looking for highest tier <= ${qty}`);
          for (let i = sorted.length - 1; i >= 0; i -= 1) {
            const tierQty = Number(sorted[i].quantity);
            if (!Number.isNaN(tierQty) && tierQty <= qty) {
              selectedTier = sorted[i];
              break;
            }
          }
        }
      }
      
      if (selectedTier && typeof selectedTier.price !== 'undefined') {
        const tierPrice = Number(selectedTier.price) || 0;
        const tierQuantity = Number(selectedTier.quantity) || 1;
        const pricePerUnit = tierPrice / tierQuantity;
        console.log(`Using tier: qty=${tierQuantity}, price=${tierPrice}, unit=${pricePerUnit}, total=${pricePerUnit * qty}`);
        return pricePerUnit * qty;
      } else {
        console.log(`No tier selected or tier has no price`);
      }
    }
    
    // Try to get retailPrice - handle both number and string types
    let fallbackPrice = 0;
    
    console.log('Looking for price in product:', {
      hasRetailPrice: product.retailPrice !== null && product.retailPrice !== undefined,
      retailPrice: product.retailPrice,
      hasPricesArray: Array.isArray(product.prices),
      pricesLength: product.prices?.length,
      firstPrice: product.prices?.[0]
    });
    
    if (product.retailPrice !== null && product.retailPrice !== undefined) {
      fallbackPrice = Number(product.retailPrice) || 0;
      console.log(`Using retailPrice: ${product.retailPrice} (parsed as ${fallbackPrice}) for product ${product.name || product.id}`);
    } else if (Array.isArray(product.prices) && product.prices.length > 0) {
      // Check different possible price structures
      const firstPriceObj = product.prices[0];
      if (firstPriceObj.price !== undefined) {
        fallbackPrice = Number(firstPriceObj.price) || 0;
      } else if (firstPriceObj.amount !== undefined) {
        fallbackPrice = Number(firstPriceObj.amount) || 0;
      } else if (firstPriceObj.value !== undefined) {
        fallbackPrice = Number(firstPriceObj.value) || 0;
    }
      console.log(`Using first tier price object:`, firstPriceObj, `extracted price: ${fallbackPrice}`);
    } else {
      console.log('No valid price found for product:', product.name || product.id, product);
    }
    
    const total = fallbackPrice * qty;
    console.log(`Final price calculation: ${fallbackPrice} x ${qty} = ${total}`);
    return total;
  };

  // ponytail: effective price list — run the everyday line total through the customer's
  // price-list rules (per-unit engine, x qty). No config / no customer => returns baseTotal
  // unchanged (true no-op). Guards against NaN/negative.
  const computePriceListTotal = (product, qty, baseTotal, configOverride = null) => {
    const activeConfig = configOverride || priceListConfig;
    if (!activeConfig || !(qty > 0)) return baseTotal;
    const unit = applyPriceListToLine({
      everyday: baseTotal / qty,
      productId: product.productId || product.id,
      id: product.id,
      cost: product.itemCost ?? product.cost ?? product.replacementCost,
      lastCost: product.lastCost ?? product.replacementCost,
      quantity: qty,
      classificationIds: product.classificationId ? [product.classificationId] : (product.classificationIds || undefined),
    }, activeConfig);
    const total = unit * qty;
    return Number.isFinite(total) && total >= 0 ? total : baseTotal;
  };

  const calculatePriceForQuantity = (product, quantity) => {
    if (!product) return 0;

    const qty = Number(quantity);
    if (qty <= 0) return 0;

    // Everyday total, then the customer's price-list price (replaces everyday).
    const basePrice = calculateBasePriceForQuantity(product, qty);
    const listTotal = computePriceListTotal(product, qty, basePrice);

    // Then check for active promotions.
    // ponytail: enforces effective disablePromotions — when the sale's customer (or
    // their group) has promotions disabled, no promotion is applicable, so the price
    // list / base price stands. FinalizeSaleDialog reads the cart line price this sets,
    // so the displayed price and the charged price stay identical.
    const applicablePromotions = getEffectiveCustomerSettings(selectedCustomer).disablePromotions
      ? []
      : findApplicablePromotions(product);
    if (applicablePromotions.length > 0) {
      console.log(`Found ${applicablePromotions.length} applicable promotions for product ${product.id || product.productId || product.name}`);
      // Try each promotion and use the best price (lowest)
      let bestPromoPrice = null;
      for (const promotion of applicablePromotions) {
        const promoPrice = calculatePromotionPrice(product, qty, promotion);
        console.log(`Promotion ${promotion.name || promotion.id}: price = ${promoPrice}`);
        if (promoPrice !== null && promoPrice > 0) {
          if (bestPromoPrice === null || promoPrice < bestPromoPrice) {
            bestPromoPrice = promoPrice;
          }
        }
      }

      if (bestPromoPrice !== null) {
        // ponytail: price list + promotion both apply — the customer gets the cheaper
        // (Shopfront always picks the lower price for the customer).
        const best = Math.min(bestPromoPrice, listTotal);
        console.log(`Using best of promo (${bestPromoPrice}) vs price list (${listTotal}): ${best} for qty ${qty}`);
        // IMPORTANT: Item price should NOT include surcharges.
        return best;
      }
    }

    console.log(`No promotion, using price-list/base total: ${listTotal} for quantity ${qty}`);
    // IMPORTANT: Item price should NOT include surcharges.
    return listTotal;
  };

  // The pre-promotion total for a line (everyday price, then the customer's price
  // list) — i.e. what calculatePriceForQuantity would return with no promotion.
  // Cart lines store it as `normalPrice` so Savings and the receipt can report
  // what a promotion took off; without it the promotion price is all that survives.
  const calculateNormalPriceForQuantity = (product, quantity) => {
    if (!product) return 0;
    const qty = Number(quantity);
    if (qty <= 0) return 0;
    return computePriceListTotal(product, qty, calculateBasePriceForQuantity(product, qty));
  };

  // Both halves of a line's pricing at once, plus any manual line discount carried
  // across the quantity change. `fallback` is the existing cart line: when the
  // product can no longer be resolved its totals are rescaled to the new quantity
  // instead of being frozen. Every quantity-change caller spreads this whole
  // result, so the line price and discountInfo.discountAmount (what the cart
  // footer and the saved sale read) can never drift apart.
  const priceLineForQuantity = (product, quantity, fallback = null) => {
    const info = fallback?.discountInfo;
    const oldAmount = Math.max(0, parseFloat(info?.discountAmount) || 0);

    if (!product) {
      const oldQty = parseFloat(fallback?.quantity) || 1;
      const rescale = (value) => ((parseFloat(value) || 0) / oldQty) * quantity;
      // fallback.price is already net of the discount, so only the recorded
      // amount has to be rescaled with it.
      return {
        price: rescale(fallback?.price),
        normalPrice: fallback?.normalPrice != null ? rescale(fallback.normalPrice) : undefined,
        ...(info ? { discountInfo: { ...info, discountAmount: rescale(oldAmount) } } : {}),
      };
    }

    const price = calculatePriceForQuantity(product, quantity);
    const normalPrice = calculateNormalPriceForQuantity(product, quantity);
    if (!oldAmount) return { price, normalPrice, ...(info ? { discountInfo: info } : {}) };

    // The discount keeps the same share of the line it took off before (8% off
    // stays 8% off, $1.50 a unit stays $1.50 a unit), applied to the freshly
    // priced total so quantity breaks and promotions still win first.
    const oldFull = (parseFloat(fallback?.price) || 0) + oldAmount;
    const share = oldFull > 0 ? Math.min(1, oldAmount / oldFull) : 0;
    const discountAmount = Math.round(price * share * 100) / 100;
    return {
      price: Math.round((price - discountAmount) * 100) / 100,
      normalPrice,
      discountInfo: { ...info, discountAmount },
    };
  };

  // Cart-line padlock: one click strips the manual price and re-prices the line
  // through the automatic waterfall (reference unlock, no confirmation).
  const handleUnlockPrice = (item) => {
    if (!item?.discountInfo) return;
    const updated = { ...item };
    delete updated.discountInfo;
    const product = item.productId ? resolveProductLocal(item.productId, item.name) : null;
    if (product) {
      Object.assign(updated, priceLineForQuantity(product, parseFloat(item.quantity) || 1, updated));
    } else {
      // ponytail: product no longer resolvable — add the recorded discount back
      updated.price = (parseFloat(item.price) || 0) + Math.max(0, parseFloat(item.discountInfo.discountAmount) || 0);
    }
    setCart(prev => prev.map(i => (i.id === item.id && i.timestamp === item.timestamp ? updated : i)));
    setSelectedCartItem(prev => (prev && prev.id === item.id && prev.timestamp === item.timestamp ? updated : prev));
  };

  // Cart-line note icon: same prompt path as the product-note sale key.
  const handleEditLineNote = async (item) => {
    const note = await prompt('Product note:', item.note || '', { title: 'Add note' });
    if (note === null) return;
    setCart(prev => prev.map(i => (i.id === item.id && i.timestamp === item.timestamp ? { ...i, note } : i)));
    setSelectedCartItem(prev => (prev && prev.id === item.id && prev.timestamp === item.timestamp ? { ...prev, note } : prev));
  };

  // Band ×: detach the customer instantly (no confirmation) and clear loyalty.
  const handleRemoveCustomer = () => {
    setSelectedCustomer(null);
    setLoyaltyRedemption(null);
    setLoyaltyCalculation(null);
    setCart(prev => prev.map(i => (i.redemptionDiscount ? { ...i, redemptionDiscount: 0 } : i)));
  };

  const isSurchargeScheduleActiveNow = (schedule) => {
    if (!schedule) return false;

    const now = new Date();
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const currentDay = dayNames[now.getDay()];

    if (schedule.dayOfWeek && schedule.dayOfWeek.toUpperCase() !== currentDay) {
      return false;
    }

    const [startHour = 0, startMin = 0] = (schedule.startTime || '00:00').split(':').map(Number);
    const [endHour = 23, endMin = 59] = (schedule.endTime || '23:59').split(':').map(Number);

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startHour * 60 + (startMin || 0);
    const endMinutes = endHour * 60 + (endMin || 0);

    if (endMinutes <= startMinutes) return false;

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  };

  const doesSurchargeApplyToProduct = (schedule, product) => {
    if (!product || !schedule) return false;

    // Category / tag selections are stored on the surcharge (JSON fields),
    // but we also fall back to any legacy fields on the schedule itself.
    const categoryIds = Array.isArray(schedule.surcharge?.categoryIds)
      ? schedule.surcharge.categoryIds
      : schedule.categoryIds || schedule.selectedCategories || [];

    const tagIds = Array.isArray(schedule.surcharge?.tagIds)
      ? schedule.surcharge.tagIds
      : schedule.tagIds || schedule.selectedTags || [];

    if ((!categoryIds || categoryIds.length === 0) && (!tagIds || tagIds.length === 0)) {
      return true;
    }

    const productCategoryIds = [];
    if (product.categoryId) productCategoryIds.push(product.categoryId);
    if (product.category?.id) productCategoryIds.push(product.category.id);

    const productTagIds = [];
    if (Array.isArray(product.tags)) {
      product.tags.forEach(t => {
        if (t.tagId) {
          productTagIds.push(t.tagId);
        } else if (t.tag?.id) {
          productTagIds.push(t.tag.id);
        }
      });
    }

    const categoryMatch = categoryIds.some(id => productCategoryIds.includes(id));
    const tagMatch = tagIds.some(id => productTagIds.includes(id));

    return categoryMatch || tagMatch;
  };

  const getApplicableSurchargeSchedules = (product) => {
    if (!selectedRegister?.id || !Array.isArray(surchargeSchedules) || surchargeSchedules.length === 0) {
      return [];
    }

    return surchargeSchedules.filter(schedule => {
      if (schedule.registerId && schedule.registerId !== selectedRegister.id) {
        return false;
      }
      if (!isSurchargeScheduleActiveNow(schedule)) {
        return false;
      }
      return doesSurchargeApplyToProduct(schedule, product);
    });
  };
  /**
   * Calculate surcharge breakdown for a given product / quantity / base total.
   * Returns the total surcharge amount and a map of surcharge name -> amount.
   */
  const calculateSurchargeBreakdown = (product, quantity, baseTotal) => {
    const base = Number(baseTotal) || 0;
    const qty = Number(quantity) || 0;
    if (base <= 0 || qty <= 0) return { totalExtra: 0, byName: {} };

    const schedules = getApplicableSurchargeSchedules(product);
    if (!schedules.length) return { totalExtra: 0, byName: {} };

    let totalExtra = 0;
    const byName = {};

    schedules.forEach((schedule) => {
      const type =
        schedule.surcharge?.surchargeType ||
        schedule.surchargeType ||
        'Percentage';
      const amount =
        Number(
          schedule.surcharge?.surchargeAmount ?? schedule.surchargeAmount,
        ) || 0;
      if (!amount) return;

      const name = schedule.surcharge?.name || 'Surcharge';

      let extraForThis = 0;
      if (type === 'Percentage') {
        extraForThis = base * (amount / 100);
      } else {
        // Fixed Amount – apply per unit quantity
        extraForThis = amount * qty;
      }

      totalExtra += extraForThis;
      byName[name] = (byName[name] || 0) + extraForThis;
    });

    return { totalExtra, byName };
  };

  const applySurchargesToPrice = (product, quantity, baseTotal) => {
    const base = Number(baseTotal) || 0;
    const qty = Number(quantity) || 0;
    if (base <= 0 || qty <= 0) return base;

    const { totalExtra } = calculateSurchargeBreakdown(product, qty, base);
    const total = base + totalExtra;
    console.log(
      '[Surcharge] Base:',
      base,
      'Extra:',
      totalExtra,
      'Total:',
      total,
      'Product:',
      product?.name,
    );
    return total;
  };

  // Units per case — one shared resolver (utils/saleTotals.js) so the sell screen,
  // the reprint dialog and the renderer all print the same Case Qty.
  const getItemsPerCase = itemsPerCase;

  const calculateCasePriceForQuantity = (product, caseQuantity) => {
    if (!product) return 0;

    const cases = Number(caseQuantity);
    if (cases <= 0) return 0;

    // A case sells at the tier-resolved retail price for its total unit
    // quantity (promotions included). caseCost is the PURCHASE cost of a
    // case — selling at cost was a bug (zero profit).
    return calculatePriceForQuantity(product, cases * getItemsPerCase(product));
  };

  const handleOpenAddSaleKeyDialog = () => {
    setShowAddSaleKeyDialog(true);
    loadProducts();
  };

  const handleCloseAddSaleKeyDialog = () => {
    setShowAddSaleKeyDialog(false);
    setNewSaleKey({
      name: '',
      action: '',
      amount: '',
      backgroundColor: '#4CAF50',
      textColor: '#FFFFFF',
      borderColor: '#000000',
      fontSize: 16,
      textStyle: {
        bold: false,
        italic: false,
        underline: false
      },
      image: null,
      imageFile: null,
      selectedProduct: null,
      paymentMethod: 'cash',
      position: { x: 0, y: 0, w: 1, h: 1 }
    });
  };

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
      const response = await productService.getProducts({ limit: 100 });
      setAvailableProducts(response.products || []);
    } catch (error) {
      console.error('Error loading products:', error);
      setAvailableProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleActionChange = (action) => {
    setNewSaleKey(prev => ({
      ...prev,
      action,
      // Reset relevant fields when action changes
      selectedProduct: action === 'add-product' || action === 'add-product-case' || action === 'add-product-combo' ? prev.selectedProduct : null,
      amount: action === 'payment' || action === 'pay-amount' ? prev.amount : '',
      paymentMethod: action === 'payment' || action === 'pay-amount' ? prev.paymentMethod : 'cash',
      comboId: action === 'add-product-combo' ? prev.comboId : null,
      selectedPaymentMethod: action === 'pay-exact-amount' ? prev.selectedPaymentMethod : null,
      promotionType: action === 'view-promotions' ? (prev.promotionType || 'Current') : 'Current',
      requestQuantity: false,
      quantity: '',
      requestCaseQuantity: false,
      caseQuantity: ''
    }));
  };

  const handleProductSelection = (product) => {
    if (product) {
      setNewSaleKey(prev => ({
        ...prev,
        selectedProduct: product,
        name: product.name,
        amount: product.retailPrice || product.prices?.[0]?.price || 0
      }));
    }
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setNewSaleKey(prev => ({
          ...prev,
          image: e.target.result,
          imageFile: file
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGiftCardSubmit = async () => {
    const ok = await ensureRegisterControl();
    if (!ok) return;
    if (!giftCardCode.trim()) {
      setGiftCardError('Please enter a gift card code');
      return;
    }

    setGiftCardLoading(true);
    setGiftCardError('');

    try {
      const giftCard = await giftCardService.getGiftCardByCode(giftCardCode.trim());
      
      if (!giftCard) {
        setGiftCardError('Gift card not found');
        return;
      }
      const now = new Date();
      const isExpired = giftCard.expiryDate && new Date(giftCard.expiryDate) < now;
      
      if (giftCard.status !== 'Active' || isExpired) {
        setGiftCardError('Gift card is not valid or has expired');
        return;
      }

      const cardBalance = parseFloat(giftCard.balance) || 0;
      if (cardBalance <= 0) {
        setGiftCardError('Gift card has no remaining balance');
        return;
      }

      // ponytail: REDEEM a gift card as payment. Apply the smaller of the sale's remaining
      // balance or the card's balance as a tender, and queue the code+amount to decrement ONCE
      // at sale completion (backend sales.js never touches the card, so no double-redeem).
      if (giftCardMode === 'pay') {
        const remaining = Math.max(0, calculateRemainingBalance());
        const amount = Math.round(Math.min(remaining, cardBalance) * 100) / 100;
        if (amount <= 0) {
          setGiftCardError('Nothing left to pay on this sale.');
          return;
        }
        const code = giftCardCode.trim();
        // Record the redemption BEFORE adding the tender: adding a fully-covering tender
        // schedules completion, which reads this ref — it must already hold the entry.
        // Capture the card's display figures here (the record is in hand) so the
        // gift_cards receipt component can render them — generateReceipt reads this
        // ref before redeemPendingGiftCards clears it.
        pendingGiftCardRef.current = [...pendingGiftCardRef.current, {
          code,
          amount,
          original: parseFloat(giftCard.originalAmount) || cardBalance,
          current: Math.round((cardBalance - amount) * 100) / 100,
          expiry: giftCard.expiryDate ? new Date(giftCard.expiryDate).toLocaleDateString() : '',
        }];
        await handleAddPaymentFromDialog({
          amount,
          method: 'Gift Card',
          description: `Gift Card ${code}`,
          giftCardCode: code,
        });
        setShowGiftCardPopup(false);
        setGiftCardCode('');
        setShowFinalizeDialog(true); // back to finalize to complete or add more tender
        return;
      }

      const newItem = {
        id: `gift-card-${Date.now()}`,
        productId: null,
        giftCardId: giftCard.id,
        name: `Gift Card - ${giftCardCode.trim()}`,
        price: giftCard.balance,
        quantity: 1,
        timestamp: Date.now(),
        action: 'add-gift-card',
        giftCardCode: giftCardCode.trim()
      };

      setCart(prev => [...prev, newItem]);
      setShowGiftCardPopup(false);
      setGiftCardCode('');
    } catch (error) {
      console.error('Error looking up gift card:', error);
      setGiftCardError('Gift card not found or error occurred');
    } finally {
      setGiftCardLoading(false);
    }
  };

  const handleGiftCardCancel = () => {
    setShowGiftCardPopup(false);
    setGiftCardCode('');
    setGiftCardError('');
  };

  const handleAddSaleKey = () => {
    // Validate required fields
    if (!newSaleKey.name.trim()) {
      alert('Please enter a name for the sale key');
      return;
    }
    if (!newSaleKey.action) {
      alert('Please select an action');
      return;
    }

    // Create the new sale key object
    const saleKey = {
      id: `key-${Date.now()}`,
      name: newSaleKey.name,
      action: newSaleKey.action,
      amount: newSaleKey.amount ? parseFloat(newSaleKey.amount) : undefined,
      backgroundColor: newSaleKey.backgroundColor,
      textColor: newSaleKey.textColor,
      borderColor: newSaleKey.borderColor,
      fontSize: newSaleKey.fontSize,
      textStyle: newSaleKey.textStyle,
      image: newSaleKey.image,
      paymentMethod: newSaleKey.paymentMethod,
      comboId: newSaleKey.comboId,
      selectedPaymentMethod: newSaleKey.selectedPaymentMethod,
      promotionType: newSaleKey.promotionType,
      // Config for the additional Shopfront sale-key actions
      noteScope: newSaleKey.noteScope,
      discountType: newSaleKey.discountType,
      discountValue: newSaleKey.discountValue,
      keyboardText: newSaleKey.keyboardText,
      durationAgo: newSaleKey.durationAgo,
      dateFormat: newSaleKey.dateFormat,
      componentProductId: newSaleKey.componentProductId,
      componentProductName: newSaleKey.componentProductName,
      position: {
        x: 0, // Will be positioned by user later
        y: 0,
        w: 1,
        h: 1
      },
      // If it's a product, include product data
      ...(newSaleKey.selectedProduct && {
        productId: newSaleKey.selectedProduct.id,
        price: newSaleKey.amount || newSaleKey.selectedProduct.retailPrice || newSaleKey.selectedProduct.prices?.[0]?.price || 0
      })
    };

    setSaleKeyConfig(prev => ({
      ...prev,
      saleKeys: [...(prev.saleKeys || []), saleKey]
    }));

    handleCloseAddSaleKeyDialog();
  };



  const getIconForSaleKey = (saleKey) => {
    if ((saleKey.action === 'payment' || saleKey.action === 'pay-amount') && saleKey.amount) {
      return null; 
    }
    
    switch (saleKey.action) {
      case 'payment':
      case 'pay-amount':
        return saleKey.paymentMethod === 'cash' ? <MoneyIcon /> : <CreditCardIcon />;
      case 'add-product':
        return saleKey.name.toLowerCase().includes('beer') ? <BarIcon /> : <DrinkIcon />;
      case 'add-product-case':
        return <CartIcon />;
      case 'add-product-combo':
        return <OfferIcon />;
      case 'add-gift-card':
        return <OfferIcon />;
      case 'subtract-quantity':
        return <RemoveIcon />;
      case 'add-quantity':
        return <AddIcon />;
      case 'clear-sale':
        return <CancelIcon />;
      case 'cancel-current-sale':
        return <CancelIcon />;
      case 'open-drawer':
        return <MoneyIcon />;
      case 'display-product-details':
        return <InfoOutlinedIcon />;
      case 'view-live-profit':
        return <OfferIcon />;
      case 'view-promotions':
        return <OfferIcon />;
      case 'create-customer':
        return <PersonIcon />;
      case 'display-classification-products':
      case 'display-classification-products-case':
        return <FolderIcon />;
      case 'navigation':
        return <ArrowUpIcon />;
      case 'special':
        return saleKey.name.toLowerCase().includes('party') ? <PartyIcon /> : <OfferIcon />;
      default:
        return <CartIcon />;
    }
  };

  // Shared customer row (search dropdown + left-panel picker): name + group
  // subtitle on the left, loyalty points on the right (reference anatomy).
  const renderCustomerRow = (customer, idx) => (
    <Box key={customer.id} onClick={() => handleSelectCustomer(customer)} sx={searchRowSx(idx)}>
      <Box sx={{ minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: 16, color: '#000' }}>
          {`${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.company || 'Unnamed Customer'}
        </Typography>
        {(customer.customerGroup?.name || customer.company) && (
          <Typography noWrap sx={{ fontSize: 14, color: '#757575' }}>
            {customer.customerGroup?.name || customer.company}
          </Typography>
        )}
      </Box>
      <Typography sx={{ fontSize: 16, color: '#000', flexShrink: 0, ml: 2 }}>
        {Number(customer.loyaltyPoints || 0)}
      </Typography>
    </Box>
  );

  // Reference: while search results are on screen they take over the whole
  // actions pane (keys grid AND the tab strip are swapped out).
  const searchResultsVisible =
    showSearchResults &&
    !isCustomerSearchMode &&
    !showPromotionView &&
    !showClassificationView &&
    (searchResults.products.length > 0 || searchResults.customers.length > 0);

  if (loading) {
    return <PageLoader />;
  }

  if (error) {
    return (
      <Box sx={{ 
        height: '100vh', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        bgcolor: '#f5f5f5'
      }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!saleKeyConfig || !saleKeyConfig.saleKeys) {
    return <PageLoader />;
  }

  return (
    <Box sx={{ height: 'calc(100vh - 50px)', display: 'flex', flexDirection: 'column', bgcolor: '#fff', position: 'relative', overflowX: 'hidden' }}>
      {/* Sell-screen-scoped header corrections. DashboardLayout is shared by every
          page, so the reference-only header shape is applied from here (mounted
          with the sell screen, reverted on unmount) instead of globally. */}
      <GlobalStyles
        styles={{
          // Reference right cluster is help, cash-drawer, speaker, ONLINE, bell,
          // avatar — no register signpost (the strip below supplies the sell
          // screen's own), so the navbar's is hidden here; anything else in this
          // cell displaces the whole cluster.
          '.MuiAppBar-root [aria-label="select register"]': { display: 'none' },
          // Reference profile cell is the avatar only, a 50px cell flush to the edge.
          '.MuiAppBar-root [title="Profile"]': {
            width: '50px',
            paddingLeft: 0,
            paddingRight: 0,
            gap: 0,
            justifyContent: 'center',
          },
          '.MuiAppBar-root [title="Profile"] .MuiTypography-root': { display: 'none' },
          // Reference ONLINE label: full-height line box, no letter-spacing, right aligned.
          '.MuiAppBar-root [aria-label="online status"] .MuiTypography-root': {
            lineHeight: '50px',
            letterSpacing: 'normal',
            textAlign: 'right',
          },
          // Reference nav overlay is 70% black over the FULL viewport, header included.
          '.MuiDrawer-root:has(> .MuiDrawer-paperAnchorLeft) > .MuiBackdrop-root': {
            top: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
          },
        }}
      />

      {/* Geofencing Validation - Shows blocking UI when not validated */}
      {!geofenceValidated && (
        <GeofenceValidator
          onValidationComplete={(isValid) => {
            setGeofenceValidated(true);
          }}
        />
      )}
      
      {/* Reference sell screen has NO page toolbar — sale content starts under the
          50px header. Header-only items (blinking customer-display icon, team
          message, help '?', register signpost) render into the topbar's empty
          middle via this page-local fixed strip (DashboardLayout stays untouched;
          outlet switching lives in the header outlet chip). */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          // Reference: the customer-display cell starts at x108 (after the 50px
          // hamburger + logo cells) and the right-hand icons butt up against the
          // header's own right cluster.
          left: 108,
          // Reference right cluster is six contiguous 50px cells (the ONLINE cell
          // is 100px) ending flush at the viewport edge: help, cash-drawer,
          // speaker, ONLINE, bell, avatar. The header owns the last four (250px),
          // so this strip ends there and supplies help + cash-drawer at x1570/1620.
          right: 250,
          height: 50,
          minWidth: 0,
          zIndex: (t) => t.zIndex.drawer + 2,
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          pointerEvents: 'none',
          '@media print': { display: 'none' },
        }}
      >
        {/* Reference: header cell 3 is always the customer-display indicator — a
            50x50 cell at x108 holding a blinking 30x24 TV icon. It stops blinking
            once the display window is open. */}
        <Box
          onClick={isCustomerDisplayOpen ? undefined : handleOpenCustomerDisplayWindow}
          role="button"
          aria-label="open customer display"
          title={isCustomerDisplayOpen ? 'Customer Display is open' : 'Open Customer Display'}
          sx={{
            width: 50,
            height: 50,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isCustomerDisplayOpen ? 'default' : 'pointer',
            pointerEvents: 'auto',
            color: '#e3342f',
            animation: isCustomerDisplayOpen ? 'none' : 'cdBlink 1s step-end infinite',
            '@keyframes cdBlink': {
              '0%': { opacity: 1 },
              '50%': { opacity: 0.25 },
              '100%': { opacity: 1 },
            },
          }}
        >
          <TvOutlinedIcon sx={{ fontSize: 24, width: 30 }} />
        </Box>
        <Box sx={{ flex: 1 }} />
        {/* Same button as the navbar's; only the measured spacing differs — held
            clear of the reference's six-cell right cluster so help + cash-drawer
            stay its first two members. */}
        <RegisterSelectButton sx={{ flexShrink: 0, mr: '50px', pointerEvents: 'auto' }} />
        {/* Reference right cluster carries a cash-drawer button next to the help
            '?'. Reuses the existing 'open-drawer' sale-key action (same service,
            same register guard). */}
        <Box
          onClick={() => handleSaleKeyClick({ action: 'open-drawer', name: 'Open Cash Drawer' })}
          role="button"
          aria-label="open cash drawer"
          title="Open Cash Drawer"
          sx={{ width: 50, height: 50, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', pointerEvents: 'auto', color: '#f8f8f8' }}
        >
          <PointOfSaleIcon sx={{ fontSize: 24 }} />
        </Box>
      </Box>

      {/* STATE 1 - no register selected: dark pane replacing the hidden sell body */}
      {!selectedRegister && geofenceValidated && (
        <Box sx={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          bgcolor: '#4a4e52',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          textAlign: 'center',
          px: 2,
        }}>
          <Typography sx={{ color: '#f8f8f8', fontSize: 48, fontWeight: 400, lineHeight: 1.2 }}>
            You currently don't have a register selected.
          </Typography>
          <Box sx={{ display: 'flex', gap: '8px' }}>
            {[
              { label: 'Go to Dashboard', icon: <DashboardIcon sx={{ fontSize: 20 }} />, onClick: () => navigate('/dashboard') },
              { label: 'Select Register', icon: <PointOfSaleIcon sx={{ fontSize: 20 }} />, onClick: () => openLocationSelector({ force: true }) },
            ].map((b) => (
              <Box
                key={b.label}
                component="button"
                onClick={b.onClick}
                sx={{
                  background: 'transparent',
                  border: '1px solid currentColor',
                  color: '#f8f8f8',
                  fontSize: 32,
                  borderRadius: 0,
                  padding: '4px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontFamily: 'inherit',
                  lineHeight: 1.2,
                }}
              >
                {b.icon}
                {b.label}
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Sales screen - only show when register is selected AND geofence is validated */}
      {/* Setup > General > Miscellaneous "Sale Keys Position": 'right' mirrors
          the keys pane and the sale summary. */}
      <Box sx={{ display: (selectedRegister && geofenceValidated) ? 'flex' : 'none', flexDirection: saleKeysPosition === 'right' ? 'row-reverse' : 'row', flex: 1, overflow: 'hidden', minWidth: 0, width: '100%', gap: 0, alignItems: 'stretch' }}>
        {/* Finalize surface uses the same 8px inset as the selling panes so the
            right rail keeps its x/y when finalize opens (no jump). */}
        {showFinalizeDialog && selectedRegister ? (
          <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', m: '8px', minWidth: 0, position: 'relative' }}>
            {/* onAddCustomer keeps finalize mounted — the picker opens OVER it
                so the typed amount / armed tender / order reference survive. */}
            <FinalizeSaleDialog
              open={showFinalizeDialog}
              onClose={() => setShowFinalizeDialog(false)}
              cart={cart}
              payments={payments}
              selectedCustomer={selectedCustomer}
              total={calculateTotal()}
              remainingBalance={calculateRemainingBalance()}
              availablePaymentMethods={getFilteredPaymentMethods()}
              onAddPayment={handleAddPaymentFromDialog}
              onRemovePayment={handleRemovePaymentFromDialog}
              onSelectPaymentMethod={handleSelectPaymentMethodFromDialog}
              onAddCustomer={handleAddCustomerClick}
              onRemoveCustomer={() => {
                setSelectedCustomer(null);
                // Clear loyalty redemption when customer is removed
                setLoyaltyRedemption(null);
                // Remove any loyalty payments
                setPayments(prev => prev.filter(p => p.method?.toLowerCase() !== 'loyalty'));
              }}
              onReturnToSale={() => setShowFinalizeDialog(false)}
              onCompleteTransaction={(overridePayments) => {
                setShowFinalizeDialog(false);
                // Use overridePayments if provided, otherwise use current payments state
                const paymentsToUse = overridePayments || payments;
                console.log('[FinalizeSale] Completing transaction with payments:', paymentsToUse);
                completeTransaction(paymentsToUse, calculateTotal());
              }}
              customerLoyaltyInfo={customerLoyaltyInfo}
              loyaltyCalculation={loyaltyCalculation}
              orderReference={orderReference}
              outletId={getEffectiveOutletId()}
            />
            {/* Customer picker surface layered over finalize: same anatomy as
                the actions-pane picker (search box, Back / Create New, zebra
                list). Escape or Back returns to finalize untouched. */}
            {isCustomerSearchMode && (
              <Box sx={{ position: 'absolute', inset: 0, zIndex: 20, bgcolor: '#fff', display: 'flex', flexDirection: 'column' }}>
                <TextField
                  autoFocus
                  placeholder="Search for Customers..."
                  variant="outlined"
                  size="small"
                  fullWidth
                  value={searchTerm}
                  onChange={handleSearchChange}
                  onKeyDown={handleSearchKeyDown}
                  sx={{
                    flexShrink: 0,
                    bgcolor: '#fff',
                    borderBottom: '1px solid #000',
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 0,
                      height: 50,
                      fontSize: 16,
                      px: '16px',
                      '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { border: 'none' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: 'none' },
                    },
                    '& .MuiOutlinedInput-input': {
                      p: 0,
                      '&::placeholder': { color: '#757575', opacity: 1 },
                    },
                  }}
                />
                <Box sx={{ height: 55, flexShrink: 0, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, borderBottom: '1px solid #000' }}>
                  {[
                    { label: '← Back', onClick: exitCustomerSearchMode },
                    { label: 'Create New', onClick: () => setShowCreateCustomerModal(true) },
                  ].map((b) => (
                    <Box
                      key={b.label}
                      component="button"
                      type="button"
                      onClick={b.onClick}
                      sx={{ border: 0, bgcolor: 'transparent', p: 0, fontFamily: 'inherit', fontSize: '19.2px', color: '#000', cursor: 'pointer' }}
                    >
                      {b.label}
                    </Box>
                  ))}
                </Box>
                <Box sx={{ flex: 1, overflowY: 'auto' }}>
                  {searchResults.customers.length > 0 ? (
                    searchResults.customers.map((customer, idx) => renderCustomerRow(customer, idx))
                  ) : (
                    <Typography sx={{ p: 4, textAlign: 'center', color: '#757575' }}>
                      No customers found
                    </Typography>
                  )}
                </Box>
              </Box>
            )}
          </Box>
        ) : (
          <>
          {/* Reference split: 8px page inset, 8px gutter, panels 1333 / 563 of the
              1896px inner width — expressed as grow ratios so it holds at any width. */}
          <Box sx={{ flex: '70.3 1 0', display: 'flex', flexDirection: 'column', overflow: 'hidden', m: '8px', minWidth: 0 }}>
            {/* Reference: the whole actions pane sits in one 1px solid black box. */}
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', border: '1px solid #000', boxSizing: 'border-box', overflow: 'hidden' }}>
          {!showPromotionView && !showClassificationView && (
            <ClickAwayListener onClickAway={handleClickAway}>
              {/* Reference: results REPLACE the keys grid in place — the panel grows
                  to fill the pane instead of floating over it. */}
              <Box sx={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, flex: searchResultsVisible ? 1 : '0 0 auto', zIndex: 10 }}>
            <TextField
              ref={searchRef}
              placeholder={isCustomerSearchMode ? 'Search for Customers...' : 'Search for Products and Customers...'}
              variant="outlined"
              size="small"
              fullWidth
              sx={{
                flexShrink: 0,
                // Reference: 50px-tall white input (border-box) whose only border is
                // a 1px black bottom rule, 16px padding all round, 16px black text
                // at normal line-height/letter-spacing, #757575 placeholder, no
                // magnifier icon and no focus ring.
                bgcolor: '#fff',
                '& .MuiOutlinedInput-root': {
                  borderRadius: 0,
                  height: 50,
                  boxSizing: 'border-box',
                  fontSize: 16,
                  p: 0,
                  pr: '16px',
                  borderBottom: '1px solid #000',
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: 'none' },
                },
                '& .MuiOutlinedInput-input': {
                  height: '100%',
                  boxSizing: 'border-box',
                  p: '16px',
                  color: '#000',
                  lineHeight: 'normal',
                  letterSpacing: 'normal',
                  '&::placeholder': { color: '#757575', opacity: 1 },
                },
              }}
              InputProps={{
                endAdornment: searchTerm ? (
                  <InputAdornment position="end">
                    <CloseIcon
                      onClick={() => { setSearchTerm(''); focusSearchInput(); }}
                      aria-label="clear search"
                      sx={{ fontSize: 16, color: '#000', cursor: 'pointer' }}
                    />
                  </InputAdornment>
                ) : null,
              }}
              value={searchTerm}
                  onChange={handleSearchChange}
                  onKeyDown={handleSearchKeyDown}
                  onFocus={() => searchTerm && setShowSearchResults(true)}
                />
                
                {searchResultsVisible && (
                  <Box
                    sx={{
                      flex: 1,
                      minHeight: 0,
                      overflowY: 'auto',
                      bgcolor: 'transparent',
                      border: 'none',
                      borderRadius: 0,
                      boxShadow: 'none',
                    }}
                  >
                    {/* Reference anatomy: full-width gray section bands + 75px zebra rows. */}
                    {searchResults.customers.length > 0 && (
                      <>
                        <Box sx={searchBandSx}>Customers</Box>
                        {searchResults.customers.map((customer, idx) => renderCustomerRow(customer, idx))}
                      </>
                    )}
                    {searchResults.products.length > 0 && (
                      <>
                        <Box sx={searchBandSx}>Products</Box>
                        {searchResults.products.map((product, idx) => (
                          <Box
                            key={product.id}
                            // Clicking a row the search matched BY BARCODE adds that
                            // barcode's pack quantity, exactly like scanning it.
                            onClick={() => handleAddProductFromSearch(
                              product,
                              productMatchesBarcode(product, searchTerm.trim())
                                ? getBarcodeQuantity(product, searchTerm.trim())
                                : 1
                            )}
                            sx={searchRowSx(idx)}
                          >
                            <Box sx={{ minWidth: 0 }}>
                              <Typography noWrap sx={{ fontSize: 16, color: '#000' }}>
                                {product.name}
                              </Typography>
                              {(stripHtml(product.description) || product.type) && (
                                <Typography noWrap sx={{ fontSize: 14, color: '#757575' }}>
                                  {stripHtml(product.description) || product.type}
                                </Typography>
                              )}
                            </Box>
                            <Typography sx={{ fontSize: 16, color: '#000', flexShrink: 0, ml: 2 }}>
                              ${(parseFloat(product.retailPrice) || parseFloat(product.prices?.[0]?.price) || 0).toFixed(2)}
                            </Typography>
                          </Box>
                        ))}
                      </>
                    )}
                  </Box>
                )}
              </Box>
            </ClickAwayListener>
          )}

          {/* Reference sell screen: 50px transparent bar at the BOTTOM of the
              actions pane; tabs are CONTENT-sized (they share the spare width
              equally) with leading icons, 50px line-height, and the selected tab
              is marked by a blue underline bar — the tabs themselves are borderless.
              order:5 pushes this below the content area (which flexes to fill). */}
          {!showPromotionView && !showClassificationView && !isCustomerSearchMode && !searchResultsVisible && (
          <Box sx={{ order: 5, mt: 'auto', flexShrink: 0, height: 50, bgcolor: 'transparent', display: 'flex' }}>
            {[
              { v: 'sales-keys', label: 'Sales Keys', icon: <KeyboardOutlinedIcon sx={{ fontSize: 24 }} /> },
              { v: 'parked-sales', label: 'Parked Sales', icon: <LocalParkingOutlinedIcon sx={{ fontSize: 24 }} /> },
              { v: 'ecommerce', label: 'Shop MyLocal / IBA E-Commerce', icon: null },
            ].map((t) => (
              <Box
                key={t.v}
                component="button"
                type="button"
                onClick={() => setActiveTab(t.v)}
                sx={{
                  // Content-sized tabs sharing the spare width equally (reference
                  // widths 385 / 403 / 543 across the 1331px strip).
                  flex: '1 1 auto',
                  minWidth: 0,
                  height: 50,
                  boxSizing: 'border-box',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  p: 0,
                  border: 0,
                  bgcolor: 'transparent',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: '19.2px',
                  lineHeight: '50px',
                  letterSpacing: 'normal',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  color: activeTab === t.v ? 'rgb(28,134,242)' : '#000',
                  // Selected tab is marked by an underline bar under the strip.
                  '&::after': activeTab === t.v ? {
                    content: '""',
                    position: 'absolute',
                    bottom: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 'min(312px, 100%)',
                    height: '6px',
                    bgcolor: 'rgb(28,134,242)',
                  } : undefined,
                }}
              >
                {t.icon}
                {t.label}
              </Box>
            ))}
          </Box>
          )}

          {!showPromotionView && !isCustomerSearchMode && !searchResultsVisible && activeTab === 'parked-sales' && (
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', bgcolor: 'white' }}>
              {/* Reference: "Park Sale" action row on top (59px, car icon,
                  1px black bottom border), grayed/disabled while the cart is
                  empty; parks the current sale. */}
              <Box
                onClick={cart.length > 0 ? parkCurrentSale : undefined}
                role="button"
                aria-disabled={cart.length === 0}
                sx={{
                  height: 59,
                  flexShrink: 0,
                  boxSizing: 'border-box',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 2,
                  borderBottom: '1px solid #000',
                  fontSize: '19.2px',
                  color: cart.length > 0 ? '#000' : '#737373',
                  cursor: cart.length > 0 ? 'pointer' : 'not-allowed',
                }}
              >
                <DirectionsCarOutlinedIcon sx={{ fontSize: 24 }} />
                Park Sale
              </Box>
              <Box sx={{ flex: 1, overflow: 'auto' }}>
              {parkedSalesLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <CircularProgress />
                </Box>
              ) : parkedSales.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="body1" color="text.secondary">
                    No parked sales
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ p: 0 }}>
                  {parkedSales.map((sale, index) => {
                    const saleDate = new Date(sale.createdAt || sale.saleDate);
                    const formattedDate = saleDate.toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    });
                    const formattedTime = saleDate.toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false
                    });
                    const customerName = sale.customer
                      ? `${sale.customer.firstName || ''} ${sale.customer.lastName || ''}`.trim().toUpperCase()
                      : null;
                    const employeeName = sale.user?.name || 'Unknown';
                    const totalAmount = parseFloat(sale.totalAmount || 0);
                    const formattedAmount = totalAmount.toFixed(2);
                    const [amtDollars, amtCents] = formattedAmount.split('.');
                    // Reference rows: 89px, 16px padding, zebra #f8f8f8/#fff.
                    const rowBgColor = index % 2 === 0 ? '#f8f8f8' : '#ffffff';
                    return (
                      <Box
                        key={sale.id}
                        onClick={() => resumeParkedSale(sale)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          minHeight: 89,
                          boxSizing: 'border-box',
                          p: '16px',
                          bgcolor: rowBgColor,
                          cursor: 'pointer',
                        }}
                      >
                        <Box sx={{ mr: 2, flexShrink: 0 }}>
                          <Avatar
                            sx={{
                              bgcolor: '#1976d2',
                              width: 40,
                              height: 40,
                              fontSize: '1.2rem',
                              fontWeight: 'bold'
                            }}
                          >
                            P
                          </Avatar>
                        </Box>

                        <Box sx={{ flex: '0 0 200px', mr: 2 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 500,
                              mb: 0.5,
                              fontSize: '0.95rem'
                            }}
                          >
                            {formattedDate}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 500,
                              mb: 0.5,
                              fontSize: '0.95rem'
                            }}
                          >
                            {formattedTime}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: '#666',
                              fontSize: '0.85rem'
                            }}
                          >
                            {sale.saleNumber}
                          </Typography>
                        </Box>

                        <Box sx={{ flex: '1 1 auto', minWidth: 100, display: 'flex', gap: 4, alignItems: 'flex-start' }}>
                          <Typography
                            variant="body1"
                            sx={{
                              fontWeight: 400,
                              fontSize: '1rem'
                            }}
                          >
                            {employeeName}
                          </Typography>
                          {/* Reference: SALE NOTE / INTERNAL NOTE columns (11px caps label + text). */}
                          {sale.notes && (
                            <Box>
                              <Typography sx={{ display: 'block', fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: '#666' }}>
                                Sale Note
                              </Typography>
                              <Typography sx={{ fontSize: 14, color: '#000' }}>
                                {sale.notes}
                              </Typography>
                            </Box>
                          )}
                          {sale.internalNotes && (
                            <Box>
                              <Typography sx={{ display: 'block', fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: '#666' }}>
                                Internal Note
                              </Typography>
                              <Typography sx={{ fontSize: 14, color: '#000' }}>
                                {sale.internalNotes}
                              </Typography>
                            </Box>
                          )}
                        </Box>

                        {/* Reference row actions: row click = Load; Merge combines the
                            current cart into this held sale; Remove discards it. */}
                        <Box sx={{ flexShrink: 0, display: 'flex', gap: 1, mr: 1 }} onClick={(e) => e.stopPropagation()}>
                          {cart.length > 0 && (
                            <Box
                              role="button"
                              onClick={() => mergeIntoParkedSale(sale)}
                              sx={{ px: 1.5, py: 0.5, border: '1px solid #0084d1', color: '#0084d1', fontSize: 13, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                            >
                              Merge Sale
                            </Box>
                          )}
                          <Box
                            role="button"
                            onClick={() => removeParkedSale(sale)}
                            sx={{ px: 1.5, py: 0.5, border: '1px solid #e33430', color: '#e33430', fontSize: 13, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                          >
                            Remove
                          </Box>
                        </Box>

                        <Box sx={{
                          flex: '0 0 180px',
                          textAlign: 'right',
                          ml: 2
                        }}>
                          {/* Big price with small cents (reference). */}
                          <Typography
                            variant="h6"
                            sx={{
                              fontWeight: 'bold',
                              fontSize: '1.5rem',
                              mb: 0.25,
                              lineHeight: 1.2
                            }}
                          >
                            ${amtDollars}
                            <Box component="span" sx={{ fontSize: '0.95rem' }}>.{amtCents}</Box>
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              fontSize: '0.9rem',
                              color: '#666',
                              mb: 0.5
                            }}
                          >
                            ${formattedAmount}
                          </Typography>
                          {customerName && (
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 500,
                                fontSize: '0.95rem',
                                textTransform: 'uppercase'
                              }}
                            >
                              {customerName}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              )}
              </Box>
            </Box>
          )}

          {/* Reference: Add Customer swaps the actions pane for the customer
              picker — Back / Create New toolbar + zebra customer list; the
              search box above filters it. */}
          {!showPromotionView && !showClassificationView && isCustomerSearchMode && (
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', bgcolor: '#fff' }}>
              <Box sx={{ height: 55, flexShrink: 0, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, borderBottom: '1px solid #000' }}>
                {[
                  { label: '← Back', onClick: exitCustomerSearchMode },
                  { label: 'Create New', onClick: () => setShowCreateCustomerModal(true) },
                ].map((b) => (
                  <Box
                    key={b.label}
                    component="button"
                    type="button"
                    onClick={b.onClick}
                    sx={{ border: 0, bgcolor: 'transparent', p: 0, fontFamily: 'inherit', fontSize: '19.2px', color: '#000', cursor: 'pointer' }}
                  >
                    {b.label}
                  </Box>
                ))}
              </Box>
              <Box sx={{ flex: 1, overflowY: 'auto' }}>
                {searchResults.customers.length > 0 ? (
                  searchResults.customers.map((customer, idx) => renderCustomerRow(customer, idx))
                ) : (
                  <Typography sx={{ p: 4, textAlign: 'center', color: '#757575' }}>
                    No customers found
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          {/* Shop MyLocal / IBA E-Commerce tab — placeholder feed (integration TBD). */}
          {!showPromotionView && !showClassificationView && !isCustomerSearchMode && !searchResultsVisible && activeTab === 'ecommerce' && (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: 'white', color: 'text.secondary', gap: 1 }}>
              <Typography variant="h6" sx={{ color: '#bdbdbd' }}>Shop MyLocal / IBA E-Commerce</Typography>
              <Typography variant="body2">Online orders will appear here once the integration is connected.</Typography>
            </Box>
          )}

          {(showPromotionView || showClassificationView || activeTab === 'sales-keys') && !isCustomerSearchMode && !searchResultsVisible && (
          <Box sx={{
            position: 'relative',
            flex: 1,
            // Reference keys container: #f8f8f8 surface, square corners, scrolls
            // natively when the key set overflows.
            bgcolor: '#f8f8f8',
            borderRadius: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            minWidth: 0, // Prevents flex item from overflowing
            display: 'flex',
            flexDirection: 'column'
          }}>
            {showPromotionView ? (
              <PromotionProductsView
                promotionTypeFilter={promotionTypeFilter}
                onTypeChange={(type) => {
                  setPromotionTypeFilter(type);
                  loadPromotionProducts(type);
                }}
                promotionSearchTerm={promotionSearchTerm}
                onSearchChange={setPromotionSearchTerm}
                loadingPromotionProducts={loadingPromotionProducts}
                promotionProducts={promotionProducts}
                selectedPromotionProduct={selectedPromotionProduct}
                onProductSelect={setSelectedPromotionProduct}
                onAddToSale={handleAddProductFromSearch}
                onBack={() => {
                  setShowPromotionView(false);
                  setSelectedPromotionProduct(null);
                }}
                ensureRegisterControl={ensureRegisterControl}
              />
            ) : showClassificationView ? (
              <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'white' }}>
                {/* Header */}
                <Box sx={{ 
                  p: 1.5, 
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  bgcolor: 'white',
                  borderBottom: '1px solid #e0e0e0',
                  minHeight: 56
                }}>
                  <IconButton 
                    onClick={() => {
                      setShowClassificationView(false);
                      setSelectedClassificationProduct(null);
                    }}
                    sx={{ color: '#000000' }}
                  >
                    <ArrowBackIcon />
                  </IconButton>
                  <Typography variant="h6" sx={{ color: '#000000', fontWeight: 600 }}>
                    {currentClassification?.name || 'Classification Products'}
                  </Typography>
                </Box>

                {/* Search */}
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                  <TextField
                    fullWidth
                    placeholder="Search products..."
                    value={classificationSearchTerm}
                    onChange={(e) => setClassificationSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    }}
                  />
                </Box>

                {/* Products List */}
                <Box sx={{ flex: 1, overflow: 'auto' }}>
                  {loadingClassificationProducts ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                      <CircularProgress />
                    </Box>
                  ) : classificationProducts.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column' }}>
                      <Typography variant="h6" color="text.secondary">No products found</Typography>
                    </Box>
                  ) : (
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Product</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }} align="right">Price</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }} align="center">Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {classificationProducts
                          .filter(product => {
                            if (!classificationSearchTerm) return true;
                            const search = classificationSearchTerm.toLowerCase();
                            return product.name?.toLowerCase().includes(search);
                          })
                          .map((product) => (
                            <TableRow key={product.id} hover>
                              <TableCell>{product.name}</TableCell>
                              <TableCell align="right">${(product.retailPrice || 0).toFixed(2)}</TableCell>
                              <TableCell align="center">
                                <Button
                                  variant="contained"
                                  size="small"
                                  onClick={async () => {
                                    const ok = await ensureRegisterControl();
                                    if (!ok) return;
                                    
                                    try {
                                      const fullProduct =
                                        resolveProductLocal(product, product.name) || product;
                                      
                                      if (useCaseQuantity) {
                                        // For case quantity, multiply by itemsPerCase
                                        const itemsPerCase = getItemsPerCase(fullProduct);
                                        const caseQuantity = 1; // Default to 1 case
                                        const quantity = caseQuantity * itemsPerCase;
                                        
                                        // Add product with case quantity (addQuantity
                                        // param — a wrapper `quantity` field is only
                                        // honored for promotion items).
                                        await handleAddProductFromSearch({ product: fullProduct }, quantity);
                                      } else {
                                        await handleAddProductFromSearch({ product: fullProduct });
                                      }
                                      
                                      // Don't close view for case quantity mode (user might want to add more)
                                      if (!useCaseQuantity) {
                                        setShowClassificationView(false);
                                      }
                                    } catch (error) {
                                      console.error('Error adding product from classification:', error);
                                      alert(error.message || 'Failed to add product to sale');
                                    }
                                  }}
                                  sx={{ bgcolor: '#4CAF50', '&:hover': { bgcolor: '#45a049' } }}
                                >
                                  {useCaseQuantity ? 'Add Case' : 'Add to Sale'}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  )}
                </Box>
              </Box>
            ) : (
              <>
                {currentFolder && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.25, borderBottom: '1px solid #e0e0e0', bgcolor: 'white' }}>
                    <IconButton size="small" onClick={goBackToMain} sx={{ color: '#313439' }} aria-label="Back to Home Keys">
                      <ArrowBackIcon fontSize="small" />
                    </IconButton>
                    <Typography variant="body2" sx={{ color: '#676b72' }}>
                      <Box
                        component="span"
                        onClick={goBackToMain}
                        sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                      >
                        Home Keys
                      </Box>
                      {' / '}
                      <Box component="span" sx={{ fontWeight: 600, color: '#313439' }}>{currentFolderName}</Box>
                    </Typography>
                  </Box>
                )}
                {useCaseQuantity && (
                  <Box sx={{ px: 1.5, py: 0.5, bgcolor: '#0284c7', color: '#f8f8f8', fontSize: 13, fontWeight: 600 }}>
                    Case quantity mode — the next product added will use its case quantity
                  </Box>
                )}
                <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
                  <SaleKeysGrid
                    saleKeyConfig={saleKeyConfig}
                    cart={cart}
                    onSaleKeyClick={handleSaleKeyClick}
                    getIconForSaleKey={getIconForSaleKey}
                    caseModeActive={useCaseQuantity}
                  />
                </Box>
              </>
            )}
          </Box>
          )}
            </Box>
          </Box>

        {!showFinalizeDialog && (
        <Box sx={{
          flex: '29.7 1 0',
          minWidth: '300px',
          bgcolor: 'white',
          display: 'flex',
          visibility: 'visible',
          m: '8px',
          ml: 0,
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 1
        }}>
          {/* Reference scrolls the line-item list only, never the cart column, so the Add
              Customer row and totals stay pinned. minHeight:0 keeps the flex child shrinking
              once it is no longer a scroll container. The sale-complete receipt is rendered
              inline below and has no scroller of its own, so it keeps overflow:auto. */}
          <Box sx={{ flex: 1, minHeight: 0, overflow: isTransactionComplete && receiptData ? 'hidden' : 'visible' }}>
            {isTransactionComplete && receiptData ? (
              // Reference pins Done to the bottom of the column and scrolls only the
              // receipt above it, so the button never floats under a short receipt.
              // Same 1px black frame the open-sale sidebar carries (reference wraps
              // the whole right column, both states).
              <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, boxSizing: 'border-box', border: '1px solid #000', bgcolor: '#fff' }}>
                {/* Sidebar chrome measured on the reference (2026-08-03/05): square
                    green banner 109px tall, Roboto 64/700 #f8f8f8 on #2ca03b; three
                    equal square #1c86f2 buttons 51px with BLACK 16/400 labels and no
                    gap; a bare full-width 42px template select; then the receipt at
                    natural width, centred. Everything above Done scrolls. */}
                {/* Sidebar chrome re-measured on the LIVE reference 2026-08-13
                    (.sale-receipt-print): the green banner only exists when the
                    sale HAS change (.has-change) and reads "Change" 24/700 over
                    the amount 64/700 with 0.7em cents; the action bar is 3 equal
                    #1c86f2 buttons with #f8f8f8 labels, hairlines top/bottom and
                    between; a bordered 42px template field; the receipt centred
                    on an #f8f8f8 stage; Done pinned below. */}
                <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ flexShrink: 0, bgcolor: '#2ca03b', color: '#f8f8f8', p: '16px', textAlign: 'center' }}>
                    {(parseFloat(receiptData?.change) || 0) > 0 ? (
                      <>
                        <Typography sx={{ fontWeight: 700, fontSize: '24px', lineHeight: 'normal', color: 'inherit' }}>
                          Change
                        </Typography>
                        <Typography component="div" sx={{ fontWeight: 700, fontSize: '64px', lineHeight: 'normal', color: 'inherit' }}>
                          {(() => {
                            const [dollars, cents] = (parseFloat(receiptData.change) || 0).toFixed(2).split('.');
                            return (
                              <>
                                ${dollars}.
                                <Box component="span" sx={{ fontSize: '0.7em' }}>{cents}</Box>
                              </>
                            );
                          })()}
                        </Typography>
                      </>
                    ) : (
                      // No change to hand back — the banner reads Sale Complete instead.
                      <Typography component="div" sx={{ fontWeight: 700, fontSize: '64px', lineHeight: 1.1, color: 'inherit', whiteSpace: 'nowrap' }}>
                        Sale Complete
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{
                    flexShrink: 0,
                    display: 'flex',
                    borderTop: '1px solid #000',
                    borderBottom: '1px solid #000',
                    '& .MuiButton-root': {
                      flex: 1,
                      minWidth: 0,
                      height: 51,
                      borderRadius: 0,
                      boxShadow: 'none',
                      textTransform: 'none',
                      fontSize: '16px',
                      fontWeight: 400,
                      color: '#f8f8f8',
                      bgcolor: '#1c86f2',
                      borderRight: '1px solid #000',
                      '&:last-of-type': { borderRight: 0 },
                      '&:hover': { bgcolor: '#1c86f2', boxShadow: 'none' },
                    },
                  }}>
                    <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrintReceipt}>Print</Button>
                    <Button variant="contained" startIcon={<PersonAddIcon />}>Add Customer</Button>
                    <Button variant="contained" startIcon={<EmailIcon />} onClick={handleEmailReceipt}>Email</Button>
                  </Box>

                  {/* Template field: white, 1px #5a5a5a, 8px radius, with the
                      "Receipt" label sitting inline to the left of the value. */}
                  <Box sx={{ flexShrink: 0, p: '8px' }}>
                    <FormControl fullWidth>
                      <Select
                        value={selectedTemplate?.id || ''}
                        onChange={(e) => {
                          const template = receiptTemplates.find(t => t.id === e.target.value);
                          setSelectedTemplate(template);
                        }}
                        disabled={templatesLoading}
                        displayEmpty
                        renderValue={(id) => {
                          // Reference labels the field "Receipt"; the template name
                          // sits beside it unless it just repeats the label.
                          const name = receiptTemplates.find(t => t.id === id)?.name || '';
                          return (
                            <Box component="span" sx={{ display: 'flex', gap: '16px', color: '#000' }}>
                              <span>Receipt</span>
                              {name.toLowerCase() !== 'receipt' && <span>{name}</span>}
                            </Box>
                          );
                        }}
                        sx={{
                          height: 42,
                          bgcolor: '#fff',
                          borderRadius: '8px',
                          fontSize: '16px',
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#5a5a5a' },
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#5a5a5a' },
                          '& .MuiSelect-select': { display: 'flex', alignItems: 'center', px: '16px' },
                        }}
                      >
                        {receiptTemplates.map((template) => (
                          <MenuItem key={template.id} value={template.id}>
                            {template.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>

                  <Box sx={{ flex: '1 1 0px', minHeight: 0, overflow: 'auto', bgcolor: '#f8f8f8', p: '16px' }}>
                    <Box sx={{ width: 'fit-content', m: 'auto', bgcolor: '#fff', border: '1px solid #000', p: '15px' }}>
                      <ScaleToFit>
                        <ReceiptRenderer receiptData={receiptData} template={selectedTemplate} preview />
                      </ScaleToFit>
                    </Box>
                  </Box>
                </Box>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => {
                    saleEpochRef.current++;
                    setCart([]);
                    setPayments([]);
                    setSelectedCustomer(null);
                    setIsTransactionComplete(false);
                    setShowReceipt(false);
                    setTransactionId(null);
                    setShowPrintDialog(false);
                    setReceiptData(null);
                    setLoyaltyRedemption(null);
                    setLoyaltyCalculation(null);
                  }}
                  sx={{
                    flexShrink: 0,
                    bgcolor: '#1c86f2',
                    color: '#f8f8f8',
                    height: 54,
                    fontSize: '32px',
                    fontWeight: 400,
                    lineHeight: 1,
                    textTransform: 'none',
                    borderRadius: 0,
                    boxShadow: 'none',
                    '&:hover': { bgcolor: '#1573d4', boxShadow: 'none' },
                  }}
                >
                  Done
                </Button>
              </Box>
            ) : showProductDetail && selectedProductDetail ? (
              // Product Detail View in Sidebar
              <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Whole bar is clickable (reference) */}
                <Box
                  onClick={() => setShowProductDetail(false)}
                  sx={{ bgcolor: '#5ebbeb', color: '#f8f8f8', height: 60, px: '16px', display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer', flexShrink: 0, userSelect: 'none' }}
                >
                  <ArrowBackIcon sx={{ fontSize: 24 }} />
                  <Typography sx={{ fontSize: '20.8px', fontWeight: 400 }}>
                    Return to Sale
                  </Typography>
                </Box>

                {/* Scrollable Product Detail Content */}
                <Box sx={{ flex: 1, overflowY: 'auto' }}>
                  {/* Product Name and Price Header */}
                  <Box sx={{ px: '16px', height: 60, borderBottom: '1px solid #000', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontSize: '22.4px', fontWeight: 400, color: '#000', lineHeight: '27px', letterSpacing: 'normal' }}>
                      {selectedProductDetail.name}
                    </Typography>
                    <Typography sx={{ fontSize: '22.4px', fontWeight: 400, color: '#000', lineHeight: '27px', letterSpacing: 'normal' }}>
                      ${Number(selectedProductDetail.retailPrice || selectedProductDetail.prices?.[0]?.price || 0).toFixed(2)}
                    </Typography>
                  </Box>

                  {/* Add Note strip (product note prints on the receipt) */}
                  <Box
                    onClick={async () => {
                      const target = productDetailCartItem;
                      if (!target) return;
                      const note = await prompt('Product note:', target.note || '', { title: 'Add note' });
                      if (note === null) return;
                      setCart(prev => prev.map(i =>
                        (i.id === target.id && i.timestamp === target.timestamp ? { ...i, note } : i)));
                      setProductDetailCartItem(prev => (prev ? { ...prev, note } : prev));
                      setSelectedCartItem(prev =>
                        (prev && prev.id === target.id && prev.timestamp === target.timestamp ? { ...prev, note } : prev));
                    }}
                    sx={{ height: 36, borderBottom: '1px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <AddIcon sx={{ fontSize: 16, color: '#000' }} />
                    <Typography sx={{ fontSize: 16, color: '#000' }}>Add Note</Typography>
                  </Box>

                  {/* Show Costs button (reference: gray eye button, not a switch) */}
                  <Box sx={{ height: 40, borderBottom: '1px solid #000', display: 'flex', alignItems: 'center', px: '16px' }}>
                    <Box
                      onClick={() => setShowDetailCosts(v => !v)}
                      sx={{ width: 130, height: 39, p: '4px 8px', bgcolor: showDetailCosts ? '#d1d5db' : '#e5e7eb', color: '#000', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderRadius: '6px', cursor: 'pointer', transition: 'background-color 0.2s, color 0.2s', userSelect: 'none' }}
                    >
                      <VisibilityOutlinedIcon sx={{ fontSize: 18 }} />
                      Show Costs
                    </Box>
                  </Box>

                  {/* Inventory band */}
                  <Box sx={{ height: 40, borderBottom: '1px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                    <Typography sx={{ fontSize: '19.2px', fontWeight: 400, color: '#000' }}>
                      {selectedProductDetail.currentStockCases || 0} Cases
                    </Typography>
                    <Typography sx={{ fontSize: '19.2px', fontWeight: 400, color: '#000' }}>
                      {selectedProductDetail.currentStockItems || 0} Items
                    </Typography>
                  </Box>

                  {/* Case Quantity / Category label:value rows */}
                  <Box sx={{ borderBottom: '1px solid #000', py: '4px' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', height: 27, pl: '8px', fontSize: 16, color: '#000' }}>
                      <Box sx={{ width: 110, flexShrink: 0 }}>Case Quantity</Box>
                      <Box>{selectedProductDetail.caseQuantity || 1}</Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', height: 27, pl: '8px', fontSize: 16, color: '#000' }}>
                      <Box sx={{ width: 110, flexShrink: 0 }}>Category</Box>
                      <Box>{selectedProductDetail.category?.name || 'OTHER'}</Box>
                    </Box>
                    {showDetailCosts && (
                      <Box sx={{ display: 'flex', alignItems: 'center', height: 27, pl: '8px', fontSize: 16, color: '#000' }}>
                        <Box sx={{ width: 110, flexShrink: 0 }}>Cost</Box>
                        <Box>${Number(selectedProductDetail.itemCost || 0).toFixed(2)}</Box>
                      </Box>
                    )}
                  </Box>

                  {/* Prices Section */}
                  <Box sx={{ borderBottom: '1px solid #000' }}>
                    <Box
                      onClick={() => setProductDetailExpanded(prev => ({ ...prev, prices: !prev.prices }))}
                      sx={{ height: 33, px: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    >
                      <Typography sx={{ fontSize: 16, fontWeight: 400 }}>Prices</Typography>
                      {productDetailExpanded.prices ? <RemoveIcon sx={{ fontSize: 16 }} /> : <AddIcon sx={{ fontSize: 16 }} />}
                    </Box>
                    {productDetailExpanded.prices &&
                    Array.isArray(selectedProductDetail.prices) && selectedProductDetail.prices.length > 0 && (
                      <Box sx={{ px: 2, pb: 2 }}>
                        <Grid container spacing={2} sx={{ mb: 1 }}>
                          <Grid item xs={4}>
                            <Typography variant="caption" sx={{ fontWeight: 'bold' }}>Quantity</Typography>
                          </Grid>
                          <Grid item xs={4}>
                            <Typography variant="caption" sx={{ fontWeight: 'bold' }}>Price</Typography>
                          </Grid>
                          <Grid item xs={4}>
                            <Typography variant="caption" sx={{ fontWeight: 'bold' }}>Price Set</Typography>
                          </Grid>
                        </Grid>
                        {selectedProductDetail.prices.map((price, index) => (
                          <Grid container spacing={2} key={index} sx={{ mb: 0.5 }}>
                            <Grid item xs={4}>
                              <Typography variant="body2">{price.quantity}</Typography>
                            </Grid>
                            <Grid item xs={4}>
                              <Typography variant="body2">${Number(price.price || 0).toFixed(2)}</Typography>
                            </Grid>
                            <Grid item xs={4}>
                              <Typography variant="body2">-</Typography>
                            </Grid>
                          </Grid>
                        ))}
                      </Box>
                    )}
                  </Box>

                  {/* Additional Fields Section */}
                  <Box sx={{ borderBottom: '1px solid #000' }}>
                    <Box
                      onClick={() => setProductDetailExpanded(prev => ({ ...prev, additionalFields: !prev.additionalFields }))}
                      sx={{ height: 33, px: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    >
                      <Typography sx={{ fontSize: 16, fontWeight: 400 }}>Additional Fields</Typography>
                      {productDetailExpanded.additionalFields ? <RemoveIcon sx={{ fontSize: 16 }} /> : <AddIcon sx={{ fontSize: 16 }} />}
                    </Box>
                    {productDetailExpanded.additionalFields && (
                    <Box sx={{ px: 2, pb: 2 }}>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <Typography variant="caption" color="text.secondary">Sell on Shop MyLocal</Typography>
                          <Typography variant="body2">{selectedProductDetail.sellOnShopMyLocal ? 'True' : 'False'}</Typography>
                        </Grid>
                      </Grid>
                    </Box>
                    )}
                  </Box>

                  {/* Purchases Section */}
                  <Box sx={{ borderBottom: '1px solid #000' }}>
                    <Box
                      onClick={() => setProductDetailExpanded(prev => ({ ...prev, purchases: !prev.purchases }))}
                      sx={{ height: 33, px: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    >
                      <Typography sx={{ fontSize: 16, fontWeight: 400 }}>Purchases</Typography>
                      {productDetailExpanded.purchases ? <RemoveIcon sx={{ fontSize: 16 }} /> : <AddIcon sx={{ fontSize: 16 }} />}
                    </Box>
                    {productDetailExpanded.purchases && (
                    <Box sx={{ px: 2, pb: 2 }}>
                      <Grid container spacing={2}>
                        <Grid item xs={4}>
                          <Typography variant="caption" sx={{ fontWeight: 'bold' }}>Order</Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="caption" sx={{ fontWeight: 'bold' }}>Quantity</Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="caption" sx={{ fontWeight: 'bold' }}>Order Date</Typography>
                        </Grid>
                      </Grid>
                    </Box>
                    )}
                  </Box>

                  {/* Inventory Section */}
                  <Box sx={{ borderBottom: '1px solid #000' }}>
                    <Box
                      onClick={() => setProductDetailExpanded(prev => ({ ...prev, inventory: !prev.inventory }))}
                      sx={{ height: 33, px: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    >
                      <Typography sx={{ fontSize: 16, fontWeight: 400 }}>Inventory</Typography>
                      {productDetailExpanded.inventory ? <RemoveIcon sx={{ fontSize: 16 }} /> : <AddIcon sx={{ fontSize: 16 }} />}
                    </Box>
                    {productDetailExpanded.inventory && (
                    <Box sx={{ px: 2, pb: 2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                        Top Drops Rossmore
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="body2">{selectedProductDetail.currentStockCases || 0}</Typography>
                          <Typography variant="caption" color="text.secondary">Cases</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2">{selectedProductDetail.currentStockItems || 0}</Typography>
                          <Typography variant="caption" color="text.secondary">Items</Typography>
                        </Grid>
                      </Grid>
                    </Box>
                    )}
                  </Box>
                </Box>
              </Box>
            ) : (
              <CartSidebar
                isTransactionComplete={isTransactionComplete}
                receiptData={receiptData}
                selectedTemplate={selectedTemplate}
                receiptTemplates={receiptTemplates}
                templatesLoading={templatesLoading}
                onTemplateChange={setSelectedTemplate}
                onPrintReceipt={handlePrintReceipt}
                onEmailReceipt={handleEmailReceipt}
                onNewTransaction={() => {
                  saleEpochRef.current++;
                  setCart([]);
                  setPayments([]);
                  setSelectedCustomer(null);
                  setIsTransactionComplete(false);
                  setShowReceipt(false);
                  setTransactionId(null);
                  setShowPrintDialog(false);
                  setReceiptData(null);
                  setLoyaltyRedemption(null);
                  setLoyaltyCalculation(null);
                  setCurrentParkedSaleId(null);
                }}
                selectedCustomer={selectedCustomer}
                onAddCustomerClick={handleAddCustomerClick}
                onRemoveCustomer={handleRemoveCustomer}
                onCustomerClick={() => setShowAttachedCustomerDialog(true)}
                onCreateCustomerClick={() => setShowCreateCustomerModal(true)}
                getEffectiveOutletId={getEffectiveOutletId}
                cart={cart}
                selectedCartItem={selectedCartItem}
                onCartItemSelect={setSelectedCartItem}
                onRemoveItem={handleRemoveItem}
                onDiscountConfirm={handleDiscountConfirm}
                isManualDiscountBlocked={isManualDiscountBlocked}
                canDiscount={canDiscount}
                onWarn={setSaleWarning}
                onUnlockPrice={handleUnlockPrice}
                onEditNote={handleEditLineNote}
                onQuantityKeypadClick={handleOpenQuantityKeypad}
                onProductDetailClick={handleOpenProductDetail}
                showLiveProfit={showLiveProfit && canViewLiveProfit}
                canViewLiveProfit={canViewLiveProfit}
                payments={payments}
                onReversePayment={handleReversePayment}
                calculateTotal={calculateTotal}
                calculateTotalPayments={calculateTotalPayments}
                calculateRemainingBalance={calculateRemainingBalance}
                onLoyaltyCalculated={(calculation) => {
                  setLoyaltyCalculation(calculation);
                  console.log('Loyalty calculated:', calculation);
                }}
                onRedemptionApplied={(redemption) => {
                  setLoyaltyRedemption(redemption);
                  if (redemption && redemption.items) {
                    setCart(prevCart => {
                      return prevCart.map((item, index) => {
                        const redemptionItem = redemption.items[index];
                        if (redemptionItem && redemptionItem.redemptionApplied) {
                          return {
                            ...item,
                            redemptionDiscount: redemptionItem.redemptionApplied,
                            totalPrice: Math.max(0, (item.totalPrice || 0) - (redemptionItem.redemptionApplied || 0))
                          };
                        }
                        return item;
                      });
                    });
                  } else {
                    setCart(prevCart => {
                      return prevCart.map(item => ({
                        ...item,
                        redemptionDiscount: 0
                      }));
                    });
                  }
                }}
                setCart={setCart}
                setLoyaltyRedemption={setLoyaltyRedemption}
                setLoyaltyCalculation={setLoyaltyCalculation}
                onParkSale={parkCurrentSale}
                onFinalize={handleOpenFinalizeDialog}
                showPromotionView={showPromotionView}
                selectedPromotionProduct={selectedPromotionProduct}
                transactionId={transactionId}
              />
            )}
          </Box>
        </Box>
        )}
        </>
        )}
      </Box>
      
      <Drawer
        anchor="right"
        open={showProductSidebar}
        onClose={closeProductDetails}
        PaperProps={{ sx: { width: 380 } }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ bgcolor: '#90CAF9', color: '#0d47a1', p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={closeProductDetails} size="small" sx={{ color: '#0d47a1' }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="subtitle1" sx={{ flex: 1 }}>
              Return to Sale
              </Typography>
            {productDetails && (
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                ${Number(productDetails?.product?.retailPrice || productDetails?.retailPrice || productDetails?.prices?.[0]?.price || 0).toFixed(2)}
              </Typography>
            )}
          </Box>

          <Box sx={{ p: 2, overflow: 'auto' }}>
            {productDetailsLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            )}

            {!productDetailsLoading && productDetails && (
              <>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {productDetails.product?.name || productDetails.name}
              </Typography>
                <Divider sx={{ mb: 2 }} />

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2 }}>
                    <Box>
                    <Typography variant="caption" color="text.secondary">Case Quantity</Typography>
                    <Typography variant="body2">{productDetails.product?.caseQuantity ?? productDetails.caseQuantity ?? '-'}</Typography>
                    </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Brand</Typography>
                    <Typography variant="body2">{productDetails.product?.brand?.name || productDetails.brand?.name || '-'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Category</Typography>
                    <Typography variant="body2">{productDetails.product?.category?.name || productDetails.category?.name || '-'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Tags</Typography>
                    <Typography variant="body2">{(productDetails.product?.tags || productDetails.tags || []).map(t => t.name || t.tag?.name).filter(Boolean).join(', ') || '-'}</Typography>
                  </Box>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>Prices</Typography>
                  <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', px: 1, py: 0.5, bgcolor: '#fafafa', borderBottom: '1px solid #e0e0e0', fontWeight: 600 }}>
                      <Box sx={{ width: 100 }}>Quantity</Box>
                      <Box sx={{ flex: 1 }}>Price</Box>
                    </Box>
                    {((productDetails.product?.prices) || productDetails.prices || []).map((p, i) => (
                      <Box key={i} sx={{ display: 'flex', px: 1, py: 0.75, borderBottom: '1px solid #eee' }}>
                        <Box sx={{ width: 100 }}>{p.quantity}</Box>
                        <Box sx={{ flex: 1 }}>${Number(p.price || 0).toFixed(2)}</Box>
                      </Box>
                    ))}
                  </Box>
              </Box>
              
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>Inventory</Typography>
                  <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', px: 1, py: 0.5, bgcolor: '#fafafa', borderBottom: '1px solid #e0e0e0', fontWeight: 600 }}>
                      <Box sx={{ flex: 1 }}>Location</Box>
                      <Box sx={{ width: 100, textAlign: 'right' }}>Items</Box>
                    </Box>
                    <Box sx={{ display: 'flex', px: 1, py: 0.75 }}>
                      <Box sx={{ flex: 1 }}>Current Outlet</Box>
                      <Box sx={{ width: 100, textAlign: 'right' }}>{productDetails.product?.currentStockItems ?? productDetails.currentStockItems ?? 0}</Box>
                    </Box>
                  </Box>
              </Box>
              
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>Barcodes</Typography>
                  <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', px: 1, py: 0.5, bgcolor: '#fafafa', borderBottom: '1px solid #e0e0e0', fontWeight: 600 }}>
                      <Box sx={{ width: 100 }}>Quantity</Box>
                      <Box sx={{ flex: 1 }}>Barcode</Box>
            </Box>
                    {((productDetails.product?.barcodes) || productDetails.barcodes || []).map((b, i) => (
                      <Box key={i} sx={{ display: 'flex', px: 1, py: 0.75, borderBottom: '1px solid #eee' }}>
                        <Box sx={{ width: 100 }}>{b.quantity ?? '-'}</Box>
                        <Box sx={{ flex: 1 }}>{b.barcode ?? b}</Box>
          </Box>
                    ))}
                  </Box>
                </Box>
              </>
        )}
      </Box>
        </Box>
      </Drawer>

      <Dialog 
        open={showPrintDialog} 
        onClose={handleClosePrintDialog}
        maxWidth="sm"
        fullWidth
        sx={{
          zIndex: 1400, // Ensure it appears above other dialogs
        }}
        PaperProps={{
          sx: {
            zIndex: 1400,
          }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: '#4CAF50', 
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PrintIcon />
            Print Receipt
          </Box>
          <IconButton onClick={handleClosePrintDialog} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="h4" sx={{ color: '#4CAF50', fontWeight: 'bold', mb: 1 }}>
              Transaction Complete!
            </Typography>
            <Typography variant="h5" sx={{ color: '#FF9800', fontWeight: 'bold' }}>
              Change: ${receiptData ? (parseFloat(receiptData.change) || 0).toFixed(2) : '0.00'}
            </Typography>
          </Box>
          
          <Typography variant="body1" sx={{ mb: 2, textAlign: 'center' }}>
            Receipt has been generated for transaction {receiptData?.transactionId}
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            Would you like to print or email the receipt?
          </Typography>
        </DialogContent>
        
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={handlePrintReceipt}
            sx={{ 
              bgcolor: '#4CAF50',
              flex: 1,
              '&:hover': { bgcolor: '#45a049' }
            }}
          >
            Print
          </Button>
          <Button
            variant="contained"
            startIcon={<EmailIcon />}
            onClick={handleEmailReceipt}
            sx={{ 
              bgcolor: '#2196F3',
              flex: 1,
              '&:hover': { bgcolor: '#1976D2' }
            }}
          >
            Email
          </Button>
          <Button
            variant="outlined"
            onClick={handleClosePrintDialog}
            sx={{ minWidth: 80 }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
      {/* Reference "Register Takeover" dialog. */}
      <ShopfrontDialog
        open={showControlTakenDialog}
        icon={<InfoOutlinedIcon sx={{ fontSize: 'inherit' }} />}
        title="Register Takeover"
        message={`${controlTakenByName} has taken over this register.`}
        actions={[
          {
            label: 'Choose Location',
            onClick: () => {
              setShowControlTakenDialog(false);
              clearSelectedRegister();
              openLocationSelector({ force: true });
            },
          },
          {
            label: 'Take Back Control',
            onClick: async () => {
              const id = parseInt(localStorage.getItem('selectedRegisterId'));
              try {
                await registerService.takeControl(id);
                lastRegisterControlCheckRef.current = Date.now();
                setShowControlTakenDialog(false);
              } catch {
                // Leave the dialog up so they can choose a location instead.
              }
            },
          },
        ]}
      />

      <AddSaleKeyDialog
        open={showAddSaleKeyDialog}
        onClose={handleCloseAddSaleKeyDialog}
        newSaleKey={newSaleKey}
        setNewSaleKey={setNewSaleKey}
        availableProducts={availableProducts}
        loadingProducts={loadingProducts}
        availablePaymentMethods={availablePaymentMethods}
        onActionChange={handleActionChange}
        onProductSelection={handleProductSelection}
        onImageUpload={handleImageUpload}
        onAddSaleKey={handleAddSaleKey}
        getIconForSaleKey={getIconForSaleKey}
      />

      <Dialog
        open={showGiftCardPopup}
        onClose={handleGiftCardCancel}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
          }
        }}
      >
        <DialogContent sx={{ p: 4, textAlign: 'center' }}>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              backgroundColor: '#2196F3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 3
            }}
          >
            <OfferIcon sx={{ fontSize: 40, color: 'white' }} />
          </Box>

          <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
            Gift Card Code
          </Typography>

          <Typography variant="body1" sx={{ mb: 4, color: 'text.secondary' }}>
            Please enter or scan the gift card's code
          </Typography>

          <TextField
            fullWidth
            value={giftCardCode}
            onChange={(e) => setGiftCardCode(e.target.value)}
            placeholder="Enter gift card code..."
            variant="outlined"
            sx={{
              mb: 3,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                fontSize: '1.1rem'
              }
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleGiftCardSubmit();
              }
            }}
            disabled={giftCardLoading}
          />

          {giftCardError && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {giftCardError}
            </Alert>
          )}

         
        </DialogContent>

        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button
            onClick={handleGiftCardCancel}
            variant="outlined"
            sx={{
              borderColor: '#ddd',
              color: '#666',
              '&:hover': {
                borderColor: '#bbb',
                backgroundColor: '#f5f5f5'
              }
            }}
            disabled={giftCardLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGiftCardSubmit}
            variant="contained"
            sx={{
              backgroundColor: '#2196F3',
              '&:hover': {
                backgroundColor: '#1976D2'
              }
            }}
            disabled={giftCardLoading || !giftCardCode.trim()}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>



      {/* STATE 3 - register selected but not Open: scrim over the sell area only */}
      {selectedRegister && selectedRegister.status !== 'Open' && geofenceValidated && (
        <Box sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          // 1200 = just under the app navbar (z 1201) so the navbar stays usable,
          // and under MUI dialogs (1300) so the location selector opens on top.
          zIndex: 1200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Box sx={{ width: 451, color: '#f8f8f8', textAlign: 'center' }}>
            <Typography sx={{ fontSize: 24, fontWeight: 400 }}>
              Outlet: {getOutletName()}
            </Typography>
            <Typography sx={{ fontSize: 36, fontWeight: 400, mb: '8px' }}>
              Register: {selectedRegister.name}
            </Typography>
            <Box
              component="button"
              onClick={handleOpenRegister}
              disabled={openingRegister}
              sx={{
                width: 451,
                height: 68,
                background: '#5ebbeb',
                color: '#f8f8f8',
                fontSize: 48,
                border: '1px solid #f8f8f8',
                borderRadius: 0,
                padding: '4px 8px',
                mb: '16px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                lineHeight: 1,
              }}
            >
              Open Register
            </Box>
            <Box
              component="button"
              onClick={() => openLocationSelector({ force: true })}
              sx={{
                width: 451,
                height: 53,
                background: '#e5e7eb',
                color: '#000',
                fontSize: 36,
                border: '1px solid #000',
                borderRadius: 0,
                padding: '4px 8px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                lineHeight: 1,
              }}
            >
              Change Register
            </Box>
          </Box>
        </Box>
      )}


      <CreateCustomerWizardModal
        open={showCreateCustomerModal}
        onClose={() => setShowCreateCustomerModal(false)}
        onCustomerCreated={(customer) => {
          // This callback is kept for any additional logic if needed
          setShowCreateCustomerModal(false);
        }}
        onOpenDetailsModal={(wizardData) => {
          setCustomerWizardData(wizardData);
          setShowCustomerDetailsModal(true);
        }}
      />

      {/* Attached-customer dialog — opened from the sidebar band's name area.
          Close returns with the customer still attached; a save refreshes the
          attached copy. (Full-screen Last-10-Sales layout is a separate task.) */}
      <CustomerDialog
        open={showAttachedCustomerDialog}
        onClose={() => setShowAttachedCustomerDialog(false)}
        customer={selectedCustomer}
        onCustomerSaved={(customer) => {
          if (customer) setSelectedCustomer(prev => (prev ? { ...prev, ...customer } : customer));
          setShowAttachedCustomerDialog(false);
        }}
      />

      {/* Request Quantity / Request Price / weight keypad prompt */}
      <RequestValueDialog request={valueRequest} onClose={() => setValueRequest(null)} />
      <RequestReasonDialog request={reasonRequest} onClose={() => setReasonRequest(null)} />

      <CustomerDetailsModal
        open={showCustomerDetailsModal}
        onClose={() => {
          setShowCustomerDetailsModal(false);
          setCustomerWizardData(null);
        }}
        wizardData={customerWizardData}
        onCustomerSaved={(customer) => {
          // Attach the new customer exactly like picking one from the list, so the
          // left panel leaves customer-search mode and returns to the Sales Keys grid.
          if (customer) {
            handleSelectCustomer(customer);
          }
        }}
      />

      {/* Quantity keypad - anchored popover beside the cart line (reference) */}
      <KeypadPopover
        open={showQuantityKeypad}
        anchorEl={keypadAnchorEl}
        onClose={() => {
          setShowQuantityKeypad(false);
          setKeypadAnchorEl(null);
        }}
        value={keypadValue}
        setValue={setKeypadValue}
        onOk={handleUpdateQuantityFromKeypad}
        mode="qty"
      />

      {/* Promotion Products Modal */}
      <Dialog
        open={showPromotionProducts}
        onClose={() => setShowPromotionProducts(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { height: '90vh' }
        }}
      >
        <DialogTitle sx={{ 
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => setShowPromotionProducts(false)} sx={{ color: 'white' }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h6">Promotion Products</Typography>
            <FormControl size="small" sx={{ minWidth: 120, ml: 2 }}>
              <Select
                value={promotionTypeFilter}
                onChange={(e) => {
                  setPromotionTypeFilter(e.target.value);
                  loadPromotionProducts(e.target.value);
                }}
                sx={{ 
                  color: 'white',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.8)' },
                  '& .MuiSvgIcon-root': { color: 'white' }
                }}
              >
                <MenuItem value="Current">Current</MenuItem>
                <MenuItem value="Future">Future</MenuItem>
                <MenuItem value="All">All</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <TextField
              fullWidth
              placeholder="Filter by product, classification or promotional category..."
              value={promotionSearchTerm}
              onChange={(e) => setPromotionSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
          </Box>
          <Box sx={{ height: 'calc(90vh - 180px)', overflow: 'auto' }}>
            {loadingPromotionProducts ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress />
              </Box>
            ) : promotionProducts.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column' }}>
                <Typography variant="h6" color="text.secondary">No promotion products found</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Try selecting a different type or check your promotions
                </Typography>
              </Box>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Product</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="right">Quantity</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="right">Price</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Start</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>End</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {promotionProducts
                    .filter(item => {
                      if (!promotionSearchTerm) return true;
                      const search = promotionSearchTerm.toLowerCase();
                      return (
                        item.product.name?.toLowerCase().includes(search) ||
                        item.promotionName?.toLowerCase().includes(search)
                      );
                    })
                    .map((item, index) => {
                      const startDate = item.startDate ? new Date(item.startDate).toLocaleDateString('en-GB') : '-';
                      const endDate = item.endDate ? new Date(item.endDate).toLocaleDateString('en-GB') : '-';
                      return (
                        <TableRow key={`${item.product.id}-${item.quantity}-${index}`} hover>
                          <TableCell>{item.product.name}</TableCell>
                          <TableCell align="right">{item.quantity}</TableCell>
                          <TableCell align="right">${item.price.toFixed(2)}</TableCell>
                          <TableCell>{startDate}</TableCell>
                          <TableCell>{endDate}</TableCell>
                          <TableCell align="center">
                            <Button
                              variant="contained"
                              size="small"
                              onClick={async () => {
                                const ok = await ensureRegisterControl();
                                if (!ok) return;
                                await handleAddProductFromSearch(item.product);
                                setShowPromotionProducts(false);
                              }}
                              sx={{ bgcolor: '#4CAF50', '&:hover': { bgcolor: '#45a049' } }}
                            >
                              Add to Sale
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            )}
          </Box>
        </DialogContent>
      </Dialog>

      {/* Barcode matched multiple products — cashier picks which one to add */}
      <BarcodeSelectDialog
        open={!!barcodeChoices}
        barcode={barcodeChoices?.code || ''}
        products={barcodeChoices?.products || []}
        onSelect={async (product, qty) => {
          setBarcodeChoices(null);
          await handleAddProductFromSearch(product, qty);
          focusSearchInput();
        }}
        onClose={() => {
          setBarcodeChoices(null);
          focusSearchInput();
        }}
      />

      {/* Barcode scan "product not found" feedback (non-modal so scanning continues) */}
      <Snackbar
        key={scanNotFound || 'scan-not-found'}
        open={!!scanNotFound}
        autoHideDuration={4000}
        onClose={() => setScanNotFound(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity="warning"
          variant="filled"
          onClose={() => setScanNotFound(null)}
        >
          Product not found for barcode "{scanNotFound}"
        </Alert>
      </Snackbar>

      {/* Warning toast for reference-style sale guards (e.g. last product with payments) */}
      <Snackbar
        key={saleWarning || 'sale-warning'}
        open={!!saleWarning}
        autoHideDuration={4000}
        onClose={() => setSaleWarning(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="warning" variant="filled" onClose={() => setSaleWarning(null)}>
          {saleWarning}
        </Alert>
      </Snackbar>

      {/* Component picker for the display-components-add / display-components-remove keys */}
      <Dialog open={Boolean(componentPicker)} onClose={() => setComponentPicker(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {componentPicker?.mode === 'add' ? 'Add a Component' : 'Remove a Component'}
          {selectedCartItem?.name ? ` — ${selectedCartItem.name}` : ''}
        </DialogTitle>
        <DialogContent dividers>
          {(selectedCartItem?.comboItems || []).length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              The selected line has no components.
            </Typography>
          ) : (
            (selectedCartItem?.comboItems || []).map((ci) => (
              <Box
                key={ci.productId}
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1, borderBottom: '1px solid #eee' }}
              >
                <Typography variant="body2">
                  {ci.name} x{ci.quantity || 1}
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  sx={{
                    bgcolor: componentPicker?.mode === 'add' ? '#5ebbeb' : '#dc2626',
                    '&:hover': { bgcolor: componentPicker?.mode === 'add' ? '#4aa9dd' : '#b91c1c' },
                    textTransform: 'none',
                    fontWeight: 700,
                    boxShadow: 'none',
                  }}
                  onClick={() => {
                    const product = resolveProductLocal(ci.productId, ci.name);
                    if (!product) { alert('Product not found.'); return; }
                    applyComponentToSale(product, componentPicker?.mode === 'add' ? 1 : -1);
                    setComponentPicker(null);
                  }}
                >
                  {componentPicker?.mode === 'add' ? 'Add' : 'Remove'}
                </Button>
              </Box>
            ))
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setComponentPicker(null)} sx={{ textTransform: 'none' }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Cash-out sale keys: prompt for the cash amount, then charge goods + cash out */}
      <CashOutDialog
        open={Boolean(saleKeyCashOutPrompt)}
        goodsAmount={(saleKeyCashOutPrompt?.goodsCents || 0) / 100}
        onClose={() => setSaleKeyCashOutPrompt(null)}
        onConfirm={(cashOutCents) => {
          setSaleKeyCardCharge({
            amountCents: saleKeyCashOutPrompt.goodsCents,
            cashOutCents,
            methodName: saleKeyCashOutPrompt.methodName,
            description: saleKeyCashOutPrompt.description,
          });
          setSaleKeyCashOutPrompt(null);
        }}
      />

      {/* Card/EFTPOS sale keys charge the Linkly PIN pad; the payment is only recorded on approval */}
      <PayByCardDialog
        open={Boolean(saleKeyCardCharge)}
        amountCents={saleKeyCardCharge?.amountCents}
        cashOutCents={saleKeyCardCharge?.cashOutCents || 0}
        txnType="purchase"
        registerId={undefined}
        onClose={() => setSaleKeyCardCharge(null)}
        onApproved={(txn) => {
          const cashOutCents = saleKeyCardCharge?.cashOutCents || 0;
          const requestedCents = (saleKeyCardCharge?.amountCents || 0) + cashOutCents;
          // Partial approval (prepaid cards): record what the bank actually
          // approved; the shortfall stays as balance owing for another tender.
          const approvedCents =
            (txn?.approvedAmountCents ?? 0) + (txn?.approvedCashOutCents ?? 0);
          const recordCents =
            approvedCents > 0 ? Math.min(approvedCents, requestedCents) : requestedCents;
          if (recordCents < requestedCents) {
            alert(
              `Card approved $${(recordCents / 100).toFixed(2)} of $${(
                requestedCents / 100
              ).toFixed(2)} — take the remaining balance with another tender.`
            );
          }
          handleAddPaymentFromDialog({
            // Full card charge (goods + cash out); cash-out surfaces as change to hand over.
            amount: recordCents / 100,
            method: saleKeyCardCharge?.methodName || 'EFTPOS',
            description: `${saleKeyCardCharge?.description || 'Card'}${txn?.cardType ? ' · ' + txn.cardType : ''}${txn?.authCode ? ' · Auth ' + txn.authCode : ''}${cashOutCents > 0 ? ' · Cash out $' + (cashOutCents / 100).toFixed(2) : ''}`,
            reference: txn?.txnRef,
            integrated: true, // went through the PIN pad — blocks clear/cancel until refunded
            // Linkly EFT slip printed on the sale receipt. Prefer the customer
            // copy; fall back to the merchant copy when the terminal only
            // returns one (sandbox/training pads do this).
            eftposReceipt: txn?.customerReceipt || txn?.merchantReceipt || null,
          });
          setSaleKeyCardCharge(null);
        }}
        onDeclined={() => {
          /* leave the dialog open showing the decline; operator can retry */
        }}
      />

      {/* EFTPOS Refund Item: after the sale, load the gift card by sending a
          REFUND to the Linkly pinpad (operator follows the pad: swipe card,
          Savings, PIN 0000). Closing without approval falls back to the manual
          confirm so the load is never silently skipped. */}
      <PayByCardDialog
        open={Boolean(eftposLoadCharge)}
        amountCents={eftposLoadCharge?.amountCents}
        txnType="refund"
        registerId={undefined}
        onClose={() => {
          const pending = eftposLoadCharge;
          setEftposLoadCharge(null);
          if (!pending) return;
          // Not approved on the pinpad — rejoin the manual-confirm path for this
          // line, then continue with any remaining lines.
          processEftposGiftCardLoad([{ name: pending.name, amountCents: pending.amountCents }, ...(pending.queue || [])]);
        }}
        onApproved={() => {
          const pending = eftposLoadCharge;
          setEftposLoadCharge(null);
          if (!pending) return;
          notify(`Gift card loaded — $${(pending.amountCents / 100).toFixed(2)} refunded to the card`);
          if ((pending.queue || []).length) processEftposGiftCardLoad(pending.queue);
        }}
        onDeclined={() => {
          /* dialog shows the decline; operator can retry or close for manual */
        }}
      />
    </Box>
  );
};

export default SaleKeyPage;
