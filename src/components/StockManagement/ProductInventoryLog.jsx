import React, { useEffect, useRef, useState } from 'react';
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
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import productService from '../../services/productService';
import {
  SECTION_ROOT_SX,
  INVENTORY_LOG_TABLE_SX,
  inventoryLogRowSx,
  INVENTORY_QTY_TABLE_SX,
  NICE_ERROR_SX,
  NICE_ERROR_ICON_SX,
  NICE_ERROR_REASON_SX,
  NICE_ERROR_HEADING_SX,
  NICE_ERROR_BODY_SX,
} from './productViewStyles';

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
  // Last-write-wins guard: a cached (instant) response must not be overwritten
  // by an older filter's request that is still in flight.
  const reqRef = useRef(0);

  useEffect(() => {
    if (productId) loadLogs();
  }, [productId, page, startDate, endDate]);

  const loadLogs = async () => {
    const seq = ++reqRef.current;
    try {
      setLoading(true);
      const resp = await productService.getProductInventoryLog(productId, {
        page,
        limit: 25,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
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
    if (log.referenceType === 'SALE') return `/register/history?saleId=${log.referenceId}`;
    if (log.referenceType === 'STOCKTAKE') return `/stock-management/stocktakes/${log.referenceId}`;
    // Orders, receives, returns and transfers all reference an order/invoice doc.
    if (log.referenceType === 'ORDER_INVOICE' || log.referenceType === 'TRANSFER')
      return `/orders-invoices/${log.referenceId}`;
    return null;
  };

  const eventCell = (log) => {
    const href = eventHref(log);
    const label = eventLabel(log.eventType);
    return href
      ? <Box component={RouterLink} to={href} sx={{ color: 'inherit', textDecoration: 'underline' }}>{label}</Box>
      : label;
  };

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
            <div className="label">Cases</div>
          </td>
          <td className="value">
            <div className="qty">{value?.items ?? 0}</div>
            <div className="label">Items</div>
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

  return (
    <Box sx={SECTION_ROOT_SX}>
      {/* Date Range filter - plain label above a single bordered pair of inputs */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ fontSize: 16, color: '#000' }}>Date Range</Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            border: '1px solid #404040',
            borderRadius: '8px',
            backgroundColor: '#fff',
            '& input': {
              flex: 1,
              minWidth: 0,
              border: 0,
              outline: 'none',
              background: 'transparent',
              padding: '8px 16px',
              fontSize: 16,
              fontFamily: 'inherit',
              color: '#000',
            },
          }}
        >
          <input
            type="datetime-local"
            aria-label="From"
            value={startDate}
            onChange={(e) => {
              setPage(1);
              setStartDate(e.target.value);
            }}
          />
          <Box component="span" sx={{ color: '#737373' }}>
            &minus;
          </Box>
          <input
            type="datetime-local"
            aria-label="To"
            value={endDate}
            onChange={(e) => {
              setPage(1);
              setEndDate(e.target.value);
            }}
          />
        </Box>
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
                {COLUMNS.map((c) => (
                  <TableCell key={c.label} className={c.cls}>
                    {c.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.logs.map((log, index) => (
                <TableRow key={log.id} sx={inventoryLogRowSx(index)}>
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
                  <TableCell className="left">{formatCurrency(log.cost)}</TableCell>
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
