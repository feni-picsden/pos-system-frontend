import apiClient from './apiClient';
import cachedList from './cachedList';

const OUTLETS_BASE_URL = '/outlets';

export const outletService = {
  // Get all outlets (superadmin only). Served from IndexedDB — every caller gets
  // the list without waiting on the network.
  getAllOutlets: async () => {
    const outlets = await cachedList('outlets', async () => {
      const response = await apiClient.get(OUTLETS_BASE_URL);
      return response.data?.outlets || [];
    });
    return { outlets };
  },

  // Get outlet by ID (superadmin only)
  getOutletById: async (id) => {
    const response = await apiClient.get(`${OUTLETS_BASE_URL}/${id}`);
    return response.data;
  },

  // Create new outlet (superadmin only)
  createOutlet: async (outletData) => {
    const response = await apiClient.post(OUTLETS_BASE_URL, outletData);
    return response.data;
  },

  // Update outlet (superadmin only)
  updateOutlet: async (id, outletData) => {
    const response = await apiClient.put(`${OUTLETS_BASE_URL}/${id}`, outletData);
    return response.data;
  },

  // Delete outlet (superadmin only)
  deleteOutlet: async (id) => {
    const response = await apiClient.delete(`${OUTLETS_BASE_URL}/${id}`);
    return response.data;
  },

  // Get outlet users (superadmin only)
  getOutletUsers: async (id) => {
    const response = await apiClient.get(`${OUTLETS_BASE_URL}/${id}/users`);
    return response.data;
  },

  // Get outlet roles (superadmin only)
  getOutletRoles: async (id) => {
    const response = await apiClient.get(`${OUTLETS_BASE_URL}/${id}/roles`);
    return response.data;
  },

  // Get current user's outlet details
  getCurrentOutlet: async () => {
    const response = await apiClient.get('/auth/profile');
    return response.data;
  },

  // Update current user's outlet details
  updateCurrentOutlet: async (outletData) => {
    const response = await apiClient.get('/auth/profile');
    const user = response.data.user;
    
    if (!user.outletId) {
      throw new Error('No outlet associated with current user');
    }
    
    const updateResponse = await apiClient.put(`${OUTLETS_BASE_URL}/${user.outletId}`, outletData);
    return updateResponse.data;
  },

  // Get current user's outlet location data (for geofencing)
  getMyOutletLocation: async () => {
    const response = await apiClient.get(`${OUTLETS_BASE_URL}/my-outlet/location`);
    return response.data;
  }
};

export default outletService;
