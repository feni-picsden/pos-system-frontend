import apiClient from './apiClient';
import paymentMethodService from './paymentMethodService';

const salesService = {
  // Get all sales with filtering
  getSales: async (filters = {}) => {
    try {
      const queryParams = new URLSearchParams();
      
      // Add all filter parameters
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
          queryParams.append(key, filters[key]);
        }
      });

      const response = await apiClient.get(`/sales?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching sales:', error);
      throw error;
    }
  },

  // Get a specific sale by ID
  getSaleById: async (id) => {
    try {
      const response = await apiClient.get(`/sales/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching sale:', error);
      throw error;
    }
  },

  // Create a new sale
  createSale: async (saleData) => {
    try {
      const response = await apiClient.post('/sales', saleData);
      return response.data;
    } catch (error) {
      console.error('Error creating sale:', error);
      throw error;
    }
  },

  // Update a sale
  updateSale: async (id, updateData) => {
    try {
      const response = await apiClient.put(`/sales/${id}`, updateData);
      return response.data;
    } catch (error) {
      console.error('Error updating sale:', error);
      throw error;
    }
  },

  // Get sales statistics
  getSalesStats: async (filters = {}) => {
    try {
      const queryParams = new URLSearchParams();
      
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
          queryParams.append(key, filters[key]);
        }
      });

      const response = await apiClient.get(`/sales/stats/summary?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching sales stats:', error);
      throw error;
    }
  },

  // Generate next sale number
  generateSaleNumber: async () => {
    try {
      const response = await apiClient.get('/sales/generate-number');
      return response.data;
    } catch (error) {
      console.error('Error generating sale number:', error);
      throw error;
    }
  },

  // Reprint receipt
  reprintReceipt: async (saleId) => {
    try {
      // This would typically call a receipt printing endpoint
      // For now, we'll just return success
      return { success: true, message: 'Receipt reprinted successfully' };
    } catch (error) {
      console.error('Error reprinting receipt:', error);
      throw error;
    }
  },

  // Email receipt
  // receiptHtml is the client-rendered receipt (see services/receiptEmailSender.js).
  // Omit it and the backend falls back to its own generator.
  emailReceipt: async (saleId, receiverEmails, senderEmail, receiptHtml = null) => {
    try {
      const response = await apiClient.post(`/sales/${saleId}/email-receipt`, {
        receiverEmails: Array.isArray(receiverEmails) ? receiverEmails : [receiverEmails],
        senderEmail: senderEmail,
        ...(receiptHtml ? { receiptHtml } : {})
      });
      return response.data;
    } catch (error) {
      console.error('Error emailing receipt:', error);
      throw error;
    }
  },

  // Return items
  returnItems: async (saleId, returnData) => {
    try {
      const response = await apiClient.put(`/sales/${saleId}`, {
        status: 'RETURNED',
        isReturned: true,
        notes: returnData.notes
      });
      return response.data;
    } catch (error) {
      console.error('Error returning items:', error);
      throw error;
    }
  },

  // Cancel sale
  cancelSale: async (saleId, cancelData) => {
    try {
      const response = await apiClient.put(`/sales/${saleId}`, {
        status: 'CANCELLED',
        notes: cancelData.notes
      });
      return response.data;
    } catch (error) {
      console.error('Error cancelling sale:', error);
      throw error;
    }
  },

  // Get parked sales
  getParkedSales: async () => {
    try {
      const response = await apiClient.get('/sales/parked');
      return response.data;
    } catch (error) {
      console.error('Error fetching parked sales:', error);
      throw error;
    }
  },

  // Park a sale (create sale with PARKED status)
  parkSale: async (saleData) => {
    try {
      const response = await apiClient.post('/sales', {
        ...saleData,
        status: 'PARKED'
      });
      return response.data;
    } catch (error) {
      console.error('Error parking sale:', error);
      throw error;
    }
  },

  // Resume a parked sale (update status from PARKED to COMPLETED)
  resumeParkedSale: async (saleId) => {
    try {
      const response = await apiClient.put(`/sales/${saleId}`, {
        status: 'COMPLETED'
      });
      return response.data;
    } catch (error) {
      console.error('Error resuming parked sale:', error);
      throw error;
    }
  }
};

export default salesService;
