import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
} from '@mui/material';
import { CreditCard as CardIcon } from '@mui/icons-material';
import tyroService from '../../services/tyroService';

// Tyro terminal pairing (reference art. 360020096032): the pairing screen
// appears the first time a Tyro payment is attempted on a device. The pairing
// is stored per browser device; replacing a terminal = clear the pairing
// (Settings > Hardware) and pair the new one from here.
const TyroPairingDialog = ({ open, onClose, onPaired }) => {
  const [merchantId, setMerchantId] = useState('');
  const [terminalId, setTerminalId] = useState('');

  const canPair = merchantId.trim() !== '' && terminalId.trim() !== '';

  const handlePair = () => {
    if (!canPair) return;
    const pairing = tyroService.savePairing({ merchantId, terminalId });
    onPaired?.(pairing);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
        <CardIcon color="primary" /> Pair your Tyro terminal
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          This device has no Tyro terminal paired. Enter the Merchant ID and Terminal ID
          shown on the terminal, then follow the prompts on the terminal to authorise the
          pairing (Configuration &gt; Integrated EFTPOS on most Tyro terminals — see the
          Tyro user guide or contact Tyro support for assistance).
        </Typography>
        <TextField
          autoFocus
          fullWidth
          margin="normal"
          label="Merchant ID"
          value={merchantId}
          onChange={(e) => setMerchantId(e.target.value)}
        />
        <TextField
          fullWidth
          margin="normal"
          label="Terminal ID"
          value={terminalId}
          onChange={(e) => setTerminalId(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handlePair(); }}
        />
        <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#f5f7f7', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
            The pairing is stored on this device. To move to a replacement terminal,
            clear the pairing under Settings &gt; Hardware and pair the new terminal here.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button
          variant="contained"
          disableElevation
          onClick={handlePair}
          disabled={!canPair}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          Pair Terminal
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TyroPairingDialog;
