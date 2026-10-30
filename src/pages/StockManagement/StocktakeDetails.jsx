import React, { useState, useEffect } from 'react';
import PageLoader from '../../components/Common/PageLoader';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import productService from '../../services/productService';
import { userService } from '../../services/userService';
import { searchProducts } from '../../utils/productSearch.js';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Grid,
  Avatar,
  AvatarGroup,
  Tooltip,
  InputAdornment,
  Popover,
} from '@mui/material';
import {
  Close,
  FilterAltOutlined,
  UnfoldMore,
  PictureAsPdfOutlined,
  DescriptionOutlined,
  OutputOutlined,
  AssignmentTurnedInOutlined,
  ChecklistOutlined,
  HighlightOffOutlined,
  AllInboxOutlined,
  BarChartOutlined,
  EditOutlined,
} from '@mui/icons-material';
import stocktakeService from '../../services/stocktakeService';

function timeAgo(dateString) {
  if (!dateString) return 'just now';
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = Math.max(0, now.getTime() - past.getTime());
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;
  const years = Math.floor(months / 12);
  // Reference: "a year ago", "7 years ago"
  return years === 1 ? 'a year ago' : `${years} years ago`;
}

// " zeroing other stock" / " ignoring other stock" (reference header wording)
function applyModeText(mode) {
  if (mode === 'zero') return ' zeroing other stock';
  if (mode === 'ignore') return ' ignoring other stock';
  return '';
}

// "-$120.00", never "$-120.00"
function money(value) {
  const n = Number(value) || 0;
  return `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`;
}

// Reference Cost column: the figure as stored, no padded zeros ("93", "107.34").
function plainNumber(value) {
  return String(Number((Number(value) || 0).toFixed(2)));
}

// Reference colours: green above zero, red below, black at zero - the $ cell
// follows its OWN value ($0.00 stays black beside a green quantity).
function signColor(value) {
  const n = Math.round((Number(value) || 0) * 100);
  if (n === 0) return '#000';
  return n > 0 ? '#22c55e' : '#ef4444';
}

function formatTimestamp(value) {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Reference: grey default person avatars (no initials), white ring.
const avatarSx = (size) => ({ width: size, height: size, bgcolor: '#bdbdbd', color: '#fff', border: '2px solid #fff' });

// Reference header buttons: rounded 8px, bold.
const headerBtn = {
  height: 42,
  px: 3,
  borderRadius: '8px',
  fontSize: 16,
  fontWeight: 700,
  textTransform: 'none',
  boxShadow: 'none',
  whiteSpace: 'nowrap',
};
const exportBtn = {
  ...headerBtn,
  bgcolor: '#dedede',
  color: '#555',
  border: '1px solid transparent',
  '&:hover': { bgcolor: '#d0d0d0', boxShadow: 'none' },
  // Statistics tab: outlined and inactive (reference)
  // pointerEvents back on so the hover shows the not-allowed cursor (the
  // native disabled attribute still blocks the click).
  '&.Mui-disabled': { bgcolor: '#e9e9e9', color: '#8a8a8a', border: '1px solid #676b72', pointerEvents: 'auto', cursor: 'not-allowed' },
};
const primaryBtn = {
  ...headerBtn,
  bgcolor: '#5ebbeb',
  color: '#fff',
  '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' },
};

const HEADER_BAND = '#e2e8f0';
const APP_BAR = 50; // fixed top bar - the sticky table header sits under it

const th = {
  backgroundColor: '#5ebbeb',
  color: '#fff',
  fontWeight: 700,
  fontSize: 16,
  textTransform: 'none',
  padding: '8px 16px',
  height: 51,
  borderBottom: 'none',
  whiteSpace: 'nowrap',
};

const pillHead = {
  '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
  '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' },
};

export default function StocktakeDetails() {
  const { id } = useParams();
  const [stocktake, setStocktake] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState('');
  // Reference: typing does not filter - the table follows the search only when
  // Filter (or Enter) is pressed. searchInput = the box, searchTerm = applied.
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [tab, setTab] = useState('scanned');
  const [sortBy, setSortBy] = useState('product');
  const [sortOrder, setSortOrder] = useState('asc');
  const [productCard, setProductCard] = useState(null); // { product, anchor }

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        const { stocktake } = await stocktakeService.getStocktake(id);
        if (!isMounted) return;
        setStocktake(stocktake);
        setError('');
        // Load statistics up-front so the header avatar group can show scanning users
        try {
          setStatsLoading(true);
          const { statistics: stats } = await stocktakeService.getStocktakeStatistics(id);
          if (isMounted) setStatistics(stats);
        } catch {
          // statistics are optional for the header
        } finally {
          if (isMounted) setStatsLoading(false);
        }
      } catch {
        if (isMounted) setError('Failed to load stocktake');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [id]);

  const [applying, setApplying] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false); // "Stocktake Export" popup (PDF / CSV)
  const [categoryNames, setCategoryNames] = useState({});
  const dialogs = useAppDialogs();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Category scope: chosen on the Finalise page (arrives in the URL right after
  // Complete) and remembered on the stocktake once it has been applied.
  const scopeFromUrl = searchParams.get('apply') === '1';
  const applyScope = scopeFromUrl
    ? {
        applyToAll: searchParams.get('applyToAll') === '1',
        categoryIds: (searchParams.get('categoryIds') || '').split(',').filter((s) => s !== '').map((s) => parseInt(s, 10)).filter(Number.isFinite),
      }
    : {
        applyToAll: Boolean(stocktake?.userStats?.applyToAll),
        categoryIds: Array.isArray(stocktake?.userStats?.categoryIds) ? stocktake.userStats.categoryIds : [],
      };
  // An External Stocktake has no category scope: it is Full only when it zeroes
  // other stock (reference: "Applied ignoring other stock ... Partial Stocktake").
  const isExternal = stocktake?.description === 'External Stocktake';
  const isFullStocktake = applyScope.applyToAll || (!isExternal && applyScope.categoryIds.length === 0);
  const scopeChips = isFullStocktake ? [] : applyScope.categoryIds.map((cid) => (cid === 0 ? 'Product without category' : (categoryNames[cid] || `Category ${cid}`)));

  // Category names for the header chips.
  useEffect(() => {
    productService.getCategories()
      .then((cats) => setCategoryNames(Object.fromEntries((cats || []).map((c) => [c.id, c.name]))))
      .catch(() => {});
  }, []);

  // Straight after Complete the reference lands here with the Apply popup open.
  useEffect(() => {
    if (scopeFromUrl && stocktake?.status === 'Completed') setApplyOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeFromUrl, stocktake?.status]);

  const applyHistory = statistics?.applyHistory || [];

  // Apply (Completed) opens the popup; Re-Apply (Applied) warns first
  // (reference: "This stocktake was applied 6 years ago, are you sure ...").
  const openApply = async () => {
    if (stocktake?.status === 'Applied') {
      const go = await dialogs.confirm(
        `This stocktake was applied ${timeAgo(stocktake.appliedAt || stocktake.completedAt)}, are you sure you wish to apply it again?`,
        { title: 'Re-Apply Stocktake', severity: 'warning', confirmText: 'Continue', cancelText: 'Cancel' }
      );
      if (!go) return;
    }
    setApplyOpen(true);
  };

  const doApply = async (mode) => {
    try {
      setApplying(true);
      await stocktakeService.applyStocktake(id, { mode, applyToAll: applyScope.applyToAll, categoryIds: applyScope.categoryIds });
      const { stocktake: fresh } = await stocktakeService.getStocktake(id);
      setStocktake(fresh);
      try {
        const { statistics: stats } = await stocktakeService.getStocktakeStatistics(id);
        setStatistics(stats);
      } catch { /* optional */ }
      setError('');
      setApplyOpen(false);
      if (scopeFromUrl) setSearchParams({}, { replace: true });
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to apply stocktake');
    } finally {
      setApplying(false);
    }
  };

  // Edit (Completed only): reopen the session for more counting.
  const reopenForEdit = async () => {
    try {
      await stocktakeService.updateStocktake(id, { status: 'In Progress' });
      navigate(`/stock-management/stocktakes/advanced?id=${id}`);
    } catch {
      setError('Failed to reopen stocktake');
    }
  };

  // withSearch=false: the tab's rows ignoring the search - the reference Total
  // stays the tab's total while a search narrows the table.
  const getFilteredItems = (withSearch = true) => {
    let filtered = stocktake?.items || [];

    if (withSearch && searchTerm) {
      filtered = searchProducts(filtered.map((item) => ({ ...item.product, stocktakeItem: item })), searchTerm)
        .map((product) => product.stocktakeItem);
    }
    if (tab !== 'all') {
      // "Scanned" = counted during the stocktake (barcode scan OR manual count).
      // Items the apply step added for uncounted products carry the NOT_SCANNED
      // marker (reference: the Not Scanned tab lists every product in scope).
      const counted = (i) => i.notes !== 'NOT_SCANNED' && ((i.scanCount > 0) || ((parseFloat(i.actualQuantity) || 0) > 0));
      filtered = filtered.filter(i => (tab === 'scanned' ? counted(i) : !counted(i)));
    }

    // While a search term is in play the default (name) order would undo the
    // best-match-first ranking searchProducts just applied; only an explicit
    // column sort re-orders then. Same behaviour as the sell screen's search.
    const keepRank = withSearch && Boolean(searchTerm) && !['expected', 'actual', 'difference'].includes(sortBy);
    if (keepRank) {
      if (sortOrder === 'desc') filtered = [...filtered].reverse();
    } else filtered.sort((a, b) => {
      const order = sortOrder === 'asc' ? 1 : -1;
      switch (sortBy) {
        case 'expected':
          return ((a.expectedQuantity ?? a.expected) - (b.expectedQuantity ?? b.expected)) * order;
        case 'actual':
          return ((a.actualQuantity ?? a.actual) - (b.actualQuantity ?? b.actual)) * order;
        case 'difference':
          return (((a.actualQuantity ?? a.actual) - (a.expectedQuantity ?? a.expected)) - ((b.actualQuantity ?? b.actual) - (b.expectedQuantity ?? b.expected))) * order;
        default:
          return (((a.product?.name || '') > (b.product?.name || '')) ? 1 : -1) * order;
      }
    });

    return filtered.map(i => ({
      id: i.id,
      productId: i.productId,
      // stocktakeCost: the unit cost frozen when the product entered the stocktake
      // (null on stocktakes made before it was recorded -> today's cost).
      product: { ...(i.product || { name: i.productName || 'Unknown', cost: 0, caseQuantity: 0 }), stocktakeCost: i.itemCost },
      expected: i.expectedQuantity ?? i.expected ?? 0,
      actual: i.actualQuantity ?? i.actual ?? 0,
      difference: (i.actualQuantity ?? i.actual ?? 0) - (i.expectedQuantity ?? i.expected ?? 0),
      valueDifference: ((i.actualQuantity ?? i.actual ?? 0) - (i.expectedQuantity ?? i.expected ?? 0)) * (i.product?.cost ?? 0),
    }));
  };

  const getItemCost = (product) => {
    // Reference: the review table uses the cost at stocktake time.
    if (product.stocktakeCost !== null && product.stocktakeCost !== undefined) {
      return Number(product.stocktakeCost);
    }
    // Use itemCost if available (this should always be present from backend)
    if (product.itemCost !== null && product.itemCost !== undefined) {
      return product.itemCost;
    }
    // Fallback: calculate from caseCost if itemCost is not available
    if (product.caseCost && product.caseCost > 0 && product.caseQuantity && product.caseQuantity > 0) {
      return product.caseCost / product.caseQuantity;
    }
    // If no cost data available, return 0
    return 0;
  };

  const stats = getFilteredItems(false).reduce((t, i) => {
    const itemCost = getItemCost(i.product);
    return {
      expectedQty: t.expectedQty + i.expected,
      expectedValue: t.expectedValue + i.expected * itemCost,
      actualQty: t.actualQty + i.actual,
      actualValue: t.actualValue + i.actual * itemCost,
      differenceQty: t.differenceQty + i.difference,
      differenceValue: t.differenceValue + (i.difference * itemCost),
    };
  }, { expectedQty: 0, expectedValue: 0, actualQty: 0, actualValue: 0, differenceQty: 0, differenceValue: 0 });

  if (loading) return <PageLoader />;
  if (error) return (<Box sx={{ p: 3 }}><Typography color="error">{error}</Typography></Box>);
  if (!stocktake) return (<Box sx={{ p: 3 }}><Typography>Stocktake not found</Typography></Box>);

  const clickSort = (col) => {
    if (sortBy === col) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortOrder('asc'); }
  };

  // Reference: the label with a ⇕ icon; Expected / Actual / Difference span
  // both their quantity and $ columns.
  const SortHeader = ({ label, col, colSpan, align = 'left' }) => (
    <TableCell sx={{ ...th, cursor: 'pointer', textAlign: align }} colSpan={colSpan} onClick={() => clickSort(col)}>
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
        {label}
        <UnfoldMore sx={{ fontSize: 18, opacity: sortBy === col ? 1 : 0.85 }} />
      </Box>
    </TableCell>
  );

  const handleExportCSV = () => {
    const items = getFilteredItems();

    // CSV Header
    const headers = ['Product', 'Cost', 'Case Quantity', 'Expected Qty', 'Expected Value', 'Actual Qty', 'Actual Value', 'Difference Qty', 'Difference Value'];

    // CSV Rows
    const rows = items.map(item => {
      const itemCost = getItemCost(item.product);
      return [
        `"${item.product.name}"`,
        itemCost.toFixed(2),
        item.product.caseQuantity || 0,
        item.expected,
        (item.expected * itemCost).toFixed(2),
        item.actual,
        (item.actual * itemCost).toFixed(2),
        item.difference,
        (item.difference * itemCost).toFixed(2)
      ].join(',');
    });

    // Add totals row
    const totalRow = [
      '"TOTAL"',
      '',
      '',
      stats.expectedQty.toFixed(2),
      stats.expectedValue.toFixed(2),
      stats.actualQty.toFixed(2),
      stats.actualValue.toFixed(2),
      stats.differenceQty.toFixed(2),
      stats.differenceValue.toFixed(2)
    ].join(',');

    // Combine all
    const csvContent = [headers.join(','), ...rows, totalRow].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `stocktake_${stocktake.name}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Reference "Stocktake Export" popup: PDF | CSV | Cancel. The PDF carries the
  // same columns as the on-screen table plus the Total row.
  const handleExportPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const items = getFilteredItems();
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(16);
    doc.text(stocktake.name || 'Stocktake', 14, 14);
    doc.setFontSize(10);
    const outletName = stocktake.outlet?.name || '';
    const when = stocktake.appliedAt || stocktake.completedAt || stocktake.createdAt;
    doc.text(`${outletName}${outletName ? '  -  ' : ''}${stocktake.status}  ${formatTimestamp(when)}`, 14, 20);
    const fmtQty = (n) => (Number.isInteger(n) ? String(n) : Number(n).toFixed(2));
    const body = items.map((item) => {
      const c = getItemCost(item.product);
      return [item.product.name, money(c), item.product.caseQuantity || 0, fmtQty(item.expected), money(item.expected * c), fmtQty(item.actual), money(item.actual * c), fmtQty(item.difference), money(item.difference * c)];
    });
    body.push(['Total', '', '', fmtQty(stats.expectedQty), money(stats.expectedValue), fmtQty(stats.actualQty), money(stats.actualValue), fmtQty(stats.differenceQty), money(stats.differenceValue)]);
    autoTable(doc, {
      head: [['Product', 'Cost', 'Case Quantity', 'Expected', 'Expected Value', 'Actual', 'Actual Value', 'Difference', 'Difference Value']],
      body,
      startY: 26,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [94, 187, 235], textColor: [248, 248, 248] },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' } },
      didParseCell: (d) => { if (d.row.index === body.length - 1) d.cell.styles.fontStyle = 'bold'; },
    });
    doc.save(`stocktake_${stocktake.name}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const users = statistics?.userBreakdown || [];
  const filteredItems = getFilteredItems();
  const fmtQty = (n) => (Number.isInteger(n) ? n : Number(n).toFixed(2));

  // Reference tabs: icon + label, plain black text; the active tab is a white
  // "folder" tab rising out of the grey-blue header band.
  const TABS = [
    { value: 'scanned', label: 'Scanned', icon: <ChecklistOutlined sx={{ fontSize: 18 }} /> },
    { value: 'not-scanned', label: 'Not Scanned', icon: <HighlightOffOutlined sx={{ fontSize: 16 }} /> },
    { value: 'all', label: 'All', icon: <AllInboxOutlined sx={{ fontSize: 18 }} /> },
    { value: 'statistics', label: 'Statistics', icon: <BarChartOutlined sx={{ fontSize: 18 }} /> },
  ];

  const qtyCell = { textAlign: 'right', pr: '16px !important' };
  const valueCell = { textAlign: 'left', pl: '16px !important' };

  return (
    <Box sx={{ bgcolor: 'white', minHeight: '100vh' }}>
      {/* Header band (reference: grey-blue, tabs sit on its bottom edge) */}
      <Box sx={{ bgcolor: HEADER_BAND, px: { xs: 2, md: 8 }, pt: { xs: 3, md: 7 }, borderBottom: '3px solid #d5dde8' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
          <Box>
            <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#000' }}>
              {/* Reference: a nameless stocktake is titled "Unnamed Stocktake" in grey */}
              {stocktake.name || <Box component="span" sx={{ color: '#808080' }}>Unnamed Stocktake</Box>}
              <Box component="span" sx={{ color: '#676b72', fontWeight: 400, fontSize: 16 }}>
                {' - '}{stocktake.outlet?.name || stocktake.outlet || ''}
              </Box>
            </Typography>
            {(() => {
              const when = stocktake.appliedAt || stocktake.completedAt || stocktake.createdAt;
              // Reference: "Applied zeroing other stock 2 months ago by Vipul";
              // after a re-apply: "Applied multiple times, most recently 6 years ago by Admin"
              const label = stocktake.appliedAt
                ? (applyHistory.length > 1 ? 'Applied multiple times, most recently' : `Applied${applyModeText(stocktake.userStats?.applyMode)}`)
                : stocktake.completedAt ? 'Completed' : 'Created';
              const byName = stocktake.appliedAt
                ? (stocktake.appliedBy?.name || stocktake.completedBy?.name)
                : stocktake.completedAt
                  ? stocktake.completedBy?.name
                  : stocktake.createdBy?.name;
              // Reference: no user -> "Completed 7 years ago" (no "by -")
              return (
                <Typography sx={{ fontSize: 16, color: '#000' }}>{label} {timeAgo(when)}{byName ? ` by ${byName}` : ''}</Typography>
              );
            })()}
            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
              <Typography sx={{ fontSize: 14, color: '#000' }}>
                {isFullStocktake ? 'Full Stocktake' : 'Partial Stocktake'}
              </Typography>
              {/* Reference: the finalise categories as grey chips beside the label */}
              {scopeChips.map((name) => (
                <Chip key={name} label={name} size="small" sx={{ borderRadius: '4px', bgcolor: '#cfd6df', color: '#313439', fontSize: 13, height: 24 }} />
              ))}
            </Stack>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            {users.length > 0 && (
              <AvatarGroup max={6} sx={{ mr: 0.5, '& .MuiAvatar-root': avatarSx(48) }}>
                {users.map((u) => (
                  <Tooltip key={u.userId} title={u.userName || ''} arrow
                    componentsProps={{ tooltip: { sx: { bgcolor: '#fff', color: '#000', fontSize: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', px: 2, py: 1 } }, arrow: { sx: { color: '#fff' } } }}>
                    <Avatar />
                  </Tooltip>
                ))}
              </AvatarGroup>
            )}
            {/* Reference: a completed (not yet applied) stocktake can be reopened with Edit */}
            {stocktake.status === 'Completed' && (
              <Button sx={exportBtn} onClick={reopenForEdit} startIcon={<EditOutlined />}>Edit</Button>
            )}
            <Button sx={exportBtn} disabled={tab === 'statistics'} onClick={() => setExportOpen(true)} startIcon={<OutputOutlined />}>Export</Button>
            {/* Reference: "Re-Apply Stocktake" stays available on an applied stocktake
                (it sets the products back to the counted figures). A completed one
                is applied for the first time. */}
            {(stocktake.status === 'Completed' || stocktake.status === 'Applied') && (
              <Button sx={primaryBtn} startIcon={<AssignmentTurnedInOutlined />} disabled={applying} onClick={openApply}>
                {stocktake.status === 'Applied' ? 'Re-Apply Stocktake' : 'Apply Stocktake'}
              </Button>
            )}
          </Stack>
        </Stack>

        {/* Tabs */}
        {/* No overflow here: with the tabs' -3px margin it raised a stray scrollbar */}
        <Stack direction="row" flexWrap="wrap" sx={{ mt: 6 }}>
          {TABS.map((t) => {
            const active = tab === t.value;
            return (
              <Box
                key={t.value}
                role="tab"
                aria-selected={active}
                tabIndex={0}
                onClick={() => setTab(t.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setTab(t.value); }}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  px: 3, height: 55, cursor: 'pointer', whiteSpace: 'nowrap',
                  fontSize: 14, color: '#000',
                  borderRadius: '8px 8px 0 0',
                  bgcolor: active ? '#fff' : 'transparent',
                  mb: '-3px', // sit on (and cover) the band's bottom rule
                  '&:hover': { bgcolor: active ? '#fff' : 'rgba(255,255,255,0.45)' },
                  outline: 'none',
                }}
              >
                {t.icon}
                <span>{t.label}</span>
              </Box>
            );
          })}
        </Stack>
      </Box>

      {/* Reference "Stocktake Export" popup: two blue tiles (PDF / CSV) + Cancel */}
      <Dialog open={exportOpen} onClose={() => setExportOpen(false)} PaperProps={{ sx: { borderRadius: '8px', width: 300, maxWidth: '95vw', boxShadow: 'none' } }}>
        <Box sx={{ bgcolor: 'rgb(190,227,248)', display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5 }}>
          <Typography sx={{ color: 'rgb(38,99,143)', fontWeight: 700, fontSize: 18 }}>?</Typography>
          <Typography sx={{ color: 'rgb(38,99,143)', fontWeight: 700, fontSize: 17 }}>Stocktake Export</Typography>
        </Box>
        <Box sx={{ p: 2 }}>
          <Stack direction="row" spacing={2} justifyContent="center">
            {[
              { key: 'pdf', label: 'PDF', icon: <PictureAsPdfOutlined sx={{ fontSize: 40 }} />, run: handleExportPDF },
              { key: 'csv', label: 'CSV', icon: <DescriptionOutlined sx={{ fontSize: 40 }} />, run: handleExportCSV },
            ].map((t) => (
              <Button
                key={t.key}
                onClick={async () => { setExportOpen(false); await t.run(); }}
                sx={{ width: 126, height: 118, borderRadius: '8px', bgcolor: '#1c86f2', color: '#fff', display: 'flex', flexDirection: 'column', gap: 1, fontSize: 16, fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#1670cc' } }}
              >
                {t.icon}
                {t.label}
              </Button>
            ))}
          </Stack>
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2.5 }}>
            <Button onClick={() => setExportOpen(false)} sx={{ ...exportBtn, minWidth: 118, bgcolor: '#dddddd', color: '#000' }}>Cancel</Button>
          </Stack>
        </Box>
      </Dialog>

      {/* Reference "Apply Stocktake" popup - opens right after Complete, from the
          Apply button on a completed stocktake, and after the Re-Apply warning. */}
      <Dialog open={applyOpen} onClose={() => !applying && setApplyOpen(false)} PaperProps={{ sx: { borderRadius: '8px', width: 700, maxWidth: '95vw' } }}>
        <Box sx={{ bgcolor: 'rgb(190,227,248)', display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25 }}>
          <Typography sx={{ color: 'rgb(38,99,143)', fontWeight: 700, fontSize: 18 }}>?</Typography>
          <Typography sx={{ color: 'rgb(38,99,143)', fontWeight: 700, fontSize: 17 }}>Apply Stocktake</Typography>
        </Box>
        <Box sx={{ px: 2, py: 2 }}>
          <Typography sx={{ fontSize: 15, color: '#313439', mb: 1.5 }}>Congratulations for completing your stocktake, there is only one step left.</Typography>
          <Typography sx={{ fontSize: 15, color: '#313439', mb: 1.5 }}>
            Please choose between <b>IGNORING</b> uncounted products (Ignore Other Stock) or setting uncounted product's inventory to <b>ZERO</b> (Zero Other Stock).
          </Typography>
          {stocktake.status === 'Applied' ? (
            <Typography sx={{ fontSize: 15, color: '#313439', mb: 1.5 }}>This stocktake has already been applied, reapplying the stocktake will modify your current inventory.</Typography>
          ) : (
            <Typography sx={{ fontSize: 15, color: '#313439', mb: 1.5 }}>You can also review the products before applying the stocktake.</Typography>
          )}
          <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1} useFlexGap sx={{ mb: 2.5 }}>
            <Typography sx={{ fontSize: 15, color: '#313439' }}>
              {isFullStocktake ? 'This stocktake will apply to all products.' : 'This stocktake will only apply to the following categories:'}
            </Typography>
            {scopeChips.map((name) => (
              <Chip key={name} label={name} size="small" sx={{ borderRadius: '4px', bgcolor: '#e5e5e5', color: '#313439', fontSize: 13, height: 24 }} />
            ))}
          </Stack>
          <Stack direction="row" justifyContent="flex-end" spacing={1.5} flexWrap="wrap" useFlexGap>
            <Button disabled={applying} onClick={() => { setApplyOpen(false); if (scopeFromUrl) setSearchParams({}, { replace: true }); }} sx={{ ...exportBtn, minWidth: 150 }}>
              {stocktake.status === 'Applied' ? 'Cancel' : 'Review'}
            </Button>
            <Button disabled={applying} onClick={() => doApply('ignore')} sx={{ ...primaryBtn, minWidth: 150 }}>Ignore Other Stock</Button>
            <Button disabled={applying} onClick={() => doApply('zero')} sx={{ ...primaryBtn, minWidth: 150 }}>Zero Other Stock</Button>
          </Stack>
        </Box>
      </Dialog>

      {/* Content - Table or Statistics */}
      <Box sx={{ px: 2, pt: 2, pb: 0 }}>
      {tab === 'statistics' ? (
        <StatisticsView statistics={statistics} loading={statsLoading} external={isExternal} />
      ) : (
        <>
          {/* Search + Filter (hidden on Statistics) */}
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <TextField
              fullWidth
              placeholder="Search for a product..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setSearchTerm(searchInput.trim()); }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  height: 42,
                  borderRadius: '4px',
                  fontSize: 16,
                  '& fieldset': { border: '1px solid #676b72' },
                  '&:hover fieldset': { border: '1px solid #676b72' },
                  '&.Mui-focused fieldset': { border: '2px solid #000' },
                },
                '& input::placeholder': { color: '#808080', opacity: 1 },
              }}
              InputProps={{
                endAdornment: searchInput ? (
                  <InputAdornment position="end">
                    {/* ✕ empties the box only; the table follows on Filter */}
                    <Close sx={{ fontSize: 20, color: '#313439', cursor: 'pointer' }} onClick={() => setSearchInput('')} />
                  </InputAdornment>
                ) : null,
              }}
            />
            <Button sx={{ ...primaryBtn, minWidth: 130 }} startIcon={<FilterAltOutlined />} onClick={() => setSearchTerm(searchInput.trim())}>Filter</Button>
          </Stack>

          {/* Table - header sticks under the top bar, Total sticks to the bottom
              of the window (reference). No overflow wrapper: it would break sticky. */}
          <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <TableHead>
              <TableRow sx={{ ...pillHead, '& th': { position: 'sticky', top: APP_BAR, zIndex: 2 } }}>
                <SortHeader label="Product" col="product" />
                <TableCell sx={{ ...th, textAlign: 'center' }}>Cost</TableCell>
                <TableCell sx={{ ...th, textAlign: 'center' }}>Case Quantity</TableCell>
                <SortHeader label="Expected" col="expected" colSpan={2} align="center" />
                <SortHeader label="Actual" col="actual" colSpan={2} align="center" />
                <SortHeader label="Difference" col="difference" colSpan={2} align="center" />
              </TableRow>
            </TableHead>
            <TableBody sx={{ '& td': { color: '#000', fontSize: 16, padding: '12px 16px', borderBottom: 'none', bgcolor: '#fff' } }}>
              {filteredItems.map((item) => {
                const c = getItemCost(item.product);
                return (
                  <TableRow key={item.id}>
                    <TableCell sx={{ maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {/* Reference: the name opens the product card on click */}
                      <Box
                        component="span"
                        role="button"
                        tabIndex={0}
                        onClick={(e) => setProductCard({ product: item.product, anchor: e.currentTarget })}
                        onKeyDown={(e) => { if (e.key === 'Enter') setProductCard({ product: item.product, anchor: e.currentTarget }); }}
                        sx={{ cursor: 'pointer', textDecoration: productCard?.product?.id === item.product.id ? 'underline' : 'none', '&:hover': { textDecoration: 'underline' } }}
                      >
                        {item.product.name}
                      </Box>
                      {item.product.isActive === false && (
                        <Box component="span" sx={{ color: '#808080' }}> - Inactive</Box>
                      )}
                    </TableCell>
                    {/* Reference "Cost" is the CASE cost as a plain number (93.74 for a
                        case of 6); the $ values beside the quantities use the unit cost. */}
                    <TableCell sx={{ textAlign: 'center' }}>{plainNumber(c * (item.product.caseQuantity || 1))}</TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>{item.product.caseQuantity ?? '-'}</TableCell>
                    <TableCell sx={qtyCell}>{item.expected}</TableCell>
                    <TableCell sx={valueCell}>{money(item.expected * c)}</TableCell>
                    <TableCell sx={qtyCell}>{item.actual}</TableCell>
                    <TableCell sx={valueCell}>{money(item.actual * c)}</TableCell>
                    <TableCell sx={{ ...qtyCell, color: `${signColor(item.difference)} !important` }}>{item.difference}</TableCell>
                    <TableCell sx={{ ...valueCell, color: `${signColor(item.difference * c)} !important` }}>{money(item.difference * c)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            {/* Reference Total row: blue label block on the left, figures in a
                white block with a blue outline, stuck to the bottom of the window. */}
            <TableBody>
              <TableRow sx={{
                '& td': { position: 'sticky', bottom: 0, zIndex: 2, fontWeight: 700, fontSize: 16, color: '#000', height: 51, padding: '8px 16px', bgcolor: '#fff', borderTop: '1px solid #5ebbeb', borderBottom: '1px solid #5ebbeb' },
                '& td:last-of-type': { borderRight: '1px solid #5ebbeb', borderTopRightRadius: '12px', borderBottomRightRadius: '12px' },
              }}>
                <TableCell colSpan={3} sx={{ bgcolor: '#5ebbeb !important', color: '#fff !important', borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' }}>Total</TableCell>
                {/* Reference totals are whole units ("6"), not "6.00". */}
                <TableCell sx={qtyCell}>{fmtQty(stats.expectedQty)}</TableCell>
                <TableCell sx={valueCell}>{money(stats.expectedValue)}</TableCell>
                <TableCell sx={qtyCell}>{fmtQty(stats.actualQty)}</TableCell>
                <TableCell sx={valueCell}>{money(stats.actualValue)}</TableCell>
                <TableCell sx={{ ...qtyCell, color: `${signColor(stats.differenceQty)} !important` }}>{fmtQty(stats.differenceQty)}</TableCell>
                <TableCell sx={{ ...valueCell, color: `${signColor(stats.differenceValue)} !important` }}>{money(stats.differenceValue)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <ProductCard
            product={productCard?.product || null}
            anchorEl={productCard?.anchor || null}
            onClose={() => setProductCard(null)}
          />
        </>
      )}
      </Box>
    </Box>
  );
}

// Reference: clicking a product name opens a card - type, name, today's cost
// (cents small), then Supplier / Category, Family and Tags; empty parts hidden.
// The product arrives with the stocktake (type, cost, category, family, tags,
// suppliers), so the card opens instantly - no extra request.
function ProductCard({ product, anchorEl, onClose }) {
  const label = { fontSize: 14, color: '#555' };
  const value = { fontSize: 16, color: '#000' };
  // Today's cost (the table keeps the stocktake-time cost).
  const caseCost = (() => {
    if (!product) return null;
    if (product.caseCost != null && Number(product.caseCost) > 0) return Number(product.caseCost);
    if (product.itemCost != null) return Number(product.itemCost) * (Number(product.caseQuantity) || 1);
    return 0;
  })();
  const [dollars, cents] = Math.abs(caseCost || 0).toFixed(2).split('.');
  const suppliers = (product?.suppliers || []).map((s) => s.supplier?.name).filter(Boolean);
  const tags = (product?.tags || []).map((t) => t.tag?.name || t.name).filter(Boolean);
  const type = String(product?.type || 'Normal Product').replace(/ Product$/i, '');

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      PaperProps={{ sx: { ml: 1.5, mt: -4, width: 420, maxWidth: '90vw', bgcolor: '#f8f8f8', border: '1px solid #ddd', borderRadius: '12px', boxShadow: '0 4px 14px rgba(0,0,0,0.12)', p: 3 } }}
    >
      {product && (
        <>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2} sx={{ pb: 2, borderBottom: '1px solid #ddd' }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={label}>{type}</Typography>
              <Typography sx={value}>{product.name}</Typography>
            </Box>
            <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
              <Typography sx={label}>Cost</Typography>
              <Typography sx={{ fontSize: 18, color: '#000' }}>
                {caseCost < 0 ? '-' : ''}${dollars}.<Box component="span" sx={{ fontSize: 13 }}>{cents}</Box>
              </Typography>
            </Box>
          </Stack>
          <Grid container rowSpacing={2} columnSpacing={2} sx={{ pt: 2 }}>
            {suppliers.length > 0 && (
              <Grid item xs={6}>
                <Typography sx={label}>Supplier</Typography>
                <Typography sx={value}>{suppliers.join(', ')}</Typography>
              </Grid>
            )}
            {product.category?.name && (
              <Grid item xs={6}>
                <Typography sx={label}>Category</Typography>
                <Typography sx={value}>{product.category.name}</Typography>
              </Grid>
            )}
            {product.family?.name && (
              <Grid item xs={12}>
                <Typography sx={label}>Family</Typography>
                <Typography sx={value}>{product.family.name}</Typography>
              </Grid>
            )}
            {tags.length > 0 && (
              <Grid item xs={12}>
                <Typography sx={{ ...label, mb: 0.5 }}>Tags</Typography>
                <Stack direction="row" flexWrap="wrap" gap={1} useFlexGap>
                  {tags.map((t) => (
                    <Box key={t} sx={{ border: '1px solid #ccc', borderRadius: '6px', px: 1, py: 0.25, fontSize: 15, bgcolor: '#fff' }}>{t}</Box>
                  ))}
                </Stack>
              </Grid>
            )}
          </Grid>
        </>
      )}
    </Popover>
  );
}

// Reference statistics cards: light grey, hairline border, 4px radius.
const cardSx = { width: 450, maxWidth: '100%', boxSizing: 'border-box', bgcolor: '#f8f8f8', border: '1px solid #e6e6e6', borderRadius: '4px', p: 2 };

// Statistics View Component — stat tiles, apply cards, per-user cards, events
function StatisticsView({ statistics, loading, external = false }) {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <Typography>Loading statistics...</Typography>
      </Box>
    );
  }

  if (!statistics) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <Typography color="text.secondary">No statistics available</Typography>
      </Box>
    );
  }

  const label = { fontSize: 14, color: '#000' };
  const bigNumber = { fontSize: 36, fontWeight: 700, lineHeight: 1.2, color: '#000' };

  // Reference External Stocktake statistics (Mayfair 29/10/2026): only
  // "Products counted" and "Completed" plus the Applied card - no scans,
  // duration, per-user blocks or activity table (nothing was scanned).
  const tiles = external
    ? [
        { label: 'Products counted', value: statistics.productsCounted?.toLocaleString?.() ?? statistics.productsCounted },
        { label: 'Completed', value: timeAgo(statistics.completedAt) },
      ]
    : [
        { label: 'Number of scans', value: statistics.totalScans?.toLocaleString?.() ?? statistics.totalScans },
        { label: 'Products counted', value: statistics.productsCounted?.toLocaleString?.() ?? statistics.productsCounted },
        { label: 'Sales affecting', value: Number(statistics.salesAffecting || 0).toLocaleString() },
        { label: 'Duration of Stocktake', value: statistics.durationFormatted },
        { label: 'Completed', value: timeAgo(statistics.completedAt) },
      ];

  return (
    <Box sx={{ px: 2, pt: 3, pb: 4 }}>
      {/* Reference: four tiles per row, "Completed" wraps to the second row */}
      <Grid container rowSpacing={8} columnSpacing={4} sx={{ mb: 8 }}>
        {tiles.map((t) => (
          <Grid item xs={12} sm={6} md={3} key={t.label}>
            <Typography sx={label}>{t.label}</Typography>
            <Typography sx={bigNumber}>{t.value}</Typography>
          </Grid>
        ))}
      </Grid>

      {/* Applied cards - one per apply, stacked (reference: "Applied this stocktake
          2 months ago, zeroing other stock"). */}
      {(statistics.applyHistory || []).length > 0 && (
        <Stack spacing={6} sx={{ mb: 6 }}>
          {statistics.applyHistory.map((h, i) => (
            <Box key={i} sx={cardSx}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                <Avatar sx={avatarSx(44)} />
                <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#000' }}>{h.userName || '-'}</Typography>
              </Stack>
              <Typography sx={{ fontSize: 16, color: '#000', pl: 2 }}>
                Applied this stocktake {timeAgo(h.at)}, <b>{h.mode === 'zero' ? 'zeroing' : 'ignoring'}</b> other stock
              </Typography>
            </Box>
          ))}
        </Stack>
      )}

      {/* Per-user cards, side by side */}
      {!external && (statistics.userBreakdown || []).length > 0 && (
        <Stack direction="row" flexWrap="wrap" gap={2} useFlexGap sx={{ mb: 6 }}>
          {statistics.userBreakdown.map((user) => (
            <Box key={user.userId} sx={cardSx}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                <Avatar sx={avatarSx(44)} />
                <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#000' }}>{user.userName}</Typography>
              </Stack>
              <Stack direction="row" spacing={9}>
                <Box>
                  <Typography sx={label}>Number of scans</Typography>
                  <Typography sx={bigNumber}>{Number(user.totalScans || 0).toLocaleString()}</Typography>
                </Box>
                <Box>
                  <Typography sx={label}>Products counted</Typography>
                  <Typography sx={bigNumber}>{Number(user.productsCounted || 0).toLocaleString()}</Typography>
                </Box>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      {!external && <ActivityTable activities={statistics.activities || []} />}
    </Box>
  );
}

// Reference event names: a typed count is a "Scan", a changed count an "Edit".
const EVENT_LABEL = { Count: 'Scan', Update: 'Edit' };

// Reference: events table under the statistics. "Filter by Users" (every user)
// and "Filter by Products" (a product search) only take effect on Filter.
function ActivityTable({ activities }) {
  const [userOptions, setUserOptions] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [productInput, setProductInput] = useState('');
  const [userPick, setUserPick] = useState(null);
  const [productPick, setProductPick] = useState(null);
  const [applied, setApplied] = useState({ user: null, product: null });

  useEffect(() => {
    userService.getUsers()
      .then((r) => {
        const list = Array.isArray(r) ? r : (r?.users || r?.data || []);
        setUserOptions(list.map((u) => ({ id: u.id, name: u.name || u.username || '' })).filter((u) => u.name).sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => setUserOptions([]));
  }, []);

  useEffect(() => {
    const term = productInput.trim();
    if (term.length < 2 || (productPick && productPick.name === productInput)) { setProductOptions([]); return undefined; }
    let alive = true;
    const t = setTimeout(() => {
      productService.getProducts({ search: term, limit: 20 })
        .then(({ products }) => { if (alive) setProductOptions((products || []).map((p) => ({ id: p.id, name: p.name }))); })
        .catch(() => { if (alive) setProductOptions([]); });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [productInput, productPick]);

  const rows = activities.filter((a) =>
    (!applied.user || (a.userId != null ? a.userId === applied.user.id : a.user === applied.user.name)) &&
    (!applied.product || (a.productId != null ? a.productId === applied.product.id : a.productName === applied.product.name)));

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      height: 42,
      borderRadius: '4px',
      fontSize: 16,
      py: '0 !important',
      '& fieldset': { border: '1px solid #676b72' },
      '&:hover fieldset': { border: '1px solid #676b72' },
      '&.Mui-focused fieldset': { border: '2px solid #000' },
    },
    '& input::placeholder': { color: '#808080', opacity: 1 },
  };
  const listboxSx = {
    '& .MuiAutocomplete-option': { minHeight: 56, fontSize: 16, color: '#000' },
    '& .MuiAutocomplete-option.Mui-focused': { bgcolor: '#74d0fb !important' },
  };

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mb: 4 }}>
        <Autocomplete
          fullWidth
          options={userOptions}
          value={userPick}
          onChange={(_, v) => setUserPick(v)}
          getOptionLabel={(o) => o?.name || ''}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          ListboxProps={{ sx: listboxSx }}
          renderInput={(params) => <TextField {...params} placeholder="Filter by Users" sx={inputSx} />}
        />
        <Autocomplete
          fullWidth
          options={productOptions}
          value={productPick}
          inputValue={productInput}
          onInputChange={(_, v) => setProductInput(v)}
          onChange={(_, v) => setProductPick(v)}
          filterOptions={(o) => o}
          getOptionLabel={(o) => o?.name || ''}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          noOptionsText="Keep Typing to Search..."
          ListboxProps={{ sx: listboxSx }}
          renderInput={(params) => <TextField {...params} placeholder="Filter by Products" sx={inputSx} />}
        />
        <Button sx={{ ...primaryBtn, minWidth: 130 }} startIcon={<FilterAltOutlined />} onClick={() => setApplied({ user: userPick, product: productPick })}>
          Filter
        </Button>
      </Stack>

      {rows.length === 0 ? (
        <Typography sx={{ textAlign: 'center', color: '#676b72', fontSize: 16, py: 3 }}>No stocktake events found</Typography>
      ) : (
        <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <TableHead>
            <TableRow sx={pillHead}>
              {['Product', 'Event', 'Count', 'User', 'Timestamp'].map((h) => (
                <TableCell key={h} sx={th}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((a, index) => (
              <TableRow key={a.id} sx={{ bgcolor: index % 2 === 0 ? '#fff' : '#f4f4f4', '& td': { color: '#000', fontSize: 16, padding: '13px 16px', borderBottom: 'none' } }}>
                <TableCell>{a.productName || '-'}</TableCell>
                <TableCell>{EVENT_LABEL[a.eventType] || a.eventType}</TableCell>
                <TableCell>{a.count}</TableCell>
                <TableCell>{a.user}</TableCell>
                <TableCell>{formatTimestamp(a.timestamp)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}
