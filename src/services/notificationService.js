import apiClient from './apiClient';

// In-app notifications (bell-icon panel). All endpoints are outlet-scoped server-side.
const notificationService = {
  // Returns { notifications: [...], pendingCount }
  getNotifications: async (params = {}) => {
    const response = await apiClient.get('/notifications', { params, silent: true });
    return response.data;
  },

  getCount: async () => {
    // Polled every minute to ring the bell for unread notifications: a cached count
    // would hide a new one for the whole GET cache TTL.
    const response = await apiClient.get('/notifications/count', { silent: true, noCache: true });
    return response.data;
  },

  markRead: async (id) => {
    const response = await apiClient.patch(`/notifications/${id}/read`);
    apiClient.bustCache('/notifications');
    return response.data;
  },

  markAllRead: async () => {
    const response = await apiClient.patch('/notifications/read-all');
    apiClient.bustCache('/notifications');
    return response.data;
  },

  deleteNotification: async (id) => {
    const response = await apiClient.delete(`/notifications/${id}`);
    apiClient.bustCache('/notifications');
    return response.data;
  },

  // Clears all notifications for the caller's outlet ("Delete All")
  deleteAll: async () => {
    const response = await apiClient.delete('/notifications');
    apiClient.bustCache('/notifications');
    return response.data;
  },
};

export default notificationService;
