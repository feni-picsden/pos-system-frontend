import React, { useState, useEffect, useMemo, useCallback, useRef, useDeferredValue, memo } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Snackbar,
  Autocomplete,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  ArrowDropDown as ArrowDropDownIcon,
  LocalOfferOutlined as CategoryIcon,
  HomeOutlined as FamilyIcon,
  ImageOutlined as ProductIcon,
} from '@mui/icons-material';
import PageLoader from '../../components/Common/PageLoader';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import productService from '../../services/productService';
import shelfTicketService from '../../services/shelfTicketService';
import { queueEverydayTicket } from '../../utils/priceChangeTicket';
import settingsService from '../../services/settingsService';
import { effectiveUnitCost, profitPercent } from '../../utils/productCost';

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    height: 42,
    borderRadius: '8px',
    backgroundColor: '#fff',
    '& fieldset': { borderColor: '#404040', borderWidth: '1px' },
    '&:hover fieldset': { borderColor: '#404040' },
    '&.Mui-focused fieldset': { borderColor: '#000', borderWidth: '2px' },
  },
  '& .MuiOutlinedInput-input::placeholder': { color: '#808080', opacity: 1 },
};

// Search dropdown, as the reference: under 2 typed characters only a hint;
// then Categories, Families and Products (A-Z) whose name contains the text.
const GROUP_ORDER = ['Categories', 'Families', 'Products'];
const GROUP_ICONS = { Categories: CategoryIcon, Families: FamilyIcon, Products: ProductIcon };
const HINT_OPTION = { type: 'hint', label: 'Keep Typing to Search...' };
const ALL_PRODUCTS_LIMIT = 100000;
// Rows are drawn in steps as the grid scrolls (a row is up to a dozen inputs).
const ROWS_STEP = 30;
// Price set names are coloured per set, in name order (reference: Grampians -
// Ararat #143055, Premix King - Portland #6a742a); Default stays black.
const SET_COLOURS = ['#143055', '#6a742a', '#7a2e2e', '#2e6f6f', '#5b3a7a', '#7a5a1e'];

// Price cells: the look of the outlined fields above (1px #404040, radius 8,
// 2px black when focused, "$" prefix), set once on the table body.
const PRICE_CELL_SX = {
  '& .bpe-box': {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: 150,
    height: 42,
    margin: '0 auto', // centred under its quantity header, like the % below it
    boxSizing: 'border-box',
    padding: '0 14px',
    border: '1px solid #404040',
    borderRadius: '8px',
    backgroundColor: '#fff',
    fontSize: 16,
    cursor: 'text',
  },
  '& .bpe-box:focus-within': { border: '2px solid #000', padding: '0 13px' },
  '& .bpe-box span': { color: 'rgba(0, 0, 0, 0.6)' },
  '& .bpe-box input': {
    flex: 1,
    minWidth: 0,
    border: 0,
    outline: 0,
    padding: 0,
    background: 'transparent',
    font: 'inherit',
    color: '#000',
    MozAppearance: 'textfield',
    '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
  },
  '& .bpe-pct': { fontSize: 12, color: '#676b72', marginTop: '4px' },
};

const hasStock = (product) => (product.currentStockCases || 0) > 0 || (product.currentStockItems || 0) > 0;

// One grid row per product per price set (Default + each named set), built from
// the server's stockRows. Rows of a product run by their smallest quantity,
// Default before a set at the same quantity, then set id (reference order).
const rowsForProduct = (product) => {
  const groups = new Map();
  (product.stockRows || []).forEach((r) => {
    const setId = r.priceSetId ?? null;
    if (!groups.has(setId)) groups.set(setId, { priceSetId: setId, priceSetName: r.priceSetName || null, prices: {}, minQty: Infinity });
    const g = groups.get(setId);
    const qty = Number(r.quantity) || 1;
    g.prices[qty] = r.price;
    g.minQty = Math.min(g.minQty, qty);
  });
  // No prices at all: one empty Default row, so a price can be typed in
  if (!groups.size) groups.set(null, { priceSetId: null, priceSetName: null, prices: {}, minQty: Infinity });
  return [...groups.values()]
    .sort((a, b) => a.minQty - b.minQty || (a.priceSetId ?? -1) - (b.priceSetId ?? -1))
    .map((g) => ({ ...g, product, key: `${product.id}:${g.priceSetId ?? 'd'}` }));
};

// Reference "No Products" panel: a crossed circle beside the message
const EmptyIcon = () => (
  <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
    <circle cx="70" cy="70" r="55" fill="none" stroke="#000" strokeWidth="10" />
    <line x1="132" y1="8" x2="8" y2="132" stroke="#000" strokeWidth="10" strokeLinecap="round" />
  </svg>
);

// One grid row. Memoised: typing in a price re-draws only its own row.
const PriceRow = memo(function PriceRow({ row, quantities, edits, setColour, onEdit, onCommit, profitFor }) {
  const { product, priceSetId, priceSetName, prices, key } = row;
  return (
    <TableRow>
      <TableCell>{product.name}</TableCell>
      <TableCell>{product.caseQuantity}</TableCell>
      <TableCell>
        {priceSetId == null ? 'Default' : <Box component="span" sx={{ color: setColour }}>{priceSetName}</Box>}
      </TableCell>
      {quantities.map((quantity) => {
        const typed = edits?.[quantity];
        const stored = prices[quantity] ?? '';
        // Reference shows a stored price to the cent without trailing zeros
        // (11.99953980671882 -> 12, 2.50 -> 2.5); only typing saves a new one.
        const value = typed !== undefined ? typed : (stored === '' ? '' : String(Math.round(Number(stored) * 100) / 100));
        const pct = profitFor(product, quantity, typed !== undefined ? typed : stored);
        // A plain input styled by the table body (PRICE_CELL_SX): a MUI TextField
        // per cell made a dozen-column grid freeze on every filter change.
        return (
          <TableCell key={quantity} align="center" className="bpe-cell">
            <label className="bpe-box">
              <span>$</span>
              <input
                type="number"
                value={value}
                onChange={(e) => onEdit(key, quantity, e.target.value)}
                onBlur={() => onCommit(row, quantity)}
                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
              />
            </label>
            {/* Two decimals, the precision the Sell & Cost tab shows and stores;
                blank when there is no profit to show (no price or no cost) */}
            <div className="bpe-pct">{pct == null ? ' ' : `${pct.toFixed(2)}%`}</div>
          </TableCell>
        );
      })}
    </TableRow>
  );
});

const BulkPriceEdit = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOption, setSelectedOption] = useState(null);
  const [onlyStock, setOnlyStock] = useState(false);
  const [extraQuantities, setExtraQuantities] = useState([]);
  const [newQuantity, setNewQuantity] = useState('');
  // Typed, not yet saved prices: { rowKey: { quantity: text } }
  const [edits, setEdits] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const searchBoxRef = useRef(null);
  const searchPopperRef = useRef(null);
  const [searchBoxWidth, setSearchBoxWidth] = useState(null);
  const moreRowsRef = useRef(null);
  // The grid scrolls inside itself down to the window's bottom edge, so its
  // sideways scrollbar is always in view and the header stays on top (reference).
  const gridRef = useRef(null);
  const [gridHeight, setGridHeight] = useState(null);
  // Saves read the latest state without re-creating the row callbacks.
  const productsRef = useRef(products);
  productsRef.current = products;
  const editsRef = useRef(edits);
  editsRef.current = edits;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // Every product (all statuses) with its Default and price-set rows
        const response = await productService.getProducts({
          status: 'Active,Inactive,Not Selling,Not Purchasing',
          includeAllStatuses: true,
          withPriceSets: 1,
          limit: ALL_PRODUCTS_LIMIT,
        });
        setProducts(response?.products || []);
      } catch (error) {
        console.error('Error loading products:', error);
        setSnackbar({ open: true, message: 'Error loading products', severity: 'error' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // The search list keeps the box's width when the page scrollbar comes or goes
  useEffect(() => {
    const el = searchBoxRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(() => setSearchBoxWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading]);
  useEffect(() => {
    searchPopperRef.current?.update?.();
  }, [searchBoxWidth]);

  // ---- scope: the grid follows the selection and the stock switch in the
  // background, so both answer at once while the rows catch up ----
  const gridOption = useDeferredValue(selectedOption);
  const gridStock = useDeferredValue(onlyStock);
  const updating = gridOption !== selectedOption || gridStock !== onlyStock;

  const scopedProducts = useMemo(() => {
    let list = products;
    if (gridOption?.type === 'Products') list = list.filter((p) => p.id === gridOption.id);
    else if (gridOption?.type === 'Categories') list = list.filter((p) => p.category?.name === gridOption.label);
    else if (gridOption?.type === 'Families') list = list.filter((p) => p.family?.name === gridOption.label);
    // Reference: the stock switch applies to a picked product too
    if (gridStock) list = list.filter(hasStock);
    return list;
  }, [products, gridOption, gridStock]);

  const rows = useMemo(() => scopedProducts.flatMap(rowsForProduct), [scopedProducts]);

  // Columns are the quantities the shown rows price (plus any added ones)
  const quantities = useMemo(() => {
    const set = new Set(extraQuantities);
    rows.forEach((r) => Object.keys(r.prices).forEach((q) => set.add(Number(q))));
    const list = [...set].sort((a, b) => a - b);
    return list.length ? list : [1];
  }, [rows, extraQuantities]);

  const setColours = useMemo(() => {
    const names = new Map();
    products.forEach((p) => (p.stockRows || []).forEach((r) => {
      if (r.priceSetId != null) names.set(r.priceSetId, r.priceSetName || '');
    }));
    const ordered = [...names].sort((a, b) => a[1].localeCompare(b[1]) || a[0] - b[0]);
    return new Map(ordered.map(([id], i) => [id, SET_COLOURS[i % SET_COLOURS.length]]));
  }, [products]);

  // How many rows are drawn; a new scope starts again from the first rows.
  const viewKey = useMemo(() => [gridOption, gridStock], [gridOption, gridStock]);
  const [paging, setPaging] = useState({ key: null, rows: ROWS_STEP });
  const visibleRows = paging.key === viewKey ? paging.rows : ROWS_STEP;
  useEffect(() => {
    const el = moreRowsRef.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPaging((p) => ({ key: viewKey, rows: (p.key === viewKey ? p.rows : ROWS_STEP) + ROWS_STEP }));
        }
      },
      // the grid is its own scroll box: watch the marker within it
      { root: gridRef.current, rootMargin: '800px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleRows, rows.length, loading, viewKey]);

  // Grid height: from its top on the page to the window's bottom, less the
  // page's 32px bottom padding (re-measured when the window resizes)
  // A new selection / stock filter starts at the top of the grid
  useEffect(() => {
    gridRef.current?.scrollTo?.({ top: 0 });
  }, [viewKey]);

  const hasRows = rows.length > 0;
  useEffect(() => {
    const measure = () => {
      const el = gridRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setGridHeight(Math.max(240, Math.floor(window.innerHeight - top - 32)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [loading, hasRows]);
  // ---- search options ----
  const searchOptions = useMemo(() => {
    const names = (pick) => [...new Set(products.map(pick).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return [
      ...names((p) => p.category?.name).map((label) => ({ type: 'Categories', label })),
      ...names((p) => p.family?.name).map((label) => ({ type: 'Families', label })),
      ...products
        .filter((p) => p.name)
        .map((p) => ({ type: 'Products', label: p.name, id: p.id }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [products]);

  // ---- price editing ----
  const { costCalculationMethod = 'Last Cost', profitabilityDisplay = 'Gross Profit Margin' } =
    settingsService.getCachedGeneralSettings() || {};

  // Profit under each price, live as the price is typed (go-live audit: "bulk price
  // edit shows profit after sales price computed"). Same figure Sell & Cost shows:
  // unit cost per the company's Cost Calculation Method x quantity, expressed per
  // the Profitability Display setting. Not on the reference's Bulk Price Edit -
  // an addition, kept small and grey so the grid still reads like the reference.
  const profitFor = useCallback((product, quantity, value) => {
    const price = parseFloat(value);
    const cost = effectiveUnitCost(product, costCalculationMethod) * quantity;
    if (!(price > 0) || !(cost > 0)) return null;
    return profitPercent(price, cost, profitabilityDisplay);
  }, [costCalculationMethod, profitabilityDisplay]);

  const handleEdit = useCallback((rowKey, quantity, value) => {
    setEdits((prev) => ({ ...prev, [rowKey]: { ...prev[rowKey], [quantity]: value } }));
  }, []);

  const dropEdit = (rowKey, quantity) => {
    setEdits((prev) => {
      const { [quantity]: _drop, ...rest } = prev[rowKey] || {};
      return { ...prev, [rowKey]: rest };
    });
  };

  // Reference has no Save button: a price cell commits on blur.
  const handleCommit = useCallback(async (row, quantity) => {
    const { product, priceSetId, priceSetName, key } = row;
    const typed = editsRef.current[key]?.[quantity];
    if (typed === undefined) return;
    const price = parseFloat(typed);
    const live = productsRef.current.find((p) => p.id === product.id);
    const current = (live?.stockRows || []).find((r) => (r.priceSetId ?? null) === priceSetId && Number(r.quantity) === quantity);
    // A cleared or zero cell is not saved (a product must never ring up free)
    if (!(price > 0) || (current && Number(current.price) === price)) {
      dropEdit(key, quantity);
      return;
    }
    // Stored on the price row the way Sell & Cost stores it: unit cost per the
    // company's cost method x quantity, and the percentage per its display setting.
    const cost = effectiveUnitCost(product, costCalculationMethod) * quantity;
    const percentage = cost > 0 ? Math.round(profitPercent(price, cost, profitabilityDisplay) * 100) / 100 : 0;
    try {
      const res = await productService.bulkUpdatePrices([
        // priceId: the row this box showed (e.g. an outlet's own price), so the
        // save changes that row and not the shared one other outlets use
        { productId: product.id, prices: [{ quantity, price, cost, percentage, priceSetId, priceId: current?.id }] },
      ]);
      const result = res?.results?.find((r) => r.productId === product.id);
      if (result && result.success === false) throw new Error(result.error || 'Save failed');
      // Setup > General > "Price Activation Time": the server queued the change
      // as a Future Price - the grid keeps the live price and says so.
      const deferred = result?.deferredPrices || [];
      if (deferred.length) {
        dropEdit(key, quantity);
        const when = new Date(deferred[0].effectiveAt).toLocaleString();
        setSnackbar({ open: true, message: `Price change scheduled for ${when} (Price Activation Time). See Utilities > Future Prices.`, severity: 'info' });
        await queueEverydayTicket(shelfTicketService, product.id);
        return;
      }
      setProducts((prev) => prev.map((p) => {
        if (p.id !== product.id) return p;
        const stockRows = [...(p.stockRows || [])];
        const idx = stockRows.findIndex((r) => (r.priceSetId ?? null) === priceSetId && Number(r.quantity) === quantity);
        if (idx >= 0) stockRows[idx] = { ...stockRows[idx], price, cost, percentage };
        else stockRows.push({ quantity, price, cost, percentage, priceSetId, priceSetName });
        return { ...p, stockRows };
      }));
      dropEdit(key, quantity);
      setSnackbar({ open: true, message: 'Price updated', severity: 'success' });
      // Reference: a saved sell-price change queues the product for an Everyday shelf ticket.
      await queueEverydayTicket(shelfTicketService, product.id);
    } catch (error) {
      console.error('Error saving price:', error);
      dropEdit(key, quantity);
      setSnackbar({ open: true, message: 'Error saving price', severity: 'error' });
    }
  }, [costCalculationMethod, profitabilityDisplay]);

  const addQuantity = () => {
    const quantity = parseInt(newQuantity, 10);
    if (quantity > 0 && !quantities.includes(quantity)) {
      setExtraQuantities((prev) => [...prev, quantity]);
    }
    setNewQuantity('');
  };
  const addEnabled = !!newQuantity && parseInt(newQuantity, 10) > 0;

  if (loading) return <PageLoader />;

  return (
    <Box sx={{ py: 4, px: '8px' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: '#000' }}>
          Bulk Price Edit
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {updating && <CircularProgress size={18} thickness={5} aria-label="Updating list" sx={{ color: '#5ebbeb' }} />}
          <Typography sx={{ fontSize: 16, color: '#000' }}>{scopedProducts.length} Products</Typography>
        </Box>
      </Box>

      {/* Search: picking a category, family or product scopes the grid */}
      <Autocomplete
        ref={searchBoxRef}
        fullWidth
        freeSolo
        forcePopupIcon
        autoHighlight
        popupIcon={<ArrowDropDownIcon sx={{ color: '#808080' }} />}
        value={selectedOption}
        inputValue={searchTerm}
        onInputChange={(e, value, reason) => {
          setSearchTerm(value);
          if (reason === 'input' || reason === 'clear') setSelectedOption(null);
        }}
        onChange={(e, value) => {
          if (value && typeof value === 'object') {
            setSelectedOption(value);
            setSearchTerm(value.label);
          } else {
            setSelectedOption(null);
          }
        }}
        options={searchOptions}
        filterOptions={(opts, { inputValue }) => {
          const q = String(inputValue || '').trim().toLowerCase();
          if (q.length < 2) return [HINT_OPTION];
          return GROUP_ORDER.flatMap((type) => opts.filter((o) => o.type === type && o.label.toLowerCase().includes(q)));
        }}
        groupBy={(option) => (option.type === 'hint' ? '' : option.type)}
        renderGroup={(params) =>
          params.group ? (
            <li key={params.key}>
              <div className="MuiAutocomplete-groupLabel">{params.group}</div>
              <ul style={{ padding: 0 }}>{params.children}</ul>
            </li>
          ) : (
            <React.Fragment key={params.key}>{params.children}</React.Fragment>
          )
        }
        getOptionDisabled={(option) => option.type === 'hint'}
        getOptionLabel={(option) => (typeof option === 'string' ? option : option.label)}
        isOptionEqualToValue={(o, v) => o.type === v.type && o.label === v.label && o.id === v.id}
        slotProps={{
          popper: {
            popperRef: searchPopperRef,
            ...(searchBoxWidth && { style: { width: searchBoxWidth } }),
          },
          paper: {
            sx: {
              border: '1px solid #000',
              borderRadius: '8px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
              // freeSolo opens an empty list when nothing matches; hide it (no stray line)
              '&:empty': { display: 'none' },
              '& .MuiAutocomplete-listbox': { maxHeight: 288, padding: 0 },
              '& .MuiAutocomplete-groupLabel': {
                fontSize: 16,
                fontWeight: 700,
                color: '#000',
                padding: '16px',
                backgroundColor: '#fff',
                lineHeight: 1.2,
              },
              '&& li.MuiAutocomplete-option': {
                minHeight: 56,
                height: 56,
                padding: '16px',
                fontSize: 16,
                cursor: 'pointer',
                gap: '8px',
                '&[aria-selected="true"], &.Mui-focused, &.Mui-focusVisible, &:hover, &[aria-selected="true"].Mui-focused': {
                  backgroundColor: '#7dd3fc',
                },
                // the "Keep Typing to Search..." hint: plain text, not a choice
                '&[aria-disabled="true"]': { opacity: 1, cursor: 'default', backgroundColor: '#fff' },
              },
            },
          },
        }}
        renderOption={(props, option) => {
          const Icon = GROUP_ICONS[option.type];
          return (
            <Box component="li" {...props} key={`${option.type}-${option.id ?? option.label}`}>
              {Icon && <Icon sx={{ fontSize: 20, color: '#404040' }} />}
              {option.label}
            </Box>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Search for Product or Classification..."
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                height: 42,
                borderRadius: '8px',
                fontSize: 16,
                paddingTop: '0 !important',
                paddingBottom: '0 !important',
                '& fieldset': { borderColor: '#404040', borderWidth: '1px' },
                '&:hover fieldset': { borderColor: '#404040', borderWidth: '1px' },
                '&.Mui-focused fieldset': { borderColor: '#000', borderWidth: '2px' },
              },
              '& input::placeholder': { color: '#808080', opacity: 1 },
              '& .MuiAutocomplete-popupIndicator': { transform: 'none' },
              '& .MuiAutocomplete-popupIndicatorOpen': { transform: 'none' },
            }}
          />
        )}
      />

      {/* Toggle + New Quantity + Add (one row) */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ShopfrontSwitch checked={onlyStock} onChange={(e) => setOnlyStock(e.target.checked)} />
          <Typography sx={{ fontSize: 16, color: '#000' }}>
            Only display products that have stock (when editing a classification or all products)
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            type="number"
            size="small"
            placeholder="New Quantity"
            value={newQuantity}
            onChange={(e) => setNewQuantity(e.target.value)}
            sx={{ ...fieldSx, width: 216 }}
          />
          <Button
            variant="contained"
            disableElevation
            startIcon={<AddIcon />}
            onClick={addQuantity}
            disabled={!addEnabled}
            sx={{
              width: 113,
              height: 42,
              borderRadius: '12px',
              fontSize: 16,
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: 'none',
              backgroundColor: '#5ebbeb',
              color: '#fff',
              transition: 'none',
              '&:hover': { backgroundColor: '#4aa9dd', boxShadow: 'none' },
              '&.Mui-disabled': {
                backgroundColor: '#e5e5e5',
                color: '#737373',
                border: '1px solid #737373',
                cursor: 'not-allowed',
                pointerEvents: 'auto',
              },
            }}
          >
            Add
          </Button>
        </Box>
      </Box>

      {rows.length === 0 ? (
        // Reference: nothing in scope shows a crossed circle and a message
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, py: 6 }}>
          <EmptyIcon />
          <Box>
            <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#000', mb: 3 }}>No Products</Typography>
            <Typography sx={{ fontSize: 16, color: '#000' }}>Search did not yield any results.</Typography>
          </Box>
        </Box>
      ) : (
        <TableContainer
          ref={gridRef}
          component={Paper}
          // until measured, a safe height (unbounded let the first draw load extra rows)
          sx={{ boxShadow: 'none', borderRadius: '12px', overflow: 'auto', maxHeight: gridHeight ?? '60vh' }}
        >
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow
                sx={{
                  '& th': {
                    backgroundColor: '#5ebbeb',
                    // sticky cells: at 125% / 150% scaling a hairline seam showed
                    // between them; 1px of the same blue to the right covers it
                    boxShadow: '1px 0 0 #5ebbeb',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 16,
                    height: 51,
                    py: 0,
                    px: '16px',
                    borderBottom: 'none',
                    whiteSpace: 'nowrap',
                  },
                  '& th:first-of-type': { borderTopLeftRadius: '12px' },
                  '& th:last-of-type': { borderTopRightRadius: '12px' },
                }}
              >
                <TableCell>Product</TableCell>
                <TableCell>Case Qty</TableCell>
                <TableCell>Price Set</TableCell>
                {quantities.map((quantity) => (
                  <TableCell key={quantity} align="center">
                    {/* Reference: the quantity only (the profit % shows under each box) */}
                    {quantity}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody
              aria-busy={updating}
              sx={{
                '& td': { fontSize: 16, color: '#000', padding: '4px 4px 4px 16px', borderBottom: 'none', whiteSpace: 'nowrap', verticalAlign: 'top' },
                // Name / case qty / set text sits on the price boxes' line (box 42px high),
                // the profit % under the box; price cells pad evenly so the box centres
                // under its "1 Profit" header
                '& td:not(.bpe-cell)': { lineHeight: '42px' },
                // boxes 8px apart (reference)
                '& td.bpe-cell': { padding: '4px' },
                ...PRICE_CELL_SX,
                opacity: updating ? 0.5 : 1,
                transition: 'opacity 120ms',
              }}
            >
              {rows.slice(0, visibleRows).map((row) => (
                <PriceRow
                  key={row.key}
                  row={row}
                  quantities={quantities}
                  edits={edits[row.key]}
                  setColour={setColours.get(row.priceSetId)}
                  onEdit={handleEdit}
                  onCommit={handleCommit}
                  profitFor={profitFor}
                />
              ))}
              {/* Marker after the drawn rows: coming into view draws the next ones */}
              {visibleRows < rows.length && (
                <TableRow ref={moreRowsRef}>
                  <TableCell colSpan={quantities.length + 3} align="center" sx={{ py: 2 }}>
                    <CircularProgress size={22} thickness={5} aria-label="Loading more rows" sx={{ color: '#5ebbeb' }} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar((s) => ({ ...s, open: false }))} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default BulkPriceEdit;
