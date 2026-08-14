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
  ArrowDropDown as ArrowDropDownIcon,
  KeyboardArrowLeft,
  KeyboardArrowRight,
} from '@mui/icons-material';
import { format, parse, isValid, addMonths, startOfMonth, endOfMonth, isSameDay, isSameMonth } from 'date-fns';
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
  const [text, setText] = useState('');

  const open = Boolean(anchorEl);

  const handleOpen = (e) => {
    setViewMonth(startOfMonth(value || new Date()));
    setText(value ? format(value, 'dd/MM/yyyy') : '');
    setAnchorEl(e.currentTarget);
  };

  // Editable dd/MM/yyyy text input at top of picker (reference parity)
  const handleTextChange = (e) => {
    const t = e.target.value;
    setText(t);
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(t)) {
      const parsed = parse(t, 'dd/MM/yyyy', new Date());
      if (isValid(parsed)) {
        onChange(parsed);
        setViewMonth(startOfMonth(parsed));
      }
    }
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
            <Box
              component="input"
              value={text}
              placeholder="DD/MM/YYYY"
              onChange={handleTextChange}
              sx={{
                flex: 1,
                minWidth: 0,
                border: 'none',
                outline: 'none',
                fontSize: 15,
                fontFamily: 'monospace',
                color: '#000',
                '&::placeholder': { color: '#808080', opacity: 1 },
              }}
            />
            <IconButton size="small" onClick={() => { onChange(null); setText(''); }} sx={{ p: 0.25 }}>
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

const CreateReceiveStock = () => {
  const navigate = useNavigate();
  const { user, getOutletName } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [outlet, setOutlet] = useState(null);

  const [formData, setFormData] = useState({
    from: '',
    to: '',
    receiveDate: new Date(),
    referenceNumber: '',
    dueDate: null,
    internalReference: '',
    publicNotes: '',
    internalNotes: '',
  });

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

      try {
        if (user?.isSuperAdmin) {
          const outletsResp = await outletService.getAllOutlets();
          const all = outletsResp.outlets || [];
          setOutlets(all);
          if (all.length > 0 && !formData.to) {
            setFormData(prev => ({ ...prev, to: String(all[0].id) }));
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
      if (user?.outlet) {
        setOutlet(user.outlet);
        setFormData(prev => ({ ...prev, to: String(user.outlet.id) }));
      } else if (user?.outletId) {
        try {
          const profileResponse = await outletService.getCurrentOutlet();
          if (profileResponse?.user?.outlet) {
            setOutlet(profileResponse.user.outlet);
            setFormData(prev => ({ ...prev, to: String(profileResponse.user.outlet.id) }));
          }
        } catch {
          if (user?.isSuperAdmin && user?.outletId) {
            try {
              const response = await outletService.getOutletById(user.outletId);
              if (response.outlet) {
                setOutlet(response.outlet);
                setFormData(prev => ({ ...prev, to: String(response.outlet.id) }));
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

  // Inline supplier creation from the From combobox 'Create "<text>" option...' row
  const handleCreateSupplier = async (name) => {
    try {
      const response = await supplierService.createSupplier({ name });
      const created = response.supplier || response;
      if (created?.id) {
        setSuppliers(prev => [...prev, created]);
        handleInputChange('from', String(created.id));
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create supplier');
      console.error('Error creating supplier:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.from) {
      setError('Please select a supplier (From)');
      return;
    }

    if (!formData.to) {
      setError('Please select an outlet (To)');
      return;
    }

    if (!formData.receiveDate) {
      setError('Please select an invoice date');
      return;
    }

    const outletId = parseInt(formData.to, 10);
    const supplierId = parseInt(formData.from, 10);

    if (isNaN(outletId)) {
      setError('Invalid outlet selected');
      return;
    }

    if (isNaN(supplierId)) {
      setError('Invalid supplier selected');
      return;
    }

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
      // Receive Stock creates an INVOICE document (not an ORDER) so it lists and
      // filters as an invoice; the receive flow accepts both types.
      const orderData = {
        from: formData.from,
        to: formData.to,
        orderDate: formData.receiveDate,
        orderNumber: formData.referenceNumber || '',
        dueDate: formData.dueDate,
        internalReference: formData.internalReference,
        publicNotes: formData.publicNotes,
        internalNotes: formData.internalNotes,
        generateStockFrom: 'none',
        type: 'INVOICE',
        status: 'PENDING',
        totalAmount: 0,
        items: [], // Empty items array - will be added in edit page
        outletId: outletId,
      };

      const response = await orderInvoiceService.createOrderInvoice(orderData);

      setSuccess('Invoice created! Please add products and then click "Receive" to add stock to inventory.');
      setTimeout(() => {
        navigate(`/orders-invoices/${response.orderInvoice.id}/edit`);
      }, 1500);

    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create invoice');
      console.error('Error creating invoice:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  const supplierOptions = suppliers.map((s) => ({ id: String(s.id), name: s.name }));
  const selectedSupplier = supplierOptions.find((o) => o.id === String(formData.from)) || null;

  return (
    <Box>
      {/* Banner band across the top of the content area: title vertically centered
          and left-aligned to the centered 764px form column. */}
      <Box sx={{ backgroundColor: '#e8eef7', mb: 6.5, px: 3, minHeight: 110, display: 'flex', alignItems: 'center' }}>
        <Box sx={{ maxWidth: 764, mx: 'auto', width: '100%' }}>
          <Typography component="h1" sx={{ fontSize: 20, fontWeight: 700, color: '#000' }}>
            Create Invoice
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
        {/* From (supplier combobox with inline create) */}
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
              if (newValue?.isCreate) {
                handleCreateSupplier(newValue.inputValue);
              } else if (newValue) {
                handleInputChange('from', newValue.id);
              }
            }}
            filterOptions={(options, state) => {
              const input = state.inputValue.trim().toLowerCase();
              const filtered = options.filter((o) => o.name.toLowerCase().includes(input));
              if (input && !options.some((o) => o.name.toLowerCase() === input)) {
                filtered.push({
                  id: '__create__',
                  name: `Create "${state.inputValue}" option...`,
                  inputValue: state.inputValue.trim(),
                  isCreate: true,
                });
              }
              return filtered;
            }}
            disableClearable
            componentsProps={{
              popper: { sx: { '& .MuiAutocomplete-paper': { borderRadius: 0, boxShadow: 'none', border: '1px solid #404040' } } },
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
              <TextField {...params} placeholder="Select Supplier..." sx={fieldSx} />
            )}
          />
        </Box>

        {/* To (outlet, locked to current outlet) */}
        <Box>
          <FieldLabel>To</FieldLabel>
          {/* ponytail: reference locks the To outlet; formData.to still auto-set on load */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              height: 42,
              px: 1.5,
              border: '1px solid #404040',
              borderRadius: '8px',
              backgroundColor: '#dedede',
              cursor: 'not-allowed',
              fontSize: 16,
              color: '#676b72',
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

        {/* Invoice Date */}
        <Box>
          <FieldLabel>Invoice Date</FieldLabel>
          <ShopfrontDatePicker
            value={formData.receiveDate}
            onChange={(newValue) => handleInputChange('receiveDate', newValue)}
          />
        </Box>

        {/* Invoice Number */}
        <Box>
          <FieldLabel>Invoice Number</FieldLabel>
          <TextField
            fullWidth
            value={formData.referenceNumber}
            onChange={(e) => handleInputChange('referenceNumber', e.target.value)}
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

export default CreateReceiveStock;
