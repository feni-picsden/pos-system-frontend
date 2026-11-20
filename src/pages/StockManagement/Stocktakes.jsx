import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Dialog,
} from '@mui/material';
import {
  Assignment,
  CalculateOutlined,
  GridViewOutlined,
  HelpOutline,
  VisibilityOutlined,
  Close,
  ArrowDropDown,
} from '@mui/icons-material';
import { SearchGlyph } from '../../components/Common/EmptyResults';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { formatDateTime as formatAppDateTime } from '../../utils/appDateTime';
import stocktakeService from '../../services/stocktakeService';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';
import usePageCache from '../../hooks/usePageCache';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import useHeaderScope from '../../hooks/useHeaderScope';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import DateRangePicker from '../../components/Common/DateRangePicker';
import { useTheme } from '@mui/material/styles';
import { byMode } from '../../theme/sfPalette';

// Reference dark (Force Dark Mode) colours
const DK_TEXT = '#f8f8f8';
const DK_ON_BLUE = '#232323';

const primaryButtonSx = {
  bgcolor: '#5ebbeb',
  color: byMode('#fff', DK_ON_BLUE),
  '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' },
  borderRadius: '12px',
  textTransform: 'none',
  boxShadow: 'none',
  fontWeight: 700,
  fontSize: 16,
  px: 4,
  height: 42,
};

// Reference secondary buttons: transparent bg, 1px #8c8c8c border, #6f6f6f text
const outlinedButtonSx = {
  bgcolor: 'transparent',
  color: byMode('#6f6f6f', DK_TEXT),
  border: byMode('1px solid #8c8c8c', `1px solid ${DK_TEXT}`),
  '&:hover': { bgcolor: byMode('rgba(0,0,0,0.05)', 'rgba(255,255,255,0.08)'), border: byMode('1px solid #8c8c8c', `1px solid ${DK_TEXT}`), boxShadow: 'none' },
  borderRadius: '12px',
  textTransform: 'none',
  boxShadow: 'none',
  fontWeight: 700,
  fontSize: 16,
  px: 4,
  height: 42,
};

const SectionLabel = ({ children }) => (
  <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 400, fontSize: 16, color: byMode('#000', DK_TEXT) }}>
    {children}
  </Typography>
);

// Match Shopfront: dark-gray outlined border, turns solid black on focus
const inputSx = {
  backgroundColor: byMode('white', '#121212'),
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    fontSize: 16,
    '& .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#404040', '#a1a1a1'), borderWidth: '1px' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#404040', '#a1a1a1'), borderWidth: '1px' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#000000', '#2b7fff'), borderWidth: '2px' },
  },
  '& input::placeholder': { color: byMode(undefined, '#757575'), opacity: byMode(undefined, 1) },
};

// Sky-blue hover for select dropdown options
const menuItemSx = {
  fontSize: 16,
  color: byMode('#000', DK_TEXT),
  '&:hover': { bgcolor: byMode('#5ebbeb', '#0084d1'), color: byMode(undefined, '#fafafa') },
  '&.Mui-selected': { bgcolor: 'transparent', color: byMode(undefined, '#00a6f4') },
  '&.Mui-selected:hover': { bgcolor: byMode('#5ebbeb', '#0084d1'), color: byMode(undefined, '#fafafa') },
  '&.Mui-focusVisible': { bgcolor: byMode('#5ebbeb', '#0084d1') },
};

const selectSx = {
  backgroundColor: byMode('white', '#121212'),
  borderRadius: '8px',
  fontSize: 16,
  height: 41,
  '& .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#404040', '#a1a1a1'), borderWidth: '1px' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#404040', '#a1a1a1'), borderWidth: '1px' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#000000', '#2b7fff'), borderWidth: '2px' },
  '& .MuiSelect-icon': { color: byMode('#404040', '#a1a1a1') },
};

const selectMenuProps = {
  PaperProps: {
    sx: {
      mt: 0.5,
      borderRadius: '8px',
      bgcolor: byMode(undefined, '#232323'),
      border: byMode('1px solid #e0e0e0', '1px solid #a1a1a1'),
      boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
      '& .MuiList-root': { py: 0.5 },
    },
  },
};

// Statuses are compared and shown in ONE spelling. Rows written outside the app
// (demo seed / imports) carried "IN_PROGRESS" / "COMPLETED"; the exact-match checks
// below then offered an in-progress stocktake no Continue / Cancel at all.
const statusOf = (row) => {
  const key = String(row?.status || '').trim().toLowerCase().replace(/[_\s]+/g, ' ');
  if (key === 'in progress' || key === 'draft') return 'In Progress';
  if (key.startsWith('completed')) return 'Completed';
  if (key === 'applied') return 'Applied';
  if (key === 'cancelled' || key === 'canceled') return 'Cancelled';
  return row?.status || '';
};

// "3 months ago" / "a year ago" (reference second line under the status)
const ago = (value) => {
  if (!value) return '';
  const text = formatDistanceToNowStrict(new Date(value), { addSuffix: true });
  return text.replace(/^1 (\w+) ago$/, (_, unit) => `${unit === 'hour' ? 'an' : 'a'} ${unit} ago`);
};

// Reference Status cell: "Completed by Vipul" over "3 months ago" - an applied
// stocktake still reads "Completed by ..." (the apply time has its own column).
const StatusCell = ({ row }) => {
  const st = statusOf(row);
  if (st === 'Completed' || st === 'Applied') {
    return (
      <>
        <Box>Completed{row.completedBy?.name ? ` by ${row.completedBy.name}` : ''}</Box>
        {row.completedAt && <Box>{ago(row.completedAt)}</Box>}
      </>
    );
  }
  return st;
};

export default function Stocktakes() {
  const navigate = useNavigate();
  const { confirm, notify } = useAppDialogs();
  const { outlets, selectedOutletId } = useSelectedOutlet();
  const placeholderColor = useTheme().palette.mode === 'dark' ? '#757575' : '#808080';

  const [status, setStatus] = useState('');
  const [created, setCreated] = useState({ startDate: null, endDate: null });
  const [completed, setCompleted] = useState({ startDate: null, endDate: null });
  const [outletFilter, setOutletFilter] = useState('');

  // Header rule (16/10/2026): in-page Outlet filter hidden when a header outlet is selected.
  const { showOutletFilter } = useHeaderScope();
  useEffect(() => {
    if (!showOutletFilter && outletFilter) setOutletFilter('');
  }, [showOutletFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Renders from IndexedDB first, then revalidates in the background.
  const { data: allStocktakes, refresh: refreshStocktakes } = usePageCache(
    'stocktakes',
    () =>
      stocktakeService
        .getStocktakes({
          page: 1,
          limit: 200,
          // Reference scopes by the globally selected outlet
          ...(selectedOutletId ? { outletId: selectedOutletId } : {}),
        })
        .then((r) => r.stocktakes || []),
    { deps: [selectedOutletId] }
  );

  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newOutletId, setNewOutletId] = useState('');
  const [displayExpected, setDisplayExpected] = useState(false);

  // Live filtering: reference applies filters immediately (no Filter button).
  // Status and date ranges narrow the cached list locally — no round trip.
  const rows = useMemo(() => {
    const within = (value, range) => {
      if (!range.startDate && !range.endDate) return true;
      if (!value) return false;
      // The browser's calendar day, like the reference's date filters
      // (checked 30/10/2026); only the shown times use the store's zone.
      const day = format(new Date(value), 'yyyy-MM-dd');
      if (range.startDate && day < format(range.startDate, 'yyyy-MM-dd')) return false;
      if (range.endDate && day > format(range.endDate, 'yyyy-MM-dd')) return false;
      return true;
    };
    return allStocktakes.filter(
      (r) =>
        (!status || statusOf(r) === status) &&
        (!outletFilter ||
          String(r.outlet?.id ?? r.outletId ?? '') === String(outletFilter)) &&
        within(r.createdAt, created) &&
        within(r.completedAt, completed)
    );
  }, [allStocktakes, status, outletFilter, created, completed]);

  const handleExpress = () => navigate('/stock-management/stocktakes/express');
  const handleExternal = () => navigate('/stock-management/external-stocktake');
  const handleAdvanced = () => {
    // Navbar outlet set → the stocktake belongs to it (no Outlet select);
    // All Outlets → the user must pick one.
    setNewOutletId(selectedOutletId || '');
    setNewDialogOpen(true);
  };

  // Same "dd/mm/yyyy, HH:mm:ss" as before, in the store's zone (Setup >
  // General > Timezone) instead of the browser's.
  const formatDate = (value) => {
    const text = formatAppDateTime(value);
    return text ? text.replace(' ', ', ') : '';
  };

  // One request per click: a double-click (or Enter + click) on Continue used
  // to create the same stocktake twice. The ref blocks the second call before
  // React has re-rendered the disabled button.
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const createAndOpenAdvanced = async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    try {
      if (!newName.trim()) return;
      const outletIdInt = parseInt(selectedOutletId || newOutletId, 10);
      // Only send a valid outlet id (prevents accidentally persisting `0`)
      const payload = { name: newName.trim(), displayExpected };
      if (outletIdInt && !Number.isNaN(outletIdInt)) payload.outletId = outletIdInt;

      const { stocktake } = await stocktakeService.createStocktake(payload);
      setNewDialogOpen(false);
      setNewName('');
      setDisplayExpected(false);
      // Refresh list
      await refreshStocktakes();
      navigate(`/stock-management/stocktakes/advanced?id=${stocktake.id}`);
    } catch {
      // keep dialog open if failed
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };

  const continueStocktake = (id) => {
    navigate(`/stock-management/stocktakes/advanced?id=${id}`);
  };

  const cancelStocktake = async (row) => {
    const ok = await confirm(`Are you sure you wish to cancel "${row.name}"? Its counts will not be applied.`, { title: 'Cancel Stocktake' });
    if (!ok) return;
    try {
      await stocktakeService.updateStocktake(row.id, { status: 'Cancelled' });
      await refreshStocktakes();
    } catch (err) {
      // Used to be swallowed: the button looked dead while the server said 400.
      notify(err?.response?.data?.error || 'The stocktake could not be cancelled', 'error');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Actions — reference order: Advanced (primary), Express (outlined), External (outlined) */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          Stocktakes
        </Typography>
        <Button startIcon={<CalculateOutlined />} variant="contained" sx={primaryButtonSx} onClick={handleAdvanced}>
          Advanced Stocktake
        </Button>
        <Button startIcon={<Assignment />} variant="outlined" sx={outlinedButtonSx} onClick={handleExpress}>
          Express Stocktake
        </Button>
        <Button startIcon={<GridViewOutlined />} variant="outlined" sx={outlinedButtonSx} onClick={handleExternal}>
          External Stocktakes
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        {/* Live results counter */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: byMode('#000', DK_TEXT) }}>
            {rows.length}
          </Typography>
          <Typography sx={{ fontSize: 13, color: byMode('#676b72', DK_TEXT) }}>Results</Typography>
        </Box>
      </Stack>

      {/* Filters — single row directly on the page background, apply live */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <SectionLabel>Status</SectionLabel>
          <FormControl fullWidth size="small">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              displayEmpty
              input={<OutlinedInput />}
              IconComponent={ArrowDropDown}
              renderValue={(selected) =>
                selected ? selected : <span style={{ color: placeholderColor }}>Select...</span>
              }
              endAdornment={
                status ? (
                  <InputAdornment position="end" sx={{ mr: 2 }}>
                    <IconButton
                      size="small"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => setStatus('')}
                    >
                      <Close fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null
              }
              MenuProps={selectMenuProps}
              sx={selectSx}
            >
              <MenuItem value="In Progress" sx={menuItemSx}>In Progress</MenuItem>
              <MenuItem value="Completed" sx={menuItemSx}>Completed</MenuItem>
              <MenuItem value="Cancelled" sx={menuItemSx}>Cancelled</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <SectionLabel>Created Between</SectionLabel>
          <DateRangePicker
            label=""
            value={created}
            onChange={(range) => setCreated({ startDate: range.startDate, endDate: range.endDate })}
            allowEmpty
            placeholder="DD/MM/YYYY — DD/MM/YYYY"
            inputSx={inputSx}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <SectionLabel>Completed Between</SectionLabel>
          <DateRangePicker
            label=""
            value={completed}
            onChange={(range) => setCompleted({ startDate: range.startDate, endDate: range.endDate })}
            allowEmpty
            placeholder="DD/MM/YYYY — DD/MM/YYYY"
            inputSx={inputSx}
          />
        </Grid>

        {/* Header rule (16/10/2026): hidden when a header outlet is selected, not removed */}
        {showOutletFilter && (
        <Grid item xs={12} sm={6} md={3}>
          <SectionLabel>Outlets</SectionLabel>
          <FormControl fullWidth size="small">
            <Select
              value={outletFilter}
              onChange={(e) => setOutletFilter(e.target.value)}
              displayEmpty
              input={<OutlinedInput />}
              IconComponent={ArrowDropDown}
              renderValue={(selected) =>
                outlets.find((o) => String(o.id) === String(selected))?.name || (
                  <span style={{ color: placeholderColor }}>Select...</span>
                )
              }
              endAdornment={
                outletFilter ? (
                  <InputAdornment position="end" sx={{ mr: 2 }}>
                    <IconButton
                      size="small"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => setOutletFilter('')}
                    >
                      <Close fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null
              }
              MenuProps={selectMenuProps}
              sx={selectSx}
            >
              {outlets.map((o) => (
                <MenuItem key={o.id} value={o.id} sx={menuItemSx}>{o.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        )}
      </Grid>

      {/* Table - reference hides it entirely when the filters match nothing */}
      {rows.length === 0 ? (
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ py: 6, color: byMode('#676b72', '#a0a4aa') }}>
          <SearchGlyph />
          <Typography sx={{ fontSize: 19, color: byMode('#676b72', '#a0a4aa') }}>No results found. Try changing the search filters</Typography>
        </Stack>
      ) : (
      <TableContainer>
        <Table size="medium" sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <TableHead>
            <TableRow
              sx={{
                '& th': { bgcolor: byMode('#5ebbeb', '#333333'), color: byMode('white', '#5ebbeb'), fontWeight: 700, fontSize: 16, border: 0, height: 51, py: 0 },
                '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
                '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' },
              }}
            >
              {/* Outlet column only in All Outlets mode (navbar outlet set → list is already that outlet's) */}
              {['Name', ...(showOutletFilter ? ['Outlet'] : []), 'Created', 'Status', 'Applied', 'Actions'].map((h) => (
                <TableCell key={h}>
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody
            sx={{
              '& tr:nth-of-type(odd)': { bgcolor: byMode('#ffffff', '#232323') },
              '& tr:nth-of-type(even)': { bgcolor: byMode('#f5f5f5', '#232323') },
              '& td': { border: 0, fontSize: 16, color: byMode('#000', DK_TEXT), py: 1.5 },
            }}
          >
            {rows.map((r) => (
              <TableRow key={r.id}>
                {/* Reference: a nameless stocktake reads "Not named" in grey */}
                <TableCell sx={r.name ? undefined : { color: byMode('#808080 !important', '#a0a4aa !important') }}>{r.name || 'Not named'}</TableCell>
                {showOutletFilter && <TableCell>{r.outlet?.name || r.outlet || ''}</TableCell>}
                <TableCell>{formatDate(r.createdAt)}</TableCell>
                <TableCell><StatusCell row={r} /></TableCell>
                <TableCell>{formatDate(r.appliedAt)}</TableCell>
                <TableCell>
                  {['Completed', 'Applied'].includes(statusOf(r)) && (
                    <Button
                      size="small"
                      startIcon={<VisibilityOutlined />}
                      component={RouterLink} to={`/stock-management/stocktakes/${r.id}`}
                      sx={{ color: byMode('#0284c7', '#5ebbeb'), textTransform: 'none', fontWeight: 700, fontSize: 16, minWidth: 0 }}
                    >
                      View
                    </Button>
                  )}
                  {statusOf(r) === 'In Progress' && (
                    <Stack direction="row" spacing={1}>
                      <Button size="small" onClick={() => continueStocktake(r.id)} sx={{ color: byMode('#16a34a', '#7bf1a8'), textTransform: 'none', fontWeight: 700, fontSize: 16, minWidth: 0 }}>Continue</Button>
                      <Button size="small" onClick={() => cancelStocktake(r)} sx={{ color: byMode('#dc2626', '#ffa2a2'), textTransform: 'none', fontWeight: 700, fontSize: 16, minWidth: 0 }}>Cancel</Button>
                    </Stack>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      )}

      {/* New Stocktake Dialog — reference: 316px, radius 8, light-blue header bar */}
      <Dialog
        open={newDialogOpen}
        onClose={() => setNewDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: '8px', width: 316 } }}
      >
        <Box
          sx={{
            bgcolor: byMode('rgb(190,227,248)', '#024a70'),
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1.25,
          }}
        >
          <HelpOutline sx={{ color: byMode('rgb(38,99,143)', '#00a6f4'), fontSize: 20 }} />
          <Typography sx={{ color: byMode('rgb(38,99,143)', '#00a6f4'), fontSize: 18, fontWeight: 700 }}>
            New Stocktake
          </Typography>
        </Box>
        <Box sx={{ px: 2, py: 2 }}>
          <Stack spacing={2}>
            <Box>
              <SectionLabel>Name</SectionLabel>
              <TextField
                fullWidth
                size="small"
                placeholder="Stocktake Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    fontSize: 16,
                    bgcolor: byMode(undefined, '#121212'),
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#404040', '#a1a1a1'), borderWidth: '1px' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#404040', '#a1a1a1'), borderWidth: '1px' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#000', '#2b7fff'), borderWidth: '2px' },
                  },
                  '& input::placeholder': { color: byMode(undefined, '#757575'), opacity: byMode(undefined, 1) },
                }}
              />
            </Box>
            {!selectedOutletId && (
            <Box>
              <SectionLabel>Outlet</SectionLabel>
              <FormControl fullWidth size="small">
                <Select
                  value={newOutletId}
                  onChange={(e) => setNewOutletId(e.target.value)}
                  input={<OutlinedInput />}
                  IconComponent={ArrowDropDown}
                  MenuProps={selectMenuProps}
                  sx={selectSx}
                  displayEmpty
                  renderValue={(v) => outlets.find((o) => String(o.id) === String(v))?.name || (
                    <Box component="span" sx={{ color: byMode('#808080', '#757575') }}>Select outlet...</Box>
                  )}
                >
                  {outlets.map((o) => (
                    <MenuItem key={o.id} value={o.id} sx={menuItemSx}>{o.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            )}
            <Stack direction="row" alignItems="center" spacing={1}>
              <ShopfrontSwitch checked={displayExpected} onChange={(e) => setDisplayExpected(e.target.checked)} />
              <Typography variant="body2" sx={{ fontSize: 16 }}>Display expected</Typography>
            </Stack>
          </Stack>
        </Box>
        <Stack direction="row" justifyContent="flex-end" spacing={1.5} sx={{ px: 2, pb: 2 }}>
          <Button
            onClick={() => setNewDialogOpen(false)}
            sx={{
              bgcolor: byMode('#d9d9d9', '#3a3a3a'),
              color: byMode('#000', DK_TEXT),
              '&:hover': { bgcolor: byMode('#c9c9c9', '#4a4a4a'), boxShadow: 'none' },
              borderRadius: '12px',
              textTransform: 'none',
              boxShadow: 'none',
              fontWeight: 700,
              fontSize: 16,
              width: 134,
              height: 42,
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={createAndOpenAdvanced}
            disabled={creating || !newName.trim() || !(selectedOutletId || newOutletId)}
            sx={{
              bgcolor: '#5ebbeb',
              color: byMode('#fff', DK_ON_BLUE),
              '&:hover': { bgcolor: '#79c7ef', boxShadow: 'none' },
              '&.Mui-disabled': { bgcolor: byMode(undefined, '#3a3a3a'), color: byMode(undefined, '#757575') },
              borderRadius: '12px',
              textTransform: 'none',
              boxShadow: 'none',
              fontWeight: 700,
              fontSize: 16,
              width: 134,
              height: 42,
            }}
          >
            Continue
          </Button>
        </Stack>
      </Dialog>
    </Box>
  );
}
