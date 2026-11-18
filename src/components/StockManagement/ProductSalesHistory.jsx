import React, { useState, useEffect, useRef } from 'react';
import PageLoader from '../Common/PageLoader';
import {
  Box,
  Typography,
  Alert,
  Pagination,
  Collapse,
  TextField,
  Autocomplete,
  Checkbox,
  Chip,
} from '@mui/material';
import {
  CheckCircleOutline as CheckCircleIcon,
  ShoppingBasketOutlined as BasketIcon,
  CheckBoxOutlineBlank as UncheckedIcon,
  CheckBox as CheckedIcon,
} from '@mui/icons-material';
import productService from '../../services/productService';
import salesService from '../../services/salesService';
import outletService from '../../services/outletService';
import useHeaderScope from '../../hooks/useHeaderScope';
import { formatDateTime as formatAppDateTime } from '../../utils/appDateTime';
import DateRangePicker from '../Common/DateRangePicker';
import { saleOutstanding, isOnAccountPayment, INCOMPLETE_PURPLE } from '../../utils/saleOutstanding';
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
  OUTLET_SELECT_SX,
  NICE_ERROR_SX,
  NICE_ERROR_ICON_SX,
  NICE_ERROR_REASON_SX,
  NICE_ERROR_HEADING_SX,
  NICE_ERROR_BODY_SX,
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
  // Reference: several rows can stay open at once.
  const [openIds, setOpenIds] = useState([]);
  const [page, setPage] = useState(1);
  const [saleDetailsById, setSaleDetailsById] = useState({});
  // Full-width Date Range (same control as Inventory Log); empty = all dates.
  const [dateRange, setDateRange] = useState({ startDate: null, endDate: null });
  // Last-write-wins guard: a cached (instant) response must not be overwritten
  // by an older filter's request that is still in flight.
  const reqRef = useRef(0);

  // The picker carries the time too (DD/MM/YYYY HH:mm:ss), so the range is used as picked.
  const rangeStart = dateRange?.startDate ? new Date(dateRange.startDate) : null;
  const rangeEnd = dateRange?.endDate ? new Date(dateRange.endDate) : null;
  const rangeKey = `${rangeStart?.getTime() ?? ''}-${rangeEnd?.getTime() ?? ''}`;

  // Reference: Outlet multi-select above the list (checkbox options, chips, clear X).
  // Empty = all the user's outlets. Hidden when a header outlet is selected
  // (header rule 16/10/2026); the header outlet then scopes the list by itself.
  const [outlets, setOutlets] = useState([]);
  const [selectedOutlets, setSelectedOutlets] = useState([]);
  // Header register (user 18/11/2026): only that register's sales are listed.
  const { showOutletFilter, headerRegisterId } = useHeaderScope();
  useEffect(() => {
    if (!showOutletFilter && selectedOutlets.length) setSelectedOutlets([]);
  }, [showOutletFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    outletService
      .getAllOutlets()
      .then((res) => setOutlets(res?.outlets || res?.data || res || []))
      .catch(() => setOutlets([]));
  }, []);
  const outletKey = selectedOutlets.map((o) => o.id).join(',');

  useEffect(() => {
    if (productId) {
      loadSalesHistory();
    }
  }, [productId, rangeKey, outletKey, headerRegisterId]);

  const loadSalesHistory = async () => {
    const seq = ++reqRef.current;
    try {
      setLoading(true);
      setError('');

      // The whole (filtered) history is fetched once; paging is client-side.
      const response = await productService.getProductSalesHistory(productId, {
        page: 1,
        limit: 10000,
        startDate: rangeStart ? rangeStart.toISOString() : undefined,
        endDate: rangeEnd ? rangeEnd.toISOString() : undefined,
        // "1,2" for the picked outlets; empty lets apiClient send the header outlet
        outletId: outletKey || undefined,
        registerId: headerRegisterId || undefined,
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

  // Date and time of the sale in the store's zone (Setup > General > Timezone).
  const formatDateTime = (dateString) => {
    const [date = '', time = ''] = formatAppDateTime(dateString).split(' ');
    return { date, time };
  };

  const handleSaleSelect = async (sale) => {
    if (openIds.includes(sale.id)) {
      setOpenIds((prev) => prev.filter((id) => id !== sale.id));
      return;
    }
    setOpenIds((prev) => [...prev, sale.id]);
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
    ];
    const payments = det.payments || [];
    // Still owed on this sale (server figure from the list row)
    const owed = saleOutstanding(sale);

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
                color: owed > 0 ? INCOMPLETE_PURPLE : 'inherit',
              }}
            >
              {owed > 0 ? (
                <Box sx={{ width: 16, height: 16, borderRadius: '50%', border: `1.5px solid ${INCOMPLETE_PURPLE}`, boxSizing: 'border-box' }} />
              ) : (
                <CheckCircleIcon sx={{ fontSize: '17.6px' }} />
              )}
              {owed > 0 ? 'Incomplete' : titleCase(sale.status || 'Completed')}
            </Box>
            <Box sx={{ fontSize: 16, mb: '8px' }}>{sale.outlet || ''}</Box>
            {sale.registerName ? <Box sx={{ fontSize: 16, mb: '8px' }}>{sale.registerName}</Box> : null}
            <Box sx={{ fontSize: 16 }}>{sale.salesperson || ''}</Box>
          </Box>
          {/* Reference: the totals table hugs the right edge, in line with the item
              amounts / Cash / Balance below (user 18/11/2026). */}
          <Box sx={{ textAlign: 'right' }}>
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
            {payments.filter((p) => !isOnAccountPayment(p)).map((p) => (
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
              <Money value={owed > 0 ? owed : (det.balance ?? sale.balance)} />
            </Box>
          </Box>
        </Box>

        <Box sx={EVENT_CLOSE_SX} onClick={() => setOpenIds((prev) => prev.filter((id) => id !== sale.id))}>
          ✕ Close
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={EVENT_ROOT_SX}>
      {/* Our addition (the reference has no date filter here): full-width Date Range,
          the same control and look as the Inventory Log tab (user 18/11/2026). */}
      {/* Reference: Outlet multi-select (checkbox options, chips in the box, clear X)
          above the list. Header rule (16/10/2026): hidden when a header outlet is selected. */}
      {showOutletFilter && (
        <Box sx={{ p: 1, pb: 0 }}>
          <Box sx={{ fontSize: 16, color: '#000' }}>Outlets</Box>
          <Autocomplete
            multiple
            disableCloseOnSelect
            options={outlets}
            getOptionLabel={(o) => o?.name || ''}
            isOptionEqualToValue={(o, v) => o?.id === v?.id}
            value={selectedOutlets}
            onChange={(e, v) => {
              setPage(1);
              setOpenIds([]);
              setSelectedOutlets(v);
            }}
            limitTags={2}
            ListboxProps={{ sx: { p: 0, '& .MuiAutocomplete-option': { fontSize: 16, py: '10px', color: '#000' }, '& .MuiAutocomplete-option[aria-selected="true"]': { color: '#1c86f2', bgcolor: 'transparent' }, '& .MuiAutocomplete-option.Mui-focused': { bgcolor: '#5ebbeb !important', color: '#000' } } }}
            renderOption={(props, option, { selected }) => {
              const checked = selected;
              return (
                <li {...props} key={option.id} aria-selected={checked}>
                  <Checkbox
                    icon={<UncheckedIcon fontSize="small" />}
                    checkedIcon={<CheckedIcon fontSize="small" />}
                    checked={checked}
                    sx={{ p: 0, mr: 1, color: '#000', '&.Mui-checked': { color: '#1c86f2' } }}
                  />
                  {option.name}
                </li>
              );
            }}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={option.id}
                  label={option.name}
                  size="small"
                  sx={{ borderRadius: '4px', fontSize: 14, maxWidth: 150, height: 24, bgcolor: '#ebebeb' }}
                />
              ))
            }
            renderInput={(params) => (
              <TextField {...params} placeholder={selectedOutlets.length ? '' : 'Select Outlet...'} inputProps={{ ...params.inputProps, 'data-testid': 'sales-history-outlets' }} />
            )}
            sx={{
              ...OUTLET_SELECT_SX,
              '& .MuiOutlinedInput-root': { ...OUTLET_SELECT_SX['& .MuiOutlinedInput-root'], height: 'auto', minHeight: 42, flexWrap: 'wrap', gap: '4px' },
            }}
          />
        </Box>
      )}

      <Box sx={{ p: 1, pb: 2 }}>
        <Box sx={{ fontSize: 16, color: '#000' }}>Date Range</Box>
        <DateRangePicker
          label=""
          value={dateRange}
          onChange={(range) => {
            setPage(1);
            setOpenIds([]);
            setDateRange({ startDate: range?.startDate || null, endDate: range?.endDate || null });
          }}
          allowEmpty
          enableTime
          placeholder="DD/MM/YYYY HH:mm:ss — DD/MM/YYYY HH:mm:ss"
          inputSx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '8px',
              fontSize: 16,
              backgroundColor: '#fff',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
            },
          }}
        />
      </Box>

      {allRows.length === 0 ? (
        /* Reference ".nice-error": big outline basket beside "Oh No!" + one line */
        <Box sx={NICE_ERROR_SX} data-testid="sales-history-empty">
          <Box sx={NICE_ERROR_ICON_SX}>
            <BasketIcon sx={{ fontSize: 160, display: 'block', mx: 'auto' }} />
          </Box>
          <Box sx={NICE_ERROR_REASON_SX}>
            <Box component="h2" sx={NICE_ERROR_HEADING_SX}>Oh No!</Box>
            <Box component="p" sx={NICE_ERROR_BODY_SX}>This product has not been sold yet.</Box>
          </Box>
        </Box>
      ) : (
        rows.map((sale, index) => {
          const dt = formatDateTime(sale.saleDate);
          const isSelected = openIds.includes(sale.id);
          return (
            <Box key={sale.id} sx={eventRowSx(index)}>
              {isSelected ? null : (
                <Box sx={EVENT_LINE_SX} onClick={() => handleSaleSelect(sale)}>
                  <Box sx={EVENT_STATUS_SX}>
                    {/* Reference: purple hollow circle while the sale still owes money */}
                    {saleOutstanding(sale) > 0 ? (
                      <Box title="Incomplete" sx={{ width: 28, height: 28, m: '2px', borderRadius: '50%', border: `2px solid ${INCOMPLETE_PURPLE}` }} />
                    ) : (
                      <CheckCircleIcon sx={{ fontSize: 32, display: 'block' }} />
                    )}
                  </Box>
                  <Box sx={EVENT_TIMESTAMP_SX}>
                    <Box sx={EVENT_DATE_SX}>{dt.date}</Box>
                    <Box sx={EVENT_DATE_SX}>{dt.time}</Box>
                    <Box sx={EVENT_INVOICE_SX}>
                      #{receiptNumber(sale.saleNumber)}
                    </Box>
                  </Box>
                  {/* Reference: Outlet / Register / Salesperson, one per line */}
                  <Box sx={EVENT_LOCATION_SX}>
                    <Box>{sale.outlet || ''}</Box>
                    {sale.registerName ? <Box>{sale.registerName}</Box> : null}
                    <Box>{sale.salesperson || ''}</Box>
                  </Box>
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
