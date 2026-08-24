import React, { useState } from 'react';
import { Dialog, Box, Typography, Snackbar, Alert, CircularProgress } from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  PointOfSale as PointOfSaleIcon,
  Place as PlaceIcon,
  Public as PublicIcon,
} from '@mui/icons-material';
import ShopfrontDialog from './ShopfrontDialog';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import { useSelectedRegister } from '../../contexts/SelectedRegisterContext';

// Location Selector option row (registers + "Not using a register") — reference styling.
const locationOptionSx = {
  border: '2px solid #e5e7eb',
  borderRadius: '8px',
  padding: '16px',
  height: 57,
  mb: '16px',
  boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
  display: 'flex',
  alignItems: 'center',
  cursor: 'pointer',
  transition: 'all .15s cubic-bezier(.4,0,.2,1)',
  '&:hover': {
    color: '#475569',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
  },
};

// Mounted ONCE in DashboardLayout so every routed screen gets the same two-step
// outlet -> register picker the sell screen used to own.
const LocationSelectorDialog = () => {
  const { user } = useAuth();
  const { outlets, setSelectedOutletId: setSelectedOutlet, isSuperAdmin } = useSelectedOutlet();
  const {
    showLocationSelector,
    setShowLocationSelector,
    locationStep,
    setLocationStep,
    availableRegisters,
    refreshRegisters,
    selectRegister,
    clearSelectedRegister,
    getOutletName,
    getEffectiveOutletId,
    showRegisterInUseDialog,
    takeControl,
    chooseAnotherLocation,
    registerError,
    setRegisterError,
  } = useSelectedRegister();

  // Picking an outlet or a register is a round trip (switch-outlet + catalog
  // wipe, or /lock) that used to run with no feedback: the dialog just sat
  // there for ~2s and every further click queued another request. One key
  // ('outlet-3' / 'register-5') marks the row that is working; while it is set
  // the whole list is inert and the pending row shows a spinner.
  const [busyKey, setBusyKey] = useState(null);
  // A failed outlet switch used to be swallowed - the dialog advanced to the
  // register step under the OLD outlet with no feedback.
  const [outletError, setOutletError] = useState('');
  const runBusy = async (key, fn) => {
    if (busyKey) return;
    setBusyKey(key);
    try {
      await fn();
    } finally {
      setBusyKey(null);
    }
  };
  // Rows other than the pending one grey out; the pending one keeps its colour.
  const rowSx = (key) =>
    !busyKey
      ? locationOptionSx
      : {
          ...locationOptionSx,
          cursor: 'default',
          pointerEvents: 'none',
          opacity: busyKey === key ? 1 : 0.5,
          '&:hover': {},
        };

  return (
    <>
      {/* Reference "Register in Use" dialog, over the Location Selector. */}
      <ShopfrontDialog
        open={showRegisterInUseDialog}
        zIndex={1400}
        dim={false}
        icon={<Box component="span" sx={{ fontWeight: 300 }}>?</Box>}
        title="Register in Use"
        message="This register is currently in use, would you like to take control of this register?"
        actions={[
          {
            label: 'Cancel',
            variant: 'secondary',
            onClick: chooseAnotherLocation,
            disabled: busyKey === 'take-control',
          },
          {
            label: 'Yes',
            onClick: () => runBusy('take-control', takeControl),
            busy: busyKey === 'take-control',
          },
        ]}
      />

      {/* STATE 2 - Location Selector */}
      <Dialog
        open={showLocationSelector}
        onClose={() => { if (!busyKey) setShowLocationSelector(false); }}
        maxWidth={false}
        slotProps={{ backdrop: { sx: { backgroundColor: '#fff' } } }}
        PaperProps={{
          sx: {
            width: 'fit-content',
            maxWidth: 'none',
            m: '32px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            padding: '48px 32px 32px',
          },
        }}
      >
        {locationStep === 'register' && (
          <Box
            onClick={() => { if (!busyKey) setLocationStep('outlet'); }}
            sx={{
              position: 'absolute',
              top: 12,
              left: 16,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: '#6b7280',
              fontSize: 14,
              cursor: busyKey ? 'default' : 'pointer',
              opacity: busyKey ? 0.5 : 1,
              pointerEvents: busyKey ? 'none' : 'auto',
            }}
          >
            <ArrowBackIcon sx={{ fontSize: 14 }} /> Back to outlet select
          </Box>
        )}
        <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#000' }}>
          Location Selector
        </Typography>
        <Typography sx={{ fontSize: 16, fontWeight: 400, mb: '16px' }}>
          Please select which location best describes where your device is located.
        </Typography>

        {/* Step 1: outlet */}
        {locationStep === 'outlet' && (
          <>
            <Typography sx={{ fontSize: 16, fontWeight: 400, mb: '8px' }}>
              Which outlet are you currently in?
            </Typography>
            {outlets.map((outlet, i) => {
              const isCurrent = Number(getEffectiveOutletId()) === Number(outlet.id);
              // Last row carries no bottom margin when the global-mode row below
              // is hidden, so the paper keeps its measured 32px bottom padding.
              const isLast = !isSuperAdmin && i === outlets.length - 1;
              return (
                <Box
                  key={outlet.id}
                  onClick={() =>
                    runBusy(`outlet-${outlet.id}`, async () => {
                      try {
                        // Context persists the id, clears the cached catalog and drops
                        // a register that belongs to the outlet we just left.
                        await setSelectedOutlet(outlet.id);
                      } catch (err) {
                        setOutletError(err?.response?.data?.error || 'Could not switch outlet. Please try again.');
                        return; // stay on the outlet step; do NOT advance
                      }
                      // The dialog now outlives the outlet switch (it is mounted in
                      // the layout, not the page), so the register list has to be
                      // refetched for the outlet we just moved to. Awaited: the
                      // register step must not render an empty/stale list.
                      await refreshRegisters();
                      setLocationStep('register');
                    })
                  }
                  sx={isLast ? { ...rowSx(`outlet-${outlet.id}`), mb: 0 } : rowSx(`outlet-${outlet.id}`)}
                >
                  <PlaceIcon sx={{ fontSize: 20, mr: '8px' }} />
                  <Box>
                    <Typography component="span" sx={{ fontSize: 16, fontWeight: 400 }}>
                      {outlet.name}
                    </Typography>
                    {isCurrent && (
                      <Typography sx={{ fontSize: 14, color: '#3b9fe0' }}>
                        (Previously Selected)
                      </Typography>
                    )}
                  </Box>
                  {busyKey === `outlet-${outlet.id}` && (
                    <CircularProgress size={18} sx={{ ml: 'auto', color: '#3b9fe0' }} />
                  )}
                </Box>
              );
            })}
            {/* Global mode is a superadmin-only state (the old navbar menu gated
                "All Outlets" the same way): everyone else has a server-side
                outlet session that cannot be switched to "none". */}
            {isSuperAdmin && (
              <Box
                onClick={() =>
                  runBusy('outlet-global', async () => {
                    try {
                      await setSelectedOutlet(null);
                    } catch (err) {
                      setOutletError(err?.response?.data?.error || 'Could not switch outlet. Please try again.');
                      return;
                    }
                    await refreshRegisters();
                    setLocationStep('register');
                  })
                }
                sx={{ ...rowSx('outlet-global'), mb: 0 }}
              >
                <PublicIcon sx={{ fontSize: 20, mr: '8px' }} />
                <Box>
                  <Typography component="span" sx={{ fontSize: 16, fontWeight: 400 }}>
                    Not at an Outlet
                  </Typography>
                  <Typography sx={{ fontSize: 14, color: '#64748b' }}>(Global Mode)</Typography>
                </Box>
                {busyKey === 'outlet-global' && (
                  <CircularProgress size={18} sx={{ ml: 'auto', color: '#3b9fe0' }} />
                )}
              </Box>
            )}
          </>
        )}

        {/* Step 2: register */}
        {locationStep === 'register' && (
        <>
        <Typography sx={{ fontSize: 16, fontWeight: 400, mb: '8px' }}>
          Which register are you currently using at {getOutletName()}?
        </Typography>
        {availableRegisters.map((register) => {
          // Check if register is in use by current user
          const isInUseByCurrentUser = register.currentUser &&
            register.currentUser.id &&
            user &&
            register.currentUser.id === user.id;

          // Check if register is in use by another user
          const isInUseByOtherUser = register.currentUser && !isInUseByCurrentUser;

          return (
            <Box
              key={register.id}
              onClick={() => runBusy(`register-${register.id}`, () => selectRegister(register))}
              sx={rowSx(`register-${register.id}`)}
            >
              <PointOfSaleIcon sx={{ fontSize: 20, mr: '8px' }} />
              <Box>
                <Typography component="span" sx={{ fontSize: 16, fontWeight: 400 }}>
                  {register.name}
                </Typography>
                {isInUseByCurrentUser && (
                  <Typography sx={{ fontSize: 14, color: '#3b9fe0' }}>
                    (Previously Selected)
                  </Typography>
                )}
                {isInUseByOtherUser && (
                  <Typography component="span" sx={{ fontSize: 14, color: '#64748b', ml: '6px' }}>
                    (In use by {register.currentUser.name} - Click to take control)
                  </Typography>
                )}
              </Box>
              {busyKey === `register-${register.id}` && (
                <CircularProgress size={18} sx={{ ml: 'auto', color: '#3b9fe0' }} />
              )}
            </Box>
          );
        })}
        <Box
          onClick={() => {
            if (busyKey) return;
            clearSelectedRegister();
            setShowLocationSelector(false);
          }}
          sx={{ ...rowSx('none'), mb: 0 }}
        >
          <PlaceIcon sx={{ fontSize: 20, mr: '8px' }} />
          <Typography component="span" sx={{ fontSize: 16, fontWeight: 400 }}>
            Not using a register
          </Typography>
        </Box>
        </>
        )}
      </Dialog>

      {/* Register open/close failures */}
      <Snackbar
        open={!!registerError}
        autoHideDuration={6000}
        onClose={() => setRegisterError('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ zIndex: 2000 }}
      >
        <Alert severity="error" variant="filled" onClose={() => setRegisterError('')}>
          {registerError}
        </Alert>
      </Snackbar>

      {/* Outlet switch failures */}
      <Snackbar
        open={!!outletError}
        autoHideDuration={6000}
        onClose={() => setOutletError('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ zIndex: 2000 }}
      >
        <Alert severity="error" variant="filled" onClose={() => setOutletError('')}>
          {outletError}
        </Alert>
      </Snackbar>
    </>
  );
};

export default LocationSelectorDialog;
