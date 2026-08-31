import apiClient from '../services/apiClient';

// The reference's 12 internal databases for Page Rule `select` elements
// (art. 360021629152): brands, categories, families, tags, taxRates, suppliers,
// paymentMethods, outlets, registers, priceSets, priceLists, customerGroups.
// Each resolves to [{ label, value }] option lists; names are case sensitive.

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
    .map((row) => ({ label: row.name || String(row.id), value: String(row.id) }));

const classification = (type) => async () => {
  const res = await apiClient.get('/classifications', { params: { type } });
  return toOptions(firstArray(res.data));
};

const listing = (path) => async () => {
  const res = await apiClient.get(path);
  return toOptions(firstArray(res.data));
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
};

export const fetchPageRuleDatabase = async (name) => {
  const loader = DATABASES[name];
  if (!loader) throw new Error(`Unknown internal database "${name}"`);
  return loader();
};

export const PAGE_RULE_DATABASES = Object.keys(DATABASES);
