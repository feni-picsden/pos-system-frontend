import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Divider,
  Grid,
  Chip,
  Checkbox,
  FormControlLabel,
  Autocomplete,
  InputAdornment,
  Switch
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Check as CheckIcon,
  Clear as ClearIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import productService from '../../services/productService';
import { stripHtml } from '../../services/posLocalDb';
import { useAuth } from '../../contexts/AuthContext';

const ProductMerge = () => {
  const navigate = useNavigate();
  const { user, getOutletName } = useAuth();
  
  // State for selected products to merge
  const [productsToMerge, setProductsToMerge] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // State for merged product definition
  const [mergedProduct, setMergedProduct] = useState({
    name: '',
    type: 'Normal Product',
    status: 'Active',
    description: '',
    caseQuantity: 1,
    category: '',
    categoryId: null,
    brand: '',
    brandId: null,
    family: '',
    familyId: null,
    retailTaxRate: 'GST',
    purchaseTaxRate: 'Inherit',
    itemCost: 0,
    caseCost: 0,
    costPercentage: false,
    preventManualDiscounts: false,
    requestPrice: false,
    requestQuantity: false,
    trackInventory: true,
    currentStockCases: 0,
    currentStockItems: 0,
    reorderLevelCases: 0,
    reorderLevelItems: 0,
    reorderAmountCases: 0,
    reorderAmountItems: 0,
    reorderLimitCases: 0,
    reorderLimitItems: 0,
    maxOnHandCases: 0,
    maxOnHandItems: 0,
    reorderRounding: 'No Rounding',
    orderNotes: '',
    invoiceNotes: '',
    sellOnShopMyLocal: false,
    prices: []
  });

  const [fieldSelections, setFieldSelections] = useState({});
  
  // State for dialogs
  const [productSelectDialogOpen, setProductSelectDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeResults, setMergeResults] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Helpers
  const formatPrices = (prices) => {
    if (!prices || prices.length === 0) return 'No Value';
    try {
      return prices
        .map((p) => `${p.quantity || 1} x $${Number(p.price || 0).toFixed(2)}`)
        .join('  |  ');
    } catch {
      return 'No Value';
    }
  };

  // Price handlers
  const addPriceRow = () => {
    setMergedProduct((prev) => ({
      ...prev,
      prices: [...(prev.prices || []), { quantity: 1, price: 0 }]
    }));
  };

  const removePriceRow = (index) => {
    setMergedProduct((prev) => ({
      ...prev,
      prices: (prev.prices || []).filter((_, i) => i !== index)
    }));
  };

  const handlePriceChange = (index, field, value) => {
    setMergedProduct((prev) => {
      const next = [...(prev.prices || [])];
      const numeric = field === 'quantity' ? Math.max(1, parseInt(value || 0, 10)) : parseFloat(value || 0);
      next[index] = { ...next[index], [field]: isNaN(numeric) ? 0 : numeric };
      return { ...prev, prices: next };
    });
  };

  // Classification options
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [families, setFamilies] = useState([]);

  // Load available products and classification options
  useEffect(() => {
    loadProducts();
    loadClassificationOptions();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await productService.getProducts({ limit: 10000 });
      setAvailableProducts(response.products || []);
    } catch (err) {
      setError('Failed to load products');
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadClassificationOptions = async () => {
    try {
      const [categoriesResponse, brandsResponse, familiesResponse] = await Promise.all([
        productService.getCategories(),
        productService.getBrands(),
        productService.getFamilies(),
      ]);
      
      setCategories(Array.isArray(categoriesResponse) ? categoriesResponse : []);
      setBrands(Array.isArray(brandsResponse) ? brandsResponse : []);
      setFamilies(Array.isArray(familiesResponse) ? familiesResponse : []);
    } catch (error) {
      console.error('Error loading classification options:', error);
    }
  };

  const handleAddProduct = () => {
    setProductSelectDialogOpen(true);
  };

  const handleProductSelect = (product) => {
    if (!productsToMerge.find(p => p.id === product.id)) {
      const newProduct = {
        ...product,
        // Ensure we have the name fields for display
        category: product.category?.name || product.category || '',
        brand: product.brand?.name || product.brand || '',
        family: product.family?.name || product.family || '',
      };
      
      setProductsToMerge([...productsToMerge, newProduct]);
      setProductSelectDialogOpen(false);
      setSearchTerm('');
      
      // Auto-select fields from the first product
      if (productsToMerge.length === 0) {
        autoSelectFields(newProduct);
      }
    }
  };

  const autoSelectFields = (firstProduct) => {
    const newSelections = {};
    const productIndex = 0; // First product index
    
    // Auto-select basic fields from first product
    const basicFields = ['name', 'type', 'status', 'description', 'caseQuantity', 'category', 'brand', 'family'];
    basicFields.forEach(field => {
      if (firstProduct[field] !== undefined && firstProduct[field] !== null && firstProduct[field] !== '') {
        newSelections[field] = productIndex;
      }
    });
    
    setFieldSelections(newSelections);
    
    // Update merged product with selected values
    updateMergedProduct(newSelections);
  };

  const handleRemoveProduct = (productId) => {
    const productIndex = productsToMerge.findIndex(p => p.id === productId);
    setProductsToMerge(productsToMerge.filter(p => p.id !== productId));
    
    // Update field selections to remove references to deleted product
    const newSelections = {};
    Object.keys(fieldSelections).forEach(field => {
      const selectedIndex = fieldSelections[field];
      if (selectedIndex < productIndex) {
        newSelections[field] = selectedIndex;
      } else if (selectedIndex > productIndex) {
        newSelections[field] = selectedIndex - 1;
      }
      // Skip if selectedIndex === productIndex (deleted product)
    });
    
    setFieldSelections(newSelections);
    updateMergedProduct(newSelections);
  };

  const handleFieldSelection = (field, productIndex) => {
    const newSelections = {
      ...fieldSelections,
      [field]: productIndex
    };
    
    setFieldSelections(newSelections);
    updateMergedProduct(newSelections);
  };

  const handleSectionSelection = (section, productIndex) => {
    const selectedProduct = productsToMerge[productIndex];
    const newSelections = { ...fieldSelections };
    
    // Define which fields belong to each section
    const sectionFields = {
      general: ['name', 'type', 'status', 'description', 'caseQuantity'],
      classifications: ['category', 'brand', 'family'],
      sellCost: ['retailTaxRate', 'purchaseTaxRate', 'costPercentage', 'itemCost', 'caseCost', 'requestPrice', 'requestQuantity', 'prices'],
      inventory: ['trackInventory', 'currentStockCases', 'currentStockItems', 'reorderLevelCases', 'reorderLevelItems', 'reorderAmountCases', 'reorderAmountItems', 'reorderLimitCases', 'reorderLimitItems', 'maxOnHandCases', 'maxOnHandItems', 'reorderRounding'],
      suppliers: ['orderNotes', 'invoiceNotes', 'suppliers'],
      barcodes: ['barcodes'],
      images: ['mainImage', 'images'],
      loyalty: ['loyaltyRows', 'sellOnShopMyLocal']
    };
    
    // Select all fields in the section from the chosen product
    if (sectionFields[section]) {
      sectionFields[section].forEach(field => {
        newSelections[field] = productIndex;
      });
    }
    
    setFieldSelections(newSelections);
    updateMergedProduct(newSelections);
  };

  const updateMergedProduct = (selections) => {
    const updated = { ...mergedProduct };
    
    Object.keys(selections).forEach(field => {
      const productIndex = selections[field];
      if (productIndex >= 0 && productIndex < productsToMerge.length) {
        const selectedProduct = productsToMerge[productIndex];
        updated[field] = selectedProduct[field];
        
        // Handle classification IDs
        if (field === 'category' && selectedProduct.categoryId) {
          updated.categoryId = selectedProduct.categoryId;
        }
        if (field === 'brand' && selectedProduct.brandId) {
          updated.brandId = selectedProduct.brandId;
        }
        if (field === 'family' && selectedProduct.familyId) {
          updated.familyId = selectedProduct.familyId;
        }
        // Deep copy prices to avoid mutating source array
        if (field === 'prices' && Array.isArray(selectedProduct.prices)) {
          updated.prices = selectedProduct.prices.map((p) => ({
            quantity: p.quantity || 1,
            price: p.price || 0,
          }));
        }

        // Inventory fields
        if (field === 'currentStockCases' && selectedProduct.currentStockCases !== undefined) {
          updated.currentStockCases = selectedProduct.currentStockCases;
        }
        if (field === 'currentStockItems' && selectedProduct.currentStockItems !== undefined) {
          updated.currentStockItems = selectedProduct.currentStockItems;
        }
        if (field === 'reorderLevelCases' && selectedProduct.reorderLevelCases !== undefined) {
          updated.reorderLevelCases = selectedProduct.reorderLevelCases;
        }
        if (field === 'reorderLevelItems' && selectedProduct.reorderLevelItems !== undefined) {
          updated.reorderLevelItems = selectedProduct.reorderLevelItems;
        }
        if (field === 'reorderAmountCases' && selectedProduct.reorderAmountCases !== undefined) {
          updated.reorderAmountCases = selectedProduct.reorderAmountCases;
        }
        if (field === 'reorderAmountItems' && selectedProduct.reorderAmountItems !== undefined) {
          updated.reorderAmountItems = selectedProduct.reorderAmountItems;
        }
        if (field === 'reorderLimitCases' && selectedProduct.reorderLimitCases !== undefined) {
          updated.reorderLimitCases = selectedProduct.reorderLimitCases;
        }
        if (field === 'reorderLimitItems' && selectedProduct.reorderLimitItems !== undefined) {
          updated.reorderLimitItems = selectedProduct.reorderLimitItems;
        }
        if (field === 'maxOnHandCases' && selectedProduct.maxOnHandCases !== undefined) {
          updated.maxOnHandCases = selectedProduct.maxOnHandCases;
        }
        if (field === 'maxOnHandItems' && selectedProduct.maxOnHandItems !== undefined) {
          updated.maxOnHandItems = selectedProduct.maxOnHandItems;
        }
      }
    });
    
    setMergedProduct(updated);
  };

  const handleInputChange = (field, value) => {
    setMergedProduct(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleMerge = async () => {
    if (productsToMerge.length < 2) {
      setError('Please select at least 2 products to merge');
      return;
    }

    if (!mergedProduct.name.trim()) {
      setError('Please enter a name for the merged product');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const mergeData = {
        productsToMerge: productsToMerge.map(p => p.id),
        mergedProduct: mergedProduct
      };
      
      const result = await productService.mergeProducts(mergeData);
      setMergeResults(result);
      setMergeDialogOpen(true);
      
      // Clear the form
      setProductsToMerge([]);
      setFieldSelections({});
      setMergedProduct({
        name: '',
        type: 'Normal Product',
        status: 'Active',
        description: '',
        caseQuantity: 1,
        category: '',
        categoryId: null,
        brand: '',
        brandId: null,
        family: '',
        familyId: null,
        retailTaxRate: 'GST',
        purchaseTaxRate: 'Inherit',
        itemCost: 0,
        caseCost: 0,
        costPercentage: false,
        preventManualDiscounts: false,
        requestPrice: false,
        requestQuantity: false,
        trackInventory: true,
        currentStockCases: 0,
        currentStockItems: 0,
        reorderLevelCases: 0,
        reorderLevelItems: 0,
        reorderAmountCases: 0,
        reorderAmountItems: 0,
        reorderRounding: 'No Rounding',
        orderNotes: '',
        invoiceNotes: '',
        sellOnShopMyLocal: false
      });
      
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to merge products');
      console.error('Error merging products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseMergeDialog = () => {
    setMergeDialogOpen(false);
    setMergeResults(null);
  };

  const handleGoBack = () => {
    navigate('/products');
  };

  const renderProductColumn = (product, index) => (
    <Card 
      key={product.id} 
      sx={{ 
        minHeight: 600,
        backgroundColor: 'oklch(87% 0 0);',
        border: '1px solid #e0e0e0'
      }}
    >
      <CardContent sx={{ p: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {product.name}
          </Typography>
          <IconButton
            onClick={() => handleRemoveProduct(product.id)}
            color="error"
            size="small"
          >
            <DeleteIcon />
          </IconButton>
        </Box>

        {/* General Section */}
        <Box sx={{ 
          mb: 3, 
          p: 2, 
          borderRadius: 1,
          backgroundColor: fieldSelections.name === index || fieldSelections.type === index || fieldSelections.status === index || fieldSelections.description === index || fieldSelections.caseQuantity === index ? '#e3f2fd' : '#fff',
          border: fieldSelections.name === index || fieldSelections.type === index || fieldSelections.status === index || fieldSelections.description === index || fieldSelections.caseQuantity === index ? '2px solid #1976d2' : '1px solid transparent'
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              General
            </Typography>
            <Button 
              size="small" 
              variant="outlined"
              onClick={() => handleSectionSelection('general', index)}
              sx={{ 
                backgroundColor: fieldSelections.name === index || fieldSelections.type === index || fieldSelections.status === index || fieldSelections.description === index || fieldSelections.caseQuantity === index ? '#e3f2fd' : 'white'
              }}
            >
              Select Section
            </Button>
          </Box>
          
          <Grid container spacing={1}>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" sx={{ flexGrow: 1 ,fontWeight: 400 }}>
                  Name
                </Typography>
                {fieldSelections.name === index && <CheckIcon color="primary" sx={{ ml: 1 }} />}
              </Box>
              <Typography variant="body2" sx={{ 
                p: 1, 
                backgroundColor: fieldSelections.name === index ? '#e3f2fd' : '#f5f5f5', 
                borderRadius: 1,
                border: fieldSelections.name === index ? '2px solid #1976d2' : '1px solid #e0e0e0'
              }}>
                {product.name}
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" sx={{ flexGrow: 1 ,fontWeight: 400 }}>
                  Type
                </Typography>
                {fieldSelections.type === index && <CheckIcon color="primary" sx={{ ml: 1 }} />}
              </Box>
              <Typography variant="body2" sx={{ 
                p: 1, 
                backgroundColor: fieldSelections.type === index ? '#e3f2fd' : '#f5f5f5', 
                borderRadius: 1,
                border: fieldSelections.type === index ? '2px solid #1976d2' : '1px solid #e0e0e0'
              }}>
                {product.type || 'Normal Product'}
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" sx={{ flexGrow: 1 ,fontWeight: 400 }}>
                  Status
                </Typography>
                {fieldSelections.status === index && <CheckIcon color="primary" sx={{ ml: 1 }} />}
              </Box>
              <Typography variant="body2" sx={{ 
                p: 1, 
                backgroundColor: fieldSelections.status === index ? '#e3f2fd' : '#f5f5f5', 
                borderRadius: 1,
                border: fieldSelections.status === index ? '2px solid #1976d2' : '1px solid #e0e0e0'
              }}>
                {product.status || 'Active'}
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  Description
                </Typography>
                {fieldSelections.description === index && <CheckIcon color="primary" sx={{ ml: 1 }} />}
              </Box>
              <Typography variant="body2" sx={{ 
                p: 1, 
                backgroundColor: fieldSelections.description === index ? '#e3f2fd' : '#f5f5f5', 
                borderRadius: 1,
                border: fieldSelections.description === index ? '2px solid #1976d2' : '1px solid #e0e0e0',
                minHeight: 40
              }}>
                {stripHtml(product.description)}
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  Case Quantity
                </Typography>
                {fieldSelections.caseQuantity === index && <CheckIcon color="primary" sx={{ ml: 1 }} />}
              </Box>
              <Typography variant="body2" sx={{ 
                p: 1, 
                backgroundColor: fieldSelections.caseQuantity === index ? '#e3f2fd' : '#f5f5f5', 
                borderRadius: 1,
                border: fieldSelections.caseQuantity === index ? '2px solid #1976d2' : '1px solid #e0e0e0'
              }}>
                {product.caseQuantity || 1}
              </Typography>
            </Grid>
          </Grid>
        </Box>

        {/* Classifications Section */}
        <Box sx={{ 
          mb: 3, 
          p: 2, 
          borderRadius: 1,
          backgroundColor: fieldSelections.category === index || fieldSelections.brand === index || fieldSelections.family === index ? '#e3f2fd' : '#fff',
          border: fieldSelections.category === index || fieldSelections.brand === index || fieldSelections.family === index ? '2px solid #1976d2' : '1px solid transparent'
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Classifications
            </Typography>
            <Button 
              size="small" 
              variant="outlined"
              onClick={() => handleSectionSelection('classifications', index)}
              sx={{ 
                backgroundColor: fieldSelections.category === index || fieldSelections.brand === index || fieldSelections.family === index ? '#e3f2fd' : 'white'
              }}
            >
              Select Section
            </Button>
          </Box>
          
          <Grid container spacing={1}>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  Category
                </Typography>
                {fieldSelections.category === index && <CheckIcon color="primary" sx={{ ml: 1 }} />}
              </Box>
              <Typography variant="body2" sx={{ 
                p: 1, 
                backgroundColor: fieldSelections.category === index ? '#e3f2fd' : '#f5f5f5', 
                borderRadius: 1,
                border: fieldSelections.category === index ? '2px solid #1976d2' : '1px solid #e0e0e0'
              }}>
                {product.category || 'No Value'}
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  Brand
                </Typography>
                {fieldSelections.brand === index && <CheckIcon color="primary" sx={{ ml: 1 }} />}
              </Box>
              <Typography variant="body2" sx={{ 
                p: 1, 
                backgroundColor: fieldSelections.brand === index ? '#e3f2fd' : '#f5f5f5', 
                borderRadius: 1,
                border: fieldSelections.brand === index ? '2px solid #1976d2' : '1px solid #e0e0e0'
              }}>
                {product.brand || 'No Value'}
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  Family
                </Typography>
                {fieldSelections.family === index && <CheckIcon color="primary" sx={{ ml: 1 }} />}
              </Box>
              <Typography variant="body2" sx={{ 
                p: 1, 
                backgroundColor: fieldSelections.family === index ? '#e3f2fd' : '#f5f5f5', 
                borderRadius: 1,
                border: fieldSelections.family === index ? '2px solid #1976d2' : '1px solid #e0e0e0'
              }}>
                {product.family || 'No Value'}
              </Typography>
            </Grid>
          </Grid>
        </Box>

        {/* Sell & Cost Prices Section */}
        <Box sx={{ 
          mb: 3, 
          p: 2, 
          borderRadius: 1,
          backgroundColor: fieldSelections.retailTaxRate === index || fieldSelections.purchaseTaxRate === index || fieldSelections.costPercentage === index || fieldSelections.itemCost === index || fieldSelections.caseCost === index || fieldSelections.requestPrice === index || fieldSelections.requestQuantity === index ? '#e3f2fd' : '#fff',
          border: fieldSelections.retailTaxRate === index || fieldSelections.purchaseTaxRate === index || fieldSelections.costPercentage === index || fieldSelections.itemCost === index || fieldSelections.caseCost === index || fieldSelections.requestPrice === index || fieldSelections.requestQuantity === index ? '2px solid #1976d2' : '1px solid transparent'
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Sell & Cost Prices
            </Typography>
            <Button 
              size="small" 
              variant="outlined"
              onClick={() => handleSectionSelection('sellCost', index)}
              sx={{ 
                backgroundColor: fieldSelections.retailTaxRate === index || fieldSelections.purchaseTaxRate === index || fieldSelections.costPercentage === index || fieldSelections.itemCost === index || fieldSelections.caseCost === index || fieldSelections.requestPrice === index || fieldSelections.requestQuantity === index ? '#e3f2fd' : 'white'
              }}
            >
              Select Section
            </Button>
          </Box>
          
          <Grid container spacing={1}>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  Tax Rate
                </Typography>
                {fieldSelections.retailTaxRate === index && <CheckIcon color="primary" sx={{ ml: 1 }} />}
              </Box>
              <Typography variant="body2" sx={{ 
                p: 1, 
                backgroundColor: fieldSelections.retailTaxRate === index ? '#e3f2fd' : '#f5f5f5', 
                borderRadius: 1,
                border: fieldSelections.retailTaxRate === index ? '2px solid #1976d2' : '1px solid #e0e0e0'
              }}>
                {product.retailTaxRate || 'GST'}
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  Global Average Cost
                </Typography>
                {fieldSelections.itemCost === index && <CheckIcon color="primary" sx={{ ml: 1 }} />}
              </Box>
              <Typography variant="body2" sx={{ 
                p: 1, 
                backgroundColor: fieldSelections.itemCost === index ? '#e3f2fd' : '#f5f5f5', 
                borderRadius: 1,
                border: fieldSelections.itemCost === index ? '2px solid #1976d2' : '1px solid #e0e0e0'
              }}>
                ${Number(product.itemCost || 0).toFixed(2)}
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  Global Last Cost
                </Typography>
                {fieldSelections.caseCost === index && <CheckIcon color="primary" sx={{ ml: 1 }} />}
              </Box>
              <Typography variant="body2" sx={{ 
                p: 1, 
                backgroundColor: fieldSelections.caseCost === index ? '#e3f2fd' : '#f5f5f5', 
                borderRadius: 1,
                border: fieldSelections.caseCost === index ? '2px solid #1976d2' : '1px solid #e0e0e0'
              }}>
                ${Number(product.caseCost || 0).toFixed(2)}
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  Prices
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ p: 1, backgroundColor: '#f5f5f5', borderRadius: 1, border: '1px solid #e0e0e0' }}>
                {formatPrices(product.prices)}
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  Request Price
                </Typography>
                {fieldSelections.requestPrice === index && <CheckIcon color="primary" sx={{ ml: 1 }} />}
              </Box>
              <Typography variant="body2" sx={{ 
                p: 1, 
                backgroundColor: fieldSelections.requestPrice === index ? '#e3f2fd' : '#f5f5f5', 
                borderRadius: 1,
                border: fieldSelections.requestPrice === index ? '2px solid #1976d2' : '1px solid #e0e0e0'
              }}>
                {product.requestPrice ? '✓ On' : '× Off'}
              </Typography>
            </Grid>
          </Grid>
        </Box>

        {/* Inventory Section */}
        <Box sx={{ 
          mb: 3, 
          p: 2, 
          borderRadius: 1,
          backgroundColor: fieldSelections.trackInventory === index || fieldSelections.currentStockCases === index || fieldSelections.currentStockItems === index || fieldSelections.reorderLevelCases === index || fieldSelections.reorderLevelItems === index || fieldSelections.reorderAmountCases === index || fieldSelections.reorderAmountItems === index || fieldSelections.reorderRounding === index ? '#e3f2fd' : '#fff',
          border: fieldSelections.trackInventory === index || fieldSelections.currentStockCases === index || fieldSelections.currentStockItems === index || fieldSelections.reorderLevelCases === index || fieldSelections.reorderLevelItems === index || fieldSelections.reorderAmountCases === index || fieldSelections.reorderAmountItems === index || fieldSelections.reorderRounding === index ? '2px solid #1976d2' : '1px solid transparent'
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Inventory
            </Typography>
            <Button 
              size="small" 
              variant="outlined"
              onClick={() => handleSectionSelection('inventory', index)}
              sx={{ 
                backgroundColor: fieldSelections.trackInventory === index || fieldSelections.currentStockCases === index || fieldSelections.currentStockItems === index || fieldSelections.reorderLevelCases === index || fieldSelections.reorderLevelItems === index || fieldSelections.reorderAmountCases === index || fieldSelections.reorderAmountItems === index || fieldSelections.reorderRounding === index ? '#e3f2fd' : 'white'
              }}
            >
              Select Section
            </Button>
          </Box>
          
          <Grid container spacing={1}>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  Track Inventory
                </Typography>
                {fieldSelections.trackInventory === index && <CheckIcon color="primary" sx={{ ml: 1 }} />}
              </Box>
              <Typography variant="body2" sx={{ 
                p: 1, 
                backgroundColor: fieldSelections.trackInventory === index ? '#e3f2fd' : '#f5f5f5', 
                borderRadius: 1,
                border: fieldSelections.trackInventory === index ? '2px solid #1976d2' : '1px solid #e0e0e0'
              }}>
                {product.trackInventory ? '✓ On' : '× Off'}
              </Typography>
            </Grid>

            {/* Inventory Table (read-only) */}
            <Grid item xs={12}>
              <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, overflow: 'hidden' }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                  <Box sx={{ p: 1, borderRight: '1px solid #e0e0e0', backgroundColor: '#f7f7f7', fontWeight: 600 }}> </Box>
                  <Box sx={{ p: 1, borderRight: '1px solid #e0e0e0', backgroundColor: '#f7f7f7', fontWeight: 600, textAlign: 'center' }}>Case</Box>
                  <Box sx={{ p: 1, backgroundColor: '#f7f7f7', fontWeight: 600, textAlign: 'center' }}>Item</Box>
                </Box>

                {/* Current Stock */}
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid #e0e0e0' }}>
                  <Box sx={{ p: 1, borderRight: '1px solid #e0e0e0' }}>Current Stock</Box>
                  <Box sx={{ p: 1, borderRight: '1px solid #e0e0e0', textAlign: 'center' }}>{product.currentStockCases ?? 0}</Box>
                  <Box sx={{ p: 1, textAlign: 'center' }}>{product.currentStockItems ?? 0}</Box>
                </Box>

                {/* Reorder Level */}
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid #e0e0e0' }}>
                  <Box sx={{ p: 1, borderRight: '1px solid #e0e0e0' }}>Reorder Level</Box>
                  <Box sx={{ p: 1, borderRight: '1px solid #e0e0e0', textAlign: 'center' }}>{product.reorderLevelCases ?? 0}</Box>
                  <Box sx={{ p: 1, textAlign: 'center' }}>{product.reorderLevelItems ?? 0}</Box>
                </Box>

                {/* Reorder Amount */}
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid #e0e0e0' }}>
                  <Box sx={{ p: 1, borderRight: '1px solid #e0e0e0' }}>Reorder Amount</Box>
                  <Box sx={{ p: 1, borderRight: '1px solid #e0e0e0', textAlign: 'center' }}>{product.reorderAmountCases ?? 0}</Box>
                  <Box sx={{ p: 1, textAlign: 'center' }}>{product.reorderAmountItems ?? 0}</Box>
                </Box>

                {/* Reorder Limit */}
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid #e0e0e0' }}>
                  <Box sx={{ p: 1, borderRight: '1px solid #e0e0e0' }}>Reorder Limit</Box>
                  <Box sx={{ p: 1, borderRight: '1px solid #e0e0e0', textAlign: 'center' }}>{product.reorderLimitCases ?? 'No Value'}</Box>
                  <Box sx={{ p: 1, textAlign: 'center' }}>{product.reorderLimitItems ?? 'No Value'}</Box>
                </Box>

                {/* Max On Hand */}
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid #e0e0e0' }}>
                  <Box sx={{ p: 1, borderRight: '1px solid #e0e0e0' }}>Max On Hand</Box>
                  <Box sx={{ p: 1, borderRight: '1px solid #e0e0e0', textAlign: 'center' }}>{product.maxOnHandCases ?? 'No Value'}</Box>
                  <Box sx={{ p: 1, textAlign: 'center' }}>{product.maxOnHandItems ?? 'No Value'}</Box>
                </Box>

                {/* Reorder Rounding */}
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid #e0e0e0' }}>
                  <Box sx={{ p: 1, borderRight: '1px solid #e0e0e0' }}>Reorder Rounding</Box>
                  <Box sx={{ p: 1, gridColumn: 'span 2' }}>{product.reorderRounding || 'No Rounding'}</Box>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Box>

        <Box sx={{ 
          mb: 3, 
          p: 2, 
          borderRadius: 1,
          backgroundColor: fieldSelections.barcodes === index ? '#e3f2fd' : '#fff',
          border: fieldSelections.barcodes === index ? '2px solid #1976d2' : '1px solid transparent'
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Barcodes
            </Typography>
            <Button 
              size="small" 
              variant="outlined"
              onClick={() => handleSectionSelection('barcodes', index)}
              sx={{ 
                backgroundColor: fieldSelections.barcodes === index ? '#e3f2fd' : 'white'
              }}
            >
              Select Section
            </Button>
          </Box>
          
          <Typography variant="body2" sx={{ 
            p: 1, 
            backgroundColor: fieldSelections.barcodes === index ? '#e3f2fd' : '#f5f5f5', 
            borderRadius: 1,
            border: fieldSelections.barcodes === index ? '2px solid #1976d2' : '1px solid #e0e0e0',
            minHeight: 40
          }}>
            {product.barcodes && product.barcodes.length > 0 
              ? product.barcodes.map(barcode => `${barcode.quantity} x ${barcode.code}`).join(', ')
              : 'No Value'
            }
          </Typography>
        </Box>

        <Box sx={{ 
          mb: 3, 
          p: 2, 
          borderRadius: 1,
          backgroundColor: fieldSelections.orderNotes === index || fieldSelections.invoiceNotes === index || fieldSelections.suppliers === index ? '#e3f2fd' : '#fff',
          border: fieldSelections.orderNotes === index || fieldSelections.invoiceNotes === index || fieldSelections.suppliers === index ? '2px solid #1976d2' : '1px solid transparent'
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Suppliers
            </Typography>
            <Button 
              size="small" 
              variant="outlined"
              onClick={() => handleSectionSelection('suppliers', index)}
              sx={{ 
                backgroundColor: fieldSelections.orderNotes === index || fieldSelections.invoiceNotes === index || fieldSelections.suppliers === index ? '#e3f2fd' : 'white'
              }}
            >
              Select Section
            </Button>
          </Box>
          
          <Grid container spacing={1}>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  Order Notes
                </Typography>
                {fieldSelections.orderNotes === index && <CheckIcon color="primary" sx={{ ml: 1 }} />}
              </Box>
              <Typography variant="body2" sx={{ 
                p: 1, 
                backgroundColor: fieldSelections.orderNotes === index ? '#e3f2fd' : '#f5f5f5', 
                borderRadius: 1,
                border: fieldSelections.orderNotes === index ? '2px solid #1976d2' : '1px solid #e0e0e0',
                minHeight: 40
              }}>
                {product.orderNotes || 'No Value'}
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  Invoice Notes
                </Typography>
                {fieldSelections.invoiceNotes === index && <CheckIcon color="primary" sx={{ ml: 1 }} />}
              </Box>
              <Typography variant="body2" sx={{ 
                p: 1, 
                backgroundColor: fieldSelections.invoiceNotes === index ? '#e3f2fd' : '#f5f5f5', 
                borderRadius: 1,
                border: fieldSelections.invoiceNotes === index ? '2px solid #1976d2' : '1px solid #e0e0e0',
                minHeight: 40
              }}>
                {product.invoiceNotes || 'No Value'}
              </Typography>
            </Grid>
          </Grid>
        </Box>
      </CardContent>
    </Card>
  );

  const renderAddProductColumn = () => (
    <Card sx={{ 
      minHeight: 600,
      border: '2px dashed #ccc',
      backgroundColor: '#fafafa',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'all 0.2s ease-in-out',
      '&:hover': {
        borderColor: '#1976d2',
        backgroundColor: '#e3f2fd'
      }
    }}
    onClick={handleAddProduct}
    >
      <CardContent sx={{ textAlign: 'center', p: 4 }}>
        <Typography variant="h6" sx={{ mb: 2, color: '#1976d2' }}>
          + Click to add a new product to merge
        </Typography>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={handleGoBack} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            Product Merge
          </Typography>
        </Box>

        {/* Description */}
        <Alert severity="info" sx={{ mb: 3 }}>
          This is a handy function if duplicate products exist. This function will merge all of the sales history and purchase history from the merged products into a new product.
        </Alert>

        {/* Error/Success Messages */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {/* Main Content - Columns */}
        <Grid container spacing={3}>
          {/* Results Column */}
          <Grid item xs={12} md={3}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Results
            </Typography>
            
            <Card sx={{ backgroundColor: '#f0f8ff' }}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    General
                  </Typography>
                  
                  <Grid container spacing={1}>
                    <Grid item xs={12}>
                       <Typography variant="subtitle2" sx={{ fontWeight: 400, mb: 1 }}>
                        Name *
                      </Typography>
                      <TextField
                        fullWidth
                        size="small"
                        value={mergedProduct.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        required
                      />
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 400, mb: 1 }}>
                        Type *
                      </Typography>
                      <TextField
                        fullWidth
                        size="small"
                        value={mergedProduct.type}
                        InputProps={{ readOnly: true }}
                      />
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 400, mb: 1 }}>
                        Status
                      </Typography>
                      <FormControl fullWidth size="small">
                        <Select
                          value={mergedProduct.status}
                          onChange={(e) => handleInputChange('status', e.target.value)}
                        >
                          <MenuItem value="Active">Active</MenuItem>
                          <MenuItem value="Not Selling">Not Selling</MenuItem>
                          <MenuItem value="Not Purchasing">Not Purchasing</MenuItem>
                          <MenuItem value="Inactive">Inactive</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    
                    <Grid item xs={12}> 
                        <Typography variant="subtitle2" sx={{ fontWeight: 400, mb: 1 }}>
                        Description
                      </Typography>
                      <TextField
                        fullWidth
                        size="small"
                        multiline
                        rows={2}
                        value={mergedProduct.description} 
                        onChange={(e) => handleInputChange('description', e.target.value)}
                      />
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 400, mb: 1 }}>
                        Case Quantity
                      </Typography>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        value={mergedProduct.caseQuantity}
                        onChange={(e) => handleInputChange('caseQuantity', parseInt(e.target.value) || 1)}
                        required
                      />
                    </Grid>
                  </Grid>
                </Box>

                {/* Classifications Section */}
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Classifications
                    </Typography>
                    <Button size="small" variant="outlined">
                      Select Section
                    </Button>
                  </Box>
                  
                  <Grid container spacing={1}>
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 400, mb: 1 }}>
                        Category
                      </Typography>
                      <FormControl fullWidth size="small">
                        <Select
                          value={mergedProduct.categoryId || ''}
                          onChange={(e) => {
                            const selectedCategory = categories.find(c => c.id === e.target.value);
                            handleInputChange('category', selectedCategory?.name || '');
                            handleInputChange('categoryId', e.target.value);
                          }}
                        >
                          <MenuItem value="">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                              <span>No Value</span>
                              <ClearIcon fontSize="small" />
                            </Box>
                          </MenuItem>
                          {categories.map((category) => (
                            <MenuItem key={category.id} value={category.id}>
                              {category.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 400, mb: 1 }}>
                        Brand
                      </Typography>
                      <FormControl fullWidth size="small">
                        <Select
                          value={mergedProduct.brandId || ''}
                          onChange={(e) => {
                            const selectedBrand = brands.find(b => b.id === e.target.value);
                            handleInputChange('brand', selectedBrand?.name || '');
                            handleInputChange('brandId', e.target.value);
                          }}
                        >
                          <MenuItem value="">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                              <span>No Value</span>
                              <ClearIcon fontSize="small" />
                            </Box>
                          </MenuItem>
                          {brands.map((brand) => (
                            <MenuItem key={brand.id} value={brand.id}>
                              {brand.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 400, mb: 1 }}>
                        Family
                      </Typography>
                      <FormControl fullWidth size="small">
                        <Select
                          value={mergedProduct.familyId || ''}
                          onChange={(e) => {
                            const selectedFamily = families.find(f => f.id === e.target.value);
                            handleInputChange('family', selectedFamily?.name || '');
                            handleInputChange('familyId', e.target.value);
                          }}
                        >
                          <MenuItem value="">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                              <span>No Value</span>
                              <ClearIcon fontSize="small" />
                            </Box>
                          </MenuItem>
                          {families.map((family) => (
                            <MenuItem key={family.id} value={family.id}>
                              {family.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </Box>

                {/* Sell & Cost Prices Section */}
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Sell & Cost Prices
                    </Typography>
                    <Button size="small" variant="outlined">
                      Select Section
                    </Button>
                  </Box>
                  
                  <Grid container spacing={1}>
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 400, mb: 1 }}>
                        Tax Rate
                      </Typography>
                      <FormControl fullWidth size="small">
                        <Select
                          value={mergedProduct.retailTaxRate}
                          onChange={(e) => handleInputChange('retailTaxRate', e.target.value)}
                        >
                          <MenuItem value="GST">GST</MenuItem>
                          <MenuItem value="No Tax">No Tax</MenuItem>
                          <MenuItem value="Inherit">Inherit</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={mergedProduct.costPercentage}
                            onChange={(e) => handleInputChange('costPercentage', e.target.checked)}
                          />
                        }
                        label="Cost is a percentage of sell price"
                      />
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 400, mb: 1 }}>
                        Global Average Cost
                      </Typography>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        value={mergedProduct.itemCost}
                        onChange={(e) => handleInputChange('itemCost', parseFloat(e.target.value) || 0)}
                        InputProps={{
                          startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>
                        }}
                      />
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 400, mb: 1 }}>
                        Global Last Cost
                      </Typography>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        value={mergedProduct.caseCost}
                        onChange={(e) => handleInputChange('caseCost', parseFloat(e.target.value) || 0)}
                        InputProps={{
                          startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>
                        }}
                      />
                    </Grid>
                    
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={mergedProduct.requestPrice}
                            onChange={(e) => handleInputChange('requestPrice', e.target.checked)}
                          />
                        }
                        label="Request Price"
                      />
                    </Grid>
                    
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={mergedProduct.requestQuantity}
                            onChange={(e) => handleInputChange('requestQuantity', e.target.checked)}
                          />
                        }
                        label="Request Quantity"
                      />
                    </Grid>

                    {/* Prices box */}
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 400, mb: 1 }}>
                        Prices
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {(mergedProduct.prices || []).map((row, idx) => (
                          <Box key={idx} sx={{ display: 'flex', gap: 1 }}>
                            <TextField
                              size="small"
                              type="number"
                              value={row.quantity}
                              onChange={(e) => handlePriceChange(idx, 'quantity', e.target.value)}
                              sx={{ width: 100 }}
                              InputProps={{
                                startAdornment: <Typography sx={{ mr: 0.5 }}>Qty</Typography>
                              }}
                            />
                            <TextField
                              size="small"
                              type="number"
                              value={row.price}
                              onChange={(e) => handlePriceChange(idx, 'price', e.target.value)}
                              sx={{ maxWidth: 200 }}
                              InputProps={{
                                startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>
                              }}
                            />
                            <Button size="small" color="error" onClick={() => removePriceRow(idx)}>Remove</Button>
                          </Box>
                        ))}
                        <Box>
                          <Button size="small" variant="outlined" onClick={addPriceRow}>Add Price</Button>
                        </Box>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>

                {/* Inventory Section */}
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Inventory
                    </Typography>
                    <Button size="small" variant="outlined">
                      Select Section
                    </Button>
                  </Box>
                  
                  <Grid container spacing={1}>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={mergedProduct.trackInventory}
                            onChange={(e) => handleInputChange('trackInventory', e.target.checked)}
                          />
                        }
                        label="Track Inventory"
                      />
                    </Grid>
                    
                    {/* Outlet inventory table */}
                    <Grid item xs={12}>
                      <Typography variant="body2" sx={{ mb: 1 }}>{user?.isSuperAdmin ? 'Global' : (getOutletName() || 'N/A')}</Typography>
                      <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, overflow: 'hidden' }}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                          <Box sx={{ p: 1, borderRight: '1px solid #e0e0e0', backgroundColor: '#f7f7f7', fontWeight: 600 }}> </Box>
                          <Box sx={{ p: 1, borderRight: '1px solid #e0e0e0', backgroundColor: '#f7f7f7', fontWeight: 600, textAlign: 'center' }}>Case</Box>
                          <Box sx={{ p: 1, backgroundColor: '#f7f7f7', fontWeight: 600, textAlign: 'center' }}>Item</Box>
                        </Box>

                        {/* Current Stock */}
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid #e0e0e0' }}>
                          <Box sx={{ p: 1, borderRight: '1px solid #e0e0e0' }}>Current Stock</Box>
                          <Box sx={{ p: 0.5, borderRight: '1px solid #e0e0e0' }}>
                            <TextField size="small" type="number" fullWidth value={mergedProduct.currentStockCases}
                              onChange={(e) => handleInputChange('currentStockCases', parseInt(e.target.value) || 0)} />
                          </Box>
                          <Box sx={{ p: 0.5 }}>
                            <TextField size="small" type="number" fullWidth value={mergedProduct.currentStockItems}
                              onChange={(e) => handleInputChange('currentStockItems', parseInt(e.target.value) || 0)} />
                          </Box>
                        </Box>

                        {/* Reorder Level */}
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid #e0e0e0' }}>
                          <Box sx={{ p: 1, borderRight: '1px solid #e0e0e0' }}>Reorder Level</Box>
                          <Box sx={{ p: 0.5, borderRight: '1px solid #e0e0e0' }}>
                            <TextField size="small" type="number" fullWidth value={mergedProduct.reorderLevelCases || 0}
                              onChange={(e) => handleInputChange('reorderLevelCases', parseInt(e.target.value) || 0)} />
                          </Box>
                          <Box sx={{ p: 0.5 }}>
                            <TextField size="small" type="number" fullWidth value={mergedProduct.reorderLevelItems || 0}
                              onChange={(e) => handleInputChange('reorderLevelItems', parseInt(e.target.value) || 0)} />
                          </Box>
                        </Box>

                        {/* Reorder Amount */}
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid #e0e0e0' }}>
                          <Box sx={{ p: 1, borderRight: '1px solid #e0e0e0' }}>Reorder Amount</Box>
                          <Box sx={{ p: 0.5, borderRight: '1px solid #e0e0e0' }}>
                            <TextField size="small" type="number" fullWidth value={mergedProduct.reorderAmountCases || 0}
                              onChange={(e) => handleInputChange('reorderAmountCases', parseInt(e.target.value) || 0)} />
                          </Box>
                          <Box sx={{ p: 0.5 }}>
                            <TextField size="small" type="number" fullWidth value={mergedProduct.reorderAmountItems || 0}
                              onChange={(e) => handleInputChange('reorderAmountItems', parseInt(e.target.value) || 0)} />
                          </Box>
                        </Box>

                        {/* Reorder Limit */}
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid #e0e0e0' }}>
                          <Box sx={{ p: 1, borderRight: '1px solid #e0e0e0' }}>Reorder Limit</Box>
                          <Box sx={{ p: 0.5, borderRight: '1px solid #e0e0e0' }}>
                            <TextField size="small" type="number" fullWidth value={mergedProduct.reorderLimitCases || ''}
                              onChange={(e) => handleInputChange('reorderLimitCases', parseInt(e.target.value) || 0)} placeholder="No Value" />
                          </Box>
                          <Box sx={{ p: 0.5 }}>
                            <TextField size="small" type="number" fullWidth value={mergedProduct.reorderLimitItems || ''}
                              onChange={(e) => handleInputChange('reorderLimitItems', parseInt(e.target.value) || 0)} placeholder="No Value" />
                          </Box>
                        </Box>

                        {/* Max On Hand */}
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid #e0e0e0' }}>
                          <Box sx={{ p: 1, borderRight: '1px solid #e0e0e0' }}>Max On Hand</Box>
                          <Box sx={{ p: 0.5, borderRight: '1px solid #e0e0e0' }}>
                            <TextField size="small" type="number" fullWidth value={mergedProduct.maxOnHandCases || ''}
                              onChange={(e) => handleInputChange('maxOnHandCases', parseInt(e.target.value) || 0)} placeholder="No Value" />
                          </Box>
                          <Box sx={{ p: 0.5 }}>
                            <TextField size="small" type="number" fullWidth value={mergedProduct.maxOnHandItems || ''}
                              onChange={(e) => handleInputChange('maxOnHandItems', parseInt(e.target.value) || 0)} placeholder="No Value" />
                          </Box>
                        </Box>

                        {/* Reorder Rounding */}
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid #e0e0e0' }}>
                          <Box sx={{ p: 1, borderRight: '1px solid #e0e0e0' }}>Reorder Rounding</Box>
                          <Box sx={{ p: 1, gridColumn: 'span 2' }}>
                            <FormControl fullWidth size="small">
                              <Select
                                value={mergedProduct.reorderRounding || 'No Rounding'}
                                onChange={(e) => handleInputChange('reorderRounding', e.target.value)}
                              >
                                <MenuItem value="No Rounding">No Rounding</MenuItem>
                                <MenuItem value="Round Up">Round Up</MenuItem>
                                <MenuItem value="Round Down">Round Down</MenuItem>
                              </Select>
                            </FormControl>
                          </Box>
                        </Box>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>

                {/* Barcodes Section */}
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Barcodes
                    </Typography>
                    <Button size="small" variant="outlined">
                      Select Section
                    </Button>
                  </Box>
                  
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    rows={3}
                    value={mergedProduct.barcodes ? mergedProduct.barcodes.map(b => `${b.quantity} x ${b.code}`).join('\n') : ''}
                    onChange={(e) => {
                      // Parse barcodes from text input
                      const lines = e.target.value.split('\n').filter(line => line.trim());
                      const barcodes = lines.map(line => {
                        const match = line.match(/(\d+)\s*x\s*(.+)/);
                        if (match) {
                          return { quantity: parseInt(match[1]), code: match[2].trim() };
                        }
                        return { quantity: 1, code: line.trim() };
                      });
                      handleInputChange('barcodes', barcodes);
                    }}
                    placeholder="Enter barcodes in format: quantity x code"
                  />
                </Box>

                {/* Suppliers Section */}
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Suppliers
                    </Typography>
                    <Button size="small" variant="outlined">
                      Select Section
                    </Button>
                  </Box>
                  
                  <Grid container spacing={1}>
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 400, mb: 1 }}> Order Notes </Typography>
                      <TextField
                        fullWidth
                        size="small"
                        multiline
                        rows={2}
                        value={mergedProduct.orderNotes}
                        onChange={(e) => handleInputChange('orderNotes', e.target.value)}
                      />
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 400, mb: 1 }}> Invoice Notes </Typography>
                      <TextField
                        fullWidth
                        size="small"
                        multiline
                        rows={2}
                        value={mergedProduct.invoiceNotes}
                        onChange={(e) => handleInputChange('invoiceNotes', e.target.value)}
                      />
                    </Grid>
                  </Grid>
                </Box>

                {/* Complete Merge Button */}
                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  onClick={handleMerge}
                  disabled={productsToMerge.length < 2 || !mergedProduct.name.trim() || loading}
                >
                  {loading ? 'Merging...' : 'Complete Merge'}
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Product Columns */}
          {productsToMerge.map((product, index) => (
            <Grid item xs={12} md={3} key={product.id}>
              {renderProductColumn(product, index)}
            </Grid>
          ))}

          {/* Add Product Column */}
          {productsToMerge.length < 4 && (
            <Grid item xs={12} md={3}>
              {renderAddProductColumn()}
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* Product Selection Dialog */}
      <Dialog open={productSelectDialogOpen} onClose={() => setProductSelectDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Select Product to Merge
          <IconButton
            onClick={() => setProductSelectDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />
          
          <List>
            {availableProducts
              .filter(product => 
                !productsToMerge.find(p => p.id === product.id) &&
                product.name.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map(product => (
                <ListItem
                  key={product.id}
                  button
                  onClick={() => handleProductSelect(product)}
                >
                  <ListItemText
                    primary={product.name}
                    secondary={`ID: ${product.id} | Status: ${product.status} | Stock: ${product.currentStockCases || 0} cases, ${product.currentStockItems || 0} items`}
                  />
                </ListItem>
              ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProductSelectDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Merge Results Dialog */}
      <Dialog open={mergeDialogOpen} onClose={handleCloseMergeDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          Merge Results
          <IconButton
            onClick={handleCloseMergeDialog}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {mergeResults && (
            <Box>
              <Typography variant="body1" gutterBottom>
                {mergeResults.message}
              </Typography>
              
              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Merged Product Details:
                </Typography>
                <Typography variant="body2">
                  <strong>Name:</strong> {mergeResults.mergedProduct?.name}<br />
                  <strong>ID:</strong> {mergeResults.mergedProduct?.id}<br />
                  <strong>Total Sales History:</strong> {mergeResults.salesHistoryCount || 0} records<br />
                  <strong>Total Purchase History:</strong> {mergeResults.purchaseHistoryCount || 0} records<br />
                  <strong>Consolidated Stock:</strong> {mergeResults.mergedProduct?.currentStockCases || 0} cases, {mergeResults.mergedProduct?.currentStockItems || 0} items
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseMergeDialog}>Close</Button>
          <Button onClick={handleGoBack} variant="contained">
            View Products
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProductMerge;