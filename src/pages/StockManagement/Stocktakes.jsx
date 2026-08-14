import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { format } from 'date-fns';
import stocktakeService from '../../services/stocktakeService';
import usePageCache from '../../hooks/usePageCache';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import DateRangePicker from '../../components/Common/DateRangePicker';

const primaryButtonSx = {
  bgcolor: '#5ebbeb',
  color: '#fff',
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
  color: '#6f6f6f',
  border: '1px solid #8c8c8c',
  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)', border: '1px solid #8c8c8c', boxShadow: 'none' },
  borderRadius: '12px',
  textTransform: 'none',
  boxShadow: 'none',
  fontWeight: 700,
  fontSize: 16,
  px: 4,
  height: 42,
};

const SectionLabel = ({ children }) => (
  <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 400, fontSize: 16, color: '#000' }}>
    {children}
  </Typography>
);

// Match Shopfront: dark-gray outlined border, turns solid black on focus
const inputSx = {
  backgroundColor: 'white',
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    fontSize: 16,
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' },
  },
};

// Sky-blue hover for select dropdown options
const menuItemSx = {
  fontSize: 16,
  color: '#000',
  '&:hover': { bgcolor: '#5ebbeb' },
  '&.Mui-selected': { bgcolor: 'transparent' },
  '&.Mui-selected:hover': { bgcolor: '#5ebbeb' },
  '&.Mui-focusVisible': { bgcolor: '#5ebbeb' },
};

const selectSx = {
  backgroundColor: 'white',
  borderRadius: '8px',
  fontSize: 16,
  height: 41,
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' },
  '& .MuiSelect-icon': { color: '#404040' },
};

const selectMenuProps = {
  PaperProps: {
    sx: {
      mt: 0.5,
      borderRadius: '8px',
      border: '1px solid #e0e0e0',
      boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
      '& .MuiList-root': { py: 0.5 },
    },
  },
};

export default function Stocktakes() {
  const navigate = useNavigate();
  const { outlets, selectedOutletId } = useSelectedOutlet();

  const [status, setStatus] = useState('');
  const [created, setCreated] = useState({ startDate: null, endDate: null });
  const [completed, setCompleted] = useState({ startDate: null, endDate: null });

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
      const day = format(new Date(value), 'yyyy-MM-dd');
      if (range.startDate && day < format(range.startDate, 'yyyy-MM-dd')) return false;
      if (range.endDate && day > format(range.endDate, 'yyyy-MM-dd')) return false;
      return true;
    };
    return allStocktakes.filter(
      (r) =>
        (!status || r.status === status) &&
        within(r.createdAt, created) &&
        within(r.completedAt, completed)
    );
  }, [allStocktakes, status, created, completed]);

  const handleExpress = () => navigate('/stock-management/stocktakes/express');
  const handleExternal = () => navigate('/stock-management/external-stocktake');
  const handleAdvanced = () => {
    setNewOutletId(selectedOutletId || outlets[0]?.id || '');
    setNewDialogOpen(true);
  };

  const formatDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    return date.toLocaleString('en-GB');
  };

  const createAndOpenAdvanced = async () => {
    try {
      if (!newName.trim()) return;
      const outletIdInt = parseInt(newOutletId, 10);
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
    }
  };

  const continueStocktake = (id) => {
    navigate(`/stock-management/stocktakes/advanced?id=${id}`);
  };

  const cancelStocktake = async (id) => {
    try {
      await stocktakeService.updateStocktake(id, { status: 'Cancelled' });
      await refreshStocktakes();
    } catch {
      // ignore
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
          <Typography sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: '#000' }}>
            {rows.length}
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#676b72' }}>Results</Typography>
        </Box>
      </Stack>

      {/* Filters — single row directly on the page background, apply live */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={4} md={3.5}>
          <SectionLabel>Status</SectionLabel>
          <FormControl fullWidth size="small">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              displayEmpty
              input={<OutlinedInput />}
              IconComponent={ArrowDropDown}
              renderValue={(selected) =>
                selected ? selected : <span style={{ color: '#808080' }}>Select...</span>
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

        <Grid item xs={12} sm={4} md={4.25}>
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

        <Grid item xs={12} sm={4} md={4.25}>
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
      </Grid>

      {/* Table */}
      <TableContainer>
        <Table size="medium" sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <TableHead>
            <TableRow
              sx={{
                '& th': { bgcolor: '#5ebbeb', color: 'white', fontWeight: 700, fontSize: 16, border: 0, height: 51, py: 0 },
                '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
                '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' },
              }}
            >
              {['Name', 'Outlet', 'Created', 'Status', 'Completed', 'Applied', 'Actions'].map((h) => (
                <TableCell key={h}>
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody
            sx={{
              '& tr:nth-of-type(odd)': { bgcolor: '#ffffff' },
              '& tr:nth-of-type(even)': { bgcolor: '#f5f5f5' },
              '& td': { border: 0, fontSize: 16, color: '#000', py: 1.5 },
            }}
          >
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.outlet?.name || r.outlet || ''}</TableCell>
                <TableCell>{formatDate(r.createdAt)}</TableCell>
                <TableCell>{r.status}{r.completedBy?.name ? ` by ${r.completedBy.name}` : ''}</TableCell>
                <TableCell>{formatDate(r.completedAt)}</TableCell>
                <TableCell>{formatDate(r.appliedAt)}</TableCell>
                <TableCell>
                  {String(r.status || '').toLowerCase().startsWith('completed') && (
                    <Button
                      size="small"
                      startIcon={<VisibilityOutlined />}
                      onClick={() => navigate(`/stock-management/stocktakes/${r.id}`)}
                      sx={{ color: '#0284c7', textTransform: 'none', fontWeight: 700, fontSize: 16, minWidth: 0 }}
                    >
                      View
                    </Button>
                  )}
                  {String(r.status || '') === 'In Progress' && (
                    <Stack direction="row" spacing={1}>
                      <Button size="small" onClick={() => continueStocktake(r.id)} sx={{ color: '#16a34a', textTransform: 'none', fontWeight: 700, fontSize: 16, minWidth: 0 }}>Continue</Button>
                      <Button size="small" onClick={() => cancelStocktake(r.id)} sx={{ color: '#dc2626', textTransform: 'none', fontWeight: 700, fontSize: 16, minWidth: 0 }}>Cancel</Button>
                    </Stack>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* New Stocktake Dialog — reference: 316px, radius 8, light-blue header bar */}
      <Dialog
        open={newDialogOpen}
        onClose={() => setNewDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: '8px', width: 316 } }}
      >
        <Box
          sx={{
            bgcolor: 'rgb(190,227,248)',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1.25,
          }}
        >
          <HelpOutline sx={{ color: 'rgb(38,99,143)', fontSize: 20 }} />
          <Typography sx={{ color: 'rgb(38,99,143)', fontSize: 18, fontWeight: 700 }}>
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
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
                  },
                }}
              />
            </Box>
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
                >
                  {outlets.map((o) => (
                    <MenuItem key={o.id} value={o.id} sx={menuItemSx}>{o.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
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
              bgcolor: '#d9d9d9',
              color: '#000',
              '&:hover': { bgcolor: '#c9c9c9', boxShadow: 'none' },
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
            sx={{
              bgcolor: '#5ebbeb',
              color: '#fff',
              '&:hover': { bgcolor: '#79c7ef', boxShadow: 'none' },
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
