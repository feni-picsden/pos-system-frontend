import apiClient from './apiClient';

// Offline sales queue (reference "What is Offline Mode"): while the device cannot
// reach the server the sell screen keeps selling; each completed sale is kept
// here and uploaded once the connection is back.
//
// Kept in localStorage, NOT the IndexedDB catalog: clearLocalSession() wipes the
// catalog on logout/401, and an outstanding sale must survive that. Only the
// "Clear Local Data" button (which warns about outstanding sales) removes it.
//
// Upload is idempotent: every entry carries the sale's unique saleNumber and is
// posted with offlineUpload:true, so a retry after a lost response is answered
// with the stored sale instead of banking it twice (see routes/sales.js).

const KEY = 'pos.offlineSales.v1';
const EVENT = 'pos-offline-sales-changed';

const read = () => {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

const write = (list) => {
  localStorage.setItem(KEY, JSON.stringify(list));
  try { window.dispatchEvent(new CustomEvent(EVENT, { detail: { count: list.length } })); } catch { /* ignore */ }
};

// A request that never got an HTTP answer (offline, DNS, server down, timeout).
// Anything the server DID answer (400 validation, 403, 500) is not a connection
// problem and must not be silently queued.
export const isConnectionError = (error) =>
  !error?.response && (error?.code === 'ERR_NETWORK' || error?.code === 'ECONNABORTED'
    || error?.message === 'Network Error' || (typeof navigator !== 'undefined' && navigator.onLine === false));

let uploading = null;

const offlineSales = {
  EVENT,

  list: () => read(),
  count: () => read().length,
  pendingCount: () => read().filter((s) => !s.error).length,

  /** Queue a sale body built for POST /sales. Returns the stored entry. */
  enqueue: (saleBody, meta = {}) => {
    const list = read();
    const entry = {
      id: saleBody.saleNumber || `OFF-${Date.now()}`,
      soldAt: new Date().toISOString(),
      body: saleBody,
      total: Number(saleBody.totalAmount) || 0,
      meta,
      attempts: 0,
      error: null,
    };
    if (!list.some((s) => s.id === entry.id)) list.push(entry);
    write(list);
    return entry;
  },

  /**
   * Upload every queued sale, oldest first. Stops at the first connection
   * failure (still offline). A sale the server REJECTS stays in the queue with
   * its error so the operator can see it; the rest keep uploading.
   * Returns { uploaded, failed, remaining, offline }.
   */
  upload: async () => {
    if (uploading) return uploading;
    uploading = (async () => {
      let uploaded = 0;
      let failed = 0;
      let offline = false;
      for (const entry of read()) {
        try {
          await apiClient.post('/sales', { ...entry.body, offlineUpload: true, soldAt: entry.soldAt });
          write(read().filter((s) => s.id !== entry.id));
          uploaded += 1;
        } catch (error) {
          if (isConnectionError(error)) { offline = true; break; }
          failed += 1;
          const reason = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Upload refused';
          write(read().map((s) => (s.id === entry.id ? { ...s, attempts: (s.attempts || 0) + 1, error: String(reason) } : s)));
        }
      }
      if (uploaded > 0) {
        apiClient.bustCache?.('/sales');
        apiClient.bustCache?.('/products');
      }
      return { uploaded, failed, remaining: read().length, offline };
    })();
    try { return await uploading; } finally { uploading = null; }
  },

  /**
   * Offline Sale Backup: download the queued sales as a JSON file so they are not
   * lost if the browser's data is cleared. Returns the number of sales saved.
   */
  downloadBackup: () => {
    const list = read();
    if (list.length === 0) return 0;
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), sales: list }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `offline-sales-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return list.length;
  },

  /** Put the sales from a backup file back in the queue (ids already queued are skipped). */
  restoreBackup: (parsed) => {
    const incoming = Array.isArray(parsed?.sales) ? parsed.sales : [];
    const list = read();
    let added = 0;
    for (const s of incoming) {
      if (s?.id && s?.body && !list.some((x) => x.id === s.id)) { list.push({ ...s, error: null }); added += 1; }
    }
    write(list);
    return added;
  },
};

export default offlineSales;
