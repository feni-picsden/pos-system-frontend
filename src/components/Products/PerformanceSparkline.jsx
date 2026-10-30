import React, { useEffect, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import productService from '../../services/productService';
import SalesSparkline from '../Common/SalesSparkline';

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
      } catch {
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
        <CircularProgress size={14} sx={{ color: '#5ebbeb' }} />
      </Box>
    );
  }

  return <SalesSparkline series={series} width={width} height={height} />;
};

export default PerformanceSparkline;


