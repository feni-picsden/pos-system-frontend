import React, { useState } from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { ShowChart, PieChart as PieIcon, HelpOutline } from '@mui/icons-material';
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as ChartTooltip, PieChart, Pie, Cell } from 'recharts';
import { kpiSeries, outletColor } from '../../utils/reportingDashboard';

export default function ReportingKPI({ title, metric, description, outlets = [], history = [], format, compare, showOutletNames = true }) {
  const [mode, setMode] = useState(['revenue', 'discountAmount', 'profitPercentage'].includes(metric) ? 'pie' : 'line');
  const data = kpiSeries(outlets, metric);
  const pie = history.filter(b => Number(b[metric]) > 0).map(b => ({ name: b.time, value: Number(b[metric]) }));
  const negatives = history.some(b => Number(b[metric]) < 0);
  const count = ['saleCount', 'customerCount'].includes(metric);
  const pieColors = ['#85c7ae', '#a7dfe2', '#d57dd1', '#e7a17f', '#91b5e8', '#b3ca75', '#c799b5'];
  const pieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value, percent }) => {
    // Small slices retain their exact values in the legend and tooltip.
    if (percent < 0.06) return null;
    const radius = (innerRadius + outerRadius) / 2;
    const angle = -midAngle * Math.PI / 180;
    return <text x={cx + radius * Math.cos(angle)} y={cy + radius * Math.sin(angle)}
      textAnchor="middle" dominantBaseline="central" fontSize={13} fill="#173344">{format(value)}</text>;
  };
  return (
    <Box sx={{ p: 2, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minHeight: 50, mb: 1 }}>
        <Typography sx={{ fontSize: 24, lineHeight: 1.2, minWidth: 0 }}>{title}
          <Tooltip title={description}><HelpOutline sx={{ fontSize: 16, ml: 0.5, verticalAlign: 'middle' }} /></Tooltip>
        </Typography>
        <Box sx={{ display: 'flex', flexShrink: 0 }}>
          {[['line', ShowChart], ['pie', PieIcon]].map(([type, Icon]) => (
            <IconButton key={type} aria-label={`${title} ${type} chart`} onClick={() => setMode(type)}
              sx={{ borderRadius: 0, p: 0, width: 54, height: 50, border: '1px solid #000', bgcolor: mode === type ? '#1c9ee1' : '#313439', color: '#fff', '&:hover': { bgcolor: '#0e4e6f' } }}>
              {React.createElement(Icon, { sx: { fontSize: 18 } })}
            </IconButton>
          ))}
        </Box>
      </Box>
      {outlets.map(o => (
        <Box key={o.id ?? 'global'} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, px: 1, height: 35, bgcolor: `${outletColor(o.id)}55`, fontSize: 16, lineHeight: '19px' }}>
          {showOutletNames && <Box component="span" title={o.name} sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</Box>}
          <Box component="span" sx={{ flexShrink: 0 }}>{format(o[metric])}</Box>
        </Box>
      ))}
      <Box sx={{ height: 300, mt: 2 }}>
        {mode === 'line' ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 6, left: -12, right: 6, bottom: 26 }}>
              <CartesianGrid stroke="#eee" />
              <XAxis dataKey="time" tick={{ fontSize: 13 }} angle={-40} textAnchor="end" interval="preserveStartEnd" minTickGap={8} height={60} />
              <YAxis tick={{ fontSize: 13 }} allowDecimals={!count} tickFormatter={v => format(v)} width={85} />
              <ChartTooltip formatter={(v, name) => [format(v), name]} />
              {outlets.map(o => <Area key={o.id ?? 'global'} type="monotone" dataKey={`value_${o.id}`} name={showOutletNames ? o.name : title}
                stroke={outletColor(o.id)} strokeWidth={1.5} fill={outletColor(o.id)} fillOpacity={0.08}
                dot={{ r: 2, strokeWidth: 0 }} activeDot={{ r: 4 }}
                isAnimationActive animationDuration={700} animationEasing="ease-in-out" />)}
              {compare !== 'none' && outlets.map(o => <Line key={`compare_${o.id}`} type="monotone" dataKey={`compare_${o.id}`}
                name={`${showOutletNames ? o.name : title} (${compare.replaceAll('_', ' ')})`} stroke={outletColor(o.id)} strokeWidth={1.5}
                strokeDasharray="5 3" dot={false} isAnimationActive animationDuration={700} animationEasing="ease-in-out" />)}
            </ComposedChart>
          </ResponsiveContainer>
        ) : pie.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ left: 4, right: 4, top: 4, bottom: 4 }}>
              <Pie data={pie} dataKey="value" nameKey="name" innerRadius="40%" outerRadius="78%"
                label={pieLabel} labelLine={false} isAnimationActive animationDuration={700} animationEasing="ease-in-out">
                {pie.map((row, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
              </Pie>
              <ChartTooltip formatter={v => format(v)} />
            </PieChart>
          </ResponsiveContainer>
        ) : <Typography sx={{ p: 3, fontSize: 12, textAlign: 'center', color: 'text.secondary' }}>No positive values for pie chart. Use the line chart to see all values.</Typography>}
      </Box>
      {mode === 'pie' && pie.length > 0 && <Box component="ul" aria-label={`${title} chart values`}
        sx={{ listStyle: 'none', m: 0, p: 0, maxHeight: 120, overflowY: 'auto', fontSize: 14 }}>
        {pie.map((row, i) => <Box component="li" key={`${row.name}-${i}`}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
          <Box component="span" sx={{ width: 10, height: 10, flexShrink: 0, bgcolor: pieColors[i % pieColors.length] }} />
          <Box component="span" sx={{ flex: 1 }}>{row.name}</Box>
          <Box component="span">{format(row.value)}</Box>
        </Box>)}
      </Box>}
      {mode === 'pie' && negatives && <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Negative values are shown in the line chart.</Typography>}
      {mode === 'line' && compare !== 'none' && <Typography sx={{ fontSize: 11 }}>Dashed lines: {compare.replaceAll('_', ' ')}</Typography>}
    </Box>
  );
}
