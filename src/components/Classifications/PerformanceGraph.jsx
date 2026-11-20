import React, { useCallback } from 'react';
import { Box, CircularProgress } from '@mui/material';
import classificationService from '../../services/classificationService';
import supplierService from '../../services/supplierService';
import SalesSparkline from '../Common/SalesSparkline';
import { toAppZonedDate } from '../../utils/appDateTime';
import useLazyRowLoad from '../../utils/useLazyRowLoad';

const EMPTY = new Array(12).fill(0);

const toSeries = (response) => {
  if (!response?.performanceData?.monthlySales) return EMPTY;
  // Generate all 12 months (last 12 months) and map sales data - store
  // months (Setup > General > Timezone), as the API buckets them.
  const now = toAppZonedDate(new Date());
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
  return allMonths;
};

const PerformanceGraph = ({ classificationId, supplierId, productCount, type = 'classification', width = 120, height = 30 }) => {
  const id = classificationId || supplierId;

  // Loaded once the row is on screen (see useLazyRowLoad), not on list render.
  const loader = useCallback(() => {
    const service = type === 'supplier' ? supplierService : classificationService;
    const method = type === 'supplier' ? 'getSupplierPerformance' : 'getClassificationPerformance';
    return service[method](id, '12months').then(toSeries).catch((err) => {
      console.error('Error loading performance data:', err);
      return EMPTY;
    });
  }, [id, type]);
  const { ref, data, loading } = useLazyRowLoad(id && productCount > 0 ? `${type}:${id}` : null, loader);

  // No products → no sales: a flat baseline, same as a product with no sales.
  if (productCount === 0) {
    return <SalesSparkline series={EMPTY} width={width} height={height} />;
  }

  if (loading) {
    return (
      <Box
        ref={ref}
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
  const dataArray = Array.isArray(data) && data.length === 12 ? data : EMPTY;
  return <SalesSparkline series={dataArray} width={width} height={height} />;
};

export default PerformanceGraph;
