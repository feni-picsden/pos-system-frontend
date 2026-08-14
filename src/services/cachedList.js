import posLocalDb from './posLocalDb';

const DEFAULT_MAX_AGE = 5 * 60 * 1000;

export async function cachedList(storeName, fetchFn, maxAge = DEFAULT_MAX_AGE) {
  await posLocalDb.init();

  const cached = await posLocalDb.getStoreAll(storeName);
  if (cached.length > 0) {
    if (await posLocalDb.isStoreStale(storeName, maxAge)) {
      // Fire-and-forget: this render already has data to show.
      Promise.resolve()
        .then(fetchFn)
        .then((items) => {
          if (Array.isArray(items) && items.length > 0) {
            return posLocalDb.putStoreAll(storeName, items);
          }
          return undefined;
        })
        .catch(() => {});
    }
    return cached;
  }

  const items = await fetchFn();
  const list = Array.isArray(items) ? items : [];
  if (list.length > 0) await posLocalDb.putStoreAll(storeName, list);
  return list;
}

export default cachedList;
