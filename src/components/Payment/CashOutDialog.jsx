import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  InputAdornment,
  TextField,
} from '@mui/material';
import { LocalAtm as CashIcon } from '@mui/icons-material';

// Prompt for the EFTPOS cash-out amount before charging the card. The entered
// amount is added on top of the goods total; the card is charged for both and
// the operator hands the cash-out portion to the customer.
const CashOutDialog = ({ open, goodsAmount = 0, onClose, onConfirm }) => {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (open) setValue('');
  }, [open]);

  const cashOut = parseFloat(value) || 0;
  const valid = cashOut > 0;
  const total = (goodsAmount || 0) + cashOut;

  const confirm = () => {
    if (valid) onConfirm(Math.round(cashOut * 100));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CashIcon color="primary" /> Cash Out
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Enter the cash amount to add to this sale. The card is charged for the
          goods plus cash out; give the cash to the customer once approved.
        </Typography>
        <TextField
          autoFocus
          fullWidth
          type="number"
          label="Cash out amount"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirm();
          }}
          inputProps={{ min: 0, step: '0.01' }}
          InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
        />
        {goodsAmount > 0 && (
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">
              Goods ${(goodsAmount || 0).toFixed(2)} + Cash out ${cashOut.toFixed(2)}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Total ${total.toFixed(2)}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {/* Cash out is optional — charge goods only. */}
        <Button onClick={() => onConfirm(0)}>No Cash Out</Button>
        <Button variant="contained" onClick={confirm} disabled={!valid}>
          Cash Out
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CashOutDialog;
