import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

const selectSx = {
  backgroundColor: '#fff',
  borderRadius: 1,
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: '#d0d0d0',
    borderWidth: '1px',
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: '#999',
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: '#1976d2',
    borderWidth: '1px',
  },
  '& .MuiSelect-select': {
    color: 'rgba(0,0,0,0.87)',
  },
  '& .MuiSelect-icon': {
    color: 'rgba(0,0,0,0.54)',
  },
};

const MergeTaxRateDialog = ({
  open,
  onClose,
  onMerge,
  mergeableTaxRates,
  taxRates,
  formatAmount,
}) => {
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');

  const hasMergeable = mergeableTaxRates && mergeableTaxRates.length > 0;
  const fromTax = taxRates?.find((t) => t.id === fromId);
  const sameAmountAsFrom = fromTax
    ? (taxRates || []).filter(
        (t) => t.id !== fromId && Number(t.amount) === Number(fromTax.amount)
      )
    : [];

  useEffect(() => {
    if (!open) {
      setFromId('');
      setToId('');
    }
  }, [open]);

  const handleFromChange = (e) => {
    setFromId(e.target.value);
    setToId('');
  };

  const handleContinue = () => {
    if (!hasMergeable) {
      onClose();
      return;
    }
    if (fromId && toId) {
      onMerge(fromId, toId);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: 448, maxWidth: '92vw', borderRadius: '8px' } }}
    >
      <DialogTitle
        sx={{
          backgroundColor: 'oklch(90.1% .058 230.902)',
          color: 'oklch(44.3% .11 240.79)',
          fontSize: 16,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <HelpOutlineIcon sx={{ fontSize: 20 }} />
        Merge Tax Rate
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {hasMergeable ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Merge tax rates with matching tax rate percentages. Only showing
              tax rates that can be merged.
            </Typography>
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel id="merge-from-label">From</InputLabel>
              <Select
                labelId="merge-from-label"
                value={fromId}
                onChange={handleFromChange}
                label="From"
                displayEmpty
                input={<OutlinedInput label="From" />}
                renderValue={(v) => {
                  if (!v) return <span style={{ color: '#666' }}>Select...</span>;
                  const t = mergeableTaxRates.find((x) => x.id === v);
                  return t ? `${t.name} (${formatAmount(t.amount)})` : '';
                }}
                sx={selectSx}
              >
                <MenuItem value="">
                  Select...
                </MenuItem>
                {mergeableTaxRates.map((tax) => (
                  <MenuItem key={tax.id} value={tax.id}>
                    {tax.name} ({formatAmount(tax.amount)})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl
              fullWidth
              size="small"
              disabled={!fromId}
              sx={{ mb: 1 }}
            >
              <InputLabel id="merge-to-label">To</InputLabel>
              <Select
                labelId="merge-to-label"
                value={toId}
                onChange={(e) => setToId(e.target.value)}
                label="To"
                displayEmpty
                input={<OutlinedInput label="To" />}
                renderValue={(v) => {
                  if (!v) return <span style={{ color: '#666' }}>Select...</span>;
                  const t = sameAmountAsFrom.find((x) => x.id === v);
                  return t ? `${t.name} (${formatAmount(t.amount)})` : '';
                }}
                sx={selectSx}
              >
                <MenuItem value="">
                  Select...
                </MenuItem>
                {sameAmountAsFrom.map((tax) => (
                  <MenuItem key={tax.id} value={tax.id}>
                    {tax.name} ({formatAmount(tax.amount)})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </>
        ) : (
          <Box sx={{ py: 1 }}>
            <Typography variant="body1" sx={{ mb: 1 }}>
              No tax rates are able to be merged.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Tax rates can only be merged if they have the same tax rate
              percentage.
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          disableElevation
          sx={{
            bgcolor: '#d9d9d9',
            color: '#000',
            textTransform: 'none',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: 16,
            height: 42,
            px: 3,
            transition: 'all 0s ease',
            '&:hover': { bgcolor: '#cccccc', boxShadow: 'none' },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleContinue}
          variant="contained"
          disableElevation
          disabled={!hasMergeable || !fromId || !toId}
          sx={{
            backgroundColor: '#0ea5e9',
            color: '#fff',
            textTransform: 'none',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: 16,
            height: 42,
            px: 3,
            transition: 'all 0s ease',
            '&:hover': { backgroundColor: '#38bdf8', boxShadow: 'none' },
            '&.Mui-disabled': {
              backgroundColor: '#ebebeb',
              color: '#8e8e8e',
              pointerEvents: 'auto',
              cursor: 'not-allowed',
              '&:hover': { backgroundColor: '#ebebeb' },
            },
          }}
        >
          Continue
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MergeTaxRateDialog;
