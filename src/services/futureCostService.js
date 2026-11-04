import apiClient from './apiClient';

const joinIds = (v) => (Array.isArray(v) ? v.filter((x) => x !== '' && x != null).join(',') : v ?? '');

const futureCostService = {
  // Get all future costs with optional filters
  getFutureCosts: async (filters = {}) => {
    const params = new URLSearchParams();

    if (filters.category) params.append('category', joinIds(filters.category));
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.isApplied !== undefined) params.append('isApplied', filters.isApplied);
    if (filters.productId) params.append('productId', filters.productId);
    // Outlet filter: outlet id(s), or 'global' for the Global Cost rows only.
    // Absent under a navbar outlet, apiClient injects that outlet itself.
    if (filters.outletId) params.append('outletId', joinIds(filters.outletId));

    const response = await apiClient.get(`/future-costs?${params.toString()}`, { noCache: true });
    return response.data;
  },

  // Get a specific future cost by ID
  getFutureCost: async (id) => {
    const response = await apiClient.get(`/future-costs/${id}`);
    return response.data;
  },

  // Create a new future cost
  createFutureCost: async (data) => {
    const response = await apiClient.post('/future-costs', data);
    return response.data;
  },

  // Update a future cost
  updateFutureCost: async (id, data) => {
    const response = await apiClient.put(`/future-costs/${id}`, data);
    return response.data;
  },

  // Delete a future cost
  deleteFutureCost: async (id) => {
    const response = await apiClient.delete(`/future-costs/${id}`);
    return response.data;
  },

  // Delete multiple future costs
  deleteMultipleFutureCosts: async (ids) => {
    const response = await apiClient.post('/future-costs/delete-multiple', { ids });
    return response.data;
  },

  // Apply a future cost
  applyFutureCost: async (id) => {
    const response = await apiClient.post(`/future-costs/${id}/apply`);
    return response.data;
  },

  // Apply multiple future costs
  applyMultipleFutureCosts: async (ids) => {
    const response = await apiClient.post('/future-costs/apply-multiple', { ids });
    return response.data;
  },

  // Auto-apply future costs (for cron job)
  autoApplyFutureCosts: async () => {
    const response = await apiClient.post('/future-costs/auto-apply');
    return response.data;
  }
};

export default futureCostService;
