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
  Chip,
  IconButton,
  MenuItem,
  CircularProgress,
  Select,
  FormControl,
} from '@mui/material';
import {
  Search as SearchIcon,
  UploadFileOutlined as ImportIcon,
  FileOpenOutlined as ExportIcon,
  ArrowDropDown as ArrowDropDownIcon,
  KeyboardArrowDown as ChevronDownIcon,
  KeyboardArrowUp as ChevronUpIcon,
  Code as CodeIcon,
  CloseOutlined as CloseIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import giftCardService from '../../services/giftCardService';
import usePageCache from '../../hooks/usePageCache';
import outletService from '../../services/outletService';
import { useAuth } from '../../contexts/AuthContext';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';

const GiftCards = () => {
  const navigate = useNavigate();
  const { isSuperAdmin, getOutletId, getOutletName } = useAuth();
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
  const [showRedeemedExpired, setShowRedeemedExpired] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState('');
  const [functionsOpen, setFunctionsOpen] = useState(false);
  const [outlets, setOutlets] = useState([]);
  const [loadingOutlets, setLoadingOutlets] = useState(false);

  // Load outlets if super admin
  useEffect(() => {
    const loadOutlets = async () => {
      if (isSuperAdmin()) {
        setLoadingOutlets(true);
        try {
          const response = await outletService.getAllOutlets();
          const fetchedOutlets = response.outlets || [];
          setOutlets(fetchedOutlets);
          // Set '' as default for "All Outlets"
          setSelectedOutlet('');
        } catch (error) {
          console.error('Error loading outlets:', error);
          setOutlets([]);
        } finally {
          setLoadingOutlets(false);
        }
      } else {
        // Regular user - set their outlet
        const outletId = getOutletId();
        if (outletId) {
          setSelectedOutlet(outletId.toString());
        }
      }
    };

    loadOutlets();
  }, [isSuperAdmin, getOutletId]);

  // Functions tray is an inline disclosure: Esc closes it (the tab itself toggles).
  useEffect(() => {
    if (!functionsOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setFunctionsOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [functionsOpen]);

  const handleImport = () => {
    setFunctionsOpen(false);
    navigate('/customers/gift-cards/import');
  };

  const handleExport = async () => {
    setFunctionsOpen(false);
    try {
      const blob = await giftCardService.exportGiftCards({
        showRedeemedExpired,
        outletId: selectedOutlet
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `gift_cards_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting gift cards:', error);
    }
  };

  // Reference react-select lists the real outlet (e.g. 'Top Drops Rossmore') as a
  // selectable option. Guarantee the active outlet is always offered even when the
  // getAllOutlets() fetch returns an empty/partial list.
  const outletOptions = useMemo(() => {
    const list = [...outlets];
    const activeId = getOutletId();
    const activeName = getOutletName();
    if (activeId && activeName && !list.some((o) => o.id?.toString() === activeId.toString())) {
      list.push({ id: activeId, name: activeName });
    }
    return list;
  }, [outlets, getOutletId, getOutletName]);

  // Status / outlet / search all filter locally off the cached list — the API is
  // only hit by the background sync, never per keystroke or toggle.
  const filteredGiftCards = giftCards.filter((card) => {
    // Mirrors the API's either/or split: the toggle shows redeemed/expired cards
    // INSTEAD of the live ones, not in addition to them.
    const expired = !!card.expiryDate && new Date(card.expiryDate) < new Date();
    const isPast =
      card.status === 'Expired' ||
      card.status === 'Redeemed' ||
      (card.status === 'Active' && expired);
    if (showRedeemedExpired ? !isPast : isPast || card.status !== 'Active') return false;
    if (selectedOutlet && String(card.outletId) !== String(selectedOutlet)) return false;
    const q = searchTerm.toLowerCase();
    if (!q) return true;
    return (
      card.code?.toLowerCase().includes(q) ||
      card.customerName?.toLowerCase().includes(q)
    );
  });

  // Shopfront reference: flat bordered tray buttons, no hover state at all.
  const trayButtonSx = {
    height: 47,
    px: 1,
    py: 0.5,
    bgcolor: '#e5e7eb',
    color: '#000',
    border: '1px solid #000',
    borderRadius: 0,
    fontSize: 24,
    fontWeight: 400,
    textTransform: 'none',
    whiteSpace: 'nowrap',
    boxShadow: 'none',
    transition: 'background 0.2s ease, color 0.2s ease',
    '&:hover': { bgcolor: '#e5e7eb', boxShadow: 'none' },
  };

  const EmptyState = () => (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 12,
        textAlign: 'center',
      }}
    >
      {/* Outlined sad face with eyebrows + a teardrop, matching the Shopfront empty-state icon */}
      <Box
        component="svg"
        viewBox="0 0 64 64"
        sx={{ width: 120, height: 120, mb: 3, color: '#000' }}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="32" cy="32" r="24" />
        {/* eyebrows */}
        <path d="M20 22 l6 3" />
        <path d="M44 22 l-6 3" />
        {/* eyes */}
        <circle cx="24" cy="30" r="1.6" fill="currentColor" stroke="none" />
        <circle cx="40" cy="30" r="1.6" fill="currentColor" stroke="none" />
        {/* frown mouth */}
        <path d="M24 44 q8 -8 16 0" />
        {/* teardrop */}
        <path d="M24 34 q-3 5 0 7 q3 -2 0 -7 z" fill="currentColor" stroke="none" />
      </Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
        No Results Found
      </Typography>
      <Typography variant="body1" color="text.secondary">
        It&apos;s always in the last place you look
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ px: 2, py: 2, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Results count (left) + Functions tab (right) - no page heading on the reference */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 0, py: 1 }}>
        <Box>
          <Typography sx={{ fontSize: '19.2px', fontWeight: 400, color: '#000', lineHeight: 1.2 }}>
            {filteredGiftCards.length}
          </Typography>
          <Typography sx={{ fontSize: 16, fontWeight: 400, color: '#000' }}>
            Results
          </Typography>
        </Box>
        <Button
          disableRipple
          onClick={() => setFunctionsOpen((open) => !open)}
          aria-expanded={functionsOpen}
          startIcon={functionsOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
          sx={{
            width: 188,
            height: 46,
            px: 1,
            bgcolor: '#f8f8f8',
            color: '#000',
            borderRadius: 0,
            boxShadow: '0 4px 8px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08)',
            fontSize: 24,
            fontWeight: 400,
            textTransform: 'none',
            whiteSpace: 'nowrap',
            '&:hover': {
              bgcolor: '#f8f8f8',
              boxShadow: '0 4px 8px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08)',
            },
          }}
        >
          <CodeIcon sx={{ mr: 0.5 }} />
          Functions
        </Button>
      </Box>

      {/* Functions tray - slides down from behind the row above */}
      <Box sx={{ overflow: 'hidden', height: functionsOpen ? 80 : 0, transition: 'height 0.2s ease' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            height: 80,
            p: 2,
            bgcolor: '#f8f8f8',
            transform: functionsOpen ? 'translateY(0)' : 'translateY(-80px)',
            transition: 'transform 0.2s ease, box-shadow 0.4s ease',
            boxShadow: functionsOpen ? '0 4px 8px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          <Button disableRipple onClick={handleImport} startIcon={<ImportIcon />} sx={{ ...trayButtonSx, mr: 2 }}>
            Import Gift Cards
          </Button>
          <Button disableRipple onClick={handleExport} startIcon={<ExportIcon />} sx={trayButtonSx}>
            Export Gift Cards
          </Button>
        </Box>
      </Box>

      {/* Search + Redeemed/Expired toggle: one joined bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <TextField
          fullWidth
          placeholder="Search of Gift Card Codes"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            endAdornment: searchTerm ? (
              <InputAdornment position="end">
                <IconButton
                  aria-label="Clear search"
                  onClick={() => setSearchTerm('')}
                  sx={{
                    width: 25,
                    height: 24,
                    p: 0,
                    color: '#404040',
                    borderRadius: '8px',
                    '&:hover': { bgcolor: 'transparent' },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              height: 42,
              pl: 2,
              pr: 1,
              bgcolor: 'white',
              // Right corners square: the toggle box is fused onto this edge
              borderRadius: '8px 0px 0px 8px',
              fontSize: 16,
              // Match Shopfront: dark-gray border, turns solid black on focus/click
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' },
            },
            '& .MuiOutlinedInput-input': { p: 0 },
          }}
        />
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexShrink: 0,
            width: 232,
            height: 42,
            px: 2,
            bgcolor: 'white',
            border: '1px solid #000',
            borderLeft: 0,
            borderRadius: '0px 8px 8px 0px',
          }}
        >
          <ShopfrontSwitch
            checked={showRedeemedExpired}
            onChange={(e) => setShowRedeemedExpired(e.target.checked)}
            inputProps={{ 'aria-label': 'Redeemed / Expired' }}
          />
          <Typography sx={{ fontSize: 16, fontWeight: 400, color: '#000', whiteSpace: 'nowrap' }}>
            Redeemed / Expired
          </Typography>
        </Box>
      </Box>

      {/* Outlet Filter - Only show for super admin. Flat (radius 0), placeholder 'Outlet' like the reference react-select */}
      {isSuperAdmin() && (
        <FormControl fullWidth sx={{ mb: 2 }}>
          <Select
            value={selectedOutlet}
            onChange={(e) => setSelectedOutlet(e.target.value)}
            disabled={loadingOutlets}
            displayEmpty
            IconComponent={ArrowDropDownIcon}
            renderValue={(value) =>
              value
                ? outletOptions.find((o) => o.id.toString() === value)?.name || 'Outlet'
                : <span style={{ color: '#808080' }}>Outlet</span>
            }
            MenuProps={{
              PaperProps: {
                sx: {
                  mt: 0,
                  borderRadius: 0,
                  bgcolor: '#f8f8f8',
                  border: '1px solid #e0e0e0',
                  boxShadow: 'none',
                  '& .MuiMenuItem-root': {
                    fontSize: 16,
                    color: '#000',
                    '&:hover': { bgcolor: '#5ebbeb' },
                    '&.Mui-selected': { bgcolor: 'transparent' },
                    '&.Mui-selected:hover': { bgcolor: '#5ebbeb' }
                  }
                }
              }
            }}
            sx={{
              bgcolor: 'white',
              fontSize: 16,
              // Doubled-class specificity so the flat radius beats MUI's own
              // .MuiOutlinedInput-root rule (emotion insertion-order can shadow a
              // bare `borderRadius: 0`, leaving the closed control at 4px).
              '&.MuiOutlinedInput-root': { borderRadius: 0 },
              '& .MuiSelect-select': {
                py: 1.5,
              },
              '& .MuiSelect-icon': { color: '#404040' },
              // Match Shopfront: dark-gray border, turns solid black on focus/click
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px', borderRadius: 0 },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px', borderRadius: 0 },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px', borderRadius: 0 },
            }}
          >
            <MenuItem value="">All Outlets</MenuItem>
            {outletOptions.map((outlet) => (
              <MenuItem key={outlet.id} value={outlet.id.toString()}>
                {outlet.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {/* Content - flat on the page (no bordered card), matching the reference */}
      <Box sx={{ minHeight: 400 }}>
        {loading ? null : filteredGiftCards.length === 0 ? (
          <EmptyState />
        ) : (
          <TableContainer>
            <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <TableHead>
                <TableRow
                  sx={{
                    '& th': { bgcolor: '#5ebbeb', color: 'white', fontWeight: 700, fontSize: 16, border: 0, height: 51, py: 0 },
                    '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
                    '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' }
                  }}
                >
                  <TableCell>CODE</TableCell>
                  <TableCell>STATUS</TableCell>
                  <TableCell>ORIGINAL AMOUNT</TableCell>
                  <TableCell>CURRENT AMOUNT</TableCell>
                  <TableCell>EXPIRY</TableCell>
                  <TableCell>CREATION SOURCE</TableCell>
                  <TableCell>ACTIONS</TableCell>
                </TableRow>
              </TableHead>
              <TableBody
                sx={{
                  '& tr:nth-of-type(odd)': { bgcolor: '#ffffff' },
                  '& tr:nth-of-type(even)': { bgcolor: '#f5f5f5' },
                  '& td': { border: 0, fontSize: 16, color: '#000', py: 1.5 }
                }}
              >
                {filteredGiftCards.map((card) => (
                  <TableRow key={card.id}>
                    <TableCell sx={{ fontWeight: 600 }}>{card.code}</TableCell>
                    <TableCell>
                      <Chip
                        label={card.status}
                        color={
                          card.status === 'Active'
                            ? 'success'
                            : card.status === 'Redeemed'
                            ? 'default'
                            : 'error'
                        }
                        size="small"
                      />
                    </TableCell>
                    <TableCell>${card.originalAmount?.toFixed(2) || '0.00'}</TableCell>
                    <TableCell>${card.balance?.toFixed(2) || '0.00'}</TableCell>
                    <TableCell>
                      {card.expiryDate ? new Date(card.expiryDate).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell>
                      <Typography 
                        variant="body2" 
                        sx={{
                          fontSize: 16,
                          color: card.saleId ? '#32b643' : 'text.secondary',
                          cursor: card.saleId ? 'pointer' : 'default',
                          textDecoration: card.saleId ? 'underline' : 'none',
                          '&:hover': {
                            color: card.saleId ? '#32b643' : 'text.secondary'
                          }
                        }}
                        onClick={() => {
                          if (card.saleId) {
                            // ponytail: no per-sale route exists; filter sales history by this card
                            navigate('/register/history', {
                              state: { giftCardFilter: card.code }
                            });
                          }
                        }}
                      >
                        {card.creationSource || 'Manual'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        startIcon={<SearchIcon />}
                        onClick={() => {
                          // Navigate to sales history with gift card filter
                          navigate('/register/history', { 
                            state: { 
                              giftCardFilter: card.code 
                            } 
                          });
                        }}
                        sx={{
                          color: '#0284c7',
                          textTransform: 'none',
                          fontWeight: 700,
                          fontSize: 16,
                          minWidth: 0,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Find in Sales History
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {/* Summary Row */}
              {filteredGiftCards.length > 0 && (
                <TableBody sx={{ '& td': { border: 0, fontSize: 16, color: '#000' } }}>
                  <TableRow sx={{ bgcolor: '#e3f2fd' }}>
                    <TableCell colSpan={2} sx={{ fontWeight: 600, border: 'none' }}>
                      Total
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, border: 'none' }}>
                      ${filteredGiftCards.reduce((sum, card) => sum + (card.originalAmount || 0), 0).toFixed(2)}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, border: 'none' }}>
                      ${filteredGiftCards.reduce((sum, card) => sum + (card.balance || 0), 0).toFixed(2)}
                    </TableCell>
                    <TableCell colSpan={3} sx={{ border: 'none' }}></TableCell>
                  </TableRow>
                </TableBody>
              )}
            </Table>
          </TableContainer>
        )}
      </Box>
    </Box>
  );
};

export default GiftCards;

