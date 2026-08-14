import apiClient from './apiClient';
import cachedList from './cachedList';

const classificationService = {
  getClassifications: async (filters = {}) => {
    // The whole set is cached in IndexedDB and narrowed by type locally — that
    // covers every caller except free-text search, which still goes to the API.
    if (!filters.search && !filters.categoryFilter) {
      const all = await cachedList('classifications', async () => {
        const response = await apiClient.get('/classifications');
        return response.data?.classifications || [];
      });
      return {
        classifications: filters.type ? all.filter((c) => c.type === filters.type) : all,
      };
    }

    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.type) params.append('type', filters.type);
    if (filters.categoryFilter) params.append('categoryFilter', filters.categoryFilter);

    const response = await apiClient.get(`/classifications?${params.toString()}`);
    return response.data;
  },

  getClassification: async (id) => {
    const response = await apiClient.get(`/classifications/${id}`);
    return response.data;
  },

  createClassification: async (classificationData) => {
    const response = await apiClient.post('/classifications', classificationData);
    return response.data;
  },

  updateClassification: async (id, classificationData) => {
    const response = await apiClient.put(`/classifications/${id}`, classificationData);
    return response.data;
  },

  deleteClassification: async (id) => {
    const response = await apiClient.delete(`/classifications/${id}`);
    return response.data;
  },


  toggleClassificationStatus: async (id) => {
    const response = await apiClient.patch(`/classifications/${id}/toggle`);
    return response.data;
  },

  getClassificationProducts: async (id, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.unassignedOnly) params.append('unassignedOnly', filters.unassignedOnly);
    
    const response = await apiClient.get(`/classifications/${id}/products?${params.toString()}`);
    return response.data;
  },

  assignProducts: async (id, productIds, action = 'assign') => {
    const response = await apiClient.post(`/classifications/${id}/assign-products`, {
      productIds,
      action
    });
    return response.data;
  },

  getClassificationPerformance: async (id, period = '12months') => {
    const response = await apiClient.get(`/classifications/${id}/performance?period=${period}`);
    return response.data;
  }
};

export default classificationService;
