import React, { useState, useEffect, useRef } from 'react';
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
  Checkbox,
  Chip,
  Divider,
  ClickAwayListener,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Autocomplete,
  Snackbar,
} from '@mui/material';
import {
  PersonAddAltOutlined as AddIcon,
  EditOutlined as EditIcon,
  DeleteOutline as DeleteIcon,
  VisibilityOutlined as ViewIcon,
  IosShareOutlined as ExportIcon,
  FileUploadOutlined as ImportIcon,
  CallMergeOutlined as MergeIcon,
  ArrowDropDown as ArrowDropDownIcon,
  HelpOutline as HelpIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams, useLocation, Link as RouterLink } from 'react-router-dom';

import customerService from '../../services/customerService';
import customerGroupService from '../../services/customerGroupService';
import priceListService from '../../services/priceListService';
import PerformanceGraph from '../../components/Customers/PerformanceGraph';
import posLocalDb from '../../services/posLocalDb';
import PageLoader from '../../components/Common/PageLoader';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';

// Shared outlined-toolbar-button style (Export / Import / Merge) — matches the reference:
// transparent bg, 1px #737373 border, #525252 text, radius 12, h42, fw700 16px, instant hover.
const outlinedBtnSx = {
  bgcolor: 'transparent',
  border: '1px solid #8e8e8e',
  color: '#6e6e6e',
  borderRadius: '12px',
  textTransform: 'none',
  boxShadow: 'none',
  fontWeight: 700,
  fontSize: 16,
  px: 3,
  height: 42,
  transition: 'none',
  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)', border: '1px solid #8e8e8e', boxShadow: 'none' },
};

// Reference row-action buttons: <a>-like links, instant (0s) hover, h42, radius 12, heavy padding, fw700.
const rowActionSx = (color) => ({
  color,
  textTransform: 'none',
  fontWeight: 700,
  fontSize: 16,
  height: 42,
  borderRadius: '12px',
  px: 4.25,
  transition: 'none',
  '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
});

// Reference Cancel button inside dialogs: gray FILLED, black text, radius 12, fw700.
const grayFilledBtnSx = {
  bgcolor: '#e5e5e5',
  color: '#000',
  borderRadius: '12px',
  textTransform: 'none',
  boxShadow: 'none',
  fontWeight: 700,
  fontSize: 16,
  height: 42,
  px: 3,
  '&:hover': { bgcolor: '#d4d4d4', boxShadow: 'none' },
};

// Reference primary FILLED action inside dialogs: sky-blue, white text, radius 12, fw700.
const skyFilledBtnSx = {
  bgcolor: '#0ea5e9',
  color: '#fff',
  borderRadius: '12px',
  textTransform: 'none',
  boxShadow: 'none',
  fontWeight: 700,
  fontSize: 16,
  height: 42,
  px: 3,
  '&:hover': { bgcolor: '#0284c7', boxShadow: 'none' },
  '&.Mui-disabled': { bgcolor: '#bae6fd', color: '#fff' },
};

// Reference-style multi-select filter (Customer Group / Price List):
// labeled 42px trigger, absolutely-positioned white/1px-#000/radius-8 panel, checkbox rows,
// selected options pinned to the top with sky-blue text, instant refilter, no Apply button.
const MultiSelectFilter = ({ label, options, selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const selectedOpts = options.filter((o) => selected.includes(o.value));
  const unselectedOpts = options.filter((o) => !selected.includes(o.value));

  const toggle = (val) =>
    onChange(selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]);

  const renderRow = (o) => {
    const isSel = selected.includes(o.value);
    return (
      <Box
        key={o.value}
        onClick={() => toggle(o.value)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          minHeight: 45,
          cursor: 'pointer',
          fontSize: 16,
          color: isSel ? '#38bdf8' : '#000',
          '&:hover': { bgcolor: '#5ebbeb', color: '#fff' },
        }}
      >
        <Checkbox checked={isSel} size="small" disableRipple sx={{ p: 0, color: 'inherit', '&.Mui-checked': { color: 'inherit' } }} />
        <span>{o.label}</span>
      </Box>
    );
  };

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box sx={{ flex: 1, position: 'relative' }} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
        <Typography sx={{ mb: 0.5, fontSize: 14, color: '#676b72' }}>{label}</Typography>
        <Box
          onClick={() => setOpen((o) => !o)}
          sx={{
            height: 42,
            borderRadius: '8px',
            border: '1px solid #404040',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1.5,
            cursor: 'pointer',
            bgcolor: '#fff',
          }}
        >
          <Box sx={{ flex: 1, display: 'flex', gap: 0.5, overflow: 'hidden', flexWrap: 'nowrap' }}>
            {selectedOpts.length === 0 ? (
              <Typography sx={{ color: '#808080', fontSize: 16 }}>Select...</Typography>
            ) : (
              selectedOpts.map((o) => (
                <Chip
                  key={o.value}
                  label={o.label}
                  size="small"
                  sx={{ bgcolor: '#e5e5e5', color: '#525252', maxWidth: 140, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
                />
              ))
            )}
          </Box>
          <ArrowDropDownIcon sx={{ color: '#404040' }} />
        </Box>
        {open && (
          <Box
            sx={{
              position: 'absolute',
              top: '100%',
              left: 0,
              width: '100%',
              mt: 0.5,
              bgcolor: '#fff',
              border: '1px solid #000',
              borderRadius: '8px',
              maxHeight: 288,
              overflowY: 'auto',
              zIndex: 1,
            }}
          >
            {selectedOpts.map(renderRow)}
            {selectedOpts.length > 0 && unselectedOpts.length > 0 && <Divider />}
            {unselectedOpts.map(renderRow)}
          </Box>
        )}
      </Box>
    </ClickAwayListener>
  );
};

const emailsOf = (c) => (c.emails?.length ? c.emails : [c.email]).filter(Boolean);
const phonesOf = (c) => [c.phone, c.mobile].filter(Boolean);
const fullNameOf = (c) => `${c.firstName || ''} ${c.lastName || ''}`.trim();
// Marketing consent in CSV exports: Opted In = 1, Opted Out = 0, Not Specified = blank.
const marketingCsv = (v) => (v === 'Yes' ? 1 : v === 'No' ? 0 : '');
const boolCsv = (v) => (v ? 'Yes' : 'No');

// Export column sets (per Shopfront help docs): 'Simple' is the short list, 'Full' is every
// customer detail including current loyalty points and current owing.
const SIMPLE_COLUMNS = [
  ['Name', fullNameOf],
  ['Company', (c) => c.company || ''],
  ['Code', (c) => c.code || ''],
  ['Birthday', (c) => c.birthday || ''],
  ['Email Addresses', (c) => emailsOf(c).join('; ')],
  ['Phone Numbers', (c) => phonesOf(c).join('; ')],
  ['Subscribed to Marketing Emails', (c) => marketingCsv(c.allowMarketingEmails)],
];
const FULL_COLUMNS = [
  ...SIMPLE_COLUMNS,
  ['First Name', (c) => c.firstName || ''],
  ['Last Name', (c) => c.lastName || ''],
  ['Business Number', (c) => c.businessNumber || ''],
  ['Gender', (c) => c.gender || ''],
  ['Phone', (c) => c.phone || ''],
  ['Mobile', (c) => c.mobile || ''],
  ['Fax', (c) => c.fax || ''],
  ['Website', (c) => c.website || ''],
  ['Twitter', (c) => c.twitter || ''],
  ['Facebook', (c) => c.facebook || ''],
  ['Billing Street 1', (c) => c.billingStreet1 || ''],
  ['Billing Street 2', (c) => c.billingStreet2 || ''],
  ['Billing Suburb', (c) => c.billingSuburb || ''],
  ['Billing Postcode', (c) => c.billingPostcode || ''],
  ['Billing State', (c) => c.billingState || ''],
  ['Billing Country', (c) => c.billingCountry || ''],
  ['Delivery Street 1', (c) => c.deliveryStreet1 || ''],
  ['Delivery Street 2', (c) => c.deliveryStreet2 || ''],
  ['Delivery Suburb', (c) => c.deliverySuburb || ''],
  ['Delivery Postcode', (c) => c.deliveryPostcode || ''],
  ['Delivery State', (c) => c.deliveryState || ''],
  ['Delivery Country', (c) => c.deliveryCountry || ''],
  ['Customer Group', (c) => c.customerGroup?.name || ''],
  ['Price List', (c) => c.priceList?.name || ''],
  ['Override Customer Group', (c) => boolCsv(c.overrideCustomerGroup)],
  ['Loyalty Enabled', (c) => boolCsv(c.loyaltyEnabled)],
  ['Loyalty Points', (c) => c.loyaltyPoints || 0],
  ['Account Limit', (c) => (c.accountLimit == null ? '' : c.accountLimit)],
  ['Owing', (c) => c.currentOwing || 0],
  ['Disable Promotions', (c) => boolCsv(c.disablePromotions)],
  ['Require Order Reference', (c) => boolCsv(c.requireOrderReference)],
  ['Active', (c) => boolCsv(c.isActive)],
  ['Invoice Message', (c) => c.invoiceMessage || ''],
  ['Internal Comments', (c) => c.internalComments || ''],
];

// Import column -> payload field. Header matching is loose (lowercased, non-alphanumerics dropped)
// so the documented snake_case columns AND this page's Title Case export both round-trip.
// City and Suburb both feed the single *Suburb column the Prisma model has.
const normHeader = (h) => String(h).toLowerCase().replace(/[^a-z0-9]/g, '');
const IMPORT_COLUMNS = {
  firstName: ['first_name'],
  lastName: ['last_name'],
  company: ['company'],
  code: ['code'],
  phone: ['phone'],
  mobile: ['mobile'],
  fax: ['fax'],
  website: ['website'],
  twitter: ['twitter'],
  facebook: ['facebook'],
  businessNumber: ['business_number'],
  customerGroupId: ['customer_group_id'],
  billingStreet1: ['billing_street_1', 'billing_address_street_1'],
  billingStreet2: ['billing_street_2', 'billing_address_street_2'],
  billingSuburb: ['billing_suburb', 'billing_address_suburb', 'billing_city', 'billing_address_city'],
  billingPostcode: ['billing_postcode', 'billing_address_postcode'],
  billingState: ['billing_state', 'billing_address_state'],
  billingCountry: ['billing_country', 'billing_address_country'],
  deliveryStreet1: ['delivery_street_1', 'delivery_address_street_1'],
  deliveryStreet2: ['delivery_street_2', 'delivery_address_street_2'],
  deliverySuburb: ['delivery_suburb', 'delivery_address_suburb', 'delivery_city', 'delivery_address_city'],
  deliveryPostcode: ['delivery_postcode', 'delivery_address_postcode'],
  deliveryState: ['delivery_state', 'delivery_address_state'],
  deliveryCountry: ['delivery_country', 'delivery_address_country'],
};

// Minimal RFC-4180-ish CSV helpers (import + export). Handles quoted fields, embedded commas/quotes/newlines.
const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const buildCsv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (ch !== '\r') cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
};

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [customerGroups, setCustomerGroups] = useState([]);
  const [priceLists, setPriceLists] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  // ?priceList=<id> arrives from the price list view page's "View Customers".
  const [searchParams] = useSearchParams();
  const [selectedPriceLists, setSelectedPriceLists] = useState(() => {
    const fromUrl = searchParams.get('priceList');
    return fromUrl ? [fromUrl] : [];
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  // Reference preselects "Simple".
  const [exportScope, setExportScope] = useState('Simple');
  const [deleteToast, setDeleteToast] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const fileInputRef = useRef(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedOutletId } = useSelectedOutlet();

  // A delete on the customer VIEW page navigates here with state.deleted so the
  // toast still shows after the redirect.
  useEffect(() => {
    if (location.state?.deleted) setDeleteToast(true);
  }, [location.state]);

  // Reload when the selected outlet changes so the list never shows another
  // outlet's customers (the cache is also wiped on switch in SelectedOutletContext).
  useEffect(() => {
    loadCustomers();
  }, [selectedOutletId]);

  useEffect(() => {
    customerGroupService.getCustomerGroups()
      .then((r) => setCustomerGroups(r.customerGroups || []))
      .catch(() => {});
    priceListService.getPriceLists()
      .then((r) => setPriceLists(r.priceLists || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const q = searchTerm.toLowerCase();
    const filtered = customers.filter((customer) => {
      const matchesSearch =
        !q ||
        customer.firstName?.toLowerCase().includes(q) ||
        customer.lastName?.toLowerCase().includes(q) ||
        customer.company?.toLowerCase().includes(q) ||
        emailsOf(customer).some((e) => e.toLowerCase().includes(q)) ||
        phonesOf(customer).some((p) => p.toLowerCase().includes(q));
      const matchesGroup =
        selectedGroups.length === 0 ||
        selectedGroups.includes(customer.customerGroupId ? String(customer.customerGroupId) : '__none__');
      const matchesPriceList =
        selectedPriceLists.length === 0 ||
        (customer.priceListId != null && selectedPriceLists.includes(String(customer.priceListId)));
      return matchesSearch && matchesGroup && matchesPriceList;
    });
    // Single funnel point for display order: the IndexedDB cache returns id order and the API
    // returns firstName/lastName order, so always sort name A-Z (case-insensitive) here.
    filtered.sort((a, b) => fullNameOf(a).localeCompare(fullNameOf(b), undefined, { sensitivity: 'base' }));
    setFilteredCustomers(filtered);
  }, [customers, searchTerm, selectedGroups, selectedPriceLists]);

  const loadCustomers = async () => {
    await posLocalDb.init();
    const cached = await posLocalDb.getStoreAll('customers');
    if (cached.length > 0) {
      setCustomers(cached);
      setLoading(false);
      const stale = await posLocalDb.isStoreStale('customers');
      if (stale) {
        // skipOutletScope: the customers list always shows the full roster
        // (reference parity) — never narrowed to the open register's outlet.
        customerService.getCustomers({}, { skipOutletScope: true })
          .then(async (r) => {
            const items = r.customers || [];
            await posLocalDb.putStoreAll('customers', items);
            setCustomers(items);
          })
          .catch(() => {});
      }
      return;
    }
    try {
      setLoading(true);
      const response = await customerService.getCustomers({}, { skipOutletScope: true });
      const items = response.customers || [];
      await posLocalDb.putStoreAll('customers', items);
      setCustomers(items);
      setError('');
    } catch (err) {
      setError('Failed to load customers');
      console.error('Error loading customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewCustomer = (customer) => {
    navigate(`/customers/${customer.id}/view`);
  };

  const handleDeleteCustomer = (customerId) => {
    const customer = customers.find((c) => c.id === customerId);
    setCustomerToDelete(customer || { id: customerId });
    setDeleteDialogOpen(true);
  };

  const confirmDeleteCustomer = async () => {
    if (!customerToDelete || !customerToDelete.id) {
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
      return;
    }
    try {
      await customerService.deleteCustomer(customerToDelete.id);
      await posLocalDb.invalidateStore('customers');
      await loadCustomers();
      setDeleteToast(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete customer');
      console.error('Error deleting customer:', err);
    } finally {
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
    }
  };

  // Export Customers -> CSV, using the selected detail level's column set.
  const exportCustomers = (scope) => {
    const columns = scope === 'full' ? FULL_COLUMNS : SIMPLE_COLUMNS;
    const headers = columns.map(([h]) => h);
    const rows = filteredCustomers.map((c) => columns.map(([, get]) => get(c)));
    const blob = new Blob([buildCsv([headers, ...rows])], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customers.csv';
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  // Import Customers -> creates NEW customers only (per Shopfront help docs). Headers are matched
  // loosely via IMPORT_COLUMNS; first_name + last_name are required; unknown columns ignored.
  // Every failed row keeps its CSV row number and the server's reason so the result can list them.
  const runImport = async () => {
    if (!importFile) return;
    // Outlet is required on customer create; the import must follow the same
    // rule or the rows land with outletId:null and are invisible everywhere.
    // Scoped users are pinned server-side; super admins use the selected outlet.
    const importOutletId = parseInt(localStorage.getItem('selectedOutletId'), 10) || null;
    let isSuperAdmin = false;
    try {
      const u = JSON.parse(localStorage.getItem('user') || 'null');
      isSuperAdmin = u?.isSuperAdmin === true || (u?.hasAllPermission === true && u?.outletId == null);
    } catch { /* ignore */ }
    if (isSuperAdmin && !importOutletId) {
      setImportResult({ severity: 'error', text: 'Select an outlet (location selector) before importing customers.' });
      return;
    }
    setImportBusy(true);
    setImportResult(null);
    try {
      const rows = parseCsv(await importFile.text());
      const headers = (rows.shift() || []).map((h) => h.trim());
      const colIndex = {};
      headers.forEach((h, i) => { if (colIndex[normHeader(h)] === undefined) colIndex[normHeader(h)] = i; });
      const failures = [];
      let created = 0;
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        if (!row.some((v) => v.trim())) continue;
        const rowNo = r + 2; // header was shift()ed off
        const get = (names) => {
          for (const n of names) {
            const i = colIndex[normHeader(n)];
            if (i !== undefined && row[i]?.trim()) return row[i].trim();
          }
          return '';
        };
        const payload = {
          birthday: get(['birthday']) || null,
          loyaltyPoints: parseInt(get(['loyalty_points']), 10) || 0,
          ...(importOutletId ? { outletId: importOutletId } : {}),
        };
        for (const [field, names] of Object.entries(IMPORT_COLUMNS)) {
          const value = get(names);
          if (value) payload[field] = value;
        }
        const emails = get(['email', 'emails', 'email_addresses']);
        if (emails) payload.emails = emails.split(';').map((e) => e.trim()).filter(Boolean);
        if (!payload.firstName || !payload.lastName) {
          failures.push(`Row ${rowNo}: ${payload.firstName ? 'Last' : 'First'} name is required`);
          continue;
        }
        try {
          await customerService.createCustomer(payload);
          created++;
        } catch (err) {
          const data = err.response?.data;
          failures.push(`Row ${rowNo}: ${data?.details?.[0]?.msg || data?.error || err.message || 'Failed'}`);
        }
      }
      await posLocalDb.invalidateStore('customers');
      await loadCustomers();
      setImportResult({
        severity: failures.length ? 'warning' : 'info',
        text: [`Imported ${created} customer(s)${failures.length ? `, ${failures.length} skipped` : ''}.`, ...failures].join('\n'),
      });
      setImportFile(null);
      // Clear the native input too, else the box keeps showing the file while Import is disabled.
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setImportResult({ severity: 'error', text: err.message || 'Import failed' });
    } finally {
      setImportBusy(false);
    }
  };

  const groupOptions = [
    { value: '__none__', label: 'No Group' },
    ...customerGroups.map((g) => ({ value: String(g.id), label: g.name })),
  ];
  const priceListOptions = priceLists.map((p) => ({ value: String(p.id), label: p.name }));

  return (
    <Box sx={{ p: 3 }}>
      {/* Header + toolbar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="h4" component="h1" fontWeight="bold" sx={{ fontSize: 30 }}>
            Customers
          </Typography>
          <Button
            component={RouterLink}
            to="/customers/new"
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ bgcolor: '#5ebbeb', '&:hover': { bgcolor: '#0ea5e9', boxShadow: 'none' }, transition: 'none', borderRadius: '12px', textTransform: 'none', boxShadow: 'none', fontWeight: 700, fontSize: 16, px: '32px', py: '8px', border: '1px solid #5ebbeb' }}
          >
            Add Customer
          </Button>
          <Button startIcon={<ExportIcon />} onClick={() => setExportOpen(true)} sx={outlinedBtnSx}>
            Export Customers
          </Button>
          <Button startIcon={<ImportIcon />} onClick={() => setImportOpen(true)} sx={outlinedBtnSx}>
            Import Customers
          </Button>
          <Button component={RouterLink} to="/customers/merge" startIcon={<MergeIcon />} sx={outlinedBtnSx}>
            Merge Customers
          </Button>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="h4" fontWeight="bold" lineHeight={1}>
            {filteredCustomers.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Results
          </Typography>
        </Box>
      </Box>

      {/* Search + filter block */}
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ mb: 0.5, fontSize: 14, color: '#676b72' }}>Search</Typography>
        <TextField
          fullWidth
          placeholder="Search Customers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{
            backgroundColor: 'white',
            '& .MuiOutlinedInput-root': {
              height: 40,
              borderRadius: '8px',
              fontSize: 16,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' },
            },
          }}
        />
        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <MultiSelectFilter label="Customer Group" options={groupOptions} selected={selectedGroups} onChange={setSelectedGroups} />
          <MultiSelectFilter label="Price List" options={priceListOptions} selected={selectedPriceLists} onChange={setSelectedPriceLists} />
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {loading && customers.length === 0 ? (
        <PageLoader />
      ) : (
        <TableContainer sx={{ mt: 1 }}>
          <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <TableHead>
              <TableRow
                sx={{
                  '& th': { bgcolor: '#5ebbeb', color: '#f8f8f8', fontWeight: 700, fontSize: 16, border: 0, height: 51, py: 0 },
                  '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
                  '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' },
                }}
              >
                <TableCell>Customer</TableCell>
                <TableCell>Group</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Performance</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody
              sx={{
                '& tr:nth-of-type(odd)': { bgcolor: '#ffffff' },
                '& tr:nth-of-type(even)': { bgcolor: '#f5f5f5' },
                '& td': { border: 0, fontSize: 16, color: '#000', py: 1.5 },
              }}
            >
              {filteredCustomers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <Typography
                      component="a"
                      onClick={() => handleViewCustomer(customer)}
                      sx={{ fontSize: 16, color: '#000', cursor: 'pointer', textDecoration: 'none', '&:hover': { textDecoration: 'none' } }}
                    >
                      {customer.firstName} {customer.lastName}
                    </Typography>
                    {customer.code && (
                      <Typography sx={{ fontSize: 14, color: '#676b72' }}>{customer.code}</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 16, color: '#000' }}>
                      {customer.customerGroup?.name || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box>
                      {emailsOf(customer).map((e, i) => (
                        <Typography key={i} sx={{ fontSize: 16, color: '#000' }}>{e}</Typography>
                      ))}
                      {phonesOf(customer).map((p, i) => (
                        <Typography key={i} sx={{ fontSize: 16, color: '#000' }}>{p}</Typography>
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <PerformanceGraph
                      customerId={customer.id}
                      currentOwing={customer.currentOwing || 0}
                      showAmount={false}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', gap: 3, justifyContent: 'flex-end', alignItems: 'center' }}>
                      <Button
                        component={RouterLink}
                        to={`/customers/${customer.id}/view`}
                        startIcon={<ViewIcon />}
                        sx={rowActionSx('#0284c7')}
                      >
                        View
                      </Button>
                      <Button
                        component={RouterLink}
                        to={`/customers/${customer.id}`}
                        startIcon={<EditIcon />}
                        sx={rowActionSx('#16a34a')}
                      >
                        Edit
                      </Button>
                      <Button
                        startIcon={<DeleteIcon />}
                        onClick={() => handleDeleteCustomer(customer.id)}
                        sx={rowActionSx('#dc2626')}
                      >
                        Delete
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {filteredCustomers.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      {searchTerm ? 'No customers found matching your search' : 'No customers found'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        title="Delete Customer"
        message={`Are you sure you wish to delete ${`${customerToDelete?.firstName || ''} ${customerToDelete?.lastName || ''}`.trim()} ?`}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setCustomerToDelete(null);
        }}
        onConfirm={confirmDeleteCustomer}
      />

      {/* Export scope dialog */}
      <Dialog open={exportOpen} onClose={() => setExportOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Export Customers</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1.5, fontSize: 14, color: '#676b72' }}>
            What level of detail would you like to export? *
          </Typography>
          <Autocomplete
            options={['Simple', 'Full']}
            value={exportScope}
            onChange={(e, v) => setExportScope(v)}
            disableClearable
            renderInput={(params) => (
              <TextField
                {...params}
                required
                placeholder="Select..."
                sx={{
                  backgroundColor: 'white',
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    fontSize: 16,
                    minHeight: 42,
                    py: 0,
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' },
                  },
                }}
              />
            )}
          />
          {/* Reference: both column sets always listed as bullets under the select. */}
          <Box sx={{ mt: 1.5, fontSize: 14, color: 'text.secondary' }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>Simple</Typography>
            <Box component="ul" sx={{ mt: 0.5, mb: 1, pl: 3 }}>
              {['Name', 'Company', 'Code', 'Birthday', 'Email Addresses', 'Phone Numbers', 'Subscribed to Marketing Emails'].map((c) => (
                <li key={c}>{c}</li>
              ))}
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>Full</Typography>
            <Box component="ul" sx={{ mt: 0.5, mb: 1, pl: 3 }}>
              <li>All customer details, including current loyalty points and owing</li>
            </Box>
            <Typography variant="body2">The current filters and search are applied.</Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setExportOpen(false)} sx={grayFilledBtnSx}>Cancel</Button>
          <Button
            onClick={() => exportCustomers(exportScope.toLowerCase())}
            disabled={!exportScope}
            variant="contained"
            sx={skyFilledBtnSx}
          >
            Export
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import dialog — reference: light-blue header bar w/ '?' icon + white title, format-help link, gray Cancel, sky Import */}
      <Dialog
        open={importOpen}
        onClose={() => { setImportOpen(false); setImportFile(null); setImportResult(null); }}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '8px' } }}
      >
        <DialogTitle sx={{ bgcolor: '#5ebbeb', color: '#fff', fontWeight: 700, fontSize: 18, display: 'flex', alignItems: 'center', gap: 1, py: 1.5 }}>
          <HelpIcon sx={{ color: '#fff' }} />
          Import Customers
        </DialogTitle>
        <DialogContent sx={{ pt: '20px !important' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Looking for the file format?{' '}
            <Box
              component="a"
              href="https://support.onshopfront.com/hc/en-us/articles/115003820631-Customer-Management"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: '#0284c7', textDecoration: 'underline', cursor: 'pointer' }}
            >
              Click here.
            </Box>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Required columns: first_name and last_name. Please select the file to import:
          </Typography>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
          {importResult && (
            <Alert severity={importResult.severity} sx={{ mt: 2, whiteSpace: 'pre-line' }}>{importResult.text}</Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => { setImportOpen(false); setImportFile(null); setImportResult(null); }} sx={grayFilledBtnSx}>Cancel</Button>
          <Button
            onClick={runImport}
            disabled={!importFile || importBusy}
            variant="contained"
            startIcon={importBusy ? <CircularProgress size={16} color="inherit" /> : null}
            sx={skyFilledBtnSx}
          >
            Import
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={deleteToast}
        autoHideDuration={4000}
        onClose={() => setDeleteToast(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message="Customer successfully deleted"
      />
    </Box>
  );
};

export default Customers;
