import apiClient from './apiClient';

const orderInvoiceService = {
  // Get all orders and invoices
  getOrdersInvoices: async (filters = {}) => {
    const response = await apiClient.get('/orders-invoices', { params: filters });
    return response.data;
  },

  // Get a specific order/invoice by ID
  getOrderInvoice: async (id) => {
    const response = await apiClient.get(`/orders-invoices/${id}`);
    return response.data;
  },

  // Create a new order/invoice
  createOrderInvoice: async (orderInvoiceData) => {
    const response = await apiClient.post('/orders-invoices', orderInvoiceData);
    return response.data;
  },

  // Update an existing order/invoice
  updateOrderInvoice: async (id, orderInvoiceData) => {
    const response = await apiClient.put(`/orders-invoices/${id}`, orderInvoiceData);
    return response.data;
  },

  // Delete an order/invoice
  deleteOrderInvoice: async (id) => {
    const response = await apiClient.delete(`/orders-invoices/${id}`);
    return response.data;
  },

  // Get order/invoice statistics
  getOrderInvoiceStats: async () => {
    const response = await apiClient.get('/orders-invoices/stats');
    return response.data;
  },

  // Upload an attachment (image/PDF) to an order/invoice
  uploadAttachment: async (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post(`/orders-invoices/${id}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Mark order/invoice as received. Optional receivedQuantities:
  // [{ itemId, receivedCases, receivedItems }] for partial receipt.
  markAsReceived: async (id, receivedQuantities) => {
    const response = await apiClient.patch(
      `/orders-invoices/${id}/receive`,
      receivedQuantities ? { receivedQuantities } : {}
    );
    return response.data;
  },

  // Apply a PENDING credit note (adds its amount to the supplier's credit balance)
  applyCreditNote: async (id) => {
    const response = await apiClient.patch(`/orders-invoices/${id}/apply`);
    return response.data;
  },

  // Generate invoice from order
  generateInvoice: async (orderId) => {
    const response = await apiClient.post(`/orders-invoices/${orderId}/generate-invoice`);
    return response.data;
  },

  // Generate order number (optionally pass type to get correct prefix)
  generateOrderNumber: async (type) => {
    const response = await apiClient.get('/orders-invoices/generate-number', {
      params: type ? { type } : undefined,
    });
    return response.data;
  },

  // Send/execute a transfer (deducts source outlet, marks in-transit, notifies destination)
  sendTransfer: async (id) => {
    const response = await apiClient.patch(`/orders-invoices/${id}/transfer-send`);
    return response.data;
  },

  // Receive an in-transit transfer at the destination outlet (adds stock, auto-creates products)
  receiveTransfer: async (id) => {
    const response = await apiClient.patch(`/orders-invoices/${id}/transfer-receive`);
    return response.data;
  },

  // Get suppliers for orders
  getSuppliersForOrders: async () => {
    const response = await apiClient.get('/orders-invoices/suppliers');
    return response.data;
  },

  // Get customers for orders
  getCustomersForOrders: async () => {
    const response = await apiClient.get('/orders-invoices/customers');
    return response.data;
  },

  // Request a review from selected reviewers: { reviewerIds: [int], comment? }
  createReview: async (id, payload) => {
    const response = await apiClient.post(`/orders-invoices/${id}/reviews`, payload);
    return response.data;
  },

  // Submit the current user's review action (toggle): { status }
  submitReview: async (id, payload) => {
    const response = await apiClient.patch(`/orders-invoices/${id}/reviews`, payload);
    return response.data;
  },

  // Sync the reviewer set on an order's review: { reviewerIds: [int] }
  updateReviewers: async (id, payload) => {
    const response = await apiClient.put(`/orders-invoices/${id}/reviews/reviewers`, payload);
    return response.data;
  },

  // Add a review comment: { comment, orderInvoiceItemId? } (null itemId = general comment)
  addReviewComment: async (id, payload) => {
    const response = await apiClient.post(`/orders-invoices/${id}/review-comments`, payload);
    return response.data;
  },

  // Create a RETURN document copying all items from a received order/invoice
  returnItems: async (id) => {
    const response = await apiClient.post(`/orders-invoices/${id}/return-items`);
    return response.data;
  },

  // Create a new ORDER copying all items from a sent RETURN
  reorderItems: async (id) => {
    const response = await apiClient.post(`/orders-invoices/${id}/reorder-items`);
    return response.data;
  },

  // Send order by email (body can contain [order-table] placeholder replaced with order details HTML)
  sendOrderEmail: async (id, { to, subject, body }) => {
    const response = await apiClient.post(`/orders-invoices/${id}/send-email`, { to, subject, body });
    return response.data;
  }
};

export default orderInvoiceService;
