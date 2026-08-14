import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  Card,
  CardContent,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  ArrowBackOutlined as ArrowBackIcon,
  CloseOutlined as CloseIcon,
  DeleteOutlined as DeleteIcon,
  CheckOutlined as CheckIcon,
  SearchOutlined as SearchIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import customerService from '../../services/customerService';

// One description of the merge form drives BOTH the Results column and every customer
// column, so a field can never appear on one side and not the other.
const SECTIONS = [
  {
    id: 'general',
    title: 'General',
    fields: [
      { name: 'firstName', label: 'First Name' },
      { name: 'lastName', label: 'Last Name' },
      { name: 'company', label: 'Company' },
      { name: 'code', label: 'Code' },
    ],
  },
  {
    id: 'contact',
    title: 'Contact',
    fields: [
      { name: 'emails', label: 'Emails' },
      { name: 'phone', label: 'Phone' },
      { name: 'mobile', label: 'Mobile' },
      { name: 'fax', label: 'Fax' },
    ],
  },
  {
    id: 'social',
    title: 'Social Media',
    fields: [
      { name: 'website', label: 'Website' },
      { name: 'twitter', label: 'Twitter' },
      { name: 'facebook', label: 'Facebook' },
    ],
  },
  {
    id: 'billing',
    title: 'Billing',
    fields: [
      { name: 'billingStreet1', label: 'Street Address 1' },
      { name: 'billingStreet2', label: 'Street Address 2' },
      { name: 'billingSuburb', label: 'Suburb' },
      { name: 'billingPostcode', label: 'Postcode' },
      { name: 'billingState', label: 'State' },
      { name: 'billingCountry', label: 'Country' },
    ],
  },
  {
    id: 'delivery',
    title: 'Delivery',
    fields: [
      { name: 'deliveryStreet1', label: 'Street Address 1' },
      { name: 'deliveryStreet2', label: 'Street Address 2' },
      { name: 'deliverySuburb', label: 'Suburb' },
      { name: 'deliveryPostcode', label: 'Postcode' },
      { name: 'deliveryState', label: 'State' },
      { name: 'deliveryCountry', label: 'Country' },
    ],
  },
  {
    id: 'misc',
    title: 'Miscellaneous',
    fields: [
      { name: 'businessNumber', label: 'Business Number' },
      { name: 'birthday', label: 'Birthday' },
      { name: 'gender', label: 'Gender' },
      { name: 'invoiceMessage', label: 'Invoice Message' },
      { name: 'internalComments', label: 'Comments' },
    ],
  },
];

const ALL_FIELDS = SECTIONS.flatMap((section) => section.fields.map((field) => field.name));

const blankForm = () => Object.fromEntries(ALL_FIELDS.map((field) => [field, '']));

// Emails are the only array field; keep them as a comma separated string in the form.
const readValue = (customer, field) => {
  const value = field === 'emails' ? (customer.emails || []).filter(Boolean).join(', ') : customer[field];
  if (value === null || value === undefined) return '';
  return field === 'birthday' ? String(value).slice(0, 10) : String(value);
};

const customerLabel = (customer) =>
  `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.company || `#${customer.id}`;

const CustomerMerge = () => {
  const navigate = useNavigate();

  const [availableCustomers, setAvailableCustomers] = useState([]);
  const [customersToMerge, setCustomersToMerge] = useState([]);
  const [merged, setMerged] = useState(blankForm);
  const [fieldSelections, setFieldSelections] = useState({});
  const [selectDialogOpen, setSelectDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    customerService
      .getCustomers({})
      .then((response) => setAvailableCustomers(response.customers || []))
      .catch((err) => {
        console.error('Error loading customers:', err);
        setError('Failed to load customers');
      });
  }, []);

  const applyFields = (fields, customer, index) => {
    setMerged((prev) => ({
      ...prev,
      ...Object.fromEntries(fields.map((field) => [field, readValue(customer, field)])),
    }));
    setFieldSelections((prev) => ({
      ...prev,
      ...Object.fromEntries(fields.map((field) => [field, index])),
    }));
  };

  const clearField = (field) => {
    setMerged((prev) => ({ ...prev, [field]: '' }));
    setFieldSelections((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleAddCustomer = (customer) => {
    setSelectDialogOpen(false);
    setSearchTerm('');
    if (customersToMerge.some((c) => c.id === customer.id)) return;
    const index = customersToMerge.length;
    setCustomersToMerge([...customersToMerge, customer]);
    // The first customer added is the survivor, so seed the Results form from it.
    if (index === 0) applyFields(ALL_FIELDS, customer, 0);
  };

  const handleRemoveCustomer = (customerId) => {
    const removedIndex = customersToMerge.findIndex((c) => c.id === customerId);
    setCustomersToMerge(customersToMerge.filter((c) => c.id !== customerId));
    // Blank the Results values that came from the removed card — otherwise its
    // data stays stuck in the form with no source behind it.
    setMerged((prev) => ({
      ...prev,
      ...Object.fromEntries(
        Object.entries(fieldSelections)
          .filter(([, index]) => index === removedIndex)
          .map(([field]) => [field, ''])
      ),
    }));
    setFieldSelections((prev) =>
      Object.fromEntries(
        Object.entries(prev)
          .filter(([, index]) => index !== removedIndex)
          .map(([field, index]) => [field, index > removedIndex ? index - 1 : index])
      )
    );
  };

  const handleMerge = async () => {
    setError('');
    setSuccess('');
    if (!merged.firstName.trim()) {
      setError('Please give the merged customer a first name');
      return;
    }
    try {
      setMerging(true);
      const data = { ...merged, emails: merged.emails.split(',').map((e) => e.trim()).filter(Boolean) };
      const result = await customerService.mergeCustomers({
        customerIds: customersToMerge.map((c) => c.id),
        primaryId: customersToMerge[0].id,
        data,
      });
      setSuccess(`Merged into ${customerLabel(result.customer)}.`);
      navigate(`/customers/${result.customer.id}/view`);
    } catch (err) {
      console.error('Error merging customers:', err);
      setError(err.response?.data?.error || 'Failed to merge customers');
    } finally {
      setMerging(false);
    }
  };

  const sectionSelected = (section, index) =>
    section.fields.some((field) => fieldSelections[field.name] === index);

  const renderCustomerColumn = (customer, index) => (
    <Card sx={{ minHeight: 600, border: '1px solid #e0e0e0' }}>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {customerLabel(customer)}
            </Typography>
            {index === 0 && <Chip size="small" label="Primary" sx={{ bgcolor: '#5ebbeb', color: '#fff' }} />}
          </Box>
          <IconButton onClick={() => handleRemoveCustomer(customer.id)} color="error" size="small">
            <DeleteIcon />
          </IconButton>
        </Box>

        {SECTIONS.map((section) => (
          <Box
            key={section.id}
            sx={{
              mb: 3,
              p: 2,
              borderRadius: 1,
              backgroundColor: sectionSelected(section, index) ? '#eaf6fd' : '#fff',
              border: sectionSelected(section, index) ? '2px solid #5ebbeb' : '1px solid transparent',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {section.title}
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={() => applyFields(section.fields.map((f) => f.name), customer, index)}
              >
                Select Section
              </Button>
            </Box>

            {section.fields.map((field) => (
              <Box key={field.name} sx={{ mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ flexGrow: 1, color: '#676b72' }}>
                    {field.label}
                  </Typography>
                  {fieldSelections[field.name] === index && <CheckIcon sx={{ ml: 1, color: '#5ebbeb' }} />}
                </Box>
                <Typography
                  variant="body2"
                  onClick={() => applyFields([field.name], customer, index)}
                  sx={{
                    p: 1,
                    cursor: 'pointer',
                    minHeight: 32,
                    borderRadius: 1,
                    backgroundColor: fieldSelections[field.name] === index ? '#eaf6fd' : '#f8f8f8',
                    border: fieldSelections[field.name] === index ? '2px solid #5ebbeb' : '1px solid #e0e0e0',
                  }}
                >
                  {readValue(customer, field.name) || 'No Value'}
                </Typography>
              </Box>
            ))}
          </Box>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => navigate('/customers')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            Customer Merge
          </Typography>
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          This is a handy function if duplicate customers exist. Every sale, invoice, gift card and
          loyalty transaction of the merged customers moves onto the first (primary) customer, and
          their loyalty points and balances are added together.
        </Alert>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Results
            </Typography>
            <Card sx={{ backgroundColor: '#f0f8ff' }}>
              <CardContent sx={{ p: 2 }}>
                {SECTIONS.map((section) => (
                  <Box key={section.id} sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                      {section.title}
                    </Typography>
                    {section.fields.map((field) => (
                      <Box key={field.name} sx={{ mb: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 400, color: '#676b72' }}>
                            {field.label}
                            {field.name === 'firstName' ? ' *' : ''}
                          </Typography>
                          <Button size="small" onClick={() => clearField(field.name)} sx={{ minWidth: 0 }}>
                            Clear
                          </Button>
                        </Box>
                        <TextField
                          fullWidth
                          size="small"
                          value={merged[field.name]}
                          onChange={(e) => {
                            const { value } = e.target;
                            setMerged((prev) => ({ ...prev, [field.name]: value }));
                          }}
                        />
                      </Box>
                    ))}
                  </Box>
                ))}

                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  onClick={handleMerge}
                  disabled={customersToMerge.length < 2 || !merged.firstName.trim() || merging}
                  sx={{ bgcolor: '#5ebbeb', '&:hover': { bgcolor: '#4aa9dd' } }}
                >
                  {merging ? 'Merging...' : 'Complete Merge'}
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {customersToMerge.map((customer, index) => (
            <Grid item xs={12} md={3} key={customer.id}>
              {renderCustomerColumn(customer, index)}
            </Grid>
          ))}

          {customersToMerge.length < 4 && (
            <Grid item xs={12} md={3}>
              <Card
                sx={{
                  minHeight: 600,
                  border: '2px dashed #ccc',
                  backgroundColor: '#fafafa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  '&:hover': { borderColor: '#5ebbeb', backgroundColor: '#eaf6fd' },
                }}
                onClick={() => setSelectDialogOpen(true)}
              >
                <CardContent sx={{ textAlign: 'center', p: 4 }}>
                  <Typography variant="h6" sx={{ color: '#5ebbeb' }}>
                    + Click to add a new customer to merge
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </Paper>

      <Dialog open={selectDialogOpen} onClose={() => setSelectDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Select Customer to Merge
          <IconButton onClick={() => setSelectDialogOpen(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />
          <List>
            {availableCustomers
              .filter(
                (customer) =>
                  !customersToMerge.some((c) => c.id === customer.id) &&
                  customerLabel(customer).toLowerCase().includes(searchTerm.toLowerCase())
              )
              .slice(0, 100)
              .map((customer) => (
                <ListItem button key={customer.id} onClick={() => handleAddCustomer(customer)}>
                  <ListItemText
                    primary={customerLabel(customer)}
                    secondary={`ID: ${customer.id}${customer.code ? ` | Code: ${customer.code}` : ''}${
                      customer.emails?.[0] ? ` | ${customer.emails[0]}` : ''
                    }`}
                  />
                </ListItem>
              ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CustomerMerge;
