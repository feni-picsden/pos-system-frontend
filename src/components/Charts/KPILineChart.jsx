import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tooltip,
} from '@mui/material';
// Reference series colours (.report-dashboard-graph)
const PRIMARY_SERIES = '#e96f9d';
const COMPARE_SERIES = '#f97fad';
import {
  ShowChart as ShowChartIcon,
  PieChart as PieChartIcon,
  HelpOutline as HelpOutlineIcon,
} from '@mui/icons-material';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const KPILineChart = ({
  title,
  value,
  data = [],
  dataKey = 'value',
  formatValue = (v) => v,
  height = 200,
  color = PRIMARY_SERIES,
  description = '',
  showComparison = false,
  outletName = '',
}) => {
  const [chartType, setChartType] = useState('line'); // 'line' or 'pie'

  const prepareChartData = () => {
    if (!data || data.length === 0) {
      return [];
    }

    // Data is already prepared with { time, value, compare } structure
    return data.map((item) => ({
      time: item.time,
      value: item.value || 0,
      compare: item.compare || 0,
    }));
  };

  const preparePieData = () => {
    if (!data || data.length === 0) {
      return [];
    }

    // Filter out zero values for pie chart and prepare data with formatted labels
    const pieData = data
      .filter((item) => item.value && Number(item.value) > 0)
      .map((item) => {
        const numValue = Number(item.value) || 0;
        return {
          name: item.time,
          value: numValue,
          formattedValue: formatValue(numValue),
        };
      });

    // Calculate total for percentage calculations
    const total = pieData.reduce((sum, item) => sum + item.value, 0);

    // Add percentage to each item
    return pieData.map((item) => ({
      ...item,
      percentage: total > 0 ? ((item.value / total) * 100).toFixed(1) : 0,
    }));
  };

  const chartData = prepareChartData();
  const pieData = preparePieData();

  // Color palette for pie chart
  const PIE_COLORS = [
    '#ec4899', '#f472b6', '#fb7185', '#f87171', '#ef4444',
    '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981',
    '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
    '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#fb923c'
  ];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Paper
          elevation={3}
          sx={{
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            border: `2px solid ${color}`,
            borderRadius: 1,
            p: 1.5,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            {data.time || data.name}
          </Typography>
          <Typography variant="body2" sx={{ color, fontWeight: 700 }}>
            {formatValue(data.value)}
          </Typography>
          {showComparison && (
            <Typography variant="body2" sx={{ color: COMPARE_SERIES, fontWeight: 700 }}>
              {formatValue(data.compare || 0)}
            </Typography>
          )}
        </Paper>
      );
    }
    return null;
  };

  const CustomPieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload || payload[0];
      return (
        <Paper
          elevation={3}
          sx={{
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            border: `2px solid ${color}`,
            borderRadius: 1,
            p: 1.5,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            {data.name}
          </Typography>
          <Typography variant="body2" sx={{ color, fontWeight: 700 }}>
            {data.formattedValue || formatValue(data.value)}
          </Typography>
          {data.percentage && (
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
              {data.percentage}%
            </Typography>
          )}
        </Paper>
      );
    }
    return null;
  };

  const renderCustomLabel = (entry) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent, name, value } = entry;
    const RADIAN = Math.PI / 180;
    
    // Find the formatted value from pieData
    const dataItem = pieData.find(item => item.name === name);
    const displayValue = dataItem?.formattedValue || formatValue(value);

    // For month abbreviations, show full month name if it's a month
    let displayName = name;
    const monthMap = {
      'Jan': 'Jan', 'Feb': 'Feb', 'Mar': 'Mar', 'Apr': 'Apr', 'May': 'May', 'Jun': 'Jun',
      'Jul': 'Jul', 'Aug': 'Aug', 'Sep': 'Sep', 'Oct': 'Oct', 'Nov': 'Nov', 'Dec': 'Dec'
    };
    if (monthMap[name]) {
      displayName = monthMap[name];
    }

    // Position for label inside the segment (center of the segment)
    const innerLabelRadius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const innerX = cx + innerLabelRadius * Math.cos(-midAngle * RADIAN);
    const innerY = cy + innerLabelRadius * Math.sin(-midAngle * RADIAN);

    // Position label outside the donut chart
    const outerLabelRadius = outerRadius + 15;
    const outerX = cx + outerLabelRadius * Math.cos(-midAngle * RADIAN);
    const outerY = cy + outerLabelRadius * Math.sin(-midAngle * RADIAN);

    // Only show labels if segment is large enough (more than 3%)
    if (percent < 0.03) {
      // Still show value inside even for small segments
      return (
        <text
          x={innerX}
          y={innerY}
          fill="white"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={12}
          fontWeight={700}
          style={{ pointerEvents: 'none' }}
        >
          {displayValue}
        </text>
      );
    }

    return (
      <g>
        {/* Value inside the segment */}
        <text
          x={innerX}
          y={innerY}
          fill="white"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={12}
          fontWeight={700}
          style={{ pointerEvents: 'none' }}
        >
          {displayValue}
        </text>
        {/* Month name outside the chart */}
        <text
          x={outerX}
          y={outerY}
          fill="#374151"
          textAnchor={outerX > cx ? 'start' : 'end'}
          dominantBaseline="central"
          fontSize={12}
          fontWeight={600}
          style={{ pointerEvents: 'none' }}
        >
          {displayName}
        </text>
      </g>
    );
  };

  return (
    <Box
      sx={{
        p: 2,
        mb: 4,
        height: 433,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'transparent',
        border: 'none',
        borderRadius: 0,
        boxShadow: 'none',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography sx={{ fontSize: 24, fontWeight: 400, color: 'rgb(0, 0, 0)', lineHeight: 1.2 }}>
            {title}
          </Typography>
          <Tooltip
            title={description || title}
            placement="top"
            slotProps={{
              tooltip: {
                sx: {
                  backgroundColor: '#1c1c1c',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 400,
                  borderRadius: 0,
                  padding: '8px 12px',
                  maxWidth: 300,
                },
              },
            }}
          >
            <HelpOutlineIcon
              sx={{ width: 20, height: 16, color: '#5e5e5e', ml: '4px', cursor: 'pointer' }}
            />
          </Tooltip>
        </Box>
        <Box sx={{ display: 'inline-flex' }}>
          {[
            { type: 'line', icon: <ShowChartIcon sx={{ fontSize: 18, color: '#f8f8f8' }} /> },
            { type: 'pie', icon: <PieChartIcon sx={{ fontSize: 18, color: '#f8f8f8' }} /> },
          ].map(({ type, icon }) => {
            const selected = chartType === type;
            return (
              <Box
                component="button"
                type="button"
                key={type}
                onClick={() => setChartType(type)}
                sx={{
                  width: 26,
                  height: 26,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  borderRadius: 0,
                  cursor: 'pointer',
                  color: '#f8f8f8',
                  backgroundColor: selected ? '#1c9ee1' : '#313439',
                  transition: 'background 0.4s ease, color 0.2s ease-in-out',
                  '&:hover': { backgroundColor: selected ? '#1c9ee1' : '#0e4e6f' },
                }}
              >
                {icon}
              </Box>
            );
          })}
        </Box>
      </Box>

      <Box sx={{ mb: 1,display: 'flex',alignItems: 'center',justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' , fontSize: '1rem'}}>
          {formatValue(value)}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {outletName}
        </Typography>
      </Box>

      <Box sx={{ flex: 1, minHeight: height, height: height }}>
        {chartType === 'line' ? (
          chartData.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'text.secondary',
              }}
            >
              <Typography variant="caption">No data available</Typography>
            </Box>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart 
                data={chartData} 
                margin={{ top: 5, right: 10, left: 5, bottom: 30 }}
              >
                <CartesianGrid stroke="#dddddd" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: '#000000' }}
                  angle={-45}
                  textAnchor="end"
                  height={50}
                  interval={0}
                  tickFormatter={(value) => {
                    if (typeof value === 'string') {
                      if (value.length <= 5) return value;
                      if (value.includes(':')) {
                        const parts = value.split(' ');
                        return parts[parts.length - 1] || value.substring(0, 5);
                      }
                      return value.substring(0, 8);
                    }
                    return value;
                  }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#000000' }}
                  width={50}
                  domain={['auto', 'auto']}
                  tickFormatter={(value) => {
                    if (typeof value === 'number') {
                      if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
                      if (Math.abs(value) < 1 && Math.abs(value) > 0) return value.toFixed(2);
                      return value.toFixed(0);
                    }
                    return value;
                  }}
                />
                <RechartsTooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  fill={color}
                  fillOpacity={0.1}
                  dot={false}
                  activeDot={{ r: 4, fill: color, stroke: '#fff', strokeWidth: 2 }}
                  isAnimationActive={true}
                  animationDuration={300}
                />
                {showComparison && (
                  <Area
                    type="monotone"
                    dataKey="compare"
                    stroke={COMPARE_SERIES}
                    strokeWidth={2}
                    fill={COMPARE_SERIES}
                    fillOpacity={0.1}
                    dot={false}
                    activeDot={{ r: 4, fill: COMPARE_SERIES, stroke: '#fff', strokeWidth: 2 }}
                    isAnimationActive={true}
                    animationDuration={300}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          )
        ) : (
          pieData.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'text.secondary',
              }}
            >
              <Typography variant="caption">No data available</Typography>
            </Box>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={renderCustomLabel}
                  outerRadius={Math.min(height * 0.7, 100)}
                  innerRadius={Math.min(height * 0.5, 55)}
                  fill={color}
                  dataKey="value"
                  animationBegin={0}
                  animationDuration={300}
                  paddingAngle={1}
                >
                  {pieData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={PIE_COLORS[index % PIE_COLORS.length]} 
                    />
                  ))}
                </Pie>
                <RechartsTooltip content={<CustomPieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )
        )}
      </Box>
    </Box>
  );
};

export default KPILineChart;

