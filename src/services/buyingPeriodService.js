import apiClient from './apiClient';

const buyingPeriodService = {
  async list(params = {}) {
    const cleanParams = {};
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') cleanParams[k] = v;
    });
    const res = await apiClient.get('/buying-periods', { params: cleanParams });
    return res.data;
  },

  async create(payload) {
    const res = await apiClient.post('/buying-periods', payload);
    return res.data;
  },

  async update(id, payload) {
    const res = await apiClient.put(`/buying-periods/${id}`, payload);
    return res.data;
  },

  async remove(id) {
    const res = await apiClient.delete(`/buying-periods/${id}`);
    return res.data;
  },

  async matchActive({ supplierId, productId, quantity, date }) {
    const params = {
      supplierId: String(supplierId),
      productId: String(productId),
      quantity: String(quantity),
    };
    if (date) params.date = date;
    const res = await apiClient.get('/buying-periods/match/active', { params });
    return res.data;
  },
};

export default buyingPeriodService;

