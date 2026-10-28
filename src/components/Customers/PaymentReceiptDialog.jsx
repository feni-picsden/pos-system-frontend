import React from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton } from '@mui/material';
import { Close as CloseIcon, Print as PrintIcon } from '@mui/icons-material';
import { printHtmlDocument } from '../../utils/printHtmlDocument';

// Payment panel "Print" (reference): the same square panel as the sale reprint —
// title bar, the receipt boxed in a grey well, one full-bleed blue Print button,
// a dark round close badge outside the corner. The receipt is the built-in
// reference layout (pages/Customers/paymentReceipt.js).
const PaymentReceiptDialog = ({ open, onClose, html, title = 'Payment Receipt' }) => {
  const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="margin:0;background:#fff;">${html || ''}</body></html>`;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{ sx: { width: 500, maxWidth: '96vw', borderRadius: 0, overflow: 'visible', maxHeight: 'calc(100vh - 32px)', m: 2 } }}
    >
      <IconButton
        onClick={onClose}
        sx={{ position: 'absolute', top: -16, right: -16, width: 32, height: 32, bgcolor: '#313439', color: '#f8f8f8', '&:hover': { bgcolor: '#000' }, zIndex: 1 }}
      >
        <CloseIcon sx={{ fontSize: 20 }} />
      </IconButton>
      <DialogTitle sx={{ p: '0 16px', height: 41, display: 'flex', alignItems: 'center', fontSize: 16, color: '#313439', borderBottom: '1px solid #e0e0e0' }}>
        {title}
      </DialogTitle>
      <DialogContent sx={{ p: '16px', bgcolor: '#f8f8f8', height: 'min(569px, calc(100vh - 185px))', minHeight: 220, overflow: 'auto' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Box sx={{ border: '1px solid #000', bgcolor: '#fff', width: 452 }} data-payment-receipt dangerouslySetInnerHTML={{ __html: html || '' }} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 0 }}>
        <Button
          variant="contained"
          fullWidth
          startIcon={<PrintIcon sx={{ fontSize: '32px !important' }} />}
          onClick={() => printHtmlDocument(doc)}
          disabled={!html}
          sx={{ bgcolor: '#1c86f2', color: '#f8f8f8', height: 56, fontSize: '32px', fontWeight: 400, lineHeight: 1, textTransform: 'none', borderRadius: 0, boxShadow: 'none', gap: 1, '&:hover': { bgcolor: '#1573d4', boxShadow: 'none' } }}
        >
          Print
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PaymentReceiptDialog;
