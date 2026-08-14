import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Chip,
  Divider
} from '@mui/material';
import {
  EmojiEvents as LoyaltyIcon,
  Add as AddIcon,
  Remove as RemoveIcon
} from '@mui/icons-material';
import loyaltyService from '../../services/loyaltyService';

const LoyaltyDisplay = ({ 
  customer, 
  items, 
  outletId, 
  onLoyaltyCalculated,
  onRedemptionApplied 
}) => {
  const [loading, setLoading] = useState(false);
  const [loyaltyInfo, setLoyaltyInfo] = useState(null);
  const [customerLoyalty, setCustomerLoyalty] = useState(null);
  const [pointsToRedeem, setPointsToRedeem] = useState('');
  const [redemptionApplied, setRedemptionApplied] = useState(null);
  const [error, setError] = useState('');
  const calculationTimeoutRef = useRef(null);
  const lastItemsHashRef = useRef('');
  const isCalculatingRef = useRef(false);
  const onLoyaltyCalculatedRef = useRef(onLoyaltyCalculated);
  
  useEffect(() => {
    onLoyaltyCalculatedRef.current = onLoyaltyCalculated;
  }, [onLoyaltyCalculated]);

  const itemsHash = useMemo(() => {
    if (!items || items.length === 0) return '';
    return JSON.stringify(items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount
    })));
  }, [items]);

  useEffect(() => {
    if (customer?.id) {
      fetchCustomerLoyalty();
    } else {
      setCustomerLoyalty(null);
      setLoyaltyInfo(null);
      setRedemptionApplied(null);
    }
  }, [customer?.id]);

  useEffect(() => {
    if (calculationTimeoutRef.current) {
      clearTimeout(calculationTimeoutRef.current);
    }

    if (customer?.id && customer?.loyaltyEnabled && items && items.length > 0) {
      if (itemsHash !== lastItemsHashRef.current) {
        lastItemsHashRef.current = itemsHash;
        calculationTimeoutRef.current = setTimeout(async () => {
          if (isCalculatingRef.current) return;
          
          isCalculatingRef.current = true;
          try {
            setLoading(true);
            setError('');

            const currentItems = items;
            if (!currentItems || currentItems.length === 0) {
              setLoading(false);
              isCalculatingRef.current = false;
              return;
            }

            // Filter out items without productId and log for debugging
            const itemsForCalculation = currentItems
              .filter(item => {
                const hasProductId = item.productId && item.productId !== null && item.productId !== undefined;
                if (!hasProductId) {
                  console.log('[Loyalty] Skipping item without productId:', item);
                }
                return hasProductId;
              })
              .map(item => {
                const quantity = item.quantity || 1;
                const unitPrice = item.unitPrice || 0;
                const discount = item.discount || item.redemptionDiscount || 0;
                
                console.log('[Loyalty] Calculating for item:', {
                  productId: item.productId,
                  productName: item.productName || 'unknown',
                  quantity,
                  unitPrice,
                  discount
                });
                
                return {
                  productId: item.productId,
                  quantity: quantity,
                  unitPrice: unitPrice,
                  discount: discount
                };
              });

            // If no valid items after filtering, return early
            if (itemsForCalculation.length === 0) {
              setLoading(false);
              isCalculatingRef.current = false;
              setLoyaltyInfo({
                eligible: false,
                totalPointsEarned: 0,
                totalEligibleAmount: 0,
                items: []
              });
              return;
            }

            console.log('[Loyalty] Sending items for calculation:', itemsForCalculation);
            const calculation = await loyaltyService.calculateCartLoyalty(itemsForCalculation, outletId);
            console.log('[Loyalty] Calculation result:', calculation);
            setLoyaltyInfo(calculation);
            
            if (onLoyaltyCalculatedRef.current) {
              onLoyaltyCalculatedRef.current(calculation);
            }
          } catch (err) {
            console.error('Error calculating loyalty:', err);
            setError(err.response?.data?.error || 'Failed to calculate loyalty');
          } finally {
            setLoading(false);
            isCalculatingRef.current = false;
          }
        }, 300); // 300ms debounce
      }
    } else {
      setLoyaltyInfo(null);
      setRedemptionApplied(null);
      lastItemsHashRef.current = '';
    }

    // Cleanup timeout on unmount
    return () => {
      if (calculationTimeoutRef.current) {
        clearTimeout(calculationTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id, customer?.loyaltyEnabled, itemsHash, outletId]);

  const fetchCustomerLoyalty = async () => {
    try {
      const response = await loyaltyService.getCustomerLoyalty(customer.id);
      setCustomerLoyalty(response.customer);
    } catch (err) {
      console.error('Error fetching customer loyalty:', err);
    }
  };

  const calculateLoyalty = async () => {
    if (!customer?.loyaltyEnabled || !items || items.length === 0) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      const itemsForCalculation = items.map(item => ({
        productId: item.productId || null,
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        discount: item.discount || 0
      }));

      const calculation = await loyaltyService.calculateCartLoyalty(itemsForCalculation, outletId);
      setLoyaltyInfo(calculation);
      
      if (onLoyaltyCalculated) {
        onLoyaltyCalculated(calculation);
      }
    } catch (err) {
      console.error('Error calculating loyalty:', err);
      setError(err.response?.data?.error || 'Failed to calculate loyalty');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyRedemption = async () => {
    if (!pointsToRedeem || pointsToRedeem <= 0) {
      setError('Please enter valid points to redeem');
      return;
    }

    if (!customerLoyalty || customerLoyalty.loyaltyPoints < pointsToRedeem) {
      setError('Insufficient loyalty points');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const itemsForRedemption = items.map(item => ({
        productId: item.productId || null,
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        discount: item.discount || 0
      }));

      // First calculate to get redeem rates
      const calculation = await loyaltyService.calculateCartLoyalty(itemsForRedemption, outletId);
      
      // Merge redeem rates
      const itemsWithRates = itemsForRedemption.map((item, index) => ({
        ...item,
        redeemRate: calculation.items[index]?.redeemRate || 0
      }));

      const result = await loyaltyService.applyRedemption(
        itemsWithRates,
        parseInt(pointsToRedeem),
        outletId
      );

      if (result.success) {
        setRedemptionApplied(result);
        setPointsToRedeem('');
        
        if (onRedemptionApplied) {
          onRedemptionApplied(result);
        }
      } else {
        setError(result.error || 'Failed to apply redemption');
      }
    } catch (err) {
      console.error('Error applying redemption:', err);
      setError(err.response?.data?.error || 'Failed to apply redemption');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRedemption = () => {
    setRedemptionApplied(null);
    setPointsToRedeem('');
    if (onRedemptionApplied) {
      onRedemptionApplied(null);
    }
  };

  // Don't show if no customer selected
  if (!customer) {
    return (
      <Paper elevation={1} sx={{ p: 2, bgcolor: 'grey.100' }}>
        <Box display="flex" alignItems="center" gap={1}>
          <LoyaltyIcon color="disabled" />
          <Typography variant="body2" color="text.secondary">
            Select a customer to view loyalty information
          </Typography>
        </Box>
      </Paper>
    );
  }

  // Don't show if customer loyalty is disabled
  if (!customer.loyaltyEnabled) {
    return (
      <Paper elevation={1} sx={{ p: 2, bgcolor: 'warning.light' }}>
        <Typography variant="body2" color="warning.dark">
          Loyalty is disabled for this customer
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <LoyaltyIcon color="primary" />
        <Typography variant="h6">Loyalty Program</Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Customer Loyalty Info */}
      {customerLoyalty && (
        <Box mb={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="body2" color="text.secondary">
              Available Points
            </Typography>
            <Chip 
              label={customerLoyalty.loyaltyPoints.toLocaleString()} 
              color="primary" 
              size="small"
            />
          </Box>
          {customerLoyalty.redemptionValue > 0 && (
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.secondary">
                Redeemable Value
              </Typography>
              <Typography variant="body2" fontWeight="bold" color="success.main">
                ${customerLoyalty.redemptionValue.toFixed(2)}
              </Typography>
            </Box>
          )}
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Loyalty Calculation */}
      {loading ? (
        <Box display="flex" justifyContent="center" p={2}>
          <CircularProgress size={24} />
        </Box>
      ) : loyaltyInfo ? (
        <Box>
          {loyaltyInfo.eligible ? (
            <>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body2" color="text.secondary">
                  Eligible Amount
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  ${loyaltyInfo.totalEligibleAmount.toFixed(2)}
                </Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="body2" color="text.secondary">
                  Points to Earn
                </Typography>
                <Chip 
                  label={loyaltyInfo.totalPointsEarned.toLocaleString()} 
                  color="success" 
                  size="small"
                />
              </Box>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No items eligible for loyalty points
            </Typography>
          )}

          {/* Redemption Section */}
          {customerLoyalty && customerLoyalty.loyaltyPoints > 0 && loyaltyInfo.eligible && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" gutterBottom>
                Redeem Points
              </Typography>
              
              {redemptionApplied ? (
                <Box>
                  <Alert severity="success" sx={{ mb: 1 }}>
                    Redeemed {redemptionApplied.pointsRedeemed} points (${redemptionApplied.redemptionAmount.toFixed(2)})
                  </Alert>
                  <Button
                    size="small"
                    color="error"
                    onClick={handleRemoveRedemption}
                    startIcon={<RemoveIcon />}
                  >
                    Remove Redemption
                  </Button>
                </Box>
              ) : (
                <Box display="flex" gap={1} alignItems="flex-start">
                  <TextField
                    size="small"
                    type="number"
                    label="Points to Redeem"
                    value={pointsToRedeem}
                    onChange={(e) => setPointsToRedeem(e.target.value)}
                    inputProps={{ min: 0, max: customerLoyalty.loyaltyPoints }}
                    sx={{ flex: 1 }}
                  />
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleApplyRedemption}
                    disabled={!pointsToRedeem || pointsToRedeem <= 0 || loading}
                    startIcon={<AddIcon />}
                  >
                    Apply
                  </Button>
                </Box>
              )}
            </>
          )}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Add items to calculate loyalty points
        </Typography>
      )}
    </Paper>
  );
};

export default LoyaltyDisplay;
