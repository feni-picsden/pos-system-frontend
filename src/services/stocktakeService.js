import apiClient from './apiClient';

const stocktakeService = {
  // Get all stocktakes with filtering
  getStocktakes: async (params = {}) => {
    try {
      const response = await apiClient.get('/stocktakes', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching stocktakes:', error);
      throw error;
    }
  },

  // Get single stocktake by ID
  getStocktake: async (id) => {
    try {
      const response = await apiClient.get(`/stocktakes/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching stocktake:', error);
      throw error;
    }
  },

  // Create new stocktake
  createStocktake: async (stocktakeData) => {
    try {
      apiClient.bustCache('/stocktakes');
      const response = await apiClient.post('/stocktakes', stocktakeData);
      return response.data;
    } catch (error) {
      console.error('Error creating stocktake:', error);
      throw error;
    }
  },

  // Update stocktake
  updateStocktake: async (id, stocktakeData) => {
    try {
      apiClient.bustCache('/stocktakes');
      const response = await apiClient.put(`/stocktakes/${id}`, stocktakeData);
      return response.data;
    } catch (error) {
      console.error('Error updating stocktake:', error);
      throw error;
    }
  },

  // Complete stocktake
  completeStocktake: async (id, items = []) => {
    try {
      apiClient.bustCache('/stocktakes');
      const response = await apiClient.post(`/stocktakes/${id}/complete`, { items });
      return response.data;
    } catch (error) {
      console.error('Error completing stocktake:', error);
      throw error;
    }
  },

  // Apply stocktake (update inventory)
  applyStocktake: async (id) => {
    try {
      apiClient.bustCache('/stocktakes');
      apiClient.bustCache('/products');
      const response = await apiClient.post(`/stocktakes/${id}/apply`);
      return response.data;
    } catch (error) {
      console.error('Error applying stocktake:', error);
      throw error;
    }
  },

  // Delete stocktake
  deleteStocktake: async (id) => {
    try {
      apiClient.bustCache('/stocktakes');
      const response = await apiClient.delete(`/stocktakes/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting stocktake:', error);
      throw error;
    }
  },

  // Get stocktake statistics
  getStocktakeStatistics: async (id) => {
    try {
      const response = await apiClient.get(`/stocktakes/${id}/statistics`);
      return response.data;
    } catch (error) {
      console.error('Error fetching stocktake statistics:', error);
      throw error;
    }
  },

  // Search products for stocktake
  searchProducts: async (searchTerm, outletId = null) => {
    try {
      const params = {
        search: searchTerm,
        limit: 50,
        ...(outletId && { outletId })
      };
      const response = await apiClient.get('/products', { params });
      return response.data;
    } catch (error) {
      console.error('Error searching products:', error);
      throw error;
    }
  },

  // Get product by ID for stocktake
  getProduct: async (id) => {
    try {
      const response = await apiClient.get(`/products/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching product:', error);
      throw error;
    }
  },

  // Get outlets for stocktake
  getOutlets: async () => {
    try {
      const response = await apiClient.get('/outlets');
      return response.data;
    } catch (error) {
      console.error('Error fetching outlets:', error);
      throw error;
    }
  },

  // Record a scan/activity
  recordScan: async (id, scanData) => {
    try {
      apiClient.bustCache('/stocktakes');
      const response = await apiClient.post(`/stocktakes/${id}/scan`, scanData);
      return response.data;
    } catch (error) {
      console.error('Error recording scan:', error);
      throw error;
    }
  },

  // Update stocktake item
  updateStocktakeItem: async (stocktakeId, itemId, itemData) => {
    try {
      const response = await apiClient.put(`/stocktakes/${stocktakeId}/items/${itemId}`, itemData);
      return response.data;
    } catch (error) {
      console.error('Error updating stocktake item:', error);
      throw error;
    }
  },

  // Export stocktake data
  exportStocktake: async (id, format = 'csv') => {
    try {
      const response = await apiClient.get(`/stocktakes/${id}/export/${format}`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error exporting stocktake:', error);
      throw error;
    }
  },

  // Get stocktake filters/options
  getFilterOptions: async () => {
    try {
      const response = await apiClient.get('/stocktakes/filters/options');
      return response.data;
    } catch (error) {
      console.error('Error fetching filter options:', error);
      throw error;
    }
  },

  // External Stocktake File Management
  // Get all external stocktake files
  getExternalStocktakes: async (params = {}) => {
    try {
      const response = await apiClient.get('/stocktakes/external', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching external stocktakes:', error);
      throw error;
    }
  },

  // Import external stocktake file
  importExternalStocktake: async (formData) => {
    try {
      const response = await apiClient.post('/stocktakes/external/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error importing external stocktake:', error);
      throw error;
    }
  },

  // Export stocktake template for external use
  exportStocktakeTemplate: async (outletId, format = 'csv') => {
    try {
      const response = await apiClient.get(`/stocktakes/external/template/${outletId}/${format}`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error exporting stocktake template:', error);
      throw error;
    }
  },

  // Download external stocktake file
  downloadExternalStocktake: async (id) => {
    try {
      const response = await apiClient.get(`/stocktakes/external/${id}/download`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error downloading external stocktake:', error);
      throw error;
    }
  },

  // Delete external stocktake file
  deleteExternalStocktake: async (id) => {
    try {
      const response = await apiClient.delete(`/stocktakes/external/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting external stocktake:', error);
      throw error;
    }
  }
};

export default stocktakeService;
