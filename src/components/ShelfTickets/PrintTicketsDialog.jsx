import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box,
  Typography, FormControl, InputLabel, Select, MenuItem, Chip,
  Divider, Alert, CircularProgress, TextField, InputAdornment,
  ToggleButton, ToggleButtonGroup, Tooltip, Paper,
} from '@mui/material';
import {
  Print as PrintIcon,
  Preview as PreviewIcon,
  LocalOffer as TicketIcon,
  Close as CloseIcon,
  Settings as SettingsIcon,
  GridView as GridIcon,
  ViewStream as ListIcon,
} from '@mui/icons-material';
import { handlePrintPreview, renderPrintElement } from '../../utils/shelfTicketPrint.jsx';
import shelfTicketTemplateService from '../../services/shelfTicketTemplateService';
import { extractBarcodeValue } from '../../utils/barcodeSvg';

const PREVIEW_PLACEHOLDER = {
  productName: 'Sample Product',
  price: '9.99',
  salePrice: '7.49',
  barcode: '5901234123457',
  category: 'Category',
  brand: 'Brand',
  sku: 'SKU001',
  description: 'Product description',
  unit: 'EA',
};

const MM_TO_PX = 3.7795275591; // 96 DPI

// Design tokens: notched outline #404040 1px, focus #000 2px, radius 8, placeholder #808080.
const FIELD_SX = {
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
  '& .MuiOutlinedInput-root': { borderRadius: '8px' },
  '& input::placeholder': { color: '#808080', opacity: 1 },
};

const PRINT_BUTTON_SX = {
  bgcolor: '#5ebbeb',
  color: '#fff',
  height: 42,
  borderRadius: '12px',
  px: 3,
  fontSize: 16,
  fontWeight: 700,
  textTransform: 'none',
  boxShadow: 'none',
  '&:hover': { bgcolor: '#0ea5e9', boxShadow: 'none' },
  '&.Mui-disabled': { bgcolor: '#cfe9f7', color: '#fff' },
};

// Secondary action: neutral-300 fill, neutral-400 on hover — the palette's cancel pairing.
const CANCEL_BUTTON_SX = {
  ...PRINT_BUTTON_SX,
  bgcolor: '#d4d4d4',
  color: '#000',
  '&:hover': { bgcolor: '#a3a3a3', boxShadow: 'none' },
};

// View-mode pair: palette outline + primary fill instead of MUI's grey 4px pill halves.
const VIEW_TOGGLE_SX = {
  '& .MuiToggleButton-root': {
    border: '1px solid #404040',
    borderRadius: '8px',
    color: '#313439',
    '&:hover': { bgcolor: '#f8f8f8' },
    '&.Mui-selected': {
      bgcolor: '#5ebbeb',
      color: '#f8f8f8',
      '&:hover': { bgcolor: '#0ea5e9' },
    },
  },
};

const toTemplateData = (input) => ({
  productName: input?.name || input?.productName || PREVIEW_PLACEHOLDER.productName,
  name: input?.name || input?.productName || PREVIEW_PLACEHOLDER.productName,
  price: input?.price != null ? String(parseFloat(input.price).toFixed(2)) : PREVIEW_PLACEHOLDER.price,
  salePrice: input?.salePrice != null ? String(parseFloat(input.salePrice).toFixed(2)) : PREVIEW_PLACEHOLDER.salePrice,
  barcode:
    extractBarcodeValue(input?.barcode) ||
    extractBarcodeValue(input?.ean) ||
    extractBarcodeValue(input?.barcodes) ||
    PREVIEW_PLACEHOLDER.barcode,
  category: input?.category?.name || input?.category || PREVIEW_PLACEHOLDER.category,
  brand: input?.brand || PREVIEW_PLACEHOLDER.brand,
  sku: input?.sku || input?.code || PREVIEW_PLACEHOLDER.sku,
  description: input?.description || PREVIEW_PLACEHOLDER.description,
  unit: input?.unit || PREVIEW_PLACEHOLDER.unit,
});

const TicketPreview = ({ template, product, scale = 1, fitWidthPx, fitHeightPx }) => {
  if (!template) return null;

  const data = toTemplateData(product);

  // Keep preview inside its container to avoid scrollbars.
  const widthPxAtScale1 = template.width * MM_TO_PX;
  const heightPxAtScale1 = template.height * MM_TO_PX;
  const widthScale = fitWidthPx ? fitWidthPx / widthPxAtScale1 : Infinity;
  const heightScale = fitHeightPx ? fitHeightPx / heightPxAtScale1 : Infinity;
  const fitScale = Math.min(widthScale, heightScale);
  const effectiveScale = Math.min(scale, fitScale);

  return (
    <Box
      sx={{
        position: 'relative',
        width: `${template.width * effectiveScale}mm`,
        height: `${template.height * effectiveScale}mm`,
        backgroundColor: template.backgroundColor || '#fff',
        overflow: 'hidden',
        flexShrink: 0,
        border: '1px solid #e0e0e0',
        boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
      }}
    >
      {template.elements.map(el => (
        <Box
          key={el.id}
          sx={{
            position: 'absolute',
            left: `${el.x * effectiveScale}mm`,
            top: `${el.y * effectiveScale}mm`,
            width: `${el.width * effectiveScale}mm`,
            height: `${el.height * effectiveScale}mm`,
            overflow: 'hidden',
          }}
        >
          {renderPrintElement(el, data)}
        </Box>
      ))}
    </Box>
  );
};

const PrintTicketsDialog = ({ open, onClose, tickets = [], ticketType = 'Everyday' }) => {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [previewMode, setPreviewMode] = useState('grid');
  const [copies, setCopies] = useState(1);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      try {
        const data = await shelfTicketTemplateService.getTemplates();
        const list = data.templates || [];
        setTemplates(list);
        setSelectedTemplateId((prev) => prev || (list[0] ? String(list[0].id) : ''));
      } catch (err) {
        console.error('Failed to load templates:', err);
      }
    };
    load();
  }, [open]);

  const selectedTemplate = templates.find(t => String(t.id) === String(selectedTemplateId));

  // Map ticket records to product-like data objects
  const products = tickets.map((ticket) => toTemplateData(ticket));

  // Expand by copies
  const expandedProducts = Array.from({ length: copies }).flatMap(() => products);

  const handlePrint = () => {
    if (!selectedTemplate || expandedProducts.length === 0) return;
    setIsPrinting(true);
    try {
      // Ensure print uses the exact same normalized data as the preview.
      handlePrintPreview(selectedTemplate, expandedProducts.map(toTemplateData));
    } finally {
      setIsPrinting(false);
    }
  };

  const previewProducts = products.slice(0, 6); // Show max 6 in dialog preview

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { height: '90vh', borderRadius: '12px' } }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PrintIcon sx={{ color: '#5ebbeb' }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" fontWeight={700}>Print Shelf Tickets</Typography>
            <Typography variant="body2" color="text.secondary">
              {tickets.length} ticket{tickets.length !== 1 ? 's' : ''} selected · {ticketType} Tickets
            </Typography>
          </Box>
          <Button
            variant="text"
            size="small"
            onClick={onClose}
            startIcon={<CloseIcon />}
            sx={{ color: '#313439', textTransform: 'none', fontWeight: 600 }}
          >
            Close
          </Button>
        </Box>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ display: 'flex', gap: 3, p: 2, overflow: 'hidden' }}>
        {/* Left — Settings */}
        <Box sx={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', overflowX: 'hidden' }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <SettingsIcon fontSize="small" />
              Print Settings
            </Typography>

            {templates.length === 0 ? (
              <Alert severity="warning" sx={{ mb: 1 }}>
                No templates found. Go to Setup → Shelf Ticket Templates to create one.
              </Alert>
            ) : (
              <FormControl fullWidth size="small" sx={{ mb: 2, ...FIELD_SX }}>
                <InputLabel>Ticket Template</InputLabel>
                <Select
                  label="Ticket Template"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                >
                  {templates.map(t => (
                    <MenuItem key={t.id} value={String(t.id)}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{t.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{t.width}×{t.height}mm · {t.elements?.length || 0} elements</Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <TextField
              fullWidth
              size="small"
              label="Copies per product"
              type="number"
              inputProps={{ min: 1, max: 100, step: 1 }}
              value={copies}
              onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
              sx={{ mb: 1, ...FIELD_SX }}
            />

            <Typography variant="caption" color="text.secondary">
              Total tickets to print: <strong>{expandedProducts.length}</strong>
            </Typography>
          </Paper>

          {selectedTemplate && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Template Info</Typography>
              <Typography variant="body2" fontWeight={600}>{selectedTemplate.name}</Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                Size: {selectedTemplate.width}×{selectedTemplate.height}mm
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                Elements: {selectedTemplate.elements?.length || 0}
              </Typography>
            </Paper>
          )}

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Selected Products</Typography>
            <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
              {tickets.slice(0, 50).map((ticket, i) => (
                <Box key={i} sx={{ py: 0.5, borderBottom: '1px solid #f0f0f0' }}>
                  <Typography variant="body2" noWrap>{ticket.name || ticket.productName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {ticket.category || ''} {ticket.price ? `· $${parseFloat(ticket.price).toFixed(2)}` : ''}
                  </Typography>
                </Box>
              ))}
              {tickets.length > 50 && (
                <Typography variant="caption" color="text.secondary" sx={{ pt: 1, display: 'block' }}>
                  +{tickets.length - 50} more...
                </Typography>
              )}
            </Box>
          </Paper>
        </Box>

        {/* Right — Preview */}
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
            <Typography variant="subtitle1" fontWeight={700} flexGrow={1}>
              Preview
            </Typography>
            <Chip label={`${previewProducts.length} shown`} size="small" />
            {products.length > 6 && (
              <Typography variant="caption" color="text.secondary">
                (showing first 6 of {products.length})
              </Typography>
            )}
            <ToggleButtonGroup
              size="small"
              value={previewMode}
              exclusive
              onChange={(_, v) => v && setPreviewMode(v)}
              sx={VIEW_TOGGLE_SX}
            >
              <Tooltip title="Grid"><span><ToggleButton value="grid"><GridIcon fontSize="small" /></ToggleButton></span></Tooltip>
              <Tooltip title="List"><span><ToggleButton value="list"><ListIcon fontSize="small" /></ToggleButton></span></Tooltip>
            </ToggleButtonGroup>
          </Box>

          {!selectedTemplate ? (
            <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'text.secondary', gap: 2 }}>
              <TicketIcon sx={{ fontSize: 64, opacity: 0.3 }} />
              <Typography>Select a template to preview tickets</Typography>
            </Box>
          ) : products.length === 0 ? (
            <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'text.secondary', gap: 2 }}>
              <TicketIcon sx={{ fontSize: 64, opacity: 0.3 }} />
              <Typography>No tickets selected</Typography>
            </Box>
          ) : (
            <Box sx={{ flexGrow: 1, overflowY: 'auto', overflowX: 'auto' }}>
              <Box
                sx={{
                  display: previewMode === 'grid' ? 'flex' : 'flex',
                  flexWrap: previewMode === 'grid' ? 'wrap' : 'nowrap',
                  flexDirection: previewMode === 'grid' ? 'row' : 'column',
                  gap: 2,
                  p: 1,
                  alignItems: previewMode === 'list' ? 'flex-start' : 'flex-start',
                }}
              >
                {previewProducts.map((product, i) => (
                  <Box
                    key={i}
                    sx={{
                      display: 'flex',
                      flexDirection: previewMode === 'list' ? 'row' : 'column',
                      alignItems: previewMode === 'list' ? 'center' : 'flex-start',
                      gap: 1,
                    }}
                  >
                    <TicketPreview template={selectedTemplate} product={product} scale={1} />
                    {previewMode === 'list' && (
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{product.productName}</Typography>
                        <Typography variant="caption" color="text.secondary">{product.category} · ${product.price}</Typography>
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} disableElevation sx={CANCEL_BUTTON_SX}>Cancel</Button>
        <Box sx={{ flexGrow: 1 }} />
        <Typography variant="body2" color="text.secondary">
          {expandedProducts.length} ticket{expandedProducts.length !== 1 ? 's' : ''} will open in a print window
        </Typography>
        <Button
          variant="contained"
          disableElevation
          startIcon={isPrinting ? <CircularProgress size={16} color="inherit" /> : <PrintIcon />}
          onClick={handlePrint}
          disabled={!selectedTemplate || products.length === 0 || isPrinting}
          sx={PRINT_BUTTON_SX}
        >
          {isPrinting ? 'Opening...' : 'Print Tickets'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PrintTicketsDialog;
