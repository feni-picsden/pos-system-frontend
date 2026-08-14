import React, { useState, useEffect } from 'react';
import { Box, Dialog } from '@mui/material';
import { KeypadBody, CancelConfirmRow } from './LineEditPanel';

// In-app replacement for window.prompt on the sell screen: products and sale keys
// flagged "Request Quantity" / "Request Price" ask for the value with the same
// keypad the line editor uses. Driven by a single request object; `resolve` is
// called with the parsed number, or null when cancelled.
//
// request: { title, mode: 'price'|'qty'|'percent', initial, resolve }
const RequestValueDialog = ({ request, onClose }) => {
  const [value, setValue] = useState('');
  useEffect(() => { setValue(request ? String(request.initial ?? '') : ''); }, [request]);
  if (!request) return null;

  const finish = (result) => { request.resolve(result); onClose(); };
  const confirm = () => {
    const parsed = parseFloat(value);
    // Blank / unparseable is not a value  the caller decides, so cancel.
    finish(Number.isFinite(parsed) ? parsed : null);
  };

  return (
    <Dialog
      open
      onClose={() => finish(null)}
      PaperProps={{
        sx: { width: 389, borderRadius: '12px', bgcolor: '#FAFAFA', border: '1px solid #D4D4D4', p: 2, overflow: 'visible' },
      }}
    >
      <Box sx={{ fontSize: 18, fontWeight: 700, color: '#000', mb: 1.5 }}>{request.title}</Box>
      {/* Confirm below is the Ok no second one inside the keypad. */}
      <KeypadBody value={value} setValue={setValue} onOk={confirm} mode={request.mode || 'price'} showOk={false} />
      <Box sx={{ mt: 2 }}>
        <CancelConfirmRow onCancel={() => finish(null)} onConfirm={confirm} />
      </Box>
    </Dialog>
  );
};

export default RequestValueDialog;
