import apiClient from './apiClient';

export const userService = {
  // Get all users. Pass { noCache: true } when the answer must not come from the
  // 2-minute GET cache (e.g. before seeding an edit form that saves back what it reads).
  async getUsers(config = {}) {
    const response = await apiClient.get('/users', config);
    return response.data;
  },

  // Get user by ID
  async getUser(id) {
    const response = await apiClient.get(`/users/${id}`);
    return response.data;
  },

  // Create new user
  async createUser(userData) {
    const response = await apiClient.post('/users', userData);
    apiClient.bustCache('/users');
    return response.data;
  },

  // Update user
  async updateUser(id, userData) {
    const response = await apiClient.put(`/users/${id}`, userData);
    apiClient.bustCache('/users');
    return response.data;
  },

  // Delete user
  async deleteUser(id) {
    const response = await apiClient.delete(`/users/${id}`);
    apiClient.bustCache('/users');
    return response.data;
  },

  // Toggle user status
  async toggleUserStatus(id) {
    const response = await apiClient.patch(`/users/${id}/toggle-status`);
    apiClient.bustCache('/users');
    return response.data;
  },
};
