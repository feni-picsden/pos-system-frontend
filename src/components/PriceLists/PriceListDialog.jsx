import React, { useState, useEffect } from 'react';
import {
  Dialog,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import priceListService from '../../services/priceListService';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';

// Shopfront's "Create Price List" prompt asks for a name only, then opens the new
// list's configuration page. Description / discount / markup / active / default are
// edited afterwards on the price list details page (PriceListDetails.jsx).
const PriceListDialog = ({ open, onClose, onSave }) => {
  const { isSuperAdmin } = useAuth();
  const { selectedOutletId } = useSelectedOutlet();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setError('');
    }
  }, [open]);

  const handleSubmit = async () => {
    // The New button stays enabled on an empty input (reference behaviour), so the
    // required-name check lives here rather than in `disabled`.
    if (!name.trim()) {
      setError('Price list name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Non super admins are scoped to their own outlet server-side; super admins
      // create into whichever outlet the global outlet switcher has selected.
      const payload = { name: name.trim() };
      if (isSuperAdmin()) {
        payload.outletId = selectedOutletId;
      }
      const response = await priceListService.createPriceList(payload);
      const priceListId = response.priceList?.id || response.id;
      onSave();
      navigate(`/customers/price-lists/${priceListId}/configuration`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save price list');
      console.error('Error saving price list:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const actionSx = {
    flex: '0 0 120px',
    width: 120,
    minWidth: 120,
    height: 48,
    p: 0,
    borderRadius: 0,
    fontSize: 32,
    lineHeight: 1,
    fontWeight: 400,
    textTransform: 'none',
    boxShadow: 'none',
    transition: 'background 0.2s ease, color 0.2s ease',
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      transitionDuration={200}
      BackdropProps={{
        sx: {
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          transition: 'opacity 200ms ease-in-out !important',
        },
      }}
      PaperProps={{
        sx: {
          width: 287,
          maxWidth: 287,
          m: 0,
          mt: '60px',
          p: '16px',
          borderRadius: 0,
          overflow: 'visible',
          backgroundColor: '#fff',
          boxShadow: '0 0 30px rgba(0,0,0,0.25), 0 15px 30px rgba(0,0,0,0.19)',
        },
      }}
    >
      {/* Circular glyph overhanging the top edge of the dialog */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          top: -60,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 120,
          height: 120,
          borderRadius: '100%',
          backgroundColor: '#1c86f2',
          color: '#f8f8f8',
          fontSize: 72,
          lineHeight: '120px',
          textAlign: 'center',
        }}
      >
        ?
      </Box>

      <Typography component="h3" sx={{ mt: '60px', textAlign: 'center', fontSize: '18.72px', fontWeight: 700 }}>
        Create Price List
      </Typography>
      <Typography component="p" sx={{ my: '16px', textAlign: 'center', fontSize: 16 }}>
        What should the price list be called?
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <TextField
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSubmit();
            }
          }}
          sx={{
            width: 255,
            '& .MuiOutlinedInput-root': { height: 53, borderRadius: 0, fontSize: 16 },
            '& .MuiOutlinedInput-input': { p: '16px' },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '1px' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '1px' },
            '& .Mui-focused .MuiOutlinedInput-notchedOutline, & .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#000',
              borderWidth: '1px',
            },
          }}
        />
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: '16px' }}>
        <Button
          onClick={handleClose}
          disabled={loading}
          sx={{
            ...actionSx,
            backgroundColor: '#f8f8f8',
            color: '#676b72',
            border: '1px solid #676b72',
            '&:hover': { backgroundColor: '#313439', color: '#bdbdbd', boxShadow: 'none' },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading}
          sx={{
            ...actionSx,
            backgroundColor: '#32b643',
            color: '#f8f8f8',
            border: '1px solid #32b643',
            '&:hover': { backgroundColor: '#f8f8f8', color: '#32b643', boxShadow: 'none' },
          }}
        >
          {loading ? <CircularProgress size={24} sx={{ color: 'inherit' }} /> : 'New'}
        </Button>
      </Box>
    </Dialog>
  );
};

export default PriceListDialog;
