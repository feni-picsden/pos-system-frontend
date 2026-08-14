import apiClient from './apiClient';

const emailLogService = {
  // Get all email logs with filtering
  getEmailLogs: async (filters = {}) => {
    try {
      const queryParams = new URLSearchParams();
      
      // Add all filter parameters
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
          queryParams.append(key, filters[key]);
        }
      });

      const response = await apiClient.get(`/email-logs?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching email logs:', error);
      throw error;
    }
  },

  // Get a specific email log by ID
  getEmailLogById: async (id) => {
    try {
      const response = await apiClient.get(`/email-logs/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching email log:', error);
      throw error;
    }
  },

  // Update email log status
  updateEmailLogStatus: async (id, status, openedAt, deliveredAt) => {
    try {
      const response = await apiClient.patch(`/email-logs/${id}/status`, {
        status,
        openedAt,
        deliveredAt
      });
      return response.data;
    } catch (error) {
      console.error('Error updating email log status:', error);
      throw error;
    }
  }
};

export default emailLogService;

