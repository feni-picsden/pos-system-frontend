import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Typography,
} from '@mui/material';
import SalesChart from '../components/Charts/SalesChart';
import KPILineChart from '../components/Charts/KPILineChart';
import ReportBox from '../components/Reports/ReportBox';
import salesService from '../services/salesService';
import { useAuth } from '../contexts/AuthContext';

const formatCurrency = (value) => {
  const num = Number(value) || 0;
  return `$${num.toFixed(2)}`;
};

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

const ReportsDashboard = () => {
  const { getOutletName } = useAuth();
  const [timelineValue, setTimelineValue] = useState('count');
  const [period, setPeriod] = useState('day'); 
  const [compare, setCompare] = useState('none'); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({
    revenue: 0,
    saleCount: 0,
    customerCount: 0,
    averageSale: 0,
    basketSize: 0,
    grossProfit: 0,
    discountAmount: 0,
    profitPercentage: 0,
    topProducts: [],
    topUsers: [],
    timeline: [],
    comparisonTimeline: [],
  });
  const [mainChartData, setMainChartData] = useState({
    timeline: [],
    comparisonTimeline: [],
  });

  // Fetch data for main chart only (half-hour buckets; small charts unaffected)
  useEffect(() => {
    const fetchMainChartData = async () => {
      try {
        const data = await salesService.getSalesStats({
          period: 'day',
          compare: 'none',
          timelineInterval: 'half_hour',
        });
        setMainChartData({
          timeline: data?.timeline || [],
          comparisonTimeline: data?.comparisonTimeline || [],
        });
      } catch (e) {
        console.error('Failed to load main chart data:', e);
      }
    };
    fetchMainChartData();
  }, []); 
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');

        const data = await salesService.getSalesStats({
          period,
          compare,
        });
        setSummary({
          revenue: data?.revenue || 0,
          saleCount: data?.saleCount || 0,
          customerCount: data?.customerCount || 0,
          averageSale: data?.averageSale || 0,
          basketSize: data?.basketSize || 0,
          grossProfit: data?.grossProfit || 0,
          discountAmount: data?.discountAmount || 0,
          profitPercentage: data?.profitPercentage || 0,
          topProducts: data?.topProducts || [],
          topUsers: data?.topUsers || [],
          timeline: data?.timeline || [],
          comparisonTimeline: data?.comparisonTimeline || [],
        });
      } catch {
        setError('Failed to load live stats. Showing placeholder data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [period, compare]);

  const topProductsColumns = [
    { field: 'name', headerName: 'Name', width: 300 },
    { field: 'revenue', headerName: 'Revenue', width: 120, valueFormatter: (v) => formatCurrency(v) },
    { field: 'quantity', headerName: 'Quantity', width: 100 },
  ];

  const topUsersColumns = [
    { field: 'name', headerName: 'Name', width: 200 },
    { field: 'revenue', headerName: 'Revenue', width: 140, valueFormatter: (v) => formatCurrency(v) },
    { field: 'transactionCount', headerName: 'Transaction Count', width: 160 },
    { field: 'averageSale', headerName: 'Average Sale', width: 140, valueFormatter: (v) => formatCurrency(v) },
  ];

  // Value of one metric for one timeline bucket (used for both the current and
  // the comparison series, so Compare With draws a real second series).
  const metricForSlot = (timeSlot, metricKey) => {
    let value = 0;

    switch (metricKey) {
        case 'revenue':
          value = Number(timeSlot.revenue || 0);
          break;
        case 'saleCount':
          value = Number(timeSlot.saleCount || 0);
          break;
        case 'customerCount':
          // Calculate unique customers from sales array if available
          if (timeSlot.sales && Array.isArray(timeSlot.sales)) {
            const uniqueCustomers = new Set(
              timeSlot.sales
                .map(sale => sale.customerId)
                .filter(id => id != null)
            );
            value = uniqueCustomers.size;
          } else {
            // Distribute total customer count proportionally
            value = summary.customerCount > 0 && summary.saleCount > 0
              ? Math.round((summary.customerCount / summary.saleCount) * (timeSlot.saleCount || 0))
              : 0;
          }
          break;
        case 'averageSale':
          value = timeSlot.saleCount > 0
            ? Number(timeSlot.revenue || 0) / Number(timeSlot.saleCount || 1)
            : 0;
          break;
        case 'basketSize':
          // Calculate from sales if items data is available
          if (timeSlot.sales && Array.isArray(timeSlot.sales) && timeSlot.sales.length > 0) {
            const totalItems = timeSlot.sales.reduce((sum, sale) => sum + (Number(sale.itemCount) || 0), 0);
            value = timeSlot.saleCount > 0 ? totalItems / timeSlot.saleCount : 0;
          } else {
            // Distribute total basket size proportionally
            value = summary.basketSize > 0 && summary.saleCount > 0
              ? (summary.basketSize / summary.saleCount) * (timeSlot.saleCount || 0)
              : 0;
          }
          break;
        case 'grossProfit':
          // Calculate from sales if profit data is available
          if (timeSlot.sales && Array.isArray(timeSlot.sales) && timeSlot.sales.length > 0) {
            value = timeSlot.sales.reduce((sum, sale) => sum + (Number(sale.grossProfit) || 0), 0);
          } else {
            // Distribute total gross profit proportionally by revenue
            value = summary.grossProfit > 0 && summary.revenue > 0
              ? (summary.grossProfit / summary.revenue) * (Number(timeSlot.revenue || 0))
              : 0;
          }
          break;
        case 'discountAmount':
          // Calculate from sales if discount data is available
          if (timeSlot.sales && Array.isArray(timeSlot.sales) && timeSlot.sales.length > 0) {
            value = timeSlot.sales.reduce((sum, sale) => {
              const discount = Number(sale.discount) || 0;
              const savings = Number(sale.savings) || 0;
              return sum + discount + savings;
            }, 0);
          } else {
            // Distribute total discount proportionally by revenue
            value = summary.discountAmount > 0 && summary.revenue > 0
              ? (summary.discountAmount / summary.revenue) * (Number(timeSlot.revenue || 0))
              : 0;
          }
          break;
        case 'profitPercentage': {
          const revenue = Number(timeSlot.revenue || 0);
          let profit = 0;
          if (timeSlot.sales && Array.isArray(timeSlot.sales) && timeSlot.sales.length > 0) {
            profit = timeSlot.sales.reduce((sum, sale) => sum + (Number(sale.grossProfit) || 0), 0);
          } else {
            profit = summary.grossProfit > 0 && summary.revenue > 0
              ? (summary.grossProfit / summary.revenue) * revenue
              : 0;
          }
          value = revenue > 0 ? (profit / revenue) * 100 : 0;
          break;
        }
      default:
        value = 0;
    }

    return value;
  };

  const showComparison = compare !== 'none' && (summary.comparisonTimeline || []).length > 0;

  // Prepare timeline data for each KPI metric (+ the comparison series)
  const prepareKPITimeline = (metricKey) => {
    if (!summary.timeline || summary.timeline.length === 0) {
      return [];
    }

    const compareByTime = new Map(
      (summary.comparisonTimeline || []).map((slot) => [slot.time, slot])
    );

    return summary.timeline.map((timeSlot, index) => {
      const row = { time: timeSlot.time, value: metricForSlot(timeSlot, metricKey) };
      if (showComparison) {
        // Align by bucket label where the prior period shares it, else positionally.
        const compareSlot =
          compareByTime.get(timeSlot.time) || summary.comparisonTimeline[index] || null;
        row.compare = compareSlot ? metricForSlot(compareSlot, metricKey) : 0;
      }
      return row;
    });
  };

  return (
    <Box>
      {/* Filters: bare flex row, no card (reference .report-dashboard-filters) */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          height: 120,
          p: 0,
          backgroundColor: 'transparent',
        }}
      >
        <FilterGroup label="Timeline Value">
          <SegmentedToggle
            value={timelineValue}
            onChange={setTimelineValue}
            options={[
              { value: 'count', label: 'Sale Count' },
              { value: 'revenue', label: 'Revenue' },
            ]}
          />
        </FilterGroup>
        <FilterGroup label="Time Period">
          <SegmentedToggle
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'day', label: 'Day' },
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
              { value: 'year', label: 'Year' },
            ]}
          />
        </FilterGroup>
        <FilterGroup label="Compare With">
          <SegmentedToggle
            value={compare}
            onChange={setCompare}
            options={[
              { value: 'none', label: 'None' },
              { value: 'last_week', label: 'Last Week' },
              { value: 'last_month', label: 'Last Month' },
              { value: 'last_year', label: 'Last Year' },
            ]}
          />
        </FilterGroup>
      </Box>

      {/* Timeline: no card, 400px tall (reference .report-dashboard-timeline) */}
      <Box sx={{ height: 400, backgroundColor: 'transparent', p: 0 }}>
        {loading ? null : (
          <>
            <SalesChart
              height={400}
              type="bar"
              data={mainChartData.timeline}
              comparisonData={mainChartData.comparisonTimeline || []}
              timelineValue={timelineValue}
              compare="none"
              period="day"
              isMainChart
            />
            {error && (
              <Typography variant="caption" color="warning.main">{error}</Typography>
            )}
          </>
        )}
      </Box>

      {/* KPI graphs */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(5, 1fr)',
          },
          gap: 0,
        }}
      >
        {KPI_CARDS.map((card) => (
          <KPILineChart
            key={card.title}
            title={card.title}
            description={KPI_DESCRIPTIONS[card.title]}
            value={summary[card.metric]}
            data={prepareKPITimeline(card.metric)}
            dataKey={card.metric}
            formatValue={card.format}
            height={300}
            color="#e96f9d"
            showComparison={showComparison}
            outletName={getOutletName() || ''}
          />
        ))}
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <ReportBox
            title="Top 20 Products"
            data={summary.topProducts}
            columns={topProductsColumns}
            width={6}
            isDraggable={false}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <ReportBox
            title="Users"
            data={summary.topUsers}
            columns={topUsersColumns}
            width={6}
            isDraggable={false}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default ReportsDashboard;


