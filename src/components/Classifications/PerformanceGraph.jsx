import React, { useState, useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';
import classificationService from '../../services/classificationService';
import supplierService from '../../services/supplierService';
import SalesSparkline from '../Common/SalesSparkline';

const PerformanceGraph = ({ classificationId, supplierId, productCount, type = 'classification', width = 120, height = 30 }) => {
  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(true);

  const id = classificationId || supplierId;

  useEffect(() => {
    if (id && productCount > 0) {
      loadPerformanceData();
    } else {
      setLoading(false);
    }
  }, [id, productCount, type]);

  const loadPerformanceData = async () => {
    try {
      setLoading(true);
      const service = type === 'supplier' ? supplierService : classificationService;
      const method = type === 'supplier' ? 'getSupplierPerformance' : 'getClassificationPerformance';
      const response = await service[method](id, '12months');
      
      if (response?.performanceData?.monthlySales) {
        // Generate all 12 months (last 12 months) and map sales data
        const now = new Date();
        const salesMap = {};
        
        response.performanceData.monthlySales.forEach((item) => {
          salesMap[item.month] = parseFloat(item.sales) || 0;
        });

        const allMonths = [];
        for (let i = 11; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          const key = `${year}-${String(month).padStart(2, "0")}`;
          
          allMonths.push(salesMap[key] || 0);
        }
        
        setSalesData(allMonths);
      } else {
        // If no data, fill with zeros
        setSalesData(new Array(12).fill(0));
      }
    } catch (err) {
      console.error('Error loading performance data:', err);
      // Fill with zeros on error
      setSalesData(new Array(12).fill(0));
    } finally {
      setLoading(false);
    }
  };

  // No products → no sales: a flat baseline, same as a product with no sales.
  if (productCount === 0) {
    return <SalesSparkline series={new Array(12).fill(0)} width={width} height={height} />;
  }

  if (loading) {
    return (
      <Box
        sx={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress size={14} sx={{ color: '#5ebbeb' }} />
      </Box>
    );
  }

  // Ensure we have 12 data points
  const dataArray = salesData.length === 12 ? salesData : new Array(12).fill(0);
  return <SalesSparkline series={dataArray} width={width} height={height} />;
};

export default PerformanceGraph;
