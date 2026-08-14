import React, { useState, useEffect, useMemo } from "react";
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
} from "@mui/material";
import {
  IosShareOutlined as ExportIcon,
  LocalOfferOutlined as CategoryIcon,
  ImageOutlined as ProductIcon,
  ArrowDropDown as ArrowDropDownIcon,
} from "@mui/icons-material";
import productService from "../../services/productService";
import productComboService from "../../services/productComboService";
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

const StockList = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOption, setSelectedOption] = useState(null);
  const [onlyWithStock, setOnlyWithStock] = useState(false);
  const [combos, setCombos] = useState([]);

  // Fetch products on component mount
  useEffect(() => {
    fetchProducts();
    // Product COMBOS are a local-only feature; they appear as Product search options too.
    productComboService
      .getProductCombos()
      .then((res) => setCombos(Array.isArray(res?.combos) ? res.combos : Array.isArray(res) ? res : []))
      .catch(() => setCombos([]));
  }, []);

  // Filter products when search term or stock filter changes
  useEffect(() => {
    // Ensure products is an array
    let filtered = Array.isArray(products) ? products : [];

    // A selected classification (category) filters the grid to that classification
    if (selectedOption?.type === "Categories") {
      filtered = filtered.filter(
        (product) => product.category?.name === selectedOption.label
      );
    } else if (selectedOption?.type === "Products") {
      filtered = filtered.filter((product) => product.name === selectedOption.label);
    } else if (searchTerm) {
      filtered = filtered.filter(
        (product) =>
          product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.category?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.brand?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.family?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by stock availability
    if (onlyWithStock) {
      filtered = filtered.filter((product) => 
        (product.currentStockCases || 0) > 0 || (product.currentStockItems || 0) > 0
      );
    }

    setFilteredProducts(filtered);
  }, [products, searchTerm, selectedOption, onlyWithStock]);

  // Grouped autocomplete options: Categories first, then Products
  const searchOptions = useMemo(() => {
    const list = Array.isArray(products) ? products : [];
    const categories = [...new Set(list.map((p) => p.category?.name).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ type: "Categories", label: name }));
    const productOptions = list
      .filter((p) => p.name)
      .map((p) => ({ type: "Products", label: p.name, id: p.id }));
    const comboOptions = (Array.isArray(combos) ? combos : [])
      .filter((c) => c.name)
      .map((c) => ({ type: "Products", label: c.name, id: `combo-${c.id}`, isCombo: true }));
    return [...categories, ...productOptions, ...comboOptions];
  }, [products, combos]);

  const calculateProfitPercentage = (cost, price) => {
    if (!price || price <= 0) return 0;
    return ((price - cost) / price) * 100;
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await productService.getProducts({
        status: 'Active,Inactive,Not Selling,Not Purchasing',
        includeAllStatuses: true
      });
      let productsArray = response?.products || response || [];
      
      productsArray = productsArray.map(product => ({
        ...product,
        prices: product.prices?.map(price => ({
          ...price,
          profitPercentage: calculateProfitPercentage(
            product.itemCost || 0,
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
            product.itemCost || 0,
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
  const handleCellChange = (productId, field, value, priceIndex = 0) => {
    setProducts((prev) => prev.map((p) => {
      if (p.id !== productId) return p;
      if (field === 'name') return { ...p, name: value };
      const prices = (p.prices?.length ? p.prices : [{ price: 0, quantity: 1, profitPercentage: 0 }]);
      return {
        ...p,
        prices: prices.map((pp, i) => (i === priceIndex ? { ...pp, [field]: value } : pp)),
      };
    }));
  };

  const handleCellSave = async (productId, field, newValue, priceIndex = 0) => {
    try {
      let updatedProduct = { ...products.find(p => p.id === productId) };

      if (field === 'name') {
        updatedProduct.name = newValue;
      } else if (field === 'price') {
        // When price changes, calculate profit percentage
        const cost = updatedProduct.itemCost || 0;
        const price = parseFloat(newValue);
        const profitPercentage = price > 0 ? ((price - cost) / price * 100) : 0;
        
        // Update specific price point
        updatedProduct.prices = updatedProduct.prices?.map((priceObj, index) => 
          index === priceIndex ? { ...priceObj, price: price, profitPercentage: profitPercentage } : priceObj
        ) || [{ price: price, quantity: 1, profitPercentage: profitPercentage }];
        
      } else if (field === 'profitPercentage') {
        // When profit percentage changes, calculate price
        const cost = updatedProduct.itemCost || 0;
        const profitPercentage = parseFloat(newValue);
        const price = profitPercentage !== 100 ? (cost / (1 - profitPercentage / 100)) : 0;
        
        // Update specific price point
        updatedProduct.prices = updatedProduct.prices?.map((priceObj, index) => 
          index === priceIndex ? { ...priceObj, price: price, profitPercentage: profitPercentage } : priceObj
        ) || [{ price: price, quantity: 1, profitPercentage: profitPercentage }];
        
      } else if (field === 'quantity') {
        // Update quantity for specific price point
        updatedProduct.prices = updatedProduct.prices?.map((priceObj, index) => 
          index === priceIndex ? { ...priceObj, quantity: parseInt(newValue) } : priceObj
        ) || [{ price: 0, quantity: parseInt(newValue) }];
        
      } else if (field === 'currentStockItems') {
        // Only allow editing of stock quantity
        updatedProduct[field] = parseInt(newValue);
      }

      // Update local state
      setProducts(products.map(p => p.id === productId ? updatedProduct : p));

      // Make API call to save changes (prices save automatically, no Save button)
      try {
        if (field === 'name') {
          await productService.updateProduct(productId, { name: updatedProduct.name });
        } else if (field === 'price' || field === 'profitPercentage' || field === 'quantity') {
          // Update product prices - API expects prices array with quantity, price, cost, percentage
          const pricesData = updatedProduct.prices?.map(price => ({
            quantity: price.quantity || 1,
            price: price.price || 0,
            cost: updatedProduct.itemCost || 0,
            percentage: 0 // API expects percentage field
          })) || [];
          
          await productService.updateProduct(productId, {
            prices: pricesData
          });

          // A retail price change queues the product for shelf ticket printing (same as Capped Pricing).
          if (field === 'price' || field === 'profitPercentage') {
            await shelfTicketService
              .addShelfTicket({ productId, ticketType: 'Everyday', productGrouping: null })
              .catch((err) => console.error('Error adding shelf ticket:', err));
          }
        } else if (field === 'currentStockItems') {
          // Update stock quantity
          console.log('Updating stock quantity:', { productId, currentStockItems: updatedProduct.currentStockItems });
          await productService.updateProduct(productId, {
            currentStockItems: updatedProduct.currentStockItems
          });
        }
      } catch (apiError) {
        console.error("Error updating product via API:", apiError);
        // Revert local changes if API call fails
        setProducts(products);
      }
      
    } catch (error) {
      console.error("Error updating product:", error);
    }
  };

  const exportToCSV = () => {
    const headers = [
      "Product",
      "Category", 
      "Price Set",
      "Case Quantity",
      "Cases on Hand",
      "Items on Hand",
      "Quantity",
      "Cost",
      "Price",
      "Profit %"
    ];

    const csvContent = [
      headers.join(","),
      ...(Array.isArray(filteredProducts) ? filteredProducts : []).map(product => [
        `"${product.name}"`,
        `"${product.category?.name || ''}"`,
        1,
        product.caseQuantity || 0,
        product.currentStockCases || 0,
        product.currentStockItems || 0,
        product.currentStockItems || 0,
        (product.itemCost || 0).toFixed(2),
        (product.prices?.[0]?.price || 0).toFixed(2),
        (product.profitPercentage || 0).toFixed(2)
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "stock_list.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Real inline-editable grid input; saves automatically on blur / Enter
  const renderEditableCell = (product, field, value, priceIndex = 0, opts = {}) => {
    const { width = 150, height = 42, type = "number", prefix, suffix } = opts;
    return (
      <TextField
        value={value ?? ""}
        type={type}
        onChange={(e) => handleCellChange(product.id, field, e.target.value, priceIndex)}
        onBlur={(e) => handleCellSave(product.id, field, e.target.value, priceIndex)}
        onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
        variant="outlined"
        InputProps={{
          startAdornment: prefix ? <InputAdornment position="start">{prefix}</InputAdornment> : undefined,
          endAdornment: suffix ? <InputAdornment position="end">{suffix}</InputAdornment> : undefined,
        }}
        sx={editInputSx(width, height)}
      />
    );
  };

  if (loading) {
    return <PageLoader />;
  }

  return (
    <Container maxWidth="xxl" sx={{ py: 4 }}>
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
        <Typography sx={{ fontSize: 16, color: "#525252" }}>
          {Array.isArray(filteredProducts) ? filteredProducts.length : 0} Products
        </Typography>
      </Box>

      {/* Search and Filter */}
      <Box sx={{ mb: 3 }}>
        <Autocomplete
          fullWidth
          freeSolo
          openOnFocus
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
          groupBy={(option) => option.type}
          getOptionLabel={(option) => (typeof option === "string" ? option : option.label)}
          isOptionEqualToValue={(o, v) => o.type === v.type && o.label === v.label}
          slotProps={{
            paper: {
              sx: {
                border: "1px solid #000",
                borderRadius: "8px",
                boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
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
                },
              },
            },
          }}
          renderOption={(props, option) => (
            <Box component="li" {...props} key={`${option.type}-${option.label}`}>
              {option.type === "Categories"
                ? <CategoryIcon sx={{ fontSize: 20, color: "#404040" }} />
                : <ProductIcon sx={{ fontSize: 20, color: "#404040" }} />}
              {option.label}
            </Box>
          )}
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
      <TableContainer component={Paper} sx={{ boxShadow: "none", borderRadius: "12px" }}>
        <Table>
          <TableHead>
            <TableRow
              sx={{
                backgroundColor: "#5ebbeb",
                "& th": {
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 16,
                  textTransform: "none",
                  height: 51,
                  py: 0,
                  borderBottom: "none",
                  cursor: "auto",
                },
                "& th:first-of-type": { borderTopLeftRadius: "12px" },
                "& th:last-of-type": { borderTopRightRadius: "12px" },
              }}
            >
              <TableCell>Product</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Price Set</TableCell>
              <TableCell>Case Quantity</TableCell>
              <TableCell>Cases on Hand</TableCell>
              <TableCell>Items on Hand</TableCell>
              <TableCell>Quantity</TableCell>
              <TableCell>Cost</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Profit %</TableCell>
            </TableRow>
          </TableHead>
          <TableBody
            sx={{ "& td": { fontSize: 16, color: "#000", borderBottom: "none" } }}
          >
            {(Array.isArray(filteredProducts) ? filteredProducts : []).map((product) => {
              // If product has multiple prices, create multiple rows
              const prices = product.prices || [{ price: 0, quantity: 1, profitPercentage: 0 }];

              return prices.map((pricePoint, priceIndex) => (
                <TableRow key={`${product.id}-${priceIndex}`}>
                  <TableCell>
                    {renderEditableCell(product, "name", product.name, priceIndex, { width: 480, type: "text" })}
                  </TableCell>
                  <TableCell>{product.category?.name || ""}</TableCell>
                  {/* Price sets are blank unless the price point is a named set */}
                  <TableCell>{pricePoint.priceSet?.name || pricePoint.priceSetName || ""}</TableCell>
                  <TableCell>{product.caseQuantity || 0}</TableCell>
                  <TableCell>{product.currentStockCases || 0}</TableCell>
                  <TableCell sx={{ color: (product.currentStockItems || 0) < 0 ? "red" : "inherit" }}>
                    {product.currentStockItems || 0}
                  </TableCell>
                  <TableCell>
                    {renderEditableCell(product, "quantity", pricePoint.quantity ?? 1, priceIndex, { width: 150 })}
                  </TableCell>
                  <TableCell>
                    ${((product.itemCost || 0) * (Number(pricePoint.quantity) || 1)).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {renderEditableCell(product, "price", pricePoint.price ?? 0, priceIndex, { width: 200, height: 40, prefix: "$" })}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      // Use the edited/saved profit when present, otherwise derive it from price vs cost
                      let profitPercent = pricePoint.profitPercentage;
                      if (profitPercent === undefined || profitPercent === null || profitPercent === "") {
                        const quantity = Number(pricePoint.quantity) || 1;
                        const totalCost = (product.itemCost || 0) * quantity;
                        const totalPrice = Number(pricePoint.price) || 0;
                        profitPercent = totalPrice > 0
                          ? ((totalPrice - totalCost) / totalPrice * 100).toFixed(2)
                          : "0.00";
                      } else if (typeof profitPercent === "number") {
                        profitPercent = profitPercent.toFixed(2);
                      }
                      return renderEditableCell(product, "profitPercentage", profitPercent, priceIndex, { width: 150, height: 40, suffix: "%" });
                    })()}
                  </TableCell>
                </TableRow>
              ));
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
};

export default StockList;
