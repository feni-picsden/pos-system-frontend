import React, { useState, useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';
import classificationService from '../../services/classificationService';
import supplierService from '../../services/supplierService';

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

  if (productCount === 0) {
    return (
      <Box
        sx={{
          width,
          height,
        }}
      />
    );
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
        <CircularProgress size={14} sx={{ color: '#2196f3' }} />
      </Box>
    );
  }

  // Ensure we have 12 data points
  const dataArray = salesData.length === 12 ? salesData : new Array(12).fill(0);
  const maxValue = Math.max(...dataArray, 1);

  const graphWidth = width;
  const graphHeight = height;
  const plotWidth = graphWidth;
  const plotHeight = graphHeight;
  const pointWidth = dataArray.length > 1 ? plotWidth / (dataArray.length - 1) : 0;

  // Generate path for the line
  const generatePath = () => {
    let path = '';
    dataArray.forEach((value, index) => {
      const x = index * pointWidth;
      const y = graphHeight - (value / maxValue) * plotHeight;
      
      if (index === 0) {
        path += `M ${x} ${y}`;
      } else {
        path += ` L ${x} ${y}`;
      }
    });
    return path;
  };

  // Generate area path - fill to bottom
  const generateAreaPath = (linePath) => {
    const lastX = (dataArray.length - 1) * pointWidth;
    return `${linePath} L ${lastX} ${graphHeight} L 0 ${graphHeight} Z`;
  };

  const linePath = generatePath();
  const areaPath = generateAreaPath(linePath);

  return (
    <Box
      sx={{
        width: graphWidth,
        height: graphHeight,
        backgroundColor: '#fff',
        position: 'relative',
        overflow: 'visible',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <svg
        width={graphWidth}
        height={graphHeight}
        style={{ display: 'block' }}
      >
        {/* Area fill - light blue */}
        <path
          d={areaPath}
          fill="#e3f2fd"
          fillOpacity="0.5"
        />
        
        {/* Line - blue */}
        <path
          d={linePath}
          stroke="#2196f3"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Box>
  );
};

export default PerformanceGraph;
