import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  InputAdornment,
  MenuItem,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Description as DescriptionIcon,
  Block as BlockIcon,
  FileUploadOutlined as FileUploadOutlinedIcon,
} from '@mui/icons-material';
import productService from '../../services/productService';
import shelfTicketService from '../../services/shelfTicketService';

const HELP_URL = 'https://support.onshopfront.com/hc/en-us/articles/360029656231';

// ponytail: no banner-group endpoint exists, so the capped pricing loaded via CSV IS the
// provided program (per the help docs: "stores may already have it loaded, otherwise you
// load it yourself"). Persisted locally so it survives reloads. Swap for the API when one lands.
const STORE_KEY = 'cappedPricing.provided';

const readStored = () => {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || [];
  } catch {
    return [];
  }
};

const CappedPricing = () => {
  const [activeTab, setActiveTab] = useState('provided');
  const [loading, setLoading] = useState(false);
  const [searchTerm] = useState('');
  const [priceSetFilter, setPriceSetFilter] = useState('all');
  const [cappedProducts, setCappedProducts] = useState([]);
  const [importedPricing, setImportedPricing] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);

  useEffect(() => {
    loadCappedPricing();
  }, []);

  const loadCappedPricing = async () => {
    const stored = readStored();
    if (stored.length === 0) {
      setCappedProducts([]);
      return;
    }

    setLoading(true);
    try {
      // Refresh current prices from the products API so the % column is live.
      const matchResult = await productService.matchCappedPricing(
        stored.map(({ name, supplierCode }) => ({ name, supplierCode }))
      );
      setCappedProducts(
        stored.map((item, index) => {
          const matched = matchResult.matchedProducts?.[index];
          return {
            ...item,
            productId: matched?.productId ?? item.productId ?? null,
            productName: matched?.productName || item.productName || item.name,
            priceSet: matched?.priceSet || item.priceSet || 'Default Price Set',
            currentPrice: matched?.currentPrice ?? item.currentPrice ?? 0,
          };
        })
      );
    } catch (err) {
      console.error('Error loading capped pricing:', err);
      setCappedProducts(stored);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  };

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    let startIndex = 0;
    const firstLine = lines[0].toLowerCase();

    if (firstLine.includes('name') || firstLine.includes('supplier') || firstLine.includes('price')) {
      startIndex = 1;
    }

    const results = [];
    for (let i = startIndex; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));

      if (values.length >= 6) {
        results.push({
          id: `import-${Date.now()}-${i}`,
          name: values[0],
          supplierCode: values[1],
          quantity: parseFloat(values[2]) || 1,
          cappedPrice: parseFloat(values[3]) || 0,
          startDate: parseDate(values[4]),
          endDate: parseDate(values[5]),
          currentPrice: 0,
        });
      }
    }

    return results;
  };

  const processFile = async (file) => {
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const text = await file.text();
      const parsed = parseCSV(text);

      if (parsed.length === 0) {
        throw new Error('No valid data found in CSV file');
      }

      const itemsToMatch = parsed.map(item => ({
        name: item.name,
        supplierCode: item.supplierCode
      }));

      const matchResult = await productService.matchCappedPricing(itemsToMatch);

      const mergedData = parsed.map((item, index) => {
        const matched = matchResult.matchedProducts[index];
        return {
          ...item,
          productId: matched?.productId || null,
          productName: matched?.productName || item.name,
          priceSet: matched?.priceSet || 'Default Price Set',
          currentPrice: matched?.currentPrice || 0,
          itemCost: matched?.itemCost || 0,
          matched: !!matched?.productId
        };
      });

      setImportedPricing(mergedData);
      // The imported program becomes the store's capped pricing (Provided tab).
      localStorage.setItem(STORE_KEY, JSON.stringify(mergedData));
      setCappedProducts(mergedData);

      const matchedCount = mergedData.filter(item => item.matched).length;
      setSuccess(
        `Successfully imported ${parsed.length} items. ${matchedCount} products matched with database.`
      );

      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Error parsing CSV:', err);
      setError(err.message || 'Failed to parse CSV file. Please check the format.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportCSV = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        processFile(file);
      }
    };
    input.click();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    processFile(e.dataTransfer.files[0]);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  // Live edit: keep the typed string so the % column recalculates on every keystroke.
  const handlePriceChange = (itemId, value) => {
    const update = (list) =>
      list.map(item => (item.id === itemId ? { ...item, currentPrice: value } : item));

    if (activeTab === 'imported') {
      setImportedPricing(update);
    } else {
      setCappedProducts(update);
    }
  };

  // Auto-save on blur (no Save button on the reference). Prices above the cap are still saved.
  const handlePriceBlur = async (item) => {
    const price = parseFloat(item.currentPrice) || 0;

    handlePriceChange(item.id, price);

    if (!item.productId) return;

    try {
      await productService.bulkUpdatePrices([{ productId: item.productId, price }]);
      // Help docs: applying the price change also queues the product for shelf ticket printing.
      await shelfTicketService
        .addShelfTicket({ productId: item.productId, ticketType: 'Everyday', productGrouping: null })
        .catch((err) => console.error('Error adding shelf ticket:', err));

      const persisted = readStored().map((p) =>
        p.id === item.id ? { ...p, currentPrice: price } : p
      );
      localStorage.setItem(STORE_KEY, JSON.stringify(persisted));
      setLastSaved(new Date());
    } catch (err) {
      console.error('Error saving price:', err);
      setError('Failed to save price change');
    }
  };

  const source = activeTab === 'provided' ? cappedProducts : importedPricing;
  const priceSets = [...new Set(source.map(p => p.priceSet || 'Default Price Set'))];
  const filteredProducts = source.filter(p => {
    const ps = p.priceSet || 'Default Price Set';
    return (priceSetFilter === 'all' || ps === priceSetFilter)
      && (p.productName || p.name || '').toLowerCase().includes(searchTerm.toLowerCase());
  });

  const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '-');

  const statusLabel = lastSaved
    ? `Last saved: ${lastSaved.toLocaleDateString('en-GB')} ${lastSaved.toLocaleTimeString('en-GB')}`
    : 'No changes made';

  const tabSx = {
    minHeight: 56,
    height: 56,
    textTransform: 'none',
    fontSize: 14,
    fontWeight: 400,
    color: '#000000',
    borderRadius: '8px 8px 0px 0px',
    transition: 'color 150ms cubic-bezier(0.4, 0, 0.2, 1), background-color 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1)',
    '&.Mui-selected': {
      color: '#000000',
      bgcolor: '#ffffff',
      boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.12), 0px 1px 2px rgba(0, 0, 0, 0.08)',
    },
  };

  const headCellSx = {
    color: '#ffffff',
    fontWeight: 700,
    fontSize: 16,
    bgcolor: '#5ebbeb',
    border: 'none',
    py: 0,
    height: 51,
  };

  const bodyCellSx = {
    fontSize: 16,
    color: '#000000',
    border: 'none',
    height: 85,
  };

  const EmptyState = ({ icon: Icon, title, description }) => (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        textAlign: 'center',
      }}
    >
      <Icon sx={{ fontSize: 80, color: '#000', mb: 2 }} />
      <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
    </Box>
  );

  const FileUploadZone = () => (
    <Box>
      <Typography variant="h6" fontWeight={600} sx={{ mb: 3 }}>
        Imported
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Looking for the file format?{' '}
        <a href={HELP_URL} target="_blank" rel="noreferrer">
          Click here
        </a>
        .
      </Typography>

      <Box
        component="button"
        type="button"
        onDrop={handleDrop}
        onDragOver={handleDrag}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onClick={handleImportCSV}
        sx={{
          width: '100%',
          height: 150,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          px: 3,
          py: 4,
          border: '1px dashed rgba(17, 24, 39, 0.25)',
          borderRadius: '8px',
          bgcolor: dragActive ? 'rgba(64, 64, 64, 0.05)' : 'transparent',
          boxShadow: 'inset 0px 2px 4px rgba(0, 0, 0, 0.05)',
          cursor: 'pointer',
          textAlign: 'center',
          '&:hover': {
            bgcolor: 'rgba(64, 64, 64, 0.05)',
          },
        }}
      >
        <FileUploadOutlinedIcon sx={{ fontSize: 48, color: '#a3a3a3' }} />
        {dragActive ? (
          <Typography sx={{ fontSize: 14, color: '#525252' }}>Drop file to upload</Typography>
        ) : (
          <Typography sx={{ fontSize: 14, color: '#525252' }}>
            <Box component="span" sx={{ color: '#5ebbeb' }}>Upload a file</Box>
            {' or drag and drop'}
          </Typography>
        )}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ p: 3, bgcolor: '#e2e8f0', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Capped Pricing
        </Typography>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            bgcolor: '#dcfce7',
            color: '#15803d',
            fontSize: 12,
            fontWeight: 500,
            borderRadius: '9999px',
            padding: '4px 8px',
          }}
        >
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#22c55e' }} />
          {statusLabel}
        </Box>
      </Box>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        TabIndicatorProps={{ sx: { display: 'none' } }}
        sx={{ minHeight: 56, mb: 0, '& .MuiTab-root': tabSx }}
      >
        <Tab
          icon={<CloudUploadIcon />}
          iconPosition="start"
          label="Provided"
          value="provided"
        />
        <Tab
          icon={<DescriptionIcon />}
          iconPosition="start"
          label="Imported"
          value="imported"
        />
      </Tabs>

      {/* Error and Success Messages */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Content */}
      <Box sx={{ bgcolor: '#ffffff', p: 3 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : activeTab === 'imported' && importedPricing.length === 0 ? (
          <FileUploadZone />
        ) : source.length === 0 ? (
          <EmptyState
            icon={BlockIcon}
            title="No Capped Pricing"
            description={
              activeTab === 'provided'
                ? 'No product with capped pricing found'
                : 'No imported capped pricing found'
            }
          />
        ) : (
          <>
            {priceSets.length > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <TextField
                  select
                  size="small"
                  label="Filter by Price Set"
                  value={priceSetFilter}
                  onChange={(e) => setPriceSetFilter(e.target.value)}
                  sx={{
                    minWidth: 240,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '8px',
                      bgcolor: '#fff',
                      fontSize: 16,
                      '& fieldset': { borderColor: '#404040', borderWidth: '1px' },
                      '&:hover fieldset': { borderColor: '#404040' },
                      '&.Mui-focused fieldset': { borderColor: '#000000', borderWidth: '2px' },
                    },
                  }}
                >
                  <MenuItem value="all">All Price Sets</MenuItem>
                  {priceSets.map((ps) => (
                    <MenuItem key={ps} value={ps}>{ps}</MenuItem>
                  ))}
                </TextField>
              </Box>
            )}
            {filteredProducts.length === 0 ? (
              <EmptyState
                icon={BlockIcon}
                title="No Capped Pricing"
                description="No products match the selected price set"
              />
            ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={headCellSx}>Product</TableCell>
                  <TableCell sx={headCellSx}>Capped Pricing</TableCell>
                  <TableCell sx={headCellSx}>Start Date</TableCell>
                  <TableCell sx={headCellSx}>End Date</TableCell>
                  <TableCell sx={headCellSx}>Quantity</TableCell>
                  <TableCell sx={headCellSx}>Capped Price</TableCell>
                  <TableCell sx={headCellSx}>Current Price</TableCell>
                  <TableCell sx={headCellSx}>%</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredProducts.map((product) => {
                  const currentPrice = parseFloat(product.currentPrice) || 0;
                  const cappedPrice = product.cappedPrice || 0;
                  const overCap = currentPrice > cappedPrice;
                  // Reference always shows a positive magnitude (difference from cap), never negative.
                  const differencePercent = cappedPrice > 0
                    ? (Math.abs((currentPrice - cappedPrice) / cappedPrice) * 100).toFixed(2)
                    : '0.00';

                  return (
                    <TableRow key={product.id} sx={{ bgcolor: '#ffffff' }}>
                      <TableCell sx={bodyCellSx}>
                        <Typography sx={{ fontSize: 12, color: '#676b72' }}>
                          {product.priceSet || 'Default Price Set'}
                        </Typography>
                        <Typography sx={{ fontSize: 16, fontWeight: 600, color: '#000' }}>
                          {product.productName || product.name}
                        </Typography>
                      </TableCell>
                      <TableCell sx={bodyCellSx}>{product.cappedPricingName || '-'}</TableCell>
                      <TableCell sx={bodyCellSx}>{formatDate(product.startDate)}</TableCell>
                      <TableCell sx={bodyCellSx}>{formatDate(product.endDate)}</TableCell>
                      <TableCell sx={bodyCellSx}>{product.quantity || 1}</TableCell>
                      <TableCell sx={bodyCellSx}>${cappedPrice.toFixed(2)}</TableCell>
                      <TableCell sx={bodyCellSx}>
                        <TextField
                          type="number"
                          value={product.currentPrice}
                          onChange={(e) => handlePriceChange(product.id, e.target.value)}
                          onBlur={() => handlePriceBlur(product)}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Box component="span" sx={{ color: '#676b72' }}>$</Box>
                              </InputAdornment>
                            ),
                          }}
                          sx={{
                            width: 233,
                            '& .MuiOutlinedInput-root': {
                              height: 53,
                              borderRadius: '8px',
                              bgcolor: '#fff',
                              fontSize: 16,
                              color: overCap ? '#dc2626' : '#000000',
                              '& fieldset': { borderColor: '#404040', borderWidth: '1px' },
                              '&:hover fieldset': { borderColor: '#404040' },
                              '&.Mui-focused fieldset': { borderColor: '#000000', borderWidth: '2px' },
                            },
                          }}
                        />
                      </TableCell>
                      <TableCell
                        sx={{ ...bodyCellSx, color: overCap ? '#dc2626' : '#000000', fontWeight: 600 }}
                      >
                        {differencePercent}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
            )}
          </>
        )}
      </Box>
    </Box>
  );
};

export default CappedPricing;
