import apiClient from './apiClient';
import { normalizeCompanySettings } from '../pages/Setup/generalSettingsFields';

// Company blob defaults — also what every consumer sees until the real blob
// loads, AND the initial state of Setup > General. One copy, not three.
export const GENERAL_DEFAULTS = {
  useQuantityRate: false,
  familyPriceDistributionMethod: 'Match Price Points',
  priceRoundingMode: '',
  costCalculationMethod: 'Last Cost',
  profitabilityDisplay: 'Gross Profit Margin',
  useComponentsAndPackages: false,
  productsCanHaveWeight: false,
  useBarocodeTemplates: false,
  sellCases: true,
  crossPromotionCount: true,
  teamMessage: '',
  hoursUntilPriceChanges: 0,
  singleText: 'Item',
  caseText: 'Case',
  signInType: 'Select user',
  maskUsername: false,
  requirePassword: true,
  autoLogoutTime: 0,
  autoLogoutDuringSale: false,
  productSearchLevel: 'full',
  searchCacheSaveLocation: 'indexeddb',
  metacashHostFileIntegration: true,
  defaultSaleKeys: 'Home Keys',
  defaultSaleKeysId: null,
  saleKeysPosition: 'left',
  getNotificationOnProductCreation: false,
  globalStatementReplyToEmail: 'rossmoretopdrops@outlook.com',
  showAverageCostOnPriceEditor: false,
  debugLoggingLevel: 'normal',
  showProductDetailsOnAdd: false,
  displayCustomerDetailsOnAdd: false,
  preventBlurOnFocusLoss: true,
  keepSelectProductPopupOpen: false,
  makeSelectProductPopupPaginated: false,
  discountsRequireReason: false,
  refundsRequireReason: false,
  requireReasonForCashDrawer: false,
  allowCashOutWithoutSale: true,
  requireNoteOnParkedSale: false,
  invoiceNumberLength: 8,
  shareParkedSalesBetweenOutlets: true,
  shareGiftCardsBetweenOutlets: true,
  timezone: 'Australia/Sydney',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: 'HH:mm:ss',
  startOfWeek: 'monday',
  roundTo: 0.05,
  currencyCode: 'AUD',
  numberLocale: '',
  customerSearchLevel: 'full',
  setPricesBasedOn: 'Cost Calculation Method',
  defaultNewUsersReportingAccessAllOutlets: true,
  activatePricesAfterPrinting: false,
  requirePasswordFirstLogin: false,
  generalAutoLogoutTime: 7200,
  predefinedDiscountReasons: [],
  predefinedCashDrawerReasons: []
};

// One shared copy of the company blob for every consumer OUTSIDE the settings
// page (currency, dates, auto logout, sell-screen gates). The first sync read
// kicks off the fetch and returns defaults; Setup > General refreshes it on save.
let generalCache = null;
let generalPromise = null;

const loadGeneralCache = () => {
  if (!generalPromise) {
    generalPromise = settingsService
      .getGeneralSettings()
      .then((res) => {
        generalCache = { ...GENERAL_DEFAULTS, ...(res?.settings || {}) };
        return generalCache;
      })
      .catch(() => {
        generalPromise = null; // let the next reader retry
        return GENERAL_DEFAULTS;
      });
  }
  return generalPromise;
};

const settingsService = {
  getSetting: async (key) => {
    const response = await apiClient.get(`/settings/${key}`);
    return response.data;
  },

  updateSetting: async (key, value, category = 'general', description = '') => {
    const response = await apiClient.put(`/settings/${key}`, {
      value,
      category,
      description
    });
    return response.data;
  },

  getGeneralSettings: async () => {
    try {
      const response = await apiClient.get('/settings/general');
      // Normalise here, not at render: this is the one door both the settings
      // page and the shared cache come through.
      const { settings, ...rest } = response.data || {};
      return { ...rest, settings: normalizeCompanySettings(settings) };
    } catch (error) {
      // fromFallback lets the page warn "showing defaults - backend unreachable".
      return { fromFallback: true, settings: { ...GENERAL_DEFAULTS } };
    }
  },

  // Sync read of the cached company blob (defaults until the fetch resolves).
  getCachedGeneralSettings: () => {
    if (!generalCache) loadGeneralCache();
    return generalCache || GENERAL_DEFAULTS;
  },

  // Awaitable warm-up; safe to call repeatedly (one request).
  loadCachedGeneralSettings: () => loadGeneralCache(),

  // Called after a save so consumers stop serving the stale blob.
  refreshGeneralSettingsCache: () => {
    generalCache = null;
    generalPromise = null;
    return loadGeneralCache();
  },

  // "Invoice number length": the counter stays an integer, only the display is
  // zero-padded.
  padInvoice: (n) => {
    const num = Number(n);
    if (!Number.isFinite(num) || num <= 0) return '';
    const len = Number(settingsService.getCachedGeneralSettings().invoiceNumberLength) || 0;
    return String(num).padStart(len, '0');
  },


  updateGeneralSettings: async (settings) => {
    const response = await apiClient.put('/settings/general', { settings });
    return response.data;
  },

  getDefaultSaleKeySet: async () => {
    try {
      const settings = await settingsService.getGeneralSettings();
      return {
        name: settings.settings.defaultSaleKeys || 'Home Keys',
        id: settings.settings.defaultSaleKeysId || null
      };
    } catch (error) {
      console.error('Error getting default sale key set:', error);
      return { name: 'Home Keys', id: null };
    }
  },

  setDefaultSaleKeySet: async (saleKeySetId, saleKeySetName) => {
    try {
      const currentSettings = await settingsService.getGeneralSettings();
      const updatedSettings = {
        ...currentSettings.settings,
        defaultSaleKeys: saleKeySetName,
        defaultSaleKeysId: saleKeySetId
      };
      
      return await settingsService.updateGeneralSettings(updatedSettings);
    } catch (error) {
      console.error('Error setting default sale key set:', error);
      throw error;
    }
  },

  getCashDrawerReasons: async (type) => {
    try {
      const response = await apiClient.get(`/settings/cash-drawer-reasons/${type}`);
      return response.data;
    } catch (error) {
      const defaultReasons = type === 'take_out'
        ? ['Bank deposit', 'Petty cash', 'Till variance', 'Other']
        : ['Change fund', 'Till variance', 'Bank error', 'Other'];

      return { success: true, fromFallback: true, reasons: defaultReasons };
    }
  },

  updateCashDrawerReasons: async (type, reasons) => {
    const response = await apiClient.put(`/settings/cash-drawer-reasons/${type}`, { reasons });
    return response.data;
  },

  // Register settings are per register. Consumers outside Setup want the
  // register the operator is signed on to, which is the one localStorage holds.
  getRegisterSettings: async (registerId = localStorage.getItem('selectedRegisterId')) => {
    try {
      const response = await apiClient.get('/settings/register', {
        params: registerId ? { registerId } : undefined
      });
      return response.data;
    } catch (error) {
      return {
        fromFallback: true,
        settings: {
          safeDropAlertAmount: 0,
          defaultReceiptTemplate: 'Receipt',
          loginAfterSale: false,
          neverOpenCashDrawer: false,
          printReceiptOnRefund: true,
          useTyroIntegratedReceipts: true,
          consolidateProducts: true,
          allowTrainingModeToggle: false,
          requireNoteOnRegisterClosureWithDiscrepancy: false,
          runPromotionCalculationInDedicatedThread: false,
          offlineInvoiceSuffix: 'A',
          invoiceNumberMode: 'Incremental',
          invoiceMaxNumber: 99999999
        }
      };
    }
  },

  updateRegisterSettings: async (settings, registerId) => {
    const response = await apiClient.put('/settings/register', { settings }, {
      params: registerId ? { registerId } : undefined
    });
    return response.data;
  },

  getUserSettings: async (userId) => {
    try {
      const response = await apiClient.get(`/settings/user/${userId}`);
      return response.data;
    } catch (error) {
      return {
        fromFallback: true,
        settings: {
          saleKeys: 'Default',
          saleKeysPosition: ''
        }
      };
    }
  },

  updateUserSettings: async (userId, settings) => {
    const response = await apiClient.put(`/settings/user/${userId}`, { settings });
    return response.data;
  },

  // Outlet settings are per outlet - without the id the API falls back to the
  // caller's own outlet, which made the Outlets tab selector cosmetic.
  getOutletSettings: async (outletId) => {
    try {
      const response = await apiClient.get('/settings/outlet', {
        params: outletId ? { outletId } : undefined
      });
      return response.data;
    } catch (error) {
      return {
        fromFallback: true,
        settings: {
          emailReceiptTemplate: 'Email Receipt',
          outletEmail: '',
          enableGiftCards: true,
          defaultExpiryAmount: 3,
          defaultExpiryPeriod: 'Years',
          canManuallyAdjustExpiry: true,
          updateLastCostWhenReceivingTransfers: true,
          b2bAccount: '',
          b2bPassword: '',
          customerId: 0,
          state: '',
          pillar: '',
          importPromotions: false,
          importBuyingPeriods: false,
          discountingBelowCostBehaviour: 'Allow'
        }
      };
    }
  },

  updateOutletSettings: async (settings, outletId) => {
    const response = await apiClient.put('/settings/outlet', { settings }, {
      params: outletId ? { outletId } : undefined
    });
    return response.data;
  }
};

export default settingsService;
