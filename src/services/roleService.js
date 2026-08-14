import apiClient from './apiClient';
import cachedList from './cachedList';

export const roleService = {
  // Get all roles. Served from IndexedDB; the network only runs when stale.
  async getRoles() {
    const roles = await cachedList('roles', async () => {
      const response = await apiClient.get('/roles');
      return response.data?.roles || [];
    });
    return { roles };
  },

  // Get roles by outlet
  async getRolesByOutlet(outletId) {
    const response = await apiClient.get(`/roles?outletId=${outletId}`);
    return response.data;
  },

  // Get role by ID
  async getRole(id) {
    const response = await apiClient.get(`/roles/${id}`);
    return response.data;
  },

  // Create new role
  async createRole(roleData) {
    const response = await apiClient.post('/roles', roleData);
    return response.data;
  },

  // Update role
  async updateRole(id, roleData) {
    const response = await apiClient.put(`/roles/${id}`, roleData);
    return response.data;
  },

  // Get the full permission catalog, in reference order
  async getAllPermissions() {
    const response = await apiClient.get('/roles/permissions/all');
    return response.data;
  },

  // Get role permissions
  async getRolePermissions(id) {
    const response = await apiClient.get(`/roles/${id}/permissions`);
    return response.data;
  },

  // Update role permissions
  async updateRolePermissions(id, permissions) {
    const response = await apiClient.put(`/roles/${id}/permissions`, { permissions });
    return response.data;
  },

  // Get role revision history
  async getRoleRevisions(id) {
    const response = await apiClient.get(`/roles/${id}/revisions`);
    return response.data;
  },

  // Delete role
  async deleteRole(id) {
    const response = await apiClient.delete(`/roles/${id}`);
    return response.data;
  },

  // Toggle role status
  async toggleRoleStatus(id) {
    const response = await apiClient.patch(`/roles/${id}/toggle-status`);
    return response.data;
  },

  // Clone role
  async cloneRole(id, name) {
    const response = await apiClient.post(`/roles/${id}/clone`, { name });
    return response.data;
  },
};
