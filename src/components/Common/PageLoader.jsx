import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * Centered page-level loader for admin/setup screens.
 * Use when loading && no cached content to display yet.
 */
export default function PageLoader({ message = 'Loading...' }) {
  return (
    <Box
      data-allow-animation="true"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        gap: 2,
      }}
      aria-live="polite"
      aria-busy="true"
    >
      <CircularProgress size={44} sx={{ color: '#6a5acd' }} />
      {message && (
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      )}
    </Box>
  );
}
