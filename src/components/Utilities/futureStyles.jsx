// Shared Shopfront tokens for the Utilities > Future Prices / Future Costs pages:
// the 42px filter field, the open-list look, the bulk toolbar, the row pills,
// the grid checkboxes and the Schedule dialog fields.
import React from 'react';
import {
  CheckBoxOutlineBlankOutlined as SquareIcon,
  CheckBoxOutlined as CheckSquareIcon,
  IndeterminateCheckBoxOutlined as IndeterminateSquareIcon,
} from '@mui/icons-material';

// Reference has no transitions anywhere on these pages.
export const INSTANT = 'all 0s ease';

// Filter field: 42px, white, 8px radius, 1px #404040 rail, 2px black when focused.
export const FIELD_SX = {
  height: 42,
  bgcolor: '#fff',
  borderRadius: '8px',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
  '& .MuiSelect-select, & .MuiInputBase-input': { fontSize: 16, py: 0, height: '42px !important', display: 'flex', alignItems: 'center' },
};

// Every open list: attached under the field, 1px dark border, 8px radius, 56px
// rows, hovered / keyboard row sky-300, picked row text blue.
const activeRowSx = { bgcolor: '#7dd3fc' };
export const LIST_PAPER_SX = {
  mt: '4px',
  border: '1px solid #000',
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  '& .MuiAutocomplete-listbox': { maxHeight: 289, py: '2px' },
  '& .MuiAutocomplete-listbox .MuiAutocomplete-option': { minHeight: 56, px: '14px', fontSize: 16, color: '#000' },
  '& .MuiAutocomplete-listbox .MuiAutocomplete-option[aria-selected="true"]': { bgcolor: 'transparent', color: '#00a6f4' },
  '& .MuiAutocomplete-listbox .MuiAutocomplete-option.Mui-focused, & .MuiAutocomplete-listbox .MuiAutocomplete-option.Mui-focused[aria-selected="true"]': activeRowSx,
  '& .MuiAutocomplete-noOptions': { fontSize: 16, color: '#000', px: '14px', py: '18px' },
};
export const SELECT_MENU_PROPS = {
  anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
  transformOrigin: { vertical: 'top', horizontal: 'left' },
  PaperProps: {
    sx: {
      mt: '4px',
      maxHeight: 289,
      border: '1px solid #000',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      '& .MuiMenu-list': { py: '2px' },
      '& .MuiMenuItem-root': { minHeight: 56, px: '14px', fontSize: 16, color: '#000' },
      '& .MuiMenuItem-root.Mui-selected': { color: '#00a6f4', bgcolor: 'transparent' },
      '& .MuiMenuItem-root:hover, & .MuiMenuItem-root.Mui-focusVisible, & .MuiMenuItem-root.Mui-selected:hover, & .MuiMenuItem-root.Mui-selected.Mui-focusVisible': activeRowSx,
    },
  },
};

export const CLEAR_ICON_SX = { fontSize: 18, color: '#000' };

// Single-pick Autocomplete root: x only once picked, 14px text inset.
export const singleAutocompleteSx = (hasValue) => ({
  flex: 1,
  minWidth: 0,
  '& .MuiAutocomplete-clearIndicator': { visibility: hasValue ? 'visible' : 'hidden', p: '2px' },
  '& .MuiAutocomplete-clearIndicator .MuiSvgIcon-root': CLEAR_ICON_SX,
  '& .MuiAutocomplete-inputRoot': { pl: '14px' },
  '& .MuiAutocomplete-inputRoot .MuiAutocomplete-input': { pl: 0 },
});
export const AUTOCOMPLETE_INPUT_SX = {
  '& .MuiOutlinedInput-root': { ...FIELD_SX, py: '0 !important' },
  '& input::placeholder': { color: '#808080', opacity: 1 },
};

// Measured on the reference: green-500 -> green-400 on hover (lightens).
export const NEW_BUTTON_SX = {
  bgcolor: '#00c950',
  border: '1px solid #00c950',
  color: '#fff',
  textTransform: 'none',
  boxShadow: 'none',
  borderRadius: '12px',
  fontWeight: 700,
  fontSize: 16,
  height: 42,
  width: 119,
  padding: '8px 32px',
  transition: INSTANT,
  '&:hover': { bgcolor: '#05df72', borderColor: '#00c950', boxShadow: 'none' },
};

// Every reference bulk button is outlined, 42px tall, 12px radius, 16/700, and
// greys to these exact tones when disabled.
export const BULK_BASE_SX = {
  textTransform: 'none',
  fontWeight: 700,
  fontSize: 16,
  height: 42,
  borderRadius: '12px',
  px: '32px',
  bgcolor: 'transparent',
  transition: INSTANT,
  '&.Mui-disabled': {
    bgcolor: '#e5e5e5',
    color: '#737373',
    borderColor: '#a1a1a1',
    cursor: 'not-allowed',
    pointerEvents: 'auto',
  },
};
export const BULK_DANGER_SX = {
  ...BULK_BASE_SX,
  color: '#e7000b',
  borderColor: '#fb2c36',
  '&:hover': { borderColor: '#fb2c36', bgcolor: 'rgba(0,0,0,0.05)' },
};
export const BULK_PRIMARY_SX = {
  ...BULK_BASE_SX,
  color: '#5ebbeb',
  borderColor: '#5ebbeb',
  '&:hover': { borderColor: '#5ebbeb', bgcolor: 'rgba(0,0,0,0.05)' },
};
// Filter button: solid sky, 106 wide; hover darkens to sky-500.
export const FILTER_BUTTON_SX = {
  ...BULK_BASE_SX,
  px: 0,
  width: 106,
  bgcolor: '#5ebbeb',
  border: '1px solid #5ebbeb',
  color: '#fff',
  '&:hover': { bgcolor: '#0ea5e9', borderColor: '#0ea5e9', boxShadow: 'none' },
};

// Row actions are the same outlined pill, 34px tall.
export const rowActionSx = (color, borderColor) => ({
  ...BULK_BASE_SX,
  height: 34,
  px: 2,
  color,
  borderColor,
  '&:hover': { borderColor: color, bgcolor: 'transparent' },
});

// Grid checkboxes, as on the other Utilities lists: thin-outline square glyphs.
export const CHECKBOX_GLYPHS = {
  icon: <SquareIcon />,
  checkedIcon: <CheckSquareIcon />,
  indeterminateIcon: <IndeterminateSquareIcon />,
};
export const CHECKBOX_SX = { p: '4px 2px', color: '#000', '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: '#000' } };

// Grid: 51px rounded sky header, 58px white rows, no rules.
export const TABLE_HEAD_ROW_SX = {
  '& th': { bgcolor: '#5ebbeb', color: '#fff', fontSize: 16, fontWeight: 700, border: 0, height: 51, py: 0, px: '8px' },
  '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
  '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' },
};
export const TABLE_BODY_SX = {
  '& tr': { bgcolor: '#fff' },
  '& td': { border: 0, height: 58, py: 0, px: '8px', fontSize: 16, color: '#000' },
};

// Schedule-dialog inputs: 1px #404040 border, 8px radius, #d4d4d4 fill when disabled.
export const DIALOG_INPUT_SX = {
  borderRadius: '8px',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
  '&.Mui-disabled': { bgcolor: '#d4d4d4' },
  '&.Mui-disabled .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
};
export const DIALOG_FIELD_SX = {
  '& .MuiOutlinedInput-root': { ...DIALOG_INPUT_SX, height: 42, pl: '14px' },
  '& .MuiOutlinedInput-input': { py: 0, pl: 0, fontSize: 16, height: '42px' },
  '& input::placeholder': { color: '#808080', opacity: 1 },
  '& .Mui-disabled input::placeholder': { color: '#737373' },
};
export const DIALOG_CANCEL_SX = {
  width: 118,
  height: 42,
  borderRadius: '12px',
  fontWeight: 700,
  fontSize: 16,
  textTransform: 'none',
  color: '#000',
  backgroundColor: '#d4d4d4',
  transition: INSTANT,
  '&:hover': { backgroundColor: '#c4c4c4' },
};
export const DIALOG_ADD_SX = {
  width: 118,
  height: 42,
  borderRadius: '12px',
  fontWeight: 700,
  fontSize: 16,
  textTransform: 'none',
  bgcolor: '#00a6f4',
  color: '#fff',
  border: '1px solid #00a6f4',
  boxShadow: 'none',
  transition: INSTANT,
  '&:hover': { bgcolor: '#0084d1', borderColor: '#0084d1', boxShadow: 'none' },
  '&.Mui-disabled': { bgcolor: '#e5e5e5', color: '#737373', borderColor: '#a1a1a1' },
};
