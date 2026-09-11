import React from 'react';
import { Dialog, Box, Typography, ButtonBase } from '@mui/material';

/**
 * Shown when a scanned/typed barcode matches no product and no customer.
 *
 * The dead end used to be a warning toast, which left the operator with a code
 * in their hand and nothing to do about it. This offers the way out: bind the
 * code to a product that already exists, without leaving the sale.
 *
 * Follows Shopfront's "Product Not Found" modal — white card with an orange "!"
 * badge overhanging the top edge — and reuses the geometry of the sibling
 * BarcodeSelectDialog so the two read as one family.
 */
const BarcodeNotFoundDialog = ({ open, barcode, onAssociate, onClose }) => (
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
    slotProps={{ backdrop: { sx: { backgroundColor: 'rgba(0,0,0,0.3)' } } }}
  >
    {/* Orange "!" badge, half above the dialog's top edge */}
    <Box
      sx={{
        position: 'absolute',
        top: -55,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 110,
        height: 110,
        borderRadius: '50%',
        bgcolor: '#F59E0B',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Typography
        component="span"
        sx={{ color: '#fff', fontSize: 64, fontWeight: 700, lineHeight: 1 }}
      >
        !
      </Typography>
    </Box>

    <Box sx={{ px: 3, pt: 8.5, pb: 2.5 }}>
      <Typography align="center" sx={{ fontWeight: 700, color: '#111827', fontSize: 21, mb: 1.25 }}>
        Product Not Found
      </Typography>
      <Typography align="center" sx={{ fontSize: 14.5, color: '#5f6b76', lineHeight: 1.6, px: 1 }}>
        We could not find a product or customer with the barcode {barcode}.
      </Typography>
      <Typography
        align="center"
        sx={{ fontSize: 14.5, color: '#5f6b76', lineHeight: 1.6, mt: 1.25, mb: 2.5, px: 1 }}
      >
        Would you like to associate this barcode to a product?
      </Typography>

      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <ButtonBase
          onClick={onClose}
          sx={{
            flex: 1,
            height: 52,
            bgcolor: '#f4f5f7',
            border: '1px solid #dfe3e8',
            borderRadius: '8px',
            color: '#5f6b76',
            fontSize: 20,
            fontWeight: 500,
            justifyContent: 'center',
            '&:hover': { bgcolor: '#e9ebee' },
          }}
        >
          Cancel
        </ButtonBase>
        <ButtonBase
          onClick={onAssociate}
          sx={{
            flex: 1,
            height: 52,
            bgcolor: '#2196F3',
            border: '1px solid #2196F3',
            borderRadius: '8px',
            color: '#fff',
            fontSize: 20,
            fontWeight: 700,
            justifyContent: 'center',
            '&:hover': { bgcolor: '#1a86dd', borderColor: '#1a86dd' },
          }}
        >
          Associate
        </ButtonBase>
      </Box>
    </Box>
  </Dialog>
);

export default BarcodeNotFoundDialog;
