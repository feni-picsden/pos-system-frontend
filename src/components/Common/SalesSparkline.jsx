import React from 'react';
import { Box } from '@mui/material';

// One look for every "Performance" graph (Products, Classifications, Suppliers,
// Customers - user 30/10/2026): smooth curve in #5ebbeb, thin 1.5px line, very
// light fill, and a flat baseline when there were no sales. Size stays whatever
// each page passes in; only the drawing is shared.
const LINE = '#5ebbeb';
const PAD = 1.5; // keeps the stroke from being clipped at the top/bottom edge

const SalesSparkline = ({ series = [], width = 120, height = 30 }) => {
  const data = series.length ? series.map((v) => Math.max(0, Number(v) || 0)) : new Array(12).fill(0);
  const max = Math.max(...data, 0);
  const plotH = height - PAD * 2;
  const step = data.length > 1 ? width / (data.length - 1) : 0;
  const pts = data.map((v, i) => ({
    x: i * step,
    y: PAD + plotH - (max > 0 ? (v / max) * plotH : 0),
  }));

  const top = PAD;
  const bottom = PAD + plotH;
  let line = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    // Clamp so the curve never dips under the baseline or over the top.
    const cp1y = Math.min(bottom, Math.max(top, p1.y + (p2.y - p0.y) / 6));
    const cp2y = Math.min(bottom, Math.max(top, p2.y - (p3.y - p1.y) / 6));
    line += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  const area = `${line} L ${pts[pts.length - 1].x} ${bottom} L 0 ${bottom} Z`;

  return (
    <Box sx={{ width, height, display: 'flex', alignItems: 'center' }}>
      <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
        {max > 0 && <path d={area} fill={LINE} fillOpacity="0.1" />}
        <path d={line} stroke={LINE} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Box>
  );
};

export default SalesSparkline;
