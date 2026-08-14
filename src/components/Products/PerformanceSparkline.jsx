import React, { useEffect, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import productService from '../../services/productService';

const PerformanceSparkline = ({ productId, width = 120, height = 30 }) => {
  const [series, setSeries] = useState(new Array(12).fill(0));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const res = await productService.getProductSalesSummary(productId, 'monthly');

        // Backend returns human-readable months (e.g., "January 2025") in
        // res.summary.last12Months, newest-first. Convert to chronological values.
        const monthly = res?.summary?.last12Months || res?.data?.summary?.last12Months || [];
        // Build exactly 12 points, oldest -> newest, right-aligned so the last
        // point is always the most recent month.
        let data = new Array(12).fill(0);
        if (Array.isArray(monthly) && monthly.length > 0) {
          const valuesOldestToNewest = [...monthly]
            .slice(0, 12) // keep at most 12
            .reverse() // now oldest -> newest
            .map(m => parseFloat(m.sales ?? m.items ?? 0) || 0);
          const start = 12 - valuesOldestToNewest.length;
          for (let i = 0; i < valuesOldestToNewest.length; i++) {
            data[start + i] = valuesOldestToNewest[i];
          }
        }

        if (isMounted) setSeries(data);
      } catch (e) {
        if (isMounted) setSeries(new Array(12).fill(0));
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    if (productId) load();
    return () => { isMounted = false; };
  }, [productId]);

  if (loading) {
    return (
      <Box sx={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={14} sx={{ color: '#2196f3' }} />
      </Box>
    );
  }

  const maxValue = Math.max(...series, 1);
  const pointWidth = series.length > 1 ? width / (series.length - 1) : 0;
  const baselineY = height; // Baseline is at the bottom

  const buildLine = () => {
    if (series.length === 0) return "";
    if (series.length === 1) {
      const x = 0;
      const y = height - (Math.max(0, series[0]) / maxValue) * height;
      return `M ${x} ${y}`;
    }
    
    const points = series.map((v, i) => ({
      x: i * pointWidth,
      y: height - (Math.max(0, v) / maxValue) * height
    }));
    
    let path = `M ${points[0].x} ${points[0].y}`;
    
    // Create smooth curves between points using cubic Bezier
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      
      // Calculate control points for smooth curve
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      let cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      let cp2y = p2.y - (p3.y - p1.y) / 6;
      
      // Clamp control points to stay within bounds (0 to height)
      cp1y = Math.max(0, Math.min(baselineY, cp1y));
      cp2y = Math.max(0, Math.min(baselineY, cp2y));
      
      // Use cubic Bezier curve
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    
    return path;
  };

  const linePath = buildLine();
  const areaPath = `${linePath} L ${(series.length - 1) * pointWidth} ${height} L 0 ${height} Z`;

  return (
    <Box sx={{ width, height }}>
      <svg width={width} height={height} style={{ display: 'block' }}>
        <path d={areaPath} fill="#e3f2fd" fillOpacity="0.5" />
        <path d={linePath} stroke="#2196f3" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Box>
  );
};

export default PerformanceSparkline;


