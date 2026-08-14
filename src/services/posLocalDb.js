/**
 * Local POS catalog + app-wide page cache (IndexedDB).
 * Sale screen reads from memory; API only for background sync + saving sales.
 * Other pages use getStoreAll / putStoreAll for stale-while-revalidate caching.
 */

const DB_NAME = 'pos-system';
const DB_VERSION = 5;

const STORES = {
  // POS catalog (used by sell screen)
  products: 'products',
  barcodes: 'barcodes',
  customers: 'customers',
  categories: 'categories',
  brands: 'brands',
  families: 'families',
  promotions: 'promotions',
  paymentMethods: 'paymentMethods',
  combos: 'combos',
  taxRates: 'taxRates',
  meta: 'meta',
  // App-wide page cache (used by admin / setup pages)
  saleKeySets: 'saleKeySets',
  classifications: 'classifications',
  outlets: 'outlets',
  registers: 'registers',
  dashboardLayouts: 'dashboardLayouts',
  tags: 'tags',
  suppliers: 'suppliers',
  // v5: remaining master-data stores so every list page renders from IndexedDB
  // instead of hitting the API on mount (matches the reference POS).
  customerGroups: 'customerGroups',
  priceLists: 'priceLists',
  promotionCategories: 'promotionCategories',
  giftCards: 'giftCards',
  customerDisplays: 'customerDisplays',
  receiptTemplates: 'receiptTemplates',
  shelfTicketTemplates: 'shelfTicketTemplates',
  transferees: 'transferees',
  users: 'users',
  roles: 'roles',
  loyaltyPrograms: 'loyaltyPrograms',
  surcharges: 'surcharges',
  stocktakes: 'stocktakes',
};

let dbPromise = null;

let cache = {
  outletId: null,
  products: [],
  customers: [],
  promotions: [],
  paymentMethods: [],
  combosById: {},
  taxRates: [],
  barcodeByCode: {},
  ready: false,
};

export function normalizeBarcodeCodes(barcodes) {
  if (!barcodes) return [];
  let arr = barcodes;
  if (typeof arr === 'string') {
    try {
      arr = JSON.parse(arr);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((b) => {
      if (typeof b === 'string') {
        const code = b.trim();
        return code || null;
      }
      const code = String(b?.code || '').trim();
      return code || null;
    })
    .filter(Boolean);
}

/**
 * Product descriptions are stored as rich-text HTML (contentEditable innerHTML).
 * Every plain-text consumer (sell-screen search row, search index, order lines)
 * must strip the markup instead of printing tags at the operator.
 * Markup-only values ("<p><br></p>") collapse to '' so callers can fall back.
 */
export function stripHtml(html) {
  if (!html) return '';
  const text = String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return text.replace(/\s+/g, ' ').trim();
}

function buildBarcodeMap(products) {
  // Each code maps to an ARRAY of products — the same barcode may be
  // assigned to multiple products (the sell screen shows a picker then).
  const map = {};
  (products || []).forEach((product) => {
    normalizeBarcodeCodes(product.barcodes).forEach((code) => {
      (map[code] = map[code] || []).push(product);
    });
  });
  return map;
}

function buildCombosMap(combos) {
  const map = {};
  (combos || []).forEach((combo) => {
    if (combo?.id != null) map[combo.id] = combo;
  });
  return map;
}

function getProductSearchText(product) {
  const barcodeText = normalizeBarcodeCodes(product?.barcodes).join(' ');
  // Description is stripped: raw tag names ('li', 'ul') would otherwise match
  // every formatted product.
  return `${product?.name || ''} ${stripHtml(product?.description)} ${barcodeText}`.toLowerCase();
}

function openDatabase() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    // A schema upgrade only proceeds once every other connection closes. An old
    // tab running a previous build has no onversionchange handler, so it never
    // will — and without this the open request stays pending and every caller
    // (i.e. every page) waits on it forever. Give up and run without IndexedDB.
    const settle = (value) => {
      clearTimeout(blockedTimer);
      resolve(value);
    };
    const blockedTimer = setTimeout(() => {
      console.warn('[posLocalDb] IndexedDB upgrade blocked by another tab — running without cache');
      resolve(null);
    }, 3000);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      const ensureStore = (name, options, indexDefs = []) => {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, options);
          indexDefs.forEach(([idxName, keyPath, unique]) => {
            store.createIndex(idxName, keyPath, { unique: !!unique });
          });
        }
      };

      ensureStore(STORES.products, { keyPath: 'id' }, [
        ['name', 'name', false],
        ['outletId', 'outletId', false],
      ]);
      ensureStore(STORES.barcodes, { keyPath: 'code' }, [['productId', 'productId', false]]);
      ensureStore(STORES.customers, { keyPath: 'id' }, [
        ['name', 'name', false],
        ['email', 'email', false],
        ['outletId', 'outletId', false],
      ]);
      ensureStore(STORES.categories, { keyPath: 'id' }, [['name', 'name', false]]);
      ensureStore(STORES.brands, { keyPath: 'id' }, [['name', 'name', false]]);
      ensureStore(STORES.families, { keyPath: 'id' }, [['name', 'name', false]]);
      ensureStore(STORES.promotions, { keyPath: 'id' }, [['outletId', 'outletId', false]]);
      ensureStore(STORES.paymentMethods, { keyPath: 'id' });
      ensureStore(STORES.combos, { keyPath: 'id' });
      ensureStore(STORES.taxRates, { keyPath: 'id' });
      ensureStore(STORES.meta, { keyPath: 'key' });
      // v3: app-wide page cache stores
      ensureStore(STORES.saleKeySets, { keyPath: 'id' }, [['outletId', 'outletId', false]]);
      ensureStore(STORES.classifications, { keyPath: 'id' }, [['type', 'type', false]]);
      // v4: additional page cache stores
      ensureStore(STORES.outlets, { keyPath: 'id' });
      ensureStore(STORES.registers, { keyPath: 'id' }, [['outletId', 'outletId', false]]);
      ensureStore(STORES.dashboardLayouts, { keyPath: 'key' });
      ensureStore(STORES.tags, { keyPath: 'id' }, [['name', 'name', false]]);
      ensureStore(STORES.suppliers, { keyPath: 'id' }, [['name', 'name', false]]);
      // v5: every remaining master-data list, keyed by id like the rest
      [
        STORES.customerGroups, STORES.priceLists, STORES.promotionCategories,
        STORES.giftCards, STORES.customerDisplays, STORES.receiptTemplates,
        STORES.shelfTicketTemplates, STORES.transferees,
        STORES.users, STORES.roles, STORES.loyaltyPrograms, STORES.surcharges,
        STORES.stocktakes,
      ].forEach((name) => ensureStore(name, { keyPath: 'id' }));
    };

    request.onsuccess = () => {
      const db = request.result;
      // Another tab bumping the schema must not be blocked by this connection —
      // without this, the next DB_VERSION bump deadlocks every open tab.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      settle(db);
    };
    request.onerror = () => {
      clearTimeout(blockedTimer);
      reject(request.error);
    };
    request.onblocked = () => settle(null);
  });

  return dbPromise;
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function clearStore(db, storeName) {
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).clear();
  await txDone(tx);
}

async function getAllFromStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function enrichComboItems(combo, productsById) {
  if (!combo?.items) return combo;
  return {
    ...combo,
    items: combo.items.map((item) => ({
      ...item,
      product:
        item.product ||
        productsById[item.productId] ||
        cache.products.find((p) => p.id === item.productId) ||
        null,
    })),
  };
}

/**
 * The IndexedDB products store holds every status so admin pages can list
 * inactive/discontinued rows; the sell screen must only ever see sellable ones.
 */
function sellableProducts(products) {
  return (products || []).filter((p) => !p.status || p.status === 'Active');
}

function applyMemoryCatalog(payload) {
  const {
    outletId,
    products: allProducts = [],
    customers = [],
    promotions = [],
    paymentMethods: allPaymentMethods = [],
    combos = [],
    taxRates = [],
  } = payload;

  const products = sellableProducts(allProducts);
  // Same rule for payment methods: the store keeps the inactive ones for the
  // setup page, the sell screen must not offer them.
  const paymentMethods = (allPaymentMethods || []).filter((m) => m.isActive !== false);

  const productsById = {};
  products.forEach((p) => {
    productsById[p.id] = p;
  });

  const enrichedCombos = combos.map((c) => enrichComboItems(c, productsById));

  cache.outletId = outletId ?? null;
  cache.products = products;
  cache.customers = customers;
  cache.promotions = promotions;
  cache.paymentMethods = paymentMethods;
  cache.combosById = buildCombosMap(enrichedCombos);
  cache.taxRates = taxRates;
  cache.barcodeByCode = buildBarcodeMap(products);
  cache.ready =
    products.length > 0 ||
    customers.length > 0 ||
    promotions.length > 0;
}

const posLocalDb = {
  async init() {
    return openDatabase();
  },

  isReady() {
    return cache.ready;
  },

  getProducts() {
    return cache.products;
  },

  getCustomers() {
    return cache.customers;
  },

  /** Replace the in-memory customer roster after a mutation refresh. */
  setCustomers(items) {
    if (Array.isArray(items)) cache.customers = items;
  },

  getPromotions() {
    return cache.promotions;
  },

  getPaymentMethods() {
    return cache.paymentMethods;
  },

  getTaxRates() {
    return cache.taxRates;
  },

  getComboById(id) {
    const comboId = parseInt(id, 10);
    return cache.combosById[comboId] || null;
  },

  getBarcodeMap() {
    return cache.barcodeByCode;
  },

  getProductByBarcode(code) {
    const c = String(code || '').trim();
    const list = c ? cache.barcodeByCode[c] : null;
    return list && list.length ? list[0] : null;
  },

  /** All products sharing a barcode (duplicate barcodes are allowed). */
  getProductsByBarcode(code) {
    const c = String(code || '').trim();
    const list = c ? cache.barcodeByCode[c] : null;
    return Array.isArray(list) ? list : [];
  },

  getProductById(id) {
    const pid = parseInt(id, 10);
    if (isNaN(pid)) return null;
    return cache.products.find((p) => p.id === pid) || null;
  },

  getCustomerById(id) {
    const cid = parseInt(id, 10);
    if (isNaN(cid)) return null;
    return cache.customers.find((c) => c.id === cid) || null;
  },

  /**
   * Resolve product from id, partial object, or name — never calls API.
   */
  resolveProduct(ref, nameFallback) {
    if (ref?.product) return this.resolveProduct(ref.product, nameFallback);

    if (ref && typeof ref === 'object' && ref.id) {
      return this.getProductById(ref.id) || ref;
    }

    if (ref != null && !isNaN(parseInt(ref, 10))) {
      const fromId = this.getProductById(ref);
      if (fromId) return fromId;
    }

    if (nameFallback) {
      const hits = this.searchProducts(nameFallback, 1);
      if (hits[0]) return hits[0];
    }

    return typeof ref === 'object' ? ref : null;
  },

  searchProducts(term, limit = 10) {
    const q = String(term || '').trim().toLowerCase();
    if (!q || !cache.products.length) return [];
    return cache.products
      .filter((p) => getProductSearchText(p).includes(q))
      .slice(0, limit);
  },

  /** Search after warming from IDB when in-memory catalog is not loaded yet. */
  async searchProductsAsync(term, limit = 10, outletId = null) {
    if (cache.products.length) return this.searchProducts(term, limit);
    await this.init();
    await this.warmFromDb(outletId);
    return this.searchProducts(term, limit);
  },

  async searchCustomersAsync(term, limit = 10, outletId = null) {
    if (cache.customers.length) return this.searchCustomers(term, limit);
    await this.init();
    await this.warmFromDb(outletId);
    return this.searchCustomers(term, limit);
  },

  async getProductByBarcodeAsync(code, outletId = null) {
    const local = this.getProductByBarcode(code);
    if (local) return local;
    await this.init();
    await this.warmFromDb(outletId);
    return this.getProductByBarcode(code);
  },

  async getProductsByBarcodeAsync(code, outletId = null) {
    const local = this.getProductsByBarcode(code);
    if (local.length) return local;
    await this.init();
    await this.warmFromDb(outletId);
    return this.getProductsByBarcode(code);
  },

  searchCustomers(term, limit = 10) {
    if (!cache.customers.length) return [];
    const q = String(term || '').trim().toLowerCase();
    if (!q) return cache.customers.slice(0, limit);
    return cache.customers
      .filter((c) => {
        const name = `${c.firstName || ''} ${c.lastName || ''} ${c.company || ''}`.toLowerCase();
        const email = (c.email || '').toLowerCase();
        const phone = (c.phone || c.mobile || '').toLowerCase();
        return name.includes(q) || email.includes(q) || phone.includes(q);
      })
      .slice(0, limit);
  },

  async warmFromDb(outletId) {
    const db = await openDatabase();
    if (!db) return false;

    const [
      products,
      customers,
      promotions,
      paymentMethods,
      combos,
      taxRates,
    ] = await Promise.all([
      getAllFromStore(db, STORES.products),
      getAllFromStore(db, STORES.customers),
      getAllFromStore(db, STORES.promotions),
      getAllFromStore(db, STORES.paymentMethods),
      getAllFromStore(db, STORES.combos),
      getAllFromStore(db, STORES.taxRates),
    ]);

    const oid = outletId != null ? Number(outletId) : null;
    const byOutlet = (row) =>
      oid == null || row.outletId == null || Number(row.outletId) === oid;

    applyMemoryCatalog({
      outletId: oid,
      products: oid == null ? products : products.filter(byOutlet),
      // Customers are global on purpose — the sell Add Customer search must find
      // every customer regardless of the register's outlet (reference parity).
      customers,
      promotions: oid == null ? promotions : promotions.filter(byOutlet),
      paymentMethods,
      combos,
      taxRates,
    });
    return cache.ready;
  },

  /** All combos from memory as a flat array. */
  getCombos() {
    return Object.values(cache.combosById);
  },

  // ─── Generic page-cache helpers ─────────────────────────────────────────────

  /**
   * Read every record from any named store.
   * Falls back to [] when IndexedDB is unavailable.
   */
  async getStoreAll(storeName) {
    const db = await openDatabase();
    if (!db) return [];
    try {
      return await getAllFromStore(db, storeName);
    } catch {
      return [];
    }
  },

  /**
   * Upsert an array of records into a named store and stamp the meta clock.
   * Clears the store first so stale records don't linger.
   */
  async putStoreAll(storeName, items) {
    if (!Array.isArray(items)) return;
    const db = await openDatabase();
    if (!db) return;

    const tx = db.transaction([storeName, STORES.meta], 'readwrite');
    tx.objectStore(storeName).clear();
    items.forEach((item) => {
      if (item != null) tx.objectStore(storeName).put(item);
    });
    tx.objectStore(STORES.meta).put({
      key: `store:${storeName}:updatedAt`,
      value: Date.now(),
    });
    await txDone(tx);
  },

  /**
   * Returns true when the store has never been populated or was last written
   * more than maxAgeMs milliseconds ago.
   */
  async isStoreStale(storeName, maxAgeMs = 5 * 60 * 1000) {
    const db = await openDatabase();
    if (!db) return true;
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.meta, 'readonly');
      const req = tx.objectStore(STORES.meta).get(`store:${storeName}:updatedAt`);
      req.onsuccess = () => {
        const record = req.result;
        if (!record) return resolve(true);
        resolve(Date.now() - record.value > maxAgeMs);
      };
      req.onerror = () => resolve(true);
    });
  },

  /**
   * Upsert a single item into a named store and stamp the meta clock.
   * Unlike putStoreAll, this does NOT clear existing records — useful for
   * stores that hold multiple independent records keyed differently (e.g.
   * per-outlet dashboard layouts).
   */
  async putStoreItem(storeName, item) {
    if (!item) return;
    const db = await openDatabase();
    if (!db) return;
    const tx = db.transaction([storeName, STORES.meta], 'readwrite');
    tx.objectStore(storeName).put(item);
    tx.objectStore(STORES.meta).put({
      key: `store:${storeName}:updatedAt`,
      value: Date.now(),
    });
    await txDone(tx);
  },

  /**
   * Clear a store and remove its freshness timestamp so the next consumer
   * knows it must re-fetch. Call this after a mutation (create / update / delete).
   */
  async invalidateStore(storeName) {
    const db = await openDatabase();
    if (!db) return;
    const tx = db.transaction([storeName, STORES.meta], 'readwrite');
    tx.objectStore(storeName).clear();
    tx.objectStore(STORES.meta).delete(`store:${storeName}:updatedAt`);
    await txDone(tx);
  },

  /**
   * Wipe EVERY store and reset the in-memory catalog. Call on logout and on
   * outlet switch so one outlet's (or one user's) cached data can never bleed
   * into the next. Best-effort: a failure here must never block logout/switch.
   */
  async clearAll() {
    // Reset the in-memory catalog immediately (covers the no-IndexedDB case too).
    applyMemoryCatalog({ outletId: null });
    cache.ready = false;
    const db = await openDatabase();
    if (!db) return;
    const names = Object.values(STORES);
    try {
      const tx = db.transaction(names, 'readwrite');
      names.forEach((name) => {
        try { tx.objectStore(name).clear(); } catch { /* ignore */ }
      });
      await txDone(tx);
    } catch {
      /* ignore — best effort */
    }
  },

  async replaceCatalog({
    outletId,
    products = [],
    customers = [],
    categories = [],
    brands = [],
    families = [],
    promotions = [],
    paymentMethods = [],
    combos = [],
    taxRates = [],
  }) {
    const db = await openDatabase();
    const oid = outletId != null ? Number(outletId) : null;

    if (!db) {
      applyMemoryCatalog({
        outletId: oid,
        products,
        customers,
        promotions,
        paymentMethods,
        combos,
        taxRates,
      });
      return;
    }

    // Only clear POS catalog stores — leave page-cache stores (saleKeySets, classifications) intact
    const catalogStoreNames = [
      STORES.products, STORES.barcodes, STORES.customers, STORES.categories,
      STORES.brands, STORES.families, STORES.promotions, STORES.paymentMethods,
      STORES.combos, STORES.taxRates,
    ];
    for (const name of catalogStoreNames) {
      await clearStore(db, name);
    }

    const storeNames = [...catalogStoreNames, STORES.meta];
    const tx = db.transaction(storeNames, 'readwrite');
    const productStore = tx.objectStore(STORES.products);
    const barcodeStore = tx.objectStore(STORES.barcodes);
    const customerStore = tx.objectStore(STORES.customers);

    products.forEach((p) => {
      productStore.put({ ...p, outletId: p.outletId ?? oid });
      normalizeBarcodeCodes(p.barcodes).forEach((code) => {
        barcodeStore.put({ code, productId: p.id, outletId: oid });
      });
    });

    customers.forEach((c) => {
      customerStore.put({
        ...c,
        name: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
        // Keep the customer's own outletId (null = global) — the roster is
        // synced unscoped, so stamping the register outlet would mislabel rows.
        outletId: c.outletId ?? null,
      });
    });

    promotions.forEach((p) => {
      tx.objectStore(STORES.promotions).put({ ...p, outletId: p.outletId ?? oid });
    });
    paymentMethods.forEach((m) => tx.objectStore(STORES.paymentMethods).put(m));
    taxRates.forEach((t) => tx.objectStore(STORES.taxRates).put(t));

    const productsById = {};
    products.forEach((p) => {
      productsById[p.id] = p;
    });
    combos.forEach((combo) => {
      tx.objectStore(STORES.combos).put(enrichComboItems(combo, productsById));
    });

    categories.forEach((row) => tx.objectStore(STORES.categories).put(row));
    brands.forEach((row) => tx.objectStore(STORES.brands).put(row));
    families.forEach((row) => tx.objectStore(STORES.families).put(row));

    tx.objectStore(STORES.meta).put({
      key: 'catalog',
      outletId: oid,
      productCount: products.length,
      customerCount: customers.length,
      promotionCount: promotions.length,
      updatedAt: Date.now(),
    });

    await txDone(tx);

    applyMemoryCatalog({
      outletId: oid,
      products,
      customers,
      promotions,
      paymentMethods,
      combos,
      taxRates,
    });
  },
};

export default posLocalDb;
