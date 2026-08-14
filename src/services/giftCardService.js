import apiClient from './apiClient';

const giftCardService = {
  // Get all gift cards with optional filters
  getGiftCards: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      
      // Add filter parameters
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
          params.append(key, filters[key]);
        }
      });
      
      const response = await apiClient.get(`/gift-cards?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching gift cards:', error);
      throw error;
    }
  },

  // Get a single gift card by ID
  getGiftCard: async (id) => {
    try {
      const response = await apiClient.get(`/gift-cards/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching gift card:', error);
      throw error;
    }
  },

  // Get a gift card by code
  getGiftCardByCode: async (code) => {
    try {
      const response = await apiClient.get(`/gift-cards/code/${code}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching gift card by code:', error);
      throw error;
    }
  },

  // Create a new gift card
  createGiftCard: async (giftCardData) => {
    try {
      const response = await apiClient.post('/gift-cards', giftCardData);
      return response.data;
    } catch (error) {
      console.error('Error creating gift card:', error);
      throw error;
    }
  },

  // Update an existing gift card
  updateGiftCard: async (id, giftCardData) => {
    try {
      const response = await apiClient.put(`/gift-cards/${id}`, giftCardData);
      return response.data;
    } catch (error) {
      console.error('Error updating gift card:', error);
      throw error;
    }
  },

  // Delete a gift card
  deleteGiftCard: async (id) => {
    try {
      const response = await apiClient.delete(`/gift-cards/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting gift card:', error);
      throw error;
    }
  },

  // Redeem a gift card
  redeemGiftCard: async (code, amount, transactionData) => {
    try {
      const response = await apiClient.post(`/gift-cards/${code}/redeem`, {
        amount,
        ...transactionData
      });
      return response.data;
    } catch (error) {
      console.error('Error redeeming gift card:', error);
      throw error;
    }
  },

  // Check gift card balance
  checkBalance: async (code) => {
    try {
      const response = await apiClient.get(`/gift-cards/${code}/balance`);
      return response.data;
    } catch (error) {
      console.error('Error checking gift card balance:', error);
      throw error;
    }
  },

  // Export gift cards to CSV
  exportGiftCards: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
          params.append(key, filters[key]);
        }
      });

      const response = await apiClient.get(`/gift-cards/export/csv?${params.toString()}`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error exporting gift cards:', error);
      throw error;
    }
  },

  // Import gift cards from CSV
  importGiftCards: async (file, outletId = null) => {
    try {
      const formData = new FormData();
      formData.append('csvFile', file);
      if (outletId) {
        formData.append('outletId', outletId);
      }
      
      const response = await apiClient.post('/gift-cards/import/csv', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error importing gift cards:', error);
      throw error;
    }
  },

  // Get gift card transaction history
  getTransactionHistory: async (id) => {
    try {
      const response = await apiClient.get(`/gift-cards/${id}/transactions`);
      return response.data;
    } catch (error) {
      console.error('Error fetching gift card transactions:', error);
      throw error;
    }
  }
};

export default giftCardService;

