import React from 'react';
import { Alert, Box, Snackbar } from '@mui/material';

export default function FamilyOverrideToast({ open, familyName, onOverride, onClose }) {
  return (
    <Snackbar open={open} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert severity="warning" onClose={onClose} sx={{ width: '100%', boxShadow: 3 }}>
        Family{familyName ? ` "${familyName}"` : ''} has been selected.{' '}
        <Box component="button" type="button" onClick={onOverride}
          sx={{ p: 0, border: 0, bgcolor: 'transparent', color: 'inherit', font: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}>
          Click to override with the family&apos;s prices and tax rate.
        </Box>
      </Alert>
    </Snackbar>
  );
}
