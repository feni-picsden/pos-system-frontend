import apiClient from './apiClient';

// Additional Information — store-wide custom product fields
// (Settings > Additional Information). Definitions only; per-product values
// travel on the product itself as `additionalInfo` keyed by safeName.
export const additionalFieldService = {
  async getFields() {
    const response = await apiClient.get('/additional-fields', { noCache: true });
    return response.data;
  },

  async createField(data) {
    const response = await apiClient.post('/additional-fields', data);
    return response.data;
  },

  async updateField(id, data) {
    const response = await apiClient.put(`/additional-fields/${id}`, data);
    return response.data;
  },

  async deleteField(id) {
    const response = await apiClient.delete(`/additional-fields/${id}`);
    return response.data;
  },
};

export default additionalFieldService;
