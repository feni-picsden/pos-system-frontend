import apiClient from './apiClient';

const masterDatabaseService = {
  getSuppliers: async (params = {}) => {
    const query = new URLSearchParams();

    if (params.search) query.append('search', params.search);

    const queryString = query.toString();
    const response = await apiClient.get(queryString ? `/master-database/suppliers?${queryString}` : '/master-database/suppliers');
    return response.data;
  },

  upsertSupplier: async (payload) => {
    const response = await apiClient.post('/master-database/suppliers/upsert', payload);
    return response.data;
  },

  getProducts: async (params = {}) => {
    const query = new URLSearchParams();

    if (params.supplierReference) query.append('supplierReference', params.supplierReference);
    if (params.provider) query.append('provider', params.provider);
    if (params.search) query.append('search', params.search);
    if (params.limit) query.append('limit', String(params.limit));

    const queryString = query.toString();
    const response = await apiClient.get(queryString ? `/master-database/products?${queryString}` : '/master-database/products');
    return response.data;
  },

  bulkUpsertProducts: async (payload) => {
    const response = await apiClient.post('/master-database/products/bulk-upsert', payload);
    return response.data;
  },
};

export default masterDatabaseService;
