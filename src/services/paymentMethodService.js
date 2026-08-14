import apiClient from './apiClient';
import cachedList from './cachedList';
import posLocalDb from './posLocalDb';

// The sell screen reads its tender buttons from the cached list, so a method
// created/edited/deleted in Setup stayed on screen until the 5-minute staleness
// window expired (or a reload). Shopfront makes the change visible on the next
// register sync — this refresh IS that sync for a mutation made in this browser.
const refreshCache = async () => {
  try {
    const response = await apiClient.get('/payment-methods', { noCache: true });
    await posLocalDb.init();
    await posLocalDb.putStoreAll('paymentMethods', response.data?.paymentMethods || []);
  } catch {
    // A failed refresh only costs staleness; never break the mutation itself.
  }
};

// Per-method settings (Allow Cash Out, etc.) ride inside masterDatabaseRef as
// JSON — see Setup/PaymentMethods.jsx. Returns {} when the ref is a foreign key
// or missing so callers can safely read flags off it.
export const getPaymentMethodSettings = (method) => {
  const raw = method?.masterDatabaseRef;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

// Does this payment method allow EFTPOS cash out?
export const allowsCashOut = (method) => getPaymentMethodSettings(method).allowCashOut === true;

const paymentMethodService = {
  // Get all payment methods. The full list is cached in IndexedDB and the
  // isActive flag is applied locally, so no picker waits on the network.
  getPaymentMethods: async (params = {}, requestOptions = {}) => {
    try {
      const keys = Object.keys(params);
      const cacheable = keys.length === 0 || (keys.length === 1 && keys[0] === 'isActive');
      if (cacheable) {
        const all = await cachedList('paymentMethods', async () => {
          const response = await apiClient.get('/payment-methods', requestOptions);
          return response.data?.paymentMethods || [];
        });
        return {
          paymentMethods:
            params.isActive === undefined
              ? all
              : all.filter((m) => !!m.isActive === !!params.isActive),
        };
      }
      const response = await apiClient.get('/payment-methods', { params, ...requestOptions });
      return response.data;
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      throw error;
    }
  },

  // Get single payment method by ID
  getPaymentMethod: async (id) => {
    try {
      const response = await apiClient.get(`/payment-methods/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching payment method:', error);
      throw error;
    }
  },

  // Create new payment method
  createPaymentMethod: async (paymentMethodData) => {
    try {
      const response = await apiClient.post('/payment-methods', paymentMethodData);
      await refreshCache();
      return response.data;
    } catch (error) {
      console.error('Error creating payment method:', error);
      throw error;
    }
  },

  // Update payment method
  updatePaymentMethod: async (id, paymentMethodData) => {
    try {
      const response = await apiClient.put(`/payment-methods/${id}`, paymentMethodData);
      await refreshCache();
      return response.data;
    } catch (error) {
      console.error('Error updating payment method:', error);
      throw error;
    }
  },

  // Delete payment method
  deletePaymentMethod: async (id) => {
    try {
      const response = await apiClient.delete(`/payment-methods/${id}`);
      await refreshCache();
      return response.data;
    } catch (error) {
      console.error('Error deleting payment method:', error);
      throw error;
    }
  },

  // Toggle payment method status
  togglePaymentMethodStatus: async (id) => {
    try {
      const response = await apiClient.patch(`/payment-methods/${id}/toggle-status`);
      await refreshCache();
      return response.data;
    } catch (error) {
      console.error('Error toggling payment method status:', error);
      throw error;
    }
  },

  // Set payment method as default
  setPaymentMethodAsDefault: async (id) => {
    try {
      const response = await apiClient.patch(`/payment-methods/${id}/set-default`);
      await refreshCache();
      return response.data;
    } catch (error) {
      console.error('Error setting payment method as default:', error);
      throw error;
    }
  }
};

export default paymentMethodService;
