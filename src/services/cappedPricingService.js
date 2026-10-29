import apiClient from './apiClient';

// Capped Pricing (Stock Management > More): the store's capped / maximum shelf
// prices, kept on the server. The navbar outlet rides along automatically
// (?outletId= on reads, outletId in the body on writes).
export const cappedPricingService = {
  async getCappedPricing() {
    const response = await apiClient.get('/capped-pricing', { noCache: true });
    return response.data;
  },

  // Replaces the imported program for the current outlet scope. Every row is
  // matched to a product server side, so a big file outlasts the 30s default.
  async importCappedPricing({ programName, rows }) {
    const response = await apiClient.post('/capped-pricing/import', { programName, rows }, { timeout: 90000 });
    return response.data;
  },

  async clearImported() {
    const response = await apiClient.delete('/capped-pricing/imported');
    return response.data;
  },
};

export default cappedPricingService;
