import React from 'react';
import {
  Dialog,
  DialogContent,
  IconButton,
  Box,
} from '@mui/material';
import {
  Close as CloseIcon,
} from '@mui/icons-material';
import CustomerDetails from '../../pages/Customers/CustomerDetails';
import { byMode } from '../../theme/sfPalette';

const CustomerDetailsModal = ({ open, onClose, wizardData, onCustomerSaved }) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: {
          height: '90vh',
          maxHeight: '90vh',
          borderRadius: 2,
        }
      }}
    >
      <Box sx={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            zIndex: 1000,
            bgcolor: byMode('rgba(255, 255, 255, 0.9)', 'rgba(35, 35, 35, 0.9)'),
            '&:hover': {
              bgcolor: byMode('rgba(255, 255, 255, 1)', 'rgba(35, 35, 35, 1)'),
            }
          }}
        >
          <CloseIcon />
        </IconButton>
        
        <DialogContent sx={{ 
          p: 0, 
          height: '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <Box sx={{ 
            height: '100%',
            overflow: 'auto',
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: byMode('#f1f1f1', '#232323'),
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#888',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: '#555',
            },
          }}>
            <CustomerDetails
              isModal={true}
              modalWizardData={wizardData}
              onClose={onClose}
              onSave={onCustomerSaved}
            />
          </Box>
        </DialogContent>
      </Box>
    </Dialog>
  );
};

export default CustomerDetailsModal;

