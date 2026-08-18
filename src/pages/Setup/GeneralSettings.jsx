import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Divider,
  Alert,
  Snackbar,
  Autocomplete,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Business as BusinessIcon,
  Store as StoreIcon,
  AppRegistration as RegisterIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  Save as SaveIcon,
  BusinessCenterOutlined,
  SettingsOutlined,
  DesktopWindowsOutlined,
  LoginOutlined,
  MonitorOutlined,
  StorefrontOutlined,
  CalendarTodayOutlined,
  PaymentsOutlined,
  SearchOutlined,
  LinkOutlined,
  ExtensionOutlined,
  EditOutlined,
  ArrowBackOutlined,
  ArrowDropDown,
  PrintOutlined,
  ManageAccountsOutlined,
  CardGiftcardOutlined
} from '@mui/icons-material';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import SettingsSlideOver from '../../components/Settings/SettingsSlideOver';
import EditReasonsSlideOver from '../../components/Settings/EditReasonsSlideOver';
import { COMPANY_SECTIONS, LOCAL_TAB_FIELDS, COMPANY_CONSTRAINTS } from './generalSettingsFields';
import { setLeaveGuard, clearLeaveGuard } from '../../utils/leaveGuard';
import { formatWithTokens } from '../../utils/dateFormat';
import saleKeyService from '../../services/saleKeyService';
import settingsService, { GENERAL_DEFAULTS } from '../../services/settingsService';
import outletService from '../../services/outletService';
import { userService } from '../../services/userService';
import receiptTemplateService from '../../services/receiptTemplateService';
import customerDisplayTemplateService from '../../services/customerDisplayTemplateService';
import customerDisplayService from '../../services/customerDisplayService';
import registerService from '../../services/registerService';
import paymentMethodService from '../../services/paymentMethodService';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';

// The fixed app bar in DashboardLayout (HEADER_HEIGHT). Anything sticky on this page
// has to start below it, or it scrolls under the bar and its text is clipped.
const APP_BAR_HEIGHT = 50;

// ---- Company tab shell primitives (reference parity) ----------------------
const SETTING_FIELD_SX = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' }
  },
  '& .MuiOutlinedInput-input::placeholder': { color: '#808080', opacity: 1 }
};

const TAB_GROUPS = [
  { label: 'Company', icon: BusinessCenterOutlined },
  { label: 'Outlets', icon: StoreIcon },
  { label: 'Registers', icon: RegisterIcon },
  { label: 'Users', icon: ManageAccountsOutlined }
];

// Reference option list styling: flat 1px panel, 46px rows, full-row #5ebbeb
// hover band, current value in sky, no grow animation.
const SETTING_MENU_PROPS = {
  transitionDuration: 0,
  PaperProps: {
    elevation: 0,
    sx: {
      border: '1px solid #404040',
      borderRadius: '8px',
      boxShadow: 'none',
      '&& .MuiMenuItem-root': { minHeight: 46, fontSize: 16, color: '#313439' },
      '&& .MuiMenuItem-root.Mui-selected': { backgroundColor: 'transparent', color: '#38bdf8' },
      '&& .MuiMenuItem-root:hover, && .MuiMenuItem-root.Mui-selected:hover, && .MuiMenuItem-root.Mui-focusVisible': {
        backgroundColor: '#5ebbeb',
        color: '#f8f8f8'
      }
    }
  }
};

// Same list styling for Autocomplete popups.
const SETTING_LISTBOX_PROPS = {
  paper: {
    elevation: 0,
    sx: {
      border: '1px solid #404040',
      borderRadius: '8px',
      boxShadow: 'none',
      // ponytail: doubled selectors (&&) - MUI's own .Mui-focused rule has the
      // same specificity and is injected later, so a single & lost the band.
      '&& li.MuiAutocomplete-option': { minHeight: 46, height: 46, fontSize: 16, color: '#313439' },
      '&& .MuiAutocomplete-option[aria-selected="true"]': { backgroundColor: 'transparent', color: '#38bdf8' },
      '&& .MuiAutocomplete-option:hover, && .MuiAutocomplete-option.Mui-focused, && .MuiAutocomplete-option[data-focus="true"], && .MuiAutocomplete-option[aria-selected="true"].Mui-focused, && .MuiAutocomplete-option[aria-selected="true"]:hover': {
        backgroundColor: '#5ebbeb',
        color: '#f8f8f8'
      }
    }
  }
};

const USER_SECTIONS = [
  { key: 'user-miscellaneous', label: 'Miscellaneous' }
];

// Appended to the Date/Time Format lists; picking it clears the value so the
// combobox input can be typed into freely (reference behaviour).
const CUSTOM_FORMAT_OPTION = 'Custom Format';

// Field-level defaults from the measured schema, applied to keys the stored
// blob has never carried (otherwise those render blank instead of e.g. 7200).
const COMPANY_FIELD_DEFAULTS = Object.fromEntries(
  COMPANY_SECTIONS.flatMap((section) =>
    section.fields
      .filter((f) => f.default !== undefined)
      .map((f) => [f.key, f.default])
  )
);

// Reference user field: 618x42, radius 8, 1px #404040.
const USER_FIELD_SX = {
  ...SETTING_FIELD_SX,
  maxWidth: 618,
  '& .MuiOutlinedInput-root': { ...SETTING_FIELD_SX['& .MuiOutlinedInput-root'], minHeight: 42 }
};

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Reference lists show whatever is already chosen at the top of the options.
const selectedFirst = (options, selected) => {
  const chosen = Array.isArray(selected) ? selected : [selected];
  return [...options].sort((a, b) => (chosen.includes(b) ? 1 : 0) - (chosen.includes(a) ? 1 : 0));
};

// One settings section: 1px top rule, 24px/700 heading, and a 300ms background
// flash when it is the jump target.
const SettingsSection = ({ id, label, flash, children }) => (
  <Box
    id={`section-${id}`}
    sx={{
      borderTop: '1px solid #e5e5e5',
      px: '4px',
      pt: 6,
      pb: 6,
      scrollMarginTop: '144px',
      borderRadius: '8px',
      transition: 'background-color 300ms',
      backgroundColor: flash ? '#f0f0f0' : 'transparent'
    }}
  >
    <Typography component="h2" sx={{ fontSize: '24px', fontWeight: 700, color: '#000', mb: 3 }}>
      {label}
    </Typography>
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</Box>
  </Box>
);

// One setting: bold label + inline "- Last updated", description line, an
// optional "More Info..." button (opens the slide-over), then the control.
const SettingRow = ({ label, updated, description, helpUrl, onMoreInfo, children }) => (
  <Box id={`setting-${slugify(label)}`} data-setting={label} sx={{ scrollMarginTop: '160px' }}>
    <Typography component="div" sx={{ fontSize: '16px', fontWeight: 700, color: '#000' }}>
      {label}
      {updated && (
        <Box component="span" sx={{ ml: 0.75, fontSize: '13px', fontWeight: 400, color: '#676b72' }}>
          - Last updated {updated}
        </Box>
      )}
    </Typography>
    {description && (
      <Typography sx={{ fontSize: '14px', color: '#404040', mt: 0.25 }}>
        {description}{!onMoreInfo && helpUrl && ' '}
        {!onMoreInfo && helpUrl && <Link
          href={helpUrl}
          target="_blank"
          rel="noopener"
          sx={{ color: '#404040', textDecoration: 'underline' }}
        >
          More Info...
        </Link>}
      </Typography>
    )}
    {onMoreInfo && (
      <Button
        onClick={onMoreInfo}
        sx={{
          mt: 0.5, p: '2px 8px', minWidth: 0, textTransform: 'none',
          fontSize: 14, fontWeight: 400, color: '#404040',
          border: '1px solid #d4d4d4', borderRadius: '8px',
          '&:hover': { backgroundColor: '#f8f8f8', borderColor: '#404040' }
        }}
      >
        More Info...
      </Button>
    )}
    <Box sx={{ mt: 1 }}>{children}</Box>
  </Box>
);

// Toggle control + optional state sentence (reference shows the sentence beside it).
// The measured moreDescription strings carry the reference's **bold** markers -
// render them as <strong> (line breaks are handled by the slide-over's pre-wrap).
const renderRichText = (text) =>
  text?.split('**').map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));

const SettingToggle = ({ checked, onChange, stateText }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
    <ShopfrontSwitch checked={!!checked} onChange={onChange} />
    {stateText && <Typography sx={{ fontSize: '14px', color: '#404040' }}>{stateText}</Typography>}
  </Box>
);

// The four "Edit Reasons" fields. Discount/drawer lists are string[] keys in
// the company blob (saved by the floating Save); cash out/in lists live in
// their own cash_out_reasons/cash_in_reasons rows and PUT immediately on
// Update, as before. `noun` fills the slide-over's body paragraph.
const REASON_LIST_FIELDS = {
  predefinedDiscountReasons: { noun: 'discount' },
  predefinedCashDrawerReasons: { noun: 'cash drawer' },
  predefinedCashOutReasons: { noun: 'cash out', apiType: 'take_out' },
  predefinedCashInReasons: { noun: 'cash in', apiType: 'put_in' }
};

// Outlet editor field lists (labels + keys), in the exact reference order.
const OUTLET_CONTACT_FIELDS = [
  ['Email', 'email'], ['Fax', 'fax'], ['Phone', 'phone'], ['Mobile', 'mobile'],
  ['Website', 'website'], ['Twitter', 'twitter'], ['Facebook', 'facebook']
];
const OUTLET_ADDRESS_FIELDS = [
  ['Street 1', 'street1'], ['Street 2', 'street2'], ['Suburb', 'suburb'], ['City', 'city'],
  ['Postcode', 'postcode'], ['State', 'state'], ['Country', 'country']
];
const EMPTY_OUTLET_PROFILE = {
  name: '', businessNumber: '', hasKitchenScreen: false, logo: '',
  email: '', fax: '', phone: '', mobile: '', website: '', twitter: '', facebook: '',
  street1: '', street2: '', suburb: '', city: '', postcode: '', state: '', country: ''
};

// Register editor: Register Closures > Print Settings. Labels/keys/defaults in the
// exact reference order; every one offers the same three options.
const CLOSURE_PRINT_OPTIONS = ['Print Table', 'Print Total', "Don't Print"];
const CLOSURE_PRINT_SECTIONS = [
  ['Payment Method', 'paymentMethod', 'Print Table'],
  ['Tax', 'tax', 'Print Table'],
  ['Movements', 'movements', 'Print Total'],
  ['Account Sales', 'accountSales', 'Print Total'],
  ['Account Payments', 'accountPayments', 'Print Total'],
  ['Refunds', 'refunds', 'Print Total'],
  ['Discounts', 'discounts', 'Print Total'],
  ['Sold Gift Cards', 'soldGiftCards', 'Print Total'],
  ['Redeemed Gift Cards', 'redeemedGiftCards', 'Print Total'],
  ['Loyalty', 'loyalty', 'Print Total']
];
const DEFAULT_CLOSURE_PRINT = Object.fromEntries(CLOSURE_PRINT_SECTIONS.map(([, key, def]) => [key, def]));
const EMPTY_REGISTER_PROFILE = {
  name: '', invoiceNumber: '', payments: {}, closurePrint: DEFAULT_CLOSURE_PRINT
};

// 764x42 / radius 8 / 1px oklch(0.371 0 0) - the reference outlet editor input.
const outletEditorInputSx = {
  width: '100%',
  maxWidth: 764,
  '& .MuiOutlinedInput-root': { height: 42, borderRadius: '8px' },
  '& .MuiOutlinedInput-input': { padding: '8px 16px', fontSize: 16 },
  '& .MuiOutlinedInput-notchedOutline': { border: '1px solid oklch(0.371 0 0)' },
  '&:hover .MuiOutlinedInput-notchedOutline': { border: '1px solid oklch(0.371 0 0)' }
};

const GeneralSettings = () => {
  const { user, getOutletName } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // ponytail: section survives a reload via localStorage, no router plumbing needed.
  const [activeTab, setActiveTab] = useState(() => Number(localStorage.getItem('generalSettingsTab')) || 0);
  const [flashSection, setFlashSection] = useState(null);
  // Touched-based dirty tracking per store (company/outlet/register/users) -
  // reverting a value does NOT clear it, matching the reference.
  const [dirty, setDirty] = useState({});
  const [leaveOpen, setLeaveOpen] = useState(false);
  const pendingLeaveRef = useRef(null);
  // Per-store "Last updated" stamps: { keys: {settingKey: ISO}, row: ISO }.
  const [stamps, setStamps] = useState({});
  const [slideOverField, setSlideOverField] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');
  const [saleKeySets, setSaleKeySets] = useState([]);
  const [loadingSaleKeySets, setLoadingSaleKeySets] = useState(false);
  const [selectedOutletForSaleKeys, setSelectedOutletForSaleKeys] = useState('');
  const [outletSaleKeySets, setOutletSaleKeySets] = useState([]);
  const [selectedOutletSaleKeySetId, setSelectedOutletSaleKeySetId] = useState('');
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [outlets, setOutlets] = useState([]);
  const [selectedOutlet, setSelectedOutlet] = useState('');
  const [loadingOutlets, setLoadingOutlets] = useState(false);
  // Which reason-list field's "Edit Reasons" panel is open (REASON_LIST_FIELDS
  // key), plus the cash in/out lists which live in their own store - the
  // discount/drawer lists live inside companySettings.
  const [reasonsEditor, setReasonsEditor] = useState(null);
  const [cashReasons, setCashReasons] = useState({ take_out: [], put_in: [] });
  // These two lists live in their own setting rows, so they have no entry in the
  // company blob's `_updatedAt` map - their row stamp is tracked separately.
  const [cashReasonStamps, setCashReasonStamps] = useState({});
  const [editingOutletId, setEditingOutletId] = useState(null);
  const [outletEditorTab, setOutletEditorTab] = useState(0);
  const [outletProfile, setOutletProfile] = useState(EMPTY_OUTLET_PROFILE);
  const [selectedRegister, setSelectedRegister] = useState('');
  const [registers, setRegisters] = useState([]);
  const [editingRegisterId, setEditingRegisterId] = useState(null);
  const [registerEditorTab, setRegisterEditorTab] = useState(0);
  const [registerProfile, setRegisterProfile] = useState(EMPTY_REGISTER_PROFILE);
  const [editingInvoiceNumber, setEditingInvoiceNumber] = useState(false);
  const [openClosureKey, setOpenClosureKey] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [emailReceiptTemplates, setEmailReceiptTemplates] = useState([]);
  const [loadingEmailTemplates, setLoadingEmailTemplates] = useState(false);
  // Every template offerable as the register's default receipt. The reference lists
  // all templates except the Email ones (Payment Receipt included) — measured
  // 2026-08-05, docs/parity/receipt-template.md row 2.4.
  const [defaultReceiptTemplates, setDefaultReceiptTemplates] = useState([]);
  const [customerDisplayTemplates, setCustomerDisplayTemplates] = useState([]);
  const [registerCustomerDisplaySettings, setRegisterCustomerDisplaySettings] = useState({
    templateId: '',
    isEnabled: false,
    openWhenRegisterOpens: false,
    displayMode: 'Popup',
  });

  // Company Settings State
  const [companySettings, setCompanySettings] = useState(GENERAL_DEFAULTS);

  // Outlet Settings State
  const [outletSettings, setOutletSettings] = useState({
    // General
    emailReceiptTemplate: '',
    outletEmail: 'rossmoretopdrops@outlook.com',
    
    // Gift Cards
    enableGiftCards: true,
    defaultExpiryAmount: 3,
    defaultExpiryPeriod: 'Years',
    canManuallyAdjustExpiry: true,
    
    // Transfers
    updateLastCostWhenReceivingTransfers: true,
    
    // Metcash Integration
    b2bAccount: '',
    b2bPassword: '',
    customerId: 0,
    state: '',
    pillar: '',
    importPromotions: false,
    importBuyingPeriods: false,
    
    // Miscellaneous
    discountingBelowCostBehaviour: 'Allow'
  });

  // Register Settings State
  const [registerSettings, setRegisterSettings] = useState({
    // General
    safeDropAlertAmount: 0,
    defaultReceiptTemplateId: '',

    // Sell Screen
    loginAfterSale: false,
    neverOpenCashDrawer: false,
    printReceiptOnRefund: true,
    useTyroIntegratedReceipts: true,
    consolidateProducts: true,
    allowTrainingModeToggle: false,
    requireNoteOnRegisterClosureWithDiscrepancy: false,
    runPromotionCalculationInDedicatedThread: false,
    
    // Invoices
    offlineInvoiceSuffix: 'A',
    invoiceNumberMode: 'Incremental',
    invoiceMaxNumber: 99999999
  });

  // User Settings State
  const [userSettings, setUserSettings] = useState({
    // Miscellaneous
    saleKeys: 'Default',
    saleKeysPosition: ''
  });

  // Load settings and sale key sets on mount
  useEffect(() => {
    loadSettings();
    loadSaleKeySets();
    loadOutlets();
    loadUsers();
    loadEmailReceiptTemplates();
    loadDefaultReceiptTemplates();
    loadCustomerDisplayTemplates();
    loadRegisters();
    loadPaymentMethods();
    loadCashReasons();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      const res = await paymentMethodService.getPaymentMethods({ isActive: true });
      setPaymentMethods(res?.paymentMethods || res?.data || []);
    } catch {
      setPaymentMethods([]);
    }
  };

  const loadCustomerDisplayTemplates = async () => {
    const templates = await customerDisplayTemplateService.listTemplates();
    setCustomerDisplayTemplates(templates);
  };

  // Update current date/time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // `_updatedAt` (per-key ISO stamp map maintained by the server inside the
  // blob) is stripped from form values and kept for the stamp lines.
  const captureStamps = (store, response) => {
    const { _updatedAt, ...values } = response.settings || {};
    setStamps(prev => ({
      ...prev,
      [store]: { keys: _updatedAt || response._updatedAt || {}, row: response.updatedAt }
    }));
    return values;
  };

  const formatStamp = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ` +
      `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };

  // Per-key stamp, falling back to the row-level updatedAt, else an em dash -
  // never a hardcoded date.
  // Per-key stamp only. The row-level updatedAt bumps on every save, so using
  // it as a fallback moved every untouched setting's stamp at once; a key that
  // has never been saved shows an em dash instead.
  const stampFor = (store, key) => {
    const s = stamps[store] || {};
    return formatStamp(key ? s.keys?.[key] : s.row) || '—';
  };

  const markDirty = (store) =>
    setDirty(prev => (prev[store] ? prev : { ...prev, [store]: true }));

  const loadSettings = async () => {
    try {
      const response = await settingsService.getGeneralSettings();
      if (response.settings) {
        // Merge so settings added after the stored blob was written keep their defaults.
        const values = captureStamps('company', response);
        setCompanySettings(prev => ({ ...prev, ...COMPANY_FIELD_DEFAULTS, ...values }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      // Keep default settings
    }
  };

  const loadSaleKeySets = async () => {
    setLoadingSaleKeySets(true);
    try {
      const response = await saleKeyService.getSaleKeySets();
      const sets = response.saleKeySets || saleKeyService.getDefaultSaleKeySets();
      setSaleKeySets(sets);
    } catch (error) {
      console.error('Error loading sale key sets:', error);
      // Use default sale key sets as fallback
      setSaleKeySets(saleKeyService.getDefaultSaleKeySets());
    } finally {
      setLoadingSaleKeySets(false);
    }
  };

  // Load sale key sets for a specific outlet (for outlet-wise defaults)
  const loadSaleKeySetsForOutlet = async (outletId) => {
    if (!outletId) return;
    try {
      setLoadingSaleKeySets(true);
      const resp = await saleKeyService.getSaleKeySets(parseInt(outletId));
      const sets = resp.saleKeySets || [];
      setOutletSaleKeySets(sets);
      const currentDefault = sets.find(s => s.isDefault);
      setSelectedOutletSaleKeySetId(currentDefault ? String(currentDefault.id) : (sets[0] ? String(sets[0].id) : ''));
    } catch (e) {
      console.error('Error loading outlet sale key sets:', e);
      setOutletSaleKeySets([]);
      setSelectedOutletSaleKeySetId('');
    } finally {
      setLoadingSaleKeySets(false);
    }
  };

  const loadOutlets = async () => {
    setLoadingOutlets(true);
    try {
      // Super admins can see and manage all outlets
      if (user?.isSuperAdmin) {
        const response = await outletService.getAllOutlets();
        if (response.outlets && response.outlets.length > 0) {
          setOutlets(response.outlets);
          setSelectedOutlet(response.outlets[0].id.toString());
          setSelectedOutletForSaleKeys(response.outlets[0].id.toString());
          loadSaleKeySetsForOutlet(response.outlets[0].id.toString());
          return;
        }
      }

      // Non-superadmin users should only work with their own outlet
      // This prevents unnecessary 403 errors and improves security
      try {
        const profileResponse = await outletService.getCurrentOutlet();
        if (profileResponse.user && profileResponse.user.outlet) {
          const currentOutlet = profileResponse.user.outlet;
          const outletIdStr = currentOutlet.id.toString();
          setOutlets([currentOutlet]);
          setSelectedOutlet(outletIdStr);
          setSelectedOutletForSaleKeys(outletIdStr);
          loadSaleKeySetsForOutlet(outletIdStr);
          return;
        }
      } catch (profileError) {
        console.error('Error loading current outlet:', profileError);
      }

      // Final fallback if everything else fails
      setOutlets([{ id: 1, name: 'Default Outlet' }]);
      setSelectedOutlet('1');
      setSelectedOutletForSaleKeys('1');
      loadSaleKeySetsForOutlet('1');
    } catch (error) {
      console.error('Error loading outlets:', error);
      // Set a default fallback
      setOutlets([{ id: 1, name: 'Default Outlet' }]);
      setSelectedOutlet('1');
      setSelectedOutletForSaleKeys('1');
      loadSaleKeySetsForOutlet('1');
    } finally {
      setLoadingOutlets(false);
    }
  };

  const loadRegisterSettings = async (registerId) => {
    try {
      const response = await settingsService.getRegisterSettings(registerId);
      if (response.settings) {
        // ponytail: merge, never replace - a bare replace drops the defaults and
        // every missing key becomes undefined, flipping controlled inputs to
        // uncontrolled (MUI Select/Switch warnings on every render).
        const values = captureStamps('register', response);
        setRegisterSettings(prev => ({ ...prev, ...values }));
      }
    } catch (error) {
      console.error('Error loading register settings:', error);
      // Keep default settings
    }
  };

  const loadRegisters = async () => {
    try {
      const list = await registerService.list({ isActive: true });
      setRegisters(list || []);
      if (list?.length) {
        const firstRegisterId = String(list[0].id);
        setSelectedRegister(firstRegisterId);
      }
    } catch (error) {
      console.error('Error loading registers:', error);
    }
  };

  const loadRegisterCustomerDisplaySettings = async (registerId) => {
    if (!registerId) return;
    try {
      const config = await customerDisplayService.getRegisterConfig(Number(registerId));
      setRegisterCustomerDisplaySettings({
        templateId: config?.templateId || '',
        isEnabled: !!config?.isEnabled,
        openWhenRegisterOpens: !!config?.openWhenRegisterOpens,
        displayMode: config?.displayMode || 'Popup',
      });
    } catch (error) {
      console.error('Error loading register customer display settings:', error);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await userService.getUsers();
      // Reference starts with NO user selected - the empty state is shown instead.
      setUsers(response.users?.length ? response.users : []);
    } catch (error) {
      console.error('Error loading users:', error);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  // --- Reason-list fields (Edit Reasons slide-over) ------------------------
  // Cash in/out lists are loaded up front so the "No reasons are provided..."
  // helper line under each Edit Reasons button reflects the stored lists.
  const loadCashReasons = async () => {
    for (const type of ['take_out', 'put_in']) {
      const res = await settingsService.getCashDrawerReasons(type);
      setCashReasons(prev => ({ ...prev, [type]: Array.isArray(res?.reasons) ? res.reasons : [] }));
      setCashReasonStamps(prev => ({ ...prev, [type]: res?.updatedAt || null }));
    }
  };

  const reasonListFor = (fieldKey) => {
    const { apiType } = REASON_LIST_FIELDS[fieldKey];
    return (apiType ? cashReasons[apiType] : companySettings[fieldKey]) || [];
  };

  const handleReasonsUpdate = async (cleaned) => {
    const { apiType } = REASON_LIST_FIELDS[reasonsEditor];
    if (apiType) {
      try {
        const res = await settingsService.updateCashDrawerReasons(apiType, cleaned);
        setCashReasons(prev => ({ ...prev, [apiType]: cleaned }));
        setCashReasonStamps(prev => ({ ...prev, [apiType]: res?.updatedAt || new Date().toISOString() }));
        setShowSuccess(true);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to save reasons');
        return; // keep the panel open so the edits aren't lost
      }
    } else {
      setCompanySettings(prev => ({ ...prev, [reasonsEditor]: cleaned }));
      markDirty('company');
    }
    setReasonsEditor(null);
  };

  // ?outlet=<id> / ?register=<id> drive the editors, so they are deep-linkable,
  // survive a reload, and browser Back returns to the list.
  useEffect(() => {
    const outletParam = Number(searchParams.get('outlet')) || null;
    const registerParam = Number(searchParams.get('register')) || null;

    if (!outletParam && editingOutletId) setEditingOutletId(null);
    if (!registerParam && editingRegisterId) setEditingRegisterId(null);

    if (outletParam && outletParam !== editingOutletId) {
      const outlet = outlets.find(o => o.id === outletParam);
      if (outlet) openOutletEditor(outlet);
    }
    if (registerParam && registerParam !== editingRegisterId) {
      const register = registers.find(r => r.id === registerParam);
      if (register) openRegisterEditor(register);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, outlets, registers]);

  const isFullWidthList =
    (activeTab === 1 && !editingOutletId) || (activeTab === 2 && !editingRegisterId);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    localStorage.setItem('generalSettingsTab', String(newValue));
  };

  // Static search index over ALL tabs, always - built from the field-definition
  // module plus the hand-listed local-tab fields, grouped by tab name.
  const searchOptions = useMemo(() => [
    ...COMPANY_SECTIONS.flatMap((section) =>
      section.fields
        .filter((f) => f.label)
        .map((f) => ({ label: f.label, tab: 'Company', tabIndex: 0 }))),
    ...LOCAL_TAB_FIELDS.map((f) => ({ label: f.fieldLabel, tab: f.tab, tabIndex: f.tabIndex }))
  ], []);

  const isDirty = Object.values(dirty).some(Boolean);

  // Leaving the route (or the browser page) with unsaved edits prompts
  // "Confirm Leaving"; tab switches inside the page never do.
  useEffect(() => {
    if (!isDirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    const guard = (proceed) => {
      pendingLeaveRef.current = proceed;
      setLeaveOpen(true);
    };
    window.addEventListener('beforeunload', warn);
    setLeaveGuard(guard);
    return () => {
      window.removeEventListener('beforeunload', warn);
      clearLeaveGuard(guard);
    };
  }, [isDirty]);

  const flashAndScroll = (el, sectionId) => {
    // behavior:'auto' - the search popper unmounting restores focus to the
    // input at the top of the page, which cancels a smooth scroll mid-flight.
    el?.scrollIntoView({ behavior: 'auto', block: el?.id?.startsWith('section-') ? 'start' : 'center' });
    if (!sectionId) return;
    setFlashSection(sectionId);
    setTimeout(() => setFlashSection(null), 900);
  };

  const scrollToSection = (sectionId) => {
    flashAndScroll(document.getElementById(`section-${sectionId}`), sectionId);
  };

  const scrollToSettingLabel = (label) => {
    const el = document.getElementById(`setting-${slugify(label)}`)
      // ponytail: outlet/register tab rows carry no anchor ids - exact text
      // match on the rendered <p> labels covers them without touching that JSX.
      || Array.from(document.querySelectorAll('p')).find(p => p.textContent.trim() === label);
    if (!el) return;
    const section = el.closest('[id^="section-"]');
    flashAndScroll(el, section ? section.id.replace('section-', '') : null);
  };

  // Selecting a search result: switch tab if needed, jump to the field, flash
  // its section; the input clears itself (value stays null + clearOnBlur).
  const handleSearchSelect = (option) => {
    if (!option) return;
    if (activeTab !== option.tabIndex) {
      setActiveTab(option.tabIndex);
      localStorage.setItem('generalSettingsTab', String(option.tabIndex));
    }
    document.activeElement?.blur?.();
    setTimeout(() => scrollToSettingLabel(option.label), 80);
  };

  const handleCompanySettingChange = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    markDirty('company');
    if (field === 'defaultSaleKeys') {
      const selectedSet = saleKeySets.find(set => set.name === value);
      setCompanySettings(prev => ({
        ...prev,
        defaultSaleKeys: value,
        defaultSaleKeysId: selectedSet ? selectedSet.id : null
      }));
    } else {
      setCompanySettings(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  // Set default sale key set for a selected outlet
  const handleSetDefaultSaleKeysForOutlet = async () => {
    // Used to `return` silently here, so a missing selection looked identical
    // to a successful save.
    if (!selectedOutletForSaleKeys || !selectedOutletSaleKeySetId) {
      setError('Pick an outlet and a sale key set first.');
      return;
    }
    const setId = parseInt(selectedOutletSaleKeySetId);
    try {
      const saved = await saleKeyService.updateSaleKeySet(setId, { isDefault: true });
      // Trust the row the server echoes back, not the request we sent: if it
      // comes back isDefault:false the write didn't take and saying "saved"
      // would be a lie.
      if (!saved?.isDefault) {
        console.error('Set default sale keys: server returned', saved);
        setError('The server did not save that sale key set as the default.');
        return;
      }
      setShowSuccess(true);
      await loadSaleKeySetsForOutlet(selectedOutletForSaleKeys);
    } catch (error) {
      console.error('Failed setting default sale key set for outlet:', error);
      setError(
        error.response?.data?.error ||
          'Failed to set default sale keys for the outlet',
      );
    }
  };

  const handleOutletSettingChange = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    markDirty('outlet');
    setOutletSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // --- Outlet editor (Edit action on the outlet list) ---------------------
  const openOutletEditor = async (outlet) => {
    setEditingOutletId(outlet.id);
    setSearchParams({ outlet: String(outlet.id) }, { replace: false });
    setOutletEditorTab(0);
    setOutletProfile({
      ...EMPTY_OUTLET_PROFILE,
      name: outlet.name || '',
      email: outlet.email || '',
      phone: outlet.phone || ''
    });
    let saved = null;
    try {
      const res = await settingsService.getSetting(`outlet_profile_${outlet.id}`);
      saved = res?.setting?.value;
    } catch {
      // no profile saved for this outlet yet - keep the values from the outlet record
    }
    if (saved && typeof saved === 'object') {
      setOutletProfile(prev => ({ ...prev, ...saved }));
    }
  };

  const handleOutletProfileChange = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setOutletProfile(prev => ({ ...prev, [field]: value }));
  };

  // ponytail: logo kept as a data URL inside the outlet profile blob - there is no
  // outlet-logo upload endpoint. Swap for a media upload if logos get large.
  const handleOutletLogoSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setOutletProfile(prev => ({ ...prev, logo: reader.result }));
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleSaveOutletProfile = async () => {
    if (!editingOutletId) return;
    setLoading(true);
    setError('');
    try {
      await settingsService.updateSetting(
        `outlet_profile_${editingOutletId}`, outletProfile, 'outlet', 'Outlet profile'
      );

      // Mirror the fields the Outlet record actually stores.
      const payload = { email: outletProfile.email || null, phone: outletProfile.phone || null };
      if (outletProfile.name) payload.name = outletProfile.name;
      const addressLine = OUTLET_ADDRESS_FIELDS
        .map(([, key]) => outletProfile[key])
        .filter(Boolean)
        .join(', ');
      if (addressLine) payload.address = addressLine;
      try {
        await outletService.updateOutlet(editingOutletId, payload);
        await loadOutlets();
      } catch {
        // only super admins may update the outlet record; the profile blob is still saved
      }

      setShowSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save outlet');
    } finally {
      setLoading(false);
    }
  };

  // --- Register editor (Edit action on the registers list) -----------------
  // ponytail: per-register settings live in the generic settings blob
  // (register_profile_<id>) - there is no per-register settings endpoint.
  const openRegisterEditor = async (register) => {
    setEditingRegisterId(register.id);
    setSearchParams({ register: String(register.id) }, { replace: false });
    setRegisterEditorTab(0);
    setEditingInvoiceNumber(false);
    setOpenClosureKey(null);
    setSelectedRegister(String(register.id));
    setRegisterProfile({
      ...EMPTY_REGISTER_PROFILE,
      name: register.name || '',
      invoiceNumber: register.invoiceNumber != null ? String(register.invoiceNumber) : ''
    });
    try {
      const res = await settingsService.getSetting(`register_profile_${register.id}`);
      const saved = res?.setting?.value;
      if (saved && typeof saved === 'object') {
        setRegisterProfile(prev => ({
          ...prev,
          ...saved,
          closurePrint: { ...DEFAULT_CLOSURE_PRINT, ...(saved.closurePrint || {}) }
        }));
      }
    } catch {
      // nothing saved for this register yet - keep the values from the register record
    }
  };

  const handleSaveRegisterProfile = async () => {
    if (!editingRegisterId) return;
    setLoading(true);
    setError('');
    try {
      await settingsService.updateSetting(
        `register_profile_${editingRegisterId}`, registerProfile, 'register', 'Register profile'
      );
      // Mirror name + invoice number onto the register record itself -
      // registers.invoiceNumber is what the sale flow actually increments.
      const registerUpdate = {};
      if (registerProfile.name) registerUpdate.name = registerProfile.name;
      const invoiceNumber = Number(registerProfile.invoiceNumber);
      if (registerProfile.invoiceNumber !== '' && Number.isFinite(invoiceNumber)) {
        registerUpdate.invoiceNumber = invoiceNumber;
      }
      if (Object.keys(registerUpdate).length > 0) {
        try {
          await registerService.update(editingRegisterId, registerUpdate);
          await loadRegisters();
        } catch {
          // register record is not always writable by the current role; the blob is still saved
        }
      }
      setShowSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save register');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSettingChange = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    markDirty('register');
    setRegisterSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleUserSettingChange = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    markDirty('users');
    setUserSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const loadOutletSettings = async (outletId) => {
    if (!outletId) return;
    
    try {
      const response = await settingsService.getOutletSettings(outletId);
      if (response.settings) {
        const values = captureStamps('outlet', response);
        setOutletSettings(prev => ({
          ...prev,
          ...values,
          outletEmail: values.outletEmail || prev.outletEmail
        }));
      }
      
      try {
        const outletResponse = await outletService.getOutletById(outletId);
        if (outletResponse.outlet && outletResponse.outlet.email) {
          setOutletSettings(prev => ({
            ...prev,
            outletEmail: outletResponse.outlet.email || prev.outletEmail
          }));
        }
      } catch (outletError) {
        console.log('Could not fetch outlet details');
      }
    } catch (error) {
      console.error('Error loading outlet settings:', error);
    }
  };

  const loadUserSettings = async (userName) => {
    if (!userName) return;
    
    try {
      const user = users.find(u => u.name === userName);
      if (!user) return;

      const response = await settingsService.getUserSettings(user.id);
      if (response.settings) {
        const values = captureStamps('user', response);
        setUserSettings(prev => ({
          ...prev,
          ...values,
          saleKeysPosition: values.saleKeysPosition || 'Default'
        }));
      }
    } catch (error) {
      console.error('Error loading user settings:', error);
    }
  };

  const loadDefaultReceiptTemplates = async () => {
    try {
      const response = await receiptTemplateService.getTemplates({});
      const templates = (response.templates || []).filter(
        (t) => t.isActive !== false && !/email/i.test(t.type || ''),
      );
      setDefaultReceiptTemplates(templates);
    } catch (error) {
      console.error('Error loading receipt templates:', error);
      setDefaultReceiptTemplates([]);
    }
  };

  const loadEmailReceiptTemplates = async () => {
    setLoadingEmailTemplates(true);
    try {
      const response = await receiptTemplateService.getTemplates({
        type: 'Email Receipt'
      });
      
      if (response.templates && Array.isArray(response.templates)) {
        const activeTemplates = response.templates.filter(t => t.isActive);
        setEmailReceiptTemplates(activeTemplates);
      } else {
        setEmailReceiptTemplates([]);
      }
    } catch (error) {
      console.error('Error loading email receipt templates:', error);
      setEmailReceiptTemplates([]);
    } finally {
      setLoadingEmailTemplates(false);
    }
  };

  useEffect(() => {
    if (selectedOutlet) {
      loadOutletSettings(selectedOutlet);
    }
  }, [selectedOutlet]);

  useEffect(() => {
    // Multi-select: the first picked user seeds the values that get written to all of them.
    if (selectedUsers.length) {
      loadUserSettings(selectedUsers[0]);
    }
  }, [selectedUsers]);

  useEffect(() => {
    if (selectedRegister) {
      loadRegisterCustomerDisplaySettings(selectedRegister);
      loadRegisterSettings(selectedRegister);
    }
  }, [selectedRegister]);

  // One floating Save persists EVERY dirty store in one click, not just the
  // active tab's.
  const handleSave = async () => {
    setLoading(true);
    setError('');

    try {
      if (dirty.company) {
        await settingsService.updateGeneralSettings(companySettings);
      }
      if (dirty.outlet) {
        await settingsService.updateOutletSettings(outletSettings, selectedOutlet);
        // Every consumer of the outlet's email (receipts, statements) reads the
        // Outlet record, not this blob - keep the record in step or the edit is
        // invisible everywhere but this page.
        if (selectedOutlet) {
          try {
            await outletService.updateOutlet(Number(selectedOutlet), {
              email: outletSettings.outletEmail || null
            });
          } catch {
            // only super admins may write the outlet record; the blob is still saved
          }
        }
      }
      if (dirty.register) {
        await settingsService.updateRegisterSettings(registerSettings, selectedRegister);
        if (selectedRegister) {
          await customerDisplayService.updateRegisterConfig(Number(selectedRegister), {
            templateId: registerCustomerDisplaySettings.templateId || null,
            isEnabled: registerCustomerDisplaySettings.isEnabled,
            openWhenRegisterOpens: registerCustomerDisplaySettings.openWhenRegisterOpens,
            displayMode: registerCustomerDisplaySettings.displayMode,
          });
        }
      }
      if (dirty.users) {
        // apply the same values to every selected user
        for (const name of selectedUsers) {
          const target = users.find(u => u.name === name);
          if (target) {
            await settingsService.updateUserSettings(target.id, userSettings);
          }
        }
      }

      // Consumers outside this page read the cached blob — refresh it so a saved
      // setting takes effect without a reload.
      await settingsService.refreshGeneralSettingsCache();

      setDirty({});
      setShowSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  // --- Company tab: generic rendering from the field-definition module -------
  const setCompanyValue = (key, value) =>
    handleCompanySettingChange(key)({ target: { value } });

  // inputProps min/max only stops the spinner arrows; typing or pasting an
  // out-of-range value went straight through to the API. Clamp on blur, so the
  // user can still type "700" into a min-60 box one digit at a time.
  const clampCompanyValue = (key) => {
    const c = COMPANY_CONSTRAINTS[key];
    if (!c || c.type !== 'number') return;
    setCompanySettings((prev) => {
      const raw = prev[key];
      if (raw === '' || raw === null || raw === undefined) {
        return c.required && c.fallback !== undefined ? { ...prev, [key]: c.fallback } : prev;
      }
      const n = Number(raw);
      if (!Number.isFinite(n)) return { ...prev, [key]: c.fallback ?? c.min ?? 0 };
      const clamped = Math.min(c.max ?? Infinity, Math.max(c.min ?? -Infinity, n));
      return clamped === raw ? prev : { ...prev, [key]: clamped };
    });
  };

  // Date/Time Format: the reference pairs an editable combobox (the listed
  // formats plus "Custom Format", which frees the input for token text) with a
  // gray "Example" addon showing today's date / the live clock in that format.
  const renderFormatField = (field) => {
    const value = companySettings[field.key] ?? field.default;
    return (
      <SettingRow
        key={field.key}
        label={field.label}
        updated={stampFor('company', field.key)}
        description={
          <>
            {field.description}{' '}
            <Link
              href={field.link.href}
              target="_blank"
              rel="noopener"
              sx={{ color: '#404040', textDecoration: 'underline' }}
            >
              {field.link.text}
            </Link>
          </>
        }
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Autocomplete
            freeSolo
            disableClearable
            options={[...field.options.map((o) => o.value), CUSTOM_FORMAT_OPTION]}
            value={value}
            onChange={(event, picked) =>
              setCompanyValue(field.key, picked === CUSTOM_FORMAT_OPTION ? '' : picked)}
            onInputChange={(event, typed, reason) => {
              if (reason === 'input') setCompanyValue(field.key, typed);
            }}
            componentsProps={SETTING_LISTBOX_PROPS}
            sx={{ flex: 1 }}
            renderInput={(params) => (
              <TextField {...params} size="small" sx={SETTING_FIELD_SX} />
            )}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <Box
              sx={{
                py: 1, px: 2, fontSize: '14px', color: '#404040',
                backgroundColor: '#f5f5f5', borderRight: '1px solid #d4d4d4',
                borderRadius: '8px 0 0 8px'
              }}
            >
              Example
            </Box>
            <Typography sx={{ px: 2, fontSize: '14px', color: '#404040' }}>
              {formatWithTokens(currentDateTime, value)}
            </Typography>
          </Box>
        </Box>
      </SettingRow>
    );
  };

  const renderDefaultSaleKeysField = (field) => (
    <SettingRow
      key={field.key}
      label={field.label}
      updated={stampFor('company', field.key)}
      description={field.description}
      onMoreInfo={field.moreDescription ? () => setSlideOverField(field) : undefined}
    >
      <FormControl fullWidth size="small" sx={SETTING_FIELD_SX}>
        <Select
          // A saved set that was since renamed or deleted is out of range and
          // MUI warns on every render - fall back to empty until it is re-picked.
          value={saleKeySets.some(s => s.name === companySettings.defaultSaleKeys)
            ? companySettings.defaultSaleKeys
            : ''}
          onChange={handleCompanySettingChange('defaultSaleKeys')}
          disabled={loadingSaleKeySets}
        >
          {loadingSaleKeySets ? (
            <MenuItem value="">Loading...</MenuItem>
          ) : (
            saleKeySets.map((saleKeySet) => (
              <MenuItem key={saleKeySet.id} value={saleKeySet.name}>
                {saleKeySet.name}
              </MenuItem>
            ))
          )}
        </Select>
      </FormControl>
    </SettingRow>
  );

  // Reference "Edit Reasons" row: green-outlined full-width button (pencil
  // icon) opening the slide-over, helper line below when the list is empty.
  const renderReasonListField = (field) => (
    <SettingRow
      key={field.key}
      label={field.label}
      updated={REASON_LIST_FIELDS[field.key].apiType
        ? (formatStamp(cashReasonStamps[REASON_LIST_FIELDS[field.key].apiType]) || '—')
        : stampFor('company', field.key)}
      description={field.description}
    >
      <Button
        fullWidth
        startIcon={<EditOutlined sx={{ fontSize: 20 }} />}
        onClick={() => setReasonsEditor(field.key)}
        sx={{
          height: 42, borderRadius: '12px', textTransform: 'none',
          fontSize: 16, fontWeight: 700, letterSpacing: '0.025em',
          color: '#32b643', border: '1px solid #32b643', backgroundColor: '#fff',
          '&:hover': { color: '#6dd77b', borderColor: '#6dd77b', backgroundColor: '#fff' }
        }}
      >
        Edit Reasons
      </Button>
      {reasonListFor(field.key).length === 0 && (
        <Typography sx={{ fontSize: 14, color: '#404040', mt: 1 }}>
          No reasons are provided, the users will always need to type in the reason
        </Typography>
      )}
    </SettingRow>
  );

  const CUSTOM_FIELD_RENDERERS = {
    dateFormat: renderFormatField,
    timeFormat: renderFormatField,
    defaultSaleKeys: renderDefaultSaleKeysField,
    predefinedDiscountReasons: renderReasonListField,
    predefinedCashDrawerReasons: renderReasonListField,
    predefinedCashOutReasons: renderReasonListField,
    predefinedCashInReasons: renderReasonListField
  };

  const renderCompanyField = (field) => {
    if (field.visibleWhen && !field.visibleWhen(companySettings)) return null;
    if (field.type === 'custom') {
      const renderCustom = CUSTOM_FIELD_RENDERERS[field.key];
      return renderCustom ? renderCustom(field) : null;
    }

    let control;
    if (field.type === 'toggle') {
      control = (
        <SettingToggle
          checked={!!companySettings[field.key]}
          onChange={handleCompanySettingChange(field.key)}
          stateText={companySettings[field.key] ? field.enabledLabel : field.disabledLabel}
        />
      );
    } else if (field.type === 'select') {
      // Legacy values are already mapped onto the reference options by
      // normalizeCompanySettings on load, so what renders is what will be saved.
      const value = companySettings[field.key] ?? field.default ?? '';
      // Long lists (the 400+ IANA timezones) render as a filterable combobox.
      control = field.searchable ? (
        <Autocomplete
          disableClearable
          options={field.options.map((o) => o.value)}
          // a stored value the platform no longer lists would make MUI warn on
          // every render - show it as empty until it is re-picked
          value={field.options.some((o) => o.value === value) ? value : null}
          onChange={(event, picked) => picked && setCompanyValue(field.key, picked)}
          componentsProps={SETTING_LISTBOX_PROPS}
          renderInput={(params) => (
            <TextField {...params} size="small" sx={SETTING_FIELD_SX} />
          )}
        />
      ) : (
        <FormControl fullWidth size="small" sx={SETTING_FIELD_SX}>
          <Select
            value={value}
            onChange={handleCompanySettingChange(field.key)}
            displayEmpty={field.options.some(o => o.value === '')}
          >
            {field.options.map((option) => (
              <MenuItem key={String(option.value)} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      );
    } else {
      control = (
        <TextField
          type={field.type === 'number' ? 'number' : (field.inputType || 'text')}
          fullWidth
          value={companySettings[field.key] ?? ''}
          onChange={handleCompanySettingChange(field.key)}
          onBlur={() => clampCompanyValue(field.key)}
          placeholder={field.placeholder}
          inputProps={field.constraints
            ? { min: field.constraints.min, max: field.constraints.max, step: field.constraints.step }
            : undefined}
          size="small"
          sx={SETTING_FIELD_SX}
        />
      );
    }

    return (
      <SettingRow
        key={field.key}
        label={field.label}
        updated={stampFor('company', field.key)}
        // measured descriptions carry the reference's **bold** markers
        description={renderRichText(field.description)}
        onMoreInfo={field.moreDescription ? () => setSlideOverField(field) : undefined}
      >
        {control}
      </SettingRow>
    );
  };

  const renderCompanyTab = () => (
    <Box>
      {COMPANY_SECTIONS.map((section) => (
        <SettingsSection
          key={section.key}
          id={section.key}
          label={section.label}
          flash={flashSection === section.key}
        >
          {section.fields.map(renderCompanyField)}
        </SettingsSection>
      ))}

      {/* Local-only settings the reference lacks - kept, clearly separated */}
      {user?.isSuperAdmin && (
        <SettingsSection id="local" label="Local settings (not in Shopfront)" flash={flashSection === 'local'}>
          <SettingRow
            label="Default Sale Keys by Outlet"
            description="Choose an outlet and assign the sale key set its registers should start on."
          >
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 2 }}>
              <FormControl size="small" sx={SETTING_FIELD_SX}>
                <InputLabel>Outlet</InputLabel>
                <Select
                  label="Outlet"
                  value={selectedOutletForSaleKeys}
                  onChange={(e) => {
                    setSelectedOutletForSaleKeys(e.target.value);
                    loadSaleKeySetsForOutlet(e.target.value);
                  }}
                  disabled={loadingOutlets}
                >
                  {outlets.map(o => (
                    <MenuItem key={o.id} value={o.id.toString()}>{o.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={SETTING_FIELD_SX}>
                <InputLabel>Sale Key Set</InputLabel>
                <Select
                  label="Sale Key Set"
                  value={selectedOutletSaleKeySetId}
                  onChange={(e) => setSelectedOutletSaleKeySetId(e.target.value)}
                  disabled={loadingSaleKeySets || outletSaleKeySets.length === 0}
                >
                  {outletSaleKeySets.map(s => (
                    <MenuItem key={s.id} value={String(s.id)}>
                      {s.name}{s.isDefault ? ' (Default)' : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="contained"
                onClick={handleSetDefaultSaleKeysForOutlet}
                disabled={!selectedOutletSaleKeySetId}
                sx={{
                  bgcolor: '#5ebbeb', color: '#fff', height: 42, borderRadius: '12px',
                  fontSize: 16, fontWeight: 700, textTransform: 'none', boxShadow: 'none',
                  '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' }
                }}
              >
                Set as Default
              </Button>
            </Box>
          </SettingRow>
        </SettingsSection>
      )}
    </Box>
  );

  // Green row action - resting #32b643, hover #6dd77b, instant (transition: all 0s).
  const renderEditAction = (onClick) => (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', justifyContent: 'flex-end' }}>
      <Box
        component="li"
        onClick={onClick}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '0 8px',
          cursor: 'pointer',
          color: '#32b643',
          fontSize: 16,
          fontWeight: 400,
          background: 'transparent',
          border: 'none',
          borderRadius: 0,
          transition: 'all 0s',
          '&:hover': { color: '#6dd77b' }
        }}
      >
        <EditOutlined sx={{ fontSize: 20 }} />
        Edit
      </Box>
    </Box>
  );

  const outletListRowSx = (isParent) => ({
    backgroundColor: isParent ? '#f8f8f8' : 'transparent',
    transition: 'all 0s',
    '&:hover': { backgroundColor: 'rgb(223,223,223)' },
    '& > td': {
      height: isParent ? 62 : 52,
      // ponytail: vertical padding on top of a fixed height pushed rows to 69/57.
      // Horizontal padding only - `height` already reserves the row box.
      padding: '0 16px',
      borderTop: '1px solid #000',
      borderBottom: '1px solid #000',
      textAlign: 'left'
    }
  });

  // Shared outlet/register list. `onEditRegister` decides what the per-register
  // Edit action opens (Outlets tab jumps to the Registers tab, Registers tab
  // opens the register editor).
  const renderOutletsList = (onEditRegister) => (
    <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', mb: 4 }}>
      {/* Header is present for semantics but collapsed to 0 height, as on the reference */}
      <Box component="thead" sx={{ display: 'block', height: 0, overflow: 'hidden' }}>
        <Box component="tr">
          {/* tableLayout:fixed takes its widths from the FIRST row - that is this
              header row, so the 104px actions column has to be declared here. */}
          <Box component="th" sx={{ fontSize: 16, fontWeight: 700, padding: '8px', textAlign: 'left', width: 'auto' }}>Name</Box>
          <Box component="th" sx={{ fontSize: 16, fontWeight: 700, padding: '8px', textAlign: 'left', width: 104 }}>Actions</Box>
        </Box>
      </Box>
      <Box component="tbody">
        {outlets.map((outlet) => (
          <React.Fragment key={outlet.id}>
            <Box component="tr" sx={outletListRowSx(true)}>
              <Box component="td">
                <Box className="outlet" sx={{ fontSize: 24, fontWeight: 700, color: '#000' }}>
                  {outlet.name}
                </Box>
              </Box>
              <Box component="td" sx={{ width: 104 }}>
                {renderEditAction(() => openOutletEditor(outlet))}
              </Box>
            </Box>
            {registers.filter(r => r.outletId === outlet.id).map((register) => (
              <Box component="tr" key={`r-${register.id}`} sx={outletListRowSx(false)}>
                <Box component="td" sx={{ fontSize: 16, fontWeight: 400 }}>{register.name}</Box>
                <Box component="td" sx={{ width: 104 }}>
                  {renderEditAction(() => {
                    if (onEditRegister) return onEditRegister(register);
                    setSelectedRegister(String(register.id));
                    setActiveTab(2);
                  })}
                </Box>
              </Box>
            ))}
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );

  const renderOutletEditorField = (label, key) => (
    <Box key={key} sx={{ mb: '12px' }}>
      <Typography sx={{ fontSize: 16, fontWeight: 700, height: 30, lineHeight: '30px' }}>{label}</Typography>
      <TextField
        value={outletProfile[key] || ''}
        onChange={handleOutletProfileChange(key)}
        sx={outletEditorInputSx}
      />
    </Box>
  );

  const renderOutletEditor = () => {
    const outlet = outlets.find(o => o.id === editingOutletId);
    return (
      <Box sx={{ p: 3 }}>
        <Box
          onClick={() => { setEditingOutletId(null); setSearchParams({}); }}
          sx={{
            display: 'inline-flex', alignItems: 'center', gap: '4px', mb: 2, cursor: 'pointer',
            color: '#32b643', fontSize: 16, transition: 'all 0s', '&:hover': { color: '#6dd77b' }
          }}
        >
          <ArrowBackOutlined sx={{ fontSize: 20 }} /> Outlets
        </Box>
        <Typography sx={{ fontSize: 24, fontWeight: 700, mb: 2 }}>
          Editing {outletProfile.name || outlet?.name || ''}
        </Typography>

        <Box sx={{ display: 'flex', gap: 0, borderBottom: '1px solid #ddd', mb: 3 }}>
          {['General', 'Contact', 'Address'].map((label, index) => (
            <Box
              key={label}
              component="button"
              type="button"
              onClick={() => setOutletEditorTab(index)}
              sx={{
                height: 56,
                padding: '16px 24px',
                fontSize: 14,
                fontWeight: 400,
                fontFamily: 'inherit',
                cursor: 'pointer',
                border: 0,
                borderBottom: '4px solid',
                borderBottomColor: outletEditorTab === index ? '#5ebbeb' : 'transparent',
                borderRadius: '8px 8px 0 0',
                backgroundColor: outletEditorTab === index ? '#fff' : 'transparent',
                color: outletEditorTab === index ? '#000' : '#676b72',
                transition: 'color 0.15s, background-color 0.15s, border-color 0.15s'
              }}
            >
              {label}
            </Box>
          ))}
        </Box>

        {outletEditorTab === 0 && (
          <Box>
            {renderOutletEditorField('Name', 'name')}
            {renderOutletEditorField('Business Number', 'businessNumber')}
            <Box sx={{ mb: '12px' }}>
              <Typography sx={{ fontSize: 16, fontWeight: 700, height: 30, lineHeight: '30px' }}>
                Has Kitchen Screen
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', height: 42 }}>
                <ShopfrontSwitch checked={!!outletProfile.hasKitchenScreen} disabled />
                <Typography sx={{ ml: '8px', fontSize: 14, color: 'oklch(0.371 0 0)' }}>
                  This Outlet is not allowed to use Kitchen Screens
                </Typography>
              </Box>
            </Box>
            <Box sx={{ mb: '12px' }}>
              <Typography sx={{ fontSize: 16, fontWeight: 700, height: 30, lineHeight: '30px' }}>Logo</Typography>
              <Box
                component="label"
                sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '100%', maxWidth: 764, minHeight: 120, mb: 1, cursor: 'pointer',
                  border: '1px dashed #d9d9d9', backgroundColor: '#f7f7f7',
                  fontSize: 16, color: '#676b72'
                }}
              >
                <input type="file" accept="image/*" hidden onChange={handleOutletLogoSelect} />
                {outletProfile.logo
                  ? <Box component="img" src={outletProfile.logo} alt="Outlet logo" sx={{ maxWidth: '100%', maxHeight: 200 }} />
                  : 'Select to Add Image'}
              </Box>
              <Button
                onClick={() => setOutletProfile(prev => ({ ...prev, logo: '' }))}
                sx={{
                  width: '100%', maxWidth: 764, height: 42, borderRadius: '12px',
                  background: 'transparent', border: '1px solid oklch(0.556 0 0)',
                  color: 'oklch(0.439 0 0)', fontSize: 16, fontWeight: 700,
                  padding: '8px 32px', textTransform: 'none', boxShadow: 'none'
                }}
              >
                Remove Image
              </Button>
            </Box>
          </Box>
        )}

        {outletEditorTab === 1 && (
          <Box>{OUTLET_CONTACT_FIELDS.map(([label, key]) => renderOutletEditorField(label, key))}</Box>
        )}

        {outletEditorTab === 2 && (
          <Box>{OUTLET_ADDRESS_FIELDS.map(([label, key]) => renderOutletEditorField(label, key))}</Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSaveOutletProfile}
            disabled={loading}
            sx={{
              bgcolor: '#5ebbeb', color: '#fff', height: 42, px: 6, borderRadius: '12px',
              fontSize: 16, fontWeight: 700, textTransform: 'none', boxShadow: 'none',
              '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' }
            }}
          >
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </Box>
      </Box>
    );
  };

  const renderOutletsTab = () => editingOutletId ? renderOutletEditor() : (
    <Box sx={{ p: 3 }}>
      {renderOutletsList()}

      {/* Outlet Selection Dropdown */}
      <Box sx={{ mb: 4 }}>
        <FormControl fullWidth size="small">
          <Select
            value={selectedOutlet}
            onChange={(e) => setSelectedOutlet(e.target.value)}
            disabled={loadingOutlets}
            sx={{
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: '#000',
                borderRadius: 0
              }
            }}
          >
            {loadingOutlets ? (
              <MenuItem value="">Loading outlets...</MenuItem>
            ) : outlets.length > 0 ? (
              outlets.map((outlet) => (
                <MenuItem key={outlet.id} value={outlet.id.toString()}>
                  {outlet.name}
                </MenuItem>
              ))
            ) : (
              <MenuItem value="">No outlets available</MenuItem>
            )}
          </Select>
        </FormControl>
      </Box>

      {/* Outlet Settings */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <SettingsIcon sx={{ mr: 1, color: '#666' }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            General
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Email receipt template */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                Email receipt template
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Select template for email receipts
              </Typography>
            </Box>
            <FormControl fullWidth size="small">
              <Select
                value={outletSettings.emailReceiptTemplate || ''}
                onChange={handleOutletSettingChange('emailReceiptTemplate')}
                disabled={loadingEmailTemplates}
                displayEmpty
              >
                <MenuItem value="">
                  <em>Select a template</em>
                </MenuItem>
                {emailReceiptTemplates.map((template) => (
                  <MenuItem key={template.id} value={template.name}>
                    {template.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                Outlet email
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Updated {stampFor('outlet', 'outletEmail')}
              </Typography>
            </Box>
            <TextField
              value={outletSettings.outletEmail}
              onChange={handleOutletSettingChange('outletEmail')}
              size="small"
              fullWidth
              type="email"
            />
          </Box>
        </Box>
      </Box>

      <Divider sx={{ my: 4 }} />

      {/* Gift Cards Section */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            🎁 Gift Cards
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Enable gift cards */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                Enable gift cards
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Updated {stampFor('outlet', 'enableGiftCards')}
              </Typography>
            </Box>
            <Switch
              checked={outletSettings.enableGiftCards}
              onChange={handleOutletSettingChange('enableGiftCards')}
            />
          </Box>

          {/* Default expiry amount */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                Default expiry amount
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Updated {stampFor('outlet', 'defaultExpiryAmount')}
              </Typography>
            </Box>
            <TextField
              type="number"
              value={outletSettings.defaultExpiryAmount}
              onChange={handleOutletSettingChange('defaultExpiryAmount')}
              size="small"
              fullWidth
            />
          </Box>

          {/* Default expiry period */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                Default expiry period
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Updated {stampFor('outlet', 'defaultExpiryPeriod')}
              </Typography>
            </Box>
            <FormControl fullWidth size="small">
              <Select
                value={outletSettings.defaultExpiryPeriod}
                onChange={handleOutletSettingChange('defaultExpiryPeriod')}
              >
                <MenuItem value="Days">Days</MenuItem>
                <MenuItem value="Weeks">Weeks</MenuItem>
                <MenuItem value="Months">Months</MenuItem>
                <MenuItem value="Years">Years</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Can manually adjust expiry */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                Can manually adjust expiry
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Updated {stampFor('outlet', 'canManuallyAdjustExpiry')}
              </Typography>
            </Box>
            <Switch
              checked={outletSettings.canManuallyAdjustExpiry}
              onChange={handleOutletSettingChange('canManuallyAdjustExpiry')}
            />
          </Box>
        </Box>
      </Box>

      <Divider sx={{ my: 4 }} />

      {/* Transfers Section */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            🔄 Transfers
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="body1" sx={{ fontWeight: 500 }}>
              Update last cost when receiving transfers
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Updated {stampFor('outlet', 'updateLastCostWhenReceivingTransfers')}
            </Typography>
          </Box>
          <Switch
            checked={outletSettings.updateLastCostWhenReceivingTransfers}
            onChange={handleOutletSettingChange('updateLastCostWhenReceivingTransfers')}
          />
        </Box>
      </Box>

      <Divider sx={{ my: 4 }} />

      {/* Metcash Integration Section */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            🏢 Metcash Integration
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* B2B Account */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                B2B Account (leave blank for default)
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Updated {stampFor('outlet', 'b2bAccount')}
              </Typography>
            </Box>
            <TextField
              value={outletSettings.b2bAccount}
              onChange={handleOutletSettingChange('b2bAccount')}
              size="small"
              fullWidth
            />
          </Box>

          {/* B2B Password */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                B2B Password (leave blank for default)
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Updated {stampFor('outlet', 'b2bPassword')}
              </Typography>
            </Box>
            <TextField
              value={outletSettings.b2bPassword}
              onChange={handleOutletSettingChange('b2bPassword')}
              size="small"
              fullWidth
              type="password"
            />
          </Box>

          {/* Customer ID */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                Customer ID
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Updated {stampFor('outlet', 'customerId')}
              </Typography>
            </Box>
            <TextField
              type="number"
              value={outletSettings.customerId}
              onChange={handleOutletSettingChange('customerId')}
              size="small"
              fullWidth
            />
          </Box>

          {/* State */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                State
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Updated {stampFor('outlet', 'state')}
              </Typography>
            </Box>
            <FormControl fullWidth size="small">
              <Select
                value={outletSettings.state}
                onChange={handleOutletSettingChange('state')}
                displayEmpty
              >
                <MenuItem value="">Select...</MenuItem>
                <MenuItem value="NSW">NSW</MenuItem>
                <MenuItem value="VIC">VIC</MenuItem>
                <MenuItem value="QLD">QLD</MenuItem>
                <MenuItem value="WA">WA</MenuItem>
                <MenuItem value="SA">SA</MenuItem>
                <MenuItem value="TAS">TAS</MenuItem>
                <MenuItem value="NT">NT</MenuItem>
                <MenuItem value="ACT">ACT</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Pillar */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                Pillar
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Updated {stampFor('outlet', 'pillar')}
              </Typography>
            </Box>
            <FormControl fullWidth size="small">
              <Select
                value={outletSettings.pillar}
                onChange={handleOutletSettingChange('pillar')}
                displayEmpty
              >
                <MenuItem value="">Select...</MenuItem>
                <MenuItem value="IGA">IGA</MenuItem>
                <MenuItem value="Foodworks">Foodworks</MenuItem>
                <MenuItem value="SPAR">SPAR</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Import toggles */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                Import Promotions
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Updated {stampFor('outlet', 'importPromotions')}
              </Typography>
            </Box>
            <Switch
              checked={outletSettings.importPromotions}
              onChange={handleOutletSettingChange('importPromotions')}
            />
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                Import Buying Periods
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Updated {stampFor('outlet', 'importBuyingPeriods')}
              </Typography>
            </Box>
            <Switch
              checked={outletSettings.importBuyingPeriods}
              onChange={handleOutletSettingChange('importBuyingPeriods')}
            />
          </Box>
        </Box>
      </Box>

      <Divider sx={{ my: 4 }} />

      {/* Miscellaneous Section */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            ⚙️ Miscellaneous
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Discounting Below Cost Behaviour */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                Discounting Below Cost Behaviour
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Updated {stampFor('outlet', 'discountingBelowCostBehaviour')}
              </Typography>
            </Box>
            <FormControl fullWidth size="small">
              <Select
                value={outletSettings.discountingBelowCostBehaviour}
                onChange={handleOutletSettingChange('discountingBelowCostBehaviour')}
              >
                <MenuItem value="Allow">Allow</MenuItem>
                <MenuItem value="Warn">Warn</MenuItem>
                <MenuItem value="Block">Block</MenuItem>
              </Select>
            </FormControl>
          </Box>

        </Box>
      </Box>

    </Box>
  );

  // Inline-expanding single-select used by Register Closures > Print Settings.
  // The panel expands under the trigger (no popover, no transition), matching the reference.
  const renderClosurePrintSelect = ([label, key]) => {
    const open = openClosureKey === key;
    const value = registerProfile.closurePrint?.[key] || DEFAULT_CLOSURE_PRINT[key];
    return (
      <Box key={key} sx={{ mb: '12px', width: '100%', maxWidth: 762 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 700, height: 30, lineHeight: '30px' }}>{label}</Typography>
        <Box
          component="button"
          type="button"
          onClick={() => setOpenClosureKey(open ? null : key)}
          sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', height: 42, padding: '8px 16px', fontSize: 16, fontFamily: 'inherit',
            cursor: 'pointer', textAlign: 'left', backgroundColor: '#fff', color: '#000',
            border: '1px solid oklch(0.371 0 0)',
            borderRadius: open ? '8px 8px 0 0' : '8px',
            transition: 'all 0s'
          }}
        >
          {value}
          <ArrowDropDown sx={{ transform: open ? 'rotate(180deg)' : 'none' }} />
        </Box>
        {open && (
          <Box
            sx={{
              width: '100%', backgroundColor: '#fff',
              border: '1px solid oklch(0.371 0 0)', borderTop: 0, borderRadius: '0 0 8px 8px',
              transition: 'all 0s', animationName: 'none'
            }}
          >
            {CLOSURE_PRINT_OPTIONS.map((option) => (
              <Box
                key={option}
                onClick={() => {
                  setRegisterProfile(prev => ({
                    ...prev,
                    closurePrint: { ...DEFAULT_CLOSURE_PRINT, ...prev.closurePrint, [key]: option }
                  }));
                  setOpenClosureKey(null);
                }}
                sx={{
                  display: 'flex', alignItems: 'center', height: 56, padding: '16px',
                  fontSize: 16, cursor: 'pointer', transition: 'all 0s',
                  color: option === value ? 'oklch(0.685 0.169 237.323)' : 'oklch(0.145 0 0)',
                  '&:hover': { backgroundColor: '#f8f8f8' }
                }}
              >
                {option}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    );
  };

  const renderRegisterEditor = () => {
    const register = registers.find(r => r.id === editingRegisterId);
    return (
      <Box sx={{ p: 3 }} onKeyDown={(e) => { if (e.key === 'Escape') setOpenClosureKey(null); }}>
        <Box
          onClick={() => { setEditingRegisterId(null); setSearchParams({}); }}
          sx={{
            display: 'inline-flex', alignItems: 'center', gap: '4px', mb: 2, cursor: 'pointer',
            color: '#32b643', fontSize: 16, transition: 'all 0s', '&:hover': { color: '#6dd77b' }
          }}
        >
          <ArrowBackOutlined sx={{ fontSize: 20 }} /> Registers
        </Box>
        <Typography sx={{ fontSize: 24, fontWeight: 700, mb: 2 }}>
          {/* live edited name first - the list record is stale until it reloads */}
          Editing {registerProfile.name || register?.name || ''}
        </Typography>

        <Box sx={{ display: 'flex', gap: 0, borderBottom: '1px solid #ddd', mb: 3 }}>
          {[{ label: 'General', icon: SettingsOutlined }, { label: 'Register Closures', icon: PrintOutlined }].map((tab, index) => (
            <Box
              key={tab.label}
              component="button"
              type="button"
              onClick={() => setRegisterEditorTab(index)}
              sx={{
                display: 'flex', alignItems: 'center', gap: '8px',
                height: 56, padding: '16px 24px', fontSize: 14, fontWeight: 400,
                fontFamily: 'inherit', cursor: 'pointer', border: 0,
                borderBottom: '4px solid transparent',
                borderRadius: '8px 8px 0 0',
                backgroundColor: registerEditorTab === index ? '#fff' : 'transparent',
                color: registerEditorTab === index ? '#000' : '#676b72',
                transition: registerEditorTab === index
                  ? 'all 0s'
                  : 'color 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <tab.icon sx={{ fontSize: 20 }} />
              {tab.label}
            </Box>
          ))}
        </Box>

        {registerEditorTab === 0 && (
          <Box>
            <Box sx={{ mb: '12px' }}>
              <Typography sx={{ fontSize: 16, fontWeight: 700, height: 30, lineHeight: '30px' }}>Name</Typography>
              <TextField
                value={registerProfile.name}
                onChange={(e) => setRegisterProfile(prev => ({ ...prev, name: e.target.value }))}
                sx={outletEditorInputSx}
              />
            </Box>

            <Box sx={{ mb: '12px' }}>
              <Typography sx={{ fontSize: 16, fontWeight: 700, height: 30, lineHeight: '30px' }}>
                Invoice Number
              </Typography>
              {editingInvoiceNumber ? (
                <TextField
                  autoFocus
                  value={registerProfile.invoiceNumber}
                  onChange={(e) => setRegisterProfile(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                  onBlur={() => setEditingInvoiceNumber(false)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingInvoiceNumber(false); }}
                  sx={outletEditorInputSx}
                />
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px', height: 42 }}>
                  <Typography sx={{ fontSize: 16 }}>{registerProfile.invoiceNumber || '-'}</Typography>
                  <Box
                    component="button"
                    type="button"
                    aria-label="Edit invoice number"
                    onClick={() => setEditingInvoiceNumber(true)}
                    sx={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 25, height: 24, padding: '4px', border: 0, borderRadius: '4px',
                      cursor: 'pointer', background: 'transparent', color: '#15803d',
                      transition: 'all 0s',
                      '&:hover': { backgroundColor: 'rgba(0,0,0,0.10)' }
                    }}
                  >
                    <EditOutlined sx={{ fontSize: 16 }} />
                  </Box>
                </Box>
              )}
            </Box>

            <Typography sx={{ fontSize: 24, fontWeight: 700, mt: 4, mb: 2 }}>Payment Methods</Typography>
            {paymentMethods.length === 0 && (
              <Typography sx={{ fontSize: 14, color: '#676b72' }}>No payment methods configured.</Typography>
            )}
            {/* reference lists payment methods ascending by name */}
            {[...paymentMethods].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((pm) => {
              const enabled = registerProfile.payments?.[pm.id] !== false;
              return (
                <Box key={pm.id} sx={{ mb: '12px' }}>
                  <Typography sx={{ fontSize: 16, fontWeight: 700, height: 30, lineHeight: '30px' }}>
                    {pm.name}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', height: 42 }}>
                    <ShopfrontSwitch
                      checked={enabled}
                      onChange={(e) => setRegisterProfile(prev => ({
                        ...prev,
                        payments: { ...prev.payments, [pm.id]: e.target.checked }
                      }))}
                    />
                    <Typography sx={{ ml: '8px', fontSize: 14, color: 'oklch(0.371 0 0)' }}>
                      {enabled
                        ? 'This payment method will be available to use on this register'
                        : 'The register will not have access to this payment method'}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}

        {registerEditorTab === 1 && (
          <Box>
            <Typography sx={{ fontSize: 24, fontWeight: 700, mb: 2 }}>Print Settings</Typography>
            {CLOSURE_PRINT_SECTIONS.map(([label, key]) => renderClosurePrintSelect([label, key]))}
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSaveRegisterProfile}
            disabled={loading}
            sx={{
              bgcolor: '#5ebbeb', color: '#fff', height: 42, px: 6, borderRadius: '12px',
              fontSize: 16, fontWeight: 700, textTransform: 'none', boxShadow: 'none',
              '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' }
            }}
          >
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </Box>
      </Box>
    );
  };

  const renderRegistersTab = () => editingRegisterId ? renderRegisterEditor() : (
    <Box sx={{ p: 3 }}>
      {renderOutletsList(openRegisterEditor)}

      {/* Register Selection Dropdown */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {user?.isSuperAdmin ? 'Global' : (getOutletName() || 'N/A')}
        </Typography>
        <FormControl fullWidth size="small">
          <Select
            value={selectedRegister}
            onChange={(e) => setSelectedRegister(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: '#000',
                borderRadius: 0
              }
            }}
          >
            {registers.map((register) => (
              <MenuItem key={register.id} value={String(register.id)}>
                {register.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Register Settings Title */}
      <Typography variant="h5" sx={{ mb: 4, fontWeight: 600 }}>
        Register Settings
      </Typography>

      {/* General Section */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <SettingsIcon sx={{ mr: 1, color: '#666' }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            General
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Safe drop alert amount */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                Safe drop alert amount
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Updated {stampFor('register', 'safeDropAlertAmount')}
              </Typography>
            </Box>
            <TextField
              type="number"
              value={registerSettings.safeDropAlertAmount}
              onChange={handleRegisterSettingChange('safeDropAlertAmount')}
              size="small"
              fullWidth
            />
          </Box>

          {/* Default receipt template */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                Default Receipt Template
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Updated {stampFor('register', 'defaultReceiptTemplateId')}
              </Typography>
            </Box>
            <FormControl fullWidth size="small">
              <Select
                value={
                  // Settings saved before this field stored ids hold a template NAME;
                  // show that template so the picker isn't blank until the next save.
                  defaultReceiptTemplates.find((t) => t.id === registerSettings.defaultReceiptTemplateId)?.id
                  ?? defaultReceiptTemplates.find((t) => t.name === registerSettings.defaultReceiptTemplate)?.id
                  ?? ''
                }
                onChange={handleRegisterSettingChange('defaultReceiptTemplateId')}
                displayEmpty
              >
                {defaultReceiptTemplates.map((template) => (
                  <MenuItem key={template.id} value={template.id}>{template.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ my: 4 }} />

      {/* Sell Screen Section */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            🖥️ Sell Screen
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {[
            { key: 'loginAfterSale', label: 'Login after sale' },
            { key: 'neverOpenCashDrawer', label: 'Never open cash drawer' },
            { key: 'printReceiptOnRefund', label: 'Print receipt on refund' },
            { key: 'useTyroIntegratedReceipts', label: 'Use Tyro integrated receipts' },
            { key: 'consolidateProducts', label: 'Consolidate products' },
            { key: 'allowTrainingModeToggle', label: 'Allow training mode to be toggled' },
            { key: 'requireNoteOnRegisterClosureWithDiscrepancy', label: 'Require note on register closure with discrepancy' },
            { key: 'runPromotionCalculationInDedicatedThread', label: 'Run promotion calculation in a dedicated thread' }
          ].map((setting) => (
            <Box key={setting.key} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {setting.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Updated {stampFor('register', setting.key)}
                </Typography>
              </Box>
              <Switch
                checked={registerSettings[setting.key]}
                onChange={handleRegisterSettingChange(setting.key)}
              />
            </Box>
          ))}
        </Box>
      </Box>

      <Divider sx={{ my: 4 }} />

      {/* Customer Display Section */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            👥 Customer Display
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Customer display template */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                Customer display template
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Updated {stampFor('register')}
              </Typography>
            </Box>
            <FormControl fullWidth size="small">
              <Select
                value={registerCustomerDisplaySettings.templateId}
                onChange={(event) => {
                  markDirty('register');
                  setRegisterCustomerDisplaySettings((prev) => ({
                    ...prev,
                    templateId: event.target.value,
                    isEnabled: Boolean(event.target.value),
                  }));
                }}
              >
                {customerDisplayTemplates.map((template) => (
                  <MenuItem key={template.id} value={template.id}>
                    {template.name} (#{template.id})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button sx={{ mt: 1 }} onClick={() => navigate('/setup/customer-display')}>
              Edit templates
            </Button>
          </Box>

          {/* Open customer display when register opens */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                Open customer display when register opens
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Updated {stampFor('register')}
              </Typography>
            </Box>
            <Switch
              checked={registerCustomerDisplaySettings.openWhenRegisterOpens}
              onChange={(event) => {
                markDirty('register');
                setRegisterCustomerDisplaySettings((prev) => ({
                  ...prev,
                  openWhenRegisterOpens: event.target.checked,
                }));
              }}
            />
          </Box>

          {/* Customer display mode */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                Customer display mode
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Updated {stampFor('register')}
              </Typography>
            </Box>
            <FormControl fullWidth size="small">
              <Select
                value={registerCustomerDisplaySettings.displayMode}
                onChange={(event) => {
                  markDirty('register');
                  setRegisterCustomerDisplaySettings((prev) => ({
                    ...prev,
                    displayMode: event.target.value,
                  }));
                }}
              >
                <MenuItem value="Popup">Popup</MenuItem>
                <MenuItem value="Fullscreen">Fullscreen</MenuItem>
                <MenuItem value="Window">Window</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ my: 4 }} />

      {/* Invoices Section */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            📄 Invoices
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Offline invoice suffix */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                Offline invoice suffix
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Updated {stampFor('register', 'offlineInvoiceSuffix')}
              </Typography>
            </Box>
            <TextField
              value={registerSettings.offlineInvoiceSuffix}
              onChange={handleRegisterSettingChange('offlineInvoiceSuffix')}
              size="small"
              fullWidth
            />
          </Box>

          {/* Invoice Number Mode */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                Invoice Number Mode
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Updated {stampFor('register', 'invoiceNumberMode')}
              </Typography>
            </Box>
            <FormControl fullWidth size="small">
              <Select
                value={registerSettings.invoiceNumberMode}
                onChange={handleRegisterSettingChange('invoiceNumberMode')}
              >
                <MenuItem value="Incremental">Incremental</MenuItem>
                <MenuItem value="Random">Random</MenuItem>
                <MenuItem value="Date-based">Date-based</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Invoice max number */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                Invoice max number (until next invoice batch requested)
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Updated {stampFor('register', 'invoiceMaxNumber')}
              </Typography>
            </Box>
            <TextField
              type="number"
              value={registerSettings.invoiceMaxNumber}
              onChange={handleRegisterSettingChange('invoiceMaxNumber')}
              size="small"
              fullWidth
            />
          </Box>
        </Box>
      </Box>


    </Box>
  );

  // Reference lists Default plus every real sale-key set.
  const userSaleKeyOptions = ['Default', ...saleKeySets.map(s => s.name).filter(n => n && n !== 'Default')];

  const renderUsersTab = () => selectedUsers.length === 0 ? (
    <Box
      sx={{
        maxWidth: 618, minHeight: 400, mt: 4, borderRadius: 0,
        border: '1px dashed #d9d9d9', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 1
      }}
    >
      <ManageAccountsOutlined sx={{ fontSize: 32, color: '#676b72' }} />
      <Typography sx={{ fontSize: '16px', color: '#676b72' }}>
        Select which Users to edit...
      </Typography>
    </Box>
  ) : (
    <Box>
      {/* Miscellaneous Section */}
      <Box
        id="section-user-miscellaneous"
        sx={{
          borderTop: '1px solid #e5e5e5', px: '4px', pt: 6, pb: 6, scrollMarginTop: '144px',
          borderRadius: '8px', transition: 'background-color 300ms',
          backgroundColor: flashSection === 'user-miscellaneous' ? '#f0f0f0' : 'transparent'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <CardGiftcardOutlined sx={{ color: '#000', fontSize: 24 }} />
          <Typography component="h2" sx={{ fontSize: '24px', fontWeight: 700, color: '#000' }}>
            Miscellaneous
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <SettingRow
            label="Sale Keys"
            updated={stampFor('user', 'saleKeys')}
            description="The sale keys to use, overrides all other sale key settings"
          >
            <Autocomplete
              options={selectedFirst(userSaleKeyOptions, userSettings.saleKeys || 'Default')}
              value={userSettings.saleKeys || 'Default'}
              disableClearable
              disabled={loadingSaleKeySets}
              onChange={(event, value) => {
                markDirty('users');
                setUserSettings(prev => ({ ...prev, saleKeys: value || 'Default' }));
              }}
              componentsProps={SETTING_LISTBOX_PROPS}
              sx={{ maxWidth: 618 }}
              renderInput={(params) => <TextField {...params} size="small" sx={USER_FIELD_SX} />}
            />
          </SettingRow>

          <SettingRow
            label="Sale Keys Position"
            updated={stampFor('user', 'saleKeysPosition')}
            description="Show sale keys on the left-hand side or right-hand side of the sell screen"
          >
            <FormControl fullWidth size="small" sx={USER_FIELD_SX}>
              <Select
                value={userSettings.saleKeysPosition || 'Default'}
                onChange={handleUserSettingChange('saleKeysPosition')}
                MenuProps={SETTING_MENU_PROPS}
              >
                <MenuItem value="Default">Default</MenuItem>
                <MenuItem value="Left">Left</MenuItem>
                <MenuItem value="Right">Right</MenuItem>
              </Select>
            </FormControl>
          </SettingRow>
        </Box>
      </Box>

    </Box>
  );

  return (
    <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
      {/* Sticky settings rail - reference chrome: slate panel, 4px right rule,
          active tab = white card, sub-nav = in-page scroll anchors. */}
      <Box
        component="nav"
        sx={{
          width: 320,
          flexShrink: 0,
          position: 'sticky',
          // The app bar is position:fixed and 50px tall, so a sticky top of 0 parks this
          // rail UNDERNEATH it and the tab labels get clipped as soon as the page scrolls.
          top: APP_BAR_HEIGHT,
          alignSelf: 'flex-start',
          display: { xs: 'none', md: 'block' },
          minHeight: `calc(100vh - ${APP_BAR_HEIGHT}px)`,
          backgroundColor: '#e2e8f0',
          borderRight: '4px solid rgba(203,213,225,0.5)',
          pt: 2,
          pb: 4
        }}
      >
        {TAB_GROUPS.map((group, index) => {
          const active = activeTab === index;
          return (
            <Box key={group.label}>
              <Box
                component={active ? 'div' : 'button'}
                type={active ? undefined : 'button'}
                onClick={active ? undefined : (event) => handleTabChange(event, index)}
                sx={{
                  position: 'relative',
                  display: 'flex', alignItems: 'center', gap: 1,
                  width: 'calc(100% - 16px)', ml: 2, px: 3,
                  py: active ? 2 : 1,
                  border: 0, borderRadius: '8px 0 0 8px', textAlign: 'left',
                  fontFamily: 'inherit', fontWeight: 400, color: '#000',
                  fontSize: active ? 20 : '13.3333px',
                  cursor: active ? 'default' : 'pointer',
                  backgroundColor: active ? '#fff' : 'transparent',
                  boxShadow: active
                    ? '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)'
                    : 'none',
                  zIndex: active ? 1 : 'auto',
                  '&:hover': active ? {} : { backgroundColor: 'rgba(0,0,0,0.10)' }
                }}
              >
                <group.icon sx={{ fontSize: active ? 22 : 18, color: '#000' }} />
                {group.label}
              </Box>
              {active && (index === 0 || index === 3) && (
                <Box sx={{ ml: 4, mr: 2, my: 0.5 }}>
                  {(index === 0 ? COMPANY_SECTIONS : USER_SECTIONS).map((section) => (
                    <Box
                      key={section.key}
                      component="button"
                      type="button"
                      onClick={() => scrollToSection(section.key)}
                      sx={{
                        display: 'block', width: '100%', textAlign: 'left',
                        p: '4px 8px', border: 0, borderRadius: '4px',
                        fontFamily: 'inherit', fontSize: 16, fontWeight: 400, color: '#0d0d0d',
                        backgroundColor: 'transparent', cursor: 'pointer',
                        '&:hover': { backgroundColor: 'rgba(0,0,0,0.10)' }
                      }}
                    >
                      {section.label}
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Content column: one scrolling column (~756px) except the outlet/register
          LISTS which run full width. */}
      <Box sx={{ flex: 1, maxWidth: isFullWidthList ? 'none' : 820, minWidth: 0, px: 4, pt: 2, pb: 12 }}>
        {/* Same 50px offset as the rail: at top 0 this search bar sat under the fixed app
            bar and the section heading scrolled through the gap, half hidden. */}
        <Box sx={{ position: 'sticky', top: `${APP_BAR_HEIGHT}px`, zIndex: 3, backgroundColor: '#fff', pt: 1, pb: 2 }}>
          <Autocomplete
            options={searchOptions}
            groupBy={(option) => option.tab}
            getOptionLabel={(option) => option.label || ''}
            isOptionEqualToValue={(option, value) =>
              option.label === value.label && option.tab === value.tab}
            value={null}
            blurOnSelect
            clearOnBlur
            onChange={(event, option) => handleSearchSelect(option)}
            noOptionsText="No matching settings"
            componentsProps={{
              paper: {
                ...SETTING_LISTBOX_PROPS.paper,
                sx: {
                  ...SETTING_LISTBOX_PROPS.paper.sx,
                  '&& .MuiListSubheader-root': { fontWeight: 700, color: '#000', lineHeight: '32px' }
                }
              }
            }}
            sx={{ maxWidth: 756, mb: 2 }}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Search Settings..."
                size="small"
                sx={SETTING_FIELD_SX}
              />
            )}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Box>
              <Typography component="h1" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '32px', fontWeight: 700, color: '#000' }}>
                {React.createElement(TAB_GROUPS[activeTab].icon, { sx: { fontSize: 32 } })}
                {TAB_GROUPS[activeTab].label}
              </Typography>
              {activeTab !== 0 && (
                <Typography sx={{ fontSize: '14px', color: '#676b72' }}>
                  Local settings (not in Shopfront)
                </Typography>
              )}
            </Box>
            {activeTab === 3 && (
              <Autocomplete
                multiple
                disableCloseOnSelect
                options={selectedFirst(users.map(u => u.name), selectedUsers)}
                value={selectedUsers}
                loading={loadingUsers}
                onChange={(event, value) => setSelectedUsers(value)}
                componentsProps={SETTING_LISTBOX_PROPS}
                sx={{ width: 320, flexShrink: 0 }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    placeholder={selectedUsers.length ? '' : 'Select Users to edit...'}
                    sx={USER_FIELD_SX}
                  />
                )}
              />
            )}
          </Box>
        </Box>

        {/* Tab Content */}
        {activeTab === 0 && renderCompanyTab()}
        {activeTab === 1 && renderOutletsTab()}
        {activeTab === 2 && renderRegistersTab()}
        {activeTab === 3 && renderUsersTab()}

        {/* Success Snackbar */}
        <Snackbar
          open={showSuccess}
          autoHideDuration={3000}
          onClose={() => setShowSuccess(false)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert severity="success" onClose={() => setShowSuccess(false)}>
            Settings saved successfully!
          </Alert>
        </Snackbar>

        {/* Edit Predefined Reasons slide-over - one panel serves all four
            reason-list fields (blob lists mark the company store dirty,
            cash in/out lists PUT immediately) */}
        <EditReasonsSlideOver
          open={!!reasonsEditor}
          noun={reasonsEditor ? REASON_LIST_FIELDS[reasonsEditor].noun : ''}
          reasons={reasonsEditor ? reasonListFor(reasonsEditor) : []}
          onCancel={() => setReasonsEditor(null)}
          onUpdate={handleReasonsUpdate}
        />

        {/* Error Snackbar - the page scrolls, so an inline alert alone is
            missable and a failed save looked silent. */}
        <Snackbar
          open={!!error}
          autoHideDuration={8000}
          onClose={() => setError('')}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert severity="error" onClose={() => setError('')}>
            {error}
          </Alert>
        </Snackbar>

        {/* Single floating Save - persists every dirty store, always enabled */}
        <Box sx={{ position: 'fixed', bottom: '16px', right: '32px', zIndex: 1200 }}>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={loading}
            sx={{
              bgcolor: 'rgb(94,187,235)', color: '#fff', height: 42, padding: '8px 32px',
              borderRadius: '12px', fontSize: 16, fontWeight: 700, letterSpacing: '0.025em',
              textTransform: 'none', boxShadow: 'none',
              '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' }
            }}
          >
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </Box>

        {/* Confirm Leaving - raised when navigating away with unsaved changes */}
        <Dialog open={leaveOpen} onClose={() => setLeaveOpen(false)}>
          <DialogTitle sx={{ backgroundColor: '#fdecea', color: '#d32f2f', fontWeight: 700 }}>
            Confirm Leaving
          </DialogTitle>
          <DialogContent sx={{ pt: '16px !important' }}>
            <Typography>You have unsaved changes, are you sure you wish to leave?</Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setLeaveOpen(false)}
              sx={{
                backgroundColor: '#dedede', color: '#000', fontWeight: 700,
                textTransform: 'none', '&:hover': { backgroundColor: '#cfcfcf' }
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setLeaveOpen(false);
                setDirty({});
                pendingLeaveRef.current?.();
                pendingLeaveRef.current = null;
              }}
              sx={{
                backgroundColor: '#e5484d', color: '#fff', fontWeight: 700,
                textTransform: 'none', '&:hover': { backgroundColor: '#d32f2f' }
              }}
            >
              Leave
            </Button>
          </DialogActions>
        </Dialog>

        {/* More Info slide-over (moreDescription content is supplied by the
            section field definitions) */}
        <SettingsSlideOver
          open={!!slideOverField}
          title={slideOverField?.label || ''}
          onClose={() => setSlideOverField(null)}
        >
          {renderRichText(slideOverField?.moreDescription)}
        </SettingsSlideOver>
      </Box>
    </Box>
  );
};

export default GeneralSettings;
