import { useEffect, useState } from 'react';
import { Autocomplete, Box, Checkbox, Chip, TextField } from '@mui/material';
import {
  CheckBoxOutlineBlank as UncheckedIcon,
  CheckBox as CheckedIcon,
} from '@mui/icons-material';
import outletService from '../../services/outletService';
import useHeaderScope from '../../hooks/useHeaderScope';
import { OUTLET_SELECT_SX } from './productViewStyles';

// Reference product-view "Outlets" filter shared by the Purchase History / Transfer
// History (single) and Promotions (multi, checkbox options + chips) tabs. Same box as
// the Inventory Log filter. Hidden when a header outlet is selected (header rule
// 16/10/2026) - the header outlet then scopes the tab by itself; the parent gets
// `null` / `[]` so its request falls back to the header outlet.
// `value`: outlet object (single) or array of outlet objects (multiple).
const ProductOutletFilter = ({ multiple = false, value, onChange, testId = 'product-outlet-filter' }) => {
  const [outlets, setOutlets] = useState([]);
  const { showOutletFilter } = useHeaderScope();

  useEffect(() => {
    outletService
      .getAllOutlets()
      .then((res) => setOutlets(res?.outlets || res?.data || res || []))
      .catch(() => setOutlets([]));
  }, []);

  useEffect(() => {
    const has = multiple ? (value || []).length > 0 : !!value;
    if (!showOutletFilter && has) onChange(multiple ? [] : null);
  }, [showOutletFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!showOutletFilter) return null;

  const selected = multiple ? value || [] : value || null;

  return (
    <Box sx={{ p: 1, pb: 2 }}>
      {/* Reference (Purchase / Transfer / Promotions tabs): bare box, no label */}
      <Autocomplete
        multiple={multiple}
        disableCloseOnSelect={multiple}
        options={outlets}
        getOptionLabel={(o) => o?.name || ''}
        isOptionEqualToValue={(o, v) => o?.id === v?.id}
        value={selected}
        onChange={(e, v) => onChange(multiple ? v : v || null)}
        limitTags={2}
        ListboxProps={multiple ? { sx: { p: 0, '& .MuiAutocomplete-option': { fontSize: 16, py: '10px', color: '#000' }, '& .MuiAutocomplete-option[aria-selected="true"]': { color: '#1c86f2', bgcolor: 'transparent' }, '& .MuiAutocomplete-option.Mui-focused': { bgcolor: '#5ebbeb !important', color: '#000' } } } : undefined}
        renderOption={multiple ? (props, option, { selected: isSel }) => (
          <li {...props} key={option.id} aria-selected={isSel}>
            <Checkbox
              icon={<UncheckedIcon fontSize="small" />}
              checkedIcon={<CheckedIcon fontSize="small" />}
              checked={isSel}
              sx={{ p: 0, mr: 1, color: '#000', '&.Mui-checked': { color: '#1c86f2' } }}
            />
            {option.name}
          </li>
        ) : undefined}
        renderTags={multiple ? (val, getTagProps) =>
          val.map((option, index) => (
            <Chip
              {...getTagProps({ index })}
              key={option.id}
              label={option.name}
              size="small"
              sx={{ borderRadius: '4px', fontSize: 14, maxWidth: 150, height: 24, bgcolor: '#ebebeb' }}
            />
          )) : undefined}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={multiple && selected.length ? '' : 'Select Outlet...'}
            inputProps={{ ...params.inputProps, 'data-testid': testId }}
          />
        )}
        sx={multiple ? {
          ...OUTLET_SELECT_SX,
          '& .MuiOutlinedInput-root': { ...OUTLET_SELECT_SX['& .MuiOutlinedInput-root'], height: 'auto', minHeight: 42, flexWrap: 'wrap', gap: '4px' },
        } : OUTLET_SELECT_SX}
      />
    </Box>
  );
};

export default ProductOutletFilter;
