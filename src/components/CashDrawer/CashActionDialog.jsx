import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  CircularProgress,
  Typography,
} from '@mui/material';

const OTHER = '__other__';

const CashActionDialog = ({
  open,
  onClose,
  title,
  submitLabel = 'Confirm',
  loading = false,
  requireAmount = true,
  requireReason = false,
  requireNote = false,
  amountOptional = false,
  noteLabel = 'Note',
  reasonLabel = 'Reason',
  // Predefined reasons from Setup > General. Non-empty renders a select (plus
  // "Other", which frees the text field); empty keeps the plain text field, so
  // "the users will always need to type in the reason" still holds.
  reasonOptions = [],
  extraContent = null,
  onSubmit,
}) => {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [choice, setChoice] = useState(OTHER);
  const [note, setNote] = useState('');

  const options = (reasonOptions || []).filter(Boolean);

  useEffect(() => {
    if (open) {
      setAmount('');
      setReason('');
      setChoice(options.length ? options[0] : OTHER);
      setNote('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reasonOptions]);

  const isOther = !options.length || choice === OTHER;
  const effectiveReason = isOther ? reason.trim() : choice;

  const handleSubmit = () => {
    onSubmit({
      amount: amount === '' ? null : parseFloat(amount),
      reason: effectiveReason,
      note: note.trim(),
    });
  };

  const amountValid =
    !requireAmount ||
    amountOptional ||
    (parseFloat(amount) > 0 && !Number.isNaN(parseFloat(amount)));
  const reasonValid = !requireReason || effectiveReason.length > 0;
  const noteValid = !requireNote || note.trim().length > 0;
  const canSubmit = amountValid && reasonValid && noteValid && !loading;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1.25rem' }}>{title}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        {extraContent}
        {(requireAmount || amountOptional) && (
          <TextField
            label="Amount ($)"
            type="number"
            inputProps={{ min: 0, step: '0.01' }}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            fullWidth
            required={requireAmount && !amountOptional}
            autoFocus
            size="medium"
          />
        )}
        {requireReason && options.length > 0 && (
          <TextField
            select
            label={reasonLabel}
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            fullWidth
            required
          >
            {options.map((o) => (
              <MenuItem key={o} value={o}>{o}</MenuItem>
            ))}
            <MenuItem value={OTHER}>Other</MenuItem>
          </TextField>
        )}
        {requireReason && isOther && (
          <TextField
            label={reasonLabel}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            fullWidth
            required
            multiline
            minRows={2}
          />
        )}
        <TextField
          label={noteLabel}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          fullWidth
          required={requireNote}
          multiline
          minRows={requireNote ? 2 : 1}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={loading} size="large" sx={{ minWidth: 100 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!canSubmit}
          size="large"
          sx={{
            minWidth: 120,
            backgroundColor: '#4FC3F7',
            '&:hover': { backgroundColor: '#29B6F6' },
          }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CashActionDialog;
