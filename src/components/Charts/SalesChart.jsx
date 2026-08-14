
import React, { useState } from 'react';
import { 
  Box,
  Typography,
  Paper
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell
} from 'recharts';

const formatCurrency = (value) => {
  const num = Number(value) || 0;
  return `$${num.toFixed(2)}`;
};

const formatDateTime = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};

const LIGHT_PINK = '#f47aa8';
const DARK_PINK = '#e96f9d';

/** Format time key "HH:mm" to display "HH:mm:00" */
const toHalfHourLabel = (timeKey) => {
  if (!timeKey || typeof timeKey !== 'string') return timeKey;
  return timeKey.length === 5 ? `${timeKey}:00` : timeKey;
};

export const SalesChart = ({ 
  height = 300, 
  type = 'bar', 
  data = [], 
  comparisonData = [],
  timelineValue = 'count',
  compare = 'none',
  period = 'day',
  isMainChart = false,
}) => {
  const [hoveredSegment, setHoveredSegment] = useState(null); // { bucketKey, segmentIndex }

  const prepareChartData = () => {
    if (!data || data.length === 0) {
      return [];
    }

    // Main dashboard chart: half-hour buckets
    if (isMainChart) {
      const salesBySlot = data.map((timeSlot) => ({
        time: timeSlot.time,
        displayLabel: toHalfHourLabel(timeSlot.time),
        sales: Array.isArray(timeSlot.sales) ? timeSlot.sales : [],
        saleCount: Number(timeSlot.saleCount || 0),
        revenue: Number(timeSlot.revenue || 0),
      }));

      if (type === 'line') {
        return salesBySlot.map((slot) => ({
          time: slot.time,
          name: slot.time,
          displayLabel: slot.displayLabel,
          value: timelineValue === 'revenue' ? slot.revenue : slot.saleCount,
        }));
      }

      const maxSegments = Math.max(1, ...salesBySlot.map((s) => s.sales.length));
      return salesBySlot.map((slot) => {
        const row = {
          time: slot.time,
          name: slot.time,
          displayLabel: slot.displayLabel,
          sales: slot.sales,
          saleCount: slot.saleCount,
          revenue: slot.revenue,
        };
        for (let i = 0; i < maxSegments; i++) {
          const sale = slot.sales[i];
          row[`seg_${i}`] = timelineValue === 'revenue' ? (sale ? Number(sale.revenue || 0) : 0) : (sale ? 1 : 0);
        }
        return row;
      });
    }

    const chartData = [];

    data.forEach((timeSlot) => {
      const sales = Array.isArray(timeSlot.sales) ? timeSlot.sales : [];

      if (sales.length === 0) {
        chartData.push({
          time: timeSlot.time,
          name: timeSlot.time,
          value:
            timelineValue === 'revenue'
              ? Number(timeSlot.revenue || 0)
              : Number(timeSlot.saleCount || 0),
          saleDetails: null,
          colorIndex: 0,
          displayLabel: `${timeSlot.time}`,
        });
        return;
      }

      sales.forEach((sale, index) => {
        chartData.push({
          time: timeSlot.time,
          name: timeSlot.time,
          value: timelineValue === 'revenue' ? sale.revenue : 1,
          saleDetails: sale,
          colorIndex: index % 2, 
          displayLabel: `${timeSlot.time}`,
        });
      });
    });

    return chartData;
  };

  const chartData = prepareChartData();
  const isMainBarStacked = isMainChart && type === 'bar' && chartData.length > 0;
  const maxSegments = isMainBarStacked
    ? Math.max(1, ...(data || []).map((s) => (Array.isArray(s.sales) ? s.sales : []).length))
    : 0;

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const bucket = payload[0].payload;
    const sales = bucket?.sales;

    if (isMainBarStacked && Array.isArray(sales) && sales.length > 0) {
      const bucketKey = bucket.displayLabel;
      const segmentIndex = hoveredSegment?.bucketKey === bucketKey ? hoveredSegment.segmentIndex : null;
      const sale = segmentIndex != null && sales[segmentIndex] ? sales[segmentIndex] : null;
      if (!sale) return null;
      // Reference `.report-dashboard-tooltip`: 295px, white, square, no shadow,
      // 16px colour strip then a plain table of per-sale rows.
      const rows = [
        ['Outlet', sale.outlet ?? '-'],
        ['Register', sale.register ?? '-'],
        ['User', sale.user ?? '-'],
        ['Revenue', formatCurrency(sale.revenue)],
        ['Invoice Number', sale.invoiceNumber ?? '-'],
        ['Time', sale.time ? formatDateTime(sale.time) : '-'],
      ];
      return (
        <Box sx={{ width: 295, backgroundColor: '#fff', borderRadius: 0, boxShadow: 'none' }}>
          <Box sx={{ height: 16, backgroundColor: DARK_PINK }} />
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
            <Box component="tbody">
              {rows.map(([label, val]) => (
                <Box component="tr" key={label}>
                  <Box component="td" sx={{ display: 'table-cell', padding: '8px 16px', color: '#000', fontSize: 14 }}>
                    {label}
                  </Box>
                  <Box component="td" sx={{ display: 'table-cell', padding: '8px 16px', color: '#000', fontSize: 14 }}>
                    {val}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      );
    }

    if (bucket?.saleDetails) {
      const sale = bucket.saleDetails;
      return (
        <Paper
          elevation={3}
          sx={{
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            border: '2px solid #ec4899',
            borderRadius: 2,
            p: 2,
            minWidth: 280,
          }}
        >
          <Box sx={{ backgroundColor: '#ec4899', color: 'white', p: 1, mb: 1.5, borderRadius: 1, textAlign: 'center' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Sale Details</Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Outlet</Typography>
              <Typography variant="body2">{sale.outlet}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Register</Typography>
              <Typography variant="body2">{sale.register}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>User</Typography>
              <Typography variant="body2">{sale.user}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#ec4899' }}>Revenue</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#ec4899' }}>{formatCurrency(sale.revenue)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Invoice Number</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#2563eb' }}>{sale.invoiceNumber}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5, pt: 1, borderTop: '1px solid #e5e7eb' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Time</Typography>
              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>{formatDateTime(sale.time)}</Typography>
            </Box>
          </Box>
        </Paper>
      );
    }
    return null;
  };

  const renderChart = () => {
    if (!chartData || chartData.length === 0) {
      return (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: height,
          color: 'text.secondary' 
        }}>
          <Typography variant="body1">No data available for the selected period</Typography>
        </Box>
      );
    }

    const yAxisLabel = timelineValue === 'revenue' ? 'Revenue' : 'Sale Count';
    const yTickFormatter = timelineValue === 'revenue' ? (v) => formatCurrency(v) : undefined;

    const colors = [LIGHT_PINK, DARK_PINK];

    switch (type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart
              data={chartData}
              onMouseLeave={() => setHoveredSegment(null)}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: isMainChart ? 60 : 50,
              }}
            >
              <CartesianGrid stroke="#dddddd" />
              <XAxis
                dataKey="displayLabel"
                tick={{ fontSize: 11, fill: '#000000' }}
                angle={isMainBarStacked || period === 'day' ? -45 : period === 'year' ? -45 : 0}
                textAnchor={isMainBarStacked || period === 'day' || period === 'year' ? 'end' : 'middle'}
                height={isMainBarStacked || period === 'day' || period === 'year' ? 80 : 30}
                interval={0}
                label={isMainChart ? { value: 'Time', position: 'insideBottom', offset: -2, style: { fontSize: 12, fill: '#000000' } } : undefined}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#000000' }}
                tickFormatter={yTickFormatter}
                width={isMainChart && timelineValue === 'revenue' ? 80 : 60}
                label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#000000' } }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(236, 72, 153, 0.1)' }} />
              {isMainBarStacked ? (
                <>
                  {Array.from({ length: maxSegments }, (_, i) => (
                    <Bar
                      key={`seg_${i}`}
                      dataKey={`seg_${i}`}
                      stackId="main"
                      fill={colors[i % 2]}
                      maxBarSize={60}
                      isAnimationActive={true}
                    >
                      {chartData.map((entry, timeIdx) => (
                        <Cell
                          key={`${timeIdx}-${i}`}
                          fill={colors[i % 2]}
                          onMouseEnter={() => setHoveredSegment({ bucketKey: entry.displayLabel, segmentIndex: i })}
                          onMouseLeave={() => setHoveredSegment(null)}
                          style={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Bar>
                  ))}
                </>
              ) : (
                <Bar dataKey="value" name="Sales" stackId="time" maxBarSize={60}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[entry.colorIndex]} style={{ cursor: 'pointer' }} />
                  ))}
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer>
        );
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart
              data={chartData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 50,
              }}
            >
              <CartesianGrid stroke="#dddddd" />
              <XAxis
                dataKey="displayLabel"
                tick={{ fontSize: 11, fill: '#000000' }}
                angle={period === 'day' ? -45 : period === 'year' ? -45 : 0}
                textAnchor={period === 'day' || period === 'year' ? 'end' : 'middle'}
                height={period === 'day' || period === 'year' ? 70 : 30}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#000000' }}
                tickFormatter={yTickFormatter}
                label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#000000' } }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone" 
                dataKey="value" 
                stroke="#ec4899" 
                strokeWidth={2}
                dot={{ fill: '#ec4899', r: 4 }}
                activeDot={{ r: 6, fill: '#ec4899' }} 
                name="Sales"
              />
            </LineChart>
          </ResponsiveContainer>
        );
      default:
        return (
          <Typography variant="body1" color="text.secondary" align="center">
            Chart type not supported
          </Typography>
        );
    }
  };

  return (
    <Box>
      {renderChart()}
    </Box>
  );
};

export default SalesChart;
