import apiClient from './apiClient';

const securityReportService = {
  getStatistics: async (startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const response = await apiClient.get(`/security-reports/statistics?${params.toString()}`);
    return response.data?.data || {};
  },

  getEvents: async (startDate, endDate, eventType = 'all', limit = 1000, offset = 0) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (eventType && eventType !== 'all') params.append('eventType', eventType);
    params.append('limit', limit);
    params.append('offset', offset);
    
    const response = await apiClient.get(`/security-reports/events?${params.toString()}`);
    return response.data;
  },

  getEventDetails: async (id) => {
    const response = await apiClient.get(`/security-reports/events/${id}`);
    return response.data?.data;
  },

  getPatterns: async (startDate, endDate, limit = 1000, offset = 0) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    params.append('limit', limit);
    params.append('offset', offset);
    
    const response = await apiClient.get(`/security-reports/patterns?${params.toString()}`);
    return response.data;
  },

  // Get security pattern details with events
  getPatternDetails: async (id) => {
    const response = await apiClient.get(`/security-reports/patterns/${id}`);
    return response.data?.data;
  },

  // Log a security event from frontend
  logEvent: async (eventType, eventSubType = null, metadata = null, registerId = null) => {
    const response = await apiClient.post('/security-reports/log-event', {
      eventType,
      eventSubType,
      metadata,
      registerId,
    });
    return response.data;
  },
};

export default securityReportService;
