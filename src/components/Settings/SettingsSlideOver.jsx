import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

// Right-side fixed slide-over panel used on Setup > General for
// (a) "More Info..." field help (~424px) and (b) "Edit Reasons" (~768px, wide).
// header={false} skips the title bar + X close (the reference Edit Reasons
// panel has no X - exactly its own three buttons) and lets children own the
// full-height layout.
const SettingsSlideOver = ({ open, wide, title, onClose, header = true, children }) => (
  <>
    {open && (
      <Box
        onClick={onClose}
        sx={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 1299 }}
      />
    )}
    <Box
      sx={{
        position: 'fixed', top: 0, right: 0, height: '100vh',
        width: wide ? 768 : 424, maxWidth: '100vw',
        backgroundColor: '#fff', boxShadow: '-4px 0 16px rgba(0,0,0,0.2)', zIndex: 1300,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 200ms ease',
        display: 'flex', flexDirection: 'column'
      }}
    >
      {header ? (
        <>
          <Box
            sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              p: 2, borderBottom: '1px solid #e5e5e5'
            }}
          >
            <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#000' }}>{title}</Typography>
            <IconButton aria-label="Close" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
          <Box sx={{ p: 2, overflowY: 'auto', fontSize: 16, color: '#000', whiteSpace: 'pre-wrap' }}>
            {children}
          </Box>
        </>
      ) : children}
    </Box>
  </>
);

export default SettingsSlideOver;
