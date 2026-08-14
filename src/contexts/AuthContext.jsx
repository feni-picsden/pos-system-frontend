import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';

// Provide safe defaults so consumers never see undefined functions
const AuthContext = createContext({
  user: null,
  login: async () => {},
  logout: async () => {},
  switchOutlet: async () => {},
  isAuthenticated: () => false,
  isSuperAdmin: () => false,
  isOutletAdmin: () => false,
  hasRole: () => false,
  isAdmin: () => false,
  loading: false,
  getOutletId: () => null,
  getOutletName: () => null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (authService.isAuthenticated()) {
          // Validate session with server
          const profileResponse = await authService.getProfile();
          setUser(profileResponse.user);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        const status = error?.response?.status;
        if (status === 401 || status === 403) {
          // The server rejected the session: it really is gone.
          await authService.logout();
          setUser(null);
        } else {
          // Network failure or 5xx (e.g. the backend restarting) says nothing about
          // the session. Logging out here would clear sessionToken server-side and
          // turn a few seconds of downtime into a forced re-login, so keep the
          // cached user and let the next request re-validate.
          try {
            const cached = localStorage.getItem('user');
            if (cached) setUser(JSON.parse(cached));
          } catch { /* ignore a corrupt cache */ }
        }
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async (credentials) => {
    try {
      const response = await authService.login(credentials);
      setUser(response.user);
      return response;
    } catch (error) {
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const switchOutlet = useCallback(async (outletId) => {
    const response = await authService.switchOutlet(outletId);
    setUser(response.user);
    return response;
  }, []);

  const isAuthenticated = useCallback(() => {
    return !!user && authService.isAuthenticated();
  }, [user]);

  const isSuperAdmin = useCallback(() => {
    // Treat any user with hasAllPermission as super admin in the UI
    return user?.isSuperAdmin === true || user?.hasAllPermission === true;
  }, [user]);

  const isOutletAdmin = useCallback(() => {
    // Outlet admin: hasAllPermission = true AND outletId is not null
    return user?.hasAllPermission && user?.outletId !== null;
  }, [user]);

  const hasRole = useCallback((role) => {
    return user?.role === role || false;
  }, [user]);

  const isAdmin = useCallback(() => {
    return user?.role === 'admin' || user?.hasAllPermission || false;
  }, [user]);

  const getOutletId = useCallback(() => {
    return user?.outletId || null;
  }, [user]);

  const getOutletName = useCallback(() => {
    return user?.outlet?.name || null;
  }, [user]);

  const value = {
    user,
    login,
    logout,
     switchOutlet,
    isAuthenticated,
    isSuperAdmin,
    isOutletAdmin,
    hasRole,
    isAdmin,
    loading,
    getOutletId,
    getOutletName,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
