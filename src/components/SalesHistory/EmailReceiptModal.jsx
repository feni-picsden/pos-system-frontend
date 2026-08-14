import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import ShopfrontDialog, { DialogButton } from '../Common/ShopfrontDialog';

// Reference "Email" dialog: one row per address, a validity glyph inside each
// box (green tick / red cross), a green "Add Email Address" bar that is disabled
// until the last row has something in it, then Cancel / Send.
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const EmailReceiptModal = ({ open, onClose, onSend, saleId, senderEmail }) => {
  const [emails, setEmails] = useState(['']);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const setEmailAt = (index, value) => {
    setEmails((prev) => prev.map((e, i) => (i === index ? value : e)));
    setError('');
  };

  const handleClose = () => {
    setEmails(['']);
    setError('');
    onClose();
  };

  const valid = emails.map((e) => e.trim()).filter(isEmail);

  const handleSend = async () => {
    const unique = [...new Set(valid)];
    if (unique.length === 0) {
      setError('Please enter at least one valid email address');
      return;
    }
    setSending(true);
    try {
      await onSend(saleId, unique, senderEmail);
      handleClose();
    } catch (err) {
      setError(
        err.response?.data?.details ||
          err.response?.data?.error ||
          err.message ||
          'Failed to send email. Please try again.'
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <ShopfrontDialog
      open={open}
      onClose={handleClose}
      title="Email"
      actions={
        <>
          <DialogButton tone="cancel" onClick={handleClose}>
            Cancel
          </DialogButton>
          <DialogButton
            tone="send"
            onClick={handleSend}
            disabled={sending || valid.length === 0}
          >
            {sending ? 'Sending...' : 'Send'}
          </DialogButton>
        </>
      }
    >
      <Typography sx={{ fontSize: 16, m: '16px 0' }}>
        Please enter an email to send email to
      </Typography>

      {emails.map((email, index) => (
        <Box key={index} sx={{ position: 'relative', mb: '8px' }}>
          <Box
            component="input"
            value={email}
            onChange={(e) => setEmailAt(index, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && valid.length) handleSend();
            }}
            sx={{
              width: '100%',
              height: 53,
              boxSizing: 'border-box',
              p: '16px 30px 16px 16px',
              fontSize: 16,
              border: '1px solid #000',
              borderRadius: 0,
              outline: 'none',
            }}
          />
          {email.trim() !== '' && (
            <Box
              sx={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 18,
                color: isEmail(email) ? '#32b643' : '#e0393e',
              }}
            >
              {isEmail(email) ? '✓' : '✕'}
            </Box>
          )}
        </Box>
      ))}

      <Box
        component="button"
        type="button"
        disabled={emails[emails.length - 1].trim() === ''}
        onClick={() => setEmails([...emails, ''])}
        sx={{
          width: '100%',
          height: 53,
          border: '1px solid #f8f8f8',
          borderRadius: 0,
          bgcolor: '#32b643',
          color: '#f8f8f8',
          fontSize: 16,
          cursor: 'pointer',
          '&:disabled': { opacity: 0.45, cursor: 'default' },
        }}
      >
        Add Email Address
      </Box>

      {error && (
        <Typography sx={{ color: '#e0393e', fontSize: 14, mt: '8px' }}>
          {error}
        </Typography>
      )}
    </ShopfrontDialog>
  );
};

export default EmailReceiptModal;
