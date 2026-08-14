import apiClient from './apiClient';

const loyaltyService = {
  // Calculate loyalty for cart items
  calculateCartLoyalty: async (items, outletId) => {
    const response = await apiClient.post('/loyalty/calculate', {
      items,
      outletId
    });
    return response.data;
  },

  // Get loyalty rules for a product
  getProductLoyaltyRules: async (productId, outletId) => {
    const response = await apiClient.post('/loyalty/product-rules', {
      productId,
      outletId
    });
    return response.data;
  },

  // Calculate redemption value
  calculateRedemptionValue: async (points, outletId) => {
    const response = await apiClient.post('/loyalty/redemption-value', {
      points,
      outletId
    });
    return response.data;
  },

  // Calculate points needed for redemption amount
  calculatePointsForRedemption: async (amount, outletId) => {
    const response = await apiClient.post('/loyalty/points-for-redemption', {
      amount,
      outletId
    });
    return response.data;
  },

  // Apply redemption to cart
  applyRedemption: async (items, pointsToRedeem, outletId) => {
    const response = await apiClient.post('/loyalty/apply-redemption', {
      items,
      pointsToRedeem,
      outletId
    });
    return response.data;
  },

  // Get customer loyalty info
  getCustomerLoyalty: async (customerId) => {
    const response = await apiClient.get(`/loyalty/customer/${customerId}`);
    return response.data;
  },

  // Update customer loyalty enabled status
  updateCustomerLoyaltyEnabled: async (customerId, enabled) => {
    const response = await apiClient.put(`/loyalty/customer/${customerId}/enabled`, {
      enabled
    });
    return response.data;
  },

  // Get loyalty program
  getLoyaltyProgram: async (outletId) => {
    const response = await apiClient.get('/loyalty/program', {
      params: { outletId }
    });
    return response.data;
  }
};

export default loyaltyService;
