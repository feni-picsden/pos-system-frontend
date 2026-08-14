import apiClient from './apiClient';

export const permissionService = {
  // Get all available permissions
  async getPermissions() {
    const response = await apiClient.get('/permissions');
    return response.data;
  },

  // Get permissions for a specific role
  async getRolePermissions(roleId) {
    const response = await apiClient.get(`/roles/${roleId}/permissions`);
    return response.data;
  },

  // Update permissions for a role
  async updateRolePermissions(roleId, permissions) {
    const response = await apiClient.put(`/roles/${roleId}/permissions`, { permissions });
    return response.data;
  },

  // Check if current user has specific permission
  async checkPermission(permission) {
    const response = await apiClient.get(`/permissions/check/${permission}`);
    return response.data;
  },

  // Get current user's permissions
  async getCurrentUserPermissions() {
    // noCache: a role's permissions can change mid-session (by an admin in another
    // session), and the 2-minute GET TTL would replay the stale list until a full
    // page reload. This one is always read fresh.
    const response = await apiClient.get('/permissions/me', { silent: true, noCache: true });
    return response.data;
  },
};
