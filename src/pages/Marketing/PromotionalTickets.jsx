import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Box, Typography, Button, Select, MenuItem, CircularProgress, Alert, Snackbar } from '@mui/material';
import { ChevronRight as ChevronRightIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import promotionService from '../../services/promotionService';
import productService from '../../services/productService';
import promotionCategoryService from '../../services/promotionCategoryService';
import { SquareCheckButton, TicketCounter } from '../../components/ShelfTickets/TicketControls';
import {
  INSTANT,
  TICKET_BAR_SX,
  EXPORT_BUTTON_SX,
  BAR_CLEARANCE,
  downloadCsv,
} from '../../components/ShelfTickets/ticketChrome';
import PrintTicketsDialog from '../../components/ShelfTickets/PrintTicketsDialog';

const RECEIVE_TEXT = {
  quantity_only: '(quantity only)',
  each_item_for: 'each item for',
  total_price: 'a total price of',
  discount_each_item: 'a discount on each item worth',
  discount_total: 'a discount off the total worth',
  percentage_discount: 'a percentage discount of',
  same_sell_rate: 'the same sell rate as if the quantity was',
  discount: 'a discount of',
};

// Same phrasing as the promotion view: 'Optionally purchase 24 to receive a total price of $124.99'.
const criterionSummary = (criterion) => {
  const optional = criterion.isOptional ? 'Optionally' : '';
  const purchase = criterion.purchaseType === 'purchase' ? 'purchase' : 'spend';
  const receive = RECEIVE_TEXT[criterion.receiveType] || 'a total price of';
  const value = Number(criterion.receiveValue) || 0;
  const amount = criterion.receiveType === 'percentage_discount' ? `${value.toFixed(2)}%` : `$${value.toFixed(2)}`;
  return `${optional} ${purchase} ${criterion.purchaseValue} to receive ${receive} ${amount}`.trim();
};

const LINE_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  width: '100%',
  height: 51,
  p: 2,
  border: 0,
  fontFamily: 'inherit',
  fontSize: 16,
  textAlign: 'left',
  cursor: 'pointer',
  transition: INSTANT,
};

const SELECT_SX = {
  width: '100%',
  height: 42,
  borderRadius: '8px',
  bgcolor: '#fff',
  fontSize: 16,
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#525252', borderWidth: '1px' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#525252', borderWidth: '1px' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
};

const MENU_PROPS = {
  transitionDuration: 0,
  PaperProps: {
    sx: {
      borderRadius: '8px',
      maxHeight: 288,
      '& .MuiMenuItem-root': { height: 56, fontSize: 16, color: '#0a0a0a' },
      '& .MuiMenuItem-root.Mui-selected': { bgcolor: 'transparent', color: '#00a6f4' },
      '& .MuiMenuItem-root.Mui-selected:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
    },
  },
};

const PromotionalTickets = () => {
  const { getOutletId } = useAuth();
  const [promotions, setPromotions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [expanded, setExpanded] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [printOpen, setPrintOpen] = useState(false);
  const [printTickets, setPrintTickets] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const showSnackbar = (message, severity) => setSnackbar({ open: true, message, severity });

  // Promotion rows may not carry the product barcode/sku, so build a productId -> { barcode, sku }
  // map from the catalog once (cached), the same limit:1000 read the Everyday page uses.
  const productMapRef = useRef(null);
  const ensureProductMap = useCallback(async () => {
    if (productMapRef.current) return productMapRef.current;
    const response = await productService.getProducts({ limit: 1000, outletId: getOutletId() });
    const list = response.products || response.data || [];
    const map = new Map();
    list.forEach((p) =>
      map.set(p.id, {
        barcode: p.barcode || p.barcodes?.[0]?.code || '',
        sku: p.sku || p.metcashMsc || p.barcodes?.[0]?.code || String(p.id),
      })
    );
    productMapRef.current = map;
    return map;
  }, [getOutletId]);

  const fetchPromotions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await promotionService.getPromotions({
        page: 1,
        limit: 1000,
        isActive: true,
        outletId: getOutletId(),
      });
      setPromotions(Array.isArray(response.promotions) ? response.promotions : []);
    } catch (error) {
      console.error('Error fetching promotions:', error);
      showSnackbar('Failed to fetch promotions', 'error');
    } finally {
      setLoading(false);
    }
  }, [getOutletId]);

  useEffect(() => {
    fetchPromotions();
  }, [fetchPromotions]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await promotionCategoryService.getPromotionCategories(getOutletId());
        setCategories(
          Array.isArray(response) ? response : Array.isArray(response?.promotionCategories) ? response.promotionCategories : []
        );
      } catch (error) {
        console.error('Error fetching promotion categories:', error);
        setCategories([]);
      }
    };
    fetchCategories();
  }, [getOutletId]);

  /**
   * Shopfront cannot export three kinds of promotion to DesignPro, so they never
   * appear here: inactive promotions, advanced promotions with more than one
   * criteria, and promotions that contain no products (classifications are not
   * exported). Each remaining promotion becomes promotion -> criteria -> products.
   */
  const tree = useMemo(
    () =>
      promotions
        .filter((promotion) => {
          if (!promotion.isActive) return false;
          if ((promotion.conditions?.criteria || []).length > 1) return false;
          if (categoryFilter && promotion.categoryId !== categoryFilter) return false;
          return (promotion.items || []).some((item) => item.productId);
        })
        .map((promotion) => {
          const products = (promotion.items || []).filter((item) => item.productId);
          const criterion = (promotion.conditions?.criteria || [])[0] || null;
          return {
            id: promotion.id,
            name: promotion.name,
            criterionLabel: criterion ? criterionSummary(criterion) : null,
            products: products.map((item) => ({
              key: `${promotion.id}:${item.productId}`,
              productId: item.productId,
              name: item.product?.name || item.productName || 'Unknown Product',
              // Fast path: use the product barcode/sku if the promotion payload already
              // carries the product relation; otherwise enriched from the catalog at print time.
              barcode: item.product?.barcode || item.product?.barcodes?.[0]?.code || '',
              sku: item.product?.sku || item.product?.metcashMsc || item.product?.barcodes?.[0]?.code || '',
              quantity: item.quantity || 1,
              promoPrice: Number(item.promoPrice) || 0,
              normalPrice: Number(item.normalPrice) || 0,
              promotionName: promotion.name,
            })),
          };
        }),
    [promotions, categoryFilter]
  );

  const allKeys = useMemo(() => tree.flatMap((p) => p.products.map((product) => product.key)), [tree]);
  const isSelected = (key) => selected.includes(key);
  const allSelected = allKeys.length > 0 && allKeys.every(isSelected);

  // Selecting a promotion (or its criteria line) selects every product ticket under it.
  const toggleKeys = (keys) => {
    const every = keys.every(isSelected);
    setSelected((prev) => (every ? prev.filter((k) => !keys.includes(k)) : [...new Set([...prev, ...keys])]));
  };

  const toggleExpanded = (id) =>
    setExpanded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Print selected promotion-product tickets: normal price is the ticket price and the
  // promo price is the sale price; the promotion name stands in for the category line.
  const handlePrint = async () => {
    const rows = tree
      .flatMap((promotion) => promotion.products)
      .filter((product) => isSelected(product.key));

    if (rows.length === 0) {
      showSnackbar('No tickets selected to print', 'warning');
      return;
    }

    // Enrich barcode/sku from the catalog only when a selected row is missing them.
    let productMap = null;
    if (rows.some((product) => !product.barcode || !product.sku)) {
      try {
        productMap = await ensureProductMap();
      } catch (error) {
        console.error('Error loading product barcodes:', error);
      }
    }

    setPrintTickets(
      rows.map((product) => {
        const extra = productMap?.get(product.productId);
        return {
          name: product.name,
          price: product.normalPrice,
          salePrice: product.promoPrice,
          category: product.promotionName,
          barcode: product.barcode || extra?.barcode || '',
          sku: product.sku || extra?.sku || '',
        };
      })
    );
    setPrintOpen(true);
  };

  // 'Tick the Promotions or the Products you wish to export, then press Export' — the
  // reference hands the ticked rows to DesignPro as a data file; here that is a download.
  const handleExport = () => {
    const rows = tree.flatMap((promotion) => promotion.products).filter((product) => isSelected(product.key));
    if (rows.length === 0) {
      showSnackbar('No tickets selected to export', 'warning');
      return;
    }
    downloadCsv(
      'promotional-tickets.csv',
      ['NAME', 'BARCODE', 'SKU', 'QUANTITY', 'NPRICE', 'PPRICE', 'C_GROUP'],
      rows.map((product) => [
        product.name,
        product.barcode || '',
        product.sku || '',
        product.quantity,
        product.normalPrice.toFixed(2),
        product.promoPrice.toFixed(2),
        product.promotionName,
      ])
    );
  };

  return (
    // pb keeps the last row clear of the fixed action bar.
    <Box sx={{ p: 3, pb: BAR_CLEARANCE }}>
      <Box sx={{ width: 700, maxWidth: '100%', mx: 'auto' }}>
        <Typography variant="h1" sx={{ fontSize: 32, fontWeight: 700, mb: 1 }}>
          Promotional Tickets
        </Typography>
        <Typography sx={{ fontSize: 16, color: '#313439', mb: 3 }}>
          Only promotions that are express or have a single criteria and uses the type of &quot;Sell Total&quot;.
        </Typography>

        <Typography sx={{ mb: 0.5, fontSize: 14, color: '#676b72' }}>Promotional Category</Typography>
        <Select
          displayEmpty
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          renderValue={(value) =>
            categories.find((c) => c.id === value)?.name || (
              <Box component="span" sx={{ color: '#808080' }}>
                All Promotions
              </Box>
            )
          }
          MenuProps={MENU_PROPS}
          sx={{ ...SELECT_SX, mb: 3 }}
        >
          <MenuItem value="">All Promotions</MenuItem>
          {categories.map((category) => (
            <MenuItem key={category.id} value={category.id}>
              {category.name}
            </MenuItem>
          ))}
        </Select>

        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, py: 10 }}>
            <CircularProgress size={22} sx={{ color: '#737373' }} />
            <Typography sx={{ fontSize: 16, color: '#737373' }}>Loading results...</Typography>
          </Box>
        ) : (
          <Box>
            <Box sx={{ ...LINE_SX, bgcolor: 'transparent', color: '#313439', cursor: 'default' }}>
              <SquareCheckButton checked={allSelected} onClick={() => toggleKeys(allKeys)} label="Select all promotions" />
              Select All
            </Box>

            {tree.length === 0 && (
              <Box sx={{ ...LINE_SX, bgcolor: 'transparent', color: '#676b72', cursor: 'default' }}>
                No promotions available for tickets
              </Box>
            )}

            {tree.map((promotion) => {
              const keys = promotion.products.map((product) => product.key);
              const open = expanded.includes(promotion.id);
              return (
                <Box key={promotion.id}>
                  <Box sx={{ ...LINE_SX, bgcolor: '#676b72', color: '#f8f8f8', cursor: 'default' }}>
                    <SquareCheckButton
                      checked={keys.every(isSelected)}
                      onClick={() => toggleKeys(keys)}
                      light
                      label={`Select ${promotion.name}`}
                    />
                    <Box sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {promotion.name}
                    </Box>
                    <Box
                      component="button"
                      type="button"
                      aria-label={open ? `Collapse ${promotion.name}` : `Expand ${promotion.name}`}
                      aria-expanded={open}
                      onClick={() => toggleExpanded(promotion.id)}
                      sx={{
                        display: 'flex',
                        p: 0,
                        border: 0,
                        bgcolor: 'transparent',
                        color: '#f8f8f8',
                        cursor: 'pointer',
                        transition: INSTANT,
                      }}
                    >
                      {open ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                    </Box>
                  </Box>

                  {open && (
                    <>
                      {promotion.criterionLabel && (
                        <Box sx={{ ...LINE_SX, bgcolor: 'transparent', color: '#313439', fontWeight: 700, cursor: 'default' }}>
                          <SquareCheckButton
                            checked={keys.every(isSelected)}
                            onClick={() => toggleKeys(keys)}
                            label={`Select ${promotion.criterionLabel}`}
                          />
                          {promotion.criterionLabel}
                        </Box>
                      )}
                      {promotion.products.map((product) => (
                        <Box
                          key={product.key}
                          sx={{ ...LINE_SX, bgcolor: 'transparent', color: '#676b72', pl: 4, cursor: 'default' }}
                        >
                          <SquareCheckButton
                            checked={isSelected(product.key)}
                            onClick={() => toggleKeys([product.key])}
                            label={`Select ${product.name}`}
                          />
                          {product.name}
                        </Box>
                      ))}
                    </>
                  )}
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      <Box sx={{ ...TICKET_BAR_SX, justifyContent: 'flex-end', gap: 2 }}>
        <TicketCounter count={selected.length} />
        {/* Print (ours) stays; Export matches the reference and its DesignPro data file. */}
        <Button disableRipple disableElevation onClick={handlePrint} sx={EXPORT_BUTTON_SX}>
          Print
        </Button>
        <Button disableRipple disableElevation onClick={handleExport} sx={EXPORT_BUTTON_SX}>
          Export
        </Button>
      </Box>

      <PrintTicketsDialog
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        tickets={printTickets}
        ticketType="Promotional"
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PromotionalTickets;
