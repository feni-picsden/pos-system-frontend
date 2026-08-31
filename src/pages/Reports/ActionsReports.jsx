import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  MenuItem,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { FileDownloadOutlined as ExportIcon, Print as PrintIcon } from '@mui/icons-material';
import apiClient from '../../services/apiClient';

// Reporting > Actions Reports — the register-activity audit (reference
// art. 360000245511 + live capture 2026-08-31: seven report types on one page,
// date range, search, Export/Print). Each type reads what this POS records:
// security events, revisions, cash movements, the inventory log and sales.

const REPORT_TYPES = [
  { value: 'actions', label: 'Actions' },
  { value: 'revisions', label: 'Revisions' },
  { value: 'cash-movements', label: 'Cash Movements' },
  { value: 'inventory-log', label: 'Inventory Log' },
  { value: 'discounted-sales', label: 'Discounted Sales' },
  { value: 'cancelled-sales', label: 'Cancelled Sales' },
  { value: 'modified-sales', label: 'Modified Sales' },
];

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 16);
};
const endOfToday = () => {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  return d.toISOString().slice(0, 16);
};

const MONEY_KEYS = new Set(['amount', 'discount', 'totalPrice']);
const DATE_KEYS = new Set(['timestamp', 'timeOfSale']);

const formatCell = (key, value) => {
  if (value === null || value === undefined || value === '') return '';
  if (MONEY_KEYS.has(key)) return `$${Number(value).toFixed(2)}`;
  if (DATE_KEYS.has(key) || /time|date/i.test(key)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString('en-AU');
  }
  return String(value);
};

const ActionsReports = () => {
  const [reportType, setReportType] = useState('actions');
  const [from, setFrom] = useState(startOfToday());
  const [to, setTo] = useState(endOfToday());
  const [search, setSearch] = useState('');
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [rowKeys, setRowKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const runReport = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiClient.get('/actions-reports', {
        params: { type: reportType, from: new Date(from).toISOString(), to: new Date(to).toISOString() },
        noCache: true,
      });
      const data = res.data || {};
      setColumns(data.columns || []);
      const list = data.rows || [];
      setRows(list);
      // Column order comes from the API; keys are derived from the first row in
      // the same order (saleId is routing metadata, not a column).
      const keys = list.length
        ? Object.keys(list[0]).filter((k) => k !== 'saleId')
        : [];
      setRowKeys(keys);
    } catch (e) {
      console.error('Error running actions report:', e);
      setError(e?.response?.data?.error || 'Failed to run the report');
      setRows([]);
      setColumns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { runReport(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [reportType]);

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      rowKeys.some((k) => String(row[k] ?? '').toLowerCase().includes(term))
    );
  }, [rows, rowKeys, search]);

  const exportCsv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      columns.map(esc).join(','),
      ...visibleRows.map((row) => rowKeys.map((k) => esc(formatCell(k, row[k]))).join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `actions-report-${reportType}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: '#000', mb: 3 }}>
        Actions Report
      </Typography>

      {/* Controls: report type, date range, search, export/print — the reference layout */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-end', mb: 3 }}>
        <TextField
          select label="Report Type" size="small" value={reportType}
          onChange={(e) => setReportType(e.target.value)} sx={{ minWidth: 200 }}
        >
          {REPORT_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
        </TextField>
        <TextField
          label="From" size="small" type="datetime-local" InputLabelProps={{ shrink: true }}
          value={from} onChange={(e) => setFrom(e.target.value)}
        />
        <TextField
          label="To" size="small" type="datetime-local" InputLabelProps={{ shrink: true }}
          value={to} onChange={(e) => setTo(e.target.value)}
        />
        <Button
          variant="contained" disableElevation disableRipple onClick={runReport}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '12px', height: 40, px: 3, backgroundColor: '#5ebbeb', '&:hover': { backgroundColor: '#4aa9dd' } }}
        >
          Run
        </Button>
        <TextField
          label="Search for anything" size="small" value={search}
          onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 220, ml: 'auto' }}
        />
        <Button disableRipple startIcon={<ExportIcon />} onClick={exportCsv}
          sx={{ textTransform: 'none', color: '#0084d1', fontWeight: 600 }}>
          Export
        </Button>
        <Button disableRipple startIcon={<PrintIcon />} onClick={() => window.print()}
          sx={{ textTransform: 'none', color: '#0084d1', fontWeight: 600 }}>
          Print
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
      ) : (
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ '& td, & th': { fontSize: 14, color: '#313439', borderBottom: '1px solid #e2e6e5', py: 1.25 } }}>
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, textTransform: 'uppercase', fontSize: 12.5, color: '#676b72' } }}>
                {columns.map((c) => <TableCell key={c}>{c}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={Math.max(columns.length, 1)} align="center" sx={{ py: 4, border: 0 }}>
                    <Typography color="text.secondary">No activity for this period.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                visibleRows.map((row, i) => (
                  <TableRow key={i} sx={{ '&:hover': { bgcolor: '#f7f9f8' } }}>
                    {rowKeys.map((k) => (
                      <TableCell key={k} sx={/additional|Value$/i.test(k) ? { fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 12.5, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : undefined}>
                        {formatCell(k, row[k])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default ActionsReports;
