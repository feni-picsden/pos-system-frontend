import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Select,
  MenuItem,
  ListSubheader,
  Snackbar
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Close as CloseIcon,
  ArrowDropDown
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import supplierService from '../../services/supplierService';
import classificationService from '../../services/classificationService';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';

// Reference: floating-style field label, 12.8px black, 20px above the field
const captionSx = {
  fontSize: '12.8px',
  lineHeight: '20px',
  color: '#000',
  transition: 'all 0.15s cubic-bezier(0.4,0,0.2,1)'
};

// Reference field: 42px tall, 1px #404040 rail kept on focus + a 3px black outline.
// `top: 0` on the notched outline kills MUI's -5px legend offset so the Search and
// Classification fields measure the same 42px.
const searchFieldSx = {
  backgroundColor: '#fff',
  borderRadius: '8px',
  '& .MuiOutlinedInput-root': {
    height: 42,
    borderRadius: '8px',
    backgroundColor: '#fff',
    fontSize: 16,
    paddingRight: '8px',
    '& fieldset': { border: '1px solid #404040', top: 0 },
    '& legend': { display: 'none' },
    '&:hover fieldset': { border: '1px solid #404040' },
    '&.Mui-focused fieldset': { border: '1px solid #404040' },
    '&.Mui-focused': { outline: '3px solid #000', outlineOffset: 0 }
  },
  '& .MuiOutlinedInput-input': { padding: '8px 16px', color: '#000' },
  '& input::placeholder': { color: '#808080', opacity: 1 }
};

// Reference in-field buttons (clear / caret): 25x24, radius 8px, hover wash
const fieldIconButtonSx = {
  width: 25,
  height: 24,
  padding: '4px',
  borderRadius: '8px',
  color: '#000',
  '&:hover': { backgroundColor: 'rgba(0,0,0,0.05)' }
};

const classificationSelectSx = {
  height: 42,
  borderRadius: '8px',
  backgroundColor: '#fff',
  fontSize: 16,
  color: '#000',
  '& .MuiSelect-select': {
    padding: '8px 32px 8px 16px',
    height: 42,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    color: '#000'
  },
  '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #404040', top: 0 },
  '& legend': { display: 'none' },
  '&:hover .MuiOutlinedInput-notchedOutline': { border: '1px solid #404040' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: '1px solid #404040' },
  '&.Mui-focused': { outline: '3px solid #000', outlineOffset: 0 },
  // caret rendered as the reference's 25x24 hoverable button
  '& .MuiSelect-icon': {
    ...fieldIconButtonSx,
    padding: '5px 4px',
    boxSizing: 'border-box',
    right: 8,
    top: 'calc(50% - 12px)',
    pointerEvents: 'auto',
    cursor: 'pointer',
    transition: 'transform 0.15s cubic-bezier(0.4,0,0.2,1)'
  }
};

const classificationMenuProps = {
  transitionDuration: 0,
  anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
  transformOrigin: { vertical: 'top', horizontal: 'left' },
  PaperProps: {
    sx: {
      mt: '10px',
      borderRadius: '8px',
      border: '1px solid #000',
      maxHeight: 288,
      backgroundColor: '#fff',
      boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
      '& .MuiList-root': { paddingTop: 0, paddingBottom: 0 }
    }
  }
};

const classificationHeaderSx = {
  fontSize: 16,
  fontWeight: 700,
  color: '#0a0a0a',
  backgroundColor: '#fff',
  height: 57,
  boxSizing: 'border-box',
  padding: '16px',
  lineHeight: '25px',
  borderTop: '1px solid #a3a3a3',
  cursor: 'auto'
};

const classificationOptionSx = {
  fontSize: 16,
  color: '#0a0a0a',
  minHeight: 56,
  height: 56,
  padding: '16px',
  transition: 'none',
  '&:hover': { backgroundColor: '#7dd3fc' },
  '&.Mui-selected': { backgroundColor: '#7dd3fc' },
  '&.Mui-selected:hover': { backgroundColor: '#7dd3fc' },
  '&.Mui-focusVisible': { backgroundColor: '#7dd3fc' }
};

// Reference toggle: OFF #a3a3a3 (hover #737373), ON #3b82f6, 19px thumb inset 2.4px.
// Page-local so the shared ShopfrontSwitch (used by many other pages) is untouched.
const unassignedSwitchSx = {
  '& .MuiSwitch-switchBase': { margin: '2.4px' },
  '& .MuiSwitch-switchBase.Mui-checked': { transform: 'translateX(24px)' },
  '& .MuiSwitch-track': {
    backgroundColor: '#a3a3a3',
    transition: 'background-color 0.15s cubic-bezier(0.4,0,0.2,1)'
  },
  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#3b82f6' },
  '&:hover .MuiSwitch-switchBase:not(.Mui-checked) + .MuiSwitch-track': { backgroundColor: '#737373' },
  '&:hover .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#3b82f6' }
};

const rowActionSx = (color) => ({
  width: 32,
  height: 32,
  borderRadius: '12px',
  border: `1px solid ${color}`,
  backgroundColor: 'transparent',
  transition: 'none',
  '&:hover': { backgroundColor: 'rgba(0,0,0,0.05)' }
});

const SupplierAssignment = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [supplier, setSupplier] = useState(null);
  const [assignedProducts, setAssignedProducts] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [classification, setClassification] = useState('');
  const [classificationOpen, setClassificationOpen] = useState(false);
  const [allClassifications, setAllClassifications] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  // Load the full classification list so the filter dropdown offers every
  // classification grouped by type (not just ones present on loaded products)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await classificationService.getClassifications();
        if (!cancelled) setAllClassifications(data.classifications || []);
      } catch (err) {
        console.error('Error loading classification list:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Reference: the search runs on the server (so it narrows BOTH panes) and the
  // field shows an in-field spinner while it is in flight. Debounced while typing.
  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    const term = searchTerm.trim();
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await supplierService.getSupplierProducts(id, {
          search: term,
          unassignedOnly
        });
        if (cancelled) return;
        setSupplier(data.supplier);
        setAssignedProducts(data.assignedProducts || []);
        setAvailableProducts(data.availableProducts || []);
        setError('');
      } catch (err) {
        console.error('Error loading supplier data:', err);
        if (!cancelled) setError('Failed to load supplier data');
      } finally {
        // `loading` only gates the very first paint; later fetches keep the list on screen
        if (!cancelled) {
          setLoading(false);
          setSearching(false);
        }
      }
    }, term ? 300 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, unassignedOnly, searchTerm]);

  // Grouped options for the classification filter: the store's FULL
  // classification list grouped by its DB type (reference popup shows all)
  const classificationGroups = useMemo(() => {
    const groups = { CATEGORY: [], BRAND: [], FAMILY: [] };
    allClassifications.forEach((item) => {
      if (!item?.name || !groups[item.type]) return;
      if (!groups[item.type].includes(item.name)) groups[item.type].push(item.name);
    });
    return [
      { header: 'Categories', options: groups.CATEGORY },
      { header: 'Brands', options: groups.BRAND },
      { header: 'Families', options: groups.FAMILY }
    ];
  }, [allClassifications]);

  // Reference behavior: the search narrows BOTH panes (server-side + this instant pass)
  const filteredAssigned = useMemo(() => {
    const searchLower = searchTerm.trim().toLowerCase();
    if (!searchLower) return assignedProducts;
    return assignedProducts.filter((p) => (p.name || '').toLowerCase().includes(searchLower));
  }, [assignedProducts, searchTerm]);

  // Classification filter applies to the Available list only
  const filteredAvailable = useMemo(() => {
    const searchLower = searchTerm.trim().toLowerCase();
    return availableProducts.filter((product) => {
      if (!(product.name || '').toLowerCase().includes(searchLower)) return false;
      if (
        classification &&
        product.category?.name !== classification &&
        product.brand?.name !== classification &&
        product.family?.name !== classification
      ) return false;
      // ponytail: unassignedOnly is also applied server-side; extra client guard when supplier data present
      if (unassignedOnly && product.suppliers?.length) return false;
      return true;
    });
  }, [availableProducts, searchTerm, classification, unassignedOnly]);

  const handleAssignProduct = async (product) => {
    try {
      setSaving(true);
      await supplierService.assignProducts(id, [product.id], 'assign');

      // Update local state
      setAssignedProducts(prev => [...prev, product]);
      setAvailableProducts(prev => prev.filter(p => p.id !== product.id));

      setSnackbar({ open: true, message: 'Product assigned successfully' });
    } catch (err) {
      setError('Failed to assign product');
      console.error('Error assigning product:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleUnassignProduct = async (product) => {
    try {
      setSaving(true);
      await supplierService.assignProducts(id, [product.id], 'unassign');

      // Update local state
      setAssignedProducts(prev => prev.filter(p => p.id !== product.id));
      setAvailableProducts(prev => [...prev, product]);

      setSnackbar({ open: true, message: 'Product unassigned successfully' });
    } catch (err) {
      setError('Failed to unassign product');
      console.error('Error unassigning product:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!supplier) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Supplier not found</Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Band 1 (h=60): supplier name + "without a Supplier" toggle */}
      <Box
        sx={{
          height: 60,
          boxSizing: 'border-box',
          p: 2,
          backgroundColor: '#e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Typography sx={{ fontSize: 20, lineHeight: '28px', fontWeight: 400, color: '#000' }}>
          {supplier.name}
        </Typography>
        <FormControlLabel
          control={
            <ShopfrontSwitch
              checked={unassignedOnly}
              onChange={(e) => setUnassignedOnly(e.target.checked)}
              sx={unassignedSwitchSx}
            />
          }
          label="Only show Products without a Supplier"
          sx={{ mr: 0, '& .MuiFormControlLabel-label': { fontSize: 16, ml: 1, color: '#000' } }}
        />
      </Box>

      {/* Band 2 (h=94): Search (left half) + Classification (right half) */}
      <Box
        sx={{
          height: 94,
          boxSizing: 'border-box',
          p: 2,
          backgroundColor: '#e2e8f0',
          display: 'flex',
          gap: 2
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography sx={captionSx}>Search</Typography>
          <TextField
            fullWidth
            placeholder="Search for Products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={searchFieldSx}
            InputProps={{
              endAdornment:
                searching || searchTerm ? (
                  <InputAdornment position="end" sx={{ ml: 0, gap: '4px' }}>
                    {searching && (
                      <CircularProgress size={16} thickness={5} sx={{ color: '#000' }} />
                    )}
                    {searchTerm && (
                      <IconButton
                        disableRipple
                        aria-label="Clear search"
                        onClick={() => setSearchTerm('')}
                        sx={fieldIconButtonSx}
                      >
                        <CloseIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    )}
                  </InputAdornment>
                ) : null
            }}
          />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={captionSx}>Classification</Typography>
          <Select
            fullWidth
            displayEmpty
            open={classificationOpen}
            onOpen={() => setClassificationOpen(true)}
            onClose={() => setClassificationOpen(false)}
            value={classification}
            onChange={(e) => setClassification(e.target.value)}
            // The caret is a hoverable button in the reference, so it takes pointer
            // events back from MUI and opens the list itself.
            IconComponent={(iconProps) => (
              <ArrowDropDown
                {...iconProps}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setClassificationOpen(true);
                }}
              />
            )}
            renderValue={() =>
              classification ? (
                <span style={{ color: '#000' }}>{classification}</span>
              ) : (
                <span style={{ color: '#808080' }}>Filter by Classification...</span>
              )
            }
            endAdornment={
              classification ? (
                <IconButton
                  disableRipple
                  aria-label="Clear classification"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => setClassification('')}
                  sx={{ ...fieldIconButtonSx, mr: '33px' }}
                >
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              ) : null
            }
            MenuProps={classificationMenuProps}
            sx={classificationSelectSx}
          >
            {classificationGroups.flatMap((group) =>
              group.options.length === 0
                ? []
                : [
                    <ListSubheader key={group.header} sx={classificationHeaderSx}>
                      {group.header}
                    </ListSubheader>,
                    ...group.options.map((name) => (
                      <MenuItem key={`${group.header}:${name}`} value={name} sx={classificationOptionSx}>
                        {name}
                      </MenuItem>
                    ))
                  ]
            )}
          </Select>
        </Box>
      </Box>

      {/* Reference main grid inset */}
      <Box sx={{ padding: '24px 16px 16px' }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Two bare columns */}
      <Box sx={{ display: 'flex', gap: 2, height: '60vh' }}>
        {/* Left column - assigned products */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {filteredAssigned.map((product, index) => (
            <Box
              key={product.id}
              sx={{
                minHeight: 52,
                px: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: '4px',
                backgroundColor: index % 2 === 1 ? '#f7f7f7' : 'transparent'
              }}
            >
              <Typography sx={{ fontSize: 16, color: '#000' }}>{product.name}</Typography>
              <IconButton
                disableRipple
                onClick={() => handleUnassignProduct(product)}
                disabled={saving}
                sx={rowActionSx('rgb(239,68,68)')}
              >
                <RemoveIcon sx={{ fontSize: 16, color: 'rgb(220,38,38)' }} />
              </IconButton>
            </Box>
          ))}
          {filteredAssigned.length === 0 && (
            <Typography sx={{ textAlign: 'center', color: '#8e8e8e', mt: 4, fontSize: 16 }}>
              {searchTerm.trim()
                ? `No products in ${supplier.name} found...`
                : `Add products to ${supplier.name} ...`}
            </Typography>
          )}
        </Box>

        {/* Right column - available products */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {filteredAvailable.map((product, index) => (
            <Box
              key={product.id}
              sx={{
                minHeight: 52,
                px: 1.5,
                py: 0.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: '4px',
                backgroundColor: index % 2 === 1 ? '#f7f7f7' : 'transparent'
              }}
            >
              <Box>
                {product.suppliers?.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.25 }}>
                    {product.suppliers.map((s, i) => (
                      <Box
                        key={s.id ?? i}
                        component="span"
                        sx={{
                          fontSize: 12,
                          color: '#000',
                          border: '1px solid #b5b5b5',
                          borderRadius: '4px',
                          px: 0.5,
                          backgroundColor: 'transparent'
                        }}
                      >
                        {s.name ?? s.supplier?.name}
                      </Box>
                    ))}
                  </Box>
                )}
                <Typography sx={{ fontSize: 16, color: '#000' }}>{product.name}</Typography>
              </Box>
              <IconButton
                disableRipple
                onClick={() => handleAssignProduct(product)}
                disabled={saving}
                sx={rowActionSx('rgb(34,197,94)')}
              >
                <AddIcon sx={{ fontSize: 16, color: 'rgb(22,163,74)' }} />
              </IconButton>
            </Box>
          ))}
          {filteredAvailable.length === 0 && (
            <Typography sx={{ textAlign: 'center', color: '#8e8e8e', mt: 4, fontSize: 16 }}>
              No available products
            </Typography>
          )}
        </Box>
      </Box>
      </Box>

      {/* Footer with Save Button */}
      <Box sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#404040',
        p: 2,
        display: 'flex',
        justifyContent: 'flex-end',
      }}>
        <Button
          variant="contained"
          onClick={() => navigate('/suppliers')}
          sx={{
            backgroundColor: '#3b82f6',
            color: '#fff',
            fontWeight: 700,
            textTransform: 'none',
            borderRadius: '12px',
            boxShadow: 'none',
            px: 3,
            '&:hover': { backgroundColor: '#2563eb', boxShadow: 'none' }
          }}
        >
          Save
        </Button>
      </Box>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        message={snackbar.message}
      />
    </Box>
  );
};

export default SupplierAssignment;
