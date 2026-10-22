import apiClient from './apiClient';

const purchaseReportService = {
  // Purchase Report rows: { reportType, groupBy, consolidate, precision, metric, dateTime, startDate, endDate, searchTerm, includeDeleted, outletId, filters }
  getPurchaseReport: async (filters = {}) => {
    try {
      const response = await apiClient.get('/purchase-reports/report', { params: filters });
      return response.data;
    } catch (error) {
      console.error('Error fetching purchase report:', error);
      throw error;
    }
  },
  async getSearchSuggestions(q, includeDeleted) {
    const params = new URLSearchParams({ q, includeDeleted: includeDeleted ? 'true' : 'false' });
    const response = await apiClient.get(`/purchase-reports/search-suggestions?${params.toString()}`, { noCache: true });
    return response.data?.data || [];
  },
  // Purchase Query Editor: { query, dateTime, startDate, endDate, includeDeleted } → { success, columns, data, totals }
  runQuery: async (params = {}) => {
    const response = await apiClient.get('/purchase-reports/query', { params });
    return response.data;
  },
};

export default purchaseReportService;
