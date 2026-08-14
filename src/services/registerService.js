import apiClient from './apiClient';

const registerService = {
  list: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.append(k, v);
    });
    const res = await apiClient.get(`/registers?${params.toString()}`);
    return res.data?.registers || [];
  },

  create: async (data) => {
    const res = await apiClient.post('/registers', data);
    return res.data?.register;
  },

  update: async (id, data) => {
    const res = await apiClient.put(`/registers/${id}`, data);
    return res.data?.register;
  },

  remove: async (id) => {
    const res = await apiClient.delete(`/registers/${id}`);
    return res.data;
  },

  lock: async (id) => {
    const res = await apiClient.post(`/registers/${id}/lock`);
    return res.data;
  },

  unlock: async (id) => {
    const res = await apiClient.post(`/registers/${id}/unlock`);
    return res.data;
  },

  forceUnlock: async (id) => {
    const res = await apiClient.post(`/registers/${id}/force-unlock`);
    return res.data;
  },

  takeControl: async (id) => {
    const res = await apiClient.post(`/registers/${id}/take-control`);
    return res.data;
  },

  previewClosure: async (id) => {
    const res = await apiClient.get(`/registers/${id}/closure-preview`);
    return res.data?.preview;
  },

  closeRegister: async (id, data = {}) => {
    const res = await apiClient.post(`/registers/${id}/unlock`, data);
    return res.data;
  }
};

export default registerService;


