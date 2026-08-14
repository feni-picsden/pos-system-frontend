import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AccessDenied from './AccessDenied';
import PageLoader from '../Common/PageLoader';

const ProtectedRoute = ({ children, requireSuperAdmin = false, requireRole = null }) => {
  const { isAuthenticated, isSuperAdmin, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <PageLoader message="Signing in..." />;
  }

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireSuperAdmin && !isSuperAdmin()) {
    return <AccessDenied message="Only admin can access users" requiredRole="Admin" />;
  }

  if (requireRole) {
    const hasRequiredRole = user?.role === requireRole || (requireRole === 'admin' && user?.hasAllPermission);
    if (!hasRequiredRole) {
      return <AccessDenied message={`Only ${requireRole} can access this page`} requiredRole={requireRole} />;
    }
  }

  return children;
};

export default ProtectedRoute;
