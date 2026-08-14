import React from 'react';
import { Box, Grid, Typography } from '@mui/material';

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
  getIconForSaleKey,
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
        
        const isSaleAffectingKey = SALE_AFFECTING_ACTIONS.has(saleKey.action) ||
                           (saleKey.name.toLowerCase().includes('cash') && saleKey.amount);
        const isIdleDisabled = isSaleAffectingKey && cart.length === 0 && !saleKey.behavior?.preventDisable;
        const isKeyDisabled = saleKey.behavior?.disableKey || isIdleDisabled;
        // Highlight armed Use Case Quantity keys so the active mode is visible.
        const isCaseModeKey = caseModeActive && saleKey.action === 'use-case-quantity';

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
              // Reference tile content: centred ROW, zero padding, overflow visible.
              flexDirection: 'row',
              gap: '4px',
              alignItems: 'center',
              overflow: 'visible',
              justifyContent: 'center',
              cursor: isKeyDisabled ? 'not-allowed' : 'pointer',
              // Reference keeps every tile label at 16px/400 whatever the tile spans.
              fontSize: Math.max(saleKey.fontSize || 16, 16),
              fontWeight: saleKey.textStyle?.bold ? 'bold' : 'normal',
              fontStyle: saleKey.textStyle?.italic ? 'italic' : 'normal',
              textDecoration: saleKey.textStyle?.underline ? 'underline' : 'none',
              // Reference marks an unusable key with the CURSOR only — the tile keeps
              // its configured colour (no dim/filter was measured on the reference).
              filter: 'none',
              transition: 'background-color 0.2s',
              boxSizing: 'border-box',
              padding: 0,
              margin: 0,
              textAlign: 'center',
            }}
            onClick={isKeyDisabled ? undefined : () => onSaleKeyClick(saleKey)}
          >
            {saleKey.image ? (      
              <img 
                src={saleKey.image} 
                alt={saleKey.name}
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'contain',
                }}
              />
            ) : (
              <Box sx={{ fontSize: `${Math.max(saleKey.fontSize || 16, 16)}px`, display: 'flex' }}>
                {getIconForSaleKey(saleKey)}
              </Box>
            )}
            
            <Typography
              component="div"
              sx={{
                textAlign: 'center',
                fontSize: `${Math.max(saleKey.fontSize || 16, 16)}px`,
                fontWeight: saleKey.textStyle?.bold ? 'bold' : 'normal',
                fontStyle: saleKey.textStyle?.italic ? 'italic' : 'normal',
                textDecoration: saleKey.textStyle?.underline ? 'underline' : 'none',
                letterSpacing: 'normal',
                lineHeight: 1.2,
              }}
            >
              {(saleKey.action === 'payment' || saleKey.action === 'pay-amount') && saleKey.amount ? (
                <>
                  <Box sx={{ fontSize: `${Math.max((saleKey.fontSize || 16) + 4, 20)}px`, fontWeight: 'bold', mb: 0.5 }}>
                    ${saleKey.amount}
                  </Box>
                  {saleKey.name}
                </>
              ) : (
                saleKey.name
              )}
            </Typography>
            
            {saleKey.amount && saleKey.action !== 'payment' && saleKey.action !== 'pay-amount' && (
              <Typography sx={{
                mt: 0.5,
                // Reference has no smaller size variant — every tile label is 16px.
                fontSize: `${Math.max(saleKey.fontSize || 16, 16)}px`,
                letterSpacing: 'normal',
                lineHeight: 1.2
              }}>
                ${saleKey.amount}
              </Typography>
            )}
          </Box>
        );
      })}
    </Grid>
  );
};

export default SaleKeysGrid;
