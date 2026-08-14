import apiClient from './apiClient';

const BASE = '/register-closures';

const registerClosureService = {
  list: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await apiClient.get(`${BASE}${query ? `?${query}` : ''}`);
    return res.data?.closures || [];
  },
  getById: async (id) => {
    const res = await apiClient.get(`${BASE}/${id}`);
    return res.data?.closure;
  },
  getTax: async (id) => {
    const res = await apiClient.get(`${BASE}/${id}/tax`);
    return res.data;
  },
  getPaymentSubtypes: async (id) => {
    const res = await apiClient.get(`${BASE}/${id}/payment-subtypes`);
    return res.data;
  },
  getHourlyStats: async (id) => {
    const res = await apiClient.get(`${BASE}/${id}/hourly-stats`);
    return res.data;
  },
  updateNote: async (id, note) => {
    const res = await apiClient.patch(`${BASE}/${id}/note`, { note });
    return res.data?.closure;
  }
};

export default registerClosureService;

