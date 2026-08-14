import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSelectedOutlet } from '../contexts/SelectedOutletContext';
import { warmAppCache, syncAppDataInBackground } from '../services/appDataSync';

/**
 * Warms IndexedDB → memory on login, then silently refreshes catalog in background.
 * Renders nothing.
 */
export default function AppDataSync() {
  const { user, loading: authLoading } = useAuth();
  const { selectedOutletId, isSuperAdmin } = useSelectedOutlet();
  const lastKeyRef = useRef('');

  useEffect(() => {
    if (authLoading || !user) return;

    const outletId =
      isSuperAdmin && selectedOutletId != null
        ? selectedOutletId
        : user.outletId ?? selectedOutletId ?? null;

    const key = `${user.id}:${outletId ?? 'all'}`;
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    let cancelled = false;

    (async () => {
      try {
        await warmAppCache(outletId);
        if (!cancelled) {
          syncAppDataInBackground(outletId).catch(() => {});
        }
      } catch (err) {
        console.warn('[AppDataSync] warm failed:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, selectedOutletId, isSuperAdmin]);

  return null;
}
