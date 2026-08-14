import React, { useState, useEffect } from 'react';
import PageLoader from '../../components/Common/PageLoader';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Button,
  TextField,
  Divider,
  Alert,
  CircularProgress,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
} from '@mui/material';
import {
  AccountCircle as AccountIcon,
  Payment as PaymentIcon,
  BusinessCenter as BusinessIcon,
  Edit as EditIcon,
  Receipt as ReceiptIcon,
  Settings as SettingsIcon,
  CreditCard as CreditCardIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import outletService from '../../services/outletService';

const AccountBilling = () => {
  const { user, getOutletName } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [outlet, setOutlet] = useState(null);
  const [saving, setSaving] = useState(false);
  const [contactDetails, setContactDetails] = useState({
    name: '',
    email: '',
    phone: '',
    mobile: '',
    website: '',
    street1: '',
    street2: '',
    suburb: '',
    postcode: '',
    state: '',
    country: 'Australia'
  });
  const [planDetails, setPlanDetails] = useState({
    plan: 'Standard',
    price: 2050.00,
    outlets: 1,
    registers: 1,
    addOns: ['Liquor Banner Group Integration'],
    nextBilling: '9th of May, 2026'
  });
  const [paymentDetails, setPaymentDetails] = useState({
    cardNumber: '**** **** **** 6093',
    cardBrand: 'Visa',
    expiryDate: ''
  });

  useEffect(() => {
    if (user) {
      fetchAccountDetails();
    }
  }, [user]);

  const fetchAccountDetails = async () => {
    try {
      setLoading(true);
      
      // Fetch current user profile with outlet details
      const response = await outletService.getCurrentOutlet();
      const userData = response.user;
      
      if (userData && userData.outlet) {
        const outletData = userData.outlet;
        setOutlet(outletData);
        
        // Parse address into components if available
        const addressParts = outletData.address ? outletData.address.split(',').map(part => part.trim()) : [];
        
        setContactDetails({
          name: outletData.name || '',
          email: outletData.email || '',
          phone: outletData.phone || '',
          mobile: '', // Not stored separately in outlet schema
          website: '', // Not stored in outlet schema
          street1: addressParts[0] || '',
          street2: addressParts[1] || '',
          suburb: addressParts[2] || '',
          postcode: addressParts[3] || '',
          state: addressParts[4] || '',
          country: 'Australia' // Default country
        });
      } else if (user && !user.isSuperAdmin) {
        // User has no outlet assigned
        setError('No outlet assigned to your account. Please contact your administrator.');
      } else {
        // Super admin - show empty form or default values
        setContactDetails({
          name: '',
          email: '',
          phone: '',
          mobile: '',
          website: '',
          street1: '',
          street2: '',
          suburb: '',
          postcode: '',
          state: '',
          country: 'Australia'
        });
      }
      
      setError(null);
    } catch (err) {
      console.error('Failed to fetch account details:', err);
      setError(err.response?.data?.error || 'Failed to fetch account details');
    } finally {
      setLoading(false);
    }
  };

  const handleContactChange = (field, value) => {
    setContactDetails(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleUpdate = async () => {
    try {
      setSaving(true);
      setError(null);
      
      if (!outlet || !outlet.id) {
        throw new Error('No outlet data available to update');
      }
      
      // Combine address parts back into a single address string
      const addressParts = [
        contactDetails.street1,
        contactDetails.street2,
        contactDetails.suburb,
        contactDetails.postcode,
        contactDetails.state
      ].filter(part => part && part.trim() !== '').join(', ');
      
      // Prepare outlet update data
      const outletUpdateData = {
        name: contactDetails.name,
        email: contactDetails.email,
        phone: contactDetails.phone,
        address: addressParts || null,
        description: outlet.description // Keep existing description
      };
      
      // Update outlet details
      await outletService.updateCurrentOutlet(outletUpdateData);
      
      // Refresh data to show updated values
      await fetchAccountDetails();
      
      // Show success message (you could add a snackbar here)
      console.log('Account details updated successfully');
      
    } catch (err) {
      console.error('Failed to update account details:', err);
      setError(err.response?.data?.error || err.message || 'Failed to update account details');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3,m: 'auto', maxWidth: '72rem',height: '93vh' }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          <AccountIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Account & Billing
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Contact Details */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardHeader
              title="Contact Details"
              avatar={<AccountIcon color="primary" />}
            />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Name"
                    value={contactDetails.name}
                    onChange={(e) => handleContactChange('name', e.target.value)}
                    variant="outlined"
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Email"
                    value={contactDetails.email}
                    onChange={(e) => handleContactChange('email', e.target.value)}
                    variant="outlined"
                    type="email"
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Phone"
                    value={contactDetails.phone}
                    onChange={(e) => handleContactChange('phone', e.target.value)}
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Mobile"
                    value={contactDetails.mobile}
                    onChange={(e) => handleContactChange('mobile', e.target.value)}
                    variant="outlined"
                    placeholder="Mobile"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Website"
                    value={contactDetails.website}
                    onChange={(e) => handleContactChange('website', e.target.value)}
                    variant="outlined"
                    placeholder="Website"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Street 1"
                    value={contactDetails.street1}
                    onChange={(e) => handleContactChange('street1', e.target.value)}
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Street 2"
                    value={contactDetails.street2}
                    onChange={(e) => handleContactChange('street2', e.target.value)}
                    variant="outlined"
                    placeholder="Street 2"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Suburb"
                    value={contactDetails.suburb}
                    onChange={(e) => handleContactChange('suburb', e.target.value)}
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Postcode / Zip Code"
                    value={contactDetails.postcode}
                    onChange={(e) => handleContactChange('postcode', e.target.value)}
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="State / Territory / Region"
                    value={contactDetails.state}
                    onChange={(e) => handleContactChange('state', e.target.value)}
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Country</InputLabel>
                    <Select
                      value={contactDetails.country}
                      onChange={(e) => handleContactChange('country', e.target.value)}
                      label="Country"
                    >
                      <MenuItem value="Australia">Australia</MenuItem>
                      <MenuItem value="United States">United States</MenuItem>
                      <MenuItem value="United Kingdom">United Kingdom</MenuItem>
                      <MenuItem value="Canada">Canada</MenuItem>
                      <MenuItem value="New Zealand">New Zealand</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Plan Details & Payment Details */}
        <Grid item xs={12} lg={4}>
          {/* Plan Details */}
          <Card sx={{ mb: 3 }}>
            <CardHeader
              title="Plan Details"
              avatar={<BusinessIcon color="primary" />}
            />
            <CardContent>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Plan
                </Typography>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6">
                    {planDetails.plan}
                  </Typography>
                  <Typography variant="h6" color="primary">
                    ${planDetails.price.toFixed(2)}/year
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {planDetails.outlets} Outlet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {planDetails.registers} Register
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Add Ons
                </Typography>
                {planDetails.addOns.map((addOn, index) => (
                  <Box key={index} display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">
                      {addOn}
                    </Typography>
                    <Button size="small" endIcon={<EditIcon />}>
                      Edit
                    </Button>
                  </Box>
                ))}
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Your next automatic debit will be on the <strong>{planDetails.nextBilling}</strong>
              </Typography>
            </CardContent>
          </Card>

          {/* Payment Details */}
          <Card sx={{ mb: 3 }}>
            <CardHeader
              title="Payment Details"
              avatar={<PaymentIcon color="primary" />}
            />
            <CardContent>
              <Box 
                sx={{ 
                  border: 1, 
                  borderColor: 'divider', 
                  borderRadius: 1, 
                  p: 2, 
                  mb: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <Box display="flex" alignItems="center">
                  <CreditCardIcon sx={{ mr: 1, color: '#1976d2' }} />
                  <Box>
                    <Typography variant="body2">
                      {paymentDetails.cardNumber}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Card Brand: {paymentDetails.cardBrand}
                    </Typography>
                  </Box>
                </Box>
                <Button size="small" endIcon={<EditIcon />}>
                  Edit
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Box sx={{ mb: 2 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<ReceiptIcon />}
              sx={{ mb: 1 }}
            >
              Invoices
            </Button>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<SettingsIcon />}
              sx={{ mb: 2 }}
            >
              Additional Options
            </Button>
            <Button
              fullWidth
              variant="contained"
              onClick={handleUpdate}
              disabled={saving}
            >
              {saving ? null : 'Update'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AccountBilling;
