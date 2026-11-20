import React, { useState, useEffect, useMemo, useRef } from 'react';
import { byMode } from '../../theme/sfPalette';
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
import { Check as CheckIcon, ArrowDropDown as ArrowDropDownIcon } from '@mui/icons-material';
import CreatingForOutlet from '../Common/CreatingForOutlet';
import { BLUE } from '../Common/refMenuProps';

// Reference has no transitions anywhere.
const INSTANT = 'all 0s ease';

// Exact reference grouping/order (Shopfront help: Standard / Integrations / External).
// 'Linkly Value Added Applications' is hidden until VAA routing codes are
// implemented — selecting it today would silently run plain '00' EFTPOS
// transactions (the misconfiguration trap Shopfront's help warns about).
const TYPE_GROUPS = [
  { label: 'Standard', options: ['Cash', 'Cheque', 'Direct Deposit', 'EFTPOS', 'Gift Card', 'Voucher'] },
  // 'Tyro' hidden (user 20/10/2026): only the type name and a pairing screen
  // exist - no real Tyro processing, so a Tyro method would "pay" without the
  // terminal. Linkly is the integrated EFTPOS. Server still accepts the type.
  { label: 'Integrations', options: ['Linkly'] },
  { label: 'External', options: ['Custom'] },
];

// Reference list: ~5 rows visible then scroll, 1px black frame, rounded.
const ROW_H = 48;

/**
 * Searchable single-select combobox matching the reference Type dropdown:
 * typed value + caret, opens below, bold non-selectable group headings with a
 * rule under each, hovered row light blue, selected row in blue text.
 * Arrow keys move over options only (headings are skipped), Enter picks.
 */
export const TypeCombobox = ({ value, onChange, disabled, borderColor = '#595959', square = false }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const anchorRef = useRef(null);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TYPE_GROUPS.map((g) => ({
      ...g,
      options: q ? g.options.filter((o) => o.toLowerCase().includes(q)) : g.options,
    })).filter((g) => g.options.length > 0);
  }, [query]);
  const flat = useMemo(() => filteredGroups.flatMap((g) => g.options), [filteredGroups]);

  const close = () => {
    setOpen(false);
    setQuery('');
    setActive(-1);
  };
  const pick = (option) => {
    onChange(option);
    close();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      if (!flat.length) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i < 0 ? (step > 0 ? 0 : flat.length - 1) : (i + step + flat.length) % flat.length));
    } else if (e.key === 'Enter') {
      if (!open) return;
      e.preventDefault();
      const option = flat[active] ?? (query.trim() ? flat[0] : undefined);
      if (option) pick(option);
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation();
      close();
    }
  };

  return (
    <ClickAwayListener onClickAway={close}>
      <Box sx={{ position: 'relative' }}>
        <Box
          ref={anchorRef}
          component="input"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-label="Type"
          disabled={disabled}
          value={open ? query : value || ''}
          placeholder={open ? value || 'Select...' : 'Select...'}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
          sx={{
            width: '100%',
            height: 42,
            border: byMode(`1px solid ${borderColor}`, '1px solid #a1a1a1'),
            borderRadius: square ? 0 : '8px',
            pl: 1.5,
            pr: 4.5,
            bgcolor: byMode('#fff', '#121212'),
            fontFamily: 'inherit',
            fontSize: 16,
            color: byMode('#000', '#f8f8f8'),
            outline: 'none',
            boxSizing: 'border-box',
            '&::placeholder': { color: byMode('#808080', '#757575'), opacity: 1 },
          }}
        />
        <ArrowDropDownIcon
          onClick={() => !disabled && (open ? close() : (setOpen(true), anchorRef.current?.focus()))}
          sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: byMode('#000', '#f8f8f8'), cursor: 'pointer' }}
        />
        <Popper
          open={open}
          anchorEl={anchorRef.current}
          placement="bottom-start"
          modifiers={[{ name: 'offset', options: { offset: [0, 2] } }, { name: 'flip', enabled: false }]}
          style={{ zIndex: 1400 }}
        >
          <Box
            role="listbox"
            sx={{
              width: anchorRef.current ? anchorRef.current.offsetWidth : 'auto',
              bgcolor: byMode('#fff', '#232323'),
              border: byMode('1px solid #000', '1px solid #a1a1a1'),
              borderRadius: '8px',
              boxShadow: 'none',
              maxHeight: ROW_H * 5 + 45,
              overflow: 'auto',
              transition: INSTANT,
            }}
          >
            {filteredGroups.length === 0 ? (
              <Box sx={{ px: 2, height: ROW_H, display: 'flex', alignItems: 'center', fontSize: 16, color: byMode('#0a0a0a', '#f8f8f8') }}>No Options</Box>
            ) : (
              filteredGroups.map((group) => (
                <Box key={group.label} role="group" aria-label={group.label}>
                  {/* Heading: plain text, not a button — cannot be picked. */}
                  <Box
                    aria-hidden="true"
                    sx={{
                      px: 2, height: 45, display: 'flex', alignItems: 'center', fontSize: 16, fontWeight: 700,
                      color: byMode('#000', '#f8f8f8'), borderBottom: byMode('1px solid #000', '1px solid #a1a1a1'), cursor: 'default', userSelect: 'none',
                    }}
                  >
                    {group.label}
                  </Box>
                  {group.options.map((option) => {
                    const idx = flat.indexOf(option);
                    return (
                      <Box
                        key={option}
                        role="option"
                        aria-selected={option === value}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => pick(option)}
                        sx={{
                          px: 2,
                          height: ROW_H,
                          display: 'flex',
                          alignItems: 'center',
                          cursor: 'pointer',
                          fontSize: 16,
                          color: byMode(option === value ? BLUE : '#000', idx === active ? '#fafafa' : (option === value ? '#00a6f4' : '#f8f8f8')),
                          bgcolor: idx === active ? byMode('#6fd0ff', '#0084d1') : 'transparent',
                          transition: INSTANT,
                        }}
                      >
                        {option}
                      </Box>
                    );
                  })}
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

    const name = formData.name.trim();
    if (!name) {
      setError('Payment method name is required');
      return;
    }
    if (!formData.type) {
      setError('Payment method type is required');
      return;
    }

    try {
      await onSave({ ...formData, name });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save payment method');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { borderRadius: '8px', width: 512, maxWidth: '92vw', overflow: 'visible', bgcolor: byMode('#fff', '#232323') } }}
    >
      {/* Light-green header, no close X — close = Cancel / Escape */}
      <Box
        sx={{
          bgcolor: byMode('#b9f6ca', '#264029'),
          px: 3,
          py: 1.75,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px',
        }}
      >
        <CheckIcon sx={{ color: byMode('#1b873f', '#7bf1a8'), fontSize: 22 }} />
        <Typography sx={{ color: byMode('#14532d', '#7bf1a8'), fontSize: 18, fontWeight: 700 }}>
          {paymentMethod ? 'Edit Payment Method' : 'Create Payment Method'}
        </Typography>
      </Box>
      {/* apiClient stamps the navbar outlet on this create; the pill says which. */}
      {!paymentMethod && <CreatingForOutlet sx={{ mx: 3, mt: 2, mb: 0 }} />}

      <form onSubmit={handleSubmit} noValidate>
        <DialogContent sx={{ px: 3, py: 2.5, overflow: 'visible' }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box
            component="input"
            type="text"
            placeholder="Name"
            aria-label="Name"
            maxLength={100}
            autoFocus
            value={formData.name}
            disabled={loading}
            onChange={(e) => handleInputChange('name', e.target.value)}
            sx={{
              width: '100%',
              height: 42,
              border: byMode('1px solid #595959', '1px solid #a1a1a1'),
              borderRadius: '8px',
              px: 1.5,
              mb: 2,
              bgcolor: byMode('#fff', '#121212'),
              fontFamily: 'inherit',
              fontSize: 16,
              color: byMode('#000', '#f8f8f8'),
              outline: 'none',
              boxSizing: 'border-box',
              '&::placeholder': { color: byMode('#808080', '#757575'), opacity: 1 },
            }}
          />

          <Typography sx={{ fontSize: 13, color: byMode('#000', '#f8f8f8'), mb: 0.5 }}>Type</Typography>
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
              bgcolor: byMode('#d4d4d4', '#3a3a3a'),
              color: byMode('#000', '#f8f8f8'),
              textTransform: 'none',
              borderRadius: '12px',
              height: 42,
              fontWeight: 700,
              fontSize: 16,
              px: 3,
              transition: INSTANT,
              '&:hover': { bgcolor: byMode('#c2c2c2', '#4a4a4a') },
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
              color: byMode('#fff', '#232323'),
              textTransform: 'none',
              borderRadius: '12px',
              height: 42,
              fontWeight: 700,
              fontSize: 16,
              px: 3,
              transition: INSTANT,
              '&:hover': { bgcolor: '#16a34a' },
              '&.Mui-disabled': { bgcolor: byMode('rgba(0,0,0,0.1)', '#3a3a3a'), color: byMode('#b5b5b5', '#757575') },
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
