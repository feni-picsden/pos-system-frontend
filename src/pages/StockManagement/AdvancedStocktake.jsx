import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  Grid,
  Card,
  CardContent,
  Avatar,
  Divider,
  Chip,
  IconButton,
} from '@mui/material';
import { Search, BarChart, Close, Person, Assessment, Delete, QrCodeScanner, ImageOutlined } from '@mui/icons-material';
import stocktakeService from '../../services/stocktakeService';
import productService from '../../services/productService';
import { useAuth } from '../../contexts/AuthContext';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';

export default function AdvancedStocktake() {
  // In-app dialogs — these shadow window.alert/confirm/prompt on purpose.
  const { alert } = useAppDialogs();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, getOutletName } = useAuth();
  const params = new URLSearchParams(location.search);
  const stocktakeId = params.get('id');

  const [searchTerm, setSearchTerm] = useState('');
  const [eventSearch, setEventSearch] = useState('');
  const [eventResults, setEventResults] = useState([]);
  const [showEventResults, setShowEventResults] = useState(false);
  const [eventProduct, setEventProduct] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [items, setItems] = useState([]);
  const [stocktake, setStocktake] = useState(null);
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [quickScan, setQuickScan] = useState(false);
  const [activities, setActivities] = useState([]);
  const [statisticsOpen, setStatisticsOpen] = useState(false);
  const [statistics, setStatistics] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const saveTimer = useRef(null);

  // Load existing stocktake (draft) items so continue shows same
  useEffect(() => {
    let isMounted = true;
    async function loadExisting() {
      if (!stocktakeId) return;
      try {
        const { stocktake } = await stocktakeService.getStocktake(stocktakeId);
        if (!isMounted || !stocktake) return;
        setStocktake(stocktake);
        if (!stocktake.items) return;
        const mapped = stocktake.items.map((it) => ({
          id: it.id,
          productId: it.productId,
          product: {
            id: it.product?.id || it.productId,
            name: it.product?.name || it.productName || 'Product',
            barcode: (it.product?.barcodes && it.product.barcodes[0]) || '',
            caseQuantity: it.product?.caseQuantity || 1,
            cost: it.product?.itemCost || it.product?.caseCost || 0,
          },
          // One reloaded row represents the product's whole stored count: its
          // "scanned" must equal actualQuantity (units, not scan events) so the
          // collapsed save round-trips without changing the count.
          scanned: it.actualQuantity ?? 0,
          accumulated: it.actualQuantity ?? 0,
          cancelled: false,
        }));
        setItems(mapped);
      } catch (_) {}
    }
    loadExisting();
    return () => { isMounted = false; };
  }, [stocktakeId]);

  // One row per product; the true count is the SUM of its non-cancelled scans.
  // Sending one row PER SCAN with running totals stored n scans as n(n+1)/2,
  // and cancelled scans kept counting through the stale running totals.
  const collapseItemsForSave = (allItems) => {
    const totals = new Map();
    allItems.filter(i => !i.cancelled).forEach((i) => {
      totals.set(i.productId, (totals.get(i.productId) || 0) + (Number(i.scanned) || 0));
    });
    return Array.from(totals.entries()).map(([productId, actualQuantity]) => ({
      productId,
      actualQuantity,
    }));
  };

  // Debounced auto-save draft while editing (keep status In Progress)
  useEffect(() => {
    if (!stocktakeId || items.length === 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await stocktakeService.updateStocktake(stocktakeId, {
          items: collapseItemsForSave(items),
        });
      } catch (_) {}
    }, 1000);
    return () => saveTimer.current && clearTimeout(saveTimer.current);
  }, [items, stocktakeId]);

  useEffect(() => {
    let isMounted = true;
    async function run() {
      if (selectedProduct) { setShowResults(false); setResults([]); return; }
      if (searchTerm.length < 3) { setShowResults(false); setResults([]); return; }
      try {
        const { products } = await productService.getProducts({ search: searchTerm, limit: 20 });
        if (!isMounted) return;
        const mapped = (products || []).map(p => ({
          id: p.id,
          name: p.name,
          barcode: (p.barcodes && p.barcodes[0]) || '',
          caseQuantity: p.caseQuantity || 1,
          cost: p.itemCost || p.caseCost || 0,
          currentStock: p.currentStockItems || p.currentStockCases || 0,
        }));
        
        // Check if searchTerm is a barcode (exact match)
        const barcodeMatch = mapped.find(p => p.barcode === searchTerm);
        if (barcodeMatch && quickScan) {
          // Barcode scan in quick scan mode - add immediately
          scanProduct(barcodeMatch);
          return;
        }
        
        setResults(mapped);
        setShowResults(true);
      } catch (e) {
        setResults([]);
        setShowResults(false);
      }
    }
    run();
    return () => { isMounted = false; };
  }, [searchTerm, selectedProduct, quickScan]);

  // Events sidebar product autocomplete (same PRODUCTS dropdown, sidebar width)
  useEffect(() => {
    let isMounted = true;
    async function run() {
      if (eventProduct) { setShowEventResults(false); setEventResults([]); return; }
      if (eventSearch.length < 3) { setShowEventResults(false); setEventResults([]); return; }
      try {
        const { products } = await productService.getProducts({ search: eventSearch, limit: 20 });
        if (!isMounted) return;
        setEventResults((products || []).map(p => ({ id: p.id, name: p.name })));
        setShowEventResults(true);
      } catch {
        setEventResults([]);
        setShowEventResults(false);
      }
    }
    run();
    return () => { isMounted = false; };
  }, [eventSearch, eventProduct]);

  const selectProduct = (product) => {
    if (quickScan) {
      // In quick scan mode, scan immediately
      scanProduct(product);
    } else {
      // In normal mode, select the product first
      setSelectedProduct(product);
      setSearchTerm('');
      setShowResults(false);
      setQuantity('');
    }
  };

  const deleteItem = (itemId) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, cancelled: true } : item
    ));
  };

  const scanProduct = async (product, isQuickScan = null) => {
    const productToScan = product || selectedProduct;
    if (!productToScan) return;

    const qty = quantity === '' ? 1 : (parseInt(quantity) || 1);
    const isScanMode = isQuickScan !== null ? isQuickScan : quickScan;
    
    setItems(prev => {
      // Calculate current accumulated total for this product (excluding cancelled items)
      const productTotal = prev
        .filter(i => i.productId === productToScan.id && !i.cancelled)
        .reduce((sum, i) => sum + i.scanned, 0);
      
      const newAccumulated = productTotal + qty;
      
      // Always add a new row for each scan at the top
      return [{
        id: Date.now(),
        productId: productToScan.id,
        product: productToScan,
        scanned: qty,
        accumulated: newAccumulated,
        cancelled: false,
        isScanned: isScanMode, // Track if this was a scan or manual count
      }, ...prev];
    });

    // Add to activity feed
    const activity = {
      id: Date.now(),
      type: isScanMode ? 'scan' : 'count',
      user: user?.name || 'Unknown',
      action: isScanMode ? 'scanned' : 'counted',
      quantity: qty,
      product: productToScan.name,
      timestamp: new Date(),
    };
    setActivities(prev => [activity, ...prev]);

    // Record scan in backend if stocktake exists
    if (stocktakeId) {
      try {
        await stocktakeService.recordScan(stocktakeId, {
          productId: productToScan.id,
          count: qty,
          eventType: isScanMode ? 'Scan' : 'Count', // Differentiate between scan and count
        });
      } catch (e) {
        console.error('Failed to record scan:', e);
      }
    }

    // Clear and reset
    setSelectedProduct(null);
    setSearchTerm('');
    setShowResults(false);
    setQuantity('');
  };

  const filtered = items;

  const filteredActivities = useMemo(() => {
    if (!eventProduct) return activities;
    return activities.filter(a => a.product === eventProduct.name);
  }, [activities, eventProduct]);

  const complete = async () => {
    if (!stocktakeId || items.length === 0) return;
    try {
      await stocktakeService.updateStocktake(stocktakeId, {
        status: 'Completed',
        items: collapseItemsForSave(items)
      });
      navigate('/stock-management/stocktakes');
    } catch (e) {
      console.error('Failed to complete stocktake:', e);
      alert('Failed to complete stocktake. Please try again.');
    }
  };

  const loadStatistics = async () => {
    if (!stocktakeId) {
      alert('Please save the stocktake first to view statistics');
      return;
    }
    try {
      setStatsLoading(true);
      setStatisticsOpen(true);
      const { statistics: stats } = await stocktakeService.getStocktakeStatistics(stocktakeId);
      setStatistics(stats);
    } catch (e) {
      console.error('Failed to load statistics:', e);
      alert('Failed to load statistics. This stocktake might not have been saved yet.');
    } finally {
      setStatsLoading(false);
    }
  };

  return (
    <Box sx={{ bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ bgcolor: 'white', p: 2.5, borderBottom: '1px solid #e0e0e0' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" fontWeight={600}>{stocktake?.name || 'Advanced Stocktake'}</Typography>
            <Typography variant="caption" color="text.secondary">{stocktake?.outlet?.name || getOutletName() || 'N/A'}</Typography>
          </Box>
          <Avatar sx={{ bgcolor: '#e0e0e0', width: 48, height: 48 }} />
        </Stack>
      </Box>

      {/* Statistics Dialog */}
      <Dialog open={statisticsOpen} onClose={() => setStatisticsOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <Assessment color="primary" />
              <Typography variant="h6" fontWeight={600}>Stocktake Statistics</Typography>
            </Stack>
            <IconButton onClick={() => setStatisticsOpen(false)}>
              <Close />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <StatisticsView statistics={statistics} loading={statsLoading} />
        </DialogContent>
      </Dialog>

      <Grid container sx={{ height: 'calc(100vh - 80px)' }}>
        {/* Left Side - Main Content */}
        <Grid item xs={12} md={8} sx={{ p: 3 }}>
          {/* Search Bar and Controls */}
          <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
            <Box sx={{ position: 'relative', flex: 1 }}>
              <Box
                component="input"
                placeholder="Search by name or barcode"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && results.length > 0) {
                    selectProduct(results[0]);
                  }
                }}
                disabled={selectedProduct !== null}
                sx={{
                  width: '100%',
                  height: 53,
                  boxSizing: 'border-box',
                  border: '1px solid #000',
                  borderRadius: 0,
                  fontSize: 16,
                  px: '12px',
                  pr: searchTerm ? '44px' : '12px',
                  bgcolor: selectedProduct ? '#d4d4d4' : '#fff',
                  outline: 'none',
                  '&::placeholder': { color: '#808080' },
                  '&:focus': { border: '2px solid #000' },
                }}
              />
              {searchTerm && !selectedProduct && (
                <IconButton
                  size="small"
                  onClick={() => { setSearchTerm(''); setShowResults(false); }}
                  sx={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    bgcolor: '#404040', color: '#fff', width: 22, height: 22,
                    '&:hover': { bgcolor: '#404040' },
                  }}
                >
                  <Close sx={{ fontSize: 14 }} />
                </IconButton>
              )}
              {!selectedProduct && searchTerm.length > 0 && searchTerm.length < 3 && (
                <Box sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, bgcolor: '#fff', border: '1px solid #d9d9d9', p: 1.5 }}>
                  <Typography sx={{ fontSize: 14, color: '#676b72' }}>Start typing to search...</Typography>
                </Box>
              )}
              {showResults && !selectedProduct && searchTerm.length >= 3 && (
                <ProductsDropdown term={searchTerm} results={results} onSelect={selectProduct} />
              )}
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box
                onClick={() => {
                  const newQuickScan = !quickScan;
                  setQuickScan(newQuickScan);
                  // Clear selected product when enabling quick scan
                  if (newQuickScan && selectedProduct) {
                    setSelectedProduct(null);
                    setQuantity('');
                  }
                }}
                sx={{
                  width: 48,
                  height: 24,
                  borderRadius: 12,
                  bgcolor: quickScan ? '#4caf50' : '#a3a3a3',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background-color 0.2s',
                  '&:hover': { bgcolor: quickScan ? '#4caf50' : '#737373' },
                }}
              >
                <Box sx={{
                  position: 'absolute',
                  top: 2,
                  left: quickScan ? 26 : 2,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  bgcolor: 'white',
                  transition: 'left 0.3s'
                }} />
              </Box>
              <Typography variant="body2">Quick Scan</Typography>
            </Stack>
          </Stack>

          {/* Selected Product Panel - Hidden when Quick Scan is enabled */}
          {!quickScan && (
            <Stack direction="row" spacing={0} alignItems="center" justifyContent="end" sx={{ mb: 3 }}>
              {selectedProduct ? (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mr: 2 }}>
                  <IconButton
                    size="small"
                    onClick={() => { setSelectedProduct(null); setQuantity(''); }}
                    sx={{ color: '#808080', p: 0.5 }}
                  >
                    <Close sx={{ fontSize: 18 }} />
                  </IconButton>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontSize: 16, fontWeight: 600 }}>{selectedProduct.name}</Typography>
                    <Typography sx={{ fontSize: 13, color: '#676b72' }}>
                      Barcode quantity {selectedProduct.caseQuantity || 1}
                    </Typography>
                  </Box>
                </Stack>
              ) : (
                <Typography variant="body2" sx={{ minWidth: 140, textAlign: 'right', mr: 2 }}>No product selected</Typography>
              )}
              <Box
                component="input"
                type="number"
                placeholder="Quantity"
                value={quantity}
                onChange={(e) => {
                  const val = e.target.value;
                  setQuantity(val === '' ? '' : parseInt(val) || 1);
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' && selectedProduct) scanProduct(); }}
                disabled={!selectedProduct}
                sx={{
                  width: 298,
                  height: 53,
                  boxSizing: 'border-box',
                  border: '1px solid #000',
                  borderRadius: 0,
                  fontSize: 16,
                  px: '12px',
                  bgcolor: selectedProduct ? '#fff' : '#d4d4d4',
                  outline: 'none',
                  '&::placeholder': { color: '#808080' },
                  '&:focus': { border: '2px solid #000' },
                }}
              />
              <Box
                component="button"
                onClick={() => scanProduct()}
                sx={{
                  width: 76,
                  height: 53,
                  bgcolor: '#5ebbeb',
                  color: '#f8f8f8',
                  fontSize: 16,
                  fontWeight: 400,
                  borderRadius: 0,
                  border: '1px solid #f8f8f8',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s, color 0.2s',
                  '&:hover': { bgcolor: '#f8f8f8', color: '#5ebbeb' },
                }}
              >
                Count
              </Box>
            </Stack>
          )}

          {/* Table — flat, no card, ref parity */}
          <TableContainer sx={{ boxShadow: 'none', borderRadius: 0 }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#5ebbeb', height: 50 }}>
                  <TableCell sx={{ color: '#f8f8f8', fontWeight: 700, fontSize: 20, textTransform: 'uppercase', py: 0, borderBottom: 'none' }}>PRODUCT</TableCell>
                  <TableCell sx={{ color: '#f8f8f8', fontWeight: 700, fontSize: 20, textTransform: 'uppercase', py: 0, borderBottom: 'none' }} align="center">SCANNED</TableCell>
                  <TableCell sx={{ color: '#f8f8f8', fontWeight: 700, fontSize: 20, textTransform: 'uppercase', py: 0, borderBottom: 'none' }} align="center">ACCUMULATED</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((item) => (
                    <TableRow
                      key={item.id}
                      sx={{
                        opacity: item.cancelled ? 0.5 : 1,
                        bgcolor: item.cancelled ? '#f5f5f5' : 'transparent'
                      }}
                    >
                      <TableCell sx={{ py: 2 }}>
                        <Typography 
                          component="span" 
                          sx={{ 
                            textDecoration: item.cancelled ? 'line-through' : 'none',
                            color: item.cancelled ? 'text.disabled' : 'text.primary',
                            fontSize: '0.95rem'
                          }}
                        >
                          <Search fontSize="small" color={item.cancelled ? "disabled" : "primary"} sx={{ mr: 1, verticalAlign: 'middle' }} />
                          {item.product.name}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" sx={{ py: 2 }}>
                        <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
                          <Typography sx={{ 
                            textDecoration: item.cancelled ? 'line-through' : 'none',
                            color: item.cancelled ? 'text.disabled' : 'text.primary',
                            fontSize: '0.95rem'
                          }}>
                            {item.scanned}
                          </Typography>
                          {!item.cancelled && (
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={() => deleteItem(item.id)}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell align="center" sx={{ py: 2 }}>
                        <Typography sx={{ 
                          textDecoration: item.cancelled ? 'line-through' : 'none',
                          color: item.cancelled ? 'text.disabled' : 'text.primary',
                          fontSize: '0.95rem'
                        }}>
                          {item.accumulated}
                        </Typography>
                      </TableCell>
                    </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>

        {/* Right Side - Activity Feed */}
        <Grid item xs={12} md={4} sx={{ bgcolor: 'white', p: 3, borderLeft: '1px solid #e0e0e0', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ position: 'relative', mb: 3 }}>
            <Box
              component="input"
              placeholder="Search for product events..."
              value={eventProduct ? eventProduct.name : eventSearch}
              onChange={(e) => { setEventProduct(null); setEventSearch(e.target.value); }}
              sx={{
                width: '100%',
                height: 53,
                boxSizing: 'border-box',
                border: '1px solid #000',
                borderRadius: 0,
                fontSize: 16,
                px: '12px',
                pr: (eventSearch || eventProduct) ? '44px' : '12px',
                bgcolor: '#fff',
                outline: 'none',
                '&::placeholder': { color: '#808080' },
                '&:focus': { border: '2px solid #000' },
              }}
            />
            {(eventSearch || eventProduct) && (
              <IconButton
                size="small"
                onClick={() => { setEventSearch(''); setEventProduct(null); setShowEventResults(false); }}
                sx={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  bgcolor: '#404040', color: '#fff', width: 22, height: 22,
                  '&:hover': { bgcolor: '#404040' },
                }}
              >
                <Close sx={{ fontSize: 14 }} />
              </IconButton>
            )}
            {!eventProduct && eventSearch.length > 0 && eventSearch.length < 3 && (
              <Box sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, bgcolor: '#fff', border: '1px solid #d9d9d9', p: 1.5 }}>
                <Typography sx={{ fontSize: 14, color: '#676b72' }}>Start typing to search...</Typography>
              </Box>
            )}
            {showEventResults && !eventProduct && eventSearch.length >= 3 && (
              <ProductsDropdown
                term={eventSearch}
                results={eventResults}
                onSelect={(p) => { setEventProduct(p); setEventSearch(''); setShowEventResults(false); }}
              />
            )}
          </Box>

          {/* Activity List */}
          <Stack spacing={2} sx={{ flex: 1, overflow: 'auto' }}>
            {filteredActivities.map((activity) => (
                <Paper key={activity.id} variant="outlined" sx={{ p: 2 }}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    <Box sx={{ 
                      bgcolor: activity.type === 'scan' ? '#e3f2fd' : '#f3e5f5', 
                      p: 1.5, 
                      borderRadius: 1,
                      minWidth: 48,
                      height: 48,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {activity.type === 'scan' ? (
                        <QrCodeScanner color="primary" />
                      ) : (
                        <BarChart sx={{ color: '#9c27b0' }} />
                      )}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ mb: 0.5 }}>
                        <strong>{activity.user}</strong> {activity.action} {activity.quantity}{' '}
                        <strong>{activity.product}</strong>
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatTimeAgo(activity.timestamp)}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
            ))}
          </Stack>

          {/* Complete — pinned at sidebar bottom (ref parity) */}
          <Box
            component="button"
            onClick={complete}
            sx={{
              width: '100%',
              height: 37,
              mt: 2,
              flexShrink: 0,
              bgcolor: '#5ebbeb',
              color: '#f8f8f8',
              fontSize: 16,
              fontWeight: 400,
              border: 'none',
              borderRadius: 0,
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              '&:hover': { bgcolor: '#4aa9dd' },
            }}
          >
            Complete
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}

// Shared PRODUCTS autocomplete dropdown (ref parity: gray uppercase header,
// image icon rows, matched term highlighted in #5ebbeb)
function ProductsDropdown({ term, results, onSelect }) {
  return (
    <Box sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, bgcolor: '#fff', border: '1px solid #d9d9d9', maxHeight: 320, overflow: 'auto' }}>
      <Typography sx={{ px: 1.5, pt: 1, pb: 0.5, fontSize: 12, fontWeight: 700, color: '#676b72', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Products
      </Typography>
      {results.map((r) => {
        const i = r.name.toLowerCase().indexOf(term.toLowerCase());
        return (
          <Stack
            key={r.id}
            direction="row"
            spacing={1.5}
            alignItems="center"
            onClick={() => onSelect(r)}
            sx={{ px: 1.5, py: 1, cursor: 'pointer', '&:hover': { bgcolor: '#f8f8f8' } }}
          >
            <ImageOutlined sx={{ color: '#808080', fontSize: 22 }} />
            <Typography sx={{ fontSize: 16, color: '#000' }}>
              {i >= 0 ? (
                <>
                  {r.name.slice(0, i)}
                  <Box component="span" sx={{ color: '#5ebbeb' }}>{r.name.slice(i, i + term.length)}</Box>
                  {r.name.slice(i + term.length)}
                </>
              ) : r.name}
            </Typography>
          </Stack>
        );
      })}
    </Box>
  );
}

function formatTimeAgo(date) {
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return 'A few seconds ago';
  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 hour ago';
  return `${hours} hours ago`;
}

// Statistics View Component
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

  return (
    <Box>
      {/* Overview Statistics */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="caption" color="text.secondary" gutterBottom>Number of scans</Typography>
              <Typography variant="h3" fontWeight={700}>{statistics.totalScans.toLocaleString()}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="caption" color="text.secondary" gutterBottom>Products counted</Typography>
              <Typography variant="h3" fontWeight={700}>{statistics.productsCounted.toLocaleString()}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="caption" color="text.secondary" gutterBottom>Sales affecting</Typography>
              <Typography variant="h3" fontWeight={700}>{statistics.salesAffecting}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="caption" color="text.secondary" gutterBottom>Duration of Stocktake</Typography>
              <Typography variant="h6" fontWeight={700}>{statistics.durationFormatted}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Completed Info */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>Completed</Typography>
        <Typography color="text.secondary">
          {statistics.completedAt ? new Date(statistics.completedAt).toLocaleString() : 'Not completed yet'}
        </Typography>
      </Paper>

      {/* User Breakdown */}
      {statistics.userBreakdown && statistics.userBreakdown.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom sx={{ mb: 2 }}>User Breakdown</Typography>
          <Grid container spacing={2}>
            {statistics.userBreakdown.map((user) => (
              <Grid item xs={12} sm={6} md={4} key={user.userId}>
                <Card variant="outlined">
                  <CardContent>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Avatar sx={{ bgcolor: '#1976d2' }}>
                        <Person />
                      </Avatar>
                      <Box>
                        <Typography variant="h6" fontWeight={600}>{user.userName}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Number of scans: <strong>{user.totalScans}</strong>
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Products counted: <strong>{user.productsCounted}</strong>
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Activity Log */}
      {statistics.activities && statistics.activities.length > 0 && (
        <Paper variant="outlined">
          <Box sx={{ p: 2, bgcolor: '#f5f5f5' }}>
            <Typography variant="h6" fontWeight={600}>Activity Log</Typography>
          </Box>
          <Divider />
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#39a1f4' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>PRODUCT</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>EVENT</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>COUNT</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>USER</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>TIMESTAMP</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {statistics.activities.slice(0, 20).map((activity) => (
                  <TableRow key={activity.id} hover>
                    <TableCell>{activity.productName || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={activity.eventType}
                        size="small"
                        color={activity.eventType === 'Scan' ? 'primary' : activity.eventType === 'Sale' ? 'success' : 'default'}
                        sx={{ borderRadius: 1 }}
                      />
                    </TableCell>
                    <TableCell>{activity.count}</TableCell>
                    <TableCell>{activity.user}</TableCell>
                    <TableCell>
                      {new Date(activity.timestamp).toLocaleString('en-AU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {statistics.activities.length > 20 && (
            <Box sx={{ p: 2, textAlign: 'center', bgcolor: '#fafafa' }}>
              <Typography variant="body2" color="text.secondary">
                Showing 20 of {statistics.activities.length} activities
              </Typography>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
}

