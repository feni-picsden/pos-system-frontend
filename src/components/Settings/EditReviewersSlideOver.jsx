import React, { useEffect, useMemo, useState } from 'react';
import { Autocomplete, Avatar, Box, Button, IconButton, TextField, Typography } from '@mui/material';
import { DeleteOutlined } from '@mui/icons-material';
import SettingsSlideOver from './SettingsSlideOver';

const userDisplayName = (u) =>
  u?.name || `${u?.firstName || ''} ${u?.lastName || ''}`.trim() || u?.username || u?.email || 'Unknown';

// Setup > General > Outlets > Orders & Invoices > "Edit Default Reviewers"
// (reference "Edit Order Reviewers" panel): one "Search Users to Add..." combobox
// (avatar rows), the chosen users listed under it, "No Default Reviewers" when
// empty, Cancel / Update footer. Cancel discards; Update hands back the ids.
const FIELD_SX = {
  '& .MuiOutlinedInput-root': { minHeight: 42, borderRadius: '8px' },
  '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #404040' }
};

const EditReviewersSlideOver = ({ open, users = [], selectedIds = [], onCancel, onUpdate }) => {
  const [ids, setIds] = useState([]);

  useEffect(() => {
    if (open) setIds((selectedIds || []).map(Number));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const byId = useMemo(() => new Map(users.map((u) => [Number(u.id), u])), [users]);
  const chosen = ids.map((id) => byId.get(id)).filter(Boolean);
  const options = users.filter((u) => !ids.includes(Number(u.id)));

  return (
    <SettingsSlideOver open={open} wide header={false} onClose={onCancel}>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 4 }} data-testid="edit-reviewers-panel">
        <Typography sx={{ fontSize: 24, fontWeight: 400, color: '#000' }}>Edit Order Reviewers</Typography>
        <Autocomplete
          options={options}
          value={null}
          blurOnSelect
          clearOnBlur
          onChange={(e, picked) => { if (picked) setIds((prev) => [...prev, Number(picked.id)]); }}
          getOptionLabel={userDisplayName}
          isOptionEqualToValue={(o, v) => o.id === v?.id}
          ListboxProps={{ style: { maxHeight: 290 } }}
          renderOption={(props, option) => (
            <li {...props} key={option.id} style={{ minHeight: 56 }}>
              <Avatar sx={{ width: 28, height: 28, mr: 1.5, bgcolor: '#9e9e9e', fontSize: 14 }}>
                {userDisplayName(option).charAt(0).toUpperCase()}
              </Avatar>
              {userDisplayName(option)}
            </li>
          )}
          renderInput={(params) => (
            <TextField {...params} placeholder="Search Users to Add..." size="small" sx={{ ...FIELD_SX, mt: 3 }} inputProps={{ ...params.inputProps, 'aria-label': 'Search Users to Add' }} />
          )}
        />
        <Box sx={{ flex: 1, overflowY: 'auto', mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }} data-testid="default-reviewers-list">
          {chosen.length === 0 ? (
            <Typography sx={{ textAlign: 'center', color: '#676b72', fontSize: 16, mt: 3 }}>No Default Reviewers</Typography>
          ) : chosen.map((u) => (
            <Box key={u.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1, py: 0.5 }}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: '#9e9e9e', fontSize: 14 }}>{userDisplayName(u).charAt(0).toUpperCase()}</Avatar>
              <Typography sx={{ flex: 1, fontSize: 16 }}>{userDisplayName(u)}</Typography>
              <IconButton aria-label={`Remove ${userDisplayName(u)}`} onClick={() => setIds((prev) => prev.filter((x) => x !== Number(u.id)))}>
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
              backgroundColor: '#dedede', color: '#000', '&:hover': { backgroundColor: '#cfcfcf' }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => onUpdate(ids)}
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

export default EditReviewersSlideOver;
