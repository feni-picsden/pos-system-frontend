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

  // Sales History card: the "Customer Payment" popup behind a payment-method
  // link (payment date, who took it, every invoice it was applied to).
  getCustomerPayment: async (salePaymentId) => {
    const response = await apiClient.get(`/payments/${salePaymentId}/customer-payment`, { noCache: true });
    return response.data?.payment;
  },

  // Payment reversal (reference: Using Account Customers) — Cancel voids the
  // row (gone from reports/statements); Refund keeps it and posts an opposing
  // entry. Both re-open the sale balance and the customer's owing.
  // `payment` is a Payment History row: a customer_payments payment is reversed
  // by its own id; a legacy (pre-table) group by any of its sale_payments ids.
  cancelPayment: async (payment) => {
    const url = payment?.customerPaymentId
      ? `/payments/customer-payments/${payment.customerPaymentId}/cancel`
      : `/payments/${payment?.id ?? payment}/cancel`;
    const response = await apiClient.post(url);
    await paymentService.bustBalances();
    return response.data;
  },

  refundPayment: async (payment) => {
    const url = payment?.customerPaymentId
      ? `/payments/customer-payments/${payment.customerPaymentId}/refund`
      : `/payments/${payment?.id ?? payment}/refund`;
    const response = await apiClient.post(url);
    await paymentService.bustBalances();
    return response.data;
  },

  // Allocate an Incomplete payment's unallocated money onto outstanding
  // invoices: allocations = [{ saleId, amount }].
  allocatePayment: async (customerPaymentId, allocations) => {
    const response = await apiClient.post(`/payments/customer-payments/${customerPaymentId}/allocate`, { allocations });
    await paymentService.bustBalances();
    return response.data;
  },

  bustBalances: async () => {
    apiClient.bustCache('/customers');
    apiClient.bustCache('/sales');
    apiClient.bustCache('/payments');
    await posLocalDb.invalidateStore('customers').catch(() => {});
  },
};

export default paymentService;

