import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  Box,
  Typography,
  Popper,
  ClickAwayListener,
} from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';

// Reference has no transitions anywhere.
const INSTANT = 'all 0s ease';

// Exact reference grouping/order (Shopfront help: Standard / Integrations / External).
// 'Linkly Value Added Applications' is hidden until VAA routing codes are
// implemented — selecting it today would silently run plain '00' EFTPOS
// transactions (the misconfiguration trap Shopfront's help warns about).
const TYPE_GROUPS = [
  { label: 'Standard', options: ['Cash', 'Cheque', 'Direct Deposit', 'EFTPOS', 'Gift Card', 'Voucher'] },
  { label: 'Integrations', options: ['Linkly', 'Tyro'] },
  { label: 'External', options: ['Custom'] },
];

/**
 * Searchable single-select combobox matching the reference Type dropdown:
 * type-to-filter, bold black group headers, selected option in sky-blue text.
 */
export const TypeCombobox = ({ value, onChange, disabled, borderColor = '#595959' }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const anchorRef = useRef(null);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TYPE_GROUPS.map((g) => ({
      ...g,
      options: q ? g.options.filter((o) => o.toLowerCase().includes(q)) : g.options,
    })).filter((g) => g.options.length > 0);
  }, [query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <ClickAwayListener onClickAway={close}>
      <Box>
        <Box
          ref={anchorRef}
          component="input"
          type="text"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          value={open ? query : value || ''}
          placeholder={open ? value || 'Select...' : 'Select...'}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          sx={{
            width: '100%',
            height: 42,
            border: `1px solid ${borderColor}`,
            borderRadius: '8px',
            px: 1.5,
            bgcolor: '#fff',
            fontFamily: 'inherit',
            fontSize: 16,
            color: '#000',
            outline: 'none',
            boxSizing: 'border-box',
            '&::placeholder': { color: '#808080', opacity: 1 },
          }}
        />
        <Popper
          open={open}
          anchorEl={anchorRef.current}
          placement="bottom-start"
          modifiers={[{ name: 'offset', options: { offset: [0, 6] } }]}
          style={{ zIndex: 1400 }}
        >
          <Box
            sx={{
              width: anchorRef.current ? anchorRef.current.offsetWidth : 'auto',
              bgcolor: '#fff',
              border: '1px solid #d4d4d4',
              borderRadius: '8px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
              maxHeight: 300,
              overflow: 'auto',
              py: 0.5,
              transition: INSTANT,
            }}
          >
            {filteredGroups.length === 0 ? (
              <Box sx={{ px: 2, py: 1.5, fontSize: 16, color: '#0a0a0a' }}>No Options</Box>
            ) : (
              filteredGroups.map((group) => (
                <Box key={group.label}>
                  <Box sx={{ px: 2, py: 1, fontSize: 16, fontWeight: 700, color: '#000' }}>{group.label}</Box>
                  {group.options.map((option) => (
                    <Box
                      key={option}
                      component="button"
                      type="button"
                      onClick={() => {
                        onChange(option);
                        close();
                      }}
                      sx={{
                        display: 'block',
                        width: '100%',
                        px: 3,
                        py: 1,
                        border: 0,
                        bgcolor: 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'inherit',
                        fontSize: 16,
                        color: option === value ? '#38a8e8' : '#000',
                        transition: INSTANT,
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
                      }}
                    >
                      {option}
                    </Box>
                  ))}
                </Box>
              ))
            )}
          </Box>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};

const PaymentMethodDialog = ({ open, onClose, paymentMethod, onSave, loading }) => {
  const [formData, setFormData] = useState({ name: '', type: 'Cash' });
  const [error, setError] = useState('');

  useEffect(() => {
    setFormData({
      name: paymentMethod?.name || '',
      type: paymentMethod?.type || 'Cash',
    });
    setError('');
  }, [paymentMethod, open]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Payment method name is required');
      return;
    }
    if (!formData.type) {
      setError('Payment method type is required');
      return;
    }

    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save payment method');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { borderRadius: '8px', width: 512, maxWidth: '92vw', overflow: 'visible' } }}
    >
      {/* Light-green header, no close X — close = Cancel / Escape */}
      <Box
        sx={{
          bgcolor: '#dcfce7',
          px: 3,
          py: 1.75,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px',
        }}
      >
        <CheckIcon sx={{ color: '#166534', fontSize: 20 }} />
        <Typography sx={{ color: '#166534', fontSize: 18, fontWeight: 400 }}>
          {paymentMethod ? 'Edit Payment Method' : 'Create Payment Method'}
        </Typography>
      </Box>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ px: 3, py: 2.5, overflow: 'visible' }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Typography sx={{ fontSize: 16, color: '#000', mb: 0.5 }}>Name</Typography>
          <Box
            component="input"
            type="text"
            value={formData.name}
            disabled={loading}
            onChange={(e) => handleInputChange('name', e.target.value)}
            sx={{
              width: '100%',
              height: 42,
              border: '1px solid #595959',
              borderRadius: '8px',
              px: 1.5,
              mb: 2.5,
              bgcolor: '#fff',
              fontFamily: 'inherit',
              fontSize: 16,
              color: '#000',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          <Typography sx={{ fontSize: 16, color: '#000', mb: 0.5 }}>Type</Typography>
          <TypeCombobox
            value={formData.type}
            disabled={loading}
            onChange={(type) => handleInputChange('type', type)}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, pt: 0, gap: 1.25 }}>
          <Button
            onClick={onClose}
            disabled={loading}
            disableRipple
            disableElevation
            sx={{
              bgcolor: '#d4d4d4',
              color: '#000',
              textTransform: 'none',
              borderRadius: '12px',
              height: 42,
              fontWeight: 700,
              fontSize: 16,
              px: 3,
              transition: INSTANT,
              '&:hover': { bgcolor: '#c2c2c2' },
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            disableRipple
            disableElevation
            sx={{
              bgcolor: '#22c55e',
              color: '#fff',
              textTransform: 'none',
              borderRadius: '12px',
              height: 42,
              fontWeight: 700,
              fontSize: 16,
              px: 3,
              transition: INSTANT,
              '&:hover': { bgcolor: '#16a34a' },
              '&.Mui-disabled': { bgcolor: 'rgba(0,0,0,0.1)', color: '#b5b5b5' },
            }}
          >
            {loading ? 'Saving...' : paymentMethod ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default PaymentMethodDialog;
