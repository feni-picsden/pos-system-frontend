import apiClient from './apiClient';

const resolveSuperAdminOutletId = () => {
  try {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    const isSuperAdmin = user?.isSuperAdmin === true || user?.hasAllPermission === true;

    if (!isSuperAdmin) return undefined;

    const selectedOutletId = localStorage.getItem('selectedOutletId');
    if (selectedOutletId === null || selectedOutletId === undefined || selectedOutletId === '') {
      return null;
    }

    const parsed = Number.parseInt(selectedOutletId, 10);
    return Number.isNaN(parsed) ? null : parsed;
  } catch {
    return undefined;
  }
};

const withOutletContext = (ticketData = {}) => {
  const outletId = resolveSuperAdminOutletId();
  if (outletId === undefined) return ticketData;
  return { ...ticketData, outletId };
};

const shelfTicketService = {
  // Get all shelf tickets
  getShelfTickets: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
          params.append(key, filters[key]);
        }
      });
      
      const response = await apiClient.get(`/shelf-tickets?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching shelf tickets:', error);
      throw error;
    }
  },

  // Add a product to shelf tickets
  addShelfTicket: async (ticketData) => {
    try {
      const response = await apiClient.post('/shelf-tickets', withOutletContext(ticketData));
      return response.data;
    } catch (error) {
      console.error('Error adding shelf ticket:', error);
      throw error;
    }
  },

  // Add multiple products to shelf tickets
  addBulkShelfTickets: async (ticketData) => {
    try {
      const response = await apiClient.post('/shelf-tickets/bulk', withOutletContext(ticketData));
      return response.data;
    } catch (error) {
      console.error('Error adding bulk shelf tickets:', error);
      throw error;
    }
  },

  // Remove a shelf ticket
  removeShelfTicket: async (id) => {
    try {
      const response = await apiClient.delete(`/shelf-tickets/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error removing shelf ticket:', error);
      throw error;
    }
  },

  // Remove multiple shelf tickets
  removeBulkShelfTickets: async (ticketIds) => {
    try {
      const response = await apiClient.delete('/shelf-tickets/bulk/remove', {
        data: { ticketIds }
      });
      return response.data;
    } catch (error) {
      console.error('Error removing bulk shelf tickets:', error);
      throw error;
    }
  },

  // Update shelf ticket
  updateShelfTicket: async (id, ticketData) => {
    try {
      const response = await apiClient.put(`/shelf-tickets/${id}`, ticketData);
      return response.data;
    } catch (error) {
      console.error('Error updating shelf ticket:', error);
      throw error;
    }
  },
};

export default shelfTicketService;

