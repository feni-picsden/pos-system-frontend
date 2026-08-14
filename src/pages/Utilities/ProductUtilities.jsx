import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Chip,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  VisibilityOutlined as VisibilityIcon,
  CheckBoxOutlineBlankOutlined as SquareIcon,
  CheckBoxOutlined as CheckSquareIcon,
  IndeterminateCheckBoxOutlined as IndeterminateSquareIcon,
} from '@mui/icons-material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { Link as RouterLink } from 'react-router-dom';
import productService from '../../services/productService';
import classificationService from '../../services/classificationService';
import inventoryReportService from '../../services/inventoryReportService';
import barcodeService from '../../services/barcodeService';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import DateRangePicker from '../../components/Common/DateRangePicker';

// Reference checkboxes are thin-outline square / check-square glyphs; the
// checked state stays an outline glyph (no filled blue).
// Reference select-all / row checkbox button box is 28x32 (24px glyph + 2px/4px padding).
const checkboxBoxSx = { p: '4px 2px' };

const checkboxGlyphs = {
  icon: <SquareIcon />,
  checkedIcon: <CheckSquareIcon />,
  indeterminateIcon: <IndeterminateSquareIcon />,
};

// Reference tokens: static label above every control, no floating MUI labels.
const FieldLabel = ({ children }) => (
  <Typography component="label" sx={{ display: 'block', fontSize: 16, fontWeight: 400, color: '#000', mb: 0.5 }}>
    {children}
  </Typography>
);

const fieldSx = {
  bgcolor: '#fff',
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
  },
  '& input::placeholder': { color: '#808080', opacity: 1 },
};

// A missing date must read as "unknown", never as 1970: new Date(null) is the epoch,
// which silently dropped every product out of any realistic range.
const toDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Range bounds are whole days — the popover's 'Current Day' preset sends now() for both
// ends, so an un-clamped comparison excluded everything stamped earlier the same day.
const inRange = (value, start, end) => {
  const d = toDate(value);
  if (!d) return false;
  if (start) {
    const from = new Date(start);
    from.setHours(0, 0, 0, 0);
    if (d < from) return false;
  }
  if (end) {
    const to = new Date(end);
    to.setHours(23, 59, 59, 999);
    if (d > to) return false;
  }
  return true;
};

// The product list payload carries no sold/purchased/stocktaked dates, so those filters
// could never match anything. Hydrate them from the existing report endpoints, and only
// when one of those filters is actually set.
// ponytail: last-stocktaked comes from /barcodes, so it only covers barcoded products;
// widen it when a per-product stocktake endpoint exists.
const loadActivityDates = async (needSales, needStocktake) => {
  const byId = new Map();
  const put = (id, patch) => byId.set(id, { ...byId.get(id), ...patch });
  const jobs = [];

  if (needSales) {
    jobs.push(
      inventoryReportService.getSlowMovingStock({}).then((res) => {
        (res?.data || []).forEach((row) =>
          put(row.id, { lastSold: row.lastSold, lastPurchased: row.lastReceived || row.lastOrdered })
        );
      })
    );
  }

  if (needStocktake) {
    jobs.push(
      barcodeService.getBarcodes({}).then((res) => {
        (res?.data || []).forEach((row) => {
          const prev = byId.get(row.productId)?.lastStocktaked;
          if (row.lastStocktakedAt && (!prev || new Date(row.lastStocktakedAt) > new Date(prev))) {
            put(row.productId, { lastStocktaked: row.lastStocktakedAt });
          }
        });
      })
    );
  }

  // A missing report permission must not break the page — those products just stay undated.
  await Promise.all(
    jobs.map((job) => job.catch((err) => console.error('Error loading product activity dates:', err)))
  );
  return byId;
};

const barButtonSx = (enabledBg, width) => ({
  height: 42,
  ...(width ? { width, minWidth: width } : null),
  borderRadius: '12px',
  fontWeight: 700,
  fontSize: 16,
  textTransform: 'none',
  boxShadow: 'none',
  px: 2,
  bgcolor: enabledBg,
  color: '#fff',
  border: `1px solid ${enabledBg}`,
  '&:hover': { bgcolor: enabledBg, boxShadow: 'none', filter: 'brightness(0.94)' },
  '&.Mui-disabled': {
    bgcolor: '#e5e5e5',
    color: '#737373',
    border: '1px solid #737373',
    cursor: 'not-allowed',
    pointerEvents: 'auto',
  },
});

const ProductUtilities = () => {
  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [applyCount, setApplyCount] = useState(0);
  const [changeCaseDialogOpen, setChangeCaseDialogOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState('');
  const [changeStatusDialogOpen, setChangeStatusDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('Active');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [nameFilter, setNameFilter] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedFamilies, setSelectedFamilies] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedHostDeletions, setSelectedHostDeletions] = useState('');
  const [stockLevel, setStockLevel] = useState('Any Stock Level');
  const [stockOperation, setStockOperation] = useState('Less than (<)');
  const [stockThreshold, setStockThreshold] = useState('');
  const [stockLocation, setStockLocation] = useState('Any Location');
  const [createdAtStart, setCreatedAtStart] = useState(null);
  const [createdAtEnd, setCreatedAtEnd] = useState(null);
  const [lastSoldStart, setLastSoldStart] = useState(null);
  const [lastSoldEnd, setLastSoldEnd] = useState(null);
  const [lastPurchasedStart, setLastPurchasedStart] = useState(null);
  const [lastPurchasedEnd, setLastPurchasedEnd] = useState(null);
  const [lastStocktakedStart, setLastStocktakedStart] = useState(null);
  const [lastStocktakedEnd, setLastStocktakedEnd] = useState(null);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [families, setFamilies] = useState([]);
  const [tags, setTags] = useState([]);
  const [statuses] = useState(['Active', 'Inactive', 'Not Selling', 'Not Purchasing']);
  const [hostDeletions] = useState(['Has host deletions', 'No host deletions']);
  const [stockLevels] = useState([
    'Any Stock Level',
    'Positive Stock',
    'Negative Stock',
    'Zero Stock',
    'Custom Stock Level'
  ]);

  const stockOperations = ['Less than (<)', 'More than (>)', 'Equals to (=)'];
  const stockThresholdLabels = {
    'Less than (<)': 'Stock Level Below',
    'More than (>)': 'Stock Level Above',
    'Equals to (=)': 'Stock Level Equals',
  };
  const stockLocationOptions = [
    { value: 'Any Location', desc: 'Checks if any Outlet has stock matching the Stock Level option' },
    { value: 'All Locations', desc: 'Checks if all Outlets have the stock matching the Stock Level option' },
    { value: 'Sum Locations', desc: 'Adds all stock together between all locations to check if it matches the Stock Level option' },
  ];

  // Load dropdown options
  useEffect(() => {
    const loadDropdownData = async () => {
      try {
        // Load categories
        const categoriesRes = await classificationService.getClassifications({ type: 'Category' });
        if (categoriesRes?.classifications) {
          setCategories(categoriesRes.classifications);
        }

        // Load brands
        const brandsRes = await classificationService.getClassifications({ type: 'Brand' });
        if (brandsRes?.classifications) {
          setBrands(brandsRes.classifications);
        }

        // Load families
        const familiesRes = await classificationService.getClassifications({ type: 'Family' });
        if (familiesRes?.classifications) {
          setFamilies(familiesRes.classifications);
        }

        // Load tags
        const tagsRes = await productService.getTags();
        if (Array.isArray(tagsRes)) {
          setTags(tagsRes);
        }
      } catch (err) {
        console.error('Error loading dropdown data:', err);
      }
    };

    loadDropdownData();
  }, []);

  // Categories actually attached to products are not always returned by
  // /classifications?type=Category — merge them in so every category the data
  // uses is filterable.
  const categoryOptions = useMemo(() => {
    const byId = new Map();
    categories.forEach((c) => byId.set(c.id, c));
    products.forEach((p) => {
      if (p.category?.id && !byId.has(p.category.id)) byId.set(p.category.id, p.category);
    });
    return [...byId.values()].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [categories, products]);

  // Load products
  const loadProducts = async () => {
    try {
      setLoading(true);
      setError('');

      const filters = {
        page: 1,
        limit: 1000, // Load all for utilities
      };

      if (nameFilter) filters.search = nameFilter;
      if (selectedCategories.length > 0) {
        filters.category = selectedCategories.map(c => c.id || c).join(',');
      }
      if (selectedBrands.length > 0) {
        filters.brand = selectedBrands.map(b => b.id || b).join(',');
      }
      if (selectedFamilies.length > 0) {
        filters.family = selectedFamilies.map(f => f.id || f).join(',');
      }
      if (selectedTags.length > 0) {
        filters.tags = selectedTags.map(t => t.id || t).join(',');
      }
      if (selectedStatuses.length > 0) {
        filters.status = selectedStatuses.join(',');
      } else {
        filters.status = 'Active,Inactive,Not Selling,Not Purchasing';
      }

      filters.includeAllStatuses = true;

      const response = await productService.getProducts(filters);

      let filteredProducts = response.products || [];

      // Apply additional filters.
      // Rows created before createdAt existed carry null there; the backend reports use the
      // same updatedAt fallback rather than pretending the product is from 1970.
      if (createdAtStart || createdAtEnd) {
        filteredProducts = filteredProducts.filter(p =>
          inRange(p.createdAt || p.updatedAt, createdAtStart, createdAtEnd)
        );
      }

      // Filter by stock level
      if (stockLevel !== 'Any Stock Level') {
        filteredProducts = filteredProducts.filter(p => {
          const stockItems = p.currentStockItems !== undefined ? p.currentStockItems : (p.inventory || 0);

          switch (stockLevel) {
            case 'Positive Stock':
              return stockItems > 0;
            case 'Negative Stock':
              return stockItems < 0;
            case 'Zero Stock':
              return stockItems === 0;
            case 'Custom Stock Level': {
              const threshold = stockThreshold !== '' ? parseFloat(stockThreshold) : NaN;
              if (Number.isNaN(threshold)) return true;

              const matches = (value) => {
                if (stockOperation === 'More than (>)') return value > threshold;
                if (stockOperation === 'Equals to (=)') return value === threshold;
                return value < threshold;
              };

              // Per-outlet stock only when the payload carries product_outlets;
              // the list endpoint returns the rolled-up figure, so a single-value
              // fallback makes Any/All/Sum agree — which is correct for one location.
              const perLocation = Array.isArray(p.product_outlets) && p.product_outlets.length > 0
                ? p.product_outlets.map(po => po.currentStockItems || 0)
                : [stockItems];

              if (stockLocation === 'All Locations') return perLocation.every(matches);
              if (stockLocation === 'Sum Locations') return matches(perLocation.reduce((a, b) => a + b, 0));
              return perLocation.some(matches);
            }
            default:
              return true;
          }
        });
      }

      // Filter by host deletions
      if (selectedHostDeletions) {
        filteredProducts = filteredProducts.filter(p => {
          const hasHostDeletions = p.hasHostDeletions !== undefined ? p.hasHostDeletions : false;
          if (selectedHostDeletions === 'Has host deletions') {
            return hasHostDeletions === true;
          } else if (selectedHostDeletions === 'No host deletions') {
            return hasHostDeletions === false;
          }
          return true;
        });
      }

      // Sold / purchased / stocktaked dates live in the activity logs, not on the product
      const needSales = Boolean(lastSoldStart || lastSoldEnd || lastPurchasedStart || lastPurchasedEnd);
      const needStocktake = Boolean(lastStocktakedStart || lastStocktakedEnd);
      const activityDates = needSales || needStocktake
        ? await loadActivityDates(needSales, needStocktake)
        : new Map();

      // Filter by last sold date
      if (lastSoldStart || lastSoldEnd) {
        filteredProducts = filteredProducts.filter(p =>
          inRange(activityDates.get(p.id)?.lastSold || p.lastSoldDate, lastSoldStart, lastSoldEnd)
        );
      }

      // Filter by last purchased date
      if (lastPurchasedStart || lastPurchasedEnd) {
        filteredProducts = filteredProducts.filter(p =>
          inRange(activityDates.get(p.id)?.lastPurchased || p.lastPurchasedDate, lastPurchasedStart, lastPurchasedEnd)
        );
      }

      // Filter by last stocktaked date
      if (lastStocktakedStart || lastStocktakedEnd) {
        filteredProducts = filteredProducts.filter(p =>
          inRange(activityDates.get(p.id)?.lastStocktaked || p.lastStocktakedDate, lastStocktakedStart, lastStocktakedEnd)
        );
      }

      setProducts(filteredProducts);
      setSelectedProducts([]);
    } catch (err) {
      console.error('Error loading products:', err);
      setError('Failed to load products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Reference defers filtering until Apply Filter is pressed; only applyCount
  // (bumped by Apply Filter) re-queries, plus the initial load.
  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyCount]);

  const allSelected = products.length > 0 && selectedProducts.length === products.length;

  const handleSelectAll = (event) => {
    setSelectedProducts(event.target.checked ? products.map(p => p.id) : []);
  };

  const handleSelectProduct = (productId) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleApplyFilter = () => {
    setApplyCount(c => c + 1);
  };

  const handleChangeNameCasing = () => {
    setSelectedCase('');
    setChangeCaseDialogOpen(true);
  };

  const handleCloseCaseDialog = () => {
    setChangeCaseDialogOpen(false);
    setSelectedCase('');
  };

  const handleApplyCaseChange = async () => {
    if (!selectedCase || selectedProducts.length === 0) return;

    try {
      setLoading(true);

      // Get all selected products
      const productsToUpdate = products.filter(p => selectedProducts.includes(p.id));

      // Update each product's name based on selected case
      const updatePromises = productsToUpdate.map(async (product) => {
        let newName = product.name;

        switch (selectedCase) {
          case 'lower':
            newName = product.name.toLowerCase();
            break;
          case 'upper':
            newName = product.name.toUpperCase();
            break;
          case 'title':
            newName = product.name
              .toLowerCase()
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
            break;
          default:
            return;
        }

        // Update product with new name
        await productService.updateProduct(product.id, {
          name: newName
        });
      });

      await Promise.all(updatePromises);

      handleCloseCaseDialog();
      await loadProducts();
    } catch (err) {
      console.error('Error changing product name casing:', err);
      setError('Failed to update some product names');
    } finally {
      setLoading(false);
    }
  };

  const caseOptions = [
    { value: 'lower', label: 'Lower Case', example: 'vb can 375ml' },
    { value: 'upper', label: 'Upper Case', example: 'VB CAN 375ML' },
    { value: 'title', label: 'Title Case', example: 'Vb Can 375ml' }
  ];

  const handleChangeStatuses = () => {
    setSelectedStatus('Active');
    setChangeStatusDialogOpen(true);
  };

  const handleCloseStatusDialog = () => {
    setChangeStatusDialogOpen(false);
    setSelectedStatus('Active');
  };

  const handleApplyStatusChange = async () => {
    if (!selectedStatus || selectedProducts.length === 0) return;

    try {
      setLoading(true);

      const productsToUpdate = products.filter(p => selectedProducts.includes(p.id));

      // Update each product's status
      const updatePromises = productsToUpdate.map(async (product) => {
        await productService.updateProduct(product.id, {
          status: selectedStatus
        });
      });

      await Promise.all(updatePromises);

      handleCloseStatusDialog();
      await loadProducts();
    } catch (err) {
      console.error('Error changing product status:', err);
      setError('Failed to update some product statuses');
    } finally {
      setLoading(false);
    }
  };

  const statusOptions = [
    'Active',
    'Not Selling',
    'Not Purchasing',
    'Inactive'
  ];

  const handleDeleteProducts = async () => {
    try {
      setLoading(true);
      await productService.bulkDeleteProducts(selectedProducts);
      setDeleteDialogOpen(false);
      await loadProducts();
    } catch (err) {
      console.error('Error deleting products:', err);
      setError('Failed to delete some products');
    } finally {
      setLoading(false);
    }
  };

  // Reference: ONE bordered field holding both dates; click opens the shared
  // dual-month calendar popover ('Current Day' preset + paired dd/mm/yyyy inputs).
  const dateRange = (label, start, setStart, end, setEnd) => (
    <Grid item xs={12} md={6} lg={3}>
      <FieldLabel>{label}</FieldLabel>
      <DateRangePicker
        value={{ startDate: start, endDate: end }}
        onChange={({ startDate, endDate }) => { setStart(startDate); setEnd(endDate); }}
        label=""
        allowEmpty
        splitTrigger
      />
    </Grid>
  );

  const multiSelect = (label, placeholder, options, value, onChange) => (
    <Grid item xs={12} md={6} lg={3}>
      <FieldLabel>{label}</FieldLabel>
      <Autocomplete
        multiple
        disableCloseOnSelect
        options={options}
        getOptionLabel={(option) => option.name || option}
        isOptionEqualToValue={(o, v) => (o.id ?? o) === (v.id ?? v)}
        value={value}
        onChange={(e, newValue) => onChange(newValue)}
        size="small"
        sx={fieldSx}
        slotProps={{ paper: { sx: { borderRadius: '8px' } } }}
        renderOption={(props, option, { selected }) => {
          const { key, ...optionProps } = props;
          return (
            <li key={key} {...optionProps}>
              <Checkbox
                {...checkboxGlyphs}
                checked={selected}
                sx={{ p: 0.5, mr: 1, color: '#000', '&.Mui-checked': { color: '#000' } }}
              />
              {option.name || option}
            </li>
          );
        }}
        renderInput={(params) => <TextField {...params} placeholder={placeholder} />}
        renderTags={(vals, getTagProps) =>
          vals.map((option, index) => {
            const { key, ...tagProps } = getTagProps({ index });
            return <Chip key={key} label={option.name || option} size="small" {...tagProps} />;
          })
        }
      />
    </Grid>
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ px: '8px', pt: 3, pb: '74px', bgcolor: '#ffffff', minHeight: 'calc(100vh - 50px)' }}>
        {/* Header */}
        <Typography variant="h1" sx={{ fontWeight: 700, color: '#000000', fontSize: 32, mb: 2 }}>
          Product Utilities
        </Typography>

        {/* Filters — no card, straight on the white body (reference) */}
        <Grid container spacing={2}>
          <Grid item xs={12} md={6} lg={3}>
            <FieldLabel>Name</FieldLabel>
            <TextField
              fullWidth
              placeholder="Search by Name..."
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              size="small"
              sx={fieldSx}
            />
          </Grid>

          {multiSelect('Category', 'Select Categories...', categoryOptions, selectedCategories, setSelectedCategories)}
          {multiSelect('Brands', 'Select Brands...', brands, selectedBrands, setSelectedBrands)}
          {multiSelect('Families', 'Select Families...', families, selectedFamilies, setSelectedFamilies)}
          {multiSelect('Tags', 'Select Tags...', tags, selectedTags, setSelectedTags)}

          <Grid item xs={12} md={6} lg={3}>
            <FieldLabel>Statuses</FieldLabel>
            <FormControl fullWidth size="small" sx={fieldSx}>
              <Select
                multiple
                displayEmpty
                value={selectedStatuses}
                onChange={(e) => setSelectedStatuses(e.target.value)}
                renderValue={(selected) =>
                  selected.length ? selected.join(', ') : <span style={{ color: '#808080' }}>Select Statuses...</span>
                }
              >
                {statuses.map((status) => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6} lg={3}>
            <FieldLabel>Host Deletions</FieldLabel>
            <FormControl fullWidth size="small" sx={fieldSx}>
              <Select
                displayEmpty
                value={selectedHostDeletions}
                onChange={(e) => setSelectedHostDeletions(e.target.value)}
                // Reference option rows are 49px tall (2 options -> 114px paper)
                MenuProps={{ PaperProps: { sx: { '& .MuiMenuItem-root': { minHeight: 49 } } } }}
                renderValue={(selected) =>
                  selected || <span style={{ color: '#808080' }}>Select Host Deletions...</span>
                }
              >
                {hostDeletions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6} lg={3}>
            <FieldLabel>Stock Level</FieldLabel>
            <FormControl fullWidth size="small" sx={fieldSx}>
              <Select value={stockLevel} onChange={(e) => setStockLevel(e.target.value)}>
                {stockLevels.map((level) => (
                  <MenuItem key={level} value={level}>
                    {level}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {stockLevel === 'Custom Stock Level' && (
            <>
              <Grid item xs={12} md={6} lg={3}>
                <FieldLabel>Stock Level Operation</FieldLabel>
                <FormControl fullWidth size="small" sx={fieldSx}>
                  <Select value={stockOperation} onChange={(e) => setStockOperation(e.target.value)}>
                    {stockOperations.map((op) => (
                      <MenuItem key={op} value={op}>
                        {op}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6} lg={3}>
                <FieldLabel>{stockThresholdLabels[stockOperation]}</FieldLabel>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  value={stockThreshold}
                  onChange={(e) => setStockThreshold(e.target.value)}
                  sx={fieldSx}
                />
              </Grid>
              <Grid item xs={12} md={6} lg={3}>
                <FieldLabel>Stock Location</FieldLabel>
                <FormControl fullWidth size="small" sx={fieldSx}>
                  <Select
                    value={stockLocation}
                    onChange={(e) => setStockLocation(e.target.value)}
                    renderValue={(selected) => selected}
                  >
                    {stockLocationOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        <Box>
                          <Typography sx={{ fontSize: 16, color: '#000' }}>{option.value}</Typography>
                          <Typography sx={{ fontSize: 12, color: '#676b72', whiteSpace: 'normal' }}>
                            {option.desc}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </>
          )}

          {dateRange('Created At', createdAtStart, setCreatedAtStart, createdAtEnd, setCreatedAtEnd)}
          {dateRange('Last Sold Date', lastSoldStart, setLastSoldStart, lastSoldEnd, setLastSoldEnd)}
          {dateRange('Last Purchased Date', lastPurchasedStart, setLastPurchasedStart, lastPurchasedEnd, setLastPurchasedEnd)}
          {dateRange('Last Stocktaked Date', lastStocktakedStart, setLastStocktakedStart, lastStocktakedEnd, setLastStocktakedEnd)}
        </Grid>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, mb: 2 }}>
          <Button
            variant="contained"
            onClick={handleApplyFilter}
            sx={{
              bgcolor: '#5ebbeb',
              color: '#fff',
              height: 42,
              width: 153,
              minWidth: 153,
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: 16,
              textTransform: 'none',
              boxShadow: 'none',
              border: '1px solid #5ebbeb',
              transition: 'all 0s ease',
              '&:hover': { bgcolor: '#0ea5e9', borderColor: '#5ebbeb', boxShadow: 'none' },
            }}
          >
            Apply Filter
          </Button>
        </Box>

        {/* Products Table */}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow
                sx={{
                  '& th': { bgcolor: '#5ebbeb', color: '#fff', fontWeight: 700, fontSize: 16, border: 0, height: 51, py: 0 },
                  '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
                  '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' },
                }}
              >
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Checkbox
                      {...checkboxGlyphs}
                      checked={allSelected}
                      indeterminate={selectedProducts.length > 0 && !allSelected}
                      onChange={handleSelectAll}
                      inputProps={{ 'aria-label': 'Select all products' }}
                      sx={{ ...checkboxBoxSx, color: '#fff', '&.Mui-checked': { color: '#fff' }, '&.MuiCheckbox-indeterminate': { color: '#fff' } }}
                    />
                    Name
                  </Box>
                </TableCell>
                <TableCell align="right" sx={{ width: 161 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody
              sx={{
                '& td': { borderBottom: 0 },
                '& tr:first-of-type td:first-of-type': { borderTopLeftRadius: '12px' },
                '& tr:first-of-type td:last-of-type': { borderTopRightRadius: '12px' },
              }}
            >
              {loading ? (
                <TableRow>
                  <TableCell colSpan={2} align="center" sx={{ py: 4, color: '#676b72' }}>
                    Loading products...
                  </TableCell>
                </TableRow>
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} align="center" sx={{ py: 4, color: '#676b72' }}>
                    No products found
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
                  <TableRow key={product.id} sx={{ bgcolor: '#ffffff', height: 74, '& td': { height: 74, py: 0 } }}>
                    <TableCell sx={{ fontSize: 16, color: '#000' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Checkbox
                          {...checkboxGlyphs}
                          checked={selectedProducts.includes(product.id)}
                          onChange={() => handleSelectProduct(product.id)}
                          inputProps={{ 'aria-label': `Select ${product.name}` }}
                          sx={{ ...checkboxBoxSx, color: '#000', '&.Mui-checked': { color: '#000' } }}
                        />
                        {product.name}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        component={RouterLink}
                        to={`/products/${product.id}/view`}
                        startIcon={<VisibilityIcon />}
                        sx={{
                          color: '#0284c7',
                          fontWeight: 700,
                          fontSize: 16,
                          textTransform: 'none',
                          borderRadius: '12px',
                          px: 4,
                          py: 1,
                          textDecoration: 'none',
                          // Reference View link has NO hover change
                          '&:hover': { bgcolor: 'transparent', textDecoration: 'none' },
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {error && (
          <Typography sx={{ color: '#dc2626', mt: 2 }}>{error}</Typography>
        )}

        {/* Footer Action Bar — pinned to the viewport bottom, full bleed */}
        <Box
          sx={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: (theme) => theme.zIndex.appBar,
            bgcolor: '#404040',
            color: '#fff',
            height: 58,
            px: 2,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography sx={{ fontSize: 16 }}>{selectedProducts.length} selected</Typography>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              onClick={handleChangeNameCasing}
              disabled={selectedProducts.length === 0}
              sx={barButtonSx('#00c950', 228)}
            >
              Change Name Casing
            </Button>
            <Button
              onClick={handleChangeStatuses}
              disabled={selectedProducts.length === 0}
              sx={barButtonSx('#00c950', 194)}
            >
              Change Statuses
            </Button>
            <Button
              onClick={() => setDeleteDialogOpen(true)}
              disabled={selectedProducts.length === 0}
              sx={barButtonSx('#fb2c36', 187)}
            >
              Delete Products
            </Button>
          </Box>
        </Box>

        <ConfirmDeleteDialog
          open={deleteDialogOpen}
          title="Delete Products"
          message={`Are you sure you want to delete ${selectedProducts.length} product${selectedProducts.length === 1 ? '' : 's'}? This cannot be undone.`}
          loading={loading}
          onCancel={() => setDeleteDialogOpen(false)}
          onConfirm={handleDeleteProducts}
        />

        {/* Bulk Change Case Dialog */}
        <Dialog
          open={changeCaseDialogOpen}
          onClose={handleCloseCaseDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ bgcolor: '#5ebbeb', color: '#f8f8f8', py: 1.5, fontWeight: 700 }}>
            Bulk Change Case
          </DialogTitle>
          <DialogContent sx={{ pt: 3 }}>
            <Typography sx={{ mb: 3, mt: 1 }}>
              Which case would you like the product names to be?
            </Typography>
            <FormControl fullWidth>
              <InputLabel>Casing</InputLabel>
              <Select
                value={selectedCase}
                onChange={(e) => setSelectedCase(e.target.value)}
                label="Casing"
              >
                {caseOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Box>
                      <Typography variant="body1">{option.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Example: {option.example}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions sx={{ p: 2, gap: 1 }}>
            <Button onClick={handleCloseCaseDialog} sx={{ textTransform: 'none', color: '#676b72', fontWeight: 700 }}>
              Cancel
            </Button>
            <Button
              onClick={handleApplyCaseChange}
              variant="contained"
              disabled={!selectedCase}
              sx={barButtonSx('#5ebbeb')}
            >
              Apply
            </Button>
          </DialogActions>
        </Dialog>

        {/* Bulk Change Status Dialog */}
        <Dialog
          open={changeStatusDialogOpen}
          onClose={handleCloseStatusDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ bgcolor: '#5ebbeb', color: '#f8f8f8', py: 1.5, fontWeight: 700 }}>
            Bulk Change Status
          </DialogTitle>
          <DialogContent sx={{ pt: 3 }}>
            <Typography sx={{ mb: 3, mt: 1 }}>
              Select the status to apply to all the selected products.
            </Typography>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                label="Status"
              >
                {statusOptions.map((status) => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions sx={{ p: 2, gap: 1 }}>
            <Button onClick={handleCloseStatusDialog} sx={{ textTransform: 'none', color: '#676b72', fontWeight: 700 }}>
              Cancel
            </Button>
            <Button
              onClick={handleApplyStatusChange}
              variant="contained"
              disabled={!selectedStatus}
              sx={barButtonSx('#5ebbeb')}
            >
              Apply
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default ProductUtilities;
