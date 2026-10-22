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
  async getSearchSuggestions(q, includeDeleted) {
    const params = new URLSearchParams({ q, includeDeleted: includeDeleted ? 'true' : 'false' });
    const response = await apiClient.get(`/transfer-reports/search-suggestions?${params.toString()}`, { noCache: true });
    return response.data?.data || [];
  },
  // Transfers Query Editor: { query, dateTime, startDate, endDate, includeDeleted } → { success, columns, data, totals }
  runQuery: async (params = {}) => {
    const response = await apiClient.get('/transfer-reports/query', { params });
    return response.data;
  },
};

export default transferReportService;
