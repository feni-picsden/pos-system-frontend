import apiClient from './apiClient';

const inventoryReportService = {
  getInventoryReport: async (filters) => {
    try {
      const response = await apiClient.get('/inventory-reports/report', { params: filters });
      return response.data;
    } catch (error) {
      console.error('Error fetching inventory report:', error);
      throw error;
    }
  },
  getInventoryAtDate: async (filters) => {
    try {
      const response = await apiClient.get('/inventory-reports/at-date', { params: filters });
      return response.data;
    } catch (error) {
      console.error('Error fetching inventory at date:', error);
      throw error;
    }
  },
  getSlowMovingStock: async (filters) => {
    try {
      const response = await apiClient.get('/inventory-reports/slow-moving-stock', { params: filters });
      return response.data;
    } catch (error) {
      console.error('Error fetching slow moving stock:', error);
      throw error;
    }
  },
  getStocktakedProducts: async (filters) => {
    try {
      const response = await apiClient.get('/inventory-reports/stocktaked-products', { params: filters });
      return response.data;
    } catch (error) {
      console.error('Error fetching stocktaked products:', error);
      throw error;
    }
  },
  getInventoryMovement: async (filters) => {
    try {
      const response = await apiClient.get('/inventory-reports/movement', { params: filters });
      return response.data;
    } catch (error) {
      console.error('Error fetching inventory movement report:', error);
      throw error;
    }
  },
};

export default inventoryReportService;

