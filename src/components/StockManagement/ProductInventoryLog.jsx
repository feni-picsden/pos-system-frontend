import React, { useEffect, useRef, useState } from 'react';
import DateRangePicker from '../Common/DateRangePicker';
import {
  Box,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Alert,
  Pagination,
  Autocomplete,
  TextField,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import productService from '../../services/productService';
import outletService from '../../services/outletService';
import {
  SECTION_ROOT_SX,
  OUTLET_SELECT_SX,
  INVENTORY_LOG_TABLE_SX,
  inventoryLogRowSx,
  INVENTORY_QTY_TABLE_SX,
  NICE_ERROR_SX,
  NICE_ERROR_ICON_SX,
  NICE_ERROR_REASON_SX,
  NICE_ERROR_HEADING_SX,
  NICE_ERROR_BODY_SX,
} from './productViewStyles';

// Reference (global product): OUTLET is the first column and an "Outlets" filter
// sits above Date Range. Outlet-specific products show neither (every row is
// that one outlet's).
const OUTLET_COLUMN = { label: 'Outlet', cls: 'left' };
const COLUMNS = [
  { label: 'Event', cls: 'left' },
  { label: 'Before', cls: 'tight center' },
  { label: 'Changed', cls: 'tight center' },
  { label: 'After', cls: 'tight center' },
  { label: 'User', cls: 'center' },
  { label: 'Case Quantity', cls: 'center' },
  { label: 'Cost', cls: 'left' },
  { label: 'Timestamp', cls: 'center' },
];

const ProductInventoryLog = ({ productId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [outlets, setOutlets] = useState([]);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  // Last-write-wins guard: a cached (instant) response must not be overwritten
  // by an older filter's request that is still in flight.
  const reqRef = useRef(0);

  useEffect(() => {
    if (productId) loadLogs();
  }, [productId, page, startDate, endDate, selectedOutlet]);

  useEffect(() => {
    // Outlet list for the reference "Outlets" filter (superadmin; harmless 403 otherwise)
    outletService
      .getAllOutlets()
      .then((res) => setOutlets(res?.outlets || res?.data || res || []))
      .catch(() => setOutlets([]));
  }, []);

  const loadLogs = async () => {
    const seq = ++reqRef.current;
    try {
      setLoading(true);
      const resp = await productService.getProductInventoryLog(productId, {
        page,
        limit: 25,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
        outletId: selectedOutlet?.id || undefined,
      });
      if (seq !== reqRef.current) return;
      setData(resp.data);
      setError('');
    } catch (e) {
      if (seq !== reqRef.current) return;
      console.error('Error loading inventory log:', e);
      setError('Failed to load inventory log');
    } finally {
      if (seq === reqRef.current) setLoading(false);
    }
  };

  const formatCurrency = (v) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
      Number(v) || 0
    );

  // Reference format: "13/06/2026 21:00:34" (no comma between date and time).
  const formatDateTime = (d) => {
    const date = new Date(d);
    return `${date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })} ${date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })}`;
  };

  // Reference shows "Sale" / "Stocktake" / "Manual Change", not raw enum values.
  const eventLabel = (value) =>
    String(value || '')
      .split(/[_\s]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

  // EVENT links back to the document that moved the stock. Rows without a real
  // source document (manual product edits, receives) stay plain text.
  const eventHref = (log) => {
    if (!log.referenceId) return null;
    // Source document deleted (stocktake/order/sale): plain text, no dead link.
    if (log.referenceExists === false) return null;
    if (log.referenceType === 'SALE') return `/register/history?saleId=${log.referenceId}`;
    if (log.referenceType === 'STOCKTAKE') return `/stock-management/stocktakes/${log.referenceId}`;
    // Orders, receives, returns and transfers all reference an order/invoice doc.
    if (log.referenceType === 'ORDER_INVOICE' || log.referenceType === 'TRANSFER')
      return `/orders-invoices/${log.referenceId}`;
    return null;
  };

  // Reference names: an Express Stocktake / manual stock edit row (STOCKTAKE
  // without a stocktake document) is "Express Stocktake"; the opening stock row
  // is "Created Product".
  // A sale row that ADDED stock is a returned line: "Sales (Return)" (user's
  // choice - the reference labels it plain "Sale").
  // Reference (14/10/2026): a stock edit on the product form is "Manual Change";
  // both directions of a transfer are plain "Transfer" (the sign of Changed says
  // which way the stock went).
  const eventName = (log) => {
    if (log.eventType === 'OPENING') return 'Created Product';
    if (log.eventType === 'SALE'
      && (Number(log.changed?.cases) || 0) * (Number(log.caseQuantity) || 1) + (Number(log.changed?.items) || 0) > 0) {
      return 'Sales (Return)';
    }
    if (log.eventType === 'MANUAL' || log.eventType === 'MANUAL_ADJUSTMENT') return 'Manual Change';
    if (log.eventType === 'TRANSFER_IN' || log.eventType === 'TRANSFER_OUT') return 'Transfer';
    if (log.eventType === 'STOCKTAKE' && log.referenceType !== 'STOCKTAKE') return 'Express Stocktake';
    return eventLabel(log.eventType);
  };

  const eventCell = (log) => {
    const href = eventHref(log);
    const label = eventName(log);
    return href
      ? <Box component={RouterLink} to={href} sx={{ color: 'inherit', textDecoration: 'underline' }}>{label}</Box>
      : label;
  };

  // Reference labels: "1 Case" / "1 Item" only for exactly 1; "-1 Cases", "0 Items".
  const unitLabel = (n, one, many) => (Number(n) === 1 ? one : many);

  // Reference Before/Changed/After cell: title row, then Cases / Items pair.
  const quantityCell = (title, value) => (
    <Box component="table" sx={INVENTORY_QTY_TABLE_SX}>
      <tbody>
        <tr>
          <td className="title" colSpan={2}>
            {title}
          </td>
        </tr>
        <tr>
          <td className="value">
            <div className="qty">{value?.cases ?? 0}</div>
            <div className="label">{unitLabel(value?.cases, 'Case', 'Cases')}</div>
          </td>
          <td className="value">
            <div className="qty">{value?.items ?? 0}</div>
            <div className="label">{unitLabel(value?.items, 'Item', 'Items')}</div>
          </td>
        </tr>
      </tbody>
    </Box>
  );

  if (loading && !data) return null;
  if (error)
    return (
      <Box sx={SECTION_ROOT_SX}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  if (!data) return null;

  // Global product (no outlet of its own): reference shows the Outlets filter
  // and the OUTLET column. An outlet product shows neither.
  const isGlobal = data.product?.outletId == null;
  const columns = isGlobal ? [OUTLET_COLUMN, ...COLUMNS] : COLUMNS;

  return (
    <Box sx={SECTION_ROOT_SX}>
      {isGlobal && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ fontSize: 16, color: '#000' }}>Outlets</Box>
          <Autocomplete
            options={outlets}
            getOptionLabel={(o) => o?.name || ''}
            isOptionEqualToValue={(o, v) => o?.id === v?.id}
            value={selectedOutlet}
            onChange={(e, v) => {
              setPage(1);
              setSelectedOutlet(v || null);
            }}
            renderInput={(params) => <TextField {...params} placeholder="Select Outlet..." />}
            sx={OUTLET_SELECT_SX}
          />
        </Box>
      )}

      {/* Date Range filter - the app's own picker (reference shows
          "DD/MM/YYYY HH:mm:ss — DD/MM/YYYY HH:mm:ss"), not the browser's
          native datetime-local box, which rendered as ", dd-mm-yyyy --:--:-- --". */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ fontSize: 16, color: '#000' }}>Date Range</Box>
        <DateRangePicker
          label=""
          value={{ startDate: startDate || null, endDate: endDate || null }}
          onChange={(range) => {
            setPage(1);
            setStartDate(range?.startDate || '');
            setEndDate(range?.endDate || '');
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

      {data.logs.length === 0 ? (
        <Box sx={NICE_ERROR_SX}>
          <Box sx={NICE_ERROR_ICON_SX}>&#8709;</Box>
          <Box sx={NICE_ERROR_REASON_SX}>
            <Box component="h2" sx={NICE_ERROR_HEADING_SX}>
              No results found
            </Box>
            <Box component="p" sx={NICE_ERROR_BODY_SX}>
              We could not find any inventory log entries.
            </Box>
          </Box>
        </Box>
      ) : (
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table sx={INVENTORY_LOG_TABLE_SX}>
            <TableHead>
              <TableRow>
                {columns.map((c) => (
                  <TableCell key={c.label} className={c.cls}>
                    {c.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.logs.map((log, index) => (
                <TableRow key={log.id} sx={inventoryLogRowSx(index)}>
                  {isGlobal && <TableCell className="left">{log.outletName || ''}</TableCell>}
                  <TableCell className="left">{eventCell(log)}</TableCell>
                  <TableCell className="tight">
                    {quantityCell('Before', log.before)}
                  </TableCell>
                  <TableCell className="tight">
                    {quantityCell('Changed', log.changed)}
                  </TableCell>
                  <TableCell className="tight">
                    {quantityCell('After', log.after)}
                  </TableCell>
                  <TableCell>{log.user}</TableCell>
                  <TableCell>{log.caseQuantity}</TableCell>
                  {/* The ledger stamps the per-ITEM cost (the reports read it that way);
                      the reference's COST column is the CASE cost, item × case quantity
                      ($0.46 @24 -> $11.04, checked on the TEST store 09/10/2026). */}
                  <TableCell className="left">
                    {formatCurrency((Number(log.cost) || 0) * (Number(log.caseQuantity) || 1))}
                  </TableCell>
                  <TableCell>{formatDateTime(log.timestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {data.pagination.pages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination
            count={data.pagination.pages}
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

export default ProductInventoryLog;
