import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Popover,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  FileDownload as ExportIcon,
  PrintOutlined as PrintIcon,
  SaveOutlined as SaveIcon,
  ViewColumn as ColumnsIcon,
  EditOutlined as EditIcon,
  CheckBoxOutlined as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  ArrowDropDown,
  ArrowDropUp,
  LayersOutlined as GroupsIcon,
  Cancel as CancelIcon,
  HelpOutline as HelpIcon,
  PictureAsPdf as PdfIcon,
  Description as CsvIcon,
  TableChart as XlsxIcon,
  Code as JsonIcon,
  Block as BlockIcon,
  RadioButtonUnchecked as ExistsIcon,
  DeleteOutline as DeleteOutlineIcon,
  QrCode as QrCodeIcon,
  StorefrontOutlined as StorefrontOutlinedIcon,
  LocalShippingOutlined as LocalShippingOutlinedIcon,
  FolderOutlined as FolderOutlinedIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalOutlet } from '../../components/Common/GlobalOutletFilter';
import { printReportTable, reportPrintTitle, reportPrintRange, optionLabel } from '../../utils/reportPrint';
import { chipsToParam, chipsFromParams } from '../../utils/reportChips';
import FavouriteRevisionsButton from '../../components/Reports/FavouriteRevisionsButton';
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
  '& input::placeholder, & textarea::placeholder': { color: '#808080', opacity: 1 },
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
    cursor: 'pointer',
  },
};

const TABLE_ROW_SX = {
  '& td': {
    color: '#000',
    fontWeight: 400,
    fontSize: 16,
    padding: '8px 8px 8px 10px',
    borderBottom: 'none',
    whiteSpace: 'nowrap',
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
    position: 'sticky',
    bottom: 0,
    backgroundColor: '#5ebbeb',
    zIndex: 1,
  },
  '& td:first-of-type': { zIndex: 3 },
};

// Reference odd-row stripe is a visible grey.
const ROW_ALT_BG = '#e8e8e8';

// Search suggestion rows (same as the Sales Report): type label + icon; a deleted item shows a bin.
const SUGGEST_LABELS = { product: 'Product', category: 'Category', brand: 'Brand', family: 'Family', tag: 'Tag', supplier: 'Supplier', outlet: 'Outlet' };
const SuggestIcon = ({ type, deleted }) => {
  const sx = { fontSize: 34, color: '#111' };
  if (deleted) return <DeleteOutlineIcon sx={sx} />;
  switch (type) {
    case 'product': return <QrCodeIcon sx={sx} />;
    case 'outlet': return <StorefrontOutlinedIcon sx={sx} />;
    case 'supplier': return <LocalShippingOutlinedIcon sx={sx} />;
    default: return <FolderOutlinedIcon sx={sx} />;
  }
};

// Reference header: ⇕ after every label; `active` = 'asc' | 'desc' fills the
// triangle of the current sort direction (same as SalesReport.jsx).
const SortIcon = ({ active }) => (
  <svg width="10" height="14" viewBox="0 0 10 14" style={{ marginLeft: 4, verticalAlign: 'middle', display: 'inline-block' }} aria-hidden="true">
    <path d="M1 5.5 L5 1.5 L9 5.5 Z" fill={active === 'asc' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active === 'asc' ? 1.6 : 1.1} strokeLinejoin="round" />
    <path d="M1 8.5 L5 12.5 L9 8.5 Z" fill={active === 'desc' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active === 'desc' ? 1.6 : 1.1} strokeLinejoin="round" />
  </svg>
);

// Reference Columns picker (31 columns, in the reference order). `kind` drives the
// cell format and the totals row: level/value columns add up, costs and
// attributes stay blank, Value % totals 100%.
const ALL_COLUMNS = [
  { key: 'productId', label: 'Product ID', kind: 'text', sql: 'id AS "Product ID"' },
  { key: 'status', label: 'Status', kind: 'text', sql: 'status AS "Status"' },
  { key: 'caseQuantity', label: 'Case Quantity', kind: 'int', noTotal: true, sql: 'case_quantity AS "Case Quantity"' },
  { key: 'outlet', label: 'Outlet', kind: 'text', sql: 'inventory.outlet AS "Outlet"' },
  { key: 'caseLevel', label: 'Case Level', kind: 'int', sql: 'inventory.case_level AS "Case Level"' },
  { key: 'itemLevel', label: 'Item Level', kind: 'int', sql: 'inventory.single_level AS "Item Level"' },
  { key: 'totalItems', label: 'Total Items', kind: 'int', sql: 'inventory.single_level + (inventory.case_level * case_quantity) AS "Total Items" TOTAL(SUM)' },
  { key: 'lastCaseCostEx', label: 'Last Case Cost (Ex)', kind: 'currency', noTotal: true, sql: 'costs.last_cost_ex AS "Last Case Cost (Ex)" TOTAL(NONE)' },
  { key: 'lastCaseCostEx', label: 'Last Case Cost (Global) (Ex)', kind: 'currency', noTotal: true, global: true, sql: 'costs.last_cost_ex AS "Last Case Cost (Global) (Ex)" TOTAL(NONE)' },
  { key: 'averageCaseCostEx', label: 'Average Case Cost (Ex)', kind: 'currency', noTotal: true, sql: 'costs.average_cost_ex AS "Average Case Cost (Ex)" TOTAL(NONE)' },
  { key: 'averageCaseCostEx', label: 'Average Case Cost (Global) (Ex)', kind: 'currency', noTotal: true, global: true, sql: 'costs.average_cost_ex AS "Average Case Cost (Global) (Ex)" TOTAL(NONE)' },
  { key: 'lastCaseCostInc', label: 'Last Case Cost (Inc)', kind: 'currency', noTotal: true, sql: 'costs.last_cost AS "Last Case Cost (Inc)" TOTAL(NONE)' },
  { key: 'lastCaseCostInc', label: 'Last Case Cost (Global)', kind: 'currency', noTotal: true, global: true, sql: 'last_cost AS "Last Case Cost (Global)" TOTAL(NONE)' },
  { key: 'averageCaseCostInc', label: 'Average Case Cost (Inc)', kind: 'currency', noTotal: true, sql: 'costs.average_cost AS "Average Case Cost (Inc)" TOTAL(NONE)' },
  { key: 'averageCaseCostInc', label: 'Average Case Cost (Global)', kind: 'currency', noTotal: true, global: true, sql: 'average_cost AS "Average Case Cost (Global)" TOTAL(NONE)' },
  { key: 'valueExcLast', label: 'Value (Ex) (Last)', kind: 'currency', sql: 'FORMAT(costs.last_cost_ex * (inventory.case_level + (inventory.single_level / case_quantity)), \'$\', \'\', 2) AS "Value (Ex) (Last)" TOTAL(SUM)' },
  { key: 'valueExcLast', label: 'Value (Global) (Ex) (Last)', kind: 'currency', global: true, sql: 'FORMAT(costs.last_cost_ex * (inventory.case_level + (inventory.single_level / case_quantity)), \'$\', \'\', 2) AS "Value (Global) (Ex) (Last)" TOTAL(SUM)' },
  { key: 'valueIncLast', label: 'Value (Inc) (Last)', kind: 'currency', sql: 'FORMAT(costs.last_cost * (inventory.case_level + (inventory.single_level / case_quantity)), \'$\', \'\', 2) AS "Value (Inc) (Last)" TOTAL(SUM)' },
  { key: 'valueIncLast', label: 'Value (Global) (Inc) (Last)', kind: 'currency', global: true, sql: 'FORMAT(costs.last_cost * (inventory.case_level + (inventory.single_level / case_quantity)), \'$\', \'\', 2) AS "Value (Global) (Inc) (Last)" TOTAL(SUM)' },
  { key: 'valueExcAverage', label: 'Value (Ex) (Average)', kind: 'currency', sql: 'FORMAT(costs.average_cost_ex * (inventory.case_level + (inventory.single_level / case_quantity)), \'$\', \'\', 2) AS "Value (Ex) (Average)" TOTAL(SUM)' },
  { key: 'valueExcAverage', label: 'Value (Global) (Ex) (Average)', kind: 'currency', global: true, sql: 'FORMAT(costs.average_cost_ex * (inventory.case_level + (inventory.single_level / case_quantity)), \'$\', \'\', 2) AS "Value (Global) (Ex) (Average)" TOTAL(SUM)' },
  { key: 'valueIncAverage', label: 'Value (Inc) (Average)', kind: 'currency', sql: 'FORMAT(costs.average_cost * (inventory.case_level + (inventory.single_level / case_quantity)), \'$\', \'\', 2) AS "Value (Inc) (Average)" TOTAL(SUM)' },
  { key: 'valueIncAverage', label: 'Value (Global) (Inc) (Average)', kind: 'currency', global: true, sql: 'FORMAT(costs.average_cost * (inventory.case_level + (inventory.single_level / case_quantity)), \'$\', \'\', 2) AS "Value (Global) (Inc) (Average)" TOTAL(SUM)' },
  { key: 'valuePctExLast', label: 'Value % (Ex) (Last)', kind: 'percent', sql: 'FORMAT(costs.last_cost_ex * (inventory.case_level + (inventory.single_level / case_quantity)), \'\', \'%\', 2) AS "Value % (Ex) (Last)" TOTAL(PERCENTAGE_FROM_TOTAL)' },
  { key: 'valuePctExLast', label: 'Value % (Global) (Ex) (Last)', kind: 'percent', global: true, sql: 'FORMAT(costs.last_cost_ex * (inventory.case_level + (inventory.single_level / case_quantity)), \'\', \'%\', 2) AS "Value % (Global) (Ex) (Last)" TOTAL(PERCENTAGE_FROM_TOTAL)' },
  { key: 'valuePctIncLast', label: 'Value % (Inc) (Last)', kind: 'percent', sql: 'FORMAT(costs.last_cost * (inventory.case_level + (inventory.single_level / case_quantity)), \'\', \'%\', 2) AS "Value % (Inc) (Last)" TOTAL(PERCENTAGE_FROM_TOTAL)' },
  { key: 'valuePctIncLast', label: 'Value % (Global) (Inc) (Last)', kind: 'percent', global: true, sql: 'FORMAT(costs.last_cost * (inventory.case_level + (inventory.single_level / case_quantity)), \'\', \'%\', 2) AS "Value % (Global) (Inc) (Last)" TOTAL(PERCENTAGE_FROM_TOTAL)' },
  { key: 'valuePctExAverage', label: 'Value % (Ex) (Average)', kind: 'percent', sql: 'FORMAT(costs.average_cost_ex * (inventory.case_level + (inventory.single_level / case_quantity)), \'\', \'%\', 2) AS "Value % (Ex) (Average)" TOTAL(PERCENTAGE_FROM_TOTAL)' },
  { key: 'valuePctExAverage', label: 'Value % (Global) (Ex) (Average)', kind: 'percent', global: true, sql: 'FORMAT(costs.average_cost_ex * (inventory.case_level + (inventory.single_level / case_quantity)), \'\', \'%\', 2) AS "Value % (Global) (Ex) (Average)" TOTAL(PERCENTAGE_FROM_TOTAL)' },
  { key: 'valuePctIncAverage', label: 'Value % (Inc) (Average)', kind: 'percent', sql: 'FORMAT(costs.average_cost * (inventory.case_level + (inventory.single_level / case_quantity)), \'\', \'%\', 2) AS "Value % (Inc) (Average)" TOTAL(PERCENTAGE_FROM_TOTAL)' },
  { key: 'valuePctIncAverage', label: 'Value % (Global) (Inc) (Average)', kind: 'percent', global: true, sql: 'FORMAT(costs.average_cost * (inventory.case_level + (inventory.single_level / case_quantity)), \'\', \'%\', 2) AS "Value % (Global) (Inc) (Average)" TOTAL(PERCENTAGE_FROM_TOTAL)' },
].map((c) => ({ ...c, id: c.label, headerLabel: c.label.toUpperCase() }));
// "Global" columns are the store-wide cost of the reference; we hold one cost per
// product, so they would repeat their outlet twin — hidden from the picker
// (user decision 22/10/2026). Flip SHOW_GLOBAL_COLUMNS to bring them back.
const SHOW_GLOBAL_COLUMNS = false;
const PICKER_COLUMNS = ALL_COLUMNS.filter((c) => SHOW_GLOBAL_COLUMNS || !c.global);

// Reference default picks.
const DEFAULT_VISIBLE = ['Case Quantity', 'Outlet', 'Case Level', 'Item Level', 'Last Case Cost (Inc)', 'Average Case Cost (Inc)', 'Value (Inc) (Average)'];

const fmtNumber = (n, d) => Number(n || 0).toLocaleString('en-AU', { minimumFractionDigits: d, maximumFractionDigits: d });
// Reference cells: 5,456 · $599,471.47 · -$298.80 · 12.34%
const formatCell = (value, col) => {
  if (value === '' || value === null || value === undefined) return '';
  if (col.kind === 'text') return String(value);
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  const sign = n < 0 ? '-' : '';
  if (col.kind === 'currency') return `${sign}$${fmtNumber(Math.abs(n), 2)}`;
  if (col.kind === 'percent') return `${fmtNumber(n, 2)}%`;
  return `${sign}${fmtNumber(Math.abs(n), Number.isInteger(n) ? 0 : 2)}`;
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
const ShopfrontFilter = ({ label, value, groups, onChange, renderValue, basis = '50%' }) => {
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
    <Box sx={{ position: 'relative', flex: `0 1 ${basis}`, minWidth: 240 }} ref={ref}>
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
            // panel sits inside the trigger block's 1px border (same as SalesReport.jsx)
            left: '1px',
            width: 'calc(100% - 2px)',
            zIndex: 8,
            boxSizing: 'border-box',
            bgcolor: '#f8f8f8',
            borderRadius: 0,
            boxShadow: 'none',
            p: '11px 16px',
          }}
        >
          {groups.map((group, gi) => (
            <Box key={group.label || `g${gi}`}>
              {group.label && (
                <Box sx={{ fontWeight: 700, fontSize: '19.2px', color: '#313439', mb: '8px' }}>
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
                      p: '3px 4px',
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

// Reference "Consolidate By Report Type": Yes = one row per product name,
// No = every product with its outlet (product × outlet rows).
const CONSOLIDATE_GROUPS = [
  {
    items: [
      { value: 'consolidated', label: 'Consolidated' },
      { value: 'detailed', label: 'Unconsolidated' },
    ],
  },
];

const InventoryReport = () => {
  const [searchParams] = useSearchParams();
  const { getOutletId } = useAuth();
  // All Outlets (no header outlet / register): Outlet filter. 'all' = every outlet.
  // Declared here, before the effects below read it (a later declaration blanked
  // the page on 15/10 - temporal dead zone).
  const { globalMode, outlets: allOutlets } = useGlobalOutlet();
  const [outletFilterId, setOutletFilterId] = useState('all');
  useEffect(() => { if (!globalMode) setOutletFilterId('all'); }, [globalMode]);
  const outletGroups = [{ items: [{ value: 'all', label: 'All Outlets' }, ...allOutlets.map((o) => ({ value: String(o.id), label: o.name }))] }];
  const reportOutletId = () => (globalMode && outletFilterId !== 'all' ? outletFilterId : getOutletId());
  
  const getInitialState = () => {
    const savedReportType = searchParams.get('reportType');
    const savedGroupBy = searchParams.get('groupBy');
    const savedSearchTerm = searchParams.get('searchTerm');
    const savedIncludeDeleted = searchParams.get('includeDeleted');
    const savedConsolidate = searchParams.get('consolidate');

    return {
      // Reference opens on Inventory On Hand · Group By Outlet · Consolidate No.
      reportType: savedReportType || 'inventory_on_hand',
      groupBy: savedGroupBy || 'outlet',
      searchTerm: savedSearchTerm !== null ? savedSearchTerm : '',
      includeDeleted: savedIncludeDeleted === 'true' || false,
      consolidate: savedConsolidate === 'consolidated' ? 'consolidated' : 'detailed',
    };
  };

  const initialState = getInitialState();

  // Filter states
  const [reportType, setReportType] = useState(initialState.reportType);
  const [groupBy, setGroupBy] = useState(initialState.groupBy);
  const [consolidate, setConsolidate] = useState(initialState.consolidate);
  const [searchTerm, setSearchTerm] = useState(initialState.searchTerm);
  const [includeDeleted, setIncludeDeleted] = useState(initialState.includeDeleted);

  // Data states
  const [reportData, setReportData] = useState([]);
  const [apiTotals, setApiTotals] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [collapsed, setCollapsed] = useState({}); // group name → children hidden
  const [sortConfig, setSortConfig] = useState(null);

  // Column visibility (by picker label; two picker entries may read one engine field)
  const [visibleColumns, setVisibleColumns] = useState(() => Object.fromEntries(ALL_COLUMNS.map((c) => [c.id, DEFAULT_VISIBLE.includes(c.id)])));

  // UI states
  const [columnsAnchorEl, setColumnsAnchorEl] = useState(null);
  const [columnsChipsExpanded, setColumnsChipsExpanded] = useState(false);
  // Reference: typing in the picker's chip bar filters the column list.
  const [columnsSearch, setColumnsSearch] = useState('');
  const matchesSearch = (c) => !columnsSearch.trim() || c.label.toLowerCase().includes(columnsSearch.trim().toLowerCase());
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportType, setExportType] = useState('pdf');
  const [exportOrientation, setExportOrientation] = useState('portrait');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  // Query preview (edited on the query editor page)
  const [customQuery, setCustomQuery] = useState('');

  // Search-bar suggestions + Included chips (reference, same as the Sales Report).
  const [suggestions, setSuggestions] = useState([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [chips, setChips] = useState(() => chipsFromParams(searchParams));
  const suggestBoxRef = useRef(null);
  useEffect(() => {
    const term = searchTerm.trim();
    if (!term) { setSuggestions([]); return undefined; }
    let cancelled = false;
    setSuggestLoading(true);
    const timer = setTimeout(async () => {
      try {
        const rows = await inventoryReportService.getSearchSuggestions(term, includeDeleted);
        if (!cancelled) setSuggestions(rows);
      } catch { if (!cancelled) setSuggestions([]); }
      finally { if (!cancelled) setSuggestLoading(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchTerm, includeDeleted]);
  useEffect(() => {
    if (!suggestOpen) return undefined;
    const onDown = (e) => { if (suggestBoxRef.current && !suggestBoxRef.current.contains(e.target)) setSuggestOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [suggestOpen]);
  const addChip = (s) => {
    setChips((prev) => (prev.some((c) => c.type === s.type && c.id === s.id) ? prev : [...prev, { type: s.type, id: s.id, name: s.name, deleted: !!s.deleted, mode: 'include' }]));
    setSearchTerm('');
    setSuggestions([]);
    setSuggestOpen(false);
  };
  const toggleChip = (chip) => setChips((prev) => prev.map((c) => (c.type === chip.type && c.id === chip.id ? { ...c, mode: c.mode === 'off' ? 'include' : 'off' } : c)));
  const removeChip = (chip) => setChips((prev) => prev.filter((c) => !(c.type === chip.type && c.id === chip.id)));

  // Consolidate = Yes (reference): the Outlet column drops and the outlet cost
  // columns read as their store-wide "(Global)" twins.
  const allColumns = PICKER_COLUMNS;
  const GLOBAL_TWIN = { 'Last Case Cost (Inc)': 'Last Case Cost (Global)', 'Average Case Cost (Inc)': 'Average Case Cost (Global)', 'Last Case Cost (Ex)': 'Last Case Cost (Global) (Ex)', 'Average Case Cost (Ex)': 'Average Case Cost (Global) (Ex)' };
  const shownColumns = (() => {
    if (consolidate !== 'consolidated') return allColumns.filter((col) => visibleColumns[col.id]);
    const wanted = new Set(Object.keys(visibleColumns).filter((id) => visibleColumns[id]).map((id) => (SHOW_GLOBAL_COLUMNS && GLOBAL_TWIN[id]) || id));
    wanted.delete('Outlet');
    return allColumns.filter((col) => wanted.has(col.id));
  })();

  useEffect(() => {
    // Ensure we load data on mount, especially when URL params are present
    loadReportData();
  }, [reportType, groupBy, consolidate, includeDeleted, outletFilterId, chips]);
  
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
    setLoadError('');
    try {
      const filters = {
        reportType,
        groupBy,
        consolidate,
        searchTerm,
        includeDeleted,
        outletId: reportOutletId(),
        // Included chips (OFF chips stay on screen but do not filter)
        ...(chips.some((c) => c.mode !== 'off') ? { filters: JSON.stringify(chips.filter((c) => c.mode !== 'off').map(({ type, id, mode }) => ({ type, id, mode }))) } : {}),
      };

      const response = await inventoryReportService.getInventoryReport(filters);

      if (response.success) {
        setReportData(response.data || []);
        setApiTotals(response.totals || {});
        setCollapsed({});
      } else {
        console.error('Failed to load inventory report');
        setReportData([]);
        setLoadError('We encountered an error with that report type, check your filters and report type to make sure they aren\'t contradictory.');
      }
    } catch (error) {
      console.error('Error loading inventory report:', error);
      setReportData([]);
      setLoadError(!error?.response
        ? 'Unable to load the report — you appear to be offline. Check your connection and try again.'
        : 'We encountered an error with that report type, check your filters and report type to make sure they aren\'t contradictory.');
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

  // Reference groups: header row (name), children, then the group's "Totals" row.
  const flattenReportData = () => {
    const flattened = [];
    sortedRows.forEach(row => {
      if (row.children && Array.isArray(row.children)) {
        flattened.push({ ...row, isParent: true });
        row.children.forEach(child => flattened.push({ ...child, isChild: !child.isTotalRow }));
      } else {
        flattened.push(row);
      }
    });
    return flattened;
  };
  const cellText = (row, col) => {
    if (row.isParent) return '';
    if (row.isTotalRow && (col.noTotal || col.kind === 'text')) return '';
    return formatCell(row[col.key], col);
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

    const headers = ['Name', ...shownColumns.map(col => col.headerLabel)];
    const flatData = flattenReportData();
    const body = flatData.map(row => [row.isChild ? `  ${row.name}` : row.name, ...shownColumns.map(col => cellText(row, col))]);
    body.push(['', ...shownColumns.map(col => totalText(col))]);

    autoTable(doc, {
      head: [headers],
      body,
      startY: 40,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [94, 187, 235] },
      didParseCell: (data) => { if (data.section === 'body' && data.row.index === body.length - 1) { data.cell.styles.fillColor = [94, 187, 235]; data.cell.styles.textColor = [248, 248, 248]; data.cell.styles.fontStyle = 'bold'; } },
    });

    doc.save('inventory-report.pdf');
  };

  const exportToExcel = () => {
    const flatData = flattenReportData();
    const worksheetData = flatData.map(row => {
      const rowData = { Name: row.name };
      shownColumns.forEach(col => {
        const v = row[col.key];
        rowData[col.headerLabel] = row.isParent || (row.isTotalRow && (col.noTotal || col.kind === 'text')) ? '' : (col.kind === 'text' ? (v ?? '') : Number(v || 0));
      });
      return rowData;
    });
    worksheetData.push({ Name: '', ...Object.fromEntries(shownColumns.map((col) => [col.headerLabel, totalText(col) === '' ? '' : Number(apiTotals[col.key] || (col.kind === 'percent' ? 100 : 0))])) });

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory Report');
    XLSX.writeFile(workbook, 'inventory-report.xlsx');
  };

  const exportToCSV = () => {
    const flatData = flattenReportData();
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = ['Name', ...shownColumns.map(col => col.headerLabel)];
    const csvContent = [
      headers.map(esc).join(','),
      ...flatData.map(row => [row.name, ...shownColumns.map(col => cellText(row, col))].map(esc).join(',')),
      ['', ...shownColumns.map(col => totalText(col))].map(esc).join(','),
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
    // Reference print: store name, "<Report Type> by <Group By>", black-rule table (inventory is "as of now" — no range line).
    const typeLabel = optionLabel(REPORT_TYPE_GROUPS, reportType);
    const byLabel = groupBy && groupBy !== 'none' ? optionLabel(GROUP_BY_GROUPS, groupBy) : 'Products';
    printReportTable({
      title: reportPrintTitle(allOutlets, globalMode, getOutletId()),
      subtitle: `${typeLabel} by ${byLabel}`,
      range: reportPrintRange({ preset: 'today' }),
      headers: [{ label: 'Name', align: 'left' }, ...shownColumns.map((col) => ({ label: col.label || col.headerLabel, align: 'center' }))],
      rows: flattenReportData().map((row) => ({ cells: [row.name, ...shownColumns.map((col) => cellText(row, col))], indent: !!row.isChild, bold: !!(row.isParent || row.isTotalRow) })),
      totals: reportData.length > 0 ? ['', ...shownColumns.map((col) => totalText(col))] : null,
    });
  };

  const toggleGroup = (name) => setCollapsed((prev) => ({ ...prev, [name]: !prev[name] }));
  // Reference "Groups" button: collapse every group / expand them all again.
  const toggleAllGroups = () => {
    const groups = reportData.filter((r) => Array.isArray(r.children));
    const allCollapsed = groups.length > 0 && groups.every((g) => collapsed[g.name]);
    setCollapsed(allCollapsed ? {} : Object.fromEntries(groups.map((g) => [g.name, true])));
  };

  // Header click: sort rows (children inside their group, groups by name).
  const handleSort = (key) => {
    setSortConfig((prev) => (prev && prev.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }));
  };
  const sortedRows = useMemo(() => {
    if (!sortConfig) return reportData;
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    const cmp = (a, b) => {
      const av = a[sortConfig.key]; const bv = b[sortConfig.key];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av ?? '').localeCompare(String(bv ?? ''), undefined, { sensitivity: 'base', numeric: true }) * dir;
    };
    return [...reportData].sort(cmp).map((row) => {
      if (!Array.isArray(row.children)) return row;
      const kids = row.children.filter((c) => !c.isTotalRow).sort(cmp);
      const total = row.children.find((c) => c.isTotalRow);
      return { ...row, children: total ? [...kids, total] : kids };
    });
  }, [reportData, sortConfig]);

  // Generate the Reporting Query Language preview from the current filters + visible columns
  const generateSQLQuery = () => {
    const projections = [
      'BY_NAME AS "Name"',
      ...shownColumns.map(col => col.sql),
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
      query += `  AND BY_NAME LIKE '%${searchTerm.replace(/'/g, "''")}%'\n`;
    }

    query += 'ORDER "Name" asc\n';
    query += consolidate === 'consolidated' ? 'CONSOLIDATED' : 'UNCONSOLIDATED';

    return query;
  };

  // Keep the query preview in sync with the filters and visible columns.
  useEffect(() => {
    setCustomQuery(generateSQLQuery());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, groupBy, consolidate, searchTerm, includeDeleted, visibleColumns]);

  const handleColumnToggle = (columnId) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnId]: !prev[columnId]
    }));
  };

  // Grand total (reference): levels and values add up, Value % = 100%, costs and
  // attributes (Case Quantity, Outlet, Product ID, Status) stay blank.
  const totalText = (col) => {
    if (col.noTotal || col.kind === 'text') return '';
    if (col.kind === 'percent') return reportData.length ? '100.00%' : '';
    return formatCell(apiTotals[col.key] ?? 0, col);
  };
  const hasGroups = reportData.some((r) => Array.isArray(r.children));

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
            overflow: 'hidden',
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
          component={RouterLink} to={'/reports/inventory/query'} state={{ query: customQuery }}
          sx={{
            ml: 2,
            minWidth: 88,
            color: '#00a63e',
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

      {/* Filters — flush 80px slate blocks (Report Type / Group By / Consolidate), inline dropdowns */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', mb: '8px' }}>
        {globalMode && (
          <ShopfrontFilter
            label="Outlet"
            value={outletFilterId}
            groups={outletGroups}
            onChange={setOutletFilterId}
            basis="25%"
          />
        )}
        <ShopfrontFilter
          label="Report Type"
          value={reportType}
          groups={REPORT_TYPE_GROUPS}
          onChange={setReportType}
          basis={globalMode ? '25%' : '33.3333%'}
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
          basis={globalMode ? '25%' : '33.3333%'}
        />
        <ShopfrontFilter
          label="Consolidate By Report Type"
          value={consolidate}
          groups={CONSOLIDATE_GROUPS}
          onChange={setConsolidate}
          basis={globalMode ? '25%' : '33.3333%'}
          renderValue={(value) => (value === 'consolidated' ? 'Yes' : 'No')}
        />
      </Box>

      {/* Reference: search box with "Include Deleted" as a bordered cell on its right,
          then Export / Print / Save on the left, Groups (grouped) + Columns on the right. */}
      {/* Same chrome as the Sales Report page: rounded search field with Include
          Deleted to its right (user 21/10), buttons row below. */}
      <Paper elevation={0} sx={{ p: 2, mb: '8px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 2 }}>
          {/* Reference search: typing lists Product / Brand / Category… suggestions
              (Active / Deleted); a pick becomes an Included chip under the box. */}
          <Box sx={{ position: 'relative', flex: 1 }} ref={suggestBoxRef}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search for anything"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setSuggestOpen(true); }}
              onFocus={() => setSuggestOpen(true)}
              sx={FIELD_SX}
              InputProps={{
                endAdornment: searchTerm ? <CancelIcon onClick={() => { setSearchTerm(''); setSuggestions([]); }} sx={{ cursor: 'pointer', color: '#333', fontSize: 22 }} /> : null,
              }}
            />
            {suggestOpen && (
              <Paper elevation={4} sx={{ position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 20, maxHeight: 520, overflowY: 'auto', borderRadius: 0, bgcolor: '#f8f8f8' }}>
                {!searchTerm.trim() ? (
                  <Box sx={{ px: 2, py: 1.5, fontSize: 22 }}>Start typing to search...</Box>
                ) : suggestLoading ? (
                  <Box sx={{ px: 2, py: 1.5, fontSize: 18, color: '#666' }}>Searching...</Box>
                ) : suggestions.length === 0 ? (
                  <Box sx={{ px: 2, py: 1.5, fontSize: 22 }}>No search results found.</Box>
                ) : (
                  suggestions.map((s, i) => (
                    <Box
                      key={`${s.type}-${s.id}`}
                      onClick={() => addChip(s)}
                      sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 1.5, py: 1, cursor: 'pointer', bgcolor: i % 2 ? '#e8e8e8' : '#f8f8f8', '&:hover': { bgcolor: '#5ebbeb', color: '#fff' } }}
                    >
                      <SuggestIcon type={s.type} deleted={s.deleted} />
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ fontSize: 15, lineHeight: 1.2 }}>{SUGGEST_LABELS[s.type] || s.type}</Box>
                        <Box sx={{ fontSize: 22, lineHeight: 1.2 }}>{s.name}</Box>
                      </Box>
                      {s.type === 'product' && <Box sx={{ fontSize: 16 }}>{s.deleted ? 'Deleted' : 'Active'}</Box>}
                    </Box>
                  ))
                )}
              </Paper>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            <Typography sx={{ fontSize: 16, whiteSpace: 'nowrap' }}>Include Deleted</Typography>
            <ShopfrontSwitch checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} />
          </Box>
        </Box>
        {chips.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
            {chips.map((c) => (
              <Box key={`${c.type}-${c.id}`} sx={{ display: 'flex', alignItems: 'stretch', border: '1px solid #404040', bgcolor: '#fff' }}>
                {/* Reference: clicking the chip's icon (bin for a deleted item) removes the chip. */}
                <Box onClick={() => removeChip(c)} sx={{ display: 'flex', alignItems: 'center', px: 1.5, borderRight: '1px solid #404040', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' } }}>
                  <DeleteOutlineIcon sx={{ fontSize: 34, color: '#111' }} />
                </Box>
                {/* Reference chip: type (+ ⊘ "This item no longer exists in your store" for a deleted
                    item), the name, then an "Included" switch — OFF stops the chip filtering.
                    Double-click the name to drop the chip. */}
                <Box sx={{ px: 1.5, py: 0.75 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 16, lineHeight: 1.2 }}>
                    {SUGGEST_LABELS[c.type] || c.type}
                    {c.deleted ? (
                      <Tooltip title="This item no longer exists in your store" arrow placement="top">
                        <BlockIcon sx={{ fontSize: 18, color: '#333' }} />
                      </Tooltip>
                    ) : (
                      <Tooltip title="This item exists in your store" arrow placement="top">
                        <ExistsIcon sx={{ fontSize: 18, color: '#333' }} />
                      </Tooltip>
                    )}
                  </Box>
                  <Box sx={{ fontSize: 20, lineHeight: 1.3, cursor: 'default' }} onDoubleClick={() => removeChip(c)}>{c.name}</Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <ShopfrontSwitch checked={c.mode !== 'off'} onChange={() => toggleChip(c)} />
                    <Box sx={{ fontSize: 16 }}>Included</Box>
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        )}
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
          <FavouriteRevisionsButton sx={SKY_BUTTON_SX} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {hasGroups && (
            <Button variant="outlined" startIcon={<GroupsIcon />} onClick={toggleAllGroups} sx={SKY_BUTTON_SX}>
              Groups
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<ColumnsIcon />}
            onClick={(e) => setColumnsAnchorEl(e.currentTarget)}
            sx={SKY_BUTTON_SX}
          >
            Columns
          </Button>
        </Box>
      </Box>
      </Paper>

      {/* Columns picker (reference): selected chips + "N More..." on top, a scrolling
          checkbox list below; a selected row reads sky-blue, the hovered one sits on sky. */}
      <Popover
        anchorEl={columnsAnchorEl}
        open={Boolean(columnsAnchorEl)}
        onClose={() => { setColumnsAnchorEl(null); setColumnsChipsExpanded(false); setColumnsSearch(''); }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 544, mt: '6px', p: '16px', borderRadius: '8px', border: '1px solid #404040', boxShadow: '0 6px 18px rgba(0,0,0,0.18)' } }}
      >
        {(() => {
          const selected = allColumns.filter(c => visibleColumns[c.id]);
          const shown = columnsChipsExpanded ? selected : selected.slice(0, 2);
          const remaining = selected.length - shown.length;
          return (
            <Box onClick={() => setColumnsChipsExpanded((v) => !v)} sx={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', border: '1px solid #404040', borderRadius: '8px', px: '12px', py: '8px', mb: '12px', cursor: 'pointer', minHeight: 44 }}>
              {shown.map(c => (
                <Box key={c.id} sx={{ bgcolor: '#e8e8e8', borderRadius: '4px', px: '8px', py: '2px', fontSize: 16, color: '#313439' }}>{c.label}</Box>
              ))}
              {remaining > 0 && <Box sx={{ bgcolor: '#e8e8e8', borderRadius: '4px', px: '8px', py: '2px', fontSize: 16, color: '#313439' }}>{remaining} More...</Box>}
              <Box component="input" value={columnsSearch} onClick={(e) => e.stopPropagation()} onChange={(e) => setColumnsSearch(e.target.value)} placeholder="" sx={{ flex: 1, minWidth: 60, border: 'none', outline: 'none', bgcolor: 'transparent', fontSize: 16, color: '#313439', fontFamily: 'inherit' }} />
              <Box sx={{ ml: 'auto', display: 'inline-flex', color: '#313439' }}>{columnsChipsExpanded ? <ArrowDropDown /> : <ArrowDropUp />}</Box>
            </Box>
          );
        })()}
        <Box sx={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #404040', borderRadius: '8px' }}>
          {allColumns.filter(matchesSearch).map((column) => {
            const checked = !!visibleColumns[column.id];
            return (
              <Box
                key={column.id}
                onClick={() => handleColumnToggle(column.id)}
                sx={{ display: 'flex', alignItems: 'center', gap: '10px', px: '16px', height: 56, cursor: 'pointer', fontSize: 16, color: checked ? '#0284c7' : '#313439', '&:hover': { bgcolor: '#5ebbeb', color: '#000' } }}
              >
                {checked ? <CheckBoxIcon sx={{ fontSize: 20 }} /> : <CheckBoxOutlineBlankIcon sx={{ fontSize: 20 }} />}
                {column.label}
              </Box>
            );
          })}
        </Box>
      </Popover>

      {/* Load failure (e.g. offline): reference shows a red bar instead of an
          empty "No data available" table, so an outage is not read as "no stock". */}
      {loadError && !loading && (
        <Box sx={{ bgcolor: 'rgb(227,52,47)', color: '#fff', px: 2, py: 1.5, fontSize: 15 }}>
          {loadError}
        </Box>
      )}

      {/* Data Table — loading spinner like the Sales Report (user 22/10: no overlay). */}
      <Paper elevation={0} sx={{ borderRadius: 0 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
            <CircularProgress />
          </Box>
        ) : (
          // Same as the Sales Report: the table scrolls inside the page (total row pinned
          // at the bottom, NAME column pinned on the left).
          <TableContainer sx={{ maxHeight: 'calc(100vh - 300px)', overflow: 'auto' }}>
            <Table size="small" stickyHeader sx={{ width: '100%', '& .MuiTableCell-stickyHeader': { backgroundColor: '#5ebbeb' }, '& th': { cursor: 'pointer', userSelect: 'none' }, '& td:first-of-type': { position: 'sticky', left: 0, zIndex: 1, bgcolor: 'inherit' } }}>
              <TableHead>
                <TableRow sx={TABLE_HEAD_SX}>
                  <TableCell onClick={() => handleSort('name')} sx={{ position: 'sticky', left: 0, zIndex: 3 }}>NAME<SortIcon active={sortConfig?.key === 'name' ? sortConfig.direction : null} /></TableCell>
                  {shownColumns.map(column => (
                    <TableCell key={column.id} align={column.kind === 'text' ? 'left' : 'center'} onClick={() => handleSort(column.key)}>
                      {column.headerLabel}<SortIcon active={sortConfig?.key === column.key ? sortConfig.direction : null} />
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {reportData.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={shownColumns.length + 1}
                      align="center"
                      sx={{ py: 5 }}
                    >
                      <Typography color="text.secondary">
                        {loadError ? 'Report could not be loaded' : 'No data available'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  (() => { let stripe = 0; return sortedRows.map((row, index) => {
                    const hasChildren = Array.isArray(row.children);
                    if (!hasChildren) {
                      const shade = stripe++ % 2 === 0 ? '#fff' : ROW_ALT_BG;
                      return (
                        <TableRow key={index} sx={{ ...TABLE_ROW_SX, bgcolor: shade }}>
                          <TableCell>{row.name}</TableCell>
                          {shownColumns.map(column => (
                            <TableCell key={column.id} align={column.kind === 'text' ? 'left' : 'center'}>{formatCell(row[column.key], column)}</TableCell>
                          ))}
                        </TableRow>
                      );
                    }
                    // Reference group: ▽ header (grey, click collapses), ├─ children, grey "Totals" row.
                    stripe = 0;
                    const open = !collapsed[row.name];
                    return (
                      <React.Fragment key={index}>
                        <TableRow sx={{ ...TABLE_ROW_SX, bgcolor: ROW_ALT_BG }}>
                          <TableCell colSpan={shownColumns.length + 1} onClick={() => toggleGroup(row.name)} sx={{ cursor: 'pointer', userSelect: 'none', py: '10px !important' }}>
                            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              {open ? <ExpandMoreIcon sx={{ fontSize: 16 }} /> : <ChevronRightIcon sx={{ fontSize: 16 }} />}
                              {row.name}
                            </Box>
                          </TableCell>
                        </TableRow>
                        {row.children.map((child, childIndex) => {
                          if (child.isTotalRow) {
                            return (
                              <TableRow key={`${index}-t`} sx={{ ...TABLE_ROW_SX, bgcolor: ROW_ALT_BG }}>
                                <TableCell sx={{ fontSize: '13px !important' }}>Totals</TableCell>
                                {shownColumns.map(column => (
                                  <TableCell key={column.id} align={column.kind === 'text' ? 'left' : 'center'}>{cellText(child, column)}</TableCell>
                                ))}
                              </TableRow>
                            );
                          }
                          if (!open) return null;
                          const shade = stripe++ % 2 === 0 ? '#fff' : ROW_ALT_BG;
                          return (
                            <TableRow key={`${index}-child-${childIndex}`} sx={{ ...TABLE_ROW_SX, bgcolor: shade }}>
                              <TableCell sx={{ pl: '14px !important' }}>
                                <Box sx={{ display: 'flex', alignItems: 'stretch', minHeight: 24 }}>
                                  <Box sx={{ width: 14, flexShrink: 0, borderLeft: '2px solid #000', position: 'relative', '&::after': { content: '""', position: 'absolute', top: '50%', left: 0, width: 10, borderTop: '2px solid #000' } }} />
                                  <Box sx={{ pl: '12px', display: 'flex', alignItems: 'center' }}>{child.name}</Box>
                                </Box>
                              </TableCell>
                              {shownColumns.map(column => (
                                <TableCell key={column.id} align={column.kind === 'text' ? 'left' : 'center'}>{formatCell(child[column.key], column)}</TableCell>
                              ))}
                            </TableRow>
                          );
                        })}
                      </React.Fragment>
                    );
                  }); })()
                )}

                {/* Grand total (reference): Name / Case Quantity / Outlet / costs blank */}
                {reportData.length > 0 && (
                  <TableRow sx={TABLE_TOTAL_SX}>
                    <TableCell></TableCell>
                    {shownColumns.map(column => (
                      <TableCell key={column.id} align={column.kind === 'text' ? 'left' : 'center'}>{totalText(column)}</TableCell>
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
        {/* Same dialog as the Sales Report page. */}
        <DialogTitle sx={{ bgcolor: '#b3e5fc', display: 'flex', alignItems: 'center', gap: 1.5, py: 2, px: 3, borderBottom: '1px solid #e0e0e0' }}>
          <HelpIcon sx={{ color: '#0288d1', fontSize: 28 }} />
          <Typography variant="h6" component="span" sx={{ color: '#0288d1', fontWeight: 600, fontSize: '1.25rem' }}>
            Export Report
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ px: 3, py: 3 }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5, color: '#666', fontSize: '0.9rem', fontWeight: 500 }}>
              Export Type
            </Typography>
            <FormControl fullWidth>
              <Select
                value={exportType}
                onChange={(e) => setExportType(e.target.value)}
                displayEmpty
                sx={{ bgcolor: 'white', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#ddd' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#bbb' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#0288d1' } }}
                renderValue={(value) => {
                  const icons = { pdf: <PdfIcon sx={{ mr: 1.5, color: '#d32f2f' }} />, xlsx: <XlsxIcon sx={{ mr: 1.5, color: '#2e7d32' }} />, csv: <CsvIcon sx={{ mr: 1.5, color: '#ed6c02' }} />, json: <JsonIcon sx={{ mr: 1.5, color: '#0288d1' }} /> };
                  const labels = { pdf: 'PDF', xlsx: 'XLSX', csv: 'CSV', json: 'JSON' };
                  return <Box sx={{ display: 'flex', alignItems: 'center' }}>{icons[value]}<span style={{ fontWeight: 500 }}>{labels[value]}</span></Box>;
                }}
              >
                <MenuItem value="pdf"><Box sx={{ display: 'flex', alignItems: 'center' }}><PdfIcon sx={{ mr: 1.5, color: '#d32f2f' }} /><span>PDF</span></Box></MenuItem>
                <MenuItem value="xlsx"><Box sx={{ display: 'flex', alignItems: 'center' }}><XlsxIcon sx={{ mr: 1.5, color: '#2e7d32' }} /><span>XLSX</span></Box></MenuItem>
                <MenuItem value="csv"><Box sx={{ display: 'flex', alignItems: 'center' }}><CsvIcon sx={{ mr: 1.5, color: '#ed6c02' }} /><span>CSV</span></Box></MenuItem>
                <MenuItem value="json"><Box sx={{ display: 'flex', alignItems: 'center' }}><JsonIcon sx={{ mr: 1.5, color: '#0288d1' }} /><span>JSON</span></Box></MenuItem>
              </Select>
            </FormControl>
          </Box>

          {exportType === 'pdf' && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.5, color: '#666', fontSize: '0.9rem', fontWeight: 500 }}>
                Orientation
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                {['portrait', 'landscape'].map((o) => {
                  const on = exportOrientation === o;
                  return (
                    <Button
                      key={o}
                      fullWidth
                      variant={on ? 'contained' : 'outlined'}
                      onClick={() => setExportOrientation(o)}
                      sx={{
                        py: 1.5, textTransform: 'uppercase', fontWeight: 600, fontSize: '0.875rem', letterSpacing: '0.5px',
                        ...(on
                          ? (o === 'portrait'
                            ? { bgcolor: 'white', color: '#333', border: '2px solid #0288d1', boxShadow: '0 2px 8px rgba(2, 136, 209, 0.15)', '&:hover': { bgcolor: '#f5f5f5', border: '2px solid #0277bd', boxShadow: '0 2px 12px rgba(2, 136, 209, 0.25)' } }
                            : { bgcolor: '#e0e0e0', color: '#333', border: '2px solid #9e9e9e', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)', '&:hover': { bgcolor: '#d5d5d5', border: '2px solid #757575', boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)' } })
                          : { bgcolor: 'white', color: '#666', border: '1px solid #ddd', '&:hover': { bgcolor: '#fafafa', border: '1px solid #bbb' } }),
                      }}
                    >
                      {o === 'portrait' ? 'Portrait' : 'Landscape'}
                    </Button>
                  );
                })}
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2.5, bgcolor: '#fafafa', borderTop: '1px solid #e0e0e0' }}>
          <Button onClick={handleExportDialogClose} variant="outlined" sx={{ minWidth: 100, py: 1, textTransform: 'none', fontSize: '0.95rem', fontWeight: 500, color: '#666', borderColor: '#ccc', '&:hover': { borderColor: '#999', bgcolor: '#f5f5f5' } }}>
            Cancel
          </Button>
          <Button onClick={handleExportConfirm} variant="contained" sx={{ minWidth: 100, py: 1, textTransform: 'none', fontSize: '0.95rem', fontWeight: 600, bgcolor: '#00bcd4', boxShadow: '0 2px 8px rgba(0, 188, 212, 0.3)', '&:hover': { bgcolor: '#00acc1', boxShadow: '0 4px 12px rgba(0, 188, 212, 0.4)' } }}>
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
        dynamicAllowed={false}
        defaultName={`Products by ${groupBy && groupBy !== 'none' ? optionLabel(GROUP_BY_GROUPS, groupBy) : 'Product'}`}
        filters={{
          reportType,
          groupBy,
          consolidate,
          searchTerm,
          chips: chipsToParam(chips),
          includeDeleted,
          outletId: reportOutletId(),
        }}
      />
    </Box>
  );
};

export default InventoryReport;

