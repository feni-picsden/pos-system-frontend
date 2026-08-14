import React, { useEffect, useState } from 'react';
import { Box, Dialog, TextField } from '@mui/material';
import { CancelConfirmRow, TypeDropdown } from './LineEditPanel';

const OTHER = '__other__';

// In-app prompt for every Setup > General "require a reason" gate on the sell
// screen (discounts, refunds, cash drawer, parked-sale note). Predefined
// reasons render as a dropdown plus "Other" (which frees the text field); with
// no predefined reasons the user always types the reason, matching the
// reference's empty-list behaviour.
//
// request: { title, label, options: string[], resolve } — resolve gets the
// reason string, or null when cancelled.
const RequestReasonDialog = ({ request, onClose }) => {
  const options = request?.options?.filter(Boolean) || [];
  const [choice, setChoice] = useState(OTHER);
  const [text, setText] = useState('');

  useEffect(() => {
    setChoice(request && options.length ? options[0] : OTHER);
    setText('');
    // The request object is the trigger; `options` is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  if (!request) return null;

  const isOther = !options.length || choice === OTHER;
  const value = (isOther ? text : choice).trim();
  const finish = (result) => { request.resolve(result); onClose(); };

  return (
    <Dialog
      open
      onClose={() => finish(null)}
      PaperProps={{
        sx: { width: 389, borderRadius: '12px', bgcolor: '#FAFAFA', border: '1px solid #D4D4D4', p: 2, overflow: 'visible' },
      }}
    >
      <Box sx={{ fontSize: 18, fontWeight: 700, color: '#000', mb: 1.5 }}>{request.title}</Box>
      {options.length > 0 && (
        <Box sx={{ mb: 1.5 }}>
          <TypeDropdown
            options={[...options.map((o) => ({ label: o, value: o })), { label: 'Other', value: OTHER }]}
            value={choice}
            onChange={setChoice}
          />
        </Box>
      )}
      {isOther && (
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={2}
          placeholder={request.label || 'Reason'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && value) {
              e.preventDefault();
              finish(value);
            }
          }}
        />
      )}
      <Box sx={{ mt: 2 }}>
        {/* Blank is not a reason — confirming without one cancels the action. */}
        <CancelConfirmRow onCancel={() => finish(null)} onConfirm={() => finish(value || null)} />
      </Box>
    </Dialog>
  );
};

export default RequestReasonDialog;
