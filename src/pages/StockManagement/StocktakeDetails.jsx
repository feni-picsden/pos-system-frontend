import React, { useState, useEffect } from 'react';
import PageLoader from '../../components/Common/PageLoader';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import productService from '../../services/productService';
import {
  Box,
  Button,
  Chip,
  Dialog,
  Paper,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Grid,
  Avatar,
  AvatarGroup,
  Tooltip,
  InputAdornment,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Download,
  Refresh,
  BarChart,
  VisibilityOutlined,
  Cancel,
  Assessment,
  Close,
  FilterAlt,
  ArrowDropUp,
  ArrowDropDown,
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
  return `${years} year${years !== 1 ? 's' : ''} ago`;
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

function formatTimestamp(value) {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function initials(name) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// Shopfront-style button tokens
const exportBtn = {
  height: 53,
  minWidth: 108,
  borderRadius: 0,
  bgcolor: '#f8f8f8',
  color: '#676b72',
  border: '1px solid #676b72',
  fontSize: 16,
  fontWeight: 400,
  textTransform: 'none',
  boxShadow: 'none',
  transition: 'background-color 0.2s ease, color 0.2s ease',
  '&:hover': { bgcolor: '#313439', color: '#bdbdbd', boxShadow: 'none' },
};

const primaryBtn = {
  height: 53,
  borderRadius: 0,
  bgcolor: '#5ebbeb',
  color: '#f8f8f8',
  border: '1px solid #f8f8f8',
  fontSize: 16,
  fontWeight: 400,
  textTransform: 'none',
  boxShadow: 'none',
  transition: 'background-color 0.2s ease, color 0.2s ease',
  '&:hover': { bgcolor: '#f8f8f8', color: '#5ebbeb', boxShadow: 'none' },
};

const tabSx = {
  minHeight: 55,
  height: 55,
  textTransform: 'none',
  fontSize: 16,
  fontWeight: 700,
  color: '#676b72',
  transition: 'padding 0.2s ease-in-out',
  '&.Mui-selected': { color: '#1c86f2' },
};

const th = {
  backgroundColor: '#5ebbeb',
  color: '#f8f8f8',
  fontWeight: 700,
  fontSize: 16,
  // Reference headers are Title Case ("Product", "Case Quantity"), not uppercase.
  textTransform: 'none',
  padding: '8px',
  height: 48,
  borderBottom: 'none',
};

export default function StocktakeDetails() {
  const { id } = useParams();
  const [stocktake, setStocktake] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [tab, setTab] = useState('scanned');
  const [sortBy, setSortBy] = useState('product');
  const [sortOrder, setSortOrder] = useState('asc');

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

  const handleTabChange = (_, newTab) => setTab(newTab);

  const [applying, setApplying] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
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
  const isFullStocktake = applyScope.applyToAll || applyScope.categoryIds.length === 0;
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

  const getFilteredItems = () => {
    let filtered = stocktake?.items || [];

    if (searchTerm) {
      filtered = filtered.filter(i => (i.product?.name || '').toLowerCase().includes(searchTerm.toLowerCase()));
    }
    if (tab !== 'all') {
      // "Scanned" = counted during the stocktake (barcode scan OR manual count).
      // Items the apply step added for uncounted products carry the NOT_SCANNED
      // marker (reference: the Not Scanned tab lists every product in scope).
      const counted = (i) => i.notes !== 'NOT_SCANNED' && ((i.scanCount > 0) || ((parseFloat(i.actualQuantity) || 0) > 0));
      filtered = filtered.filter(i => (tab === 'scanned' ? counted(i) : !counted(i)));
    }

    filtered.sort((a, b) => {
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
      product: i.product || { name: i.productName || 'Unknown', cost: i.product?.cost ?? 0, caseQuantity: i.product?.caseQuantity ?? 0 },
      expected: i.expectedQuantity ?? i.expected ?? 0,
      actual: i.actualQuantity ?? i.actual ?? 0,
      difference: (i.actualQuantity ?? i.actual ?? 0) - (i.expectedQuantity ?? i.expected ?? 0),
      valueDifference: ((i.actualQuantity ?? i.actual ?? 0) - (i.expectedQuantity ?? i.expected ?? 0)) * (i.product?.cost ?? 0),
    }));
  };

  const getItemCost = (product) => {
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

  const stats = getFilteredItems().reduce((t, i) => {
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

  const SortHeader = ({ label, col }) => (
    <TableCell sx={{ ...th, cursor: 'pointer' }} onClick={() => clickSort(col)}>
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <span>{label}</span>
        <Stack sx={{ lineHeight: 0 }}>
          <ArrowDropUp sx={{ fontSize: 18, m: '-5px 0', opacity: sortBy === col && sortOrder === 'asc' ? 1 : 0.4 }} />
          <ArrowDropDown sx={{ fontSize: 18, m: '-5px 0', opacity: sortBy === col && sortOrder === 'desc' ? 1 : 0.4 }} />
        </Stack>
      </Stack>
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

  const users = statistics?.userBreakdown || [];
  const filteredItems = getFilteredItems();

  return (
    <Box sx={{ p: 3, bgcolor: 'white', minHeight: '100vh' }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#000' }}>
            {stocktake.name}
            <Box component="span" sx={{ color: '#676b72', fontWeight: 400 }}>
              {' — '}{stocktake.outlet?.name || stocktake.outlet || ''}
            </Box>
          </Typography>
          {(() => {
            const when = stocktake.appliedAt || stocktake.completedAt || stocktake.createdAt;
            // Reference: "Applied zeroing other stock 2 months ago by Vipul";
            // after a re-apply: "Applied multiple times, most recently 6 years ago by Admin"
            const label = stocktake.appliedAt
              ? (applyHistory.length > 1 ? 'Applied multiple times, most recently' : `Applied${applyModeText(stocktake.userStats?.applyMode)}`)
              : stocktake.completedAt ? 'Completed' : 'Created';
            const by = stocktake.appliedAt
              ? (stocktake.appliedBy?.name || stocktake.completedBy?.name || '-')
              : stocktake.completedAt
                ? (stocktake.completedBy?.name || stocktake.completedBy || '-')
                : (stocktake.createdBy?.name || stocktake.createdBy || '-');
            return (
              <Typography sx={{ fontSize: 14, color: '#676b72' }}>{label} {timeAgo(when)} by {by}</Typography>
            );
          })()}
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
            <Typography sx={{ fontSize: 14, color: '#000' }}>
              {isFullStocktake ? 'Full Stocktake' : 'Partial Stocktake'}
            </Typography>
            {/* Reference: the finalise categories as grey chips beside the label */}
            {scopeChips.map((name) => (
              <Chip key={name} label={name} size="small" sx={{ borderRadius: '4px', bgcolor: '#e5e5e5', color: '#313439', fontSize: 13, height: 24 }} />
            ))}
          </Stack>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {users.length > 0 && (
            <AvatarGroup max={6} sx={{ '& .MuiAvatar-root': { width: 36, height: 36, fontSize: 14, bgcolor: '#5ebbeb', color: '#f8f8f8' } }}>
              {users.map((u) => (
                <Tooltip key={u.userId} title={u.userName || ''}>
                  <Avatar>{initials(u.userName)}</Avatar>
                </Tooltip>
              ))}
            </AvatarGroup>
          )}
          {/* Reference: a completed (not yet applied) stocktake can be reopened with Edit */}
          {stocktake.status === 'Completed' && (
            <Button sx={exportBtn} onClick={reopenForEdit}>Edit</Button>
          )}
          <Button sx={exportBtn} onClick={handleExportCSV} startIcon={<Download />}>Export</Button>
          {/* Reference: "Re-Apply Stocktake" stays available on an applied stocktake
              (it sets the products back to the counted figures). A completed one
              is applied for the first time. */}
          {(stocktake.status === 'Completed' || stocktake.status === 'Applied') && (
            <Button sx={primaryBtn} startIcon={<Refresh />} disabled={applying} onClick={openApply}>
              {stocktake.status === 'Applied' ? 'Re-Apply Stocktake' : 'Apply Stocktake'}
            </Button>
          )}
        </Stack>
      </Stack>

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

      {/* Tabs (above the search row) */}
      <Tabs
        value={tab}
        onChange={handleTabChange}
        variant="fullWidth"
        sx={{ mb: 2, minHeight: 55, '& .MuiTabs-indicator': { bgcolor: '#1c86f2', height: 3 } }}
      >
        <Tab disableRipple value="scanned" sx={tabSx} label={<TabLabel icon={<VisibilityOutlined fontSize="small" />} text="Scanned" />} />
        <Tab disableRipple value="not-scanned" sx={tabSx} label={<TabLabel icon={<Cancel fontSize="small" />} text="Not Scanned" />} />
        <Tab disableRipple value="all" sx={tabSx} label={<TabLabel icon={<BarChart fontSize="small" />} text="All" />} />
        <Tab disableRipple value="statistics" sx={tabSx} label={<TabLabel icon={<Assessment fontSize="small" />} text="Statistics" />} />
      </Tabs>

      {/* Content - Table or Statistics */}
      {tab === 'statistics' ? (
        <StatisticsView statistics={statistics} loading={statsLoading} />
      ) : (
        <>
          {/* Search + Filter (hidden on Statistics) */}
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <TextField
              fullWidth
              placeholder="Search for a product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  height: 53,
                  borderRadius: 0,
                  fontSize: 16,
                  '& fieldset': { border: '1px solid #000' },
                  '&:hover fieldset': { border: '1px solid #000' },
                  '&.Mui-focused fieldset': { border: '2px solid #000' },
                },
                '& input::placeholder': { color: '#808080', opacity: 1 },
              }}
              InputProps={{
                endAdornment: searchTerm ? (
                  <InputAdornment position="end">
                    <Close sx={{ fontSize: 24, color: '#313439', cursor: 'pointer' }} onClick={() => setSearchTerm('')} />
                  </InputAdornment>
                ) : null,
              }}
            />
            <Button sx={{ ...primaryBtn, minWidth: 98 }} startIcon={<FilterAlt />}>Filter</Button>
          </Stack>

          {/* Table */}
          <TableContainer component={Paper} sx={{ boxShadow: 'none', borderRadius: 0 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <SortHeader label="Product" col="product" />
                  <TableCell sx={th}>Cost</TableCell>
                  <TableCell sx={th}>Case Quantity</TableCell>
                  {/* Reference: the $ value sits in its own column beside the quantity */}
                  <SortHeader label="Expected" col="expected" />
                  <TableCell sx={th} />
                  <SortHeader label="Actual" col="actual" />
                  <TableCell sx={th} />
                  <SortHeader label="Difference" col="difference" />
                  <TableCell sx={th} />
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredItems.map((item, index) => (
                  <TableRow
                    key={item.id}
                    sx={{
                      bgcolor: index % 2 === 0 ? '#fff' : '#f8f8f8',
                      '& td': { color: '#000', fontSize: 16, padding: '8px 8px 8px 10px', borderBottom: 'none' },
                    }}
                  >
                    <TableCell>{item.product.name}</TableCell>
                    {/* Reference "Cost" is the CASE cost as a plain number (93.74 for a
                        case of 6); the $ values beside the quantities use the unit cost. */}
                    <TableCell>{(getItemCost(item.product) * (item.product.caseQuantity || 1)).toFixed(2)}</TableCell>
                    <TableCell>{item.product.caseQuantity ?? '-'}</TableCell>
                    <TableCell>{item.expected}</TableCell>
                    <TableCell>{money(item.expected * getItemCost(item.product))}</TableCell>
                    <TableCell>{item.actual}</TableCell>
                    <TableCell>{money(item.actual * getItemCost(item.product))}</TableCell>
                    <TableCell sx={{ color: `${item.difference === 0 ? '#000' : item.difference > 0 ? '#16a34a' : '#dc2626'} !important` }}>
                      {item.difference}
                    </TableCell>
                    <TableCell sx={{ color: `${item.difference === 0 ? '#000' : item.difference > 0 ? '#16a34a' : '#dc2626'} !important` }}>
                      {money(item.difference * getItemCost(item.product))}
                    </TableCell>
                  </TableRow>
                ))}
                {/* TOTAL footer row */}
                {/* Reference Total row: the label side is blue, the figures sit in a
                    white cell in bold black (difference keeps its red/green). */}
                <TableRow sx={{ '& td': { color: '#000', fontWeight: 700, fontSize: 16, height: 36, padding: '8px 8px 8px 10px', borderBottom: 'none', borderTop: '1px solid #5ebbeb' } }}>
                  <TableCell sx={{ bgcolor: '#5ebbeb', color: '#f8f8f8 !important' }}>Total</TableCell>
                  <TableCell sx={{ bgcolor: '#5ebbeb' }} />
                  <TableCell sx={{ bgcolor: '#5ebbeb' }} />
                  {/* Reference totals are whole units ("6"), not "6.00". */}
                  <TableCell>{Number.isInteger(stats.expectedQty) ? stats.expectedQty : stats.expectedQty.toFixed(2)}</TableCell>
                  <TableCell>{money(stats.expectedValue)}</TableCell>
                  <TableCell>{Number.isInteger(stats.actualQty) ? stats.actualQty : stats.actualQty.toFixed(2)}</TableCell>
                  <TableCell>{money(stats.actualValue)}</TableCell>
                  <TableCell sx={{ color: `${stats.differenceQty === 0 ? '#000' : stats.differenceQty > 0 ? '#16a34a' : '#dc2626'} !important` }}>
                    {Number.isInteger(stats.differenceQty) ? stats.differenceQty : stats.differenceQty.toFixed(2)}
                  </TableCell>
                  <TableCell sx={{ color: `${stats.differenceValue === 0 ? '#000' : stats.differenceValue > 0 ? '#16a34a' : '#dc2626'} !important` }}>
                    {money(stats.differenceValue)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}

// Statistics View Component — flat stat tiles, activity feed, per-user blocks
function StatisticsView({ statistics, loading }) {
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

  const label = { fontSize: 13, color: '#676b72' };
  const bigNumber = { fontSize: 42, fontWeight: 700, lineHeight: 1.2, color: '#000' };

  const tiles = [
    { label: 'Number of scans', value: statistics.totalScans?.toLocaleString?.() ?? statistics.totalScans },
    { label: 'Products counted', value: statistics.productsCounted?.toLocaleString?.() ?? statistics.productsCounted },
    { label: 'Sales affecting', value: Number(statistics.salesAffecting || 0).toLocaleString() },
    { label: 'Duration of Stocktake', value: statistics.durationFormatted },
    { label: 'Completed', value: timeAgo(statistics.completedAt) },
  ];

  return (
    <Box>
      {/* Flat stat tiles — one grid, no card borders */}
      <Grid container spacing={4} sx={{ mb: 4 }}>
        {tiles.map((t) => (
          <Grid item xs={12} sm={6} md={2.4} key={t.label}>
            <Typography sx={label}>{t.label}</Typography>
            <Typography sx={bigNumber}>{t.value}</Typography>
          </Grid>
        ))}
      </Grid>

      {/* Applied by - one card per apply (reference: "Applied this stocktake 2 months
          ago, zeroing other stock"; a re-applied stocktake shows a card per apply). */}
      {(statistics.applyHistory || []).length > 0 && (
        <Stack direction="row" flexWrap="wrap" gap={2} useFlexGap sx={{ py: 3, borderTop: '1px solid #e0e0e0' }}>
          {statistics.applyHistory.map((h, i) => (
            <Box key={i} sx={{ minWidth: 300, border: '1px solid #e0e0e0', bgcolor: '#f8f8f8', p: 2 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                <Avatar sx={{ width: 36, height: 36, fontSize: 14, bgcolor: '#5ebbeb', color: '#f8f8f8' }}>
                  {initials(h.userName)}
                </Avatar>
                <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#000' }}>{h.userName || '-'}</Typography>
              </Stack>
              <Typography sx={{ fontSize: 15, color: '#000' }}>
                Applied this stocktake <b>{timeAgo(h.at)}</b>, <b>{h.mode === 'zero' ? 'zeroing' : 'ignoring'}</b> other stock
              </Typography>
            </Box>
          ))}
        </Stack>
      )}

      {/* Per-user blocks */}
      {(statistics.userBreakdown || []).map((user) => (
        <Box key={user.userId} sx={{ py: 3, borderTop: '1px solid #e0e0e0' }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
            <Avatar sx={{ width: 36, height: 36, fontSize: 14, bgcolor: '#5ebbeb', color: '#f8f8f8' }}>
              {initials(user.userName)}
            </Avatar>
            <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#000' }}>{user.userName}</Typography>
          </Stack>
          <Stack direction="row" spacing={8}>
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

      <ActivityTable activities={statistics.activities || []} />
    </Box>
  );
}

// Reference: activity table under the statistics - Filter by Users / Filter by
// Products, columns Product | Event | Count | User | Timestamp (Sale rows too).
function ActivityTable({ activities }) {
  const [userFilter, setUserFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const users = [...new Set(activities.map((a) => a.user).filter(Boolean))].sort();
  const products = [...new Set(activities.map((a) => a.productName).filter(Boolean))].sort();
  const rows = activities.filter((a) => (!userFilter || a.user === userFilter) && (!productFilter || a.productName === productFilter));

  const selectSx = {
    height: 44,
    borderRadius: 0,
    fontSize: 15,
    '& fieldset': { border: '1px solid #000' },
    '&:hover fieldset': { border: '1px solid #000' },
    '&.Mui-focused fieldset': { border: '2px solid #000' },
  };

  return (
    <Box sx={{ pt: 3, borderTop: '1px solid #e0e0e0' }}>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Select fullWidth displayEmpty value={userFilter} onChange={(e) => setUserFilter(e.target.value)} sx={selectSx}>
          <MenuItem value=""><span style={{ color: '#808080' }}>Filter by Users</span></MenuItem>
          {users.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
        </Select>
        <Select fullWidth displayEmpty value={productFilter} onChange={(e) => setProductFilter(e.target.value)} sx={selectSx}>
          <MenuItem value=""><span style={{ color: '#808080' }}>Filter by Products</span></MenuItem>
          {products.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
        </Select>
        <Button sx={{ ...primaryBtn, height: 44, minWidth: 98 }} startIcon={<FilterAlt />} onClick={() => { setUserFilter(''); setProductFilter(''); }}>Filter</Button>
      </Stack>
      <TableContainer component={Paper} sx={{ boxShadow: 'none', borderRadius: 0 }}>
        <Table>
          <TableHead>
            <TableRow>
              {['Product', 'Event', 'Count', 'User', 'Timestamp'].map((h) => (
                <TableCell key={h} sx={{ ...th, textTransform: 'none' }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={5} sx={{ color: '#676b72' }}>No activity recorded.</TableCell></TableRow>
            )}
            {rows.map((a, index) => (
              <TableRow key={a.id} sx={{ bgcolor: index % 2 === 0 ? '#fff' : '#f8f8f8', '& td': { color: '#000', fontSize: 16, padding: '10px 8px 10px 10px', borderBottom: 'none' } }}>
                <TableCell>{a.productName || '-'}</TableCell>
                {/* Reference lists a typed count as a "Scan" event too. */}
                <TableCell>{a.eventType === 'Count' ? 'Scan' : a.eventType}</TableCell>
                <TableCell sx={{ color: '#1c86f2 !important' }}>{a.count}</TableCell>
                <TableCell>{a.user}</TableCell>
                <TableCell>{formatTimestamp(a.timestamp)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

function TabLabel({ icon, text }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      {icon}
      <span>{text}</span>
    </Stack>
  );
}
