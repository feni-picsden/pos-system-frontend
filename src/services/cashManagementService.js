import apiClient from './apiClient';

const cashManagementService = {
  async getShift(registerId) {
    const response = await apiClient.get('/cash-management/shift', {
      params: { registerId },
    });
    return response.data;
  },

  async getSummary(registerId) {
    const response = await apiClient.get('/cash-management/summary', {
      params: { registerId },
    });
    return response.data;
  },

  async getMovements(params = {}) {
    const response = await apiClient.get('/cash-management/movements', { params });
    return response.data;
  },

  async openShift(data) {
    const response = await apiClient.post('/cash-management/shift/open', data);
    apiClient.bustCache('/cash-management');
    return response.data;
  },

  async closeShift(data) {
    const response = await apiClient.post('/cash-management/shift/close', data);
    apiClient.bustCache('/cash-management');
    return response.data;
  },

  async openDrawer(data) {
    const response = await apiClient.post('/cash-management/open-drawer', data);
    apiClient.bustCache('/cash-management');
    return response.data;
  },

  async putCashIn(data) {
    const response = await apiClient.post('/cash-management/put-cash-in', data);
    apiClient.bustCache('/cash-management');
    return response.data;
  },

  async takeCashOut(data) {
    const response = await apiClient.post('/cash-management/take-cash-out', data);
    apiClient.bustCache('/cash-management');
    return response.data;
  },

  async safeDrop(data) {
    const response = await apiClient.post('/cash-management/safe-drop', data);
    apiClient.bustCache('/cash-management');
    return response.data;
  },

  async swapCash(data) {
    const response = await apiClient.post('/cash-management/swap-cash', data);
    apiClient.bustCache('/cash-management');
    return response.data;
  },
};

export default cashManagementService;
