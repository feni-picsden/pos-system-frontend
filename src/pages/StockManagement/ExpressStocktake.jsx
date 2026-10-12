import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Stack,
  Typography,
} from '@mui/material';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import CancelIcon from '@mui/icons-material/Cancel';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import productService from '../../services/productService';
import posLocalDb from '../../services/posLocalDb';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';

// Reference input style: 1px solid black, radius 0
const actualInputStyle = {
  width: 179,
  height: 37,
  border: '1px solid #000',
  borderRadius: 0,
  textAlign: 'center',
  fontSize: 16,
  outline: 'none',
  backgroundColor: '#fff',
  boxSizing: 'border-box',
};

const actionButtonSx = {
  width: 196,
  height: 42,
  borderRadius: '12px',
  fontWeight: 700,
  fontSize: 16,
  textTransform: 'none',
  boxShadow: 'none',
  transition: 'none',
  '&:hover': { boxShadow: 'none' },
};

// Highlight the matched substring in sky blue like the reference dropdown
function highlightMatch(name, term) {
  const idx = name.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1 || !term) return name;
  return (
    <>
      {name.slice(0, idx)}
      <Box component="span" sx={{ color: 'rgb(94,187,235)' }}>{name.slice(idx, idx + term.length)}</Box>
      {name.slice(idx + term.length)}
    </>
  );
}

export default function ExpressStocktake() {
  // In-app dialogs — these shadow window.alert/confirm/prompt on purpose.
  const { alert } = useAppDialogs();
  const { id } = useParams();
  const { selectedOutlet } = useSelectedOutlet();
  const [searchTerm, setSearchTerm] = useState('');
  const [showPrices, setShowPrices] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [actualCases, setActualCases] = useState('');
  const [actualItems, setActualItems] = useState('');
  const [stocktakedProducts, setStocktakedProducts] = useState([]);

  useEffect(() => {
    // Outlet-scoped page; nothing extra to load
  }, [id]);

  // Search products
  useEffect(() => {
    let isMounted = true;
    async function search() {
      if (searchTerm.length < 2) {
        setResults([]);
        setShowResults(searchTerm.length === 1);
        return;
      }
      try {
        // Local catalog search matches name + description + BARCODE; the API search only
        // matches name/description, so a scan has to resolve locally. Fall back to the
        // API when the local catalog has not been populated.
        let products = await posLocalDb.searchProductsAsync(searchTerm, 20, selectedOutlet?.id);
        if (!products.length) {
          ({ products } = await productService.getProducts({ search: searchTerm, limit: 20 }));
        }
        if (!isMounted) return;
        const mapped = (products || []).map(p => ({
          id: p.id,
          name: p.name,
          barcode: (p.barcodes && p.barcodes[0]) || '',
          caseQuantity: p.caseQuantity || 1,
          cost: p.itemCost || p.caseCost || 0,
          currentStockCases: p.currentStockCases || 0,
          currentStockItems: p.currentStockItems || 0,
          inventory: p.inventory || 0,
        }));
        setResults(mapped);
        setShowResults(true);
      } catch {
        setResults([]);
        setShowResults(false);
      }
    }
    search();
    return () => { isMounted = false; };
  }, [searchTerm, selectedOutlet?.id]);

  const selectProduct = (product) => {
    setSelectedProduct(product);
    setActualCases('');
    setActualItems('');
    setSearchTerm('');
    setShowResults(false);
  };

  const hasCases = selectedProduct && (selectedProduct.caseQuantity || 1) > 1;

  const calculateTotal = () => {
    const caseQty = selectedProduct ? (selectedProduct.caseQuantity || 1) : 1;
    return (parseInt(actualCases) || 0) * caseQty + (parseInt(actualItems) || 0);
  };

  const pushHistory = (product, totalItems, action, newInventory, newStockItems) => {
    setStocktakedProducts([{
      ...product,
      actualItems: totalItems,
      inventory: newInventory,
      currentStockItems: newStockItems,
      action,
      timestamp: new Date(),
      historyCases: Math.trunc(totalItems / (product.caseQuantity || 1)),
      historyItems: totalItems - Math.trunc(totalItems / (product.caseQuantity || 1)) * (product.caseQuantity || 1),
    }, ...stocktakedProducts]);
    setRecentStocktakes([]); // reloaded on the next select
  };

  // Reference panel extras (checked on the TEST store 09/10/2026): "Show Prices"
  // lists the product's PRICE POINTS ("1 for $5.00"), and under the panel the
  // product's RECENT STOCKTAKES ("Counted by TEST · 12 minutes ago · 1 Cases 6 Items")
  // come from its inventory log, not from this session's scans.
  const [pricePoints, setPricePoints] = useState([]);
  const [recentStocktakes, setRecentStocktakes] = useState([]);
  useEffect(() => {
    if (!selectedProduct?.id) { setPricePoints([]); setRecentStocktakes([]); return undefined; }
    let alive = true;
    productService.getProduct(selectedProduct.id)
      .then((r) => {
        if (!alive) return;
        const rows = (r?.product?.prices || r?.prices || [])
          .filter((pr) => pr.priceSetId == null)
          .map((pr) => ({ quantity: Number(pr.quantity) || 1, price: Number(pr.price) || 0 }))
          .sort((a, b) => a.quantity - b.quantity);
        setPricePoints(rows);
      })
      .catch(() => alive && setPricePoints([]));
    productService.getProductInventoryLog(selectedProduct.id, { limit: 50 })
      .then((r) => {
        if (!alive) return;
        const logs = r?.data?.logs || [];
        setRecentStocktakes(logs.filter((l) => l.eventType === 'STOCKTAKE').slice(0, 10));
      })
      .catch(() => alive && setRecentStocktakes([]));
    return () => { alive = false; };
  }, [selectedProduct?.id]);

  const handleOverride = async () => {
    if (!selectedProduct) return;
    const totalItems = calculateTotal();
    const caseQty = selectedProduct.caseQuantity || 1;
    // currentStockCases/currentStockItems are two buckets of ONE total: cases hold the
    // whole cases, items hold the remainder. Writing the total into items as well as
    // deriving cases from it counts the cased stock twice.
    // Remainder from the floored cases, not `%`: for a negative total `%` is negative
    // too (-25 @24 -> -2 cases, -1 items = -49 units), so an override to -25 landed
    // as -49. The reference keeps -25 (checked 09/10/2026 on the TEST store).
    const cases = Math.trunc(totalItems / caseQty);
    const items = totalItems - cases * caseQty;
    try {
      await productService.updateProduct(selectedProduct.id, {
        inventory: totalItems,
        currentStockItems: items,
        currentStockCases: cases
      });
      pushHistory(selectedProduct, totalItems, 'Override', totalItems, items);
      setSelectedProduct(null);
      setActualCases('');
      setActualItems('');
    } catch (error) {
      console.error('Failed to override inventory:', error);
      alert('Failed to override inventory');
    }
  };

  const handleAdd = async () => {
    if (!selectedProduct) return;
    const totalItems = calculateTotal();
    if (!totalItems) { handleCancel(); return; } // nothing counted, nothing to add
    try {
      // Server-side DELTA: the API reads the LIVE row inside a transaction and
      // adds the counted units. Computing the new total here from the local
      // product mirror re-posted every sale made since the mirror was cached
      // (a 20-minute-old copy silently invented the units sold in between).
      const { product: updated } = await productService.adjustStock(selectedProduct.id, totalItems);
      pushHistory(selectedProduct, totalItems, 'Add', updated?.inventory ?? totalItems, updated?.currentStockItems ?? 0);
      setSelectedProduct(null);
      setActualCases('');
      setActualItems('');
    } catch (error) {
      console.error('Failed to add inventory:', error);
      alert('Failed to add inventory');
    }
  };

  const handleCancel = () => {
    setSelectedProduct(null);
    setActualCases('');
    setActualItems('');
  };

  const handlePanelKeyDown = (e) => {
    if (e.key === 'Escape') handleCancel();
  };

  const expectedItems = selectedProduct ? (selectedProduct.currentStockItems || 0) : 0;
  const expectedCases = selectedProduct ? (selectedProduct.currentStockCases || 0) : 0;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fff' }}>
      {/* Centered 800px content column */}
      <Box sx={{ maxWidth: 800, mx: 'auto', pt: 4, px: 2 }}>
        {/* Title row: title left, Show Prices toggle right (switch before label) */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: '#000' }}>
            Express Stocktake
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ cursor: 'pointer' }}
            onClick={() => setShowPrices(!showPrices)}
          >
            <ShopfrontSwitch checked={showPrices} onChange={(e) => setShowPrices(e.target.checked)} />
            <Typography sx={{ fontSize: 16, color: '#000' }}>Show Prices</Typography>
          </Stack>
        </Stack>
        <Typography sx={{ fontSize: '14.4px', color: '#676b72', mb: 3 }}>
          Scanning {selectedOutlet?.name || ''}
        </Typography>

        {/* Search Bar */}
        <Box sx={{ position: 'relative', mb: 3 }}>
          <Box
            component="input"
            type="text"
            placeholder="Search for a product or scan a barcode"
            value={searchTerm}
            disabled={!!selectedProduct}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setSearchTerm(''); setShowResults(false); }
            }}
            sx={{
              width: '100%',
              height: 53,
              boxSizing: 'border-box',
              border: '1px solid #000',
              borderRadius: 0,
              bgcolor: selectedProduct ? '#d4d4d4' : '#fff',
              fontSize: 16,
              px: 2,
              pr: 6,
              '&:focus': { outline: '1px solid rgb(16,16,16)' },
              '&::placeholder': { color: '#808080' },
            }}
          />
          {searchTerm && !selectedProduct && (
            <Box
              onClick={() => { setSearchTerm(''); setShowResults(false); }}
              sx={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                cursor: 'pointer',
                color: '#313439',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <CancelIcon sx={{ fontSize: 30 }} />
            </Box>
          )}
          {showResults && !selectedProduct && (
            <Box
              sx={{
                position: 'absolute',
                top: '100%',
                left: 0,
                width: '100%',
                zIndex: 10,
                border: '1px solid #000',
                borderTop: 'none',
                bgcolor: '#fff',
                maxHeight: 470,
                overflowY: 'auto',
              }}
            >
              <Typography
                sx={{
                  px: 2,
                  py: 1,
                  fontSize: 13,
                  color: '#676b72',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Products
              </Typography>
              {searchTerm.length < 2 ? (
                <Typography sx={{ px: 2, py: 1, fontSize: '19.2px', color: '#676b72' }}>
                  Start typing to search...
                </Typography>
              ) : results.map(r => (
                <Stack
                  key={r.id}
                  direction="row"
                  alignItems="center"
                  spacing={1.5}
                  onClick={() => selectProduct(r)}
                  sx={{
                    height: 41,
                    px: 2,
                    py: 1,
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    fontSize: '19.2px',
                    color: '#676b72',
                    '&:hover': {
                      bgcolor: 'rgb(139,206,241)',
                      color: 'rgb(248,248,248)',
                      '& span': { color: 'rgb(248,248,248)' },
                    },
                  }}
                >
                  <ImageOutlinedIcon sx={{ fontSize: 22, color: 'inherit' }} />
                  <Typography noWrap sx={{ fontSize: 'inherit', color: 'inherit' }}>
                    {highlightMatch(r.name, searchTerm)}
                  </Typography>
                </Stack>
              ))}
            </Box>
          )}
        </Box>

        {/* Product quantity entry panel — flat, no card */}
        {selectedProduct ? (
          <Box onKeyDown={handlePanelKeyDown} sx={{ mb: 4 }}>
            <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#313439' }}>
              {selectedProduct.name}
            </Typography>
            <Typography sx={{ fontSize: 16, color: '#676b72', mb: 2 }}>
              Case Quantity {selectedProduct.caseQuantity}
            </Typography>

            <Stack direction="row" spacing={4} alignItems="flex-start">
              {/* Grid */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: hasCases ? 'auto 179px 179px' : 'auto 179px',
                  columnGap: 3,
                  rowGap: 2,
                  alignItems: 'center',
                  flex: 1,
                }}
              >
                <Box />
                {hasCases && (
                  <Typography sx={{ fontSize: 16, fontWeight: 700, textAlign: 'center', color: '#000' }}>
                    CASES
                  </Typography>
                )}
                <Typography sx={{ fontSize: 16, fontWeight: 700, textAlign: 'center', color: '#000' }}>
                  ITEMS
                </Typography>

                <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#000' }}>EXPECTED</Typography>
                {hasCases && (
                  <Typography sx={{ fontSize: 16, textAlign: 'center', color: '#000' }}>
                    {expectedCases}
                  </Typography>
                )}
                <Typography sx={{ fontSize: 16, textAlign: 'center', color: '#000' }}>
                  {expectedItems}
                </Typography>

                <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#000' }}>ACTUAL</Typography>
                {hasCases && (
                  <Box
                    component="input"
                    type="number"
                    value={actualCases}
                    autoFocus
                    onChange={(e) => setActualCases(e.target.value)}
                    sx={{ ...actualInputStyle, '&:focus': { outline: '1px solid #000' } }}
                  />
                )}
                <Box
                  component="input"
                  type="number"
                  value={actualItems}
                  autoFocus={!hasCases}
                  onChange={(e) => setActualItems(e.target.value)}
                  sx={{ ...actualInputStyle, '&:focus': { outline: '1px solid #000' } }}
                />

                <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#000' }}>CALCULATED</Typography>
                {hasCases && (
                  <Typography sx={{ fontSize: 16, textAlign: 'center', color: '#000' }}>
                    {Math.trunc(calculateTotal() / (selectedProduct.caseQuantity || 1))}
                  </Typography>
                )}
                <Typography sx={{ fontSize: 16, textAlign: 'center', color: '#000' }}>
                  {/* remainder after the floored cases, so a negative count reads -2 / 23 (what Override saves), not -2 / -1 */}
                  {hasCases
                    ? calculateTotal() - Math.trunc(calculateTotal() / (selectedProduct.caseQuantity || 1)) * (selectedProduct.caseQuantity || 1)
                    : calculateTotal()}
                </Typography>
              </Box>

              {/* Buttons stacked vertically on the right */}
              <Stack spacing={1.5}>
                <Button
                  variant="contained"
                  disableRipple
                  onClick={handleOverride}
                  sx={{
                    ...actionButtonSx,
                    bgcolor: 'rgb(94,187,235)',
                    color: '#fff',
                    '&:hover': { bgcolor: 'rgb(14,165,233)', boxShadow: 'none' },
                  }}
                >
                  Override
                </Button>
                <Button
                  variant="contained"
                  disableRipple
                  onClick={handleAdd}
                  sx={{
                    ...actionButtonSx,
                    bgcolor: 'rgb(94,187,235)',
                    color: '#fff',
                    '&:hover': { bgcolor: 'rgb(14,165,233)', boxShadow: 'none' },
                  }}
                >
                  Add
                </Button>
                <Button
                  variant="contained"
                  disableRipple
                  onClick={handleCancel}
                  sx={{
                    ...actionButtonSx,
                    bgcolor: '#d9d9d9',
                    color: '#000',
                    '&:hover': { bgcolor: '#c9c9c9', boxShadow: 'none' },
                  }}
                >
                  Cancel
                </Button>
              </Stack>
            </Stack>

            {/* PRICE POINTS (Show Prices on): "1 for" over the price, one block per tier */}
            {showPrices && pricePoints.length > 0 && (
              <Box sx={{ mt: 3, pl: 2 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#313439', letterSpacing: '0.04em', mb: 1.5 }}>
                  PRICE POINTS
                </Typography>
                <Stack direction="row" spacing={5} flexWrap="wrap">
                  {pricePoints.map((pp) => (
                    <Box key={pp.quantity} sx={{ textAlign: 'center', minWidth: 80 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#676b72' }}>{pp.quantity} for</Typography>
                      <Typography sx={{ fontSize: 28, color: '#313439', lineHeight: 1.2 }}>${pp.price.toFixed(2)}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}

            {/* RECENT STOCKTAKES: this product's stocktake rows from its inventory log */}
            {recentStocktakes.length > 0 && (
              <Box sx={{ mt: 3, pl: 2 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#313439', letterSpacing: '0.04em', mb: 0.5 }}>
                  RECENT STOCKTAKES
                </Typography>
                {recentStocktakes.map((l, idx) => (
                  <Stack
                    key={l.id}
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ py: 1.5, px: 2, bgcolor: idx % 2 ? '#ebebeb' : 'transparent' }}
                  >
                    <Box>
                      <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#313439' }}>Counted by {l.user}</Typography>
                      <Typography sx={{ fontSize: '14.4px', color: '#676b72' }}>{formatTimeAgo(l.timestamp)}</Typography>
                    </Box>
                    <Stack direction="row" spacing={3} alignItems="center">
                      <Typography sx={{ fontSize: 16, color: '#676b72' }}>{l.after?.cases ?? 0} Cases</Typography>
                      <Typography sx={{ fontSize: 16, color: '#676b72' }}>{l.after?.items ?? 0} Items</Typography>
                    </Stack>
                  </Stack>
                ))}
              </Box>
            )}
          </Box>
        ) : (
          <>
            {/* SELECT A PRODUCT — flat header with hairline rule */}
            <Typography
              sx={{
                fontSize: 24,
                fontWeight: 400,
                color: '#676b72',
                textAlign: 'center',
                textTransform: 'uppercase',
              }}
            >
              Select a Product
            </Typography>
            <Box sx={{ borderBottom: '1px solid #e0e0e0', mt: 1, mb: 3 }} />
          </>
        )}

        {/* Scan History — this session's counts. Stays on screen under the selected
            product's panel too (reference: RECENT STOCKTAKES, a rule, then this). */}
        {selectedProduct && <Box sx={{ borderBottom: '1px solid #e0e0e0', mt: 3, mb: 1 }} />}
        {stocktakedProducts.length === 0 ? (
          (
            <Typography
              sx={{
                fontSize: 24,
                color: '#676b72',
                textAlign: 'center',
                textTransform: 'uppercase',
                py: 4,
              }}
            >
              No products have been stocktaked yet
            </Typography>
          )
        ) : (
          <Stack spacing={0} sx={{ mt: selectedProduct ? 3 : 0 }}>
            {/* Reference heading over the history list */}
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#313439', letterSpacing: '0.04em', mb: 0.5 }}>
              SCAN HISTORY
            </Typography>
            {stocktakedProducts.map((p, idx) => (
              <Stack
                key={idx}
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ py: 1.5, borderBottom: '1px solid #e0e0e0' }}
              >
                <Box>
                  <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#313439' }}>{p.name}</Typography>
                  {/* Reference row text is just the relative time ("A few seconds ago"). */}
                  <Typography sx={{ fontSize: '14.4px', color: '#676b72' }}>
                    {formatTimeAgo(p.timestamp)}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={3} alignItems="center">
                  <Typography sx={{ fontSize: 16, color: '#676b72' }}>{p.historyCases} Cases</Typography>
                  <Typography sx={{ fontSize: 16, color: '#676b72' }}>{p.historyItems} Items</Typography>
                </Stack>
              </Stack>
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  );
}

// Helper: format relative time like "a few seconds ago", "3 minutes ago"
function formatTimeAgo(date) {
  const target = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const seconds = Math.floor((now - target) / 1000);
  if (seconds < 60) return 'a few seconds ago';
  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return 'a minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'A day ago' : `${days} days ago`;
}
