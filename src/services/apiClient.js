import axios from 'axios';
import { startLoading, stopLoading } from '../utils/loadingBus';
import { resourcePrefix } from '../utils/resourcePrefix';
import posLocalDb from './posLocalDb';
import clearLocalSession from './clearLocalSession';

/** API resource prefix -> the IndexedDB store that mirrors it. */
const STORE_BY_RESOURCE = {
  '/products': 'products',
  '/customers': 'customers',
  '/customer-groups': 'customerGroups',
  '/outlets': 'outlets',
  '/registers': 'registers',
  '/payment-methods': 'paymentMethods',
  '/tax-rates': 'taxRates',
  '/price-lists': 'priceLists',
  '/promotions': 'promotions',
  '/promotion-categories': 'promotionCategories',
  '/classifications': 'classifications',
  '/suppliers': 'suppliers',
  '/gift-cards': 'giftCards',
  '/customer-display': 'customerDisplays',
  '/receipt-templates': 'receiptTemplates',
  '/shelf-ticket-templates': 'shelfTicketTemplates',
  '/transferees': 'transferees',
  '/users': 'users',
  '/roles': 'roles',
  '/loyalty-programs': 'loyaltyPrograms',
  '/surcharges': 'surcharges',
  '/stocktakes': 'stocktakes',
  '/product-combos': 'combos',
  '/sale-keys': 'saleKeySets',
};

/**
 * Writes to these resources also change data mirrored under another resource,
 * so that one has to be invalidated too. Without this, a write only busts its
 * own prefix and the derived copy stays "fresh" for the whole TTL.
 */
const DERIVED_RESOURCES = {
  // Assigning/moving a customer changes customerGroup.customerCount.
  '/customers': ['/customer-groups'],
  // PUT /roles/:id/permissions changes what /permissions/* reports.
  '/roles': ['/permissions'],
};

function invalidateStoreFor(prefix) {
  const store = STORE_BY_RESOURCE[prefix];
  if (!store) return Promise.resolve();
  return posLocalDb.invalidateStore(store).catch(() => {});
}

/**
 * After any customer mutation, re-pull the FULL roster in the background so the
 * sell-screen Add Customer search (in-memory + IndexedDB) sees the change
 * immediately. Debounced so a CSV import of N rows collapses into one fetch.
 */
let customersRefreshTimer = null;
function scheduleCustomersRefresh() {
  clearTimeout(customersRefreshTimer);
  customersRefreshTimer = setTimeout(() => {
    apiClient
      .get('/customers', { silent: true, skipOutletScope: true, noCache: true })
      .then(async (r) => {
        const items = r.data?.customers || [];
        await posLocalDb.putStoreAll('customers', items);
        posLocalDb.setCustomers(items);
      })
      .catch(() => {});
  }, 400);
}

const apiClient = axios.create({
  // Deployed builds set VITE_API_URL (e.g. http://localhost:5000/api);
  // local dev falls back to the local backend.
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  // ponytail: a stalled socket used to hang forever (Save stuck at "Saving...",
  // and 6 hung requests exhaust the browser's per-host pool, freezing the tab).
  // Fail the request instead so callers hit their catch/finally.
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Origin that serves uploaded files (avatars, media): the API base without /api.
// Never hardcode localhost — deployed builds point at the hosted backend.
export const backendOrigin = () =>
  (apiClient.defaults.baseURL || '').replace(/\/+api\/?$/, '').replace(/\/+$/, '');

/**
 * Decide loading UI for this request:
 * - silent: true          → no loader (background sync, polling, catalog refresh)
 * - showGlobalLoader: true → blocking center overlay (login, heavy saves)
 * - showPageLoader: true  → center overlay (regular page initial load via API)
 * - default: all requests (including GET data loads) = top bar
 */
function resolveLoadingMode(config) {
  if (config.silent === true) return null;
  if (config.showGlobalLoader === true || config.showPageLoader === true) return 'overlay';
  return 'bar';
}

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const isSuperAdmin = user?.isSuperAdmin === true || user?.hasAllPermission === true;
      // skipOutletScope lets a caller opt out of the auto outletId injection
      // (e.g. the buying-period item picker must find products across ALL
      // outlets AND global products, not just the selected outlet).
      if (isSuperAdmin && config.method === 'get' && config.skipOutletScope !== true) {
        const savedOutletId = localStorage.getItem('selectedOutletId');
        if (savedOutletId) {
          config.params = config.params || {};
          if (!config.params.outletId) {
            config.params.outletId = parseInt(savedOutletId, 10);
          }
        }
      }
    } catch (_) {
      /* ignore */
    }

    const mode = resolveLoadingMode(config);
    if (mode) {
      config._loadingMode = mode;
      startLoading(mode);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => {
    if (response.config?._loadingMode) {
      stopLoading(response.config._loadingMode);
    }
    // A successful write makes the cached GETs for that resource stale. Without
    // this, a save followed by a reload inside the 2-minute TTL replays the
    // pre-save list and the change looks like it never persisted.
    const method = response.config?.method;
    if (method && method !== 'get') {
      const prefix = resourcePrefix(response.config.url);
      // The same write also makes the IndexedDB copy of that resource stale.
      // Doing it here means every mutation in the app invalidates its store,
      // instead of each call site having to remember to.
      apiClient.invalidateResource(prefix);
      // Customers: don't just drop the cache — refill it, so the sell search
      // and the list see a just-created/edited customer without a re-sync.
      if (prefix === '/customers') scheduleCustomersRefresh();
      // ponytail: a delete is a soft delete everywhere in this app, so it also
      // adds a row to the trash list — bust that cache too, or the trash refetch
      // right after the delete replays the pre-delete list for the whole TTL.
      if (method === 'delete') apiClient.bustCache('/trashed-items');
    }
    return response;
  },
  (error) => {
    if (error.config?._loadingMode) {
      stopLoading(error.config._loadingMode);
    }

    if (error.response?.status === 401) {
      const errorMessage = error.response?.data?.message || '';
      const errorType = error.response?.data?.error || '';
      const isSessionError =
        errorMessage.includes('invalidated') ||
        errorMessage.includes('expired') ||
        errorMessage.includes('inactivity') ||
        errorType === 'Session expired';

      if (isSessionError && !window.location.pathname.includes('/login')) {
        sessionStorage.setItem(
          'sessionExpired',
          errorMessage || 'Your session has expired. Please login again.'
        );
      }
      // An expired session must leave no more behind than a clean logout does —
      // same teardown, and the redirect waits so the IndexedDB wipe isn't aborted.
      clearLocalSession().finally(() => {
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      });
    }
    return Promise.reject(error);
  }
);

const GET_CACHE_TTL_MS = 2 * 60 * 1000;

const _pendingGets = new Map();
const _getCache = new Map();

function _makeGetKey(url, params) {
  const outletId = localStorage.getItem('selectedOutletId') || '';
  // Identity salt: the backend scopes many GETs by req.user, and login/logout are
  // SPA navigations, so this module-level cache outlives the session it was filled
  // for — without the token in the key, user B reads user A's /registers, /outlets.
  // Appended LAST because bustCache() prefix-matches on the url.
  const auth = (localStorage.getItem('authToken') || '').slice(-16);
  return `${url}::${params ? JSON.stringify(params) : ''}::${outletId}::${auth}`;
}

apiClient.bustCache = (urlPrefix) => {
  for (const key of _getCache.keys()) {
    if (key.startsWith(urlPrefix)) _getCache.delete(key);
  }
  for (const key of _pendingGets.keys()) {
    if (key.startsWith(urlPrefix)) _pendingGets.delete(key);
  }
};

/**
 * Drop every cached copy of a resource (in-memory GET cache + IndexedDB store +
 * derived resources). The response interceptor calls this for ordinary writes;
 * exported for writes whose url doesn't name the resource they change — a trash
 * restore is POST /trashed-items/restore but re-creates a price list, role, ...
 */
apiClient.invalidateResource = (prefix) =>
  Promise.all(
    [prefix, ...(DERIVED_RESOURCES[prefix] || [])].map((p) => {
      apiClient.bustCache(p);
      return invalidateStoreFor(p);
    })
  );

const _origGet = apiClient.get.bind(apiClient);
apiClient.get = function dedupedGet(url, config = {}) {
  if (config.responseType && config.responseType !== 'json') {
    return _origGet(url, config);
  }

  const key = _makeGetKey(url, config.params);

  // Live data (e.g. EFTPOS transaction polling) must never be served from the
  // TTL cache — a cached in_progress row would hide the approved result for the
  // whole TTL window. noCache bypasses read+write; in-flight dedup still applies.
  if (GET_CACHE_TTL_MS > 0 && !config.noCache) {
    const cached = _getCache.get(key);
    if (cached && Date.now() - cached.ts < GET_CACHE_TTL_MS) {
      return Promise.resolve(cached.data);
    }
  }

  if (_pendingGets.has(key)) {
    return _pendingGets.get(key);
  }

  const promise = _origGet(url, config)
    .then((response) => {
      if (!config.noCache) _getCache.set(key, { data: response, ts: Date.now() });
      return response;
    })
    .finally(() => {
      _pendingGets.delete(key);
    });

  _pendingGets.set(key, promise);
  return promise;
};

export default apiClient;
