import apiClient from './apiClient';
import posLocalDb from './posLocalDb';

const paymentService = {
  createPayment: async (paymentData) => {
    try {
      const response = await apiClient.post('/payments', paymentData);
      // A payment changes the customer's balance and every allocated sale's
      // balance, but apiClient only busts the '/payments' prefix of the POST —
      // without this the balances list, the customer page and sales history all
      // replay the pre-payment figures for up to 2 minutes.
      apiClient.bustCache('/customers');
      apiClient.bustCache('/sales');
      await posLocalDb.invalidateStore('customers').catch(() => {});
      return response.data;
    } catch (error) {
      console.error('Error creating payment:', error);
      throw error;
    }
  },

  getCustomerOutstandingInvoices: async (customerId) => {
    try {
      // noCache: the Make Payment dialog allocates real money against these
      // balances — a GET that was already in flight when the previous payment
      // was busted can repopulate the cache with pre-payment figures, so never
      // read this one from the TTL cache.
      const response = await apiClient.get(
        `/payments/customer/${customerId}/outstanding-invoices`,
        { noCache: true }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching outstanding invoices:', error);
      throw error;
    }
  },
};

export default paymentService;

