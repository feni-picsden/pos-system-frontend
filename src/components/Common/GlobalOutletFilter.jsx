import React, { useCallback } from 'react';
import { Autocomplete, Box, TextField, Typography } from '@mui/material';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import useHeaderScope from '../../hooks/useHeaderScope';

/**
 * Outlet filter + Outlet column on list/report pages (rebuilt 19/10/2026 - the
 * 15/10 version was never committed and got lost).
 *
 * Rule (user, 16/10 + 19/10): shown ONLY when the header has no outlet AND no
 * register picked (All Outlets) - the list then holds every outlet's rows. With
 * an outlet (or register) in the header the list is already that outlet's, so
 * filter and column stay hidden.
 */
export const useGlobalOutlet = () => {
  const { outlets } = useSelectedOutlet();
  const { showOutletFilter, showRegisterFilter } = useHeaderScope();
  const globalMode = !!(showOutletFilter && showRegisterFilter);
  const outletNameOf = useCallback(
    (id) => (id == null ? 'Global' : outlets.find((o) => o.id === id)?.name || `Outlet #${id}`),
    [outlets],
  );
  return { globalMode, outlets, outletNameOf };
};

const FIELD_SX = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: '#fff',
    borderRadius: '8px',
    fontSize: 16,
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
  },
};

/**
 * value: the picked outlet object (or null = all outlets). Renders nothing
 * outside All Outlets mode.
 */
const GlobalOutletFilter = ({ value, onChange, label = 'Outlet', placeholder = 'All Outlets', sx, inputSx, labelSx, hideLabel = false }) => {
  const { globalMode, outlets } = useGlobalOutlet();
  if (!globalMode) return null;
  return (
    <Box sx={sx}>
      {!hideLabel && (
        <Typography sx={{ mb: 0.5, fontWeight: 400, fontSize: 16, color: '#000', ...labelSx }}>{label}</Typography>
      )}
      <Autocomplete
        size="small"
        options={outlets}
        value={value || null}
        onChange={(_, v) => onChange(v || null)}
        getOptionLabel={(o) => o?.name || ''}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        renderInput={(params) => (
          <TextField {...params} placeholder={placeholder} sx={{ ...FIELD_SX, ...inputSx }} />
        )}
      />
    </Box>
  );
};

export default GlobalOutletFilter;
