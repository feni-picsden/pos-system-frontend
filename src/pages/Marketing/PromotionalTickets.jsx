import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, Alert, Snackbar, Collapse } from '@mui/material';
import { ChevronRight as ChevronRightIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import promotionService from '../../services/promotionService';
import promotionCategoryService from '../../services/promotionCategoryService';
import { SquareCheckButton, TicketCounter } from '../../components/ShelfTickets/TicketControls';
import TicketSelect from '../../components/ShelfTickets/TicketSelect';
import {
  INSTANT,
  TICKET_BAR_SX,
  EXPORT_BUTTON_SX,
  BAR_CLEARANCE,
  downloadCsv,
} from '../../components/ShelfTickets/ticketChrome';

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
  const text = `${optional} ${purchase} ${criterion.purchaseValue} to receive ${receive} ${amount}`.trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
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

/** Reference empty state: a large circle-slash glyph beside the title and line. */
const EmptyGlyph = () => (
  <Box
    component="svg"
    viewBox="0 0 100 100"
    sx={{ width: 140, height: 140, flexShrink: 0 }}
    aria-hidden="true"
  >
    <circle cx="50" cy="50" r="40" fill="none" stroke="#000" strokeWidth="6" />
    <line x1="14" y1="86" x2="90" y2="10" stroke="#000" strokeWidth="6" strokeLinecap="round" />
  </Box>
);

const PromotionalTickets = () => {
  const { getOutletId } = useAuth();
  const [promotions, setPromotions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState(''); // category NAME ('' = All Promotions)
  const [expanded, setExpanded] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const showSnackbar = (message, severity) => setSnackbar({ open: true, message, severity });

  // Outlet-wise: a null outletId is dropped by the service, so under a navbar outlet
  // the apiClient stamps that outlet and only its promotions come back.
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

  const categoryNames = useMemo(() => categories.map((c) => c.name).filter(Boolean), [categories]);
  const categoryId = useMemo(
    () => categories.find((c) => c.name === categoryFilter)?.id ?? null,
    [categories, categoryFilter]
  );

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
          if (categoryId != null && promotion.categoryId !== categoryId) return false;
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
              barcode: item.product?.barcode || item.product?.barcodes?.[0]?.code || '',
              sku: item.product?.sku || item.product?.metcashMsc || item.product?.barcodes?.[0]?.code || '',
              quantity: item.quantity || 1,
              promoPrice: Number(item.promoPrice) || 0,
              normalPrice: Number(item.normalPrice) || 0,
              promotionName: promotion.name,
            })),
          };
        }),
    [promotions, categoryId]
  );

  const allKeys = useMemo(() => tree.flatMap((p) => p.products.map((product) => product.key)), [tree]);
  const isSelected = (key) => selected.includes(key);
  // Only tickets on screen count: a selection left over from another category must
  // not export, nor keep "Deselect All" lit.
  const visibleSelected = useMemo(() => selected.filter((k) => allKeys.includes(k)), [selected, allKeys]);
  // Reference: the top square is ticked as soon as ANY ticket is selected and reads
  // "Deselect All"; clicking it then clears, otherwise it selects everything.
  const anySelected = visibleSelected.length > 0;
  const toggleAll = () => setSelected(anySelected ? [] : allKeys);

  // Selecting a promotion (or its criteria line) selects every product ticket under it;
  // its square is ticked while ANY of its products is selected (reference).
  const toggleKeys = (keys) => {
    const every = keys.every(isSelected);
    setSelected((prev) => (every ? prev.filter((k) => !keys.includes(k)) : [...new Set([...prev, ...keys])]));
  };

  const toggleExpanded = (id) =>
    setExpanded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

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

        {/* Reference: the same combobox as Everyday Tickets - categories only in the list,
            'All Promotions' as the resting placeholder, x clears back to it. */}
        <Box sx={{ mb: 3 }}>
          <TicketSelect
            label="Promotional Category"
            placeholder="All Promotions"
            value={categoryFilter}
            options={categoryNames}
            onChange={(value) => setCategoryFilter(value || '')}
            clearable
            fullWidth
          />
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, py: 10 }}>
            <CircularProgress size={22} sx={{ color: '#737373' }} />
            <Typography sx={{ fontSize: 16, color: '#737373' }}>Loading results...</Typography>
          </Box>
        ) : tree.length === 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, pt: 5 }}>
            <EmptyGlyph />
            <Box>
              <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#000', mb: 2 }}>No Promotions</Typography>
              <Typography sx={{ fontSize: 16, color: '#000' }}>There are no promotions available to export.</Typography>
            </Box>
          </Box>
        ) : (
          <Box>
            <Box sx={{ ...LINE_SX, bgcolor: 'transparent', color: '#313439', cursor: 'default' }}>
              <SquareCheckButton
                checked={anySelected}
                onClick={toggleAll}
                label={anySelected ? 'Deselect all promotions' : 'Select all promotions'}
              />
              {anySelected ? 'Deselect All' : 'Select All'}
            </Box>

            {tree.map((promotion) => {
              const keys = promotion.products.map((product) => product.key);
              const some = keys.some(isSelected);
              const open = expanded.includes(promotion.id);
              return (
                <Box key={promotion.id}>
                  {/* The whole header row expands/collapses (not just the arrow); the
                      square inside stops the click so ticking never toggles the row. */}
                  <Box
                    role="button"
                    tabIndex={0}
                    aria-expanded={open}
                    onClick={() => toggleExpanded(promotion.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleExpanded(promotion.id);
                      }
                    }}
                    sx={{
                      ...LINE_SX,
                      bgcolor: '#676b72',
                      color: '#f8f8f8',
                      cursor: 'pointer',
                      outline: 'none',
                      userSelect: 'none',
                      '&:hover': { bgcolor: '#5c6066' },
                    }}
                  >
                    <Box onClick={(e) => e.stopPropagation()} sx={{ display: 'flex' }}>
                      <SquareCheckButton
                        checked={some}
                        onClick={() => toggleKeys(keys)}
                        light
                        label={`Select ${promotion.name}`}
                      />
                    </Box>
                    <Box sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {promotion.name}
                    </Box>
                    {open ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                  </Box>

                  <Collapse in={open} timeout={200} unmountOnExit>
                    <>
                      {promotion.criterionLabel && (
                        <Box sx={{ ...LINE_SX, bgcolor: 'transparent', color: '#313439', fontWeight: 700, cursor: 'default' }}>
                          <SquareCheckButton
                            checked={some}
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
                  </Collapse>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      <Box sx={{ ...TICKET_BAR_SX, justifyContent: 'flex-end', gap: 2 }}>
        <TicketCounter count={visibleSelected.length} />
        {/* Reference bar: Export only - printing is done from the exported file. */}
        <Button
          disableRipple
          disableElevation
          onClick={handleExport}
          disabled={visibleSelected.length === 0}
          sx={{ ...EXPORT_BUTTON_SX, '&.Mui-disabled': { bgcolor: '#d4d4d4', color: '#fff', borderColor: '#d4d4d4', opacity: 1 } }}
        >
          Export
        </Button>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
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
