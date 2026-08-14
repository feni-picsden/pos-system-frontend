import React, { useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Typography } from '@mui/material';
import { openCustomerDisplayWindow } from '../../utils/customerDisplayWindow';

const OpenCustomerDisplay = () => {
  const [popupBlocked, setPopupBlocked] = useState(false);

  const handleOpen = async () => {
    const registerId = localStorage.getItem('selectedRegisterId');
    const popup = await openCustomerDisplayWindow(registerId ? Number(registerId) : undefined);
    if (!popup) {
      setPopupBlocked(true);
      return;
    }
    setPopupBlocked(false);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Card>
        <CardContent>
          <Typography variant="h5" sx={{ mb: 2 }}>Open Customer Display</Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Launch the customer display on your second monitor to show promotions, products, quantity, and totals.
          </Typography>
          {popupBlocked && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Popup was blocked. Allow popups and "manage windows on all displays", then try again.
            </Alert>
          )}
          <Button variant="contained" onClick={handleOpen}>Open Customer Display</Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default OpenCustomerDisplay;
