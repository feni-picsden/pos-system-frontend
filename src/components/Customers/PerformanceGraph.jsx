import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import customerService from '../../services/customerService';
import SalesSparkline from '../Common/SalesSparkline';

const PerformanceGraph = ({ customerId, currentOwing, showAmount = true }) => {
  const [performanceData, setPerformanceData] = useState(new Array(12).fill(0));
  const [totalSales, setTotalSales] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    const loadPerformanceData = async () => {
      if (!customerId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await customerService.getCustomerPerformance(customerId);
        
        // Extract monthly sales data
        const monthlyData = response?.data?.last12Months || [];
        const sales = monthlyData.map(month => parseFloat(month.sales || 0));
        
        // Ensure we have exactly 12 months of data
        const data = new Array(12).fill(0);
        if (sales.length > 0) {
          // Take the last 12 months
          const startIndex = Math.max(0, 12 - sales.length);
          for (let i = 0; i < sales.length && (startIndex + i) < 12; i++) {
            data[startIndex + i] = sales[i];
          }
        }
        
        if (isMounted) {
          setPerformanceData(data);
          setTotalSales(response?.data?.totalSales || 0);
        }
      } catch (error) {
        console.error('Error loading customer performance:', error);
        if (isMounted) {
          setPerformanceData(new Array(12).fill(0));
          setTotalSales(0);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadPerformanceData();
    
    return () => {
      isMounted = false;
    };
  }, [customerId]);

  // Size unchanged (120×30); only the drawing is the shared SalesSparkline look.
  const graphWidth = 120;
  const graphHeight = 30;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <SalesSparkline series={performanceData} width={graphWidth} height={graphHeight} />
      {showAmount && (
        <Typography variant="caption" color="text.secondary">
          ${parseFloat(totalSales || 0).toFixed(2)}
        </Typography>
      )}
    </Box>
  );
};

export default PerformanceGraph;
