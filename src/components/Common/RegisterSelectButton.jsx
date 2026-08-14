import React from 'react';
import { Box } from '@mui/material';
import { SignpostOutlined as SignpostOutlinedIcon } from '@mui/icons-material';
import { useSelectedRegister } from '../../contexts/SelectedRegisterContext';

// The signpost trigger that opens the Location Selector. The navbar and the sell
// screen render this same button; only the sell screen's measured spacing comes
// in through `sx`.
const RegisterSelectButton = ({ sx }) => {
  const { openLocationSelector, selectedRegister } = useSelectedRegister();
  return (
    <Box
      onClick={() => openLocationSelector({ force: true })}
      role="button"
      aria-label="select register"
      title={selectedRegister ? `Register: ${selectedRegister.name}` : 'Select Register'}
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
  );
};

export default RegisterSelectButton;
