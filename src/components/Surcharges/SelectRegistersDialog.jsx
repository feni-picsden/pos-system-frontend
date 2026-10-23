import React, { useEffect, useState } from 'react';
import { Box, Button, Checkbox, Dialog, DialogContent, Typography } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

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
      <Box sx={{ bgcolor: '#e3f3fb', px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1, borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}>
        <HelpOutlineIcon sx={{ color: '#0b5f8a', fontSize: 20 }} />
        <Typography sx={{ fontSize: 18, fontWeight: 600, color: '#0b5f8a' }}>Select Registers</Typography>
      </Box>

      <DialogContent sx={{ p: 3 }}>
        <Typography sx={{ fontSize: 14, color: '#000000', mb: 2 }}>
          Select which registers you would like to save the current surcharge calendar to. This will override the
          current settings on the selected registers and will set them inactive.
        </Typography>

        {Object.keys(groups).length === 0 && (
          <Typography sx={{ fontSize: 14, color: '#757575' }}>There are no other registers to save to.</Typography>
        )}

        {Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([outletName, list]) => (
          <Box key={outletName} sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#000000', mb: 1 }}>{outletName}</Typography>
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
                      border: `2px solid ${checked ? '#1e88e5' : '#c7c7c7'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      bgcolor: checked ? '#e3f3fb' : 'white',
                    }}
                  >
                    <Checkbox checked={checked} sx={{ p: 0.5, color: '#000000' }} />
                    <Typography sx={{ fontSize: 15, color: '#000000' }}>{r.name}</Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        ))}
      </DialogContent>

      <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end', gap: 1, borderTop: '1px solid #e0e0e0' }}>
        <Button
          onClick={onClose}
          disabled={saving}
          sx={{ bgcolor: '#d4d4d4', color: '#000000', '&:hover': { bgcolor: '#c4c4c4' }, textTransform: 'none', minWidth: 118, height: 42, borderRadius: '12px', fontWeight: 700, fontSize: 16 }}
        >
          Cancel
        </Button>
        <Button
          onClick={() => onSave(selected)}
          disabled={saving || selected.length === 0}
          sx={{ bgcolor: '#1e88e5', color: 'white', '&:hover': { bgcolor: '#1565c0' }, '&.Mui-disabled': { bgcolor: '#9ccdf3', color: 'white' }, textTransform: 'none', minWidth: 118, height: 42, borderRadius: '12px', fontWeight: 700, fontSize: 16 }}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>
    </Dialog>
  );
};

export default SelectRegistersDialog;
