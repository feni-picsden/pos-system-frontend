import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import supplierService from '../../services/supplierService';
import masterDatabaseService from '../../services/masterDatabaseService';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';

const actionColor = {
  Copied: 'success',
  Found: 'info',
  'Not Found': 'warning',
  Failed: 'error',
};

const fieldLabelSx = { fontSize: 16, fontWeight: 700, color: '#000', mb: '20px' };

// Label-above outlined field matching the Supplier/Product List fields above.
const outlinedFieldSx = {
  '& .MuiOutlinedInput-root': { height: 42, borderRadius: '8px', bgcolor: '#fff', fontSize: 16 },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: 1 },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
  '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: 2 },
  '& input::placeholder': { color: '#808080', opacity: 1 },
};

const primaryButtonSx = {
  height: 42,
  borderRadius: '12px',
  fontSize: 16,
  fontWeight: 700,
  textTransform: 'none',
  bgcolor: '#5ebbeb',
  color: '#f8f8f8',
  boxShadow: 'none',
  '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' },
};

const importButtonSx = {
  height: 53,
  borderRadius: 0,
  fontSize: 16,
  fontWeight: 400,
  textTransform: 'none',
  bgcolor: '#1c86f2',
  color: '#f8f8f8',
  border: '1px solid #f8f8f8',
  boxShadow: 'none',
  // ponytail: reference Import has no hover state change; keep it solid.
  '&:hover': { bgcolor: '#1c86f2', color: '#f8f8f8', boxShadow: 'none' },
  '&.Mui-disabled': { bgcolor: '#1c86f2', color: '#f8f8f8', opacity: 0.6 },
};

const parseMasterProductLines = (inputText) => {
  const lines = String(inputText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const products = [];
  const errors = [];

  lines.forEach((line, index) => {
    const parts = line.split(',').map((item) => item.trim());
    const [supplierCode, name, description, caseQuantity, itemCost, sellPrice] = parts;

    if (!supplierCode || !name) {
      errors.push(`Line ${index + 1}: supplierCode and name are required`);
      return;
    }

    const parsedCaseQuantity = caseQuantity ? parseInt(caseQuantity, 10) : 1;
    const parsedItemCost = itemCost ? parseFloat(itemCost) : 0;
    const parsedSellPrice = sellPrice ? parseFloat(sellPrice) : 0;

    if (Number.isNaN(parsedCaseQuantity) || parsedCaseQuantity <= 0) {
      errors.push(`Line ${index + 1}: caseQuantity must be a positive number`);
      return;
    }

    if (Number.isNaN(parsedItemCost) || Number.isNaN(parsedSellPrice)) {
      errors.push(`Line ${index + 1}: itemCost and sellPrice must be valid numbers`);
      return;
    }

    products.push({
      supplierCode,
      name,
      description: description || null,
      caseQuantity: parsedCaseQuantity,
      itemCost: parsedItemCost,
      sellPrice: parsedSellPrice,
      isActive: true,
    });
  });

  return { products, errors };
};

const ImportSupplierProducts = () => {
  const { user } = useAuth();
  const { selectedOutletId } = useSelectedOutlet();

  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);

  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [productList, setProductList] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importResponse, setImportResponse] = useState(null);

  const [masterProvider, setMasterProvider] = useState('shopfront');
  const [masterSupplierReference, setMasterSupplierReference] = useState('');
  const [masterSupplierName, setMasterSupplierName] = useState('');
  const [masterProductsInput, setMasterProductsInput] = useState('');
  const [savingMasterProducts, setSavingMasterProducts] = useState(false);
  const [masterError, setMasterError] = useState('');
  const [masterParseErrors, setMasterParseErrors] = useState([]);
  const [masterResponse, setMasterResponse] = useState(null);

  const isGlobalSuperAdmin = Boolean(
    user?.isSuperAdmin || (user?.hasAllPermission && (user?.outletId === null || user?.outletId === undefined))
  );

  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        setLoadingSuppliers(true);
        setImportError('');

        const normalize = (value) => String(value || '').trim().toUpperCase();
        const filters = {};

        const supplierResponse = await supplierService.getSuppliers(filters);
        let candidateSuppliers = supplierResponse.suppliers || [];

        if (isGlobalSuperAdmin) {
          const masterResponse = await masterDatabaseService.getSuppliers();
          const masterSuppliers = masterResponse.suppliers || [];

          const masterReferenceSet = new Set(
            masterSuppliers.map((item) => normalize(item.reference)).filter(Boolean)
          );
          const masterNameSet = new Set(
            masterSuppliers.map((item) => normalize(item.name)).filter(Boolean)
          );
          const masterProviderSet = new Set(
            masterSuppliers.map((item) => normalize(item.provider)).filter(Boolean)
          );

          candidateSuppliers = candidateSuppliers.filter((supplier) => {
            const supplierRef = normalize(supplier.masterDatabaseRef);
            const supplierName = normalize(supplier.name);

            const refMatches =
              supplierRef &&
              (masterReferenceSet.has(supplierRef) ||
                masterNameSet.has(supplierRef) ||
                masterProviderSet.has(supplierRef));

            const nameMatches = supplierName && masterNameSet.has(supplierName);

            return Boolean(refMatches || nameMatches);
          });
        } else {
          candidateSuppliers = candidateSuppliers.filter(
            (supplier) => String(supplier.masterDatabaseRef || '').trim() !== ''
          );
        }

        setSuppliers(candidateSuppliers);
      } catch (err) {
        console.error('Error loading suppliers:', err);
        setImportError('Failed to load suppliers');
      } finally {
        setLoadingSuppliers(false);
      }
    };

    loadSuppliers();
  }, [isGlobalSuperAdmin, selectedOutletId]);

  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => supplier.id === parseInt(selectedSupplierId, 10)) || null,
    [suppliers, selectedSupplierId]
  );

  useEffect(() => {
    if (!isGlobalSuperAdmin || !selectedSupplier) return;

    if (!masterSupplierReference && selectedSupplier.masterDatabaseRef) {
      setMasterSupplierReference(selectedSupplier.masterDatabaseRef);
    }

    if (!masterSupplierName && selectedSupplier.name) {
      setMasterSupplierName(selectedSupplier.name);
    }
  }, [isGlobalSuperAdmin, selectedSupplier, masterSupplierReference, masterSupplierName]);

  const parsedCodes = useMemo(
    () => productList.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    [productList]
  );

  const handleImport = async () => {
    setImportError('');

    if (!selectedSupplierId) {
      setImportError('Please select a supplier');
      return;
    }

    if (!selectedSupplier?.masterDatabaseRef) {
      setImportError('Selected supplier is missing Master Database Reference');
      return;
    }

    if (parsedCodes.length === 0) {
      setImportError('Please enter at least one supplier code');
      return;
    }

    try {
      setImporting(true);
      const payload = {
        codes: parsedCodes,
        productList,
      };

      if (isGlobalSuperAdmin && selectedOutletId !== null && selectedOutletId !== undefined) {
        payload.outletId = parseInt(selectedOutletId, 10);
      }

      const response = await supplierService.importSupplierProducts(parseInt(selectedSupplierId, 10), payload);
      setImportResponse(response);
    } catch (err) {
      console.error('Import supplier products failed:', err);
      setImportError(err.response?.data?.error || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleSaveMasterProducts = async () => {
    setMasterError('');
    setMasterParseErrors([]);
    setMasterResponse(null);

    if (!isGlobalSuperAdmin) {
      setMasterError('Only super admin can save master products');
      return;
    }

    if (!masterSupplierReference.trim()) {
      setMasterError('Master Supplier Reference is required');
      return;
    }

    if (!masterProductsInput.trim()) {
      setMasterError('Please enter at least one master product line');
      return;
    }

    const { products, errors } = parseMasterProductLines(masterProductsInput);

    if (errors.length > 0) {
      setMasterParseErrors(errors);
      return;
    }

    try {
      setSavingMasterProducts(true);

      const response = await masterDatabaseService.bulkUpsertProducts({
        provider: masterProvider || 'shopfront',
        supplierReference: masterSupplierReference.trim(),
        supplierName: masterSupplierName.trim() || null,
        products,
      });

      setMasterResponse(response);
    } catch (err) {
      console.error('Saving master products failed:', err);
      setMasterError(err.response?.data?.error || 'Failed to save master products');
    } finally {
      setSavingMasterProducts(false);
    }
  };

  return (
    <Box sx={{ p: '32px', display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography
        component="h1"
        sx={{ fontSize: 32, fontWeight: 700, color: '#000', mb: '16px' }}
      >
        Supplier Import
      </Typography>

      <Box sx={{ mb: '20px' }}>
        <Typography sx={{ fontSize: 16, fontWeight: 400, color: '#000' }}>
          This will import all products provided from the Master Database, if the products already
          exist in your file they will be ignored.
        </Typography>
        <Typography sx={{ fontSize: 16, fontWeight: 400, color: '#000' }}>
          Please provide one supplier code per line.
        </Typography>
      </Box>

      {importError && <Alert severity="error">{importError}</Alert>}

      <Box>
        <Typography sx={fieldLabelSx}>Supplier</Typography>
        <Autocomplete
          fullWidth
          options={suppliers}
          getOptionKey={(option) => option.id}
          getOptionLabel={(option) => option.name || ''}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          value={selectedSupplier}
          onChange={(event, option) => setSelectedSupplierId(option ? option.id : '')}
          disabled={loadingSuppliers || importing}
          loading={loadingSuppliers}
          noOptionsText="No suppliers linked to master database"
          componentsProps={{
            paper: {
              sx: {
                border: '1px solid #000',
                borderRadius: '8px',
                boxShadow: 'none',
                mt: '4px',
              },
            },
          }}
          ListboxProps={{
            sx: {
              maxHeight: 230,
              py: 0,
              '& .MuiAutocomplete-option': {
                minHeight: 56,
                fontSize: 16,
                padding: '16px',
              },
              '& .MuiAutocomplete-option.Mui-focused, & .MuiAutocomplete-option[aria-selected="true"], & .MuiAutocomplete-option[aria-selected="true"].Mui-focused':
                {
                  backgroundColor: '#7dd3fc',
                },
            },
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Select..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  height: 42,
                  borderRadius: '8px',
                  bgcolor: '#fff',
                  py: 0,
                  fontSize: 16,
                },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: 1 },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
                '& .Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#000',
                  borderWidth: 2,
                },
                '& input::placeholder': { color: '#808080', opacity: 1 },
              }}
            />
          )}
        />
      </Box>

      <Box>
        <Typography sx={fieldLabelSx}>Product List</Typography>
        <TextField
          fullWidth
          multiline
          rows={3}
          value={productList}
          onChange={(event) => setProductList(event.target.value)}
          disabled={importing}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 0,
              bgcolor: '#fff',
              fontSize: 16,
              p: 0,
            },
            // ponytail: rows=3 * 23px line-height + 2px border = 71px; native grip restored.
            // No minHeight here: MUI's hidden shadow textarea inherits it and inflates autosize to 207px.
            '& .MuiOutlinedInput-input': {
              p: '0 2px',
              resize: 'vertical',
            },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: 1 },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#000' },
            '& .Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#000',
              borderWidth: 1,
            },
          }}
        />
      </Box>

      <Button
        variant="contained"
        fullWidth
        disableElevation
        disableRipple
        onClick={handleImport}
        disabled={importing || loadingSuppliers}
        sx={importButtonSx}
      >
        {importing ? <CircularProgress size={22} color="inherit" /> : 'Import'}
      </Button>

      {importResponse?.summary && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip label={`Total ${importResponse.summary.total}`} />
          <Chip color="success" label={`Copied ${importResponse.summary.copied}`} />
          <Chip color="info" label={`Found ${importResponse.summary.found}`} />
          <Chip color="warning" label={`Not Found ${importResponse.summary.notFound}`} />
          <Chip color="error" label={`Failed ${importResponse.summary.failed}`} />
        </Box>
      )}

      {importResponse?.results?.length > 0 && (
        <TableContainer sx={{ borderRadius: 0 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#5ebbeb' }}>
                {['Supplier Code', 'Action', 'Description', 'Product ID'].map((head) => (
                  <TableCell
                    key={head}
                    sx={{
                      color: '#f8f8f8',
                      fontSize: 16,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '8px',
                      border: 'none',
                    }}
                  >
                    {head}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {importResponse.results.map((item, index) => (
                <TableRow
                  key={`${item.code}-${index}`}
                  sx={{ bgcolor: index % 2 === 0 ? '#fff' : '#f8f8f8' }}
                >
                  <TableCell sx={{ fontSize: 16, color: '#000', padding: '8px 8px 8px 10px', border: 'none' }}>
                    {item.code}
                  </TableCell>
                  <TableCell sx={{ padding: '8px 8px 8px 10px', border: 'none' }}>
                    <Chip
                      size="small"
                      label={item.action}
                      color={actionColor[item.action] || 'default'}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: 16, color: '#000', padding: '8px 8px 8px 10px', border: 'none' }}>
                    {item.description}
                  </TableCell>
                  <TableCell sx={{ fontSize: 16, color: '#000', padding: '8px 8px 8px 10px', border: 'none' }}>
                    {item.productId || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {isGlobalSuperAdmin && (
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 0, mt: 2 }}>
          <Typography variant="h5" sx={{ mb: 1 }}>
            Master Database Products (Super Admin)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add or update master products in bulk. One line format:
            <br />
            <strong>supplierCode,name,description,caseQuantity,itemCost,sellPrice</strong>
          </Typography>

          {masterError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {masterError}
            </Alert>
          )}

          {masterParseErrors.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {masterParseErrors.map((msg) => (
                <Typography key={msg} variant="body2">{msg}</Typography>
              ))}
            </Alert>
          )}

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2, mb: 2 }}>
            <Box>
              <Typography sx={fieldLabelSx}>Provider</Typography>
              <TextField
                fullWidth
                value={masterProvider}
                onChange={(event) => setMasterProvider(event.target.value)}
                disabled={savingMasterProducts}
                sx={outlinedFieldSx}
              />
            </Box>
            <Box>
              <Typography sx={fieldLabelSx}>Master Supplier Reference *</Typography>
              <TextField
                fullWidth
                value={masterSupplierReference}
                onChange={(event) => setMasterSupplierReference(event.target.value)}
                disabled={savingMasterProducts}
                required
                sx={outlinedFieldSx}
              />
            </Box>
            <Box>
              <Typography sx={fieldLabelSx}>Supplier Name (Optional)</Typography>
              <TextField
                fullWidth
                value={masterSupplierName}
                onChange={(event) => setMasterSupplierName(event.target.value)}
                disabled={savingMasterProducts}
                sx={outlinedFieldSx}
              />
            </Box>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography sx={fieldLabelSx}>Master Product Lines</Typography>
            <TextField
              fullWidth
              multiline
              minRows={6}
              value={masterProductsInput}
              onChange={(event) => setMasterProductsInput(event.target.value)}
              disabled={savingMasterProducts}
              placeholder={[
                'ABC123,Sample Product 1,330ml bottle,24,1.20,2.50',
                'XYZ789,Sample Product 2,,12,5.75,8.99',
              ].join('\n')}
              sx={{
                '& .MuiOutlinedInput-root': { borderRadius: '8px', bgcolor: '#fff', fontSize: 16 },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: 1 },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
                '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: 2 },
                '& textarea::placeholder': { color: '#808080', opacity: 1 },
              }}
            />
          </Box>

          <Button
            variant="contained"
            disableElevation
            disableRipple
            onClick={handleSaveMasterProducts}
            disabled={savingMasterProducts}
            sx={{ ...primaryButtonSx, mb: 2 }}
          >
            {savingMasterProducts ? <CircularProgress size={22} color="inherit" /> : 'Save Master Products'}
          </Button>

          {masterResponse?.summary && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip label={`Total ${masterResponse.summary.total}`} />
              <Chip color="success" label={`Created ${masterResponse.summary.created}`} />
              <Chip color="info" label={`Updated ${masterResponse.summary.updated}`} />
              <Chip color="warning" label={`Skipped ${masterResponse.summary.skipped}`} />
            </Box>
          )}

          {masterResponse?.errors?.length > 0 && (
            <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Row</TableCell>
                    <TableCell>Code</TableCell>
                    <TableCell>Error</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {masterResponse.errors.map((row, index) => (
                    <TableRow key={`${row.row}-${index}`}>
                      <TableCell>{row.row}</TableCell>
                      <TableCell>{row.code || '-'}</TableCell>
                      <TableCell>{row.error}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

    </Box>
  );
};

export default ImportSupplierProducts;
