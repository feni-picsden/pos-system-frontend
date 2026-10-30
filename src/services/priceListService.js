import apiClient from './apiClient';
import cachedList from './cachedList';

const priceListService = {
  // Served from IndexedDB; the network only runs when the copy is stale.
  getPriceLists: async () => {
    const priceLists = await cachedList('priceLists', async () => {
      const response = await apiClient.get('/price-lists');
      return response.data?.priceLists || [];
    });
    return { priceLists };
  },

  getPriceList: async (id) => {
    const response = await apiClient.get(`/price-lists/${id}`);
    return response.data;
  },

  createPriceList: async (priceListData) => {
    const response = await apiClient.post('/price-lists', priceListData);
    return response.data;
  },

  updatePriceList: async (id, priceListData) => {
    const response = await apiClient.put(`/price-lists/${id}`, priceListData);
    return response.data;
  },

  deletePriceList: async (id) => {
    const response = await apiClient.delete(`/price-lists/${id}`);
    return response.data;
  },

  togglePriceListStatus: async (id) => {
    const response = await apiClient.patch(`/price-lists/${id}/toggle-status`);
    return response.data;
  },

  getPriceListConfiguration: async (id) => {
    const response = await apiClient.get(`/price-lists/${id}/configuration`);
    return response.data;
  },

  savePriceListConfiguration: async (id, configuration) => {
    const response = await apiClient.put(`/price-lists/${id}/configuration`, configuration);
    return response.data;
  },

  // View page > Customers tab: customers sold at this list (own or via group).
  getPriceListCustomers: async (id) => {
    const response = await apiClient.get(`/price-lists/${id}/customers`, { noCache: true });
    return response.data;
  },

  // View page > Revisions tab.
  getPriceListRevisions: async (id) => {
    const response = await apiClient.get(`/price-lists/${id}/revisions`, { noCache: true });
    return response.data;
  },
};

export default priceListService;
