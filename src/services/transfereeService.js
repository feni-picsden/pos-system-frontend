import apiClient from './apiClient';

const transfereeService = {
  getTransferees: async (filters = {}) => {
    const response = await apiClient.get('/transferees', { params: filters });
    return response.data;
  },

  getTransferee: async (id) => {
    const response = await apiClient.get(`/transferees/${id}`);
    return response.data;
  },

  getTransfereeTransfers: async (id) => {
    const response = await apiClient.get(`/transferees/${id}/transfers`);
    return response.data;
  },

  createTransferee: async (payload) => {
    const response = await apiClient.post('/transferees', payload);
    return response.data;
  },

  updateTransferee: async (id, payload) => {
    const response = await apiClient.put(`/transferees/${id}`, payload);
    return response.data;
  },

  deleteTransferee: async (id) => {
    const response = await apiClient.delete(`/transferees/${id}`);
    return response.data;
  },
};

export default transfereeService;

