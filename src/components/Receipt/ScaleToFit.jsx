import React, { useRef, useState, useLayoutEffect } from 'react';
import { Box } from '@mui/material';

// Proportionally scales its child to fill the available width. A receipt is designed
// at a fixed paper width (e.g. 80mm); rather than reflow it into the narrow cart
// column (which would break its fixed table columns), we render it at natural size
// and scale the whole thing with a measured transform — true WYSIWYG-to-width. The
// outer box reserves the scaled height so the surrounding layout stays correct.
//
// ponytail: measured-transform scaling (ResizeObserver), not CSS zoom — zoom is
// non-standard and prints/exports inconsistently. maxScale caps upscaling so a tiny
// thermal design never blows up to an absurd size on an ultra-wide column.
// maxScale defaults to 1: the reference never enlarges a receipt, it renders the
// design at its natural width and centres it in the column (measured on topdrops
// 2026-08-05 — an 80mm design stays 270px wide in a ~390px sidebar). Only
// shrink-to-fit is allowed.
const ScaleToFit = ({ children, maxScale = 1 }) => {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [{ scale, height }, set] = useState({ scale: 1, height: undefined });

  useLayoutEffect(() => {
    const measure = () => {
      const outer = outerRef.current;
      const inner = innerRef.current;
      if (!outer || !inner) return;
      const natural = inner.scrollWidth || 1;
      const avail = outer.clientWidth || natural;
      const s = Math.min(maxScale, avail / natural);
      set({ scale: s, height: inner.scrollHeight * s });
    };
    measure();
    // Re-measure when the column resizes (window/layout) or the receipt content
    // changes height (different template / more line items).
    const ro = new ResizeObserver(measure);
    if (outerRef.current) ro.observe(outerRef.current);
    if (innerRef.current) ro.observe(innerRef.current);
    return () => ro.disconnect();
  }, [maxScale]);

  return (
    <Box ref={outerRef} sx={{ width: '100%', height, overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
      <Box
        ref={innerRef}
        // max-content lets the receipt lay out at its NATURAL width before scaling.
        // Without it a wide template (A4 / Email) was squeezed by the narrow sidebar
        // first, so scrollWidth read as the sidebar width and the columns wrapped one
        // letter per line instead of the whole receipt scaling down.
        sx={{ display: 'inline-block', width: 'max-content', transformOrigin: 'top left', transform: `scale(${scale})` }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default ScaleToFit;
