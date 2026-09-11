import React, { useState, useEffect } from 'react';
import { Dialog, Box, Typography, ButtonBase } from '@mui/material';
import { KeypadBody } from './LineEditPanel';

/**
 * Second step of the "associate an unknown barcode" flow: the operator has
 * picked the product, and now says how many units one scan of this code adds
 * (a carton code is a 12, a single unit is a 1).
 *
 * The product summary above the keypad is the point of no return made checkable:
 * the search list shows only a name and a price, and names on a bottle shop
 * shelf differ by a word, so the type/cost/description/category are here to
 * catch a wrong row BEFORE a code is written onto it.
 *
 * Reuses the register's own keypad rather than a text field — the till is a
 * touch screen, and every other numeric entry on this screen is this keypad.
 */
const AssociateBarcodeDialog = ({ open, barcode, product, saving, onAssociate, onClose }) => {
  const [value, setValue] = useState('');

  // Reseed per opening, not per render, so typing is never clobbered.
  useEffect(() => {
    if (open) setValue('');
  }, [open, product?.id]);

  if (!open || !product) return null;

  const confirm = () => {
    if (saving) return;
    // Blank means "one unit per scan" — the overwhelmingly common case, and
    // making the operator type 1 for it would be busywork.
    const parsed = parseInt(value, 10);
    onAssociate(Number.isFinite(parsed) && parsed > 0 ? parsed : 1);
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      PaperProps={{
        sx: {
          width: 460,
          maxWidth: '100%',
          // Short till screens: the card + keypad can outgrow the viewport, and
          // an overflowing dialog hid the Associate button entirely. Cap the
          // paper and let the BODY scroll, so the header stays put and the
          // buttons are always reachable at the end of that scroll.
          maxHeight: 'calc(100vh - 32px)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '12px',
          bgcolor: '#fff',
          overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(15,23,42,0.28)',
        },
      }}
      slotProps={{ backdrop: { sx: { backgroundColor: 'rgba(0,0,0,0.3)' } } }}
    >
      {/* Light blue titled header, matching the reference's dialog chrome */}
      <Box
        sx={{
          bgcolor: '#CFE9FA',
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexShrink: 0,
          borderBottom: '1px solid #B7DCF3',
        }}
      >
        <Typography component="span" sx={{ color: '#1a6ea8', fontSize: 20, fontWeight: 700 }}>
          ?
        </Typography>
        <Typography sx={{ color: '#1a6ea8', fontSize: 17, fontWeight: 700 }}>
          Associate Product
        </Typography>
      </Box>

      <Box sx={{ p: 2, minHeight: 0, overflowY: 'auto' }}>
        <Typography sx={{ fontSize: 15, color: '#313439', lineHeight: 1.6, mb: 1.5 }}>
          What quantity would you like to associate to{' '}
          <Box component="span" sx={{ fontWeight: 700 }}>
            {product.name}
          </Box>{' '}
          for &quot;{barcode}&quot;?
        </Typography>

        {/* The product's details are NOT repeated here — ProductPreviewCard shows
            them out on the results list, where they can be as tall as they need
            to be without pushing the keypad and Associate button off the bottom
            of this dialog. */}
        <KeypadBody value={value} setValue={setValue} onOk={confirm} mode="qty" showOk={false} />

        {/* Same button pair as the "Product Not Found" step this flow started
            from — the orange Confirm of the line editor read as a warning here. */}
        <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
          <ButtonBase
            onClick={saving ? undefined : onClose}
            sx={{
              flex: 1,
              height: 48,
              bgcolor: '#f4f5f7',
              border: '1px solid #dfe3e8',
              borderRadius: '8px',
              color: '#5f6b76',
              fontSize: 18,
              fontWeight: 500,
              justifyContent: 'center',
              '&:hover': { bgcolor: '#e9ebee' },
            }}
          >
            Cancel
          </ButtonBase>
          <ButtonBase
            onClick={confirm}
            disabled={saving}
            sx={{
              flex: 1,
              height: 48,
              bgcolor: '#2196F3',
              border: '1px solid #2196F3',
              borderRadius: '8px',
              color: '#fff',
              fontSize: 18,
              fontWeight: 700,
              justifyContent: 'center',
              '&:hover': { bgcolor: '#1a86dd', borderColor: '#1a86dd' },
              '&.Mui-disabled': { bgcolor: '#9ecdf3', borderColor: '#9ecdf3', color: '#fff' },
            }}
          >
            {saving ? 'Saving…' : 'Associate'}
          </ButtonBase>
        </Box>
      </Box>
    </Dialog>
  );
};

export default AssociateBarcodeDialog;
