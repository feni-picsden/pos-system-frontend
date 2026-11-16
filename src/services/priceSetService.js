import apiClient from './apiClient';

// Price Sets — named alternative price schedules (Settings > Price Sets).
// A product price row with priceSetId null belongs to the Default Price Set.
export const priceSetService = {
  async getPriceSets() {
    const response = await apiClient.get('/price-sets', { noCache: true });
    return response.data;
  },

  // The set's View page data: every price row (product, category, ex/inc tax)
  // plus the per-product deletion-guard list.
  async getPriceSetProducts(id) {
    const response = await apiClient.get(`/price-sets/${id}/products`, { noCache: true });
    return response.data;
  },

  // { name, inheritFromId: null (Default Price) | setId }
  async createPriceSet(data) {
    const response = await apiClient.post('/price-sets', data);
    return response.data;
  },

  async updatePriceSet(id, data) {
    const response = await apiClient.put(`/price-sets/${id}`, data);
    return response.data;
  },

  // A copy of the set (all its prices) under a new name.
  async clonePriceSet(id, name) {
    const response = await apiClient.post(`/price-sets/${id}/clone`, { name });
    return response.data;
  },

  async deletePriceSet(id) {
    const response = await apiClient.delete(`/price-sets/${id}`);
    return response.data;
  },
};

export default priceSetService;
