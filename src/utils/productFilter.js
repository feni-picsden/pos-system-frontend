// The Products list filters the cached catalog in the browser instead of asking
// the API per keystroke/filter/page. This is the predicate that replaced the
// backend where-clause, kept out of the component so it can be self-checked.

import { normalizeBarcodeCodes, stripHtml } from '../services/posLocalDb.js';

const has = (arr) => Array.isArray(arr) && arr.length > 0;
const idIn = (arr, id) => id != null && arr.some((v) => String(v) === String(id));

/**
 * @param {object} product  raw product row as cached in IndexedDB
 * @param {object} filters  the page's filter state
 * @returns {boolean} true when the product should be listed
 */
export function matchesProductFilters(product, filters = {}) {
  const {
    search = '',
    status = [],
    brand = [],
    category = [],
    family = [],
    tags = [],
    supplier = [],
    type = [],
    retailTaxRate = [],
    purchaseTaxRate = [],
    sellOnShop = ['Ignore'],
  } = filters;

  const q = search.trim().toLowerCase();
  if (q) {
    // Description is rich-text HTML; match its TEXT so tag names never match.
    const text = `${product.name || ''} ${stripHtml(product.description)}`.toLowerCase();
    // A scanned barcode only counts in full: the reference finds the product on the
    // whole code and returns nothing for a partial prefix, so this branch is ===.
    const barcodeHit = () =>
      normalizeBarcodeCodes(product.barcodes).some((code) => code.toLowerCase() === q);
    if (!text.includes(q) && !barcodeHit()) return false;
  }
  if (has(status) && !status.includes(product.status || 'Active')) return false;
  if (has(brand) && !idIn(brand, product.brandId ?? product.brand?.id)) return false;
  if (has(category) && !idIn(category, product.categoryId ?? product.category?.id)) return false;
  if (has(family) && !idIn(family, product.familyId ?? product.family?.id)) return false;
  if (has(tags) && !(product.tags || []).some((t) => idIn(tags, t.tag?.id ?? t.tagId ?? t.id))) {
    return false;
  }
  if (
    has(supplier) &&
    !(product.suppliers || []).some((s) => idIn(supplier, s.supplier?.id ?? s.supplierId ?? s.id))
  ) {
    return false;
  }
  if (has(type) && !type.includes(product.type)) return false;
  if (has(retailTaxRate) && !retailTaxRate.includes(product.retailTaxRate)) return false;
  if (has(purchaseTaxRate) && !purchaseTaxRate.includes(product.purchaseTaxRate)) return false;
  // Tri-state: 'Ignore' means "do not filter". The UI is single-select, but read
  // the first real choice rather than requiring length === 1 so a stray extra
  // value can never silently disable the filter.
  const shop = sellOnShop.find((v) => v !== 'Ignore');
  if (shop && !!product.sellOnShopMyLocal !== (shop === 'enabled')) return false;
  return true;
}

export default matchesProductFilters;
