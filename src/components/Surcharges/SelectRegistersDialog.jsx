import React, { useEffect, useState } from 'react';
import { Box, Button, Checkbox, Dialog, DialogContent, Typography } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { byMode } from '../../theme/sfPalette';

const TXT = byMode('#000000', '#f8f8f8');

// Reference "Save to..." → "? Select Registers": pick the registers that should
// receive a copy of the current surcharge calendar. Their current settings are
// overridden and their Schedule Active toggle is switched off.
const SelectRegistersDialog = ({ open, onClose, onSave, registers = [], outletNameFor, currentRegisterId, saving = false }) => {
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (open) setSelected([]);
  }, [open]);

  const toggle = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const groups = registers
    .filter((r) => r.id !== currentRegisterId)
    .reduce((acc, r) => {
      const name = outletNameFor ? outletNameFor(r) : 'Registers';
      (acc[name] = acc[name] || []).push(r);
      return acc;
    }, {});

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth={false}
      PaperProps={{ sx: { width: 560, maxWidth: '95vw', borderRadius: '8px' } }}
    >
      <Box sx={{ bgcolor: byMode('#e3f3fb', '#0c3a55'), px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1, borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}>
        <HelpOutlineIcon sx={{ color: byMode('#0b5f8a', '#74d4ff'), fontSize: 20 }} />
        <Typography sx={{ fontSize: 18, fontWeight: 600, color: byMode('#0b5f8a', '#74d4ff') }}>Select Registers</Typography>
      </Box>

      <DialogContent sx={{ p: 3 }}>
        <Typography sx={{ fontSize: 14, color: TXT, mb: 2 }}>
          Select which registers you would like to save the current surcharge calendar to. This will override the
          current settings on the selected registers and will set them inactive.
        </Typography>

        {Object.keys(groups).length === 0 && (
          <Typography sx={{ fontSize: 14, color: byMode('#757575', '#a0a4aa') }}>There are no other registers to save to.</Typography>
        )}

        {Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([outletName, list]) => (
          <Box key={outletName} sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: TXT, mb: 1 }}>{outletName}</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {list.map((r) => {
                const checked = selected.includes(r.id);
                return (
                  <Box
                    key={r.id}
                    onClick={() => toggle(r.id)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 1.5,
                      py: 0.75,
                      border: checked ? '2px solid #1e88e5' : byMode('2px solid #c7c7c7', '2px solid #5a5a5a'),
                      borderRadius: '8px',
                      cursor: 'pointer',
                      bgcolor: checked ? byMode('#e3f3fb', '#0c3a55') : byMode('white', '#232323'),
                    }}
                  >
                    <Checkbox checked={checked} sx={{ p: 0.5, color: TXT }} />
                    <Typography sx={{ fontSize: 15, color: TXT }}>{r.name}</Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        ))}
      </DialogContent>

      <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end', gap: 1, borderTop: byMode('1px solid #e0e0e0', '1px solid #373737') }}>
        <Button
          onClick={onClose}
          disabled={saving}
          sx={{ bgcolor: byMode('#d4d4d4', '#3a3a3a'), color: byMode('#000000', '#f8f8f8'), '&:hover': { bgcolor: byMode('#c4c4c4', '#4a4a4a') }, textTransform: 'none', minWidth: 118, height: 42, borderRadius: '12px', fontWeight: 700, fontSize: 16 }}
        >
          Cancel
        </Button>
        <Button
          onClick={() => onSave(selected)}
          disabled={saving || selected.length === 0}
          sx={{ bgcolor: '#1e88e5', color: byMode('white', '#232323'), '&:hover': { bgcolor: '#1565c0' }, '&.Mui-disabled': { bgcolor: byMode('#9ccdf3', '#3a3a3a'), color: byMode('white', '#a0a4aa') }, textTransform: 'none', minWidth: 118, height: 42, borderRadius: '12px', fontWeight: 700, fontSize: 16 }}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>
    </Dialog>
  );
};

export default SelectRegistersDialog;
