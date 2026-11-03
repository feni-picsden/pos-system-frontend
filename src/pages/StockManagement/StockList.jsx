import React, { useState, useEffect, useMemo, useCallback, useRef, useDeferredValue, memo } from "react";
import PageLoader from '../../components/Common/PageLoader';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import {
  Container,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Autocomplete,
  FormControlLabel,
  Box,
  InputAdornment,
  CircularProgress,
} from "@mui/material";
import {
  IosShareOutlined as ExportIcon,
  LocalOfferOutlined as CategoryIcon,
  ImageOutlined as ProductIcon,
  HomeOutlined as FamilyIcon,
  SellOutlined as PriceSetIcon,
  ArrowDropDown as ArrowDropDownIcon,
} from "@mui/icons-material";
import productService from "../../services/productService";
import { matchesProductSearch } from "../../utils/productSearch.js";
import { rankProducts } from "../../utils/searchRank.js";
import shelfTicketService from "../../services/shelfTicketService";

// Shared style for the inline-editable grid inputs (1px #404040, radius 8px)
const editInputSx = (width, height = 42) => ({
  width,
  "& .MuiOutlinedInput-root": {
    height,
    borderRadius: "8px",
    fontSize: 16,
    backgroundColor: "#fff",
    "& fieldset": { borderColor: "#404040", borderWidth: "1px" },
    "&:hover fieldset": { borderColor: "#404040", borderWidth: "1px" },
    "&.Mui-focused fieldset": { borderColor: "#000", borderWidth: "2px" },
  },
});

// Dropdown groups in the reference's order; under 2 typed characters the
// reference only shows a "Keep Typing to Search..." hint.
const GROUP_ORDER = ["Categories", "Families", "Products", "Price Sets"];
const GROUP_ICONS = { Categories: CategoryIcon, Families: FamilyIcon, Products: ProductIcon, "Price Sets": PriceSetIcon };

// Reference "No Products" panel: a crossed circle beside the message
const EmptyIcon = () => (
  <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
    <circle cx="70" cy="70" r="55" fill="none" stroke="#000" strokeWidth="10" />
    <line x1="132" y1="8" x2="8" y2="132" stroke="#000" strokeWidth="10" strokeLinecap="round" />
  </svg>
);
const HINT_OPTION = { type: "hint", label: "Keep Typing to Search..." };
const ALL_PRODUCTS_LIMIT = 100000;

// Report-style sort mark: hollow up+down triangles after the label; `active`
// ('asc' | 'desc') fills the triangle of the current direction.
const SortIcon = ({ active }) => (
  <svg width="10" height="14" viewBox="0 0 10 14" style={{ marginLeft: 4, verticalAlign: "middle", display: "inline-block" }} aria-hidden="true">
    <path d="M1 5.5 L5 1.5 L9 5.5 Z" fill={active === 'asc' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active === 'asc' ? 1.6 : 1.1} strokeLinejoin="round" />
    <path d="M1 8.5 L5 12.5 L9 8.5 Z" fill={active === 'desc' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active === 'desc' ? 1.6 : 1.1} strokeLinejoin="round" />
  </svg>
);

// Cases on Hand is blank for a single-unit product (case quantity 1), as in the reference.
const casesOnHandText = (product) =>
  Number(product.caseQuantity) === 1 ? "" : product.currentStockCases || 0;

// Rows are drawn in steps as the grid scrolls (every row is four inputs; drawing a
// whole catalogue at once froze the page). The search box filters the grid once
// typing pauses.
const ROWS_STEP = 30;
const SEARCH_DELAY_MS = 300;

const formatPrice = (v) => (v === "" || v == null || Number.isNaN(Number(v)) ? v : Number(v).toFixed(2));

// Real inline-editable grid input; saves automatically on blur / Enter.
// `format` applies only while the input is not being typed in.
const EditCell = ({ productId, priceIndex, field, value, editing, onEdit, onChange, onSave, width = 150, height = 42, type = "number", prefix, suffix, format, color }) => {
  const shown = format && !editing ? format(value) : value;
  return (
    <TextField
      value={shown ?? ""}
      type={type}
      onFocus={() => onEdit(productId, priceIndex, field)}
      onChange={(e) => onChange(productId, field, e.target.value, priceIndex)}
      onBlur={(e) => {
        onEdit(null);
        onSave(productId, field, e.target.value, priceIndex);
      }}
      onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
      variant="outlined"
      InputProps={{
        startAdornment: prefix ? <InputAdornment position="start">{prefix}</InputAdornment> : undefined,
        endAdornment: suffix ? <InputAdornment position="end">{suffix}</InputAdornment> : undefined,
      }}
      sx={{ ...editInputSx(width, height), ...(color && { "& input": { color } }) }}
    />
  );
};

// One grid row (one price point). Memoised: typing in a cell re-draws only the
// rows of that product, not the whole grid.
const StockRow = memo(function StockRow({ product, pricePoint, priceIndex, editingField, onEdit, onChange, onSave }) {
  const cell = (field, value, opts) => (
    <EditCell
      productId={product.id} priceIndex={priceIndex} field={field} value={value}
      editing={editingField === field} onEdit={onEdit} onChange={onChange} onSave={onSave}
      {...opts}
    />
  );
  // Use the edited/saved profit when present, otherwise derive it from price vs cost
  let profitPercent = pricePoint.profitPercentage;
  if (profitPercent === undefined || profitPercent === null || profitPercent === "") {
    const totalCost = (product.itemCost || 0) * (Number(pricePoint.quantity) || 1);
    const totalPrice = Number(pricePoint.price) || 0;
    profitPercent = totalPrice > 0 ? ((totalPrice - totalCost) / totalPrice * 100).toFixed(2) : "0.00";
  } else if (typeof profitPercent === "number") {
    profitPercent = profitPercent.toFixed(2);
  }
  return (
    <TableRow>
      <TableCell>{cell("name", product.name, { width: 460, type: "text" })}</TableCell>
      <TableCell>{product.category?.name || ""}</TableCell>
      {/* Price sets are blank unless the price point is a named set */}
      <TableCell align="center">{pricePoint.priceSetName || ""}</TableCell>
      <TableCell align="center">{product.caseQuantity || 0}</TableCell>
      <TableCell align="center">{casesOnHandText(product)}</TableCell>
      {/* Negative stock stays black, as in the reference */}
      <TableCell align="center">{product.currentStockItems || 0}</TableCell>
      <TableCell>{cell("quantity", pricePoint.quantity ?? 1, { width: 150 })}</TableCell>
      <TableCell align="center">
        ${((product.itemCost || 0) * (Number(pricePoint.quantity) || 1)).toFixed(2)}
      </TableCell>
      <TableCell>{cell("price", pricePoint.price ?? 0, { width: 200, height: 40, prefix: "$", format: formatPrice })}</TableCell>
      <TableCell>
        {cell("profitPercentage", profitPercent, {
          width: 150, height: 40, suffix: "%",
          color: Number(profitPercent) < 0 ? "red" : undefined,
        })}
      </TableCell>
    </TableRow>
  );
});

const StockList = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOption, setSelectedOption] = useState(null);
  const [onlyWithStock, setOnlyWithStock] = useState(false);
  // Column sort (an addition — the reference Stock List has none). null = the
  // server's order. One click sorts ascending, a second flips it.
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  // The grid input being edited ({ productId, priceIndex, field }): shown raw while typing.
  const [editingCell, setEditingCell] = useState(null);
  // What the grid is filtered by: the search box text once typing pauses.
  const [gridSearch, setGridSearch] = useState("");
  const moreRowsRef = useRef(null);
  const gridRef = useRef(null);
  const [gridHeight, setGridHeight] = useState(null);
  const searchBoxRef = useRef(null);
  const searchPopperRef = useRef(null);
  const [searchBoxWidth, setSearchBoxWidth] = useState(null);
  // The grid follows these in the background, so the switch, search box and
  // headers answer at once while the rows catch up (a spinner shows meanwhile).
  const gridOption = useDeferredValue(selectedOption);
  const gridStockOnly = useDeferredValue(onlyWithStock);
  const gridSearchShown = useDeferredValue(gridSearch);
  const gridSort = useDeferredValue(sort);
  const updating =
    gridOption !== selectedOption || gridStockOnly !== onlyWithStock ||
    gridSearchShown !== gridSearch || gridSort !== sort ||
    (!selectedOption && searchTerm !== gridSearch);
  // Saves read the latest products without re-creating the row callbacks.
  const productsRef = useRef(products);
  productsRef.current = products;
  // Pending price save per product (saves of one product are sent in order)
  const saveQueue = useRef(new Map());

  // Fetch products on component mount
  useEffect(() => {
    fetchProducts();
  }, []);

  // Track the search box width (it changes when the page scrollbar comes or goes)
  useEffect(() => {
    const el = searchBoxRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(() => setSearchBoxWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading]);

  // ...and move the open list to match
  useEffect(() => {
    searchPopperRef.current?.update?.();
  }, [searchBoxWidth]);

  useEffect(() => {
    if (!searchTerm) { setGridSearch(""); return undefined; }
    const timer = setTimeout(() => setGridSearch(searchTerm), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const renamingId = editingCell?.field === "name" ? editingCell.productId : null;

  // Products the grid shows for the current search / selection / stock filter
  const filteredProducts = useMemo(() => {
    let filtered = Array.isArray(products) ? products : [];

    // A selected classification (category) filters the grid to that classification
    if (gridOption?.type === "Categories") {
      filtered = filtered.filter(
        (product) => product.category?.name === gridOption.label
      );
    } else if (gridOption?.type === "Families") {
      filtered = filtered.filter((product) => product.family?.name === gridOption.label);
    } else if (gridOption?.type === "Price Sets") {
      // Products with a row in that set; sortedRows keeps only those rows
      filtered = filtered.filter((product) =>
        (product.prices || []).some((row) => row.priceSetId === gridOption.id)
      );
    } else if (gridOption?.type === "Products") {
      // By id: matching the name dropped the row on the first key of a rename
      // (and picked up every other product of the same name)
      filtered = filtered.filter((product) => product.id === gridOption.id);
    } else if (gridSearchShown) {
      const lower = gridSearchShown.toLowerCase();
      filtered = filtered.filter(
        (product) =>
          // the product being renamed stays while its name is typed
          product.id === renamingId ||
          matchesProductSearch(product, gridSearchShown) ||
          product.category?.name?.toLowerCase().includes(lower) ||
          product.brand?.name?.toLowerCase().includes(lower) ||
          product.family?.name?.toLowerCase().includes(lower)
      );
    }

    // Filter by stock availability
    if (gridStockOnly) {
      filtered = filtered.filter((product) =>
        (product.currentStockCases || 0) > 0 || (product.currentStockItems || 0) > 0
      );
    }

    return rankProducts(filtered, gridSearchShown);
  }, [products, gridSearchShown, gridOption, gridStockOnly, renamingId]);

  // Grouped autocomplete options: Categories first, then Products
  // The grid is one row per PRICE POINT. Flatten once, with the same per-row
  // figures the cells show, so sorting and the CSV export share one list.
  const SORT_COLUMNS = [
    { key: "name", label: "Product", center: true },
    { key: "category", label: "Category" },
    { key: "priceSet", label: "Price Set", center: true },
    { key: "caseQuantity", label: "Case Quantity", numeric: true, center: true },
    { key: "casesOnHand", label: "Cases on Hand", numeric: true, center: true },
    { key: "itemsOnHand", label: "Items on Hand", numeric: true, center: true },
    { key: "quantity", label: "Quantity", numeric: true },
    { key: "cost", label: "Cost", numeric: true, center: true },
    { key: "price", label: "Price", numeric: true },
    { key: "profit", label: "Profit %", numeric: true },
  ];
  const sortedRows = useMemo(() => {
    const list = Array.isArray(filteredProducts) ? filteredProducts : [];
    const onlySet = gridOption?.type === "Price Sets" ? gridOption.id : null;
    const rows = list.flatMap((product) => {
      const prices = product.prices?.length ? product.prices : [{ price: 0, quantity: 1, profitPercentage: 0 }];
      return prices.flatMap((pricePoint, priceIndex) => {
        if (onlySet != null && pricePoint.priceSetId !== onlySet) return [];
        const quantity = Number(pricePoint.quantity) || 1;
        const cost = (product.itemCost || 0) * quantity;
        const price = Number(pricePoint.price) || 0;
        const saved = pricePoint.profitPercentage;
        const profit = saved !== undefined && saved !== null && saved !== ""
          ? Number(saved)
          : (price > 0 ? ((price - cost) / price) * 100 : 0);
        return [{
          product, pricePoint, priceIndex,
          values: {
            name: product.name || "",
            category: product.category?.name || "",
            priceSet: pricePoint.priceSetName || "",
            caseQuantity: product.caseQuantity || 0,
            casesOnHand: product.currentStockCases || 0,
            itemsOnHand: product.currentStockItems || 0,
            quantity, cost, price, profit,
          },
        }];
      });
    });
    if (!gridSort.key) return rows;
    const numeric = SORT_COLUMNS.find((c) => c.key === gridSort.key)?.numeric;
    const dir = gridSort.dir === "asc" ? 1 : -1;
    // stable: equal keys keep the server's order
    return rows
      .map((row, i) => ({ row, i }))
      .sort((a, b) => {
        const x = a.row.values[gridSort.key], y = b.row.values[gridSort.key];
        const c = numeric ? (Number(x) || 0) - (Number(y) || 0) : String(x).localeCompare(String(y), undefined, { sensitivity: "base" });
        return (c || a.i - b.i) * (c ? dir : 1);
      })
      .map(({ row }) => row);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredProducts, gridSort, gridOption]);
  const toggleSort = (key) =>
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  // How many rows are drawn; a new filter or sort starts again from the first
  // rows (editing a cell changes `products`, not this key, so it keeps its place).
  const viewKey = useMemo(
    () => [gridSearchShown, gridOption, gridStockOnly, gridSort],
    [gridSearchShown, gridOption, gridStockOnly, gridSort]
  );
  const [paging, setPaging] = useState({ key: null, rows: ROWS_STEP });
  const visibleRows = paging.key === viewKey ? paging.rows : ROWS_STEP;

  // Draw the next rows when the end of the drawn ones comes near the screen.
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
      { root: gridRef.current, rootMargin: "800px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleRows, sortedRows.length, loading, viewKey]);

  // Grid height: from its top on the page to the window's bottom, less the
  // page's bottom padding, so the sideways scrollbar is always in view and the
  // header stays on top (re-measured when the window resizes)
  // A new search / selection / filter / sort starts at the top of the grid
  useEffect(() => {
    gridRef.current?.scrollTo?.({ top: 0 });
  }, [viewKey]);

  const hasRows = sortedRows.length > 0;
  useEffect(() => {
    const measure = () => {
      const el = gridRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setGridHeight(Math.max(240, Math.floor(window.innerHeight - top - 32)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [loading, hasRows]);

  const searchOptions = useMemo(() => {
    const list = Array.isArray(products) ? products : [];
    const categories = [...new Set(list.map((p) => p.category?.name).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ type: "Categories", label: name }));
    const families = [...new Set(list.map((p) => p.family?.name).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ type: "Families", label: name }));
    const sets = new Map();
    list.forEach((p) => (p.prices || []).forEach((row) => {
      if (row.priceSetId != null && row.priceSetName) sets.set(row.priceSetId, row.priceSetName);
    }));
    const priceSets = [...sets]
      .map(([id, name]) => ({ type: "Price Sets", label: name, id }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const productOptions = list
      .filter((p) => p.name)
      // name / description / barcodes ride along so the dropdown can match
      // and rank them the way the sell screen search does.
      .map((p) => ({ type: "Products", label: p.name, id: p.id, name: p.name, description: p.description, barcodes: p.barcodes }));
    // A Combo Product is an ordinary product row, so it is already in productOptions.
    return [...categories, ...families, ...productOptions, ...priceSets];
  }, [products]);

  const calculateProfitPercentage = (cost, price) => {
    if (!price || price <= 0) return 0;
    return ((price - cost) / price) * 100;
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await productService.getProducts({
        status: 'Active,Inactive,Not Selling,Not Purchasing',
        includeAllStatuses: true,
        withPriceSets: 1,
        // The whole catalogue: GET /products pages at 50 by default, which left the
        // count, search, filters and CSV covering only the first 50 products (S1).
        limit: ALL_PRODUCTS_LIMIT
      });
      let productsArray = response?.products || response || [];

      // Profit % is on the ROW's cost: itemCost x the row's quantity, the same
      // basis as the grid's Cost cell and the product page. Using the single
      // item cost against a pack price showed a 12-pack costing $24 and selling
      // for $20 as 90% profit instead of -20% (QA N01).
      // Grid rows are the server's stockRows: default rows plus named price-set rows.
      productsArray = productsArray.map(product => ({
        ...product,
        prices: (product.stockRows || product.prices)?.map(price => ({
          ...price,
          // What the server holds: typing changes price/quantity live, a save
          // compares against these (and skips when nothing changed)
          savedPrice: price.price,
          savedQuantity: price.quantity,
          profitPercentage: calculateProfitPercentage(
            (product.itemCost || 0) * (Number(price.quantity) || 1),
            price.price || 0
          )
        })) || []
      }));
      
      setProducts(productsArray);
    } catch (error) {
      console.error("Error fetching products:", error);
      // For demo purposes, use mock data
      const mockProducts = [
        {
          id: 1,
          name: "-196 GRAPE 6% CAN 10PK 330ML",
          category: { name: "Pre Mix / RTDs" },
          brand: { name: "196" },
          family: { name: "Pre Mix" },
          caseQuantity: 10,
          currentStockCases: 5,
          currentStockItems: 50,
          caseCost: 35.60,
          itemCost: 3.56,
          prices: [
            { price: 60.00, quantity: 1 },
            { price: 37.50, quantity: 10 }
          ],
        },
        {
          id: 2,
          name: "$5 WINE BOTTLE",
          category: { name: "Wine" },
          brand: { name: "House Wine" },
          family: { name: "Red Wine" },
          caseQuantity: 12,
          currentStockCases: 2,
          currentStockItems: -10,
          caseCost: 0.00,
          itemCost: 0.00,
          prices: [{ price: 5.00, quantity: 1 }],
        },
        {
          id: 3,
          name: "151 EAST VODKA 700ML",
          category: { name: "Spirits" },
          brand: { name: "151 East" },
          family: { name: "Vodka" },
          caseQuantity: 12,
          currentStockCases: 3,
          currentStockItems: 36,
          caseCost: 25.00,
          itemCost: 2.08,
          prices: [{ price: 35.00, quantity: 1 }],
        },
      ];
      
      // Calculate profit percentage for mock data too
      const mockProductsWithProfit = mockProducts.map(product => ({
        ...product,
        prices: product.prices?.map(price => ({
          ...price,
          profitPercentage: calculateProfitPercentage(
            (product.itemCost || 0) * (Number(price.quantity) || 1),
            price.price || 0
          )
        })) || []
      }));

      setProducts(mockProductsWithProfit);
    } finally {
      setLoading(false);
    }
  };

  // Live (uncommitted) edit of an inline grid input
  const handleCellChange = useCallback((productId, field, value, priceIndex = 0) => {
    setProducts((prev) => prev.map((p) => {
      if (p.id !== productId) return p;
      if (field === 'name') return { ...p, name: value };
      const prices = (p.prices?.length ? p.prices : [{ price: 0, quantity: 1, profitPercentage: 0 }]);
      return {
        ...p,
        prices: prices.map((pp, i) => (i === priceIndex ? { ...pp, [field]: value } : pp)),
      };
    }));
  }, []);

  const handleCellEdit = useCallback((productId, priceIndex, field) => {
    setEditingCell(productId == null ? null : { productId, priceIndex, field });
  }, []);

  const handleCellSave = useCallback(async (productId, field, newValue, priceIndex = 0) => {
    const before = productsRef.current;
    try {
      let updatedProduct = { ...before.find(p => p.id === productId) };

      if (field === 'price' || field === 'profitPercentage' || field === 'quantity') {
        // One price row changes, saved on the very row the grid shows (an outlet's
        // own price stays that outlet's): the old full-product PUT rebuilt every
        // row without its outlet, so one outlet's edit re-priced every outlet.
        const row = updatedProduct.prices?.[priceIndex] || { quantity: 1 };
        const itemCost = updatedProduct.itemCost || 0;
        const savedQty = Number(row.savedQuantity ?? row.quantity) || 1;
        const savedPrice = row.savedPrice != null ? Number(row.savedPrice) : null;
        const toCents = (v) => Math.round(v * 100) / 100;
        const margin = (price, cost) => (price > 0 ? ((price - cost) / price) * 100 : 0);
        const putRow = (values) => setProducts((prev) => prev.map((p) => (p.id !== productId ? p : {
          ...p,
          prices: (p.prices?.length ? p.prices : [row]).map((pp, i) => (i === priceIndex ? { ...pp, ...values } : pp)),
        })));
        // Back to what the server holds (nothing changed, invalid, failed or deferred)
        const restore = () => putRow({
          price: savedPrice ?? row.price, quantity: savedQty,
          savedPrice: row.savedPrice, savedQuantity: row.savedQuantity,
          profitPercentage: margin(Number(savedPrice ?? row.price) || 0, itemCost * savedQty),
        });

        let quantity = savedQty;
        let price = savedPrice ?? 0;
        if (field === 'quantity') {
          quantity = parseInt(newValue, 10);
          // a tier move keeps its price; a $0 row has no price to keep
          if (!(quantity > 0) || quantity === savedQty || !(price > 0)) return restore();
        } else if (field === 'price') {
          const typed = parseFloat(newValue);
          if (!(typed > 0) || typed === savedPrice) return restore();
          price = toCents(typed);
        } else {
          // Price from the target margin on the ROW's cost (itemCost x quantity),
          // to the cent: an unrounded result stored values like 11.99953980671882.
          const pct = parseFloat(newValue);
          if (!(pct < 100)) return restore(); // 100%+ has no finite price
          price = toCents((itemCost * savedQty) / (1 - pct / 100));
          if (!(price > 0) || (savedPrice != null && price === toCents(savedPrice))) return restore();
        }
        const cost = itemCost * quantity;
        // Saved values move at once, so a next edit sent before this answer
        // starts from them (a stale quantity sent a second move to the wrong row)
        putRow({ price, quantity, profitPercentage: margin(price, cost), savedPrice: price, savedQuantity: quantity });
        try {
          // One product's saves go one after another: sent together, a quantity
          // move could land first and the price save then found its row "changed"
          const send = () => productService.bulkUpdatePrices([{
            productId,
            prices: [{
              quantity, fromQuantity: savedQty, price, cost,
              percentage: cost > 0 ? toCents(margin(price, cost)) : 0,
              priceSetId: row.priceSetId ?? null,
              priceId: row.id,
            }],
          }]);
          const queued = (saveQueue.current.get(productId) || Promise.resolve()).then(send);
          saveQueue.current.set(productId, queued.catch(() => {}));
          const res = await queued;
          const result = res?.results?.find((r) => Number(r.productId) === Number(productId));
          if (result && result.success === false) throw new Error(result.error || 'Save failed');
          // Price Activation Time queued it as a Future Price: the live price stays
          if (result?.deferredPrices?.length) restore();
          // A retail price change queues the product for shelf ticket printing (same as Capped Pricing).
          if (field !== 'quantity') {
            await shelfTicketService
              .addShelfTicket({ productId, ticketType: 'Everyday', productGrouping: null })
              .catch((err) => console.error('Error adding shelf ticket:', err));
          }
        } catch (apiError) {
          console.error("Error updating price via API:", apiError);
          restore();
        }
        return;
      }

      if (field === 'name') {
        updatedProduct.name = newValue;
      } else if (field === 'currentStockItems') {
        // Only allow editing of stock quantity
        updatedProduct[field] = parseInt(newValue);
      }

      // Update local state
      setProducts((prev) => prev.map(p => p.id === productId ? updatedProduct : p));

      // Make API call to save changes (prices save automatically, no Save button)
      try {
        // skipOutletScope: an admin working in an outlet would otherwise get that
        // outlet stamped on the product, taking a global product out of every other outlet
        if (field === 'name') {
          await productService.updateProduct(productId, { name: updatedProduct.name }, { skipOutletScope: true });
        } else if (field === 'currentStockItems') {
          // Update stock quantity
          console.log('Updating stock quantity:', { productId, currentStockItems: updatedProduct.currentStockItems });
          await productService.updateProduct(productId, {
            currentStockItems: updatedProduct.currentStockItems
          }, { skipOutletScope: true });
        }
      } catch (apiError) {
        console.error("Error updating product via API:", apiError);
        // Revert local changes if API call fails
        setProducts(before);
      }

    } catch (error) {
      console.error("Error updating product:", error);
    }
  }, []);

  const exportToCSV = () => {
    // The reference export: every value quoted, ID first, cost unpadded
    // ("40.5"), price and profit to 2 decimals, Cases on hand blank at case qty 1.
    const headers = [
      "ID",
      "Name",
      "Category",
      "Price Set",
      "Case Quantity",
      "Cases on hand",
      "Items on hand",
      "Quantity",
      "Cost",
      "Price",
      "Profit"
    ];
    const quote = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

    // Mirror the grid: one row per PRICE POINT, with the same per-row
    // quantity/cost/profit figures the table body renders.
    const csvContent = [
      headers.map(quote).join(","),
      ...sortedRows.map(({ product, values }) => [
        product.id,
        values.name,
        values.category,
        values.priceSet,
        product.caseQuantity || 0,
        casesOnHandText(product),
        values.itemsOnHand,
        values.quantity,
        String(Math.round(values.cost * 100) / 100),
        values.price.toFixed(2),
        (Number(values.profit) || 0).toFixed(2),
      ].map(quote).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "stocklist.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return <PageLoader />;
  }

  return (
    // Full page width with an 8px side gap, as the reference Stock List
    <Container maxWidth={false} disableGutters sx={{ py: 4, px: "8px" }}>
      {/* Header: title + Export (left), count at the far right */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
            Stock List
          </Typography>
          <Button
            variant="outlined"
            startIcon={<ExportIcon />}
            onClick={exportToCSV}
            sx={{
              height: 42,
              borderRadius: "12px",
              px: 2,
              border: "1px solid #8b8b8b",
              color: "#6f6f6f",
              fontSize: 16,
              fontWeight: 700,
              textTransform: "none",
              boxShadow: "none",
              transition: "none",
              "&:hover": {
                border: "1px solid #8b8b8b",
                backgroundColor: "transparent",
                boxShadow: "none",
                transition: "none",
              },
            }}
          >
            Export to CSV
          </Button>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {updating && <CircularProgress size={18} thickness={5} aria-label="Updating list" sx={{ color: "#5ebbeb" }} />}
          <Typography sx={{ fontSize: 16, color: "#525252" }}>
            {Array.isArray(filteredProducts) ? filteredProducts.length : 0} Products
          </Typography>
        </Box>
      </Box>

      {/* Search and Filter */}
      <Box sx={{ mb: 3 }}>
        <Autocomplete
          ref={searchBoxRef}
          fullWidth
          freeSolo
          forcePopupIcon
          popupIcon={<ArrowDropDownIcon sx={{ color: "#808080" }} />}
          value={selectedOption}
          inputValue={searchTerm}
          onInputChange={(e, value, reason) => {
            setSearchTerm(value);
            if (reason === "input" || reason === "clear") setSelectedOption(null);
          }}
          onChange={(e, value) => {
            if (value && typeof value === "object") {
              setSelectedOption(value);
              setSearchTerm(value.label);
            } else {
              setSelectedOption(null);
            }
          }}
          options={searchOptions}
          autoHighlight
          // Under 2 characters only the hint shows. Categories, families and
          // price sets match anywhere in the name; products use the sell-screen
          // rules (every typed word, any order; best match first).
          filterOptions={(opts, { inputValue }) => {
            const q = String(inputValue || "").trim();
            if (q.length < 2) return [HINT_OPTION];
            const lower = q.toLowerCase();
            const named = (type) => opts.filter((o) => o.type === type && o.label.toLowerCase().includes(lower));
            const prods = rankProducts(opts.filter((o) => o.type === "Products" && matchesProductSearch(o, q)), q);
            return GROUP_ORDER.flatMap((type) => (type === "Products" ? prods : named(type)));
          }}
          groupBy={(option) => (option.type === "hint" ? "" : option.type)}
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
          getOptionDisabled={(option) => option.type === "hint"}
          getOptionLabel={(option) => (typeof option === "string" ? option : option.label)}
          isOptionEqualToValue={(o, v) => o.type === v.type && o.label === v.label}
          slotProps={{
            // The open list keeps the search box's width when the page scrollbar
            // comes or goes (MUI sizes it only once, when it opens).
            popper: {
              popperRef: searchPopperRef,
              ...(searchBoxWidth && { style: { width: searchBoxWidth } }),
            },
            paper: {
              sx: {
                border: "1px solid #000",
                borderRadius: "8px",
                boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
                // freeSolo opens an empty list when nothing matches; hide it (no stray line)
                "&:empty": { display: "none" },
                "& .MuiAutocomplete-listbox": { maxHeight: 288, padding: 0 },
                "& .MuiAutocomplete-groupLabel": {
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#000",
                  padding: "16px",
                  backgroundColor: "#fff",
                  lineHeight: 1.2,
                },
                // ponytail: doubled selector + li tag beats MUI's grouped-option defaults
                "&& li.MuiAutocomplete-option": {
                  minHeight: 56,
                  height: 56,
                  padding: "16px",
                  fontSize: 16,
                  cursor: "pointer",
                  gap: "8px",
                  '&[aria-selected="true"], &.Mui-focused, &.Mui-focusVisible, &:hover, &[aria-selected="true"].Mui-focused':
                    {
                      backgroundColor: "#7dd3fc",
                    },
                  // the "Keep Typing to Search..." hint: plain text, not a choice
                  '&[aria-disabled="true"]': { opacity: 1, cursor: "default", backgroundColor: "#fff" },
                },
              },
            },
          }}
          renderOption={(props, option) => {
            const Icon = GROUP_ICONS[option.type];
            return (
              <Box component="li" {...props} key={`${option.type}-${option.id ?? option.label}`}>
                {Icon && <Icon sx={{ fontSize: 20, color: "#404040" }} />}
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
                "& .MuiOutlinedInput-root": {
                  height: 42,
                  borderRadius: "8px",
                  fontSize: 16,
                  paddingTop: "0 !important",
                  paddingBottom: "0 !important",
                  "& fieldset": { borderColor: "#404040", borderWidth: "1px" },
                  "&:hover fieldset": { borderColor: "#404040", borderWidth: "1px" },
                  "&.Mui-focused fieldset": { borderColor: "#000", borderWidth: "2px" },
                },
                "& input::placeholder": { color: "#808080", opacity: 1 },
                // react-select-style static chevron: no rotate on open
                "& .MuiAutocomplete-popupIndicator": { transform: "none" },
                "& .MuiAutocomplete-popupIndicatorOpen": { transform: "none" },
              }}
            />
          )}
        />
        <FormControlLabel
          control={
            <ShopfrontSwitch
              checked={onlyWithStock}
              onChange={(e) => setOnlyWithStock(e.target.checked)}
            />
          }
          label="Only display products that have stock (when editing a classification or all products)"
          sx={{
            ml: 0,
            gap: "8px",
            "& .MuiFormControlLabel-label": { fontSize: 16, color: "#000" },
          }}
        />
      </Box>

      {/* Table */}
      {/* Cells stay on one line with 24px column gaps; when that outgrows the page
          the table scrolls sideways inside this rounded box (corners stay round). */}
      {sortedRows.length === 0 ? (
        // Reference: nothing in scope shows a crossed circle and a message
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, py: 6, opacity: updating ? 0.5 : 1 }}>
          <EmptyIcon />
          <Box>
            <Typography sx={{ fontSize: 24, fontWeight: 700, color: "#000", mb: 3 }}>No Products</Typography>
            <Typography sx={{ fontSize: 16, color: "#000" }}>Search did not yield any results.</Typography>
          </Box>
        </Box>
      ) : (
      <TableContainer
        ref={gridRef}
        component={Paper}
        // until measured, a safe height (unbounded let the first draw load extra rows)
        sx={{ boxShadow: "none", borderRadius: "12px", overflow: "auto", maxHeight: gridHeight ?? "60vh" }}
      >
        <Table stickyHeader>
          <TableHead>
            <TableRow
              sx={{
                backgroundColor: "#5ebbeb",
                "& th": {
                  backgroundColor: "#5ebbeb", // a sticky header cell paints its own background
                  // ...and at 125% / 150% scaling a hairline seam showed between
                  // cells; 1px of the same blue to the right covers it
                  boxShadow: "1px 0 0 #5ebbeb",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 16,
                  textTransform: "none",
                  height: 51,
                  py: 0,
                  borderBottom: "none",
                  cursor: "pointer",
                  userSelect: "none",
                  whiteSpace: "nowrap", // one-line labels, as in the reports
                  px: "24px",
                },
                "& th:first-of-type": { borderTopLeftRadius: "12px" },
                "& th:last-of-type": { borderTopRightRadius: "12px" },
              }}
            >
              {SORT_COLUMNS.map((col) => (
                <TableCell
                  key={col.key}
                  align={col.center ? "center" : "left"}
                  onClick={() => toggleSort(col.key)}
                  sortDirection={sort.key === col.key ? sort.dir : false}
                >
                  {col.label}
                  {sortedRows.length > 1 && <SortIcon active={sort.key === col.key ? sort.dir : null} />}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody
            aria-busy={updating}
            sx={{
              "& td": { fontSize: 16, color: "#000", borderBottom: "none", whiteSpace: "nowrap", px: "24px" },
              // rows still showing the previous filter while the new one draws
              opacity: updating ? 0.5 : 1,
              transition: "opacity 120ms",
            }}
          >
            {sortedRows.slice(0, visibleRows).map(({ product, pricePoint, priceIndex }) => (
              <StockRow
                key={`${product.id}-${priceIndex}`}
                product={product}
                pricePoint={pricePoint}
                priceIndex={priceIndex}
                editingField={editingCell && editingCell.productId === product.id && editingCell.priceIndex === priceIndex ? editingCell.field : null}
                onEdit={handleCellEdit}
                onChange={handleCellChange}
                onSave={handleCellSave}
              />
            ))}
            {/* Marker after the drawn rows: coming into view draws the next ones */}
            {visibleRows < sortedRows.length && (
              <TableRow ref={moreRowsRef}>
                <TableCell colSpan={SORT_COLUMNS.length} align="center" sx={{ py: 2 }}>
                  <CircularProgress size={22} thickness={5} aria-label="Loading more rows" sx={{ color: "#5ebbeb" }} />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      )}
    </Container>
  );
};

export default StockList;
