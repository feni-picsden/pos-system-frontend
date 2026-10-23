import apiClient from './apiClient';

const actionsReportService = {
  // Actions (Misc) Report rows: { reportType, dateTime, startDate, endDate, searchTerm, includeDeleted, outletId, filters }
  getActionsReport: async (filters = {}) => {
    try {
      const response = await apiClient.get('/actions-reports/report', { params: filters, noCache: true });
      return response.data;
    } catch (error) {
      console.error('Error fetching actions report:', error);
      throw error;
    }
  },
  async getSearchSuggestions(q, includeDeleted) {
    const params = new URLSearchParams({ q, includeDeleted: includeDeleted ? 'true' : 'false' });
    const response = await apiClient.get(`/actions-reports/search-suggestions?${params.toString()}`, { noCache: true });
    return response.data?.data || [];
  },
  // Actions Query Editor: { query, dateTime, startDate, endDate, includeDeleted } → { success, columns, data, totals }
  runQuery: async (params = {}) => {
    const response = await apiClient.get('/actions-reports/query', { params, noCache: true });
    return response.data;
  },
};

export default actionsReportService;
