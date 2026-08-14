import productService from './productService';
import customerService from './customerService';
import promotionService from './promotionService';
import paymentMethodService from './paymentMethodService';
import productComboService from './productComboService';
import { taxRateService } from './taxRateService';
import posLocalDb from './posLocalDb';

export function extractList(response, key) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.[key])) return response[key];
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.[key])) return response.data[key];
  return [];
}

export async function fetchAllProducts(outletId) {
  const all = [];
  const limit = 500;
  let page = 1;
  let total = Infinity;

  while (all.length < total) {
    // Every status is cached — the Products page lists inactive/discontinued rows
    // too. The sell screen's in-memory catalog filters back down to Active.
    const res = await productService.getProducts({
      outletId,
      limit,
      page,
    }, { silent: true });
    const batch = res?.products || [];
    all.push(...batch);
    total = res?.pagination?.total ?? all.length;
    if (batch.length < limit) break;
    page += 1;
    if (page > 50) break;
  }
  return all;
}

// Customers are deliberately UNSCOPED: the sell-screen Add Customer search must
// find every customer (incl. other outlets), matching the reference. The
// backend still scopes non-super-admin users server-side.
async function fetchAllCustomers() {
  const res = await customerService.getCustomers({}, { silent: true, skipOutletScope: true });
  return res?.customers || [];
}

async function fetchPromotions(outletId) {
  try {
    const res = await promotionService.getPromotions({
      outletId,
      isActive: true,
    });
    return extractList(res, 'promotions');
  } catch {
    try {
      const res = await promotionService.getPromotions({ isActive: true });
      return extractList(res, 'promotions');
    } catch {
      return [];
    }
  }
}

async function fetchPaymentMethods() {
  try {
    // Cache every method — the store is shared with the setup page, which lists
    // inactive ones too. The in-memory sell catalog filters back down to active.
    const res = await paymentMethodService.getPaymentMethods();
    return res?.paymentMethods || [];
  } catch {
    return [];
  }
}

async function fetchCombos(outletId) {
  try {
    const res = await productComboService.getProductCombos({ outletId, isActive: true });
    return res?.combos || res?.productCombos || extractList(res, 'combos');
  } catch {
    return [];
  }
}

async function fetchTaxRates() {
  try {
    const res = await taxRateService.getTaxRates();
    return res?.taxRates || [];
  } catch {
    return [];
  }
}

/**
 * One background sync — fills all IndexedDB tables for the sell screen.
 */
export async function syncPosCatalog(outletId) {
  await posLocalDb.init();

  const [products, customers, promotions, paymentMethods, combos, taxRates] =
    await Promise.all([
      fetchAllProducts(outletId),
      fetchAllCustomers(),
      fetchPromotions(outletId),
      fetchPaymentMethods(),
      fetchCombos(outletId),
      fetchTaxRates(),
    ]);

  let categories = [];
  let brands = [];
  let families = [];
  let tags = [];
  let suppliers = [];
  try {
    [categories, brands, families, tags, suppliers] = await Promise.all([
      productService.getCategories(outletId),
      productService.getBrands(outletId),
      productService.getFamilies(outletId),
      productService.getTags(outletId),
      productService.getSuppliers(outletId),
    ]);
  } catch {
    /* optional */
  }

  await posLocalDb.replaceCatalog({
    outletId,
    products,
    customers,
    promotions,
    paymentMethods,
    combos,
    taxRates,
    categories: Array.isArray(categories) ? categories : [],
    brands: Array.isArray(brands) ? brands : [],
    families: Array.isArray(families) ? families : [],
  });

  await Promise.all([
    Array.isArray(tags) && tags.length
      ? posLocalDb.putStoreAll('tags', tags)
      : Promise.resolve(),
    Array.isArray(suppliers) && suppliers.length
      ? posLocalDb.putStoreAll('suppliers', suppliers)
      : Promise.resolve(),
  ]);

  return {
    productCount: products.length,
    customerCount: customers.length,
    promotionCount: promotions.length,
    paymentMethodCount: paymentMethods.length,
    comboCount: combos.length,
  };
}

export default syncPosCatalog;
