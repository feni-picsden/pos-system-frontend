import React from 'react';
import { Box } from '@mui/material';
import KeyboardOutlinedIcon from '@mui/icons-material/KeyboardOutlined';
import LocalParkingOutlinedIcon from '@mui/icons-material/LocalParkingOutlined';

// POS navigation shown as a preview in the designer, without leaving the editor.
export default function SaleKeyPreviewTabs() {
  return (
    <Box aria-label="POS navigation preview" sx={{ display: 'flex', height: 50, flexShrink: 0, bgcolor: '#f8f8f8' }}>
      {[
        { label: 'Sales Keys', icon: <KeyboardOutlinedIcon /> },
        { label: 'Parked Sales', icon: <LocalParkingOutlinedIcon /> },
        { label: 'Shop MyLocal / IBA E-Commerce' },
      ].map(({ label, icon }) => (
        <Box key={label} sx={{
          flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 1, px: 1, fontSize: 16, color: '#000',
          borderBottom: '3px solid transparent',
          boxSizing: 'border-box', whiteSpace: 'nowrap',
        }}>
          {icon}{label}
        </Box>
      ))}
    </Box>
  );
}
