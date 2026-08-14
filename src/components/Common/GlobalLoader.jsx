import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

const containerStyle = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 9999,
  background: 'rgba(255, 255, 255, 0.95)',
  border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: 12,
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
  backdropFilter: 'blur(10px)',
};

export default function GlobalLoader() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onLoading = (e) => setActive(Boolean(e.detail?.overlayActive));
    window.addEventListener('global-loading', onLoading);
    return () => window.removeEventListener('global-loading', onLoading);
  }, []);

  if (!active) return null;

  return (
    <Box
      style={containerStyle}
      data-allow-animation="true"
      aria-live="polite"
      aria-busy="true"
    >
      <CircularProgress size={40} sx={{ color: '#6a5acd' }} />
      <Typography sx={{ mt: 1.5, fontSize: 14, color: '#6a5acd', fontWeight: 500 }}>
        Loading...
      </Typography>
    </Box>
  );
}
