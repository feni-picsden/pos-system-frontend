import React, { useEffect, useState } from 'react';
import {
  Avatar,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  TextField,
} from '@mui/material';
import { Create as PencilIcon } from '@mui/icons-material';

const userDisplayName = (u) =>
  u?.name || `${u?.firstName || ''} ${u?.lastName || ''}`.trim() || u?.username || u?.email || 'Unknown';

// Reviewer multi-select dialog (Shopfront reference): dark pencil badge on top,
// one combobox with checkbox + avatar rows, Cancel / confirm footer.
// lockedIds = reviewers who already resolved their review; they cannot be removed.
const ReviewerSelectDialog = ({
  open,
  onClose,
  users = [],
  initialSelectedIds = [],
  lockedIds = [],
  onConfirm,
  saving = false,
  confirmLabel = 'Create Review',
}) => {
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (open) {
      setSelected(users.filter((u) => initialSelectedIds.includes(u.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, users]);

  const handleChange = (e, value) => {
    // Locked reviewers can never be deselected
    const lockedUsers = users.filter((u) => lockedIds.includes(u.id));
    const merged = [...value];
    lockedUsers.forEach((lu) => {
      if (!merged.some((u) => u.id === lu.id)) merged.push(lu);
    });
    setSelected(merged);
  };

  return (
    <Dialog
      open={open}
      onClose={() => !saving && onClose()}
      fullWidth
      PaperProps={{ sx: { borderRadius: 0, maxWidth: 760, overflowY: 'visible' } }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: -32,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1,
        }}
      >
        <Avatar sx={{ bgcolor: '#313439', width: 64, height: 64 }}>
          <PencilIcon sx={{ color: '#f8f8f8' }} />
        </Avatar>
      </Box>
      <DialogContent sx={{ p: 3, pt: 5 }}>
        <Autocomplete
          multiple
          disableCloseOnSelect
          options={users}
          value={selected}
          onChange={handleChange}
          getOptionLabel={userDisplayName}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          getOptionDisabled={(option) => lockedIds.includes(option.id)}
          ListboxProps={{ style: { maxHeight: 300 } }}
          renderOption={(props, option, { selected: isSelected }) => (
            <li {...props}>
              <Checkbox checked={isSelected} sx={{ mr: 1 }} disableRipple />
              <Avatar sx={{ width: 32, height: 32, fontSize: 14, mr: 1.5 }}>
                {userDisplayName(option).charAt(0).toUpperCase()}
              </Avatar>
              {userDisplayName(option)}
            </li>
          )}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => {
              const tagProps = getTagProps({ index });
              return (
                <Chip
                  {...tagProps}
                  key={option.id}
                  size="small"
                  label={userDisplayName(option)}
                  onDelete={lockedIds.includes(option.id) ? undefined : tagProps.onDelete}
                />
              );
            })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder={selected.length === 0 ? 'Select...' : ''}
              size="small"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
            />
          )}
        />
      </DialogContent>
      <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
        <Button
          onClick={onClose}
          disabled={saving}
          variant="outlined"
          size="small"
          sx={{ textTransform: 'none', color: '#676b72', borderColor: '#bdbdbd', '&:hover': { borderColor: '#bdbdbd', backgroundColor: 'transparent' } }}
        >
          Cancel
        </Button>
        <Button
          onClick={() => onConfirm(selected.map((u) => u.id))}
          disabled={saving}
          variant="contained"
          disableElevation
          sx={{ textTransform: 'none', backgroundColor: '#5ebbeb', boxShadow: 'none', '&:hover': { backgroundColor: '#5ebbeb', boxShadow: 'none' } }}
        >
          {saving ? 'Saving...' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReviewerSelectDialog;
