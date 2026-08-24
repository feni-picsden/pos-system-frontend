import apiClient from './apiClient';

// A payment method that should be processed through the Linkly PIN pad.
// Accepts a payment-method object ({name, type}) or a plain method-name string.
//
// Routing keys off the integration TYPE, not the name: only 'Linkly' /
// 'Linkly VAA' typed methods drive the pinpad. This keeps the documented
// outage procedure working — retype the method to plain 'EFTPOS' and card
// tenders record standalone without touching the terminal.
export const isEftposMethod = (method) => {
  if (method && typeof method === 'object' && method.type) {
    return /linkly/i.test(method.type);
  }
  // Name-only fallback (legacy sale keys store just the method name).
  return /eftpos|linkly|credit card|debit|\bcard\b/i.test(
    typeof method === 'string' ? method : `${method?.name || ''}`
  );
};

// Client for the Linkly Cloud EFTPOS backend routes. The card interaction is
// async: start a transaction, then poll /transactions/:txnRef for live pinpad
// display + the final approved/declined result.

const linklyService = {
  // --- Pairing / admin ---
  getPinpadStatus: async (terminalKey) => {
    const res = await apiClient.get('/linkly/pinpad', {
      params: terminalKey ? { terminalKey } : undefined,
    });
    return res.data;
  },

  pair: async ({ username, password, pairCode, terminalKey, outletId, registerId }) => {
    const res = await apiClient.post('/linkly/pair', {
      username,
      password,
      pairCode,
      terminalKey,
      outletId,
      registerId,
    });
    return res.data;
  },

  // Forget the stored pairing secret. Rejected (409) while a card transaction on
  // this terminal is still unresolved — without the secret it could never be
  // reconciled against Linkly.
  unpair: async (terminalKey) => {
    const res = await apiClient.delete('/linkly/pinpad', {
      params: terminalKey ? { terminalKey } : undefined,
    });
    return res.data;
  },

  logon: async (terminalKey) => {
    const res = await apiClient.post('/linkly/logon', { terminalKey });
    return res.data;
  },

  settlement: async (terminalKey) => {
    const res = await apiClient.post('/linkly/settlement', { terminalKey });
    return res.data;
  },

  // --- Transactions ---
  startPurchase: async ({ amountCents, cashOutCents = 0, txnRef, orderId, registerId, terminalKey }) => {
    const res = await apiClient.post('/linkly/purchase', {
      amountCents,
      cashOutCents,
      txnRef,
      orderId,
      registerId,
      terminalKey,
    });
    return res.data;
  },

  startRefund: async ({ amountCents, txnRef, orderId, registerId, terminalKey, originalTxnRef }) => {
    const res = await apiClient.post('/linkly/refund', {
      amountCents,
      txnRef,
      orderId,
      registerId,
      terminalKey,
      originalTxnRef,
    });
    return res.data;
  },

  // Poll status — silent so it doesn't trigger the global loading bar.
  getTransaction: async (txnRef) => {
    const res = await apiClient.get(`/linkly/transactions/${encodeURIComponent(txnRef)}`, {
      silent: true,
      noCache: true, // live status — must never be served from the TTL cache
    });
    return res.data.transaction;
  },

  // Read-only journal for end-of-day reconciliation and disputes.
  // status: a literal status, or 'unresolved' for everything that never reached
  // a terminal state (pending / in_progress / unknown).
  listTransactions: async ({ days = 7, limit = 50, status } = {}) => {
    const res = await apiClient.get('/linkly/transactions', {
      params: { days, limit, ...(status ? { status } : {}) },
      noCache: true,
    });
    return res.data.transactions || [];
  },

  // Approved on the pad but never recorded against a sale — money moved with
  // nothing in the POS, so it must be visible to a manager.
  listOrphans: async (days = 30) => {
    const res = await apiClient.get('/linkly/orphans', { params: { days }, noCache: true });
    return res.data.orphans || [];
  },

  sendKey: async (sessionId, key, terminalKey) => {
    const res = await apiClient.post(
      `/linkly/transactions/${encodeURIComponent(sessionId)}/sendkey`,
      { key, terminalKey }
    );
    return res.data;
  },

  reprint: async (sessionId, terminalKey) => {
    const res = await apiClient.post(
      `/linkly/transactions/${encodeURIComponent(sessionId)}/reprint`,
      { terminalKey }
    );
    return res.data;
  },

  // Timeout recovery — asks the backend to reconcile against Linkly. Never
  // re-submits a payment.
  reconcile: async (txnRef) => {
    const res = await apiClient.post(
      `/linkly/transactions/${encodeURIComponent(txnRef)}/reconcile`,
      {}
    );
    return res.data.transaction;
  },
};

export default linklyService;
