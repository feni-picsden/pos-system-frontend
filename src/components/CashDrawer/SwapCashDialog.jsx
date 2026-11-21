import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
} from '@mui/material';
import { formatCurrency } from '../../utils/currency';
import { byMode } from '../../theme/sfPalette';

// Reference Manage Cash > Swap Cash (help article "Managing Cash in the Register"):
//  1. "What denominations would you like to put in the register?" — Denomination /
//     Amount / Value rows, Total, Next
//  2. "What money will you swap out of the register?" — same rows, Total +
//     Balance (what is still left to match), Next
//  3. "Are you sure you wish to swap the following denominations" — the two
//     tables, Cancel / Yes.
const DENOMINATIONS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
const r2 = (n) => Math.round(n * 100) / 100;
const money = (d) => `$${d.toFixed(2)}`;
// A typed "-2" is not a count: anything below zero counts as nothing.
const count = (qty, d) => Math.max(0, parseInt(qty[d], 10) || 0);
const total = (qty) => r2(DENOMINATIONS.reduce((s, d) => s + d * count(qty, d), 0));
const rows = (qty) => DENOMINATIONS.filter((d) => count(qty, d) > 0);
const summariseDenominations = (qty) => rows(qty).map((d) => `${count(qty, d)} × ${money(d)}`).join(', ');

const STEPS = {
  in: { title: 'What denominations would you like to put in the register?', next: 'Next' },
  out: { title: 'What money will you swap out of the register?', next: 'Next' },
  confirm: { title: 'Are you sure you wish to swap the following denominations:', next: 'Yes' },
};

const SwapCashDialog = ({ open, onClose, loading = false, onSubmit }) => {
  const [step, setStep] = useState('in');
  const [putIn, setPutIn] = useState({});
  const [takeOut, setTakeOut] = useState({});
  // Value column text while it is being typed ("1" on the way to "10" must not
  // snap the amount to 0 and wipe the field). Keyed `${label}:${d}`; cleared on
  // blur / when the amount is edited directly, so the normalised value shows.
  const [valText, setValText] = useState({});

  useEffect(() => {
    if (open) { setStep('in'); setPutIn({}); setTakeOut({}); setValText({}); }
  }, [open]);

  const inTotal = total(putIn);
  const outTotal = total(takeOut);
  const balance = r2(inTotal - outTotal); // still to swap out
  const canNext = step === 'in' ? inTotal > 0 : step === 'out' ? Math.abs(balance) < 0.005 : !loading;

  const editable = (qty, setQty, label) => (
    <Table size="small" aria-label={label}>
      <TableHead>
        <TableRow>
          <TableCell>Denomination</TableCell>
          <TableCell>Amount</TableCell>
          <TableCell>Value</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {DENOMINATIONS.map((d) => {
          const amount = count(qty, d);
          return (
            <TableRow key={d}>
              <TableCell sx={{ width: 110 }}>{money(d)}</TableCell>
              <TableCell>
                <TextField
                  type="number"
                  size="small"
                  variant="standard"
                  inputProps={{ min: 0, step: 1, 'aria-label': `${label} amount ${money(d)}` }}
                  value={qty[d] ?? ''}
                  onChange={(e) => { setQty({ ...qty, [d]: e.target.value }); setValText({ ...valText, [`${label}:${d}`]: undefined }); }}
                />
              </TableCell>
              <TableCell>
                <TextField
                  type="number"
                  size="small"
                  variant="standard"
                  placeholder="$"
                  inputProps={{ min: 0, step: d, 'aria-label': `${label} value ${money(d)}` }}
                  value={valText[`${label}:${d}`] ?? (amount ? r2(amount * d) : '')}
                  onChange={(e) => {
                    const text = e.target.value;
                    const v = parseFloat(text);
                    setValText({ ...valText, [`${label}:${d}`]: text });
                    setQty({ ...qty, [d]: Number.isFinite(v) && v > 0 ? String(Math.floor(v / d + 1e-9)) : '' });
                  }}
                  onBlur={() => setValText({ ...valText, [`${label}:${d}`]: undefined })}
                />
              </TableCell>
            </TableRow>
          );
        })}
        <TableRow>
          <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
          <TableCell />
          <TableCell sx={{ fontWeight: 700 }}>{formatCurrency(total(qty))}</TableCell>
        </TableRow>
        {step === 'out' && (
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Balance</TableCell>
            <TableCell />
            <TableCell sx={{ fontWeight: 700, color: balance !== 0 ? '#d32f2f' : undefined }}>{formatCurrency(balance)}</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  const readOnly = (qty, label) => (
    <Table size="small" aria-label={label}>
      <TableHead>
        <TableRow>
          <TableCell>Denomination</TableCell>
          <TableCell>Amount</TableCell>
          <TableCell>Value</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows(qty).map((d) => (
          <TableRow key={d}>
            <TableCell>{money(d)}</TableCell>
            <TableCell>{count(qty, d)}</TableCell>
            <TableCell>{formatCurrency(d * count(qty, d))}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const back = () => setStep(step === 'confirm' ? 'out' : 'in');
  const next = () => {
    if (step === 'in') setStep('out');
    else if (step === 'out') setStep('confirm');
    else
      onSubmit({
        amount: inTotal,
        note: `In: ${summariseDenominations(putIn)} | Out: ${summariseDenominations(takeOut)}`,
      });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1.25rem', textAlign: 'center' }}>Swap Cash</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, '&&': { pt: 0.5 } }}>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
          {STEPS[step].title}
        </Typography>
        {step === 'in' && editable(putIn, setPutIn, 'Put in')}
        {step === 'out' && editable(takeOut, setTakeOut, 'Swap out')}
        {step === 'confirm' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {readOnly(takeOut, 'Swap out')}
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              For the following denominations:
            </Typography>
            {readOnly(putIn, 'Put in')}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={step === 'in' ? onClose : back} disabled={loading} size="large" sx={{ minWidth: 100 }}>
          {step === 'in' ? 'Cancel' : 'Back'}
        </Button>
        <Button
          variant="contained"
          size="large"
          disabled={!canNext}
          onClick={next}
          sx={{ minWidth: 120, backgroundColor: '#4FC3F7', color: byMode(undefined, '#232323'), '&:hover': { backgroundColor: '#29B6F6' } }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : STEPS[step].next}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SwapCashDialog;
