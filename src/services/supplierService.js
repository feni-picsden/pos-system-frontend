import apiClient from './apiClient';
import cachedList from './cachedList';

const supplierService = {
  async getSuppliers(filters = {}) {
    const params = new URLSearchParams();
    if (filters.outletId !== undefined && filters.outletId !== null && filters.outletId !== '') {
      params.append('outletId', filters.outletId);
    }

    const query = params.toString();
    // The unfiltered list is the one every picker asks for — serve it from
    // IndexedDB. An explicit outlet filter still goes to the API.
    if (!query) {
      const suppliers = await cachedList('suppliers', async () => {
        const response = await apiClient.get('/suppliers');
        return response.data?.suppliers || [];
      });
      return { suppliers };
    }

    const response = await apiClient.get(`/suppliers?${query}`);
    return response.data;
  },

  async getSupplier(id) {
    const response = await apiClient.get(`/suppliers/${id}`);
    return response.data;
  },

  async createSupplier(supplierData) {
    const response = await apiClient.post('/suppliers', supplierData);
    return response.data;
  },

  async updateSupplier(id, supplierData) {
    const response = await apiClient.put(`/suppliers/${id}`, supplierData);
    return response.data;
  },

  async deleteSupplier(id) {
    const response = await apiClient.delete(`/suppliers/${id}`);
    return response.data;
  },

  async toggleSupplierStatus(id) {
    const response = await apiClient.patch(`/suppliers/${id}/toggle-status`);
    return response.data;
  },

  getSupplierProducts: async (id, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.unassignedOnly) params.append('unassignedOnly', filters.unassignedOnly);
    
    const response = await apiClient.get(`/suppliers/${id}/products?${params.toString()}`);
    return response.data;
  },

  assignProducts: async (id, productIds, action = 'assign') => {
    const response = await apiClient.post(`/suppliers/${id}/assign-products`, {
      productIds,
      action
    });
    return response.data;
  },

  getSupplierPerformance: async (id, period = '12months') => {
    const response = await apiClient.get(`/suppliers/${id}/performance?period=${period}`);
    return response.data;
  },

  getSupplierOrders: async (id) => {
    const response = await apiClient.get(`/suppliers/${id}/orders`);
    return response.data;
  },

  importSupplierProducts: async (id, payload) => {
    const response = await apiClient.post(`/suppliers/${id}/import-products`, payload);
    return response.data;
  },
};

export default supplierService;
