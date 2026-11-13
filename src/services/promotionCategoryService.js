import apiClient from './apiClient';

const promotionCategoryService = {
  // Get all promotion categories.
  // outletId 'all' bypasses the apiClient outlet auto-filter (backend ignores non-numeric values).
  async getPromotionCategories(outletId = null, includeInactive = false) {
    const params = {};
    if (outletId) params.outletId = outletId;
    if (includeInactive) params.includeInactive = 'true';
    const response = await apiClient.get('/promotion-categories', { params });
    return response.data;
  },

  // Get promotion categories by outlet
  async getPromotionCategoriesByOutlet(outletId) {
    const response = await apiClient.get(`/promotion-categories?outletId=${outletId}`);
    return response.data;
  },

  // Get promotion category by ID
  async getPromotionCategory(id) {
    const response = await apiClient.get(`/promotion-categories/${id}`);
    return response.data;
  },

  // Create new promotion category
  async createPromotionCategory(promotionCategoryData) {
    const response = await apiClient.post('/promotion-categories', promotionCategoryData);
    apiClient.bustCache('/promotion-categories');
    return response.data;
  },

  // Update promotion category
  // skipOutletScope: an edit keeps the category's own outlet. Without it a global
  // admin working "in Outlet A" had the navbar outlet stamped onto the PUT, which
  // re-homed a GLOBAL category into Outlet A (duplicate name -> 500). The All
  // Outlets picker still changes the outlet because the dialog sends it then.
  async updatePromotionCategory(id, promotionCategoryData) {
    const response = await apiClient.put(`/promotion-categories/${id}`, promotionCategoryData, { skipOutletScope: true });
    apiClient.bustCache('/promotion-categories');
    return response.data;
  },

  // Delete promotion category
  async deletePromotionCategory(id) {
    const response = await apiClient.delete(`/promotion-categories/${id}`);
    apiClient.bustCache('/promotion-categories');
    return response.data;
  },

  // Toggle promotion category status
  async togglePromotionCategoryStatus(id) {
    const response = await apiClient.patch(`/promotion-categories/${id}/toggle-status`);
    apiClient.bustCache('/promotion-categories');
    return response.data;
  },

  // Get available outlets for promotion category assignment
  async getAvailableOutlets() {
    const response = await apiClient.get('/promotion-categories/outlets/available');
    return response.data;
  },
};

export default promotionCategoryService;
