import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Container,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';
import { TopProgressBar } from '../components/Common/GlobalTopBar';

const Login = () => {
  const [credentials, setCredentials] = useState({
    name: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorDetails, setErrorDetails] = useState('');
  const [sessionExpiredMsg, setSessionExpiredMsg] = useState('');
  
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Check for session expired message on mount
  useEffect(() => {
    const sessionExpiredMessage = sessionStorage.getItem('sessionExpired');
    if (sessionExpiredMessage) {
      setSessionExpiredMsg(sessionExpiredMessage);
      sessionStorage.removeItem('sessionExpired');
    }
  }, []);

  // Already signed in: /login is nothing to show them. Wait for the session
  // check to settle first, otherwise this bounces before auth has restored.
  if (!authLoading && isAuthenticated()) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleInputChange = (field, value) => {
    setCredentials(prev => ({
      ...prev,
      [field]: value
    }));
    setError(''); // Clear error when user types
    setErrorDetails(''); // Clear error details
    setSessionExpiredMsg(''); // Clear session expired message
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!credentials.name || !credentials.password) {
      setError('Please enter both name and password');
      return;
    }

    setLoading(true);
    setError('');
    setErrorDetails('');

    try {
      await login(credentials);
      navigate('/'); // Redirect to dashboard
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Login failed';
      const errorDetails = err.response?.data?.message || '';
      
      setError(errorMessage);
      if (errorDetails) {
        setErrorDetails(errorDetails);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <TopProgressBar variant="viewport" />
      <Container maxWidth="sm">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            padding: 4,
            width: '100%',
            maxWidth: 400,
            borderRadius: 2,
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            align="center"
            sx={{ mb: 3, fontWeight: 'bold', color: '#1976d2' }}
          >
            POS System
          </Typography>

          <Typography
            variant="h6"
            component="h2"
            align="center"
            sx={{ mb: 3, color: 'text.secondary' }}
          >
            Sign In
          </Typography>

          {sessionExpiredMsg && (
            <Alert 
              severity="warning" 
              sx={{ mb: 2 }}
            >
              <Typography variant="body2">
                {sessionExpiredMsg}
              </Typography>
            </Alert>
          )}

          {error && (
            <Alert 
              severity="error" 
              sx={{ mb: 2 }}
              title={errorDetails}
            >
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {error}
              </Typography>
              {errorDetails && (
                <Typography variant="body2" sx={{ mt: 1, fontSize: '0.875rem' }}>
                  {errorDetails}
                </Typography>
              )}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              label="Name"
              value={credentials.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              autoComplete="username"
              autoFocus
              disabled={loading}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              label="Password"
              type="password"
              value={credentials.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              autoComplete="current-password"
              disabled={loading}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{
                mt: 3,
                mb: 2,
                height: 48,
                backgroundColor: '#4fc3f7',
                '&:hover': {
                  backgroundColor: '#29b6f6',
                },
              }}
              disabled={loading}
            >
              {loading ? null : 'Sign In'}
            </Button>
          </Box>

          <Box sx={{ mt: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary" align="center" display="block">
              Default Super Admin Credentials:
            </Typography>
            <Typography variant="body2" align="center" sx={{ mt: 1 }}>
              <strong>Name:</strong> Super Admin<br />
              <strong>Password:</strong> superadmin123
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
    </>
  );
};

export default Login;
