import apiClient from './apiClient';

const transferReportService = {
  getTransferReport: async (filters = {}) => {
    try {
      const response = await apiClient.get('/transfer-reports/report', { params: filters });
      return response.data;
    } catch (error) {
      console.error('Error fetching transfer report:', error);
      throw error;
    }
  },
};

export default transferReportService;

