// A refresh icon turns a full 360° while its list is reloading, so the click is
// visibly doing something even when the reload is quick. Spread into the icon's
// sx: <RefreshIcon sx={spinSx(loading)} />
export const spinSx = (active) => (active
  ? {
      animation: 'sf-spin 0.8s linear infinite',
      '@keyframes sf-spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
    }
  : {});

export default spinSx;
