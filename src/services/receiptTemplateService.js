import apiClient from './apiClient';

const receiptTemplateService = {
  // Get all receipt templates
  getTemplates: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      
      if (filters.search) params.append('search', filters.search);
      if (filters.type) params.append('type', filters.type);
      if (filters.for) params.append('for', filters.for);
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.offset) params.append('offset', filters.offset.toString());

      const queryString = params.toString();
      const url = queryString ? `/receipt-templates?${queryString}` : '/receipt-templates';
      
      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching receipt templates:', error);
      throw error;
    }
  },

  // Get a specific receipt template by ID
  getTemplate: async (id) => {
    try {
      const response = await apiClient.get(`/receipt-templates/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching receipt template:', error);
      throw error;
    }
  },

  // Create a new receipt template
  createTemplate: async (templateData) => {
    try {
      const response = await apiClient.post('/receipt-templates', templateData);
      return response.data;
    } catch (error) {
      console.error('Error creating receipt template:', error);
      throw error;
    }
  },

  // Update an existing receipt template
  updateTemplate: async (id, templateData) => {
    try {
      const response = await apiClient.put(`/receipt-templates/${id}`, templateData);
      return response.data;
    } catch (error) {
      console.error('Error updating receipt template:', error);
      throw error;
    }
  },

  // Delete a receipt template
  deleteTemplate: async (id) => {
    try {
      const response = await apiClient.delete(`/receipt-templates/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting receipt template:', error);
      throw error;
    }
  },

  // Clone a receipt template
  cloneTemplate: async (id) => {
    try {
      const response = await apiClient.post(`/receipt-templates/${id}/clone`);
      return response.data;
    } catch (error) {
      console.error('Error cloning receipt template:', error);
      throw error;
    }
  },

  // Get receipt template configuration
  getTemplateConfig: async (id) => {
    try {
      const response = await apiClient.get(`/receipt-templates/${id}/config`);
      return response.data;
    } catch (error) {
      console.error('Error fetching receipt template config:', error);
      throw error;
    }
  },

  // Update receipt template configuration
  updateTemplateConfig: async (id, configData) => {
    try {
      const response = await apiClient.put(`/receipt-templates/${id}/config`, { config: configData });
      return response.data;
    } catch (error) {
      console.error('Error updating receipt template config:', error);
      throw error;
    }
  },

  // Get available receipt types
  getReceiptTypes: async () => {
    try {
      const response = await apiClient.get('/receipt-templates/types');
      return response.data;
    } catch (error) {
      console.error('Error fetching receipt types:', error);
      // Return default types as fallback
      return {
        types: [
          'Normal Receipt',
          'Generic / Text Only Receipt',
          'A4 Receipt',
          'Email Receipt'
        ]
      };
    }
  },

  // Preview a receipt template
  previewTemplate: async (id, sampleData = {}) => {
    try {
      const response = await apiClient.post(`/receipt-templates/${id}/preview`, sampleData);
      return response.data;
    } catch (error) {
      console.error('Error previewing receipt template:', error);
      throw error;
    }
  },

  // ponytail: no setDefaultTemplate — the reference has no per-template default flag.
  // The default lives in Setup > General > Registers ("Default Receipt Template").

  // Get default receipt templates
  getDefaultTemplates: async () => {
    try {
      const response = await apiClient.get('/receipt-templates/defaults');
      return response.data;
    } catch (error) {
      console.error('Error fetching default receipt templates:', error);
      throw error;
    }
  },

  // Get default template configuration for a specific type
  getDefaultConfig: async (type) => {
    try {
      const response = await apiClient.get(`/receipt-templates/default-config/${encodeURIComponent(type)}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching default template config:', error);
      throw error;
    }
  },

  // Get all default template configurations
  getAllDefaultConfigs: async () => {
    try {
      const response = await apiClient.get('/receipt-templates/default-configs');
      return response.data;
    } catch (error) {
      console.error('Error fetching default template configs:', error);
      throw error;
    }
  }
};

export default receiptTemplateService;
