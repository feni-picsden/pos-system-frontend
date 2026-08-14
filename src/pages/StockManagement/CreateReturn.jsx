import React, { useState, useEffect } from 'react';
import PageLoader from '../../components/Common/PageLoader';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Autocomplete,
  Popover,
  IconButton,
} from '@mui/material';
import {
  Close as CloseIcon,
  CalendarTodayOutlined as CalendarIcon,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  ReportProblemOutlined as WarningIcon,
} from '@mui/icons-material';
import { format, addMonths, startOfMonth, endOfMonth, isSameDay, isSameMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import orderInvoiceService from '../../services/orderInvoiceService';
import supplierService from '../../services/supplierService';
import { outletService } from '../../services/outletService';
import { useAuth } from '../../contexts/AuthContext';

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
    minHeight: 138,
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

// Reference combobox panel: white bg, 1px solid #000 border, radius 8px, max-h 288px;
// option rows 16px padding, hover #7dd3fc, selected option sky text on transparent bg
const comboPopperProps = {
  sx: {
    '& .MuiAutocomplete-paper': {
      borderRadius: '8px',
      border: '1px solid #000',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    },
    '& .MuiAutocomplete-listbox': { maxHeight: 288 },
    '& .MuiAutocomplete-noOptions': { fontSize: 16, padding: '16px' },
  },
};

const comboListboxProps = {
  sx: {
    '& .MuiAutocomplete-option': { minHeight: 56, fontSize: 16, padding: '16px' },
    '& .MuiAutocomplete-option.Mui-focused': { backgroundColor: 'rgb(125,211,252)', color: '#000' },
    '& .MuiAutocomplete-option[aria-selected="true"]': { backgroundColor: 'transparent', color: '#0ea5e9' },
    '& .MuiAutocomplete-option[aria-selected="true"].Mui-focused': { backgroundColor: 'rgb(125,211,252)', color: '#000' },
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
        sx={{ ...fieldSx, '& .MuiOutlinedInput-input': { cursor: 'pointer' }, '& .MuiOutlinedInput-input::placeholder': { color: '#808080', opacity: 1, fontFamily: 'monospace' } }}
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

const CreateReturn = () => {
  const navigate = useNavigate();
  const { user, getOutletName } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [outlet, setOutlet] = useState(null);

  const [receivedInvoices, setReceivedInvoices] = useState([]);

  const [formData, setFormData] = useState({
    from: '', // Outlet ID
    to: '', // Supplier ID
    linkedInvoiceId: '', // Optional source received invoice
    returnCostBasis: 'BASE', // 'BASE' | 'BASE_FEES_FREIGHT'
    orderDate: new Date(),
    orderNumber: '',
    dueDate: null,
    internalReference: '',
    publicNotes: '',
    internalNotes: '',
  });

  // Received invoices for the selected supplier (optional "Received Invoice" link)
  useEffect(() => {
    const supplierId = parseInt(formData.to, 10);
    if (isNaN(supplierId)) {
      setReceivedInvoices([]);
      return;
    }
    orderInvoiceService
      .getOrdersInvoices({ statusFilter: 'RECEIVED' })
      .then((resp) => {
        setReceivedInvoices(
          (resp.ordersInvoices || []).filter(
            (oi) => oi.supplierId === supplierId && (oi.type === 'ORDER' || oi.type === 'INVOICE')
          )
        );
      })
      .catch(() => setReceivedInvoices([]));
  }, [formData.to]);

  useEffect(() => {
    if (user) {
      loadInitialData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load outlets for "From" field
      try {
        if (user?.isSuperAdmin) {
          const outletsResp = await outletService.getAllOutlets();
          const all = outletsResp.outlets || [];
          setOutlets(all);
          if (all.length > 0 && !formData.from) {
            setFormData(prev => ({ ...prev, from: String(all[0].id) }));
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

      // Load suppliers for "To" field
      try {
        const suppliersResponse = await supplierService.getSuppliers();
        setSuppliers(suppliersResponse.suppliers || []);
      } catch (supplierErr) {
        console.error('Error loading suppliers:', supplierErr);
        setError('Failed to load suppliers');
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
      // Prefer the server-authoritative outlet from the profile endpoint —
      // the backend saves the return against req.user.outletId, so a stale
      // outlet cached in the JWT/user object must not win.
      try {
        const profileResponse = await outletService.getCurrentOutlet();
        if (profileResponse?.user?.outlet) {
          setOutlet(profileResponse.user.outlet);
          setFormData(prev => ({ ...prev, from: String(profileResponse.user.outlet.id) }));
          return;
        }
      } catch {
        // fall through to cached user outlet
      }
      if (user?.outlet) {
        setOutlet(user.outlet);
        setFormData(prev => ({ ...prev, from: String(user.outlet.id) }));
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

    // Validation
    if (!formData.from) {
      setError('Please select an outlet (From)');
      return;
    }

    if (!formData.to) {
      setError('Please select a supplier (To)');
      return;
    }

    // Validate that IDs are valid numbers
    const outletId = parseInt(formData.from, 10);
    const supplierId = parseInt(formData.to, 10);

    if (isNaN(outletId)) {
      setError('Invalid outlet selected');
      return;
    }

    if (isNaN(supplierId)) {
      setError('Invalid supplier selected');
      return;
    }

    // Verify supplier exists in the loaded suppliers list
    const supplierExists = suppliers.some(s => s.id === supplierId);
    if (!supplierExists) {
      setError('Selected supplier does not exist');
      return;
    }

    // Verify outlet exists (for super admin) or matches user's outlet
    if (user?.isSuperAdmin) {
      const outletExists = outlets.some(o => o.id === outletId);
      if (!outletExists) {
        setError('Selected outlet does not exist');
        return;
      }
    } else if (outlet && outlet.id !== outletId) {
      setError('Invalid outlet selected');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // For returns: we're returning FROM outlet TO supplier
      // Backend expects: from = supplier ID (maps to supplierId), to = outlet ID or empty
      // Backend logic: supplierId = from !== 'all' ? parseInt(from) : null
      // Backend logic: customerId = (!isSuperAdmin && to) ? parseInt(to) : null
      // For returns, we want supplierId set, but customerId should be null
      // So we send: from = supplier ID, to = '' (empty) to avoid customerId being set

      const returnData = {
        from: String(supplierId), // Supplier ID as string (backend maps this to supplierId)
        to: '', // Empty string to avoid customerId being set on update
        orderDate: formData.orderDate,
        orderNumber: formData.orderNumber,
        dueDate: formData.dueDate,
        internalReference: formData.internalReference,
        publicNotes: formData.publicNotes,
        internalNotes: formData.internalNotes,
        generateStockFrom: 'none',
        linkedInvoiceId: formData.linkedInvoiceId ? parseInt(formData.linkedInvoiceId, 10) : null,
        returnCostBasis: formData.linkedInvoiceId ? formData.returnCostBasis : null,
        type: 'RETURN',
        status: 'PENDING',
        totalAmount: 0,
        items: [],
        outletId: outletId, // Explicitly set the outlet ID
      };

      const response = await orderInvoiceService.createOrderInvoice(returnData);
      setSuccess('Return created successfully!');

      // Redirect to edit page to add products
      setTimeout(() => {
        navigate(`/orders-invoices/${response.orderInvoice.id}/edit`);
      }, 500);

    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create return');
      console.error('Error creating return:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  // Searchable combobox option lists (Shopfront parity)
  const outletOptions = (user?.isSuperAdmin
    ? outlets
    : outlet
      ? [outlet]
      : []
  ).map((o) => ({ id: String(o.id), name: o.name || getOutletName() || 'N/A' }));
  const selectedOutlet = outletOptions.find((o) => o.id === String(formData.from)) || null;

  const supplierOptions = suppliers.map((s) => ({ id: String(s.id), name: s.name }));
  const selectedSupplier = supplierOptions.find((o) => o.id === String(formData.to)) || null;

  const invoiceOptions = receivedInvoices.map((oi) => ({
    id: String(oi.id),
    name: `${oi.orderNumber} — ${oi.orderDate ? format(new Date(oi.orderDate), 'dd/MM/yyyy') : ''}`,
  }));
  const selectedInvoice = invoiceOptions.find((o) => o.id === String(formData.linkedInvoiceId)) || null;

  const costBasisOptions = [
    { id: 'BASE', name: 'Base Cost Only' },
    { id: 'BASE_FEES_FREIGHT', name: 'Base + Fees + Freight' },
  ];
  const selectedCostBasis = costBasisOptions.find((o) => o.id === formData.returnCostBasis) || costBasisOptions[0];

  return (
    <Box>
      {/* Full-width light band header, title left-aligned to the centered form column */}
      <Box sx={{ backgroundColor: '#e2e8f0', mb: 6.5, px: 3, minHeight: 110, display: 'flex', alignItems: 'center' }}>
        <Box sx={{ maxWidth: 625, mx: 'auto', width: '100%' }}>
          <Typography component="h1" sx={{ fontSize: 20, fontWeight: 700, color: '#000' }}>
            Create Return
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, maxWidth: 625, mx: 'auto' }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3, maxWidth: 625, mx: 'auto' }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Form: centered 625px column directly on page background (no card) */}
      <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 625, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 5, pb: 12, px: 3 }}>
        {/* From (outlet combobox) */}
        <Box>
          <FieldLabel>From</FieldLabel>
          <Autocomplete
            options={outletOptions}
            value={selectedOutlet}
            getOptionLabel={(o) => o.name}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            onChange={(e, newValue) => {
              if (newValue) handleInputChange('from', newValue.id);
            }}
            disabled={!user?.isSuperAdmin && !outlet}
            disableClearable
            noOptionsText="No Options"
            componentsProps={{ popper: comboPopperProps }}
            ListboxProps={comboListboxProps}
            renderInput={(params) => (
              <TextField {...params} placeholder="Select Outlet..." sx={fieldSx} />
            )}
          />
        </Box>

        {/* To (supplier combobox) with red warning triangle when empty */}
        <Box>
          <FieldLabel>To</FieldLabel>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {!formData.to && (
              <WarningIcon sx={{ fontSize: 22, color: '#dc2626' }} />
            )}
            <Autocomplete
              sx={{ flex: 1 }}
              options={supplierOptions}
              value={selectedSupplier}
              // Supplier names are not unique: key options by id or MUI falls back to the
              // label and same-named suppliers collide (duplicate-key warning + stale options)
              getOptionKey={(o) => o.id}
              getOptionLabel={(o) => o.name}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              onChange={(e, newValue) => {
                if (newValue) {
                  // New supplier invalidates any previously linked invoice
                  setFormData(prev => ({ ...prev, to: newValue.id, linkedInvoiceId: '', returnCostBasis: 'BASE' }));
                  setError('');
                  setSuccess('');
                }
              }}
              disableClearable
              noOptionsText="No Options"
              componentsProps={{ popper: comboPopperProps }}
              ListboxProps={comboListboxProps}
              renderInput={(params) => (
                <TextField {...params} placeholder="Select Supplier..." sx={fieldSx} />
              )}
            />
          </Box>
        </Box>

        {/* Received Invoice (optional link to the source received invoice) */}
        <Box>
          <FieldLabel>Received Invoice</FieldLabel>
          <Autocomplete
            options={invoiceOptions}
            value={selectedInvoice}
            getOptionLabel={(o) => o.name}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            onChange={(e, newValue) => {
              setFormData(prev => ({
                ...prev,
                linkedInvoiceId: newValue ? newValue.id : '',
                ...(newValue ? {} : { returnCostBasis: 'BASE' }),
              }));
              setError('');
              setSuccess('');
            }}
            disabled={!formData.to}
            noOptionsText="No Options"
            componentsProps={{ popper: comboPopperProps }}
            ListboxProps={comboListboxProps}
            renderInput={(params) => (
              <TextField {...params} placeholder="Select Received Invoice..." sx={fieldSx} />
            )}
          />
        </Box>

        {/* Return Cost basis — only relevant when a received invoice is linked */}
        {formData.linkedInvoiceId && (
          <Box>
            <FieldLabel>Return Cost</FieldLabel>
            <Autocomplete
              options={costBasisOptions}
              value={selectedCostBasis}
              getOptionLabel={(o) => o.name}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              onChange={(e, newValue) => {
                if (newValue) handleInputChange('returnCostBasis', newValue.id);
              }}
              disableClearable
              noOptionsText="No Options"
              componentsProps={{ popper: comboPopperProps }}
              ListboxProps={comboListboxProps}
              renderInput={(params) => (
                <TextField {...params} sx={fieldSx} />
              )}
            />
          </Box>
        )}

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
            value={formData.orderNumber}
            onChange={(e) => handleInputChange('orderNumber', e.target.value)}
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

export default CreateReturn;
