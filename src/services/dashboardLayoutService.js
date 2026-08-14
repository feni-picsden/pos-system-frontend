import apiClient from './apiClient';

const dashboardLayoutService = {
  async getLayout(filters = {}) {
    try {
      const response = await apiClient.get('/dashboard-layout', { params: filters });
      return response.data;
    } catch (error) {
      console.error('Error loading dashboard layout:', error);
      throw error;
    }
  },

  async saveLayout(payload = {}) {
    try {
      const response = await apiClient.put('/dashboard-layout', payload);
      if (typeof apiClient.bustCache === 'function') {
        apiClient.bustCache('/dashboard-layout');
      }
      return response.data;
    } catch (error) {
      console.error('Error saving dashboard layout:', error);
      throw error;
    }
  },
};

export default dashboardLayoutService;