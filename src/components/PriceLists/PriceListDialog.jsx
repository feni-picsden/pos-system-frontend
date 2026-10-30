import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
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

// Shopfront's "Create New Price List" prompt (reference): light-blue title bar
// with a "?" icon, one question + one text box, grey Cancel / blue Create. The
// new list then opens on its edit page. Description / discount / markup are not
// asked here.
const PriceListDialog = ({ open, onClose, onSave }) => {
  const { isTrueSuperAdmin } = useAuth();
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
    // The Create button stays enabled on an empty input (reference behaviour), so
    // the required-name check lives here rather than in `disabled`.
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
      if (isTrueSuperAdmin()) {
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

  // Reference dialog buttons ("Receive transfer"): grey Cancel, blue action,
  // 4px corners, bold white text.
  const buttonSx = {
    textTransform: 'none',
    borderRadius: '4px',
    fontWeight: 700,
    fontSize: 16,
    px: 3,
    height: 40,
    minWidth: 96,
    boxShadow: 'none',
    transition: 'background 0.2s ease, color 0.2s ease',
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      transitionDuration={200}
      BackdropProps={{ sx: { backgroundColor: 'rgba(0, 0, 0, 0.7)' } }}
      PaperProps={{
        elevation: 0,
        sx: {
          width: 300,
          maxWidth: '92vw',
          overflow: 'hidden',
          bgcolor: '#fff',
          borderRadius: '12px',
          boxShadow: '0 0 30px 0 rgba(0,0,0,.25), 0 15px 30px 0 rgba(0,0,0,.19)',
        },
      }}
    >
      {/* Light-blue title bar with the "?" glyph (reference) */}
      <Box sx={{ bgcolor: '#bfe6fb', px: 2, py: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography component="span" aria-hidden sx={{ color: '#1c6fa8', fontWeight: 700, fontSize: 22, lineHeight: 1 }}>?</Typography>
        <Typography component="h3" sx={{ color: '#1c6fa8', fontWeight: 700, fontSize: 18, m: 0 }}>
          Create New Price List
        </Typography>
      </Box>

      <DialogContent sx={{ px: 2, pt: 3, pb: 1 }}>
        <Typography component="p" sx={{ m: '0 0 12px', fontSize: 16, color: '#000' }}>
          What should the price list be called?
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          autoFocus
          fullWidth
          value={name}
          inputProps={{ 'aria-label': 'Price list name' }}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSubmit();
            }
          }}
          sx={{
            '& .MuiOutlinedInput-root': { height: 42, borderRadius: '8px', fontSize: 16, bgcolor: '#fff' },
            '& .MuiOutlinedInput-input': { p: '8px 16px' },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '1px' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '1px' },
            '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
          }}
        />
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2, pt: 1.5, gap: 1.5, justifyContent: 'space-between' }}>
        <Button
          onClick={handleClose}
          disabled={loading}
          disableElevation
          sx={{ ...buttonSx, flex: 1, borderRadius: '8px', bgcolor: '#d5d5d5', color: '#000', '&:hover': { bgcolor: '#c4c4c4' } }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading}
          disableElevation
          sx={{ ...buttonSx, flex: 1, borderRadius: '8px', bgcolor: '#1c9cf0', color: '#fff', '&:hover': { bgcolor: '#1686d1' }, '&.Mui-disabled': { bgcolor: '#8fcdf7', color: '#fff' } }}
        >
          {loading ? <CircularProgress size={20} sx={{ color: 'inherit' }} /> : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PriceListDialog;
