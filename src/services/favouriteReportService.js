import apiClient from './apiClient';

const favouriteReportService = {
  getAll: async (filters = {}) => {
    try {
      const response = await apiClient.get('/favourite-reports', { params: filters });
      return response.data;
    } catch (error) {
      console.error('Error fetching favourite reports:', error);
      throw error;
    }
  },

  getById: async (id) => {
    try {
      const response = await apiClient.get(`/favourite-reports/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching favourite report:', error);
      throw error;
    }
  },

  create: async (reportData) => {
    try {
      const response = await apiClient.post('/favourite-reports', reportData);
      return response.data;
    } catch (error) {
      console.error('Error creating favourite report:', error);
      throw error;
    }
  },

  update: async (id, reportData) => {
    try {
      const response = await apiClient.put(`/favourite-reports/${id}`, reportData);
      return response.data;
    } catch (error) {
      console.error('Error updating favourite report:', error);
      throw error;
    }
  },

  delete: async (id) => {
    try {
      const response = await apiClient.delete(`/favourite-reports/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting favourite report:', error);
      throw error;
    }
  },
};

export default favouriteReportService;

