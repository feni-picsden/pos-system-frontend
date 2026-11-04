import posLocalDb from './posLocalDb';

const DEFAULT_MAX_AGE = 5 * 60 * 1000;

// Lists are outlet-scoped on the server (own outlet + global, or the navbar
// pick), so a cache filled under one outlet is wrong for another. The outlet
// the store was filled for rides along in meta; a different pick = a miss.
const outletKey = () => localStorage.getItem('selectedOutletId') || '';
const META_OUTLET = (storeName) => `store:${storeName}:outlet`;

async function cachedOutlet(storeName) {
  try {
    return await posLocalDb.getMeta(META_OUTLET(storeName));
  } catch {
    return undefined;
  }
}

async function store(storeName, items) {
  await posLocalDb.putStoreAll(storeName, items);
  try {
    await posLocalDb.setMeta(META_OUTLET(storeName), outletKey());
  } catch {
    /* meta is best effort */
  }
}

export async function cachedList(storeName, fetchFn, maxAge = DEFAULT_MAX_AGE) {
  await posLocalDb.init();

  const cached = await posLocalDb.getStoreAll(storeName);
  const sameOutlet = (await cachedOutlet(storeName)) === outletKey();
  const fresh = cached.length > 0 && sameOutlet && !(await posLocalDb.isStoreStale(storeName, maxAge));
  if (fresh) return cached;

  // Stale, empty or another outlet's: fetch first. Returning the stale copy and
  // refreshing in the background left pages (Product Utilities' Category list)
  // showing an old list with no way to learn the new one had landed. The old
  // copy is only a fallback when the fetch fails (offline).
  try {
    const items = await fetchFn();
    const list = Array.isArray(items) ? items : [];
    if (list.length > 0) await store(storeName, list);
    return list;
  } catch (err) {
    if (cached.length > 0 && sameOutlet) return cached;
    throw err;
  }
}

export default cachedList;
