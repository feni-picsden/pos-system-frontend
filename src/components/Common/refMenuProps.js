// Reference (Shopfront) editor styling shared by the Receipt and Statement editors.
import { byMode } from '../../theme/sfPalette';

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
      mt: '2px', maxHeight: 285, borderRadius: '8px', border: byMode('1px solid #000', '1px solid #a1a1a1'), boxShadow: 'none', bgcolor: byMode(undefined, '#232323'),
      '& .MuiMenuItem-root': { minHeight: 56, fontSize: 16, color: byMode('#000', '#f8f8f8'), px: 2 },
      '& .MuiMenuItem-root:hover, & .MuiMenuItem-root.Mui-focusVisible': { bgcolor: byMode('#6fd0ff', '#0084d1') },
      '& .MuiMenuItem-root.Mui-selected': { bgcolor: 'transparent', color: byMode('#1c86f2', '#00a6f4') },
      '& .MuiMenuItem-root.Mui-selected:hover': { bgcolor: byMode('#6fd0ff', '#0084d1'), color: byMode(undefined, '#fafafa') },
    },
  },
};
