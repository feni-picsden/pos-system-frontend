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

let syncPromise = null;

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
  ['promotions', (o) => promotionService.getPromotions({ outletId: o })
    .then((r) => extractList(r, 'promotions'))],
  // showRedeemedExpired is either/or on the API, so cache both halves; the page
  // filters status/outlet locally.
  ['giftCards', () => Promise.all([
    giftCardService.getGiftCards({ showRedeemedExpired: false, limit: 1000 }),
    giftCardService.getGiftCards({ showRedeemedExpired: true, limit: 1000 }),
  ]).then(([active, past]) => Array.from(new Map(
    [...extractList(active, 'giftCards'), ...extractList(past, 'giftCards')].map((c) => [c.id, c])
  ).values()))],
  ['customerDisplays', () => customerDisplayTemplateService.listTemplates()
    .then((r) => extractList(r, 'templates'))],
  ['receiptTemplates', () => receiptTemplateService.getTemplates().then((r) => extractList(r, 'templates'))],
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
  () => classificationService.getClassifications(),
  () => supplierService.getSuppliers(),
  () => roleService.getRoles(),
  (o) => loyaltyProgramService.getLoyaltyPrograms({ outletId: o }),
  () => surchargeService.getSurcharges(),
];

async function syncAuxiliaryStores(outletId) {
  // One failing endpoint must not stop the rest of the sync.
  await Promise.all([
    ...AUX_STORES.map(([store, fetchFn]) =>
      syncStoreIfStale(store, AUX_MAX_AGE_MS, () => fetchFn(outletId)).catch(() => false)
    ),
    ...SELF_CACHING_WARMUPS.map((warm) => warm(outletId).catch(() => null)),
  ]);
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
    } catch (err) {
      console.warn('[AppDataSync] background sync failed:', err);
    } finally {
      syncPromise = null;
    }
  })();

  return syncPromise;
}

export default { warmAppCache, syncAppDataInBackground };
