import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Autocomplete,
  TextField,
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { byMode } from '../../theme/sfPalette';

// Reference look (16/10/2026): small label above the field, searchable field
// with a clear (×) button, options grouped under a bold percentage heading and
// listed by name only. Design only - merge rules unchanged.
const LABEL_SX = { fontSize: 13, color: byMode('#000', '#f8f8f8'), mb: 0.5, display: 'block' };

const FIELD_SX = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: byMode('#fff', '#121212'),
    borderRadius: '8px',
    fontSize: 15,
    '& fieldset': { borderColor: byMode('#9e9e9e', '#a1a1a1'), borderWidth: '1px' },
    '&:hover fieldset': { borderColor: byMode('#555', '#a1a1a1') },
    '&.Mui-focused fieldset': { borderColor: byMode('#000', '#f8f8f8'), borderWidth: '2px' },
  },
  '& .MuiInputBase-input::placeholder': { color: byMode('#666', '#757575'), opacity: 1 },
};

const LISTBOX_SX = {
  padding: 0,
  '& .MuiAutocomplete-option': {
    fontSize: 15,
    minHeight: 44,
    paddingLeft: '14px !important',
    borderTop: byMode('1px solid #e0e0e0', '1px solid #373737'),
  },
  '& .MuiAutocomplete-option[aria-selected="true"]': { backgroundColor: byMode('#74d4fc !important', '#0084d1 !important') },
  '& .MuiAutocomplete-option.Mui-focused': { backgroundColor: byMode('#e8f6fe', '#2f2f2f') },
};

const PAPER_SX = {
  mt: 1,
  border: byMode('1px solid #000', '1px solid #a1a1a1'),
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  overflow: 'hidden',
};

const GROUP_HEADER_SX = {
  fontSize: 15,
  fontWeight: 700,
  color: byMode('#000', '#f8f8f8'),
  px: '14px',
  py: '12px',
  backgroundColor: byMode('#fff', '#232323'),
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

  // The system "No Tax" rate is locked - it can be merged INTO but never merged away.
  const isSystemRate = (t) => t.name === 'No Tax' && t.outletId == null;
  // Same outlet view (backend rule): a global rate's products live in every
  // outlet, so it only merges into another global rate; an outlet rate merges
  // into its own outlet or a global rate.
  const canMergeInto = (from, to) =>
    from.outletId == null ? to.outletId == null : (to.outletId == null || to.outletId === from.outletId);
  const destinationsFor = (from) =>
    (taxRates || []).filter(
      (t) => t.id !== from.id && Number(t.amount) === Number(from.amount) && canMergeInto(from, t)
    );

  // Options sorted by percentage so groupBy gets contiguous groups.
  const fromOptions = [...(mergeableTaxRates || [])]
    .filter((t) => !isSystemRate(t) && destinationsFor(t).length > 0)
    .sort((a, b) => Number(a.amount) - Number(b.amount));
  const hasMergeable = fromOptions.length > 0;
  const fromTax = taxRates?.find((t) => t.id === fromId);
  const sameAmountAsFrom = fromTax ? destinationsFor(fromTax) : [];

  useEffect(() => {
    if (!open) {
      setFromId('');
      setToId('');
    }
  }, [open]);

  const handleContinue = () => {
    if (!hasMergeable) {
      onClose();
      return;
    }
    // The page confirms first (a merge cannot be reversed) and closes this dialog.
    if (fromId && toId && fromId !== toId) {
      onMerge(fromId, toId);
    }
  };

  const renderPicker = ({ label, options, value, onChange, disabled }) => (
    <Box sx={{ mb: 2 }}>
      <Typography component="label" sx={LABEL_SX}>
        {label}
      </Typography>
      <Autocomplete
        options={options}
        value={options.find((t) => t.id === value) || null}
        onChange={(_, v) => onChange(v ? v.id : '')}
        groupBy={(t) => formatAmount(t.amount)}
        getOptionLabel={(t) => t?.name || ''}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        disabled={disabled}
        size="small"
        noOptionsText="No tax rates"
        renderGroup={(params) => (
          <li key={params.key}>
            <Box sx={GROUP_HEADER_SX}>{params.group}</Box>
            <Box component="ul" sx={{ p: 0, m: 0 }}>
              {params.children}
            </Box>
          </li>
        )}
        renderOption={(props, t) => (
          <li {...props} key={t.id}>
            {t.name}
          </li>
        )}
        renderInput={(params) => (
          <TextField {...params} placeholder="Select..." sx={FIELD_SX} />
        )}
        slotProps={{ paper: { sx: PAPER_SX } }}
        ListboxProps={{ sx: LISTBOX_SX }}
      />
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: 448, maxWidth: '92vw', borderRadius: '8px' } }}
    >
      <DialogTitle
        sx={{
          backgroundColor: byMode('oklch(90.1% .058 230.902)', '#0c3a55'),
          color: byMode('oklch(44.3% .11 240.79)', '#74d4ff'),
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
      <DialogContent sx={{ pt: '16px !important' }}>
        {hasMergeable ? (
          <>
            <Typography sx={{ fontSize: 14, color: byMode('#000', '#f8f8f8'), mb: 2 }}>
              Merge tax rates with matching tax rate percentages. Only showing
              tax rates that can be merged
            </Typography>
            {renderPicker({
              label: 'From',
              options: fromOptions,
              value: fromId,
              onChange: (id) => {
                setFromId(id);
                setToId('');
              },
            })}
            {fromId &&
              renderPicker({
                label: 'To',
                options: sameAmountAsFrom,
                value: toId,
                onChange: setToId,
              })}
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
            bgcolor: byMode('#d9d9d9', '#3a3a3a'),
            color: byMode('#000', '#f8f8f8'),
            textTransform: 'none',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: 16,
            height: 42,
            px: 3,
            transition: 'all 0s ease',
            '&:hover': { bgcolor: byMode('#cccccc', '#4a4a4a'), boxShadow: 'none' },
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
            color: byMode('#fff', '#232323'),
            textTransform: 'none',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: 16,
            height: 42,
            px: 3,
            transition: 'all 0s ease',
            '&:hover': { backgroundColor: '#38bdf8', boxShadow: 'none' },
            '&.Mui-disabled': {
              backgroundColor: byMode('#ebebeb', '#3a3a3a'),
              color: byMode('#8e8e8e', '#a0a4aa'),
              pointerEvents: 'auto',
              cursor: 'not-allowed',
              '&:hover': { backgroundColor: byMode('#ebebeb', '#3a3a3a') },
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
