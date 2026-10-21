import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button, Alert, CircularProgress, Select, MenuItem, Checkbox, ListItemText,
  Typography,
} from '@mui/material';
import SalesChart from '../components/Charts/SalesChart';
import ShoppingCartOutlined from '@mui/icons-material/ShoppingCartOutlined';
import ReportingKPI from '../components/Charts/ReportingKPI';
import ReportTable from '../components/Reports/ReportTable';
import salesService from '../services/salesService';
import useHeaderScope from '../hooks/useHeaderScope';
import { activeTimeline, createRequestGate, money, outletColor, tableWithTotal } from '../utils/reportingDashboard';

const formatCurrency = money;

// Shopfront-parity segmented control (matches reference .inline-select / .inline-select-option)
const SegmentedToggle = ({ value, options, onChange }) => (
  <Box sx={{ display: 'inline-flex', flexWrap: 'wrap', border: '1px solid rgb(0, 0, 0)' }}>
    {options.map((opt) => {
      const selected = opt.value === value;
      return (
        <Box
          component="button"
          type="button"
          key={opt.value}
          onClick={() => onChange(opt.value)}
          sx={{
            height: 51,
            padding: '16px',
            border: 'none',
            borderRadius: 0,
            fontSize: 16,
            fontWeight: 400,
            fontFamily: 'inherit',
            lineHeight: '19px',
            textTransform: 'none',
            cursor: 'pointer',
            color: '#f8f8f8',
            backgroundColor: selected ? '#1c9ee1' : '#313439',
            transition: 'background 0.4s ease, color 0.2s ease-in-out',
            '&:hover': { backgroundColor: selected ? '#1c9ee1' : '#0e4e6f' },
          }}
        >
          {opt.label}
        </Box>
      );
    })}
  </Box>
);

// Group = content-width column; the label matches the toggle width and is centred.
const FilterGroup = ({ label, children }) => (
  <Box sx={{ width: 'fit-content' }}>
    <Typography
      component="p"
      sx={{ m: '16px 0', fontSize: 16, fontWeight: 400, color: 'rgb(0, 0, 0)', textAlign: 'center' }}
    >
      {label}
    </Typography>
    {children}
  </Box>
);

// Help-icon copy (reference shows a real description per graph)
const KPI_DESCRIPTIONS = {
  Revenue: 'The total value of all sales made in the selected time period, including tax.',
  'Sale Count': 'The number of completed sales made in the selected time period.',
  'Customer Count': 'The number of unique customers attached to sales in the selected time period.',
  'Average Sale': 'The average value of a sale in the selected time period (revenue divided by sale count).',
  'Basket Size': 'The average number of items sold per sale in the selected time period.',
  'Gross Profit': 'Revenue less the cost of the products sold in the selected time period.',
  'Discount Amount': 'The total value of discounts and promotional savings given in the selected time period.',
  'Profit Percentage': 'Gross profit expressed as a percentage of revenue for the selected time period.',
};

const KPI_CARDS = [
  { title: 'Revenue', metric: 'revenue', format: formatCurrency },
  { title: 'Sale Count', metric: 'saleCount', format: (v) => String(Math.round(Number(v) || 0)) },
  { title: 'Customer Count', metric: 'customerCount', format: (v) => String(Math.round(Number(v) || 0)) },
  { title: 'Average Sale', metric: 'averageSale', format: formatCurrency },
  { title: 'Basket Size', metric: 'basketSize', format: (v) => Number(v || 0).toFixed(2) },
  { title: 'Gross Profit', metric: 'grossProfit', format: formatCurrency },
  { title: 'Discount Amount', metric: 'discountAmount', format: formatCurrency },
  { title: 'Profit Percentage', metric: 'profitPercentage', format: (v) => `${Number(v || 0).toFixed(2)}%` },
];

// No HTTP response = the device could not reach the server (offline).
const dashboardLoadError = (e) => (!e?.response
  ? 'Failed to load the dashboard — you appear to be offline. Check your connection and try again.'
  : 'Failed to load the dashboard');

const COMPARES = {
  day: ['none', 'last_week', 'last_month', 'last_year'],
  week: ['none', 'last_month', 'last_year'],
  month: ['none', 'last_year'],
  year: ['none'],
};
const COMPARE_LABELS = { none: 'None', last_week: 'Last Week', last_month: 'Last Month', last_year: 'Last Year' };

const ReportsDashboard = () => {
  const { showOutletFilter, headerOutletId, headerRegisterId } = useHeaderScope();
  const [timelineValue, setTimelineValue] = useState('count');
  const [period, setPeriod] = useState('day');
  const [compare, setCompare] = useState('none');
  const [pickedOutlets, setPickedOutlets] = useState([]);
  const [availableOutlets, setAvailableOutlets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const gate = useRef(createRequestGate());
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    const request = gate.current.next();
    setLoading(true);
    setError('');
    salesService.getSalesStats({ period, compare, timeZone,
      ...(headerOutletId != null ? { outletId: headerOutletId } : {}),
      ...(headerRegisterId != null ? { registerId: headerRegisterId } : {}),
      ...(showOutletFilter && pickedOutlets.length ? { outletIds: pickedOutlets.join(',') } : {}),
    }).then(data => {
      if (!gate.current.isCurrent(request)) return;
      setSummary(data);
      setAvailableOutlets(data.availableOutlets || []);
    }).catch(e => {
      if (!gate.current.isCurrent(request)) return;
      setError(dashboardLoadError(e));
      setSummary(null);
    }).finally(() => {
      if (gate.current.isCurrent(request)) setLoading(false);
    });
    const currentGate = gate.current;
    return () => currentGate.invalidate();
  }, [period, compare, timeZone, headerOutletId, headerRegisterId, showOutletFilter, pickedOutlets, refresh]);

  const changePeriod = value => {
    setPeriod(value);
    if (!COMPARES[value].includes(compare)) setCompare('none');
  };
  const productColumns = [
    { field: 'name', headerName: 'Name', width: 350, percentWidth: '67%' },
    { field: 'revenue', headerName: 'Revenue', width: 150, percentWidth: '15%', align: 'center', format: money },
    { field: 'quantity', headerName: 'Quantity', width: 130, percentWidth: '18%', align: 'center' },
  ];
  const userColumns = [
    { field: 'name', headerName: 'Name', width: 300, percentWidth: '15%' },
    { field: 'revenue', headerName: 'Revenue', width: 150, percentWidth: '17%', align: 'center', format: money },
    { field: 'transactionCount', headerName: 'Transaction Count', width: 180, percentWidth: '42%', align: 'center' },
    { field: 'averageSale', headerName: 'Average Sale', width: 150, percentWidth: '26%', align: 'center', format: money },
  ];
  const date = value => new Date(value).toLocaleDateString('en-GB', { timeZone });
  const colors = Object.fromEntries((summary?.outlets || []).map(o => [o.id, outletColor(o.id)]));
  const timeline = activeTimeline(summary?.timeline);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <FilterGroup label="Timeline Value">
          <SegmentedToggle value={timelineValue} onChange={setTimelineValue}
            options={[{ value: 'count', label: 'Sale Count' }, { value: 'revenue', label: 'Revenue' }]} />
        </FilterGroup>
        <FilterGroup label="Time Period">
          <SegmentedToggle value={period} onChange={changePeriod}
            options={['day', 'week', 'month', 'year'].map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }))} />
        </FilterGroup>
        <FilterGroup label="Compare With">
          <SegmentedToggle value={compare} onChange={setCompare}
            options={COMPARES[period].map(value => ({ value, label: COMPARE_LABELS[value] }))} />
        </FilterGroup>
        {showOutletFilter && <FilterGroup label="Outlets">
          <Select multiple displayEmpty size="small" value={pickedOutlets} onChange={e => setPickedOutlets(e.target.value.includes('all') ? [] : e.target.value)}
            inputProps={{ 'aria-label': 'Outlets' }} sx={{ width: 300, maxWidth: '100%', height: 42, mt: 0.5 }}
            renderValue={ids => ids.length ? availableOutlets.filter(o => ids.includes(o.id)).map(o => o.name).join(', ') : 'Select Outlets…'}>
            <MenuItem value="all" disabled={!pickedOutlets.length}>All permitted outlets</MenuItem>
            {availableOutlets.map(o => <MenuItem key={o.id} value={o.id}>
              <Checkbox checked={pickedOutlets.includes(o.id)} /><ListItemText primary={o.name} />
            </MenuItem>)}
          </Select>
        </FilterGroup>}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', px: 1 }}>
        <Button onClick={() => setRefresh(n => n + 1)} disabled={loading}>Refresh</Button>
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
      {loading && <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={26} /></Box>}
      {!loading && !error && summary && <>
        {timeline.length ? <SalesChart height={400} type="bar" data={timeline} timelineValue={timelineValue}
          compare="none" period="day" isMainChart outletColors={colors} showOutletNames={showOutletFilter}
          colorBy={showOutletFilter ? 'outlet' : 'user'} showRegisterNames={headerRegisterId == null} />
          : <Box role="status" sx={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, p: 3, flexWrap: 'wrap' }}>
            <ShoppingCartOutlined aria-hidden="true" sx={{ fontSize: 160, color: 'text.primary' }} />
            <Box>
              <Typography sx={{ fontSize: 24, fontWeight: 600, mb: 3 }}>No Sales Data</Typography>
              <Typography sx={{ fontSize: 16 }}>No completed sales today for the selected outlets or register.</Typography>
            </Box>
          </Box>}
        <Box sx={{ display: 'grid', px: 1, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)', xl: 'repeat(5, 1fr)' }, rowGap: 3 }}>
          {KPI_CARDS.map(card => <ReportingKPI key={card.metric} title={card.title} metric={card.metric}
            description={KPI_DESCRIPTIONS[card.title]} format={card.format} compare={compare}
            outlets={summary.outlets} history={summary.history} showOutletNames={showOutletFilter} />)}
        </Box>
        {[['Top 20 Products', summary.topProducts, productColumns, 'products'], ['Users', summary.topUsers, userColumns, 'users']].map(([title, rows, columns, kind]) => (
          <Box key={title} sx={{ mt: 4, px: 1 }}>
            <Typography sx={{ fontSize: 24, textTransform: 'uppercase', lineHeight: '29px', mb: 1 }}>{title}</Typography>
            <Typography title={date(summary.todayRange.start)} sx={{ fontSize: 16, color: '#b7b7b7', textTransform: 'uppercase', lineHeight: '19px', mb: 1 }}>Since the start of the day</Typography>
            <ReportTable columns={columns} data={tableWithTotal(rows, kind)} hideFooter maxHeight="none" referenceSizing />
          </Box>
        ))}
      </>}
    </Box>
  );
};

export default ReportsDashboard;
