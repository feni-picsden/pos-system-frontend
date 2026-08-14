import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  CheckBoxOutlineBlankOutlined as SquareIcon,
  CheckBoxOutlined as SquareCheckedIcon,
} from '@mui/icons-material';
import { INSTANT } from './ticketChrome';

/** 16px square glyph checkbox (the reference uses fal fa-square, not a native input). */
export const SquareCheckButton = ({ checked, onClick, light, label }) => (
  <Box
    component="button"
    type="button"
    aria-label={label}
    aria-pressed={checked}
    onClick={onClick}
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      width: 24,
      height: 24,
      p: 0,
      border: 0,
      bgcolor: 'transparent',
      cursor: 'pointer',
      color: light ? '#f8f8f8' : '#000',
      transition: INSTANT,
    }}
  >
    {checked ? <SquareCheckedIcon sx={{ fontSize: 16 }} /> : <SquareIcon sx={{ fontSize: 16 }} />}
  </Box>
);

/** The reference counter always reads '{n} Tickets Selected', in black on the blue bar. */
export const TicketCounter = ({ count }) => (
  <Typography sx={{ fontSize: 16, fontWeight: 400, color: '#000' }}>{count} Tickets Selected</Typography>
);
