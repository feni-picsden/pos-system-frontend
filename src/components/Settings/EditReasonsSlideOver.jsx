import React, { useEffect, useState } from 'react';
import { Box, Button, IconButton, TextField, Typography } from '@mui/material';
import { Add as AddIcon, DeleteOutlined } from '@mui/icons-material';
import SettingsSlideOver from './SettingsSlideOver';

// "Edit Predefined Reasons" panel for the Setup > General reason-list fields.
// Reference chrome: 768px right slide-over, no X close - exactly three buttons
// (+ Add Reason / Cancel / Update). Cancel discards the panel's edits; Update
// hands the cleaned list back to the page (blob lists are saved by the
// floating Save, cash in/out lists PUT immediately).
const FIELD_SX = {
  '& .MuiOutlinedInput-root': { height: 42, borderRadius: '8px' },
  '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #404040' }
};

const EditReasonsSlideOver = ({ open, noun, reasons, onCancel, onUpdate }) => {
  const [list, setList] = useState([]);

  // Re-seed local edits each time the panel opens.
  useEffect(() => {
    if (open) setList(reasons || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <SettingsSlideOver open={open} wide header={false} onClose={onCancel}>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 4 }}>
        <Typography sx={{ fontSize: 24, fontWeight: 400, color: '#000' }}>
          Edit Predefined Reasons
        </Typography>
        <Typography sx={{ fontSize: 16, color: '#000', mt: 2 }}>
          You can modify the predefined {noun} reasons here, this won't affect any reasons
          already provided and users will still be able to select <em>Other</em> and provide a
          custom reason.
        </Typography>
        <Typography sx={{ fontSize: 16, color: '#000', mt: 1 }}>
          If no reasons are provided, a user will always need to type in the reason.
        </Typography>
        <Button
          fullWidth
          startIcon={<AddIcon />}
          onClick={() => setList(prev => [...prev, ''])}
          sx={{
            mt: 3, height: 42, borderRadius: '12px', textTransform: 'none',
            fontSize: 16, fontWeight: 700, letterSpacing: '0.025em',
            backgroundColor: '#32b643', color: '#fff', boxShadow: 'none',
            '&:hover': { backgroundColor: '#6dd77b', boxShadow: 'none' }
          }}
        >
          Add Reason
        </Button>
        <Box sx={{ flex: 1, overflowY: 'auto', mt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {list.map((reason, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                value={reason}
                onChange={(e) => setList(prev => prev.map((r, j) => (j === i ? e.target.value : r)))}
                size="small"
                fullWidth
                sx={FIELD_SX}
              />
              <IconButton
                aria-label="Remove reason"
                onClick={() => setList(prev => prev.filter((_, j) => j !== i))}
              >
                <DeleteOutlined />
              </IconButton>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <Button
            onClick={onCancel}
            sx={{
              flex: 1, height: 42, borderRadius: '12px', textTransform: 'none',
              fontSize: 16, fontWeight: 700, letterSpacing: '0.025em',
              backgroundColor: '#dedede', color: '#000',
              '&:hover': { backgroundColor: '#cfcfcf' }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => onUpdate(list.map(r => r.trim()).filter(Boolean))}
            sx={{
              flex: 1, height: 42, borderRadius: '12px', textTransform: 'none',
              fontSize: 16, fontWeight: 700, letterSpacing: '0.025em',
              backgroundColor: '#5ebbeb', color: '#fff', boxShadow: 'none',
              '&:hover': { backgroundColor: '#4aa9dd', boxShadow: 'none' }
            }}
          >
            Update
          </Button>
        </Box>
      </Box>
    </SettingsSlideOver>
  );
};

export default EditReasonsSlideOver;
