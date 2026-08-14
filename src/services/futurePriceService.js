import apiClient from './apiClient';

const futurePriceService = {
  // Get all future prices with optional filters
  getFuturePrices: async (filters = {}) => {
    const params = new URLSearchParams();
    
    if (filters.category) params.append('category', filters.category);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.isApplied !== undefined) params.append('isApplied', filters.isApplied);
    if (filters.productId) params.append('productId', filters.productId);
    if (filters.outletId) params.append('outletId', filters.outletId);

    const response = await apiClient.get(`/future-prices?${params.toString()}`);
    return response.data;
  },

  // Get a specific future price by ID
  getFuturePrice: async (id) => {
    const response = await apiClient.get(`/future-prices/${id}`);
    return response.data;
  },

  // Create a new future price
  createFuturePrice: async (data) => {
    const response = await apiClient.post('/future-prices', data);
    return response.data;
  },

  // Update a future price
  updateFuturePrice: async (id, data) => {
    const response = await apiClient.put(`/future-prices/${id}`, data);
    return response.data;
  },

  // Delete a future price
  deleteFuturePrice: async (id) => {
    const response = await apiClient.delete(`/future-prices/${id}`);
    return response.data;
  },

  // Delete multiple future prices
  deleteMultipleFuturePrices: async (ids) => {
    const response = await apiClient.post('/future-prices/delete-multiple', { ids });
    return response.data;
  },

  // Apply a future price
  applyFuturePrice: async (id) => {
    const response = await apiClient.post(`/future-prices/${id}/apply`);
    return response.data;
  },

  // Apply multiple future prices
  applyMultipleFuturePrices: async (ids) => {
    const response = await apiClient.post('/future-prices/apply-multiple', { ids });
    return response.data;
  },

  // Auto-apply future prices (for cron job)
  autoApplyFuturePrices: async () => {
    const response = await apiClient.post('/future-prices/auto-apply');
    return response.data;
  }
};

export default futurePriceService;

