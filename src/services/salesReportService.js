import apiClient from './apiClient';

const salesReportService = {
  // Get sales report data
  async getSalesReport(filters) {
    try {
      const params = new URLSearchParams();
      
      // If query is provided, send it directly (it will be parsed on backend)
      if (filters.query) {
        params.append('query', filters.query);
        // Also send dateTime if provided (for when query doesn't specify dates)
        if (filters.dateTime) params.append('dateTime', filters.dateTime);
      } else {
        // Otherwise, send individual filter parameters
        if (filters.reportType) params.append('reportType', filters.reportType);
        if (filters.groupBy) params.append('groupBy', filters.groupBy);
        if (filters.dateTime) params.append('dateTime', filters.dateTime);
        if (filters.consolidate) params.append('consolidate', filters.consolidate);
        if (filters.precision) params.append('precision', filters.precision);
        if (filters.searchTerm) params.append('searchTerm', filters.searchTerm);
      }
      
      if (filters.includeDeleted !== undefined) params.append('includeDeleted', filters.includeDeleted.toString());
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.outletId) params.append('outletId', filters.outletId);

      const response = await apiClient.get(`/sales-reports/report?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching sales report:', error);
      throw error;
    }
  },

  // Get filter options for dropdowns
  async getFilterOptions(type) {
    try {
      const response = await apiClient.get(`/sales-reports/filter-options?type=${type}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${type} options:`, error);
      throw error;
    }
  },

  // Export report to CSV
  async exportReport(filters, format = 'csv') {
    try {
      const params = new URLSearchParams();
      
      if (filters.reportType) params.append('reportType', filters.reportType);
      if (filters.groupBy) params.append('groupBy', filters.groupBy);
      if (filters.dateTime) params.append('dateTime', filters.dateTime);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      params.append('format', format);

      const response = await apiClient.get(`/sales-reports/export?${params.toString()}`, {
        responseType: 'blob',
      });

      // Create a download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sales-report-${new Date().toISOString().split('T')[0]}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      return { success: true };
    } catch (error) {
      console.error('Error exporting report:', error);
      throw error;
    }
  },

  // Get Metcash MSC Sales report
  async getMetcashMscReport(filters) {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.outletId) params.append('outletId', filters.outletId);

      const response = await apiClient.get(`/sales-reports/metcash-msc?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching Metcash MSC report:', error);
      throw error;
    }
  },
};

export default salesReportService;

