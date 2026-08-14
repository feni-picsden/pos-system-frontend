import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Checkbox,
  IconButton,
  Menu,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
} from '@mui/material';
import {
  FileDownload as ExportIcon,
  PrintOutlined as PrintIcon,
  SaveOutlined as SaveIcon,
  ViewColumn as ColumnsIcon,
  EditOutlined as EditIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  ArrowDropDown,
  ArrowDropUp,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import inventoryReportService from '../../services/inventoryReportService';
import SaveReportDialog from '../../components/Reports/SaveReportDialog';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
const { jsPDF } = await import('jspdf');
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// ponytail: copied from pages/Reports/SalesReport.jsx (same reference chrome) instead of
// exporting from it — parallel parity agents own that file. Promote to components/Common
// if a third report needs it.

// Shopfront reference has no transitions/ripple.
const INSTANT = 'all 0s ease';

// Sky-outlined toolbar buttons (Export / Print / Save / Columns).
const SKY_BUTTON_SX = {
  color: '#0284c7',
  borderColor: '#0284c7',
  textTransform: 'none',
  fontWeight: 700,
  fontSize: 16,
  height: 42,
  borderRadius: '12px',
  transition: INSTANT,
  '&:hover': { borderColor: '#0284c7', bgcolor: 'rgba(0,0,0,0.05)' },
};

// Parity input outline: #404040 1px, focused #000 2px, radius 8px.
const FIELD_SX = {
  '& .MuiOutlinedInput-root': { borderRadius: '8px' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' },
  '& input::placeholder': { color: '#808080', opacity: 1 },
};

// Data table chrome — identical to components/Reports/ReportTable.jsx.
const TABLE_HEAD_SX = {
  '& th': {
    backgroundColor: '#5ebbeb',
    color: '#f8f8f8',
    fontWeight: 700,
    fontSize: 16,
    textTransform: 'uppercase',
    padding: '8px',
    height: 36,
    borderBottom: 'none',
    whiteSpace: 'nowrap',
  },
};

const TABLE_ROW_SX = {
  '& td': {
    color: '#000',
    fontWeight: 400,
    fontSize: 16,
    padding: '8px 8px 8px 10px',
    borderBottom: 'none',
  },
};

const TABLE_TOTAL_SX = {
  bgcolor: '#5ebbeb',
  '& td': {
    color: '#f8f8f8',
    fontWeight: 700,
    fontSize: 16,
    padding: '8px 8px 8px 10px',
    borderBottom: 'none',
  },
};

// Reference filter block: flush slate box, 80px tall, square, 1px near-white border.
const FILTER_BLOCK_SX = {
  height: 80,
  boxSizing: 'border-box',
  bgcolor: '#676b72',
  border: '1px solid #f8f8f8',
  borderRadius: 0,
  color: '#f8f8f8',
  fontSize: 16,
  p: '16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 1,
  cursor: 'pointer',
  transition: INSTANT,
};

// Reporting Query Language keywords — highlighted like the reference query bar.
const SQL_KEYWORDS = new Set([
  'SELECT', 'FROM', 'RANGE', 'AGGREGATE', 'BY', 'ON', 'WHERE', 'START', 'END', 'ORDER',
  'CONSOLIDATED', 'UNCONSOLIDATED', 'LIMIT', 'OFFSET', 'AS', 'TOTAL', 'AND', 'OR', 'IS',
  'NOT', 'NULL', 'LIKE', 'ASC', 'DESC', 'ASCENDING', 'DESCENDING', 'INCLUDE', 'EXCLUDE',
  'ONLY', 'CANCELLED', 'DELETED', 'VOIDED', 'ABORTED', 'BY_NAME', 'TODAY', 'ALL_OF_TIME',
  'CURRENT_TIMESTAMP',
]);

// keywords #0077aa, quoted strings #669900, punctuation #999999, identifiers #000000
const highlightSQL = (sql) =>
  sql
    .split(/("[^"]*"|'[^']*'|[A-Za-z_][A-Za-z0-9_]*|[^\sA-Za-z0-9_"']+)/g)
    .filter(Boolean)
    .map((token, i) => {
      let color;
      if (/^["']/.test(token)) color = '#669900';
      else if (/^[A-Za-z_]/.test(token)) color = SQL_KEYWORDS.has(token.toUpperCase()) ? '#0077aa' : '#000000';
      else if (!/^\s+$/.test(token)) color = '#999999';
      return (
        <span key={i} style={color ? { color } : undefined}>
          {token}
        </span>
      );
    });

// Reference filter: slate trigger block with an INLINE panel pushed below it
// (absolute, top 100%, full width, flat #f8f8f8, no shadow, no animation).
const ShopfrontFilter = ({ label, value, groups, onChange, renderValue }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = groups.flatMap((g) => g.items).find((o) => o.value === value);
  const display = renderValue ? renderValue(value) : selected?.label || '';

  return (
    <Box sx={{ position: 'relative', flex: '0 1 50%', minWidth: 240 }} ref={ref}>
      <Box onClick={() => setOpen((o) => !o)} sx={FILTER_BLOCK_SX}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ fontSize: 16, fontWeight: 400, lineHeight: 1.25 }}>{label}</Box>
          <Box
            sx={{
              fontSize: '1.4em',
              fontWeight: 400,
              lineHeight: 1.25,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {display}
          </Box>
        </Box>
        {open ? <ArrowDropUp /> : <ArrowDropDown />}
      </Box>
      {open && (
        <Box
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            width: '100%',
            zIndex: 8,
            boxSizing: 'border-box',
            bgcolor: '#f8f8f8',
            borderRadius: 0,
            boxShadow: 'none',
            p: '16px',
          }}
        >
          {groups.map((group, gi) => (
            <Box key={group.label || `g${gi}`}>
              {group.label && (
                <Box sx={{ fontWeight: 700, fontSize: '19.2px', lineHeight: '23px', color: '#313439' }}>
                  {group.label}
                </Box>
              )}
              <Box sx={{ pl: group.label ? '16px' : 0 }}>
                {group.items.map((option) => (
                  <Box
                    key={option.value}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    sx={{
                      fontSize: '19.2px',
                      lineHeight: '23px',
                      p: '4px',
                      cursor: 'pointer',
                      bgcolor: option.value === value ? '#5ebbeb' : 'transparent',
                      color: option.value === value ? '#f8f8f8' : '#313439',
                      transition: 'background 0.1s, color 0.1s',
                      '&:hover': { bgcolor: '#313439', color: '#f8f8f8' },
                    }}
                  >
                    {option.label}
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

// Report Type — the five documented inventory-level filters.
const REPORT_TYPE_GROUPS = [
  {
    items: [
      { value: 'inventory_on_hand', label: 'Inventory on Hand' },
      { value: 'no_inventory', label: 'No Inventory' },
      { value: 'not_zero_inventory', label: 'Not Zero Inventory' },
      { value: 'only_zero_inventory', label: 'Only Zero Inventory' },
      { value: 'all_inventory_levels', label: 'All Inventory Levels' },
    ],
  },
];

const GROUP_BY_GROUPS = [
  {
    items: [
      { value: 'none', label: 'None' },
      { value: 'outlet', label: 'Outlet' },
    ],
  },
  {
    label: 'Classifications',
    items: [
      { value: 'brand', label: 'Brand' },
      { value: 'category', label: 'Category' },
      { value: 'family', label: 'Family' },
      { value: 'tag', label: 'Tag' },
    ],
  },
  {
    label: 'Stock',
    items: [
      { value: 'core_supplier', label: 'Core Supplier' },
      { value: 'last_supplier', label: 'Last Supplier' },
    ],
  },
];

const InventoryReport = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getOutletId } = useAuth();
  
  const getInitialState = () => {
    const savedReportType = searchParams.get('reportType');
    const savedGroupBy = searchParams.get('groupBy');
    const savedSearchTerm = searchParams.get('searchTerm');
    const savedIncludeDeleted = searchParams.get('includeDeleted');

    return {
      reportType: savedReportType || 'inventory_on_hand',
      groupBy: savedGroupBy || 'none',
      searchTerm: savedSearchTerm !== null ? savedSearchTerm : '',
      includeDeleted: savedIncludeDeleted === 'true' || false,
    };
  };

  const initialState = getInitialState();
  
  // Filter states
  const [reportType, setReportType] = useState(initialState.reportType);
  const [groupBy, setGroupBy] = useState(initialState.groupBy);
  const [searchTerm, setSearchTerm] = useState(initialState.searchTerm);
  const [includeDeleted, setIncludeDeleted] = useState(initialState.includeDeleted);
  
  // Data states
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  
  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState({
    caseQuantity: true,
    caseLevel: true,
    itemLevel: true,
    valueIncAverage: true,
    productId: false,
    status: false,
    totalItems: false,
    lastCaseCostEx: false,
    averageCaseCostEx: false,
    lastCaseCostInc: false,
    averageCaseCostInc: false,
    valueExcLast: false,
    valueIncLast: false,
  });
  
  // UI states
  const [columnsAnchorEl, setColumnsAnchorEl] = useState(null);
  const [columnsChipsExpanded, setColumnsChipsExpanded] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportType, setExportType] = useState('pdf');
  const [exportOrientation, setExportOrientation] = useState('portrait');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  
  // Query preview (edited on the query editor page)
  const [customQuery, setCustomQuery] = useState('');

  // Column definitions
  // Title-case picker labels; uppercase header labels for the data table;
  // `sql` is the Reporting Query Language projection shown in the query bar.
  const allColumns = [
    { key: 'caseQuantity', label: 'Case Quantity', headerLabel: 'CASE QUANTITY', sql: 'case_quantity AS "Case Quantity"' },
    { key: 'caseLevel', label: 'Case Level', headerLabel: 'CASE LEVEL', sql: 'inventory.case_level AS "Case Level"' },
    { key: 'itemLevel', label: 'Item Level', headerLabel: 'ITEM LEVEL', sql: 'inventory.single_level AS "Item Level"' },
    { key: 'valueIncAverage', label: 'Value (Inc) (Average)', headerLabel: 'VALUE (INC) (AVERAGE)', sql: 'FORMAT(costs.average_cost * (inventory.case_level + (inventory.single_level / case_quantity)), \'$\', \'\', 2) AS "Value (Inc) (Average)" TOTAL(SUM)' },
    { key: 'productId', label: 'Product ID', headerLabel: 'PRODUCT ID', sql: 'id AS "Product ID"' },
    { key: 'status', label: 'Status', headerLabel: 'STATUS', sql: 'status AS "Status"' },
    { key: 'totalItems', label: 'Total Items', headerLabel: 'TOTAL ITEMS', sql: 'inventory.single_level + (inventory.case_level * case_quantity) AS "Total Items" TOTAL(SUM)' },
    { key: 'lastCaseCostEx', label: 'Last Case Cost (Ex)', headerLabel: 'LAST CASE COST (EX)', sql: 'FORMAT(costs.last_cost_ex, \'$\', \'\', 2) AS "Last Case Cost (Ex)"' },
    { key: 'averageCaseCostEx', label: 'Average Case Cost (Ex)', headerLabel: 'AVERAGE CASE COST (EX)', sql: 'FORMAT(costs.average_cost_ex, \'$\', \'\', 2) AS "Average Case Cost (Ex)"' },
    { key: 'lastCaseCostInc', label: 'Last Case Cost (Inc)', headerLabel: 'LAST CASE COST (INC)', sql: 'FORMAT(costs.last_cost, \'$\', \'\', 2) AS "Last Case Cost (Inc)"' },
    { key: 'averageCaseCostInc', label: 'Average Case Cost (Inc)', headerLabel: 'AVERAGE CASE COST (INC)', sql: 'FORMAT(costs.average_cost, \'$\', \'\', 2) AS "Average Case Cost (Inc)"' },
    { key: 'valueExcLast', label: 'Value (Ex) (Last)', headerLabel: 'VALUE (EX) (LAST)', sql: 'FORMAT(costs.last_cost_ex * (inventory.case_level + (inventory.single_level / case_quantity)), \'$\', \'\', 2) AS "Value (Ex) (Last)" TOTAL(SUM)' },
    { key: 'valueIncLast', label: 'Value (Inc) (Last)', headerLabel: 'VALUE (INC) (LAST)', sql: 'FORMAT(costs.last_cost * (inventory.case_level + (inventory.single_level / case_quantity)), \'$\', \'\', 2) AS "Value (Inc) (Last)" TOTAL(SUM)' },
  ];

  useEffect(() => {
    // Ensure we load data on mount, especially when URL params are present
    loadReportData();
  }, [reportType, groupBy, includeDeleted]);
  
  // Also trigger load when URL params change
  useEffect(() => {
    const hasParams = searchParams.toString().length > 0;
    if (hasParams) {
      // Small delay to ensure state is fully initialized from URL params
      const timer = setTimeout(() => {
        loadReportData();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  // Reload when search term changes (with debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      loadReportData();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      const filters = {
        reportType,
        groupBy,
        searchTerm,
        includeDeleted,
        outletId: getOutletId(),
      };

      const response = await inventoryReportService.getInventoryReport(filters);
      
      if (response.success) {
        const data = response.data || [];
        setReportData(data);
        
        // Initialize all rows as expanded
        const initialExpanded = {};
        data.forEach((_, index) => {
          initialExpanded[index] = true;
        });
        setExpandedRows(initialExpanded);
      } else {
        console.error('Failed to load inventory report');
        setReportData([]);
      }
    } catch (error) {
      console.error('Error loading inventory report:', error);
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExportDialogClose = () => {
    setExportDialogOpen(false);
  };

  const handleExport = () => {
    setExportDialogOpen(true);
  };

  const handleExportConfirm = () => {
    switch (exportType) {
      case 'pdf':
        exportToPDF();
        break;
      case 'xlsx':
        exportToExcel();
        break;
      case 'csv':
        exportToCSV();
        break;
      case 'json':
        exportToJSON();
        break;
      default:
        break;
    }
    handleExportDialogClose();
  };

  const formatCurrency = (value) => {
    return `$${Number(value || 0).toFixed(2)}`;
  };

  const flattenReportData = () => {
    const flattened = [];
    reportData.forEach(row => {
      flattened.push({ ...row, isParent: !!row.children });
      if (row.children && Array.isArray(row.children)) {
        row.children.forEach(child => {
          flattened.push({ ...child, isChild: true });
        });
      }
    });
    return flattened;
  };

  const exportToPDF = () => {
    const doc = new jsPDF({
      orientation: exportOrientation,
      unit: 'mm',
      format: 'a4',
    });

    doc.setFontSize(18);
    doc.text('Inventory Report', 14, 15);
    
    doc.setFontSize(10);
    doc.text(`Report Type: ${reportType}`, 14, 25);
    doc.text(`Group By: ${groupBy}`, 14, 30);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 35);

    const columns = [
      { header: 'Name', dataKey: 'name' },
      ...allColumns.filter(col => visibleColumns[col.key]).map(col => ({
        header: col.headerLabel,
        dataKey: col.key,
      })),
    ];

    const flatData = flattenReportData();
    const rows = flatData.map(row => {
      const rowData = { name: row.isChild ? `  ${row.name}` : row.name };
      allColumns.filter(col => visibleColumns[col.key]).forEach(col => {
        const value = row[col.key];
        if (col.key.includes('value') || col.key.includes('Cost')) {
          rowData[col.key] = formatCurrency(value);
        } else {
          rowData[col.key] = value || 0;
        }
      });
      return rowData;
    });

    autoTable(doc, {
      head: [columns.map(col => col.header)],
      body: rows.map(row => columns.map(col => row[col.dataKey])),
      startY: 40,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [33, 150, 243] },
    });

    doc.save('inventory-report.pdf');
  };

  const exportToExcel = () => {
    const flatData = flattenReportData();
    const worksheetData = flatData.map(row => {
      const rowData = { Name: row.name };
      allColumns.filter(col => visibleColumns[col.key]).forEach(col => {
        rowData[col.headerLabel] = row[col.key] || 0;
      });
      return rowData;
    });

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory Report');
    XLSX.writeFile(workbook, 'inventory-report.xlsx');
  };

  const exportToCSV = () => {
    const flatData = flattenReportData();
    const headers = ['Name', ...allColumns.filter(col => visibleColumns[col.key]).map(col => col.headerLabel)];
    const csvContent = [
      headers.join(','),
      ...flatData.map(row => {
        const values = [
          row.name,
          ...allColumns.filter(col => visibleColumns[col.key]).map(col => row[col.key] || 0)
        ];
        return values.join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'inventory-report.csv';
    link.click();
  };

  const exportToJSON = () => {
    const flatData = flattenReportData();
    const jsonData = JSON.stringify(flatData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'inventory-report.json';
    link.click();
  };

  const handleSave = () => {
    setSaveDialogOpen(true);
  };

  const handlePrint = () => {
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
          #print-content .report-info {
            margin-bottom: 20px;
            padding: 10px;
            background: #f5f5f5;
            border-radius: 4px;
          }
          #print-content .report-info p {
            margin: 5px 0;
            font-size: 13px;
            color: #666;
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
          #print-content .total-row {
            background-color: #5ebbeb !important;
            font-weight: bold;
          }
          #print-content .total-row td {
            font-weight: bold;
            color: white;
          }
        </style>
        <h1>Inventory Report</h1>
        <div class="report-info">
          <p><strong>Report Type:</strong> ${reportType}</p>
          <p><strong>Group By:</strong> ${groupBy}</p>
          <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              ${allColumns.filter(col => visibleColumns[col.key]).map(col => `<th>${col.headerLabel}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${flattenReportData().map(row => `
              <tr${row.isChild ? ' class="child-row"' : ''}>
                <td>${row.name}</td>
                ${allColumns.filter(col => visibleColumns[col.key]).map(col => {
                  const value = row[col.key];
                  const formattedValue = col.key.includes('value') || col.key.includes('Cost') 
                    ? formatCurrency(value)
                    : (value || 0);
                  return `<td>${formattedValue}</td>`;
                }).join('')}
              </tr>
            `).join('')}
            ${reportData.length > 0 ? `
              <tr class="total-row">
                <td>Total</td>
                ${allColumns.filter(col => visibleColumns[col.key]).map(col => {
                  const total = reportData.reduce((sum, row) => sum + (row[col.key] || 0), 0);
                  const formattedTotal = col.key.includes('value') || col.key.includes('Cost')
                    ? formatCurrency(total)
                    : total;
                  return `<td>${formattedTotal}</td>`;
                }).join('')}
              </tr>
            ` : ''}
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

  const handleToggleRow = (index) => {
    setExpandedRows(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Generate the Reporting Query Language preview from the current filters + visible columns
  const generateSQLQuery = () => {
    const projections = [
      'BY_NAME AS "Name"',
      ...allColumns.filter(col => visibleColumns[col.key]).map(col => col.sql),
    ];
    let query = `SELECT\n${projections.map(p => `  ${p}`).join(',\n')}\n`;
    query += 'FROM products\n';
    query += 'BY product\n';

    if (groupBy && groupBy !== 'none') {
      query += `ON ${groupBy}\n`;
    }

    query += 'WHERE\n';

    // Documented inventory-level filters
    switch (reportType) {
      case 'inventory_on_hand':
        query += '  inventory.single_level + (inventory.case_level * case_quantity) > 0\n';
        break;
      case 'no_inventory':
        query += '  inventory.single_level + (inventory.case_level * case_quantity) <= 0\n';
        break;
      case 'not_zero_inventory':
        query += '  inventory.single_level + (inventory.case_level * case_quantity) != 0\n';
        break;
      case 'only_zero_inventory':
        query += '  inventory.single_level + (inventory.case_level * case_quantity) = 0\n';
        break;
      default:
        query += '  1 = 1\n';
    }

    if (searchTerm) {
      query += `  AND BY_NAME LIKE '%${searchTerm}%'\n`;
    }

    if (!includeDeleted) {
      query += '  EXCLUDE DELETED\n';
    }

    query += 'ORDER "Name" asc\n';
    query += 'CONSOLIDATED';

    return query;
  };

  // Keep the query preview in sync with the filters and visible columns.
  useEffect(() => {
    setCustomQuery(generateSQLQuery());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, groupBy, searchTerm, includeDeleted, visibleColumns]);

  const handleColumnToggle = (columnKey) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }));
  };

  const calculateTotals = () => {
    const totals = {};
    allColumns.forEach(col => {
      if (col.key === 'caseQuantity') {
        totals[col.key] = '-';
      } else {
        totals[col.key] = reportData.reduce((sum, row) => {
          const value = row[col.key];
          return sum + (typeof value === 'number' ? value : 0);
        }, 0);
      }
    });
    return totals;
  };

  const totals = calculateTotals();

  return (
    <Box sx={{ p: '8px' }}>
      {/* Query bar — reference has no page heading; the query bar is the first element */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          height: 60,
          boxSizing: 'border-box',
          pl: '16px',
          mb: '8px',
          bgcolor: 'rgba(0,0,0,0)',
          border: '1px solid #404040',
          borderRadius: '8px',
          boxShadow: 'none',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            fontFamily: "'Roboto Mono', monospace",
            fontSize: 16,
            color: '#000000',
          }}
        >
          {highlightSQL(customQuery.replace(/\n/g, ' '))}
        </Box>
        <Button
          variant="text"
          startIcon={<EditIcon />}
          onClick={() => navigate('/reports/inventory/query')}
          sx={{
            ml: 2,
            minWidth: 88,
            color: '#16a34a',
            textTransform: 'none',
            whiteSpace: 'nowrap',
            fontWeight: 700,
            fontSize: 16,
            borderRadius: '12px',
            border: '1px solid transparent',
            bgcolor: 'transparent',
            transition: INSTANT,
            '&:hover': { bgcolor: 'rgba(0,0,0,0.05)', border: '1px solid transparent' },
          }}
        >
          Edit
        </Button>
      </Box>

      {/* Filters — flush 80px slate blocks, half width each, with inline dropdowns */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', mb: '8px' }}>
        <ShopfrontFilter
          label="Report Type"
          value={reportType}
          groups={REPORT_TYPE_GROUPS}
          onChange={setReportType}
          renderValue={(value) =>
            value === 'inventory_on_hand'
              ? 'Inventory On Hand'
              : REPORT_TYPE_GROUPS[0].items.find((o) => o.value === value)?.label || ''
          }
        />
        <ShopfrontFilter
          label="Group By"
          value={groupBy}
          groups={GROUP_BY_GROUPS}
          onChange={setGroupBy}
        />
      </Box>

      {/* Search + action buttons */}
      <Paper elevation={0} sx={{ p: 2, mb: '8px' }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search for anything"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ ...FIELD_SX, mb: 2 }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Button variant="outlined" startIcon={<ExportIcon />} onClick={handleExport} sx={SKY_BUTTON_SX}>
              Export
            </Button>
            <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint} sx={SKY_BUTTON_SX}>
              Print
            </Button>
            <Button variant="outlined" startIcon={<SaveIcon />} onClick={handleSave} sx={SKY_BUTTON_SX}>
              Save
            </Button>
            <Button
              variant="outlined"
              startIcon={<ColumnsIcon />}
              onClick={(e) => setColumnsAnchorEl(e.currentTarget)}
              sx={SKY_BUTTON_SX}
            >
              Columns
            </Button>
          </Box>
          <FormControlLabel
            sx={{ m: 0 }}
            labelPlacement="start"
            control={
              <ShopfrontSwitch
                checked={includeDeleted}
                onChange={(e) => setIncludeDeleted(e.target.checked)}
                sx={{ ml: 1 }}
              />
            }
            label={<Typography variant="body2">Include Deleted</Typography>}
          />
        </Box>
      </Paper>

      {/* Columns Menu */}
      <Menu
        anchorEl={columnsAnchorEl}
        open={Boolean(columnsAnchorEl)}
        onClose={() => setColumnsAnchorEl(null)}
        PaperProps={{
          style: { maxHeight: 460, width: 320 }
        }}
      >
        {/* Selected-columns chips summary bar */}
        <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid #e0e0e0' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, flexWrap: 'wrap' }}>
            {(() => {
              const selected = allColumns.filter(c => visibleColumns[c.key]);
              const shown = columnsChipsExpanded ? selected : selected.slice(0, 2);
              const remaining = selected.length - shown.length;
              return (
                <>
                  {shown.map(c => (
                    <Chip
                      key={c.key}
                      label={c.label}
                      size="small"
                      onDelete={() => handleColumnToggle(c.key)}
                      sx={{ bgcolor: '#e6f4fb', color: '#0284c7', fontWeight: 600 }}
                    />
                  ))}
                  {remaining > 0 && (
                    <Chip
                      label={`${remaining} More...`}
                      size="small"
                      onClick={() => setColumnsChipsExpanded(true)}
                      sx={{ bgcolor: '#f0f0f0', color: '#313439', cursor: 'pointer' }}
                    />
                  )}
                  <IconButton size="small" onClick={() => setColumnsChipsExpanded(v => !v)} sx={{ ml: 'auto', p: 0.25 }}>
                    {columnsChipsExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                  </IconButton>
                </>
              );
            })()}
          </Box>
        </Box>
        {allColumns.map((column) => {
          const checked = visibleColumns[column.key];
          return (
            <MenuItem
              key={column.key}
              onClick={() => handleColumnToggle(column.key)}
            >
              <Checkbox
                checked={checked}
                icon={<CheckBoxOutlineBlankIcon />}
                checkedIcon={<CheckBoxIcon />}
                sx={{ color: '#5ebbeb', '&.Mui-checked': { color: '#5ebbeb' } }}
              />
              <Typography sx={{ color: checked ? '#0284c7' : 'inherit', fontWeight: checked ? 600 : 400 }}>
                {column.label}
              </Typography>
            </MenuItem>
          );
        })}
      </Menu>

      {/* Data Table */}
      <Paper elevation={0} sx={{ borderRadius: 0 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={TABLE_HEAD_SX}>
                  <TableCell>NAME</TableCell>
                  {allColumns.filter(col => visibleColumns[col.key]).map(column => (
                    <TableCell key={column.key} align="right">
                      {column.headerLabel}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {reportData.length === 0 ? (
                  <TableRow>
                    <TableCell 
                      colSpan={allColumns.filter(col => visibleColumns[col.key]).length + 1}
                      align="center"
                      sx={{ py: 5 }}
                    >
                      <Typography color="text.secondary">
                        No data available
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  reportData.map((row, index) => {
                    const hasChildren = Boolean(row.children && row.children.length > 0);
                    return (
                    <React.Fragment key={index}>
                      <TableRow
                        sx={{
                          ...TABLE_ROW_SX,
                          bgcolor: hasChildren ? '#f8f8f8' : index % 2 === 0 ? '#fff' : '#f8f8f8',
                          cursor: hasChildren ? 'pointer' : 'default',
                          '& td': { ...TABLE_ROW_SX['& td'], fontWeight: hasChildren ? 700 : 400 },
                        }}
                        onClick={() => hasChildren && handleToggleRow(index)}
                      >
                        <TableCell>
                          {hasChildren && (
                            <span style={{ marginRight: '8px', display: 'inline-flex', verticalAlign: 'middle' }}>
                              {expandedRows[index] ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                            </span>
                          )}
                          {row.name}
                        </TableCell>
                        {allColumns.filter(col => visibleColumns[col.key]).map(column => (
                          <TableCell key={column.key} align="right">
                            {column.key.includes('value') || column.key.includes('Cost')
                              ? formatCurrency(row[column.key])
                              : (row[column.key] || 0)}
                          </TableCell>
                        ))}
                      </TableRow>

                      {row.children && Array.isArray(row.children) && expandedRows[index] &&
                        row.children.map((child, childIndex) => (
                          <TableRow
                            key={`${index}-child-${childIndex}`}
                            sx={{
                              ...TABLE_ROW_SX,
                              bgcolor: childIndex % 2 === 0 ? '#fff' : '#f8f8f8',
                              '& td:first-of-type': { paddingLeft: '34px' },
                            }}
                          >
                            <TableCell>{child.name}</TableCell>
                            {allColumns.filter(col => visibleColumns[col.key]).map(column => (
                              <TableCell key={column.key} align="right">
                                {column.key.includes('value') || column.key.includes('Cost')
                                  ? formatCurrency(child[column.key])
                                  : (child[column.key] || 0)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                    </React.Fragment>
                    );
                  })
                )}

                {/* Totals Row */}
                {reportData.length > 0 && (
                  <TableRow sx={TABLE_TOTAL_SX}>
                    <TableCell>Total</TableCell>
                    {allColumns.filter(col => visibleColumns[col.key]).map(column => (
                      <TableCell key={column.key} align="right">
                        {column.key.includes('value') || column.key.includes('Cost')
                          ? formatCurrency(totals[column.key])
                          : totals[column.key]}
                      </TableCell>
                    ))}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Export Dialog */}
      <Dialog 
        open={exportDialogOpen} 
        onClose={handleExportDialogClose}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
          }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: '#b3e5fc', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1.5,
          py: 2,
          px: 3,
        }}>
          <ExportIcon sx={{ color: '#0288d1', fontSize: 28 }} />
          <Typography variant="h6" sx={{ color: '#0288d1', fontWeight: 600 }}>
            Export Report
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ px: 3, py: 3 }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5, color: '#666', fontWeight: 500 }}>
              Export Type
            </Typography>
            <FormControl fullWidth>
              <Select
                value={exportType}
                onChange={(e) => setExportType(e.target.value)}
              >
                <MenuItem value="pdf">PDF</MenuItem>
                <MenuItem value="xlsx">XLSX</MenuItem>
                <MenuItem value="csv">CSV</MenuItem>
                <MenuItem value="json">JSON</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {exportType === 'pdf' && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.5, color: '#666', fontWeight: 500 }}>
                Orientation
              </Typography>
              <FormControl fullWidth>
                <Select
                  value={exportOrientation}
                  onChange={(e) => setExportOrientation(e.target.value)}
                >
                  <MenuItem value="portrait">Portrait</MenuItem>
                  <MenuItem value="landscape">Landscape</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleExportDialogClose} sx={{ color: '#666' }}>
            Cancel
          </Button>
          <Button 
            onClick={handleExportConfirm} 
            variant="contained"
            sx={{ 
              bgcolor: '#0288d1',
              '&:hover': { bgcolor: '#0277bd' }
            }}
          >
            Export
          </Button>
        </DialogActions>
      </Dialog>

      <SaveReportDialog
        open={saveDialogOpen}
        onClose={(saved) => {
          setSaveDialogOpen(false);
          if (saved) {
            // Optionally show a success message
          }
        }}
        reportType="inventory"
        reportPath="/reports/inventory"
        filters={{
          reportType,
          groupBy,
          searchTerm,
          includeDeleted,
          outletId: getOutletId(),
        }}
      />
    </Box>
  );
};

export default InventoryReport;

