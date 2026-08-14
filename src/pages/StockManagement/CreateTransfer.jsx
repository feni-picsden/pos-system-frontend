import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  FormControl,
  Select,
  MenuItem,
  Autocomplete,
  Popover,
  IconButton,
} from '@mui/material';
import {
  Close as CloseIcon,
  CalendarTodayOutlined as CalendarIcon,
  ArrowDropDown as ArrowDropDownIcon,
  Warning as WarningIcon,
  KeyboardArrowLeft,
  KeyboardArrowRight,
} from '@mui/icons-material';
import { format, addMonths, startOfMonth, endOfMonth, isSameDay, isSameMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import orderInvoiceService from '../../services/orderInvoiceService';
import { outletService } from '../../services/outletService';
import transfereeService from '../../services/transfereeService';
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

// Reference dropdown panel: white, 1px #000 border, radius 8, no shadow, instant open;
// selected/hovered option renders sky-blue TEXT on transparent bg
const selectMenuProps = {
  TransitionProps: { timeout: 0 },
  anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
  transformOrigin: { vertical: 'top', horizontal: 'left' },
  PaperProps: {
    sx: {
      border: '1px solid #000',
      borderRadius: '8px',
      boxShadow: 'none',
      backgroundColor: '#fff',
      '& .MuiMenuItem-root': { fontSize: 16 },
      '& .MuiMenuItem-root:hover': { backgroundColor: 'transparent', color: '#38a8e8' },
      '& .MuiMenuItem-root.Mui-selected': { backgroundColor: 'transparent', color: '#38a8e8' },
      '& .MuiMenuItem-root.Mui-selected:hover': { backgroundColor: 'transparent', color: '#38a8e8' },
      '& .MuiMenuItem-root.Mui-selected.Mui-focusVisible': { backgroundColor: 'transparent', color: '#38a8e8' },
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
// DD/MM/YYYY format, Current Day shortcut, clear (X), 38x38 #38a8e8 rounded-square (r12) selection
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
      <Box sx={{ width: 278 }}>
        <Typography sx={{ textAlign: 'center', fontWeight: 700, fontSize: 14, mb: 1 }}>
          {format(month, 'MMMM yyyy')}
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 38px)', gap: '2px' }}>
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
                  width: 38,
                  height: 38,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  cursor: inMonth ? 'pointer' : 'default',
                  borderRadius: '12px',
                  backgroundColor: selected ? '#38a8e8' : 'transparent',
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
            sx={{ fontSize: 14, color: '#676b72', cursor: 'pointer', whiteSpace: 'nowrap', '&:hover': { textDecoration: 'underline' } }}
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

const CreateTransfer = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [outlets, setOutlets] = useState([]);
  const [transferees, setTransferees] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [transferNumber, setTransferNumber] = useState('');
  const [toTouched, setToTouched] = useState(false);

  const [formData, setFormData] = useState({
    fromOutletId: '',
    toOutletId: '',
    transferDate: new Date(),
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

      // Load outlets
      try {
        const outletsResp = await outletService.getAllOutlets();
        const all = outletsResp.outlets || [];
        setOutlets(all);
        if (user?.isSuperAdmin && all.length > 0) {
          setFormData(prev => ({ ...prev, fromOutletId: String(all[0].id) }));
        } else if (user?.outletId) {
          setFormData(prev => ({ ...prev, fromOutletId: String(user.outletId) }));
        }
      } catch (err) {
        console.error('Error loading outlets:', err);
      }

      // Load transferees
      try {
        const transfereesResp = await transfereeService.getTransferees({ activeOnly: true });
        setTransferees(transfereesResp.transferees || []);
      } catch (err) {
        console.error('Error loading transferees:', err);
      }

      // Load vendor connections (suppliers you can transfer to)
      try {
        const suppliersResp = await supplierService.getSuppliers();
        setVendors(suppliersResp.suppliers || []);
      } catch (err) {
        console.error('Error loading vendor connections:', err);
      }

      // Generate transfer number
      try {
        const resp = await orderInvoiceService.generateOrderNumber('TRANSFER');
        setTransferNumber(resp.orderNumber);
      } catch (err) {
        console.error('Error generating transfer number:', err);
        setTransferNumber(`TRF-${Date.now()}`);
      }
    } catch {
      setError('Failed to load initial data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.fromOutletId) {
      setError('Please select a From outlet');
      return;
    }
    if (!formData.toOutletId) {
      setToTouched(true);
      setError('Please select a To destination');
      return;
    }
    if (!formData.transferDate) {
      setError('Please select a transfer date');
      return;
    }
    const toIsOutlet = !/^(transferee|vendor):/.test(String(formData.toOutletId));
    if (toIsOutlet && formData.fromOutletId === formData.toOutletId) {
      setError('You cannot send and receive from the same place');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const orderData = {
        from: formData.fromOutletId,
        to: formData.toOutletId,
        orderDate: formData.transferDate,
        orderNumber: transferNumber,
        dueDate: formData.dueDate,
        internalReference: formData.internalReference,
        publicNotes: formData.publicNotes,
        internalNotes: formData.internalNotes,
        generateStockFrom: 'none',
        items: [],
        totalAmount: 0,
        type: 'TRANSFER',
        status: 'OPEN',
        outletId: parseInt(formData.fromOutletId),
      };

      const response = await orderInvoiceService.createOrderInvoice(orderData);
      setTimeout(() => {
        navigate(`/orders-invoices/${response.orderInvoice.id}/edit`);
      }, 300);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create transfer');
      console.error('Error creating transfer:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Grouped searchable "To" options: Outlets, Transferees, Vendor Connections (reference order)
  const toOptions = [
    ...outlets
      .filter((o) => String(o.id) !== formData.fromOutletId)
      .map((o) => ({ id: String(o.id), name: o.name, group: 'Outlets' })),
    ...transferees.map((t) => ({ id: `transferee:${t.id}`, name: t.name, group: 'Transferees' })),
    ...vendors.map((v) => ({ id: `vendor:${v.id}`, name: v.name, group: 'Vendor Connections' })),
  ];
  const selectedTo = toOptions.find((o) => o.id === String(formData.toOutletId)) || null;
  const toInvalid = toTouched && !formData.toOutletId;

  return (
    <Box>
      {/* Full-width light-slate header band with bold title, aligned to the 764px form column */}
      <Box sx={{ backgroundColor: '#e2e8f0', mb: 6.5, px: 3, minHeight: 128, display: 'flex', alignItems: 'center' }}>
        <Box sx={{ maxWidth: 764, mx: 'auto', width: '100%' }}>
          <Typography component="h1" sx={{ fontSize: 20, fontWeight: 700, color: '#000' }}>
            Create Transfer
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, maxWidth: 764, mx: 'auto' }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Form: centered 764px column on plain white, no card */}
      <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 764, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 5, pb: 12 }}>
        {/* From (outlet select) */}
        <Box>
          <FieldLabel>From</FieldLabel>
          <FormControl fullWidth>
            <Select
              value={formData.fromOutletId}
              onChange={(e) => handleInputChange('fromOutletId', e.target.value)}
              IconComponent={ArrowDropDownIcon}
              MenuProps={selectMenuProps}
              sx={{
                height: 42,
                borderRadius: '8px',
                fontSize: 16,
                backgroundColor: '#fff',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#5f5f5f', borderWidth: '1px' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#5f5f5f' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
              }}
            >
              {/* Super admins may pick any outlet; outlet-scoped users see only their own (matches reference) */}
              {outlets
                .filter((outlet) => user?.isSuperAdmin || String(outlet.id) === formData.fromOutletId)
                .map((outlet) => (
                  <MenuItem key={outlet.id} value={String(outlet.id)}>
                    {outlet.name}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </Box>

        {/* To (searchable typeahead grouped by Outlets / Transferees) */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
            {toInvalid && <WarningIcon sx={{ fontSize: 18, color: '#dc2626' }} />}
            <Typography component="label" sx={{ fontWeight: 700, fontSize: 16, color: '#000' }}>
              To
            </Typography>
          </Box>
          <Autocomplete
            options={toOptions}
            value={selectedTo}
            groupBy={(o) => o.group}
            getOptionLabel={(o) => o.name}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            onChange={(e, newValue) => handleInputChange('toOutletId', newValue ? newValue.id : '')}
            onBlur={() => setToTouched(true)}
            componentsProps={{
              popper: {
                sx: {
                  '& .MuiAutocomplete-paper': {
                    border: '1px solid #000',
                    borderRadius: '8px',
                    boxShadow: 'none',
                  },
                  '& .MuiAutocomplete-groupLabel': { fontWeight: 700, fontSize: 16, color: '#000', lineHeight: '36px' },
                },
              },
            }}
            ListboxProps={{
              sx: {
                maxHeight: 290,
                '& .MuiAutocomplete-option': { fontSize: 16 },
                '& .MuiAutocomplete-option.Mui-focused': { backgroundColor: 'transparent', color: '#38a8e8' },
                '& .MuiAutocomplete-option[aria-selected="true"]': { backgroundColor: 'transparent', color: '#38a8e8' },
                '& .MuiAutocomplete-option[aria-selected="true"].Mui-focused': { backgroundColor: 'transparent', color: '#38a8e8' },
              },
            }}
            renderInput={(params) => (
              <TextField {...params} placeholder="Select..." sx={fieldSx} />
            )}
          />
        </Box>

        {/* Transfer Date */}
        <Box>
          <FieldLabel>Transfer Date</FieldLabel>
          <ShopfrontDatePicker
            value={formData.transferDate}
            onChange={(val) => handleInputChange('transferDate', val)}
          />
        </Box>

        {/* Transfer Number */}
        <Box>
          <FieldLabel>Transfer Number</FieldLabel>
          <TextField
            fullWidth
            value={transferNumber}
            onChange={(e) => setTransferNumber(e.target.value)}
            sx={fieldSx}
          />
        </Box>

        {/* Due Date */}
        <Box>
          <FieldLabel>Due Date</FieldLabel>
          <ShopfrontDatePicker
            value={formData.dueDate}
            onChange={(val) => handleInputChange('dueDate', val)}
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

        {/* Create button: fixed bottom-right of viewport, no transition, no shadow */}
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

export default CreateTransfer;
