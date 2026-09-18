import React, { useState, useEffect } from 'react';
import {
  Avatar,
  Box,
  IconButton,
  InputAdornment,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Container,
} from '@mui/material';
import {
  VisibilityOutlined as ShowIcon,
  VisibilityOffOutlined as HideIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import settingsService from '../services/settingsService';
import apiClient from '../services/apiClient';
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
  // Setup > Company > Login "Mask Username": the typed username is hidden behind
  // dots like a password. The reference calls this obscurity, not security, and
  // gives it an eye toggle so the operator can check what they typed.
  // How the sign-in screen presents itself comes from the server, because none
  // of the authenticated settings endpoints are reachable yet. The cached copy
  // seeds it so the form does not flicker on a repeat visit.
  const cached = settingsService.getCachedGeneralSettings();
  const [loginConfig, setLoginConfig] = useState({
    signInType: cached.signInType || 'Select user',
    maskUsername: cached.maskUsername === true,
    // 'always' | 'first-login-of-day' | 'never' — see Setup > Company > Login.
    // Seeded strict, so the password box is never missing while the real answer
    // is still in flight.
    passwordMode: 'always',
    users: [],
  });
  const maskUsername = loginConfig.maskUsername;
  // Whether to draw the password box. `passwordMode` only decides how it starts:
  // under "first login of the day" the screen offers a password-less login and
  // the server answers PASSWORD_REQUIRED when that account still owes one today,
  // which flips this on. The server decides; this is only what is shown.
  const [passwordNeeded, setPasswordNeeded] = useState(true);
  const [revealUsername, setRevealUsername] = useState(false);
  // Which user was picked from the list; the password step follows.
  const [pickedUser, setPickedUser] = useState(null);
  const showUserList =
    loginConfig.signInType === 'Select user' && loginConfig.users.length > 0;
  
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

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get('/auth/login-config')
      .then((res) => {
        if (cancelled || !res?.data) return;
        // Anything but the two relaxed modes means "ask for a password", so an
        // unexpected value can only ever be stricter, never weaker.
        const mode =
          res.data.passwordMode === 'never' || res.data.passwordMode === 'first-login-of-day'
            ? res.data.passwordMode
            : 'always';
        setLoginConfig({
          signInType: res.data.signInType || 'Type username',
          maskUsername: res.data.maskUsername === true,
          passwordMode: mode,
          users: Array.isArray(res.data.users) ? res.data.users : [],
        });
        setPasswordNeeded(mode === 'always');
      })
      .catch(() => {
        // Offline or the endpoint is unavailable: the typed form always works.
        if (!cancelled) {
          setLoginConfig((prev) => ({ ...prev, signInType: 'Type username', passwordMode: 'always' }));
          setPasswordNeeded(true);
        }
      });
    return () => { cancelled = true; };
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
    
    if (!credentials.name) {
      setError('Please enter your username');
      return;
    }
    if (passwordNeeded && !credentials.password) {
      setError('Please enter your password');
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

      // The server asks for a password this attempt — the first login of the
      // day for this account. Reveal the box and let them carry straight on
      // rather than treating it as a rejected login.
      if (err.response?.data?.code === 'PASSWORD_REQUIRED') {
        setPasswordNeeded(true);
        setError(errorMessage);
        setErrorDetails('');
        return;
      }

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
            Login
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
            {/* Setup > Company > Login "Login Type = Select user": the reference
                lists the users instead of asking for the name to be typed. Picking
                one fills the username in and moves on to the password — the account
                is still protected by the password, not by the name being secret. */}
            {showUserList ? (
              <>
                {pickedUser ? (
                  /* Reference: the picked user fills the panel — a large centred
                     avatar with the name under it — and the only inputs left are
                     the password and a Cancel that goes back to the list. */
                  <Box sx={{ textAlign: 'center', mt: 3, mb: 3 }}>
                    <Avatar
                      src={pickedUser.avatar || undefined}
                      sx={{ width: 74, height: 74, mx: 'auto', fontSize: 27 }}
                    >
                      {(pickedUser.name || '?').charAt(0).toUpperCase()}
                    </Avatar>
                    <Typography sx={{ mt: 1.5, fontSize: 20, fontWeight: 700 }}>
                      {pickedUser.name}
                    </Typography>
                  </Box>
                ) : (
                  /* The block of rows is centred in the panel, but the rows
                     themselves are not: centring each row separately pushed every
                     avatar to a different x as soon as two names differed in
                     length. One width for the list, avatars flush left inside it,
                     and the column reads straight. */
                  <List
                    disablePadding
                    sx={{
                      maxHeight: 340,
                      overflowY: 'auto',
                      mt: 2,
                      mb: 1,
                      width: 'fit-content',
                      minWidth: 240,
                      maxWidth: '100%',
                      mx: 'auto',
                    }}
                  >
                    {loginConfig.users.map((u, idx) => (
                      <ListItemButton
                        key={u.id}
                        // A rule under every row but the last: the list reads as one
                        // set of equals, with nothing implied about the first name.
                        divider={idx < loginConfig.users.length - 1}
                        onClick={() => {
                          setPickedUser(u);
                          setPasswordNeeded(loginConfig.passwordMode === 'always');
                          handleInputChange('name', u.username || u.name);
                        }}
                        disabled={loading}
                        // Rows are given room to breathe: on a touch register these
                        // are the only targets on the screen, so they can afford it.
                        sx={{
                          gap: 2,
                          py: 2,
                          px: 2,
                          borderRadius: '10px',
                        }}
                      >
                        <Avatar
                          src={u.avatar || undefined}
                          sx={{ width: 48, height: 48, fontSize: 20 }}
                        >
                          {(u.name || '?').charAt(0).toUpperCase()}
                        </Avatar>
                        <ListItemText
                          primary={u.name}
                          primaryTypographyProps={{
                            fontSize: 18,
                            fontWeight: 500,
                            noWrap: true,
                          }}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                )}
              </>
            ) : (
            <TextField
              margin="normal"
              required
              fullWidth
              label="Username"
              // Masked with CSS, NOT type="password": a password-typed username
              // box is a second "password field" to the browser, which autofills
              // the saved password into it — both boxes showed the same dots and
              // the eye toggle revealed an empty username. Text-security keeps
              // the dots without telling the browser this is a password.
              type="text"
              value={credentials.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              autoComplete="username"
              autoFocus
              disabled={loading}
              inputProps={{
                style: maskUsername && !revealUsername ? { WebkitTextSecurity: 'disc' } : undefined,
              }}
              InputProps={
                maskUsername
                  ? {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setRevealUsername((v) => !v)}
                            edge="end"
                            aria-label={revealUsername ? 'Hide username' : 'Show username'}
                            disabled={loading}
                          >
                            {revealUsername ? <ShowIcon /> : <HideIcon />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }
                  : undefined
              }
            />
            )}
            {/* Hidden entirely when the company's Login settings do not ask for
                a password on this attempt. It appears the moment the server says
                one is owed. */}
            {(!showUserList || pickedUser) && passwordNeeded && (
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
              autoFocus={Boolean(pickedUser)}
            />
            )}
            {(!showUserList || pickedUser) && (
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
              {loading ? null : 'Login'}
            </Button>
            )}
            {/* Reference pairs Login with a Cancel that drops back to the list. */}
            {showUserList && pickedUser && (
              <Button
                fullWidth
                variant="outlined"
                onClick={() => {
                  setPickedUser(null);
                  handleInputChange('name', '');
                  handleInputChange('password', '');
                  // Back to what the settings say, so the next user picked is
                  // judged on their own day rather than on this one's challenge.
                  setPasswordNeeded(loginConfig.passwordMode === 'always');
                  setError('');
                  setErrorDetails('');
                }}
                disabled={loading}
                sx={{ mb: 2, height: 48, color: '#404040', borderColor: '#c4c4c4' }}
              >
                Cancel
              </Button>
            )}
          </Box>

        </Paper>
      </Box>
    </Container>
    </>
  );
};

export default Login;
