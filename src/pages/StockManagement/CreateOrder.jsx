import React, { useState, useEffect } from 'react';
import PageLoader from '../../components/Common/PageLoader';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  FormControl,
  Select,
  MenuItem,
  Autocomplete,
  Popover,
  IconButton,
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  CalendarTodayOutlined as CalendarIcon,
  SettingsOutlined as SettingsOutlinedIcon,
  ArrowDropDown as ArrowDropDownIcon,
  KeyboardArrowLeft,
  KeyboardArrowRight,
} from '@mui/icons-material';
import { format, addMonths, startOfMonth, endOfMonth, isSameDay, isSameMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import orderInvoiceService from '../../services/orderInvoiceService';
import supplierService from '../../services/supplierService';
import classificationService from '../../services/classificationService';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import { outletService } from '../../services/outletService';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';

// Shopfront parity field styling: 42px h, 1px #404040 border, 8px radius
const fieldSx = {
  '& .MuiOutlinedInput-root': {
    height: 42,
    borderRadius: '8px',
    fontSize: 16,
    backgroundColor: '#fff',
    '& fieldset': { borderColor: '#404040', borderWidth: '1px' },
    '&:hover fieldset': { borderColor: '#404040' },
    '&.Mui-focused fieldset': { borderColor: '#000', borderWidth: '2px' },
  },
  '& .MuiOutlinedInput-input::placeholder': { color: '#808080', opacity: 1 },
};

const textareaSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    fontSize: 16,
    alignItems: 'flex-start',
    padding: '8px 16px',
    '& textarea': { lineHeight: '24px' },
    backgroundColor: '#fff',
    '& fieldset': { borderColor: '#404040', borderWidth: '1px' },
    '&:hover fieldset': { borderColor: '#404040' },
    '&.Mui-focused fieldset': { borderColor: '#000', borderWidth: '2px' },
  },
  '& .MuiOutlinedInput-input::placeholder': { color: '#808080', opacity: 1 },
};

const unitSelectSx = {
  height: 42,
  borderRadius: '8px',
  fontSize: 16,
  backgroundColor: '#fff',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
};

const selectMenuProps = {
  TransitionProps: { timeout: 0 },
  PaperProps: {
    sx: {
      borderRadius: '8px',
      '& .MuiMenuItem-root': { minHeight: 56, fontSize: 16, padding: '16px' },
      '& .MuiMenuItem-root:hover': { backgroundColor: 'rgb(125,211,252)' },
      '& .MuiMenuItem-root.Mui-selected': { backgroundColor: 'rgb(125,211,252)' },
      '& .MuiMenuItem-root.Mui-selected:hover': { backgroundColor: 'rgb(125,211,252)' },
      '& .MuiMenuItem-root.Mui-selected.Mui-focusVisible': { backgroundColor: 'rgb(125,211,252)' },
    },
  },
};

const FieldLabel = ({ children }) => (
  <Typography component="label" sx={{ display: 'block', fontWeight: 700, fontSize: 16, color: '#000', mb: 1 }}>
    {children}
  </Typography>
);

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Shopfront-style dual-month date picker: popover above field, Monday week start,
// DD/MM/YYYY format, Current Day shortcut, clear (X), #5ebbeb rounded-square selection
const ShopfrontDatePicker = ({ value, onChange }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [viewMonth, setViewMonth] = useState(startOfMonth(value || new Date()));

  const open = Boolean(anchorEl);

  const handleOpen = (e) => {
    setViewMonth(startOfMonth(value || new Date()));
    setAnchorEl(e.currentTarget);
  };

  const handlePick = (day) => {
    onChange(day);
    setAnchorEl(null);
  };

  const renderMonth = (month) => {
    const first = startOfMonth(month);
    const gridStart = new Date(first);
    // Monday-start offset
    gridStart.setDate(gridStart.getDate() - ((gridStart.getDay() + 6) % 7));
    const gridEnd = new Date(endOfMonth(month));
    gridEnd.setDate(gridEnd.getDate() + ((7 - gridEnd.getDay()) % 7));
    const days = [];
    const d = new Date(gridStart);
    while (d <= gridEnd) {
      days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return (
      <Box sx={{ width: 232 }}>
        <Typography sx={{ textAlign: 'center', fontWeight: 700, fontSize: 14, mb: 1 }}>
          {format(month, 'MMMM yyyy')}
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
          {WEEKDAYS.map((w, i) => (
            <Typography key={i} sx={{ textAlign: 'center', fontWeight: 700, fontSize: 12, color: '#676b72', py: 0.5 }}>
              {w}
            </Typography>
          ))}
          {days.map((day, i) => {
            const inMonth = isSameMonth(day, month);
            const selected = value && isSameDay(day, value);
            return (
              <Box
                key={i}
                onClick={() => inMonth && handlePick(day)}
                sx={{
                  height: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  cursor: inMonth ? 'pointer' : 'default',
                  borderRadius: '6px',
                  backgroundColor: selected ? '#5ebbeb' : 'transparent',
                  color: selected ? '#fff' : inMonth ? '#0284c7' : 'transparent',
                  fontWeight: selected ? 700 : 400,
                  '&:hover': inMonth && !selected ? { backgroundColor: 'rgb(142,208,240)' } : {},
                }}
              >
                {format(day, 'd')}
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  };

  return (
    <>
      <TextField
        fullWidth
        value={value ? format(value, 'dd/MM/yyyy') : ''}
        placeholder="DD/MM/YYYY"
        onClick={handleOpen}
        InputProps={{ readOnly: true }}
        sx={{ ...fieldSx, '& .MuiOutlinedInput-input': { cursor: 'pointer' } }}
      />
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        TransitionProps={{ timeout: 0 }}
        PaperProps={{ sx: { p: 2, borderRadius: '8px' } }}
      >
        {/* Segmented input row: value, clear X, calendar icon, Current Day link */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              height: 36,
              px: 1,
              border: '1px solid #404040',
              borderRadius: '8px',
              fontSize: 15,
              fontFamily: 'monospace',
              color: value ? '#000' : '#808080',
            }}
          >
            <Box sx={{ flex: 1 }}>{value ? format(value, 'dd/MM/yyyy') : 'DD/MM/YYYY'}</Box>
            <IconButton size="small" onClick={() => onChange(null)} sx={{ p: 0.25 }}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
            <CalendarIcon sx={{ fontSize: 16, ml: 0.5, color: '#676b72' }} />
          </Box>
          <Typography
            onClick={() => handlePick(new Date())}
            sx={{ fontSize: 14, color: '#0284c7', cursor: 'pointer', whiteSpace: 'nowrap', '&:hover': { textDecoration: 'underline' } }}
          >
            Current Day
          </Typography>
        </Box>
        {/* Dual month calendar, Monday start */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <IconButton size="small" onClick={() => setViewMonth(addMonths(viewMonth, -1))}>
            <KeyboardArrowLeft />
          </IconButton>
          {renderMonth(viewMonth)}
          {renderMonth(addMonths(viewMonth, 1))}
          <IconButton size="small" onClick={() => setViewMonth(addMonths(viewMonth, 1))}>
            <KeyboardArrowRight />
          </IconButton>
        </Box>
      </Popover>
    </>
  );
};

const CreateOrder = () => {
  const navigate = useNavigate();
  const { user, getOutletName } = useAuth();
  const { selectedOutlet } = useSelectedOutlet();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [orderNumber, setOrderNumber] = useState('');
  const [outlet, setOutlet] = useState(null);

  const [formData, setFormData] = useState({
    from: 'all',
    to: '',
    orderDate: new Date(),
    dueDate: null,
    internalReference: '',
    publicNotes: '',
    internalNotes: '',
    generateStockFrom: 'none',
  });

  // Generate-stock config revealed when Generate Stock From !== None (Shopfront parity)
  const [genConfig, setGenConfig] = useState({
    analysePeriod: '',
    analyseUnit: 'weeks',
    orderPeriod: '',
    orderUnit: 'weeks',
    matchLastSupplier: false,
    includeTransfers: false,
    subtractOnOrder: false,
    categories: [],
  });
  const [categoryOptions, setCategoryOptions] = useState([]);

  useEffect(() => {
    if (formData.generateStockFrom !== 'none' && categoryOptions.length === 0) {
      classificationService
        .getClassifications({ type: 'CATEGORY' })
        .then((res) => setCategoryOptions(res.classifications || []))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.generateStockFrom]);

  const handleGenConfigChange = (field, value) => {
    setGenConfig((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    if (user) {
      loadInitialData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Keep "To" in sync with the outlet picked in the navbar (super admins)
  useEffect(() => {
    if (user?.isSuperAdmin && selectedOutlet) {
      setFormData(prev => ({ ...prev, to: String(selectedOutlet.id) }));
    }
  }, [selectedOutlet, user]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load suppliers
      try {
        const suppliersResponse = await supplierService.getSuppliers();
        setSuppliers(suppliersResponse.suppliers || []);
      } catch (supplierErr) {
        console.error('Error loading suppliers:', supplierErr);
        setError('Failed to load suppliers');
      }

      // Load outlets depending on role
      try {
        if (user?.isSuperAdmin) {
          const outletsResp = await outletService.getAllOutlets();
          const all = outletsResp.outlets || [];
          setOutlets(all);
          if (!formData.to && all.length > 0) {
            setFormData(prev => ({ ...prev, to: String(selectedOutlet?.id ?? all[0].id) }));
          }
        } else {
          await loadUserOutlet();
        }
      } catch (outletErr) {
        console.error('Error loading outlet(s):', outletErr);
        if (!user?.isSuperAdmin && !outlet) {
          setError('Failed to load outlet information');
        }
      }

      // Generate order number
      try {
        const orderNumberResponse = await orderInvoiceService.generateOrderNumber();
        setOrderNumber(orderNumberResponse.orderNumber);
      } catch (orderNumErr) {
        console.error('Error generating order number:', orderNumErr);
        setError('Failed to generate order number');
      }

    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load initial data');
      console.error('Error loading initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUserOutlet = async () => {
    try {
      // First check if outlet is already in user object
      if (user?.outlet) {
        setOutlet(user.outlet);
      } else if (user?.outletId) {
        // Try to get outlet from profile endpoint
        try {
          const profileResponse = await outletService.getCurrentOutlet();
          if (profileResponse?.user?.outlet) {
            setOutlet(profileResponse.user.outlet);
          }
        } catch {
          if (user?.isSuperAdmin && user?.outletId) {
            try {
              const response = await outletService.getOutletById(user.outletId);
              if (response.outlet) {
                setOutlet(response.outlet);
              }
            } catch (outletErr) {
              console.error('Error loading outlet by ID:', outletErr);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error loading user outlet:', err);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation by role
    if (user?.isSuperAdmin) {
      if (!formData.to) {
        setError('Please select an outlet');
        return;
      }
    } else {
      if (!outlet) {
        setError('Outlet information not available');
        return;
      }
      if (formData.to === undefined || formData.to === null) {
        handleInputChange('to', '');
      }
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const orderData = {
        ...formData,
        orderNumber,
        type: 'ORDER',
        status: 'PENDING',
        totalAmount: 0, // Will be calculated from items
        items: [], // Empty items array for now
      };

      // Attach generate-stock options when a generation mode is selected
      if (formData.generateStockFrom !== 'none') {
        orderData.generateOptions = {
          ...genConfig,
          categories: genConfig.categories.map((c) => c.id),
        };
      }

      // For super admin, interpret "to" as outlet selection and send outletId
      if (user?.isSuperAdmin) {
        orderData.outletId = formData.to ? parseInt(formData.to, 10) : null;
        orderData.to = ''; // ensure no customerId mapping on backend
      }

      const response = await orderInvoiceService.createOrderInvoice(orderData);
      setSuccess('Order created successfully!');

      // Redirect to edit page to add products
      setTimeout(() => {
        navigate(`/orders-invoices/${response.orderInvoice.id}/edit`);
      }, 500);

    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create order');
      console.error('Error creating order:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  // 'All Suppliers' is only the empty-selection placeholder, never a listed option
  const supplierOptions = suppliers.map((s) => ({ id: String(s.id), name: s.name }));
  const selectedSupplier = supplierOptions.find((o) => o.id === String(formData.from)) || null;

  return (
    <Box>
      {/* Banner band across the top of the content area: ~110px, title vertically centered
          and left-aligned to the centered 764px form column. No negative margins — the
          layout Main has no padding, negatives caused a horizontal body scrollbar. */}
      <Box sx={{ backgroundColor: '#e2e8f0', mb: 6.5, px: 3, minHeight: 110, display: 'flex', alignItems: 'center' }}>
        <Box sx={{ maxWidth: 764, mx: 'auto', width: '100%' }}>
          <Typography component="h1" sx={{ fontSize: 20, fontWeight: 700, color: '#000' }}>
            Create Order
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, maxWidth: 764, mx: 'auto' }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3, maxWidth: 764, mx: 'auto' }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Form: centered 764px column, 40px between field groups (reference rhythm) */}
      <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 764, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 5, pb: 12 }}>
        {/* From (supplier combobox) */}
        <Box>
          <FieldLabel>From</FieldLabel>
          <Autocomplete
            options={supplierOptions}
            value={selectedSupplier}
            // Supplier names are not unique: key options by id or MUI falls back to the
            // label and same-named suppliers collide (duplicate-key warning + stale options)
            getOptionKey={(o) => o.id}
            getOptionLabel={(o) => o.name}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            onChange={(e, newValue) => {
              if (newValue) {
                handleInputChange('from', newValue.id);
              }
            }}
            disableClearable
            componentsProps={{
              popper: { sx: { '& .MuiAutocomplete-paper': { borderRadius: '8px' } } },
            }}
            ListboxProps={{
              sx: {
                '& .MuiAutocomplete-option': { minHeight: 45, fontSize: 16 },
                '& .MuiAutocomplete-option.Mui-focused': { backgroundColor: 'rgb(125,211,252)', color: '#000' },
                '& .MuiAutocomplete-option[aria-selected="true"]': { backgroundColor: 'rgb(125,211,252)', color: '#000' },
                '& .MuiAutocomplete-option[aria-selected="true"].Mui-focused': { backgroundColor: 'rgb(125,211,252)', color: '#000' },
              },
            }}
            renderInput={(params) => (
              <TextField {...params} placeholder="All Suppliers" sx={fieldSx} />
            )}
          />
        </Box>

        {/* To (outlet) */}
        <Box>
          <FieldLabel>To</FieldLabel>
          {/* ponytail: reference locks the To outlet; formData.to still auto-set to first outlet for super admins on load */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              height: 42,
              px: 1.5,
              border: '1px solid #404040',
              borderRadius: '8px',
              backgroundColor: '#d3d3d3',
              cursor: 'not-allowed',
              fontSize: 16,
              color: '#000',
            }}
          >
            <Box sx={{ flex: 1 }}>
              {(user?.isSuperAdmin
                ? outlets.find((o) => String(o.id) === String(formData.to))?.name
                : outlet?.name) || getOutletName() || 'N/A'}
            </Box>
            <ArrowDropDownIcon sx={{ color: '#676b72' }} />
          </Box>
        </Box>

        {/* Order Date */}
        <Box>
          <FieldLabel>Order Date</FieldLabel>
          <ShopfrontDatePicker
            value={formData.orderDate}
            onChange={(newValue) => handleInputChange('orderDate', newValue)}
          />
        </Box>

        {/* Order Number */}
        <Box>
          <FieldLabel>Order Number</FieldLabel>
          <TextField
            fullWidth
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            sx={fieldSx}
          />
        </Box>

        {/* Due Date */}
        <Box>
          <FieldLabel>Due Date</FieldLabel>
          <ShopfrontDatePicker
            value={formData.dueDate}
            onChange={(newValue) => handleInputChange('dueDate', newValue)}
          />
        </Box>

        {/* Internal Reference */}
        <Box>
          <FieldLabel>Internal Reference</FieldLabel>
          <TextField
            fullWidth
            value={formData.internalReference}
            onChange={(e) => handleInputChange('internalReference', e.target.value)}
            sx={fieldSx}
          />
        </Box>

        {/* Public Notes */}
        <Box>
          <FieldLabel>Public Notes</FieldLabel>
          <TextField
            fullWidth
            value={formData.publicNotes}
            onChange={(e) => handleInputChange('publicNotes', e.target.value)}
            multiline
            rows={5}
            sx={textareaSx}
          />
        </Box>

        {/* Internal Notes */}
        <Box>
          <FieldLabel>Internal Notes</FieldLabel>
          <TextField
            fullWidth
            value={formData.internalNotes}
            onChange={(e) => handleInputChange('internalNotes', e.target.value)}
            multiline
            rows={5}
            sx={textareaSx}
          />
        </Box>

        {/* Generate section */}
        <Divider sx={{ mt: 1 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SettingsOutlinedIcon sx={{ fontSize: 22, color: '#000' }} />
          <Typography component="h2" sx={{ fontSize: 20, fontWeight: 700, color: '#000' }}>
            Generate
          </Typography>
        </Box>

        {/* Generate Stock From */}
        <Box>
          <FieldLabel>Generate Stock From</FieldLabel>
          <FormControl fullWidth>
            <Select
              value={formData.generateStockFrom}
              onChange={(e) => handleInputChange('generateStockFrom', e.target.value)}
              IconComponent={ArrowDropDownIcon}
              MenuProps={selectMenuProps}
              sx={{
                height: 42,
                borderRadius: '8px',
                fontSize: 16,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
              }}
            >
              <MenuItem value="none">None</MenuItem>
              <MenuItem value="reorder_points">Reorder Points</MenuItem>
              <MenuItem value="sales">Sales</MenuItem>
              <MenuItem value="sales_reorder_points">Sales &amp; Reorder Points</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Conditional generate-stock config (Shopfront parity) */}
        {formData.generateStockFrom !== 'none' && (
          <>
            {formData.generateStockFrom !== 'reorder_points' && (
              <>
                <Box>
                  <FieldLabel>Period of time to analyse sales for</FieldLabel>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      type="number"
                      value={genConfig.analysePeriod}
                      onChange={(e) => handleGenConfigChange('analysePeriod', e.target.value)}
                      sx={{ ...fieldSx, flex: 1 }}
                    />
                    <FormControl sx={{ flex: 1 }}>
                      <Select
                        value={genConfig.analyseUnit}
                        onChange={(e) => handleGenConfigChange('analyseUnit', e.target.value)}
                        IconComponent={ArrowDropDownIcon}
                        MenuProps={selectMenuProps}
                        sx={unitSelectSx}
                      >
                        <MenuItem value="days">Days</MenuItem>
                        <MenuItem value="weeks">Weeks</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                </Box>
                <Box>
                  <FieldLabel>Period of time to order stock for</FieldLabel>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      type="number"
                      value={genConfig.orderPeriod}
                      onChange={(e) => handleGenConfigChange('orderPeriod', e.target.value)}
                      sx={{ ...fieldSx, flex: 1 }}
                    />
                    <FormControl sx={{ flex: 1 }}>
                      <Select
                        value={genConfig.orderUnit}
                        onChange={(e) => handleGenConfigChange('orderUnit', e.target.value)}
                        IconComponent={ArrowDropDownIcon}
                        MenuProps={selectMenuProps}
                        sx={unitSelectSx}
                      >
                        <MenuItem value="days">Days</MenuItem>
                        <MenuItem value="weeks">Weeks</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                </Box>
              </>
            )}

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <ShopfrontSwitch
                  checked={genConfig.matchLastSupplier}
                  onChange={(e) => handleGenConfigChange('matchLastSupplier', e.target.checked)}
                />
                <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#000' }}>
                  Match Using Last Supplier
                </Typography>
              </Box>
              <Typography sx={{ fontSize: 14, color: '#676b72', mt: 0.5 }}>
                The core supplier will be used when matching the products
              </Typography>
            </Box>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <ShopfrontSwitch
                  checked={genConfig.includeTransfers}
                  onChange={(e) => handleGenConfigChange('includeTransfers', e.target.checked)}
                />
                <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#000' }}>
                  Include Transfers
                </Typography>
              </Box>
              <Typography sx={{ fontSize: 14, color: '#676b72', mt: 0.5 }}>
                No transfers will be included in the analysis
              </Typography>
            </Box>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <ShopfrontSwitch
                  checked={genConfig.subtractOnOrder}
                  onChange={(e) => handleGenConfigChange('subtractOnOrder', e.target.checked)}
                />
                <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#000' }}>
                  Subtract Stock Currently On Order
                </Typography>
              </Box>
              <Typography sx={{ fontSize: 14, color: '#676b72', mt: 0.5 }}>
                Products currently on order will not be taken into account during analysis
              </Typography>
            </Box>

            <Box>
              <FieldLabel>Categories</FieldLabel>
              <Autocomplete
                multiple
                options={categoryOptions}
                value={genConfig.categories}
                getOptionLabel={(o) => o.name}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                onChange={(e, newValue) => handleGenConfigChange('categories', newValue)}
                componentsProps={{
                  popper: { sx: { '& .MuiAutocomplete-paper': { borderRadius: '8px' } } },
                }}
                ListboxProps={{
                  sx: {
                    '& .MuiAutocomplete-option': { minHeight: 45, fontSize: 16 },
                    '& .MuiAutocomplete-option.Mui-focused': { backgroundColor: 'rgb(125,211,252)', color: '#000' },
                    '& .MuiAutocomplete-option[aria-selected="true"]': { backgroundColor: 'rgb(125,211,252)', color: '#000' },
                    '& .MuiAutocomplete-option[aria-selected="true"].Mui-focused': { backgroundColor: 'rgb(125,211,252)', color: '#000' },
                  },
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={genConfig.categories.length === 0 ? 'Select...' : ''}
                    sx={{
                      ...fieldSx,
                      '& .MuiOutlinedInput-root': {
                        ...fieldSx['& .MuiOutlinedInput-root'],
                        height: 'auto',
                        minHeight: 42,
                      },
                    }}
                  />
                )}
              />
              <Typography sx={{ fontSize: 14, color: '#676b72', mt: 0.5 }}>
                Using a category filter will only filter the generation, not prevent items outside the category from being ordered
              </Typography>
            </Box>
          </>
        )}

        {/* Create button: fixed bottom-right of viewport */}
        <Button
          type="submit"
          disabled={saving}
          disableRipple
          sx={{
            position: 'fixed',
            right: 48,
            bottom: 24,
            width: 116,
            height: 42,
            backgroundColor: '#5ebbeb',
            color: '#fff',
            borderRadius: '12px',
            fontSize: 16,
            fontWeight: 700,
            textTransform: 'none',
            boxShadow: 'none',
            transition: 'none',
            zIndex: 10,
            '&:hover': { backgroundColor: '#0ea5e9', boxShadow: 'none' },
            '&.Mui-disabled': { backgroundColor: '#404040', color: '#737373' },
          }}
        >
          {saving ? 'Creating...' : 'Create'}
        </Button>
      </Box>
    </Box>
  );
};

export default CreateOrder;
