import React from 'react';
import { Dialog, Box, Typography, ButtonBase } from '@mui/material';

/**
 * Returns the pack quantity the scanned code carries for this product.
 * Mirrors the barcode shapes handled by normalizeBarcodeCodes in
 * src/services/posLocalDb.js: barcodes may be a JSON string, an array of
 * plain code strings, or an array of { quantity, code } objects.
 */
// eslint-disable-next-line react-refresh/only-export-components -- helper is tightly coupled to this dialog; only affects HMR fast-refresh
export const getBarcodeQuantity = (product, code) => {
  let arr = product?.barcodes;
  if (typeof arr === 'string') {
    try {
      arr = JSON.parse(arr);
    } catch {
      return 1;
    }
  }
  if (!Array.isArray(arr)) return 1;
  const target = String(code || '').trim();
  const hit = arr.find(
    (b) =>
      b &&
      typeof b === 'object' &&
      String(b.code ?? b.barcode ?? '').trim() === target
  );
  return Math.max(1, parseInt(hit?.quantity, 10) || 1);
};

/**
 * Shown when a scanned barcode matches MORE THAN ONE product: the cashier
 * picks which product to add to the sale (duplicate barcodes are allowed).
 * Styled to match Shopfront's "Multiple Results Found" dialog: square-corner
 * white modal with a blue "?" badge overhanging the top edge, full-width
 * black-bordered option buttons and a full-width gray Cancel.
 */
const BarcodeSelectDialog = ({ open, barcode, products, onSelect, onClose }) => {
  const items = Array.isArray(products) ? products : [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: 0,
          overflow: 'visible',
          maxWidth: 620,
          width: '100%',
          m: 2,
          boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
          bgcolor: '#fff',
        },
      }}
      slotProps={{
        backdrop: { sx: { backgroundColor: 'rgba(0,0,0,0.3)' } },
      }}
    >
      {/* Blue question-mark badge, half above the dialog's top edge */}
      <Box
        sx={{
          position: 'absolute',
          top: -55,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 110,
          height: 110,
          borderRadius: '50%',
          bgcolor: '#2196F3',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography
          component="span"
          sx={{ color: '#fff', fontSize: 64, fontWeight: 700, lineHeight: 1 }}
        >
          ?
        </Typography>
      </Box>

      <Box sx={{ px: 2, pt: 8.5, pb: 2 }}>
        <Typography
          align="center"
          sx={{ fontWeight: 700, color: '#000', fontSize: 21, mb: 1 }}
        >
          Multiple Results Found
        </Typography>
        <Typography align="center" sx={{ fontSize: 15, color: '#1a1a1a', mb: 2.5 }}>
          Multiple results have been found, please select the correct result
          from the list below:
        </Typography>

        {items.map((product) => {
          const qty = getBarcodeQuantity(product, barcode);
          return (
            <ButtonBase
              key={product.id}
              onClick={() => onSelect(product, qty)}
              sx={{
                width: '100%',
                height: 50,
                bgcolor: '#fff',
                border: '1px solid #000',
                borderRadius: 0,
                mb: 1.25,
                px: 2,
                fontSize: 15.5,
                justifyContent: 'center',
                '&:hover': { bgcolor: '#f5f5f5' },
              }}
            >
              <Typography noWrap sx={{ fontSize: 'inherit', color: '#000' }}>
                {qty > 1 && (
                  <Box component="span" sx={{ color: '#9e9e9e' }}>
                    {qty} x{' '}
                  </Box>
                )}
                {product.name}
              </Typography>
            </ButtonBase>
          );
        })}

        <ButtonBase
          onClick={onClose}
          sx={{
            width: '100%',
            height: 50,
            bgcolor: '#eeeeee',
            border: '1px solid #d9d9d9',
            borderRadius: 0,
            color: '#8a8a8a',
            fontSize: 20,
            justifyContent: 'center',
            '&:hover': { bgcolor: '#e3e3e3' },
          }}
        >
          Cancel
        </ButtonBase>
      </Box>
    </Dialog>
  );
};

export default BarcodeSelectDialog;
