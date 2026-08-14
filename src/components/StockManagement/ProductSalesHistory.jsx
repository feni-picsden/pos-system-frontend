import React, { useState, useEffect, useRef } from 'react';
import PageLoader from '../Common/PageLoader';
import {
  Box,
  Typography,
  Alert,
  Pagination,
  Collapse,
  TextField,
} from '@mui/material';
import {
  CheckCircleOutline as CheckCircleIcon,
  SentimentDissatisfiedOutlined as SadIcon,
} from '@mui/icons-material';
import productService from '../../services/productService';
import salesService from '../../services/salesService';
import {
  EVENT_ROOT_SX,
  eventRowSx,
  EVENT_LINE_SX,
  EVENT_STATUS_SX,
  EVENT_TIMESTAMP_SX,
  EVENT_DATE_SX,
  EVENT_INVOICE_SX,
  EVENT_LOCATION_SX,
  EVENT_PRICE_SX,
  EVENT_CENTS_SX,
  EVENT_EXPANDED_SX,
  EVENT_SUMMARY_SX,
  EVENT_CLOSE_SX,
  EVENT_TOTALS_SX,
  EVENT_BALANCE_SX,
  splitMoney,
} from './productViewStyles';
import { saleBasePrice } from '../../utils/saleTotals';

const ROWS_PER_PAGE = 25;

// Reference renders the amount with the cents at 0.7em.
const Money = ({ value, centsSx }) => {
  const [main, cents] = splitMoney(value);
  return (
    <span>
      {main}
      <Box component="span" sx={centsSx || EVENT_CENTS_SX}>
        {cents}
      </Box>
    </span>
  );
};

const ProductSalesHistory = ({ productId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [salesData, setSalesData] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);
  const [page, setPage] = useState(1);
  const [saleDetailsById, setSaleDetailsById] = useState({});
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  // Last-write-wins guard: a cached (instant) response must not be overwritten
  // by an older filter's request that is still in flight.
  const reqRef = useRef(0);

  useEffect(() => {
    if (productId) {
      loadSalesHistory();
    }
  }, [productId, startDate, endDate]);

  const loadSalesHistory = async () => {
    const seq = ++reqRef.current;
    try {
      setLoading(true);
      setError('');

      // The whole (filtered) history is fetched once; paging is client-side.
      const response = await productService.getProductSalesHistory(productId, {
        page: 1,
        limit: 10000,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
      });
      if (seq !== reqRef.current) return;
      // Sale details are fetched lazily when a row is expanded. Prefetching
      // every sale up front cost ~16s and blew up on any unreachable sale id.
      setSalesData(response.data);
    } catch (err) {
      if (seq !== reqRef.current) return;
      console.error('Error loading sales history:', err);
      setError('Failed to load sales history');
    } finally {
      if (seq === reqRef.current) setLoading(false);
    }
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
      Number(value) || 0
    );

  const titleCase = (value) =>
    String(value || '')
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

  // Sale numbers already carry a leading '#' from the API - don't double it.
  const receiptNumber = (value) => String(value ?? '').replace(/^#+/, '');

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
      time: date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    };
  };

  const handleSaleSelect = async (sale) => {
    if (selectedSale?.id === sale.id) {
      setSelectedSale(null);
      return;
    }
    setSelectedSale(sale);
    if (!saleDetailsById[sale.id]) {
      try {
        const res = await salesService.getSaleById(sale.id);
        setSaleDetailsById((prev) => ({ ...prev, [sale.id]: res.sale }));
      } catch (e) {
        console.error('Failed to load sale details', e);
        // Surface the failure instead of leaving the panel stuck on "Loading items…"
        setSaleDetailsById((prev) => ({
          ...prev,
          [sale.id]: { items: [], loadError: true },
        }));
      }
    }
  };

  const allRows = salesData?.sales || [];
  const pageCount = Math.max(1, Math.ceil(allRows.length / ROWS_PER_PAGE));
  const rows = allRows.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  // Keep the filter mounted across refetches so the date inputs don't lose focus.
  if (loading && !salesData) {
    return <PageLoader />;
  }

  if (error) {
    return (
      <Box sx={EVENT_ROOT_SX}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!salesData) {
    return (
      <Box sx={EVENT_ROOT_SX}>
        <Alert severity="info">No sales history available</Alert>
      </Box>
    );
  }

  const renderExpanded = (sale) => {
    const det = saleDetailsById[sale.id] || {};
    const dt = formatDateTime(sale.saleDate);
    const totals = [
      ['Base Price', formatCurrency(saleBasePrice(det))],
      ['Savings', formatCurrency(det.savings)],
      ['Discount', formatCurrency(det.discount)],
      ['Tax', formatCurrency(det.tax)],
      ['Loyalty Value', String(Number(det.loyaltyValue) || 0)],
    ];
    const payments = det.payments || [];

    return (
      <Box sx={EVENT_EXPANDED_SX}>
        {/* Row 1, column 1 - three centred summary blocks */}
        <Box sx={EVENT_SUMMARY_SX}>
          <Box>
            <Box sx={{ fontSize: '17.6px', mb: '8px' }}>
              {dt.date} {dt.time}
            </Box>
            <Box sx={{ fontSize: '25.6px', mb: '8px' }}>
              <Money value={sale.totalAmount} />
            </Box>
            <Box sx={{ fontSize: 16 }}>#{receiptNumber(sale.saleNumber)}</Box>
          </Box>
          <Box>
            <Box
              sx={{
                fontSize: '17.6px',
                mb: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <CheckCircleIcon sx={{ fontSize: '17.6px' }} />
              {titleCase(sale.status || 'Completed')}
            </Box>
            <Box sx={{ fontSize: 16, mb: '8px' }}>{sale.outlet || ''}</Box>
            <Box sx={{ fontSize: 16 }}>{sale.salesperson || ''}</Box>
          </Box>
          <Box>
            <Box component="table" sx={EVENT_TOTALS_SX}>
              <tbody>
                {totals.map(([label, value]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td>{value}</td>
                  </tr>
                ))}
              </tbody>
            </Box>
          </Box>
        </Box>

        {/* Row 2, column 1 - items, payments, balance */}
        <Box>
          <Box>
            {(det.items || []).map((it) => (
              <Box
                key={it.id}
                sx={{ display: 'flex', fontSize: '19.2px', mb: '8px' }}
              >
                <Box sx={{ mr: '16px' }}>{it.quantity}</Box>
                <Box sx={{ mr: '16px' }}>Item</Box>
                <Box sx={{ flex: 1, mr: '16px' }}>{it.productName}</Box>
                <Box>{formatCurrency(it.totalPrice)}</Box>
              </Box>
            ))}
            {(det.items?.length ?? 0) === 0 &&
              (det.loadError ? (
                <Typography sx={{ color: '#e33430', fontSize: 16 }}>
                  Could not load the details for this sale.
                </Typography>
              ) : (
                <Typography sx={{ fontSize: 16 }}>Loading items…</Typography>
              ))}
          </Box>

          <Box sx={{ my: '8px' }}>
            {payments.map((p) => (
              <Box key={p.id} sx={{ display: 'flex', fontSize: 16 }}>
                <Box sx={{ flex: 1, textAlign: 'right', mr: '16px' }}>
                  {p.paymentMethod}
                </Box>
                <Box sx={{ textAlign: 'right' }}>{formatCurrency(p.amount)}</Box>
              </Box>
            ))}
          </Box>

          <Box sx={EVENT_BALANCE_SX}>
            <Box sx={{ flex: 1, textAlign: 'right', mr: '16px' }}>Balance</Box>
            <Box>
              <Money value={det.balance ?? sale.balance} />
            </Box>
          </Box>
        </Box>

        <Box sx={EVENT_CLOSE_SX} onClick={() => setSelectedSale(null)}>
          ✕ Close
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={EVENT_ROOT_SX}>
      {/* Local-only control (the reference has no date filter here) */}
      <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          type="datetime-local"
          size="small"
          label="From"
          InputLabelProps={{ shrink: true }}
          value={startDate}
          onChange={(e) => {
            setPage(1);
            setStartDate(e.target.value);
          }}
        />
        <TextField
          type="datetime-local"
          size="small"
          label="To"
          InputLabelProps={{ shrink: true }}
          value={endDate}
          onChange={(e) => {
            setPage(1);
            setEndDate(e.target.value);
          }}
        />
      </Box>

      {allRows.length === 0 ? (
        <Box sx={{ p: 6, textAlign: 'center' }}>
          <SadIcon sx={{ fontSize: 64, color: '#bdbdbd', mb: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#000' }}>
            Oh No! This product has not been sold yet.
          </Typography>
        </Box>
      ) : (
        rows.map((sale, index) => {
          const dt = formatDateTime(sale.saleDate);
          const isSelected = selectedSale?.id === sale.id;
          return (
            <Box key={sale.id} sx={eventRowSx(index)}>
              {isSelected ? null : (
                <Box sx={EVENT_LINE_SX} onClick={() => handleSaleSelect(sale)}>
                  <Box sx={EVENT_STATUS_SX}>
                    <CheckCircleIcon sx={{ fontSize: 32, display: 'block' }} />
                  </Box>
                  <Box sx={EVENT_TIMESTAMP_SX}>
                    <Box sx={EVENT_DATE_SX}>{dt.date}</Box>
                    <Box sx={EVENT_DATE_SX}>{dt.time}</Box>
                    <Box sx={EVENT_INVOICE_SX}>
                      #{receiptNumber(sale.saleNumber)}
                    </Box>
                  </Box>
                  <Box sx={EVENT_LOCATION_SX}>{sale.salesperson || ''}</Box>
                  <Box sx={EVENT_PRICE_SX}>
                    <Money value={sale.totalAmount} />
                  </Box>
                </Box>
              )}
              <Collapse in={isSelected} timeout="auto" unmountOnExit>
                {renderExpanded(sale)}
              </Collapse>
            </Box>
          );
        })
      )}

      {/* Local-only control (the reference loads the whole history) */}
      {pageCount > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <Pagination
            count={pageCount}
            page={page}
            onChange={(e, v) => setPage(v)}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}
    </Box>
  );
};

export default ProductSalesHistory;
