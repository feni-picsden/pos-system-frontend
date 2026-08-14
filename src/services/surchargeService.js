import apiClient from './apiClient';
import cachedList from './cachedList';

export const surchargeService = {
  // Get all surcharges. Served from IndexedDB; the network only runs when stale.
  async getSurcharges() {
    const surcharges = await cachedList('surcharges', async () => {
      const response = await apiClient.get('/surcharges');
      return response.data?.surcharges || [];
    });
    return { surcharges };
  },

  // Get surcharges by outlet
  async getSurchargesByOutlet(outletId) {
    const response = await apiClient.get(`/surcharges?outletId=${outletId}`);
    return response.data;
  },

  // Get surcharge by ID
  async getSurcharge(id) {
    const response = await apiClient.get(`/surcharges/${id}`);
    return response.data;
  },

  // Create new surcharge
  async createSurcharge(surchargeData) {
    const response = await apiClient.post('/surcharges', surchargeData);
    return response.data;
  },

  // Update surcharge
  async updateSurcharge(id, surchargeData) {
    const response = await apiClient.put(`/surcharges/${id}`, surchargeData);
    return response.data;
  },

  // Delete surcharge
  async deleteSurcharge(id) {
    const response = await apiClient.delete(`/surcharges/${id}`);
    return response.data;
  },

  // Toggle surcharge status
  async toggleSurchargeStatus(id) {
    const response = await apiClient.patch(`/surcharges/${id}/toggle-status`);
    return response.data;
  },

  // Schedule-related methods
  async getSchedulesForSurcharge(surchargeId) {
    const response = await apiClient.get(`/surcharge-schedules/surcharge/${surchargeId}`);
    return response.data;
  },

  // Get all schedules for a specific register (used by POS screen and setup UI)
  async getSchedulesForRegister(registerId) {
    const response = await apiClient.get(`/surcharge-schedules/register/${registerId}`);
    return response.data;
  },

  async getWeeklySchedule(surchargeId) {
    const response = await apiClient.get(`/surcharge-schedules/surcharge/${surchargeId}/weekly`);
    return response.data;
  },

  async createSchedule(scheduleData) {
    const response = await apiClient.post('/surcharge-schedules', scheduleData);
    return response.data;
  },

  async updateSchedule(id, scheduleData) {
    const response = await apiClient.put(`/surcharge-schedules/${id}`, scheduleData);
    return response.data;
  },

  async deleteSchedule(id) {
    const response = await apiClient.delete(`/surcharge-schedules/${id}`);
    return response.data;
  },

  async getSchedule(id) {
    const response = await apiClient.get(`/surcharge-schedules/${id}`);
    return response.data;
  }
};
