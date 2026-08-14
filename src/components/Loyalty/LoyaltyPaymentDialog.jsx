import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  InputAdornment,
} from '@mui/material';
import {
  Close as CloseIcon,
  Help as HelpIcon,
} from '@mui/icons-material';
import loyaltyService from '../../services/loyaltyService';

const LoyaltyPaymentDialog = ({
  open,
  onClose,
  saleTotal,
  customerPoints,
  customerLoyaltyInfo,
  outletId,
  onAddLoyaltyPayment,
}) => {
  const [dollarAmount, setDollarAmount] = useState('');
  const [pointsAmount, setPointsAmount] = useState('');
  const [redemptionRate, setRedemptionRate] = useState(100); // Default: 100 points = $1
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Calculate maximum redemption value from customer points
  const calculateMaxRedemptionValue = () => {
    // If redemptionValue is provided, use it
    if (customerLoyaltyInfo?.redemptionValue && customerLoyaltyInfo.redemptionValue > 0) {
      return customerLoyaltyInfo.redemptionValue;
    }
    
    // Otherwise, calculate from customer points and redemption rate
    if (customerPoints > 0 && redemptionRate > 0) {
      return customerPoints / redemptionRate;
    }
    
    return 0;
  };

  useEffect(() => {
    if (open) {
      // Reset form when dialog opens
      setDollarAmount('');
      setPointsAmount('');
      setError('');
      loadRedemptionRate();
    }
  }, [open, outletId]);

  // Pre-fill with maximum available redemption when dialog opens and redemption rate is loaded
  useEffect(() => {
    if (open && redemptionRate > 0 && customerPoints > 0 && !dollarAmount) {
      // Calculate maximum redemption value
      const maxRedemptionValue = calculateMaxRedemptionValue();
      const maxRedemption = Math.min(saleTotal, maxRedemptionValue);
      
      if (maxRedemption > 0) {
        // Set dollar amount to maximum available (or sale total, whichever is less)
        setDollarAmount(maxRedemption.toFixed(2));
        // Calculate corresponding points
        const points = Math.ceil(maxRedemption * redemptionRate);
        setPointsAmount(points.toString());
      }
    }
  }, [open, redemptionRate, customerPoints, saleTotal, dollarAmount, customerLoyaltyInfo]);

  const loadRedemptionRate = async () => {
    try {
      // Try to get from API first
      try {
        const program = await loyaltyService.getLoyaltyProgram(outletId);
        if (program && program.redemptionRate > 0) {
          setRedemptionRate(program.redemptionRate);
          // Update points amount if dollar amount is already set
          if (dollarAmount) {
            const points = calculatePointsFromDollars(parseFloat(dollarAmount));
            setPointsAmount(points.toString());
          }
          return;
        }
      } catch (apiError) {
        console.log('Could not get redemption rate from API, trying customer info:', apiError);
      }
      
      // Fallback: Calculate redemption rate from customer loyalty info if available
      if (customerLoyaltyInfo && customerLoyaltyInfo.loyaltyPoints > 0) {
        // Calculate redemption rate from customer points and redemption value
        // redemptionRate = points / dollars
        // Example: 207.98 points / $2.08 = 100 points per $1
        if (customerLoyaltyInfo.redemptionValue > 0) {
          const calculatedRate = customerLoyaltyInfo.loyaltyPoints / customerLoyaltyInfo.redemptionValue;
          if (calculatedRate > 0) {
            setRedemptionRate(Math.round(calculatedRate));
            // Update points amount if dollar amount is already set
            if (dollarAmount) {
              const points = calculatePointsFromDollars(parseFloat(dollarAmount));
              setPointsAmount(points.toString());
            }
            return;
          }
        }
      }
      
      // Keep default rate if nothing else works
      console.log('Using default redemption rate:', redemptionRate);
      // Update points amount if dollar amount is already set
      if (dollarAmount) {
        const points = calculatePointsFromDollars(parseFloat(dollarAmount));
        setPointsAmount(points.toString());
      }
    } catch (error) {
      console.error('Error loading redemption rate:', error);
      // Keep default rate
    }
  };

  // Calculate points from dollar amount
  const calculatePointsFromDollars = (dollars) => {
    if (!dollars || dollars <= 0) return 0;
    return Math.ceil(dollars * redemptionRate);
  };

  // Calculate dollars from points
  const calculateDollarsFromPoints = (points) => {
    if (!points || points <= 0) return 0;
    return (points / redemptionRate).toFixed(2);
  };

  // Handle dollar amount change
  const handleDollarChange = (value) => {
    setError('');
    const numValue = parseFloat(value) || 0;
    
    // Calculate maximum redemption value
    const maxRedemptionValue = calculateMaxRedemptionValue();
    
    // Limit to sale total and available redemption value
    const maxDollar = Math.min(
      saleTotal,
      maxRedemptionValue
    );
    
    if (maxDollar <= 0) {
      setError('No loyalty points available for redemption');
      setDollarAmount('0');
      setPointsAmount('0');
      return;
    }
    
    if (numValue > maxDollar) {
      setError(`Maximum redemption amount is $${maxDollar.toFixed(2)}`);
      setDollarAmount(maxDollar.toFixed(2));
      const points = calculatePointsFromDollars(maxDollar);
      setPointsAmount(points.toString());
      return;
    }
    
    if (numValue < 0) {
      setDollarAmount('0');
      setPointsAmount('0');
      return;
    }
    
    setDollarAmount(value);
    const points = calculatePointsFromDollars(numValue);
    setPointsAmount(points.toString());
  };

  // Handle points amount change
  const handlePointsChange = (value) => {
    setError('');
    const numValue = parseInt(value) || 0;
    
    // Limit to available customer points
    const maxPoints = customerPoints || 0;
    
    if (numValue > maxPoints) {
      setError(`Maximum points available: ${maxPoints.toFixed(2)}`);
      setPointsAmount(maxPoints.toString());
      const dollars = calculateDollarsFromPoints(maxPoints);
      setDollarAmount(dollars);
      return;
    }
    
    if (numValue < 0) {
      setDollarAmount('0');
      setPointsAmount('0');
      return;
    }
    
    setPointsAmount(value);
    const dollars = calculateDollarsFromPoints(numValue);
    setDollarAmount(dollars);
  };

  // Calculate remaining values
  const saleRemaining = saleTotal - (parseFloat(dollarAmount) || 0);
  const pointsRemaining = customerPoints - (parseFloat(pointsAmount) || 0);

  // Handle Add button
  const handleAdd = () => {
    const dollar = parseFloat(dollarAmount) || 0;
    const points = parseFloat(pointsAmount) || 0;
    
    if (dollar <= 0 || points <= 0) {
      setError('Please enter a valid redemption amount');
      return;
    }
    
    if (dollar > saleTotal) {
      setError('Redemption amount cannot exceed sale total');
      return;
    }
    
    if (points > customerPoints) {
      setError('Insufficient loyalty points');
      return;
    }
    
    // Calculate maximum redemption value
    const maxRedemptionValue = calculateMaxRedemptionValue();
    if (dollar > maxRedemptionValue) {
      setError('Redemption amount exceeds available loyalty value');
      return;
    }
    
    setLoading(true);
    setError('');
    
    // Call the parent handler to add the loyalty payment
    onAddLoyaltyPayment({
      amount: dollar,
      method: 'Loyalty',
      description: 'Loyalty Points Redemption',
      pointsRedeemed: points
    });
    
    // Close dialog after a short delay to allow state updates
    setTimeout(() => {
      setLoading(false);
      onClose();
    }, 100);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        }
      }}
    >
      <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              bgcolor: '#1976d2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 1
            }}
          >
            <HelpIcon sx={{ color: 'white', fontSize: 30 }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            Loyalty
          </Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Typography variant="body2" sx={{ textAlign: 'center', mb: 3, color: '#666' }}>
          Please enter dollars or loyalty points to redeem
        </Typography>

        {/* Sale Total and Customer Points */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Box>
            <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
              Sale Total
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              ${saleTotal.toFixed(2)}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
              Customer Points
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              {customerPoints.toFixed(2)}
            </Typography>
          </Box>
        </Box>

        {/* Input Fields */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Box sx={{ flex: 1 }}>
            <TextField
              fullWidth
              label="Dollar Loyalty"
              value={dollarAmount}
              onChange={(e) => handleDollarChange(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
              type="number"
              inputProps={{ min: 0, step: 0.01 }}
            />
            <Typography variant="caption" sx={{ color: '#666', mt: 0.5, display: 'block' }}>
              Sale Remaining: ${saleRemaining.toFixed(2)}
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }}>
            <TextField
              fullWidth
              label="Loyalty Points"
              value={pointsAmount}
              onChange={(e) => handlePointsChange(e.target.value)}
              type="number"
              inputProps={{ min: 0, step: 1 }}
            />
            <Typography variant="caption" sx={{ color: '#666', mt: 0.5, display: 'block' }}>
              Points Remaining: {pointsRemaining.toFixed(2)}
            </Typography>
          </Box>
        </Box>

        {/* Error Message */}
        {error && (
          <Box sx={{ mt: 2, mb: 1 }}>
            <Typography variant="body2" sx={{ color: '#f44336', textAlign: 'center' }}>
              {error}
            </Typography>
          </Box>
        )}

        {/* Redemption Rate Info */}
        <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f5f5f5', borderRadius: 1 }}>
          <Typography variant="caption" sx={{ color: '#666', display: 'block', textAlign: 'center' }}>
            Redemption Rate: {redemptionRate} points = $1.00
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{
            flex: 1,
            textTransform: 'none',
            borderColor: '#ddd',
            color: '#666',
            '&:hover': {
              borderColor: '#999',
              bgcolor: '#f5f5f5'
            }
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleAdd}
          variant="contained"
          disabled={loading || !dollarAmount || parseFloat(dollarAmount) <= 0}
          sx={{
            flex: 1,
            textTransform: 'none',
            bgcolor: '#1976d2',
            '&:hover': {
              bgcolor: '#1565c0'
            }
          }}
        >
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LoyaltyPaymentDialog;
