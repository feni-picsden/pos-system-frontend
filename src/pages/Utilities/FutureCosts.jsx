import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  FormControl,
  Select,
  MenuItem,
  InputAdornment,
  Autocomplete,
  Grid,
} from '@mui/material';
import {
  AddOutlined as AddIcon,
  DeleteOutline as DeleteIcon,
  CheckCircleOutline as CheckCircleIcon,
  SearchOutlined as SearchIcon,
  HelpOutline as HelpIcon,
  BlockOutlined as BlockIcon,
} from '@mui/icons-material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { enGB } from 'date-fns/locale';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import productService from '../../services/productService';
import futureCostService from '../../services/futureCostService';
import apiClient from '../../services/apiClient';
import classificationService from '../../services/classificationService';
import FutureConfirmDialog from '../../components/Utilities/FutureConfirmDialog';
import DateRangePicker from '../../components/Common/DateRangePicker';

const GLOBAL_OUTLET = 'global';

// The reference dialog has no Cost Type picker — its single cost field is labelled "Case Cost",
// so every cost scheduled from here is a case cost.
const COST_TYPE = 'Case Cost';

// Reference filter fields: 40px tall, 8px radius, 1px #404040 rail, no card wrapper.
const fieldSx = {
  bgcolor: '#fff',
  '& .MuiOutlinedInput-root': { height: 40, borderRadius: '8px' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: '#000',
    borderWidth: '2px',
  },
  '& .MuiInputBase-input::placeholder': { color: '#808080', opacity: 1 },
};

// Four equal fields across the row: minWidth 0 stops the inputs' intrinsic width
// from out-competing the selects (which otherwise collapse to 0px).
const fieldFlexSx = { flex: '1 1 0', minWidth: 0 };

const selectSx = {
  height: 40,
  borderRadius: '8px',
  bgcolor: '#fff',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
};

// Reference dialog fields are flat filled #d4d4d4 (oklch 0.87 0 0), 40px, 8px radius,
// 1px #5e5e5e rail (oklch 0.371 0 0) — not white outlined like the page filters.
const dialogFieldSx = {
  ...fieldSx,
  bgcolor: '#d4d4d4',
  '& .MuiOutlinedInput-root': { height: 40, borderRadius: '8px', bgcolor: '#d4d4d4' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#5e5e5e', borderWidth: '1px' },
  '& .MuiInputBase-input::placeholder': { color: '#808080', opacity: 1 },
};

const dialogSelectSx = {
  ...selectSx,
  bgcolor: '#d4d4d4',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#5e5e5e', borderWidth: '1px' },
};

// Both dialog buttons are 118x42 / 12px / 16px-700 on the reference.
const dialogBtnSx = {
  width: 118,
  height: 42,
  borderRadius: '12px',
  fontSize: 16,
  fontWeight: 700,
  textTransform: 'none',
  boxShadow: 'none',
};

const popupPaperSx = { borderRadius: 0, boxShadow: 'none', border: '1px solid #404040' };

const menuProps = {
  PaperProps: { sx: popupPaperSx },
};

// ponytail: 'Current Day' is the only reference shortcut; add more when the reference grows them.
const pickerShortcuts = [{ label: 'Current Day', getValue: () => new Date() }];

// Measured off the reference toolbar: every bulk button is 42px tall, 12px radius, 16px/700,
// outlined (transparent fill) — and greys to these exact tones when disabled.
const bulkBtnSx = {
  height: 42,
  borderRadius: '12px',
  fontSize: 16,
  fontWeight: 700,
  textTransform: 'none',
  boxShadow: 'none',
  backgroundColor: 'transparent',
  '&.Mui-disabled': {
    backgroundColor: '#e5e5e5',
    color: '#8a8a8a',
    borderColor: '#b3b3b3',
  },
};

const filterBtnSx = {
  ...bulkBtnSx,
  width: 106,
  backgroundColor: '#5ebbeb',
  border: '1px solid #5ebbeb',
  color: '#fff',
  transition: 'all 0s ease',
  // Reference Filter hover darkens to Tailwind sky-500.
  '&:hover': { backgroundColor: '#0ea5e9', borderColor: '#0ea5e9', boxShadow: 'none' },
};

const dangerBtnSx = {
  ...bulkBtnSx,
  color: '#dc2626',
  borderColor: '#ef4444',
  '&:hover': { backgroundColor: 'rgba(220, 38, 38, 0.04)', borderColor: '#dc2626' },
};

const primaryOutlineBtnSx = {
  ...bulkBtnSx,
  color: '#5ebbeb',
  borderColor: '#5ebbeb',
  '&:hover': { backgroundColor: 'rgba(94, 187, 235, 0.06)', borderColor: '#4aa9dd' },
};

const rowActionSx = (color) => ({
  color,
  height: 42,
  borderRadius: '12px',
  fontSize: 16,
  fontWeight: 700,
  textTransform: 'none',
});

const transformCost = (fc) => ({
  id: fc.id,
  itemName: fc.productName || fc.product?.name || 'Unknown',
  itemType: fc.itemType || 'Product',
  costType: fc.costType || 'Item Cost',
  createdBy: fc.createdBy?.name || 'Unknown',
  cost: fc.cost || 0,
  effectiveAt: fc.effectiveAt,
  isApplied: fc.isApplied || false,
  appliedAt: fc.appliedAt,
  outletId: fc.outletId ?? null,
  product: fc.product,
});

const FutureCosts = () => {
  const { getOutletId, getOutletName } = useAuth();
  // getOutletName() is the user's HOME outlet, not the row's — resolve each row against the
  // outlet list so a cost booked on another outlet names that outlet. selectedOutletId is the
  // top-bar outlet (super admins), used to prefill the dialog's Outlet select.
  const { outlets, selectedOutletId } = useSelectedOutlet();
  const [futureCosts, setFutureCosts] = useState([]);
  const [selectedCosts, setSelectedCosts] = useState([]);
  const [applyConfirm, setApplyConfirm] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedOutlet, setSelectedOutlet] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  // Reference applies filters only on the Filter button — the fields above are drafts.
  const [appliedOutlet, setAppliedOutlet] = useState('');
  const appliedFiltersRef = useRef({});

  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemSearchResults, setItemSearchResults] = useState([]);
  const [itemSearchLoading, setItemSearchLoading] = useState(false);
  const [scheduledTime, setScheduledTime] = useState(null);
  const [cost, setCost] = useState('0');
  const [dialogOutlet, setDialogOutlet] = useState('');
  const [categories, setCategories] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dateError, setDateError] = useState('');

  const outletId = getOutletId();
  const outletName = getOutletName();

  const loadCosts = async () => {
    setLoadingData(true);
    try {
      const filters = appliedFiltersRef.current;
      const params = {};
      if (filters.category) params.category = filters.category;
      if (filters.startDate) params.startDate = filters.startDate.toISOString();
      if (filters.endDate) params.endDate = filters.endDate.toISOString();

      // Direct apiClient call (same endpoint as futureCostService.getFutureCosts) so we can
      // pass skipOutletScope: the super-admin GET interceptor otherwise injects a (possibly
      // stale) localStorage outletId and silently hides rows; outlet scoping on this page is
      // the explicit Select Outlet filter, applied client-side. noCache keeps Filter fresh.
      const response = await apiClient.get('/future-costs', {
        params,
        skipOutletScope: true,
        noCache: true,
      });
      if (response.data && response.data.futureCosts) {
        setFutureCosts(response.data.futureCosts.map(transformCost));
      }
    } catch (err) {
      console.error('Error fetching future costs:', err);
      setError(err.response?.data?.error || 'Failed to fetch future costs');
    } finally {
      setLoadingData(false);
    }
  };

  // Reference model: fetch once on mount; afterwards only the Filter button refetches.
  useEffect(() => {
    loadCosts();
  }, []);

  const applyFilters = () => {
    appliedFiltersRef.current = { category: selectedCategory, startDate, endDate };
    setAppliedOutlet(selectedOutlet);
    loadCosts();
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await classificationService.getClassifications({ type: 'Category' });
        if (response && response.classifications) {
          setCategories(response.classifications);
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    };
    fetchCategories();
  }, []);

  // Reference prefills the dialog's Outlet with the CURRENT outlet (top-bar selection for
  // super admins, home outlet otherwise); empty = Global Cost.
  const currentOutletId = selectedOutletId ?? outletId;

  useEffect(() => {
    if (scheduleDialogOpen) setDialogOutlet(currentOutletId != null ? String(currentOutletId) : '');
  }, [scheduleDialogOpen, currentOutletId]);

  // ponytail: outlet scoping is client-side — GET /future-costs only honours outletId for
  // superadmins and cannot express "global only" at all. Move server-side if the list ever pages.
  const visibleCosts = useMemo(() => {
    if (!appliedOutlet) return futureCosts;
    if (appliedOutlet === GLOBAL_OUTLET) return futureCosts.filter((c) => c.outletId == null);
    return futureCosts.filter((c) => String(c.outletId) === appliedOutlet);
  }, [futureCosts, appliedOutlet]);

  const visibleIds = useMemo(() => visibleCosts.map((c) => c.id), [visibleCosts]);
  const selectedVisible = useMemo(
    () => selectedCosts.filter((id) => visibleIds.includes(id)),
    [selectedCosts, visibleIds]
  );

  const handleSelectAll = (event) => {
    setSelectedCosts(event.target.checked ? visibleIds : []);
  };

  const handleSelectCost = (costId) => {
    setSelectedCosts((prev) =>
      prev.includes(costId) ? prev.filter((id) => id !== costId) : [...prev, costId]
    );
  };

  const doApply = async (ids) => {
    try {
      setLoading(true);
      setError('');

      const response =
        ids.length === 1
          ? await futureCostService.applyFutureCost(ids[0])
          : await futureCostService.applyMultipleFutureCosts(ids);

      // Refresh the rows in place so the 'Applied' chip appears without a reload.
      const appliedAt = new Date().toISOString();
      setFutureCosts((prev) =>
        prev.map((c) => (ids.includes(c.id) ? { ...c, isApplied: true, appliedAt } : c))
      );
      setSelectedCosts((prev) => prev.filter((id) => !ids.includes(id)));
      setApplyConfirm(null);
      setSuccess(
        response?.message ||
          (ids.length === 1
            ? 'Future cost applied successfully and updated product cost!'
            : `${ids.length} future cost(s) applied successfully and updated product costs!`)
      );
      setTimeout(() => setSuccess(''), 3000);

      await loadCosts();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to apply future cost');
    } finally {
      setLoading(false);
    }
  };

  const doDelete = async (ids) => {
    try {
      setLoading(true);
      setError('');

      if (ids.length === 1) {
        await futureCostService.deleteFutureCost(ids[0]);
      } else {
        await futureCostService.deleteMultipleFutureCosts(ids);
      }

      setFutureCosts((prev) => prev.filter((c) => !ids.includes(c.id)));
      setSelectedCosts((prev) => prev.filter((id) => !ids.includes(id)));
      setDeleteConfirm(null);
      setSuccess(
        ids.length === 1
          ? 'Future cost deleted successfully!'
          : `${ids.length} future cost(s) deleted successfully!`
      );
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete future costs');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  // Row table inside the confirm dialogs — reference mirrors the list columns exactly.
  const COST_COLUMNS = [
    { label: 'Product', get: (r) => r.itemName },
    { label: 'Outlet', get: (r) => outletLabel(r.outletId) },
    { label: 'Created By', get: (r) => r.createdBy },
    { label: 'Case Cost', get: (r) => formatCurrency(r.cost) },
    { label: 'Effective At', get: (r) => formatDate(r.effectiveAt) },
  ];

  const resetScheduleForm = () => {
    setSelectedItem(null);
    setItemSearchResults([]);
    setScheduledTime(null);
    setCost('0');
    setDialogOutlet(currentOutletId != null ? String(currentOutletId) : '');
    setDateError('');
  };

  const handleAddFutureCost = async () => {
    if (!selectedItem || !scheduledTime || !cost) {
      setError('Please fill in all required fields');
      return;
    }

    // The field defaults to the string '0', which passes the !cost check but
    // creates a future cost the server can never apply - require a real value.
    if (!(parseFloat(cost) > 0)) {
      setError('Cost must be greater than zero');
      return;
    }

    if (scheduledTime <= new Date()) {
      setDateError('Please select a time that is in the future');
      setError('Please select a time that is in the future');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setDateError('');

      // Save exactly what the Outlet field shows: a chosen outlet, or Global Cost when empty.
      // (No silent fallback to the product's own outlet — the row must match the field.)
      const resolvedOutletId = dialogOutlet ? Number(dialogOutlet) : null;
      await futureCostService.createFutureCost({
        productId: selectedItem.id,
        productName: selectedItem.name,
        itemType: 'Product',
        costType: COST_TYPE,
        quantity: 1,
        cost: parseFloat(cost),
        effectiveAt: scheduledTime.toISOString(),
        ...(resolvedOutletId != null ? { outletId: resolvedOutletId } : {}),
      });

      setSuccess('Future cost scheduled successfully!');
      setScheduleDialogOpen(false);
      resetScheduleForm();
      setTimeout(() => setSuccess(''), 3000);

      await loadCosts();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to schedule future cost');
    } finally {
      setLoading(false);
    }
  };

  const outletLabel = (id) => {
    if (id == null) return 'Global Cost';
    const hit = outlets.find((o) => String(o.id) === String(id));
    if (hit) return hit.name;
    return String(id) === String(outletId) ? outletName || 'My Outlet' : 'My Outlet';
  };

  // Global Cost + every outlet this user can see (super admins get the full outlet list from
  // SelectedOutletContext, regular users their assigned outlet(s)) so rows on ANY outlet are
  // filterable and the dialog's Outlet menu is never empty.
  const outletOptions = [
    { value: GLOBAL_OUTLET, label: 'Global Cost' },
    ...outlets.map((o) => ({ value: String(o.id), label: o.name })),
    ...(outletId != null && !outlets.some((o) => String(o.id) === String(outletId))
      ? [{ value: String(outletId), label: outletName || 'My Outlet' }]
      : []),
  ];

  const placeholder = (text) => <Box component="span" sx={{ color: '#808080' }}>{text}</Box>;

  return (
    <Box sx={{ p: 3, backgroundColor: '#f5f5f5', minHeight: 'calc(100vh - 50px)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        {/* Reference title: 32px / 700 / pure black. */}
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, fontSize: 32, color: '#000' }}>
          Future Costs
        </Typography>
        <Button
          variant="contained"
          disableElevation
          startIcon={<AddIcon />}
          onClick={() => setScheduleDialogOpen(true)}
          sx={{
            width: 119,
            height: 42,
            borderRadius: '12px',
            fontSize: 16,
            fontWeight: 700,
            textTransform: 'none',
            backgroundColor: '#00c951',
            border: '1px solid #00c951',
            boxShadow: 'none',
            transition: 'all 0s ease',
            // Reference hover lightens to Tailwind v4 green-400.
            '&:hover': { backgroundColor: '#05df72', borderColor: '#05df72', boxShadow: 'none' },
          }}
        >
          New
        </Button>
      </Box>

      <Box>
        {/* Reference filter row sits 8px from the page edge (not the page's 24px pad), which is
            what makes each of the four fields 464px wide at 1920. */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, mx: '-16px' }}>
          {/* Reference filters are searchable comboboxes (type-to-filter), applied via Filter. */}
          <Autocomplete
            sx={fieldFlexSx}
            size="small"
            options={categories}
            getOptionLabel={(o) => o.name || ''}
            isOptionEqualToValue={(o, v) => String(o.id) === String(v.id)}
            value={categories.find((c) => String(c.id) === String(selectedCategory)) || null}
            onChange={(e, v) => setSelectedCategory(v ? v.id : '')}
            componentsProps={{ paper: { sx: popupPaperSx } }}
            renderInput={(params) => (
              <TextField {...params} placeholder="Select Category..." sx={fieldSx} />
            )}
          />

          <Autocomplete
            sx={fieldFlexSx}
            size="small"
            options={outletOptions}
            getOptionLabel={(o) => o.label || ''}
            isOptionEqualToValue={(o, v) => o.value === v.value}
            value={outletOptions.find((o) => o.value === selectedOutlet) || null}
            onChange={(e, v) => setSelectedOutlet(v ? v.value : '')}
            componentsProps={{ paper: { sx: popupPaperSx } }}
            renderInput={(params) => (
              <TextField {...params} placeholder="Select Outlet..." sx={fieldSx} />
            )}
          />

          <Box sx={fieldFlexSx}>
            <DateRangePicker
              single
              allowEmpty
              enableTime
              hideIcon
              label=""
              placeholder="Select Start Date..."
              inputSx={fieldSx}
              value={{ startDate, endDate: startDate }}
              onChange={({ startDate: d }) => setStartDate(d)}
            />
          </Box>

          <Box sx={fieldFlexSx}>
            <DateRangePicker
              single
              allowEmpty
              enableTime
              hideIcon
              label=""
              placeholder="Select End Date..."
              inputSx={fieldSx}
              value={{ startDate: endDate, endDate }}
              onChange={({ startDate: d }) => setEndDate(d)}
            />
          </Box>
        </Box>

      </Box>

      {/* Reference keeps Filter, the selected-count and all four bulk actions on ONE row:
          Filter hard-left, count pushed right by the spacer, buttons right-aligned. */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button variant="contained" disableElevation onClick={applyFilters} sx={filterBtnSx}>
          Filter
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        {/* Reference empty page shows only New + filters + Filter — no count, no bulk actions. */}
        {visibleCosts.length > 0 && (
        <>
        <Typography variant="body2" sx={{ color: '#000', fontSize: 16, mr: 1 }}>
          {selectedVisible.length} Selected Costs
        </Typography>
        <Button
          variant="outlined"
          onClick={() =>
            setDeleteConfirm({
              title: 'Delete Selected Costs',
              message: `Are you sure you want to delete ${selectedVisible.length} selected cost(s)?`,
              ids: selectedVisible,
            })
          }
          disabled={selectedVisible.length === 0}
          sx={dangerBtnSx}
        >
          Delete Selected Costs
        </Button>
        <Button
          variant="outlined"
          onClick={() =>
            setDeleteConfirm({
              title: 'Delete All Costs',
              message: `Are you sure you want to delete all ${visibleCosts.length} future cost(s)?`,
              ids: visibleIds,
            })
          }
          disabled={visibleCosts.length === 0}
          sx={dangerBtnSx}
        >
          Delete All Costs
        </Button>
        <Button
          variant="outlined"
          onClick={() =>
            setApplyConfirm({
              message: `Are you sure you want to apply ${selectedVisible.length} selected cost(s) immediately?`,
              ids: selectedVisible,
            })
          }
          disabled={selectedVisible.length === 0}
          sx={primaryOutlineBtnSx}
        >
          Apply Selected Costs
        </Button>
        <Button
          variant="outlined"
          onClick={() =>
            setApplyConfirm({
              message: `Are you sure you want to apply all ${visibleCosts.length} future cost(s) immediately?`,
              ids: visibleIds,
            })
          }
          disabled={visibleCosts.length === 0}
          sx={primaryOutlineBtnSx}
        >
          Apply All Costs
        </Button>
        </>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {loadingData ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <Typography>Loading...</Typography>
        </Box>
      ) : visibleCosts.length === 0 ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            py: 8,
          }}
        >
          {/* Reference empty state is all black: circle-slash icon, 24px/700 heading, plain body. */}
          <BlockIcon sx={{ fontSize: 118, color: '#000' }} />
          <Box>
            <Typography component="h3" sx={{ fontWeight: 700, fontSize: 24, color: '#000', mb: 1 }}>
              No Future Costs
            </Typography>
            <Typography sx={{ color: '#000', fontSize: 16 }}>
              There are no costs set to be activated in the future.
            </Typography>
          </Box>
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#5ebbeb', '& th': { color: '#fff', fontSize: 16, fontWeight: 700, borderBottom: 'none' } }}>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={
                      selectedVisible.length > 0 && selectedVisible.length < visibleCosts.length
                    }
                    checked={visibleCosts.length > 0 && selectedVisible.length === visibleCosts.length}
                    onChange={handleSelectAll}
                    sx={{ color: '#fff', '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: '#fff' } }}
                  />
                </TableCell>
                <TableCell>Product</TableCell>
                <TableCell>Outlet</TableCell>
                <TableCell>Created By</TableCell>
                <TableCell>Case Cost</TableCell>
                <TableCell>Effective At</TableCell>
                {/* Reference leaves the row-action column header blank. */}
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleCosts.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedCosts.includes(row.id)}
                      onChange={() => handleSelectCost(row.id)}
                    />
                  </TableCell>
                  <TableCell>{row.itemName}</TableCell>
                  <TableCell>{outletLabel(row.outletId)}</TableCell>
                  <TableCell>{row.createdBy}</TableCell>
                  <TableCell>{formatCurrency(row.cost)}</TableCell>
                  <TableCell>
                    {formatDate(row.effectiveAt)}
                    {row.isApplied && (
                      <Chip label="Applied" size="small" color="success" sx={{ ml: 1 }} />
                    )}
                  </TableCell>
                  <TableCell>
                    {/* Reference row actions are borderless text links, not filled buttons. */}
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                      <Button
                        variant="text"
                        startIcon={<DeleteIcon />}
                        onClick={() =>
                          setDeleteConfirm({
                            title: 'Delete Future Cost',
                            ids: [row.id],
                            cost: row,
                          })
                        }
                        sx={rowActionSx('#dc2626')}
                      >
                        Delete
                      </Button>
                      {!row.isApplied && (
                        <Button
                          variant="text"
                          startIcon={<CheckCircleIcon />}
                          onClick={() =>
                            setApplyConfirm({
                              message: 'Are you sure you want to apply the future cost?',
                              ids: [row.id],
                              cost: row,
                            })
                          }
                          sx={rowActionSx('#16a34a')}
                        >
                          Apply
                        </Button>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <FutureConfirmDialog
        open={!!deleteConfirm}
        layout="bar"
        variant="delete"
        noun="Future Cost"
        row={deleteConfirm?.cost}
        count={deleteConfirm?.ids?.length || 0}
        columns={COST_COLUMNS}
        message={deleteConfirm?.message}
        loading={loading}
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={() => doDelete(deleteConfirm.ids)}
      />

      <FutureConfirmDialog
        open={!!applyConfirm}
        layout="bar"
        variant="apply"
        noun="Future Cost"
        row={applyConfirm?.cost}
        count={applyConfirm?.ids?.length || 0}
        columns={COST_COLUMNS}
        message={applyConfirm?.cost ? undefined : applyConfirm?.message}
        loading={loading}
        onCancel={() => setApplyConfirm(null)}
        onConfirm={() => doApply(applyConfirm.ids)}
      />

      <Dialog
        open={scheduleDialogOpen}
        onClose={() => {
          setScheduleDialogOpen(false);
          resetScheduleForm();
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '8px',
            width: 448,
            // Tailwind shadow-xl
            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            height: 60,
            p: 2,
            backgroundColor: '#bae6fd',
            borderRadius: '8px 8px 0 0',
          }}
        >
          <HelpIcon sx={{ fontSize: 22, color: '#075985' }} />
          <Typography component="span" sx={{ fontSize: 18, fontWeight: 400, color: '#075985' }}>
            Schedule Cost Change
          </Typography>
        </DialogTitle>

        {/* Measured: title 60 + content + actions 67 must total the reference's 419px paper.
            Content body is 283px (Grid 299 less its -16 spacing margin), so 2px top + 9px
            bottom => 294 content => 60 + 292 + 67 = 419. */}
        <DialogContent sx={{ pt: '2px', pb: '9px' }}>
          {dateError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDateError('')}>
              {dateError}
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Autocomplete
                options={itemSearchResults}
                getOptionLabel={(option) => {
                  if (typeof option === 'string') return option;
                  return option.name || '';
                }}
                isOptionEqualToValue={(option, value) => {
                  if (!option || !value) return false;
                  return option.id === value.id;
                }}
                value={selectedItem}
                loading={itemSearchLoading}
                // Reference: hint until 3 typed chars, then results grouped under a bold
                // 'Products' header (never a bare 'Loading...' line).
                noOptionsText="Keep Typing to Search..."
                loadingText="Keep Typing to Search..."
                groupBy={() => 'Products'}
                renderGroup={(params) => (
                  <li key={params.key}>
                    <Box sx={{ px: 2, py: 0.5, fontWeight: 700, fontSize: 14 }}>{params.group}</Box>
                    <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>{params.children}</ul>
                  </li>
                )}
                onInputChange={async (event, newValue) => {
                  if (newValue && newValue.trim().length >= 3) {
                    setItemSearchLoading(true);
                    try {
                      // skipOutletScope: the super-admin GET interceptor otherwise pins the
                      // top-bar outlet onto the search and every term returns 0 products.
                      const response = await productService.getProducts(
                        { search: newValue, limit: 10, status: 'Active' },
                        { skipOutletScope: true }
                      );
                      setItemSearchResults(response.products || []);
                    } catch (err) {
                      console.error('Error searching products:', err);
                      setItemSearchResults([]);
                    } finally {
                      setItemSearchLoading(false);
                    }
                  } else {
                    setItemSearchResults([]);
                  }
                }}
                onChange={(event, newValue) => {
                  setSelectedItem(newValue && typeof newValue !== 'string' ? newValue : null);
                  setCost('0');
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Search items..."
                    size="small"
                    // Reference search input is white/active, unlike the grey fields below.
                    sx={fieldSx}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {itemSearchLoading ? <SearchIcon /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography sx={{ color: '#676b72', fontSize: 14, mb: 0.5 }}>Outlet</Typography>
              {/* Reference: Outlet is read-only at all times (prefilled with the current outlet);
                  Scheduled Time and Case Cost unlock once an item is chosen. */}
              <FormControl fullWidth size="small">
                <Select
                  displayEmpty
                  disabled
                  value={dialogOutlet}
                  onChange={(e) => setDialogOutlet(e.target.value)}
                  sx={dialogSelectSx}
                  MenuProps={menuProps}
                  renderValue={(value) =>
                    value
                      ? outletOptions.find((o) => o.value === value)?.label || ''
                      : placeholder('Global Cost')
                  }
                >
                  {outletOptions
                    .filter((o) => o.value !== GLOBAL_OUTLET)
                    .map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Typography sx={{ color: '#676b72', fontSize: 14, mb: 0.5 }}>Scheduled Time</Typography>
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
                <DateTimePicker
                  disabled={!selectedItem}
                  value={scheduledTime}
                  onChange={(newValue) => {
                    setScheduledTime(newValue);
                    setDateError(
                      newValue && newValue <= new Date()
                        ? 'Please select a time that is in the future'
                        : ''
                    );
                  }}
                  format="dd/MM/yyyy HH:mm:ss"
                  ampm={false}
                  views={['year', 'month', 'day', 'hours', 'minutes', 'seconds']}
                  minDateTime={new Date()}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      size: 'small',
                      // Reference has no trailing calendar icon on this field.
                      sx: { ...dialogFieldSx, '& .MuiInputAdornment-root': { display: 'none' } },
                      error: !!dateError,
                      helperText: dateError,
                    },
                    shortcuts: { items: pickerShortcuts },
                  }}
                />
              </LocalizationProvider>
            </Grid>

            <Grid item xs={12}>
              <Typography sx={{ color: '#676b72', fontSize: 14, mb: 0.5 }}>Case Cost</Typography>
              <TextField
                fullWidth
                size="small"
                type="number"
                disabled={!selectedItem}
                value={cost}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setCost(e.target.value)}
                sx={dialogFieldSx}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 2, pt: 1, borderTop: '1px solid #e0e0e0' }}>
          <Button
            onClick={() => {
              setScheduleDialogOpen(false);
              resetScheduleForm();
            }}
            sx={{
              ...dialogBtnSx,
              color: '#000',
              backgroundColor: '#d4d4d4',
              '&:hover': { backgroundColor: '#c4c4c4' },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddFutureCost}
            variant="contained"
            disableElevation
            disabled={!selectedItem || !scheduledTime || !cost || !!dateError}
            sx={{
              ...dialogBtnSx,
              backgroundColor: '#5ebbeb',
              border: '1px solid #5ebbeb',
              '&:hover': { backgroundColor: '#4aa9dd', borderColor: '#4aa9dd', boxShadow: 'none' },
              // Reference disabled Add: #ebebeb fill, #8e8e8e label, rail matches the fill.
              '&.Mui-disabled': {
                backgroundColor: '#ebebeb',
                border: '1px solid #ebebeb',
                color: '#8e8e8e',
              },
            }}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FutureCosts;
