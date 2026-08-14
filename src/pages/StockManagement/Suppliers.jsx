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
  DialogTitle,
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
  KeyboardArrowDown as ChevronDownIcon,
  KeyboardArrowUp as ChevronUpIcon,
  AccountTreeOutlined as MergeIcon,
  CloseOutlined as CloseIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import supplierService from '../../services/supplierService';
import usePageCache from '../../hooks/usePageCache';
import PerformanceGraph from '../../components/Classifications/PerformanceGraph';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';

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

const TRAY_SHADOW = '0 4px 8px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08)';

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
      ['masterDatabaseRef', 'Master Database Reference'],
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
  const [functionsOpen, setFunctionsOpen] = useState(false);
  const [mergeList, setMergeList] = useState([]);
  const [fieldSource, setFieldSource] = useState({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [mergeConfirmOpen, setMergeConfirmOpen] = useState(false);
  const [merging, setMerging] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const mergeMode = searchParams.get('merge') === '1';

  useEffect(() => {
    const filtered = suppliers.filter(supplier =>
      supplier.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredSuppliers(filtered);
  }, [suppliers, searchTerm]);

  // Functions tray is an inline disclosure: Esc closes it (the tab itself toggles).
  useEffect(() => {
    if (!functionsOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setFunctionsOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [functionsOpen]);

  const handleAddSupplier = () => {
    navigate('/suppliers/new');
  };

  const handleViewSupplier = (supplier) => {
    navigate(`/suppliers/${supplier.id}/view`);
  };

  const handleEditSupplier = (supplier) => {
    navigate(`/suppliers/${supplier.id}/edit`);
  };

  const handleAssignSupplier = (supplier) => {
    navigate(`/suppliers/${supplier.id}/assign`);
  };

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
    setFunctionsOpen(false);
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

  const mergeCardSx = {
    bgcolor: '#e8f4fb',
    border: '1px solid #5ebbeb',
    p: 2,
    mb: 2,
  };

  const sectionButtonSx = {
    textTransform: 'none',
    fontSize: 14,
    fontWeight: 400,
    color: '#5ebbeb',
    borderRadius: 0,
    border: '1px solid #5ebbeb',
    px: 1.5,
    py: 0.25,
    bgcolor: '#fff',
    '&:hover': { bgcolor: '#5ebbeb', color: '#f8f8f8' },
    '&.Mui-disabled': { color: '#737373', borderColor: '#737373' },
  };

  const renderResultRail = () => (
    <Box sx={{ width: 420, flexShrink: 0, bgcolor: '#e5e5e5', p: 2 }}>
      <Typography sx={{ fontSize: 24, fontWeight: 400, color: '#000', mb: 2 }}>Results</Typography>
      {MERGE_SECTIONS.map((section) => (
        <Box key={section.key} sx={mergeCardSx}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#000' }}>{section.title}</Typography>
            <Button
              disableRipple
              disabled={mergeList.length === 0}
              onClick={() => selectSection(section.key, mergeList[0]?.id)}
              sx={sectionButtonSx}
            >
              Select Section
            </Button>
          </Box>
          {section.fields.map(([key, label]) => (
            <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
              <Typography sx={{ fontSize: 14, color: '#676b72', width: 190, flexShrink: 0 }}>{label}</Typography>
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
    <Box key={supplier.id} sx={{ width: 420, flexShrink: 0, bgcolor: '#f8f8f8', p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography sx={{ fontSize: 24, fontWeight: 400, color: '#000' }}>{supplier.name}</Typography>
        <IconButton aria-label="Remove supplier" onClick={() => removeSupplierFromMerge(supplier.id)}>
          <CloseIcon sx={{ color: '#e33430' }} />
        </IconButton>
      </Box>
      {MERGE_SECTIONS.map((section) => (
        <Box key={section.key} sx={mergeCardSx}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#000' }}>{section.title}</Typography>
            <Button disableRipple onClick={() => selectSection(section.key, supplier.id)} sx={sectionButtonSx}>
              Select Section
            </Button>
          </Box>
          {section.fields.map(([key, label]) => {
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
                  p: 0.5,
                  cursor: 'pointer',
                  font: 'inherit',
                  bgcolor: selected ? '#fff' : 'transparent',
                  border: selected ? '1px solid #5ebbeb' : '1px solid transparent',
                  borderRadius: 0,
                  transition: 'background 0.2s ease',
                  '&:hover': { bgcolor: '#fff' },
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
                <Typography sx={{ fontSize: 14, color: '#676b72', width: 176, flexShrink: 0 }}>{label}</Typography>
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
    <Box sx={{ p: 2, bgcolor: '#f5f5f5', minHeight: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography sx={{ fontSize: 24, fontWeight: 400, color: '#000' }}>Supplier Merge</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            disableRipple
            startIcon={<MergeIcon />}
            disabled={mergeList.length < 2 || !mergedName}
            onClick={() => setMergeConfirmOpen(true)}
            sx={{
              bgcolor: '#32b643',
              color: '#f8f8f8',
              fontSize: 24,
              fontWeight: 400,
              textTransform: 'none',
              borderRadius: 0,
              padding: '8px 16px',
              whiteSpace: 'nowrap',
              transition: 'background 0.2s ease, color 0.2s ease',
              '&:hover': { bgcolor: '#f8f8f8', color: '#32b643' },
              '&.Mui-disabled': { bgcolor: '#404040', color: '#737373' },
            }}
          >
            Merge Suppliers
          </Button>
          <IconButton aria-label="Close" onClick={closeMerge}>
            <CloseIcon sx={{ color: '#000' }} />
          </IconButton>
        </Box>
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
            bgcolor: '#f8f8f8',
            border: '2px dashed #d9d9d9',
            color: '#5ebbeb',
            fontSize: 20,
            cursor: 'pointer',
            transition: 'background 0.2s ease, border-color 0.2s ease',
            '&:hover': { borderColor: '#5ebbeb', bgcolor: '#e8f4fb' },
          }}
        >
          + Click to add a new supplier to merge
        </Box>
      </Box>

      <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontSize: 20, fontWeight: 400 }}>Add a Supplier</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
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
                <ListItemButton key={s.id} onClick={() => addSupplierToMerge(s)}>
                  <ListItemText primary={s.name} primaryTypographyProps={{ fontSize: 16, color: '#000' }} />
                </ListItemButton>
              ))}
          </List>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={mergeConfirmOpen}
        title="Merge Suppliers"
        message={`All purchase history from the merged suppliers is moved into "${mergedName}" and the other suppliers are removed. This cannot be reversed.`}
        confirmText="Merge"
        loadingText="Merging..."
        loading={merging}
        onCancel={() => setMergeConfirmOpen(false)}
        onConfirm={confirmMerge}
      />
    </Box>
  );

  if (mergeMode) return renderMergePage();

  return (
    <Box sx={{ p: 2, position: 'relative' }}>
      {/* Functions tray: absolute, slides down over the toolbar (z-index 1) */}
      <Box
        sx={{
          position: 'absolute',
          // reference tray: top flush with the page frame, inset 78px from the content edge
          top: 0,
          left: '94px',
          right: '94px',
          height: 100,
          overflow: 'hidden',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            height: 80,
            p: 2,
            bgcolor: '#f8f8f8',
            pointerEvents: functionsOpen ? 'auto' : 'none',
            transform: functionsOpen ? 'translateY(0)' : 'translateY(-80px)',
            transition: 'transform 0.2s ease, box-shadow 0.4s ease',
            boxShadow: functionsOpen ? TRAY_SHADOW : 'none',
            '& > button': { mr: 2 },
            '& > button:last-child': { mr: 0 },
          }}
        >
          <Button
            disableRipple
            startIcon={<MergeIcon />}
            onClick={openMerge}
            sx={{
              width: 245,
              height: 47,
              bgcolor: '#32b643',
              color: '#f8f8f8',
              fontSize: 24,
              fontWeight: 400,
              textTransform: 'none',
              borderRadius: 0,
              padding: '8px 16px',
              whiteSpace: 'nowrap',
              transition: 'background 0.2s ease, color 0.2s ease',
              '&:hover': { bgcolor: '#f8f8f8', color: '#32b643' },
            }}
          >
            Merge Suppliers
          </Button>
        </Box>
      </Box>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: '17px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddSupplier}
            sx={{
              bgcolor: '#5ebbeb',
              color: '#f8f8f8',
              border: '1px solid #5ebbeb',
              borderRadius: 0,
              textTransform: 'none',
              boxShadow: 'none',
              fontWeight: 400,
              fontSize: 16,
              width: 152,
              height: 53,
              px: 0.5,
              whiteSpace: 'nowrap',
              transition: 'background 0.2s ease, color 0.2s ease',
              '&:hover': { bgcolor: '#f8f8f8', color: '#5ebbeb', boxShadow: 'none' },
            }}
          >
            Add Supplier
          </Button>
        </Box>
        {/* reference leaves a 110px gutter between the Functions tab and the Results counter */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '110px' }}>
          <Button
            disableRipple
            onClick={() => setFunctionsOpen((open) => !open)}
            aria-expanded={functionsOpen}
            startIcon={
              functionsOpen ? (
                <ChevronUpIcon sx={{ fontSize: '0.9em' }} />
              ) : (
                <ChevronDownIcon sx={{ fontSize: '0.9em' }} />
              )
            }
            sx={{
              mt: '-17px',
              width: 188,
              height: 46,
              padding: '8px',
              bgcolor: '#f8f8f8',
              color: '#000',
              borderRadius: 0,
              boxShadow: TRAY_SHADOW,
              fontSize: 24,
              fontWeight: 400,
              textTransform: 'none',
              whiteSpace: 'nowrap',
              '&:hover': { bgcolor: '#f8f8f8', boxShadow: TRAY_SHADOW },
            }}
          >
            Functions
          </Button>
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: '19.2px', fontWeight: 400, color: '#000', lineHeight: 1.2 }}>
              {filteredSuppliers.length}
            </Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 400, color: '#000' }}>
              Results
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Search */}
      <Box sx={{ mb: '31px' }}>
        <TextField
          placeholder="Search for Suppliers"
          variant="outlined"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ width: '100%', ...searchFieldSx }}
        />
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
                    color: '#f8f8f8',
                    fontWeight: 400,
                    fontSize: 16,
                    border: 0,
                    p: '16px',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                  },
                }}
              >
                {/* reference column split: 35.5% / 21.6% / 37.3% / 105px */}
                <TableCell sx={{ width: '35.5%' }}>Name</TableCell>
                <TableCell sx={{ width: '21.6%' }}>Product Count</TableCell>
                <TableCell sx={{ width: '37.3%' }}>Performance</TableCell>
                <TableCell sx={{ width: 105, whiteSpace: 'nowrap' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody
              sx={{
                '& tr:nth-of-type(odd)': { bgcolor: '#ffffff' },
                '& tr:nth-of-type(even)': { bgcolor: '#f5f5f5' },
                '& td': { border: 0, fontSize: 16, color: '#000', py: '16px', height: 132, boxSizing: 'border-box' }
              }}
            >
              {filteredSuppliers.map((supplier) => (
                <TableRow key={supplier.id}>
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
                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <Button
                        size="small"
                        disableRipple
                        startIcon={<ViewIcon />}
                        onClick={() => handleViewSupplier(supplier)}
                        sx={{ ...actionLinkSx, color: '#0284c7', '&:hover': { ...actionLinkSx['&:hover'], color: 'rgb(115, 180, 247)' } }}
                      >
                        View
                      </Button>
                      <Button
                        size="small"
                        disableRipple
                        startIcon={<EditIcon />}
                        onClick={() => handleEditSupplier(supplier)}
                        sx={{ ...actionLinkSx, color: '#16a34a', '&:hover': { ...actionLinkSx['&:hover'], color: 'rgb(109, 215, 123)' } }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="small"
                        disableRipple
                        startIcon={<AssignIcon />}
                        onClick={() => handleAssignSupplier(supplier)}
                        sx={{ ...actionLinkSx, color: '#9561e2', transition: 'color 0.4s ease', '&:hover': { ...actionLinkSx['&:hover'], color: 'rgb(96, 34, 187)' } }}
                      >
                        Assign
                      </Button>
                      <Button
                        size="small"
                        disableRipple
                        startIcon={<DeleteIcon />}
                        onClick={() => handleDeleteSupplier(supplier.id)}
                        sx={{ ...actionLinkSx, color: '#dc2626', '&:hover': { ...actionLinkSx['&:hover'], color: 'rgb(243, 170, 168)' } }}
                      >
                        Delete
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {filteredSuppliers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
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
