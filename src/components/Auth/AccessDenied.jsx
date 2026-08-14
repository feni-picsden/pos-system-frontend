import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Container,
  Avatar,
  Alert,
} from '@mui/material';
import {
  Lock as LockIcon,
  Home as HomeIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const AccessDenied = ({ message = "Only admin can access users", requiredRole = "Admin" }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleGoHome = () => {
    navigate('/');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <Container maxWidth="md">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '70vh',
          textAlign: 'center',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            padding: 4,
            width: '100%',
            maxWidth: 500,
            borderRadius: 3,
          }}
        >
          <Avatar
            sx={{
              width: 80,
              height: 80,
              backgroundColor: '#f44336',
              margin: '0 auto 2rem',
            }}
          >
            <LockIcon sx={{ fontSize: 40 }} />
          </Avatar>

          <Typography
            variant="h4"
            component="h1"
            sx={{ mb: 2, fontWeight: 'bold', color: '#333' }}
          >
            Access Denied
          </Typography>

          <Typography
            variant="h6"
            sx={{ mb: 2, color: '#666' }}
          >
            {message}
          </Typography>

          <Alert severity="warning" sx={{ mb: 3, textAlign: 'left' }}>
            <Typography variant="body2">
              <strong>Current User:</strong> {user?.name || 'Unknown'}<br />
              <strong>Current Role:</strong> {user?.role === 'admin' ? 'Admin' : user?.role === 'manager' ? 'Manager' : 'User'}<br />
              <strong>Required Role:</strong> {requiredRole}
            </Typography>
          </Alert>

          <Typography
            variant="body1"
            sx={{ mb: 4, color: '#777' }}
          >
            You don't have the necessary permissions to access this page. 
            Please contact your administrator if you believe this is an error.
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={handleGoBack}
              sx={{
                borderColor: '#1976d2',
                color: '#1976d2',
                '&:hover': {
                  borderColor: '#1565c0',
                  backgroundColor: '#f5f5f5',
                },
              }}
            >
              Go Back
            </Button>
            <Button
              variant="contained"
              startIcon={<HomeIcon />}
              onClick={handleGoHome}
              sx={{
                backgroundColor: '#1976d2',
                '&:hover': {
                  backgroundColor: '#1565c0',
                },
              }}
            >
              Go to Dashboard
            </Button>
          </Box>

          <Box sx={{ mt: 3, p: 2, backgroundColor: '#f5f5f5', borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Need access? Contact your system administrator to upgrade your account permissions.
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default AccessDenied;
