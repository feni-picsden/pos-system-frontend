import React, { useState, useEffect } from 'react';
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
  Dialog,
  DialogContent,
  List,
  ListItemButton,
  ListItemText,
  IconButton,
} from '@mui/material';
import {
  Add as AddIcon,
  EditOutlined as EditIcon,
  DeleteOutline as DeleteIcon,
  VisibilityOutlined as ViewIcon,
  Link as AssignIcon,
  AccountTreeOutlined as MergeIcon,
  CloseOutlined as CloseIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import supplierService from '../../services/supplierService';
import { SHOW_MASTER_DATABASE_REF } from '../../utils/featureFlags';
import CreatingForOutlet from '../../components/Common/CreatingForOutlet';
import usePageCache from '../../hooks/usePageCache';
import PerformanceGraph from '../../components/Classifications/PerformanceGraph';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import GlobalOutletFilter, { useGlobalOutlet } from '../../components/Common/GlobalOutletFilter';
import { useSelectedRegister } from '../../contexts/SelectedRegisterContext';

const ADD_SUPPLIER_ACTION = 'suppliers.add';

// Header buttons: same as Products / Customer Groups (12px radius, 42px, bold 16).
const headerButtonSx = {
  borderRadius: '12px',
  textTransform: 'none',
  boxShadow: 'none',
  fontWeight: 700,
  fontSize: 16,
  px: 4,
  height: 42,
  transition: 'none',
};

// Row actions: flat, fixed-width, instant grey hover, no ripple (Customer Groups list).
const rowActionSx = (color, width) => ({
  color,
  width,
  height: 42,
  borderRadius: '12px',
  textTransform: 'none',
  fontWeight: 700,
  fontSize: 16,
  transition: 'none',
  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)', color },
});

// Reference row actions are plain links: fw400, no button padding, color+underline hover, no bg tint
const actionLinkSx = {
  textTransform: 'none',
  fontWeight: 400,
  fontSize: 16,
  minWidth: 0,
  minHeight: 0,
  p: 0,
  lineHeight: '25px',
  transition: 'color 0.3s ease',
  '&:hover': { backgroundColor: 'transparent', textDecoration: 'underline' },
};

// Reference search field: 42px wrapper around a 40px input, 1px #404040 outline, 8px radius
const searchFieldSx = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: '#fff',
    borderRadius: '8px',
    fontSize: 16,
    height: 42,
    '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #404040' },
    '&:hover .MuiOutlinedInput-notchedOutline': { border: '1px solid #404040' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: '2px solid #000' },
  },
  '& .MuiOutlinedInput-input': { padding: '8px 16px' },
  '& .MuiOutlinedInput-input::placeholder': { color: '#808080', opacity: 1 },
};

// Supplier Merge: sections + fields exactly as the reference result rail lists them.
const MERGE_SECTIONS = [
  {
    key: 'general',
    title: 'General',
    fields: [
      ['name', 'Name*'],
      ['status', 'Status*'],
      ['businessNumber', 'Business Number'],
      ['accountNumber', 'Account Number'],
      ...(SHOW_MASTER_DATABASE_REF ? [['masterDatabaseRef', 'Master Database Reference']] : []),
    ],
  },
  {
    key: 'contact',
    title: 'Contact',
    fields: [
      ['email', 'Emails'],
      ['fax', 'Fax'],
      ['phone', 'Phone'],
      ['mobile', 'Mobile'],
      ['website', 'Website'],
      ['twitter', 'Twitter'],
      ['facebook', 'Facebook'],
    ],
  },
  {
    key: 'address',
    title: 'Address',
    fields: [
      ['streetAddress1', 'Street Address 1'],
      ['streetAddress2', 'Street Address 2'],
      ['suburb', 'Suburb'],
      ['city', 'City'],
      ['postCode', 'Post Code'],
      ['region', 'Region'],
      ['country', 'Country'],
    ],
  },
  {
    key: 'additionalContacts',
    title: 'Additional Contacts',
    fields: [['additionalContacts', 'Additional Contacts']],
  },
  {
    key: 'ordering',
    title: 'Ordering',
    fields: [
      ['orderNotes', 'Order Notes'],
      ['internalOrderNotes', 'Internal Order Notes'],
      ['emailOrderAutomatically', 'Email Order Automatically'],
      ['emailFormat', 'Email Format'],
      ['allowOrdersBelowMinimum', 'allowOrderBelowMinimum'],
      ['minimumOrderValue', 'Minimum Order Value'],
      ['maximumOrderValue', 'Maximum Order Value'],
    ],
  },
  {
    key: 'receiving',
    title: 'Receiving',
    fields: [['paymentFeePercentage', 'Payment Fee Percentage']],
  },
];

// ponytail: mobile/website/twitter are display-only here — the suppliers table has no
// such columns, so sending them to PUT /suppliers/:id would blow up Prisma.
const UNWRITABLE_FIELDS = new Set(['mobile', 'website', 'twitter']);
const NUMBER_FIELDS = new Set(['minimumOrderValue', 'maximumOrderValue', 'paymentFeePercentage']);
const BOOLEAN_FIELDS = new Set(['emailOrderAutomatically', 'allowOrdersBelowMinimum']);
const CLEARED = '__cleared__';

const displayValue = (value) => {
  if (value === null || value === undefined || value === '') return 'No Value';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const contacts = Array.isArray(value) ? value : typeof value === 'object' ? Object.values(value) : null;
  if (contacts) return contacts.length ? `${contacts.length} Contact${contacts.length === 1 ? '' : 's'}` : 'No Value';
  return String(value);
};

// Same shape the supplier edit page persists: { contact_1: {...}, contact_2: {...} }
const toContactsObject = (value) => {
  if (!value) return null;
  const list = Array.isArray(value) ? value : Object.values(value);
  if (!list.length) return null;
  return list.reduce((acc, contact, index) => {
    acc[`contact_${index + 1}`] = contact;
    return acc;
  }, {});
};

const Suppliers = () => {
  // Renders from IndexedDB first, then revalidates in the background.
  const {
    data: suppliers,
    loading,
    refresh: loadSuppliers,
  } = usePageCache('suppliers', () =>
    supplierService.getSuppliers().then((r) => r.suppliers || [])
  );
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState(null);
  const [mergeList, setMergeList] = useState([]);
  const [fieldSource, setFieldSource] = useState({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [mergeConfirmOpen, setMergeConfirmOpen] = useState(false);
  const [merging, setMerging] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const mergeMode = searchParams.get('merge') === '1';

  // All Outlets (no header outlet / register): Outlet filter + Outlet column.
  const { globalMode, outletNameOf } = useGlobalOutlet();
  const [outletFilter, setOutletFilter] = useState(null);
  useEffect(() => { if (!globalMode) setOutletFilter(null); }, [globalMode]);

  useEffect(() => {
    const filtered = suppliers.filter(supplier =>
      supplier.name?.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (!outletFilter || supplier.outletId === outletFilter.id)
    );
    setFilteredSuppliers(filtered);
  }, [suppliers, searchTerm, outletFilter]);

  // No global suppliers from All Outlets (user 30/10/2026): Add first opens the
  // Outlet Selector (outlet rows only); once the navbar has switched, the
  // re-mounted page picks the pending action up and opens the create form.
  const { openOutletPicker, pendingOutletAction, clearPendingOutletAction } = useSelectedRegister();
  const handleAddSupplier = () => {
    if (globalMode) openOutletPicker(ADD_SUPPLIER_ACTION);
    else navigate('/suppliers/new');
  };
  useEffect(() => {
    if (pendingOutletAction === ADD_SUPPLIER_ACTION && !globalMode) {
      clearPendingOutletAction();
      navigate('/suppliers/new');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOutletAction, globalMode]);

  const handleDeleteSupplier = (supplierId) => {
    setSupplierToDelete(supplierId);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteSupplier = async () => {
    if (!supplierToDelete) {
      setDeleteDialogOpen(false);
      return;
    }
    try {
      await supplierService.deleteSupplier(supplierToDelete);
      await loadSuppliers();
    } catch (err) {
      setError('Failed to delete supplier');
      console.error('Error deleting supplier:', err);
    } finally {
      setDeleteDialogOpen(false);
      setSupplierToDelete(null);
    }
  };

  /* ------------------------------- Supplier Merge ------------------------------ */

  const openMerge = () => {
    setError('');
    setSearchParams({ merge: '1' });
  };

  const closeMerge = () => {
    setMergeList([]);
    setFieldSource({});
    setError('');
    setSearchParams({});
  };

  const addSupplierToMerge = async (supplier) => {
    setPickerOpen(false);
    setPickerSearch('');
    try {
      // The list endpoint only returns a summary — the merge needs every field.
      const response = await supplierService.getSupplier(supplier.id);
      setMergeList((prev) => [...prev, response.supplier || response]);
    } catch (err) {
      setError('Failed to load supplier details');
      console.error('Error loading supplier:', err);
    }
  };

  const removeSupplierFromMerge = (id) => {
    setMergeList((prev) => prev.filter((s) => s.id !== id));
    setFieldSource((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([, source]) => source !== id))
    );
  };

  const selectSection = (sectionKey, supplierId) => {
    const section = MERGE_SECTIONS.find((s) => s.key === sectionKey);
    setFieldSource((prev) => ({
      ...prev,
      ...Object.fromEntries(section.fields.map(([key]) => [key, supplierId])),
    }));
  };

  const resolvedValue = (field) => {
    const source = fieldSource[field];
    if (source === undefined) return undefined;
    if (source === CLEARED) return null;
    return mergeList.find((s) => s.id === source)?.[field];
  };

  const mergedName = (resolvedValue('name') || '').toString().trim();

  const buildMergePayload = () => {
    const payload = {};
    MERGE_SECTIONS.forEach((section) =>
      section.fields.forEach(([key]) => {
        if (UNWRITABLE_FIELDS.has(key)) return;
        const value = resolvedValue(key);
        if (value === undefined) return;
        if (NUMBER_FIELDS.has(key)) payload[key] = value === null || value === '' ? null : Number(value);
        else if (BOOLEAN_FIELDS.has(key)) payload[key] = Boolean(value);
        else if (key === 'additionalContacts') payload[key] = toContactsObject(value);
        else if (typeof value === 'string') payload[key] = value.trim() || null;
        else payload[key] = value;
      })
    );
    return payload;
  };

  // No backend /suppliers/merge endpoint exists: compose the merge from the existing
  // supplier endpoints — write the chosen values onto the surviving supplier, move every
  // product assignment across, then trash the suppliers that were merged in.
  const confirmMerge = async () => {
    const payload = buildMergePayload();
    const primary = mergeList.find((s) => s.id === fieldSource.name) || mergeList[0];
    setMerging(true);
    setError('');
    try {
      await supplierService.updateSupplier(primary.id, payload);
      for (const source of mergeList.filter((s) => s.id !== primary.id)) {
        const products = await supplierService.getSupplierProducts(source.id);
        const productIds = (products.assignedProducts || []).map((p) => p.id);
        if (productIds.length) {
          await supplierService.assignProducts(primary.id, productIds, 'assign');
          await supplierService.assignProducts(source.id, productIds, 'unassign');
        }
        await supplierService.deleteSupplier(source.id);
      }
      setMergeConfirmOpen(false);
      closeMerge();
      await loadSuppliers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to merge suppliers');
      console.error('Error merging suppliers:', err);
      setMergeConfirmOpen(false);
    } finally {
      setMerging(false);
    }
  };

  // Merge page uses the list page's look (user 30/10/2026): white rounded cards,
  // #5ebbeb header strips like the table head, alternating white/#f5f5f5 rows,
  // 12px-radius buttons.
  const mergeColumnSx = {
    width: 420,
    flexShrink: 0,
    bgcolor: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: '12px',
    p: 2,
  };

  const mergeCardSx = {
    mb: 2,
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid #e0e0e0',
    bgcolor: '#fff',
  };

  const mergeCardHeadSx = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    bgcolor: '#5ebbeb',
    px: 2,
    height: 51,
  };

  const mergeRowSx = (i) => ({ bgcolor: i % 2 === 0 ? '#fff' : '#f5f5f5' });

  const sectionButtonSx = {
    textTransform: 'none',
    fontSize: 14,
    fontWeight: 700,
    color: '#fff',
    borderRadius: '8px',
    border: '1px solid #fff',
    px: 1.5,
    height: 32,
    bgcolor: 'transparent',
    transition: 'none',
    '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
    '&.Mui-disabled': { color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.6)' },
  };

  const pageButtonSx = {
    borderRadius: '12px',
    textTransform: 'none',
    boxShadow: 'none',
    fontWeight: 700,
    fontSize: 16,
    px: 4,
    height: 42,
    transition: 'none',
  };

  const renderResultRail = () => (
    <Box sx={mergeColumnSx}>
      <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#000', mb: 2 }}>Results</Typography>
      {MERGE_SECTIONS.map((section) => (
        <Box key={section.key} sx={mergeCardSx}>
          <Box sx={mergeCardHeadSx}>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{section.title}</Typography>
            <Button
              disableRipple
              disabled={mergeList.length === 0}
              onClick={() => selectSection(section.key, mergeList[0]?.id)}
              sx={sectionButtonSx}
            >
              Select Section
            </Button>
          </Box>
          {section.fields.map(([key, label], i) => (
            <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, ...mergeRowSx(i) }}>
              <Typography sx={{ fontSize: 14, color: '#676b72', width: 170, flexShrink: 0 }}>{label}</Typography>
              <Typography sx={{ fontSize: 14, color: '#000', flexGrow: 1, wordBreak: 'break-word' }}>
                {displayValue(resolvedValue(key))}
              </Typography>
              {fieldSource[key] !== undefined && fieldSource[key] !== CLEARED && (
                <Button
                  disableRipple
                  onClick={() => setFieldSource((prev) => ({ ...prev, [key]: CLEARED }))}
                  sx={{ ...actionLinkSx, fontSize: 14, color: '#e33430', flexShrink: 0 }}
                >
                  Clear
                </Button>
              )}
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );

  const renderSupplierColumn = (supplier) => (
    <Box key={supplier.id} sx={mergeColumnSx}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#000' }}>{supplier.name}</Typography>
        <IconButton aria-label="Remove supplier" onClick={() => removeSupplierFromMerge(supplier.id)}>
          <CloseIcon sx={{ color: '#e33430' }} />
        </IconButton>
      </Box>
      {MERGE_SECTIONS.map((section) => (
        <Box key={section.key} sx={mergeCardSx}>
          <Box sx={mergeCardHeadSx}>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{section.title}</Typography>
            <Button disableRipple onClick={() => selectSection(section.key, supplier.id)} sx={sectionButtonSx}>
              Select Section
            </Button>
          </Box>
          {section.fields.map(([key, label], i) => {
            const selected = fieldSource[key] === supplier.id;
            return (
              <Box
                key={key}
                component="button"
                type="button"
                onClick={() => setFieldSource((prev) => ({ ...prev, [key]: supplier.id }))}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  width: '100%',
                  textAlign: 'left',
                  px: 2,
                  py: 1,
                  cursor: 'pointer',
                  font: 'inherit',
                  ...mergeRowSx(i),
                  ...(selected ? { bgcolor: '#e8f4fb' } : {}),
                  border: 0,
                  borderLeft: selected ? '3px solid #5ebbeb' : '3px solid transparent',
                  transition: 'none',
                  '&:hover': { bgcolor: '#e8f4fb' },
                }}
              >
                <Box
                  sx={{
                    width: 14,
                    height: 14,
                    flexShrink: 0,
                    borderRadius: '50%',
                    border: '1px solid #404040',
                    bgcolor: selected ? '#5ebbeb' : 'transparent',
                  }}
                />
                <Typography sx={{ fontSize: 14, color: '#676b72', width: 156, flexShrink: 0 }}>{label}</Typography>
                <Typography sx={{ fontSize: 14, color: '#000', flexGrow: 1, wordBreak: 'break-word' }}>
                  {displayValue(supplier[key])}
                </Typography>
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );

  const renderMergePage = () => (
    <Box sx={{ p: 2, minHeight: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight="bold">Supplier Merge</Typography>
        <Button
          variant="contained"
          disableRipple
          startIcon={<MergeIcon />}
          disabled={mergeList.length < 2 || !mergedName}
          onClick={() => setMergeConfirmOpen(true)}
          sx={{
            ...pageButtonSx,
            bgcolor: '#5ebbeb',
            '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' },
            '&.Mui-disabled': { bgcolor: '#5ebbeb', color: '#fff', opacity: 0.5 },
          }}
        >
          Merge Suppliers
        </Button>
        <Button
          variant="outlined"
          disableRipple
          onClick={closeMerge}
          sx={{
            ...pageButtonSx,
            color: '#707072',
            borderColor: '#8e8e8e',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.05)', borderColor: '#8e8e8e', boxShadow: 'none' },
          }}
        >
          Cancel
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, overflowX: 'auto', pb: 2 }}>
        {renderResultRail()}
        {mergeList.map(renderSupplierColumn)}
        <Box
          component="button"
          type="button"
          onClick={() => setPickerOpen(true)}
          sx={{
            width: 420,
            flexShrink: 0,
            minHeight: 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#fff',
            border: '2px dashed #bfe6fb',
            borderRadius: '12px',
            color: '#5ebbeb',
            fontSize: 18,
            fontWeight: 700,
            fontFamily: 'inherit',
            cursor: 'pointer',
            transition: 'none',
            '&:hover': { borderColor: '#5ebbeb', bgcolor: '#f5fbff' },
          }}
        >
          + Add Supplier
        </Box>
      </Box>

      {/* Add-a-supplier picker: same chrome as the Customers Export/Import dialogs */}
      <Dialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        PaperProps={{ elevation: 0, sx: { width: 400, maxWidth: '92vw', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 0 30px 0 rgba(0,0,0,.25), 0 15px 30px 0 rgba(0,0,0,.19)' } }}
      >
        <Box sx={{ bgcolor: '#bfe6fb', px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box component="span" sx={{ color: '#0369a1', fontSize: 20, fontWeight: 700, lineHeight: 1 }}>?</Box>
          <Typography sx={{ color: '#0369a1', fontSize: 18 }}>Add a Supplier</Typography>
        </Box>
        {/* This form sends no outletId: a global admin creates a global supplier. Say so. */}
        <CreatingForOutlet sx={{ mx: 2, mt: 1 }} />
        <DialogContent sx={{ px: 2, pt: 2 }}>
          <TextField
            autoFocus
            fullWidth
            spellCheck={false}
            placeholder="Search for Suppliers"
            value={pickerSearch}
            onChange={(e) => setPickerSearch(e.target.value)}
            sx={{ mb: 1, ...searchFieldSx }}
          />
          <List dense>
            {suppliers
              .filter(
                (s) =>
                  !mergeList.some((m) => m.id === s.id) &&
                  s.name?.toLowerCase().includes(pickerSearch.toLowerCase())
              )
              .map((s) => (
                <ListItemButton
                  key={s.id}
                  onClick={() => addSupplierToMerge(s)}
                  sx={{ borderRadius: '8px', '&:hover': { bgcolor: '#5ebbeb', '& .MuiListItemText-primary': { color: '#fff' } } }}
                >
                  <ListItemText primary={s.name} primaryTypographyProps={{ fontSize: 16, color: '#000' }} />
                </ListItemButton>
              ))}
          </List>
        </DialogContent>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 2, pb: 2 }}>
          <Button
            disableRipple
            onClick={() => setPickerOpen(false)}
            sx={{ bgcolor: '#d4d4d4', color: '#000', height: 42, borderRadius: '8px', textTransform: 'none', fontWeight: 700, fontSize: 16, px: 3, '&:hover': { bgcolor: '#c4c4c4' } }}
          >
            Cancel
          </Button>
        </Box>
      </Dialog>

      <ConfirmDeleteDialog
        open={mergeConfirmOpen}
        title="Merge Suppliers"
        message={`All purchase history from the merged suppliers is moved into "${mergedName}" and the other suppliers are removed. This cannot be reversed.`}
        confirmText="Continue"
        loadingText="Merging..."
        loading={merging}
        onCancel={() => setMergeConfirmOpen(false)}
        onConfirm={confirmMerge}
      />
    </Box>
  );

  if (mergeMode) return renderMergePage();

  return (
    <Box sx={{ p: 2 }}>
      {/* Header (user design 30/10/2026): bold title, blue Add, outlined Merge, Results right */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h4" component="h1" fontWeight="bold">
            Suppliers
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddSupplier}
            sx={{ ...headerButtonSx, bgcolor: '#5ebbeb', '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' } }}
          >
            Add Supplier
          </Button>
          <Button
            variant="outlined"
            startIcon={<MergeIcon />}
            onClick={openMerge}
            sx={{ ...headerButtonSx, bgcolor: 'transparent', color: '#707072', borderColor: '#8e8e8e', '&:hover': { bgcolor: 'rgba(0,0,0,0.05)', borderColor: '#8e8e8e', boxShadow: 'none' } }}
          >
            Merge Suppliers
          </Button>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="h4" lineHeight={1}>
            {filteredSuppliers.length}
          </Typography>
          <Typography variant="body2" sx={{ color: '#000' }}>
            Results
          </Typography>
        </Box>
      </Box>

      {/* Search (full width) + Outlet filter beside it on All Outlets (2/3 + 1/3) */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', mb: 3 }}>
        <Box sx={{ flex: 2, minWidth: 0 }}>
          <Typography sx={{ mb: 0.5, fontWeight: 400, fontSize: 16, color: '#000' }}>Search</Typography>
          <TextField
            spellCheck={false}
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ width: '100%', ...searchFieldSx }}
          />
        </Box>
        <GlobalOutletFilter value={outletFilter} onChange={setOutletFilter} sx={{ flex: 1, minWidth: 0 }} />
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Loading - use global loader only */}
      {loading ? null : (
        /* Suppliers Table */
        <TableContainer>
          <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <TableHead>
              <TableRow
                sx={{
                  '& th': {
                    bgcolor: '#5ebbeb',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 16,
                    border: 0,
                    height: 51,
                    py: 0,
                    whiteSpace: 'nowrap',
                  },
                  '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
                  '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' },
                }}
              >
                {globalMode && <TableCell sx={{ width: 180 }}>Outlet</TableCell>}
                <TableCell>Name</TableCell>
                <TableCell sx={{ width: 160 }}>Product Count</TableCell>
                <TableCell align="center" sx={{ width: 240 }}>Performance</TableCell>
                <TableCell align="center" sx={{ width: 560 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody
              sx={{
                '& tr:nth-of-type(odd)': { bgcolor: '#ffffff' },
                '& tr:nth-of-type(even)': { bgcolor: '#f5f5f5' },
                '& td': { border: 0, fontSize: 16, color: '#000', py: 1.5 }
              }}
            >
              {filteredSuppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  {globalMode && (
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography sx={{ fontSize: 16, color: '#000' }}>{outletNameOf(supplier.outletId)}</Typography>
                    </TableCell>
                  )}
                  <TableCell>
                    <Typography sx={{ fontSize: 16, color: '#000' }}>
                      {supplier.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 16, color: '#000' }}>
                      {supplier.productCount || 0}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ '& > *': { mx: 'auto' } }}>
                    <PerformanceGraph
                      supplierId={supplier.id}
                      productCount={supplier.productCount || 0}
                      type="supplier"
                      width={200}
                      height={80}
                    />
                  </TableCell>
                  <TableCell align="center">
                    {/* One row, like the other lists: View / Edit / Assign / Delete */}
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', alignItems: 'center' }}>
                      <Button disableRipple startIcon={<ViewIcon />} component={RouterLink} to={`/suppliers/${supplier.id}/view`} sx={rowActionSx('#0284c7', 120)}>
                        View
                      </Button>
                      <Button disableRipple startIcon={<EditIcon />} component={RouterLink} to={`/suppliers/${supplier.id}/edit`} sx={rowActionSx('#16a34a', 110)}>
                        Edit
                      </Button>
                      <Button disableRipple startIcon={<AssignIcon />} component={RouterLink} to={`/suppliers/${supplier.id}/assign`} sx={rowActionSx('#ea7317', 130)}>
                        Assign
                      </Button>
                      <Button disableRipple startIcon={<DeleteIcon />} onClick={() => handleDeleteSupplier(supplier.id)} sx={rowActionSx('#dc2626', 130)}>
                        Delete
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {filteredSuppliers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={globalMode ? 5 : 4} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No suppliers found
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
        title="Delete Supplier"
        message="Are you sure you want to delete this supplier?"
        onCancel={() => {
          setDeleteDialogOpen(false);
          setSupplierToDelete(null);
        }}
        onConfirm={confirmDeleteSupplier}
      />
    </Box>
  );
};

export default Suppliers;
