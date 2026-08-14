import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { outletService } from '../services/outletService';
import posLocalDb from '../services/posLocalDb';
import apiClient from '../services/apiClient';
import { syncAppDataInBackground } from '../services/appDataSync';

const SelectedOutletContext = createContext({
  outlets: [],
  selectedOutletId: null,
  selectedOutlet: null,
  setSelectedOutletId: () => {},
  isAllOutlets: true,
});

export const useSelectedOutlet = () => useContext(SelectedOutletContext);

const LS_KEY = 'selectedOutletId';

export const SelectedOutletProvider = ({ children, user, switchOutlet }) => {
  const [outlets, setOutlets] = useState([]);
  const [selectedOutletId, setSelectedOutletIdState] = useState(null);

  // Global "all outlets" access requires all-permission/superadmin AND no pinned
  // outlet (outletId null) — matches the backend's canAccessAllOutlets. An outlet
  // admin (hasAllPermission WITH a non-null outletId) is scoped to that one outlet,
  // so they get their outlet's name in the navbar, not the "All Outlets" switcher.
  const isSuperAdmin =
    (user?.isSuperAdmin === true || user?.hasAllPermission === true) &&
    user?.outletId == null;

  // Dropping a stale cross-outlet register used to live here, racing
  // SelectedRegisterContext's hydration (it edited localStorage behind the
  // provider's back). It is now that provider's own effect — same list() call,
  // one owner of both the keys and the in-memory copy.

  // Load available outlets when user changes
  useEffect(() => {
    if (!user) {
      setOutlets([]);
      setSelectedOutletIdState(null);
      return;
    }

    const loadOutlets = async () => {
      try {
        if (isSuperAdmin) {
          await posLocalDb.init();
          const cached = await posLocalDb.getStoreAll('outlets');
          if (cached.length > 0) {
            setOutlets(cached);
          }

          const resp = await outletService.getAllOutlets();
          const all = resp.outlets || [];
          setOutlets(all);
          if (all.length > 0) {
            await posLocalDb.putStoreAll('outlets', all);
          }

          const saved = localStorage.getItem(LS_KEY);
          const savedId = saved ? parseInt(saved, 10) : null;
          if (savedId && all.find((o) => o.id === savedId)) {
            setSelectedOutletIdState(savedId);
          } else {
            setSelectedOutletIdState(null);
          }
        } else {
          // Regular user - use their assignedOutlets (if multi-outlet)
          const assigned = user.assignedOutlets || [];
          if (assigned.length > 0) {
            setOutlets(assigned);
          } else if (user.outlet) {
            setOutlets([user.outlet]);
          } else {
            setOutlets([]);
          }
          // For regular users selected outlet = their current session outlet
          setSelectedOutletIdState(user.outletId || null);
        }
      } catch (err) {
        console.error('SelectedOutletContext: failed to load outlets', err);
      }
    };

    loadOutlets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isSuperAdmin]);

  const setSelectedOutletId = useCallback(
    async (id) => {
      const next = id == null ? null : parseInt(id, 10);
      // Two calls that change nothing but used to fall through to clearAll():
      // re-picking the outlet you are already in, and a non-superadmin choosing
      // "Not at an Outlet" (there is no global session to switch to). Both wiped
      // the local catalog while leaving selectedOutletId untouched — and nothing
      // re-warms the cache unless that id changes.
      if (next === selectedOutletId || (!isSuperAdmin && next == null)) return;
      // No switchOutlet to call = nothing would change, so don't wipe the catalog.
      if (!isSuperAdmin && !switchOutlet) return;
      // Wipe cached catalog/page data so the previously selected outlet's
      // records can never be shown under the newly selected outlet. The
      // in-memory GET cache goes too: its key is only salted with the outlet id
      // for superadmins, so a regular user's switch would replay the old
      // outlet's rows for the 2-minute TTL.
      try { await posLocalDb.clearAll(); } catch { /* best effort */ }
      apiClient.bustCache('');
      if (isSuperAdmin) {
        // Super admin: just change the filter, persist to localStorage
        setSelectedOutletIdState(next);
        if (next == null) {
          localStorage.removeItem(LS_KEY);
        } else {
          localStorage.setItem(LS_KEY, String(next));
        }
      } else {
        // Regular user: actually switch outlet session
        try {
          await switchOutlet(next);
          setSelectedOutletIdState(next);
        } catch (err) {
          console.error('SelectedOutletContext: switchOutlet failed', err);
          // The catalog was wiped above but selectedOutletId never moved, so
          // AppDataSync's key doesn't change and nothing re-warms. Refill for
          // the outlet we are still in.
          syncAppDataInBackground(selectedOutletId, { force: true }).catch(() => {});
        }
      }
      // A register belonging to the outlet we just left is dropped by
      // SelectedRegisterContext's hydration effect, which re-runs on this id.
    },
    [isSuperAdmin, switchOutlet, selectedOutletId]
  );

  const selectedOutlet = outlets.find((o) => o.id === selectedOutletId) || null;
  const isAllOutlets = isSuperAdmin && selectedOutletId == null;

  return (
    <SelectedOutletContext.Provider
      value={{
        outlets,
        selectedOutletId,
        selectedOutlet,
        setSelectedOutletId,
        isAllOutlets,
        isSuperAdmin,
      }}
    >
      {children}
    </SelectedOutletContext.Provider>
  );
};
