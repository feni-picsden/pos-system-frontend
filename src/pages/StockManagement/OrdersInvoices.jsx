import React, { useState, useEffect, useCallback, useRef } from 'react';
import PageLoader from '../../components/Common/PageLoader';
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Alert,
  TextField,
  Autocomplete,
  Menu,
  MenuItem,
  Popover,
  IconButton,
} from '@mui/material';
import {
  VisibilityOutlined as ViewIcon,
  EditOutlined as EditIcon,
  Receipt as InvoiceIcon,
  ShoppingCart as OrderIcon,
  Assignment as OrderStockIcon,
  SwapHoriz as TransferStockIcon,
  LocalShipping as ReceiveStockIcon,
  Undo as ReturnStockIcon,
  CreditCard as CreditNoteIcon,
  Settings as IntegrationsIcon,
  ArrowDropDown as ArrowDropDownIcon,
  CalendarToday as CalendarIcon,
  KeyboardArrowLeft,
  KeyboardArrowRight,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { format, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import orderInvoiceService from '../../services/orderInvoiceService';
import supplierService from '../../services/supplierService';
import transfereeService from '../../services/transfereeService';
import productService from '../../services/productService';
import { userService } from '../../services/userService';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';

const STATUS_OPTIONS = ['Outstanding', 'Open', 'Sent', 'Received', 'Applied', 'Cancelled', 'All'];
const TYPE_OPTIONS = ['Order', 'Transfer', 'Return', 'Credit Note', 'All'];
const STATUS_MAP = {
  Outstanding: ['PENDING', 'OPEN', 'SENT'],
  Open: ['OPEN'],
  Sent: ['SENT'],
  Received: ['RECEIVED'],
  Applied: ['APPLIED'],
  Cancelled: ['CANCELLED'],
};
const TYPE_MAP = {
  Order: 'ORDER',
  Transfer: 'TRANSFER',
  Return: 'RETURN',
  'Credit Note': 'CREDIT_NOTE',
};

const EMPTY_FILTERS = {
  status: 'Outstanding',
  type: 'All',
  invoiceNumber: '',
  orderDate: null,
  dueDate: null,
  reference: '',
  supplier: '',
  transferee: '',
  outlet: '',
  vendorConnection: '',
  product: '',
  createdBy: '',
  sentBy: '',
  receivedBy: '',
};

const toolbarButtonSx = {
  bgcolor: '#5ebbeb',
  color: '#fff',
  textTransform: 'none',
  fontSize: 16,
  borderRadius: '12px',
  fontWeight: 700,
  px: 2,
  height: 42,
  boxShadow: 'none',
  '&:hover': {
    bgcolor: '#4aa9dd',
    boxShadow: 'none',
  },
};

const fieldSx = {
  width: '100%',
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    minHeight: 42,
    fontSize: 16,
    bgcolor: '#fff',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' },
  },
  '& input::placeholder': { color: '#808080', opacity: 1 },
};

// Reference: selected option renders as blue TEXT on white, not white-on-blue.
const comboListboxSx = {
  '& .MuiAutocomplete-option[aria-selected="true"]': {
    bgcolor: '#fff !important',
    color: '#5ebbeb',
  },
};

const fieldLabelSx = { fontSize: 12, color: '#676b72', mb: 0.5, lineHeight: 1.2 };

// Reference pattern: label sits ABOVE the field as a small gray caption.
const Labeled = ({ label, children }) => (
  <Box sx={{ width: 358 }}>
    <Typography sx={fieldLabelSx}>{label}</Typography>
    {children}
  </Box>
);

const badgeBg = {
  SENT: '#f6993f',
  PENDING: '#f6993f',
  RECEIVED: '#38c172',
  APPLIED: '#38c172',
  OPEN: '#3490dc',
  CANCELLED: '#e3342f',
};

const includesText = (value, query) =>
  !query || String(value || '').toLowerCase().includes(query.toLowerCase());

const inDateRange = (range, dateString) => {
  if (!range || !range.startDate || !range.endDate) return true;
  const t = new Date(dateString).setHours(0, 0, 0, 0);
  return (
    t >= new Date(range.startDate).setHours(0, 0, 0, 0) &&
    t <= new Date(range.endDate).setHours(0, 0, 0, 0)
  );
};

const sameDay = (a, b) => a && b && format(a, 'yyyy-MM-dd') === format(b, 'yyyy-MM-dd');

// Reference date-range field: two DD/MM/YYYY segments in one box (empty by
// default, no trailing calendar icon); popup has a calendar icon top-left,
// 'Current Day' link top-right, two months paged together by ONE prev / ONE
// next chevron, single-letter Monday-start weekday header, and today drawn as
// a blue OUTLINED circle.
const DateRangeField = ({ value, onChange }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [tempStart, setTempStart] = useState(null);
  const [tempEnd, setTempEnd] = useState(null);
  const [baseMonth, setBaseMonth] = useState(startOfMonth(new Date()));

  const start = value?.startDate || null;
  const end = value?.endDate || null;

  const handleOpen = (e) => {
    setTempStart(start);
    setTempEnd(end);
    setBaseMonth(startOfMonth(start || new Date()));
    setAnchorEl(e.currentTarget);
  };
  const handleClose = () => setAnchorEl(null);

  const apply = (s, e) => {
    onChange({ startDate: s, endDate: e, preset: 'custom' });
    handleClose();
  };

  const handleDateClick = (date) => {
    if (!tempStart || (tempStart && tempEnd) || date < tempStart) {
      setTempStart(date);
      setTempEnd(null);
    } else {
      setTempEnd(date);
      apply(tempStart, date);
    }
  };

  const handleCurrentDay = () => {
    const today = new Date();
    apply(today, today);
  };

  const inRange = (day) => {
    if (!tempStart) return false;
    if (!tempEnd) return sameDay(day, tempStart);
    return day >= tempStart && day <= tempEnd;
  };

  const renderMonth = (month) => {
    const first = startOfMonth(month);
    const last = endOfMonth(month);
    const lead = (first.getDay() + 6) % 7; // Monday start
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= last.getDate(); d++) {
      cells.push(new Date(month.getFullYear(), month.getMonth(), d));
    }
    const today = new Date();
    return (
      <Box key={format(month, 'yyyy-MM')} sx={{ width: 224 }}>
        <Typography sx={{ textAlign: 'center', fontWeight: 700, fontSize: 14, mb: 1 }}>
          {format(month, 'MMMM yyyy')}
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', mb: 0.5 }}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <Typography key={i} sx={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#676b72' }}>
              {d}
            </Typography>
          ))}
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
          {cells.map((day, i) => {
            if (!day) return <Box key={i} />;
            const isToday = sameDay(day, today);
            const selected = inRange(day);
            const isEdge = sameDay(day, tempStart) || sameDay(day, tempEnd);
            return (
              <Box
                key={i}
                onClick={() => handleDateClick(day)}
                sx={{
                  height: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  borderRadius: '50%',
                  // today = blue OUTLINED circle (never solid fill)
                  border: isToday || isEdge ? '1px solid #5ebbeb' : '1px solid transparent',
                  bgcolor: selected ? '#e3f2fd' : 'transparent',
                  color: '#0284c7',
                  fontSize: 14,
                  '&:hover': { bgcolor: '#e3f2fd' },
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

  const segSx = (has) => ({
    fontSize: 16,
    color: has ? '#000' : '#808080',
    px: 1,
    lineHeight: '40px',
  });

  return (
    <>
      <Box
        onClick={handleOpen}
        sx={{
          display: 'flex',
          alignItems: 'center',
          height: 42,
          border: '1px solid #404040',
          borderRadius: '8px',
          bgcolor: '#fff',
          px: 1,
          cursor: 'pointer',
        }}
      >
        <Box component="span" sx={segSx(!!start)}>
          {start ? format(start, 'dd/MM/yyyy') : 'DD/MM/YYYY'}
        </Box>
        <Box component="span" sx={{ color: '#808080' }}>
          –
        </Box>
        <Box component="span" sx={segSx(!!end)}>
          {end ? format(end, 'dd/MM/yyyy') : 'DD/MM/YYYY'}
        </Box>
      </Box>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { p: 2, width: 540, bgcolor: '#fff', borderRadius: '8px' } }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <IconButton size="small">
            <CalendarIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <Button
            size="small"
            onClick={handleCurrentDay}
            sx={{ textTransform: 'none', fontSize: 14, color: '#5ebbeb', p: '2px 8px', minWidth: 0 }}
          >
            Current Day
          </Button>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <TextField
            size="small"
            value={tempStart ? format(tempStart, 'dd/MM/yyyy') : ''}
            placeholder="dd/mm/yyyy"
            InputProps={{ readOnly: true }}
            sx={{ flex: 1 }}
          />
          <Typography sx={{ color: '#676b72' }}>-</Typography>
          <TextField
            size="small"
            value={tempEnd ? format(tempEnd, 'dd/MM/yyyy') : ''}
            placeholder="dd/mm/yyyy"
            InputProps={{ readOnly: true }}
            sx={{ flex: 1 }}
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          {/* single shared prev/next chevrons page BOTH months together */}
          <IconButton size="small" onClick={() => setBaseMonth((m) => addMonths(m, -1))} sx={{ mt: 3 }}>
            <KeyboardArrowLeft />
          </IconButton>
          {renderMonth(baseMonth)}
          {renderMonth(addMonths(baseMonth, 1))}
          <IconButton size="small" onClick={() => setBaseMonth((m) => addMonths(m, 1))} sx={{ mt: 3 }}>
            <KeyboardArrowRight />
          </IconButton>
        </Box>
      </Popover>
    </>
  );
};

const pickNames = (res) => {
  const arr = Array.isArray(res)
    ? res
    : res?.suppliers || res?.transferees || res?.products || res?.users || res?.outlets || res?.data || [];
  return [
    ...new Set(
      arr
        .map(
          (x) =>
            x?.name ||
            [x?.firstName, x?.lastName].filter(Boolean).join(' ') ||
            x?.username ||
            ''
        )
        .filter(Boolean)
    ),
  ];
};

const OrdersInvoices = () => {
  // In-app dialogs — these shadow window.alert/confirm/prompt on purpose.
  const { alert, confirm } = useAppDialogs();
  const [ordersInvoices, setOrdersInvoices] = useState([]);
  const [filteredOrdersInvoices, setFilteredOrdersInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [integrationsMenuAnchor, setIntegrationsMenuAnchor] = useState(null);
  // Async combobox option pools: undefined = not fetched, null = loading.
  const [pools, setPools] = useState({});
  const poolPromises = useRef({});
  const navigate = useNavigate();
  const { selectedOutlet } = useSelectedOutlet();

  const loadOrdersInvoices = useCallback(async () => {
    try {
      setLoading(true);
      // Server-side filters the backend supports; the rest stay client-side.
      const params = {};
      if (appliedFilters.type !== 'All') params.type = TYPE_MAP[appliedFilters.type];
      if (appliedFilters.status !== 'All') {
        params.statusFilter = (STATUS_MAP[appliedFilters.status] || []).join(',');
      }
      const response = await orderInvoiceService.getOrdersInvoices(params);
      setOrdersInvoices(response.ordersInvoices || []);
      setError('');
    } catch (err) {
      setError('Failed to load orders and invoices');
      console.error('Error loading orders and invoices:', err);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters.type, appliedFilters.status]);

  useEffect(() => {
    loadOrdersInvoices();
  }, [loadOrdersInvoices]);

  // Pre-fill the Outlet advanced filter with the current outlet (reference behavior).
  useEffect(() => {
    if (selectedOutlet?.name) {
      setFilters((prev) => (prev.outlet ? prev : { ...prev, outlet: selectedOutlet.name }));
    }
  }, [selectedOutlet]);

  // Filters only apply when the Filter button is pressed (appliedFilters).
  useEffect(() => {
    const f = appliedFilters;
    const filtered = ordersInvoices.filter((item) => {
      const matchesStatus =
        f.status === 'All' || (STATUS_MAP[f.status] || []).includes(item.status);
      const matchesType = f.type === 'All' || item.type === TYPE_MAP[f.type];
      const matchesInvoice = includesText(item.invoiceNumber || item.orderNumber, f.invoiceNumber);
      const matchesOrderDate = inDateRange(f.orderDate, item.orderDate || item.createdAt);
      const matchesDueDate = !f.dueDate || (item.dueDate && inDateRange(f.dueDate, item.dueDate));
      const matchesReference = includesText(item.internalReference, f.reference);
      const matchesSupplier = includesText(item.supplier?.name, f.supplier);
      const matchesOutlet = includesText(
        item.outlet?.name || item.toOutlet?.name || item.fromOutlet?.name,
        f.outlet
      );
      const matchesVendor = includesText(item.supplier?.name, f.vendorConnection);
      const matchesProduct =
        !f.product || (item.items || []).some((it) => includesText(it.product, f.product));
      const matchesCreatedBy = includesText(item.creator?.name, f.createdBy);
      const matchesReceivedBy = includesText(item.receiver?.name, f.receivedBy);
      const matchesSentBy = includesText(item.sender?.name, f.sentBy);
      const matchesTransferee =
        !f.transferee ||
        (item.type === 'TRANSFER' && includesText(item.toTransferee?.name, f.transferee));
      return (
        matchesStatus &&
        matchesType &&
        matchesInvoice &&
        matchesOrderDate &&
        matchesDueDate &&
        matchesReference &&
        matchesSupplier &&
        matchesOutlet &&
        matchesVendor &&
        matchesProduct &&
        matchesCreatedBy &&
        matchesReceivedBy &&
        matchesSentBy &&
        matchesTransferee
      );
    });
    setFilteredOrdersInvoices(filtered);
  }, [ordersInvoices, appliedFilters]);

  const handleViewOrderInvoice = (item) => {
    navigate(`/orders-invoices/${item.id}`);
  };

  const handleEditOrderInvoice = (item) => {
    navigate(`/orders-invoices/${item.id}/edit`);
  };

  const handleMarkAsReceived = async (item) => {
    try {
      await orderInvoiceService.markAsReceived(item.id);
      await loadOrdersInvoices();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to mark as received');
      console.error('Error marking as received:', err);
    }
  };

  const handleApplyCreditNote = async (item) => {
    if (!(await confirm(
      `Apply credit note ${item.orderNumber}? This adds ${formatCurrency(item.totalAmount)} to the supplier's credit balance and cannot be undone.`,
      { title: 'Apply credit note', confirmText: 'Apply credit note' }
    ))) {
      return;
    }
    try {
      await orderInvoiceService.applyCreditNote(item.id);
      await loadOrdersInvoices();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to apply credit note');
      console.error('Error applying credit note:', err);
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'ORDER': return '#1976d2';
      case 'INVOICE': return '#388e3c';
      case 'TRANSFER': return '#7b1fa2';
      case 'RETURN': return '#f57c00';
      case 'CREDIT_NOTE': return '#c2185b';
      default: return '#666';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  // Reference renders dates as dd/mm/yyyy.
  const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-GB');

  const setFilter = (field) => (value) => setFilters((prev) => ({ ...prev, [field]: value }));

  const getFrom = (item) => {
    if (item.type === 'TRANSFER') {
      return { name: item.fromOutlet?.name || item.supplier?.name || '—', sub: 'OUTLET' };
    }
    // Returns go outlet -> supplier
    if (item.type === 'RETURN') {
      return { name: item.outlet?.name || selectedOutlet?.name || '—', sub: 'OUTLET' };
    }
    if (item.supplier?.name) return { name: item.supplier.name, sub: 'SUPPLIER' };
    return { name: item.from === 'all' ? 'All Suppliers' : '—', sub: 'SUPPLIER' };
  };

  const getTo = (item) => {
    if (item.type === 'RETURN') {
      return { name: item.supplier?.name || '—', sub: 'SUPPLIER' };
    }
    if (item.type === 'TRANSFER' && item.toTransferee?.name) {
      return { name: item.toTransferee.name, sub: 'TRANSFEREE' };
    }
    // An order/invoice raised to a customer goes to that customer, not the outlet
    // (same rule as OrderDetails/EditOrder/ReviewOrder and the printed header).
    if (item.customer) {
      const name = `${item.customer.firstName || ''} ${item.customer.lastName || ''}`.trim();
      return { name: name || item.customer.company || '—', sub: 'CUSTOMER' };
    }
    return {
      name: item.toOutlet?.name || item.outlet?.name || selectedOutlet?.name || '—',
      sub: 'OUTLET',
    };
  };

  // Lazily fetch (once per source) the name pool backing an async combobox.
  const ensurePool = (field) => {
    if (pools[field] !== undefined || poolPromises.current[field]) return;
    poolPromises.current[field] = (async () => {
      setPools((p) => ({ ...p, [field]: null }));
      let names = [];
      try {
        let res;
        switch (field) {
          case 'supplier':
          case 'vendorConnection':
            res = await supplierService.getSuppliers();
            break;
          case 'transferee':
            res = await transfereeService.getTransferees();
            break;
          case 'product':
            res = await productService.getProducts({ includeAllStatuses: true });
            break;
          case 'createdBy':
          case 'sentBy':
          case 'receivedBy':
            res = await userService.getUsers();
            break;
          default:
            res = [];
        }
        names = pickNames(res);
      } catch (err) {
        console.error(`Error loading ${field} options:`, err);
      }
      setPools((p) => ({ ...p, [field]: names }));
    })();
  };

  if (loading) {
    return <PageLoader />;
  }

  const renderCombo = (label, field, options, extra = {}) => (
    <Labeled label={label}>
      <Autocomplete
        options={options}
        value={filters[field]}
        onChange={(e, value) => setFilter(field)(value ?? '')}
        disableClearable={!extra.clearable}
        autoHighlight
        freeSolo={options.length === 0}
        forcePopupIcon
        onInputChange={
          options.length === 0 ? (e, value) => setFilter(field)(value ?? '') : undefined
        }
        ListboxProps={{ sx: comboListboxSx }}
        sx={{
          ...fieldSx,
          // Reference shows a persistent X clear button beside the chevron.
          ...(extra.clearable && {
            '& .MuiAutocomplete-clearIndicator': { visibility: 'visible' },
          }),
        }}
        renderInput={(params) => <TextField {...params} size="small" />}
      />
    </Labeled>
  );

  // Async searchable combobox: empty until 2+ chars typed; 1 char shows the
  // 'Keep Typing to Search...' hint (reference behavior).
  const renderAsyncCombo = (label, field) => {
    const q = (filters[field] || '').trim();
    const pool = pools[field];
    const options =
      q.length >= 2 && Array.isArray(pool)
        ? pool.filter((n) => n.toLowerCase().includes(q.toLowerCase()))
        : [];
    return (
      <Labeled label={label}>
        <Autocomplete
          options={options}
          value={null}
          inputValue={filters[field]}
          onInputChange={(e, value, reason) => {
            if (reason === 'reset' && !value) return;
            setFilter(field)(value ?? '');
            if ((value ?? '').trim().length >= 2) ensurePool(field);
          }}
          onChange={(e, value) => value && setFilter(field)(value)}
          filterOptions={(x) => x}
          forcePopupIcon
          noOptionsText={
            q.length < 2
              ? 'Keep Typing to Search...'
              : pool === null
                ? 'Loading...'
                : 'No results found'
          }
          ListboxProps={{ sx: comboListboxSx }}
          sx={fieldSx}
          renderInput={(params) => <TextField {...params} size="small" />}
        />
      </Labeled>
    );
  };

  const integrationsOpen = Boolean(integrationsMenuAnchor);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{
        display: 'flex',
        gap: 1,
        mb: 2,
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <Button variant="contained" startIcon={<OrderStockIcon />} onClick={() => navigate('/orders-invoices/create')} sx={toolbarButtonSx}>
          Order Stock
        </Button>
        <Button variant="contained" startIcon={<TransferStockIcon />} onClick={() => navigate('/orders-invoices/create-transfer')} sx={toolbarButtonSx}>
          Transfer Stock
        </Button>
        <Button variant="contained" startIcon={<ReceiveStockIcon />} onClick={() => navigate('/orders-invoices/create-receive-stock')} sx={toolbarButtonSx}>
          Receive Stock
        </Button>
        <Button variant="contained" startIcon={<ReturnStockIcon />} onClick={() => navigate('/orders-invoices/create-return')} sx={toolbarButtonSx}>
          Return Stock
        </Button>
        <Button variant="contained" startIcon={<CreditNoteIcon />} onClick={() => navigate('/orders-invoices/create-credit-note')} sx={toolbarButtonSx}>
          Add Credit Note
        </Button>
        <Button
          variant="contained"
          endIcon={<ArrowDropDownIcon />}
          startIcon={<IntegrationsIcon />}
          onClick={(e) => setIntegrationsMenuAnchor(e.currentTarget)}
          sx={{
            ...toolbarButtonSx,
            '& .MuiButton-endIcon svg': {
              transition: 'transform 0.2s',
              transform: integrationsOpen ? 'rotate(180deg)' : 'none',
            },
          }}
        >
          Integrations
        </Button>
        <Menu
          anchorEl={integrationsMenuAnchor}
          open={integrationsOpen}
          onClose={() => setIntegrationsMenuAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          transitionDuration={0}
          PaperProps={{
            sx: {
              bgcolor: '#fff',
              borderRadius: '8px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
              mt: 0.5,
            },
          }}
          MenuListProps={{ sx: { p: 1 } }}
        >
          <MenuItem
            onClick={() => setIntegrationsMenuAnchor(null)}
            sx={{
              bgcolor: '#5ebbeb',
              color: '#fff',
              fontSize: 16,
              gap: 1,
              minWidth: 168,
              minHeight: 53,
              borderRadius: '4px',
              '&:hover': { bgcolor: '#4aa9dd' },
            }}
          >
            {/* ponytail: inline SVG stand-in — no ALM logo asset in the repo */}
            <Box component="svg" viewBox="0 0 24 24" sx={{ width: 22, height: 22, flexShrink: 0 }}>
              <rect width="24" height="24" rx="4" fill="#fff" />
              <text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="700" fill="#e33430" fontFamily="Arial">
                ALM
              </text>
            </Box>
            View ALM Orders
          </MenuItem>
        </Menu>
      </Box>

      {/* Filter grid — applies on the Filter button, not live */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
        {renderCombo('Status', 'status', STATUS_OPTIONS)}
        {renderCombo('Type', 'type', TYPE_OPTIONS)}
        <Labeled label="Invoice Number">
          <TextField
            size="small"
            fullWidth
            value={filters.invoiceNumber}
            onChange={(e) => setFilter('invoiceNumber')(e.target.value)}
            sx={fieldSx}
          />
        </Labeled>
        <Labeled label="Order / Invoice Date">
          <DateRangeField value={filters.orderDate} onChange={setFilter('orderDate')} />
        </Labeled>
        <Labeled label="Due Date">
          <DateRangeField value={filters.dueDate} onChange={setFilter('dueDate')} />
        </Labeled>
      </Box>

      {showAdvanced && (
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
          <Labeled label="Reference">
            <TextField
              size="small"
              fullWidth
              value={filters.reference}
              onChange={(e) => setFilter('reference')(e.target.value)}
              sx={fieldSx}
            />
          </Labeled>
          {renderAsyncCombo('Supplier', 'supplier')}
          {renderAsyncCombo('Transferee', 'transferee')}
          {renderCombo('Outlet', 'outlet', [], { clearable: true })}
          {renderAsyncCombo('Vendor Connection', 'vendorConnection')}
          {renderAsyncCombo('Product', 'product')}
          {renderAsyncCombo('Created By', 'createdBy')}
          {renderAsyncCombo('Sent By', 'sentBy')}
          {renderAsyncCombo('Received By', 'receivedBy')}
        </Box>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Button
          variant="contained"
          onClick={() => setShowAdvanced((prev) => !prev)}
          sx={{
            ...toolbarButtonSx,
            // Reference 'Hide' state: outlined — white bg, blue text, light-blue border.
            ...(showAdvanced && {
              bgcolor: '#fff',
              color: '#5ebbeb',
              border: '1px solid rgba(94, 187, 235, 0.6)',
              '&:hover': { bgcolor: '#f4fafd', boxShadow: 'none' },
            }),
          }}
        >
          {showAdvanced ? 'Hide Advanced Filters' : 'Show Advanced Filters'}
        </Button>
        <Button
          variant="contained"
          onClick={() => setAppliedFilters({ ...filters })}
          sx={{ ...toolbarButtonSx, px: 4 }}
        >
          Filter
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Orders & Invoices Table */}
      <TableContainer sx={{ mt: 1 }}>
        <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <TableHead>
            <TableRow
              sx={{
                '& th': { bgcolor: '#ebebeb', color: '#000', fontWeight: 700, fontSize: 16, border: 0, height: 51, py: 0, textTransform: 'uppercase', textAlign: 'center', borderRadius: 0 }
              }}
            >
              <TableCell sx={{ width: 48 }} />
              <TableCell sx={{ width: '26%' }}>From</TableCell>
              <TableCell sx={{ width: '20%' }}>To</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Invoice Number</TableCell>
              <TableCell>Reference</TableCell>
              <TableCell>Status</TableCell>
              <TableCell />
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody
            sx={{
              // Reference rows: transparent bg, no hover, 1px bottom border only.
              '& td': { borderBottom: '1px solid #ebebeb', fontSize: 16, color: '#000', py: 1.5 }
            }}
          >
            {filteredOrdersInvoices.map((item) => {
              const from = getFrom(item);
              const to = getTo(item);
              const lineCount = item.items?.length ?? 1;
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.type === 'TRANSFER'
                      ? <TransferStockIcon sx={{ color: getTypeColor('TRANSFER') }} />
                      : item.type === 'RETURN'
                        ? <ReturnStockIcon sx={{ color: getTypeColor('RETURN') }} />
                        : item.type === 'CREDIT_NOTE'
                          ? <CreditNoteIcon sx={{ color: getTypeColor('CREDIT_NOTE') }} />
                          : item.type === 'ORDER'
                            ? <OrderIcon sx={{ color: getTypeColor('ORDER') }} />
                            : <InvoiceIcon sx={{ color: getTypeColor('INVOICE') }} />}
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 16, color: '#000', fontWeight: 700, lineHeight: 1.2 }}>
                      {from.name}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: '#676b72', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      {from.sub}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 16, color: '#000', fontWeight: 700, lineHeight: 1.2 }}>
                      {to.name}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: '#676b72', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      {to.sub}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">{formatDate(item.orderDate || item.createdAt)}</TableCell>
                  <TableCell align="center">{item.invoiceNumber || item.orderNumber}</TableCell>
                  <TableCell align="center">{item.internalReference || '—'}</TableCell>
                  <TableCell align="center">
                    <Box
                      component="span"
                      sx={{
                        display: 'inline-block',
                        p: '8px',
                        borderRadius: '4px',
                        bgcolor: badgeBg[item.status] || '#9ca3af',
                        color: 'rgba(255, 255, 255, 0.8)',
                        fontSize: 16,
                        lineHeight: 1,
                      }}
                    >
                      {item.status}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 16, color: '#000', fontWeight: 700, lineHeight: 1.2 }}>
                      {formatCurrency(item.totalAmount)}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: '#676b72', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      {lineCount} {lineCount === 1 ? 'LINE' : 'LINES'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center" padding="none" sx={{ borderBottom: '1px solid #ebebeb' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: 3 }}>
                      <Button
                        size="small"
                        startIcon={<ViewIcon />}
                        onClick={() => handleViewOrderInvoice(item)}
                        sx={{ color: '#0284c7', textTransform: 'none', fontWeight: 700, fontSize: 16, minWidth: 0 }}
                      >
                        View
                      </Button>
                      {String(item.type || '').toUpperCase() === 'CREDIT_NOTE' &&
                        String(item.status || '').toUpperCase() === 'PENDING' && (
                          <Button
                            size="small"
                            startIcon={<CreditNoteIcon />}
                            onClick={() => handleApplyCreditNote(item)}
                            sx={{ color: '#16a34a', textTransform: 'none', fontWeight: 700, fontSize: 16, minWidth: 0 }}
                          >
                            Apply
                          </Button>
                        )}
                      {/* Edit: unsent (PENDING/OPEN) documents only (reference) */}
                      {['PENDING', 'OPEN'].includes(String(item.status || '').toUpperCase()) && (
                        <Button
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() => handleEditOrderInvoice(item)}
                          sx={{ color: '#16a34a', textTransform: 'none', fontWeight: 700, fontSize: 16, minWidth: 0 }}
                        >
                          Edit
                        </Button>
                      )}
                      {/* Receive: local shortcut for unsent/sent orders & invoices only */}
                      {['ORDER', 'INVOICE'].includes(String(item.type || '').toUpperCase()) &&
                        ['PENDING', 'OPEN', 'SENT'].includes(String(item.status || '').toUpperCase()) && (
                          <Button
                            size="small"
                            startIcon={<ReceiveStockIcon />}
                            onClick={() => handleMarkAsReceived(item)}
                            sx={{ color: '#16a34a', textTransform: 'none', fontWeight: 700, fontSize: 16, minWidth: 0 }}
                          >
                            Receive
                          </Button>
                        )}
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredOrdersInvoices.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    No orders or invoices found matching your filters
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default OrdersInvoices;
