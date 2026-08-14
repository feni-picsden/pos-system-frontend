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
} from '@mui/material';
import {
  VisibilityOutlined as VisibilityIcon,
  CheckBoxOutlineBlankOutlined as SquareIcon,
  CheckBoxOutlined as CheckSquareIcon,
  CheckBox as CheckSquareSolidIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { startOfDay, endOfDay } from 'date-fns';
import customerService from '../../services/customerService';
import customerGroupService from '../../services/customerGroupService';
import salesService from '../../services/salesService';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import DateRangePicker from '../../components/Common/DateRangePicker';

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

// Reference open menu: 8px radius, selected option = light sky oklch(0.685 0.169 237.323) on white
const menuProps = {
  PaperProps: {
    sx: {
      borderRadius: '8px',
      // .Mui-focusVisible is auto-applied to the selected item on open and would
      // otherwise paint MUI's default rgba(25,118,210,0.2) over the transparent bg.
      '& .MuiMenuItem-root.Mui-selected, & .MuiMenuItem-root.Mui-selected.Mui-focusVisible': {
        bgcolor: 'transparent',
        color: '#3aa6f0',
        '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
      },
    },
  },
};

// Reference date-range trigger: single bordered box h=41 that opens the range-calendar popover
const dateRangeSx = {
  maxWidth: 460,
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    height: 41,
    bgcolor: '#fff',
    '& fieldset': { borderColor: '#404040', borderWidth: '1px' },
    '&.Mui-focused fieldset': { borderColor: '#000', borderWidth: '2px' },
  },
  '& .MuiOutlinedInput-input::placeholder': { color: '#808080', opacity: 1 },
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

      const response = await customerService.getCustomers();

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
        // ponytail: /customers returns no last-sale info — derive it from one desc-sorted
        // /sales fetch (first hit per customer = latest). Ceiling ~10k sales; move server-side then.
        const salesResponse = await salesService.getSales({ limit: 10000 });
        const lastSaleByCustomer = new Map();
        (salesResponse.sales || []).forEach((s) => {
          if (s.customerId != null && !lastSaleByCustomer.has(s.customerId)) {
            lastSaleByCustomer.set(s.customerId, new Date(s.saleDate));
          }
        });
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
  }, [selectedCustomerGroup, createdAt, loyaltyPoints, accountBalance, lastSaleAt]);

  useEffect(() => {
    (async () => {
      try {
        const response = await customerGroupService.getCustomerGroups();
        setCustomerGroups(response?.customerGroups || []);
      } catch (err) {
        console.error('Error loading customer groups:', err);
      }
    })();
  }, []);

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

  const handleDeleteCustomers = async () => {
    try {
      setLoading(true);
      await Promise.all(selectedCustomers.map((id) => customerService.deleteCustomer(id)));
      setSelectedCustomers([]);
      setDeleteOpen(false);
      loadCustomers();
    } catch (err) {
      console.error('Error deleting customers:', err);
      setDeleteOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const getCustomerName = (customer) => {
    const name = `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
    return name || customer.company || 'Unnamed Customer';
  };

  const allSelected = customers.length > 0 && selectedCustomers.length === customers.length;

  return (
    // pt 29px: reference title sits at y=79 (21px lower than an 8px top pad)
    <Box sx={{ px: 1, pt: '29px', pb: '58px', bgcolor: '#f5f5f5' }}>
        <Typography
          variant="h1"
          sx={{ color: '#000', fontSize: 32, fontWeight: 700, mb: 2 }}
        >
          Customer Utilities
        </Typography>

        {/* Filters — reference has no card/paper here */}
        <Box sx={{ mb: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6} lg={3}>
              <Typography sx={labelSx}>Customer Group</Typography>
              {/* Reference: typeahead input that live-filters options, caret + x clear button */}
              <Autocomplete
                fullWidth
                options={groupOptions}
                getOptionLabel={(option) => option.name || ''}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                value={selectedGroupOption}
                onChange={(e, value) => setSelectedCustomerGroup(value ? value.id : '')}
                sx={{ '& .MuiAutocomplete-clearIndicator': { visibility: 'visible' } }}
                componentsProps={{
                  paper: {
                    sx: {
                      borderRadius: '8px',
                      '& .MuiAutocomplete-option': { fontSize: 16, fontWeight: 400 },
                      '& .MuiAutocomplete-option[aria-selected="true"], & .MuiAutocomplete-option[aria-selected="true"].Mui-focused':
                        { color: '#3aa6f0', bgcolor: 'transparent' },
                    },
                  },
                }}
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
              <DateRangePicker
                value={createdAt}
                onChange={setCreatedAt}
                label=""
                allowEmpty
                hideIcon
                separator="–"
                placeholder="DD/MM/YYYY – DD/MM/YYYY"
                inputSx={dateRangeSx}
              />
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
              <DateRangePicker
                value={lastSaleAt}
                onChange={setLastSaleAt}
                label=""
                allowEmpty
                hideIcon
                separator="–"
                placeholder="DD/MM/YYYY – DD/MM/YYYY"
                inputSx={dateRangeSx}
              />
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

        {/* Customers Table */}
        <Paper elevation={0} sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
          {/* mr 15px: reference reserves a wider right gutter (header right edge x1897 @1920) */}
          <TableContainer sx={{ maxHeight: 'calc(100vh - 460px)', mr: '15px', width: 'auto' }}>
            <Table stickyHeader>
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
                  <TableCell padding="checkbox" sx={{ pl: '20px', width: 44 }}>
                    {/* Reference: thin-line square, solid check-square when all selected (no indeterminate) */}
                    <Checkbox
                      checked={allSelected}
                      onChange={handleSelectAll}
                      disableRipple
                      icon={<SquareIcon />}
                      checkedIcon={<CheckSquareSolidIcon />}
                      sx={{ ...rowCheckSx, color: '#fff', '&.Mui-checked': { color: '#fff' } }}
                    />
                  </TableCell>
                  <TableCell sx={{ width: 'auto' }}>Name</TableCell>
                  <TableCell align="right" sx={{ pr: '20px', width: 161 }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 4, border: 0 }}>
                      <Typography sx={{ color: '#676b72' }}>Loading customers...</Typography>
                    </TableCell>
                  </TableRow>
                ) : customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 4, border: 0 }}>
                      <Typography sx={{ color: '#676b72' }}>No customers found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer) => (
                    <TableRow
                      key={customer.id}
                      sx={{ bgcolor: '#fff', height: 74, '& td': { border: 0, py: 0 } }}
                    >
                      <TableCell padding="checkbox" sx={{ pl: '20px', width: 44 }}>
                        <Checkbox
                          checked={selectedCustomers.includes(customer.id)}
                          onChange={() => handleSelectCustomer(customer.id)}
                          disableRipple
                          icon={<SquareIcon />}
                          checkedIcon={<CheckSquareIcon />}
                          sx={rowCheckSx}
                        />
                      </TableCell>
                      <TableCell sx={{ color: '#000', fontSize: 16 }}>
                        {getCustomerName(customer)}
                      </TableCell>
                      <TableCell align="right" sx={{ pr: '20px', width: 161 }}>
                        {/* Reference: real <a href> — middle-click/copy-link must work */}
                        <Button
                          component={RouterLink}
                          to={`/customers/${customer.id}/view`}
                          startIcon={<VisibilityIcon />}
                          disableRipple
                          sx={{
                            width: 129,
                            height: 42,
                            borderRadius: '12px',
                            color: '#0284c7',
                            fontSize: 16,
                            fontWeight: 700,
                            textTransform: 'none',
                            transition: 'none',
                            '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
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
              bgcolor: '#5ebbeb',
              color: '#f8f8f8',
              borderRadius: '12px',
              width: 201,
              height: 42,
              fontWeight: 700,
              fontSize: 16,
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' },
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
