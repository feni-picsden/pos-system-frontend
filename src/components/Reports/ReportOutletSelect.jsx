import React, { useEffect, useState } from 'react';
import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import apiClient from '../../services/apiClient';

// Outlet filter for report pages. Lists exactly the outlets the signed-in user may
// report on (Setup > Users > Reporting Access switches; a global admin gets them
// all). '' = every outlet the user may report on — the reference default, where a
// report is not tied to the outlet you happen to be standing in.
const ReportOutletSelect = ({ value, onChange, sx }) => {
  const [outlets, setOutlets] = useState([]);

  useEffect(() => {
    let alive = true;
    apiClient
      .get('/auth/report-outlets', { skipOutletScope: true, noCache: true })
      .then((res) => { if (alive) setOutlets(res.data?.outlets || []); })
      .catch(() => { if (alive) setOutlets([]); });
    return () => { alive = false; };
  }, []);

  // A pick that is no longer reportable (switch turned off meanwhile) falls back to all.
  useEffect(() => {
    if (value && outlets.length && !outlets.some((o) => String(o.id) === String(value))) onChange('');
  }, [outlets, value, onChange]);

  return (
    <FormControl size="small" sx={{ minWidth: 200, bgcolor: '#fff', ...sx }}>
      <InputLabel shrink>Outlet</InputLabel>
      <Select
        label="Outlet"
        notched
        displayEmpty
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <MenuItem value="">{outlets.length ? 'All my outlets' : 'No reporting access'}</MenuItem>
        {outlets.map((o) => (
          <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default ReportOutletSelect;
