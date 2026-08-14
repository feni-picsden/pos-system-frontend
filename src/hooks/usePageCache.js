import { useState, useEffect, useCallback, useRef } from 'react';
import posLocalDb from '../services/posLocalDb';

const DEFAULT_MAX_AGE = 5 * 60 * 1000; // 5 minutes

/**
 * Stale-while-revalidate hook backed by IndexedDB.
 *
 * Usage:
 *   const { data, loading, syncing, refresh } = usePageCache(
 *     'saleKeySets',
 *     () => saleKeyService.getSaleKeySets(outletId).then(r => r.saleKeySets || []),
 *     { maxAge: 5 * 60 * 1000, deps: [outletId] }
 *   );
 *
 * Behaviour:
 *  1. On mount: read IndexedDB → set `data` immediately (fast render, no spinner).
 *  2. If data is stale or empty: call `fetchFn` in the background, update IDB + state.
 *  3. When deps change: re-run the full load cycle.
 *
 * @param {string}   storeName   IndexedDB object-store name (must exist in posLocalDb).
 * @param {function} fetchFn     Async function that returns the fresh array from the API.
 * @param {object}   [options]
 * @param {number}   [options.maxAge=300000]   Freshness window in ms (default 5 min).
 * @param {function} [options.transform]       Map raw API response → array before storing.
 * @param {Array}    [options.deps=[]]         Extra values that trigger a full reload.
 */
export function usePageCache(storeName, fetchFn, {
  maxAge = DEFAULT_MAX_AGE,
  transform = null,
  deps = [],
} = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const mountedRef = useRef(true);
  // Keep a stable ref so we can call the latest fetchFn without it being a dep
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const doSync = useCallback(
    async (silent = false) => {
      if (!silent) setSyncing(true);
      try {
        const raw = await fetchRef.current();
        const items = transformRef.current ? transformRef.current(raw) : (Array.isArray(raw) ? raw : []);
        await posLocalDb.putStoreAll(storeName, items);
        if (mountedRef.current) setData([...items]);
      } catch (err) {
        console.warn(`[usePageCache] sync failed for "${storeName}":`, err);
      } finally {
        if (!silent && mountedRef.current) setSyncing(false);
      }
    },
    [storeName]
  );

  useEffect(() => {
    mountedRef.current = true;

    async function load() {
      await posLocalDb.init();

      // 1. Serve cached data immediately — no loading spinner for the user
      const cached = await posLocalDb.getStoreAll(storeName);
      if (mountedRef.current && cached.length > 0) {
        setData(cached);
        setLoading(false);
      }

      // 2. Refresh from API if data is stale or missing
      const stale = await posLocalDb.isStoreStale(storeName, maxAge);
      if (stale || cached.length === 0) {
        // silent=true means we already have data showing — no syncing spinner
        await doSync(cached.length > 0);
      }

      if (mountedRef.current) setLoading(false);
    }

    load();

    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeName, maxAge, doSync, ...deps]);

  /** Force a fresh API fetch, update IDB, and refresh state. */
  const refresh = useCallback(async () => {
    setSyncing(true);
    await doSync(false);
  }, [doSync]);

  /**
   * Optimistically patch the cached list (e.g. drop a row the user just deleted)
   * so the UI reacts immediately instead of waiting for the network round-trip.
   * Accepts a next array or an updater. IDB is rewritten by the following sync.
   */
  const mutate = useCallback((next) => {
    setData((prev) => (typeof next === 'function' ? next(prev ?? []) : next));
  }, []);

  return {
    data: data ?? [],
    loading,
    syncing,
    refresh,
    mutate,
  };
}

export default usePageCache;
