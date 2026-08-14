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
  InputAdornment,
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

// Same Shopfront-style dual-month date picker as CreateReturn
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

const CreateCreditNote = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [receivedInvoices, setReceivedInvoices] = useState([]);

  const [formData, setFormData] = useState({
    supplierId: '',
    linkedInvoiceId: '',
    orderNumber: '',
    orderDate: new Date(),
    amount: '',
    internalReference: '',
    publicNotes: '',
    internalNotes: '',
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const [suppliersResponse, numberResponse] = await Promise.all([
          supplierService.getSuppliers(),
          orderInvoiceService.generateOrderNumber('CREDIT_NOTE').catch(() => null),
        ]);
        setSuppliers(suppliersResponse.suppliers || []);
        if (numberResponse?.orderNumber) {
          setFormData(prev => ({ ...prev, orderNumber: numberResponse.orderNumber }));
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load initial data');
        console.error('Error loading initial data:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // Received invoices for the selected supplier (optional linked invoice)
  useEffect(() => {
    const supplierId = parseInt(formData.supplierId, 10);
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
  }, [formData.supplierId]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const supplierId = parseInt(formData.supplierId, 10);
    if (isNaN(supplierId) || !suppliers.some(s => s.id === supplierId)) {
      setError('Please select a supplier');
      return;
    }

    const amount = parseFloat(formData.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Please enter an amount greater than 0');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const creditNoteData = {
        from: String(supplierId), // backend maps this to supplierId
        to: '',
        orderDate: formData.orderDate,
        orderNumber: formData.orderNumber,
        dueDate: null,
        internalReference: formData.internalReference,
        publicNotes: formData.publicNotes,
        internalNotes: formData.internalNotes,
        generateStockFrom: 'none',
        linkedInvoiceId: formData.linkedInvoiceId ? parseInt(formData.linkedInvoiceId, 10) : null,
        type: 'CREDIT_NOTE',
        status: 'PENDING',
        totalAmount: amount,
        items: [],
      };

      await orderInvoiceService.createOrderInvoice(creditNoteData);
      setSuccess('Credit note created successfully!');
      setTimeout(() => navigate('/orders-invoices'), 500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create credit note');
      console.error('Error creating credit note:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  const supplierOptions = suppliers.map((s) => ({ id: String(s.id), name: s.name }));
  const selectedSupplier = supplierOptions.find((o) => o.id === String(formData.supplierId)) || null;

  const invoiceOptions = receivedInvoices.map((oi) => ({
    id: String(oi.id),
    name: `${oi.orderNumber} — ${oi.orderDate ? format(new Date(oi.orderDate), 'dd/MM/yyyy') : ''}`,
  }));
  const selectedInvoice = invoiceOptions.find((o) => o.id === String(formData.linkedInvoiceId)) || null;

  return (
    <Box>
      {/* Full-width light band header, title left-aligned to the centered form column */}
      <Box sx={{ backgroundColor: '#e2e8f0', mb: 6.5, px: 3, minHeight: 110, display: 'flex', alignItems: 'center' }}>
        <Box sx={{ maxWidth: 625, mx: 'auto', width: '100%' }}>
          <Typography component="h1" sx={{ fontSize: 20, fontWeight: 700, color: '#000' }}>
            Create Credit Note
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
        {/* Supplier (required) with red warning triangle when empty */}
        <Box>
          <FieldLabel>Supplier</FieldLabel>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {!formData.supplierId && (
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
                  setFormData(prev => ({ ...prev, supplierId: newValue.id, linkedInvoiceId: '' }));
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

        {/* Linked Invoice (optional, RECEIVED docs of the selected supplier) */}
        <Box>
          <FieldLabel>Linked Invoice</FieldLabel>
          <Autocomplete
            options={invoiceOptions}
            value={selectedInvoice}
            getOptionLabel={(o) => o.name}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            onChange={(e, newValue) => {
              handleInputChange('linkedInvoiceId', newValue ? newValue.id : '');
            }}
            disabled={!formData.supplierId}
            noOptionsText="No Options"
            componentsProps={{ popper: comboPopperProps }}
            ListboxProps={comboListboxProps}
            renderInput={(params) => (
              <TextField {...params} placeholder="Select Received Invoice..." sx={fieldSx} />
            )}
          />
        </Box>

        {/* Credit Note Number */}
        <Box>
          <FieldLabel>Credit Note Number</FieldLabel>
          <TextField
            fullWidth
            value={formData.orderNumber}
            onChange={(e) => handleInputChange('orderNumber', e.target.value)}
            sx={fieldSx}
          />
        </Box>

        {/* Date */}
        <Box>
          <FieldLabel>Date</FieldLabel>
          <ShopfrontDatePicker
            value={formData.orderDate}
            onChange={(newValue) => handleInputChange('orderDate', newValue)}
          />
        </Box>

        {/* Amount */}
        <Box>
          <FieldLabel>Amount</FieldLabel>
          <TextField
            fullWidth
            type="number"
            inputProps={{ min: 0, step: '0.01' }}
            value={formData.amount}
            onChange={(e) => handleInputChange('amount', e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            sx={fieldSx}
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

export default CreateCreditNote;
