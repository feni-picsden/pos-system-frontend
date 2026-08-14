import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  LocationOff as LocationOffIcon,
  LocationOn as LocationOnIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import outletService from '../../services/outletService';

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in meters
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const GeofenceValidator = ({ onValidationComplete }) => {
  const { getOutletId, user, isSuperAdmin } = useAuth();
  const [isChecking, setIsChecking] = useState(true);
  const [isOutOfRange, setIsOutOfRange] = useState(false);
  const [error, setError] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [outletLocation, setOutletLocation] = useState(null);
  const [distance, setDistance] = useState(null);
  const [allowedRadius, setAllowedRadius] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [currentOutletId, setCurrentOutletId] = useState(null);

  // Watch for outlet changes and re-validate
  useEffect(() => {
    // Skip geofencing validation for superadmin users
    if (isSuperAdmin()) {
      console.log('Superadmin user detected, skipping geofencing validation');
      setIsChecking(false);
      if (onValidationComplete) {
        onValidationComplete(true);
      }
      return;
    }

    const outletId = getOutletId();
    
    // If outlet changed, reset state and re-validate
    if (outletId !== currentOutletId) {
      console.log('Outlet changed, re-validating geofence:', {
        previousOutletId: currentOutletId,
        newOutletId: outletId
      });
      setCurrentOutletId(outletId);
      setIsChecking(true);
      setIsOutOfRange(false);
      setError(null);
      setUserLocation(null);
      setOutletLocation(null);
      setDistance(null);
      setAllowedRadius(null);
      setShowDialog(false);
      validateLocation();
    } else if (currentOutletId === null && outletId) {
      // Initial validation
      setCurrentOutletId(outletId);
      validateLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.outletId, isSuperAdmin]);

  const validateLocation = async () => {
    try {
      setIsChecking(true);
      setError(null);

      // Skip geofencing validation for superadmin users
      if (isSuperAdmin()) {
        console.log('Superadmin user detected, skipping geofencing validation');
        setIsChecking(false);
        if (onValidationComplete) {
          onValidationComplete(true);
        }
        return;
      }

      // Get outlet ID
      const outletId = getOutletId();
      if (!outletId) {
        // No outlet assigned, skip validation
        setIsChecking(false);
        if (onValidationComplete) {
          onValidationComplete(true);
        }
        return;
      }

      // Fetch outlet location data using dedicated endpoint (no super admin required)
      let outlet;
      try {
        const response = await outletService.getMyOutletLocation();
        outlet = response.outlet;
        
        // Verify the outlet ID matches
        if (!outlet || outlet.id !== outletId) {
          console.warn('Outlet ID mismatch or no outlet returned');
          // If we can't get outlet, skip validation
          setIsChecking(false);
          if (onValidationComplete) {
            onValidationComplete(true);
          }
          return;
        }
      } catch (err) {
        console.error('Error fetching outlet location:', err);
        // If we can't fetch outlet or outlet has no location data, skip validation
        setIsChecking(false);
        if (onValidationComplete) {
          onValidationComplete(true);
        }
        return;
      }

      // Check if outlet has location data
      if (
        !outlet.outletLatitude ||
        !outlet.outletLongitude ||
        !outlet.allowedRadius
      ) {
        // Outlet doesn't have geofencing configured, skip validation
        setIsChecking(false);
        if (onValidationComplete) {
          onValidationComplete(true);
        }
        return;
      }

      setOutletLocation({
        lat: outlet.outletLatitude,
        lng: outlet.outletLongitude,
      });
      setAllowedRadius(outlet.allowedRadius);

      // Get user's current location
      if (!navigator.geolocation) {
        throw { message: 'Geolocation is not supported by your browser', code: null };
      }

      // Check if we're on HTTPS (required for geolocation in most browsers)
      if (window.location.protocol !== 'https:' && window.location.hostname !== '192.168.29.13' && window.location.hostname !== '127.0.0.1') {
        console.warn('Geolocation may not work on non-HTTPS connections');
      }


      const position = await new Promise((resolve, reject) => {
        console.log('Getting current position' , navigator.geolocation);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            console.log('Geolocation success:', pos.coords);
            resolve(pos);
          },
          (err) => {
            console.error('Geolocation error details:', {
              code: err.code,
              message: err.message,
              PERMISSION_DENIED: err.code === 1,
              POSITION_UNAVAILABLE: err.code === 2,
              TIMEOUT: err.code === 3
            });
            reject(err);
          },
          {
            enableHighAccuracy: false,
            timeout: 15000, 
            maximumAge: 60000, 
          }
        );
      });

      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;
      console.log('User location obtained:', userLat, userLng);
      setUserLocation({ lat: userLat, lng: userLng });

      const calculatedDistance = calculateDistance(
        userLat,
        userLng,
        outlet.outletLatitude,
        outlet.outletLongitude
      );
      setDistance(calculatedDistance);

      // Check if user is within allowed radius
      if (calculatedDistance > outlet.allowedRadius) {
        setIsOutOfRange(true);
        setShowDialog(true);
      } else {
        setIsOutOfRange(false);
        if (onValidationComplete) {
          onValidationComplete(true);
        }
      }
    } catch (err) {
      console.error('Geofencing validation error:', err);
      console.error('Error details:', {
        code: err?.code,
        message: err?.message,
        name: err?.name,
        fullError: err
      });
      
      // Check if this is a geolocation error (has code property)
      if (err && typeof err.code === 'number') {
        // Handle geolocation API errors
        if (err.code === 1) {
          // PERMISSION_DENIED
          setError('Location permission denied. Please click the location icon in your browser\'s address bar and allow location access, then click Retry.');
          setShowDialog(true);
        } else if (err.code === 2) {
          // POSITION_UNAVAILABLE
          setError('Unable to determine your location. Please check your device settings.');
          setShowDialog(true);
        } else if (err.code === 3) {
          // TIMEOUT
          setError('Location request timed out. Please try again.');
          setShowDialog(true);
        } else {
          // Unknown geolocation error
          setError(`Location error: ${err.message || 'Unknown error occurred'}`);
          setShowDialog(true);
        }
      } else if (err?.response?.status === 403 || err?.response?.status === 401) {
        // API permission error - skip validation
        console.warn('API permission error, skipping geofencing validation');
        setError(null);
        setIsChecking(false);
        if (onValidationComplete) {
          onValidationComplete(true);
        }
      } else {
        // Other errors (network, API errors without code, etc.) - allow access but log the error
        console.warn('Geofencing validation failed, allowing access:', err?.message || err);
        setError(null);
        setIsChecking(false);
        if (onValidationComplete) {
          onValidationComplete(true);
        }
      }
    } finally {
      setIsChecking(false);
    }
  };

  const handleRetry = () => {
    setShowDialog(false);
    setIsChecking(true);
    validateLocation();
  };

  const handleContinue = () => {
    // Allow user to continue despite being out of range or location errors
    setShowDialog(false);
    setIsChecking(false);
    if (onValidationComplete) {
      onValidationComplete(true);
    }
  };

  const handleSkip = () => {
    // Skip geofencing validation entirely
    setShowDialog(false);
    setIsChecking(false);
    if (onValidationComplete) {
      onValidationComplete(true);
    }
  };

  // Skip geofencing validation for superadmin users - return null immediately
  if (isSuperAdmin()) {
    return null;
  }

  // Show loading state
  if (isChecking) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: '#f5f5f5',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}
      >
        <CircularProgress size={48} sx={{ mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          Validating Location
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Please allow location access to continue
        </Typography>
      </Box>
    );
  }

  // Show blocking UI when out of range or error (similar to register selection)
  if (isOutOfRange || error) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: '#f5f5f5',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          p: 3,
        }}
      >
        <Box
          sx={{
            bgcolor: 'white',
            borderRadius: 2,
            p: 4,
            maxWidth: 500,
            width: '100%',
            boxShadow: 3,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            {isOutOfRange ? (
              <LocationOffIcon color="error" sx={{ fontSize: 48 }} />
            ) : (
              <LocationOnIcon color="warning" sx={{ fontSize: 48 }} />
            )}
            <Typography variant="h5" fontWeight="bold">
              {isOutOfRange ? 'Location Out of Range' : 'Location Access Required'}
            </Typography>
          </Box>

          {error ? (
            <>
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                <strong>How to enable location access:</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary" component="div" sx={{ mb: 3, pl: 2 }}>
                <ul style={{ margin: 0, paddingLeft: '16px' }}>
                  <li>Look for the location icon (📍) in your browser's address bar</li>
                  <li>Click it and select "Allow" or "Always allow"</li>
                  <li>Then click "Retry" below</li>
                  <li>Or click "Skip" to bypass geofencing validation</li>
                </ul>
              </Typography>
            </>
          ) : isOutOfRange ? (
            <>
              <Alert severity="error" sx={{ mb: 3 }}>
                You are outside the allowed area for this outlet.
              </Alert>
              {userLocation && outletLocation && distance !== null && (
                <Box sx={{ mb: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Your Location:</strong> {userLocation.lat.toFixed(6)},{' '}
                    {userLocation.lng.toFixed(6)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Outlet Location:</strong> {outletLocation.lat.toFixed(6)},{' '}
                    {outletLocation.lng.toFixed(6)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Distance:</strong> {distance.toFixed(0)} meters
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Allowed Radius:</strong> {allowedRadius} meters
                  </Typography>
                </Box>
              )}
              <Typography variant="body1" sx={{ mb: 3 }}>
                Please move within the allowed area to access the POS system.
              </Typography>
            </>
          ) : null}

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            {isOutOfRange ? (
              <Button onClick={handleRetry} variant="contained" color="primary" size="large">
                Retry
              </Button>
            ) : error ? (
              <>
                <Button onClick={handleRetry} variant="contained" color="primary" size="large">
                  Retry
                </Button>
                <Button onClick={handleSkip} variant="outlined" color="secondary" size="large">
                  Skip
                </Button>
              </>
            ) : (
              <Button onClick={handleRetry} variant="contained" color="primary" size="large">
                Retry
              </Button>
            )}
          </Box>
        </Box>
      </Box>
    );
  }

  // Validation passed or no validation needed
  return null;
};

export default GeofenceValidator;
