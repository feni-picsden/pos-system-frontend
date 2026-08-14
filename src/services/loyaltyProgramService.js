import apiClient from './apiClient';
import cachedList from './cachedList';

const loyaltyProgramService = {
  // Get all loyalty programs. Served from IndexedDB; the network only runs when
  // the copy is stale.
  getLoyaltyPrograms: async (filters = {}) => {
    const params = new URLSearchParams();

    if (filters.outletId) params.append('outletId', filters.outletId);

    const query = params.toString();
    const loyaltyPrograms = await cachedList('loyaltyPrograms', async () => {
      const response = await apiClient.get(`/loyalty-programs?${query}`);
      return response.data?.loyaltyPrograms || [];
    });
    return { loyaltyPrograms };
  },

  // Get a specific loyalty program by ID
  getLoyaltyProgram: async (id) => {
    const response = await apiClient.get(`/loyalty-programs/${id}`);
    return response.data;
  },

  // Create a new loyalty program
  createLoyaltyProgram: async (data) => {
    const response = await apiClient.post('/loyalty-programs', data);
    return response.data;
  },

  // Update a loyalty program
  updateLoyaltyProgram: async (id, data) => {
    const response = await apiClient.put(`/loyalty-programs/${id}`, data);
    return response.data;
  },

  // Delete a loyalty program
  deleteLoyaltyProgram: async (id) => {
    const response = await apiClient.delete(`/loyalty-programs/${id}`);
    return response.data;
  },

  // Get loyalty assignments
  getAssignments: async (id) => {
    const response = await apiClient.get(`/loyalty-programs/${id}/assignments`);
    return response.data;
  },

  // Assign all brands
  assignBrands: async (id) => {
    const response = await apiClient.post(`/loyalty-programs/${id}/assign-brands`);
    return response.data;
  },

  // Assign all categories
  assignCategories: async (id) => {
    const response = await apiClient.post(`/loyalty-programs/${id}/assign-categories`);
    return response.data;
  },

  // Assign all families
  assignFamilies: async (id) => {
    const response = await apiClient.post(`/loyalty-programs/${id}/assign-families`);
    return response.data;
  },

  // Assign all tags
  assignTags: async (id) => {
    const response = await apiClient.post(`/loyalty-programs/${id}/assign-tags`);
    return response.data;
  },

  // Save loyalty assignments
  saveAssignments: async (id, assignments) => {
    const response = await apiClient.post(`/loyalty-programs/${id}/save-assignments`, { assignments });
    return response.data;
  },

  // Delete an assignment
  deleteAssignment: async (id, assignmentId) => {
    const response = await apiClient.delete(`/loyalty-programs/${id}/assignments/${assignmentId}`);
    return response.data;
  }
};

export default loyaltyProgramService;
