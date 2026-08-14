import React from 'react';
import { styled } from '@mui/material/styles';
import Switch from '@mui/material/Switch';

/**
 * Flat pill toggle that matches the Shopfront reference design:
 *  - OFF track  #a1a1a1  (hover #737373)
 *  - ON  track  #5ebbeb  (hover #4aa9dd)
 *  - white thumb with a subtle shadow, no Material ripple halo
 * Drop-in replacement for MUI <Switch/> (same props/API).
 */
const ShopfrontSwitch = styled((props) => <Switch disableRipple {...props} />)(() => ({
  width: 48,
  height: 24,
  padding: 0,
  '& .MuiSwitch-switchBase': {
    padding: 0,
    // Measured on the reference: 19px thumb, inset 2px, travelling 24px in a 48x24 track.
    margin: '2px',
    transitionDuration: '150ms',
    '&.Mui-checked': {
      transform: 'translateX(24px)',
      color: '#fff',
      '& + .MuiSwitch-track': { backgroundColor: '#5ebbeb', opacity: 1, border: 0 },
    },
    '&:hover, &.Mui-checked:hover': { backgroundColor: 'transparent' },
  },
  '& .MuiSwitch-thumb': {
    boxSizing: 'border-box',
    width: 19,
    height: 19,
    backgroundColor: '#fff',
    boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)',
  },
  '& .Mui-disabled .MuiSwitch-thumb': {
    backgroundColor: '#ebebeb',
  },
  '& .MuiSwitch-track': {
    borderRadius: '12px',
    backgroundColor: '#a1a1a1',
    opacity: 1,
    transition: 'background-color 150ms',
  },
  '&:hover .MuiSwitch-switchBase:not(.Mui-checked) + .MuiSwitch-track': {
    backgroundColor: '#737373',
  },
  '&:hover .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
    backgroundColor: '#4aa9dd',
  },
}));

export default ShopfrontSwitch;
