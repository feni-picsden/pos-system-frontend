import React, { useState, useEffect } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  IconButton,
  FormControl,
  Select,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import {
  Print as PrintIcon,
  Close as CloseIcon,
  DescriptionOutlined,
} from '@mui/icons-material';
import receiptTemplateService from '../services/receiptTemplateService';
import settingsService from '../services/settingsService';
import ReceiptRenderer from './Receipt/ReceiptRenderer';
import { buildReceiptPrintHtml } from '../utils/receiptPrintHtml';
import { saleToReceiptData } from '../utils/saleToReceiptData';

const PrintReceiptDialog = ({ open, onClose, sale }) => {
  const [receiptTemplates, setReceiptTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  useEffect(() => {
    if (open) {
      loadReceiptTemplates();
      if (sale) {
        convertSaleToReceiptData(sale);
      }
    }
  }, [open, sale]);

  const loadReceiptTemplates = async () => {
    try {
      setTemplatesLoading(true);
      const [response, regResponse] = await Promise.all([
        receiptTemplateService.getTemplates({ for: 'Sale' }),
        settingsService.getRegisterSettings().catch(() => null),
      ]);
      const templates = response.templates || [];
      setReceiptTemplates(templates);

      // Same tiers as the sell screen: "Default Receipt Template" setting (by id,
      // by name for settings saved before ids) -> first. No per-template default flag.
      if (templates.length > 0) {
        const settings = regResponse?.settings || {};
        const defaultTemplate =
          (settings.defaultReceiptTemplateId && templates.find(t => t.id === settings.defaultReceiptTemplateId)) ||
          (settings.defaultReceiptTemplate && templates.find(t => t.name === settings.defaultReceiptTemplate)) ||
          templates[0];
        setSelectedTemplate(defaultTemplate);
      }
    } catch (error) {
      console.error('Error loading receipt templates:', error);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const convertSaleToReceiptData = (saleRow) => setReceiptData(saleToReceiptData(saleRow));

  const printReceipt = () => {
    if (!receiptData) return;

    // Single source of truth: print the exact template-driven component the preview shows.
    const template = selectedTemplate || { type: 'Normal', config: { layout: 'normal' } };
    const printContent = renderToStaticMarkup(
      <ReceiptRenderer receiptData={receiptData} template={template} />
    );
    const headStyles = Array.from(document.querySelectorAll('style'))
      .map((n) => n.outerHTML)
      .join('\n');

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(buildReceiptPrintHtml({
      markup: printContent,
      headStyles,
      template,
      title: `Receipt - ${receiptData.transactionId}`,
    }));
    doc.close();

    iframe.onload = () => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 100);
    };
  };

  // A4 templates have no receipt-paper preview (see the render block below).
  const isA4 = /a4/i.test(selectedTemplate?.type || selectedTemplate?.config?.layout || '');

  if (!sale) return null;

  return (
    // Reference reprint dialog (owner screenshot 2026-08-06): a square white panel
    // whose title bar IS the template select ("Receipt" + chevron, 1px bottom rule),
    // a scrolling body with the receipt boxed and centred at natural width, one
    // full-bleed blue Print button, and a dark round close badge outside the corner.
    // Email lives on the Sales History row, not in here.
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: 500,
          maxWidth: '96vw',
          borderRadius: 0,
          overflow: 'visible',
          m: 2,
        },
      }}
    >
      <IconButton
        onClick={onClose}
        sx={{
          position: 'absolute',
          top: -16,
          right: -16,
          width: 32,
          height: 32,
          bgcolor: '#313439',
          color: '#f8f8f8',
          '&:hover': { bgcolor: '#000' },
          zIndex: 1,
        }}
      >
        <CloseIcon sx={{ fontSize: 20 }} />
      </IconButton>

      <DialogTitle sx={{ p: 0, borderBottom: '1px solid #e0e0e0' }}>
        <FormControl fullWidth>
          <Select
            value={selectedTemplate?.id || ''}
            onChange={(e) => {
              const template = receiptTemplates.find(t => t.id === e.target.value);
              setSelectedTemplate(template);
            }}
            disabled={templatesLoading}
            variant="standard"
            disableUnderline
            displayEmpty
            renderValue={() => selectedTemplate?.name || 'Receipt'}
            sx={{
              '& .MuiSelect-select': {
                height: '41px !important',
                minHeight: '41px !important',
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                px: 2,
                fontSize: 16,
                color: '#313439',
              },
              '& .MuiSelect-icon': { right: 12, color: '#313439' },
            }}
          >
            {receiptTemplates.map((template) => (
              <MenuItem key={template.id} value={template.id}>
                {template.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogTitle>

      {/* .render-receipt — 569px scroll well on the reference's grey ground */}
      <DialogContent
        sx={{ p: '16px', bgcolor: '#f8f8f8', height: 569, overflowY: 'auto' }}
      >
        {templatesLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : isA4 ? (
          // The reference cannot render an A4 template to the receipt preview and
          // says so rather than drawing the wrong paper. Print still works.
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              color: '#313439',
            }}
          >
            <DescriptionOutlined sx={{ fontSize: 56, color: '#f5a623' }} />
            <Box sx={{ fontWeight: 700 }}>A4</Box>
            <Box>Receipt preview unsupported</Box>
          </Box>
        ) : receiptData && (
          // Boxed, centred, natural width — the reference never stretches the paper.
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Box sx={{ border: '1px solid #000', width: 'max-content', bgcolor: '#fff' }}>
              {/* Template-driven preview — same renderer used on-screen and for print */}
              <ReceiptRenderer receiptData={receiptData} template={selectedTemplate} preview />
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 0 }}>
        <Button
          variant="contained"
          fullWidth
          startIcon={<PrintIcon sx={{ fontSize: '32px !important' }} />}
          onClick={printReceipt}
          disabled={!receiptData || templatesLoading}
          sx={{
            bgcolor: '#1c86f2',
            color: '#f8f8f8',
            height: 56,
            fontSize: '32px',
            fontWeight: 400,
            lineHeight: 1,
            textTransform: 'none',
            borderRadius: 0,
            boxShadow: 'none',
            gap: 1,
            '&:hover': { bgcolor: '#1573d4', boxShadow: 'none' },
          }}
        >
          Print
        </Button>
      </DialogActions>

    </Dialog>
  );
};

export default PrintReceiptDialog;

