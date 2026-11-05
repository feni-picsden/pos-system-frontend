// Hover styling shared by the sell screen tile and the editor tile: Hover
// Background / Text Colour apply while the pointer is over the key unless
// Prevent Hover is set; Prevent Hover Animation drops the transition.
export const saleKeyHoverSx = (saleKey, hovered) => {
  const b = saleKey.behavior || {};
  const active = hovered && !b.preventHover;
  return {
    backgroundColor: (active && saleKey.hoverBackgroundColor) || saleKey.backgroundColor || '#4CAF50',
    color: (active && saleKey.hoverTextColor) || saleKey.textColor || '#FFFFFF',
    transition: b.preventHoverAnimation ? 'none' : 'background-color 0.2s ease, color 0.2s ease',
  };
};
