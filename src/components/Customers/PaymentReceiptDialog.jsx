import React, { useEffect, useMemo, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, IconButton, MenuItem, Select } from '@mui/material';
import { Close as CloseIcon, Print as PrintIcon } from '@mui/icons-material';
import { printHtmlDocument } from '../../utils/printHtmlDocument';
import { buildReceiptPrintHtml } from '../../utils/receiptPrintHtml';
import receiptTemplateService from '../../services/receiptTemplateService';
import ReceiptRenderer from '../Receipt/ReceiptRenderer';

// Payment panel "Print" (reference): the same square panel as the sale reprint —
// the title bar IS a template select ("Payment Receipt - ARARAT" + chevron)
// listing the Setup > Receipts templates made for a Payment plus the built-in
// reference layout (pages/Customers/paymentReceipt.js), the receipt boxed in a
// grey well, one full-bleed blue Print button, a dark round close badge outside
// the corner. `html` is the built-in layout; `receiptData` feeds a template.
const BUILT_IN = 'built-in';
const isPaymentTemplate = (t) => t.for === 'Payment' || t.type === 'Payment' || t.isAccountPayment;

const PaymentReceiptDialog = ({ open, onClose, html, receiptData, title = 'Payment Receipt', defaultTemplateId = null }) => {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(BUILT_IN);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    receiptTemplateService.getTemplates({ for: 'Payment' })
      .then((r) => { if (alive) setTemplates((r?.templates || []).filter(isPaymentTemplate)); })
      .catch(() => { if (alive) setTemplates([]); });
    return () => { alive = false; };
  }, [open]);
  useEffect(() => { if (open) setSelected(defaultTemplateId || BUILT_IN); }, [open, defaultTemplateId]);

  const template = templates.find((t) => String(t.id) === String(selected)) || null;
  const markup = useMemo(() => {
    if (!template || !receiptData) return html || '';
    try {
      return renderToStaticMarkup(<ReceiptRenderer receiptData={receiptData} template={template} />);
    } catch (e) {
      console.error('Payment template render failed:', e);
      return html || '';
    }
  }, [template, receiptData, html]);

  const print = () => {
    if (template && receiptData) {
      const headStyles = Array.from(document.querySelectorAll('style')).map((n) => n.outerHTML).join('\n');
      printHtmlDocument(buildReceiptPrintHtml({ markup, headStyles, template, title }));
      return;
    }
    // Reference prints the payment receipt across the full A4 width: logo near
    // page width, tables stretched edge to edge (not a 420px strip in the middle).
    printHtmlDocument(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
      @page { size: A4; margin: 10mm; }
      body > div { max-width: none !important; margin: 0 !important; padding: 0 !important; }
      body > div img { max-width: 95% !important; max-height: none !important; width: 95%; }
    </style></head><body style="margin:0;background:#fff;">${html || ''}</body></html>`);
  };

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
      <DialogTitle sx={{ p: 0, borderBottom: '1px solid #e0e0e0' }}>
        <FormControl fullWidth>
          <Select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            variant="standard"
            disableUnderline
            displayEmpty
            data-payment-receipt-template
            renderValue={() => (template ? template.name : title)}
            sx={{
              '& .MuiSelect-select': { height: '41px !important', minHeight: '41px !important', boxSizing: 'border-box', display: 'flex', alignItems: 'center', px: 2, fontSize: 16, color: '#313439' },
              '& .MuiSelect-icon': { right: 12, color: '#313439' },
            }}
          >
            <MenuItem value={BUILT_IN}>{title}</MenuItem>
            {templates.map((t) => (
              <MenuItem key={t.id} value={String(t.id)}>{t.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogTitle>
      <DialogContent sx={{ p: '16px', bgcolor: '#f8f8f8', height: 'min(569px, calc(100vh - 185px))', minHeight: 220, overflow: 'auto' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          {/* Reference preview: a narrow ~302px receipt with the logo filling it. */}
          {template && receiptData ? (
            // Mounted (not static HTML): the receipt's emotion CSS (12px Roboto,
            // 1.35 line height) is only inserted for a mounted tree — static markup
            // fell back to the dialog's 16px / 1.5 and spread the header lines.
            // Mounting also puts that CSS in <head> for the Print path to copy.
            <Box
              sx={{ border: '1px solid #000', bgcolor: '#fff', width: 302, maxWidth: '100%', boxSizing: 'border-box' }}
              data-payment-receipt
            >
              <ReceiptRenderer receiptData={receiptData} template={template} />
            </Box>
          ) : (
            <Box
              sx={{
                // A fixed width: 'auto' inside the centring flex shrank the receipt
                // to its min-content (~190px, labels wrapping).
                border: '1px solid #000', bgcolor: '#fff', width: 302, maxWidth: '100%', boxSizing: 'border-box',
                '& > div': { fontSize: '10px !important', padding: '15px !important' },
                '& img': { maxWidth: '100% !important', width: '100%', maxHeight: 'none !important' },
              }}
              data-payment-receipt
              dangerouslySetInnerHTML={{ __html: markup }}
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 0 }}>
        <Button
          variant="contained"
          fullWidth
          startIcon={<PrintIcon sx={{ fontSize: '32px !important' }} />}
          onClick={print}
          disabled={!markup}
          sx={{ bgcolor: '#1c86f2', color: '#f8f8f8', height: 56, fontSize: '32px', fontWeight: 400, lineHeight: 1, textTransform: 'none', borderRadius: 0, boxShadow: 'none', gap: 1, '&:hover': { bgcolor: '#1573d4', boxShadow: 'none' } }}
        >
          Print
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PaymentReceiptDialog;
