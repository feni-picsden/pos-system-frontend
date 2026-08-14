import React, { useState, useEffect, useRef } from 'react';
import PageLoader from '../../components/Common/PageLoader';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  FormControl,
  Select,
  MenuItem,
  FormControlLabel,
  Alert,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  InputBase,
  InputAdornment,
  Autocomplete,
  Collapse,
  Divider,
} from '@mui/material';
import {
  SaveOutlined as SaveIcon,
  Add as AddIcon,
  Close as CloseIcon,
  HighlightOffOutlined as HighlightOffIcon,
  InfoOutlined as InfoIcon,
  ContactMailOutlined as ContactIcon,
  LocationOnOutlined as AddressIcon,
  GroupOutlined as ContactsIcon,
  LockOutlined as AuthIcon,
  ShoppingCartOutlined as OrderingIcon,
  LocalShippingOutlined as ReceivingIcon,
  CardGiftcardOutlined as MiscIcon,
  ExpandMoreOutlined as ExpandIcon,
  ChevronRightOutlined as CollapsedIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import supplierService from '../../services/supplierService';
import masterDatabaseService from '../../services/masterDatabaseService';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import { useAuth } from '../../contexts/AuthContext';
import { outletService } from '../../services/outletService';

// Shopfront reference select menu: white panel, 1px black border, radius 8,
// no shadow, no grow transition, selected/hovered option = #38bdf8 text, no bg
const selectMenuProps = {
  transitionDuration: 0,
  PaperProps: {
    sx: {
      border: '1px solid #000',
      borderRadius: '8px',
      boxShadow: 'none',
      '& .MuiMenuItem-root:hover': {
        backgroundColor: 'transparent',
        color: '#38bdf8',
      },
      '& .MuiMenuItem-root.Mui-selected': {
        backgroundColor: 'transparent',
        color: '#38bdf8',
        '&:hover': { backgroundColor: 'transparent', color: '#38bdf8' },
      },
      // menu opens with the selected item focused — kill the focusVisible tint too
      '& .MuiMenuItem-root.Mui-focusVisible, & .MuiMenuItem-root.Mui-selected.Mui-focusVisible': {
        backgroundColor: 'transparent',
        color: '#38bdf8',
      },
    },
  },
};

// Reference field label: the label lives INSIDE the box as a placeholder until the
// field is filled, then shows as a small caption ABOVE it (never a notched outline).
const FieldLabel = ({ children }) => (
  <Typography sx={{ fontSize: 12, color: '#676b72', lineHeight: '16px', mb: '2px' }}>
    {children}
  </Typography>
);

// Reference text input: 466x53 white box, 1px #000, square corners, 16px padding.
const refInputSx = {
  width: '100%',
  backgroundColor: '#ffffff',
  border: '1px solid #000',
  borderRadius: 0,
  fontSize: 16,
  p: '16px',
  '& .MuiInputBase-input': { p: 0, height: '19px', lineHeight: '19px', boxSizing: 'border-box' },
  '& textarea.MuiInputBase-input': { height: 'auto' },
};

const RefInput = ({ label, value, ...props }) => (
  <Box>
    {value !== '' && value !== null && value !== undefined && <FieldLabel>{label}</FieldLabel>}
    <InputBase
      value={value ?? ''}
      placeholder={label}
      fullWidth
      inputProps={{ 'aria-label': label }}
      sx={refInputSx}
      {...props}
    />
  </Box>
);

// Reference combobox: 466x42, 1px #404040, radius 8 (outline styling comes from the
// page wrapper below), label as a caption above once a value is chosen.
const refSelectSx = {
  height: 42,
  borderRadius: '8px',
  backgroundColor: '#ffffff',
  fontSize: 16,
};

const RefSelect = ({ label, value, children, ...props }) => (
  <Box>
    {value !== '' && value !== null && value !== undefined && <FieldLabel>{label}</FieldLabel>}
    <FormControl fullWidth>
      <Select
        value={value}
        displayEmpty
        renderValue={(v) =>
          v === '' || v === null || v === undefined ? (
            <Box component="span" sx={{ color: '#808080' }}>{label}</Box>
          ) : (
            String(v)
          )
        }
        MenuProps={selectMenuProps}
        inputProps={{ 'aria-label': label }}
        sx={refSelectSx}
        {...props}
      >
        {children}
      </Select>
    </FormControl>
  </Box>
);

// Additional-contact fields, in reference order (CC on Emails is injected after Email).
const CONTACT_FIELDS = [
  ['name', 'Name'],
  ['email', 'Email'],
  ['fax', 'Fax'],
  ['phone', 'Phone'],
  ['mobile', 'Mobile'],
  ['website', 'Website'],
  ['twitter', 'Twitter'],
  ['facebook', 'Facebook'],
  ['streetAddress1', 'Street Address 1'],
  ['streetAddress2', 'Street Address 2'],
  ['suburb', 'Suburb'],
  ['country', 'Country'],
  ['city', 'City'],
  ['region', 'Region'],
  ['postCode', 'Post Code'],
];

const trimOrNull = (value) => (typeof value === 'string' ? value.trim() : '') || null;

const SupplierDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isSuperAdmin, getOutletId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  // Reference lights EVERY section currently intersecting the viewport, not just one
  const [activeSections, setActiveSections] = useState(['general']);
  const [collapsed, setCollapsed] = useState({});
  const sectionRefs = useRef({});
  const [outlets, setOutlets] = useState([]);
  const [outletsLoading, setOutletsLoading] = useState(false);
  const [mdrOptions, setMdrOptions] = useState([]);

  const [formData, setFormData] = useState({
    // General Information
    name: '',
    status: 'Active',
    businessNumber: '',
    accountNumber: '',
    masterDatabaseRef: '',

    // Contact Information
    email: '',
    fax: '',
    phone: '',
    mobile: '',
    website: '',
    twitter: '',
    facebook: '',

    // Address Information
    streetAddress1: '',
    streetAddress2: '',
    suburb: '',
    city: '',
    postCode: '',
    region: '',
    country: '',

    // Additional Contacts
    additionalContacts: [],

    // Authentication
    authAccountNumber: '',
    authUsername: '',
    authPassword: '',
    authAdditional: '',

    // Ordering
    orderNotes: '',
    internalOrderNotes: '',
    emailOrderAutomatically: false,
    emailFormat: 'Inline',
    allowOrdersBelowMinimum: false,
    minimumOrderValue: '',
    maximumOrderValue: '',
    defaultDaysUntilDue: '',

    // Receiving Orders
    paymentFeePercentage: '',
    distributeFees: 'Proportionally',
    distributeFreightAcross: 'Items',
    defaultOrderTax: 'Including Tax',
    freightTax: 'GST',
    feesTax: 'GST',
    freightIncludedOnInvoices: false,
    fixedFreightCostPerCase: '',

    // Miscellaneous
    comments: '',
    outletId: null,
  });

  const isEditMode = !!id && id !== 'new';
  const isNewMode = id === 'new';

  // Load outlets for super admin
  useEffect(() => {
    const loadOutlets = async () => {
      if (isSuperAdmin()) {
        try {
          setOutletsLoading(true);
          const response = await outletService.getAllOutlets();
          setOutlets(response.outlets || []);
        } catch (error) {
          console.error('Error loading outlets:', error);
          setOutlets([]);
        } finally {
          setOutletsLoading(false);
        }
      }
    };

    loadOutlets();
  }, [isSuperAdmin]);

  useEffect(() => {
    if (isEditMode) {
      loadSupplier();
    } else if (isNewMode) {
      // Super admins have no own outlet (getOutletId() -> null) and pick one in
      // the navbar (SelectedOutletContext persists it as 'selectedOutletId').
      // The apiClient injects it only on GETs, so a create must resolve it here
      // or the supplier is saved global and vanishes from the outlet-scoped list.
      const ownOutlet = getOutletId();
      const savedOutlet = localStorage.getItem('selectedOutletId');
      const parsedSaved = savedOutlet != null && savedOutlet !== ''
        ? Number.parseInt(savedOutlet, 10)
        : null;
      setFormData(prev => ({
        ...prev,
        outletId: ownOutlet ?? (Number.isNaN(parsedSaved) ? null : parsedSaved),
      }));
    }
  }, [id, isEditMode, isNewMode, isSuperAdmin, getOutletId]);

  // Master Database Reference typeahead — same source the Import Supplier Products
  // and Classification screens use, filtered server-side as you type.
  useEffect(() => {
    let active = true;
    const handle = setTimeout(async () => {
      try {
        const data = await masterDatabaseService.getSuppliers({ search: formData.masterDatabaseRef });
        if (active) {
          // de-duplicate: the option list is keyed by the name string, and the master
          // database happily holds two suppliers with the same name (duplicate React key)
          setMdrOptions(
            [...new Set((data.suppliers || []).map((s) => s.name || s.reference).filter(Boolean))]
              .sort((a, b) => a.localeCompare(b))
          );
        }
      } catch {
        if (active) setMdrOptions([]);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [formData.masterDatabaseRef]);

  useEffect(() => {
    if (loading) return undefined;

    const observer = new IntersectionObserver((entries) => {
      setActiveSections((prev) => {
        const next = new Set(prev);
        entries.forEach((entry) => {
          const sectionId = entry.target.getAttribute('data-section');
          if (!sectionId) return;
          if (entry.isIntersecting) {
            next.add(sectionId);
          } else {
            next.delete(sectionId);
          }
        });
        return Array.from(next);
      });
    }, { root: null, threshold: 0 });

    // Observe all section elements
    Object.values(sectionRefs.current).forEach((ref) => {
      if (ref) {
        observer.observe(ref);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [loading]);

  const loadSupplier = async () => {
    try {
      setLoading(true);
      const response = await supplierService.getSupplier(id);
      const supplier = response.supplier;

      const rawContacts = supplier.additionalContacts
        ? (Array.isArray(supplier.additionalContacts)
            ? supplier.additionalContacts
            : Object.values(supplier.additionalContacts))
        : [];

      setFormData({
        name: supplier.name || '',
        status: supplier.status || 'Active',
        businessNumber: supplier.businessNumber || '',
        accountNumber: supplier.accountNumber || '',
        masterDatabaseRef: supplier.masterDatabaseRef || '',
        email: supplier.email || '',
        fax: supplier.fax || '',
        phone: supplier.phone || '',
        mobile: supplier.mobile || '',
        website: supplier.website || '',
        twitter: supplier.twitter || '',
        facebook: supplier.facebook || '',
        streetAddress1: supplier.streetAddress1 || '',
        streetAddress2: supplier.streetAddress2 || '',
        suburb: supplier.suburb || '',
        city: supplier.city || '',
        postCode: supplier.postCode || '',
        region: supplier.region || '',
        country: supplier.country || '',
        // null values come back from the API for blank contact fields — keep them
        // as strings so the inputs stay controlled, and always carry a React key
        additionalContacts: rawContacts.map((contact, index) => ({
          ...CONTACT_FIELDS.reduce((acc, [key]) => ({ ...acc, [key]: contact[key] || '' }), {}),
          ccOnEmails: !!contact.ccOnEmails,
          id: contact.id ?? Date.now() + index,
        })),
        authAccountNumber: supplier.authAccountNumber || '',
        authUsername: supplier.authUsername || '',
        authPassword: supplier.authPassword || '',
        authAdditional: supplier.authAdditional || '',
        orderNotes: supplier.orderNotes || '',
        internalOrderNotes: supplier.internalOrderNotes || '',
        emailOrderAutomatically: supplier.emailOrderAutomatically || false,
        // legacy 'Attachment' value maps onto the reference option list (Inline/CSV/PDF)
        emailFormat: supplier.emailFormat === 'Attachment' ? 'PDF' : (supplier.emailFormat || 'Inline'),
        allowOrdersBelowMinimum: supplier.allowOrdersBelowMinimum || false,
        minimumOrderValue: supplier.minimumOrderValue || '',
        maximumOrderValue: supplier.maximumOrderValue || '',
        defaultDaysUntilDue: supplier.defaultDaysUntilDue || '',
        paymentFeePercentage: supplier.paymentFeePercentage || '',
        distributeFees: supplier.distributeFees || 'Proportionally',
        distributeFreightAcross: supplier.distributeFreightAcross || 'Items',
        defaultOrderTax: supplier.defaultOrderTax || 'Including Tax',
        freightTax: supplier.freightTax || 'GST',
        feesTax: supplier.feesTax || 'GST',
        freightIncludedOnInvoices: supplier.freightIncludedOnInvoices || false,
        fixedFreightCostPerCase: supplier.fixedFreightCostPerCase || '',
        comments: supplier.comments || '',
        outletId: supplier.outletId || null,
      });

      setError('');
    } catch (err) {
      setError('Failed to load supplier');
      console.error('Error loading supplier:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddContact = () => {
    const newContact = {
      id: Date.now(), // Temporary ID for React key
      ...CONTACT_FIELDS.reduce((acc, [key]) => ({ ...acc, [key]: '' }), {}),
      ccOnEmails: false,
    };
    setFormData((prev) => ({
      ...prev,
      additionalContacts: [...prev.additionalContacts, newContact],
    }));
  };

  const handleRemoveContact = (contactId) => {
    setFormData((prev) => ({
      ...prev,
      additionalContacts: prev.additionalContacts.filter((contact) => contact.id !== contactId),
    }));
  };

  const handleContactChange = (contactId, field, value) => {
    setFormData((prev) => ({
      ...prev,
      additionalContacts: prev.additionalContacts.map((contact) =>
        contact.id === contactId ? { ...contact, [field]: value } : contact
      ),
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Supplier name is required');
      return;
    }

    setSaveLoading(true);
    setError('');

    try {
      // Prepare data for submission with proper validation
      const submitData = {
        ...formData,
        // Convert empty strings to null for optional fields
        email: trimOrNull(formData.email),
        fax: trimOrNull(formData.fax),
        phone: trimOrNull(formData.phone),
        mobile: trimOrNull(formData.mobile),
        website: trimOrNull(formData.website),
        twitter: trimOrNull(formData.twitter),
        facebook: trimOrNull(formData.facebook),
        streetAddress1: trimOrNull(formData.streetAddress1),
        streetAddress2: trimOrNull(formData.streetAddress2),
        suburb: trimOrNull(formData.suburb),
        city: trimOrNull(formData.city),
        postCode: trimOrNull(formData.postCode),
        region: trimOrNull(formData.region),
        country: trimOrNull(formData.country),
        authAccountNumber: trimOrNull(formData.authAccountNumber),
        authUsername: trimOrNull(formData.authUsername),
        authPassword: trimOrNull(formData.authPassword),
        authAdditional: trimOrNull(formData.authAdditional),
        orderNotes: trimOrNull(formData.orderNotes),
        internalOrderNotes: trimOrNull(formData.internalOrderNotes),
        comments: trimOrNull(formData.comments),

        // Convert number fields
        minimumOrderValue: formData.minimumOrderValue ? parseFloat(formData.minimumOrderValue) : null,
        maximumOrderValue: formData.maximumOrderValue ? parseFloat(formData.maximumOrderValue) : null,
        defaultDaysUntilDue: formData.defaultDaysUntilDue ? parseInt(formData.defaultDaysUntilDue) : null,
        paymentFeePercentage: formData.paymentFeePercentage ? parseFloat(formData.paymentFeePercentage) : null,
        fixedFreightCostPerCase: formData.fixedFreightCostPerCase ? parseFloat(formData.fixedFreightCostPerCase) : null,

        // Convert additional contacts to object format
        additionalContacts: formData.additionalContacts.length > 0
          ? formData.additionalContacts.reduce((acc, contact, index) => {
              acc[`contact_${index + 1}`] = {
                ...CONTACT_FIELDS.reduce(
                  (fields, [key]) => ({ ...fields, [key]: trimOrNull(contact[key]) }),
                  {}
                ),
                ccOnEmails: !!contact.ccOnEmails,
              };
              return acc;
            }, {})
          : null,
      };

      if (isEditMode) {
        await supplierService.updateSupplier(id, submitData);
      } else {
        await supplierService.createSupplier(submitData);
      }
      navigate('/suppliers');
    } catch (err) {
      if (err.response?.data?.details) {
        // Handle validation errors
        const validationErrors = err.response.data.details.map(detail => detail.msg).join(', ');
        setError(`Validation errors: ${validationErrors}`);
      } else {
        setError(err.response?.data?.error || `Failed to ${isEditMode ? 'update' : 'create'} supplier`);
      }
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} supplier:`, err);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/suppliers');
  };

  const toggleSection = (sectionId) => {
    setCollapsed((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const setSectionRef = (sectionId) => (element) => {
    if (element) {
      sectionRefs.current[sectionId] = element;
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  const navigationItems = [
    { id: 'general', label: 'General Information', icon: <InfoIcon /> },
    { id: 'contact', label: 'Contact', icon: <ContactIcon /> },
    { id: 'address', label: 'Address', icon: <AddressIcon /> },
    { id: 'additionalContacts', label: 'Additional Contacts', icon: <ContactsIcon /> },
    { id: 'authentication', label: 'Authentication', icon: <AuthIcon /> },
    { id: 'ordering', label: 'Ordering', icon: <OrderingIcon /> },
    { id: 'receivingOrders', label: 'Receiving Orders', icon: <ReceivingIcon /> },
    { id: 'miscellaneous', label: 'Miscellaneous', icon: <MiscIcon /> },
  ];

  const sectionIcons = {
    general: <InfoIcon />,
    contact: <ContactIcon />,
    address: <AddressIcon />,
    additionalContacts: <ContactsIcon />,
    authentication: <AuthIcon />,
    ordering: <OrderingIcon />,
    receivingOrders: <ReceivingIcon />,
    miscellaneous: <MiscIcon />,
  };

  // Reference section card: 500px, #f8f8f8, 1px #000, square, 16px padding,
  // 32px gap, deep double shadow, no transitions; body collapses over 200ms.
  const renderSection = (sectionId, title, content) => (
    <Box
      ref={setSectionRef(sectionId)}
      data-section={sectionId}
      sx={{
        width: '500px',
        boxSizing: 'border-box',
        backgroundColor: '#f8f8f8',
        border: '1px solid #000',
        borderRadius: 0,
        p: '16px',
        mb: '32px',
        boxShadow: 'rgba(0,0,0,0.25) 0px 0px 30px 0px, rgba(0,0,0,0.19) 0px 15px 30px 0px',
        scrollMarginTop: '60px',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 25,
          p: 0,
          borderBottom: '1px solid #e0e0e0',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {sectionIcons[sectionId]}
          <Typography sx={{ fontSize: '20.8px', fontWeight: 400, color: '#313439', lineHeight: '25px' }}>
            {title}
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={() => toggleSection(sectionId)}
          aria-label={collapsed[sectionId] ? `Expand ${title}` : `Collapse ${title}`}
          sx={{ p: 0, color: '#313439', '&:hover': { backgroundColor: 'transparent' } }}
        >
          {collapsed[sectionId] ? <CollapsedIcon /> : <ExpandIcon />}
        </IconButton>
      </Box>
      {/* reference collapses over 'height 0.2s' — MUI's styled root would report 0.3s */}
      <Collapse in={!collapsed[sectionId]} timeout={200} sx={{ transition: 'height 0.2s' }}>
        <Box sx={{ pt: 2 }}>{content}</Box>
      </Collapse>
    </Box>
  );

  return (
    <Box>
      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 3 }}>
        {/* Fixed Sidebar */}
        <Paper
          sx={{
            width: 250,
            height: '100%',
            p: 0,
            backgroundColor: '#fff',
            paddingBottom: '100px',
            position: 'fixed',
          }}
        >
          <List disablePadding>
            {navigationItems.map((item) => (
              <ListItem
                key={item.id}
                button
                onClick={() => {
                  sectionRefs.current[item.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                sx={{
                  // reference rail pitch: 25px item + 32px gap = 57px
                  height: 25,
                  minHeight: 25,
                  p: '0 8px',
                  mb: '32px',
                  borderRadius: 0,
                  backgroundColor: activeSections.includes(item.id) ? '#ddf1fb' : 'transparent',
                  color: '#313439',
                  transition: 'color 0.2s ease',
                  '&:hover': {
                    backgroundColor: activeSections.includes(item.id) ? '#ddf1fb' : 'transparent',
                    color: '#5ebbeb',
                  },
                }}
              >
                <ListItemIcon sx={{ color: 'inherit', minWidth: 34, '& svg': { fontSize: 20 } }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  sx={{
                    my: 0,
                    '& .MuiTypography-root': {
                      fontWeight: 400,
                      fontSize: '20.8px',
                      lineHeight: '25px',
                      color: 'inherit',
                      whiteSpace: 'nowrap',
                      transition: 'color 0.2s ease',
                    },
                  }}
                />
              </ListItem>
            ))}
          </List>
        </Paper>

        {/* Main Content */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            ml: '250px',
            backgroundColor: '#676b72',
            minHeight: '100vh',
            p: 3,
            pt: 0,
            // Shopfront combobox parity: 1px #404040 outline, 2px #000 focused, radius 8
            '& .MuiOutlinedInput-root': { borderRadius: '8px' },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
            '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
            '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
            '& input::placeholder, & textarea::placeholder': { color: '#808080', opacity: 1 },
          }}
        >
          {/* Title bar: editable supplier name + close (X) */}
          <Box
            sx={{
              alignSelf: 'stretch',
              mx: -3,
              mb: 3,
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#f8f8f8',
              px: 1.5,
              py: 1,
            }}
          >
            <InputBase
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Untitled Supplier"
              fullWidth
              sx={{
                fontSize: 16,
                '& input': { textAlign: 'center' },
                '& input::placeholder': { color: '#9e9e9e', opacity: 1 },
              }}
              inputProps={{ 'aria-label': 'Supplier name' }}
            />
            <IconButton
              onClick={handleCancel}
              aria-label="Close"
              sx={{
                p: 0,
                color: '#313439',
                '&:hover': { backgroundColor: 'transparent' },
              }}
            >
              <HighlightOffIcon sx={{ fontSize: 24 }} />
            </IconButton>
          </Box>

          {/* General Information Section */}
          {renderSection('general', 'General Information', (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <RefInput
                  label="Name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <RefSelect
                  label="Status"
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                >
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Inactive">Inactive</MenuItem>
                </RefSelect>
              </Grid>
              <Grid item xs={12}>
                <RefInput
                  label="Business Number"
                  value={formData.businessNumber}
                  onChange={(e) => handleInputChange('businessNumber', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <RefInput
                  label="Account Number"
                  value={formData.accountNumber}
                  onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                {formData.masterDatabaseRef && <FieldLabel>Master Database Reference</FieldLabel>}
                <Autocomplete
                  freeSolo
                  forcePopupIcon
                  options={mdrOptions}
                  clearOnBlur={false}
                  filterOptions={(x) => x}
                  noOptionsText="No options"
                  value={formData.masterDatabaseRef || null}
                  onChange={(e, value) => handleInputChange('masterDatabaseRef', value || '')}
                  inputValue={formData.masterDatabaseRef}
                  onInputChange={(e, value) => handleInputChange('masterDatabaseRef', value)}
                  componentsProps={{
                    paper: {
                      sx: {
                        border: '1px solid #000',
                        borderRadius: '8px',
                        boxShadow: 'none',
                        '& .MuiAutocomplete-option:hover, & .MuiAutocomplete-option[aria-selected="true"]': {
                          backgroundColor: 'transparent',
                          color: '#38bdf8',
                        },
                      },
                    },
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      height: 42,
                      py: 0,
                      backgroundColor: '#fff',
                      fontSize: 16,
                    },
                  }}
                  renderInput={(params) => (
                    <TextField {...params} placeholder="Master Database Reference" fullWidth />
                  )}
                />
              </Grid>

              {/* Outlet Selection for Super Admin */}
              {isSuperAdmin() && (
                <Grid item xs={12}>
                  <RefSelect
                    label="Outlet"
                    value={formData.outletId || ''}
                    onChange={(e) => handleInputChange('outletId', e.target.value === '' ? null : e.target.value)}
                    disabled={outletsLoading}
                    renderValue={(value) =>
                      value
                        ? (outlets.find((o) => o.id === value)?.name || 'Outlet')
                        : 'Global Supplier (No Outlet)'
                    }
                  >
                    <MenuItem value="">
                      <em>Global Supplier (No Outlet)</em>
                    </MenuItem>
                    {outletsLoading ? (
                      <MenuItem disabled>Loading outlets...</MenuItem>
                    ) : outlets.length === 0 ? (
                      <MenuItem disabled>No outlets available</MenuItem>
                    ) : (
                      outlets.map((outlet) => (
                        <MenuItem key={outlet.id} value={outlet.id}>
                          <Box>
                            <Typography variant="body2">
                              {outlet.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {outlet.address}
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))
                    )}
                  </RefSelect>
                </Grid>
              )}

              {/* Info for non-super admin users */}
              {!isSuperAdmin() && (
                <Grid item xs={12}>
                  <Box sx={{
                    p: 2,
                    bgcolor: 'info.light',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'info.main'
                  }}>
                    <Typography variant="body2" color="info.contrastText">
                      This supplier will be created in your assigned outlet: <strong>{outlets.find(o => o.id === getOutletId())?.name || 'Your Outlet'}</strong>
                    </Typography>
                  </Box>
                </Grid>
              )}
            </Grid>
          ))}

          {/* Contact Section */}
          {renderSection('contact', 'Contact', (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <RefInput
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <RefInput
                  label="Fax"
                  value={formData.fax}
                  onChange={(e) => handleInputChange('fax', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <RefInput
                  label="Phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <RefInput
                  label="Mobile"
                  value={formData.mobile}
                  onChange={(e) => handleInputChange('mobile', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <RefInput
                  label="Website"
                  value={formData.website}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <RefInput
                  label="Twitter"
                  value={formData.twitter}
                  onChange={(e) => handleInputChange('twitter', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <RefInput
                  label="Facebook"
                  value={formData.facebook}
                  onChange={(e) => handleInputChange('facebook', e.target.value)}
                />
              </Grid>
            </Grid>
          ))}

          {/* Address Section */}
          {renderSection('address', 'Address', (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <RefInput
                  label="Street Address 1"
                  value={formData.streetAddress1}
                  onChange={(e) => handleInputChange('streetAddress1', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <RefInput
                  label="Street Address 2"
                  value={formData.streetAddress2}
                  onChange={(e) => handleInputChange('streetAddress2', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <RefInput
                  label="Suburb"
                  value={formData.suburb}
                  onChange={(e) => handleInputChange('suburb', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <RefInput
                  label="City"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <RefInput
                  label="Post Code"
                  value={formData.postCode}
                  onChange={(e) => handleInputChange('postCode', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <RefInput
                  label="Region"
                  value={formData.region}
                  onChange={(e) => handleInputChange('region', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <RefInput
                  label="Country"
                  value={formData.country}
                  onChange={(e) => handleInputChange('country', e.target.value)}
                />
              </Grid>
            </Grid>
          ))}

          {/* Additional Contacts Section */}
          {renderSection('additionalContacts', 'Additional Contacts', (
            <Box>
              <Button
                fullWidth
                startIcon={<AddIcon />}
                onClick={handleAddContact}
                sx={{
                  height: 32,
                  borderRadius: 0,
                  backgroundColor: '#32b643',
                  color: '#f8f8f8',
                  fontSize: 16,
                  fontWeight: 400,
                  textTransform: 'none',
                  border: '1px solid #f8f8f8',
                  boxShadow: 'none',
                  transition: 'background-color 0.2s ease, color 0.2s ease',
                  '&:hover': {
                    backgroundColor: '#f8f8f8',
                    color: '#32b643',
                    borderColor: '#32b643',
                    boxShadow: 'none',
                  },
                }}
              >
                Add New Contact
              </Button>

              {/* Reference has no sub-card and no per-contact heading: a divider, then fields */}
              {formData.additionalContacts.map((contact) => (
                <Box key={contact.id}>
                  <Divider sx={{ my: 2, borderColor: '#000' }} />
                  <Grid container spacing={2}>
                    {CONTACT_FIELDS.map(([field, label]) => (
                      <React.Fragment key={field}>
                        <Grid item xs={12}>
                          <RefInput
                            label={label}
                            type={field === 'email' ? 'email' : 'text'}
                            value={contact[field] ?? ''}
                            onChange={(e) => handleContactChange(contact.id, field, e.target.value)}
                          />
                        </Grid>
                        {field === 'email' && (
                          <Grid item xs={12}>
                            <FormControlLabel
                              control={
                                <ShopfrontSwitch
                                  checked={!!contact.ccOnEmails}
                                  onChange={(e) => handleContactChange(contact.id, 'ccOnEmails', e.target.checked)}
                                />
                              }
                              label="CC on Emails"
                              sx={{ gap: 1, ml: 0 }}
                            />
                          </Grid>
                        )}
                      </React.Fragment>
                    ))}
                  </Grid>

                  {/* Remove Contact Button */}
                  <Button
                    fullWidth
                    startIcon={<CloseIcon />}
                    onClick={() => handleRemoveContact(contact.id)}
                    sx={{
                      mt: 2,
                      height: 32,
                      borderRadius: 0,
                      backgroundColor: '#e33430',
                      color: '#f8f8f8',
                      fontSize: 16,
                      fontWeight: 400,
                      textTransform: 'none',
                      border: '1px solid #f8f8f8',
                      boxShadow: 'none',
                      transition: 'background-color 0.2s ease, color 0.2s ease',
                      '&:hover': {
                        backgroundColor: '#f8f8f8',
                        color: '#e33430',
                        borderColor: '#e33430',
                        boxShadow: 'none',
                      },
                    }}
                  >
                    Remove Contact
                  </Button>
                </Box>
              ))}
            </Box>
          ))}

          {/* Authentication Section */}
          {renderSection('authentication', 'Authentication', (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <RefInput
                  label="Account Number"
                  value={formData.authAccountNumber}
                  onChange={(e) => handleInputChange('authAccountNumber', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <RefInput
                  label="Username"
                  value={formData.authUsername}
                  onChange={(e) => handleInputChange('authUsername', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <RefInput
                  label="Password"
                  type="password"
                  value={formData.authPassword}
                  onChange={(e) => handleInputChange('authPassword', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <RefInput
                  label="Additional Authentication"
                  value={formData.authAdditional}
                  onChange={(e) => handleInputChange('authAdditional', e.target.value)}
                />
              </Grid>
            </Grid>
          ))}

          {/* Ordering Section */}
          {renderSection('ordering', 'Ordering', (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <RefInput
                  label="Order Notes"
                  multiline
                  rows={3}
                  value={formData.orderNotes}
                  onChange={(e) => handleInputChange('orderNotes', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <RefInput
                  label="Internal Order Notes"
                  multiline
                  rows={3}
                  value={formData.internalOrderNotes}
                  onChange={(e) => handleInputChange('internalOrderNotes', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <ShopfrontSwitch
                      checked={formData.emailOrderAutomatically}
                      onChange={(e) => handleInputChange('emailOrderAutomatically', e.target.checked)}
                    />
                  }
                  label="Email Order Automatically"
                  sx={{ gap: 1, ml: 0 }}
                />
              </Grid>
              <Grid item xs={12}>
                <RefSelect
                  label="Email Format"
                  value={formData.emailFormat}
                  onChange={(e) => handleInputChange('emailFormat', e.target.value)}
                  endAdornment={
                    formData.emailFormat ? (
                      <InputAdornment position="end" sx={{ mr: 2 }}>
                        <IconButton
                          size="small"
                          aria-label="Clear email format"
                          onClick={() => handleInputChange('emailFormat', '')}
                        >
                          <CloseIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </InputAdornment>
                    ) : null
                  }
                >
                  <MenuItem value="Inline">Inline</MenuItem>
                  <MenuItem value="CSV">CSV</MenuItem>
                  <MenuItem value="PDF">PDF</MenuItem>
                </RefSelect>
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <ShopfrontSwitch
                      checked={formData.allowOrdersBelowMinimum}
                      onChange={(e) => handleInputChange('allowOrdersBelowMinimum', e.target.checked)}
                    />
                  }
                  label="Allow Orders Below Minimum"
                  sx={{ gap: 1, ml: 0 }}
                />
              </Grid>
              <Grid item xs={12}>
                <RefInput
                  label="Minimum Order Value"
                  type="number"
                  value={formData.minimumOrderValue}
                  onChange={(e) => handleInputChange('minimumOrderValue', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <RefInput
                  label="Maximum Order Value"
                  type="number"
                  value={formData.maximumOrderValue}
                  onChange={(e) => handleInputChange('maximumOrderValue', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <RefInput
                  label="Default Days Until Due"
                  type="number"
                  value={formData.defaultDaysUntilDue}
                  onChange={(e) => handleInputChange('defaultDaysUntilDue', e.target.value)}
                />
              </Grid>
            </Grid>
          ))}

          {/* Receiving Orders Section */}
          {renderSection('receivingOrders', 'Receiving Orders', (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <RefInput
                  label="Payment Fee Percentage"
                  type="number"
                  value={formData.paymentFeePercentage}
                  onChange={(e) => handleInputChange('paymentFeePercentage', e.target.value)}
                  endAdornment={<Typography sx={{ fontSize: 16 }}>%</Typography>}
                />
              </Grid>
              <Grid item xs={12}>
                <RefSelect
                  label="Distribute Fees"
                  value={formData.distributeFees}
                  onChange={(e) => handleInputChange('distributeFees', e.target.value)}
                >
                  <MenuItem value="Proportionally">Proportionally</MenuItem>
                  <MenuItem value="Evenly">Evenly</MenuItem>
                </RefSelect>
              </Grid>
              <Grid item xs={12}>
                <RefSelect
                  label="Distribute Freight Across"
                  value={formData.distributeFreightAcross}
                  onChange={(e) => handleInputChange('distributeFreightAcross', e.target.value)}
                >
                  <MenuItem value="Items">Items</MenuItem>
                  <MenuItem value="Cases">Cases</MenuItem>
                  <MenuItem value="Mixed">Mixed</MenuItem>
                </RefSelect>
              </Grid>
              <Grid item xs={12}>
                <RefSelect
                  label="Default Order Tax"
                  value={formData.defaultOrderTax}
                  onChange={(e) => handleInputChange('defaultOrderTax', e.target.value)}
                >
                  <MenuItem value="Including Tax">Including Tax</MenuItem>
                  <MenuItem value="Excluding Tax">Excluding Tax</MenuItem>
                  <MenuItem value="Excluding WET">Excluding WET</MenuItem>
                </RefSelect>
              </Grid>
              <Grid item xs={12}>
                <RefSelect
                  label="Freight Tax"
                  value={formData.freightTax}
                  onChange={(e) => handleInputChange('freightTax', e.target.value)}
                >
                  <MenuItem value="GST">GST</MenuItem>
                  <MenuItem value="VAT">VAT</MenuItem>
                </RefSelect>
              </Grid>
              <Grid item xs={12}>
                <RefSelect
                  label="Fees Tax"
                  value={formData.feesTax}
                  onChange={(e) => handleInputChange('feesTax', e.target.value)}
                >
                  <MenuItem value="GST">GST</MenuItem>
                  <MenuItem value="VAT">VAT</MenuItem>
                </RefSelect>
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <ShopfrontSwitch
                      checked={formData.freightIncludedOnInvoices}
                      onChange={(e) => handleInputChange('freightIncludedOnInvoices', e.target.checked)}
                    />
                  }
                  label="Freight Included on Invoices"
                  sx={{ gap: 1, ml: 0 }}
                />
              </Grid>
              <Grid item xs={12}>
                <RefInput
                  label="Fixed Freight Cost Per Case"
                  type="number"
                  value={formData.fixedFreightCostPerCase}
                  onChange={(e) => handleInputChange('fixedFreightCostPerCase', e.target.value)}
                />
              </Grid>
            </Grid>
          ))}

          {/* Miscellaneous Section */}
          {renderSection('miscellaneous', 'Miscellaneous', (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <RefInput
                  label="Comments"
                  multiline
                  rows={4}
                  value={formData.comments}
                  onChange={(e) => handleInputChange('comments', e.target.value)}
                />
              </Grid>
            </Grid>
          ))}
        </Box>
      </Box>

      {/* Save button — fixed bottom-right, Shopfront invert-on-hover */}
      <Button
        onClick={handleSave}
        disabled={saveLoading}
        startIcon={<SaveIcon sx={{ fontSize: '32px !important' }} />}
        sx={{
          position: 'fixed',
          right: 0,
          bottom: 0,
          width: 288,
          height: 72,
          zIndex: 1200,
          backgroundColor: '#1c86f2',
          color: '#f8f8f8',
          fontSize: 32,
          fontWeight: 400,
          textTransform: 'none',
          borderRadius: 0,
          border: '1px solid #1c86f2',
          boxShadow: 'none',
          transition: 'background-color 0.2s ease, color 0.2s ease',
          '&:hover': {
            backgroundColor: '#f8f8f8',
            color: '#1c86f2',
            borderColor: '#1c86f2',
            boxShadow: 'none',
          },
          '&.Mui-disabled': {
            backgroundColor: '#404040',
            color: '#737373',
            borderColor: '#404040',
          },
        }}
      >
        Save
      </Button>
    </Box>
  );
};

export default SupplierDetails;
