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
 * Follows Shopfront's "Multiple Results Found" dialog - white modal with a blue
 * "?" badge overhanging the top edge, one full-width button per match and a
 * full-width Cancel - restyled to this app's theme: rounded card, hairline
 * borders, and each option led by its pack-quantity chip so the quantities line
 * up in a column down the list.
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
          borderRadius: '12px',
          overflow: 'visible',
          maxWidth: 620,
          width: '100%',
          m: 2,
          boxShadow: '0 16px 48px rgba(15,23,42,0.28)',
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

      <Box sx={{ px: 3, pt: 8.5, pb: 2.5 }}>
        <Typography
          align="center"
          sx={{ fontWeight: 700, color: '#111827', fontSize: 21, mb: 0.75 }}
        >
          Multiple Results Found
        </Typography>
        <Typography
          align="center"
          sx={{ fontSize: 14.5, color: '#5f6b76', lineHeight: 1.5, mb: 2.5, px: 1 }}
        >
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
                minHeight: 56,
                bgcolor: '#fff',
                border: '1px solid #dfe3e8',
                borderRadius: '8px',
                mb: 1.25,
                px: 1.5,
                py: 1,
                gap: 1.5,
                justifyContent: 'flex-start',
                textAlign: 'left',
                transition: 'border-color .15s, background-color .15s',
                '&:hover': { bgcolor: '#fafbfc', borderColor: '#b6bec7' },
              }}
            >
              {/* The pack quantity leads every option, "1 x" included: the cashier
                  is comparing these rows against each other, and a row with no
                  multiplier next to a "6 x" row reads as missing information
                  rather than as a single unit. Its own chip keeps the quantities
                  in one column, so they can be scanned down the list. */}
              <Box
                sx={{
                  flexShrink: 0,
                  minWidth: 46,
                  height: 32,
                  px: 1,
                  borderRadius: '6px',
                  bgcolor: '#f1f3f5',
                  color: '#48525c',
                  fontSize: 15,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {qty} ×
              </Box>
              <Typography
                noWrap
                sx={{ fontSize: 16, fontWeight: 500, color: '#1a1a1a', minWidth: 0 }}
              >
                {product.name}
              </Typography>
            </ButtonBase>
          );
        })}

        <ButtonBase
          onClick={onClose}
          sx={{
            width: '100%',
            height: 48,
            mt: 0.5,
            bgcolor: '#f4f5f7',
            border: '1px solid #dfe3e8',
            borderRadius: '8px',
            color: '#5f6b76',
            fontSize: 16,
            fontWeight: 600,
            justifyContent: 'center',
            '&:hover': { bgcolor: '#e9ebee' },
          }}
        >
          Cancel
        </ButtonBase>
      </Box>
    </Dialog>
  );
};

export default BarcodeSelectDialog;
