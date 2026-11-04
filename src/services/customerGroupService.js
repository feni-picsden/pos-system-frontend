import apiClient from './apiClient';
import cachedList from './cachedList';
import posLocalDb from './posLocalDb';

// Any write drops the cached list, or a new / renamed / removed group stays
// missing from the Customer Utilities / Customers dropdowns for up to 5 minutes.
const forget = () => posLocalDb.invalidateStore('customerGroups').catch(() => {});

const fetchCustomerGroups = async (outletId) => {
  const params = outletId ? { outletId } : {};
  const queryParams = new URLSearchParams(params);
  const response = await apiClient.get(`/customer-groups?${queryParams.toString()}`);
  return response.data;
};

const customerGroupService = {
  // Served from IndexedDB; the network only runs when the copy is stale.
  getCustomerGroups: async (outletId = null) => {
    // An explicit outlet (a global admin narrowing to one) bypasses the cache,
    // which holds the navbar scope's list.
    if (outletId) {
      const data = await fetchCustomerGroups(outletId);
      return { customerGroups: data?.customerGroups || [] };
    }
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
    await forget();
    return response.data;
  },

  updateCustomerGroup: async (id, customerGroupData) => {
    const response = await apiClient.put(`/customer-groups/${id}`, customerGroupData);
    await forget();
    return response.data;
  },

  deleteCustomerGroup: async (id) => {
    const response = await apiClient.delete(`/customer-groups/${id}`);
    await forget();
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
