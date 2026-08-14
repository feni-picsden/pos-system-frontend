import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, Typography, Paper, Button } from '@mui/material';
import { Lock as LockIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { usePermissions } from '../../hooks/usePermissions';
import PageLoader from '../Common/PageLoader';

const PermissionProtectedRoute = ({ 
  requiredPermissions = [], 
  requiredAllPermissions = [],
  children,
  fallback = null,
  redirectTo = null
}) => {
  const { hasAnyPermission, hasAllPermissions, user, loading } = usePermissions();
  const location = useLocation();

  if (loading) {
    return <PageLoader message="Loading permissions..." />;
  }

  let hasAccess = true;

  if (user?.hasAllPermission) {
    hasAccess = true;
  } else {
    if (requiredPermissions.length > 0) {
      hasAccess = hasAnyPermission(requiredPermissions);
    }
    
    if (hasAccess && requiredAllPermissions.length > 0) {
      hasAccess = hasAllPermissions(requiredAllPermissions);
    }
  }

  if (!hasAccess) {
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }

    if (fallback) {
      return fallback;
    }

    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#f5f5f5',
        p: 3
      }}>
        <Paper sx={{ 
          p: 4, 
          textAlign: 'center', 
          maxWidth: 500,
          borderRadius: 2,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}>
          <LockIcon sx={{ 
            fontSize: 80, 
            color: '#ff5722', 
            mb: 2 
          }} />
          
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: '#333' }}>
            Access Denied
          </Typography>
          
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            You don't have permission to access this page.
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Required permissions: {[...requiredPermissions, ...requiredAllPermissions].join(', ')}
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              variant="contained"
              startIcon={<ArrowBackIcon />}
              onClick={() => window.history.back()}
              sx={{
                backgroundColor: '#4fc3f7',
                '&:hover': {
                  backgroundColor: '#29b6f6',
                }
              }}
            >
              Go Back
            </Button>
            
            <Button
              variant="outlined"
              onClick={() => window.location.href = '/'}
              sx={{
                borderColor: '#4fc3f7',
                color: '#4fc3f7',
                '&:hover': {
                  borderColor: '#29b6f6',
                  backgroundColor: 'rgba(79, 195, 247, 0.04)',
                }
              }}
            >
              Dashboard
            </Button>
          </Box>
          
          <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: 'block' }}>
            Contact your administrator if you believe this is an error.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return children;
};

export default PermissionProtectedRoute;
