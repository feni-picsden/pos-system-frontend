import apiClient from './apiClient';

/** Trashed itemType (routes/trashedItems.js) -> the API resource it belongs to. */
const RESOURCE_BY_ITEM_TYPE = {
  Product: '/products',
  Promotion: '/promotions',
  Price_list: '/price-lists',
  User: '/users',
  Role: '/roles',
  Customer: '/customers',
  Customer_group: '/customer-groups',
  Supplier: '/suppliers',
  Classification: '/classifications',
};

/**
 * A restore is POST /trashed-items/restore, so apiClient's own invalidation
 * (keyed off the mutated url's prefix) never touches the resource the restored
 * row actually belongs to — the cached list keeps hiding it. Both restore
 * callers route through here, so invalidate from the service.
 */
function invalidateRestored(itemTypes) {
  const prefixes = new Set(
    itemTypes.map((type) => RESOURCE_BY_ITEM_TYPE[type]).filter(Boolean)
  );
  return Promise.all([...prefixes].map((prefix) => apiClient.invalidateResource(prefix)));
}

const trashedItemsService = {
  // Get all trashed items with optional filters
  getTrashedItems: async (filters = {}) => {
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
      
      const response = await apiClient.get(`/trashed-items?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching trashed items:', error);
      throw error;
    }
  },

  // Restore a single trashed item
  restoreItem: async (itemId, itemType) => {
    try {
      const response = await apiClient.post(`/trashed-items/restore`, {
        itemId,
        itemType
      });
      await invalidateRestored([itemType]);
      return response.data;
    } catch (error) {
      console.error('Error restoring item:', error);
      throw error;
    }
  },

  // Restore multiple trashed items
  restoreMultipleItems: async (items) => {
    try {
      const response = await apiClient.post(`/trashed-items/restore-multiple`, {
        items
      });
      // Per-item failures only cost an extra refetch of that resource.
      await invalidateRestored((items || []).map((item) => item.itemType));
      return response.data;
    } catch (error) {
      console.error('Error restoring items:', error);
      throw error;
    }
  },

  // Get trashed items count
  getTrashedItemsCount: async () => {
    try {
      const response = await apiClient.get('/trashed-items/count');
      return response.data;
    } catch (error) {
      console.error('Error fetching trashed items count:', error);
      throw error;
    }
  }
};

export default trashedItemsService;

