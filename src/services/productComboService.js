import apiClient from './apiClient';

const productComboService = {
  getProductCombos: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      
      // Add filter parameters
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
          if (Array.isArray(filters[key])) {
            params.append(key, filters[key].join(','));
          } else {
            params.append(key, filters[key]);
          }
        }
      });
      
      const response = await apiClient.get(`/product-combos?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching product combos:', error);
      throw error;
    }
  },

  // Get a single product combo by ID
  getProductCombo: async (id) => {
    try {
      const response = await apiClient.get(`/product-combos/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching product combo:', error);
      throw error;
    }
  },

  // Create a new product combo
  createProductCombo: async (comboData) => {
    try {
      const parsedOutletId =
        comboData.outletId === undefined || comboData.outletId === null || comboData.outletId === ''
          ? null
          : parseInt(comboData.outletId, 10);

      const transformedData = {
        name: comboData.name,
        description: comboData.description || null,
        totalPrice: comboData.totalPrice || 0,
        items: comboData.items || [],
        outletId: Number.isNaN(parsedOutletId) ? null : parsedOutletId,
        isActive: comboData.isActive !== undefined ? comboData.isActive : true
      };
      
      const response = await apiClient.post('/product-combos', transformedData);
      return response.data;
    } catch (error) {
      console.error('Error creating product combo:', error);
      throw error;
    }
  },

  // Update an existing product combo
  updateProductCombo: async (id, comboData) => {
    try {
      // Partial update: only send the keys the caller actually supplied, so a
      // targeted update (e.g. only categoryId) cannot reset price/items.
      const transformedData = {};
      if (comboData.name !== undefined) transformedData.name = comboData.name;
      if (comboData.description !== undefined) transformedData.description = comboData.description || null;
      if (comboData.totalPrice !== undefined) transformedData.totalPrice = comboData.totalPrice;
      if (comboData.items !== undefined) transformedData.items = comboData.items;
      if (comboData.isActive !== undefined) transformedData.isActive = comboData.isActive;
      if (comboData.categoryId !== undefined) transformedData.categoryId = comboData.categoryId;
      if (comboData.brandId !== undefined) transformedData.brandId = comboData.brandId;

      const response = await apiClient.put(`/product-combos/${id}`, transformedData);
      return response.data;
    } catch (error) {
      console.error('Error updating product combo:', error);
      throw error;
    }
  },

  // Delete a product combo
  deleteProductCombo: async (id) => {
    try {
      const response = await apiClient.delete(`/product-combos/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting product combo:', error);
      throw error;
    }
  }
};

export default productComboService;

