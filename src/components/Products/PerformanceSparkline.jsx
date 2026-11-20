import React, { useCallback } from 'react';
import { Box, CircularProgress } from '@mui/material';
import productService from '../../services/productService';
import SalesSparkline from '../Common/SalesSparkline';
import useLazyRowLoad from '../../utils/useLazyRowLoad';

const EMPTY = new Array(12).fill(0);

// Backend returns human-readable months (e.g., "January 2025") in
// res.summary.last12Months, newest-first. Build exactly 12 points, oldest ->
// newest, right-aligned so the last point is always the most recent month.
const toSeries = (res) => {
  const monthly = res?.summary?.last12Months || res?.data?.summary?.last12Months || [];
  const data = new Array(12).fill(0);
  if (Array.isArray(monthly) && monthly.length > 0) {
    const valuesOldestToNewest = [...monthly]
      .slice(0, 12)
      .reverse()
      .map((m) => parseFloat(m.sales ?? m.items ?? 0) || 0);
    const start = 12 - valuesOldestToNewest.length;
    for (let i = 0; i < valuesOldestToNewest.length; i++) {
      data[start + i] = valuesOldestToNewest[i];
    }
  }
  return data;
};

const PerformanceSparkline = ({ productId, width = 120, height = 30 }) => {
  // Loaded once the row is on screen (see useLazyRowLoad), not on list render.
  const loader = useCallback(
    () => productService.getProductSalesSummary(productId, 'monthly').then(toSeries).catch(() => EMPTY),
    [productId]
  );
  const { ref, data, loading } = useLazyRowLoad(productId || null, loader);

  if (loading) {
    return (
      <Box ref={ref} sx={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={14} sx={{ color: '#5ebbeb' }} />
      </Box>
    );
  }

  return <SalesSparkline series={data || EMPTY} width={width} height={height} />;
};

export default PerformanceSparkline;
