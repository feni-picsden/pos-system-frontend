import apiClient from './apiClient';

const promotionService = {
  // Get all promotions with filters
  getPromotions: async (params = {}) => {
    const queryParams = new URLSearchParams();
    
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        queryParams.append(key, params[key]);
      }
    });

    const response = await apiClient.get(`/promotions?${queryParams.toString()}`);
    return response.data;
  },

  // Get promotion by ID
  getPromotion: async (id) => {
    const response = await apiClient.get(`/promotions/${id}`);
    return response.data;
  },

  // Create new promotion
  createPromotion: async (promotionData) => {
    const response = await apiClient.post('/promotions', promotionData);
    return response.data;
  },

  // Update promotion
  updatePromotion: async (id, promotionData) => {
    const response = await apiClient.put(`/promotions/${id}`, promotionData);
    return response.data;
  },

  // Delete promotion
  deletePromotion: async (id) => {
    const response = await apiClient.delete(`/promotions/${id}`);
    return response.data;
  },

  // Toggle promotion active status
  togglePromotionStatus: async (id, isActive) => {
    const response = await apiClient.patch(`/promotions/${id}/toggle`, { isActive });
    return response.data;
  },

  // Get promotion statistics
  getPromotionStats: async (outletId) => {
    const params = outletId ? { outletId } : {};
    const queryParams = new URLSearchParams(params);
    const response = await apiClient.get(`/promotions/stats/overview?${queryParams.toString()}`);
    return response.data;
  },

  // Search products for promotion items
  searchProducts: async (searchTerm, outletId) => {
    const params = { search: searchTerm };
    if (outletId) params.outletId = outletId;
    
    const queryParams = new URLSearchParams(params);
    const response = await apiClient.get(`/products?${queryParams.toString()}`);
    return response.data;
  },

  // Get customer groups for promotion targeting
  getCustomerGroups: async (outletId) => {
    const params = outletId ? { outletId } : {};
    const queryParams = new URLSearchParams(params);
    const response = await apiClient.get(`/customer-groups?${queryParams.toString()}`);
    return response.data;
  }
};

export default promotionService;
