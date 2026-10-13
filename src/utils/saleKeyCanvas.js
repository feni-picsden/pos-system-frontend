// Match the normal POS viewport: 24px horizontal margins/gutter, 70.3% keys,
// a minimum 300px cart, and the keys panel's 1px borders. Vertically reserve
// the 50px header, 16px margins, 2px borders, 50px search and 50px tabs.
// Both designer and POS use these dimensions instead of stretching the saved
// grid into differently sized parent containers.
export const saleKeyCanvasSx = {
  width: 'max(1px, min(calc(70.3vw - 18.872px), calc(100vw - 326px)))',
  height: 'max(1px, calc(100vh - 168px))',
  flexShrink: 0,
  position: 'relative',
};

// The preview panel includes two 1px borders outside the exact canvas width.
// A flex ratio here would shrink it against the settings panel's padding.
export const saleKeyPreviewPanelSx = {
  width: 'max(3px, min(calc(70.3vw - 16.872px), calc(100vw - 324px)))',
  flex: '0 0 auto',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  border: '1px solid #000',
  boxSizing: 'border-box',
};
