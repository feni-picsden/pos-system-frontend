import posLocalDb from './posLocalDb';
import { syncPosCatalog, extractList } from './posCatalogSync';
import outletService from './outletService';
import registerService from './registerService';
import paymentMethodService from './paymentMethodService';
import { taxRateService } from './taxRateService';
import customerGroupService from './customerGroupService';
import priceListService from './priceListService';
import promotionCategoryService from './promotionCategoryService';
import giftCardService from './giftCardService';
import customerDisplayTemplateService from './customerDisplayTemplateService';
import receiptTemplateService from './receiptTemplateService';
import shelfTicketTemplateService from './shelfTicketTemplateService';
import transfereeService from './transfereeService';
import { userService } from './userService';
import { roleService } from './roleService';
import loyaltyProgramService from './loyaltyProgramService';
import { surchargeService } from './surchargeService';
import stocktakeService from './stocktakeService';
import classificationService from './classificationService';
import promotionService from './promotionService';
import supplierService from './supplierService';

const CATALOG_MAX_AGE_MS = 5 * 60 * 1000;
const AUX_MAX_AGE_MS = 10 * 60 * 1000;
// Lists the sell screen does not need are pulled this long after the essential
// sync, one at a time, so a product search typed right after the screen opens
// is not queued behind 20 background requests (user request 17/11/2026). Pages
// that need one of them sooner fetch it on demand (usePageCache / cachedList
// both fetch when their store is empty), so nothing waits on this timer.
const DEFERRED_DELAY_MS = 10 * 1000;

let syncPromise = null;
let deferredTimer = null;
let deferredPromise = null;

/**
 * Load IndexedDB into memory immediately — no network, no loader.
 * Call as early as possible after login / outlet selection.
 */
export async function warmAppCache(outletId) {
  await posLocalDb.init();
  return posLocalDb.warmFromDb(outletId);
}

async function syncStoreIfStale(storeName, maxAge, fetchFn) {
  const stale = await posLocalDb.isStoreStale(storeName, maxAge);
  if (!stale) return false;
  const items = await fetchFn();
  if (Array.isArray(items) && items.length >= 0) {
    await posLocalDb.putStoreAll(storeName, items);
  }
  return true;
}

/**
 * Every master-data list the UI renders, mapped to the call that refreshes it.
 * Pages read these stores through usePageCache and never block on the network;
 * this table is the single place that keeps them fresh.
 */
const AUX_STORES = [
  ['registers', () => registerService.list()],
  ['promotionCategories', (o) => promotionCategoryService.getPromotionCategories(o, true)
    .then((r) => extractList(r, 'promotionCategories'))],
  // limit: the API pages at 10 by default, which capped the sell screen at the
  // first 10 promotions.
  ['promotions', (o) => promotionService.getPromotions({ outletId: o, limit: 1000 })
    .then((r) => extractList(r, 'promotions'))],
  ['customerDisplays', () => customerDisplayTemplateService.listTemplates()
    .then((r) => extractList(r, 'templates'))],
  ['receiptTemplates', () => receiptTemplateService.getTemplates().then((r) => extractList(r, 'templates'))],
];

// Not used by the sell screen: synced later, one at a time (see DEFERRED_DELAY_MS).
const DEFERRED_AUX_STORES = [
  // showRedeemedExpired is either/or on the API, so cache both halves; the page
  // filters status/outlet locally. (Sell screen tenders gift cards by code via
  // the API, it never reads this store.)
  ['giftCards', () => Promise.all([
    giftCardService.getGiftCards({ showRedeemedExpired: false, limit: 1000 }),
    giftCardService.getGiftCards({ showRedeemedExpired: true, limit: 1000 }),
  ]).then(([active, past]) => Array.from(new Map(
    [...extractList(active, 'giftCards'), ...extractList(past, 'giftCards')].map((c) => [c.id, c])
  ).values()))],
  ['shelfTicketTemplates', () => shelfTicketTemplateService.getTemplates()
    .then((r) => extractList(r, 'templates'))],
  ['transferees', () => transfereeService.getTransferees().then((r) => extractList(r, 'transferees'))],
  ['users', () => userService.getUsers().then((r) => extractList(r, 'users'))],
  ['stocktakes', () => stocktakeService.getStocktakes().then((r) => extractList(r, 'stocktakes'))],
];

/**
 * These services cache themselves through cachedList(), so warming them is just
 * a matter of calling them once — they fill (or revalidate) their own store.
 */
const SELF_CACHING_WARMUPS = [
  () => outletService.getAllOutlets(),
  () => taxRateService.getTaxRates(),
  () => paymentMethodService.getPaymentMethods(),
  (o) => customerGroupService.getCustomerGroups(o),
  () => priceListService.getPriceLists(),
  (o) => loyaltyProgramService.getLoyaltyPrograms({ outletId: o }),
  () => surchargeService.getSurcharges(),
];

const DEFERRED_SELF_CACHING_WARMUPS = [
  () => classificationService.getClassifications(),
  () => supplierService.getSuppliers(),
  () => roleService.getRoles(),
];

// Run tasks with at most `limit` in flight. The server serialises DB work on a
// few connections, so 10 parallel pulls made every other request (a product
// search) wait for all of them.
async function runPool(tasks, limit) {
  const queue = [...tasks];
  const worker = async () => { while (queue.length) await queue.shift()(); };
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, worker));
}

async function syncAuxiliaryStores(outletId) {
  // One failing endpoint must not stop the rest of the sync.
  await runPool([
    ...AUX_STORES.map(([store, fetchFn]) => () =>
      syncStoreIfStale(store, AUX_MAX_AGE_MS, () => fetchFn(outletId)).catch(() => false)
    ),
    ...SELF_CACHING_WARMUPS.map((warm) => () => warm(outletId).catch(() => null)),
  ], 2);
}

// Sequential on purpose: one request in flight keeps the server free for
// whatever the user is doing. A store a page already pulled on demand is
// fresh by now and is skipped by syncStoreIfStale / cachedList.
async function syncDeferredStores(outletId) {
  for (const [store, fetchFn] of DEFERRED_AUX_STORES) {
    await syncStoreIfStale(store, AUX_MAX_AGE_MS, () => fetchFn(outletId)).catch(() => false);
  }
  for (const warm of DEFERRED_SELF_CACHING_WARMUPS) {
    await warm(outletId).catch(() => null);
  }
}

let deferredOutletId = null;
function runDeferredNow() {
  deferredTimer = null;
  deferredPromise = syncDeferredStores(deferredOutletId).finally(() => { deferredPromise = null; });
  return deferredPromise;
}

function scheduleDeferredSync(outletId) {
  deferredOutletId = outletId;
  if (deferredTimer) clearTimeout(deferredTimer);
  deferredTimer = setTimeout(runDeferredNow, DEFERRED_DELAY_MS);
}

/** Diagnostic hook: run any pending deferred sync now and wait for it. */
export async function flushDeferredSync() {
  if (deferredTimer) {
    clearTimeout(deferredTimer);
    await runDeferredNow();
    return;
  }
  if (deferredPromise) await deferredPromise;
}

/**
 * Background sync — all requests are GET/silent (no global loader).
 * Warms memory first so search works offline immediately.
 */
export async function syncAppDataInBackground(outletId, { force = false } = {}) {
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    try {
      await posLocalDb.init();
      await posLocalDb.warmFromDb(outletId);

      const catalogStale =
        force || (await posLocalDb.isStoreStale('products', CATALOG_MAX_AGE_MS));

      if (catalogStale || !posLocalDb.isReady()) {
        await syncPosCatalog(outletId);
        await posLocalDb.warmFromDb(outletId);
      }

      await syncAuxiliaryStores(outletId);
      scheduleDeferredSync(outletId);
    } catch (err) {
      console.warn('[AppDataSync] background sync failed:', err);
    } finally {
      syncPromise = null;
    }
  })();

  return syncPromise;
}

/**
 * Re-pull the promotions store from the API right now (ignores the 10-minute
 * window). The sell screen calls this when its tab regains focus, so a
 * promotion toggled in another tab or by another user is applied without a
 * reload. Silent and best-effort: a failure leaves the current list in place.
 */
export async function refreshPromotionsStore(outletId) {
  try {
    const entry = AUX_STORES.find(([store]) => store === 'promotions');
    const items = await entry[1](outletId);
    if (Array.isArray(items)) await posLocalDb.putStoreAll('promotions', items);
    return true;
  } catch {
    return false;
  }
}

if (typeof window !== 'undefined') window.__flushDeferredSync = flushDeferredSync;

export default { warmAppCache, syncAppDataInBackground, refreshPromotionsStore, flushDeferredSync };
