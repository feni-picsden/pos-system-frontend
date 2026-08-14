import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  FileDownload as ExportIcon,
  PrintOutlined as PrintIcon,
  SaveOutlined as SaveIcon,
  ArrowBack as ArrowBackIcon,
  PlayArrow as PlayArrowIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  StorageOutlined as SchemaIcon,
  TerminalOutlined as TerminalIcon,
  HelpOutline as HelpIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import inventoryReportService from '../../services/inventoryReportService';
import favouriteReportService from '../../services/favouriteReportService';

// Parity button styles (Shopfront reference: no transitions, radius 12, h42, 16/700)
const outlinedBtnSx = {
  height: 42,
  borderRadius: '12px',
  px: 4,
  fontSize: 16,
  fontWeight: 700,
  textTransform: 'none',
  transition: 'none',
  color: '#0284c7',
  borderColor: '#0ea5e9',
  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)', borderColor: '#0ea5e9' },
  '&.Mui-disabled': {
    bgcolor: '#e5e5e5',
    color: '#737373',
    borderColor: '#a3a3a3',
    cursor: 'not-allowed',
  },
};

const primaryBtnSx = {
  height: 42,
  borderRadius: '12px',
  px: 4,
  fontSize: 16,
  fontWeight: 700,
  textTransform: 'none',
  transition: 'none',
  boxShadow: 'none',
  bgcolor: '#5ebbeb',
  color: '#f8f8f8',
  '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' },
  '&.Mui-disabled': { bgcolor: '#e5e5e5', color: '#737373', cursor: 'not-allowed' },
};

const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: 1 },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: 2 },
  },
  '& input::placeholder, & textarea::placeholder': { color: '#808080', opacity: 1 },
};

// Reference schema browser: 16 tables, each expands to its field list
const schemaTables = [
  { name: 'actions', fields: ['type', 'description', 'user', 'user_id', 'register', 'register_id', 'outlet', 'outlet_id', 'date_time'] },
  { name: 'cash_movements', fields: ['type', 'amount', 'reason', 'user', 'user_id', 'register', 'register_id', 'outlet', 'outlet_id', 'date_time'] },
  { name: 'costs', fields: ['last_cost', 'average_cost', 'case_cost', 'supplier', 'supplier_id', 'outlet', 'outlet_id'] },
  { name: 'customers', fields: ['name', 'first_name', 'last_name', 'company', 'email', 'phone', 'balance', 'loyalty_points', 'customer_group', 'customer_group_id'] },
  { name: 'inventory', fields: ['status', 'single_level', 'case_level', 'quantity', 'single_reorder_level', 'case_reorder_level', 'reorder_level', 'single_reorder_amount', 'case_reorder_amount', 'reorder_amount', 'outlet', 'outlet_id'] },
  { name: 'inventory_log', fields: ['type', 'quantity', 'single_level', 'case_level', 'cost', 'user', 'user_id', 'outlet', 'outlet_id', 'date_time'] },
  { name: 'orders', fields: ['status', 'type', 'reference', 'supplier', 'supplier_id', 'quantity', 'total', 'outlet', 'outlet_id', 'date_time'] },
  { name: 'payment_customers', fields: ['customer', 'customer_id', 'amount', 'payment_method', 'payment_method_id', 'outlet', 'outlet_id', 'date_time'] },
  { name: 'payments', fields: ['payment_method', 'payment_method_id', 'amount', 'rounding', 'change', 'register', 'register_id', 'outlet', 'outlet_id', 'date_time'] },
  { name: 'products', fields: ['name', 'sku', 'barcode', 'brand', 'supplier', 'supplier_id', 'case_quantity', 'sell_price', 'tax_rate', 'classification', 'deleted'] },
  { name: 'promotions', fields: ['name', 'type', 'status', 'discount', 'quantity', 'start_date', 'end_date', 'promotion_category'] },
  { name: 'revisions', fields: ['type', 'field', 'old_value', 'new_value', 'user', 'user_id', 'outlet', 'outlet_id', 'date_time'] },
  { name: 'sales', fields: ['revenue', 'profit', 'profit_percentage', 'quantity', 'transaction_count', 'cost_of_goods', 'tax_amount', 'discount_amount', 'customer', 'customer_id', 'register', 'register_id', 'user', 'user_id', 'outlet', 'outlet_id', 'date_time'] },
  { name: 'sales_payments', fields: ['payment_method', 'payment_method_id', 'amount', 'transaction_count', 'register', 'register_id', 'outlet', 'outlet_id', 'date_time'] },
  { name: 'transfers', fields: ['status', 'quantity', 'value', 'from_outlet', 'from_outlet_id', 'to_outlet', 'to_outlet_id', 'user', 'user_id', 'date_time'] },
  { name: 'users', fields: ['name', 'first_name', 'last_name', 'email', 'role', 'role_id', 'outlet', 'outlet_id'] },
];

const defaultQuery = `SELECT
  BY_NAME AS "Name",
  case_quantity AS "Case Quantity",
  inventory.case_level AS "Case Level",
  inventory.single_level AS "Item Level",
  FORMAT(costs.last_cost * (inventory.case_level + (inventory.single_level / case_quantity)), '$', '', 2) AS "Value (Inc) (Last)" TOTAL(SUM)
FROM products
WHERE
  inventory.single_level + (inventory.case_level * case_quantity) > 0
ORDER "Name" asc`;

// Reference "Popular Queries" panel — 9 items, click asks to override the editor first
const popularQueries = [
  {
    name: 'Refunded Sales',
    description: 'Every sale where an item was returned, with the refunded value and the staff member who processed it.',
    query: `SELECT
  BY_NAME AS "Name",
  quantity AS "Refunded Quantity" TOTAL(SUM),
  revenue AS "Refunded Value" TOTAL(SUM)
FROM sales
BY product
WHERE
  quantity < 0
ORDER "Refunded Value" asc`,
  },
  {
    name: 'Sales with Inventory',
    description: 'Sales for each product alongside the inventory level currently on hand.',
    query: `SELECT
  BY_NAME AS "Name",
  quantity AS "Quantity Sold" TOTAL(SUM),
  revenue AS "Revenue" TOTAL(SUM),
  inventory.single_level AS "Item Level",
  inventory.case_level AS "Case Level"
FROM sales
BY product
ORDER "Revenue" desc`,
  },
  {
    name: 'Sales by Price Point',
    description: 'Groups the products sold by the price they were sold at, showing quantity and revenue per price.',
    query: `SELECT
  BY_NAME AS "Name",
  products.sell_price AS "Price Point",
  quantity AS "Quantity Sold" TOTAL(SUM),
  revenue AS "Revenue" TOTAL(SUM)
FROM sales
BY product
ORDER "Price Point" desc`,
  },
  {
    name: 'Weekly Sales Excluding Shop MyLocal',
    description: 'Weekly sales totals with all Shop MyLocal online orders removed.',
    query: `SELECT
  BY_NAME AS "Name",
  revenue AS "Revenue" TOTAL(SUM),
  transaction_count AS "Transactions" TOTAL(SUM)
FROM sales
BY outlet
WHERE
  date_time = 'thisWeek'
  AND sales.type != 'Shop MyLocal'
ORDER "Name" asc`,
  },
  {
    name: 'Orders & Returns Processed Since a Date',
    description: 'All purchase orders and supplier returns created on or after the chosen date.',
    query: `SELECT
  BY_NAME AS "Name",
  orders.reference AS "Reference",
  orders.status AS "Status",
  orders.quantity AS "Quantity" TOTAL(SUM),
  orders.total AS "Total" TOTAL(SUM)
FROM orders
BY supplier
START '2024-01-01'
ORDER "Name" asc`,
  },
  {
    name: 'All Shop MyLocal Sales',
    description: 'Only the sales that came through the Shop MyLocal online channel.',
    query: `SELECT
  BY_NAME AS "Name",
  quantity AS "Quantity Sold" TOTAL(SUM),
  revenue AS "Revenue" TOTAL(SUM)
FROM sales
BY product
WHERE
  sales.type = 'Shop MyLocal'
ORDER "Revenue" desc`,
  },
  {
    name: 'Hourly Transaction Count by Days of the Week',
    description: 'Transaction counts broken down by hour of the day for each day of the week.',
    query: `SELECT
  BY_NAME AS "Name",
  transaction_count AS "Transactions" TOTAL(SUM),
  revenue AS "Revenue" TOTAL(SUM)
FROM sales
BY hour
ORDER "Name" asc`,
  },
  {
    name: 'Last costs recently changed',
    description: 'Products whose last cost has changed recently, with the old and new cost.',
    query: `SELECT
  BY_NAME AS "Name",
  revisions.old_value AS "Old Cost",
  revisions.new_value AS "New Cost",
  revisions.date_time AS "Changed"
FROM revisions
BY product
WHERE
  revisions.field = 'last_cost'
ORDER "Changed" desc`,
  },
  {
    name: 'Orders & Returns Received During a Period',
    description: 'Purchase orders and supplier returns received between the selected start and end dates.',
    query: `SELECT
  BY_NAME AS "Name",
  orders.reference AS "Reference",
  orders.quantity AS "Quantity Received" TOTAL(SUM),
  orders.total AS "Total" TOTAL(SUM)
FROM orders
BY supplier
WHERE
  orders.status = 'Received'
ORDER "Name" asc`,
  },
];

const isCurrencyKey = (key) => /cost|value|price|revenue|profit|total|amount/i.test(key);

const InventoryQueryEditor = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getOutletId } = useAuth();

  // Query editor states
  const [customQuery, setCustomQuery] = useState('');
  const [selectedSchema, setSelectedSchema] = useState('schema');
  const [schemaSearch, setSchemaSearch] = useState('');
  const [expandedTables, setExpandedTables] = useState({});
  const [pendingQuery, setPendingQuery] = useState(null);

  // Report states
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  const [toast, setToast] = useState(null);

  // Save states
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [queryName, setQueryName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // A saved (favourite) query arrives as ?query=, otherwise the default inventory query
  useEffect(() => {
    setCustomQuery(searchParams.get('query') || defaultQuery);
  }, [searchParams]);

  const search = schemaSearch.trim().toLowerCase();
  // Reference matches on field names as well as table names
  const visibleTables = schemaTables.filter(
    (t) => !search || t.name.includes(search) || t.fields.some((f) => f.includes(search))
  );

  const parseAndExecuteQuery = async () => {
    if (!customQuery.trim()) {
      setToast({ severity: 'warning', message: 'Please enter a query' });
      return;
    }
    setLoading(true);
    try {
      const response = await inventoryReportService.getInventoryReport({
        query: customQuery,
        includeDeleted: false,
        outletId: getOutletId(),
      });

      if (response && response.success) {
        const data = response.data || [];
        setReportData(data);
        const initialExpanded = {};
        data.forEach((_, index) => { initialExpanded[index] = true; });
        setExpandedRows(initialExpanded);
        if (data.length === 0) {
          setToast({ severity: 'info', message: 'Query executed successfully but returned no data.' });
        }
      } else {
        setReportData([]);
        setToast({ severity: 'error', message: response?.error || response?.message || 'Failed to execute query. Please check your query syntax.' });
      }
    } catch (error) {
      console.error('Error executing query:', error);
      setReportData([]);
      setToast({
        severity: 'error',
        message: error.response?.data?.message || error.response?.data?.error || error.message || 'Error executing query.',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => `$${Number(value || 0).toFixed(2)}`;

  const handleToggleRow = (index) => {
    setExpandedRows((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  // Columns come from the executed query's result shape
  const columns = reportData.length === 0
    ? []
    : Object.keys(reportData[0])
        .filter((key) => !['children', 'isChild', 'isParent'].includes(key))
        .map((key) => ({
          key,
          label: key.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').replace(/^./, (c) => c.toUpperCase()).trim(),
        }));

  const flattenedData = [];
  reportData.forEach((row, index) => {
    flattenedData.push({ ...row, _index: index, _isParent: true });
    if (Array.isArray(row.children) && expandedRows[index]) {
      row.children.forEach((child, childIndex) => {
        flattenedData.push({ ...child, _index: index, _childIndex: childIndex, _isChild: true });
      });
    }
  });

  const totals = {};
  columns.forEach((col) => {
    const sum = reportData.reduce((acc, row) => acc + (typeof row[col.key] === 'number' ? row[col.key] : 0), 0);
    totals[col.key] = sum || null;
  });

  const renderValue = (col, value) => {
    if (isCurrencyKey(col.key) && (typeof value === 'number' || value === null || value === undefined)) {
      return formatCurrency(value);
    }
    if (typeof value === 'number') return value.toLocaleString();
    return value ?? '';
  };

  const handleExport = () => {
    if (reportData.length === 0) {
      setToast({ severity: 'warning', message: 'Please execute a query first to export results.' });
      return;
    }
    const csv = [
      columns.map((c) => `"${c.label}"`).join(','),
      ...flattenedData.map((row) =>
        columns.map((c) => {
          const value = row[c.key];
          return typeof value === 'number' ? value : `"${String(value ?? '').replace(/"/g, '""')}"`;
        }).join(',')
      ),
    ].join('\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventory-query-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (reportData.length === 0) {
      setToast({ severity: 'warning', message: 'Please execute a query first to print results.' });
      return;
    }
    // ponytail: hidden iframe beats a popup window (no blockers, no page-wide print CSS)
    const html = `<html><head><title>Inventory Query Report</title><style>
      body{font-family:Arial,sans-serif;padding:20px;font-size:12px}
      h1{font-size:20px}
      pre{background:#f5f5f5;padding:10px;font-size:11px;white-space:pre-wrap}
      table{width:100%;border-collapse:collapse}
      th{background:#5ebbeb;color:#fff;text-align:left;padding:8px;font-size:11px}
      td{padding:8px;font-size:11px;border-bottom:1px solid #eee}
      tr:nth-child(even) td{background:#f8f8f8}
      .child td:first-child{padding-left:24px;font-style:italic;color:#666}
    </style></head><body>
      <h1>Inventory Query Report</h1>
      <pre>${customQuery.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c])}</pre>
      <div>Generated: ${new Date().toLocaleString()}</div>
      <table><thead><tr>${columns.map((c) => `<th>${c.label}</th>`).join('')}</tr></thead>
      <tbody>${flattenedData.map((row) => `<tr class="${row._isChild ? 'child' : ''}">${columns
        .map((c) => `<td>${renderValue(c, row[c.key])}</td>`).join('')}</tr>`).join('')}</tbody></table>
    </body></html>`;

    const frame = document.createElement('iframe');
    frame.style.display = 'none';
    document.body.appendChild(frame);
    frame.contentDocument.write(html);
    frame.contentDocument.close();
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 1000);
  };

  const handleConfirmSave = async () => {
    if (!queryName.trim()) return;
    setIsSaving(true);
    try {
      await favouriteReportService.create({
        name: queryName.trim(),
        reportType: 'inventory',
        reportPath: '/reports/inventory/query',
        filters: { query: customQuery },
      });
      setToast({ severity: 'success', message: 'Query saved to Favourite Reports.' });
      setSaveDialogOpen(false);
      setQueryName('');
      navigate('/reports/favourite');
    } catch (error) {
      console.error('Error saving query:', error);
      setToast({ severity: 'error', message: error.response?.data?.error || 'Error saving query. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3, height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f5f5f5' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <IconButton onClick={() => navigate('/reports/inventory')}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#313439' }}>
          Query Editor
        </Typography>
      </Box>

      {/* Query Editor Section */}
      <Paper sx={{ mb: 2, flexShrink: 0, borderRadius: 0, border: '1px solid #000', boxShadow: 'none' }}>
        <Box sx={{ display: 'flex', height: '400px' }}>
          {/* Schema / Popular browser */}
          <Box sx={{ width: 382, borderRight: '1px solid #000', bgcolor: '#f7f7f7', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', bgcolor: 'white' }}>
              {[
                { id: 'schema', label: 'Schema', icon: <SchemaIcon /> },
                { id: 'popular', label: 'Popular', icon: <TerminalIcon /> },
              ].map((tab) => {
                const active = selectedSchema === tab.id;
                return (
                  <Button
                    key={tab.id}
                    startIcon={tab.icon}
                    onClick={() => setSelectedSchema(tab.id)}
                    disableRipple
                    sx={{
                      flex: 1,
                      height: 52,
                      borderRadius: 0,
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: 16,
                      bgcolor: 'transparent',
                      color: active ? '#1e40af' : '#000',
                      borderBottom: `4px solid ${active ? '#1e40af' : '#b3b3b3'}`,
                      transition: 'color 150ms cubic-bezier(0.4,0,0.2,1), background-color 150ms cubic-bezier(0.4,0,0.2,1)',
                      '&:hover': { bgcolor: 'transparent', color: '#1e40af' },
                    }}
                  >
                    {tab.label}
                  </Button>
                );
              })}
            </Box>

            {selectedSchema === 'schema' ? (
              <>
                <TextField
                  placeholder="Search Schema..."
                  value={schemaSearch}
                  onChange={(e) => setSchemaSearch(e.target.value)}
                  sx={{
                    m: 2,
                    ...inputSx,
                    '& .MuiOutlinedInput-input': { padding: '8px 16px', fontSize: 16, height: 26 },
                  }}
                />

                <Box sx={{ flex: 1, overflow: 'auto', px: 2, pb: 2 }}>
                  {visibleTables.map((table) => {
                    const open = Boolean(expandedTables[table.name]);
                    const fields = search
                      ? table.fields.filter((f) => f.includes(search) || table.name.includes(search))
                      : table.fields;
                    return (
                      <Box key={table.name}>
                        <Button
                          fullWidth
                          disableRipple
                          onClick={() => setExpandedTables((prev) => ({ ...prev, [table.name]: !prev[table.name] }))}
                          startIcon={
                            <ChevronRightIcon
                              sx={{
                                transform: open ? 'rotate(90deg)' : 'none',
                                transition: 'transform 150ms cubic-bezier(0.4,0,0.2,1)',
                              }}
                            />
                          }
                          sx={{
                            justifyContent: 'flex-start',
                            textTransform: 'none',
                            borderRadius: 0,
                            minHeight: 30,
                            py: '1px',
                            px: '6px',
                            color: open ? '#1e40af' : '#000',
                            fontFamily: '"Roboto Mono", monospace',
                            fontSize: 18,
                            fontWeight: 700,
                            transition: 'color 150ms cubic-bezier(0.4,0,0.2,1)',
                            '&:hover': { bgcolor: 'transparent', color: '#1e40af' },
                          }}
                        >
                          {table.name}
                        </Button>
                        {open && (
                          <Box sx={{ ml: 3, display: 'flex', flexDirection: 'column', gap: '4px', mb: 1 }}>
                            {fields.map((field) => (
                              <Box
                                key={field}
                                draggable
                                onDragStart={(e) => e.dataTransfer.setData('text/plain', `${table.name}.${field}`)}
                                onClick={() => setCustomQuery((prev) => `${prev}${prev.endsWith('\n') || !prev ? '' : '\n'}${table.name}.${field}`)}
                                sx={{
                                  cursor: 'grab',
                                  px: '6px',
                                  fontFamily: '"Roboto Mono", monospace',
                                  fontSize: 16,
                                  color: '#000',
                                  transition: 'color 150ms cubic-bezier(0.4,0,0.2,1)',
                                  '&:hover': { color: '#1e40af' },
                                }}
                              >
                                {field}
                              </Box>
                            ))}
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              </>
            ) : (
              <Box sx={{ flex: 1, overflow: 'auto', pb: 2 }}>
                <Typography sx={{ fontSize: 18, fontWeight: 700, px: 2, py: 1, color: '#000' }}>
                  Popular Queries
                </Typography>
                {popularQueries.map((item) => (
                  <Box
                    key={item.name}
                    onClick={() => setPendingQuery(item)}
                    sx={{
                      px: 2,
                      py: 1,
                      cursor: 'pointer',
                      borderRadius: '8px',
                      transition: 'background-color 150ms cubic-bezier(0.4,0,0.2,1)',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.10)' },
                    }}
                  >
                    <Typography sx={{ fontSize: 16, color: '#000' }}>{item.name}</Typography>
                    <Typography
                      sx={{
                        fontSize: 13,
                        color: '#5e5e5e',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {item.description}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          {/* Query Editor */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, borderBottom: '1px solid #000', bgcolor: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#313439' }}>Query</Typography>
              <Button
                size="small"
                onClick={() => setPendingQuery({ name: 'Default Query', query: defaultQuery })}
                sx={{ textTransform: 'none', color: '#0284c7', fontWeight: 700 }}
              >
                Reset
              </Button>
            </Box>
            <TextField
              multiline
              fullWidth
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              placeholder="Enter your query here..."
              sx={{
                flex: 1,
                '& .MuiInputBase-root': { height: '100%', fontFamily: 'monospace', fontSize: '0.875rem' },
                '& .MuiInputBase-input': { height: '100% !important', overflow: 'auto !important' },
                '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                '& textarea::placeholder': { color: '#808080', opacity: 1 },
              }}
              InputProps={{ style: { height: '100%', alignItems: 'flex-start', padding: '16px' } }}
            />
          </Box>
        </Box>
      </Paper>

      {/* Toolbar (reference: Export / Print / Save bottom-left under the editor) */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap', pl: '8px', mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<ExportIcon />} onClick={handleExport} disabled={!customQuery.trim()} sx={outlinedBtnSx}>
            Export
          </Button>
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint} disabled={!customQuery.trim()} sx={outlinedBtnSx}>
            Print
          </Button>
          <Button variant="outlined" startIcon={<SaveIcon />} onClick={() => setSaveDialogOpen(true)} disabled={!customQuery.trim()} sx={outlinedBtnSx}>
            Save
          </Button>
        </Box>
        <Button
          variant="contained"
          startIcon={<PlayArrowIcon />}
          onClick={parseAndExecuteQuery}
          disabled={loading || !customQuery.trim()}
          sx={primaryBtnSx}
        >
          Execute
        </Button>
      </Box>

      {/* Results */}
      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 0, border: '1px solid #000', boxShadow: 'none' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid #000', bgcolor: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#313439' }}>Results</Typography>
          {loading && <CircularProgress size={20} sx={{ color: '#5ebbeb' }} />}
        </Box>

        <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
              <CircularProgress />
            </Box>
          ) : flattenedData.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
              <Typography color="text.secondary">No results. Execute a query to see data.</Typography>
            </Box>
          ) : (
            <Table
              stickyHeader
              size="small"
              sx={{
                '& th': {
                  backgroundColor: '#5ebbeb',
                  color: '#f8f8f8',
                  fontWeight: 700,
                  fontSize: 16,
                  textTransform: 'uppercase',
                  padding: '8px',
                  borderBottom: 'none',
                },
                '& td': { color: '#000', fontSize: 16, padding: '8px 8px 8px 10px', borderBottom: 'none' },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 50 }} />
                  {columns.map((col) => (
                    <TableCell key={col.key} sx={{ whiteSpace: 'nowrap' }}>
                      {col.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {flattenedData.map((row, idx) => (
                  <TableRow key={idx} sx={{ bgcolor: row._isChild ? '#f8f8f8' : idx % 2 === 0 ? '#fff' : '#f8f8f8' }}>
                    <TableCell>
                      {row._isParent && Array.isArray(row.children) && row.children.length > 0 && (
                        <IconButton size="small" onClick={() => handleToggleRow(row._index)} sx={{ p: 0.5 }}>
                          {expandedRows[row._index] ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                        </IconButton>
                      )}
                      {row._isChild && <Box sx={{ pl: 3 }}>└</Box>}
                    </TableCell>
                    {columns.map((col) => (
                      <TableCell key={col.key}>{renderValue(col, row[col.key])}</TableCell>
                    ))}
                  </TableRow>
                ))}
                <TableRow sx={{ bgcolor: '#5ebbeb' }}>
                  <TableCell sx={{ color: '#f8f8f8', fontWeight: 700 }}>TOTAL</TableCell>
                  {columns.map((col) => (
                    <TableCell key={col.key} sx={{ color: '#f8f8f8', fontWeight: 700 }}>
                      {totals[col.key] === null ? '' : renderValue(col, totals[col.key])}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          )}
        </TableContainer>
      </Paper>

      {/* Override Query confirm (reference: guards unsaved editor text) */}
      <Dialog
        open={Boolean(pendingQuery)}
        onClose={() => setPendingQuery(null)}
        PaperProps={{ sx: { width: 316, borderRadius: '8px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)' } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2, bgcolor: '#bae6fd', color: '#075985', fontSize: 18, borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}>
          <HelpIcon />
          Override Query
        </Box>
        <DialogContent sx={{ p: 2 }}>
          <Typography sx={{ fontSize: 16, color: '#000' }}>You will override your current query</Typography>
          <Typography sx={{ fontSize: 16, color: '#000' }}>Are you sure you wish to continue?</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setPendingQuery(null)}
            sx={{
              bgcolor: '#d4d4d4',
              color: '#000',
              borderRadius: '12px',
              px: 4,
              py: 1,
              fontWeight: 700,
              textTransform: 'none',
              transition: 'none',
              '&:hover': { bgcolor: '#a3a3a3' },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              setCustomQuery(pendingQuery.query);
              setPendingQuery(null);
            }}
            sx={{
              bgcolor: '#0ea5e9',
              color: '#fff',
              borderRadius: '12px',
              px: 4,
              py: 1,
              fontWeight: 700,
              textTransform: 'none',
              transition: 'none',
              '&:hover': { bgcolor: '#38bdf8' },
            }}
          >
            Continue
          </Button>
        </DialogActions>
      </Dialog>

      {/* Save as Favourite Report */}
      <Dialog
        open={saveDialogOpen}
        onClose={() => { setSaveDialogOpen(false); setQueryName(''); }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px' } }}
      >
        <Box sx={{ px: 3, pt: 3 }}>
          <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#313439', mb: 2 }}>Save Query</Typography>
        </Box>
        <DialogContent>
          <Typography sx={{ mb: 1.5, color: '#676b72', fontSize: 16, fontWeight: 700 }}>Report Name</Typography>
          <TextField
            autoFocus
            fullWidth
            value={queryName}
            onChange={(e) => setQueryName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && queryName.trim() && !isSaving) handleConfirmSave(); }}
            placeholder="e.g. Monthly Inventory Report"
            sx={inputSx}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2.5 }}>
          <Button
            onClick={() => { setSaveDialogOpen(false); setQueryName(''); }}
            disabled={isSaving}
            sx={{ ...outlinedBtnSx, border: '1px solid #404040', color: '#676b72' }}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirmSave} variant="contained" disabled={!queryName.trim() || isSaving} sx={primaryBtnSx}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setToast(null)} severity={toast?.severity || 'info'} variant="filled" sx={{ borderRadius: '12px', fontSize: 16, fontWeight: 700 }}>
          {toast?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default InventoryQueryEditor;
