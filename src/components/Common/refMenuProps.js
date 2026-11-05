// Reference (Shopfront) editor styling shared by the Receipt and Statement editors.
export const BLUE = '#1c86f2';
export const DARK = '#313439';

// Reference dropdown list (used by every Select in the editor): opens BELOW the
// field, ~5 rows then scroll, 1px black frame, hovered row light blue, picked row
// in blue text.
export const REF_MENU_PROPS = {
  anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
  transformOrigin: { vertical: 'top', horizontal: 'left' },
  PaperProps: {
    sx: {
      mt: '2px', maxHeight: 285, borderRadius: '8px', border: '1px solid #000', boxShadow: 'none',
      '& .MuiMenuItem-root': { minHeight: 56, fontSize: 16, color: '#000', px: 2 },
      '& .MuiMenuItem-root:hover, & .MuiMenuItem-root.Mui-focusVisible': { bgcolor: '#6fd0ff' },
      '& .MuiMenuItem-root.Mui-selected': { bgcolor: 'transparent', color: '#1c86f2' },
      '& .MuiMenuItem-root.Mui-selected:hover': { bgcolor: '#6fd0ff' },
    },
  },
};
