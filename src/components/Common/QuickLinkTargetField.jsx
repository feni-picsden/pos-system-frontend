import React from 'react';
import { Autocomplete, Box, TextField, Typography } from '@mui/material';
import ShopfrontSwitch from './ShopfrontSwitch';
import { useAppPages } from '../../hooks/useAppPages';
import { isExternalUrl } from '../../utils/quickLinks';

/**
 * Where a Quick Menu item points. The people using the till do not know route
 * paths, so the target is a searchable PAGE dropdown (every page the user can
 * open); the URL box only appears for an External link to another website.
 *
 * value     the stored url ('/products' or 'https://…')
 * onChange  (url, page) — `page` is the picked page, so callers can default the name
 */
const QuickLinkTargetField = ({ value, onChange, disabled = false, sx, inputSx }) => {
  const pages = useAppPages();
  const [externalMode, setExternalMode] = React.useState(() => isExternalUrl(value));

  // A row loaded later (or replaced) may switch kind.
  React.useEffect(() => {
    if (isExternalUrl(value)) setExternalMode(true);
  }, [value]);

  const selected = pages.find((p) => p.path === value) || null;
  // An older hand-typed path that matches no page stays visible (and editable away)
  // instead of silently showing an empty box.
  const orphan = !selected && value && !isExternalUrl(value)
    ? { id: `custom:${value}`, label: `${value} (not a known page)`, title: value, path: value, permissions: [] }
    : null;
  const options = orphan ? [orphan, ...pages] : pages;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0, ...sx }}>
      {externalMode ? (
        <TextField
          label="Web address"
          placeholder="https://…"
          value={isExternalUrl(value) ? value : ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value, null)}
          sx={{ flex: 1, ...inputSx }}
        />
      ) : (
        <Autocomplete
          options={options}
          value={selected || orphan}
          disabled={disabled}
          getOptionLabel={(o) => o.label || ''}
          isOptionEqualToValue={(o, v) => o.path === v?.path}
          onChange={(_, page) => onChange(page ? page.path : '', page)}
          noOptionsText="No page found"
          renderInput={(params) => (
            <TextField {...params} label="Page" placeholder="Search pages…" sx={inputSx} />
          )}
          sx={{ flex: 1, minWidth: 0 }}
        />
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
        <ShopfrontSwitch
          checked={externalMode}
          disabled={disabled}
          onChange={(e) => {
            setExternalMode(e.target.checked);
            onChange('', null); // the old target belongs to the other kind
          }}
        />
        <Typography sx={{ fontSize: 13, color: '#676b72' }}>External</Typography>
      </Box>
    </Box>
  );
};

export default QuickLinkTargetField;
