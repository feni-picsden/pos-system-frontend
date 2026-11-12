import React from 'react';
import { Box, Typography, Button, Dialog, SvgIcon } from '@mui/material';
import { HelpOutline as HelpIcon } from '@mui/icons-material';

// Shopfront "Media Centre" components shared by the full page (Marketing/Media.jsx)
// and the picker dialog (Common/MediaDialog.jsx). Styles / helpers live in
// mediaCentreUi.js - this file only exports components (react-refresh rule).

// Thin-line "fal fa-sort-amount-up" / "fal fa-sort-amount-down": the arrow flips
// with the sort direction so the current direction is always readable.
export const SortAmountIcon = ({ up, ...props }) => (
  <SvgIcon viewBox="0 0 24 24" {...props}>
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      d={
        up
          ? 'M6 20V4.5M2.5 8L6 4.5 9.5 8M13 5.5h8M13 11.5h6M13 17.5h4'
          : 'M6 4v15.5M2.5 16L6 19.5 9.5 16M13 5.5h8M13 11.5h6M13 17.5h4'
      }
    />
  </SvgIcon>
);

/**
 * Shopfront ".question.show-frame" modal: a centred 289px card with a blue
 * circular question badge overhanging the top edge.
 * Declared at module scope so the input keeps focus between keystrokes.
 */
// busy: the request is on its way - both buttons and Enter are off, so a
// double click cannot send it twice
export const QuestionDialog = ({ open, title, body, value, onChange, onCancel, onConfirm, confirmText, confirmDisabled = false, busy = false }) => (
  <Dialog
    open={open}
    onClose={busy ? undefined : onCancel}
    transitionDuration={0}
    PaperProps={{
      sx: {
        width: 289,
        maxWidth: '92vw',
        borderRadius: 0,
        boxShadow: '0 0 30px rgba(0,0,0,0.25)',
        overflow: 'visible',
        mt: '48px',
      },
    }}
  >
    <Box
      sx={{
        position: 'absolute',
        top: -48,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 96,
        height: 96,
        borderRadius: '50%',
        bgcolor: '#1c86f2',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <HelpIcon sx={{ fontSize: 56, color: '#f8f8f8' }} />
    </Box>
    <Box sx={{ pt: '60px', px: 2, pb: 2, textAlign: 'center' }}>
      <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#313439', mb: 1 }}>{title}</Typography>
      <Typography sx={{ fontSize: 14, color: '#676b72', mb: 2 }}>{body}</Typography>
      <Box
        component="input"
        autoFocus
        value={value}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !confirmDisabled && !busy) onConfirm();
        }}
        sx={{
          width: 257,
          maxWidth: '100%',
          height: 53,
          border: '1px solid #000000',
          borderRadius: 0,
          fontSize: 16,
          fontFamily: 'inherit',
          px: 1.5,
          boxSizing: 'border-box',
          outline: 'none',
        }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, mt: 2 }}>
        <Button
          onClick={onCancel}
          disabled={busy}
          sx={{
            width: 121,
            height: 48,
            borderRadius: 0,
            bgcolor: '#f8f8f8',
            color: '#676b72',
            border: '1px solid #676b72',
            textTransform: 'none',
            fontSize: 16,
            boxShadow: 'none',
            '&:hover': { bgcolor: '#f8f8f8', boxShadow: 'none' },
            '&.Mui-disabled': {
              bgcolor: '#f8f8f8',
              color: '#b3b3b3',
              border: '1px solid #676b72',
            },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={confirmDisabled || busy}
          variant="contained"
          sx={{
            width: 121,
            height: 48,
            borderRadius: 0,
            bgcolor: '#32b643',
            color: '#f8f8f8',
            textTransform: 'none',
            fontSize: 16,
            boxShadow: 'none',
            '&:hover': { bgcolor: '#32b643', boxShadow: 'none' },
            '&.Mui-disabled': {
              bgcolor: '#e0e0e0',
              color: '#a6a6a6',
              boxShadow: 'none',
            },
          }}
        >
          {busy ? `${confirmText}...` : confirmText}
        </Button>
      </Box>
    </Box>
  </Dialog>
);
