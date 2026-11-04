import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Pagination,
  Checkbox,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  InputAdornment,
  Autocomplete,
  Grid,
  CircularProgress,
} from '@mui/material';
import {
  AddOutlined as AddIcon,
  DeleteOutline as DeleteIcon,
  CheckCircleOutline as CheckCircleIcon,
  SearchOutlined as SearchIcon,
  BlockOutlined as BlockIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import productService from '../../services/productService';
import futureCostService from '../../services/futureCostService';
import classificationService from '../../services/classificationService';
import FutureConfirmDialog from '../../components/Utilities/FutureConfirmDialog';
import DateTimeField from '../../components/Common/DateTimeField';
import {
  FIELD_SX,
  LIST_PAPER_SX,
  singleAutocompleteSx,
  AUTOCOMPLETE_INPUT_SX,
  NEW_BUTTON_SX,
  BULK_DANGER_SX,
  BULK_PRIMARY_SX,
  FILTER_BUTTON_SX,
  rowActionSx,
  CHECKBOX_GLYPHS,
  CHECKBOX_SX,
  TABLE_HEAD_ROW_SX,
  TABLE_BODY_SX,
  DIALOG_INPUT_SX,
  DIALOG_FIELD_SX,
  DIALOG_CANCEL_SX,
  DIALOG_ADD_SX,
} from '../../components/Utilities/futureStyles.jsx';

const GLOBAL_OUTLET = 'global';

// The reference dialog has no Cost Type picker: its single field is "Case Cost".
const COST_TYPE = 'Case Cost';

// Same sort glyph as the report pages, shown on the sorted column only.
const SortGlyph = ({ active }) => (
  <svg width="10" height="14" viewBox="0 0 10 14" style={{ marginLeft: 4, verticalAlign: 'middle', display: 'inline-block' }} aria-hidden="true">
    <path d="M1 5.5 L5 1.5 L9 5.5 Z" fill={active === 'asc' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active === 'asc' ? 1.6 : 1.1} strokeLinejoin="round" />
    <path d="M1 8.5 L5 12.5 L9 8.5 Z" fill={active === 'desc' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active === 'desc' ? 1.6 : 1.1} strokeLinejoin="round" />
  </svg>
);

// Reference dialog field names: 12px black, a fixed 16px line above the field
// (kept as blank space while hidden so rows never jump).
const DialogLabel = ({ show, children }) => (
  <Typography sx={{ fontSize: 12, lineHeight: '16px', color: '#000', mb: '4px', visibility: show ? 'visible' : 'hidden' }}>
    {children}
  </Typography>
);

const COLUMNS = [
  { id: 'itemName', label: 'Product' },
  { id: 'outletName', label: 'Outlet' },
  { id: 'createdBy', label: 'Created By' },
  { id: 'cost', label: 'Case Cost', numeric: true },
  { id: 'effectiveAt', label: 'Effective At', date: true },
];

const ROWS_PER_PAGE = 10;

const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);

const FutureCosts = () => {
  const { getOutletId, getOutletName } = useAuth();
  // Outlet-wise: a navbar outlet already scopes every request (apiClient adds
  // ?outletId=). Under All Outlets the page's own Outlet filter narrows the
  // mixed list: one outlet (+ global rows) or "Global Cost" only.
  const { outlets, selectedOutletId, isAllOutlets } = useSelectedOutlet();
  const homeOutletId = getOutletId();
  const homeOutletName = getOutletName();

  const [futureCosts, setFutureCosts] = useState([]);
  const [selectedCosts, setSelectedCosts] = useState([]);
  const [applyConfirm, setApplyConfirm] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Reference: the fields are drafts; the Filter button applies them.
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [appliedFilters, setAppliedFilters] = useState({});
  const [filtering, setFiltering] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [categories, setCategories] = useState([]);

  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemSearchResults, setItemSearchResults] = useState([]);
  const [itemSearchLoading, setItemSearchLoading] = useState(false);
  const [itemSearchText, setItemSearchText] = useState('');
  const [scheduledTime, setScheduledTime] = useState(null);
  const [cost, setCost] = useState('');
  const [costFocused, setCostFocused] = useState(false);
  const [dialogOutlet, setDialogOutlet] = useState(null);
  const [dateError, setDateError] = useState('');

  const [orderBy, setOrderBy] = useState('effectiveAt');
  const [order, setOrder] = useState('asc');
  const [page, setPage] = useState(0);

  const outletNameOf = useCallback(
    (id) => {
      if (id == null) return 'Global Cost';
      const hit = outlets.find((o) => String(o.id) === String(id));
      if (hit) return hit.name;
      return String(id) === String(homeOutletId) ? homeOutletName || 'My Outlet' : `Outlet ${id}`;
    },
    [outlets, homeOutletId, homeOutletName]
  );

  // Filter options: Global Cost + every outlet the admin can see.
  const outletOptions = useMemo(
    () => [{ id: GLOBAL_OUTLET, name: 'Global Cost' }, ...outlets.map((o) => ({ id: o.id, name: o.name }))],
    [outlets]
  );
  // Dialog options: the outlets a cost may be booked on (no Global row - clearing
  // the field is "Global Cost"). Under a navbar outlet, only that one.
  const dialogOutletOptions = useMemo(() => {
    if (isAllOutlets) return outlets.map((o) => ({ id: o.id, name: o.name }));
    const id = selectedOutletId ?? homeOutletId;
    return id != null ? [{ id, name: outletNameOf(id) }] : [];
  }, [isAllOutlets, outlets, selectedOutletId, homeOutletId, outletNameOf]);
  const currentOutletId = selectedOutletId ?? homeOutletId ?? null;

  const loadCosts = useCallback(async (filters) => {
    try {
      // Reference article: the index "lists all future costs that have been
      // created and not applied yet".
      const params = { isApplied: false };
      if (filters.category) params.category = filters.category;
      if (filters.startDate) params.startDate = filters.startDate.toISOString();
      if (filters.endDate) params.endDate = filters.endDate.toISOString();
      if (filters.outletId) params.outletId = filters.outletId;
      const response = await futureCostService.getFutureCosts(params);
      setFutureCosts(
        (response?.futureCosts || []).map((fc) => ({
          id: fc.id,
          itemName: fc.productName || fc.product?.name || 'Unknown',
          itemType: fc.itemType || 'Product',
          createdBy: fc.createdBy?.name || 'Unknown',
          cost: fc.cost || 0,
          effectiveAt: fc.effectiveAt,
          isApplied: fc.isApplied || false,
          outletId: fc.outletId ?? null,
          outletName: fc.outletId == null ? 'Global Cost' : null,
          product: fc.product,
        }))
      );
    } catch (err) {
      console.error('Error fetching future costs:', err);
      setError(err.response?.data?.error || 'Failed to fetch future costs');
    } finally {
      setLoadedOnce(true);
    }
  }, []);

  useEffect(() => {
    loadCosts(appliedFilters);
  }, [appliedFilters, loadCosts]);

  // A navbar outlet change re-scopes the list (apiClient sends it).
  useEffect(() => {
    if (!isAllOutlets) setSelectedOutlet(null);
    setAppliedFilters((prev) => ({ ...prev, _outlet: selectedOutletId ?? null, outletId: isAllOutlets ? prev.outletId : undefined }));
  }, [selectedOutletId, isAllOutlets]);

  useEffect(() => {
    let alive = true;
    classificationService
      .getClassifications({ type: 'Category' })
      .then((r) => { if (alive) setCategories(r?.classifications || []); })
      .catch((err) => console.error('Error fetching categories:', err));
    return () => { alive = false; };
  }, [selectedOutletId]);

  const applyFilters = async () => {
    setFiltering(true);
    const next = {
      category: selectedCategory?.id || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      outletId: isAllOutlets && selectedOutlet ? String(selectedOutlet.id) : undefined,
      _outlet: selectedOutletId ?? null,
      _at: Date.now(),
    };
    setAppliedFilters(next);
    await loadCosts(next);
    setFiltering(false);
  };
  const filtersActive = !!(appliedFilters.category || appliedFilters.startDate || appliedFilters.endDate || appliedFilters.outletId);

  const rows = useMemo(
    () => futureCosts.map((c) => ({ ...c, outletName: c.outletName || outletNameOf(c.outletId) })),
    [futureCosts, outletNameOf]
  );

  const sortedRows = useMemo(() => {
    const col = COLUMNS.find((c) => c.id === orderBy);
    const dir = order === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[orderBy];
      const bv = b[orderBy];
      if (col?.numeric) return (Number(av) - Number(bv)) * dir;
      if (col?.date) return (new Date(av || 0) - new Date(bv || 0)) * dir;
      return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
    });
  }, [rows, orderBy, order]);

  const safePage = page * ROWS_PER_PAGE >= sortedRows.length ? 0 : page;
  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [safePage, page]);
  const pagedRows = useMemo(
    () => sortedRows.slice(safePage * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE + ROWS_PER_PAGE),
    [sortedRows, safePage]
  );

  const handleSort = (id) => {
    setOrder(orderBy === id && order === 'asc' ? 'desc' : 'asc');
    setOrderBy(id);
  };

  const allIds = useMemo(() => rows.map((c) => c.id), [rows]);
  const handleSelectAll = (event) => setSelectedCosts(event.target.checked ? allIds : []);
  const handleSelectCost = (id) =>
    setSelectedCosts((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const flash = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const doApply = async (ids) => {
    try {
      setLoading(true);
      setError('');
      const response =
        ids.length === 1
          ? await futureCostService.applyFutureCost(ids[0])
          : await futureCostService.applyMultipleFutureCosts(ids);
      setSelectedCosts((prev) => prev.filter((id) => !ids.includes(id)));
      setApplyConfirm(null);
      flash(response?.message || `${ids.length} future cost(s) applied successfully!`);
      await loadCosts(appliedFilters);
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
      if (ids.length === 1) await futureCostService.deleteFutureCost(ids[0]);
      else await futureCostService.deleteMultipleFutureCosts(ids);
      setFutureCosts((prev) => prev.filter((c) => !ids.includes(c.id)));
      setSelectedCosts((prev) => prev.filter((id) => !ids.includes(id)));
      setDeleteConfirm(null);
      flash(`${ids.length} future cost(s) deleted successfully!`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete future costs');
    } finally {
      setLoading(false);
    }
  };

  // Row table inside the confirm dialogs mirrors the list columns.
  const COST_COLUMNS = [
    { label: 'Product', get: (r) => r.itemName },
    { label: 'Outlet', get: (r) => r.outletName || outletNameOf(r.outletId) },
    { label: 'Created By', get: (r) => r.createdBy },
    { label: 'Case Cost', get: (r) => formatCurrency(r.cost) },
    { label: 'Effective At', get: (r) => formatDate(r.effectiveAt) },
  ];

  const openDialog = () => {
    setSelectedItem(null);
    setItemSearchResults([]);
    setItemSearchText('');
    setScheduledTime(null);
    setCost('');
    setDateError('');
    // Reference prefills Outlet with the current outlet; x clears it to Global Cost.
    setDialogOutlet(dialogOutletOptions.find((o) => String(o.id) === String(currentOutletId)) || null);
    setScheduleDialogOpen(true);
  };
  const closeDialog = () => setScheduleDialogOpen(false);

  const canAdd = !!selectedItem && !!scheduledTime && parseFloat(cost) > 0 && !dateError && !loading;

  const handleAddFutureCost = async () => {
    if (!canAdd) return;
    if (scheduledTime <= new Date()) {
      setDateError('Please select a time that is in the future');
      return;
    }
    try {
      setLoading(true);
      setError('');
      await futureCostService.createFutureCost({
        productId: selectedItem.id,
        productName: selectedItem.name,
        itemType: 'Product',
        costType: COST_TYPE,
        quantity: 1,
        cost: parseFloat(cost),
        effectiveAt: scheduledTime.toISOString(),
        // All Outlets: the field decides (null = Global Cost). Navbar outlet: the
        // header decides, the dialog has no Outlet field. Send it always so the
        // apiClient never stamps anything else.
        outletId: isAllOutlets
          ? (dialogOutlet ? Number(dialogOutlet.id) : null)
          : (currentOutletId != null ? Number(currentOutletId) : null),
      });
      flash('Future cost scheduled successfully!');
      closeDialog();
      await loadCosts(appliedFilters);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to schedule future cost');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ px: 1, pt: '27px', pb: 1, backgroundColor: '#fff', minHeight: 'calc(100vh - 50px)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '3px', mb: '20px' }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, fontSize: 32, color: '#000' }}>
          Future Costs
        </Typography>
        <Button variant="contained" disableElevation startIcon={<AddIcon />} onClick={openDialog} sx={NEW_BUTTON_SX}>
          New
        </Button>
      </Box>

      {/* Reference: Select Category | Select Outlet | Select Start Date | Select End Date,
          then a Filter button that applies them. Our rule: the Outlet filter only
          under All Outlets (a navbar outlet already scopes the page). */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', '& > *': { flexBasis: 0, minWidth: 220 } }}>
        <Autocomplete
          sx={singleAutocompleteSx(!!selectedCategory)}
          options={categories}
          getOptionLabel={(o) => o?.name || ''}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          value={selectedCategory}
          onChange={(_e, v) => setSelectedCategory(v)}
          noOptionsText="No Options"
          slotProps={{ paper: { sx: LIST_PAPER_SX } }}
          renderInput={(params) => <TextField {...params} placeholder="Select Category..." sx={AUTOCOMPLETE_INPUT_SX} />}
        />
        {isAllOutlets && (
          <Autocomplete
            sx={singleAutocompleteSx(!!selectedOutlet)}
            options={outletOptions}
            getOptionLabel={(o) => o?.name || ''}
            isOptionEqualToValue={(o, v) => String(o.id) === String(v.id)}
            value={selectedOutlet}
            onChange={(_e, v) => setSelectedOutlet(v)}
            noOptionsText="No Options"
            slotProps={{ paper: { sx: LIST_PAPER_SX } }}
            renderInput={(params) => <TextField {...params} placeholder="Select Outlet..." sx={AUTOCOMPLETE_INPUT_SX} />}
          />
        )}
        <DateTimeField value={startDate} onChange={setStartDate} placeholder="Select Start Date..." showLabel={false} />
        <DateTimeField value={endDate} onChange={setEndDate} placeholder="Select End Date..." showLabel={false} />
      </Box>

      {/* Filter hard-left; count + bulk actions right (only when there are rows). */}
      <Box sx={{ display: 'flex', gap: 2, mb: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
        <Button variant="contained" disableElevation onClick={applyFilters} disabled={filtering} sx={FILTER_BUTTON_SX}>
          {filtering ? <CircularProgress size={18} sx={{ color: '#737373' }} /> : 'Filter'}
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        {rows.length > 0 && (
          <>
            <Typography component="span" sx={{ display: 'inline-block', fontSize: 16, lineHeight: '19px', color: '#000', padding: '0 8px 0 0' }}>
              {selectedCosts.length} Selected Costs
            </Typography>
            <Button variant="outlined" onClick={() => setDeleteConfirm({ ids: selectedCosts })} disabled={selectedCosts.length === 0} sx={BULK_DANGER_SX}>
              Delete Selected Costs
            </Button>
            <Button variant="outlined" onClick={() => setDeleteConfirm({ ids: allIds })} sx={BULK_DANGER_SX}>
              Delete All Costs
            </Button>
            <Button variant="outlined" onClick={() => setApplyConfirm({ ids: selectedCosts })} disabled={selectedCosts.length === 0} sx={BULK_PRIMARY_SX}>
              Apply Selected Costs
            </Button>
            {/* Article: "Immediately apply all future costs currently on the filtered list." */}
            <Button variant="outlined" onClick={() => setApplyConfirm({ ids: allIds })} sx={BULK_PRIMARY_SX}>
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

      {!loadedOnce ? null : rows.length === 0 && !filtersActive ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, py: 8 }}>
          <BlockIcon sx={{ width: 200, height: 160, color: '#000' }} />
          <Box>
            <Typography variant="h2" component="h2" sx={{ fontWeight: 700, fontSize: 24, color: '#000', mb: 1 }}>
              No Future Costs
            </Typography>
            <Typography sx={{ color: '#000', fontSize: 16 }}>There are no costs set to be activated in the future.</Typography>
          </Box>
        </Box>
      ) : (
        <TableContainer sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
          <Table sx={{ tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow sx={TABLE_HEAD_ROW_SX}>
                <TableCell padding="checkbox" sx={{ pl: '20px', width: 48, boxSizing: 'border-box' }}>
                  <Checkbox
                    {...CHECKBOX_GLYPHS}
                    indeterminate={selectedCosts.length > 0 && selectedCosts.length < rows.length}
                    checked={rows.length > 0 && selectedCosts.length === rows.length}
                    onChange={handleSelectAll}
                    sx={{ ...CHECKBOX_SX, color: '#fff', '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: '#fff' } }}
                  />
                </TableCell>
                {COLUMNS.map((col) => (
                  <TableCell key={col.id} sx={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', '&&': { p: 0 } }} onClick={() => handleSort(col.id)}>
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', height: 51, px: '8px' }}>
                      {col.label}
                      {orderBy === col.id && <SortGlyph active={order} />}
                    </Box>
                  </TableCell>
                ))}
                <TableCell sx={{ width: 236 }} />
              </TableRow>
            </TableHead>
            <TableBody sx={TABLE_BODY_SX}>
              {pagedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length + 2} align="center" sx={{ py: 4, color: '#000', fontSize: 16 }}>
                    No results found. Change search filters and try again.
                  </TableCell>
                </TableRow>
              ) : (
                pagedRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell padding="checkbox" sx={{ pl: '20px' }}>
                      <Checkbox {...CHECKBOX_GLYPHS} checked={selectedCosts.includes(row.id)} onChange={() => handleSelectCost(row.id)} sx={CHECKBOX_SX} />
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: 12, color: '#404040', lineHeight: '16px' }}>{row.itemType}</Typography>
                      <Typography sx={{ fontSize: 16, color: '#000', lineHeight: '20px' }}>{row.itemName}</Typography>
                    </TableCell>
                    <TableCell>{row.outletName}</TableCell>
                    <TableCell>{row.createdBy}</TableCell>
                    <TableCell>{formatCurrency(row.cost)}</TableCell>
                    <TableCell>{formatDate(row.effectiveAt)}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', pr: '8px' }}>
                        <Button variant="outlined" startIcon={<DeleteIcon />} onClick={() => setDeleteConfirm({ ids: [row.id], cost: row })} sx={rowActionSx('#e7000b', '#fb2c36')}>
                          Delete
                        </Button>
                        <Button variant="outlined" startIcon={<CheckCircleIcon />} onClick={() => setApplyConfirm({ ids: [row.id], cost: row })} sx={rowActionSx('#00a63e', '#00c950')}>
                          Apply
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {sortedRows.length > ROWS_PER_PAGE && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, mb: 2 }}>
              <Pagination
                count={Math.ceil(sortedRows.length / ROWS_PER_PAGE)}
                page={safePage + 1}
                onChange={(_e, p) => setPage(p - 1)}
                color="primary"
                size="large"
                showFirstButton
                showLastButton
              />
            </Box>
          )}
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
        loading={loading}
        onCancel={() => setApplyConfirm(null)}
        onConfirm={() => doApply(applyConfirm.ids)}
      />

      <Dialog open={scheduleDialogOpen} onClose={closeDialog} maxWidth={false} PaperProps={{ sx: { width: 448, maxWidth: '100%', borderRadius: '8px' } }}>
        {/* Reference: sky-200 header band, bold "?" glyph and bold sky-800 title. */}
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, backgroundColor: '#b8e6fe', px: 3, py: 2 }}>
          <Typography component="span" sx={{ fontSize: 22, fontWeight: 700, color: '#0369a1', lineHeight: 1 }}>?</Typography>
          <Typography component="span" sx={{ fontSize: 18, fontWeight: 700, color: '#0369a1' }}>Schedule Cost Change</Typography>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12}>
              <Autocomplete
                autoHighlight
                options={itemSearchResults}
                filterOptions={(options) => options}
                getOptionLabel={(option) => (typeof option === 'string' ? option : option.name || '')}
                isOptionEqualToValue={(option, value) => !!option && !!value && option.id === value.id}
                value={selectedItem}
                loading={itemSearchLoading}
                groupBy={() => 'Products'}
                noOptionsText={itemSearchText.trim().length < 2 ? 'Keep Typing to Search...' : 'No Results Found'}
                slotProps={{
                  paper: {
                    sx: {
                      mt: '4px',
                      border: '1px solid #000',
                      borderRadius: '8px',
                      '& .MuiAutocomplete-groupLabel': { fontWeight: 700, fontSize: 16, color: '#000', lineHeight: '56px', px: '14px', borderBottom: '1px solid #e5e5e5' },
                      '& .MuiAutocomplete-listbox': { maxHeight: 289, py: 0 },
                      '& .MuiAutocomplete-option': { minHeight: 56, px: '14px', fontSize: 16, color: '#000' },
                      '& .MuiAutocomplete-option.Mui-focused': { bgcolor: '#7dd3fc !important' },
                    },
                  },
                }}
                renderOption={(props, option) => {
                  const { key: _key, ...optionProps } = props;
                  // All Outlets mixes every outlet's products, and outlet-specific
                  // products may share a name: tag each with its outlet (or Global).
                  const where = isAllOutlets ? (option.outletId == null ? 'Global' : outletNameOf(option.outletId)) : '';
                  const sub = [option.family?.name || option.brand?.name || '', where].filter(Boolean).join(' · ');
                  return (
                    <li key={option.id} {...optionProps} style={{ ...optionProps.style, display: 'block' }}>
                      <Box sx={{ lineHeight: '20px' }}>{option.name}</Box>
                      {sub && <Box sx={{ fontSize: 13, color: '#737373', lineHeight: '16px' }}>{sub}</Box>}
                    </li>
                  );
                }}
                onInputChange={async (_event, newValue) => {
                  setItemSearchText(newValue || '');
                  if (newValue && newValue.trim().length >= 2) {
                    setItemSearchLoading(true);
                    try {
                      const response = await productService.getProducts({ search: newValue, limit: 10, status: 'Active' });
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
                onChange={(_event, newValue) => {
                  const item = newValue && typeof newValue !== 'string' ? newValue : null;
                  setSelectedItem(item);
                  setCost('');
                  // An outlet-specific product belongs to one outlet: book its cost
                  // there (All Outlets). Global products keep whatever was picked.
                  if (isAllOutlets && item?.outletId != null) {
                    setDialogOutlet(dialogOutletOptions.find((o) => String(o.id) === String(item.outletId)) || null);
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Search items..."
                    sx={{ '& .MuiOutlinedInput-root': DIALOG_INPUT_SX }}
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

            {/* Reference: "select the outlet you would like the cost to apply to",
                x = Global Cost; unlocks with the item. Outlet-wise: the field only
                exists under All Outlets - with a navbar outlet (or a pinned user)
                the header already answers it, so the cost lands on that outlet. */}
            {isAllOutlets && (
            <Grid item xs={12}>
              <DialogLabel show>Outlet</DialogLabel>
              <Autocomplete
                options={dialogOutletOptions}
                getOptionLabel={(o) => o?.name || ''}
                isOptionEqualToValue={(o, v) => String(o.id) === String(v.id)}
                value={dialogOutlet}
                onChange={(_e, v) => setDialogOutlet(v)}
                // An outlet-specific product is fixed to its own outlet; only a
                // global product may be booked on any outlet or as Global Cost.
                disabled={!selectedItem || selectedItem.outletId != null}
                noOptionsText="No Options"
                slotProps={{ paper: { sx: LIST_PAPER_SX } }}
                sx={{
                  '& .MuiAutocomplete-clearIndicator': { visibility: dialogOutlet ? 'visible' : 'hidden', p: '2px' },
                  '& .MuiAutocomplete-clearIndicator .MuiSvgIcon-root': { fontSize: 18, color: '#000' },
                  '& .MuiAutocomplete-inputRoot': { pl: '14px', py: '0 !important', height: 42 },
                  '& .MuiAutocomplete-inputRoot .MuiAutocomplete-input': { pl: 0, py: 0, fontSize: 16 },
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Global Cost"
                    sx={{ '& .MuiOutlinedInput-root': DIALOG_INPUT_SX, '& input::placeholder': { color: '#808080', opacity: 1 } }}
                  />
                )}
              />
            </Grid>
            )}

            <Grid item xs={12}>
              <DialogLabel show={!!scheduledTime}>Scheduled Time</DialogLabel>
              <DateTimeField
                value={scheduledTime}
                onChange={(d) => { setScheduledTime(d); setDateError(''); }}
                placeholder="Scheduled Time"
                showLabel={false}
                disabled={!selectedItem}
                disablePast
                error={!!dateError}
              />
              {dateError && <Typography sx={{ color: '#e33430', fontSize: 12, mt: 0.5 }}>{dateError}</Typography>}
            </Grid>

            <Grid item xs={12}>
              <DialogLabel show>Case Cost</DialogLabel>
              <TextField
                fullWidth
                type="number"
                placeholder={costFocused ? '' : '0'}
                disabled={!selectedItem}
                value={cost}
                sx={DIALOG_FIELD_SX}
                onFocus={(e) => { setCostFocused(true); e.target.select(); }}
                onBlur={() => setCostFocused(false)}
                onChange={(e) => setCost(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start" sx={{ mr: '6px', '& p': { color: '#404040', fontSize: 16 } }}>$</InputAdornment> }}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={closeDialog} sx={DIALOG_CANCEL_SX}>
            Cancel
          </Button>
          <Button onClick={handleAddFutureCost} variant="contained" disableElevation disabled={!canAdd} sx={DIALOG_ADD_SX}>
            {loading ? 'Add...' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FutureCosts;
