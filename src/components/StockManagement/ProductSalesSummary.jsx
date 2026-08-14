import React, { useState, useEffect } from 'react';
import PageLoader from '../Common/PageLoader';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Alert,
  Autocomplete,
  TextField,
} from '@mui/material';
import {
  SentimentDissatisfiedOutlined as SadIcon,
} from '@mui/icons-material';
import productService from '../../services/productService';
import outletService from '../../services/outletService';
import {
  SECTION_ROOT_SX,
  WIDGET_H2_SX,
  GRID_TABLE_SX,
  OUTLET_SELECT_SX,
} from './productViewStyles';

// Sentinel option so the outlet filter can be reset from the option list.
const ALL_OUTLETS = { id: null, name: 'All Outlets' };

const COLUMNS = ['Period', 'Cases', 'Items', 'Sales', 'Profit', '%'];

// Same week numbering the API uses (routes/products.js getWeekNumber), so the
// padded zero periods line up with the periods that do have sales.
const getWeekNumber = (date) => {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};

const EMPTY_ROW = { cases: 0, items: 0, sales: '0.00', profit: '0.00', percentage: '0.00' };

// Reference lists every period in the window, zero-filled. The API only returns
// periods that had sales, so fill the gaps here.
const padPeriods = (rows, labels) => {
  const byPeriod = new Map((rows || []).map((r) => [String(r.period), r]));
  return labels.map((period) => byPeriod.get(period) || { ...EMPTY_ROW, period });
};

const yearLabels = (now) =>
  [0, 1, 2].map((i) => String(now.getFullYear() - i));

const monthLabels = (now) =>
  Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });

const weekLabels = (now) =>
  Array.from({ length: 52 }, (_, i) => {
    const d = new Date(now.getTime() - i * 7 * 86400000);
    return `${d.getFullYear()}-${String(getWeekNumber(d)).padStart(2, '0')}`;
  });

const ProductSalesSummary = ({ productId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [salesData, setSalesData] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [selectedOutlet, setSelectedOutlet] = useState(null);

  useEffect(() => {
    // Load selectable outlets for the filter (superadmin only; harmless 403 otherwise)
    outletService
      .getAllOutlets()
      .then((res) => setOutlets(res?.outlets || res?.data || res || []))
      .catch(() => setOutlets([]));
  }, []);

  useEffect(() => {
    if (!productId) return;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await productService.getProductSalesSummary(
          productId,
          'monthly',
          selectedOutlet?.id || null
        );
        setSalesData(response);
      } catch (err) {
        console.error('Error loading sales summary:', err);
        setError('Failed to load sales summary');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [productId, selectedOutlet]);

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const formatPercentage = (value) => `${parseFloat(value).toFixed(2)}%`;

  const statistics = (rows) => {
    const sum = (k) => rows.reduce((t, r) => t + (parseFloat(r[k]) || 0), 0);
    return [
      { label: 'Total Sales (3 Years)', value: formatCurrency(sum('sales')) },
      { label: 'Total Profit (3 Years)', value: formatCurrency(sum('profit')) },
      { label: 'Total Items Sold (3 Years)', value: sum('items').toLocaleString() },
      {
        label: 'Average Profit Margin',
        value: formatPercentage(rows.length ? sum('percentage') / rows.length : 0),
      },
    ];
  };

  // Reference section: bare <h2> heading + full-width black grid table, all
  // cells centred, no card, no zebra striping, no coloured values.
  const renderTable = (title, data) => (
    <Box key={title}>
      <Box component="h2" sx={WIDGET_H2_SX}>
        {title}
      </Box>
      {!data || data.length === 0 ? (
        <Typography sx={{ fontSize: 16, color: '#000' }}>
          No data available for this period
        </Typography>
      ) : (
        <Table sx={GRID_TABLE_SX}>
          <TableHead>
            <TableRow>
              {COLUMNS.map((c) => (
                <TableCell key={c}>{c}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.period}>
                <TableCell align="center">{row.period}</TableCell>
                <TableCell align="center">{row.cases}</TableCell>
                <TableCell align="center">{row.items}</TableCell>
                <TableCell align="center">{formatCurrency(parseFloat(row.sales))}</TableCell>
                <TableCell align="center">{formatCurrency(parseFloat(row.profit))}</TableCell>
                <TableCell align="center">{formatPercentage(row.percentage)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );

  if (loading) {
    return <PageLoader />;
  }

  if (error) {
    return (
      <Box sx={SECTION_ROOT_SX}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!salesData) {
    return (
      <Box sx={SECTION_ROOT_SX}>
        <Alert severity="info">No sales data available</Alert>
      </Box>
    );
  }

  const summary = salesData.summary || {};
  const hasAnySales =
    (summary.last3Years?.length || 0) +
      (summary.last12Months?.length || 0) +
      (summary.last52Weeks?.length || 0) >
    0;

  const now = new Date();

  return (
    <Box sx={SECTION_ROOT_SX}>
      {/* Outlet filter - single-select combobox (clear X + caret), scopes the summary */}
      <Autocomplete
        options={[ALL_OUTLETS, ...outlets]}
        getOptionLabel={(o) => o?.name || ''}
        isOptionEqualToValue={(o, v) => o?.id === v?.id}
        value={selectedOutlet}
        onChange={(e, v) => setSelectedOutlet(v?.id ? v : null)}
        renderInput={(params) => <TextField {...params} placeholder="Select outlet..." />}
        sx={OUTLET_SELECT_SX}
      />

      {!hasAnySales ? (
        <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
          <SadIcon sx={{ fontSize: 64, color: '#bdbdbd', mb: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#000' }}>
            Not Sold
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This product hasn&apos;t been sold yet!
          </Typography>
        </Box>
      ) : (
        <>
          {renderTable('Last 3 Years', padPeriods(summary.last3Years, yearLabels(now)))}
          {renderTable('Last 12 Months', padPeriods(summary.last12Months, monthLabels(now)))}
          {renderTable('Last 52 Weeks', padPeriods(summary.last52Weeks, weekLabels(now)))}

          {/* Local-only widget (the reference has no such block); kept, restyled
              to the reference section heading so it does not clash. */}
          <Box component="h2" sx={WIDGET_H2_SX}>
            Summary Statistics
          </Box>
          <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', fontSize: 16, color: '#000' }}>
            {statistics(summary.last3Years || []).map((s) => (
              <Box key={s.label}>
                <Box sx={{ fontSize: 16 }}>{s.label}</Box>
                <Box sx={{ fontSize: 16, fontWeight: 700 }}>{s.value}</Box>
              </Box>
            ))}
          </Box>
        </>
      )}
    </Box>
  );
};

export default ProductSalesSummary;
