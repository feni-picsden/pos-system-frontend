import apiClient from './apiClient';

const OPTIONS_TTL_MS = 60_000;
let _optionsCache = null;
let _optionsCacheTs = 0;
let _optionsPending = null;

function _bustOptionsCache() {
  _optionsCache = null;
  _optionsCacheTs = 0;
  _optionsPending = null;
  apiClient.bustCache('/products/filters/options');
}

async function _fetchOptions(outletId = null) {
  if (_optionsCache && Date.now() - _optionsCacheTs < OPTIONS_TTL_MS) {
    return _optionsCache;
  }
  if (_optionsPending) return _optionsPending;

  const params = outletId ? { outletId } : {};
  _optionsPending = apiClient.get('/products/filters/options', { params })
    .then((res) => {
      _optionsCache = res.data;
      _optionsCacheTs = Date.now();
      _optionsPending = null;
      return res.data;
    })
    .catch((err) => {
      _optionsPending = null;
      throw err;
    });
  return _optionsPending;
}

const productService = {
  getProducts: async (filters = {}, requestOptions = {}) => {
    try {
      const params = new URLSearchParams();
      
      Object.keys(filters).forEach(key => {
        if (key === 'includeAllStatuses') return;
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
          if (Array.isArray(filters[key])) {
            params.append(key, filters[key].join(','));
          } else {
            params.append(key, filters[key]);
          }
        }
      });
      
      if (!('status' in filters) && !filters.includeAllStatuses) {
        params.append('status', 'Active');
      }
      const response = await apiClient.get(`/products?${params.toString()}`, requestOptions);
      return response.data;
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  },

  // Get a single product by ID
  getProduct: async (id) => {
    try {
      const response = await apiClient.get(`/products/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching product:', error);
      throw error;
    }
  },

  /** Exact barcode match for POS scanner (keyboard wedge). */
  getProductByBarcode: async (barcode, outletId = null) => {
    const code = encodeURIComponent(String(barcode || '').trim());
    const params = outletId ? { outletId } : {};
    const response = await apiClient.get(`/products/by-barcode/${code}`, { params });
    return response.data;
  },

  createProduct: async (productData) => {
    try {
      _bustOptionsCache();
      apiClient.bustCache('/products');
      const normalizedSuppliers = (productData.suppliers && Array.isArray(productData.suppliers) && productData.suppliers.length > 0)
        ? productData.suppliers
            .map((s) => ({
              supplierId: parseInt(s.supplierId ?? s.id ?? s, 10),
              notes: s.notes ?? null,
              code: s.code ?? null,
              minimumOrderQuantity: parseInt(s.minimumOrderQuantity ?? 0, 10) || 0,
              isCoreSupplier: Boolean(s.isCoreSupplier),
              replacementCost: s.replacementCost ?? "Inherit From Product",
            }))
            .filter((s) => !isNaN(s.supplierId))
        : (productData.supplierIds || [])
            .map((id) => ({
              supplierId: parseInt(id, 10),
              notes: null,
              code: null,
              minimumOrderQuantity: 0,
              isCoreSupplier: false,
              replacementCost: "Inherit From Product",
            }))
            .filter((s) => !isNaN(s.supplierId));
      const transformedData = {
        ...productData,
        tagIds: productData.tagIds || productData.tags || [],
        suppliers: normalizedSuppliers,
        prices: productData.prices || [],
        loyaltyRows: productData.loyaltyRows || [],
        images: productData.images || []
      };
      
      const response = await apiClient.post('/products', transformedData);
      return response.data;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  },
  updateProduct: async (id, productData) => {
    try {
      apiClient.bustCache(`/products/${id}`);
      apiClient.bustCache('/products');
      const normalizedSuppliers = (productData.suppliers && Array.isArray(productData.suppliers) && productData.suppliers.length > 0)
        ? productData.suppliers
            .map((s) => ({
              supplierId: parseInt(s.supplierId ?? s.id ?? s, 10),
              notes: s.notes ?? null,
              code: s.code ?? null,
              minimumOrderQuantity: parseInt(s.minimumOrderQuantity ?? 0, 10) || 0,
              isCoreSupplier: Boolean(s.isCoreSupplier),
              replacementCost: s.replacementCost ?? "Inherit From Product",
            }))
            .filter((s) => !isNaN(s.supplierId))
        : (productData.supplierIds || [])
            .map((id) => ({
              supplierId: parseInt(id, 10),
              notes: null,
              code: null,
              minimumOrderQuantity: 0,
              isCoreSupplier: false,
              replacementCost: "Inherit From Product",
            }))
            .filter((s) => !isNaN(s.supplierId));
      // Only include relation fields the caller actually provided — sending
      // empty arrays on a partial update (e.g. Express Stocktake) makes the
      // backend wipe prices/tags/suppliers/loyalty/images.
      const transformedData = { ...productData };
      if (productData.tagIds !== undefined || productData.tags !== undefined) {
        transformedData.tagIds = productData.tagIds || productData.tags || [];
      }
      if (productData.suppliers !== undefined || productData.supplierIds !== undefined) {
        transformedData.suppliers = normalizedSuppliers;
      }
      if (productData.prices !== undefined) transformedData.prices = productData.prices || [];
      if (productData.loyaltyRows !== undefined) transformedData.loyaltyRows = productData.loyaltyRows || [];
      if (productData.images !== undefined) transformedData.images = productData.images || [];

      const response = await apiClient.put(`/products/${id}`, transformedData);
      return response.data;
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  },

  deleteProduct: async (id) => {
    try {
      const result = await apiClient.delete(`/products/${id}`);
      _bustOptionsCache();
      apiClient.bustCache('/products');
      return result.data;
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  },

  getCategories: async (outletId = null) => {
    try {
      const data = await _fetchOptions(outletId);
      return data.categories;
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }
  },

  getBrands: async (outletId = null) => {
    try {
      const data = await _fetchOptions(outletId);
      return data.brands;
    } catch (error) {
      console.error('Error fetching brands:', error);
      throw error;
    }
  },

  getFamilies: async (outletId = null) => {
    try {
      const data = await _fetchOptions(outletId);
      return data.families;
    } catch (error) {
      console.error('Error fetching families:', error);
      throw error;
    }
  },

  getTags: async (outletId = null) => {
    try {
      const data = await _fetchOptions(outletId);
      return data.tags;
    } catch (error) {
      console.error('Error fetching tags:', error);
      throw error;
    }
  },

  // Metcash MSC codes the tenant has mapped onto its classifications (Category/Family/Tag)
  getMscMappings: async (outletId = null) => {
    try {
      const data = await _fetchOptions(outletId);
      const all = [...(data.categories || []), ...(data.families || []), ...(data.tags || [])];
      return [...new Set(all.map((c) => c.mscMapping).filter(Boolean))].sort();
    } catch (error) {
      console.error('Error fetching MSC mappings:', error);
      throw error;
    }
  },

  getSuppliers: async (outletId = null) => {
    try {
      const data = await _fetchOptions(outletId);
      return data.suppliers;
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      throw error;
    }
  },

  getTypes: async () => {
    try {
      const data = await _fetchOptions();
      return { types: data.types };
    } catch (error) {
      console.error('Error fetching types:', error);
      throw error;
    }
  },

  getTaxRates: async () => {
    try {
      const data = await _fetchOptions();
      return {
        retailTaxRates: data.retailTaxRates,
        purchaseTaxRates: data.purchaseTaxRates,
      };
    } catch (error) {
      console.error('Error fetching tax rates:', error);
      throw error;
    }
  },

  bulkUpdateProducts: async (productIds, updates) => {
    try {
      const response = await apiClient.post('/products/bulk/update', { productIds, updates });
      return response.data;
    } catch (error) {
      console.error('Error bulk updating products:', error);
      throw error;
    }
  },

  bulkDeleteProducts: async (productIds) => {
    try {
      const response = await apiClient.post('/products/bulk/delete', { productIds });
      return response.data;
    } catch (error) {
      console.error('Error bulk deleting products:', error);
      throw error;
    }
  },

  exportProducts: async () => {
    try {
      const response = await apiClient.get('/products/export/csv', {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error exporting products:', error);
      throw error;
    }
  },

  importProducts: async (file) => {
    try {
      const formData = new FormData();
      formData.append('csvFile', file);
      
      const response = await apiClient.post('/products/import/csv', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error importing products:', error);
      throw error;
    }
  },

  importAdvancedProducts: async (file) => {
    try {
      const formData = new FormData();
      formData.append('csvFile', file);
      
      const response = await apiClient.post('/products/import/advanced-csv', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error importing advanced products:', error);
      throw error;
    }
  },

  bulkUpdatePrices: async (productPrices) => {
    try {
      const response = await apiClient.post('/products/bulk/price-update', {
        productPrices
      });
      return response.data;
    } catch (error) {
      console.error('Error bulk updating prices:', error);
      throw error;
    }
  },

  mergeProducts: async (mergeData) => {
    try {
      const response = await apiClient.post('/products/merge', mergeData);
      return response.data;
    } catch (error) {
      console.error('Error merging products:', error);
      throw error;
    }
  },

  uploadImage: async (productId, imageFile, altText = '') => {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('altText', altText);
      
      const response = await apiClient.post(`/products/${productId}/images`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  },

  deleteImage: async (productId, imageId) => {
    try {
      const response = await apiClient.delete(`/products/${productId}/images/${imageId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting image:', error);
      throw error;
    }
  },

  setMainImage: async (productId, imageId) => {
    try {
      const response = await apiClient.put(`/products/${productId}/images/${imageId}/main`);
      return response.data;
    } catch (error) {
      console.error('Error setting main image:', error);
      throw error;
    }
  },

  matchCappedPricing: async (items) => {
    try {
      const response = await apiClient.post('/products/match-capped-pricing', { items });
      return response.data;
    } catch (error) {
      console.error('Error matching capped pricing:', error);
      throw error;
    }
  },

    // Get product sales summary
  getProductSalesSummary: async (productId, period = 'monthly', outletId = null) => {
    try {
      const query = `period=${period}${outletId ? `&outletId=${outletId}` : ''}`;
      const response = await apiClient.get(`/products/${productId}/sales-summary?${query}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching product sales summary:', error);
      throw error;
    }
  },

  getProductSalesHistory: async (productId, filters = {}) => {
    try {
      const queryParams = new URLSearchParams();
      
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
          queryParams.append(key, filters[key]);
        }
      });

      const response = await apiClient.get(`/products/${productId}/sales-history?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching product sales history:', error);
      throw error;
    }
  },

  getProductPurchaseHistory: async (productId, filters = {}) => {
    try {
      const queryParams = new URLSearchParams();
      
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
          queryParams.append(key, filters[key]);
        }
      });

      const response = await apiClient.get(`/products/${productId}/purchase-history?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching product purchase history:', error);
      throw error;
    }
  },

  getProductTransferHistory: async (productId, filters = {}) => {
    try {
      const queryParams = new URLSearchParams();

      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
          queryParams.append(key, filters[key]);
        }
      });

      const response = await apiClient.get(`/products/${productId}/transfer-history?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching product transfer history:', error);
      throw error;
    }
  },

  getProductInventoryLog: async (productId, filters = {}) => {
    try {
      const queryParams = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
          queryParams.append(key, filters[key]);
        }
      });
      const response = await apiClient.get(`/products/${productId}/inventory-log?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching product inventory log:', error);
      throw error;
    }
  },

  // Get product revision history
  getProductRevisions: async (productId) => {
    try {
      const response = await apiClient.get(`/products/${productId}/revisions`);
      return response.data;
    } catch (error) {
      console.error('Error fetching product revisions:', error);
      throw error;
    }
  },

  // Global product revision history report
  getProductRevisionHistory: async (filters = {}) => {
    try {
      const params = new URLSearchParams();

      Object.keys(filters).forEach((key) => {
        const value = filters[key];
        if (value === undefined || value === null || value === '') return;

        if (Array.isArray(value)) {
          // Send arrays as comma-separated values
          params.append(key, value.join(','));
        } else {
          params.append(key, value);
        }
      });

      const queryString = params.toString();
      const url = `/products/revisions/report${queryString ? `?${queryString}` : ''}`;

      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching product revision history report:', error);
      throw error;
    }
  }
};

export default productService;
