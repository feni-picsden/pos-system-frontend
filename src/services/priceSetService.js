import apiClient from './apiClient';

// Price Sets — named alternative price schedules (Settings > Price Sets).
// A product price row with priceSetId null belongs to the Default Price Set.
export const priceSetService = {
  async getPriceSets() {
    const response = await apiClient.get('/price-sets', { noCache: true });
    return response.data;
  },

  // Products still carrying prices in the set — the deletion-guard view.
  async getPriceSetProducts(id) {
    const response = await apiClient.get(`/price-sets/${id}/products`);
    return response.data;
  },

  async createPriceSet(data) {
    const response = await apiClient.post('/price-sets', data);
    return response.data;
  },

  async updatePriceSet(id, data) {
    const response = await apiClient.put(`/price-sets/${id}`, data);
    return response.data;
  },

  async deletePriceSet(id) {
    const response = await apiClient.delete(`/price-sets/${id}`);
    return response.data;
  },
};

export default priceSetService;
