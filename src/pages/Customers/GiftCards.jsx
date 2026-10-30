import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  InputAdornment,
  IconButton,
  MenuItem,
  Select,
  FormControl,
  Snackbar,
  CircularProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  Check as CheckIcon,
  UploadFileOutlined as ImportIcon,
  FileOpenOutlined as ExportIcon,
  FindInPageOutlined as FindIcon,
  KeyboardArrowDown as ArrowDropDownIcon,
  CloseOutlined as CloseIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import giftCardService from '../../services/giftCardService';
import usePageCache from '../../hooks/usePageCache';
import outletService from '../../services/outletService';
import { useAuth } from '../../contexts/AuthContext';
import useHeaderScope from '../../hooks/useHeaderScope';

// Reference (live Shopfront, 30/10/2026): "Gift Cards" title with Import (blue)
// and Export (outlined) beside it, Search box, Outlet + Status filters on one
// row, rounded blue table with a blue totals footer, "No results found" state.

const STATUS_OPTIONS = ['Current', 'Expired', 'Redeemed'];

const fieldSx = {
  bgcolor: '#fff',
  fontSize: 16,
  '& .MuiOutlinedInput-root, &.MuiOutlinedInput-root': { height: 42, borderRadius: '8px', fontSize: 16 },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline, & .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
  '& .MuiSelect-icon': { color: '#404040' },
};

// Reference dropdown: white rounded panel, hovered row blue, selected row blue text.
const menuProps = {
  PaperProps: {
    sx: {
      mt: 0.5,
      borderRadius: '8px',
      border: '1px solid #000',
      boxShadow: 'none',
      '& .MuiMenuItem-root': { fontSize: 16, color: '#000', py: 1.75, gap: 1.5, '&:hover': { bgcolor: '#5ebbeb' } },
      '& .MuiMenuItem-root.Mui-selected': { bgcolor: 'transparent', color: '#1c9cf0' },
      '& .MuiMenuItem-root.Mui-selected:hover': { bgcolor: '#5ebbeb', color: '#000' },
    },
  },
};

const labelSx = { fontSize: 16, color: '#000', mb: 0.5, display: 'block' };

const headerButtonSx = {
  height: 42,
  px: 3,
  borderRadius: '8px',
  fontSize: 16,
  fontWeight: 700,
  textTransform: 'none',
  boxShadow: 'none',
  whiteSpace: 'nowrap',
  transition: 'background 0.2s ease, color 0.2s ease',
};

const money = (v) => `$${(Number(v) || 0).toFixed(2)}`;
const pad = (n) => String(n).padStart(2, '0');

const GiftCards = () => {
  const navigate = useNavigate();
  const { isTrueSuperAdmin, getOutletId, getOutletName } = useAuth();
  // Renders from IndexedDB first, then revalidates in the background.
  // showRedeemedExpired is either/or on the API (true returns ONLY the
  // redeemed/expired set), so cache both halves and filter locally.
  const { data: giftCards, loading } = usePageCache('giftCards', () =>
    Promise.all([
      giftCardService.getGiftCards({ showRedeemedExpired: false, limit: 1000 }),
      giftCardService.getGiftCards({ showRedeemedExpired: true, limit: 1000 }),
    ]).then(([active, past]) =>
      Array.from(
        new Map(
          [...(active.giftCards || []), ...(past.giftCards || [])].map((c) => [c.id, c])
        ).values()
      )
    )
  );
  const [searchTerm, setSearchTerm] = useState('');
  // Reference: Status multi-select, all three chips selected by default
  // (shown in the order Redeemed, Expired, Current).
  const [statusFilter, setStatusFilter] = useState(['Redeemed', 'Expired', 'Current']);
  const [selectedOutlet, setSelectedOutlet] = useState('');
  const [outlets, setOutlets] = useState([]);
  const [loadingOutlets, setLoadingOutlets] = useState(false);
  // Reference: green-tab toast "Successfully exported gift cards" at the top.
  const [toast, setToast] = useState('');

  // Outlet rule: in-page Outlet filter only on All Outlets (hidden when the
  // header carries an outlet - the list is already that outlet's).
  const { showOutletFilter } = useHeaderScope();
  const outletFilterVisible = isTrueSuperAdmin() && showOutletFilter;
  useEffect(() => {
    if (!showOutletFilter && selectedOutlet) setSelectedOutlet('');
  }, [showOutletFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const loadOutlets = async () => {
      if (isTrueSuperAdmin()) {
        setLoadingOutlets(true);
        try {
          const response = await outletService.getAllOutlets();
          setOutlets(response.outlets || []);
          setSelectedOutlet('');
        } catch (error) {
          console.error('Error loading outlets:', error);
          setOutlets([]);
        } finally {
          setLoadingOutlets(false);
        }
      } else {
        const outletId = getOutletId();
        if (outletId) setSelectedOutlet(outletId.toString());
      }
    };
    loadOutlets();
  }, [isTrueSuperAdmin, getOutletId]);

  const handleImport = () => navigate('/customers/gift-cards/import');

  // Guarantee the active outlet is always offered even when getAllOutlets()
  // returns an empty/partial list.
  const outletOptions = useMemo(() => {
    const list = [...outlets];
    const activeId = getOutletId();
    const activeName = getOutletName();
    if (activeId && activeName && !list.some((o) => o.id?.toString() === activeId.toString())) {
      list.push({ id: activeId, name: activeName });
    }
    return list;
  }, [outlets, getOutletId, getOutletName]);

  // Reference file name: "<store code>-YYYY-MM-DD_HH_mm_ss-gift_cards.csv"
  // (e.g. pmk-2026-10-30_16_32_00-gift_cards.csv).
  const handleExport = async () => {
    try {
      const blob = await giftCardService.exportGiftCards({
        showRedeemedExpired: !statusFilter.includes('Current'),
        outletId: selectedOutlet,
      });
      const d = new Date();
      const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}_${pad(d.getMinutes())}_${pad(d.getSeconds())}`;
      const current = outletOptions.find((o) => String(o.id) === String(selectedOutlet || getOutletId() || ''));
      const prefix = (current?.code || outletOptions[0]?.code || 'pos').toString().toLowerCase().replace(/[^a-z0-9]+/g, '');
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${prefix}-${stamp}-gift_cards.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setToast('Successfully exported gift cards');
    } catch (error) {
      console.error('Error exporting gift cards:', error);
    }
  };

  // Status / outlet / search all filter locally off the cached list.
  const cardStatus = (card) => {
    if (card.status === 'Redeemed' || (card.status === 'Active' && (card.balance ?? 0) <= 0)) return 'Redeemed';
    const expired = !!card.expiryDate && new Date(card.expiryDate) < new Date();
    if (card.status === 'Expired' || expired) return 'Expired';
    return 'Current';
  };
  const filteredGiftCards = giftCards.filter((card) => {
    if (statusFilter.length && !statusFilter.includes(cardStatus(card))) return false;
    if (selectedOutlet && String(card.outletId) !== String(selectedOutlet)) return false;
    const q = searchTerm.toLowerCase();
    if (!q) return true;
    return card.code?.toLowerCase().includes(q) || card.customerName?.toLowerCase().includes(q);
  });

  const totalOriginal = filteredGiftCards.reduce((sum, card) => sum + (Number(card.originalAmount) || 0), 0);
  const totalCurrent = filteredGiftCards.reduce((sum, card) => sum + (Number(card.balance) || 0), 0);

  const goToSale = (card) =>
    navigate('/register/history', { state: { giftCardFilter: card.code } });

  const formatExpiry = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  };

  return (
    <Box sx={{ p: 2, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Title + Import / Export on one row, Results on the right (reference) */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: '#000', m: 0, lineHeight: 1.2, mr: 2 }}>
            Gift Cards
          </Typography>
          <Button
            disableRipple
            onClick={handleImport}
            startIcon={<ImportIcon sx={{ fontSize: 18 }} />}
            sx={{ ...headerButtonSx, bgcolor: '#5ebbeb', color: '#fff', border: '1px solid #5ebbeb', '&:hover': { bgcolor: '#fff', color: '#5ebbeb' } }}
          >
            Import Gift Cards
          </Button>
          <Button
            disableRipple
            onClick={handleExport}
            startIcon={<ExportIcon sx={{ fontSize: 18 }} />}
            sx={{ ...headerButtonSx, bgcolor: '#fff', color: '#404040', border: '1px solid #9e9e9e', '&:hover': { bgcolor: '#f0f0f0' } }}
          >
            Export Gift Cards
          </Button>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: '19.2px', fontWeight: 400, color: '#000', lineHeight: 1.2 }}>
            {filteredGiftCards.length}
          </Typography>
          <Typography sx={{ fontSize: 16, fontWeight: 400, color: '#000' }}>Results</Typography>
        </Box>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 2 }}>
        <Typography component="label" htmlFor="gift-card-search" sx={labelSx}>Search</Typography>
        <TextField
          fullWidth
          id="gift-card-search"
          placeholder="Search Gift Card codes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            endAdornment: searchTerm ? (
              <InputAdornment position="end">
                <IconButton aria-label="Clear search" onClick={() => setSearchTerm('')} sx={{ width: 25, height: 24, p: 0, color: '#404040', borderRadius: 0, '&:hover': { bgcolor: 'transparent' } }}>
                  <CloseIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{
            ...fieldSx,
            '& .MuiOutlinedInput-input': { p: '8px 16px', '&::placeholder': { color: '#757575', opacity: 1 } },
          }}
        />
      </Box>

      {/* Outlet + Status on one row (Outlet only on All Outlets) */}
      <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
        {outletFilterVisible && (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography component="label" sx={labelSx}>Outlet</Typography>
            <FormControl fullWidth>
              <Select
                value={selectedOutlet}
                onChange={(e) => setSelectedOutlet(e.target.value)}
                disabled={loadingOutlets}
                displayEmpty
                IconComponent={ArrowDropDownIcon}
                renderValue={(value) =>
                  value
                    ? outletOptions.find((o) => o.id.toString() === value)?.name || ''
                    : <span style={{ color: '#808080' }}>Select...</span>
                }
                MenuProps={menuProps}
                sx={fieldSx}
                inputProps={{ 'aria-label': 'Outlet' }}
              >
                {selectedOutlet && <MenuItem value="">All Outlets</MenuItem>}
                {outletOptions.map((outlet) => (
                  <MenuItem key={outlet.id} value={outlet.id.toString()}>{outlet.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="label" sx={labelSx}>Status</Typography>
          <FormControl fullWidth>
            <Select
              multiple
              value={statusFilter}
              onChange={(e) => setStatusFilter(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
              displayEmpty
              IconComponent={ArrowDropDownIcon}
              renderValue={(selected) =>
                selected.length === 0
                  ? <span style={{ color: '#808080' }}>Select...</span>
                  : (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'nowrap', overflow: 'hidden' }}>
                      {selected.map((s) => (
                        <Box key={s} component="span" sx={{ bgcolor: 'rgba(0,0,0,0.1)', borderRadius: '4px', px: 1, fontSize: 16, lineHeight: '26px', color: '#000', whiteSpace: 'nowrap' }}>
                          {s}
                        </Box>
                      ))}
                    </Box>
                  )
              }
              MenuProps={menuProps}
              sx={{ ...fieldSx, '& .MuiSelect-select': { py: '8px', display: 'flex', alignItems: 'center' } }}
              inputProps={{ 'aria-label': 'Status' }}
            >
              {STATUS_OPTIONS.map((s) => {
                const on = statusFilter.includes(s);
                return (
                  <MenuItem key={s} value={s}>
                    <Box sx={{ width: 16, height: 16, flex: '0 0 16px', border: on ? '1px solid #1c9cf0' : '1px solid #000', bgcolor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {on && (
                        <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="#1c9cf0" />
                        </svg>
                      )}
                    </Box>
                    {s}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {loading ? null : filteredGiftCards.length === 0 ? (
        // reference: no table, just the centred search icon + message
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1.5, mt: 6, color: '#6b7280', fontSize: 20 }}>
          <SearchIcon sx={{ fontSize: 26 }} />
          No results found. Try changing the search filters
        </Box>
      ) : (
        <TableContainer>
          <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <TableHead>
              <TableRow
                sx={{
                  '& th': { bgcolor: '#5ebbeb', color: '#fff', fontWeight: 700, fontSize: 16, border: 0, height: 51, py: 0 },
                  '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
                  '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' },
                }}
              >
                <TableCell>Code</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Original Amount</TableCell>
                <TableCell>Current Amount</TableCell>
                <TableCell>Expiry</TableCell>
                <TableCell>Creation Source</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody
              sx={{
                '& tr:nth-of-type(odd)': { bgcolor: '#ffffff' },
                '& tr:nth-of-type(even)': { bgcolor: '#f5f5f5' },
                '& td': { border: 0, fontSize: 16, color: '#000', py: '20px' },
              }}
            >
              {filteredGiftCards.map((card) => (
                <TableRow key={card.id}>
                  <TableCell>{card.code}</TableCell>
                  <TableCell>{cardStatus(card)}</TableCell>
                  <TableCell>{money(card.originalAmount)}</TableCell>
                  <TableCell>{money(card.balance)}</TableCell>
                  <TableCell>{formatExpiry(card.expiryDate)}</TableCell>
                  <TableCell>
                    {card.saleId ? (
                      <Typography
                        component="span"
                        role="link"
                        tabIndex={0}
                        onClick={() => goToSale(card)}
                        onKeyDown={(e) => { if (e.key === 'Enter') goToSale(card); }}
                        sx={{ fontSize: 16, color: '#000', textDecoration: 'underline', cursor: 'pointer' }}
                      >
                        {card.creationSource}
                      </Typography>
                    ) : 'Unknown'}
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      disableRipple
                      startIcon={<FindIcon />}
                      onClick={() => goToSale(card)}
                      sx={{ color: '#1c86f2', textTransform: 'none', fontWeight: 700, fontSize: 16, minWidth: 0, whiteSpace: 'nowrap', '&:hover': { bgcolor: 'transparent' } }}
                    >
                      Find in Sales History
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            {/* Reference footer: blue rounded row with the two amount totals */}
            <TableBody>
              <TableRow
                sx={{
                  '& td': { bgcolor: '#5ebbeb', color: '#fff', fontWeight: 700, fontSize: 16, border: 0, height: 51, py: 0 },
                  '& td:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
                  '& td:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' },
                }}
              >
                <TableCell />
                <TableCell />
                <TableCell>{money(totalOriginal)}</TableCell>
                <TableCell>{money(totalCurrent)}</TableCell>
                <TableCell />
                <TableCell />
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Reference toast: white card, green check tab on the left, spinner on the right */}
      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: '#fff', borderRadius: '4px', boxShadow: '0 4px 14px rgba(0,0,0,0.25)', overflow: 'hidden', height: 52 }}>
          <Box sx={{ width: 52, height: '100%', bgcolor: '#86efac', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckIcon sx={{ color: '#15803d', fontSize: 22 }} />
          </Box>
          <Typography sx={{ fontSize: 16, color: '#000', px: 2 }}>{toast}</Typography>
          <CircularProgress size={22} thickness={3} sx={{ color: '#9ca3af', mr: 2 }} />
        </Box>
      </Snackbar>
    </Box>
  );
};

export default GiftCards;
