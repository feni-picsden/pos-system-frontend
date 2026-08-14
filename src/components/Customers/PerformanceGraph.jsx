import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import customerService from '../../services/customerService';

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

  const maxValue = Math.max(...performanceData, 1); // Avoid division by zero

  // Calculate graph dimensions with padding to prevent clipping
  const graphWidth = 120;
  const graphHeight = 30;
  const padding = 2; // Padding to prevent clipping of dots and curves
  const effectiveWidth = graphWidth - (padding * 2);
  const effectiveHeight = graphHeight - (padding * 2);
  const pointWidth = performanceData.length > 1 ? effectiveWidth / (performanceData.length - 1) : 0;

  // Generate SVG path with smooth curve
  const generatePath = () => {
    if (performanceData.length === 0) return '';
    
    const points = performanceData.map((value, index) => {
      const x = padding + (index * pointWidth);
      const y = padding + (effectiveHeight - (value / maxValue) * effectiveHeight);
      return { x, y };
    });
    
    // Create smooth curve using cubic bezier
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    
    let path = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      
      // Calculate control points for smooth curve
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    
    return path;
  };

  const pathData = generatePath();
  
  // Create area fill path
  const bottomY = padding + effectiveHeight;
  const areaPath = pathData + 
    ` L ${padding + (performanceData.length - 1) * pointWidth} ${bottomY}` +
    ` L ${padding} ${bottomY} Z`;

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
          <CircularProgress size={14} sx={{ color: '#87ceeb' }} />
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
      <Box
        sx={{
          width: graphWidth,
          height: graphHeight,
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
          {/* Area fill */}
          <path
            d={areaPath}
            fill="#87ceeb"
            fillOpacity="0.3"
          />
          {/* Line */}
          <path
            d={pathData}
            stroke="#87ceeb"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Add dots at each data point */}
          {performanceData.map((value, index) => {
            const x = padding + (index * pointWidth);
            const y = padding + (effectiveHeight - (value / maxValue) * effectiveHeight);
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="1.5"
                fill="#87ceeb"
              />
            );
          })}
        </svg>
      </Box>
      {showAmount && (
        <Typography variant="caption" color="text.secondary">
          ${parseFloat(totalSales || 0).toFixed(2)}
        </Typography>
      )}
    </Box>
  );
};

export default PerformanceGraph;
