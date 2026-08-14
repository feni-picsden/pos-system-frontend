import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  NICE_ERROR_SX,
  NICE_ERROR_ICON_SX,
  NICE_ERROR_REASON_SX,
  NICE_ERROR_HEADING_SX,
  NICE_ERROR_BODY_SX,
} from '../StockManagement/productViewStyles';

// Reference ".nice-error": a 160px glyph beside a 24px/700 heading and a 16px
// body, the pair centred in the content area. Same component the reference uses
// for "Register not open", "No results found", etc.
const NiceError = ({ icon, heading, body }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 'calc(100vh - 50px)',
      bgcolor: '#fff',
    }}
  >
    <Box sx={NICE_ERROR_SX}>
      <Box sx={NICE_ERROR_ICON_SX}>{icon}</Box>
      <Box sx={NICE_ERROR_REASON_SX}>
        <Typography component="h2" sx={NICE_ERROR_HEADING_SX}>
          {heading}
        </Typography>
        <Typography component="p" sx={NICE_ERROR_BODY_SX}>
          {body}
        </Typography>
      </Box>
    </Box>
  </Box>
);

export default NiceError;
