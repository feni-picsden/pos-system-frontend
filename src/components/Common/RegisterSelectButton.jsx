import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { SignpostOutlined as SignpostOutlinedIcon } from '@mui/icons-material';
import { useSelectedRegister } from '../../contexts/SelectedRegisterContext';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import { useAuth } from '../../contexts/AuthContext';

// The signpost trigger that opens the Location Selector. The navbar and the sell
// screen render this same button; only the sell screen's measured spacing comes
// in through `sx`.
//
// Hovering names where you are standing, the way the reference does: the outlet in
// small grey type above the register in large dark type, on a white card. A plain
// `title` attribute could not carry those two lines, and the browser's own tooltip
// arrives late and styled like nothing else in the app.
const RegisterSelectButton = ({ sx }) => {
  const { openLocationSelector, selectedRegister } = useSelectedRegister();
  const { selectedOutlet } = useSelectedOutlet();
  const { getOutletName } = useAuth();

  // A global admin's outlet comes from the navbar selector; everyone else's from
  // the account they signed in with.
  const outletName = selectedOutlet?.name || getOutletName() || null;
  const registerName = selectedRegister?.name || 'Select Register';

  const label = (
    <Box sx={{ textAlign: 'center', px: 1, py: 0.5 }}>
      {outletName && (
        <Typography sx={{ fontSize: 13, color: '#8a9099', lineHeight: '18px' }}>
          {outletName}
        </Typography>
      )}
      <Typography sx={{ fontSize: 20, color: '#313439', lineHeight: '28px' }}>
        {registerName}
      </Typography>
    </Box>
  );

  return (
    <Tooltip
      title={label}
      placement="bottom"
      enterDelay={200}
      slotProps={{
        tooltip: {
          sx: {
            bgcolor: '#f8f8f8',
            color: '#313439',
            borderRadius: 0,
            p: 0,
            boxShadow: 'rgba(0,0,0,0.2) 0 0 4px, rgba(0,0,0,0.15) 0 2px 4px',
            maxWidth: 'none',
          },
        },
      }}
    >
      <Box
        onClick={() => openLocationSelector({ force: true })}
        role="button"
        aria-label={outletName ? `${registerName}, ${outletName}` : 'select register'}
        sx={{
          width: 50,
          height: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#f8f8f8',
          ...sx,
        }}
      >
        <SignpostOutlinedIcon sx={{ fontSize: 24 }} />
      </Box>
    </Tooltip>
  );
};

export default RegisterSelectButton;
