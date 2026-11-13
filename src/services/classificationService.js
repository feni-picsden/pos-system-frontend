import apiClient from './apiClient';
import cachedList from './cachedList';
import posLocalDb from './posLocalDb';

// Any write drops the cached list, or a new / renamed / removed category stays
// missing from every dropdown for up to five minutes.
const forget = () => posLocalDb.invalidateStore('classifications').catch(() => {});

const classificationService = {
  getClassifications: async (filters = {}) => {
    // The whole set is cached in IndexedDB and narrowed by type locally — that
    // covers every caller except free-text search, which still goes to the API.
    // An explicit outletId (a global admin narrowing to one outlet) bypasses the
    // cache, which holds the navbar scope's list.
    // lite callers skip this cache too: the cached rows carry product counts the
    // caller does not want to pay for on a cold cache.
    if (!filters.search && !filters.categoryFilter && !filters.outletId && !filters.lite) {
      const all = await cachedList('classifications', async () => {
        const response = await apiClient.get('/classifications');
        return response.data?.classifications || [];
      });
      // The server stores types upper-case (BRAND); callers pass 'Brand', 'family',
      // 'TAG'... - an exact compare left Brands / Families empty on Product Utilities.
      const wanted = filters.type ? String(filters.type).toUpperCase() : null;
      return {
        classifications: wanted ? all.filter((c) => String(c.type).toUpperCase() === wanted) : all,
      };
    }

    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.type) params.append('type', filters.type);
    if (filters.categoryFilter) params.append('categoryFilter', filters.categoryFilter);
    if (filters.outletId) params.append('outletId', filters.outletId);
    if (filters.lite) params.append('lite', '1'); // rows only, no per-row product counts

    const response = await apiClient.get(`/classifications?${params.toString()}`);
    return response.data;
  },

  getClassification: async (id) => {
    const response = await apiClient.get(`/classifications/${id}`);
    return response.data;
  },

  createClassification: async (classificationData) => {
    const response = await apiClient.post('/classifications', classificationData);
    await forget();
    return response.data;
  },

  updateClassification: async (id, classificationData) => {
    const response = await apiClient.put(`/classifications/${id}`, classificationData);
    await forget();
    return response.data;
  },

  deleteClassification: async (id) => {
    const response = await apiClient.delete(`/classifications/${id}`);
    await forget();
    return response.data;
  },

  toggleClassificationStatus: async (id) => {
    const response = await apiClient.patch(`/classifications/${id}/toggle`);
    await forget();
    return response.data;
  },

  getClassificationProducts: async (id, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.unassignedOnly) params.append('unassignedOnly', filters.unassignedOnly);
    if (filters.assignedOnly) params.append('assignedOnly', '1'); // members only, slim pricing fields

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
