import React from 'react';
import { Box, Typography, Button, Dialog, DialogContent, DialogActions } from '@mui/material';

// Unsaved-changes prompt shared by the Receipt and Statement editors — the
// reference's own shape: '?' badge, title "Save", body `Save "<name>"?`, and three
// equal buttons Yes (blue, saves) / No (red, discards) / Cancel (grey, stays), all
// disabled while the save runs (measured 2026-08-06).
const SavePromptDialog = ({ open, name, saving, onYes, onNo, onCancel }) => (
  <Dialog
    open={open}
    onClose={() => { if (!saving) onCancel(); }}
    PaperProps={{ sx: { borderRadius: 0, width: 491, maxWidth: '92vw', overflow: 'visible', position: 'relative', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' } }}
  >
    {/* Same family as Confirm Clone: '?' badge over the top edge */}
    <Box sx={{
      position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)',
      width: 56, height: 56, borderRadius: '50%', bgcolor: '#1c86f2',
      display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    }}>
      <Typography sx={{ color: '#fff', fontSize: 30, fontWeight: 700, lineHeight: 1 }}>?</Typography>
    </Box>
    <Typography sx={{ textAlign: 'center', color: '#000', fontWeight: 700, fontSize: 20, pt: 4.5, pb: 0.5, px: 3 }}>
      Save
    </Typography>
    <DialogContent sx={{ px: 3, pt: 1.5, pb: 2.5 }}>
      <Typography sx={{ fontSize: 16, color: '#000', textAlign: 'center', wordBreak: 'break-word' }}>
        Save &quot;{name}&quot;?
      </Typography>
    </DialogContent>
    <DialogActions sx={{
      px: 3, pb: 2.5, pt: 0, gap: 2, '& > :not(style) ~ :not(style)': { ml: 0 },
      '& .MuiButton-root': { flex: 1, height: 48, borderRadius: 0, textTransform: 'none', boxShadow: 'none', fontWeight: 400, fontSize: 22 },
      '& .MuiButton-root:hover': { boxShadow: 'none' },
    }}>
      <Button
        variant="contained"
        onClick={onYes}
        disabled={saving}
        sx={{ bgcolor: '#1c86f2', color: '#fff', '&:hover': { bgcolor: '#1670d0' }, '&.Mui-disabled': { bgcolor: '#8fc2f8', color: '#fff' } }}
      >
        {saving ? 'Saving...' : 'Yes'}
      </Button>
      <Button
        variant="contained"
        onClick={onNo}
        disabled={saving}
        sx={{ bgcolor: '#e3342f', color: '#fff', '&:hover': { bgcolor: '#cc2f2a' }, '&.Mui-disabled': { bgcolor: '#f0a3a1', color: '#fff' } }}
      >
        No
      </Button>
      <Button
        onClick={onCancel}
        disabled={saving}
        sx={{ bgcolor: '#f8f8f8', color: '#676b72', border: '1px solid #9e9e9e', '&:hover': { bgcolor: '#e9e9e9' } }}
      >
        Cancel
      </Button>
    </DialogActions>
  </Dialog>
);

export default SavePromptDialog;
