import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Grid
} from '@mui/material';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import loyaltyProgramService from '../../services/loyaltyProgramService';

// Reference-style flat input: static label above, 1px #000 border, radius 0, h53
const refFieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 0,
    height: 53,
    fontSize: 16,
    backgroundColor: 'transparent',
    '& fieldset': { border: '1px solid #000' },
    '&:hover fieldset': { border: '1px solid #000' },
    '&.Mui-focused fieldset': { border: '2px solid #000' }
  }
};

const refFieldLabelSx = { fontSize: 16, color: '#000', mb: 0.5 };

// Reference Save button: solid #1c86f2, 32px text, radius 0, invert on hover
const refSaveButtonSx = {
  height: 48,
  px: 2.5,
  backgroundColor: '#1c86f2',
  color: '#f8f8f8',
  fontSize: 32,
  fontWeight: 400,
  lineHeight: 1,
  textTransform: 'none',
  borderRadius: 0,
  border: '1px solid #1c86f2',
  boxShadow: 'none',
  transition: 'background-color 0.2s ease, color 0.2s ease',
  '&:hover': {
    backgroundColor: '#f8f8f8',
    color: '#1c86f2',
    border: '1px solid #1c86f2',
    boxShadow: 'none'
  }
};

const LoyaltySettings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [loyaltyProgram, setLoyaltyProgram] = useState(null);
  const [formData, setFormData] = useState({
    name: 'Loyalty',
    loyaltyRate: '1',
    redemptionRate: '100',
    isEnabled: false
  });

  useEffect(() => {
    fetchLoyaltyProgram();
  }, []);

  const fetchLoyaltyProgram = async () => {
    try {
      setLoading(true);
      const response = await loyaltyProgramService.getLoyaltyPrograms({
        outletId: user?.outletId
      });
      
      if (response.loyaltyPrograms && response.loyaltyPrograms.length > 0) {
        const program = response.loyaltyPrograms[0];
        setLoyaltyProgram(program);
        setFormData({
          name: program.name,
          loyaltyRate: program.loyaltyRate.toString(),
          redemptionRate: program.redemptionRate.toString(),
          isEnabled: program.isEnabled
        });
      }
    } catch (err) {
      console.error('Error fetching loyalty program:', err);
      setError(err.response?.data?.error || 'Failed to fetch loyalty program');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      // For non-superadmin users, outlet ID is required
      if (!user?.isSuperAdmin && !user?.outletId) {
        setError('Outlet is required. Please select an outlet to create a loyalty program.');
        setSaving(false);
        return;
      }

      const data = {
        name: formData.name,
        loyaltyRate: parseFloat(formData.loyaltyRate),
        redemptionRate: parseFloat(formData.redemptionRate),
        isEnabled: formData.isEnabled,
        outletId: user?.outletId || null // null for superadmin without outlet (global program)
      };

      if (loyaltyProgram) {
        // Update existing program
        await loyaltyProgramService.updateLoyaltyProgram(loyaltyProgram.id, data);
        setSuccess('Loyalty settings updated successfully');
      } else {
        // Create new program
        const response = await loyaltyProgramService.createLoyaltyProgram(data);
        setLoyaltyProgram(response.loyaltyProgram);
        setSuccess('Loyalty program created successfully');
      }

      // Refresh data
      await fetchLoyaltyProgram();
    } catch (err) {
      console.error('Error saving loyalty program:', err);
      setError(err.response?.data?.error || 'Failed to save loyalty settings');
    } finally {
      setSaving(false);
    }
  };

  const handleCustomize = () => {
    if (loyaltyProgram) {
      navigate(`/setup/loyalty/${loyaltyProgram.id}/assign`);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={2}>
      <Typography variant="h4" gutterBottom sx={{ fontSize: 32, fontWeight: 700, color: '#000' }}>
        Loyalty Settings
      </Typography>

      <Typography paragraph sx={{ fontSize: 16, color: '#000' }}>
        Please note: The highest earn value will be selected and the lowest redeem value will be selected on conflicts, however values with zero will take highest priority.
      </Typography>

      {!user?.isSuperAdmin && !user?.outletId && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Please select an outlet first to create a loyalty program. Loyalty programs are outlet-specific.
        </Alert>
      )}
      
      {user?.isSuperAdmin && !user?.outletId && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Creating a global loyalty program (applies to all outlets). To create an outlet-specific program, please switch to that outlet first.
        </Alert>
      )}

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

      <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 0, backgroundColor: 'transparent', p: 1, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box display="flex" alignItems="center">
            <Typography sx={{ fontSize: 27, fontWeight: 700, color: '#000' }}>
              {user?.outlet?.name ? user.outlet.name : 'Global Loyalty Program'}
            </Typography>
            {loyaltyProgram && (
              <Button
                onClick={handleCustomize}
                sx={{
                  ml: 2,
                  height: 39,
                  px: 2,
                  backgroundColor: '#f8f8f8',
                  color: '#676b72',
                  fontSize: 24,
                  fontWeight: 400,
                  lineHeight: 1,
                  textTransform: 'none',
                  borderRadius: 0,
                  border: '1px solid #676b72',
                  transition: 'background-color 0.2s ease, color 0.2s ease',
                  '&:hover': {
                    backgroundColor: '#f8f8f8',
                    color: '#676b72',
                    border: '1px solid #676b72'
                  }
                }}
              >
                Customise
              </Button>
            )}
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography sx={{ fontSize: 16, color: '#000' }}>Enable Loyalty</Typography>
            <ShopfrontSwitch
              checked={formData.isEnabled}
              onChange={(e) => handleChange('isEnabled', e.target.checked)}
            />
          </Box>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Typography sx={refFieldLabelSx}>Name of Loyalty Program</Typography>
            <TextField
              fullWidth
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              variant="outlined"
              sx={refFieldSx}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <Typography sx={refFieldLabelSx}>Loyalty Rate ($1 = x amount of points)</Typography>
            <TextField
              fullWidth
              value={formData.loyaltyRate}
              onChange={(e) => handleChange('loyaltyRate', e.target.value)}
              variant="outlined"
              type="number"
              inputProps={{ min: 0, step: 0.01 }}
              sx={refFieldSx}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <Typography sx={refFieldLabelSx}>Redemption Rate (x points spent = $1)</Typography>
            <TextField
              fullWidth
              value={formData.redemptionRate}
              onChange={(e) => handleChange('redemptionRate', e.target.value)}
              variant="outlined"
              type="number"
              inputProps={{ min: 0, step: 0.01 }}
              sx={refFieldSx}
            />
          </Grid>
        </Grid>
      </Box>

      <Box display="flex" justifyContent="flex-end">
        <Button
          onClick={handleSave}
          disabled={saving || (!user?.isSuperAdmin && !user?.outletId)}
          startIcon={saving ? <CircularProgress size={20} /> : <SaveOutlinedIcon sx={{ fontSize: '28px !important' }} />}
          sx={refSaveButtonSx}
        >
          Save
        </Button>
      </Box>
    </Box>
  );
};

export default LoyaltySettings;
