import apiClient from './apiClient';

const customerService = {
  getCustomers: async (params = {}, requestOptions = {}) => {
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.append('search', params.search);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.outletId) queryParams.append('outletId', params.outletId);
    
    const queryString = queryParams.toString();
    const url = `/customers${queryString ? `?${queryString}` : ''}`;
    const response = await apiClient.get(url, requestOptions);
    return response.data;
  },

  getCustomer: async (id) => {
    const response = await apiClient.get(`/customers/${id}`);
    return response.data;
  },

  createCustomer: async (customerData) => {
    const response = await apiClient.post('/customers', customerData);
    return response.data;
  },

  updateCustomer: async (id, customerData) => {
    const response = await apiClient.put(`/customers/${id}`, customerData);
    return response.data;
  },

  deleteCustomer: async (id) => {
    const response = await apiClient.delete(`/customers/${id}`);
    return response.data;
  },

  toggleCustomerStatus: async (id) => {
    const response = await apiClient.patch(`/customers/${id}/toggle-status`);
    return response.data;
  },

  getCustomerSales: async (id, limit = 10) => {
    const response = await apiClient.get(`/customers/${id}/sales?limit=${limit}`);
    return response.data;
  },

  getCustomerRevisions: async (id) => {
    const response = await apiClient.get(`/customers/${id}/revisions`);
    return response.data;
  },

  getCustomerStatement: async (id, startDate, endDate) => {
    const params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const response = await apiClient.get(`/customers/${id}/statement`, { params });
    return response.data;
  },

  getCustomerPerformance: async (id) => {
    const response = await apiClient.get(`/customers/${id}/performance`);
    return response.data;
  },

  getCustomerOutstandingSales: async (id) => {
    const response = await apiClient.get(`/customers/${id}/outstanding-sales`);
    return response.data;
  },

  getCustomerPayments: async (id) => {
    // noCache for the same reason as the outstanding invoices read: this list is
    // re-fetched immediately after a payment is written.
    const response = await apiClient.get(`/customers/${id}/payments`, { noCache: true });
    return response.data;
  },

  mergeCustomers: async (mergeData) => {
    const response = await apiClient.post('/customers/merge', mergeData);
    return response.data;
  },
};

export default customerService;
