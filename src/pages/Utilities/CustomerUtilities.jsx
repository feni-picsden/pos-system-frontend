import React, { useState, useEffect, useCallback } from 'react';
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
  FormControl,
  Select,
  MenuItem,
  Grid,
  Autocomplete,
  TextField,
  Chip,
} from '@mui/material';
import {
  VisibilityOutlined as VisibilityIcon,
  CheckBoxOutlineBlankOutlined as SquareIcon,
  CheckBoxOutlined as CheckSquareIcon,
  CheckBox as CheckSquareSolidIcon,
  IndeterminateCheckBox as IndeterminateSolidIcon,
  FindInPageOutlined as NoResultsIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { startOfDay, endOfDay } from 'date-fns';
import customerService from '../../services/customerService';
import customerGroupService from '../../services/customerGroupService';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import DateRangePicker from '../../components/Common/DateRangePicker';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';

const NO_GROUP = '__none__';

// Reference: plain black label above every control, 16px fw400
const labelSx = { color: '#000', fontSize: 16, fontWeight: 400, mb: 0.5 };

// Parity system input chrome — reference select control is h=42
// `&.` matches a bare <Select> (its root IS the OutlinedInput); `& .` matches a TextField's inner root.
const inputSx = {
  '&.MuiOutlinedInput-root, & .MuiOutlinedInput-root': {
    borderRadius: '8px',
    height: 42,
    bgcolor: '#fff',
    '& fieldset': { borderColor: '#404040', borderWidth: '1px' },
    '&.Mui-focused fieldset': { borderColor: '#000', borderWidth: '2px' },
  },
  '& .MuiSelect-select': { py: 0 },
  '& .MuiOutlinedInput-input::placeholder': { color: '#808080', opacity: 1 },
};

// Reference open list (same as Product Utilities): 10px under the field, 1px dark
// border, 8px radius, 56px rows (five visible), picked row in blue, faint grey hover.
const activeRowSx = { bgcolor: 'rgba(0, 0, 0, 0.04)' };
const listPaperSx = {
  mt: '10px',
  border: '1px solid #000',
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
};
const menuProps = {
  anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
  transformOrigin: { vertical: 'top', horizontal: 'left' },
  PaperProps: {
    sx: {
      ...listPaperSx,
      maxHeight: 289,
      '& .MuiMenu-list': { py: '2px' },
      '& .MuiMenuItem-root': { minHeight: 56, px: '14px', fontSize: 16, color: '#000' },
      // .Mui-focusVisible is auto-applied to the selected item on open
      '& .MuiMenuItem-root.Mui-selected, & .MuiMenuItem-root.Mui-selected.Mui-focusVisible': { bgcolor: 'transparent', color: '#00a6f4' },
      '& .MuiMenuItem-root:hover, & .MuiMenuItem-root.Mui-focusVisible, & .MuiMenuItem-root.Mui-selected:hover': activeRowSx,
    },
  },
};
// MUI 5 Autocomplete has no listbox slot: style the rows from the paper
const autocompletePaperSx = {
  ...listPaperSx,
  '& .MuiAutocomplete-listbox': { maxHeight: 289, py: '2px' },
  '& .MuiAutocomplete-listbox .MuiAutocomplete-option': { minHeight: 56, px: '14px', fontSize: 16, fontWeight: 400, color: '#000' },
  '& .MuiAutocomplete-listbox .MuiAutocomplete-option[aria-selected="true"]': { bgcolor: 'transparent', color: '#00a6f4' },
  '& .MuiAutocomplete-listbox .MuiAutocomplete-option.Mui-focused, & .MuiAutocomplete-listbox .MuiAutocomplete-option.Mui-focused[aria-selected="true"]': activeRowSx,
};

// Multi-select tag (same as Product Utilities): flat grey 4px tag, black 16px text, no cross.
const tagChipSx = {
  height: 26,
  borderRadius: '4px',
  bgcolor: '#e5e5e5',
  color: '#000',
  fontSize: 16,
  '& .MuiChip-label': { px: 1 },
};

// Reference checkboxes: 28x32 icon button r4, thin-line square glyphs, flat black/10 hover
const rowCheckSx = {
  width: 28,
  height: 32,
  p: 0,
  borderRadius: '4px',
  color: '#000',
  '&.Mui-checked': { color: '#000' },
  '&:hover': { bgcolor: 'rgba(0,0,0,0.1)' },
};

const CustomerUtilities = () => {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState('');

  // Our addition: under "All Outlets" an Outlet filter narrows the mixed list to
  // one outlet (server ?outletId). Hidden once the navbar pins an outlet.
  const { isAllOutlets, outlets } = useSelectedOutlet();
  const [selectedOutlets, setSelectedOutlets] = useState([]); // multi-select
  // "1,2" for the server, '' when nothing is picked
  const filterOutletId = isAllOutlets && selectedOutlets.length ? selectedOutlets.map((o) => o.id).join(',') : '';

  const [selectedCustomerGroup, setSelectedCustomerGroup] = useState('');
  const [createdAt, setCreatedAt] = useState({ startDate: null, endDate: null });
  const [loyaltyPoints, setLoyaltyPoints] = useState('Ignore Loyalty Points');
  const [accountBalance, setAccountBalance] = useState('Ignore Account Balance');
  const [lastSaleAt, setLastSaleAt] = useState({ startDate: null, endDate: null });

  const [customerGroups, setCustomerGroups] = useState([]);
  const loyaltyPointOptions = ['Ignore Loyalty Points', 'Has Loyalty Points', 'No Loyalty Points'];
  const accountBalanceOptions = ['Ignore Account Balance', 'Has Account Balance', 'No Account Balance'];

  const groupOptions = [{ id: NO_GROUP, name: 'Not in a Customer Group' }, ...customerGroups];
  const selectedGroupOption = groupOptions.find((g) => g.id === selectedCustomerGroup) || null;

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);

      const pickedOutlet = isAllOutlets && filterOutletId ? filterOutletId : null;
      const response = await customerService.getCustomers(pickedOutlet ? { outletId: pickedOutlet } : {});

      let filteredCustomers = response.customers || [];

      // ponytail: GET /customers has no group param — filter client-side on customerGroupId
      if (selectedCustomerGroup === NO_GROUP) {
        filteredCustomers = filteredCustomers.filter((c) => !c.customerGroupId);
      } else if (selectedCustomerGroup) {
        filteredCustomers = filteredCustomers.filter(
          (c) => c.customerGroupId === selectedCustomerGroup
        );
      }

      // Both bounds are whole days — clamp the start too, or a start carrying a
      // time-of-day would drop everything stamped earlier that same day.
      const createdStart = createdAt.startDate ? startOfDay(createdAt.startDate) : null;
      const createdEnd = createdAt.endDate ? endOfDay(createdAt.endDate) : null;
      if (createdStart || createdEnd) {
        filteredCustomers = filteredCustomers.filter((c) => {
          const created = new Date(c.createdAt);
          if (createdStart && created < createdStart) return false;
          if (createdEnd && created > createdEnd) return false;
          return true;
        });
      }

      if (loyaltyPoints !== 'Ignore Loyalty Points') {
        filteredCustomers = filteredCustomers.filter((c) => {
          const points = c.loyaltyPoints || 0;
          return loyaltyPoints === 'Has Loyalty Points' ? points > 0 : points === 0;
        });
      }

      if (accountBalance !== 'Ignore Account Balance') {
        filteredCustomers = filteredCustomers.filter((c) => {
          const balance = c.currentOwing || 0;
          return accountBalance === 'Has Account Balance' ? balance !== 0 : balance === 0;
        });
      }

      const lastSaleStart = lastSaleAt.startDate ? startOfDay(lastSaleAt.startDate) : null;
      const lastSaleEnd = lastSaleAt.endDate ? endOfDay(lastSaleAt.endDate) : null;
      if (lastSaleStart || lastSaleEnd) {
        // Latest COMPLETED sale per customer, computed in the DB and outlet-wise
        // (/customers/last-sale-dates). It replaced a 10,000-sale browser pull that
        // also counted parked and cancelled sales.
        const res = await customerService.getLastSaleDates(pickedOutlet);
        const lastSaleByCustomer = new Map(
          Object.entries(res?.dates || {}).map(([id, d]) => [Number(id), new Date(d)])
        );
        filteredCustomers = filteredCustomers.filter((c) => {
          const lastSaleDate = lastSaleByCustomer.get(c.id);
          if (!lastSaleDate) return false;
          if (lastSaleStart && lastSaleDate < lastSaleStart) return false;
          if (lastSaleEnd && lastSaleDate > lastSaleEnd) return false;
          return true;
        });
      }

      setCustomers(filteredCustomers);
      // Drop selections the new filter removed — otherwise the footer count and
      // Delete Customers stay armed for rows the user can no longer see.
      const visibleIds = new Set(filteredCustomers.map((c) => c.id));
      setSelectedCustomers((prev) => prev.filter((id) => visibleIds.has(id)));
    } catch (err) {
      console.error('Error loading customers:', err);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCustomerGroup, createdAt, loyaltyPoints, accountBalance, lastSaleAt, isAllOutlets, filterOutletId]);

  // Groups follow the Outlet filter (pick one outlet -> only its groups)
  useEffect(() => {
    (async () => {
      try {
        const picked = isAllOutlets && filterOutletId ? filterOutletId : null;
        const response = await customerGroupService.getCustomerGroups(picked);
        setCustomerGroups(response?.customerGroups || []);
      } catch (err) {
        console.error('Error loading customer groups:', err);
      }
    })();
    setSelectedCustomerGroup('');
  }, [isAllOutlets, filterOutletId]);

  useEffect(() => {
    loadCustomers();
    // Reference: filters take effect ONLY via the Apply Filter button — initial load only here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectAll = (event) => {
    setSelectedCustomers(event.target.checked ? customers.map((c) => c.id) : []);
  };

  const handleSelectCustomer = (customerId) => {
    setSelectedCustomers((prev) =>
      prev.includes(customerId) ? prev.filter((id) => id !== customerId) : [...prev, customerId]
    );
  };

  // Each delete stands alone: one refusal (e.g. a customer who still owes money)
  // must not hide what happened to the rest, and the user is told which failed.
  const handleDeleteCustomers = async () => {
    setLoading(true);
    setError('');
    const results = await Promise.allSettled(selectedCustomers.map((id) => customerService.deleteCustomer(id)));
    const failed = results
      .map((r, i) => ({ r, customer: customers.find((c) => c.id === selectedCustomers[i]) }))
      .filter(({ r }) => r.status === 'rejected');
    if (failed.length) {
      setError(
        `${failed.length} customer${failed.length === 1 ? '' : 's'} could not be deleted: ` +
        failed.map(({ r, customer }) => `${customer ? getCustomerName(customer) : 'Customer'} (${r.reason?.response?.data?.error || 'failed'})`).join('; ')
      );
    }
    setSelectedCustomers([]);
    setDeleteOpen(false);
    setLoading(false);
    loadCustomers();
  };

  const getCustomerName = (customer) => {
    const name = `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
    return name || customer.company || 'Unnamed Customer';
  };

  const allSelected = customers.length > 0 && selectedCustomers.length === customers.length;

  return (
    // pt 29px: reference title sits at y=79 (21px lower than an 8px top pad)
    // pb 74px: the last row clears the fixed 58px footer bar (same as Product Utilities)
    <Box sx={{ px: 1, pt: '29px', pb: '74px', bgcolor: '#fff', minHeight: 'calc(100vh - 50px)' }}>
        <Typography
          variant="h1"
          sx={{ color: '#000', fontSize: 32, fontWeight: 700, mb: 2 }}
        >
          Customer Utilities
        </Typography>

        {/* Filters — reference has no card/paper here */}
        <Box sx={{ mb: 2 }}>
          <Grid container spacing={2}>
            {/* Our addition (All Outlets only): narrow the mixed list to one or more
                outlets - same multi-select look as Product Utilities' Category */}
            {isAllOutlets && (
              <Grid item xs={12} md={6} lg={3}>
                <Typography sx={labelSx}>Outlets</Typography>
                <Autocomplete
                  multiple
                  disableCloseOnSelect
                  fullWidth
                  options={outlets}
                  getOptionLabel={(o) => o.name || ''}
                  isOptionEqualToValue={(o, v) => o.id === v.id}
                  value={selectedOutlets}
                  onChange={(_e, value) => setSelectedOutlets(value)}
                  sx={{
                    '& .MuiAutocomplete-clearIndicator': { visibility: selectedOutlets.length ? 'visible' : 'hidden', p: '2px' },
                    '& .MuiAutocomplete-clearIndicator .MuiSvgIcon-root': { fontSize: 18, color: '#000' },
                    // multi-select input root pads 6px; line the placeholder up with the
                    // 14px text inset of the other fields (chips sit at the same edge)
                    '& .MuiAutocomplete-inputRoot': { pl: '14px', py: 0 },
                    '& .MuiAutocomplete-inputRoot .MuiAutocomplete-input': { pl: 0 },
                    '& .MuiChip-root': { ml: 0, mr: '4px' },
                  }}
                  slotProps={{ paper: { sx: autocompletePaperSx } }}
                  renderOption={(props, option, { selected }) => {
                    const { key: _key, ...optionProps } = props;
                    return (
                      <li key={option.id} {...optionProps} style={{ ...optionProps.style, color: selected ? '#00a6f4' : undefined }}>
                        <Checkbox
                          checked={selected}
                          icon={<SquareIcon />}
                          checkedIcon={<CheckSquareIcon />}
                          sx={{ p: 0, mr: '6px', color: '#000', '& .MuiSvgIcon-root': { fontSize: 18 }, '&.Mui-checked': { color: '#00a6f4' } }}
                        />
                        {option.name}
                      </li>
                    );
                  }}
                  renderTags={(vals, getTagProps) => {
                    const shown = vals.slice(0, 2).map((o, index) => {
                      // eslint-disable-next-line no-unused-vars
                      const { key, onDelete, ...tagProps } = getTagProps({ index });
                      return <Chip key={key} label={o.name} size="small" sx={tagChipSx} {...tagProps} />;
                    });
                    if (vals.length > 2) shown.push(<Chip key="more" label={`${vals.length - 2} More...`} size="small" sx={tagChipSx} />);
                    return shown;
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder={selectedOutlets.length ? '' : 'Select Outlets...'}
                      sx={[inputSx, { '& .MuiOutlinedInput-root': { py: 0 } }]}
                    />
                  )}
                />
              </Grid>
            )}

            <Grid item xs={12} md={6} lg={3}>
              <Typography sx={labelSx}>Customer Group</Typography>
              {/* Reference: typeahead input that live-filters options, caret + x clear button */}
              <Autocomplete
                fullWidth
                options={groupOptions}
                getOptionLabel={(option) => option.name || ''}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                value={selectedGroupOption}
                onChange={(_e, value) => setSelectedCustomerGroup(value ? value.id : '')}
                sx={{
                  '& .MuiAutocomplete-clearIndicator': { visibility: 'visible', p: '2px' },
                  '& .MuiAutocomplete-clearIndicator .MuiSvgIcon-root': { fontSize: 18, color: '#000' },
                  // same 14px text inset as the Select / date fields beside it
                  '& .MuiAutocomplete-inputRoot': { pl: '14px', py: 0 },
                  '& .MuiAutocomplete-inputRoot .MuiAutocomplete-input': { pl: 0 },
                }}
                slotProps={{ paper: { sx: autocompletePaperSx } }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Filter by Customer Group"
                    sx={[inputSx, { '& .MuiOutlinedInput-root': { py: 0 } }]}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6} lg={3}>
              <Typography sx={labelSx}>Created At</Typography>
              {/* Reference: one box holding two DD/MM/YYYY buttons and a dash */}
              <DateRangePicker value={createdAt} onChange={setCreatedAt} label="" allowEmpty splitTrigger triggerHeight={42} />
            </Grid>

            <Grid item xs={12} md={6} lg={3}>
              <Typography sx={labelSx}>Loyalty Points</Typography>
              <FormControl fullWidth>
                <Select
                  value={loyaltyPoints}
                  onChange={(e) => setLoyaltyPoints(e.target.value)}
                  sx={inputSx}
                  MenuProps={menuProps}
                >
                  {loyaltyPointOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6} lg={3}>
              <Typography sx={labelSx}>Account Balance</Typography>
              <FormControl fullWidth>
                <Select
                  value={accountBalance}
                  onChange={(e) => setAccountBalance(e.target.value)}
                  sx={inputSx}
                  MenuProps={menuProps}
                >
                  {accountBalanceOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6} lg={3}>
              <Typography sx={labelSx}>Last Sale At</Typography>
              <DateRangePicker value={lastSaleAt} onChange={setLastSaleAt} label="" allowEmpty splitTrigger triggerHeight={42} />
            </Grid>

            {/* Apply Filter: own row, right-aligned (reference) */}
            <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', pr: '15px' }}>
              <Button
                onClick={loadCustomers}
                disableElevation
                disableRipple
                sx={{
                  bgcolor: '#5ebbeb',
                  color: '#fff',
                  width: 153,
                  height: 42,
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: 16,
                  textTransform: 'none',
                  boxShadow: 'none',
                  transition: 'none',
                  '&:hover': { bgcolor: '#0ea5e9', boxShadow: 'none' },
                }}
              >
                Apply Filter
              </Button>
            </Grid>
          </Grid>
        </Box>

        {error && <Typography sx={{ color: '#dc2626', mb: 2 }}>{error}</Typography>}

        {/* Customers Table - an empty result drops the table for the reference
            centred icon + hint (same as Product Utilities) */}
        {!loading && customers.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 5, gap: 1.5 }}>
            <NoResultsIcon sx={{ fontSize: 60, color: '#000' }} />
            <Typography sx={{ fontSize: 16, color: '#000' }}>
              No results found. Change search filters and try again.
            </Typography>
          </Box>
        ) : (
        <Paper elevation={0} sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
          {/* No fixed height: the page scrolls, not a box inside it (same as Product Utilities) */}
          <TableContainer>
            <Table>
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
                    },
                    '& th:first-of-type': {
                      borderTopLeftRadius: '12px',
                      borderBottomLeftRadius: '12px',
                    },
                    '& th:last-of-type': {
                      borderTopRightRadius: '12px',
                      borderBottomRightRadius: '12px',
                    },
                  }}
                >
                  {/* Same layout as Product Utilities: checkbox + Name share the first cell */}
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {/* Reference: thin-line square; solid minus-square when some are picked, solid check-square when all */}
                      <Checkbox
                        checked={allSelected}
                        indeterminate={selectedCustomers.length > 0 && !allSelected}
                        indeterminateIcon={<IndeterminateSolidIcon />}
                        onChange={handleSelectAll}
                        disableRipple
                        icon={<SquareIcon />}
                        checkedIcon={<CheckSquareSolidIcon />}
                        inputProps={{ 'aria-label': 'Select all customers' }}
                        sx={{ ...rowCheckSx, color: '#fff', '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: '#fff' } }}
                      />
                      Name
                    </Box>
                  </TableCell>
                  {/* 16px cell + 16px = the View button's inner padding, so both end on one line */}
                  <TableCell align="right" sx={{ width: 161, pr: '32px' }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={2} align="center" sx={{ py: 4, border: 0 }}>
                      <Typography sx={{ color: '#676b72' }}>Loading customers...</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer) => (
                    <TableRow
                      key={customer.id}
                      sx={{ bgcolor: '#fff', height: 74, '& td': { border: 0, py: 0 } }}
                    >
                      <TableCell sx={{ color: '#000', fontSize: 16 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Checkbox
                            checked={selectedCustomers.includes(customer.id)}
                            onChange={() => handleSelectCustomer(customer.id)}
                            disableRipple
                            icon={<SquareIcon />}
                            checkedIcon={<CheckSquareIcon />}
                            inputProps={{ 'aria-label': `Select ${getCustomerName(customer)}` }}
                            sx={rowCheckSx}
                          />
                          {getCustomerName(customer)}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        {/* Reference: real <a href> — middle-click/copy-link must work */}
                        <Button
                          component={RouterLink}
                          to={`/customers/${customer.id}/view`}
                          startIcon={<VisibilityIcon />}
                          disableRipple
                          sx={{
                            // same as Product Utilities: 16px side padding, no hover change
                            px: 2,
                            py: 1,
                            minWidth: 0,
                            borderRadius: '12px',
                            color: '#0284c7',
                            fontSize: 16,
                            fontWeight: 700,
                            textTransform: 'none',
                            transition: 'none',
                            '&:hover': { bgcolor: 'transparent' },
                          }}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
        )}

        {/* Footer Action Bar */}
        {/* Reference: full-bleed rail pinned to the viewport bottom, h=58 */}
        <Box
          sx={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            height: 58,
            zIndex: (theme) => theme.zIndex.appBar,
            bgcolor: '#404040',
            color: '#f8f8f8',
            px: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="body2">
            {allSelected ? 'All selected' : `${selectedCustomers.length} selected`}
          </Typography>
          <Button
            onClick={() => setDeleteOpen(true)}
            disabled={selectedCustomers.length === 0}
            disableElevation
            sx={{
              // Reference: a destructive red button once something is picked
              bgcolor: '#fb2c36',
              color: '#fff',
              borderRadius: '12px',
              width: 201,
              height: 42,
              fontWeight: 700,
              fontSize: 16,
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': { bgcolor: '#e7000b', boxShadow: 'none' },
              '&.Mui-disabled': { bgcolor: '#e5e5e5', color: '#8e8e8e', cursor: 'not-allowed', pointerEvents: 'auto' },
            }}
          >
            Delete Customers
          </Button>
        </Box>

        <ConfirmDeleteDialog
          open={deleteOpen}
          title="Delete Customers"
          message={`Are you sure you want to delete ${selectedCustomers.length} customer(s)?`}
          confirmText="Delete Customers"
          loading={loading}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={handleDeleteCustomers}
        />
    </Box>
  );
};

export default CustomerUtilities;
