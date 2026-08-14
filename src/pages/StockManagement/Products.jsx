import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Alert,
  CircularProgress,
  TextField,
  Collapse,
  IconButton,
  Pagination,
  Stack,
  Link,
  Snackbar,
} from "@mui/material";
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Clear as ClearIcon,
  DirectionsRun as DirectionsRunIcon,
  ArrowDropDown as ArrowDropDownIcon,
  UploadFile as UploadFileIcon,
  Merge as MergeIcon,
  VisibilityOutlined as VisibilityOutlinedIcon,
  EditOutlined as EditOutlinedIcon,
  DeleteOutline as DeleteOutlineIcon,
} from "@mui/icons-material";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import PerformanceSparkline from "../../components/Products/PerformanceSparkline";
import ConfirmDeleteDialog from "../../components/Common/ConfirmDeleteDialog";
import PermissionGate from "../../components/Common/PermissionGate";
import productService from "../../services/productService";
import { taxRateService } from "../../services/taxRateService";
import posLocalDb from "../../services/posLocalDb";
import { fetchAllProducts } from "../../services/posCatalogSync";
import usePageCache from "../../hooks/usePageCache";
import { matchesProductFilters } from "../../utils/productFilter";
import { useSelectedOutlet } from "../../contexts/SelectedOutletContext";

// Shopfront-style multi-select type-ahead combobox used by every filter on this page:
// label above the field, 'Select...' placeholder, gray chips (collapsing to 'N Selected...')
// plus an 'x' clear-all button inside the field, and a white option panel with a 1px black
// border where rows carry square checkboxes, hover is sky-300 (#7dd3fc), selected options are
// pinned to the top and rendered sky-blue (#38bdf8). Typing filters the option list and
// selecting keeps the panel open, exactly like the reference component.
// `single` renders the reference's tri-state variant: no checkboxes, picking an
// option replaces the current one and closes the panel.
const ShopfrontComboFilter = ({ label, options, value, onChange, pinSelected = true, single = false }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  // Close when clicking anywhere outside the field/panel
  useEffect(() => {
    if (!open) return undefined;
    const handleOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    // Capture phase: the caret/clear icons stopPropagation on mousedown, which under
    // React root delegation would stop a bubbling listener from ever reaching document
    // and leave a sibling filter's panel open alongside the newly opened one.
    document.addEventListener("mousedown", handleOutside, true);
    return () => document.removeEventListener("mousedown", handleOutside, true);
  }, [open]);

  const queryLower = query.trim().toLowerCase();
  const visible = queryLower
    ? options.filter((option) => (option.name || "").toLowerCase().includes(queryLower))
    : options;
  // Reference pins selected options to the top of the panel, except filters like
  // Status that keep a fixed option order regardless of selection.
  const ordered = pinSelected
    ? [
        ...visible.filter((option) => value.includes(option.id)),
        ...visible.filter((option) => !value.includes(option.id)),
      ]
    : visible;
  const selectedOptions = value.map(
    (id) => options.find((option) => option.id === id) || { id, name: id }
  );

  const openPanel = () => {
    setOpen(true);
    if (inputRef.current) inputRef.current.focus();
  };

  const closePanel = () => {
    setOpen(false);
    setQuery("");
  };

  // Selecting keeps the panel open (reference behavior); clear the typed filter
  const toggleOption = (id) => {
    if (single) {
      onChange([id]);
      closePanel();
      return;
    }
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
    setQuery("");
    if (inputRef.current) inputRef.current.focus();
  };

  const chipSx = {
    bgcolor: "rgba(0,0,0,0.1)",
    borderRadius: "4px",
    px: 1,
    fontSize: 14,
    lineHeight: "24px",
    color: "#000",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "100%",
  };

  return (
    <Box ref={rootRef} sx={{ position: "relative", minWidth: 0 }}>
      <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 400, fontSize: 16, color: "#000" }}>
        {label}
      </Typography>
      <Box
        onClick={openPanel}
        sx={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "4px",
          minHeight: 42,
          boxSizing: "border-box",
          bgcolor: "#fff",
          border: "1px solid #404040",
          borderRadius: "8px",
          px: "10px",
          py: "4px",
          cursor: "text",
        }}
      >
        {value.length >= 3 ? (
          <Box component="span" sx={chipSx}>{`${value.length} Selected...`}</Box>
        ) : (
          selectedOptions.map((option) => (
            <Box key={option.id} component="span" sx={chipSx}>
              {option.name}
            </Box>
          ))
        )}
        <Box
          component="input"
          ref={inputRef}
          value={query}
          placeholder={value.length === 0 ? "Select..." : ""}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") closePanel();
          }}
          sx={{
            flex: 1,
            minWidth: 40,
            border: 0,
            outline: "none",
            fontSize: 16,
            fontFamily: "inherit",
            color: "#000",
            bgcolor: "transparent",
            p: 0,
            height: 24,
            "&::placeholder": { color: "#808080", opacity: 1 },
          }}
        />
        {value.length > 0 && !single && (
          <IconButton
            size="small"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
              setQuery("");
            }}
            sx={{ p: "2px", color: "#808080" }}
          >
            <ClearIcon sx={{ fontSize: 18 }} />
          </IconButton>
        )}
        <ArrowDropDownIcon
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (open) closePanel();
            else openPanel();
          }}
          sx={{ color: "#404040", cursor: "pointer" }}
        />
      </Box>
      {open && (
        <Box
          sx={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 1300,
            mt: "4px",
            bgcolor: "#fff",
            border: "1px solid #000",
            borderRadius: "8px",
            maxHeight: 288,
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          {ordered.length === 0 ? (
            <Box sx={{ px: 2, py: 1, fontSize: 16, color: "#808080" }}>No options</Box>
          ) : (
            ordered.map((option) => {
              const isSelected = value.includes(option.id);
              return (
                <Box
                  key={option.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggleOption(option.id)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    px: 2,
                    py: 1,
                    fontSize: 16,
                    cursor: "pointer",
                    color: isSelected ? "#38bdf8" : "#000",
                    "&:hover": { bgcolor: "#7dd3fc" },
                  }}
                >
                  {!single && (
                    <Box
                      sx={{
                        width: 16,
                        height: 16,
                        flex: "0 0 16px",
                        borderRadius: 0,
                        border: isSelected ? "1px solid #38bdf8" : "1px solid #767676",
                        bgcolor: isSelected ? "#38bdf8" : "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="#fff" />
                        </svg>
                      )}
                    </Box>
                  )}
                  <Box component="span" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                    {option.name}
                  </Box>
                </Box>
              );
            })
          )}
        </Box>
      )}
    </Box>
  );
};

const Products = () => {
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const navigate = useNavigate();

  // Filter states (all multi-select arrays, matching the reference comboboxes)
  const [brandFilter, setBrandFilter] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState([]);
  const [familyFilter, setFamilyFilter] = useState([]);
  const [tagFilter, setTagFilter] = useState([]);
  const [supplierFilter, setSupplierFilter] = useState([]);
  const [statusFilter, setStatusFilter] = useState([
    "Active",
    "Not Selling",
    "Not Purchasing",
  ]);
  const [typeFilter, setTypeFilter] = useState([]);
  const [retailTaxRateFilter, setRetailTaxRateFilter] = useState([]);
  const [purchaseTaxRateFilter, setPurchaseTaxRateFilter] = useState([]);
  const [sellOnShopFilter, setSellOnShopFilter] = useState(["Ignore"]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [functionsAnchorEl, setFunctionsAnchorEl] = useState(null);
  const functionsMenuOpen = Boolean(functionsAnchorEl);
  const functionsRef = useRef(null);
  const { selectedOutletId } = useSelectedOutlet();
  const outletInitRef = useRef(false);

  // The whole catalog lives in IndexedDB — the list renders from it instantly and
  // revalidates in the background, exactly like the reference POS.
  const {
    data: allProducts,
    loading,
    refresh: loadProducts,
    mutate: mutateProducts,
  } = usePageCache('products', () => fetchAllProducts(selectedOutletId), {
    deps: [selectedOutletId],
  });

  // Click outside handler for functions dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        functionsRef.current &&
        !functionsRef.current.contains(event.target)
      ) {
        setFunctionsAnchorEl(null);
      }
    };

    if (functionsMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [functionsMenuOpen]);

  // Classification options states
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [families, setFamilies] = useState([]);
  const [tags, setTags] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [taxRates, setTaxRates] = useState([]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;


  useEffect(() => {
    loadClassificationOptions();
  }, []);

  // Reload the option lists when the navbar outlet selection changes; the product
  // list itself re-keys off selectedOutletId through usePageCache.
  useEffect(() => {
    if (!outletInitRef.current) {
      outletInitRef.current = true;
      return;
    }
    setCurrentPage(1);
    loadClassificationOptions();
  }, [selectedOutletId]);

  // Debounce the search box so filtering runs once the user pauses typing.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Any filter change starts again at page 1.
  useEffect(() => {
    setCurrentPage(1);
  }, [
    debouncedSearchTerm,
    brandFilter,
    categoryFilter,
    familyFilter,
    tagFilter,
    supplierFilter,
    statusFilter,
    typeFilter,
    retailTaxRateFilter,
    purchaseTaxRateFilter,
    sellOnShopFilter,
  ]);

  // Transform API product data to match frontend expectations
  const transformProductData = (apiProducts) => {
    return apiProducts.map((product) => {
      // One Cost and one Price per row: the base (qty-1) retail band. `prices` holds
      // every quantity break and its price/cost are band TOTALS, so mapping the whole
      // array printed the qty-100 total ($15400.00) as if it were a shelf price.
      // The backend already sorts prices by quantity ASC and derives retailPrice.
      const base = product.prices?.[0];
      return {
        id: product.id,
        name: product.name || "",
        category: product.category?.name || "",
        status: product.status || "Active",
        cost:
          Number(product.itemCost) ||
          (base ? (Number(base.cost) || 0) / (Number(base.quantity) || 1) : 0),
        inventory: {
          cases: product.currentStockCases || 0,
          items: product.currentStockItems || 0,
        },
        price: Number(product.retailPrice) || Number(base?.price) || 0,
        performance: [10, 15, 12, 18, 14, 16, 13], // Mock performance data
        brand: product.brand?.name || "",
        family: product.family?.name || "",
        tag: product.tags?.map((t) => t.tag.name).join(", ") || "",
        supplier: product.suppliers?.map((s) => s.supplier.name).join(", ") || "",
        type: product.type || "",
        retailTaxRate: product.retailTaxRate || "",
        purchaseTaxRate: product.purchaseTaxRate || "",
      };
    });
  };

  const loadClassificationOptions = async () => {
    await posLocalDb.init();

    // Read all classification stores from IDB in parallel
    const [cachedCats, cachedBrands, cachedFamilies, cachedTags, cachedSuppliers, cachedTaxRates] =
      await Promise.all([
        posLocalDb.getStoreAll('categories'),
        posLocalDb.getStoreAll('brands'),
        posLocalDb.getStoreAll('families'),
        posLocalDb.getStoreAll('tags'),
        posLocalDb.getStoreAll('suppliers'),
        posLocalDb.getStoreAll('taxRates'),
      ]);

    const hasCachedData = cachedCats.length > 0 || cachedBrands.length > 0 || cachedTaxRates.length > 0;

    if (hasCachedData) {
      // Show cached data immediately
      if (cachedCats.length > 0) setCategories(cachedCats);
      if (cachedBrands.length > 0) setBrands(cachedBrands);
      if (cachedFamilies.length > 0) setFamilies(cachedFamilies);
      if (cachedTags.length > 0) setTags(cachedTags);
      if (cachedSuppliers.length > 0) setSuppliers(cachedSuppliers);
      if (cachedTaxRates.length > 0) setTaxRates(cachedTaxRates);

      // Background refresh if stale
      const stale = await posLocalDb.isStoreStale('categories');
      if (!stale) return;
    }

    // Fetch fresh from API (either no cache or stale)
    try {
      const [cats, brands, families, tags, suppliers, taxRatesRes] = await Promise.all([
        productService.getCategories(),
        productService.getBrands(),
        productService.getFamilies(),
        productService.getTags(),
        productService.getSuppliers(),
        taxRateService.getTaxRates(),
      ]);

      const catsArr = Array.isArray(cats) ? cats : [];
      const brandsArr = Array.isArray(brands) ? brands : [];
      const familiesArr = Array.isArray(families) ? families : [];
      const tagsArr = Array.isArray(tags) ? tags : [];
      const suppliersArr = Array.isArray(suppliers) ? suppliers : [];
      const taxRatesArr = Array.isArray(taxRatesRes?.taxRates) ? taxRatesRes.taxRates : [];

      // Persist to IDB
      await Promise.all([
        catsArr.length > 0 ? posLocalDb.putStoreAll('categories', catsArr) : Promise.resolve(),
        brandsArr.length > 0 ? posLocalDb.putStoreAll('brands', brandsArr) : Promise.resolve(),
        familiesArr.length > 0 ? posLocalDb.putStoreAll('families', familiesArr) : Promise.resolve(),
        tagsArr.length > 0 ? posLocalDb.putStoreAll('tags', tagsArr) : Promise.resolve(),
        suppliersArr.length > 0 ? posLocalDb.putStoreAll('suppliers', suppliersArr) : Promise.resolve(),
        taxRatesArr.length > 0 ? posLocalDb.putStoreAll('taxRates', taxRatesArr) : Promise.resolve(),
      ]);

      setCategories(catsArr);
      setBrands(brandsArr);
      setFamilies(familiesArr);
      setTags(tagsArr);
      setSuppliers(suppliersArr);
      setTaxRates(taxRatesArr);
    } catch (error) {
      console.error("Error loading classification options:", error);
      // Keep whatever cached data we already set above
    }
  };

  // Every filter narrows the cached catalog locally. The server used to run all
  // of this, one request per keystroke, page and filter change; it now only ever
  // sees the background sync. Multi-select filters also work properly here — the
  // API only honoured the first id of each array.
  const filteredProducts = useMemo(() => {
    const filters = {
      search: debouncedSearchTerm,
      status: statusFilter,
      brand: brandFilter,
      category: categoryFilter,
      family: familyFilter,
      tags: tagFilter,
      supplier: supplierFilter,
      type: typeFilter,
      retailTaxRate: retailTaxRateFilter,
      purchaseTaxRate: purchaseTaxRateFilter,
      sellOnShop: sellOnShopFilter,
    };
    // Sort here, not in the data sources: the IndexedDB first paint comes back in
    // insertion order and the API refresh in name order, so rows reordered under
    // the user once the background sync landed.
    return allProducts
      .filter((p) => matchesProductFilters(p, filters))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [
    allProducts,
    debouncedSearchTerm,
    brandFilter,
    categoryFilter,
    familyFilter,
    tagFilter,
    supplierFilter,
    statusFilter,
    typeFilter,
    retailTaxRateFilter,
    purchaseTaxRateFilter,
    sellOnShopFilter,
  ]);

  const totalProducts = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalProducts / itemsPerPage));
  const products = useMemo(
    () =>
      transformProductData(
        filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
      ),
    [filteredProducts, currentPage]
  );

  const handleAddProduct = () => {
    navigate("/products/wizard");
  };

  const handleFunctionsClose = () => {
    setFunctionsAnchorEl(null);
  };

  const handleImportProducts = () => {
    navigate("/stock-management/import-products");
    handleFunctionsClose();
  };

  const handleMergeProducts = () => {
    navigate("/stock-management/product-merge");
    handleFunctionsClose();
  };

  // Pagination handlers
  const handlePageChange = (event, value) => {
    setCurrentPage(value);
  };

  const handleViewProduct = (productId) => {
    navigate(`/products/${productId}/view`);
  };

  const handleEditProduct = (productId) => {
    navigate(`/products/${productId}/edit`);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await productService.deleteProduct(deleteTarget.id);
      const deletedName = deleteTarget.name;
      setDeleteTarget(null);
      // Drop the row immediately — the full-catalog refetch below is silent and took
      // seconds, so the Results counter made a successful delete look like a no-op.
      mutateProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setSnackbar({ open: true, message: `"${deletedName}" moved to Trashed Items`, severity: "success" });
      // Reload products after deletion
      loadProducts();
    } catch (error) {
      console.error("Error deleting product:", error);
      setError("Failed to delete product");
    } finally {
      setDeleting(false);
    }
  };

  // Sparkline now rendered via PerformanceSparkline component per product

  const getStatusIcon = () => {
    return <DirectionsRunIcon sx={{ fontSize: 18, color: "#313439" }} />;
  };

  // Option lists for the Shopfront-style filter comboboxes (client-side presentation only).
  // The reference Brand list contains brands only, so drop blanks, duplicates and tag names
  // that leaked into the local brand data.
  const tagNameSet = new Set(tags.map((tag) => (tag.name || "").toLowerCase()));
  const seenBrandNames = new Set();
  const brandOptions = [];
  brands.forEach((brand) => {
    const name = brand.name || "";
    const key = name.toLowerCase();
    if (!name || seenBrandNames.has(key) || tagNameSet.has(key)) return;
    seenBrandNames.add(key);
    brandOptions.push({ id: String(brand.id), name });
  });
  const categoryOptions = categories.map((c) => ({ id: String(c.id), name: c.name || "" }));
  const familyOptions = families.map((f) => ({ id: String(f.id), name: f.name || "" }));
  const tagOptions = tags.map((t) => ({ id: String(t.id), name: t.name || "" }));
  const supplierOptions = suppliers.map((s) => ({ id: String(s.id), name: s.name || "" }));
  const statusOptions = ["Active", "Inactive", "Not Selling", "Not Purchasing"].map(
    (status) => ({ id: status, name: status })
  );
  // Type options are the distinct types actually stored on the cached catalog. A
  // hardcoded reference-label list ("Normal", "Basket", ...) can never match a
  // stored "Normal Product"/"Composite Product", which left the filter dead.
  const typeOptions = useMemo(() => {
    const seen = new Set();
    allProducts.forEach((p) => {
      if (p.type) seen.add(p.type);
    });
    return [...seen].sort().map((type) => ({ id: type, name: type }));
  }, [allProducts]);
  const retailTaxRateOptions = [
    { id: "No Tax", name: "No Tax" },
    ...taxRates.map((tax) => ({ id: tax.name, name: `${tax.name} (${tax.amount}%)` })),
  ];
  const purchaseTaxRateOptions = [
    { id: "Inherit", name: "Inherit from Retail Tax Rate" },
    ...taxRates.map((tax) => ({ id: tax.name, name: `${tax.name} (${tax.amount}%)` })),
  ];
  const sellOnShopOptions = [
    { id: "Ignore", name: "Ignore" },
    { id: "enabled", name: "Enabled" },
    { id: "disabled", name: "Disabled" },
  ];

  return (
    <Box sx={{ p: 3 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Header Section */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          mb: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <Typography variant="h4" sx={{ fontWeight: 700, fontSize: 30, color: "#000", mr: 1 }}>
            Products
          </Typography>
          {/* Each button's permission mirrors the guard on its destination route in App.jsx,
              so the page never advertises an action the router will bounce with Access Denied. */}
          <PermissionGate permission="products.add">
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddProduct}
              sx={{ bgcolor: "#5ebbeb", "&:hover": { bgcolor: "#4aa9dd", boxShadow: "none" }, borderRadius: "12px", textTransform: "none", boxShadow: "none", fontWeight: 700, fontSize: 16, px: 4, height: 42, transition: "none" }}
            >
              Add Product
            </Button>
          </PermissionGate>
          <PermissionGate permission="products.add">
            <Button
              variant="outlined"
              startIcon={<UploadFileIcon />}
              onClick={handleImportProducts}
              sx={{ bgcolor: "transparent", color: "#707072", borderColor: "#8e8e8e", "&:hover": { bgcolor: "rgba(0,0,0,0.05)", borderColor: "#8e8e8e", boxShadow: "none" }, borderRadius: "12px", textTransform: "none", boxShadow: "none", fontWeight: 700, fontSize: 16, px: 4, height: 42, transition: "none" }}
            >
              Import Products
            </Button>
          </PermissionGate>
          <PermissionGate permission="products.edit">
            <Button
              variant="outlined"
              startIcon={<MergeIcon />}
              onClick={handleMergeProducts}
              sx={{ bgcolor: "transparent", color: "#707072", borderColor: "#8e8e8e", "&:hover": { bgcolor: "rgba(0,0,0,0.05)", borderColor: "#8e8e8e", boxShadow: "none" }, borderRadius: "12px", textTransform: "none", boxShadow: "none", fontWeight: 700, fontSize: 16, px: 4, height: 42, transition: "none" }}
            >
              Merge Products
            </Button>
          </PermissionGate>
        </Box>

        <Box sx={{ textAlign: "right" }}>
          <Typography variant="h4" fontWeight="bold" lineHeight={1}>
            {totalProducts}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Results
          </Typography>
        </Box>
      </Box>
      <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 400, fontSize: 16, color: "#000" }}>
        Search
      </Typography>
      <TextField
        fullWidth
        placeholder="Search Products..."
        sx={{
          mb: 2,
          "& .MuiOutlinedInput-root": {
            backgroundColor: "#fff",
            borderRadius: "8px",
            fontSize: 16,
            "& .MuiOutlinedInput-notchedOutline": { borderColor: "#404040", borderWidth: "1px" },
            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#404040", borderWidth: "1px" },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#000000", borderWidth: "2px" },
          },
          "& .MuiOutlinedInput-input": { padding: "8px 16px" },
          "& .MuiOutlinedInput-input::placeholder": { color: "#808080", opacity: 1 },
        }}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      {/* Filter Section - sits directly on the page background (no card), main row holds
          exactly Brand/Category/Family/Tag/Supplier (reference layout) */}
      <Box sx={{ mb: 3 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            gap: 2,
          }}
        >
          <ShopfrontComboFilter
            label="Brand"
            options={brandOptions}
            value={brandFilter}
            onChange={setBrandFilter}
          />
          <ShopfrontComboFilter
            label="Category"
            options={categoryOptions}
            value={categoryFilter}
            onChange={setCategoryFilter}
          />
          <ShopfrontComboFilter
            label="Family"
            options={familyOptions}
            value={familyFilter}
            onChange={setFamilyFilter}
          />
          <ShopfrontComboFilter
            label="Tag"
            options={tagOptions}
            value={tagFilter}
            onChange={setTagFilter}
          />
          <ShopfrontComboFilter
            label="Supplier"
            options={supplierOptions}
            value={supplierFilter}
            onChange={setSupplierFilter}
          />
        </Box>

        {/* More Filters second row - Status/Type/Retail Tax Rate/Purchase Tax Rate/Sell on Shop MyLocal */}
        <Collapse in={showFilters}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gap: 2,
              mt: 2,
              pt: 2,
              borderTop: "1px solid #e0e0e0",
            }}
          >
            <ShopfrontComboFilter
              label="Status"
              options={statusOptions}
              value={statusFilter}
              onChange={setStatusFilter}
              pinSelected={false}
            />
            <ShopfrontComboFilter
              label="Type"
              options={typeOptions}
              value={typeFilter}
              onChange={setTypeFilter}
            />
            <ShopfrontComboFilter
              label="Retail Tax Rate"
              options={retailTaxRateOptions}
              value={retailTaxRateFilter}
              onChange={setRetailTaxRateFilter}
            />
            <ShopfrontComboFilter
              label="Purchase Tax Rate"
              options={purchaseTaxRateOptions}
              value={purchaseTaxRateFilter}
              onChange={setPurchaseTaxRateFilter}
            />
            <ShopfrontComboFilter
              label="Sell on Shop MyLocal"
              options={sellOnShopOptions}
              value={sellOnShopFilter}
              onChange={setSellOnShopFilter}
              pinSelected={false}
              single
            />
          </Box>
        </Collapse>

        {/* Show / Hide Filters bar - below all filters */}
        <Button
          variant="contained"
          startIcon={showFilters ? <RemoveIcon /> : <AddIcon />}
          onClick={() => setShowFilters(!showFilters)}
          sx={{ mt: 2, width: 256, bgcolor: "#5ebbeb", "&:hover": { bgcolor: "#4aa9dd", boxShadow: "none" }, borderRadius: "12px", textTransform: "none", boxShadow: "none", fontWeight: 700, fontSize: 16, height: 42, transition: "none" }}
        >
          {showFilters ? "Less Filters" : "More Filters"}
        </Button>
      </Box>

      {/* Products Table */}
      <Box>
        <TableContainer sx={{ mt: 1 }}>
          <Table sx={{ borderCollapse: "separate", borderSpacing: 0 }}>
            <TableHead>
              <TableRow
                sx={{
                  "& th": { bgcolor: "#5ebbeb", color: "white", fontWeight: 700, fontSize: 16, border: 0, height: 51, py: 0 },
                  "& th:first-of-type": { borderTopLeftRadius: "12px", borderBottomLeftRadius: "12px" },
                  "& th:last-of-type": { borderTopRightRadius: "12px", borderBottomRightRadius: "12px" },
                }}
              >
                <TableCell>Status</TableCell>
                <TableCell>Product</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Cost</TableCell>
                <TableCell>Inventory</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Performance</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody
              sx={{
                "& tr:nth-of-type(odd)": { bgcolor: "#ffffff" },
                "& tr:nth-of-type(even)": { bgcolor: "#f5f5f5" },
                "& td": { border: 0, fontSize: 16, color: "#000", py: 1.5 },
              }}
            >
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Box sx={{ py: 3 }}>
                      <CircularProgress size={24} />
                    </Box>
                  </TableCell>
                </TableRow>
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" sx={{ py: 2 }}>
                      No results found. Try changing the search filters
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {getStatusIcon()}
                        <Typography variant="body2" sx={{ fontSize: 16 }}>{product.status}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Link
                        component={RouterLink}
                        to={`/products/${product.id}/view`}
                        underline="hover"
                        sx={{
                          fontWeight: 500,
                          fontSize: 16,
                          color: "#000",
                          textAlign: "left",
                          cursor: "pointer",
                          font: "inherit",
                        }}
                      >
                        {product.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: 16 }}>{product.category}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ color: product.cost === 0 ? "#999" : "inherit", fontSize: 16 }}
                      >
                        ${product.cost.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {/* Negative stock is a real state (sales decrement with no floor) and
                          is exactly what a manager needs to see, so print it verbatim —
                          only a true 0/0 collapses to the single "0 Items" line. */}
                      <Box>
                        {product.inventory.cases !== 0 && (
                          <Typography variant="body2" sx={{ fontSize: 16 }}>
                            {product.inventory.cases} Case
                            {product.inventory.cases !== 1 ? "s" : ""}
                          </Typography>
                        )}
                        {product.inventory.items !== 0 && (
                          <Typography variant="body2" sx={{ fontSize: 16 }}>
                            {product.inventory.items} Item
                            {product.inventory.items !== 1 ? "s" : ""}
                          </Typography>
                        )}
                        {product.inventory.cases === 0 &&
                          product.inventory.items === 0 && (
                            <Typography variant="body2" sx={{ color: "#999", fontSize: 16 }}>
                              0 Items
                            </Typography>
                          )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500, fontSize: 16 }}>
                        ${product.price.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <PerformanceSparkline productId={product.id} width={120} height={30} />
                    </TableCell>
                    <TableCell>
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 2,
                        }}
                      >
                        <Button
                          onClick={() => handleViewProduct(product.id)}
                          startIcon={<VisibilityOutlinedIcon />}
                          sx={{ color: "#0284c7", textTransform: "none", fontWeight: 700, fontSize: 16, minWidth: 0, p: 0, height: 42, transition: "none", "&:hover": { bgcolor: "transparent" } }}
                        >
                          View
                        </Button>
                        <Button
                          onClick={() => handleEditProduct(product.id)}
                          startIcon={<EditOutlinedIcon />}
                          sx={{ color: "#16a34a", textTransform: "none", fontWeight: 700, fontSize: 16, minWidth: 0, p: 0, height: 42, transition: "none", "&:hover": { bgcolor: "transparent" } }}
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => setDeleteTarget(product)}
                          startIcon={<DeleteOutlineIcon />}
                          sx={{ color: "#dc2626", textTransform: "none", fontWeight: 700, fontSize: 16, minWidth: 0, p: 0, height: 42, transition: "none", "&:hover": { bgcolor: "transparent" } }}
                        >
                          Delete
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 3, mb: 2 }}>
            <Stack spacing={2}>
              <Pagination
                count={totalPages}
                page={currentPage}
                onChange={handlePageChange}
                color="primary"
                size="large"
                showFirstButton
                showLastButton
              />
            </Stack>
          </Box>
        )}
      </Box>

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        title="Delete Product"
        message={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? It will be moved to Trashed Items and can be recovered.`
            : ""
        }
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Products;
