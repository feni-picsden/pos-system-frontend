import { useState, useEffect, useContext, createContext, useRef } from 'react';
import { permissionService } from '../services/permissionService';
import { useAuth } from '../contexts/AuthContext';

// Create Permission Context
const PermissionContext = createContext();

// Permission Provider Component
export const PermissionProvider = ({ children }) => {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const { isAuthenticated, user: authUser, loading: authLoading } = useAuth();
  // Collapses overlapping loads: the mount effect, the authUser-change effect and
  // the focus/visibility handlers all called /permissions/me, so a single tab
  // focus (which fires BOTH 'focus' and 'visibilitychange') plus an auth refresh
  // fired the request ~5x. One in-flight request is reused instead.
  const inFlight = useRef(null);

  useEffect(() => {
    // Only load permissions if user is authenticated and auth is not loading
    if (!authLoading && isAuthenticated()) {
      loadUserPermissions();
    } else if (!authLoading && !isAuthenticated()) {
      // If not authenticated, reset permissions and stop loading
      setPermissions([]);
      setUser(null);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, authUser]);

  // Nothing else re-reads permissions during a live session, so a role change made
  // elsewhere only landed on a full page reload. Re-read whenever the tab is
  // brought back to the front — cheap, and that's when the user looks at the UI.
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === 'visible' && !authLoading && isAuthenticated()) {
        loadUserPermissions({ quiet: true });
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, authUser]);

  // quiet: refresh in place without flipping `loading`, which would blank the
  // permission-gated routes for a frame on every tab focus.
  const loadUserPermissions = async ({ quiet = false } = {}) => {
    // Reuse an in-flight request instead of firing a duplicate.
    if (inFlight.current) {
      try { await inFlight.current; } catch { /* handled by the owner call */ }
      return;
    }
    try {
      if (!quiet) setLoading(true);
      inFlight.current = permissionService.getCurrentUserPermissions();
      const response = await inFlight.current;
      setPermissions(response.permissions || []);
      setUser(response.user || null);
    } catch (error) {
      console.error('Error loading user permissions:', error);
      // A failed background refresh must not strip permissions the user already
      // has — keep whatever the last successful load produced.
      if (quiet) return;
      // ponytail: /permissions/me is intermittently 500-flaky. Nulling the user
      // spuriously locks out an already-authenticated super-admin (their route
      // guards check user?.hasAllPermission). Fall back to the validated auth
      // user so their profile flags survive; grants no permission the profile
      // itself doesn't carry. Upgrade path: retry/backoff if flakiness persists.
      setPermissions([]);
      setUser(authUser || null);
    } finally {
      inFlight.current = null;
      if (!quiet) setLoading(false);
    }
  };

  const hasPermission = (permission) => {
    if (!permission) return true;
    if (user?.hasAllPermission) return true; // Super admin
    return permissions.includes(permission);
  };

  const hasAnyPermission = (permissionList) => {
    if (!permissionList || permissionList.length === 0) return true;
    if (user?.hasAllPermission) return true; // Super admin
    return permissionList.some(permission => permissions.includes(permission));
  };

  const hasAllPermissions = (permissionList) => {
    if (!permissionList || permissionList.length === 0) return true;
    if (user?.hasAllPermission) return true; // Super admin
    return permissionList.every(permission => permissions.includes(permission));
  };

  const refreshPermissions = () => {
    loadUserPermissions();
  };

  const value = {
    permissions,
    user,
    loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    refreshPermissions,
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};

// Hook to use permissions
export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
};

// Hook for checking a single permission
export const useHasPermission = (permission) => {
  const { hasPermission } = usePermissions();
  return hasPermission(permission);
};

// Hook for checking multiple permissions (any)
export const useHasAnyPermission = (permissions) => {
  const { hasAnyPermission } = usePermissions();
  return hasAnyPermission(permissions);
};

// Hook for checking multiple permissions (all)
export const useHasAllPermissions = (permissions) => {
  const { hasAllPermissions } = usePermissions();
  return hasAllPermissions(permissions);
};
