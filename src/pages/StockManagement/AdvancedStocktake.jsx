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
  Button,
} from '@mui/material';
import { Search, BarChart, Close, Person, Assessment, Delete, QrCodeScanner, ImageOutlined, ShoppingCartOutlined, HelpOutline, WarningAmberOutlined } from '@mui/icons-material';
import stocktakeService from '../../services/stocktakeService';
import productService from '../../services/productService';
import { useAuth } from '../../contexts/AuthContext';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';

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
  // Finish flow (reference): Complete -> "finished my part / other users /
  // complete" -> Finalise (categories) -> variances + apply options.
  const [completeStep, setCompleteStep] = useState(null); // null | 'ask' | 'finalise' | 'apply'
  const [finaliseCategories, setFinaliseCategories] = useState([]);
  const [applyToAll, setApplyToAll] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [allCategories, setAllCategories] = useState([]);
  const [finishing, setFinishing] = useState(false);
  const seenSaleIds = useRef(new Set());

  // Events come from the server so every device in the session sees the same
  // list: other users' scans/counts and sales rung up while counting.
  const mapActivity = (a) => {
    const type = String(a.eventType || 'Scan').toLowerCase();
    return {
      id: a.id,
      type,
      user: a.user || 'Unknown',
      action: type === 'sale' ? 'sold' : 'scanned', // reference: a typed count reads "scanned" too
      quantity: a.count,
      product: a.productName || 'Product',
      productId: a.productId,
      timestamp: new Date(a.timestamp),
    };
  };
  const refreshActivities = async () => {
    if (!stocktakeId) return;
    try {
      const { activities: rows } = await stocktakeService.getActivities(stocktakeId);
      const mapped = (rows || []).map(mapActivity);
      setActivities(mapped);
      // A sale of a counted product comes off this device's count too
      // (reference: "it will automatically deduct the sold quantity from the count").
      const newSales = mapped.filter((a) => a.type === 'sale' && !seenSaleIds.current.has(a.id));
      if (newSales.length > 0) {
        newSales.forEach((a) => seenSaleIds.current.add(a.id));
        setItems((prev) => prev.map((row) => {
          const sold = newSales.filter((a) => a.productId === row.productId).reduce((s, a) => s + (Number(a.quantity) || 0), 0);
          if (!sold || row.cancelled) return row;
          const total = Math.max(0, (Number(row.scanned) || 0) - sold);
          return { ...row, scanned: total, accumulated: total, lastScan: -sold };
        }));
      }
    } catch (_) {}
  };

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
            // "Display expected": the stocktake's own expected figure for the row.
            currentStock: it.expectedQuantity ?? it.product?.inventory ?? 0,
            categoryId: it.product?.category?.id ?? it.product?.categoryId ?? null,
            categoryName: it.product?.category?.name || null,
          },
          // One reloaded row represents the product's whole stored count: its
          // "scanned" must equal actualQuantity (units, not scan events) so the
          // collapsed save round-trips without changing the count.
          scanned: it.actualQuantity ?? 0,
          lastScan: it.actualQuantity ?? 0,
          accumulated: it.actualQuantity ?? 0,
          cancelled: false,
        }));
        setItems(mapped);
      } catch (_) {}
    }
    loadExisting();
    return () => { isMounted = false; };
  }, [stocktakeId]);

  // Auto-refresh the Events list: sales already recorded before this device
  // joined are not re-deducted (they are already in the stored counts).
  useEffect(() => {
    if (!stocktakeId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { activities: rows } = await stocktakeService.getActivities(stocktakeId);
        if (cancelled) return;
        const mapped = (rows || []).map(mapActivity);
        mapped.filter((a) => a.type === 'sale').forEach((a) => seenSaleIds.current.add(a.id));
        setActivities(mapped);
      } catch (_) {}
    })();
    const timer = setInterval(refreshActivities, 5000);
    return () => { cancelled = true; clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stocktakeId]);

  // One row per product; the true count is the SUM of its non-cancelled scans.
  // Sending one row PER SCAN with running totals stored n scans as n(n+1)/2,
  // and cancelled scans kept counting through the stale running totals.
  const collapseItemsForSave = (allItems) => {
    const totals = new Map();
    allItems.filter(i => !i.cancelled).forEach((i) => {
      totals.set(i.productId, (totals.get(i.productId) || 0) + (Number(i.scanned) || 0));
    });
    const rows = Array.from(totals.entries()).map(([productId, actualQuantity]) => ({
      productId,
      actualQuantity,
    }));
    // A product whose every count was deleted (trash icon) is sent as a removal:
    // the save only ever upserted, so the server kept the old count and the
    // deleted product was still applied.
    const removed = new Set(allItems.filter(i => i.cancelled && !totals.has(i.productId)).map(i => i.productId));
    removed.forEach((productId) => rows.push({ productId, actualQuantity: 0, remove: true }));
    return rows;
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

  // Barcodes are stored as [{ code, quantity }] (older rows may be plain strings).
  // The quantity is the BARCODE's pack size — a six-pack barcode is 6 — which the
  // reference applies per scan ("scanning a six pack barcode and entering a
  // quantity of five will result in 30 items being counted").
  const barcodeQuantityOf = (product, code) => {
    const rows = Array.isArray(product?.barcodes) ? product.barcodes : [];
    const hit = rows.find((b) => String(typeof b === 'string' ? b : b?.code || '').trim() === String(code).trim());
    const qty = hit && typeof hit !== 'string' ? parseInt(hit.quantity, 10) : 1;
    return Number.isFinite(qty) && qty > 0 ? qty : 1;
  };
  const mapProduct = (p, scannedCode = null) => ({
    id: p.id,
    name: p.name,
    barcode: scannedCode || (p.barcodes && (typeof p.barcodes[0] === 'string' ? p.barcodes[0] : p.barcodes[0]?.code)) || '',
    // Searching by name applies the base quantity (reference note: "usually one").
    barcodeQuantity: scannedCode ? barcodeQuantityOf(p, scannedCode) : 1,
    caseQuantity: p.caseQuantity || 1,
    cost: p.itemCost || p.caseCost || 0,
    currentStock: p.inventory ?? (p.currentStockItems || p.currentStockCases || 0),
    categoryId: p.category?.id ?? p.categoryId ?? null,
    categoryName: p.category?.name || null,
  });
  // A scanner types the whole code then Enter; anything 6+ characters without
  // spaces is tried as an exact barcode first (the products search only matches
  // names). Debounced so a code typed by hand is not looked up per keystroke.
  const looksLikeBarcode = (term) => /^[A-Za-z0-9-]{6,}$/.test(term);

  useEffect(() => {
    let isMounted = true;
    const term = searchTerm.trim();
    async function run() {
      if (selectedProduct) { setShowResults(false); setResults([]); return; }
      if (term.length < 3) { setShowResults(false); setResults([]); return; }
      try {
        if (looksLikeBarcode(term)) {
          try {
            const found = await productService.getProductByBarcode(term);
            const hit = found?.product;
            if (!isMounted) return;
            if (hit) {
              const mapped = mapProduct(hit, term);
              setShowResults(false);
              setResults([]);
              // Quick Scan: the barcode quantity is counted straight away.
              // Default mode: the product is selected and waits for a quantity.
              if (quickScan) scanProduct(mapped, true);
              else selectProduct(mapped);
              return;
            }
          } catch (_) {
            // not a known barcode — fall through to the name search
          }
        }
        const { products } = await productService.getProducts({ search: term, limit: 20 });
        if (!isMounted) return;
        setResults((products || []).map((p) => mapProduct(p)));
        setShowResults(true);
      } catch (e) {
        if (!isMounted) return;
        setResults([]);
        setShowResults(false);
      }
    }
    const handle = setTimeout(run, looksLikeBarcode(term) ? 150 : 0);
    return () => { isMounted = false; clearTimeout(handle); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const isScanMode = isQuickScan !== null ? isQuickScan : quickScan;
    // Units counted by this scan: the typed quantity (Quick Scan has none, so 1)
    // times the scanned barcode's quantity — a six-pack barcode counts 6 each.
    const count = isScanMode ? 1 : (quantity === '' ? 1 : (parseInt(quantity) || 1));
    const qty = count * (productToScan.barcodeQuantity || 1);

    setItems(prev => {
      // One row per product (reference: a product's scanned amount is one figure).
      // Scanning the same barcode again adds to that row and brings it to the top;
      // it never creates a second row for the product.
      const existing = prev.find(i => i.productId === productToScan.id && !i.cancelled);
      const total = (existing ? Number(existing.scanned) || 0 : 0) + qty;
      const row = {
        id: existing ? existing.id : Date.now(),
        productId: productToScan.id,
        product: productToScan,
        scanned: total,        // the product's whole count (what is saved)
        lastScan: qty,         // units this scan added
        accumulated: total,
        cancelled: false,
        isScanned: isScanMode, // Track if this was a scan or manual count
      };
      return [row, ...prev.filter(i => i !== existing)];
    });

    // Shown at once on this device; the server copy replaces it on the next poll.
    const activity = {
      id: `local-${Date.now()}`,
      type: isScanMode ? 'scan' : 'count',
      user: user?.name || 'Unknown',
      action: 'scanned', // reference wording for a typed count too ("TEST scanned 9 ...")
      quantity: qty,
      product: productToScan.name,
      productId: productToScan.id,
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
        refreshActivities();
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
  // New Stocktake dialog's "Display expected" switch (saved on the stocktake).
  const showExpected = Boolean(stocktake?.displayExpected);

  const filteredActivities = useMemo(() => {
    if (!eventProduct) return activities;
    return activities.filter(a => a.product === eventProduct.name);
  }, [activities, eventProduct]);

  // Push this device's counts to the server now (the debounced autosave may
  // still be pending) so the other devices / the completing device see them.
  const syncCounts = async () => {
    if (!stocktakeId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const rows = collapseItemsForSave(items);
    if (rows.length === 0) return;
    await stocktakeService.updateStocktake(stocktakeId, { items: rows });
  };

  // Complete button: ask whether every device has finished (reference wording).
  const complete = () => {
    if (!stocktakeId) return;
    setCompleteStep('ask');
  };

  // "I have finished my part of the stocktake" - sync and leave; the session
  // stays In Progress for the other devices.
  const finishMyPart = async () => {
    try {
      setFinishing(true);
      await syncCounts();
      navigate('/stock-management/stocktakes');
    } catch (e) {
      alert('Your counts could not be synced. Check the connection and try again.', 'error');
    } finally {
      setFinishing(false);
    }
  };

  // "There are still other users in the Stocktake" - sync, keep counting.
  const othersStillCounting = async () => {
    try {
      setFinishing(true);
      await syncCounts();
      alert('Your counts are synced. Complete the stocktake once every device has finished.', 'info');
    } catch (_) {
      alert('Your counts could not be synced. Check the connection and try again.', 'error');
    } finally {
      setFinishing(false);
      setCompleteStep(null);
    }
  };

  // Finalise: list the categories of every counted product (all devices) so
  // the operator can add/remove the ones whose uncounted products get zeroed.
  const openFinalise = async () => {
    try {
      setFinishing(true);
      await syncCounts();
      const [{ stocktake: fresh }, cats] = await Promise.all([
        stocktakeService.getStocktake(stocktakeId),
        productService.getCategories().catch(() => []),
      ]);
      const categoryList = (cats || []).map((c) => ({ id: c.id, name: c.name }));
      setAllCategories(categoryList);
      const seen = new Map();
      (fresh?.items || []).forEach((it) => {
        const cat = it.product?.category;
        if (cat?.id && !seen.has(cat.id)) seen.set(cat.id, { id: cat.id, name: cat.name });
        // Reference lists "Products with no category" when a counted product has none.
        else if (!cat?.id && !seen.has(0)) seen.set(0, { id: 0, name: 'Products with no category' });
      });
      setFinaliseCategories(Array.from(seen.values()));
      setApplyToAll(false);
      setCategorySearch('');
      setCompleteStep('finalise');
    } catch (e) {
      alert('The stocktake could not be loaded for finalising. Please try again.', 'error');
    } finally {
      setFinishing(false);
    }
  };

  // Finalise -> Confirm Categories -> Complete: the session closes (sales no
  // longer deduct) and the completed view opens with the reference "Apply
  // Stocktake" popup (Review / Ignore Other Stock / Zero Other Stock).
  const finaliseComplete = async () => {
    try {
      setFinishing(true);
      await stocktakeService.completeStocktake(stocktakeId, collapseItemsForSave(items));
      const scope = new URLSearchParams({
        apply: '1',
        applyToAll: applyToAll ? '1' : '0',
        categoryIds: finaliseCategories.map((c) => c.id).join(','),
      });
      navigate(`/stock-management/stocktakes/${stocktakeId}?${scope.toString()}`);
    } catch (e) {
      console.error('Failed to complete stocktake:', e);
      alert('Failed to complete stocktake. Please try again.', 'error');
    } finally {
      setFinishing(false);
    }
  };

  const categoryMatches = useMemo(() => {
    const term = categorySearch.trim().toLowerCase();
    if (!term) return [];
    const chosen = new Set(finaliseCategories.map((c) => c.id));
    return allCategories.filter((c) => !chosen.has(c.id) && c.name.toLowerCase().includes(term)).slice(0, 8);
  }, [categorySearch, allCategories, finaliseCategories]);

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
                      Barcode quantity {selectedProduct.barcodeQuantity || 1}
                      {showExpected && ` · Expected ${selectedProduct.currentStock ?? 0}`}
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
                  // Keep the raw text: parsing per keystroke turned a leading "-"
                  // into 1, so a correcting negative count (reference: Scan -48)
                  // could never be typed.
                  const val = e.target.value;
                  setQuantity(val === '' ? '' : (/^-?\d*$/.test(val) ? val : quantity));
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
                  {/* Reference "Display expected": "determines whether the expected
                      inventory is visible for each scanned product". */}
                  {showExpected && (
                    <TableCell sx={{ color: '#f8f8f8', fontWeight: 700, fontSize: 20, textTransform: 'uppercase', py: 0, borderBottom: 'none' }} align="center">EXPECTED</TableCell>
                  )}
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
                      {showExpected && (
                        <TableCell align="center" sx={{ py: 2 }}>
                          <Typography sx={{ color: item.cancelled ? 'text.disabled' : 'text.primary', fontSize: '0.95rem' }}>
                            {item.product.currentStock ?? 0}
                          </Typography>
                        </TableCell>
                      )}
                      <TableCell align="center" sx={{ py: 2 }}>
                        <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
                          <Typography sx={{ 
                            textDecoration: item.cancelled ? 'line-through' : 'none',
                            color: item.cancelled ? 'text.disabled' : 'text.primary',
                            fontSize: '0.95rem'
                          }}>
                            {/* SCANNED = units the latest scan added; ACCUMULATED = the product's total. */}
                            {item.lastScan ?? item.scanned}
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
                      bgcolor: activity.type === 'scan' ? '#e3f2fd' : activity.type === 'sale' ? '#fff3e0' : '#f3e5f5',
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
                      ) : activity.type === 'sale' ? (
                        <ShoppingCartOutlined sx={{ color: '#ef6c00' }} />
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

      {/* Reference complete flow: three question popups, then the Finalise page,
          then Confirm Categories, then the completed view with its Apply popup. */}
      <QuestionDialog open={completeStep === 'ask'} title="Complete Stocktake" disabled={finishing}
        options={[
          { label: 'I have finished my part of the stocktake', onClick: () => setCompleteStep('last') },
          { label: 'I have not yet finished my part in the stocktake', onClick: () => setCompleteStep(null) },
        ]} />
      <QuestionDialog open={completeStep === 'last'} title="Complete Stocktake" disabled={finishing}
        options={[
          { label: 'I am the last user to finish the stocktake', onClick: () => setCompleteStep('confirm') },
          { label: 'There are still other users in the stocktake', onClick: finishMyPart },
        ]} />
      <QuestionDialog open={completeStep === 'confirm'} title="Complete Stocktake" disabled={finishing}
        options={[
          { label: 'The stocktake is still in progress', onClick: othersStillCounting },
          { label: 'I confirm that the stocktake has been completed', onClick: openFinalise },
        ]} />

      {/* Finalise page (reference: a full page, not a popup) */}
      <Dialog fullScreen open={completeStep === 'finalise'} onClose={() => {}} PaperProps={{ sx: { bgcolor: '#fff' } }}>
        <Box sx={{ maxWidth: 700, mx: 'auto', px: 2, py: 3, display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
          <Typography sx={{ fontSize: 28, fontWeight: 700, color: '#000', mb: 2 }}>Finalise Stocktake</Typography>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <ShopfrontSwitch checked={applyToAll} onChange={(e) => setApplyToAll(e.target.checked)} />
            <Typography sx={{ fontSize: 15 }}>Apply the stocktake to all products</Typography>
          </Stack>
          {!applyToAll && (
            <>
              <Typography sx={{ fontSize: 15, color: '#000', mb: 1 }}>Select which categories that should be affected by applying the stocktake</Typography>
              <Box sx={{ position: 'relative', mb: 1.5 }}>
                <Box
                  component="input"
                  placeholder="Search for category..."
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  sx={{ width: '100%', height: 50, boxSizing: 'border-box', border: '1px solid #000', borderRadius: 0, fontSize: 15, px: '16px', outline: 'none', '&:focus': { border: '2px solid #000' } }}
                />
                {categoryMatches.length > 0 && (
                  <Box sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, bgcolor: '#fff', border: '1px solid #d9d9d9', maxHeight: 200, overflow: 'auto' }}>
                    {categoryMatches.map((c) => (
                      <Typography key={c.id} onClick={() => { setFinaliseCategories((prev) => [...prev, c]); setCategorySearch(''); }} sx={{ px: 1.5, py: 1, fontSize: 15, cursor: 'pointer', '&:hover': { bgcolor: '#f8f8f8' } }}>
                        {c.name}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Box>
              <Stack spacing={1}>
                {finaliseCategories.length === 0 && (
                  <Typography sx={{ fontSize: 14, color: '#676b72' }}>No categories selected - only the counted products will be applied.</Typography>
                )}
                {finaliseCategories.map((c) => (
                  <Stack key={c.id} direction="row" alignItems="center" justifyContent="space-between" sx={{ border: '1px solid #000', px: 2, py: 1.5 }}>
                    <Typography sx={{ fontSize: 15 }}>{c.name}</Typography>
                    <ShopfrontSwitch checked onChange={() => setFinaliseCategories((prev) => prev.filter((x) => x.id !== c.id))} />
                  </Stack>
                ))}
              </Stack>
            </>
          )}
          <Box sx={{ flex: 1 }} />
          <Button fullWidth disabled={finishing} onClick={() => setCompleteStep('categories')} sx={{ ...FINISH_PRIMARY_SX, bgcolor: '#1c86f2', borderRadius: 0, height: 44, fontSize: 18, mt: 3, '&:hover': { bgcolor: '#1565c0' } }}>
            Complete
          </Button>
        </Box>
      </Dialog>

      {/* Confirm Categories (reference: info popup, No / Yes) */}
      <Dialog open={completeStep === 'categories'} onClose={() => {}} PaperProps={{ sx: { borderRadius: 0, width: 620, maxWidth: '95vw', overflow: 'visible' } }}>
        <Box sx={{ textAlign: 'center', px: 2, pt: 3, pb: 2 }}>
          <Box sx={{ width: 108, height: 108, borderRadius: '50%', bgcolor: '#1c86f2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mt: -9, mb: 1.5, fontSize: 56, fontWeight: 700 }}>i</Box>
          <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#000', mb: 1.5 }}>Confirm Categories</Typography>
          <Typography sx={{ fontSize: 15, color: '#000', mb: 1 }}>
            {applyToAll ? "You've chosen to apply the stocktake to all products." : "You've selected the following categories to apply the stocktake to:"}
          </Typography>
          {!applyToAll && (
            <Stack direction="row" justifyContent="center" flexWrap="wrap" gap={1} sx={{ mb: 1.5 }}>
              {finaliseCategories.length === 0 && <Typography sx={{ fontSize: 14, color: '#676b72' }}>(counted products only)</Typography>}
              {finaliseCategories.map((c) => (
                <Box key={c.id} sx={{ border: '1px solid #bdbdbd', px: 1, py: 0.25, fontSize: 13, color: '#313439' }}>{c.name}</Box>
              ))}
            </Stack>
          )}
          <Typography sx={{ fontSize: 15, color: '#000', mb: 1.5 }}>Is this correct?</Typography>
          <Typography sx={{ fontSize: 15, color: '#000', mb: 2.5 }}>Note, you'll be able to decide whether to zero or ignore stock not scanned on the next screen.</Typography>
          <Stack direction="row" spacing={2}>
            <Button fullWidth disabled={finishing} onClick={() => setCompleteStep('finalise')} sx={{ ...FINISH_OPTION_SX, borderRadius: 0, border: '1px solid #000', fontSize: 24, fontWeight: 400, bgcolor: '#f3f3f3' }}>No</Button>
            <Button fullWidth disabled={finishing} onClick={finaliseComplete} sx={{ ...FINISH_PRIMARY_SX, borderRadius: 0, fontSize: 24, fontWeight: 400 }}>{finishing ? 'Completing...' : 'Yes'}</Button>
          </Stack>
        </Box>
      </Dialog>
    </Box>
  );
}

const FINISH_OPTION_SX = {
  textTransform: 'none', fontSize: 15, fontWeight: 600, borderRadius: '6px', px: 2.5,
  bgcolor: '#e5e5e5', color: '#313439', boxShadow: 'none', '&:hover': { bgcolor: '#d4d4d4', boxShadow: 'none' },
};
const FINISH_PRIMARY_SX = {
  textTransform: 'none', fontSize: 15, fontWeight: 600, borderRadius: '6px', px: 2.5,
  bgcolor: '#5ebbeb', color: '#fff', boxShadow: 'none', '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' },
  '&.Mui-disabled': { bgcolor: '#a3d5ef', color: '#fff' },
};

// Reference question popup: big blue "?" badge, title, one full-width blue
// button per option (no description text).
function QuestionDialog({ open, title, options, disabled }) {
  return (
    <Dialog open={open} onClose={() => {}} PaperProps={{ sx: { borderRadius: 0, width: 420, maxWidth: '95vw', overflow: 'visible' } }}>
      <Box sx={{ textAlign: 'center', px: 2, pt: 3, pb: 2 }}>
        <Box sx={{ width: 108, height: 108, borderRadius: '50%', bgcolor: '#1c86f2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mt: -9, mb: 1.5, fontSize: 64, fontWeight: 700 }}>?</Box>
        <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#000', mb: 2 }}>{title}</Typography>
        <Stack spacing={1.25}>
          {options.map((o) => (
            <Button key={o.label} fullWidth disabled={disabled} onClick={o.onClick} sx={{ ...FINISH_PRIMARY_SX, borderRadius: 0, fontSize: 16, height: 48 }}>{o.label}</Button>
          ))}
        </Stack>
      </Box>
    </Dialog>
  );
}

// Finish-flow dialog shell (same light-blue header bar as the New Stocktake dialog).
function FinishDialog({ open, onClose, title, icon, children, width = 420, headerBg, headerColor }) {
  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx: { borderRadius: '8px', width, maxWidth: '95vw' } }}>
      <Box sx={{ bgcolor: headerBg || 'rgb(190,227,248)', display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25 }}>
        {icon}
        <Typography sx={{ color: headerColor || 'rgb(38,99,143)', fontSize: 18, fontWeight: 700 }}>{title}</Typography>
      </Box>
      <Box sx={{ px: 2, py: 2 }}>{children}</Box>
    </Dialog>
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
                        label={activity.eventType === 'Count' ? 'Scan' : activity.eventType}
                        size="small"
                        color={activity.eventType === 'Scan' || activity.eventType === 'Count' ? 'primary' : activity.eventType === 'Sale' ? 'success' : 'default'}
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

