import apiClient from './apiClient';
import cachedList from './cachedList';

const fetchCustomerGroups = async (outletId) => {
  const params = outletId ? { outletId } : {};
  const queryParams = new URLSearchParams(params);
  const response = await apiClient.get(`/customer-groups?${queryParams.toString()}`);
  return response.data;
};

const customerGroupService = {
  // Served from IndexedDB; the network only runs when the copy is stale.
  getCustomerGroups: async (outletId = null) => {
    const customerGroups = await cachedList('customerGroups', async () => {
      const data = await fetchCustomerGroups(outletId);
      return data?.customerGroups || [];
    });
    return { customerGroups };
  },

  getCustomerGroup: async (id) => {
    const response = await apiClient.get(`/customer-groups/${id}`);
    return response.data;
  },

  createCustomerGroup: async (customerGroupData) => {
    const response = await apiClient.post('/customer-groups', customerGroupData);
    return response.data;
  },

  updateCustomerGroup: async (id, customerGroupData) => {
    const response = await apiClient.put(`/customer-groups/${id}`, customerGroupData);
    return response.data;
  },

  deleteCustomerGroup: async (id) => {
    const response = await apiClient.delete(`/customer-groups/${id}`);
    return response.data;
  },

  toggleCustomerGroupStatus: async (id) => {
    const response = await apiClient.patch(`/customer-groups/${id}/toggle-status`);
    return response.data;
  },

  getCustomerGroupRevisions: async (id) => {
    const response = await apiClient.get(`/customer-groups/${id}/revisions`);
    return response.data;
  },
};

export default customerGroupService;
