import apiClient from './apiClient';
import { appTimeZone } from '../utils/appDateTime';

const browserTimeZone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
};

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
      if (filters.registerId) params.append('registerId', filters.registerId);
      // Presets (Today, This Week…) are the browser's days, not the server's (UTC on Vercel).
      params.append('timeZone', browserTimeZone());
      // Precision columns (hour / day / week…) read Setup > General > Timezone, like
      // every other time the app shows (reference: "all times should be shown in").
      params.append('displayTimeZone', appTimeZone());
      // Search-bar chips: [{ type, id, name, mode: 'include' | 'exclude' }]
      if (Array.isArray(filters.chips) && filters.chips.length) params.append('filters', JSON.stringify(filters.chips.map((c) => ({ type: c.type, id: c.id, mode: c.mode }))));

      const response = await apiClient.get(`/sales-reports/report?${params.toString()}`, { noCache: true });
      return response.data;
    } catch (error) {
      console.error('Error fetching sales report:', error);
      throw error;
    }
  },

  // Query Editor: the SELECT list of the query decides the result columns.
  // Resolves { success, columns, data, totals } or throws; a 400 carries the parse error.
  async runQuery({ query, dateTime, startDate, endDate, outletId, registerId }) {
    const params = new URLSearchParams({ query });
    if (dateTime) params.append('dateTime', dateTime);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (outletId) params.append('outletId', outletId);
    if (registerId) params.append('registerId', registerId);
    params.append('timeZone', browserTimeZone());
    params.append('displayTimeZone', appTimeZone());
    const response = await apiClient.get(`/sales-reports/query?${params.toString()}`, { noCache: true });
    return response.data;
  },

  // Reference search-bar suggestions (products / promotions / users / … with Active / Deleted).
  async getSearchSuggestions(q, includeDeleted) {
    const params = new URLSearchParams({ q, includeDeleted: includeDeleted ? 'true' : 'false' });
    const response = await apiClient.get(`/sales-reports/search-suggestions?${params.toString()}`, { noCache: true });
    return response.data?.data || [];
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

