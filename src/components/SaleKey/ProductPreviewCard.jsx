import React from 'react';
import { Box, Typography } from '@mui/material';
import { splitMoney } from '../StockManagement/productViewStyles';
import { stripHtml } from '../../services/posLocalDb';

const labelSx = { fontSize: 13, color: '#8a939c', lineHeight: 1.4 };
const valueSx = { fontSize: 15, color: '#1a1a1a', lineHeight: 1.35 };

// Label above value, the pairing the reference card uses throughout.
const Field = ({ label, value }) => (
  <Box sx={{ minWidth: 0 }}>
    <Typography sx={labelSx}>{label}</Typography>
    <Typography sx={valueSx}>{value}</Typography>
  </Box>
);

// Cents at 0.7em, matching how money is set everywhere else in the app.
const Money = ({ value }) => {
  const [main, cents] = splitMoney(value);
  return (
    <Box component="span" sx={{ fontWeight: 700 }}>
      {main}
      <Box component="span" sx={{ fontSize: '0.7em' }}>
        {cents}
      </Box>
    </Box>
  );
};

/**
 * Floating product preview shown while an unknown barcode is being associated.
 *
 * It sits OUTSIDE the Associate dialog on purpose: inside, a product with a
 * paragraph-long description pushed the keypad and the Associate button off the
 * bottom of the dialog. Out here it can be as tall as it likes, and the operator
 * reads it while choosing the row rather than after committing to one.
 *
 * Fixed to the viewport rather than anchored to its row, for two reasons the
 * row-anchored version got wrong: the results pane scrolls (`overflow: auto`),
 * which CLIPPED the card at the pane's edge, and the quantity dialog's backdrop
 * sits above the page, which greyed the card out and covered its right half.
 * Fixed positioning escapes the scroll container, and a z-index above the modal
 * layer keeps it readable next to the open dialog.
 *
 * Every field below the header is dropped when the product has no value for it,
 * rather than printed with a dash. A card of real values is read at a glance; a
 * column of placeholders has to be read word by word to find what is actually
 * there. With Supplier absent, Category simply takes the first column.
 */
const ProductPreviewCard = ({ product }) => {
  if (!product) return null;

  const cost = Number(product.itemCost ?? product.caseCost ?? 0);
  const supplier =
    product.suppliers?.[0]?.supplier?.name || product.suppliers?.[0]?.name || '';
  const category = product.category?.name || '';
  // Descriptions are rich text; match what the row shows, not the markup.
  const description = stripHtml(product.description);
  const hasFooter = Boolean(supplier || category);

  return (
    <Box
      sx={{
        position: 'fixed',
        top: '50%',
        transform: 'translateY(-50%)',
        // Anchored to the DIALOG's left edge, not the viewport's: the dialog is
        // centred and 460 wide, so 230 clears it and the rest is the gap the
        // caret spans. Pinned to the far-left instead, the card read as an
        // unrelated panel stranded on the other side of the screen.
        right: 'calc(50% + 246px)',
        // Shrinks rather than sliding under the dialog on a narrower register.
        width: 'min(470px, calc(50vw - 270px))',
        // Above the dialog's backdrop (modal = 1300), so the card stays legible
        // while the quantity dialog is open instead of being dimmed behind it.
        zIndex: (theme) => theme.zIndex.modal + 1,
        px: 2.5,
        py: 2,
        bgcolor: '#fff',
        border: '1px solid #e3e6ea',
        borderRadius: '12px',
        boxShadow: '0 12px 32px rgba(15,23,42,0.28)',
        // Caret pointing at the dialog, tying the two together as one step.
        '&::after': {
          content: '""',
          position: 'absolute',
          top: '50%',
          left: '100%',
          transform: 'translateY(-50%)',
          borderStyle: 'solid',
          borderWidth: '11px 0 11px 13px',
          borderColor: 'transparent transparent transparent #fff',
        },
        // Never intercepts a click meant for the list row or the dialog behind it.
        pointerEvents: 'none',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
        <Field label={product.type || 'Normal'} value={product.name} />
        <Box sx={{ flexShrink: 0, textAlign: 'right' }}>
          <Typography sx={labelSx}>Cost</Typography>
          <Typography sx={valueSx}>
            <Money value={cost} />
          </Typography>
        </Box>
      </Box>

      {description && (
        <Box sx={{ borderTop: '1px solid #e3e6ea', mt: 1.5, pt: 1.5 }}>
          <Typography sx={labelSx}>Description</Typography>
          <Typography
            sx={{
              ...valueSx,
              // Same label-to-value gap as every other field, so the sections
              // sit on one rhythm instead of the description hanging lower.
              mt: 0.25,
              // A paragraph needs more leading than a one-line value does; 1.35
              // set it as a dense block that outweighed the rest of the card.
              lineHeight: 1.55,
              // Some descriptions run to several paragraphs. The card is fixed to
              // the viewport and can't be scrolled (it ignores the pointer), so
              // cap it here rather than let it run off the top and bottom.
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 5,
              overflow: 'hidden',
            }}
          >
            {description}
          </Typography>
        </Box>
      )}

      {hasFooter && (
        <Box sx={{ borderTop: '1px solid #e3e6ea', mt: 1.5, pt: 1.5, display: 'flex', gap: 2 }}>
          {/* Fixed halves, not auto columns: a long supplier name must not shove
              Category out of its column and reflow the card. */}
          {supplier && (
            <Box sx={{ width: '50%', minWidth: 0 }}>
              <Field label="Supplier" value={supplier} />
            </Box>
          )}
          {category && (
            <Box sx={{ width: '50%', minWidth: 0 }}>
              <Field label="Category" value={category} />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default ProductPreviewCard;
