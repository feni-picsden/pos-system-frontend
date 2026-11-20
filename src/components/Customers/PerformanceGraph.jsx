import React, { useCallback } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import customerService from '../../services/customerService';
import SalesSparkline from '../Common/SalesSparkline';
import useLazyRowLoad from '../../utils/useLazyRowLoad';

const EMPTY = { series: new Array(12).fill(0), totalSales: 0 };

// Extract monthly sales data; ensure exactly 12 months (right-aligned).
const toResult = (response) => {
  const monthlyData = response?.data?.last12Months || [];
  const sales = monthlyData.map((month) => parseFloat(month.sales || 0));
  const data = new Array(12).fill(0);
  if (sales.length > 0) {
    const startIndex = Math.max(0, 12 - sales.length);
    for (let i = 0; i < sales.length && (startIndex + i) < 12; i++) {
      data[startIndex + i] = sales[i];
    }
  }
  return { series: data, totalSales: response?.data?.totalSales || 0 };
};

const PerformanceGraph = ({ customerId, currentOwing, showAmount = true }) => {
  // Loaded once the row is on screen (see useLazyRowLoad), not on list render.
  const loader = useCallback(
    () => customerService.getCustomerPerformance(customerId).then(toResult).catch((error) => {
      console.error('Error loading customer performance:', error);
      return EMPTY;
    }),
    [customerId]
  );
  const { ref, data, loading } = useLazyRowLoad(customerId || null, loader);

  // Size unchanged (120×30); only the drawing is the shared SalesSparkline look.
  const graphWidth = 120;
  const graphHeight = 30;

  if (loading) {
    return (
      <Box ref={ref} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            width: graphWidth,
            height: graphHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CircularProgress size={14} sx={{ color: '#5ebbeb' }} />
        </Box>
        {showAmount && (
          <Typography variant="caption" color="text.secondary">
            ${parseFloat(currentOwing || 0).toFixed(2)}
          </Typography>
        )}
      </Box>
    );
  }

  const result = data || EMPTY;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <SalesSparkline series={result.series} width={graphWidth} height={graphHeight} />
      {showAmount && (
        <Typography variant="caption" color="text.secondary">
          ${parseFloat(result.totalSales || 0).toFixed(2)}
        </Typography>
      )}
    </Box>
  );
};

export default PerformanceGraph;
