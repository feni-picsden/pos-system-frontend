import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Popper,
  ClickAwayListener,
  CircularProgress,
  Alert,
  Snackbar,
  Dialog,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Cancel as ClearIcon,
  CloseOutlined as CloseIcon,
  ImageOutlined as ImageIcon,
  ArrowDropDown as ArrowDropDownIcon,
  CheckBoxOutlineBlankOutlined as SquareIcon,
  CheckBoxOutlined as SquareCheckedIcon,
} from '@mui/icons-material';
import productService from '../../services/productService';
import productComboService from '../../services/productComboService';
import shelfTicketService from '../../services/shelfTicketService';
import priceListService from '../../services/priceListService';
import classificationService from '../../services/classificationService';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import { SquareCheckButton, TicketCounter } from '../../components/ShelfTickets/TicketControls';
import {
  INSTANT,
  TICKET_BAR_SX,
  EXPORT_BUTTON_SX,
  BAR_CLEARANCE,
  downloadCsv,
} from '../../components/ShelfTickets/ticketChrome';
import PrintTicketsDialog from '../../components/ShelfTickets/PrintTicketsDialog';

// Reference grouping options, in reference order.
const GROUPINGS = ['No Grouping', 'Price Points', 'Brand', 'Category', 'Family'];

/**
 * A shelf ticket is stamped with the outlet selected in the header, but the ticket LIST it
 * joins is never narrowed to that outlet's catalogue — so scoping the product search to the
 * selected outlet made already-ticketed rows unfindable, and on an outlet that owns no
 * products of its own every term returned zero suggestions. Passing outletId explicitly
 * opts out of apiClient's automatic outletId injection, and the products route ignores a
 * non-numeric outlet, so the search spans the same product universe the list shows.
 */
const ALL_OUTLETS = { params: { outletId: 'all' } };

const BAR_BUTTON_SX = {
  height: 42,
  padding: '8px 32px',
  borderRadius: '12px',
  fontSize: 16,
  fontWeight: 700,
  textTransform: 'none',
  boxShadow: 'none',
  transition: 'none',
};

const PANEL_SX = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  zIndex: 1000,
  bgcolor: '#fff',
  border: '1px solid #000',
  borderRadius: 0,
  boxShadow: 'rgba(0,0,0,0.25) 0 0 15px, rgba(0,0,0,0.19) 0 7.5px 15px',
  maxHeight: 698,
  overflowY: 'auto',
};

/**
 * Reference filter control: a 42px typeahead combobox whose caption sits ABOVE and outside
 * the field (the outline stays unbroken — no notched legend), opening a square black-bordered
 * panel instantly (no Grow) with 56px rows, sky-300 hover and the current value
 * in sky-500. Renders 'No Options' when the tenant has nothing configured.
 * In `multiple` mode each row carries a square-checkbox glyph, picking an option toggles
 * membership without closing the panel, and every checked value is repeated as a pinned
 * sky-300 band at the top of the panel — used by the 'Added By' creator filter.
 */
const TicketSelect = ({ label, placeholder, value, options, onChange, clearable, multiple }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(null); // null => showing the value, not typing
  const anchorRef = useRef(null);

  const selected = useMemo(() => (multiple ? value || [] : []), [multiple, value]);
  const displayValue = multiple ? selected.join(', ') : value;
  const showClear = (multiple || clearable) && (multiple ? selected.length > 0 : Boolean(value));

  const filtered = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    return q ? options.filter((option) => option.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery(null);
  };

  const pick = (option) => {
    if (multiple) {
      const current = value || [];
      onChange(current.includes(option) ? current.filter((v) => v !== option) : [...current, option]);
      setQuery(null);
      return;
    }
    onChange(clearable && option === value ? '' : option);
    close();
  };

  // One option row, used both in the list and (pinned) in the selected-values band.
  const renderOption = (option, pinned) => {
    const checked = multiple ? selected.includes(option) : option === value;
    return (
      <Box
        key={pinned ? `pinned-${option}` : option}
        component="button"
        type="button"
        onClick={() => pick(option)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          width: '100%',
          height: 56,
          p: '16px',
          border: 0,
          borderBottom: pinned ? '1px solid #000' : 0,
          bgcolor: pinned ? '#7dd3fc' : 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
          fontSize: 16,
          color: !pinned && checked ? '#38bdf8' : '#252525',
          transition: INSTANT,
          '&:hover': { bgcolor: pinned ? '#7dd3fc' : '#74d4ff' },
        }}
      >
        {multiple &&
          (checked ? (
            <SquareCheckedIcon sx={{ fontSize: 16, flexShrink: 0 }} />
          ) : (
            <SquareIcon sx={{ fontSize: 16, flexShrink: 0 }} />
          ))}
        {option}
      </Box>
    );
  };

  return (
    <ClickAwayListener onClickAway={close}>
      <Box sx={{ width: 422, maxWidth: '100%' }}>
        <Typography sx={{ fontSize: '12.8px', fontWeight: 400, lineHeight: '16px', color: '#313439' }}>
          {label}
        </Typography>
        <Box
          ref={anchorRef}
          onClick={() => setOpen(true)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            height: 42,
            pl: '16px',
            pr: '4px',
            bgcolor: '#fff',
            border: '1px solid #404040',
            borderRadius: '8px',
            cursor: 'text',
          }}
        >
          <Box
            component="input"
            type="text"
            value={query ?? displayValue}
            placeholder={placeholder}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => e.key === 'Escape' && close()}
            sx={{
              flex: 1,
              minWidth: 0,
              height: 40,
              border: 0,
              outline: 'none',
              bgcolor: 'transparent',
              fontFamily: 'inherit',
              fontSize: 16,
              color: '#000',
              '&::placeholder': { color: '#808080', opacity: 1 },
            }}
          />
          {/* Reference clear control: a '×' inside the field, to the LEFT of the caret. */}
          {showClear && (
            <Box
              component="button"
              type="button"
              aria-label={`Clear ${label}`}
              onClick={(event) => {
                event.stopPropagation();
                onChange(multiple ? [] : '');
                setQuery(null);
              }}
              sx={{
                display: 'flex',
                flexShrink: 0,
                p: 0,
                border: 0,
                bgcolor: 'transparent',
                color: '#404040',
                cursor: 'pointer',
                transition: INSTANT,
              }}
            >
              <CloseIcon sx={{ fontSize: 18 }} />
            </Box>
          )}
          <ArrowDropDownIcon
            sx={{
              flexShrink: 0,
              color: '#404040',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 150ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </Box>

        <Popper
          open={open}
          anchorEl={anchorRef.current}
          placement="bottom-start"
          modifiers={[{ name: 'offset', options: { offset: [0, 4] } }]}
          style={{ zIndex: 1300 }}
        >
          <Box
            sx={{
              width: anchorRef.current ? anchorRef.current.offsetWidth : 'auto',
              bgcolor: '#fff',
              // Reference panel: 1px black outline only — square corners, no drop shadow.
              // Only the multi-select 'Added By' panel is capped at 250px; the single-select
              // menus size to their options (5 x 56px = 280px, no scrollbar), bounded by the
              // viewport so a long Price Set list still scrolls natively.
              border: '1px solid #000',
              borderRadius: 0,
              boxShadow: 'none',
              maxHeight: multiple ? 250 : '70vh',
              overflowY: 'auto',
              transition: INSTANT,
            }}
          >
            {/* Checked values are repeated as a pinned sky-300 band above the list. */}
            {selected.map((option) => renderOption(option, true))}
            {filtered.length === 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', height: 53, px: '16px', fontSize: 16, color: '#252525' }}>
                No Options
              </Box>
            ) : (
              filtered.map((option) => renderOption(option, false))
            )}
          </Box>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};

// Ticket rows carry price breaks straight from the product's price points; a product
// with none must render the reference's 'No Prices' state, so there is no fallback.
const getTicketPriceBreaks = (ticket) =>
  (Array.isArray(ticket?.priceBreaks) ? ticket.priceBreaks : [])
    .map((p) => ({ quantity: Number(p?.quantity) || 1, price: Number(p?.price) }))
    .filter((p) => Number.isFinite(p.price));

const highlightMatch = (name = '', query = '') => {
  const q = query.trim();
  const index = q ? name.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (index === -1) return name;
  return (
    <>
      {name.slice(0, index)}
      <Box component="span" sx={{ color: '#5ebbeb' }}>
        {name.slice(index, index + q.length)}
      </Box>
      {name.slice(index + q.length)}
    </>
  );
};

const GROUP_HEADER_SX = {
  pl: '16px',
  py: '4px',
  fontSize: '17.28px',
  textTransform: 'uppercase',
  color: '#bdbdbd',
};

/** One typeahead result line (products and product combos share it). */
const ResultRow = ({ imageUrl, name, query, onClick }) => (
  <Box
    component="button"
    type="button"
    onClick={onClick}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      width: '100%',
      height: 41,
      padding: '8px 16px',
      border: 0,
      bgcolor: 'transparent',
      cursor: 'pointer',
      textAlign: 'left',
      fontFamily: 'inherit',
      fontSize: '19.2px',
      color: '#676b72',
      transition: INSTANT,
      '&:hover': { bgcolor: '#8bcef1', color: '#f8f8f8' },
    }}
  >
    {imageUrl ? (
      <Box component="img" src={imageUrl} alt="" sx={{ width: 25, height: 25, objectFit: 'cover', flexShrink: 0 }} />
    ) : (
      <ImageIcon sx={{ width: 25, height: 25, color: '#bdbdbd', flexShrink: 0 }} />
    )}
    <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {highlightMatch(name, query)}
    </Box>
  </Box>
);

const EverydayTickets = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [comboResults, setComboResults] = useState([]);
  const [classificationResults, setClassificationResults] = useState([]);
  const [grouping, setGrouping] = useState('No Grouping');
  const [priceSet, setPriceSet] = useState('');
  const [priceSets, setPriceSets] = useState([]);
  const [addedByFilter, setAddedByFilter] = useState([]);
  const [selectedTickets, setSelectedTickets] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [products, setProducts] = useState([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewPrices, setViewPrices] = useState(false);
  const [addAllOpen, setAddAllOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [printTickets, setPrintTickets] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const searchRef = useRef(null);

  const showSnackbar = (message, severity) => setSnackbar({ open: true, message, severity });

  /**
   * The whole Everyday list is loaded once, unnarrowed. A ticket is unique per
   * product+type+outlet — price set is NOT part of that key — so asking the server for one
   * price set's tickets would hand back a guard set with holes, and every add path
   * (suggestion, combo, classification, Add All) would re-offer products the server then
   * rejects with a 400. Price Set is applied client-side, for display only.
   */
  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      const response = await shelfTicketService.getShelfTickets({
        ticketType: 'Everyday',
        limit: 1000,
      });
      setTickets(response.tickets || []);
    } catch (error) {
      console.error('Error loading tickets:', error);
      showSnackbar('Failed to load shelf tickets', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // Price Sets are data-driven: the selector shows 'No Options' when the outlet has none.
  useEffect(() => {
    const loadPriceSets = async () => {
      try {
        const response = await priceListService.getPriceLists();
        const lists = Array.isArray(response) ? response : response?.priceLists || response?.data || [];
        setPriceSets(lists.filter((l) => l?.name).map((l) => l.name));
      } catch (error) {
        console.error('Error loading price sets:', error);
        setPriceSets([]);
      }
    };
    loadPriceSets();
  }, []);

  // Products are only needed for Family grouping and Add All Products — fetch on demand.
  const loadProducts = useCallback(async () => {
    if (productsLoaded) return products;
    const response = await productService.getProducts({ limit: 1000 });
    const list = response.products || response.data || [];
    setProducts(list);
    setProductsLoaded(true);
    return list;
  }, [products, productsLoaded]);

  useEffect(() => {
    if (grouping === 'Family') loadProducts();
  }, [grouping, loadProducts]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const familyByProduct = useMemo(() => {
    const map = new Map();
    products.forEach((p) => map.set(p.id, p.family?.name || ''));
    return map;
  }, [products]);

  // The placeholder promises category/brand/family/tag results, so matched classifications
  // are listed under their own uppercase section headers, in that order.
  const classificationSections = useMemo(() => {
    const byType = { CATEGORY: [], BRAND: [], FAMILY: [], TAG: [] };
    classificationResults.forEach((item) => byType[(item.type || '').toUpperCase()]?.push(item));
    return [
      ['Categories', byType.CATEGORY],
      ['Brands', byType.BRAND],
      ['Families', byType.FAMILY],
      ['Tags', byType.TAG],
    ].filter(([, items]) => items.length > 0);
  }, [classificationResults]);

  // 'You can choose to print tickets for a specific price set' — a display narrowing over the
  // full list, so the rows and the creator options follow it but the duplicate guard does not.
  const priceSetTickets = useMemo(
    () => (priceSet ? tickets.filter((t) => (t.priceSet || '') === priceSet) : tickets),
    [tickets, priceSet]
  );

  const addedByOptions = useMemo(
    () => [...new Set(priceSetTickets.map((t) => t.addedBy).filter(Boolean))].sort(),
    [priceSetTickets]
  );

  // Every add path funnels through this set: a ticket is unique per product+type+outlet,
  // so a product that already has a row can never be ticketed again — whatever price set or
  // creator filter is on screen. Built from the unnarrowed list for exactly that reason.
  const ticketedProductIds = useMemo(() => new Set(tickets.map((t) => t.productId)), [tickets]);

  // The search box is an ADD control, not a list filter — 'clicking a suggestion adds a
  // ticket', so products that are already ticketed are not offered.
  const productResults = useMemo(
    () => searchResults.filter((product) => !ticketedProductIds.has(product.id)),
    [searchResults, ticketedProductIds]
  );

  // 'Added By' is a client-side narrowing: /shelf-tickets has no addedBy filter param.
  // Multi-select — an empty selection means "all creators".
  const visibleTickets = useMemo(
    () =>
      addedByFilter.length
        ? priceSetTickets.filter((t) => addedByFilter.includes(t.addedBy || ''))
        : priceSetTickets,
    [priceSetTickets, addedByFilter]
  );

  // 'Choose a grouping option to rearrange how products are listed' — grouping is a
  // display concern, so it groups the loaded rows rather than filtering the request.
  const groups = useMemo(() => {
    if (grouping === 'No Grouping') return [{ label: null, rows: visibleTickets }];
    const labelFor = (ticket) => {
      if (grouping === 'Price Points') return `$${(Number(ticket.price) || 0).toFixed(2)}`;
      if (grouping === 'Brand') return ticket.brand || 'No Brand';
      if (grouping === 'Category') return ticket.category || 'No Category';
      return familyByProduct.get(ticket.productId) || 'No Family';
    };
    const map = new Map();
    visibleTickets.forEach((ticket) => {
      const label = labelFor(ticket);
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(ticket);
    });
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
      .map(([label, rows]) => ({ label, rows }));
  }, [grouping, visibleTickets, familyByProduct]);

  const allSelected = visibleTickets.length > 0 && selectedTickets.length === visibleTickets.length;

  const handleSearch = async (value) => {
    setSearchTerm(value);
    setSearchOpen(true);

    if (value.trim().length < 2) {
      setSearchResults([]);
      setComboResults([]);
      setClassificationResults([]);
      return;
    }

    // 'Search to add additional products individually or by classification' — so the panel
    // offers products, our Product Combos, and every classification the term matches.
    const [productResponse, comboResponse, classificationResponse] = await Promise.all([
      productService.getProducts({ search: value, limit: 10 }, ALL_OUTLETS).catch((error) => {
        console.error('Error searching products:', error);
        return null;
      }),
      productComboService.getProductCombos({ search: value, limit: 10, status: 'Active' }).catch((error) => {
        console.error('Error searching product combos:', error);
        return null;
      }),
      classificationService.getClassifications({ search: value }).catch((error) => {
        console.error('Error searching classifications:', error);
        return null;
      }),
    ]);
    setSearchResults(productResponse?.products || productResponse?.data || []);
    setComboResults(comboResponse?.combos || []);
    setClassificationResults(classificationResponse?.classifications || []);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    setComboResults([]);
    setClassificationResults([]);
    setSearchOpen(false);
  };

  const handleAddProduct = async (product) => {
    try {
      setLoading(true);
      const response = await shelfTicketService.addShelfTicket({
        productId: product.id,
        ticketType: 'Everyday',
        productGrouping: grouping !== 'No Grouping' ? grouping : null,
        priceSet: priceSet || null,
      });

      if (response.ticket) {
        setTickets((prev) => [response.ticket, ...prev]);
        showSnackbar('Product added to shelf tickets', 'success');
      }
      clearSearch();
    } catch (error) {
      const message = error.response?.data?.error;
      // A duplicate can still reach the server when a Price Set narrows the loaded list
      // (uniqueness ignores price set) or the same suggestion is clicked twice in flight.
      // That is not an error — it is the same 'nothing new to ticket' outcome as bulk.
      if (message === 'Product already exists in shelf tickets') {
        showSnackbar(`${product.name} is already in shelf tickets`, 'warning');
        clearSearch();
        return;
      }
      console.error('Error adding product:', error);
      showSnackbar(message || 'Failed to add product to shelf tickets', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Bulk-ticket a set of products (a combo's members, or a whole classification) through the
  // same bulk endpoint 'Add All Products' uses.
  const addProductIds = async (ids, sourceName) => {
    const fresh = [...new Set(ids.filter(Boolean))].filter((id) => !ticketedProductIds.has(id));
    if (fresh.length === 0) {
      showSnackbar(`No new products to ticket in ${sourceName}`, 'warning');
      clearSearch();
      return;
    }
    try {
      setLoading(true);
      const response = await shelfTicketService.addBulkShelfTickets({
        productIds: fresh,
        ticketType: 'Everyday',
        productGrouping: grouping !== 'No Grouping' ? grouping : null,
        priceSet: priceSet || null,
      });
      showSnackbar(`Added ${response.added} products from ${sourceName}`, 'success');
      clearSearch();
      await loadTickets();
    } catch (error) {
      console.error('Error adding products to shelf tickets:', error);
      showSnackbar(`Failed to add ${sourceName} to shelf tickets`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // A combo has no product row of its own, so ticketing a combo means ticketing its members.
  const handleAddCombo = (combo) =>
    addProductIds((combo.items || []).map((item) => item.productId), combo.name);

  // 'Search to add additional products individually or by classification' — picking a
  // category/brand/family/tag tickets every product assigned to it.
  const handleAddClassification = async (classification) => {
    try {
      setLoading(true);
      const response = await classificationService.getClassificationProducts(classification.id);
      await addProductIds((response.assignedProducts || []).map((p) => p.id), classification.name);
    } catch (error) {
      console.error('Error loading classification products:', error);
      showSnackbar(`Failed to add ${classification.name} to shelf tickets`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTicket = async (id) => {
    try {
      setLoading(true);
      await shelfTicketService.removeShelfTicket(id);
      setTickets((prev) => prev.filter((t) => t.id !== id));
      setSelectedTickets((prev) => prev.filter((t) => t !== id));
      showSnackbar('Ticket removed successfully', 'success');
    } catch (error) {
      console.error('Error removing ticket:', error);
      showSnackbar('Failed to remove ticket', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleTicket = (id) =>
    setSelectedTickets((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));

  const toggleAll = () => setSelectedTickets(allSelected ? [] : visibleTickets.map((t) => t.id));

  // Each group header carries its own select-all, scoped to that group's rows.
  const groupSelected = (rows) => rows.length > 0 && rows.every((row) => selectedTickets.includes(row.id));

  const toggleGroup = (rows) => {
    const ids = rows.map((row) => row.id);
    setSelectedTickets((prev) =>
      ids.every((id) => prev.includes(id))
        ? prev.filter((id) => !ids.includes(id))
        : [...new Set([...prev, ...ids])]
    );
  };

  // 'Once clicked you will get the option to choose between: Only Positive Inventory ...
  // or All Products' — the reference button opens that choice first.
  const handleAddAllProducts = async (onlyPositiveInventory) => {
    setAddAllOpen(false);
    try {
      setLoading(true);
      const list = await loadProducts();
      const inStock = (p) => (Number(p.currentStockItems) || 0) > 0 || (Number(p.currentStockCases) || 0) > 0;
      const productIds = list
        .filter((p) => (onlyPositiveInventory ? inStock(p) : true))
        .filter((p) => !ticketedProductIds.has(p.id))
        .map((p) => p.id);

      if (productIds.length === 0) {
        showSnackbar('All products are already in shelf tickets', 'info');
        return;
      }

      const response = await shelfTicketService.addBulkShelfTickets({
        productIds,
        ticketType: 'Everyday',
        productGrouping: grouping !== 'No Grouping' ? grouping : null,
        priceSet: priceSet || null,
      });
      showSnackbar(`Added ${response.added} products to shelf tickets`, 'success');
      await loadTickets();
    } catch (error) {
      console.error('Error adding all products:', error);
      showSnackbar('Failed to add all products', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSelected = async () => {
    if (selectedTickets.length === 0) {
      showSnackbar('No tickets selected', 'warning');
      return;
    }
    try {
      setLoading(true);
      const response = await shelfTicketService.removeBulkShelfTickets(selectedTickets);
      setTickets((prev) => prev.filter((t) => !selectedTickets.includes(t.id)));
      setSelectedTickets([]);
      showSnackbar(`Removed ${response.removed} tickets successfully`, 'success');
    } catch (error) {
      console.error('Error removing selected tickets:', error);
      showSnackbar('Failed to remove selected tickets', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Print selected shelf tickets: hand the chosen ticket rows to the Print Shelf
  // Tickets dialog, which renders them from the selected template into a print window.
  const handlePrint = () => {
    // Only what is on screen: `tickets` now spans every price set, so a selection left over
    // from another price set must not print.
    const rows = visibleTickets.filter((t) => selectedTickets.includes(t.id));
    if (rows.length === 0) {
      showSnackbar('No tickets selected to print', 'warning');
      return;
    }
    // Everyday tickets have no separate sale price; keep salePrice equal to price so
    // the template never renders a fake discount from the preview placeholder.
    setPrintTickets(
      rows.map((ticket) => ({
        name: ticket.name,
        price: ticket.price,
        salePrice: ticket.price,
        barcode: ticket.barcode || '',
        sku: ticket.sku || ticket.productId,
        category: ticket.category || '',
        brand: ticket.brand || '',
        description: ticket.description || ticket.name,
      }))
    );
    setPrintOpen(true);
  };

  // Reference 'Export': hands the selected products to DesignPro as a data file. In the
  // browser that is a download of the same field set (NAME/BARCODE/QUANTITY/prices/C_GROUP).
  const handleExport = () => {
    const rows = visibleTickets.filter((t) => selectedTickets.includes(t.id));
    if (rows.length === 0) {
      showSnackbar('No tickets selected to export', 'warning');
      return;
    }
    downloadCsv(
      'everyday-tickets.csv',
      ['NAME', 'BARCODE', 'SKU', 'QUANTITY', 'NPRICE', 'SPRICE', 'C_GROUP'],
      rows.flatMap((ticket) => {
        const breaks = getTicketPriceBreaks(ticket);
        const price = Number(ticket.price) || 0;
        const lines = breaks.length ? breaks : [{ quantity: 1, price }];
        return lines.map((line) => [
          ticket.name,
          ticket.barcode || '',
          ticket.sku || ticket.productId,
          line.quantity,
          line.price.toFixed(2),
          line.price.toFixed(2),
          ticket.category || '',
        ]);
      })
    );
  };

  const renderRows = (rows) =>
    rows.map((ticket) => {
      const breaks = getTicketPriceBreaks(ticket);
      return (
        <React.Fragment key={ticket.id}>
          <TableRow sx={{ height: 70 }} className={viewPrices ? 'everyday-ticket-open' : undefined}>
            <TableCell sx={{ width: 32, px: 0 }}>
              <SquareCheckButton
                checked={selectedTickets.includes(ticket.id)}
                onClick={() => toggleTicket(ticket.id)}
                label={`Select ${ticket.name}`}
              />
            </TableCell>
            <TableCell>{ticket.name}</TableCell>
            <TableCell>{ticket.category || ''}</TableCell>
            <TableCell>{ticket.addedBy || ''}</TableCell>
            <TableCell>{ticket.addedAt}</TableCell>
            <TableCell sx={{ width: 48, px: 0 }}>
              <Box
                component="button"
                type="button"
                aria-label={`Remove ${ticket.name}`}
                onClick={() => handleRemoveTicket(ticket.id)}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 27,
                  p: '4px',
                  border: '1px solid currentColor',
                  borderRadius: '6px',
                  bgcolor: 'transparent',
                  color: '#000',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease, color 0.2s ease',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.1)', color: '#000' },
                }}
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </Box>
            </TableCell>
          </TableRow>
          {/* Prices expand into their own full-width row, indented under the Name column. */}
          {viewPrices && (
            <TableRow className="everyday-ticket-prices">
              <TableCell colSpan={6}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', pl: '78px' }}>
                  {breaks.length === 0 ? (
                    <Box sx={{ fontSize: '12.8px', color: '#000' }}>No Prices</Box>
                  ) : (
                    breaks.map((priceBreak, index) => (
                      <Box key={`${ticket.id}-price-${index}`} sx={{ width: 50, flexShrink: 0 }}>
                        <Box sx={{ fontSize: '12.8px', color: '#676b72', lineHeight: 1.3 }}>
                          {priceBreak.quantity}
                        </Box>
                        <Box sx={{ fontSize: '15.36px', color: '#000', fontWeight: 400, lineHeight: 1.3 }}>
                          ${priceBreak.price.toFixed(2)}
                        </Box>
                      </Box>
                    ))
                  )}
                </Box>
              </TableCell>
            </TableRow>
          )}
        </React.Fragment>
      );
    });

  return (
    // pb keeps the last table row clear of the fixed action bar.
    <Box sx={{ p: 1, pb: BAR_CLEARANCE }}>
      <Typography variant="h1" sx={{ fontSize: 32, fontWeight: 700, color: '#000', mb: 3 }}>
        Everyday Tickets
      </Typography>

      {/* One filter row: [search 600][grouping][price set][added by], 8px gaps, never wrapping. */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flexWrap: 'nowrap', mb: 4 }}>
      {/* mt = the selects' 16px caption line, so every field box shares one top edge. */}
      <Box ref={searchRef} sx={{ position: 'relative', width: 600, maxWidth: '100%', mt: '16px' }}>
        <TextField
          fullWidth
          placeholder="Search for a product, category, brand, family or tag"
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={(e) => e.key === 'Escape' && setSearchOpen(false)}
          InputProps={{
            endAdornment: searchTerm ? (
              <InputAdornment position="end">
                <Box
                  component="button"
                  type="button"
                  aria-label="Clear search"
                  onClick={clearSearch}
                  sx={{
                    display: 'flex',
                    p: 0,
                    border: 0,
                    bgcolor: 'transparent',
                    color: '#313439',
                    cursor: 'pointer',
                    transition: INSTANT,
                  }}
                >
                  <ClearIcon sx={{ fontSize: 20 }} />
                </Box>
              </InputAdornment>
            ) : null,
          }}
          sx={{
            bgcolor: '#fff',
            '& .MuiOutlinedInput-root': {
              height: 53,
              borderRadius: 0,
              fontSize: 16,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '1px' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '1px' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '1px' },
            },
            // Zero the input's default 16.5px vertical padding so the fixed 53px root holds (MUI line-height artifact).
            '& .MuiOutlinedInput-input': { paddingTop: 0, paddingBottom: 0 },
            '& .MuiOutlinedInput-input::placeholder': { color: '#808080', opacity: 1 },
          }}
        />

        {/* 1 character opens the panel on the hint row; results only arrive from 2 characters up.
            The panel always renders once you type — an empty search says so instead of looking dead. */}
        {searchOpen && searchTerm.trim().length >= 1 && (
          <Box sx={PANEL_SX}>
            {searchTerm.trim().length < 2 ? (
              <Box sx={{ px: '16px', py: '8px', fontSize: '19.2px', color: '#676b72' }}>Start typing to search...</Box>
            ) : productResults.length === 0 && comboResults.length === 0 && classificationSections.length === 0 ? (
              <Box sx={{ px: '16px', py: '8px', fontSize: '19.2px', color: '#676b72' }}>No results</Box>
            ) : (
              <>
                {/* Results are grouped by entity type: products, our combos, then classifications. */}
                {productResults.length > 0 && (
                  <>
                    <Box sx={GROUP_HEADER_SX}>Products</Box>
                    {productResults.map((product) => (
                      <ResultRow
                        key={product.id}
                        imageUrl={product.imageUrl || product.images?.[0]?.imageUrl}
                        name={product.name}
                        query={searchTerm}
                        onClick={() => handleAddProduct(product)}
                      />
                    ))}
                  </>
                )}
                {comboResults.length > 0 && (
                  <>
                    <Box sx={GROUP_HEADER_SX}>Product Combos</Box>
                    {comboResults.map((combo) => (
                      <ResultRow
                        key={`combo-${combo.id}`}
                        imageUrl={combo.imageUrl}
                        name={combo.name}
                        query={searchTerm}
                        onClick={() => handleAddCombo(combo)}
                      />
                    ))}
                  </>
                )}
                {classificationSections.map(([heading, items]) => (
                  <React.Fragment key={heading}>
                    <Box sx={GROUP_HEADER_SX}>{heading}</Box>
                    {items.map((item) => (
                      <ResultRow
                        key={`${heading}-${item.id}`}
                        name={item.name}
                        query={searchTerm}
                        onClick={() => handleAddClassification(item)}
                      />
                    ))}
                  </React.Fragment>
                ))}
              </>
            )}
          </Box>
        )}
      </Box>

        {/* 'No Grouping' is the resting state, which the reference shows as the greyed
            placeholder 'Not Grouped' rather than a chosen value. */}
        <TicketSelect
          label="Product Grouping"
          placeholder="Not Grouped"
          value={grouping === 'No Grouping' ? '' : grouping}
          options={GROUPINGS}
          onChange={(value) => setGrouping(value || 'No Grouping')}
        />
        <TicketSelect
          label="Price Set"
          placeholder="Default Price Set"
          value={priceSet}
          options={priceSets}
          onChange={setPriceSet}
          clearable
        />
        <TicketSelect
          label="Added By"
          placeholder="Select..."
          value={addedByFilter}
          options={addedByOptions}
          onChange={setAddedByFilter}
          multiple
        />
      </Box>

      {/* overflow: visible keeps the sticky header pinned to the page scroll, not to the container. */}
      <TableContainer sx={{ mb: 2, overflow: 'visible' }}>
        <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <TableHead>
            <TableRow
              sx={{
                '& th': {
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                  bgcolor: '#5ebbeb',
                  color: '#f8f8f8',
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: '0.6px',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                  height: 52,
                  py: 0,
                  borderBottom: 'none',
                },
              }}
            >
              <TableCell sx={{ width: 32, px: 0 }}>
                <SquareCheckButton checked={allSelected} onClick={toggleAll} light label="Select all tickets" />
              </TableCell>
              <TableCell sx={{ width: '25%' }}>Name</TableCell>
              <TableCell sx={{ width: '25%' }}>Category</TableCell>
              <TableCell sx={{ width: '25%' }}>Added By</TableCell>
              <TableCell sx={{ width: '25%' }}>Added At</TableCell>
              <TableCell sx={{ width: 48, px: 0 }} />
            </TableRow>
          </TableHead>
          <TableBody
            sx={{
              '& td': {
                fontSize: 16,
                color: '#000',
                textAlign: 'center',
                padding: '16px 4px',
                borderBottom: '1px solid #f8f8f8',
              },
              // These beat the '& td' rule above (class + type), which would otherwise win.
              '& .everyday-ticket-prices td': { padding: '8px', textAlign: 'left' },
              // A row with its prices expanded hands the separator to the prices row below it.
              '& .everyday-ticket-open td': { borderBottom: 'none' },
              '& .everyday-ticket-group td': {
                bgcolor: '#313439',
                color: '#f8f8f8',
                fontWeight: 400,
                lineHeight: '20px',
                padding: '16px',
                borderBottom: 'none',
              },
              '& .everyday-ticket-group td:first-of-type': { padding: 0 },
            }}
          >
            {groups.map((group) => (
              <React.Fragment key={group.label ?? 'all'}>
                {group.label && (
                  <TableRow className="everyday-ticket-group" sx={{ height: 52 }}>
                    <TableCell sx={{ width: 32 }}>
                      <SquareCheckButton
                        checked={groupSelected(group.rows)}
                        onClick={() => toggleGroup(group.rows)}
                        light
                        label={`Select all in ${group.label}`}
                      />
                    </TableCell>
                    <TableCell colSpan={5}>{group.label}</TableCell>
                  </TableRow>
                )}
                {renderRows(group.rows)}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <CircularProgress size={22} sx={{ color: '#737373' }} />
        </Box>
      )}

      <Box sx={{ ...TICKET_BAR_SX, color: '#000' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            disableRipple
            disableElevation
            onClick={() => setAddAllOpen(true)}
            sx={{
              ...BAR_BUTTON_SX,
              minWidth: 193,
              bgcolor: '#d4d4d4',
              color: '#000',
              border: '1px solid #d4d4d4',
              '&:hover': { bgcolor: '#a3a3a3', border: '1px solid #a3a3a3', boxShadow: 'none' },
            }}
          >
            Add All Products
          </Button>
          <Button
            disableRipple
            disableElevation
            onClick={handleRemoveSelected}
            sx={{
              ...BAR_BUTTON_SX,
              minWidth: 197,
              bgcolor: '#fb2c36',
              color: '#fff',
              border: '1px solid #fb2c36',
              '&:hover': { bgcolor: '#ff6467', border: '1px solid #fb2c36', boxShadow: 'none' },
            }}
          >
            Remove Selected
          </Button>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShopfrontSwitch
              checked={viewPrices}
              onChange={(e) => setViewPrices(e.target.checked)}
              sx={{
                '& .MuiSwitch-switchBase': {
                  margin: '2.4px',
                  transitionDuration: '150ms',
                  transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                  '&.Mui-checked + .MuiSwitch-track': { backgroundColor: '#2b7fff' },
                },
                '& .MuiSwitch-thumb': { width: 19, height: 19 },
                '& .MuiSwitch-track': {
                  borderRadius: '24px',
                  transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1)',
                },
                '&:hover .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#2b7fff' },
              }}
            />
            <Typography sx={{ fontSize: 16, color: '#000' }}>View Prices</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TicketCounter count={selectedTickets.length} />
          {/* Print (ours) stays; Export matches the reference and its DesignPro data file. */}
          <Button disableRipple disableElevation onClick={handlePrint} sx={EXPORT_BUTTON_SX}>
            Print
          </Button>
          <Button disableRipple disableElevation onClick={handleExport} sx={EXPORT_BUTTON_SX}>
            Export
          </Button>
        </Box>
      </Box>

      <Dialog
        open={addAllOpen}
        onClose={() => setAddAllOpen(false)}
        PaperProps={{ sx: { borderRadius: '8px', width: 440, maxWidth: '92vw' } }}
      >
        <Box sx={{ px: 3, pt: 2.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 18, color: '#313439' }}>Add All Products</Typography>
        </Box>
        <DialogContent sx={{ px: 3, py: 2 }}>
          <Typography sx={{ fontSize: 16, color: '#313439' }}>
            Add products with a current stock of at least one item, or every product in your file?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 0, gap: 1.25 }}>
          <Button
            disableRipple
            disableElevation
            onClick={() => handleAddAllProducts(true)}
            sx={{
              ...BAR_BUTTON_SX,
              bgcolor: '#d4d4d4',
              color: '#000',
              '&:hover': { bgcolor: '#a3a3a3', boxShadow: 'none' },
            }}
          >
            Only Positive Inventory
          </Button>
          <Button
            disableRipple
            disableElevation
            onClick={() => handleAddAllProducts(false)}
            sx={{
              ...BAR_BUTTON_SX,
              bgcolor: '#5ebbeb',
              color: '#fff',
              '&:hover': { bgcolor: '#0ea5e9', boxShadow: 'none' },
            }}
          >
            All Products
          </Button>
        </DialogActions>
      </Dialog>

      <PrintTicketsDialog
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        tickets={printTickets}
        ticketType="Everyday"
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

export default EverydayTickets;
