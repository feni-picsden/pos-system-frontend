import apiClient from './apiClient';

const barcodeService = {
  getBarcodes: async (filters = {}) => {
    const params = new URLSearchParams();
    
    if (filters.productCreatedAtStart) {
      params.append('productCreatedAtStart', filters.productCreatedAtStart);
    }
    if (filters.productCreatedAtEnd) {
      params.append('productCreatedAtEnd', filters.productCreatedAtEnd);
    }
    if (filters.lastStocktakedAtStart) {
      params.append('lastStocktakedAtStart', filters.lastStocktakedAtStart);
    }
    if (filters.lastStocktakedAtEnd) {
      params.append('lastStocktakedAtEnd', filters.lastStocktakedAtEnd);
    }
    if (filters.lastSoldAtStart) {
      params.append('lastSoldAtStart', filters.lastSoldAtStart);
    }
    if (filters.lastSoldAtEnd) {
      params.append('lastSoldAtEnd', filters.lastSoldAtEnd);
    }
    if (filters.inventoryLevel) {
      params.append('inventoryLevel', filters.inventoryLevel);
    }
    if (filters.barcodeSearch) {
      params.append('barcodeSearch', filters.barcodeSearch);
    }
    if (filters.onlyDuplicates) {
      params.append('onlyDuplicates', filters.onlyDuplicates);
    }

    const response = await apiClient.get(`/barcodes?${params.toString()}`);
    return response.data;
  },

  deleteBarcode: async (productId, barcodeCode) => {
    const response = await apiClient.delete(`/barcodes/${productId}/${encodeURIComponent(barcodeCode)}`);
    return response.data;
  },
};

export default barcodeService;
