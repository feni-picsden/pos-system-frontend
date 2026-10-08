// Setup > General > Miscellaneous > "Debug Logging Level" (Essential / Normal /
// Verbose). Reference: "The level of logging to record in the local database.
// This only affects what data Shopfront can retrieve when getting bug diagnostics
// out of your computer. ... No matter which level is selected, logs are only
// stored for 7 days before being removed."
//
// The app's console output is mirrored into its own small IndexedDB database:
//   essential  errors only (console.error, uncaught errors, rejected promises)
//   normal     + warnings
//   verbose    + console.log / console.info
// Entries older than 7 days are pruned on start-up and once an hour. The level
// is read from the cached company settings (settingsService) at write time, so
// a change takes effect on the next page load like the reference.
//
// Getting the diagnostics out: in the browser console,
//   await window.posDiagnostics.export()   // downloads pos-diagnostics-<date>.json
//   await window.posDiagnostics.count()

const DB_NAME = 'pos-system-logs';
const DB_VERSION = 1;
const STORE = 'logs';
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 5000;
const FLUSH_MS = 2000;

const LEVEL_RANK = { essential: 0, normal: 1, verbose: 2 };
let currentLevel = 'normal';
let dbPromise = null;
let queue = [];
let flushTimer = null;
let installed = false;

export const setDebugLogLevel = (level) => {
  const v = String(level || '').toLowerCase();
  currentLevel = v in LEVEL_RANK ? v : 'normal';
};

const openDb = () => {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
          store.createIndex('ts', 'ts');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
};

const serialize = (args) => args.map((a) => {
  if (a instanceof Error) return `${a.name}: ${a.message}${a.stack ? `\n${a.stack}` : ''}`;
  if (typeof a === 'string') return a;
  try { return JSON.stringify(a); } catch { return String(a); }
}).join(' ').slice(0, 4000);

const flush = async () => {
  flushTimer = null;
  if (!queue.length) return;
  const batch = queue;
  queue = [];
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    batch.forEach((e) => store.add(e));
  } catch { /* logging must never throw */ }
};

const record = (severity, args) => {
  const want = severity === 'error' ? 0 : severity === 'warn' ? 1 : 2;
  if (LEVEL_RANK[currentLevel] < want) return;
  queue.push({ ts: Date.now(), severity, message: serialize(args), page: typeof location !== 'undefined' ? location.pathname : '' });
  if (queue.length > 200) queue.splice(0, queue.length - 200);
  if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_MS);
};

const prune = async () => {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const cutoff = Date.now() - RETENTION_MS;
    const idx = store.index('ts');
    idx.openCursor(IDBKeyRange.upperBound(cutoff)).onsuccess = (ev) => {
      const cursor = ev.target.result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };
    // Hard cap so a chatty Verbose day cannot grow without bound.
    const countReq = store.count();
    countReq.onsuccess = () => {
      let extra = countReq.result - MAX_ENTRIES;
      if (extra <= 0) return;
      store.openCursor().onsuccess = (ev) => {
        const cursor = ev.target.result;
        if (cursor && extra > 0) { cursor.delete(); extra -= 1; cursor.continue(); }
      };
    };
  } catch { /* ignore */ }
};

const readAll = async () => {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch { resolve([]); }
  });
};

export const exportDiagnostics = async () => {
  await flush();
  const rows = await readAll();
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), level: currentLevel, entries: rows }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pos-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return rows.length;
};

export const installDebugLog = () => {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const orig = { log: console.log, info: console.info, warn: console.warn, error: console.error };
  console.log = (...a) => { record('log', a); orig.log.apply(console, a); };
  console.info = (...a) => { record('log', a); orig.info.apply(console, a); };
  console.warn = (...a) => { record('warn', a); orig.warn.apply(console, a); };
  console.error = (...a) => { record('error', a); orig.error.apply(console, a); };
  window.addEventListener('error', (e) => record('error', [`Uncaught: ${e.message} (${e.filename}:${e.lineno})`]));
  window.addEventListener('unhandledrejection', (e) => record('error', ['Unhandled rejection:', e.reason]));
  window.addEventListener('beforeunload', () => { flush(); });
  window.posDiagnostics = {
    export: exportDiagnostics,
    count: async () => (await readAll()).length,
    level: () => currentLevel,
  };
  prune();
  setInterval(prune, 60 * 60 * 1000);
};
