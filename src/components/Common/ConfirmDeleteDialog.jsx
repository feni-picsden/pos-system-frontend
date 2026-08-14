import React from 'react';
import { Dialog, DialogContent, DialogActions, Button, Box, Typography } from '@mui/material';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';

/**
 * Delete-confirmation modal matching the Shopfront reference:
 *  - light-red header (#fde8e8) with a red "!" and a bold red title
 *  - flat #f8f8f8 body with the message, square corners, 1px black border (reference #dialog)
 *  - grey Cancel + red Delete buttons, bottom-right
 *
 * Props: open, title, message, confirmText, cancelText, loading, onCancel, onConfirm
 */
const ConfirmDeleteDialog = ({
  open,
  title = 'Delete',
  message,
  confirmText = 'Delete',
  loadingText = 'Deleting...',
  cancelText = 'Cancel',
  loading = false,
  onCancel,
  onConfirm,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      PaperProps={{
        elevation: 0,
        // reference #dialog chrome: flat light surface, hairline black border, no MUI elevation
        sx: {
          width: 440,
          maxWidth: '92vw',
          overflow: 'hidden',
          bgcolor: '#f8f8f8',
          borderRadius: 0,
          border: '1px solid #000',
          boxShadow: '0 0 30px 0 rgba(0,0,0,.25), 0 15px 30px 0 rgba(0,0,0,.19)',
          transition: 'none',
        },
      }}
    >
      <Box
        sx={{
          bgcolor: '#fde8e8',
          px: 3,
          py: 1.75,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <PriorityHighIcon sx={{ color: '#e33430', fontSize: 22 }} />
        <Typography sx={{ color: '#e33430', fontWeight: 700, fontSize: 18 }}>{title}</Typography>
      </Box>

      <DialogContent sx={{ px: 3, py: 2.5 }}>
        <Typography sx={{ color: '#313439', fontSize: 16 }}>{message}</Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 0, gap: 1.25 }}>
        <Button
          onClick={onCancel}
          disableElevation
          sx={{
            bgcolor: '#8a8d91',
            color: '#fff',
            textTransform: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            px: 3,
            '&:hover': { bgcolor: '#76797d' },
          }}
        >
          {cancelText}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loading}
          disableElevation
          sx={{
            bgcolor: '#e33430',
            color: '#fff',
            textTransform: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            px: 3,
            '&:hover': { bgcolor: '#cc2f2a' },
          }}
        >
          {loading ? loadingText : confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDeleteDialog;
