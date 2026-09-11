import React from 'react';
import { Box, Grid } from '@mui/material';
import SaleKeyTileContent from './SaleKeyTileContent';
import { isDisplayOnlyKey } from '../../utils/saleKeyDisplay';

// Actions that operate on the current sale: the reference gives ALL of these a
// not-allowed cursor (and ignores the click) while the sale is idle/empty,
// unless the key is flagged Prevent Disable.
const SALE_AFFECTING_ACTIONS = new Set([
  'payment',
  'pay-amount',
  'pay-exact-amount',
  'clear-sale',
  'cancel-current-sale',
  'subtract-quantity',
  'add-quantity',
  'add-quantity-barcode',
  'subtract-quantity-barcode',
  'flip-sale',
  'return-item',
  'apply-discount',
  'reweigh',
  'pay-loyalty',
]);

const SaleKeysGrid = ({
  saleKeyConfig,
  cart,
  onSaleKeyClick,
  caseModeActive = false,
}) => {
  if (!saleKeyConfig || !saleKeyConfig.saleKeys) {
    return null;
  }

  return (
    <Grid 
      container 
      sx={{ 
        height: '100%',
        position: 'relative',
      }}
    >
      {(Array.isArray(saleKeyConfig.saleKeys) ? saleKeyConfig.saleKeys : []).map((saleKey) => {
        if (!saleKey || !saleKey.position) {
          console.warn('Invalid sale key data:', saleKey);
          return null;
        }
        
        const width = saleKey.size?.width || saleKey.position.w || 1;
        const height = saleKey.size?.height || saleKey.position.h || 1;
        
        const cellWidth = 100 / saleKeyConfig.gridSize.cols;
        const cellHeight = 100 / saleKeyConfig.gridSize.rows;
        
        // A key may have no name (artwork only), so never assume one.
        const isSaleAffectingKey = SALE_AFFECTING_ACTIONS.has(saleKey.action) ||
                           ((saleKey.name || '').toLowerCase().includes('cash') && saleKey.amount);
        const isIdleDisabled = isSaleAffectingKey && cart.length === 0 && !saleKey.behavior?.preventDisable;
        const isKeyDisabled = saleKey.behavior?.disableKey || isIdleDisabled;
        // Time, legal-age date and info keys show their value on the tile and
        // do nothing when pressed - no dialog, no not-allowed cursor.
        const isDisplayOnly = isDisplayOnlyKey(saleKey);
        // Highlight armed Use Case Quantity keys so the active mode is visible.
        const isCaseModeKey = caseModeActive && saleKey.action === 'use-case-quantity';

        // Reference keeps every tile label at 16px whatever the tile spans.
        const labelSize = Math.max(saleKey.fontSize || 16, 16);

        return (
          <Box
            key={saleKey.id}
            sx={{
              position: 'absolute',
              left: `${(saleKey.position.x || 0) * cellWidth}%`,
              top: `${(saleKey.position.y || 0) * cellHeight}%`,
              width: `${width * cellWidth}%`,
              height: `${height * cellHeight}%`,
              backgroundColor: saleKey.backgroundColor || '#4CAF50',
              color: saleKey.textColor || '#FFFFFF',
              // Reference tile base: 1px WHITE border, square, no shadow — the
              // white hairline is what draws the grid's tile gutters.
              border: isCaseModeKey ? '3px solid #0284c7' : '1px solid #ffffff',
              boxShadow: isCaseModeKey ? 'inset 0 0 0 2px #f8f8f8' : 'none',
              display: 'flex',
              // Artwork above the label, both centred, zero padding - the same
              // stack both designers draw. It used to be a row, which put the
              // price beside the name instead of under it: on a narrow key that
              // ran past the tile edge and the next key, painted after it, cut
              // it off ("$20.0", "$2.0"). Clipping is hidden here rather than
              // with overflow, so a filled image can still cover the tile.
              flexDirection: 'column',
              gap: '4px',
              alignItems: 'center',
              overflow: 'hidden',
              justifyContent: 'center',
              cursor: isDisplayOnly ? 'default' : (isKeyDisabled ? 'not-allowed' : 'pointer'),
              fontSize: labelSize,
              // Reference marks an unusable key with the CURSOR only — the tile keeps
              // its configured colour (no dim/filter was measured on the reference).
              filter: 'none',
              transition: 'background-color 0.2s',
              boxSizing: 'border-box',
              padding: 0,
              margin: 0,
              textAlign: 'center',
            }}
            onClick={isKeyDisabled || isDisplayOnly ? undefined : () => onSaleKeyClick(saleKey)}
          >
            <SaleKeyTileContent saleKey={saleKey} />
          </Box>
        );
      })}
    </Grid>
  );
};

export default SaleKeysGrid;
