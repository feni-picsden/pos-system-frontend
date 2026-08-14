import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
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
  PictureAsPdf as PdfIcon,
  Description as CsvIcon,
  TableChart as XlsxIcon,
  Code as JsonIcon,
  StorageOutlined as SchemaIcon,
  TerminalOutlined as TerminalIcon,
  HelpOutline as HelpIcon,
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
const { jsPDF } = await import('jspdf');
import autoTable from 'jspdf-autotable';
import { useAuth } from '../../contexts/AuthContext';
import purchaseReportService from '../../services/purchaseReportService';
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
  '&.Mui-disabled': { bgcolor: '#e5e5e5', color: '#737373', borderColor: '#a3a3a3', cursor: 'not-allowed' },
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

// Reference schema browser: 16 tables, each expands in place to its field list
const schemaTables = [
  { name: 'actions', fields: ['type', 'description', 'user', 'user_id', 'register', 'register_id', 'outlet', 'outlet_id', 'date_time'] },
  { name: 'cash_movements', fields: ['type', 'amount', 'reason', 'user', 'user_id', 'register', 'register_id', 'outlet', 'outlet_id', 'date_time'] },
  { name: 'costs', fields: ['last_cost', 'average_cost', 'case_cost', 'supplier', 'supplier_id', 'outlet', 'outlet_id'] },
  { name: 'customers', fields: ['name', 'first_name', 'last_name', 'company', 'email', 'phone', 'balance', 'loyalty_points', 'customer_group', 'customer_group_id'] },
  { name: 'inventory', fields: ['status', 'single_level', 'case_level', 'quantity', 'single_reorder_level', 'case_reorder_level', 'reorder_level', 'single_reorder_amount', 'case_reorder_amount', 'reorder_amount', 'outlet', 'outlet_id'] },
  { name: 'inventory_log', fields: ['type', 'quantity', 'single_level', 'case_level', 'cost', 'user', 'user_id', 'outlet', 'outlet_id', 'date_time'] },
  { name: 'orders', fields: ['order_id', 'type', 'sender', 'sender_id', 'receiver', 'receiver_id', 'supplier', 'supplier_id', 'outlet', 'outlet_id', 'vendor_connection', 'vendor_connection_id', 'order_date', 'due_date', 'order_number', 'reference', 'notes', 'internal_notes', 'sent_at', 'received_at', 'product_id', 'base_cost', 'cost', 'fees', 'freight', 'payment_fees', 'total_quantity', 'tax', 'ordered_quantity', 'ordered_items', 'ordered_cases', 'received_quantity', 'received_items', 'received_cases', 'case_quantity', 'supplier_code'] },
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
  cost AS "Total Cost",
  fees AS "Fees",
  freight AS "Freight",
  payment_fees AS "Payment Fees",
  tax AS "Tax Amount"
FROM orders
BY outlet
ORDER "Name" asc
CONSOLIDATED`;

// Reference "Popular Queries" panel: title + description line, click asks to override the editor.
// ponytail: purchases are exposed through the Orders source, so every entry uses a BY the
// purchase endpoint actually supports (outlet/supplier/product/brand/category/family/tag).
const popularQueries = [
  {
    name: 'Purchases by Outlet',
    description: 'Total cost, fees, freight and tax for everything each outlet purchased in the period.',
    query: defaultQuery,
  },
  {
    name: 'Purchases by Supplier',
    description: 'One row of purchase information per supplier, with the cost and fees charged.',
    query: `SELECT
  BY_NAME AS "Name",
  cost AS "Total Cost",
  fees AS "Fees",
  freight AS "Freight"
FROM orders
BY supplier
ORDER "Name" asc
CONSOLIDATED`,
  },
  {
    name: 'Purchases by Product',
    description: 'Every product purchased over the period with its total cost and how often it was ordered.',
    query: `SELECT
  BY_NAME AS "Name",
  cost AS "Total Cost",
  transaction_count AS "Transaction Count"
FROM orders
BY product
ORDER "Name" asc
CONSOLIDATED`,
  },
  {
    name: 'Purchases by Brand',
    description: 'Purchase cost grouped by the brand classification of the products ordered.',
    query: `SELECT
  BY_NAME AS "Name",
  cost AS "Total Cost",
  tax AS "Tax Amount"
FROM orders
BY brand
ORDER "Total Cost" desc
CONSOLIDATED`,
  },
  {
    name: 'Purchases by Category',
    description: 'Purchase cost grouped by product category, highest spend first.',
    query: `SELECT
  BY_NAME AS "Name",
  cost AS "Total Cost",
  tax AS "Tax Amount"
FROM orders
BY category
ORDER "Total Cost" desc
CONSOLIDATED`,
  },
  {
    name: 'Purchases by Family',
    description: 'Purchase cost grouped by product family classification.',
    query: `SELECT
  BY_NAME AS "Name",
  cost AS "Total Cost",
  tax AS "Tax Amount"
FROM orders
BY family
ORDER "Total Cost" desc
CONSOLIDATED`,
  },
  {
    name: 'Purchases by Tag',
    description: 'Purchase cost grouped by the tags applied to the products ordered.',
    query: `SELECT
  BY_NAME AS "Name",
  cost AS "Total Cost",
  tax AS "Tax Amount"
FROM orders
BY tag
ORDER "Total Cost" desc
CONSOLIDATED`,
  },
  {
    name: 'Orders & Returns Processed Since a Date',
    description: 'A separate listing for each order created in the period, with its type, outlet, costs and fees.',
    query: `SELECT
  BY_NAME AS "Name",
  cost AS "Total Cost",
  fees AS "Fees",
  freight AS "Freight",
  payment_fees AS "Payment Fees"
FROM orders
BY supplier
ORDER "Name" asc`,
  },
  {
    name: 'Orders & Returns Received During a Period',
    description: 'What each supplier delivered over the period, consolidated into one figure per supplier.',
    query: `SELECT
  BY_NAME AS "Name",
  cost AS "Total Cost",
  fees AS "Fees",
  tax AS "Tax Amount"
FROM orders
BY supplier
ORDER "Total Cost" desc
CONSOLIDATED`,
  },
];

const PurchaseQueryEditor = () => {
  const navigate = useNavigate();
  const { getOutletId } = useAuth();

  // Query editor states — a ?query= handed over from the report page wins over the default
  const [customQuery, setCustomQuery] = useState(
    () => new URLSearchParams(window.location.search).get('query') || defaultQuery
  );
  const [selectedSchema, setSelectedSchema] = useState('schema');
  const [schemaSearch, setSchemaSearch] = useState('');
  const [expandedTables, setExpandedTables] = useState({});
  const [pendingQuery, setPendingQuery] = useState(null);
  const [toast, setToast] = useState(null);

  // Report states
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  
  // Export states
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportType, setExportType] = useState('pdf');
  const [exportOrientation, setExportOrientation] = useState('portrait');
  const [isExporting, setIsExporting] = useState(false);
  
  // Save states
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [queryName, setQueryName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const search = schemaSearch.trim().toLowerCase();
  // Reference filters on field names as well as table names
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
      const filters = {
        query: customQuery,
        includeDeleted: false,
        outletId: getOutletId(),
      };

      const response = await purchaseReportService.getPurchaseReport(filters);
      
      if (response.success) {
        const data = response.data || [];
        setReportData(data);
        
        // Initialize all rows as expanded
        const initialExpanded = {};
        data.forEach((_, index) => {
          initialExpanded[index] = true;
        });
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
        message: error.response?.data?.message || error.response?.data?.error || 'Error executing query. Please check your query syntax.',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return `$${Number(value || 0).toFixed(2)}`;
  };

  const formatPercentage = (value) => {
    return `${Number(value || 0).toFixed(2)}%`;
  };

  const handleToggleRow = (index) => {
    setExpandedRows(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Extract column headers from data
  const getColumns = () => {
    if (reportData.length === 0) return [];
    
    const firstRow = reportData[0];
    const columns = [];
    
    Object.keys(firstRow).forEach(key => {
      if (key !== 'children' && key !== 'isChild' && key !== 'isParent') {
        columns.push({
          key,
          label: key.toUpperCase().replace(/_/g, ' '),
        });
      }
    });
    
    return columns;
  };

  const columns = getColumns();
  
  // Get name column key (could be "Name", "name", or first column)
  const getNameColumnKey = () => {
    if (columns.length === 0) return 'name';
    const firstCol = columns[0];
    // Check if first column looks like a name column
    if (firstCol.key.toLowerCase() === 'name' || firstCol.label.toLowerCase() === 'name') {
      return firstCol.key;
    }
    return firstCol.key; // Use first column as name
  };

  const nameColumnKey = getNameColumnKey();

  // Flatten data for display (handle parent/child rows)
  const flattenData = () => {
    const flattened = [];
    reportData.forEach((row, index) => {
      flattened.push({ ...row, _index: index, _isParent: true, name: row[nameColumnKey] || row.name || '' });
      if (Array.isArray(row.children) && row.children.length > 0 && expandedRows[index]) {
        row.children.forEach((child, childIndex) => {
          flattened.push({ ...child, _index: index, _childIndex: childIndex, _isChild: true, name: child[nameColumnKey] || child.name || '' });
        });
      }
    });
    return flattened;
  };

  const flattenedData = flattenData();

  // Reference footers every numeric column with a blue TOTAL row
  const totals = {};
  columns.forEach((col) => {
    const sum = reportData.reduce((acc, row) => acc + (typeof row[col.key] === 'number' ? row[col.key] : 0), 0);
    totals[col.key] = sum || null;
  });

  const renderValue = (col, value) => {
    const key = col.key.toLowerCase();
    if (/revenue|cost|profit|average|price|amount|tax|discount|fees|freight/.test(key)) return formatCurrency(value);
    if (/percentage|percent/.test(key)) return formatPercentage(value);
    if (typeof value === 'number') return value.toLocaleString();
    return value ?? '';
  };

  // Export functions
  const handleExport = () => {
    if (reportData.length === 0) {
      setToast({ severity: 'warning', message: 'Please execute a query first to export results.' });
      return;
    }
    setExportDialogOpen(true);
  };

  const handleExportDialogClose = () => {
    setExportDialogOpen(false);
  };

  const handleConfirmExport = async () => {
    setIsExporting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      switch (exportType) {
        case 'pdf':
          await exportToPDF();
          break;
        case 'xlsx':
          await exportToXLSX();
          break;
        case 'csv':
          await exportToCSV();
          break;
        case 'json':
          await exportToJSON();
          break;
        default:
          console.error('Unknown export type:', exportType);
      }
      
      setExportDialogOpen(false);
    } catch (error) {
      console.error('Error exporting report:', error);
      setToast({ severity: 'error', message: 'Error exporting report. Please try again.' });
    } finally {
      setIsExporting(false);
    }
  };

  const getFormattedFileName = () => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    return `purchase-query-report-${dateStr}_${timeStr}`;
  };

  const exportToPDF = async () => {
    const doc = new jsPDF({
      orientation: exportOrientation === 'portrait' ? 'p' : 'l',
      unit: 'mm',
      format: 'a4'
    });

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Purchase Query Report', 14, 15);
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Query: ${customQuery.substring(0, 100)}${customQuery.length > 100 ? '...' : ''}`, 14, 25);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

    const headers = [['Name', ...columns.map(col => col.label)]];
    const body = flattenedData.map(row => [
      row.name || row[nameColumnKey] || '',
      ...columns.map(col => {
        const value = row[col.key];
        if (col.key.toLowerCase().includes('cost') || 
            col.key.toLowerCase().includes('fees') ||
            col.key.toLowerCase().includes('freight') ||
            col.key.toLowerCase().includes('amount') ||
            col.key.toLowerCase().includes('tax') ||
            col.key.toLowerCase().includes('rebate')) {
          return `$${(value || 0).toFixed(2)}`;
        } else if (col.key.toLowerCase().includes('percentage') || 
                   col.key.toLowerCase().includes('percent')) {
          return `${(value || 0).toFixed(2)}%`;
        }
        return value || '';
      })
    ]);

    autoTable(doc, {
      startY: 35,
      head: headers,
      body: body,
      theme: 'grid',
      styles: { 
        fontSize: exportOrientation === 'portrait' ? 7 : 8,
        cellPadding: 2
      },
      headStyles: { 
        fillColor: [33, 150, 243],
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: exportOrientation === 'portrait' ? 40 : 60 }
      },
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 0) {
          const rowData = flattenedData[data.row.index];
          if (rowData?._isChild) {
            data.cell.styles.fontStyle = 'italic';
            data.cell.styles.textColor = [100, 100, 100];
          }
        }
      }
    });

    doc.save(`${getFormattedFileName()}.pdf`);
  };

  const exportToXLSX = async () => {
    const metadata = [
      ['Purchase Query Report'],
      [`Query: ${customQuery}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
    ];
    
    const worksheetData = [
      ...metadata,
      ['Name', ...columns.map(col => col.label)],
      ...flattenedData.map(row => [
        row.name || row[nameColumnKey] || '',
        ...columns.map(col => {
          const value = row[col.key];
          if (col.key.toLowerCase().includes('percentage') || 
              col.key.toLowerCase().includes('percent')) {
            return Number((value || 0).toFixed(2));
          }
          return value || '';
        })
      ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Purchase Query Report');

    const range = XLSX.utils.decode_range(ws['!ref']);
    const colWidths = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      let maxWidth = 10;
      for (let R = range.s.r; R <= range.e.r; ++R) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellAddress]) continue;
        const cellValue = String(ws[cellAddress].v || '');
        maxWidth = Math.max(maxWidth, cellValue.length);
      }
      colWidths.push({ wch: Math.min(maxWidth + 2, 50) });
    }
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `${getFormattedFileName()}.xlsx`);
  };

  const exportToCSV = async () => {
    const metadata = [
      `# Purchase Query Report`,
      `# Query: ${customQuery}`,
      `# Generated: ${new Date().toLocaleString()}`,
      ''
    ];
    
    const csvHeaders = ['Name', ...columns.map(col => col.label)].join(',');
    
    const csvRows = flattenedData.map(row => {
      const nameValue = row.name || row[nameColumnKey] || '';
      const values = [
        `"${nameValue.replace(/"/g, '""')}"`,
        ...columns.map(col => {
          const value = row[col.key];
          if (col.key.toLowerCase().includes('percentage') || 
              col.key.toLowerCase().includes('percent')) {
            return (value || 0).toFixed(2);
          }
          return value || '';
        })
      ];
      return values.join(',');
    });

    const csvContent = [...metadata, csvHeaders, ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${getFormattedFileName()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportToJSON = async () => {
    const exportData = {
      metadata: {
        query: customQuery,
        generated: new Date().toISOString(),
      },
      columns: columns.map(col => ({ key: col.key, label: col.label })),
      data: flattenedData.map(row => {
        const rowData = { name: row.name || row[nameColumnKey] || '' };
        columns.forEach(col => {
          rowData[col.key] = row[col.key];
        });
        return rowData;
      }),
    };
    
    const jsonData = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${getFormattedFileName()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Print function
  const handlePrint = () => {
    if (reportData.length === 0) {
      setToast({ severity: 'warning', message: 'Please execute a query first to print results.' });
      return;
    }

    const printContent = `
      <div id="print-content" style="display: none;">
        <style>
          @media print {
            body * {
              visibility: hidden;
            }
            #print-content, #print-content * {
              visibility: visible;
            }
            #print-content {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              display: block !important;
            }
          }
          #print-content {
            font-family: Arial, sans-serif;
            padding: 20px;
            font-size: 12px;
          }
          #print-content h1 {
            font-size: 24px;
            margin-bottom: 20px;
            color: #333;
          }
          #print-content .query-info {
            margin-bottom: 20px;
            padding: 10px;
            background: #f5f5f5;
            border-radius: 4px;
            font-family: monospace;
            font-size: 11px;
            white-space: pre-wrap;
            word-break: break-all;
          }
          #print-content table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          #print-content th, #print-content td {
            padding: 8px;
            text-align: left;
            border: 1px solid #ddd;
          }
          #print-content th {
            background-color: #2196f3;
            color: white;
            font-weight: bold;
            font-size: 11px;
            text-align: center;
          }
          #print-content td {
            font-size: 11px;
          }
          #print-content td:first-child {
            font-weight: 500;
          }
          #print-content td:not(:first-child) {
            text-align: right;
          }
          #print-content tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          #print-content .child-row td:first-child {
            padding-left: 24px;
            font-style: italic;
            color: #666;
            font-weight: normal;
          }
        </style>
        <h1>Purchase Query Report</h1>
        <div class="query-info">Query: ${customQuery}</div>
        <div style="margin-bottom: 10px; color: #666; font-size: 11px;">
          Generated: ${new Date().toLocaleString()}
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              ${columns.map(col => `<th>${col.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${flattenedData.map(row => {
              const nameValue = row.name || row[nameColumnKey] || '';
              return `
              <tr class="${row._isChild ? 'child-row' : ''}">
                <td>${nameValue}</td>
                ${columns.map(col => {
                  const value = row[col.key];
                  let displayValue = value;
                  if (col.key.toLowerCase().includes('cost') || 
                      col.key.toLowerCase().includes('fees') ||
                      col.key.toLowerCase().includes('freight') ||
                      col.key.toLowerCase().includes('amount') ||
                      col.key.toLowerCase().includes('tax') ||
                      col.key.toLowerCase().includes('rebate')) {
                    displayValue = `$${(value || 0).toFixed(2)}`;
                  } else if (col.key.toLowerCase().includes('percentage') || 
                             col.key.toLowerCase().includes('percent')) {
                    displayValue = `${(value || 0).toFixed(2)}%`;
                  } else if (typeof value === 'number') {
                    displayValue = value.toLocaleString();
                  }
                  return `<td>${displayValue || ''}</td>`;
                }).join('')}
              </tr>
            `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    const existingPrintContent = document.getElementById('print-content');
    if (existingPrintContent) {
      existingPrintContent.remove();
    }

    const printDiv = document.createElement('div');
    printDiv.innerHTML = printContent;
    document.body.appendChild(printDiv);
    
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        const printElement = document.getElementById('print-content');
        if (printElement) {
          printElement.remove();
        }
      }, 100);
    }, 100);
  };

  // Save function — reference saves the query as a Favourite Report
  const handleSave = () => {
    if (!customQuery.trim()) {
      setToast({ severity: 'warning', message: 'Please enter a query to save.' });
      return;
    }
    setSaveDialogOpen(true);
  };

  const handleSaveDialogClose = () => {
    setSaveDialogOpen(false);
    setQueryName('');
  };

  const handleConfirmSave = async () => {
    if (!queryName.trim()) return;
    setIsSaving(true);
    try {
      await favouriteReportService.create({
        name: queryName.trim(),
        reportType: 'purchase',
        reportPath: '/reports/purchases/query',
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
    <Box sx={{ p: '8px', height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#fff' }}>
      {/* Reference has no page title — just a way back to the purchase report */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: '8px' }}>
        <IconButton onClick={() => navigate('/reports/purchases')} aria-label="Back to purchase reports">
          <ArrowBackIcon />
        </IconButton>
      </Box>

      {/* Query Editor Section */}
      <Paper sx={{ mb: 2, flexShrink: 0, borderRadius: 0, border: '1px solid #000', boxShadow: 'none' }}>
        <Box sx={{ display: 'flex', height: '500px' }}>
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
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.10)', color: '#1e40af' },
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
                                sx={{
                                  cursor: 'grab',
                                  px: '6px',
                                  fontFamily: '"Roboto Mono", monospace',
                                  fontSize: 16,
                                  color: '#000',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
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
              onDrop={(e) => {
                const token = e.dataTransfer.getData('text/plain');
                if (!token) return;
                e.preventDefault();
                setCustomQuery((prev) => `${prev}${prev.endsWith('\n') || !prev ? '' : '\n'}${token}`);
              }}
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

      {/* Toolbar (reference: Export / Print / Save sit under the editor, Execute on the right) */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap', pl: '8px', mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<ExportIcon />} onClick={handleExport} disabled={reportData.length === 0} sx={outlinedBtnSx}>
            Export
          </Button>
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint} disabled={reportData.length === 0} sx={outlinedBtnSx}>
            Print
          </Button>
          <Button variant="outlined" startIcon={<SaveIcon />} onClick={handleSave} disabled={!customQuery.trim()} sx={outlinedBtnSx}>
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

      {/* Results Table */}
      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 0, border: '1px solid #000', boxShadow: 'none' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid #000', bgcolor: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#313439' }}>Results</Typography>
          {loading && <CircularProgress size={20} sx={{ color: '#5ebbeb' }} />}
        </Box>

        <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
              <CircularProgress />
            </Box>
          ) : flattenedData.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
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
                      {row._isParent && Array.isArray(reportData[row._index]?.children) && reportData[row._index].children.length > 0 && (
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

      {/* Export Dialog */}
      <Dialog 
        open={exportDialogOpen} 
        onClose={handleExportDialogClose}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '12px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)'
          }
        }}
      >
        <DialogTitle sx={{
          bgcolor: '#bae6fd',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          py: 2,
          px: 3,
        }}>
          <HelpIcon sx={{ color: '#075985', fontSize: 28 }} />
          <Typography sx={{ color: '#075985', fontWeight: 700, fontSize: 18 }}>
            Export Report
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ px: 3, py: 3 }}>
          <Box sx={{ mb: 3 }}>
            <Typography sx={{ mb: 1.5, color: '#676b72', fontSize: 16, fontWeight: 700 }}>
              Export Type
            </Typography>
            <FormControl fullWidth>
              <Select
                value={exportType}
                onChange={(e) => setExportType(e.target.value)}
                displayEmpty
                sx={{
                  bgcolor: 'white',
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: 1 },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: 2 },
                }}
                renderValue={(value) => {
                  const icons = {
                    pdf: <PdfIcon sx={{ mr: 1.5, color: '#d32f2f' }} />,
                    xlsx: <XlsxIcon sx={{ mr: 1.5, color: '#2e7d32' }} />,
                    csv: <CsvIcon sx={{ mr: 1.5, color: '#ed6c02' }} />,
                    json: <JsonIcon sx={{ mr: 1.5, color: '#0288d1' }} />
                  };
                  const labels = {
                    pdf: 'PDF',
                    xlsx: 'XLSX',
                    csv: 'CSV',
                    json: 'JSON'
                  };
                  return (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {icons[value]}
                      <span style={{ fontWeight: 500 }}>{labels[value]}</span>
                    </Box>
                  );
                }}
              >
                <MenuItem value="pdf">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <PdfIcon sx={{ mr: 1.5, color: '#d32f2f' }} />
                    <span>PDF</span>
                  </Box>
                </MenuItem>
                <MenuItem value="xlsx">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <XlsxIcon sx={{ mr: 1.5, color: '#2e7d32' }} />
                    <span>XLSX</span>
                  </Box>
                </MenuItem>
                <MenuItem value="csv">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CsvIcon sx={{ mr: 1.5, color: '#ed6c02' }} />
                    <span>CSV</span>
                  </Box>
                </MenuItem>
                <MenuItem value="json">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <JsonIcon sx={{ mr: 1.5, color: '#0288d1' }} />
                    <span>JSON</span>
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          </Box>

          {exportType === 'pdf' && (
            <Box>
              <Typography sx={{ mb: 1.5, color: '#676b72', fontSize: 16, fontWeight: 700 }}>
                Orientation
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                {['portrait', 'landscape'].map((mode) => (
                  <Button
                    key={mode}
                    fullWidth
                    variant={exportOrientation === mode ? 'contained' : 'outlined'}
                    onClick={() => setExportOrientation(mode)}
                    sx={exportOrientation === mode ? primaryBtnSx : outlinedBtnSx}
                  >
                    {mode === 'portrait' ? 'Portrait' : 'Landscape'}
                  </Button>
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2.5 }}>
          <Button
            onClick={handleExportDialogClose}
            variant="outlined"
            disabled={isExporting}
            sx={{ ...outlinedBtnSx, border: '1px solid #404040', color: '#676b72' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmExport}
            variant="contained"
            disabled={isExporting}
            startIcon={isExporting ? <CircularProgress size={20} color="inherit" /> : null}
            sx={primaryBtnSx}
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Override Query confirm (reference: guards the unsaved editor text) */}
      <Dialog
        open={Boolean(pendingQuery)}
        onClose={() => setPendingQuery(null)}
        PaperProps={{ sx: { width: 316, borderRadius: '8px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)' } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2, bgcolor: '#bae6fd', color: '#075985', fontSize: 18 }}>
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
        onClose={handleSaveDialogClose}
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
            placeholder="e.g. Monthly Purchase Report"
            sx={inputSx}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2.5 }}>
          <Button
            onClick={handleSaveDialogClose}
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

export default PurchaseQueryEditor;

