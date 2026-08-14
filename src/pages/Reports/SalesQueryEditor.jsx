import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  PlayArrow as PlayArrowIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  PictureAsPdf as PdfIcon,
  Description as CsvIcon,
  TableChart as XlsxIcon,
  Code as JsonIcon,
  StorageOutlined as SchemaIcon,
  TerminalOutlined as TerminalIcon,
  KeyboardArrowUp as ChevronUpIcon,
  KeyboardArrowDown as ChevronDownIcon,
  ArrowDropUp as SortAscIcon,
  ArrowDropDown as SortDescIcon,
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
const { jsPDF } = await import('jspdf');
import autoTable from 'jspdf-autotable';
import { useAuth } from '../../contexts/AuthContext';
import salesReportService from '../../services/salesReportService';
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
  '&:hover': { bgcolor: '#f0f9ff', borderColor: '#0ea5e9' },
  '&.Mui-disabled': {
    bgcolor: '#e5e5e5',
    color: '#737373',
    borderColor: '#a3a3a3',
    cursor: 'not-allowed',
  },
};

const neutralBtnSx = {
  ...outlinedBtnSx,
  color: '#676b72',
  borderColor: '#404040',
  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)', borderColor: '#404040' },
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
  '&.Mui-disabled': {
    bgcolor: '#e5e5e5',
    color: '#737373',
    cursor: 'not-allowed',
  },
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

const SalesQueryEditor = () => {
  const [searchParams] = useSearchParams();
  const { getOutletId } = useAuth();

  // Query editor states
  const [customQuery, setCustomQuery] = useState('');
  const [selectedSchema, setSelectedSchema] = useState('schema');
  const [schemaSearch, setSchemaSearch] = useState('');
  const [editorVisible, setEditorVisible] = useState(true);

  // Report states
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  const [sortConfig, setSortConfig] = useState(null);
  const [toast, setToast] = useState(null);

  // Export states
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportType, setExportType] = useState('pdf');
  const [exportOrientation, setExportOrientation] = useState('portrait');
  const [isExporting, setIsExporting] = useState(false);
  
  // Save states
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [queryName, setQueryName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Default query
  const defaultQuery = `SELECT
  BY_NAME AS "Name",
  revenue AS "Revenue",
  costOfGoods AS "Cost of Goods Sold",
  transactionCount AS "Transaction Count",
  profit AS "Profit",
  profitPercentage AS "Profit Percentage",
  taxAmount AS "Tax Amount",
  discountAmount AS "Discount Amount"
FROM sales
BY outlet
WHERE dateTime = 'thisMonth'
ORDER "Name" asc
CONSOLIDATED`;

  // Schema tables for sales reports
  const schemaTables = [
    'sales',
    'sale_items',
    'customers',
    'outlets',
    'registers',
    'users',
    'products',
    'payments',
    'tax_rates',
    'promotions',
  ];

  // Popular queries
  const popularQueries = [
    {
      name: 'Sales by Outlet',
      query: `SELECT
  BY_NAME AS "Name",
  revenue AS "Revenue",
  transactionCount AS "Transaction Count",
  profit AS "Profit",
  profitPercentage AS "Profit %"
FROM sales
BY outlet
WHERE dateTime = 'thisMonth'
ORDER "Name" asc
CONSOLIDATED`
    },
    {
      name: 'Sales by Product',
      query: `SELECT
  BY_NAME AS "Name",
  revenue AS "Revenue",
  quantity AS "Quantity Sold",
  profit AS "Profit",
  profitPercentage AS "Profit %"
FROM sales
BY product
WHERE dateTime = 'thisMonth'
ORDER "Name" asc
CONSOLIDATED`
    },
    {
      name: 'Sales by Customer',
      query: `SELECT
  BY_NAME AS "Name",
  revenue AS "Revenue",
  transactionCount AS "Transaction Count",
  profit AS "Profit"
FROM sales
BY customer
WHERE dateTime = 'thisMonth'
ORDER "Name" asc
CONSOLIDATED`
    },
  ];

  // Initialize the editor: a saved (favourite) query arrives as ?query=, else the default
  useEffect(() => {
    setCustomQuery(searchParams.get('query') || defaultQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const parseAndExecuteQuery = async () => {
    if (!customQuery.trim()) {
      setToast({ severity: 'warning', message: 'Please enter a query' });
      return;
    }

    setLoading(true);
    try {
      console.log('Executing query:', customQuery);
      
      const filters = {
        query: customQuery,
        includeDeleted: false,
        outletId: getOutletId(),
      };

      console.log('Sending filters:', filters);

      const response = await salesReportService.getSalesReport(filters);
      
      console.log('Response received:', response);
      
      if (response && response.success) {
        const data = response.data || [];
        console.log('Report data:', data);
        console.log('Data length:', data.length);
        
        setReportData(data);
        setSortConfig(null);

        // Initialize all rows as expanded
        const initialExpanded = {};
        data.forEach((_, index) => {
          initialExpanded[index] = true;
        });
        setExpandedRows(initialExpanded);

        if (data.length === 0) {
          setToast({ severity: 'info', message: 'Query executed successfully but returned no data — try widening the date range in your query.' });
        }
      } else {
        console.error('Failed to load sales report - response:', response);
        setReportData([]);
        const errorMessage = response?.error || response?.message || 'Failed to execute query. Please check your query syntax.';
        setToast({ severity: 'error', message: errorMessage });
      }
    } catch (error) {
      console.error('Error executing query:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      setReportData([]);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Error executing query. Please check your query syntax and try again.';
      setToast({ severity: 'error', message: `Error: ${errorMessage}` });
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
    
    // Column label mapping for better display
    const columnLabels = {
      name: 'Name',
      revenue: 'Revenue',
      costOfGoods: 'Cost of Goods Sold',
      transactionCount: 'Transaction Count',
      profit: 'Profit',
      profitPercentage: 'Profit %',
      taxAmount: 'Tax Amount',
      discountAmount: 'Discount Amount',
      quantity: 'Quantity',
      casesSold: 'Cases Sold',
      itemsSold: 'Items Sold',
      calculatedCasesSold: 'Calculated Cases Sold',
      calculatedItemsSold: 'Calculated Items Sold',
      averageSale: 'Average Sale',
      revenuePercentage: 'Revenue %',
      transactionPercentage: 'Transaction %',
      markup: 'Markup',
      totalItems: 'Total Items',
      rebateQuantity: 'Rebate Quantity',
      expectedRebate: 'Expected Rebate',
      promotionQuantity: 'Promotion Quantity',
      promotionalSavings: 'Promotional Savings',
      earnedLoyaltyPoints: 'Earned Loyalty Points',
    };
    
    Object.keys(firstRow).forEach(key => {
      if (key !== 'children' && key !== 'isChild' && key !== 'isParent') {
        columns.push({
          key,
          label: columnLabels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim(),
        });
      }
    });
    
    return columns;
  };

  const columns = getColumns();
  
  // Get name column key (backend always returns 'name' field)
  const getNameColumnKey = () => {
    // Backend always returns 'name' field, so use that
    return 'name';
  };

  const nameColumnKey = getNameColumnKey();

  // Column header click sorting: 1st click ascending, 2nd click descending
  const handleSort = (key) => {
    setSortConfig((prev) =>
      prev && prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  const sortedData = useMemo(() => {
    const indexed = reportData.map((row, index) => ({ ...row, _index: index }));
    if (!sortConfig) return indexed;
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    return indexed.sort((a, b) => {
      const av = a[sortConfig.key];
      const bv = b[sortConfig.key];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
    });
  }, [reportData, sortConfig]);

  // Flatten data for display (handle parent/child rows; children follow the expand state)
  const flattenData = () => {
    const flattened = [];
    sortedData.forEach((row) => {
      // Ensure name field exists
      const rowWithName = { ...row, name: row.name || '' };
      flattened.push({ ...rowWithName, _isParent: true });
      if (Array.isArray(row.children) && row.children.length > 0 && expandedRows[row._index]) {
        row.children.forEach((child, childIndex) => {
          const childWithName = { ...child, name: child.name || '' };
          flattened.push({ ...childWithName, _index: row._index, _childIndex: childIndex, _isChild: true });
        });
      }
    });
    return flattened;
  };

  const flattenedData = flattenData();

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
    return `sales-query-report-${dateStr}_${timeStr}`;
  };

  const exportToPDF = async () => {
    const doc = new jsPDF({
      orientation: exportOrientation === 'portrait' ? 'p' : 'l',
      unit: 'mm',
      format: 'a4'
    });

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Sales Query Report', 14, 15);
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Query: ${customQuery.substring(0, 100)}${customQuery.length > 100 ? '...' : ''}`, 14, 25);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

    const headers = [['Name', ...columns.map(col => col.label)]];
    const body = flattenedData.map(row => [
      row.name || row[nameColumnKey] || '',
      ...columns.map(col => {
        const value = row[col.key];
        if (col.key.toLowerCase().includes('revenue') || 
            col.key.toLowerCase().includes('cost') || 
            col.key.toLowerCase().includes('profit') ||
            col.key.toLowerCase().includes('average') ||
            col.key.toLowerCase().includes('amount') ||
            col.key.toLowerCase().includes('tax') ||
            col.key.toLowerCase().includes('discount')) {
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
      ['Sales Query Report'],
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
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Query Report');

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
      `# Sales Query Report`,
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
        <h1>Sales Query Report</h1>
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
                  if (col.key.toLowerCase().includes('revenue') || 
                      col.key.toLowerCase().includes('cost') || 
                      col.key.toLowerCase().includes('profit') ||
                      col.key.toLowerCase().includes('average') ||
                      col.key.toLowerCase().includes('amount') ||
                      col.key.toLowerCase().includes('tax') ||
                      col.key.toLowerCase().includes('discount')) {
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

  // Save function — saves as a Favourite Report so it can be listed, re-opened and deleted
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
        // ponytail: reuse the existing 'sales' type so it filters/labels on Favourite Reports;
        // the reportPath is what routes it back to this editor
        reportType: 'sales',
        reportPath: '/reports/sales/query',
        filters: { query: customQuery },
      });

      setToast({ severity: 'success', message: 'Query saved to Favourite Reports.' });
      setSaveDialogOpen(false);
      setQueryName('');
    } catch (error) {
      console.error('Error saving query:', error);
      setToast({
        severity: 'error',
        message: error.response?.data?.error || 'Error saving query. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3, height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f5f5f5' }}>
      {/* Query Editor Section (collapsible via the Hide Editor toggle) */}
      {editorVisible && (
      <Paper sx={{ mb: 2, flexShrink: 0, borderRadius: 0, border: '1px solid #000', boxShadow: 'none' }}>
        <Box sx={{ display: 'flex', height: '400px' }}>
          {/* Schema Browser */}
          <Box sx={{
            width: 320,
            borderRight: '1px solid #000',
            bgcolor: '#f7f7f7',
            display: 'flex',
            flexDirection: 'column'
          }}>
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
                      bgcolor: active ? 'rgba(0,0,0,0.1)' : 'transparent',
                      color: active ? '#1e40af' : '#000',
                      borderBottom: `4px solid ${active ? '#1e40af' : '#b3b3b3'}`,
                      transition: 'color 150ms cubic-bezier(0.4,0,0.2,1), background-color 150ms cubic-bezier(0.4,0,0.2,1)',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.1)' },
                    }}
                  >
                    {tab.label}
                  </Button>
                );
              })}
            </Box>

            <TextField
              placeholder={selectedSchema === 'schema' ? 'Search Schema...' : 'Search Queries...'}
              size="small"
              value={schemaSearch}
              onChange={(e) => setSchemaSearch(e.target.value)}
              sx={{ m: 2, ...inputSx }}
            />

            <Box sx={{ flex: 1, overflow: 'auto', px: 2, pb: 2 }}>
              {selectedSchema === 'schema' ? (
                schemaTables
                  .filter((table) => table.toLowerCase().includes(schemaSearch.trim().toLowerCase()))
                  .map((table) => (
                  <Box key={table} sx={{ mb: 1 }}>
                    <Button
                      fullWidth
                      onClick={() => {
                        const insertText = `FROM ${table}`;
                        setCustomQuery(prev => {
                          if (prev.includes('FROM')) {
                            return prev.replace(/FROM\s+\w+/i, `FROM ${table}`);
                          }
                          return prev + (prev ? '\n' : '') + insertText;
                        });
                      }}
                      sx={{ 
                        justifyContent: 'flex-start',
                        textTransform: 'none',
                        color: '#333',
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        '&:hover': { bgcolor: '#f0f0f0' }
                      }}
                    >
                      ▸ {table}
                    </Button>
                  </Box>
                ))
              ) : (
                popularQueries
                  .filter((query) => query.name.toLowerCase().includes(schemaSearch.trim().toLowerCase()))
                  .map((query, index) => (
                  <Box key={index} sx={{ mb: 1 }}>
                    <Button
                      fullWidth
                      onClick={() => setCustomQuery(query.query)}
                      sx={{ 
                        justifyContent: 'flex-start',
                        textTransform: 'none',
                        color: '#333',
                        fontSize: '0.875rem',
                        '&:hover': { bgcolor: '#f0f0f0' }
                      }}
                    >
                      {query.name}
                    </Button>
                  </Box>
                ))
              )}
            </Box>
          </Box>

          {/* Query Editor */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{
              p: 2,
              borderBottom: '1px solid #000',
              bgcolor: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Query
              </Typography>
              <Button
                size="small"
                onClick={() => setCustomQuery(defaultQuery)}
                sx={{ textTransform: 'none' }}
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
                '& .MuiInputBase-root': {
                  height: '100%',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                },
                '& .MuiInputBase-input': {
                  height: '100% !important',
                  overflow: 'auto !important',
                },
                '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                '& textarea::placeholder': { color: '#808080', opacity: 1 },
              }}
              InputProps={{
                style: {
                  height: '100%',
                  alignItems: 'flex-start',
                  padding: '16px',
                },
              }}
            />
          </Box>
        </Box>
      </Paper>
      )}

      {/* Toolbar (reference: full-width bar under the editor, left/right split) */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 1,
        flexWrap: 'wrap',
        pl: '8px',
        mb: 2,
      }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<ExportIcon />}
            onClick={handleExport}
            disabled={reportData.length === 0}
            sx={outlinedBtnSx}
          >
            Export
          </Button>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            disabled={reportData.length === 0}
            sx={outlinedBtnSx}
          >
            Print
          </Button>
          <Button
            variant="outlined"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={!customQuery.trim()}
            sx={outlinedBtnSx}
          >
            Save
          </Button>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={editorVisible ? <ChevronUpIcon /> : <ChevronDownIcon />}
            onClick={() => setEditorVisible((prev) => !prev)}
            sx={neutralBtnSx}
          >
            {editorVisible ? 'Hide Editor' : 'Show Editor'}
          </Button>
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
      </Box>

      {/* Results Table */}
      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 0, border: '1px solid #000', boxShadow: 'none' }}>
        <Box sx={{
          p: 2,
          borderBottom: '1px solid #000',
          bgcolor: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#313439' }}>
            Results
          </Typography>
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
                  height: 36,
                  borderBottom: 'none',
                },
                '& td': {
                  color: '#000',
                  fontSize: 16,
                  padding: '8px 8px 8px 10px',
                  borderBottom: 'none',
                },
              }}
            >
              <TableHead>
                <TableRow>
                  {columns.length > 0 && (
                    <TableCell sx={{ minWidth: 50 }}></TableCell>
                  )}
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      sx={{ whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}
                    >
                      <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
                        {col.label}
                        {sortConfig?.key === col.key &&
                          (sortConfig.direction === 'asc' ? <SortAscIcon /> : <SortDescIcon />)}
                      </Box>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {flattenedData.map((row, idx) => (
                  <TableRow key={idx} sx={{ bgcolor: row._isChild ? '#f8f8f8' : idx % 2 === 0 ? '#fff' : '#f8f8f8' }}>
                    {columns.length > 0 && (
                      <TableCell>
                        {row._isParent && Array.isArray(row.children) && row.children.length > 0 && (
                          <IconButton
                            size="small"
                            onClick={() => handleToggleRow(row._index)}
                            sx={{ p: 0.5 }}
                          >
                            {expandedRows[row._index] ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                          </IconButton>
                        )}
                        {row._isChild && <Box sx={{ pl: 3 }}>└</Box>}
                      </TableCell>
                    )}
                    {columns.map((col) => {
                      const value = row[col.key];
                      let displayValue = value;
                      
                      // Format based on column name
                      if (col.key.toLowerCase().includes('revenue') || 
                          col.key.toLowerCase().includes('cost') || 
                          col.key.toLowerCase().includes('profit') ||
                          col.key.toLowerCase().includes('average') ||
                          col.key.toLowerCase().includes('price') ||
                          col.key.toLowerCase().includes('amount') ||
                          col.key.toLowerCase().includes('tax') ||
                          col.key.toLowerCase().includes('discount')) {
                        displayValue = formatCurrency(value);
                      } else if (col.key.toLowerCase().includes('percentage') || 
                                 col.key.toLowerCase().includes('percent')) {
                        displayValue = formatPercentage(value);
                      } else if (typeof value === 'number') {
                        displayValue = value.toLocaleString();
                      }
                      
                      return (
                        <TableCell key={col.key}>
                          {displayValue}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
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
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
          }
        }}
      >
        <DialogTitle sx={{ py: 2, px: 3, fontSize: 20, fontWeight: 700, color: '#313439' }}>
          Export Report
        </DialogTitle>

        <DialogContent sx={{ px: 3, py: 3 }}>
          <Box sx={{ mb: 3 }}>
            <Typography
              sx={{
                mb: 1.5,
                color: '#676b72',
                fontSize: 16,
                fontWeight: 700
              }}
            >
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
              <Typography
                sx={{
                  mb: 1.5,
                  color: '#676b72',
                  fontSize: 16,
                  fontWeight: 700
                }}
              >
                Orientation
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                {['portrait', 'landscape'].map((orientation) => (
                  <Button
                    key={orientation}
                    fullWidth
                    variant={exportOrientation === orientation ? 'contained' : 'outlined'}
                    onClick={() => setExportOrientation(orientation)}
                    sx={exportOrientation === orientation ? primaryBtnSx : neutralBtnSx}
                  >
                    {orientation === 'portrait' ? 'Portrait' : 'Landscape'}
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
            sx={neutralBtnSx}
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

      {/* Save Dialog */}
      <Dialog
        open={saveDialogOpen}
        onClose={handleSaveDialogClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px' } }}
      >
        <DialogTitle sx={{ fontSize: 20, fontWeight: 700, color: '#313439' }}>Save Query</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1.5, color: '#676b72', fontSize: 16, fontWeight: 700 }}>
            Query Name
          </Typography>
          <TextField
            autoFocus
            fullWidth
            variant="outlined"
            value={queryName}
            onChange={(e) => setQueryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && queryName.trim() && !isSaving) handleConfirmSave();
            }}
            placeholder="Enter a name for this query"
            sx={inputSx}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2.5 }}>
          <Button onClick={handleSaveDialogClose} variant="outlined" disabled={isSaving} sx={neutralBtnSx}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmSave}
            variant="contained"
            disabled={!queryName.trim() || isSaving}
            sx={primaryBtnSx}
          >
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
        <Alert
          onClose={() => setToast(null)}
          severity={toast?.severity || 'info'}
          variant="filled"
          sx={{ borderRadius: '12px', fontSize: 16, fontWeight: 700 }}
        >
          {toast?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SalesQueryEditor;

