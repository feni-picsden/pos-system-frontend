import React, { useState, useEffect } from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  IconButton,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert
} from '@mui/material';
import {
  Close as CloseIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Code as CodeIcon,
  Email as EmailIcon
} from '@mui/icons-material';
import customerService from '../../services/customerService';
import customerGroupService from '../../services/customerGroupService';
import outletService from '../../services/outletService';
import { useAuth } from '../../contexts/AuthContext';

const steps = [
  { label: 'Name', icon: <PersonIcon /> },
  { label: 'Group', icon: <GroupIcon /> },
  { label: 'Code', icon: <CodeIcon /> },
  { label: 'Email', icon: <EmailIcon /> }
];

// Same format check the customer form applies on save, so a bad address is caught on the
// step where it is typed instead of at the end of the full form.
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

const CreateCustomerWizardModal = ({ open, onClose, onCustomerCreated, onOpenDetailsModal }) => {
  const { isSuperAdmin, getOutletId } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [customerGroups, setCustomerGroups] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    customerGroupId: '',
    outletId: null,
    code: '',
    emails: [''],
    company: '',
    phone: '',
    mobile: '',
    fax: '',
    allowMarketingEmails: 'Not Specified',
    website: '',
    twitter: '',
    facebook: '',
    billingStreet1: '',
    billingStreet2: '',
    billingSuburb: '',
    billingPostcode: '',
    billingState: '',
    billingCountry: '',
    deliveryStreet1: '',
    deliveryStreet2: '',
    deliverySuburb: '',
    deliveryPostcode: '',
    deliveryState: '',
    deliveryCountry: '',
    loyaltyPoints: 0,
    disablePromotions: false,
    priceList: '',
    businessNumber: '',
    birthday: '',
    gender: '',
    invoiceMessage: '',
    internalComments: ''
  });

  useEffect(() => {
    if (open) {
      loadCustomerGroups();
      if (isSuperAdmin()) {
        loadOutlets();
      }
      // Set default outlet for non-super admin users
      if (!isSuperAdmin()) {
        setFormData(prev => ({ ...prev, outletId: getOutletId() }));
      }
      // Reset form when modal opens
      setActiveStep(0);
      setError('');
      setFormData(prev => ({
        ...prev,
        firstName: '',
        lastName: '',
        customerGroupId: '',
        code: '',
        emails: ['']
      }));
    }
  }, [open, isSuperAdmin, getOutletId]);

  // Reload customer groups when outletId changes
  useEffect(() => {
    if (formData.outletId !== undefined && open) {
      loadCustomerGroups(formData.outletId);
    }
  }, [formData.outletId, open]);

  const loadOutlets = async () => {
    try {
      const response = await outletService.getAllOutlets();
      setOutlets(response.outlets || []);
    } catch (err) {
      console.error('Error loading outlets:', err);
    }
  };

  const loadCustomerGroups = async (selectedOutletId = null) => {
    try {
      const response = await customerGroupService.getCustomerGroups();
      if (response.customerGroups) {
        const outletIdToFilter = selectedOutletId || formData.outletId || getOutletId();
        let filtered = response.customerGroups;
        if (outletIdToFilter) {
          filtered = response.customerGroups.filter(
            (g) => (g.outletId === outletIdToFilter || g.outletId === null) && g.isActive
          );
        } else if (!isSuperAdmin()) {
          const userOutletId = getOutletId();
          filtered = response.customerGroups.filter(
            (g) => (g.outletId === userOutletId || g.outletId === null) && g.isActive
          );
        } else {
          filtered = response.customerGroups.filter(g => g.isActive);
        }
        setCustomerGroups(filtered);
      } else {
        setCustomerGroups([]);
      }
    } catch (err) {
      setError('Failed to load customer groups');
      setCustomerGroups([]);
    }
  };

  const handleInputChange = (field, value) => {
    if (field === 'outletId') {
      const newOutletId = value;
      setFormData(prev => ({ 
        ...prev, 
        outletId: newOutletId, 
        customerGroupId: '' 
      }));
      loadCustomerGroups(newOutletId);
      return;
    }
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEmailChange = (index, value) => {
    const newEmails = [...formData.emails];
    newEmails[index] = value;
    setFormData(prev => ({
      ...prev,
      emails: newEmails
    }));
  };

  const handleNext = async () => {
    if (activeStep === steps.length - 1) {
      // Create customer on final step
      await handleCreateCustomer();
    } else {
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
    }
  };

  const handleCreateCustomer = async () => {
    // Close the wizard modal
    onClose();
    
    // Open the customer details modal with wizard data
    if (onOpenDetailsModal) {
      onOpenDetailsModal(formData);
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  // Skip abandons the wizard from any step and hands over to the full form
  const handleSkip = async () => {
    await handleCreateCustomer();
  };

  const handleCancel = () => {
    setActiveStep(0);
    setError('');
    onClose();
  };

  const isStepValid = () => {
    switch (activeStep) {
      case 0: // Name step
        return formData.firstName.trim() !== '';
      case 1: // Group step — outlet only scopes the group list; it is enforced on save
        return true;
      case 2: // Code step
        return true;
      case 3: // Email step — optional, but must be a valid address when filled in
        return !formData.emails[0]?.trim() || isValidEmail(formData.emails[0]);
      default:
        return false;
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box sx={{ py: 4 }}>
            <Typography variant="h4" sx={{ fontWeight: '400', mb: 2, color: '#ffffff' }}>
              What is the customer's name?
            </Typography>
            <Box sx={{ maxWidth: 800 }}>
              <TextField
                fullWidth
                placeholder="First Name (required)"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                sx={{ mb: 2, backgroundColor: 'white' }}
                required
              />
              <TextField
                fullWidth
                placeholder="Last Name"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                sx={{ backgroundColor: 'white' }}
              />
            </Box>
          </Box>
        );

      case 1:
        return (
          <Box sx={{ py: 4 }}>
            <Typography variant="h4" sx={{ fontWeight: '400', mb: 2, color: '#ffffff' }}>
              Which group does {formData.firstName || 'the customer'} belong to?
            </Typography>
            <Box sx={{ maxWidth: 800 }}>
              {isSuperAdmin() && (
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <Select
                    value={formData.outletId || ''}
                    onChange={(e) => handleInputChange('outletId', e.target.value === '' ? null : e.target.value)}
                    sx={{ backgroundColor: 'white' }}
                  >
                    <MenuItem value="">
                      <em>Select an outlet</em>
                    </MenuItem>
                    {outlets.map((outlet) => (
                      <MenuItem key={outlet.id} value={outlet.id}>
                        {outlet.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {!isSuperAdmin() && (
                <Box sx={{ 
                  p: 2, 
                  bgcolor: 'rgba(255, 255, 255, 0.1)', 
                  borderRadius: 1,
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  mb: 2
                }}>
                  <Typography variant="body2" sx={{ color: '#ffffff' }}>
                    This customer will be created in your assigned outlet: <strong>{outlets.find(o => o.id === getOutletId())?.name || 'Your Outlet'}</strong>
                  </Typography>
                </Box>
              )}

              <FormControl fullWidth>
                <Select
                  value={formData.customerGroupId}
                  onChange={(e) => handleInputChange('customerGroupId', e.target.value)}
                  sx={{ backgroundColor: 'white' }}
                >
                  <MenuItem value="">
                    <em>No group</em>
                  </MenuItem>
                  {Array.isArray(customerGroups) && customerGroups.map((group) => (
                    <MenuItem key={group.id} value={group.id}>
                      {group.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>
        );

      case 2:
        return (
          <Box sx={{ py: 4 }}>
            <Typography variant="h4" sx={{ fontWeight: '400', mb: 2, color: '#ffffff' }}>
              What code would you like to allocate to {formData.firstName || 'the customer'}?
            </Typography>
            <Box sx={{ maxWidth: 800 }}>
              <TextField
                fullWidth
                value={formData.code}
                onChange={(e) => handleInputChange('code', e.target.value)}
                placeholder="Code"
                sx={{ backgroundColor: 'white' }}
              />
            </Box>
          </Box>
        );

      case 3:
        return (
          <Box sx={{ py: 4 }}>
            <Typography variant="h4" sx={{ fontWeight: '400', mb: 2, color: '#ffffff' }}>
              What is {formData.firstName || 'the customer'}'s email?
            </Typography>
            <Box sx={{ maxWidth: 800 }}>
              <TextField
                fullWidth
                placeholder="Email"
                value={formData.emails[0] || ''}
                onChange={(e) => handleEmailChange(0, e.target.value)}
                type="email"
                sx={{ backgroundColor: 'white' }}
                error={!isStepValid()}
                helperText={isStepValid() ? '' : 'Please enter a valid email address'}
              />
            </Box>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          background: 'linear-gradient(to bottom right,#5da2ba,#2193b0,#283c86,#4bc0c8,#283c86,#2193b0) 0 0/1400% 1400%',
          borderRadius: 2,
          minHeight: 600
        }
      }}
    >
      <Box sx={{ position: 'relative', p: 3 }}>
        <IconButton
          onClick={handleCancel}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: 'white',
            zIndex: 1
          }}
        >
          <CloseIcon />
        </IconButton>

        {/* Progress Steps */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3, gap: 2 }}>
          {[0, 1, 2, 3].map((step) => (
            <Box
              key={step}
              sx={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                border: '2px solid white',
                backgroundColor: step <= activeStep ? 'white' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}
            >
              {step < activeStep && (
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'linear-gradient(to bottom right,#5da2ba,#2193b0,#283c86,#4bc0c8,#283c86,#2193b0) 0 0/1400% 1400%',
                  }}
                />
              )}
            </Box>
          ))}
        </Box>

        {/* Title */}
        <Typography 
          variant="h4" 
          sx={{ 
            color: 'white', 
            fontWeight: 'bold',
            mb: 4,
            textAlign: 'center'
          }}
        >
          Create Customer
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <DialogContent sx={{ px: 3, pb: 2 }}>
          <Box>
            {renderStepContent()}

            {/* Navigation Buttons */}
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              mt: 4,
              pt: 2
            }}>
              <Button
                variant="text"
                onClick={handleBack}
                disabled={activeStep === 0}
                startIcon={<ArrowBackIcon />}
                sx={{ 
                  bgcolor: 'white',
                  color: '#1e3a8a',
                  '&:hover': { 
                    bgcolor: '#f3f4f6',
                    color: '#1e3a8a'
                  },
                  '&:disabled': {
                    bgcolor: 'rgba(255, 255, 255, 0.5)',
                    color: 'rgba(255, 255, 255, 0.7)'
                  }
                }}
              >
                PREVIOUS
              </Button>

              <Button
                variant="text"
                onClick={handleSkip}
                sx={{ 
                  bgcolor: 'white',
                  color: '#1e3a8a',
                  '&:hover': { 
                    bgcolor: '#f3f4f6',
                    color: '#1e3a8a'
                  }
                }}
              >
                SKIP
              </Button>

              <Button
                variant="contained"
                onClick={handleNext}
                disabled={!isStepValid()}
                endIcon={<ArrowForwardIcon />}
                sx={{ 
                  bgcolor: 'white',
                  color: '#1e3a8a',
                  '&:hover': { 
                    bgcolor: '#f3f4f6',
                    color: '#1e3a8a'
                  }
                }}
              >
                {activeStep === steps.length - 1 ? 'FINISH' : 'NEXT'}
              </Button>
            </Box>
          </Box>
        </DialogContent>
      </Box>
    </Dialog>
  );
};

export default CreateCustomerWizardModal;

