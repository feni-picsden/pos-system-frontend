import React from 'react';
import { Box } from '@mui/material';
import { formatMoney } from '../../utils/currency';
import { getIconForSaleKey } from '../../utils/saleKeyIcons';

/**
 * The inside of a sale key: artwork, then the name and price.
 *
 * Shared by the sale screen (SaleKeysGrid) and both designer grids. Each of the
 * three used to carry its own copy, and they had drifted apart - different icons
 * for the same action, the price formatted one way here and another there, and
 * "Fill Key with Image" honoured only in the editor. The caller still owns the
 * tile box itself (position, size, colours, border, cursor); only what goes
 * inside it lives here.
 *
 * The tile must be a positioned element, because a filled image is laid out
 * against it.
 */
const SaleKeyTileContent = ({ saleKey }) => {
  // Reference keeps every tile label at 16px whatever the tile spans, and applies
  // the key's own text styling to the price as well as the name.
  const labelSize = Math.max(saleKey.fontSize || 16, 16);
  const labelSx = {
    fontSize: `${labelSize}px`,
    fontWeight: saleKey.textStyle?.bold ? 'bold' : 'normal',
    fontStyle: saleKey.textStyle?.italic ? 'italic' : 'normal',
    textDecoration: saleKey.textStyle?.underline ? 'underline' : 'none',
    letterSpacing: 'normal',
    lineHeight: 1.2,
  };

  // A payment key leads with the amount, large and bold, and carries its name
  // underneath; every other key shows the amount under its name at label size.
  const isPaymentKey = saleKey.action === 'payment' || saleKey.action === 'pay-amount';
  const amount = saleKey.amount ? formatMoney(saleKey.amount) : null;

  // "Fill Key with Image" makes the artwork the key's background: it covers the
  // tile corner to corner and the label sits on top of it. As an ordinary flex
  // item it could only ever fill the room the label left over, which is what put
  // a band of empty colour under the image.
  const fillsKey = Boolean(saleKey.image && saleKey.fillKeyWithImage);

  return (
    <>
      {saleKey.image ? (
        <Box
          component="img"
          src={saleKey.image}
          alt={saleKey.name}
          sx={fillsKey ? {
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            // Crops to the tile rather than letterboxing, so there is no gap on
            // any edge whatever shape the artwork is.
            objectFit: 'cover',
          } : {
            // The elastic part of the tile: the text keeps its natural size and
            // the artwork gives up whatever room the name and price need, so a
            // long label can never crush it or push it outside the key.
            flex: '1 1 auto',
            minWidth: 0,
            minHeight: 0,
            width: saleKey.constrainImageWidth !== false ? '100%' : 'auto',
            height: saleKey.constrainImageHeight !== false ? '100%' : 'auto',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
          }}
        />
      ) : (
        <Box sx={{ display: 'flex', fontSize: `${labelSize}px` }}>
          {getIconForSaleKey(saleKey)}
        </Box>
      )}

      {(saleKey.name || amount) && (
        <Box
          sx={{
            ...labelSx,
            minWidth: 0,
            // A long product name wraps inside the key instead of running past
            // its edge, where the next key would paint over the overflow.
            maxWidth: '100%',
            overflowWrap: 'anywhere',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            textAlign: 'center',
            // Keeps the label above a filled image, which is out of flow.
            position: 'relative',
            zIndex: 1,
          }}
        >
          {isPaymentKey && amount && (
            <Box sx={{ fontSize: `${Math.max((saleKey.fontSize || 16) + 4, 20)}px`, fontWeight: 'bold' }}>
              {amount}
            </Box>
          )}
          {saleKey.name && <Box>{saleKey.name}</Box>}
          {!isPaymentKey && amount && <Box>{amount}</Box>}
        </Box>
      )}
    </>
  );
};

export default SaleKeyTileContent;
