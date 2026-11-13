import apiClient from '../services/apiClient';

// The reference's internal databases for Page Rule `select` elements
// (art. 360021629152): brands, categories, families, tags, taxRates, suppliers,
// paymentMethods, outlets, registers, priceSets, priceLists, customerGroups —
// plus the ones the default wizard scripts use (promotionCategories, products,
// customers). Each resolves to [{ label, value }] option lists; names are case
// sensitive.

const firstArray = (data) => {
  if (Array.isArray(data)) return data;
  for (const value of Object.values(data || {})) {
    if (Array.isArray(value)) return value;
  }
  return [];
};

const toOptions = (rows) =>
  (rows || [])
    .filter((row) => row && row.id != null)
    .map((row) => ({ label: row.name || `${row.firstName || ''} ${row.lastName || ''}`.trim() || String(row.id), value: String(row.id) }));

const classification = (type) => async () => {
  const res = await apiClient.get('/classifications', { params: { type, lite: 1 } });
  return toOptions(firstArray(res.data));
};

const listing = (path, params) => async () => {
  const res = await apiClient.get(path, params ? { params } : undefined);
  return toOptions(firstArray(res.data));
};

// Raw rows (for findByField) — same endpoints, before the option mapping.
const RAW = {
  brands: async () => firstArray((await apiClient.get('/classifications', { params: { type: 'Brand', lite: 1 } })).data),
  categories: async () => firstArray((await apiClient.get('/classifications', { params: { type: 'Category', lite: 1 } })).data),
  families: async () => firstArray((await apiClient.get('/classifications', { params: { type: 'Family', lite: 1 } })).data),
  tags: async () => firstArray((await apiClient.get('/classifications', { params: { type: 'Tag', lite: 1 } })).data),
  taxRates: async () => firstArray((await apiClient.get('/tax-rates')).data),
  suppliers: async () => firstArray((await apiClient.get('/suppliers')).data),
  paymentMethods: async () => firstArray((await apiClient.get('/payment-methods')).data),
  outlets: async () => firstArray((await apiClient.get('/outlets')).data),
  registers: async () => firstArray((await apiClient.get('/registers')).data),
  priceSets: async () => firstArray((await apiClient.get('/price-sets')).data),
  priceLists: async () => firstArray((await apiClient.get('/price-lists')).data),
  customerGroups: async () => firstArray((await apiClient.get('/customer-groups')).data),
  promotionCategories: async () => firstArray((await apiClient.get('/promotion-categories', { params: { outletId: 'all' } })).data),
  // Big tables: searched, never listed whole.
  // Full rows (the lite shape drops barcodes, which findByField needs).
  products: async (search) => firstArray((await apiClient.get('/products', { params: { search: search || '', limit: 20 } })).data),
  customers: async (search) => firstArray((await apiClient.get('/customers', { params: { search: search || '', limit: 50 }, skipOutletScope: true })).data),
};

const DATABASES = {
  brands: classification('Brand'),
  categories: classification('Category'),
  families: classification('Family'),
  tags: classification('Tag'),
  taxRates: listing('/tax-rates'),
  suppliers: listing('/suppliers'),
  paymentMethods: listing('/payment-methods'),
  outlets: listing('/outlets'),
  registers: listing('/registers'),
  priceSets: listing('/price-sets'),
  priceLists: listing('/price-lists'),
  customerGroups: listing('/customer-groups'),
  promotionCategories: listing('/promotion-categories', { outletId: 'all' }),
  products: async (search) => toOptions(firstArray((await apiClient.get('/products', { params: { search: search || '', limit: 50, lite: 1 } })).data)),
  customers: async (search) => toOptions(await RAW.customers(search)),
};

// Databases whose option list depends on what was typed (3+ characters).
export const SEARCHED_DATABASES = ['products', 'customers'];

export const fetchPageRuleDatabase = async (name, search) => {
  const loader = DATABASES[name];
  if (!loader) throw new Error(`Unknown internal database "${name}"`);
  return loader(search);
};

// ShopfrontAPI.findByField(database, field, value) -> { data: rows }. The rows
// are the API's own records (firstName, lastName, code, name, barcodes...).
export const findByField = async (database, field, value) => {
  const loader = RAW[database];
  if (!loader) throw new Error(`Unknown internal database "${database}"`);
  const wanted = String(value ?? '').trim().toLowerCase();
  if (!wanted) return { data: [] };
  const rows = await loader(wanted);
  const matches = rows.filter((row) => {
    if (field === 'barcode') {
      const codes = Array.isArray(row.barcodes) ? row.barcodes.map((b) => String(b?.code ?? b).toLowerCase()) : [];
      return codes.includes(wanted);
    }
    return String(row?.[field] ?? '').trim().toLowerCase() === wanted;
  });
  return { data: matches };
};

export const PAGE_RULE_DATABASES = Object.keys(DATABASES);
