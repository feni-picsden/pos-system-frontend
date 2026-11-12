import React, { useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Typography } from '@mui/material';
import { openCustomerDisplayWindow } from '../../utils/customerDisplayWindow';
import customerDisplayService from '../../services/customerDisplayService';
import customerDisplayTemplateService from '../../services/customerDisplayTemplateService';

// Reference error title when the display cannot launch (no register selected,
// or no template allocated to the register).
const FAILED = 'Failed to open customer display';

const OpenCustomerDisplay = () => {
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);

  const handleOpen = async () => {
    if (opening) return;
    setOpening(true);
    setError('');
    try {
      const raw = localStorage.getItem('selectedRegisterId');
      const registerId = raw ? parseInt(raw, 10) : NaN;
      if (!Number.isFinite(registerId)) {
        setError(`${FAILED}: no register has been selected. Choose a register from the location selector first.`);
        return;
      }

      let config = null;
      try {
        config = await customerDisplayService.getRegisterConfig(registerId);
      } catch (err) {
        if (err?.response?.status === 404) {
          setError(`${FAILED}: the selected register no longer exists. Choose another register.`);
          return;
        }
        // Config may be unreadable (offline / no permission); the display screen
        // itself falls back to the first visible template.
      }

      const templates = await customerDisplayTemplateService.listTemplates();
      const templateId = config?.templateId;
      const hasAssigned = templateId != null && templateId !== '' && templates.some((t) => String(t.id) === String(templateId));
      if (!hasAssigned && templates.length === 0) {
        setError(`${FAILED}: no customer display template has been allocated to this register. Create one under Setup > Customer Display and pick it under Setup > General > Registers > Customer Display.`);
        return;
      }

      const popup = await openCustomerDisplayWindow(registerId, { mode: config?.displayMode });
      if (!popup) {
        setError(`${FAILED}: the popup was blocked. Allow popups and "manage windows on all displays" for this site, then try again.`);
      }
    } finally {
      setOpening(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Card>
        <CardContent>
          <Typography variant="h5" sx={{ mb: 2 }}>Open Customer Display</Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Launch the customer display on your second monitor to show promotions, products, quantity, and totals.
          </Typography>
          {error && (
            <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Button variant="contained" onClick={handleOpen} disabled={opening}>
            {opening ? 'Opening...' : 'Open Customer Display'}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default OpenCustomerDisplay;
