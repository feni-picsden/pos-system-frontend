import apiClient from './apiClient';
import cachedList from './cachedList';

export const taxRateService = {
  // Served from IndexedDB; the network only runs when the copy is stale.
  async getTaxRates() {
    const taxRates = await cachedList('taxRates', async () => {
      const response = await apiClient.get('/tax-rates');
      return response.data?.taxRates || [];
    });
    return { taxRates };
  },

  async getTaxRatesByOutlet(outletId) {
    const response = await apiClient.get(`/tax-rates?outletId=${outletId}`);
    return response.data;
  },

  async getTaxRate(id) {
    const response = await apiClient.get(`/tax-rates/${id}`);
    return response.data;
  },

  async createTaxRate(taxRateData) {
    const response = await apiClient.post('/tax-rates', taxRateData);
    return response.data;
  },

  async updateTaxRate(id, taxRateData) {
    const response = await apiClient.put(`/tax-rates/${id}`, taxRateData);
    return response.data;
  },

  async deleteTaxRate(id) {
    const response = await apiClient.delete(`/tax-rates/${id}`);
    return response.data;
  },

  async toggleTaxRateStatus(id) {
    const response = await apiClient.patch(`/tax-rates/${id}/toggle-status`);
    return response.data;
  },

  async setTaxRateAsDefault(id) {
    const response = await apiClient.patch(`/tax-rates/${id}/set-default`);
    return response.data;
  },

  async mergeTaxRates(fromTaxRateId, toTaxRateId) {
    const response = await apiClient.post('/tax-rates/merge', {
      fromTaxRateId,
      toTaxRateId,
    });
    return response.data;
  },
};
