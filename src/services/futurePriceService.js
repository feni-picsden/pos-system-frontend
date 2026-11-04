import apiClient from './apiClient';

// Comma-joins an array / single value filter; '' when empty.
const joinIds = (v) => (Array.isArray(v) ? v.filter((x) => x !== '' && x != null).join(',') : v ?? '');

const futurePriceService = {
  // Get all future prices with optional filters
  getFuturePrices: async (filters = {}) => {
    const params = new URLSearchParams();

    if (filters.category) params.append('category', joinIds(filters.category));
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.isApplied !== undefined) params.append('isApplied', filters.isApplied);
    if (filters.productId) params.append('productId', filters.productId);
    // Outlets filter (All Outlets only): one or several ids
    if (filters.outletId) params.append('outletId', joinIds(filters.outletId));
    // Created By / Price Set (multi): ids; price set 0 = Default Price Set
    const createdBy = joinIds(filters.createdBy);
    if (createdBy) params.append('createdBy', createdBy);
    const priceSetId = joinIds(filters.priceSetId);
    if (priceSetId !== '') params.append('priceSetId', priceSetId);
    if (filters.search) params.append('search', filters.search);

    const response = await apiClient.get(`/future-prices?${params.toString()}`, { noCache: true });
    return response.data;
  },

  // Dropdown data for the page filters (Created By users, Price Sets), outlet-wise
  getFilterOptions: async (outletId) => {
    const params = new URLSearchParams();
    const ids = joinIds(outletId);
    if (ids) params.append('outletId', ids);
    const qs = params.toString();
    const response = await apiClient.get(`/future-prices/filters/options${qs ? `?${qs}` : ''}`, { noCache: true });
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

  // Setup > General > "Activate Prices After Printing": called after shelf
  // tickets print; the server decides (no-op when the setting is off).
  activateForPrintedProducts: async (productIds) => {
    const response = await apiClient.post('/future-prices/activate-printed', { productIds });
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
